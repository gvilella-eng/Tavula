import { useSyncExternalStore } from "react";

// Ordem de empilhamento das janelas flutuantes, compartilhada entre todas: a última clicada (ou aberta)
// fica por cima. É só da tela, nunca vai para a sala.

/** O `z-index` da janela de trás; as outras somam a posição na pilha. Abaixo dos menus e dos avisos. */
export const BASE_DO_Z = 25;
/** O `z-index` da camada alta (a ficha, V4a): acima dos painéis (até 40) e abaixo dos avisos e menus (60 ou mais). */
export const CAMADA_ALTA_DO_Z = 45;

let ordem: string[] = [];
const ouvintes = new Set<() => void>();

function avisar() {
  for (const o of ouvintes) o();
}

/** Põe a janela por cima de todas (entra na pilha se ainda não estava). */
export function trazerParaFrente(id: string): void {
  if (ordem[ordem.length - 1] === id) return;
  ordem = [...ordem.filter((x) => x !== id), id];
  avisar();
}

export function sairDaPilha(id: string): void {
  if (!ordem.includes(id)) return;
  ordem = ordem.filter((x) => x !== id);
  avisar();
}

/** Posição da janela na pilha (0 = a de trás; -1 = ainda fora dela). */
export function usePosicaoNaPilha(id: string): number {
  return useSyncExternalStore(
    (aoMudar) => {
      ouvintes.add(aoMudar);
      return () => ouvintes.delete(aoMudar);
    },
    () => ordem.indexOf(id),
  );
}
