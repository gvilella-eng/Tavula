import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, expect, test } from "./ajudas";
import { entrarNoMapa } from "./ajudasMapa";

// P1: a aba Preferências em sanfona com resumo (o Modelo B). Sete seções na ordem pedida; só a Conta abre por padrão;
// cada título abre e fecha pelo mouse e pelo teclado; o que ficou aberto é lembrado neste navegador; os resumos
// acompanham o estado; as seções guardadas só no navegador levam a marca.

const ORDEM = [
  "Conta",
  "Aparência",
  "Som",
  "No mapa",
  "Ajuda e arquivos",
  "Conectar o Claude",
  "Atalhos do teclado",
];

const titulos = (p: Page) =>
  p.getByTestId("preferencias").locator("summary .pref-secao-texto > b").allTextContents();

test("a ordem das seções e só a Conta aberta por padrão; sem login, sem Segurança", async ({
  mesa,
}) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await abrirAba(p, "preferencias");
  expect(await titulos(p)).toEqual(ORDEM);
  await expect(p.getByTestId("pref-secao-seguranca")).toHaveCount(0);
  await expect(p.getByTestId("pref-secao-conta-titulo")).toHaveAttribute("aria-expanded", "true");
  for (const id of ["aparencia", "som", "mapa", "ajuda", "claude", "atalhos"]) {
    await expect(p.getByTestId(`pref-secao-${id}-titulo`)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  }
  await expect(p.getByTestId("trocar-usuario")).toBeVisible();
  await expect(p.getByTestId("pref-encaixe")).toBeHidden();
  // os resumos do que está fechado
  await expect(p.getByTestId("pref-resumo-mapa")).toHaveText(
    "Metros · encaixe ligado · dicas ligadas",
  );
  await expect(p.getByTestId("pref-resumo-ajuda")).toContainText("Nenhuma pasta escolhida");
  await expect(p.getByTestId("pref-resumo-atalhos")).toHaveText(/^\d+ atalhos$/);
});

test("abrir e fechar pelo mouse e pelo teclado, abrir um não fecha os outros, e fica lembrado", async ({
  mesa,
}) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await abrirAba(p, "preferencias");
  const mapa = p.getByTestId("pref-secao-mapa-titulo");
  const aparencia = p.getByTestId("pref-secao-aparencia-titulo");

  await mapa.click();
  await expect(mapa).toHaveAttribute("aria-expanded", "true");
  await expect(p.getByTestId("pref-encaixe")).toBeVisible();
  // abrir outra não fecha a anterior
  await aparencia.click();
  await expect(aparencia).toHaveAttribute("aria-expanded", "true");
  await expect(mapa).toHaveAttribute("aria-expanded", "true");
  await expect(p.getByTestId("pref-secao-conta-titulo")).toHaveAttribute("aria-expanded", "true");

  // teclado: Enter fecha, Espaço abre
  await mapa.focus();
  await p.keyboard.press("Enter");
  await expect(mapa).toHaveAttribute("aria-expanded", "false");
  await expect(p.getByTestId("pref-encaixe")).toBeHidden();
  await p.keyboard.press("Space");
  await expect(mapa).toHaveAttribute("aria-expanded", "true");
  await p.keyboard.press("Enter"); // deixa o No mapa fechado
  await expect(mapa).toHaveAttribute("aria-expanded", "false");
  // fechar a Conta também fica lembrado
  await p.getByTestId("pref-secao-conta-titulo").click();

  await p.reload();
  await expect(p.getByTestId("eu-nome")).toBeVisible();
  await abrirAba(p, "preferencias");
  await expect(p.getByTestId("pref-secao-aparencia-titulo")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(p.getByTestId("pref-secao-mapa-titulo")).toHaveAttribute("aria-expanded", "false");
  await expect(p.getByTestId("pref-secao-conta-titulo")).toHaveAttribute("aria-expanded", "false");
  // só neste navegador: nada foi para a sala
  expect(await p.evaluate(() => localStorage.getItem("tabletop:pref:secoes"))).toBe(
    '{"mapa":false,"aparencia":true,"conta":false}',
  );
});

test("os resumos acompanham o estado: mapa, aparência e Claude", async ({ mesa }) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await abrirPreferencia(p, "mapa");
  await p.getByTestId("pref-unidade-pes").click();
  await expect(p.getByTestId("pref-resumo-mapa")).toHaveText(
    "Pés · encaixe ligado · dicas ligadas",
  );
  await p.getByTestId("pref-encaixe").uncheck();
  await expect(p.getByTestId("pref-resumo-mapa")).toHaveText(
    "Pés · encaixe desligado · dicas ligadas",
  );
  await p.getByTestId("pref-dicas").uncheck();
  await expect(p.getByTestId("pref-resumo-mapa")).toHaveText(
    "Pés · encaixe desligado · dicas desligadas",
  );
  await p.getByTestId("pref-unidade-m").click();
  await expect(p.getByTestId("pref-resumo-mapa")).toHaveText(
    "Metros · encaixe desligado · dicas desligadas",
  );

  await abrirPreferencia(p, "aparencia");
  await expect(p.getByTestId("pref-resumo-aparencia")).toHaveText("Grimório");
  await p.getByTestId("tema-vampiro").click();
  await expect(p.getByTestId("pref-resumo-aparencia")).toHaveText("Vampiro");

  await abrirPreferencia(p, "claude");
  await expect(p.getByTestId("pref-resumo-claude")).toHaveText("Nenhum token");
  await p.getByTestId("claude-gerar").click();
  await expect(p.getByTestId("pref-resumo-claude")).toHaveText("1 token");
  await p.getByTestId("claude-token-guardei").click();
  await p.getByTestId("claude-token-nome").fill("Outro");
  await p.getByTestId("claude-gerar").click();
  await expect(p.getByTestId("pref-resumo-claude")).toHaveText("2 tokens");
});

test("a marca 'só neste navegador' aparece em Aparência, Som, No mapa e na pasta local", async ({
  mesa,
}) => {
  const p = (await entrarNoMapa(mesa, "jogador-1")).pagina;
  await abrirPreferencia(p, "aparencia");
  await abrirPreferencia(p, "som");
  await abrirPreferencia(p, "mapa");
  await abrirPreferencia(p, "ajuda");
  for (const id of ["aparencia", "som", "mapa", "ajuda"]) {
    await expect(
      p.getByTestId(`pref-secao-${id}`).getByTestId("pref-marca-navegador"),
    ).toBeVisible();
  }
  await expect(p.getByTestId("pref-marca-navegador")).toHaveCount(4);
  await expect(p.getByTestId("pref-marca-navegador").first()).toHaveText("só neste navegador");
  // Conta, Claude e Atalhos não levam a marca
  await expect(p.getByTestId("pref-secao-conta").getByTestId("pref-marca-navegador")).toHaveCount(
    0,
  );
});
