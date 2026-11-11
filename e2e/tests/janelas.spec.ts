import type { Locator, Page } from "@playwright/test";
import { test as base, expect, Mesa, type Sessao } from "./ajudas";
import { ligarOrdem } from "./ajudasCombate";
import { abrirFicha, criarDarion, DARION_ID } from "./ajudasFicha";
import { entrarNoMapa, selecionarToken } from "./ajudasMapa";

// Redesign R3: janelas flutuantes. Um componente só para a ordem de turno, a ficha, o painel do token,
// as paredes, as fontes de luz, a iluminação e os dados rápidos: arrasta pelo cabeçalho, dois cliques
// minimizam, posição e tamanho por usuário (no navegador dele, nunca na sala), sempre dentro da área do
// mapa e a última clicada fica por cima.

const CHAVE = (id: string) => `tabletop:pref:janela:${id}`;
const ID_FICHA = `ficha:${DARION_ID}`;

const test = base.extend<{ grande: Mesa }>({
  grande: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    await use(mesa);
    await mesa.fechar();
  },
});

type Caixa = { x: number; y: number; width: number; height: number };

async function caixa(l: Locator): Promise<Caixa> {
  const c = await l.boundingBox();
  if (!c) throw new Error("elemento sem caixa (não está visível)");
  return c;
}

/** A caixa `c` está inteira dentro de `area` (com folga de 1 px). */
function dentro(c: Caixa, area: Caixa) {
  return (
    c.x >= area.x - 1 &&
    c.y >= area.y - 1 &&
    c.x + c.width <= area.x + area.width + 1 &&
    c.y + c.height <= area.y + area.height + 1
  );
}

const area = (p: Page) => caixa(p.getByTestId("area-do-mapa"));
const janela = (p: Page, id: string) => p.getByTestId(`janela-${id}`);
const cabecalho = (p: Page, id: string) => janela(p, id).getByRole("toolbar");
const guardada = (p: Page, id: string) =>
  p.evaluate((k) => localStorage.getItem(k), CHAVE(id)).then((v) => (v ? JSON.parse(v) : null));
const zDe = (p: Page, id: string) =>
  janela(p, id).evaluate((e) => Number(getComputedStyle(e).zIndex));

/** Um ponto do cabeçalho que não é botão nem campo (perto do começo, no título). */
async function pontoDoCabecalho(p: Page, id: string) {
  const c = await caixa(cabecalho(p, id));
  return { x: c.x + 14, y: c.y + c.height / 2 };
}

/** Arrasta a janela pelo cabeçalho, com o mouse de verdade. */
async function arrastar(p: Page, id: string, dx: number, dy: number) {
  const a = await pontoDoCabecalho(p, id);
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(a.x + dx, a.y + dy, { steps: 8 });
  await p.mouse.up();
}

/** Espera a sala assentar (mensagens do início da conexão) antes de contar os frames. */
async function assentar(s: Sessao) {
  const p = s.pagina;
  let anterior = -1;
  await expect
    .poll(async () => {
      const agora = s.frames.length + s.enviados.length;
      const estavel = agora === anterior;
      anterior = agora;
      await p.waitForTimeout(700);
      return estavel;
    })
    .toBe(true);
}

// A sala manda, por conta própria, a presença e o uso do dia: não têm a ver com as janelas.
const proprios = (f: string) => !/"tipo":"(presenca|uso)"/.test(f);
const contagem = (s: Sessao) => ({
  enviados: s.enviados.length,
  recebidos: s.frames.filter(proprios).length,
});

async function recarregar(p: Page) {
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
}

const perto = (a: number, b: number, tolerancia = 1.5) => Math.abs(a - b) <= tolerancia;

