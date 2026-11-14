import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import { assets } from "./ajudasAssets";
import { gerarToken } from "./ajudasClaude";
import { abrirFicha, mandar } from "./ajudasFicha";
import { entrarNoMapa, noElementoDoMapa, pontoNaPagina, tokensDe } from "./ajudasMapa";
import { ClienteMcpHttp, URL_PELO_VITE } from "./ajudasMcp";

// N3a: o compêndio recebe monstros e itens mágicos. Vários arquivos em `compendio/` (aqui a `Memoria` do modo e2e faz o
// papel da pasta), "Carregar arquivos do compêndio…", busca e filtro de ND, arrastar o monstro para o mapa (nasce o NPC e
// o token), o item mágico no equipamento e o MCP criando NPCs de um monstro pelo nome.

test.describe.configure({ timeout: 120_000 });

const SRD = JSON.parse(
  readFileSync(new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url), "utf8"),
);
const TEXTO_DO_SRD = JSON.stringify(SRD);
const cabecalho = { formato: "tabletop-compendio", versao: 1 };
const arquivo = (nome: string, conteudo: object) => ({
  name: nome,
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify({ ...cabecalho, creditos: SRD.creditos, ...conteudo })),
});

/** Os nomes da lista que a seção mostra (cada linha leva `data-nome`). */
const nomesDe = (p: Page, testid: string) =>
  p.getByTestId(testid).evaluateAll((els) => els.map((e) => e.getAttribute("data-nome") ?? ""));

test("o mestre carrega monstros.json, itens.json e magias.json pela ação nova; busca 'goblin' e filtra por ND; o jogador também vê", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const m = mestre.pagina;
  await assets(m, "usarMemoriaComoPasta", true);
  await abrirAba(m, "compendio");
  await expect(m.getByTestId("compendio-como-montar")).toBeVisible();

  // um arquivo com erro: nada é gravado e a mensagem diz qual
  await m.getByTestId("compendio-arquivo").setInputFiles([
    arquivo("magias.json", { magias: SRD.magias }),
    {
      name: "monstros-ruins.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ ...cabecalho, monstros: [{ ...SRD.monstros[0], nd: "31" }] }),
      ),
    },
  ]);
  await expect(m.getByTestId("compendio-carregar-erro-motivo")).toContainText(
    "monstros-ruins.json: monstro 1, campo nd",
  );
  expect(await assets(m, "gravados")).toHaveLength(0);

  // os três arquivos certos, de uma vez
  await m
    .getByTestId("compendio-arquivo")
    .setInputFiles([
      arquivo("magias.json", { magias: SRD.magias, armas: SRD.armas }),
      arquivo("monstros.json", { monstros: SRD.monstros }),
      arquivo("itens.json", { itensMagicos: SRD.itensMagicos }),
    ]);
  await expect(m.getByTestId("compendio-lista")).toBeVisible();
  const gravados = await assets(m, "gravados");
  expect(gravados.map((g) => g.caminho).sort()).toEqual([
    "compendio/itens.json",
    "compendio/magias.json",
    "compendio/monstros.json",
  ]);
  await expect(m.getByTestId("compendio-contagem")).toHaveText("3 magias");

  // a seção Monstros: contagem, busca por nome e filtro de ND (as frações vêm antes do 1)
  await m.getByTestId("compendio-secao-monstros").click();
  await expect(m.getByTestId("compendio-contagem")).toHaveText("3 monstros");
  await m.getByTestId("compendio-busca").fill("GOBLIN");
  await expect.poll(() => nomesDe(m, "compendio-monstro")).toEqual(["Goblin"]);
  await expect(m.getByTestId("compendio-contagem")).toHaveText("1 de 3 monstros");
  await m.getByTestId("compendio-busca").fill("");
  await m.getByTestId("compendio-monstro-nd-de").selectOption("1");
  await expect.poll(() => nomesDe(m, "compendio-monstro")).toEqual(["Mago"]);
  await m.getByTestId("compendio-monstro-nd-de").selectOption("");
  await m.getByTestId("compendio-monstro-nd-ate").selectOption("1/4");
  await expect.poll(() => nomesDe(m, "compendio-monstro")).toEqual(["Goblin", "Lobo"]);
  await m.getByTestId("compendio-monstro-nd-ate").selectOption("");
  await m.getByTestId("compendio-monstro-tipo").selectOption("Fera");
  await expect.poll(() => nomesDe(m, "compendio-monstro")).toEqual(["Lobo"]);
  await m.getByTestId("compendio-limpar").click();

  // o cartão do monstro mostra o bloco inteiro
  await m.locator('[data-testid="compendio-monstro"][data-nome="Mago"]').click();
  const cartao = m.getByTestId("compendio-monstro-cartao");
  await expect(cartao).toContainText("Classe de Armadura");
  await expect(cartao).toContainText("2.300 XP");
  await expect(m.getByTestId("compendio-monstro-acoes")).toContainText("Adaga");
  await expect(m.getByTestId("compendio-monstro-conjuracao")).toContainText("1º nível: 4 espaços");
  await m.getByTestId("compendio-voltar").click();

  // os itens mágicos, com a raridade, e o filtro
  await m.getByTestId("compendio-secao-itensMagicos").click();
  await expect(m.getByTestId("compendio-contagem")).toHaveText("4 itens mágicos");
  await m.getByTestId("compendio-item-magico-raridade").selectOption("raro");
  await expect
    .poll(() => nomesDe(m, "compendio-entrada-itemMagico"))
    .toEqual(["Anel de Proteção", "Poção de Cura Superior"]);
  await expect(m.getByTestId("compendio-item-raridade").first()).toHaveText("Raro");

  // o jogador recebe o compêndio junto: vê os itens mágicos, não vê a seção Monstros (segredo do mestre) nem a carga de arquivos
  await abrirAba(j1.pagina, "compendio");
  await expect(j1.pagina.getByTestId("compendio-secao-itensMagicos")).toBeVisible();
  await expect(j1.pagina.getByTestId("compendio-secao-monstros")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("compendio-carregar-arquivos")).toHaveCount(0);
});

