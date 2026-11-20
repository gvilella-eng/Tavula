import type { AnimacoesDaChama, EstiloDaChama } from "@tabletop/shared";
import { Rectangle, Texture } from "pixi.js";

// FG1: a chama animada do mapa. As animações PADRÃO são geradas aqui, por código (canvas 2D, sem arquivo nenhum de
// terceiros): uma folha de quadros por estilo (tocha, fogueira) e estágio (forte, fraca, morrendo), que roda em laço
// sem emenda. A animação PRÓPRIA do mestre (gif, webp animado ou apng) é decodificada quadro a quadro pelo
// `ImageDecoder` do navegador e vira outra folha igual. Em tudo isso nada vem da internet.

export type EstagioDaChama = keyof AnimacoesDaChama;

/**
 * FG2: a chama animada da tocha na mão do token. Só a fonte acesa e com fogo (a que tremula: a tocha, não a lanterna)
 * tem chama; ela segue o estágio do objeto (forte, fraca, morrendo), e sem estágio (tempo escondido do jogador) vale
 * o forte. Devolve `null` quando o pino mantém o ícone.
 */
export function estagioDaChamaDaMao(
  estado: "acesa" | "apagada",
  estagio: EstagioDaChama | undefined,
  temFogo: boolean,
): EstagioDaChama | null {
  if (estado !== "acesa" || !temFogo) return null;
  return estagio ?? "forte";
}

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

export type Forma = { larg: number; alt: number };
export const FORMA: Record<EstiloDaChama, Forma> = {
  tocha: { larg: 72, alt: 104 },
  fogueira: { larg: 104, alt: 104 },
};

export type Receita = {
  escala: number;
  linguas: number;
  brasas: number;
  /** Quanto o fogo oscila de um quadro a outro (o "morrendo" tremula mais). */
  tremor: number;
  /** 0 = laranja de sempre; 1 = vermelho de brasa. */
  brasa: number;
};

