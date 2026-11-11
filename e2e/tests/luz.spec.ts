import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, esperarMapa, expect, intencaoCrua, test } from "./ajudas";
import {
  entrarNoMapa,
  esperarPosicao,
  type GanchoDoMapa,
  pontoNaPagina,
  tokenDe,
} from "./ajudasMapa";

// Lote 6: luz, visão no escuro e memória do mapa. A semente tem a Cena inicial com luz ambiente 0,1, a
// tocha da sala (11,25; 30; 6 m + 6 m) e o braseiro (27; 9,75; 4,5 m + 4,5 m). Aldric (jogador-1) tem
// visão no escuro de 18 m e alcance de visão de 24 m; Brisa (jogador-2) e Cael não têm visão no escuro.

const visaoEm = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.visaoNoPonto(
        px as number,
        py as number,
      ),
    [x, y],
  );
const veEm = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.veNoPonto(
        px as number,
        py as number,
      ),
    [x, y],
  );
const lembraEm = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.lembraNoPonto(
        px as number,
        py as number,
      ),
    [x, y],
  );
const opacidadeEm = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.opacidadeDaMemoria(
        px as number,
        py as number,
      ),
    [x, y],
  );
const luzes = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes());
const memoria = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.memoria());
const visaoGeral = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.visao());
const marcasDeLuz = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.marcasDeLuz());
const veuVisivel = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.veuVisivel());

/** O mestre coloca um token onde quiser (o mestre ignora paredes). */
async function levar(mestre: Page, id: string, x: number, y: number) {
  const r = await enviarCru(mestre, intencaoCrua("token.soltar", { id, x, y }));
  expect(r?.tipo).toBe("evento");
}

async function intencao(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, JSON.stringify(r)).toBe("evento");
}

const desenhado = async (p: Page, id: string) => (await tokenDe(p, id)).desenhado;

test("sem visão no escuro, em luz ambiente 0 e sem luz perto, o jogador não vê o mapa nem tokens", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await intencao(mestre.pagina, "cena.configurarIluminacao", { luzAmbiente: 0 });
  // Brisa (sem visão no escuro) num canto sem luz, com o Aldric ao lado, dentro da visão dela
  await levar(mestre.pagina, "tok-jogador-2", 45, 30);
  await levar(mestre.pagina, "tok-jogador-1", 47.25, 30);
  const brisa = await entrarNoMapa(mesa, "jogador-2");
  await esperarPosicao(brisa.pagina, "tok-jogador-2", 45, 30);
  await esperarPosicao(brisa.pagina, "tok-jogador-1", 47.25, 30);

  for (const [x, y] of [
    [45, 30],
    [46, 30],
    [45, 28],
    [43, 31],
    [47.25, 30],
  ] as const) {
    await expect.poll(() => veEm(brisa.pagina, x, y), `ponto ${x},${y}`).toBe(false);
  }
  expect(await visaoEm(brisa.pagina, 46, 30)).toBe("nenhuma");
  // o token do Aldric chegou ao navegador (a sala não filtra por visão), mas não é desenhado
  expect((await tokenDe(brisa.pagina, "tok-jogador-1")).desenhado).toBe(false);
  expect(await desenhado(brisa.pagina, "tok-jogador-2")).toBe(true); // o próprio token sempre aparece
  expect(await veuVisivel(brisa.pagina)).toBe(true);

  // o mestre vê tudo
  expect(await desenhado(mestre.pagina, "tok-jogador-1")).toBe(true);
});

