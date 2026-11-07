import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirFaixa,
  enviarCru,
  esperarMapa,
  expect,
  intencaoCrua,
  type Mesa,
  menuDaCena,
  type Sessao,
  test,
} from "./ajudas";
import {
  arquivoPng,
  assets,
  definirMapa,
  esperarPronto,
  imagemDoTokenSelecionado,
  imagensDoMapa,
  type MetaVista,
  metaPorNome,
  pngDeRuido,
} from "./ajudasAssets";

// Lote 4: personagens e cenas. O sigilo de cena é testado olhando os frames que o jogador recebe
// (texto e binários); o pré-envio cifrado, pelos pedaços que ele baixa antes e depois da ida.

type Gancho = {
  tokens(): { id: string; nome: string; x: number; y: number }[];
  paraTela(x: number, y: number): { x: number; y: number };
  centrarEm(x: number, y: number): void;
  definirZoom(z: number): void;
  zoom(): number;
  bandeira(): { x: number; y: number } | null;
};
const PX_POR_M = 40;

const gancho = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: Gancho }).__tabletop.tokens());

async function entrarNoMapa(mesa: Mesa, usuario: string, opcoes?: Parameters<Mesa["entrar"]>[1]) {
  const s = await mesa.entrar(usuario, opcoes);
  await esperarMapa(s.pagina);
  await s.pagina.evaluate(() =>
    (window as unknown as { __tabletop: Gancho }).__tabletop.definirZoom(1),
  );
  return s;
}

async function posicaoDe(p: Page, id: string) {
  const t = (await gancho(p)).find((x) => x.id === id);
  if (!t) throw new Error(`token ${id} não está visível`);
  return t;
}

async function esperarPosicao(p: Page, id: string, x: number, y: number) {
  await expect
    .poll(async () => {
      const t = await posicaoDe(p, id).catch(() => null);
      return t ? [Math.round(t.x * 100) / 100, Math.round(t.y * 100) / 100] : null;
    })
    .toEqual([x, y]);
}

async function centrarNoToken(p: Page, id: string) {
  const t = await posicaoDe(p, id);
  return p.evaluate(
    ([x, y]) => {
      const h = (window as unknown as { __tabletop: Gancho }).__tabletop;
      h.centrarEm(x as number, y as number);
      return h.paraTela(x as number, y as number);
    },
    [t.x, t.y],
  );
}

async function arrastar(p: Page, id: string, dxM: number, dyM: number) {
  const ini = await centrarNoToken(p, id);
  const zoom = await p.evaluate(() =>
    (window as unknown as { __tabletop: Gancho }).__tabletop.zoom(),
  );
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  await p.mouse.move(ini.x + dxM * PX_POR_M * zoom, ini.y + dyM * PX_POR_M * zoom, { steps: 12 });
  await p.mouse.up();
}

/** Clica no token (mouse de verdade) para selecioná-lo; abre o painel do token do mestre. */
async function selecionarToken(p: Page, id: string) {
  const alvo = await centrarNoToken(p, id);
  await p.mouse.click(alvo.x, alvo.y);
  await expect(p.getByTestId("painel-token")).toBeVisible();
}

