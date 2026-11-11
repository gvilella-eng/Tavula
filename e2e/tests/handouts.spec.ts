import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, intencaoCrua, type Sessao, test } from "./ajudas";
import { arquivoPng, escolherNoSeletor, pngDeRuido } from "./ajudasAssets";
import { abrirHandout, criarHandoutPelaSala } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// V3: handouts (título, texto numa de 5 fontes, imagem pequena, quem vê) dentro das Fichas, "Mostrar agora" e a
// migração das notas antigas. O sigilo (a sala não manda o handout, nem o título, a quem não o vê) é conferido
// nos frames que o jogador recebe.

const FONTES = [
  { id: "simples", nome: "Simples", familia: "Inter Variable" },
  { id: "livro", nome: "Livro", familia: "Lora Variable" },
  { id: "manuscrito", nome: "Manuscrito", familia: "Caveat Variable" },
  { id: "medieval", nome: "Medieval", familia: "MedievalSharp" },
  { id: "datilografado", nome: "Datilografado", familia: "Special Elite" },
] as const;

const janelaDe = (p: Page, id: string) =>
  p.locator(`[data-testid="janela-handout"][data-handout-id="${id}"]`);

const doJogador = (s: Sessao) => s.frames.join("\n");

test("'+ Novo' → Handout: cria na pasta Handouts, escreve, troca as 5 fontes (a fonte computada muda) e põe uma imagem", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const requisicoes: string[] = [];
  p.on("request", (r) => requisicoes.push(r.url()));
  await abrirAba(p, "fichas");
  await expect(p.getByTestId("ficha-pasta-pasta-handouts")).toHaveCount(0);

  await p.getByTestId("ficha-novo").click();
  await p.getByTestId("ficha-novo-handout").click();
  // a pasta "Handouts" nasce e o handout novo abre numa janela
  const janela = p.locator('[data-testid="janela-handout"]');
  await expect(janela).toBeVisible();
  const id = (await janela.getAttribute("data-handout-id")) as string;
  await expect(p.getByTestId("ficha-pasta-nome-pasta-handouts")).toHaveText("Handouts");
  await expect(
    p.locator(`[data-testid="ficha-pasta-pasta-handouts"] [data-testid="handout-item-${id}"]`),
  ).toBeVisible();
  await expect(p.getByTestId(`handout-nome-${id}`)).toHaveText("Novo handout");
  // sem imagem: o pergaminho na lista, à esquerda do título
  const miniatura = p.getByTestId(`handout-item-${id}`).getByTestId("handout-miniatura");
  await expect(miniatura).toHaveAttribute("data-com-imagem", "false");
  const caixaMini = (await miniatura.boundingBox()) as { x: number; width: number };
  const caixaNome = (await p.getByTestId(`handout-nome-${id}`).boundingBox()) as { x: number };
  expect(caixaMini.x + caixaMini.width).toBeLessThanOrEqual(caixaNome.x + 1);

  // título: confirma ao sair do campo e vai para a lista e para o cabeçalho
  const titulo = janela.getByTestId("handout-titulo-campo");
  await titulo.fill("O Livro dos Ossos");
  await titulo.press("Enter");
  await expect(p.getByTestId(`handout-nome-${id}`)).toHaveText("O Livro dos Ossos");
  await expect(janela.getByTestId("janela-handout-titulo")).toHaveText("O Livro dos Ossos");

  // texto
  const texto = janela.getByTestId("handout-texto-campo");
  await texto.fill("Na primeira página, escrito a sangue:\n\n  Não abra a terceira porta.");
  await expect(texto).toHaveValue(/terceira porta/);

  // as 5 fontes: cada uma muda a fonte computada do texto (e o botão é escrito na própria fonte)
  const vistas = new Set<string>();
  for (const f of FONTES) {
    const botao = janela.getByTestId(`handout-fonte-${f.id}`);
    await expect(botao).toHaveText(f.nome);
    await expect(botao).toHaveCSS("font-family", new RegExp(f.familia));
    await botao.click();
    await expect(botao).toHaveAttribute("aria-pressed", "true");
    await expect(texto).toHaveAttribute("data-fonte", f.id);
    await expect(texto).toHaveCSS("font-family", new RegExp(f.familia));
    vistas.add(await texto.evaluate((e) => getComputedStyle(e).fontFamily));
  }
  expect(vistas.size).toBe(5);
  // a fonte fica na sala: um reload e ela continua
  await p.reload();
  const depois = await abrirHandout(p, id);
  await expect(depois.getByTestId("handout-texto-campo")).toHaveAttribute(
    "data-fonte",
    "datilografado",
  );

  // as famílias estão empacotadas: o navegador as tem sem buscar nada fora
  for (const f of FONTES) {
    const carregada = await p.evaluate(async (familia) => {
      await document.fonts.load(`16px "${familia}"`);
      return document.fonts.check(`16px "${familia}"`);
    }, f.familia);
    expect(carregada, f.familia).toBe(true);
  }

  // imagem: escolhe no seletor; aparece no botão e na lista
  const escolher = depois.getByTestId("handout-imagem-escolher");
  await expect(escolher).toHaveAttribute("data-com-imagem", "false");
  await escolher.click();
  await escolherNoSeletor(p, arquivoPng("handout.png", pngDeRuido(240, 300, 91, 4)));
  await expect(escolher).toHaveAttribute("data-com-imagem", "true", { timeout: 30_000 });
  await expect(
    p.getByTestId(`handout-item-${id}`).getByTestId("handout-miniatura"),
  ).toHaveAttribute("data-com-imagem", "true");
  await depois.getByTestId("handout-imagem-tirar").click();
  await expect(escolher).toHaveAttribute("data-com-imagem", "false");
  await expect(depois.getByTestId("handout-imagem-tirar")).toHaveCount(0);

  // nada foi buscado fora da máquina (fontes, imagens, nada)
  expect(
    requisicoes.filter((u) => !/^(http:\/\/127\.0\.0\.1|blob:|data:|about:|ws:)/.test(u)),
  ).toEqual([]);
});

