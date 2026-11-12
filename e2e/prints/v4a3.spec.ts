import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test as base, expect, Mesa } from "../tests/ajudas";
import { abrirFicha, criarDarion, DARION_ID, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V4a3: Magias sem classe (totais e um espaço gasto), Magias do Darion, Dados de Vida no nível 10, no
// multiclasse e no nível 20, e o popover do modificador. Grimório 1600×900 e 1280×720 e Pergaminho 1600×900. Fora do
// `pnpm verify`: PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v4a3

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const CENARIOS = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const RENDAN = "pers-rendan";
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 400) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
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
  if (falhas.length) console.log(`[V4a3] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const alterar = (p: Page, operacoes: { caminho: string; valor: unknown }[]) =>
  mandar(p, "ficha.alterar", { personagemId: RENDAN, operacoes });

for (const c of CENARIOS) {
  base(`ficha ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      await criarDarion(m, { editores: [] });
      await mandar(m, "personagem.criar", {
        personagem: {
          id: RENDAN,
          pastaId: "pasta-personagens",
          editores: { tipo: "jogadores", ids: [] },
          nome: "Rendan",
          tokenPadrao: { cor: "#2f6fbf", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 18 },
          ficha: {
            pvAtual: 30,
            pvMax: 30,
            atributos: { sab: 16 },
            habilidadeDeConjuracao: "sab",
            espacosTotal: { "1": 4, "2": 2 },
            espacosGastos: { "1": 1 },
            magias: [
              { nome: "Luz", nivel: 0, preparada: true, descricao: "" },
              { nome: "Bênção", nivel: 1, preparada: true, descricao: "" },
              { nome: "Curar Ferimentos", nivel: 1, preparada: true, descricao: "" },
              { nome: "Névoa Obscurecente", nivel: 1, preparada: false, descricao: "" },
              { nome: "Arma Espiritual", nivel: 2, preparada: true, descricao: "" },
            ],
          },
        },
      });

      let janela: Locator = m.locator("body");
      await tentar(`${rotulo} magias sem classe`, async () => {
        janela = await abrirFicha(m, RENDAN, "magias");
        await foto(m, `${rotulo}-01-magias-sem-classe`);
      });
      await tentar(`${rotulo} magias sem atributo`, async () => {
        await alterar(m, [{ caminho: "habilidadeDeConjuracao", valor: null }]);
        await expect(janela.getByTestId("sem-conjuracao")).toBeVisible();
        await foto(m, `${rotulo}-01b-magias-sem-atributo`);
        await alterar(m, [{ caminho: "habilidadeDeConjuracao", valor: "sab" }]);
      });
      await tentar(`${rotulo} dados de vida`, async () => {
        await janela.getByTestId("ficha-aba-principal").click();
        await alterar(m, [{ caminho: "classes", valor: [{ classe: "Bárbaro", nivel: 10 }] }]);
        await expect(janela.getByTestId("dv-restantes-d12")).toHaveText("10/10");
        await foto(m, `${rotulo}-03-dv-nivel-10`);
        await alterar(m, [
          {
            caminho: "classes",
            valor: [
              { classe: "Bárbaro", nivel: 7 },
              { classe: "Clérigo", nivel: 5 },
            ],
          },
        ]);
        await expect(janela.getByTestId("dv-restantes-d8")).toHaveText("5/5");
        await foto(m, `${rotulo}-04-dv-multiclasse`);
        await alterar(m, [{ caminho: "classes", valor: [{ classe: "Bárbaro", nivel: 20 }] }]);
        await expect(janela.getByTestId("dv-restantes-d12")).toHaveText("20/20");
        await foto(m, `${rotulo}-05-dv-nivel-20`);
        await alterar(m, [{ caminho: "classes", valor: [{ classe: "Bárbaro", nivel: 10 }] }]);
      });
      await tentar(`${rotulo} popover`, async () => {
        await janela.getByTestId("pericia-acrobacia").click({ button: "right" });
        await expect(m.getByTestId("pericia-bonus-acrobacia-popover")).toBeVisible();
        await m.getByTestId("pericia-bonus-acrobacia").fill("2");
        await foto(m, `${rotulo}-06-popover-modificador`);
        await m.keyboard.press("Escape");
        await janela.getByTestId("salvaguarda-botao-sab").hover();
        await foto(m, `${rotulo}-06b-sem-caixa-no-hover`);
      });
      await tentar(`${rotulo} clássica`, async () => {
        await janela.getByTestId("ficha-aba-configurar").click();
        await janela.getByTestId("aparencia-classica").click();
        await janela.getByTestId("ficha-aba-principal").click();
        await foto(m, `${rotulo}-07-dv-classica`);
        await janela.getByTestId("ficha-aba-magias").click();
        await foto(m, `${rotulo}-08-magias-classica`);
        await janela.getByTestId("ficha-aba-configurar").click();
        await janela.getByTestId("aparencia-livro").click();
      });
      await tentar(`${rotulo} darion`, async () => {
        await janela.getByTestId("janela-ficha-fechar").click();
        janela = await abrirFicha(m, DARION_ID, "magias");
        await foto(m, `${rotulo}-02-magias-darion`);
      });
      await tentar(`${rotulo} estreita`, async () => {
        await janela.getByTestId("janela-ficha-fechar").click();
        janela = await abrirFicha(m, RENDAN, "principal");
        const alca = (await janela.getByTestId("janela-ficha-redimensionar").boundingBox()) as {
          x: number;
          y: number;
        };
        await m.mouse.move(alca.x + 8, alca.y + 8);
        await m.mouse.down();
        await m.mouse.move(alca.x - 392, alca.y - 20, { steps: 8 });
        await m.mouse.up();
        await expect(janela.getByTestId("ficha-raiz")).toHaveAttribute("data-estreita", "true");
        await alterar(m, [{ caminho: "classes", valor: [{ classe: "Bárbaro", nivel: 12 }] }]);
        await janela.getByTestId("dv-restantes-d12").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-09-estreita-dv`);
        await janela.getByTestId("acordeao-salvaguardas-pericias-alternar").click();
        await janela.getByTestId("pericia-acrobacia").click({ button: "right" });
        await foto(m, `${rotulo}-10-estreita-popover`);
        await m.keyboard.press("Escape");
        await janela.getByTestId("ficha-aba-magias").click();
        await foto(m, `${rotulo}-11-estreita-magias`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
