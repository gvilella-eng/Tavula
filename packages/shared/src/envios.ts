import { z } from "zod";
import { type AssetMeta, HashSchema, LIMITES_DE_ASSET } from "./assets.ts";
import { bytesParaBase64Url } from "./contas.ts";
import {
  type ImportacaoDeMapa,
  ImportacaoDeMapaSchema,
  resumoDaImportacao,
} from "./importarUvtt.ts";

// M1: o Claude sobe arquivos para a mesa. O arquivo vai do computador do mestre para a sala por um link de envio de uso único
// (o modelo nunca vê o token), espera numa caixa de entrada temporária e o navegador do mestre o processa pelo mesmo caminho do
// botão de subir (tiles, redução, cifra). Este arquivo guarda o que é puro e compartilhado: os usos, os limites, o formato pelos
// primeiros bytes, o segredo do link, a conta do tamanho do mapa e o que cada uso aplica na mesa (4.12 e `docs/protocolo.md`).

// --- Os usos ----------------------------------------------------------------------------------

/** Para que o arquivo serve. O nome é o que o Claude escreve na ferramenta. */
export const USOS_DE_ENVIO = [
  "mapa",
  "token",
  "retrato",
  "handout",
  "som",
  "compendio",
  "mapa-uvtt",
] as const;
export const UsoDeEnvioSchema = z.enum(USOS_DE_ENVIO);
export type UsoDeEnvio = z.infer<typeof UsoDeEnvioSchema>;

/** Como a mesa chama cada uso (nas respostas e nos avisos). */
export const ROTULO_DO_USO: Record<UsoDeEnvio, string> = {
  mapa: "mapa da cena",
  token: "token",
  retrato: "retrato da ficha",
  handout: "imagem do handout",
  som: "som",
  compendio: "compêndio",
  "mapa-uvtt": "mapa Universal VTT (Dungeondraft)",
};

/** O tipo de conteúdo que cada uso aceita. */
export type FamiliaDeFormato = "imagem" | "som" | "json";
export const FAMILIA_DO_USO: Record<UsoDeEnvio, FamiliaDeFormato> = {
  mapa: "imagem",
  token: "imagem",
  retrato: "imagem",
  handout: "imagem",
  som: "som",
  compendio: "json",
  "mapa-uvtt": "json",
};

// --- Limites ----------------------------------------------------------------------------------

export const LIMITES_DO_ENVIO = {
  /** Token, retrato e imagem de handout: o original antes de reduzir a 512 px (assumido: 20 MB). */
  bytesDaImagem: 20 * 1024 * 1024,
  /** Mapa: o original antes dos tiles (assumido: 64 MB; um PNG de 3150 x 3150 tem uns 16 MB). */
  bytesDoMapa: 64 * 1024 * 1024,
  bytesDoSom: LIMITES_DE_ASSET.bytesDoSom,
  bytesDoCompendio: LIMITES_DE_ASSET.bytesDoCompendio,
  /** A caixa de entrada inteira (assumido: 300 MB). */
  bytesDaCaixa: 300 * 1024 * 1024,
  /** O link vale 15 minutos (assumido) e só uma vez. */
  prazoDoLinkMs: 15 * 60 * 1000,
  /** O arquivo espera na caixa até 24 h (assumido); depois a sala o apaga. */
  prazoDoArquivoMs: 24 * 60 * 60 * 1000,
  /** O arquivo em base64 (para quem não tem shell): até 2 MB (assumido). */
  bytesDoBase64: 2 * 1024 * 1024,
  /** Quanto a ferramenta espera o navegador do mestre processar (assumido: 20 s). */
  esperaMs: 20_000,
  /** Quantos envios abertos (esperando o arquivo, o navegador ou o processamento) cada token tem (assumido). */
  abertosPorToken: 10,
  /** Pedidos de envio por minuto por token (assumido). */
  porMinutoPorToken: 20,
  /** O tamanho de cada linha de bytes no SQLite da sala (o limite do banco é 2 MB por linha). */
  tamanhoDoPedacoNoBanco: 1024 * 1024,
  /** Quantos envios o aviso `caixa.pendentes` leva. */
  pendentesNoAviso: 50,
} as const;

/** O teto de bytes de um uso. */
export function limiteDoUso(uso: UsoDeEnvio): number {
  switch (uso) {
    case "mapa":
    case "mapa-uvtt":
      return LIMITES_DO_ENVIO.bytesDoMapa;
    case "som":
      return LIMITES_DO_ENVIO.bytesDoSom;
    case "compendio":
      return LIMITES_DO_ENVIO.bytesDoCompendio;
    default:
      return LIMITES_DO_ENVIO.bytesDaImagem;
  }
}

