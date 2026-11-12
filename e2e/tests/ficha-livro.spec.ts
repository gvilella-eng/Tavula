import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import {
  abrirFicha,
  clicarImportarPdf,
  criarDarion,
  criarPastaDoGrupo,
  DARION_ID,
  ligarVerOutras,
  mandar,
} from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// V4a: a ficha de personagem no desenho aprovado (docs/desenho/): editor da engrenagem, conjurar, moedas, equipamento,
// característica no chat, minimizar, aparência Livro/Clássica, janela estreita e o crítico verde.

const PDF_DO_DARION = fileURLToPath(
  new URL("../../fixtures/fichas/darion.pdf", import.meta.url),
);
const SEMENTE_20_NATURAL = 36;

async function recarregar(p: Page) {
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
}

test("o editor da engrenagem: cria um ataque, muda o bônus mágico e a prévia acompanha; rola e remove", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);
  const janela = await abrirFicha(j1.pagina, DARION_ID, "principal");

  await janela.getByTestId("ataque-adicionar").click();
  const editor = janela.getByTestId("editor-ataque");
  await expect(editor).toBeVisible();
  // Força 25 (+7), proficiência +4: +11 para acertar; dano 1d6 + Força
  await expect(janela.getByTestId("previa-acerto")).toHaveText("+11 para acertar");
  await expect(janela.getByTestId("previa-dano")).toContainText("1d6+7 cortante");
  await janela.getByTestId("editor-magico").fill("2");
  await expect(janela.getByTestId("previa-acerto")).toHaveText("+13 para acertar");
  await expect(janela.getByTestId("previa-dano")).toContainText("1d6+9");
  await expect(janela.getByTestId("previa-dano")).toContainText("crítico 2d6+9");
  // segundo dano e salvaguarda entram na prévia
  await janela.getByTestId("editor-usa-salvaguarda").check();
  await expect(janela.getByTestId("previa-salvaguarda")).toContainText("CD");
  await janela.getByTestId("editor-nome").fill("Lâmina Solar");

  // rolar pelo editor manda o ataque ao chat de todos
  await janela.getByTestId("editor-rolar").click();
  await abrirAba(mestre.pagina, "chat");
  const cartao = mestre.pagina.getByTestId("modelo-ataque").filter({ hasText: "Lâmina Solar" });
  await expect(cartao).toBeVisible();
  await expect(cartao).toContainText("Ataque · Lâmina Solar");
  await expect(cartao.getByTestId("modelo-cd")).toBeVisible();

  // voltar: a linha está na lista, com os botões de acerto e dano
  await janela.getByTestId("editor-voltar").click();
  await expect(janela.getByTestId("editor-ataque")).toHaveCount(0);
  const n = 20; // a fixture tem 20 ataques
  await expect(janela.getByTestId(`ataque-nome-${n}`)).toContainText("Lâmina Solar");
  await expect(janela.getByTestId(`ataque-rolar-${n}`)).toHaveText("+13");

  // reabrir pela engrenagem e remover
  await janela.getByTestId(`ataque-editar-${n}`).click();
  await janela.getByTestId("editor-remover").click();
  await expect(janela.getByTestId(`ataque-${n}`)).toHaveCount(0);
});

test("conjurar gasta o espaço e a bolinha do espaço mostra o que sobrou; a magia pode ir para Ataques e magias", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);
  const janela = await abrirFicha(j1.pagina, DARION_ID, "magias");

  await expect(janela.getByTestId("espacos-resumo-1")).toHaveText("4/4");
  // Hunter's Mark (1º nível) é a magia 6 da fixture
  await janela.getByTestId("magia-conjurar-6").click();
  await expect(janela.getByTestId("espacos-resumo-1")).toHaveText("3/4");
  await expect(janela.getByTestId("espaco-1-4")).not.toBeChecked();
  // recuperar espaços
  await janela.getByTestId("recuperar-espacos").click();
  await expect(janela.getByTestId("espacos-resumo-1")).toHaveText("4/4");

  // "Mostrar em Ataques e magias": a magia aparece na lista de ataques, editada pela mesma magia
  await janela.getByTestId("magia-editar-6").click();
  await janela.getByTestId("editor-em-ataques").check();
  await janela.getByTestId("editor-voltar").click();
  await janela.getByTestId("ficha-aba-principal").click();
  await expect(janela.getByTestId("ataque-magia-6")).toContainText("Hunter's Mark");
  await expect(janela.getByTestId("ataque-magia-6")).toContainText("magia · 1º nível");
});

