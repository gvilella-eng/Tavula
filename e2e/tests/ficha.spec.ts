import { readFileSync } from "node:fs";
import { abrirAba, enviarCru, expect, intencaoCrua, type Sessao, test } from "./ajudas";
import {
  abrirFicha,
  criarDarion,
  criarPastaDoGrupo,
  DARION_ID,
  FICHA_DARION,
  ligarVerOutras,
  mandar,
} from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// Lote 9: ficha 5e. O Darion da seção 8 do PROJETO.md é criado pelo mestre; quem edita é o jogador-1.

const texto = (s: Sessao) => s.frames.join("\n");
const pvAtual = (id: string) => `pv-atual-${id}`;

test("a janela da ficha mostra os números do Darion; o jogador altera o PV e o mestre vê, com gravação agrupada", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);

  const janela = await abrirFicha(j1.pagina, DARION_ID, "principal");
  await expect(janela.getByTestId("janela-ficha-resumo")).toContainText(
    "Patrulheiro 5 / Clérigo 5",
  );
  // os derivados da seção 8, na tela
  await expect(janela.getByTestId("atributo-mod-for")).toHaveText("+7");
  await expect(janela.getByTestId("atributo-mod-des")).toHaveText("+4");
  await expect(janela.getByTestId("salvaguarda-total-for")).toHaveText("+11");
  await expect(janela.getByTestId("salvaguarda-total-des")).toHaveText("+8");
  await expect(janela.getByTestId("salvaguarda-total-car")).toHaveText("+0");
  await expect(janela.getByTestId("pericia-total-atletismo")).toHaveText("+11");
  await expect(janela.getByTestId("pericia-total-furtividade")).toHaveText("+8");
  await expect(janela.getByTestId("pericia-total-percepcao")).toHaveText("+2");
  await expect(janela.getByTestId("percepcao-passiva")).toHaveText("12");
  await expect(janela.getByTestId("proficiencia")).toHaveText("+4");
  await expect(janela.getByTestId("iniciativa")).toHaveText("+4");
  await expect(janela.getByTestId("deslocamento-texto")).toContainText("9 m");
  await expect(janela.getByTestId(pvAtual(DARION_ID))).toHaveValue("97");

  // três campos mudam em seguida: vão numa única `ficha.alterar` (agrupada por ~400 ms)
  const antes = j1.enviados.filter((f) => f.includes('"ficha.alterar"')).length;
  await janela.getByTestId(pvAtual(DARION_ID)).fill("50");
  await janela.getByTestId(`pv-temp-${DARION_ID}`).fill("5");
  await janela.getByTestId("atributo-valor-int").fill("16");
  await expect
    .poll(() => j1.enviados.filter((f) => f.includes('"ficha.alterar"')).length)
    .toBeGreaterThan(antes);
  await j1.pagina.waitForTimeout(800);
  const enviadas = j1.enviados.filter((f) => f.includes('"ficha.alterar"')).slice(antes);
  expect(enviadas).toHaveLength(1);
  const caminhos = (JSON.parse(enviadas[0] as string).dados.operacoes as { caminho: string }[]).map(
    (o) => o.caminho,
  );
  expect(caminhos).toEqual(["pvAtual", "pvTemp", "atributos.int"]);
  // o derivado acompanha (Inteligência 16 → +3 em Arcanismo)
  await expect(janela.getByTestId("pericia-total-arcanismo")).toHaveText("+3");

  // o mestre abre a mesma ficha e vê o que o jogador gravou
  const jm = await abrirFicha(mestre.pagina, DARION_ID, "principal");
  await expect(jm.getByTestId(pvAtual(DARION_ID))).toHaveValue("50");
  await expect(jm.getByTestId(`pv-temp-${DARION_ID}`)).toHaveValue("5");
  await expect(jm.getByTestId("atributo-valor-int")).toHaveValue("16");
  // e o contrário: o mestre muda e o jogador vê (a última gravação vale)
  await jm.getByTestId(pvAtual(DARION_ID)).fill("33");
  await expect(janela.getByTestId(pvAtual(DARION_ID))).toHaveValue("33");
});