// --- O formato, pelos primeiros bytes ---------------------------------------------------------

export type FormatoDetectado = { familia: FamiliaDeFormato; mime: string; extensao: string };

const comeca = (b: Uint8Array, assinatura: readonly number[], de = 0) =>
  b.length >= de + assinatura.length && assinatura.every((v, i) => b[de + i] === v);
const texto = (b: Uint8Array, de: number, s: string) =>
  b.length >= de + s.length && [...s].every((c, i) => b[de + i] === c.charCodeAt(0));

/**
 * O formato real do arquivo, lido dos primeiros bytes (o nome e o `Content-Type` não valem): png, jpg, webp, gif; mp3, ogg,
 * wav; json (primeiro caractere útil `{` ou `[`, depois de um BOM e espaços). `null` se não é nenhum deles.
 */
export function detectarFormato(bytes: Uint8Array): FormatoDetectado | null {
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { familia: "imagem", mime: "image/png", extensao: "png" };
  }
  if (comeca(bytes, [0xff, 0xd8, 0xff])) {
    return { familia: "imagem", mime: "image/jpeg", extensao: "jpg" };
  }
  if (texto(bytes, 0, "GIF87a") || texto(bytes, 0, "GIF89a")) {
    return { familia: "imagem", mime: "image/gif", extensao: "gif" };
  }
  if (texto(bytes, 0, "RIFF") && texto(bytes, 8, "WEBP")) {
    return { familia: "imagem", mime: "image/webp", extensao: "webp" };
  }
  if (texto(bytes, 0, "RIFF") && texto(bytes, 8, "WAVE")) {
    return { familia: "som", mime: "audio/wav", extensao: "wav" };
  }
  if (texto(bytes, 0, "OggS")) return { familia: "som", mime: "audio/ogg", extensao: "ogg" };
  if (
    texto(bytes, 0, "ID3") ||
    (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] ?? 0) >= 0xe0)
  ) {
    return { familia: "som", mime: "audio/mpeg", extensao: "mp3" };
  }
  let i = comeca(bytes, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  while (i < bytes.length && [0x20, 0x09, 0x0a, 0x0d].includes(bytes[i] ?? 0)) i++;
  const c = bytes[i];
  if (c === 0x7b || c === 0x5b)
    return { familia: "json", mime: "application/json", extensao: "json" };
  return null;
}

/** O texto que diz por que o arquivo não serve para o uso, ou `null` se serve. */
export function motivoDoFormato(
  uso: UsoDeEnvio,
  formato: FormatoDetectado | null,
  bytes: number,
): string | null {
  const queria = FAMILIA_DO_USO[uso];
  const o = ROTULO_DO_USO[uso];
  if (bytes <= 0) return "O arquivo está vazio.";
  if (!formato) {
    return `Não reconheci o formato do arquivo. Para ${o} mando ${QUERIDO[queria]}.`;
  }
  if (formato.familia !== queria) {
    return `Isto é ${DESCRICAO_DA_FAMILIA[formato.familia]}, e para ${o} preciso de ${QUERIDO[queria]}.`;
  }
  if (bytes > limiteDoUso(uso)) {
    return `Arquivo grande demais para ${o}: o limite é ${Math.round(limiteDoUso(uso) / 1024 / 1024)} MB.`;
  }
  return null;
}

const QUERIDO: Record<FamiliaDeFormato, string> = {
  imagem: "png, jpg, webp ou gif",
  som: "mp3, ogg ou wav",
  json: "um arquivo json",
};
const DESCRICAO_DA_FAMILIA: Record<FamiliaDeFormato, string> = {
  imagem: "uma imagem",
  som: "um som",
  json: "um arquivo json",
};

/** O nome do arquivo só para exibição: sem pasta (o caminho do computador nunca vai para a sala), sem controle, até 120 letras. */
export function limparNomeDoEnvio(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "";
  const semControle = [...base]
    .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
    .join("");
  const limpo = semControle.replace(/\s+/g, " ").trim();
  return limpo.slice(0, 120) || "arquivo";
}

// --- O segredo do link ------------------------------------------------------------------------

export const PREFIXO_DO_SEGREDO_DE_ENVIO = "tve_";
export const BYTES_DO_SEGREDO_DE_ENVIO = 32;
export const FORMATO_DO_SEGREDO_DE_ENVIO = /^tve_[A-Za-z0-9_-]{43}$/;

