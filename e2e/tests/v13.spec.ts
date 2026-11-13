import type { Page } from "@playwright/test";
import { abrirAba, expect, menuDaCena, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa, PX_POR_M } from "./ajudasMapa";

// V13: a régua livre (sem grid), os pontos de virada com o clique direito e a unidade (metros ou pés).

type Ponto = { x: number; y: number };

/** Põe o mapa no ponto de começo e devolve onde ele está na página (um centro de quadrado da cena-1). */
async function pontoDeComeco(p: Page): Promise<Ponto> {
  return p.evaluate(() => {
    const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
    h.centrarEm(24, 24);
    return h.paraTela(24.75, 24.75);
  });
}

const emPx = (de: Ponto, dxM: number, dyM: number): Ponto => ({
  x: de.x + dxM * PX_POR_M,
  y: de.y + dyM * PX_POR_M,
});

async function arrastarRegua(p: Page, de: Ponto, dxM: number, dyM: number, alt = false) {
  await p.mouse.move(de.x, de.y);
  await p.mouse.down();
  if (alt) await p.keyboard.down("Alt");
  const fim = emPx(de, dxM, dyM);
  await p.mouse.move(fim.x, fim.y, { steps: 6 });
  await p.mouse.up();
  if (alt) await p.keyboard.up("Alt");
}

async function abrirARegua(p: Page) {
  await p.getByTestId("ferramenta-regua").click();
  await expect(p.getByTestId("painel-regua")).toBeVisible();
}

test("régua livre: o painel desliga o encaixe, a medida é em linha reta e a escolha fica lembrada", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirARegua(p);
  const grudar = p.getByTestId("regua-grudar");
  await expect(grudar).toBeChecked();
  const ini = await pontoDeComeco(p);

  // grudada (padrão): como sempre, com os quadrados
  await arrastarRegua(p, ini, 4.5, 0);
  await expect(p.getByTestId("regua-rotulo")).toHaveText("4,5 m (3 quadrados)");

  // livre: 3 m por 4 m dá 5,0 m em linha reta (nenhum encaixe de 1,5 m daria isso), sem "quadrados"
  await grudar.uncheck();
  await arrastarRegua(p, ini, 3, 4);
  await expect(p.getByTestId("regua-rotulo")).toHaveText("5,0 m");
  expect(await p.evaluate(() => localStorage.getItem("tabletop:pref:reguaGrudar"))).toBe("0");

  // a escolha vale depois de recarregar (por pessoa, neste navegador)
  await p.reload();
  await esperarMapaCarregado(p);
  await abrirARegua(p);
  await expect(p.getByTestId("regua-grudar")).not.toBeChecked();
});

async function esperarMapaCarregado(p: Page) {
  await expect(p.getByTestId("mapa")).toBeVisible();
  await expect
    .poll(() =>
      p.evaluate(() => (window as unknown as { __tabletop?: GanchoDoMapa }).__tabletop?.zoom()),
    )
    .toBeGreaterThan(0);
}

test("régua: segurar Alt inverte o encaixe na hora, nos dois sentidos", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirARegua(p);
  const ini = await pontoDeComeco(p);

  // grudada por padrão: Alt solta do grid
  await arrastarRegua(p, ini, 3, 4, true);
  await expect(p.getByTestId("regua-rotulo")).toHaveText("5,0 m");

  // livre: Alt gruda
  await p.getByTestId("regua-grudar").uncheck();
  await arrastarRegua(p, ini, 4.5, 0, true);
  await expect(p.getByTestId("regua-rotulo")).toHaveText("4,5 m (3 quadrados)");
});

