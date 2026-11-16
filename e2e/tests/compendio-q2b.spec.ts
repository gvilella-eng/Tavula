import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import { assets } from "./ajudasAssets";

// Q2b: a busca do compêndio por palavra (sem acento, começo de palavra e erro de grafia, em português e inglês) e o espaço
// entre a lista e os botões da aba. O arquivo daqui é o exemplo do SRD (a Bola de Fogo tem o nome original Fireball).

test.describe.configure({ timeout: 120_000 });

const SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);

async function abrir(p: Page) {
  await assets(p, "adicionarNaPasta", "compendio/magias.json", SRD);
  await abrirAba(p, "compendio");
  await expect(p.getByTestId("compendio-lista")).toBeVisible();
}

const nomesDe = (p: Page, testid: string) =>
  p.getByTestId(testid).evaluateAll((els) => els.map((e) => e.getAttribute("data-nome") ?? ""));

test("a busca acha por palavra, começo de palavra, sem acento e com erro de digitação, em português e inglês", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const p = mestre.pagina;
  await abrir(p);
  const busca = p.getByTestId("compendio-busca");
  // a barra diz só "Buscar…"
  await expect(busca).toHaveAttribute("placeholder", "Buscar…");

  for (const texto of [
    "fire",
    "fireball",
    "bola fogo",
    "fogo bola",
    "foggo",
    "firebal",
    "bola de fogo",
  ]) {
    await busca.fill(texto);
    await expect
      .poll(() => nomesDe(p, "compendio-item"), { message: texto })
      .toEqual(["Bola de Fogo"]);
  }
  // acento e começo de palavra
  await busca.fill("misse");
  await expect.poll(() => nomesDe(p, "compendio-item")).toEqual(["Mísseis Mágicos"]);
  await busca.fill("MISSEIS magicos");
  await expect.poll(() => nomesDe(p, "compendio-item")).toEqual(["Mísseis Mágicos"]);
  await busca.fill("magic missle"); // erro de digitação no nome em inglês
  await expect.poll(() => nomesDe(p, "compendio-item")).toEqual(["Mísseis Mágicos"]);
  // o que não existe não acha nada, nem por palavra curta
  await busca.fill("de zzzz");
  await expect(p.getByTestId("compendio-item")).toHaveCount(0);

  // vale também em "Todas" e nas outras seções (o monstro e a arma, pelo nome em inglês)
  await p.getByTestId("compendio-secao-todas").click();
  await busca.fill("fire");
  await expect.poll(() => nomesDe(p, "compendio-item")).toContain("Bola de Fogo");
  await busca.fill("longswrod");
  await expect.poll(() => nomesDe(p, "compendio-entrada-arma")).toEqual(["Espada longa"]);
});

test("a aba deixa um espaço claro entre a lista e os botões, e entre os botões e os créditos", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const p = mestre.pagina;
  await abrir(p);
  const lista = await p.getByTestId("compendio-lista").boundingBox();
  const barra = await p.getByTestId("compendio-barra-mestre").boundingBox();
  const creditos = await p.getByTestId("compendio-creditos").boundingBox();
  expect(lista && barra && creditos).toBeTruthy();
  if (!lista || !barra || !creditos) return;
  expect(barra.y - (lista.y + lista.height)).toBeGreaterThanOrEqual(12);
  expect(creditos.y - (barra.y + barra.height)).toBeGreaterThanOrEqual(12);
});