test("arrastar o monstro para o mapa cria o NPC e o token; a ficha abre no bloco com tudo; o botão cria o NPC na pasta", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await assets(p, "adicionarNaPasta", "compendio/magias.json", TEXTO_DO_SRD);
  await abrirAba(p, "compendio");
  await p.getByTestId("compendio-secao-monstros").click();
  await expect(p.getByTestId("compendio-contagem")).toHaveText("3 monstros");

  const alvo = await pontoNaPagina(p, 18.75, 14.25);
  await p
    .locator('[data-testid="compendio-monstro"][data-nome="Mago"]')
    .dragTo(p.getByTestId("mapa"), { targetPosition: await noElementoDoMapa(p, alvo) });
  await expect
    .poll(async () => (await tokensDe(p)).find((t) => t.nome === "Mago"))
    .toMatchObject({ camada: "tokens" });

  // a ficha do NPC está na aba Fichas e abre no bloco de monstro, com tudo do livro
  await abrirAba(p, "fichas");
  const item = p.getByTestId(/^ficha-abrir-pers-/).filter({ hasText: "Mago" });
  await expect(item).toHaveCount(1);
  await item.dblclick();
  await expect(p.getByTestId("npc-bloco")).toBeVisible();
  await expect(p.getByTestId("atributo-valor-int")).toHaveValue("17");
  await expect(p.getByTestId("npc-nd")).toHaveValue("6");
  await expect(p.getByTestId("npc-xp")).toContainText("2.300");
  await expect(p.getByTestId("npc-acao-0")).toContainText("Adaga");
  await expect(p.getByTestId("npc-secao-tracos")).toContainText("Conjuração");
  await p.getByTestId("npc-fita-conjuracao").click();
  await expect(p.getByTestId("npc-painel-conjuracao")).toContainText("Bola de Fogo");
  await expect(p.getByTestId("npc-painel-conjuracao")).toContainText("Detectar Magia");

  // o botão "Criar NPC" põe a ficha na pasta (sem token) e abre
  await abrirAba(p, "compendio");
  await p
    .locator('[data-testid="compendio-monstro"][data-nome="Goblin"]')
    .locator("xpath=ancestor::div[contains(@class,'entrada-do-compendio')]")
    .getByTestId("compendio-monstro-criar")
    .click();
  await expect(p.getByTestId("compendio-aviso-acao")).toContainText("Goblin entrou na pasta NPCs");
  await expect(p.getByTestId("npc-nd")).toHaveValue("1/4");
  expect((await tokensDe(p)).some((t) => t.nome === "Goblin")).toBe(false);
});

