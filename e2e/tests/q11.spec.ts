import type { Page } from "@playwright/test";
import { expect, test, tornarMembros } from "./ajudas";
import { mandar } from "./ajudasFicha";
import {
  abrirPainelDoToken,
  arrastarToken,
  entrarNoMapa,
  type GanchoDoMapa,
  pontoNaPagina,
  type TokenVisto,
} from "./ajudasMapa";

// Q11: barra de vida no token (opcional, só para quem controla), borda colorida, laço de seleção, mover vários
// juntos e dano em lote. O Aldric (jogador-1), a Brisa (jogador-2) e o Ogro (NPC) vêm da semente.

const GOBLIN = "pers-goblin-q11";
const Q = 1.5;
const CENA = "cena-1";
const arred = (n: number) => Math.round(n * 100) / 100;

const hook = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.tokens());
const goblins = async (p: Page): Promise<TokenVisto[]> =>
  (await hook(p))
    .filter((t) => /^Goblin( \d+)?$/.test(t.nome))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
const selecionados = async (p: Page) =>
  (await hook(p))
    .filter((t) => t.selecionado)
    .map((t) => t.id)
    .sort();
const doToken = async (p: Page, id: string) => {
  const t = (await hook(p)).find((x) => x.id === id);
  if (!t) throw new Error(`sem o token ${id}`);
  return t;
};

