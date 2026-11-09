import { z } from "zod";
import type { Cena, Usuario } from "./estado.ts";

// Desenhos do pincel (Lote 13): traço livre, linha, retângulo e círculo, por cena. Coordenadas em
// metros. Aqui moram o modelo, os limites e a geometria pura (simplificação, caixa, toque, deslocamento).

export const FORMAS_DE_DESENHO = ["livre", "linha", "retangulo", "circulo"] as const;
export const FormaDeDesenhoSchema = z.enum(FORMAS_DE_DESENHO);
export type FormaDeDesenho = z.infer<typeof FormaDeDesenhoSchema>;

export const LIMITES_DO_DESENHO = {
  /** Pontos de um desenho (o traço livre é simplificado antes de enviar). */
  pontos: 2000,
  /** Desenhos por cena. */
  porCena: 1000,
  /** Espessura, em pixels do mundo (zoom 100%). */
  espessuraMin: 1,
  espessuraMax: 24,
  /** Quantos desenhos uma mensagem `desenho.apagar` leva. */
  apagarPorVez: 50,
} as const;

/** Tolerância da simplificação do traço livre, em metros (~2 px no zoom 100%). */
export const TOLERANCIA_DO_TRACO_M = 0.05;
/** Intervalo mínimo entre rascunhos de uma conexão: a sala descarta os que chegam antes. */
export const INTERVALO_MINIMO_RASCUNHO_MS = 30;

const IdCurto = z.string().min(1).max(64);
const PontoDoDesenhoSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
export type PontoDoDesenho = z.infer<typeof PontoDoDesenhoSchema>;

/** Campos de um desenho antes da conferência da geometria (a forma pede uma quantidade de pontos). */
export const DesenhoBaseSchema = z.object({
  id: IdCurto,
  cenaId: IdCurto,
  /** Quem desenhou (o mestre mexe em todos; o jogador, só nos próprios). */
  autorId: IdCurto,
  forma: FormaDeDesenhoSchema,
  /**
   * Livre: o traço (1 ponto = um pingo). Linha: início e fim. Retângulo: dois cantos opostos.
   * Círculo: o centro e um ponto da borda.
   */
  pontos: z.array(PontoDoDesenhoSchema).min(1).max(LIMITES_DO_DESENHO.pontos),
  /** `#rrggbb`. */
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  espessura: z.number().min(LIMITES_DO_DESENHO.espessuraMin).max(LIMITES_DO_DESENHO.espessuraMax),
  /** Só retângulo e círculo. */
  preenchido: z.boolean().optional(),
});

/** Linha, retângulo e círculo têm exatamente dois pontos. */
export function geometriaValida(d: {
  forma: FormaDeDesenho;
  pontos: readonly unknown[];
  preenchido?: boolean | undefined;
}): boolean {
  if (d.forma === "livre") return d.pontos.length >= 1;
  return d.pontos.length === 2;
}

const MENSAGEM_DA_GEOMETRIA = { message: "a forma pede dois pontos" };

export const DesenhoSchema = DesenhoBaseSchema.refine(geometriaValida, MENSAGEM_DA_GEOMETRIA);
export type Desenho = z.infer<typeof DesenhoSchema>;

/** O que o navegador manda para criar: sem autor (é quem manda) e com a cena opcional (a ativa). */
export const DesenhoNovoSchema = DesenhoBaseSchema.omit({ autorId: true, cenaId: true })
  .extend({ cenaId: IdCurto.optional() })
  .refine(geometriaValida, MENSAGEM_DA_GEOMETRIA);
export type DesenhoNovo = z.infer<typeof DesenhoNovoSchema>;

/** Um desenho em andamento (o rascunho): o mesmo formato, sem o id (o id vai ao lado). */
export const DesenhoEmAndamentoSchema = DesenhoBaseSchema.omit({
  id: true,
  autorId: true,
  cenaId: true,
})
  .extend({ cenaId: IdCurto.optional() })
  .refine(geometriaValida, MENSAGEM_DA_GEOMETRIA);

