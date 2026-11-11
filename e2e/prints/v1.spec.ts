import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, expect, Mesa } from "../tests/ajudas";
import { ligarOrdem, menuDoToken } from "../tests/ajudasCombate";
import { mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, selecionarToken } from "../tests/ajudasMapa";

// Prints do lote V1 (temas com personalidade, aba Mesa no fim, zerar o relógio): a mesa em jogo em cada um dos 14
// temas a 1600×900, quatro deles também a 1280×720, o seletor de temas, a aba Mesa no fim e o menu do relógio.
// Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const TEMAS = [
  "grimorio",
  "escuro",
  "claro",
  "edgerunner",
  "vampiro",
  "licantropo",
  "taverna",
  "forja",
  "paladino",
  "druida",
  "leviata",
  "arcana",
  "elfico",
  "celestial",
] as const;
const PEQUENOS = ["grimorio", "edgerunner", "vampiro", "celestial"] as const;

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 400) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

async function tentar(nome: string, passo: () => Promise<void>) {
  try {
    await passo();
  } catch (e) {
    const msg = (e as Error).message.split("\n").slice(0, 3).join(" | ");
    falhas.push(`${nome}: ${msg}`);
    console.log(`[FALHOU] ${nome}: ${msg}`);
  }
}

base.afterAll(() => {
  console.log(`[V1] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V1] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function montarJogo(m: Page) {
  await selecionarToken(m, "tok-jogador-1");
  await ligarOrdem(m);
  await mandar(m, "combate.adicionar", {
    entradas: [
      { id: "e-aldric", tokenId: "tok-jogador-1" },
      { id: "e-brisa", tokenId: "tok-jogador-2" },
      { id: "e-ogro", tokenId: "tok-ogro" },
    ],
  });
  await expect(m.getByTestId("ordem-entrada")).toHaveCount(3);
}

const CASOS = [
  ...TEMAS.map((tema) => ({ tema, nome: "1600x900", width: 1600, height: 900 })),
  ...PEQUENOS.map((tema) => ({ tema, nome: "1280x720", width: 1280, height: 720 })),
];

for (const c of CASOS) {
  base(`mesa em jogo ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(180_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      await tentar(`${rotulo} jogo`, async () => {
        await montarJogo(m);
        // a dica comum num botão da barra
        await m.getByTestId("ferramenta-regua").hover();
        await expect(m.getByTestId("dica-ferramenta-regua")).toBeVisible();
        await foto(m, `${rotulo}-01-mesa-em-jogo-com-dica`);
      });
      await tentar(`${rotulo} menu`, async () => {
        await m.mouse.move(5, 5);
        await menuDoToken(m, "tok-ogro");
        await expect(m.getByTestId("menu-token")).toBeVisible();
        await foto(m, `${rotulo}-02-menu-do-token`);
        await m.keyboard.press("Escape");
      });
    } finally {
      await mesa.fechar();
    }
  });
}

for (const tema of ["grimorio", "edgerunner", "celestial"] as const) {
  base(`extras ${tema}`, async ({ browser, request }) => {
    base.setTimeout(180_000);
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, tema);

      await tentar(`${tema} seletor`, async () => {
        await m.getByTestId("aba-preferencias").click();
        await expect(m.getByTestId("seletor-de-tema")).toBeVisible();
        await foto(m, `${tema}-03-seletor-de-temas`);
        await m.getByTestId("seletor-de-tema").screenshot({
          path: join(PASTA as string, `${tema}-03-seletor-de-temas-recorte.png`),
        });
      });

      await tentar(`${tema} aba mesa`, async () => {
        await m.getByTestId("aba-mesa").click();
        await expect(m.getByTestId("aba-painel-mesa")).toBeVisible();
        await foto(m, `${tema}-04-aba-mesa-no-fim`);
        await m.getByTestId("barra-lateral").screenshot({
          path: join(PASTA as string, `${tema}-04-barra-lateral.png`),
        });
        await m.getByTestId("aba-chat").click();
      });

      await tentar(`${tema} relógio`, async () => {
        await m.getByTestId("menu-relogio").click();
        await expect(m.getByTestId("zerar-relogio")).toBeVisible();
        await foto(m, `${tema}-05-menu-do-relogio`);
        await m.getByTestId("topo").screenshot({
          path: join(PASTA as string, `${tema}-05-menu-do-relogio-topo.png`),
        });
        await m.getByTestId("zerar-relogio").click();
        await expect(m.getByTestId("zerar-relogio-confirmacao")).toBeVisible();
        await foto(m, `${tema}-06-confirmacao-de-zerar`);
        await m.getByTestId("zerar-relogio-confirmar").click();
        await expect(m.getByTestId("menu-relogio-lista")).toHaveCount(0);
        await m.getByTestId("topo").screenshot({
          path: join(PASTA as string, `${tema}-06-topo-zerado.png`),
        });
        await m.getByTestId("menu-pausa").click();
        await m.getByTestId("topo").screenshot({
          path: join(PASTA as string, `${tema}-07-topo-pausada.png`),
        });
        await m.getByTestId("menu-pausa").click();
      });
    } finally {
      await mesa.fechar();
    }
  });
}
