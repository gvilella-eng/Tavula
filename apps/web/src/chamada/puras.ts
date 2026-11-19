// CH1: as regras puras da chamada na tela (negociação, volume, quem fala, desfoque, medidas). Sem navegador aqui: o que
// precisa de WebRTC ou de WebAudio fica em `malha.ts` e `motorDeAudio.ts`, e usa estas funções.

// --- negociação (perfect negotiation) -------------------------------------------------------------------------

/**
 * Quem cede quando as duas pontas oferecem ao mesmo tempo ("educado"): o de id menor. Os dois lados chegam à mesma
 * resposta sem conversar, porque comparam os mesmos dois ids.
 */
export function ehEducado(meuId: string, outroId: string): boolean {
  return meuId < outroId;
}

/**
 * Pode haver colisão? Chega uma oferta enquanto esta ponta está oferecendo (ou ainda não estável). O indelicado ignora a
 * oferta que colide; o educado a aceita (desfazendo a própria).
 */
export function ofertaColide(
  tipoDoQueChegou: "offer" | "answer",
  estavel: boolean,
  oferecendo: boolean,
): boolean {
  return tipoDoQueChegou === "offer" && (oferecendo || !estavel);
}

export function ignoraOferta(
  educado: boolean,
  tipoDoQueChegou: "offer" | "answer",
  estavel: boolean,
  oferecendo: boolean,
): boolean {
  return !educado && ofertaColide(tipoDoQueChegou, estavel, oferecendo);
}

// --- servidores ICE (internet) -------------------------------------------------------------------------------

/**
 * Lê a variável `VITE_CHAMADA_ICE_SERVERS` (JSON: lista de `{ urls, username?, credential? }`). Sem ela, ou com ela
 * quebrada, a lista é vazia: no mesmo computador e na rede local basta. Nada é buscado da internet por padrão.
 */
export function iceServersDoTexto(texto: string | undefined): RTCIceServer[] {
  if (!texto || texto.trim() === "") return [];
  try {
    const v: unknown = JSON.parse(texto);
    if (!Array.isArray(v)) return [];
    const saida: RTCIceServer[] = [];
    for (const item of v) {
      if (typeof item !== "object" || item === null) continue;
      const o = item as Record<string, unknown>;
      const urls = o.urls;
      const urlsOk =
        typeof urls === "string" ||
        (Array.isArray(urls) && urls.every((u) => typeof u === "string"));
      if (!urlsOk) continue;
      saida.push({
        urls: urls as string | string[],
        ...(typeof o.username === "string" ? { username: o.username } : {}),
        ...(typeof o.credential === "string" ? { credential: o.credential } : {}),
      });
    }
    return saida;
  } catch {
    return [];
  }
}

// --- qualidade do vídeo ---------------------------------------------------------------------------------------

/** O teto do bitrate de cada vídeo enviado: com mais de 3 pessoas cada uma manda para todas, então cai. */
export function bitrateDoVideo(pessoasNaChamada: number): number {
  if (pessoasNaChamada <= 3) return 900_000;
  if (pessoasNaChamada <= 5) return 450_000;
  return 250_000;
}

// --- volume por pessoa ----------------------------------------------------------------------------------------

export const VOLUME_MINIMO = 0;
export const VOLUME_MAXIMO = 200;
export const VOLUME_PADRAO = 100;

export type PreferenciaDePessoa = { volume: number; silenciado: boolean };

export function limitarVolume(v: number): number {
  if (!Number.isFinite(v)) return VOLUME_PADRAO;
  return Math.round(Math.min(VOLUME_MAXIMO, Math.max(VOLUME_MINIMO, v)));
}

/** O ganho que vai ao `GainNode`: 0 se a pessoa está silenciada para mim ou eu parei de ouvir. */
export function ganhoDaPessoa(pref: PreferenciaDePessoa, surdo: boolean): number {
  if (surdo || pref.silenciado) return 0;
  return limitarVolume(pref.volume) / 100;
}

const PREFIXO = "tabletop:pref:chamada:";
export const chaveDaPessoa = (mesaId: string, usuarioId: string) =>
  `${PREFIXO}pessoa:${mesaId}:${usuarioId}`;

