import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa } from "./ajudasMapa";

// FG1: o modelo ao vivo, a área de soltar maior, a tocha no lugar do ícone (tudo em tamanho de mundo), a chama animada
// (padrão e a do mestre), o tamanho da chama do inflamável, o jogador que dá equipamento ao próprio personagem e a setinha
// que recolhe os detalhes do item de modelo. A semente tem Aldric (jogador-1, token em 11,25; 9,75) e Brisa (jogador-2).

const ALDRIC = "pers-aldric";
const BRISA = "pers-brisa";
const TOCHA = "modelo-tocha";
const FOGUEIRA = "modelo-fogueira";

type Alca = Awaited<ReturnType<GanchoDoMapa["alcas"]>>[number];

const alvoDaTocha = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alvoDaTocha());
const alcas = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas());
const pontosDaTela = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.pontos());
const chamas = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.chamas());
const luzes = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes());
const zoomPara = (p: Page, z: number) =>
  p.evaluate(
    (zz) => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.definirZoom(zz),
    z,
  );

async function intencao(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r, `${tipo} sem resposta`).not.toBeNull();
  return r;
}
async function ok(p: Page, tipo: string, dados: object) {
  const r = await intencao(p, tipo, dados);
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

/** Três tochas na mochila do Aldric e a Brisa no quadrado de baixo. */
async function preparar(mestre: { pagina: Page }) {
  await ok(mestre.pagina, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 3 });
  await ok(mestre.pagina, "token.soltar", { id: "tok-jogador-2", x: 11.25, y: 11.25 });
}

const suporte = (id = "gancho", x = 12.75, y = 9.75) => ({
  id,
  nome: "Gancho",
  x,
  y,
  tipo: "suporte" as const,
  visivelParaJogadores: true,
});

async function acender(p: Page, novoId = "tocha-1") {
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId });
}

/** Aldric segura uma tocha acesa sobre o inflamável por 0 s (acende na hora): nasce a fogueira no ponto. */
/**
 * Manda uma intenção que a sala responde com um snapshot novo (ou com nada), não com um evento: não há o que esperar
 * aqui, o teste confere o efeito depois.
 */
async function mandar(p: Page, tipo: string, dados: object) {
  await p.evaluate(
    ([t, d]) =>
      new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
        ws.onopen = () => {
          ws.send(JSON.stringify({ v: 1, id: `teste-${Math.random()}`, tipo: t, dados: d }));
          setTimeout(() => {
            ws.close();
            resolve();
          }, 400);
        };
      }),
    [tipo, dados] as [string, object],
  );
}

async function acenderInflamavel(p: Page, pontoId = "lenha", objetoId = "tocha-1") {
  await mandar(p, "ponto.acenderInicio", { pontoId, objetoId });
  await mandar(p, "ponto.acenderFim", { pontoId, objetoId });
}

const lenha = (extra: object = {}) => ({
  id: "lenha",
  nome: "Lenha",
  x: 12.75,
  y: 9.75,
  tipo: "inflamavel" as const,
  modeloId: FOGUEIRA,
  segurarS: 0,
  visivelParaJogadores: true,
  ...extra,
});

async function abrirModelo(p: Page, id: string) {
  await abrirAba(p, "mesa");
  const corpo = p.getByTestId(`modelo-nome-${id}`);
  if (!(await corpo.isVisible())) await p.getByTestId(`modelo-resumo-${id}`).click();
  await expect(corpo).toBeVisible();
}

