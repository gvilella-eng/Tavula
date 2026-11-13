import type { APIRequestContext, Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa } from "./ajudasMapa";

// Ajustes V1 (2026-11-11): temas com personalidade (Edgerunner, Élfico e Celestial novos; o antigo Edgerunner virou
// Masmorra, id `escuro`), a aba Mesa no fim e "Zerar o relógio" da pílula do mestre. A ordem e os nomes dos 14 temas
// e o `escuro` guardado virando Masmorra estão em `tema.spec.ts`.

const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";

const FUNDO_V1: Record<string, string> = {
  edgerunner: "rgb(11, 9, 18)",
  elfico: "rgb(217, 231, 213)",
  celestial: "rgb(220, 231, 246)",
};

test("Edgerunner, Élfico e Celestial aplicam as cores e sobrevivem ao recarregar", async ({
  mesa,
}) => {
  const m = await mesa.entrar("mestre");
  const p = m.pagina;
  await abrirPreferencia(p, "aparencia");
  for (const id of ["edgerunner", "elfico", "celestial"] as const) {
    await p.getByTestId(`tema-${id}`).click();
    await expect(p.locator("html")).toHaveAttribute("data-tema", id);
    await expect(p.locator("body")).toHaveCSS("background-color", FUNDO_V1[id] as string);
    await expect(p.getByTestId(`tema-selo-${id}`)).toBeVisible();
    // os claros novos pedem controles claros do navegador; o Edgerunner, escuros
    await expect(p.locator("html")).toHaveCSS(
      "color-scheme",
      id === "edgerunner" ? "dark" : "light",
    );
    await p.reload();
    await expect(p.getByTestId("eu-nome")).toBeVisible();
    await expect(p.locator("html")).toHaveAttribute("data-tema", id);
    await expect(p.locator("body")).toHaveCSS("background-color", FUNDO_V1[id] as string);
    await abrirPreferencia(p, "aparencia");
    await expect(p.getByTestId(`tema-${id}`)).toBeChecked();
  }
  // o acento do Edgerunner é o verde neon, não o dourado do Grimório
  await p.getByTestId("tema-edgerunner").click();
  const acento = await p.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--acento").trim().toUpperCase(),
  );
  expect(acento).toBe("#2DF08B");
});

test("a aba Mesa é a última, só do mestre, também com o painel recolhido", async ({ mesa }) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");
  const abas = async (p: Page) =>
    Promise.all((await p.getByRole("tab").all()).map((a) => a.getAttribute("data-testid")));
  const doMestre = ["aba-chat", "aba-fichas", "aba-compendio", "aba-preferencias", "aba-mesa"];
  expect(await abas(m.pagina)).toEqual(doMestre);
  expect(await abas(j.pagina)).toEqual(doMestre.slice(0, -1));
  await expect(j.pagina.getByTestId("aba-mesa")).toHaveCount(0);

  // a Mesa continua abrindo a aba do mestre e o jogador nunca recebe o painel dela
  await abrirAba(m.pagina, "mesa");
  await expect(m.pagina.getByTestId("aba-mesa")).toHaveAttribute("aria-selected", "true");
  await expect(j.pagina.getByTestId("aba-painel-mesa")).toHaveCount(0);

  // painel recolhido: as abas continuam na mesma ordem (a Mesa por último) e a Mesa abre de novo o painel
  await m.pagina.getByTestId("lateral-recolher").click();
  await expect(m.pagina.getByTestId("aba-painel-mesa")).toBeHidden();
  expect(await abas(m.pagina)).toEqual(doMestre);
  await m.pagina.getByTestId("aba-mesa").click();
  await expect(m.pagina.getByTestId("aba-painel-mesa")).toBeVisible();
});

async function intencao(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

const alcas = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas());

/** "12:34" → segundos. */
const segundos = (rotulo: string) =>
  rotulo
    .trim()
    .split(":")
    .map(Number)
    .reduce((total, n) => total * 60 + n, 0);

async function adiantar(request: APIRequestContext, ms: number) {
  const r = await request.post(`/teste/avancar-relogio?ms=${ms}`);
  expect(r.ok()).toBe(true);
}

const pilula = async (p: Page) =>
  segundos((await p.getByTestId("relogio-sala").textContent()) ?? "");

async function zerar(p: Page) {
  await p.getByTestId("menu-relogio").click();
  await p.getByTestId("zerar-relogio").click();
  await expect(p.getByTestId("zerar-relogio-confirmacao")).toContainText(
    "Zerar o relógio da mesa? As tochas não mudam.",
  );
  await p.getByTestId("zerar-relogio-confirmar").click();
  await expect(p.getByTestId("menu-relogio-lista")).toHaveCount(0);
}

