import { PORTA_SALA, PORTA_WEB } from "@tabletop/shared";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: PORTA_WEB,
    strictPort: true,
    proxy: {
      "/ws": { target: `ws://127.0.0.1:${PORTA_SALA}`, ws: true },
    },
  },
});