test("mudar a luz plena do modelo muda a tocha do mapa e a da mão do jogador, para os dois; o editor alinha a cor", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  await ok(mestre.pagina, "ponto.criar", { ponto: suporte() });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  // uma tocha na mão do Aldric e outra num suporte do mapa
  await acender(j1.pagina, "na-mao");
  await acender(j1.pagina, "no-suporte");
  await ok(j1.pagina, "tocha.posar", { id: "no-suporte", pontoId: "gancho" });
  const raio = async (p: Page, id: string) => (await luzes(p)).find((l) => l.id === id)?.claraM;
  for (const quem of [mestre, j1, j2]) {
    await expect.poll(() => raio(quem.pagina, "na-mao")).toBeCloseTo(6);
    await expect.poll(() => raio(quem.pagina, "no-suporte")).toBeCloseTo(6);
  }

  await abrirModelo(mestre.pagina, TOCHA);
  // a cor ficou na mesma linha do "Tremular" (o rótulo não fica mais em cima, desalinhado)
  const cor = await mestre.pagina.getByTestId(`modelo-cor-${TOCHA}`).boundingBox();
  const tremular = await mestre.pagina.getByTestId(`modelo-tremula-${TOCHA}`).boundingBox();
  if (!cor || !tremular) throw new Error("sem caixa");
  expect(Math.abs(cor.y + cor.height / 2 - (tremular.y + tremular.height / 2))).toBeLessThan(4);
  const campo = mestre.pagina.getByTestId(`modelo-clara-${TOCHA}`);
  await campo.fill("9");
  await campo.blur();

  for (const quem of [mestre, j1, j2]) {
    await expect.poll(() => raio(quem.pagina, "na-mao")).toBeCloseTo(9);
    await expect.poll(() => raio(quem.pagina, "no-suporte")).toBeCloseTo(9);
  }
  // o que é do objeto fica: continuam acesas e no lugar
  const a = await alcas(j1.pagina);
  expect(a.find((x) => x.portador === "ponto")?.estado).toBe("acesa");
  expect(a.find((x) => x.portador === "mao")?.estado).toBe("acesa");
});

test("soltar a tocha perto do suporte, fora do ícone mas dentro da área, pendura; a área destaca o alvo", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  await ok(mestre.pagina, "ponto.criar", { ponto: suporte() });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await acender(p);
  await expect.poll(async () => (await alcas(p)).length).toBe(1);
  await expect.poll(async () => (await pontosDaTela(p)).length).toBe(1);
  const alca = (await alcas(p))[0] as Alca;
  const ponto = (await pontosDaTela(p))[0] as Awaited<ReturnType<typeof pontosDaTela>>[number];
  // a área é bem maior que o ícone (1 célula ou ~40 px, o que for maior)
  expect(ponto.soltarPx).toBeGreaterThanOrEqual(40);
  expect(ponto.soltarPx).toBeGreaterThan(ponto.raioPx * 3);
  const longe = ponto.raioPx + 28; // fora do ícone, dentro da área
  expect(longe).toBeLessThan(ponto.soltarPx);

  await p.mouse.move(alca.x, alca.y);
  await p.mouse.down();
  await p.mouse.move(ponto.x, ponto.y - longe, { steps: 10 });
  // durante o arrasto a tela destaca o alvo mais próximo
  await expect.poll(async () => alvoDaTocha(p)).toBe("gancho");
  await p.mouse.up();
  await expect.poll(async () => (await alcas(p))[0]?.portador).toBe("ponto");

  // fora da área: volta para a mão, sem pendurar
  await p.mouse.click((await alcas(p))[0]?.x ?? 0, (await alcas(p))[0]?.y ?? 0, {
    button: "right",
  });
  await p.getByTestId("menu-tocha-pegar").click();
  await expect.poll(async () => (await alcas(p))[0]?.portador).toBe("mao");
  const a2 = (await alcas(p))[0] as Alca;
  await p.mouse.move(a2.x, a2.y);
  await p.mouse.down();
  await p.mouse.move(ponto.x, ponto.y - ponto.soltarPx - 40, { steps: 10 });
  expect(await alvoDaTocha(p)).toBeNull();
  await p.mouse.up();
  await expect.poll(async () => (await alcas(p))[0]?.portador).toBe("mao");
});