test("perto de uma luz fixa o jogador vê (plena e penumbra); com visão no escuro vê em cinza", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await intencao(mestre.pagina, "cena.configurarIluminacao", { luzAmbiente: 0 });
  // Brisa a 2 m do braseiro (27; 9,75); Cael na penumbra dele (7 m); Aldric longe, no escuro (45; 9,75)
  await levar(mestre.pagina, "tok-jogador-2", 25, 9.75);
  await levar(mestre.pagina, "tok-jogador-3", 34, 9.75);
  await levar(mestre.pagina, "tok-jogador-1", 45, 9.75);
  const brisa = await entrarNoMapa(mesa, "jogador-2");
  await esperarPosicao(brisa.pagina, "tok-jogador-3", 34, 9.75);

  expect(await visaoEm(brisa.pagina, 25, 9.75)).toBe("plena"); // 2 m do braseiro
  expect(await visaoEm(brisa.pagina, 30, 9.75)).toBe("plena"); // 3 m (luz plena até 4,5)
  expect(await visaoEm(brisa.pagina, 33, 9.75)).toBe("penumbra"); // 6 m (penumbra até 9)
  expect(await visaoEm(brisa.pagina, 12, 9.75)).toBe("nenhuma"); // à vista, mas sem luz: escuro
  // Cael está na penumbra, à vista de Brisa: aparece; Aldric está longe e no escuro: não aparece
  await expect.poll(() => desenhado(brisa.pagina, "tok-jogador-3")).toBe(true);
  expect(await desenhado(brisa.pagina, "tok-jogador-1")).toBe(false);

  // Aldric tem visão no escuro de 18 m: o escuro ao redor dele aparece em cinza (e só até 18 m)
  const aldric = await entrarNoMapa(mesa, "jogador-1");
  await esperarPosicao(aldric.pagina, "tok-jogador-1", 45, 9.75);
  await expect.poll(() => visaoEm(aldric.pagina, 45, 26)).toBe("cinza"); // 16,25 m
  expect(await visaoEm(aldric.pagina, 55, 9.75)).toBe("cinza");
  expect(await visaoEm(aldric.pagina, 45, 29)).toBe("nenhuma"); // 19,25 m, fora da luz
  // a luz do braseiro continua valendo (visão de 24 m): luz plena e, na penumbra dele, penumbra
  expect(await visaoEm(aldric.pagina, 23, 9.75)).toBe("plena");
  expect(await visaoEm(aldric.pagina, 19.5, 9.75)).toBe("nenhuma"); // 25,5 m: além da visão
  // na penumbra, a visão no escuro vale como luz plena (a 11 m dele, a 7 m do braseiro)
  expect(await visaoEm(aldric.pagina, 34, 9.75)).toBe("plena");
  // no escuro, dentro da visão no escuro dele, o token aparece (e some quando passa de 18 m)
  await levar(mestre.pagina, "tok-jogador-3", 45, 20);
  await expect.poll(() => desenhado(aldric.pagina, "tok-jogador-3")).toBe(true);
  await levar(mestre.pagina, "tok-jogador-3", 45, 30);
  await expect.poll(() => desenhado(aldric.pagina, "tok-jogador-3")).toBe(false);
});

test("a parede bloqueia a luz: a sala acesa não ilumina o que está fora dela", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  // Brisa ao norte da sala (a tocha está dentro, em 11,25; 30), com a porta fechada
  await levar(mestre.pagina, "tok-jogador-2", 11.25, 21);
  const brisa = await entrarNoMapa(mesa, "jogador-2");
  await esperarPosicao(brisa.pagina, "tok-jogador-2", 11.25, 21);
  // 9 m da tocha, mas com a parede no meio: nenhuma luz chega
  expect(await visaoEm(brisa.pagina, 11.25, 23)).toBe("nenhuma");
  const nivelFora = await brisa.pagina.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.nivelNoPonto(11.25, 23),
  );
  expect(nivelFora).toBeCloseTo(0.1); // só a luz ambiente
  // abre a porta: a luz sai pela porta
  await intencao(mestre.pagina, "porta.alternar", { id: "par-sala-porta" });
  await expect
    .poll(() =>
      brisa.pagina.evaluate(() =>
        (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.nivelNoPonto(11.25, 23),
      ),
    )
    .toBeGreaterThan(0.4);
});

