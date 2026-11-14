import { execFileSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ID_DA_MESA } from "./ajudas";

// 12-2: ajudas dos testes do servidor MCP (`apps/mcp`). O teste sobe o servidor DE VERDADE (o arquivo gerado pelo build),
// em stdio, e fala com ele com o cliente do SDK, como o Claude Code faz.

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const PASTA_DO_MCP = `${RAIZ}apps/mcp`;
export const ARQUIVO_DO_MCP = `${PASTA_DO_MCP}/dist/tavola-mcp.mjs`;
const COMPENDIO_DE_EXEMPLO = `${RAIZ}fixtures/compendio/exemplo-srd.json`;

/** A sala de teste direto (o Worker) e o front de teste (o proxy do Vite, como o `pnpm dev` do usuário). */
export const URL_DA_SALA = "http://127.0.0.1:8788";
export const URL_PELO_VITE = "http://127.0.0.1:5174";

/** Gera `apps/mcp/dist/tavola-mcp.mjs` (esbuild: menos de um segundo). */
export function construirOMcp(): void {
  execFileSync(process.execPath, [`${PASTA_DO_MCP}/build.mjs`], {
    cwd: PASTA_DO_MCP,
    stdio: "ignore",
    // Nunca trava o teste: o build leva menos de um segundo.
    timeout: 60_000,
  });
}

export type RespostaDaFerramenta = { texto: string; erro: boolean };

/** Um servidor MCP rodando em stdio e o cliente do SDK ligado a ele. */
export class ClienteMcp {
  /** Tudo o que o servidor escreveu em stderr (o teste confere que o token nunca aparece). */
  saidaDeErro = "";
  private constructor(private readonly cliente: Client) {}

  static async conectar(
    token: string,
    opcoes: { url?: string; mesaId?: string } = {},
  ): Promise<ClienteMcp> {
    const transporte = new StdioClientTransport({
      command: process.execPath,
      args: [ARQUIVO_DO_MCP],
      env: {
        TAVOLA_URL: opcoes.url ?? URL_DA_SALA,
        TAVOLA_MESA: opcoes.mesaId ?? ID_DA_MESA,
        TAVOLA_TOKEN: token,
        TAVOLA_COMPENDIO: COMPENDIO_DE_EXEMPLO,
      },
      stderr: "pipe",
    });
    const cliente = new Client({ name: "teste-e2e", version: "0.0.0" });
    const c = new ClienteMcp(cliente);
    transporte.stderr?.on("data", (d: Buffer) => {
      c.saidaDeErro += d.toString();
    });
    await cliente.connect(transporte, { timeout: 30_000 });
    return c;
  }

  async ferramentas(): Promise<string[]> {
    const r = await this.cliente.listTools(undefined, { timeout: 30_000 });
    return r.tools.map((t) => t.name);
  }

  async chamar(
    nome: string,
    argumentos: Record<string, unknown> = {},
  ): Promise<RespostaDaFerramenta> {
    // Toda chamada tem limite: o servidor MCP que não responde derruba o teste, não o trava.
    const r = await this.cliente.callTool({ name: nome, arguments: argumentos }, undefined, {
      timeout: 60_000,
    });
    const conteudo = (r.content ?? []) as { type: string; text?: string }[];
    return {
      texto: conteudo.map((c) => c.text ?? "").join("\n"),
      erro: r.isError === true,
    };
  }

  async fechar(): Promise<void> {
    await this.cliente.close().catch(() => {});
  }
}

// --- 12-3: o MCP por HTTP, na própria sala ----------------------------------------------------------------------------

/** O endereço do servidor MCP de uma mesa (a origem pode ser a do Vite, como no comando que a tela mostra, ou a da sala). */
export function urlDoMcp(origem: string = URL_PELO_VITE, mesaId: string = ID_DA_MESA): string {
  return `${origem}/api/m/${mesaId}/mcp`;
}

/** O cliente do SDK (`StreamableHTTPClientTransport`, o mesmo do Claude Code) ligado ao MCP da sala, com `Authorization: Bearer`. */
export class ClienteMcpHttp {
  private constructor(private readonly cliente: Client) {}

  static async conectar(
    token: string,
    opcoes: { url?: string; mesaId?: string } = {},
  ): Promise<ClienteMcpHttp> {
    const transporte = new StreamableHTTPClientTransport(
      new URL(urlDoMcp(opcoes.url, opcoes.mesaId)),
      { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const cliente = new Client({ name: "teste-e2e-http", version: "0.0.0" });
    const c = new ClienteMcpHttp(cliente);
    await cliente.connect(transporte, { timeout: 30_000 });
    return c;
  }

  async ferramentas(): Promise<string[]> {
    const r = await this.cliente.listTools(undefined, { timeout: 30_000 });
    return r.tools.map((t) => t.name);
  }

  async chamar(
    nome: string,
    argumentos: Record<string, unknown> = {},
  ): Promise<RespostaDaFerramenta> {
    const r = await this.cliente.callTool({ name: nome, arguments: argumentos }, undefined, {
      timeout: 90_000,
    });
    const conteudo = (r.content ?? []) as { type: string; text?: string }[];
    return { texto: conteudo.map((c) => c.text ?? "").join("\n"), erro: r.isError === true };
  }

  async fechar(): Promise<void> {
    await this.cliente.close().catch(() => undefined);
  }
}

export type RespostaCrua = { status: number; cabecalhos: Record<string, string>; corpo: string };

/** Um POST (ou outro método) cru ao MCP da sala, para conferir os códigos HTTP e os cabeçalhos que o SDK esconde. */
export async function pedirAoMcp(
  opcoes: {
    metodo?: string;
    url?: string;
    mesaId?: string;
    token?: string | null;
    autorizacao?: string;
    cabecalhos?: Record<string, string>;
    corpo?: string;
    tipo?: string | null;
  } = {},
): Promise<RespostaCrua> {
  const url = new URL(urlDoMcp(opcoes.url ?? URL_DA_SALA, opcoes.mesaId));
  const cabecalhos: Record<string, string> = { ...(opcoes.cabecalhos ?? {}) };
  if (opcoes.tipo !== null) cabecalhos["Content-Type"] = opcoes.tipo ?? "application/json";
  if (opcoes.autorizacao) cabecalhos.Authorization = opcoes.autorizacao;
  else if (opcoes.token) cabecalhos.Authorization = `Bearer ${opcoes.token}`;
  const corpo =
    opcoes.corpo ??
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "panorama" } });
  return new Promise<RespostaCrua>((resolve, reject) => {
    const req = httpRequest(
      url,
      {
        method: opcoes.metodo ?? "POST",
        headers: { ...cabecalhos, "Content-Length": Buffer.byteLength(corpo) },
      },
      (res) => {
        let texto = "";
        res.setEncoding("utf8");
        res.on("data", (d: string) => {
          texto += d;
        });
        res.on("end", () => {
          const h: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers))
            h[k] = Array.isArray(v) ? v.join(", ") : (v ?? "");
          resolve({ status: res.statusCode ?? 0, cabecalhos: h, corpo: texto });
        });
      },
    );
    req.on("error", reject);
    req.end(corpo);
  });
}
