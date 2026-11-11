import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import { abrirAba, expect, type Sessao, test } from "./ajudas";
import { assets } from "./ajudasAssets";
import { definirValor, ligarOrdem, linha, nomesNaOrdem } from "./ajudasCombate";
import { DARION_ID, mandar } from "./ajudasFicha";
import {
  entrarNoMapa,
  noElementoDoMapa,
  pontoNaPagina,
  soSelecionarToken,
  tokensDe,
} from "./ajudasMapa";

// Redesign R5b: combate (ordem de turno compacta), ficha com um clique, compêndio com "Usar o exemplo" e
// o PDF da ficha com um caminho e um nome. Nada muda na sala: só a disposição e o que a tela diz.

const TEXTO_DO_SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);
const PDF_DO_DARION = fileURLToPath(
  new URL("../../fixtures/fichas/darion.pdf", import.meta.url),
);
const CHAVE_MONTAR = "tabletop:pref:ordem:montar";
const CAMINHO_DO_COMPENDIO = "compendio/magias.json";

const framesDeCombate = (s: Sessao) => s.enviados.filter((f) => f.includes('"tipo":"combate.'));
const preferencia = (p: Page, chave: string) => p.evaluate((k) => localStorage.getItem(k), chave);

/** A dica do botão (hover ou foco) está na tela com o texto e ligada ao botão para o leitor de tela. */
async function confereMotivo(botao: Locator, dica: Locator, motivo: string) {
  await expect(botao).toHaveAttribute("aria-disabled", "true");
  await expect(botao).toBeDisabled();
  await expect(botao).toHaveAccessibleDescription(motivo);
  await botao.page().mouse.move(0, 0);
  await botao.hover();
  await expect(dica).toBeVisible();
  await expect(dica).toHaveText(motivo);
  await botao.page().mouse.move(0, 0);
  await expect(dica).toBeHidden();
}

// --- ordem de turno ------------------------------------------------------------------------------

test("ordem de turno: digitar o valor não reordena nem manda frame até o Enter; Esc volta ao valor de antes", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ligarOrdem(p);
  await p.getByTestId("ordem-adicionar-grupo").click();
  await expect(linha(p, "Cael")).toBeVisible();
  await definirValor(p, "Aldric", 10);
  await definirValor(p, "Brisa", 5);
  await definirValor(p, "Cael", 15);
  await expect.poll(() => nomesNaOrdem(p)).toEqual(["Cael", "Aldric", "Brisa"]);

  // as setas do campo numérico só mudam o texto; Esc o devolve
  const antes = framesDeCombate(mestre).length;
  const aldric = linha(p, "Aldric").locator('input[type="number"]');
  await aldric.focus();
  await aldric.press("ArrowUp");
  await aldric.press("ArrowUp");
  await expect(aldric).toHaveValue("12");
  await p.waitForTimeout(300);
  expect(framesDeCombate(mestre)).toHaveLength(antes);
  await aldric.press("Escape");
  await expect(aldric).toHaveValue("10");

  // digitar: o texto muda, a lista fica e nada vai para a sala
  const brisa = linha(p, "Brisa").locator('input[type="number"]');
  await brisa.fill("30");
  await expect(brisa).toHaveValue("30");
  await p.waitForTimeout(400);
  expect(await nomesNaOrdem(p)).toEqual(["Cael", "Aldric", "Brisa"]);
  expect(framesDeCombate(mestre)).toHaveLength(antes);

  // Enter confirma o 30 e a lista reordena
  await brisa.press("Enter");
  await expect.poll(() => nomesNaOrdem(p)).toEqual(["Brisa", "Cael", "Aldric"]);
  await expect(brisa).toHaveValue("30");
  expect(framesDeCombate(mestre)).toHaveLength(antes + 1);

  // Esc devolve o valor de antes e não manda nada
  const depois = framesDeCombate(mestre).length;
  const cael = linha(p, "Cael").locator('input[type="number"]');
  await cael.fill("99");
  await expect(cael).toHaveValue("99");
  await cael.press("Escape");
  await expect(cael).toHaveValue("15");
  await expect(cael).not.toBeFocused();
  await p.waitForTimeout(300);
  expect(framesDeCombate(mestre)).toHaveLength(depois);
  expect(await nomesNaOrdem(p)).toEqual(["Brisa", "Cael", "Aldric"]);
});

