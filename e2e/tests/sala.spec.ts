import { readFileSync } from "node:fs";
import {
  abrirAba,
  CAMINHO_DA_MESA,
  enviarCru,
  expect,
  ID_DA_MESA,
  intencaoCrua,
  test,
  USUARIOS,
} from "./ajudas";
import { abrirHandout, criarHandoutPelaSala, mandar } from "./ajudasFicha";

test("a tela de entrada lista os 8 usuários e entrar abre a mesa", async ({ page }) => {
  await page.goto(CAMINHO_DA_MESA);
  for (const id of USUARIOS) await expect(page.getByTestId(`entrar-${id}`)).toBeVisible();

  await page.getByTestId("entrar-jogador-3").click();
  await expect(page.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(page.getByTestId("eu-nome")).toHaveText("Jogador 3");
  await expect(page.getByTestId("eu-papel")).toHaveText("jogador");
  // jogador não vê o painel do mestre
  await expect(page.getByTestId("painel-mestre")).toHaveCount(0);

  // a sessão continua depois do refresh; "trocar usuário" volta para a entrada
  await page.reload();
  await expect(page.getByTestId("eu-nome")).toHaveText("Jogador 3");
  await abrirAba(page, "preferencias");
  await page.getByTestId("trocar-usuario").click();
  await expect(page.getByTestId("entrar-mestre")).toBeVisible();
});

test("/ws sem usuário válido responde 401", async ({ request }) => {
  const r = await request.get(`/api/m/${ID_DA_MESA}/ws`, {
    headers: { Upgrade: "websocket", Connection: "Upgrade" },
  });
  expect(r.status()).toBe(401);
});

test("8 contextos entram e uma alteração aparece nos outros 7", async ({ mesa }) => {
  const sessoes = [];
  for (const id of USUARIOS) sessoes.push(await mesa.entrar(id));

  // todos veem todos online
  for (const s of sessoes) {
    for (const id of USUARIOS) {
      await expect(s.pagina.getByTestId(`presenca-estado-${id}`)).toHaveText("online");
    }
  }

  // o mestre cria um handout para todos; os 7 jogadores recebem (aparece na aba Fichas de cada um)
  for (const s of sessoes) await abrirAba(s.pagina, "fichas");
  const mestre = sessoes[0];
  if (!mestre) throw new Error("sem mestre");
  const id = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "Bem-vindos à masmorra",
    visivel: { tipo: "todos" },
  });
  for (const s of sessoes) {
    await expect(s.pagina.getByTestId(`handout-nome-${id}`)).toHaveText("Bem-vindos à masmorra");
  }

  // um jogador escreve no chat; os outros 7 (mestre incluso) recebem
  const jogador = sessoes[3];
  if (!jogador) throw new Error("sem jogador");
  await abrirAba(jogador.pagina, "chat");
  await jogador.pagina.getByTestId("chat-texto").fill("Achei uma chave");
  await jogador.pagina.getByTestId("chat-texto").press("Enter");
  for (const s of sessoes) {
    await abrirAba(s.pagina, "chat");
    await expect(s.pagina.getByTestId("chat-mensagens")).toContainText("Achei uma chave");
  }
});

