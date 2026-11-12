import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { assets } from "../tests/ajudasAssets";
import { criarDarion, DARION_ID, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V4b2 (a seção Conjuração no bloco de NPC e o nome com a capitular): Grimório em 1600×900 e 1280×720
// e Pergaminho em 1600×900. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v4b2

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const TEXTO_DO_SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);

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
  console.log(`[V4b2] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V4b2] FALHAS:\n - ${falhas.join("\n - ")}`);
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

/** O dragão da casa (SRD 5.1, CC-BY-4.0) com 4 magias do SRD para a seção Conjuração aparecer. */
const DRAGAO = {
  pvAtual: 256,
  pvMax: 256,
  apresentacao: "npc",
  alinhamento: "Caótico e Mau",
  npc: {
    tamanho: "Imenso",
    tipo: "Dragão",
    pvFormula: "19d12 + 133",
    sentidos: "visão às cegas 18 m, visão no escuro 36 m",
    imunidades: "fogo",
    nd: "17",
  },
  atributos: { for: 27, des: 10, con: 25, int: 16, sab: 13, car: 21 },
  ca: { valor: 19, nota: "armadura natural" },
  deslocamentoFt: 40,
  idiomas: ["Comum", "Dracônico"],
  habilidadeDeConjuracao: "car",
  espacosTotal: { "1": 3, "3": 2 },
  espacosGastos: { "3": 1 },
  caracteristicas: [
    {
      nome: "Resistência Lendária (3/dia)",
      descricao: "Se o dragão fracassar numa salvaguarda, ele pode escolher ser bem-sucedido.",
    },
  ],
  magias: [
    {
      nome: "Raio de Fogo",
      nivel: 0,
      preparada: true,
      escola: "Evocação",
      descricao: "Um ataque de magia à distância. Em um acerto, 2d10 de dano de fogo.",
      acerto: { tipo: "formula", atributo: "car", proficiente: true },
      dano: "2d10",
      tipo: "Fogo",
    },
    { nome: "Luz", nivel: 0, preparada: true, descricao: "O objeto tocado emite luz." },
    { nome: "Mísseis Mágicos", nivel: 1, preparada: true, descricao: "" },
    { nome: "Detectar Magia", nivel: 1, preparada: true, descricao: "" },
    { nome: "Bola de Fogo", nivel: 3, preparada: true, descricao: "", dano: "8d6", tipo: "Fogo" },
  ],
  ataques: [
    {
      nome: "Mordida",
      categoria: "acao",
      tipoDeAcao: "cac",
      alcance: "3 m",
      acerto: { tipo: "formula", atributo: "for", proficiente: true },
      dano: "2d10",
      atributoDano: "for",
      tipo: "Perfurante",
    },
    {
      nome: "Ataque de Cauda",
      categoria: "lendaria",
      tipoDeAcao: "cac",
      alcance: "4,5 m",
      acerto: { tipo: "formula", atributo: "for", proficiente: true },
      dano: "2d8",
      atributoDano: "for",
      tipo: "Contundente",
    },
  ],
};

for (const c of COMBINACOES) {
  base(`v4b2 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const rotulo = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      await assets(m, "adicionarNaPasta", "compendio/magias.json", TEXTO_DO_SRD);

      await tentar(`${rotulo} conjuracao`, async () => {
        await mandar(m, "personagem.criar", {
          personagem: {
            id: "pers-dragao",
            pastaId: "pasta-npcs",
            editores: { tipo: "jogadores", ids: [] },
            nome: "Dragão Vermelho Adulto",
            tokenPadrao: { cor: "#c0392b", tamanhoQuadrados: 3 },
            visao: { alcanceM: null, visaoNoEscuroM: 36 },
            ficha: DRAGAO,
          },
        });
        const d = await abrirPelaLista(m, "pers-dragao");
        await expect(d.getByTestId("npc-bloco")).toBeVisible();
        await foto(m, `${rotulo}-01-npc-topo-com-nome`);
        await d.getByTestId("npc-secao-conjuracao").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-02-npc-conjuracao`);
        await d.getByTestId("npc-conj-magia-4").click();
        await expect(d.getByTestId("npc-conj-corpo-4")).toBeVisible();
        await d.getByTestId("npc-conj-corpo-4").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-03-npc-magia-expandida`);
        await janelaDe(m, "pers-dragao").getByTestId("janela-ficha-fechar").click();
        await expect(janelaDe(m, "pers-dragao")).toHaveCount(0);
      });

      await tentar(`${rotulo} nome`, async () => {
        await criarDarion(m);
        const j = await abrirPelaLista(m, DARION_ID);
        const campo = j.getByTestId("ficha-nome");
        await campo.fill("Vashta Carteiro");
        await campo.press("Enter");
        await expect(campo).toHaveValue("ashta Carteiro");
        await foto(m, `${rotulo}-04-nome-do-pj-fora-de-edicao`);
        await campo.focus();
        await expect(campo).toHaveValue("Vashta Carteiro");
        await foto(m, `${rotulo}-05-nome-do-pj-em-edicao`, 300);
        await campo.press("Escape");
      });
    } finally {
      await mesa.fechar();
    }
  });
}
