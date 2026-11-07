import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { abrirAba, test as base, enviarCru, expect, intencaoCrua, Mesa } from "../tests/ajudas";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "../tests/ajudasMapa";

// Prints do Lote 7 (relógio da sala, tochas, mochila, mãos, pontos), em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-7
// Aldric (jogador-1) está em 11,25; 9,75 na Cena inicial (escura: luz ambiente 0,1) e Brisa (jogador-2)
// vai para o quadrado vizinho. Ele carrega tochas da Tocha 5e (60 min).

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const test = base.extend<{ grande: Mesa }>({
  grande: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    await use(mesa);
    await mesa.fechar();
  },
});

const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";

type Alca = ReturnType<GanchoDoMapa["alcas"]>[number];
const alcas = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas());
const pontosDaTela = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.pontos());

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

/** Intenção sem evento de volta (o início de acender um inflamável é transitório): só envia. */
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

async function recolherLateral(p: Page) {
  await p.getByTestId("lateral-recolher").click();
  await expect(p.getByTestId("barra-lateral")).toHaveAttribute("data-aberta", "false");
}

async function enquadrar(p: Page, x: number, y: number, zoom = 1) {
  await p.evaluate(
    ([zx, zy, zz]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.definirZoom(zz as number);
      h.centrarEm(zx as number, zy as number);
    },
    [x, y, zoom],
  );
  await p.waitForTimeout(700);
}

async function foto(p: Page, nome: string) {
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

async function adiantar(request: APIRequestContext, ms: number) {
  const r = await request.post(`/teste/avancar-relogio?ms=${ms}`);
  expect(r.ok()).toBe(true);
}

/** Tochas na mochila do Aldric, a Brisa ao lado e dois pontos de luz perto dele. */
async function cenario(mestre: Page) {
  await ok(mestre, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 4 });
  await ok(mestre, "token.soltar", { id: "tok-jogador-2", x: 12.75, y: 11.25 });
  await ok(mestre, "ponto.criar", {
    ponto: {
      id: "lenha",
      nome: "Lenha seca",
      x: 12.75,
      y: 8.25,
      tipo: "inflamavel",
      modeloId: "modelo-fogueira",
      segurarS: 3,
      visivelParaJogadores: true,
    },
  });
  await ok(mestre, "ponto.criar", {
    ponto: {
      id: "gancho",
      nome: "Suporte da parede",
      x: 9.75,
      y: 8.25,
      tipo: "suporte",
      capacidade: 1,
      visivelParaJogadores: true,
    },
  });
}

test("1 a 5: tocha na mão, duas tochas, segurando sobre o inflamável, fogueira e suporte", async ({
  grande,
  request,
}) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  await cenario(mestre.pagina);
  const aldric = await entrarNoMapa(grande, "jogador-1");
  const p = aldric.pagina;
  await recolherLateral(p);
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-1" });
  await adiantar(request, 740_000); // 12 min e 20 s: restam 47:40
  await expect.poll(async () => (await alcas(p)).length).toBe(1);
  await enquadrar(p, 11.25, 9.75, 1.6);
  await foto(p, "01-jogador-tocha-acesa-na-mao-com-tempo");

  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-2" });
  await expect.poll(async () => (await alcas(p)).length).toBe(2);
  await enquadrar(p, 11.25, 9.75, 1.6);
  await foto(p, "02-duas-tochas-nas-duas-maos");
  await ok(p, "tocha.guardar", { id: "tocha-2" });
  await expect.poll(async () => (await alcas(p)).length).toBe(1);

  // segura a tocha sobre a lenha: o anel enche
  await enquadrar(p, 11.25, 9.75, 1.6);
  const maoEsquerda = (await alcas(p))[0] as Alca;
  const lenha = (await pontosDaTela(p)).find((x) => x.id === "lenha") as { x: number; y: number };
  await p.mouse.move(maoEsquerda.x, maoEsquerda.y);
  await p.mouse.down();
  await p.mouse.move(lenha.x, lenha.y, { steps: 12 });
  await p.waitForTimeout(1600);
  await foto(p, "03-segurando-a-tocha-sobre-o-inflamavel-anel");
  await p.mouse.up();
  await p.waitForTimeout(3300); // deixa a contagem velha acabar

  // de novo, até o fim: a fogueira acende
  await p.mouse.move(maoEsquerda.x, maoEsquerda.y);
  await p.mouse.down();
  await p.mouse.move(lenha.x, lenha.y, { steps: 12 });
  await expect
    .poll(async () => (await alcas(p)).filter((a) => a.portador === "ponto").length, {
      timeout: 8000,
    })
    .toBe(1);
  await p.mouse.up();
  await enquadrar(p, 11.25, 9.75, 1.6);
  await foto(p, "04-fogueira-acesa-no-ponto");

  // a tocha vai para o suporte
  const mao = (await alcas(p)).find((a) => a.portador === "mao") as Alca;
  const gancho = (await pontosDaTela(p)).find((x) => x.id === "gancho") as { x: number; y: number };
  await p.mouse.move(mao.x, mao.y);
  await p.mouse.down();
  await p.mouse.move(gancho.x, gancho.y, { steps: 12 });
  await p.mouse.up();
  await expect
    .poll(async () => (await alcas(p)).filter((a) => a.portador === "ponto").length)
    .toBe(2);
  await enquadrar(p, 11.25, 9.75, 1.6);
  await foto(p, "05-tocha-no-suporte");
});

