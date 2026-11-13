// Gera `dist/tavola-mcp.mjs`: um arquivo só, para o `node` rodar (sem instalar nada ao lado dele).
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const aqui = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(aqui, "dist"), { recursive: true });

await build({
  entryPoints: [resolve(aqui, "src/index.ts")],
  outfile: resolve(aqui, "dist/tavola-mcp.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // O compêndio de exemplo (fixtures/compendio) vai dentro do arquivo: nada é lido da internet.
  loader: { ".json": "json" },
  banner: {
    js: "import { createRequire as __criarRequire } from 'node:module'; const require = __criarRequire(import.meta.url);",
  },
  logLevel: "info",
});
