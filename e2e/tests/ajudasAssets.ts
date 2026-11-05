import { deflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";
import { abrirAba } from "./ajudas";

// Imagens geradas no teste (nada de arquivo grande no repositório) e ajudas da aba Biblioteca.

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(dados: Buffer): number {
  let c = 0xffffffff;
  for (const b of dados) c = (TABELA_CRC[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo: string, dados: Buffer): Buffer {
  const saida = Buffer.alloc(12 + dados.length);
  saida.writeUInt32BE(dados.length, 0);
  saida.write(tipo, 4, "ascii");
  dados.copy(saida, 8);
  saida.writeUInt32BE(crc32(saida.subarray(4, 8 + dados.length)), 8 + dados.length);
  return saida;
}

/**
 * PNG de ruído colorido, determinístico pela `semente` (`lado`: lado do bloco de cor, em px). O
 * ruído não comprime, então o WebP gerado a partir dele ocupa vários pedaços de 256 KB.
 */
export function pngDeRuido(largura: number, altura: number, semente: number, lado = 1): Buffer {
  let x = (semente * 2654435761) >>> 0;
  const proximo = () => {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    return (x >>> 16) & 255;
  };
  const colunas = Math.ceil(largura / lado);
  const tamanhoDaLinha = largura * 3 + 1;
  const linhas = Buffer.alloc(tamanhoDaLinha * altura);
  let blocos: number[] = [];
  for (let y = 0; y < altura; y++) {
    if (y % lado === 0) {
      blocos = Array.from({ length: colunas * 3 }, proximo);
    }
    const inicio = y * tamanhoDaLinha;
    linhas[inicio] = 0; // filtro: nenhum
    for (let px = 0; px < largura; px++) {
      const c = Math.floor(px / lado) * 3;
      linhas[inicio + 1 + px * 3] = blocos[c] as number;
      linhas[inicio + 2 + px * 3] = blocos[c + 1] as number;
      linhas[inicio + 3 + px * 3] = blocos[c + 2] as number;
    }
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(largura, 0);
  cabecalho.writeUInt32BE(altura, 4);
  cabecalho.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", cabecalho),
    bloco("IDAT", deflateSync(linhas)),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

export type ArquivoDeTeste = { name: string; mimeType: string; buffer: Buffer };

export const arquivoPng = (name: string, buffer: Buffer): ArquivoDeTeste => ({
  name,
  mimeType: "image/png",
  buffer,
});

// ---------------------------------------------------------------------------------------------
// Gancho dos assets (window.__tabletopAssets) e do mapa (window.__tabletop.imagens)
// ---------------------------------------------------------------------------------------------

export type MetaVista = {
  hash: string;
  tipo: string;
  bytes: number;
  largura: number;
  altura: number;
  donoId: string;
  nomeOriginal: string;
  pedacos: string[];
  tiles?: { hash: string; x: number; y: number; largura: number; altura: number }[];
};

export type StatusVisto = {
  hash: string;
  estado: string;
  recebidos: number;
  total: number;
  nome: string;
};

type GanchoDosAssets = {
  inventario(): string[];
  metas(): MetaVista[];
  pronto(hash: string): boolean;
  status(): StatusVisto[];
  verificarCache(): Promise<{ hash: string; ok: boolean; bytes: number }[]>;
  inicioDe(hash: string, n?: number): Promise<string | null>;
  gravados(): Promise<{ caminho: string; bytes: number; sha256: string }[]>;
};

type ImagensVistas = {
  tiles: { hash: string; x: number; y: number; largura: number; altura: number }[];
  tokensComImagem: string[];
};

/** Chama o gancho `window.__tabletopAssets` (só existe no modo e2e) dentro da página. */
export function assets<K extends keyof GanchoDosAssets>(
  pagina: Page,
  metodo: K,
  ...args: Parameters<GanchoDosAssets[K]>
): Promise<Awaited<ReturnType<GanchoDosAssets[K]>>> {
  return pagina.evaluate(
    ([m, a]) =>
      (
        window as unknown as { __tabletopAssets: Record<string, (...x: unknown[]) => unknown> }
      ).__tabletopAssets[m as string]?.(...(a as unknown[])),
    [metodo, args] as const,
  ) as Promise<Awaited<ReturnType<GanchoDosAssets[K]>>>;
}

/** O que o mapa desenha de imagem local (tiles do fundo e tokens com imagem). */
export function imagensDoMapa(pagina: Page): Promise<ImagensVistas> {
  return pagina.evaluate(() =>
    (window as unknown as { __tabletop: { imagens(): ImagensVistas } }).__tabletop.imagens(),
  );
}

/** Adiciona arquivos pela aba Biblioteca (o mesmo caminho do input de arquivos soltos). */
export async function adicionarArquivos(pagina: Page, arquivos: ArquivoDeTeste[]): Promise<void> {
  await abrirAba(pagina, "biblioteca");
  await pagina.getByTestId("biblioteca-arquivos").setInputFiles(arquivos);
  for (const a of arquivos) {
    await expect(
      pagina.locator(`[data-testid="biblioteca-item"][data-nome="${a.name}"]`),
    ).toBeVisible();
  }
}

export async function escolherArquivo(pagina: Page, nome: string): Promise<void> {
  await abrirAba(pagina, "biblioteca");
  await pagina.locator(`[data-testid="biblioteca-item"][data-nome="${nome}"]`).click();
  await expect(pagina.getByTestId("biblioteca-acoes")).toContainText(nome);
}

/** Espera o asset (ou o mapa fatiado inteiro) estar no cache local desta página. */
export async function esperarPronto(pagina: Page, hash: string): Promise<void> {
  await expect.poll(() => assets(pagina, "pronto", hash), { timeout: 30_000 }).toBe(true);
}

/** Meta que o navegador conhece pelo nome do arquivo original (espera ela existir). */
export async function metaPorNome(pagina: Page, nome: string): Promise<MetaVista> {
  let achada: MetaVista | undefined;
  await expect
    .poll(async () => {
      achada = (await assets(pagina, "metas")).find((m) => m.nomeOriginal === nome);
      return achada !== undefined;
    })
    .toBe(true);
  return achada as MetaVista;
}
