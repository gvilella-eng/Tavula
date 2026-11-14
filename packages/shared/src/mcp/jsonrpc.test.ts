import { describe, expect, it } from "vitest";
import { CompendioLocal } from "./compendio.ts";
import {
  ERRO_DE_METODO,
  ERRO_DE_PARAMETROS,
  ERRO_DE_REQUISICAO,
  type RespostaJsonRpc,
  tratarCorpoMcp,
  VERSOES_DO_PROTOCOLO_MCP,
} from "./jsonrpc.ts";
import type { Conexao } from "./servidor.ts";
import { SalaSimulada } from "./testes/salaSimulada.ts";

function ctx(usuarioId: string) {
  const sala = new SalaSimulada(usuarioId);
  const conexao: Conexao = {
    estado: () => sala.estado(),
    eu: () => sala.eu(),
    lotes: () => sala.lotes(),
    enviar: (tipo, dados, lote) => sala.enviar(tipo, dados, lote),
    esperarPronto: async () => undefined,
    estadoOuNulo: () => sala.estado(),
  };
  return { sala, c: { conexao, compendio: CompendioLocal.doExemplo() } };
}

async function uma(corpo: unknown, usuarioId = "m"): Promise<RespostaJsonRpc> {
  const { c } = ctx(usuarioId);
  const r = await tratarCorpoMcp(corpo, c);
  expect(r.status).toBe(200);
  expect(Array.isArray(r.corpo)).toBe(false);
  return r.corpo as RespostaJsonRpc;
}

const req = (method: string, params?: object, id: number | string = 1) => ({
  jsonrpc: "2.0",
  id,
  method,
  ...(params ? { params } : {}),
});

type ResultadoDeFerramenta = { result: { content: { text: string }[]; isError?: boolean } };

describe("o JSON-RPC do MCP por HTTP", () => {
  it("initialize responde a versão pedida (se a conhece) e senão a mais nova, com as instruções", async () => {
    const r = (await uma(
      req("initialize", { protocolVersion: "2025-06-18", capabilities: {} }),
    )) as {
      result: { protocolVersion: string; serverInfo: { name: string }; instructions: string };
    };
    expect(r.result.protocolVersion).toBe("2025-06-18");
    expect(r.result.serverInfo.name).toBe("tavola");
    expect(r.result.instructions).toContain("panorama");

    const nova = (await uma(req("initialize", { protocolVersion: "1999-01-01" }))) as {
      result: { protocolVersion: string };
    };
    expect(nova.result.protocolVersion).toBe(VERSOES_DO_PROTOCOLO_MCP[0]);
    expect(VERSOES_DO_PROTOCOLO_MCP[0]).toBe("2025-11-25");
  });

  it("notificação não tem resposta (202 sem corpo); ping responde {}", async () => {
    const { c } = ctx("m");
    const n = await tratarCorpoMcp({ jsonrpc: "2.0", method: "notifications/initialized" }, c);
    expect(n).toEqual({ status: 202 });
    const p = await uma(req("ping"));
    expect(p).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
  });

  it("tools/list segue o papel: o mestre vê 11, o jogador 7", async () => {
    const m = (await uma(req("tools/list"), "m")) as { result: { tools: { name: string }[] } };
    expect(m.result.tools).toHaveLength(11);
    const j = (await uma(req("tools/list"), "j1")) as { result: { tools: { name: string }[] } };
    expect(j.result.tools.map((t) => t.name)).toEqual([
      "panorama",
      "ler",
      "fichas",
      "compendio",
      "notas",
      "rolar",
      "desfazer",
    ]);
    const primeira = m.result.tools[0] as unknown as { inputSchema: { type: string } };
    expect(primeira.inputSchema.type).toBe("object");
  });

  it("tools/call roda a ferramenta; entrada inválida e ferramenta de outro papel viram isError com o que fazer", async () => {
    const ok = (await uma(
      req("tools/call", { name: "panorama", arguments: {} }),
    )) as ResultadoDeFerramenta;
    expect(ok.result.isError).toBeUndefined();
    expect(ok.result.content[0]?.text).toContain("Você é Mestre (mestre)");

    const ruim = (await uma(
      req("tools/call", { name: "rolar", arguments: { vezes: "muitas" } }),
    )) as ResultadoDeFerramenta;
    expect(ruim.result.isError).toBe(true);
    expect(ruim.result.content[0]?.text).toMatch(/Entrada inválida/);

    const alheia = (await uma(
      req("tools/call", { name: "cenas", arguments: {} }),
      "j1",
    )) as ResultadoDeFerramenta;
    expect(alheia.result.isError).toBe(true);
    expect(alheia.result.content[0]?.text).toContain("não está liberada");
  });

  it("método desconhecido e parâmetros ruins dão o erro do JSON-RPC", async () => {
    const m = (await uma(req("resources/list"))) as { error: { code: number } };
    expect(m.error.code).toBe(ERRO_DE_METODO);
    const p = (await uma(req("tools/call", { arguments: {} }))) as { error: { code: number } };
    expect(p.error.code).toBe(ERRO_DE_PARAMETROS);
    const a = (await uma(req("tools/call", { name: "panorama", arguments: [1] }))) as {
      error: { code: number };
    };
    expect(a.error.code).toBe(ERRO_DE_PARAMETROS);
    const inv = (await uma({ hello: "mundo" })) as { error: { code: number } };
    expect(inv.error.code).toBe(ERRO_DE_REQUISICAO);
    const texto = (await uma("oi")) as { error: { code: number } };
    expect(texto.error.code).toBe(ERRO_DE_REQUISICAO);
  });

  it("um lote responde a cada pedido (e só a eles); lote vazio é inválido", async () => {
    const { c } = ctx("m");
    const r = await tratarCorpoMcp(
      [
        req("ping", undefined, 1),
        { jsonrpc: "2.0", method: "notifications/initialized" },
        req("ping", undefined, "b"),
      ],
      c,
    );
    expect(r.status).toBe(200);
    expect((r.corpo as RespostaJsonRpc[]).map((x) => x.id)).toEqual([1, "b"]);
    const tudoNotificacao = await tratarCorpoMcp(
      [{ jsonrpc: "2.0", method: "notifications/initialized" }],
      c,
    );
    expect(tudoNotificacao).toEqual({ status: 202 });
    const vazio = await tratarCorpoMcp([], c);
    expect((vazio.corpo as { error: { code: number } }).error.code).toBe(ERRO_DE_REQUISICAO);
  });

  it("a resposta de uma ferramenta nunca leva um token", async () => {
    const token = `tvc_${"A".repeat(43)}`;
    const r = await uma(
      req("tools/call", { name: "notas", arguments: { notas: [{ titulo: token, texto: token }] } }),
    );
    expect(JSON.stringify(r)).not.toContain(token);
  });
});
