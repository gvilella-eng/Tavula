import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import {
  definirValor,
  emVez,
  ligarOrdem,
  linha,
  menuDaLinha,
  menuDoToken,
  nomesNaOrdem,
  vezNaOrdem,
} from "./ajudasCombate";
import { mandar } from "./ajudasFicha";
import { entrarNoMapa, tokenDe } from "./ajudasMapa";

// Lote 11: combate (ordem de turno, condições e concentração). A semente da campanha traz Aldric, Brisa e
// Cael (jogador-1, 2 e 3), o Ogro (NPC visível), um goblin oculto e um marcador na camada do mestre.

test("o mestre avança o turno e o jogador vê a vez mudar: na lista e no anel do token", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await ligarOrdem(mestre.pagina);
  await expect(j1.pagina.getByTestId("ordem-de-turno")).toBeVisible();
  await expect(j1.pagina.getByTestId("ordem-vazia")).toBeVisible();

  // o grupo e o Ogro entram na lista (V2: a interface de "Montar" saiu; aqui vale a intenção da sala)
  await mandar(mestre.pagina, "combate.adicionar", {
    entradas: ["tok-jogador-1", "tok-jogador-2", "tok-jogador-3", "tok-ogro"].map((t) => ({
      id: `e-${t}`,
      tokenId: t,
    })),
  });
  await expect(linha(mestre.pagina, "Cael")).toBeVisible();
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
  await expect(mestre.pagina.getByTestId("ordem-rodada")).toContainText("não começou");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: não começou");

  // primeiro Próximo: rodada 1, vez do Aldric
  await mestre.pagina.getByTestId("ordem-proximo").click();
  for (const s of [mestre, j1]) {
    await expect.poll(() => vezNaOrdem(s.pagina)).toBe("Aldric");
    await expect(s.pagina.getByTestId("ordem-rodada")).toHaveAttribute("data-rodada", "1");
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
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 2");
  // botão direito na linha: "Dar a vez" (substitui o Anterior); a rodada continua
  await menuDaLinha(mestre.pagina, "Cael", "ordem-menu-dar-vez");
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Cael");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 2");

  // o jogador não tem os comandos do mestre, nem o menu da linha
  await expect(j1.pagina.getByTestId("ordem-proximo")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("ordem-encerrar")).toHaveCount(0);
  await linha(j1.pagina, "Cael").click({ button: "right" });
  await expect(j1.pagina.getByTestId("ordem-menu")).toHaveCount(0);

  // tirar a entrada da vez passa o turno (botão direito > "Tirar da lista")
  await menuDaLinha(mestre.pagina, "Cael", "ordem-menu-tirar");
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Aldric", "Ogro", "Brisa"]);
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Aldric");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 3");
  await expect.poll(() => emVez(j1.pagina, "tok-jogador-3")).toBe(false);

  // Limpar pede confirmação; cancelar não apaga; confirmar limpa para todos
  await mestre.pagina.getByTestId("ordem-encerrar").click();
  await mestre.pagina.getByTestId("ordem-encerrar-nao").click();
  await expect(linha(mestre.pagina, "Aldric")).toBeVisible();
  await mestre.pagina.getByTestId("ordem-encerrar").click();
  await mestre.pagina.getByTestId("ordem-encerrar-sim").click();
  for (const s of [mestre, j1]) {
    await expect(s.pagina.getByTestId("ordem-vazia")).toBeVisible();
    await expect(s.pagina.getByTestId("ordem-rodada")).toHaveAttribute("data-rodada", "0");
  }
  // limpar não fecha a janela
  await expect(j1.pagina.getByTestId("ordem-de-turno")).toBeVisible();
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

  // rolar para todos (pela sala; a interface de "Rolar para todos" saiu no V2): os NPCs rolam ocultos (só o
  // mestre vê); os PJs, em público
  await mandar(mestre.pagina, "combate.rolar", {});
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
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 1");
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