/** O segredo do link de envio: 32 bytes aleatórios em base64url. A sala guarda só o hash dele. */
export function novoSegredoDeEnvio(
  sortear: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  return PREFIXO_DO_SEGREDO_DE_ENVIO + bytesParaBase64Url(sortear(BYTES_DO_SEGREDO_DE_ENVIO));
}

/** O caminho do link de envio, dentro da mesa. */
export function caminhoDoLinkDeEnvio(mesaId: string, segredo: string): string {
  return `/api/m/${encodeURIComponent(mesaId)}/claude/envio/${segredo}`;
}

/** O comando que o Claude roda no shell (o caminho do arquivo é dele; a sala nunca o vê). */
export function comandoDeEnvio(link: string): string {
  return `curl -sS -T "<caminho do arquivo>" "${link}"`;
}

// --- Onde o arquivo vai -----------------------------------------------------------------------

export const AlvoDoEnvioSchema = z
  .object({
    cenaId: z.string().min(1).max(64).optional(),
    tokenId: z.string().min(1).max(64).optional(),
    fichaId: z.string().min(1).max(64).optional(),
    handoutId: z.string().min(1).max(64).optional(),
  })
  .strict();
export type AlvoDoEnvio = z.infer<typeof AlvoDoEnvioSchema>;

export const OpcoesDoEnvioSchema = z
  .object({
    /** Só no mapa: quantos pixels da imagem cabem num quadrado (10 a 1000). */
    pxPorQuadrado: z.number().min(10).max(1000).optional(),
    /** Só no mapa: quantos quadrados a imagem tem de lado maior (45 = 45 x 45). Calcula o `pxPorQuadrado`. */
    quadrados: z.number().int().min(1).max(500).optional(),
    /** Só no som da cena: 0 a 1. */
    volume: z.number().min(0).max(1).optional(),
  })
  .strict();
export type OpcoesDoEnvio = z.infer<typeof OpcoesDoEnvioSchema>;

/** Quanto vale um quadrado do mapa: o que o Claude pediu, ou a imagem dividida pelos quadrados (lado maior), ou `null` (fica como está). */
export function pxDoMapa(
  meta: { largura: number; altura: number } | undefined,
  o: OpcoesDoEnvio,
): number | null | "invalido" {
  if (o.pxPorQuadrado !== undefined) return o.pxPorQuadrado;
  if (o.quadrados !== undefined) {
    if (!meta) return "invalido";
    const px = Math.round(Math.max(meta.largura, meta.altura) / o.quadrados);
    return px >= 10 && px <= 1000 ? px : "invalido";
  }
  return null;
}

export type UsoAplicado =
  | { ok: true; tipo: string; dados: unknown; frase: string }
  | { ok: true; tipo: null; frase: string }
  | { ok: false; motivo: string };

type MetaDaImagem = Pick<AssetMeta, "largura" | "altura" | "nomeOriginal">;

/**
 * A intenção que põe o arquivo (já registrado, com este `hash`) no lugar que o uso pede. É a MESMA para o envio da caixa
 * (a sala aplica ao fim) e para usar um arquivo que já está na mesa. `tipo: null`: o arquivo só fica na mesa (som sem cena).
 */
