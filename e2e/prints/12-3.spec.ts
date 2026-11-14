import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";
import { ClienteMcpHttp, URL_PELO_VITE } from "../tests/ajudasMcp";

// Prints do lote 12-3 (o MCP por HTTP na própria sala): o cartão "Conectar o Claude" logo depois de gerar o token, com o
// comando de uma linha, e a lista com o token "usado há X min". Grimório em 1600×900 e 1280×720 e Pergaminho (claro) em
// 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints 12-3

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

for (const c of COMBINACOES) {
  base(`MCP por HTTP ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(180_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const r = `${c.tema}-${c.nome}`;
    let mcp: ClienteMcpHttp | null = null;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      // A presença sem conexão aberta dura 2 min; para o print ela dura 1,5 s e a lista passa a dizer "usado ...".
      expect((await request.post("/teste/claude-http?ms=1500")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);

      // 1. O cartão logo depois de gerar: o comando de uma linha, o passo a passo e os recolhidos.
      await abrirPreferencia(m, "claude");
      await m.getByTestId("claude-token-nome").fill("Claude no meu PC");
      await m.getByTestId("claude-gerar").click();
      await expect(m.getByTestId("claude-token-novo")).toBeVisible();
      await m.getByTestId("claude-passos").scrollIntoViewIfNeeded();
      await foto(m, `${r}-1-conectar-o-claude-comando`);
      const token = (await m.getByTestId("claude-token-valor").textContent()) ?? "";
      await m.getByTestId("claude-token-guardei").click();

      // 2. A lista com o token usado: o Claude chama o MCP pelo HTTP (como o comando deixa) e depois a presença acaba.
      mcp = await ClienteMcpHttp.conectar(token, { url: URL_PELO_VITE });
      const panorama = await mcp.chamar("panorama");
      expect(panorama.erro, panorama.texto).toBe(false);
      await expect(m.getByTestId("claude-token")).toContainText("usado agora", { timeout: 20_000 });
      await m.getByTestId("claude-tokens").scrollIntoViewIfNeeded();
      await foto(m, `${r}-2-lista-com-token-usado`);
    } finally {
      await mcp?.fechar();
      await mesa.fechar();
    }
  });
}
