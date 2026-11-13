import type { Page } from "@playwright/test";
import {
  abrirFaixa,
  enviarCru,
  expect,
  intencaoCrua,
  menuDaCena,
  test,
  tornarMembros,
} from "./ajudas";
import { arquivoPng, escolherNoSeletor, imagensDoMapa, pngDeRuido } from "./ajudasAssets";
import {
  centrarNoToken,
  entrarNoMapa,
  esperarPosicao,
  type GanchoDoMapa,
  pontoNaPagina,
  soSelecionarToken,
  tokenDe,
  tokensDe,
} from "./ajudasMapa";

// V10: seletor de imagem por cima de outro diálogo, menu do navegador no mapa, Delete e setas no token
// selecionado e a bandeira do ponto de chegada só com a faixa de Cenas aberta.

const bandeiraDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.bandeira());

const existe = async (p: Page, id: string) => (await tokensDe(p)).some((t) => t.id === id);

const focoDentroDe = (p: Page, testid: string) =>
  p.evaluate((id) => document.activeElement?.closest(`[data-testid='${id}']`) !== null, testid);

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

test("o seletor de imagem abre por cima do Configurar cena; Esc fecha só ele", async ({ mesa }) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await menuDaCena(p, "cena-covil", "configurar");
  await expect(p.getByTestId("configurar-cena")).toBeVisible();
  await p.getByTestId("cfg-mapa").click();
  const seletor = p.getByTestId("seletor-imagem");
  await expect(seletor).toBeVisible();

  // o centro do seletor cai dentro dele (nada o cobre) e o foco foi para dentro dele
  const cobertura = await seletor.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return topo !== null && el.contains(topo);
  });
  expect(cobertura).toBe(true);
  expect(await focoDentroDe(p, "seletor-imagem")).toBe(true);

  // Tab não sai do seletor
  for (let i = 0; i < 8; i++) await p.keyboard.press("Tab");
  expect(await focoDentroDe(p, "seletor-imagem")).toBe(true);

  // Esc fecha só o seletor: o Configurar cena continua e o foco volta ao botão que o abriu
  await p.keyboard.press("Escape");
  await expect(seletor).toHaveCount(0);
  await expect(p.getByTestId("configurar-cena")).toBeVisible();
  await expect(p.getByTestId("cfg-mapa")).toBeFocused();

  // escolher a imagem põe o mapa na cena
  await p.getByTestId("cfg-mapa").click();
  await escolherNoSeletor(p, arquivoPng("mapa-v10.png", pngDeRuido(256, 171, 3)));
  await expect(p.getByTestId("cfg-mapa-estado")).toContainText("Imagem nova");
  await p.getByTestId("cfg-salvar").click();
  await expect(p.getByTestId("configurar-cena")).toHaveCount(0);
  await menuDaCena(p, "cena-covil", "ir");
  await expect.poll(async () => (await imagensDoMapa(p)).tiles.length).toBeGreaterThan(0);

  // Esc agora fecha o Configurar cena (nada mais por cima)
  await menuDaCena(p, "cena-covil", "configurar");
  await expect(p.getByTestId("configurar-cena")).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("configurar-cena")).toHaveCount(0);
});

test("o clique direito na área do mapa nunca abre o menu do navegador, mas os campos sim", async ({
  mesa,
}) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  // depois dos ouvintes do app: guarda se alguém já impediu o menu
  await p.evaluate(() => {
    const w = window as unknown as { __impedidos: boolean[] };
    w.__impedidos = [];
    window.addEventListener("contextmenu", (e) => w.__impedidos.push(e.defaultPrevented));
  });
  const ultimo = () =>
    p.evaluate(() => {
      const w = window as unknown as { __impedidos: boolean[] };
      return w.__impedidos[w.__impedidos.length - 1];
    });

  // no token (abre o menu dele)
  const t = await centrarNoToken(p, "tok-jogador-1");
  await p.mouse.click(t.x, t.y, { button: "right" });
  await expect(p.getByTestId("menu-token")).toBeVisible();
  expect(await ultimo()).toBe(true);

  // no menu do token aberto (condições): não faz nada, o menu continua
  await p
    .getByTestId("menu-token-painel-condicoes")
    .click({ button: "right", position: { x: 4, y: 4 } });
  expect(await ultimo()).toBe(true);
  await expect(p.getByTestId("menu-token")).toBeVisible();

  // no campo de texto do menu (concentração) o menu nativo continua
  await p.getByTestId("concentracao-input").click({ button: "right" });
  expect(await ultimo()).toBe(false);

  // com o menu aberto, o clique direito sobre outro token fecha o atual e abre o do outro
  // (sem recentrar: o token 3 fica fora do menu, que abriu junto do token 1)
  const outro = await tokenDe(p, "tok-jogador-3");
  const nome2 = outro.nome;
  const t2 = await pontoNaPagina(p, outro.x, outro.y);
  await p.mouse.click(t2.x, t2.y, { button: "right" });
  await expect(p.getByTestId("menu-token")).toHaveCount(1);
  await expect(p.getByTestId("menu-token")).toHaveAttribute("aria-label", `Token: ${nome2}`);
  expect(await ultimo()).toBe(true);
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("menu-token")).toHaveCount(0);

  // no fundo do mapa
  const caixa = await p.getByTestId("mapa").boundingBox();
  if (!caixa) throw new Error("sem mapa");
  await p.mouse.click(caixa.x + 30, caixa.y + 30, { button: "right" });
  expect(await ultimo()).toBe(true);

  // fora da área (o chat), o campo de texto também mantém o menu nativo
  await p.getByTestId("chat-texto").click({ button: "right" });
  expect(await ultimo()).toBe(false);
});