test("arrastar a ordem de turno e a ficha: ficam no lugar ao recarregar, só neste navegador, sem nada para a sala", async ({
  grande,
}) => {
  test.setTimeout(90_000);
  const s = await entrarNoMapa(grande, "mestre");
  const p = s.pagina;
  await criarDarion(p);
  await ligarOrdem(p);
  const ficha = await abrirFicha(p, DARION_ID, "principal");
  await assentar(s);
  const antes = contagem(s);

  // padrão: a ordem de turno no alto à direita da área; nada guardado ainda
  const a = await area(p);
  const ordemAntes = await caixa(janela(p, "ordem"));
  expect(perto(ordemAntes.x + ordemAntes.width, a.x + a.width - 12)).toBe(true);
  expect(perto(ordemAntes.y, a.y + 12)).toBe(true);
  expect(await guardada(p, "ordem")).toBeNull();

  // arrasta as duas
  await arrastar(p, "ordem", -150, 120);
  const ordemDepois = await caixa(janela(p, "ordem"));
  expect(Math.round(ordemDepois.x - ordemAntes.x)).toBe(-150);
  expect(Math.round(ordemDepois.y - ordemAntes.y)).toBe(120);
  const fichaAntes = await caixa(ficha);
  await arrastar(p, ID_FICHA, 70, 50);
  const fichaDepois = await caixa(ficha);
  expect(Math.round(fichaDepois.x - fichaAntes.x)).toBe(70);
  expect(Math.round(fichaDepois.y - fichaAntes.y)).toBe(50);

  // guardado no navegador, por janela (em coordenadas da área)
  const g1 = await guardada(p, "ordem");
  expect(perto(g1.x, ordemDepois.x - a.x)).toBe(true);
  expect(perto(g1.y, ordemDepois.y - a.y)).toBe(true);
  const g2 = await guardada(p, ID_FICHA);
  expect(perto(g2.x, fichaDepois.x - a.x)).toBe(true);
  expect(perto(g2.y, fichaDepois.y - a.y)).toBe(true);

  // nada foi para a sala
  await p.waitForTimeout(500);
  expect(contagem(s)).toEqual(antes);

  // recarrega: a ordem volta ao lugar; a ficha (aberta de novo) também
  await recarregar(p);
  await expect(janela(p, "ordem")).toBeVisible();
  const ordemRecarregada = await caixa(janela(p, "ordem"));
  expect(perto(ordemRecarregada.x, ordemDepois.x)).toBe(true);
  expect(perto(ordemRecarregada.y, ordemDepois.y)).toBe(true);
  const f2 = await caixa(await abrirFicha(p, DARION_ID, "principal"));
  expect(perto(f2.x, fichaDepois.x)).toBe(true);
  expect(perto(f2.y, fichaDepois.y)).toBe(true);

  // outro navegador (outro usuário) continua com a posição dele: a padrão
  const outro = await entrarNoMapa(grande, "jogador-1");
  await expect(janela(outro.pagina, "ordem")).toBeVisible();
  const ao = await area(outro.pagina);
  const co = await caixa(janela(outro.pagina, "ordem"));
  expect(perto(co.x + co.width, ao.x + ao.width - 12)).toBe(true);
  expect(perto(co.y, ao.y + 12)).toBe(true);
  expect(await guardada(outro.pagina, "ordem")).toBeNull();
});

