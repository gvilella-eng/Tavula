import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { abrirAba, expect, type Sessao, test } from "./ajudas";
import { abrirFicha, DARION_ID, mandar } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// Lote 10: importação da ficha em PDF (fixtures/fichas/darion.pdf). O PDF é lido no
// navegador; só o JSON da ficha vai para a sala, e só depois de "Confirmar".

const decodificado = fileURLToPath(
  new URL("../../fixtures/fichas/darion.pdf", import.meta.url),
);

/** Um item "Darion" simples, para a importação passar por cima. */
async function criarDarionSimples(mestre: Page) {
  await mandar(mestre, "personagem.criar", {
    personagem: {
      id: DARION_ID,
      pastaId: "pasta-personagens",
      editores: { tipo: "jogadores", ids: ["jogador-1"] },
      nome: "Darion",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 18 },
      ficha: { pvAtual: 10, pvMax: 10, raca: "Humano" },
    },
  });
}

/** Menu do item → "Importar ficha (PDF)" → escolhe o PDF do Darion. */
async function escolherPdfPeloItem(p: Page, personagemId: string) {
  if (!(await p.getByTestId("aba-painel-fichas").isVisible())) await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-menu-${personagemId}`).click();
  const [seletor] = await Promise.all([
    p.waitForEvent("filechooser"),
    p.getByTestId(`ficha-menu-importar-pdf-${personagemId}`).click(),
  ]);
  await seletor.setFiles(decodificado);
  await expect(p.getByTestId("revisao-pdf")).toBeVisible();
}

const fichaFrames = (s: Sessao) => s.enviados.filter((f) => /"tipo":"(ficha|personagem)\./.test(f));

test("importar o PDF do Darion pelo menu do item: revisão com incertos em amarelo, corrige um machadinho, confirma e o mestre vê a ficha", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarionSimples(mestre.pagina);
  const p = mestre.pagina;
  const antes = fichaFrames(mestre).length;

  await escolherPdfPeloItem(p, DARION_ID);
  const revisao = p.getByTestId("revisao-pdf");
  // Nada foi para a sala só por ler o PDF.
  expect(fichaFrames(mestre)).toHaveLength(antes);

  // Os incertos aparecem em amarelo.
  await expect(p.getByTestId("revisao-total-incertos")).toContainText("campos para revisar");
  const celula = revisao.locator("td", { has: p.getByTestId("revisao-campo-ataques.1.nome") });
  await expect(celula).toHaveAttribute("data-incerto", "true");
  await expect(celula).toHaveCSS("background-color", /rgba\(245, 197, 66, 0\.1/);
  await expect(p.getByTestId("revisao-campo-ataques.1.nome")).toHaveValue("Machadinho …");
  // O nome recuperado vem preenchido e marcado.
  await expect(p.getByTestId("revisao-campo-ataques.6.nome")).toHaveValue(
    "Cure Wounds - Curar Ferimentos",
  );
  await expect(
    revisao.locator("td", { has: p.getByTestId("revisao-campo-ataques.6.nome") }),
  ).toContainText("recuperado");
  // O trecho do PDF fica ao lado, e as caixas de recurso estão marcadas.
  await expect(p.getByTestId("revisao-trecho-ataques")).toContainText("Machadinho … | +11 | 1d6+7");
  await expect(p.getByTestId("revisao-recurso-0")).toHaveAttribute("data-incerto", "true");
  await expect(p.getByTestId("revisao-recurso-3")).toHaveAttribute("data-incerto", "true");
  // A descrição da magia vem inteira.
  await p
    .getByTestId("revisao-magias")
    .locator("summary", { hasText: "Convocar Familiar" })
    .click();
  await expect(p.getByTestId("revisao-magias")).toContainText(
    "UPDATE: 1d10+1d6-1 pra random summon.",
  );

  // Corrige o nome de um machadinho e confirma (importar por cima pede confirmação).
  await p.getByTestId("revisao-campo-ataques.1.nome").fill("Machadinho de Mão");
  await p.getByTestId("revisao-confirmar").click();
  await expect(p.getByTestId("revisao-sobrescrever")).toContainText("TODA a ficha de Darion");
  expect(fichaFrames(mestre)).toHaveLength(antes);
  await p.getByTestId("revisao-sobrescrever-sim").click();
  await expect(revisao).toBeHidden();

  // Um único `ficha.alterar`, com a ficha inteira (JSON); a ficha do mestre foi trocada.
  const enviados = fichaFrames(mestre).slice(antes);
  expect(enviados).toHaveLength(1);
  const dados = JSON.parse(enviados[0] as string).dados as {
    personagemId: string;
    operacoes: { caminho: string; valor: { ataques: { nome: string }[] } }[];
  };
  expect(dados.personagemId).toBe(DARION_ID);
  expect(dados.operacoes).toHaveLength(1);
  expect(dados.operacoes[0]?.caminho).toBe("");
  expect(dados.operacoes[0]?.valor.ataques[1]?.nome).toBe("Machadinho de Mão");

  const janela = await abrirFicha(p, DARION_ID, "principal");
  await expect(janela.getByTestId("janela-ficha-resumo")).toContainText(
    "Patrulheiro 5 / Clérigo 5",
  );
  await expect(janela.getByTestId("janela-ficha-resumo")).toContainText("Elfo da floresta");
  await expect(janela.getByTestId("ataque-nome-1")).toHaveValue("Machadinho de Mão");
  await expect(janela.getByTestId("ataque-nome-2")).toHaveValue("Machadinho …");
  await expect(janela.getByTestId("atributo-mod-for")).toHaveText("+7");
  await expect(janela.getByTestId("pericia-total-atletismo")).toHaveText("+11");
  await expect(janela.getByTestId("percepcao-passiva")).toHaveText("12");
  await expect(janela.getByTestId(`pv-atual-${DARION_ID}`)).toHaveValue("97");
  await janela.getByTestId("ficha-aba-magias").click();
  await expect(janela.getByTestId("espacos-resumo-1")).toHaveText("4/4");
});

test("Cancelar na revisão não manda nenhum frame de ficha para a sala e a ficha continua como estava", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarionSimples(mestre.pagina);
  const p = mestre.pagina;
  const antes = fichaFrames(mestre).length;

  await escolherPdfPeloItem(p, DARION_ID);
  await p.getByTestId("revisao-campo-ataques.1.nome").fill("Machadinho que não vai");
  await p.getByTestId("revisao-cancelar").click();
  await expect(p.getByTestId("revisao-pdf")).toBeHidden();
  // Também cancela pelo "Voltar" da confirmação de importar por cima.
  await escolherPdfPeloItem(p, DARION_ID);
  await p.getByTestId("revisao-confirmar").click();
  await p.getByTestId("revisao-sobrescrever-nao").click();
  await expect(p.getByTestId("revisao-pdf")).toBeVisible();
  await p.getByTestId("revisao-fechar").click();
  await expect(p.getByTestId("revisao-pdf")).toBeHidden();

  await p.waitForTimeout(500);
  expect(fichaFrames(mestre)).toHaveLength(antes);
  const janela = await abrirFicha(p, DARION_ID, "principal");
  await expect(janela.getByTestId(`pv-atual-${DARION_ID}`)).toHaveValue("10");
  await expect(janela.getByTestId("janela-ficha-resumo")).toContainText("Humano");
});

test("o PDF não sai do PC: nenhum frame do WebSocket leva os bytes do PDF, só o JSON da ficha", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const jogador = await entrarNoMapa(mesa, "jogador-1");
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarionSimples(mestre.pagina);
  const p = jogador.pagina;

  // O jogador que edita o item também importa (o menu aparece só para quem edita).
  await escolherPdfPeloItem(p, DARION_ID);
  await p.getByTestId("revisao-confirmar").click();
  await p.getByTestId("revisao-sobrescrever-sim").click();
  await expect(p.getByTestId("revisao-pdf")).toBeHidden();
  const janela = await abrirFicha(mestre.pagina, DARION_ID, "principal");
  await expect(janela.getByTestId(`pv-atual-${DARION_ID}`)).toHaveValue("97");

  const todos = [...jogador.enviados, ...mestre.enviados];
  expect(todos.some((f) => f.includes("%PDF"))).toBe(false);
  expect(jogador.enviadosBinarios).toHaveLength(0);
  expect(mestre.enviadosBinarios).toHaveLength(0);
  // Só a ficha em JSON: poucas dezenas de KB (o PDF tem várias centenas) e `ficha.alterar` válido.
  const fichas = jogador.enviados.filter((f) => f.includes('"ficha.alterar"'));
  expect(fichas).toHaveLength(1);
  expect(JSON.parse(fichas[0] as string).tipo).toBe("ficha.alterar");
  expect((fichas[0] as string).length).toBeLessThan(120_000);
  // Nem nos frames recebidos pelo mestre.
  expect(mestre.frames.some((f) => f.includes("%PDF"))).toBe(false);
});

test("+ Novo a partir de PDF cria o item na pasta Personagens com o nome do PDF e abre a ficha", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "fichas");
  const [seletor] = await Promise.all([
    p.waitForEvent("filechooser"),
    p.getByTestId("ficha-novo-pdf").click(),
  ]);
  await seletor.setFiles(decodificado);
  await expect(p.getByTestId("revisao-pdf")).toBeVisible();
  await expect(p.getByTestId("revisao-nome")).toHaveValue("Darion");
  // Item novo: não há "importar por cima".
  await p.getByTestId("revisao-confirmar").click();
  await expect(p.getByTestId("revisao-pdf")).toBeHidden();
  const janela = p.locator('[data-testid="janela-ficha"]');
  await expect(janela).toBeVisible();
  await expect(janela.getByTestId("janela-ficha-nome")).toHaveText("Darion");
  await expect(janela.getByTestId("janela-ficha-resumo")).toContainText(
    "Patrulheiro 5 / Clérigo 5",
  );
  await expect(janela.getByTestId("pericia-total-furtividade")).toHaveText("+8");
  await expect(p.locator('[data-testid^="ficha-nome-"]', { hasText: "Darion" })).toHaveCount(1);
});

test("um arquivo que não é PDF mostra o erro e não manda nada", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "fichas");
  const antes = fichaFrames(mestre).length;
  const [seletor] = await Promise.all([
    p.waitForEvent("filechooser"),
    p.getByTestId("ficha-novo-pdf").click(),
  ]);
  await seletor.setFiles({
    name: "lixo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("isto não é um pdf"),
  });
  await expect(p.getByTestId("revisao-erro-leitura")).toContainText("Nada foi importado");
  await p.getByTestId("revisao-erro-leitura").getByRole("button", { name: "Fechar" }).click();
  expect(fichaFrames(mestre)).toHaveLength(antes);
});
