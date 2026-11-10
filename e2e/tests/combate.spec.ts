import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import {
  definirValor,
  emVez,
  ligarOrdem,
  linha,
  menuDoToken,
  nomesNaOrdem,
  vezNaOrdem,
} from "./ajudasCombate";
import { mandar } from "./ajudasFicha";
import { entrarNoMapa, selecionarToken, tokenDe } from "./ajudasMapa";

// Lote 11: combate (ordem de turno, condições e concentração). A semente da campanha traz Aldric, Brisa e
// Cael (jogador-1, 2 e 3), o Ogro (NPC visível), um goblin oculto e um marcador na camada do mestre.

test("o mestre avança o turno e o jogador vê a vez mudar: na lista e no anel do token", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  // o Ogro é selecionado antes de abrir o painel, que cobre o centro da tela em 1280 px
  await selecionarToken(mestre.pagina, "tok-ogro");
  await ligarOrdem(mestre.pagina);
  await expect(j1.pagina.getByTestId("ordem-de-turno")).toBeVisible();
  await expect(j1.pagina.getByTestId("ordem-vazia")).toBeVisible();

  // o grupo entra de uma vez; o Ogro, pelo botão "Adicionar selecionados"
  await mestre.pagina.getByTestId("ordem-adicionar-grupo").click();
  await expect(linha(mestre.pagina, "Cael")).toBeVisible();
  await mestre.pagina.getByTestId("ordem-adicionar-selecionados").click();
  await expect(linha(mestre.pagina, "Ogro")).toBeVisible();
  await expect(linha(j1.pagina, "Ogro")).toBeVisible();

  await definirValor(mestre.pagina, "Aldric", 20);
  await definirValor(mestre.pagina, "Ogro", 17);
  await definirValor(mestre.pagina, "Brisa", 15);
  await definirValor(mestre.pagina, "Cael", 10);
  // digitar o valor reordena a lista, para todos
  for (const s of [mestre, j1]) {
    await expect.poll(() => nomesNaOrdem(s.pagina)).toEqual(["Aldric", "Ogro", "Brisa", "Cael"]);
  }
  await expect(mestre.pagina.getByTestId("ordem-rodada")).toHaveText("Não começou");

  // primeiro Próximo: rodada 1, vez do Aldric
  await mestre.pagina.getByTestId("ordem-proximo").click();
  for (const s of [mestre, j1]) {
    await expect.poll(() => vezNaOrdem(s.pagina)).toBe("Aldric");
    await expect(s.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada 1");
  }
  await expect.poll(() => emVez(j1.pagina, "tok-jogador-1")).toBe(true);
  await expect.poll(() => emVez(mestre.pagina, "tok-jogador-1")).toBe(true);
  expect(await emVez(j1.pagina, "tok-ogro")).toBe(false);

  // Próximo: a vez e o anel vão para o Ogro
  await mestre.pagina.getByTestId("ordem-proximo").click();
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Ogro");
  await expect.poll(() => emVez(j1.pagina, "tok-ogro")).toBe(true);
  expect(await emVez(j1.pagina, "tok-jogador-1")).toBe(false);

  // vira a rodada e volta
  await mestre.pagina.getByTestId("ordem-proximo").click();
  await mestre.pagina.getByTestId("ordem-proximo").click();
  await mestre.pagina.getByTestId("ordem-proximo").click();
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Aldric");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada 2");
  await mestre.pagina.getByTestId("ordem-anterior").click();
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Cael");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada 1");

  // o jogador não tem os comandos do mestre
  await expect(j1.pagina.getByTestId("ordem-proximo")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("ordem-encerrar")).toHaveCount(0);

  // tirar a entrada da vez passa o turno; "Ordenar" refaz a ordem pelos valores
  const idDoCael = await linha(mestre.pagina, "Cael").getAttribute("data-id");
  await mestre.pagina.getByTestId(`ordem-tirar-${idDoCael}`).click();
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Aldric", "Ogro", "Brisa"]);
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Aldric");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada 2");
  await expect.poll(() => emVez(j1.pagina, "tok-jogador-3")).toBe(false);

  // encerrar pede confirmação; cancelar não apaga; confirmar limpa para todos
  await mestre.pagina.getByTestId("ordem-encerrar").click();
  await mestre.pagina.getByTestId("ordem-encerrar-nao").click();
  await expect(linha(mestre.pagina, "Aldric")).toBeVisible();
  await mestre.pagina.getByTestId("ordem-encerrar").click();
  await mestre.pagina.getByTestId("ordem-encerrar-sim").click();
  for (const s of [mestre, j1]) {
    await expect(s.pagina.getByTestId("ordem-vazia")).toBeVisible();
    await expect(s.pagina.getByTestId("ordem-rodada")).toHaveText("Não começou");
  }
  expect(await emVez(j1.pagina, "tok-jogador-1")).toBe(false);
});