test("o jogador não recebe o handout só do mestre (frames) e recebe ao ganhar a permissão; ao perdê-la, ele some", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  const id = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "TITULO-SECRETO",
    texto: "TEXTO-SECRETO",
  });
  const m = mestre.pagina;
  await abrirAba(m, "fichas");
  await abrirAba(j1.pagina, "fichas");
  await abrirAba(j2.pagina, "fichas");
  await expect(m.getByTestId(`handout-nome-${id}`)).toHaveText("TITULO-SECRETO");
  // o mestre vê quem vê: só ele (cadeado)
  await expect(m.getByTestId(`handout-quem-ve-${id}`)).toHaveAttribute("data-visivel", "mestre");

  // controle positivo: o mestre recebeu; os jogadores, nada (nem o título, nem a pasta)
  expect(doJogador(mestre)).toContain("TITULO-SECRETO");
  for (const j of [j1, j2]) {
    expect(doJogador(j)).not.toContain("TITULO-SECRETO");
    expect(doJogador(j)).not.toContain("TEXTO-SECRETO");
    await expect(j.pagina.getByTestId(`handout-item-${id}`)).toHaveCount(0);
    await expect(j.pagina.getByTestId("ficha-pasta-pasta-personagens")).toHaveCount(0);
  }
  // forçando por fora, o jogador não cria, edita, apaga nem mostra
  for (const [tipo, dados] of [
    ["handout.editar", { id, mudancas: { visivel: { tipo: "todos" } } }],
    ["handout.apagar", { id }],
    ["handout.mostrar", { id }],
    [
      "handout.criar",
      {
        handout: {
          id: "invasor",
          pastaId: "pasta-personagens",
          titulo: "x",
          texto: "",
          fonte: "livro",
          visivel: { tipo: "todos" },
        },
      },
    ],
  ] as const) {
    const r = await enviarCru(j1.pagina, intencaoCrua(tipo, dados));
    expect(r?.dados.codigo, tipo).toBe("sem_permissao");
  }

  // o mestre dá a permissão ao jogador 1 (na janela do handout): ele passa a ver; o jogador 2 não
  const janela = await abrirHandout(m, id);
  await janela.getByTestId("handout-visib-jogador-jogador-1").click();
  await expect(janela.getByTestId("handout-visib-jogador-jogador-1")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(j1.pagina.getByTestId(`handout-nome-${id}`)).toHaveText("TITULO-SECRETO");
  await expect(j1.pagina.getByTestId(`ficha-pasta-pasta-personagens`)).toBeVisible();
  await expect(j1.pagina.getByTestId("ficha-pasta-total-pasta-personagens")).toBeVisible();
  expect(doJogador(j1)).toContain("TITULO-SECRETO");
  await expect(j2.pagina.getByTestId(`handout-item-${id}`)).toHaveCount(0);
  expect(doJogador(j2)).not.toContain("TITULO-SECRETO");
  // o jogador 1 lê, sem editar
  const doLeitor = await abrirHandout(j1.pagina, id);
  await expect(doLeitor.getByTestId("handout-texto")).toHaveText("TEXTO-SECRETO");
  await expect(doLeitor.getByTestId("handout-editor")).toHaveCount(0);
  await expect(doLeitor.getByTestId("handout-texto-campo")).toHaveCount(0);

  // todos os jogadores: o jogador 2 passa a ver
  await janela.getByTestId("handout-visib-todos").click();
  await expect(j2.pagina.getByTestId(`handout-nome-${id}`)).toHaveText("TITULO-SECRETO");

  // de volta ao mestre: some dos dois, e a janela aberta do jogador 1 some junto; o aviso que chegou não traz o título
  const antes = j1.frames.length;
  await janela.getByTestId("handout-visib-mestre").click();
  for (const j of [j1, j2]) {
    await expect(j.pagina.getByTestId(`handout-item-${id}`)).toHaveCount(0);
    await expect(j.pagina.getByTestId("ficha-pasta-pasta-personagens")).toHaveCount(0);
  }
  await expect(janelaDe(j1.pagina, id)).toHaveCount(0);
  // o que chegou depois (um snapshot novo: mudar quem vê o handout o manda a todos) não traz o handout nem o título
  const depois = j1.frames.slice(antes).join("\n");
  expect(depois).not.toContain("TITULO-SECRETO");
  expect(depois).not.toContain("TEXTO-SECRETO");
});

