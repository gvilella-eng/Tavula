import type { Page } from "@playwright/test";
import { expect, test } from "./ajudas";
import { ATRASO_DA_DICA, congelarRelogio, PASSA_DO_ATRASO, passar } from "./ajudasDicas";
import { abrirFicha, criarDarion, DARION_ID, mandar } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// Q14: a ficha por seções. Digitar numa caixa redesenha só ela; mudar um atributo redesenha só o que depende dele; o
// balão da dica só existe enquanto aparece. O contador de renders (`window.__rendersDaFicha`) só existe no modo de teste.

type Contador = Record<string, number>;

const zerar = (p: Page) =>
  p.evaluate(() => {
    (window as unknown as { __rendersDaFicha: Contador }).__rendersDaFicha = {};
    (window as unknown as { __motivosDaFicha: Contador }).__motivosDaFicha = {};
  });
const lerContador = (p: Page) =>
  p.evaluate(() => (window as unknown as { __rendersDaFicha?: Contador }).__rendersDaFicha ?? {});
/** As seções que redesenharam desde o último `zerar` (a janela da ficha não conta). */
const quemRedesenhou = async (p: Page) =>
  Object.entries(await lerContador(p))
    .filter(([nome, n]) => nome !== "JanelaDaFicha" && n > 0)
    .map(([nome]) => nome)
    .sort();
/** Por que cada seção redesenhou (para achar a prop instável quando o teste falha). */
const motivos = async (p: Page) =>
  JSON.stringify(
    await p.evaluate(
      () => (window as unknown as { __motivosDaFicha?: Contador }).__motivosDaFicha ?? {},
    ),
  );
const enviosDaFicha = (enviados: string[]) =>
  enviados.filter((f) => f.includes('"ficha.alterar"')).length;

test("digitar numa caixa de texto redesenha só ela, mesmo com o eco da sala chegando", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarDarion(p);
  const janela = await abrirFicha(p, DARION_ID, "principal");

  // talentos: a descrição do primeiro, aberta e vazia
  await janela.getByTestId("caracteristica-alternar-0").click();
  const campo = janela.getByTestId("caracteristica-descricao-0");
  await campo.focus();
  await zerar(p);
  const antes = enviosDaFicha(mestre.enviados);
  await p.keyboard.type("Aventureiro de teste de desempenho 0123456789", { delay: 30 });
  await expect(campo).toHaveValue("Aventureiro de teste de desempenho 0123456789");
  // o eco da sala: a gravação agrupada sai depois da pausa e a ficha de volta não redesenha as outras seções
  await expect.poll(() => enviosDaFicha(mestre.enviados)).toBeGreaterThan(antes);
  await p.waitForTimeout(700);
  expect(await quemRedesenhou(p), await motivos(p)).toEqual(["Caracteristicas"]);
  await expect(campo).toBeFocused();
});

test("o cursor não pula ao digitar enquanto o eco da sala chega", async ({ mesa }) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarDarion(p);
  const janela = await abrirFicha(p, DARION_ID, "principal");
  await janela.getByTestId("caracteristica-alternar-0").click();
  const campo = janela.getByTestId("caracteristica-descricao-0");
  await campo.fill("0123456789");
  await expect.poll(() => enviosDaFicha(mestre.enviados)).toBeGreaterThan(0);
  await p.waitForTimeout(800);

  const posicao = () => campo.evaluate((e) => (e as HTMLTextAreaElement).selectionStart);
  await campo.evaluate((e) => {
    const t = e as HTMLTextAreaElement;
    t.focus();
    t.setSelectionRange(5, 5);
  });
  const antes = enviosDaFicha(mestre.enviados);
  await p.keyboard.type("X", { delay: 20 });
  await expect(campo).toHaveValue("01234X56789");
  expect(await posicao()).toBe(6);
  // o eco chega (a sala devolve a ficha) e o cursor continua onde estava
  await expect.poll(() => enviosDaFicha(mestre.enviados)).toBeGreaterThan(antes);
  await p.waitForTimeout(700);
  expect(await posicao()).toBe(6);
  await p.keyboard.type("Y", { delay: 20 });
  await expect(campo).toHaveValue("01234XY56789");
  expect(await posicao()).toBe(7);
});

