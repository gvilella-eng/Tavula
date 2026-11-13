import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirFaixa,
  test as base,
  enviarCru,
  expect,
  intencaoCrua,
  Mesa,
  menuDaCena,
} from "../tests/ajudas";
import { arquivoPng, definirMapa, pngDeRuido } from "../tests/ajudasAssets";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V10c (a cena como cartão): Grimório 1600×900 e 1280×720 e Pergaminho 1600×900.
// Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v10c

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

async function tentar(nome: string, passo: () => Promise<void>) {
  try {
    await passo();
  } catch (e) {
    const msg = (e as Error).message.split("\n").slice(0, 3).join(" | ");
    falhas.push(`${nome}: ${msg}`);
    console.log(`[FALHOU] ${nome}: ${msg}`);
  }
}

base.afterAll(() => {
  console.log(`[V10c] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V10c] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

for (const c of COMBINACOES) {
  base(`v10c ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const rotulo = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      // uma imagem para a cidade, para a prévia da faixa e o cartão não ficarem vazios
      await definirMapa(m, "cena-1", arquivoPng("cidade.png", pngDeRuido(1300, 900, 7, 40)), 35);

      // o menu da cena com o item novo
      await tentar(`${rotulo} menu`, async () => {
        await abrirFaixa(m);
        await m.locator('[data-testid="cena-card"][data-cena-id="cena-1"]').click({
          button: "right",
        });
        await expect(m.getByTestId("menu-cena-cartao")).toBeVisible();
        await m.getByTestId("menu-cena-cartao").hover();
        await foto(m, `${rotulo}-01-menu-da-cena`, 1200);
        await m.keyboard.press("Escape");
        await m.mouse.click(10, 10);
      });

      // a faixa com a marca (e a segunda cena, que segue mapa)
      await tentar(`${rotulo} faixa`, async () => {
        await menuDaCena(m, "cena-1", "cartao");
        await expect(m.getByTestId("cena-cartao-cena-1")).toBeVisible();
        await m.getByTestId("cena-cartao-cena-1").hover();
        await foto(m, `${rotulo}-02-faixa-com-a-marca`, 1200);
        await m.mouse.move(10, 10);
      });

      // a visão do jogador, sem token, numa cena-cartão: a imagem inteira enquadrada
      await tentar(`${rotulo} jogador`, async () => {
        await enviarCru(m, intencaoCrua("token.apagar", { id: "tok-jogador-1" }));
        const js = await mesa.entrar("jogador-1");
        const j = js.pagina;
        await escolherTema(j, c.tema);
        await expect(j.getByTestId("sem-token")).toHaveCount(0);
        await foto(j, `${rotulo}-03-visao-do-jogador`, 1500);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
