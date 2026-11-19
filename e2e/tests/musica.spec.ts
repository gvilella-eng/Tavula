import type { Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa } from "./ajudasMapa";
import { arquivoWav, somDe } from "./ajudasSom";

// MU1: a música da mesa. O mestre põe músicas na biblioteca (aqui, wavs de silêncio gerados no teste), etiqueta em lote, dá
// energia, salva botões (um crescente e um aleatório) e toca para todos; o jogador ouve a mesma música (o gancho
// `__tabletopSom` diz o que "está tocando" sem depender do áudio real). "Voltar" retoma o botão anterior, o divisor entre
// "Efeitos e ambientes" e "Música" arrasta, minimiza e é lembrado, e o jogador nunca vê a biblioteca.

test.describe.configure({ timeout: 150_000 });

const NOMES = {
  lamina: "Lâminas no Vau",
  chefe: "O Trono Partido",
  taverna: "Taverna do Javali",
};

/** Abre a mesa de som (se não está aberta) e a configuração na aba Música. */
async function abrirBiblioteca(m: Page): Promise<void> {
  if (
    !(await m.getByTestId("painel-som").isVisible()) &&
    !(await m.getByTestId("som-faixa").isVisible())
  ) {
    await m.getByTestId("ferramenta-som").click();
  }
  await m.getByTestId("som-config-abrir").click();
  await expect(m.getByTestId("som-config")).toBeVisible();
  await m.getByTestId("som-config-aba-musica").click();
  await expect(m.getByTestId("musica-biblioteca")).toBeVisible();
}

const linha = (m: Page, nome: string) =>
  m.locator(`[data-testid="musica-linha"][data-nome="${nome}"]`);

async function marcarSo(m: Page, ...nomes: string[]): Promise<void> {
  for (const l of await m.getByTestId("musica-linha").all()) {
    const marcado = await l.getByTestId("musica-marcar").isChecked();
    const nome = (await l.getAttribute("data-nome")) ?? "";
    if (marcado !== nomes.includes(nome)) await l.getByTestId("musica-marcar").click();
  }
}

/** O mestre monta a biblioteca: 3 músicas, etiquetas em lote, energias e dois botões. Deixa a configuração fechada. */
async function montarBiblioteca(m: Page): Promise<void> {
  await abrirBiblioteca(m);
  await expect(m.getByTestId("musica-lista-vazia")).toBeVisible();
  await m
    .getByTestId("musica-adicionar-arquivo")
    .setInputFiles([
      arquivoWav(`${NOMES.lamina}.wav`, 3),
      arquivoWav(`${NOMES.chefe}.wav`, 4),
      arquivoWav(`${NOMES.taverna}.wav`, 5),
    ]);
  await expect(m.getByTestId("musica-linha")).toHaveCount(3);
  await expect(m.getByTestId("musica-contagem")).toHaveText("3 de 3 músicas");
  // a duração foi lida no navegador (3 s, 4 s e 5 s)
  await expect(linha(m, NOMES.lamina).getByTestId("musica-linha-detalhe")).toContainText("0:03");
  await expect(linha(m, NOMES.taverna).getByTestId("musica-linha-detalhe")).toContainText("0:05");

  // etiqueta em lote: as duas de luta ganham "Combate"; a outra, "Taverna"
  await marcarSo(m, NOMES.lamina, NOMES.chefe);
  await expect(m.getByTestId("musica-lote-conta")).toHaveText("2 selecionadas");
  await m.getByTestId("musica-lote-mais").click();
  await m.getByTestId("musica-lote-mais-entrada").fill("Combate");
  await m.getByTestId("musica-lote-mais-aplicar").click();
  await marcarSo(m, NOMES.taverna);
  await m.getByTestId("musica-lote-mais").click();
  await m.getByTestId("musica-lote-mais-entrada").fill("Taverna");
  await m.getByTestId("musica-lote-mais-aplicar").click();
  await expect(m.getByTestId("musica-etiqueta-Combate")).toContainText("2");
  await expect(m.getByTestId("musica-etiqueta-Taverna")).toContainText("1");

  // energia: lâminas 2, o chefe 5 (a taverna fica sem nota e vale 3)
  await marcarSo(m, NOMES.lamina);
  await m.getByTestId("musica-lote-energia").click();
  await m.getByTestId("musica-lote-energia-2").click();
  await marcarSo(m, NOMES.chefe);
  await m.getByTestId("musica-lote-energia").click();
  await m.getByTestId("musica-lote-energia-5").click();
  await expect(linha(m, NOMES.lamina).getByTestId("musica-linha-detalhe")).toContainText(
    "energia 2",
  );
  await expect(linha(m, NOMES.chefe).getByTestId("musica-linha-detalhe")).toContainText(
    "energia 5",
  );
  await expect(linha(m, NOMES.taverna).getByTestId("musica-linha-detalhe")).toContainText(
    "energia 3",
  );
  await marcarSo(m);

  // o filtro por etiqueta mostra só as que têm a etiqueta (várias etiquetas: só as que têm todas)
  await m.getByTestId("musica-etiqueta-Combate").click();
  await expect(m.getByTestId("musica-contagem")).toHaveText("2 de 3 músicas");
  await m.getByTestId("musica-etiqueta-Taverna").click();
  await expect(m.getByTestId("musica-contagem")).toHaveText("0 de 3 músicas");
  await m.getByTestId("musica-etiqueta-Taverna").click();

  // botão crescente: Combate
  await m.getByTestId("musica-ordem-crescente").check();
  await m.getByTestId("musica-salvar-botao").click();
  await m.getByTestId("musica-botao-nome").fill("Combate");
  await m.getByTestId("musica-botao-confirmar").click();
  await expect(m.getByTestId("musica-botao-salvo")).toHaveCount(1);
  await expect(m.getByTestId("musica-botao-salvo")).toContainText("crescente");

  // botão aleatório: Taverna
  await m.getByTestId("musica-etiqueta-Combate").click();
  await m.getByTestId("musica-etiqueta-Taverna").click();
  await m.getByTestId("musica-ordem-aleatoria").check();
  await m.getByTestId("musica-salvar-botao").click();
  await m.getByTestId("musica-botao-nome").fill("Taverna");
  await m.getByTestId("musica-botao-confirmar").click();
  await expect(m.getByTestId("musica-botao-salvo")).toHaveCount(2);

  await m.getByTestId("som-config-pronto").click();
  await expect(m.getByTestId("som-config")).toHaveCount(0);
}

