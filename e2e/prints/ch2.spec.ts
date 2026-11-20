import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote CH2 (a grade da chamada que sempre cabe): Grimório e Pergaminho, 1920×1000 e 1280×720, com 2, 5 e 9
// pessoas (as outras são quadros falsos do gancho de teste) e a segunda página com 11. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints ch2

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

base.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

const COMBINACOES = [
  { tema: "grimorio", nome: "1920x1000", width: 1920, height: 1000 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1920x1000", width: 1920, height: 1000 },
  { tema: "claro", nome: "1280x720", width: 1280, height: 720 },
] as const;

const fingir = (j: Page, falsas: number, quemFala: number | null = null) =>
  j.evaluate(
    ([n, q]) =>
      (
        window as unknown as { __tabletopChamadaFalsas: (n: number, q: number | null) => void }
      ).__tabletopChamadaFalsas(n as number, q as number | null),
    [falsas, quemFala],
  );

for (const c of COMBINACOES) {
  base(`ch2 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(180_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const s = await entrarNoMapa(mesa, "mestre");
      await abrirPreferencia(s.pagina, "aparencia");
      await s.pagina.getByTestId(`tema-${c.tema}`).click();
      await expect(s.pagina.locator("html")).toHaveAttribute("data-tema", c.tema);
      await s.pagina.getByTestId("aba-chat").click();
      const [j] = await Promise.all([
        s.contexto.waitForEvent("page"),
        s.pagina.getByTestId("topo-chamada").click(),
      ]);
      await j.setViewportSize({ width: c.width, height: c.height });
      await expect(j.getByTestId("chamada-antes")).toBeVisible();
      await j.getByTestId("chamada-entrar").click();
      await expect(j.getByTestId("chamada-janela")).toBeVisible();
      const rotulo = `${c.tema}-${c.nome}`;
      for (const pessoas of [2, 5, 9]) {
        await fingir(j, pessoas - 1);
        await expect(j.getByTestId("chamada-resumo")).toContainText(`${pessoas} pessoas`);
        // a lista lateral aberta, com a pessoa 2 aberta para ver o volume
        if (pessoas === 2)
          await j.getByTestId("chamada-pessoa-falso-1").getByRole("button").click();
        await j.mouse.move(5, 5);
        await j.waitForTimeout(400);
        await j.screenshot({ path: join(PASTA as string, `${rotulo}-${pessoas}-pessoas.png`) });
      }
      if (c.nome === "1280x720") {
        await fingir(j, 10, 9);
        await j.getByTestId("chamada-pagina-proxima").click();
        await j.mouse.move(5, 5);
        await j.waitForTimeout(400);
        await j.screenshot({ path: join(PASTA as string, `${rotulo}-11-pessoas-pagina-2.png`) });
      }
    } finally {
      await mesa.fechar();
    }
  });
}
