import {
  ALTURA_DO_ESPACO_VAZIO,
  conteudoDaCaixa,
  type DestinoNaCaixa,
  type Fio,
  type Fluxo,
  MAXIMO_DE_ESPACOS,
  MINIMO_DE_ESPACOS,
  motivoDaRecusa,
  NOMES_DAS_CAIXAS,
  type No,
  type NomesParaAFrase,
  numeroDeEspacos,
  pecaDoEspaco,
  podeLigar,
  portasDoNo,
} from "@tabletop/shared";
import { AlertTriangle, Boxes, Link2, Maximize2, Minus, Plus, X } from "lucide-react";
import {
  type CSSProperties,
  type DragEvent,
  type PointerEvent as PonteiroReact,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  alturaDoNo,
  arrastandoPeca,
  COR_DO_GRUPO,
  caminhoDoFio,
  chaveDoFio,
  detalheDaCaixa,
  type ErroDoEditor,
  GRUPOS_DE_PECA,
  grupoDoNo,
  LARGURA_DO_NO,
  larguraDoNo,
  limitesDosNos,
  motivoDaNovaPeca,
  nomeDaCaixaNoMenu,
  PECAS,
  type Peca,
  pontoDaPorta,
  ROTULO_DO_GRUPO,
  rotuloDoNo,
  type Selecao,
} from "./blocos";

// A grade do editor (AU2), como a do n8n: o fundo se arrasta (move a vista), a roda do mouse (ou a pinça) dá zoom, os blocos
// são nós que se arrastam em qualquer lugar, e as bolinhas das bordas se ligam com fios. Aqui mora só o que é da tela
// (vista, ponteiro, teclado dos nós); o fluxo em si é do editor, que recebe os pedidos por callbacks.

export type VistaDaGrade = { x: number; y: number; k: number };

export type ManejoDoCanvas = {
  /** Enquadra todos os nós na tela. */
  ajustar: () => void;
  /** O ponto da grade que está no meio da tela (onde cai uma peça que entra por clique). */
  centro: () => { x: number; y: number };
};

type FaseDoMovimento = "comecou" | "moveu" | "terminou";

/** AU3: para onde uma peça foi solta: um espaço de uma caixa (ou abrindo um novo), de volta à grade, ou em cima de outro gatilho. */
export type DestinoDaPeca =
  | ({ tipo: "caixa"; caixa: string } & DestinoNaCaixa)
  | { tipo: "grade"; x: number; y: number }
  | { tipo: "agrupar"; alvo: string };

/** Onde uma peça cairia: a caixa, o espaço (ou o espaço novo) e, se não cabe, o motivo (a dica curta). */
type AlvoDeSolta = { caixa: string; destino: DestinoNaCaixa; motivo: string | null };

type Props = {
  fluxo: Fluxo;
  nomes: NomesParaAFrase;
  selecao: Selecao;
  erros: readonly ErroDoEditor[];
  /** Mostra a mensagem de erro de cada nó (depois de tentar salvar, ou no nó escolhido). */
  mostrarErros: boolean;
  aoSelecionar: (s: Selecao) => void;
  /** Mover nós: `comecou` guarda o desenho para o Desfazer, `moveu` traz as posições novas, `terminou` fecha o gesto. */
  aoMoverNos: (
    fase: FaseDoMovimento,
    posicoes?: ReadonlyMap<string, { x: number; y: number }>,
  ) => void;
  aoLigar: (de: Fio["de"], para: Fio["para"]) => void;
  aoPecaNaGrade: (peca: Peca, x: number, y: number) => void;
  /** AU3: soltou uma peça já na grade (ou guardada) num destino. Devolve o motivo da recusa, ou `null`. */
  aoEncaixar: (id: string, destino: DestinoDaPeca) => string | null;
  /** AU3: soltou uma peça nova da paleta dentro de uma caixa. Devolve o motivo da recusa, ou `null`. */
  aoPecaNaCaixa: (peca: Peca, caixa: string, destino: DestinoNaCaixa) => string | null;
  /** AU3: sobe (-1) ou desce (+1) a peça dentro da caixa. */
  aoReordenar: (id: string, delta: -1 | 1) => void;
  /** AU3: o rótulo E/OU foi clicado (troca a caixa inteira), o + acrescentou um espaço, o × tirou um espaço vazio. */
  aoAlternarCaixa: (id: string) => void;
  aoAdicionarEspaco: (id: string) => void;
  aoRemoverEspaco: (id: string, espaco: number) => void;
  aoAviso: (texto: string) => void;
  manejo?: Ref<ManejoDoCanvas>;
};

const ZOOM_MINIMO = 0.25;
const ZOOM_MAXIMO = 2;
const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