test("memória do mapa: a sala fica como lembrança, desbota, é esquecida além do alcance e sobrevive ao refresh", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const aldric = await entrarNoMapa(mesa, "jogador-1");
  const j = aldric.pagina;
  await expect.poll(async () => (await memoria(j)).carregada).toBe(true);
  expect((await memoria(j)).alcancesM).toEqual([15]); // 15 m + 3 m × 0

  // Dentro da sala (acesa pela tocha) ele vê e passa a lembrar; Brisa entra também
  await levar(mestre.pagina, "tok-jogador-1", 11.25, 30);
  await levar(mestre.pagina, "tok-jogador-2", 7.5, 27);
  await esperarPosicao(j, "tok-jogador-1", 11.25, 30);
  await expect.poll(() => visaoEm(j, 7.5, 27)).not.toBe("nenhuma");
  await expect.poll(() => lembraEm(j, 7.5, 27)).toBe(true);
  await expect.poll(() => lembraEm(j, 15, 33)).toBe(true);
  await expect.poll(() => desenhado(j, "tok-jogador-2")).toBe(true);

  // Sai da sala (a porta fechada): vê o corredor, mas a sala é só lembrança
  await levar(mestre.pagina, "tok-jogador-1", 11.25, 21);
  await esperarPosicao(j, "tok-jogador-1", 11.25, 21);
  await expect.poll(() => visaoEm(j, 7.5, 27)).toBe("nenhuma");
  expect(await lembraEm(j, 7.5, 27)).toBe(true);
  // a lembrança é só do mapa: o token que ficou na sala não é desenhado
  await expect.poll(() => desenhado(j, "tok-jogador-2")).toBe(false);
  const perto = await opacidadeEm(j, 11.25, 27); // 6 m do token: 1 − 6/15
  expect(perto).toBeGreaterThan(0.5);
  expect(perto).toBeLessThan(0.7);

  // Mais longe, desbota
  await levar(mestre.pagina, "tok-jogador-1", 11.25, 17);
  await esperarPosicao(j, "tok-jogador-1", 11.25, 17);
  await expect.poll(() => opacidadeEm(j, 11.25, 27)).toBeLessThan(perto - 0.2);
  const longe = await opacidadeEm(j, 11.25, 27);
  expect(longe).toBeGreaterThan(0);
  expect(await lembraEm(j, 11.25, 27)).toBe(true);

  // Além do alcance (15 m), é esquecida
  await levar(mestre.pagina, "tok-jogador-1", 11.25, 4);
  await esperarPosicao(j, "tok-jogador-1", 11.25, 4);
  await expect.poll(() => lembraEm(j, 11.25, 27)).toBe(false);
  expect(await lembraEm(j, 7.5, 27)).toBe(false);
  expect(await opacidadeEm(j, 11.25, 27)).toBe(0);

  // Voltando lá, a sala só reaparece se for iluminada de novo (a porta está fechada)
  await levar(mestre.pagina, "tok-jogador-1", 11.25, 21);
  await esperarPosicao(j, "tok-jogador-1", 11.25, 21);
  expect(await lembraEm(j, 7.5, 27)).toBe(false);
  expect(await visaoEm(j, 7.5, 27)).toBe("nenhuma");

  // Entra de novo, lembra, sai e recarrega a página: a memória sobrevive ao refresh
  await levar(mestre.pagina, "tok-jogador-1", 11.25, 30);
  await expect.poll(() => lembraEm(j, 7.5, 27)).toBe(true);
  await levar(mestre.pagina, "tok-jogador-1", 11.25, 21);
  await esperarPosicao(j, "tok-jogador-1", 11.25, 21);
  await expect.poll(async () => (await memoria(j)).pendente).toBe(false);
  await j.reload();
  await expect(j.getByTestId("status-conexao")).toHaveText("conectado");
  await esperarMapa(j);
  await expect.poll(async () => (await memoria(j)).carregada).toBe(true);
  await expect.poll(() => lembraEm(j, 7.5, 27)).toBe(true);
  expect(await visaoEm(j, 7.5, 27)).toBe("nenhuma"); // é lembrança, não visão

  // O mestre manda esquecer: todos os navegadores obedecem (e a memória não volta no refresh seguinte)
  await mestre.pagina.getByTestId("menu-iluminacao").click();
  await mestre.pagina.getByTestId("lanterna-config").click();
  await mestre.pagina.getByTestId("config-esquecer").click();
  await expect(mestre.pagina.getByTestId("config-esquecida")).toBeVisible();
  await expect.poll(() => lembraEm(j, 7.5, 27)).toBe(false);
  expect((await memoria(j)).esquecimento).toBeGreaterThan(0);
  await expect.poll(async () => (await memoria(j)).pendente).toBe(false);
  await j.reload();
  await expect(j.getByTestId("status-conexao")).toHaveText("conectado");
  await esperarMapa(j);
  await expect.poll(async () => (await memoria(j)).carregada).toBe(true);
  expect(await lembraEm(j, 7.5, 27)).toBe(false);
});

