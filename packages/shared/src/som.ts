import { z } from "zod";
import { HashSchema } from "./assets.ts";

// ---------------------------------------------------------------------------------------------
// Som ambiente (N5): trilha, efeitos, som por zona e a ação `som.tocar` das automações.
//
// Os arquivos de áudio são assets `som` (ficam no computador do mestre e viajam por pedaços, como as
// imagens). A sala só guarda a referência: hash, nome e volume. Este arquivo tem os DADOS e as contas puras;
// quem ouve o som de uma zona fica em `somnucleo.ts`.
// ---------------------------------------------------------------------------------------------

/** O tipo MIME de um arquivo de som pelo nome (o navegador às vezes não diz); `null` se não é mp3, ogg ou wav. */
export function mimeDoSomPeloNome(nome: string): string | null {
  const m = /\.(mp3|ogg|wav)$/i.exec(nome);
  if (!m) return null;
  const ext = (m[1] ?? "").toLowerCase();
  return ext === "mp3" ? "audio/mpeg" : ext === "ogg" ? "audio/ogg" : "audio/wav";
}

export const ehArquivoDeSom = (nome: string) => mimeDoSomPeloNome(nome) !== null;

/** 0 (mudo) a 1 (cheio). */
export const VolumeSchema = z.number().min(0).max(1);

const NomeDoSom = z.string().trim().min(1).max(200);

/** A trilha que toca agora (um som por vez, em laço). `inicioMs` e `servidorMs` são o relógio da SALA (ms reais). */
export const TrilhaSchema = z.object({
  hash: HashSchema,
  nome: NomeDoSom,
  volume: VolumeSchema,
  /** Quando a trilha começou, no relógio real da sala. Quem entra no meio calcula o ponto a partir disto. */
  inicioMs: z.number().nonnegative(),
  /**
   * O relógio da sala no instante em que esta cópia foi montada (o evento, o snapshot): com o relógio do
   * navegador dá o desvio entre os dois. Sem ele o cliente supõe os relógios iguais.
   */
  servidorMs: z.number().nonnegative().optional(),
});
export type Trilha = z.infer<typeof TrilhaSchema>;

/** A trilha padrão de uma cena: começa ao levar o grupo para ela. */
export const TrilhaDaCenaSchema = z.object({
  hash: HashSchema,
  nome: NomeDoSom,
  volume: VolumeSchema,
});
export type TrilhaDaCena = z.infer<typeof TrilhaDaCenaSchema>;

/** O som de uma zona "enquanto dentro": um som, um volume e o laço. */
export const SomDaZonaSchema = z.object({
  hash: HashSchema,
  nome: NomeDoSom,
  volume: VolumeSchema,
  laco: z.boolean().default(true),
});
export type SomDaZona = z.infer<typeof SomDaZonaSchema>;

/** O que o jogador ouve por causa de uma zona: só o som, nunca a zona (forma, nome, regras). */
export const SomTocandoSchema = z.object({
  hash: HashSchema,
  volume: VolumeSchema,
  laco: z.boolean(),
});
export type SomTocando = z.infer<typeof SomTocandoSchema>;

/** Para quem um efeito de som vale (as automações e o painel). */
export const AlvoDoEfeitoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("todos") }),
  /** Quem está vendo esta cena. */
  z.object({ tipo: z.literal("cena"), cenaId: z.string().min(1).max(64) }),
  /** Quem controla este token. */
  z.object({ tipo: z.literal("token"), tokenId: z.string().min(1).max(64) }),
]);
export type AlvoDoEfeito = z.infer<typeof AlvoDoEfeitoSchema>;

export const PARA_QUEM_O_SOM = ["todos", "cena", "token"] as const;
export const ParaQuemOSomSchema = z.enum(PARA_QUEM_O_SOM);

/** A transição suave da trilha, em ms. */
export const TRANSICAO_DA_TRILHA_MS = 2000;
/** O fade de entrada e saída do som de uma zona, em ms. */
export const FADE_DA_ZONA_MS = 1200;

/**
 * O ponto da trilha, em segundos, para quem entra agora: o tempo desde o início (no relógio da sala) dobrado pela
 * duração do arquivo (a trilha toca em laço). `desvioMs` = relógio da sala menos o do navegador. Sem duração
 * conhecida (ainda não carregou) devolve o tempo corrido, e quem toca dobra depois.
 */
export function pontoDaTrilha(
  trilha: Pick<Trilha, "inicioMs">,
  agoraLocalMs: number,
  desvioMs: number,
  duracaoS?: number,
): number {
  const corrido = Math.max(0, (agoraLocalMs + desvioMs - trilha.inicioMs) / 1000);
  if (duracaoS === undefined || !(duracaoS > 0)) return corrido;
  return corrido % duracaoS;
}

/** O desvio entre o relógio da sala e o do navegador, a partir de uma cópia da trilha recém-recebida. */
export function desvioDoRelogio(trilha: Pick<Trilha, "servidorMs">, agoraLocalMs: number): number {
  return trilha.servidorMs === undefined ? 0 : trilha.servidorMs - agoraLocalMs;
}

/** O volume final: o do som vezes o geral e o da categoria (0 a 1); `silenciado` zera tudo. */
export function volumeFinal(
  volume: number,
  geral: number,
  categoria: number,
  silenciado: boolean,
): number {
  if (silenciado) return 0;
  const v = volume * geral * categoria;
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}