export function CanvasDoGrafo(p: Props) {
  const { fluxo } = p;
  const raiz = useRef<HTMLDivElement>(null);
  const [vista, setVista] = useState<VistaDaGrade>({ x: 40, y: 40, k: 1 });
  const vistaRef = useRef(vista);
  vistaRef.current = vista;
  const fluxoRef = useRef(fluxo);
  fluxoRef.current = fluxo;
  const selecaoRef = useRef(p.selecao);
  selecaoRef.current = p.selecao;
  const propsRef = useRef(p);
  propsRef.current = p;

  const [ligando, setLigando] = useState<{
    de: Fio["de"];
    tipo: "exec" | "valor";
    x: number;
    y: number;
  } | null>(null);
  const [caixa, setCaixa] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const [busca, setBusca] = useState<{ cx: number; cy: number; x: number; y: number } | null>(null);
  const [menuLigar, setMenuLigar] = useState(false);
  const [menuCaixa, setMenuCaixa] = useState(false);
  // AU3: onde a peça arrastada cairia (a caixa e o lugar dentro dela) e o gatilho em cima do qual ela criaria um QUALQUER UM.
  const [alvoDeSolta, setAlvoDeSolta] = useState<AlvoDeSolta | null>(null);
  const [alvoDeGrupo, setAlvoDeGrupo] = useState<string | null>(null);

  // --- Enquadrar e converter coordenadas ---

  const ajustar = useCallback(() => {
    const el = raiz.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const b = limitesDosNos(fluxoRef.current.nos);
    if (!b || r.width === 0) {
      setVista({ x: 48, y: 48, k: 1 });
      return;
    }
    const margem = 56;
    const k = limitar(
      Math.min((r.width - 2 * margem) / b.largura, (r.height - 2 * margem) / b.altura, 1),
      0.3,
      1,
    );
    setVista({
      k,
      x: (r.width - b.largura * k) / 2 - b.x * k,
      y: Math.max(margem * 0.6, (r.height - b.altura * k) / 2) - b.y * k,
    });
  }, []);

  const naGrade = useCallback((cx: number, cy: number) => {
    const r = raiz.current?.getBoundingClientRect();
    const v = vistaRef.current;
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k };
  }, []);

  useImperativeHandle(
    p.manejo,
    () => ({
      ajustar,
      centro: () => {
        const r = raiz.current?.getBoundingClientRect();
        if (!r) return { x: 120, y: 120 };
        return naGrade(r.left + r.width / 2, r.top + r.height / 2);
      },
    }),
    [ajustar, naGrade],
  );

  // O primeiro enquadramento, quando o tamanho da tela já é conhecido: nenhum nó nasce cortado na borda.
  const jaAjustou = useRef(false);
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const olho = new ResizeObserver(() => {
      if (jaAjustou.current) return;
      const r = el.getBoundingClientRect();
      if (r.width < 50 || r.height < 50) return;
      jaAjustou.current = true;
      ajustar();
    });
    olho.observe(el);
    return () => olho.disconnect();
  }, [ajustar]);

  // --- Zoom com a roda (o React registra a roda como passiva, então aqui é direto no elemento) ---

  const zoomEm = useCallback((fator: number, cx: number, cy: number) => {
    const v = vistaRef.current;
    const k = limitar(v.k * fator, ZOOM_MINIMO, ZOOM_MAXIMO);
    setVista({ k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) });
  }, []);
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      if ((e.target as Element | null)?.closest(".ed-busca, .ed-menu-ligar")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomEm(
        Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)),
        e.clientX - r.left,
        e.clientY - r.top,
      );
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [zoomEm]);

  // --- O fundo: arrastar move a vista, Shift ou Ctrl com arrasto faz a caixa de seleção, dois dedos fazem a pinça ---

  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<
    | { tipo: "pan"; cx: number; cy: number; x: number; y: number; moveu: boolean }
    | { tipo: "caixa"; x0: number; y0: number; moveu: boolean }
    | { tipo: "pinca"; dist: number; k: number }
    | null
  >(null);

  const ehFundo = (alvo: EventTarget | null) =>
    alvo === raiz.current || (alvo instanceof Element && alvo.hasAttribute("data-fundo"));

  function aoApertarFundo(e: PonteiroReact<HTMLDivElement>) {
    if (!ehFundo(e.target) || (e.button !== 0 && e.button !== 1)) return;
    setBusca(null);
    setMenuLigar(false);
    setMenuCaixa(false);
    // O foco vai para a grade: os atalhos (Delete, copiar e colar, desfazer) valem logo depois de clicar no fundo.
    raiz.current?.focus({ preventScroll: true });
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    raiz.current?.setPointerCapture(e.pointerId);
    if (ponteiros.current.size === 2) {
      const [a, b] = [...ponteiros.current.values()];
      if (a && b) {
        gesto.current = {
          tipo: "pinca",
          dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          k: vistaRef.current.k,
        };
        setCaixa(null);
      }
      return;
    }
    const r = raiz.current?.getBoundingClientRect();
    if (!r) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      gesto.current = {
        tipo: "caixa",
        x0: e.clientX - r.left,
        y0: e.clientY - r.top,
        moveu: false,
      };
    } else {
      const v = vistaRef.current;
      gesto.current = { tipo: "pan", cx: e.clientX, cy: e.clientY, x: v.x, y: v.y, moveu: false };
    }
  }

  function aoMoverFundo(e: PonteiroReact<HTMLDivElement>) {
    if (ponteiros.current.has(e.pointerId)) {
      ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const g = gesto.current;
    if (!g) return;
    const r = raiz.current?.getBoundingClientRect();
    if (!r) return;
    if (g.tipo === "pan") {
      const dx = e.clientX - g.cx;
      const dy = e.clientY - g.cy;
      if (!g.moveu && Math.hypot(dx, dy) < 3) return;
      g.moveu = true;
      setVista((v) => ({ ...v, x: g.x + dx, y: g.y + dy }));
    } else if (g.tipo === "caixa") {
      const x1 = e.clientX - r.left;
      const y1 = e.clientY - r.top;
      if (!g.moveu && Math.hypot(x1 - g.x0, y1 - g.y0) < 3) return;
      g.moveu = true;
      setCaixa({ x0: g.x0, y0: g.y0, x1, y1 });
    } else {
      const [a, b] = [...ponteiros.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const k = limitar(g.k * (dist / g.dist), ZOOM_MINIMO, ZOOM_MAXIMO);
      const v = vistaRef.current;
      const cx = (a.x + b.x) / 2 - r.left;
      const cy = (a.y + b.y) / 2 - r.top;
      setVista({ k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) });
    }
  }

  function aoSoltarFundo(e: PonteiroReact<HTMLDivElement>) {
    ponteiros.current.delete(e.pointerId);
    const g = gesto.current;
    if (ponteiros.current.size > 0 && g?.tipo === "pinca") {
      gesto.current = null;
      return;
    }
    gesto.current = null;
    if (!g) return;
    if (g.tipo === "pan" && !g.moveu) {
      p.aoSelecionar({ nos: [], fio: null });
    } else if (g.tipo === "caixa") {
      const c = caixa;
      setCaixa(null);
      if (!c) {
        p.aoSelecionar({ nos: [], fio: null });
        return;
      }
      const v = vistaRef.current;
      const x0 = (Math.min(c.x0, c.x1) - v.x) / v.k;
      const x1 = (Math.max(c.x0, c.x1) - v.x) / v.k;
      const y0 = (Math.min(c.y0, c.y1) - v.y) / v.k;
      const y1 = (Math.max(c.y0, c.y1) - v.y) / v.k;
      const dentro = fluxo.nos
        .filter(
          (n) =>
            n.em === undefined &&
            n.x < x1 &&
            n.x + larguraDoNo(n, fluxo.nos) > x0 &&
            n.y < y1 &&
            n.y + alturaDoNo(n, fluxo.nos) > y0,
        )
        .map((n) => n.id);
      p.aoSelecionar({ nos: dentro, fio: null });
    }
  }

  function aoDuploCliqueNoFundo(e: React.MouseEvent<HTMLDivElement>) {
    if (!ehFundo(e.target)) return;
    const r = raiz.current?.getBoundingClientRect();
    if (!r) return;
    const g = naGrade(e.clientX, e.clientY);
    setBusca({ cx: e.clientX - r.left, cy: e.clientY - r.top, x: g.x, y: g.y });
  }

  // --- Soltar uma peça da paleta ---

  /**
   * O que há debaixo do ponteiro entre as caixas: um espaço (existente), o rótulo entre dois espaços (abre um novo ali), o pé da
   * caixa (abre um novo no fim) ou, nas bordas da caixa, o espaço mais perto. `null` se não há caixa. A peça que se arrasta fica
   * de fora (ela não recebe o ponteiro).
   */
  function alvoSob(
    x: number,
    y: number,
    ignorar: string | null,
  ): { caixa: string; destino: DestinoNaCaixa } | null {
    for (const el of document.elementsFromPoint(x, y)) {
      const espaco = el.closest<HTMLElement>("[data-espaco-de]");
      if (espaco?.dataset.espacoDe && espaco.dataset.espacoDe !== ignorar)
        return {
          caixa: espaco.dataset.espacoDe,
          destino: { espaco: Number(espaco.dataset.espaco) },
        };
      const sep = el.closest<HTMLElement>("[data-separador-de]");
      if (sep?.dataset.separadorDe && sep.dataset.separadorDe !== ignorar)
        return {
          caixa: sep.dataset.separadorDe,
          destino: { inserirEm: Number(sep.dataset.antesDe) },
        };
      const fim = el.closest<HTMLElement>("[data-fim-de]");
      if (fim?.dataset.fimDe && fim.dataset.fimDe !== ignorar)
        return { caixa: fim.dataset.fimDe, destino: { inserirEm: Number(fim.dataset.numero) } };
      const c = el.closest<HTMLElement>("[data-caixa-id]");
      if (c?.dataset.caixaId && c.dataset.caixaId !== ignorar) {
        // a borda da caixa: o espaço mais perto na vertical
        let melhor: { espaco: number; d: number } | null = null;
        for (const e of c.querySelectorAll<HTMLElement>(":scope > [data-espaco-de]")) {
          const r = e.getBoundingClientRect();
          const d = Math.abs(y - (r.top + r.height / 2));
          if (melhor === null || d < melhor.d) melhor = { espaco: Number(e.dataset.espaco), d };
        }
        return { caixa: c.dataset.caixaId, destino: { espaco: melhor?.espaco ?? 0 } };
      }
    }
    return null;
  }

  function aoArrastarSobre(e: DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes("text/x-peca")) return;
    e.preventDefault();
    const peca = arrastandoPeca.atual;
    const alvo = alvoSob(e.clientX, e.clientY, null);
    if (!alvo || !peca) {
      setAlvoDeSolta((a) => (a === null ? a : null));
      return;
    }
    const motivo = motivoDaNovaPeca(fluxoRef.current.nos, peca, alvo.caixa, alvo.destino);
    setAlvoDeSolta((a) =>
      a?.caixa === alvo.caixa &&
      JSON.stringify(a.destino) === JSON.stringify(alvo.destino) &&
      a.motivo === motivo
        ? a
        : { caixa: alvo.caixa, destino: alvo.destino, motivo },
    );
  }

  function aoSoltarPeca(e: DragEvent<HTMLDivElement>) {
    const id = e.dataTransfer.getData("text/x-peca");
    const alvo = alvoSob(e.clientX, e.clientY, null);
    setAlvoDeSolta(null);
    if (!id) return;
    e.preventDefault();
    const peca = PECAS.find((x) => x.id === id);
    if (!peca) return;
    if (alvo) {
      const motivo = p.aoPecaNaCaixa(peca, alvo.caixa, alvo.destino);
      if (motivo !== null) p.aoAviso(motivo);
      return;
    }
    const g = naGrade(e.clientX, e.clientY);
    p.aoPecaNaGrade(peca, g.x - LARGURA_DO_NO / 2, g.y - 30);
  }

  // --- Mover nós, e encaixar nas caixas (AU3) ---

  /** Um gatilho solto na grade debaixo do ponteiro (soltar um gatilho em cima dele cria um OU). */
  function gatilhoSob(x: number, y: number, eu: string): string | null {
    for (const el of document.elementsFromPoint(x, y)) {
      const n = el.closest<HTMLElement>("[data-no-id]");
      if (
        n?.dataset.noId &&
        n.dataset.noId !== eu &&
        n.dataset.tipo === "gatilho" &&
        n.dataset.guardado === undefined
      )
        return n.dataset.noId;
    }
    return null;
  }

  const [fantasma, setFantasma] = useState<{ x: number; y: number; titulo: string } | null>(null);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);

  function aoApertarNo(e: PonteiroReact<HTMLElement>, no: No) {
    if (e.button !== 0) return;
    e.stopPropagation();
    setBusca(null);
    const atual = selecaoRef.current;
    const maisUm = e.shiftKey || e.ctrlKey || e.metaKey;
    let sel = atual;
    if (maisUm) {
      sel = atual.nos.includes(no.id)
        ? { nos: atual.nos.filter((x) => x !== no.id), fio: null }
        : { nos: [...atual.nos, no.id], fio: null };
    } else if (!atual.nos.includes(no.id)) {
      sel = { nos: [no.id], fio: null };
    } else if (atual.fio !== null) {
      sel = { nos: atual.nos, fio: null };
    }
    if (sel !== atual) p.aoSelecionar(sel);
    if (!sel.nos.includes(no.id)) return;
    const guardado = no.em !== undefined;
    const unicaPeca = sel.nos.length === 1;
    // Só as peças soltas andam com o arrasto; a guardada fica na caixa até ser solta noutro lugar.
    const comeco = new Map(
      fluxo.nos
        .filter((n) => sel.nos.includes(n.id) && n.em === undefined)
        .map((n) => [n.id, { x: n.x, y: n.y }]),
    );
    const titulo = no.nome ?? rotuloDoNo(no, p.nomes).titulo;
    const elemento = raiz.current?.querySelector<HTMLElement>(`[data-no-id="${no.id}"]`) ?? null;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moveu = false;
    let destino: DestinoDaPeca | null = null;
    const mover = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!moveu) {
        if (Math.hypot(dx, dy) < 4) return;
        moveu = true;
        // A peça arrastada não recebe o ponteiro: assim se enxerga o que há debaixo dela (a caixa, o outro gatilho).
        elemento?.setAttribute("data-arrastando", "");
        setArrastandoId(no.id);
        if (!guardado) propsRef.current.aoMoverNos("comecou");
      }
      if (guardado) {
        setFantasma({ x: ev.clientX, y: ev.clientY, titulo });
      } else {
        const k = vistaRef.current.k;
        const novas = new Map<string, { x: number; y: number }>();
        for (const [id, o] of comeco) {
          novas.set(id, { x: Math.round(o.x + dx / k), y: Math.round(o.y + dy / k) });
        }
        propsRef.current.aoMoverNos("moveu", novas);
      }
      if (!unicaPeca) return;
      const alvo = alvoSob(ev.clientX, ev.clientY, no.id);
      if (alvo !== null) {
        const motivo = motivoDaRecusa(fluxoRef.current.nos, no.id, alvo.caixa, alvo.destino);
        destino = { tipo: "caixa", caixa: alvo.caixa, ...alvo.destino };
        setAlvoDeSolta((a) =>
          a?.caixa === alvo.caixa &&
          JSON.stringify(a.destino) === JSON.stringify(alvo.destino) &&
          a.motivo === motivo
            ? a
            : { caixa: alvo.caixa, destino: alvo.destino, motivo },
        );
        setAlvoDeGrupo(null);
        return;
      }
      setAlvoDeSolta(null);
      const outro =
        !guardado && no.tipo === "gatilho" ? gatilhoSob(ev.clientX, ev.clientY, no.id) : null;
      destino = outro === null ? null : { tipo: "agrupar", alvo: outro };
      setAlvoDeGrupo(outro);
    };
    const soltar = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      elemento?.removeAttribute("data-arrastando");
      setFantasma(null);
      setArrastandoId(null);
      setAlvoDeSolta(null);
      setAlvoDeGrupo(null);
      if (!moveu) return;
      if (ev.type === "pointercancel") {
        if (!guardado) propsRef.current.aoMoverNos("terminou");
        return;
      }
      let onde = destino;
      if (onde === null && guardado) {
        const g = naGrade(ev.clientX, ev.clientY);
        onde = { tipo: "grade", x: Math.round(g.x - 100), y: Math.round(g.y - 20) };
      }
      if (onde !== null) {
        const motivo = propsRef.current.aoEncaixar(no.id, onde);
        if (motivo !== null) propsRef.current.aoAviso(motivo);
      } else if (!guardado) {
        propsRef.current.aoMoverNos("terminou");
      }
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  }

  // --- Ligar: arrastar de uma saída até uma entrada ---

  function aoApertarSaida(
    e: PonteiroReact<HTMLElement>,
    no: No,
    porta: { id: string; tipo: "exec" | "valor" },
  ) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setBusca(null);
    const de = { no: no.id, saida: porta.id };
    const g0 = naGrade(e.clientX, e.clientY);
    setLigando({ de, tipo: porta.tipo, x: g0.x, y: g0.y });
    const mover = (ev: PointerEvent) => {
      const g = naGrade(ev.clientX, ev.clientY);
      setLigando({ de, tipo: porta.tipo, x: g.x, y: g.y });
    };
    const soltar = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      setLigando(null);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const porta2 = el?.closest<HTMLElement>("[data-lado='entrada']");
      const noEl = el?.closest<HTMLElement>("[data-no-id]");
      const f = fluxoRef.current;
      let para: Fio["para"] | null = null;
      if (porta2?.dataset.no && porta2.dataset.porta) {
        para = { no: porta2.dataset.no, entrada: porta2.dataset.porta };
      } else if (noEl?.dataset.noId) {
        const alvo = f.nos.find((n) => n.id === noEl.dataset.noId);
        // Soltou no corpo do nó: usa a primeira entrada que aceita este fio.
        const entrada = alvo
          ? portasDoNo(alvo, f.nos).entradas.find(
              (x) => x.tipo === porta.tipo && podeLigar(f, de, { no: alvo.id, entrada: x.id }).ok,
            )
          : undefined;
        if (alvo && entrada) para = { no: alvo.id, entrada: entrada.id };
        else if (alvo) {
          const qualquer = portasDoNo(alvo, f.nos).entradas.find((x) => x.tipo === porta.tipo);
          para = { no: alvo.id, entrada: qualquer?.id ?? "entrada" };
        }
      }
      if (para === null) return;
      const r = podeLigar(f, de, para);
      if (r.ok) propsRef.current.aoLigar(de, para);
      else propsRef.current.aoAviso(r.motivo);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  }

  // O menu "Ligar a…" do nó escolhido (o caminho do teclado para ligar).
  const unico =
    p.selecao.nos.length === 1 ? fluxo.nos.find((n) => n.id === p.selecao.nos[0]) : undefined;
  useEffect(() => {
    if (!unico) {
      setMenuLigar(false);
      setMenuCaixa(false);
    }
  }, [unico]);

  const posicaoDeTela = (x: number, y: number) => ({
    left: vista.x + x * vista.k,
    top: vista.y + y * vista.k,
  });

  const noPorId = new Map(fluxo.nos.map((n) => [n.id, n]));

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a grade é o alvo dos gestos do ponteiro; o teclado tem o menu "Ligar a…" e as setas nos nós
    <div
      ref={raiz}
      className="ed-canvas"
      data-testid="ed-canvas"
      data-fundo=""
      data-zoom={vista.k.toFixed(2)}
      tabIndex={-1}
      style={
        {
          backgroundSize: `${24 * vista.k}px ${24 * vista.k}px`,
          backgroundPosition: `${vista.x}px ${vista.y}px`,
        } as CSSProperties
      }
      onPointerDown={aoApertarFundo}
      onPointerMove={aoMoverFundo}
      onPointerUp={aoSoltarFundo}
      onPointerCancel={aoSoltarFundo}
      onDoubleClick={aoDuploCliqueNoFundo}
      onDragOver={aoArrastarSobre}
      onDrop={aoSoltarPeca}
    >
      <div
        className="ed-camada"
        data-fundo=""
        data-testid="ed-camada"
        style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})` }}
      >
        <svg className="ed-fios" width="1" height="1" aria-hidden="true" data-fundo="">
          {fluxo.fios.map((f) => {
            const de = noPorId.get(f.de.no);
            const para = noPorId.get(f.para.no);
            if (!de || !para) return null;
            const a = pontoDaPorta(de, "saida", f.de.saida, fluxo.nos);
            const b = pontoDaPorta(para, "entrada", f.para.entrada, fluxo.nos);
            const chave = chaveDoFio(f);
            const tipo =
              portasDoNo(de, fluxo.nos).saidas.find((s) => s.id === f.de.saida)?.tipo ?? "exec";
            const d = caminhoDoFio(a.x, a.y, b.x, b.y);
            return (
              <g
                key={chave}
                className="ed-fio"
                data-tipo-fio={tipo}
                data-escolhido={p.selecao.fio === chave}
                data-testid={`ed-fio-${chave}`}
                data-de={`${f.de.no}.${f.de.saida}`}
                data-para={`${f.para.no}.${f.para.entrada}`}
              >
                <path className="ed-fio-linha" d={d} />
                <path
                  className="ed-fio-alvo"
                  d={d}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setBusca(null);
                    p.aoSelecionar({ nos: [], fio: chave });
                  }}
                />
              </g>
            );
          })}
          {ligando &&
            (() => {
              const de = noPorId.get(ligando.de.no);
              if (!de) return null;
              const a = pontoDaPorta(de, "saida", ligando.de.saida, fluxo.nos);
              return (
                <path
                  className="ed-fio-linha provisorio"
                  data-tipo-fio={ligando.tipo}
                  d={caminhoDoFio(a.x, a.y, ligando.x, ligando.y)}
                />
              );
            })()}
        </svg>
        {fluxo.nos
          .filter((n) => n.em === undefined)
          .map((n) =>
            n.tipo === "caixa" ? (
              <CaixaDaGrade
                key={n.id}
                caixa={n}
                aninhada={false}
                ctx={{
                  nos: fluxo.nos,
                  nomes: p.nomes,
                  selecao: p.selecao,
                  erros: p.erros,
                  mostrarErros: p.mostrarErros,
                  ligandoTipo: ligando?.tipo ?? null,
                  alvo: alvoDeSolta,
                  alvoDeGrupo,
                  arrastando: arrastandoId,
                  aoApertar: aoApertarNo,
                  aoApertarSaida,
                  aoAlternar: p.aoAlternarCaixa,
                  aoAdicionarEspaco: p.aoAdicionarEspaco,
                  aoRemoverEspaco: p.aoRemoverEspaco,
                }}
              />
            ) : (
              <NoDaGrade
                key={n.id}
                no={n}
                nos={fluxo.nos}
                nomes={p.nomes}
                escolhido={p.selecao.nos.includes(n.id)}
                erros={p.erros.filter((e) => e.onde === n.id)}
                mostrarErros={p.mostrarErros || p.selecao.nos.includes(n.id)}
                ligandoTipo={ligando?.tipo ?? null}
                agrupar={alvoDeGrupo === n.id}
                aoApertar={(e) => aoApertarNo(e, n)}
                aoApertarSaida={(e, porta) => aoApertarSaida(e, n, porta)}
              />
            ),
          )}
      </div>

      {fantasma && (
        <div
          className="ed-fantasma"
          data-testid="ed-fantasma"
          style={{ left: fantasma.x + 12, top: fantasma.y + 8 }}
        >
          {fantasma.titulo}
        </div>
      )}

      {caixa && (
        <div
          className="ed-caixa"
          data-testid="ed-caixa"
          style={{
            left: Math.min(caixa.x0, caixa.x1),
            top: Math.min(caixa.y0, caixa.y1),
            width: Math.abs(caixa.x1 - caixa.x0),
            height: Math.abs(caixa.y1 - caixa.y0),
          }}
        />
      )}

      {unico && (
        <div
          className="ed-ligar-caixa"
          style={{
            ...posicaoDeTela(posicaoDoMenu(unico, fluxo.nos).x, posicaoDoMenu(unico, fluxo.nos).y),
            transform: "translateY(calc(-100% - 6px))",
          }}
        >
          {portasDoNo(unico, fluxo.nos).saidas.length > 0 && (
            <button
              type="button"
              className="ed-ligar-botao"
              data-testid="ed-ligar-a"
              aria-expanded={menuLigar}
              aria-haspopup="menu"
              onClick={() => {
                setMenuLigar((m) => !m);
                setMenuCaixa(false);
              }}
            >
              <Link2 size={13} aria-hidden /> Ligar a…
            </button>
          )}
          {podeIrParaCaixa(unico) && (
            <button
              type="button"
              className="ed-ligar-botao"
              data-testid="ed-caixa-menu"
              aria-expanded={menuCaixa}
              aria-haspopup="menu"
              onClick={() => {
                setMenuCaixa((m) => !m);
                setMenuLigar(false);
              }}
            >
              <Boxes size={13} aria-hidden /> Caixa…
            </button>
          )}
          {menuLigar && (
            <MenuLigar
              fluxo={fluxo}
              no={unico}
              nomes={p.nomes}
              aoLigar={(de, para) => {
                p.aoLigar(de, para);
                setMenuLigar(false);
              }}
              aoFechar={() => setMenuLigar(false)}
            />
          )}
          {menuCaixa && (
            <MenuDaCaixa
              fluxo={fluxo}
              no={unico}
              nomes={p.nomes}
              aoEscolher={(destino) => {
                const motivo = p.aoEncaixar(unico.id, destino);
                if (motivo !== null) p.aoAviso(motivo);
                setMenuCaixa(false);
              }}
              aoReordenar={(delta) => {
                p.aoReordenar(unico.id, delta);
                setMenuCaixa(false);
              }}
              aoFechar={() => setMenuCaixa(false)}
            />
          )}
        </div>
      )}

      <div className="ed-zoom" data-testid="ed-zoom">
        <button
          type="button"
          className="botao-icone pequeno"
          data-testid="ed-zoom-menos"
          aria-label="Diminuir o zoom"
          onClick={() => {
            const r = raiz.current?.getBoundingClientRect();
            if (r) zoomEm(1 / 1.25, r.width / 2, r.height / 2);
          }}
        >
          <Minus size={14} aria-hidden />
        </button>
        <span className="ed-zoom-valor" data-testid="ed-zoom-valor">
          {Math.round(vista.k * 100)}%
        </span>
        <button
          type="button"
          className="botao-icone pequeno"
          data-testid="ed-zoom-mais"
          aria-label="Aumentar o zoom"
          onClick={() => {
            const r = raiz.current?.getBoundingClientRect();
            if (r) zoomEm(1.25, r.width / 2, r.height / 2);
          }}
        >
          <Plus size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="botao-icone pequeno"
          data-testid="ed-zoom-ajustar"
          aria-label="Enquadrar tudo na tela"
          title="Enquadrar tudo na tela"
          onClick={ajustar}
        >
          <Maximize2 size={14} aria-hidden />
        </button>
      </div>

      {busca && (
        <BuscaDePecas
          x={busca.cx}
          y={busca.cy}
          aoEscolher={(peca) => {
            p.aoPecaNaGrade(peca, busca.x - LARGURA_DO_NO / 2, busca.y - 30);
            setBusca(null);
          }}
          aoFechar={() => setBusca(null)}
        />
      )}
    </div>
  );
}

// --- Um nó ---------------------------------------------------------------------------------------

function NoDaGrade(p: {
  no: No;
  nos: readonly No[];
  agrupar: boolean;
  nomes: NomesParaAFrase;
  escolhido: boolean;
  erros: readonly ErroDoEditor[];
  mostrarErros: boolean;
  ligandoTipo: "exec" | "valor" | null;
  aoApertar: (e: PonteiroReact<HTMLDivElement>) => void;
  aoApertarSaida: (
    e: PonteiroReact<HTMLElement>,
    porta: { id: string; tipo: "exec" | "valor" },
  ) => void;
}) {
  const { no } = p;
  const portas = portasDoNo(no, p.nos);
  const grupo = grupoDoNo(no, p.nos);
  const rotulo = rotuloDoNo(no, p.nomes);
  const titulo = no.nome ?? rotulo.titulo;
  const detalhe = no.nome === undefined ? rotulo.detalhe : `${rotulo.titulo} · ${rotulo.detalhe}`;
  const comErro = p.erros.length > 0;
  return (
    // biome-ignore lint/a11y/useSemanticElements: o nó tem portas (outros controles) dentro; um <button> não pode ter botões dentro
    <div
      role="button"
      tabIndex={0}
      className="ed-no"
      data-testid={`ed-no-${no.id}`}
      data-no-id={no.id}
      data-grupo={grupo}
      data-tipo={no.tipo}
      data-agrupar={p.agrupar ? "sim" : undefined}
      aria-pressed={p.escolhido}
      aria-invalid={comErro}
      aria-label={`${titulo}. ${detalhe}`}
      style={
        {
          left: no.x,
          top: no.y,
          width: larguraDoNo(no),
          height: alturaDoNo(no, p.nos),
          "--cor-do-grupo": COR_DO_GRUPO[grupo],
        } as CSSProperties
      }
      onPointerDown={p.aoApertar}
    >
      <span className="ed-no-texto">
        <b>{titulo}</b>
        <span>{detalhe}</span>
      </span>
      {comErro && (
        <span className="ed-no-alerta" aria-hidden title={p.erros.map((e) => e.texto).join(" ")}>
          <AlertTriangle size={14} />
        </span>
      )}
      {portas.entradas.map((e, i) => (
        <span
          key={e.id}
          className="ed-porta ed-porta-ent"
          data-lado="entrada"
          data-no={no.id}
          data-porta={e.id}
          data-tipo-fio={e.tipo}
          data-alvo={p.ligandoTipo === e.tipo ? "sim" : undefined}
          data-testid={`ed-porta-${no.id}-${e.id}`}
          title={e.rotulo}
          style={{ top: `${(100 * (i + 1)) / (portas.entradas.length + 1)}%` }}
        >
          {(e.tipo === "valor" || portas.entradas.length > 1) && (
            <span className="ed-porta-rotulo">{e.rotulo}</span>
          )}
        </span>
      ))}
      {portas.saidas.map((s, i) => (
        <span
          key={s.id}
          className="ed-porta ed-porta-sai"
          data-lado="saida"
          data-no={no.id}
          data-porta={s.id}
          data-tipo-fio={s.tipo}
          data-testid={`ed-porta-${no.id}-${s.id}`}
          title={`${s.rotulo}: arraste até uma entrada`}
          style={{ top: `${(100 * (i + 1)) / (portas.saidas.length + 1)}%` }}
          onPointerDown={(ev) => p.aoApertarSaida(ev, s)}
        >
          {portas.saidas.length > 1 && (
            <span className="ed-porta-rotulo" data-saida={s.id}>
              {s.rotulo}
            </span>
          )}
        </span>
      ))}
      {comErro && p.mostrarErros && (
        <span className="ed-no-erros" data-testid={`ed-erro-${no.id}`}>
          {p.erros.map((e) => (
            <span key={e.texto} className="ed-erro" role="alert">
              {e.texto}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

// --- "Ligar a…" ----------------------------------------------------------------------------------

function MenuLigar(p: {
  fluxo: Fluxo;
  no: No;
  nomes: NomesParaAFrase;
  aoLigar: (de: Fio["de"], para: Fio["para"]) => void;
  aoFechar: () => void;
}) {
  const saidas = portasDoNo(p.no, p.fluxo.nos).saidas;
  const grupos = saidas.map((s) => ({
    saida: s,
    alvos: p.fluxo.nos.flatMap((n) =>
      portasDoNo(n, p.fluxo.nos)
        .entradas.filter(
          (e) =>
            e.tipo === s.tipo &&
            podeLigar(p.fluxo, { no: p.no.id, saida: s.id }, { no: n.id, entrada: e.id }).ok,
        )
        .map((e) => ({ no: n, entrada: e })),
    ),
  }));
  return (
    <div
      className="ed-menu-ligar"
      role="menu"
      aria-label="Ligar a…"
      data-testid="ed-menu-ligar"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          p.aoFechar();
        }
      }}
    >
      {grupos.map(({ saida, alvos }) => (
        <div key={saida.id} className="ed-menu-ligar-grupo">
          <span className="ed-menu-ligar-titulo">
            {saidas.length > 1 ? `Saída “${saida.rotulo}” →` : "Saída →"}
          </span>
          {alvos.length === 0 && <span className="nota">Nada a que ligar.</span>}
          {alvos.map(({ no, entrada }) => {
            const r = rotuloDoNo(no, p.nomes);
            return (
              <button
                key={`${no.id}.${entrada.id}`}
                type="button"
                role="menuitem"
                className="ed-menu-item"
                data-testid={`ed-ligar-${saida.id}-${no.id}-${entrada.id}`}
                onClick={() =>
                  p.aoLigar({ no: p.no.id, saida: saida.id }, { no: no.id, entrada: entrada.id })
                }
              >
                {no.nome ?? r.titulo}
                {entrada.tipo === "valor" && portasDoNo(no, p.fluxo.nos).entradas.length > 1
                  ? ` (${entrada.rotulo})`
                  : ""}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// --- A busca de peças (duplo clique na grade) ---------------------------------------------------

function BuscaDePecas(p: {
  x: number;
  y: number;
  aoEscolher: (peca: Peca) => void;
  aoFechar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [indice, setIndice] = useState(0);
  const q = semAcento(texto.trim());
  const achadas = PECAS.filter((x) => {
    if (q === "") return true;
    return semAcento(x.rotulo).includes(q) || semAcento(ROTULO_DO_GRUPO[x.grupo]).includes(q);
  });
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => campo.current?.focus(), []);
  const escolhida = achadas[Math.min(indice, achadas.length - 1)];
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: só impede que o gesto chegue ao fundo da grade (quem age é o campo e a lista)
    <div
      className="ed-busca"
      data-testid="ed-busca"
      style={{ left: p.x, top: p.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <input
        ref={campo}
        type="text"
        className="ed-entrada"
        data-testid="ed-busca-campo"
        aria-label="Buscar uma peça"
        placeholder="Buscar uma peça…"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setIndice(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            p.aoFechar();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndice((i) => Math.min(achadas.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndice((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && escolhida) {
            e.preventDefault();
            p.aoEscolher(escolhida);
          }
        }}
      />
      <div className="ed-busca-lista" role="listbox" aria-label="Peças">
        {achadas.length === 0 && <span className="nota">Nenhuma peça com esse nome.</span>}
        {GRUPOS_DE_PECA.map((g) => {
          const doGrupo = achadas.filter((x) => x.grupo === g);
          if (doGrupo.length === 0) return null;
          return (
            <div key={g} className="ed-busca-grupo">
              <span className="ed-grupo-titulo" style={{ color: COR_DO_GRUPO[g] }}>
                {ROTULO_DO_GRUPO[g]}
              </span>
              {doGrupo.map((peca) => (
                <button
                  key={peca.id}
                  type="button"
                  role="option"
                  aria-selected={escolhida?.id === peca.id}
                  className="ed-menu-item"
                  data-testid={`ed-busca-${peca.id}`}
                  onClick={() => p.aoEscolher(peca)}
                >
                  <span className="ed-ponto" style={{ background: COR_DO_GRUPO[g] }} aria-hidden />
                  {peca.rotulo}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- A caixa (AU3): E, OU e NÃO, como os blocos do Scratch na vertical: espaços um em cima do outro --------------------

type CtxDaCaixa = {
  nos: readonly No[];
  nomes: NomesParaAFrase;
  selecao: Selecao;
  erros: readonly ErroDoEditor[];
  mostrarErros: boolean;
  ligandoTipo: "exec" | "valor" | null;
  alvo: AlvoDeSolta | null;
  alvoDeGrupo: string | null;
  arrastando: string | null;
  aoApertar: (e: PonteiroReact<HTMLElement>, no: No) => void;
  aoApertarSaida: (
    e: PonteiroReact<HTMLElement>,
    no: No,
    porta: { id: string; tipo: "exec" | "valor" },
  ) => void;
  aoAlternar: (id: string) => void;
  aoAdicionarEspaco: (id: string) => void;
  aoRemoverEspaco: (id: string, espaco: number) => void;
};

/** A peça só se mostra, sem portas: ela vive dentro de um espaço da caixa. */
function PecaDentro(p: { no: No; ctx: CtxDaCaixa }) {
  const { no, ctx } = p;
  const grupo = grupoDoNo(no, ctx.nos);
  const rotulo = rotuloDoNo(no, ctx.nomes);
  const titulo = no.nome ?? rotulo.titulo;
  const detalhe = no.nome === undefined ? rotulo.detalhe : `${rotulo.titulo} · ${rotulo.detalhe}`;
  const erros = ctx.erros.filter((e) => e.onde === no.id);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a peça se arrasta e se escolhe; um <button> não deixa o ponteiro arrastar com folga
    <div
      role="button"
      tabIndex={0}
      className="ed-no-dentro"
      data-testid={`ed-no-${no.id}`}
      data-no-id={no.id}
      data-grupo={grupo}
      data-tipo={no.tipo}
      data-guardado="sim"
      aria-pressed={ctx.selecao.nos.includes(no.id)}
      aria-invalid={erros.length > 0}
      aria-label={`${titulo}. ${detalhe}. Dentro de uma caixa`}
      style={{ "--cor-do-grupo": COR_DO_GRUPO[grupo] } as CSSProperties}
      onPointerDown={(e) => ctx.aoApertar(e, no)}
    >
      <span className="ed-no-texto">
        <b>{titulo}</b>
        <span>{detalhe}</span>
      </span>
      {erros.length > 0 && (
        <span
          className="ed-no-alerta dentro"
          aria-hidden
          title={erros.map((e) => e.texto).join(" ")}
        >
          <AlertTriangle size={12} />
        </span>
      )}
    </div>
  );
}

const DICA_DO_ESPACO = "solte aqui um gatilho, uma condição, uma ação ou outra caixa";

function CaixaDaGrade(p: { caixa: No; aninhada: boolean; ctx: CtxDaCaixa }) {
  const { caixa, ctx, aninhada } = p;
  if (caixa.tipo !== "caixa") return null;
  const nao = caixa.config.porta === "nao";
  const n = numeroDeEspacos(ctx.nos, caixa.id);
  const portas = portasDoNo(caixa, ctx.nos);
  const escolhida = ctx.selecao.nos.includes(caixa.id);
  const erros = ctx.erros.filter((e) => e.onde === caixa.id);
  const comErro = erros.length > 0;
  const alvo = ctx.alvo?.caixa === caixa.id ? ctx.alvo : null;
  const recusa = alvo !== null && alvo.motivo !== null;
  const marca = (cond: boolean) => (cond ? (recusa ? "recusa" : "ok") : undefined);
  const grupo = grupoDoNo(caixa, ctx.nos);
  const tipo = conteudoDaCaixa(ctx.nos, caixa.id);
  const titulo = caixa.nome ?? NOMES_DAS_CAIXAS[caixa.config.porta];
  const detalhe = detalheDaCaixa(ctx.nos, caixa);
  const altura = alturaDoNo(caixa, ctx.nos);
  const rotulo = NOMES_DAS_CAIXAS[caixa.config.porta];
  const slot = (i: number) => {
    const peca = pecaDoEspaco(ctx.nos, caixa.id, i);
    const h = peca ? alturaDoNo(peca, ctx.nos) : ALTURA_DO_ESPACO_VAZIO;
    const marcado = alvo !== null && "espaco" in alvo.destino && alvo.destino.espaco === i;
    return (
      <div
        key={`e${i}`}
        className="ed-espaco"
        data-testid={`ed-espaco-${caixa.id}-${i}`}
        data-espaco-de={caixa.id}
        data-espaco={i}
        data-vazio={peca ? undefined : "sim"}
        data-solta={marca(marcado)}
        style={{ height: h }}
      >
        {peca === undefined && <span className="ed-espaco-dica">{DICA_DO_ESPACO}</span>}
        {peca === undefined && !nao && n > MINIMO_DE_ESPACOS && (
          <button
            type="button"
            className="ed-espaco-x"
            data-testid={`ed-espaco-x-${caixa.id}-${i}`}
            aria-label="Tirar este espaço"
            title="Tirar este espaço"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => ctx.aoRemoverEspaco(caixa.id, i)}
          >
            <X size={12} aria-hidden />
          </button>
        )}
        {peca !== undefined &&
          (peca.tipo === "caixa" ? (
            <CaixaDaGrade caixa={peca} aninhada ctx={ctx} />
          ) : (
            <PecaDentro no={peca} ctx={ctx} />
          ))}
      </div>
    );
  };
  const filhos: ReactNode[] = [];
  if (nao) {
    filhos.push(
      <div key="rot" className="ed-caixa-rotulo nao" data-testid={`ed-rotulo-${caixa.id}`}>
        {rotulo}
      </div>,
      slot(0),
    );
  } else {
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        filhos.push(
          <div
            key={`s${i}`}
            className="ed-caixa-separador"
            data-separador-de={caixa.id}
            data-antes-de={i}
            data-solta={marca(
              alvo !== null && "inserirEm" in alvo.destino && alvo.destino.inserirEm === i,
            )}
          >
            <button
              type="button"
              className="ed-caixa-rotulo"
              data-testid={`ed-rotulo-${caixa.id}-${i}`}
              title={`Trocar ${rotulo} por ${caixa.config.porta === "e" ? "OU" : "E"} (vale para a caixa inteira)`}
              aria-label={`${rotulo}: clique para trocar por ${caixa.config.porta === "e" ? "OU" : "E"}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => ctx.aoAlternar(caixa.id)}
            >
              {rotulo}
            </button>
          </div>,
        );
      }
      filhos.push(slot(i));
    }
    filhos.push(
      <div
        key="pe"
        className="ed-caixa-pe"
        data-fim-de={caixa.id}
        data-numero={n}
        data-solta={marca(
          alvo !== null && "inserirEm" in alvo.destino && alvo.destino.inserirEm === n,
        )}
      >
        <button
          type="button"
          className="ed-caixa-mais"
          data-testid={`ed-mais-${caixa.id}`}
          disabled={n >= MAXIMO_DE_ESPACOS}
          title={
            n >= MAXIMO_DE_ESPACOS ? "A caixa já tem o máximo de espaços" : "Acrescentar um espaço"
          }
          aria-label="Acrescentar um espaço"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => ctx.aoAdicionarEspaco(caixa.id)}
        >
          <Plus size={12} aria-hidden />
        </button>
      </div>,
    );
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: a caixa tem peças e portas (outros controles) dentro; um <button> não pode
    <div
      role="button"
      tabIndex={0}
      className={`ed-no ed-caixa-logica${aninhada ? " aninhada" : ""}`}
      data-testid={`ed-no-${caixa.id}`}
      data-no-id={caixa.id}
      data-caixa-id={caixa.id}
      data-grupo={grupo}
      data-tipo="caixa"
      data-logica={caixa.config.porta}
      data-saida={tipo}
      data-espacos={n}
      data-guardado={aninhada ? "sim" : undefined}
      data-solta={alvo ? (recusa ? "recusa" : "ok") : undefined}
      aria-pressed={escolhida}
      aria-invalid={comErro}
      aria-label={`Caixa ${titulo}, ${n} ${n === 1 ? "espaço" : "espaços"}. ${detalhe}`}
      style={
        {
          ...(aninhada ? {} : { left: caixa.x, top: caixa.y, width: larguraDoNo(caixa, ctx.nos) }),
          height: altura,
          "--cor-do-grupo": COR_DO_GRUPO[grupo],
        } as CSSProperties
      }
      onPointerDown={(e) => ctx.aoApertar(e, caixa)}
    >
      {filhos}
      {alvo?.motivo != null && (
        <span className="ed-solta-dica" role="status" data-testid="ed-solta-dica">
          {alvo.motivo}
        </span>
      )}
      {comErro && (
        <span className="ed-no-alerta" aria-hidden title={erros.map((e) => e.texto).join(" ")}>
          <AlertTriangle size={14} />
        </span>
      )}
      {portas.entradas.map((e) => (
        <span
          key={e.id}
          className="ed-porta ed-porta-ent"
          data-lado="entrada"
          data-no={caixa.id}
          data-porta={e.id}
          data-tipo-fio={e.tipo}
          data-alvo={ctx.ligandoTipo === e.tipo ? "sim" : undefined}
          data-testid={`ed-porta-${caixa.id}-${e.id}`}
          title={e.rotulo}
          style={{ top: "50%" }}
        />
      ))}
      {portas.saidas.map((s) => (
        <span
          key={s.id}
          className="ed-porta ed-porta-sai"
          data-lado="saida"
          data-no={caixa.id}
          data-porta={s.id}
          data-tipo-fio={s.tipo}
          data-testid={`ed-porta-${caixa.id}-${s.id}`}
          title={`${s.rotulo}: arraste até uma entrada`}
          style={{ top: "50%" }}
          onPointerDown={(ev) => ctx.aoApertarSaida(ev, caixa, s)}
        />
      ))}
      {comErro && (ctx.mostrarErros || escolhida) && !aninhada && (
        <span className="ed-no-erros" data-testid={`ed-erro-${caixa.id}`}>
          {erros.map((e) => (
            <span key={e.texto} className="ed-erro" role="alert">
              {e.texto}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/** Onde o menu "Ligar a… / Caixa…" fica: em cima da caixa de fora, para a peça guardada. */
function posicaoDoMenu(no: No, nos: readonly No[]): { x: number; y: number } {
  let atual = no;
  for (let i = 0; i < 8 && atual.em !== undefined; i++) {
    const pai = nos.find((n) => n.id === atual.em);
    if (!pai) break;
    atual = pai;
  }
  return { x: atual.x, y: atual.y };
}

const podeIrParaCaixa = (no: No): boolean =>
  no.tipo === "gatilho" || no.tipo === "condicao" || no.tipo === "caixa";

/** O caminho do teclado para as caixas: tirar a peça da caixa, pô-la num espaço de uma caixa e subir ou descer. */
function MenuDaCaixa(p: {
  fluxo: Fluxo;
  no: No;
  nomes: NomesParaAFrase;
  aoEscolher: (destino: DestinoDaPeca) => void;
  aoReordenar: (delta: -1 | 1) => void;
  aoFechar: () => void;
}) {
  const nos = p.fluxo.nos;
  const pai = p.no.em === undefined ? undefined : nos.find((n) => n.id === p.no.em);
  const raiz = pai ? posicaoDoMenu(pai, nos) : { x: p.no.x, y: p.no.y };
  const espaco = p.no.espaco ?? 0;
  const total = pai ? numeroDeEspacos(nos, pai.id) : 0;
  const caixas = nos.filter((n) => n.tipo === "caixa" && n.id !== p.no.id);
  const opcoes: { id: string; texto: string; destino: DestinoDaPeca; motivo: string | null }[] = [];
  for (const c of caixas) {
    if (c.tipo !== "caixa") continue;
    const nome = nomeDaCaixaNoMenu(nos, c, p.nomes);
    const tem = numeroDeEspacos(nos, c.id);
    for (let i = 0; i < tem; i++) {
      if (pecaDoEspaco(nos, c.id, i) !== undefined || (c.id === p.no.em && i === espaco)) continue;
      opcoes.push({
        id: `ed-caixa-por-${c.id}-${i}`,
        texto: `Pôr em ${nome}, espaço ${i + 1}`,
        destino: { tipo: "caixa", caixa: c.id, espaco: i },
        motivo: motivoDaRecusa(nos, p.no.id, c.id, { espaco: i }),
      });
    }
    if (c.config.porta !== "nao") {
      opcoes.push({
        id: `ed-caixa-novo-${c.id}`,
        texto: `Pôr em ${nome}, num espaço novo no fim`,
        destino: { tipo: "caixa", caixa: c.id, inserirEm: tem },
        motivo: motivoDaRecusa(nos, p.no.id, c.id, { inserirEm: tem }),
      });
    }
  }
  return (
    <div
      className="ed-menu-ligar"
      role="menu"
      aria-label="Caixa…"
      data-testid="ed-menu-caixa"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          p.aoFechar();
        }
      }}
    >
      {pai && (
        <>
          <button
            type="button"
            role="menuitem"
            className="ed-menu-item"
            data-testid="ed-caixa-tirar"
            onClick={() =>
              p.aoEscolher({
                tipo: "grade",
                x: Math.round(raiz.x + LARGURA_DO_NO + 80),
                y: Math.round(raiz.y),
              })
            }
          >
            Tirar da caixa
          </button>
          {espaco > 0 && (
            <button
              type="button"
              role="menuitem"
              className="ed-menu-item"
              data-testid="ed-caixa-subir"
              onClick={() => p.aoReordenar(-1)}
            >
              Subir um espaço
            </button>
          )}
          {espaco < total - 1 && (
            <button
              type="button"
              role="menuitem"
              className="ed-menu-item"
              data-testid="ed-caixa-descer"
              onClick={() => p.aoReordenar(1)}
            >
              Descer um espaço
            </button>
          )}
        </>
      )}
      {opcoes.length === 0 && !pai && <span className="nota">Nenhuma caixa na grade ainda.</span>}
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="menuitem"
          className="ed-menu-item"
          data-testid={o.id}
          aria-disabled={o.motivo !== null}
          title={o.motivo ?? undefined}
          onClick={() => {
            if (o.motivo === null) p.aoEscolher(o.destino);
          }}
        >
          {o.texto}
          {o.motivo !== null && <span className="ed-menu-motivo"> — {o.motivo}</span>}
        </button>
      ))}
    </div>
  );
}