test("'Mostrar agora' abre o handout na tela de quem pode vê-lo, na hora, e não na de quem não pode", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  const id = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "Carta do rei",
    texto: "Venham à corte ao amanhecer.",
    fonte: "manuscrito",
  });
  const m = mestre.pagina;
  await abrirAba(m, "fichas");
  const janela = await abrirHandout(m, id);

  // handout só do mestre: o botão explica que ninguém mais o vê e nada é enviado
  const botao = janela.getByTestId("handout-mostrar");
  await expect(botao).toHaveAttribute("aria-disabled", "true");
  await expect(janela.getByTestId("handout-mostrar-aviso")).toContainText("ninguém mais");
  await botao.hover();
  await expect(m.getByTestId("dica-handout-mostrar")).toContainText("Só você vê este handout");
  const enviadosAntes = mestre.enviados.length;
  await botao.click({ force: true });
  await m.waitForTimeout(300);
  expect(mestre.enviados.slice(enviadosAntes).filter((f) => f.includes("handout.mostrar"))).toEqual(
    [],
  );
  await expect(janelaDe(j1.pagina, id)).toHaveCount(0);

  // só o jogador 1 vê; ele já tem a lista (sem janela aberta); o botão passa a valer
  await janela.getByTestId("handout-visib-jogador-jogador-1").click();
  await expect(botao).not.toHaveAttribute("aria-disabled", "true");
  await expect(janela.getByTestId("handout-mostrar-aviso")).toHaveCount(0);
  await abrirAba(j1.pagina, "fichas");
  await expect(j1.pagina.getByTestId(`handout-nome-${id}`)).toHaveText("Carta do rei");
  await expect(janelaDe(j1.pagina, id)).toHaveCount(0);
  const antes2 = j2.frames.length;
  await botao.click();
  // abre na tela do jogador 1, com o texto na fonte escolhida
  const naTela = janelaDe(j1.pagina, id);
  await expect(naTela).toBeVisible();
  await expect(naTela.getByTestId("handout-texto")).toHaveText("Venham à corte ao amanhecer.");
  await expect(naTela.getByTestId("handout-texto")).toHaveCSS("font-family", /Caveat Variable/);
  await expect(naTela.getByTestId("handout-titulo")).toHaveText("Carta do rei");
  await expect(janela.getByTestId("handout-mostrado-aviso")).toContainText("Jogador 1");
  // o jogador 2 não recebe nada: nem a janela, nem o evento, nem o título
  await m.waitForTimeout(400);
  await expect(janelaDe(j2.pagina, id)).toHaveCount(0);
  expect(j2.frames.slice(antes2).join("\n")).not.toContain("Carta do rei");
  expect(j2.frames.slice(antes2).join("\n")).not.toContain("handout.mostrado");

  // o jogador fecha a janela e o mestre mostra de novo: abre de novo; mostrar com ela aberta não duplica
  await j1.pagina.getByTestId("janela-handout-fechar").click();
  await expect(janelaDe(j1.pagina, id)).toHaveCount(0);
  await botao.click();
  await expect(janelaDe(j1.pagina, id)).toBeVisible();
  await botao.click();
  await expect(janelaDe(j1.pagina, id)).toHaveCount(1);

  // todos os jogadores: agora o jogador 2 também recebe, na hora
  await janela.getByTestId("handout-visib-todos").click();
  await expect(j2.pagina.getByTestId(`handout-nome-${id}`)).toHaveText("Carta do rei");
  await botao.click();
  await expect(janelaDe(j2.pagina, id)).toBeVisible();
  await expect(janelaDe(j2.pagina, id).getByTestId("handout-editor")).toHaveCount(0);
});

