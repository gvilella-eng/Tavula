import { z } from "zod";
import type { Estado, Usuario } from "./estado.ts";
import {
  fichaVisivelPara,
  handoutVisivelPara,
  personagemVisivelPara,
  tokenVisivelPara,
} from "./mapa.ts";

// ---------------------------------------------------------------------------------------------
// Limites e constantes (PROJETO.md 4.3)
// ---------------------------------------------------------------------------------------------

/** Tamanho de cada pedaço de arquivo trafegado (256 KB). O último pode ser menor. */
export const TAMANHO_PEDACO = 256 * 1024;
/** Tipo do frame binário que carrega um pedaço. */
export const TIPO_FRAME_PEDACO = 1;
/** `[1 byte tipo][32 bytes hash][uint32 índice BE][uint32 total BE]` e depois os dados. */
export const TAMANHO_CABECALHO_FRAME = 1 + 32 + 4 + 4;

export const LIMITES_DE_ASSET = {
  /** Arquivo já processado (cada tile conta como um arquivo). */
  bytesPorArquivo: 30 * 1024 * 1024,
  /** Soma dos tiles de um mapa. */
  bytesPorMapa: 200 * 1024 * 1024,
  tilesPorMapa: 64,
  /** Lado máximo de um tile (e teto do limite de textura da GPU). */
  ladoMaximoDoTile: 4096,
  ladoMaximoDoMapaSemTiles: 8192,
  /** Token e retrato são redimensionados para no máximo isto. */
  ladoMaximoDoToken: 512,
  /** Teto de assets registrados na sala (contra abuso). */
  assetsNaSala: 2000,
  /** Teto de metas numa única mensagem `asset.registrar` (manifesto + tiles). */
  metasPorRegistro: 65,
  /** Teto do inventário que o cliente manda ao conectar. */
  inventario: 5000,
  /** O `magias.json` do compêndio (Lote 14): texto, nunca imagem. */
  bytesDoCompendio: 16 * 1024 * 1024,
  /** Um arquivo de som (N5: mp3, ogg ou wav): 20 MB são 80 pedaços de 256 KB (assumido). */
  bytesDoSom: 20 * 1024 * 1024,
} as const;

/** Os formatos de som aceitos (N5: mp3, ogg e wav), pelo tipo MIME que o navegador diz. */
export const MIMES_DE_SOM = [
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
] as const;

export function mimeDeSomValido(mime: string): boolean {
  return (MIMES_DE_SOM as readonly string[]).includes(mime.toLowerCase());
}

export const PX_POR_QUADRADO_PADRAO = 70;

/** O arquivo cifrado passa do original por 12 bytes de IV e 16 de etiqueta do AES-GCM (ver `cifra.ts`). */
export const ACRESCIMO_DA_CIFRA = 12 + 16;

// ---------------------------------------------------------------------------------------------
// Metadados
// ---------------------------------------------------------------------------------------------

/**
 * `cifrado`: arquivo opaco do pré-envio de uma cena (Lote 4). Sem nome nem dimensões reais; todo
 * jogador pode baixá-lo, mas só abre com a chave que a sala entrega ao levar o grupo.
 * `compendio` (Lote 14): o `magias.json` do mestre (texto, sem dimensões reais: 1 x 1). Só o compêndio
 * que a mesa definiu (`Estado.compendio`) é baixável por todos; os demais seguem a regra comum.
 * `som` (N5): arquivo de áudio (mp3, ogg ou wav), sem dimensões reais (1 x 1). Todo jogador pode baixá-lo (a sala só
 * diz qual tocar); a zona que o usa continua secreta, porque o hash não diz de onde veio.
 */
export const TIPOS_DE_ASSET = [
  "mapa",
  "token",
  "retrato",
  "tile",
  "cifrado",
  "compendio",
  "som",
] as const;
export const TipoDeAssetSchema = z.enum(TIPOS_DE_ASSET);
export type TipoDeAsset = z.infer<typeof TipoDeAssetSchema>;

