import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirPreferencia,
  enviarCru,
  expect,
  intencaoCrua,
  type Sessao,
  test,
} from "./ajudas";
import { arquivoPng, assets, definirMapa, imagensDoMapa, pngDeRuido } from "./ajudasAssets";
import { gerarToken } from "./ajudasClaude";
import { menuDoToken } from "./ajudasCombate";
import { enviarPor, linkDoTexto } from "./ajudasEnvio";
import { entrarNoMapa } from "./ajudasMapa";
import { ClienteMcpHttp, URL_PELO_VITE } from "./ajudasMcp";

// Q1: "Abrir ficha" no clique direito do token; Preferências sem a lista de desfazer; Importar sem exemplos; Transferências sem
// quebrar a letra; o compêndio e os arquivos do Claude que sobrevivem à pasta sem permissão; o aviso da pasta; e o mestre num
// segundo navegador, que carrega tudo da mesma pasta sem o primeiro estar online.

test.describe.configure({ timeout: 180_000 });

const TEXTO_DO_SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);

const abertos: ClienteMcpHttp[] = [];
test.afterEach(async () => {
  await Promise.all(abertos.splice(0).map((c) => c.fechar()));
});

test("'Abrir ficha' no clique direito do token abre a ficha, para o mestre e para o jogador no próprio token", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");

  await menuDoToken(mestre.pagina, "tok-jogador-1");
  const itemDoMestre = mestre.pagina.getByTestId("menu-token-abrir-ficha");
  await expect(itemDoMestre).toBeVisible();
  // o primeiro item do menu, logo abaixo do nome
  await expect(
    mestre.pagina.getByTestId("menu-token").getByRole("menuitem").first(),
  ).toHaveAttribute("data-testid", "menu-token-abrir-ficha");
  await itemDoMestre.click();
  await expect(mestre.pagina.getByTestId("menu-token")).toHaveCount(0);
  await expect(
    mestre.pagina.locator('[data-testid="janela-ficha"][data-personagem-id="pers-aldric"]'),
  ).toBeVisible();

  await menuDoToken(j1.pagina, "tok-jogador-1");
  await j1.pagina.getByTestId("menu-token-abrir-ficha").click();
  await expect(
    j1.pagina.locator('[data-testid="janela-ficha"][data-personagem-id="pers-aldric"]'),
  ).toBeVisible();
});

test("Preferências → Claude não tem a lista de desfazer; Mesa → Importar não tem as campanhas de exemplo", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirPreferencia(p, "claude");
  await expect(p.getByTestId("claude-lotes")).toHaveCount(0);
  await expect(p.getByTestId("claude-desfazer")).toHaveCount(0);
  await expect(p.getByTestId("claude-desfazer-tudo")).toHaveCount(0);
  await expect(p.getByText("O que o Claude fez")).toHaveCount(0);

  await abrirAba(p, "mesa");
  await expect(p.getByTestId("importar-escolher")).toBeVisible();
  await expect(p.getByTestId("campanhas-de-exemplo")).toHaveCount(0);
  await expect(p.getByText("Campanhas de exemplo")).toHaveCount(0);
  await expect(p.getByText("A Chama Primordial")).toHaveCount(0);
});

const NOME_LONGO =
  "um-nome-de-arquivo-muito-mas-muito-comprido-que-antes-quebrava-uma-letra-por-linha-na-coluna-do-nome-do-arquivo.png";

