// A sala de teste do E2E. A porta vem de E2E_PORTA_SALA (padrão 8788), para duas cópias do repositório
// poderem rodar testes ao mesmo tempo sem se pisar. Nunca é a porta do `pnpm dev` (8787).
import { spawn } from "node:child_process";

const porta = Number(process.env.E2E_PORTA_SALA ?? 8788);
const filho = spawn(
  "pnpm",
  [
    "exec",
    "wrangler",
    "dev",
    "--port",
    String(porta),
    "--persist-to",
    "../../e2e/.estado-sala",
    "--var",
    "MODO:teste",
    "--var",
    "LISTAR_MESAS:1",
  ],
  { stdio: "inherit", shell: true },
);
filho.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => filho.kill(sinal));
