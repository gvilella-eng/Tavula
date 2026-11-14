import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { abrirFicha, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote N2 (conjuração completa): a fita Conjuração do NPC com a parte inata, o menu de espaço com Ritual, o
// cartão de Mísseis Mágicos com 4 dardos e o truque no nível 5. Grimório em 1600×900 e 1280×720 e Pergaminho em
// 1600×900. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints n2

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
  console.log(`[N2] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[N2] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const janelaDe = (p: Page, id: string) =>
  p.locator(`[data-testid="janela-ficha"][data-personagem-id="${id}"]`);

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

const DIABRETE = "pers-diabrete-n2p";
const ARCANISTA = "pers-arcanista-n2p";
const MAGO_NPC = "pers-mago-npc-n2p";

for (const c of COMBINACOES) {
  base(`n2 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const m = (await entrarNoMapa(mesa, "mestre")).pagina;
      await escolherTema(m, c.tema);
      await mandar(m, "personagem.criar", {
        personagem: {
          id: DIABRETE,
          pastaId: "pasta-npcs",
          editores: { tipo: "jogadores", ids: [] },
          nome: "Diabrete",
          tokenPadrao: { cor: "#c0392b", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 0 },
          ficha: {
            pvAtual: 20,
            pvMax: 20,
            apresentacao: "npc",
            npc: { nd: "3", tamanho: "Miúdo", tipo: "Ínfero" },
            atributos: { int: 12, car: 16 },
            habilidadeDeConjuracao: "int",
            espacosTotal: { "1": 2, "3": 1 },
            inata: { habilidade: "car", cd: 13, grupo: { max: 3, gastos: 1 } },
            magias: [
              { nome: "Escudo Arcano", nivel: 1, preparada: true, descricao: "Reação: +5 na CA." },
              { nome: "Luz", nivel: 0, preparada: true, descricao: "O objeto emite luz." },
              {
                nome: "Mãos Mágicas",
                nivel: 0,
                preparada: true,
                descricao: "Uma mão espectral.",
                inata: { frequencia: "vontade" },
              },
              {
                nome: "Relâmpago",
                nivel: 3,
                preparada: true,
                descricao: "Uma linha de raios.",
                dano: "8d6",
                tipo: "Elétrico",
                salvaguarda: { alvo: "des", cdAtributo: "int", sucesso: "metade" },
                inata: { frequencia: "cada", max: 1, gastos: 1 },
              },
              {
                nome: "Voo",
                nivel: 3,
                preparada: true,
                descricao: "Voa por 10 minutos.",
                inata: { frequencia: "cada", max: 3 },
              },
              {
                nome: "Invisibilidade",
                nivel: 2,
                preparada: true,
                descricao: "Some da vista.",
                inata: { frequencia: "grupo" },
              },
              {
                nome: "Escuridão",
                nivel: 2,
                preparada: true,
                descricao: "Trevas.",
                inata: { frequencia: "grupo" },
              },
            ],
          },
        },
      });
      await mandar(m, "personagem.criar", {
        personagem: {
          id: MAGO_NPC,
          pastaId: "pasta-npcs",
          editores: { tipo: "jogadores", ids: [] },
          nome: "Mago Cinzento",
          tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 0 },
          ficha: {
            pvAtual: 40,
            pvMax: 40,
            apresentacao: "npc",
            npc: { nd: "5", tamanho: "Médio", tipo: "Humanoide" },
            atributos: { int: 18 },
            habilidadeDeConjuracao: "int",
            magias: [
              {
                nome: "Raio de Fogo",
                nivel: 0,
                preparada: true,
                descricao: "Um ataque de magia à distância.",
                acerto: { tipo: "formula", atributo: "int", proficiente: true },
                dano: "1d10",
                tipo: "Fogo",
                dadosPorNivel: [
                  { nivel: 5, expressao: "1d10" },
                  { nivel: 11, expressao: "2d10" },
                  { nivel: 17, expressao: "3d10" },
                ],
              },
            ],
          },
        },
      });
      await mandar(m, "personagem.criar", {
        personagem: {
          id: ARCANISTA,
          pastaId: "pasta-personagens",
          editores: { tipo: "jogadores", ids: ["jogador-1"] },
          nome: "Vessa",
          tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 18 },
          ficha: {
            pvAtual: 20,
            pvMax: 20,
            atributos: { int: 16 },
            habilidadeDeConjuracao: "int",
            espacosTotal: { "1": 3, "2": 2 },
            magias: [
              {
                nome: "Detectar Magia",
                nivel: 1,
                preparada: true,
                descricao: "Você sente a presença de magia.",
                ritual: true,
              },
              {
                nome: "Mísseis Mágicos",
                nivel: 1,
                preparada: true,
                descricao: "Dardos de força.",
                dano: "1d4+1",
                tipo: "Energia",
                porNivelAcima: "1 dardo",
                quantidadeBase: 3,
              },
            ],
          },
        },
      });

      await tentar(`${rotulo} fita inata`, async () => {
        await abrirAba(m, "fichas");
        await m.getByTestId(`ficha-abrir-${DIABRETE}`).dblclick();
        const j = janelaDe(m, DIABRETE);
        await j.getByTestId("npc-fita-conjuracao").click();
        await j.getByTestId("npc-inata-magia-3").click();
        await foto(m, `${rotulo}-1-fita-conjuracao-inata`);
        await alargar(m, j, 480);
        await foto(m, `${rotulo}-1b-fita-conjuracao-inata-larga`);
        await j.getByTestId("janela-ficha-fechar").click();
      });

      await tentar(`${rotulo} truque nivel 5`, async () => {
        await abrirAba(m, "fichas");
        await m.getByTestId(`ficha-abrir-${MAGO_NPC}`).dblclick();
        const j = janelaDe(m, MAGO_NPC);
        await j.getByTestId("npc-fita-conjuracao").click();
        await j.getByTestId("npc-conj-magia-0").click();
        await j.getByTestId("npc-conj-conjurar-0").click();
        await abrirAba(m, "chat");
        await expect(m.getByTestId("modelo-dano-formula")).toHaveCount(1);
        await foto(m, `${rotulo}-4-truque-nivel-5`);
        await j.getByTestId("janela-ficha-fechar").click();
      });

      await tentar(`${rotulo} ritual e dardos`, async () => {
        const j = await abrirFicha(m, ARCANISTA, "magias");
        await j.getByTestId("magia-conjurar-0").click();
        await expect(m.getByTestId("menu-espaco-ritual")).toBeVisible();
        await foto(m, `${rotulo}-2-menu-ritual`);
        await m.getByTestId("menu-espaco-ritual").click();
        await j.getByTestId("magia-conjurar-1").click();
        await m.getByTestId("menu-espaco-2").click();
        await abrirAba(m, "chat");
        await expect(m.getByTestId("bloco-quantidade")).toHaveCount(1);
        await foto(m, `${rotulo}-3-misseis-4-dardos`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
