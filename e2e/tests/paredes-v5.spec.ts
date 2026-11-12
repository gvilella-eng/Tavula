import type { Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, menuDaCena, test } from "./ajudas";
import { entrarNoMapa, esperarPosicao, type GanchoDoMapa, pontoNaPagina } from "./ajudasMapa";

// Lote V5: quem vê os contornos das paredes e portas, a Visão do mestre, o encaixe em meia célula (grid de
// 1,5 m: passo de 0,75 m) e os arcos (tecla A). A semente tem a sala de 4,5 a 18 m em x e de 24 a 36 m em y,
// com a porta fechada no alto (par-sala-porta, x de 10,5 a 12 em y 24); a cena é a "cena-1" (60 × 45 m).

type Gancho = GanchoDoMapa;
const gancho = <K extends keyof Gancho>(
  p: Page,
  nome: K,
): Promise<ReturnType<Gancho[K] extends (...a: never[]) => unknown ? Gancho[K] : never>> =>
  p.evaluate(
    (n) =>
      (
        (window as unknown as { __tabletop: Record<string, () => unknown> }).__tabletop[
          n
        ] as () => unknown
      )(),
    nome as string,
  ) as never;

const contornos = (p: Page) => gancho(p, "contornos");
const paredesDe = (p: Page) => gancho(p, "paredes");
const portasDe = (p: Page) => gancho(p, "portas");

async function centrar(p: Page, x: number, y: number) {
  await p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(
        px as number,
        py as number,
      ),
    [x, y],
  );
}

async function colocar(mestre: Page, id: string, x: number, y: number) {
  const r = await enviarCru(mestre, intencaoCrua("token.soltar", { id, x, y }));
  expect(r?.tipo).toBe("evento");
}

test("o jogador não vê os contornos por padrão e vê quando a cena pede; a secreta nunca chega", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;

  // padrão: o mestre vê (Visão do mestre ligada); o jogador não
  expect(await contornos(m)).toBe(true);
  expect(await contornos(j)).toBe(false);
  // o jogador continua recebendo as paredes (a visão, a luz e o bloqueio dependem delas)
  expect((await paredesDe(j)).length).toBeGreaterThan(3);

  await menuDaCena(m, "cena-1", "configurar");
  const caixa = m.getByTestId("cfg-mostrar-paredes");
  await expect(caixa).not.toBeChecked();
  await caixa.check();
  await m.getByTestId("cfg-salvar").click();
  await expect.poll(() => contornos(j)).toBe(true);

  // a secreta continua sem chegar ao jogador, e a parede invisível não é desenhada (só vem como dado)
  expect(j1.frames.some((f) => f.includes('"tipo":"secreta"'))).toBe(false);
  expect((await paredesDe(j)).some((q) => q.tipo === "secreta")).toBe(false);

  // desliga de novo
  await menuDaCena(m, "cena-1", "configurar");
  await expect(m.getByTestId("cfg-mostrar-paredes")).toBeChecked();
  await m.getByTestId("cfg-mostrar-paredes").uncheck();
  await m.getByTestId("cfg-salvar").click();
  await expect.poll(() => contornos(j)).toBe(false);
});

test("o jogador abre a porta escondida pelo clique e vê o destaque ao passar o mouse", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j = j1.pagina;
  await colocar(mestre.pagina, "tok-jogador-1", 11.25, 24.75);
  await esperarPosicao(j, "tok-jogador-1", 11.25, 24.75);
  expect(await contornos(j)).toBe(false);

  const porta = (await portasDe(j)).find((q) => q.id === "par-sala-porta");
  if (!porta) throw new Error("a porta não aparece");
  await centrar(j, porta.meio.x, porta.meio.y);
  const alvo = await pontoNaPagina(j, porta.meio.x, porta.meio.y);
  expect(await gancho(j, "portaDestacada")).toBeNull();
  await j.mouse.move(alvo.x - 60, alvo.y - 60);
  await j.mouse.move(alvo.x, alvo.y, { steps: 4 });
  await expect.poll(() => gancho(j, "portaDestacada")).toBe("par-sala-porta");
  await expect.poll(() => gancho(j, "cursor")).toBe("pointer");
  // os contornos seguem escondidos; só a porta sob o mouse se destaca
  expect(await contornos(j)).toBe(false);

  await j.mouse.click(alvo.x, alvo.y);
  await expect
    .poll(async () => (await portasDe(j)).find((q) => q.id === "par-sala-porta")?.estado)
    .toBe("aberta");
  await j.mouse.move(alvo.x - 80, alvo.y - 80);
  await expect.poll(() => gancho(j, "portaDestacada")).toBeNull();
});

