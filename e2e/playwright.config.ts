import { defineConfig } from "@playwright/test";
import { AMBIENTE_DOS_SERVIDORES, PORTA_SALA_E2E, PORTA_WEB_E2E } from "./portas.ts";

// O E2E sobe os PRÓPRIOS servidores, em outras portas e com outro diretório de estado, para nunca
// tocar a campanha real do `pnpm dev` (8787/5173, apps/server/.wrangler/state).
// As portas vêm de e2e/portas.ts (E2E_PORTA_SALA e E2E_PORTA_WEB, padrão 8788/5174) e valem para a sala e o Vite.
const urlWeb = `http://127.0.0.1:${PORTA_WEB_E2E}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  // Uma rodada só (decidido em 2026-11-10): o teste que falhar é repetido UMA vez, e o que só passar na
  // repetição é "instável" e reprova o verify do mesmo jeito (failOnFlakyTests). Instável se corrige,
  // nunca se aceita. Hoje não se usa --repeat-each: um verify só por lote e, se algo falhar, retesta só o que falhou (ver PROJETO.md, 9).
  retries: 1,
  failOnFlakyTests: true,
  reporter: [["list"]],
  expect: { timeout: 10_000 },
  // reducedMotion: as transições da interface (R6b) ficam desligadas nos E2E, para uma janela não ser medida no meio
  // da entrada; o `polimento.spec.ts` confere que elas existem sem a preferência e somem com ela.
  use: {
    baseURL: urlWeb,
    channel: "chrome",
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  webServer: [
    {
      // A sala, com MODO=teste (rotas /teste/*) e estado em e2e/.estado-sala.
      command: "pnpm --filter @tabletop/server dev:e2e",
      cwd: "..",
      env: AMBIENTE_DOS_SERVIDORES,
      url: `http://127.0.0.1:${PORTA_SALA_E2E}/saude`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "ignore",
    },
    {
      // O front (Vite em modo e2e: portas de apps/web/.env.e2e).
      command: "pnpm --filter @tabletop/web dev:e2e",
      cwd: "..",
      env: AMBIENTE_DOS_SERVIDORES,
      url: urlWeb,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "ignore",
    },
  ],
});
