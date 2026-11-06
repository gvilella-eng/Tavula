import type { Ponto } from "./estado.ts";
import type { LuzResolvida } from "./luz.ts";
import {
  type Limites,
  poligonoDeVisibilidade,
  pontoNaUniao,
  pontoNoPoligono,
  type Segmento,
} from "./visao.ts";

/**
 * Quanto cada luz soma: a penumbra (até o raio total) soma `PASSO_DE_LUZ`, e a luz plena (até o raio
 * claro) soma outro tanto: dentro do raio claro a soma é 1. A luz ambiente soma o seu valor em toda a
 * cena. O resultado é limitado a 1.
 */
export const PASSO_DE_LUZ = 0.5;
/** A partir deste nível o lugar está em luz plena (aparece normal). */
export const NIVEL_PLENA = 0.95;
/** A partir deste nível (e abaixo do anterior) é penumbra (aparece mais escuro); abaixo é escuro. */
export const NIVEL_PENUMBRA = 0.45;

export type ClasseDeLuz = "plena" | "penumbra" | "escuro";

/** O que o jogador vê num ponto: nada, o escuro em tons de cinza (visão no escuro), penumbra ou luz plena. */
export type VisaoNoPonto = "nenhuma" | "cinza" | "penumbra" | "plena";

/** Quem enxerga: o token (posição, alcance de visão, `null` = sem limite) e a visão no escuro (m). */
export type OlhoDeVisao = {
  x: number;
  y: number;
  alcanceM: number | null;
  visaoNoEscuroM: number;
};

/** O polígono de visibilidade de uma fonte de luz, com a parte da luz plena e a da luz mais penumbra. */
export type LuzCalculada = { luz: LuzResolvida; clara: Ponto[]; total: Ponto[] };

/**
 * Tudo o que a tela precisa saber da luz e da visão, pronto para desenhar e consultar: os polígonos
 * de visão dos olhos, os da visão no escuro e os das luzes (as paredes bloqueiam a luz como bloqueiam
 * a visão).
 */
export type ModeloDeLuz = {
  visao: Ponto[][];
  escuro: Ponto[][];
  luzes: LuzCalculada[];
  ambiente: number;
};

export function classeDeNivel(nivel: number): ClasseDeLuz {
  if (nivel >= NIVEL_PLENA) return "plena";
  return nivel >= NIVEL_PENUMBRA ? "penumbra" : "escuro";
}

function poligonosDaLuz(
  luz: LuzResolvida,
  segmentos: readonly Segmento[],
  limites: Limites,
): { clara: Ponto[]; total: Ponto[] } {
  const total = poligonoDeVisibilidade(luz, segmentos, limites, luz.totalM);
  const clara =
    luz.claraM <= 0
      ? []
      : luz.claraM >= luz.totalM
        ? total
        : poligonoDeVisibilidade(luz, segmentos, limites, luz.claraM);
  return { clara, total };
}

/** Assinatura barata das paredes e da cena: muda quando qualquer ponta ou o tamanho muda. */
function assinatura(segmentos: readonly Segmento[], limites: Limites): string {
  let h = 0;
  for (const s of segmentos) {
    h = (h * 31 + Math.round(s.a.x * 1000)) | 0;
    h = (h * 31 + Math.round(s.a.y * 1000)) | 0;
    h = (h * 31 + Math.round(s.b.x * 1000)) | 0;
    h = (h * 31 + Math.round(s.b.y * 1000)) | 0;
  }
  return `${segmentos.length}|${h}|${limites.larguraM}x${limites.alturaM}`;
}

/**
 * Guarda os polígonos de cada luz: mover um token que vê não refaz o polígono das luzes (só o da
 * visão). Uma luz só é refeita quando ela mesma (posição ou raios), as paredes ou a cena mudam.
 */
export class CacheDeLuz {
  private paredes = "";
  private polis = new Map<string, { clara: Ponto[]; total: Ponto[] }>();

