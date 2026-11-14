import { z } from "zod";
import type { Cena, Ponto } from "./estado.ts";
import { pontoNaZona } from "./zonas.ts";

// ---------------------------------------------------------------------------------------------
// Névoa pintada à mão (Lote N4): o mestre cobre e revela áreas do mapa por cena, além da névoa
// automática da luz e da visão. A cena guarda a lista de traços (forma, modo, pontos e raio), na ordem;
// o resultado é a composição em sequência: o último traço que contém o ponto decide (sem traço, está
// revelado). Não é segredo: o jogador recebe a lista; o que está sob a névoa só não aparece na tela dele.
//
// Crescimento (assumido e medido no teste): o pincel chega simplificado e o total é limitado em traços e em
// pontos. Enquanto cabe, a lista guarda tudo (o desfazer volta traço a traço); ao passar do limite ela é
// compactada: "Cobrir tudo" e "Revelar tudo" valem como o começo da lista e os "revelar" que vêm antes de
// qualquer "cobrir" saem. Se nem assim couber a sala recusa o traço. Uma cena no limite pesa uns 150 KB em JSON.
// ---------------------------------------------------------------------------------------------

const Coordenada = z.number().finite().min(-1_000_000).max(1_000_000);
const PontoSchema = z.object({ x: Coordenada, y: Coordenada });

export const MAXIMO_DE_TRACOS_DA_NEVOA = 300;
export const MAXIMO_DE_PONTOS_POR_TRACO = 128;
export const MAXIMO_DE_PONTOS_DA_NEVOA = 6000;
export const RAIO_MINIMO_DO_PINCEL_M = 0.25;
export const RAIO_MAXIMO_DO_PINCEL_M = 30;

export const FORMAS_DA_NEVOA = ["pincel", "retangulo", "poligono", "tudo"] as const;
export const MODOS_DA_NEVOA = ["cobrir", "revelar"] as const;
export type FormaDaNevoa = (typeof FORMAS_DA_NEVOA)[number];
export type ModoDaNevoa = (typeof MODOS_DA_NEVOA)[number];

export const TracoDaNevoaSchema = z
  .object({
    forma: z.enum(FORMAS_DA_NEVOA),
    modo: z.enum(MODOS_DA_NEVOA),
    /** Pincel: o caminho (1 a 128); retângulo: dois cantos; polígono: 3 a 128 pontos; tudo: nenhum. Em metros. */
    pontos: z.array(PontoSchema).max(MAXIMO_DE_PONTOS_POR_TRACO),
    /** Só do pincel: o raio em metros. */
    raio: z.number().min(RAIO_MINIMO_DO_PINCEL_M).max(RAIO_MAXIMO_DO_PINCEL_M).optional(),
  })
  .superRefine((t, ctx) => {
    const n = t.pontos.length;
    const erro = (message: string) => ctx.addIssue({ code: "custom", message });
    if (t.forma === "tudo" && n !== 0) erro("Cobrir ou revelar tudo não leva pontos.");
    if (t.forma === "pincel" && (n < 1 || t.raio === undefined))
      erro("Pincel precisa de ponto e raio.");
    if (t.forma === "retangulo" && n !== 2) erro("Retângulo precisa de dois cantos.");
    if (t.forma === "poligono" && n < 3) erro("Polígono precisa de três pontos.");
  });
export type TracoDaNevoa = z.infer<typeof TracoDaNevoaSchema>;

/** A lista de traços de uma cena (só o limite de traços; o de pontos o `acrescentarTraco` confere). */
export const TracosDaNevoaSchema = z.array(TracoDaNevoaSchema).max(MAXIMO_DE_TRACOS_DA_NEVOA);

