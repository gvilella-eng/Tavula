import { abrirAba, abrirPreferencia, expect, ID_DA_MESA, type Sessao, test } from "./ajudas";
import { gerarToken } from "./ajudasClaude";
import { criarPastaDoGrupo, mandar, PASTA_GRUPO } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";
import { ClienteMcpHttp, pedirAoMcp, URL_PELO_VITE, urlDoMcp } from "./ajudasMcp";

// 12-3: o MCP mora na própria sala, por HTTP. O cliente do SDK (`StreamableHTTPClientTransport`, o mesmo do Claude Code) fala
// com a sala de teste PELO ENDEREÇO DO VITE (5174), como o comando que a tela mostra. Cobre o jogador, o mestre (rascunho,
// publicar, desfazer), o token revogado, a tela de "Conectar o Claude" e a lista de verificações de segurança: a rota HTTP
// passa pelo MESMO tratamento da conexão do Claude (marca "pelo Claude", rascunho, diário, limite, difusão).

test.describe.configure({ timeout: 180_000 });

const abertos: ClienteMcpHttp[] = [];
test.afterEach(async () => {
  await Promise.all(abertos.splice(0).map((c) => c.fechar()));
});

async function mcpDe(s: Sessao): Promise<{ mcp: ClienteMcpHttp; token: string; id: string }> {
  const { token, id } = await gerarToken(s.pagina);
  const mcp = await ClienteMcpHttp.conectar(token, { url: URL_PELO_VITE });
  abertos.push(mcp);
  return { mcp, token, id };
}

const doJogador = (s: Sessao) => s.frames.join("\n");

