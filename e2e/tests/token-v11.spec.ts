import type { Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { menuDoToken } from "./ajudasCombate";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina, tokenDe } from "./ajudasMapa";

// V11: a tocha na mão é uma marca no canto do token (1ª mão: superior direito; 2ª: superior esquerdo) e as
// condições são ícones (4 e um "+N"), um por condição.

const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

const alcas = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas());
const luzesDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes());

async function duasTochas(p: Page) {
  await ok(p, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 2 });
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-1" });
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-2" });
}

test("as duas tochas acesas são marcas nos cantos de cima do token, e a luz sai do centro dele", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await duasTochas(mestre.pagina);
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await expect.poll(async () => (await alcas(p)).length).toBe(2);

  const t = await tokenDe(p, "tok-jogador-1");
  await p.evaluate(
    ([x, y]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(
        x as number,
        y as number,
      ),
    [t.x, t.y],
  );
  const centro = await pontoNaPagina(p, t.x, t.y);
  const todas = await alcas(p);
  const primeira = todas.find((a) => a.mao === 0);
  const segunda = todas.find((a) => a.mao === 1);
  expect(primeira, "tocha da 1ª mão").toBeDefined();
  expect(segunda, "tocha da 2ª mão").toBeDefined();
  // 1ª mão: canto superior direito; 2ª: canto superior esquerdo
  expect((primeira?.x ?? 0) - centro.x).toBeGreaterThan(8);
  expect((primeira?.y ?? 0) - centro.y).toBeLessThan(-8);
  expect((segunda?.x ?? 0) - centro.x).toBeLessThan(-8);
  expect((segunda?.y ?? 0) - centro.y).toBeLessThan(-8);
  // pequenas: dentro do mínimo e do máximo de tela
  for (const a of [primeira, segunda]) {
    expect(a?.raio).toBeGreaterThanOrEqual(9);
    expect(a?.raio).toBeLessThanOrEqual(15);
  }
  // a luz tem o centro no token, não na marca
  const luzes = await luzesDe(p);
  const dele = luzes.filter((l) => Math.hypot(l.x - t.x, l.y - t.y) < 0.01);
  expect(dele.map((l) => l.id).sort()).toEqual(["tocha-1", "tocha-2"]);

  // aproximando, a marca para de crescer em pixels de tela
  await p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.definirZoom(3),
  );
  await expect.poll(async () => (await alcas(p))[0]?.raio).toBeLessThanOrEqual(15);
});

test("arrastar a marca da tocha para outro token entrega a tocha", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await ok(mestre.pagina, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 1 });
  await ok(mestre.pagina, "token.soltar", { id: "tok-jogador-2", x: 11.25, y: 11.25 });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await ok(j1.pagina, "tocha.acender", {
    personagemId: ALDRIC,
    modeloId: TOCHA,
    novoId: "tocha-1",
  });
  await expect.poll(async () => (await alcas(j1.pagina))[0]?.mao).toBe(0);
  await expect.poll(async () => (await alcas(j2.pagina)).length).toBe(1);

  const marca = (await alcas(j1.pagina))[0];
  const alvo = await pontoNaPagina(j1.pagina, 11.25, 11.25);
  await j1.pagina.mouse.move(marca?.x ?? 0, marca?.y ?? 0);
  await j1.pagina.mouse.down();
  await j1.pagina.mouse.move(alvo.x, alvo.y, { steps: 10 });
  await j1.pagina.mouse.up();
  await expect.poll(async () => (await alcas(j2.pagina))[0]?.portador).toBe("mao");
  await expect
    .poll(() =>
      j2.frames.some((f) => f.includes('"personagemId":"pers-brisa"') && f.includes('"mao"')),
    )
    .toBe(true);
});

test("seis condições mostram 4 ícones e um +2, e o menu de condições mostra os ícones", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "token.condicoes", {
    id: "tok-ogro",
    condicoes: ["agarrado", "caido", "cego", "envenenado", "invisivel", "surdo"],
  });
  await expect
    .poll(async () => (await tokenDe(p, "tok-ogro")).marcas)
    .toEqual(["Agarrado", "Caído", "Cego", "Envenenado", "Mais 2"]);

  await menuDoToken(p, "tok-ogro");
  const painel = p.getByTestId("menu-token-painel-condicoes");
  await expect(painel).toBeVisible();
  // um ícone por condição (14), mais a exaustão e a concentração, todos diferentes entre si
  const icones = painel.locator("svg[data-icone]");
  await expect(icones).toHaveCount(16);
  const nomes = await icones.evaluateAll((els) => els.map((e) => e.getAttribute("data-icone")));
  expect(new Set(nomes).size).toBe(16);
  await expect(p.getByTestId("condicao-caido").locator('svg[data-icone="caido"]')).toBeVisible();
  const desenhos = await icones.evaluateAll((els) =>
    els.map((e) => e.innerHTML.replace(/\s+/g, "")),
  );
  expect(new Set(desenhos).size).toBe(16);
});
