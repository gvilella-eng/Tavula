import type { CompendioLocal } from "./compendio.ts";
import {
  type Conexao,
  chamarFerramenta,
  definicaoDaFerramenta,
  ferramentasDaLista,
  INSTRUCOES,
} from "./servidor.ts";

// O MCP "Streamable HTTP" sem estado, no mínimo que o Claude Code usa: cada POST traz uma mensagem JSON-RPC 2.0 (ou um lote)
// e recebe a resposta em JSON. Sem sessão, sem SSE, sem notificações do servidor. É puro: a sala só entrega o corpo e a
// conexão (o estado do usuário do token) e devolve o que sair daqui. (12-3)

/** As versões do protocolo que o servidor aceita; a primeira é a mais nova (a mesma lista do SDK 1.32). */
export const VERSOES_DO_PROTOCOLO_MCP: readonly string[] = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
];
export const VERSAO_DO_SERVIDOR_MCP = "0.1.0";

export const ERRO_DE_JSON = -32700;
export const ERRO_DE_REQUISICAO = -32600;
export const ERRO_DE_METODO = -32601;
export const ERRO_DE_PARAMETROS = -32602;
export const ERRO_INTERNO = -32603;

type Id = string | number | null;

export type RespostaJsonRpc =
  | { jsonrpc: "2.0"; id: Id; result: unknown }
  | { jsonrpc: "2.0"; id: Id; error: { code: number; message: string } };

/** O que a rota devolve: o status, e o corpo JSON (sem corpo: 202, para notificações). */
export type SaidaMcp = { status: 200 | 202; corpo?: RespostaJsonRpc | RespostaJsonRpc[] };

export type ContextoMcp = { conexao: Conexao; compendio: CompendioLocal };

function erro(id: Id, code: number, message: string): RespostaJsonRpc {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function idValido(v: unknown): v is string | number {
  return typeof v === "string" || (typeof v === "number" && Number.isFinite(v));
}

/** Uma mensagem só. `null` = não há resposta (notificação, ou resposta do cliente a um pedido nosso). */
async function tratarUma(m: unknown, ctx: ContextoMcp): Promise<RespostaJsonRpc | null> {
  if (!ehObjeto(m) || m.jsonrpc !== "2.0") {
    return erro(null, ERRO_DE_REQUISICAO, "Mensagem JSON-RPC inválida.");
  }
  // Resposta do cliente (sem `method`): o servidor não faz pedidos, então não há o que fazer com ela.
  if (typeof m.method !== "string") {
    return "result" in m || "error" in m
      ? null
      : erro(null, ERRO_DE_REQUISICAO, "Mensagem JSON-RPC inválida.");
  }
  const temId = "id" in m && m.id !== undefined;
  if (temId && !idValido(m.id)) return erro(null, ERRO_DE_REQUISICAO, "Id inválido.");
  const id: Id = temId ? (m.id as string | number) : null;
  const metodo = m.method;
  const params = m.params;

  // Notificação: nunca responde (mesmo as que não conhecemos).
  if (!temId) return null;

  if (params !== undefined && !ehObjeto(params)) {
    return erro(id, ERRO_DE_PARAMETROS, "Os parâmetros precisam ser um objeto.");
  }

  switch (metodo) {
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "initialize": {
      const pedida = params?.protocolVersion;
      const versao =
        typeof pedida === "string" && VERSOES_DO_PROTOCOLO_MCP.includes(pedida)
          ? pedida
          : (VERSOES_DO_PROTOCOLO_MCP[0] as string);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: versao,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "tavola", version: VERSAO_DO_SERVIDOR_MCP },
          instructions: INSTRUCOES,
        },
      };
    }
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: ferramentasDaLista(ctx.conexao).map(definicaoDaFerramenta) },
      };
    case "tools/call": {
      const nome = params?.name;
      const argumentos = params?.arguments;
      if (typeof nome !== "string" || nome === "") {
        return erro(id, ERRO_DE_PARAMETROS, "Falta o nome da ferramenta (name).");
      }
      if (argumentos !== undefined && !ehObjeto(argumentos)) {
        return erro(id, ERRO_DE_PARAMETROS, "Os argumentos (arguments) precisam ser um objeto.");
      }
      try {
        const r = await chamarFerramenta(nome, argumentos, ctx.conexao, ctx.compendio);
        return { jsonrpc: "2.0", id, result: r };
      } catch {
        // `chamarFerramenta` já trata os erros da ferramenta; isto é só para um bug nunca virar um 500 mudo.
        return erro(id, ERRO_INTERNO, "Erro interno ao rodar a ferramenta.");
      }
    }
    default:
      return erro(id, ERRO_DE_METODO, `Método desconhecido: ${metodo}.`);
  }
}

/** Trata o corpo de um POST (já lido como JSON): uma mensagem ou um lote. */
export async function tratarCorpoMcp(corpo: unknown, ctx: ContextoMcp): Promise<SaidaMcp> {
  if (Array.isArray(corpo)) {
    if (corpo.length === 0) {
      return { status: 200, corpo: erro(null, ERRO_DE_REQUISICAO, "Lote vazio.") };
    }
    const respostas: RespostaJsonRpc[] = [];
    for (const m of corpo) {
      const r = await tratarUma(m, ctx);
      if (r) respostas.push(r);
    }
    return respostas.length > 0 ? { status: 200, corpo: respostas } : { status: 202 };
  }
  const r = await tratarUma(corpo, ctx);
  return r ? { status: 200, corpo: r } : { status: 202 };
}

export function respostaDeJsonInvalido(): RespostaJsonRpc {
  return erro(null, ERRO_DE_JSON, "O corpo não é um JSON válido.");
}
