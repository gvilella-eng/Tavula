import { abrirAba, expect, test, USUARIOS } from "./ajudas";

// Redesign R1: marca Távola, tela de entrada nova, temas de cor por navegador e nenhuma requisição de
// rede para fora (as fontes são empacotadas).

const FUNDO = {
  grimorio: "rgb(12, 12, 12)",
  escuro: "rgb(15, 17, 21)",
  claro: "rgb(239, 235, 228)",
};
const PAINEL = {
  grimorio: "rgb(37, 37, 37)",
  escuro: "rgb(40, 44, 51)",
  claro: "rgb(255, 255, 255)",
};

test("a tela de entrada tem a marca Távola, a frase, o selo do mestre e os 8 usuários", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Távola");
  await expect(page.getByTestId("logo")).toBeVisible();
  await expect(page.getByTestId("logo")).toContainText("Távola");
  await expect(page.getByText("Quem senta à mesa hoje?")).toBeVisible();
  for (const id of USUARIOS) await expect(page.getByTestId(`entrar-${id}`)).toBeVisible();
  await expect(page.getByTestId("lista-usuarios").locator("li")).toHaveCount(8);
  // o selo "Mestre" só no mestre
  await expect(page.locator(".selo-mestre")).toHaveCount(1);
  await expect(page.getByTestId("entrar-mestre").locator(".selo-mestre")).toHaveText("Mestre");
  // o avatar mostra as iniciais
  await expect(page.getByTestId("entrar-jogador-3").locator(".avatar-entrada")).toHaveText("J3");
  // tema padrão: Grimório
  await expect(page.locator("html")).toHaveAttribute("data-tema", "grimorio");
  await expect(page.locator("body")).toHaveCSS("background-color", FUNDO.grimorio);
});

test("com a mesa aberta o título da aba é Távola · nome da cena", async ({ mesa }) => {
  const m = await mesa.entrar("mestre");
  await expect(m.pagina).toHaveTitle(/^Távola · .+/);
  await expect(m.pagina).not.toHaveTitle(/Tabletop/);
});

test("trocar o tema muda as cores, sobrevive ao recarregar e não manda nada para a sala", async ({
  mesa,
}) => {
  const m = await mesa.entrar("mestre");
  const p = m.pagina;
  await abrirAba(p, "preferencias");
  await expect(p.getByTestId("seletor-de-tema")).toBeVisible();
  await expect(p.getByTestId("tema-grimorio")).toBeChecked();
  await expect(p.locator("body")).toHaveCSS("background-color", FUNDO.grimorio);

  // espera a sala assentar (mensagens do início da conexão) antes de contar os frames
  let anterior = -1;
  await expect
    .poll(async () => {
      const agora = m.frames.length + m.enviados.length;
      const estavel = agora === anterior;
      anterior = agora;
      await p.waitForTimeout(700);
      return estavel;
    })
    .toBe(true);
  // A sala também manda, por conta própria, a presença (quem expirou de um teste anterior) e o uso do dia:
  // nada disso tem a ver com o tema, então só contam os outros frames recebidos.
  const proprios = (f: string) => !/"tipo":"(presenca|uso)"/.test(f);
  const enviados = m.enviados.length;
  const recebidos = m.frames.filter(proprios).length;
  for (const id of ["claro", "escuro", "claro"] as const) {
    await p.getByTestId(`tema-${id}`).click();
    await expect(p.locator("html")).toHaveAttribute("data-tema", id);
    await expect(p.locator("body")).toHaveCSS("background-color", FUNDO[id]);
    const painel = await p.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--painel").trim(),
    );
    expect(painel.toUpperCase()).toBe(
      { claro: "#FFFFFF", escuro: "#282C33", grimorio: "#252525" }[id],
    );
    expect(PAINEL[id]).toBeTruthy();
  }
  await p.waitForTimeout(500);
  expect(m.enviados.length).toBe(enviados);
  expect(m.frames.filter(proprios).length).toBe(recebidos);

  // guardado no navegador e aplicado de novo ao recarregar, sem passar pelo tema padrão
  expect(await p.evaluate(() => localStorage.getItem("tabletop:pref:tema"))).toBe("claro");
  await p.reload();
  await expect(p.getByTestId("eu-nome")).toBeVisible();
  await expect(p.locator("html")).toHaveAttribute("data-tema", "claro");
  await expect(p.locator("body")).toHaveCSS("background-color", FUNDO.claro);
  await abrirAba(p, "preferencias");
  await expect(p.getByTestId("tema-claro")).toBeChecked();
});

test("o tema é por navegador: outro usuário continua no dele", async ({ mesa }) => {
  const a = await mesa.entrar("mestre");
  const b = await mesa.entrar("jogador-1");
  await abrirAba(a.pagina, "preferencias");
  await a.pagina.getByTestId("tema-escuro").click();
  await expect(a.pagina.locator("html")).toHaveAttribute("data-tema", "escuro");
  await a.pagina.waitForTimeout(400);
  await expect(b.pagina.locator("html")).toHaveAttribute("data-tema", "grimorio");
  await expect(b.pagina.locator("body")).toHaveCSS("background-color", FUNDO.grimorio);
  // o jogador troca o dele sem mexer no do mestre
  await abrirAba(b.pagina, "preferencias");
  await b.pagina.getByTestId("tema-claro").click();
  await expect(b.pagina.locator("html")).toHaveAttribute("data-tema", "claro");
  await expect(a.pagina.locator("html")).toHaveAttribute("data-tema", "escuro");
});

