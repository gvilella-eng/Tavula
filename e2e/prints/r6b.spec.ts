import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, expect, Mesa } from "../tests/ajudas";
import { arquivoPng, definirMapa, pngDeCor } from "../tests/ajudasAssets";
import { ligarOrdem } from "../tests/ajudasCombate";
import { abrirFicha, criarDarion, DARION_ID, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, selecionarToken, tokenDe } from "../tests/ajudasMapa";

// Prints do lote R6b (tela pequena, aviso da pausa sem mestre, rótulos do mapa, dicas das setas), nos temas
// Grimório, Edgerunner e Pergaminho, em 1600×900 e 1280×720. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints r6b

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

async function foto(p: Page, nome: string, espera = 400) {
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
  console.log(`[R6b] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[R6b] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

type GanchoCentro = { __tabletop: { centrarEm(x: number, y: number): void } };
const centrar = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([a, b]) => (window as unknown as GanchoCentro).__tabletop.centrarEm(a as number, b as number),
    [x, y],
  );

for (const tamanho of TAMANHOS) {
  for (const tema of TEMAS) {
    base(`polimento ${tema} ${tamanho.nome}`, async ({ browser, request }) => {
      base.setTimeout(300_000);
      const mesa = new Mesa(browser, {
        viewport: { width: tamanho.width, height: tamanho.height },
      });
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const rotulo = `${tema}-${tamanho.nome}`;
        const ms = await entrarNoMapa(mesa, "mestre");
        const m = ms.pagina;
        await escolherTema(m, tema);

        // as janelas juntas nas posições padrão: o painel do token abre antes (as janelas cobririam o mapa)
        await tentar(`${rotulo} janelas juntas`, async () => {
          await selecionarToken(m, "tok-jogador-1");
          await criarDarion(m);
          await ligarOrdem(m);
          await mandar(m, "combate.adicionar", {
            entradas: [
              { id: "e-aldric", tokenId: "tok-jogador-1" },
              { id: "e-brisa", tokenId: "tok-jogador-2" },
              { id: "e-ogro", tokenId: "tok-ogro" },
              { id: "e-goblin", tokenId: "tok-goblin-oculto" },
            ],
          });
          await expect(m.getByTestId("ordem-entrada")).toHaveCount(4);
          await abrirFicha(m, DARION_ID, "principal");
          await foto(m, `${rotulo}-01-ordem-ficha-e-token-juntos`);
        });

        // a ficha no mínimo (520 px): Raça, Antecedente e Alinhamento inteiros
        await tentar(`${rotulo} ficha estreita`, async () => {
          await m.getByTestId("janela-ficha-fechar").click();
          const abrir = await abrirFicha(m, DARION_ID, "principal");
          await abrir.getByTestId("ficha-raca").fill("Meio-elfo da floresta");
          await abrir.getByTestId("ficha-raca").press("Enter");
          await foto(m, `${rotulo}-02-ficha-520-campos-inteiros`);
          await m.getByTestId("janela-ficha-fechar").click();
        });

        // a pílula da pausa: rodando e pausada, no topo
        await tentar(`${rotulo} pílula`, async () => {
          await m.getByTestId("topo").screenshot({
            path: join(PASTA as string, `${rotulo}-03-topo-rodando.png`),
          });
          await m.getByTestId("menu-pausa").click();
          await expect(m.getByTestId("estado-mesa-selo")).toBeVisible();
          await m.getByTestId("topo").screenshot({
            path: join(PASTA as string, `${rotulo}-03-topo-pausada.png`),
          });
          await m.getByTestId("menu-pausa").click();
        });

        // o seletor de tema com o painel em 360 px
        await tentar(`${rotulo} seletor de tema 360`, async () => {
          await m.getByTestId("aba-preferencias").click();
          const alca = m.getByTestId("alca-do-painel");
          await alca.focus();
          await m.keyboard.press("Home");
          for (let i = 0; i < 8; i++) await m.keyboard.press("ArrowRight");
          await foto(m, `${rotulo}-04-seletor-de-tema-painel-largo`);
          await m.getByTestId("seletor-de-tema").screenshot({
            path: join(PASTA as string, `${rotulo}-04-seletor-de-tema-recorte.png`),
          });
          await m.keyboard.press("Home");
          await m.getByTestId("aba-chat").click();
        });

        // a dica do cabeçalho da janela com as quatro setas juntas, e a lista de atalhos
        await tentar(`${rotulo} dica das setas`, async () => {
          await m.getByTestId("janela-ordem").getByRole("toolbar").focus();
          await expect(m.getByTestId("dica-janela-ordem-cabecalho")).toBeVisible();
          await foto(m, `${rotulo}-05-dica-do-cabecalho-setas`);
          await m.getByTestId("aba-preferencias").click();
          await m.getByTestId("atalho-janelaMover").scrollIntoViewIfNeeded();
          await foto(m, `${rotulo}-06-lista-de-atalhos-setas`);
          await m.getByTestId("aba-chat").click();
        });

        // o centro da vista se mantém ao recolher o painel
        await tentar(`${rotulo} centro da vista`, async () => {
          await m
            .getByTestId("janela-token-fechar")
            .click({ timeout: 2000 })
            .catch(() => {});
          await m.getByTestId("menu-ordem-turno").click();
          await centrar(m, 20, 15);
          await foto(m, `${rotulo}-07-vista-antes-de-recolher-o-painel`);
          await m.getByTestId("lateral-recolher").click();
          await foto(m, `${rotulo}-07-vista-depois-de-recolher-o-painel`);
          await m.getByTestId("aba-chat").click();
        });

        // rótulos dos tokens sobre mapa claro e sobre mapa escuro
        for (const [nome, rgb] of [
          ["claro", [235, 230, 215]],
          ["escuro", [20, 22, 30]],
        ] as const) {
          await tentar(`${rotulo} mapa ${nome}`, async () => {
            await definirMapa(
              m,
              "cena-1",
              arquivoPng(`${nome}.png`, pngDeCor(900, 700, [rgb[0], rgb[1], rgb[2]])),
              50,
            );
            if (await m.getByTestId("faixa-cenas").isVisible()) {
              await m.getByTestId("menu-cenas").click();
            }
            const visaoNoturna = m.getByTestId("menu-visao-noturna");
            if ((await visaoNoturna.getAttribute("aria-pressed")) === "true") {
              await visaoNoturna.click();
            }
            const t = await tokenDe(m, "tok-ogro");
            await centrar(m, t.x, t.y);
            await foto(m, `${rotulo}-08-rotulos-mapa-${nome}`, 1200);
          });
        }
      } finally {
        await mesa.fechar();
      }
    });

    // o aviso da pausa sem mestre, visto pelo jogador
    base(`pausa sem mestre ${tema} ${tamanho.nome}`, async ({ browser, request }) => {
      base.setTimeout(120_000);
      const mesa = new Mesa(browser, {
        viewport: { width: tamanho.width, height: tamanho.height },
      });
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const rotulo = `${tema}-${tamanho.nome}`;
        const ms = await entrarNoMapa(mesa, "mestre");
        const js = await entrarNoMapa(mesa, "jogador-1");
        const j = js.pagina;
        await escolherTema(j, tema);
        await tentar(`${rotulo} pausa sem mestre`, async () => {
          await ms.pagina.getByTestId("menu-pausa").click();
          await expect(j.getByTestId("estado-mesa-selo")).toBeVisible();
          await foto(j, `${rotulo}-09-pausa-com-o-mestre-na-mesa`);
          await ms.pagina.close();
          await expect(j.getByTestId("aviso")).toBeVisible({ timeout: 20_000 });
          await foto(j, `${rotulo}-10-pausa-sem-mestre-aviso`, 300);
          await j.getByTestId("estado-mesa-selo").hover();
          await foto(j, `${rotulo}-10-pausa-sem-mestre-dica`, 300);
          await j.getByTestId("topo").screenshot({
            path: join(PASTA as string, `${rotulo}-10-pausa-sem-mestre-topo.png`),
          });
        });
      } finally {
        await mesa.fechar();
      }
    });
  }
}
