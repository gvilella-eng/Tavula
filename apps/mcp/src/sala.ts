import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import {
  type Estado,
  IntencaoSchema,
  lerMensagemDaSala,
  reduzir,
  type Usuario,
  VERSAO_PROTOCOLO,
} from "@tabletop/shared";
import {
  ErroDoMcp,
  type Lote,
  type LoteDoClaude,
  type RespostaDaSala,
  type SalaLike,
  TOKEN_INVALIDO,
} from "@tabletop/shared/mcp";
import type { Config } from "./config.ts";

export type SocketLike = {
  addEventListener(tipo: string, ouvinte: (e: { data?: unknown; code?: number }) => void): void;
  send(texto: string): void;
  close(codigo?: number): void;
};
export type FabricaDeSocket = (url: string, token: string) => SocketLike;
/** Por que a conexão falhou, descoberto com um pedido HTTP de abertura (sem WebSocket). */
export type Motivo = "token" | "bloqueado" | "mesa" | "fora";
export type Sondar = (config: Config) => Promise<Motivo>;

export type StatusDaSala =
  | "conectando"
  | "conectado"
  | "reconectando"
  | "token_invalido"
  | "bloqueado"
  | "mesa_inexistente";

const FECHAMENTO_DA_SALA = 4001;

const fabricaPadrao: FabricaDeSocket = (url, token) => {
  const Construtor = WebSocket as unknown as new (
    url: string,
    opcoes: { headers: Record<string, string> },
  ) => SocketLike;
  return new Construtor(url, { headers: { Authorization: `Bearer ${token}` } });
};

/** Pede a abertura do WebSocket "na mão" só para ler o status que a sala responde (401, 404, 429). */
export const sondarPadrao: Sondar = (config) =>
  new Promise<Motivo>((resolve) => {
    const url = new URL(config.urlHttp);
    const pedir = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = pedir(
      url,
      {
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Version": "13",
          "Sec-WebSocket-Key": Buffer.from("tavola-mcp-sonda").toString("base64"),
          Authorization: `Bearer ${config.token}`,
        },
        timeout: 5000,
      },
      (res) => {
        res.resume();
        const s = res.statusCode ?? 0;
        resolve(
          s === 401 || s === 403 ? "token" : s === 429 ? "bloqueado" : s === 404 ? "mesa" : "fora",
        );
      },
    );
    req.on("upgrade", (_res, socket) => {
      socket.destroy();
      resolve("fora");
    });
    req.on("error", () => resolve("fora"));
    req.on("timeout", () => {
      req.destroy();
      resolve("fora");
    });
    req.end();
  });

type Pendente = {
  id: string;
  /** Um snapshot novo conta como resposta (publicar, descartar...). O Desfazer só responde com o `claude.desfeito`. */
  aceitaSnapshot: boolean;
  resolver: (r: RespostaDaSala) => void;
  temporizador: ReturnType<typeof setTimeout>;
};

type Opcoes = {
  fabrica?: FabricaDeSocket;
  sondar?: Sondar;
  /** Espera entre as tentativas de reconexão (ms); o padrão cresce de 1 s até 30 s. */
  esperaDaReconexao?: (tentativa: number) => number;
  /** Para saber quando algo mudou (permissões, papel, estado) e reavaliar quais ferramentas mostrar. */
  aoMudar?: () => void;
  registrar?: (texto: string) => void;
};

/** Um balde de fichas: a sala deixa 20 pedidos por segundo (rajada de 40); o cliente fica abaixo disso. */
class Balde {
  private fichas: number;
  private ultimo: number;
  private readonly capacidade = 30;
  private readonly porSegundo = 15;
  constructor() {
    this.fichas = this.capacidade;
    this.ultimo = Date.now();
  }
  async esperar(): Promise<void> {
    for (;;) {
      const agora = Date.now();
      this.fichas = Math.min(
        this.capacidade,
        this.fichas + ((agora - this.ultimo) / 1000) * this.porSegundo,
      );
      this.ultimo = agora;
      if (this.fichas >= 1) {
        this.fichas -= 1;
        return;
      }
      const falta = Math.ceil(((1 - this.fichas) / this.porSegundo) * 1000);
      await new Promise((r) => setTimeout(r, falta));
    }
  }
}

/**
 * A conexão do Claude com a mesa: abre o WebSocket com o token, guarda o estado como o navegador faz (`reduzir`),
 * reconecta sozinha e entrega cada pedido com a resposta da sala. Não decide nada sobre permissão: a sala decide.
 */
export class Sala implements SalaLike {
  status: StatusDaSala = "conectando";
  private socket: SocketLike | null = null;
  private estadoAtual: Estado | null = null;
  private usuarioId: string | null = null;
  private lotesAtuais: LoteDoClaude[] = [];
  private pendentes = new Map<string, Pendente>();
  private tentativa = 0;
  private parada = false;
  private reconectar: ReturnType<typeof setTimeout> | null = null;
  private esperando: Array<() => void> = [];
  private contador = 0;
  private readonly balde = new Balde();
  private readonly fabrica: FabricaDeSocket;
  private readonly sondar: Sondar;
  private readonly espera: (tentativa: number) => number;
  private readonly config: Config;
  private readonly opcoes: Opcoes;

