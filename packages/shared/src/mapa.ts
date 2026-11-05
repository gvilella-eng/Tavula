import { pode } from "./capacidades.ts";
import type { Cena, Permissoes, Token, Usuario } from "./estado.ts";

/** Cena que existe quando a campanha não define nenhuma (semente, banco antigo, exportação v1). */
export const CENA_PADRAO: Cena = {
  id: "cena-1",
  nome: "Cena inicial",
  larguraM: 60,
  alturaM: 45,
  grid: { quadradoM: 1.5, visivel: true },
};

type Quem = Pick<Usuario, "id" | "papel">;

/** O mestre vê tudo; os demais só tokens da camada `tokens` que não estão ocultos. */
export function tokenVisivelPara(token: Token, usuario: Quem): boolean {
  if (usuario.papel === "mestre") return true;
  return token.camada === "tokens" && !token.oculto;
}

/**
 * Quem move: o mestre qualquer token; o jogador só se tem `token.moverProprio`, controla o token
 * e o token é visível para ele.
 */
export function podeMoverToken(token: Token, usuario: Quem, permissoes: Permissoes): boolean {
  if (usuario.papel === "mestre") return true;
  return (
    pode(usuario, "token.moverProprio", permissoes) &&
    token.controladoPor.includes(usuario.id) &&
    tokenVisivelPara(token, usuario)
  );
}

/** Tira o ruído de ponto flutuante (1.5 * 3 = 4.5 etc.). */
function limpar(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Encaixe no grid. Tamanho ímpar (1, 3): o centro vai para o meio da célula. Tamanho par (2, 4):
 * o centro vai para a interseção das linhas.
 */
export function encaixarNoGrid(
  ponto: { x: number; y: number },
  tamanhoQuadrados: number,
  quadradoM: number,
): { x: number; y: number } {
  const eixo = (v: number) =>
    tamanhoQuadrados % 2 === 1
      ? (Math.floor(v / quadradoM) + 0.5) * quadradoM
      : Math.round(v / quadradoM) * quadradoM;
  return { x: limpar(eixo(ponto.x)), y: limpar(eixo(ponto.y)) };
}

/** Posição fora da cena é limitada à borda (o centro do token fica dentro da cena). */
export function limitarNaCena(
  ponto: { x: number; y: number },
  cena: Pick<Cena, "larguraM" | "alturaM">,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(ponto.x, 0), cena.larguraM),
    y: Math.min(Math.max(ponto.y, 0), cena.alturaM),
  };
}

export type Medida = { metros: number; quadrados: number; rotulo: string };

function formatarMetros(m: number): string {
  return (Math.round(m * 10) / 10).toFixed(1).replace(".", ",");
}

/**
 * Régua. Os metros são em linha reta. Os quadrados seguem o 5e 2014: cada diagonal conta 1, então
 * são os quadrados do maior dos dois eixos.
 */
export function medirRegua(
  a: { x: number; y: number },
  b: { x: number; y: number },
  quadradoM: number,
): Medida {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const metros = Math.hypot(dx, dy);
  const quadrados = Math.round(Math.max(dx, dy) / quadradoM);
  const sufixo = quadrados === 1 ? "quadrado" : "quadrados";
  return { metros, quadrados, rotulo: `${formatarMetros(metros)} m (${quadrados} ${sufixo})` };
}

/**
 * Suavização exponencial para a interpolação nos outros clientes: devolve a posição depois de
 * `dtMs`, aproximando-se do alvo. Encosta exatamente no alvo quando falta quase nada.
 */
export function suavizar(atual: number, alvo: number, dtMs: number, constanteMs: number): number {
  const fator = 1 - Math.exp(-Math.max(dtMs, 0) / constanteMs);
  const proximo = atual + (alvo - atual) * fator;
  return Math.abs(alvo - proximo) < 0.002 ? alvo : proximo;
}
