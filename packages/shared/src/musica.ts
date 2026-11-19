import { z } from "zod";
import { HashSchema } from "./assets.ts";
import { CorDoSomSchema, IconeDoSomSchema } from "./mesadesom.ts";
import { VolumeSchema } from "./som.ts";

// ---------------------------------------------------------------------------------------------
// Música da mesa (MU1): uma biblioteca de músicas com etiquetas e energia (1 a 5) e botões que guardam um filtro
// (etiquetas, faixa de energia e ordem). A música toca por cima dos ambientes, igual para todos.
//
// - `Estado.musica` (a biblioteca e os botões): só o mestre recebe; entra na exportação.
// - `Estado.musicaTocando` (o que toca agora): todos recebem, sem a biblioteca; é dado da sessão e não entra na exportação.
//
// Sincronia sem evento no fim de cada música: a sala guarda a fila (a primeira passada) e o instante de início; as passadas
// seguintes são sorteadas por uma semente (a mesma conta em todo navegador). Cada cliente acha a música e o ponto
// atuais somando as durações.
// ---------------------------------------------------------------------------------------------

export const ENERGIA_MINIMA = 1;
export const ENERGIA_MAXIMA = 5;
/** A música sem nota vale 3. */
export const ENERGIA_PADRAO = 3;
export const MAXIMO_DE_FAIXAS = 500;
export const MAXIMO_DE_BOTOES_DE_MUSICA = 24;
export const MAXIMO_DE_ETIQUETAS = 12;
export const MAXIMO_DA_ETIQUETA = 30;
export const MAXIMO_DO_NOME_DO_BOTAO_DE_MUSICA = 16;
/** A transição suave entre músicas e ao trocar de botão (no cliente), em ms. */
export const FADE_DA_MUSICA_MS = 3000;
/** Passou disto da música atual, "anterior" recomeça a música em vez de ir para a anterior. */
export const RECOMECAR_SE_PASSOU_DE_MS = 3000;
const DURACAO_MINIMA_MS = 1000;
const DURACAO_MAXIMA_MS = 6 * 60 * 60 * 1000;
export const VOLUME_PADRAO_DA_MUSICA = 0.7;

export const ORDENS_DA_MUSICA = ["aleatoria", "crescente"] as const;
export const OrdemDaMusicaSchema = z.enum(ORDENS_DA_MUSICA);
export type OrdemDaMusica = z.infer<typeof OrdemDaMusicaSchema>;
export const ROTULO_DA_ORDEM: Record<OrdemDaMusica, string> = {
  aleatoria: "Aleatória, sem repetir",
  crescente: "Crescente",
};

export const EnergiaSchema = z.number().int().min(ENERGIA_MINIMA).max(ENERGIA_MAXIMA);
export const EtiquetaSchema = z.string().trim().min(1).max(MAXIMO_DA_ETIQUETA);
const EtiquetasSchema = z.array(EtiquetaSchema).max(MAXIMO_DE_ETIQUETAS);

export const FaixaDeMusicaSchema = z.object({
  /** O arquivo (um asset `som` já registrado). É também a identidade da música: o mesmo arquivo entra uma vez só. */
  hash: HashSchema,
  nome: z.string().trim().min(1).max(120),
  /** Lida no navegador do mestre ao importar. */
  duracaoMs: z.number().int().min(DURACAO_MINIMA_MS).max(DURACAO_MAXIMA_MS),
  /** Sem nota vale 3. */
  energia: EnergiaSchema.optional(),
  etiquetas: EtiquetasSchema,
  descricao: z.string().trim().min(1).max(200).optional(),
});
export type FaixaDeMusica = z.infer<typeof FaixaDeMusicaSchema>;

export const BotaoDeMusicaSchema = z
  .object({
    id: z.string().min(1).max(64),
    nome: z.string().trim().min(1).max(MAXIMO_DO_NOME_DO_BOTAO_DE_MUSICA),
    icone: IconeDoSomSchema,
    cor: CorDoSomSchema,
    etiquetas: EtiquetasSchema,
    energiaMin: EnergiaSchema,
    energiaMax: EnergiaSchema,
    ordem: OrdemDaMusicaSchema,
  })
  .refine((b) => b.energiaMin <= b.energiaMax, { message: "A energia mínima passa da máxima." });
export type BotaoDeMusica = z.infer<typeof BotaoDeMusicaSchema>;

