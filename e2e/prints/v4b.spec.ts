import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { assets } from "../tests/ajudasAssets";
import { mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V4b (ficha de NPC no desenho N, arrastar do compêndio e segurar para reordenar), nos temas Grimório
// e Pergaminho: Grimório em 1600×900 e 1280×720, Pergaminho em 1600×900. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v4b

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
  console.log(`[V4b] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V4b] FALHAS:\n - ${falhas.join("\n - ")}`);
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

async function fechar(p: Page, id: string) {
  await janelaDe(p, id).getByTestId("janela-ficha-fechar").click();
  await expect(janelaDe(p, id)).toHaveCount(0);
}

const centro = async (l: Locator) => {
  const b = (await l.boundingBox()) as { x: number; y: number; width: number; height: number };
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
};

/** O dragão da casa: SRD 5.1 (CC-BY-4.0), com uma reação a mais para o print. */
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
  salvaguardas: {
    des: { nivel: "proficiente" },
    con: { nivel: "proficiente" },
    sab: { nivel: "proficiente" },
    car: { nivel: "proficiente" },
  },
  pericias: { percepcao: { nivel: "proficiente" }, furtividade: { nivel: "proficiente" } },
  idiomas: ["Comum", "Dracônico"],
  caracteristicas: [
    {
      nome: "Resistência Lendária (3/dia)",
      descricao: "Se o dragão fracassar numa salvaguarda, ele pode escolher ser bem-sucedido.",
    },
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
      dano2: { dados: "2d6", tipo: "Fogo" },
    },
    {
      nome: "Garra",
      categoria: "acao",
      tipoDeAcao: "cac",
      alcance: "1,5 m",
      acerto: { tipo: "formula", atributo: "for", proficiente: true },
      dano: "2d6",
      atributoDano: "for",
      tipo: "Cortante",
    },
    {
      nome: "Sopro de Fogo",
      categoria: "acao",
      tipoDeAcao: "esp",
      alcance: "18 m",
      recarga: 5,
      dano: "18d6",
      tipo: "Fogo",
      salvaguarda: { alvo: "des", cdAtributo: "con", sucesso: "metade" },
    },
    {
      nome: "Redirecionar Ataque",
      categoria: "reacao",
      tipoDeAcao: "esp",
      descricao:
        "Quando uma criatura que o dragão possa ver o atacar, ele escolhe outra criatura a até 1,5 m dele para receber o ataque no lugar.",
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
    {
      nome: "Ataque de Asa (custa 2 ações)",
      categoria: "lendaria",
      tipoDeAcao: "esp",
      descricao: "O dragão bate as asas. Criaturas a até 3 m fazem salvaguarda de Destreza CD 21.",
    },
  ],
};