test("a memória segue a configuração: modificador de Inteligência, valor fixo e desligada", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const brisa = await entrarNoMapa(mesa, "jogador-2");
  const j = brisa.pagina;
  // Brisa tem Inteligência +2 na semente: 15 m + 3 m × 2
  await expect.poll(async () => (await memoria(j)).alcancesM).toEqual([21]);

  // O mestre muda o modificador pelo editor do item
  await abrirAba(mestre.pagina, "fichas");
  await mestre.pagina.getByTestId("ficha-abrir-pers-brisa").dblclick();
  await mestre.pagina.getByTestId("ficha-aba-configurar").click();
  await mestre.pagina.getByText("Token padrão e visão").click();
  const campo = mestre.pagina.getByTestId("personagem-int-pers-brisa");
  await campo.fill("-2");
  await campo.blur();
  await expect.poll(async () => (await memoria(j)).alcancesM).toEqual([9]);
  await campo.fill("-5");
  await campo.blur();
  await expect.poll(async () => (await memoria(j)).alcancesM).toEqual([0]); // nunca abaixo de 0
  await mestre.pagina.getByTestId("janela-ficha-fechar").click();

  // Valor fixo e memória desligada, pelas configurações de iluminação
  await mestre.pagina.getByTestId("menu-iluminacao").click();
  await mestre.pagina.getByTestId("lanterna-config").click();
  await mestre.pagina.getByTestId("config-memoria-modo").selectOption("fixo");
  await expect.poll(async () => (await memoria(j)).alcancesM).toEqual([15]);
  const fixa = mestre.pagina.getByTestId("config-memoria-fixa");
  await fixa.fill("30");
  await fixa.blur();
  await expect.poll(async () => (await memoria(j)).alcancesM).toEqual([30]);
  await mestre.pagina.getByTestId("config-memoria-ligada").click();
  await expect.poll(async () => (await memoria(j)).alcancesM).toEqual([0]);
});