test("o jogador monta o personagem pelo Claude (HTTP): magias do compêndio, 4d6 pelo Claude no chat, sem alcançar o que não é dele", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");

  // O mestre deixa uma ficha da Bia numa pasta que todos veem (a Ana não a edita).
  await criarPastaDoGrupo(mestre.pagina);
  await mandar(mestre.pagina, "personagem.criar", {
    personagem: {
      id: "ficha-da-bia",
      pastaId: PASTA_GRUPO,
      editores: { tipo: "jogadores", ids: ["jogador-2"] },
      nome: "Heroína da Bia",
      tokenPadrao: { cor: "#2980b9", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      ficha: { pvAtual: 9, pvMax: 9 },
    },
  });
  // O Claude do mestre deixa um NPC em rascunho: o jogador não pode ver.
  const { mcp: doMestre } = await mcpDe(mestre);
  const segredo = await doMestre.chamar("fichas", {
    fichas: [{ nome: "Goblin Secreto", pv: { max: 7 } }],
  });
  expect(segredo.erro, segredo.texto).toBe(false);

  // Sem conexão aberta, a primeira chamada faz o Claude aparecer na bolinha do jogador (para todos).
  const { mcp, token } = await mcpDe(j1);
  await expect(mestre.pagina.getByTestId("presenca-claude-jogador-1")).toBeVisible();
  expect(await mcp.ferramentas()).toEqual([
    "panorama",
    "ler",
    "fichas",
    "compendio",
    "notas",
    "tokens",
    "combate",
    "chat",
    "rolar",
    "arquivos",
    "desfazer",
  ]);

  const panorama = await mcp.chamar("panorama");
  expect(panorama.erro).toBe(false);
  expect(panorama.texto).toContain("Você é Jogador 1 (jogador)");
  expect(panorama.texto).not.toContain("Goblin Secreto");
  expect(panorama.texto).not.toContain("Automações");
  expect(panorama.texto).not.toContain("Rascunhos");

  // O compêndio (o exemplo do SRD, dentro da sala) responde curto.
  const achou = await mcp.chamar("compendio", { tipo: "magia", classe: "Mago", nivel: 3 });
  expect(achou.texto).toContain("Bola de Fogo");

  // Monta o personagem: classe e nível, atributos, perícias e nomes do compêndio.
  const criou = await mcp.chamar("fichas", {
    fichas: [
      {
        nome: "Rúnia",
        raca: "Anã",
        classes: [{ classe: "Clérigo", nivel: 3 }],
        atributos: { for: 10, des: 12, con: 14, int: 10, sab: 16, car: 12 },
        pericias: ["Religião", "Medicina"],
        compendio: ["Detectar Magia", "Bola de Fogo", "Espada longa", "Poção de cura"],
        itens: [{ nome: "Símbolo sagrado" }],
      },
    ],
  });
  expect(criou.erro, criou.texto).toBe(false);
  expect(criou.texto).toContain('Criou "Rúnia" (personagem)');
  expect(criou.texto).toContain("PV 24/24");
  const lida = await mcp.chamar("ler", { tipo: "ficha", nome: "Rúnia" });
  expect(lida.texto).toContain("Bola de Fogo");
  expect(lida.texto).toContain("Salvaguardas proficientes: Sabedoria +5");
  expect(lida.texto).toContain("Espada longa");

  // A ficha aparece na mesa dele (e só nela: a Bia não a vê; o mestre vê).
  await abrirAba(j1.pagina, "fichas");
  await expect(
    j1.pagina.locator('[data-testid^="ficha-nome-"]').filter({ hasText: "Rúnia" }),
  ).toBeVisible();
  await expect(
    j2.pagina.locator('[data-testid^="ficha-nome-"]').filter({ hasText: "Rúnia" }),
  ).toHaveCount(0);
  expect(doJogador(j2)).not.toContain("Rúnia");
  await abrirAba(mestre.pagina, "fichas");
  await expect(
    mestre.pagina.locator('[data-testid^="ficha-nome-"]').filter({ hasText: "Rúnia" }),
  ).toBeVisible();

  // Rola 4d6 (o melhor 3) seis vezes: a sala rola e o chat marca "pelo Claude".
  await abrirAba(j1.pagina, "chat");
  await abrirAba(mestre.pagina, "chat");
  const rolou = await mcp.chamar("rolar", { expressao: "4d6kh3", vezes: 6 });
  expect(rolou.erro, rolou.texto).toBe(false);
  const linhas = rolou.texto.split("\n");
  expect(linhas).toHaveLength(6);
  for (const l of linhas) expect(l).toMatch(/4d6kh3.*= \d+/);
  for (const s of [j1, mestre]) {
    const mensagens = s.pagina
      .getByTestId("chat-mensagem")
      .filter({ has: s.pagina.getByTestId("chat-pelo-claude") });
    await expect(mensagens).toHaveCount(6);
    await expect(mensagens.first().getByTestId("chat-autor")).toHaveText("Jogador 1");
  }

  // Editar a ficha de outro jogador é recusado, e a mesa não muda.
  const alheia = await mcp.chamar("fichas", {
    fichas: [{ nome: "Heroína da Bia", pv: { max: 99 } }],
  });
  expect(alheia.erro).toBe(true);
  expect(alheia.texto).toContain('Você não edita a ficha "Heroína da Bia"');

  // As ferramentas do mestre não existem para ele; chamar assim mesmo é recusado.
  for (const f of ["automacoes", "rascunhos", "cenas", "objetos"]) {
    const r = await mcp.chamar(f, {});
    expect(r.erro, f).toBe(true);
    expect(r.texto, f).toContain("não está liberada");
  }

  // Edita a própria ficha por partes e desfaz o último lote dele (o diário é da sala: está na hora).
  const editou = await mcp.chamar("fichas", {
    fichas: [
      { nome: "brisa", historia: "Cresceu cuidando do santuário da família.", pv: { max: 30 } },
    ],
  });
  expect(editou.erro, editou.texto).toBe(false);
  expect(editou.texto).toContain("PV 30/30");
  const lotes = await mcp.chamar("desfazer");
  expect(lotes.texto).toContain("fichas: Rúnia");

  // O token nunca vazou: nem nas respostas, nem na página do jogador.
  for (const texto of [panorama.texto, criou.texto, rolou.texto, alheia.texto, lotes.texto]) {
    expect(texto).not.toContain(token);
  }
  expect(await j1.pagina.content()).not.toContain(token);
});

