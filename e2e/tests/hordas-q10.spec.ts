import type { Page } from "@playwright/test";
import {
  abrirAba,
  enviarCru,
  expect,
  intencaoCrua,
  menuDaCena,
  test,
  tornarMembros,
} from "./ajudas";
import { mandar } from "./ajudasFicha";
import {
  entrarNoMapa,
  type GanchoDoMapa,
  PX_POR_M,
  pontoNaPagina,
  soSelecionarToken,
  type TokenVisto,
} from "./ajudasMapa";

// Q10: hordas. Vida própria por token de NPC, numeração, "Colocar vários…", duplicar, copiar e colar.

const GOBLIN = "pers-goblin-q10";
const QUADRADO = 1.5;

const hook = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.tokens());
const goblins = async (p: Page): Promise<TokenVisto[]> =>
  (await hook(p))
    .filter((t) => /^Goblin( \d+)?$/.test(t.nome))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
const nomesDosGoblins = async (p: Page) => (await goblins(p)).map((t) => t.nome);

async function criarGoblin(mestre: Page) {
  await mandar(mestre, "personagem.criar", {
    personagem: {
      id: GOBLIN,
      pastaId: "pasta-npcs",
      editores: { tipo: "jogadores", ids: [] },
      nome: "Goblin",
      tokenPadrao: { cor: "#2e8b57", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      ficha: { pvAtual: 7, pvMax: 7, apresentacao: "npc" },
    },
  });
}

/** A vista do mestre no ponto (metros), zoom 1. */
async function olharPara(p: Page, x: number, y: number) {
  await p.evaluate(
    ([px, py]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.definirZoom(1);
      h.centrarEm(px as number, py as number);
    },
    [x, y],
  );
}

/** "Colocar vários…" pela lista de Fichas (botão direito no NPC), no centro da vista. */
async function colocarVarios(p: Page, quantidade: number) {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-item-${GOBLIN}`).click({ button: "right" });
  await p.getByTestId("menu-ficha-colocar-varios").click();
  await p.getByTestId("colocar-varios-quantidade").fill(String(quantidade));
  await p.getByTestId("colocar-varios-quantidade").press("Enter");
  await expect(p.getByTestId("colocar-varios-janela")).toHaveCount(0);
}

/** Ponto da página onde o token está (o mapa já centrado nele ou perto). */
async function naPagina(p: Page, t: { x: number; y: number }) {
  return pontoNaPagina(p, t.x, t.y);
}

async function somarComShift(p: Page, t: { x: number; y: number }) {
  const ponto = await naPagina(p, t);
  await p.keyboard.down("Shift");
  await p.mouse.click(ponto.x, ponto.y);
  await p.keyboard.up("Shift");
}

async function selecionados(p: Page) {
  return (await hook(p)).filter((t) => t.selecionado).map((t) => t.id);
}

test("Colocar vários: 4 goblins numerados e arrumados, cada um com a sua vida; o dano em um só desce a dele", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await criarGoblin(p);
  await olharPara(p, 10, 10);
  await colocarVarios(p, 4);

  await expect
    .poll(() => nomesDosGoblins(p))
    .toEqual(["Goblin", "Goblin 2", "Goblin 3", "Goblin 4"]);
  const lista = await goblins(p);
  // arrumados: lugares diferentes, juntos (dentro de 3 quadrados do centro da vista) e encaixados no grid
  expect(new Set(lista.map((t) => `${t.x},${t.y}`)).size).toBe(4);
  for (const t of lista) {
    expect(Math.hypot(t.x - 10, t.y - 10)).toBeLessThanOrEqual(3 * QUADRADO + 1);
    expect(((t.x / QUADRADO) % 1) - 0.5).toBeCloseTo(0, 5);
  }
  // um pedido só: um passo para o Desfazer (os quatro tokens vieram de uma intenção)
  const frames = m.enviados.filter((f) => f.includes('"tipo":"personagem.colocarVarios"'));
  expect(frames).toHaveLength(1);

  // dano no Goblin 3: só nele
  const goblin3 = lista.find((t) => t.nome === "Goblin 3") as TokenVisto;
  const goblin2 = lista.find((t) => t.nome === "Goblin 2") as TokenVisto;
  await soSelecionarToken(p, goblin3.id);
  await expect(p.getByTestId("marca-vida-valor")).toHaveText("7");
  await p.keyboard.press("e");
  await p.getByTestId("marca-vida-campo").fill("-3");
  await p.getByTestId("marca-vida-campo").press("Enter");
  await expect(p.getByTestId("marca-vida-valor")).toHaveText("4");
  await soSelecionarToken(p, goblin2.id);
  await expect(p.getByTestId("marca-vida-valor")).toHaveText("7");
  await soSelecionarToken(p, goblin3.id);
  await expect(p.getByTestId("marca-vida-valor")).toHaveText("4");

  // a ficha (o modelo) não mudou: continua 7/7 na lista de Fichas
  await abrirAba(p, "fichas");
  await expect(p.getByTestId(`ficha-item-${GOBLIN}`).locator(".ficha-pv")).toHaveText("7/7");

  // a ficha aberta pelo Goblin 3 mostra a faixa "Este token" (4/7), editável; os PV de baixo viram os do modelo
  const ponto = await naPagina(
    p,
    (await goblins(p)).find((t) => t.id === goblin3.id) as TokenVisto,
  );
  await p.mouse.click(ponto.x, ponto.y, { button: "right" });
  await p.getByTestId("menu-token-abrir-ficha").click();
  const faixa = p.getByTestId("ficha-faixa-token");
  await expect(faixa).toBeVisible();
  await expect(p.getByTestId("ficha-faixa-token-nome")).toHaveText("Goblin 3");
  await expect(p.getByTestId("faixa-token-pv")).toHaveValue("4");
  await expect(p.getByTestId("faixa-token-pv-max")).toHaveValue("7");
  await expect(p.getByTestId(`pv-atual-${GOBLIN}`)).toHaveAttribute(
    "aria-label",
    "PV atuais do modelo",
  );
  await p.getByTestId("faixa-token-pv").fill("2");
  await expect(p.getByTestId("marca-vida-valor")).toHaveText("2");
  // abrir pela lista tira a faixa (a ficha é o modelo)
  await p.getByTestId(`ficha-abrir-${GOBLIN}`).click();
  await expect(p.getByTestId("ficha-faixa-token")).toHaveCount(0);
});

test("a escolha 'Cada token com a sua vida' desligada volta a usar a vida da ficha", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await criarGoblin(p);
  await mandar(p, "personagem.editar", { id: GOBLIN, mudancas: { vidaPorToken: false } });
  await olharPara(p, 10, 10);
  await colocarVarios(p, 2);
  await expect.poll(() => nomesDosGoblins(p)).toEqual(["Goblin", "Goblin 2"]);
  const [a, b] = await goblins(p);
  await soSelecionarToken(p, (a as TokenVisto).id);
  await p.keyboard.press("e");
  await p.getByTestId("marca-vida-campo").fill("-4");
  await p.getByTestId("marca-vida-campo").press("Enter");
  await expect(p.getByTestId("marca-vida-valor")).toHaveText("3");
  // a vida é a da ficha: o outro token mostra o mesmo número
  await soSelecionarToken(p, (b as TokenVisto).id);
  await expect(p.getByTestId("marca-vida-valor")).toHaveText("3");

  // a caixa da ficha reflete a escolha (desligada) e liga de novo
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${GOBLIN}`).click();
  await p.getByTestId("npc-configurar").click();
  const caixa = p.getByTestId("vida-por-token");
  await expect(caixa).not.toBeChecked();
  await caixa.click();
  await expect(caixa).toBeChecked();
});