  constructor(config: Config, opcoes: Opcoes = {}) {
    this.config = config;
    this.opcoes = opcoes;
    this.fabrica = opcoes.fabrica ?? fabricaPadrao;
    this.sondar = opcoes.sondar ?? sondarPadrao;
    this.espera = opcoes.esperaDaReconexao ?? ((n) => Math.min(30_000, 1000 * 2 ** Math.min(n, 5)));
  }

  iniciar(): void {
    this.parada = false;
    this.conectar();
  }

  parar(): void {
    this.parada = true;
    if (this.reconectar) clearTimeout(this.reconectar);
    this.socket?.close(1000);
    this.socket = null;
    this.falharPendentes("A conexão com a mesa foi encerrada.");
    this.acordar();
  }

  /** Espera o primeiro estado da sala (o snapshot); falha com o motivo se a sala recusou o token. */
  async esperarPronto(ms = 8000): Promise<void> {
    if (this.estadoAtual && this.status === "conectado") return;
    if (this.recusada()) throw new ErroDoMcp(this.textoDaRecusa());
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      this.esperando.push(() => {
        clearTimeout(t);
        resolve();
      });
    });
    if (this.recusada()) throw new ErroDoMcp(this.textoDaRecusa());
    if (!this.estadoAtual) {
      throw new ErroDoMcp(
        "Sem conexão com a mesa. Confira se o servidor do Távola está ligado e se TAVOLA_URL e TAVOLA_MESA estão certos; o MCP tenta de novo sozinho.",
      );
    }
  }

  estado(): Estado {
    if (this.recusada()) throw new ErroDoMcp(this.textoDaRecusa());
    if (!this.estadoAtual) {
      throw new ErroDoMcp("Ainda sem conexão com a mesa. Tente de novo em instantes.");
    }
    return this.estadoAtual;
  }

  /** O estado, se já há um (sem falhar): para decidir quais ferramentas mostrar. */
  estadoOuNulo(): Estado | null {
    return this.recusada() ? null : this.estadoAtual;
  }

  eu(): Usuario {
    const estado = this.estado();
    const u = estado.usuarios.find((x) => x.id === this.usuarioId);
    if (!u) throw new ErroDoMcp("A mesa não conhece mais este usuário. Gere outro token.");
    return u;
  }

  lotes(): LoteDoClaude[] {
    return this.lotesAtuais;
  }

  recusada(): boolean {
    return (
      this.status === "token_invalido" ||
      this.status === "bloqueado" ||
      this.status === "mesa_inexistente"
    );
  }

  textoDaRecusa(): string {
    if (this.status === "bloqueado") {
      return "A sala bloqueou este computador por tentativas demais com token errado. Espere 15 minutos e confira o TAVOLA_TOKEN.";
    }
    if (this.status === "mesa_inexistente") {
      return "Essa mesa não existe nesse endereço. Confira o TAVOLA_URL e o TAVOLA_MESA.";
    }
    return TOKEN_INVALIDO;
  }

  /** Manda uma intenção e espera a resposta (o evento do pedido, o erro, o snapshot novo ou o resultado do Desfazer). */
  async enviar(tipo: string, dados: unknown, lote?: Lote): Promise<RespostaDaSala> {
    await this.esperarPronto();
    for (let tentativa = 0; ; tentativa++) {
      const r = await this.enviarUma(tipo, dados, lote);
      if (r.ok || r.codigo !== "muitas_mensagens" || tentativa >= 3) return r;
      await new Promise((res) => setTimeout(res, 1200));
    }
  }

  private async enviarUma(tipo: string, dados: unknown, lote?: Lote): Promise<RespostaDaSala> {
    const id = `mcp-${++this.contador}-${Math.random().toString(36).slice(2, 8)}`;
    const quadro = {
      v: VERSAO_PROTOCOLO,
      id,
      tipo,
      dados,
      ...(lote ? { loteId: lote.loteId, lote: lote.lote.slice(0, 120) } : {}),
    };
    const lida = IntencaoSchema.safeParse(quadro);
    if (!lida.success) {
      return { ok: false, codigo: "mensagem_invalida", mensagem: resumirErroDoZod(lida.error) };
    }
    await this.balde.esperar();
    const socket = this.socket;
    if (!socket || this.status !== "conectado") {
      throw new ErroDoMcp("A conexão com a mesa caiu. O MCP está reconectando: tente de novo.");
    }
    return new Promise<RespostaDaSala>((resolver) => {
      const temporizador = setTimeout(() => {
        // Sem resposta: a sala não mudou nada (edição sem mudança real não gera evento). Conta como feito.
        this.pendentes.delete(id);
        resolver({ ok: true });
      }, this.config.esperaMs);
      this.pendentes.set(id, {
        id,
        resolver,
        temporizador,
        aceitaSnapshot: tipo !== "claude.desfazer",
      });
      socket.send(JSON.stringify(quadro));
    });
  }

  private resolver(id: string, r: RespostaDaSala): void {
    const p = this.pendentes.get(id);
    if (!p) return;
    clearTimeout(p.temporizador);
    this.pendentes.delete(id);
    p.resolver(r);
  }

  private falharPendentes(mensagem: string): void {
    for (const p of this.pendentes.values()) {
      clearTimeout(p.temporizador);
      p.resolver({ ok: false, codigo: "sem_conexao", mensagem });
    }
    this.pendentes.clear();
  }

  private acordar(): void {
    const lista = this.esperando;
    this.esperando = [];
    for (const f of lista) f();
  }

  private conectar(): void {
    if (this.parada) return;
    this.status = this.tentativa === 0 ? "conectando" : "reconectando";
    let socket: SocketLike;
    try {
      socket = this.fabrica(this.config.urlWs, this.config.token);
    } catch {
      void this.aoFalhar();
      return;
    }
    this.socket = socket;
    let abriu = false;
    socket.addEventListener("open", () => {
      abriu = true;
    });
    socket.addEventListener("message", (e) => {
      if (this.socket === socket && typeof e.data === "string") this.tratar(e.data);
    });
    socket.addEventListener("error", () => {
      // O "close" que vem a seguir decide o que fazer.
    });
    socket.addEventListener("close", (e) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.falharPendentes("A conexão com a mesa caiu. O MCP está reconectando: tente de novo.");
      if (this.parada) return;
      if (e.code === FECHAMENTO_DA_SALA) {
        // Token revogado ou conta tirada da mesa: reconectar não adianta.
        this.status = "token_invalido";
        this.acordar();
        this.opcoes.aoMudar?.();
        return;
      }
      if (abriu) this.tentativa = 0;
      void this.aoFalhar();
    });
  }

  private async aoFalhar(): Promise<void> {
    if (this.parada) return;
    const motivo = await this.sondar(this.config).catch((): Motivo => "fora");
    if (this.parada) return;
    if (motivo === "token") this.status = "token_invalido";
    else if (motivo === "bloqueado") this.status = "bloqueado";
    else if (motivo === "mesa") this.status = "mesa_inexistente";
    if (this.recusada()) {
      this.acordar();
      this.opcoes.aoMudar?.();
      return;
    }
    this.status = "reconectando";
    const espera = this.espera(this.tentativa++);
    this.reconectar = setTimeout(() => this.conectar(), espera);
    this.acordar();
  }

  private tratar(texto: string): void {
    const lida = lerMensagemDaSala(texto);
    if (!lida.ok) {
      this.opcoes.registrar?.(`mensagem da sala ignorada: ${lida.motivo}`);
      return;
    }
    const m = lida.valor;
    switch (m.tipo) {
      case "snapshot":
        this.usuarioId = m.dados.usuarioId;
        this.estadoAtual = m.dados.estado;
        this.status = "conectado";
        this.tentativa = 0;
        // Publicar e descartar rascunhos (e criar item visível a outros) respondem com um snapshot novo, não com o evento.
        for (const p of [...this.pendentes.values()]) {
          if (p.aceitaSnapshot) this.resolver(p.id, { ok: true });
        }
        this.acordar();
        this.opcoes.aoMudar?.();
        break;
      case "evento": {
        if (this.estadoAtual) this.estadoAtual = reduzir(this.estadoAtual, m.dados);
        const id = m.dados.origem.idPedido;
        if (this.pendentes.has(id)) this.resolver(id, { ok: true, evento: m.dados });
        this.opcoes.aoMudar?.();
        break;
      }
      case "erro":
        if (m.dados.idPedido) {
          this.resolver(m.dados.idPedido, {
            ok: false,
            codigo: m.dados.codigo,
            mensagem: m.dados.mensagem,
          });
        } else {
          this.opcoes.registrar?.(`erro da sala: ${m.dados.codigo}`);
        }
        break;
      case "claude.lotes":
        this.lotesAtuais = m.dados.lotes;
        break;
      case "claude.desfeito":
        this.resolver(m.dados.idPedido, {
          ok: true,
          desfeito: { aplicados: m.dados.aplicados, pulados: m.dados.pulados },
        });
        break;
      default:
        break;
    }
  }
}

function resumirErroDoZod(erro: {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
}): string {
  const primeiros = erro.issues.slice(0, 3).map((i) => {
    const caminho = i.path.filter((p) => p !== "dados" && p !== "tipo").join(".");
    return caminho ? `${caminho}: ${i.message}` : i.message;
  });
  return `Dados inválidos para a mesa (${primeiros.join("; ")}).`;
}