/** SHA-256 em hexadecimal minúsculo (64 caracteres). */
export const HashSchema = z.string().regex(/^[0-9a-f]{64}$/, "hash inválido");

export const TileSchema = z.object({
  hash: HashSchema,
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
});
export type Tile = z.infer<typeof TileSchema>;

export const AssetMetaSchema = z.object({
  /** SHA-256 do arquivo já processado (no mapa fatiado: do manifesto, ver `hashDoManifesto`). */
  hash: HashSchema,
  tipo: TipoDeAssetSchema,
  mime: z.string().min(1).max(64),
  /** Tamanho do arquivo processado; 0 no manifesto de um mapa fatiado (os bytes estão nos tiles). */
  bytes: z.number().int().nonnegative(),
  largura: z.number().int().positive().max(65_536),
  altura: z.number().int().positive().max(65_536),
  donoId: z.string().min(1).max(64),
  nomeOriginal: z.string().min(1).max(200),
  /** SHA-256 de cada pedaço de 256 KB. Vazio no manifesto. */
  pedacos: z
    .array(HashSchema)
    .max(Math.ceil((LIMITES_DE_ASSET.bytesPorArquivo + ACRESCIMO_DA_CIFRA) / TAMANHO_PEDACO)),
  /** Mapa fatiado: o asset do mapa vira manifesto e cada tile é um asset `tile`. */
  tiles: z.array(TileSchema).min(1).max(LIMITES_DE_ASSET.tilesPorMapa).optional(),
});
export type AssetMeta = z.infer<typeof AssetMetaSchema>;

/** Meta como o cliente a envia: o dono é sempre quem mandou (a sala preenche). */
export const MetaNovaSchema = AssetMetaSchema.omit({ donoId: true });
export type MetaNova = z.infer<typeof MetaNovaSchema>;

export function ehManifesto(meta: Pick<AssetMeta, "tiles">): boolean {
  return meta.tiles !== undefined;
}

/** Quantos pedaços tem um arquivo de `bytes` bytes. */
export function totalDePedacos(bytes: number): number {
  return Math.ceil(bytes / TAMANHO_PEDACO);
}

