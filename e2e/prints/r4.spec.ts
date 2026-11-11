import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, expect, Mesa, menuDaCena } from "../tests/ajudas";
import { entrarNoMapa, pontoNaPagina } from "../tests/ajudasMapa";

// Prints do lote R4 do redesign (organização do mestre), nos temas Grimório, Edgerunner e Pergaminho, em
// 1600×900 e 1280×720: topo do mestre com uma dica, o menu "Ver como", o modo Paredes e portas, as abas
// Notas, Mesa (alto e seção de luz) e Preferências, a configuração da cena com o grid, a mesa do jogador
// e o painel em 300 px com todas as abas. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints r4

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const TEMAS = ["grimorio", "escuro", "claro"] as const;
const TAMANHOS = [
  { nome: "1600x900", width: 1600, height: 900 },
  { nome: "1280x720", width: 1280, height: 720 },
] as const;

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

/** Roda um passo; se falhar, registra e segue (um print que falha não derruba os outros). */
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
  console.log(`[R4] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[R4] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
}

for (const tamanho of TAMANHOS) {
  for (const tema of TEMAS) {
    base(`organizacao ${tema} ${tamanho.nome}`, async ({ browser, request }) => {
      base.setTimeout(240_000);
      const mesa = new Mesa(browser, {
        viewport: { width: tamanho.width, height: tamanho.height },
      });
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const ms = await entrarNoMapa(mesa, "mestre");
        const js = await entrarNoMapa(mesa, "jogador-1");
        const m = ms.pagina;
        const j = js.pagina;
        const rotulo = `${tema}-${tamanho.nome}`;
        await escolherTema(m, tema);
        await escolherTema(j, tema);
        await m.getByTestId("aba-chat").click();
        await j.getByTestId("aba-chat").click();

        // topo do mestre, com uma dica aberta
        await tentar(`${rotulo} topo`, async () => {
          await m.getByTestId("menu-iluminacao").hover();
          await expect(m.getByTestId("dica-menu-iluminacao")).toBeVisible();
          await foto(m, `${rotulo}-01-topo-com-dica`);
          await m.getByTestId("topo").screenshot({
            path: join(PASTA as string, `${rotulo}-01-topo-recorte.png`),
          });
          await m.mouse.move(600, 500);
        });

        // "Ver como" aberto
        await tentar(`${rotulo} ver como`, async () => {
          await m.getByTestId("menu-ver-como").click();
          await expect(m.getByTestId("ver-como")).toBeVisible();
          await foto(m, `${rotulo}-02-ver-como`);
          await m.keyboard.press("Escape");
        });

        // menu de Luz (sem Paredes, com Modelos de tocha…)
        await tentar(`${rotulo} menu de luz`, async () => {
          await m.getByTestId("menu-iluminacao").click();
          await expect(m.getByTestId("lanterna")).toBeVisible();
          await foto(m, `${rotulo}-03-menu-de-luz`);
          await m.keyboard.press("Escape");
        });

        // modo paredes ligado: barra, selo e janela
        await tentar(`${rotulo} paredes`, async () => {
          await m.getByTestId("ferramenta-paredes").click();
          await expect(m.getByTestId("modo-paredes-selo")).toBeVisible();
          await m.evaluate(() =>
            (
              window as unknown as { __tabletop: { centrarEm(x: number, y: number): void } }
            ).__tabletop.centrarEm(11, 8),
          );
          const a = await pontoNaPagina(m, 8, 7);
          await m.mouse.move(a.x, a.y);
          await m.mouse.click(a.x, a.y);
          const b = await pontoNaPagina(m, 14, 7);
          await m.mouse.move(b.x, b.y, { steps: 4 });
          await foto(m, `${rotulo}-04-modo-paredes`);
          await m.keyboard.press("Escape");
          await m.getByTestId("ferramenta-selecionar").click();
        });

        // abas
        await tentar(`${rotulo} fichas`, async () => {
          await m.getByTestId("aba-fichas").click();
          await foto(m, `${rotulo}-05-aba-fichas`);
        });
        await tentar(`${rotulo} mesa`, async () => {
          await m.getByTestId("aba-mesa").click();
          await foto(m, `${rotulo}-06-aba-mesa-alto`);
          await m.getByTestId("menu-iluminacao").click();
          await m.getByTestId("lanterna-modelos").click();
          await expect(m.getByTestId("config-objetos")).toBeVisible();
          await foto(m, `${rotulo}-07-aba-mesa-luz`);
          await m.getByTestId("mesa-ir-papeis").click();
          await foto(m, `${rotulo}-07b-aba-mesa-papeis`);
        });
        await tentar(`${rotulo} preferências`, async () => {
          await m.getByTestId("aba-preferencias").click();
          await foto(m, `${rotulo}-08-aba-preferencias`);
        });

        // configuração da cena com o grid
        await tentar(`${rotulo} cena`, async () => {
          await menuDaCena(m, "cena-1", "configurar");
          await expect(m.getByTestId("cfg-grid")).toBeVisible();
          await foto(m, `${rotulo}-09-configurar-cena-grid`);
          await m.getByTestId("cfg-cancelar").click();
          await m.getByTestId("menu-cenas").click();
        });

        // painel em 300 px (mestre) com as abas
        await tentar(`${rotulo} painel 300`, async () => {
          await m.getByTestId("alca-do-painel").focus();
          await m.keyboard.press("Home");
          await m.getByTestId("aba-chat").click();
          await foto(m, `${rotulo}-10-painel-300-mestre`);
          await m.getByTestId("aba-mesa").click();
          await foto(m, `${rotulo}-10b-painel-300-mesa`);
        });

        // mesa do jogador
        await tentar(`${rotulo} jogador`, async () => {
          await j.getByTestId("aba-fichas").click();
          await foto(j, `${rotulo}-11-jogador-fichas`);
          await j.getByTestId("alca-do-painel").focus();
          await j.keyboard.press("Home");
          await j.getByTestId("aba-chat").click();
          await foto(j, `${rotulo}-12-jogador-painel-300`);
        });
      } finally {
        await mesa.fechar();
      }
    });
  }
}
