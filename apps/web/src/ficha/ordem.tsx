import {
  type EntradaDoCompendio,
  lerEntradaArrastada,
  TIPO_DO_ARRASTO_DO_COMPENDIO,
  type TipoDeEntrada,
} from "@tabletop/shared";
import type { DragEvent, KeyboardEvent, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------------------------
// Ordem das listas da ficha (V4b): segurar para reordenar (mouse ou toque) e Alt+↑/↓, e as listas que aceitam o que
// vem arrastado do compêndio. As linhas se marcam com `data-linha-lista` e `data-linha-i`; o desenho do indicador, da
// linha levantada e da área acesa mora no `ficha.css`.
// ---------------------------------------------------------------------------------------------

/** Quanto tempo se segura a linha antes de ela "levantar". */
export const TEMPO_DO_SEGURAR_MS = 300;
const DISTANCIA_QUE_CANCELA_PX = 6;

const FOCAVEIS = "button, input, textarea, select, [tabindex]";
const IGNORADOS = "[data-sem], input, textarea, select, [contenteditable='true']";

/** Onde uma lista procura as próprias linhas: a janela da ficha (cada lista tem um nome só dentro dela). */
function escopoDe(el: Element): ParentNode {
  return el.closest('[data-testid="janela-ficha"]') ?? document;
}

function linhasDa(escopo: ParentNode, lista: string): HTMLElement[] {
  return [...escopo.querySelectorAll<HTMLElement>(`[data-linha-lista="${lista}"]`)].sort(
    (a, b) => Number(a.dataset.linhaI) - Number(b.dataset.linhaI),
  );
}

/**
 * Em qual vão (0 = antes da primeira linha, n = depois da última) o ponteiro está. Com `x`, as "linhas" correm em
 * fluxo (chips que quebram de linha): vale a ordem de leitura, primeiro pela faixa e depois pela metade do item.
 */
function vaoDoPonteiro(linhas: readonly HTMLElement[], y: number, x?: number): number {
  const i = linhas.findIndex((l) => {
    const r = l.getBoundingClientRect();
    if (x === undefined) return y < r.top + r.height / 2;
    return y < r.top || (y <= r.bottom && x < r.left + r.width / 2);
  });
  return i === -1 ? linhas.length : i;
}

export type Indicador = "antes" | "depois" | undefined;

/** Onde a linha `i` desenha a linha indicadora, dado o vão previsto (0..total). */
export function indicadorDoVao(vao: number | null, i: number, total: number): Indicador {
  if (vao === null) return undefined;
  if (vao === i) return "antes";
  if (vao === total && i === total - 1) return "depois";
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Segurar para reordenar
// ---------------------------------------------------------------------------------------------

type Segurando = { de: number; vao: number | null };

type OpcoesDeOrdem = {
  /** O nome da lista dentro da janela ("ataque", "itens", "acao"...). */
  lista: string;
  habilitado: boolean;
  /** Move o item `de` para a posição `para` (as duas dentro da lista). */
  aoMover: (de: number, para: number) => void;
  /** As linhas correm em fluxo (chips lado a lado): o vão do ponteiro leva o X em conta. */
  fluxo?: boolean;
};

/**
 * Segura ~300 ms uma linha e a "levanta"; arrastar mostra a linha indicadora e soltar move; Esc cancela. Um clique
 * curto segue fazendo o que fazia. Alt+↑ e Alt+↓ numa linha focada movem uma posição. Os controles de dentro da
 * linha (`data-sem`, campos de texto) não iniciam o gesto.
 */
export function useOrdemDaLista({ lista, habilitado, aoMover, fluxo }: OpcoesDeOrdem) {
  const [segurando, setSegurando] = useState<Segurando | null>(null);
  const aoMoverRef = useRef(aoMover);
  aoMoverRef.current = aoMover;
  const limpeza = useRef<(() => void) | null>(null);

  useEffect(() => () => limpeza.current?.(), []);

  const iniciar = useCallback(
    (e: PointerEvent<HTMLElement>, i: number) => {
      if (!habilitado) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if ((e.target as HTMLElement).closest(IGNORADOS)) return;
      limpeza.current?.();
      const linha = e.currentTarget;
      const escopo = escopoDe(linha);
      const inicio = { x: e.clientX, y: e.clientY, id: e.pointerId };
      let ativo = false;
      // Esc: a linha desce na hora, mas o gesto só termina ao soltar (para o clique de depois não abrir nada).
      let desistiu = false;
      let vao: number | null = null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const estiloAntes = document.body.style.userSelect;

      const parar = () => {
        clearTimeout(timer);
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("pointerup", soltar);
        window.removeEventListener("pointercancel", cancelar);
        window.removeEventListener("keydown", teclar, true);
        document.body.style.userSelect = estiloAntes;
        limpeza.current = null;
        setSegurando(null);
      };
      // O clique que vem depois de arrastar não pode abrir nem rolar nada.
      const engolirOClique = () => {
        const engole = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        window.addEventListener("click", engole, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", engole, true), 0);
      };
      const mover = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== inicio.id) return;
        if (!ativo) {
          if (
            Math.abs(ev.clientX - inicio.x) > DISTANCIA_QUE_CANCELA_PX ||
            Math.abs(ev.clientY - inicio.y) > DISTANCIA_QUE_CANCELA_PX
          ) {
            parar();
          }
          return;
        }
        if (desistiu) return;
        const novo = vaoDoPonteiro(
          linhasDa(escopo, lista),
          ev.clientY,
          fluxo ? ev.clientX : undefined,
        );
        if (novo !== vao) {
          vao = novo;
          setSegurando({ de: i, vao });
        }
      };
      const soltar = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== inicio.id) return;
        const levantou = ativo;
        const final = desistiu ? null : vao;
        parar();
        if (!levantou) return;
        engolirOClique();
        if (final === null) return;
        const para = final > i ? final - 1 : final;
        if (para !== i) aoMoverRef.current(i, para);
      };
      const cancelar = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== inicio.id) return;
        const levantou = ativo;
        parar();
        if (levantou) engolirOClique();
      };
      const teclar = (ev: globalThis.KeyboardEvent) => {
        if (ev.key !== "Escape" || !ativo || desistiu) return;
        ev.stopPropagation();
        ev.preventDefault();
        desistiu = true;
        vao = null;
        setSegurando(null);
        document.body.style.userSelect = estiloAntes;
      };

      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", soltar);
      window.addEventListener("pointercancel", cancelar);
      window.addEventListener("keydown", teclar, true);
      limpeza.current = parar;
      timer = setTimeout(() => {
        ativo = true;
        document.body.style.userSelect = "none";
        try {
          linha.setPointerCapture(inicio.id);
        } catch {
          // sem captura o gesto segue pelo window
        }
        setSegurando({ de: i, vao: null });
      }, TEMPO_DO_SEGURAR_MS);
    },
    [habilitado, lista, fluxo],
  );

  const moverComTeclado = useCallback(
    (e: KeyboardEvent<HTMLElement>, i: number, total: number) => {
      if (!habilitado || !e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      e.stopPropagation();
      const para = i + (e.key === "ArrowUp" ? -1 : 1);
      if (para < 0 || para >= total) return;
      const escopo = escopoDe(e.currentTarget);
      // O controle em foco, pela ordem dentro da linha: o foco acompanha o item, que mudou de posição.
      const focaveis = (el: Element) => [...el.querySelectorAll<HTMLElement>(FOCAVEIS)];
      const k = focaveis(e.currentTarget).indexOf(e.target as HTMLElement);
      aoMoverRef.current(i, para);
      requestAnimationFrame(() => {
        const linha = linhasDa(escopo, lista)[para];
        if (linha) focaveis(linha)[Math.max(0, k)]?.focus();
      });
    },
    [habilitado, lista],
  );

  /** Os atributos de uma linha da lista (`total` = quantas linhas ela tem). */
  const linha = useCallback(
    (i: number, total: number) => {
      const vaoVisivel =
        segurando &&
        segurando.vao !== null &&
        segurando.vao !== segurando.de &&
        segurando.vao !== segurando.de + 1
          ? segurando.vao
          : null;
      const indicador = indicadorDoVao(vaoVisivel, i, total);
      return {
        "data-linha-lista": lista,
        "data-linha-i": i,
        "data-levantada": segurando?.de === i ? "true" : undefined,
        "data-indicador": indicador,
        onPointerDown: (e: PointerEvent<HTMLElement>) => iniciar(e, i),
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => moverComTeclado(e, i, total),
      } as const;
    },
    [segurando, lista, iniciar, moverComTeclado],
  );

  return { linha, segurando: segurando !== null };
}