test("refresh devolve o mesmo estado, inclusive o rascunho não enviado", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const id = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "Diário",
    visivel: { tipo: "todos" },
  });

  // o mestre escreve o texto; o jogador (que vê o handout) recebe
  const janelaDoMestre = await abrirHandout(mestre.pagina, id);
  await janelaDoMestre.getByTestId("handout-texto-campo").fill("texto do handout");
  const janelaDoJogador = await abrirHandout(j1.pagina, id);
  await expect(janelaDoJogador.getByTestId("handout-texto")).toHaveText("texto do handout");

  // refresh do mestre: tudo igual
  await mestre.pagina.reload();
  await expect(mestre.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  const depois = await abrirHandout(mestre.pagina, id);
  await expect(depois.getByTestId("handout-texto-campo")).toHaveValue("texto do handout");

  // digitar e dar refresh na hora (antes de o texto ser enviado): o texto não se perde
  await depois.getByTestId("handout-texto-campo").fill("digitado e recarregado");
  await mestre.pagina.reload();
  const outra = await abrirHandout(mestre.pagina, id);
  await expect(outra.getByTestId("handout-texto-campo")).toHaveValue("digitado e recarregado");
  await expect(janelaDoJogador.getByTestId("handout-texto")).toHaveText("digitado e recarregado");

  // rascunho que nunca foi enviado (ex.: a aba fechou antes): volta e é enviado ao reconectar
  await mestre.pagina.evaluate((h) => {
    localStorage.setItem(`tabletop:rascunho:mestre:handout:${h}`, "rascunho pendente");
  }, id);
  await mestre.pagina.reload();
  const terceira = await abrirHandout(mestre.pagina, id);
  await expect(terceira.getByTestId("handout-texto-campo")).toHaveValue("rascunho pendente");
  await expect(janelaDoJogador.getByTestId("handout-texto")).toHaveText("rascunho pendente");
  await expect
    .poll(() =>
      mestre.pagina.evaluate(
        (h) => localStorage.getItem(`tabletop:rascunho:mestre:handout:${h}`),
        id,
      ),
    )
    .toBeNull();
});

test("reiniciar a sala: todos reconectam sozinhos e o estado volta do SQLite", async ({
  mesa,
  request,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const j2 = await mesa.entrar("jogador-2");
  const id = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "Sobrevive",
    texto: "sobrevive ao reinício",
    visivel: { tipo: "todos" },
  });
  const secreto = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "Segredo",
    texto: "segredo que sobrevive",
  });
  for (const s of [mestre, j1, j2]) await abrirAba(s.pagina, "fichas");
  for (const s of [mestre, j1, j2]) {
    await expect(s.pagina.getByTestId(`handout-nome-${id}`)).toBeVisible();
  }

  // Um socket NOVO em cada página prova que o antigo caiu e que a reconexão automática agiu.
  const quedas = [mestre, j1, j2].map(
    (s) => new Promise<void>((resolver) => s.pagina.once("websocket", () => resolver())),
  );

  // A resposta desta chamada falha de propósito: a sala se derruba no meio dela.
  await request.post("/teste/reiniciar-sala").catch(() => {});
  await Promise.all(quedas); // um socket novo foi aberto em cada página (reconexão automática)

  for (const s of [mestre, j1, j2]) {
    await expect(s.pagina.getByTestId("status-conexao")).toHaveText("conectado");
    await expect(s.pagina.getByTestId(`handout-nome-${id}`)).toHaveText("Sobrevive");
  }
  // o do mestre sobreviveu para o mestre e continua escondido dos jogadores
  await expect(mestre.pagina.getByTestId(`handout-nome-${secreto}`)).toHaveText("Segredo");
  await expect(j1.pagina.getByTestId(`handout-nome-${secreto}`)).toHaveCount(0);
  const aberto = await abrirHandout(j1.pagina, id);
  await expect(aberto.getByTestId("handout-texto")).toHaveText("sobrevive ao reinício");

  // e a sala segue funcionando
  const janela = await abrirHandout(mestre.pagina, id);
  await janela.getByTestId("handout-texto-campo").fill("depois do reinício");
  await expect(aberto.getByTestId("handout-texto")).toHaveText("depois do reinício");
});

