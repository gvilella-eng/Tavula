import { useSyncExternalStore } from "react";

/**
 * Q5: o estilo das rolagens no chat, neste navegador: "fita" (padrão) ou "moldura" (grimório). Preferência pessoal
 * (`tabletop:pref:estiloDasRolagens`), nunca enviada à sala. O localStorage pode estar bloqueado: tudo em try/catch.
 */
export const CHAVE_ESTILO_DAS_ROLAGENS = "tabletop:pref:estiloDasRolagens";

export type EstiloDasRolagens = "fita" | "moldura";
export const ESTILOS_DAS_ROLAGENS: readonly EstiloDasRolagens[] = ["fita", "moldura"];
export const NOMES_DOS_ESTILOS: Record<EstiloDasRolagens, string> = {
  fita: "Fita",
  moldura: "Moldura",
};

export function lerEstiloDasRolagens(): EstiloDasRolagens {
  try {
    return localStorage.getItem(CHAVE_ESTILO_DAS_ROLAGENS) === "moldura" ? "moldura" : "fita";
  } catch {
    return "fita";
  }
}

let valor = lerEstiloDasRolagens();
const ouvintes = new Set<() => void>();

export function estiloDasRolagensAtual(): EstiloDasRolagens {
  return valor;
}

export function definirEstiloDasRolagens(estilo: EstiloDasRolagens): void {
  valor = estilo;
  try {
    localStorage.setItem(CHAVE_ESTILO_DAS_ROLAGENS, estilo);
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

export function useEstiloDasRolagens(): EstiloDasRolagens {
  return useSyncExternalStore(assinar, estiloDasRolagensAtual, () => "fita");
}