export const BibliotecaDeMusicaSchema = z.object({
  faixas: z.array(FaixaDeMusicaSchema).max(MAXIMO_DE_FAIXAS),
  botoes: z.array(BotaoDeMusicaSchema).max(MAXIMO_DE_BOTOES_DE_MUSICA),
});
export type BibliotecaDeMusica = z.infer<typeof BibliotecaDeMusicaSchema>;

export const FiltroDeMusicaSchema = z
  .object({
    etiquetas: EtiquetasSchema,
    energiaMin: EnergiaSchema,
    energiaMax: EnergiaSchema,
    ordem: OrdemDaMusicaSchema,
  })
  .refine((f) => f.energiaMin <= f.energiaMax, { message: "A energia mínima passa da máxima." });
export type FiltroDeMusica = z.infer<typeof FiltroDeMusicaSchema>;

// --- a biblioteca ---------------------------------------------------------------------------

/** A biblioteca sem música e sem botão não precisa existir. */
export function bibliotecaOuNada(b: BibliotecaDeMusica): BibliotecaDeMusica | null {
  return b.faixas.length === 0 && b.botoes.length === 0 ? null : b;
}

/** Limpa uma lista de etiquetas: sem espaço sobrando, sem vazia, sem repetida (maiúscula não conta), no máximo 12. */
export function normalizarEtiquetas(lista: readonly string[]): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const bruta of lista) {
    const e = bruta.replace(/\s+/g, " ").trim().slice(0, MAXIMO_DA_ETIQUETA);
    const chave = e.toLocaleLowerCase("pt-BR");
    if (e === "" || vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(e);
    if (saida.length >= MAXIMO_DE_ETIQUETAS) break;
  }
  return saida;
}

const igualEtiqueta = (a: string, b: string) =>
  a.toLocaleLowerCase("pt-BR") === b.toLocaleLowerCase("pt-BR");

export const energiaDe = (f: Pick<FaixaDeMusica, "energia">): number => f.energia ?? ENERGIA_PADRAO;

/**
 * As músicas de um filtro: as que têm TODAS as etiquetas dele e energia dentro da faixa. Etiqueta sem diferenciar
 * maiúscula de minúscula.
 */
export function faixasDoFiltro(
  faixas: readonly FaixaDeMusica[],
  filtro: Pick<FiltroDeMusica, "etiquetas"> &
    Partial<Pick<FiltroDeMusica, "energiaMin" | "energiaMax">>,
): FaixaDeMusica[] {
  const min = filtro.energiaMin ?? ENERGIA_MINIMA;
  const max = filtro.energiaMax ?? ENERGIA_MAXIMA;
  return faixas.filter(
    (f) =>
      energiaDe(f) >= min &&
      energiaDe(f) <= max &&
      filtro.etiquetas.every((e) => f.etiquetas.some((x) => igualEtiqueta(x, e))),
  );
}