/** Confere a coerência de uma meta (limites, pedaços, tiles). Devolve o motivo ou `null`. */
export function validarMeta(meta: MetaNova | AssetMeta): string | null {
  if (meta.tiles !== undefined) {
    if (meta.tipo !== "mapa") return "só mapa pode ter tiles";
    if (meta.bytes !== 0 || meta.pedacos.length !== 0) return "manifesto não leva bytes";
    let soma = 0;
    for (const t of meta.tiles) {
      if (t.x + t.largura > meta.largura || t.y + t.altura > meta.altura) {
        return "tile fora do mapa";
      }
      if (
        t.largura > LIMITES_DE_ASSET.ladoMaximoDoTile ||
        t.altura > LIMITES_DE_ASSET.ladoMaximoDoTile
      ) {
        return "tile grande demais";
      }
      soma += t.largura * t.altura;
    }
    if (soma !== meta.largura * meta.altura) return "tiles não cobrem o mapa";
    return null;
  }
  if (
    meta.tipo === "tile" &&
    (meta.largura > LIMITES_DE_ASSET.ladoMaximoDoTile ||
      meta.altura > LIMITES_DE_ASSET.ladoMaximoDoTile)
  ) {
    return "tile grande demais";
  }
  if (meta.bytes <= 0) return "arquivo vazio";
  if (meta.tipo === "compendio" && meta.bytes > LIMITES_DE_ASSET.bytesDoCompendio) {
    return "compêndio grande demais";
  }
  if (meta.tipo === "som") {
    if (!mimeDeSomValido(meta.mime)) return "só mp3, ogg e wav";
    if (meta.bytes > LIMITES_DE_ASSET.bytesDoSom) return "som grande demais (até 20 MB)";
  }
  const limite =
    LIMITES_DE_ASSET.bytesPorArquivo + (meta.tipo === "cifrado" ? ACRESCIMO_DA_CIFRA : 0);
  if (meta.bytes > limite) return "arquivo grande demais";
  if (meta.pedacos.length !== totalDePedacos(meta.bytes)) return "pedaços não batem com o tamanho";
  if (
    (meta.tipo === "token" || meta.tipo === "retrato") &&
    (meta.largura > LIMITES_DE_ASSET.ladoMaximoDoToken ||
      meta.altura > LIMITES_DE_ASSET.ladoMaximoDoToken)
  ) {
    return "imagem de token grande demais";
  }
  if (
    meta.tipo === "mapa" &&
    Math.max(meta.largura, meta.altura) > LIMITES_DE_ASSET.ladoMaximoDoMapaSemTiles
  ) {
    return "mapa grande demais sem tiles";
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Hash e pedaços
// ---------------------------------------------------------------------------------------------

type Subtle = { digest(algoritmo: string, dados: Uint8Array): Promise<ArrayBuffer> };

export function bytesParaHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

export function hexParaBytes(hex: string): Uint8Array {
  const saida = new Uint8Array(hex.length / 2);
  for (let i = 0; i < saida.length; i++)
    saida[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return saida;
}

/** SHA-256 em hexadecimal (WebCrypto: navegador, Worker e Node). */
export async function sha256Hex(dados: Uint8Array): Promise<string> {
  const { subtle } = (globalThis as unknown as { crypto: { subtle: Subtle } }).crypto;
  return bytesParaHex(new Uint8Array(await subtle.digest("SHA-256", dados)));
}

/** Divide em pedaços de `TAMANHO_PEDACO` (visões do mesmo buffer, sem copiar). */
export function dividirEmPedacos(dados: Uint8Array, tamanho = TAMANHO_PEDACO): Uint8Array[] {
  const saida: Uint8Array[] = [];
  for (let i = 0; i < dados.length; i += tamanho) saida.push(dados.subarray(i, i + tamanho));
  return saida;
}

export function hashesDosPedacos(pedacos: Uint8Array[]): Promise<string[]> {
  return Promise.all(pedacos.map(sha256Hex));
}

/** O pedaço `indice` recebido confere com o manifesto de hashes da meta? */
export async function pedacoConfere(
  meta: Pick<AssetMeta, "pedacos" | "bytes">,
  indice: number,
  dados: Uint8Array,
): Promise<boolean> {
  const esperado = meta.pedacos[indice];
  if (esperado === undefined) return false;
  const ultimo = indice === meta.pedacos.length - 1;
  const tamanhoEsperado = ultimo ? meta.bytes - indice * TAMANHO_PEDACO : TAMANHO_PEDACO;
  if (dados.length !== tamanhoEsperado) return false;
  return (await sha256Hex(dados)) === esperado;
}

/** O arquivo inteiro confere com o hash da meta? */
export async function arquivoConfere(meta: Pick<AssetMeta, "hash" | "bytes">, dados: Uint8Array) {
  return dados.length === meta.bytes && (await sha256Hex(dados)) === meta.hash;
}

// ---------------------------------------------------------------------------------------------
// Frame binário de pedaço
// ---------------------------------------------------------------------------------------------

export type FrameDePedaco = { hash: string; indice: number; total: number; dados: Uint8Array };

export function montarFrameDePedaco(f: FrameDePedaco): Uint8Array {
  const saida = new Uint8Array(TAMANHO_CABECALHO_FRAME + f.dados.length);
  const visao = new DataView(saida.buffer);
  saida[0] = TIPO_FRAME_PEDACO;
  saida.set(hexParaBytes(f.hash), 1);
  visao.setUint32(33, f.indice, false);
  visao.setUint32(37, f.total, false);
  saida.set(f.dados, TAMANHO_CABECALHO_FRAME);
  return saida;
}

/** Lê um frame de pedaço; `null` se não for um (tipo desconhecido, curto demais, índice fora). */
export function lerFrameDePedaco(bruto: ArrayBuffer | Uint8Array): FrameDePedaco | null {
  const bytes = bruto instanceof Uint8Array ? bruto : new Uint8Array(bruto);
  if (bytes.length < TAMANHO_CABECALHO_FRAME || bytes[0] !== TIPO_FRAME_PEDACO) return null;
  const visao = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const indice = visao.getUint32(33, false);
  const total = visao.getUint32(37, false);
  if (total === 0 || indice >= total) return null;
  return {
    hash: bytesParaHex(bytes.subarray(1, 33)),
    indice,
    total,
    dados: bytes.subarray(TAMANHO_CABECALHO_FRAME),
  };
}

// ---------------------------------------------------------------------------------------------
// Tiles e manifesto
// ---------------------------------------------------------------------------------------------

export type Retangulo = { x: number; y: number; largura: number; altura: number };

/** Limite de lado para decidir se o mapa é fatiado: `min(MAX_TEXTURE_SIZE, 8192)`. */
export function limiteDeTextura(maxTextureSize: number): number {
  return Math.max(
    1,
    Math.min(Math.floor(maxTextureSize), LIMITES_DE_ASSET.ladoMaximoDoMapaSemTiles),
  );
}

export function precisaFatiar(largura: number, altura: number, limite: number): boolean {
  return Math.max(largura, altura) > limite;
}

/** Lado máximo de cada tile para um dado limite de textura (nunca passa de 4096). */
export function ladoDoTile(limite: number): number {
  return Math.min(limite, LIMITES_DE_ASSET.ladoMaximoDoTile);
}

function cortes(total: number, lado: number): number[] {
  const n = Math.ceil(total / lado);
  return Array.from({ length: n + 1 }, (_, i) => Math.round((i * total) / n));
}

/**
 * Retângulos dos tiles (fileira por fileira), de no máximo `lado` px, sem sobreposição e cobrindo a
 * imagem inteira. Os tiles ficam do mesmo tamanho (±1 px) em vez de sobrar um pedacinho no fim.
 */
export function retangulosDeTiles(largura: number, altura: number, lado: number): Retangulo[] {
  const xs = cortes(largura, lado);
  const ys = cortes(altura, lado);
  const saida: Retangulo[] = [];
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const x = xs[i] as number;
      const y = ys[j] as number;
      saida.push({
        x,
        y,
        largura: (xs[i + 1] as number) - x,
        altura: (ys[j + 1] as number) - y,
      });
    }
  }
  return saida;
}

/** O hash do manifesto: SHA-256 do texto canônico dos tiles (não há arquivo único). */
export function hashDoManifesto(tiles: Tile[]): Promise<string> {
  const texto = tiles.map((t) => `${t.hash}:${t.x}:${t.y}:${t.largura}:${t.altura}`).join("\n");
  const { TextEncoder: Codificador } = globalThis as unknown as {
    TextEncoder: new () => { encode(t: string): Uint8Array };
  };
  return sha256Hex(new Codificador().encode(texto));
}

/** Monta o manifesto de um mapa fatiado a partir das metas dos tiles já processados. */
export async function montarManifestoDeMapa(dados: {
  largura: number;
  altura: number;
  nomeOriginal: string;
  mime: string;
  tiles: Tile[];
}): Promise<MetaNova> {
  return {
    hash: await hashDoManifesto(dados.tiles),
    tipo: "mapa",
    mime: dados.mime,
    bytes: 0,
    largura: dados.largura,
    altura: dados.altura,
    nomeOriginal: dados.nomeOriginal,
    pedacos: [],
    tiles: dados.tiles,
  };
}

/** Tamanho da cena, em metros, para um mapa de `largura` x `altura` px (PROJETO.md 4.3). */
export function tamanhoDaCenaComMapa(
  mapa: { largura: number; altura: number },
  pxPorQuadrado: number,
  quadradoM: number,
): { larguraM: number; alturaM: number } {
  const arredonda = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    larguraM: arredonda((mapa.largura / pxPorQuadrado) * quadradoM),
    alturaM: arredonda((mapa.altura / pxPorQuadrado) * quadradoM),
  };
}

