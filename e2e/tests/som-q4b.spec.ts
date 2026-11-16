import type { Page } from "@playwright/test";
import { CAMINHO_DA_MESA, expect, test } from "./ajudas";
import { entrarNoMapa } from "./ajudasMapa";
import { arquivoWav, configurarLugar, esperarHashDoSom, somDe } from "./ajudasSom";

// Q4b: a mesa de som numa janela própria do navegador (como a ficha), a altura da faixa no pé da tela (tudo encolhe junto e,
// no mínimo, o corpo rola), a configuração por cima de tudo, o transporte Tocar/Parar (o resto está em som-q4.spec.ts) e
// a lista dos sons que a mesa já tem. Os arquivos são wavs de silêncio gerados aqui.

test.describe.configure({ timeout: 120_000 });

/** A mesa de som com 2 efeitos e 2 ambientes, com a configuração fechada. */
async function montarMesaDeSom(m: Page) {
  await configurarLugar(m, "efeito", 0, arquivoWav("sopro.wav", 20), "Sopro");
  await configurarLugar(m, "efeito", 1, arquivoWav("trovao.wav", 2), "Trovão");
  await configurarLugar(m, "ambiente", 0, arquivoWav("taverna.wav", 1), "Taverna");
  await configurarLugar(m, "ambiente", 1, arquivoWav("vento.wav", 4), "Vento");
  await m.getByTestId("som-config-pronto").click();
  await expect(m.getByTestId("som-config")).toHaveCount(0);
}

/** O elemento que está no topo no ponto dado é este (ou está dentro dele)? */
const estaNoTopo = (p: Page, testid: string, x: number, y: number) =>
  p.evaluate(
    ({ testid, x, y }) => {
      const topo = document.elementFromPoint(x, y);
      return topo?.closest(`[data-testid="${testid}"]`) !== null && topo !== null;
    },
    { testid, x, y },
  );

test("a mesa de som abre em outra janela: toca um efeito por ela, o painel sai da mesa e volta ao fechar", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;
  await montarMesaDeSom(m);
  const sopro = await esperarHashDoSom(m, "sopro.wav");
  const bolinhas = () => m.getByTestId("topo").locator('[data-testid^="presenca-estado-"]');
  await expect(bolinhas()).toHaveCount(2);

  await expect(m.getByTestId("painel-som")).toBeVisible();
  const [popup] = await Promise.all([
    mestre.contexto.waitForEvent("page"),
    m.getByTestId("som-abrir-em-janela").click(),
  ]);

  // a janela mostra só a mesa de som, com o nome na aba do navegador
  await expect(popup.getByTestId("som-propria")).toBeVisible();
  await expect(popup).toHaveTitle("Som — Távola");
  await expect(popup).toHaveURL(new RegExp(`${CAMINHO_DA_MESA}/som$`));
  await expect(popup.getByTestId("topo")).toHaveCount(0);
  await expect(popup.getByTestId("mapa")).toHaveCount(0);
  await expect(popup.getByTestId("som-efeito-0")).toContainText("Sopro");
  await expect(popup.getByTestId("som-ambiente-1")).toContainText("Vento");
  // a mesa tira o painel da tela e a presença não duplica
  await expect(m.getByTestId("painel-som")).toHaveCount(0);
  await expect(bolinhas()).toHaveCount(2);

  // tocar um efeito pela janela chega ao jogador (e ao navegador da mesa, que é onde o som sai)
  await popup.getByTestId("som-efeito-0").click();
  for (const p of [m, j]) {
    await expect.poll(async () => (await somDe(p)).efeitos.length).toBe(1);
    expect((await somDe(p)).efeitos[0]).toMatchObject({ hash: sopro, lugar: 0 });
  }
  // marcar um ambiente e tocar pela janela
  await popup.getByTestId("som-ambiente-ligar-0").click();
  await popup.getByTestId("som-transporte").click();
  await expect.poll(async () => (await somDe(j)).ambientes.length).toBe(1);
  await expect(popup.getByTestId("som-transporte")).toHaveAttribute("data-tocando", "sim");
  await popup.getByTestId("som-transporte").click();
  await expect.poll(async () => (await somDe(j)).ambientes.length).toBe(0);

  // a configuração abre por cima, dentro da janela
  await popup.getByTestId("som-config-abrir").click();
  await expect(popup.getByTestId("som-config")).toBeVisible();
  await popup.getByTestId("som-config-pronto").click();

  // fechar a janela devolve a mesa de som ao lugar
  await popup.close();
  await expect(m.getByTestId("painel-som")).toBeVisible();
  await expect(m.getByTestId("som-efeito-0")).toContainText("Sopro");
  await expect(bolinhas()).toHaveCount(2);
});

