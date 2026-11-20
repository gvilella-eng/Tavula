import { abrirAba, abrirPreferencia, expect, ID_DA_MESA, type Sessao, test } from "./ajudas";
import { gerarToken } from "./ajudasClaude";
import { criarPastaDoGrupo, mandar, PASTA_GRUPO } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";
import { ARQUIVO_DO_MCP, ClienteMcp, construirOMcp, URL_DA_SALA, URL_PELO_VITE } from "./ajudasMcp";

// 12-2: o servidor MCP de verdade (`apps/mcp`, em stdio), contra a sala de teste (8788), com o cliente do SDK. O jogador
// monta o personagem e rola dados; o mestre monta uma cena e o jogador não vê nada até a publicação; Desfazer apaga tudo;
// token revogado responde o erro claro.

test.describe.configure({ timeout: 180_000 });

const abertos: ClienteMcp[] = [];
test.beforeAll(() => construirOMcp());
test.afterEach(async () => {
  // Nenhum processo do MCP fica rodando depois do teste.
  await Promise.all(abertos.splice(0).map((c) => c.fechar()));
});

async function mcpDe(
  s: Sessao,
  opcoes: { url?: string } = {},
): Promise<{ mcp: ClienteMcp; token: string; id: string }> {
  const { token, id } = await gerarToken(s.pagina);
  const mcp = await ClienteMcp.conectar(token, opcoes);
  abertos.push(mcp);
  return { mcp, token, id };
}

const doJogador = (s: Sessao) => s.frames.join("\n");

test("o jogador monta o personagem pelo Claude: magias do compêndio, 4d6 pelo Claude no chat, sem alcançar o que não é dele", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");

  // O mestre deixa uma ficha da Bia numa pasta que todos veem (a Ana não a edita) e pede um NPC ao Claude dele (rascunho).
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
  const { mcp: doMestre } = await mcpDe(mestre);
  const segredo = await doMestre.chamar("fichas", {
    fichas: [{ nome: "Goblin Secreto", pv: { max: 7 } }],
  });
  expect(segredo.erro, segredo.texto).toBe(false);

  // O MCP do jogador entra pelo proxy do Vite (a porta da página, como no `pnpm dev`) e só mostra as ferramentas dele.
  const { mcp, token } = await mcpDe(j1, { url: URL_PELO_VITE });
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

  // O panorama é do que ele vê: nada de automações, de rascunhos nem do NPC secreto do mestre.
  const panorama = await mcp.chamar("panorama");
  expect(panorama.erro).toBe(false);
  expect(panorama.texto).toContain("Você é Jogador 1 (jogador)");
  expect(panorama.texto).not.toContain("Goblin Secreto");
  expect(panorama.texto).not.toContain("Automações");
  expect(panorama.texto).not.toContain("Rascunhos");

  // O compêndio responde curto.
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
  const fichaDele = j1.pagina.locator('[data-testid^="ficha-nome-"]').filter({ hasText: "Rúnia" });
  await expect(fichaDele).toBeVisible();
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

  // Não tem a ferramenta de automações nem a dos rascunhos; chamar assim mesmo é recusado.
  for (const f of ["automacoes", "rascunhos", "cenas", "objetos"]) {
    const r = await mcp.chamar(f, {});
    expect(r.erro, f).toBe(true);
    expect(r.texto, f).toContain("não está liberada");
  }

  // Edita a própria ficha por partes (continua uma ficha só) e depois desfaz o último lote dele.
  const editou = await mcp.chamar("fichas", {
    fichas: [
      { nome: "brisa", historia: "Cresceu cuidando do santuário da família.", pv: { max: 30 } },
    ],
  });
  expect(editou.erro, editou.texto).toBe(false);
  expect(editou.texto).toContain("PV 30/30");
  // (o diário chega da sala logo depois da mudança)
  await expect.poll(async () => (await mcp.chamar("desfazer")).texto).toContain("fichas: Rúnia");
  const antes = await mcp.chamar("desfazer");
  expect(
    await j1.pagina.locator('[data-testid^="ficha-nome-"]').filter({ hasText: "Rúnia" }).count(),
  ).toBe(1);

  // O token nunca vazou: nem na saída do servidor MCP, nem nas respostas.
  for (const texto of [panorama.texto, criou.texto, rolou.texto, alheia.texto, antes.texto]) {
    expect(texto).not.toContain(token);
  }
});

