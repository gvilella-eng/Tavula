import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, enviarCru, expect, intencaoCrua, Mesa } from "../tests/ajudas";
import { menuDoToken } from "../tests/ajudasCombate";
import {
  centrarNoToken,
  entrarNoMapa,
  type GanchoDoMapa,
  PX_POR_M,
  pontoNaPagina,
  tokenDe,
} from "../tests/ajudasMapa";

// Prints do lote R5a do redesign (interações no mapa e nos tokens), nos temas Grimório, Edgerunner e
// Pergaminho, em 1600×900 e 1280×720: o formulário de novo token, o modo de pôr com a prévia, o menu do token
// (grupo Tocha e condições), os marcadores maiores com a regra aberta por clique, a dica da alça da tocha,
// a régua fixa, um aviso perto do clique e o estado vazio do jogador sem token. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints r5a

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const TEMAS = ["grimorio", "escuro", "claro"] as const;
const TAMANHOS = [
  { nome: "1600x900", width: 1600, height: 900 },
  { nome: "1280x720", width: 1280, height: 720 },
] as const;

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

/** Roda um passo; se falhar, registra e segue (um print que falha não derruba os outros). */
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
  console.log(`[R5a] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[R5a] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

for (const tamanho of TAMANHOS) {
  for (const tema of TEMAS) {
    base(`interacoes ${tema} ${tamanho.nome}`, async ({ browser, request }) => {
      base.setTimeout(300_000);
      const mesa = new Mesa(browser, {
        viewport: { width: tamanho.width, height: tamanho.height },
      });
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const ms = await entrarNoMapa(mesa, "mestre");
        const m = ms.pagina;
        const rotulo = `${tema}-${tamanho.nome}`;
        await escolherTema(m, tema);

        // um personagem com tocha acesa e um token com condições
        await ok(m, "mochila.ajustar", {
          personagemId: "pers-aldric",
          modeloId: "modelo-tocha",
          delta: 2,
        });
        await ok(m, "tocha.acender", {
          personagemId: "pers-aldric",
          modeloId: "modelo-tocha",
          novoId: "tocha-1",
        });
        await ok(m, "token.condicoes", {
          id: "tok-ogro",
          condicoes: ["caido", "cego", "envenenado"],
          exaustao: 2,
        });
        await expect.poll(async () => (await tokenDe(m, "tok-ogro")).marcas.length).toBe(4);

        // 1 e 2: o formulário de novo token e o modo de pôr, com a prévia sob o cursor
        await tentar(`${rotulo} novo token`, async () => {
          await m.getByTestId("novo-token").click();
          await m.getByTestId("novo-token-nome").fill("Goblin Arqueiro");
          await m.getByTitle("Laranja").click();
          await foto(m, `${rotulo}-01-novo-token-formulario`);
          await m.getByTestId("novo-token-nome").press("Enter");
          const caixa = await m.getByTestId("mapa").boundingBox();
          if (!caixa) throw new Error("sem mapa");
          await m.mouse.move(caixa.x + caixa.width * 0.45, caixa.y + caixa.height * 0.55, {
            steps: 5,
          });
          await foto(m, `${rotulo}-02-pondo-token`);
          await m.keyboard.press("Escape");
        });

        // 3: o menu do botão direito no token, com o grupo Tocha e as condições
        await tentar(`${rotulo} menu do token`, async () => {
          await menuDoToken(m, "tok-jogador-1");
          await m.getByTestId("condicao-caido").click();
          await m.getByTestId("condicao-cego").click();
          await foto(m, `${rotulo}-03-menu-do-token`);
          await m.keyboard.press("Escape");
        });

        // 4: os marcadores maiores e a regra aberta por clique
        await tentar(`${rotulo} regra`, async () => {
          const t = await tokenDe(m, "tok-ogro");
          const alvo = await m.evaluate(
            ([x, y]) => {
              const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
              h.centrarEm(x as number, y as number);
              return h.marcaNaPagina("tok-ogro", 1);
            },
            [t.x, t.y],
          );
          if (!alvo) throw new Error("sem marcador");
          await m.mouse.click(alvo.x, alvo.y);
          await expect(m.getByTestId("regra-condicao")).toBeVisible();
          await foto(m, `${rotulo}-04-marcadores-e-regra`);
          await m.keyboard.press("Escape");
        });

        // 5: a dica da alça da tocha
        await tentar(`${rotulo} dica da tocha`, async () => {
          await centrarNoToken(m, "tok-jogador-1");
          const alca = await m.evaluate(() =>
            (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas(),
          );
          const a = alca[0];
          if (!a) throw new Error("sem alça");
          await m.mouse.move(a.x, a.y, { steps: 4 });
          await expect(m.getByTestId("dica-tocha")).toBeVisible();
          await foto(m, `${rotulo}-05-dica-da-tocha`);
          await m.mouse.move(a.x + 200, a.y + 200);
        });

        // 6: a régua fixa (uma fixa e uma solta com o botão Fixar)
        await tentar(`${rotulo} régua`, async () => {
          await m.getByTestId("ferramenta-regua").click();
          const ini = await m.evaluate(() => {
            const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
            h.centrarEm(24, 24);
            return h.paraTela(24.75, 24.75);
          });
          const medir = async (x0: number, y0: number, dx: number, dy: number, shift: boolean) => {
            await m.mouse.move(x0, y0);
            await m.mouse.down();
            await m.mouse.move(x0 + dx * PX_POR_M, y0 + dy * PX_POR_M, { steps: 6 });
            if (shift) await m.keyboard.down("Shift");
            await m.mouse.up();
            if (shift) await m.keyboard.up("Shift");
          };
          await medir(ini.x - 160, ini.y - 100, 6, 0, true);
          await medir(ini.x - 160, ini.y + 20, 4.5, 3, false);
          await expect(m.getByTestId("regua-fixar")).toBeVisible();
          await foto(m, `${rotulo}-06-regua-fixa`);
          await m.keyboard.press("Escape");
          await m.getByTestId("ferramenta-selecionar").click();
        });

        // 7: um aviso perto do clique (o jogador longe da porta)
        await tentar(`${rotulo} aviso`, async () => {
          const js = await entrarNoMapa(mesa, "jogador-1");
          const j = js.pagina;
          await escolherTema(j, tema);
          await ok(m, "token.soltar", { id: "tok-jogador-1", x: 11.25, y: 30.75 });
          await expect.poll(async () => (await tokenDe(j, "tok-jogador-1")).y).toBe(30.75);
          const porta = await j.evaluate(() =>
            (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop
              .portas()
              .find((q) => q.id === "par-sala-porta"),
          );
          if (!porta) throw new Error("sem porta");
          await j.evaluate(
            ([x, y]) =>
              (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(
                x as number,
                y as number,
              ),
            [porta.meio.x, porta.meio.y],
          );
          const c = await pontoNaPagina(j, porta.meio.x, porta.meio.y);
          await j.mouse.click(c.x, c.y);
          await expect(j.getByTestId("aviso")).toBeVisible();
          await foto(j, `${rotulo}-07-aviso-perto-do-clique`, 300);
        });

        // 8: o jogador sem token na cena
        await tentar(`${rotulo} sem token`, async () => {
          const j4s = await entrarNoMapa(mesa, "jogador-4");
          await escolherTema(j4s.pagina, tema);
          await expect(j4s.pagina.getByTestId("sem-token")).toBeVisible();
          await foto(j4s.pagina, `${rotulo}-08-jogador-sem-token`);
        });
      } finally {
        await mesa.fechar();
      }
    });
  }
}
