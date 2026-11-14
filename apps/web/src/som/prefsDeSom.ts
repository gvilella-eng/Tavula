import { useSyncExternalStore } from "react";

/**
 * N5: as preferências de som deste navegador (`tabletop:pref:som`): volume geral, da trilha e dos efeitos, "silenciar
 * tudo", "ouvir as zonas" (só no mestre) e se a pessoa dispensou o aviso "Clique para ativar o som". Pessoais: nunca vão
 * para a sala. O localStorage pode estar bloqueado: tudo em try/catch.
 */
export const CHAVE_SOM = "tabletop:pref:som";

export type PrefsDeSom = {
  /** 0 a 1. */
  geral: number;
  trilha: number;
  efeitos: number;
  silenciado: boolean;
  /** Mestre: ouvir o som das zonas onde está o token selecionado (assumido: desligado). */
  ouvirZonas: boolean;
  /** A pessoa tocou em "Agora não" no aviso do primeiro som. */
  avisoDispensado: boolean;
};

export const PREFS_DE_SOM_PADRAO: PrefsDeSom = {
  geral: 0.8,
  trilha: 1,
  efeitos: 1,
  silenciado: false,
  ouvirZonas: false,
  avisoDispensado: false,
};

const volume = (v: unknown, padrao: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : padrao;

export function lerPrefsDeSom(): PrefsDeSom {
  try {
    const bruto = localStorage.getItem(CHAVE_SOM);
    if (!bruto) return PREFS_DE_SOM_PADRAO;
    const v = JSON.parse(bruto) as Record<string, unknown> | null;
    if (v === null || typeof v !== "object") return PREFS_DE_SOM_PADRAO;
    return {
      geral: volume(v.geral, PREFS_DE_SOM_PADRAO.geral),
      trilha: volume(v.trilha, PREFS_DE_SOM_PADRAO.trilha),
      efeitos: volume(v.efeitos, PREFS_DE_SOM_PADRAO.efeitos),
      silenciado: v.silenciado === true,
      ouvirZonas: v.ouvirZonas === true,
      avisoDispensado: v.avisoDispensado === true,
    };
  } catch {
    return PREFS_DE_SOM_PADRAO;
  }
}

let valor = lerPrefsDeSom();
const ouvintes = new Set<() => void>();

export function prefsDeSom(): PrefsDeSom {
  return valor;
}

export function mudarPrefsDeSom(mudanca: Partial<PrefsDeSom>): void {
  valor = { ...valor, ...mudanca };
  try {
    localStorage.setItem(CHAVE_SOM, JSON.stringify(valor));
  } catch {
    // sem localStorage: vale só nesta sessão
  }
  for (const o of ouvintes) o();
}

export function assinarPrefsDeSom(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
  };
}

export function usePrefsDeSom(): PrefsDeSom {
  return useSyncExternalStore(assinarPrefsDeSom, prefsDeSom, () => PREFS_DE_SOM_PADRAO);
}

/** O resumo da sanfona: "Volume 80% · trilha ligada". */
export function resumoDoSom(p: PrefsDeSom): string {
  if (p.silenciado) return "Tudo silenciado";
  return `Volume ${Math.round(p.geral * 100)}% · trilha ${p.trilha > 0 ? "ligada" : "desligada"}`;
}
