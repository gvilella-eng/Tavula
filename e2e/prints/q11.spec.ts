import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirPreferencia, test as base, expect, Mesa, tornarMembros } from "../tests/ajudas";
import { mandar } from "../tests/ajudasFicha";
import {
  entrarNoMapa,
  type GanchoDoMapa,
  pontoNaPagina,
  soSelecionarToken,
} from "../tests/ajudasMapa";

// Prints do lote Q11 (barra de vida, borda colorida, laço, mover vários e dano em lote): Grimório 1600×900 e
// 1280×720 e Pergaminho 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints q11

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const GOBLIN = "pers-goblin-q11";

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

const tokens = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.tokens());

const olharPara = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([px, py]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.definirZoom(1);
      h.centrarEm(px as number, py as number);
    },
    [x, y],
  );

// Duas filas de goblins perto dos jogadores da semente (Aldric, Brisa e Cael, em y = 9,75).
const GRUPO_A = [
  ["pq-a1", 11.25, 15.75],
  ["pq-a2", 12.75, 15.75],
  ["pq-a3", 14.25, 15.75],
] as const;
const GRUPO_B = [
  ["pq-b1", 18.75, 15.75],
  ["pq-b2", 20.25, 15.75],
  ["pq-b3", 21.75, 15.75],
] as const;

for (const c of COMBINACOES) {
  base(`q11 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      await tornarMembros(request, "jogador-1");
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const p = ms.pagina;
      await escolherTema(p, c.tema);
      await mandar(p, "personagem.criar", {
        personagem: {
          id: GOBLIN,
          pastaId: "pasta-npcs",
          editores: { tipo: "jogadores", ids: [] },
          nome: "Goblin",
          tokenPadrao: { cor: "#2e8b57", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 0 },
          ficha: { pvAtual: 7, pvMax: 7, apresentacao: "npc" },
        },
      });
      for (const [tokenId, x, y] of [...GRUPO_A, ...GRUPO_B]) {
        await mandar(p, "personagem.colocar", {
          personagemId: GOBLIN,
          cenaId: "cena-1",
          tokenId,
          x,
          y,
        });
      }
      // dois grupos com bordas diferentes; alguns feridos, um com temporários e um com a borda amarela (e selecionado)
      await mandar(p, "tokens.editar", {
        ids: GRUPO_A.map((g) => g[0]),
        mudancas: { borda: "vermelho" },
      });
      await mandar(p, "tokens.editar", { ids: ["pq-b1", "pq-b2"], mudancas: { borda: "azul" } });
      await mandar(p, "tokens.editar", { ids: ["pq-b3"], mudancas: { borda: "amarelo" } });
      await mandar(p, "tokens.vidaDelta", { ids: ["pq-a1"], delta: -3 });
      await mandar(p, "tokens.vidaDelta", { ids: ["pq-a2"], delta: -6 });
      await mandar(p, "token.vida", { id: "pq-b1", temp: 5 });
      await mandar(p, "tokens.vidaDelta", { ids: ["pq-b1"], delta: -2 });
      await mandar(p, "tokens.vidaDelta", { ids: ["pq-b2"], delta: -4 });
      await olharPara(p, 16, 13);
      await expect
        .poll(async () => (await tokens(p)).filter((t) => t.id.startsWith("pq-")).length)
        .toBe(6);
      await expect
        .poll(async () => (await tokens(p)).find((t) => t.id === "pq-b1")?.barra?.temp)
        .toBe(3);

      // 1. as bordas e as barras, com o Goblin do fim da fila B selecionado (a seleção distinta da borda amarela)
      await soSelecionarToken(p, "pq-b3");
      await olharPara(p, 16, 13);
      await foto(p, `q11-${rotulo}-1-bordas-e-barras`);

      // 2. o laço no meio do arrasto, em volta do grupo A
      const a = await pontoNaPagina(p, 9.75, 14.25);
      const b = await pontoNaPagina(p, 15.75, 18);
      await p.mouse.move(a.x, a.y);
      await p.mouse.down();
      await p.mouse.move(b.x, b.y, { steps: 12 });
      await foto(p, `q11-${rotulo}-2-laco`);
      await p.mouse.up();
      await expect.poll(async () => (await tokens(p)).filter((t) => t.selecionado).length).toBe(3);

      // 3. o menu do token com as amostras da borda (três selecionados)
      const meio = await pontoNaPagina(p, 12.75, 15.75);
      await p.mouse.click(meio.x, meio.y, { button: "right" });
      await expect(p.getByTestId("menu-token-borda-vermelho")).toBeVisible();
      await foto(p, `q11-${rotulo}-3-menu-do-token`);
      await p.keyboard.press("Escape");
      await expect(p.getByTestId("menu-token")).toHaveCount(0);

      // 4. o dano em lote: a marca diz "3 selecionados" e o campo espera -7 ou +3
      // (o Esc que fechou o menu soltou a seleção: o laço de novo)
      await olharPara(p, 16, 13);
      await p.mouse.move(a.x, a.y);
      await p.mouse.down();
      await p.mouse.move(b.x, b.y, { steps: 12 });
      await p.mouse.up();
      await expect(p.getByTestId("marca-vida-lote")).toHaveText("3 selecionados");
      await p.getByTestId("marca-vida").click();
      await p.getByTestId("marca-vida-campo").fill("-2");
      await foto(p, `q11-${rotulo}-4-vida-em-lote`);
      await p.getByTestId("marca-vida-campo").press("Enter");
      await expect
        .poll(async () => (await tokens(p)).find((t) => t.id === "pq-a3")?.barra?.fracao)
        .toBeCloseTo(5 / 7, 5);

      // 5. a vista do jogador: a barra só no token dele (o Aldric), as bordas à vista de todos
      await mandar(p, "ficha.alterar", {
        personagemId: "pers-aldric",
        operacoes: [{ caminho: "pvAtual", valor: 7 }],
      });
      const j = await entrarNoMapa(mesa, "jogador-1");
      await escolherTema(j.pagina, c.tema);
      await olharPara(j.pagina, 16, 13);
      await expect
        .poll(async () => (await tokens(j.pagina)).find((t) => t.id === "tok-jogador-1")?.barra)
        .not.toBeNull();
      await foto(j.pagina, `q11-${rotulo}-5-vista-do-jogador`);
    } finally {
      await mesa.fechar();
    }
  });
}
