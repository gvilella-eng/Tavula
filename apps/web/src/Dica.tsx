import {
  Fragment,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ATALHOS, type Combinacao, type IdDoAtalho } from "./atalhos";
import { dicasLigadas, useDicasLigadas } from "./dicasLigadas";

/** A dica é uma só em toda a interface (R6a); desde o V3b, de uma linha, com atraso e só onde falta nome. */

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

/** Parado em cima do botão por este tempo, no mouse, antes de a dica aparecer (V3b). */
export const ATRASO_DA_DICA = 700;
/** Depois de uma dica fechar, a próxima aparece na hora durante este tempo (passar de um botão a outro). */
const JANELA_DE_TROCA = 300;

let abertas = 0;
/** O instante (relógio dos eventos) do último clique ou toque: foco que chega junto dele não mostra a dica. */
let ultimoToqueDoPonteiro = Number.NEGATIVE_INFINITY;
let ultimoAlvoDoPonteiro: EventTarget | null = null;
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (e) => {
      ultimoToqueDoPonteiro = e.timeStamp;
      ultimoAlvoDoPonteiro = e.target;
    },
    true,
  );
}
let fechouEm = Number.NEGATIVE_INFINITY;

/**
 * Quando a dica está à vista, e os eventos que a mostram e a escondem. No mouse ela espera `ATRASO_DA_DICA`
 * (sair antes cancela); com outra dica já aberta, ou recém-fechada, aparece na hora; no foco (do teclado, ou
 * programático) também, salvo se o foco veio de um clique. Com a opção "Dicas ao passar o mouse" desligada nunca aparece.
 */
export function useDica() {
  const id = useId();
  const ligadas = useDicasLigadas();
  const [visivel, setVisivel] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelar = useCallback(() => {
    if (espera.current !== null) {
      clearTimeout(espera.current);
      espera.current = null;
    }
  }, []);
  const esconder = useCallback(() => {
    cancelar();
    setVisivel(false);
  }, [cancelar]);
  const mostrar = useCallback(() => {
    cancelar();
    setVisivel(true);
  }, [cancelar]);
  /** Ao entrar com o mouse: espera o atraso, a não ser que haja uma dica aberta (ou recém-fechada). */
  const aoEntrarMouse = useCallback(() => {
    if (!dicasLigadas()) return;
    cancelar();
    if (abertas > 0 || Date.now() - fechouEm < JANELA_DE_TROCA) {
      setVisivel(true);
      return;
    }
    espera.current = setTimeout(() => {
      espera.current = null;
      setVisivel(true);
    }, ATRASO_DA_DICA);
  }, [cancelar]);
  /** No foco: mostra na hora, a não ser que o foco tenha vindo de um clique de mouse (o clique já esconde a dica). */
  const aoFocar = useCallback(
    (e: { nativeEvent: Event; currentTarget: Element }) => {
      if (!dicasLigadas()) return;
      const doClique =
        e.nativeEvent.timeStamp - ultimoToqueDoPonteiro < 100 &&
        ultimoAlvoDoPonteiro instanceof Node &&
        e.currentTarget.contains(ultimoAlvoDoPonteiro);
      if (doClique) return;
      mostrar();
    },
    [mostrar],
  );
  const aoTeclar = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") esconder();
    },
    [esconder],
  );

  useEffect(() => {
    if (!visivel) return;
    abertas += 1;
    return () => {
      abertas -= 1;
      fechouEm = Date.now();
    };
  }, [visivel]);
  useEffect(() => cancelar, [cancelar]);

  return { id, visivel: visivel && ligadas, mostrar, esconder, aoEntrarMouse, aoFocar, aoTeclar };
}

type PropsDaDica = {
  /** O elemento a que a dica aponta. */
  alvo: RefObject<HTMLElement | null>;
  id: string;
  visivel: boolean;
  /** `data-testid` da dica (por convenção, `dica-<testid do alvo>`). */
  testid: string;
  /** O nome do controle, em negrito. */
  nome: string;
  atalho?: IdDoAtalho | undefined;
  /** Por que o botão está desabilitado: "Nome — motivo" (marca `data-motivo`). */
  motivo?: string | undefined;
  /** É um aviso (o clique no botão desabilitado com as dicas desligadas): o leitor de tela anuncia. */
  aviso?: boolean | undefined;
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
  atalho,
  motivo,
  aviso,
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

  if (!nome) return null;
  return createPortal(
    <span
      ref={balao}
      id={id}
      role="tooltip"
      className="dica-flutuante"
      data-testid={testid}
      data-motivo={motivo ? true : undefined}
      aria-live={aviso ? "polite" : undefined}
      hidden={!visivel}
      style={lugar ? { left: lugar.x, top: lugar.y } : { left: 0, top: 0, visibility: "hidden" }}
    >
      <span className="dica-linha">
        <strong className="dica-nome">{nome}</strong>
        {motivo && <span className="dica-motivo">{` — ${motivo}`}</span>}
        {atalho && !motivo && (
          <span className="dica-atalho">
            <span className="dica-ponto" aria-hidden="true">
              {"·"}
            </span>
            <Teclas teclas={ATALHOS[atalho].teclas} juntas={"juntas" in ATALHOS[atalho]} />
          </span>
        )}
      </span>
    </span>,
    document.body,
  );
}