  calcular(
    luzes: readonly LuzResolvida[],
    segmentos: readonly Segmento[],
    limites: Limites,
  ): LuzCalculada[] {
    const sig = assinatura(segmentos, limites);
    if (sig !== this.paredes) {
      this.paredes = sig;
      this.polis.clear();
    }
    const usadas = new Map<string, { clara: Ponto[]; total: Ponto[] }>();
    const resultado = luzes.map((luz): LuzCalculada => {
      const chave = `${luz.x},${luz.y},${luz.claraM},${luz.totalM}`;
      let p = usadas.get(chave) ?? this.polis.get(chave);
      if (!p) p = poligonosDaLuz(luz, segmentos, limites);
      usadas.set(chave, p);
      return { luz, ...p };
    });
    this.polis = usadas;
    return resultado;
  }
}

export function calcularModelo(entrada: {
  olhos: readonly OlhoDeVisao[];
  luzes: readonly LuzResolvida[];
  segmentos: readonly Segmento[];
  limites: Limites;
  ambiente: number;
  /** Reaproveita os polígonos das luzes que não mudaram. */
  cache?: CacheDeLuz;
}): ModeloDeLuz {
  const { olhos, luzes, segmentos, limites, ambiente } = entrada;
  const visao: Ponto[][] = [];
  const escuro: Ponto[][] = [];
  for (const o of olhos) {
    visao.push(poligonoDeVisibilidade(o, segmentos, limites, o.alcanceM));
    if (o.visaoNoEscuroM > 0) {
      const alcance =
        o.alcanceM === null ? o.visaoNoEscuroM : Math.min(o.visaoNoEscuroM, o.alcanceM);
      escuro.push(poligonoDeVisibilidade(o, segmentos, limites, alcance));
    }
  }
  const calculadas =
    entrada.cache?.calcular(luzes, segmentos, limites) ??
    luzes.map((luz): LuzCalculada => ({ luz, ...poligonosDaLuz(luz, segmentos, limites) }));
  return { visao, escuro, luzes: calculadas, ambiente };
}

/** Nível de luz (0 a 1) no ponto: ambiente mais a soma das luzes que chegam até ali. */
export function nivelDeLuz(modelo: ModeloDeLuz, p: Ponto): number {
  let nivel = modelo.ambiente;
  for (const { luz, clara, total } of modelo.luzes) {
    const d = Math.hypot(p.x - luz.x, p.y - luz.y);
    if (d > luz.totalM + 1e-9 || !pontoNoPoligono(p, total)) continue;
    nivel += PASSO_DE_LUZ;
    if (d <= luz.claraM + 1e-9 && pontoNoPoligono(p, clara)) nivel += PASSO_DE_LUZ;
  }
  return Math.min(1, nivel);
}

/**
 * O que o jogador vê no ponto: a interseção da luz com a visão dos tokens dele. Luz plena aparece
 * normal; penumbra, mais escura; escuro, nada. Dentro do alcance da visão no escuro, o escuro aparece
 * em cinza e a penumbra como luz plena (regra do 5e).
 */
export function visaoNoPonto(modelo: ModeloDeLuz, p: Ponto): VisaoNoPonto {
  if (!pontoNaUniao(p, modelo.visao)) return "nenhuma";
  const classe = classeDeNivel(nivelDeLuz(modelo, p));
  if (classe === "plena") return "plena";
  const noEscuro = pontoNaUniao(p, modelo.escuro);
  if (classe === "penumbra") return noEscuro ? "plena" : "penumbra";
  return noEscuro ? "cinza" : "nenhuma";
}

/** O jogador enxerga o ponto agora (luz ∩ visão, ou visão no escuro)? */
export function veNoPonto(modelo: ModeloDeLuz, p: Ponto): boolean {
  return visaoNoPonto(modelo, p) !== "nenhuma";
}
