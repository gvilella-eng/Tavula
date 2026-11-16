import { request as httpRequest } from "node:http";
import { expect, type Page } from "@playwright/test";
import { PORTA_SALA_E2E } from "../portas.ts";
import { ID_DA_MESA } from "./ajudas";

// 12-1: ajudas dos testes do acesso do Claude. O servidor MCP é o 12-2; aqui um WebSocket do Node com o cabeçalho
// `Authorization: Bearer <token>` imita o cliente dele (um processo Node, sem `Origin`, não um navegador).

/** A sala direto (o Worker do `dev:e2e`), onde um cliente que não é navegador se conecta. */
export const SALA_E2E = `127.0.0.1:${PORTA_SALA_E2E}`;

/** Gera um token do Claude pela API, com a sessão (o cookie) da página. Devolve o token e o id dele. */
export async function gerarToken(
  p: Page,
  nome = "Claude de teste",
): Promise<{ token: string; id: string }> {
  const r = await p.request.post(`/api/m/${ID_DA_MESA}/conta/claude/gerar`, { data: { nome } });
  expect(r.status(), await r.text()).toBe(201);
  const corpo = (await r.json()) as { token: string; id: string };
  return { token: corpo.token, id: corpo.id };
}

// biome-ignore lint/suspicious/noExplicitAny: o quadro é o JSON cru da sala, que cada teste confere campo a campo
export type Cru = any;
export type Quadro = { v: number; tipo: string; dados: Record<string, Cru> };

/** O que o Claude (o WebSocket do MCP) recebe e manda, com espera por padrão. */
export class ClaudeWs {
  readonly quadros: Quadro[] = [];
  fechadoCom: number | null = null;
  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener("message", (e) => {
      if (typeof e.data === "string") this.quadros.push(JSON.parse(e.data) as Quadro);
    });
    ws.addEventListener("close", (e) => {
      this.fechadoCom = e.code;
    });
  }

  /** Abre a conexão com o token e espera o snapshot (a sala aceitou). */
  static async conectar(token: string, mesaId = ID_DA_MESA): Promise<ClaudeWs> {
    const Construtor = WebSocket as unknown as new (
      url: string,
      opcoes: { headers: Record<string, string> },
    ) => WebSocket;
    const ws = new Construtor(`ws://${SALA_E2E}/api/m/${mesaId}/ws`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const c = new ClaudeWs(ws);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", () => reject(new Error("a sala recusou a conexão do Claude")));
    });
    await expect.poll(() => c.quadros.some((q) => q.tipo === "snapshot")).toBe(true);
    return c;
  }

  /** O cabeçalho `loteId` e a descrição `lote` são do Claude (o navegador não os manda). */
  enviar(tipo: string, dados: object, lote?: { loteId: string; lote?: string }): string {
    const id = `claude-${Math.random().toString(36).slice(2, 10)}`;
    this.ws.send(JSON.stringify({ v: 1, id, tipo, dados, ...lote }));
    return id;
  }

  /** O primeiro quadro (evento ou erro) que responde a um pedido: `{tipo, dados}`. */
  async resposta(idPedido: string): Promise<Quadro> {
    let achado: Quadro | undefined;
    await expect
      .poll(() => {
        achado = this.quadros.find(
          (q) =>
            (q.tipo === "erro" && q.dados.idPedido === idPedido) ||
            (q.tipo === "evento" && q.dados.origem?.idPedido === idPedido) ||
            (q.tipo === "claude.desfeito" && q.dados.idPedido === idPedido),
        );
        return achado !== undefined;
      })
      .toBe(true);
    return achado as Quadro;
  }

  /** Manda e espera a resposta (evento ou erro). */
  async mandar(tipo: string, dados: object, lote?: { loteId: string; lote?: string }) {
    return this.resposta(this.enviar(tipo, dados, lote));
  }

  /** Intenções que a sala responde com um snapshot novo (publicar e descartar rascunhos): manda e espera o snapshot. */
  async mandarEsperandoSnapshot(
    tipo: string,
    dados: object,
    lote?: { loteId: string; lote?: string },
  ) {
    const antes = this.quadros.filter((q) => q.tipo === "snapshot").length;
    const id = this.enviar(tipo, dados, lote);
    await expect
      .poll(
        () =>
          this.quadros.some((q) => q.tipo === "erro" && q.dados.idPedido === id) ||
          this.quadros.filter((q) => q.tipo === "snapshot").length > antes,
      )
      .toBe(true);
    return this.quadros.find((q) => q.tipo === "erro" && q.dados.idPedido === id);
  }

  /** O último estado conhecido: o snapshot, mais nada (o teste confere por eventos). */
  snapshot(): Record<string, Cru> {
    const s = [...this.quadros].reverse().find((q) => q.tipo === "snapshot");
    return (s?.dados.estado ?? {}) as Record<string, Cru>;
  }

  async fechar(): Promise<void> {
    if (this.fechadoCom === null) this.ws.close();
    await expect.poll(() => this.fechadoCom !== null).toBe(true);
  }

  async esperarFechar(): Promise<number> {
    await expect.poll(() => this.fechadoCom, { timeout: 15_000 }).not.toBeNull();
    return this.fechadoCom as number;
  }
}

/** Tenta abrir o WebSocket só com HTTP cru (o que a sala responde sem aceitar): status, corpo e cabeçalhos. */
export function tentarAbrir(
  cabecalhos: Record<string, string>,
  caminho = `/api/m/${ID_DA_MESA}/ws`,
): Promise<{
  status: number;
  corpo: string;
  cabecalhos: Record<string, string | string[] | undefined>;
}> {
  return new Promise((resolve, reject) => {
    const [host, porta] = SALA_E2E.split(":");
    const req = httpRequest({
      host,
      port: Number(porta),
      path: caminho,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": Buffer.from("0123456789abcdef").toString("base64"),
        ...cabecalhos,
      },
    });
    req.on("response", (res) => {
      let corpo = "";
      res.on("data", (c) => {
        corpo += c;
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, corpo, cabecalhos: res.headers }));
    });
    req.on("upgrade", (res, socket) => {
      socket.destroy();
      resolve({ status: res.statusCode ?? 101, corpo: "", cabecalhos: res.headers });
    });
    req.on("error", reject);
    req.end();
  });
}