test("Delete tira o token do mapa e o Desfazer o traz de volta; o jogador só apaga o dele", async ({
  mesa,
  request,
}) => {
  await tornarMembros(request, "jogador-1", "jogador-2");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");

  // o mestre apaga qualquer token
  await soSelecionarToken(m.pagina, "tok-jogador-3");
  await m.pagina.keyboard.press("Delete");
  await expect.poll(() => existe(m.pagina, "tok-jogador-3")).toBe(false);
  await expect(m.pagina.getByTestId("aviso")).toContainText("Token removido do mapa.");
  await m.pagina.getByTestId("aviso-acao").click();
  await expect.poll(() => existe(m.pagina, "tok-jogador-3")).toBe(true);
  expect((await tokenDe(m.pagina, "tok-jogador-3")).x).toBe(20.25);

  // o jogador apaga o que controla (Backspace também vale), o mestre vê sumir, e o Desfazer traz de volta
  await soSelecionarToken(j1.pagina, "tok-jogador-1");
  await j1.pagina.keyboard.press("Backspace");
  await expect.poll(() => existe(j1.pagina, "tok-jogador-1")).toBe(false);
  await expect.poll(() => existe(m.pagina, "tok-jogador-1")).toBe(false);
  await j1.pagina.getByTestId("aviso-acao").click();
  await expect.poll(() => existe(j1.pagina, "tok-jogador-1")).toBe(true);
  await expect.poll(() => existe(m.pagina, "tok-jogador-1")).toBe(true);

  // o jogador nunca apaga o token de outro, nem mandando a intenção à mão; o Desfazer é só de quem apagou
  const alheio = await enviarCru(j1.pagina, intencaoCrua("token.apagar", { id: "tok-jogador-2" }));
  expect(alheio?.dados.codigo).toBe("sem_permissao");
  await ok(m.pagina, "token.apagar", { id: "tok-jogador-2" });
  const desfazerAlheio = await enviarCru(
    j1.pagina,
    intencaoCrua("token.restaurar", { id: "tok-jogador-2" }),
  );
  expect(desfazerAlheio?.dados.codigo).toBe("sem_permissao");
  await ok(m.pagina, "token.restaurar", { id: "tok-jogador-2" });
});

