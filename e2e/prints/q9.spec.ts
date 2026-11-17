import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { abrirFicha, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote Q9 (a Conjuração do NPC com a interface da aba Magias): Grimório em 1600×900 e 1280×720 e
// Pergaminho em 1600×900. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints q9

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
  console.log(`[Q9] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[Q9] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.evaluate((t) => localStorage.setItem("tabletop:pref:tema", t), tema);
  await p.reload();
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
}

const janelaDe = (p: Page, id: string) =>
  p.locator(`[data-testid="janela-ficha"][data-personagem-id="${id}"]`);

const MAGIAS = [
  { nome: "Raio de Fogo", nivel: 0, preparada: true, descricao: "Um ataque de magia à distância." },
  { nome: "Luz", nivel: 0, preparada: true, descricao: "O objeto tocado emite luz." },
  {
    nome: "Mísseis Mágicos",
    nivel: 1,
    preparada: true,
    descricao: "Três dardos de força, cada um com 1d4+1 de dano.",
  },
  { nome: "Escudo", nivel: 1, preparada: true, descricao: "Uma barreira invisível." },
  { nome: "Invisibilidade", nivel: 2, preparada: true, descricao: "A criatura some da vista." },
  {
    nome: "Bola de Fogo",
    nivel: 3,
    preparada: true,
    descricao: "Explosão de chamas.",
    dano: "8d6",
    tipo: "Fogo",
    salvaguarda: { alvo: "des", cdAtributo: "int", sucesso: "metade" },
  },
  {
    nome: "Detectar Magia",
    nivel: 1,
    preparada: true,
    descricao: "",
    inata: { frequencia: "vontade" },
  },
  {
    nome: "Relâmpago",
    nivel: 3,
    preparada: true,
    descricao: "Uma linha de raios.",
    inata: { frequencia: "cada", max: 1 },
  },
];

const BASE = {
  pvAtual: 40,
  pvMax: 40,
  atributos: { for: 9, des: 14, con: 12, int: 18, sab: 12, car: 10 },
  habilidadeDeConjuracao: "int",
  espacosTotal: { "1": 4, "2": 3, "3": 2 },
  espacosGastos: { "1": 1 },
  inata: { habilidade: "int", cd: 15 },
  magias: MAGIAS,
};

for (const c of COMBINACOES) {
  base(`q9 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const rotulo = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);

      await tentar(`${rotulo} npc`, async () => {
        await mandar(m, "personagem.criar", {
          personagem: {
            id: "pers-mago-npc",
            pastaId: "pasta-npcs",
            editores: { tipo: "jogadores", ids: [] },
            nome: "Mago Cinzento",
            tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
            visao: { alcanceM: null, visaoNoEscuroM: 0 },
            ficha: {
              ...BASE,
              apresentacao: "npc",
              npc: { nd: "5", tamanho: "Médio", tipo: "Humanoide" },
            },
          },
        });
        await abrirAba(m, "fichas");
        await m.getByTestId("ficha-abrir-pers-mago-npc").dblclick();
        const j = janelaDe(m, "pers-mago-npc");
        await j.getByTestId("npc-fita-conjuracao").click();
        await expect(j.getByTestId("npc-secao-conjuracao")).toBeVisible();
        await foto(m, `${rotulo}-01-npc-conjuracao`);
        await j.getByTestId("npc-conj-magia-2").click();
        await expect(j.getByTestId("npc-conj-corpo-2")).toBeVisible();
        await j.getByTestId("npc-conj-corpo-2").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-02-npc-magia-expandida`);
        await j.getByTestId("janela-ficha-fechar").click();
        await expect(j).toHaveCount(0);
      });

      await tentar(`${rotulo} personagem`, async () => {
        await mandar(m, "personagem.criar", {
          personagem: {
            id: "pers-mago-pj",
            pastaId: "pasta-personagens",
            editores: { tipo: "jogadores", ids: [] },
            nome: "Mago Cinzento",
            tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
            visao: { alcanceM: null, visaoNoEscuroM: 0 },
            ficha: { ...BASE, apresentacao: "personagem", classes: [{ classe: "Mago", nivel: 5 }] },
          },
        });
        await abrirFicha(m, "pers-mago-pj", "magias");
        await expect(janelaDe(m, "pers-mago-pj").getByTestId("fh-aba-magias")).toBeVisible();
        await foto(m, `${rotulo}-03-personagem-magias`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
