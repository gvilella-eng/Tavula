import {
  Fragment,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ATALHOS, type Combinacao, type IdDoAtalho } from "./atalhos";

/** A dica é uma só em toda a interface (R6a): no mouse e no foco do teclado, com o atalho quando há. */

/** As teclas de um atalho, cada uma num `<kbd>`: "Shift + F10 ou Menu". */
export function Teclas({
  teclas,
  juntas,
}: {
  teclas: readonly Combinacao[];
  /** Um conjunto só (as quatro setas), sem "ou" entre as teclas. */
  juntas?: boolean | undefined;
}) {
  return (
    <span className={juntas ? "teclas teclas-juntas" : "teclas"}>
      {teclas.map((combo, i) => (
        <Fragment key={combo.join("+")}>
          {i > 0 && !juntas && <span className="teclas-ou"> ou </span>}
          {combo.map((t, j) => (
            <Fragment key={t}>
              {j > 0 && <span className="teclas-mais">+</span>}
              <kbd className={SETAS.has(t) ? "tecla-seta" : undefined}>{t}</kbd>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

const SETAS = new Set(["←", "↑", "↓", "→"]);

/** Quando a dica está à vista, e os eventos que a mostram e a escondem (mouse, foco e Esc). */
export function useDica() {
  const id = useId();
  const [visivel, setVisivel] = useState(false);
  const mostrar = useCallback(() => setVisivel(true), []);
  const esconder = useCallback(() => setVisivel(false), []);
  const aoTeclar = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setVisivel(false);
  }, []);
  return { id, visivel, mostrar, esconder, aoTeclar };
}

type PropsDaDica = {
  /** O elemento a que a dica aponta. */
  alvo: RefObject<HTMLElement | null>;
  id: string;
  visivel: boolean;
  /** `data-testid` da dica (por convenção, `dica-<testid do alvo>`). */
  testid: string;
  /** Título em negrito (o nome do botão); sem ele, o `texto` é a primeira linha. */
  nome?: string | undefined;
  texto?: string | undefined;
  atalho?: IdDoAtalho | undefined;
  /** É o motivo de o botão estar desabilitado (marca `data-motivo`). */
  motivo?: boolean | undefined;
  /** Onde aparece: embaixo do alvo (padrão), à direita ou à esquerda (barras laterais). */
  lado?: "baixo" | "direita" | "esquerda" | undefined;
};

/**
 * O balão da dica, num portal no `body` com posição fixa (a rolagem de uma janela não o corta). Fica sempre
 * montado, escondido, para `aria-describedby` achar o texto.
 */
export function Dica({
  alvo,
  id,
  visivel,
  testid,
  nome,
  texto,
  atalho,
  motivo,
  lado,
}: PropsDaDica) {
  const balao = useRef<HTMLSpanElement>(null);
  const [lugar, setLugar] = useState<{ x: number; y: number } | null>(null);

  const posicionar = useCallback(() => {
    const b = alvo.current;
    const d = balao.current;
    if (!b || !d) return;
    const r = b.getBoundingClientRect();
    const largura = d.offsetWidth;
    const altura = d.offsetHeight;
    if (lado === "esquerda") {
      const x = Math.max(8, r.left - largura - 8);
      const y = Math.min(
        Math.max(8, r.top + r.height / 2 - altura / 2),
        window.innerHeight - altura - 8,
      );
      setLugar({ x, y });
      return;
    }
    if (lado === "direita") {
      const x = Math.min(r.right + 8, window.innerWidth - largura - 8);
      const y = Math.min(
        Math.max(8, r.top + r.height / 2 - altura / 2),
        window.innerHeight - altura - 8,
      );
      setLugar({ x, y });
      return;
    }
    const x = Math.min(
      Math.max(8, r.left + r.width / 2 - largura / 2),
      window.innerWidth - largura - 8,
    );
    const abaixo = r.bottom + 6;
    const y = abaixo + altura > window.innerHeight - 8 ? Math.max(8, r.top - altura - 6) : abaixo;
    setLugar({ x, y });
  }, [alvo, lado]);

  useLayoutEffect(() => {
    if (visivel) posicionar();
    else setLugar(null);
  }, [visivel, posicionar]);

  const primeira = nome ?? texto;
  if (!primeira) return null;
  return createPortal(
    <span
      ref={balao}
      id={id}
      role="tooltip"
      className="dica-flutuante"
      data-testid={testid}
      data-motivo={motivo || undefined}
      hidden={!visivel}
      style={lugar ? { left: lugar.x, top: lugar.y } : { left: 0, top: 0, visibility: "hidden" }}
    >
      <span className="dica-linha">
        {nome ? <strong className="dica-nome">{nome}</strong> : <span>{texto}</span>}
        {atalho && (
          <span className="dica-atalho">
            <span className="dica-ponto" aria-hidden="true">
              {"·"}
            </span>
            <Teclas teclas={ATALHOS[atalho].teclas} juntas={"juntas" in ATALHOS[atalho]} />
          </span>
        )}
      </span>
      {nome && texto && <span className="dica-texto">{texto}</span>}
    </span>,
    document.body,
  );
}
