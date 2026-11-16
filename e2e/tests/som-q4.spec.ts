import { abrirPreferencia, enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { esperarPronto } from "./ajudasAssets";
import { entrarNoMapa } from "./ajudasMapa";
import {
  arquivoWav,
  configurarLugar,
  enviarEEsperarSnapshot,
  esperarHashDoSom,
  hashDoSom,
  somDe,
} from "./ajudasSom";

// Q4: a mesa de som. O mestre configura 8 efeitos e 8 ambientes (arquivo, nome, ícone, cor, volume) e toca: o efeito toca
// uma vez para todos, os ambientes ligam e desligam sozinhos, vários ao mesmo tempo, cada um com o seu volume. Os arquivos
// são wavs de silêncio gerados aqui; o gancho `__tabletopSom` diz o que "está tocando" (o volume já com o geral da mesa
// de som e com as preferências de cada pessoa).

/** 0,8 (volume do lugar) × 0,8 (volume geral das preferências) × 1 (o resto): o que se ouve com os padrões. */
const COM_OS_PADROES = 0.64;

test("o mestre configura 2 efeitos e 2 ambientes pela configuração, e o jogador não vê a mesa de som nem consegue tocar", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;

  // o botão e a janela são só do mestre
  await expect(j.getByTestId("ferramenta-som")).toHaveCount(0);
  await m.getByTestId("ferramenta-som").click();
  await expect(m.getByTestId("painel-som")).toBeVisible();
  // os 8 + 8 lugares começam vazios, com o "adicionar"
  await expect(m.getByTestId("som-efeitos").locator(".som-vazio")).toHaveCount(8);
  await expect(m.getByTestId("som-ambientes").locator(".som-vazio")).toHaveCount(8);

  // 1) o lugar vazio abre a configuração; o arquivo vira asset e o lugar já nasce com nome, ícone e cor
  await configurarLugar(m, "efeito", 0, arquivoWav("trovao-forte.wav", 2), "Trovão do céu!");
  await expect(m.getByTestId("som-config-nome")).toHaveValue("Trovão do cé"); // 12 letras
  await expect(m.getByTestId("som-config-editor")).toContainText("12 de 12 letras");
  await m.getByTestId("som-config-icone-trovao").click();
  await expect(m.getByTestId("som-config-icone-trovao")).toHaveAttribute("aria-pressed", "true");
  await m.getByTestId("som-config-cor-azul").click();
  await expect(m.getByTestId("som-config-cor-azul")).toHaveAttribute("aria-pressed", "true");
  await configurarLugar(m, "efeito", 1, arquivoWav("sopro.wav", 3), "Sopro");
  await configurarLugar(m, "ambiente", 0, arquivoWav("taverna.wav", 1), "Taverna");
  await configurarLugar(m, "ambiente", 1, arquivoWav("vento.wav", 4), "Vento");
  await expect(m.getByTestId("som-config-conta")).toHaveText("4 de 16 lugares usados");
  // o ícone e a cor ficaram guardados na sala (a lista mostra a cor da etiqueta pelo token do tema)
  await m.getByTestId("som-lugar-efeito-0").click();
  await expect(m.getByTestId("som-config-icone-trovao")).toHaveAttribute("aria-pressed", "true");
  await expect(m.getByTestId("som-config-cor-azul")).toHaveAttribute("aria-pressed", "true");
  await m.getByTestId("som-config-pronto").click();
  await expect(m.getByTestId("som-config")).toHaveCount(0);
  await expect(m.getByTestId("som-efeito-0")).toContainText("Trovão do cé");
  await expect(m.getByTestId("som-efeito-1")).toContainText("Sopro");
  await expect(m.getByTestId("som-ambiente-0")).toContainText("Taverna");
  await expect(m.getByTestId("som-ambiente-1")).toContainText("Vento");
  await expect(m.getByTestId("som-efeito-vazio-2")).toBeVisible();

  // 2) o jogador não vê nada disso: nem a janela, nem os nomes, nem a configuração dos lugares
  const doJogador = j1.frames.join("\n");
  for (const proibido of [
    "mesaDeSom",
    "som.lugarAlterado",
    "Trovão",
    "Taverna",
    "Vento",
    "Sopro",
  ]) {
    expect(doJogador, `o frame do jogador trouxe "${proibido}"`).not.toContain(proibido);
  }
  await expect(j.getByTestId("painel-som")).toHaveCount(0);
  // ...e a sala recusa tudo o que ele tentar
  const hash = await hashDoSom(m, "trovao-forte.wav");
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  for (const [tipo, dados] of [
    ["som.efeito", { lugar: 0 }],
    ["som.efeitoParar", {}],
    ["som.ambiente", { indice: 0, ligado: true }],
    ["som.volumeGeral", { volume: 0.2 }],
    ["som.pararTudo", {}],
    ["som.apagar", { hash }],
    [
      "som.lugar",
      {
        grupo: "efeito",
        indice: 3,
        lugar: { hash, nome: "Invasor", icone: "chama", cor: "ambar", volume: 0.5 },
      },
    ],
  ] as const) {
    const r = await enviarCru(j, intencaoCrua(tipo, dados));
    expect(r?.dados.codigo, tipo).toBe("sem_permissao");
  }
  expect((await somDe(j)).efeitos).toEqual([]);
});