test("o jogador não edita a ficha de outro: nem pela tela nem forçando por fora", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await criarPastaDoGrupo(mestre.pagina);
  await criarDarion(mestre.pagina, { pastaId: "pasta-grupo" });

  // o item aparece (a pasta é de todos), mas sem `ficha.verOutras` a ficha não chega
  await abrirAba(j2.pagina, "fichas");
  await expect(j2.pagina.getByTestId(`ficha-item-${DARION_ID}`)).toBeVisible();
  const oculta = await abrirFicha(j2.pagina, DARION_ID, "configurar");
  await expect(oculta.getByTestId("ficha-oculta")).toBeVisible();
  await expect(oculta.getByTestId("ficha-aba-principal")).toHaveCount(0);

  const forjada = intencaoCrua("ficha.alterar", {
    personagemId: DARION_ID,
    operacoes: [{ caminho: "pvAtual", valor: 1 }],
  });
  expect((await enviarCru(j2.pagina, forjada))?.dados.codigo).toBe("sem_permissao");

  // com `ficha.verOutras` ela chega, só para ler: nada editável nem rolável
  await ligarVerOutras(mestre.pagina, true);
  const lida = await abrirFicha(j2.pagina, DARION_ID, "principal");
  await expect(lida.getByTestId(pvAtual(DARION_ID))).toHaveValue("97");
  await expect(lida.getByTestId(pvAtual(DARION_ID))).toBeDisabled();
  await expect(lida.getByTestId("ataque-rolar-0")).toBeDisabled();
  await expect(lida.getByTestId("atributo-mod-for")).toBeDisabled();
  await expect(lida.getByTestId("descanso-longo")).toHaveCount(0);
  expect((await enviarCru(j2.pagina, forjada))?.dados.codigo).toBe("sem_permissao");
  // nem falar "como" o Darion
  const como = intencaoCrua("chat.enviar", { texto: "oi", como: DARION_ID });
  expect((await enviarCru(j2.pagina, como))?.dados.codigo).toBe("sem_permissao");
  // o PV segue o que o dono tinha
  await expect(lida.getByTestId(pvAtual(DARION_ID))).toHaveValue("97");
});

test("clicar num ataque ou numa perícia (com vantagem) manda o cartão para o chat de todos, como o personagem", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await criarDarion(mestre.pagina);
  const janela = await abrirFicha(j1.pagina, DARION_ID, "principal");

  // o ataque da fixture: Cimitarra +7, 1d6+7 (valor fixo)
  await expect(janela.getByTestId("ataque-rolar-0")).toHaveText("+7");
  await janela.getByTestId("ataque-rolar-0").click();
  for (const outro of [mestre, j2]) {
    await abrirAba(outro.pagina, "chat");
    const cartao = outro.pagina.getByTestId("modelo-ataque").filter({ hasText: "Cimitarra" });
    await expect(cartao).toBeVisible();
    await expect(cartao.getByTestId("cartao-rolagem")).toHaveCount(2); // acerto e dano
    await expect(
      outro.pagina
        .getByTestId("chat-mensagem")
        .filter({ hasText: "Cimitarra" })
        .getByTestId("chat-autor"),
    ).toHaveText("Darion");
  }

  // vantagem vale para o próximo d20 e depois volta a normal
  await janela.getByTestId("vantagem-vantagem").click();
  await expect(janela.getByTestId("vantagem-vantagem")).toHaveAttribute("aria-pressed", "true");
  await janela.getByTestId("pericia-total-percepcao").click();
  await abrirAba(j2.pagina, "chat");
  const teste = j2.pagina.getByTestId("modelo-teste").filter({ hasText: "Percepção" });
  await expect(teste).toBeVisible();
  await expect(teste).toContainText("Vantagem");
  await expect(janela.getByTestId("vantagem-normal")).toHaveAttribute("aria-pressed", "true");
  // sem vantagem, a mesma perícia não leva a etiqueta
  await janela.getByTestId("pericia-total-furtividade").click();
  const furtividade = j2.pagina.getByTestId("modelo-teste").filter({ hasText: "Furtividade" });
  await expect(furtividade).toBeVisible();
  await expect(furtividade).not.toContainText("Vantagem");
  // o dano solto (Hunter's Mark, sem rolagem de acerto) vai pelo chat também
  await janela.getByTestId("ataque-dano-5").click();
  await expect(
    j2.pagina.getByTestId("chat-mensagem").filter({ hasText: "Hunter's Mark" }).first(),
  ).toBeVisible();
});

