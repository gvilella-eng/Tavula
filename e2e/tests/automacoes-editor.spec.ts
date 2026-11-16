import { readFileSync } from "node:fs";
import type { APIRequestContext, Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, importarCampanha, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa } from "./ajudasMapa";

// Lote 7b-3: o editor das automações do mestre (formulário e JSON), os botões na barra (fixar e liberar aos jogadores) e
// as duas campanhas prontas. As intenções que o editor manda são as do 7b-1; aqui se confere a tela de ponta a ponta.

const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";
/** Um texto que só existe nas definições do mestre: se aparecer num frame do jogador, vazou. */
const SEGREDO = "SEGREDO-DO-EDITOR";

const luzes = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes());
const luzDe = async (p: Page, id: string) => (await luzes(p)).find((l) => l.id === id);

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r, `${tipo} sem resposta`).not.toBeNull();
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

async function adiantar(request: APIRequestContext, ms: number) {
  const r = await request.post(`/teste/avancar-relogio?ms=${ms}`);
  expect(r.ok()).toBe(true);
}

async function acenderTocha(mestre: Page, novoId = "tocha-a") {
  await ok(mestre, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 2 });
  await ok(mestre, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId });
}

/** Abre a aba Mesa e, dela, a janela das automações. */
async function abrirAutomacoes(p: Page) {
  await abrirAba(p, "mesa");
  await p.getByTestId("automacoes-abrir").click();
  await expect(p.getByTestId("automacoes-janela")).toBeVisible();
}

/** O que a mesa anunciou no chat (num evento ou no chat de um snapshot que o navegador recebeu). */
const anunciou = (frames: string[], texto: string) =>
  frames.some((f) => {
    try {
      const m = JSON.parse(f) as {
        tipo: string;
        dados: {
          tipo?: string;
          dados?: { mensagem?: { tipo?: string; texto?: string } };
          estado?: { chat?: { tipo?: string; texto?: string }[] };
        };
      };
      const avisos =
        m.tipo === "evento" && m.dados.tipo === "chat.mensagem"
          ? [m.dados.dados?.mensagem]
          : m.tipo === "snapshot"
            ? (m.dados.estado?.chat ?? [])
            : [];
      return avisos.some((x) => x?.tipo === "aviso" && x.texto === texto);
    } catch {
      return false;
    }
  });

test("o mestre monta pelo formulário uma reação da tocha e um ciclo de 10 s, e o efeito acontece no mapa", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await acenderTocha(p);
  await expect.poll(async () => (await luzDe(p, "tocha-a"))?.claraM).toBeGreaterThan(0);
  const cheio = (await luzDe(p, "tocha-a"))?.claraM ?? 0;

  await abrirAutomacoes(p);
  await expect(p.getByTestId("automacoes-lista")).toBeVisible();
  await expect(p.getByTestId("auto-avisos")).toContainText("nenhum");

  // a reação: "ao receber inspiracao, a luz do modelo Tocha 5e fica com metade do raio por 20 s"
  await p.getByTestId("auto-nova-reacao").click();
  await p.getByTestId("form-reacao-nome").fill("Treme");
  await p.getByTestId("form-reacao-fica").selectOption("modelo");
  await p.getByTestId("form-reacao-fica-id").selectOption(TOCHA);
  await p.getByTestId("form-reacao-ao").selectOption("__outro");
  await p.getByTestId("form-reacao-ao-outro").fill("inspiracao");
  await p.getByTestId("form-acao-0-tipo").selectOption("luz.modificar");
  await p.getByTestId("form-acao-0-raioX").fill("0,5");
  await p.getByTestId("form-acao-0-raioX").press("Tab");
  await p.getByTestId("form-acao-0-por").fill("20");
  await p.getByTestId("form-acao-0-por").press("Tab");
  await p.getByTestId("form-reacao-salvar").click();
  await expect(p.getByTestId("auto-reacao-treme")).toContainText("inspiracao");
  await expect(p.getByTestId("auto-grupo-modelo:modelo-tocha")).toBeVisible();
  expect(mestre.enviados.filter((f) => f.includes('"reacao.criar"')).length).toBe(1);

  // o ciclo: 10 s, a primeira fase cai logo e dispara "inspiracao"
  await p.getByTestId("auto-novo-ciclo").click();
  await p.getByTestId("form-ciclo-nome").fill("Respiração de teste");
  await p.getByTestId("form-ciclo-periodo").fill("10");
  await p.getByTestId("form-ciclo-periodo").press("Tab");
  await p.getByTestId("form-ciclo-fase-0-evento").fill("inspiracao");
  await p.getByTestId("form-ciclo-fase-0-duracao").fill("20");
  await p.getByTestId("form-ciclo-fase-0-duracao").press("Tab");
  await p.getByTestId("form-ciclo-salvar").click();
  await expect(p.getByTestId("auto-ciclo-respiracao-de-teste")).toBeVisible();
  await expect(p.getByTestId("auto-ciclo-respiracao-de-teste-fase")).toContainText("inspiracao");

  // o efeito chega ao mapa: o raio da tocha fica pela metade
  await expect.poll(async () => (await luzDe(p, "tocha-a"))?.claraM).toBeCloseTo(cheio * 0.5, 5);
  // e o evento aparece na lista dos eventos em uso, com quem o ouve
  await expect(p.getByTestId("auto-evento-inspiracao")).toContainText("1 reação");
});

