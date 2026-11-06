import { type ReactNode, type RefObject, useEffect, useRef } from "react";

/** Fecha ao clicar fora do elemento ou apertar Esc. */
export function useFecharFora(ref: RefObject<HTMLElement | null>, aoFechar: () => void): void {
  const atual = useRef(aoFechar);
  atual.current = aoFechar;
  useEffect(() => {
    function aoApertar(e: PointerEvent) {
      const alvo = e.target;
      if (!(alvo instanceof Element) || !ref.current || ref.current.contains(alvo)) return;
      // O botão que abre o painel decide sozinho (alterna): clicar nele não conta como "fora".
      if (alvo.closest("[data-popover-gatilho]")) return;
      atual.current();
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") atual.current();
    }
    document.addEventListener("pointerdown", aoApertar, true);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoApertar, true);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [ref]);
}

type Props = {
  testid: string;
  titulo?: string;
  className?: string;
  aoFechar: () => void;
  children: ReactNode;
};

/** Painel flutuante simples (o posicionamento vem do CSS de quem usa, via `className`). */
export function Popover({ testid, titulo, className, aoFechar, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFecharFora(ref, () => aoFechar());
  return (
    <div
      ref={ref}
      className={`popover ${className ?? ""}`}
      data-testid={testid}
      role="dialog"
      aria-label={titulo}
    >
      {titulo && <strong className="popover-titulo">{titulo}</strong>}
      {children}
    </div>
  );
}
