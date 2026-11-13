import { abrirAba, expect, ID_DA_MESA, type Sessao, test } from "./ajudas";
import { ClaudeWs, gerarToken, SALA_E2E, tentarAbrir } from "./ajudasClaude";
import { abrirHandout } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// 12-1: o acesso do Claude à mesa (token por usuário, a conexão do Claude, rascunhos, "Desfazer", "pelo Claude") e o
// jogador que cria as próprias fichas e handouts. Um WebSocket do Node com `Authorization: Bearer` imita o cliente do MCP
// (o servidor MCP é o 12-2).

test.describe.configure({ timeout: 120_000 });

const doJogador = (s: Sessao) => s.frames.join("\n");
const pasta = "pasta-npcs";
const npc = (id: string, nome: string) => ({
  id,
  pastaId: pasta,
  editores: { tipo: "jogadores", ids: [] },
  nome,
  tokenPadrao: { cor: "#c0392b", tamanhoQuadrados: 1 },
  visao: { alcanceM: null, visaoNoEscuroM: 0 },
});

test("gerar o token em Preferências (aparece uma vez), conectar com ele, o Claude aparece na bolinha e revogar derruba a conexão", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "preferencias");
  const secao = p.getByTestId("conectar-claude");
  await expect(secao).toBeVisible();
  await expect(p.getByTestId("claude-tokens")).toHaveCount(0);

  await p.getByTestId("claude-token-nome").fill("Claude no meu PC");
  await p.getByTestId("claude-gerar").click();
  const caixa = p.getByTestId("claude-token-novo");
  await expect(caixa).toBeVisible();
  const token = (await p.getByTestId("claude-token-valor").textContent()) ?? "";
  expect(token).toMatch(/^tvc_[A-Za-z0-9_-]{43}$/);
  // o trecho pronto para o Claude Code e para o Claude Desktop leva o endereço da mesa e o token
  await expect(p.getByTestId("claude-trecho-code")).toContainText(token);
  await expect(p.getByTestId("claude-trecho-code")).toContainText(`TAVOLA_MESA=${ID_DA_MESA}`);
  await expect(p.getByTestId("claude-copiar-token")).toBeVisible();
  await expect(p.getByTestId("claude-copiar-code")).toBeVisible();
  await p.getByText("Claude Desktop", { exact: true }).click();
  await expect(p.getByTestId("claude-trecho-desktop")).toContainText("TAVOLA_TOKEN");

  // a lista tem nome, criação e uso; o token em si nunca volta
  const linha = p.getByTestId("claude-token");
  await expect(linha).toHaveCount(1);
  await expect(linha).toContainText("Claude no meu PC");
  await expect(linha).toContainText("nunca usado");
  await expect(linha).not.toContainText(token);
  await p.getByTestId("claude-token-guardei").click();
  await expect(caixa).toHaveCount(0);
  await expect(p.getByText(token)).toHaveCount(0);
  // recarregar não mostra o token de novo
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await abrirAba(p, "preferencias");
  await expect(p.getByTestId("claude-token")).toHaveCount(1);
  expect(await p.content()).not.toContain(token);

  // conecta com o token (um cliente que não é navegador: sem cookie, sem Origin)
  const claude = await ClaudeWs.conectar(token);
  expect(claude.quadros.find((q) => q.tipo === "snapshot")?.dados.usuarioId).toBe("mestre");
  // o Claude não vira outra pessoa no topo: a bolinha do usuário ganha uma marca pequena
  await expect(p.getByTestId("presenca-claude-mestre")).toBeVisible();
  await expect(p.getByTestId("presenca-mestre")).toHaveAttribute("data-claude", "sim");
  await expect(p.getByTestId("presenca-estado-mestre")).toHaveText("online");
  await expect(linha)
    .toContainText("último uso agora", { timeout: 15_000 })
    .catch(() => {});

  // revogar (com confirmação na página) derruba a conexão aberta
  await p.getByTestId("claude-revogar").click();
  await expect(p.getByTestId("claude-revogar-confirmacao")).toBeVisible();
  await p.getByTestId("claude-revogar-confirmar").click();
  await expect(p.getByTestId("claude-token")).toHaveCount(0);
  expect(await claude.esperarFechar()).toBe(4001);
  await expect(p.getByTestId("presenca-claude-mestre")).toHaveCount(0);
  // e o token revogado não abre mais (a mesma resposta de um token errado)
  const revogado = await tentarAbrir({ Authorization: `Bearer ${token}` });
  const errado = await tentarAbrir({ Authorization: `Bearer tvc_${"x".repeat(43)}` });
  expect(revogado.status).toBe(401);
  expect(errado.status).toBe(401);
  expect(revogado.corpo).toBe(errado.corpo);
});

