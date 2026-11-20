import type { Fluxo } from "@tabletop/shared";
import { Check } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { posicionarCartao, type Retangulo } from "../tour/posicao";
import { nomeDoExemploDoTour, type PassoDoTourDasAutomacoes } from "./passosDoTour";

/** Quanto o tour espera o alvo de um passo de explicação aparecer antes de pular o passo. */
const ESPERA_DO_ALVO_MS = 1500;
const RESPIRO = 4;

const achar = (alvo: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-testid="${alvo}"]`);

function medir(el: HTMLElement | null): Retangulo | null {
  if (!el?.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

const igual = (a: readonly (Retangulo | null)[], b: readonly (Retangulo | null)[]) =>
  a.length === b.length &&
  a.every((x, i) => {
    const y = b[i];
    if (x === null || y === null || y === undefined) return x === y;
    return (
      Math.abs(x.x - y.x) < 0.5 &&
      Math.abs(x.y - y.y) < 0.5 &&
      Math.abs(x.w - y.w) < 0.5 &&
      Math.abs(x.h - y.h) < 0.5
    );
  });

const uniao = (rs: readonly Retangulo[]): Retangulo | null => {
  if (rs.length === 0) return null;
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

export type AcoesDoFimDoTour = {
  /** Deixa a automação ligada, salva. */
  ligarAgora: () => void;
  /** Descarta o exemplo e fecha o editor. */
  apagarOExemplo: () => void;
};

type Props = {
  passos: readonly PassoDoTourDasAutomacoes[];
  /** A automação que o editor tem aberta (os passos de "fazer" a olham e a mudam). `null` no centro. */
  fluxo: Fluxo | null;
  aoMudarFluxo?: (f: Fluxo) => void;
  /** Escolhe um bloco na grade (para o painel dele aparecer); `undefined` tira a escolha. */
  aoEscolher?: (id: string | undefined) => void;
  /** Enquadra a grade (depois de "Fazer este passo por mim"). */
  aoEnquadrar?: () => void;
  /** O tour acabou: chegou ao último passo (`concluido`) ou foi pulado. `acao` diz qual botão do fim foi usado. */
  aoFechar: (concluido: boolean, acao?: "ligar" | "concluir") => void;
  fim?: AcoesDoFimDoTour;
};

/**
 * O tour do centro de automações. Dois tipos de passo: a explicação (a tela escurece e o alvo fica iluminado, como o tour da
 * mesa) e o "fazer" (a tela fica livre: a pessoa arrasta e liga, uma seta mostra onde, o passo se completa sozinho e há o
 * botão "Fazer este passo por mim"). O cartão fica perto do alvo e nunca trava: alvo que não aparece é pulado.
 */
export function TourDasAutomacoes({
  passos,
  fluxo,
  aoMudarFluxo,
  aoEscolher,
  aoEnquadrar,
  aoFechar,
  fim,
}: Props) {
  const [indice, setIndice] = useState(0);
  const [alvos, setAlvos] = useState<(Retangulo | null)[]>([]);
  const [suaves, setSuaves] = useState<Retangulo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [janela, setJanela] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [posicao, setPosicao] = useState({ x: 12, y: 12 });
  const cartao = useRef<HTMLDivElement>(null);
  const proximo = useRef<HTMLButtonElement>(null);
  const direcao = useRef<1 | -1>(1);
  const fluxoRef = useRef(fluxo);
  fluxoRef.current = fluxo;
  const idTitulo = useId();
  const idTexto = useId();

  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;
  const feito = passo?.feito && fluxo ? passo.feito(fluxo) : false;
  const livre = passo?.tipo === "fazer";
  const noFim = passo?.id === "fim" && fim !== undefined;

  const ir = useCallback((delta: 1 | -1) => {
    direcao.current = delta;
    setPronto(false);
    setIndice((i) => Math.max(0, i + delta));
  }, []);
  const avancar = useCallback(() => {
    if (ultimo) aoFechar(true);
    else ir(1);
  }, [ultimo, aoFechar, ir]);

  // Chegou num passo: escolhe o bloco dele, espera os alvos e depois os acompanha (a grade se move, a janela muda).
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando o passo muda
  useEffect(() => {
    if (!passo) return;
    let desistiu = false;
    let acompanhar: number | undefined;
    const f = fluxoRef.current;
    aoEscolher?.(f && passo.escolher ? passo.escolher(f) : undefined);
    // Ao entrar no passo final, a automação do exemplo fica com nome e desligada (a pessoa liga se quiser).
    if (passo.id === "fim" && f && aoMudarFluxo && (f.nome === "" || f.ligado)) {
      aoMudarFluxo({ ...f, nome: f.nome === "" ? nomeDoExemploDoTour : f.nome, ligado: false });
    }

    const ids = (): string[] => {
      const atual = fluxoRef.current;
      return atual === null ? passo.alvos({} as Fluxo) : passo.alvos(atual);
    };
    const medirTodos = () => ids().map((id) => medir(achar(id)));
    const medirSuaves = () =>
      (passo.suaves ?? []).flatMap((id) => {
        const r = medir(achar(id));
        return r ? [r] : [];
      });

    function pular() {
      if (desistiu) return;
      if (direcao.current === 1) {
        if (indice >= passos.length - 1) aoFechar(true);
        else setIndice(indice + 1);
      } else if (indice > 0) setIndice(indice - 1);
      else {
        direcao.current = 1;
        setIndice(1);
      }
    }

    const semAlvo = ids().length === 0;
    if (semAlvo) {
      setAlvos([]);
      setSuaves(medirSuaves());
      setPronto(true);
      return;
    }
    const inicio = performance.now();
    const procurar = () => {
      if (desistiu) return;
      const todos = medirTodos();
      const achou = todos.find((r) => r !== null) ?? null;
      if (achou) {
        // Um alvo cortado pela janela (um grupo de peças lá embaixo) sobe até o começo dele.
        const primeiro = ids().find((id) => medir(achar(id)) !== null);
        const el = primeiro ? achar(primeiro) : null;
        if (el && passo.tipo === "info") {
          const r = el.getBoundingClientRect();
          if (r.top < 0 || r.bottom > window.innerHeight) {
            el.scrollIntoView({ block: "nearest", inline: "nearest" });
          }
        }
        setAlvos(medirTodos());
        setSuaves(medirSuaves());
        setPronto(true);
        acompanhar = window.setInterval(() => {
          const novos = medirTodos();
          setAlvos((antes) => (igual(antes, novos) ? antes : novos));
          const sv = medirSuaves();
          setSuaves((antes) => (antes.length === sv.length && igual(antes, sv) ? antes : sv));
        }, 200);
        return;
      }
      if (performance.now() - inicio > ESPERA_DO_ALVO_MS) {
        // Passo de "fazer" sem alvo à vista (um campo que ainda não abriu) não se pula: o cartão fica no meio.
        if (passo.tipo === "fazer") {
          setAlvos([]);
          setSuaves(medirSuaves());
          setPronto(true);
          // continua tentando: o alvo pode aparecer quando a pessoa escolher o bloco
          acompanhar = window.setInterval(() => {
            const novos = medirTodos();
            if (novos.some((r) => r !== null)) setAlvos(novos);
          }, 300);
          return;
        }
        pular();
        return;
      }
      window.setTimeout(procurar, 60);
    };
    procurar();
    return () => {
      desistiu = true;
      if (acompanhar !== undefined) window.clearInterval(acompanhar);
    };
  }, [indice]);

  useEffect(() => {
    const aoRedimensionar = () => setJanela({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  const presentes = alvos.filter((r): r is Retangulo => r !== null);
  const ancora = livre ? uniao(presentes) : (presentes[0] ?? null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refaz quando o alvo, o passo ou a janela mudam
  useLayoutEffect(() => {
    const c = cartao.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    setPosicao(posicionarCartao(ancora, { w: r.width, h: r.height }, janela));
  }, [alvos, janela, indice, pronto, feito]);

  // O foco vai para "Próximo" nas explicações (Enter segue); nos passos de fazer, a pessoa está com o mouse na grade.
  useEffect(() => {
    if (!passo) return;
    if (passo.tipo === "info") proximo.current?.focus({ preventScroll: true });
  }, [passo]);

  // Esc pula; as setas andam nas explicações (nunca com o foco num campo de texto).
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const a = document.activeElement;
      const emCampo =
        a instanceof HTMLInputElement ||
        a instanceof HTMLSelectElement ||
        a instanceof HTMLTextAreaElement;
      if (e.key === "Escape" && !emCampo) {
        e.preventDefault();
        e.stopImmediatePropagation();
        aoFechar(false);
      } else if (!emCampo && passo?.tipo === "info" && e.key === "ArrowRight") {
        e.preventDefault();
        e.stopImmediatePropagation();
        avancar();
      } else if (!emCampo && passo?.tipo === "info" && e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (indice > 0) ir(-1);
      }
    }
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [aoFechar, avancar, ir, indice, passo]);

  if (!passo) return null;
  const buraco =
    passo.tipo === "info" && presentes[0]
      ? {
          left: presentes[0].x - RESPIRO,
          top: presentes[0].y - RESPIRO,
          width: presentes[0].w + RESPIRO * 2,
          height: presentes[0].h + RESPIRO * 2,
        }
      : null;
  const [de, para] = presentes;
  // (no corpo da página: dentro da janela flutuante, o tour ficaria atrás da barra lateral)
  return createPortal(
    <div
      className="tour tour-livre"
      data-testid="tour-auto"
      data-passo={passo.id}
      data-indice={indice}
      data-tipo={passo.tipo}
    >
      {passo.tipo === "info" && (
        <div
          className="tour-veu"
          data-sem-alvo={buraco ? undefined : ""}
          data-testid="tour-auto-veu"
        />
      )}
      {buraco && (
        <div
          className="tour-buraco"
          data-testid="tour-auto-buraco"
          style={buraco}
          aria-hidden="true"
        />
      )}
      {(livre ? presentes : presentes.slice(1)).map((r, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: os anéis acompanham a ordem dos alvos do passo
          key={i}
          className="tour-anel"
          data-testid="tour-auto-anel"
          style={{
            left: r.x - RESPIRO,
            top: r.y - RESPIRO,
            width: r.w + RESPIRO * 2,
            height: r.h + RESPIRO * 2,
          }}
          aria-hidden="true"
        />
      ))}
      {livre &&
        suaves.map((r, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: idem
            key={i}
            className="tour-anel suave"
            style={{
              left: r.x - RESPIRO,
              top: r.y - RESPIRO,
              width: r.w + RESPIRO * 2,
              height: r.h + RESPIRO * 2,
            }}
            aria-hidden="true"
          />
        ))}
      {livre && passo.seta && de && para && (
        <svg className="tour-seta" data-testid="tour-auto-seta" aria-hidden="true">
          <defs>
            <marker
              id="tour-ponta"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="tour-seta-ponta" />
            </marker>
          </defs>
          <path
            className="tour-seta-linha"
            markerEnd="url(#tour-ponta)"
            d={`M ${de.x + de.w / 2} ${de.y + de.h / 2} C ${de.x + de.w / 2 + 80} ${de.y + de.h / 2 - 50}, ${para.x + para.w / 2 - 80} ${para.y + para.h / 2 - 50}, ${para.x + para.w / 2} ${para.y + para.h / 2}`}
          />
        </svg>
      )}
      <div
        ref={cartao}
        className="tour-cartao"
        role="dialog"
        aria-modal={passo.tipo === "info" ? "true" : undefined}
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        data-testid="tour-auto-cartao"
        data-pronto={pronto ? "sim" : "nao"}
        style={{ left: posicao.x, top: posicao.y }}
      >
        <div aria-live="polite" aria-atomic="true">
          <h2 id={idTitulo} className="tour-titulo" data-testid="tour-auto-titulo">
            {passo.titulo}
          </h2>
          <p id={idTexto} className="tour-texto" data-testid="tour-auto-texto">
            {passo.texto}
          </p>
        </div>
        {livre && (
          <p
            className="tour-feito"
            data-testid="tour-auto-feito"
            data-feito={feito ? "sim" : "nao"}
          >
            {feito ? (
              <>
                <Check size={14} aria-hidden /> Feito
              </>
            ) : (
              "Faça este passo na grade."
            )}
          </p>
        )}
        <div className="tour-acoes">
          <button
            type="button"
            className="tour-pular"
            data-testid="tour-auto-pular"
            onClick={() => aoFechar(false)}
          >
            Pular
          </button>
          <span className="tour-espaco" />
          <button
            type="button"
            data-testid="tour-auto-voltar"
            disabled={indice === 0}
            onClick={() => ir(-1)}
          >
            Voltar
          </button>
          {livre && !feito && passo.fazer && fluxo && aoMudarFluxo && (
            <button
              type="button"
              data-testid="tour-auto-fazer"
              onClick={() => {
                aoMudarFluxo(passo.fazer?.(fluxo) ?? fluxo);
                setTimeout(() => aoEnquadrar?.(), 0);
              }}
            >
              Fazer este passo por mim
            </button>
          )}
          {!noFim && (
            <button
              ref={proximo}
              type="button"
              className="primario"
              data-testid="tour-auto-proximo"
              disabled={livre && !feito}
              onClick={avancar}
            >
              {passo.avancar ?? (ultimo ? "Concluir" : "Próximo")} {indice + 1}/{passos.length}
            </button>
          )}
        </div>
        {noFim && fim && (
          <div className="tour-acoes tour-acoes-fim">
            <button
              type="button"
              data-testid="tour-auto-apagar-exemplo"
              onClick={fim.apagarOExemplo}
            >
              Apagar o exemplo
            </button>
            <span className="tour-espaco" />
            <button type="button" data-testid="tour-auto-ligar-agora" onClick={fim.ligarAgora}>
              Ligar agora
            </button>
            <button
              ref={proximo}
              type="button"
              className="primario"
              data-testid="tour-auto-concluir"
              onClick={() => aoFechar(true, "concluir")}
            >
              Concluir (fica desligada)
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
