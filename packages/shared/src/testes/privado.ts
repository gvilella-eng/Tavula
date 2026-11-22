import { existsSync, readFileSync } from "node:fs";

// A pasta `privado/` na raiz do repositório guarda o que é só do computador do mestre (as fichas dos jogadores e a
// campanha de referência) e nunca entra no git. Os testes que dependem dela pulam quando ela não está.

const PASTA_PRIVADA = new URL("../../../../privado/", import.meta.url);

/** O endereço de um arquivo dentro de `privado/` (por exemplo `fixtures/fichas/darion.json`). */
export function arquivoPrivado(caminho: string): URL {
  return new URL(caminho, PASTA_PRIVADA);
}

/** Se o arquivo de `privado/` está neste computador. */
export function temPrivado(caminho: string): boolean {
  return existsSync(arquivoPrivado(caminho));
}

/** O JSON de `privado/`, ou `undefined` quando o arquivo não está neste computador. */
export function lerJsonPrivado<T = unknown>(caminho: string): T | undefined {
  if (!temPrivado(caminho)) return undefined;
  return JSON.parse(readFileSync(arquivoPrivado(caminho), "utf8")) as T;
}
