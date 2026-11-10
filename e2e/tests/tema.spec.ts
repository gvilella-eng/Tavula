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
  await abrirAba(p, "configuracoes");
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
  await abrirAba(p, "configuracoes");
  await expect(p.getByTestId("tema-claro")).toBeChecked();
});

test("o tema é por navegador: outro usuário continua no dele", async ({ mesa }) => {
  const a = await mesa.entrar("mestre");
  const b = await mesa.entrar("jogador-1");
  await abrirAba(a.pagina, "configuracoes");
  await a.pagina.getByTestId("tema-escuro").click();
  await expect(a.pagina.locator("html")).toHaveAttribute("data-tema", "escuro");
  await a.pagina.waitForTimeout(400);
  await expect(b.pagina.locator("html")).toHaveAttribute("data-tema", "grimorio");
  await expect(b.pagina.locator("body")).toHaveCSS("background-color", FUNDO.grimorio);
  // o jogador troca o dele sem mexer no do mestre
  await abrirAba(b.pagina, "configuracoes");
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
  await abrirAba(s.pagina, "configuracoes");
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