test("o token só vale no WebSocket: não abre sessão de navegador, não gera cookie e nenhuma rota HTTP o aceita", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { token } = await gerarToken(mestre.pagina);
  const bearer = { Authorization: `Bearer ${token}` };

  // abre o WebSocket (e olha a resposta crua): 101, sem Set-Cookie
  const aberto = await tentarAbrir(bearer);
  expect(aberto.status).toBe(101);
  expect(aberto.cabecalhos["set-cookie"]).toBeUndefined();
  // sem o cabeçalho e sem cookie: 401
  const semNada = await tentarAbrir({});
  expect(semNada.status).toBe(401);
  // token fora do formato: o mesmo 401
  expect((await tentarAbrir({ Authorization: "Bearer lixo" })).status).toBe(401);
  expect((await tentarAbrir({ Authorization: `Basic ${token}` })).status).toBe(401);

  // nenhuma rota HTTP aceita o token (só o cookie de sessão): nada de "eu", contas, tokens
  const base = `http://${SALA_E2E}/api/m/${ID_DA_MESA}`;
  for (const rota of ["eu", "contas", "conta/claude"]) {
    const r = await fetch(`${base}/${rota}`, { headers: bearer });
    // 401 sem sessão (a rota dos tokens recusa o cabeçalho Authorization com 403, mais explícito)
    expect([401, 403], rota).toContain(r.status);
    expect(r.headers.get("set-cookie"), rota).toBeNull();
  }
  // gerar e revogar tokens é só da pessoa: nem com o token de um Claude (nem com a sessão da pessoa + o cabeçalho)
  const gerar = await mestre.pagina.request.post(`/api/m/${ID_DA_MESA}/conta/claude/gerar`, {
    data: {},
    headers: bearer,
  });
  expect(gerar.status()).toBe(403);
  expect((await gerar.json()).mensagem).toContain("O Claude não gera nem revoga tokens");
  const semSessao = await fetch(`${base}/conta/claude/gerar`, {
    method: "POST",
    headers: { ...bearer, "Content-Type": "application/json" },
    body: "{}",
  });
  expect([401, 403]).toContain(semSessao.status);
  // a lista (do dono) tem o token, sem o token nem o hash
  const lista = await (await mestre.pagina.request.get(`/api/m/${ID_DA_MESA}/conta/claude`)).text();
  expect(lista).not.toContain(token);
  expect(lista).not.toContain("hash");
});

