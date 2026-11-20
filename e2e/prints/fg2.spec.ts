import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { arquivoPng, definirMapa, pngDeCor } from "../tests/ajudasAssets";
import { mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, type GanchoDoMapa } from "../tests/ajudasMapa";

// Prints do lote FG2 (fogo melhor, tocha na mão com estágios, cor da luz do mestre): a fogueira em dois tamanhos, a tocha no
// suporte em vários quadros, o token com a tocha na mão nos 3 estágios, a luz colorida vista pelo mestre e pelo jogador.
// Só Grimório (1600x900 e 1280x720) e Pergaminho (claro, 1600x900). Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints fg2

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const VARIANTES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const falhas: string[] = [];
async function tentar(nome: string, passo: () => Promise<void>) {
  try {
    await passo();
  } catch (e) {
    const msg = (e as Error).message.split("\n").slice(0, 3).join(" | ");
    falhas.push(`${nome}: ${msg}`);
    console.log(`[FALHOU] ${nome}: ${msg}`);
  }
}
base.afterAll(() => {
  if (falhas.length) console.log(`[FG2] FALHAS:\n - ${falhas.join("\n - ")}`);
});

type Recorte = { x: number; y: number; width: number; height: number };
const foto = async (p: Page, nome: string, espera = 400, clip?: Recorte) => {
  await p.waitForTimeout(espera);
  await p.screenshot({
    path: join(PASTA as string, `${nome}.png`),
    ...(clip ? { clip } : {}),
  });
};

const gancho = <T>(p: Page, f: (h: GanchoDoMapa) => T) =>
  p.evaluate(
    ([corpo]) =>
      (new Function("h", `return (${corpo})(h)`) as (h: unknown) => unknown)(
        (window as unknown as { __tabletop: unknown }).__tabletop,
      ),
    [f.toString()],
  ) as Promise<T>;