test("frames: a iniciativa oculta não chega ao jogador (token oculto, camada do mestre, entrada solta oculta e valor oculto)", async ({
  mesa,
  request,
}) => {
  expect((await request.post("/teste/dados?semente=11")).ok()).toBe(true);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await ligarOrdem(mestre.pagina);

  await mandar(mestre.pagina, "combate.adicionar", {
    entradas: [
      { id: "e-aldric", tokenId: "tok-jogador-1" },
      { id: "e-brisa", tokenId: "tok-jogador-2" },
      { id: "e-ogro", tokenId: "tok-ogro" },
      { id: "e-goblin", tokenId: "tok-goblin-oculto" },
      { id: "e-marcador", tokenId: "tok-marcador-mestre" },
      { id: "e-armadilha", nome: "Armadilha secreta", oculta: true },
    ],
  });
  // o mestre vê tudo; o jogador só o que o mapa dele mostra
  await expect(mestre.pagina.getByTestId("ordem-entrada")).toHaveCount(6);
  await expect(j1.pagina.getByTestId("ordem-entrada")).toHaveCount(3);
  await expect(mestre.pagina.getByTestId("ordem-escondida")).toHaveCount(3);

  // rolar para todos: os NPCs rolam ocultos (só o mestre vê); os PJs, em público
  await mestre.pagina.getByTestId("ordem-rolar-todos").click();
  await expect(
    mestre.pagina.locator('[data-testid="chat-mensagem"][data-tipo="modelo"]'),
  ).toHaveCount(6);
  await expect(j1.pagina.locator('[data-testid="chat-mensagem"][data-tipo="modelo"]')).toHaveCount(
    2,
  );

  // valores marcantes nas entradas ocultas e no valor oculto do Ogro
  await mandar(mestre.pagina, "combate.editar", { id: "e-goblin", mudancas: { iniciativa: 987 } });
  await mandar(mestre.pagina, "combate.editar", {
    id: "e-marcador",
    mudancas: { iniciativa: 984 },
  });
  await mandar(mestre.pagina, "combate.editar", {
    id: "e-armadilha",
    mudancas: { iniciativa: 986 },
  });
  await mandar(mestre.pagina, "combate.editar", {
    id: "e-ogro",
    mudancas: { iniciativa: 985, valorOculto: true },
  });
  await mestre.pagina.getByTestId("ordem-proximo").click();
  await expect.poll(() => vezNaOrdem(mestre.pagina)).toBe("Goblin Emboscado");
  // a vez de uma entrada que o jogador não vê não destaca ninguém para ele; a rodada chega
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada 1");
  await expect(j1.pagina.locator('[data-testid="ordem-entrada"][data-vez]')).toHaveCount(0);
  expect(await emVez(j1.pagina, "tok-jogador-1")).toBe(false);
  // o Ogro aparece com "?" no lugar do número
  await expect(j1.pagina.getByTestId("ordem-numero-e-ogro")).toHaveText("?");
  await expect(mestre.pagina.locator('[data-testid="ordem-valor-e-ogro"]')).toHaveValue("985");

  // recarregar (snapshot novo) também não traz nada do que está oculto
  await j1.pagina.reload();
  await expect(j1.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(j1.pagina.getByTestId("ordem-entrada")).toHaveCount(3);

  const quadros = j1.frames.join("\n");
  for (const segredo of [
    "Goblin Emboscado",
    "Marcador Secreto",
    "Armadilha secreta",
    "e-goblin",
    "e-marcador",
    "e-armadilha",
  ]) {
    expect(quadros, segredo).not.toContain(segredo);
  }
  expect(quadros).not.toMatch(/"iniciativa":(987|986|985|984)\b/);
  expect(quadros).not.toContain("destreza");
  // o que o jogador recebeu do Ogro: o nome e "valorOculto", sem número
  expect(quadros).toContain('"id":"e-ogro"');
  expect(quadros).toMatch(/"id":"e-ogro"[^}]*"valorOculto":true/);
  // só as duas rolagens dos PJs chegaram: nenhuma das dos NPCs
  const iniciativas = j1.frames.filter((f) => f.includes('"nome":"Iniciativa"'));
  expect(iniciativas.length).toBeGreaterThanOrEqual(2);
  expect(iniciativas.every((f) => f.includes('"visivelPara":"todos"'))).toBe(true);
  // o mestre, sim, recebeu tudo
  const doMestre = mestre.frames.join("\n");
  expect(doMestre).toContain("Goblin Emboscado");
  expect(doMestre).toContain("Armadilha secreta");
});

