/** Porta do `wrangler dev` (a sala). */
export const PORTA_SALA = 8787;
/** Porta do Vite (o front). */
export const PORTA_WEB = 5173;

/** Nome do Durable Object único da campanha (uma campanha por instalação). */
export function nomeDaSala(): string {
  return "campanha";
}
