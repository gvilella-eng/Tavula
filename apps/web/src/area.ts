/** A área do mapa (o miolo da mesa, entre as barras fixas). Tudo o que abre sobre o mapa fica dentro dela. */
export type CaixaDaArea = { esquerda: number; topo: number; direita: number; base: number };

/** A caixa da área do mapa na página; sem ela (ainda não montada), a janela inteira. */
export function caixaDaArea(): CaixaDaArea {
  const el = document.querySelector<HTMLElement>("[data-area-do-mapa]");
  if (el) {
    const r = el.getBoundingClientRect();
    return { esquerda: r.left, topo: r.top, direita: r.right, base: r.bottom };
  }
  return { esquerda: 0, topo: 0, direita: window.innerWidth, base: window.innerHeight };
}

/** Posiciona uma caixa de `largura` x `altura` perto de (x, y) da página, sem sair da área do mapa. */
export function dentroDaArea(
  x: number,
  y: number,
  largura: number,
  altura: number,
  margem = 8,
): { left: number; top: number } {
  const a = caixaDaArea();
  return {
    left: Math.max(a.esquerda + margem, Math.min(x, a.direita - largura - margem)),
    top: Math.max(a.topo + margem, Math.min(y, a.base - altura - margem)),
  };
}

/** Largura e altura da área do mapa (para as janelas, que são posicionadas dentro dela). */
export function tamanhoDaArea(): { largura: number; altura: number } {
  const a = caixaDaArea();
  return { largura: a.direita - a.esquerda, altura: a.base - a.topo };
}