/** Lembrado por mesa e pessoa nas preferências locais (nunca vai à sala). */
export function lerPreferenciaDePessoa(mesaId: string, usuarioId: string): PreferenciaDePessoa {
  try {
    const bruto = localStorage.getItem(chaveDaPessoa(mesaId, usuarioId));
    if (!bruto) return { volume: VOLUME_PADRAO, silenciado: false };
    const v = JSON.parse(bruto) as Record<string, unknown> | null;
    return {
      volume: typeof v?.volume === "number" ? limitarVolume(v.volume) : VOLUME_PADRAO,
      silenciado: v?.silenciado === true,
    };
  } catch {
    return { volume: VOLUME_PADRAO, silenciado: false };
  }
}

export function gravarPreferenciaDePessoa(
  mesaId: string,
  usuarioId: string,
  pref: PreferenciaDePessoa,
): void {
  try {
    localStorage.setItem(
      chaveDaPessoa(mesaId, usuarioId),
      JSON.stringify({ volume: limitarVolume(pref.volume), silenciado: pref.silenciado }),
    );
  } catch {
    // sem localStorage: vale só nesta janela
  }
}

// --- preferências da chamada (aparelhos, ruído, sons, fundo, lista) ---------------------------------------------

export type PreferenciasDaChamada = {
  cameraId: string;
  microfoneId: string;
  saidaId: string;
  reduzirRuido: boolean;
  entrarMudo: boolean;
  sons: boolean;
  fundo: "nenhum" | "desfocar" | "forte";
  lista: boolean;
};

export const PREFERENCIAS_PADRAO: PreferenciasDaChamada = {
  cameraId: "",
  microfoneId: "",
  saidaId: "",
  reduzirRuido: true,
  entrarMudo: false,
  sons: true,
  fundo: "nenhum",
  lista: true,
};

const CHAVE_GERAL = `${PREFIXO}geral`;

export function lerPreferenciasDaChamada(): PreferenciasDaChamada {
  try {
    const bruto = localStorage.getItem(CHAVE_GERAL);
    if (!bruto) return PREFERENCIAS_PADRAO;
    const v = (JSON.parse(bruto) ?? {}) as Record<string, unknown>;
    const texto = (x: unknown) => (typeof x === "string" ? x.slice(0, 300) : "");
    const bool = (x: unknown, padrao: boolean) => (typeof x === "boolean" ? x : padrao);
    return {
      cameraId: texto(v.cameraId),
      microfoneId: texto(v.microfoneId),
      saidaId: texto(v.saidaId),
      reduzirRuido: bool(v.reduzirRuido, PREFERENCIAS_PADRAO.reduzirRuido),
      entrarMudo: bool(v.entrarMudo, PREFERENCIAS_PADRAO.entrarMudo),
      sons: bool(v.sons, PREFERENCIAS_PADRAO.sons),
      fundo: v.fundo === "desfocar" || v.fundo === "forte" ? v.fundo : "nenhum",
      lista: bool(v.lista, PREFERENCIAS_PADRAO.lista),
    };
  } catch {
    return PREFERENCIAS_PADRAO;
  }
}

export function gravarPreferenciasDaChamada(p: PreferenciasDaChamada): void {
  try {
    localStorage.setItem(CHAVE_GERAL, JSON.stringify(p));
  } catch {
    // sem localStorage: vale só nesta janela
  }
}

// --- quem fala -------------------------------------------------------------------------------------------------

/** O nível (0 a 1, raiz da média dos quadrados) de um bloco de amostras de 0 a 255 centradas em 128 (`AnalyserNode`). */
export function nivelDasAmostras(amostras: ArrayLike<number>): number {
  if (amostras.length === 0) return 0;
  let soma = 0;
  for (let i = 0; i < amostras.length; i++) {
    const x = ((amostras[i] ?? 128) - 128) / 128;
    soma += x * x;
  }
  return Math.sqrt(soma / amostras.length);
}

export const LIMIAR_DE_FALA_LIGA = 0.035;
export const LIMIAR_DE_FALA_DESLIGA = 0.02;
export const SEGURAR_FALA_MS = 450;

/**
 * Histerese: liga acima de um limiar e só desliga abaixo de outro, mais baixo, depois de um tempo sem passar dele (o
 * anel verde não pisca no meio de uma frase). Cada cliente calcula sozinho; nada disto trafega.
 */