test("o jogador lê o handout: título, imagem no alto e texto na fonte escolhida, sem editar", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const id = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "Pergaminho",
    texto: "Linha um\nLinha dois",
    fonte: "medieval",
    visivel: { tipo: "todos" },
  });
  const m = mestre.pagina;
  const janelaDoMestre = await abrirHandout(m, id);
  await janelaDoMestre.getByTestId("handout-imagem-escolher").click();
  await escolherNoSeletor(m, arquivoPng("pergaminho.png", pngDeRuido(240, 300, 92, 4)));
  await expect(janelaDoMestre.getByTestId("handout-imagem-escolher")).toHaveAttribute(
    "data-com-imagem",
    "true",
    { timeout: 30_000 },
  );

  const leitura = await abrirHandout(j1.pagina, id);
  await expect(leitura.getByTestId("handout-titulo")).toHaveText("Pergaminho");
  const texto = leitura.getByTestId("handout-texto");
  await expect(texto).toHaveText("Linha um\nLinha dois");
  await expect(texto).toHaveCSS("white-space", "pre-wrap");
  await expect(texto).toHaveCSS("font-family", /MedievalSharp/);
  // a imagem (que chega pelo caminho dos arquivos) fica no alto, antes do título
  const imagem = leitura.getByTestId("handout-imagem");
  await expect(imagem).toHaveAttribute("data-com-imagem", "true", { timeout: 30_000 });
  const caixaImagem = (await imagem.boundingBox()) as { y: number; height: number };
  const caixaTitulo = (await leitura.getByTestId("handout-titulo").boundingBox()) as { y: number };
  expect(caixaImagem.y + caixaImagem.height).toBeLessThanOrEqual(caixaTitulo.y + 1);
  await expect(
    j1.pagina.getByTestId(`handout-item-${id}`).getByTestId("handout-miniatura"),
  ).toHaveAttribute("data-com-imagem", "true", { timeout: 30_000 });
  // sem controles de edição
  for (const t of ["handout-editor", "handout-fontes", "handout-quem-ve", "handout-apagar"]) {
    await expect(leitura.getByTestId(t)).toHaveCount(0);
  }
  // sem o menu de botão direito do mestre
  await j1.pagina.getByTestId(`handout-abrir-${id}`).click({ button: "right" });
  await expect(j1.pagina.getByTestId("menu-ficha")).toHaveCount(0);
});

