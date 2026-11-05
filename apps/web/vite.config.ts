import { PORTA_SALA, PORTA_WEB } from "@tabletop/shared";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// As portas vêm das variáveis TABLETOP_PORTA_WEB e TABLETOP_PORTA_SALA (ambiente ou `.env.<modo>`).
// Sem elas valem 5173 e 8787 (`pnpm dev`). O E2E usa `vite --mode e2e` (apps/web/.env.e2e).
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
        "/ws": { target: `ws://${alvo}`, ws: true },
        "/api": { target: `http://${alvo}` },
        "/teste": { target: `http://${alvo}` },
      },
    },
  };
});
