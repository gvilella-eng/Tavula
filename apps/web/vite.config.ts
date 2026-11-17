import { PORTA_SALA, PORTA_WEB } from "@tabletop/shared";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// As portas vêm das variáveis TABLETOP_PORTA_WEB e TABLETOP_PORTA_SALA (ambiente ou `.env.<modo>`).
// Sem elas valem 5173 e 8787 (`pnpm dev` e `pnpm jogar`). O E2E usa `vite --mode e2e` (apps/web/.env.e2e).
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "TABLETOP_"), ...process.env };
  const portaWeb = Number(env.TABLETOP_PORTA_WEB ?? PORTA_WEB);
  const alvo = `127.0.0.1:${Number(env.TABLETOP_PORTA_SALA ?? PORTA_SALA)}`;
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: portaWeb,
      strictPort: true,
      proxy: {
        // A sala fala por `/api/m/<id>/...`, inclusive o WebSocket em `/api/m/<id>/ws` (C1).
        "/api": { target: `http://${alvo}`, ws: true },
        "/teste": { target: `http://${alvo}` },
      },
    },
    // `pnpm jogar` serve o build de produção (`vite preview`) no MESMO endereço do `pnpm dev`: mesma origem, então
    // o navegador guarda as mesmas preferências, a mesma pasta e o mesmo cache de arquivos. O proxy é o de `server`
    // (o Vite o reaproveita no `preview`).
    preview: { host: "127.0.0.1", port: portaWeb, strictPort: true },
    // A Mesa é um pedaço só de ~1 MB (pixi.js incluso) e isso é esperado: sem o aviso a cada `pnpm jogar`.
    build: { chunkSizeWarningLimit: 1200 },
  };
});