test("menu de botão direito do handout: abrir, mostrar, quem vê, mover e apagar; arrastar para outra pasta", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  await abrirAba(m, "fichas");
  await abrirAba(j1.pagina, "fichas");
  const id = await criarHandoutPelaSala(m, { titulo: "Bilhete" });
  const item = m.getByTestId(`handout-abrir-${id}`);
  const menu = m.getByTestId("menu-ficha");

  await item.click({ button: "right" });
  await expect(menu).toBeVisible();
  for (const a of [
    "abrir",
    "mostrar",
    "visib-mestre",
    "visib-todos",
    "visib-jogador-1",
    "mover-pasta-npcs",
    "apagar",
  ]) {
    await expect(m.getByTestId(`menu-ficha-${a}`), a).toBeVisible();
  }
  // "Mostrar agora" desabilitado enquanto só o mestre vê
  await expect(m.getByTestId("menu-ficha-mostrar")).toHaveAttribute("aria-disabled", "true");
  await m.getByTestId("menu-ficha-visib-jogador-1").click();
  await expect(j1.pagina.getByTestId(`handout-item-${id}`)).toBeVisible();
  await expect(m.getByTestId("menu-ficha-mostrar")).not.toHaveAttribute("aria-disabled", "true");
  await m.getByTestId("menu-ficha-mostrar").click();
  await expect(janelaDe(j1.pagina, id)).toBeVisible();
  await expect(menu).toHaveCount(0);

  // pelo teclado (Shift+F10) e mover para a pasta NPCs
  await item.focus();
  await m.keyboard.press("Shift+F10");
  await expect(m.getByTestId("menu-ficha-abrir")).toBeFocused();
  await m.getByTestId("menu-ficha-mover-pasta-npcs").click();
  await expect(
    m.locator(`[data-testid="ficha-pasta-pasta-npcs"] [data-testid="handout-item-${id}"]`),
  ).toBeVisible();
  // o jogador 1 continua vendo o handout (a pasta NPCs chega só por causa dele)
  await expect(
    j1.pagina.locator(`[data-testid="ficha-pasta-pasta-npcs"] [data-testid="handout-item-${id}"]`),
  ).toBeVisible();

  // arrastar para outra pasta
  await m.getByTestId(`handout-abrir-${id}`).dragTo(m.getByTestId("ficha-pasta-pasta-personagens"));
  await expect(
    m.locator(`[data-testid="ficha-pasta-pasta-personagens"] [data-testid="handout-item-${id}"]`),
  ).toBeVisible();

  // apagar (com confirmação no menu) tira o handout de todos
  await m.getByTestId(`handout-abrir-${id}`).click({ button: "right" });
  await m.getByTestId("menu-ficha-apagar").click();
  await m.getByTestId("menu-ficha-apagar-confirmar").click();
  await expect(m.getByTestId(`handout-item-${id}`)).toHaveCount(0);
  await expect(j1.pagina.getByTestId(`handout-item-${id}`)).toHaveCount(0);
  await expect(janelaDe(j1.pagina, id)).toHaveCount(0);
});

