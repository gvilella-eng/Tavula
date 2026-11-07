import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do Lote 8 (dados e chat), em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-8
// Os dados saem da sala com semente fixa (gancho /teste/dados, só no MODO=teste), para os prints
// mostrarem sempre o mesmo: 36 = 20 natural, 7 = 1 natural, 602 = vantagem com 3 e 16, 1 = d20 médio.

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

const SEMENTE = { nat20: 36, nat1: 7, vantagem: 602, medio: 1 };

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

async function semente(request: APIRequestContext, n: number) {
  const r = await request.post(`/teste/dados?semente=${n}`);
  expect(r.ok()).toBe(true);
}

async function dizer(p: Page, texto: string) {
  const antes = await p.getByTestId("chat-mensagem").count();
  await p.getByTestId("chat-texto").fill(texto);
  await p.getByTestId("chat-texto").press("Enter");
  await expect(p.getByTestId("chat-mensagem")).toHaveCount(antes + 1);
}

async function como(p: Page, nome: string) {
  await p.getByTestId("chat-como").selectOption({ label: nome });
}

test("1 a 3: conversa com rolagens (vantagem com dado riscado, 20 e 1 naturais) e o 'Como:'", async ({
  grande,
  request,
}) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");
  const j2 = await entrarNoMapa(grande, "jogador-2");

  await como(mestre.pagina, "Ogro");
  await dizer(mestre.pagina, "/em bloqueia a passagem, rosnando");
  await como(mestre.pagina, "Mestre (eu mesmo)");
  await dizer(mestre.pagina, "Uma porta de ferro, trancada. Quem tenta abrir?");
  await como(j1.pagina, "Aldric");
  await dizer(j1.pagina, "Eu encosto o ouvido na porta: [[1d20+3]] de Percepção.");
  await como(j2.pagina, "Brisa");
  await dizer(j2.pagina, "/em prepara o arco");

  await semente(request, SEMENTE.vantagem);
  await dizer(j1.pagina, "/r 2d20kh1+5 Percepção com vantagem");
  await semente(request, SEMENTE.nat20);
  await dizer(j1.pagina, "/r 1d20+5 Atletismo para arrombar");
  await semente(request, SEMENTE.nat1);
  await dizer(j2.pagina, "/r 1d20+3 Acrobacia");
  await semente(request, SEMENTE.medio);
  await dizer(j2.pagina, "Vou de [[2d6+3]] de dano com a adaga.");

  // 01: o chat do Aldric (jogador), com a presença no topo e a caixa fixa no rodapé
  await foto(j1.pagina, "01-chat-com-conversa-e-rolagens");
  // 02: passando o mouse na vantagem: os dois d20, o descartado riscado
  const cartoes = j1.pagina.locator('[data-testid="chat-mensagem"][data-tipo="rolagem"]');
  const vantagem = cartoes
    .filter({ hasText: "Percepção com vantagem" })
    .getByTestId("cartao-rolagem");
  await vantagem.hover();
  await expect(vantagem.getByTestId("rolagem-detalhe")).toBeVisible();
  await foto(j1.pagina, "02-vantagem-com-o-dado-descartado-riscado");
  // 03: 20 natural (dourado) e 1 natural (vermelho), e os dados do 20 ao passar o mouse
  const nat20 = j1.pagina.locator('[data-natural="20"]').first();
  await nat20.hover();
  await foto(j1.pagina, "03-vinte-natural-e-um-natural");
  // 03b: o outro lado: o chat da Brisa (mesma conversa)
  await foto(j2.pagina, "03b-chat-da-brisa-como-personagem");
  // o retrato/nome do personagem na mensagem
  await expect(
    j2.pagina.getByTestId("chat-autor").filter({ hasText: "Aldric" }).first(),
  ).toBeVisible();
});