test("ordem de turno: a seção Montar recolhe, o estado fica só no navegador e o jogador não a tem", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await ligarOrdem(p);
  const alternar = p.getByTestId("ordem-montar-alternar");

  // combate ainda não começou: Montar vem aberta; uma linha de turno fica à vista
  await expect(alternar).toHaveAttribute("aria-expanded", "true");
  await expect(p.getByTestId("ordem-montar")).toBeVisible();
  await p.getByTestId("ordem-adicionar-grupo").click();
  await expect(linha(p, "Cael")).toBeVisible();
  await p.getByTestId("ordem-rolar-todos").click();
  await expect(p.getByTestId("ordem-rolar-todos")).toHaveAttribute("aria-disabled", "true");
  expect(await preferencia(p, CHAVE_MONTAR)).toBeNull();

  // o jogador vê a lista, sem os comandos do mestre
  await expect(j1.pagina.getByTestId("ordem-de-turno")).toBeVisible();
  await expect(j1.pagina.getByTestId("ordem-montar-alternar")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("ordem-montar")).toHaveCount(0);

  // o combate começa: sem escolha da pessoa, Montar se recolhe sozinha (sobra a linha do turno)
  await p.getByTestId("ordem-proximo").click();
  await expect(p.getByTestId("ordem-rodada")).toHaveText("Rodada 1");
  await expect(alternar).toHaveAttribute("aria-expanded", "false");
  await expect(p.getByTestId("ordem-montar")).toHaveCount(0);
  await expect(p.getByTestId("ordem-solta")).toHaveCount(0);
  await expect(p.getByTestId("ordem-anterior")).toBeVisible();
  await expect(p.getByTestId("ordem-proximo")).toBeVisible();
  expect(await preferencia(p, CHAVE_MONTAR)).toBeNull();

  // abrir e fechar é preferência: grava no navegador e não manda frame
  const framesAntes = framesDeCombate(mestre).length;
  await alternar.click();
  await expect(alternar).toHaveAttribute("aria-expanded", "true");
  await expect(p.getByTestId("ordem-solta")).toBeVisible();
  expect(await preferencia(p, CHAVE_MONTAR)).toBe("1");
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(p.getByTestId("ordem-montar-alternar")).toHaveAttribute("aria-expanded", "true");
  await p.getByTestId("ordem-montar-alternar").click();
  await expect(p.getByTestId("ordem-montar-alternar")).toHaveAttribute("aria-expanded", "false");
  expect(await preferencia(p, CHAVE_MONTAR)).toBe("0");
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(p.getByTestId("ordem-montar-alternar")).toHaveAttribute("aria-expanded", "false");
  // nada foi para a sala por abrir e fechar (a reconexão só pede o estado)
  expect(framesDeCombate(mestre)).toHaveLength(framesAntes);
  expect(j1.frames.some((f) => f.includes(CHAVE_MONTAR))).toBe(false);
});

