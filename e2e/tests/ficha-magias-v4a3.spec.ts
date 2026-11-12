import type { Page } from "@playwright/test";
import { expect, test } from "./ajudas";
import { abrirFicha, criarDarion, DARION_ID, mandar } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// V4a3: espaços por círculo sempre visíveis (também sem classe), rótulo "Prep.", atributo de conjuração sem classe,
// dados de vida que não estouram a caixa e o modificador extra pelo botão direito / Shift+F10 (nunca no hover).

const SEM_CLASSE_ID = "pers-rendan";

async function criarSemClasse(mestre: Page, ficha: object) {
  await mandar(mestre, "personagem.criar", {
    personagem: {
      id: SEM_CLASSE_ID,
      pastaId: "pasta-personagens",
      editores: { tipo: "jogadores", ids: ["jogador-1"] },
      nome: "Rendan",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 18 },
      ficha,
    },
  });
}

const numero = (t: string | null) => Number((t ?? "").replace(/[−–]/g, "-").replace("+", ""));

test("sem classe: o total escrito à mão dá espaços para gastar, o rótulo Prep. aparece e o atributo dá a CD", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarSemClasse(mestre.pagina, {
    pvAtual: 10,
    pvMax: 10,
    atributos: { sab: 16 },
    magias: [{ nome: "Bênção", nivel: 1, preparada: true, descricao: "" }],
  });
  const janela = await abrirFicha(j1.pagina, SEM_CLASSE_ID, "magias");

  // sem classe e sem atributo: o aviso novo e nenhum número
  await expect(janela.getByTestId("sem-conjuracao")).toContainText("escolha o atributo");
  await expect(janela.getByTestId("conjuracao-cd-livre")).toHaveText("—");
  // o total do 1º círculo está à vista (sem hover)
  const total = janela.getByTestId("espaco-total-1");
  await expect(total).toBeVisible();
  await expect(total).toHaveValue("0");
  await total.fill("4");
  await expect(janela.getByTestId("espacos-restantes-1")).toHaveText("4");
  await expect(janela.getByTestId("espaco-1-4")).toBeVisible();

  // conjurar gasta; Recuperar devolve
  await janela.getByTestId("magia-conjurar-0").click();
  await expect(janela.getByTestId("espacos-restantes-1")).toHaveText("3");
  await expect(janela.getByTestId("espaco-1-4")).not.toBeChecked();
  await janela.getByTestId("recuperar-espacos").click();
  await expect(janela.getByTestId("espacos-restantes-1")).toHaveText("4");

  // o rótulo Prep. (com o nome completo para leitor de tela) fica sobre a coluna dos checkboxes
  const prep = janela.getByTestId("magias-prep-1");
  await expect(prep).toContainText("Prep.");
  await expect(prep).toContainText("Preparada");
  await expect(janela.getByTestId("magia-preparada-0")).toHaveAttribute(
    "aria-label",
    "Bênção preparada",
  );

  // atributo escolhido: CD 8 + 2 + 3 e ataque +5, e o aviso some
  await janela.getByTestId("conjuracao-habilidade-livre").selectOption("sab");
  await expect(janela.getByTestId("conjuracao-cd-livre")).toHaveText("13");
  await expect(janela.getByTestId("conjuracao-ataque-livre")).toHaveText("+5");
  await expect(janela.getByTestId("sem-conjuracao")).toHaveCount(0);

  // "+ Círculo" mostra um círculo vazio para preencher o total antes das magias
  await expect(janela.getByTestId("magias-nivel-2")).toHaveCount(0);
  await janela.getByTestId("magias-novo-circulo").click();
  await expect(janela.getByTestId("magias-nivel-2")).toBeVisible();
  await janela.getByTestId("espaco-total-2").fill("2");
  await expect(janela.getByTestId("espaco-2-2")).toBeVisible();
});

test("com classe: o número escrito sobrescreve o automático e o auto (ou apagar o campo) devolve a conta", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);
  const janela = await abrirFicha(j1.pagina, DARION_ID, "magias");
  const total = janela.getByTestId("espaco-total-1");
  await expect(total).toHaveValue("4");
  await expect(janela.getByTestId("espaco-auto-1")).toHaveCount(0);
  await total.fill("6");
  await expect(janela.getByTestId("espacos-restantes-1")).toHaveText("6");
  await janela.getByTestId("espaco-auto-1").click();
  await expect(janela.getByTestId("espacos-restantes-1")).toHaveText("4");
  await expect(janela.getByTestId("espaco-auto-1")).toHaveCount(0);
  // apagar o campo também volta ao automático
  await total.fill("5");
  await expect(janela.getByTestId("espacos-restantes-1")).toHaveText("5");
  await total.fill("");
  await expect(janela.getByTestId("espacos-restantes-1")).toHaveText("4");
});

