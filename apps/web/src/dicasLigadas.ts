import { useSyncExternalStore } from "react";

/**
 * A opção "Dicas ao passar o mouse" (V3b): ligada por padrão, guardada só neste navegador
 * (`tabletop:pref:dicas`) e nunca enviada à sala. O localStorage pode estar bloqueado: tudo em try/catch.
 */
export const CHAVE_DICAS = "tabletop:pref:dicas";

function ler(): boolean {
  try {
    return localStorage.getItem(CHAVE_DICAS) !== "0";
  } catch {
    return true;
  }
}

let valor = ler();
const ouvintes = new Set<() => void>();

export function dicasLigadas(): boolean {
  return valor;
}

export function definirDicasLigadas(ligadas: boolean): void {
  valor = ligadas;
  try {
    localStorage.setItem(CHAVE_DICAS, ligadas ? "1" : "0");
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

export function useDicasLigadas(): boolean {
  return useSyncExternalStore(assinar, dicasLigadas, () => true);
}
