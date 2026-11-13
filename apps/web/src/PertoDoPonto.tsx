import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { posicaoDoRotulo, type Retangulo } from "./posicaoDaRegua";

function retanguloDe(el: Element, pai: DOMRect, folga: number): Retangulo {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - pai.left - folga,
    y: r.top - pai.top - folga,
    largura: r.width + folga * 2,
    altura: r.height + folga * 2,
  };
}

/**
 * V14: põe o que vem dentro (um rótulo da régua) perto do ponto (x, y) da área do mapa, sempre dentro da área
 * visível: à direita e embaixo; se não couber, à esquerda; se não couber, em cima. Foge do zoom flutuante e,
 * com `evitarTrechos`, dos rótulos dos pontos de virada (os que levam `trecho`). O pai (`offsetParent`) é a área
 * do mapa; o elemento de dentro deixa de ser absoluto (ver `.regua-posicao`).
 */
export function PertoDoPonto({
  x,
  y,
  dx,
  dy,
  trecho,
  evitarTrechos,
  children,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Este é o rótulo de um ponto de virada: a ponta e o Fixar fogem dele (e ele deles, não). */
  trecho?: boolean;
  evitarTrechos?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: x + dx, y: y + dy });
  // Mede a cada renderização (o texto muda enquanto se arrasta): antes da pintura, sem piscar.
  useLayoutEffect(() => {
    const el = ref.current;
    const pai = el?.offsetParent;
    if (!el || !(pai instanceof HTMLElement)) return;
    const caixaDoPai = pai.getBoundingClientRect();
    const evitar: Retangulo[] = [];
    const zoom = pai.querySelector('[data-testid="zoom-flutuante"]');
    if (zoom) evitar.push(retanguloDe(zoom, caixaDoPai, 6));
    if (evitarTrechos) {
      for (const t of pai.querySelectorAll("[data-trecho]")) {
        evitar.push(retanguloDe(t, caixaDoPai, 2));
      }
    }
    const nova = posicaoDoRotulo(
      { x, y },
      { dx, dy },
      { largura: el.offsetWidth, altura: el.offsetHeight },
      { largura: pai.clientWidth, altura: pai.clientHeight },
      evitar,
    );
    setPos((antes) => (antes.x === nova.x && antes.y === nova.y ? antes : nova));
  });
  return (
    <div
      ref={ref}
      className="regua-posicao"
      data-trecho={trecho ? "" : undefined}
      style={{ left: pos.x, top: pos.y }}
    >
      {children}
    </div>
  );
}
