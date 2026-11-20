import type { Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa } from "./ajudasMapa";
import { arquivoWav, configurarLugar, somDe } from "./ajudasSom";

// MU1: a música da mesa. O mestre põe músicas na biblioteca (aqui, wavs de silêncio gerados no teste), etiqueta em lote, dá
// energia, salva botões (um crescente e um aleatório) e toca para todos; o jogador ouve a mesma música (o gancho
// `__tabletopSom` diz o que "está tocando" sem depender do áudio real). "Voltar" retoma o botão anterior, as duas abas
// ("Efeitos e ambientes" e "Música", MU2) trocam, dizem o que toca e são lembradas, nenhum texto sai do cartão, e o jogador
// nunca vê a biblioteca.

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
  await abrirAba(m, "musica");

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
  await abrirAba(m, "musica");
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
/** Troca a aba da mesa de som (ela precisa estar à vista). */
async function abrirAba(m: Page, aba: "efeitos" | "musica"): Promise<void> {
  await m.getByTestId(`som-aba-${aba}`).click();
  await expect(m.getByTestId(`som-aba-${aba}`)).toHaveAttribute("aria-selected", "true");
}

test("a mesa de som tem duas abas: troca por clique e teclado, diz o que toca em cada uma, nada para ao trocar e a escolha é lembrada", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;
  await montarBiblioteca(m);
  await configurarLugar(m, "ambiente", 0, arquivoWav("taverna.wav", 4), "Taverna");
  await m.getByTestId("som-config-pronto").click();
  await expect(m.getByTestId("som-config")).toHaveCount(0);
  await m.getByTestId("som-encaixar").click();
  await expect(m.getByTestId("som-faixa")).toBeVisible();

  // duas abas, "Efeitos e ambientes" abre primeiro; o divisor e o minimizar do MU1 saíram
  await expect(m.getByTestId("som-abas")).toHaveAttribute("role", "tablist");
  await expect(m.getByTestId("som-abas").getByRole("tab")).toHaveCount(2);
  await expect(m.getByTestId("som-aba-efeitos")).toHaveAttribute("aria-selected", "true");
  await expect(m.getByTestId("som-efeitos")).toBeVisible();
  await expect(m.getByTestId("musica-corpo")).toHaveCount(0);
  await expect(m.getByTestId("som-divisor")).toHaveCount(0);
  await expect(m.getByTestId("som-minimizar-musica")).toHaveCount(0);
  // cada aba diz o que toca nela; nada toca ainda, então nenhum ponto
  await expect(m.getByTestId("som-aba-efeitos")).toHaveAttribute(
    "aria-label",
    "Efeitos e ambientes: nada tocando",
  );
  await expect(m.getByTestId("som-aba-musica")).toHaveAttribute("aria-label", "Música: parada");
  await expect(m.getByTestId("som-aba-musica-ponto")).toHaveCount(0);

  // trocar de aba só muda a vista
  await abrirAba(m, "musica");
  await expect(m.getByTestId("musica-corpo")).toBeVisible();
  await expect(m.getByTestId("som-efeitos")).toHaveCount(0);
  await botaoDeMusica(m, "Combate").click();
  await expect(m.getByTestId("som-aba-musica-estado")).toHaveCount(0); // MU3: sem subtítulo
  await expect(m.getByTestId("som-aba-musica")).toHaveAttribute("aria-label", /Combate/);
  await expect.poll(async () => (await somDe(m)).musica?.nome).toBeTruthy();

  // na outra aba: a música continua e um ponto marca a aba escondida que toca
  await abrirAba(m, "efeitos");
  await expect(m.getByTestId("som-aba-musica-ponto")).toBeVisible();
  await expect(m.getByTestId("som-aba-efeitos-ponto")).toHaveCount(0);
  expect((await somDe(m)).musica?.nome).toBeTruthy();
  await m.getByTestId("som-ambiente-ligar-0").click();
  await m.getByTestId("som-transporte").click();
  await expect(m.getByTestId("som-aba-efeitos")).toHaveAttribute("aria-label", /1 ambiente ligado/);
  await expect.poll(async () => (await somDe(j)).ambientes.length).toBe(1);
  await abrirAba(m, "musica");
  await expect(m.getByTestId("som-aba-efeitos-ponto")).toBeVisible();
  await expect(m.getByTestId("som-aba-musica-ponto")).toHaveCount(0);
  // nada parou: o ambiente e a música seguem tocando para o jogador
  expect((await somDe(j)).ambientes.length).toBe(1);
  await expect.poll(async () => (await somDe(j)).musica?.nome, { timeout: 30_000 }).toBeTruthy();

  // pausar mostra "pausada" no rótulo da aba
  await m.getByTestId("musica-pausar").click();
  await expect(m.getByTestId("som-aba-musica")).toHaveAttribute("aria-label", /pausada/);

  // teclado: as setas trocam de aba e levam o foco; Home e End vão às pontas
  const efeitos = m.getByTestId("som-aba-efeitos");
  const musica = m.getByTestId("som-aba-musica");
  await expect(musica).toHaveAttribute("tabindex", "0");
  await expect(efeitos).toHaveAttribute("tabindex", "-1");
  await musica.focus();
  await m.keyboard.press("ArrowLeft");
  await expect(efeitos).toHaveAttribute("aria-selected", "true");
  await expect(efeitos).toBeFocused();
  await expect(m.getByTestId("som-efeitos")).toBeVisible();
  await m.keyboard.press("ArrowRight");
  await expect(musica).toHaveAttribute("aria-selected", "true");
  await expect(musica).toBeFocused();
  await m.keyboard.press("Home");
  await expect(efeitos).toBeFocused();
  await m.keyboard.press("End");
  await expect(musica).toBeFocused();
  await expect(m.getByTestId("musica-corpo")).toBeVisible();

  // a aba escolhida é lembrada depois de recarregar
  await m.reload();
  await m.getByTestId("ferramenta-som").click();
  await expect(m.getByTestId("som-faixa")).toBeVisible();
  await expect(m.getByTestId("som-aba-musica")).toHaveAttribute("aria-selected", "true");
  await expect(m.getByTestId("musica-corpo")).toBeVisible();
});