test("o mestre desliga porta.abrir: a sala recusa o jogador na hora; exceção por usuário e herdar", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const j2 = await mesa.entrar("jogador-2");
  const porta = intencaoCrua("porta.alternar", { id: "nao-existe" });
  const codigoDe = async (s: typeof j1) => (await enviarCru(s.pagina, porta))?.dados.codigo;
  // com a capacidade ligada (padrão) a sala responde que não há porta, nunca que falta permissão
  expect(await codigoDe(j1)).toBe("porta_inexistente");

  await abrirAba(mestre.pagina, "mesa");
  await mestre.pagina.getByTestId("perm-padrao-porta.abrir").click();
  await expect.poll(() => codigoDe(j1)).toBe("sem_permissao");
  await expect.poll(() => codigoDe(j2)).toBe("sem_permissao");

  // exceção por usuário: só o Jogador 2 volta a poder
  await mestre.pagina.getByTestId("excecao-usuario").selectOption({ label: "Jogador 2" });
  await mestre.pagina.getByTestId("perm-excecao-porta.abrir").selectOption("sim");
  await expect.poll(() => codigoDe(j2)).toBe("porta_inexistente");
  expect(await codigoDe(j1)).toBe("sem_permissao");

  // "herdar" remove a exceção; religar o padrão devolve a ação a todos
  await mestre.pagina.getByTestId("perm-excecao-porta.abrir").selectOption("herdar");
  await expect.poll(() => codigoDe(j2)).toBe("sem_permissao");
  await mestre.pagina.getByTestId("perm-padrao-porta.abrir").click();
  await expect.poll(() => codigoDe(j1)).toBe("porta_inexistente");
  await expect.poll(() => codigoDe(j2)).toBe("porta_inexistente");
});

test("mensagem inválida vira erro e a conexão continua", async ({ mesa }) => {
  const j1 = await mesa.entrar("jogador-1");
  const lixo = await enviarCru(j1.pagina, "{isto não é json");
  expect(lixo?.tipo).toBe("erro");
  expect(lixo?.dados.codigo).toBe("mensagem_invalida");
  const desconhecida = await enviarCru(j1.pagina, intencaoCrua("token.mover", { x: 1 }));
  expect(desconhecida?.dados.codigo).toBe("mensagem_invalida");
  await expect(j1.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  // ação de mestre por um jogador
  const proibida = await enviarCru(
    j1.pagina,
    intencaoCrua("papel.alterar", { usuarioId: "jogador-1", papel: "mestre" }),
  );
  expect(proibida?.dados.codigo).toBe("sem_permissao");
  await expect(j1.pagina.getByTestId("eu-papel")).toHaveText("jogador");
});

test("promover um jogador a mestre; o último mestre não se rebaixa", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const segredo = await criarHandoutPelaSala(mestre.pagina, { titulo: "SEGREDO DO MESTRE" });
  await abrirAba(j1.pagina, "fichas");
  await expect(j1.pagina.getByTestId(`handout-nome-${segredo}`)).toHaveCount(0);
  await expect(j1.pagina.getByTestId("painel-mestre")).toHaveCount(0);

  // promoção: o jogador recebe snapshot novo e passa a ver o que é do mestre
  await abrirAba(mestre.pagina, "mesa");
  await mestre.pagina.getByTestId("papel-jogador-1").selectOption("mestre");
  await expect(j1.pagina.getByTestId("eu-papel")).toHaveText("mestre");
  await abrirAba(j1.pagina, "fichas");
  await expect(j1.pagina.getByTestId(`handout-nome-${segredo}`)).toHaveText("SEGREDO DO MESTRE");
  await abrirAba(j1.pagina, "mesa");
  await expect(j1.pagina.getByTestId("painel-mestre")).toBeVisible();
  await expect(j1.pagina.getByTestId("uso-hoje")).toContainText("uso de hoje");

  // rebaixar o jogador-1 de volta (há outro mestre): ele perde o handout do mestre na hora
  await mestre.pagina.getByTestId("papel-jogador-1").selectOption("jogador");
  await expect(j1.pagina.getByTestId("eu-papel")).toHaveText("jogador");
  await abrirAba(j1.pagina, "fichas");
  await expect(j1.pagina.getByTestId(`handout-nome-${segredo}`)).toHaveCount(0);
  expect(await j1.pagina.content()).not.toContain("SEGREDO DO MESTRE");

  // o único mestre tenta se rebaixar: recusado
  await mestre.pagina.getByTestId("papel-mestre").selectOption("jogador");
  await expect(mestre.pagina.getByTestId("aviso")).toHaveAttribute("data-codigo", "ultimo_mestre");
  await expect(mestre.pagina.getByTestId("eu-papel")).toHaveText("mestre");
  await expect(mestre.pagina.getByTestId("papel-mestre")).toHaveValue("mestre");
});