// ---------------------------------------------------------------------------------------------
// Arrasto do compêndio
// ---------------------------------------------------------------------------------------------

let entradaEmArrasto: EntradaDoCompendio | null = null;
const ouvintes = new Set<() => void>();
const avisarOuvintes = () => {
  for (const o of ouvintes) o();
};
const assinar = (o: () => void) => {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
};
const entradaAtual = () => entradaEmArrasto;

function terminarArrasto() {
  if (entradaEmArrasto === null) return;
  entradaEmArrasto = null;
  avisarOuvintes();
}

if (typeof window !== "undefined") {
  // O arrasto acaba ao soltar (em qualquer lugar) ou se a pessoa desiste: as áreas apagam.
  window.addEventListener("dragend", terminarArrasto, true);
  window.addEventListener("drop", () => setTimeout(terminarArrasto, 0), true);
}

/** O `onDragStart` de uma entrada do compêndio: leva a entrada no arrasto e acende as áreas que a aceitam. */
export function comecarArrastoDoCompendio(e: DragEvent<HTMLElement>, entrada: EntradaDoCompendio) {
  const nome =
    entrada.tipo === "magia"
      ? entrada.magia.nome
      : entrada.tipo === "arma"
        ? entrada.arma.nome
        : entrada.tipo === "monstro"
          ? entrada.monstro.nome
          : entrada.tipo === "itemMagico"
            ? entrada.itemMagico.nome
            : entrada.item.nome;
  e.dataTransfer.setData(TIPO_DO_ARRASTO_DO_COMPENDIO, JSON.stringify(entrada));
  e.dataTransfer.setData("text/plain", nome);
  e.dataTransfer.effectAllowed = "copy";
  // Mudar a tela no mesmo instante cancela o arrasto em alguns navegadores: acende no turno seguinte.
  setTimeout(() => {
    entradaEmArrasto = entrada;
    avisarOuvintes();
  }, 0);
}

