import type { APIRequestContext, Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, intencaoCrua, type Sessao, test } from "./ajudas";
import { entrarNoMapa, esperarPosicao, type GanchoDoMapa, pontoNaPagina } from "./ajudasMapa";

// Lote 7: relógio da sala, tochas, mochila, mãos, entregar, pontos, pausa e o sigilo do tempo.
// A semente tem Aldric (jogador-1, token em 11,25; 9,75), Brisa (jogador-2) e Cael (jogador-3), todos
// sem tochas na mochila: cada teste dá o que precisa pelo mestre. O grid é de 1,5 m: o quadrado vizinho
// de Aldric à direita é 12,75; 9,75 e o de baixo, 11,25; 11,25.

const ALDRIC = "pers-aldric";
const BRISA = "pers-brisa";
const TOCHA = "modelo-tocha";

type Alca = ReturnType<GanchoDoMapa["alcas"]>[number];

const alcas = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas());
const pontosDaTela = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.pontos());
const anel = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.anelDeAcender());

/** "12:34" → segundos. */
const segundos = (rotulo: string) => {
  const partes = rotulo.split(":").map(Number);
  return partes.reduce((total, n) => total * 60 + n, 0);
};

async function intencao(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r, `${tipo} sem resposta`).not.toBeNull();
  return r;
}