test("as setas movem o token selecionado um quadrado; a sala barra parede e permissão", async ({
  mesa,
  request,
}) => {
  await tornarMembros(request, "jogador-1", "jogador-2");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  const q = 1.5;

  // o mestre: quatro setas, quatro casas
  await soSelecionarToken(m.pagina, "tok-jogador-3");
  const p0 = await tokenDe(m.pagina, "tok-jogador-3");
  const passos: [string, number, number][] = [
    ["ArrowRight", p0.x + q, p0.y],
    ["ArrowDown", p0.x + q, p0.y + q],
    ["ArrowLeft", p0.x, p0.y + q],
    ["ArrowUp", p0.x, p0.y],
  ];
  for (const [tecla, x, y] of passos) {
    await m.pagina.keyboard.press(tecla);
    await esperarPosicao(m.pagina, "tok-jogador-3", x, y);
  }

  // o jogador anda o que controla e a sala barra a parede (o token fica parado)
  const base = await tokenDe(j1.pagina, "tok-jogador-1");
  await soSelecionarToken(j1.pagina, "tok-jogador-1");
  await j1.pagina.keyboard.press("ArrowLeft");
  await esperarPosicao(j1.pagina, "tok-jogador-1", base.x - q, base.y);
  await j1.pagina.keyboard.press("ArrowRight");
  await esperarPosicao(j1.pagina, "tok-jogador-1", base.x, base.y);
  await ok(m.pagina, "parede.criar", {
    cenaId: "cena-1",
    paredes: [
      {
        id: "par-v10",
        a: { x: base.x + 0.75, y: base.y - 3 },
        b: { x: base.x + 0.75, y: base.y + 3 },
        tipo: "parede",
      },
    ],
  });
  await j1.pagina.keyboard.press("ArrowRight");
  await expect(j1.pagina.getByTestId("aviso")).toContainText("parede");
  await expect
    .poll(() => tokenDe(m.pagina, "tok-jogador-1").then((t) => [t.x, t.y]))
    .toEqual([base.x, base.y]);

  // quem não controla o token não o move: o jogador 2 não o seleciona e as setas não fazem nada
  await j2.pagina.keyboard.press("ArrowDown");
  await j2.pagina.waitForTimeout(300);
  await esperarPosicao(m.pagina, "tok-jogador-1", base.x, base.y);

  // com o foco num campo de texto as setas não movem nada
  await m.pagina.getByTestId("chat-texto").focus();
  await m.pagina.keyboard.press("ArrowRight");
  await m.pagina.waitForTimeout(300);
  await esperarPosicao(m.pagina, "tok-jogador-3", p0.x, p0.y);
});

test("a bandeira do ponto de chegada só aparece com a faixa de Cenas aberta, e só para o mestre", async ({
  mesa,
  request,
}) => {
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await expect(m.pagina.getByTestId("faixa-cenas")).toHaveCount(0);
  expect(await bandeiraDe(m.pagina)).toBeNull();

  await abrirFaixa(m.pagina);
  await expect.poll(() => bandeiraDe(m.pagina)).not.toBeNull();
  expect(await bandeiraDe(j1.pagina)).toBeNull();

  // a dica ao passar o mouse
  const b = await bandeiraDe(m.pagina);
  if (!b) throw new Error("sem bandeira");
  await m.pagina.evaluate(
    ([x, y]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.centrarEm(x as number, y as number);
    },
    [b.x, b.y],
  );
  const tela = await m.pagina.evaluate(
    ([x, y]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paraTela(
        x as number,
        y as number,
      ),
    [b.x, b.y],
  );
  await m.pagina.mouse.move(tela.x + 4, tela.y - 14);
  await m.pagina.mouse.move(tela.x + 5, tela.y - 13);
  await expect(m.pagina.getByTestId("dica-bandeira")).toContainText("Ponto de chegada");

  // fechando a faixa, a bandeira some
  await m.pagina.getByTestId("menu-cenas").click();
  await expect(m.pagina.getByTestId("faixa-cenas")).toHaveCount(0);
  await expect.poll(() => bandeiraDe(m.pagina)).toBeNull();
});

test("o anel de foco do mapa só aparece quando o foco chegou pelo teclado", async ({ mesa }) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  const anel = () =>
    p.getByTestId("mapa").evaluate((el) => {
      const c = getComputedStyle(el);
      return `${c.outlineStyle}|${c.outlineWidth}|${el.hasAttribute("data-foco-teclado")}`;
    });

  // clique e depois Delete, Espaço e seta: o contorno não muda (nenhum)
  await soSelecionarToken(p, "tok-jogador-3");
  await expect(p.getByTestId("mapa")).toBeFocused();
  const antes = await anel();
  expect(antes.startsWith("none")).toBe(true);
  for (const tecla of ["Space", "ArrowRight", "ArrowLeft"]) {
    await p.keyboard.press(tecla);
    expect(await anel()).toBe(antes);
  }
  await p.keyboard.press("Delete");
  expect(await anel()).toBe(antes);

  // chegando por Tab, o indicador aparece
  await p.getByTestId("mapa").evaluate((el) => (el as HTMLElement).blur());
  for (
    let i = 0;
    i < 80 && !(await p.getByTestId("mapa").evaluate((el) => el === document.activeElement));
    i++
  ) {
    await p.keyboard.press("Tab");
  }
  await expect(p.getByTestId("mapa")).toBeFocused();
  const comTab = await anel();
  expect(comTab.startsWith("solid|2px")).toBe(true);
  expect(comTab.endsWith("true")).toBe(true);
});
