import { readFileSync } from "node:fs";
import { abrirAba, enviarCru, expect, intencaoCrua, test, USUARIOS } from "./ajudas";

test("a tela de entrada lista os 8 usuários e entrar abre a mesa", async ({ page }) => {
  await page.goto("/");
  for (const id of USUARIOS) await expect(page.getByTestId(`entrar-${id}`)).toBeVisible();

  await page.getByTestId("entrar-jogador-3").click();
  await expect(page.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(page.getByTestId("eu-nome")).toHaveText("Jogador 3");
  await expect(page.getByTestId("eu-papel")).toHaveText("jogador");
  // jogador não vê o painel nem a nota do mestre
  await expect(page.getByTestId("painel-mestre")).toHaveCount(0);
  await expect(page.getByTestId("nota-mestre")).toHaveCount(0);

  // a sessão continua depois do refresh; "trocar usuário" volta para a entrada
  await page.reload();
  await expect(page.getByTestId("eu-nome")).toHaveText("Jogador 3");
  await abrirAba(page, "configuracoes");
  await page.getByTestId("trocar-usuario").click();
  await expect(page.getByTestId("entrar-mestre")).toBeVisible();
});

test("/ws sem usuário válido responde 401", async ({ request }) => {
  const r = await request.get("/ws", { headers: { Upgrade: "websocket", Connection: "Upgrade" } });
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

  // o mestre escreve; os 7 jogadores recebem
  for (const s of sessoes) await abrirAba(s.pagina, "notas");
  await sessoes[0]?.pagina.getByTestId("nota-mesa").fill("Bem-vindos à masmorra");
  for (const s of sessoes)
    await expect(s.pagina.getByTestId("nota-mesa")).toHaveValue("Bem-vindos à masmorra");

  // um jogador escreve; os outros 7 (mestre incluso) recebem
  await sessoes[3]?.pagina.getByTestId("nota-mesa").fill("Achei uma chave");
  for (const s of sessoes)
    await expect(s.pagina.getByTestId("nota-mesa")).toHaveValue("Achei uma chave");
});

test("refresh devolve o mesmo estado, inclusive o rascunho não enviado", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const j2 = await mesa.entrar("jogador-2");
  for (const s of [mestre, j1, j2]) await abrirAba(s.pagina, "notas");

  await mestre.pagina.getByTestId("nota-mesa").fill("texto da mesa");
  await mestre.pagina.getByTestId("nota-mestre").fill("texto do mestre");
  await expect(j1.pagina.getByTestId("nota-mesa")).toHaveValue("texto da mesa");

  // refresh do mestre: tudo igual
  await mestre.pagina.reload();
  await expect(mestre.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await abrirAba(mestre.pagina, "notas");
  await expect(mestre.pagina.getByTestId("nota-mesa")).toHaveValue("texto da mesa");
  await expect(mestre.pagina.getByTestId("nota-mestre")).toHaveValue("texto do mestre");

  // digitar e dar refresh na hora (antes dos 300 ms): o texto não se perde
  await j2.pagina.getByTestId("nota-mesa").fill("digitado e recarregado");
  await j2.pagina.reload();
  await abrirAba(j2.pagina, "notas");
  await expect(j2.pagina.getByTestId("nota-mesa")).toHaveValue("digitado e recarregado");
  await expect(mestre.pagina.getByTestId("nota-mesa")).toHaveValue("digitado e recarregado");

  // rascunho que nunca foi enviado (ex.: a aba fechou antes): volta e é enviado ao reconectar
  await j1.pagina.evaluate(() => {
    localStorage.setItem("tabletop:rascunho:jogador-1:mesa", "rascunho pendente");
  });
  await j1.pagina.reload();
  await abrirAba(j1.pagina, "notas");
  await expect(j1.pagina.getByTestId("nota-mesa")).toHaveValue("rascunho pendente");
  await expect(mestre.pagina.getByTestId("nota-mesa")).toHaveValue("rascunho pendente");
  await expect
    .poll(() => j1.pagina.evaluate(() => localStorage.getItem("tabletop:rascunho:jogador-1:mesa")))
    .toBeNull();
});

test("reiniciar a sala: todos reconectam sozinhos e o estado volta do SQLite", async ({
  mesa,
  request,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const j2 = await mesa.entrar("jogador-2");
  for (const s of [mestre, j1, j2]) await abrirAba(s.pagina, "notas");
  await mestre.pagina.getByTestId("nota-mesa").fill("sobrevive ao reinício");
  await mestre.pagina.getByTestId("nota-mestre").fill("segredo que sobrevive");
  await expect(j1.pagina.getByTestId("nota-mesa")).toHaveValue("sobrevive ao reinício");

  // Um socket NOVO em cada página prova que o antigo caiu e que a reconexão automática agiu.
  const quedas = [mestre, j1, j2].map(
    (s) => new Promise<void>((resolver) => s.pagina.once("websocket", () => resolver())),
  );

  // A resposta desta chamada falha de propósito: a sala se derruba no meio dela.
  await request.post("/teste/reiniciar-sala").catch(() => {});
  await Promise.all(quedas); // um socket novo foi aberto em cada página (reconexão automática)

  for (const s of [mestre, j1, j2]) {
    await expect(s.pagina.getByTestId("status-conexao")).toHaveText("conectado");
    await expect(s.pagina.getByTestId("nota-mesa")).toHaveValue("sobrevive ao reinício");
  }
  await expect(mestre.pagina.getByTestId("nota-mestre")).toHaveValue("segredo que sobrevive");

  // e a sala segue funcionando
  await j1.pagina.getByTestId("nota-mesa").fill("depois do reinício");
  await expect(mestre.pagina.getByTestId("nota-mesa")).toHaveValue("depois do reinício");
});

test("o mestre desliga nota.editar: o jogador perde a ação na hora", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const j2 = await mesa.entrar("jogador-2");
  await abrirAba(j1.pagina, "notas");
  await abrirAba(j2.pagina, "notas");
  await expect(j1.pagina.getByTestId("nota-mesa")).toBeEnabled();

  await abrirAba(mestre.pagina, "mestre");
  await mestre.pagina.getByTestId("perm-padrao-nota.editar").click();
  await expect(j1.pagina.getByTestId("nota-mesa")).toBeDisabled();
  await expect(j2.pagina.getByTestId("nota-mesa")).toBeDisabled();
  // o mestre continua podendo
  await expect(mestre.pagina.getByTestId("nota-mesa")).toBeEnabled();

  // forçando o envio por fora da interface: a sala recusa
  const resposta = await enviarCru(j1.pagina, intencaoCrua("nota.editar", { texto: "burlei" }));
  expect(resposta?.tipo).toBe("erro");
  expect(resposta?.dados.codigo).toBe("sem_permissao");
  await expect(mestre.pagina.getByTestId("nota-mesa")).not.toHaveValue("burlei");

  // exceção por usuário: só o Jogador 2 volta a poder editar
  await mestre.pagina.getByTestId("excecao-usuario").selectOption({ label: "Jogador 2" });
  await mestre.pagina.getByTestId("perm-excecao-nota.editar").selectOption("sim");
  await expect(j2.pagina.getByTestId("nota-mesa")).toBeEnabled();
  await expect(j1.pagina.getByTestId("nota-mesa")).toBeDisabled();
  await j2.pagina.getByTestId("nota-mesa").fill("só eu posso");
  await expect(mestre.pagina.getByTestId("nota-mesa")).toHaveValue("só eu posso");

  // "herdar" remove a exceção; religar o padrão devolve a ação a todos
  await mestre.pagina.getByTestId("perm-excecao-nota.editar").selectOption("herdar");
  await expect(j2.pagina.getByTestId("nota-mesa")).toBeDisabled();
  await mestre.pagina.getByTestId("perm-padrao-nota.editar").click();
  await expect(j1.pagina.getByTestId("nota-mesa")).toBeEnabled();
  await expect(j2.pagina.getByTestId("nota-mesa")).toBeEnabled();
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
  await abrirAba(mestre.pagina, "notas");
  await mestre.pagina.getByTestId("nota-mestre").fill("SEGREDO DO MESTRE");
  await expect(j1.pagina.getByTestId("nota-mestre")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("painel-mestre")).toHaveCount(0);

  // promoção: o jogador recebe snapshot novo e passa a ver o que é do mestre
  await abrirAba(mestre.pagina, "jogadores");
  await mestre.pagina.getByTestId("papel-jogador-1").selectOption("mestre");
  await expect(j1.pagina.getByTestId("eu-papel")).toHaveText("mestre");
  await expect(j1.pagina.getByTestId("nota-mestre")).toHaveValue("SEGREDO DO MESTRE");
  await abrirAba(j1.pagina, "mestre");
  await expect(j1.pagina.getByTestId("painel-mestre")).toBeVisible();
  await expect(j1.pagina.getByTestId("uso-hoje")).toContainText("uso de hoje");

  // rebaixar o jogador-1 de volta (há outro mestre): ele perde a nota do mestre na hora
  await mestre.pagina.getByTestId("papel-jogador-1").selectOption("jogador");
  await expect(j1.pagina.getByTestId("eu-papel")).toHaveText("jogador");
  await expect(j1.pagina.getByTestId("nota-mestre")).toHaveCount(0);
  expect(await j1.pagina.content()).not.toContain("SEGREDO DO MESTRE");

  // o único mestre tenta se rebaixar: recusado
  await mestre.pagina.getByTestId("papel-mestre").selectOption("jogador");
  await expect(mestre.pagina.getByTestId("aviso")).toHaveAttribute("data-codigo", "ultimo_mestre");
  await expect(mestre.pagina.getByTestId("eu-papel")).toHaveText("mestre");
  await expect(mestre.pagina.getByTestId("papel-mestre")).toHaveValue("mestre");
});

test("frames recebidos pelo jogador nunca contêm a nota do mestre", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  await abrirAba(mestre.pagina, "notas");
  await mestre.pagina.getByTestId("nota-mestre").fill("SEGREDO-ULTRA-1");
  await expect.poll(() => mestre.frames.some((f) => f.includes("SEGREDO-ULTRA-1"))).toBe(true);
  // exceção de outro jogador também é do mestre
  await abrirAba(mestre.pagina, "mestre");
  await mestre.pagina.getByTestId("excecao-usuario").selectOption({ label: "Jogador 2" });
  await mestre.pagina.getByTestId("perm-excecao-luz.apagar").selectOption("sim");

  // o jogador entra depois (recebe snapshot) ...
  const j1 = await mesa.entrar("jogador-1");
  // ... e o mestre muda de novo (recebe eventos)
  await abrirAba(mestre.pagina, "notas");
  await mestre.pagina.getByTestId("nota-mestre").fill("SEGREDO-ULTRA-2");
  await mestre.pagina.getByTestId("nota-mesa").fill("nota pública");
  await expect(j1.pagina.getByTestId("nota-mesa")).toHaveValue("nota pública");
  // ... reconecta (snapshot de novo)
  await j1.pagina.reload();
  await expect(j1.pagina.getByTestId("nota-mesa")).toHaveValue("nota pública");

  expect(j1.frames.length).toBeGreaterThan(3);
  for (const frame of j1.frames) {
    expect(frame).not.toContain("SEGREDO");
    expect(frame).not.toContain("notaMestre");
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
  await abrirAba(mestre.pagina, "notas");
  await mestre.pagina.getByTestId("nota-mesa").fill("nota da mesa exportada");
  await mestre.pagina.getByTestId("nota-mestre").fill("nota do mestre exportada");
  await abrirAba(mestre.pagina, "mestre");
  await mestre.pagina.getByTestId("perm-padrao-luz.apagar").click();
  await mestre.pagina.getByTestId("excecao-usuario").selectOption({ label: "Jogador 4" });
  await mestre.pagina.getByTestId("perm-excecao-nota.editar").selectOption("nao");
  await abrirAba(mestre.pagina, "jogadores");
  await mestre.pagina.getByTestId("papel-jogador-1").selectOption("mestre");
  await expect(mestre.pagina.getByTestId("papel-jogador-1")).toHaveValue("mestre");
  const j5 = await mesa.entrar("jogador-5");
  await expect(j5.pagina.getByTestId("nota-mesa")).toHaveValue("nota da mesa exportada");

  await abrirAba(mestre.pagina, "mestre");
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
  expect(antes.json.dados.notaMestre).toBe("nota do mestre exportada");

  // apaga tudo: a mesa volta ao seed
  await request.post("/teste/zerar");
  await expect(mestre.pagina.getByTestId("nota-mesa")).toHaveValue("");
  await expect(mestre.pagina.getByTestId("nota-mestre")).toHaveValue("");
  await expect(mestre.pagina.getByTestId("papel-jogador-1")).toHaveValue("jogador");

  // importa: o mestre e o jogador conectado recebem snapshot novo
  await mestre.pagina.getByTestId("importar-arquivo").setInputFiles(antes.caminho);
  await expect(mestre.pagina.getByTestId("nota-mesa")).toHaveValue("nota da mesa exportada");
  await expect(mestre.pagina.getByTestId("nota-mestre")).toHaveValue("nota do mestre exportada");
  await expect(mestre.pagina.getByTestId("papel-jogador-1")).toHaveValue("mestre");
  await expect(j5.pagina.getByTestId("nota-mesa")).toHaveValue("nota da mesa exportada");

  const depois = await exportar();
  expect(depois.json.dados).toEqual(antes.json.dados);
});

test("importar um arquivo inválido mostra um aviso e não muda nada", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  await abrirAba(mestre.pagina, "notas");
  await mestre.pagina.getByTestId("nota-mesa").fill("intacta");
  await mestre.pagina.getByTestId("importar-arquivo").setInputFiles({
    name: "ruim.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ formato: "outro" })),
  });
  await expect(mestre.pagina.getByTestId("aviso")).toHaveAttribute(
    "data-codigo",
    "importacao_invalida",
  );
  await expect(mestre.pagina.getByTestId("nota-mesa")).toHaveValue("intacta");
});
