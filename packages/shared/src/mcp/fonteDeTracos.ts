// M2: texto no mapa. A mesa não tem uma forma "texto" nos desenhos (só traço livre, linha, retângulo e círculo), então o
// Claude escreve com uma fonte de traços: cada letra é um ou mais traços livres. Assim o texto aparece na tela de todos sem
// mudar o protocolo, e o Desfazer o apaga como qualquer desenho. Sem acento (as letras acentuadas viram as sem acento).

/** Largura do glifo em unidades; a altura é `ALTURA_DO_GLIFO`. */
const LARGURA = 4;
export const ALTURA_DO_GLIFO = 6;
/** O avanço de cada letra: a largura mais 2 de espaço. */
const AVANCO = LARGURA + 2;
const AVANCO_DO_ESPACO = 4;

type Traco = readonly (readonly [number, number])[];

const O: Traco = [
  [1, 0],
  [3, 0],
  [4, 1],
  [4, 5],
  [3, 6],
  [1, 6],
  [0, 5],
  [0, 1],
  [1, 0],
];
const P: Traco = [
  [0, 6],
  [0, 0],
  [3, 0],
  [4, 1],
  [4, 2],
  [3, 3],
  [0, 3],
];

const GLIFOS: Record<string, readonly Traco[]> = {
  A: [
    [
      [0, 6],
      [2, 0],
      [4, 6],
    ],
    [
      [1, 4],
      [3, 4],
    ],
  ],
  B: [
    P,
    [
      [3, 3],
      [4, 4],
      [4, 5],
      [3, 6],
      [0, 6],
    ],
  ],
  C: [
    [
      [4, 1],
      [3, 0],
      [1, 0],
      [0, 1],
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 6],
      [2, 6],
      [4, 4],
      [4, 2],
      [2, 0],
      [0, 0],
    ],
  ],
  E: [
    [
      [4, 0],
      [0, 0],
      [0, 6],
      [4, 6],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  F: [
    [
      [4, 0],
      [0, 0],
      [0, 6],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  G: [
    [
      [4, 1],
      [3, 0],
      [1, 0],
      [0, 1],
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 3],
      [2, 3],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 6],
    ],
    [
      [4, 0],
      [4, 6],
    ],
    [
      [0, 3],
      [4, 3],
    ],
  ],
  I: [
    [
      [1, 0],
      [3, 0],
    ],
    [
      [2, 0],
      [2, 6],
    ],
    [
      [1, 6],
      [3, 6],
    ],
  ],
  J: [
    [
      [4, 0],
      [4, 5],
      [3, 6],
      [1, 6],
      [0, 5],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 6],
    ],
    [
      [4, 0],
      [0, 3],
      [4, 6],
    ],
  ],
  L: [
    [
      [0, 0],
      [0, 6],
      [4, 6],
    ],
  ],
  M: [
    [
      [0, 6],
      [0, 0],
      [2, 3],
      [4, 0],
      [4, 6],
    ],
  ],
  N: [
    [
      [0, 6],
      [0, 0],
      [4, 6],
      [4, 0],
    ],
  ],
  O: [O],
  P: [P],
  Q: [
    O,
    [
      [2, 4],
      [4, 6],
    ],
  ],
  R: [
    P,
    [
      [2, 3],
      [4, 6],
    ],
  ],
  S: [
    [
      [4, 1],
      [3, 0],
      [1, 0],
      [0, 1],
      [0, 2],
      [1, 3],
      [3, 3],
      [4, 4],
      [4, 5],
      [3, 6],
      [1, 6],
      [0, 5],
    ],
  ],
  T: [
    [
      [0, 0],
      [4, 0],
    ],
    [
      [2, 0],
      [2, 6],
    ],
  ],
  U: [
    [
      [0, 0],
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 0],
    ],
  ],
  V: [
    [
      [0, 0],
      [2, 6],
      [4, 0],
    ],
  ],
  W: [
    [
      [0, 0],
      [1, 6],
      [2, 3],
      [3, 6],
      [4, 0],
    ],
  ],
  X: [
    [
      [0, 0],
      [4, 6],
    ],
    [
      [4, 0],
      [0, 6],
    ],
  ],
  Y: [
    [
      [0, 0],
      [2, 3],
      [4, 0],
    ],
    [
      [2, 3],
      [2, 6],
    ],
  ],
  Z: [
    [
      [0, 0],
      [4, 0],
      [0, 6],
      [4, 6],
    ],
  ],
  "0": [
    O,
    [
      [0, 5],
      [4, 1],
    ],
  ],
  "1": [
    [
      [1, 1],
      [2, 0],
      [2, 6],
    ],
    [
      [1, 6],
      [3, 6],
    ],
  ],
  "2": [
    [
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 2],
      [0, 6],
      [4, 6],
    ],
  ],
  "3": [
    [
      [0, 0],
      [4, 0],
      [2, 3],
      [3, 3],
      [4, 4],
      [4, 5],
      [3, 6],
      [1, 6],
      [0, 5],
    ],
  ],
  "4": [
    [
      [3, 6],
      [3, 0],
      [0, 4],
      [4, 4],
    ],
  ],
  "5": [
    [
      [4, 0],
      [0, 0],
      [0, 3],
      [3, 3],
      [4, 4],
      [4, 5],
      [3, 6],
      [1, 6],
      [0, 5],
    ],
  ],
  "6": [
    [
      [4, 1],
      [3, 0],
      [1, 0],
      [0, 1],
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 4],
      [3, 3],
      [0, 3],
    ],
  ],
  "7": [
    [
      [0, 0],
      [4, 0],
      [1, 6],
    ],
  ],
  "8": [
    O,
    [
      [1, 3],
      [3, 3],
    ],
  ],
  "9": [
    [
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 1],
      [3, 0],
      [1, 0],
      [0, 1],
      [0, 2],
      [1, 3],
      [4, 3],
    ],
  ],
  ".": [[[2, 6]]],
  ",": [
    [
      [2, 5],
      [1, 7],
    ],
  ],
  "!": [
    [
      [2, 0],
      [2, 4],
    ],
    [[2, 6]],
  ],
  "?": [
    [
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 2],
      [2, 3],
      [2, 4],
    ],
    [[2, 6]],
  ],
  ":": [[[2, 1]], [[2, 5]]],
  "-": [
    [
      [1, 3],
      [3, 3],
    ],
  ],
  "'": [
    [
      [2, 0],
      [2, 2],
    ],
  ],
  "/": [
    [
      [4, 0],
      [0, 6],
    ],
  ],
  "(": [
    [
      [3, 0],
      [1, 2],
      [1, 4],
      [3, 6],
    ],
  ],
  ")": [
    [
      [1, 0],
      [3, 2],
      [3, 4],
      [1, 6],
    ],
  ],
};

