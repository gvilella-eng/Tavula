/**
 * Números decimais na tela, em português do Brasil: a vírgula é o separador que se mostra ("0,5"), e na digitação
 * vale a vírgula ou o ponto ("0,5" e "0.5" são o mesmo número). Só a exibição muda: o que vai para a sala é sempre o
 * número.
 */

/** O número para o campo: vírgula, sem zeros à toa, até `casas` casas (padrão 2): 0.5 vira "0,5"; 3 vira "3". */
export function formatarDecimal(n: number, casas = 2): string {
  const f = 10 ** casas;
  return String(Math.round(n * f) / f).replace(".", ",");
}

/**
 * O que a pessoa digitou: `null` com o campo vazio, `"invalido"` se não é um número, senão o número. Aceita vírgula
 * ou ponto como separador decimal ("1,5" ou "1.5"); espaços nas pontas não contam.
 */
export function lerDecimal(texto: string): number | null | "invalido" {
  const limpo = texto.trim().replace(",", ".");
  if (limpo === "") return null;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(limpo)) return "invalido";
  const n = Number(limpo);
  return Number.isFinite(n) ? n : "invalido";
}