// ---------------------------------------------------------------------------------------------
// Visibilidade (sigilo de asset)
// ---------------------------------------------------------------------------------------------

type Quem = Pick<Usuario, "id" | "papel">;

function metaDe(estado: Pick<Estado, "assets">, hash: string): AssetMeta | undefined {
  return estado.assets?.find((a) => a.hash === hash);
}

/** Todo hash que algo da campanha usa: mapas das cenas, imagens dos tokens e os tiles deles. */
export function hashesUsados(
  estado: Pick<Estado, "assets" | "cenas" | "tokens" | "personagens"> &
    Partial<
      Pick<Estado, "compendio" | "handouts" | "trilha" | "zonas" | "automacoes" | "mesaDeSom">
    >,
): Set<string> {
  const usados = new Set<string>();
  const usar = (hash: string | undefined) => {
    if (hash === undefined) return;
    usados.add(hash);
    for (const t of metaDe(estado, hash)?.tiles ?? []) usados.add(t.hash);
  };
  for (const c of estado.cenas) usar(c.mapa?.assetHash);
  for (const t of estado.tokens) usar(t.assetHash);
  for (const p of estado.personagens) {
    usar(p.tokenPadrao.assetHash);
    usar(p.retratoHash);
    // A aparência e o símbolo da ficha de papel (V4a).
    usar(p.ficha?.aparenciaHash);
    usar(p.ficha?.simboloHash);
  }
  // A imagem de preview dos handouts (V3).
  for (const h of estado.handouts ?? []) usar(h.imagemHash);
  // O compêndio da mesa (Lote 14): a meta vai na exportação (o arquivo, não).
  usar(estado.compendio?.hash);
  // N5: os sons que a mesa usa (trilha, trilha de cada cena, som de zona e a ação `som.tocar`): só a referência.
  usar(estado.trilha?.hash);
  for (const c of estado.cenas) usar(c.trilha?.hash);
  // Q4: os arquivos dos 16 lugares da mesa de som.
  for (const l of [...(estado.mesaDeSom?.efeitos ?? []), ...(estado.mesaDeSom?.ambientes ?? [])]) {
    usar(l?.hash);
  }
  for (const z of estado.zonas ?? []) usar(z.efeitos.som?.hash);
  for (const r of estado.automacoes?.reacoes ?? []) {
    for (const a of r.fazer) if (a.acao === "som.tocar") usar(a.hash);
  }
  return usados;
}