test("6 e 7: painel de fontes do mestre com as variáveis e o detalhe com histórico", async ({
  grande,
  request,
}) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  const p = mestre.pagina;
  await cenario(p);
  const aldric = await entrarNoMapa(grande, "jogador-1");
  await ok(aldric.pagina, "tocha.acender", {
    personagemId: ALDRIC,
    modeloId: TOCHA,
    novoId: "tocha-1",
  });
  await ok(p, "mochila.ajustar", { personagemId: "pers-brisa", modeloId: TOCHA, delta: 2 });
  await ok(p, "tocha.acender", { personagemId: "pers-brisa", modeloId: TOCHA, novoId: "tocha-b" });
  await ok(p, "ponto.criar", {
    ponto: {
      id: "braseiro",
      nome: "Braseiro velho",
      x: 9.75,
      y: 11.25,
      tipo: "inflamavel",
      modeloId: "modelo-fogueira",
      segurarS: 0,
      visivelParaJogadores: true,
    },
  });
  // a fogueira do braseiro: a tocha do Aldric acesa em cima dele, sem espera (segurarS 0)
  await mandar(p, "ponto.acenderInicio", { pontoId: "braseiro", objetoId: "tocha-1" });
  await ok(p, "ponto.acenderFim", { pontoId: "braseiro", objetoId: "tocha-1" });
  await adiantar(request, 1_500_000);
  await recolherLateral(p);
  await enquadrar(p, 11.25, 9.75, 1.2);
  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-fontes").click();
  await expect(p.getByTestId("luz-tocha-1")).toBeVisible();
  // um ajuste de +1 min e um modificador, para o histórico ter o que mostrar
  await p.getByTestId("luz-mais-tocha-1").click();
  await ok(p, "objeto.ajustar", {
    id: "tocha-1",
    ajuste: {
      acao: "modificar",
      modificador: { id: "m-vento", raioX: 0.5, duracaoMs: 300_000, nota: "ventania" },
    },
  });
  await p.getByTestId("luz-menos-tocha-1").click();
  await p.getByTestId("luz-menos-tocha-1").click();
  await p.getByTestId("luz-mais-tocha-1").click();
  await p.waitForTimeout(700);
  await foto(p, "06-painel-de-fontes-com-variaveis");

  await p.getByTestId("luz-escolher-tocha-1").click();
  await expect(p.getByTestId("luz-detalhe")).toBeVisible();
  await p.getByTestId("luz-detalhe").scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await foto(p, "07-detalhe-com-historico-e-modificadores");
});

test("8 e 9: mochila no editor do item e as configurações da mesa e dos modelos", async ({
  grande,
}) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  const p = mestre.pagina;
  await cenario(p);
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-1" });
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-2" });
  await ok(p, "tocha.guardar", { id: "tocha-2" });
  const aldric = await entrarNoMapa(grande, "jogador-1");
  await abrirAba(aldric.pagina, "fichas");
  await aldric.pagina.getByTestId("aba-painel-fichas").getByText("Aldric").first().dblclick();
  await aldric.pagina.getByTestId("ficha-aba-equipamento").click();
  await expect(aldric.pagina.getByTestId("mochila-resumo-modelo-tocha")).toHaveText(
    "2 novas, 2 usadas",
  );
  await foto(aldric.pagina, "08-mochila-no-editor-do-item-jogador");
  await abrirAba(p, "fichas");
  await p.getByTestId("aba-painel-fichas").getByText("Aldric").first().dblclick();
  await p.getByTestId("ficha-aba-equipamento").click();
  await expect(p.getByTestId("mochila-menos-modelo-tocha")).toBeVisible();
  await foto(p, "08b-mochila-no-editor-do-item-mestre");
  await p.getByTestId("janela-ficha-fechar").click();

  await abrirAba(p, "configuracoes");
  await expect(p.getByTestId("config-mesa")).toBeVisible();
  await p.waitForTimeout(300);
  await foto(p, "09-configuracoes-da-mesa");
  await p.getByTestId("modelo-modelo-tocha").locator("summary").click();
  await p.getByTestId("config-objetos").scrollIntoViewIfNeeded();
  await p.getByTestId("modelo-modelo-tocha").scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await foto(p, "09b-modelos-de-objeto-de-luz");
});

test("10: mesa pausada (visão do mestre e do jogador)", async ({ grande }) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  const p = mestre.pagina;
  await cenario(p);
  const aldric = await entrarNoMapa(grande, "jogador-1");
  await recolherLateral(aldric.pagina);
  await recolherLateral(p);
  await ok(aldric.pagina, "tocha.acender", {
    personagemId: ALDRIC,
    modeloId: TOCHA,
    novoId: "tocha-1",
  });
  await enquadrar(aldric.pagina, 11.25, 9.75, 1.4);
  await enquadrar(p, 11.25, 9.75, 1.4);
  await p.getByTestId("menu-pausa").click();
  await expect(aldric.pagina.getByTestId("selo-pausa")).toBeVisible();
  await expect(p.getByTestId("selo-pausa")).toBeVisible();
  await p.waitForTimeout(800);
  await foto(p, "10-mesa-pausada-mestre");
  await foto(aldric.pagina, "10b-mesa-pausada-jogador");
  const alvo = await pontoNaPagina(p, 11.25, 9.75);
  expect(alvo.x).toBeGreaterThan(0);
});
