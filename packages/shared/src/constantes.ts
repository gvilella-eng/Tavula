/** Porta do `wrangler dev` (a sala). */
export const PORTA_SALA = 8787;
/** Porta do Vite (o front). */
export const PORTA_WEB = 5173;
/** Portas dos servidores próprios do E2E (nunca tocam a campanha real). */
export const PORTA_SALA_E2E = 8788;
export const PORTA_WEB_E2E = 5174;

/** Nome do Durable Object único da campanha (uma campanha por instalação). */
export function nomeDaSala(): string {
  return "campanha";
}
