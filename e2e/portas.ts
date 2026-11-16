// As portas dos servidores de teste. Padrão 8788 (sala) e 5174 (web); para rodar duas cópias do repositório ao
// mesmo tempo, defina E2E_PORTA_SALA e E2E_PORTA_WEB (ver docs/ESTADO.md). Nunca 8787/5173: são do `pnpm dev`.
export const PORTA_SALA_E2E = Number(process.env.E2E_PORTA_SALA ?? 8788);
export const PORTA_WEB_E2E = Number(process.env.E2E_PORTA_WEB ?? 5174);

/** O ambiente dos servidores de teste (a sala e o Vite leem as mesmas portas). */
export const AMBIENTE_DOS_SERVIDORES = {
  E2E_PORTA_SALA: String(PORTA_SALA_E2E),
  E2E_PORTA_WEB: String(PORTA_WEB_E2E),
  TABLETOP_PORTA_SALA: String(PORTA_SALA_E2E),
  TABLETOP_PORTA_WEB: String(PORTA_WEB_E2E),
};
