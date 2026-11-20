import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirPreferencia, abrirSecaoDaMesa, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote CH3 (tela de entrar enxuta, desfoque em três níveis, gravar e transcrever): Grimório e Pergaminho (claro).
// Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints ch3.spec
// As câmeras e o microfone são os falsos do Chromium.

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

base.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

const TEMAS = ["grimorio", "claro"] as const;
const CAMINHO = (rotulo: string, nome: string) => join(PASTA as string, `${rotulo}-${nome}.png`);

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click();
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function abrirJanela(mesa: Mesa, usuario: string, tema: string) {
  const s = await entrarNoMapa(mesa, usuario);
  await s.contexto.addInitScript(() => {
    (window as unknown as { __tabletopE2E: object }).__tabletopE2E = {
      semVigiaDoDesfoque: true,
      gravacao: { falaMinimaMs: 20, fimDeFalaMs: 600, trechoMaximoMs: 3000 },
    };
  });
  await escolherTema(s.pagina, tema);
  const [janela] = await Promise.all([
    s.contexto.waitForEvent("page"),
    s.pagina.getByTestId("topo-chamada").click(),
  ]);
  await expect(janela.getByTestId("chamada-antes")).toBeVisible();
  await expect(janela.locator("html")).toHaveAttribute("data-tema", tema);
  const previa = () =>
    janela.evaluate(
      () =>
        document.querySelector<HTMLVideoElement>('[data-testid="chamada-previa-video"]')
          ?.videoWidth ?? 0,
    );
  try {
    await expect.poll(previa, { timeout: 15_000 }).toBeGreaterThan(0);
  } catch {
    await janela.screenshot({ path: CAMINHO(tema, "falha-previa") });
    await janela.reload();
    await expect(janela.getByTestId("chamada-antes")).toBeVisible();
  }
  await expect.poll(previa, { timeout: 30_000 }).toBeGreaterThan(0);
  return { s, janela };
}

