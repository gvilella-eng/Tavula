import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { arquivoPrivado, exigirPrivado } from "../privado";
import { abrirAba, expect, test } from "./ajudas";
import { abrirFicha, criarHandoutPelaSala, mandar } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// V3: a aba Fichas em árvore (pais e filhos, sem caixas), "+ Novo" com as quatro opções, renomear a pasta
// clicando no nome, menu de clique direito (e Shift+F10) no lugar dos "⋯", e "Importar PDF" dentro da ficha.

const PDF = arquivoPrivado("fixtures/fichas/darion.pdf");

type Caixa = { x: number; y: number; width: number; height: number };
async function caixa(l: Locator): Promise<Caixa> {
  const c = await l.boundingBox();
  if (!c) throw new Error("elemento sem caixa (não está visível)");
  return c;
}

/** "+ Novo" → Pasta; devolve o id da pasta nova (a última da lista). */
async function novaPasta(p: Page): Promise<string> {
  const secoes = p.locator('section[data-testid^="ficha-pasta-pasta-"]');
  const antes = await secoes.count();
  await p.getByTestId("ficha-novo").click();
  await p.getByTestId("ficha-nova-pasta").click();
  await expect(secoes).toHaveCount(antes + 1);
  return (await secoes.last().getAttribute("data-pasta-id")) as string;
}

test("'+ Novo' é o botão único do alto, com Personagem, NPC, Handout e Pasta; o jogador não o tem", async ({
  mesa,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  const j = (await entrarNoMapa(mesa, "jogador-1")).pagina;
  await abrirAba(m, "fichas");
  await abrirAba(j, "fichas");

  // no alto só há o "+ Novo": a Pasta e o "Importar PDF" saíram de lá
  const barra = m.locator(".fichas-barra");
  await expect(barra.getByRole("button")).toHaveCount(1);
  await expect(barra.getByTestId("ficha-novo")).toContainText("Novo");
  await expect(m.getByTestId("ficha-novo-pdf")).toHaveCount(0);
  await expect(m.getByTestId("ficha-nova-pasta")).toHaveCount(0);

  await m.getByTestId("ficha-novo").click();
  const menu = m.getByTestId("ficha-novo-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button")).toHaveText(["Personagem", "NPC", "Handout", "Pasta"]);
  for (const id of [
    "ficha-novo-personagem",
    "ficha-novo-npc",
    "ficha-novo-handout",
    "ficha-nova-pasta",
  ]) {
    await expect(m.getByTestId(id)).toBeEnabled();
  }
  // nenhum texto de "em breve"
  await expect(menu).not.toContainText(/em breve/i);
  await m.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  // o jogador não cria nada: nem o botão aparece
  await expect(j.getByTestId("ficha-novo")).toHaveCount(0);
  await expect(j.getByTestId("ficha-novo-menu")).toHaveCount(0);
});

test("pasta nova pelo '+ Novo': nasce só do mestre, vazia, e o jogador não a recebe", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  await abrirAba(m, "fichas");
  const id = await novaPasta(m);
  await expect(m.getByTestId(`ficha-pasta-nome-${id}`)).toHaveText("Nova pasta");
  await expect(m.getByTestId(`ficha-pasta-total-${id}`)).toHaveText("0");
  await expect(m.getByTestId(`ficha-pasta-${id}`)).toContainText("Pasta vazia.");
  await abrirAba(j.pagina, "fichas");
  await expect(j.pagina.getByTestId(`ficha-pasta-${id}`)).toHaveCount(0);
  expect(j.frames.join("\n")).not.toContain("Nova pasta");
});

