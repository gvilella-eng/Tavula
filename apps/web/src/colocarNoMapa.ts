/** V10b: o pedido "põe o meu token no mapa" (botão "Colocar no mapa" e soltar a ficha na área da bandeira). */
export const TEXTO_FORA_DA_BANDEIRA = "Ponha o token perto da bandeira (o ponto de chegada).";

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
