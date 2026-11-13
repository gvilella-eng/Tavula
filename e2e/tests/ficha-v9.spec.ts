import type { Page } from "@playwright/test";
import { abrirAba, CAMINHO_DA_MESA, expect, test } from "./ajudas";
import { abrirFicha, criarDarion, DARION_ID } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// V9: a ficha numa janela própria do navegador (`/m/<mesa>/ficha/<ficha>`), com a própria conexão com a sala, sem criar
// presença nova, e a janela principal sabendo quais fichas estão fora.

const CAMINHO_DA_FICHA = `${CAMINHO_DA_MESA}/ficha/${DARION_ID}`;
const marcaFora = (p: Page) => p.getByTestId(`ficha-fora-${DARION_ID}`);
const janelaNaMesa = (p: Page) =>
  p.locator(`[data-testid="janela-ficha"][data-personagem-id="${DARION_ID}"]`);

/** Quantas pessoas aparecem no topo (uma bolinha por pessoa, nunca por conexão). */
const bolinhas = (p: Page) => p.getByTestId("topo").locator('[data-testid^="presenca-estado-"]');

test("o ícone abre a ficha numa janela própria: edita, rola no chat da mesa, sai da pilha e volta ao fechar", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);
  const p = j1.pagina;
  const janela = await abrirFicha(p, DARION_ID, "principal");

  // o ícone mora no cabeçalho, antes do minimizar, e some com a ficha minimizada
  const icone = janela.getByTestId("ficha-abrir-em-janela");
  await expect(icone).toBeVisible();
  const minimizar = p.getByTestId(`janela-ficha:${DARION_ID}-minimizar`);
  await minimizar.click();
  await expect(icone).toHaveCount(0);
  await minimizar.click();
  await expect(icone).toBeVisible();

  await expect(bolinhas(p)).toHaveCount(2);
  const [popup] = await Promise.all([j1.contexto.waitForEvent("page"), icone.click()]);

  // a janela mostra só a ficha, com o nome na aba do navegador
  await expect(popup.getByTestId("ficha-propria")).toBeVisible();
  await expect(popup.getByTestId("janela-ficha-nome")).toHaveText("Darion");
  await expect(popup).toHaveTitle("Darion — Távola");
  await expect(popup).toHaveURL(new RegExp(`${CAMINHO_DA_FICHA}$`));
  await expect(popup.getByTestId("topo")).toHaveCount(0);
  await expect(popup.getByTestId("mapa")).toHaveCount(0);
  await expect(popup.getByTestId("barra-lateral")).toHaveCount(0);
  await expect(popup.getByTestId("ficha-abrir-em-janela")).toHaveCount(0);
  await expect(popup.getByTestId("ficha-voltar-para-mesa")).toBeVisible();
  await expect(popup.getByTestId(`pv-atual-${DARION_ID}`)).toHaveValue("97");
  const caixaDaFicha = await popup.getByTestId("ficha-propria").boundingBox();
  const tela = popup.viewportSize();
  expect(caixaDaFicha?.height).toBeCloseTo(tela?.height ?? 0, -1);

  // a principal tira a ficha da pilha e marca na lista; a presença não duplica
  await expect(janelaNaMesa(p)).toHaveCount(0);
  await abrirAba(p, "fichas");
  await expect(marcaFora(p)).toBeVisible();
  await expect(marcaFora(p)).toHaveText("em outra janela");
  await expect(bolinhas(p)).toHaveCount(2);
  await expect(bolinhas(mestre.pagina)).toHaveCount(2);

  // mudar o PV na janela própria chega à sala e a quem olha (o mestre)
  await popup.getByTestId(`pv-atual-${DARION_ID}`).fill("50");
  await abrirAba(mestre.pagina, "fichas");
  await expect(mestre.pagina.getByTestId(`ficha-item-${DARION_ID}`)).toContainText("50/");
  await expect(p.getByTestId(`ficha-item-${DARION_ID}`)).toContainText("50/");

  // uma rolagem feita nela aparece no chat da principal
  await popup.getByTestId("pericia-total-percepcao").click();
  await abrirAba(p, "chat");
  await expect(p.getByTestId("modelo-teste").filter({ hasText: "Percepção" })).toBeVisible();

  // clicar no item da lista (ou no "Fichas") só traz a janela de fora: não abre outra na mesa nem outra janela
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${DARION_ID}`).click();
  await expect(janelaNaMesa(p)).toHaveCount(0);
  expect(j1.contexto.pages()).toHaveLength(2);

  // fechar a janela devolve a ficha à pilha da principal
  await popup.close();
  await expect(marcaFora(p)).toHaveCount(0);
  await expect(janelaNaMesa(p)).toBeVisible();
  await expect(bolinhas(p)).toHaveCount(2);

  // de novo, e agora pelo "Voltar para a mesa"
  const [segunda] = await Promise.all([
    j1.contexto.waitForEvent("page"),
    janelaNaMesa(p).getByTestId("ficha-abrir-em-janela").click(),
  ]);
  await expect(segunda.getByTestId("ficha-propria")).toBeVisible();
  await expect(janelaNaMesa(p)).toHaveCount(0);
  const fechou = segunda.waitForEvent("close");
  await segunda.getByTestId("ficha-voltar-para-mesa").click();
  await fechou;
  await expect(janelaNaMesa(p)).toBeVisible();
  await expect(marcaFora(p)).toHaveCount(0);
});

test("recarregar a principal com a janela da ficha aberta mantém a ficha fora", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);
  const p = j1.pagina;
  const janela = await abrirFicha(p, DARION_ID, "principal");
  const [popup] = await Promise.all([
    j1.contexto.waitForEvent("page"),
    janela.getByTestId("ficha-abrir-em-janela").click(),
  ]);
  await expect(popup.getByTestId("ficha-propria")).toBeVisible();

  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await abrirAba(p, "fichas");
  await expect(marcaFora(p)).toBeVisible();
  await expect(janelaNaMesa(p)).toHaveCount(0);
  // a janela continua viva e ligada à sala
  await expect(popup.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(bolinhas(p)).toHaveCount(2);

  // fechar a janela tira a marca (a principal recarregada não tinha a ficha aberta: ela só deixa de estar fora)
  await popup.close();
  await expect(marcaFora(p)).toHaveCount(0);
});

test("o mestre também abre a ficha em janela própria, e o descanso avisa na própria janela", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarion(mestre.pagina);
  const m = mestre.pagina;
  const janela = await abrirFicha(m, DARION_ID, "principal");
  const [popup] = await Promise.all([
    mestre.contexto.waitForEvent("page"),
    janela.getByTestId("ficha-abrir-em-janela").click(),
  ]);
  await expect(popup.getByTestId("ficha-propria")).toBeVisible();
  await expect(popup.getByTestId("descanso-curto")).toBeVisible();
  // um descanso feito na janela própria avisa ali mesmo (toast da própria janela)
  await popup.getByTestId("descanso-curto").click();
  await popup.getByTestId("descanso-confirmar-sim").click();
  await expect(popup.getByTestId("aviso")).toBeVisible();
  // o mestre continua com uma bolinha só
  await expect(bolinhas(m)).toHaveCount(1);
});

test("pop-up bloqueado: o aviso explica como liberar", async ({ mesa }) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarion(mestre.pagina);
  const m = mestre.pagina;
  const janela = await abrirFicha(m, DARION_ID, "principal");
  await m.evaluate(() => {
    window.open = () => null;
  });
  await janela.getByTestId("ficha-abrir-em-janela").click();
  await expect(m.getByTestId("aviso")).toHaveText(
    "O navegador bloqueou a janela. Libere as janelas pop-up para este endereço.",
  );
  // nada foi tirado da pilha
  await expect(janelaNaMesa(m)).toBeVisible();
});

test("a rota direta da ficha, sem sessão, mostra a entrada e depois a ficha; ficha que não existe mais avisa e deixa fechar", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarion(mestre.pagina);

  const sessao = await mesa.abrir();
  const p = sessao.pagina;
  await p.goto(CAMINHO_DA_FICHA);
  await expect(p.getByTestId("entrar-mestre")).toBeVisible();
  await expect(p.getByTestId("ficha-propria")).toHaveCount(0);
  await p.getByTestId("entrar-mestre").click();
  await expect(p.getByTestId("ficha-propria")).toBeVisible();
  await expect(p.getByTestId("janela-ficha-nome")).toHaveText("Darion");
  await expect(p).toHaveTitle("Darion — Távola");
  // é uma conexão a mais do mesmo usuário: o topo da mesa continua com uma bolinha para ele
  await expect(bolinhas(mestre.pagina)).toHaveCount(1);

  // a ficha apagada
  await p.goto(`${CAMINHO_DA_MESA}/ficha/pers-que-nao-existe`);
  await expect(p.getByTestId("ficha-propria-sumiu")).toBeVisible();
  await expect(p.getByTestId("ficha-propria-fechar")).toBeVisible();
});
