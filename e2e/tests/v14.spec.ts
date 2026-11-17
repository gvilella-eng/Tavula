import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, expect, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "./ajudasMapa";

// V14: o tipo de parede como lista com ícones, Exportar e Importar em dois blocos, a lista de atalhos enxuta, o
// rótulo da régua sempre dentro do mapa e os campos de raio em pés.

const gancho = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paredes());

test("tipo de parede: lista com ícone, nome e amostra; as setas mudam o tipo e a nova parede sai como porta", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const antes = (await gancho(p)).length;
  await p.getByTestId("ferramenta-paredes").click();
  await expect(p.getByTestId("painel-paredes")).toBeVisible();

  const grupo = p.getByTestId("parede-tipos");
  await expect(grupo).toHaveAttribute("role", "radiogroup");
  for (const [tipo, nome] of [
    ["parede", "Parede"],
    ["porta", "Porta"],
    ["janela", "Janela"],
    ["secreta", "Secreta"],
    ["invisivel", "Invisível"],
  ] as const) {
    const linha = grupo.locator("label", { has: p.getByTestId(`parede-novo-${tipo}`) });
    await expect(linha).toContainText(nome);
    await expect(linha.locator("svg").first()).toBeVisible(); // o ícone
    await expect(linha.locator("svg.tipo-de-parede-amostra")).toBeVisible(); // a amostra do traço
  }
  // Parede é o padrão; a linha ativa fica destacada
  await expect(p.getByTestId("parede-novo-parede")).toBeChecked();
  await expect(grupo.locator("label[data-ativo='true']")).toHaveCount(1);

  // as setas mudam o tipo (rádios nativos)
  await p.getByTestId("parede-novo-parede").focus();
  await p.keyboard.press("ArrowDown");
  await expect(p.getByTestId("parede-novo-porta")).toBeChecked();
  await expect(p.getByTestId("parede-novo-porta")).toBeFocused();
  await p.keyboard.press("ArrowDown");
  await expect(p.getByTestId("parede-novo-janela")).toBeChecked();
  await p.keyboard.press("ArrowUp");
  await expect(p.getByTestId("parede-novo-porta")).toBeChecked();

  // desenhar com Porta escolhida cria uma porta
  await p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(45, 5),
  );
  const a = await pontoNaPagina(p, 42, 6);
  const b = await pontoNaPagina(p, 48, 6);
  await p.mouse.click(a.x, a.y);
  await p.mouse.dblclick(b.x, b.y);
  await expect.poll(async () => (await gancho(p)).length).toBe(antes + 1);
  const criada = mestre.enviados.filter((f) => f.includes('"parede.criar"')).at(-1) ?? "";
  expect(criada).toContain('"tipo":"porta"');
});

test("Exportar e Importar: dois blocos; escolher mostra o nome e o resumo; Cancelar não troca nada; confirmar importa", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "mesa");
  const exportar = p.getByTestId("campanha-exportar-bloco");
  const importar = p.getByTestId("campanha-importar-bloco");
  await expect(exportar.getByRole("heading", { name: "Exportar" })).toBeVisible();
  await expect(importar.getByRole("heading", { name: "Importar" })).toBeVisible();
  await expect(exportar).toContainText("Baixa um arquivo com a mesa inteira");
  await expect(exportar).toContainText("senhas");
  await expect(importar).toContainText("Troca a mesa atual pelo conteúdo de um arquivo exportado.");
  await expect(p.getByTestId("exportar")).toHaveText("Exportar campanha");
  await expect(p.getByTestId("importar-escolher")).toHaveText("Escolher arquivo…");
  // nada escolhido ainda: nem nome, nem confirmação
  await expect(p.getByTestId("importar-escolhido")).toHaveCount(0);

  const [download] = await Promise.all([
    p.waitForEvent("download"),
    p.getByTestId("exportar").click(),
  ]);
  const conteudo = readFileSync(await download.path());
  const cenas = (JSON.parse(conteudo.toString("utf8")).dados.cenas as unknown[]).length;
  const arquivo = { name: "minha-mesa.json", mimeType: "application/json", buffer: conteudo };

  // escolher: o nome e o resumo aparecem, com o aviso e os dois botões; nada foi enviado
  await p.getByTestId("importar-arquivo").setInputFiles(arquivo);
  await expect(p.getByTestId("importar-nome")).toHaveText("minha-mesa.json");
  await expect(p.getByTestId("importar-resumo")).toContainText(`${cenas} cena`);
  await expect(p.getByTestId("importar-resumo")).toContainText("ficha");
  await expect(p.getByTestId("importar-resumo")).toContainText("token");
  await expect(p.getByTestId("importar-aviso")).toHaveText(
    "Isto troca a mesa atual. Exporte antes, se quiser guardar.",
  );
  await expect(p.getByTestId("importar-confirmar")).toHaveText("Importar e substituir");
  expect(mestre.enviados.some((f) => f.includes('"campanha.importar"'))).toBe(false);

  // Cancelar: some, e nada trocou
  await p.getByTestId("importar-cancelar").click();
  await expect(p.getByTestId("importar-escolhido")).toHaveCount(0);
  expect(mestre.enviados.some((f) => f.includes('"campanha.importar"'))).toBe(false);

  // confirmar: importa (o próprio arquivo exportado)
  await p.getByTestId("importar-arquivo").setInputFiles(arquivo);
  await p.getByTestId("importar-confirmar").click();
  await expect(p.getByTestId("importar-escolhido")).toHaveCount(0);
  await expect
    .poll(() => mestre.enviados.filter((f) => f.includes('"campanha.importar"')).length)
    .toBe(1);
});

