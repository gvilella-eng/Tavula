import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  test as base,
  CAMINHO_DA_MESA,
  enviarCru,
  expect,
  intencaoCrua,
  Mesa,
} from "../tests/ajudas";
import { arquivoPng, definirMapa, pngDeCor } from "../tests/ajudasAssets";
import { entrarNoMapa, soSelecionarToken, tokenDe } from "../tests/ajudasMapa";

// Prints do lote R6a (teclado, dicas com atalho, foco e contraste), nos temas Grimório, Edgerunner e Pergaminho,
// em 1600×900 e 1280×720. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints r6a

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

async function foto(p: Page, nome: string, espera = 400) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

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
  console.log(`[R6a] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[R6a] FALHAS:\n - ${falhas.join("\n - ")}`);
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

type GanchoCentro = { __tabletop: { centrarEm(x: number, y: number): void } };
const centrar = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([a, b]) => (window as unknown as GanchoCentro).__tabletop.centrarEm(a as number, b as number),
    [x, y],
  );

for (const tamanho of TAMANHOS) {
  for (const tema of TEMAS) {
    base(`teclado ${tema} ${tamanho.nome}`, async ({ browser, request }) => {
      base.setTimeout(300_000);
      const mesa = new Mesa(browser, {
        viewport: { width: tamanho.width, height: tamanho.height },
      });
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const rotulo = `${tema}-${tamanho.nome}`;
        const ms = await entrarNoMapa(mesa, "mestre");
        const m = ms.pagina;
        await escolherTema(m, tema);

        await tentar(`${rotulo} dica topo`, async () => {
          await m.getByTestId("menu-camadas").hover();
          await expect(m.getByTestId("dica-menu-camadas")).toBeVisible();
          await foto(m, `${rotulo}-01-dica-topo`);
          await m.mouse.move(700, 500);
        });
        await tentar(`${rotulo} dica barra esquerda`, async () => {
          await m.getByTestId("ferramenta-selecionar").focus();
          await m.keyboard.press("Tab");
          await m.keyboard.press("Tab");
          await expect(m.getByTestId("dica-ferramenta-regua")).toBeVisible();
          await foto(m, `${rotulo}-02-dica-barra-esquerda-foco`);
        });
        await tentar(`${rotulo} dica janela`, async () => {
          await m.getByTestId("menu-ordem-turno").click();
          await expect(m.getByTestId("janela-ordem")).toBeVisible();
          await m.getByTestId("janela-ordem").getByRole("toolbar").focus();
          await expect(m.getByTestId("dica-janela-ordem-cabecalho")).toBeVisible();
          await foto(m, `${rotulo}-03-dica-janela-cabecalho`);
          await m.getByTestId("janela-ordem-fechar").focus();
          await foto(m, `${rotulo}-04-foco-botao-da-janela`);
          await m.getByTestId("menu-ordem-turno").click();
        });
        await tentar(`${rotulo} atalhos`, async () => {
          await m.getByTestId("aba-preferencias").click();
          await m.getByTestId("atalhos").evaluate((el) => el.scrollIntoView({ block: "start" }));
          await foto(m, `${rotulo}-05-lista-de-atalhos`);
          await m.getByTestId("aba-chat").click();
        });
        await tentar(`${rotulo} menu do token por teclado`, async () => {
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
          await soSelecionarToken(m, "tok-jogador-1");
          await m.getByTestId("mapa").focus();
          await m.keyboard.press("Shift+F10");
          await expect(m.getByTestId("menu-token")).toBeVisible();
          await m.getByTestId("condicao-cego").focus();
          await foto(m, `${rotulo}-06-menu-do-token-teclado`);
          await m.keyboard.press("Escape");
        });
        await tentar(`${rotulo} aneis de foco`, async () => {
          await m.keyboard.press("Tab");
          for (const id of ["aba-chat", "zoom-mais", "presenca-mais"]) {
            await m.getByTestId(id).focus();
            await foto(m, `${rotulo}-07-foco-${id}`, 200);
          }
          await m.getByTestId("mapa").focus();
          await foto(m, `${rotulo}-08-foco-mapa`, 200);
        });
        // a visão noturna do mestre escurece tudo: desliga para ver as cores dos tokens e dos rótulos como são
        await tentar(`${rotulo} visão noturna off`, async () => {
          const b = m.getByTestId("menu-visao-noturna");
          if ((await b.getAttribute("aria-pressed")) === "true") await b.click();
        });
        await tentar(`${rotulo} tokens claros e escuros`, async () => {
          for (const [id, nome, cor, x] of [
            ["pr-claro", "Lia Clara", "#fff3b0", 30],
            ["pr-escuro", "Noe Noite", "#1b2a49", 32],
            ["pr-amarelo", "Ana Ouro", "#f5c542", 34],
          ] as const) {
            await ok(m, "token.criar", {
              token: {
                id,
                nome,
                cor,
                tamanhoQuadrados: 1,
                x,
                y: 30,
                camada: "tokens",
                oculto: false,
                controladoPor: [],
              },
            });
          }
          await expect
            .poll(async () => (await tokenDe(m, "pr-escuro").catch(() => null))?.id)
            .toBe("pr-escuro");
          await centrar(m, 32, 30);
          await foto(m, `${rotulo}-09-tokens-cores-claras-e-escuras`);
        });
        // rótulos do mapa sobre mapa claro e sobre mapa escuro
        for (const [nome, rgb] of [
          ["claro", [235, 230, 215]],
          ["escuro", [20, 22, 30]],
        ] as const) {
          await tentar(`${rotulo} mapa ${nome}`, async () => {
            await definirMapa(
              m,
              "cena-1",
              arquivoPng(`${nome}.png`, pngDeCor(900, 700, [rgb[0], rgb[1], rgb[2]])),
              50,
            );
            if (nome === "claro") {
              await ok(m, "token.condicoes", { id: "tok-ogro", condicoes: ["caido", "cego"] });
            }
            if (await m.getByTestId("faixa-cenas").isVisible())
              await m.getByTestId("menu-cenas").click();
            const t = await tokenDe(m, "tok-ogro");
            await centrar(m, t.x, t.y);
            await foto(m, `${rotulo}-10-rotulos-mapa-${nome}`, 1200);
          });
        }
      } finally {
        await mesa.fechar();
      }
    });
  }
}

// a tela de entrada mostra os 8 avatares com texto claro ou escuro conforme a cor do usuário
for (const tema of TEMAS) {
  base(`entrada ${tema}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript((t) => localStorage.setItem("tabletop:pref:tema", t), tema);
    await page.goto(CAMINHO_DA_MESA);
    await expect(page.getByTestId("entrar-mestre")).toBeVisible();
    await foto(page, `${tema}-1280x720-00-entrada-avatares`);
  });
}
