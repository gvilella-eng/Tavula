import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirPreferencia,
  test as base,
  enviarCru,
  escolherCamada,
  expect,
  intencaoCrua,
  Mesa,
} from "../tests/ajudas";
import {
  arquivoPng,
  assets,
  gifAnimado,
  pngDeRuido,
  soltarArquivoNoMapa,
} from "../tests/ajudasAssets";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote AS1 (imagens soltas na cena, "Assets da mesa", o aviso de apagar em uso e a lista do jogador), no tema
// Grimório em 1600×900 e 1280×720 e no Pergaminho (claro) em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints as1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const CONFIGS = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

async function escolherTema(p: Page, tema: string) {
  if ((await p.locator("html").getAttribute("data-tema")) === tema) return;
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const ponto = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([a, b]) =>
      (
        window as unknown as {
          __tabletop: { paginaDoPonto(x: number, y: number): { x: number; y: number } };
        }
      ).__tabletop.paginaDoPonto(a as number, b as number),
    [x, y],
  );

const quantas = (p: Page) =>
  p.evaluate(
    () =>
      (window as unknown as { __tabletop: { tokens(): { imagem: unknown }[] } }).__tabletop
        .tokens()
        .filter((t) => t.imagem !== null).length,
  );

for (const cfg of CONFIGS) {
  base(`as1 ${cfg.tema} ${cfg.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: cfg.width, height: cfg.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${cfg.tema}-${cfg.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, cfg.tema);
      await escolherCamada(m, "mapa");
      await soltarArquivoNoMapa(
        m,
        arquivoPng("estatua.png", pngDeRuido(240, 160, 5, 6)),
        await ponto(m, 18, 14),
      );
      await soltarArquivoNoMapa(
        m,
        {
          name: "chama.gif",
          mimeType: "image/gif",
          buffer: gifAnimado(24, 24, [
            [255, 120, 0],
            [255, 220, 40],
          ]),
        },
        await ponto(m, 28, 14),
      );
      await soltarArquivoNoMapa(
        m,
        arquivoPng("brasao.png", pngDeRuido(160, 160, 11, 8)),
        await ponto(m, 23, 24),
      );
      await expect.poll(() => quantas(m), { timeout: 40_000 }).toBe(3);
      // um som e um mapa registrados só para a lista ficar completa
      const meta = (hash: string, tipo: string, nome: string, mime: string) => ({
        hash,
        tipo,
        mime,
        bytes: 480_000,
        largura: 100,
        altura: 100,
        nomeOriginal: nome,
        pedacos: ["1".repeat(64), "2".repeat(64)],
      });
      await enviarCru(
        m,
        intencaoCrua("asset.registrar", {
          metas: [meta("5".repeat(64), "som", "taverna-chuva.mp3", "audio/mpeg")],
        }),
      );
      await enviarCru(
        m,
        intencaoCrua("asset.registrar", {
          metas: [meta("6".repeat(64), "mapa", "catacumbas.png", "image/webp")],
        }),
      );

      // 1) a imagem selecionada, com as alças, no mapa
      const dados = await m.evaluate(() =>
        (
          window as unknown as {
            __tabletop: { tokens(): { nome: string; x: number; y: number; imagem: unknown }[] };
          }
        ).__tabletop
          .tokens()
          .find((t) => t.nome === "estatua"),
      );
      const centro = await ponto(m, dados?.x ?? 18, dados?.y ?? 14);
      await m.mouse.click(centro.x, centro.y);
      await foto(m, `${rotulo}-1-mapa-com-alcas`);

      // 2) a lista "Assets da mesa"
      await abrirAba(m, "mesa");
      const secao = m.getByTestId("mesa-secao-assets");
      await secao.scrollIntoViewIfNeeded();
      await foto(m, `${rotulo}-2-assets-da-mesa`);

      // 3) o aviso de apagar um arquivo em uso
      const hash = (await assets(m, "metas")).find((x) => x.nomeOriginal === "estatua.png")?.hash;
      const h = (hash ?? "").slice(0, 12);
      await m.getByTestId(`asset-apagar-${h}`).click();
      await expect(m.getByTestId(`asset-aviso-${h}`)).toBeVisible();
      await m.getByTestId(`asset-aviso-${h}`).scrollIntoViewIfNeeded();
      await foto(m, `${rotulo}-3-apagar-em-uso`);

      // 4) a lista do jogador (Preferências, "Arquivos da mesa")
      const j = (await entrarNoMapa(mesa, "jogador-1")).pagina;
      await escolherTema(j, cfg.tema);
      await abrirPreferencia(j, "assets");
      await expect(j.getByTestId("assets-lista")).toBeVisible();
      await expect(j.locator('[data-testid^="asset-"][data-tipo="imagem"]').first()).toBeVisible({
        timeout: 30_000,
      });
      await j.getByTestId("pref-secao-assets").scrollIntoViewIfNeeded();
      await foto(j, `${rotulo}-4-lista-do-jogador`);
    } finally {
      await mesa.fechar();
    }
  });
}
