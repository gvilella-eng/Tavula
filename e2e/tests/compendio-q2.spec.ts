import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import { assets } from "./ajudasAssets";

// Q2: o compêndio por seções, com blocos recolhíveis (nível, ND, raridade) e a busca em todas as seções, em português
// e inglês. O arquivo daqui é o exemplo do SRD mais magias de enchimento (para passar do limite que abre tudo).

test.describe.configure({ timeout: 120_000 });

const SRD = JSON.parse(
  readFileSync(new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url), "utf8"),
);

/** Magias de enchimento: 6 truques e 24 magias de 2º nível, com classes e escolas diferentes. */
const ENCHIMENTO = [
  ...Array.from({ length: 6 }, (_, i) => ({ nivel: 0, n: i })),
  ...Array.from({ length: 24 }, (_, i) => ({ nivel: 2, n: i })),
].map(({ nivel, n }) => ({
  nome: `Teste ${nivel === 0 ? "Truque" : "Segundo"} ${String(n).padStart(2, "0")}`,
  nomeOriginal: `Test ${nivel === 0 ? "Cantrip" : "Second"} ${n}`,
  nivel,
  escola: n % 2 === 0 ? "Necromancia" : "Ilusão",
  tempo: "1 ação",
  alcance: "9 m",
  componentes: "V",
  duracao: "Instantânea",
  concentracao: false,
  ritual: false,
  classes: n % 2 === 0 ? ["Bruxo"] : ["Druida"],
  descricao: "Texto de teste.",
}));

const COMPENDIO = JSON.stringify({
  ...SRD,
  magias: [...SRD.magias, ...ENCHIMENTO],
});

async function abrir(p: Page) {
  await assets(p, "adicionarNaPasta", "compendio/magias.json", COMPENDIO);
  await abrirAba(p, "compendio");
  await expect(p.getByTestId("compendio-lista")).toBeVisible();
}

const nomesDe = (p: Page, testid: string) =>
  p.getByTestId(testid).evaluateAll((els) => els.map((e) => e.getAttribute("data-nome") ?? ""));

test("magias em blocos por nível: começam fechados, abrem e fecham, ficam em ordem alfabética e a escolha é lembrada", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const p = mestre.pagina;
  await abrir(p);

  // 33 magias passam do limite: tudo fechado, com a contagem no título e os truques primeiro
  await expect(p.getByTestId("compendio-item")).toHaveCount(0);
  await expect(p.getByTestId("compendio-bloco-magias-0-titulo")).toContainText("Truques");
  await expect(p.getByTestId("compendio-bloco-magias-0-contagem")).toHaveText("6");
  await expect(p.getByTestId("compendio-bloco-magias-1-contagem")).toHaveText("2");
  await expect(p.getByTestId("compendio-bloco-magias-2-contagem")).toHaveText("24");
  await expect(p.getByTestId("compendio-bloco-magias-3-contagem")).toHaveText("1");
  const ordem = await p
    .locator('[data-testid^="compendio-bloco-magias-"][data-testid$="-titulo"]')
    .evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
  expect(ordem.map((t) => t.replace(/\d+$/, ""))).toEqual([
    "Truques",
    "1º nível",
    "2º nível",
    "3º nível",
  ]);

  // abrir o 1º nível mostra as duas magias, em ordem alfabética
  const titulo1 = p.getByTestId("compendio-bloco-magias-1-titulo");
  await expect(titulo1).toHaveAttribute("aria-expanded", "false");
  await titulo1.click();
  await expect(titulo1).toHaveAttribute("aria-expanded", "true");
  expect(await nomesDe(p, "compendio-item")).toEqual(["Detectar Magia", "Mísseis Mágicos"]);
  // o nome em inglês aparece pequeno ao lado
  await expect(
    p.locator('[data-testid="compendio-item"][data-nome="Detectar Magia"]'),
  ).toContainText("Detect Magic");

  // fechar de novo esconde as linhas
  await titulo1.click();
  await expect(titulo1).toHaveAttribute("aria-expanded", "false");
  await expect(p.getByTestId("compendio-item")).toHaveCount(0);

  // a escolha fica lembrada só neste navegador (localStorage), sem mandar nada para a sala
  await titulo1.click();
  const lembrado = await p.evaluate(() => localStorage.getItem("tabletop:pref:compendio-blocos"));
  expect(JSON.parse(lembrado ?? "{}")).toEqual({ "magias:1": true });
  expect(mestre.enviados.some((f) => f.includes("compendio-blocos"))).toBe(false);
});

test("buscar ou filtrar abre os blocos que têm resultado; classe e escola filtram", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const p = mestre.pagina;
  await abrir(p);

  await p.getByTestId("compendio-busca").fill("bola");
  await expect.poll(() => nomesDe(p, "compendio-item")).toEqual(["Bola de Fogo"]);
  await expect(p.getByTestId("compendio-bloco-magias-3-titulo")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await p.getByTestId("compendio-limpar").click();
  await expect(p.getByTestId("compendio-item")).toHaveCount(0);

  // classe: só as magias de Bruxo (as 3 de truque de índice par e as 12 de 2º nível), nos blocos que têm
  await p.getByTestId("compendio-classe").selectOption("Bruxo");
  await expect(p.getByTestId("compendio-contagem")).toHaveText("15 de 33 magias");
  await expect(p.getByTestId("compendio-bloco-magias-0-contagem")).toHaveText("3");
  await expect(p.getByTestId("compendio-bloco-magias-2-contagem")).toHaveText("12");
  await expect(p.getByTestId("compendio-bloco-magias-3")).toHaveCount(0);
  await expect(p.getByTestId("compendio-item")).toHaveCount(15);

  // escola junto com a classe
  await p.getByTestId("compendio-escola").selectOption("Ilusão");
  await expect(p.getByTestId("compendio-nenhuma")).toBeVisible();
  await p.getByTestId("compendio-classe").selectOption("");
  await expect(p.getByTestId("compendio-contagem")).toHaveText("15 de 33 magias");
  await p.getByTestId("compendio-limpar").click();
  await expect(p.getByTestId("compendio-contagem")).toHaveText("33 magias");
});

