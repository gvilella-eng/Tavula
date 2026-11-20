import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { argsDeMidiaFalsa } from "../midiaFalsa";
import { abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote CH1 (a chamada da mesa): Grimório 1600×900 e 1280×720 e Pergaminho 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints ch1
// As câmeras e o microfone são os falsos do Chromium.

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

base.use({
  launchOptions: {
    args: argsDeMidiaFalsa(),
  },
});

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click();
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function abrirJanela(
  mesa: Mesa,
  usuario: string,
  tema: string,
  c: (typeof COMBINACOES)[number],
) {
  const s = await entrarNoMapa(mesa, usuario);
  await escolherTema(s.pagina, tema);
  const [janela] = await Promise.all([
    s.contexto.waitForEvent("page"),
    s.pagina.getByTestId("topo-chamada").click(),
  ]);
  await janela.setViewportSize({ width: c.width, height: c.height });
  await expect(janela.getByTestId("chamada-antes")).toBeVisible();
  await expect(janela.locator("html")).toHaveAttribute("data-tema", tema);
  await expect
    .poll(() =>
      janela.evaluate(
        () =>
          document.querySelector<HTMLVideoElement>('[data-testid="chamada-previa-video"]')
            ?.videoWidth ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  return { s, janela };
}

for (const c of COMBINACOES) {
  base(`ch1 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const m = await abrirJanela(mesa, "mestre", c.tema, c);
      // antes de entrar: a câmera grande, o fundo e os aparelhos
      await m.janela.getByTestId("chamada-fundo-desfocar").click();
      await expect(m.janela.getByTestId("chamada-fundo-desfocar")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(m.janela.getByTestId("chamada-fundo-nota")).not.toContainText("Carregando");
      await expect
        .poll(() =>
          m.janela.evaluate(
            () =>
              document.querySelector<HTMLVideoElement>('[data-testid="chamada-previa-video"]')
                ?.videoWidth ?? 0,
          ),
        )
        .toBeGreaterThan(0);
      await m.janela.screenshot({
        path: join(PASTA as string, `${rotulo}-01-antes-de-entrar.png`),
      });
      await m.janela.getByTestId("chamada-entrar").click();

      const a = await abrirJanela(mesa, "jogador-1", c.tema, c);
      await a.janela.getByTestId("chamada-entrar").click();
      const b = await abrirJanela(mesa, "jogador-2", c.tema, c);
      await b.janela.getByTestId("chamada-entrar").click();
      await a.janela.getByTestId("chamada-microfone").click();
      await b.janela.getByTestId("chamada-camera").click();

      for (const id of ["jogador-1", "jogador-2"]) {
        await expect(m.janela.getByTestId(`chamada-quadro-${id}`)).toBeVisible();
      }
      await expect
        .poll(() =>
          m.janela.evaluate(
            () =>
              document.querySelector<HTMLVideoElement>('[data-testid="chamada-video-jogador-1"]')
                ?.videoWidth ?? 0,
          ),
        )
        .toBeGreaterThan(0);
      await m.janela.mouse.move(5, 5);
      await m.janela.screenshot({ path: join(PASTA as string, `${rotulo}-02-grade.png`) });

      // a janela estreita (só no Grimório 1600×900, para não repetir)
      if (c.tema === "grimorio" && c.nome === "1600x900") {
        await m.janela.setViewportSize({ width: 420, height: 700 });
        await expect(m.janela.getByTestId("chamada-linhas")).toBeVisible();
        await m.janela.mouse.move(5, 5);
        await m.janela.screenshot({ path: join(PASTA as string, `${rotulo}-04-estreita.png`) });
        await m.janela.setViewportSize({ width: c.width, height: c.height });
      }

      // a mesa: o botão "Chamada" com a contagem e o ícone na presença
      await expect(m.s.pagina.getByTestId("topo-chamada-contagem")).toHaveText("3");
      await m.s.pagina.getByTestId("topo").screenshot({
        path: join(PASTA as string, `${rotulo}-05-topo-da-mesa.png`),
      });
    } finally {
      await mesa.fechar();
    }
  });
}
