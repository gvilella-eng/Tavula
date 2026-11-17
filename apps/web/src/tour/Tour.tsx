import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { type Passo, textoDoPasso } from "./passos";
import { posicionarCartao, type Retangulo } from "./posicao";

/** Quanto o tour espera o alvo aparecer (a aba abrindo, o painel animando) antes de pular o passo. */
const ESPERA_DO_ALVO_MS = 1500;
const RESPIRO = 4;

type Props = {
  passos: readonly Passo[];
  /** Abre uma aba do painel da direita (o alvo do passo mora nela). */
  abrirAba: (abaId: string) => void;
  /** O tour acabou: terminou o último passo (`concluido`) ou foi pulado (Pular ou Esc). */
  aoFechar: (concluido: boolean) => void;
};

function achar(alvo: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${alvo}"]`);
}

/** O retângulo do alvo, ou `null` se ele não está à vista (escondido ou sem tamanho). */
function medir(el: HTMLElement | null): Retangulo | null {
  if (!el?.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

const mudou = (a: Retangulo | null, b: Retangulo | null) =>
  a === null || b === null
    ? a !== b
    : Math.abs(a.x - b.x) > 0.5 ||
      Math.abs(a.y - b.y) > 0.5 ||
      Math.abs(a.w - b.w) > 0.5 ||
      Math.abs(a.h - b.h) > 0.5;

const FOCAVEIS = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled])";

/**
 * O tour de introdução, feito aqui (sem biblioteca). A tela escurece com um "buraco" no alvo do passo, contornado no
 * acento, e um cartão curto fica perto dele: título, texto, Voltar, Próximo n/N e Pular. É um diálogo modal:
 * o foco fica preso no cartão, → e Enter avançam, ← volta, Esc pula, e o leitor de tela lê o título e o texto
 * (`role="dialog"` e `aria-live`). Passo cujo alvo não aparece é pulado: o tour nunca trava.
 */