function distanciaAoSegmento(p: Ponto, a: Ponto, b: Ponto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const c2 = dx * dx + dy * dy;
  const t = c2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / c2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** O traço contém o ponto (o pincel é a faixa de raio `raio` em volta do caminho)? */
export function tracoContem(t: TracoDaNevoa, p: Ponto): boolean {
  const pts = t.pontos;
  switch (t.forma) {
    case "tudo":
      return true;
    case "retangulo": {
      const a = pts[0];
      const b = pts[1];
      if (!a || !b) return false;
      return (
        p.x >= Math.min(a.x, b.x) &&
        p.x <= Math.max(a.x, b.x) &&
        p.y >= Math.min(a.y, b.y) &&
        p.y <= Math.max(a.y, b.y)
      );
    }
    case "poligono":
      return pontoNaZona(p, pts);
    case "pincel": {
      const raio = t.raio ?? 0;
      const primeiro = pts[0];
      if (!primeiro) return false;
      if (pts.length === 1) return Math.hypot(p.x - primeiro.x, p.y - primeiro.y) <= raio;
      for (let i = 1; i < pts.length; i++) {
        if (distanciaAoSegmento(p, pts[i - 1] as Ponto, pts[i] as Ponto) <= raio) return true;
      }
      return false;
    }
  }
}

/** O ponto está sob a névoa manual? O último traço que o contém decide; nenhum traço = revelado. */
export function pontoNaNevoa(tracos: readonly TracoDaNevoa[] | undefined, p: Ponto): boolean {
  if (!tracos) return false;
  for (let i = tracos.length - 1; i >= 0; i--) {
    const t = tracos[i] as TracoDaNevoa;
    if (tracoContem(t, p)) return t.modo === "cobrir";
  }
  return false;
}

export function nevoaDaCena(cena: Pick<Cena, "nevoa"> | undefined): readonly TracoDaNevoa[] {
  return cena?.nevoa ?? [];
}

/**
 * Há alguma área coberta nesta lista? Só conta o que vem do último "tudo" em diante (ele reinicia o resultado):
 * "Revelar tudo" seguido de nada deixa a cena sem névoa, mesmo com traços de cobrir lá atrás.
 */
export function nevoaCobreAlgo(tracos: readonly TracoDaNevoa[] | undefined): boolean {
  const lista = tracos ?? [];
  let inicio = 0;
  for (let i = 0; i < lista.length; i++)
    if ((lista[i] as TracoDaNevoa).forma === "tudo") inicio = i;
  return lista.slice(inicio).some((t) => t.modo === "cobrir");
}

/** Quantos pontos a lista guarda no total. */
export function pontosDaNevoa(tracos: readonly TracoDaNevoa[]): number {
  return tracos.reduce((soma, t) => soma + t.pontos.length, 0);
}

/**
 * Junta o que dá: "tudo" zera a lista (os traços de antes não importam mais) e os "revelar" que vêm antes de
 * qualquer "cobrir" não mudam nada e saem. "Revelar tudo" sobre uma cena sem cobertura deixa a lista vazia.
 */
export function compactarNevoa(tracos: readonly TracoDaNevoa[]): TracoDaNevoa[] {
  let inicio = 0;
  for (let i = 0; i < tracos.length; i++) {
    if ((tracos[i] as TracoDaNevoa).forma === "tudo") inicio = i;
  }
  const depois = tracos.slice(inicio);
  const primeiroCobrir = depois.findIndex((t) => t.modo === "cobrir");
  return primeiroCobrir < 0 ? [] : depois.slice(primeiroCobrir);
}

const cabe = (l: readonly TracoDaNevoa[]) =>
  l.length <= MAXIMO_DE_TRACOS_DA_NEVOA && pontosDaNevoa(l) <= MAXIMO_DE_PONTOS_DA_NEVOA;

/**
 * Acrescenta um traço. Enquanto cabe, a lista fica como está (o desfazer volta traço a traço); ao passar do
 * limite ela é compactada (ver `compactarNevoa`); se ainda assim não couber, `null`.
 */
export function acrescentarTraco(
  tracos: readonly TracoDaNevoa[] | undefined,
  traco: TracoDaNevoa,
): TracoDaNevoa[] | null {
  const lista = [...(tracos ?? []), traco];
  if (cabe(lista)) return lista;
  const compacta = compactarNevoa(lista);
  return cabe(compacta) ? compacta : null;
}

/** Tira o último traço (o desfazer da ferramenta). */
export function tirarUltimoTraco(tracos: readonly TracoDaNevoa[] | undefined): TracoDaNevoa[] {
  return (tracos ?? []).slice(0, -1);
}

/**
 * Simplifica o caminho do pincel (Ramer-Douglas-Peucker com tolerância `tolM`), arredonda a 2 casas e fica
 * em no máximo 128 pontos (aumentando a tolerância até caber).
 */
export function simplificarCaminho(pontos: readonly Ponto[], tolM = 0.05): Ponto[] {
  const arred = (n: number) => Math.round(n * 100) / 100;
  const base = pontos.map((p) => ({ x: arred(p.x), y: arred(p.y) }));
  if (base.length <= 2) return base;
  let tol = tolM;
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const manter = new Array<boolean>(base.length).fill(false);
    manter[0] = true;
    manter[base.length - 1] = true;
    const pilha: [number, number][] = [[0, base.length - 1]];
    while (pilha.length > 0) {
      const [ini, fim] = pilha.pop() as [number, number];
      let maior = 0;
      let indice = -1;
      for (let i = ini + 1; i < fim; i++) {
        const d = distanciaAoSegmento(base[i] as Ponto, base[ini] as Ponto, base[fim] as Ponto);
        if (d > maior) {
          maior = d;
          indice = i;
        }
      }
      if (indice >= 0 && maior > tol) {
        manter[indice] = true;
        pilha.push([ini, indice], [indice, fim]);
      }
    }
    const saida = base.filter((_, i) => manter[i]);
    if (saida.length <= MAXIMO_DE_PONTOS_POR_TRACO) return saida;
    tol *= 2;
  }
  return base.slice(0, MAXIMO_DE_PONTOS_POR_TRACO);
}
