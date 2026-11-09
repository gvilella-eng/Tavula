import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, expect, Mesa } from "../tests/ajudas";
import { definirValor, ligarOrdem, menuDoToken, vezNaOrdem } from "../tests/ajudasCombate";
import { mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, tokenDe } from "../tests/ajudasMapa";

// Prints do Lote 11 (combate), em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-11
// Os dados saem da sala com semente fixa (gancho /teste/dados, só no MODO=teste).

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

/** Foto só de um pedaço da página, ao redor de um ponto (px da página). */
async function recorte(p: Page, nome: string, centro: { x: number; y: number }, w = 520, h = 340) {
  await p.waitForTimeout(500);
  const x = Math.max(0, Math.min(centro.x - w / 2, 1600 - w));
  const y = Math.max(0, Math.min(centro.y - h / 2, 900 - h));
  await p.screenshot({
    path: join(PASTA as string, `${nome}.png`),
    clip: { x, y, width: w, height: h },
  });
}

/** Centra o mapa no token, dá o zoom e devolve onde ele está na página. */
async function aproximar(p: Page, tokenId: string, zoom: number, deslocarPx = 0) {
  const t = await tokenDe(p, tokenId);
  return p.evaluate(
    ([x, y, z, d]) => {
      const h = (
        window as unknown as {
          __tabletop: {
            definirZoom(z: number): void;
            centrarEm(x: number, y: number): void;
            paraTela(x: number, y: number): { x: number; y: number };
          };
        }
      ).__tabletop;
      h.definirZoom(z as number);
      // `d` px à direita do centro: o token fica à esquerda, longe do painel da ordem de turno
      h.centrarEm((x as number) + (d as number) / (40 * (z as number)), y as number);
      return h.paraTela(x as number, y as number);
    },
    [t.x, t.y, zoom, deslocarPx],
  );
}

const NPCS = [
  { id: "tok-gob-arqueiro", nome: "Goblin Arqueiro", x: 24, y: 11.25, cor: "#7f8c3a" },
  { id: "tok-gob-capanga", nome: "Goblin Capanga", x: 27, y: 14.25, cor: "#9a7d2e" },
];