test("exportar e depois importar devolve a mesma ficha (com confirmação)", async ({ mesa }) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarion(mestre.pagina);
  const janela = await abrirFicha(mestre.pagina, DARION_ID, "configurar");

  // sem pasta local escolhida, o arquivo é baixado
  const download = mestre.pagina.waitForEvent("download");
  await janela.getByTestId("ficha-exportar").click();
  const baixado = await download;
  expect(baixado.suggestedFilename()).toBe("darion.json");
  const caminho = await baixado.path();
  const arquivo = JSON.parse(readFileSync(caminho, "utf8")) as {
    formato: string;
    versao: number;
    nome: string;
    ficha: unknown;
  };
  expect(arquivo).toMatchObject({ formato: "tabletop-ficha", versao: 1, nome: "Darion" });
  expect(arquivo.ficha).toEqual(FICHA_DARION);

  // muda a ficha (PV e um ataque) e importa de volta
  await janela.getByTestId("ficha-aba-principal").click();
  await janela.getByTestId(pvAtual(DARION_ID)).fill("7");
  await janela.getByTestId("ataque-remover-0").click();
  await expect(janela.getByTestId("ataque-19")).toHaveCount(0);
  await janela.getByTestId("ficha-aba-configurar").click();
  await janela.getByTestId("ficha-importar-arquivo").setInputFiles(caminho);
  // pede confirmação: cancelar não troca nada
  await expect(janela.getByTestId("ficha-importar-confirmar")).toBeVisible();
  await janela.getByTestId("ficha-importar-confirmar-nao").click();
  await janela.getByTestId("ficha-aba-principal").click();
  await expect(janela.getByTestId(pvAtual(DARION_ID))).toHaveValue("7");
  await janela.getByTestId("ficha-aba-configurar").click();
  await janela.getByTestId("ficha-importar-arquivo").setInputFiles(caminho);
  await janela.getByTestId("ficha-importar-confirmar-sim").click();
  await expect(janela.getByTestId("ficha-arquivo-aviso")).toHaveText("Ficha importada.");

  // a sala devolve exatamente a ficha exportada: exporta de novo e compara
  await janela.getByTestId("ficha-aba-principal").click();
  await expect(janela.getByTestId(pvAtual(DARION_ID))).toHaveValue("97");
  await expect(janela.getByTestId("ataque-19")).toBeVisible();
  await janela.getByTestId("ficha-aba-configurar").click();
  const segundo = mestre.pagina.waitForEvent("download");
  await janela.getByTestId("ficha-exportar").click();
  const caminho2 = await (await segundo).path();
  const de = JSON.parse(readFileSync(caminho2, "utf8")) as { ficha: unknown };
  expect(de.ficha).toEqual(arquivo.ficha);

  // arquivo que não é uma ficha: recusado com aviso
  await janela.getByTestId("ficha-importar-arquivo").setInputFiles({
    name: "lixo.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"nada":true}'),
  });
  await janela.getByTestId("ficha-importar-confirmar-sim").click();
  await expect(janela.getByTestId("ficha-arquivo-aviso")).toContainText("inválido");
});

test("frames: sem ficha.verOutras nenhum frame do jogador traz a ficha de outro personagem", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await criarPastaDoGrupo(mestre.pagina);
  await criarDarion(mestre.pagina, { pastaId: "pasta-grupo" });
  await abrirAba(j2.pagina, "fichas");
  await expect(j2.pagina.getByTestId(`ficha-item-${DARION_ID}`)).toBeVisible();

  const segredos = ["Sun Blade", "Fireball", "Armadura de couro", '"atributos"', '"pvAtual":97'];
  const semFicha = (s: Sessao, aPartirDe = 0) => {
    const t = s.frames.slice(aPartirDe).join("\n");
    for (const x of segredos) expect(t, `frame com ${x}`).not.toContain(x);
  };
  semFicha(j2);

  // o dono muda a ficha, o mestre muda o nome do item: nada da ficha chega ao jogador 2
  await mandar(mestre.pagina, "ficha.alterar", {
    personagemId: DARION_ID,
    operacoes: [{ caminho: "pvAtual", valor: 40 }],
  });
  await mandar(mestre.pagina, "personagem.editar", {
    id: DARION_ID,
    mudancas: { nome: "Darion, o Caçador" },
  });
  await expect(j2.pagina.getByTestId(`ficha-nome-${DARION_ID}`)).toHaveText("Darion, o Caçador");
  await j2.pagina.reload();
  await expect(j2.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await abrirAba(j2.pagina, "fichas");
  await expect(j2.pagina.getByTestId(`ficha-item-${DARION_ID}`)).toBeVisible();
  semFicha(j2);
  // o item na lista não mostra os PV
  await expect(j2.pagina.getByTestId(`ficha-item-${DARION_ID}`).locator(".ficha-pv")).toHaveCount(
    0,
  );

  // liga: um snapshot novo traz a ficha
  const marca = j2.frames.length;
  await ligarVerOutras(mestre.pagina, true);
  await expect.poll(() => j2.frames.slice(marca).join("\n")).toContain("Sun Blade");
  // enquanto ligada, a mudança chega inteira
  await mandar(mestre.pagina, "ficha.alterar", {
    personagemId: DARION_ID,
    operacoes: [{ caminho: "pvAtual", valor: 41 }],
  });
  await expect.poll(() => j2.frames.slice(marca).join("\n")).toContain('"pvAtual":41');

  // desliga: outro snapshot, agora sem a ficha, e as mudanças seguintes não chegam
  const marca2 = j2.frames.length;
  await ligarVerOutras(mestre.pagina, false);
  await expect.poll(() => j2.frames.length).toBeGreaterThan(marca2);
  await mandar(mestre.pagina, "ficha.alterar", {
    personagemId: DARION_ID,
    operacoes: [{ caminho: "pvAtual", valor: 42 }],
  });
  await j2.pagina.waitForTimeout(500);
  semFicha(j2, marca2);
  expect(texto(j2).slice(texto(j2).indexOf('"pvAtual":41'))).toContain('"pvAtual":41');
});

