import {
  type Fio,
  type Fluxo,
  type No,
  type NomesParaAFrase,
  podeLigar,
  portasDoNo,
} from "@tabletop/shared";
import { AlertTriangle, Link2, Maximize2, Minus, Plus } from "lucide-react";
import {
  type CSSProperties,
  type DragEvent,
  type PointerEvent as PonteiroReact,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  alturaDoNo,
  COR_DO_GRUPO,
  caminhoDoFio,
  chaveDoFio,
  type ErroDoEditor,
  GRUPOS_DE_PECA,
  grupoDoNo,
  LARGURA_DO_NO,
  limitesDosNos,
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
        .filter((n) => n.x < x1 && n.x + LARGURA_DO_NO > x0 && n.y < y1 && n.y + alturaDoNo(n) > y0)
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

  function aoSoltarPeca(e: DragEvent<HTMLDivElement>) {
    const id = e.dataTransfer.getData("text/x-peca");
    if (!id) return;
    e.preventDefault();
    const peca = PECAS.find((x) => x.id === id);
    if (!peca) return;
    const g = naGrade(e.clientX, e.clientY);
    p.aoPecaNaGrade(peca, g.x - LARGURA_DO_NO / 2, g.y - 30);
  }

  // --- Mover nós ---

  function aoApertarNo(e: PonteiroReact<HTMLDivElement>, no: No) {
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
    const comeco = new Map(
      fluxo.nos.filter((n) => sel.nos.includes(n.id)).map((n) => [n.id, { x: n.x, y: n.y }]),
    );
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moveu = false;
    const mover = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!moveu) {
        if (Math.hypot(dx, dy) < 4) return;
        moveu = true;
        propsRef.current.aoMoverNos("comecou");
      }
      const k = vistaRef.current.k;
      const novas = new Map<string, { x: number; y: number }>();
      for (const [id, o] of comeco) {
        novas.set(id, { x: Math.round(o.x + dx / k), y: Math.round(o.y + dy / k) });
      }
      propsRef.current.aoMoverNos("moveu", novas);
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      if (moveu) propsRef.current.aoMoverNos("terminou");
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
          ? portasDoNo(alvo).entradas.find(
              (x) => x.tipo === porta.tipo && podeLigar(f, de, { no: alvo.id, entrada: x.id }).ok,
            )
          : undefined;
        if (alvo && entrada) para = { no: alvo.id, entrada: entrada.id };
        else if (alvo) {
          const qualquer = portasDoNo(alvo).entradas.find((x) => x.tipo === porta.tipo);
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
    if (!unico) setMenuLigar(false);
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
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("text/x-peca")) e.preventDefault();
      }}
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
            const a = pontoDaPorta(de, "saida", f.de.saida);
            const b = pontoDaPorta(para, "entrada", f.para.entrada);
            const chave = chaveDoFio(f);
            const tipo = portasDoNo(de).saidas.find((s) => s.id === f.de.saida)?.tipo ?? "exec";
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
              const a = pontoDaPorta(de, "saida", ligando.de.saida);
              return (
                <path
                  className="ed-fio-linha provisorio"
                  data-tipo-fio={ligando.tipo}
                  d={caminhoDoFio(a.x, a.y, ligando.x, ligando.y)}
                />
              );
            })()}
        </svg>
        {fluxo.nos.map((n) => (
          <NoDaGrade
            key={n.id}
            no={n}
            nomes={p.nomes}
            escolhido={p.selecao.nos.includes(n.id)}
            erros={p.erros.filter((e) => e.onde === n.id)}
            mostrarErros={p.mostrarErros || p.selecao.nos.includes(n.id)}
            ligandoTipo={ligando?.tipo ?? null}
            aoApertar={(e) => aoApertarNo(e, n)}
            aoApertarSaida={(e, porta) => aoApertarSaida(e, n, porta)}
          />
        ))}
      </div>

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
          style={{ ...posicaoDeTela(unico.x, unico.y), transform: "translateY(calc(-100% - 6px))" }}
        >
          <button
            type="button"
            className="ed-ligar-botao"
            data-testid="ed-ligar-a"
            aria-expanded={menuLigar}
            aria-haspopup="menu"
            onClick={() => setMenuLigar((m) => !m)}
          >
            <Link2 size={13} aria-hidden /> Ligar a…
          </button>
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
  const portas = portasDoNo(no);
  const grupo = grupoDoNo(no);
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
      aria-pressed={p.escolhido}
      aria-invalid={comErro}
      aria-label={`${titulo}. ${detalhe}`}
      style={
        {
          left: no.x,
          top: no.y,
          width: LARGURA_DO_NO,
          height: alturaDoNo(no),
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
  const saidas = portasDoNo(p.no).saidas;
  const grupos = saidas.map((s) => ({
    saida: s,
    alvos: p.fluxo.nos.flatMap((n) =>
      portasDoNo(n)
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
                {entrada.tipo === "valor" && portasDoNo(no).entradas.length > 1
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