async function ok(p: Page, tipo: string, dados: object) {
  const r = await intencao(p, tipo, dados);
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

/**
 * Manda uma intenção que a sala responde com um snapshot novo para todos (config.mesa, pausa), não com
 * um evento: não há o que esperar aqui, o teste confere o efeito depois.
 */
async function mandar(p: Page, tipo: string, dados: object) {
  await p.evaluate(
    ([t, d]) =>
      new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/ws`);
        ws.onopen = () => {
          ws.send(JSON.stringify({ v: 1, id: `teste-${Math.random()}`, tipo: t, dados: d }));
          setTimeout(() => {
            ws.close();
            resolve();
          }, 400);
        };
      }),
    [tipo, dados] as [string, object],
  );
}

async function recusa(p: Page, tipo: string, dados: object): Promise<string | undefined> {
  const r = await intencao(p, tipo, dados);
  expect(r?.tipo).toBe("erro");
  return r?.dados.codigo;
}

/** Adianta o relógio da sala (gancho de teste: só existe com MODO=teste). */
async function adiantar(request: APIRequestContext, ms: number) {
  const r = await request.post(`/teste/avancar-relogio?ms=${ms}`);
  expect(r.ok()).toBe(true);
}

/** Tochas na mochila do Aldric e a Brisa no quadrado vizinho de baixo. */
async function preparar(mestre: Sessao, tochas = 3) {
  await ok(mestre.pagina, "mochila.ajustar", {
    personagemId: ALDRIC,
    modeloId: TOCHA,
    delta: tochas,
  });
  await ok(mestre.pagina, "token.soltar", { id: "tok-jogador-2", x: 11.25, y: 11.25 });
}

async function acender(p: Page, novoId = "tocha-1", personagemId = ALDRIC) {
  await ok(p, "tocha.acender", { personagemId, modeloId: TOCHA, novoId });
}

/** Arrasta com o mouse de verdade, passo a passo (o mapa lê cada movimento). */
async function arrastar(p: Page, de: { x: number; y: number }, para: { x: number; y: number }) {
  await p.mouse.move(de.x, de.y);
  await p.mouse.down();
  await p.mouse.move(para.x, para.y, { steps: 10 });
  await p.mouse.up();
}

test("a tocha acesa vai para a mão, mostra o tempo na alça e a ficha mostra x−1 novas e 1 usada; o refresh não muda o tempo", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;

  // a mochila no editor do item
  await abrirAba(p, "fichas");
  await p.getByTestId("aba-painel-fichas").getByText("Aldric").first().dblclick();
  await p.getByTestId("ficha-aba-equipamento").click();
  await expect(p.getByTestId("mochila-resumo-modelo-tocha")).toHaveText("3 novas, 0 usadas");
  await p.getByTestId("mochila-acender-modelo-tocha").click();
  await expect(p.getByTestId("mochila-resumo-modelo-tocha")).toHaveText("2 novas, 1 usada");
  await p.getByTestId("janela-ficha-fechar").click();

  // a alça junto ao token, com o tempo (60 min da semente)
  await expect.poll(async () => (await alcas(p)).length).toBe(1);
  const antes = (await alcas(p))[0] as Alca;
  expect(antes).toMatchObject({ estado: "acesa", portador: "mao" });
  expect(segundos(antes.rotulo)).toBeGreaterThan(3590);
  expect(segundos(antes.rotulo)).toBeLessThanOrEqual(3600);

  await adiantar(p.request, 600_000); // 10 min
  await expect.poll(async () => segundos(((await alcas(p))[0] as Alca).rotulo)).toBeLessThan(3010);
  const tempoAntes = segundos(((await alcas(p))[0] as Alca).rotulo);
  expect(tempoAntes).toBeGreaterThan(2990);

  // refresh no meio: o tempo restante continua o mesmo (±2 s) e a ficha também
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await expect.poll(async () => (await alcas(p)).length).toBe(1);
  const depois = segundos(((await alcas(p))[0] as Alca).rotulo);
  expect(Math.abs(depois - tempoAntes)).toBeLessThanOrEqual(3);
  await abrirAba(p, "fichas");
  await p.getByTestId("aba-painel-fichas").getByText("Aldric").first().dblclick();
  await p.getByTestId("ficha-aba-equipamento").click();
  await expect(p.getByTestId("mochila-resumo-modelo-tocha")).toHaveText("2 novas, 1 usada");
});

test("dois cliques na alça apagam e reacendem; o clique direito guarda na mochila", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await acender(p);
  await expect.poll(async () => (await alcas(p))[0]?.estado).toBe("acesa");

  const a = (await alcas(p))[0] as Alca;
  await p.mouse.dblclick(a.x, a.y);
  await expect.poll(async () => (await alcas(p))[0]?.estado).toBe("apagada");
  await p.mouse.dblclick(a.x, a.y);
  await expect.poll(async () => (await alcas(p))[0]?.estado).toBe("acesa");

  await p.mouse.click(a.x, a.y, { button: "right" });
  await expect(p.getByTestId("menu-tocha")).toBeVisible();
  await p.getByTestId("menu-tocha-guardar").click();
  await expect.poll(async () => (await alcas(p)).length).toBe(0);
  // guardada: aparece como usada na mochila e acende de novo
  await abrirAba(p, "fichas");
  await p.getByTestId("aba-painel-fichas").getByText("Aldric").first().dblclick();
  await p.getByTestId("ficha-aba-equipamento").click();
  await expect(p.getByTestId("mochila-resumo-modelo-tocha")).toHaveText("2 novas, 1 usada");
  await p.getByTestId("mochila-acender-usada-tocha-1").click();
  await p.getByTestId("janela-ficha-fechar").click();
  await expect.poll(async () => (await alcas(p)).length).toBe(1);
});

test("o portador entrega a tocha a um token adjacente e o saldo vai junto; outro jogador não arrasta a tocha alheia", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await acender(j1.pagina);
  await adiantar(request, 1_200_000); // 20 min: restam 40 min
  await expect.poll(async () => (await alcas(j1.pagina)).length).toBe(1);
  await expect.poll(async () => (await alcas(j2.pagina)).length).toBe(1);
  await expect
    .poll(async () => segundos(((await alcas(j1.pagina))[0] as Alca).rotulo))
    .toBeLessThan(2410);

  // Brisa tenta arrastar a alça do Aldric até o próprio token: nada é enviado
  const dela = await pontoNaPagina(j2.pagina, 11.25, 11.25);
  const alcaVista = (await alcas(j2.pagina))[0] as Alca;
  await arrastar(j2.pagina, alcaVista, dela);
  await j2.pagina.waitForTimeout(400);
  expect(j2.enviados.filter((f) => f.includes('"tocha.entregar"'))).toEqual([]);
  // e a sala recusa a intenção mandada à mão
  expect(
    await recusa(j2.pagina, "tocha.entregar", { id: "tocha-1", tokenId: "tok-jogador-2" }),
  ).toBe("sem_permissao");
  expect(await recusa(j2.pagina, "tocha.alternar", { id: "tocha-1" })).toBe("sem_permissao");
  expect(await recusa(j2.pagina, "tocha.guardar", { id: "tocha-1" })).toBe("sem_permissao");

  // Aldric arrasta a própria alça até o token da Brisa: a tocha muda de mão, com o saldo
  const alvo = await pontoNaPagina(j1.pagina, 11.25, 11.25);
  await arrastar(j1.pagina, (await alcas(j1.pagina))[0] as Alca, alvo);
  await expect.poll(async () => (await alcas(j2.pagina))[0]?.portador).toBe("mao");
  await expect
    .poll(() =>
      j2.frames.some((f) => f.includes(`"personagemId":"${BRISA}"`) && f.includes('"mao"')),
    )
    .toBe(true);
  const emBrisa = segundos(((await alcas(j2.pagina))[0] as Alca).rotulo);
  expect(emBrisa).toBeLessThan(2410); // o saldo foi junto, não recomeçou em 60 min
  expect(emBrisa).toBeGreaterThan(2300);
  // ela agora é quem mexe nela (a ficha dela mostra a usada); ele já não consegue
  expect(await recusa(j1.pagina, "tocha.alternar", { id: "tocha-1" })).toBe("sem_permissao");
});

test("o fim do tempo apaga a tocha sozinha e libera a mão; pausar congela e retomar continua", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre, 3);
  // tocha curta de 90 s, criada no próprio teste
  await ok(mestre.pagina, "modelo.editar", { id: TOCHA, mudancas: { duracaoS: 90 } });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await acender(p);
  await acender(p, "tocha-2");
  await expect.poll(async () => (await alcas(p)).length).toBe(2);
  // duas mãos cheias: a terceira é recusada
  expect(
    await recusa(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-3" }),
  ).toBe("maos_cheias");

  // pausa: o relógio e as tochas congelam
  await mestre.pagina.getByTestId("menu-pausa").click();
  await expect(p.getByTestId("estado-mesa-selo")).toBeVisible();
  await expect(mestre.pagina.getByTestId("estado-mesa-selo")).toBeVisible();
  await p.waitForTimeout(600);
  const congelado = ((await alcas(p))[0] as Alca).rotulo;
  const relogioMestre = await mestre.pagina.getByTestId("relogio-sala").textContent();
  await adiantar(request, 0);
  await p.waitForTimeout(2500);
  expect(((await alcas(p))[0] as Alca).rotulo).toBe(congelado);
  expect(await mestre.pagina.getByTestId("relogio-sala").textContent()).toBe(relogioMestre);

  // retomar: volta a contar de onde parou
  await mestre.pagina.getByTestId("menu-pausa").click();
  await expect(p.getByTestId("estado-mesa-selo")).toHaveCount(0);
  await expect
    .poll(async () => ((await alcas(p))[0] as Alca).rotulo, { timeout: 8000 })
    .not.toBe(congelado);
  const retomado = segundos(((await alcas(p))[0] as Alca).rotulo);
  expect(segundos(congelado) - retomado).toBeLessThanOrEqual(5);

  // o tempo acaba: as duas tochas saem e as mãos ficam livres
  await adiantar(request, 120_000);
  await expect.poll(async () => (await alcas(p)).length).toBe(0);
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-4" });
  await expect.poll(async () => (await alcas(p)).length).toBe(1);
});

test("segurar a tocha acesa sobre o inflamável acende a fogueira; soltar antes não acende", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  await ok(mestre.pagina, "ponto.criar", {
    ponto: {
      id: "lenha",
      nome: "Lenha",
      x: 12.75,
      y: 9.75,
      tipo: "inflamavel",
      modeloId: "modelo-fogueira",
      segurarS: 2,
      visivelParaJogadores: true,
    },
  });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await acender(p);
  await expect.poll(async () => (await alcas(p)).length).toBe(1);
  await expect.poll(async () => (await pontosDaTela(p)).length).toBe(1);

  // solta antes de acabar a contagem: nada acende
  const alca = (await alcas(p))[0] as Alca;
  const ponto = (await pontosDaTela(p))[0] as { x: number; y: number };
  await p.mouse.move(alca.x, alca.y);
  await p.mouse.down();
  await p.mouse.move(ponto.x, ponto.y, { steps: 10 });
  await expect.poll(() => anel(p)).toBeGreaterThan(0);
  await p.mouse.up();
  await p.waitForTimeout(2300);
  expect(await anel(p)).toBeNull();
  expect((await alcas(p)).filter((a) => a.portador === "ponto")).toEqual([]);

  // segura por 2 s: o anel enche, a fogueira acende no ponto e a tocha volta para a mão
  await p.mouse.move(alca.x, alca.y);
  await p.mouse.down();
  await p.mouse.move(ponto.x, ponto.y, { steps: 10 });
  await expect.poll(() => anel(p), { timeout: 4000 }).toBeGreaterThan(0.4);
  await expect
    .poll(async () => (await alcas(p)).filter((a) => a.portador === "ponto").length, {
      timeout: 6000,
    })
    .toBe(1);
  await p.mouse.up();
  const fogo = (await alcas(p)).find((a) => a.portador === "ponto") as Alca;
  expect(fogo.estado).toBe("acesa");
  expect((await alcas(p)).filter((a) => a.portador === "mao")).toHaveLength(1);
});

test("a tocha vai para um suporte e volta; o ponto oculto não chega ao jogador", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  await ok(mestre.pagina, "ponto.criar", {
    ponto: {
      id: "gancho",
      nome: "Gancho",
      x: 12.75,
      y: 9.75,
      tipo: "suporte",
      visivelParaJogadores: true,
    },
  });
  await ok(mestre.pagina, "ponto.criar", {
    ponto: {
      id: "segredo",
      nome: "Esconderijo",
      x: 9.75,
      y: 9.75,
      tipo: "suporte",
      visivelParaJogadores: false,
    },
  });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await expect.poll(async () => (await pontosDaTela(p)).map((x) => x.id)).toEqual(["gancho"]);
  // o ponto oculto nunca aparece nos frames do jogador
  expect(j1.frames.filter((f) => f.includes("segredo") || f.includes("Esconderijo"))).toEqual([]);

  await acender(p);
  await expect.poll(async () => (await alcas(p)).length).toBe(1);
  const alca = (await alcas(p))[0] as Alca;
  const gancho = (await pontosDaTela(p))[0] as { x: number; y: number };
  await arrastar(p, alca, gancho);
  await expect.poll(async () => (await alcas(p))[0]?.portador).toBe("ponto");

  // no suporte: menu "Pegar do suporte" devolve para a mão
  const noPonto = (await alcas(p))[0] as Alca;
  await p.mouse.click(noPonto.x, noPonto.y, { button: "right" });
  await p.getByTestId("menu-tocha-pegar").click();
  await expect.poll(async () => (await alcas(p))[0]?.portador).toBe("mao");
});

test("frames do jogador: com tempo oculto ou por estágio, nenhum traz o saldo", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await preparar(mestre);
  await mandar(mestre.pagina, "config.mesa", { mudancas: { tempoParaJogadores: "oculto" } });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await acender(j1.pagina);
  await ok(mestre.pagina, "objeto.ajustar", {
    id: "tocha-1",
    ajuste: { acao: "tempo", deltaMs: 60_000, nota: "devolvendo" },
  });
  await ok(mestre.pagina, "objeto.ajustar", {
    id: "tocha-1",
    ajuste: { acao: "modificar", modificador: { id: "m1", raioX: 0.5, duracaoMs: 600_000 } },
  });
  await expect.poll(async () => (await alcas(j2.pagina)).length).toBe(1);

  const segredos = [
    "saldoMs",
    "acesaDesdeSala",
    '"restanteMs"',
    '"estagio":',
    "devolvendo",
    'historico":[{',
  ];
  const vazou = (frames: string[], nomes = segredos) =>
    frames.filter((f) => nomes.some((s) => f.includes(s))).map((f) => f.slice(0, 160));
  expect(vazou(j1.frames)).toEqual([]);
  expect(vazou(j2.frames)).toEqual([]);
  // na tela não há número nenhum
  expect((await alcas(j2.pagina))[0]?.rotulo).toBe("");

  // por estágio: só o estágio chega (um snapshot novo, enviado a todos)
  await mandar(mestre.pagina, "config.mesa", { mudancas: { tempoParaJogadores: "estagio" } });
  await expect.poll(() => j1.frames.some((f) => f.includes('"estagio":"forte"'))).toBe(true);
  expect(vazou(j1.frames, ["saldoMs", "acesaDesdeSala", '"restanteMs"', "devolvendo"])).toEqual([]);
  await expect.poll(async () => (await alcas(j2.pagina))[0]?.rotulo).toBe("forte");

  // exato: restanteMs, nunca o saldo
  await mandar(mestre.pagina, "config.mesa", { mudancas: { tempoParaJogadores: "exato" } });
  await expect.poll(() => j1.frames.some((f) => f.includes('"restanteMs"'))).toBe(true);
  expect(vazou(j1.frames, ["saldoMs", "acesaDesdeSala", "devolvendo"])).toEqual([]);
  // o mestre recebe tudo menos os dois campos internos
  expect(mestre.frames.some((f) => f.includes('"restanteMs"'))).toBe(true);
  expect(vazou(mestre.frames, ["saldoMs", "acesaDesdeSala"])).toEqual([]);
});

test("nenhum cliente consegue mandar o vencimento do tempo", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  for (const tipo of ["sistema.processarTempo", "tempo.passou", "luz.vencer"]) {
    expect(await recusa(mestre.pagina, tipo, {})).toBe("mensagem_invalida");
  }
});

test("o mestre ajusta o tempo e o raio no painel, extingue pela lixeira e configura a mesa e os modelos", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await preparar(mestre);
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await acender(j1.pagina);

  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-fontes").click();
  await expect(p.getByTestId("luz-tocha-1")).toBeVisible();
  await expect(p.getByTestId("luz-tocha-1")).toContainText("Aldric");
  const tempo = () => p.getByTestId("luz-tempo-tocha-1").textContent();
  await expect.poll(async () => segundos((await tempo()) ?? "0:0")).toBeGreaterThan(3590);
  // −1 min e +1 min
  await p.getByTestId("luz-menos-tocha-1").click();
  await expect.poll(async () => segundos((await tempo()) ?? "0:0")).toBeLessThan(3545);
  await p.getByTestId("luz-mais-tocha-1").click();
  await expect.poll(async () => segundos((await tempo()) ?? "0:0")).toBeGreaterThan(3590);
  // detalhe: saldo, histórico e modificador
  await p.getByTestId("luz-escolher-tocha-1").click();
  await expect(p.getByTestId("luz-detalhe")).toBeVisible();
  await expect(p.getByTestId("luz-historico-item").first()).toContainText("+1 min (mestre)");
  await p.getByTestId("luz-mod-raio").fill("0.5");
  await p.getByTestId("luz-mod-prazo").fill("5");
  await p.getByTestId("luz-mod-aplicar").click();
  await expect(p.getByTestId("luz-modificadores").locator("li")).toHaveCount(1);
  // a luz do jogador na tela dele passa a ter a metade do raio
  const raios = async () =>
    (
      await j1.pagina.evaluate(() =>
        (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes(),
      )
    ).find((l) => l.id === "tocha-1")?.claraM;
  await expect.poll(raios).toBeCloseTo(3); // 6 m × 0,5

  // a lixeira consome a tocha do jogador
  await p.getByTestId("luz-consumir-tocha-1").click();
  await expect(p.getByTestId("luz-tocha-1")).toHaveCount(0);
  await expect.poll(async () => (await alcas(j1.pagina)).length).toBe(0);

  // configurações da mesa e modelos (aba Configurações)
  await abrirAba(p, "configuracoes");
  await expect(p.getByTestId("config-mesa")).toBeVisible();
  await p.getByTestId("cfg-maos").fill("3");
  await p.getByTestId("cfg-maos").blur();
  await p.getByTestId("cfg-penalidade").fill("60");
  await p.getByTestId("cfg-penalidade").blur();
  await p.getByTestId("cfg-tempo").selectOption("estagio");
  await expect
    .poll(() => mestre.enviados.filter((f) => f.includes('"config.mesa"')).join(""))
    .toContain('"maosPorPersonagem":3');
  await expect(p.getByTestId("config-objetos")).toBeVisible();
  await p.getByTestId("modelo-novo").click();
  await expect(p.getByTestId("config-objetos").locator("details")).toHaveCount(4);
  // o jogador não tem essa seção
  await abrirAba(j1.pagina, "configuracoes");
  await expect(j1.pagina.getByTestId("config-mesa")).toHaveCount(0);
  // 3 mãos: a terceira tocha agora cabe (o mestre repõe uma tocha na mochila)
  await ok(p, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 1 });
  await acender(j1.pagina, "a");
  await acender(j1.pagina, "b");
  await acender(j1.pagina, "c");
  await expect.poll(async () => (await alcas(j1.pagina)).length).toBe(3);
});

test("o ponto de luz é criado pelo mestre no painel (com o clique no mapa)", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await esperarPosicao(p, "tok-jogador-1", 11.25, 9.75);
  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-fontes").click();
  await p.getByTestId("ponto-novo-suporte").click();
  const alvo = await pontoNaPagina(p, 20.25, 14.25);
  await p.mouse.click(alvo.x, alvo.y);
  await expect(p.getByTestId("ponto-lista").locator("li")).toHaveCount(1);
  await expect(p.getByTestId("ponto-editor")).toBeVisible();
  await p.getByTestId("ponto-visivel").click();
  await expect(p.getByTestId("ponto-lista").locator("li").first()).toContainText("oculto");
  await p.getByTestId("ponto-novo-inflamavel").click();
  const outro = await pontoNaPagina(p, 17.25, 14.25);
  await p.mouse.click(outro.x, outro.y);
  await expect(p.getByTestId("ponto-lista").locator("li")).toHaveCount(2);
});