test("frames recebidos pelo jogador nunca contêm o handout do mestre", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const segredo = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "SEGREDO-TITULO-1",
    texto: "SEGREDO-ULTRA-1",
  });
  await expect.poll(() => mestre.frames.some((f) => f.includes("SEGREDO-ULTRA-1"))).toBe(true);
  // exceção de outro jogador também é do mestre
  await abrirAba(mestre.pagina, "mesa");
  await mestre.pagina.getByTestId("excecao-usuario").selectOption({ label: "Jogador 2" });
  await mestre.pagina.getByTestId("perm-excecao-luz.apagar").selectOption("sim");

  // o jogador entra depois (recebe snapshot) ...
  const j1 = await mesa.entrar("jogador-1");
  // ... e o mestre muda de novo (recebe eventos)
  const publico = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "Aviso público",
    visivel: { tipo: "todos" },
  });
  await mandar(mestre.pagina, "handout.editar", {
    id: segredo,
    mudancas: { texto: "SEGREDO-ULTRA-2", titulo: "SEGREDO-TITULO-2" },
  });
  await abrirAba(j1.pagina, "fichas");
  await expect(j1.pagina.getByTestId(`handout-nome-${publico}`)).toHaveText("Aviso público");
  // ... reconecta (snapshot de novo)
  await j1.pagina.reload();
  await abrirAba(j1.pagina, "fichas");
  await expect(j1.pagina.getByTestId(`handout-nome-${publico}`)).toHaveText("Aviso público");
  await expect(j1.pagina.getByTestId(`handout-nome-${segredo}`)).toHaveCount(0);

  expect(j1.frames.length).toBeGreaterThan(3);
  for (const frame of j1.frames) {
    expect(frame).not.toContain("SEGREDO");
    expect(frame).not.toContain(segredo);
    expect(frame).not.toContain('"jogador-2":{');
  }
  // controle: os frames do mestre mostram que a captura funciona
  expect(mestre.frames.some((f) => f.includes("SEGREDO-ULTRA-2"))).toBe(true);
});

test("o mestre vê o uso de hoje; o jogador não", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  await expect(mestre.pagina.getByTestId("uso-hoje")).toContainText("uso de hoje: ");
  await expect(mestre.pagina.getByTestId("uso-hoje")).not.toContainText("—");
  await expect(j1.pagina.getByTestId("uso-hoje")).toHaveCount(0);
  expect(j1.frames.some((f) => f.includes('"tipo":"uso"'))).toBe(false);
});

test("presença: ao fechar a aba o outro vê reconectando e depois offline", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  await expect(mestre.pagina.getByTestId("presenca-estado-jogador-1")).toHaveText("online");
  await j1.contexto.close();
  await expect(mestre.pagina.getByTestId("presenca-estado-jogador-1")).toHaveText("reconectando");
  // o agendador (alarme) vence o prazo de 10 s
  await expect(mestre.pagina.getByTestId("presenca-estado-jogador-1")).toHaveText("offline", {
    timeout: 25_000,
  });
});