for (const tela of [
  { largura: 1280, altura: 720 },
  { largura: 1600, altura: 900 },
]) {
  test(`Transferências com nome longo não quebra letra por letra (${tela.largura}x${tela.altura})`, async ({
    mesa,
  }) => {
    const mestre = await entrarNoMapa(mesa, "mestre");
    const j1 = await entrarNoMapa(mesa, "jogador-1");
    await mestre.pagina.setViewportSize({ width: tela.largura, height: tela.altura });
    // o jogador registra um arquivo que ele não tem para mandar (ninguém online o tem): no mestre vira "indisponível"
    const r = await enviarCru(
      j1.pagina,
      intencaoCrua("asset.registrar", {
        metas: [
          {
            hash: "c".repeat(64),
            tipo: "token",
            mime: "image/png",
            bytes: 10,
            largura: 10,
            altura: 10,
            nomeOriginal: NOME_LONGO,
            pedacos: ["d".repeat(64)],
          },
        ],
      }),
    );
    expect(r?.tipo).not.toBe("erro");
    await abrirPreferencia(mestre.pagina, "ajuda");
    const linha = mestre.pagina
      .getByTestId("transferencia")
      .filter({ has: mestre.pagina.locator(`span.nome[title="${NOME_LONGO}"]`) });
    await expect(linha).toBeVisible();
    await expect(linha).toHaveAttribute("data-estado", "indisponivel");
    const nome = linha.locator(".nome");
    const caixa = await nome.boundingBox();
    expect(caixa).not.toBeNull();
    // numa linha só (letra por letra dava centenas de pixels de altura) e com largura de coluna de verdade
    expect(caixa?.height ?? 999).toBeLessThan(30);
    expect(caixa?.width ?? 0).toBeGreaterThan(120);
    await expect(nome).toHaveAttribute("title", NOME_LONGO);
    // o status fica na linha de baixo, também sem quebrar letra
    const estado = await linha.locator(".estado-presenca").boundingBox();
    expect(estado?.width ?? 0).toBeGreaterThan(120);
    expect((estado?.y ?? 0) >= (caixa?.y ?? 0) + (caixa?.height ?? 0) - 1).toBe(true);
  });
}

async function mcpDe(s: Sessao): Promise<ClienteMcpHttp> {
  const { token } = await gerarToken(s.pagina);
  const mcp = await ClienteMcpHttp.conectar(token, { url: URL_PELO_VITE });
  abertos.push(mcp);
  return mcp;
}

/**
 * O mestre num navegador com a pasta (simulada) liberada: o compêndio na pasta, um mapa pelo seletor e um token que o Claude
 * mandou. Espera tudo estar no cache e copiado na pasta; devolve os hashes.
 */
async function prepararMesaDoMestre(mestre: Sessao) {
  const p = mestre.pagina;
  await assets(p, "simularPasta", "autorizada");
  await assets(p, "adicionarNaPasta", "compendio/magias.json", TEXTO_DO_SRD);
  await abrirAba(p, "compendio");
  await expect(p.getByTestId("compendio-lista")).toBeVisible();
  await definirMapa(p, "cena-1", arquivoPng("sala.png", pngDeRuido(900, 700, 3, 2)));

  const mcp = await mcpDe(mestre);
  const pedido = await mcp.chamar("arquivos", {
    uso: "token",
    nome: "zarkhaal.png",
    token: "Aldric",
  });
  expect(pedido.erro, pedido.texto).toBe(false);
  const resposta = await enviarPor(linkDoTexto(pedido.texto), pngDeRuido(700, 700, 5, 35));
  expect(resposta.json?.estado, resposta.corpo).toBe("aplicado");
  await expect
    .poll(async () => (await imagensDoMapa(p)).tokensComImagem)
    .toContain("tok-jogador-1");

  const metas = await assets(p, "metas");
  const compendio = metas.find((m) => m.tipo === "compendio")?.hash ?? "";
  const token = metas.find((m) => m.nomeOriginal === "zarkhaal.png")?.hash ?? "";
  const mapa = metas.find((m) => m.tipo === "mapa" && m.nomeOriginal === "sala.png")?.hash ?? "";
  expect(compendio).toHaveLength(64);
  expect(token).toHaveLength(64);
  expect(mapa).toHaveLength(64);
  // tudo copiado em `arquivos-da-mesa/<hash>` da pasta
  await expect
    .poll(async () => (await assets(p, "gravados")).map((g) => g.caminho))
    .toEqual(
      expect.arrayContaining([`arquivos-da-mesa/${compendio}`, `arquivos-da-mesa/${token}`]),
    );
  return { compendio, token, mapa };
}

const esperarTudoPronto = async (p: Page, hashes: string[]) => {
  for (const h of hashes) {
    await expect.poll(() => assets(p, "pronto", h), { timeout: 30_000 }).toBe(true);
  }
};