test("Ctrl+C e Ctrl+V: dois tokens vão para o ponteiro, mantendo o arranjo; e para outra cena, onde a numeração recomeça", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await criarGoblin(p);
  await olharPara(p, 10, 10);
  await colocarVarios(p, 2);
  await expect.poll(() => nomesDosGoblins(p)).toEqual(["Goblin", "Goblin 2"]);
  const [a, b] = (await goblins(p)) as [TokenVisto, TokenVisto];

  // seleciona os dois (clique + Shift+clique) e copia
  await soSelecionarToken(p, a.id);
  await somarComShift(p, b);
  await expect.poll(() => selecionados(p)).toEqual(expect.arrayContaining([a.id, b.id]));
  expect(await selecionados(p)).toHaveLength(2);
  await p.keyboard.press("Control+c");

  // cola com o mouse num ponto do mapa (30 m, 30 m)
  await olharPara(p, 30, 30);
  const alvo = await pontoNaPagina(p, 30, 30);
  await p.mouse.move(alvo.x, alvo.y);
  await p.keyboard.press("Control+v");
  await expect
    .poll(() => nomesDosGoblins(p))
    .toEqual(["Goblin", "Goblin 2", "Goblin 3", "Goblin 4"]);
  const novos = (await goblins(p)).filter((t) => t.nome === "Goblin 3" || t.nome === "Goblin 4");
  // o centro do grupo colado está no ponteiro (encaixado no grid) e o arranjo entre eles é o de antes
  const cx = (novos[0]?.x as number) / 2 + (novos[1]?.x as number) / 2;
  const cy = (novos[0]?.y as number) / 2 + (novos[1]?.y as number) / 2;
  expect(Math.abs(cx - 30)).toBeLessThanOrEqual(QUADRADO);
  expect(Math.abs(cy - 30)).toBeLessThanOrEqual(QUADRADO);
  expect((novos[1]?.x as number) - (novos[0]?.x as number)).toBeCloseTo(b.x - a.x, 5);
  expect((novos[1]?.y as number) - (novos[0]?.y as number)).toBeCloseTo(b.y - a.y, 5);
  // os colados ficaram selecionados
  expect(await selecionados(p)).toHaveLength(2);

  // outra cena: o mestre vai olhar (sem levar o grupo) e cola lá
  await mandar(p, "cena.criar", { id: "cena-q10", nome: "Outra sala" });
  await menuDaCena(p, "cena-q10", "ir");
  await expect.poll(async () => (await goblins(p)).length).toBe(0);
  const aqui = await pontoNaPagina(p, 20, 20);
  await p.mouse.move(aqui.x, aqui.y);
  await p.keyboard.press("Control+v");
  await expect.poll(() => nomesDosGoblins(p)).toEqual(["Goblin", "Goblin 2"]);
  // a cena do grupo não ganhou nada
  await menuDaCena(p, "cena-1", "ir");
  await expect.poll(async () => (await goblins(p)).length).toBe(4);
});