test("nenhuma requisição sai para fora de 127.0.0.1 e as fontes são as empacotadas", async ({
  mesa,
}) => {
  const externas: string[] = [];
  const s = await mesa.abrir();
  s.contexto.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol === "data:" || u.protocol === "blob:") return;
    if (u.hostname !== "127.0.0.1") externas.push(r.url());
  });
  await s.pagina.goto("/");
  await expect(s.pagina.getByTestId("logo")).toBeVisible();
  await s.pagina.getByTestId("entrar-mestre").click();
  await expect(s.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await abrirAba(s.pagina, "preferencias");
  await s.pagina.getByTestId("tema-claro").click();
  await s.pagina.evaluate(() => document.fonts.ready);
  // as duas fontes variáveis carregaram (vieram do próprio servidor)
  const carregadas = await s.pagina.evaluate(() =>
    [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
  );
  expect(carregadas.join(" ")).toContain("Space Grotesk Variable");
  expect(carregadas.join(" ")).toContain("Inter Variable");
  expect(externas).toEqual([]);
});

// Redesign R2b (11 temas) e V1 (14 temas: os três padrão, os escuros com personalidade e os claros novos),
// escolhidos por bolinhas.

const IDS = [
  "grimorio",
  "escuro",
  "claro",
  "edgerunner",
  "vampiro",
  "licantropo",
  "taverna",
  "forja",
  "paladino",
  "druida",
  "leviata",
  "arcana",
  "elfico",
  "celestial",
] as const;
const NOMES = [
  "Grimório",
  "Masmorra",
  "Pergaminho",
  "Edgerunner",
  "Vampiro",
  "Licantropo",
  "Taverna",
  "Forja",
  "Paladino",
  "Druida",
  "Leviatã",
  "Arcana",
  "Élfico",
  "Celestial",
];
const FUNDO_NOVOS: Record<string, string> = {
  taverna: "rgb(16, 11, 7)",
  forja: "rgb(13, 12, 11)",
  paladino: "rgb(10, 14, 29)",
  vampiro: "rgb(10, 4, 5)",
};

test("o seletor é um grupo de rádio com 14 bolinhas, nome embaixo e selo no escolhido", async ({
  mesa,
}) => {
  const m = await mesa.entrar("mestre");
  const p = m.pagina;
  await abrirAba(p, "preferencias");
  const seletor = p.getByTestId("seletor-de-tema");
  await expect(seletor).toHaveAttribute("role", "radiogroup");
  await expect(seletor).toHaveAttribute("aria-label", "Tema de cor");
  await expect(seletor.getByRole("radio")).toHaveCount(14);
  await expect(seletor.locator(".nome-do-tema")).toHaveText(NOMES);
  for (const [i, id] of IDS.entries()) {
    await expect(p.getByTestId(`tema-${id}`)).toHaveAccessibleName(NOMES[i] as string);
  }
  // o padrão é o Grimório, com o selo de check só nele
  await expect(p.getByTestId("tema-grimorio")).toBeChecked();
  await expect(seletor.locator(".bolinha-selo")).toHaveCount(1);
  await expect(p.getByTestId("tema-selo-grimorio")).toBeVisible();
  // a bolinha: em cima a `amostra` do tema (a cor viva; a barra é quase preta), embaixo o destaque e o corpo
  // das janelas (R3: antes a metade de cima usava a barra, rgb(27, 27, 27) no Grimório)
  const barra = await p.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--barra").trim().toUpperCase(),
  );
  expect(barra).toBe("#1B1B1B");
  await expect(seletor.locator(".opcao-de-tema").first().locator(".bolinha-barra")).toHaveCSS(
    "background-color",
    "rgb(74, 74, 74)",
  );
  // o nome está à vista (V3b: sem dica nem title onde o nome já aparece)
  await expect(seletor.locator(".opcao-de-tema").nth(6)).toContainText("Taverna");
  await expect(seletor.locator(".opcao-de-tema").nth(6)).not.toHaveAttribute("title", /.+/);
});

test("teclado: as setas andam pelos temas e escolhem", async ({ mesa }) => {
  const m = await mesa.entrar("mestre");
  const p = m.pagina;
  await abrirAba(p, "preferencias");
  await p.getByTestId("tema-grimorio").focus();
  await p.keyboard.press("ArrowRight");
  await expect(p.getByTestId("tema-escuro")).toBeChecked();
  await expect(p.locator("html")).toHaveAttribute("data-tema", "escuro");
  await p.keyboard.press("ArrowRight");
  await expect(p.getByTestId("tema-claro")).toBeChecked();
  await p.keyboard.press("ArrowLeft");
  await expect(p.getByTestId("tema-escuro")).toBeChecked();
});