test("pontos de virada: dois cliques direitos fazem três trechos, o total é a soma, Backspace tira o último ponto e nenhum menu abre", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirARegua(p);
  await p.getByTestId("regua-grudar").uncheck();
  const ini = await pontoDeComeco(p);

  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  const a = emPx(ini, 3, 0);
  await p.mouse.move(a.x, a.y, { steps: 6 });
  await p.mouse.down({ button: "right" });
  await p.mouse.up({ button: "right" });
  await expect(p.getByTestId("regua-trecho")).toHaveText(["3,0 m"]);
  const b = emPx(ini, 3, 4);
  await p.mouse.move(b.x, b.y, { steps: 6 });
  await p.mouse.down({ button: "right" });
  await p.mouse.up({ button: "right" });
  await expect(p.getByTestId("regua-trecho")).toHaveText(["3,0 m", "4,0 m"]);
  const c = emPx(ini, 6, 4);
  await p.mouse.move(c.x, c.y, { steps: 6 });

  // três trechos: 3 + 4 + 3 = 10 m
  await expect(p.getByTestId("regua-rotulo")).toHaveText("3,0 m · total 10,0 m");
  // o clique direito não abriu menu nenhum (nem o do token, nem o do navegador)
  await expect(p.getByTestId("menu-token")).toHaveCount(0);
  await expect(p.getByRole("menu")).toHaveCount(0);

  // Backspace com o botão segurado tira o último ponto de virada: sobram dois trechos
  await p.keyboard.press("Backspace");
  await expect(p.getByTestId("regua-trecho")).toHaveText(["3,0 m"]);
  await expect(p.getByTestId("regua-rotulo")).toHaveText("5,0 m · total 8,0 m");

  // soltar com Shift fixa a medida com os pontos e o total
  await p.keyboard.down("Shift");
  await p.mouse.up();
  await p.keyboard.up("Shift");
  await expect(p.getByTestId("regua-fixa-rotulo")).toHaveText("5,0 m · total 8,0 m");
  await expect(p.getByTestId("regua-fixa-trecho")).toHaveText(["3,0 m"]);
  await expect(p.getByTestId("regua-rotulo")).toHaveCount(0);

  // Esc tira tudo, inclusive os rótulos dos pontos
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("regua-fixa-rotulo")).toHaveCount(0);
  await expect(p.getByTestId("regua-fixa-trecho")).toHaveCount(0);

  // a régua continua só local: nada foi enviado para a sala
  expect(mestre.enviados.filter((f) => /"tipo":"(mapa|token|regua)\./.test(f))).toEqual([]);
});

test("grudada, o ponto de virada encaixa e o total soma os trechos", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirARegua(p);
  const ini = await pontoDeComeco(p);

  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  const a = emPx(ini, 3, 0);
  await p.mouse.move(a.x, a.y, { steps: 6 });
  await p.mouse.down({ button: "right" });
  await p.mouse.up({ button: "right" });
  const b = emPx(ini, 3, 4.5);
  await p.mouse.move(b.x, b.y, { steps: 6 });
  await expect(p.getByTestId("regua-trecho")).toHaveText(["3,0 m (2 quadrados)"]);
  await expect(p.getByTestId("regua-rotulo")).toHaveText(
    "4,5 m (3 quadrados) · total 7,5 m (5 quadrados)",
  );
  await p.mouse.up();
});

test("a preferência em pés: 5 pés em um quadrado, e o campo do Configurar cena muda de unidade", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const quadrado = await p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.quadradoM(),
  );
  await abrirAba(p, "preferencias");
  await expect(p.getByTestId("pref-unidade-m")).toHaveAttribute("aria-pressed", "true");
  await p.getByTestId("pref-unidade-pes").click();
  await expect(p.getByTestId("pref-unidade-pes")).toHaveAttribute("aria-pressed", "true");
  expect(await p.evaluate(() => localStorage.getItem("tabletop:pref:unidade"))).toBe("pes");

  await abrirARegua(p);
  const ini = await pontoDeComeco(p);
  await arrastarRegua(p, ini, quadrado, 0);
  await expect(p.getByTestId("regua-rotulo")).toHaveText(
    `${Math.round(quadrado / 0.3)} pés (1 quadrado)`,
  );
  // um quadrado de 1,5 m é de 5 pés (a conversão do D&D em português)
  expect(quadrado).toBe(1.5);
  await expect(p.getByTestId("regua-rotulo")).toHaveText("5 pés (1 quadrado)");

  // Configurar cena: o rótulo e o valor passam para pés, mas o que vai para a sala é em metros
  await p.keyboard.press("v");
  await menuDaCena(p, "cena-1", "configurar");
  const dialogo = p.getByTestId("configurar-cena");
  await expect(dialogo.getByTestId("cfg-grid")).toContainText("Quadrado (pés)");
  await expect(dialogo.getByTestId("grid-quadrado")).toHaveValue("5");
  await dialogo.getByTestId("grid-quadrado").fill("10");
  await dialogo.getByTestId("cfg-salvar").click();
  await expect(dialogo).toHaveCount(0);
  await expect
    .poll(() =>
      p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.quadradoM()),
    )
    .toBe(3);
  expect(mestre.enviados.find((f) => f.includes('"cena.configurarGrid"'))).toContain(
    '"quadradoM":3',
  );
});
