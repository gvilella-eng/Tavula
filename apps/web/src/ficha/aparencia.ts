import { useSyncExternalStore } from "react";

// A aparência da ficha (V4a): Livro (o padrão) ou Clássica. É preferência de cada navegador
// (`tabletop:pref:aparenciaFicha`): nunca vai para a sala. O localStorage pode estar bloqueado: tudo em try/catch.

export const APARENCIAS = ["livro", "classica"] as const;
export type AparenciaDaFicha = (typeof APARENCIAS)[number];
export const ROTULO_DA_APARENCIA: Record<AparenciaDaFicha, string> = {
  livro: "Livro",
  classica: "Clássica",
};
export const CHAVE_DA_APARENCIA = "tabletop:pref:aparenciaFicha";

export function lerAparencia(): AparenciaDaFicha {
  try {
    const v = localStorage.getItem(CHAVE_DA_APARENCIA);
    return v === "classica" ? "classica" : "livro";
  } catch {
    return "livro";
  }
}

let atual: AparenciaDaFicha = lerAparencia();
const ouvintes = new Set<() => void>();

export function gravarAparencia(valor: AparenciaDaFicha): void {
  atual = valor;
  try {
    localStorage.setItem(CHAVE_DA_APARENCIA, valor);
  } catch {
    // sem localStorage: vale só nesta sessão
  }
  for (const o of ouvintes) o();
}

/** A aparência escolhida; todas as fichas abertas mudam juntas. */
export function useAparencia(): AparenciaDaFicha {
  return useSyncExternalStore(
    (aoMudar) => {
      ouvintes.add(aoMudar);
      return () => ouvintes.delete(aoMudar);
    },
    () => atual,
  );
}
