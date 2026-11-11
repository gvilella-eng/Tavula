// Contas das janelas flutuantes: tudo em pixels, nas coordenadas da área do mapa.

export type Tam = { largura: number; altura: number };
export type Ponto = { x: number; y: number };
/** Posição padrão da janela, dada a área do mapa e o tamanho da janela. */
export type Padrao = (area: Tam, janela: Tam) => Ponto;

/** Folga entre a janela e a borda da área nas posições padrão. */
export const MARGEM = 12;

/** Empurra a janela para dentro da área, mexendo o mínimo (se não cabe, fica colada no canto de cima). */
export function limitarNaArea(p: Ponto, janela: Tam, area: Tam): Ponto {
  const maxX = Math.max(0, area.largura - janela.largura);
  const maxY = Math.max(0, area.altura - janela.altura);
  return {
    x: Math.round(Math.min(maxX, Math.max(0, p.x))),
    y: Math.round(Math.min(maxY, Math.max(0, p.y))),
  };
}

/** Segura um tamanho entre o mínimo e o que sobra na área a partir da posição. */
export function limitarTamanho(valor: number, minimo: number, sobra: number): number {
  return Math.round(Math.min(Math.max(valor, minimo), Math.max(minimo, sobra)));
}

export type Canto = "topo-esquerda" | "topo-direita" | "baixo-esquerda" | "baixo-direita";

/** Padrão "num canto da área, com folga". */
export function noCanto(canto: Canto, dx = MARGEM, dy = MARGEM): Padrao {
  return (area, janela) => ({
    x: canto.endsWith("esquerda") ? dx : area.largura - janela.largura - dx,
    y: canto.startsWith("topo") ? dy : area.altura - janela.altura - dy,
  });
}

/** Padrão "no alto, centralizada". */
export function noTopoAoCentro(dy = MARGEM): Padrao {
  return (area, janela) => ({ x: Math.round((area.largura - janela.largura) / 2), y: dy });
}