test("a Visão do mestre liga e desliga os contornos; com a ferramenta Paredes eles aparecem sempre", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const botao = p.getByTestId("menu-visao-noturna");
  await expect(botao).toHaveAttribute("aria-label", /Visão do mestre/);

  await expect(botao).toHaveAttribute("aria-pressed", "true");
  expect(await contornos(p)).toBe(true);
  expect((await gancho(p, "visao")).modo).toBe("noturna");

  await botao.click();
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => contornos(p)).toBe(false);
  expect((await gancho(p, "visao")).modo).toBe("claro");

  // com a ferramenta Paredes, aparecem mesmo desligada
  await p.getByTestId("ferramenta-paredes").click();
  await expect.poll(() => contornos(p)).toBe(true);
  await p.getByTestId("ferramenta-paredes").click();
  await expect.poll(() => contornos(p)).toBe(false);

  // o mestre ainda enxerga a porta (clicável) com os contornos escondidos
  expect((await portasDe(p)).length).toBeGreaterThan(0);
  await botao.click();
  await expect.poll(() => contornos(p)).toBe(true);
});

test("desenhar encaixa na meia célula e em diagonal; o Alt solta do grid", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const antes = (await paredesDe(p)).length;
  await p.getByTestId("ferramenta-paredes").click();
  await centrar(p, 45, 7.5);
  expect(await gancho(p, "quadradoM")).toBe(1.5);

  // o ponto de fixação sob o cursor é o da rede de meia célula (0,75 m)
  let c = await pontoNaPagina(p, 42.4, 6.3);
  await p.mouse.move(c.x - 20, c.y - 20);
  await p.mouse.move(c.x, c.y, { steps: 3 });
  await expect.poll(() => gancho(p, "pontoDeFixacao")).toEqual({ x: 42.75, y: 6 });

  // diagonal de (42,75; 6) a (45; 8,25)
  await p.mouse.click(c.x, c.y);
  const b = await pontoNaPagina(p, 45.2, 8.2);
  await p.mouse.dblclick(b.x, b.y);
  await expect.poll(async () => (await paredesDe(p)).length).toBe(antes + 1);
  const nova = (await paredesDe(p)).at(-1);
  expect(nova?.a).toEqual({ x: 42.75, y: 6 });
  expect(nova?.b).toEqual({ x: 45, y: 8.25 });
  expect(nova?.meio).toBeUndefined();

  // meia célula é o menor passo: dois pontos a 0,75 m um do outro valem
  const a2 = await pontoNaPagina(p, 42.75, 12);
  const b2 = await pontoNaPagina(p, 43.5, 12);
  await p.mouse.click(a2.x, a2.y);
  await p.mouse.dblclick(b2.x, b2.y);
  await expect.poll(async () => (await paredesDe(p)).length).toBe(antes + 2);
  const curta = (await paredesDe(p)).at(-1);
  expect(curta?.a).toEqual({ x: 42.75, y: 12 });
  expect(curta?.b).toEqual({ x: 43.5, y: 12 });

  // Alt inverte o encaixe: o ponto fica onde o mouse está
  c = await pontoNaPagina(p, 42.4, 15.3);
  const d = await pontoNaPagina(p, 44.1, 15.3);
  await p.keyboard.down("Alt");
  await p.mouse.click(c.x, c.y);
  await p.mouse.dblclick(d.x, d.y);
  await p.keyboard.up("Alt");
  await expect.poll(async () => (await paredesDe(p)).length).toBe(antes + 3);
  const livre = (await paredesDe(p)).at(-1);
  expect(Math.abs((livre?.a.x ?? 0) - 42.4)).toBeLessThan(0.06);
  expect(Math.abs((livre?.b.x ?? 0) - 44.1)).toBeLessThan(0.06);
  expect(Math.abs((livre?.a.x ?? 0) / 0.75 - Math.round((livre?.a.x ?? 0) / 0.75))).toBeGreaterThan(
    0.1,
  );
});

