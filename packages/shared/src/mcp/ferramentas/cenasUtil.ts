import { z } from "zod";
import { encaixarMeiaCelula, type Ponto } from "../../index.ts";

/** Um ponto em células: `[coluna, linha]`, com meias células ([1.5, 2]). */
export const ParSchema = z.tuple([z.number().finite(), z.number().finite()]);
export type Par = z.infer<typeof ParSchema>;

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Metros -> células (a unidade que a IA usa). */
export function paraCelulas(p: Ponto, quadradoM: number): Par {
  return [arredondar(p.x / quadradoM), arredondar(p.y / quadradoM)];
}

/** Células -> metros, encaixado na rede de meia célula (a das paredes e portas). */
export function paredeEmMetros(par: Par, quadradoM: number): Ponto {
  return encaixarMeiaCelula({ x: par[0] * quadradoM, y: par[1] * quadradoM }, quadradoM);
}

/** Células -> metros, sem encaixe (o centro de um token, uma zona, uma luz). */
export function emMetros(par: Par, quadradoM: number): Ponto {
  return { x: arredondar(par[0] * quadradoM), y: arredondar(par[1] * quadradoM) };
}