test("renomear a pasta clicando no nome: Enter e clicar fora confirmam, Esc desfaz, F2 com o nome em foco; sem lápis", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  await abrirAba(m, "fichas");
  const id = await novaPasta(m);
  const nome = m.getByTestId(`ficha-pasta-nome-${id}`);
  const campo = m.getByTestId(`ficha-pasta-nome-editar-${id}`);
  // não há botão de editar (lápis) nem de apagar (lixeira) nem cadeado na linha da pasta
  await expect(m.getByTestId(`ficha-pasta-renomear-${id}`)).toHaveCount(0);
  await expect(m.getByTestId(`ficha-pasta-apagar-${id}`)).toHaveCount(0);
  await expect(m.getByTestId(`ficha-pasta-visib-${id}`)).toHaveCount(0);
  await expect(m.getByTestId(`ficha-pasta-linha-${id}`).locator(".lucide-pencil")).toHaveCount(0);

  // um clique no texto vira campo; Enter confirma
  await nome.click();
  await expect(campo).toBeVisible();
  await expect(campo).toBeFocused();
  await campo.fill("Cripta");
  await campo.press("Enter");
  await expect(campo).toHaveCount(0);
  await expect(nome).toHaveText("Cripta");
  // a sala recebeu: o mestre reabre e vê o nome novo (e o foco volta ao nome)
  await expect(nome).toBeFocused();

  // Esc desfaz
  await nome.click();
  await campo.fill("Descartado");
  await campo.press("Escape");
  await expect(campo).toHaveCount(0);
  await expect(nome).toHaveText("Cripta");

  // clicar fora confirma
  await nome.click();
  await campo.fill("Masmorra funda");
  await m.getByTestId("aba-painel-fichas").locator("h2").click();
  await expect(campo).toHaveCount(0);
  await expect(nome).toHaveText("Masmorra funda");

  // F2 com o nome em foco (pelo teclado)
  await nome.focus();
  await m.keyboard.press("F2");
  await expect(campo).toBeVisible();
  await campo.fill("Torre");
  await m.keyboard.press("Enter");
  await expect(nome).toHaveText("Torre");

  // nome vazio não vale: volta ao anterior
  await nome.click();
  await campo.fill("   ");
  await campo.press("Enter");
  await expect(nome).toHaveText("Torre");

  // o jogador, numa pasta que ele vê, clica no nome e nada vira campo (só recolhe)
  await m.getByTestId(`ficha-pasta-nome-${id}`).click({ button: "right" });
  await m.getByTestId("menu-ficha-visib-todos").click();
  await m.keyboard.press("Escape");
  const pj = j.pagina;
  await abrirAba(pj, "fichas");
  const nomeDoJogador = pj.getByTestId(`ficha-pasta-nome-${id}`);
  await expect(nomeDoJogador).toHaveText("Torre");
  await nomeDoJogador.click();
  await expect(pj.getByTestId(`ficha-pasta-nome-editar-${id}`)).toHaveCount(0);
  await expect(pj.getByTestId(`ficha-pasta-alternar-${id}`)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("a árvore: a pasta é uma linha sem caixa e os itens vêm à direita, com uma linha-guia; recolher esconde os itens", async ({
  mesa,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  await abrirAba(m, "fichas");
  await criarHandoutPelaSala(m, { pastaId: "pasta-npcs", titulo: "Livro velho" });
  const outra = await novaPasta(m);

  const pasta = m.getByTestId("ficha-pasta-pasta-personagens");
  const linha = m.getByTestId("ficha-pasta-linha-pasta-personagens");
  const item = m.getByTestId("ficha-item-pers-aldric");
  await expect(item).toBeVisible();

  // sem caixa: a pasta não tem borda nem fundo próprio
  await expect(pasta).toHaveCSS("border-top-width", "0px");
  await expect(pasta).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  // o item fica à direita do começo da pasta (recuo) e a linha-guia vertical fica no meio
  const caixaDaLinha = await caixa(linha);
  const caixaDoItem = await caixa(item);
  expect(caixaDoItem.x).toBeGreaterThan(caixaDaLinha.x + 12);
  expect(caixaDoItem.y).toBeGreaterThan(caixaDaLinha.y + caixaDaLinha.height - 1);
  const lista = pasta.locator(".ficha-lista");
  await expect(lista).toHaveCSS("border-left-width", "1px");
  await expect(lista).toHaveCSS("border-left-style", "solid");
  const caixaDaLista = await caixa(lista);
  expect(caixaDaLista.x).toBeGreaterThan(caixaDaLinha.x + 8);
  // o handout (na pasta NPCs) também vem recuado
  const handoutNpc = m.locator('[data-testid^="handout-item-"]').first();
  await expect(handoutNpc).toBeVisible();
  expect((await caixa(handoutNpc)).x).toBeGreaterThan(caixaDaLinha.x + 12);

  // uma pasta recolhida esconde os itens e o contador continua
  const alternar = m.getByTestId("ficha-pasta-alternar-pasta-personagens");
  await expect(alternar).toHaveAttribute("aria-expanded", "true");
  await alternar.click();
  await expect(alternar).toHaveAttribute("aria-expanded", "false");
  await expect(item).toHaveCount(0);
  await expect(m.getByTestId("ficha-pasta-total-pasta-personagens")).not.toHaveText("0");
  await expect(m.getByTestId(`ficha-pasta-${outra}`)).toBeVisible();
  await alternar.click();
  await expect(item).toBeVisible();
});

test("não há '⋯' no item: o botão direito e o Shift+F10 abrem o menu do item, com as ações de antes", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  await abrirAba(m, "fichas");
  const abrir = m.getByTestId("ficha-abrir-pers-aldric");
  const menu = m.getByTestId("menu-ficha");

  // nada de "⋯" nem lápis
  await expect(m.getByTestId("ficha-menu-pers-aldric")).toHaveCount(0);
  await expect(m.locator("[data-testid^='ficha-menu-']")).toHaveCount(0);
  await expect(m.locator(".lucide-ellipsis, .lucide-more-horizontal")).toHaveCount(0);

  // botão direito: abrir, configurar, mover para a pasta, quem controla e apagar
  await abrir.click({ button: "right" });
  await expect(menu).toBeVisible();
  await expect(m.getByTestId("janela-ficha")).toHaveCount(0);
  for (const id of [
    "abrir",
    "configurar",
    "mover-pasta-npcs",
    "controla-todos",
    "controla-jogador-1",
    "apagar",
  ]) {
    await expect(m.getByTestId(`menu-ficha-${id}`), id).toBeVisible();
  }
  await expect(m.getByTestId("menu-ficha-mover-pasta-personagens")).toHaveCount(0);
  await expect(m.getByTestId("menu-ficha-controla-jogador-1")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // o menu cabe na janela do navegador
  const c = await caixa(menu);
  const tela = m.viewportSize() as { width: number; height: number };
  expect(c.x + c.width).toBeLessThanOrEqual(tela.width);
  expect(c.y + c.height).toBeLessThanOrEqual(tela.height);
  await m.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  // pelo teclado: com o item em foco, Shift+F10 abre; o foco vai ao primeiro item; Esc fecha e devolve o foco
  await abrir.focus();
  await m.keyboard.press("Shift+F10");
  await expect(menu).toBeVisible();
  await expect(m.getByTestId("menu-ficha-abrir")).toBeFocused();
  await m.keyboard.press("ArrowDown");
  await expect(m.getByTestId("menu-ficha-configurar")).toBeFocused();
  await m.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(abrir).toBeFocused();
  // a tecla de menu faz o mesmo
  await m.keyboard.press("ContextMenu");
  await expect(menu).toBeVisible();
  await expect(m.getByTestId("menu-ficha-abrir")).toBeFocused();
  // Enter no item "Configurar…" abre a ficha na aba Configurar
  await m.keyboard.press("ArrowDown");
  await m.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  const janela = m.locator('[data-testid="janela-ficha"][data-personagem-id="pers-aldric"]');
  await expect(janela).toBeVisible();
  await expect(janela).toHaveAttribute("data-aba", "configurar");
  await m.getByTestId("janela-ficha-fechar").click();

  // mover para a pasta NPCs pelo menu
  await abrir.click({ button: "right" });
  await m.getByTestId("menu-ficha-mover-pasta-npcs").click();
  await expect(menu).toHaveCount(0);
  await expect(
    m.locator('[data-testid="ficha-pasta-pasta-npcs"] [data-testid="ficha-item-pers-aldric"]'),
  ).toBeVisible();

  // quem controla: o menu de marcar fica aberto e a sala recebe (o jogador 2 passa a ver o item)
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await abrirAba(j2.pagina, "fichas");
  await expect(j2.pagina.getByTestId("ficha-item-pers-aldric")).toHaveCount(0);
  await abrir.click({ button: "right" });
  await m.getByTestId("menu-ficha-controla-jogador-2").click();
  await expect(menu).toBeVisible();
  await expect(m.getByTestId("menu-ficha-controla-jogador-2")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(j2.pagina.getByTestId("ficha-item-pers-aldric")).toBeVisible();
  await m.getByTestId("menu-ficha-controla-jogador-2").click();
  await expect(j2.pagina.getByTestId("ficha-item-pers-aldric")).toHaveCount(0);
  await m.keyboard.press("Escape");

  // o jogador que edita o item tem só "Abrir" e "Configurar…"
  const pj = j1.pagina;
  await abrirAba(pj, "fichas");
  await pj.getByTestId("ficha-abrir-pers-aldric").click({ button: "right" });
  await expect(pj.getByTestId("menu-ficha-abrir")).toBeVisible();
  await expect(pj.getByTestId("menu-ficha-configurar")).toBeVisible();
  await expect(pj.getByTestId("menu-ficha-apagar")).toHaveCount(0);
  await expect(pj.locator('[data-testid^="menu-ficha-mover-"]')).toHaveCount(0);
  await pj.keyboard.press("Escape");

  // apagar pede a confirmação dentro do próprio menu
  await abrir.click({ button: "right" });
  await m.getByTestId("menu-ficha-apagar").click();
  await expect(menu).toBeVisible();
  await expect(m.getByTestId("menu-ficha-apagar-confirmar")).toBeVisible();
  await m.getByTestId("menu-ficha-apagar-confirmar").click();
  await expect(m.getByTestId("ficha-item-pers-aldric")).toHaveCount(0);
});

test("o menu da pasta (botão direito e Shift+F10): renomear, quem vê e apagar (só vazia)", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  await abrirAba(m, "fichas");
  await abrirAba(j1.pagina, "fichas");
  const id = await novaPasta(m);
  const nome = m.getByTestId(`ficha-pasta-nome-${id}`);
  const menu = m.getByTestId("menu-ficha");

  // botão direito na linha: renomear, quem vê (marcado o atual) e apagar
  await nome.click({ button: "right" });
  await expect(menu).toBeVisible();
  await expect(m.getByTestId("menu-ficha-renomear")).toBeVisible();
  await expect(m.getByTestId("menu-ficha-visib-mestre")).toHaveAttribute("aria-checked", "true");
  await expect(m.getByTestId("menu-ficha-visib-todos")).toHaveAttribute("aria-checked", "false");
  await expect(m.getByTestId("menu-ficha-apagar")).toBeVisible();

  // "Renomear" abre o campo
  await m.getByTestId("menu-ficha-renomear").click();
  const campo = m.getByTestId(`ficha-pasta-nome-editar-${id}`);
  await expect(campo).toBeFocused();
  await campo.fill("Pistas");
  await campo.press("Enter");
  await expect(nome).toHaveText("Pistas");

  // quem vê: jogadores escolhidos
  await nome.click({ button: "right" });
  await m.getByTestId("menu-ficha-visib-jogador-1").click();
  await expect(menu).toBeVisible();
  await expect(m.getByTestId("menu-ficha-visib-jogador-1")).toHaveAttribute("aria-checked", "true");
  await expect(m.getByTestId("menu-ficha-visib-mestre")).toHaveAttribute("aria-checked", "false");
  await expect(j1.pagina.getByTestId(`ficha-pasta-nome-${id}`)).toHaveText("Pistas");
  // o jogador 1 não pode nem ver o menu da pasta
  await j1.pagina.getByTestId(`ficha-pasta-linha-${id}`).click({ button: "right" });
  await expect(j1.pagina.getByTestId("menu-ficha")).toHaveCount(0);
  // de volta ao mestre: some para ele
  await m.getByTestId("menu-ficha-visib-mestre").click();
  await expect(j1.pagina.getByTestId(`ficha-pasta-${id}`)).toHaveCount(0);
  await m.keyboard.press("Escape");

  // pelo teclado: foco no nome, Shift+F10
  await nome.focus();
  await m.keyboard.press("Shift+F10");
  await expect(menu).toBeVisible();
  await expect(m.getByTestId("menu-ficha-renomear")).toBeFocused();
  await m.keyboard.press("Escape");
  await expect(nome).toBeFocused();

  // pasta com item não se apaga (o item do menu diz por quê); vazia, apaga com confirmação
  await nome.click({ button: "right" });
  await m.getByTestId("menu-ficha-apagar").click();
  await m.getByTestId("menu-ficha-apagar-confirmar").click();
  await expect(m.getByTestId(`ficha-pasta-${id}`)).toHaveCount(0);
  await m.getByTestId("ficha-pasta-nome-pasta-personagens").click({ button: "right" });
  await expect(m.getByTestId("menu-ficha-apagar")).toHaveAttribute("aria-disabled", "true");
  await expect(m.getByTestId("menu-ficha-apagar")).toHaveAttribute("title", /pasta vazia/);
  await m.keyboard.press("Escape");
});

test("criar personagem pelo '+ Novo' abre a ficha em Configurar com 'Importar PDF' à vista; o importador abre dali", async ({
  mesa,
}) => {
  exigirPrivado("fixtures/fichas/darion.pdf");
  test.setTimeout(90_000);
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  await abrirAba(m, "fichas");
  await m.getByTestId("ficha-novo").click();
  await m.getByTestId("ficha-novo-personagem").click();

  const janela = m.getByTestId("janela-ficha");
  await expect(janela).toBeVisible();
  await expect(janela).toHaveAttribute("data-aba", "configurar");
  const botao = janela.getByTestId("editor-importar-pdf");
  await expect(botao).toBeVisible();
  await expect(botao).toHaveText("Importar PDF");
  // à vista: o botão está dentro da janela, sem precisar rolar
  const caixaDaJanela = await caixa(janela);
  const caixaDoBotao = await caixa(botao);
  expect(caixaDoBotao.y + caixaDoBotao.height).toBeLessThanOrEqual(
    caixaDaJanela.y + caixaDaJanela.height,
  );
  expect(caixaDoBotao.y).toBeGreaterThanOrEqual(caixaDaJanela.y);

  // o importador abre dali
  const [seletor] = await Promise.all([m.waitForEvent("filechooser"), botao.click()]);
  // o arquivo vai com um nome neutro: o nome do arquivo aparece na tela da revisão
  await seletor.setFiles({
    name: "ficha.pdf",
    mimeType: "application/pdf",
    buffer: readFileSync(PDF),
  });
  await expect(m.getByTestId("revisao-pdf")).toBeVisible();
  await expect(m.getByTestId("revisao-pdf")).toContainText("Importar PDF");
  await m.getByTestId("revisao-cancelar").click();
  await expect(m.getByTestId("revisao-pdf")).toBeHidden();

  // com o arquivo errado, o erro diz que nada foi importado
  const [outro] = await Promise.all([m.waitForEvent("filechooser"), botao.click()]);
  await outro.setFiles({
    name: "lixo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("isto não é um pdf"),
  });
  await expect(m.getByTestId("revisao-erro-leitura")).toContainText("Nada foi importado");
  await m.getByTestId("revisao-erro-leitura").getByRole("button", { name: "Fechar" }).click();

  // o botão de dentro da ficha de um item existente (o Darion, do jogador 1) também se chama só "Importar PDF"
  await mandar(m, "personagem.criar", {
    personagem: {
      id: "pers-teste-pdf",
      pastaId: "pasta-personagens",
      editores: { tipo: "jogadores", ids: ["jogador-1"] },
      nome: "Teste PDF",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      ficha: { pvAtual: 10, pvMax: 10 },
    },
  });
  const outraJanela = await abrirFicha(m, "pers-teste-pdf", "configurar");
  await expect(outraJanela.getByTestId("editor-importar-pdf")).toHaveText("Importar PDF");
});

test("a lista mostra três pastas (uma recolhida), fichas e handouts, e o jogador só vê o que lhe cabe", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  await abrirAba(m, "fichas");
  const extra = await novaPasta(m);
  const h = await criarHandoutPelaSala(m, {
    pastaId: extra,
    titulo: "Mapa do tesouro",
    visivel: { tipo: "jogadores", ids: ["jogador-1"] },
  });
  await criarHandoutPelaSala(m, { pastaId: extra, titulo: "Só do mestre" });
  await m.getByTestId("ficha-pasta-alternar-pasta-npcs").click();

  // o mestre: as três pastas, uma recolhida, e os itens nas outras
  await expect(m.locator('section[data-testid^="ficha-pasta-pasta-"]')).toHaveCount(3);
  await expect(m.getByTestId("ficha-pasta-alternar-pasta-npcs")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(m.getByTestId("ficha-item-pers-aldric")).toBeVisible();
  await expect(m.getByTestId(`handout-abrir-${h}`)).toBeVisible();

  // o jogador 1: a pasta "extra" aparece por causa do handout que ele vê, só com esse item
  await abrirAba(j1.pagina, "fichas");
  const pj = j1.pagina;
  await expect(pj.getByTestId(`ficha-pasta-${extra}`)).toBeVisible();
  await expect(pj.getByTestId(`handout-nome-${h}`)).toHaveText("Mapa do tesouro");
  await expect(pj.locator(`[data-testid="ficha-pasta-${extra}"] [data-handout-id]`)).toHaveCount(1);
  await expect(pj.getByTestId(`ficha-pasta-total-${extra}`)).toHaveText("1");
  expect(j1.frames.join("\n")).not.toContain("Só do mestre");
  // as pastas só do mestre (Personagens e NPCs) não chegam ao jogador, salvo o item que ele edita
  await expect(pj.getByTestId("ficha-pasta-pasta-npcs")).toHaveCount(0);
});