test("dados de vida: as bolinhas ficam dentro da caixa do nível 1 ao 20, também no multiclasse", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarSemClasse(mestre.pagina, {
    pvAtual: 10,
    pvMax: 10,
    classes: [{ classe: "Bárbaro", nivel: 10 }],
  });
  const janela = await abrirFicha(j1.pagina, SEM_CLASSE_ID, "principal");

  async function dentroDaCaixa(dados: { dado: string; total: number }[]) {
    const caixa = await janela.getByTestId("fh-dados-de-vida").boundingBox();
    expect(caixa).not.toBeNull();
    const direita = (caixa?.x ?? 0) + (caixa?.width ?? 0);
    for (const { dado, total } of dados) {
      for (let n = 1; n <= total; n++) {
        const b = await janela.getByTestId(`dv-bolinha-${dado}-${n}`).boundingBox();
        expect(b, `${dado} ${n}`).not.toBeNull();
        expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual(direita);
        expect(b?.x ?? 0).toBeGreaterThanOrEqual(caixa?.x ?? 0);
      }
    }
  }
  const alterarClasses = (classes: object[]) =>
    mandar(mestre.pagina, "ficha.alterar", {
      personagemId: SEM_CLASSE_ID,
      operacoes: [{ caminho: "classes", valor: classes }],
    });

  await expect(janela.getByTestId("dv-restantes-d12")).toHaveText("10/10");
  await dentroDaCaixa([{ dado: "d12", total: 10 }]);
  // multiclasse com dois tipos
  await alterarClasses([
    { classe: "Bárbaro", nivel: 6 },
    { classe: "Clérigo", nivel: 6 },
  ]);
  await expect(janela.getByTestId("dv-restantes-d8")).toHaveText("6/6");
  await dentroDaCaixa([
    { dado: "d12", total: 6 },
    { dado: "d8", total: 6 },
  ]);
  // 12 por tipo ainda são bolinhas, que quebram de linha
  await alterarClasses([{ classe: "Bárbaro", nivel: 12 }]);
  await expect(janela.getByTestId("dv-restantes-d12")).toHaveText("12/12");
  await dentroDaCaixa([{ dado: "d12", total: 12 }]);
  // acima de 12 vira o contador compacto, com − e +
  await alterarClasses([{ classe: "Bárbaro", nivel: 20 }]);
  await expect(janela.getByTestId("dv-restantes-d12")).toHaveText("20/20");
  await expect(janela.getByTestId("dv-bolinha-d12-1")).toHaveCount(0);
  await janela.getByTestId("dv-menos-d12").click();
  await expect(janela.getByTestId("dv-restantes-d12")).toHaveText("19/20");
  await janela.getByTestId("dv-menos-d12").click();
  await janela.getByTestId("dv-mais-d12").click();
  await expect(janela.getByTestId("dv-restantes-d12")).toHaveText("19/20");
  const caixa = await janela.getByTestId("fh-dados-de-vida").boundingBox();
  const mais = await janela.getByTestId("dv-mais-d12").boundingBox();
  expect((mais?.x ?? 0) + (mais?.width ?? 0)).toBeLessThanOrEqual(
    (caixa?.x ?? 0) + (caixa?.width ?? 0),
  );
});

test("modificador extra: abre pelo botão direito e por Shift+F10, soma no total e o hover não mostra caixa", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);
  const janela = await abrirFicha(j1.pagina, DARION_ID, "principal");
  const p = j1.pagina;

  // o hover e o foco não mostram caixa nenhuma
  const linha = janela.getByTestId("pericia-acrobacia");
  await linha.hover();
  await janela.getByTestId("pericia-botao-acrobacia").focus();
  await expect(p.getByTestId("pericia-bonus-acrobacia")).toHaveCount(0);

  // botão direito: o popover "Modificador:" com a caixa; o total já inclui o valor
  const total = janela.getByTestId("pericia-total-acrobacia");
  const antes = numero(await total.textContent());
  await linha.click({ button: "right" });
  const popover = p.getByTestId("pericia-bonus-acrobacia-popover");
  await expect(popover).toBeVisible();
  await expect(popover).toContainText("Modificador:");
  await p.getByTestId("pericia-bonus-acrobacia").fill("3");
  await expect.poll(async () => numero(await total.textContent())).toBe(antes + 3);
  await expect(janela.getByRole("img", { name: "Bônus extra +3" })).toBeVisible();
  // Esc fecha e o foco volta à linha
  await p.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(janela.getByTestId("pericia-botao-acrobacia")).toBeFocused();

  // Shift+F10 na linha em foco: abre o mesmo popover; aceita negativo
  await p.keyboard.press("Shift+F10");
  await expect(popover).toBeVisible();
  await p.getByTestId("pericia-bonus-acrobacia").fill("-2");
  await p.keyboard.press("Enter");
  await expect(popover).toHaveCount(0);
  await expect(janela.getByTestId("pericia-botao-acrobacia")).toBeFocused();
  await expect.poll(async () => numero(await total.textContent())).toBe(antes - 2);

  // o clique esquerdo continua rolando (não abre popover)
  await janela.getByTestId("pericia-botao-acrobacia").click();
  await expect(popover).toHaveCount(0);

  // salvaguardas: o mesmo, pela tecla Menu
  const salva = janela.getByTestId("salvaguarda-total-des");
  const salvaAntes = numero(await salva.textContent());
  await janela.getByTestId("salvaguarda-botao-des").focus();
  await p.keyboard.press("ContextMenu");
  await expect(p.getByTestId("salvaguarda-bonus-des-popover")).toBeVisible();
  await p.getByTestId("salvaguarda-bonus-des").fill("4");
  await p.keyboard.press("Escape");
  await expect.poll(async () => numero(await salva.textContent())).toBe(salvaAntes + 4);
});