for (const c of COMBINACOES) {
  base(`v4b ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const rotulo = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);

      // o Ogro: o topo e as ações; uma ação expandida; o editor na própria linha; a rolagem no chat
      await tentar(`${rotulo} ogro`, async () => {
        const ogro = await abrirPelaLista(m, "pers-ogro");
        await expect(ogro.getByTestId("npc-bloco")).toBeVisible();
        await foto(m, `${rotulo}-01-ogro-topo`);
        await ogro.getByTestId("npc-secao-acao").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-01b-ogro-acoes`);
        await ogro.getByTestId("npc-acao-titulo-0").click();
        await foto(m, `${rotulo}-02-ogro-acao-expandida`);
        await ogro.getByTestId("npc-acao-titulo-0").click();
        await ogro.getByTestId("npc-acao-editar-1").click();
        await ogro.getByTestId("npc-acao-1").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-03-ogro-editor-na-linha`);
        await ogro.getByTestId("editor-voltar").click();
        await ogro.getByTestId("npc-acao-acerto-0").click();
        await ogro.getByTestId("npc-acao-dano-1").click();
        await abrirAba(m, "chat");
        await expect(m.getByTestId("modelo-ataque").first()).toBeVisible();
        await foto(m, `${rotulo}-09-rolagem-da-acao-no-chat`);
      });

      // a linha levantada com o indicador (ainda no Ogro)
      await tentar(`${rotulo} levantada`, async () => {
        const ogro = janelaDe(m, "pers-ogro");
        const origem = ogro.getByTestId("npc-acao-titulo-1");
        await origem.scrollIntoViewIfNeeded();
        const o = await centro(origem);
        const alto = (await ogro.getByTestId("npc-acao-0").boundingBox()) as { y: number };
        await m.mouse.move(o.x, o.y);
        await m.mouse.down();
        await expect(ogro.getByTestId("npc-acao-1")).toHaveAttribute("data-levantada", "true");
        await m.mouse.move(o.x, alto.y + 6, { steps: 8 });
        await foto(m, `${rotulo}-07-linha-levantada`, 300);
        await m.keyboard.press("Escape");
        await m.mouse.up();
        await fechar(m, "pers-ogro");
      });

      // o NPC com Reações e Lendárias, minimizado e de volta
      await tentar(`${rotulo} dragao`, async () => {
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
        await foto(m, `${rotulo}-04a-dragao-topo`);
        await d.getByTestId("npc-secao-lendaria").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-04b-dragao-reacoes-e-lendarias`);
        await d.getByTestId("janela-ficha-cabecalho").dblclick({ position: { x: 150, y: 12 } });
        await expect(m.getByTestId("janela-ficha:pers-dragao")).toHaveAttribute(
          "data-minimizada",
          "true",
        );
        await foto(m, `${rotulo}-05-npc-minimizado`);
        await d.getByTestId("janela-ficha-cabecalho").dblclick();
        await expect(m.getByTestId("janela-ficha:pers-dragao")).toHaveAttribute(
          "data-minimizada",
          "false",
        );
        await fechar(m, "pers-dragao");
      });

      // arrastar do compêndio para o personagem: as áreas acesas e o resultado
      await tentar(`${rotulo} arrasto`, async () => {
        await mandar(m, "personagem.criar", {
          personagem: {
            id: "pers-mago",
            pastaId: "pasta-personagens",
            editores: { tipo: "jogadores", ids: ["jogador-1"] },
            nome: "Mago",
            tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
            visao: { alcanceM: null, visaoNoEscuroM: 0 },
            ficha: {
              pvAtual: 20,
              pvMax: 20,
              apresentacao: "personagem",
              classes: [{ classe: "Mago", nivel: 5 }],
              atributos: { for: 16, des: 14, con: 12, int: 18, sab: 10, car: 8 },
              itens: [
                { nome: "Mochila", quantidade: 1 },
                { nome: "Pedra", quantidade: 1 },
              ],
              ataques: [{ nome: "Adaga", dano: "1d4", tipo: "Perfurante" }],
            },
          },
        });
        await abrirAba(m, "fichas");
        await m.getByTestId("ficha-abrir-pers-mago").dblclick();
        const j = janelaDe(m, "pers-mago");
        await expect(j.getByTestId("fh-ataques")).toBeVisible();
        await assets(m, "adicionarNaPasta", "compendio/magias.json", TEXTO_DO_SRD);
        await abrirAba(m, "compendio");
        await expect(m.getByTestId("compendio-lista")).toBeVisible();
        await m.getByTestId("compendio-secao-armas").click();
        const espada = m.locator(
          '[data-testid="compendio-entrada-arma"][data-nome="Espada longa"]',
        );
        await expect(espada).toBeVisible();
        const alvo = j.getByTestId("ataque-nome-0");
        await alvo.scrollIntoViewIfNeeded();
        const o = await centro(espada);
        const a = await centro(alvo);
        await m.mouse.move(o.x, o.y);
        await m.mouse.down();
        await m.mouse.move(o.x - 12, o.y + 12, { steps: 4 });
        await m.mouse.move(a.x, a.b.y + 4, { steps: 14 });
        await m.mouse.move(a.x + 1, a.b.y + 4, { steps: 2 });
        await expect(j.getByTestId("fh-ataques")).toHaveAttribute("data-aceita-soltar", "true");
        await foto(m, `${rotulo}-06-arrasto-com-as-areas-acesas`, 300);
        await m.mouse.up();
        await expect(j.getByTestId("ataque-nome-0")).toContainText("Espada longa");
        await foto(m, `${rotulo}-08-arma-solta-no-personagem`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