test("mudar Força atualiza perícias, salvaguarda e ataque, e só as seções que dependem dela redesenham", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarDarion(p);
  // um ataque que depende da Força (acerto e dano), no lugar do primeiro
  await mandar(p, "ficha.alterar", {
    personagemId: DARION_ID,
    operacoes: [
      {
        caminho: "ataques.0",
        valor: {
          nome: "Espada",
          acerto: { tipo: "formula", atributo: "for", proficiente: true },
          dano: "1d8",
          atributoDano: "for",
        },
      },
    ],
  });
  const janela = await abrirFicha(p, DARION_ID, "principal");
  await expect(janela.getByTestId("ataque-dano-0")).toHaveText("1d8+7");
  await expect(janela.getByTestId("atributo-mod-for")).toHaveText("+7");
  await expect(janela.getByTestId("salvaguarda-total-for")).toHaveText("+11");
  await expect(janela.getByTestId("pericia-total-atletismo")).toHaveText("+11");

  await zerar(p);
  await janela.getByTestId("atributo-valor-for").fill("20");
  await expect(janela.getByTestId("atributo-mod-for")).toHaveText("+5");
  await expect(janela.getByTestId("salvaguarda-total-for")).toHaveText("+9");
  await expect(janela.getByTestId("pericia-total-atletismo")).toHaveText("+9");
  await expect(janela.getByTestId("ataque-dano-0")).toHaveText("1d8+5");
  await p.waitForTimeout(700);
  const redesenhadas = await quemRedesenhou(p);
  // dependem de Força: os atributos, as salvaguardas, as perícias e os ataques; o resto não redesenha
  expect(redesenhadas).toEqual(
    expect.arrayContaining(["Atributos", "Salvaguardas", "Pericias", "Ataques"]),
  );
  for (const naoDeveria of [
    "ClasseENivel",
    "CamposDeIdentidade",
    "Moedas",
    "Equipamento",
    "Personalidade",
    "Caracteristicas",
    "PainelExtra",
    "DadosDeVida",
    "PontosDeVida",
  ]) {
    expect(redesenhadas, naoDeveria).not.toContain(naoDeveria);
  }

  // o nível mexe na proficiência: salvaguarda, perícia e o ataque acompanham
  await expect(janela.getByTestId("proficiencia")).toHaveText("+4");
  await janela.getByTestId("classe-nivel-0").fill("8");
  await expect(janela.getByTestId("proficiencia")).toHaveText("+5");
  await expect(janela.getByTestId("salvaguarda-total-for")).toHaveText("+10");
  await expect(janela.getByTestId("pericia-total-atletismo")).toHaveText("+10");
});

test("a dica aparece ao passar o mouse e some ao sair; escondida, o balão nem existe no DOM", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarDarion(p);
  const janela = await abrirFicha(p, DARION_ID, "principal");
  await congelarRelogio(p);
  const botao = janela.getByTestId("descanso-curto");
  const dica = p.getByTestId("dica-descanso-curto");

  // sem o balão no DOM, o leitor de tela ainda lê o nome do botão
  await expect(dica).toHaveCount(0);
  await expect(botao).toHaveAttribute("aria-label", "Descanso curto");
  await botao.hover();
  await passar(p, ATRASO_DA_DICA - 50);
  await expect(dica).toHaveCount(0);
  await passar(p, PASSA_DO_ATRASO);
  await expect(dica).toBeVisible();
  await expect(dica).toContainText("Descanso curto");
  await expect(botao).toHaveAttribute(
    "aria-describedby",
    (await dica.getAttribute("id")) as string,
  );
  await p.mouse.move(700, 500);
  await expect(dica).toHaveCount(0);
  await expect(botao).not.toHaveAttribute("aria-describedby", /.+/);

  // no foco do teclado também
  await botao.focus();
  await expect(dica).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(dica).toHaveCount(0);
});
