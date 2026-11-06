import type { Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import {
  entrarNoMapa,
  esperarPosicao,
  type GanchoDoMapa,
  pontoNaPagina,
  tokenDe,
  tokensDe,
} from "./ajudasMapa";

// Lote 5: paredes, portas e linha de visão. A semente tem uma sala na Cena inicial (4,5 a 18 m em x,
// 24 a 36 m em y): porta fechada no alto (10,5 a 12 em x), janela à direita, porta trancada à
// esquerda (y 30 a 31,5) e porta secreta embaixo (x 7,5 a 9).

const gancho = (p: Page) =>
  p.evaluate(() => {
    const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
    return { portas: h.portas(), paredes: h.paredes(), visao: h.visao(), veu: h.veuVisivel() };
  });

const portasDe = (p: Page) => gancho(p).then((g) => g.portas);

/** O mestre coloca um token onde quiser (o mestre ignora paredes). */
async function colocar(mestre: Page, id: string, x: number, y: number) {
  const r = await enviarCru(mestre, intencaoCrua("token.soltar", { id, x, y }));
  expect(r?.tipo).toBe("evento");
}

async function cliqueNaPorta(p: Page, portaId: string, botao: "left" | "right" = "left") {
  const porta = (await portasDe(p)).find((q) => q.id === portaId);
  if (!porta) throw new Error(`porta ${portaId} não aparece`);
  await p.evaluate(
    ([x, y]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(
        x as number,
        y as number,
      ),
    [porta.meio.x, porta.meio.y],
  );
  const alvo = await pontoNaPagina(p, porta.meio.x, porta.meio.y);
  await p.mouse.click(alvo.x, alvo.y, { button: botao });
}

const estadoDaPorta = async (p: Page, id: string) =>
  (await portasDe(p)).find((q) => q.id === id)?.estado;

test("frames: o jogador nunca recebe 'secreta'; aberta chega como porta aberta e fechada volta a parede", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const alternar = () =>
    enviarCru(mestre.pagina, intencaoCrua("porta.alternar", { id: "par-sala-secreta" }));

  const snapshot = JSON.parse(j1.frames.find((f) => f.includes('"tipo":"snapshot"')) ?? "{}");
  const paredes = snapshot.dados.estado.paredes as { id: string; tipo: string; estado?: string }[];
  expect(paredes.find((p) => p.id === "par-sala-secreta")).toMatchObject({ tipo: "parede" });
  expect(paredes.find((p) => p.id === "par-sala-secreta")?.estado).toBeUndefined();

  expect((await alternar())?.tipo).toBe("evento"); // aberta
  await expect
    .poll(() => j1.frames.filter((f) => f.includes('"parede.editada"')).length)
    .toBeGreaterThan(0);
  const eventosDaSecreta = () =>
    j1.frames
      .filter((f) => f.includes('"parede.editada"') && f.includes("par-sala-secreta"))
      .map((f) => JSON.parse(f).dados.dados.parede);
  expect(eventosDaSecreta().at(-1)).toMatchObject({ tipo: "porta", estado: "aberta" });

  await alternar(); // fechada: volta a parede, sem estado
  await expect.poll(() => eventosDaSecreta().length).toBe(2);
  expect(eventosDaSecreta().at(-1)).toMatchObject({ tipo: "parede" });
  expect(eventosDaSecreta().at(-1).estado).toBeUndefined();

  // trancar e destrancar a secreta é invisível para o jogador: nada chega
  const antes = j1.frames.length;
  await enviarCru(
    mestre.pagina,
    intencaoCrua("parede.editar", { id: "par-sala-secreta", estado: "trancada" }),
  );
  await expect
    .poll(() => mestre.frames.some((f) => f.includes('"trancada"') && f.includes("secreta")))
    .toBe(true);
  expect(j1.frames.slice(antes).some((f) => f.includes("par-sala-secreta"))).toBe(false);

  // paredes de outra cena não chegam ao jogador
  await enviarCru(
    mestre.pagina,
    intencaoCrua("parede.criar", {
      cenaId: "cena-covil",
      paredes: [{ id: "par-covil", a: { x: 3, y: 3 }, b: { x: 6, y: 3 }, tipo: "parede" }],
    }),
  );
  await expect.poll(() => mestre.frames.some((f) => f.includes("par-covil"))).toBe(true);
  expect(j1.frames.some((f) => f.includes("par-covil"))).toBe(false);

  // nenhum frame do jogador cita o tipo; o do mestre cita
  expect(j1.frames.some((f) => f.includes('"tipo":"secreta"'))).toBe(false);
  expect(mestre.frames.some((f) => f.includes("secreta"))).toBe(true);
});

test("o mestre desenha um corredor com porta pela interface", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const antes = (await gancho(p)).paredes.length;
  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-paredes").click();
  await expect(p.getByTestId("painel-paredes")).toBeVisible();

  await p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(45, 7.5),
  );
  const pt = (x: number, y: number) => pontoNaPagina(p, x, y);
  // parede de cima: clique, duplo clique
  let a = await pt(42, 6);
  let b = await pt(48, 6);
  await p.mouse.click(a.x, a.y);
  await p.mouse.dblclick(b.x, b.y);
  await expect.poll(async () => (await gancho(p)).paredes.length).toBe(antes + 1);
  // parede de baixo: clique, clique, Esc
  a = await pt(42, 9);
  b = await pt(48, 9);
  await p.mouse.click(a.x, a.y);
  await p.mouse.click(b.x, b.y);
  await p.keyboard.press("Escape");
  await expect.poll(async () => (await gancho(p)).paredes.length).toBe(antes + 2);
  // a porta do fundo: desenhada como porta
  await p.getByTestId("parede-novo-porta").click();
  a = await pt(48, 6);
  b = await pt(48, 9);
  await p.mouse.click(a.x, a.y);
  await p.mouse.dblclick(b.x, b.y);
  await expect.poll(async () => (await gancho(p)).paredes.length).toBe(antes + 3);
  const criadas = mestre.enviados.filter((f) => f.includes('"parede.criar"'));
  expect(criadas).toHaveLength(3);
  const porta = (await portasDe(p)).find((q) => q.meio.x === 48 && q.meio.y === 7.5);
  expect(porta?.estado).toBe("fechada");

  // seleciona pela porta, tranca pelo painel, apaga com Delete
  const alvo = await pt(48, 7.5);
  await p.mouse.click(alvo.x, alvo.y);
  await expect(p.getByTestId("parede-selecionada")).toBeVisible();
  await p.getByTestId("parede-estado").selectOption("trancada");
  await expect.poll(() => estadoDaPorta(p, porta?.id ?? "")).toBe("trancada");
  await p.keyboard.press("Delete");
  await expect.poll(async () => (await gancho(p)).paredes.length).toBe(antes + 2);
});