test("exportar → zerar → importar devolve tudo igual", async ({ mesa, request }) => {
  const mestre = await mesa.entrar("mestre");
  const daMesa = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "Nota da mesa exportada",
    texto: "nota da mesa exportada",
    visivel: { tipo: "todos" },
  });
  const doMestre = await criarHandoutPelaSala(mestre.pagina, {
    titulo: "Nota do mestre exportada",
    texto: "nota do mestre exportada",
  });
  await abrirAba(mestre.pagina, "mesa");
  await mestre.pagina.getByTestId("perm-padrao-luz.apagar").click();
  await mestre.pagina.getByTestId("excecao-usuario").selectOption({ label: "Jogador 4" });
  await mestre.pagina.getByTestId("perm-excecao-tocha.entregar").selectOption("nao");
  await abrirAba(mestre.pagina, "mesa");
  await mestre.pagina.getByTestId("papel-jogador-1").selectOption("mestre");
  await expect(mestre.pagina.getByTestId("papel-jogador-1")).toHaveValue("mestre");
  const j5 = await mesa.entrar("jogador-5");
  await abrirAba(j5.pagina, "fichas");
  await expect(j5.pagina.getByTestId(`handout-nome-${daMesa}`)).toBeVisible();

  await abrirAba(mestre.pagina, "mesa");
  const exportar = async () => {
    const [download] = await Promise.all([
      mestre.pagina.waitForEvent("download"),
      mestre.pagina.getByTestId("exportar").click(),
    ]);
    const caminho = await download.path();
    return { caminho, json: JSON.parse(readFileSync(caminho, "utf8")) };
  };
  const antes = await exportar();
  expect(antes.json.formato).toBe("tabletop-campanha");
  expect(antes.json.versao).toBe(13);
  expect(antes.json.dados.handouts.map((h: { id: string }) => h.id)).toEqual([daMesa, doMestre]);
  expect(antes.json.dados.notaMestre).toBeUndefined();

  // apaga tudo: a mesa volta ao seed
  await request.post("/teste/zerar");
  await abrirAba(mestre.pagina, "fichas");
  await expect(mestre.pagina.getByTestId(`handout-nome-${daMesa}`)).toHaveCount(0);
  await abrirAba(mestre.pagina, "mesa");
  await expect(mestre.pagina.getByTestId("papel-jogador-1")).toHaveValue("jogador");

  // importa: o mestre e o jogador conectado recebem snapshot novo
  await mestre.pagina.getByTestId("importar-arquivo").setInputFiles(antes.caminho);
  await expect(mestre.pagina.getByTestId("papel-jogador-1")).toHaveValue("mestre");
  await abrirAba(mestre.pagina, "fichas");
  await expect(mestre.pagina.getByTestId(`handout-nome-${daMesa}`)).toBeVisible();
  await expect(mestre.pagina.getByTestId(`handout-nome-${doMestre}`)).toBeVisible();
  await expect(j5.pagina.getByTestId(`handout-nome-${daMesa}`)).toBeVisible();
  await expect(j5.pagina.getByTestId(`handout-nome-${doMestre}`)).toHaveCount(0);

  await abrirAba(mestre.pagina, "mesa");
  const depois = await exportar();
  expect(depois.json.dados).toEqual(antes.json.dados);
});

test("importar um arquivo inválido mostra um aviso e não muda nada", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const id = await criarHandoutPelaSala(mestre.pagina, { titulo: "Intacto" });
  await abrirAba(mestre.pagina, "fichas");
  await expect(mestre.pagina.getByTestId(`handout-nome-${id}`)).toHaveText("Intacto");
  await abrirAba(mestre.pagina, "mesa");
  await mestre.pagina.getByTestId("importar-arquivo").setInputFiles({
    name: "ruim.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ formato: "outro" })),
  });
  await expect(mestre.pagina.getByTestId("aviso")).toHaveAttribute(
    "data-codigo",
    "importacao_invalida",
  );
  await abrirAba(mestre.pagina, "fichas");
  await expect(mestre.pagina.getByTestId(`handout-nome-${id}`)).toHaveText("Intacto");
});