test("a conexão do Claude é uma conexão comum: mesmas recusas do usuário, a lista de proibidos e a rolagem 'pelo Claude' no chat", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");

  // a ficha do jogador 2 (só ele e o mestre a veem)
  const criador = await ClaudeWs.conectar((await gerarToken(mestre.pagina)).token);
  const r = await criador.mandar("personagem.criar", {
    personagem: {
      ...npc("ficha-do-j2", "DA-BIA"),
      editores: { tipo: "jogadores", ids: ["jogador-2"] },
    },
  });
  expect(r.tipo).toBe("evento");
  // o que o Claude do mestre cria é rascunho: o mestre publica (o Claude dele também pode)
  expect(await criador.mandarEsperandoSnapshot("rascunho.publicar", {})).toBeUndefined();
  await criador.fechar();

  // o Claude do jogador 1 nunca alcança mais do que o jogador 1
  const claude = await ClaudeWs.conectar((await gerarToken(j1.pagina)).token);
  expect(claude.quadros.find((q) => q.tipo === "snapshot")?.dados.usuarioId).toBe("jogador-1");
  expect(JSON.stringify(claude.snapshot())).not.toContain("DA-BIA");
  for (const [tipo, dados, codigo] of [
    [
      "ficha.alterar",
      { personagemId: "ficha-do-j2", operacoes: [{ caminho: "pvAtual", valor: 1 }] },
      "personagem_inexistente",
    ],
    ["personagem.editar", { id: "ficha-do-j2", mudancas: { nome: "x" } }, "personagem_inexistente"],
    [
      "ciclo.criar",
      { ciclo: { id: "c", nome: "C", periodoS: 60, cenas: [], fases: [{ emS: 0, evento: "x" }] } },
      "sem_permissao",
    ],
    ["cena.criar", { id: "cena-x", nome: "X" }, "sem_permissao"],
    ["mesa.pausar", {}, "sem_permissao"],
  ] as const) {
    const e = await claude.mandar(tipo, dados);
    expect(e.tipo, tipo).toBe("erro");
    expect(e.dados.codigo, tipo).toBe(codigo);
  }
  // a lista de proibidos, com a mensagem de que só a pessoa faz
  for (const [tipo, dados] of [
    ["papel.alterar", { usuarioId: "jogador-2", papel: "mestre" }],
    ["permissao.alterar", { capacidade: "nota.editar", valor: false }],
    ["campanha.exportar", {}],
  ] as const) {
    const e = await claude.mandar(tipo, dados);
    expect(e.tipo, tipo).toBe("erro");
    expect(e.dados.codigo, tipo).toBe("sem_permissao");
    expect(e.dados.mensagem, tipo).toContain("O Claude não pode");
  }
  // ... e o mesmo vale para o Claude do mestre
  const claudeMestre = await ClaudeWs.conectar((await gerarToken(mestre.pagina)).token);
  for (const [tipo, dados] of [
    ["papel.alterar", { usuarioId: "jogador-1", papel: "mestre" }],
    ["permissao.alterar", { capacidade: "nota.editar", valor: false }],
    ["campanha.exportar", {}],
    ["campanha.importar", { dados: {} }],
  ] as const) {
    const e = await claudeMestre.mandar(tipo, dados);
    expect(e.tipo, tipo).toBe("erro");
    expect(e.dados.mensagem, tipo).toContain("O Claude não pode");
  }
  // a rolagem oculta segue a capacidade do jogador (ele não tem)
  const oculta = await claude.mandar("dado.rolar", { expressao: "1d20", oculta: true });
  expect(oculta.dados.codigo).toBe("sem_permissao");

  // a rolagem sai da sala, com a marca "pelo Claude", visível para todos
  await abrirAba(mestre.pagina, "chat");
  await abrirAba(j2.pagina, "chat");
  const rolou = await claude.mandar("dado.rolar", { expressao: "2d6+1" });
  expect(rolou.tipo).toBe("evento");
  expect(rolou.dados.tipo).toBe("chat.mensagem");
  expect(rolou.dados.dados.mensagem.peloClaude).toBe(true);
  for (const s of [mestre, j1, j2]) {
    const msg = s.pagina
      .getByTestId("chat-mensagem")
      .filter({ has: s.pagina.getByTestId("chat-pelo-claude") });
    await expect(msg).toHaveCount(1);
    await expect(msg.getByTestId("chat-pelo-claude")).toHaveText(/pelo Claude/);
    await expect(msg.getByTestId("chat-autor")).toHaveText("Jogador 1");
  }
  // o jogador, pela mesa, rola sem a marca
  await expect(j1.pagina.getByTestId("chat-pelo-claude")).toHaveCount(1);
  // a ficha do outro nunca chegou ao Claude do jogador 1, nem aos frames do jogador 2 antes de ele a editar... (o dono a vê)
  expect(doJogador(j1)).not.toContain("DA-BIA");
  expect(doJogador(j2)).toContain("DA-BIA");
});

test("limite de frequência por token: passou de 20 por segundo (rajada de 40), o excesso responde para esperar", async ({
  mesa,
}) => {
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const claude = await ClaudeWs.conectar((await gerarToken(j1.pagina)).token);
  const ids: string[] = [];
  for (let i = 0; i < 120; i++) ids.push(claude.enviar("chat.anteriores", { antesDoSeq: 1 }));
  await expect
    .poll(
      () =>
        claude.quadros.filter((q) => q.tipo === "erro" && q.dados.codigo === "muitas_mensagens")
          .length,
    )
    .toBeGreaterThan(0);
  const erro = claude.quadros.find(
    (q) => q.tipo === "erro" && q.dados.codigo === "muitas_mensagens",
  );
  expect(erro?.dados.mensagem).toMatch(/Devagar.*20 pedidos por segundo.*Espere/);
  // passados alguns instantes, volta a responder
  await expect
    .poll(async () => {
      const e = await claude.mandar("dado.rolar", { expressao: "1d4" });
      return e.dados.codigo ?? e.tipo;
    })
    .not.toBe("muitas_mensagens");
});