test("Ctrl+D duplica ao lado, igual ao original e com o próximo número; Alt+arrastar deixa o original e solta uma cópia", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await criarGoblin(p);
  await olharPara(p, 10, 10);
  await colocarVarios(p, 1);
  await expect.poll(() => nomesDosGoblins(p)).toEqual(["Goblin"]);
  const [orig] = (await goblins(p)) as [TokenVisto];
  // o original fica ferido, escondido e com a marca de morto para provar que a cópia é igual
  await soSelecionarToken(p, orig.id);
  await p.keyboard.press("e");
  await p.getByTestId("marca-vida-campo").fill("2");
  await p.getByTestId("marca-vida-campo").press("Enter");
  await expect(p.getByTestId("marca-vida-valor")).toHaveText("2");

  await p.keyboard.press("Control+d");
  await expect.poll(() => nomesDosGoblins(p)).toEqual(["Goblin", "Goblin 2"]);
  const copia = (await goblins(p)).find((t) => t.nome === "Goblin 2") as TokenVisto;
  expect(copia.x - orig.x).toBeCloseTo(QUADRADO, 5);
  expect(copia.y).toBeCloseTo(orig.y, 5);
  // a cópia ficou selecionada e leva a vida de agora do original (2)
  await expect.poll(() => selecionados(p)).toEqual([copia.id]);
  await expect(p.getByTestId("marca-vida-valor")).toHaveText("2");

  // Alt+arrastar o original: ele fica onde está e nasce uma cópia (Goblin 3) onde soltou
  await soSelecionarToken(p, orig.id);
  const ini = await naPagina(p, (await goblins(p)).find((t) => t.id === orig.id) as TokenVisto);
  await p.keyboard.down("Alt");
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  await p.mouse.move(ini.x, ini.y + 4 * QUADRADO * PX_POR_M, { steps: 10 });
  await p.mouse.up();
  await p.keyboard.up("Alt");
  await expect.poll(() => nomesDosGoblins(p)).toEqual(["Goblin", "Goblin 2", "Goblin 3"]);
  // o original volta ao lugar dele (o visual desliza de volta; a sala nunca o moveu)
  await expect
    .poll(async () => {
      const t = (await goblins(p)).find((x) => x.id === orig.id);
      return t ? [Math.round(t.x * 100) / 100, Math.round(t.y * 100) / 100] : null;
    })
    .toEqual([Math.round(orig.x * 100) / 100, Math.round(orig.y * 100) / 100]);
  const depois = await goblins(p);
  const terceira = depois.find((t) => t.nome === "Goblin 3") as TokenVisto;
  expect(terceira.y - orig.y).toBeCloseTo(4 * QUADRADO, 5);
});