test("a tocha toma o lugar do ícone do suporte e o ícone volta quando ela sai", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  await ok(mestre.pagina, "ponto.criar", { ponto: suporte() });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await expect.poll(async () => (await pontosDaTela(p))[0]?.iconeVisivel).toBe(true);
  await acender(p);
  await ok(p, "tocha.posar", { id: "tocha-1", pontoId: "gancho" });
  await expect.poll(async () => (await alcas(p))[0]?.portador).toBe("ponto");
  // o ícone some e a tocha está exatamente onde ele estava
  await expect.poll(async () => (await pontosDaTela(p))[0]?.iconeVisivel).toBe(false);
  const ponto = (await pontosDaTela(p))[0] as Awaited<ReturnType<typeof pontosDaTela>>[number];
  const alca = (await alcas(p))[0] as Alca;
  expect(Math.abs(alca.x - ponto.x)).toBeLessThan(1);
  expect(Math.abs(alca.y - ponto.y)).toBeLessThan(1);
  await expect.poll(async () => (await chamas(p)).length).toBe(1);
  // o mestre vê o mesmo
  await expect.poll(async () => (await pontosDaTela(mestre.pagina))[0]?.iconeVisivel).toBe(false);

  // ela sai do suporte: o ícone volta
  await ok(p, "ponto.pegar", { id: "tocha-1", personagemId: ALDRIC });
  await expect.poll(async () => (await alcas(p))[0]?.portador).toBe("mao");
  await expect.poll(async () => (await pontosDaTela(p))[0]?.iconeVisivel).toBe(true);
  await expect.poll(async () => (await chamas(p)).length).toBe(0);
});

test("o ícone do suporte, do inflamável e a chama escalam com o zoom do mapa; o relógio some quando vira ruído", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  await ok(mestre.pagina, "ponto.criar", { ponto: suporte() });
  await ok(mestre.pagina, "ponto.criar", { ponto: suporte("gancho-2", 9.75, 9.75) });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await expect.poll(async () => (await pontosDaTela(p)).length).toBe(2);
  const raioIcone = async () =>
    (await pontosDaTela(p)).find((x) => x.id === "gancho-2")?.raioPx ?? 0;
  const cheio = await raioIcone();
  expect(cheio).toBeGreaterThan(5);
  await zoomPara(p, 0.5);
  expect(await raioIcone()).toBeCloseTo(cheio / 2, 1);
  await zoomPara(p, 2);
  expect(await raioIcone()).toBeCloseTo(cheio * 2, 1);

  // a chama de uma tocha no suporte tem tamanho de mundo
  await zoomPara(p, 1);
  await acender(p);
  await ok(p, "tocha.posar", { id: "tocha-1", pontoId: "gancho" });
  await expect.poll(async () => (await chamas(p)).length).toBe(1);
  const umaChama = async () => (await chamas(p))[0] as Awaited<ReturnType<typeof chamas>>[number];
  const l1 = (await umaChama()).larguraPx;
  const h1 = (await umaChama()).alturaPx;
  expect(l1).toBeCloseTo(0.6 * 40, 0); // 0,6 m do padrão da tocha, 40 px por metro no zoom 1
  await zoomPara(p, 0.5);
  expect((await umaChama()).larguraPx).toBeCloseTo(l1 / 2, 1);
  expect((await umaChama()).alturaPx).toBeCloseTo(h1 / 2, 1);
  // o relógio (tamanho de tela) fica enquanto dá para ler e some em zoom baixo
  await zoomPara(p, 1);
  await expect.poll(async () => (await umaChama()).rotuloVisivel).toBe(true);
  await zoomPara(p, 0.3);
  await expect.poll(async () => (await umaChama()).rotuloVisivel).toBe(false);
  // e o toque continua fácil de acertar: a área nunca é menor que o mínimo na tela
  expect(
    ((await alcas(p)).find((a) => a.portador === "ponto") as { raio: number }).raio,
  ).toBeGreaterThanOrEqual(20);
});

