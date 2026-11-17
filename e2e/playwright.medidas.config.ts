import { defineConfig } from "@playwright/test";
import { AMBIENTE_DOS_SERVIDORES, PORTA_SALA_E2E, PORTA_WEB_E2E } from "./portas.ts";

// Medições de desempenho (e2e/prints/desempenho.spec.ts): `pnpm --filter @tabletop/e2e medidas`. Igual ao
// `playwright.prints.config.ts` (mesmas portas 8788/5174, servidores próprios, nunca o `pnpm dev`), mas só roda o
// spec de desempenho. Com MEDIDA_PROD=1 o servidor web é o BUILD de produção (`vite build --mode e2e` e `vite preview`,
// minificado e com o React de produção) em vez do Vite de desenvolvimento; o modo `e2e` mantém os ganchos de teste
// (`import.meta.env.MODE === "e2e"`) e o `preview.proxy` herda o `server.proxy` do vite.config.ts.
// O build vai para apps/web/dist/medidas (dist/ é ignorado pelo git).
const urlWeb = `http://127.0.0.1:${PORTA_WEB_E2E}`;
const producao = process.env.MEDIDA_PROD === "1";
const vite = "pnpm --filter @tabletop/web exec vite";
const saida = "--outDir dist/medidas";

export default defineConfig({
  testDir: "./prints",
  testMatch: "desempenho.spec.ts",
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
      command: producao
        ? `${vite} build --mode e2e ${saida} && ${vite} preview --mode e2e ${saida} --host 127.0.0.1 --port ${PORTA_WEB_E2E} --strictPort`
        : "pnpm --filter @tabletop/web dev:e2e",
      cwd: "..",
      env: AMBIENTE_DOS_SERVIDORES,
      url: urlWeb,
      reuseExistingServer: false,
      timeout: producao ? 300_000 : 120_000,
      stdout: "ignore",
      stderr: "ignore",
    },
  ],
});
