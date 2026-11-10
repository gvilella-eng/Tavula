import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { assets } from "../tests/ajudasAssets";
import { abrirFicha } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do Lote 14 (compêndio de magias), em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-14

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);

const test = base.extend<{ grande: Mesa }>({
  grande: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    await use(mesa);
    await mesa.fechar();
  },
});

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(600);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

/** A barra lateral inteira (onde mora o compêndio e o chat). */
async function lateral(p: Page, nome: string) {
  await p.waitForTimeout(600);
  await p.screenshot({
    path: join(PASTA as string, `${nome}.png`),
    clip: { x: 1180, y: 0, width: 420, height: 900 },
  });
}

const porNaPasta = (p: Page, texto: string) =>
  assets(p, "adicionarNaPasta", "compendio/magias.json", texto);

test("lote 14: estados vazios, lista com busca e filtros, cartão, chat, ficha", async ({
  grande,
}) => {
  test.setTimeout(240_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");

  // 1. sem compêndio: o mestre vê como montar o JSON; o jogador, o aviso
  await abrirAba(mestre.pagina, "compendio");
  await abrirAba(j1.pagina, "compendio");
  await expect(mestre.pagina.getByTestId("compendio-exemplo")).toBeVisible();
  await expect(j1.pagina.getByTestId("compendio-vazio-jogador")).toBeVisible();
  await lateral(mestre.pagina, "01-vazio-mestre");
  await lateral(j1.pagina, "01b-vazio-jogador");

  // 2. o mestre põe o arquivo na pasta: a lista aparece para os dois
  await porNaPasta(mestre.pagina, SRD);
  await expect(mestre.pagina.getByTestId("compendio-lista")).toBeVisible();
  await expect(j1.pagina.getByTestId("compendio-lista")).toBeVisible();
  await lateral(j1.pagina, "02-lista-jogador");
  await lateral(mestre.pagina, "02b-lista-mestre");

  // 3. busca e filtros aplicados
  await j1.pagina.getByTestId("compendio-busca").fill("mag");
  await j1.pagina.getByTestId("compendio-nivel").selectOption("1");
  await j1.pagina.getByTestId("compendio-classe").selectOption("Mago");
  await expect(j1.pagina.getByTestId("compendio-item")).toHaveCount(2);
  await lateral(j1.pagina, "03-busca-e-filtros");
  await j1.pagina.getByTestId("compendio-limpar").click();
  await j1.pagina.getByTestId("compendio-concentracao").check();
  await lateral(j1.pagina, "03b-filtro-concentracao");
  await j1.pagina.getByTestId("compendio-concentracao").uncheck();

  // 4. o cartão da Bola de Fogo aberto
  await j1.pagina.getByTestId("compendio-busca").fill("bola");
  await j1.pagina.getByTestId("compendio-item").click();
  await expect(j1.pagina.getByTestId("compendio-cartao")).toBeVisible();
  await lateral(j1.pagina, "04-cartao-aberto");

  // 5. mandar para o chat como o Aldric: o cartão no chat do mestre, recolhido e aberto
  await j1.pagina.getByTestId("compendio-como").selectOption({ label: "Aldric" });
  await j1.pagina.getByTestId("compendio-chat").click();
  await expect(j1.pagina.getByTestId("compendio-aviso-acao")).toBeVisible();
  await lateral(j1.pagina, "05-cartao-apos-mandar-ao-chat");
  await abrirAba(mestre.pagina, "chat");
  const msg = mestre.pagina.locator('[data-testid="chat-mensagem"][data-tipo="magia"]');
  await expect(msg).toHaveCount(1);
  await lateral(mestre.pagina, "06-chat-recolhido");
  await msg.getByTestId("magia-chat-alternar").click();
  await expect(msg.getByTestId("magia-chat-descricao")).toBeVisible();
  await lateral(mestre.pagina, "06b-chat-aberto");

  // 6. adicionar à ficha: o mestre escolhe entre os personagens; o jogador, o dele
  await abrirAba(mestre.pagina, "compendio");
  await mestre.pagina.getByTestId("compendio-busca").fill("detectar");
  await mestre.pagina.getByTestId("compendio-item").click();
  await mestre.pagina.getByTestId("compendio-personagem").selectOption({ label: "Brisa" });
  await lateral(mestre.pagina, "07-adicionar-a-ficha-escolha-do-personagem");
  await abrirAba(j1.pagina, "compendio");
  await j1.pagina.getByTestId("compendio-voltar").click();
  await j1.pagina.getByTestId("compendio-busca").fill("detectar");
  await j1.pagina.getByTestId("compendio-item").click();
  await j1.pagina.getByTestId("compendio-ficha").click();
  await expect(j1.pagina.getByTestId("compendio-aviso-acao")).toContainText("entrou na ficha");
  await lateral(j1.pagina, "07b-adicionada-a-ficha");
  // de novo: o aviso de repetida
  await j1.pagina.getByTestId("compendio-ficha").click();
  await expect(j1.pagina.getByTestId("compendio-aviso-acao")).toContainText("já tem");
  await lateral(j1.pagina, "07c-ja-na-ficha");

  // 7. a magia na aba Magias da ficha, com a descrição montada
  const janela = await abrirFicha(j1.pagina, "pers-aldric", "magias");
  await expect(janela.getByTestId("magia-nome-0")).toHaveValue("Detectar Magia");
  await janela.getByTestId("magia-detalhes-0").click();
  await expect(janela.getByTestId("magia-descricao-0")).toBeVisible();
  await foto(j1.pagina, "08-ficha-aba-magias");
});

test("lote 14: JSON inválido (sem compêndio e com um compêndio já na mesa)", async ({ grande }) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const invalido = JSON.parse(SRD);
  invalido.magias[1].nivel = 12;
  await porNaPasta(mestre.pagina, JSON.stringify(invalido));
  await abrirAba(mestre.pagina, "compendio");
  await expect(mestre.pagina.getByTestId("compendio-erro")).toBeVisible();
  await lateral(mestre.pagina, "09-erro-json-invalido");
  await foto(mestre.pagina, "09b-erro-json-tela-inteira");

  // com um compêndio bom já na mesa, o erro aparece acima da lista e a mesa não muda
  await porNaPasta(mestre.pagina, SRD);
  await mestre.pagina.getByTestId("compendio-recarregar").click();
  await expect(mestre.pagina.getByTestId("compendio-lista")).toBeVisible();
  await porNaPasta(mestre.pagina, "{ não é json");
  await mestre.pagina.getByTestId("compendio-recarregar").click();
  await expect(mestre.pagina.getByTestId("compendio-erro")).toBeVisible();
  await expect(mestre.pagina.getByTestId("compendio-lista")).toBeVisible();
  await lateral(mestre.pagina, "10-erro-com-compendio-na-mesa");
});
