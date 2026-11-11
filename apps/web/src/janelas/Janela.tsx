import { Maximize2, Minus, X } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { BotaoComDica } from "../BotaoComDica";
import { Dica, useDica } from "../Dica";
import { gravarJanela, lerJanela, type PreferenciaDeJanela } from "../preferencias";
import { limitarNaArea, limitarTamanho, noCanto, type Padrao, type Tam } from "./geometria";
import { BASE_DO_Z, sairDaPilha, trazerParaFrente, usePosicaoNaPilha } from "./pilha";

/** Passo das setas com o cabeçalho focado (Shift = o maior). */
const PASSO = 8;
const PASSO_GRANDE = 40;

type Props = {
  /** Identifica a janela na preferência (`tabletop:pref:janela:<id>`) e na pilha. Ex.: `ordem`, `ficha:pers-x`. */
  id: string;
  /** O nome da janela (leitores de tela e dicas). */
  titulo: string;
  /** Ícone ao lado do título padrão do cabeçalho. */
  icone?: ReactNode;
  /** Troca o título padrão (ícone e nome) do cabeçalho. */
  cabecalho?: ReactNode;
  /** Controles extras do cabeçalho, antes dos botões de minimizar e fechar. */
  acoes?: ReactNode;
  /** Mostra o botão "Fechar" no cabeçalho. Sem isso a janela não fecha por ela mesma. */
  aoFechar?: () => void;
  rotuloDoFechar?: string;
  /** `data-testid` que o elemento da janela já tinha antes do R3 (o `janela-<id>` fica no contêiner). */
  testid?: string;
  testidDoCabecalho?: string;
  testidDoFechar?: string;
  testidDoRedimensionar?: string;
  /** Atributos `data-*` extras no elemento do `testid`. */
  dados?: Record<`data-${string}`, string | undefined>;
  /** Onde a janela abre na primeira vez (e enquanto a pessoa não a move). Padrão: canto de cima à esquerda. */
  padrao?: Padrao;
  /** Largura (px) quando a pessoa não escolheu uma; função da área do mapa. */
  largura?: number | ((area: Tam) => number);
  altura?: number | ((area: Tam) => number);
  /** Altura máxima em CSS (padrão: a da área). */
  alturaMaxima?: string;
  /** Pela quina (`ambos`), só pela borda de baixo (`altura`) ou sem redimensionar. */
  redimensionar?: false | "altura" | "ambos";
  minLargura?: number;
  minAltura?: number;
  /** Classe do miolo da janela (do cabeçalho ao corpo). */
  classe?: string;
  /** Classe do corpo (o que as janelas tinham no contêiner antes do R3). */
  classeDoCorpo?: string;
  /** O corpo não rola nem tem espaçamento: quem usa cuida disso (a ficha, com abas). */
  corpoLivre?: boolean;
  children: ReactNode;
};

type Gesto = {
  tipo: "mover" | "ambos" | "altura";
  px: number;
  py: number;
  x0: number;
  y0: number;
  l0: number;
  a0: number;
};

const valorDe = (v: number | ((a: Tam) => number) | undefined, area: Tam): number | undefined =>
  typeof v === "function" ? v(area) : v;

const mesmoTam = (a: Tam | null, b: Tam) =>
  a !== null && a.largura === b.largura && a.altura === b.altura;

/**
 * Janela flutuante da mesa (R3): o contêiner único de tudo o que abre sobre o mapa. Arrasta pelo
 * cabeçalho (ou pelas setas, com ele focado), dois cliques no cabeçalho minimizam e restauram, a última
 * clicada fica por cima, e vive sempre dentro da área do mapa. Posição, tamanho e minimizada são de cada
 * pessoa, no navegador (`tabletop:pref:janela:<id>`), e nunca vão para a sala. Esc não fecha (é da seleção).
 *
 * Renderiza dentro da área do mapa (`data-area-do-mapa`) por um portal, de onde vier.
 */
export function Janela(props: Props) {
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setAlvo(document.querySelector<HTMLElement>("[data-area-do-mapa]"));
  }, []);
  if (!alvo) return null;
  return createPortal(<JanelaNaArea key={props.id} alvo={alvo} {...props} />, alvo);
}