test("a janela flutuante e a janela própria também têm as duas abas, e cada uma ocupa a largura toda", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  await m.getByTestId("ferramenta-som").click();
  await expect(m.getByTestId("painel-som")).toBeVisible();
  await expect(m.getByTestId("som-abas").getByRole("tab")).toHaveCount(2);
  await expect(m.getByTestId("som-aba-efeitos")).toHaveAttribute("aria-selected", "true");
  await abrirAba(m, "musica");
  const corpo = (await m.getByTestId("som-painel-musica").boundingBox())?.width ?? 0;
  const janela = (await m.getByTestId("painel-som").boundingBox())?.width ?? 0;
  expect(corpo).toBeGreaterThan(janela * 0.8);
  await abrirAba(m, "efeitos");

  // a janela própria do navegador: a mesma aba escolhida (preferência deste navegador)
  const [popup] = await Promise.all([
    mestre.contexto.waitForEvent("page"),
    m.getByTestId("som-abrir-em-janela").click(),
  ]);
  await expect(popup.getByTestId("som-propria")).toBeVisible();
  await expect(popup.getByTestId("som-abas").getByRole("tab")).toHaveCount(2);
  await abrirAba(popup, "musica");
  await expect(popup.getByTestId("som-painel-musica")).toBeVisible();
  await expect(popup.getByTestId("som-efeitos")).toHaveCount(0);
  await popup.getByTestId("som-aba-musica").focus();
  await popup.keyboard.press("ArrowLeft");
  await expect(popup.getByTestId("som-aba-efeitos")).toHaveAttribute("aria-selected", "true");
  await popup.close();
});

