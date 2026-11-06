import { DurableObject } from "cloudflare:workers";
import {
  assetVisivelPara,
  type CodigoDeErro,
  calcularUso,
  diaUtc,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  type Intencao,
  idDoPedido,
  lerFrameDePedaco,
  lerIntencao,
  mensagem,
  type Pacote,
  type Presenca,
  processar,
  tokenVisivelPara,
  type Usuario,
  visaoPara,
} from "@tabletop/shared";
import semente from "../../../fixtures/campanha.seed.json";
import { Agendador } from "./agendador";
import { Armazenamento, type UsoDoDia } from "./armazenamento";
import { Transferencias } from "./transferencias";

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
  /** Envio de arquivos entre navegadores (só memória; a sala nunca grava pedaço). */
  private readonly transferencias: Transferencias;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.banco = new Armazenamento(ctx.storage.sql);
    this.agenda = new Agendador(ctx.storage.sql, ctx.storage);
    this.transferencias = new Transferencias({
      candidatos: (hash) => this.candidatosA(hash),
      pedirEnvio: (conexaoId, hash, indices) =>
        this.enviarA(conexaoId, mensagem({ tipo: "asset.enviar", dados: { hash, indices } })),
      repassar: (conexaoId, frame) => this.enviarA(conexaoId, frame),
      avisarIndisponivel: (conexaoId, hash) =>
        this.enviarA(conexaoId, mensagem({ tipo: "asset.indisponivel", dados: { hash } })),
      agora: () => Date.now(),
    });
    void ctx.blockConcurrencyWhile(async () => {
      this.banco.migrar();
      let carregado = this.banco.carregar();
      if (!carregado) {
        carregado = estadoInicial(semente);
        this.banco.salvarTudo(carregado);
      }
      this.estado = carregado;
      this.uso = this.banco.lerUso() ?? { dia: diaUtc(new Date()), mensagens: 0, conexoes: 0 };
      // Ao acordar: conexão que não existe mais não tem cópia de nada.
      this.banco.limparPosseOrfa(this.conexoesAbertas().map((c) => c.conexaoId));
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
    this.avisarPreparoA(servidor, usuario);
    if (usuario.papel === "mestre") this.enviarProgresso();
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
      this.transferencias.limpar();
      this.banco.descartarTodosOsPreparos();
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

    // Frame binário: só pedaço de arquivo, só de quem a sala pediu; o resto some em silêncio.
    if (typeof bruta !== "string") {
      this.tratarPedaco(ws, bruta);
      return;
    }

    const lida = lerIntencao(bruta);
    if (!lida.ok) {
      this.erro(ws, idDoPedido(bruta), "mensagem_invalida", lida.motivo);
      return;
    }
    const intencao = lida.valor;

    const r = processar(this.estado, usuario.id, intencao, new Date().toISOString());
    if (!r.ok) {
      this.erro(ws, intencao.id, r.erro.codigo, r.erro.mensagem);
      return;
    }

    // Só a importação reescreve tudo. Levar o grupo e mudar quem vê uma pasta também mandam snapshot
    // a todos, mas gravam só o que os eventos mudaram.
    if (intencao.tipo === "campanha.importar") this.banco.salvarTudo(r.estado);
    else if (r.eventos.length > 0) this.banco.salvarEventos(r.estado, r.eventos);
    const antes = this.estado;
    this.estado = r.estado;
    this.cuidarDeAsset(ws, usuario, intencao);
    this.cuidarDePreparo(intencao, r.preparo);

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

    // As chaves do preparo chegam antes do snapshot: o cliente já sabe que vai decifrar, não baixar.
    if (r.grupoMovido) this.entregarChaves(r.grupoMovido.cenaId);
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
    this.banco.limparPosse(identidade.conexaoId);
    this.transferencias.conexaoSaiu(identidade.conexaoId);
    this.enviarProgresso();
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

  // --- Arquivos (assets) ----------------------------------------------------------------------

  private conexoesAbertas(): { conexaoId: string; ws: WebSocket }[] {
    const abertas: { conexaoId: string; ws: WebSocket }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const identidade = this.identidadeDe(ws);
      if (identidade && ws.readyState === WebSocket.OPEN) {
        abertas.push({ conexaoId: identidade.conexaoId, ws });
      }
    }
    return abertas;
  }

  /**
   * Conexões online com cópia do asset, na ordem em que anunciaram. Só serve quem pode **ver** o
   * asset agora: senão um jogador que anunciasse o hash da imagem de um token oculto seria chamado
   * para enviá-la (e descobriria que ela está em uso).
   */
  private candidatosA(hash: string) {
    const abertas = new Set(this.conexoesAbertas().map((c) => c.conexaoId));
    const candidatos = [];
    for (const p of this.banco.possesDe(hash)) {
      if (!abertas.has(p.conexao)) continue;
      const usuario = this.estado.usuarios.find((u) => u.id === p.usuario);
      if (!usuario || !assetVisivelPara(hash, this.estado, usuario)) continue;
      candidatos.push({ conexaoId: p.conexao, usuarioId: usuario.id, papel: usuario.papel });
    }
    return candidatos;
  }

  private enviarA(conexaoId: string, dados: string | ArrayBuffer): void {
    const alvo = this.conexoesAbertas().find((c) => c.conexaoId === conexaoId);
    if (!alvo) return;
    try {
      alvo.ws.send(dados);
    } catch {
      // socket fechando: o webSocketClose cuida
    }
  }

  /** Frame binário de pedaço: a coordenação decide se vale (pedido àquele socket) e repassa. */
  private tratarPedaco(ws: WebSocket, bruto: ArrayBuffer): void {
    const frame = lerFrameDePedaco(bruto);
    const identidade = this.identidadeDe(ws);
    if (!frame || !identidade) return;
    this.transferencias.frame(identidade.conexaoId, frame, bruto);
  }

  /** O vaivém de arquivos que não muda o estado (`processar` já conferiu quem pode). */
  private cuidarDeAsset(ws: WebSocket, usuario: Usuario, intencao: Intencao): void {
    const identidade = this.identidadeDe(ws);
    if (!identidade) return;
    const conexaoId = identidade.conexaoId;
    // Posse só vale para asset que a pessoa vê (o mesmo filtro vale na hora de escolher quem serve).
    const conhecido = (hash: string) => assetVisivelPara(hash, this.estado, usuario);
    switch (intencao.tipo) {
      case "asset.pedir": {
        const { hash, faltam } = intencao.dados;
        const meta = this.estado.assets?.find((a) => a.hash === hash);
        // Sigilo: asset que a pessoa não vê responde igual a asset que não existe.
        if (!meta || !assetVisivelPara(hash, this.estado, usuario)) {
          this.erro(ws, intencao.id, "asset_inexistente", "Arquivo não encontrado.");
          return;
        }
        this.enviar(ws, mensagem({ tipo: "asset.meta", dados: { meta } }));
        const total = meta.pedacos.length;
        if (total === 0) return; // manifesto de mapa: não há bytes, só os tiles
        const indices = faltam ?? Array.from({ length: total }, (_, i) => i);
        this.transferencias.pedir(conexaoId, hash, total, meta.donoId, indices);
        return;
      }
      case "asset.inventario": {
        const hashes = intencao.dados.hashes.filter(conhecido);
        this.banco.substituirPosse(conexaoId, usuario.id, hashes);
        for (const h of hashes) this.transferencias.posseMudou(h);
        return;
      }
      case "asset.tenho": {
        const { hash } = intencao.dados;
        if (!conhecido(hash)) return;
        this.banco.adicionarPosse(conexaoId, usuario.id, hash);
        this.transferencias.posseMudou(hash);
        return;
      }
      case "asset.naoTenho": {
        const { hash } = intencao.dados;
        this.banco.removerPosse(conexaoId, hash);
        this.transferencias.naoTem(conexaoId, hash);
        return;
      }
    }
  }

  // --- Preparo cifrado de cenas ---------------------------------------------------------------

  /**
   * Guarda um preparo (`cena.preparar`) e avisa os jogadores para baixarem os arquivos cifrados;
   * descarta os preparos de cena apagada e os de uma campanha importada (os arquivos cifrados
   * deixaram de existir).
   */
  private cuidarDePreparo(
    intencao: Intencao,
    preparo: { cenaId: string; pacotes: Pacote[] } | undefined,
  ): void {
    if (intencao.tipo === "campanha.importar") {
      this.banco.descartarTodosOsPreparos();
      this.enviarProgresso(true);
    }
    if (intencao.tipo === "cena.apagar") {
      this.banco.descartarPreparos(intencao.dados.cenaId);
      this.enviarProgresso(true);
    }
    if (preparo) {
      this.banco.guardarPreparo(preparo.cenaId, preparo.pacotes);
      for (const ws of this.ctx.getWebSockets()) {
        const usuario = this.usuarioDe(ws);
        if (usuario) this.avisarPreparoA(ws, usuario);
      }
    }
    if (
      preparo ||
      intencao.tipo === "asset.tenho" ||
      intencao.tipo === "asset.naoTenho" ||
      intencao.tipo === "asset.inventario"
    ) {
      this.enviarProgresso();
    }
  }

  /** O jogador baixa o que está preparado (hashes dos arquivos cifrados; nada sobre a cena). */
  private avisarPreparoA(ws: WebSocket, usuario: Usuario): void {
    if (usuario.papel !== "jogador") return;
    const hashes = [...new Set(this.banco.preparos().map((p) => p.hashCifrado))];
    if (hashes.length > 0)
      this.enviar(ws, mensagem({ tipo: "preparo.disponivel", dados: { hashes } }));
  }

  /** Só mestres: quantos jogadores já têm todos os pacotes de cada preparo. */
  private enviarProgresso(descartou = false): void {
    const preparos = this.banco.preparos();
    // Sem preparo nada a contar; só avisa a lista vazia quando um preparo acabou de ser descartado.
    if (preparos.length === 0 && !descartou) return;
    const jogadores = this.estado.usuarios.filter((u) => u.papel === "jogador");
    const quemTem = new Map<string, Set<string>>();
    const donosDe = (hash: string) => {
      let s = quemTem.get(hash);
      if (!s) {
        s = new Set(this.banco.possesDe(hash).map((p) => p.usuario));
        quemTem.set(hash, s);
      }
      return s;
    };
    const porCena = new Map<string, typeof preparos>();
    for (const p of preparos) porCena.set(p.cenaId, [...(porCena.get(p.cenaId) ?? []), p]);
    const texto = mensagem({
      tipo: "preparo.progresso",
      dados: {
        preparos: [...porCena].map(([cenaId, pacotes]) => ({
          cenaId,
          hashesOriginais: pacotes.map((p) => p.hashOriginal),
          completos: jogadores.filter((j) => pacotes.every((p) => donosDe(p.hashCifrado).has(j.id)))
            .length,
          jogadores: jogadores.length,
        })),
      },
    });
    for (const ws of this.ctx.getWebSockets()) {
      if (this.usuarioDe(ws)?.papel === "mestre") this.enviar(ws, texto);
    }
  }

  /**
   * O grupo foi para a cena: cada jogador recebe as chaves só dos pacotes cujo original ele passa a
   * ver no estado novo (o que está oculto na cena não tem chave para ninguém). Depois da ida os
   * preparos daquela cena são descartados.
   */
  private entregarChaves(cenaId: string): void {
    const pacotes = this.banco.preparos().filter((p) => p.cenaId === cenaId);
    if (pacotes.length > 0) {
      for (const ws of this.ctx.getWebSockets()) {
        const usuario = this.usuarioDe(ws);
        if (usuario?.papel !== "jogador") continue;
        const seus = pacotes
          .filter((p) => assetVisivelPara(p.hashOriginal, this.estado, usuario))
          .map(({ hashCifrado, hashOriginal, chave }) => ({ hashCifrado, hashOriginal, chave }));
        if (seus.length > 0)
          this.enviar(ws, mensagem({ tipo: "preparo.chaves", dados: { pacotes: seus } }));
      }
    }
    this.banco.descartarPreparos(cenaId);
    this.enviarProgresso(true);
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
      if (usuario && tokenVisivelPara(token, usuario, this.estado.cenaAtivaId)) {
        this.enviar(ws, texto);
      }
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