export type DesenhoEmAndamento = z.infer<typeof DesenhoEmAndamentoSchema>;

// ---------------------------------------------------------------------------------------------
// Quem vê e quem mexe
// ---------------------------------------------------------------------------------------------

type Visao = Pick<Usuario, "id" | "papel">;

/**
 * Os desenhos (e os rascunhos) chegam a quem recebe a cena, pela mesma regra dos tokens visíveis: o
 * mestre recebe todos; o jogador, os da cena ativa.
 */
export function desenhoVisivelPara(
  cenaId: string,
  usuario: Visao,
  cenaAtivaId: string | undefined,
): boolean {
  return usuario.papel === "mestre" || cenaId === cenaAtivaId;
}

/** O mestre mexe (move, apaga) em todos; o jogador, só nos que ele mesmo desenhou. */
export function podeMexerNoDesenho(d: Pick<Desenho, "autorId">, usuario: Visao): boolean {
  return usuario.papel === "mestre" || d.autorId === usuario.id;
}

// ---------------------------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------------------------

type P = { x: number; y: number };

function distanciaAoSegmento(p: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const c2 = dx * dx + dy * dy;
  const t = c2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / c2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Douglas–Peucker: tira os pontos que ficam a menos de `toleranciaM` da reta entre os vizinhos
 * mantidos. Iterativa (sem recursão: o traço pode ter milhares de pontos). Sempre guarda o primeiro
 * e o último.
 */
export function simplificarTraco<T extends P>(pontos: readonly T[], toleranciaM: number): T[] {
  const n = pontos.length;
  if (n <= 2) return [...pontos];
  const manter = new Array<boolean>(n).fill(false);
  manter[0] = true;
  manter[n - 1] = true;
  const pilha: [number, number][] = [[0, n - 1]];
  while (pilha.length > 0) {
    const trecho = pilha.pop();
    if (!trecho) break;
    const [ini, fim] = trecho;
    const a = pontos[ini] as T;
    const b = pontos[fim] as T;
    let maior = -1;
    let indice = -1;
    for (let i = ini + 1; i < fim; i++) {
      const d = distanciaAoSegmento(pontos[i] as T, a, b);
      if (d > maior) {
        maior = d;
        indice = i;
      }
    }
    if (indice !== -1 && maior > toleranciaM) {
      manter[indice] = true;
      pilha.push([ini, indice], [indice, fim]);
    }
  }
  return pontos.filter((_, i) => manter[i]);
}

/** Arredonda ao centímetro (a sala e o navegador gravam menos dígitos). */
export function arredondarPonto(p: P): P {
  return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
}

/**
 * Prepara o traço livre para enviar: arredonda, simplifica (Douglas–Peucker) e, se ainda passar do
 * limite de pontos, aumenta a tolerância até caber. Pontos repetidos em seguida viram um só.
 */
export function prepararTraco(
  pontos: readonly P[],
  toleranciaM: number = TOLERANCIA_DO_TRACO_M,
  maximo: number = LIMITES_DO_DESENHO.pontos,
): P[] {
  const redondos = pontos.map(arredondarPonto);
  const unicos = redondos.filter((p, i) => {
    const antes = redondos[i - 1];
    return !antes || antes.x !== p.x || antes.y !== p.y;
  });
  const base = unicos.length > 0 ? unicos : redondos.slice(0, 1);
  let tolerancia = Math.max(toleranciaM, 0);
  let saida = simplificarTraco(base, tolerancia);
  while (saida.length > maximo) {
    tolerancia = tolerancia * 1.5 + 0.01;
    saida = simplificarTraco(base, tolerancia);
  }
  return saida;
}

/** Retângulo que contém o desenho, em metros (sem a espessura). */
export function caixaDoDesenho(d: Pick<Desenho, "forma" | "pontos">): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  const [a, b] = d.pontos;
  if (d.forma === "circulo" && a && b) {
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    return { x0: a.x - r, y0: a.y - r, x1: a.x + r, y1: a.y + r };
  }
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const p of d.pontos) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}