test("ordem de turno: todo botão desabilitado diz por quê (dica no mouse e no foco, e para o leitor de tela)", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ligarOrdem(p);
  const b = (id: string) => p.getByTestId(id);
  const d = (id: string) => p.getByTestId(`dica-${id}`);

  // lista vazia, nada selecionado, sem combate
  const vazios: [string, string][] = [
    ["ordem-anterior", "A lista está vazia"],
    ["ordem-proximo", "A lista está vazia"],
    ["ordem-rolar-todos", "A lista está vazia"],
    ["ordem-ordenar", "A lista está vazia"],
    ["ordem-adicionar-selecionados", "Selecione um token no mapa"],
    ["ordem-solta-adicionar", "Escreva o nome da entrada"],
    ["ordem-encerrar", "Não há combate em andamento"],
  ];
  for (const [id, motivo] of vazios) await confereMotivo(b(id), d(id), motivo);

  // pelo foco do teclado também, e Esc some com a dica
  await b("ordem-ordenar").focus();
  await expect(d("ordem-ordenar")).toBeVisible();
  await b("ordem-ordenar").press("Escape");
  await expect(d("ordem-ordenar")).toBeHidden();

  // clicar num botão desabilitado não faz nada
  const antes = framesDeCombate(mestre).length;
  await b("ordem-rolar-todos").click({ force: true });
  await b("ordem-encerrar").click({ force: true });
  await b("ordem-solta-adicionar").click({ force: true });
  await p.waitForTimeout(300);
  expect(framesDeCombate(mestre)).toHaveLength(antes);
  await expect(b("ordem-encerrar-confirmar")).toHaveCount(0);

  // com um nome o botão da entrada solta passa a valer
  await p.getByTestId("ordem-solta-nome").fill("Covil");
  await expect(b("ordem-solta-adicionar")).not.toHaveAttribute("aria-disabled", "true");
  await p.getByTestId("ordem-solta-nome").fill("");
  await expect(b("ordem-solta-adicionar")).toHaveAttribute("aria-disabled", "true");

  // um token selecionado no mapa libera o "Adicionar selecionados"; depois de adicionado, diz que já está
  await soSelecionarToken(p, "tok-ogro");
  await expect(b("ordem-adicionar-selecionados")).not.toHaveAttribute("aria-disabled", "true");
  await b("ordem-adicionar-selecionados").click();
  await expect(linha(p, "Ogro")).toBeVisible();
  await confereMotivo(
    b("ordem-adicionar-selecionados"),
    d("ordem-adicionar-selecionados"),
    "Já está na lista",
  );

  // o grupo entra; depois diz que já está; "Rolar para todos" vale até todos terem valor
  await expect(b("ordem-adicionar-grupo")).not.toHaveAttribute("aria-disabled", "true");
  await b("ordem-adicionar-grupo").click();
  await expect(linha(p, "Cael")).toBeVisible();
  await confereMotivo(
    b("ordem-adicionar-grupo"),
    d("ordem-adicionar-grupo"),
    "O grupo já está na lista",
  );
  await expect(b("ordem-encerrar")).not.toHaveAttribute("aria-disabled", "true");
  await expect(b("ordem-rolar-todos")).not.toHaveAttribute("aria-disabled", "true");
  await b("ordem-rolar-todos").click();
  await expect(b("ordem-rolar-todos")).toHaveAttribute("aria-disabled", "true");
  await confereMotivo(b("ordem-rolar-todos"), d("ordem-rolar-todos"), "Todos já têm iniciativa");
  await expect(b("ordem-ordenar")).not.toHaveAttribute("aria-disabled", "true");
});

// --- ficha com um clique -----------------------------------------------------------------------

test("fichas: um clique no item abre a ficha; dois cliques abrem uma só; Enter abre; o menu do item e o arrastar não abrem", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await abrirAba(p, "fichas");
  const janelas = p.getByTestId("janela-ficha");
  const item = p.getByTestId("ficha-abrir-pers-aldric");

  // a dica diz o que fazer (R6a: a dica comum, no hover e no foco, não o title nativo)
  await expect(item).not.toHaveAttribute("title", /.+/);
  await item.hover();
  const dicaItem = p.getByTestId("dica-ficha-abrir-pers-aldric");
  await expect(dicaItem).toBeVisible();
  await expect(dicaItem).toContainText("Abrir a ficha");
  await expect(dicaItem).toContainText("Arraste para o mapa");
  await p.mouse.move(700, 500);
  await abrirAba(j1.pagina, "fichas");
  await j1.pagina.getByTestId("ficha-abrir-pers-aldric").hover();
  const dicaJogador = j1.pagina.getByTestId("dica-ficha-abrir-pers-aldric");
  await expect(dicaJogador).toBeVisible();
  await expect(dicaJogador).toContainText("Abrir a ficha");
  await expect(dicaJogador).not.toContainText("Arraste");

  // um clique abre (e não manda nada para a sala)
  const antes = mestre.enviados.length;
  await item.click();
  await expect(janelas).toHaveCount(1);
  await expect(janelas).toHaveAttribute("data-personagem-id", "pers-aldric");
  expect(mestre.enviados.length).toBe(antes);

  // dois cliques com a ficha aberta: continua uma só
  await item.dblclick();
  await expect(janelas).toHaveCount(1);
  await p.getByTestId("janela-ficha-fechar").click();
  await expect(janelas).toHaveCount(0);
  // dois cliques com a ficha fechada: abre uma
  await item.dblclick();
  await expect(janelas).toHaveCount(1);
  await p.getByTestId("janela-ficha-fechar").click();
  await expect(janelas).toHaveCount(0);

  // Enter no item (com o foco nele) abre
  await item.focus();
  await item.press("Enter");
  await expect(janelas).toHaveCount(1);
  await p.getByTestId("janela-ficha-fechar").click();
  await expect(janelas).toHaveCount(0);

  // o menu do item não abre a ficha
  await p.getByTestId("ficha-menu-pers-aldric").click();
  await expect(p.getByTestId("ficha-menu-itens-pers-aldric")).toBeVisible();
  await p.waitForTimeout(300);
  await expect(janelas).toHaveCount(0);
  await p.getByTestId("ficha-menu-importar-pdf-pers-aldric").waitFor();
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("ficha-menu-itens-pers-aldric")).toHaveCount(0);
  await expect(janelas).toHaveCount(0);

  // arrastar o item (pelo nome) para o mapa cria o token e não abre a ficha
  const nomeDoOgro = "Ogro";
  const antesDoToken = (await tokensDe(p)).filter((t) => t.nome === nomeDoOgro).length;
  const alvo = await pontoNaPagina(p, 18.75, 14.25);
  await p.getByTestId("ficha-abrir-pers-ogro").dragTo(p.getByTestId("mapa"), {
    targetPosition: await noElementoDoMapa(p, alvo),
  });
  await expect
    .poll(async () => (await tokensDe(p)).filter((t) => t.nome === nomeDoOgro).length)
    .toBe(antesDoToken + 1);
  await expect(janelas).toHaveCount(0);
});