test("dois cliques no cabeçalho minimizam (só a barra do título) e restauram; o estado sobrevive ao recarregar e não vai para a sala", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const s = await entrarNoMapa(mesa, "mestre");
  const p = s.pagina;
  await ligarOrdem(p);
  await assentar(s);
  const antes = contagem(s);
  const j = janela(p, "ordem");
  const cheia = await caixa(j);
  await expect(j).toHaveAttribute("data-minimizada", "false");
  await expect(p.getByTestId("ordem-encerrar")).toBeVisible();

  // dois cliques no título
  const ponto = await pontoDoCabecalho(p, "ordem");
  await p.mouse.dblclick(ponto.x, ponto.y);
  await expect(j).toHaveAttribute("data-minimizada", "true");
  await expect(p.getByTestId("ordem-encerrar")).toBeHidden();
  await expect(p.getByTestId("ordem-rodada")).toBeHidden();
  const minimizada = await caixa(j);
  expect(minimizada.height).toBeLessThan(60);
  expect(minimizada.height).toBeLessThan(cheia.height);
  expect(perto(minimizada.width, cheia.width)).toBe(true);
  expect((await guardada(p, "ordem"))?.minimizada).toBe(true);
  await p.waitForTimeout(300);
  expect(contagem(s)).toEqual(antes);

  // sobrevive ao recarregar (a conexão nova manda as mensagens do começo: a contagem recomeça depois)
  await recarregar(p);
  await expect(janela(p, "ordem")).toHaveAttribute("data-minimizada", "true");
  await expect(p.getByTestId("ordem-encerrar")).toBeHidden();

  await assentar(s);
  const depoisDoRecarregar = contagem(s);

  // dois cliques de novo: volta ao tamanho de antes
  const ponto2 = await pontoDoCabecalho(p, "ordem");
  await p.mouse.dblclick(ponto2.x, ponto2.y);
  await expect(janela(p, "ordem")).toHaveAttribute("data-minimizada", "false");
  await expect(p.getByTestId("ordem-encerrar")).toBeVisible();
  const restaurada = await caixa(janela(p, "ordem"));
  expect(perto(restaurada.height, cheia.height)).toBe(true);
  expect(await guardada(p, "ordem")).toBeNull();

  // a ordem não tem botão de minimizar (só os dois cliques no cabeçalho); tem o de fechar
  await expect(p.getByTestId("janela-ordem-minimizar")).toHaveCount(0);
  await expect(p.getByTestId("janela-ordem-fechar")).toBeVisible();

  // nada disso foi para a sala
  await p.waitForTimeout(300);
  expect(contagem(s)).toEqual(depoisDoRecarregar);
});

test("redimensionar: a ficha pela quina e a ordem de turno pela borda de baixo; tamanho guardado, sem frame", async ({
  grande,
}) => {
  test.setTimeout(90_000);
  const s = await entrarNoMapa(grande, "mestre");
  const p = s.pagina;
  await criarDarion(p);
  await ligarOrdem(p);
  await abrirFicha(p, DARION_ID, "principal");
  await assentar(s);
  const antes = contagem(s);

  // a ficha, pela quina (diminui 80 x 60)
  const inteira = janela(p, ID_FICHA); // o testid antigo da ficha é o miolo, 2 px menor (a borda)
  const f0 = await caixa(inteira);
  const alca = await caixa(p.getByTestId("janela-ficha-redimensionar"));
  await p.mouse.move(alca.x + 8, alca.y + 8);
  await p.mouse.down();
  await p.mouse.move(alca.x - 72, alca.y - 52, { steps: 6 });
  await p.mouse.up();
  const f1 = await caixa(inteira);
  expect(Math.round(f0.width - f1.width)).toBe(80);
  expect(Math.round(f0.height - f1.height)).toBe(60);
  // a posição não mudou
  expect(perto(f1.x, f0.x)).toBe(true);
  expect(perto(f1.y, f0.y)).toBe(true);
  const g = await guardada(p, ID_FICHA);
  expect(perto(g.largura, f1.width)).toBe(true);
  expect(perto(g.altura, f1.height)).toBe(true);

  // a ordem de turno só ganha altura (a largura é fixa)
  const o0 = await caixa(janela(p, "ordem"));
  const borda = await caixa(p.getByTestId("janela-ordem-redimensionar"));
  await p.mouse.move(borda.x + borda.width / 2, borda.y + borda.height / 2);
  await p.mouse.down();
  await p.mouse.move(borda.x + borda.width / 2 + 60, borda.y + borda.height / 2 + 120, {
    steps: 6,
  });
  await p.mouse.up();
  const o1 = await caixa(janela(p, "ordem"));
  expect(Math.round(o1.height - o0.height)).toBe(120);
  expect(perto(o1.width, o0.width)).toBe(true);

  await p.waitForTimeout(500);
  expect(contagem(s)).toEqual(antes);

  // ao recarregar e abrir a ficha de novo, o tamanho é o escolhido
  await recarregar(p);
  await abrirFicha(p, DARION_ID, "principal");
  const f2 = await caixa(janela(p, ID_FICHA));
  expect(perto(f2.width, f1.width)).toBe(true);
  expect(perto(f2.height, f1.height)).toBe(true);
  const o2 = await caixa(janela(p, "ordem"));
  expect(perto(o2.height, o1.height)).toBe(true);
});