test("o efeito toca uma vez para o jogador (de novo, recomeça) e o parar corta; o volume e o silenciar são de cada pessoa", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;
  await configurarLugar(m, "efeito", 0, arquivoWav("sopro.wav", 20), "Sopro");
  await m.getByTestId("som-config-pronto").click();
  const sopro = await esperarHashDoSom(m, "sopro.wav");

  await m.getByTestId("som-efeito-0").click();
  for (const p of [m, j]) {
    await expect.poll(async () => (await somDe(p)).efeitos.length).toBe(1);
    expect((await somDe(p)).efeitos[0]).toMatchObject({ hash: sopro, lugar: 0 });
    expect((await somDe(p)).efeitos[0]?.volume).toBeCloseTo(COM_OS_PADROES, 5);
  }
  // o botão mostra o que está tocando e a barra de progresso
  await expect(m.getByTestId("som-efeito-0")).toHaveAttribute("data-tocando", "sim");
  await expect(m.getByTestId("som-efeito-barra-0")).toBeVisible();
  // o jogador baixa o arquivo no primeiro toque; com ele na mão, o toque seguinte toca de verdade
  await esperarPronto(j, sopro);

  // tocar de novo recomeça: um toque novo, e ainda só um efeito tocando
  await m.getByTestId("som-efeito-0").click();
  for (const p of [m, j]) await expect.poll(async () => (await somDe(p)).efeitos.length).toBe(2);
  await expect.poll(async () => (await somDe(j)).efeitosTocando.length).toBe(1);
  expect((await somDe(m)).efeitosTocando).toHaveLength(1);

  // o "parar" do lugar corta para todos
  await m.getByTestId("som-efeito-parar-0").click();
  for (const p of [m, j]) {
    await expect.poll(async () => (await somDe(p)).efeitosTocando.length).toBe(0);
  }
  await expect(m.getByTestId("som-efeito-0")).toHaveAttribute("data-tocando", "nao");

  // o jogador: o volume e o silenciar das preferências são só dele (nada vai para a sala)
  await abrirPreferencia(j, "som");
  await expect(j.getByTestId("pref-resumo-som")).toHaveText("Volume 80% · ambientes ligados");
  await j.getByTestId("som-silenciar").check();
  await m.getByTestId("som-efeito-0").click();
  await expect.poll(async () => (await somDe(j)).efeitos.length).toBe(3);
  expect((await somDe(j)).efeitos[2]?.volume).toBe(0);
  expect((await somDe(m)).efeitos[2]?.volume).toBeCloseTo(COM_OS_PADROES, 5);
  await j.getByTestId("som-silenciar").uncheck();
  await j.getByTestId("som-volume-efeitos").fill("0");
  await m.getByTestId("som-efeito-0").click();
  await expect.poll(async () => (await somDe(j)).efeitos.length).toBe(4);
  expect((await somDe(j)).efeitos[3]?.volume).toBe(0);
  expect(j1.enviados.filter((f) => f.includes("som.") && f.includes("volume"))).toHaveLength(0);
});

