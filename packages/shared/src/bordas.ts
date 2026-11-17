// Q11: a borda colorida do token (8 cores fixas, sem seletor) e a barra de vida opcional.

import { type Borda, NOMES_DE_BORDA, type Personagem, type Token } from "./estado.ts";

/**
 * As 8 cores da borda em hexadecimal, escolhidas para contrastar em mapa claro e escuro (a tela ainda põe um
 * contorno escuro por baixo). Nenhuma é roxa ou violeta: o roxo é da parede secreta e do acento de alguns temas.
 */
export const CORES_DA_BORDA: Record<Borda, string> = {
  vermelho: "#e53935",
  laranja: "#fb8c00",
  amarelo: "#fdd835",
  verde: "#43a047",
  ciano: "#00bcd4",
  azul: "#1e88e5",
  rosa: "#f06292",
  branco: "#ffffff",
};

/** O nome de cada cor, para a dica e o aria-label das amostras. */
export const ROTULO_DA_BORDA: Record<Borda, string> = {
  vermelho: "Vermelho",
  laranja: "Laranja",
  amarelo: "Amarelo",
  verde: "Verde",
  ciano: "Ciano",
  azul: "Azul",
  rosa: "Rosa",
  branco: "Branco",
};

/** As cores na ordem em que as amostras aparecem. */
export const BORDAS: readonly Borda[] = NOMES_DE_BORDA;

/** O token tem a barra de vida ligada? Sem o campo vale ligada (todo token, inclusive os de campanha antiga). */
export function barraDeVidaLigada(token: Pick<Token, "barraDeVida">): boolean {
  return token.barraDeVida !== false;
}

/** Os tokens novos deste personagem nascem com a barra? Sem o campo no token padrão, sim. */
export function barraDeVidaPadrao(p: Pick<Personagem, "tokenPadrao"> | undefined): boolean {
  return p?.tokenPadrao.barraDeVida !== false;
}