test("moedas somam em peças de ouro; o equipamento tem quantidade com − e + e carga", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);
  const janela = await abrirFicha(j1.pagina, DARION_ID, "principal");

  await janela.getByTestId("moeda-po").fill("12");
  await janela.getByTestId("moeda-pp").fill("30");
  await expect(janela.getByTestId("moedas-total")).toHaveText("15 po");

  await janela.getByTestId("item-novo-nome").fill("Corda de seda");
  await janela.getByTestId("item-novo-nome").press("Enter");
  const i = 13; // a fixture tem 13 itens
  await expect(janela.getByTestId(`item-nome-${i}`)).toHaveValue("Corda de seda");
  await expect(janela.getByTestId(`item-quantidade-${i}`)).toHaveValue("1");
  await janela.getByTestId(`item-mais-${i}`).click();
  await expect(janela.getByTestId(`item-quantidade-${i}`)).toHaveValue("2");
  await janela.getByTestId(`item-peso-${i}`).fill("2,5");
  await expect(janela.getByTestId("carga-total")).toHaveText("Carga: 5 kg");
  await janela.getByTestId(`item-menos-${i}`).click();
  await expect(janela.getByTestId(`item-quantidade-${i}`)).toHaveValue("1");
  await expect(janela.getByTestId("carga-total")).toHaveText("Carga: 2,5 kg");
});

test("característica: cria na linha em branco, abre, edita a origem e manda ao chat de todos", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);
  const janela = await abrirFicha(j1.pagina, DARION_ID, "principal");

  await janela.getByTestId("caracteristica-nova-nome").fill("Visão no Escuro");
  await janela.getByTestId("caracteristica-nova-nome").press("Enter");
  const i = 13; // a fixture tem 13 características
  await expect(janela.getByTestId(`caracteristica-alternar-${i}`)).toContainText("Visão no Escuro");
  await janela.getByTestId(`caracteristica-alternar-${i}`).click();
  await janela.getByTestId(`caracteristica-origem-${i}`).fill("Raça: Elfo");
  await janela.getByTestId(`caracteristica-descricao-${i}`).fill("Enxerga 18 m no escuro.");
  await expect(janela.getByTestId(`caracteristica-alternar-${i}`)).toContainText("Raça: Elfo");
  await janela.getByTestId(`caracteristica-chat-${i}`).click();

  await abrirAba(mestre.pagina, "chat");
  const cartao = mestre.pagina.getByTestId("caracteristica-chat").last();
  await expect(cartao.getByTestId("caracteristica-chat-nome")).toHaveText("Visão no Escuro");
  await expect(cartao.getByTestId("caracteristica-chat-origem")).toHaveText("Raça: Elfo");
});

test("minimizar deixa só o nome do personagem, numa janela estreita; duplo clique restaura", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarion(mestre.pagina);
  const p = mestre.pagina;
  const janela = await abrirFicha(p, DARION_ID, "principal");
  const caixa = p.getByTestId(`janela-${`ficha:${DARION_ID}`}`);
  const cheia = (await caixa.boundingBox()) as { width: number; height: number };

  await janela.getByTestId("janela-ficha-cabecalho").dblclick({ position: { x: 150, y: 12 } });
  await expect(caixa).toHaveAttribute("data-minimizada", "true");
  await expect(janela.getByTestId("janela-ficha-nome")).toHaveText("Darion");
  await expect(janela.getByTestId("ficha-raiz")).toBeHidden();
  const pequena = (await caixa.boundingBox()) as { width: number; height: number };
  expect(pequena.height).toBeLessThan(60);
  expect(pequena.width).toBeLessThan(cheia.width / 2);
  await expect(janela.getByTestId("janela-ficha-fechar")).toHaveCount(0);

  await janela.getByTestId("janela-ficha-cabecalho").dblclick();
  await expect(caixa).toHaveAttribute("data-minimizada", "false");
  await expect(janela.getByTestId("ficha-raiz")).toBeVisible();
});

