import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V14 (tipos de parede, Exportar e Importar, atalhos, rótulo da régua na borda): Grimório 1600×900
// e 1280×720 e Pergaminho 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v14

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

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

for (const c of COMBINACOES) {
  base(`v14 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);

      // o painel de paredes, com a Porta escolhida
      await m.getByTestId("ferramenta-paredes").click();
      await expect(m.getByTestId("painel-paredes")).toBeVisible();
      await m.getByTestId("parede-novo-porta").check({ force: true });
      await foto(m, `v14-${rotulo}-1-paredes`);
      await m.keyboard.press("Escape");
      await m.getByTestId("ferramenta-selecionar").click();

      // Mesa → Campanha, antes e depois de escolher o arquivo
      await abrirAba(m, "mesa");
      await m.getByTestId("mesa-ir-campanha").click();
      await expect(m.getByTestId("campanha-importar-bloco")).toBeVisible();
      await foto(m, `v14-${rotulo}-2-campanha-antes`);
      const [download] = await Promise.all([
        m.waitForEvent("download"),
        m.getByTestId("exportar").click(),
      ]);
      await m.getByTestId("importar-arquivo").setInputFiles({
        name: "minha-mesa.json",
        mimeType: "application/json",
        buffer: readFileSync(await download.path()),
      });
      await expect(m.getByTestId("importar-escolhido")).toBeVisible();
      await m.getByTestId("importar-escolhido").scrollIntoViewIfNeeded();
      await foto(m, `v14-${rotulo}-3-campanha-depois`);
      await m.getByTestId("importar-cancelar").click();

      // a lista de atalhos: os mais usados abertos e uma seção recolhida aberta
      await abrirAba(m, "preferencias");
      const lista = m.getByTestId("atalhos");
      await lista.scrollIntoViewIfNeeded();
      await lista.getByRole("heading", { name: "Atalhos do teclado" }).scrollIntoViewIfNeeded();
      await foto(m, `v14-${rotulo}-4-atalhos`);
      await m.getByTestId("atalhos-grupo-Menus").locator("summary").click();
      await m.getByTestId("atalhos-grupo-Menus").scrollIntoViewIfNeeded();
      await foto(m, `v14-${rotulo}-5-atalhos-menus`);
      await m.getByTestId("pref-unidade-pes").click();

      // a régua em pés, o rótulo da ponta colado na borda direita
      await m.getByTestId("aba-chat").click();
      await m.getByTestId("ferramenta-regua").click();
      const area = await m.getByTestId("area-do-mapa").boundingBox();
      if (!area) throw new Error("sem área do mapa");
      const direita = area.x + area.width;
      const y = area.y + area.height * 0.4;
      await m.mouse.move(direita - 230, y);
      await m.mouse.down();
      await m.mouse.move(direita - 170, y, { steps: 5 });
      await m.mouse.down({ button: "right" });
      await m.mouse.up({ button: "right" });
      await m.mouse.move(direita - 12, y + 40, { steps: 8 });
      await expect(m.getByTestId("regua-rotulo")).toContainText("total");
      await foto(m, `v14-${rotulo}-6-regua-borda`);
      await m.mouse.up();
    } finally {
      await mesa.fechar();
    }
  });
}
