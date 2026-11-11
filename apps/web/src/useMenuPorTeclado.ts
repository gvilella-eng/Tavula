import { type KeyboardEvent, type RefObject, useEffect, useRef } from "react";

const FOCAVEIS = 'button:not([disabled]):not([aria-disabled="true"]), input:not([disabled])';

function focaveisDe(menu: HTMLElement | null): HTMLElement[] {
  return menu ? [...menu.querySelectorAll<HTMLElement>(FOCAVEIS)] : [];
}

/**
 * Teclado num menu de contexto (R6a): quando aberto pelo teclado (`focarPrimeiro`) o foco vai para o primeiro
 * item; as setas andam pelos itens (cima e baixo; esquerda e direita nos botões, não no campo de texto), Home e
 * End vão ao primeiro e ao último; Enter e Espaço ativam o botão em foco (comportamento do próprio botão). Ao
 * fechar, o foco volta a quem o tinha antes de o menu abrir, se ninguém o pegou no meio (um clique em outro
 * lugar mantém o foco onde a pessoa o pôs). Devolve o `onKeyDown` do menu.
 */
export function useMenuPorTeclado(
  ref: RefObject<HTMLElement | null>,
  focarPrimeiro: boolean,
): (e: KeyboardEvent<HTMLElement>) => void {
  // Quem tinha o foco antes do menu: lido na primeira renderização (o StrictMode refaz o efeito, não a leitura).
  const anterior = useRef<Element | null | undefined>(undefined);
  if (anterior.current === undefined) anterior.current = document.activeElement;

  // biome-ignore lint/correctness/useExhaustiveDependencies: só na abertura e no fechamento do menu
  useEffect(() => {
    if (focarPrimeiro) focaveisDe(ref.current)[0]?.focus({ preventScroll: true });
    return () => {
      const atual = document.activeElement;
      const volta = anterior.current;
      if (
        volta instanceof HTMLElement &&
        volta.isConnected &&
        (!atual || atual === document.body)
      ) {
        volta.focus({ preventScroll: true });
      }
    };
  }, []);

  return (e) => {
    const alvo = e.target;
    const noCampo = alvo instanceof HTMLInputElement && alvo.type === "text";
    const lista = focaveisDe(ref.current);
    const i = alvo instanceof HTMLElement ? lista.indexOf(alvo) : -1;
    if (lista.length === 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    let destino: number | null = null;
    if (e.key === "ArrowDown" || (e.key === "ArrowRight" && !noCampo)) {
      destino = i < 0 ? 0 : (i + 1) % lista.length;
    } else if (e.key === "ArrowUp" || (e.key === "ArrowLeft" && !noCampo)) {
      destino = i < 0 ? lista.length - 1 : (i - 1 + lista.length) % lista.length;
    } else if (e.key === "Home" && !noCampo) destino = 0;
    else if (e.key === "End" && !noCampo) destino = lista.length - 1;
    if (destino === null) return;
    e.preventDefault();
    lista[destino]?.focus();
  };
}
