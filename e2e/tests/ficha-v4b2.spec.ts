import type { Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import { abrirFicha, criarDarion, DARION_ID, escolherEspaco, mandar } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// V4b2: a seção Conjuração do bloco de NPC (mesmos dados da ficha de personagem) e o nome com a capitular (a letra é só
// desenho; o campo mostra o nome inteiro enquanto se edita).

const OGRO = "pers-ogro";
const MAGO_NPC = "pers-mago-npc";

async function criarMagoNpc(mestre: Page) {
  await mandar(mestre, "personagem.criar", {
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
        atributos: { for: 9, des: 14, con: 12, int: 18, sab: 12, car: 10 },
        habilidadeDeConjuracao: "int",
        espacosTotal: { "1": 2, "3": 1 },
        magias: [
          {
            nome: "Raio de Fogo",
            nivel: 0,
            preparada: true,
            descricao: "Um ataque de magia à distância.",
            acerto: { tipo: "formula", atributo: "int", proficiente: true },
            dano: "2d10",
            tipo: "Fogo",
          },
          { nome: "Luz", nivel: 0, preparada: true, descricao: "O objeto emite luz." },
          { nome: "Mísseis Mágicos", nivel: 1, preparada: true, descricao: "Dardos de força." },
          {
            nome: "Bola de Fogo",
            nivel: 3,
            preparada: true,
            descricao: "Explosão de chamas.",
            dano: "8d6",
            tipo: "Fogo",
            salvaguarda: { alvo: "des", cdAtributo: "int", sucesso: "metade" },
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
  return janela;
}

/** V8: a Conjuração tem a fita dela ao lado do Bestiário. */
async function abrirConjuracao(janela: ReturnType<Page["locator"]>) {
  await janela.getByTestId("npc-fita-conjuracao").click();
  await expect(janela.getByTestId("npc-fita-conjuracao")).toHaveAttribute("aria-selected", "true");
}

test("a seção Conjuração: CD e ataque pelo ND, bolinhas, conjurar gasta o espaço e rola no chat", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarMagoNpc(p);
  const janela = await abrirNpc(p, MAGO_NPC);

  // o Bestiário não leva a seção; ela mora na fita Conjuração
  await expect(janela.getByTestId("npc-secao-conjuracao")).toHaveCount(0);
  await abrirConjuracao(janela);
  const secao = janela.getByTestId("npc-secao-conjuracao");
  await expect(secao).toBeVisible();
  // ND 5 → proficiência +3; Inteligência 18 (+4): CD 8 + 3 + 4 = 15 e ataque +7
  await expect(janela.getByTestId("npc-conj-habilidade")).toHaveValue("int");
  await expect(janela.getByTestId("npc-conj-cd")).toHaveText("15");
  await expect(janela.getByTestId("npc-conj-ataque")).toHaveText("+7");
  // uma linha por círculo, só dos que têm magia ou espaço, com o mesmo nome de nível da aba Magias do personagem
  await expect(janela.getByTestId("npc-conj-nivel-0")).toContainText("Truques (à vontade):");
  await expect(janela.getByTestId("npc-conj-nivel-1")).toContainText("1º nível:");
  await expect(janela.getByTestId("npc-conj-nivel-1")).toContainText("Mísseis Mágicos");
  await expect(janela.getByTestId("npc-conj-nivel-2")).toHaveCount(0);
  await expect(janela.getByTestId("npc-conj-nivel-3")).toContainText("Bola de Fogo");
  await expect(janela.getByTestId("npc-espaco-1-2")).toBeVisible();
  await expect(janela.getByTestId("npc-espaco-3-1")).toBeVisible();

  // a página da Conjuração é só ela: nem Traços nem Ações
  await expect(janela.getByTestId("npc-secao-tracos")).toHaveCount(0);
  await expect(janela.getByTestId("npc-secao-acao")).toHaveCount(0);

  // as bolinhas marcam e desmarcam
  await janela.getByTestId("npc-espaco-1-2").uncheck();
  await expect(janela.getByTestId("npc-espaco-1-2")).not.toBeChecked();
  await janela.getByTestId("npc-espaco-1-2").check();
  await expect(janela.getByTestId("npc-espaco-1-2")).toBeChecked();

  // clicar na magia abre a descrição na própria seção
  await janela.getByTestId("npc-conj-magia-3").click();
  await expect(janela.getByTestId("npc-conj-texto-3")).toHaveText("Explosão de chamas.");
  // V8: um só ícone de chat ao lado do Conjurar (o do V6); o antigo saiu
  await expect(janela.getByTestId("npc-conj-pingar-3")).toBeVisible();
  await expect(janela.getByTestId("npc-conj-chat-3")).toHaveCount(0);
  // conjurar a de salvaguarda: gasta o espaço de 3º nível e rola o dano com a CD
  await janela.getByTestId("npc-conj-conjurar-3").click();
  // V6: o menu de espaço aparece igual na Conjuração do NPC, e o ícone ao lado manda o cartão sem gastar
  await expect(p.getByTestId("menu-espaco")).toHaveAttribute(
    "aria-label",
    "Conjurar Bola de Fogo com espaço de:",
  );
  await expect(p.getByTestId("menu-espaco").getByRole("menuitem")).toHaveCount(1);
  await escolherEspaco(p, 3);
  await expect(janela.getByTestId("npc-espaco-3-1")).not.toBeChecked();
  // o truque de ataque: abre, lança, não gasta espaço nenhum
  await janela.getByTestId("npc-conj-magia-0").click();
  await janela.getByTestId("npc-conj-conjurar-0").click();
  await expect(janela.getByTestId("npc-espaco-1-1")).toBeChecked();
  await expect(janela.getByTestId("npc-espaco-1-2")).toBeChecked();
  // sem espaço de 3º nível: avisa e não rola de novo
  await janela.getByTestId("npc-conj-magia-3").click();
  await janela.getByTestId("npc-conj-conjurar-3").click();
  // B1: o aviso é o padrão da mesa (toast na área do mapa, role=status), não mais um parágrafo dentro da ficha
  await expect(p.getByTestId("aviso")).toContainText(
    "Sem espaços de 3º nível ou maior para Bola de Fogo.",
  );
  await expect(p.getByTestId("aviso")).toHaveAttribute("role", "status");

  // o ataque de magia do cabeçalho rola no chat
  await janela.getByTestId("npc-conj-ataque").click();
  await abrirAba(p, "chat");
  // a magia de salvaguarda sai no bloco de dano com a CD; a de ataque, no bloco de ataque
  const bola = p.getByTestId("modelo-livre").filter({ hasText: "Bola de Fogo" });
  await expect(bola).toHaveCount(1);
  await expect(bola.getByTestId("modelo-cd-valor")).toHaveText("15");
  await expect(p.getByTestId("modelo-ataque").filter({ hasText: "Raio de Fogo" })).toHaveCount(1);
});

test("sem magias a seção não existe; o + Conjuração a cria e dá onde pôr círculos, espaços e magias", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const janela = await abrirNpc(p, OGRO);

  await abrirConjuracao(janela);
  await expect(janela.getByTestId("npc-secao-conjuracao")).toHaveCount(0);
  await janela.getByTestId("npc-nova-conjuracao").click();
  await expect(janela.getByTestId("npc-secao-conjuracao")).toBeVisible();
  await expect(janela.getByTestId("npc-nova-conjuracao")).toHaveCount(0);
  // o atributo mental mais alto do Ogro (Sabedoria 7 e Carisma 7 empatam acima de Inteligência 5): CD 8 + 2 − 2
  await expect(janela.getByTestId("npc-conj-habilidade")).not.toHaveValue("");
  await expect(janela.getByTestId("npc-conj-cd")).toHaveText("8");

  // um truque pelo campo do próprio círculo
  await janela.getByTestId("npc-conj-nova-0").fill("Luz");
  await janela.getByTestId("npc-conj-nova-0").press("Enter");
  await expect(janela.getByTestId("npc-conj-nivel-0")).toContainText("Luz");

  // "+ Círculo" mostra o 2º nível; o total de espaços vira bolinhas
  await janela.getByTestId("npc-conj-mais-circulo").selectOption("2");
  await expect(janela.getByTestId("npc-conj-nivel-2")).toBeVisible();
  await janela.getByTestId("npc-espaco-total-2").fill("3");
  await expect(janela.getByTestId("npc-espaco-2-3")).toBeVisible();
  await janela.getByTestId("npc-conj-nova-2").fill("Levitação");
  await janela.getByTestId("npc-conj-nova-2").press("Enter");
  await expect(janela.getByTestId("npc-conj-nivel-2")).toContainText("Levitação");

  // trocar a apresentação para Personagem e voltar mantém as magias e os espaços (os dados são os mesmos)
  await janela.getByTestId("npc-configurar").click();
  await janela.getByTestId("apresentacao-personagem").click();
  await expect(janela.getByTestId("fh-aba-magias")).toHaveCount(0);
  await janela.getByTestId("ficha-aba-magias").click();
  await expect(janela.getByTestId("magias-nivel-2")).toContainText("Levitação");
  await expect(janela.getByTestId("espaco-total-2")).toHaveValue("3");
  await janela.getByTestId("ficha-aba-configurar").click();
  await janela.getByTestId("apresentacao-npc").click();
  await janela.getByTestId("npc-configurar").click();
  await abrirConjuracao(janela);
  await expect(janela.getByTestId("npc-conj-nivel-2")).toContainText("Levitação");
  await expect(janela.getByTestId("npc-espaco-2-3")).toBeVisible();
});

test("reordenar as magias de um círculo com Alt+seta", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarMagoNpc(p);
  const janela = await abrirNpc(p, MAGO_NPC);
  await abrirConjuracao(janela);
  const truques = () =>
    janela
      .locator('[data-testid="npc-conj-nivel-0"] [data-testid^="npc-conj-magia-"]')
      .evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
  expect(await truques()).toEqual(["Raio de Fogo", "Luz"]);
  await janela.getByTestId("npc-conj-magia-0").focus();
  await p.keyboard.press("Alt+ArrowDown");
  await expect.poll(truques).toEqual(["Luz", "Raio de Fogo"]);
});

async function nomeDe(janela: ReturnType<Page["locator"]>) {
  return {
    campo: janela.getByTestId("ficha-nome"),
    capitular: janela.getByTestId("ficha-nome-capitular"),
  };
}

test("o nome do personagem: a capitular é só desenho; o campo mostra o nome inteiro enquanto se edita", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarDarion(p);
  const janela = await abrirFicha(p, DARION_ID, "principal");
  const { campo, capitular } = await nomeDe(janela);

  await expect(capitular).toHaveText("D");
  await expect(capitular).toHaveAttribute("aria-hidden", "true");
  await expect(campo).toHaveValue("arion");
  await expect(campo).toHaveAttribute("aria-label", "Nome do personagem: Darion");

  // digita o nome completo; Enter grava e a primeira letra "pula" para a capitular
  await campo.fill("Vashta Carteiro");
  await expect(capitular).toHaveText("V");
  await campo.press("Enter");
  await expect(janela.getByTestId("janela-ficha-nome")).toHaveText("Vashta Carteiro");
  await expect(capitular).toHaveText("V");
  await expect(campo).toHaveValue("ashta Carteiro");
  await expect(campo).not.toBeFocused();

  // focar mostra o nome inteiro; Esc desfaz a edição
  await campo.focus();
  await expect(campo).toHaveValue("Vashta Carteiro");
  await campo.fill("Outro Nome");
  await expect(capitular).toHaveText("O");
  await campo.press("Escape");
  await expect(campo).toHaveValue("ashta Carteiro");
  await expect(capitular).toHaveText("V");
  await expect(janela.getByTestId("janela-ficha-nome")).toHaveText("Vashta Carteiro");

  // clicar na capitular foca o campo, com o nome inteiro
  await capitular.click();
  await expect(campo).toBeFocused();
  await expect(campo).toHaveValue("Vashta Carteiro");
  // nome vazio não grava
  await campo.fill("");
  await campo.press("Enter");
  await expect(campo).toHaveValue("ashta Carteiro");
  await expect(janela.getByTestId("janela-ficha-nome")).toHaveText("Vashta Carteiro");

  // Clássica: o nome inteiro num campo só, sem capitular
  await janela.getByTestId("ficha-aba-configurar").click();
  await janela.getByTestId("aparencia-classica").click();
  await janela.getByTestId("ficha-aba-principal").click();
  await expect(capitular).toHaveCount(0);
  await expect(campo).toHaveValue("Vashta Carteiro");
});

test("o nome do monstro: a mesma peça no bloco de NPC", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const janela = await abrirNpc(p, OGRO);
  const { campo, capitular } = await nomeDe(janela);

  await expect(capitular).toHaveText("O");
  await expect(capitular).toHaveAttribute("aria-hidden", "true");
  await expect(campo).toHaveValue("gro");
  await expect(campo).toHaveAttribute("aria-label", "Nome do monstro: Ogro");
  await campo.fill("Ogro Chefe");
  await campo.press("Enter");
  await expect(janela.getByTestId("janela-ficha-nome")).toHaveText("Ogro Chefe");
  await expect(campo).toHaveValue("gro Chefe");
  await campo.focus();
  await expect(campo).toHaveValue("Ogro Chefe");
  await campo.fill("Troll");
  await expect(capitular).toHaveText("T");
  await campo.press("Escape");
  await expect(campo).toHaveValue("gro Chefe");
  await expect(capitular).toHaveText("O");
  await capitular.click();
  await expect(campo).toBeFocused();
});