test("aparência Clássica: escolhida na Configurar, vale nas fichas abertas, persiste ao recarregar e não vai para a sala", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarion(mestre.pagina);
  const p = mestre.pagina;
  const janela = await abrirFicha(p, DARION_ID, "principal");
  await expect(janela.getByTestId("ficha-raiz")).toHaveAttribute("data-pele", "livro");

  await janela.getByTestId("ficha-aba-configurar").click();
  const antes = mestre.enviados.length;
  await janela.getByTestId("aparencia-classica").click();
  await expect(janela.getByTestId("ficha-raiz")).toHaveAttribute("data-pele", "classica");
  expect(await p.evaluate(() => localStorage.getItem("tabletop:pref:aparenciaFicha"))).toBe(
    "classica",
  );
  await p.waitForTimeout(500);
  expect(mestre.enviados.length).toBe(antes);

  await recarregar(p);
  const depois = await abrirFicha(p, DARION_ID, "principal");
  await expect(depois.getByTestId("ficha-raiz")).toHaveAttribute("data-pele", "classica");
  // as mesmas coisas no mesmo lugar
  await expect(depois.getByTestId("atributo-mod-for")).toHaveText("+7");
  await depois.getByTestId("ficha-aba-configurar").click();
  await depois.getByTestId("aparencia-livro").click();
  await expect(depois.getByTestId("ficha-raiz")).toHaveAttribute("data-pele", "livro");
});

test("janela estreita: o cabeçalho gruda com PV, CA e iniciativa e as seções viram acordeão", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarion(mestre.pagina);
  const p = mestre.pagina;
  const janela = await abrirFicha(p, DARION_ID, "principal");
  // estreita a janela pela quina, como a pessoa faz
  const alca = (await janela.getByTestId("janela-ficha-redimensionar").boundingBox()) as {
    x: number;
    y: number;
  };
  await p.mouse.move(alca.x + 8, alca.y + 8);
  await p.mouse.down();
  await p.mouse.move(alca.x - 392, alca.y - 20, { steps: 8 });
  await p.mouse.up();
  await expect(janela.getByTestId("ficha-raiz")).toHaveAttribute("data-estreita", "true");
  // o cabeçalho tem o que se usa o tempo todo
  await expect(janela.getByTestId("pv-menos")).toBeVisible();
  await expect(janela.getByTestId("iniciativa")).toBeVisible();
  await expect(janela.getByTestId(`ca-${DARION_ID}`)).toBeVisible();
  await expect(janela.getByTestId("vantagem-normal")).toBeVisible();
  // acordeão: Atributos aberto, Salvaguardas e perícias fechado
  await expect(janela.getByTestId("atributo-mod-for")).toBeVisible();
  await expect(janela.getByTestId("pericia-total-atletismo")).toHaveCount(0);
  await janela.getByTestId("acordeao-salvaguardas-pericias-alternar").click();
  await expect(janela.getByTestId("pericia-total-atletismo")).toBeVisible();
  // o PV com − e + do cabeçalho
  await janela.getByTestId("pv-menos").click();
  await expect(janela.getByTestId(`pv-atual-${DARION_ID}`)).toHaveValue("96");
  // o editor ocupa o corpo todo
  await janela.getByTestId("ataque-editar-0").click();
  await expect(janela.getByTestId("editor-ataque")).toBeVisible();
  await janela.getByTestId("editor-voltar").click();
});