test("o jogador abre a porta ao alcance; longe ou trancada, não", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await colocar(mestre.pagina, "tok-jogador-1", 11.25, 24.75);
  await esperarPosicao(j1.pagina, "tok-jogador-1", 11.25, 24.75);

  await cliqueNaPorta(j1.pagina, "par-sala-porta");
  await expect.poll(() => estadoDaPorta(j1.pagina, "par-sala-porta")).toBe("aberta");
  await expect.poll(() => estadoDaPorta(mestre.pagina, "par-sala-porta")).toBe("aberta");
  await cliqueNaPorta(j1.pagina, "par-sala-porta");
  await expect.poll(() => estadoDaPorta(j1.pagina, "par-sala-porta")).toBe("fechada");

  // longe (6,75 m do meio da porta): avisa e não muda
  await colocar(mestre.pagina, "tok-jogador-1", 11.25, 30.75);
  await esperarPosicao(j1.pagina, "tok-jogador-1", 11.25, 30.75);
  await cliqueNaPorta(j1.pagina, "par-sala-porta");
  await expect(j1.pagina.getByTestId("aviso")).toHaveAttribute("data-codigo", "fora_de_alcance");
  expect(await estadoDaPorta(j1.pagina, "par-sala-porta")).toBe("fechada");

  // trancada, mesmo ao lado
  await colocar(mestre.pagina, "tok-jogador-1", 5.25, 30.75);
  await esperarPosicao(j1.pagina, "tok-jogador-1", 5.25, 30.75);
  await cliqueNaPorta(j1.pagina, "par-sala-trancada");
  await expect(j1.pagina.getByTestId("aviso")).toHaveAttribute("data-codigo", "porta_trancada");
  expect(await estadoDaPorta(j1.pagina, "par-sala-trancada")).toBe("trancada");

  // o mestre tranca e destranca com o clique direito no ícone
  await cliqueNaPorta(mestre.pagina, "par-sala-porta", "right");
  await expect.poll(() => estadoDaPorta(mestre.pagina, "par-sala-porta")).toBe("trancada");
  await cliqueNaPorta(mestre.pagina, "par-sala-porta", "right");
  await expect.poll(() => estadoDaPorta(mestre.pagina, "par-sala-porta")).toBe("fechada");
});

test("o jogador não solta o token do outro lado de uma parede; o mestre solta", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await colocar(mestre.pagina, "tok-jogador-1", 11.25, 27.75);
  await esperarPosicao(j1.pagina, "tok-jogador-1", 11.25, 27.75);

  // pela sala: recusado, e a posição não muda
  const recusa = await enviarCru(
    j1.pagina,
    intencaoCrua("token.soltar", { id: "tok-jogador-1", x: 11.25, y: 21.75 }),
  );
  expect(recusa?.dados.codigo).toBe("trajeto_bloqueado");
  // dentro da sala pode
  const livre = await enviarCru(
    j1.pagina,
    intencaoCrua("token.soltar", { id: "tok-jogador-1", x: 11.25, y: 31.5 }),
  );
  expect(livre?.tipo).toBe("evento");
  await esperarPosicao(j1.pagina, "tok-jogador-1", 11.25, 31.5);

  // pelo mouse: o token não atravessa a parede da esquerda
  await j1.pagina.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(11.25, 31.5),
  );
  const ini = await pontoNaPagina(j1.pagina, 11.25, 31.5);
  const fim = await pontoNaPagina(j1.pagina, 1.5, 31.5);
  await j1.pagina.mouse.move(ini.x, ini.y);
  await j1.pagina.mouse.down();
  await j1.pagina.mouse.move(fim.x, fim.y, { steps: 12 });
  await j1.pagina.mouse.up();
  await expect.poll(async () => (await tokenDe(j1.pagina, "tok-jogador-1")).x).toBeGreaterThan(4.5);

  // o mestre atravessa
  const m = await enviarCru(
    mestre.pagina,
    intencaoCrua("token.soltar", { id: "tok-jogador-1", x: 11.25, y: 21.75 }),
  );
  expect(m?.tipo).toBe("evento");
  await esperarPosicao(j1.pagina, "tok-jogador-1", 11.25, 21.75);
});