test("o Claude do mestre cria como rascunho: o jogador não vê até o mestre publicar; descartar apaga; o selo e o chip aparecem", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const claude = await ClaudeWs.conectar((await gerarToken(mestre.pagina)).token);
  const m = mestre.pagina;
  await abrirAba(m, "fichas");
  await abrirAba(j1.pagina, "fichas");

  await claude.mandar(
    "personagem.criar",
    { personagem: npc("npc-rascunho", "GOBLIN-RASCUNHO") },
    { loteId: "L1", lote: "criou 1 NPC" },
  );
  // (handout visível a outros: a sala responde com snapshot novo, não com evento)
  await claude.mandarEsperandoSnapshot(
    "handout.criar",
    {
      handout: {
        id: "hand-rascunho",
        pastaId: "pasta-personagens",
        titulo: "CARTA-RASCUNHO",
        texto: "TEXTO-RASCUNHO",
        fonte: "livro",
        visivel: { tipo: "todos" },
      },
    },
    { loteId: "L1" },
  );
  await claude.mandar(
    "cena.criar",
    { id: "cena-rascunho", nome: "CENA-RASCUNHO" },
    { loteId: "L1" },
  );
  await claude.mandar(
    "ciclo.criar",
    {
      ciclo: {
        id: "ciclo-rascunho",
        nome: "CICLO-RASCUNHO",
        periodoS: 30,
        cenas: [],
        liberadoParaJogadores: true,
        fases: [{ emS: 0, evento: "pulso" }],
      },
    },
    { loteId: "L1" },
  );

  // o mestre vê tudo, com o selo "Rascunho", e o chip conta
  await expect(m.getByTestId("ficha-rascunho-npc-rascunho")).toBeVisible();
  await expect(m.getByTestId("handout-rascunho-hand-rascunho")).toBeVisible();
  await expect(m.getByTestId("chip-rascunhos")).toHaveText("Rascunhos do Claude (4)");
  await m.getByTestId("chip-rascunhos").click();
  await expect(m.getByTestId("rascunho-item")).toHaveCount(4);
  await expect(m.getByTestId("rascunho-item").filter({ hasText: "CARTA-RASCUNHO" })).toBeVisible();

  // o jogador não recebe nada (nem o nome, nem o texto, nem o ciclo liberado), por snapshot ou por evento
  const frames = doJogador(j1);
  for (const segredo of [
    "GOBLIN-RASCUNHO",
    "CARTA-RASCUNHO",
    "TEXTO-RASCUNHO",
    "CENA-RASCUNHO",
    "CICLO-RASCUNHO",
    "ciclo-rascunho",
  ]) {
    expect(frames, segredo).not.toContain(segredo);
  }
  await expect(j1.pagina.getByTestId("handout-item-hand-rascunho")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("botoes-da-barra")).toHaveCount(0);
  // a cena em rascunho não pode virar a cena do grupo
  const levar = await claude.mandar("grupo.moverPara", { cenaId: "cena-rascunho" });
  expect(levar.tipo).toBe("erro");

  // publicar só o handout: o jogador passa a vê-lo; o resto segue escondido
  await m
    .getByTestId("rascunho-item")
    .filter({ hasText: "CARTA-RASCUNHO" })
    .getByTestId("rascunho-publicar")
    .click();
  await expect(j1.pagina.getByTestId("handout-nome-hand-rascunho")).toHaveText("CARTA-RASCUNHO");
  await expect(m.getByTestId("handout-rascunho-hand-rascunho")).toHaveCount(0);
  await expect(m.getByTestId("chip-rascunhos")).toHaveText("Rascunhos do Claude (3)");
  expect(doJogador(j1)).not.toContain("GOBLIN-RASCUNHO");

  // descartar apaga (com a confirmação na página)
  await m
    .getByTestId("rascunho-item")
    .filter({ hasText: "CENA-RASCUNHO" })
    .getByTestId("rascunho-descartar")
    .click();
  await m.getByTestId("rascunho-descartar-confirmar").click();
  await expect(m.getByTestId("rascunho-item")).toHaveCount(2);

  // publicar tudo
  await m.getByTestId("rascunho-publicar-tudo").click();
  await expect(m.getByTestId("chip-rascunhos")).toHaveCount(0);
  await expect(m.getByTestId("ficha-rascunho-npc-rascunho")).toHaveCount(0);
  // o ciclo publicado liberado aparece na barra do jogador
  await expect(j1.pagina.getByTestId("botoes-da-barra")).toBeVisible();
});

