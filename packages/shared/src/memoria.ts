import type { ConfigIluminacao, Ponto } from "./estado.ts";

/** Lado de uma célula da memória do mapa, em metros. */
export const CELULA_DA_MEMORIA_M = 0.5;

/**
 * Memória do mapa de um jogador numa cena: uma grade de células (`celulaM`) com 1 onde ele já viu e 0
 * onde não. Só de tela: vive no navegador (IndexedDB), nunca vai para a sala.
 */
export type GradeDeMemoria = {
  colunas: number;
  linhas: number;
  celulaM: number;
  dados: Uint8Array;
};

/** Uma fonte de memória: o token do jogador e até onde ele se lembra (m). */
export type FonteDeMemoria = { x: number; y: number; alcanceM: number };

export function criarGrade(
  larguraM: number,
  alturaM: number,
  celulaM = CELULA_DA_MEMORIA_M,
): GradeDeMemoria {
  const colunas = Math.max(1, Math.ceil(larguraM / celulaM));
  const linhas = Math.max(1, Math.ceil(alturaM / celulaM));
  return { colunas, linhas, celulaM, dados: new Uint8Array(colunas * linhas) };
}

/** A grade serve para uma cena deste tamanho (a cena pode ter mudado de tamanho)? */
export function gradeServe(
  grade: GradeDeMemoria,
  larguraM: number,
  alturaM: number,
  celulaM = CELULA_DA_MEMORIA_M,
): boolean {
  return (
    grade.celulaM === celulaM &&
    grade.colunas === Math.max(1, Math.ceil(larguraM / celulaM)) &&
    grade.linhas === Math.max(1, Math.ceil(alturaM / celulaM)) &&
    grade.dados.length === grade.colunas * grade.linhas
  );
}

/** Centro da célula (coluna, linha), em metros. */
export function centroDaCelula(grade: GradeDeMemoria, coluna: number, linha: number): Ponto {
  return { x: (coluna + 0.5) * grade.celulaM, y: (linha + 0.5) * grade.celulaM };
}

/** Índice da célula que contém o ponto, ou -1 se ele está fora da grade. */
export function indiceDaCelula(grade: GradeDeMemoria, p: Ponto): number {
  const c = Math.floor(p.x / grade.celulaM);
  const l = Math.floor(p.y / grade.celulaM);
  if (c < 0 || l < 0 || c >= grade.colunas || l >= grade.linhas) return -1;
  return l * grade.colunas + c;
}

/** O ponto está numa célula lembrada? */
export function lembraDoPonto(grade: GradeDeMemoria, p: Ponto): boolean {
  const i = indiceDaCelula(grade, p);
  return i >= 0 && grade.dados[i] === 1;
}

export function contarLembradas(grade: GradeDeMemoria): number {
  let n = 0;
  for (const v of grade.dados) n += v;
  return n;
}

/**
 * Alcance da memória, em metros: a base mais `porModM` por ponto de Inteligência (15 m + 3 m × mod no
 * padrão; −2 dá 9 m, +2 dá 21 m), nunca abaixo de 0; no modo fixo vale sempre o valor fixo. Memória
 * desligada: 0.
 */
export function alcanceDaMemoria(
  config: Pick<
    ConfigIluminacao,
    "memoriaLigada" | "memoriaModo" | "memoriaBaseM" | "memoriaPorModM" | "memoriaFixaM"
  >,
  modInteligencia: number,
): number {
  if (!config.memoriaLigada) return 0;
  const m =
    config.memoriaModo === "fixo"
      ? config.memoriaFixaM
      : config.memoriaBaseM + config.memoriaPorModM * modInteligencia;
  return Math.max(0, m);
}

/**
 * Quanto da lembrança ainda aparece (0 a 1) a `distanciaM` do token: plena colada nele, cai em linha
 * reta e some no alcance. Sem alcance, nada.
 */
export function opacidadeDaMemoria(distanciaM: number, alcanceM: number): number {
  if (alcanceM <= 0 || distanciaM >= alcanceM) return 0;
  return 1 - Math.max(0, distanciaM) / alcanceM;
}

/**
 * Marca como lembradas as células cujo centro `visto` aceita, só dentro da caixa dada (a da visão
 * atual; `null` = a grade toda). Devolve quantas ficaram novas.
 */