test("dois ambientes ligados ao mesmo tempo, com volumes diferentes, chegam ao jogador; desligar um tira só ele; o volume geral e o Parar tudo valem para todos", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;
  await configurarLugar(m, "ambiente", 0, arquivoWav("taverna.wav", 1), "Taverna");
  await configurarLugar(m, "ambiente", 1, arquivoWav("vento.wav", 4), "Vento");
  await configurarLugar(m, "efeito", 0, arquivoWav("sopro.wav", 3), "Sopro");
  await m.getByTestId("som-config-pronto").click();
  const taverna = await esperarHashDoSom(m, "taverna.wav");
  const vento = await esperarHashDoSom(m, "vento.wav");

  // nada toca até alguém ligar
  expect((await somDe(j)).ambientes).toEqual([]);
  await m.getByTestId("som-ambiente-ligar-0").click();
  await m.getByTestId("som-ambiente-ligar-1").click();
  await expect(m.getByTestId("som-ambiente-1")).toHaveAttribute("data-ligado", "sim");
  await m.getByTestId("som-ambiente-volume-1").fill("30");
  await expect(m.getByTestId("som-ambiente-0")).toHaveAttribute("data-ligado", "sim");
  for (const p of [m, j]) {
    await expect
      .poll(async () => (await somDe(p)).ambientes.map((a) => a.hash))
      .toEqual([taverna, vento]);
    await expect
      .poll(async () => (await somDe(p)).ambientes.map((a) => Math.round(a.volume * 100) / 100))
      .toEqual([0.64, 0.24]);
  }

  // desligar um tira só ele
  await m.getByTestId("som-ambiente-ligar-0").click();
  await expect(m.getByTestId("som-ambiente-0")).toHaveAttribute("data-ligado", "nao");
  for (const p of [m, j]) {
    await expect.poll(async () => (await somDe(p)).ambientes.map((a) => a.hash)).toEqual([vento]);
  }
  await m.getByTestId("som-ambiente-ligar-0").click();
  for (const p of [m, j]) await expect.poll(async () => (await somDe(p)).ambientes.length).toBe(2);

  // quem entra no meio ouve os dois, cada um com o seu volume
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await expect
    .poll(async () => (await somDe(j2.pagina)).ambientes.map((a) => a.hash))
    .toEqual([taverna, vento]);

  // volume geral: vale para os ambientes e para os efeitos, de todos
  await m.getByTestId("som-mesa-geral").fill("50");
  for (const p of [m, j, j2.pagina]) {
    await expect
      .poll(async () => (await somDe(p)).ambientes.map((a) => Math.round(a.volume * 1000) / 1000))
      .toEqual([0.32, 0.12]);
  }
  await m.getByTestId("som-efeito-0").click();
  await expect.poll(async () => (await somDe(j)).efeitos.length).toBe(1);
  expect((await somDe(j)).efeitos[0]?.volume).toBeCloseTo(0.8 * 0.5 * 0.8, 5);

  // Parar tudo: corta o efeito e desliga os ambientes, para todos, e o volume geral fica
  await m.getByTestId("som-parar-tudo").click();
  for (const p of [m, j, j2.pagina]) {
    await expect.poll(async () => (await somDe(p)).ambientes.length).toBe(0);
    await expect.poll(async () => (await somDe(p)).efeitosTocando.length).toBe(0);
  }
  await expect(m.getByTestId("som-ambiente-0")).toHaveAttribute("data-ligado", "nao");
  await expect(m.getByTestId("som-mesa-geral-valor")).toHaveText("50%");

  // o volume do ambiente nas preferências é só do jogador
  await m.getByTestId("som-ambiente-ligar-1").click();
  await expect.poll(async () => (await somDe(j)).ambientes.length).toBe(1);
  await abrirPreferencia(j, "som");
  await j.getByTestId("som-volume-trilha").fill("0");
  await expect(j.getByTestId("pref-resumo-som")).toHaveText("Volume 80% · ambientes desligados");
  await expect.poll(async () => (await somDe(j)).ambientes[0]?.volume).toBe(0);
  expect((await somDe(m)).ambientes[0]?.volume).toBeCloseTo(0.8 * 0.5 * 0.8, 3);
});