test("visão: o token atrás da porta fechada não é desenhado para o jogador e passa a ser quando abre", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await colocar(mestre.pagina, "tok-jogador-1", 11.25, 27.75);
  await colocar(mestre.pagina, "tok-jogador-2", 11.25, 18.75);
  await esperarPosicao(j1.pagina, "tok-jogador-2", 11.25, 18.75);

  const desenhado = async (p: Page, id: string) => (await tokenDe(p, id)).desenhado;
  await expect.poll(() => desenhado(j1.pagina, "tok-jogador-2")).toBe(false);
  expect(await desenhado(j1.pagina, "tok-jogador-1")).toBe(true);
  expect(await desenhado(mestre.pagina, "tok-jogador-2")).toBe(true);

  await enviarCru(mestre.pagina, intencaoCrua("porta.alternar", { id: "par-sala-porta" }));
  await expect.poll(() => desenhado(j1.pagina, "tok-jogador-2")).toBe(true);
  await enviarCru(mestre.pagina, intencaoCrua("porta.alternar", { id: "par-sala-porta" }));
  await expect.poll(() => desenhado(j1.pagina, "tok-jogador-2")).toBe(false);
  // a sala não filtra por visão: o token chegou ao navegador do jogador
  expect((await tokensDe(j1.pagina)).some((t) => t.id === "tok-jogador-2")).toBe(true);
});

test("iluminação dinâmica desligada mostra tudo ao jogador", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await colocar(mestre.pagina, "tok-jogador-1", 11.25, 27.75);
  const ve = (x: number, y: number) =>
    j1.pagina.evaluate(
      ([px, py]) =>
        (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.veNoPonto(
          px as number,
          py as number,
        ),
      [x, y],
    );
  await expect.poll(() => ve(50, 40)).toBe(false);

  await mestre.pagina.getByTestId("menu-iluminacao").click();
  await mestre.pagina.getByTestId("lanterna-iluminacao").click();
  await expect.poll(() => ve(50, 40)).toBe(true);
  await expect.poll(async () => (await gancho(j1.pagina)).veu).toBe(false);
  expect((await gancho(j1.pagina)).visao.modo).toBe("claro");

  await mestre.pagina.getByTestId("menu-iluminacao").click();
  await expect(mestre.pagina.getByTestId("lanterna-iluminacao")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await mestre.pagina.getByTestId("lanterna-iluminacao").click();
  await expect.poll(() => ve(50, 40)).toBe(false);
});

test("visão noturna e 'ver como o jogador X' mudam a tela do mestre", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;

  await expect.poll(async () => (await gancho(p)).visao.modo).toBe("noturna");
  expect((await gancho(p)).veu).toBe(true);
  await p.getByTestId("menu-visao-noturna").click();
  await expect.poll(async () => (await gancho(p)).visao.modo).toBe("claro");
  expect((await gancho(p)).veu).toBe(false);
  await p.getByTestId("menu-visao-noturna").click();
  await expect.poll(async () => (await gancho(p)).visao.modo).toBe("noturna");

  // o mestre vê a porta secreta e todos os tokens; como o jogador 1, só o que ele recebe
  expect((await portasDe(p)).some((q) => q.tipo === "secreta")).toBe(true);
  const todos = (await tokensDe(p)).length;
  await p.getByTestId("menu-visao-noturna").click({ button: "right" });
  await p.getByTestId("ver-como-jogador-1").click();
  await expect(p.getByTestId("ver-como-selo")).toBeVisible();
  await expect.poll(async () => (await gancho(p)).visao.modo).toBe("jogador");
  expect((await portasDe(p)).some((q) => q.tipo === "secreta")).toBe(false);
  expect((await tokensDe(p)).map((t) => t.id).sort()).toEqual(
    (await tokensDe(j1.pagina)).map((t) => t.id).sort(),
  );
  expect((await tokensDe(p)).length).toBeLessThan(todos);

  await p.getByTestId("menu-visao-noturna").click({ button: "right" });
  await p.getByTestId("ver-como-eu").click();
  await expect(p.getByTestId("ver-como-selo")).toHaveCount(0);
  await expect.poll(async () => (await gancho(p)).visao.modo).toBe("noturna");
  expect((await tokensDe(p)).length).toBe(todos);
});
