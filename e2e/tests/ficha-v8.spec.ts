import type { Locator, Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import { criarPastaDoGrupo, ligarVerOutras, mandar, PASTA_GRUPO } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// V8: o bloco de NPC com duas fitas (Bestiário e Conjuração) como abas de verdade, sem a moldura em volta e que se
// divide em duas colunas quando a janela fica larga (traços e ações vão para a direita).

const OGRO = "pers-ogro";
const MAGO_NPC = "pers-mago-v8";
const NPC_SEM_MAGIAS = "pers-bruto-v8";

async function criarNpc(
  p: Page,
  id: string,
  nome: string,
  opcoes: { grupo?: boolean; magias?: boolean } = {},
) {
  await mandar(p, "personagem.criar", {
    personagem: {
      id,
      pastaId: opcoes.grupo ? PASTA_GRUPO : "pasta-npcs",
      editores: { tipo: "jogadores", ids: [] },
      nome,
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      ficha: {
        pvAtual: 40,
        pvMax: 40,
        apresentacao: "npc",
        npc: { nd: "5", tamanho: "Médio", tipo: "Humanoide" },
        atributos: { for: 9, des: 14, con: 12, int: 18, sab: 12, car: 10 },
        ...(opcoes.magias
          ? {
              habilidadeDeConjuracao: "int",
              espacosTotal: { "1": 2 },
              magias: [
                { nome: "Luz", nivel: 0, preparada: true, descricao: "O objeto emite luz." },
                { nome: "Mísseis Mágicos", nivel: 1, preparada: true, descricao: "Dardos." },
              ],
            }
          : {}),
      },
    },
  });
}

async function abrirNpc(p: Page, id: string) {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${id}`).dblclick();
  const janela = p.locator(`[data-testid="janela-ficha"][data-personagem-id="${id}"]`);
  await expect(janela.getByTestId("npc-bloco")).toBeVisible();
  return janela;
}

const caixa = async (l: Locator) =>
  (await l.boundingBox()) as NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

test("as fitas Bestiário e Conjuração: clicar troca a página, e cada uma só mostra o que é dela", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarNpc(p, MAGO_NPC, "Mago Cinzento", { magias: true });
  const janela = await abrirNpc(p, MAGO_NPC);

  await expect(janela.getByRole("tablist", { name: "Páginas da ficha do monstro" })).toBeVisible();
  await expect(janela.getByRole("tab")).toHaveText(["Bestiário", "Conjuração"]);
  await expect(janela.getByTestId("npc-fita-bestiario")).toHaveAttribute("aria-selected", "true");
  await expect(janela.getByTestId("npc-fita-conjuracao")).toHaveAttribute("aria-selected", "false");
  await expect(janela.getByTestId("npc-secao-tracos")).toBeVisible();
  await expect(janela.getByTestId("npc-secao-conjuracao")).toHaveCount(0);

  await janela.getByTestId("npc-fita-conjuracao").click();
  await expect(janela.getByTestId("npc-fita-conjuracao")).toHaveAttribute("aria-selected", "true");
  await expect(janela.getByTestId("npc-secao-conjuracao")).toBeVisible();
  await expect(janela.getByTestId("npc-conj-cd")).toHaveText("15");
  await expect(janela.getByTestId("npc-secao-tracos")).toHaveCount(0);
  await expect(janela.getByTestId("npc-atributos")).toHaveCount(0);
  await expect(janela.getByTestId("npc-secao-acao")).toHaveCount(0);

  await janela.getByTestId("npc-fita-bestiario").click();
  await expect(janela.getByTestId("npc-secao-tracos")).toBeVisible();
  await expect(janela.getByTestId("npc-secao-conjuracao")).toHaveCount(0);
});

test("as fitas pelo teclado: setas, Home e End trocam a página e levam o foco junto", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarNpc(p, MAGO_NPC, "Mago Cinzento", { magias: true });
  const janela = await abrirNpc(p, MAGO_NPC);
  const bestiario = janela.getByTestId("npc-fita-bestiario");
  const conjuracao = janela.getByTestId("npc-fita-conjuracao");

  // só a fita ativa entra na ordem do Tab
  await expect(bestiario).toHaveAttribute("tabindex", "0");
  await expect(conjuracao).toHaveAttribute("tabindex", "-1");
  await bestiario.focus();
  await p.keyboard.press("ArrowRight");
  await expect(conjuracao).toBeFocused();
  await expect(conjuracao).toHaveAttribute("aria-selected", "true");
  await expect(janela.getByTestId("npc-secao-conjuracao")).toBeVisible();
  await p.keyboard.press("ArrowRight");
  await expect(bestiario).toBeFocused();
  await expect(bestiario).toHaveAttribute("aria-selected", "true");
  await p.keyboard.press("End");
  await expect(conjuracao).toBeFocused();
  await p.keyboard.press("Home");
  await expect(bestiario).toBeFocused();
  await p.keyboard.press("ArrowLeft");
  await expect(conjuracao).toBeFocused();
  await expect(conjuracao).toHaveAttribute("aria-selected", "true");
});

test("quem não edita só vê a fita Conjuração se o NPC tem magias; quem edita sempre vê", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarPastaDoGrupo(mestre.pagina);
  await criarNpc(mestre.pagina, NPC_SEM_MAGIAS, "Bruto", { grupo: true });
  await criarNpc(mestre.pagina, MAGO_NPC, "Mago Cinzento", { grupo: true, magias: true });
  await ligarVerOutras(mestre.pagina, true);

  const bruto = await abrirNpc(j1.pagina, NPC_SEM_MAGIAS);
  await expect(bruto.getByTestId("npc-fita-bestiario")).toBeVisible();
  await expect(bruto.getByTestId("npc-fita-conjuracao")).toHaveCount(0);
  const mago = await abrirNpc(j1.pagina, MAGO_NPC);
  await expect(mago.getByTestId("npc-fita-conjuracao")).toBeVisible();
  await mago.getByTestId("npc-fita-conjuracao").click();
  await expect(mago.getByTestId("npc-secao-conjuracao")).toBeVisible();

  // o mestre edita o NPC sem magias: a fita está lá para poder criar a conjuração
  const doMestre = await abrirNpc(mestre.pagina, NPC_SEM_MAGIAS);
  await expect(doMestre.getByTestId("npc-fita-conjuracao")).toBeVisible();
});

test("janela larga divide o Bestiário em duas colunas (traços e ações à direita); estreita, uma coluna só", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const janela = await abrirNpc(p, OGRO);
  const atributos = janela.getByTestId("npc-atributos");
  const tracos = janela.getByTestId("npc-secao-tracos");
  const acoes = janela.getByTestId("npc-secao-acao");

  // aberta (520 px): uma coluna, traços e ações embaixo dos atributos
  const a1 = await caixa(atributos);
  const t1 = await caixa(tracos);
  const c1 = await caixa(acoes);
  expect(t1.y).toBeGreaterThan(a1.y + a1.height - 1);
  expect(c1.y).toBeGreaterThan(t1.y);
  expect(Math.abs(t1.x - a1.x)).toBeLessThan(4);

  // alarga pela quina, como a pessoa faz
  const alca = await caixa(janela.getByTestId("janela-ficha-redimensionar"));
  await p.mouse.move(alca.x + 8, alca.y + 8);
  await p.mouse.down();
  await p.mouse.move(alca.x + 8 + 420, alca.y + 8, { steps: 8 });
  await p.mouse.up();

  await expect
    .poll(async () => {
      const a = await caixa(atributos);
      const t = await caixa(tracos);
      return t.x >= a.x + a.width - 1;
    })
    .toBe(true);
  const a2 = await caixa(atributos);
  const t2 = await caixa(tracos);
  const c2 = await caixa(acoes);
  expect(Math.abs(c2.x - t2.x)).toBeLessThan(4);
  expect(t2.y).toBeLessThan(a2.y + a2.height);
  // o cabeçalho e as linhas do bloco ficam na esquerda
  const linhas = await caixa(janela.getByTestId("npc-linhas"));
  expect(linhas.x + linhas.width).toBeLessThanOrEqual(t2.x + 1);

  // estreita de novo: volta a uma coluna
  await p.mouse.move(alca.x + 8 + 420, alca.y + 8);
  const alca2 = await caixa(janela.getByTestId("janela-ficha-redimensionar"));
  await p.mouse.move(alca2.x + 8, alca2.y + 8);
  await p.mouse.down();
  await p.mouse.move(alca2.x + 8 - 420, alca2.y + 8, { steps: 8 });
  await p.mouse.up();
  await expect
    .poll(async () => {
      const a = await caixa(atributos);
      const t = await caixa(tracos);
      return t.y > a.y + a.height - 1;
    })
    .toBe(true);
});

test("sem moldura: o conteúdo do NPC começa a até 16 px da borda da janela, no Bestiário e na Conjuração", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarNpc(p, MAGO_NPC, "Mago Cinzento", { magias: true });
  const janela = await abrirNpc(p, MAGO_NPC);
  const borda = await caixa(janela);

  const e1 = await caixa(janela.locator(".npc-estandarte"));
  expect(e1.x - borda.x).toBeLessThanOrEqual(16);
  await janela.getByTestId("npc-fita-conjuracao").click();
  const e2 = await caixa(janela.getByTestId("npc-secao-conjuracao"));
  expect(e2.x - borda.x).toBeLessThanOrEqual(16);
  // e o degradê em volta sumiu: a página é um fundo liso
  await expect(janela.getByTestId("npc-bloco")).toHaveCSS("background-image", "none");
});

test("com a janela larga a Conjuração põe os círculos em duas colunas", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarNpc(p, MAGO_NPC, "Mago Cinzento", { magias: true });
  const janela = await abrirNpc(p, MAGO_NPC);
  await janela.getByTestId("npc-fita-conjuracao").click();
  const n0 = janela.getByTestId("npc-conj-nivel-0");
  const n1 = janela.getByTestId("npc-conj-nivel-1");
  const estreita0 = await caixa(n0);
  const estreita1 = await caixa(n1);
  expect(estreita1.y).toBeGreaterThan(estreita0.y);

  const alca = await caixa(janela.getByTestId("janela-ficha-redimensionar"));
  await p.mouse.move(alca.x + 8, alca.y + 8);
  await p.mouse.down();
  await p.mouse.move(alca.x + 8 + 420, alca.y + 8, { steps: 8 });
  await p.mouse.up();
  await expect
    .poll(async () => {
      const a = await caixa(n0);
      const b = await caixa(n1);
      return b.x > a.x + a.width - 1 && Math.abs(b.y - a.y) < 4;
    })
    .toBe(true);
});