async function criarGoblin(p: Page) {
  await mandar(p, "personagem.criar", {
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

/** Quatro goblins: três em fila (g1, g2, g3, no mesmo y) e um à parte (g4). Longe dos tokens da semente. */
async function porGoblins(p: Page) {
  const lugares: [string, number, number][] = [
    ["q11-g1", 44.25, 35.25],
    ["q11-g2", 45.75, 35.25],
    ["q11-g3", 47.25, 35.25],
    ["q11-g4", 52.5, 38.25],
  ];
  for (const [tokenId, x, y] of lugares) {
    await mandar(p, "personagem.colocar", {
      personagemId: GOBLIN,
      cenaId: CENA,
      tokenId,
      x,
      y,
    });
  }
  await p.evaluate(() => {
    const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
    h.definirZoom(1);
    h.centrarEm(48, 36);
  });
  await expect.poll(async () => (await goblins(p)).length).toBe(4);
}

/** Arrasta do ponto (metros) ao outro com o mouse de verdade: o laço sobre o fundo vazio. */
async function arrastarLaco(
  p: Page,
  de: { x: number; y: number },
  para: { x: number; y: number },
  opcoes: { shift?: boolean; soltar?: boolean } = {},
) {
  const a = await pontoNaPagina(p, de.x, de.y);
  const b = await pontoNaPagina(p, para.x, para.y);
  if (opcoes.shift) await p.keyboard.down("Shift");
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(b.x, b.y, { steps: 10 });
  if (opcoes.soltar !== false) {
    await p.mouse.up();
    if (opcoes.shift) await p.keyboard.up("Shift");
  }
}

const quadros = (m: { enviados: string[] }, tipo: string) =>
  m.enviados.filter((f) => f.includes(`"tipo":"${tipo}"`));

test("laço, mover juntos, setas e dano em lote: cada gesto é um pedido só e só mexe nos escolhidos", async ({
  mesa,
}) => {
  test.setTimeout(150_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await criarGoblin(p);
  await porGoblins(p);
  const [g1, g2, g3, g4] = (await goblins(p)) as [TokenVisto, TokenVisto, TokenVisto, TokenVisto];
  const tres = [g1.id, g2.id, g3.id].sort();

  // o ping de segurar parado continua igual: o clique no fundo vazio, sem andar, pinga e não faz laço
  const vazio = await pontoNaPagina(p, 40, 41);
  await p.mouse.move(vazio.x, vazio.y);
  await p.mouse.down();
  await expect.poll(() => quadros(m, "mapa.ping").length, { timeout: 5_000 }).toBe(1);
  await p.mouse.up();
  expect(await selecionados(p)).toEqual([]);

  // o laço sobre os três da fila (e não sobre o quarto, nem sobre o resto da mesa)
  await arrastarLaco(p, { x: 42.5, y: 33.5 }, { x: 48.75, y: 37 });
  await expect.poll(() => selecionados(p)).toEqual(tres);
  expect(quadros(m, "mapa.ping")).toHaveLength(1);
  expect(await selecionados(p)).not.toContain(g4.id);

  // com Shift o laço soma: o quarto entra sem tirar os três
  await arrastarLaco(p, { x: 50.5, y: 36.5 }, { x: 54, y: 40 }, { shift: true });
  await expect.poll(() => selecionados(p)).toEqual([...tres, g4.id].sort());
  // um clique no vazio solta a seleção; o laço sem Shift recomeça do zero
  await arrastarLaco(p, { x: 42.5, y: 33.5 }, { x: 48.75, y: 37 });
  await expect.poll(() => selecionados(p)).toEqual(tres);

  // arrastar um dos três leva os três juntos, mantendo o arranjo, num pedido só
  await arrastarToken(p, g2.id, 3, Q);
  await expect
    .poll(async () => {
      const t = await goblins(p);
      return t.slice(0, 3).map((x) => [arred(x.x), arred(x.y)]);
    })
    .toEqual([
      [g1.x + 3, g1.y + Q],
      [g2.x + 3, g2.y + Q],
      [g3.x + 3, g3.y + Q],
    ]);
  expect(await selecionados(p)).toEqual(tres);
  expect(quadros(m, "tokens.mover")).toHaveLength(1);
  expect(quadros(m, "token.soltar")).toHaveLength(0);
  expect((await goblins(p))[3]).toMatchObject({ x: g4.x, y: g4.y });

  // as setas andam os três de uma vez, também num pedido só
  await p.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await goblins(p)).slice(0, 3).map((x) => arred(x.x)))
    .toEqual([g1.x + 3 + Q, g2.x + 3 + Q, g3.x + 3 + Q]);
  expect(quadros(m, "tokens.mover")).toHaveLength(2);
  expect(quadros(m, "token.soltar")).toHaveLength(0);
  expect((await goblins(p))[3]).toMatchObject({ x: g4.x, y: g4.y });

  // dano em lote: o Goblin 1 tem 4 temporários, então só perde 1 de vida; os outros dois perdem 5; o quarto não muda
  await mandar(p, "token.vida", { id: g1.id, temp: 4 });
  await expect.poll(async () => (await doToken(p, g1.id)).barra?.temp).toBe(4);
  await expect(p.getByTestId("marca-vida-lote")).toHaveText("3 selecionados");
  await p.keyboard.press("e");
  await p.getByTestId("marca-vida-campo").fill("12");
  await p.getByTestId("marca-vida-campo").press("Enter");
  // um valor sem sinal não vale para vários: o campo continua aberto e nada foi enviado
  await expect(p.getByTestId("marca-vida-campo")).toBeVisible();
  expect(quadros(m, "tokens.vidaDelta")).toHaveLength(0);
  await p.getByTestId("marca-vida-campo").fill("-5");
  await p.getByTestId("marca-vida-campo").press("Enter");
  await expect.poll(async () => (await doToken(p, g2.id)).barra?.fracao).toBeCloseTo(2 / 7, 5);
  expect((await doToken(p, g3.id)).barra?.fracao).toBeCloseTo(2 / 7, 5);
  expect((await doToken(p, g1.id)).barra).toMatchObject({ temp: 0 });
  expect((await doToken(p, g1.id)).barra?.fracao).toBeCloseTo(6 / 7, 5);
  expect((await doToken(p, g4.id)).barra?.fracao).toBeCloseTo(1, 5);
  const dano = quadros(m, "tokens.vidaDelta");
  expect(dano).toHaveLength(1);
  expect(dano[0]).toContain('"delta":-5');
  // nenhum `token.vida` por token: o único é o da preparação (os 4 de temporários do Goblin 1)
  expect(quadros(m, "token.vida")).toHaveLength(1);

  // a cura em lote pelo menu do token (vários selecionados): "Vida dos 3 selecionados…"
  const ponto = await pontoNaPagina(p, (await doToken(p, g2.id)).x, (await doToken(p, g2.id)).y);
  await p.mouse.click(ponto.x, ponto.y, { button: "right" });
  await p.getByTestId("menu-token-vida-lote").click();
  await p.getByTestId("menu-token-vida-lote-campo").fill("+3");
  await p.getByTestId("menu-token-vida-lote-campo").press("Enter");
  await expect.poll(async () => (await doToken(p, g2.id)).barra?.fracao).toBeCloseTo(5 / 7, 5);
  expect((await doToken(p, g3.id)).barra?.fracao).toBeCloseTo(5 / 7, 5);
  expect((await doToken(p, g1.id)).barra?.fracao).toBeCloseTo(1, 5);
  expect(quadros(m, "tokens.vidaDelta")).toHaveLength(2);
});

test("a borda colorida vale para os selecionados, todos veem e some com 'sem borda'; sem selo no token", async ({
  mesa,
  request,
}) => {
  test.setTimeout(150_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");
  const p = m.pagina;
  await criarGoblin(p);
  await porGoblins(p);
  const [g1, g2, g3] = (await goblins(p)) as [TokenVisto, TokenVisto, TokenVisto];
  // não há mais selo com o número: o nome "Goblin 2" basta
  expect(g2.nome).toBe("Goblin 2");
  expect("selo" in g2).toBe(false);

  // dois selecionados (laço), uma borda vermelha pelo menu: um pedido só
  await arrastarLaco(p, { x: 43.25, y: 33.5 }, { x: 46.5, y: 37 });
  await expect.poll(() => selecionados(p)).toEqual([g1.id, g2.id].sort());
  const ponto = await pontoNaPagina(p, g1.x, g1.y);
  await p.mouse.click(ponto.x, ponto.y, { button: "right" });
  const vermelho = p.getByTestId("menu-token-borda-vermelho");
  await expect(vermelho).toHaveAttribute("aria-label", "Borda vermelho");
  await expect(p.getByTestId("menu-token-borda-nenhuma")).toHaveAttribute(
    "aria-label",
    "Sem borda",
  );
  await vermelho.click();
  await expect.poll(async () => (await doToken(p, g1.id)).borda).toBe("vermelho");
  expect((await doToken(p, g2.id)).borda).toBe("vermelho");
  expect((await doToken(p, g3.id)).borda).toBeNull();
  expect(quadros(m, "tokens.editar")).toHaveLength(1);
  // o jogador vê a borda (todos que veem o token a veem)
  await expect.poll(async () => (await doToken(j.pagina, g1.id)).borda).toBe("vermelho");
  expect((await doToken(j.pagina, g2.id)).borda).toBe("vermelho");
  expect((await doToken(j.pagina, g3.id)).borda).toBeNull();

  // o jogador não tem o menu de borda (é do mestre): a sala também recusa a edição
  const recusa = await j.pagina.evaluate(async () => {
    const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
    return await new Promise<string | null>((resolve) => {
      const fim = setTimeout(() => resolve(null), 4000);
      ws.onopen = () =>
        ws.send(
          JSON.stringify({
            v: 1,
            id: "j-borda",
            tipo: "tokens.editar",
            dados: { ids: ["q11-g3"], mudancas: { borda: "azul" } },
          }),
        );
      ws.onmessage = (e) => {
        const o = JSON.parse(String(e.data));
        if (o.tipo === "erro" || o.tipo === "evento") {
          clearTimeout(fim);
          ws.close();
          resolve(o.tipo === "erro" ? (o.dados?.codigo ?? "erro") : "evento");
        }
      };
    });
  });
  expect(recusa).toBe("sem_permissao");

  // "Editar token…" com os dois selecionados: a borda azul vale para os dois; "sem borda" tira de todos
  await p.mouse.click(ponto.x, ponto.y, { button: "right" });
  await p.getByTestId("menu-token-editar").click();
  await expect(p.getByTestId("painel-token")).toBeVisible();
  await p.getByTestId("token-borda-azul").click();
  await expect.poll(async () => (await doToken(p, g1.id)).borda).toBe("azul");
  expect((await doToken(p, g2.id)).borda).toBe("azul");
  expect((await doToken(p, g3.id)).borda).toBeNull();
  await p.getByTestId("token-borda-nenhuma").click();
  await expect.poll(async () => (await doToken(p, g1.id)).borda).toBeNull();
  expect((await doToken(p, g2.id)).borda).toBeNull();
});

test("a barra de vida: o mestre vê em todos, o jogador só no dele; desligar em 'Editar token' tira; o padrão do personagem vale", async ({
  mesa,
  request,
}) => {
  test.setTimeout(150_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");
  const p = m.pagina;
  await criarGoblin(p);
  await porGoblins(p);
  const [g1] = (await goblins(p)) as [TokenVisto];

  // o mestre vê a barra em todos (inclusive no NPC da semente e nos goblins, que nascem com ela)
  for (const id of ["tok-jogador-1", "tok-jogador-2", "tok-ogro", g1.id]) {
    await expect.poll(async () => (await doToken(p, id)).barra).not.toBeNull();
  }
  expect((await doToken(p, "tok-jogador-1")).barra?.fracao).toBeCloseTo(1, 5);
  // o jogador só vê no token que controla
  await expect.poll(async () => (await doToken(j.pagina, "tok-jogador-1")).barra).not.toBeNull();
  for (const id of ["tok-jogador-2", "tok-ogro", g1.id]) {
    expect((await doToken(j.pagina, id)).barra, id).toBeNull();
  }
  // e o dano no token dele aparece ao vivo na barra dele
  await mandar(p, "ficha.alterar", {
    personagemId: "pers-aldric",
    operacoes: [{ caminho: "pvAtual", valor: 6 }],
  });
  await expect
    .poll(async () => (await doToken(j.pagina, "tok-jogador-1")).barra?.fracao)
    .toBeCloseTo(0.5, 5);
  expect((await doToken(p, "tok-jogador-1")).barra?.fracao).toBeCloseTo(0.5, 5);

  // desligar "Barra de vida" no Editar token tira a barra daquele token (e de ninguém mais)
  await abrirPainelDoToken(p, g1.id);
  const caixa = p.getByTestId("token-barra-de-vida");
  await expect(caixa).toBeChecked();
  await caixa.click();
  await expect.poll(async () => (await doToken(p, g1.id)).barra).toBeNull();
  expect((await doToken(p, "q11-g2")).barra).not.toBeNull();
  await caixa.click();
  await expect.poll(async () => (await doToken(p, g1.id)).barra).not.toBeNull();

  // o token padrão do personagem com a barra desligada: o token novo nasce sem ela
  await mandar(p, "personagem.editar", { id: GOBLIN, mudancas: { barraDeVida: false } });
  await mandar(p, "personagem.colocar", {
    personagemId: GOBLIN,
    cenaId: CENA,
    tokenId: "q11-g5",
    x: 40.5,
    y: 40.5,
  });
  await expect.poll(async () => (await hook(p)).some((t) => t.id === "q11-g5")).toBe(true);
  expect((await doToken(p, "q11-g5")).barra).toBeNull();
  expect((await doToken(p, "q11-g2")).barra).not.toBeNull();

  // no "Ver como" do mestre, a barra segue a visão escolhida (o Aldric, só no token dele)
  await p.getByTestId("menu-ver-como").click();
  await p.getByTestId("ver-como-jogador-1").click();
  await expect(p.getByTestId("ver-como-selo")).toBeVisible();
  await expect.poll(async () => (await doToken(p, "tok-ogro")).barra).toBeNull();
  expect((await doToken(p, "tok-jogador-1")).barra).not.toBeNull();
  await p.getByTestId("menu-ver-como").click();
  await p.getByTestId("ver-como-eu").click();
  await expect.poll(async () => (await doToken(p, "tok-ogro")).barra).not.toBeNull();
});

test("o jogador não faz laço, não move nem dá dano em vários; Esc cancela o laço", async ({
  mesa,
  request,
}) => {
  test.setTimeout(150_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");
  const p = m.pagina;
  await criarGoblin(p);
  await porGoblins(p);

  // Esc no meio do arrasto cancela o laço do mestre: nada fica selecionado
  await arrastarLaco(p, { x: 42.5, y: 33.5 }, { x: 48.75, y: 37 }, { soltar: false });
  await p.keyboard.press("Escape");
  await p.mouse.up();
  await expect.poll(() => selecionados(p)).toEqual([]);

  // o jogador, arrastando no fundo vazio, não seleciona token nenhum
  await j.pagina.evaluate(() => {
    const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
    h.centrarEm(48, 36);
  });
  await arrastarLaco(j.pagina, { x: 42.5, y: 33.5 }, { x: 48.75, y: 37 });
  expect(await selecionados(j.pagina)).toEqual([]);

  // as intenções em lote são recusadas ao jogador (mover os do mestre, dano nos goblins)
  const codigos = await j.pagina.evaluate(async () => {
    const enviar = (tipo: string, dados: object) =>
      new Promise<string | null>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
        const fim = setTimeout(() => resolve(null), 4000);
        ws.onopen = () => ws.send(JSON.stringify({ v: 1, id: `j-${tipo}`, tipo, dados }));
        ws.onmessage = (e) => {
          const o = JSON.parse(String(e.data));
          if (o.tipo === "erro" || o.tipo === "evento") {
            clearTimeout(fim);
            ws.close();
            resolve(o.tipo === "erro" ? (o.dados?.codigo ?? "erro") : "evento");
          }
        };
      });
    return [
      await enviar("tokens.mover", { itens: [{ id: "q11-g1", x: 5, y: 5 }] }),
      await enviar("tokens.vidaDelta", { ids: ["q11-g1"], delta: -3 }),
    ];
  });
  expect(codigos).toEqual(["sem_permissao", "token_inexistente"]);
});
