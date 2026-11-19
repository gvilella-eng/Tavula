import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, expect } from "../tests/ajudas";
import { abrirAba, abrirPreferencia, abrirSecaoDaMesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote A1 (campos lado a lado alinhados). Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> PRINTS_PREFIXO=antes|depois pnpm --filter @tabletop/e2e prints a1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });
const PREFIXO = process.env.PRINTS_PREFIXO ?? "depois";

const CASOS = [
  { tema: "grimorio", nome: "grimorio-1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "grimorio-1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "pergaminho-1600x900", width: 1600, height: 900 },
] as const;

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click();
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
}

for (const c of CASOS) {
  base(`a1 ${c.nome}`, async ({ mesa }) => {
    base.setTimeout(120_000);
    const m = (await entrarNoMapa(mesa, "mestre")).pagina;
    await m.setViewportSize({ width: c.width, height: c.height });
    await escolherTema(m, c.tema);
    await abrirAba(m, "mesa");
    await abrirSecaoDaMesa(m, "regras");
    await abrirSecaoDaMesa(m, "luz");
    const fraca = m.getByTestId("cfg-estagio-fraca");
    await fraca.scrollIntoViewIfNeeded();
    await m.waitForTimeout(400);
    await m.screenshot({ path: join(PASTA as string, `${PREFIXO}-${c.nome}-painel-da-mesa.png`) });
  });
}

base("a1 tela inicial", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.getByTestId("inicio-aba-criar").click();
  await expect(page.getByTestId("inicio-criar-senha")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(PASTA as string, `${PREFIXO}-tela-inicial-criar.png`) });
});
