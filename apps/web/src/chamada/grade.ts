// CH2: o cálculo da grade da chamada. Função pura: dado o espaço e o número de quadros, escolhe colunas e linhas para o
// quadro 16:9 ficar o maior possível, sem passar do espaço (a grade nunca rola).

/** O máximo de quadros numa página da grade. */
export const QUADROS_POR_PAGINA = 9;

const PROPORCAO = 16 / 9;

export type DisposicaoDaGrade = {
  colunas: number;
  linhas: number;
  /** Largura e altura de cada quadro, em px inteiros (a altura é a largura ÷ 16:9). */
  largura: number;
  altura: number;
};

/**
 * Escolhe a disposição que deixa os quadros maiores. `largura` e `altura` são o espaço livre (sem o respiro das
 * bordas); `gap` é o vão entre quadros. Com `n` < 1 vale 1; o espaço nunca é negativo.
 */
export function calcularGrade(
  n: number,
  largura: number,
  altura: number,
  gap: number,
): DisposicaoDaGrade {
  const total = Math.max(1, Math.floor(n));
  const larguraLivre = Math.max(0, largura);
  const alturaLivre = Math.max(0, altura);
  let melhor: DisposicaoDaGrade = { colunas: 1, linhas: total, largura: 0, altura: 0 };
  for (let colunas = 1; colunas <= total; colunas++) {
    const linhas = Math.ceil(total / colunas);
    const porLargura = (larguraLivre - (colunas - 1) * gap) / colunas;
    const porAltura = ((alturaLivre - (linhas - 1) * gap) / linhas) * PROPORCAO;
    const w = Math.max(0, Math.floor(Math.min(porLargura, porAltura)));
    // Só troca quando fica maior: em empate, vale a disposição com menos colunas.
    if (w > melhor.largura) {
      melhor = { colunas, linhas, largura: w, altura: Math.floor(w / PROPORCAO) };
    }
  }
  return melhor;
}

/** Quantas páginas de até `porPagina` quadros (sempre pelo menos uma). */
export const totalDePaginas = (total: number, porPagina = QUADROS_POR_PAGINA): number =>
  Math.max(1, Math.ceil(total / porPagina));

/** Os itens da página `pagina` (começa em 0; fora do intervalo vira a primeira ou a última). */
export function itensDaPagina<T>(
  itens: readonly T[],
  pagina: number,
  porPagina = QUADROS_POR_PAGINA,
): T[] {
  const p = Math.min(Math.max(0, pagina), totalDePaginas(itens.length, porPagina) - 1);
  return itens.slice(p * porPagina, (p + 1) * porPagina);
}
