import type { Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import { abrirFicha, escolherEspaco, mandar } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// N2: a conjuração completa. Magia inata do NPC (à vontade, N/dia cada, N/dia) sem gastar espaço; truque que sobe pelo
// nível; ritual sem espaço; mais dardos por nível de espaço acima.

const DIABRETE = "pers-diabrete-n2";
const ARCANISTA = "pers-arcanista-n2";
const MAGO_NPC = "pers-mago-npc-n2";

async function criarDiabrete(mestre: Page) {
  await mandar(mestre, "personagem.criar", {
    personagem: {
      id: DIABRETE,
      pastaId: "pasta-npcs",
      editores: { tipo: "jogadores", ids: [] },
      nome: "Diabrete",
      tokenPadrao: { cor: "#c0392b", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      ficha: {
        pvAtual: 20,
        pvMax: 20,
        apresentacao: "npc",
        npc: { nd: "3", tamanho: "Miúdo", tipo: "Ínfero" },
        atributos: { car: 16 },
        espacosTotal: { "3": 1 },
        inata: { habilidade: "car", cd: 13, grupo: { max: 2, gastos: 0 } },
        magias: [
          {
            nome: "Luz",
            nivel: 0,
            preparada: true,
            descricao: "O objeto emite luz.",
            inata: { frequencia: "vontade" },
          },
          {
            nome: "Relâmpago",
            nivel: 3,
            preparada: true,
            descricao: "Uma linha de raios.",
            dano: "8d6",
            tipo: "Elétrico",
            salvaguarda: { alvo: "des", cdAtributo: "int", sucesso: "metade" },
            inata: { frequencia: "cada", max: 1 },
          },
          {
            nome: "Invisibilidade",
            nivel: 2,
            preparada: true,
            descricao: "Some da vista.",
            inata: { frequencia: "grupo" },
          },
        ],
      },
    },
  });
}

async function abrirNpc(p: Page, id: string) {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${id}`).dblclick();
  const janela = p.locator(`[data-testid="janela-ficha"][data-personagem-id="${id}"]`);
  await expect(janela.getByTestId("npc-bloco")).toBeVisible();
  await janela.getByTestId("npc-fita-conjuracao").click();
  await expect(janela.getByTestId("npc-fita-conjuracao")).toHaveAttribute("aria-selected", "true");
  return janela;
}

test("magia inata do NPC: conjura sem gastar espaço, gasta a bolinha e o descanso longo devolve", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarDiabrete(p);
  const janela = await abrirNpc(p, DIABRETE);

  const inata = janela.getByTestId("npc-inata");
  await expect(inata).toBeVisible();
  await expect(janela.getByTestId("npc-inata-linha-vontade")).toContainText("À vontade:");
  await expect(janela.getByTestId("npc-inata-linha-cada-1")).toContainText("1/dia cada:");
  await expect(janela.getByTestId("npc-inata-linha-grupo")).toContainText("2/dia:");
  await expect(janela.getByTestId("npc-inata-cd-campo")).toHaveValue("13");
  // as magias inatas não aparecem nos círculos
  await expect(janela.getByTestId("npc-conj-magia-1")).toHaveCount(0);
  await expect(janela.getByTestId("npc-espaco-3-1")).toBeChecked();

  // Relâmpago (1/dia cada): gasta a bolinha dela, não o espaço de 3º
  await janela.getByTestId("npc-inata-magia-1").click();
  await expect(janela.getByTestId("npc-inata-uso-1-1")).toBeChecked();
  await janela.getByTestId("npc-inata-conjurar-1").click();
  await expect(janela.getByTestId("npc-inata-uso-1-1")).not.toBeChecked();
  await expect(janela.getByTestId("npc-espaco-3-1")).toBeChecked();
  await abrirAba(p, "chat");
  const msg = p.getByTestId("chat-mensagem").filter({ hasText: "Relâmpago" });
  await expect(msg).toHaveCount(1);
  await expect(msg.getByTestId("espaco-usado")).toHaveText("conjuração inata");
  await expect(msg).toContainText("CD 13");
  // sem usos, não conjura de novo
  await janela.getByTestId("npc-inata-conjurar-1").click();
  await expect(p.getByTestId("chat-mensagem").filter({ hasText: "Relâmpago" })).toHaveCount(1);

  // o grupo "2/dia": um contador para as magias dele
  await janela.getByTestId("npc-inata-magia-2").click();
  await janela.getByTestId("npc-inata-conjurar-2").click();
  await expect(janela.getByTestId("npc-inata-grupo-2")).not.toBeChecked();
  await expect(janela.getByTestId("npc-inata-grupo-1")).toBeChecked();
  await expect(
    p.getByTestId("chat-mensagem").filter({ hasText: "Diabrete conjura Invisibilidade" }),
  ).toHaveCount(1);

  // à vontade não gasta nada
  await janela.getByTestId("npc-inata-magia-0").click();
  await janela.getByTestId("npc-inata-conjurar-0").click();
  await expect(p.getByTestId("chat-mensagem").filter({ hasText: "Luz" })).toHaveCount(1);

  // recuperar os usos zera os gastos (o descanso longo da ficha faz o mesmo: teste de unidade)
  await janela.getByTestId("npc-inata-recuperar").click();
  await expect(janela.getByTestId("npc-inata-uso-1-1")).toBeChecked();
  await expect(janela.getByTestId("npc-inata-grupo-2")).toBeChecked();
});

test("truque no nível 5 rola 2 dados e o cartão diz o nível", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await mandar(p, "personagem.criar", {
    personagem: {
      id: MAGO_NPC,
      pastaId: "pasta-npcs",
      editores: { tipo: "jogadores", ids: [] },
      nome: "Mago Cinzento",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      ficha: {
        pvAtual: 40,
        pvMax: 40,
        apresentacao: "npc",
        npc: { nd: "5", tamanho: "Médio", tipo: "Humanoide" },
        atributos: { int: 18 },
        habilidadeDeConjuracao: "int",
        magias: [
          {
            nome: "Raio de Fogo",
            nivel: 0,
            preparada: true,
            descricao: "Um ataque de magia à distância.",
            acerto: { tipo: "formula", atributo: "int", proficiente: true },
            dano: "1d10",
            tipo: "Fogo",
            dadosPorNivel: [
              { nivel: 5, expressao: "1d10" },
              { nivel: 11, expressao: "2d10" },
              { nivel: 17, expressao: "3d10" },
            ],
          },
        ],
      },
    },
  });
  const janela = await abrirNpc(p, MAGO_NPC);
  await janela.getByTestId("npc-conj-magia-0").click();
  await janela.getByTestId("npc-conj-conjurar-0").click();
  await abrirAba(p, "chat");
  await p.getByTestId("chat-mensagem").last().getByTestId("rolagem-metade").last().hover();
  const formula = p.getByTestId("modelo-dano-formula");
  await expect(formula).toHaveCount(1);
  // ND 5 vale como nível 5: 1d10 + 1d10
  // (um 20 natural, 1 em 20, dobra os dados do crítico: 4d10)
  await expect(formula).toHaveText(/^[24]d10 fogo \(nível 5\)$/);
});

test("ritual não gasta espaço e Mísseis Mágicos no 2º espaço mostra 4 dardos", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await mandar(mestre.pagina, "personagem.criar", {
    personagem: {
      id: ARCANISTA,
      pastaId: "pasta-personagens",
      editores: { tipo: "jogadores", ids: ["jogador-1"] },
      nome: "Vessa",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 18 },
      ficha: {
        pvAtual: 20,
        pvMax: 20,
        atributos: { int: 16 },
        habilidadeDeConjuracao: "int",
        espacosTotal: { "1": 2, "2": 1 },
        magias: [
          {
            nome: "Detectar Magia",
            nivel: 1,
            preparada: true,
            descricao: "Você sente a presença de magia.",
            ritual: true,
          },
          {
            nome: "Mísseis Mágicos",
            nivel: 1,
            preparada: true,
            descricao: "Dardos de força.",
            dano: "1d4+1",
            tipo: "Energia",
            porNivelAcima: "1 dardo",
            quantidadeBase: 3,
          },
          { nome: "Escudo Arcano", nivel: 1, preparada: true, descricao: "Reação: +5 na CA." },
        ],
      },
    },
  });
  const p = j1.pagina;
  const janela = await abrirFicha(p, ARCANISTA, "magias");

  // só a magia com a marca Ritual ganha o item
  await janela.getByTestId("magia-conjurar-2").click();
  await expect(p.getByTestId("menu-espaco-ritual")).toHaveCount(0);
  await p.keyboard.press("Escape");
  await janela.getByTestId("magia-conjurar-0").click();
  const menu = p.getByTestId("menu-espaco");
  await expect(menu.getByTestId("menu-espaco-ritual")).toHaveText("Ritual · sem espaço (+10 min)");
  await menu.getByTestId("menu-espaco-ritual").click();
  await expect(janela.getByTestId("espacos-restantes-1")).toHaveText("2");
  await abrirAba(p, "chat");
  const ritual = p.getByTestId("chat-mensagem").filter({ hasText: "Detectar Magia" });
  await expect(ritual).toHaveCount(1);
  await expect(ritual).toContainText("como ritual");

  // Mísseis Mágicos no 2º espaço: 3 + 1 = 4 dardos, cada um rolado à parte, e o total
  await janela.getByTestId("magia-conjurar-1").click();
  await escolherEspaco(p, 2);
  await expect(janela.getByTestId("espacos-restantes-2")).toHaveText("0");
  const msg = p.getByTestId("chat-mensagem").filter({ hasText: "Mísseis Mágicos" });
  await expect(msg).toHaveCount(1);
  await expect(msg.getByTestId("espaco-usado")).toHaveText("com espaço de 2º · 4 dardos");
  await msg.locator(".rc").hover();
  await expect(msg.getByTestId("bloco-quantidade-titulo")).toHaveText("4 dardos · 1d4 + 1 cada");
  const total = Number(
    await msg.getByTestId("bloco-quantidade-total").locator("strong").textContent(),
  );
  // 4 × (1d4+1) fica entre 8 e 20
  expect(total).toBeGreaterThanOrEqual(8);
  expect(total).toBeLessThanOrEqual(20);
  // no nível da magia, nada de quantidade
  await janela.getByTestId("magia-conjurar-1").click();
  await escolherEspaco(p, 1);
  const cartoes = p.getByTestId("modelo-livre");
  await expect(cartoes).toHaveCount(2);
  await cartoes.first().hover(); // a conjuração de 2º espaço tem o bloco (no balão)...
  await expect(p.getByTestId("bloco-quantidade")).toHaveCount(1);
  await p.mouse.move(0, 0);
  await cartoes.last().hover(); // ...a do nível da magia, não
  await expect(p.getByTestId("rolagem-balao")).toBeVisible();
  await expect(p.getByTestId("bloco-quantidade")).toHaveCount(0);
});
