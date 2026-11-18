import type { Page } from "@playwright/test";
import { abrirAba, expect, test, tornarMembros } from "./ajudas";
import { abrirFicha, criarDarion, DARION_ID, mandar } from "./ajudasFicha";
import {
  centrarNoToken,
  entrarNoMapa,
  esperarPosicao,
  type GanchoDoMapa,
  PX_POR_M,
  soSelecionarToken,
  tokenDe,
} from "./ajudasMapa";

// Q15: a aba Magias e a ficha do NPC por seções (escrever numa caixa redesenha só ela; mudar um atributo atualiza o
// que depende dele) e arrastar o token seguido desliga o "Seguir meu token". Os contadores só existem no modo de teste.

type Contador = Record<string, number>;

const zerar = (p: Page) =>
  p.evaluate(() => {
    (window as unknown as { __rendersDaFicha: Contador }).__rendersDaFicha = {};
    (window as unknown as { __motivosDaFicha: Contador }).__motivosDaFicha = {};
  });
const quemRedesenhou = async (p: Page) =>
  Object.entries(
    await p.evaluate(
      () => (window as unknown as { __rendersDaFicha?: Contador }).__rendersDaFicha ?? {},
    ),
  )
    .filter(([nome, n]) => nome !== "JanelaDaFicha" && n > 0)
    .map(([nome]) => nome)
    .sort();
const motivos = async (p: Page) =>
  JSON.stringify(
    await p.evaluate(
      () => (window as unknown as { __motivosDaFicha?: Contador }).__motivosDaFicha ?? {},
    ),
  );

const OGRO = "pers-ogro";
const TEXTO = "Texto de teste do Q15";

const MAGIAS = [
  { nome: "Raio de Fogo", nivel: 0, preparada: true, descricao: "" },
  { nome: "Mísseis Mágicos", nivel: 1, preparada: false, descricao: "" },
  { nome: "Escudo Arcano", nivel: 1, preparada: true, descricao: "" },
];

test("aba Magias: digitar numa descrição redesenha só a linha dela; o atributo de conjuração atualiza CD e ataque", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarDarion(p);
  await mandar(p, "ficha.alterar", {
    personagemId: DARION_ID,
    operacoes: [{ caminho: "magias", valor: MAGIAS }],
  });
  const janela = await abrirFicha(p, DARION_ID, "magias");
  await janela.getByTestId("magia-alternar-0").click();
  const campo = janela.getByTestId("magia-descricao-0");
  await campo.focus();
  await zerar(p);
  await p.keyboard.type(TEXTO, { delay: 25 });
  await expect(campo).toHaveValue(TEXTO);
  await p.waitForTimeout(700);
  expect(await quemRedesenhou(p), await motivos(p)).toEqual(["LinhaDeMagia"]);
  await expect(campo).toBeFocused();
  // o texto chegou à ficha de verdade: a linha o mostra depois de fechar e abrir
  await janela.getByTestId("magia-alternar-0").click();
  await janela.getByTestId("magia-alternar-0").click();
  await expect(janela.getByTestId("magia-descricao-0")).toHaveValue(TEXTO);

  // o campo livre da aba: só a barra dele
  const classe = janela.getByTestId("ficha-classe-conjurador");
  await classe.fill("");
  await classe.focus();
  await zerar(p);
  await p.keyboard.type("Patrulheiro", { delay: 25 });
  await expect(classe).toHaveValue("Patrulheiro");
  await p.waitForTimeout(700);
  expect(await quemRedesenhou(p), await motivos(p)).toEqual(["BarraDoConjurador"]);

  // marcar a magia preparada: só a linha
  await zerar(p);
  await janela.getByTestId("magia-preparada-1").click();
  await expect(janela.getByTestId("magia-preparada-1")).toBeChecked();
  expect(await quemRedesenhou(p), await motivos(p)).toEqual(["LinhaDeMagia"]);

  // o atributo de conjuração: CD e ataque na tela mudam
  const seletor = janela.locator('[data-testid^="conjuracao-habilidade-"]').first();
  const cd = janela.locator('[data-testid^="conjuracao-cd-"]').first();
  const ataque = janela.locator('[data-testid^="conjuracao-ataque-"]').first();
  const cdAntes = (await cd.textContent()) ?? "";
  const ataqueAntes = (await ataque.textContent()) ?? "";
  const atual = await seletor.inputValue();
  await seletor.selectOption(atual === "car" ? "int" : "car");
  await expect(cd).not.toHaveText(cdAntes);
  await expect(ataque).not.toHaveText(ataqueAntes);
});