test("editar pelo JSON: com erro mostra a mensagem em português e não envia; corrigido, salva", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "ciclo.criar", {
    ciclo: {
      id: "c1",
      nome: "Fôlego",
      periodoS: 60,
      cenas: [],
      fases: [{ emS: 0, evento: "a" }],
    },
    pausado: true,
  });
  await abrirAutomacoes(p);
  await p.getByTestId("auto-ciclo-c1-editar").click();
  await expect(p.getByTestId("form-ciclo")).toBeVisible();
  await p.getByTestId("form-ciclo-json").locator("summary").click();
  const texto = p.getByTestId("form-ciclo-json-texto");
  await expect(texto).toBeVisible();
  await expect(p.getByTestId("form-ciclo-json-ok")).toBeVisible();

  const antes = mestre.enviados.filter((f) => f.includes('"ciclo.editar"')).length;
  // erro de escrita (JSON quebrado)
  await texto.fill('{"id": "c1", "nome": ');
  await expect(p.getByTestId("form-ciclo-json-erros")).toContainText("incompleto");
  // erro de regra: período negativo
  await texto.fill(
    JSON.stringify({
      id: "c1",
      nome: "Fôlego curto",
      periodoS: -5,
      cenas: [],
      fases: [{ emS: 0, evento: "a" }],
    }),
  );
  await expect(p.getByTestId("form-ciclo-json-erros")).toContainText(
    "Período (segundos): precisa ser maior que 0.",
  );
  // o formulário acompanha o JSON, e Salvar com erro mostra o erro no campo e não envia nada
  await expect(p.getByTestId("form-ciclo-nome")).toHaveValue("Fôlego curto");
  await p.getByTestId("form-ciclo-salvar").click();
  await expect(p.getByTestId("form-ciclo-resumo")).toBeVisible();
  await expect(p.getByTestId("form-ciclo-periodo-erro")).toHaveText("precisa ser maior que 0.");
  expect(mestre.enviados.filter((f) => f.includes('"ciclo.editar"')).length).toBe(antes);

  // corrigido, salva
  await texto.fill(
    JSON.stringify({
      id: "c1",
      nome: "Fôlego curto",
      periodoS: 45,
      cenas: [],
      fases: [{ emS: 0, evento: "a" }],
    }),
  );
  await expect(p.getByTestId("form-ciclo-json-ok")).toBeVisible();
  await p.getByTestId("form-ciclo-salvar").click();
  await expect(p.getByTestId("auto-ciclo-c1")).toContainText("Fôlego curto");
  await expect(p.getByTestId("auto-ciclo-c1")).toContainText("45 s");
  expect(mestre.enviados.filter((f) => f.includes('"ciclo.editar"')).length).toBe(antes + 1);
});