test("escolher temas novos pelo seletor muda as cores e sobrevive ao recarregar", async ({
  mesa,
}) => {
  const m = await mesa.entrar("mestre");
  const p = m.pagina;
  await abrirAba(p, "preferencias");
  for (const id of ["taverna", "forja", "paladino", "vampiro"] as const) {
    await p.getByTestId(`tema-${id}`).click();
    await expect(p.locator("html")).toHaveAttribute("data-tema", id);
    await expect(p.locator("body")).toHaveCSS("background-color", FUNDO_NOVOS[id] as string);
    await expect(p.getByTestId(`tema-selo-${id}`)).toBeVisible();
    await expect(p.getByTestId("seletor-de-tema").locator(".bolinha-selo")).toHaveCount(1);
  }
  expect(await p.evaluate(() => localStorage.getItem("tabletop:pref:tema"))).toBe("vampiro");
  await p.reload();
  await expect(p.getByTestId("eu-nome")).toBeVisible();
  await expect(p.locator("html")).toHaveAttribute("data-tema", "vampiro");
  await expect(p.locator("body")).toHaveCSS("background-color", FUNDO_NOVOS.vampiro as string);
  await abrirAba(p, "preferencias");
  await expect(p.getByTestId("tema-vampiro")).toBeChecked();
});

test("quem tinha escuro ou claro guardado continua nele", async ({ mesa }) => {
  for (const [id, fundo] of [
    ["escuro", FUNDO.escuro],
    ["claro", FUNDO.claro],
  ] as const) {
    const s = await mesa.abrir();
    await s.pagina.addInitScript((v) => localStorage.setItem("tabletop:pref:tema", v), id);
    await s.pagina.goto("/");
    await expect(s.pagina.locator("html")).toHaveAttribute("data-tema", id);
    await expect(s.pagina.locator("body")).toHaveCSS("background-color", fundo);
    await s.pagina.getByTestId("entrar-mestre").click();
    await expect(s.pagina.getByTestId("eu-nome")).toBeVisible();
    await abrirAba(s.pagina, "preferencias");
    await expect(s.pagina.getByTestId(`tema-${id}`)).toBeChecked();
    // os nomes novos aparecem, o id continua o mesmo
    await expect(s.pagina.getByTestId(`tema-${id}`)).toHaveAccessibleName(
      id === "escuro" ? "Masmorra" : "Pergaminho",
    );
  }
});

test("um valor guardado que não é tema é ignorado (cai no Grimório)", async ({ mesa }) => {
  const s = await mesa.abrir();
  await s.pagina.addInitScript(() => localStorage.setItem("tabletop:pref:tema", "inexistente"));
  await s.pagina.goto("/");
  await expect(s.pagina.locator("html")).toHaveAttribute("data-tema", "grimorio");
});

test("o seletor cabe no painel de 300 px sem rolar de lado", async ({ mesa }) => {
  const m = await mesa.entrar("mestre");
  const p = m.pagina;
  await p.setViewportSize({ width: 1280, height: 720 });
  await abrirAba(p, "preferencias");
  const alca = p.getByTestId("alca-do-painel");
  await alca.focus();
  await p.keyboard.press("Home");
  const seletor = p.getByTestId("seletor-de-tema");
  await expect(seletor).toBeVisible();
  const sobra = await seletor.evaluate((el) => {
    const painel = el.closest("[data-testid='barra-lateral']") ?? document.body;
    return {
      caixa: el.getBoundingClientRect().right <= painel.getBoundingClientRect().right + 0.5,
      scroll: painel.scrollWidth <= painel.clientWidth + 1,
    };
  });
  expect(sobra).toEqual({ caixa: true, scroll: true });
  await expect(seletor.getByRole("radio")).toHaveCount(14);
});

test("as bolinhas dos temas escuros têm a metade de cima viva e todas diferentes (Druida, Leviatã, Licantropo e Paladino se distinguem)", async ({
  mesa,
}) => {
  const m = await mesa.entrar("mestre");
  const p = m.pagina;
  await abrirAba(p, "preferencias");
  const ids = [...IDS];
  const cores: Record<string, number[]> = {};
  const barras: Record<string, number[]> = {};
  const rgb = (css: string) => (css.match(/[0-9]+/g) ?? []).slice(0, 3).map(Number);
  for (const id of ids) {
    const bolinha = p.getByTestId(`tema-${id}`).locator("xpath=..").locator(".bolinha-barra");
    cores[id] = rgb(await bolinha.evaluate((e) => getComputedStyle(e).backgroundColor));
  }
  const distancia = (a: number[], b: number[]) =>
    Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      expect(
        distancia(cores[ids[i] as string] as number[], cores[ids[j] as string] as number[]),
        `${ids[i]} x ${ids[j]}`,
      ).toBeGreaterThan(40);
    }
  }
  // cada uma é bem mais clara/viva que a barra quase preta do tema escuro (a do Grimório é #1B1B1B)
  barras.grimorio = [27, 27, 27];
  for (const id of ["licantropo", "paladino", "druida", "leviata", "edgerunner", "arcana"]) {
    expect(distancia(cores[id] as number[], barras.grimorio), id).toBeGreaterThan(60);
  }
});
