import type { APIRequestContext, Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa } from "./ajudasMapa";

// Lote 7b-1 (AU1: com os fluxos): o motor das automações. Fluxos mandados pelo mestre (as intenções são as mesmas que o
// editor por blocos e o MCP usam), o relógio adiantado pelo gancho de teste e o sigilo: nenhum frame do jogador traz a
// definição de uma automação, só os efeitos.

const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";
const CENA = "cena-1";
/** Um texto que só existe nas definições do mestre: se aparecer num frame do jogador, vazou. */
const SEGREDO = "SEGREDO-DA-MONTANHA";

const luzes = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes());
/** A luz de um objeto (a semente já tem duas luzes fixas na cena). */
const luzDe = async (p: Page, id: string) => (await luzes(p)).find((l) => l.id === id);
const alcas = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas());

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r, `${tipo} sem resposta`).not.toBeNull();
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

async function adiantar(request: APIRequestContext, ms: number) {
  const r = await request.post(`/teste/avancar-relogio?ms=${ms}`);
  expect(r.ok()).toBe(true);
}

/** Uma tocha acesa na mão do Aldric (jogador-1). */
async function acenderTocha(mestre: Page, novoId = "tocha-a") {
  await ok(mestre, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 2 });
  await ok(mestre, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId });
}

/** O que a mesa anunciou no chat (num evento ou no chat de um snapshot que o navegador recebeu). */
type Aviso = { tipo?: string; texto?: string };
function avisosDe(frame: string): Aviso[] {
  try {
    const m = JSON.parse(frame) as {
      tipo: string;
      dados: { tipo?: string; dados?: { mensagem?: Aviso }; estado?: { chat?: Aviso[] } };
    };
    return m.tipo === "evento" && m.dados.tipo === "chat.mensagem"
      ? [m.dados.dados?.mensagem ?? {}]
      : m.tipo === "snapshot"
        ? (m.dados.estado?.chat ?? [])
        : [];
  } catch {
    return [];
  }
}
const anunciou = (frames: string[], texto: string) =>
  frames.some((f) => avisosDe(f).some((x) => x.tipo === "aviso" && x.texto === texto));
/** Quantas mensagens de chat diferentes com este aviso chegaram (o mesmo id contado uma vez só). */
function quantasVezes(frames: string[], texto: string): number {
  const ids = new Set<string>();
  for (const f of frames) {
    try {
      const m = JSON.parse(f) as {
        tipo: string;
        dados: { tipo?: string; dados?: { mensagem?: Aviso & { id?: string } } };
      };
      const msg = m.dados.dados?.mensagem;
      if (m.tipo === "evento" && msg?.texto === texto && msg.id) ids.add(msg.id);
    } catch {
      // frame que não é JSON
    }
  }
  return ids.size;
}

const anuncio = (texto: string) => ({
  bloco: "acao",
  acao: { acao: "chat.anunciar", texto },
});

test("um fluxo de relógio reduz o raio da tocha acesa e o raio volta; o jogador vê o efeito e nenhum frame dele traz a automação", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await acenderTocha(mestre.pagina);
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await expect.poll(async () => (await luzDe(j1.pagina, "tocha-a"))?.claraM).toBeGreaterThan(0);
  const cheio = (await luzDe(j1.pagina, "tocha-a")) as { claraM: number; totalM: number };
  expect(cheio.claraM).toBeGreaterThan(0);

  // a cada 600 s, para cada tocha: o raio pela metade por 20 s (vale só para a cena do mapa)
  await ok(mestre.pagina, "fluxo.criar", {
    fluxo: {
      id: "respiracao",
      nome: SEGREDO,
      cenas: [CENA],
      gatilho: { tipo: "relogio", cadaS: 600 },
      trilhas: [
        [
          {
            bloco: "paraCada",
            alvo: { tipo: "objetos", modelo: TOCHA },
            corpo: [{ bloco: "acao", acao: { acao: "luz.modificar", raioX: 0.5, porS: 20 } }],
          },
        ],
      ],
    },
  });

  // o efeito chega aos dois: o raio fica pela metade
  for (const s of [mestre, j1]) {
    await expect
      .poll(async () => (await luzDe(s.pagina, "tocha-a"))?.claraM)
      .toBeCloseTo(cheio.claraM * 0.5, 5);
  }

  // passados os 20 s, o raio volta sozinho
  await adiantar(request, 21_000);
  for (const s of [mestre, j1]) {
    await expect
      .poll(async () => (await luzDe(s.pagina, "tocha-a"))?.claraM)
      .toBeCloseTo(cheio.claraM, 5);
  }

  // recarregar não prende nada: o snapshot novo traz o raio cheio
  await j1.pagina.reload();
  await expect(j1.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await expect
    .poll(async () => (await luzDe(j1.pagina, "tocha-a"))?.claraM)
    .toBeCloseTo(cheio.claraM, 5);

  // o sigilo: o mestre recebeu a definição; o jogador, em nenhum frame (evento ou snapshot)
  const doMestre = mestre.frames.join("\n");
  expect(doMestre).toContain("luz.modificar");
  expect(doMestre).toContain(SEGREDO);
  const doJogador = j1.frames.join("\n");
  expect(doJogador).toContain("fonte.editada"); // ele recebeu o efeito na luz...
  for (const proibido of [
    SEGREDO,
    "luz.modificar",
    "automacoes",
    "fluxos",
    "trilhas",
    "respiracao",
    "cadaS",
    "auto:",
  ]) {
    expect(doJogador, `o frame do jogador trouxe "${proibido}"`).not.toContain(proibido);
  }
});