test("o jogador rola a própria iniciativa e passa o próprio turno; não passa o de outro", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await selecionarToken(mestre.pagina, "tok-ogro");
  await ligarOrdem(mestre.pagina);
  await mestre.pagina.getByTestId("ordem-adicionar-grupo").click();
  await mestre.pagina.getByTestId("ordem-adicionar-selecionados").click();
  await expect(linha(j1.pagina, "Ogro")).toBeVisible();

  // cada jogador só tem o botão "Rolar" da própria entrada
  const idDe = async (nome: string) =>
    (await linha(mestre.pagina, nome).getAttribute("data-id")) ?? "";
  const aldric = await idDe("Aldric");
  const brisa = await idDe("Brisa");
  const ogro = await idDe("Ogro");
  await expect(j1.pagina.getByTestId(`ordem-rolar-${aldric}`)).toBeVisible();
  await expect(j1.pagina.getByTestId(`ordem-rolar-${brisa}`)).toHaveCount(0);
  await expect(j1.pagina.getByTestId(`ordem-rolar-${ogro}`)).toHaveCount(0);
  await expect(j2.pagina.getByTestId(`ordem-rolar-${aldric}`)).toHaveCount(0);

  // o jogador rola a do Aldric: o valor aparece para todos e a rolagem vai pública para o chat
  await j1.pagina.getByTestId(`ordem-rolar-${aldric}`).click();
  await expect(j1.pagina.getByTestId(`ordem-numero-${aldric}`)).not.toHaveText("—");
  await expect(j2.pagina.getByTestId(`ordem-numero-${aldric}`)).not.toHaveText("—");
  await expect(j1.pagina.getByTestId(`ordem-rolar-${aldric}`)).toHaveCount(0);
  const rolagemNoChat = j2.pagina.locator('[data-testid="chat-mensagem"][data-tipo="modelo"]');
  await expect(rolagemNoChat).toHaveCount(1);
  await expect(rolagemNoChat).toContainText("Iniciativa");
  await expect(rolagemNoChat.getByTestId("chat-autor")).toHaveText("Aldric");

  // tentar rolar a do outro (por fora da tela) é recusado
  const outro = await enviarCru(j1.pagina, intencaoCrua("combate.rolar", { ids: [brisa] }));
  expect(outro).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
  const npc = await enviarCru(j1.pagina, intencaoCrua("combate.rolar", { ids: [ogro] }));
  expect(npc).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
  // rolar de novo a própria também
  const denovo = await enviarCru(j1.pagina, intencaoCrua("combate.rolar", { ids: [aldric] }));
  expect(denovo?.tipo).toBe("erro");

  // o mestre põe os demais lá embaixo: o Aldric abre a rodada (o valor rolado é um d20 de verdade e
  // pode sair baixo; fixá-lo em 20 deixa a ordem certa sem depender do dado)
  await definirValor(mestre.pagina, "Aldric", 20);
  await definirValor(mestre.pagina, "Brisa", 1);
  await definirValor(mestre.pagina, "Cael", 2);
  await definirValor(mestre.pagina, "Ogro", 3);
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Aldric", "Ogro", "Cael", "Brisa"]);
  await mestre.pagina.getByTestId("ordem-proximo").click();
  await expect.poll(() => vezNaOrdem(j2.pagina)).toBe("Aldric");

  // só quem edita o Aldric vê "Passar o meu turno", e ele nem pode ser passado por outro
  await expect(j1.pagina.getByTestId("ordem-passar")).toBeVisible();
  await expect(j2.pagina.getByTestId("ordem-passar")).toHaveCount(0);
  const alheio = await enviarCru(j2.pagina, intencaoCrua("combate.passar", {}));
  expect(alheio).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
  await expect.poll(() => vezNaOrdem(j2.pagina)).toBe("Aldric");

  await j1.pagina.getByTestId("ordem-passar").click();
  await expect.poll(() => vezNaOrdem(j2.pagina)).toBe("Ogro");
  await expect(j1.pagina.getByTestId("ordem-passar")).toHaveCount(0);
  // agora é a vez do Ogro (NPC): nenhum jogador passa
  for (const s of [j1, j2]) {
    const r = await enviarCru(s.pagina, intencaoCrua("combate.passar", {}));
    expect(r).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
  }
  await expect.poll(() => vezNaOrdem(mestre.pagina)).toBe("Ogro");
  // quem não gerencia não avança: erro de permissão
  const avanca = await enviarCru(j1.pagina, intencaoCrua("combate.proximo", {}));
  expect(avanca).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
});

