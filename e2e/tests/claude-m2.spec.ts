import { expect, type Sessao, test } from "./ajudas";
import { ClaudeWs, gerarToken } from "./ajudasClaude";
import { enviarPor, linkDoTexto, wavMudo } from "./ajudasEnvio";
import { doTipo, entrarNoMapa } from "./ajudasMapa";
import { ClienteMcpHttp, URL_PELO_VITE } from "./ajudasMcp";

// M2: o Claude faz tudo na preparação e na configuração. O cliente do SDK (o mesmo do Claude Code) fala com o MCP da sala por
// HTTP; o teste confere o que a mesa do mestre e a do jogador recebem. A paridade de cada intenção com as ferramentas é
// conferida na unidade (`mcp/paridade.test.ts`).

test.describe.configure({ timeout: 180_000 });

const abertos: ClienteMcpHttp[] = [];
test.afterEach(async () => {
  await Promise.all(abertos.splice(0).map((c) => c.fechar()));
});

async function mcpDe(s: Sessao): Promise<{ mcp: ClienteMcpHttp; token: string }> {
  const { token } = await gerarToken(s.pagina);
  const mcp = await ClienteMcpHttp.conectar(token, { url: URL_PELO_VITE });
  abertos.push(mcp);
  return { mcp, token };
}

const CENA = "Cena inicial";

test("névoa revelada, texto no mapa, parede apagada, chat e ambiente: o jogador vê e o Desfazer volta", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const jogador = await entrarNoMapa(mesa, "jogador-1");
  const { mcp } = await mcpDe(mestre);

  // Uma parede para apagar depois.
  const parede = await mcp.chamar("cenas", {
    cenas: [{ nome: CENA, paredes: [{ de: [3, 3], ate: [9, 3] }] }],
  });
  expect(parede.erro, parede.texto).toBe(false);

  // Névoa: cobre tudo e revela um retângulo; o jogador recebe os dois traços.
  const nevoa = await mcp.chamar("mapa", {
    cena: CENA,
    nevoa: [{ modo: "cobrir" }, { modo: "revelar", de: [10, 4], ate: [14, 20] }],
  });
  expect(nevoa.erro, nevoa.texto).toBe(false);
  await expect
    .poll(() => doTipo(jogador.frames, "evento").filter((f) => f.includes("nevoa.tracada")).length)
    .toBe(2);

  // Texto no mapa (traços) e a parede de fora.
  const texto = await mcp.chamar("mapa", {
    cena: CENA,
    textos: [{ texto: "PONTE", em: [10, 2] }],
    paredes: [{ perto: [6, 3], apagar: true }],
  });
  expect(texto.erro, texto.texto).toBe(false);
  await expect
    .poll(
      () =>
        jogador.frames.filter((f) => f.includes("desenho.criado") && f.includes("txt-ponte-"))
          .length,
    )
    .toBeGreaterThan(5);
  const lida = await mcp.chamar("ler", { tipo: "cena", nome: CENA });
  expect(lida.texto).not.toMatch(/\b1 parede/);

  // Chat "pelo Claude".
  const fala = await mcp.chamar("chat", { narrar: "Um vento frio sobe do poço.", emote: true });
  expect(fala.erro, fala.texto).toBe(false);
  await expect
    .poll(() => jogador.frames.some((f) => f.includes("peloClaude") && f.includes("vento frio")))
    .toBe(true);

  // Ambiente: o som sobe pela caixa, ganha um lugar na mesa de som e toca.
  const pedido = await mcp.chamar("arquivos", { uso: "som", nome: "floresta.wav" });
  const enviado = await enviarPor(linkDoTexto(pedido.texto), wavMudo());
  expect(enviado.json?.estado, enviado.corpo).toBe("aplicado");
  const toca = await mcp.chamar("som", {
    lugares: [{ grupo: "ambiente", lugar: 1, som: "floresta", nome: "Floresta" }],
    ambientes: [{ lugar: 1, ligado: true, volume: 0.4 }],
  });
  expect(toca.erro, toca.texto).toBe(false);
  await expect.poll(() => jogador.frames.some((f) => f.includes("som.ligadoAlterado"))).toBe(true);

  // Desfazer: o texto e a névoa voltam (um lote por chamada: o do texto é o mais novo com desenhos).
  // (Depois de um Desfazer a sala manda um snapshot novo a todos: o teste lê o estado por uma conexão própria.)
  const { token: tokenDoMestre } = await gerarToken(mestre.pagina);
  const leitor = await ClaudeWs.conectar(tokenDoMestre);
  const desenhos = () => (leitor.snapshot().desenhos as unknown[] | undefined)?.length ?? 0;
  const cenaVista = () =>
    (leitor.snapshot().cenas as { nome: string; nevoa?: unknown[] }[] | undefined)?.find(
      (c) => c.nome === CENA,
    );
  const paredes = () => (leitor.snapshot().paredes as unknown[] | undefined)?.length ?? 0;
  expect(desenhos()).toBeGreaterThan(5);
  const paredesAntes = paredes();
  expect(cenaVista()?.nevoa).toHaveLength(2);

  // O primeiro lote "mapa de ..." da lista que ainda não foi desfeito.
  const numeroDoLote = (t: string) =>
    Number(
      t
        .split("\n")
        .map((l) => (/^(\d+)\. mapa de/.exec(l) && !l.includes("já desfeito") ? l : ""))
        .find((l) => l !== "")
        ?.split(".")[0],
    );
  const doTexto = numeroDoLote((await mcp.chamar("desfazer")).texto);
  expect(doTexto).toBeGreaterThan(0);
  const d1 = await mcp.chamar("desfazer", { acao: "desfazer", lote: String(doTexto) });
  expect(d1.erro, d1.texto).toBe(false);
  // O texto saiu e a parede que o Claude apagou voltou.
  await expect.poll(desenhos).toBe(0);
  await expect.poll(paredes).toBe(paredesAntes + 1);
  // O lote seguinte (a névoa) também desfaz.
  const proximo = numeroDoLote((await mcp.chamar("desfazer")).texto);
  const d2 = await mcp.chamar("desfazer", { acao: "desfazer", lote: String(proximo) });
  expect(d2.erro, d2.texto).toBe(false);
  await expect.poll(() => cenaVista()?.nevoa?.length ?? 0).toBe(0);
  await leitor.fechar();
});

