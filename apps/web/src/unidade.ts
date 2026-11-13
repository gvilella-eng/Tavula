import type { UnidadeDeDistancia } from "@tabletop/shared";
import { useSyncExternalStore } from "react";

/**
 * V13: a unidade em que este navegador mostra as distâncias do mapa (metros ou pés). Preferência
 * pessoal (`tabletop:pref:unidade`), nunca enviada à sala; o estado da mesa continua em metros.
 * O localStorage pode estar bloqueado: tudo em try/catch.
 */
export const CHAVE_UNIDADE = "tabletop:pref:unidade";

export function lerUnidade(): UnidadeDeDistancia {
  try {
    return localStorage.getItem(CHAVE_UNIDADE) === "pes" ? "pes" : "m";
  } catch {
    return "m";
  }
}

let valor = lerUnidade();
const ouvintes = new Set<() => void>();

export function unidadeAtual(): UnidadeDeDistancia {
  return valor;
}

export function definirUnidade(unidade: UnidadeDeDistancia): void {
  valor = unidade;
  try {
    localStorage.setItem(CHAVE_UNIDADE, unidade);
  } catch {
    // sem localStorage: vale só nesta sessão
  }
  for (const o of ouvintes) o();
}

function assinar(aoMudar: () => void) {
  ouvintes.add(aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
  };
}

export function useUnidade(): UnidadeDeDistancia {
  return useSyncExternalStore(assinar, unidadeAtual, () => "m");
}