test("zerar o relógio: 00:00, volta a contar, a tocha acesa mantém o tempo e o jogador não recebe nada", async ({
  mesa,
  request,
}) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");
  await intencao(m.pagina, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 2 });
  await intencao(m.pagina, "tocha.acender", {
    personagemId: ALDRIC,
    modeloId: TOCHA,
    novoId: "tocha-v1",
  });
  await expect.poll(async () => (await alcas(j.pagina)).length).toBe(1);

  // o jogador não tem o menu do relógio
  await expect(j.pagina.getByTestId("menu-relogio")).toHaveCount(0);

  await adiantar(request, 125_000); // 2 min 05 s
  await expect.poll(() => pilula(m.pagina)).toBeGreaterThanOrEqual(125);
  const tochaAntes = segundos(((await alcas(j.pagina))[0] as { rotulo: string }).rotulo);
  const framesAntes = j.frames.length;

  // a confirmação tem Cancelar: nada muda
  await m.pagina.getByTestId("menu-relogio").click();
  await m.pagina.getByTestId("zerar-relogio").click();
  await m.pagina.getByTestId("zerar-relogio-cancelar").click();
  await expect(m.pagina.getByTestId("zerar-relogio")).toBeVisible();
  expect(await pilula(m.pagina)).toBeGreaterThanOrEqual(125);
  await m.pagina.keyboard.press("Escape");
  await expect(m.pagina.getByTestId("menu-relogio-lista")).toHaveCount(0);

  await zerar(m.pagina);
  await expect.poll(() => pilula(m.pagina)).toBeLessThanOrEqual(3);
  // volta a contar a partir de zero
  await adiantar(request, 30_000);
  await expect.poll(() => pilula(m.pagina)).toBeGreaterThanOrEqual(30);
  await expect.poll(() => pilula(m.pagina)).toBeLessThan(45);

  // a tocha acesa não foi mexida: só passaram os 30 s adiantados (mais o tempo real do teste)
  const tochaDepois = segundos(((await alcas(j.pagina))[0] as { rotulo: string }).rotulo);
  expect(tochaAntes - tochaDepois).toBeGreaterThanOrEqual(28);
  expect(tochaAntes - tochaDepois).toBeLessThanOrEqual(45);

  // o marco sobrevive ao recarregar (a sala o guarda), e continua pequeno
  await m.pagina.reload();
  await expect(m.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await expect.poll(() => pilula(m.pagina)).toBeGreaterThanOrEqual(30);
  expect(await pilula(m.pagina)).toBeLessThan(60);

  // o jogador: nenhum frame novo trouxe o marco ou o evento; recarregar e receber o snapshot também não
  await j.pagina.reload();
  await expect(j.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  const novos = j.frames.slice(framesAntes).join("\n");
  expect(novos).not.toContain("mesa.relogioZerado");
  expect(novos).not.toContain("marcoMs");
  expect(j.frames.join("\n")).not.toContain("marcoMs");
});

test("zerar com a mesa pausada: continua pausada em 00:00 e ao retomar conta de novo do zero", async ({
  mesa,
  request,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  await adiantar(request, 90_000);
  await expect.poll(() => pilula(m)).toBeGreaterThanOrEqual(90);
  await m.getByTestId("menu-pausa").click();
  await expect(m.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "true");

  await zerar(m);
  await expect(m.getByTestId("relogio-sala")).toHaveText("00:00");
  await expect(m.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "true");
  // pausada, o tempo não anda
  await adiantar(request, 0);
  await expect(m.getByTestId("relogio-sala")).toHaveText("00:00");

  await m.getByTestId("menu-pausa").click();
  await expect(m.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "false");
  await adiantar(request, 20_000);
  await expect.poll(() => pilula(m)).toBeGreaterThanOrEqual(20);
  await expect.poll(() => pilula(m)).toBeLessThan(40);
});

test("o menu do relógio se usa só pelo teclado e a dica dá o nome", async ({ mesa }) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  const gatilho = m.getByTestId("menu-relogio");
  await expect(gatilho).toHaveAccessibleName("Opções do relógio");
  await gatilho.focus();
  await expect(m.getByTestId("dica-menu-relogio")).toHaveText("Opções do relógio");
  await m.keyboard.press("Enter");
  await expect(m.getByTestId("zerar-relogio")).toBeFocused();
  await m.keyboard.press("Enter");
  await expect(m.getByTestId("zerar-relogio-confirmar")).toBeFocused();
  // Esc fecha e devolve o foco ao botão do menu
  await m.keyboard.press("Escape");
  await expect(m.getByTestId("menu-relogio-lista")).toHaveCount(0);
  await expect(gatilho).toBeFocused();
  // de novo, e confirma pelo teclado
  await m.keyboard.press("Enter");
  await m.keyboard.press("Enter");
  await m.keyboard.press("Enter");
  await expect(m.getByTestId("menu-relogio-lista")).toHaveCount(0);
  await expect.poll(() => pilula(m)).toBeLessThanOrEqual(3);
});