test("os ambientes da cena ligam ao levar o grupo; a janela vira faixa no pé da tela e volta, e a escolha fica lembrada", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;
  await configurarLugar(m, "ambiente", 0, arquivoWav("taverna.wav", 1), "Taverna");
  await m.getByTestId("som-config-pronto").click();
  const taverna = await esperarHashDoSom(m, "taverna.wav");
  await m.getByTestId("som-ambiente-ligar-0").click();
  await expect.poll(async () => (await somDe(j)).ambientes.length).toBe(1);

  // a cena (a que o mestre vê) fica com os ambientes que tocam; parar tudo; ir e voltar liga de novo
  await expect(m.getByTestId("som-cena-ambientes")).toContainText("não mexe");
  await m.getByTestId("som-cena-usar").click();
  await expect(m.getByTestId("som-cena-ambientes")).toContainText("Taverna");
  await m.getByTestId("som-parar-tudo").click();
  await expect.poll(async () => (await somDe(j)).ambientes.length).toBe(0);
  const criada = await enviarCru(m, intencaoCrua("cena.criar", { id: "cena-q4", nome: "Outra" }));
  expect(criada?.tipo).toBe("evento");
  expect(
    await enviarEEsperarSnapshot(m, intencaoCrua("grupo.moverPara", { cenaId: "cena-q4" })),
  ).toBe("snapshot");
  // a outra cena não tem a lista: nada muda
  expect((await somDe(j)).ambientes).toEqual([]);
  expect(
    await enviarEEsperarSnapshot(m, intencaoCrua("grupo.moverPara", { cenaId: "cena-1" })),
  ).toBe("snapshot");
  await expect.poll(async () => (await somDe(j)).ambientes.map((a) => a.hash)).toEqual([taverna]);
  await expect.poll(async () => (await somDe(m)).ambientes.map((a) => a.hash)).toEqual([taverna]);
  // o jogador nunca recebe a lista de ambientes da cena
  expect(j1.frames.join("\n")).not.toContain('"ambientes":[0');

  // janela -> faixa
  await expect(m.getByTestId("painel-som")).toBeVisible();
  await m.getByTestId("som-encaixar").click();
  await expect(m.getByTestId("painel-som")).toHaveCount(0);
  await expect(m.getByTestId("som-faixa")).toBeVisible();
  await expect(m.getByTestId("som-faixa")).toHaveAttribute("data-recolhida", "nao");
  // a faixa tem tudo: efeitos, ambientes, volume geral, parar tudo e a configuração
  for (const id of [
    "som-efeitos",
    "som-ambientes",
    "som-mesa-geral",
    "som-parar-tudo",
    "som-config-abrir",
  ]) {
    await expect(m.getByTestId("som-faixa").getByTestId(id)).toBeVisible();
  }
  // a faixa fica no pé da tela, dentro da janela do navegador
  const faixa = await m.getByTestId("som-faixa").boundingBox();
  const tela = m.viewportSize();
  expect(faixa && tela && faixa.y + faixa.height <= tela.height).toBe(true);
  expect(faixa && tela && faixa.y > tela.height / 2).toBe(true);
  // o que toca segue tocando; dá para desligar pela faixa
  await m.getByTestId("som-ambiente-ligar-0").click();
  await expect.poll(async () => (await somDe(j)).ambientes.length).toBe(0);
  await m.getByTestId("som-ambiente-ligar-0").click();
  await expect.poll(async () => (await somDe(j)).ambientes.length).toBe(1);
  // recolhe e abre
  await m.getByTestId("som-faixa-recolher").click();
  await expect(m.getByTestId("som-faixa")).toHaveAttribute("data-recolhida", "sim");
  await expect(m.getByTestId("som-efeitos")).toHaveCount(0);
  await m.getByTestId("som-faixa-recolher").click();
  await expect(m.getByTestId("som-efeitos")).toBeVisible();
  // a escolha é por pessoa e fica: depois de recarregar a mesa continua em faixa
  await m.reload();
  await expect(m.getByTestId("status-conexao")).toHaveText("conectado");
  await m.getByTestId("ferramenta-som").click();
  await expect(m.getByTestId("som-faixa")).toBeVisible();
  await expect(m.getByTestId("painel-som")).toHaveCount(0);
  // faixa -> janela
  await m.getByTestId("som-soltar").click();
  await expect(m.getByTestId("painel-som")).toBeVisible();
  await expect(m.getByTestId("som-faixa")).toHaveCount(0);
  // o jogador não tem nem faixa nem janela, e nada disso foi mandado à sala
  await expect(j.getByTestId("som-faixa")).toHaveCount(0);
  expect(mestre.enviados.filter((f) => f.includes("faixa"))).toHaveLength(0);
});