test("fixar o ciclo na barra; pausar e retomar pelo chip; apagar pede confirmação na página", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "ciclo.criar", {
    ciclo: {
      id: "c1",
      nome: "Respiração",
      periodoS: 600,
      cenas: [],
      fases: [
        { emS: 0, evento: "inspiracao" },
        { emS: 300, evento: "expiracao" },
      ],
    },
  });
  await expect(p.getByTestId("botoes-da-barra")).toHaveCount(0);
  await abrirAutomacoes(p);
  await expect(p.getByTestId("auto-ciclo-c1-fixar")).toHaveAttribute("aria-pressed", "false");
  await p.getByTestId("auto-ciclo-c1-fixar").click();
  await expect(p.getByTestId("auto-ciclo-c1-fixar")).toHaveAttribute("aria-pressed", "true");
  const chip = p.getByTestId("chip-ciclo-c1");
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("Respiração");
  await expect(p.getByTestId("chip-ciclo-c1-fase")).toContainText("inspiracao");
  await expect(chip).toHaveAttribute("data-pausado", "false");

  // pausa e retoma pelo chip da barra
  await p.getByTestId("chip-ciclo-c1-pausa").click();
  await expect(chip).toHaveAttribute("data-pausado", "true");
  await expect(p.getByTestId("chip-ciclo-c1-fase")).toHaveText("pausado");
  await expect(p.getByTestId("auto-ciclo-c1-fase")).toContainText("Pausado");
  await p.getByTestId("chip-ciclo-c1-pausa").click();
  await expect(chip).toHaveAttribute("data-pausado", "false");
  // disparar pelo chip pula para a fase seguinte
  await p.getByTestId("chip-ciclo-c1-disparar").click();
  await expect(p.getByTestId("chip-ciclo-c1-fase")).toContainText("expiracao");

  // o que se fixa fica guardado com a campanha: recarregar mantém o chip
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(p.getByTestId("chip-ciclo-c1")).toBeVisible();

  // apagar pede confirmação na própria página (sem confirm() do navegador)
  p.on("dialog", () => {
    throw new Error("não devia abrir um confirm() do navegador");
  });
  await abrirAutomacoes(p);
  await p.getByTestId("auto-ciclo-c1-apagar").click();
  await expect(p.getByTestId("auto-ciclo-c1-confirmacao")).toBeVisible();
  await p.getByTestId("auto-ciclo-c1-apagar-cancelar").click();
  await expect(p.getByTestId("auto-ciclo-c1")).toBeVisible();
  await p.getByTestId("auto-ciclo-c1-apagar").click();
  await p.getByTestId("auto-ciclo-c1-apagar-confirmar").click();
  await expect(p.getByTestId("auto-ciclo-c1")).toHaveCount(0);
  await expect(p.getByTestId("chip-ciclo-c1")).toHaveCount(0);
});