test("recarregar o mestre sem a pasta liberada mantém o compêndio e o arquivo do Claude; o aviso de reautorizar aparece e some ao autorizar", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const { compendio, token } = await prepararMesaDoMestre(mestre);

  // recarrega: a "pasta" (memória do teste) some, como a permissão que o Chrome pede de novo depois de fechar
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await esperarTudoPronto(p, [compendio, token]);
  await abrirAba(p, "compendio");
  await expect(p.getByTestId("compendio-lista")).toBeVisible();
  // nada falta: nenhum aviso
  await expect(p.getByTestId("aviso-pasta")).toHaveCount(0);

  // a pasta pede permissão de novo: o aviso fica na mesa, com um clique
  await assets(p, "simularPasta", "reautorizar");
  const aviso = p.getByTestId("aviso-pasta");
  await expect(aviso).toBeVisible();
  await expect(aviso).toHaveAttribute("data-caso", "reautorizar");
  await expect(aviso).toContainText("permissão");
  await aviso.getByTestId("aviso-pasta-acao").click();
  await expect(aviso).toHaveCount(0);
  // o compêndio segue lá
  await expect(p.getByTestId("compendio-lista")).toBeVisible();
});

test("o mestre num segundo navegador: sem a pasta vê o aviso; com a mesma pasta tudo carrega dela, sem o primeiro online", async ({
  mesa,
}) => {
  const primeiro = await entrarNoMapa(mesa, "mestre");
  const { compendio, token, mapa } = await prepararMesaDoMestre(primeiro);
  const pasta = await assets(primeiro.pagina, "exportarPasta");
  // "fechei": o primeiro navegador sai
  await primeiro.contexto.close();

  // O segundo navegador, como mestre, no mesmo computador: não tem o cache nem a pasta.
  const segundo = await mesa.entrar("mestre");
  const p = segundo.pagina;
  await expect.poll(() => assets(p, "pronto", compendio)).toBe(false);
  // antes: ficava em "indisponível (ninguém com o arquivo está online)". Agora: o aviso, com o botão.
  // (o cenário do Vilella reproduzido: o segundo navegador não tem nada e ninguém online manda)
  await expect
    .poll(async () => (await assets(p, "status")).find((s) => s.hash === compendio)?.estado, {
      timeout: 30_000,
    })
    .toBe("indisponivel");
  const aviso = p.getByTestId("aviso-pasta");
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toHaveAttribute("data-caso", "escolher");
  await expect(aviso).toContainText("Os arquivos desta mesa ficam numa pasta do seu computador");
  await expect(aviso).toContainText("Escolha a pasta da mesa neste navegador");
  // a aba Compêndio diz a mesma coisa, em vez de "ninguém com o arquivo está online"
  await abrirAba(p, "compendio");
  await expect(p.getByTestId("compendio-pasta")).toHaveAttribute("data-caso", "escolher");
  await expect(p.getByTestId("compendio-indisponivel")).toHaveCount(0);
  await expect(p.getByTestId("compendio-pasta-acao")).toBeVisible();

  // a mesma pasta do computador (o conteúdo do primeiro navegador) escolhida neste: tudo carrega dela
  await assets(p, "importarPasta", pasta);
  await p.getByTestId("aviso-pasta-acao").click();
  await esperarTudoPronto(p, [compendio, token, mapa]);
  await expect(p.getByTestId("aviso-pasta")).toHaveCount(0);
  await expect(p.getByTestId("compendio-lista")).toBeVisible();
  await expect
    .poll(async () => (await imagensDoMapa(p)).tiles.length, { timeout: 30_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await imagensDoMapa(p)).tokensComImagem)
    .toContain("tok-jogador-1");
  // o que veio da pasta confere com o hash
  const conferem = await assets(p, "verificarCache");
  expect(conferem.every((c) => c.ok)).toBe(true);

  // e uma pasta errada (sem os arquivos) não finge que resolveu: pede a pasta certa
  const terceiro = await mesa.entrar("mestre");
  await assets(terceiro.pagina, "simularPasta", "autorizada");
  await expect(terceiro.pagina.getByTestId("aviso-pasta")).toHaveAttribute("data-caso", "trocar", {
    timeout: 30_000,
  });
});