test("crítico: o 20 natural fica no verde fixo e o dano é do crítico; PV temporário absorve o dano do botão −", async ({
  mesa,
  request,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);
  const janela = await abrirFicha(j1.pagina, DARION_ID, "principal");

  expect((await request.post(`/teste/dados?semente=${SEMENTE_20_NATURAL}`)).ok()).toBe(true);
  await janela.getByTestId("ataque-nome-0").click();
  await abrirAba(mestre.pagina, "chat");
  const bloco = mestre.pagina.getByTestId("modelo-ataque").filter({ hasText: "Cimitarra" });
  await expect(bloco).toBeVisible();
  await expect(bloco).toHaveAttribute("data-critico", "true");
  await expect(bloco.locator(".chip-d20.nat20")).toHaveCount(1);
  await expect(bloco.getByTestId("modelo-veredito")).toHaveText("Crítico");
  const verde = await bloco
    .getByTestId("rolagem-total")
    .first()
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(verde).toBe("rgb(47, 164, 106)");
  // os dados do dano dobraram: 2d6+7
  await expect(bloco.getByTestId("modelo-dano-formula")).toContainText("2d6 + 7");
  expect((await request.post("/teste/dados")).ok()).toBe(true);

  // o dano consome o PV temporário primeiro
  await janela.getByTestId(`pv-temp-${DARION_ID}`).fill("3");
  await expect(janela.getByTestId(`pv-temp-${DARION_ID}`)).toHaveValue("3");
  await janela.getByTestId("pv-menos").click();
  await expect(janela.getByTestId(`pv-temp-${DARION_ID}`)).toHaveValue("2");
  await expect(janela.getByTestId(`pv-atual-${DARION_ID}`)).toHaveValue("97");
});

test("o PDF do Darion preenche os campos da ficha (personalidade, moedas, características)", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await mandar(p, "personagem.criar", {
    personagem: {
      id: DARION_ID,
      pastaId: "pasta-personagens",
      editores: { tipo: "jogadores", ids: ["jogador-1"] },
      nome: "Darion",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 18 },
      ficha: { pvAtual: 10, pvMax: 10 },
    },
  });
  const [seletor] = await Promise.all([
    p.waitForEvent("filechooser"),
    clicarImportarPdf(p, DARION_ID),
  ]);
  await seletor.setFiles(PDF_DO_DARION);
  await expect(p.getByTestId("revisao-pdf")).toBeVisible();
  await p.getByTestId("revisao-confirmar").click();
  await p.getByTestId("revisao-sobrescrever-sim").click();
  await expect(p.getByTestId("revisao-pdf")).toBeHidden();

  const janela = await abrirFicha(p, DARION_ID, "principal");
  await expect(janela.getByTestId("ficha-personalidade")).toHaveValue(/^Tendo vivido sozinho/);
  await expect(janela.getByTestId("ficha-ideais")).toHaveValue(
    "Defender e proteger quem é importante para mim.",
  );
  await expect(janela.getByTestId("ficha-ligacoes")).toHaveValue(/Não me cansarei/);
  await expect(janela.getByTestId("ficha-defeitos")).toHaveValue(
    /Trauma com grande quantidade de fogo/,
  );
  await expect(janela.getByTestId("moeda-po")).toHaveValue("7");
  await expect(janela.getByTestId("moeda-pc")).toHaveValue("0");
  // as características com descrição entram como itens que expandem
  await expect(janela.getByTestId("caracteristica-0")).toBeVisible();
  await janela.getByTestId("caracteristica-alternar-0").click();
  await expect(janela.getByTestId("caracteristica-descricao-0")).not.toHaveValue("");
});

test("o jogador sem permissão vê a ficha só para ler, com o mesmo layout", async ({ mesa }) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await criarPastaDoGrupo(mestre.pagina);
  await criarDarion(mestre.pagina, { pastaId: "pasta-grupo" });
  await ligarVerOutras(mestre.pagina, true);
  const lida = await abrirFicha(j2.pagina, DARION_ID, "principal");
  await expect(lida.getByTestId("fh-aba-principal")).toBeVisible();
  await expect(lida.getByTestId("ficha-ideais")).toBeDisabled();
  await expect(lida.getByTestId("ficha-raca")).toBeDisabled();
  await expect(lida.getByTestId("caracteristica-nova-nome")).toHaveCount(0);
  await expect(lida.getByTestId("ataque-adicionar")).toHaveCount(0);
  await expect(lida.getByTestId("ataque-nome-0")).toBeDisabled();
  for (const aba of ["historia", "magias"] as const) {
    await lida.getByTestId(`ficha-aba-${aba}`).click();
    await expect(lida.getByTestId(`fh-aba-${aba}`)).toBeVisible();
  }
});