// --- compêndio ------------------------------------------------------------------------------------

test("compêndio: o estado vazio do mestre oferece o exemplo; 'Usar o exemplo' (sem pasta) mostra as 3 magias e a atribuição; o jogador vê como vê hoje", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;
  await abrirAba(m, "compendio");
  await abrirAba(j, "compendio");

  // vazio do mestre: a ação principal e o arquivo, lado a lado; a ajuda do JSON fica recolhida
  await expect(m.getByTestId("compendio-usar-exemplo")).toHaveText(
    "Usar o exemplo do SRD (3 magias)",
  );
  await expect(m.getByTestId("compendio-arquivo")).toHaveCount(1);
  await expect(m.getByText("Escolher o arquivo…")).toBeVisible();
  await expect(m.getByTestId("compendio-ajuda-formato")).toBeVisible();
  await expect(m.getByTestId("compendio-exemplo")).toBeHidden();
  await m.getByTestId("compendio-ajuda-formato").locator("summary").click();
  await expect(m.getByTestId("compendio-exemplo")).toBeVisible();
  await expect(m.getByTestId("compendio-exemplo")).toContainText("tabletop-compendio");

  // vazio do jogador: diz o que está acontecendo e o que fazer
  await expect(j.getByTestId("compendio-vazio-jogador")).toContainText(
    "O mestre ainda não montou o compêndio",
  );
  await expect(j.getByTestId("compendio-vazio-jogador")).toContainText(
    "Não falta nada do seu lado",
  );
  await expect(j.getByTestId("compendio-usar-exemplo")).toHaveCount(0);

  // sem pasta: o exemplo vale até recarregar
  await m.getByTestId("compendio-usar-exemplo").click();
  await expect(m.getByTestId("compendio-lista")).toBeVisible();
  await expect(m.getByTestId("compendio-contagem")).toHaveText("3 magias");
  await expect(m.getByTestId("compendio-exemplo-em-uso")).toContainText("Exemplo do SRD 5.1");
  await expect(m.getByTestId("compendio-exemplo-em-uso")).toContainText("até recarregar");
  await expect(m.getByTestId("compendio-creditos-texto")).toBeVisible();
  await expect(m.getByTestId("compendio-creditos-texto")).toContainText(
    "System Reference Document 5.1",
  );
  await expect(m.getByTestId("compendio-creditos-texto")).toContainText("CC-BY-4.0");

  // o jogador vê o compêndio como vê quando o mestre escolhe um arquivo: lista, busca, créditos, sem Recarregar
  await expect(j.getByTestId("compendio-lista")).toBeVisible();
  await expect(j.getByTestId("compendio-contagem")).toHaveText("3 magias");
  await expect(j.getByTestId("compendio-recarregar")).toHaveCount(0);
  await expect(j.getByTestId("compendio-usar-exemplo")).toHaveCount(0);
  await expect(j.getByTestId("compendio-creditos-texto")).toContainText("CC-BY-4.0");
  await j.getByTestId("compendio-busca").fill("bola");
  await expect(j.getByTestId("compendio-item")).toHaveCount(1);
  // o texto das magias só chega a ele pelos pedaços, nunca num frame de texto
  expect(j1.frames.some((f) => f.includes("8d6"))).toBe(false);
});

