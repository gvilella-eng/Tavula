import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { criarDarion, DARION_ID } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V9 (a ficha numa janela própria do navegador): Grimório em 1600×900 e 1280×720 e Pergaminho em
// 1600×900. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v9

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
  console.log(`[V9] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V9] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const janelaDe = (p: Page, id: string) =>
  p.locator(`[data-testid="janela-ficha"][data-personagem-id="${id}"]`);

async function abrirPelaLista(p: Page, id: string) {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${id}`).dblclick();
  return janelaDe(p, id);
}

for (const c of COMBINACOES) {
  base(`v9 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const sessao = await entrarNoMapa(mesa, "mestre");
      const m = sessao.pagina;
      await escolherTema(m, c.tema);
      await criarDarion(m, { editores: [] });

      await tentar(`${rotulo} cabecalho e janela do PJ`, async () => {
        const dar = await abrirPelaLista(m, DARION_ID);
        await expect(dar.getByTestId("ficha-abrir-em-janela")).toBeVisible();
        await foto(m, `${rotulo}-1-cabecalho-com-icone`);
        await dar.getByTestId("ficha-abrir-em-janela").hover();
        await foto(m, `${rotulo}-1b-icone-com-dica`, 1100);
        const [popup] = await Promise.all([
          sessao.contexto.waitForEvent("page"),
          dar.getByTestId("ficha-abrir-em-janela").click(),
        ]);
        await expect(popup.getByTestId("ficha-propria")).toBeVisible();
        await foto(popup, `${rotulo}-2-janela-do-pj`, 800);
        await foto(m, `${rotulo}-3-lista-em-outra-janela`);
        await popup.close();
      });

      await tentar(`${rotulo} janela do NPC`, async () => {
        const og = await abrirPelaLista(m, "pers-ogro");
        await expect(og.getByTestId("npc-bloco")).toBeVisible();
        const [popup] = await Promise.all([
          sessao.contexto.waitForEvent("page"),
          og.getByTestId("ficha-abrir-em-janela").click(),
        ]);
        await expect(popup.getByTestId("npc-bloco")).toBeVisible();
        await foto(popup, `${rotulo}-4-janela-do-npc`, 800);
        await popup.close();
      });
    } finally {
      await mesa.fechar();
    }
  });
}
