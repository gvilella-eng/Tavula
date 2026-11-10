import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import {
  abrirFicha,
  criarDarion,
  criarPastaDoGrupo,
  DARION_ID,
  ligarVerOutras,
  mandar,
} from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do Lote 9 (ficha 5e), em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-9
// Os dados saem da sala com semente fixa (gancho /teste/dados, só no MODO=teste): 1 = d20 médio,
// 602 = vantagem com dois d20 diferentes.

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const test = base.extend<{ grande: Mesa }>({
  grande: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    await use(mesa);
    await mesa.fechar();
  },
});

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

async function semente(request: APIRequestContext, n: number) {
  const r = await request.post(`/teste/dados?semente=${n}`);
  expect(r.ok()).toBe(true);
}

/** Dá uma cara de jogo em andamento ao Darion: ferido, espaços e recursos gastos. */
async function darionEmJogo(mestre: Page) {
  await criarDarion(mestre);
  await mandar(mestre, "ficha.alterar", {
    personagemId: DARION_ID,
    operacoes: [
      { caminho: "pvAtual", valor: 71 },
      { caminho: "pvTemp", valor: 8 },
      { caminho: "dadosDeVidaUsados", valor: { d10: 2, d8: 1 } },
      { caminho: "espacosGastos", valor: { "1": 2, "2": 1 } },
      { caminho: "recursos.1.atual", valor: 1 },
    ],
  });
}

/** Rola a janela até o elemento e tira o print da página inteira. */
async function mostrar(p: Page, alvo: Locator, nome: string) {
  await alvo.scrollIntoViewIfNeeded();
  await foto(p, nome);
}

test("1 a 6: a ficha do Darion em cada aba", async ({ grande }) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");
  await darionEmJogo(mestre.pagina);
  const p = j1.pagina;

  const janela = await abrirFicha(p, DARION_ID, "principal");
  await expect(janela.getByTestId("percepcao-passiva")).toHaveText("12");
  await foto(p, "01-principal");
  await mostrar(p, janela.getByTestId("fh-ataques"), "01b-principal-ataques");

  await janela.getByTestId("ficha-aba-magias").click();
  await expect(janela.getByTestId("espacos-resumo-1")).toHaveText("2/4");
  await foto(p, "02-magias-com-espacos");
  await mostrar(p, janela.getByTestId("magias-nivel-3"), "02b-magias-lista");

  await janela.getByTestId("ficha-aba-caracteristicas").click();
  await janela
    .getByTestId("caracteristica-descricao-0")
    .fill(
      "Escolha um tipo de inimigo: você tem vantagem em testes de Sabedoria (Sobrevivência) para rastreá-los. (Texto de exemplo da mesa.)",
    );
  await foto(p, "03-caracteristicas");

  await janela.getByTestId("ficha-aba-equipamento").click();
  await janela.getByTestId("mochila-acender-modelo-tocha").click();
  await expect(janela.getByTestId("mochila-resumo-modelo-tocha")).toHaveText("8 novas, 1 usada");
  await foto(p, "04-equipamento-com-a-tocha-e-acender");

  await janela.getByTestId("ficha-aba-notas").click();
  await janela.getByTestId("ficha-idiomas").fill("Comum, Élfico");
  await janela
    .getByTestId("ficha-notas")
    .fill(
      "Cuidado com o violino quebrado: o Rudolf quer de volta.\nAnel do Rudolf: não usar ainda.",
    );
  await foto(p, "05-notas");

  await janela.getByTestId("ficha-aba-configurar").click();
  await foto(p, "06-configurar");
});

test("7 a 9: duas fichas abertas, o cartão do ataque e da perícia com vantagem no chat", async ({
  grande,
  request,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");
  const j2 = await entrarNoMapa(grande, "jogador-2");
  await darionEmJogo(mestre.pagina);
  const p = j1.pagina;

  const darion = await abrirFicha(p, DARION_ID, "principal");
  const aldric = await abrirFicha(p, "pers-aldric", "principal");
  await foto(p, "07-duas-fichas-abertas");

  // traz o Darion para a frente (a do Aldric abriu por último e o cobre)
  await darion.getByTestId("janela-ficha-cabecalho").click({ position: { x: 400, y: 6 } });
  // o cartão do ataque (Cimitarra) e o da perícia com vantagem, no chat de todos
  await semente(request, 1);
  await darion.getByTestId("ataque-rolar-0").click();
  await semente(request, 602);
  await darion.getByTestId("vantagem-vantagem").click();
  await foto(p, "08a-seletor-de-vantagem");
  await darion.getByTestId("pericia-total-furtividade").click();
  await abrirAba(p, "chat");
  await expect(p.getByTestId("modelo-teste").filter({ hasText: "Furtividade" })).toBeVisible();
  await expect(p.getByTestId("modelo-ataque").filter({ hasText: "Cimitarra" })).toBeVisible();
  await foto(p, "08-cartoes-do-ataque-e-da-pericia-com-vantagem");

  // o outro jogador vê os mesmos cartões, "Como: Darion"
  await abrirAba(j2.pagina, "chat");
  await expect(
    j2.pagina.getByTestId("modelo-ataque").filter({ hasText: "Cimitarra" }),
  ).toBeVisible();
  await foto(j2.pagina, "09-o-chat-do-outro-jogador");
  await expect(aldric).toBeVisible();
});

test("10: descanso longo com confirmação", async ({ grande }) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");
  await darionEmJogo(mestre.pagina);
  const p = j1.pagina;
  const janela = await abrirFicha(p, DARION_ID, "principal");
  await expect(janela.getByTestId(`pv-atual-${DARION_ID}`)).toHaveValue("71");
  await janela.getByTestId("descanso-longo").click();
  await expect(janela.getByTestId("descanso-confirmar")).toBeVisible();
  await foto(p, "10-descanso-longo-com-confirmacao");
  await janela.getByTestId("descanso-confirmar-sim").click();
  await expect(janela.getByTestId(`pv-atual-${DARION_ID}`)).toHaveValue("97");
  await foto(p, "10b-depois-do-descanso-longo");
});

test("11: a visão do jogador sem ficha.verOutras (e com)", async ({ grande }) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const j2 = await entrarNoMapa(grande, "jogador-2");
  await criarPastaDoGrupo(mestre.pagina);
  await criarDarion(mestre.pagina, { pastaId: "pasta-grupo" });
  const p = j2.pagina;

  const janela = await abrirFicha(p, DARION_ID, "configurar");
  await expect(janela.getByTestId("ficha-oculta")).toBeVisible();
  await foto(p, "11-jogador-sem-ficha-ver-outras");

  await ligarVerOutras(mestre.pagina, true);
  await expect(janela.getByTestId("ficha-aba-principal")).toBeVisible();
  await janela.getByTestId("ficha-aba-principal").click();
  await expect(janela.getByTestId(`pv-atual-${DARION_ID}`)).toHaveValue("97");
  await foto(p, "11b-jogador-com-ficha-ver-outras-so-leitura");
});
