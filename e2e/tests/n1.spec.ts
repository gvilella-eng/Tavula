import type { Page } from "@playwright/test";
import { expect, test } from "./ajudas";
import { menuDoToken } from "./ajudasCombate";
import { abrirFicha } from "./ajudasFicha";
import { centrarNoToken, entrarNoMapa, soSelecionarToken, tokenDe, tokensDe } from "./ajudasMapa";

// N1: vida (editável) e CA em cima do token selecionado, o X de "morto" e a camada pelo clique direito.
// A semente: Aldric (jogador-1, 12/12), Brisa (jogador-2) e o Ogro (NPC, 59 PV, CA 11), todos na camada dos tokens.

const marcas = (p: Page) => p.getByTestId("marcas-do-token");

async function selecionarEEsperarMarcas(p: Page, id: string) {
  await soSelecionarToken(p, id);
  await expect(marcas(p)).toHaveAttribute("data-token-id", id);
  await expect(marcas(p)).toBeVisible();
}

test("o jogador vê vida e CA do próprio token; no de outro e no NPC não aparece nada", async ({
  mesa,
}) => {
  const j1 = (await entrarNoMapa(mesa, "jogador-1")).pagina;
  await selecionarEEsperarMarcas(j1, "tok-jogador-1");
  await expect(j1.getByTestId("marca-vida-valor")).toHaveText("12");
  await expect(j1.getByTestId("marca-ca-valor")).toHaveText(/^\d+$/);
  await expect(j1.getByTestId("marca-morto")).toBeVisible();

  // O jogador não seleciona o token de outro nem o do NPC: um clique neles solta a seleção e as marcas somem.
  for (const outro of ["tok-jogador-2", "tok-ogro"]) {
    const alvo = await centrarNoToken(j1, outro);
    await j1.mouse.click(alvo.x, alvo.y);
    await expect.poll(async () => (await tokenDe(j1, outro)).selecionado).toBe(false);
    await expect(marcas(j1)).toHaveCount(0);
  }
});