/** A entrada que está sendo arrastada do compêndio agora (ou `null`). */
export function useEntradaEmArrasto(): EntradaDoCompendio | null {
  return useSyncExternalStore(assinar, entradaAtual, () => null);
}

type OpcoesDeSoltar = {
  aceita: readonly TipoDeEntrada[];
  /** Aceita só algumas entradas do tipo (o círculo da magia, por exemplo). */
  filtro?: (entrada: EntradaDoCompendio) => boolean;
  /** Só quem edita a ficha solta nela. */
  habilitado: boolean;
  /** O nome da lista de linhas de cada tipo aceito, para achar a posição exata da soltura. */
  listaDoTipo?: Partial<Record<TipoDeEntrada, string | ((entrada: EntradaDoCompendio) => string)>>;
  /** As linhas da lista correm em fluxo (chips lado a lado). */
  fluxo?: boolean;
  aoSoltar: (entrada: EntradaDoCompendio, posicao: number | null) => void;
};

/**
 * Uma área da ficha que recebe o que vem do compêndio: acende (`acesa`) enquanto alguém arrasta um tipo que ela aceita
 * e, ao soltar, chama `aoSoltar` com a posição da lista onde caiu (`null` = no fim ou sem lista).
 */
export function useSoltarDoCompendio({
  aceita,
  filtro,
  habilitado,
  listaDoTipo,
  fluxo,
  aoSoltar,
}: OpcoesDeSoltar) {
  const entradaEmArrasto = useEntradaEmArrasto();
  const passa = (e: EntradaDoCompendio) => aceita.includes(e.tipo) && (filtro ? filtro(e) : true);
  const acesa = habilitado && entradaEmArrasto !== null && passa(entradaEmArrasto);
  const [previsao, setPrevisao] = useState<{ lista: string; vao: number } | null>(null);
  const aoSoltarRef = useRef(aoSoltar);
  aoSoltarRef.current = aoSoltar;

  // Vindo do compêndio o `dataTransfer` traz o tipo próprio; `emArrasto` diz qual entrada é (nulo se o arrasto
  // começou fora desta página: aí só o conteúdo da soltura decide).
  const veioDoCompendio = (e: DragEvent<HTMLElement>) =>
    e.dataTransfer.types.includes(TIPO_DO_ARRASTO_DO_COMPENDIO);

  const vaoDoEvento = (e: DragEvent<HTMLElement>, lista: string | undefined) => {
    if (!lista) return null;
    const linhas = linhasDa(escopoDe(e.currentTarget), lista);
    return linhas.length === 0
      ? null
      : vaoDoPonteiro(linhas, e.clientY, fluxo ? e.clientX : undefined);
  };
  const listaDe = (entrada: EntradaDoCompendio): string | undefined => {
    const alvo = listaDoTipo?.[entrada.tipo];
    return typeof alvo === "function" ? alvo(entrada) : alvo;
  };

  const props = {
    "data-aceita-soltar": acesa ? "true" : undefined,
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!habilitado) return;
      if (!veioDoCompendio(e)) return;
      if (entradaEmArrasto !== null && !passa(entradaEmArrasto)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const lista = entradaEmArrasto === null ? undefined : listaDe(entradaEmArrasto);
      const vao = vaoDoEvento(e, lista);
      setPrevisao((antes) => {
        const novo = lista && vao !== null ? { lista, vao } : null;
        return antes?.lista === novo?.lista && antes?.vao === novo?.vao ? antes : novo;
      });
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      // Alguns navegadores mandam `relatedTarget` nulo ao passar de um filho para outro: vale onde o ponteiro está.
      const r = e.currentTarget.getBoundingClientRect();
      const dentro =
        e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
      if (!dentro) setPrevisao(null);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      setPrevisao(null);
      if (!habilitado) return;
      const texto = e.dataTransfer.getData(TIPO_DO_ARRASTO_DO_COMPENDIO);
      const entrada = texto ? lerEntradaArrastada(texto) : null;
      if (!entrada || !passa(entrada)) return;
      e.preventDefault();
      e.stopPropagation();
      const lista = listaDe(entrada);
      const vao = vaoDoEvento(e, lista);
      aoSoltarRef.current(entrada, vao);
    },
  };

  return { props, acesa, previsao };
}