test("um botão liberado aparece para o jogador, que o dispara; sem a liberação a sala recusa; nenhum frame dele traz a definição", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "reacao.criar", {
    reacao: {
      id: "r-rajada",
      nome: SEGREDO,
      fica: { tipo: "mesa" },
      ao: "rajada-secreta-do-mestre",
      fazer: [
        { acao: "chat.anunciar", texto: "Uma rajada atravessa a sala." },
        { acao: "chat.anunciar", texto: SEGREDO, para: "mestre" },
      ],
    },
  });
  await ok(p, "botao.criar", {
    botao: { id: "b1", nome: "Soprar o vento", evento: "rajada-secreta-do-mestre" },
  });
  await ok(p, "ciclo.criar", {
    ciclo: {
      id: "c-escondido",
      nome: `${SEGREDO}-ciclo`,
      periodoS: 600,
      cenas: [],
      fases: [{ emS: 0, evento: "segredo-do-ciclo" }],
    },
  });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  const j3 = await entrarNoMapa(mesa, "jogador-3");

  // sem a liberação: o jogador não vê chip nenhum, e a sala recusa o pedido cru
  await expect(j1.pagina.getByTestId("botoes-da-barra")).toHaveCount(0);
  const recusado = await enviarCru(j1.pagina, intencaoCrua("botao.usar", { botaoId: "evento:b1" }));
  expect(recusado?.tipo).toBe("erro");
  expect(recusado?.dados.codigo).toBe("sem_permissao");
  expect(anunciou(j1.frames, "Uma rajada atravessa a sala.")).toBe(false);
  // o ciclo que o mestre não liberou também fica fora: o jogador não o usa
  const ciclo = await enviarCru(
    j1.pagina,
    intencaoCrua("botao.usar", { botaoId: "ciclo:c-escondido", acao: "pausar" }),
  );
  expect(ciclo?.dados.codigo).toBe("sem_permissao");

  // o mestre libera pelo editor: o chip chega aos jogadores, só com o nome
  await abrirAutomacoes(p);
  await expect(p.getByTestId("auto-botao-b1")).toContainText("Soprar o vento");
  await p.getByTestId("auto-botao-b1-liberar").click();
  await expect(p.getByTestId("auto-botao-b1-liberar")).toHaveAttribute("aria-pressed", "true");
  const chip = j1.pagina.getByTestId("chip-botao-b1");
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("Soprar o vento");
  await expect(j2.pagina.getByTestId("chip-botao-b1")).toBeVisible();

  // o jogador dispara pelo chip: a reação roda e todos leem o anúncio
  await j1.pagina.getByTestId("chip-botao-b1-disparar").click();
  await expect.poll(() => anunciou(j1.frames, "Uma rajada atravessa a sala.")).toBe(true);
  await expect.poll(() => anunciou(mestre.frames, SEGREDO)).toBe(true);
  expect(anunciou(j1.frames, SEGREDO)).toBe(false);

  // o limite de frequência: dois pedidos seguidos do mesmo jogador, o segundo é recusado
  const primeiro = await enviarCru(j2.pagina, intencaoCrua("botao.usar", { botaoId: "evento:b1" }));
  expect(primeiro?.tipo).toBe("evento");
  const segundo = await enviarCru(j2.pagina, intencaoCrua("botao.usar", { botaoId: "evento:b1" }));
  expect(segundo?.tipo).toBe("erro");
  expect(segundo?.dados.codigo).toBe("muitas_mensagens");

  // nenhum frame do jogador traz a definição
  for (const sessao of [j1, j2]) {
    const todos = sessao.frames.join("\n");
    expect(todos).toContain("Soprar o vento");
    for (const proibido of [
      SEGREDO,
      "automacoes",
      "rajada-secreta-do-mestre",
      "segredo-do-ciclo",
      "c-escondido",
      "periodoS",
      "r-rajada",
    ]) {
      expect(todos, `o frame do jogador trouxe "${proibido}"`).not.toContain(proibido);
    }
  }

  // desfazer a liberação tira o chip e a sala volta a recusar
  await p.getByTestId("auto-botao-b1-liberar").click();
  await expect(j1.pagina.getByTestId("chip-botao-b1")).toHaveCount(0);
  await expect(j3.pagina.getByTestId("chip-botao-b1")).toHaveCount(0);
  const depois = await enviarCru(j3.pagina, intencaoCrua("botao.usar", { botaoId: "evento:b1" }));
  expect(depois?.dados.codigo).toBe("sem_permissao");
});