test("o painel de fontes de luz cria uma luz e muda a intensidade e o fator geral (o raio efetivo muda)", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const raio = async (id: string) => (await luzes(p)).find((l) => l.id === id);

  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-fontes").click();
  await expect(p.getByTestId("painel-fontes")).toBeVisible();
  await expect(p.getByTestId("luz-lista").locator("li")).toHaveCount(2);
  expect((await raio("luz-braseiro"))?.totalM).toBeCloseTo(9);
  expect((await raio("luz-braseiro"))?.claraM).toBeCloseTo(4.5);

  // "+ Luz fixa" e um clique no mapa
  await p.getByTestId("luz-nova").click();
  await expect(p.getByTestId("luz-nova")).toHaveAttribute("aria-pressed", "true");
  await p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(40, 30),
  );
  const alvo = await pontoNaPagina(p, 40, 30);
  await p.mouse.click(alvo.x, alvo.y);
  await expect(p.getByTestId("luz-lista").locator("li")).toHaveCount(3);
  await expect(p.getByTestId("luz-editor")).toBeVisible(); // a nova já vem selecionada
  await expect(p.getByTestId("luz-nova")).toHaveAttribute("aria-pressed", "false");
  const nova = (await luzes(p)).find((l) => !["luz-braseiro", "luz-tocha-sala"].includes(l.id));
  expect(nova).toBeDefined();
  const idNova = nova?.id ?? "";
  expect(nova).toMatchObject({ claraM: 6, totalM: 12 });
  expect(nova?.x).toBeCloseTo(40, 0);

  // intensidade de uma fonte: 50% = metade do alcance (os dois raios)
  const intensidade = p.getByTestId(`luz-intensidade-${idNova}`);
  await intensidade.fill("50");
  await expect.poll(async () => (await raio(idNova))?.totalM).toBeCloseTo(6);
  expect((await raio(idNova))?.claraM).toBeCloseTo(3);
  expect((await raio("luz-braseiro"))?.totalM).toBeCloseTo(9); // as outras não mudam

  // slider geral: um fator sobre todas as intensidades de uma vez
  await p.getByTestId("luz-fator-geral").fill("50");
  await expect.poll(async () => (await raio(idNova))?.totalM).toBeCloseTo(3);
  expect((await raio("luz-braseiro"))?.totalM).toBeCloseTo(4.5);
  expect((await raio("luz-braseiro"))?.claraM).toBeCloseTo(2.25);
  await p.getByTestId("luz-fator-geral").fill("100");
  await expect.poll(async () => (await raio("luz-braseiro"))?.totalM).toBeCloseTo(9);

  // editar raios, cor e tremular
  await p.getByTestId("luz-clara").fill("8");
  await p.getByTestId("luz-clara").blur();
  await expect.poll(async () => (await raio(idNova))?.claraM).toBeCloseTo(4); // 8 × 50%
  await p.getByTestId("luz-tremula").click();
  await expect(p.getByTestId("luz-tremula")).not.toBeChecked();
  await p.getByTestId("luz-cor").fill("#33aaff");
  await expect
    .poll(() => mestre.enviados.filter((f) => f.includes('"fonte.editar"')).join(""))
    .toContain("#33aaff");

  // a lixeira apaga
  await p.getByTestId(`luz-apagar-${idNova}`).click();
  await expect(p.getByTestId("luz-lista").locator("li")).toHaveCount(2);
  await expect.poll(async () => await raio(idNova)).toBeUndefined();
  // apagar a luz do braseiro: o jogador deixa de ter luz ali (a lista não a traz mais)
  await p.getByTestId("luz-acesa-luz-braseiro").click();
  await expect.poll(async () => await raio("luz-braseiro")).toBeUndefined();
});

test("o mestre arrasta a luz no mapa e clica nela para editar; clicar duas vezes no cabeçalho minimiza o painel", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-fontes").click();
  await expect(p.getByTestId("painel-fontes")).toBeVisible();

  // as marcas das luzes aparecem no mapa com o painel aberto
  await p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(27, 15),
  );
  const marcas = await marcasDeLuz(p);
  expect(marcas.map((m) => m.id).sort()).toEqual(["luz-braseiro", "luz-tocha-sala"]);

  // clique na marca: seleciona e abre o editor
  const braseiro = marcas.find((m) => m.id === "luz-braseiro") as { x: number; y: number };
  const ini = await pontoNaPagina(p, braseiro.x, braseiro.y);
  await p.mouse.click(ini.x, ini.y);
  await expect(p.getByTestId("luz-editor")).toBeVisible();
  await expect(p.getByTestId("luz-luz-braseiro")).toHaveAttribute("data-selecionada", "true");

  // arrastar a marca muda o lugar da luz (e só ela)
  const fim = await pontoNaPagina(p, braseiro.x + 6, braseiro.y + 3);
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  await p.mouse.move(fim.x, fim.y, { steps: 10 });
  await p.mouse.up();
  await expect
    .poll(async () => (await luzes(p)).find((l) => l.id === "luz-braseiro")?.x)
    .toBeCloseTo(33, 0);
  expect((await luzes(p)).find((l) => l.id === "luz-braseiro")?.y).toBeCloseTo(12.75, 0);
  expect((await luzes(p)).find((l) => l.id === "luz-tocha-sala")?.x).toBeCloseTo(11.25, 1);

  // minimizar (R3): só o cabeçalho fica; o conteúdo continua montado, mas escondido
  await expect(p.getByTestId("painel-fontes-corpo")).toBeVisible();
  const janela = p.getByTestId("janela-fontes");
  await expect(janela).toHaveAttribute("data-minimizada", "false");
  await p.getByTestId("painel-fontes-cabecalho").dblclick();
  await expect(janela).toHaveAttribute("data-minimizada", "true");
  await expect(p.getByTestId("painel-fontes-corpo")).toBeHidden();
  await expect(p.getByTestId("painel-fontes-cabecalho")).toBeVisible();
  await p.getByTestId("painel-fontes-cabecalho").dblclick();
  await expect(janela).toHaveAttribute("data-minimizada", "false");
  await expect(p.getByTestId("painel-fontes-corpo")).toBeVisible();
});