test("o mestre monta uma cena pelo Claude (HTTP): rascunho invisível ao jogador até publicar; Desfazer apaga tudo", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const { mcp, token } = await mcpDe(mestre);
  const m = mestre.pagina;

  expect(await mcp.ferramentas()).toEqual([
    "panorama",
    "ler",
    "fichas",
    "compendio",
    "notas",
    "objetos",
    "cenas",
    "mapa",
    "tokens",
    "automacoes",
    "combate",
    "mesa",
    "som",
    "musica",
    "chat",
    "rolar",
    "rascunhos",
    "arquivos",
    "desfazer",
  ]);

  const npc = await mcp.chamar("fichas", {
    fichas: [
      {
        nome: "Goblin",
        pv: { max: 7 },
        ca: 15,
        atributos: { for: 8, des: 14, con: 10, int: 10, sab: 8, car: 8 },
        ataques: [
          {
            nome: "Cimitarra",
            acerto: { tipo: "formula", atributo: "des", proficiente: true },
            dano: "1d6",
            atributoDano: "des",
            tipo: "Cortante",
            categoria: "acao",
          },
        ],
        npc: { tamanho: "Pequeno", tipo: "Humanoide", nd: "1/4" },
      },
    ],
  });
  expect(npc.erro, npc.texto).toBe(false);
  expect(npc.texto).toContain('Criou "Goblin" (NPC)');
  expect(npc.texto).toContain("(rascunho");

  const cena = await mcp.chamar("cenas", {
    cenas: [
      {
        nome: "Eclusa",
        paredes: [
          { de: [2, 2], ate: [12, 2] },
          { de: [12, 2], ate: [12, 8], tipo: "porta", estado: "trancada" },
          { de: [2, 8], ate: [12, 8], por: [7, 10] },
        ],
        tokens: [{ ficha: "Goblin", quantidade: 4, em: [5.5, 4.5], oculto: true }],
      },
    ],
  });
  expect(cena.erro, cena.texto).toBe(false);
  expect(cena.texto).toContain('Cena "Eclusa"');
  expect(cena.texto).toContain("3 paredes");
  expect(cena.texto).toContain("4 tokens");

  const auto = await mcp.chamar("automacoes", {
    fluxos: [
      {
        nome: "Vento da eclusa",
        cenas: ["Eclusa"],
        gatilho: { tipo: "relogio", cadaS: 600 },
        trilhas: [
          [
            {
              bloco: "paraCada",
              alvo: { tipo: "tokens" },
              corpo: [{ bloco: "acao", acao: { acao: "visao.limitar", alcanceM: 3, porS: 60 } }],
            },
          ],
        ],
      },
    ],
  });
  expect(auto.erro, auto.texto).toBe(false);

  const nota = await mcp.chamar("notas", {
    notas: [
      {
        titulo: "A Eclusa antiga",
        texto: "Uma comporta de pedra, cheia de limo.",
        visivel: "todos",
      },
    ],
  });
  expect(nota.erro, nota.texto).toBe(false);

  const detalhe = await mcp.chamar("ler", { tipo: "cena", nome: "Eclusa" });
  expect(detalhe.texto).toContain("Paredes (3)");
  expect(detalhe.texto).toContain("arco por (7, 10)");
  expect(detalhe.texto).toContain("Goblin 4");

  // O mestre vê o chip dos rascunhos; o jogador não recebeu nada (nem nos frames).
  await expect(m.getByTestId("chip-rascunhos")).toBeVisible();
  const frames = doJogador(j1);
  for (const segredo of ["Eclusa", "Goblin", "Cimitarra", "Vento da eclusa", "A Eclusa antiga"]) {
    expect(frames, segredo).not.toContain(segredo);
  }
  await abrirAba(j1.pagina, "fichas");
  await expect(j1.pagina.getByText("A Eclusa antiga")).toHaveCount(0);
  const rascunhos = await mcp.chamar("rascunhos", { acao: "listar" });
  expect(rascunhos.texto).toContain("cena: Eclusa");
  expect(rascunhos.texto).toContain("automação: Vento da eclusa");
  expect(rascunhos.texto).toContain("handout: A Eclusa antiga");

  // Publicar: o jogador passa a ver a nota (o que é visível a ele).
  const publicou = await mcp.chamar("rascunhos", { acao: "publicar" });
  expect(publicou.erro, publicou.texto).toBe(false);
  expect(publicou.texto).toContain("Restam 0");
  await expect(m.getByTestId("chip-rascunhos")).toHaveCount(0);
  await expect(j1.pagina.getByText("A Eclusa antiga")).toBeVisible();

  // Desfazer cada lote do Claude (do mais novo ao mais velho) apaga tudo, mesmo o que já foi publicado.
  const idsDoDiario = async () =>
    [...(await mcp.chamar("desfazer")).texto.matchAll(/\[id (mcp-[0-9a-f]+)\]/g)].map(
      (x) => x[1] as string,
    );
  const ids = await idsDoDiario();
  expect(ids.length).toBeGreaterThanOrEqual(5);
  for (const id of ids) {
    const r = await mcp.chamar("desfazer", { acao: "desfazer", lote: id });
    expect(r.erro, r.texto).toBe(false);
    expect(r.texto).toContain("Desfeito");
  }
  await expect(j1.pagina.getByText("A Eclusa antiga")).toHaveCount(0);
  const depois = await mcp.chamar("panorama");
  expect(depois.texto).not.toContain("Eclusa");
  expect(depois.texto).not.toContain("Goblin");
  expect(depois.texto).toContain("Automações: 0");
  expect(depois.texto).toContain("Rascunhos do Claude: nenhum");

  expect(npc.texto + cena.texto + auto.texto + detalhe.texto + depois.texto).not.toContain(token);
});

