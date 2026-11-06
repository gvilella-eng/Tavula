import type { Ponto } from "./estado.ts";

/** Um segmento de parede que bloqueia a visão (pontas em metros). */
export type Segmento = { a: Ponto; b: Ponto };

/** Limites da cena: o retângulo de (0,0) a (larguraM, alturaM). */
export type Limites = { larguraM: number; alturaM: number };

/** Lados do polígono que aproxima o círculo do alcance (a borda é só um corte, não precisa ser fina). */
const LADOS_DO_ALCANCE = 32;
/** Desvio angular dos raios vizinhos de cada ponta, em radianos (algoritmo "2D visibility"). */
const DESVIO = 1e-5;

/**
 * Polígono de visibilidade a partir de `origem` (varredura angular, ao estilo "2D visibility" da Red
 * Blob Games): um raio para cada ponta de segmento, mais um de cada lado dela; vale o ponto mais
 * próximo onde cada raio bate. O resultado é limitado pela cena e, com `alcanceM`, por um polígono de
 * 32 lados em volta da origem (`null` = sem limite). Vem em ordem de ângulo (anti-horário na tela
 * com y para baixo); vazio só se a origem estiver fora da cena.
 */
export function poligonoDeVisibilidade(
  origem: Ponto,
  segmentos: readonly Segmento[],
  limites: Limites,
  alcanceM: number | null,
): Ponto[] {
  const { larguraM: w, alturaM: h } = limites;
  const ox = origem.x;
  const oy = origem.y;
  if (!(ox >= 0 && ox <= w && oy >= 0 && oy <= h)) return [];

  // Segmentos em arranjo plano: x1, y1, x2, y2. Primeiro a cena, depois o alcance, depois as paredes
  // que chegam até o quadrado do alcance (as demais não mudam nada).
  const lista: number[] = [0, 0, w, 0, w, 0, w, h, w, h, 0, h, 0, h, 0, 0];
  if (alcanceM !== null) {
    for (let i = 0; i < LADOS_DO_ALCANCE; i++) {
      const a0 = (i / LADOS_DO_ALCANCE) * Math.PI * 2;
      const a1 = ((i + 1) / LADOS_DO_ALCANCE) * Math.PI * 2;
      lista.push(
        ox + Math.cos(a0) * alcanceM,
        oy + Math.sin(a0) * alcanceM,
        ox + Math.cos(a1) * alcanceM,
        oy + Math.sin(a1) * alcanceM,
      );
    }
  }
  for (const s of segmentos) {
    if (alcanceM !== null) {
      const fora =
        Math.max(s.a.x, s.b.x) < ox - alcanceM ||
        Math.min(s.a.x, s.b.x) > ox + alcanceM ||
        Math.max(s.a.y, s.b.y) < oy - alcanceM ||
        Math.min(s.a.y, s.b.y) > oy + alcanceM;
      if (fora) continue;
    }
    lista.push(s.a.x, s.a.y, s.b.x, s.b.y);
  }
  // Do mais próximo ao mais distante da origem: o raio para de olhar quando o resto já está além do
  // melhor acerto (é o que mantém o custo baixo com centenas de paredes).
  const total = lista.length / 4;
  const distancia2 = new Float64Array(total);
  const ordem = Array.from({ length: total }, (_, i) => i);
  for (let i = 0; i < total; i++) {
    distancia2[i] = distanciaAoSegmento2(
      ox,
      oy,
      lista[i * 4] as number,
      lista[i * 4 + 1] as number,
      lista[i * 4 + 2] as number,
      lista[i * 4 + 3] as number,
    );
  }
  ordem.sort((p, q) => (distancia2[p] as number) - (distancia2[q] as number));
  const n = total;
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const sx = new Float64Array(n);
  const sy = new Float64Array(n);
  const minimo2 = new Float64Array(n);
  // Pontas: ângulo e distância até a origem.
  const pontas: { a: number; d: number }[] = [];
  for (let k = 0; k < n; k++) {
    const i = ordem[k] as number;
    const x1 = lista[i * 4] as number;
    const y1 = lista[i * 4 + 1] as number;
    const x2 = lista[i * 4 + 2] as number;
    const y2 = lista[i * 4 + 3] as number;
    px[k] = x1;
    py[k] = y1;
    sx[k] = x2 - x1;
    sy[k] = y2 - y1;
    minimo2[k] = distancia2[i] as number;
    for (const [x, y] of [
      [x1, y1],
      [x2, y2],
    ] as const) {
      if (x === ox && y === oy) continue;
      pontas.push({ a: Math.atan2(y - oy, x - ox), d: Math.hypot(x - ox, y - oy) });
    }
  }
  pontas.sort((p, q) => p.a - q.a);

  /** Distância até onde o raio de ângulo `a` bate primeiro. */
  const lancar = (a: number): number => {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let melhor = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      if ((minimo2[i] as number) > melhor * melhor) break;
      const ssx = sx[i] as number;
      const ssy = sy[i] as number;
      const den = dx * ssy - dy * ssx;
      if (den > -1e-12 && den < 1e-12) continue; // paralelo
      const rx = (px[i] as number) - ox;
      const ry = (py[i] as number) - oy;
      const t = (rx * ssy - ry * ssx) / den;
      if (t < 0 || t >= melhor) continue;
      const u = (rx * dy - ry * dx) / den;
      if (u < -1e-9 || u > 1 + 1e-9) continue;
      melhor = t;
    }
    return melhor;
  };

  // Um raio exato por ponta. Só a ponta que o raio alcança (não está atrás de outra parede) ganha os
  // dois raios vizinhos, que fazem a luz "passar de raspão" pela quina.
  const achados: { a: number; t: number }[] = [];
  let anterior = Number.NaN;
  let i = 0;
  while (i < pontas.length) {
    const ponta = pontas[i] as { a: number; d: number };
    let maisPerto = ponta.d;
    let j = i + 1;
    while (j < pontas.length && (pontas[j] as { a: number }).a - ponta.a < 1e-12) {
      maisPerto = Math.min(maisPerto, (pontas[j] as { d: number }).d);
      j++;
    }
    i = j;
    if (ponta.a - anterior < 1e-12) continue;
    anterior = ponta.a;
    const t = lancar(ponta.a);
    if (t === Number.POSITIVE_INFINITY) continue;
    achados.push({ a: ponta.a, t });
    if (t < maisPerto - 1e-6) continue; // a ponta está escondida atrás de outra parede
    for (const desvio of [-DESVIO, DESVIO]) {
      const a2 = ponta.a + desvio;
      const t2 = lancar(a2);
      if (t2 !== Number.POSITIVE_INFINITY) achados.push({ a: a2, t: t2 });
    }
  }
  achados.sort((p, q) => p.a - q.a);
  const pontos: Ponto[] = achados.map(({ a, t }) => ({
    x: ox + Math.cos(a) * t,
    y: oy + Math.sin(a) * t,
  }));
  return pontos;
}

/** O ponto está dentro do polígono (traçado de raio; a borda conta de qualquer jeito)? */
export function pontoNoPoligono(p: Ponto, poligono: readonly Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i] as Ponto;
    const b = poligono[j] as Ponto;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      dentro = !dentro;
    }
  }
  return dentro;
}

/** O ponto aparece em algum dos polígonos (a união da visão)? */
export function pontoNaUniao(p: Ponto, poligonos: readonly (readonly Ponto[])[]): boolean {
  return poligonos.some((poligono) => pontoNoPoligono(p, poligono));
}

/** Quadrado da distância do ponto (px, py) ao segmento (x1, y1)-(x2, y2). */
function distanciaAoSegmento2(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const comprimento2 = dx * dx + dy * dy;
  const t =
    comprimento2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / comprimento2));
  const cx = x1 + t * dx - px;
  const cy = y1 + t * dy - py;
  return cx * cx + cy * cy;
}
