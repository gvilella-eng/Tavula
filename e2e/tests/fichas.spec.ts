import type { Page } from "@playwright/test";
import {
  abrirAba,
  enviarCru,
  escolherCamada,
  expect,
  intencaoCrua,
  menuDaCena,
  test,
} from "./ajudas";
import { arquivoPng, escolherNoSeletor, imagensDoMapa, pngDeRuido } from "./ajudasAssets";
import {
  arrastarToken,
  entrarNoMapa,
  esperarPosicao,
  pontoNaPagina,
  tokenDe,
  tokensDe,
} from "./ajudasMapa";

// Lote 4b: pastas das Fichas (com sigilo), quem edita, arrastar para o mapa, retrato e token padrão,
// e a camada mapa.

/** Fichas → duplo clique no item (abre a janela da ficha) e vai para a aba (padrão: Configurar). */
async function abrirItem(p: Page, personagemId: string, aba = "configurar") {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${personagemId}`).dblclick();
  await expect(p.getByTestId("janela-ficha")).toBeVisible();
  await p.getByTestId(`ficha-aba-${aba}`).click();
  await expect(p.getByTestId(aba === "configurar" ? "editor-item" : `fh-aba-${aba}`)).toBeVisible();
}

async function fecharItem(p: Page) {
  await p.getByTestId("janela-ficha-fechar").click();
  await expect(p.getByTestId("janela-ficha")).toHaveCount(0);
}

/** "+ Novo" → NPC ou Personagem; o editor abre; dá o nome, fecha e devolve o id do item. */
async function novoItem(p: Page, tipo: "personagem" | "npc", nome: string): Promise<string> {
  await abrirAba(p, "fichas");
  await p.getByTestId("ficha-novo").click();
  await p.getByTestId(`ficha-novo-${tipo}`).click();
  const editor = p.getByTestId("editor-item");
  await expect(editor).toBeVisible();
  const id = (await editor.getAttribute("data-personagem-id")) as string;
  const campo = p.getByTestId(`personagem-nome-${id}`);
  await campo.fill(nome);
  await campo.blur();
  await expect(p.getByTestId("janela-ficha-nome")).toHaveText(nome);
  await fecharItem(p);
  return id;
}

/** Cria uma pasta (só do mestre, por padrão) com o nome dado; devolve o id. */
async function novaPasta(p: Page, nome: string): Promise<string> {
  await abrirAba(p, "fichas");
  const antes = await p.locator('[data-testid^="ficha-pasta-pasta-"]').count();
  await p.getByTestId("ficha-nova-pasta").click();
  await expect(p.locator('[data-testid^="ficha-pasta-pasta-"]')).toHaveCount(antes + 1);
  const ultima = p.locator('section[data-testid^="ficha-pasta-pasta-"]').last();
  const id = (await ultima.getAttribute("data-pasta-id")) as string;
  await p.getByTestId(`ficha-pasta-renomear-${id}`).click();
  const campo = p.getByTestId(`ficha-pasta-nome-editar-${id}`);
  await campo.fill(nome);
  await campo.press("Enter");
  await expect(p.getByTestId(`ficha-pasta-nome-${id}`)).toHaveText(nome);
  return id;
}

async function visibilidade(p: Page, pastaId: string, opcao: "todos" | "mestre") {
  await p.getByTestId(`ficha-pasta-visib-${pastaId}`).click();
  await p.getByTestId(`visib-${opcao}`).click();
  await p.keyboard.press("Escape");
}

/** Arrasta o item pela alça até a pasta (HTML5 drag and drop de verdade). */
async function arrastarItemParaPasta(p: Page, itemId: string, pastaId: string) {
  await p.getByTestId(`ficha-alca-${itemId}`).dragTo(p.getByTestId(`ficha-pasta-${pastaId}`));
}

const doJogador = (frames: string[]) => frames.join("\n");

test("frames: o jogador não recebe nome de pasta nem item de pasta só do mestre; mover para uma pasta de todos faz aparecer e voltar faz sumir", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await abrirAba(j1.pagina, "fichas");
  await abrirAba(j2.pagina, "fichas");

  const dragao = await novoItem(mestre.pagina, "npc", "Dragão Ancestral");
  const pasta = await novaPasta(mestre.pagina, "Pistas Reveladas");
  await expect(mestre.pagina.getByTestId(`ficha-item-${dragao}`)).toBeVisible();

  // controle positivo: o mestre recebeu tudo isso
  expect(doJogador(mestre.frames)).toContain("Dragão Ancestral");
  expect(doJogador(mestre.frames)).toContain("Pistas Reveladas");

  // o jogador nunca recebeu o nome das pastas só-mestre nem o item delas
  const segredos = ["Dragão Ancestral", "Pistas Reveladas", "NPCs", "pasta-npcs", dragao, pasta];
  await mestre.pagina.waitForTimeout(400);
  for (const j of [j1, j2]) {
    const textos = doJogador(j.frames);
    for (const segredo of segredos) expect(textos, segredo).not.toContain(segredo);
    await expect(j.pagina.getByTestId(`ficha-pasta-${pasta}`)).toHaveCount(0);
    await expect(j.pagina.getByTestId(`ficha-item-${dragao}`)).toHaveCount(0);
  }
  // forçando por fora: o item que ele não vê responde como inexistente
  const forcado = await enviarCru(
    j1.pagina,
    intencaoCrua("ficha.alterar", {
      personagemId: dragao,
      operacoes: [{ caminho: "pvAtual", valor: 1 }],
    }),
  );
  expect(forcado?.dados.codigo).toBe("personagem_inexistente");
  const pastaForcada = await enviarCru(
    j1.pagina,
    intencaoCrua("pasta.editar", { id: pasta, visivel: { tipo: "todos" } }),
  );
  expect(pastaForcada?.dados.codigo).toBe("sem_permissao");

  // mover o item para a pasta (ainda só do mestre): continua invisível
  await arrastarItemParaPasta(mestre.pagina, dragao, pasta);
  await expect(
    mestre.pagina.locator(
      `[data-testid="ficha-pasta-${pasta}"] [data-testid="ficha-item-${dragao}"]`,
    ),
  ).toBeVisible();
  await mestre.pagina.waitForTimeout(400);
  expect(doJogador(j1.frames)).not.toContain("Dragão Ancestral");

  // a pasta passa a ser de todos: o jogador recebe a pasta e o item (e só então o nome)
  await visibilidade(mestre.pagina, pasta, "todos");
  for (const j of [j1, j2]) {
    await expect(j.pagina.getByTestId(`ficha-pasta-nome-${pasta}`)).toHaveText("Pistas Reveladas");
    await expect(j.pagina.getByTestId(`ficha-item-${dragao}`)).toBeVisible();
    // só leitura: sem alça nem ações de pasta
    await expect(j.pagina.getByTestId(`ficha-alca-${dragao}`)).toHaveCount(0);
    await expect(j.pagina.getByTestId(`ficha-pasta-apagar-${pasta}`)).toHaveCount(0);
  }
  expect(doJogador(j1.frames)).toContain("Dragão Ancestral");

  // mover o item de volta para NPCs: some na hora para quem não o edita
  await arrastarItemParaPasta(mestre.pagina, dragao, "pasta-npcs");
  for (const j of [j1, j2]) {
    await expect(j.pagina.getByTestId(`ficha-item-${dragao}`)).toHaveCount(0);
  }
  const apagado = j1.frames.filter((f) => f.includes('"personagem.apagado"') && f.includes(dragao));
  expect(apagado.length).toBeGreaterThan(0);
  expect(apagado.join("")).not.toContain("Dragão");

  // e a pasta volta a ser só do mestre: some dos jogadores
  await visibilidade(mestre.pagina, pasta, "mestre");
  for (const j of [j1, j2]) {
    await expect(j.pagina.getByTestId(`ficha-pasta-${pasta}`)).toHaveCount(0);
  }
  // os itens que o jogador edita continuam, mesmo sem ver a pasta (ficam em "Seus itens")
  await expect(j1.pagina.getByTestId("ficha-pasta-avulsos")).toContainText("Aldric");
  await expect(j1.pagina.getByTestId("ficha-item-pers-brisa")).toHaveCount(0);

  // só pasta vazia é apagada: a de NPCs não, a nova sim
  await expect(mestre.pagina.getByTestId("ficha-pasta-apagar-pasta-npcs")).toBeDisabled();
  await mestre.pagina.getByTestId(`ficha-pasta-apagar-${pasta}`).click();
  await expect(mestre.pagina.getByTestId(`ficha-pasta-${pasta}`)).toHaveCount(0);
});

test("quem edita o personagem move o token e altera o PV; outro jogador não", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  const j3 = await entrarNoMapa(mesa, "jogador-3");

  // por padrão só o jogador 1 edita o Aldric
  await abrirAba(j2.pagina, "fichas");
  await expect(j2.pagina.getByTestId("ficha-item-pers-aldric")).toHaveCount(0);
  await arrastarToken(j2.pagina, "tok-jogador-1", 3, 0);
  await esperarPosicao(j2.pagina, "tok-jogador-1", 11.25, 9.75);

  // o mestre põe o jogador 2 como quem edita: o item aparece para ele e ele passa a controlar o token
  await abrirItem(mestre.pagina, "pers-aldric");
  await mestre.pagina.getByTestId("editor-editor-jogador-2").click();
  await expect(mestre.pagina.getByTestId("editor-editor-jogador-2")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(j2.pagina.getByTestId("ficha-item-pers-aldric")).toBeVisible();
  await abrirItem(j2.pagina, "pers-aldric", "principal");
  const campo = j2.pagina.getByTestId("pv-atual-pers-aldric");
  await expect(campo).toHaveValue("12");
  await campo.fill("7");
  await campo.blur();
  await mestre.pagina.getByTestId("ficha-aba-principal").click();
  await expect(mestre.pagina.getByTestId("pv-atual-pers-aldric")).toHaveValue("7");
  await mestre.pagina.getByTestId("ficha-aba-configurar").click();
  // quem edita não muda quem edita nem o nome
  await j2.pagina.getByTestId("ficha-aba-configurar").click();
  await expect(j2.pagina.getByTestId("editor-editor-jogador-3")).toBeDisabled();
  await expect(j2.pagina.getByTestId("personagem-nome-pers-aldric")).toBeDisabled();
  await fecharItem(j2.pagina);
  await arrastarToken(j2.pagina, "tok-jogador-1", 3, 0);
  await esperarPosicao(mestre.pagina, "tok-jogador-1", 14.25, 9.75);

  // o jogador 3 não vê o item, não move o token e não altera o PV (nem forçando por fora)
  await abrirAba(j3.pagina, "fichas");
  await expect(j3.pagina.getByTestId("ficha-item-pers-aldric")).toHaveCount(0);
  const mover = await enviarCru(
    j3.pagina,
    intencaoCrua("token.soltar", { id: "tok-jogador-1", x: 1, y: 1 }),
  );
  expect(mover?.dados.codigo).toBe("sem_permissao");
  const pv = await enviarCru(
    j3.pagina,
    intencaoCrua("ficha.alterar", {
      personagemId: "pers-aldric",
      operacoes: [{ caminho: "pvAtual", valor: 1 }],
    }),
  );
  expect(pv?.dados.codigo).toBe("personagem_inexistente");
  const editores = await enviarCru(
    j2.pagina,
    intencaoCrua("personagem.editar", {
      id: "pers-aldric",
      mudancas: { editores: { tipo: "todos" } },
    }),
  );
  expect(editores?.dados.codigo).toBe("sem_permissao");

  // "Todos os jogadores": o jogador 3 também passa a controlar
  await mestre.pagina.getByTestId("editor-editores-todos").click();
  await expect(j3.pagina.getByTestId("ficha-item-pers-aldric")).toBeVisible();
  await arrastarToken(j3.pagina, "tok-jogador-1", 0, 3);
  await esperarPosicao(mestre.pagina, "tok-jogador-1", 14.25, 12.75);

  // tira o jogador 2 de quem edita (volta a ser só o 1): ele perde o item e o controle
  await mestre.pagina.getByTestId("editor-editor-jogador-1").click(); // de "todos" para só o jogador 1
  await expect(mestre.pagina.getByTestId("editor-editor-jogador-1")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(j2.pagina.getByTestId("ficha-item-pers-aldric")).toHaveCount(0);
  await expect(j3.pagina.getByTestId("ficha-item-pers-aldric")).toHaveCount(0);
  await arrastarToken(j2.pagina, "tok-jogador-1", 3, 0);
  await esperarPosicao(mestre.pagina, "tok-jogador-1", 14.25, 12.75);
  await arrastarToken(j1.pagina, "tok-jogador-1", 0, -3);
  await esperarPosicao(mestre.pagina, "tok-jogador-1", 14.25, 9.75);
});

test("arrastar um item das Fichas para o mapa cria o token na cena que o mestre está vendo, onde soltou", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const lobo = await novoItem(mestre.pagina, "npc", "Lobo Cinzento");
  const urso = await novoItem(mestre.pagina, "npc", "Urso Pardo");
  await abrirAba(mestre.pagina, "fichas");

  // solta o Lobo num ponto do mapa (a cena do grupo)
  const alvo = await pontoNaPagina(mestre.pagina, 18.75, 14.25);
  await mestre.pagina
    .getByTestId(`ficha-alca-${lobo}`)
    .dragTo(mestre.pagina.getByTestId("mapa"), { targetPosition: { x: alvo.x, y: alvo.y } });
  const encaixe = (v: number) => (Math.floor(v / 1.5) + 0.5) * 1.5;
  await expect
    .poll(async () => (await tokensDe(mestre.pagina)).find((t) => t.nome === "Lobo Cinzento"))
    .toMatchObject({ x: encaixe(18.75), y: encaixe(14.25), camada: "tokens" });
  // o jogador vê (camada tokens, não oculto)
  await expect
    .poll(async () => (await tokensDe(j1.pagina)).some((t) => t.nome === "Lobo Cinzento"))
    .toBe(true);
  // o item é o mesmo: um clique no item continua abrindo o editor
  await expect(mestre.pagina.getByTestId(`ficha-item-${lobo}`)).toBeVisible();

  // vendo outra cena, o token nasce nela (e o jogador não recebe nada)
  await menuDaCena(mestre.pagina, "cena-covil", "ir");
  await expect(mestre.pagina.getByTestId("cena-nome")).toHaveText("Covil");
  const antes = j1.frames.length;
  const alvo2 = await pontoNaPagina(mestre.pagina, 14.25, 14.25);
  await mestre.pagina
    .getByTestId(`ficha-alca-${urso}`)
    .dragTo(mestre.pagina.getByTestId("mapa"), { targetPosition: { x: alvo2.x, y: alvo2.y } });
  await expect
    .poll(async () => (await tokensDe(mestre.pagina)).find((t) => t.nome === "Urso Pardo"))
    .toMatchObject({ x: encaixe(14.25), y: encaixe(14.25) });
  await mestre.pagina.waitForTimeout(500);
  expect(doJogador(j1.frames.slice(antes))).not.toContain("Urso Pardo");
  expect((await tokensDe(j1.pagina)).some((t) => t.nome === "Urso Pardo")).toBe(false);

  // o jogador não arrasta (sem alça) e forçar a colocação é recusado
  await abrirAba(j1.pagina, "fichas");
  await expect(j1.pagina.getByTestId("ficha-alca-pers-aldric")).toHaveCount(0);
  const colocar = await enviarCru(
    j1.pagina,
    intencaoCrua("personagem.colocar", {
      personagemId: "pers-aldric",
      cenaId: "cena-1",
      tokenId: "tok-forcado",
    }),
  );
  expect(colocar?.dados.codigo).toBe("sem_permissao");
});

test("retrato e token padrão escolhidos no editor aparecem (na lista, no editor e no mapa); quem edita também troca", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  const arqueiro = await novoItem(mestre.pagina, "npc", "Arqueiro");

  await abrirItem(mestre.pagina, arqueiro);
  const editor = mestre.pagina.getByTestId("editor-item");
  await expect(editor.locator('[data-com-imagem="true"]')).toHaveCount(0);
  await mestre.pagina.getByTestId("editor-retrato").click();
  await escolherNoSeletor(mestre.pagina, arquivoPng("retrato.png", pngDeRuido(240, 300, 71, 4)));
  await expect(
    mestre.pagina.locator('[data-testid="editor-retrato"] [data-com-imagem="true"]'),
  ).toBeVisible();
  await mestre.pagina.getByTestId("editor-token").click();
  await escolherNoSeletor(mestre.pagina, arquivoPng("token.png", pngDeRuido(200, 200, 72, 4)));
  await expect(
    mestre.pagina.locator('[data-testid="editor-token"] [data-com-imagem="true"]'),
  ).toBeVisible();
  // o retrato aparece também na lista; o token padrão vai para o token colocado na cena
  await mestre.pagina.getByTestId(`personagem-colocar-${arqueiro}`).click();
  await expect(mestre.pagina.getByTestId("editor-item")).toHaveCount(0);
  await expect
    .poll(async () => (await tokensDe(mestre.pagina)).find((t) => t.nome === "Arqueiro")?.id)
    .toBeTruthy();
  const tokenId = (await tokensDe(mestre.pagina)).find((t) => t.nome === "Arqueiro")?.id as string;
  await expect
    .poll(async () => (await imagensDoMapa(mestre.pagina)).tokensComImagem)
    .toContain(tokenId);
  await expect(
    mestre.pagina.locator(`[data-testid="ficha-item-${arqueiro}"] [data-com-imagem="true"]`),
  ).toBeVisible();
  // o jogador vê o token com a imagem (visível) mas não o item do NPC
  await expect
    .poll(async () => (await imagensDoMapa(j1.pagina)).tokensComImagem)
    .toContain(tokenId);
  await abrirAba(j2.pagina, "fichas");
  await expect(j2.pagina.getByTestId(`ficha-item-${arqueiro}`)).toHaveCount(0);

  // quem edita o Aldric (jogador 1) troca o retrato dele (asset.subir); o mestre recebe e vê
  await abrirItem(j1.pagina, "pers-aldric");
  await expect(j1.pagina.getByTestId("editor-retrato")).toBeEnabled();
  await j1.pagina.getByTestId("editor-retrato").click();
  await escolherNoSeletor(j1.pagina, arquivoPng("aldric-retrato.png", pngDeRuido(240, 300, 73, 4)));
  await expect(
    j1.pagina.locator('[data-testid="editor-retrato"] [data-com-imagem="true"]'),
  ).toBeVisible();
  await expect(
    mestre.pagina.locator('[data-testid="ficha-item-pers-aldric"] [data-com-imagem="true"]'),
  ).toBeVisible({ timeout: 30_000 });
  // quem não edita nem vê o item não tem o retrato
  await expect(j2.pagina.getByTestId("ficha-item-pers-aldric")).toHaveCount(0);

  // numa pasta de todos o item (e o retrato) chega a quem só vê: a caixa não abre o seletor
  const galeria = await novaPasta(mestre.pagina, "Galeria");
  await visibilidade(mestre.pagina, galeria, "todos");
  await arrastarItemParaPasta(mestre.pagina, arqueiro, galeria);
  await expect(
    j2.pagina.locator(`[data-testid="ficha-item-${arqueiro}"] [data-com-imagem="true"]`),
  ).toBeVisible({ timeout: 30_000 });
  await abrirItem(j2.pagina, arqueiro);
  await expect(j2.pagina.getByTestId("editor-retrato")).toBeDisabled();
  // sem `ficha.verOutras`, quem só vê o item não recebe a ficha (nem os PV)
  await expect(j2.pagina.getByTestId("ficha-oculta")).toBeVisible();
  await expect(j2.pagina.getByTestId(`pv-atual-${arqueiro}`)).toHaveCount(0);
  await expect(j2.pagina.getByTestId("editor-pasta-visivel")).toContainText("todos os jogadores");
});

test("token na camada mapa: o jogador vê e não move; o mestre seleciona e move só com a camada mapa", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");

  await escolherCamada(mestre.pagina, "mapa");
  await mestre.pagina.getByTestId("novo-token").click();
  await expect(mestre.pagina.getByTestId("painel-token")).toBeVisible();
  await expect(mestre.pagina.getByTestId("token-camada")).toHaveValue("mapa");
  await mestre.pagina.getByTestId("token-nome").fill("Estátua");
  await mestre.pagina.getByTestId("token-nome").press("Enter");
  // o mestre o põe sob o controle do jogador 1: ainda assim ele não o move
  await mestre.pagina.getByTestId("token-controla-jogador-1").click();

  await expect
    .poll(async () => (await tokensDe(j1.pagina)).find((t) => t.nome === "Estátua"))
    .toMatchObject({ camada: "mapa" });
  const estatua = (await tokensDe(j1.pagina)).find((t) => t.nome === "Estátua");
  const id = estatua?.id as string;
  const antes = j1.enviados.length;
  await arrastarToken(j1.pagina, id, 3, 0);
  await j1.pagina.waitForTimeout(300);
  expect(j1.enviados.slice(antes).filter((f) => f.includes('"token.'))).toEqual([]);
  expect(await tokenDe(j1.pagina, id)).toMatchObject({ x: estatua?.x, y: estatua?.y });
  const forcado = await enviarCru(j1.pagina, intencaoCrua("token.soltar", { id, x: 1, y: 1 }));
  expect(forcado?.dados.codigo).toBe("sem_permissao");

  // o mestre move com a camada de trabalho mapa
  await arrastarToken(mestre.pagina, id, 3, 0);
  await expect
    .poll(async () => (await tokenDe(j1.pagina, id)).x)
    .toBeGreaterThan((estatua?.x ?? 0) + 1);

  // com a camada tokens, o cenário não é selecionável (o painel fecha ao clicar nele)
  await escolherCamada(mestre.pagina, "tokens");
  const t = await tokenDe(mestre.pagina, id);
  const pos = await pontoNaPagina(mestre.pagina, t.x, t.y);
  await mestre.pagina.mouse.click(pos.x, pos.y);
  await expect(mestre.pagina.getByTestId("painel-token")).toHaveCount(0);
  const antesDoArraste = await tokenDe(mestre.pagina, id);
  await arrastarToken(mestre.pagina, id, -3, 0);
  expect(await tokenDe(mestre.pagina, id)).toMatchObject({
    x: antesDoArraste.x,
    y: antesDoArraste.y,
  });
});