test("o inflamável aceso mostra a chama animada (não a tocha) e o mestre estica o tamanho, por alças e por campo", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  await ok(mestre.pagina, "ponto.criar", { ponto: lenha() });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  const m = mestre.pagina;
  await acender(p);
  await expect.poll(async () => (await pontosDaTela(p)).length).toBe(1);
  await expect.poll(async () => (await chamas(p)).length).toBe(0);
  await acenderInflamavel(p);

  for (const pagina of [p, m]) {
    await expect.poll(async () => (await chamas(pagina)).length).toBe(1);
    const c = (await chamas(pagina))[0] as Awaited<ReturnType<typeof chamas>>[number];
    expect(c).toMatchObject({ estagio: "forte", origem: "padrao", quadros: 16 });
    // 1,2 m x 1,2 m do padrão da fogueira
    expect(c.larguraPx).toBeCloseTo(48, 0);
    expect(c.alturaPx).toBeCloseTo(48, 0);
    // a chama animada toma o lugar do ícone do inflamável
    expect((await pontosDaTela(pagina))[0]?.iconeVisivel).toBe(false);
  }

  // o mestre abre o painel de luzes, seleciona o ponto e estica pela alça da direita
  await m.getByTestId("menu-iluminacao").click();
  await m.getByTestId("lanterna-fontes").click();
  const ponto = (await pontosDaTela(m))[0] as Awaited<ReturnType<typeof pontosDaTela>>[number];
  await m.mouse.click(ponto.x, ponto.y);
  await expect(m.getByTestId("ponto-editor")).toBeVisible();
  const direita = { x: ponto.x + (ponto.chamaM.larguraM / 2) * 40, y: ponto.y };
  await m.mouse.move(direita.x, direita.y);
  await m.mouse.down();
  await m.mouse.move(direita.x + 40, direita.y, { steps: 8 });
  await m.mouse.up();
  // largura = 2 x (0,6 + 1 m) = 3,2 m; a altura não muda; o jogador vê o tamanho novo
  for (const pagina of [m, p]) {
    await expect
      .poll(async () => (await pontosDaTela(pagina))[0]?.chamaM.larguraM)
      .toBeCloseTo(3.2, 1);
    await expect.poll(async () => (await chamas(pagina))[0]?.larguraPx).toBeCloseTo(128, -1);
    expect((await pontosDaTela(pagina))[0]?.chamaM.alturaM).toBeCloseTo(1.2, 2);
  }
  await expect(m.getByTestId("ponto-chama-largura")).toHaveValue(/^3[.,]2/);

  // pelo campo do painel: altura 2 m
  const altura = m.getByTestId("ponto-chama-altura");
  await altura.fill("2");
  await altura.blur();
  await expect.poll(async () => (await pontosDaTela(p))[0]?.chamaM.alturaM).toBeCloseTo(2, 2);
  await expect.poll(async () => (await chamas(p))[0]?.alturaPx).toBeCloseTo(80, -1);
  // "usar o tamanho do modelo" volta ao padrão
  await m.getByTestId("ponto-chama-padrao").click();
  await expect.poll(async () => (await pontosDaTela(p))[0]?.chamaM.larguraM).toBeCloseTo(1.2, 2);

  // o jogador não recebe nada que não veria: nem saldo nem relógio interno
  expect(
    j1.frames.filter((f) => f.includes("saldoMs") || f.includes("acesaDesdeSala")).length,
  ).toBe(0);
  // e o jogador não estica a chama do mestre
  const r = await intencao(p, "ponto.editar", {
    id: "lenha",
    mudancas: { chamaM: { larguraM: 5, alturaM: 5 } },
  });
  expect(r?.tipo).toBe("erro");
});