/**
 * O ponto toca o desenho? `margemM` é a folga (metros) em volta do traço: o chamador soma a espessura
 * e o alvo mínimo do ponteiro. Retângulo e círculo preenchidos valem pela área toda.
 */
export function desenhoTocadoEm(
  d: Pick<Desenho, "forma" | "pontos" | "preenchido">,
  p: P,
  margemM: number,
): boolean {
  const [a, b] = d.pontos;
  if (!a) return false;
  switch (d.forma) {
    case "livre": {
      if (d.pontos.length === 1) return Math.hypot(p.x - a.x, p.y - a.y) <= margemM;
      for (let i = 1; i < d.pontos.length; i++) {
        if (distanciaAoSegmento(p, d.pontos[i - 1] as P, d.pontos[i] as P) <= margemM) return true;
      }
      return false;
    }
    case "linha":
      return b !== undefined && distanciaAoSegmento(p, a, b) <= margemM;
    case "retangulo": {
      if (!b) return false;
      const x0 = Math.min(a.x, b.x);
      const x1 = Math.max(a.x, b.x);
      const y0 = Math.min(a.y, b.y);
      const y1 = Math.max(a.y, b.y);
      if (d.preenchido) {
        return (
          p.x >= x0 - margemM && p.x <= x1 + margemM && p.y >= y0 - margemM && p.y <= y1 + margemM
        );
      }
      const cantos: P[] = [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
      return cantos.some((c, i) => distanciaAoSegmento(p, c, cantos[(i + 1) % 4] as P) <= margemM);
    }
    case "circulo": {
      if (!b) return false;
      const raio = Math.hypot(b.x - a.x, b.y - a.y);
      const dist = Math.hypot(p.x - a.x, p.y - a.y);
      return d.preenchido ? dist <= raio + margemM : Math.abs(dist - raio) <= margemM;
    }
  }
}

/** Limita o deslocamento para o desenho continuar inteiro dentro da cena (a caixa não sai dela). */
export function deslocamentoNaCena(
  d: Pick<Desenho, "forma" | "pontos">,
  cena: Pick<Cena, "larguraM" | "alturaM">,
  dx: number,
  dy: number,
): { dx: number; dy: number } {
  const c = caixaDoDesenho(d);
  // Dentro da cena o desenho anda até encostar na borda. Com parte já fora (um círculo junto da
  // borda) fica onde está ou anda para dentro, nunca mais para fora.
  const limita = (delta: number, min: number, max: number, tamanho: number) =>
    Math.max(Math.min(-min, 0), Math.min(Math.max(tamanho - max, 0), delta));
  return {
    dx: limita(dx, c.x0, c.x1, cena.larguraM),
    dy: limita(dy, c.y0, c.y1, cena.alturaM),
  };
}

/** Os pontos deslocados (arredondados ao centímetro). */
export function pontosDeslocados(pontos: readonly P[], dx: number, dy: number): P[] {
  return pontos.map((p) => arredondarPonto({ x: p.x + dx, y: p.y + dy }));
}

/** O desenho cabe no que a cena aceita? Pontos fora da cena são trazidos para dentro (cada ponto). */
export function pontosNaCena(pontos: readonly P[], cena: Pick<Cena, "larguraM" | "alturaM">): P[] {
  return pontos.map((p) =>
    arredondarPonto({
      x: Math.min(cena.larguraM, Math.max(0, p.x)),
      y: Math.min(cena.alturaM, Math.max(0, p.y)),
    }),
  );
}

/**
 * Limite de frequência do rascunho de uma conexão: `true` se já passou o intervalo mínimo desde o
 * último aceito (a sala descarta os que vêm antes, sem erro). Pura.
 */
export function rascunhoDentroDoLimite(
  ultimoMs: number | undefined,
  agoraMs: number,
  intervaloMs: number = INTERVALO_MINIMO_RASCUNHO_MS,
): boolean {
  return ultimoMs === undefined || agoraMs - ultimoMs >= intervaloMs;
}