test("o item Iluminação dinâmica mostra claramente se está ligado ou desligado", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const abrir = async () => {
    await p.getByTestId("menu-iluminacao").click();
    await expect(p.getByTestId("lanterna")).toBeVisible();
  };
  await abrir();
  await expect(p.getByTestId("lanterna-iluminacao-estado")).toHaveText("Ligada");
  await expect(p.getByTestId("lanterna-iluminacao-estado")).toHaveAttribute("data-ligado", "true");
  await expect(p.getByTestId("menu-iluminacao")).not.toHaveClass(/com-alerta/);

  await p.getByTestId("lanterna-iluminacao").click(); // desliga
  await abrir();
  await expect(p.getByTestId("lanterna-iluminacao-estado")).toHaveText("Desligada");
  await expect(p.getByTestId("lanterna-iluminacao-estado")).toHaveAttribute("data-ligado", "false");
  await expect(p.getByTestId("lanterna-iluminacao")).toHaveAttribute("aria-checked", "false");
  // o ícone da lanterna avisa mesmo com a lista fechada
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("menu-iluminacao")).toHaveClass(/com-alerta/);

  await abrir();
  await p.getByTestId("lanterna-iluminacao").click(); // liga de novo
  await abrir();
  await expect(p.getByTestId("lanterna-iluminacao-estado")).toHaveText("Ligada");
});

test("a visão noturna do mestre considera a luz: o que algum jogador vê aparece normal", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await expect.poll(async () => (await visaoGeral(p)).modo).toBe("noturna");
  // (31,5; 9,75): iluminado pelo braseiro (4,5 m) e à vista da Brisa (15,75 m), fora da visão no escuro
  // do Aldric (20,25 m) e longe do Cael (11 m, sem visão no escuro)
  await expect.poll(() => veEm(p, 31.5, 9.75)).toBe(true);
  expect(await veEm(p, 45, 35)).toBe(false); // ninguém vê (nem luz)
  // apaga o braseiro: o mesmo ponto passa a ficar apagado
  await intencao(p, "fonte.editar", { id: "luz-braseiro", mudancas: { estado: "apagada" } });
  await expect.poll(() => veEm(p, 31.5, 9.75)).toBe(false);
  // com a visão noturna desligada, tudo claro
  await p.getByTestId("menu-visao-noturna").click();
  await expect.poll(() => veEm(p, 45, 35)).toBe(true);
});

