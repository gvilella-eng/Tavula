import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa, tornarMembros } from "../tests/ajudas";
import { entrarNoMapa, type GanchoDoMapa, soSelecionarToken } from "../tests/ajudasMapa";

// Prints do lote V10b (o jogador põe o próprio token na bandeira): Grimório 1600×900 e 1280×720 e Pergaminho
// 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v10b

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
  console.log(`[V10b] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V10b] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

/** Chama uma função do gancho do mapa (só no modo e2e). */
const gancho = (p: Page, nome: keyof GanchoDoMapa, ...args: unknown[]) =>
  p.evaluate(
    ([n, a]) =>
      (
        (window as unknown as { __tabletop: Record<string, (...x: unknown[]) => unknown> })
          .__tabletop[n as string] as (...x: unknown[]) => unknown
      )(...(a as unknown[])),
    [nome, args] as [string, unknown[]],
  );

for (const c of COMBINACOES) {
  base(`v10b ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const rotulo = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      await tornarMembros(request, "jogador-1");
      const ms = await entrarNoMapa(mesa, "mestre");
      const js = await entrarNoMapa(mesa, "jogador-1");
      const m = ms.pagina;
      const j = js.pagina;
      await escolherTema(m, c.tema);
      await escolherTema(j, c.tema);
      await abrirAba(j, "fichas");

      // o jogador tira o token e a bandeira aparece; a dica ao passar o mouse
      await tentar(`${rotulo} bandeira`, async () => {
        await soSelecionarToken(j, "tok-jogador-1");
        await j.keyboard.press("Delete");
        await expect.poll(() => gancho(j, "bandeira")).not.toBeNull();
        await expect(j.getByTestId("aviso")).toHaveCount(0, { timeout: 15_000 });
        await gancho(j, "centrarEm", 30, 22.5);
        const tela = (await gancho(j, "paraTela", 30, 22.5)) as { x: number; y: number };
        await j.mouse.move(tela.x + 4, tela.y - 14);
        await j.mouse.move(tela.x + 5, tela.y - 13);
        await expect(j.getByTestId("dica-bandeira")).toBeVisible();
        await foto(j, `${rotulo}-01-bandeira-com-dica`);
        await j.mouse.move(40, 400);
      });

      // a área acesa durante o arrasto da ficha
      await tentar(`${rotulo} area`, async () => {
        const item = j.getByTestId("ficha-abrir-pers-aldric");
        const dt = await j.evaluateHandle(() => new DataTransfer());
        await item.dispatchEvent("dragstart", { dataTransfer: dt });
        await expect.poll(() => gancho(j, "areaDaBandeiraAcesa")).toBe(true);
        await foto(j, `${rotulo}-02-area-acesa`);
        await item.dispatchEvent("dragend", { dataTransfer: dt });
      });

      // o botão "Colocar no mapa" na lista (o aviso do Delete já passou)
      await tentar(`${rotulo} lista`, async () => {
        await expect(j.getByTestId("ficha-colocar-pers-aldric")).toBeVisible();
        await j.getByTestId("ficha-colocar-pers-aldric").hover();
        await foto(j, `${rotulo}-03-botao-na-lista`, 1200);
      });

      // o botão no cabeçalho da ficha
      await tentar(`${rotulo} ficha`, async () => {
        await j.getByTestId("ficha-abrir-pers-aldric").click();
        await expect(j.getByTestId("ficha-colocar-no-mapa")).toBeVisible();
        await j.getByTestId("ficha-colocar-no-mapa").hover();
        await foto(j, `${rotulo}-04-botao-na-ficha`, 1200);
        await j.getByTestId("ficha-colocar-no-mapa").click();
        await expect(j.getByTestId("ficha-colocar-no-mapa")).toHaveCount(0);
        await foto(j, `${rotulo}-05-token-posto`);
        await j.getByTestId("janela-ficha-fechar").click();
      });

      // a capacidade em Permissões (tela do mestre)
      await tentar(`${rotulo} permissoes`, async () => {
        await abrirAba(m, "mesa");
        const caixa = m.getByTestId("perm-padrao-token.colocarProprio");
        await caixa.scrollIntoViewIfNeeded();
        await expect(caixa).toBeVisible();
        await foto(m, `${rotulo}-06-permissao`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
