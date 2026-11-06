import type { Camada } from "@tabletop/shared";

/** A camada de desenho do pincel só existe na interface por enquanto (ainda não há desenho). */
export type CamadaDeTrabalho = Camada | "desenho";

export const CAMADAS_DE_TRABALHO: readonly CamadaDeTrabalho[] = [
  "mapa",
  "tokens",
  "mestre",
  "desenho",
];

export const ROTULO_DA_CAMADA: Record<CamadaDeTrabalho, string> = {
  mapa: "Mapa",
  tokens: "Tokens",
  mestre: "Mestre",
  desenho: "Desenho",
};

/** Camada de token que o "Novo token" usa (a de desenho não tem tokens: cai em `tokens`). */
export function camadaDoNovoToken(c: CamadaDeTrabalho): Camada {
  return c === "desenho" ? "tokens" : c;
}