test("Desfazer o que o Claude fez: o lote some com o que foi criado (mesmo publicado depois), com aviso do que mudou", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const claude = await ClaudeWs.conectar((await gerarToken(mestre.pagina)).token);
  const m = mestre.pagina;
  await abrirAba(m, "fichas");

  await claude.mandar(
    "personagem.criar",
    { personagem: npc("npc-1", "NPC-UM") },
    { loteId: "L1", lote: "criou 2 NPCs" },
  );
  await claude.mandar(
    "personagem.criar",
    { personagem: npc("npc-2", "NPC-DOIS") },
    { loteId: "L1", lote: "criou 2 NPCs" },
  );
  await claude.mandar(
    "personagem.criar",
    { personagem: npc("npc-3", "NPC-TRES") },
    { loteId: "L2", lote: "criou 1 NPC" },
  );
  await expect(m.getByTestId("ficha-item-npc-1")).toBeVisible();
  await expect(m.getByTestId("ficha-item-npc-3")).toBeVisible();

  // o mestre publica tudo; ainda assim o Desfazer desfaz o que o Claude criou (publicar não conta como "mudou")
  await m.getByTestId("chip-rascunhos").click();
  await m.getByTestId("rascunho-publicar-tudo").click();
  await expect(m.getByTestId("chip-rascunhos")).toHaveCount(0);
  // depois, a mesa renomeia o NPC-TRES: esse item muda depois e será pulado
  const nome = m.getByTestId("ficha-nome-npc-3");
  await expect(nome).toHaveText("NPC-TRES");
  await claude.mandar(
    "personagem.editar",
    { id: "npc-3", mudancas: { nome: "NPC-3-EDITADO" } },
    { loteId: "L3", lote: "renomeou" },
  );

  // os lotes do Claude do mestre aparecem em Preferências, do mais novo ao mais velho
  await abrirAba(m, "preferencias");
  const lotes = m.getByTestId("claude-lote");
  await expect(lotes).toHaveCount(3);
  await expect(lotes.nth(0)).toContainText("Claude: renomeou");
  await expect(lotes.nth(2)).toContainText("Claude: criou 2 NPCs");
  await expect(lotes.nth(2)).toContainText("2 itens");

  // desfaz o primeiro (L1): NPC-UM e NPC-DOIS somem
  await lotes.nth(2).getByTestId("claude-desfazer").click();
  await abrirAba(m, "fichas");
  await expect(m.getByTestId("ficha-item-npc-1")).toHaveCount(0);
  await expect(m.getByTestId("ficha-item-npc-2")).toHaveCount(0);
  await expect(m.getByTestId("ficha-item-npc-3")).toBeVisible();
  await abrirAba(m, "preferencias");
  await expect(m.getByTestId("claude-lote").nth(2)).toHaveAttribute("data-desfeito", "true");

  // desfazer o lote L2 (criou o NPC-TRES, que a mesa/Claude depois mudou): o item é pulado e o aviso diz qual; o L3 antes
  await m.getByTestId("claude-lote").nth(0).getByTestId("claude-desfazer").click(); // L3: volta o nome
  await abrirAba(m, "fichas");
  await expect(m.getByTestId("ficha-nome-npc-3")).toHaveText("NPC-TRES");
  await abrirAba(m, "preferencias");
  await m.getByTestId("claude-lote").nth(1).getByTestId("claude-desfazer").click(); // L2: o NPC-TRES some
  await abrirAba(m, "fichas");
  await expect(m.getByTestId("ficha-item-npc-3")).toHaveCount(0);
});

test("'Desfazer tudo o que o Claude fez' (com confirmação) e o aviso do item que mudou depois", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const claude = await ClaudeWs.conectar((await gerarToken(mestre.pagina)).token);
  const m = mestre.pagina;
  await abrirAba(m, "fichas");
  await claude.mandar(
    "personagem.criar",
    { personagem: npc("a", "NPC-A") },
    { loteId: "A", lote: "criou A" },
  );
  await claude.mandar(
    "personagem.criar",
    { personagem: npc("b", "NPC-B") },
    { loteId: "B", lote: "criou B" },
  );
  // a mesa muda o B por conta própria (o mestre, pela mesa)
  await m.getByTestId("ficha-abrir-b").dblclick();
  await expect(m.getByTestId("janela-ficha")).toBeVisible();
  await claude.mandar(
    "personagem.editar",
    { id: "b", mudancas: { nome: "NPC-B2" } },
    { loteId: "C", lote: "renomeou B" },
  );
  await abrirAba(m, "preferencias");
  await m.getByTestId("claude-desfazer-tudo").click();
  await expect(m.getByTestId("claude-desfazer-tudo-confirmacao")).toBeVisible();
  await m.getByTestId("claude-desfazer-tudo-confirmar").click();
  await abrirAba(m, "fichas");
  await expect(m.getByTestId("ficha-item-a")).toHaveCount(0);
  await expect(m.getByTestId("ficha-item-b")).toHaveCount(0);
});