test("a faixa no pé da tela muda de altura: tudo encolhe junto, no mínimo o corpo rola, o layout é o mesmo e a altura fica lembrada", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  await montarMesaDeSom(m);
  await m.getByTestId("som-encaixar").click();
  const faixa = m.getByTestId("som-faixa");
  const corpo = m.getByTestId("som-faixa-corpo");
  const alca = m.getByTestId("som-faixa-alca");
  await expect(faixa).toBeVisible();
  await expect(alca).toBeVisible();

  const caixaDe = async (testid: string) => {
    const c = await m.getByTestId(testid).boundingBox();
    if (!c) throw new Error(`${testid} não está visível`);
    return c;
  };
  const medidas = async () => ({
    f: await caixaDe("som-faixa"),
    ef: await caixaDe("som-efeitos"),
    am: await caixaDe("som-ambientes"),
    botao: await caixaDe("som-efeito-0"),
    rola: await corpo.evaluate((e) => e.scrollHeight > e.clientHeight + 1),
    escala: Number(await faixa.getAttribute("data-escala")),
  });

  // o tamanho natural: sem rolagem, escala 1
  const cheia = await medidas();
  expect(cheia.escala).toBe(1);
  expect(cheia.rola).toBe(false);
  // o layout: efeitos à esquerda, ambientes à direita
  expect(cheia.ef.x).toBeLessThan(cheia.am.x);

  // o teclado: com a alça focada, a seta para baixo diminui (Shift anda mais)
  await alca.focus();
  const valorCheio = Number(await alca.getAttribute("aria-valuenow"));
  await m.keyboard.press("Shift+ArrowDown");
  await expect
    .poll(async () => Number(await alca.getAttribute("aria-valuenow")))
    .toBe(valorCheio - 48);
  const menor = await medidas();
  expect(menor.f.height).toBeLessThan(cheia.f.height - 40);
  // tudo menor junto e sem rolagem; o layout é o mesmo
  expect(menor.escala).toBeLessThan(1);
  expect(menor.botao.height).toBeLessThan(cheia.botao.height);
  expect(menor.rola).toBe(false);
  expect(menor.ef.x).toBeLessThan(menor.am.x);
  expect(menor.ef.y).toBeLessThan(menor.am.y + menor.am.height);
  // o pé da faixa continua na borda de baixo da área do mapa (a faixa encolhe para cima)
  expect(menor.f.y + menor.f.height).toBeCloseTo(cheia.f.y + cheia.f.height, 0);

  // o mouse: arrastar a alça para cima aumenta de novo
  const c = await alca.boundingBox();
  expect(c).toBeTruthy();
  if (!c) return;
  await m.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await m.mouse.down();
  await m.mouse.move(c.x + c.width / 2, c.y + c.height / 2 - 30, { steps: 4 });
  await m.mouse.up();
  const maior = await medidas();
  expect(maior.f.height).toBeGreaterThan(menor.f.height + 20);
  expect(maior.escala).toBeGreaterThan(menor.escala);

  // o mínimo: o corpo rola e a escala para no piso
  await alca.focus();
  await m.keyboard.press("End");
  await expect.poll(async () => (await medidas()).rola).toBe(true);
  const minima = await medidas();
  expect(minima.escala).toBe(0.7);
  expect(minima.ef.x).toBeLessThan(minima.am.x);
  expect(minima.botao.height).toBeGreaterThanOrEqual(40);
  expect(minima.f.height).toBeLessThan(maior.f.height);

  // a altura fica lembrada por pessoa (e nada disso vai para a sala)
  const antes = minima.f.height;
  await m.reload();
  await expect(m.getByTestId("status-conexao")).toHaveText("conectado");
  await m.getByTestId("ferramenta-som").click();
  await expect(faixa).toBeVisible();
  await expect.poll(async () => (await faixa.boundingBox())?.height).toBeCloseTo(antes, 0);
  expect(mestre.enviados.filter((f) => f.includes("faixa"))).toHaveLength(0);
  // Home volta ao tamanho natural
  await alca.focus();
  await m.keyboard.press("Home");
  await expect.poll(async () => (await medidas()).escala).toBe(1);
  expect((await medidas()).f.height).toBeCloseTo(cheia.f.height, 0);
});

