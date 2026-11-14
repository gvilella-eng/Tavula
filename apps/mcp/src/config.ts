import { FORMATO_DO_TOKEN_DO_CLAUDE } from "@tabletop/shared";
import { ErroDoMcp } from "@tabletop/shared/mcp";

export type Config = {
  /** `ws://host/api/m/<id>/ws` (ou `wss://`): o mesmo endereço que o navegador usa. */
  urlWs: string;
  /** O mesmo endereço em `http(s)`, para descobrir por que uma conexão foi recusada. */
  urlHttp: string;
  mesaId: string;
  /** Nunca vai para log nem para resposta. */
  token: string;
  /** Caminho do `magias.json` do compêndio; sem ele, o MCP procura `compendio/magias.json` na pasta atual. */
  compendio: string | null;
  /** Quanto esperar a resposta de um pedido antes de contar "sem mudança" (ms). */
  esperaMs: number;
};

export const URL_PADRAO = "http://127.0.0.1:8787";

type Ambiente = Record<string, string | undefined>;

/**
 * Lê a configuração das variáveis de ambiente: `TAVOLA_URL` (a origem da página da mesa, ou o endereço completo do
 * WebSocket), `TAVOLA_MESA` (o id da mesa, se a URL não o traz) e `TAVOLA_TOKEN`. Erro: texto que diz o que ajustar.
 */
export function lerConfig(env: Ambiente): Config {
  const token = (env.TAVOLA_TOKEN ?? "").trim();
  if (token === "") {
    throw new ErroDoMcp(
      "Falta o TAVOLA_TOKEN: gere um em Preferências → Conectar o Claude e ponha na variável.",
    );
  }
  if (!FORMATO_DO_TOKEN_DO_CLAUDE.test(token)) {
    throw new ErroDoMcp(
      "O TAVOLA_TOKEN não tem o formato de um token do Távola (começa com tvc_). Gere outro em Preferências → Conectar o Claude.",
    );
  }
  let url: URL;
  try {
    url = new URL((env.TAVOLA_URL ?? URL_PADRAO).trim() || URL_PADRAO);
  } catch {
    throw new ErroDoMcp(
      `O TAVOLA_URL "${env.TAVOLA_URL}" não é um endereço. Exemplo: ${URL_PADRAO}`,
    );
  }
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) {
    throw new ErroDoMcp("O TAVOLA_URL precisa começar com http://, https://, ws:// ou wss://.");
  }
  const seguro = url.protocol === "https:" || url.protocol === "wss:";
  const doCaminho = /\/(?:api\/)?m\/([^/?#]+)/.exec(url.pathname)?.[1];
  const mesaId = (env.TAVOLA_MESA ?? "").trim() || doCaminho || "";
  if (mesaId === "") {
    throw new ErroDoMcp(
      "Falta o TAVOLA_MESA (o id da mesa: a parte depois de /m/ no endereço da página).",
    );
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(mesaId)) {
    throw new ErroDoMcp(`O id da mesa "${mesaId}" não é válido (letras, números, - e _).`);
  }
  const caminho = `/api/m/${mesaId}/ws`;
  const espera = Number(env.TAVOLA_ESPERA_MS);
  return {
    urlWs: `${seguro ? "wss" : "ws"}://${url.host}${caminho}`,
    urlHttp: `${seguro ? "https" : "http"}://${url.host}${caminho}`,
    mesaId,
    token,
    compendio: (env.TAVOLA_COMPENDIO ?? "").trim() || null,
    esperaMs: Number.isFinite(espera) && espera >= 200 ? espera : 2500,
  };
}