test("descanso longo e curto pedem confirmação e restauram PV, espaços e recursos", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarDarion(mestre.pagina);
  const janela = await abrirFicha(j1.pagina, DARION_ID, "principal");

  // ffica ferido, gasta um dado de vida e um recurso
  await janela.getByTestId(pvAtual(DARION_ID)).fill("20");
  await janela.getByTestId("dv-menos-d10").click();
  await expect(janela.getByTestId("dv-restantes-d10")).toHaveText("4/5");
  await janela.getByTestId("ficha-aba-magias").click();
  await expect(janela.getByTestId("conjuracao-cd-Patrulheiro")).toHaveText("14");
  await expect(janela.getByTestId("conjuracao-ataque-Clérigo")).toHaveText("+6");
  await expect(janela.getByTestId("espacos-resumo-1")).toHaveText("4/4");
  await expect(janela.getByTestId("espacos-resumo-4")).toHaveText("1/1");
  await expect(janela.getByTestId("espacos-9")).toHaveCount(0);
  await janela.getByTestId("espaco-1-1").check();
  await janela.getByTestId("espaco-1-2").check();
  await expect(janela.getByTestId("espacos-resumo-1")).toHaveText("2/4");
  await janela.getByTestId("ficha-aba-equipamento").click();
  await janela.getByTestId("recurso-menos-2").click(); // Radiação do Amanhecer (curto): 1 -> 0
  await expect(janela.getByTestId("recurso-atual-2")).toHaveValue("0");
  await janela.getByTestId("recurso-menos-1").click(); // Labareda (longo): 2 -> 1
  await expect(janela.getByTestId("recurso-atual-1")).toHaveValue("1");

  // descanso curto: só o recurso de recarga curta; cancelar não muda nada
  await janela.getByTestId("descanso-curto").click();
  await expect(janela.getByTestId("descanso-confirmar")).toBeVisible();
  await janela.getByTestId("descanso-confirmar-nao").click();
  await expect(janela.getByTestId("recurso-atual-2")).toHaveValue("0");
  await janela.getByTestId("descanso-curto").click();
  await janela.getByTestId("descanso-confirmar-sim").click();
  await expect(janela.getByTestId("recurso-atual-2")).toHaveValue("1");
  await expect(janela.getByTestId("recurso-atual-1")).toHaveValue("1");

  // descanso longo: tudo volta
  await janela.getByTestId("descanso-longo").click();
  await expect(janela.getByTestId("descanso-confirmar")).toContainText("Descanso longo");
  await janela.getByTestId("descanso-confirmar-sim").click();
  await expect(janela.getByTestId("recurso-atual-1")).toHaveValue("2");
  await janela.getByTestId("ficha-aba-magias").click();
  await expect(janela.getByTestId("espacos-resumo-1")).toHaveText("4/4");
  await janela.getByTestId("ficha-aba-principal").click();
  await expect(janela.getByTestId(pvAtual(DARION_ID))).toHaveValue("97");
  // metade dos dados de vida (10 no total: devolve 5, o d10 usado volta)
  await expect(janela.getByTestId("dv-restantes-d10")).toHaveText("5/5");
  // a sala tem o mesmo: o mestre abre e vê
  const jm = await abrirFicha(mestre.pagina, DARION_ID, "principal");
  await expect(jm.getByTestId(pvAtual(DARION_ID))).toHaveValue("97");
});