test("o jogador não rola nem passa o turno de outro, nem por fora da tela (a sala confere)", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await ligarOrdem(mestre.pagina);
  await mandar(mestre.pagina, "combate.adicionar", {
    entradas: [
      { id: "e-aldric", tokenId: "tok-jogador-1" },
      { id: "e-brisa", tokenId: "tok-jogador-2" },
      { id: "e-ogro", tokenId: "tok-ogro" },
    ],
  });
  await expect(linha(j1.pagina, "Ogro")).toBeVisible();
  // a lista do jogador não tem botão de rolar nem de passar: entra-se pela ficha (V2)
  await expect(j1.pagina.getByTestId("ordem-passar")).toHaveCount(0);
  await expect(j1.pagina.locator('[data-testid^="ordem-rolar-"]')).toHaveCount(0);

  // rolar a de outro, a de NPC ou sem dizer qual é recusado
  const outro = await enviarCru(j1.pagina, intencaoCrua("combate.rolar", { ids: ["e-brisa"] }));
  expect(outro).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
  const npc = await enviarCru(j1.pagina, intencaoCrua("combate.rolar", { ids: ["e-ogro"] }));
  expect(npc).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });

  // o mestre abre a rodada: a vez é do Aldric; o Brisa (j2) não passa o turno dele
  await definirValor(mestre.pagina, "Aldric", 20);
  await definirValor(mestre.pagina, "Brisa", 1);
  await definirValor(mestre.pagina, "Ogro", 3);
  await expect.poll(() => nomesNaOrdem(j2.pagina)).toEqual(["Aldric", "Ogro", "Brisa"]);
  await mestre.pagina.getByTestId("ordem-proximo").click();
  await expect.poll(() => vezNaOrdem(j2.pagina)).toBe("Aldric");
  const alheio = await enviarCru(j2.pagina, intencaoCrua("combate.passar", {}));
  expect(alheio).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
  await expect.poll(() => vezNaOrdem(j2.pagina)).toBe("Aldric");

  // quem não gerencia não avança, não escreve a rodada nem dá a vez
  for (const [tipo, dados] of [
    ["combate.proximo", {}],
    ["combate.rodada", { rodada: 9 }],
    ["combate.darVez", { id: "e-brisa" }],
  ] as const) {
    const r = await enviarCru(j1.pagina, intencaoCrua(tipo, dados));
    expect(r, tipo).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });
  }
  await expect.poll(() => vezNaOrdem(mestre.pagina)).toBe("Aldric");
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
  // jogador vê direto as condições (não tem "Editar token…" nem a iniciativa, que são do mestre)
  await expect(j1.pagina.getByTestId("menu-token-painel-condicoes")).toBeVisible();
  await expect(j1.pagina.getByTestId("menu-token-editar")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("menu-token-iniciativa")).toHaveCount(0);
  await j1.pagina.getByTestId("condicao-caido").click();
  // espera a sala confirmar antes do próximo clique (cada clique manda a lista inteira a partir do estado conhecido)
  await expect(j1.pagina.getByTestId("condicao-caido")).toHaveAttribute("aria-checked", "true");
  await j1.pagina.getByTestId("condicao-cego").click();
  // espera a sala confirmar antes do próximo clique (cada clique manda a lista inteira a partir do estado conhecido)
  await expect(j1.pagina.getByTestId("condicao-cego")).toHaveAttribute("aria-checked", "true");
  await j1.pagina.getByTestId("condicao-envenenado").click();
  // espera a sala confirmar antes do próximo clique (cada clique manda a lista inteira a partir do estado conhecido)
  await expect(j1.pagina.getByTestId("condicao-envenenado")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await j1.pagina.getByTestId("exaustao-2").click();
  await j1.pagina.getByTestId("concentracao-input").fill("Bênção");
  await j1.pagina.getByTestId("concentracao-aplicar").click();
  await expect(j1.pagina.getByTestId("condicao-caido")).toHaveAttribute("aria-checked", "true");
  // o menu ficou aberto durante as marcações; Esc o fecha
  await expect(j1.pagina.getByTestId("menu-token")).toBeVisible();
  await j1.pagina.keyboard.press("Escape");
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

  // V4a2: a ficha não lista mais as condições (ficam no token e no menu dele)
  await mestre.pagina.getByTestId("aba-fichas").click();
  await mestre.pagina.getByTestId("ficha-abrir-pers-aldric").dblclick();
  const janela = mestre.pagina.locator(
    '[data-testid="janela-ficha"][data-personagem-id="pers-aldric"]',
  );
  await expect(janela).toBeVisible();
  await expect(janela.getByTestId("fh-condicoes")).toHaveCount(0);
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
  await expect(mestre.pagina.getByTestId("menu-token-painel-condicoes")).toBeVisible();
  // um clique por vez, esperando o marcador soltar: o menu parte do que a sala já mandou, e clicar na
  // frente disso (antes de a rodada de eventos chegar) refazia o marcador (instável)
  for (const c of ["caido", "cego", "envenenado"]) {
    await expect(mestre.pagina.getByTestId(`condicao-${c}`)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await mestre.pagina.getByTestId(`condicao-${c}`).click();
    await expect(mestre.pagina.getByTestId(`condicao-${c}`)).toHaveAttribute(
      "aria-checked",
      "false",
    );
  }
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
