import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Os diálogos abertos agora, do mais antigo para o mais novo (V10). Só o de cima recebe o Esc e prende o
 * foco; ao fechar, o foco volta para quem o abriu. Serve a todo modal, inclusive o aberto de dentro de outro
 * (o seletor de imagem por cima do "Configurar cena").
 */
const pilha: symbol[] = [];

/** Há algum diálogo modal aberto? (Os atalhos do mapa esperam.) */
export function haDialogoAberto(): boolean {
  return pilha.length > 0;
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focaveisDe(raiz: HTMLElement): HTMLElement[] {
  return [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.offsetParent !== null);
}

/**
 * Ativa o comportamento de diálogo na caixa `ref`: foco inicial dentro dela, Tab preso nela, Esc chama
 * `aoEsc` (só no de cima) e o foco volta a quem abriu. Devolve o nível (0 é o primeiro), que dá o z-index.
 */
export function useDialogo(ref: RefObject<HTMLElement | null>, aoEsc: () => void): number {
  const [nivel] = useState(() => pilha.length);
  const esc = useRef(aoEsc);
  esc.current = aoEsc;

  useEffect(() => {
    const id = Symbol("dialogo");
    pilha.push(id);
    const quemAbriu = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const caixa = ref.current;
    if (caixa && !caixa.contains(document.activeElement)) {
      (focaveisDe(caixa)[0] ?? caixa).focus({ preventScroll: true });
    }

    const aoTeclar = (e: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== id) return;
      if (e.key === "Escape") {
        // Só o de cima fecha: ninguém mais (nem os atalhos da mesa) ouve este Esc.
        e.preventDefault();
        e.stopPropagation();
        esc.current();
        return;
      }
      if (e.key !== "Tab" || !caixa) return;
      const itens = focaveisDe(caixa);
      if (itens.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiro = itens[0] as HTMLElement;
      const ultimo = itens[itens.length - 1] as HTMLElement;
      const atual = document.activeElement;
      if (!caixa.contains(atual)) {
        e.preventDefault();
        (e.shiftKey ? ultimo : primeiro).focus();
      } else if (e.shiftKey && atual === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      const i = pilha.indexOf(id);
      if (i >= 0) pilha.splice(i, 1);
      if (quemAbriu?.isConnected) quemAbriu.focus({ preventScroll: true });
    };
  }, [ref]);

  return nivel;
}