test("a configuração abre por cima da faixa e da janela do som, inteira na tela, e volta ao foco quando reaberta", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  await montarMesaDeSom(m);
  const tela = m.viewportSize();
  expect(tela).toBeTruthy();

  const conferir = async (onde: string) => {
    await m.getByTestId("som-config-abrir").click();
    const config = m.getByTestId("som-config");
    await expect(config).toBeVisible();
    const caixa = await config.boundingBox();
    expect(caixa, onde).toBeTruthy();
    if (!caixa || !tela) return;
    // inteira na tela
    expect(caixa.x, onde).toBeGreaterThanOrEqual(0);
    expect(caixa.y, onde).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width, onde).toBeLessThanOrEqual(tela.width);
    expect(caixa.y + caixa.height, onde).toBeLessThanOrEqual(tela.height);
    // por cima: no centro e junto da borda de baixo (onde ficaria a faixa), o que está no topo é a própria configuração
    const meio = caixa.x + caixa.width / 2;
    for (const y of [caixa.y + caixa.height / 2, caixa.y + caixa.height - 12]) {
      expect(await estaNoTopo(m, "som-config", meio, y), `${onde} em y=${y}`).toBe(true);
    }
    await m.getByTestId("som-config-pronto").click();
    await expect(config).toHaveCount(0);
  };

  // a janela flutuante do som
  await expect(m.getByTestId("painel-som")).toBeVisible();
  await conferir("com a janela");
  // a faixa no pé da tela (e a configuração por cima, mesmo com a faixa mais alta que a janela do som)
  await m.getByTestId("som-encaixar").click();
  await expect(m.getByTestId("som-faixa")).toBeVisible();
  await conferir("com a faixa");
  // reaberta depois de clicar na faixa, volta por cima de novo
  await m.getByTestId("som-efeito-0").click();
  await conferir("reaberta com a faixa");
});

test("a configuração lista os sons que a mesa já tem, para pôr num lugar com um clique", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  await configurarLugar(m, "ambiente", 0, arquivoWav("chuva.wav", 1), "Chuva");
  const chuva = await esperarHashDoSom(m, "chuva.wav");
  // esvazia o lugar: o arquivo continua na mesa (registrado antes)
  await m.getByTestId("som-config-tirar").click();
  await expect(m.getByTestId("som-lugar-ambiente-0")).toHaveAttribute("data-vazio", "sim");
  // outro lugar: o som que a mesa já tem aparece na lista, com o nome do arquivo, e um clique o põe no lugar
  await m.getByTestId("som-lugar-efeito-3").click();
  await expect(m.getByTestId("som-config-ja-tem")).toHaveText("Sons que a mesa já tem");
  await expect(m.getByTestId("som-config-arquivos")).toContainText("chuva.wav");
  await m.getByTestId(`som-config-arquivo-${chuva.slice(0, 8)}`).click();
  await expect(m.getByTestId("som-lugar-efeito-3")).toHaveAttribute("data-vazio", "nao");
  await expect(m.getByTestId("som-config-arquivo")).toHaveText("chuva.wav");
  await m.getByTestId("som-config-pronto").click();
});
