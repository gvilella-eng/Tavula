import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { abrirFicha, DARION_ID, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do Lote 10 (importação da ficha em PDF), em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-10

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const PDF = fileURLToPath(new URL("../../fixtures/fichas/darion.pdf", import.meta.url));

const test = base.extend<{ grande: Mesa }>({
  grande: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    await use(mesa);
    await mesa.fechar();
  },
});

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

/** Rola a tela de revisão até o alvo e tira o print da página inteira. */
async function mostrar(p: Page, alvo: Locator, nome: string) {
  await alvo.scrollIntoViewIfNeeded();
  await foto(p, nome);
}

/** Um Darion antigo, só com o básico: a importação vai passar por cima dele. */
async function criarDarionAntigo(mestre: Page) {
  await mandar(mestre, "personagem.criar", {
    personagem: {
      id: DARION_ID,
      pastaId: "pasta-personagens",
      editores: { tipo: "jogadores", ids: ["jogador-1"] },
      nome: "Darion",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 18 },
      ficha: { pvAtual: 10, pvMax: 10, raca: "Humano" },
    },
  });
}

test("1 a 8: menu de importar, a revisão (topo, ataques, magias, recursos), a confirmação e a ficha importada", async ({
  grande,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const p = mestre.pagina;
  await criarDarionAntigo(p);

  // 1. o menu do item na aba Fichas (e o botão "Novo a partir de PDF")
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-menu-${DARION_ID}`).click();
  await expect(p.getByTestId(`ficha-menu-itens-${DARION_ID}`)).toBeVisible();
  await foto(p, "01-menu-importar");

  const [seletor] = await Promise.all([
    p.waitForEvent("filechooser"),
    p.getByTestId(`ficha-menu-importar-pdf-${DARION_ID}`).click(),
  ]);
  await seletor.setFiles(PDF);
  const revisao = p.getByTestId("revisao-pdf");
  await expect(revisao).toBeVisible();

  // 2. a revisão, no topo
  await foto(p, "02-revisao-topo");
  await mostrar(p, p.getByTestId("revisao-secao-atributos"), "02b-revisao-atributos");
  await mostrar(p, p.getByTestId("revisao-secao-pericias"), "02c-revisao-pericias");
  await mostrar(p, p.getByTestId("revisao-secao-gerais"), "02d-revisao-gerais");

  // 3. os ataques, com os incertos em amarelo
  await mostrar(p, p.getByTestId("revisao-secao-ataques"), "03-revisao-ataques");
  await p.getByTestId("revisao-ataque-19").scrollIntoViewIfNeeded();
  await foto(p, "03b-revisao-ataques-fim");

  // 4. as magias, com a descrição inteira (Convocar Familiar aberta, com o UPDATE da mesa)
  await p
    .getByTestId("revisao-magias")
    .locator("summary", { hasText: "Convocar Familiar" })
    .click();
  await p.getByTestId("revisao-magia-8").evaluate((e) => e.scrollIntoView({ block: "start" }));
  await foto(p, "04-revisao-magias-com-descricao");
  await mostrar(p, p.getByTestId("revisao-secao-caracteristicas"), "04b-revisao-caracteristicas");

  // 5. os recursos marcados
  await mostrar(p, p.getByTestId("revisao-secao-recursos"), "05-revisao-recursos");

  // 6. a confirmação de importar por cima
  await p.getByTestId("revisao-campo-ataques.1.nome").scrollIntoViewIfNeeded();
  await p.getByTestId("revisao-campo-ataques.1.nome").fill("Machadinho de Mão");
  await p.getByTestId("revisao-confirmar").click();
  await expect(p.getByTestId("revisao-sobrescrever")).toBeVisible();
  await foto(p, "06-confirmar-por-cima");
  await p.getByTestId("revisao-sobrescrever-sim").click();
  await expect(revisao).toBeHidden();

  // 7 e 8. a ficha do Darion depois de importada: Principal e Magias
  const janela = await abrirFicha(p, DARION_ID, "principal");
  await expect(janela.getByTestId("percepcao-passiva")).toHaveText("12");
  await foto(p, "07-ficha-importada-principal");
  await mostrar(p, janela.getByTestId("fh-ataques"), "07b-ficha-importada-ataques");
  await janela.getByTestId("ficha-aba-magias").click();
  await expect(janela.getByTestId("espacos-resumo-1")).toHaveText("4/4");
  await foto(p, "08-ficha-importada-magias");
  await mostrar(p, janela.getByTestId("magia-8"), "08b-ficha-importada-magia-aberta");

  // 9. o botão da aba Configurar
  await janela.getByTestId("ficha-aba-configurar").click();
  await foto(p, "09-configurar-com-importar-pdf");
});

test("10: Novo a partir de PDF na aba Fichas", async ({ grande }) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "fichas");
  await foto(p, "10-aba-fichas-novo-a-partir-de-pdf");
});
