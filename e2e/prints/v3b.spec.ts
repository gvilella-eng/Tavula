import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, expect, Mesa } from "../tests/ajudas";
import { mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V3b (dicas enxutas). Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v3b

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const TEMAS = ["grimorio", "claro"] as const;
const TAMANHOS = [
  { nome: "1600x900", width: 1600, height: 900 },
  { nome: "1280x720", width: 1280, height: 720 },
] as const;

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(300);
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
  console.log(`[V3b] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V3b] FALHAS:\n - ${falhas.join("\n - ")}`);
});

/** Passa o mouse no botão e espera a dica aparecer (700 ms de atraso). */
async function dicaDe(p: Page, testid: string) {
  await p.mouse.move(5, 5);
  await p.getByTestId(testid).hover();
  await expect(p.getByTestId(`dica-${testid}`)).toBeVisible();
}

for (const tema of TEMAS) {
  for (const t of TAMANHOS) {
    if (tema === "claro" && t.nome === "1280x720") continue;
    base(`v3b ${tema} ${t.nome}`, async ({ browser, request }) => {
      base.setTimeout(240_000);
      const mesa = new Mesa(browser, { viewport: { width: t.width, height: t.height } });
      const rotulo = `${tema}-${t.nome}`;
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const ms = await entrarNoMapa(mesa, "mestre");
        const m = ms.pagina;
        await m.getByTestId("aba-preferencias").click();
        await m.getByTestId(`tema-${tema}`).check({ force: true });
        await expect(m.locator("html")).toHaveAttribute("data-tema", tema);
        await m.getByTestId("aba-chat").click();

        await tentar(`${rotulo} topo`, async () => {
          await dicaDe(m, "menu-visao-noturna");
          await foto(m, `${rotulo}-01-dica-do-topo`);
        });
        await tentar(`${rotulo} esquerda`, async () => {
          await dicaDe(m, "ferramenta-regua");
          await foto(m, `${rotulo}-02-dica-da-barra-esquerda`);
        });
        await tentar(`${rotulo} ordem`, async () => {
          await m.getByTestId("menu-ordem-turno").click();
          await expect(m.getByTestId("janela-ordem")).toBeVisible();
          // uma entrada só: Próximo vale, Ordenar fica desabilitado ("Precisa de pelo menos duas entradas")
          await mandar(m, "combate.adicionar", {
            entradas: [{ id: "e-ogro", tokenId: "tok-ogro" }],
          });
          await expect(m.getByTestId("ordem-proximo")).not.toHaveAttribute("aria-disabled", "true");
          await dicaDe(m, "ordem-proximo");
          await foto(m, `${rotulo}-03-dica-do-rodape-da-ordem`);
          await dicaDe(m, "ordem-ordenar");
          await foto(m, `${rotulo}-04-dica-de-desabilitado`);
        });
        await tentar(`${rotulo} aba cortada`, async () => {
          await m.mouse.move(5, 5);
          await m.getByTestId("alca-do-painel").focus();
          await m.keyboard.press("Home");
          await m.getByTestId("aba-preferencias").hover();
          await foto(m, `${rotulo}-05-aba-no-minimo`);
          await m.keyboard.press("End");
        });
        await tentar(`${rotulo} preferencias`, async () => {
          await m.mouse.move(5, 5);
          await m.getByTestId("aba-preferencias").click();
          await m.getByTestId("pref-dicas").scrollIntoViewIfNeeded();
          await foto(m, `${rotulo}-06-opcao-nas-preferencias`);
        });
        await tentar(`${rotulo} balao`, async () => {
          await m.getByTestId("pref-dicas").uncheck();
          await m.mouse.move(5, 5);
          await m.getByTestId("ordem-ordenar").click({ force: true });
          await expect(m.getByTestId("dica-ordem-ordenar")).toBeVisible();
          await foto(m, `${rotulo}-07-balao-do-motivo-sem-dicas`);
        });
      } finally {
        await mesa.fechar();
      }
    });
  }
}