test("condição e concentração que o jogador aplica no próprio token aparecem para o mestre", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");

  // o menu do token só abre no token que o jogador edita
  await menuDoToken(j1.pagina, "tok-jogador-2");
  await expect(j1.pagina.getByTestId("menu-token")).toHaveCount(0);
  await menuDoToken(j1.pagina, "tok-jogador-1");
  await expect(j1.pagina.getByTestId("menu-token")).toBeVisible();
  // jogador cai direto nas condições (não tem a iniciativa, que é do mestre)
  await expect(j1.pagina.getByTestId("menu-token-painel-condicoes")).toBeVisible();
  await j1.pagina.getByTestId("condicao-caido").click();
  await j1.pagina.getByTestId("condicao-cego").click();
  await j1.pagina.getByTestId("condicao-envenenado").click();
  await j1.pagina.getByTestId("exaustao-2").click();
  await j1.pagina.getByTestId("concentracao-input").fill("Bênção");
  await j1.pagina.getByTestId("concentracao-aplicar").click();
  await expect(j1.pagina.getByTestId("condicao-caido")).toHaveAttribute("aria-checked", "true");
  await j1.pagina.getByTestId("menu-token-fechar").click();
  await expect(j1.pagina.getByTestId("menu-token")).toHaveCount(0);

  const esperado = ["Caído", "Cego", "Envenenado", "Exaustão 2", "Concentração: Bênção"];
  await expect
    .poll(async () => (await tokenDe(mestre.pagina, "tok-jogador-1")).marcas)
    .toEqual(esperado);
  await expect
    .poll(async () => (await tokenDe(j1.pagina, "tok-jogador-1")).marcas)
    .toEqual(esperado);
  // os outros jogadores que veem o token também as veem
  await expect
    .poll(async () => (await tokenDe(j2.pagina, "tok-jogador-1")).marcas)
    .toEqual(esperado);
  // e ninguém ganha marcas em outros tokens
  expect((await tokenDe(mestre.pagina, "tok-jogador-2")).marcas).toEqual([]);

  // a ficha do Aldric lista as condições (as do token na cena ativa)
  await mestre.pagina.getByTestId("aba-fichas").click();
  await mestre.pagina.getByTestId("ficha-abrir-pers-aldric").dblclick();
  const janela = mestre.pagina.locator(
    '[data-testid="janela-ficha"][data-personagem-id="pers-aldric"]',
  );
  await expect(janela.getByTestId("fh-condicao-caido")).toBeVisible();
  await expect(janela.getByTestId("fh-condicao-exaustao")).toContainText("Exaustão 2");
  await expect(janela.getByTestId("fh-condicao-concentracao")).toContainText("Bênção");
  await janela.getByTestId("janela-ficha-fechar").click();
  await expect(janela).toHaveCount(0);

  // outro jogador não mexe no token do Aldric, nem por fora da tela
  const r = await enviarCru(
    j2.pagina,
    intencaoCrua("token.condicoes", { id: "tok-jogador-1", condicoes: [] }),
  );
  expect(r).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
  // token oculto para o jogador responde como inexistente
  const oculto = await enviarCru(
    j2.pagina,
    intencaoCrua("token.condicoes", { id: "tok-goblin-oculto", condicoes: ["cego"] }),
  );
  expect(oculto).toMatchObject({ tipo: "erro", dados: { codigo: "token_inexistente" } });

  // o mestre tira tudo e o jogador vê
  await menuDoToken(mestre.pagina, "tok-jogador-1");
  await mestre.pagina.getByTestId("menu-token-condicoes").click();
  await mestre.pagina.getByTestId("condicao-caido").click();
  await mestre.pagina.getByTestId("condicao-cego").click();
  await mestre.pagina.getByTestId("condicao-envenenado").click();
  await mestre.pagina.getByTestId("exaustao-0").click();
  await mestre.pagina.getByTestId("concentracao-tirar").click();
  await expect.poll(async () => (await tokenDe(j1.pagina, "tok-jogador-1")).marcas).toEqual([]);
});