/**
 * O que vale pré-enviar de uma cena (Lote 4): os arquivos do mapa (cada tile, ou o próprio arquivo
 * se não é fatiado; o manifesto não tem bytes) e a imagem dos tokens que os jogadores veriam
 * (camadas `mapa` e `tokens`, não ocultos). O que está oculto não entra: baixa quando aparecer.
 */
export function hashesPreparaveis(
  estado: Pick<Estado, "assets" | "cenas" | "tokens">,
  cenaId: string,
): string[] {
  const saida = new Set<string>();
  const cena = estado.cenas.find((c) => c.id === cenaId);
  const mapa = cena?.mapa?.assetHash;
  if (mapa !== undefined) {
    const meta = metaDe(estado, mapa);
    if (meta?.tiles) for (const t of meta.tiles) saida.add(t.hash);
    else saida.add(mapa);
  }
  for (const t of estado.tokens) {
    if (t.cenaId === cenaId && t.camada !== "mestre" && !t.oculto && t.assetHash !== undefined) {
      saida.add(t.assetHash);
    }
  }
  return [...saida];
}

/**
 * O usuário pode ver este asset? O mestre vê tudo o que existe. O jogador só vê o que é dele, a
 * imagem de um token visível para ele (da cena ativa), a imagem do token padrão e o retrato de um
 * personagem que ele vê, o mapa da cena ativa e os tiles desse mapa; os arquivos `cifrado` (opacos: sem a
 * chave não dizem nada) e o compêndio que a mesa definiu (`Estado.compendio`: todos consultam). Um asset
 * `compendio` que NÃO é o da mesa (um arquivo antigo do mestre) segue a regra comum: só o dono o vê. Quem pergunta por um asset que não vê recebe a mesma resposta de quem
 * pergunta por um que não existe.
 */
