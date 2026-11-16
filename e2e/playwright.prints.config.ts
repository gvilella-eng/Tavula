import { defineConfig } from "@playwright/test";
import { AMBIENTE_DOS_SERVIDORES, PORTA_SALA_E2E, PORTA_WEB_E2E } from "./portas.ts";

// Prints de cada lote (para o Vilella olhar). Fora do `pnpm verify`: `pnpm --filter @tabletop/e2e prints`.
// A pasta de saída vem da variável de ambiente PRINTS_DIR (obrigatória). Sobe e derruba os PRÓPRIOS
// servidores (mesmas portas e estado do E2E: 8788/5174, nunca o `pnpm dev`), por isso
// `reuseExistingServer: false`: com a porta ocupada o Playwright reclama em vez de reaproveitar.
// As portas vêm de e2e/portas.ts (E2E_PORTA_SALA e E2E_PORTA_WEB).
const urlWeb = `http://127.0.0.1:${PORTA_WEB_E2E}`;

export default defineConfig({
  testDir: "./prints",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  expect: { timeout: 10_000 },
  use: { baseURL: urlWeb, channel: "chrome", reducedMotion: "reduce", actionTimeout: 15_000 },
  webServer: [
    {
      command: "pnpm --filter @tabletop/server dev:e2e",
      cwd: "..",
      env: AMBIENTE_DOS_SERVIDORES,
      url: `http://127.0.0.1:${PORTA_SALA_E2E}/saude`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "ignore",
    },
    {
      command: "pnpm --filter @tabletop/web dev:e2e",
      cwd: "..",
      env: AMBIENTE_DOS_SERVIDORES,
      url: urlWeb,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "ignore",
    },
  ],
});
