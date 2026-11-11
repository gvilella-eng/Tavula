import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "disabled"> & {
  /** O `data-testid` do botão (a dica leva o mesmo com o prefixo `dica-`). */
  testid: string;
  /** O que o botão faz (dica no mouse e no foco do teclado). */
  dica?: string;
  /**
   * Por que o botão não age agora. Com motivo o botão fica desabilitado (`aria-disabled`, o clique é ignorado)
   * e o motivo vira a dica e a descrição para leitor de tela. O `disabled` nativo não deixa a dica aparecer.
   */
  motivo?: string | null;
  children: ReactNode;
};

type Lugar = { x: number; y: number };

/**
 * Botão com dica que também explica o motivo de estar desabilitado (R5b). A dica aparece ao passar o mouse e
 * ao receber o foco, sai ao clicar, ao perder o foco e com Esc, e é ligada ao botão por `aria-describedby`.
 */
export function BotaoComDica({
  testid,
  dica,
  motivo,
  onClick,
  onKeyDown,
  children,
  ...resto
}: Props) {
  const idDaDica = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const balao = useRef<HTMLSpanElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const desabilitado = typeof motivo === "string" && motivo !== "";
  const texto = desabilitado ? motivo : dica;

  const posicionar = useCallback(() => {
    const b = botao.current;
    const d = balao.current;
    if (!b || !d) return;
    const r = b.getBoundingClientRect();
    const largura = d.offsetWidth;
    const altura = d.offsetHeight;
    const x = Math.min(
      Math.max(8, r.left + r.width / 2 - largura / 2),
      window.innerWidth - largura - 8,
    );
    const abaixo = r.bottom + 6;
    const y = abaixo + altura > window.innerHeight - 8 ? Math.max(8, r.top - altura - 6) : abaixo;
    setLugar({ x, y });
  }, []);

  useLayoutEffect(() => {
    if (visivel) posicionar();
    else setLugar(null);
  }, [visivel, posicionar]);

  return (
    <>
      <button
        {...resto}
        ref={botao}
        type={resto.type ?? "button"}
        data-testid={testid}
        aria-disabled={desabilitado || undefined}
        aria-describedby={texto ? idDaDica : undefined}
        onClick={(e) => {
          setVisivel(false);
          if (desabilitado) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        onMouseEnter={() => setVisivel(true)}
        // O botão pode ficar desabilitado com o mouse já em cima (acabou de ser clicado): mexer o mouse mostra o motivo.
        onMouseMove={desabilitado && !visivel ? () => setVisivel(true) : undefined}
        onMouseLeave={() => setVisivel(false)}
        onFocus={() => setVisivel(true)}
        onBlur={() => setVisivel(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setVisivel(false);
          onKeyDown?.(e);
        }}
      >
        {children}
      </button>
      {texto &&
        createPortal(
          <span
            ref={balao}
            id={idDaDica}
            role="tooltip"
            className="dica-flutuante"
            data-testid={`dica-${testid}`}
            data-motivo={desabilitado || undefined}
            hidden={!visivel}
            style={
              lugar ? { left: lugar.x, top: lugar.y } : { left: 0, top: 0, visibility: "hidden" }
            }
          >
            {texto}
          </span>,
          document.body,
        )}
    </>
  );
}