/** As etiquetas que existem e quantas músicas cada uma tem (em ordem alfabética). */
export function etiquetasDaBiblioteca(
  faixas: readonly FaixaDeMusica[],
): { nome: string; qtd: number }[] {
  const mapa = new Map<string, { nome: string; qtd: number }>();
  for (const f of faixas) {
    for (const e of f.etiquetas) {
      const chave = e.toLocaleLowerCase("pt-BR");
      const atual = mapa.get(chave);
      if (atual) atual.qtd++;
      else mapa.set(chave, { nome: e, qtd: 1 });
    }
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * As etiquetas de um arquivo vindas das subpastas. `caminho` é o caminho relativo (`Pasta/Combate/arquivo.mp3`, com `/` ou
 * `\`); com `comRaiz` o primeiro nome é a pasta escolhida (não vira etiqueta, como o `webkitRelativePath` do navegador).
 * Os arquivos soltos direto na pasta escolhida ficam sem etiqueta.
 */
export function etiquetasDoCaminho(caminho: string, comRaiz = true): string[] {
  const partes = caminho.split(/[\\/]+/).filter((p) => p !== "");
  const pastas = partes.slice(comRaiz ? 1 : 0, -1);
  return normalizarEtiquetas(pastas);
}

/** O botão como filtro (o que a sala usa para montar a fila). */
export const filtroDoBotao = (b: BotaoDeMusica): FiltroDeMusica => ({
  etiquetas: b.etiquetas,
  energiaMin: b.energiaMin,
  energiaMax: b.energiaMax,
  ordem: b.ordem,
});

/** O nome de um filtro sem botão (para o quadro "Trilha"): as etiquetas juntas, ou "Todas as músicas". */
export function nomeDoFiltro(f: Pick<FiltroDeMusica, "etiquetas">): string {
  return f.etiquetas.length > 0 ? f.etiquetas.join(" + ") : "Todas as músicas";
}

// --- sorteio e fila -------------------------------------------------------------------------

/** Um sorteador pequeno e determinístico (mulberry32): a mesma semente dá a mesma sequência em qualquer navegador. */
export function sorteador(semente: number): () => number {
  let a = Math.floor(semente) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Embaralha como um baralho (Fisher-Yates), sem mexer na lista de entrada. */
export function embaralhar<T>(lista: readonly T[], semente: number): T[] {
  const r = sorteador(semente);
  const saida = [...lista];
  for (let i = saida.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [saida[i], saida[j]] = [saida[j] as T, saida[i] as T];
  }
  return saida;
}

export const PecaSchema = z.object({
  hash: HashSchema,
  nome: z.string().min(1).max(120),
  duracaoMs: z.number().int().min(DURACAO_MINIMA_MS).max(DURACAO_MAXIMA_MS),
});
export type Peca = z.infer<typeof PecaSchema>;

const comoPeca = (f: FaixaDeMusica): Peca => ({
  hash: f.hash,
  nome: f.nome,
  duracaoMs: f.duracaoMs,
});

/**
 * A fila de um filtro. `inicial` é a primeira passada; `ciclo` é o que se repete depois (sorteado de novo a cada passada).
 * - Aleatória, sem repetir: a primeira passada é o baralho embaralhado; depois, de novo, com todas.
 * - Crescente: da energia mais baixa para a mais alta, sorteando dentro de cada energia; chegando ao topo, fica só nas de
 *   energia mais alta do filtro, em aleatória sem repetir.
 */
export function montarFila(
  faixas: readonly FaixaDeMusica[],
  ordem: OrdemDaMusica,
  semente: number,
): { inicial: Peca[]; ciclo: Peca[] } {
  if (faixas.length === 0) return { inicial: [], ciclo: [] };
  if (ordem === "aleatoria") {
    const todas = faixas.map(comoPeca);
    return { inicial: embaralhar(todas, semente), ciclo: todas };
  }
  const grupos = new Map<number, FaixaDeMusica[]>();
  for (const f of faixas) {
    const e = energiaDe(f);
    grupos.set(e, [...(grupos.get(e) ?? []), f]);
  }
  const niveis = [...grupos.keys()].sort((a, b) => a - b);
  const inicial = niveis.flatMap((n) =>
    embaralhar((grupos.get(n) ?? []).map(comoPeca), semente + n * 101),
  );
  const topo = niveis[niveis.length - 1] ?? ENERGIA_PADRAO;
  return { inicial, ciclo: (grupos.get(topo) ?? []).map(comoPeca) };
}

// --- o que toca agora -----------------------------------------------------------------------

/** O que dá para retomar (o botão anterior, do ponto onde parou). */
export const RetomadaSchema = z.object({
  botaoId: z.string().min(1).max(64).optional(),
  /** O nome do botão (ou das etiquetas do filtro que tocou sem salvar). */
  botaoNome: z.string().min(1).max(80),
  ordem: OrdemDaMusicaSchema,
  inicial: z.array(PecaSchema).max(MAXIMO_DE_FAIXAS),
  ciclo: z.array(PecaSchema).min(1).max(MAXIMO_DE_FAIXAS),
  semente: z.number().int().nonnegative(),
  /** O ponto da linha do tempo da fila, em ms. */
  decorridoMs: z.number().nonnegative(),
});
export type Retomada = z.infer<typeof RetomadaSchema>;

export const MusicaTocandoSchema = z.object({
  botaoId: z.string().min(1).max(64).optional(),
  botaoNome: z.string().min(1).max(80),
  ordem: OrdemDaMusicaSchema,
  inicial: z.array(PecaSchema).max(MAXIMO_DE_FAIXAS),
  ciclo: z.array(PecaSchema).min(1).max(MAXIMO_DE_FAIXAS),
  semente: z.number().int().nonnegative(),
  /** O volume da música (0 a 1); vale para todos, com o volume geral da mesa de som. */
  volume: VolumeSchema,
  tocando: z.boolean(),
  /** O instante (relógio da SALA, ms) em que a linha do tempo estaria no zero. Só vale com `tocando`. */
  inicioMs: z.number().nonnegative(),
  /** Pausada: o ponto da linha do tempo em que parou. */
  pausadoEm: z.number().nonnegative().optional(),
  /** O relógio da sala no instante em que esta cópia foi montada (cada evento e cada snapshot o refaz). */
  servidorMs: z.number().nonnegative().optional(),
  /** Só o mestre: o botão que tocava antes, para "Voltar a …". */
  anterior: RetomadaSchema.optional(),
});
export type MusicaTocando = z.infer<typeof MusicaTocandoSchema>;

type Linha = Pick<MusicaTocando, "inicial" | "ciclo" | "semente">;

export type PassoDaFila = { peca: Peca; inicioMs: number; fimMs: number };

/** Os passos da fila, um depois do outro, sem fim (as passadas depois da primeira são sorteadas pela semente). */
export function* passosDaFila(l: Linha): Generator<PassoDaFila, void> {
  let t = 0;
  let ultimo: string | undefined;
  for (const peca of l.inicial) {
    yield { peca, inicioMs: t, fimMs: t + peca.duracaoMs };
    t += peca.duracaoMs;
    ultimo = peca.hash;
  }
  for (let k = 1; ; k++) {
    const ordem = embaralhar(l.ciclo, l.semente + k * 7919);
    // A última da passada anterior nunca volta em seguida.
    if (ordem.length > 1 && ordem[0]?.hash === ultimo) {
      const fim = ordem.length - 1;
      [ordem[0], ordem[fim]] = [ordem[fim] as Peca, ordem[0] as Peca];
    }
    for (const peca of ordem) {
      yield { peca, inicioMs: t, fimMs: t + peca.duracaoMs };
      t += peca.duracaoMs;
      ultimo = peca.hash;
    }
  }
}

/** Passos a percorrer no máximo (um teto contra uma fila que nunca chega ao ponto pedido). */
const TETO_DE_PASSOS = 200_000;

export type Localizada = {
  atual: PassoDaFila;
  anterior: PassoDaFila | null;
  seguinte: PassoDaFila;
};

/** A música em que a linha do tempo está no ponto `ms`, a anterior e a seguinte. */
export function localizar(l: Linha, ms: number): Localizada | null {
  const ponto = Math.max(0, ms);
  let anterior: PassoDaFila | null = null;
  let n = 0;
  const it = passosDaFila(l);
  for (let r = it.next(); !r.done; r = it.next()) {
    const passo = r.value;
    if (ponto < passo.fimMs) {
      const seg = it.next();
      return seg.done ? null : { atual: passo, anterior, seguinte: seg.value };
    }
    anterior = passo;
    if (++n > TETO_DE_PASSOS) return null;
  }
  return null;
}

/** O ponto da linha do tempo da fila agora (pausada: onde parou). */
export function decorridoDaMusica(
  m: Pick<MusicaTocando, "tocando" | "inicioMs" | "pausadoEm">,
  agoraMs: number,
): number {
  return Math.max(0, m.tocando ? agoraMs - m.inicioMs : (m.pausadoEm ?? 0));
}

/** A música que toca agora e o ponto dela (ms). */
export function musicaAgora(
  m: MusicaTocando,
  agoraMs: number,
): { peca: Peca; pontoMs: number; seguinte: Peca; passoInicioMs: number } | null {
  const t = decorridoDaMusica(m, agoraMs);
  const l = localizar(m, t);
  if (!l) return null;
  return {
    peca: l.atual.peca,
    pontoMs: t - l.atual.inicioMs,
    seguinte: l.seguinte.peca,
    passoInicioMs: l.atual.inicioMs,
  };
}

function pontoParado(m: MusicaTocando, ms: number, agoraMs: number): MusicaTocando {
  const { servidorMs: _s, ...resto } = m;
  return m.tocando
    ? { ...resto, inicioMs: Math.max(0, agoraMs - ms), servidorMs: agoraMs }
    : { ...resto, pausadoEm: ms };
}

export const retomadaDe = (m: MusicaTocando, agoraMs: number): Retomada => ({
  ...(m.botaoId === undefined ? {} : { botaoId: m.botaoId }),
  botaoNome: m.botaoNome,
  ordem: m.ordem,
  inicial: m.inicial,
  ciclo: m.ciclo,
  semente: m.semente,
  decorridoMs: decorridoDaMusica(m, agoraMs),
});

/**
 * Começa uma fila nova do filtro (`faixas` já são as do filtro). A que tocava antes (tocando ou pausada) fica em
 * `anterior`, para "Voltar". Sem música no filtro devolve `null`.
 */
export function iniciarMusica(
  dados: {
    botaoId?: string | undefined;
    botaoNome: string;
    ordem: OrdemDaMusica;
    faixas: readonly FaixaDeMusica[];
    volume: number;
  },
  antes: MusicaTocando | undefined,
  agoraMs: number,
): MusicaTocando | null {
  const semente = Math.floor(agoraMs) % 2147483647;
  const { inicial, ciclo } = montarFila(dados.faixas, dados.ordem, semente);
  if (ciclo.length === 0) return null;
  return {
    ...(dados.botaoId === undefined ? {} : { botaoId: dados.botaoId }),
    botaoNome: dados.botaoNome,
    ordem: dados.ordem,
    inicial,
    ciclo,
    semente,
    volume: dados.volume,
    tocando: true,
    inicioMs: agoraMs,
    servidorMs: agoraMs,
    ...(antes ? { anterior: retomadaDe(antes, agoraMs) } : {}),
  };
}

export function pausarMusica(m: MusicaTocando, agoraMs: number): MusicaTocando {
  if (!m.tocando) return m;
  const { servidorMs: _s, ...resto } = m;
  return { ...resto, tocando: false, pausadoEm: decorridoDaMusica(m, agoraMs) };
}

export function retomarMusica(m: MusicaTocando, agoraMs: number): MusicaTocando {
  if (m.tocando) return m;
  const { pausadoEm, servidorMs: _s, ...resto } = m;
  return {
    ...resto,
    tocando: true,
    inicioMs: Math.max(0, agoraMs - (pausadoEm ?? 0)),
    servidorMs: agoraMs,
  };
}

/** Pula para o começo da música seguinte (pausada, segue pausada). */
export function proximaMusica(m: MusicaTocando, agoraMs: number): MusicaTocando {
  const l = localizar(m, decorridoDaMusica(m, agoraMs));
  return l ? pontoParado(m, l.atual.fimMs, agoraMs) : m;
}

/** Passou de 3 s da música: recomeça ela; senão, volta para a anterior (a primeira da fila recomeça). */
export function anteriorMusica(m: MusicaTocando, agoraMs: number): MusicaTocando {
  const t = decorridoDaMusica(m, agoraMs);
  const l = localizar(m, t);
  if (!l) return m;
  const alvo =
    t - l.atual.inicioMs > RECOMECAR_SE_PASSOU_DE_MS || l.anterior === null
      ? l.atual.inicioMs
      : l.anterior.inicioMs;
  return pontoParado(m, alvo, agoraMs);
}

/** "Voltar a <botão anterior>": o que tocava antes volta do ponto onde parou; o que tocava agora vira o "anterior". */
export function voltarMusica(m: MusicaTocando, agoraMs: number): MusicaTocando | null {
  const a = m.anterior;
  if (!a) return null;
  return {
    ...(a.botaoId === undefined ? {} : { botaoId: a.botaoId }),
    botaoNome: a.botaoNome,
    ordem: a.ordem,
    inicial: a.inicial,
    ciclo: a.ciclo,
    semente: a.semente,
    volume: m.volume,
    tocando: true,
    inicioMs: Math.max(0, agoraMs - a.decorridoMs),
    servidorMs: agoraMs,
    anterior: retomadaDe(m, agoraMs),
  };
}

/** A música como o jogador a recebe: sem o "anterior" (que é do mestre). */
export function musicaParaJogador(m: MusicaTocando): MusicaTocando {
  const { anterior: _anterior, ...resto } = m;
  return resto;
}

/** A cópia com o relógio da sala de `agoraMs` (cada quem calcula o desvio e o ponto em que a música está). */
export function musicaComRelogio(m: MusicaTocando, agoraMs: number): MusicaTocando {
  return { ...m, servidorMs: agoraMs };
}

/** A música usa este arquivo (na fila, na primeira passada ou no ciclo)? */
export function musicaUsaOHash(m: Pick<MusicaTocando, "inicial" | "ciclo">, hash: string): boolean {
  return m.inicial.some((p) => p.hash === hash) || m.ciclo.some((p) => p.hash === hash);
}

/** Texto de "m:ss" ou "h:mm:ss" para uma duração. */
export function duracaoLegivel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${seg}` : `${m}:${seg}`;
}