test("frames: a fonte de luz de outra cena ou de token oculto nunca chega ao jogador", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const nova = (id: string, extra: object) =>
    intencao(mestre.pagina, "fonte.criar", {
      ...extra,
      fonte: {
        id,
        nome: id,
        portador: { tipo: "cena", x: 5, y: 5 },
        luz: { claraM: 3, penumbraM: 3, cor: "#ffffff", tremula: false },
        intensidade: 1,
        estado: "acesa",
      },
    });

  // o snapshot do jogador só traz as luzes da cena ativa
  const snapshot = JSON.parse(j1.frames.find((f) => f.includes('"tipo":"snapshot"')) ?? "{}");
  expect((snapshot.dados.estado.luzes as { id: string }[]).map((l) => l.id).sort()).toEqual([
    "luz-braseiro",
    "luz-tocha-sala",
  ]);
  expect(snapshot.dados.estado.config.iluminacao.memoriaLigada).toBe(true);

  // luz em outra cena
  await nova("luz-secreta-covil", { cenaId: "cena-covil" });
  // luz presa ao goblin oculto e ao marcador da camada do mestre
  await intencao(mestre.pagina, "fonte.criar", {
    fonte: {
      id: "luz-secreta-goblin",
      nome: "Goblin brilha",
      portador: { tipo: "token", tokenId: "tok-goblin-oculto" },
      luz: { claraM: 3, penumbraM: 3, cor: "#ffffff", tremula: false },
      intensidade: 1,
      estado: "acesa",
    },
  });
  await intencao(mestre.pagina, "fonte.criar", {
    fonte: {
      id: "luz-secreta-marcador",
      nome: "Marcador brilha",
      portador: { tipo: "token", tokenId: "tok-marcador-mestre" },
      luz: { claraM: 3, penumbraM: 3, cor: "#ffffff", tremula: false },
      intensidade: 1,
      estado: "acesa",
    },
  });
  // uma luz visível chega, para provar que o canal funciona
  await nova("luz-publica", {});
  await expect.poll(() => j1.frames.some((f) => f.includes("luz-publica"))).toBe(true);
  expect(j1.frames.some((f) => f.includes("luz-secreta"))).toBe(false);
  expect(j1.frames.some((f) => f.includes("Goblin brilha"))).toBe(false);
  expect(mestre.frames.some((f) => f.includes("luz-secreta-goblin"))).toBe(true);

  // mostrar o goblin entrega a luz dele (snapshot novo); esconder de novo a tira
  // (o jogador recebe um snapshot, não um evento: `enviarCru` não devolve nada, e tudo bem)
  await enviarCru(
    mestre.pagina,
    intencaoCrua("token.editar", { id: "tok-goblin-oculto", mudancas: { oculto: false } }),
  );
  await expect.poll(() => j1.frames.some((f) => f.includes("luz-secreta-goblin"))).toBe(true);
  const antes = j1.frames.length;
  await enviarCru(
    mestre.pagina,
    intencaoCrua("token.editar", { id: "tok-goblin-oculto", mudancas: { oculto: true } }),
  );
  await expect
    .poll(() => {
      const novos = j1.frames.slice(antes).filter((f) => f.includes('"tipo":"snapshot"'));
      const ultimo = novos.at(-1);
      return ultimo === undefined ? null : ultimo.includes("luz-secreta-goblin");
    })
    .toBe(false);

  // só o mestre mexe nas fontes
  const recusa = await enviarCru(j1.pagina, intencaoCrua("fonte.apagar", { id: "luz-publica" }));
  expect(recusa?.dados.codigo).toBe("sem_permissao");
});

test("configurações: a luz ambiente da cena muda para todos e o jogador recebe a configuração", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-config").click();
  await expect(p.getByTestId("painel-config-iluminacao")).toBeVisible();
  await expect(p.getByTestId("config-luz-ambiente-valor")).toHaveText("10%");

  await p.getByTestId("config-luz-ambiente").fill("60");
  // ambiente alto: tudo o que a visão alcança aparece (penumbra no mínimo)
  await expect
    .poll(() =>
      j1.pagina.evaluate(() =>
        (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.nivelNoPonto(40, 30),
      ),
    )
    .toBeCloseTo(0.6);
  await expect.poll(() => visaoEm(j1.pagina, 12, 9.75)).not.toBe("nenhuma");

  await p.getByTestId("config-memoria-tom").fill("#336699");
  await expect
    .poll(() => j1.frames.filter((f) => f.includes('"config.alterada"')).join(""))
    .toContain("#336699");
});
