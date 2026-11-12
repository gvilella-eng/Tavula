import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test as base, expect, Mesa } from "../tests/ajudas";
import { abrirFicha, criarDarion, DARION_ID, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V4a (a ficha no desenho aprovado): Personagem, Magias, com o editor, minimizada, estreita e o chat
// com rolagens (normal, vantagem e crítico). Grimório 1600×900 e 1280×720 e Pergaminho 1600×900. Fora do
// `pnpm verify`: PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v4a

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const CENARIOS = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 400) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
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
  if (falhas.length) console.log(`[V4a] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function enriquecer(p: Page) {
  await mandar(p, "ficha.alterar", {
    personagemId: DARION_ID,
    operacoes: [
      {
        caminho: "ataques.0",
        valor: {
          nome: "Lâmina Solar",
          alcance: "1,5 m · acuidade",
          acerto: { tipo: "formula", atributo: "for", proficiente: true },
          bonusMagico: 2,
          dano: "1d8",
          atributoDano: "for",
          tipo: "Radiante",
        },
      },
      { caminho: "magias.2.emAtaques", valor: true },
      { caminho: "magias.2.dano", valor: "2d8" },
      { caminho: "magias.2.tipo", valor: "Radiante" },
      {
        caminho: "magias.2.salvaguarda",
        valor: { alvo: "des", cdAtributo: "sab", sucesso: "nenhum" },
      },
      { caminho: "magias.12.emAtaques", valor: true },
      {
        caminho: "magias.12.acerto",
        valor: { tipo: "formula", atributo: "sab", proficiente: true },
      },
      { caminho: "magias.12.dano", valor: "4d6" },
      { caminho: "magias.12.tipo", valor: "Radiante" },
      { caminho: "moedas", valor: { pp: 30, po: 12 } },
      { caminho: "caracteristicas.0.origem", valor: "Classe: Patrulheiro" },
      { caminho: "caracteristicas.1.origem", valor: "Classe: Patrulheiro" },
      { caminho: "espacosGastos", valor: { "1": 1 } },
    ],
  });
}

for (const c of CENARIOS) {
  base(`ficha ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      await criarDarion(m, { editores: [] });
      await enriquecer(m);

      let janela: Locator = m.locator("body");
      await tentar(`${rotulo} personagem`, async () => {
        janela = await abrirFicha(m, DARION_ID, "principal");
        await foto(m, `${rotulo}-01-personagem`);
      });
      await tentar(`${rotulo} editor`, async () => {
        await janela.getByTestId("ataque-editar-0").click();
        await expect(janela.getByTestId("editor-ataque")).toBeVisible();
        await foto(m, `${rotulo}-02-personagem-editor`);
        await janela.getByTestId("editor-voltar").click();
      });
      await tentar(`${rotulo} magias`, async () => {
        await janela.getByTestId("ficha-aba-magias").click();
        await foto(m, `${rotulo}-03-magias`);
        await janela.getByTestId("magia-alternar-6").click();
        await janela.getByTestId("magia-editar-2").click();
        await foto(m, `${rotulo}-04-magias-editor`);
        await janela.getByTestId("editor-voltar").click();
      });
      await tentar(`${rotulo} historia`, async () => {
        await janela.getByTestId("ficha-aba-historia").click();
        await foto(m, `${rotulo}-05-historia`);
        await janela.getByTestId("ficha-aba-principal").click();
      });
      await tentar(`${rotulo} clássica`, async () => {
        await janela.getByTestId("ficha-aba-configurar").click();
        await foto(m, `${rotulo}-06-configurar`);
        await janela.getByTestId("aparencia-classica").click();
        await janela.getByTestId("ficha-aba-principal").click();
        await foto(m, `${rotulo}-07-personagem-classica`);
        await janela.getByTestId("ficha-aba-magias").click();
        await foto(m, `${rotulo}-08-magias-classica`);
        await janela.getByTestId("ficha-aba-configurar").click();
        await janela.getByTestId("aparencia-livro").click();
        await janela.getByTestId("ficha-aba-principal").click();
      });

      // o chat: normal, vantagem e crítico
      await tentar(`${rotulo} chat`, async () => {
        await janela.getByTestId("pericia-botao-percepcao").click();
        await janela.getByTestId("vantagem-vantagem").click();
        expect((await request.post("/teste/dados?semente=5")).ok()).toBe(true);
        await janela.getByTestId("pericia-botao-furtividade").click();
        await janela.getByTestId("vantagem-desvantagem").click();
        await janela.getByTestId("salvaguarda-botao-des").click();
        await janela.getByTestId("vantagem-normal").click();
        expect((await request.post("/teste/dados?semente=36")).ok()).toBe(true);
        await janela.getByTestId("ataque-nome-0").click();
        expect((await request.post("/teste/dados?semente=7")).ok()).toBe(true);
        await janela.getByTestId("ataque-rolar-1").click();
        expect((await request.post("/teste/dados")).ok()).toBe(true);
        await janela.getByTestId("ficha-aba-magias").click();
        await janela.getByTestId("magia-conjurar-2").click();
        await janela.getByTestId("ficha-aba-principal").click();
        await janela.getByTestId("caracteristica-chat-0").click();
        await foto(m, `${rotulo}-09-ficha-e-chat`);
        const caixa = m.getByTestId(`janela-${`ficha:${DARION_ID}`}`);
        await janela
          .getByTestId("janela-ficha-cabecalho")
          .dblclick({ position: { x: 150, y: 12 } });
        await expect(caixa).toHaveAttribute("data-minimizada", "true");
        await abrirChatSeNecessario(m);
        await foto(m, `${rotulo}-10-minimizada-e-chat`);
        await janela.getByTestId("janela-ficha-cabecalho").dblclick();
      });

      // estreita
      await tentar(`${rotulo} estreita`, async () => {
        const alca = (await janela.getByTestId("janela-ficha-redimensionar").boundingBox()) as {
          x: number;
          y: number;
        };
        await m.mouse.move(alca.x + 8, alca.y + 8);
        await m.mouse.down();
        await m.mouse.move(alca.x - 392, alca.y - 20, { steps: 8 });
        await m.mouse.up();
        await expect(janela.getByTestId("ficha-raiz")).toHaveAttribute("data-estreita", "true");
        await foto(m, `${rotulo}-11-estreita`);
        await janela.getByTestId("acordeao-salvaguardas-pericias-alternar").click();
        await foto(m, `${rotulo}-12-estreita-acordeao`);
        await janela.getByTestId("ficha-aba-magias").click();
        await foto(m, `${rotulo}-13-estreita-magias`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}

async function abrirChatSeNecessario(m: Page) {
  await m.getByTestId("aba-chat").click();
}
