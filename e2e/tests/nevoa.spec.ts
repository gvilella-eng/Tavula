import type { Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, menuDaCena, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina, tokensDe } from "./ajudasMapa";

// Lote N4: a névoa pintada à mão. O mestre cobre e revela áreas por cena; o jogador vê a área coberta escura e opaca (e
// não vê os tokens dentro dela, menos os dele); o mestre a vê como um véu. A cena-1 da semente (60 × 45 m) vira cartão
// nos testes para a luz e a visão não esconderem nada: só a névoa manual decide.

const nevoaDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.nevoa());
const cobre = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([a, b]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.nevoaCobre(
        a as number,
        b as number,
      ),
    [x, y],
  );
const camada = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.nevoaDesenhada());
const emAndamento = (p: Page) =>
  p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.nevoaEmAndamento(),
  );
const ferramentaDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.ferramenta());
const modoDeVisao = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.visao().modo);
const centrar = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([a, b]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(
        a as number,
        b as number,
      ),
    [x, y],
  );
const desenhado = async (p: Page, id: string) =>
  (await tokensDe(p)).find((t) => t.id === id)?.desenhado ?? null;

/** O retângulo revelado: engloba tok-jogador-2 (15,75; 9,75) e tok-jogador-3 (20,25; 9,75), e não o ogro (30; 15). */
const RETANGULO = { a: { x: 13.5, y: 6.75 }, b: { x: 24, y: 12.75 } };

/** A cena-1 vira cartão e a tela já enquadrou a imagem (o enquadramento move a câmera: só depois se centra). */
async function virarCartao(p: Page) {
  await menuDaCena(p, "cena-1", "cartao");
  await expect.poll(() => modoDeVisao(p)).toBe("claro");
  await expect(p.getByTestId("cena-cartao-cena-1")).toBeVisible();
}

async function abrirFerramenta(p: Page) {
  await p.getByTestId("ferramenta-nevoa").click();
  await expect(p.getByTestId("painel-nevoa")).toBeVisible();
}

async function tracoComOMouse(p: Page, pontos: { x: number; y: number }[]) {
  const t = await Promise.all(pontos.map((q) => pontoNaPagina(p, q.x, q.y)));
  const [primeiro, ...resto] = t;
  if (!primeiro) return;
  await p.mouse.move(primeiro.x, primeiro.y);
  await p.mouse.down();
  for (const q of resto) await p.mouse.move(q.x, q.y, { steps: 6 });
  await p.mouse.up();
}

async function cobrirTudo(p: Page) {
  await p.getByTestId("nevoa-cobrir-tudo").click();
  await expect(p.getByTestId("nevoa-confirmacao")).toBeVisible();
  await p.getByTestId("nevoa-confirmar").click();
  await expect(p.getByTestId("nevoa-confirmacao")).toHaveCount(0);
}

async function revelarRetangulo(p: Page) {
  await p.getByTestId("nevoa-modo-revelar").click();
  await p.getByTestId("nevoa-forma-retangulo").click();
  await tracoComOMouse(p, [RETANGULO.a, RETANGULO.b]);
}

test("o mestre cobre tudo e revela um retângulo: o jogador vê só o retângulo e o token fora dele some", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await virarCartao(p);
  // sem névoa manual: o jogador vê o ogro (cartão não esconde nada) e a camada não existe
  await expect.poll(() => desenhado(j1.pagina, "tok-ogro")).toBe(true);
  expect((await camada(j1.pagina)).visivel).toBe(false);

  await centrar(p, 21, 10);
  await abrirFerramenta(p);
  expect(await ferramentaDe(p)).toBe("nevoa");
  await cobrirTudo(p);
  await revelarRetangulo(p);

  await expect.poll(async () => (await nevoaDe(j1.pagina)).length, { timeout: 1000 }).toBe(2);
  const traco = (await nevoaDe(j1.pagina))[1];
  expect(traco).toMatchObject({
    forma: "retangulo",
    modo: "revelar",
    pontos: [RETANGULO.a, RETANGULO.b],
  });

  // o jogador: dentro revelado, fora coberto (escuro e opaco); o ogro fora some; os tokens dentro continuam
  expect(await cobre(j1.pagina, 15.75, 9.75)).toBe(false);
  expect(await cobre(j1.pagina, 30, 15)).toBe(true);
  expect(await camada(j1.pagina)).toEqual({ visivel: true, alpha: 1 });
  await expect.poll(() => desenhado(j1.pagina, "tok-ogro")).toBe(false);
  expect(await desenhado(j1.pagina, "tok-jogador-2")).toBe(true);
  expect(await desenhado(j1.pagina, "tok-jogador-3")).toBe(true);
  // o token do próprio jogador continua visível para ele, mesmo coberto (assumido)
  expect(await cobre(j1.pagina, 11.25, 9.75)).toBe(true);
  expect(await desenhado(j1.pagina, "tok-jogador-1")).toBe(true);

  // o mestre vê tudo: véu translúcido e o ogro desenhado
  expect(await camada(p)).toEqual({ visivel: true, alpha: 0.5 });
  expect(await desenhado(p, "tok-ogro")).toBe(true);

  // a cena continua cartão (visão "claro"): só a névoa manual escondeu
  expect(await modoDeVisao(j1.pagina)).toBe("claro");
});