/** Fichas → clica no item (abre o editor). */
async function abrirItem(p: Page, personagemId: string) {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${personagemId}`).click();
  await expect(p.getByTestId("editor-item")).toBeVisible();
}

async function fecharItem(p: Page) {
  await p.getByTestId("editor-fechar").click();
  await expect(p.getByTestId("editor-item")).toHaveCount(0);
}

/** Arrasta a bandeira do ponto de chegada (mouse de verdade); devolve onde estava e onde ficou. */
async function arrastarBandeira(p: Page, dxM: number, dyM: number) {
  const lido = () =>
    p.evaluate(() => {
      const h = (window as unknown as { __tabletop: Gancho }).__tabletop;
      const b = h.bandeira();
      return b ? { ...b, tela: h.paraTela(b.x, b.y) } : null;
    });
  const antes = await lido();
  if (!antes) throw new Error("sem bandeira");
  await p.evaluate(
    ([x, y]) =>
      (window as unknown as { __tabletop: Gancho }).__tabletop.centrarEm(x as number, y as number),
    [antes.x, antes.y],
  );
  const inicio = (await lido()) as NonNullable<Awaited<ReturnType<typeof lido>>>;
  const zoom = await p.evaluate(() =>
    (window as unknown as { __tabletop: Gancho }).__tabletop.zoom(),
  );
  // a bandeira fica acima e à direita do ponto: agarra um pouco acima da base
  await p.mouse.move(inicio.tela.x + 4, inicio.tela.y - 12);
  await p.mouse.down();
  await p.mouse.move(
    inicio.tela.x + 4 + dxM * PX_POR_M * zoom,
    inicio.tela.y - 12 + dyM * PX_POR_M * zoom,
    { steps: 10 },
  );
  await p.mouse.up();
  await expect.poll(async () => (await lido())?.x).not.toBe(antes.x);
  const depois = (await lido()) as NonNullable<Awaited<ReturnType<typeof lido>>>;
  return { antes: { x: antes.x, y: antes.y }, depois: { x: depois.x, y: depois.y } };
}

const JOGADORES = ["jogador-1", "jogador-2", "jogador-3"];
const SETE = [...JOGADORES, "jogador-4", "jogador-5", "jogador-6", "jogador-7"];

/** Mensagens de texto de um tipo (só as que a interface enviou, ou a sala mandou). */
const doTipo = (frames: string[], tipo: string) =>
  frames.filter((f) => f.includes(`"tipo":"${tipo}"`));

async function levarOGrupo(mestre: Page, cenaId: string) {
  await menuDaCena(mestre, cenaId, "levar");
}

test("levar o grupo: 1 mensagem do mestre e todos os jogadores mudam de cena", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const jogadores: Sessao[] = [];
  for (const j of SETE) jogadores.push(await entrarNoMapa(mesa, j));
  for (const j of jogadores)
    await expect(j.pagina.getByTestId("cena-nome")).toHaveText("Cena inicial");
  await expect(mestre.pagina.getByTestId("grupo-em")).toHaveText("Cena inicial");

  await abrirFaixa(mestre.pagina);
  await expect(
    mestre.pagina.locator('[data-testid="cena-card"][data-do-grupo="true"]'),
  ).toHaveAttribute("data-cena-id", "cena-1");
  const antes = mestre.enviados.length;
  const snapshots = jogadores.map((j) => doTipo(j.frames, "snapshot").length);
  await menuDaCena(mestre.pagina, "cena-covil", "levar");

  for (const j of jogadores) {
    await expect(j.pagina.getByTestId("cena-nome")).toHaveText("Covil");
  }
  // exatamente UMA mensagem do mestre
  await mestre.pagina.waitForTimeout(500);
  const enviadas = mestre.enviados.slice(antes);
  expect(enviadas).toHaveLength(1);
  expect(JSON.parse(enviadas[0] ?? "{}")).toMatchObject({
    tipo: "grupo.moverPara",
    dados: { cenaId: "cena-covil" },
  });
  // cada jogador recebeu um snapshot novo, e o grupo está na chegada, lado a lado
  jogadores.forEach((j, i) => {
    expect(doTipo(j.frames, "snapshot").length).toBe((snapshots[i] ?? 0) + 1);
  });
  await esperarPosicao(jogadores[0]?.pagina as Page, "tok-jogador-1", 6.75, 15.75);
  await esperarPosicao(jogadores[1]?.pagina as Page, "tok-jogador-2", 8.25, 15.75);
  await esperarPosicao(jogadores[2]?.pagina as Page, "tok-jogador-3", 5.25, 15.75);
  // o NPC ficou na outra cena e o do Covil apareceu
  const ids = (await gancho(jogadores[3]?.pagina as Page)).map((t) => t.id);
  expect(ids).toContain("tok-sentinela-covil");
  expect(ids).not.toContain("tok-ogro");
  // o mestre acompanha o grupo
  await expect(mestre.pagina.getByTestId("cena-nome")).toHaveText("Covil");
  await expect(mestre.pagina.getByTestId("grupo-em")).toHaveText("Covil");
  // refresh na cena nova: o jogador continua nela
  const primeiro = (jogadores[0] as Sessao).pagina;
  await primeiro.reload();
  await esperarMapa(primeiro);
  await expect(primeiro.getByTestId("cena-nome")).toHaveText("Covil");
});

test("o PV do personagem se mantém ao trocar de cena e depois de refresh", async ({ mesa }) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await abrirItem(j1.pagina, "pers-aldric");
  await abrirAba(j2.pagina, "fichas");

  // o jogador altera o PV do próprio personagem; o mestre vê; o outro jogador não vê a ficha
  const campo = j1.pagina.getByTestId("pv-atual-pers-aldric");
  await expect(campo).toHaveValue("12");
  await campo.fill("5");
  await campo.blur();
  await abrirItem(mestre.pagina, "pers-aldric");
  await expect(mestre.pagina.getByTestId("pv-atual-pers-aldric")).toHaveValue("5");
  await fecharItem(mestre.pagina);
  await expect(j2.pagina.getByTestId("ficha-item-pers-aldric")).toHaveCount(0);

  await levarOGrupo(mestre.pagina, "cena-covil");
  await expect(j1.pagina.getByTestId("cena-nome")).toHaveText("Covil");
  await expect(j1.pagina.getByTestId("pv-atual-pers-aldric")).toHaveValue("5");
  await levarOGrupo(mestre.pagina, "cena-1");
  await expect(j1.pagina.getByTestId("cena-nome")).toHaveText("Cena inicial");
  await expect(j1.pagina.getByTestId("pv-atual-pers-aldric")).toHaveValue("5");

  await j1.pagina.reload();
  await esperarMapa(j1.pagina);
  await abrirItem(j1.pagina, "pers-aldric");
  await expect(j1.pagina.getByTestId("pv-atual-pers-aldric")).toHaveValue("5");

  // o mestre edita o PV máximo: o PV atual nunca passa dele
  await abrirItem(mestre.pagina, "pers-aldric");
  const max = mestre.pagina.getByTestId("pv-max-pers-aldric");
  await max.fill("4");
  await max.blur();
  await expect(j1.pagina.getByTestId("pv-atual-pers-aldric")).toHaveValue("4");
  await expect(j1.pagina.getByTestId("pv-max-pers-aldric")).toHaveValue("4");

  // forçando por fora da interface: o personagem de outro jogador e o NPC respondem como inexistentes
  const alheio = await enviarCru(
    j2.pagina,
    intencaoCrua("ficha.alterar", { personagemId: "pers-aldric", pvAtual: 1 }),
  );
  expect(alheio?.dados.codigo).toBe("personagem_inexistente");
  const npc = await enviarCru(
    j1.pagina,
    intencaoCrua("ficha.alterar", { personagemId: "pers-ogro", pvAtual: 1 }),
  );
  expect(npc?.dados.codigo).toBe("personagem_inexistente");
  const criar = await enviarCru(
    j1.pagina,
    intencaoCrua("grupo.moverPara", { cenaId: "cena-covil" }),
  );
  expect(criar?.dados.codigo).toBe("sem_permissao");
});

test("o jogador não move o token de outro jogador; move se o mestre o pôr em controladoPor", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");

  // o dono move (o token não tem controladoPor: vale o dono do personagem)
  await arrastar(j1.pagina, "tok-jogador-1", 3, 0);
  await esperarPosicao(mestre.pagina, "tok-jogador-1", 14.25, 9.75);

  // o jogador 1 não move o token do jogador 2, nem forçando por fora
  const antes = j1.enviados.length;
  await arrastar(j1.pagina, "tok-jogador-2", 3, 0);
  await esperarPosicao(j1.pagina, "tok-jogador-2", 15.75, 9.75);
  expect(j1.enviados.slice(antes).filter((f) => f.includes('"token.'))).toEqual([]);
  const r = await enviarCru(
    j1.pagina,
    intencaoCrua("token.soltar", { id: "tok-jogador-2", x: 1, y: 1 }),
  );
  expect(r?.dados.codigo).toBe("sem_permissao");

  // o mestre empresta o token: aí o jogador 1 move
  await selecionarToken(mestre.pagina, "tok-jogador-2");
  await mestre.pagina.getByTestId("token-controla-jogador-1").click();
  await expect
    .poll(() => j1.frames.some((f) => f.includes('"controladoPor":["jogador-1"]')))
    .toBe(true);
  await j1.pagina.waitForTimeout(200);
  await arrastar(j1.pagina, "tok-jogador-2", 3, 0);
  await esperarPosicao(mestre.pagina, "tok-jogador-2", 18.75, 9.75);
  await esperarPosicao(j2.pagina, "tok-jogador-2", 18.75, 9.75);
});

test("o mestre vê e edita a cena 2 enquanto o grupo continua na 1; os jogadores não recebem nada", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");

  await abrirFaixa(mestre.pagina);
  const antes = [j1.frames.length, j2.frames.length];
  await menuDaCena(mestre.pagina, "cena-covil", "ir");
  await expect(
    mestre.pagina.locator('[data-testid="cena-card"][data-vista="true"]'),
  ).toHaveAttribute("data-cena-id", "cena-covil");
  await expect(mestre.pagina.getByTestId("cena-nome")).toHaveText("Covil");
  await expect(mestre.pagina.getByTestId("grupo-em")).toHaveText("Cena inicial");
  await expect
    .poll(async () => (await gancho(mestre.pagina)).map((t) => t.id).sort())
    .toEqual(["tok-sentinela-covil", "tok-vigia-covil"]);

  // edita a cena 2: token novo (nasce nela), renomeia, grid, chegada
  await mestre.pagina.getByTestId("novo-token").click();
  await expect(mestre.pagina.getByTestId("painel-token")).toBeVisible();
  await mestre.pagina.getByTestId("token-nome").fill("Rato do Covil");
  await mestre.pagina.getByTestId("token-nome").blur();
  await expect
    .poll(async () => (await gancho(mestre.pagina)).some((t) => t.nome === "Rato do Covil"))
    .toBe(true);
  await abrirAba(mestre.pagina, "mestre");
  await mestre.pagina.getByTestId("grid-quadrado").fill("2");
  await mestre.pagina.getByTestId("grid-quadrado").blur();
  // duplo clique no nome renomeia
  await mestre.pagina.getByTestId("cena-nome-cena-covil").dblclick();
  await mestre.pagina.getByTestId("cena-nome-editar-cena-covil").fill("Covil dos Ratos");
  await mestre.pagina.getByTestId("cena-nome-editar-cena-covil").press("Enter");
  await expect(mestre.pagina.getByTestId("cena-nome")).toHaveText("Covil dos Ratos");
  // o ponto de chegada é a bandeira arrastável no mapa (só do mestre, na cena que ele vê)
  const bandeira = await arrastarBandeira(mestre.pagina, 3, 3);
  expect(bandeira.depois.x).toBeGreaterThan(bandeira.antes.x + 1);
  await expect
    .poll(() => mestre.enviados.filter((f) => f.includes('"chegada":{')).length)
    .toBeGreaterThan(0);
  await menuDaCena(mestre.pagina, "cena-covil", "duplicar");
  await expect(mestre.pagina.getByTestId("cena-card")).toHaveCount(3);
  await mestre.pagina.waitForTimeout(500);

  // os jogadores não receberam NENHUM evento e continuam na cena 1
  for (const [j, n] of [
    [j1, antes[0] ?? 0],
    [j2, antes[1] ?? 0],
  ] as const) {
    const novos = j.frames.slice(n);
    expect(
      novos.filter((f) => f.includes('"tipo":"evento"') || f.includes('"tipo":"snapshot"')),
    ).toEqual([]);
    expect(novos.join("\n")).not.toMatch(/Covil|Rato|tok-sentinela|tok-vigia|cena-covil/);
    await expect(j.pagina.getByTestId("cena-nome")).toHaveText("Cena inicial");
    expect((await gancho(j.pagina)).some((t) => t.id === "tok-ogro")).toBe(true);
  }
  // o mestre não moveu o grupo, e a cena apagada some (a do grupo não pode ser apagada)
  await mestre.pagina
    .locator('[data-testid="cena-card"][data-cena-id="cena-1"]')
    .click({ button: "right" });
  await expect(mestre.pagina.getByTestId("menu-cena-apagar")).toBeDisabled();
  await mestre.pagina.keyboard.press("Escape");
  await expect(mestre.pagina.getByTestId("menu-cena")).toHaveCount(0);
  await menuDaCena(mestre.pagina, "cena-covil", "apagar");
  await mestre.pagina.getByTestId("confirmar-apagar-cena-sim").click();
  await expect(mestre.pagina.getByTestId("cena-card")).toHaveCount(2);
  await expect(mestre.pagina.getByTestId("cena-nome")).toHaveText("Cena inicial"); // a vista voltou ao grupo
  const forcado = await enviarCru(mestre.pagina, intencaoCrua("cena.apagar", { cenaId: "cena-1" }));
  expect(forcado?.dados.codigo).toBe("dados_invalidos");
});

// -----------------------------------------------------------------------------------------------
// Preparo cifrado
// -----------------------------------------------------------------------------------------------

type Covil = {
  mestre: Sessao;
  jogadores: Sessao[];
  mapa: MetaVista;
  tiles: MetaVista[];
  sentinela: MetaVista;
  vigia: MetaVista;
};

/**
 * O mestre monta o Covil (cena 2): mapa fatiado em 6 tiles, imagem na sentinela (visível) e no vigia
 * (oculto). O grupo continua na cena 1. Cada jogador entra e espera o mapa.
 */
async function montarCovil(mesa: Mesa, quemEntra: string[]): Promise<Covil> {
  const mestre = await entrarNoMapa(mesa, "mestre", { limiteTile: 512 });
  const jogadores: Sessao[] = [];
  for (const j of quemEntra) jogadores.push(await entrarNoMapa(mesa, j));
  const p = mestre.pagina;
  await menuDaCena(p, "cena-covil", "ir");
  await expect(p.getByTestId("cena-nome")).toHaveText("Covil");
  await definirMapa(p, "cena-covil", arquivoPng("covil.png", pngDeRuido(1300, 1000, 21, 2)), 35);
  const mapa = await metaPorNome(p, "covil.png");
  await expect.poll(async () => (await imagensDoMapa(p)).tiles.length).toBe(6);

  await selecionarToken(p, "tok-sentinela-covil");
  await imagemDoTokenSelecionado(p, arquivoPng("sentinela.png", pngDeRuido(160, 160, 22, 4)));
  const sentinela = await metaPorNome(p, "sentinela.png");
  await selecionarToken(p, "tok-vigia-covil");
  await imagemDoTokenSelecionado(p, arquivoPng("vigia.png", pngDeRuido(160, 160, 23, 4)));
  const vigia = await metaPorNome(p, "vigia.png");
  await expect
    .poll(async () => (await assets(p, "metas")).filter((m) => m.tipo === "tile").length)
    .toBe(6);
  const tiles = (await assets(p, "metas")).filter((m) => m.tipo === "tile");
  await esperarPronto(p, mapa.hash);
  await p.waitForTimeout(500);
  return { mestre, jogadores, mapa, tiles, sentinela, vigia };
}

/** Tudo o que identifica a cena 2 e o que há nela. */
function segredosDoCovil(c: Covil) {
  return [
    "Covil",
    "cena-covil",
    "tok-sentinela-covil",
    "tok-vigia-covil",
    "Sentinela do Covil",
    "Vigia Oculto do Covil",
    c.mapa.hash,
    ...c.tiles.map((t) => t.hash),
    c.sentinela.hash,
    c.vigia.hash,
    "covil.png",
    "sentinela.png",
    "vigia.png",
  ];
}

async function conteudoDosArquivos(p: Page, hashes: string[]): Promise<string[]> {
  const inicios: string[] = [];
  for (const h of hashes) {
    const inicio = await assets(p, "inicioDe", h, 64);
    if (inicio) inicios.push(inicio);
  }
  return inicios;
}

function vazamentos(s: Sessao, segredos: string[], iniciosDosArquivos: string[]): string[] {
  const textos = s.frames.join("\n");
  const achados = segredos.filter((x) => textos.includes(x));
  for (const hash of segredos.filter((x) => /^[0-9a-f]{64}$/.test(x))) {
    if (s.binarios.some((b) => b.includes(Buffer.from(hash, "hex")))) achados.push(`bin:${hash}`);
    if (s.binarios.some((b) => b.toString("latin1").includes(hash))) achados.push(`binhex:${hash}`);
  }
  for (const inicio of iniciosDosArquivos) {
    if (s.binarios.some((b) => b.includes(Buffer.from(inicio, "hex"))))
      achados.push("bytes-claros");
  }
  return achados;
}

test("frames: antes de levar o grupo, nada da cena 2 chega aos jogadores (nem texto, nem bytes)", async ({
  mesa,
}) => {
  test.setTimeout(150_000);
  const covil = await montarCovil(mesa, JOGADORES);
  const { mestre, jogadores } = covil;
  const segredos = segredosDoCovil(covil);
  const claros = await conteudoDosArquivos(mestre.pagina, [
    ...covil.tiles.map((t) => t.hash),
    covil.sentinela.hash,
    covil.vigia.hash,
  ]);
  expect(claros.length).toBe(8);

  // controle positivo: o mestre recebeu tudo isso (os segredos existem e são vistos por quem pode)
  expect(vazamentos(mestre, segredos, claros).length).toBeGreaterThan(0);
  // mexer mais na cena 2 (mover o vigia oculto e a sentinela) também não vaza
  await arrastar(mestre.pagina, "tok-sentinela-covil", 2, 0);
  await mestre.pagina.waitForTimeout(500);
  for (const j of jogadores) {
    expect(vazamentos(j, segredos, claros)).toEqual([]);
    await expect(j.pagina.getByTestId("cena-nome")).toHaveText("Cena inicial");
    // e nada do que ele pede por fora existe: mapa, tile e imagem da cena 2 respondem "inexistente"
    for (const hash of [covil.mapa.hash, covil.tiles[0]?.hash ?? "", covil.sentinela.hash]) {
      const r = await enviarCru(j.pagina, intencaoCrua("asset.pedir", { hash }));
      expect(r?.dados.codigo).toBe("asset_inexistente");
    }
    expect(await assets(j.pagina, "inventario")).toEqual(
      expect.not.arrayContaining([covil.mapa.hash, covil.sentinela.hash]),
    );
  }
  expect(jogadores[0]?.binarios.length).toBe(0);
  // um jogador que força um grupo.moverPara é recusado
  const r = await enviarCru(
    jogadores[0]?.pagina as Page,
    intencaoCrua("cena.preparar", { cenaId: "cena-covil", pacotes: [] }),
  );
  expect(r?.tipo).toBe("erro");
});

test("preparar: os jogadores baixam os pacotes cifrados antes; a troca não baixa nenhum pedaço", async ({
  mesa,
}) => {
  test.setTimeout(240_000);
  const covil = await montarCovil(mesa, JOGADORES);
  const { mestre, jogadores } = covil;
  const p = mestre.pagina;
  const segredos = segredosDoCovil(covil);
  const claros = await conteudoDosArquivos(p, [
    ...covil.tiles.map((t) => t.hash),
    covil.sentinela.hash,
    covil.vigia.hash,
  ]);

  // preparar: 6 tiles + a imagem da sentinela (o vigia está oculto e não entra)
  await menuDaCena(p, "cena-covil", "preparar");
  await expect(p.getByTestId("cena-progresso-cena-covil")).toContainText("3/7", {
    timeout: 90_000,
  });
  await expect(p.getByTestId("cena-progresso-cena-covil")).toContainText("7 arquivos");
  await expect(p.getByTestId("cena-progresso-cena-covil")).toHaveAttribute(
    "title",
    /3 de 7 jogadores já têm tudo/,
  );
  const preparar1 = doTipo(mestre.enviados, "cena.preparar");
  expect(preparar1).toHaveLength(1);
  const pacotes = JSON.parse(preparar1[0] ?? "{}").dados.pacotes as {
    hashCifrado: string;
    hashOriginal: string;
    chave: string;
  }[];
  expect(pacotes.map((x) => x.hashOriginal).sort()).toEqual(
    [...covil.tiles.map((t) => t.hash), covil.sentinela.hash].sort(),
  );
  expect(pacotes.some((x) => x.hashOriginal === covil.vigia.hash)).toBe(false);
  const metas = await assets(p, "metas");
  const cifrados = metas.filter((m) => m.tipo === "cifrado");
  expect(cifrados).toHaveLength(7);
  for (const c of cifrados) {
    expect(c.nomeOriginal).toBe("cifrado");
    expect([c.largura, c.altura]).toEqual([1, 1]);
  }

  // os jogadores têm os cifrados, e SÓ eles; nada de claro e nada de nome, id ou chave
  for (const j of jogadores) {
    expect(await assets(j.pagina, "inventario")).toEqual(
      expect.arrayContaining(cifrados.map((c) => c.hash)),
    );
    const inv = await assets(j.pagina, "inventario");
    expect(inv).toEqual(expect.not.arrayContaining([covil.mapa.hash, covil.sentinela.hash]));
    expect(vazamentos(j, segredos, claros)).toEqual([]);
    for (const x of pacotes) expect(j.frames.join("\n")).not.toContain(x.chave);
    expect(j.binarios.length).toBeGreaterThanOrEqual(7);
    expect(j.frames.join("\n")).not.toContain("cena.preparar");
  }

  // preparar de novo depois de mudar a cena acrescenta só o que falta
  await p.getByTestId("novo-token").click();
  await expect(p.getByTestId("painel-token")).toBeVisible();
  await imagemDoTokenSelecionado(p, arquivoPng("rato.png", pngDeRuido(160, 160, 24, 4)));
  const rato = await metaPorNome(p, "rato.png");
  await menuDaCena(p, "cena-covil", "preparar");
  await expect(p.getByTestId("cena-progresso-cena-covil")).toContainText("8 arquivos", {
    timeout: 60_000,
  });
  await expect(p.getByTestId("cena-progresso-cena-covil")).toContainText("3/7", {
    timeout: 60_000,
  });
  const preparar2 = doTipo(mestre.enviados, "cena.preparar");
  expect(preparar2).toHaveLength(2);
  expect(
    (JSON.parse(preparar2[1] ?? "{}").dados.pacotes as { hashOriginal: string }[]).map(
      (x) => x.hashOriginal,
    ),
  ).toEqual([rato.hash]);
  const chaves = pacotes.map((x) => x.chave);
  for (const j of jogadores) {
    expect(vazamentos(j, [...segredos, rato.hash], [...claros])).toEqual([]);
    for (const k of chaves) expect(j.frames.join("\n")).not.toContain(k);
  }

  // a troca: nenhum pedaço binário novo, o mapa aparece e o hash original confere
  const binariosAntes = jogadores.map((j) => j.binarios.length);
  const enviadosAntes = mestre.enviados.length;
  await levarOGrupo(p, "cena-covil");
  for (const j of jogadores) {
    await expect(j.pagina.getByTestId("cena-nome")).toHaveText("Covil");
    await esperarPronto(j.pagina, covil.mapa.hash);
    await expect.poll(async () => (await imagensDoMapa(j.pagina)).tiles.length).toBe(6);
    await expect
      .poll(async () => (await imagensDoMapa(j.pagina)).tokensComImagem)
      .toContain("tok-sentinela-covil");
  }
  await p.waitForTimeout(1000);
  expect(mestre.enviados.slice(enviadosAntes)).toHaveLength(1);
  const original = new Set([...covil.tiles.map((t) => t.hash), covil.sentinela.hash]);
  jogadores.forEach((j, i) => {
    expect(j.binarios.length).toBe(binariosAntes[i]); // nenhum pedaço baixado na troca
    const tinha = j.frames.filter((f) => f.includes('"preparo.chaves"'));
    expect(tinha).toHaveLength(1);
    const entregues = JSON.parse(tinha[0] ?? "{}").dados.pacotes as { hashOriginal: string }[];
    // chave só do que ele passa a ver: o vigia oculto e o rato (que não foi preparado... o foi) mantêm o sigilo
    for (const e of entregues) expect(e.hashOriginal).not.toBe(covil.vigia.hash);
    for (const e of entregues)
      expect(original.has(e.hashOriginal) || e.hashOriginal === rato.hash).toBe(true);
  });
  for (const j of jogadores) {
    // o SHA-256 de cada arquivo no cache confere com o nome (que agora é o hash original)
    const cache = await assets(j.pagina, "verificarCache");
    expect(cache.every((c) => c.ok)).toBe(true);
    const inv = await assets(j.pagina, "inventario");
    for (const o of original) expect(inv).toContain(o);
    // o cifrado foi apagado depois de aberto
    for (const c of cifrados) expect(inv).not.toContain(c.hash);
    // o vigia oculto não tem chave, nem hash, nem id nos frames do jogador
    expect(inv).not.toContain(covil.vigia.hash);
    expect(j.frames.join("\n")).not.toContain(covil.vigia.hash);
    expect(j.frames.join("\n")).not.toContain("tok-vigia-covil");
    expect(j.frames.join("\n")).not.toContain("Vigia Oculto");
  }
  // o preparo foi descartado: o progresso some e preparar de novo não tem o que acrescentar
  await abrirFaixa(p);
  await expect(p.getByTestId("cena-progresso-cena-covil")).toHaveCount(0);
});

test("o grupo na cena nova, a cena criada e os personagens sobrevivem ao reinício da sala", async ({
  mesa,
  request,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await abrirFaixa(mestre.pagina);
  await mestre.pagina.getByTestId("cena-nova").click();
  await expect(mestre.pagina.getByTestId("cena-card")).toHaveCount(3);
  await abrirAba(mestre.pagina, "fichas");
  await mestre.pagina.getByTestId("ficha-novo").click();
  await mestre.pagina.getByTestId("ficha-novo-personagem").click();
  const nomeNovo = mestre.pagina.locator(
    '[data-testid="editor-item"] [data-testid^="personagem-nome-"]',
  );
  await nomeNovo.fill("Lyra");
  await nomeNovo.blur();
  await fecharItem(mestre.pagina);
  await expect(mestre.pagina.getByTestId("aba-painel-fichas").getByText("Lyra")).toBeVisible();
  await levarOGrupo(mestre.pagina, "cena-covil");
  await expect(j1.pagina.getByTestId("cena-nome")).toHaveText("Covil");
  await esperarPosicao(j1.pagina, "tok-jogador-1", 6.75, 15.75);

  const quedas = [mestre, j1].map(
    (s) => new Promise<void>((resolver) => s.pagina.once("websocket", () => resolver())),
  );
  await request.post("/teste/reiniciar-sala").catch(() => {});
  await Promise.all(quedas);
  for (const s of [mestre, j1]) {
    await expect(s.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  }
  await expect(j1.pagina.getByTestId("cena-nome")).toHaveText("Covil");
  await esperarPosicao(j1.pagina, "tok-jogador-1", 6.75, 15.75);
  await expect(mestre.pagina.getByTestId("grupo-em")).toHaveText("Covil");
  await expect(mestre.pagina.getByTestId("cena-card")).toHaveCount(3);
  await abrirAba(mestre.pagina, "fichas");
  await expect(mestre.pagina.locator('[data-testid^="ficha-item-pers-"]')).toHaveCount(5);
  await expect(mestre.pagina.getByTestId("ficha-pasta-pasta-personagens")).toBeVisible();
});
