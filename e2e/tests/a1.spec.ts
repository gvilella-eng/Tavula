import type { Locator, Page } from "@playwright/test";
import { abrirAba, abrirSecaoDaMesa, expect, test } from "./ajudas";
import { entrarNoMapa } from "./ajudasMapa";

// A1: campos lado a lado alinham rótulo, caixa e ajuda. Aperta o par até um rótulo quebrar em duas linhas e confere
// que o topo das duas caixas continua igual (diferença de até 1 px).

async function caixa(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error("caixa sem medida");
  return b;
}

/** Estreita o pai do par (só no teste) para forçar a quebra do rótulo mais comprido. */
async function apertar(par: Locator, largura: number) {
  await par.evaluate((el, w) => {
    (el as HTMLElement).style.width = `${w}px`;
  }, largura);
}

async function topoIgual(a: Locator, b: Locator) {
  const [ca, cb] = [await caixa(a), await caixa(b)];
  expect(Math.abs(ca.y - cb.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(ca.height - cb.height)).toBeLessThanOrEqual(1);
}

async function rotuloQuebra(campo: Locator) {
  // o <label> do campo é o pai da caixa; mais de uma linha de texto = altura do rótulo acima de ~1,6 linhas
  const alturas = await campo.locator("xpath=..").evaluate((lab) => {
    const r = document.createRange();
    r.selectNodeContents(lab.firstChild as Node);
    return r.getBoundingClientRect().height;
  });
  return alturas;
}

async function pagina(p: Page) {
  await p.setViewportSize({ width: 1280, height: 720 });
}

test("PainelDaMesa: 'Morrendo abaixo de (%)' quebra e as duas caixas ficam alinhadas", async ({
  mesa,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  await pagina(m);
  await abrirAba(m, "mesa");
  await abrirSecaoDaMesa(m, "regras");
  await abrirSecaoDaMesa(m, "luz");
  const fraca = m.getByTestId("cfg-estagio-fraca");
  const morrendo = m.getByTestId("cfg-estagio-morrendo");
  const par = fraca.locator("xpath=../..");
  await fraca.scrollIntoViewIfNeeded();
  // estreita o par aos poucos até só o segundo rótulo quebrar em duas linhas
  let hFraca = 0;
  let hMorrendo = 0;
  for (let w = 400; w >= 160; w -= 10) {
    await apertar(par, w);
    [hFraca, hMorrendo] = [await rotuloQuebra(fraca), await rotuloQuebra(morrendo)];
    if (hMorrendo > hFraca + 4) break;
  }
  expect(hMorrendo).toBeGreaterThan(hFraca + 4); // o segundo rótulo quebrou em duas linhas
  await topoIgual(fraca, morrendo);
  // e a caixa nunca fica menor que o número que mostra
  expect((await caixa(morrendo)).width).toBeGreaterThanOrEqual(40);
});

test("PainelDaMesa: mãos e penalidade, e luz plena e penumbra, alinham", async ({ mesa }) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  await pagina(m);
  await abrirAba(m, "mesa");
  await abrirSecaoDaMesa(m, "regras");
  const maos = m.getByTestId("cfg-maos");
  await apertar(maos.locator("xpath=../.."), 230);
  await topoIgual(maos, m.getByTestId("cfg-penalidade"));
  await abrirSecaoDaMesa(m, "luz");
  const clara = m.locator('[data-testid^="modelo-clara-"]').first();
  if ((await clara.count()) > 0) {
    await apertar(clara.locator("xpath=../.."), 230);
    await topoIgual(clara, m.locator('[data-testid^="modelo-penumbra-"]').first());
  }
});

test("tela inicial: senha e confirmação ficam alinhadas com o rótulo longo quebrando", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.getByTestId("inicio-aba-criar").click();
  const senha = page.getByTestId("inicio-criar-senha");
  await expect(senha).toBeVisible();
  await apertar(senha.locator("xpath=../.."), 260);
  await topoIgual(senha, page.getByTestId("inicio-criar-confirmar"));
  await topoIgual(
    page.getByTestId("inicio-criar-login"),
    page.getByTestId("inicio-criar-nome-do-mestre"),
  );
});
