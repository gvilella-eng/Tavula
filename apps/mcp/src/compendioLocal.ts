import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lerCompendio } from "@tabletop/shared";
import { CompendioLocal } from "@tabletop/shared/mcp";

/**
 * O compêndio do MCP em stdio: o `magias.json` do usuário (o mesmo arquivo que o mestre põe na mesa), lido do computador.
 * Nada vem da internet. Sem arquivo, vale o exemplo do SRD que vai dentro do programa.
 */
export function carregarCompendio(
  caminho: string | null,
  pastaAtual: string = process.cwd(),
): CompendioLocal {
  const candidatos = caminho ? [caminho] : [resolve(pastaAtual, "compendio", "magias.json")];
  for (const c of candidatos) {
    if (!existsSync(c)) {
      if (caminho) {
        console.error(`[tavola-mcp] Compêndio não encontrado em ${c}: usando o exemplo do SRD.`);
      }
      continue;
    }
    const lido = lerCompendio(readFileSync(c, "utf8"));
    if (lido.ok) return new CompendioLocal(lido.compendio, c);
    console.error(
      `[tavola-mcp] Compêndio ${c} inválido (${lido.motivo}): usando o exemplo do SRD.`,
    );
  }
  return CompendioLocal.doExemplo();
}