test("ficha do NPC: digitar num traço ou nos sentidos redesenha só aquela seção; Força atualiza as dependentes", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await mandar(p, "ficha.alterar", {
    personagemId: OGRO,
    operacoes: [{ caminho: "caracteristicas", valor: [{ nome: "Traço de teste", descricao: "" }] }],
  });
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${OGRO}`).dblclick();
  const janela = p.locator(`[data-testid="janela-ficha"][data-personagem-id="${OGRO}"]`);
  await expect(janela.getByTestId("npc-bloco")).toBeVisible();

  await janela.getByTestId("traco-alternar-0").click();
  const traco = janela.getByTestId("traco-descricao-0");
  await traco.focus();
  await zerar(p);
  await p.keyboard.type(TEXTO, { delay: 25 });
  await expect(traco).toHaveValue(TEXTO);
  await p.waitForTimeout(700);
  expect(await quemRedesenhou(p), await motivos(p)).toEqual(["NpcTracos"]);

  const sentidos = janela.getByTestId("npc-sentidos-campo");
  await sentidos.fill("");
  await sentidos.focus();
  await zerar(p);
  await p.keyboard.type("visão no escuro", { delay: 25 });
  await expect(sentidos).toHaveValue("visão no escuro");
  await p.waitForTimeout(700);
  expect(await quemRedesenhou(p), await motivos(p)).toEqual(["NpcSentidos"]);

  // Força 19 -> 10: o modificador, o acerto e o dano da Clava mudam; o cabeçalho e as linhas de texto ficam
  await expect(janela.getByTestId("atributo-mod-for")).toContainText("+4");
  await expect(janela.getByTestId("npc-acao-acerto-0")).toHaveText("+6");
  await zerar(p);
  await janela.getByTestId("atributo-valor-for").fill("10");
  await expect(janela.getByTestId("atributo-mod-for")).toContainText("+0");
  await expect(janela.getByTestId("npc-acao-acerto-0")).toHaveText("+2");
  await expect(janela.getByTestId("npc-acao-dano-0")).toHaveText("2d8");
  await p.waitForTimeout(500);
  const quem = await quemRedesenhou(p);
  expect(quem, await motivos(p)).toContain("NpcAtributos");
  expect(quem).toContain("NpcAcoes");
  expect(quem).not.toContain("NpcTracos");
  expect(quem).not.toContain("NpcSentidos");
  expect(quem).not.toContain("NpcCabecalho");
});

test("conjuração do NPC: o atributo atualiza CD e ataque; gastar um espaço não mexe no cabeçalho", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await mandar(p, "ficha.alterar", {
    personagemId: OGRO,
    operacoes: [
      { caminho: "habilidadeDeConjuracao", valor: "int" },
      { caminho: "espacosTotal", valor: { "1": 3 } },
      { caminho: "magias", valor: MAGIAS },
    ],
  });
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${OGRO}`).dblclick();
  const janela = p.locator(`[data-testid="janela-ficha"][data-personagem-id="${OGRO}"]`);
  await janela.getByTestId("npc-fita-conjuracao").click();
  await expect(janela.getByTestId("npc-secao-conjuracao")).toBeVisible();

  const cd = janela.getByTestId("npc-conj-cd");
  const cdAntes = (await cd.textContent()) ?? "";
  await zerar(p);
  await janela.getByTestId("npc-conj-habilidade").selectOption("car");
  await expect(cd).not.toHaveText(cdAntes);
  expect(await quemRedesenhou(p), await motivos(p)).toContain("CabecalhoDaConjuracao");

  await expect(janela.getByTestId("npc-espacos-restantes-1")).toHaveText("3");
  await zerar(p);
  await janela.getByTestId("npc-espaco-1-3").click();
  await expect(janela.getByTestId("npc-espacos-restantes-1")).toHaveText("2");
  const quem = await quemRedesenhou(p);
  expect(quem, await motivos(p)).not.toContain("CabecalhoDaConjuracao");
});

