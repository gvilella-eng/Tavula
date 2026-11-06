import { defineConfig } from "@playwright/test";

// Prints de cada lote (para o Vilella olhar). Fora do `pnpm verify`: `pnpm --filter @tabletop/e2e prints`.
// A pasta de saída vem da variável de ambiente PRINTS_DIR (obrigatória). Sobe e derruba os PRÓPRIOS
// servidores (mesmas portas e estado do E2E: 8788/5174, nunca o `pnpm dev`), por isso
// `reuseExistingServer: false`: com a porta ocupada o Playwright reclama em vez de reaproveitar.
// Mantenha os números iguais a e2e/playwright.config.ts.
const PORTA_SALA_E2E = 8788;
const PORTA_WEB_E2E = 5174;
const urlWeb = `http://127.0.0.1:${PORTA_WEB_E2E}`;

export default defineConfig({
  testDir: "./prints",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  expect: { timeout: 10_000 },
  use: { baseURL: urlWeb, channel: "chrome" },
  webServer: [
    {
      command: "pnpm --filter @tabletop/server dev:e2e",
      cwd: "..",
      url: `http://127.0.0.1:${PORTA_SALA_E2E}/saude`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "ignore",
    },
    {
      command: "pnpm --filter @tabletop/web dev:e2e",
      cwd: "..",
      url: urlWeb,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "ignore",
    },
  ],
});
