import { type KeyboardEvent, type MouseEvent, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pontoDoElemento } from "../MenuDeContexto";
import { useFecharFora } from "../Popover";
import { CampoNumero } from "./campos";

/** O atalho de menu de contexto do teclado: a tecla Menu ou Shift+F10. */
const ATALHO_DO_MENU = (e: KeyboardEvent) =>
  e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey && !e.ctrlKey && !e.altKey);

const MARGEM = 8;

type Aberto = { id: string; x: number; y: number };

/**
 * O modificador extra de perícia e salvaguarda (V4a3): abre só pelo botão direito na linha ou por Shift+F10 / tecla
 * Menu na linha em foco (nunca no hover). `propsDaLinha(id)` vai na linha; o popover sai de `<PopoverDoModificador>`.
 */
export function useModificadorExtra(editar: boolean) {
  const [aberto, setAberto] = useState<Aberto | null>(null);
  // A tecla de menu também dispara o "contextmenu" do navegador: some quando fomos nós a abrir (como no menu das Fichas).
  const abriuNoTeclado = useRef(0);
  const abrir = (id: string, x: number, y: number, teclado: boolean) => {
    if (teclado) abriuNoTeclado.current = performance.now();
    else if (performance.now() - abriuNoTeclado.current < 700) return;
    setAberto({ id, x, y });
  };
  const propsDaLinha = (id: string) => ({
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      if (!editar) return;
      e.preventDefault();
      abrir(id, e.clientX, e.clientY, false);
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (!editar || !ATALHO_DO_MENU(e)) return;
      e.preventDefault();
      const ponto = pontoDoElemento(e.currentTarget);
      abrir(id, ponto.x, ponto.y, true);
    },
  });
  return { aberto, setAberto, propsDaLinha };
}

type PropsDoPopover = {
  testid: string;
  rotulo: string;
  valor: number;
  x: number;
  y: number;
  /** O botão da linha, para devolver o foco ao fechar. */
  testidDoFoco: string;
  aoMudar: (n: number) => void;
  aoFechar: () => void;
};

/** O pequeno "Modificador: [caixa]": aceita positivo e negativo. Esc ou Enter fecha e o foco volta à linha. */
export function PopoverDoModificador({
  testid,
  rotulo,
  valor,
  x,
  y,
  testidDoFoco,
  aoMudar,
  aoFechar,
}: PropsDoPopover) {
  const ref = useRef<HTMLDivElement>(null);
  const fechar = () => {
    aoFechar();
    document.querySelector<HTMLElement>(`[data-testid="${testidDoFoco}"]`)?.focus();
  };
  useFecharFora(ref, fechar);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${Math.max(MARGEM, Math.min(x, window.innerWidth - el.offsetWidth - MARGEM))}px`;
    el.style.top = `${Math.max(MARGEM, Math.min(y, window.innerHeight - el.offsetHeight - MARGEM))}px`;
    const campo = el.querySelector("input");
    campo?.focus();
    campo?.select();
  }, [x, y]);
  return createPortal(
    <div
      ref={ref}
      className="popover fl-pop-mod"
      role="dialog"
      aria-label={rotulo}
      data-testid={`${testid}-popover`}
      onKeyDown={(e) => {
        if (e.key === "Enter") fechar();
      }}
    >
      <div className="fl-pop-mod-rotulo">
        <span>Modificador:</span>
        <CampoNumero
          testid={testid}
          rotulo={rotulo}
          valor={valor}
          min={-50}
          max={50}
          className="fl-pop-mod-campo"
          aoMudar={aoMudar}
        />
      </div>
    </div>,
    document.body,
  );
}
