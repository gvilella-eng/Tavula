// Preferências locais (só deste navegador). O localStorage pode estar bloqueado: tudo em try/catch.

const CHAVE_ENCAIXE = "tabletop:pref:encaixe";

/** Encaixe no grid ao arrastar token: ligado por padrão (Alt solta sem encaixe). */
export function lerEncaixePadrao(): boolean {
  try {
    return localStorage.getItem(CHAVE_ENCAIXE) !== "0";
  } catch {
    return true;
  }
}

export function gravarEncaixePadrao(ligado: boolean): void {
  try {
    localStorage.setItem(CHAVE_ENCAIXE, ligado ? "1" : "0");
  } catch {
    // sem localStorage: vale só nesta sessão
  }
}

// --- largura do painel direito (só deste navegador) --------------------------------------------

const CHAVE_LARGURA_DO_PAINEL = "tabletop:pref:larguraDoPainel";

export const LARGURA_MINIMA_DO_PAINEL = 300;
export const LARGURA_PADRAO_DO_PAINEL = 360;

/** Mínimo de 300 px e máximo de 1/4 da janela (se 1/4 for menos que 300, fica 300). */
export function limitesDoPainel(larguraDaJanela: number): { min: number; max: number } {
  return {
    min: LARGURA_MINIMA_DO_PAINEL,
    max: Math.max(LARGURA_MINIMA_DO_PAINEL, Math.floor(larguraDaJanela / 4)),
  };
}

export function ajustarLarguraDoPainel(largura: number, larguraDaJanela: number): number {
  const { min, max } = limitesDoPainel(larguraDaJanela);
  return Math.round(Math.min(max, Math.max(min, largura)));
}

/** A largura que a pessoa escolheu neste navegador (ou a padrão). Sem ajuste à janela. */
export function lerLarguraDoPainel(): number {
  try {
    const v = Number(localStorage.getItem(CHAVE_LARGURA_DO_PAINEL));
    return Number.isFinite(v) && v > 0 ? v : LARGURA_PADRAO_DO_PAINEL;
  } catch {
    return LARGURA_PADRAO_DO_PAINEL;
  }
}

export function gravarLarguraDoPainel(largura: number): void {
  try {
    localStorage.setItem(CHAVE_LARGURA_DO_PAINEL, String(Math.round(largura)));
  } catch {
    // sem localStorage: vale só nesta sessão
  }
}