const botaoDeMusica = (m: Page, nome: string) =>
  m.locator(`[data-testid="musica-botao"][data-nome="${nome}"]`);

test("o mestre monta a biblioteca, toca um botão crescente e o jogador ouve a mesma música; 'Voltar' retoma o anterior", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;
  await montarBiblioteca(m);

  // os botões aparecem na mesa de som, com quantas músicas cada um tem
  await expect(botaoDeMusica(m, "Combate")).toContainText("2");
  await expect(botaoDeMusica(m, "Taverna")).toContainText("1");
  await expect(m.getByTestId("musica-dica")).toBeVisible();

  // crescente: começa na energia mais baixa (as Lâminas, energia 2) para todos
  await botaoDeMusica(m, "Combate").click();
  await expect(botaoDeMusica(m, "Combate")).toHaveAttribute("data-ativo", "tocando");
  await expect(m.getByTestId("musica-atual")).toHaveText(NOMES.lamina);
  await expect.poll(async () => (await somDe(m)).musica?.nome).toBe(NOMES.lamina);
  // o jogador baixa o arquivo e toca a mesma música
  await expect
    .poll(async () => (await somDe(j)).musica?.nome, { timeout: 30_000 })
    .toBe(NOMES.lamina);
  expect((await somDe(j)).musica?.hash).toBe((await somDe(m)).musica?.hash);
  // o volume já vem com o geral da mesa e as preferências (0,7 do botão × 0,8 das preferências)
  expect((await somDe(j)).musica?.volume).toBeCloseTo(0.7 * 0.8, 5);

  // próxima: a de energia mais alta (o Trono Partido); anterior: recomeça ou volta
  await m.getByTestId("musica-proxima").click();
  await expect(m.getByTestId("musica-atual")).toHaveText(NOMES.chefe);
  await expect
    .poll(async () => (await somDe(j)).musica?.nome, { timeout: 30_000 })
    .toBe(NOMES.chefe);
  await m.getByTestId("musica-anterior").click();
  await expect(m.getByTestId("musica-atual")).toHaveText(/Lâminas no Vau|O Trono Partido/); // recomeça ou volta (a conta exata está na unidade)
  // pausar cala a música para todos; tocar retoma
  await m.getByTestId("musica-pausar").click();
  await expect.poll(async () => (await somDe(m)).musica).toBeNull();
  await expect.poll(async () => (await somDe(j)).musica).toBeNull();
  await expect(botaoDeMusica(m, "Combate")).toHaveAttribute("data-ativo", "pausado");
  await m.getByTestId("musica-pausar").click();
  await expect.poll(async () => (await somDe(j)).musica?.nome, { timeout: 15_000 }).toBeTruthy();

  // outro botão: a Taverna toca, e "Voltar a Combate" retoma o anterior
  await expect(m.getByTestId("musica-voltar")).toHaveCount(0);
  await botaoDeMusica(m, "Taverna").click();
  await expect(m.getByTestId("musica-atual")).toHaveText(NOMES.taverna);
  await expect
    .poll(async () => (await somDe(j)).musica?.nome, { timeout: 30_000 })
    .toBe(NOMES.taverna);
  await expect(m.getByTestId("musica-voltar")).toHaveText(/Voltar a Combate/);
  await m.getByTestId("musica-voltar").click();
  await expect(botaoDeMusica(m, "Combate")).toHaveAttribute("data-ativo", "tocando");
  await expect(m.getByTestId("musica-atual")).toHaveText(/Lâminas no Vau|O Trono Partido/);
  await expect(m.getByTestId("musica-voltar")).toHaveText(/Voltar a Taverna/);
  await expect
    .poll(async () => (await somDe(j)).musica?.nome, { timeout: 30_000 })
    .not.toBe(NOMES.taverna);
});