export class AvaliadorDeFala {
  private falando = false;
  private ultimoAltoMs = Number.NEGATIVE_INFINITY;

  atualizar(nivel: number, agoraMs: number): boolean {
    if (nivel >= LIMIAR_DE_FALA_LIGA) {
      this.falando = true;
      this.ultimoAltoMs = agoraMs;
    } else if (this.falando) {
      if (nivel >= LIMIAR_DE_FALA_DESLIGA) this.ultimoAltoMs = agoraMs;
      else if (agoraMs - this.ultimoAltoMs >= SEGURAR_FALA_MS) this.falando = false;
    }
    return this.falando;
  }

  reiniciar(): void {
    this.falando = false;
    this.ultimoAltoMs = Number.NEGATIVE_INFINITY;
  }
}

// --- desfoque ---------------------------------------------------------------------------------------------------

/** O raio do desfoque do fundo, em pixels de um quadro 640x360. */
export const RAIO_DO_DESFOQUE = { nenhum: 0, desfocar: 7, forte: 16 } as const;

export const FPS_MINIMO_DO_DESFOQUE = 12;
export const JANELA_DO_FPS_MS = 5_000;

/**
 * Vigia a velocidade do desfoque: se passar `JANELA_DO_FPS_MS` abaixo de `FPS_MINIMO_DO_DESFOQUE`, manda desligar. Cada
 * quadro processado chama `quadro(agora)`; devolve `true` quando é para desistir.
 */
export class VigiaDeFps {
  private inicio: number | null = null;
  private quadros = 0;
  private abaixoDesde: number | null = null;

  quadro(agoraMs: number): boolean {
    if (this.inicio === null) {
      this.inicio = agoraMs;
      this.quadros = 0;
    }
    this.quadros++;
    const passou = agoraMs - this.inicio;
    if (passou < 1_000) return false;
    const fps = (this.quadros * 1_000) / passou;
    this.inicio = agoraMs;
    this.quadros = 0;
    if (fps >= FPS_MINIMO_DO_DESFOQUE) {
      this.abaixoDesde = null;
      return false;
    }
    this.abaixoDesde ??= agoraMs;
    return agoraMs - this.abaixoDesde >= JANELA_DO_FPS_MS;
  }
}

/**
 * A máscara do segmentador diz a "chance de ser pessoa" ou a "chance de ser fundo", conforme o modelo. A pessoa costuma
 * estar no meio do quadro: se o meio é mais "baixo" que a borda, a máscara está ao contrário. Devolve `true` para inverter.
 */
export function mascaraEstaInvertida(
  mascara: ArrayLike<number>,
  largura: number,
  altura: number,
): boolean {
  if (largura < 8 || altura < 8 || mascara.length < largura * altura) return false;
  let meio = 0;
  let nMeio = 0;
  let borda = 0;
  let nBorda = 0;
  const x0 = Math.floor(largura * 0.3);
  const x1 = Math.floor(largura * 0.7);
  const y0 = Math.floor(altura * 0.35);
  const y1 = Math.floor(altura * 0.85);
  for (let y = 0; y < altura; y += 2) {
    for (let x = 0; x < largura; x += 2) {
      const v = mascara[y * largura + x] ?? 0;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        meio += v;
        nMeio++;
      } else if (x < largura * 0.12 || x >= largura * 0.88) {
        borda += v;
        nBorda++;
      }
    }
  }
  if (nMeio === 0 || nBorda === 0) return false;
  return meio / nMeio < borda / nBorda;
}

// --- medidas e textos -----------------------------------------------------------------------------------------

/** Abaixo disto a janela vira a disposição estreita (linhas com miniatura), sozinha. */
export const LARGURA_DA_DISPOSICAO_ESTREITA = 560;

export const ehEstreita = (largura: number): boolean => largura < LARGURA_DA_DISPOSICAO_ESTREITA;

/** "1:42:07" (com hora) ou "42:07". */
export function formatarTempo(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${m}:${dois(s)}`;
}

/** A inicial do nome (a primeira letra, em maiúscula). */
export function inicialDe(nome: string): string {
  const letra = [...nome.trim()][0];
  return letra ? letra.toLocaleUpperCase("pt-BR") : "?";
}

/** "Ana", "Ana e Bruno", "Ana, Bruno e Caio". */
export function listaDeNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
