import { useCallback, useState } from "react";

/**
 * MU1: a divisão da mesa de som entre "Efeitos e ambientes" e "Música", e qual lado está minimizado. Preferência pessoal
 * (só deste navegador; nunca vai para a sala). O localStorage pode estar bloqueado.
 */
export const CHAVE_DIVISAO_DO_SOM = "tabletop:pref:som-divisao";
export const CHAVE_LADO_MINIMIZADO_DO_SOM = "tabletop:pref:som-lado-minimizado";

export const DIVISAO_MINIMA = 0.18;
export const DIVISAO_MAXIMA = 0.82;
export const DIVISAO_PADRAO = 0.5;
/** Quanto uma tecla de seta move o divisor. */
export const PASSO_DA_DIVISAO = 0.05;

export type LadoDoSom = "efeitos" | "musica";

/** Cerca a divisão: no mínimo 18% de cada lado. */
export function limitarDivisao(v: number): number {
  if (!Number.isFinite(v)) return DIVISAO_PADRAO;
  return Math.min(DIVISAO_MAXIMA, Math.max(DIVISAO_MINIMA, v));
}

export function lerDivisao(): number {
  try {
    const bruto = localStorage.getItem(CHAVE_DIVISAO_DO_SOM);
    if (bruto === null) return DIVISAO_PADRAO;
    return limitarDivisao(Number(bruto));
  } catch {
    return DIVISAO_PADRAO;
  }
}

export function gravarDivisao(v: number): void {
  try {
    localStorage.setItem(CHAVE_DIVISAO_DO_SOM, String(Math.round(limitarDivisao(v) * 1000) / 1000));
  } catch {
    // sem localStorage: vale só até fechar a página
  }
}

export function lerLadoMinimizado(): LadoDoSom | null {
  try {
    const v = localStorage.getItem(CHAVE_LADO_MINIMIZADO_DO_SOM);
    return v === "efeitos" || v === "musica" ? v : null;
  } catch {
    return null;
  }
}

export function gravarLadoMinimizado(lado: LadoDoSom | null): void {
  try {
    if (lado === null) localStorage.removeItem(CHAVE_LADO_MINIMIZADO_DO_SOM);
    else localStorage.setItem(CHAVE_LADO_MINIMIZADO_DO_SOM, lado);
  } catch {
    // idem
  }
}

/** O rótulo do divisor ao arrastar: "55% · 45%". */
export function rotuloDaDivisao(v: number): string {
  const a = Math.round(limitarDivisao(v) * 100);
  return `${a}% · ${100 - a}%`;
}

/** A divisão e o lado minimizado, lembrados por pessoa. Minimizar um lado traz o outro de volta (só um por vez). */
export function useDivisaoDoSom() {
  const [divisao, setDivisao] = useState<number>(lerDivisao);
  const [minimizado, setMinimizado] = useState<LadoDoSom | null>(lerLadoMinimizado);
  const mudarDivisao = useCallback((v: number, guardar = false) => {
    const limpa = limitarDivisao(v);
    setDivisao(limpa);
    if (guardar) gravarDivisao(limpa);
  }, []);
  const minimizar = useCallback((lado: LadoDoSom | null) => {
    setMinimizado(lado);
    gravarLadoMinimizado(lado);
  }, []);
  return { divisao, mudarDivisao, minimizado, minimizar };
}