test("monstros por ND e itens mágicos por raridade, em ordem", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const p = mestre.pagina;
  await abrir(p);

  await p.getByTestId("compendio-secao-monstros").click();
  const nds = await p
    .locator('[data-testid^="compendio-bloco-monstros-"][data-testid$="-titulo"] b')
    .evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
  // o SRD de exemplo tem Goblin (1/4), Lobo (1/4) e Mago (6): 1/4 vem antes do 6
  expect(nds).toEqual(["ND 1/4", "ND 6"]);
  await expect(p.getByTestId("compendio-bloco-monstros-1_4-contagem")).toHaveText("2");
  expect(await nomesDe(p, "compendio-monstro")).toEqual(["Goblin", "Lobo", "Mago"]);
  await expect(p.getByTestId("compendio-monstros")).toContainText("Mage");

  await p.getByTestId("compendio-secao-itensMagicos").click();
  const raridades = await p
    .locator('[data-testid^="compendio-bloco-itensMagicos-"][data-testid$="-titulo"] b')
    .evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
  // o exemplo tem itens de raridades diferentes: a ordem é a das raridades (comum antes de incomum antes de raro...)
  const ordemDasRaridades = [
    "Comum",
    "Incomum",
    "Raro",
    "Muito raro",
    "Lendário",
    "Artefato",
    "Varia",
  ];
  expect(raridades.length).toBeGreaterThanOrEqual(2);
  expect(raridades).toEqual(
    [...raridades].sort((a, b) => ordemDasRaridades.indexOf(a) - ordemDasRaridades.indexOf(b)),
  );
  // sintonização: o filtro novo
  await p.getByTestId("compendio-item-magico-sintonizacao").selectOption("sim");
  await expect(p.getByTestId("compendio-contagem")).toContainText("de 4 itens mágicos");
});

test("a busca em Todas acha em outra seção, em português e em inglês; o jogador não vê monstros", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const p = mestre.pagina;
  await abrir(p);

  await p.getByTestId("compendio-secao-todas").click();
  await expect(p.getByTestId("compendio-secao-todas")).toHaveAttribute("aria-pressed", "true");
  // em inglês: a mesma magia que "Bola de Fogo"
  await p.getByTestId("compendio-busca").fill("fireball");
  await expect.poll(() => nomesDe(p, "compendio-item")).toEqual(["Bola de Fogo"]);
  // sem acento e sem caixa, em português
  await p.getByTestId("compendio-busca").fill("MISSEIS");
  await expect.poll(() => nomesDe(p, "compendio-item")).toEqual(["Mísseis Mágicos"]);
  // outra seção: o monstro e a arma, achados pelo nome em inglês
  await p.getByTestId("compendio-busca").fill("wolf");
  await expect.poll(() => nomesDe(p, "compendio-monstro")).toEqual(["Lobo"]);
  await expect(p.getByTestId("compendio-bloco-todas-monstros-titulo")).toContainText("Monstros");
  await p.getByTestId("compendio-busca").fill("longsword");
  await expect.poll(() => nomesDe(p, "compendio-entrada-arma")).toEqual(["Espada longa"]);
  await p.getByTestId("compendio-busca").fill("zzzz");
  await expect(p.getByTestId("compendio-nenhuma")).toBeVisible();

  // numa seção sem resultado, o aviso leva a todas
  await p.getByTestId("compendio-secao-magias").click();
  await p.getByTestId("compendio-busca").fill("goblin");
  await expect(p.getByTestId("compendio-buscar-em-todas")).toBeVisible();
  await p.getByTestId("compendio-buscar-em-todas").click();
  await expect.poll(() => nomesDe(p, "compendio-monstro")).toEqual(["Goblin"]);

  // o jogador: sem a seção Monstros e sem achar o goblin; "Adicionar" de uma arma achada em Todas funciona
  const q = j1.pagina;
  await abrirAba(q, "compendio");
  await expect(q.getByTestId("compendio-secao-monstros")).toHaveCount(0);
  await q.getByTestId("compendio-secao-todas").click();
  await q.getByTestId("compendio-busca").fill("goblin");
  await expect(q.getByTestId("compendio-nenhuma")).toBeVisible();
  await expect(q.getByTestId("compendio-monstro")).toHaveCount(0);
  await q.getByTestId("compendio-busca").fill("longsword");
  await expect.poll(() => nomesDe(q, "compendio-entrada-arma")).toEqual(["Espada longa"]);
  await q.getByTestId("compendio-arma-adicionar").click();
  await expect(q.getByTestId("compendio-aviso-acao")).toContainText("entrou na ficha de Aldric");
});