export function marcarVisto(
  grade: GradeDeMemoria,
  caixa: { x0: number; y0: number; x1: number; y1: number } | null,
  visto: (centro: Ponto) => boolean,
): number {
  const c0 = caixa ? Math.max(0, Math.floor(caixa.x0 / grade.celulaM)) : 0;
  const c1 = caixa
    ? Math.min(grade.colunas - 1, Math.floor(caixa.x1 / grade.celulaM))
    : grade.colunas - 1;
  const l0 = caixa ? Math.max(0, Math.floor(caixa.y0 / grade.celulaM)) : 0;
  const l1 = caixa
    ? Math.min(grade.linhas - 1, Math.floor(caixa.y1 / grade.celulaM))
    : grade.linhas - 1;
  let novas = 0;
  for (let l = l0; l <= l1; l++) {
    for (let c = c0; c <= c1; c++) {
      const i = l * grade.colunas + c;
      if (grade.dados[i] === 1) continue;
      if (visto(centroDaCelula(grade, c, l))) {
        grade.dados[i] = 1;
        novas++;
      }
    }
  }
  return novas;
}

/**
 * Esquece o que passou do alcance: a célula lembrada que está além do alcance de TODAS as fontes some
 * da memória. Sem nenhuma fonte (jogador sem token na cena) nada é esquecido. Devolve quantas sumiram.
 */
export function esquecerAlemDoAlcance(
  grade: GradeDeMemoria,
  fontes: readonly FonteDeMemoria[],
): number {
  if (fontes.length === 0) return 0;
  let esquecidas = 0;
  for (let l = 0; l < grade.linhas; l++) {
    for (let c = 0; c < grade.colunas; c++) {
      const i = l * grade.colunas + c;
      if (grade.dados[i] !== 1) continue;
      const centro = centroDaCelula(grade, c, l);
      const alcanca = fontes.some(
        (f) => Math.hypot(centro.x - f.x, centro.y - f.y) <= f.alcanceM && f.alcanceM > 0,
      );
      if (!alcanca) {
        grade.dados[i] = 0;
        esquecidas++;
      }
    }
  }
  return esquecidas;
}

/** Esquece tudo (o botão do mestre). */
export function esquecerTudo(grade: GradeDeMemoria): void {
  grade.dados.fill(0);
}

/** `#rrggbb` em canais 0 a 255. */
export function corEmCanais(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * A imagem da memória (RGBA, uma célula por pixel) que a tela multiplica sobre a camada do mapa: a
 * célula lembrada vale o tom da memória vezes a opacidade (que cai com a distância até o token mais
 * próximo, pelo alcance dele); a que não é lembrada vale preto.
 */
export function imagemDaMemoria(
  grade: GradeDeMemoria,
  fontes: readonly FonteDeMemoria[],
  tom: { r: number; g: number; b: number },
): Uint8ClampedArray {
  const saida = new Uint8ClampedArray(grade.colunas * grade.linhas * 4);
  for (let l = 0; l < grade.linhas; l++) {
    for (let c = 0; c < grade.colunas; c++) {
      const i = l * grade.colunas + c;
      const o = i * 4;
      saida[o + 3] = 255;
      if (grade.dados[i] !== 1) continue;
      const centro = centroDaCelula(grade, c, l);
      let opacidade = 0;
      for (const f of fontes) {
        opacidade = Math.max(
          opacidade,
          opacidadeDaMemoria(Math.hypot(centro.x - f.x, centro.y - f.y), f.alcanceM),
        );
      }
      saida[o] = tom.r * opacidade;
      saida[o + 1] = tom.g * opacidade;
      saida[o + 2] = tom.b * opacidade;
    }
  }
  return saida;
}

/** Opacidade da lembrança no ponto (a do token mais próximo, pelo alcance de cada um). */
export function opacidadeNoPonto(
  grade: GradeDeMemoria,
  fontes: readonly FonteDeMemoria[],
  p: Ponto,
): number {
  if (!lembraDoPonto(grade, p)) return 0;
  let opacidade = 0;
  for (const f of fontes) {
    opacidade = Math.max(
      opacidade,
      opacidadeDaMemoria(Math.hypot(p.x - f.x, p.y - f.y), f.alcanceM),
    );
  }
  return opacidade;
}