// Um gif de 1x1 pixel com dois quadros (preto e branco), para a animação própria de um estágio.
const GIF_DE_DOIS_QUADROS = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e,
  0x30, 0x03, 0x01, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x04, 0x0a, 0x00, 0x00, 0x00, 0x2c, 0x00,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x21, 0xf9, 0x04,
  0x04, 0x0a, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02,
  0x02, 0x4c, 0x01, 0x00, 0x3b,
]);

test("um gif próprio num estágio aparece para o mestre e para o jogador; voltar ao padrão tira", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  await preparar(mestre);
  await ok(m, "ponto.criar", { ponto: lenha() });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;

  // o mestre escolhe "Arquivo" no estágio forte da fogueira e envia o gif
  await abrirModelo(m, FOGUEIRA);
  await m.getByTestId(`modelo-anim-arquivo-input-forte-${FOGUEIRA}`).setInputFiles({
    name: "fogo-do-mestre.gif",
    mimeType: "image/gif",
    buffer: GIF_DE_DOIS_QUADROS,
  });
  await expect(m.getByTestId(`modelo-anim-escolha-forte-${FOGUEIRA}`)).toContainText(
    "fogo-do-mestre.gif",
  );

  await acender(p);
  await expect.poll(async () => (await pontosDaTela(p)).length).toBe(1);
  await acenderInflamavel(p);
  for (const pagina of [m, p]) {
    await expect.poll(async () => (await chamas(pagina)).length).toBe(1);
    // o arquivo é decodificado em dois quadros (o jogador o baixa sob demanda)
    await expect
      .poll(async () => (await chamas(pagina))[0], { timeout: 20_000 })
      .toMatchObject({ origem: "arquivo", quadros: 2, estagio: "forte" });
  }

  // "Padrão" volta à animação gerada pela mesa
  await m.getByTestId(`modelo-anim-padrao-forte-${FOGUEIRA}`).click();
  for (const pagina of [m, p]) {
    await expect
      .poll(async () => (await chamas(pagina))[0])
      .toMatchObject({ origem: "padrao", quadros: 16 });
  }
});

test("o jogador dá e tira tocha do próprio personagem, não do de outro; o mestre pode tirar a capacidade", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await abrirAba(p, "fichas");
  await p.getByTestId("aba-painel-fichas").getByText("Aldric").first().dblclick();
  const botao = p.locator(
    '[data-testid^="item-acender-"]:not([data-testid^="item-acender-usada"])',
  );
  await expect(botao.first()).toBeVisible();
  const i = ((await botao.first().getAttribute("data-testid")) ?? "").split("-").pop();
  const quantidade = p.getByTestId(`item-quantidade-${i}`);
  await expect(quantidade).toHaveValue("3");
  // A ficha manda o valor que a pessoa deixou depois de ~400 ms: espera a sala ter cada número antes do próximo passo.
  const ultimaDaTela = () =>
    j1.frames
      .filter((f) => f.includes("personagem.alterado") && !f.includes('"idPedido":"teste-'))
      .at(-1)
      ?.match(/"quantidade":(\d+)/)?.[1];
  // o + e o − valem para o jogador no personagem dele
  await expect(p.getByTestId(`item-mais-${i}`)).not.toHaveAttribute("aria-disabled", "true");
  await p.getByTestId(`item-mais-${i}`).click();
  await expect(quantidade).toHaveValue("4");
  await expect.poll(ultimaDaTela).toBe("4");
  await p.getByTestId(`item-menos-${i}`).click();
  await expect(quantidade).toHaveValue("3");
  await expect.poll(ultimaDaTela).toBe("3");
  // a mochila do Aldric aceita o ajuste do jogador (dono); a da Brisa, nunca
  await ok(p, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 2 });
  await expect(quantidade).toHaveValue("5");
  const deOutro = await intencao(p, "mochila.ajustar", {
    personagemId: BRISA,
    modeloId: TOCHA,
    delta: 1,
  });
  expect(deOutro?.tipo).toBe("erro");
  const fichaDeOutro = await intencao(p, "ficha.alterar", {
    personagemId: BRISA,
    operacoes: [{ caminho: "itens.0.quantidade", valor: 9 }],
  });
  expect(fichaDeOutro?.tipo).toBe("erro");

  // o mestre desliga a capacidade nas Permissões: o + do jogador fica desabilitado e a sala recusa
  await ok(mestre.pagina, "permissao.alterar", { capacidade: "equipamento.dar", valor: false });
  await expect(p.getByTestId(`item-mais-${i}`)).toHaveAttribute("aria-disabled", "true");
  const recusado = await intencao(p, "mochila.ajustar", {
    personagemId: ALDRIC,
    modeloId: TOCHA,
    delta: 1,
  });
  expect(recusado?.tipo).toBe("erro");
  // a capacidade aparece nas Permissões do mestre, ligada por padrão para os jogadores
  await abrirAba(mestre.pagina, "mesa");
  await expect(mestre.pagina.getByTestId("perm-padrao-equipamento.dar")).toBeVisible();
});

