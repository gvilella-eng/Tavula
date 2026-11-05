import { DurableObject } from "cloudflare:workers";
import {
  type CodigoDeErro,
  calcularUso,
  diaUtc,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  idDoPedido,
  lerIntencao,
  mensagem,
  type Presenca,
  processar,
  tokenVisivelPara,
  type Usuario,
  visaoPara,
} from "@tabletop/shared";
import semente from "../../../fixtures/campanha.seed.json";
import { Agendador } from "./agendador";
import { Armazenamento, type UsoDoDia } from "./armazenamento";

/** O valor do cabeçalho Upgrade não diferencia maiúsculas ("websocket", "WebSocket"). */
export function pedeWebSocket(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

/** Cabeçalho que o Worker preenche com o usuário identificado (nunca confiar no que vem de fora). */
export const CABECALHO_USUARIO = "x-tabletop-usuario";

const TEMPO_RECONECTANDO_MS = 10_000;
const INTERVALO_USO_MS = 5_000;
const MENSAGENS_POR_LOTE_DE_USO = 50;

/** O que fica no `serializeAttachment` de cada socket: sobrevive à hibernação. */
type Identidade = { usuarioId: string; conexaoId: string };

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * A sala da campanha: autoritativa. O estado em memória é só cache do SQLite (recarregado no
 * construtor); quem é cada socket vem do attachment dele.
 */
export class Sala extends DurableObject<Env> {
  private estado!: Estado;
  private readonly banco: Armazenamento;
  private readonly agenda: Agendador;
  private uso: UsoDoDia = { dia: "", mensagens: 0, conexoes: 0 };
  private mensagensDesdeGravacaoDoUso = 0;
  private mensagensDesdeEnvioDoUso = 0;
  private ultimoEnvioDoUso = 0;
  /**
   * Tokens que cada socket está arrastando (mandou `token.mover` e ainda não `token.soltar`). Só
   * memória: enquanto alguém arrasta, a sala recebe mensagens e não hiberna.
   */
  private readonly arrastes = new Map<WebSocket, Set<string>>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.banco = new Armazenamento(ctx.storage.sql);
    this.agenda = new Agendador(ctx.storage.sql, ctx.storage);
    void ctx.blockConcurrencyWhile(async () => {
      this.banco.migrar();
      let carregado = this.banco.carregar();
      if (!carregado) {
        carregado = estadoInicial(semente);
        this.banco.salvarTudo(carregado);
      }
      this.estado = carregado;
      this.uso = this.banco.lerUso() ?? { dia: diaUtc(new Date()), mensagens: 0, conexoes: 0 };
    });
  }

  // --- HTTP -----------------------------------------------------------------------------------

  override async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/usuarios" && request.method === "GET") {
      return json(this.estado.usuarios.map(({ id, nome, cor }) => ({ id, nome, cor })));
    }
    if (pathname === "/api/eu" && request.method === "GET") {
      const u = this.estado.usuarios.find((x) => x.id === request.headers.get(CABECALHO_USUARIO));
      return u ? json({ id: u.id, nome: u.nome, cor: u.cor }) : new Response(null, { status: 401 });
    }
    if (pathname === "/api/entrar" && request.method === "POST") return this.entrar(request);
    if (pathname === "/ws") return this.abrirSocket(request);
    if (pathname.startsWith("/teste/")) return this.rotaDeTeste(pathname);
    return new Response("Não encontrado", { status: 404 });
  }

  private async entrar(request: Request): Promise<Response> {
    let usuarioId: unknown;
    try {
      usuarioId = ((await request.json()) as { usuarioId?: unknown }).usuarioId;
    } catch {
      return json({ erro: "corpo inválido" }, 400);
    }
    if (typeof usuarioId !== "string") return json({ erro: "usuarioId obrigatório" }, 400);
    if (!this.estado.usuarios.some((u) => u.id === usuarioId)) {
      return json({ erro: "usuário desconhecido" }, 404);
    }
    return json({ ok: true });
  }

  private async abrirSocket(request: Request): Promise<Response> {
    if (!pedeWebSocket(request)) return new Response("Esperava WebSocket", { status: 426 });
    const usuarioId = request.headers.get(CABECALHO_USUARIO);
    const usuario = this.estado.usuarios.find((u) => u.id === usuarioId);
    if (!usuario) return new Response("Usuário desconhecido", { status: 401 });

    const par = new WebSocketPair();
    const [cliente, servidor] = [par[0], par[1]];
    // Hibernation API: o runtime cuida do socket; nunca usar servidor.accept().
    this.ctx.acceptWebSocket(servidor);
    const identidade: Identidade = { usuarioId: usuario.id, conexaoId: crypto.randomUUID() };
    servidor.serializeAttachment(identidade);

    this.agenda.cancelar("presenca.expirar", usuario.id);
    this.rolarDia();
    this.uso.conexoes++;
    this.banco.gravarUso(this.uso);

    this.enviarSnapshot(servidor, usuario);
    this.difundirPresenca();
    return new Response(null, { status: 101, webSocket: cliente });
  }

  /** Rotas que só existem com `MODO=teste` (E2E): nunca no `pnpm dev`. */
  private async rotaDeTeste(pathname: string): Promise<Response> {
    if (this.env.MODO !== "teste") return new Response("Não encontrado", { status: 404 });

    if (pathname === "/teste/zerar") {
      this.banco.apagarTudo();
      await this.ctx.storage.deleteAlarm();
      this.estado = estadoInicial(semente);
      this.banco.salvarTudo(this.estado);
      this.uso = { dia: diaUtc(new Date()), mensagens: 0, conexoes: 0 };
      this.mensagensDesdeGravacaoDoUso = 0;
      this.mensagensDesdeEnvioDoUso = 0;
      for (const ws of this.ctx.getWebSockets()) {
        const usuario = this.usuarioDe(ws);
        if (usuario) this.enviarSnapshot(ws, usuario);
        else ws.close(4001, "usuário removido");
      }
      this.difundirPresenca();
      return json({ ok: true });
    }
    if (pathname === "/teste/reiniciar-sala") {
      // Esquece a memória e derruba os sockets, como um reinício do processo. O estado volta do SQLite.
      this.ctx.abort("reinício pedido pelo teste");
      return json({ ok: true });
    }
    return new Response("Não encontrado", { status: 404 });
  }

  // --- WebSocket (Hibernation) ----------------------------------------------------------------

  override async webSocketMessage(ws: WebSocket, bruta: string | ArrayBuffer): Promise<void> {
    await this.contarMensagem();

    const usuario = this.usuarioDe(ws);
    if (!usuario) {
      ws.close(4001, "usuário removido");
      return;
    }

    const lida = lerIntencao(bruta);
    if (!lida.ok) {
      this.erro(
        ws,
        typeof bruta === "string" ? idDoPedido(bruta) : null,
        "mensagem_invalida",
        lida.motivo,
      );
      return;
    }
    const intencao = lida.valor;

    const r = processar(this.estado, usuario.id, intencao, new Date().toISOString());
    if (!r.ok) {
      this.erro(ws, intencao.id, r.erro.codigo, r.erro.mensagem);
      return;
    }

    if (r.eventos.length > 0 || r.snapshotPara === "todos") {
      if (r.snapshotPara === "todos") this.banco.salvarTudo(r.estado);
      else this.banco.salvarEventos(r.estado, r.eventos);
    }
    const antes = this.estado;
    this.estado = r.estado;

    // Movimento ao vivo: transitório, não grava; só quem pode ver o token recebe (menos o remetente).
    if (r.movendo) {
      this.marcarArraste(ws, r.movendo.id, true);
      this.repassarMovimento(ws, r.movendo);
      return;
    }
    if (intencao.tipo === "token.soltar") this.marcarArraste(ws, intencao.dados.id, false);

    if (r.exportacao) {
      this.enviar(
        ws,
        mensagem({
          tipo: "exportacao",
          dados: { idPedido: intencao.id, exportacao: r.exportacao },
        }),
      );
    }

    this.distribuir(r.eventos, r.snapshotPara, antes);
    if (r.snapshotPara === "todos" || r.snapshotPara.length > 0) this.difundirPresenca();
  }

  override webSocketClose(ws: WebSocket, codigo: number, motivo: string): void {
    // Códigos reservados (ex.: 1005/1006) não podem ser enviados no close.
    try {
      ws.close(codigo >= 1000 && codigo <= 1003 ? codigo : 1000, motivo);
    } catch {
      // já fechado
    }
    void this.aoSair(ws);
  }

  override webSocketError(ws: WebSocket, _erro: unknown): void {
    try {
      ws.close(1011, "erro");
    } catch {
      // já fechado
    }
    void this.aoSair(ws);
  }

  private async aoSair(ws: WebSocket): Promise<void> {
    this.desfazerArrastes(ws);
    const identidade = this.identidadeDe(ws);
    if (!identidade) return;
    if (!this.estaOnline(identidade.usuarioId, ws)) {
      await this.agenda.agendar(
        "presenca.expirar",
        identidade.usuarioId,
        Date.now() + TEMPO_RECONECTANDO_MS,
      );
    }
    this.difundirPresenca(ws);
  }

  // --- Alarme (agendador único) ---------------------------------------------------------------

  override async alarm(): Promise<void> {
    const vencidos = this.agenda.tomarVencidos(Date.now());
    for (const v of vencidos) {
      if (v.tipo === "presenca.expirar") this.difundirPresenca();
      else if (v.tipo === "uso.enviar") this.enviarUso();
    }
    await this.agenda.reprogramar();
  }

  // --- Presença -------------------------------------------------------------------------------

  private estaOnline(usuarioId: string, ignorar?: WebSocket): boolean {
    return this.ctx
      .getWebSockets()
      .some(
        (s) =>
          s !== ignorar &&
          s.readyState === WebSocket.OPEN &&
          this.identidadeDe(s)?.usuarioId === usuarioId,
      );
  }

  private presenca(ignorar?: WebSocket): Record<string, Presenca> {
    const reconectando = new Set(this.agenda.chaves("presenca.expirar"));
    const resultado: Record<string, Presenca> = {};
    for (const u of this.estado.usuarios) {
      if (this.estaOnline(u.id, ignorar)) resultado[u.id] = "online";
      else resultado[u.id] = reconectando.has(u.id) ? "reconectando" : "offline";
    }
    return resultado;
  }

  private difundirPresenca(ignorar?: WebSocket): void {
    const texto = mensagem({ tipo: "presenca", dados: { usuarios: this.presenca(ignorar) } });
    for (const ws of this.ctx.getWebSockets()) if (ws !== ignorar) this.enviar(ws, texto);
  }

  // --- Contador de uso ------------------------------------------------------------------------

  private rolarDia(): void {
    const hoje = diaUtc(new Date());
    if (this.uso.dia !== hoje) {
      this.uso = { dia: hoje, mensagens: 0, conexoes: 0 };
      this.mensagensDesdeGravacaoDoUso = 0;
      this.banco.gravarUso(this.uso);
    }
  }

  private async contarMensagem(): Promise<void> {
    this.rolarDia();
    this.uso.mensagens++;
    // Gravação agrupada: a cada lote de mensagens (a perda máxima num reinício é um lote).
    if (++this.mensagensDesdeGravacaoDoUso >= MENSAGENS_POR_LOTE_DE_USO) {
      this.mensagensDesdeGravacaoDoUso = 0;
      this.banco.gravarUso(this.uso);
    }
    // Envio aos mestres: no máximo a cada 5 s ou a cada lote; senão fica para o agendador.
    const agora = Date.now();
    if (
      ++this.mensagensDesdeEnvioDoUso >= MENSAGENS_POR_LOTE_DE_USO ||
      agora - this.ultimoEnvioDoUso >= INTERVALO_USO_MS
    ) {
      this.enviarUso();
    } else if (!this.agenda.existe("uso.enviar", "uso")) {
      await this.agenda.agendar("uso.enviar", "uso", this.ultimoEnvioDoUso + INTERVALO_USO_MS);
    }
  }

  private textoDoUso(): string {
    const { dia, mensagens, conexoes } = this.uso;
    return mensagem({ tipo: "uso", dados: calcularUso(dia, mensagens, conexoes) });
  }

  private enviarUso(): void {
    this.ultimoEnvioDoUso = Date.now();
    this.mensagensDesdeEnvioDoUso = 0;
    this.agenda.cancelar("uso.enviar", "uso");
    const texto = this.textoDoUso();
    for (const ws of this.ctx.getWebSockets()) {
      if (this.usuarioDe(ws)?.papel === "mestre") this.enviar(ws, texto);
    }
  }

  // --- Envio ----------------------------------------------------------------------------------

  private identidadeDe(ws: WebSocket): Identidade | null {
    return (ws.deserializeAttachment() as Identidade | null) ?? null;
  }

  private usuarioDe(ws: WebSocket): Usuario | null {
    const id = this.identidadeDe(ws)?.usuarioId;
    return this.estado.usuarios.find((u) => u.id === id) ?? null;
  }

  private enviar(ws: WebSocket, texto: string): void {
    try {
      ws.send(texto);
    } catch {
      // socket já fechando: o webSocketClose cuida da presença
    }
  }

  private erro(ws: WebSocket, idPedido: string | null, codigo: CodigoDeErro, texto: string): void {
    this.enviar(ws, mensagem({ tipo: "erro", dados: { idPedido, codigo, mensagem: texto } }));
  }

  private enviarSnapshot(ws: WebSocket, usuario: Usuario): void {
    this.enviar(
      ws,
      mensagem({
        tipo: "snapshot",
        dados: { usuarioId: usuario.id, estado: visaoPara(this.estado, usuario) },
      }),
    );
    if (usuario.papel === "mestre") this.enviar(ws, this.textoDoUso());
  }

  private marcarArraste(ws: WebSocket, id: string, ativo: boolean): void {
    const ids = this.arrastes.get(ws) ?? new Set<string>();
    if (ativo) ids.add(id);
    else ids.delete(id);
    if (ids.size > 0) this.arrastes.set(ws, ids);
    else this.arrastes.delete(ws);
  }

  /**
   * Quem caiu no meio de um arraste nunca vai mandar o `token.soltar`: os outros voltam o token
   * para a posição gravada (senão ficariam vendo uma posição que não existe na sala).
   */
  private desfazerArrastes(ws: WebSocket): void {
    const ids = this.arrastes.get(ws);
    if (!ids) return;
    this.arrastes.delete(ws);
    for (const id of ids) {
      const token = this.estado.tokens.find((t) => t.id === id);
      if (token) this.repassarMovimento(ws, { id, x: token.x, y: token.y });
    }
  }

  /** `token.movendo`: vai a quem pode ver o token, nunca ao remetente. */
  private repassarMovimento(remetente: WebSocket, mov: { id: string; x: number; y: number }): void {
    const token = this.estado.tokens.find((t) => t.id === mov.id);
    if (!token) return;
    const texto = mensagem({ tipo: "token.movendo", dados: mov });
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === remetente) continue;
      const usuario = this.usuarioDe(ws);
      if (usuario && tokenVisivelPara(token, usuario)) this.enviar(ws, texto);
    }
  }

  /** Entrega cada evento (filtrado por usuário) ou, para quem pede, um snapshot novo. */
  private distribuir(eventos: EventoSala[], snapshotPara: "todos" | string[], antes: Estado): void {
    for (const ws of this.ctx.getWebSockets()) {
      const usuario = this.usuarioDe(ws);
      if (!usuario) {
        ws.close(4001, "usuário removido");
        continue;
      }
      if (snapshotPara === "todos" || snapshotPara.includes(usuario.id)) {
        this.enviarSnapshot(ws, usuario);
        continue;
      }
      for (const ev of eventos) {
        const visto = eventoPara(ev, usuario, antes, this.estado);
        if (visto) this.enviar(ws, mensagem({ tipo: "evento", dados: visto }));
      }
    }
  }
}
