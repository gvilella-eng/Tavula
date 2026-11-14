// O MCP do Távola sem transporte: as 11 ferramentas, o compêndio de exemplo, o tratamento JSON-RPC (HTTP) e os tipos da
// conexão. Usado pelo `apps/mcp` (stdio) e pela sala (rota HTTP `mcp`). Entrada própria (`@tabletop/shared/mcp`): o
// navegador nunca a carrega.
export { CompendioLocal } from "./compendio.ts";
export { ErroDoMcp, TOKEN_INVALIDO } from "./erros.ts";
export { textoDoEnvio } from "./ferramentas/arquivos.ts";
export { FERRAMENTAS_SEM_CONEXAO, TODAS_AS_FERRAMENTAS } from "./ferramentas/index.ts";
export {
  type ContextoMcp,
  respostaDeJsonInvalido,
  tratarCorpoMcp,
  VERSAO_DO_SERVIDOR_MCP,
  VERSOES_DO_PROTOCOLO_MCP,
} from "./jsonrpc.ts";
export {
  type Conexao,
  chamarFerramenta,
  definicaoDaFerramenta,
  ferramentasDaLista,
  INSTRUCOES,
  novoLote,
  redigir,
} from "./servidor.ts";
export type {
  ArquivosDaSala,
  Lote,
  LoteDoClaude,
  PedidoDeEnvio,
  RespostaDaSala,
  SalaLike,
} from "./tipos.ts";
