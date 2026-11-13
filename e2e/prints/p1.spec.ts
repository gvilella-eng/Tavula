import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote P1 (Preferências em sanfona com resumo): a aba como abre, No mapa e Aparência abertas, e Conectar o Claude
// aberta com um token. Grimório em 1600×900 e 1280×720 e Pergaminho (claro) em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints p1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

for (const c of COMBINACOES) {
  base(`preferências ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(120_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const r = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const p = (await entrarNoMapa(mesa, "mestre")).pagina;
      // o tema vem do navegador; as seções voltam ao padrão (só a Conta aberta)
      await p.evaluate((tema) => {
        localStorage.setItem("tabletop:pref:tema", tema);
        localStorage.removeItem("tabletop:pref:secoes");
      }, c.tema);
      await p.reload();
      await expect(p.getByTestId("eu-nome")).toBeVisible();
      await expect(p.locator("html")).toHaveAttribute("data-tema", c.tema);

      // 1. como abre
      await abrirAba(p, "preferencias");
      await foto(p, `${r}-1-como-abre`);

      // 2. Aparência e No mapa abertas (a Conta fecha para caber)
      await p.getByTestId("pref-secao-conta-titulo").click();
      await abrirPreferencia(p, "aparencia");
      await abrirPreferencia(p, "mapa");
      await foto(p, `${r}-2-aparencia-e-no-mapa`);

      // 3. Conectar o Claude aberta, com um token
      await p.getByTestId("pref-secao-aparencia-titulo").click();
      await p.getByTestId("pref-secao-mapa-titulo").click();
      await abrirPreferencia(p, "claude");
      await p.getByTestId("claude-token-nome").fill("Claude no meu PC");
      await p.getByTestId("claude-gerar").click();
      await expect(p.getByTestId("claude-token-novo")).toBeVisible();
      await p.getByTestId("claude-token-guardei").click();
      await expect(p.getByTestId("claude-token")).toHaveCount(1);
      await foto(p, `${r}-3-conectar-o-claude`);
      await p.getByTestId("pref-secao-claude-titulo").click();
      await foto(p, `${r}-4-claude-fechado-com-resumo`);
    } finally {
      await mesa.fechar();
    }
  });
}
