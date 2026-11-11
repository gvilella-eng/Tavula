import type { Page } from "@playwright/test";

/** O atraso da dica no mouse (700 ms, V3b) e uma folga para passar dele. */
export const ATRASO_DA_DICA = 700;
export const PASSA_DO_ATRASO = ATRASO_DA_DICA + 60;

/**
 * Congela o relógio da página: a dica só aparece quando o teste deixa o tempo correr (`passar`). Serve para
 * provar "antes do atraso não há dica" sem `waitForTimeout`.
 */
export async function congelarRelogio(p: Page): Promise<void> {
  const agora = Date.now();
  await p.clock.install({ time: agora });
  await p.clock.pauseAt(agora + 1000);
}

/** Deixa o relógio congelado correr `ms`. */
export const passar = (p: Page, ms: number) => p.clock.runFor(ms);