test("4 e 5: modelo de ataque com crítico e teste com CD (sucesso e falha)", async ({
  grande,
  request,
}) => {
  const j1 = await entrarNoMapa(grande, "jogador-1");
  const p = j1.pagina;
  await como(p, "Aldric");
  await p.getByTestId("chat-modelos-abrir").click();
  await p.getByTestId("modelo-nome").fill("Espada longa");
  await p.getByTestId("modelo-bonus").fill("5");
  await p.getByTestId("modelo-dano").fill("1d8+3");
  await semente(request, SEMENTE.nat20);
  await p.getByTestId("modelo-rolar").click();
  await expect(p.getByTestId("modelo-ataque")).toBeVisible();
  await p.getByTestId("modelo-ataque").getByTestId("cartao-rolagem").nth(1).hover();
  await foto(p, "04-ataque-com-critico-dano-dobrado");

  await p.getByTestId("modelo-tipo").selectOption("teste");
  await p.getByTestId("modelo-nome").fill("Furtividade");
  await p.getByTestId("modelo-bonus").fill("5");
  await p.getByTestId("modelo-cd").fill("25");
  await semente(request, SEMENTE.medio);
  await p.getByTestId("modelo-rolar").click();
  await p.getByTestId("modelo-cd").fill("12");
  await semente(request, SEMENTE.medio);
  await p.getByTestId("modelo-rolar").click();
  await p.getByTestId("modelo-vantagem").selectOption("desvantagem");
  await p.getByTestId("modelo-cd").fill("");
  await p.getByTestId("modelo-nome").fill("Percepção");
  await semente(request, SEMENTE.vantagem);
  await p.getByTestId("modelo-rolar").click();
  await expect(p.getByTestId("modelo-teste")).toHaveCount(3);
  await p.mouse.move(5, 5);
  await foto(p, "05-teste-com-cd-falha-sucesso-e-teste-simples-com-desvantagem");
});

test("6 e 7: sussurro (quem recebe e um terceiro) e rolagem oculta (mestre × jogador)", async ({
  grande,
  request,
}) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");
  const j2 = await entrarNoMapa(grande, "jogador-2");
  const j3 = await entrarNoMapa(grande, "jogador-3");

  await dizer(mestre.pagina, "Vocês chegam à ponte velha.");
  await dizer(j1.pagina, "/w Jogador 2 Não confio no guia. Fique de olho nele.");
  await dizer(j2.pagina, "/w Jogador 1 Também notei. Combinado.");
  await dizer(j3.pagina, "Vamos em fila, então.");
  await semente(request, SEMENTE.medio);
  await dizer(mestre.pagina, "/gr 1d20+7 Percepção do guia, escondida");
  await dizer(mestre.pagina, "/w Jogador 3 Você sente um cheiro de fumaça.");

  await foto(j2.pagina, "06-sussurro-visto-por-quem-recebe");
  await foto(j3.pagina, "06b-sussurro-visto-por-um-terceiro-nada-vaza");
  await foto(mestre.pagina, "07-rolagem-oculta-vista-pelo-mestre");
  await foto(j1.pagina, "07b-rolagem-oculta-vista-pelo-jogador-nada-aparece");
  await expect(j3.pagina.getByTestId("chat-mensagem")).toHaveCount(3);
});

test("8 e 9: dados rápidos abertos e o selo de não lidas", async ({ grande, request }) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");
  const p = j1.pagina;

  await dizer(mestre.pagina, "Rolem iniciativa!");
  await semente(request, SEMENTE.nat20);
  await p.getByTestId("ferramenta-dados").click();
  await expect(p.getByTestId("dados-rapidos")).toBeVisible();
  await foto(p, "08-dados-rapidos-abertos");
  await p.getByTestId("dado-D20").click();
  await expect(p.getByTestId("chat-mensagem")).toHaveCount(2);
  await foto(p, "08b-resultado-do-dado-rapido-no-chat");

  // o selo: o Aldric olha as Fichas e o mestre fala
  await abrirAba(p, "fichas");
  await dizer(mestre.pagina, "Alguém ouviu isso?");
  await dizer(mestre.pagina, "Silêncio...");
  await expect(p.getByTestId("selo-chat")).toHaveText("2");
  await foto(p, "09-selo-de-nao-lidas-no-icone-do-chat");
});