test("o pincel revela um caminho; o desfazer (Ctrl+Z e o botão) volta o último traço", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await virarCartao(p);
  await centrar(p, 21, 10);
  await abrirFerramenta(p);
  await cobrirTudo(p);

  await p.getByTestId("nevoa-modo-revelar").click();
  await expect(p.getByTestId("nevoa-forma-pincel")).toHaveAttribute("aria-pressed", "true");
  await p.getByTestId("nevoa-raio").fill("1.5");
  await p.getByTestId("nevoa-raio").press("Enter");
  await tracoComOMouse(p, [
    { x: 14.25, y: 9.75 },
    { x: 18, y: 9.75 },
    { x: 21, y: 12 },
    { x: 24, y: 12 },
  ]);
  await expect.poll(async () => (await nevoaDe(j1.pagina)).length, { timeout: 1000 }).toBe(2);
  const pincel = (await nevoaDe(p))[1];
  expect(pincel).toMatchObject({ forma: "pincel", modo: "revelar", raio: 1.5 });
  // o caminho revelado e o resto coberto (para o jogador)
  for (const [x, y, coberto] of [
    [16, 9.75, false],
    [19.5, 10.9, false],
    [23, 12, false],
    [16, 12.5, true],
    [30, 15, true],
  ] as const) {
    expect(await cobre(j1.pagina, x, y), `(${x}, ${y})`).toBe(coberto);
  }
  await expect.poll(() => desenhado(j1.pagina, "tok-ogro")).toBe(false);

  // Ctrl+Z (com o foco no mapa) desfaz o pincel; o botão desfaz o "cobrir tudo"
  await p.keyboard.press("Control+z");
  await expect.poll(async () => (await nevoaDe(j1.pagina)).length).toBe(1);
  expect(await cobre(j1.pagina, 16, 9.75)).toBe(true);
  await p.getByTestId("nevoa-desfazer").click();
  await expect.poll(async () => (await nevoaDe(j1.pagina)).length).toBe(0);
  await expect(p.getByTestId("nevoa-desfazer")).toBeDisabled();
  await expect.poll(() => desenhado(j1.pagina, "tok-ogro")).toBe(true);
  expect((await camada(j1.pagina)).visivel).toBe(false);
});