test("Ctrl+C num campo de texto não copia token (e Ctrl+V no mapa não cola nada)", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await criarGoblin(p);
  await olharPara(p, 10, 10);
  await colocarVarios(p, 1);
  await expect.poll(() => nomesDosGoblins(p)).toEqual(["Goblin"]);
  const [orig] = (await goblins(p)) as [TokenVisto];
  await soSelecionarToken(p, orig.id);

  // o foco vai para a caixa do chat: lá Ctrl+C copia o texto
  await abrirAba(p, "chat");
  const caixa = p.getByTestId("chat-texto");
  await caixa.fill("abc");
  await caixa.press("Control+a");
  await caixa.press("Control+c");
  // de volta ao mapa, Ctrl+V não cola token nenhum
  const ponto = await naPagina(p, orig);
  await p.mouse.click(ponto.x + 6 * QUADRADO * PX_POR_M, ponto.y);
  await p.keyboard.press("Control+v");
  await p.waitForTimeout(400);
  expect(await nomesDosGoblins(p)).toEqual(["Goblin"]);

  // e dentro do campo, Ctrl+D e Ctrl+V também não mexem no mapa
  await caixa.click();
  await caixa.press("Control+d");
  await caixa.press("Control+v");
  await p.waitForTimeout(300);
  expect(await nomesDosGoblins(p)).toEqual(["Goblin"]);
});

test("o jogador não cola, não duplica, não copia e não vê a vida do NPC que hoje não vê", async ({
  mesa,
  request,
}) => {
  test.setTimeout(120_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");
  await criarGoblin(m.pagina);
  await olharPara(m.pagina, 10, 10);
  await colocarVarios(m.pagina, 3);
  await expect.poll(() => nomesDosGoblins(m.pagina)).toEqual(["Goblin", "Goblin 2", "Goblin 3"]);
  // o jogador vê os tokens (com o nome numerado), mas a vida deles não chega: a ficha do NPC não chega a ele
  await expect.poll(() => nomesDosGoblins(j.pagina)).toEqual(["Goblin", "Goblin 2", "Goblin 3"]);
  const [primeiro] = (await goblins(m.pagina)) as [TokenVisto];
  await mandar(m.pagina, "token.vida", { id: primeiro.id, atual: 1 });
  await expect
    .poll(() => m.frames.filter((f) => f.includes('"pv":{"atual":1')).length)
    .toBeGreaterThan(0);
  expect(j.frames.filter((f) => f.includes('"pv":{')).length).toBe(0);

  // as intenções novas são recusadas ao jogador
  const copiar = await enviarCru(
    j.pagina,
    intencaoCrua("token.copiar", {
      cenaId: "cena-1",
      itens: [{ origemId: primeiro.id, id: "tok-j-copia", x: 5, y: 5 }],
    }),
  );
  expect(copiar).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
  const varios = await enviarCru(
    j.pagina,
    intencaoCrua("personagem.colocarVarios", {
      personagemId: GOBLIN,
      cenaId: "cena-1",
      tokenIds: ["tok-j-a", "tok-j-b"],
    }),
  );
  expect(varios).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
  const vida = await enviarCru(j.pagina, intencaoCrua("token.vida", { id: primeiro.id, atual: 7 }));
  expect(vida?.tipo).toBe("erro");

  // nem pelo teclado: o jogador seleciona o token dele e Ctrl+D não faz nada
  const eu = (await hook(j.pagina)).find((t) => t.nome === "Aldric") as TokenVisto;
  await soSelecionarToken(j.pagina, eu.id);
  await j.pagina.keyboard.press("Control+d");
  await j.pagina.keyboard.press("Control+c");
  await j.pagina.keyboard.press("Control+v");
  await j.pagina.waitForTimeout(400);
  expect((await hook(j.pagina)).filter((t) => t.nome === "Aldric")).toHaveLength(1);
  expect(await nomesDosGoblins(m.pagina)).toEqual(["Goblin", "Goblin 2", "Goblin 3"]);
});