test("um ciclo liberado mostra ao jogador o chip com disparar e pausar, sem as fases", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await ok(mestre.pagina, "ciclo.criar", {
    ciclo: {
      id: "resp",
      nome: "Respiração",
      periodoS: 600,
      cenas: [],
      fases: [
        { emS: 0, evento: "inspiracao" },
        { emS: 300, evento: "expiracao-secreta" },
      ],
      liberadoParaJogadores: true,
    },
  });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const chip = j1.pagina.getByTestId("chip-botao-resp");
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("data-pausado", "false");
  await j1.pagina.getByTestId("chip-botao-resp-pausa").click();
  await expect(chip).toHaveAttribute("data-pausado", "true");
  await expect(chip).toContainText("pausado");
  await expect(j1.pagina.getByTestId("chip-botao-resp-pausa")).toBeVisible();
  const todos = j1.frames.join("\n");
  expect(todos).not.toContain("expiracao-secreta");
  expect(todos).not.toContain("inspiracao");
});

test("a campanha '5e padrão' carrega e roda sem nenhuma automação", async ({ mesa, request }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "ciclo.criar", {
    ciclo: {
      id: "velho",
      nome: "Velho",
      periodoS: 60,
      cenas: [],
      fases: [{ emS: 0, evento: "x" }],
    },
  });
  await abrirAba(p, "mesa");
  // Q1: a lista de exemplos saiu da tela; o arquivo "5e padrão" é só fixture e entra como qualquer campanha exportada
  await expect(p.getByTestId("campanhas-de-exemplo")).toHaveCount(0);
  await importarCampanha(p, {
    name: "5e-padrao.json",
    mimeType: "application/json",
    buffer: readFileSync(new URL("../../fixtures/campanhas/5e-padrao.json", import.meta.url)),
  });

  await expect(p.getByTestId("automacoes-resumo")).toHaveText("Nenhuma automação nesta mesa.");
  await expect(p.getByTestId("modelo-modelo-tocha")).toBeVisible();
  await adiantar(request, 120_000);
  await p.getByTestId("automacoes-abrir").click();
  await expect(p.getByText("Nenhum ciclo ainda.")).toBeVisible();
  await expect(p.getByText("Nenhuma reação ainda.")).toBeVisible();
  await expect(p.getByTestId("botoes-da-barra")).toHaveCount(0);
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
});

type Campanha = { dados: Record<string, unknown> };
/** O Aldric e o token dele, da semente dos testes: a Chama Primordial não traz personagens. */
const seed = JSON.parse(
  readFileSync(new URL("../../fixtures/campanha.seed.json", import.meta.url), "utf8"),
) as { personagens: { id: string }[]; tokens: { id: string; cenaId: string }[] };
const lerCampanha = (nome: string) =>
  JSON.parse(
    readFileSync(new URL(`../../fixtures/campanhas/${nome}`, import.meta.url), "utf8"),
  ) as Campanha;

test("a 'Chama Primordial' (arquivo de fixture) carrega as automações e o ciclo fixado na barra", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "mesa");
  await importarCampanha(p, {
    name: "chama-primordial.json",
    mimeType: "application/json",
    buffer: readFileSync(
      new URL("../../fixtures/campanhas/chama-primordial.json", import.meta.url),
    ),
  });
  await expect(p.getByTestId("automacoes-resumo")).toHaveText(
    "1 ciclo · 4 reações · 1 botão de evento",
  );
  await expect(p.getByTestId("chip-ciclo-respiracao")).toBeVisible();
  await p.getByTestId("automacoes-abrir").click();
  await expect(p.getByTestId("auto-ciclo-respiracao")).toContainText("Respiração do Pulmão");
  await expect(p.getByTestId("auto-grupo-modelo:modelo-tocha")).toBeVisible();
  await expect(p.getByTestId("auto-grupo-cena:pulmao")).toBeVisible();
  await expect(p.getByTestId("auto-grupo-mesa")).toBeVisible();
  await expect(p.getByTestId("auto-grupo-zona:zona-ar-morto")).toBeVisible();
  await expect(p.getByTestId("auto-evento-objeto.acendeu")).toContainText("Uma luz acendeu");
});

