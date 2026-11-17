/** V10b/Q8: o pedido "põe o meu token no mapa" (botão "Colocar no mapa" e soltar a ficha no mapa): o jogador vai sempre para a bandeira. */

export function pedirTokenNoMapa(
  enviar: (tipo: string, dados: object) => string | null,
  personagemId: string,
  ponto?: { x: number; y: number },
): string | null {
  return enviar("token.colocarMeu", {
    personagemId,
    tokenId: `tok-${crypto.randomUUID().slice(0, 8)}`,
    ...(ponto ? { x: ponto.x, y: ponto.y } : {}),
  });
}
