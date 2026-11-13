import type { Page } from "@playwright/test";
import { enviarCru, esperarMapa, expect, intencaoCrua, menuDaCena, test } from "./ajudas";
import { arquivoPng, definirMapa, pngDeRuido } from "./ajudasAssets";
import { entrarNoMapa, type GanchoDoMapa } from "./ajudasMapa";

// V10c: a cena como cartão. A semente tem a cena-1 (60 × 45 m) com a sala de paredes; o jogador 1 tem o
// token dele nela. Longe da sala, num ponto que ele só veria com luz e linha de visão:
const LONGE = { x: 55, y: 40 };

const ganchoDe = (p: Page) =>
  p.evaluate(() => {
    const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
    return { visao: h.visao(), veu: h.veuVisivel(), paredes: h.paredes().length };
  });
const ve = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.veNoPonto(
        px as number,
        py as number,
      ),
    [x, y],
  );
const quadro = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.quadroDaCena());

/** O mestre tira o token do jogador 1: sem token ele não enxerga nada num mapa. */
async function tirarOTokenDoJogador(mestre: Page) {
  const r = await enviarCru(mestre, intencaoCrua("token.apagar", { id: "tok-jogador-1" }));
  expect(r?.tipo).toBe("evento");
}

test("o mestre transforma a cena em cartão pelo menu: marca na faixa e o item vira Voltar a ser mapa", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await expect.poll(async () => (await ganchoDe(p)).visao.modo).toBe("noturna");

  await menuDaCena(p, "cena-1", "cartao");
  await expect(p.getByTestId("cena-cartao-cena-1")).toBeVisible();
  await expect(p.getByTestId("cena-cartao-cena-1")).toHaveAttribute("title", "Cena como cartão");
  // o mestre também fica sem névoa (a visão dele vira "claro")
  await expect.poll(async () => (await ganchoDe(p)).visao.modo).toBe("claro");

  await p.locator('[data-testid="cena-card"][data-cena-id="cena-1"]').click({ button: "right" });
  await expect(p.getByTestId("menu-cena-cartao")).toContainText("Voltar a ser mapa");
  await p.getByTestId("menu-cena-cartao").click();
  await expect(p.getByTestId("cena-cartao-cena-1")).toHaveCount(0);
  await expect.poll(async () => (await ganchoDe(p)).visao.modo).toBe("noturna");
});

test("jogador sem token vê o mapa inteiro, sem escuridão nem aviso; Voltar a ser mapa devolve névoa e paredes", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await tirarOTokenDoJogador(mestre.pagina);

  // mapa: sem token o jogador não vê nada, há aviso e as paredes chegaram
  await expect(j1.pagina.getByTestId("sem-token")).toBeVisible();
  await expect.poll(() => ve(j1.pagina, LONGE.x, LONGE.y)).toBe(false);
  expect((await ganchoDe(j1.pagina)).visao.modo).toBe("jogador");
  expect((await ganchoDe(j1.pagina)).paredes).toBeGreaterThan(0);

  // cartão: tudo claro, sem aviso, sem véu e sem paredes para o jogador (o mestre as guarda)
  await menuDaCena(mestre.pagina, "cena-1", "cartao");
  await expect.poll(async () => (await ganchoDe(j1.pagina)).visao.modo).toBe("claro");
  await expect(j1.pagina.getByTestId("sem-token")).toHaveCount(0);
  expect((await ganchoDe(j1.pagina)).veu).toBe(false);
  expect(await ve(j1.pagina, LONGE.x, LONGE.y)).toBe(true);
  await expect.poll(async () => (await ganchoDe(j1.pagina)).paredes).toBe(0);
  expect((await ganchoDe(mestre.pagina)).paredes).toBeGreaterThan(0);

  // voltar a ser mapa: a névoa, o aviso e as paredes voltam; a secreta nunca chegou ao jogador
  await menuDaCena(mestre.pagina, "cena-1", "cartao");
  await expect.poll(async () => (await ganchoDe(j1.pagina)).visao.modo).toBe("jogador");
  await expect(j1.pagina.getByTestId("sem-token")).toBeVisible();
  await expect.poll(() => ve(j1.pagina, LONGE.x, LONGE.y)).toBe(false);
  await expect.poll(async () => (await ganchoDe(j1.pagina)).paredes).toBeGreaterThan(0);
  const tipos = await j1.pagina.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paredes().map((q) => q.tipo),
  );
  expect(tipos).not.toContain("secreta");
});

test("a câmera enquadra a imagem inteira ao entrar na cena-cartão, centrada e com folga pequena", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await definirMapa(
    mestre.pagina,
    "cena-1",
    arquivoPng("cidade.png", pngDeRuido(1300, 1000, 31, 2)),
    35,
  );
  await menuDaCena(mestre.pagina, "cena-1", "cartao");

  // o jogador entra depois e não mexe na câmera: a vista abre com a imagem inteira dentro da área
  const j1 = await mesa.entrar("jogador-1");
  await esperarMapa(j1.pagina);
  await expect
    .poll(async () => {
      const q = await quadro(j1.pagina);
      if (!q || q.cena.largura <= 0) return false;
      const { cena, area } = q;
      const dentro =
        cena.x >= area.x - 1 &&
        cena.y >= area.y - 1 &&
        cena.x + cena.largura <= area.x + area.largura + 1 &&
        cena.y + cena.altura <= area.y + area.altura + 1;
      const folgaX = (area.largura - cena.largura) / 2;
      const folgaY = (area.altura - cena.altura) / 2;
      const centrada =
        Math.abs(cena.x - area.x - folgaX) < 2 && Math.abs(cena.y - area.y - folgaY) < 2;
      // a imagem preenche a área em uma das direções (folga de 24 px de cada lado)
      const encosta = Math.min(folgaX, folgaY) <= 26;
      return dentro && centrada && encosta;
    })
    .toBe(true);
});

test("o checkbox do Configurar cena faz o mesmo que o menu", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await tirarOTokenDoJogador(p);
  await expect.poll(async () => (await ganchoDe(j1.pagina)).visao.modo).toBe("jogador");

  await menuDaCena(p, "cena-1", "configurar");
  await expect(p.getByTestId("cfg-cartao")).not.toBeChecked();
  await p.getByTestId("cfg-cartao").check();
  await p.getByTestId("cfg-salvar").click();
  await expect(p.getByTestId("cena-cartao-cena-1")).toBeVisible();
  await expect.poll(async () => (await ganchoDe(j1.pagina)).visao.modo).toBe("claro");

  await menuDaCena(p, "cena-1", "configurar");
  await expect(p.getByTestId("cfg-cartao")).toBeChecked();
  await p.getByTestId("cfg-cartao").uncheck();
  await p.getByTestId("cfg-salvar").click();
  await expect(p.getByTestId("cena-cartao-cena-1")).toHaveCount(0);
  await expect.poll(async () => (await ganchoDe(j1.pagina)).visao.modo).toBe("jogador");
});

test("só o mestre muda o cartão: a sala recusa o jogador", async ({ mesa }) => {
  await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const r = await enviarCru(
    j1.pagina,
    intencaoCrua("cena.editar", { cenaId: "cena-1", cartao: true }),
  );
  expect(r?.tipo).toBe("erro");
  expect(r?.dados.codigo).toBe("sem_permissao");
});