const centroDaVista = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centroDaVista());

/** Mouse de verdade: aperta no centro do token, anda `dx` metros e solta. Devolve o centro da vista logo depois de apertar. */
async function arrastarSemCentrar(p: Page, id: string, dx: number) {
  const ini = await centrarNoToken(p, id);
  const zoom = await p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.zoom(),
  );
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  const centro = await centroDaVista(p);
  await p.mouse.move(ini.x + dx * PX_POR_M * zoom, ini.y, { steps: 12 });
  await p.waitForTimeout(300);
  await p.mouse.up();
  return centro;
}

test("Seguir meu token: arrastar o token seguido desliga o seguir; clicar não; as setas seguem", async ({
  mesa,
  request,
}) => {
  test.setTimeout(120_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  const botao = p.getByTestId("zoom-seguir");

  await botao.click();
  await expect(botao).toHaveAttribute("aria-pressed", "true");
  await soSelecionarToken(p, "tok-jogador-1");
  await expect(botao).toHaveAttribute("aria-pressed", "true");

  // só clicar no token (sem arrastar) mantém o seguir
  const alvo = await centrarNoToken(p, "tok-jogador-1");
  await p.mouse.click(alvo.x, alvo.y);
  await expect(botao).toHaveAttribute("aria-pressed", "true");

  // as setas continuam seguindo
  const base = await tokenDe(p, "tok-jogador-1");
  await p.keyboard.press("ArrowRight");
  await p.keyboard.press("ArrowRight");
  await esperarPosicao(p, "tok-jogador-1", base.x + 3, base.y);
  await expect
    .poll(async () => {
      const t = await tokenDe(p, "tok-jogador-1");
      const c = await centroDaVista(p);
      return Math.hypot(c.x - t.x, c.y - t.y) <= 0.1;
    })
    .toBe(true);

  // arrastar o token seguido desliga, e a vista não corre atrás dele
  const centro = await arrastarSemCentrar(p, "tok-jogador-1", 3);
  await expect(botao).not.toHaveAttribute("aria-pressed", "true");
  const depois = await centroDaVista(p);
  expect(Math.hypot(depois.x - centro.x, depois.y - centro.y)).toBeLessThan(0.05);
  // a preferência salva também ficou desligada
  const salvas = await p.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith("tabletop:pref:seguir:"))
      .map((k) => localStorage.getItem(k) ?? ""),
  );
  expect(salvas.length).toBeGreaterThan(0);
  for (const s of salvas) expect(s).toContain('"ligado":false');

  // religar é o botão (ou F), como antes
  await botao.click();
  await expect(botao).toHaveAttribute("aria-pressed", "true");

  // o mestre: seguir o token selecionado e arrastá-lo desliga também
  await soSelecionarToken(m.pagina, "tok-jogador-3");
  await m.pagina.getByTestId("zoom-seguir").click();
  await expect(m.pagina.getByTestId("zoom-seguir")).toHaveAttribute("aria-pressed", "true");
  await arrastarSemCentrar(m.pagina, "tok-jogador-3", 2);
  await expect(m.pagina.getByTestId("zoom-seguir")).not.toHaveAttribute("aria-pressed", "true");
});