test("a janela é empurrada para dentro da área quando o painel direito alarga ou o navegador estreita", async ({
  grande,
}) => {
  test.setTimeout(90_000);
  const s = await entrarNoMapa(grande, "mestre");
  const p = s.pagina;
  await criarDarion(p);
  await ligarOrdem(p);
  const ficha = await abrirFicha(p, DARION_ID, "principal");

  // a ordem de turno vai para o canto de baixo à direita da área (a janela segura nas bordas)
  await arrastar(p, "ordem", 100, 600);
  let a = await area(p);
  const colada = await caixa(janela(p, "ordem"));
  expect(dentro(colada, a)).toBe(true);
  expect(perto(colada.x + colada.width, a.x + a.width)).toBe(true);

  // alarga o painel direito (1/4 de 1600 = 400, de 360): a área encolhe e a janela continua dentro
  await p.getByTestId("alca-do-painel").focus();
  await p.keyboard.press("End");
  await expect.poll(async () => (await area(p)).width).toBeLessThan(a.width);
  a = await area(p);
  await expect.poll(async () => dentro(await caixa(janela(p, "ordem")), a)).toBe(true);

  // estreita o navegador: as duas janelas seguem dentro da área, com o cabeçalho ao alcance
  await p.setViewportSize({ width: 1100, height: 700 });
  await expect.poll(async () => (await area(p)).width).toBeLessThan(a.width - 300);
  a = await area(p);
  await expect.poll(async () => dentro(await caixa(janela(p, "ordem")), a)).toBe(true);
  await expect.poll(async () => dentro(await caixa(ficha), a)).toBe(true);
  expect(dentro(await caixa(cabecalho(p, "ordem")), a)).toBe(true);
  expect(dentro(await caixa(cabecalho(p, ID_FICHA)), a)).toBe(true);

  // com o navegador grande de novo, a ordem continua colada na borda da área
  await p.setViewportSize({ width: 1600, height: 900 });
  await expect.poll(async () => (await area(p)).width).toBeGreaterThan(1100);
  a = await area(p);
  await expect
    .poll(async () => {
      const c = await caixa(janela(p, "ordem"));
      return Math.round(Math.abs(c.x + c.width - (a.x + a.width)));
    })
    .toBeLessThanOrEqual(1);
});

test("a última clicada fica por cima, entre a ordem de turno e a ficha", async ({ mesa }) => {
  test.setTimeout(90_000);
  const s = await entrarNoMapa(mesa, "mestre");
  const p = s.pagina;
  await criarDarion(p);
  await ligarOrdem(p);
  const ficha = await abrirFicha(p, DARION_ID, "principal");

  // a ficha abriu por último: está na frente
  expect(await zDe(p, ID_FICHA)).toBeGreaterThan(await zDe(p, "ordem"));

  // põe a ordem de turno em cima de parte da ficha (ela passa a ser a última mexida)
  const f = await caixa(ficha);
  const o = await caixa(janela(p, "ordem"));
  await arrastar(p, "ordem", f.x + f.width - 100 - o.x, f.y + 100 - o.y);
  const ordem = await caixa(janela(p, "ordem"));
  // o canto de cima à esquerda da ordem fica sobre a ficha; o resto, para fora dela
  const ponto = { x: ordem.x + 40, y: ordem.y + 60 };
  const foraDaFicha = { x: ordem.x + 200, y: ordem.y + 16 };
  const quemEstaEm = (pt: { x: number; y: number }) =>
    p.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest('[role="dialog"][data-testid^="janela-"]')
          ?.getAttribute("data-testid") ?? null,
      pt,
    );
  expect(await zDe(p, "ordem")).toBeGreaterThan(await zDe(p, ID_FICHA));
  expect(await quemEstaEm(ponto)).toBe("janela-ordem");

  // clicar no cabeçalho da ficha (fora da ordem) traz a ficha para a frente
  const cf = await pontoDoCabecalho(p, ID_FICHA);
  await p.mouse.click(cf.x, cf.y);
  expect(await zDe(p, ID_FICHA)).toBeGreaterThan(await zDe(p, "ordem"));
  expect(await quemEstaEm(ponto)).toBe(`janela-${ID_FICHA}`);

  // e clicar de novo na ordem devolve
  await p.mouse.click(foraDaFicha.x, foraDaFicha.y);
  expect(await zDe(p, "ordem")).toBeGreaterThan(await zDe(p, ID_FICHA));
  expect(await quemEstaEm(ponto)).toBe("janela-ordem");
});

