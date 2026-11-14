import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { ARQUIVOS_DO_COMPENDIO, lerVariosCompendios } from "@tabletop/shared";
import { CompendioLocal } from "@tabletop/shared/mcp";

/**
 * O compêndio do MCP em stdio: os arquivos da pasta `compendio/` do usuário (`magias.json`, `monstros.json`,
 * `itens.json` e `compendio.json`; os mesmos que o mestre põe na mesa), lidos do computador e juntos. `caminho` pode
 * ser um arquivo ou uma pasta. Nada vem da internet. Sem arquivo, vale o exemplo do SRD que vai dentro do programa.
 */
export function carregarCompendio(
  caminho: string | null,
  pastaAtual: string = process.cwd(),
): CompendioLocal {
  const alvo = caminho ?? resolve(pastaAtual, "compendio");
  if (!existsSync(alvo)) {
    if (caminho) {
      console.error(`[tavola-mcp] Compêndio não encontrado em ${alvo}: usando o exemplo do SRD.`);
    }
    return CompendioLocal.doExemplo();
  }
  const arquivos = statSync(alvo).isDirectory()
    ? ARQUIVOS_DO_COMPENDIO.map((n) => join(alvo, n)).filter((c) => existsSync(c))
    : [alvo];
  if (arquivos.length === 0) return CompendioLocal.doExemplo();
  const lido = lerVariosCompendios(
    arquivos.map((c) => ({ nome: basename(c), texto: readFileSync(c, "utf8") })),
  );
  if (lido.ok) {
    for (const aviso of lido.avisos) console.error(`[tavola-mcp] Compêndio: ${aviso}`);
    return new CompendioLocal(lido.compendio, alvo);
  }
  console.error(
    `[tavola-mcp] Compêndio ${alvo} inválido (${lido.motivo}): usando o exemplo do SRD.`,
  );
  return CompendioLocal.doExemplo();
}
