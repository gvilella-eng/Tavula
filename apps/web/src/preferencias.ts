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

// --- janelas flutuantes (posição, tamanho e minimizada, por janela e por navegador) -----------------

/** O que cada pessoa escolheu para uma janela. Falta o campo = vale o padrão. Nunca vai para a sala. */
export type PreferenciaDeJanela = {
  x?: number;
  y?: number;
  largura?: number;
  altura?: number;
  minimizada?: boolean;
};

export const chaveDaJanela = (id: string) => `tabletop:pref:janela:${id}`;

const numeroOuNada = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined;

export function lerJanela(id: string): PreferenciaDeJanela {
  try {
    const bruto = localStorage.getItem(chaveDaJanela(id));
    if (!bruto) return {};
    const v = JSON.parse(bruto) as Record<string, unknown> | null;
    if (v === null || typeof v !== "object") return {};
    const x = numeroOuNada(v.x);
    const y = numeroOuNada(v.y);
    const largura = numeroOuNada(v.largura);
    const altura = numeroOuNada(v.altura);
    return {
      // posição só vale com os dois eixos
      ...(x !== undefined && y !== undefined ? { x, y } : {}),
      ...(largura !== undefined && largura > 0 ? { largura } : {}),
      ...(altura !== undefined && altura > 0 ? { altura } : {}),
      ...(v.minimizada === true ? { minimizada: true } : {}),
    };
  } catch {
    return {};
  }
}

export function gravarJanela(id: string, pref: PreferenciaDeJanela): void {
  try {
    const limpa: PreferenciaDeJanela = {
      ...(pref.x !== undefined && pref.y !== undefined
        ? { x: Math.round(pref.x), y: Math.round(pref.y) }
        : {}),
      ...(pref.largura !== undefined ? { largura: Math.round(pref.largura) } : {}),
      ...(pref.altura !== undefined ? { altura: Math.round(pref.altura) } : {}),
      ...(pref.minimizada ? { minimizada: true } : {}),
    };
    if (Object.keys(limpa).length === 0) localStorage.removeItem(chaveDaJanela(id));
    else localStorage.setItem(chaveDaJanela(id), JSON.stringify(limpa));
  } catch {
    // sem localStorage: vale só nesta sessão
  }
}

// --- ordem de turno: seção "Montar" aberta ou fechada (só deste navegador) --------------------------

const CHAVE_MONTAR_DA_ORDEM = "tabletop:pref:ordem:montar";

/** O que a pessoa escolheu para a seção "Montar" da ordem de turno; `null` = nunca escolheu (vale o padrão). */
export function lerMontarDaOrdem(): boolean | null {
  try {
    const v = localStorage.getItem(CHAVE_MONTAR_DA_ORDEM);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function gravarMontarDaOrdem(aberta: boolean): void {
  try {
    localStorage.setItem(CHAVE_MONTAR_DA_ORDEM, aberta ? "1" : "0");
  } catch {
    // sem localStorage: vale só nesta sessão
  }
}
