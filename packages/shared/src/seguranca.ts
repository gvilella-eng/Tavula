import { type AssetMeta, LIMITES_DE_ASSET, type TipoDeAsset } from "./assets.ts";
import { detectarFormato, type FormatoDetectado } from "./envios.ts";

// AS1: a segurança dos arquivos que vêm de outra pessoa (um jogador, o Claude). Regra de ouro: o TIPO vem dos bytes, nunca do
// nome nem do que o cliente diz; quem RECEBE confere de novo; o nome no disco é montado pelo Távola, com a extensão do tipo
// detectado; só uma lista fechada de tipos existe (nunca svg, html, executável nem script). Tudo puro, para testar.

/** Os únicos formatos que a mesa aceita (a lista fechada). Nada fora dela chega ao disco. */
export const FORMATOS_PERMITIDOS = [
  "png",
  "jpg",
  "gif",
  "webp",
  "mp3",
  "ogg",
  "wav",
  "json",
] as const;

/** Extensões que nunca podem existir num nome de arquivo montado pelo Távola. */
export const EXTENSOES_PERIGOSAS = [
  "exe",
  "bat",
  "cmd",
  "com",
  "ps1",
  "psm1",
  "lnk",
  "scr",
  "hta",
  "js",
  "mjs",
  "cjs",
  "vbs",
  "vbe",
  "wsf",
  "wsh",
  "msi",
  "msp",
  "dll",
  "sys",
  "jar",
  "reg",
  "inf",
  "pif",
  "cpl",
  "url",
  "svg",
  "svgz",
  "html",
  "htm",
  "xhtml",
  "php",
  "sh",
  "py",
  "app",
  "apk",
  "dmg",
] as const;

/** Nomes que o Windows reserva (com ou sem extensão). */
const NOMES_RESERVADOS = /^(con|prn|aux|nul|clock\$|com[0-9]|lpt[0-9])$/i;

/** O que o início do arquivo diz que ele é, para o aviso (nunca para decidir o tipo aceito). */
export function descreverIntruso(bytes: Uint8Array): string | null {
  const t = (de: number, s: string) =>
    bytes.length >= de + s.length && [...s].every((c, i) => bytes[de + i] === c.charCodeAt(0));
  if (t(0, "MZ")) return "um programa do Windows";
  if (t(0, "\u007fELF")) return "um programa";
  if (t(0, "#!")) return "um script";
  if (t(0, "PK\u0003\u0004")) return "um arquivo compactado";
  const inicio = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true })
    .decode(bytes.subarray(0, 256))
    .replace(/^﻿/, "")
    .trimStart()
    .toLowerCase();
  if (inicio.startsWith("<svg") || (inicio.startsWith("<?xml") && inicio.includes("<svg"))) {
    return "uma imagem SVG (que pode levar script)";
  }
  if (
    inicio.startsWith("<!doctype html") ||
    inicio.startsWith("<html") ||
    inicio.startsWith("<script")
  ) {
    return "uma página da web";
  }
  return null;
}

/** O nome do formato como a lista fechada o chama (`jpg`, `png`...), ou `null` se está fora dela. */
export function nomeDoFormato(f: FormatoDetectado): (typeof FORMATOS_PERMITIDOS)[number] | null {
  return (FORMATOS_PERMITIDOS as readonly string[]).includes(f.extensao)
    ? (f.extensao as (typeof FORMATOS_PERMITIDOS)[number])
    : null;
}

const normalizarMime = (m: string) =>
  m
    .toLowerCase()
    .replace(/;.*$/, "")
    .trim()
    .replace("image/jpg", "image/jpeg")
    .replace("audio/mp3", "audio/mpeg")
    .replace("audio/x-wav", "audio/wav")
    .replace("audio/wave", "audio/wav")
    .replace("image/apng", "image/png");

/** O que cada tipo de asset da mesa guarda: os formatos aceitos. */
const FORMATOS_DO_TIPO: Record<TipoDeAsset, readonly string[]> = {
  mapa: ["png", "jpg", "gif", "webp"],
  token: ["png", "jpg", "gif", "webp"],
  retrato: ["png", "jpg", "gif", "webp"],
  tile: ["png", "jpg", "gif", "webp"],
  imagem: ["png", "jpg", "gif", "webp"],
  animacao: ["png", "gif", "webp"],
  som: ["mp3", "ogg", "wav"],
  compendio: ["json"],
  // O arquivo cifrado é opaco (a chave só chega ao levar o grupo): sem assinatura para conferir.
  cifrado: [],
};

/** O teto de bytes de cada tipo de asset (conferido de novo por quem recebe). */
export function limiteDeBytesDoTipo(tipo: TipoDeAsset): number {
  switch (tipo) {
    case "som":
      return LIMITES_DE_ASSET.bytesDoSom;
    case "animacao":
      return LIMITES_DE_ASSET.bytesDaAnimacao;
    case "compendio":
      return LIMITES_DE_ASSET.bytesDoCompendio;
    case "cifrado":
      return LIMITES_DE_ASSET.bytesPorArquivo + 28;
    default:
      return LIMITES_DE_ASSET.bytesPorArquivo;
  }
}

export type ConferenciaDoArquivo =
  | { ok: true; formato: FormatoDetectado }
  | { ok: false; motivo: string };

/**
 * Quem RECEBE confere o arquivo (o mestre ao copiar para a pasta, o navegador que baixou, a sala ao receber da caixa):
 * os bytes dizem o formato; o formato tem de estar na lista fechada, servir ao tipo do asset, bater com o tipo que o
 * remetente declarou (`mime`) e caber no limite do tipo. `cifrado` não tem assinatura: só o tamanho.
 */