for (const tema of TEMAS) {
  base(`ch3 ${tema}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const m = await abrirJanela(mesa, "mestre", tema);

      // A tela de entrar: 1920×1000, 1280×720 e estreita
      for (const t of [
        { nome: "1920x1000", w: 1920, h: 1000 },
        { nome: "1280x720", w: 1280, h: 720 },
        { nome: "estreita-420x800", w: 420, h: 800 },
      ]) {
        await m.janela.setViewportSize({ width: t.w, height: t.h });
        if (
          (await m.janela.getByTestId("chamada-fundo-desfocar").getAttribute("aria-pressed")) !==
          "true"
        ) {
          await m.janela.getByTestId("chamada-fundo-desfocar").click();
        }
        await expect(m.janela.getByTestId("chamada-fundo-nota")).not.toContainText("Carregando", {
          timeout: 60_000,
        });
        await m.janela.mouse.move(2, 2);
        await m.janela.screenshot({ path: CAMINHO(tema, `01-entrar-${t.nome}`) });
      }
      await m.janela.setViewportSize({ width: 1280, height: 720 });
      // as outras pessoas entram com o computador livre do desfoque (o Leve volta pelo menu, mais abaixo)
      await m.janela.getByTestId("chamada-fundo-nenhum").click();
      await m.janela.getByTestId("chamada-entrar").click();
      await expect(m.janela.getByTestId("chamada-janela")).toBeVisible();

      const a = await abrirJanela(mesa, "jogador-1", tema); // fica na tela de antes de entrar
      await a.janela.setViewportSize({ width: 1280, height: 720 });
      const b = await abrirJanela(mesa, "jogador-2", tema);
      await b.janela.setViewportSize({ width: 1280, height: 720 });
      await b.janela.getByTestId("chamada-entrar").click();
      await expect(m.janela.getByTestId("chamada-quadro-jogador-2")).toBeVisible();

      // o menu do desfoque
      await m.janela.getByTestId("chamada-fundo").click();
      await expect(m.janela.getByTestId("chamada-fundo-menu")).toBeVisible();
      await m.janela.mouse.move(2, 2);
      await m.janela.screenshot({ path: CAMINHO(tema, "02-menu-do-desfoque") });
      await m.janela.getByTestId("chamada-fundo-nivel-forte").click();
      await expect(m.janela.getByTestId("chamada-fundo-letra")).toHaveText("F");
      await m.janela.getByTestId("chamada-fundo").click();
      await m.janela.mouse.move(2, 2);
      await m.janela.screenshot({ path: CAMINHO(tema, "03-menu-forte-escolhido") });
      await m.janela.keyboard.press("Escape");

      // a confirmação e o aviso de gravação
      await m.janela.getByTestId("chamada-gravar").click();
      await m.janela.getByTestId("chamada-gravacao-pasta").click();
      await expect(m.janela.getByTestId("chamada-confirmar-onde")).toBeVisible();
      await m.janela.screenshot({ path: CAMINHO(tema, "04-confirmar-gravacao") });
      await m.janela.getByTestId("chamada-gravacao-comecar").click();
      await expect(m.janela.getByTestId("chamada-aviso-gravacao")).toBeVisible();
      await b.janela.getByTestId("chamada-nao-gravar").check();
      await expect(m.janela.getByTestId("chamada-gravando-mestre")).toContainText("Jogador 2");
      await expect
        .poll(
          async () => (await m.janela.getByTestId("chamada-gravando-trechos").textContent()) ?? "",
          { timeout: 60_000 },
        )
        .toMatch(/[1-9]\d* trecho/);
      await m.janela.mouse.move(2, 2);
      await m.janela.screenshot({ path: CAMINHO(tema, "05-aviso-mestre") });
      await expect(b.janela.getByTestId("chamada-aviso-gravacao")).toBeVisible();
      await b.janela.mouse.move(2, 2);
      await b.janela.screenshot({ path: CAMINHO(tema, "06-aviso-jogador") });
      await expect(a.janela.getByTestId("chamada-aviso-gravacao")).toBeVisible();
      await a.janela.screenshot({ path: CAMINHO(tema, "07-aviso-antes-de-entrar") });
      await a.janela.setViewportSize({ width: 420, height: 800 });
      await a.janela.screenshot({ path: CAMINHO(tema, "08-aviso-antes-de-entrar-estreita") });

      // parar e ver a lista na mesa
      await m.janela.getByTestId("chamada-gravar").click();
      await expect(m.janela.getByTestId("chamada-gravacao-pronta")).toBeVisible();
      await m.janela.screenshot({ path: CAMINHO(tema, "09-gravacao-pronta") });
      const arquivos = await m.janela.evaluate(() =>
        (
          window as unknown as {
            __tabletopPasta: { exportarPasta(): { caminho: string; base64: string }[] };
          }
        ).__tabletopPasta.exportarPasta(),
      );
      const texto = (s: string) => Buffer.from(s).toString("base64");
      const outra = "2026-11-19_20h30";
      await m.s.pagina.evaluate(
        ([lista, extra]) => {
          const g = (
            window as unknown as {
              __tabletopAssets: {
                simularPasta(e: string): void;
                importarPasta(l: { caminho: string; base64: string }[]): void;
              };
            }
          ).__tabletopAssets;
          g.simularPasta("autorizada");
          g.importarPasta([...lista, ...extra]);
        },
        [
          arquivos,
          [
            {
              caminho: `gravacoes/${outra}/gravacao.json`,
              base64: texto(
                JSON.stringify({
                  versao: 1,
                  inicioEpochMs: Date.UTC(2026, 10, 19, 23, 30),
                  inicioLocal: "2026-11-19 20:30",
                  fusoMin: 180,
                  pessoas: [
                    { id: "mestre", nome: "Mestre", pasta: "Mestre" },
                    {
                      id: "jogador-1",
                      nome: "Jogador 1",
                      personagem: "Thorin",
                      pasta: "Jogador 1",
                    },
                  ],
                  foraDaGravacao: [],
                  entradas: [],
                }),
              ),
            },
            {
              caminho: `gravacoes/${outra}/transcricao.md`,
              base64: texto(
                "# Sessão de 19/11 — transcrição\n\n20:30  Mestre: Vocês chegam à torre.\n",
              ),
            },
            { caminho: `gravacoes/${outra}/Mestre/1000.wav`, base64: texto("RIFFxxxxWAVE") },
          ],
        ] as const,
      );
      await m.s.pagina.getByTestId("aba-mesa").click();
      await abrirSecaoDaMesa(m.s.pagina, "gravacoes");
      await expect(m.s.pagina.getByTestId(`gravacao-${outra}`)).toBeVisible();
      await m.s.pagina.getByTestId("mesa-secao-gravacoes").scrollIntoViewIfNeeded();
      await m.s.pagina.screenshot({ path: CAMINHO(tema, "10-lista-de-gravacoes") });
      // a pergunta de apagar o áudio
      await m.s.pagina.getByTestId(`gravacao-trazer-${outra}`).click();
      await expect(m.s.pagina.getByTestId("gravacao-apagar-audio")).toBeVisible();
      await m.s.pagina.screenshot({ path: CAMINHO(tema, "11-apagar-o-audio") });
    } finally {
      await mesa.fechar();
    }
  });
}