test("o item mágico vai para o equipamento com a descrição; a arma com bônus entra também nos ataques", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const p = mestre.pagina;
  await assets(p, "adicionarNaPasta", "compendio/magias.json", TEXTO_DO_SRD);
  await mandar(p, "personagem.criar", {
    personagem: {
      id: "pers-n3a",
      pastaId: "pasta-personagens",
      editores: { tipo: "jogadores", ids: ["jogador-1"] },
      nome: "Heroi N3a",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      ficha: { pvAtual: 10, pvMax: 10, atributos: { for: 16 } },
    },
  });
  const janela = await abrirFicha(p, "pers-n3a");
  await abrirAba(p, "compendio");
  await p.getByTestId("compendio-secao-itensMagicos").click();
  await expect(p.getByTestId("compendio-contagem")).toHaveText("4 itens mágicos");

  await p
    .locator('[data-testid="compendio-entrada-itemMagico"][data-nome="Anel de Proteção"]')
    .click();
  await expect(p.getByTestId("compendio-item-descricao")).toContainText("+1 de bônus na CA");
  await p.getByRole("button", { name: "Adicionar Anel de Proteção à ficha" }).click();
  await expect(p.getByTestId("compendio-aviso-acao")).toContainText("entrou na ficha de Heroi N3a");
  await expect(janela.getByTestId("item-nota-0")).toHaveValue(/Raro, exige sintonização/);
  await expect(janela.getByTestId("item-nota-0")).toHaveValue(/\+1 de bônus na CA/);

  await p.getByRole("button", { name: "Adicionar Espada Longa +1 à ficha" }).click();
  await expect(p.getByTestId("compendio-aviso-acao")).toContainText(
    "Espada Longa +1 entrou na ficha de Heroi N3a",
  );
  await expect(janela.getByTestId("item-nome-1")).toHaveValue("Espada Longa +1");
  // For 16 (+3) + proficiência (+2) + bônus mágico (+1)
  await expect(janela.getByTestId("ataque-0")).toContainText("Espada Longa +1");
  await expect(janela.getByTestId("ataque-0")).toContainText("+6");
});

test("o MCP cria vários NPCs a partir do monstro pelo nome (compêndio do exemplo, dentro da sala)", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { token } = await gerarToken(mestre.pagina);
  const mcp = await ClienteMcpHttp.conectar(token, { url: URL_PELO_VITE });
  try {
    const busca = await mcp.chamar("compendio", { tipo: "monstro", busca: "goblin", ndMax: "1" });
    expect(busca.erro, busca.texto).toBe(false);
    expect(busca.texto).toContain("monstro: Goblin");
    const itens = await mcp.chamar("compendio", { tipo: "itemMagico", raridade: "raro" });
    expect(itens.texto).toContain("Anel de Proteção");

    const r = await mcp.chamar("fichas", {
      fichas: [{ nome: "Goblin", monstro: "Goblin", quantidade: 4 }],
    });
    expect(r.erro, r.texto).toBe(false);
    for (const n of [1, 2, 3, 4]) expect(r.texto).toContain(`Criou "Goblin ${n}"`);
    await abrirAba(mestre.pagina, "fichas");
    await expect(
      mestre.pagina.getByTestId(/^ficha-abrir-/).filter({ hasText: /Goblin [0-9]/ }),
    ).toHaveCount(4);
  } finally {
    await mcp.fechar();
  }
});
