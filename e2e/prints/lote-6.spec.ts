import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, enviarCru, expect, intencaoCrua, Mesa } from "../tests/ajudas";
import { entrarNoMapa, esperarPosicao, type GanchoDoMapa } from "../tests/ajudasMapa";

// Prints do Lote 6 (luz, visão no escuro e memória do mapa), em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints
// A semente tem a Cena inicial com luz ambiente 0,1, a tocha da sala (11,25; 30) e o braseiro (27; 9,75).
// Aldric (jogador-1) tem visão no escuro de 18 m; Brisa (jogador-2) e Cael não.

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

const lembradas = (p: Page) =>
  p.evaluate(
    () => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.memoria().lembradas,
  );

async function levar(mestre: Page, id: string, x: number, y: number) {
  const r = await enviarCru(mestre, intencaoCrua("token.soltar", { id, x, y }));
  expect(r?.tipo).toBe("evento");
}

/** Recolhe a barra lateral (o chat cobre metade do mapa nos prints). */
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
  // dá tempo de o véu e a memória assentarem
  await p.waitForTimeout(700);
}

async function foto(p: Page, nome: string) {
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

test("1 e 2: o jogador numa cena escura com uma luz fixa, sem e com visão no escuro", async ({
  grande,
}) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  // Brisa (sem visão no escuro) ao lado do braseiro; Aldric (visão no escuro de 18 m) um pouco atrás.
  await levar(mestre.pagina, "tok-jogador-2", 24, 9.75);
  await levar(mestre.pagina, "tok-jogador-3", 30, 12);
  await levar(mestre.pagina, "tok-jogador-1", 12, 9.75);
  const brisa = await entrarNoMapa(grande, "jogador-2");
  await esperarPosicao(brisa.pagina, "tok-jogador-2", 24, 9.75);
  await recolherLateral(brisa.pagina);
  await enquadrar(brisa.pagina, 24, 9.75);
  await foto(brisa.pagina, "01-jogador-cena-escura-com-luz-fixa");

  const aldric = await entrarNoMapa(grande, "jogador-1");
  await esperarPosicao(aldric.pagina, "tok-jogador-1", 12, 9.75);
  await recolherLateral(aldric.pagina);
  await enquadrar(aldric.pagina, 18, 9.75);
  await foto(aldric.pagina, "02-jogador-visao-no-escuro-cinza");
});

test("3: a memória do mapa (o jogador fora da sala, a sala escurecida)", async ({ grande }) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  const aldric = await entrarNoMapa(grande, "jogador-1");
  await recolherLateral(aldric.pagina);
  // dentro da sala (acesa pela tocha), onde ele vê e passa a lembrar
  await levar(mestre.pagina, "tok-jogador-1", 11.25, 29.25);
  await esperarPosicao(aldric.pagina, "tok-jogador-1", 11.25, 29.25);
  await enquadrar(aldric.pagina, 11.25, 27, 1);
  await expect.poll(() => lembradas(aldric.pagina)).toBeGreaterThan(200);
  // abre a porta do alto e sai por ela, para o corredor de cima
  await enviarCru(mestre.pagina, intencaoCrua("porta.alternar", { id: "par-sala-porta" }));
  await levar(mestre.pagina, "tok-jogador-1", 11.25, 21.75);
  await esperarPosicao(aldric.pagina, "tok-jogador-1", 11.25, 21.75);
  await enviarCru(mestre.pagina, intencaoCrua("porta.alternar", { id: "par-sala-porta" }));
  await enquadrar(aldric.pagina, 11.25, 24, 1);
  await foto(aldric.pagina, "03-memoria-do-mapa");
});

test("4 a 6: painel de fontes de luz (aberto e recolhido) e configurações", async ({ grande }) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  const p = mestre.pagina;
  await recolherLateral(p);
  await levar(p, "tok-jogador-1", 11.25, 29.25);
  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-fontes").click();
  await expect(p.getByTestId("painel-fontes")).toBeVisible();
  await p.getByTestId("luz-escolher-luz-braseiro").click();
  await expect(p.getByTestId("luz-editor")).toBeVisible();
  await enquadrar(p, 20, 18, 0.8);
  await foto(p, "04-painel-de-fontes-de-luz");

  await p.getByTestId("painel-fontes-cabecalho").dblclick();
  await expect(p.getByTestId("painel-fontes-corpo")).toHaveCount(0);
  await foto(p, "05-painel-recolhido");
  await p.getByTestId("painel-fontes-cabecalho").dblclick();
  await p.getByTestId("painel-fontes-fechar").click();

  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-config").click();
  await expect(p.getByTestId("painel-config-iluminacao")).toBeVisible();
  await foto(p, "06-configuracoes-de-iluminacao");
});