export function assetVisivelPara(
  hash: string,
  estado: Pick<Estado, "assets" | "cenas" | "cenaAtivaId" | "tokens" | "personagens" | "pastas"> &
    Partial<Pick<Estado, "retratosDoChat" | "compendio" | "handouts" | "permissoes">>,
  usuario: Quem,
): boolean {
  const meta = metaDe(estado, hash);
  if (!meta) return false;
  if (usuario.papel === "mestre") return true;
  if (usuario.papel !== "jogador") return false;
  if (meta.tipo === "cifrado") return true;
  if (meta.tipo === "compendio" && estado.compendio?.hash === hash) return true;
  if (meta.tipo === "som") return true;
  if (meta.donoId === usuario.id) return true;
  if (
    estado.tokens.some(
      (t) => t.assetHash === hash && tokenVisivelPara(t, usuario, estado.cenaAtivaId),
    )
  ) {
    return true;
  }
  if (
    estado.personagens.some(
      (p) =>
        (p.tokenPadrao.assetHash === hash || p.retratoHash === hash) &&
        personagemVisivelPara(p, usuario, estado.pastas),
    )
  ) {
    return true;
  }
  // A aparência e o símbolo da ficha de um personagem cuja ficha ele vê (V4a).
  const permissoes = estado.permissoes;
  if (
    permissoes !== undefined &&
    estado.personagens.some(
      (p) =>
        (p.ficha?.aparenciaHash === hash || p.ficha?.simboloHash === hash) &&
        personagemVisivelPara(p, usuario, estado.pastas) &&
        fichaVisivelPara(p, usuario, permissoes),
    )
  ) {
    return true;
  }
  // A imagem de um handout que ele vê (V3).
  if (
    estado.handouts?.some((h) => h.imagemHash === hash && handoutVisivelPara(h, usuario)) === true
  ) {
    return true;
  }
  // O retrato de quem falou numa mensagem pública do chat: quem lê a mensagem pode ver a imagem dele.
  if (estado.retratosDoChat?.includes(hash)) return true;
  const ativa = estado.cenas.find((c) => c.id === estado.cenaAtivaId);
  const mapa = ativa?.mapa?.assetHash;
  if (mapa === undefined) return false;
  if (mapa === hash) return true;
  return metaDe(estado, mapa)?.tiles?.some((t) => t.hash === hash) ?? false;
}

// ---------------------------------------------------------------------------------------------
// Quem serve o arquivo
// ---------------------------------------------------------------------------------------------

export type CandidatoAProvedor = { conexaoId: string; usuarioId: string; papel: Quem["papel"] };

/**
 * Escolhe quem serve um asset entre as conexões que têm cópia: o dono online, depois o mestre,
 * depois qualquer outro (o primeiro da lista, que a sala mantém em ordem estável).
 */
export function escolherProvedor(
  candidatos: CandidatoAProvedor[],
  donoId: string,
): CandidatoAProvedor | null {
  return (
    candidatos.find((c) => c.usuarioId === donoId) ??
    candidatos.find((c) => c.papel === "mestre") ??
    candidatos[0] ??
    null
  );
}
