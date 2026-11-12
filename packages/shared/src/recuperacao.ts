import { z } from "zod";
import { base64UrlParaBytes, bytesParaBase64Url, DerivadaSchema } from "./contas.ts";
import { ALFABETO_DO_ID_DE_MESA, type BytesAleatorios } from "./mesas.ts";

/**
 * Recuperação do acesso do mestre (C3): a chave da pasta da mesa (ECDSA P-256, WebCrypto) e o código de
 * recuperação. Aqui moram só as regras puras e o WebCrypto, que roda igual no navegador (gerar e assinar) e
 * no servidor (só verificar). A chave PRIVADA nunca sai do navegador nem da pasta; o servidor guarda só a
 * chave pública e o SHA-256 do código.
 */

// --- Código de recuperação ------------------------------------------------------------------------

/** 20 caracteres do alfabeto dos ids (31 símbolos, cerca de 99 bits), em 5 grupos de 4: `xxxx-xxxx-xxxx-xxxx-xxxx`. */
export const TAMANHO_DO_CODIGO = 20;

const bytesDoCrypto: BytesAleatorios = (n) => crypto.getRandomValues(new Uint8Array(n));

function formatarCodigo(letras: string): string {
  return (letras.match(/.{4}/g) ?? []).join("-");
}

/** Sorteia um código de recuperação, sem viés (o mesmo descarte do id da mesa). */
export function gerarCodigoDeRecuperacao(aleatorio: BytesAleatorios = bytesDoCrypto): string {
  const base = ALFABETO_DO_ID_DE_MESA.length;
  const limite = 256 - (256 % base);
  let letras = "";
  while (letras.length < TAMANHO_DO_CODIGO) {
    for (const b of aleatorio(TAMANHO_DO_CODIGO * 2)) {
      if (b >= limite) continue;
      letras += ALFABETO_DO_ID_DE_MESA[b % base];
      if (letras.length === TAMANHO_DO_CODIGO) break;
    }
  }
  return formatarCodigo(letras);
}

const SO_LETRAS_DO_CODIGO = new RegExp(`^[${ALFABETO_DO_ID_DE_MESA}]{${TAMANHO_DO_CODIGO}}$`);

/**
 * O código como a pessoa o digita ou cola (maiúsculas, espaços, sem hífens) na forma canônica
 * `xxxx-xxxx-...`, ou `null` se não for um código.
 */
export function normalizarCodigoDeRecuperacao(texto: unknown): string | null {
  if (typeof texto !== "string" || texto.length > 200) return null;
  const letras = texto.toLowerCase().replace(/[\s-]/g, "");
  return SO_LETRAS_DO_CODIGO.test(letras) ? formatarCodigo(letras) : null;
}

// --- Chave da pasta --------------------------------------------------------------------------------

/** O nome do arquivo que fica na pasta da mesa. */
export const NOME_DO_ARQUIVO_DA_CHAVE = "tavola-mestre.json";
export const FORMATO_DO_ARQUIVO_DA_CHAVE = "tavola-mestre-v1";
export const AVISO_DO_ARQUIVO_DA_CHAVE =
  "Este arquivo é a prova de que você é o mestre desta mesa. Não o compartilhe, não o envie a ninguém e não o guarde em pastas públicas.";

const CoordenadaSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "coordenada inválida");

/** A chave pública (JWK de curva P-256, só `kty`, `crv`, `x` e `y`). Qualquer outro campo (um `d`, por exemplo) é recusado. */
export const ChavePublicaSchema = z
  .object({
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: CoordenadaSchema,
    y: CoordenadaSchema,
  })
  .strict();
export type ChavePublica = z.infer<typeof ChavePublicaSchema>;

/** A chave privada (JWK) que fica só no arquivo da pasta. */
export const ChavePrivadaSchema = z
  .object({
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: CoordenadaSchema,
    y: CoordenadaSchema,
    d: CoordenadaSchema,
  })
  .strict();
export type ChavePrivada = z.infer<typeof ChavePrivadaSchema>;

/** O conteúdo de `tavola-mestre.json`. */
export const ArquivoDaChaveSchema = z.object({
  formato: z.literal(FORMATO_DO_ARQUIVO_DA_CHAVE),
  aviso: z.string().optional(),
  mesaId: z.string().max(64),
  nomeDaMesa: z.string().max(200),
  chavePrivada: ChavePrivadaSchema,
  criadaEm: z.string().max(64),
});
export type ArquivoDaChave = z.infer<typeof ArquivoDaChaveSchema>;

const CURVA = { name: "ECDSA", namedCurve: "P-256" } as const;

/** Esta pasta compila sem os tipos do DOM: o `importKey` de JWK entra por uma assinatura mínima. */
type Subtle = {
  importKey(
    formato: "jwk",
    chave: object,
    algoritmo: object,
    extraivel: boolean,
    usos: string[],
  ): Promise<unknown>;
  exportKey(formato: "jwk", chave: unknown): Promise<Record<string, unknown>>;
  generateKey(
    algoritmo: object,
    extraivel: boolean,
    usos: string[],
  ): Promise<{ publicKey: unknown; privateKey: unknown }>;
  sign(algoritmo: object, chave: unknown, dados: Uint8Array): Promise<ArrayBuffer>;
  verify(
    algoritmo: object,
    chave: unknown,
    assinatura: Uint8Array,
    dados: Uint8Array,
  ): Promise<boolean>;
};
const subtle = crypto.subtle as unknown as Subtle;
const ALGORITMO = { name: "ECDSA", hash: "SHA-256" } as const;

