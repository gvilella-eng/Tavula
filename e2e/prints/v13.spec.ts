import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa, type GanchoDoMapa, PX_POR_M } from "../tests/ajudasMapa";

// Prints do lote V13 (régua livre, pontos de virada, metros ou pés): Grimório 1600×900 e 1280×720 e Pergaminho
// 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v13

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

type Ponto = { x: number; y: number };

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

const emPx = (de: Ponto, dxM: number, dyM: number): Ponto => ({
  x: de.x + dxM * PX_POR_M,
  y: de.y + dyM * PX_POR_M,
});

/** Puxa a régua com dois pontos de virada e deixa o botão esquerdo segurado. */
async function puxarComDoisPontos(p: Page, ini: Ponto) {
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  for (const [dx, dy] of [
    [4.5, 0],
    [4.5, 3],
  ] as const) {
    const q = emPx(ini, dx, dy);
    await p.mouse.move(q.x, q.y, { steps: 6 });
    await p.mouse.down({ button: "right" });
    await p.mouse.up({ button: "right" });
  }
  const fim = emPx(ini, 9, 3);
  await p.mouse.move(fim.x, fim.y, { steps: 6 });
}

for (const c of COMBINACOES) {
  base(`v13 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      const ini = await m.evaluate(() => {
        const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
        h.definirZoom(1);
        h.centrarEm(26, 24);
        return h.paraTela(24.75, 27.75);
      });

      // o painel da Régua
      await m.getByTestId("ferramenta-regua").click();
      await expect(m.getByTestId("painel-regua")).toBeVisible();
      await foto(m, `v13-${rotulo}-1-painel`);

      // dois pontos de virada, em metros (grudada) e em pés
      await puxarComDoisPontos(m, ini);
      await expect(m.getByTestId("regua-trecho")).toHaveCount(2);
      await foto(m, `v13-${rotulo}-2-pontos-metros`);
      await m.mouse.up();
      await m.keyboard.press("Escape");

      await abrirAba(m, "preferencias");
      await m.getByTestId("pref-unidade-pes").click();
      await foto(m, `v13-${rotulo}-4-preferencia`);
      await m.getByTestId("aba-chat").click();
      await puxarComDoisPontos(m, ini);
      await expect(m.getByTestId("regua-trecho")).toHaveCount(2);
      await foto(m, `v13-${rotulo}-3-pontos-pes`);
      await m.mouse.up();
      await m.keyboard.press("Escape");

      // régua livre (sem grid), em metros
      await abrirAba(m, "preferencias");
      await m.getByTestId("pref-unidade-m").click();
      await m.getByTestId("aba-chat").click();
      await m.getByTestId("regua-grudar").uncheck();
      await m.mouse.move(ini.x + 13, ini.y + 9);
      await m.mouse.down();
      const fim = emPx({ x: ini.x + 13, y: ini.y + 9 }, 7.3, 4.1);
      await m.mouse.move(fim.x, fim.y, { steps: 6 });
      await expect(m.getByTestId("regua-rotulo")).toBeVisible();
      await foto(m, `v13-${rotulo}-5-livre`);
      await m.mouse.up();
    } finally {
      await mesa.fechar();
    }
  });
}