test("migração: o estado com notaMesa e notaMestre vira dois handouts (a da mesa para todos, a do mestre só para ele)", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  await abrirAba(m, "mesa");
  const [download] = await Promise.all([
    m.waitForEvent("download"),
    m.getByTestId("exportar").click(),
  ]);
  const atual = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(atual.versao).toBe(13);
  // uma exportação como a do V2: versão 12, com as notas no estado e sem handouts
  const { handouts: _h, ...dados } = atual.dados;
  const antiga = {
    ...atual,
    versao: 12,
    dados: {
      ...dados,
      notaMesa: "Reunião na taverna às oito.",
      notaMestre: "O taverneiro é o vilão.",
    },
  };
  await m.getByTestId("importar-arquivo").setInputFiles({
    name: "campanha-antiga.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(antiga)),
  });

  await abrirAba(m, "fichas");
  await expect(m.getByTestId("ficha-pasta-nome-pasta-handouts")).toHaveText("Handouts");
  await expect(m.getByTestId("handout-nome-handout-nota-da-mesa")).toHaveText("Nota da mesa");
  await expect(m.getByTestId("handout-nome-handout-nota-do-mestre")).toHaveText("Nota do mestre");
  await expect(m.getByTestId("handout-quem-ve-handout-nota-da-mesa")).toHaveAttribute(
    "data-visivel",
    "todos",
  );
  await expect(m.getByTestId("handout-quem-ve-handout-nota-do-mestre")).toHaveAttribute(
    "data-visivel",
    "mestre",
  );
  const daMesa = await abrirHandout(m, "handout-nota-da-mesa");
  await expect(daMesa.getByTestId("handout-texto-campo")).toHaveValue(
    "Reunião na taverna às oito.",
  );

  // o jogador recebe só a da mesa (e a pasta por causa dela); nunca o texto do mestre
  await abrirAba(j1.pagina, "fichas");
  await expect(j1.pagina.getByTestId("handout-nome-handout-nota-da-mesa")).toHaveText(
    "Nota da mesa",
  );
  await expect(j1.pagina.getByTestId("handout-item-handout-nota-do-mestre")).toHaveCount(0);
  const lido = await abrirHandout(j1.pagina, "handout-nota-da-mesa");
  await expect(lido.getByTestId("handout-texto")).toHaveText("Reunião na taverna às oito.");
  expect(doJogador(j1)).not.toContain("O taverneiro é o vilão");
  expect(doJogador(j1)).not.toContain("notaMestre");
  expect(doJogador(j1)).not.toContain("notaMesa");

  // a exportação nova leva os handouts (v13) e não leva mais as notas
  await abrirAba(m, "mesa");
  const [segundo] = await Promise.all([
    m.waitForEvent("download"),
    m.getByTestId("exportar").click(),
  ]);
  const nova = JSON.parse(readFileSync(await segundo.path(), "utf8"));
  expect(nova.versao).toBe(13);
  expect(nova.dados.handouts.map((h: { titulo: string }) => h.titulo)).toEqual([
    "Nota da mesa",
    "Nota do mestre",
  ]);
  expect(nova.dados.notaMesa).toBeUndefined();
  expect(nova.dados.notaMestre).toBeUndefined();
});

test("um handout pode ser aberto em várias janelas ao mesmo tempo e cada uma guarda a sua posição", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  const a = await criarHandoutPelaSala(m, { titulo: "Primeiro" });
  const b = await criarHandoutPelaSala(m, { titulo: "Segundo" });
  const ja = await abrirHandout(m, a);
  const jb = await abrirHandout(m, b);
  await expect(m.locator('[data-testid="janela-handout"]')).toHaveCount(2);
  const ca = (await ja.boundingBox()) as { x: number; y: number };
  const cb = (await jb.boundingBox()) as { x: number; y: number };
  // a segunda não cobre a primeira por inteiro (cascata) e as duas ficam dentro da área do mapa
  expect(cb.x !== ca.x || cb.y !== ca.y).toBe(true);
  const area = (await m.getByTestId("area-do-mapa").boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  for (const c of [ca, cb]) {
    expect(c.x).toBeGreaterThanOrEqual(area.x - 1);
    expect(c.y).toBeGreaterThanOrEqual(area.y - 1);
  }
  await m.getByTestId("janela-handout-fechar").first().click();
  await expect(m.locator('[data-testid="janela-handout"]')).toHaveCount(1);
});
