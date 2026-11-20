import type { Page } from "@playwright/test";
import { expect, test } from "./ajudas";
import { entrarNoMapa } from "./ajudasMapa";
import { arquivoWav, configurarLugar } from "./ajudasSom";

// MU3: o zoom (e o que mais flutua no pé do mapa) sobe para ficar acima da faixa da mesa de som, aberta, recolhida e
// enquanto se arrasta a alça da altura, e volta ao lugar de sempre quando a mesa de som vira janela. E as abas da mesa de
// som e da configuração usam o seletor segmentado da ficha, sem subtítulo.

test.describe.configure({ timeout: 120_000 });

async function caixa(p: Page, testid: string) {
  const c = await p.getByTestId(testid).boundingBox();
  if (!c) throw new Error(`${testid} não está visível`);
  return c;
}

/** O zoom está inteiro na tela e não encosta na faixa (que está embaixo dele). */
async function zoomLivre(p: Page) {
  const z = await caixa(p, "zoom-flutuante");
  const f = await caixa(p, "som-faixa");
  const janela = p.viewportSize();
  expect(z.y + z.height).toBeLessThanOrEqual(f.y + 0.5);
  expect(z.y).toBeGreaterThanOrEqual(0);
  expect(z.x + z.width).toBeLessThanOrEqual((janela?.width ?? 0) + 0.5);
  // o ponto central do zoom é mesmo o zoom (nada por cima)
  const topo = await p.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('[data-testid="zoom-flutuante"]') !== null,
    { x: z.x + z.width / 2, y: z.y + z.height / 2 },
  );
  expect(topo).toBe(true);
}

test("o zoom fica acima da faixa da mesa de som e volta ao pé quando ela vira janela", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  await configurarLugar(m, "efeito", 0, arquivoWav("sopro.wav", 2), "Sopro");
  await configurarLugar(m, "ambiente", 0, arquivoWav("taverna.wav", 1), "Taverna");
  await m.getByTestId("som-config-pronto").click();
  await expect(m.getByTestId("som-config")).toHaveCount(0);

  // com a mesa de som em janela, o zoom fica no pé de sempre
  const emJanela = await caixa(m, "zoom-flutuante");

  // abas no seletor segmentado, sem subtítulo
  await expect(m.getByTestId("som-aba-efeitos-estado")).toHaveCount(0);
  await m.getByTestId("som-encaixar").click();
  const faixa = m.getByTestId("som-faixa");
  await expect(faixa).toBeVisible();
  await expect(m.getByTestId("som-abas")).toHaveClass(/seg-grupo/);
  await expect(m.getByTestId("som-aba-efeitos-estado")).toHaveCount(0);
  await expect(m.getByTestId("som-aba-musica")).toHaveText("Música");

  // faixa aberta
  await expect.poll(async () => (await caixa(m, "zoom-flutuante")).y).toBeLessThan(emJanela.y);
  await zoomLivre(m);

  // altura arrastada pela alça
  const alca = m.getByTestId("som-faixa-alca");
  const a = await caixa(m, "som-faixa-alca");
  await m.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await m.mouse.down();
  await m.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 70, { steps: 5 });
  await zoomLivre(m);
  await m.mouse.up();
  await expect(alca).toBeVisible();
  await zoomLivre(m);
  // e para cima também (a faixa volta ao tamanho natural)
  await alca.focus();
  await m.keyboard.press("Home");
  await zoomLivre(m);

  // recolhida: só o cabeçalho
  await m.getByTestId("som-faixa-recolher").click();
  await expect(faixa).toHaveAttribute("data-recolhida", "sim");
  await zoomLivre(m);
  const f = await caixa(m, "som-faixa");
  expect(f.height).toBeLessThan(80);
  await m.getByTestId("som-faixa-recolher").click();
  await zoomLivre(m);

  // de volta a janela: o zoom volta ao lugar de sempre
  await m.getByTestId("som-soltar").click();
  await expect(faixa).toHaveCount(0);
  await expect.poll(async () => (await caixa(m, "zoom-flutuante")).y).toBe(emJanela.y);
});

test("as abas da configuração da mesa de som usam o seletor segmentado e trocam por teclado", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  await configurarLugar(m, "efeito", 0, arquivoWav("sopro.wav", 2), "Sopro");
  const lugares = m.getByTestId("som-config-aba-lugares");
  const musica = m.getByTestId("som-config-aba-musica");
  await expect(m.getByRole("tablist", { name: "Partes da configuração" })).toHaveClass(/seg-grupo/);
  await expect(lugares).toHaveAttribute("aria-selected", "true");
  await lugares.focus();
  await m.keyboard.press("ArrowRight");
  await expect(musica).toHaveAttribute("aria-selected", "true");
  await expect(musica).toBeFocused();
  await m.keyboard.press("Home");
  await expect(lugares).toHaveAttribute("aria-selected", "true");
});
