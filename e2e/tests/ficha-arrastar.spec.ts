import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import { assets } from "./ajudasAssets";
import { abrirFicha, criarPastaDoGrupo, ligarVerOutras, mandar, PASTA_GRUPO } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// V4b: arrastar do compêndio para a ficha (as áreas que aceitam acendem) e segurar para reordenar (mouse e Alt+↑/↓).
// O arrasto é o de verdade (`mouse.down`, `move`, `up`): o Chromium do Playwright dispara o HTML5 drag and drop.

const TEXTO_DO_SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);
const MAGO = "pers-mago-v4b";
const OGRO = "pers-ogro";

/** Um mago de nível 5 com poucas coisas: Inteligência 18 (+4), Força 16 (+3), proficiência +3. */
async function criarMago(
  mestre: Page,
  editores: string[] = ["jogador-1"],
  pastaId = "pasta-personagens",
) {
  await mandar(mestre, "personagem.criar", {
    personagem: {
      id: MAGO,
      pastaId,
      editores: { tipo: "jogadores", ids: editores },
      nome: "Mago V4b",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      ficha: {
        pvAtual: 20,
        pvMax: 20,
        apresentacao: "personagem",
        classes: [{ classe: "Mago", nivel: 5 }],
        atributos: { for: 16, des: 14, con: 12, int: 18, sab: 10, car: 8 },
        itens: [
          { nome: "Mochila", quantidade: 1 },
          { nome: "Pedra", quantidade: 1 },
          { nome: "Pena", quantidade: 1 },
        ],
        ataques: [
          { nome: "Adaga", dano: "1d4", tipo: "Perfurante" },
          { nome: "Funda", dano: "1d4", tipo: "Contundente" },
        ],
        magias: [
          { nome: "Luz", nivel: 0, preparada: true, descricao: "" },
          { nome: "Mão Mágica", nivel: 0, preparada: true, descricao: "" },
          { nome: "Escudo", nivel: 1, preparada: true, descricao: "" },
        ],
      },
    },
  });
}

/** O mestre põe o compêndio do exemplo na pasta e abre a aba dele; devolve a aba pronta. */
async function abrirCompendio(p: Page) {
  await assets(p, "adicionarNaPasta", "compendio/magias.json", TEXTO_DO_SRD);
  await abrirAba(p, "compendio");
  await expect(p.getByTestId("compendio-lista")).toBeVisible();
}

async function secao(p: Page, id: "magias" | "armas" | "itens") {
  await p.getByTestId(`compendio-secao-${id}`).click();
  await expect(p.getByTestId(`compendio-secao-${id}`)).toHaveAttribute("aria-pressed", "true");
}

const centro = async (l: Locator) => {
  const b = (await l.boundingBox()) as { x: number; y: number; width: number; height: number };
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
};

/** Arrasta de verdade e deixa `antesDeSoltar` olhar o que acendeu no meio do caminho. */
async function arrastar(
  p: Page,
  origem: Locator,
  alvo: Locator,
  antesDeSoltar?: () => Promise<void>,
  posicao: "meio" | "topo" = "meio",
  /** O alvo só aparece depois que o arrasto começa. */
  surge = false,
) {
  if (!surge) await alvo.scrollIntoViewIfNeeded();
  const o = await centro(origem);
  await p.mouse.move(o.x, o.y);
  await p.mouse.down();
  await p.mouse.move(o.x + 12, o.y + 12, { steps: 4 });
  if (surge) {
    await expect(alvo).toBeVisible();
    await alvo.scrollIntoViewIfNeeded();
  }
  const a = await centro(alvo);
  await p.mouse.move(a.x, posicao === "topo" ? a.b.y + 4 : a.y, { steps: 14 });
  // o arrasto acendeu as áreas e a tela se ajustou: um passo a mais, como a mão que ainda se mexe
  await p.mouse.move(a.x + 1, posicao === "topo" ? a.b.y + 4 : a.y, { steps: 2 });
  if (antesDeSoltar) await antesDeSoltar();
  await p.mouse.up();
}

const nomesDe = (janela: Locator, seletor: string) =>
  janela.locator(seletor).evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));

