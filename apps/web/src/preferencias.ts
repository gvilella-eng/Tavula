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

// --- régua (V13) -------------------------------------------------------------------------------

const CHAVE_REGUA_GRUDAR = "tabletop:pref:reguaGrudar";

/** A régua encaixa no grid: ligada por padrão (Alt inverte na hora). Livre = desligada. */
export function lerReguaGrudar(): boolean {
  try {
    return localStorage.getItem(CHAVE_REGUA_GRUDAR) !== "0";
  } catch {
    return true;
  }
}

export function gravarReguaGrudar(ligado: boolean): void {
  try {
    localStorage.setItem(CHAVE_REGUA_GRUDAR, ligado ? "1" : "0");
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

// --- blocos abertos do Compêndio (Q2, só deste navegador) --------------------------------------

export const CHAVE_BLOCOS_DO_COMPENDIO = "tabletop:pref:compendio-blocos";

/** O que a pessoa abriu (true) ou fechou (false) em cada bloco ("magias:3"); o que nunca mexeu não aparece. */
export function lerBlocosDoCompendio(): Record<string, boolean> {
  try {
    const bruto = localStorage.getItem(CHAVE_BLOCOS_DO_COMPENDIO);
    if (!bruto) return {};
    const lido: unknown = JSON.parse(bruto);
    if (typeof lido !== "object" || lido === null || Array.isArray(lido)) return {};
    const saida: Record<string, boolean> = {};
    for (const [id, v] of Object.entries(lido)) if (typeof v === "boolean") saida[id] = v;
    return saida;
  } catch {
    return {};
  }
}

export function gravarBlocoDoCompendio(id: string, aberto: boolean): void {
  try {
    const todos = lerBlocosDoCompendio();
    todos[id] = aberto;
    localStorage.setItem(CHAVE_BLOCOS_DO_COMPENDIO, JSON.stringify(todos));
  } catch {
    // sem localStorage: vale só nesta sessão
  }
}

// --- seções abertas da aba Preferências (P1, só deste navegador) -------------------------------

export const CHAVE_SECOES_DE_PREFERENCIAS = "tabletop:pref:secoes";

/** Só a Conta abre por padrão. */
export const SECAO_ABERTA_POR_PADRAO = "conta";

/** O que a pessoa abriu (true) ou fechou (false) em cada seção; o que ela nunca mexeu não aparece. */
export function lerSecoesDePreferencias(): Record<string, boolean> {
  try {
    const bruto = localStorage.getItem(CHAVE_SECOES_DE_PREFERENCIAS);
    if (!bruto) return {};
    const lido: unknown = JSON.parse(bruto);
    if (typeof lido !== "object" || lido === null || Array.isArray(lido)) return {};
    const saida: Record<string, boolean> = {};
    for (const [id, v] of Object.entries(lido)) if (typeof v === "boolean") saida[id] = v;
    return saida;
  } catch {
    return {};
  }
}

export function gravarSecaoDePreferencias(id: string, aberta: boolean): void {
  try {
    const todas = lerSecoesDePreferencias();
    todas[id] = aberta;
    localStorage.setItem(CHAVE_SECOES_DE_PREFERENCIAS, JSON.stringify(todas));
  } catch {
    // sem localStorage: vale só nesta sessão
  }
}

// --- itens de modelo recolhidos na ficha (FG1, só deste navegador) -------------------------------

export const CHAVE_ITENS_RECOLHIDOS = "tabletop:pref:itensRecolhidos";

/** Quais itens de modelo (tocha...) a pessoa recolheu: chave `personagem:modelo`; o que nunca mexeu fica aberto. */
export function lerItensRecolhidos(): Record<string, boolean> {
  try {
    const bruto = localStorage.getItem(CHAVE_ITENS_RECOLHIDOS);
    if (!bruto) return {};
    const lido: unknown = JSON.parse(bruto);
    if (typeof lido !== "object" || lido === null || Array.isArray(lido)) return {};
    const saida: Record<string, boolean> = {};
    for (const [id, v] of Object.entries(lido)) if (v === true) saida[id] = true;
    return saida;
  } catch {
    return {};
  }
}

export function gravarItemRecolhido(chave: string, recolhido: boolean): void {
  try {
    const todos = lerItensRecolhidos();
    if (recolhido) todos[chave] = true;
    else delete todos[chave];
    localStorage.setItem(CHAVE_ITENS_RECOLHIDOS, JSON.stringify(todos));
  } catch {
    // sem localStorage: vale só nesta sessão
  }
}
