import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";

// A pasta `privado/` na raiz do repositório guarda o que é só do computador do mestre (as fichas dos jogadores e a
// campanha de referência) e nunca entra no git. O teste que depende dela pula quando ela não está.

const PASTA_PRIVADA = new URL("../privado/", import.meta.url);

/** O caminho, no disco, de um arquivo dentro de `privado/` (por exemplo `fixtures/fichas/darion.pdf`). */
export function arquivoPrivado(caminho: string): string {
  return fileURLToPath(new URL(caminho, PASTA_PRIVADA));
}

/** Se o arquivo de `privado/` está neste computador. */
export function temPrivado(caminho: string): boolean {
  return existsSync(arquivoPrivado(caminho));
}

/** Dentro de um teste (ou de um `beforeEach`): pula o teste se faltar algum destes arquivos de `privado/`. */
export function exigirPrivado(...caminhos: string[]): void {
  const faltam = caminhos.filter((c) => !temPrivado(c));
  test.skip(
    faltam.length > 0,
    `precisa de privado/${faltam.join(", privado/")} (fica só no computador do mestre)`,
  );
}