test("7 e 8: visão noturna do mestre e a lista da lanterna", async ({ grande }) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  const p = mestre.pagina;
  await recolherLateral(p);
  await levar(p, "tok-jogador-1", 11.25, 29.25);
  await levar(p, "tok-jogador-2", 24, 9.75);
  await levar(p, "tok-jogador-3", 30, 12);
  await expect(p.getByTestId("menu-visao-noturna")).toHaveAttribute("aria-pressed", "true");
  await enquadrar(p, 20, 20, 0.7);
  await foto(p, "07-visao-noturna-do-mestre");

  await p.getByTestId("menu-iluminacao").click();
  await expect(p.getByTestId("lanterna")).toBeVisible();
  await foto(p, "08-lanterna-iluminacao-ligada");
  await p.getByTestId("lanterna-iluminacao").click();
  await p.getByTestId("menu-iluminacao").click();
  await expect(p.getByTestId("lanterna-iluminacao-estado")).toHaveText("Desligada");
  await foto(p, "08b-lanterna-iluminacao-desligada");
});

test("fps de referência: 30 luzes e 500 paredes, arrastando o token do jogador (só informa)", async ({
  grande,
}) => {
  const mestre = await entrarNoMapa(grande, "mestre");
  // 500 paredes curtas espalhadas (200 por mensagem) e 30 luzes fixas
  const paredes = Array.from({ length: 500 }, (_, i) => {
    const x = 20 + (i % 25) * 1.6;
    const y = 2 + Math.floor(i / 25) * 2;
    return i % 2 === 0
      ? { id: `pf-${i}`, a: { x, y }, b: { x: x + 1.2, y }, tipo: "parede" }
      : { id: `pf-${i}`, a: { x, y }, b: { x, y: y + 1.2 }, tipo: "parede" };
  });
  for (let i = 0; i < paredes.length; i += 200) {
    await enviarCru(
      mestre.pagina,
      intencaoCrua("parede.criar", { paredes: paredes.slice(i, i + 200) }),
    );
  }
  for (let i = 0; i < 30; i++) {
    await enviarCru(
      mestre.pagina,
      intencaoCrua("fonte.criar", {
        fonte: {
          id: `lf-${i}`,
          nome: `Luz ${i}`,
          portador: { tipo: "cena", x: 4 + (i % 10) * 5.5, y: 5 + Math.floor(i / 10) * 12 },
          luz: { claraM: 4, penumbraM: 4, cor: "#ffb347", tremula: i % 2 === 0 },
          intensidade: 1,
          estado: "acesa",
        },
      }),
    );
  }
  const aldric = await entrarNoMapa(grande, "jogador-1");
  const p = aldric.pagina;
  await recolherLateral(p);
  await expect.poll(async () => (await luzesNaTela(p)) >= 28).toBe(true);
  await enquadrar(p, 11.25, 9.75, 1);
  const alvo = await p.evaluate(() => {
    const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
    return h.paraTela(11.25, 9.75);
  });
  await p.evaluate(() => {
    const w = window as unknown as { __quadros: number };
    w.__quadros = 0;
    const laco = () => {
      w.__quadros++;
      requestAnimationFrame(laco);
    };
    requestAnimationFrame(laco);
  });
  const inicio = Date.now();
  await p.mouse.move(alvo.x, alvo.y);
  await p.mouse.down();
  let t = 0;
  while (Date.now() - inicio < 4000) {
    t += 0.15;
    await p.mouse.move(alvo.x + Math.cos(t) * 120, alvo.y + Math.sin(t) * 120);
    await p.waitForTimeout(8);
  }
  await p.mouse.up();
  const quadros = await p.evaluate(() => (window as unknown as { __quadros: number }).__quadros);
  const fps = Math.round((quadros / (Date.now() - inicio)) * 1000);
  console.log(`[fps] 30 luzes + 500 paredes, arrastando o token: ${fps} fps`);
  await foto(p, "09-fps-30-luzes-500-paredes");
});

const luzesNaTela = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes().length);