async function mandarCru(p: Page, tipo: string, dados: object) {
  await p.evaluate(
    ([t, d]) =>
      new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
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

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const ponto = (id: string, nome: string, x: number, y: number, extra: object = {}) => ({
  id,
  nome,
  x,
  y,
  visivelParaJogadores: true,
  ...extra,
});

/** Centra o mapa num ponto, no zoom pedido, e devolve onde ele fica na página. */
const olhar = (p: Page, z: number, x: number, y: number) =>
  p.evaluate(
    ([zz, xx, yy]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.definirZoom(zz as number);
      h.centrarEm(xx as number, yy as number);
      return h.paraTela(xx as number, yy as number);
    },
    [z, x, y],
  );

const quadrado = (c: { x: number; y: number }, lado: number): Recorte => ({
  x: Math.max(0, Math.round(c.x - lado / 2)),
  y: Math.max(0, Math.round(c.y - lado / 2)),
  width: lado,
  height: lado,
});

for (const v of VARIANTES) {
  base(`fg2 ${v.tema} ${v.nome}`, async ({ browser, request }) => {
    base.setTimeout(400_000);
    // o movimento ligado: os prints mostram a chama de verdade (os E2E rodam com "reduzir movimento")
    const mesa = new Mesa(browser, {
      viewport: { width: v.width, height: v.height },
      reducedMotion: "no-preference",
    });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${v.tema}-${v.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, v.tema);
      // um mapa claro, para a cor da luz aparecer (o chão escuro quase não mostra o tom)
      await definirMapa(
        m,
        "cena-1",
        arquivoPng("claro.png", pngDeCor(900, 700, [205, 198, 180])),
        50,
      );
      if (await m.getByTestId("faixa-cenas").isVisible()) await m.getByTestId("menu-cenas").click();

      // a cena na penumbra: é a luz das chamas que mostra o chão (e a cor delas)
      await mandarCru(m, "cena.configurarIluminacao", { luzAmbiente: 0.12 });

      // Aldric (11,25; 9,75) com uma tocha na mão e outra no suporte; uma fogueira de tamanho padrão, uma grande
      // (a palha, esticada) e a Brisa com a tocha dela.
      await mandar(m, "mochila.ajustar", {
        personagemId: "pers-aldric",
        modeloId: "modelo-tocha",
        delta: 3,
      });
      await mandar(m, "mochila.ajustar", {
        personagemId: "pers-brisa",
        modeloId: "modelo-tocha",
        delta: 1,
      });
      await mandar(m, "ponto.criar", {
        ponto: ponto("gancho", "Gancho", 14.25, 9.75, { tipo: "suporte" }),
      });
      for (const [id, x, y, extra] of [
        ["fogueira", 12.75, 8.25, { segurarS: 0 }],
        ["palha", 9.75, 8.25, { segurarS: 0, chamaM: { larguraM: 4.5, alturaM: 2.4 } }],
      ] as const) {
        await mandar(m, "ponto.criar", {
          ponto: ponto(id, id, x, y, { tipo: "inflamavel", modeloId: "modelo-fogueira", ...extra }),
        });
      }
      await mandar(m, "tocha.acender", {
        personagemId: "pers-aldric",
        modeloId: "modelo-tocha",
        novoId: "tocha-1",
      });
      await mandar(m, "tocha.acender", {
        personagemId: "pers-aldric",
        modeloId: "modelo-tocha",
        novoId: "tocha-2",
      });
      await mandar(m, "tocha.acender", {
        personagemId: "pers-brisa",
        modeloId: "modelo-tocha",
        novoId: "tocha-b",
      });
      for (const alvo of ["fogueira", "palha"]) {
        await mandarCru(m, "ponto.acenderInicio", { pontoId: alvo, objetoId: "tocha-1" });
        await mandarCru(m, "ponto.acenderFim", { pontoId: alvo, objetoId: "tocha-1" });
      }
      await mandar(m, "tocha.posar", { id: "tocha-2", pontoId: "gancho" });
      await expect.poll(() => gancho(m, (h) => h.chamas().length)).toBeGreaterThanOrEqual(3);

      await tentar(`${rotulo} fogueira em dois tamanhos`, async () => {
        await olhar(m, 2, 11.5, 8.25);
        await foto(m, `fg2-${rotulo}-1-fogueiras-dois-tamanhos`, 600);
        const f1 = await olhar(m, 5, 12.75, 8.25);
        await foto(m, `fg2-${rotulo}-2-fogueira-pequena-de-perto`, 500, quadrado(f1, 420));
        const f2 = await olhar(m, 3.2, 9.75, 8.25);
        await foto(m, `fg2-${rotulo}-3-fogueira-grande-de-perto`, 500, quadrado(f2, 620));
      });

      await tentar(`${rotulo} tocha no suporte`, async () => {
        const c = await olhar(m, 6, 14.25, 9.75);
        for (let i = 0; i < 6; i++) {
          await foto(m, `fg2-${rotulo}-4-suporte-quadro${i + 1}`, 130, quadrado(c, 260));
        }
      });

      await tentar(`${rotulo} tocha na mao`, async () => {
        const c = await olhar(m, 5, 11.25, 9.75);
        await foto(m, `fg2-${rotulo}-5-mao-forte`, 400, quadrado(c, 240));
        await request.post(`/teste/avancar-relogio?ms=${35 * 60_000}`);
        await expect
          .poll(async () => (await gancho(m, (h) => h.chamasDaMao()))[0]?.estagio)
          .toBe("fraca");
        await foto(
          m,
          `fg2-${rotulo}-6-mao-fraca`,
          400,
          quadrado(await olhar(m, 5, 11.25, 9.75), 240),
        );
        await request.post(`/teste/avancar-relogio?ms=${20 * 60_000}`);
        await expect
          .poll(async () => (await gancho(m, (h) => h.chamasDaMao()))[0]?.estagio)
          .toBe("morrendo");
        await foto(
          m,
          `fg2-${rotulo}-7-mao-morrendo`,
          400,
          quadrado(await olhar(m, 5, 11.25, 9.75), 240),
        );
      });

      await tentar(`${rotulo} mapa geral`, async () => {
        await olhar(m, 1.2, 14, 9);
        await foto(m, `fg2-${rotulo}-10-geral`, 600);
      });
    } finally {
      await mesa.fechar();
    }
  });
}

for (const v of VARIANTES) {
  base(`fg2 cor ${v.tema} ${v.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, {
      viewport: { width: v.width, height: v.height },
      reducedMotion: "no-preference",
    });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${v.tema}-${v.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, v.tema);
      await definirMapa(
        m,
        "cena-1",
        arquivoPng("claro.png", pngDeCor(900, 700, [205, 198, 180])),
        50,
      );
      if (await m.getByTestId("faixa-cenas").isVisible()) await m.getByTestId("menu-cenas").click();
      // só a tocha da Brisa (sem visão no escuro) numa cena escura: o mestre e a jogadora veem o mesmo tom
      await mandarCru(m, "cena.configurarIluminacao", { luzAmbiente: 0.12 });
      await mandar(m, "mochila.ajustar", {
        personagemId: "pers-brisa",
        modeloId: "modelo-tocha",
        delta: 1,
      });
      await mandar(m, "tocha.acender", {
        personagemId: "pers-brisa",
        modeloId: "modelo-tocha",
        novoId: "tocha-b",
      });
      const j2 = await entrarNoMapa(mesa, "jogador-2");
      for (const [cor, nome] of [
        ["#ffb347", "a-laranja"],
        ["#3d8bff", "b-azul"],
      ] as const) {
        await tentar(`${rotulo} luz ${nome}`, async () => {
          await mandarCru(m, "modelo.editar", {
            id: "modelo-tocha",
            mudancas: { luz: { cor } },
          });
          await olhar(m, 0.9, 13.5, 11.25);
          await olhar(j2.pagina, 0.9, 13.5, 11.25);
          await foto(m, `fg2-${rotulo}-8${nome}-mestre`, 900);
          await foto(j2.pagina, `fg2-${rotulo}-8${nome}-jogador`, 200);
        });
      }
      await tentar(`${rotulo} tocha fora da visao dos jogadores`, async () => {
        // o mapa maior (20 px por metro) para ter chão onde nenhum jogador vê
        await definirMapa(
          m,
          "cena-1",
          arquivoPng("claro-grande.png", pngDeCor(900, 700, [205, 198, 180])),
          20,
        );
        if (await m.getByTestId("faixa-cenas").isVisible())
          await m.getByTestId("menu-cenas").click();
        await mandar(m, "mochila.ajustar", {
          personagemId: "pers-aldric",
          modeloId: "modelo-tocha",
          delta: 1,
        });
        await mandar(m, "ponto.criar", {
          ponto: ponto("longe", "Gancho longe", 45, 30, { tipo: "suporte" }),
        });
        await mandar(m, "tocha.acender", {
          personagemId: "pers-aldric",
          modeloId: "modelo-tocha",
          novoId: "tocha-longe",
        });
        await mandar(m, "tocha.posar", { id: "tocha-longe", pontoId: "longe" });
        await olhar(m, 0.9, 45, 30);
        await foto(m, `fg2-${rotulo}-8c-tocha-fora-da-visao-mestre`, 900);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
