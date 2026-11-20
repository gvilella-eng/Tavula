import { deflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";
import { menuDaCena } from "./ajudas";

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

/** PNG de uma cor só (`rgb`), do tamanho pedido: um mapa claro ou escuro para ver os rótulos sobre ele. */
export function pngDeCor(largura: number, altura: number, rgb: [number, number, number]): Buffer {
  const tamanhoDaLinha = largura * 3 + 1;
  const linhas = Buffer.alloc(tamanhoDaLinha * altura);
  for (let y = 0; y < altura; y++) {
    for (let px = 0; px < largura; px++) {
      const i = y * tamanhoDaLinha + 1 + px * 3;
      linhas[i] = rgb[0];
      linhas[i + 1] = rgb[1];
      linhas[i + 2] = rgb[2];
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

/**
 * PNG de uma sala redonda (chão de pedra com a borda mais escura, fora do círculo é rocha): o desenho do mapa
 * que as paredes em arco acompanham. O centro e o raio são em pixels.
 */
export function pngDeSalaRedonda(
  largura: number,
  altura: number,
  centro: { x: number; y: number },
  raio: number,
): Buffer {
  const tamanhoDaLinha = largura * 3 + 1;
  const linhas = Buffer.alloc(tamanhoDaLinha * altura);
  for (let y = 0; y < altura; y++) {
    for (let px = 0; px < largura; px++) {
      const d = Math.hypot(px - centro.x, y - centro.y);
      const ladrilho = (Math.floor(px / 46) + Math.floor(y / 46)) % 2 === 0;
      const cor: [number, number, number] =
        d <= raio - 10
          ? ladrilho
            ? [166, 152, 128]
            : [150, 137, 115]
          : d <= raio + 10
            ? [74, 64, 52]
            : [38, 34, 30];
      const i = y * tamanhoDaLinha + 1 + px * 3;
      linhas[i] = cor[0];
      linhas[i + 1] = cor[1];
      linhas[i + 2] = cor[2];
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
  /** Põe um arquivo de texto na "pasta" do mestre (Lote 14: o `compendio/magias.json`). */
  adicionarNaPasta(caminho: string, texto: string): void;
  /** A "pasta" dos testes (a `Memoria`) passa a valer como a pasta local com escrita (R5b). */
  usarMemoriaComoPasta(valor: boolean): void;
  /** Q1: o estado da "pasta" dos testes (`nenhuma`, `reautorizar` ou `autorizada`). */
  simularPasta(estado: "nenhuma" | "reautorizar" | "autorizada" | null): void;
  /** Q1: tudo o que a "pasta" guarda, em base64, para levar a outro navegador (a mesma pasta do computador). */
  exportarPasta(): { caminho: string; base64: string }[];
  /** Q1: põe na "pasta" deste navegador o que `exportarPasta` devolveu. */
  importarPasta(lista: { caminho: string; base64: string }[]): void;
  /** AS1: de onde cada arquivo veio (pasta ou rede) e quanto levou, e a leitura do cache medida. */
  medidasDeCarga(): {
    hash: string;
    origem: "cache" | "pasta" | "rede";
    ms: number;
    bytes: number;
  }[];
  lerDoCacheMedindo(hash: string): Promise<{
    hash: string;
    origem: "cache" | "pasta" | "rede";
    ms: number;
    bytes: number;
  } | null>;
  /** AS1: o motivo de um arquivo ter sido recusado ao conferir os bytes (ou nulo). */
  recusado(hash: string): string | null;
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

/**
 * Escolhe um arquivo no seletor de imagem que está aberto (o mesmo caminho do "Escolher arquivo…")
 * e espera o seletor fechar: o arquivo foi processado e registrado.
 */
export async function escolherNoSeletor(pagina: Page, arquivo: ArquivoDeTeste): Promise<void> {
  await expect(pagina.getByTestId("seletor-imagem")).toBeVisible();
  await pagina.getByTestId("seletor-arquivo").setInputFiles(arquivo);
  await expect(pagina.getByTestId("seletor-imagem")).toHaveCount(0, { timeout: 30_000 });
}

/**
 * O mestre usa o arquivo como mapa da cena: card da cena → Configurar… → escolher a imagem →
 * (pixels por quadrado) → Salvar. Sem `px` vale o padrão do diálogo.
 */
export async function definirMapa(
  pagina: Page,
  cenaId: string,
  arquivo: ArquivoDeTeste,
  px?: number,
): Promise<void> {
  await menuDaCena(pagina, cenaId, "configurar");
  await expect(pagina.getByTestId("configurar-cena")).toBeVisible();
  await pagina.getByTestId("cfg-mapa").click();
  await escolherNoSeletor(pagina, arquivo);
  await expect(pagina.getByTestId("cfg-mapa-estado")).toContainText("Imagem nova");
  if (px !== undefined) await pagina.getByTestId("cfg-px").fill(String(px));
  await pagina.getByTestId("cfg-salvar").click();
  await expect(pagina.getByTestId("configurar-cena")).toHaveCount(0);
}

/** Painel do token (já aberto): "Imagem…" e o arquivo. */
export async function imagemDoTokenSelecionado(
  pagina: Page,
  arquivo: ArquivoDeTeste,
): Promise<void> {
  await pagina.getByTestId("token-imagem").click();
  await escolherNoSeletor(pagina, arquivo);
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

/**
 * AS1: um gif animado pequeno (uma cor por quadro), montado aqui sem biblioteca: paleta de 256 cores e LZW sem compressão
 * (um código de 9 bits por pixel, com o código de limpeza no começo). Serve para provar que o gif entra na cena e anima.
 */
export function gifAnimado(
  largura: number,
  altura: number,
  cores: [number, number, number][],
  atrasoCs = 10,
): Buffer {
  const saida: number[] = [];
  const ascii = (t: string) => [...t].map((c) => c.charCodeAt(0));
  saida.push(...ascii("GIF89a"));
  saida.push(largura & 255, largura >> 8, altura & 255, altura >> 8, 0xf7, 0, 0);
  for (let i = 0; i < 256; i++) saida.push(...(cores[i] ?? [0, 0, 0]));
  saida.push(0x21, 0xff, 0x0b, ...ascii("NETSCAPE2.0"), 0x03, 0x01, 0, 0, 0);
  for (let q = 0; q < cores.length; q++) {
    saida.push(0x21, 0xf9, 0x04, 0x00, atrasoCs & 255, atrasoCs >> 8, 0, 0);
    saida.push(0x2c, 0, 0, 0, 0, largura & 255, largura >> 8, altura & 255, altura >> 8, 0);
    // LZW: código de limpeza (256), depois cada pixel como código literal, e o fim (257); 9 bits cada, do menos significativo.
    const codigos = [256, ...new Array<number>(largura * altura).fill(q), 257];
    const bytes: number[] = [];
    let acumulado = 0;
    let bits = 0;
    for (const c of codigos) {
      acumulado |= c << bits;
      bits += 9;
      while (bits >= 8) {
        bytes.push(acumulado & 255);
        acumulado >>= 8;
        bits -= 8;
      }
    }
    if (bits > 0) bytes.push(acumulado & 255);
    saida.push(8);
    for (let i = 0; i < bytes.length; i += 255) {
      const parte = bytes.slice(i, i + 255);
      saida.push(parte.length, ...parte);
    }
    saida.push(0);
  }
  saida.push(0x3b);
  return Buffer.from(saida);
}

/** AS1: solta um arquivo (nome, tipo e bytes) no ponto da PÁGINA, como se viesse do computador (evento de soltar do navegador). */
export async function soltarArquivoNoMapa(
  pagina: Page,
  arquivo: { name: string; mimeType: string; buffer: Buffer },
  alvo: { x: number; y: number },
): Promise<void> {
  const dataTransfer = await pagina.evaluateHandle(
    ({ nome, tipo, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], nome, { type: tipo }));
      return dt;
    },
    { nome: arquivo.name, tipo: arquivo.mimeType, base64: arquivo.buffer.toString("base64") },
  );
  await pagina.dispatchEvent('[data-testid="mapa"]', "drop", {
    dataTransfer,
    clientX: alvo.x,
    clientY: alvo.y,
  });
}