test("várias janelas ao mesmo tempo, arrastáveis e redimensionáveis", async ({ mesa }) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarion(mestre.pagina);
  const p = mestre.pagina;
  const darion = await abrirFicha(p, DARION_ID, "principal");
  const aldric = await abrirFicha(p, "pers-aldric", "principal");
  await expect(p.getByTestId("janela-ficha")).toHaveCount(2);

  // a que abriu por último está na frente; clicar na outra a traz
  // (R3: o z-index mora no contêiner da Janela, o ancestral `.janela` do elemento de testid janela-ficha)
  const z = async (j: typeof darion) =>
    Number(await j.evaluate((e) => getComputedStyle(e.closest(".janela") as Element).zIndex));
  expect(await z(aldric)).toBeGreaterThan(await z(darion));
  await darion.getByTestId("janela-ficha-cabecalho").click({ position: { x: 300, y: 8 } });
  expect(await z(darion)).toBeGreaterThan(await z(aldric));

  // arrastar pelo cabeçalho
  const antes = (await darion.boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  const cab = (await darion.getByTestId("janela-ficha-cabecalho").boundingBox()) as {
    x: number;
    y: number;
  };
  await p.mouse.move(cab.x + 250, cab.y + 10);
  await p.mouse.down();
  await p.mouse.move(cab.x + 310, cab.y + 50, { steps: 5 });
  await p.mouse.up();
  const depois = (await darion.boundingBox()) as typeof antes;
  expect(Math.round(depois.x - antes.x)).toBe(60);
  expect(Math.round(depois.y - antes.y)).toBe(40);

  // redimensionar pela quina (R3: a ficha agora abre no tamanho mínimo em 1280×720, então o teste aumenta
  // a janela em vez de diminuir)
  const alca = (await darion.getByTestId("janela-ficha-redimensionar").boundingBox()) as {
    x: number;
    y: number;
  };
  await p.mouse.move(alca.x + 8, alca.y + 8);
  await p.mouse.down();
  await p.mouse.move(alca.x + 108, alca.y + 68, { steps: 5 });
  await p.mouse.up();
  const maior = (await darion.boundingBox()) as typeof antes;
  expect(Math.round(maior.width - depois.width)).toBe(100);
  expect(Math.round(maior.height - depois.height)).toBe(60);

  // fechar uma não fecha a outra
  await darion.getByTestId("janela-ficha-fechar").click();
  await expect(p.getByTestId("janela-ficha")).toHaveCount(1);
});

test("a tocha na mão chega a quem edita o personagem mesmo sem o token na cena (aparece no Equipamento)", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await criarDarion(mestre.pagina); // sem token em cena nenhuma

  const janela = await abrirFicha(j1.pagina, DARION_ID, "equipamento");
  // o Darion tem 9 tochas (como no PDF da ficha)
  await expect(janela.getByTestId("mochila-resumo-modelo-tocha")).toHaveText("9 novas, 0 usadas");
  await janela.getByTestId("mochila-acender-modelo-tocha").click();
  await expect(janela.getByTestId("mochila-resumo-modelo-tocha")).toHaveText("8 novas, 1 usada");
  await expect(janela.locator('[data-testid^="mochila-usada-"]')).toContainText("na mão, acesa");
  // guardar devolve para a mochila (como usada); apagar/reacender seguem pela ficha
  await janela.locator('[data-testid^="mochila-guardar-"]').click();
  await expect(janela.locator('[data-testid^="mochila-usada-"]')).toContainText("guardada");
  // quem não edita o Darion não recebe a tocha dele (nenhum frame de luz com o portador)
  expect(texto(j2)).not.toContain('"personagemId":"pers-darion"');
  // e o jogador não repõe tochas pela ficha (só o mestre): subir a quantidade é recusado
  await abrirFicha(j1.pagina, DARION_ID, "equipamento");
  const forjada = intencaoCrua("ficha.alterar", {
    personagemId: DARION_ID,
    operacoes: [{ caminho: "itens.12.quantidade", valor: 99 }],
  });
  expect((await enviarCru(j1.pagina, forjada))?.dados.codigo).toBe("sem_permissao");
});
