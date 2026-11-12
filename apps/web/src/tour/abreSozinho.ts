import type { UsuarioDaEntrada } from "../api";

/**
 * No teste (`MODO=teste`) o tour não abre sozinho, para não atrapalhar os E2E antigos; os testes do tour ligam esta
 * chave de propósito (só no navegador deles). Ela nunca vai para a sala.
 */
export const CHAVE_TOUR_NO_TESTE = "tabletop:pref:tourNoTeste";

function ligadoNoTeste(): boolean {
  try {
    return localStorage.getItem(CHAVE_TOUR_NO_TESTE) === "1";
  } catch {
    return false;
  }
}

/**
 * O tour abre sozinho no primeiro acesso de uma conta a uma mesa: só quem tem conta (o servidor diz se ela já viu)
 * e, no teste, só com a chave ligada.
 */
export function tourAbreSozinho(u: Pick<UsuarioDaEntrada, "tourVisto" | "modoTeste">): boolean {
  if (u.tourVisto !== false) return false;
  return !u.modoTeste || ligadoNoTeste();
}