test("o mestre vê as marcas em qualquer token com ficha, e sem ficha não há marcas", async ({
  mesa,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  await selecionarEEsperarMarcas(m, "tok-jogador-2");
  await expect(m.getByTestId("marca-vida-valor")).toHaveText("9");
  await selecionarEEsperarMarcas(m, "tok-ogro");
  await expect(m.getByTestId("marca-vida-valor")).toHaveText("59");
  await expect(m.getByTestId("marca-ca-valor")).toHaveText("11");
  // o goblin da emboscada não tem ficha
  await soSelecionarToken(m, "tok-goblin-oculto");
  await expect.poll(async () => (await tokenDe(m, "tok-goblin-oculto")).selecionado).toBe(true);
  await expect(marcas(m)).toHaveCount(0);
});

test("editar a vida com -5 grava na ficha e quem tem a ficha aberta vê; Esc cancela; a tecla E abre o campo", async ({
  mesa,
}) => {
  const mestre = (await entrarNoMapa(mesa, "mestre")).pagina;
  const j1 = (await entrarNoMapa(mesa, "jogador-1")).pagina;
  const fichaDoMestre = await abrirFicha(mestre, "pers-aldric");
  await expect(fichaDoMestre.getByTestId("pv-atual-pers-aldric")).toHaveValue("12");

  await selecionarEEsperarMarcas(j1, "tok-jogador-1");
  // Esc cancela
  await j1.getByTestId("marca-vida").click();
  const campo = j1.getByTestId("marca-vida-campo");
  await expect(campo).toBeFocused();
  await expect(campo).toHaveValue("12");
  await campo.fill("-9");
  await campo.press("Escape");
  await expect(campo).toHaveCount(0);
  await expect(j1.getByTestId("marca-vida-valor")).toHaveText("12");
  // -5 grava
  await j1.getByTestId("marca-vida").click();
  await j1.getByTestId("marca-vida-campo").fill("-5");
  await j1.getByTestId("marca-vida-campo").press("Enter");
  await expect(j1.getByTestId("marca-vida-valor")).toHaveText("7");
  await expect(fichaDoMestre.getByTestId("pv-atual-pers-aldric")).toHaveValue("7");
  // a tecla E abre o campo; +3 soma, e nunca passa do máximo
  await j1.keyboard.press("e");
  await expect(j1.getByTestId("marca-vida-campo")).toBeFocused();
  await j1.getByTestId("marca-vida-campo").fill("+30");
  await j1.getByTestId("marca-vida-campo").press("Enter");
  await expect(j1.getByTestId("marca-vida-valor")).toHaveText("12");
  await expect(fichaDoMestre.getByTestId("pv-atual-pers-aldric")).toHaveValue("12");
});

test("o X de morto aparece para todos quando o mestre marca (menu ou botão) e some ao tirar", async ({
  mesa,
}) => {
  const mestre = (await entrarNoMapa(mesa, "mestre")).pagina;
  const j1 = (await entrarNoMapa(mesa, "jogador-1")).pagina;
  expect((await tokenDe(j1, "tok-ogro")).morto).toBe(false);

  await menuDoToken(mestre, "tok-ogro");
  await mestre.getByTestId("menu-token-morto").click();
  await expect.poll(async () => (await tokenDe(j1, "tok-ogro")).morto).toBe(true);
  await expect.poll(async () => (await tokenDe(mestre, "tok-ogro")).morto).toBe(true);

  // o menu agora oferece tirar a marca
  await menuDoToken(mestre, "tok-ogro");
  await expect(mestre.getByTestId("menu-token-morto")).toContainText("Tirar a marca de morto");
  await mestre.keyboard.press("Escape");

  // o botão ao lado das marcas de vida também alterna, e o jogador pode no próprio token
  await selecionarEEsperarMarcas(j1, "tok-jogador-1");
  await j1.getByTestId("marca-morto").click();
  await expect.poll(async () => (await tokenDe(mestre, "tok-jogador-1")).morto).toBe(true);
  await expect(j1.getByTestId("marca-morto")).toHaveAttribute("aria-pressed", "true");
  await j1.getByTestId("marca-morto").click();
  await expect.poll(async () => (await tokenDe(mestre, "tok-jogador-1")).morto).toBe(false);

  await selecionarEEsperarMarcas(mestre, "tok-ogro");
  await mestre.getByTestId("marca-morto").click();
  await expect.poll(async () => (await tokenDe(j1, "tok-ogro")).morto).toBe(false);
});

test("o mestre manda o token para a camada do mestre pelo clique direito; o jogador não tem o item", async ({
  mesa,
}) => {
  const mestre = (await entrarNoMapa(mesa, "mestre")).pagina;
  const j1 = (await entrarNoMapa(mesa, "jogador-1")).pagina;
  const existe = async (p: Page, id: string) => (await tokensDe(p)).some((t) => t.id === id);
  expect(await existe(j1, "tok-ogro")).toBe(true);

  await menuDoToken(mestre, "tok-ogro");
  await expect(mestre.getByTestId("menu-token-camada-tokens")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await mestre.getByTestId("menu-token-camada-mestre").click();
  await expect.poll(() => existe(j1, "tok-ogro")).toBe(false);
  await expect
    .poll(async () => (await tokensDe(mestre)).find((t) => t.id === "tok-ogro")?.camada)
    .toBe("mestre");

  // o jogador, no próprio token, tem o menu (morto, condições), mas sem a camada
  await menuDoToken(j1, "tok-jogador-1");
  await expect(j1.getByTestId("menu-token")).toBeVisible();
  await expect(j1.getByTestId("menu-token-morto")).toBeVisible();
  await expect(j1.getByTestId("menu-token-grupo-camada")).toHaveCount(0);
});
