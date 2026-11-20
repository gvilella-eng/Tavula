import type { AnimacoesDaChama, EstiloDaChama } from "@tabletop/shared";
import { Rectangle, Texture } from "pixi.js";

// FG1: a chama animada do mapa. As animações PADRÃO são geradas aqui, por código (canvas 2D, sem arquivo nenhum de
// terceiros): uma folha de quadros por estilo (tocha, fogueira) e estágio (forte, fraca, morrendo), que roda em laço
// sem emenda. A animação PRÓPRIA do mestre (gif, webp animado ou apng) é decodificada quadro a quadro pelo
// `ImageDecoder` do navegador e vira outra folha igual. Em tudo isso nada vem da internet.

export type EstagioDaChama = keyof AnimacoesDaChama;

/** Uma animação pronta: os quadros (texturas de uma folha só), quanto cada um dura e a duração do laço. */
export type Quadros = {
  texturas: Texture[];
  duracoesMs: number[];
  totalMs: number;
  /** Proporção largura/altura do quadro (a chama é esticada ao tamanho que o mestre quer). */
  origem: "padrao" | "arquivo";
  folha: Texture;
};

const QUADROS_DO_PADRAO = 16;
const MS_POR_QUADRO_DO_PADRAO = 80;
/** Do arquivo do mestre: no máximo isto de quadros e esta medida do lado maior (o resto é reduzido). */
const MAX_QUADROS_DO_ARQUIVO = 48;
const LADO_MAX_DO_ARQUIVO = 160;

type Forma = { larg: number; alt: number };
const FORMA: Record<EstiloDaChama, Forma> = {
  tocha: { larg: 72, alt: 104 },
  fogueira: { larg: 104, alt: 104 },
};

type Receita = {
  escala: number;
  linguas: number;
  brasas: number;
  /** Quanto o fogo oscila de um quadro a outro (o "morrendo" tremula mais). */
  tremor: number;
  /** 0 = laranja de sempre; 1 = vermelho de brasa. */
  brasa: number;
};

const RECEITAS: Record<EstiloDaChama, Record<EstagioDaChama, Receita>> = {
  tocha: {
    forte: { escala: 1, linguas: 3, brasas: 7, tremor: 0.12, brasa: 0 },
    fraca: { escala: 0.72, linguas: 2, brasas: 4, tremor: 0.16, brasa: 0.25 },
    morrendo: { escala: 0.42, linguas: 2, brasas: 3, tremor: 0.3, brasa: 0.7 },
  },
  fogueira: {
    forte: { escala: 1, linguas: 7, brasas: 10, tremor: 0.1, brasa: 0 },
    fraca: { escala: 0.72, linguas: 5, brasas: 6, tremor: 0.14, brasa: 0.25 },
    morrendo: { escala: 0.42, linguas: 3, brasas: 4, tremor: 0.26, brasa: 0.7 },
  },
};

const TAU = Math.PI * 2;

