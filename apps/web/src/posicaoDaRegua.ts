// V14: onde pôr um rótulo da régua perto de um ponto sem ele sair da área visível do mapa (nem ir para trás do
// zoom flutuante). Função pura: o componente `PertoDoPonto` mede e chama.

export type Retangulo = { x: number; y: number; largura: number; altura: number };

const MARGEM_DA_BORDA = 4;

function cruza(a: Retangulo, b: Retangulo): boolean {
  return (
    a.x < b.x + b.largura && a.x + a.largura > b.x && a.y < b.y + b.altura && a.y + a.altura > b.y
  );
}

/**
 * O canto superior esquerdo do rótulo (`largura` x `altura`) para o ponto (`x`, `y`): à direita e embaixo, com
 * o afastamento (`dx`, `dy`); se não couber, à esquerda; se não couber, em cima. `evitar` são os retângulos que o
 * rótulo não deve cobrir (o zoom e, para a ponta, os rótulos dos trechos). Sem posição que caiba, fica o preferido preso dentro da área.
 */
export function posicaoDoRotulo(
  ponto: { x: number; y: number },
  afastamento: { dx: number; dy: number },
  rotulo: { largura: number; altura: number },
  area: { largura: number; altura: number },
  evitar: readonly Retangulo[],
): { x: number; y: number } {
  const { largura: w, altura: h } = rotulo;
  const m = MARGEM_DA_BORDA;
  const candidatos = [
    { x: ponto.x + afastamento.dx, y: ponto.y + afastamento.dy },
    { x: ponto.x - afastamento.dx - w, y: ponto.y + afastamento.dy },
    { x: ponto.x + afastamento.dx, y: ponto.y - afastamento.dy - h },
    { x: ponto.x - afastamento.dx - w, y: ponto.y - afastamento.dy - h },
  ];
  const cabe = (c: { x: number; y: number }) =>
    c.x >= m &&
    c.y >= m &&
    c.x + w <= area.largura - m &&
    c.y + h <= area.altura - m &&
    !evitar.some((r) => cruza({ x: c.x, y: c.y, largura: w, altura: h }, r));
  const achado = candidatos.find(cabe);
  if (achado) return achado;
  const primeiro = candidatos[0] ?? { x: ponto.x, y: ponto.y };
  return {
    x: Math.max(m, Math.min(primeiro.x, area.largura - w - m)),
    y: Math.max(m, Math.min(primeiro.y, area.altura - h - m)),
  };
}