test("arrasto que começa num botão do cabeçalho não move a janela", async ({ mesa }) => {
  test.setTimeout(60_000);
  const s = await entrarNoMapa(mesa, "mestre");
  const p = s.pagina;
  await criarDarion(p);
  await abrirFicha(p, DARION_ID, "principal");
  const antes = await caixa(janela(p, ID_FICHA));
  const botao = await caixa(p.getByTestId("descanso-curto"));
  await p.mouse.move(botao.x + botao.width / 2, botao.y + botao.height / 2);
  await p.mouse.down();
  await p.mouse.move(botao.x + 150, botao.y + 90, { steps: 6 });
  await p.mouse.up();
  expect(await caixa(janela(p, ID_FICHA))).toEqual(antes);
  expect(await guardada(p, ID_FICHA)).toBeNull();

  // nem pelo botão de minimizar
  const mini = await caixa(p.getByTestId(`janela-${ID_FICHA}-minimizar`));
  await p.mouse.move(mini.x + mini.width / 2, mini.y + mini.height / 2);
  await p.mouse.down();
  await p.mouse.move(mini.x - 120, mini.y + 80, { steps: 6 });
  await p.mouse.up();
  expect(await caixa(janela(p, ID_FICHA))).toEqual(antes);
  await expect(janela(p, ID_FICHA)).toHaveAttribute("data-minimizada", "false");
  expect(await guardada(p, ID_FICHA)).toBeNull();
});

test("o teclado move a janela com o cabeçalho focado (Shift anda mais), Esc não a fecha e ela tem nome", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const s = await entrarNoMapa(mesa, "mestre");
  const p = s.pagina;
  await ligarOrdem(p);
  const antes = await caixa(janela(p, "ordem"));
  const cab = cabecalho(p, "ordem");
  await expect(cab).toHaveAttribute("role", "toolbar");
  await cab.focus();
  await p.keyboard.press("ArrowLeft");
  await p.keyboard.press("ArrowDown");
  let c = await caixa(janela(p, "ordem"));
  expect(Math.round(c.x - antes.x)).toBe(-8);
  expect(Math.round(c.y - antes.y)).toBe(8);
  await p.keyboard.press("Shift+ArrowLeft");
  c = await caixa(janela(p, "ordem"));
  expect(Math.round(c.x - antes.x)).toBe(-48);
  expect(await guardada(p, "ordem")).not.toBeNull();

  // Esc não fecha (é da seleção); o diálogo não é modal e tem nome
  await p.keyboard.press("Escape");
  await expect(janela(p, "ordem")).toBeVisible();
  await expect(janela(p, "ordem")).toHaveAttribute("role", "dialog");
  await expect(janela(p, "ordem")).toHaveAttribute("aria-label", "Ordem de turno");
  await expect(janela(p, "ordem")).not.toHaveAttribute("aria-modal", "true");
});