test("na cena-cartão o polígono revela parte da cidade e o resto fica coberto; Revelar tudo devolve", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await virarCartao(p);
  await centrar(p, 21, 10);
  await abrirFerramenta(p);
  // a tecla N liga e desliga a ferramenta fora de um campo
  await p.getByTestId("nevoa-fechar").click();
  await expect.poll(() => ferramentaDe(p)).toBe("selecionar");
  await p.getByTestId("ferramenta-selecionar").focus();
  await p.keyboard.press("n");
  await expect.poll(() => ferramentaDe(p)).toBe("nevoa");

  await cobrirTudo(p);
  await p.getByTestId("nevoa-modo-revelar").click();
  await p.getByTestId("nevoa-forma-poligono").click();
  const triangulo = [
    { x: 13.5, y: 6 },
    { x: 24, y: 6 },
    { x: 24, y: 13.5 },
  ];
  for (const q of triangulo) {
    const t = await pontoNaPagina(p, q.x, q.y);
    await p.mouse.click(t.x, t.y);
  }
  await expect.poll(async () => (await emAndamento(p))?.length).toBe(3);
  // Esc cancela o que estava em andamento sem enviar nada
  await p.keyboard.press("Escape");
  await expect.poll(() => emAndamento(p)).toBeNull();
  expect((await nevoaDe(p)).length).toBe(1);
  for (const q of triangulo) {
    const t = await pontoNaPagina(p, q.x, q.y);
    await p.mouse.click(t.x, t.y);
  }
  await p.keyboard.press("Enter");
  await expect.poll(async () => (await nevoaDe(j1.pagina)).length, { timeout: 1000 }).toBe(2);
  expect(await cobre(j1.pagina, 20, 8)).toBe(false); // dentro do triângulo
  expect(await cobre(j1.pagina, 15, 12)).toBe(true); // fora (abaixo da diagonal)
  expect(await modoDeVisao(j1.pagina)).toBe("claro");
  expect((await camada(j1.pagina)).visivel).toBe(true);

  // Revelar tudo (com confirmação) devolve o mapa inteiro; cancelar não muda nada
  await p.getByTestId("nevoa-revelar-tudo").click();
  await p.getByTestId("nevoa-cancelar").click();
  expect((await nevoaDe(j1.pagina)).length).toBe(2);
  await p.getByTestId("nevoa-revelar-tudo").click();
  await p.getByTestId("nevoa-confirmar").click();
  await expect.poll(async () => (await camada(j1.pagina)).visivel).toBe(false);
  expect(await cobre(j1.pagina, 15, 12)).toBe(false);
});

test("o 'Ver como' do mestre mostra a névoa igual ao jogador; só o mestre pinta; a névoa de outra cena não chega", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await virarCartao(p);
  await centrar(p, 21, 10);
  await abrirFerramenta(p);
  await cobrirTudo(p);
  await revelarRetangulo(p);
  await expect.poll(async () => (await nevoaDe(j1.pagina)).length).toBe(2);
  expect(await camada(p)).toEqual({ visivel: true, alpha: 0.5 });
  expect(await desenhado(p, "tok-ogro")).toBe(true);

  await p.getByTestId("menu-ver-como").click();
  await p.getByTestId("ver-como-jogador-1").click();
  await expect(p.getByTestId("ver-como-selo")).toBeVisible();
  // vendo como o jogador: a ferramenta fecha, o véu fica opaco e o ogro some, como na tela dele
  await expect(p.getByTestId("painel-nevoa")).toHaveCount(0);
  await expect(p.getByTestId("ferramenta-nevoa")).toHaveCount(0);
  await expect.poll(async () => (await camada(p)).alpha).toBe(1);
  await expect.poll(() => desenhado(p, "tok-ogro")).toBe(false);
  for (const id of ["tok-ogro", "tok-jogador-1", "tok-jogador-2", "tok-jogador-3"]) {
    expect(await desenhado(p, id), id).toBe(await desenhado(j1.pagina, id));
  }
  await p.getByTestId("menu-ver-como").click();
  await p.getByTestId("ver-como-eu").click();
  await expect.poll(async () => (await camada(p)).alpha).toBe(0.5);
  await expect.poll(() => desenhado(p, "tok-ogro")).toBe(true);

  // o jogador não pinta (cena.editar é do mestre), nem desfaz
  const traco = { forma: "tudo", modo: "revelar", pontos: [] };
  const r = await enviarCru(j1.pagina, intencaoCrua("nevoa.tracar", { cenaId: "cena-1", traco }));
  expect(r?.tipo).toBe("erro");
  const d = await enviarCru(j1.pagina, intencaoCrua("nevoa.desfazer", { cenaId: "cena-1" }));
  expect(d?.tipo).toBe("erro");
  expect((await nevoaDe(p)).length).toBe(2);

  // a névoa de outra cena não chega ao jogador (só a da cena ativa)
  const antes = j1.frames.filter((f) => f.includes('"nevoa.tracada"')).length;
  const outra = await enviarCru(
    p,
    intencaoCrua("nevoa.tracar", {
      cenaId: "cena-covil",
      traco: { forma: "tudo", modo: "cobrir", pontos: [] },
    }),
  );
  expect(outra?.tipo).toBe("evento");
  await expect
    .poll(() => mestre.frames.filter((f) => f.includes("cena-covil")).length)
    .toBeGreaterThan(0);
  expect(j1.frames.filter((f) => f.includes('"nevoa.tracada"')).length).toBe(antes);
});
