import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V8 (ficha de NPC: fita de Conjuração, sem moldura, duas colunas): Grimório em 1600×900 e 1280×720
// e Pergaminho em 1600×900. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v8

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
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
  console.log(`[V8] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V8] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const janelaDe = (p: Page, id: string) =>
  p.locator(`[data-testid="janela-ficha"][data-personagem-id="${id}"]`);

async function abrirPelaLista(p: Page, id: string) {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${id}`).dblclick();
  return janelaDe(p, id);
}

async function alargar(p: Page, janela: Locator, px: number) {
  const alca = (await janela.getByTestId("janela-ficha-redimensionar").boundingBox()) as {
    x: number;
    y: number;
  };
  await p.mouse.move(alca.x + 8, alca.y + 8);
  await p.mouse.down();
  await p.mouse.move(alca.x + 8 + px, alca.y + 8, { steps: 8 });
  await p.mouse.up();
}

const MAGO = "pers-mago-v8";

for (const c of COMBINACOES) {
  base(`v8 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const m = (await entrarNoMapa(mesa, "mestre")).pagina;
      await escolherTema(m, c.tema);
      await mandar(m, "personagem.criar", {
        personagem: {
          id: MAGO,
          pastaId: "pasta-npcs",
          editores: { tipo: "jogadores", ids: [] },
          nome: "Mago Cinzento",
          tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 0 },
          ficha: {
            pvAtual: 40,
            pvMax: 40,
            apresentacao: "npc",
            npc: { nd: "5", tamanho: "Médio", tipo: "Humanoide", pvFormula: "9d8" },
            atributos: { for: 9, des: 14, con: 12, int: 18, sab: 12, car: 10 },
            habilidadeDeConjuracao: "int",
            espacosTotal: { "1": 4, "2": 3, "3": 2 },
            magias: [
              { nome: "Raio de Fogo", nivel: 0, preparada: true, descricao: "Ataque à distância." },
              { nome: "Luz", nivel: 0, preparada: true, descricao: "O objeto emite luz." },
              { nome: "Mísseis Mágicos", nivel: 1, preparada: true, descricao: "Dardos de força." },
              { nome: "Escudo Arcano", nivel: 1, preparada: true, descricao: "Reação: +5 na CA." },
              { nome: "Teia", nivel: 2, preparada: true, descricao: "Redes de fios." },
              {
                nome: "Bola de Fogo",
                nivel: 3,
                preparada: true,
                descricao: "Explosão.",
                dano: "8d6",
                tipo: "Fogo",
              },
            ],
          },
        },
      });

      await tentar(`${rotulo} ogro`, async () => {
        const og = await abrirPelaLista(m, "pers-ogro");
        await expect(og.getByTestId("npc-bloco")).toBeVisible();
        await foto(m, `${rotulo}-1-bestiario-estreito`);
        await og.getByTestId("npc-fita-conjuracao").click();
        await foto(m, `${rotulo}-4-conjuracao-vazia`);
        await og.getByTestId("npc-fita-bestiario").click();
        await alargar(m, og, 480);
        await foto(m, `${rotulo}-2-bestiario-largo`);
        await og.getByTestId("janela-ficha-fechar").click();
      });

      await tentar(`${rotulo} mago`, async () => {
        const mg = await abrirPelaLista(m, MAGO);
        await mg.getByTestId("npc-fita-conjuracao").click();
        await foto(m, `${rotulo}-3a-conjuracao-estreita`);
        await mg.getByTestId("npc-conj-magia-3").click();
        await alargar(m, mg, 480);
        await foto(m, `${rotulo}-3b-conjuracao-larga`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