test("o mestre monta uma cena pelo Claude (paredes, NPC, automação): rascunho invisível ao jogador até publicar; Desfazer apaga tudo", async ({
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

  // 1. O NPC, a cena com paredes (reta, porta e arco "de a até b passando por c"), 4 goblins ocultos, uma automação e uma nota.
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

  // O detalhe da cena: coordenadas em células, o arco com o ponto por onde passa e os 4 tokens.
  const detalhe = await mcp.chamar("ler", { tipo: "cena", nome: "Eclusa" });
  expect(detalhe.texto).toContain("Paredes (3)");
  expect(detalhe.texto).toContain("arco por (7, 10)");
  expect(detalhe.texto).toContain("Goblin 4");

  // 2. O mestre vê o chip dos rascunhos; o jogador não recebeu nada (nem nos frames).
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

  // 3. Publicar: o jogador passa a ver a nota (o que é visível a ele).
  const publicou = await mcp.chamar("rascunhos", { acao: "publicar" });
  expect(publicou.erro, publicou.texto).toBe(false);
  expect(publicou.texto).toContain("Restam 0");
  await expect(m.getByTestId("chip-rascunhos")).toHaveCount(0);
  await expect(j1.pagina.getByText("A Eclusa antiga")).toBeVisible();

  // 4. Desfazer cada lote do Claude (do mais novo ao mais velho) apaga tudo, mesmo o que já foi publicado.
  // (o diário chega da sala logo depois de cada mudança: espera ter os cinco lotes)
  const idsDoDiario = async () =>
    [...(await mcp.chamar("desfazer")).texto.matchAll(/\[id (mcp-[0-9a-f]+)\]/g)].map(
      (x) => x[1] as string,
    );
  await expect.poll(async () => (await idsDoDiario()).length).toBeGreaterThanOrEqual(5);
  const ids = await idsDoDiario();
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

  // O token nunca saiu do processo do MCP.
  expect(npc.texto + cena.texto + auto.texto + detalhe.texto + depois.texto).not.toContain(token);
});

test("token revogado: o MCP responde o erro claro, na hora e se já estava conectado; o texto de Conectar o Claude traz o comando final", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;

  // O texto de "Conectar o Claude" traz o comando final (12-3: o MCP por HTTP na própria sala, uma linha só); o trecho do Claude
  // Desktop segue com o servidor local (stdio) deste lote.
  await abrirPreferencia(p, "claude");
  await p.getByTestId("claude-gerar").click();
  const token = (await p.getByTestId("claude-token-valor").textContent()) ?? "";
  const comando = (await p.getByTestId("claude-trecho-code").textContent()) ?? "";
  expect(comando).toBe(
    `claude mcp add --transport http --scope user tavola-${ID_DA_MESA} ${URL_PELO_VITE}/api/m/${ID_DA_MESA}/mcp --header "Authorization: Bearer ${token}"`,
  );
  await p.getByText("Claude Desktop", { exact: true }).click();
  const desktop = JSON.parse((await p.getByTestId("claude-trecho-desktop").textContent()) ?? "{}");
  expect(desktop.mcpServers.tavola.env).toEqual({
    TAVOLA_URL: URL_PELO_VITE,
    TAVOLA_MESA: ID_DA_MESA,
    TAVOLA_TOKEN: token,
  });
  expect(ARQUIVO_DO_MCP).toContain("tavola-mcp.mjs");

  // Conecta com o token de verdade e usa.
  const mcp = await ClienteMcp.conectar(token, { url: URL_PELO_VITE });
  abertos.push(mcp);
  expect((await mcp.chamar("panorama")).erro).toBe(false);

  // Revoga pela mesa: a conexão cai (4001) e a próxima chamada responde o erro claro, sem reconectar.
  const id = (await p.getByTestId("claude-token").getAttribute("data-token-id")) ?? "";
  const r = await p.request.post(`/api/m/${ID_DA_MESA}/conta/claude/revogar`, { data: { id } });
  expect(r.ok()).toBe(true);
  const mensagem = "Token inválido ou revogado: gere outro em Preferências → Conectar o Claude.";
  await expect
    .poll(async () => (await mcp.chamar("panorama")).texto, { timeout: 20_000 })
    .toBe(mensagem);
  expect((await mcp.chamar("panorama")).erro).toBe(true);
  expect((await mcp.chamar("fichas", { fichas: [{ nome: "X" }] })).texto).toBe(mensagem);

  // Um MCP novo com o mesmo token revogado também responde o erro claro (a lista de ferramentas já vem reduzida).
  const novo = await ClienteMcp.conectar(token, { url: URL_DA_SALA });
  abertos.push(novo);
  expect(await novo.ferramentas()).toEqual(["panorama"]);
  const recusado = await novo.chamar("panorama");
  expect(recusado.erro).toBe(true);
  expect(recusado.texto).toBe(mensagem);
  expect(mcp.saidaDeErro + novo.saidaDeErro).not.toContain(token);
});

test("sem configuração o MCP sobe e a ferramenta diz o que falta ajustar", async () => {
  const mcp = await ClienteMcp.conectar("sem-formato");
  abertos.push(mcp);
  expect(await mcp.ferramentas()).toEqual(["panorama"]);
  const r = await mcp.chamar("panorama");
  expect(r.erro).toBe(true);
  expect(r.texto).toContain("formato de um token do Távola");
});
