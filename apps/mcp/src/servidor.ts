import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  type CompendioLocal,
  type Conexao,
  chamarFerramenta,
  definicaoDaFerramenta,
  ferramentasDaLista,
  INSTRUCOES,
} from "@tabletop/shared/mcp";

export type ServidorMcp = { servidor: Server; avisarMudanca: () => void };

/** O servidor MCP (stdio): lista só as ferramentas do usuário e chama a que a IA pedir (a lógica é a de `@tabletop/shared/mcp`). */
export function criarServidor(conexao: Conexao, compendio: CompendioLocal): ServidorMcp {
  const servidor = new Server(
    { name: "tavola", version: "0.1.0" },
    { capabilities: { tools: { listChanged: true } }, instructions: INSTRUCOES },
  );

  servidor.setRequestHandler(ListToolsRequestSchema, async () => {
    // Dá um tempo para a primeira conexão: assim a lista já sai com as ferramentas certas.
    await conexao.esperarPronto(5000).catch(() => undefined);
    return { tools: ferramentasDaLista(conexao).map(definicaoDaFerramenta) };
  });

  servidor.setRequestHandler(CallToolRequestSchema, async (req) => {
    return chamarFerramenta(req.params.name, req.params.arguments, conexao, compendio);
  });

  // Se o papel ou as permissões mudarem no meio, a lista de ferramentas muda: avisa o cliente.
  let assinatura = "";
  const avisarMudanca = () => {
    const nova = ferramentasDaLista(conexao)
      .map((f) => f.nome)
      .join(",");
    if (assinatura !== "" && nova !== assinatura)
      void servidor.sendToolListChanged().catch(() => undefined);
    assinatura = nova;
  };
  return { servidor, avisarMudanca };
}