/** Um número pseudoaleatório fixo (0 a 1) para cada semente: a chama é sempre a mesma, sem `Math.random`. */
function fixo(semente: number): number {
  const x = Math.sin(semente * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function cor(base: [number, number, number], brasa: number, alfa: number): string {
  // Com `brasa`, o laranja puxa para o vermelho escuro.
  const r = base[0];
  const g = Math.round(base[1] * (1 - 0.55 * brasa));
  const b = Math.round(base[2] * (1 - 0.7 * brasa));
  return `rgba(${r},${g},${b},${alfa})`;
}

function lingua(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  largura: number,
  altura: number,
  balanco: number,
  paleta: Array<[number, [number, number, number], number]>,
  brasa: number,
): void {
  const grad = ctx.createLinearGradient(0, base, 0, base - altura);
  for (const [parada, rgb, alfa] of paleta) grad.addColorStop(parada, cor(rgb, brasa, alfa));
  ctx.fillStyle = grad;
  // Uma gota de fogo: base redonda (sem corte reto), ponta no alto, inclinada pelo balanço.
  const fundo = base + largura * 0.28;
  ctx.beginPath();
  ctx.moveTo(x, fundo);
  ctx.bezierCurveTo(
    x - largura * 0.62,
    fundo,
    x - largura * 0.5 + balanco * 0.4,
    base - altura * 0.45,
    x + balanco,
    base - altura,
  );
  ctx.bezierCurveTo(
    x + largura * 0.5 + balanco * 0.4,
    base - altura * 0.45,
    x + largura * 0.62,
    fundo,
    x,
    fundo,
  );
  ctx.closePath();
  ctx.fill();
}

/** Desenha UM quadro da chama (visto de cima, um pouco dimétrico) no retângulo (ox, 0, larg, alt) do canvas. */
function desenharQuadro(
  ctx: CanvasRenderingContext2D,
  ox: number,
  forma: Forma,
  t: number,
  estilo: EstiloDaChama,
  r: Receita,
): void {
  const { larg, alt } = forma;
  ctx.save();
  ctx.translate(ox, 0);
  ctx.beginPath();
  ctx.rect(0, 0, larg, alt);
  ctx.clip();
  const cx = larg / 2;
  const base = alt * 0.7;
  const esc = r.escala;

  // O brilho no chão: um halo suave e uma cama de brasas achatada (a vista dimétrica).
  ctx.globalCompositeOperation = "source-over";
  const halo = ctx.createRadialGradient(cx, base - alt * 0.1, 0, cx, base - alt * 0.1, larg * 0.5);
  halo.addColorStop(0, cor([255, 160, 60], r.brasa, 0.55 * esc + 0.1));
  halo.addColorStop(0.55, cor([255, 110, 30], r.brasa, 0.2 * esc));
  halo.addColorStop(1, cor([255, 90, 20], r.brasa, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, larg, alt);

  if (estilo === "fogueira") {
    // Duas achas cruzadas sob o fogo.
    ctx.fillStyle = "rgba(38,24,14,0.95)";
    for (const sinal of [-1, 1]) {
      ctx.save();
      ctx.translate(cx, base + alt * 0.02);
      ctx.rotate(sinal * 0.42);
      ctx.beginPath();
      ctx.roundRect(-larg * 0.34, -alt * 0.035, larg * 0.68, alt * 0.07, alt * 0.035);
      ctx.fill();
      ctx.restore();
    }
  }
  const leito = ctx.createRadialGradient(
    cx,
    base,
    0,
    cx,
    base,
    larg * (estilo === "tocha" ? 0.2 : 0.34),
  );
  leito.addColorStop(0, cor([255, 210, 110], r.brasa, 0.9));
  leito.addColorStop(0.6, cor([230, 80, 20], r.brasa, 0.7));
  leito.addColorStop(1, cor([140, 30, 10], r.brasa, 0));
  ctx.save();
  ctx.translate(cx, base);
  ctx.scale(1, 0.42);
  ctx.translate(-cx, -base);
  ctx.fillStyle = leito;
  ctx.fillRect(0, 0, larg, alt);
  ctx.restore();

  // As línguas de fogo: somam luz umas nas outras.
  ctx.globalCompositeOperation = "lighter";
  const n = r.linguas;
  const aberto = estilo === "tocha" ? 0.14 : 0.34;
  for (let i = 0; i < n; i++) {
    const fase = fixo(i * 3.1 + (estilo === "tocha" ? 0.3 : 1.7));
    const centro = n === 1 ? 0 : i / (n - 1) - 0.5;
    const x = cx + centro * larg * aberto * 2;
    const vida =
      0.75 +
      0.25 * Math.sin(TAU * (t + fase)) +
      r.tremor * Math.sin(TAU * (2 * t + fase * 3)) * 0.5;
    const meio = 1 - Math.abs(centro) * 0.9;
    const altura =
      alt * 0.56 * esc * vida * (0.55 + 0.45 * meio) * (estilo === "tocha" ? 1.05 : 0.95);
    const largura = larg * (estilo === "tocha" ? 0.42 : 0.24) * (0.6 + 0.4 * esc);
    const balanco =
      larg * (0.05 + r.tremor * 0.3) * Math.sin(TAU * (t + fase * 2)) * (centro >= 0 ? 1 : -1);
    lingua(
      ctx,
      x,
      base,
      largura,
      altura,
      balanco,
      [
        [0, [255, 70, 20], 0.85],
        [0.55, [255, 150, 40], 0.65],
        [1, [255, 210, 90], 0],
      ],
      r.brasa,
    );
    lingua(
      ctx,
      x,
      base,
      largura * 0.62,
      altura * 0.72,
      balanco * 0.8,
      [
        [0, [255, 190, 60], 0.9],
        [1, [255, 230, 130], 0],
      ],
      r.brasa * 0.6,
    );
    lingua(
      ctx,
      x,
      base,
      largura * 0.3,
      altura * 0.42,
      balanco * 0.55,
      [
        [0, [255, 250, 200], 0.95],
        [1, [255, 245, 190], 0],
      ],
      r.brasa * 0.3,
    );
  }

  // Faíscas que sobem e se apagam (voltam ao começo no fim do laço).
  for (let k = 0; k < r.brasas; k++) {
    const u = (t + k / r.brasas + fixo(k * 5.3) * 0.2) % 1;
    const dx = (fixo(k * 7.7) - 0.5) * larg * (estilo === "tocha" ? 0.3 : 0.6);
    const x = cx + dx + Math.sin(TAU * (u * 2 + fixo(k))) * larg * 0.04;
    const y = base - alt * 0.08 - u * alt * 0.55 * Math.max(0.5, esc);
    const raio = Math.max(0.7, larg * 0.022 * (1 - u));
    ctx.fillStyle = cor([255, 200, 90], r.brasa, (1 - u) * 0.95);
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function criarTela(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function contexto2d(tela: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D {
  const ctx = tela.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("O navegador não desenha em canvas 2D.");
  return ctx;
}

/** Faz as texturas (uma folha, vários recortes) a partir de uma folha de quadros em grade. */
function texturasDaFolha(
  tela: HTMLCanvasElement | OffscreenCanvas,
  quadros: number,
  colunas: number,
  larg: number,
  alt: number,
): { folha: Texture; texturas: Texture[] } {
  const folha = Texture.from(tela as unknown as HTMLCanvasElement);
  const texturas: Texture[] = [];
  for (let i = 0; i < quadros; i++) {
    const col = i % colunas;
    const lin = Math.floor(i / colunas);
    texturas.push(
      new Texture({ source: folha.source, frame: new Rectangle(col * larg, lin * alt, larg, alt) }),
    );
  }
  return { folha, texturas };
}

/** Gera a animação padrão de um estilo e estágio: `QUADROS_DO_PADRAO` quadros de um laço sem emenda. */
export function gerarPadrao(estilo: EstiloDaChama, estagio: EstagioDaChama): Quadros {
  const forma = FORMA[estilo];
  const receita = RECEITAS[estilo][estagio];
  const colunas = 8;
  const linhas = Math.ceil(QUADROS_DO_PADRAO / colunas);
  const tela = criarTela(colunas * forma.larg, linhas * forma.alt);
  const ctx = contexto2d(tela);
  for (let i = 0; i < QUADROS_DO_PADRAO; i++) {
    const col = i % colunas;
    const lin = Math.floor(i / colunas);
    ctx.save();
    ctx.translate(0, lin * forma.alt);
    desenharQuadro(ctx, col * forma.larg, forma, i / QUADROS_DO_PADRAO, estilo, receita);
    ctx.restore();
  }
  const { folha, texturas } = texturasDaFolha(
    tela,
    QUADROS_DO_PADRAO,
    colunas,
    forma.larg,
    forma.alt,
  );
  return {
    texturas,
    duracoesMs: texturas.map(() => MS_POR_QUADRO_DO_PADRAO),
    totalMs: texturas.length * MS_POR_QUADRO_DO_PADRAO,
    origem: "padrao",
    folha,
  };
}

type DecoderDoNavegador = {
  tracks: { ready: Promise<void>; selectedTrack?: { frameCount: number } | null };
  decode(o: { frameIndex: number }): Promise<{
    image: {
      duration: number | null;
      displayWidth: number;
      displayHeight: number;
      close(): void;
    };
  }>;
  close(): void;
};

function tipoDoArquivo(bytes: Uint8Array, dito: string): string {
  if (dito.startsWith("image/")) return dito;
  const t = (de: number, s: string) => [...s].every((c, i) => bytes[de + i] === c.charCodeAt(0));
  if (t(0, "GIF8")) return "image/gif";
  if (t(0, "RIFF") && t(8, "WEBP")) return "image/webp";
  return "image/png";
}

/**
 * Decodifica um gif, webp animado ou apng nos quadros de uma folha. Usa o `ImageDecoder` do navegador; sem ele (ou
 * se falhar) fica um quadro só, parado, pela decodificação comum de imagem.
 */
export async function decodificarAnimacao(blob: Blob): Promise<Quadros> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const tipo = tipoDoArquivo(bytes, blob.type);
  const Decoder = (
    globalThis as unknown as {
      ImageDecoder?: new (init: { data: ArrayBuffer; type: string }) => DecoderDoNavegador;
    }
  ).ImageDecoder;
  const imagens: {
    fonte: CanvasImageSource;
    ms: number;
    w: number;
    h: number;
    fechar: () => void;
  }[] = [];
  if (Decoder) {
    try {
      const dec = new Decoder({ data: bytes.buffer.slice(0) as ArrayBuffer, type: tipo });
      await dec.tracks.ready;
      const total = dec.tracks.selectedTrack?.frameCount ?? 1;
      const passo = Math.max(1, Math.ceil(total / MAX_QUADROS_DO_ARQUIVO));
      for (let i = 0; i < total; i += passo) {
        const { image } = await dec.decode({ frameIndex: i });
        imagens.push({
          fonte: image as unknown as CanvasImageSource,
          ms: Math.max(30, Math.min(1000, ((image.duration ?? 100_000) / 1000) * passo)),
          w: image.displayWidth,
          h: image.displayHeight,
          fechar: () => image.close(),
        });
      }
      dec.close();
    } catch {
      for (const i of imagens) i.fechar();
      imagens.length = 0;
    }
  }
  if (imagens.length === 0) {
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: tipo }));
    imagens.push({ fonte: bmp, ms: 1000, w: bmp.width, h: bmp.height, fechar: () => bmp.close() });
  }
  const primeira = imagens[0] as (typeof imagens)[number];
  const k = Math.min(1, LADO_MAX_DO_ARQUIVO / Math.max(primeira.w, primeira.h));
  const larg = Math.max(1, Math.round(primeira.w * k));
  const alt = Math.max(1, Math.round(primeira.h * k));
  const colunas = Math.min(imagens.length, 8);
  const linhas = Math.ceil(imagens.length / colunas);
  const tela = criarTela(colunas * larg, linhas * alt);
  const ctx = contexto2d(tela);
  imagens.forEach((im, i) => {
    ctx.drawImage(im.fonte, (i % colunas) * larg, Math.floor(i / colunas) * alt, larg, alt);
  });
  const duracoesMs = imagens.map((i) => i.ms);
  for (const i of imagens) i.fechar();
  const { folha, texturas } = texturasDaFolha(tela, imagens.length, colunas, larg, alt);
  return {
    texturas,
    duracoesMs,
    totalMs: duracoesMs.reduce((a, b) => a + b, 0),
    origem: "arquivo",
    folha,
  };
}

/** O quadro que vale no instante `agoraMs` (com a defasagem `fase`, em ms, para as chamas não baterem juntas). */
export function indiceDoQuadro(q: Quadros, agoraMs: number, fase: number): number {
  if (q.texturas.length <= 1 || q.totalMs <= 0) return 0;
  let t = (agoraMs + fase) % q.totalMs;
  for (let i = 0; i < q.duracoesMs.length; i++) {
    t -= q.duracoesMs[i] as number;
    if (t < 0) return i;
  }
  return q.texturas.length - 1;
}

/** Uma defasagem fixa (0 a 1 s) para cada id. */
export function faseDoId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 1000;
}

/**
 * As animações de chama de UM mapa (as texturas pertencem ao renderer dele): as padrão, geradas na hora em que
 * alguém as pede, e as arquivos do mestre, decodificadas em segundo plano (enquanto não chegam, vale a padrão).
 */
export class ChamasDoMapa {
  private readonly padroes = new Map<string, Quadros>();
  private readonly arquivos = new Map<string, Quadros>();
  private readonly pedidos = new Set<string>();
  /** Pedidos cujo arquivo ainda não estava no cache local: voltam a ser pedidos quando o cache muda. */
  private readonly faltou = new Set<string>();
  private destruido = false;

  constructor(
    private readonly lerBlob: (hash: string) => Promise<Blob | null>,
    private readonly aoChegar: () => void,
  ) {}

  padrao(estilo: EstiloDaChama, estagio: EstagioDaChama): Quadros {
    const chave = `${estilo}/${estagio}`;
    let q = this.padroes.get(chave);
    if (!q) {
      q = gerarPadrao(estilo, estagio);
      this.padroes.set(chave, q);
    }
    return q;
  }

  /** A animação própria já decodificada, ou `null` (e pede a decodificação, uma vez). */
  doArquivo(hash: string): Quadros | null {
    const pronta = this.arquivos.get(hash);
    if (pronta) return pronta;
    if (!this.pedidos.has(hash)) {
      this.pedidos.add(hash);
      void this.lerBlob(hash)
        .then(async (blob) => {
          if (!blob || this.destruido) {
            this.faltou.add(hash);
            return;
          }
          const q = await decodificarAnimacao(blob);
          if (this.destruido) return;
          this.arquivos.set(hash, q);
          this.aoChegar();
        })
        .catch((e) => {
          console.warn("Não consegui decodificar a animação da chama", e);
        });
    }
    return null;
  }

  /** A animação do estágio: a do mestre (se escolheu e já está pronta) ou a padrão do estilo. */
  escolher(
    animacoes: AnimacoesDaChama | undefined,
    estilo: EstiloDaChama,
    estagio: EstagioDaChama,
  ): Quadros {
    const hash = animacoes?.[estagio];
    if (hash) {
      const q = this.doArquivo(hash);
      if (q) return q;
    }
    return this.padrao(estilo, estagio);
  }

  /** Esquece o que ainda não chegou (o cache de imagens mudou): a próxima chamada pede de novo. */
  tentarDeNovo(): void {
    for (const h of this.faltou) this.pedidos.delete(h);
    this.faltou.clear();
  }

  destruir(): void {
    this.destruido = true;
    for (const q of [...this.padroes.values(), ...this.arquivos.values()]) {
      for (const t of q.texturas) t.destroy(false);
      q.folha.destroy(true);
    }
    this.padroes.clear();
    this.arquivos.clear();
  }
}
