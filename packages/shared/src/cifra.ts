import {
  ACRESCIMO_DA_CIFRA,
  bytesParaHex,
  dividirEmPedacos,
  hashesDosPedacos,
  hexParaBytes,
  type MetaNova,
  sha256Hex,
} from "./assets.ts";

// Cifra do pré-envio de cena (PROJETO.md, Lote 4): AES-GCM 256, uma chave por arquivo, IV de 12
// bytes aleatório no começo do arquivo cifrado. WebCrypto existe no navegador, no Worker e no Node.

/** Bytes do IV no começo do arquivo cifrado. */
export const TAMANHO_IV = 12;
/** Bytes da etiqueta de autenticação do AES-GCM no fim do arquivo cifrado. */
export const TAMANHO_ETIQUETA = 16;

type ChaveWeb = unknown;
type Cripto = {
  getRandomValues(a: Uint8Array): Uint8Array;
  subtle: {
    importKey(
      formato: "raw",
      dados: Uint8Array,
      algoritmo: { name: string },
      extraivel: boolean,
      usos: string[],
    ): Promise<ChaveWeb>;
    encrypt(
      algoritmo: { name: string; iv: Uint8Array },
      chave: ChaveWeb,
      dados: Uint8Array,
    ): Promise<ArrayBuffer>;
    decrypt(
      algoritmo: { name: string; iv: Uint8Array },
      chave: ChaveWeb,
      dados: Uint8Array,
    ): Promise<ArrayBuffer>;
  };
};

const cripto = () => (globalThis as unknown as { crypto: Cripto }).crypto;

function importar(chaveHex: string, uso: "encrypt" | "decrypt"): Promise<ChaveWeb> {
  return cripto().subtle.importKey("raw", hexParaBytes(chaveHex), { name: "AES-GCM" }, false, [
    uso,
  ]);
}

/** Cifra com uma chave nova (256 bits) e um IV novo. Devolve `iv + cifrado` e a chave em hexadecimal. */
export async function cifrar(dados: Uint8Array): Promise<{ cifrado: Uint8Array; chave: string }> {
  const c = cripto();
  const chave = c.getRandomValues(new Uint8Array(32));
  const iv = c.getRandomValues(new Uint8Array(TAMANHO_IV));
  const chaveHex = bytesParaHex(chave);
  const corpo = new Uint8Array(
    await c.subtle.encrypt({ name: "AES-GCM", iv }, await importar(chaveHex, "encrypt"), dados),
  );
  const cifrado = new Uint8Array(TAMANHO_IV + corpo.length);
  cifrado.set(iv, 0);
  cifrado.set(corpo, TAMANHO_IV);
  return { cifrado, chave: chaveHex };
}

/** Decifra `iv + cifrado`. Falha (exceção) com chave errada ou arquivo adulterado. */
export async function decifrar(cifrado: Uint8Array, chaveHex: string): Promise<Uint8Array> {
  if (cifrado.length < ACRESCIMO_DA_CIFRA) throw new Error("arquivo cifrado curto demais");
  const iv = cifrado.slice(0, TAMANHO_IV);
  const corpo = cifrado.slice(TAMANHO_IV);
  return new Uint8Array(
    await cripto().subtle.decrypt(
      { name: "AES-GCM", iv },
      await importar(chaveHex, "decrypt"),
      corpo,
    ),
  );
}

/**
 * Decifra e confere o SHA-256 do resultado contra o hash original. `null` se a chave não serve,
 * o arquivo foi adulterado ou o conteúdo não é o esperado.
 */
export async function decifrarEConferir(
  cifrado: Uint8Array,
  chaveHex: string,
  hashOriginal: string,
): Promise<Uint8Array | null> {
  try {
    const dados = await decifrar(cifrado, chaveHex);
    return (await sha256Hex(dados)) === hashOriginal ? dados : null;
  } catch {
    return null;
  }
}

/**
 * Meta do arquivo cifrado: sem nome real e com dimensões neutras (a sala e quem baixa não
 * aprendem nada sobre o conteúdo além do tamanho aproximado).
 */
export async function metaDoCifrado(cifrado: Uint8Array): Promise<MetaNova> {
  const pedacos = dividirEmPedacos(cifrado);
  return {
    hash: await sha256Hex(cifrado),
    tipo: "cifrado",
    mime: "application/octet-stream",
    bytes: cifrado.length,
    largura: 1,
    altura: 1,
    nomeOriginal: "cifrado",
    pedacos: await hashesDosPedacos(pedacos),
  };
}