test("arrastar do compêndio para o personagem: arma vira ataque calculado, magia vai ao círculo, item vai ao equipamento; as áreas acendem", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarMago(p);
  const janela = await abrirFicha(p, MAGO, "principal");
  await abrirCompendio(p);

  // arma → Ataques e magias (só essa área acende: o equipamento não aceita arma)
  await secao(p, "armas");
  const espada = p.locator('[data-testid="compendio-entrada-arma"][data-nome="Espada longa"]');
  await expect(espada).toBeVisible();
  await expect(janela.getByTestId("fh-ataques")).not.toHaveAttribute("data-aceita-soltar", "true");
  const ataques = janela.getByTestId("fh-ataques");
  await arrastar(
    p,
    espada,
    janela.getByTestId("ataque-nome-1"),
    async () => {
      await expect(ataques).toHaveAttribute("data-aceita-soltar", "true");
      await expect(janela.getByTestId("fh-itens")).not.toHaveAttribute(
        "data-aceita-soltar",
        "true",
      );
      await expect(janela.getByTestId("soltar-aqui-ataques")).toBeVisible();
      // a linha indicadora mostra onde cai: no alto da Funda
      await expect(janela.getByTestId("ataque-1")).toHaveAttribute("data-indicador", "antes");
    },
    "topo",
  );
  // soltou: entrou na posição da Funda (empurrou ela), calculada: Força +3, proficiência +3
  await expect(janela.getByTestId("ataque-nome-1")).toContainText("Espada longa");
  await expect(janela.getByTestId("ataque-rolar-1")).toHaveText("+6");
  await expect(janela.getByTestId("ataque-dano-1")).toHaveText("1d8+3");
  await expect(janela.getByTestId("ataque-nome-2")).toContainText("Funda");
  await expect(ataques).not.toHaveAttribute("data-aceita-soltar", "true");
  // B1: o aviso é o toast padrão da mesa (role=status, some sozinho), não um texto colado no canto da ficha
  const toast = p.getByTestId("aviso");
  await expect(toast).toContainText("Espada longa entrou como ataque.");
  await expect(toast).toHaveAttribute("role", "status");
  await expect(janela.getByTestId("ficha-aviso")).toHaveCount(0);

  // item → Equipamento (quantidade 1, peso do compêndio); soltar fora de uma área aceita não faz nada
  await secao(p, "itens");
  const corda = p
    .locator('[data-testid="compendio-entrada-item"]')
    .filter({ hasText: "Corda de cânhamo" });
  await expect(corda).toBeVisible();
  const itensAntes = await janela.locator('[data-testid^="item-nome-"]').count();
  await arrastar(p, corda, janela.getByTestId("fh-pv"));
  await expect(janela.locator('[data-testid^="item-nome-"]')).toHaveCount(itensAntes);
  await arrastar(
    p,
    corda,
    janela.getByTestId("item-nome-1"),
    async () => {
      await expect(janela.getByTestId("fh-itens")).toHaveAttribute("data-aceita-soltar", "true");
      await expect(ataques).not.toHaveAttribute("data-aceita-soltar", "true");
    },
    "topo",
  );
  await expect(janela.locator('[data-testid^="item-nome-"]')).toHaveCount(itensAntes + 1);
  await expect(janela.getByTestId("item-nome-1")).toHaveValue("Corda de cânhamo (15 m)");
  await expect(janela.getByTestId("item-peso-1")).toHaveValue(/^4[.,]5$/);
  await expect(janela.getByTestId("item-quantidade-1")).toHaveValue("1");
  // um item com o nome de um modelo de luz da mesa ganha o Acender sozinho (regra do V4a2)
  const lanterna = p
    .locator('[data-testid="compendio-entrada-item"]')
    .filter({ hasText: "Lanterna" });
  await arrastar(p, lanterna, janela.getByTestId("fh-itens"));
  const nomesDosItens = () =>
    janela
      .locator('[data-testid^="item-nome-"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  await expect.poll(async () => (await nomesDosItens()).includes("Lanterna")).toBe(true);
  const iLanterna = (await nomesDosItens()).indexOf("Lanterna");
  await expect(janela.getByTestId(`item-acender-${iLanterna}`)).toBeVisible();

  // magia: na aba Magias só o círculo dela acende; entra no círculo, e de ataque ou salvaguarda aparece em Ataques
  await secao(p, "magias");
  const bola = p.locator('[data-testid="compendio-item"][data-nome="Bola de Fogo"]');
  await expect(bola).toBeVisible();
  await janela.getByTestId("ficha-aba-magias").click();
  await arrastar(p, bola, janela.getByTestId("magias-nivel-3"), async () => {
    await expect(janela.getByTestId("magias-nivel-3")).toHaveAttribute(
      "data-aceita-soltar",
      "true",
    );
    await expect(janela.getByTestId("magias-nivel-1")).not.toHaveAttribute(
      "data-aceita-soltar",
      "true",
    );
    await expect(janela.getByTestId("magias-nivel-0")).not.toHaveAttribute(
      "data-aceita-soltar",
      "true",
    );
  });
  await expect(janela.getByTestId("magias-nivel-3")).toContainText("Bola de Fogo");
  // soltar no círculo errado leva ao círculo certo? Só o dela aceita: soltar no 1º não faz nada
  const misseis = p.locator('[data-testid="compendio-item"][data-nome="Mísseis Mágicos"]');
  await arrastar(
    p,
    misseis,
    janela.getByTestId("magias-nivel-1"),
    async () => {
      await expect(janela.getByTestId("magias-nivel-1")).toHaveAttribute(
        "data-aceita-soltar",
        "true",
      );
    },
    "topo",
  );
  await expect(janela.getByTestId("magias-nivel-1")).toContainText("Mísseis Mágicos");
  // a Bola de Fogo é de salvaguarda: CD 8 + 3 + 4 = 15, em Ataques e magias
  await janela.getByTestId("ficha-aba-principal").click();
  const linhaDaMagia = janela
    .locator('[data-testid^="ataque-magia-"]')
    .filter({ hasText: "Bola de Fogo" });
  await expect(linhaDaMagia).toHaveCount(1);
  await expect(linhaDaMagia.locator('[data-testid^="ataque-rolar-magia-"]')).toHaveText("CD 15");
  await expect(linhaDaMagia.locator('[data-testid^="ataque-dano-magia-"]')).toHaveText("8d6");
  // e a de Mísseis Mágicos (sem jogada) fica só em Magias
  await expect(
    janela.locator('[data-testid^="ataque-magia-"]').filter({ hasText: "Mísseis" }),
  ).toHaveCount(0);
});

