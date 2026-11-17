// Q12: o passo de uma seta, decidido pela tela antes de falar com a sala. A conta é a mesma que a sala faz
// (`token.soltar`): encaixa no grid, limita à cena e, para o jogador, confere parede, porta fechada e janela com a
// mesma `trajetoBloqueado`. O que a tela não tenta nem vai à sala; o que a sala ainda recusar volta em silêncio.

import {
  type Cena,
  cenaEhCartao,
  encaixarNoGrid,
  type Parede,
  trajetoBloqueado,
} from "@tabletop/shared";

export type Ponto = { x: number; y: number };

export type EntradaDoPasso = {
  /** De onde o token parte: a posição pendente (a que a tela já mostra), não a que a sala confirmou. */
  de: Ponto;
  /** A direção: -1, 0 ou 1 em cada eixo. */
  dx: number;
  dy: number;
  tamanhoQuadrados: number;
  quadradoM: number;
  cena: Pick<Cena, "larguraM" | "alturaM" | "cartao">;
  /** As paredes da cena (só elas contam). */
  paredes: readonly Parede[];
  /** O mestre atravessa tudo (a sala também o deixa). */
  ehMestre: boolean;
};

/** Para onde o passo leva o token, ou `null` se ele não anda (borda da cena ou parede no caminho). */
export function proximoPasso(e: EntradaDoPasso): Ponto | null {
  const alvo = encaixarNoGrid(
    { x: e.de.x + e.dx * e.quadradoM, y: e.de.y + e.dy * e.quadradoM },
    e.tamanhoQuadrados,
    e.quadradoM,
  );
  // Um passo que sairia da cena não anda (a sala o limitaria à borda, e o token pararia fora do centro do quadrado).
  if (alvo.x < 0 || alvo.y < 0 || alvo.x > e.cena.larguraM || alvo.y > e.cena.alturaM) return null;
  if (Math.abs(alvo.x - e.de.x) < 1e-6 && Math.abs(alvo.y - e.de.y) < 1e-6) return null;
  if (!e.ehMestre && !cenaEhCartao(e.cena) && trajetoBloqueado(e.de, alvo, e.paredes)) {
    return null;
  }
  return alvo;
}

/** A direção de uma tecla de seta. */
export function direcaoDaSeta(tecla: string): { dx: number; dy: number } | null {
  switch (tecla) {
    case "ArrowLeft":
      return { dx: -1, dy: 0 };
    case "ArrowRight":
      return { dx: 1, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: -1 };
    case "ArrowDown":
      return { dx: 0, dy: 1 };
    default:
      return null;
  }
}

/** Segurar a seta repete a este ritmo (assumido: 10 quadrados por segundo), sem depender da repetição do sistema. */
export const INTERVALO_DA_SETA_MS = 100;

/**
 * As setas seguradas, na ordem em que foram apertadas: vale a última (soltar uma devolve a anterior, se ainda
 * estiver apertada). Puro, para os testes.
 */
export function teclasDeSetaDepois(
  seguradas: readonly string[],
  tecla: string,
  acao: "baixo" | "cima",
): string[] {
  const sem = seguradas.filter((t) => t !== tecla);
  return acao === "baixo" ? [...sem, tecla] : sem;
}