test("o Claude monta um combate com 2 goblins do compêndio, rola a iniciativa e passa o turno", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { mcp } = await mcpDe(mestre);

  const fichas = await mcp.chamar("fichas", {
    fichas: [{ nome: "Goblin", monstro: "Goblin", quantidade: 2 }],
  });
  expect(fichas.erro, fichas.texto).toBe(false);
  const tokens = await mcp.chamar("cenas", {
    cenas: [{ nome: CENA, tokens: [{ ficha: "Goblin 1" }, { ficha: "Goblin 2", em: [8.5, 5.5] }] }],
  });
  expect(tokens.erro, tokens.texto).toBe(false);

  const combate = await mcp.chamar("combate", {
    passos: [
      { acao: "adicionar", fichas: ["Goblin 1", "Goblin 2"] },
      { acao: "rolar", quem: "todos" },
      { acao: "ordenar" },
      { acao: "proximo" },
      { acao: "passar" },
    ],
    ordemVisivel: true,
  });
  expect(combate.erro, combate.texto).toBe(false);
  expect(combate.texto).toMatch(/Rodada 1/);
  const atual = await mcp.chamar("combate");
  expect(atual.texto).toMatch(/Goblin 1/);
  expect(atual.texto).toMatch(/Goblin 2/);
  await expect
    .poll(() => doTipo(mestre.frames, "evento").some((f) => f.includes("combate.")), {})
    .toBe(true);
});

test("o jogador não cobre a névoa nem monta o combate", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const jogador = await entrarNoMapa(mesa, "jogador-1");
  void mestre;
  const { mcp, token } = await mcpDe(jogador);

  const lista = await mcp.ferramentas();
  expect(lista).not.toContain("mapa");
  expect(lista).not.toContain("mesa");
  expect(lista).not.toContain("som");
  const tenta = await mcp.chamar("mapa", { nevoa: [{ modo: "cobrir" }] });
  expect(tenta.erro).toBe(true);
  const combate = await mcp.chamar("combate", {
    passos: [{ acao: "adicionar", soltas: ["Covil"] }],
  });
  expect(combate.erro).toBe(true);

  // Pelo WebSocket, direto: a sala recusa a intenção (a ferramenta escondida não é a única barreira).
  const ws = await ClaudeWs.conectar(token);
  const cena = (ws.snapshot().cenaAtivaId as string) ?? "";
  const n = await ws.mandar("nevoa.tracar", {
    cenaId: cena,
    traco: { forma: "tudo", modo: "cobrir", pontos: [] },
  });
  expect(n.tipo).toBe("erro");
  const c = await ws.mandar("combate.adicionar", { entradas: [{ id: "x1", nome: "Covil" }] });
  expect(c.tipo).toBe("erro");
  await ws.fechar();
});