test("o jogador nunca vê a biblioteca, e a sala recusa tudo o que ele tentar", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;
  await montarBiblioteca(m);
  await botaoDeMusica(m, "Taverna").click();
  await expect
    .poll(async () => (await somDe(j)).musica?.nome, { timeout: 30_000 })
    .toBe(NOMES.taverna);

  // o que o jogador recebeu: o que toca, e nada da biblioteca (botões, etiquetas, energia, músicas que não tocam)
  const doJogador = j1.frames.join("\n");
  for (const proibido of [
    "musica.bibliotecaAlterada",
    '"botoes"',
    '"etiquetas"',
    '"energia"',
    '"anterior"',
    NOMES.lamina,
    NOMES.chefe,
  ]) {
    expect(doJogador, `o frame do jogador trouxe ${proibido}`).not.toContain(proibido);
  }
  await expect(j.getByTestId("painel-som")).toHaveCount(0);
  await expect(j.getByTestId("ferramenta-som")).toHaveCount(0);
  for (const [tipo, dados] of [
    ["musica.controle", { acao: "pausar" }],
    ["musica.volume", { volume: 0.1 }],
    ["musica.tirarFaixas", { hashes: ["a".repeat(64)] }],
    ["musica.botaoApagar", { id: "qualquer" }],
    [
      "musica.tocar",
      { filtro: { etiquetas: [], energiaMin: 1, energiaMax: 5, ordem: "aleatoria" } },
    ],
  ] as const) {
    const r = await enviarCru(j, intencaoCrua(tipo, dados));
    expect(r?.dados.codigo, tipo).toBe("sem_permissao");
  }
});

/** O valor do divisor (a parte de Efeitos e ambientes, em %). */
const divisao = async (m: Page) =>
  Number(await m.getByTestId("som-divisor").getAttribute("aria-valuenow"));