test("em 1280×720 a ficha abre inteira dentro da área, a segunda desloca em cascata e o painel do token fica embaixo à direita", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const s = await entrarNoMapa(mesa, "mestre");
  const p = s.pagina;
  expect(p.viewportSize()).toEqual({ width: 1280, height: 720 });
  await criarDarion(p);
  await ligarOrdem(p);
  const a = await area(p);

  const f1 = await abrirFicha(p, DARION_ID, "principal");
  const c1 = await caixa(f1);
  expect(dentro(c1, a)).toBe(true);
  // ocupa no máximo ~60% da largura da área (o mínimo da ficha é 520)
  expect(c1.width).toBeLessThanOrEqual(Math.max(520, a.width * 0.6) + 1);
  // e não cobre a ordem de turno, no alto à direita
  const ordem = await caixa(janela(p, "ordem"));
  expect(c1.x + c1.width).toBeLessThanOrEqual(ordem.x + 1);

  // a segunda ficha (sem posição guardada) abre deslocada em cascata
  const f2 = await abrirFicha(p, "pers-aldric", "principal");
  const c2 = await caixa(f2);
  expect(dentro(c2, a)).toBe(true);
  expect(c2.x - c1.x).toBeGreaterThanOrEqual(24);
  expect(c2.y - c1.y).toBeGreaterThanOrEqual(24);

  // painel do token embaixo à direita (R6b: numa área apertada ele vai para a coluna da ordem de turno, acima do zoom)
  await f2.getByTestId("janela-ficha-fechar").click();
  await f1.getByTestId("janela-ficha-fechar").click();
  await selecionarToken(p, "tok-jogador-1");
  await expect(p.getByTestId("painel-token")).toBeVisible();
  const t = await caixa(janela(p, "token"));
  expect(dentro(t, a)).toBe(true);
  expect(a.x + a.width - (t.x + t.width)).toBeLessThanOrEqual(13);
  expect(a.y + a.height - (t.y + t.height)).toBeLessThanOrEqual(65);
  expect(a.y + a.height - (t.y + t.height)).toBeGreaterThanOrEqual(60);
});

test("paredes, fontes de luz, iluminação e dados rápidos abrem dentro da área, em lugares diferentes, e fecham pelo X", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const s = await entrarNoMapa(mesa, "mestre");
  const p = s.pagina;
  const a = await area(p);

  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-fontes").click();
  await expect(janela(p, "fontes")).toBeVisible();
  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-config").click();
  await expect(janela(p, "iluminacao")).toBeVisible();
  await p.getByTestId("ferramenta-paredes").click();
  await expect(janela(p, "paredes")).toBeVisible();
  await p.getByTestId("ferramenta-dados").click();
  await expect(janela(p, "dados")).toBeVisible();

  const aberta: Record<string, Caixa> = {};
  for (const id of ["fontes", "iluminacao", "paredes", "dados"]) {
    aberta[id] = await caixa(janela(p, id));
    expect(dentro(aberta[id] as Caixa, a), id).toBe(true);
  }
  const fontes = aberta.fontes as Caixa;
  const paredes = aberta.paredes as Caixa;
  const dados = aberta.dados as Caixa;
  // os dados abrem ao lado do botão que os abre, colados na barra de ferramentas
  const botao = await caixa(p.getByTestId("ferramenta-dados"));
  expect(Math.abs(dados.y - botao.y)).toBeLessThanOrEqual(12);
  expect(dados.x).toBeLessThanOrEqual(a.x + 12);
  // fontes de luz e paredes não abrem uma sobre a outra
  expect(fontes.x + fontes.width <= paredes.x || paredes.x + paredes.width <= fontes.x).toBe(true);

  // os dados rolam e fecham sozinhos, como antes; e fecham pelo X
  await p.getByTestId("dado-D20").click();
  await expect(janela(p, "dados")).toHaveCount(0);
  await p.getByTestId("ferramenta-dados").click();
  await p.getByTestId("janela-dados-fechar").click();
  await expect(janela(p, "dados")).toHaveCount(0);
  await p.getByTestId("config-fechar").click();
  await expect(janela(p, "iluminacao")).toHaveCount(0);
  await p.getByTestId("painel-fontes-fechar").click();
  await expect(janela(p, "fontes")).toHaveCount(0);
});