test("a 'Chama Primordial' com o ciclo encurtado: a inspiração reduz e apaga tochas, e o botão pausa e retoma o ciclo", async ({
  mesa,
  request,
}) => {
  const arquivo = lerCampanha("chama-primordial.json");
  const dados = arquivo.dados as {
    automacoes: { ciclos: { periodoS: number; fases: { emS: number }[] }[] };
    luzes: unknown[];
  };
  // o teste encurta o ciclo (180 s → 30 s) e leva a mesa para o Pulmão, com oito tochas acesas
  const ciclo = dados.automacoes.ciclos[0];
  if (!ciclo) throw new Error("a campanha não tem ciclo");
  ciclo.periodoS = 30;
  const [primeira, segunda] = ciclo.fases;
  if (!primeira || !segunda) throw new Error("a campanha não tem as duas fases");
  primeira.emS = 0;
  segunda.emS = 15;
  const tochas = Array.from({ length: 8 }, (_, i) => ({
    id: `pulmao-t${i + 1}`,
    cenaId: "pulmao",
    nome: `Tocha ${i + 1}`,
    modeloId: TOCHA,
    portador: { tipo: "cena", x: 6 + i * 3, y: 40 }, // fora das duas zonas da campanha
    luz: { claraM: 6, penumbraM: 6, cor: "#ffb347", tremula: false },
    intensidade: 1,
    estado: "acesa",
    saldoMs: 1_800_000,
    acesaDesdeSala: 0,
    duracaoMs: 1_800_000,
    modificadores: [],
    historico: [],
  }));
  const aldric = seed.personagens.filter((x) => x.id === ALDRIC);
  const tokenDele = seed.tokens
    .filter((x) => x.id === "tok-jogador-1")
    .map((x) => ({ ...x, cenaId: "pulmao" }));
  const comTochas = {
    ...arquivo,
    dados: {
      ...arquivo.dados,
      cenaAtivaId: "pulmao",
      luzes: tochas,
      personagens: aldric,
      tokens: tokenDele,
    },
  };
  expect((await request.post("/teste/dados?semente=1")).ok()).toBe(true);

  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "mesa");
  await importarCampanha(p, {
    name: "chama-curta.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(comTochas)),
  });
  await expect(p.getByTestId("automacoes-resumo")).toContainText("1 ciclo");
  // a mesa importada vem pausada; retomar faz o ciclo começar (a inspiração cai logo)
  await expect(p.getByTestId("estado-mesa-selo")).toBeVisible();
  const chip = p.getByTestId("chip-ciclo-respiracao");
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("no começo");
  // as oito tochas chegaram (acesas, no tempo parado) antes de a mesa correr
  const doPulmao = async () => (await luzes(p)).filter((l) => l.id.startsWith("pulmao-t"));
  await expect.poll(async () => (await doPulmao()).length).toBe(8);
  await p.getByTestId("menu-pausa").click();
  await expect(p.getByTestId("estado-mesa-selo")).toHaveCount(0);

  // a inspiração: as tochas que ficam acesas têm metade do raio, e parte delas apagou
  await expect
    .poll(async () => (await doPulmao()).length, { message: "algumas tochas apagam na rajada" })
    .toBeLessThan(8);
  const acesas = await doPulmao();
  expect(acesas.length).toBeGreaterThan(0);
  for (const l of acesas) expect(l.claraM).toBeCloseTo(3, 5);
  await expect(p.getByTestId("chip-ciclo-respiracao-fase")).toContainText("inspiracao");

  // pausar e retomar pelo botão da barra
  await p.getByTestId("chip-ciclo-respiracao-pausa").click();
  await expect(chip).toHaveAttribute("data-pausado", "true");
  await p.getByTestId("chip-ciclo-respiracao-pausa").click();
  await expect(chip).toHaveAttribute("data-pausado", "false");

  // 25 s depois (a expiração cai aos 15 s) o raio das que sobraram já voltou ao cheio
  await adiantar(request, 25_000);
  await expect
    .poll(async () =>
      (await luzes(p))
        .filter((l) => l.id.startsWith("pulmao-t"))
        .every((l) => Math.abs(l.claraM - 6) < 1e-6),
    )
    .toBe(true);
});