function JanelaNaArea({ alvo, ...p }: Props & { alvo: HTMLElement }) {
  const { id } = p;
  const elemento = useRef<HTMLElement>(null);
  const prefAtual = useRef<PreferenciaDeJanela>(lerJanela(id));
  const [pref, setPref] = useState<PreferenciaDeJanela>(prefAtual.current);
  const [area, setArea] = useState<Tam>({ largura: alvo.clientWidth, altura: alvo.clientHeight });
  const [medida, setMedida] = useState<Tam | null>(null);
  const gesto = useRef<Gesto | null>(null);
  const posicao = usePosicaoNaPilha(id);

  // Entra na pilha por cima ao abrir; sai ao fechar.
  useLayoutEffect(() => {
    trazerParaFrente(id);
    return () => sairDaPilha(id);
  }, [id]);

  // A área do mapa (janela do navegador, painel direito ajustado ou recolhido) e a janela mudam de tamanho.
  useLayoutEffect(() => {
    const el = elemento.current;
    const mede = () => {
      const a = { largura: alvo.clientWidth, altura: alvo.clientHeight };
      setArea((antes) => (mesmoTam(antes, a) ? antes : a));
      if (el) {
        const m = { largura: el.offsetWidth, altura: el.offsetHeight };
        setMedida((antes) => (mesmoTam(antes, m) ? antes : m));
      }
    };
    mede();
    const obs = new ResizeObserver(mede);
    obs.observe(alvo);
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [alvo]);

  function atualizar(mudancas: Partial<PreferenciaDeJanela>, gravar: boolean) {
    const nova = { ...prefAtual.current, ...mudancas };
    if (mudancas.minimizada === false) delete nova.minimizada;
    prefAtual.current = nova;
    setPref(nova);
    if (gravar) gravarJanela(id, nova);
  }

  const minimizada = pref.minimizada === true;
  const tam = medida ?? { largura: 0, altura: 0 };
  const largura = pref.largura ?? valorDe(p.largura, area);
  const altura = pref.altura ?? valorDe(p.altura, area);
  const escolha =
    pref.x !== undefined && pref.y !== undefined
      ? { x: pref.x, y: pref.y }
      : (p.padrao ?? noCanto("topo-esquerda"))(area, tam);
  // O que a pessoa escolheu fica guardado; o que se vê é empurrado para dentro da área.
  const { x, y } = limitarNaArea(escolha, tam, area);

  const minL = p.minLargura ?? 240;
  const minA = p.minAltura ?? 120;

  // --- gestos -------------------------------------------------------------------------------
  function iniciar(tipo: Gesto["tipo"], e: PointerEvent) {
    if (e.button !== 0) return;
    trazerParaFrente(id);
    gesto.current = {
      tipo,
      px: e.clientX,
      py: e.clientY,
      x0: x,
      y0: y,
      l0: tam.largura,
      a0: tam.altura,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function seguir(e: PointerEvent) {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    if (g.tipo === "mover") {
      atualizar(limitarNaArea({ x: g.x0 + dx, y: g.y0 + dy }, tam, area), false);
      return;
    }
    atualizar(
      {
        // a posição de hoje passa a ser a escolhida (senão uma janela presa ao canto andaria)
        x: g.x0,
        y: g.y0,
        ...(g.tipo === "ambos"
          ? { largura: limitarTamanho(g.l0 + dx, minL, area.largura - g.x0) }
          : {}),
        altura: limitarTamanho(g.a0 + dy, minA, area.altura - g.y0),
      },
      false,
    );
  }
  function soltar(e: PointerEvent) {
    if (!gesto.current) return;
    gesto.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    gravarJanela(id, prefAtual.current);
  }
  const alternar = () => atualizar({ minimizada: !minimizada }, true);
  const cabecalho = useRef<HTMLElement>(null);
  const dicaDoCabecalho = useDica();
  const ehControle = (e: { target: EventTarget }) =>
    (e.target as Element).closest("button, input, select, textarea, a") !== null;

  function aoTeclar(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    const passo = e.shiftKey ? PASSO_GRANDE : PASSO;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-passo, 0],
      ArrowRight: [passo, 0],
      ArrowUp: [0, -passo],
      ArrowDown: [0, passo],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    atualizar(limitarNaArea({ x: x + d[0], y: y + d[1] }, tam, area), true);
  }

  const estilo: CSSProperties = {
    left: x,
    top: y,
    zIndex: BASE_DO_Z + Math.max(0, posicao),
    ...(largura !== undefined ? { width: largura } : {}),
    ...(altura !== undefined && !minimizada ? { height: altura } : {}),
    // Janela redimensionável nos dois eixos tem um piso (sem passar do que a área comporta).
    ...(p.redimensionar === "ambos"
      ? {
          minWidth: `min(${minL}px, 100%)`,
          ...(minimizada ? {} : { minHeight: `min(${minA}px, 100%)` }),
        }
      : {}),
    ...(p.alturaMaxima ? { maxHeight: p.alturaMaxima } : {}),
    // Até medir a janela (um instante, antes de pintar) ela fica invisível, para não pular.
    ...(medida === null ? { visibility: "hidden" } : {}),
  };
  const nome = p.titulo;

  return (
    <section
      ref={elemento}
      className="janela"
      role="dialog"
      aria-label={nome}
      data-testid={`janela-${id}`}
      data-minimizada={minimizada}
      style={estilo}
      onPointerDownCapture={() => trazerParaFrente(id)}
    >
      <div className={`janela-miolo ${p.classe ?? ""}`} data-testid={p.testid} {...p.dados}>
        <header
          ref={cabecalho}
          className="janela-cabecalho"
          role="toolbar"
          aria-label={`${nome}: arraste para mover, ou use as setas`}
          tabIndex={0}
          data-testid={p.testidDoCabecalho ?? `janela-${id}-cabecalho`}
          aria-describedby={dicaDoCabecalho.id}
          onMouseOver={(e) =>
            ehControle(e) ? dicaDoCabecalho.esconder() : dicaDoCabecalho.mostrar()
          }
          onMouseLeave={dicaDoCabecalho.esconder}
          onFocus={(e) => e.target === e.currentTarget && dicaDoCabecalho.mostrar()}
          onBlur={dicaDoCabecalho.esconder}
          onPointerDown={(e) => {
            dicaDoCabecalho.esconder();
            // Botões e campos do cabeçalho não arrastam.
            if (ehControle(e)) return;
            iniciar("mover", e);
          }}
          onPointerMove={seguir}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onDoubleClick={(e) => {
            if (!ehControle(e)) alternar();
          }}
          onKeyDown={(e) => {
            dicaDoCabecalho.aoTeclar(e);
            aoTeclar(e);
          }}
        >
          <div className="janela-titulo">
            {p.cabecalho ?? (
              <>
                {p.icone}
                <strong>{nome}</strong>
              </>
            )}
          </div>
          {p.acoes}
          <BotaoComDica
            className="botao-icone pequeno"
            testid={`janela-${id}-minimizar`}
            nome={minimizada ? "Restaurar" : "Minimizar"}
            dica={minimizada ? "Mostra a janela inteira de novo." : "Deixa só a barra do título."}
            aria-label={`${minimizada ? "Restaurar" : "Minimizar"} ${nome}`}
            onClick={alternar}
          >
            {minimizada ? <Maximize2 size={14} /> : <Minus size={16} />}
          </BotaoComDica>
          {p.aoFechar && (
            <BotaoComDica
              className="botao-icone pequeno"
              testid={p.testidDoFechar ?? `janela-${id}-fechar`}
              nome="Fechar"
              aria-label={p.rotuloDoFechar ?? `Fechar ${nome}`}
              onClick={p.aoFechar}
            >
              <X size={16} />
            </BotaoComDica>
          )}
        </header>
        <Dica
          alvo={cabecalho}
          id={dicaDoCabecalho.id}
          visivel={dicaDoCabecalho.visivel}
          testid={`dica-janela-${id}-cabecalho`}
          nome="Mover a janela"
          texto="Arraste pelo cabeçalho. Dois cliques minimizam ou restauram."
          atalho="janelaMover"
        />

        <div
          className={`janela-conteudo${p.corpoLivre ? "" : " janela-corpo"} ${p.classeDoCorpo ?? ""}`}
          hidden={minimizada}
        >
          {p.children}
        </div>

        {!minimizada && p.redimensionar === "ambos" && (
          // biome-ignore lint/a11y/useSemanticElements: a alça de redimensionar é só um ponto de arrasto
          <div
            className="janela-alca"
            role="separator"
            aria-label="Redimensionar a janela"
            data-testid={p.testidDoRedimensionar ?? `janela-${id}-redimensionar`}
            onPointerDown={(e) => iniciar("ambos", e)}
            onPointerMove={seguir}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          />
        )}
        {!minimizada && p.redimensionar === "altura" && (
          // biome-ignore lint/a11y/useSemanticElements: a borda de baixo é só um ponto de arrasto
          <div
            className="janela-borda-baixo"
            role="separator"
            aria-label="Ajustar a altura da janela"
            data-testid={p.testidDoRedimensionar ?? `janela-${id}-redimensionar`}
            onPointerDown={(e) => iniciar("altura", e)}
            onPointerMove={seguir}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          />
        )}
      </div>
    </section>
  );
}
