import { useCallback, useState } from "react";

/**
 * MU2: qual aba da mesa de som está à vista ("Efeitos e ambientes" ou "Música"). Preferência pessoal (só deste navegador;
 * nunca vai para a sala). Trocar de aba só muda a vista: nada para de tocar. O localStorage pode estar bloqueado.
 */
export const CHAVE_ABA_DO_SOM = "tabletop:pref:som-aba";

export type AbaDoSom = "efeitos" | "musica";
export const ABAS_DO_SOM: readonly AbaDoSom[] = ["efeitos", "musica"];
export const ABA_PADRAO_DO_SOM: AbaDoSom = "efeitos";

export function lerAbaDoSom(): AbaDoSom {
  try {
    const v = localStorage.getItem(CHAVE_ABA_DO_SOM);
    return v === "efeitos" || v === "musica" ? v : ABA_PADRAO_DO_SOM;
  } catch {
    return ABA_PADRAO_DO_SOM;
  }
}

export function gravarAbaDoSom(aba: AbaDoSom): void {
  try {
    localStorage.setItem(CHAVE_ABA_DO_SOM, aba);
  } catch {
    // sem localStorage: vale só até fechar a página
  }
}

/** A aba vizinha (as setas do teclado): dá a volta nas pontas. */
export function abaVizinha(aba: AbaDoSom, passo: 1 | -1): AbaDoSom {
  const i = ABAS_DO_SOM.indexOf(aba);
  return ABAS_DO_SOM[(i + passo + ABAS_DO_SOM.length) % ABAS_DO_SOM.length] ?? ABA_PADRAO_DO_SOM;
}

export function useAbaDoSom() {
  const [aba, setAba] = useState<AbaDoSom>(lerAbaDoSom);
  const mudarAba = useCallback((nova: AbaDoSom) => {
    setAba(nova);
    gravarAbaDoSom(nova);
  }, []);
  return { aba, mudarAba };
}