test("lote 11: combate com 3 PJs e 4 NPCs, anel da vez, condições e chat", async ({
  grande,
  request,
}) => {
  test.setTimeout(240_000);
  expect((await request.post("/teste/dados?semente=5")).ok()).toBe(true);
  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");

  // dois goblins visíveis; o Ogro, o goblin oculto e o marcador já existem na semente
  for (const n of NPCS) {
    await mandar(mestre.pagina, "token.criar", {
      token: {
        id: n.id,
        nome: n.nome,
        cor: n.cor,
        tamanhoQuadrados: 1,
        x: n.x,
        y: n.y,
        camada: "tokens",
        oculto: false,
        controladoPor: [],
      },
    });
  }
  await mandar(mestre.pagina, "combate.adicionar", {
    entradas: [
      { id: "e-aldric", tokenId: "tok-jogador-1" },
      { id: "e-brisa", tokenId: "tok-jogador-2" },
      { id: "e-cael", tokenId: "tok-jogador-3" },
      { id: "e-ogro", tokenId: "tok-ogro" },
      { id: "e-arqueiro", tokenId: "tok-gob-arqueiro" },
      { id: "e-capanga", tokenId: "tok-gob-capanga" },
      { id: "e-emboscado", tokenId: "tok-goblin-oculto" },
    ],
  });
  await ligarOrdem(mestre.pagina);
  await expect(mestre.pagina.getByTestId("ordem-entrada")).toHaveCount(7);
  await expect(j1.pagina.getByTestId("ordem-entrada")).toHaveCount(6);

  // 1) as rolagens de iniciativa no chat: o mestre vê todas (as dos NPCs ocultas); o jogador, só as dos PJs
  await mestre.pagina.getByTestId("ordem-rolar-todos").click();
  await expect(
    mestre.pagina.locator('[data-testid="chat-mensagem"][data-tipo="modelo"]'),
  ).toHaveCount(7);
  await expect(j1.pagina.locator('[data-testid="chat-mensagem"][data-tipo="modelo"]')).toHaveCount(
    3,
  );
  await foto(mestre.pagina, "01-chat-iniciativa-mestre");
  await foto(j1.pagina, "02-chat-iniciativa-jogador");

  // 2) valores de jogo e o "?" no Ogro; o combate segue até a rodada 2, com a vez no Aldric
  const valores: [string, number][] = [
    ["Aldric", 18],
    ["Ogro", 16],
    ["Brisa", 14],
    ["Goblin Arqueiro", 13],
    ["Cael", 11],
    ["Goblin Emboscado", 9],
    ["Goblin Capanga", 6],
  ];
  for (const [nome, v] of valores) await definirValor(mestre.pagina, nome, v);
  await mestre.pagina.getByTestId("ordem-valor-oculto-e-ogro").click();
  await expect(j1.pagina.getByTestId("ordem-numero-e-ogro")).toHaveText("?");
  for (let i = 0; i < 8; i++) await mestre.pagina.getByTestId("ordem-proximo").click();
  await expect.poll(() => vezNaOrdem(mestre.pagina)).toBe("Aldric");
  await expect(mestre.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada 2");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada 2");
  await expect(j1.pagina.getByTestId("ordem-passar")).toBeVisible();

  // quadro geral: o mapa centrado no grupo, nos dois navegadores
  await aproximar(mestre.pagina, "tok-ogro", 1, 300);
  await aproximar(j1.pagina, "tok-ogro", 1, 300);
  await foto(mestre.pagina, "03-ordem-mestre-rodada-2");
  await foto(j1.pagina, "04-ordem-jogador-rodada-2");

  // 3) o anel do token da vez (o mesmo no mestre e no jogador); a cena fica clara para o anel aparecer em cor
  await mandar(mestre.pagina, "cena.configurarIluminacao", { luzAmbiente: 1 });
  const noAldric = await aproximar(j1.pagina, "tok-jogador-1", 2.2, 330);
  await recorte(j1.pagina, "05-anel-da-vez-jogador", noAldric, 480, 320);
  const noAldricM = await aproximar(mestre.pagina, "tok-jogador-1", 2.2, 330);
  await recorte(mestre.pagina, "06-anel-da-vez-mestre", noAldricM, 480, 320);
  // a vez passa para o Ogro: o anel acompanha
  await mestre.pagina.getByTestId("ordem-proximo").click();
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Ogro");
  const noOgro = await aproximar(j1.pagina, "tok-ogro", 2.2, 330);
  await recorte(j1.pagina, "07-anel-da-vez-ogro", noOgro, 480, 320);
  await mestre.pagina.getByTestId("ordem-anterior").click();

  // 4) o menu de condições do token (botão direito) e o token com 3 condições, exaustão 2 e concentração
  await mestre.pagina.getByTestId("menu-ordem-turno").click(); // fecha o painel para liberar o mapa
  await expect(mestre.pagina.getByTestId("ordem-de-turno")).toHaveCount(0);
  await aproximar(mestre.pagina, "tok-jogador-2", 1.6);
  await menuDoToken(mestre.pagina, "tok-jogador-2", 38);
  await expect(mestre.pagina.getByTestId("menu-token")).toBeVisible();
  await foto(mestre.pagina, "08-menu-do-token");
  await mestre.pagina.getByTestId("menu-token-condicoes").click();
  await mestre.pagina.getByTestId("condicao-amedrontado").click();
  await mestre.pagina.getByTestId("condicao-envenenado").click();
  await mestre.pagina.getByTestId("condicao-caido").click();
  await mestre.pagina.getByTestId("exaustao-2").click();
  await mestre.pagina.getByTestId("concentracao-input").fill("Bênção");
  await mestre.pagina.getByTestId("concentracao-aplicar").click();
  await expect(mestre.pagina.getByTestId("condicao-caido")).toHaveAttribute("aria-checked", "true");
  await foto(mestre.pagina, "09-menu-de-condicoes");
  await mestre.pagina.getByTestId("menu-token-fechar").click();

  await expect
    .poll(async () => (await tokenDe(mestre.pagina, "tok-jogador-2")).marcas)
    .toEqual(["Amedrontado", "Caído", "Envenenado", "Exaustão 2", "Concentração: Bênção"]);
  const naBrisa = await aproximar(mestre.pagina, "tok-jogador-2", 2.6);
  await recorte(mestre.pagina, "10-token-com-condicoes", naBrisa, 480, 340);

  // 5) a dica de uma condição
  const marca = await mestre.pagina.evaluate(() =>
    (
      window as unknown as {
        __tabletop: { marcaNaPagina(id: string, i: number): { x: number; y: number } | null };
      }
    ).__tabletop.marcaNaPagina("tok-jogador-2", 2),
  );
  if (!marca) throw new Error("sem marcador");
  await mestre.pagina.mouse.move(marca.x, marca.y);
  await expect(mestre.pagina.getByTestId("dica-condicao")).toBeVisible();
  await recorte(
    mestre.pagina,
    "11-dica-da-condicao",
    { x: marca.x + 100, y: marca.y + 40 },
    520,
    300,
  );
  await mestre.pagina.mouse.move(marca.x + 400, marca.y + 300);
  const marcaConc = await mestre.pagina.evaluate(() =>
    (
      window as unknown as {
        __tabletop: { marcaNaPagina(id: string, i: number): { x: number; y: number } | null };
      }
    ).__tabletop.marcaNaPagina("tok-jogador-2", 4),
  );
  if (marcaConc) {
    await mestre.pagina.mouse.move(marcaConc.x, marcaConc.y);
    await expect(mestre.pagina.getByTestId("dica-condicao")).toContainText("Bênção");
    await recorte(
      mestre.pagina,
      "12-dica-da-concentracao",
      { x: marcaConc.x + 100, y: marcaConc.y + 40 },
      520,
      300,
    );
  }
  await mestre.pagina.mouse.move(marca.x + 400, marca.y + 300);

  // 6) a aba Principal da ficha com as condições
  await mestre.pagina.getByTestId("aba-fichas").click();
  await mestre.pagina.getByTestId("ficha-abrir-pers-brisa").dblclick();
  const janela = mestre.pagina.locator(
    '[data-testid="janela-ficha"][data-personagem-id="pers-brisa"]',
  );
  await expect(janela.getByTestId("fh-condicao-caido")).toBeVisible();
  await foto(mestre.pagina, "13-ficha-principal-condicoes");
});