test("compêndio: com a pasta local, 'Usar o exemplo' grava compendio/magias.json e pede confirmação antes de substituir", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await mesa.entrar("mestre");
  const m = mestre.pagina;
  await assets(m, "usarMemoriaComoPasta", true);
  // a pasta já tem um magias.json com erro: o exemplo não o sobrescreve sem confirmar
  await assets(m, "adicionarNaPasta", CAMINHO_DO_COMPENDIO, "{ isto não é um compêndio");
  await abrirAba(m, "compendio");
  await expect(m.getByTestId("compendio-erro")).toBeVisible();
  await m.getByTestId("compendio-usar-exemplo").click();
  await expect(m.getByTestId("compendio-exemplo-confirmar")).toContainText(CAMINHO_DO_COMPENDIO);
  expect(await assets(m, "gravados")).toEqual([]);
  await m.getByTestId("compendio-exemplo-cancelar").click();
  await expect(m.getByTestId("compendio-exemplo-confirmar")).toHaveCount(0);
  expect(await assets(m, "gravados")).toEqual([]);

  // confirmando, grava o mesmo arquivo do exemplo (mesmo conteúdo, sem duplicar) na pasta
  await m.getByTestId("compendio-usar-exemplo").click();
  await m.getByTestId("compendio-exemplo-substituir").click();
  await expect(m.getByTestId("compendio-lista")).toBeVisible();
  await expect(m.getByTestId("compendio-contagem")).toHaveText("3 magias");
  await expect(m.getByTestId("compendio-exemplo-em-uso")).toContainText(CAMINHO_DO_COMPENDIO);
  const gravados = await assets(m, "gravados");
  expect(gravados).toHaveLength(1);
  expect(gravados[0]?.caminho).toBe(CAMINHO_DO_COMPENDIO);
  expect(gravados[0]?.bytes).toBe(Buffer.byteLength(TEXTO_DO_SRD));
});

// --- PDF da ficha ---------------------------------------------------------------------------------

async function escolherPdf(p: Page, abrir: () => Promise<void>) {
  const [seletor] = await Promise.all([p.waitForEvent("filechooser"), abrir()]);
  await seletor.setFiles(PDF_DO_DARION);
  await expect(p.getByTestId("revisao-pdf")).toBeVisible();
}

async function criarDarionSimples(p: Page) {
  await mandar(p, "personagem.criar", {
    personagem: {
      id: DARION_ID,
      pastaId: "pasta-personagens",
      editores: { tipo: "jogadores", ids: ["jogador-1"] },
      nome: "Darion",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 10 },
      ficha: { pvAtual: 10, pvMax: 10, raca: "Humano" },
    },
  });
}

const fichaFrames = (s: Sessao) => s.enviados.filter((f) => /"tipo":"(ficha|personagem)\./.test(f));

test("PDF: os dois caminhos têm o mesmo nome; pelo menu do item o destino já vem preenchido", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarDarionSimples(p);
  await abrirAba(p, "fichas");
  await expect(p.getByTestId("ficha-novo-pdf")).toHaveText("Importar PDF…");
  await p.getByTestId(`ficha-menu-${DARION_ID}`).click();
  await expect(p.getByTestId(`ficha-menu-importar-pdf-${DARION_ID}`)).toHaveText(
    "Importar PDF…",
  );

  // pelo menu do item: "Por cima de: Darion" já escolhido, e o botão final diz o que vai acontecer
  await escolherPdf(p, () => p.getByTestId(`ficha-menu-importar-pdf-${DARION_ID}`).click());
  const destino = p.getByTestId("revisao-destino");
  await expect(destino).toHaveValue(DARION_ID);
  await expect(destino.locator("option:checked")).toHaveText("Por cima de: Darion");
  await expect(p.getByTestId("revisao-nome")).toHaveCount(0);
  await expect(p.getByTestId("revisao-confirmar")).toHaveText("Substituir a ficha de Darion");
  await expect(p.getByTestId("revisao-sugestao")).toHaveCount(0);
  // trocar para "Ficha nova" muda o botão e pede o nome
  await destino.selectOption("");
  await expect(p.getByTestId("revisao-confirmar")).toHaveText("Criar a ficha");
  await expect(p.getByTestId("revisao-nome")).toHaveValue("Darion");
  await p.getByTestId("revisao-cancelar").click();
  await expect(p.getByTestId("revisao-pdf")).toBeHidden();
});

