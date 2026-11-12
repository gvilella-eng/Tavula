/** Um retângulo na tela, em pixels (como o `getBoundingClientRect`). */
export type Retangulo = { x: number; y: number; w: number; h: number };

const FOLGA = 14;
const MARGEM = 12;

const limitar = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(v, Math.max(min, max)));

/**
 * Onde pôr o cartão do tour: perto do alvo e sempre inteiro dentro da janela. Sem alvo, no meio. Tenta, na ordem,
 * os quatro lados do alvo (baixo e cima primeiro quando o alvo é mais largo que alto; direita e esquerda no outro
 * caso) e fica com o primeiro em que o cartão cabe sem cobrir o alvo; encostado na janela, ele desliza ao longo do
 * lado. Se nenhum lado cabe (o alvo é o mapa inteiro, por exemplo), o cartão fica dentro do alvo, perto da borda
 * de baixo.
 */
export function posicionarCartao(
  alvo: Retangulo | null,
  cartao: { w: number; h: number },
  janela: { w: number; h: number },
): { x: number; y: number } {
  const maxX = janela.w - MARGEM - cartao.w;
  const maxY = janela.h - MARGEM - cartao.h;
  if (!alvo) {
    return {
      x: limitar((janela.w - cartao.w) / 2, MARGEM, maxX),
      y: limitar((janela.h - cartao.h) / 2, MARGEM, maxY),
    };
  }
  const meioX = alvo.x + alvo.w / 2 - cartao.w / 2;
  const meioY = alvo.y + alvo.h / 2 - cartao.h / 2;
  const tentativas = {
    baixo: () => {
      const y = alvo.y + alvo.h + FOLGA;
      return y <= maxY ? { x: limitar(meioX, MARGEM, maxX), y } : null;
    },
    cima: () => {
      const y = alvo.y - FOLGA - cartao.h;
      return y >= MARGEM ? { x: limitar(meioX, MARGEM, maxX), y } : null;
    },
    direita: () => {
      const x = alvo.x + alvo.w + FOLGA;
      return x <= maxX ? { x, y: limitar(meioY, MARGEM, maxY) } : null;
    },
    esquerda: () => {
      const x = alvo.x - FOLGA - cartao.w;
      return x >= MARGEM ? { x, y: limitar(meioY, MARGEM, maxY) } : null;
    },
  };
  const ordem: (keyof typeof tentativas)[] =
    alvo.w >= alvo.h
      ? ["baixo", "cima", "direita", "esquerda"]
      : ["direita", "esquerda", "baixo", "cima"];
  for (const lado of ordem) {
    const p = tentativas[lado]();
    if (p) return p;
  }
  return {
    x: limitar(meioX, MARGEM, maxX),
    y: limitar(alvo.y + alvo.h - cartao.h - 20, MARGEM, maxY),
  };
}
