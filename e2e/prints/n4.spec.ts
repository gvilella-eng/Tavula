import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirPreferencia,
  test as base,
  enviarCru,
  esperarMapa,
  expect,
  intencaoCrua,
  Mesa,
  menuDaCena,
} from "../tests/ajudas";
import { arquivoPng, definirMapa, pngDeRuido } from "../tests/ajudasAssets";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "../tests/ajudasMapa";

// Prints do lote N4 (névoa pintada à mão): o mestre pintando com o véu, a mesma cena vista pelo jogador e uma
// cena-cartão (mapa de cidade) revelada pela metade. Grimório 1600×900 e 1280×720 e Pergaminho (claro) 1600×900.
// Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints n4

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const gancho = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.visao().modo);
const centrar = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([a, b]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(
        a as number,
        b as number,
      ),
    [x, y],
  );
const quantos = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.nevoa().length);

async function arrastar(p: Page, pontos: { x: number; y: number }[]) {
  const t = await Promise.all(pontos.map((q) => pontoNaPagina(p, q.x, q.y)));
  const [primeiro, ...resto] = t;
  if (!primeiro) return;
  await p.mouse.move(primeiro.x, primeiro.y);
  await p.mouse.down();
  for (const q of resto) await p.mouse.move(q.x, q.y, { steps: 8 });
  await p.mouse.up();
}

for (const c of COMBINACOES) {
  base(`n4 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      const jg = await entrarNoMapa(mesa, "jogador-1");
      const j = jg.pagina;
      await escolherTema(j, c.tema);

      // 1 e 2: a cena-1 (mapa de cidade) como cartão, coberta e revelada em partes
      await definirMapa(m, "cena-1", arquivoPng("cidade.png", pngDeRuido(1300, 1000, 31, 2)), 35);
      await menuDaCena(m, "cena-1", "cartao");
      await expect.poll(() => gancho(m)).toBe("claro");
      await expect(m.getByTestId("cena-cartao-cena-1")).toBeVisible();
      await expect.poll(() => gancho(j)).toBe("claro");
      await m.getByTestId("ferramenta-nevoa").click();
      await expect(m.getByTestId("painel-nevoa")).toBeVisible();
      await m.getByTestId("nevoa-cobrir-tudo").click();
      await m.getByTestId("nevoa-confirmar").click();
      await m.getByTestId("nevoa-modo-revelar").click();
      await m.getByTestId("nevoa-forma-retangulo").click();
      await centrar(m, 21, 14);
      await arrastar(m, [
        { x: 10.5, y: 5.25 },
        { x: 22.5, y: 14.25 },
      ]);
      await m.getByTestId("nevoa-forma-pincel").click();
      await m.getByTestId("nevoa-raio").fill("2");
      await m.getByTestId("nevoa-raio").press("Enter");
      await arrastar(m, [
        { x: 22.5, y: 10 },
        { x: 27, y: 10 },
        { x: 30, y: 13 },
        { x: 33, y: 13 },
      ]);
      await expect.poll(() => quantos(j)).toBe(3);
      await centrar(j, 21, 14);
      await m.mouse.move(c.width / 2, c.height - 40);
      await m.waitForTimeout(500);
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-01-mestre-pintando.png`) });
      await j.waitForTimeout(500);
      await j.screenshot({ path: join(PASTA as string, `${rotulo}-02-jogador.png`) });

      // 3: o mapa de cidade revelado pela metade, com a ferramenta fechada, na tela do jogador (câmera enquadrada)
      await m.getByTestId("nevoa-fechar").click();
      await j
        .getByTestId("zoom-centralizar")
        .click()
        .catch(() => undefined);
      await j.waitForTimeout(500);
      await j.screenshot({ path: join(PASTA as string, `${rotulo}-03-cartao-pela-metade.png`) });
      await esperarMapa(m);
      const r = await enviarCru(m, intencaoCrua("nevoa.desfazer", { cenaId: "cena-1" }));
      expect(r?.tipo).toBe("evento");
    } finally {
      await mesa.fechar();
    }
  });
}