test("PDF: pelo botão da aba o destino começa em 'Ficha nova' e só sugere o personagem de mesmo nome", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarDarionSimples(p);
  await abrirAba(p, "fichas");
  await escolherPdf(p, () => p.getByTestId("ficha-novo-pdf").click());
  await expect(p.getByTestId("revisao-destino")).toHaveValue("");
  await expect(p.getByTestId("revisao-confirmar")).toHaveText("Criar a ficha");
  await expect(p.getByTestId("revisao-sugestao")).toContainText("Já existe Darion");
  // a sugestão não escolhe sozinha: um clique a aceita
  await p.getByTestId("revisao-sugestao-usar").click();
  await expect(p.getByTestId("revisao-destino")).toHaveValue(DARION_ID);
  await expect(p.getByTestId("revisao-confirmar")).toHaveText("Substituir a ficha de Darion");
  await expect(p.getByTestId("revisao-sugestao")).toHaveCount(0);
  await p.getByTestId("revisao-cancelar").click();
  await expect(p.getByTestId("revisao-pdf")).toBeHidden();
});

test("PDF: só os personagens que a pessoa edita aparecem como destino", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarionSimples(mestre.pagina);
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await abrirAba(p, "fichas");
  // o jogador não tem o botão da aba (é do mestre): importa pelo menu do item que ele edita
  await expect(p.getByTestId("ficha-novo-pdf")).toHaveCount(0);
  await p.getByTestId(`ficha-menu-${DARION_ID}`).click();
  await escolherPdf(p, () => p.getByTestId(`ficha-menu-importar-pdf-${DARION_ID}`).click());
  await expect(p.getByTestId("revisao-destino")).toHaveValue(DARION_ID);
  const opcoes = await p.getByTestId("revisao-destino").locator("option").allTextContents();
  expect(opcoes).toContain("Ficha nova");
  expect(opcoes).toContain("Por cima de: Darion");
  // o Cael é do jogador-3: não é destino para o jogador-1
  expect(opcoes.some((o) => o.includes("Cael"))).toBe(false);
});

