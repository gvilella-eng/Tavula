// ---------------------------------------------------------------------------------------------
// Extrator do compêndio (N3b): do texto com posição do PDF para linhas na ordem de leitura.
//
// O PDF é de duas colunas. Aqui os itens de `getTextContent()` viram linhas (uma por coluna e por altura), na ordem
// esquerda -> direita de cada página. Tudo puro: o Node lê o PDF (`pdf.ts`), o resto roda nos testes com trechos
// inventados. O conteúdo dos livros nunca entra no repositório.
// ---------------------------------------------------------------------------------------------

/** Um pedaço de texto do PDF, com a posição e a fonte (como `getTextContent()` o entrega, já enxuto). */
export type ItemDoPdf = {
  s: string;
  x: number;
  y: number;
  /** Tamanho da fonte. */
  fs: number;
  /** Nome interno da fonte (o mesmo texto em negrito, itálico etc. tem nomes diferentes). */
  f: string;
};

export type PaginaDoPdf = { w: number; h: number; items: ItemDoPdf[] };

export type Trecho = { t: string; f: string; fs: number; x: number };

export type Linha = {
  /** Número da página, a partir de 1. */
  pagina: number;
  /** 0 = coluna da esquerda, 1 = a da direita. */
  col: number;
  y: number;
  /** Onde o texto da linha começa. */
  x: number;
  /** O maior tamanho de fonte da linha. */
  tam: number;
  trechos: Trecho[];
  /** O texto da linha, com os versaletes já convertidos (maiúscula só na inicial grande). */
  texto: string;
};

const TOLERANCIA_DE_Y = 1.6;
/** A rodapé do número da página e o cabeçalho ficam fora do corpo. */
const MARGEM_INFERIOR = 40;

/**
 * Converte um trecho em versalete: no livro, "Bola de Fogo" vem como "B" (grande) + "OLA" (pequeno). As letras de
 * um trecho menor que o maior da linha viram minúsculas.
 */
function textoDoTrecho(t: Trecho, maior: number): string {
  if (t.fs < maior - 0.9) return t.t.toLowerCase();
  return t.t;
}

/** Junta os trechos de uma linha, resolvendo versaletes. Só mexe na caixa se a linha misturar tamanhos. */
function textoDaLinha(trechos: readonly Trecho[], versalete: boolean): string {
  const maior = Math.max(...trechos.map((t) => t.fs));
  const letras = trechos.filter((t) => /\p{L}/u.test(t.t));
  const mistura = letras.some((t) => t.fs < maior - 0.9);
  const eCaixaAlta = letras.every((t) => t.t === t.t.toUpperCase());
  const converter = versalete && mistura && eCaixaAlta;
  return (
    trechos
      .map((t) => (converter ? textoDoTrecho(t, maior) : t.t))
      .join("")
      // O marcador de lista do livro é um caractere de uso privado da fonte (U+F0B7): vira "•".
      .replace(/[-]/g, "•")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * As linhas de uma página, na ordem de leitura (coluna esquerda de cima para baixo, depois a direita). Itens vazios
 * (marcadores do pdf.js) e o rodapé saem.
 */
export function linhasDaPagina(
  numero: number,
  pagina: PaginaDoPdf,
  /** Onde uma coluna acaba e a outra começa (padrão: o meio da página, duas colunas). */
  cortes: readonly number[] = [pagina.w / 2],
): Linha[] {
  const colunas: ItemDoPdf[][] = Array.from({ length: cortes.length + 1 }, () => []);
  for (const it of pagina.items) {
    if (it.s === "" || it.y < MARGEM_INFERIOR) continue;
    colunas[cortes.filter((c) => it.x >= c).length]?.push(it);
  }
  const saida: Linha[] = [];
  colunas.forEach((itens, col) => {
    const ordenados = [...itens].sort((a, b) => b.y - a.y || a.x - b.x);
    let atual: ItemDoPdf[] = [];
    const fechar = () => {
      if (atual.length === 0) return;
      const ordem = [...atual].sort((a, b) => a.x - b.x);
      const trechos = ordem.map((i) => ({ t: i.s, f: i.f, fs: i.fs, x: i.x }));
      const texto = textoDaLinha(trechos, true);
      if (texto !== "") {
        saida.push({
          pagina: numero,
          col,
          y: atual[0]?.y ?? 0,
          x: Math.min(...ordem.map((i) => i.x)),
          tam: Math.max(...trechos.map((t) => t.fs)),
          trechos,
          texto,
        });
      }
      atual = [];
    };
    for (const it of ordenados) {
      const ultimo = atual[0];
      if (ultimo && Math.abs(ultimo.y - it.y) > TOLERANCIA_DE_Y) fechar();
      atual.push(it);
    }
    fechar();
  });
  return saida;
}

/** Todas as linhas de um intervalo de páginas (de 1 a `paginas.length`). */
export function linhasDoLivro(paginas: readonly PaginaDoPdf[]): Linha[] {
  return paginas.flatMap((p, i) => linhasDaPagina(i + 1, p));
}

/** Tira acentos e põe em minúsculas, para comparar rótulos. */
export function semAcentos(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