test("o divisor da faixa arrasta, anda pelo teclado, volta ao meio, é lembrado e cada lado minimiza", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  await m.getByTestId("ferramenta-som").click();
  await m.getByTestId("som-encaixar").click();
  await expect(m.getByTestId("som-faixa")).toBeVisible();
  const divisor = m.getByTestId("som-divisor");
  await expect(divisor).toHaveAttribute("role", "separator");
  await expect(divisor).toHaveAttribute("aria-orientation", "vertical");
  await expect(divisor).toHaveAttribute("aria-valuemin", "18");
  await expect(divisor).toHaveAttribute("aria-valuemax", "82");
  expect(await divisao(m)).toBe(50);

  // teclado: setas de 5 em 5; Home e End vão aos limites (nunca menos de 18% de cada lado)
  await divisor.focus();
  await m.keyboard.press("ArrowRight");
  await m.keyboard.press("ArrowRight");
  expect(await divisao(m)).toBe(60);
  await m.keyboard.press("ArrowLeft");
  expect(await divisao(m)).toBe(55);
  await m.keyboard.press("Home");
  expect(await divisao(m)).toBe(18);
  await m.keyboard.press("End");
  expect(await divisao(m)).toBe(82);
  // o duplo clique volta ao meio
  await divisor.dblclick();
  expect(await divisao(m)).toBe(50);

  // arrastar: o rótulo da divisão aparece enquanto arrasta e o lado da esquerda cresce
  const lado = m.getByTestId("som-lado-efeitos");
  const antes = (await lado.boundingBox())?.width ?? 0;
  const caixa = (await divisor.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  await m.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await m.mouse.down();
  await m.mouse.move(caixa.x + caixa.width / 2 + 120, caixa.y + caixa.height / 2, { steps: 6 });
  await expect(m.getByTestId("som-divisor-rotulo")).toBeVisible();
  await expect(m.getByTestId("som-divisor-rotulo")).toHaveText(/\d+% · \d+%/);
  await m.mouse.up();
  await expect(m.getByTestId("som-divisor-rotulo")).toHaveCount(0);
  expect(await divisao(m)).toBeGreaterThan(50);
  expect((await lado.boundingBox())?.width ?? 0).toBeGreaterThan(antes + 50);
  // arrastar além do limite para na proporção de 82%
  const c2 = (await divisor.boundingBox()) ?? caixa;
  await m.mouse.move(c2.x + c2.width / 2, c2.y + c2.height / 2);
  await m.mouse.down();
  await m.mouse.move(c2.x + 2000, c2.y + c2.height / 2, { steps: 5 });
  await m.mouse.up();
  expect(await divisao(m)).toBe(82);
  await divisor.focus();
  await m.keyboard.press("ArrowLeft");
  const lembrada = await divisao(m);
  expect(lembrada).toBe(77);

  // a divisão é lembrada depois de recarregar
  await m.reload();
  await m.getByTestId("ferramenta-som").click();
  await expect(m.getByTestId("som-faixa")).toBeVisible();
  expect(await divisao(m)).toBe(lembrada);

  // minimizar a música: vira uma tira fina com o nome na vertical, e o divisor some
  await m.getByTestId("som-minimizar-musica").click();
  await expect(m.getByTestId("som-trilho-musica")).toBeVisible();
  await expect(m.getByTestId("som-lado-musica")).toHaveCount(0);
  await expect(m.getByTestId("som-divisor")).toHaveCount(0);
  expect((await m.getByTestId("som-trilho-musica").boundingBox())?.width ?? 0).toBeLessThan(60);
  // lembrado depois de recarregar
  await m.reload();
  await m.getByTestId("ferramenta-som").click();
  await expect(m.getByTestId("som-trilho-musica")).toBeVisible();
  await m.getByTestId("som-trilho-musica").click();
  await expect(m.getByTestId("som-lado-musica")).toBeVisible();
  await expect(m.getByTestId("som-divisor")).toBeVisible();
  expect(await divisao(m)).toBe(lembrada);

  // minimizar os efeitos e ambientes: a música ocupa o espaço, e clicar na tira traz de volta
  await m.getByTestId("som-minimizar-efeitos").click();
  await expect(m.getByTestId("som-trilho-efeitos")).toBeVisible();
  await expect(m.getByTestId("som-lado-efeitos")).toHaveCount(0);
  await m.getByTestId("som-trilho-efeitos").click();
  await expect(m.getByTestId("som-lado-efeitos")).toBeVisible();
  await expect(m.getByTestId("som-lado-musica")).toBeVisible();
});

test("nos modos verticais (janela flutuante e janela própria) o divisor é horizontal e os lados minimizam", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  await m.getByTestId("ferramenta-som").click();
  await expect(m.getByTestId("painel-som")).toBeVisible();
  const divisor = m.getByTestId("som-divisor");
  await expect(divisor).toHaveAttribute("aria-orientation", "horizontal");
  const em = async (p: Page) =>
    Number(await p.getByTestId("som-divisor").getAttribute("aria-valuenow"));
  expect(await em(m)).toBe(50);
  await divisor.focus();
  await m.keyboard.press("ArrowDown");
  expect(await em(m)).toBe(55);
  await m.keyboard.press("ArrowUp");
  await m.keyboard.press("ArrowUp");
  expect(await em(m)).toBe(45);
  await divisor.dblclick();
  expect(await em(m)).toBe(50);
  // o de cima cresce ao arrastar para baixo
  const topo = m.getByTestId("som-lado-efeitos");
  const alturaAntes = (await topo.boundingBox())?.height ?? 0;
  const caixa = (await divisor.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  await m.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await m.mouse.down();
  await m.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2 + 60, { steps: 5 });
  await m.mouse.up();
  expect(await em(m)).toBeGreaterThan(50);
  expect((await topo.boundingBox())?.height ?? 0).toBeGreaterThan(alturaAntes);
  await divisor.dblclick();

  // minimizar a música: a tira é horizontal, em baixo
  await m.getByTestId("som-minimizar-musica").click();
  await expect(m.getByTestId("som-trilho-musica")).toBeVisible();
  const tira = (await m.getByTestId("som-trilho-musica").boundingBox())?.height ?? 999;
  expect(tira).toBeLessThan(60);
  await m.getByTestId("som-trilho-musica").click();

  // a janela própria do navegador tem o mesmo divisor, também horizontal
  const [popup] = await Promise.all([
    mestre.contexto.waitForEvent("page"),
    m.getByTestId("som-abrir-em-janela").click(),
  ]);
  await expect(popup.getByTestId("som-propria")).toBeVisible();
  await expect(popup.getByTestId("som-divisor")).toHaveAttribute("aria-orientation", "horizontal");
  await expect(popup.getByTestId("som-lado-musica")).toBeVisible();
  await popup.getByTestId("som-divisor").focus();
  await popup.keyboard.press("ArrowDown");
  expect(await em(popup)).toBe(55);
  await popup.close();
});
