import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, type GanchoDoMapa, soSelecionarToken } from "../tests/ajudasMapa";

// Prints do lote Q10 (hordas): Grimório 1600×900 e 1280×720 e Pergaminho 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints q10

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const GOBLIN = "pers-goblin-q10";

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

const tokens = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.tokens());

for (const c of COMBINACOES) {
  base(`q10 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const p = ms.pagina;
      await escolherTema(p, c.tema);
      await mandar(p, "personagem.criar", {
        personagem: {
          id: GOBLIN,
          pastaId: "pasta-npcs",
          editores: { tipo: "jogadores", ids: [] },
          nome: "Goblin",
          tokenPadrao: { cor: "#2e8b57", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 0 },
          ficha: { pvAtual: 7, pvMax: 7, apresentacao: "npc" },
        },
      });
      await p.evaluate(() => {
        const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
        h.definirZoom(1);
        h.centrarEm(10, 10);
      });

      // o "Colocar vários…" (a pergunta aberta)
      await abrirAba(p, "fichas");
      await p.getByTestId(`ficha-item-${GOBLIN}`).click({ button: "right" });
      await foto(p, `q10-${rotulo}-1-menu-do-npc`);
      await p.getByTestId("menu-ficha-colocar-varios").click();
      await p.getByTestId("colocar-varios-quantidade").fill("6");
      await foto(p, `q10-${rotulo}-2-colocar-varios`);
      await p.getByTestId("colocar-varios-quantidade").press("Enter");
      await expect
        .poll(async () => (await tokens(p)).filter((t) => /^Goblin( \d+)?$/.test(t.nome)).length)
        .toBe(6);

      // a horda numerada no mapa, com um ferido e dois selecionados
      const lista = (await tokens(p))
        .filter((t) => /^Goblin( \d+)?$/.test(t.nome))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
      const g3 = lista.find((t) => t.nome === "Goblin 3");
      if (!g3) throw new Error("sem Goblin 3");
      await soSelecionarToken(p, g3.id);
      await p.keyboard.press("e");
      await p.getByTestId("marca-vida-campo").fill("-3");
      await p.getByTestId("marca-vida-campo").press("Enter");
      await expect(p.getByTestId("marca-vida-valor")).toHaveText("4");
      await foto(p, `q10-${rotulo}-3-horda-no-mapa`);

      // a ficha aberta pelo Goblin 3, com a faixa "Este token"
      const ponto = await p.evaluate(
        ([x, y]) =>
          (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paraTela(
            x as number,
            y as number,
          ),
        [g3.x, g3.y],
      );
      await p.mouse.click(ponto.x, ponto.y, { button: "right" });
      await foto(p, `q10-${rotulo}-4-menu-do-token`);
      await p.getByTestId("menu-token-abrir-ficha").click();
      await expect(p.getByTestId("ficha-faixa-token")).toBeVisible();
      await foto(p, `q10-${rotulo}-5-ficha-pelo-token`);
    } finally {
      await mesa.fechar();
    }
  });
}
