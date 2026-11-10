import { defineConfig } from "@playwright/test";

// O E2E sobe os PRÓPRIOS servidores, em outras portas e com outro diretório de estado, para nunca
// tocar a campanha real do `pnpm dev` (8787/5173, apps/server/.wrangler/state).
// Mantenha estes números iguais a PORTA_SALA_E2E / PORTA_WEB_E2E (packages/shared) e ao
// apps/web/.env.e2e.
const PORTA_SALA_E2E = 8788;
const PORTA_WEB_E2E = 5174;
const urlWeb = `http://127.0.0.1:${PORTA_WEB_E2E}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  // Uma rodada só (decidido em 2026-11-10): o teste que falhar é repetido UMA vez, e o que só passar na
  // repetição é "instável" e reprova o verify do mesmo jeito (failOnFlakyTests). Instável se corrige,
  // nunca se aceita. Os testes novos de cada lote rodam também com --repeat-each=3 (ver PROJETO.md, 9).
  retries: 1,
  failOnFlakyTests: true,
  reporter: [["list"]],
  expect: { timeout: 10_000 },
  use: { baseURL: urlWeb, channel: "chrome", trace: "retain-on-failure" },
  webServer: [
    {
      // A sala, com MODO=teste (rotas /teste/*) e estado em e2e/.estado-sala.
      command: "pnpm --filter @tabletop/server dev:e2e",
      cwd: "..",
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
      url: urlWeb,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "ignore",
    },
  ],
});
