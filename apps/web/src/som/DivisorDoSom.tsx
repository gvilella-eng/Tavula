import { type PointerEvent, type KeyboardEvent as TecladoReact, useRef, useState } from "react";
import {
  DIVISAO_MAXIMA,
  DIVISAO_MINIMA,
  DIVISAO_PADRAO,
  limitarDivisao,
  PASSO_DA_DIVISAO,
  rotuloDaDivisao,
} from "./divisaoDoSom";

type Props = {
  /** `vertical`: a linha é vertical e separa esquerda e direita; `horizontal`: separa o de cima e o de baixo. */
  orientacao: "vertical" | "horizontal";
  /** A parte do primeiro lado (0 a 1). */
  divisao: number;
  aoMudar: (v: number, guardar: boolean) => void;
};

/**
 * MU1: o divisor entre "Efeitos e ambientes" e "Música". Arrasta com o mouse (o rótulo mostra a divisão), com as setas
 * (±5%), Home e End (os limites) e volta ao meio com duplo clique. Cada lado fica com pelo menos 18%.
 */
const DUPLO_CLIQUE_MS = 450;

export function DivisorDoSom({ orientacao, divisao, aoMudar }: Props) {
  const [arrastando, setArrastando] = useState(false);
  const vertical = orientacao === "vertical";
  const atual = Math.round(limitarDivisao(divisao) * 100);

  /** Onde a divisão ficaria com o centro do divisor no ponteiro: o lado de cima/esquerda é `(espaço - divisor - vãos) × divisão`. */
  function divisaoNoPonteiro(e: PointerEvent<HTMLDivElement>): number | null {
    const pai = e.currentTarget.parentElement;
    if (!pai) return null;
    const r = pai.getBoundingClientRect();
    const tamanho = vertical ? r.width : r.height;
    const propria = vertical ? e.currentTarget.offsetWidth : e.currentTarget.offsetHeight;
    const vao = Number.parseFloat(getComputedStyle(pai).gap) || 0;
    const livre = tamanho - propria - 2 * vao;
    if (livre <= 0) return null;
    const ponto = (vertical ? e.clientX - r.left : e.clientY - r.top) - propria / 2 - vao;
    return ponto / livre;
  }
  const moveu = useRef(false);
  const ultimoToque = useRef(0);
  function aoApertar(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ponteiro já solto
    }
    moveu.current = false;
    setArrastando(true);
  }
  function aoMover(e: PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    const v = divisaoNoPonteiro(e);
    if (v === null) return;
    moveu.current = true;
    aoMudar(v, false);
  }
  function aoSoltar(e: PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    setArrastando(false);
    if (moveu.current) {
      const v = divisaoNoPonteiro(e);
      aoMudar(v ?? divisao, true);
      return;
    }
    // Um toque sem arrastar não mexe; dois toques seguidos (o duplo clique) voltam ao meio.
    const agora = e.timeStamp;
    if (agora - ultimoToque.current < DUPLO_CLIQUE_MS) {
      ultimoToque.current = 0;
      aoMudar(DIVISAO_PADRAO, true);
    } else {
      ultimoToque.current = agora;
    }
  }
  function aoTeclar(e: TecladoReact<HTMLDivElement>) {
    const menos = vertical ? "ArrowLeft" : "ArrowUp";
    const mais = vertical ? "ArrowRight" : "ArrowDown";
    let novo: number | undefined;
    if (e.key === menos) novo = divisao - PASSO_DA_DIVISAO;
    else if (e.key === mais) novo = divisao + PASSO_DA_DIVISAO;
    else if (e.key === "Home") novo = DIVISAO_MINIMA;
    else if (e.key === "End") novo = DIVISAO_MAXIMA;
    if (novo === undefined) return;
    e.preventDefault();
    aoMudar(novo, true);
  }

  const nome = vertical
    ? "Largura de efeitos e ambientes e da música"
    : "Altura de efeitos e ambientes e da música";
  return (
    // biome-ignore lint/a11y/useSemanticElements: o separador com foco é o padrão de ARIA para uma divisória ajustável
    <div
      className="som-divisor"
      data-orientacao={orientacao}
      data-ativo={arrastando ? "sim" : "nao"}
      data-testid="som-divisor"
      role="separator"
      tabIndex={0}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={nome}
      aria-valuemin={Math.round(DIVISAO_MINIMA * 100)}
      aria-valuemax={Math.round(DIVISAO_MAXIMA * 100)}
      aria-valuenow={atual}
      title="Arraste para dividir o espaço. Duplo clique volta ao meio."
      onPointerDown={aoApertar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      onDoubleClick={() => aoMudar(DIVISAO_PADRAO, true)}
      onKeyDown={aoTeclar}
    >
      <span className="som-divisor-linha" aria-hidden="true" />
      <span className="som-divisor-pega" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {arrastando && (
        <span className="som-divisor-rotulo" data-testid="som-divisor-rotulo" role="status">
          {rotuloDaDivisao(divisao)}
        </span>
      )}
    </div>
  );
}