export const RECEITAS: Record<EstiloDaChama, Record<EstagioDaChama, Receita>> = {
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

/**
 * Uma língua de fogo: uma gota com a base redonda e a ponta no alto, inclinada pelo balanço. A chama é uma MASSA só:
 * todas as gotas de um quadro nascem na mesma base, se sobrepõem na maior parte e balançam juntas.
 */
export type Gota = {
  x: number;
  base: number;
  largura: number;
  altura: number;
  balanco: number;
};

/** Uma brasa que sobe por dentro do fogo. */
export type Brasa = { x: number; y: number; raio: number; alfa: number };

/** O que há num quadro, em pixels do quadro (sem canvas): a geometria é testável, o desenho é só pintar. */
export type QuadroDaChama = {
  cx: number;
  base: number;
  gotas: Gota[];
  /** O núcleo mais claro (mesmas gotas, menores, mais quentes). */
  nucleo: Gota[];
  brasas: Brasa[];
  /** A cama de brasas no chão (elipse achatada). */
  leito: { rx: number; ry: number };
};

/** O contorno de uma gota como polígono (as duas curvas de Bézier achatadas), para conferir a silhueta. */
export function contornoDaGota(g: Gota, passos = 14): Array<[number, number]> {
  const fundo = g.base + g.largura * 0.28;
  const topo = g.base - g.altura;
  const pts: Array<[number, number]> = [];
  const bez = (
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
  ) => {
    for (let i = 0; i <= passos; i++) {
      const u = i / passos;
      const m = 1 - u;
      pts.push([
        m * m * m * p0[0] + 3 * m * m * u * p1[0] + 3 * m * u * u * p2[0] + u * u * u * p3[0],
        m * m * m * p0[1] + 3 * m * m * u * p1[1] + 3 * m * u * u * p2[1] + u * u * u * p3[1],
      ]);
    }
  };
  bez(
    [g.x, fundo],
    [g.x - g.largura * 0.62, fundo],
    [g.x - g.largura * 0.5 + g.balanco * 0.4, g.base - g.altura * 0.45],
    [g.x + g.balanco, topo],
  );
  bez(
    [g.x + g.balanco, topo],
    [g.x + g.largura * 0.5 + g.balanco * 0.4, g.base - g.altura * 0.45],
    [g.x + g.largura * 0.62, fundo],
    [g.x, fundo],
  );
  return pts;
}

/**
 * Monta UM quadro da chama no instante `t` (0 a 1, em laço sem emenda: só entram senos de frequência inteira).
 * Tocha: um corpo e duas ou três línguas coladas nele, que balançam juntas (nunca duas pontas afastadas).
 * Fogueira: uma massa larga, com a base brilhante, línguas que se juntam no corpo (o contorno de cima é um monte
 * de pontas pequenas sobre uma massa só) e brasas subindo por dentro; sem lenha nem pedras (isso é item do mapa).
 */
export function montarQuadro(
  forma: Forma,
  t: number,
  estilo: EstiloDaChama,
  r: Receita,
): QuadroDaChama {
  const { larg, alt } = forma;
  const cx = larg / 2;
  const base = alt * 0.7;
  const esc = r.escala;
  const vida = (fase: number) =>
    0.8 + 0.2 * Math.sin(TAU * (t + fase)) + r.tremor * 0.5 * Math.sin(TAU * (2 * t + fase * 3));
  const gotas: Gota[] = [];
  const nucleo: Gota[] = [];
  const brasas: Brasa[] = [];

  if (estilo === "tocha") {
    const v0 = vida(0.3);
    const larguraDoCorpo = larg * 0.4 * (0.6 + 0.4 * esc);
    const alturaDoCorpo = alt * 0.58 * esc * v0;
    // o vento é um só para o corpo e para as línguas: elas inclinam juntas
    const vento = larg * (0.04 + r.tremor * 0.25) * Math.sin(TAU * (t + fixo(1.1)));
    gotas.push({
      x: cx,
      base,
      largura: larguraDoCorpo,
      altura: alturaDoCorpo,
      balanco: vento,
    });
    const n = r.linguas;
    for (let i = 0; i < n; i++) {
      const lado = n === 1 ? 0 : i / (n - 1) - 0.5;
      const fase = fixo(i * 3.1 + 0.3);
      const proprio = larg * 0.025 * Math.sin(TAU * (2 * t + fase * 2));
      gotas.push({
        x: cx + lado * larg * 0.07,
        base,
        largura: larguraDoCorpo * 0.66,
        altura: alturaDoCorpo * (0.62 + 0.3 * vida(fase)),
        balanco: vento * 0.9 + proprio,
      });
    }
    for (const g of gotas.slice(0, 2)) {
      nucleo.push({
        ...g,
        largura: g.largura * 0.55,
        altura: g.altura * 0.7,
        balanco: g.balanco * 0.8,
      });
    }
    for (let k = 0; k < r.brasas; k++) {
      const u = (t + k / r.brasas + fixo(k * 5.3) * 0.2) % 1;
      const dx = (fixo(k * 7.7) - 0.5) * larguraDoCorpo * 0.5 * (1 - u * 0.8);
      // sobem por dentro do corpo e apagam antes da ponta (a chama não solta pontinhos)
      brasas.push({
        x: cx + dx + vento * u * u * 0.8,
        y: base - alt * 0.03 - u * alturaDoCorpo * 0.6,
        raio: Math.max(0.7, larg * 0.02 * (1 - u)),
        alfa: (1 - u) * 0.9,
      });
    }
    return { cx, base, gotas, nucleo, brasas, leito: { rx: larg * 0.2, ry: larg * 0.2 * 0.42 } };
  }

  // Fogueira: massa larga e única.
  const n = r.linguas;
  const largaDoMonte = larg * 0.5;
  const vento = larg * (0.03 + r.tremor * 0.2) * Math.sin(TAU * (t + fixo(2.2)));
  const v0 = vida(0.7);
  const alturaDoCorpo = alt * 0.6 * esc * v0;
  const larguraDoCorpo = largaDoMonte * (0.7 + 0.3 * esc);
  gotas.push({ x: cx, base, largura: larguraDoCorpo, altura: alturaDoCorpo, balanco: vento });
  const passo = n === 1 ? 0 : largaDoMonte / (n - 1);
  for (let i = 0; i < n; i++) {
    const c = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2;
    const fase = fixo(i * 3.1 + 1.7);
    const perfil = 0.4 + 0.6 * (1 - Math.abs(c) ** 1.6);
    const proprio = passo * 0.18 * Math.sin(TAU * (2 * t + fase * 2));
    gotas.push({
      x: cx + (n === 1 ? 0 : c * (largaDoMonte / 2)),
      base,
      // cada língua cobre mais que o espaço até a vizinha: o monte é uma massa, não uma fileira
      largura: Math.max(larg * 0.2, passo * 2.4) * (0.7 + 0.3 * esc),
      altura: alt * 0.62 * esc * perfil * vida(fase),
      balanco: vento * (0.6 + 0.4 * perfil) + proprio,
    });
  }
  nucleo.push({
    x: cx,
    base,
    largura: larguraDoCorpo * 0.4,
    altura: alturaDoCorpo * 0.7,
    balanco: vento * 0.7,
  });
  nucleo.push({
    x: cx,
    base,
    largura: larguraDoCorpo * 0.2,
    altura: alturaDoCorpo * 0.42,
    balanco: vento * 0.5,
  });
  for (let k = 0; k < r.brasas; k++) {
    const u = (t + k / r.brasas + fixo(k * 5.3) * 0.2) % 1;
    const dx = (fixo(k * 7.7) - 0.5) * larguraDoCorpo * 0.7 * (1 - u * 0.7);
    brasas.push({
      x: cx + dx + vento * u * u * 0.8,
      y: base - alt * 0.03 - u * alturaDoCorpo * 0.6,
      raio: Math.max(0.7, larg * 0.022 * (1 - u)),
      alfa: (1 - u) * 0.9,
    });
  }
  return {
    cx,
    base,
    gotas,
    nucleo,
    brasas,
    leito: { rx: larg * 0.34 * (0.7 + 0.3 * esc), ry: larg * 0.34 * 0.42 },
  };
}

function preencherGota(
  ctx: CanvasRenderingContext2D,
  g: Gota,
  paleta: Array<[number, [number, number, number], number]>,
  brasa: number,
): void {
  const grad = ctx.createLinearGradient(0, g.base, 0, g.base - g.altura);
  for (const [parada, rgb, alfa] of paleta) grad.addColorStop(parada, cor(rgb, brasa, alfa));
  ctx.fillStyle = grad;
  const fundo = g.base + g.largura * 0.28;
  ctx.beginPath();
  ctx.moveTo(g.x, fundo);
  ctx.bezierCurveTo(
    g.x - g.largura * 0.62,
    fundo,
    g.x - g.largura * 0.5 + g.balanco * 0.4,
    g.base - g.altura * 0.45,
    g.x + g.balanco,
    g.base - g.altura,
  );
  ctx.bezierCurveTo(
    g.x + g.largura * 0.5 + g.balanco * 0.4,
    g.base - g.altura * 0.45,
    g.x + g.largura * 0.62,
    fundo,
    g.x,
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
  const q = montarQuadro(forma, t, estilo, r);
  const { cx, base } = q;
  const esc = r.escala;
  ctx.save();
  ctx.translate(ox, 0);
  ctx.beginPath();
  ctx.rect(0, 0, larg, alt);
  ctx.clip();

  // O brilho no chão: um halo suave e uma cama de brasas achatada (a vista dimétrica). Na fogueira a base é larga e
  // bem brilhante: é daí que o fogo sai.
  ctx.globalCompositeOperation = "source-over";
  const halo = ctx.createRadialGradient(
    cx,
    base - alt * 0.1,
    0,
    cx,
    base - alt * 0.1,
    Math.min(larg, alt) * 0.4,
  );
  halo.addColorStop(0, cor([255, 160, 60], r.brasa, 0.55 * esc + 0.1));
  halo.addColorStop(0.55, cor([255, 110, 30], r.brasa, 0.2 * esc));
  halo.addColorStop(1, cor([255, 90, 20], r.brasa, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, larg, alt);

  const leito = ctx.createRadialGradient(cx, base, 0, cx, base, q.leito.rx);
  leito.addColorStop(0, cor([255, 205, 100], r.brasa, estilo === "fogueira" ? 0.9 : 0.9));
  leito.addColorStop(0.55, cor([240, 95, 25], r.brasa, estilo === "fogueira" ? 0.85 : 0.7));
  leito.addColorStop(1, cor([140, 30, 10], r.brasa, 0));
  ctx.save();
  ctx.translate(cx, base);
  ctx.scale(1, 0.42);
  ctx.translate(-cx, -base);
  ctx.fillStyle = leito;
  ctx.fillRect(0, 0, larg, alt);
  ctx.restore();

  // As línguas de fogo: somam luz umas nas outras, em três camadas (vermelho, laranja e o núcleo claro).
  ctx.globalCompositeOperation = "lighter";
  for (const g of q.gotas) {
    preencherGota(
      ctx,
      g,
      [
        [0, [255, 70, 20], 0.7],
        [0.55, [255, 150, 40], 0.55],
        [1, [255, 210, 90], 0],
      ],
      r.brasa,
    );
  }
  for (const g of q.gotas) {
    preencherGota(
      ctx,
      { ...g, largura: g.largura * 0.62, altura: g.altura * 0.72, balanco: g.balanco * 0.8 },
      [
        [0, [255, 190, 60], 0.75],
        [1, [255, 230, 130], 0],
      ],
      r.brasa * 0.6,
    );
  }
  for (const g of q.nucleo) {
    preencherGota(
      ctx,
      g,
      [
        [0, [255, 245, 200], 0.75],
        [1, [255, 240, 180], 0],
      ],
      r.brasa * 0.3,
    );
  }

  // As brasas sobem por dentro do fogo e se apagam (voltam ao começo no fim do laço).
  for (const b of q.brasas) {
    ctx.fillStyle = cor([255, 200, 90], r.brasa, b.alfa);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.raio, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * As regiões conexas de uma máscara (`true` onde o alfa passa do limiar), com vizinhança de 4. A chama de um quadro
 * tem de ser UMA região (o teste da geração e o do navegador usam esta mesma conta).
 */
export function regioesConexas(mascara: Uint8Array | boolean[], larg: number, alt: number): number {
  const visto = new Uint8Array(larg * alt);
  let regioes = 0;
  const fila: number[] = [];
  for (let i0 = 0; i0 < larg * alt; i0++) {
    if (!mascara[i0] || visto[i0]) continue;
    regioes++;
    visto[i0] = 1;
    fila.push(i0);
    while (fila.length > 0) {
      const i = fila.pop() as number;
      const x = i % larg;
      const y = (i - x) / larg;
      const vizinhos = [
        x > 0 ? i - 1 : -1,
        x < larg - 1 ? i + 1 : -1,
        y > 0 ? i - larg : -1,
        y < alt - 1 ? i + larg : -1,
      ];
      for (const j of vizinhos) {
        if (j >= 0 && mascara[j] && !visto[j]) {
          visto[j] = 1;
          fila.push(j);
        }
      }
    }
  }
  return regioes;
}

/** A máscara de alfa (dados RGBA) acima do limiar (0 a 255). */
export function mascaraDeAlfa(rgba: ArrayLike<number>, limiar: number): Uint8Array {
  const m = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < m.length; i++) m[i] = (rgba[i * 4 + 3] as number) > limiar ? 1 : 0;
  return m;
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

function pintarFolha(
  estilo: EstiloDaChama,
  estagio: EstagioDaChama,
): { tela: HTMLCanvasElement | OffscreenCanvas; colunas: number; forma: Forma } {
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
  return { tela, colunas, forma };
}

/**
 * Para o teste do navegador: em cada quadro da animação padrão, em quantas regiões conexas se divide a chama (alfa
 * acima do limiar, 0 a 255). Tem de dar 1 em todos.
 */
export function regioesDoPadrao(
  estilo: EstiloDaChama,
  estagio: EstagioDaChama,
  limiar = 90,
): number[] {
  const { tela, colunas, forma } = pintarFolha(estilo, estagio);
  const ctx = contexto2d(tela);
  const contagens: number[] = [];
  for (let i = 0; i < QUADROS_DO_PADRAO; i++) {
    const dados = ctx.getImageData(
      (i % colunas) * forma.larg,
      Math.floor(i / colunas) * forma.alt,
      forma.larg,
      forma.alt,
    );
    contagens.push(regioesConexas(mascaraDeAlfa(dados.data, limiar), forma.larg, forma.alt));
  }
  return contagens;
}

/** Gera a animação padrão de um estilo e estágio: `QUADROS_DO_PADRAO` quadros de um laço sem emenda. */
export function gerarPadrao(estilo: EstiloDaChama, estagio: EstagioDaChama): Quadros {
  const { tela, colunas, forma } = pintarFolha(estilo, estagio);
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
export async function decodificarAnimacao(
  blob: Blob,
  limites: { ladoMax?: number; quadrosMax?: number } = {},
): Promise<Quadros> {
  const quadrosMax = limites.quadrosMax ?? MAX_QUADROS_DO_ARQUIVO;
  const ladoMax = limites.ladoMax ?? LADO_MAX_DO_ARQUIVO;
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
      const passo = Math.max(1, Math.ceil(total / quadrosMax));
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
  const k = Math.min(1, ladoMax / Math.max(primeira.w, primeira.h));
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
