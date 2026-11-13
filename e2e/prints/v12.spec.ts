import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa, type GanchoDoMapa } from "../tests/ajudasMapa";

// Prints do lote V12 (ping no mapa): Grimório 1600×900 e 1280×720 e Pergaminho 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v12

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

const naTela = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.pingsNaTela());

async function olharPara(p: Page, x: number, y: number) {
  await p.evaluate(
    ([px, py]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.definirZoom(1);
      h.centrarEm(px as number, py as number);
    },
    [x, y],
  );
}

for (const c of COMBINACOES) {
  base(`v12 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    // movimento ligado: os anéis se abrem (com `reduce` só aparece o anel fixo)
    const mesa = new Mesa(browser, {
      viewport: { width: c.width, height: c.height },
      reducedMotion: "no-preference",
    });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const js = await entrarNoMapa(mesa, "jogador-1");
      const m = ms.pagina;
      const j = js.pagina;
      await escolherTema(m, c.tema);
      await escolherTema(j, c.tema);
      await olharPara(m, 30, 22);
      await olharPara(j, 30, 22);

      // o ping do mestre e o do jogador ao mesmo tempo, no meio da animação (a tela do mestre)
      const caixa = await m.getByTestId("mapa").boundingBox();
      if (!caixa) throw new Error("sem mapa");
      const a = { x: caixa.x + caixa.width * 0.38, y: caixa.y + caixa.height * 0.55 };
      const b = { x: caixa.x + caixa.width * 0.66, y: caixa.y + caixa.height * 0.42 };
      await m.mouse.move(a.x, a.y);
      await j.mouse.move(b.x, b.y);
      // o foco sai da aba clicada: a tecla P vale com o foco no mapa ou em nada
      for (const pagina of [m, j])
        await pagina.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await j.keyboard.press("p");
      await m.keyboard.press("p");
      await expect.poll(async () => (await naTela(m)).length).toBe(2);
      await m.waitForTimeout(380);
      await m.mouse.move(5, 5);
      await m.screenshot({
        path: join(PASTA as string, `${rotulo}-01-pings-mestre-e-jogador.png`),
      });
      await expect.poll(async () => (await naTela(m)).length, { timeout: 5000 }).toBe(0);

      // a capacidade em Permissões (tela do mestre)
      await abrirAba(m, "mesa");
      const permissao = m.getByTestId("perm-padrao-mapa.pingar");
      await permissao.scrollIntoViewIfNeeded();
      await expect(permissao).toBeVisible();
      await m.waitForTimeout(400);
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-02-permissao.png`) });
    } finally {
      await mesa.fechar();
    }
  });
}