/** O que transborda do cartão: nome cortado ou fora do quadro, e o volume do ambiente ligado fora do cartão. */
const falhasDeTexto = (m: Page) =>
  m.evaluate(() => {
    const falhas: string[] = [];
    const dentro = (el: Element, cartao: Element) => {
      const a = el.getBoundingClientRect();
      const c = cartao.getBoundingClientRect();
      return (
        a.left >= c.left - 0.5 &&
        a.right <= c.right + 0.5 &&
        a.top >= c.top - 0.5 &&
        a.bottom <= c.bottom + 0.5
      );
    };
    for (const cartao of document.querySelectorAll<HTMLElement>(".som-efeito, .som-ambiente")) {
      const nome = cartao.querySelector<HTMLElement>(".som-nome, .som-nome-linha");
      if (nome) {
        const rotulo = nome.textContent ?? "?";
        if (nome.scrollWidth > nome.clientWidth + 1) falhas.push(`${rotulo}: corta na largura`);
        const r = document.createRange();
        r.selectNodeContents(nome);
        const linhas = new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size;
        if (linhas > 2)
          falhas.push(
            `${rotulo}: passa de 2 linhas (${linhas}; w ${nome.clientWidth}, cartão ${cartao.clientWidth}, faixa ${document.querySelector(".som-faixa-colunas")?.clientWidth})`,
          );
        if (!dentro(nome, cartao)) falhas.push(`${rotulo}: fora do cartão`);
      }
      for (const vol of cartao.querySelectorAll(".som-ambiente-vol, .som-ambiente-vol output")) {
        if (!dentro(vol, cartao)) falhas.push(`${nome?.textContent}: volume fora do cartão`);
      }
    }
    for (const vazio of document.querySelectorAll<HTMLElement>(".som-vazio")) {
      if (vazio.scrollWidth > vazio.clientWidth + 1) falhas.push("lugar vazio com texto cortado");
    }
    return falhas;
  });

for (const [largura, altura] of [
  [1280, 720],
  [1366, 768],
] as const) {
  test(`na faixa a ${largura}×${altura} nenhum nome nem o volume do ambiente sai do cartão`, async ({
    mesa,
  }) => {
    const mestre = await entrarNoMapa(mesa, "mestre");
    const m = mestre.pagina;
    await m.setViewportSize({ width: largura, height: altura });
    await configurarLugar(m, "efeito", 0, arquivoWav("a.wav", 2), "Aura de fogo");
    await configurarLugar(m, "efeito", 1, arquivoWav("b.wav", 2), "Ohhh da roda");
    await configurarLugar(m, "efeito", 2, arquivoWav("c.wav", 2), "Deslizamento");
    await configurarLugar(m, "ambiente", 0, arquivoWav("d.wav", 2), "Taverna viva");
    await configurarLugar(m, "ambiente", 1, arquivoWav("e.wav", 2), "Mata ao luar");
    await m.getByTestId("som-config-pronto").click();
    await m.getByTestId("som-encaixar").click();
    await expect(m.getByTestId("som-faixa")).toBeVisible();
    await expect(m.getByTestId("som-aba-efeitos")).toHaveAttribute("aria-selected", "true");

    // o nome inteiro está no rótulo acessível
    await expect(m.getByTestId("som-efeito-0")).toHaveAttribute("aria-label", /Aura de fogo/);
    // o lugar vazio de efeito mostra só o "+", e o texto está no rótulo e na dica
    await expect(m.getByTestId("som-efeito-vazio-5")).toHaveAttribute(
      "aria-label",
      /Adicionar efeito/,
    );
    await expect(m.getByTestId("som-efeito-vazio-5")).not.toContainText("adicionar");

    expect(await falhasDeTexto(m), "com os ambientes desligados").toEqual([]);
    // ligar um ambiente: o volume e a porcentagem ficam dentro do cartão
    await m.getByTestId("som-ambiente-ligar-0").click();
    await expect(m.getByTestId("som-ambiente-0")).toHaveAttribute("data-ligado", "sim");
    await expect(m.getByTestId("som-ambiente-volume-0-valor")).toBeVisible();
    expect(await falhasDeTexto(m), "com um ambiente ligado").toEqual([]);

    // a faixa não corta nenhuma aba na altura padrão
    const corpo = m.getByTestId("som-faixa-corpo");
    expect(await corpo.evaluate((e) => e.scrollHeight > e.clientHeight + 1)).toBe(false);
    await abrirAba(m, "musica");
    expect(await corpo.evaluate((e) => e.scrollHeight > e.clientHeight + 1)).toBe(false);
  });
}
