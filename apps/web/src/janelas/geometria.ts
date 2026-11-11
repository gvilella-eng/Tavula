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

/**
 * Área "apertada" (R6b): baixa demais para a ordem de turno, a ficha e o painel do token ficarem sem se cobrir
 * (1280×720 dá uma área de ~670 px de altura). Nela o painel do token vai para a coluna da direita, embaixo da
 * ordem de turno, e os dois dividem a altura da coluna.
 */
export const ALTURA_APERTADA = 900;
export const apertada = (area: Tam) => area.altura < ALTURA_APERTADA;

/** Folga embaixo, na coluna da direita, para o controle de zoom (canto da área). */
export const RESERVA_DO_ZOOM = 64;

/** A altura que sobra na coluna da direita, numa área apertada, para a ordem de turno e o painel do token juntos. */
function alturaDaColuna(area: Tam): number {
  return Math.max(400, area.altura - MARGEM - RESERVA_DO_ZOOM - MARGEM);
}

/** A ordem de turno fica com a maior parte da coluna (é a que se olha o tempo todo); o painel do token, com o resto (rola por dentro). */
export const alturaDaOrdemNaColuna = (area: Tam): number => Math.round(alturaDaColuna(area) * 0.58);
export const alturaDoTokenNaColuna = (area: Tam): number =>
  alturaDaColuna(area) - alturaDaOrdemNaColuna(area);

/** Padrão "no alto, centralizada". */
export function noTopoAoCentro(dy = MARGEM): Padrao {
  return (area, janela) => ({ x: Math.round((area.largura - janela.largura) / 2), y: dy });
}