test("a dica do marcador mostra o resumo da regra; o mestre entra na iniciativa pelo menu do token", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await mandar(mestre.pagina, "token.condicoes", { id: "tok-ogro", condicoes: ["atordoado"] });
  await expect
    .poll(async () => (await tokenDe(mestre.pagina, "tok-ogro")).marcas)
    .toEqual(["Atordoado"]);
  const alvo = await mestre.pagina.evaluate(() => {
    const h = (
      window as unknown as {
        __tabletop: {
          tokens(): { id: string }[];
          centrarEm(x: number, y: number): void;
          marcaNaPagina(id: string, i: number): { x: number; y: number } | null;
        };
      }
    ).__tabletop;
    const t = h.tokens().find((x) => x.id === "tok-ogro") as unknown as { x: number; y: number };
    h.centrarEm(t.x, t.y);
    return h.marcaNaPagina("tok-ogro", 0);
  });
  if (!alvo) throw new Error("sem marcador");
  await mestre.pagina.mouse.move(alvo.x, alvo.y);
  const dica = mestre.pagina.getByTestId("dica-condicao");
  await expect(dica).toBeVisible();
  await expect(dica).toContainText("Atordoado");
  await expect(dica).toContainText("Incapacitado");
  await mestre.pagina.mouse.move(alvo.x + 300, alvo.y + 200);
  await expect(dica).toHaveCount(0);

  // botão direito no token do mestre: entrar na iniciativa, depois sair
  await ligarOrdem(mestre.pagina);
  await menuDoToken(mestre.pagina, "tok-ogro");
  await mestre.pagina.getByTestId("menu-token-iniciativa").click();
  await expect(linha(mestre.pagina, "Ogro")).toBeVisible();
  await menuDoToken(mestre.pagina, "tok-ogro");
  await mestre.pagina.getByTestId("menu-token-sair-iniciativa").click();
  await expect(linha(mestre.pagina, "Ogro")).toHaveCount(0);
});