test("arrastar do compêndio para o NPC: arma vira ação calculada pelo ND, magia vai para a seção Conjuração e item vira traço", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${OGRO}`).dblclick();
  const janela = p.locator(`[data-testid="janela-ficha"][data-personagem-id="${OGRO}"]`);
  await expect(janela.getByTestId("npc-bloco")).toBeVisible();
  await abrirCompendio(p);

  await secao(p, "armas");
  const espada = p.locator('[data-testid="compendio-entrada-arma"][data-nome="Espada longa"]');
  await arrastar(
    p,
    espada,
    janela.getByTestId("npc-acao-1"),
    async () => {
      await expect(janela.getByTestId("npc-secao-acao")).toHaveAttribute(
        "data-aceita-soltar",
        "true",
      );
      await expect(janela.getByTestId("npc-secao-tracos")).not.toHaveAttribute(
        "data-aceita-soltar",
        "true",
      );
      await expect(janela.getByTestId("npc-acao-1")).toHaveAttribute("data-indicador", "antes");
    },
    "topo",
  );
  // Força 19 (+4), proficiência +2 do ND 2: +6 para acertar, dano 1d8+4, entre a Clava e a Azagaia
  await expect(janela.getByTestId("npc-acao-titulo-1")).toContainText("Espada longa");
  await expect(janela.getByTestId("npc-acao-acerto-1")).toHaveText("+6");
  await expect(janela.getByTestId("npc-acao-dano-1")).toHaveText("1d8+4");
  await expect(janela.getByTestId("npc-acao-titulo-2")).toContainText("Azagaia");

  await secao(p, "magias");
  const bola = p.locator('[data-testid="compendio-item"][data-nome="Bola de Fogo"]');
  // com o Bestiário aberto, a fita Conjuração acende como alvo (V8) e só ela; a magia cai na Conjuração
  const fita = janela.getByTestId("npc-fita-conjuracao");
  await expect(janela.getByTestId("npc-secao-conjuracao")).toHaveCount(0);
  await arrastar(p, bola, fita, async () => {
    await expect(fita).toHaveAttribute("data-aceita-soltar", "true");
    await expect(janela.getByTestId("npc-secao-tracos")).not.toHaveAttribute(
      "data-aceita-soltar",
      "true",
    );
    await expect(janela.getByTestId("npc-secao-acao")).not.toHaveAttribute(
      "data-aceita-soltar",
      "true",
    );
  });
  // a magia entra em `magias`, no círculo dela, e não vira traço; a janela passou para a Conjuração
  await expect(fita).toHaveAttribute("aria-selected", "true");
  await expect(janela.getByTestId("npc-conj-nivel-3")).toContainText("Bola de Fogo");
  await janela.getByTestId("npc-fita-bestiario").click();
  await expect(janela.getByTestId("traco-alternar-0")).toHaveCount(0);

  await secao(p, "itens");
  const pocao = p
    .locator('[data-testid="compendio-entrada-item"]')
    .filter({ hasText: "Poção de cura" });
  await arrastar(p, pocao, janela.getByTestId("npc-secao-tracos"));
  await expect(janela.getByTestId("traco-alternar-0")).toContainText("Poção de cura");
});

test("o jogador só solta numa ficha que edita; o botão Adicionar usa a mesma conversão", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarPastaDoGrupo(mestre.pagina);
  await criarMago(mestre.pagina, ["jogador-2"], PASTA_GRUPO);
  await ligarVerOutras(mestre.pagina, true);
  await assets(mestre.pagina, "adicionarNaPasta", "compendio/magias.json", TEXTO_DO_SRD);
  const p = j1.pagina;

  // a ficha do mago é do jogador-2: o jogador-1 a vê (Ver fichas dos outros), mas nada acende nem entra
  const janela = await abrirFicha(p, MAGO, "principal");
  await expect(janela.getByTestId("fh-ataques")).toBeVisible();
  await abrirAba(p, "compendio");
  await expect(p.getByTestId("compendio-lista")).toBeVisible();
  await secao(p, "armas");
  const espada = p.locator('[data-testid="compendio-entrada-arma"][data-nome="Espada longa"]');
  await arrastar(p, espada, janela.getByTestId("fh-ataques"), async () => {
    await expect(janela.getByTestId("fh-ataques")).not.toHaveAttribute(
      "data-aceita-soltar",
      "true",
    );
    await expect(janela.getByTestId("soltar-aqui-ataques")).toHaveCount(0);
  });

  // o personagem dele (Aldric) recebe pelo botão Adicionar, e a lista de fichas do botão só traz o que ele edita
  const alvos = await p.getByTestId("compendio-alvo").locator("option").allTextContents();
  expect(alvos).toEqual(["Aldric"]);
  await p.getByTestId("compendio-arma-adicionar").first().click();
  await expect(p.getByTestId("compendio-aviso-acao")).toContainText("entrou na ficha de Aldric");
  const aldric = await abrirFicha(p, "pers-aldric", "principal");
  await expect(aldric.locator('[data-testid^="ataque-nome-"]').first()).toBeVisible();
  // a soltura recusada não mandou nada à sala (a do Aldric, que veio depois, já chegou): o mago segue com 2 ataques
  await expect(janela.locator('[data-testid^="ataque-nome-"]')).toHaveCount(2);
});

test('B1: o "Ficha de" do Compêndio segue a ficha em foco; a escolha à mão vale até focar outra', async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarMago(p);
  await abrirCompendio(p);
  const alvo = p.getByTestId("compendio-alvo");
  const ver = async () => {
    await abrirAba(p, "compendio");
    await secao(p, "armas");
    return alvo;
  };

  await abrirFicha(p, MAGO, "principal");
  await expect(await ver()).toHaveValue(MAGO);
  await abrirFicha(p, "pers-aldric", "principal");
  await expect(await ver()).toHaveValue("pers-aldric");

  // a escolha à mão vale enquanto a ficha em foco não muda (abrir a mesma de novo não muda nada)
  await alvo.selectOption(MAGO);
  await expect(alvo).toHaveValue(MAGO);
  await abrirFicha(p, "pers-aldric", "principal");
  await expect(await ver()).toHaveValue(MAGO);

  // focar outra ficha troca o alvo: primeiro o Mago, depois o Aldric de novo
  await abrirFicha(p, MAGO, "principal");
  await expect(await ver()).toHaveValue(MAGO);
  await abrirFicha(p, "pers-aldric", "principal");
  await expect(await ver()).toHaveValue("pers-aldric");
});

test("segurar e arrastar reordena (com a linha indicadora, Esc cancela) e Alt+↑/↓ move uma posição, no NPC e no personagem", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarMago(p);

  // --- NPC: as ações ---
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${OGRO}`).dblclick();
  const npc = p.locator(`[data-testid="janela-ficha"][data-personagem-id="${OGRO}"]`);
  await expect(npc.getByTestId("npc-bloco")).toBeVisible();
  const ordemDasAcoes = () => nomesDe(npc, '[data-testid^="npc-acao-titulo-"]');
  expect(await ordemDasAcoes()).toEqual(["Clava Grande", "Azagaia"]);

  // segurar ~300 ms levanta; arrastar para cima da primeira mostra a linha indicadora; soltar move
  const origem = npc.getByTestId("npc-acao-titulo-1");
  await origem.scrollIntoViewIfNeeded();
  const o = await centro(origem);
  const alto = (await npc.getByTestId("npc-acao-0").boundingBox()) as { y: number };
  await p.mouse.move(o.x, o.y);
  await p.mouse.down();
  await expect(npc.getByTestId("npc-acao-1")).toHaveAttribute("data-levantada", "true", {
    timeout: 3000,
  });
  await p.mouse.move(o.x, alto.y + 6, { steps: 10 });
  await expect(npc.getByTestId("npc-acao-0")).toHaveAttribute("data-indicador", "antes");
  await p.mouse.up();
  await expect.poll(ordemDasAcoes).toEqual(["Azagaia", "Clava Grande"]);
  // um clique curto continua expandindo (e o clique de depois de arrastar não expandiu nada)
  await expect(npc.getByTestId("npc-acao-titulo-0")).toHaveAttribute("aria-expanded", "false");
  await npc.getByTestId("npc-acao-titulo-0").click();
  await expect(npc.getByTestId("npc-acao-titulo-0")).toHaveAttribute("aria-expanded", "true");
  await npc.getByTestId("npc-acao-titulo-0").click();

  // Esc cancela: a linha volta ao normal e nada muda
  await npc.getByTestId("npc-acao-titulo-0").scrollIntoViewIfNeeded();
  const o2 = await centro(npc.getByTestId("npc-acao-titulo-0"));
  const baixo = (await npc.getByTestId("npc-acao-1").boundingBox()) as {
    y: number;
    height: number;
  };
  await p.mouse.move(o2.x, o2.y);
  await p.mouse.down();
  await expect(npc.getByTestId("npc-acao-0")).toHaveAttribute("data-levantada", "true", {
    timeout: 3000,
  });
  await p.mouse.move(o2.x, baixo.y + baixo.height - 4, { steps: 10 });
  await p.keyboard.press("Escape");
  await p.mouse.up();
  await expect(npc.getByTestId("npc-acao-0")).not.toHaveAttribute("data-levantada", "true");
  expect(await ordemDasAcoes()).toEqual(["Azagaia", "Clava Grande"]);

  // Alt+↓ no título move uma posição, e o foco acompanha
  await npc.getByTestId("npc-acao-titulo-0").focus();
  await p.keyboard.press("Alt+ArrowDown");
  await expect.poll(ordemDasAcoes).toEqual(["Clava Grande", "Azagaia"]);
  await expect(npc.getByTestId("npc-acao-titulo-1")).toBeFocused();
  await p.keyboard.press("Alt+ArrowUp");
  await expect.poll(ordemDasAcoes).toEqual(["Azagaia", "Clava Grande"]);

  // --- personagem: o equipamento (a alça no começo da linha), e a ficha guarda a ordem nova ---
  const janela = await abrirFicha(p, MAGO, "principal");
  const itens = () =>
    janela
      .locator('[data-testid^="item-nome-"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(await itens()).toEqual(["Mochila", "Pedra", "Pena"]);
  const alca = janela.locator('[data-testid="item-2"] .fl-alca');
  await alca.scrollIntoViewIfNeeded();
  const a = await centro(alca);
  const topo = (await janela.getByTestId("item-0").boundingBox()) as { y: number };
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await expect(
    janela.getByTestId("item-2").locator("xpath=ancestor::*[@data-levantada][1]"),
  ).toHaveCount(1, {
    timeout: 3000,
  });
  await p.mouse.move(a.x, topo.y + 4, { steps: 10 });
  await p.mouse.up();
  await expect.poll(itens).toEqual(["Pena", "Mochila", "Pedra"]);
  await janela.getByTestId("item-nome-0").focus();
  await p.keyboard.press("Alt+ArrowDown");
  await expect.poll(itens).toEqual(["Mochila", "Pena", "Pedra"]);
  // a ordem foi para a sala: fechar manda o que sobrou; recarregar a página e abrir de novo mostra a mesma
  await janela.getByTestId("janela-ficha-fechar").click();
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  const depois = await abrirFicha(p, MAGO, "principal");
  await expect
    .poll(() =>
      depois
        .locator('[data-testid^="item-nome-"]')
        .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value)),
    )
    .toEqual(["Mochila", "Pena", "Pedra"]);

  // os ataques: Alt+↑ na segunda linha (nome do ataque em foco)
  await depois.getByTestId("ataque-nome-1").focus();
  await p.keyboard.press("Alt+ArrowUp");
  await expect(depois.getByTestId("ataque-nome-0")).toContainText("Funda");
  await expect(depois.getByTestId("ataque-nome-0")).toBeFocused();
});
