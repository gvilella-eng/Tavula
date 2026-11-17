import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirFaixa,
  abrirPreferencia,
  test as base,
  enviarCru,
  expect,
  intencaoCrua,
  Mesa,
} from "../tests/ajudas";
import { arquivoPng, assets, definirMapa, pngDeRuido } from "../tests/ajudasAssets";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote Q7 (painel de cenas em grade, busca, menu do botão direito no vazio, chat com cartão aberto, barras
// de rolagem do tema). Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints q7

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
  { tema: "vampiro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);

async function foto(p: Page, nome: string, espera = 400) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

for (const c of COMBINACOES) {
  base(`q7 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre", { limiteTile: 512 });
      const m = ms.pagina;
      const j1 = await mesa.entrar("jogador-1");
      await abrirPreferencia(m, "aparencia");
      await m.getByTestId(`tema-${c.tema}`).click();
      await expect(m.locator("html")).toHaveAttribute("data-tema", c.tema);

      // 20 cenas, algumas com mapa (um largo e um alto)
      const nomes = ["Taverna do Dragão Dourado com nome longo", "Cripta dos Esquecidos", "Torre"];
      for (let i = 3; i <= 20; i++) {
        const nome = nomes[i - 3] ?? `Sala ${i}`;
        await enviarCru(m, intencaoCrua("cena.criar", { id: `cena-x${i}`, nome }));
      }
      await definirMapa(m, "cena-x3", arquivoPng("larga.png", pngDeRuido(1800, 300, 3, 6)));
      await definirMapa(m, "cena-x5", arquivoPng("alta.png", pngDeRuido(300, 1800, 5, 6)));
      await definirMapa(m, "cena-1", arquivoPng("quadrada.png", pngDeRuido(900, 900, 9, 6)));

      await abrirAba(m, "chat");
      await abrirFaixa(m);
      await foto(m, `${rotulo}-01-cenas-3-linhas-e-rolagem`);
      await m.getByTestId("faixa-lista").evaluate((el) => el.scrollTo(0, 130));
      await foto(m, `${rotulo}-02-cenas-rolada`);
      await m.getByTestId("cenas-busca").fill("dragao");
      await foto(m, `${rotulo}-03-busca`);
      await m.getByTestId("cenas-busca").fill("");
      const lista = (await m.getByTestId("faixa-lista").boundingBox()) as { x: number; y: number };
      const primeiro = (await m.getByTestId("cena-card").first().boundingBox()) as {
        x: number;
        width: number;
      };
      await m.mouse.click(primeiro.x + primeiro.width + 5, lista.y + 20, { button: "right" });
      await foto(m, `${rotulo}-04-menu-do-vazio`);
      await m.keyboard.press("Escape");
      await m.getByTestId("menu-cenas").click();

      // o chat: um cartão aberto e mensagens para a barra de rolagem aparecer
      await assets(m, "adicionarNaPasta", "compendio/magias.json", SRD);
      await abrirAba(j1.pagina, "compendio");
      await expect(j1.pagina.getByTestId("compendio-lista")).toBeVisible();
      await j1.pagina.getByTestId("compendio-busca").fill("bola");
      await j1.pagina.getByTestId("compendio-item").click();
      await j1.pagina.getByTestId("compendio-como").selectOption({ label: "Aldric" });
      await j1.pagina.getByTestId("compendio-chat").click();
      await expect(j1.pagina.getByTestId("compendio-aviso-acao")).toContainText("Enviada ao chat");
      await abrirAba(m, "chat");
      for (let i = 0; i < 14; i++) {
        await m.getByTestId("chat-texto").fill(`/r 1d20+${i}`);
        await m.getByTestId("chat-texto").press("Enter");
      }
      await foto(m, `${rotulo}-05-chat-cartao-aberto-e-barra`);
    } finally {
      await mesa.fechar();
    }
  });
}