test("a tela mostra o comando de uma linha com o token, --transport http e --scope user; ele funciona; conectado agora, usado há X min", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  // A presença sem conexão aberta dura 2 min; no teste dura 6 s, para ver "conectado agora" virar "usado há".
  expect((await request.post("/teste/claude-http?ms=6000")).ok()).toBe(true);

  await abrirPreferencia(p, "claude");
  await p.getByTestId("claude-token-nome").fill("Claude no meu PC");
  await p.getByTestId("claude-gerar").click();
  await expect(p.getByTestId("claude-token-novo")).toBeVisible();
  const token = (await p.getByTestId("claude-token-valor").textContent()) ?? "";
  expect(token).toMatch(/^tvc_[A-Za-z0-9_-]{43}$/);

  // O comando: uma linha só, com a origem da página, o id da mesa e o token.
  const comando = (await p.getByTestId("claude-trecho-code").textContent()) ?? "";
  expect(comando).toBe(
    `claude mcp add --transport http --scope user tavola-${ID_DA_MESA} ${URL_PELO_VITE}/api/m/${ID_DA_MESA}/mcp --header "Authorization: Bearer ${token}"`,
  );
  expect(comando).toContain("--transport http");
  expect(comando).toContain("--scope user");
  expect(comando).not.toMatch(/[\n$`;]/);
  // O passo a passo de três linhas e a linha para tirar a conexão antiga (recolhida).
  await expect(p.getByTestId("claude-passos").locator("li")).toHaveCount(3);
  await expect(p.getByTestId("claude-remover")).not.toHaveAttribute("open", "");
  await p.getByTestId("claude-remover").locator("summary").click();
  await expect(p.getByTestId("claude-trecho-remover")).toHaveText(
    `claude mcp remove --scope user tavola-${ID_DA_MESA}`,
  );
  // O Claude Desktop continua com o servidor local (recolhido), dito com honestidade.
  await expect(p.getByTestId("claude-desktop")).not.toHaveAttribute("open", "");
  await p.getByTestId("claude-desktop").locator("summary").click();
  await expect(p.getByTestId("claude-trecho-desktop")).toContainText("TAVOLA_TOKEN");
  await expect(p.getByTestId("claude-desktop")).toContainText("só liga a servidores locais");

  // Faz o que o comando faz: o endereço e o cabeçalho saem do próprio texto.
  const url = /(http\S+\/mcp)/.exec(comando)?.[1] ?? "";
  const cabecalho = /--header "Authorization: Bearer (\S+)"/.exec(comando)?.[1] ?? "";
  expect(url).toBe(urlDoMcp(URL_PELO_VITE));
  const mcp = await ClienteMcpHttp.conectar(cabecalho, { url: URL_PELO_VITE });
  abertos.push(mcp);

  // Ainda não usou: "nunca usado". Depois da primeira chamada: "conectado agora" (lista e resumo).
  await expect(p.getByTestId("claude-token")).toContainText("conectado agora");
  await expect(p.getByTestId("pref-resumo-claude")).toHaveText("1 token · conectado agora");
  const r = await mcp.chamar("panorama");
  expect(r.erro, r.texto).toBe(false);
  expect(r.texto).toContain("Você é Mestre (mestre)");

  // Passada a presença (alarme da sala), vira "usado há X min" nos dois lugares, sem recarregar.
  await expect(p.getByTestId("claude-token")).toContainText("usado agora", { timeout: 20_000 });
  await expect(p.getByTestId("claude-token")).not.toContainText("conectado agora");
  await expect(p.getByTestId("pref-resumo-claude")).toHaveText("1 token · usado agora");
  await expect(p.getByTestId("presenca-claude-mestre")).toHaveCount(0);
});

test("token revogado: o HTTP responde 401 (sem dizer o motivo) na hora; token de outra mesa e token inválido também", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { mcp, token, id } = await mcpDe(mestre);
  expect((await mcp.chamar("panorama")).erro).toBe(false);

  // Revoga pela mesa: a próxima chamada é 401, com WWW-Authenticate e sem motivo no corpo.
  const rev = await mestre.pagina.request.post(`/api/m/${ID_DA_MESA}/conta/claude/revogar`, {
    data: { id },
  });
  expect(rev.ok()).toBe(true);
  const revogado = await pedirAoMcp({ token });
  expect(revogado.status).toBe(401);
  expect(revogado.cabecalhos["www-authenticate"]).toBe("Bearer");
  expect(revogado.corpo).toBe("Não autenticado");
  await expect(mcp.chamar("panorama")).rejects.toThrow(/Não autenticado/);
  await expect(ClienteMcpHttp.conectar(token, { url: URL_PELO_VITE })).rejects.toThrow();

  // Token de outra mesa: o mesmo 401.
  const nova = await request.post("/api/mesas", { data: { nome: "Outra mesa" } });
  expect(nova.status()).toBe(201);
  const outraId = ((await nova.json()) as { id: string }).id;
  const { token: valido } = await gerarToken(mestre.pagina);
  const deOutraMesa = await pedirAoMcp({ token: valido, mesaId: outraId });
  expect(deOutraMesa.status).toBe(401);
  expect(deOutraMesa.corpo).toBe("Não autenticado");
  // (o mesmo token continua valendo na mesa dele)
  expect((await pedirAoMcp({ token: valido })).status).toBe(200);

  // Fora do formato, esquema errado e sem cabeçalho: 401 igual.
  expect((await pedirAoMcp({ autorizacao: "Bearer lixo" })).status).toBe(401);
  expect((await pedirAoMcp({ autorizacao: `Basic ${valido}` })).status).toBe(401);
  const sem = await pedirAoMcp({});
  expect(sem.status).toBe(401);
  expect(sem.cabecalhos["www-authenticate"]).toBe("Bearer");
});

test("segurança do HTTP: Origin, cookie, métodos, tipo e tamanho; a lista de ferramentas não alcança o que o Claude não pode", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { mcp, token } = await mcpDe(mestre);

  // Um navegador manda Origin (o Claude Code não): recusado, de outro site ou do próprio.
  const deFora = await pedirAoMcp({ token, cabecalhos: { Origin: "https://site-mau.example" } });
  expect(deFora.status).toBe(403);
  expect(deFora.corpo).not.toContain("tools");
  const doProprio = await pedirAoMcp({ token, cabecalhos: { Origin: URL_PELO_VITE } });
  expect(doProprio.status).toBe(403);
  // O mesmo vale pelo endereço do Vite (a porta da página): o proxy repassa o POST e o cabeçalho.
  const pelaPagina = await pedirAoMcp({ token, url: URL_PELO_VITE });
  expect(pelaPagina.status).toBe(200);

  // Sem CORS: o preflight (OPTIONS) não é respondido e a resposta nunca libera outra origem.
  const preflight = await pedirAoMcp({
    metodo: "OPTIONS",
    cabecalhos: {
      Origin: "https://site-mau.example",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization",
    },
    corpo: "",
  });
  expect(preflight.status).toBeGreaterThanOrEqual(400);
  expect(preflight.cabecalhos["access-control-allow-origin"]).toBeUndefined();
  expect(pelaPagina.cabecalhos["access-control-allow-origin"]).toBeUndefined();

  // Só POST: GET e DELETE respondem 405.
  for (const metodo of ["GET", "DELETE"]) {
    const r = await pedirAoMcp({ metodo, token, corpo: "" });
    expect(r.status, metodo).toBe(405);
    expect(r.cabecalhos.allow, metodo).toBe("POST");
  }

  // O cookie de sessão nunca vale aqui, nem nasce cookie: a rota só conhece o token.
  const sessaoCookie = (await mestre.contexto.cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  expect(sessaoCookie).not.toBe("");
  const comCookie = await pedirAoMcp({ cabecalhos: { Cookie: sessaoCookie } });
  expect(comCookie.status).toBe(401);
  const ok = await pedirAoMcp({ token });
  expect(ok.status).toBe(200);
  expect(ok.cabecalhos["set-cookie"]).toBeUndefined();

  // Tipo, JSON e tamanho.
  expect((await pedirAoMcp({ token, tipo: "text/plain" })).status).toBe(415);
  const quebrado = await pedirAoMcp({ token, corpo: "{nao e json" });
  expect(quebrado.status).toBe(400);
  expect(JSON.parse(quebrado.corpo).error.code).toBe(-32700);
  const grande = await pedirAoMcp({ token, corpo: JSON.stringify({ x: "a".repeat(600_000) }) });
  expect(grande.status).toBe(413);

  // Notificação: 202 sem corpo. Método que não existe: erro do JSON-RPC (200 com `error`).
  const notificacao = await pedirAoMcp({
    token,
    corpo: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  expect(notificacao.status).toBe(202);
  expect(notificacao.corpo).toBe("");
  const desconhecido = await pedirAoMcp({
    token,
    corpo: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "admin/tudo" }),
  });
  expect(JSON.parse(desconhecido.corpo).error.code).toBe(-32601);

  // O que o Claude nunca faz não é ferramenta: nem na lista, nem chamando pelo nome da intenção.
  const lista = await mcp.ferramentas();
  expect(lista).toHaveLength(19);
  for (const proibida of [
    "papel.alterar",
    "permissao.alterar",
    "campanha.exportar",
    "campanha.importar",
    "asset.pedir",
    "conta.criar",
  ]) {
    expect(lista).not.toContain(proibida);
    const r = await mcp.chamar(proibida, {});
    expect(r.erro, proibida).toBe(true);
    expect(r.texto, proibida).toContain("não existe");
  }
  // As ferramentas só aceitam o que o esquema delas diz: intenção crua por fora não passa.
  const crua = await mcp.chamar("rolar", {
    tipo: "papel.alterar",
    dados: { usuarioId: "jogador-1" },
  });
  expect(crua.erro).toBe(true);
  expect(crua.texto).toMatch(/Entrada inválida/);
});

test("o excesso de frequência é recusado com o aviso de esperar (o limite do token vale no HTTP)", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { mcp } = await mcpDe(mestre);
  // 30 chamadas ao mesmo tempo, cada uma com 12 rolagens: bem mais do que 20 por segundo (rajada de 40) e do que
  // 10 mensagens de chat por segundo. A sala recusa o que passa disso (a ferramenta espera um pouco e tenta de novo, até
  // desistir e contar a recusa).
  const respostas = await Promise.all(
    Array.from({ length: 30 }, () => mcp.chamar("rolar", { expressao: "1d20", vezes: 12 })),
  );
  const recusadas = respostas.filter((r) => r.texto.includes("Devagar"));
  expect(recusadas.length).toBeGreaterThan(0);
  expect(respostas.some((r) => !r.erro)).toBe(true);
  // A sala segue de pé e responde de novo depois de um tempo.
  await expect
    .poll(async () => (await mcp.chamar("panorama")).erro, { timeout: 20_000 })
    .toBe(false);
});

test("token errado demais bloqueia o IP com 429 (inclusive para o token certo), e só o IP dele", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { token } = await gerarToken(mestre.pagina);
  // Um IP inventado só para este teste (o Worker usa o `CF-Connecting-IP`; na internet o Cloudflare o define).
  const ip = "203.0.113.77";
  const errado = `tvc_${"B".repeat(43)}`;
  let ultimo = 0;
  for (let i = 0; i < 32 && ultimo !== 429; i++) {
    ultimo = (await pedirAoMcp({ token: errado, cabecalhos: { "CF-Connecting-IP": ip } })).status;
    if (ultimo !== 429) expect(ultimo).toBe(401);
  }
  expect(ultimo).toBe(429);
  const bloqueado = await pedirAoMcp({ token, cabecalhos: { "CF-Connecting-IP": ip } });
  expect(bloqueado.status).toBe(429);
  expect(bloqueado.cabecalhos["retry-after"]).toBeDefined();
  // Outro IP não sente nada.
  const outro = await pedirAoMcp({ token, cabecalhos: { "CF-Connecting-IP": "203.0.113.78" } });
  expect(outro.status).toBe(200);
});