test("pausar a mesa congela a espera do fluxo e retomar continua de onde parou", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "fluxo.criar", {
    fluxo: {
      id: "relogio",
      nome: "Relógio",
      gatilho: { tipo: "relogio", cadaS: 600 },
      trilhas: [[anuncio("tic"), { bloco: "esperar", s: 6 }, anuncio("tac")]],
    },
  });
  await expect.poll(() => anunciou(mestre.frames, "tic")).toBe(true);

  // pausa a mesa logo em seguida e espera mais do que faltava: nada acontece
  await p.getByTestId("menu-pausa").click();
  await expect(p.getByTestId("estado-mesa-selo")).toBeVisible();
  await p.waitForTimeout(7_000);
  expect(anunciou(mestre.frames, "tac")).toBe(false);

  // retoma: a espera está onde parou e continua quando o tempo da sala chega a ela
  await p.getByTestId("menu-pausa").click();
  await expect(p.getByTestId("estado-mesa-selo")).toHaveCount(0);
  await adiantar(request, 6_000);
  await expect.poll(() => anunciou(mestre.frames, "tac")).toBe(true);
});

test("desligar só o fluxo não para as tochas; ligar de novo continua o relógio de onde parou", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  // tocha curta, de 90 s
  await ok(p, "modelo.editar", { id: TOCHA, mudancas: { duracaoS: 90 } });
  await acenderTocha(p);
  await expect.poll(async () => (await alcas(p)).length).toBe(1);
  await ok(p, "fluxo.criar", {
    fluxo: {
      id: "relogio",
      nome: "Relógio",
      gatilho: { tipo: "relogio", cadaS: 100 },
      trilhas: [[anuncio("tic")]],
    },
  });
  await expect.poll(() => quantasVezes(mestre.frames, "tic")).toBe(1);
  await ok(p, "fluxo.ligar", { id: "relogio", ligado: false });

  // 250 s depois: a tocha acabou, mas o relógio parado não disparou de novo
  await adiantar(request, 250_000);
  await expect.poll(async () => (await alcas(p)).length).toBe(0);
  expect(quantasVezes(mestre.frames, "tic")).toBe(1);

  // ligado de novo, o relógio segue de onde parou: faltavam uns 100 s para o próximo disparo
  await ok(p, "fluxo.ligar", { id: "relogio", ligado: true });
  await adiantar(request, 101_000);
  await expect.poll(() => quantasVezes(mestre.frames, "tic")).toBe(2);
});

test("o jogador não cria, dispara nem apaga automações", async ({ mesa }) => {
  await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const pedidos: [string, object][] = [
    ["fluxo.disparar", { id: "x" }],
    ["fluxo.apagar", { id: "x" }],
    ["fluxo.ligar", { id: "x", ligado: false }],
    [
      "fluxo.criar",
      {
        fluxo: {
          id: "x",
          nome: "X",
          gatilho: { tipo: "turno" },
          trilhas: [[anuncio("x")]],
        },
      },
    ],
  ];
  for (const [tipo, dados] of pedidos) {
    const r = await enviarCru(j1.pagina, intencaoCrua(tipo, dados));
    expect(r?.tipo).toBe("erro");
    expect(r?.dados.codigo).toBe("sem_permissao");
  }
});