test("apagar um som da mesa tira o som dos lugares (e para o que toca), com o aviso de onde ele estava; o arquivo continua no computador", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;
  await configurarLugar(m, "efeito", 0, arquivoWav("trovao-forte.wav", 2), "Trovão");
  await configurarLugar(m, "ambiente", 0, arquivoWav("chuva.wav", 1), "Chuva");
  // o mesmo arquivo da chuva num segundo lugar (o arquivo já está na mesa: escolhe pela lista dos sons da mesa)
  await m.getByTestId("som-lugar-efeito-1").click();
  const chuva = await esperarHashDoSom(m, "chuva.wav");
  await m.getByTestId(`som-config-arquivo-${chuva.slice(0, 8)}`).click();
  await expect(m.getByTestId("som-lugar-efeito-1")).toHaveAttribute("data-vazio", "nao");
  await m.getByTestId("som-config-pronto").click();
  await m.getByTestId("som-ambiente-ligar-0").click();
  await expect.poll(async () => (await somDe(j)).ambientes.map((a) => a.hash)).toEqual([chuva]);

  // apagar a chuva: a confirmação está na página e diz onde o som estava; cancelar não muda nada
  await m.getByTestId("som-config-abrir").click();
  await m.getByTestId("som-lugar-ambiente-0").click();
  await m.getByTestId("som-config-apagar").click();
  const confirma = m.getByTestId("som-config-confirma");
  await expect(confirma).toContainText("chuva.wav");
  await expect(confirma).toContainText("o efeito 2");
  await expect(confirma).toContainText("o ambiente 1 (Chuva)");
  await expect(confirma).toContainText("pasta sons/");
  await m.getByTestId("som-config-apagar-cancelar").click();
  await expect(confirma).toHaveCount(0);
  expect(await hashDoSom(m, "chuva.wav")).toBe(chuva);
  await m.getByTestId("som-config-apagar").click();
  await m.getByTestId("som-config-apagar-confirmar").click();

  // o som saiu da mesa e de todos os lugares; o ambiente que tocava parou; o efeito do trovão ficou
  await expect(m.getByTestId("som-lugar-ambiente-0")).toHaveAttribute("data-vazio", "sim");
  await expect(m.getByTestId("som-lugar-efeito-1")).toHaveAttribute("data-vazio", "sim");
  await expect(m.getByTestId("som-lugar-efeito-0")).toHaveAttribute("data-vazio", "nao");
  await expect(m.getByTestId(`som-config-arquivo-${chuva.slice(0, 8)}`)).toHaveCount(0);
  for (const p of [m, j]) await expect.poll(async () => (await somDe(p)).ambientes.length).toBe(0);
  await m.getByTestId("som-config-pronto").click();
  await expect(m.getByTestId("som-ambiente-vazio-0")).toBeVisible();
  await expect(m.getByTestId("som-efeito-vazio-1")).toBeVisible();
  await expect(m.getByTestId("som-efeito-0")).toContainText("Trovão");
  // apagar de novo o que já não existe é recusado, e o jogador nunca soube de nada disso
  const r = await enviarCru(m, intencaoCrua("som.apagar", { hash: chuva }));
  expect(r?.dados.codigo).toBe("asset_inexistente");
  const doJogador = j1.frames.join("\n");
  expect(doJogador).not.toContain("asset.removido");
  expect(doJogador).not.toContain("som.lugarAlterado");
});