test("a setinha do item de modelo recolhe e expande os detalhes, com teclado, e lembra por navegador e por item", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await acender(p);
  await abrirAba(p, "fichas");
  await p.getByTestId("aba-painel-fichas").getByText("Aldric").first().dblclick();
  const botao = p.locator(
    '[data-testid^="item-acender-"]:not([data-testid^="item-acender-usada"])',
  );
  await expect(botao.first()).toBeVisible();
  const i = ((await botao.first().getAttribute("data-testid")) ?? "").split("-").pop();
  const seta = p.getByTestId(`item-seta-${i}`);
  const detalhes = p.locator(`#item-detalhes-${i}`);
  const usada = p.locator('[data-testid^="item-usada-texto-"]');

  // o padrão é aberto
  await expect(seta).toHaveAttribute("aria-expanded", "true");
  await expect(detalhes).toBeVisible();
  await expect(p.getByTestId(`item-peso-${i}`)).toBeVisible();
  await expect(usada).toBeVisible();

  // recolhido: só a linha do item (quantidade, nome e apagar)
  await seta.click();
  await expect(seta).toHaveAttribute("aria-expanded", "false");
  await expect(detalhes).toBeHidden();
  await expect(p.getByTestId(`item-peso-${i}`)).toBeHidden();
  await expect(usada).toBeHidden();
  await expect(p.getByTestId(`item-quantidade-${i}`)).toBeVisible();
  await expect(p.getByTestId(`item-nome-${i}`)).toBeVisible();
  await expect(p.getByTestId(`item-remover-${i}`)).toBeVisible();

  // o estado fica lembrado neste navegador (e só deste item)
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await abrirAba(p, "fichas");
  await p.getByTestId("aba-painel-fichas").getByText("Aldric").first().dblclick();
  await expect(p.getByTestId(`item-seta-${i}`)).toHaveAttribute("aria-expanded", "false");
  await expect(p.getByTestId(`item-peso-${i}`)).toBeHidden();

  // pelo teclado: Enter e Espaço expandem e recolhem
  const s2 = p.getByTestId(`item-seta-${i}`);
  await s2.focus();
  await p.keyboard.press("Enter");
  await expect(s2).toHaveAttribute("aria-expanded", "true");
  await expect(p.getByTestId(`item-peso-${i}`)).toBeVisible();
  await expect(usada).toBeVisible();
  await p.keyboard.press("Space");
  await expect(s2).toHaveAttribute("aria-expanded", "false");
  await p.keyboard.press("Space");
  await expect(s2).toHaveAttribute("aria-expanded", "true");
  // lembrado como aberto
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await abrirAba(p, "fichas");
  await p.getByTestId("aba-painel-fichas").getByText("Aldric").first().dblclick();
  await expect(p.getByTestId(`item-seta-${i}`)).toHaveAttribute("aria-expanded", "true");
});