/** Um par novo: a pública (para o servidor) e a privada (para a pasta). */
export async function gerarParDeChaves(): Promise<{
  publica: ChavePublica;
  privada: ChavePrivada;
}> {
  const par = await subtle.generateKey(CURVA, true, ["sign", "verify"]);
  const [pub, priv] = await Promise.all([
    subtle.exportKey("jwk", par.publicKey),
    subtle.exportKey("jwk", par.privateKey),
  ]);
  return {
    publica: ChavePublicaSchema.parse({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }),
    privada: ChavePrivadaSchema.parse({
      kty: priv.kty,
      crv: priv.crv,
      x: priv.x,
      y: priv.y,
      d: priv.d,
    }),
  };
}

/** A pública que corresponde a uma privada (a chave da pasta já traz `x` e `y`). */
export function publicaDe(privada: ChavePrivada): ChavePublica {
  return { kty: "EC", crv: "P-256", x: privada.x, y: privada.y };
}

/** O arquivo `tavola-mestre.json` como texto (com o aviso para quem o abrir). */
export function montarArquivoDaChave(dados: {
  mesaId: string;
  nomeDaMesa: string;
  chavePrivada: ChavePrivada;
  criadaEm?: Date;
}): string {
  const arquivo: ArquivoDaChave = {
    formato: FORMATO_DO_ARQUIVO_DA_CHAVE,
    aviso: AVISO_DO_ARQUIVO_DA_CHAVE,
    mesaId: dados.mesaId,
    nomeDaMesa: dados.nomeDaMesa,
    chavePrivada: dados.chavePrivada,
    criadaEm: (dados.criadaEm ?? new Date()).toISOString(),
  };
  return `${JSON.stringify(arquivo, null, 2)}\n`;
}

/** Lê o texto de um `tavola-mestre.json`; `null` se não for um arquivo de chave do Távola. */
export function lerArquivoDaChave(texto: string): ArquivoDaChave | null {
  if (texto.length > 20_000) return null;
  try {
    const r = ArquivoDaChaveSchema.safeParse(JSON.parse(texto));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** O que o navegador assina para recuperar a mesa: o nonce do desafio preso ao id da mesa. */
export function mensagemParaAssinar(mesaId: string, nonce: string): string {
  return `tavola-recuperar:${mesaId}:${nonce}`;
}

const codificador = new TextEncoder();

/** Assina com a chave privada (ECDSA P-256 / SHA-256); a assinatura sai em base64url (64 bytes, formato P1363). */
export async function assinarMensagem(privada: ChavePrivada, mensagem: string): Promise<string> {
  const chave = await subtle.importKey("jwk", privada, CURVA, false, ["sign"]);
  const assinatura = await subtle.sign(ALGORITMO, chave, codificador.encode(mensagem));
  return bytesParaBase64Url(new Uint8Array(assinatura));
}

/** Confere a assinatura com a chave pública. Qualquer problema (chave ou assinatura malformada) dá `false`. */
export async function verificarAssinatura(
  publica: ChavePublica,
  mensagem: string,
  assinatura: string,
): Promise<boolean> {
  const bytes = base64UrlParaBytes(assinatura);
  if (bytes?.length !== 64) return false;
  try {
    const chave = await crypto.subtle.importKey(
      "jwk",
      ChavePublicaSchema.parse(publica),
      CURVA,
      false,
      ["verify"],
    );
    return await subtle.verify(ALGORITMO, chave, bytes, codificador.encode(mensagem));
  } catch {
    return false;
  }
}

// --- Corpos das requisições ---------------------------------------------------------------------------

/** O nonce do desafio: 32 bytes em base64url (43 caracteres). */
export const NonceSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "nonce inválido");
/** A assinatura: 64 bytes em base64url (86 caracteres). */
export const AssinaturaSchema = z.string().regex(/^[A-Za-z0-9_-]{86}$/, "assinatura inválida");

const LoginDoMestreSchema = z.string().min(1).max(64);

/** Registrar ou trocar a chave da pasta: o mestre logado, com a senha atual (a derivada). */
export const CorpoChaveSchema = z.object({
  senha: DerivadaSchema,
  chavePublica: ChavePublicaSchema,
});
/** Gerar um código novo: o mestre logado, com a senha atual. */
export const CorpoCodigoSchema = z.object({ senha: DerivadaSchema });
/** Recuperar pela pasta: o nonce do desafio, a assinatura e a senha nova (a derivada). */
export const CorpoRecuperarPastaSchema = z.object({
  login: LoginDoMestreSchema,
  nonce: NonceSchema,
  assinatura: AssinaturaSchema,
  derivada: DerivadaSchema,
});
/** Recuperar pelo código: o código e a senha nova (a derivada). */
export const CorpoRecuperarCodigoSchema = z.object({
  login: LoginDoMestreSchema,
  codigo: z.string().min(1).max(100),
  derivada: DerivadaSchema,
});

/** Duração do desafio: 5 minutos, uso único. */
export const DESAFIO_VALE_MS = 5 * 60_000;
/** Quantos desafios o mesmo IP pede por hora e quantos podem estar abertos na mesa ao mesmo tempo. */
export const DESAFIOS_POR_IP_POR_HORA = 20;
export const MAXIMO_DE_DESAFIOS_ABERTOS = 50;

/** A chave pública é mesmo um ponto da curva P-256 (o WebCrypto recusa o que não é)? */
export async function chavePublicaValida(publica: unknown): Promise<boolean> {
  const r = ChavePublicaSchema.safeParse(publica);
  if (!r.success) return false;
  try {
    await subtle.importKey("jwk", r.data, CURVA, false, ["verify"]);
    return true;
  } catch {
    return false;
  }
}