export function conferirArquivoRecebido(
  bytes: Uint8Array,
  meta: Pick<AssetMeta, "tipo" | "mime">,
): ConferenciaDoArquivo {
  if (bytes.length === 0) return { ok: false, motivo: "O arquivo está vazio." };
  if (bytes.length > limiteDeBytesDoTipo(meta.tipo)) {
    return { ok: false, motivo: "O arquivo passa do limite de tamanho do tipo dele." };
  }
  if (meta.tipo === "cifrado") {
    return { ok: true, formato: { familia: "imagem", mime: meta.mime, extensao: "bin" } };
  }
  const formato = detectarFormato(bytes);
  if (!formato) {
    const intruso = descreverIntruso(bytes);
    return {
      ok: false,
      motivo: intruso
        ? `Isto é ${intruso}, não um arquivo aceito pela mesa.`
        : "Não reconheci o formato do arquivo.",
    };
  }
  const nome = nomeDoFormato(formato);
  if (nome === null || !FORMATOS_DO_TIPO[meta.tipo].includes(nome)) {
    return {
      ok: false,
      motivo: `Um arquivo ${nome ?? "desse formato"} não serve para ${meta.tipo}.`,
    };
  }
  if (normalizarMime(formato.mime) !== normalizarMime(meta.mime)) {
    return {
      ok: false,
      motivo: `O arquivo diz ser ${meta.mime}, mas os bytes são ${formato.mime}.`,
    };
  }
  return { ok: true, formato };
}

/** Controle (inclusive o NUL), barras, `..`, os símbolos que o Windows não deixa e espaços e pontos nas pontas. */
function limparTrecho(texto: string, max: number): string {
  const semControle = [...texto.normalize("NFC")]
    .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
    .join("");
  let limpo = semControle
    .replace(/[\\/:*?"<>|]/g, "_")
    // Dentro do nome o ponto vira hífen: só a extensão que o Távola escolhe tem ponto (e nunca sobra `..`).
    .replace(/\./g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-_\s]+|[-_\s]+$/g, "");
  limpo = limpo.slice(0, max).replace(/[-_\s]+$/g, "");
  if (limpo === "") return "arquivo";
  if (NOMES_RESERVADOS.test(limpo)) return `_${limpo}`;
  return limpo;
}

/** Um trecho de caminho (a pessoa, o tipo): sem barra, sem `..`, sem nome reservado, nunca vazio. */
export function trechoDeCaminhoSeguro(texto: string): string {
  return limparTrecho(texto, 60);
}

/**
 * O nome do arquivo no disco: `<nome limpo>-<8 letras do hash>.<extensão do formato detectado>`. A extensão do arquivo
 * original nunca é usada (`foto.exe.png` vira `foto-exe-1a2b3c4d.png`; um `.exe` que é png vira `.png`).
 */
export function nomeDeArquivoNoDisco(
  nomeOriginal: string,
  formato: Pick<FormatoDetectado, "extensao">,
  hash: string,
): string {
  const semExtensao = nomeOriginal.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
  const ext = formato.extensao.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (ext === "" || (EXTENSOES_PERIGOSAS as readonly string[]).includes(ext)) {
    throw new Error("Extensão não permitida.");
  }
  return `${limparTrecho(semExtensao, 80)}-${hash.slice(0, 8)}.${ext}`;
}

/** Este nome (de qualquer origem) tem alguma extensão que nunca pode existir na pasta? */
export function temExtensaoPerigosa(nome: string): boolean {
  return nome
    .toLowerCase()
    .split(".")
    .slice(1)
    .some((parte) => (EXTENSOES_PERIGOSAS as readonly string[]).includes(parte.trim()));
}

/** A subpasta de cada tipo de asset na pasta organizada do mestre (o tile e o cifrado não vão para ela: ver `caminhoNaPastaOrganizada`). */
export const PASTA_DO_TIPO: Record<Exclude<TipoDeAsset, "tile" | "cifrado">, string> = {
  mapa: "mapas",
  token: "tokens",
  retrato: "retratos",
  imagem: "imagens",
  animacao: "animacoes",
  som: "sons",
  compendio: "json",
};

export const RAIZ_DA_PASTA_ORGANIZADA = "assets";

/**
 * Onde o arquivo vai na pasta organizada do mestre: `assets/<pessoa>/<tipo>/<nome>-<hash>.<ext>`. `pessoa` é o nome de quem
 * enviou. O hash no nome evita repetir (o mesmo arquivo nunca ocupa dois lugares) e distingue dois arquivos de mesmo nome.
 * Devolve a pasta (partes) e o nome. `null` para o que não vai para a pasta organizada (tile, cifrado, manifesto).
 */
export function caminhoNaPastaOrganizada(
  meta: Pick<AssetMeta, "hash" | "tipo" | "nomeOriginal" | "tiles">,
  pessoa: string,
  formato: Pick<FormatoDetectado, "extensao">,
  nomeDeExibicao?: string,
): { pasta: string[]; nome: string } | null {
  if (meta.tiles !== undefined || meta.tipo === "tile" || meta.tipo === "cifrado") return null;
  return {
    pasta: [RAIZ_DA_PASTA_ORGANIZADA, trechoDeCaminhoSeguro(pessoa), PASTA_DO_TIPO[meta.tipo]],
    nome: nomeDeArquivoNoDisco(nomeDeExibicao ?? meta.nomeOriginal, formato, meta.hash),
  };
}