test("PDF: seções sem incerteza vêm recolhidas com resumo; 'Próximo a conferir' leva o foco ao campo incerto; confirmar gera a mesma ficha", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarDarionSimples(p);
  await abrirAba(p, "fichas");
  const antes = fichaFrames(mestre).length;
  await escolherPdf(p, () => p.getByTestId("ficha-novo-pdf").click());
  await p.getByTestId("revisao-sugestao-usar").click();

  // no alto: a contagem e o botão que leva ao próximo
  await expect(p.getByTestId("revisao-total-incertos")).toContainText("campos para conferir");
  await expect(p.getByTestId("revisao-proximo-incerto")).toBeEnabled();

  // seções com incerto abertas; as sem incerto recolhidas, com resumo
  const secoes = p.locator('[data-testid^="revisao-secao-"][data-secao]');
  const total = await secoes.count();
  expect(total).toBe(10);
  let abertas = 0;
  let recolhidas = 0;
  for (let i = 0; i < total; i++) {
    const s = secoes.nth(i);
    const id = (await s.getAttribute("data-secao")) as string;
    const comIncerto = (await s.locator('[data-incerto="true"], .rev-selo.amarelo').count()) > 0;
    if (comIncerto) {
      await expect(s).toHaveAttribute("data-aberta", "true");
      abertas++;
    } else {
      await expect(s).toHaveAttribute("data-aberta", "false");
      await expect(p.getByTestId(`revisao-resumo-${id}`)).toContainText("nada a conferir");
      await expect(p.getByTestId(`revisao-trecho-${id}`)).toBeHidden();
      recolhidas++;
    }
  }
  expect(abertas).toBeGreaterThan(0);
  expect(recolhidas).toBeGreaterThan(0);
  await expect(p.getByTestId("revisao-secao-ataques")).toHaveAttribute("data-aberta", "true");

  // "Próximo a conferir": o foco vai para dentro de um campo incerto, e o seguinte é outro
  const focoNoIncerto = () =>
    p.evaluate(() => {
      const a = document.activeElement;
      return a?.closest('[data-incerto="true"]') != null;
    });
  const quemTemFoco = () =>
    p.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return a
        ? `${a.tagName}|${a.getAttribute("data-testid") ?? ""}|${a.textContent?.slice(0, 40) ?? ""}`
        : "";
    });
  await p.getByTestId("revisao-proximo-incerto").click();
  expect(await focoNoIncerto()).toBe(true);
  const primeiro = await quemTemFoco();
  await p.getByTestId("revisao-proximo-incerto").click();
  expect(await focoNoIncerto()).toBe(true);
  expect(await quemTemFoco()).not.toBe(primeiro);

  // "Mostrar tudo" abre todas; depois recolhe de novo só o que está certo
  await p.getByTestId("revisao-mostrar-tudo").click();
  for (let i = 0; i < total; i++)
    await expect(secoes.nth(i)).toHaveAttribute("data-aberta", "true");
  await expect(p.getByTestId("revisao-mostrar-tudo")).toHaveText("Recolher o que está certo");
  await p.getByTestId("revisao-mostrar-tudo").click();
  await expect(p.getByTestId("revisao-mostrar-tudo")).toHaveText("Mostrar tudo");
  expect(
    await secoes.evaluateAll(
      (els) => els.filter((e) => e.getAttribute("data-aberta") === "false").length,
    ),
  ).toBe(recolhidas);

  // uma seção recolhida abre pelo próprio título
  const idDaRecolhida = (
    await p.locator('[data-testid^="revisao-resumo-"]').first().getAttribute("data-testid")
  )?.replace("revisao-resumo-", "") as string;
  await p.getByTestId(`revisao-secao-alternar-${idDaRecolhida}`).click();
  await expect(p.getByTestId(`revisao-secao-${idDaRecolhida}`)).toHaveAttribute(
    "data-aberta",
    "true",
  );

  // confirmar: a mesma ficha de antes (um único `ficha.alterar` com a ficha inteira por cima do Darion)
  expect(fichaFrames(mestre)).toHaveLength(antes);
  await p.getByTestId("revisao-confirmar").click();
  await expect(p.getByTestId("revisao-sobrescrever")).toContainText("TODA a ficha de Darion");
  await p.getByTestId("revisao-sobrescrever-sim").click();
  await expect(p.getByTestId("revisao-pdf")).toBeHidden();
  const enviados = fichaFrames(mestre).slice(antes);
  expect(enviados).toHaveLength(1);
  const dados = JSON.parse(enviados[0] as string).dados as {
    personagemId: string;
    operacoes: { caminho: string; valor: { pvAtual: number; ataques: { nome: string }[] } }[];
  };
  expect(dados.personagemId).toBe(DARION_ID);
  expect(dados.operacoes[0]?.caminho).toBe("");
  expect(dados.operacoes[0]?.valor.pvAtual).toBe(97);
  expect(dados.operacoes[0]?.valor.ataques[1]?.nome).toBe("Machadinho …");
});

test("PDF: 'Criar a ficha' gera o personagem novo com o nome digitado", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "fichas");
  await escolherPdf(p, () => p.getByTestId("ficha-novo-pdf").click());
  await expect(p.getByTestId("revisao-destino")).toHaveValue("");
  await expect(p.getByTestId("revisao-nome")).toHaveValue("Darion");
  await p.getByTestId("revisao-nome").fill("Darion do PDF");
  await p.getByTestId("revisao-confirmar").click();
  await expect(p.getByTestId("revisao-pdf")).toBeHidden();
  const janela = p.getByTestId("janela-ficha");
  await expect(janela).toBeVisible();
  await expect(janela.getByTestId("janela-ficha-nome")).toHaveText("Darion do PDF");
  await expect(janela.getByTestId("janela-ficha-resumo")).toContainText(
    "Patrulheiro 5 / Clérigo 5",
  );
});
