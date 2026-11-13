// V14: o resumo de um arquivo de campanha exportado, lido no navegador antes de importar. Só conta; quem valida
// o arquivo de verdade é a sala (`lerExportacao`), e é ela que recusa o que estiver errado.

export type ResumoDaCampanha = { cenas: number; fichas: number; tokens: number };

function contar(dados: Record<string, unknown>, campo: string): number | null {
  const v = dados[campo];
  return Array.isArray(v) ? v.length : null;
}

/** Cenas, fichas e tokens do arquivo, ou `null` se ele não tem cara de campanha exportada. */
export function resumoDaCampanha(arquivo: unknown): ResumoDaCampanha | null {
  if (typeof arquivo !== "object" || arquivo === null) return null;
  const dados = (arquivo as Record<string, unknown>).dados;
  if (typeof dados !== "object" || dados === null) return null;
  const d = dados as Record<string, unknown>;
  const cenas = contar(d, "cenas");
  const tokens = contar(d, "tokens");
  if (cenas === null || tokens === null) return null;
  return { cenas, fichas: contar(d, "personagens") ?? 0, tokens };
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function textoDoResumo(r: ResumoDaCampanha): string {
  return [
    plural(r.cenas, "cena", "cenas"),
    plural(r.fichas, "ficha", "fichas"),
    plural(r.tokens, "token", "tokens"),
  ].join(" · ");
}