export function usoDoArquivo(
  uso: UsoDeEnvio,
  alvo: AlvoDoEnvio,
  hash: string,
  meta: MetaDaImagem | undefined,
  opcoes: OpcoesDoEnvio,
  extras: { magias?: number; importacao?: ImportacaoDeMapa } = {},
): UsoAplicado {
  switch (uso) {
    case "mapa-uvtt": {
      // Q3: o navegador do mestre leu o arquivo e mandou a cena pronta (`importacao`); a sala a cria como o Claude. Na prova de
      // permissão (`negarEnvio`) ainda não há arquivo: uma cena vazia basta para as regras responderem.
      const i: ImportacaoDeMapa = extras.importacao ?? {
        id: "prova-uvtt",
        nome: "prova",
        pxPorQuadrado: 70,
        paredes: [],
        fontes: [],
      };
      return {
        ok: true,
        tipo: "cena.importarMapa",
        dados: { ...i, assetHash: hash },
        frase: resumoDaImportacao(i)
          .replace(/^Cena criada/, "cena criada")
          .replace(/\.$/, ""),
      };
    }
    case "mapa": {
      const px = pxDoMapa(meta, opcoes);
      if (px === "invalido") {
        return {
          ok: false,
          motivo:
            "Com esses quadrados a imagem fica com menos de 10 ou mais de 1000 px por quadrado.",
        };
      }
      return {
        ok: true,
        tipo: "cena.definirMapa",
        dados: {
          ...(alvo.cenaId ? { cenaId: alvo.cenaId } : {}),
          assetHash: hash,
          ...(px !== null ? { pxPorQuadrado: px } : {}),
        },
        frase:
          px === null ? "o mapa entrou na cena" : `o mapa entrou na cena (${px} px por quadrado)`,
      };
    }
    case "token":
      if (alvo.tokenId) {
        return {
          ok: true,
          tipo: "token.definirImagem",
          dados: { id: alvo.tokenId, assetHash: hash },
          frase: "a imagem entrou no token",
        };
      }
      if (alvo.fichaId) {
        return {
          ok: true,
          tipo: "personagem.editar",
          dados: { id: alvo.fichaId, mudancas: { assetHash: hash } },
          frase: "a imagem virou o token padrão da ficha",
        };
      }
      return { ok: false, motivo: "Diga de qual token ou de qual ficha é a imagem." };
    case "retrato":
      if (!alvo.fichaId) return { ok: false, motivo: "Diga de qual ficha é o retrato." };
      return {
        ok: true,
        tipo: "personagem.editar",
        dados: { id: alvo.fichaId, mudancas: { retratoHash: hash } },
        frase: "o retrato entrou na ficha",
      };
    case "handout":
      if (!alvo.handoutId) return { ok: false, motivo: "Diga de qual handout é a imagem." };
      return {
        ok: true,
        tipo: "handout.editar",
        dados: { id: alvo.handoutId, mudancas: { imagemHash: hash } },
        frase: "a imagem entrou no handout",
      };
    case "som":
      // Q4: o som só entra na mesa; ele ganha um lugar na mesa de som pela configuração (ou pela ferramenta `som`).
      return {
        ok: true,
        tipo: null,
        frase: "o som ficou na mesa (ponha-o num lugar da mesa de som para tocar)",
      };
    case "compendio": {
      const nome = (meta?.nomeOriginal ?? "compendio.json").slice(0, 200);
      return {
        ok: true,
        tipo: "compendio.definir",
        dados: { compendio: { hash, nomeOriginal: nome, magias: extras.magias ?? 0 } },
        frase: "o compêndio da mesa foi trocado",
      };
    }
  }
}

// --- O estado de um envio ---------------------------------------------------------------------

/**
 * `aguardando`: o link foi dado e o arquivo ainda não veio. `recebido`: está na caixa, esperando o navegador do mestre.
 * `processando`: o navegador baixou e está processando. `aplicado`: pronto. `erro`: não deu (o motivo vem junto).
 */
export const ESTADOS_DE_ENVIO = [
  "aguardando",
  "recebido",
  "processando",
  "aplicado",
  "erro",
] as const;
export type EstadoDeEnvio = (typeof ESTADOS_DE_ENVIO)[number];

/** O que a sala sabe de um envio (sem os bytes). */
export type EnvioPublico = {
  id: string;
  uso: UsoDeEnvio;
  nome: string;
  estado: EstadoDeEnvio;
  bytes: number;
  criadoEm: number;
  /** Só `aplicado`: o hash do arquivo e o que foi feito. */
  hash?: string;
  resultado?: string;
  /** Só `erro`. */
  motivo?: string;
};

/** Um envio que espera o navegador do mestre (o aviso `caixa.pendentes`). */
export const EnvioPendenteSchema = z.object({
  id: z.string().min(1).max(64),
  uso: UsoDeEnvioSchema,
  nome: z.string().min(1).max(200),
  bytes: z.number().int().nonnegative(),
  mime: z.string().min(1).max(64),
});
export type EnvioPendente = z.infer<typeof EnvioPendenteSchema>;

export const ConclusaoDoEnvioSchema = z.object({
  envioId: z.string().min(1).max(64),
  hash: HashSchema,
  /** Só no compêndio: quantas magias o navegador leu. */
  magias: z.number().int().min(0).max(100_000).optional(),
  /** Só no mapa Universal VTT: a cena que o navegador montou do arquivo (sem a imagem; o `hash` é o dela). */
  importacao: ImportacaoDeMapaSchema.optional(),
});

export const FalhaDoEnvioSchema = z.object({
  envioId: z.string().min(1).max(64),
  motivo: z.string().min(1).max(300),
});