/** A letra sem acento e em maiúscula; o que não tem glifo vira `null` (e a ferramenta avisa). */
export function glifoDe(c: string): string | null {
  const base = c.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
  return base in GLIFOS ? base : null;
}

export type TracoDoTexto = { pontos: { x: number; y: number }[] };

/**
 * Os traços do texto, em metros. `x`, `y`: o canto de cima à esquerda; `alturaM`: a altura da letra. Devolve também o que
 * foi trocado ou ignorado (letra sem glifo vira nada) e a largura total.
 */
export function tracosDoTexto(
  texto: string,
  x: number,
  y: number,
  alturaM: number,
): { tracos: TracoDoTexto[]; ignorados: string[]; larguraM: number } {
  const u = alturaM / ALTURA_DO_GLIFO;
  const arred = (n: number) => Math.round(n * 1000) / 1000;
  const tracos: TracoDoTexto[] = [];
  const ignorados: string[] = [];
  let cursor = 0;
  for (const c of texto) {
    if (c === " ") {
      cursor += AVANCO_DO_ESPACO;
      continue;
    }
    const chave = glifoDe(c);
    if (chave === null) {
      if (!ignorados.includes(c)) ignorados.push(c);
      continue;
    }
    for (const t of GLIFOS[chave] ?? []) {
      tracos.push({
        pontos: t.map(([gx, gy]) => ({ x: arred(x + (cursor + gx) * u), y: arred(y + gy * u) })),
      });
    }
    cursor += AVANCO;
  }
  return { tracos, ignorados, larguraM: arred(Math.max(0, cursor - 2) * u) };
}
