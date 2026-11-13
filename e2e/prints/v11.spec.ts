import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, enviarCru, expect, intencaoCrua, Mesa } from "../tests/ajudas";
import { arquivoPng, imagemDoTokenSelecionado, pngDeRuido } from "../tests/ajudasAssets";
import { menuDoToken } from "../tests/ajudasCombate";
import {
  abrirPainelDoToken,
  entrarNoMapa,
  type GanchoDoMapa,
  pontoNaPagina,
  tokenDe,
} from "../tests/ajudasMapa";

// Prints do lote V11 (tocha nos cantos do token e condições com ícones), em Grimório 1600×900 e 1280×720 e
// Pergaminho (claro) 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v11

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const hook = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas());

for (const c of COMBINACOES) {
  base(`v11 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);

      // retrato no Aldric, duas tochas (a primeira quase no fim) e cinco condições
      await abrirPainelDoToken(m, "tok-jogador-1");
      await imagemDoTokenSelecionado(m, arquivoPng("aldric.png", pngDeRuido(300, 300, 21, 4)));
      await m.keyboard.press("Escape");
      await ok(m, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 2 });
      await ok(m, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-1" });
      expect((await request.post("/teste/avancar-relogio?ms=3300000")).ok()).toBe(true);
      await ok(m, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-2" });
      await ok(m, "token.condicoes", {
        id: "tok-jogador-1",
        condicoes: ["amedrontado", "cego", "envenenado"],
        exaustao: 2,
        concentracao: "Bênção",
      });
      await expect.poll(async () => (await hook(m)).length).toBe(2);
      await expect.poll(async () => (await tokenDe(m, "tok-jogador-1")).marcas.length).toBe(5);

      const t = await tokenDe(m, "tok-jogador-1");
      const centrar = async (zoom: number) => {
        await m.evaluate(
          ([x, y, z]) => {
            const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
            h.definirZoom(z as number);
            h.centrarEm(x as number, y as number);
          },
          [t.x, t.y, zoom],
        );
        await m.waitForTimeout(500);
      };
      await centrar(1);
      await m.mouse.move(5, 5);
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-01-token-zoom-normal.png`) });
      await centrar(2.5);
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-02-token-zoom-aproximado.png`) });

      // a dica da tocha
      await centrar(2);
      const alca = (await hook(m)).find((a) => a.mao === 0);
      await m.mouse.move((alca?.x ?? 0) - 2, (alca?.y ?? 0) - 2);
      await m.mouse.move(alca?.x ?? 0, alca?.y ?? 0, { steps: 4 });
      await expect(m.getByTestId("dica-tocha")).toBeVisible();
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-03-dica-da-tocha.png`) });

      // o menu de condições
      await m.mouse.move(5, 5);
      await centrar(1);
      await menuDoToken(m, "tok-jogador-1");
      await expect(m.getByTestId("menu-token-painel-condicoes")).toBeVisible();
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-04-menu-de-condicoes.png`) });
      await m.keyboard.press("Escape");
      void pontoNaPagina;
    } finally {
      await mesa.fechar();
    }
  });
}