export function Tour({ passos, abrirAba, aoFechar }: Props) {
  const [indice, setIndice] = useState(0);
  const [alvo, setAlvo] = useState<Retangulo | null>(null);
  const [pronto, setPronto] = useState(false);
  const [janela, setJanela] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [posicao, setPosicao] = useState({ x: 12, y: 12 });
  const cartao = useRef<HTMLDivElement>(null);
  const proximo = useRef<HTMLButtonElement>(null);
  // Para onde o tour anda (±1): um passo sem alvo à vista é pulado nessa direção.
  const direcao = useRef<1 | -1>(1);
  const idTitulo = useId();
  const idTexto = useId();

  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;

  const ir = useCallback((delta: 1 | -1) => {
    direcao.current = delta;
    setPronto(false);
    setIndice((i) => Math.max(0, i + delta));
  }, []);

  const avancar = useCallback(() => {
    if (ultimo) aoFechar(true);
    else ir(1);
  }, [ultimo, aoFechar, ir]);

  const voltar = useCallback(() => {
    if (indice > 0) ir(-1);
  }, [indice, ir]);

  // Chegou num passo: abre a aba, espera o alvo e depois o acompanha (a janela, o painel e a rolagem mudam).
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando o passo muda
  useEffect(() => {
    if (!passo) return;
    let desistiu = false;
    let acompanhar: number | undefined;
    let observador: ResizeObserver | undefined;

    function pular() {
      if (desistiu) return;
      if (direcao.current === 1) {
        if (indice >= passos.length - 1) aoFechar(true);
        else setIndice(indice + 1);
      } else if (indice > 0) {
        setIndice(indice - 1);
      } else {
        direcao.current = 1;
        setIndice(1);
      }
    }

    if (passo.alvo === null) {
      setAlvo(null);
      setPronto(true);
      return;
    }
    if (passo.aba) abrirAba(passo.aba);
    const alvoId = passo.alvo;
    const inicio = performance.now();
    const procurar = () => {
      if (desistiu) return;
      const el = achar(alvoId);
      // Q8: o alvo pode morar num cartão fechado (aba Mesa, "Pessoas" > Contas): abre os cartões em volta antes de medir.
      for (let d = el?.closest("details"); d; d = d.parentElement?.closest("details")) {
        if (!d.open) d.open = true;
      }
      if (el && medir(el)) {
        // Alvo cortado pela janela ou pelo painel que rola (uma seção lá embaixo na aba Mesa): sobe até o começo dele.
        const antes = el.getBoundingClientRect();
        if (antes.top < 0 || antes.bottom > window.innerHeight) {
          el.scrollIntoView({ block: "start", inline: "nearest" });
        }
        setAlvo(medir(el));
        setPronto(true);
        observador = new ResizeObserver(() => {
          const novo = medir(el);
          setAlvo((antes) => (mudou(antes, novo) ? novo : antes));
        });
        observador.observe(el);
        acompanhar = window.setInterval(() => {
          const novo = medir(el);
          setAlvo((antes) => (mudou(antes, novo) ? novo : antes));
        }, 250);
        return;
      }
      if (performance.now() - inicio > ESPERA_DO_ALVO_MS) {
        pular();
        return;
      }
      window.setTimeout(procurar, 60);
    };
    procurar();
    return () => {
      desistiu = true;
      if (acompanhar !== undefined) window.clearInterval(acompanhar);
      observador?.disconnect();
    };
  }, [indice]);

  // O tamanho da janela (a de 1280×720 é a mais apertada).
  useEffect(() => {
    const aoRedimensionar = () => setJanela({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  // O cartão perto do alvo, sempre inteiro na janela.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refaz quando o alvo, o passo ou a janela mudam
  useLayoutEffect(() => {
    const c = cartao.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    setPosicao(posicionarCartao(alvo, { w: r.width, h: r.height }, janela));
  }, [alvo, janela, indice, pronto]);

  // O foco: entra no cartão (em "Próximo", para o Enter seguir) e, ao fechar, volta para onde estava.
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    proximo.current?.focus();
    return () => {
      if (antes?.isConnected) antes.focus({ preventScroll: true });
    };
  }, []);

  // O teclado: → e Enter avançam, ← volta, Esc pula, Tab fica no cartão. As outras teclas não chegam ao app (as
  // letras de ferramenta, por exemplo, não mudam a ferramenta por baixo do véu).
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const c = cartao.current;
      const emBotao =
        document.activeElement instanceof HTMLButtonElement &&
        !!c?.contains(document.activeElement);
      const tomar = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      if (e.key === "Escape") {
        tomar();
        aoFechar(false);
      } else if (e.key === "ArrowRight") {
        tomar();
        avancar();
      } else if (e.key === "ArrowLeft") {
        tomar();
        voltar();
      } else if (e.key === "Enter" && !emBotao) {
        tomar();
        avancar();
      } else if (e.key === "Tab" && c) {
        const itens = [...c.querySelectorAll<HTMLElement>(FOCAVEIS)];
        const primeiro = itens[0];
        const final = itens[itens.length - 1];
        const ativo = document.activeElement;
        if (primeiro && final) {
          if (!c.contains(ativo)) {
            e.preventDefault();
            primeiro.focus();
          } else if (e.shiftKey && ativo === primeiro) {
            e.preventDefault();
            final.focus();
          } else if (!e.shiftKey && ativo === final) {
            e.preventDefault();
            primeiro.focus();
          }
        }
        e.stopImmediatePropagation();
      } else {
        // Qualquer outra tecla (Enter e espaço num botão do cartão agem pelo clique) não sobe ao app.
        e.stopImmediatePropagation();
      }
    }
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [avancar, voltar, aoFechar]);

  // Se o foco escapar (um clique, o leitor de tela), volta para o cartão.
  useEffect(() => {
    function aoFocar(e: FocusEvent) {
      const c = cartao.current;
      if (c && e.target instanceof Node && !c.contains(e.target)) proximo.current?.focus();
    }
    document.addEventListener("focusin", aoFocar);
    return () => document.removeEventListener("focusin", aoFocar);
  }, []);

  if (!passo) return null;
  const buraco = alvo
    ? {
        left: alvo.x - RESPIRO,
        top: alvo.y - RESPIRO,
        width: alvo.w + RESPIRO * 2,
        height: alvo.h + RESPIRO * 2,
      }
    : null;

  return (
    <div className="tour" data-testid="tour" data-passo={passo.id} data-indice={indice}>
      {/* O véu segura os cliques (o tour é modal); sem alvo ele mesmo escurece a tela. */}
      <div className="tour-veu" data-sem-alvo={buraco ? undefined : ""} data-testid="tour-veu" />
      {buraco && (
        <div className="tour-buraco" data-testid="tour-buraco" style={buraco} aria-hidden="true" />
      )}
      <div
        ref={cartao}
        className="tour-cartao"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        data-testid="tour-cartao"
        data-pronto={pronto ? "sim" : "nao"}
        style={{ left: posicao.x, top: posicao.y }}
      >
        <div aria-live="polite" aria-atomic="true">
          <h2 id={idTitulo} className="tour-titulo" data-testid="tour-titulo">
            {passo.titulo}
          </h2>
          <p id={idTexto} className="tour-texto" data-testid="tour-texto">
            {textoDoPasso(passo)}
          </p>
        </div>
        <div className="tour-acoes">
          <button
            type="button"
            className="tour-pular"
            data-testid="tour-pular"
            onClick={() => aoFechar(false)}
          >
            Pular
          </button>
          <span className="tour-espaco" />
          <button type="button" data-testid="tour-voltar" disabled={indice === 0} onClick={voltar}>
            Voltar
          </button>
          <button
            ref={proximo}
            type="button"
            className="primario"
            data-testid="tour-proximo"
            onClick={avancar}
          >
            {ultimo ? "Concluir" : "Próximo"} {indice + 1}/{passos.length}
          </button>
        </div>
      </div>
    </div>
  );
}