test("atalhos: Os mais usados aberta, as outras seções recolhidas e se abrem", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirPreferencia(p, "atalhos");
  const lista = p.getByTestId("atalhos");
  await lista.scrollIntoViewIfNeeded();
  await expect(lista).toContainText("Os atalhos recolhidos servem para usar tudo pelo teclado.");
  const usados = p.getByTestId("atalhos-mais-usados");
  await expect(usados).toHaveJSProperty("open", true);
  await expect(usados).toContainText("Os mais usados");
  // ping, régua e setas do token estão à vista
  for (const id of ["pingar", "pontoDaRegua", "andarToken", "tirarToken", "arrastarVista"]) {
    await expect(p.getByTestId(`atalho-${id}`)).toBeVisible();
  }
  for (const grupo of ["Menus", "Janelas e painéis", "Campos"]) {
    const secao = p.getByTestId(`atalhos-grupo-${grupo}`);
    await expect(secao).toHaveJSProperty("open", false);
    await secao.locator("summary").click();
    await expect(secao).toHaveJSProperty("open", true);
    await expect(secao.locator("dt").first()).toBeVisible();
  }
  await expect(p.getByTestId("atalho-menuAtivar")).toHaveCount(0);
  await expect(p.getByTestId("atalho-chatHistorico")).toBeVisible();
});

async function emPes(p: Page) {
  await abrirPreferencia(p, "mapa");
  await p.getByTestId("pref-unidade-pes").click();
  await expect(p.getByTestId("pref-unidade-pes")).toHaveAttribute("aria-pressed", "true");
}

test("régua perto da borda direita e do zoom: os rótulos ficam inteiros dentro da área do mapa", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await emPes(p);
  await p.getByTestId("ferramenta-regua").click();
  const area = await p.getByTestId("area-do-mapa").boundingBox();
  if (!area) throw new Error("sem área do mapa");
  const direita = area.x + area.width;

  // a medida termina colada na borda direita, com um ponto de virada antes: "trecho · total"
  const y = area.y + area.height * 0.4;
  const ini = { x: direita - 230, y };
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  await p.mouse.move(ini.x + 60, y, { steps: 5 });
  await p.mouse.down({ button: "right" });
  await p.mouse.up({ button: "right" });
  await p.mouse.move(direita - 12, y + 40, { steps: 8 });
  const rotulo = p.getByTestId("regua-rotulo");
  await expect(rotulo).toContainText("pé");
  await expect(rotulo).toContainText("total");
  const caixa = await rotulo.boundingBox();
  if (!caixa) throw new Error("sem rótulo");
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(direita);
  expect(caixa.x).toBeGreaterThanOrEqual(area.x);
  // o rótulo do trecho, no ponto de virada, também está dentro
  const trecho = await p.getByTestId("regua-trecho").boundingBox();
  if (!trecho) throw new Error("sem rótulo do trecho");
  expect(trecho.x + trecho.width).toBeLessThanOrEqual(direita);
  await p.mouse.up();
  await p.keyboard.press("Escape");

  // a ponta junto do zoom flutuante: o rótulo não fica atrás dele
  const zoom = await p.getByTestId("zoom-flutuante").boundingBox();
  if (!zoom) throw new Error("sem zoom");
  const iniZ = { x: zoom.x - 80, y: zoom.y - 70 };
  await p.mouse.move(iniZ.x, iniZ.y);
  await p.mouse.down();
  await p.mouse.move(zoom.x + 40, zoom.y - 12, { steps: 8 });
  const caixaZ = await rotulo.boundingBox();
  if (!caixaZ) throw new Error("sem rótulo");
  const cruza =
    caixaZ.x < zoom.x + zoom.width &&
    caixaZ.x + caixaZ.width > zoom.x &&
    caixaZ.y < zoom.y + zoom.height &&
    caixaZ.y + caixaZ.height > zoom.y;
  expect(cruza).toBe(false);
  expect(caixaZ.y + caixaZ.height).toBeLessThanOrEqual(area.y + area.height);
  await p.mouse.up();
});

test("com a preferência em pés, os campos de raio mostram pés e gravam metros; sem mexer, a sala não muda", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "mesa");
  const campo = p.getByTestId("cfg-alcance");
  await expect(campo).toHaveValue("1.5");
  // Q8: o rótulo ficou curto ("(m)"), com a ajuda embaixo
  await expect(p.getByText("Alcance de interação (m)")).toBeVisible();

  await emPes(p);
  await abrirAba(p, "mesa");
  await expect(p.getByText("Alcance de interação (pés)")).toBeVisible();
  await expect(campo).toHaveValue("5");
  // focar e sair sem mexer: nada vai para a sala
  await campo.focus();
  await campo.blur();
  await p.waitForTimeout(300);
  expect(mestre.enviados.some((f) => f.includes('"config.mesa"'))).toBe(false);

  // 10 pés = 3 m
  await campo.fill("10");
  await campo.blur();
  await expect
    .poll(() => mestre.enviados.find((f) => f.includes('"config.mesa"')) ?? "")
    .toContain('"alcanceInteracaoM":3');

  // de volta aos metros, o campo mostra 3
  await abrirPreferencia(p, "mapa");
  await p.getByTestId("pref-unidade-m").click();
  await abrirAba(p, "mesa");
  await expect(campo).toHaveValue("3");
});