test("linha, A, arco tangente, A, linha; Esc encerra e as três paredes chegam à sala", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const antes = (await paredesDe(p)).length;
  await p.getByTestId("ferramenta-paredes").click();
  await centrar(p, 45, 9);
  const pt = (x: number, y: number) => pontoNaPagina(p, x, y);

  await expect(p.getByTestId("parede-modo")).toContainText("linha");
  let q = await pt(42, 6);
  await p.mouse.click(q.x, q.y);
  q = await pt(45, 6);
  await p.mouse.click(q.x, q.y); // linha
  await p.keyboard.press("a");
  await expect.poll(() => gancho(p, "modoArco")).toBe(true);
  await expect(p.getByTestId("parede-modo")).toContainText("arco");
  q = await pt(46.5, 7.5);
  await p.mouse.click(q.x, q.y); // arco tangente: quarto de círculo de raio 1,5
  await p.keyboard.press("a");
  await expect.poll(() => gancho(p, "modoArco")).toBe(false);
  q = await pt(46.5, 10.5);
  await p.mouse.click(q.x, q.y); // linha
  await p.keyboard.press("Escape");

  await expect.poll(async () => (await paredesDe(p)).length).toBe(antes + 3);
  const novas = (await paredesDe(p)).slice(-3);
  expect(novas.map((w) => w.meio !== undefined)).toEqual([false, true, false]);
  const arco = novas[1];
  expect(arco?.a).toEqual({ x: 45, y: 6 });
  expect(arco?.b).toEqual({ x: 46.5, y: 7.5 });
  // sai tangente à reta anterior: o ponto do arco é o do quarto de círculo de centro (45; 7,5)
  expect(Math.abs((arco?.meio?.x ?? 0) - (45 + 1.5 * Math.SQRT1_2))).toBeLessThan(0.01);
  expect(Math.abs((arco?.meio?.y ?? 0) - (7.5 - 1.5 * Math.SQRT1_2))).toBeLessThan(0.01);
  // a sala recebeu uma única mensagem com os três trechos
  const criadas = mestre.enviados.filter((f) => f.includes('"parede.criar"'));
  expect(criadas.at(-1)).toContain('"meio"');
  // o modo de arco volta a "linha" ao encerrar
  expect(await gancho(p, "modoArco")).toBe(false);
});

test("arco de 3 pontos, seleção, e apagar o arco com Delete", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const antes = (await paredesDe(p)).length;
  await p.getByTestId("ferramenta-paredes").click();
  await centrar(p, 45, 10.5);
  const pt = (x: number, y: number) => pontoNaPagina(p, x, y);

  await p.keyboard.press("a");
  let q = await pt(42, 12);
  await p.mouse.click(q.x, q.y); // início
  q = await pt(48, 12);
  await p.mouse.click(q.x, q.y); // fim
  q = await pt(45, 9);
  await p.mouse.click(q.x, q.y); // curvatura
  await p.keyboard.press("Escape");
  await expect.poll(async () => (await paredesDe(p)).length).toBe(antes + 1);
  const arco = (await paredesDe(p)).at(-1);
  expect(arco?.a).toEqual({ x: 42, y: 12 });
  expect(arco?.b).toEqual({ x: 48, y: 12 });
  expect(arco?.meio).toEqual({ x: 45, y: 9 });

  // seleciona clicando no corpo do arco e o painel mostra "Arco"
  q = await pt(45, 9);
  await p.mouse.click(q.x, q.y);
  await expect(p.getByTestId("parede-selecionada")).toBeVisible();
  await expect(p.getByTestId("parede-selecionada")).toContainText("Arco");
  // muda o tipo (como na reta) e apaga
  await p.getByTestId("parede-tipo").selectOption("janela");
  await expect.poll(async () => (await paredesDe(p)).at(-1)?.tipo).toBe("janela");
  expect((await paredesDe(p)).at(-1)?.meio).toEqual({ x: 45, y: 9 });
  await p.keyboard.press("Delete");
  await expect.poll(async () => (await paredesDe(p)).length).toBe(antes);
});

test("o token do jogador não atravessa o arco (e passa pelo lado de fora)", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  // arco de (30; 10,5) a (30; 16,5) com a barriga para a direita, até x = 33
  const r = await enviarCru(
    mestre.pagina,
    intencaoCrua("parede.criar", {
      paredes: [
        {
          id: "par-arco-v5",
          a: { x: 30, y: 10.5 },
          b: { x: 30, y: 16.5 },
          meio: { x: 33, y: 13.5 },
          tipo: "parede",
        },
      ],
    }),
  );
  expect(r?.tipo).toBe("evento");
  await expect
    .poll(async () => (await paredesDe(j1.pagina)).find((w) => w.id === "par-arco-v5")?.meio)
    .toEqual({ x: 33, y: 13.5 });

  await colocar(mestre.pagina, "tok-jogador-1", 28.5, 13.5);
  await esperarPosicao(j1.pagina, "tok-jogador-1", 28.5, 13.5);
  const atravessa = await enviarCru(
    j1.pagina,
    intencaoCrua("token.soltar", { id: "tok-jogador-1", x: 36, y: 13.5 }),
  );
  expect(atravessa?.dados.codigo).toBe("trajeto_bloqueado");
  // por cima da ponta do arco (y = 9) o caminho é livre
  for (const [x, y] of [
    [28.5, 9],
    [36, 9],
  ] as const) {
    const livre = await enviarCru(
      j1.pagina,
      intencaoCrua("token.soltar", { id: "tok-jogador-1", x, y }),
    );
    expect(livre?.tipo).toBe("evento");
    await esperarPosicao(j1.pagina, "tok-jogador-1", x, y);
  }
});