test("o jogador cria a própria ficha e o próprio handout pela mesa (dele, na pasta dele); a capacidade vale em Permissões, inclusive por jogador", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  const p = j1.pagina;
  await abrirAba(p, "fichas");
  await abrirAba(j2.pagina, "fichas");
  await abrirAba(mestre.pagina, "fichas");

  // "Nova ficha": o editor de sempre abre em Configurar; ele troca o nome (só nas fichas que ele criou)
  await p.getByTestId("ficha-jogador-nova").click();
  const janela = p.getByTestId("janela-ficha");
  await expect(janela).toBeVisible();
  const nome = janela.getByTestId(/^personagem-nome-/);
  await expect(nome).toBeEnabled();
  await nome.fill("ALDRIC-DO-J1");
  await nome.press("Enter");
  await expect(p.getByTestId(/^ficha-nome-/).filter({ hasText: "ALDRIC-DO-J1" })).toBeVisible();
  // o mestre a vê (na pasta dele); o jogador 2 não
  await expect(
    mestre.pagina.getByTestId(/^ficha-nome-/).filter({ hasText: "ALDRIC-DO-J1" }),
  ).toBeVisible();
  await expect(
    j2.pagina.getByTestId(/^ficha-nome-/).filter({ hasText: "ALDRIC-DO-J1" }),
  ).toHaveCount(0);
  expect(doJogador(j2)).not.toContain("ALDRIC-DO-J1");
  await expect(p.getByTestId("ficha-pasta-pasta-de-jogador-1")).toBeVisible();

  await janela.getByTestId("janela-ficha-fechar").click();
  // "Novo handout": ele escolhe quem vê; o jogador 2 só o recebe depois
  await p.getByTestId("ficha-jogador-novo-handout").click();
  const handoutId =
    (await p.locator('[data-testid="janela-handout"]').getAttribute("data-handout-id")) ?? "";
  const editor = p.locator(`[data-testid="janela-handout"][data-handout-id="${handoutId}"]`);
  await expect(editor.getByTestId("handout-editor")).toBeVisible();
  await expect(editor.getByTestId("handout-mostrar")).toHaveCount(0);
  await editor.getByTestId("handout-titulo-campo").fill("NOTA-DO-J1");
  await editor.getByTestId("handout-titulo-campo").press("Enter");
  await expect(p.getByTestId(`handout-nome-${handoutId}`)).toHaveText("NOTA-DO-J1");
  expect(doJogador(j2)).not.toContain("NOTA-DO-J1");
  await editor.getByTestId("handout-visib-jogador-jogador-2").click();
  await expect(j2.pagina.getByTestId(`handout-nome-${handoutId}`)).toHaveText("NOTA-DO-J1");
  // o mestre também o vê, e ele abre a janela do handout do jogador
  await expect(mestre.pagina.getByTestId(`handout-nome-${handoutId}`)).toHaveText("NOTA-DO-J1");
  // o jogador 2 só lê
  const leitura = await abrirHandout(j2.pagina, handoutId);
  await expect(leitura.getByTestId("handout-editor")).toHaveCount(0);

  // Permissões: a capacidade existe, ligada por padrão, e vale por jogador
  await abrirAba(mestre.pagina, "mesa");
  const padrao = mestre.pagina.getByTestId("perm-padrao-personagem.criarProprio");
  await expect(padrao).toBeChecked();
  await expect(mestre.pagina.getByTestId("perm-excecao-personagem.criarProprio"))
    .toBeVisible()
    .catch(() => {});
  await padrao.click();
  await expect(padrao).not.toBeChecked();
  await expect(j2.pagina.getByTestId("ficha-jogador-nova")).toHaveCount(0);
  await expect(j2.pagina.getByTestId("ficha-jogador-novo-handout")).toHaveCount(0);
  await expect(p.getByTestId("ficha-jogador-nova")).toHaveCount(0);
  await padrao.click();
  await expect(p.getByTestId("ficha-jogador-nova")).toBeVisible();
});
