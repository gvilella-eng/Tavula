import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirFaixa, abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { pngDeCor } from "../tests/ajudasAssets";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote Q3 (importar mapas do Dungeondraft): a opção no painel de cenas, a cena importada com as paredes visíveis para o
// mestre e o resumo. Grimório em 1600×900 e 1280×720 e Pergaminho (claro) em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints q3

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const tiradas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

base.afterAll(() => {
  console.log(`[Q3] ${tiradas.length} prints: ${tiradas.join(", ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click();
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

/** Uma masmorra pequena (12 x 10 quadrados): duas salas, um corredor, duas portas e três tochas. */
function masmorra(): Buffer {
  const p = (x: number, y: number) => ({ x, y });
  const imagem = pngDeCor(840, 700, [196, 182, 150]);
  return Buffer.from(
    JSON.stringify({
      format: 0.3,
      resolution: { map_origin: p(0, 0), map_size: p(12, 10), pixels_per_grid: 70 },
      line_of_sight: [
        [p(1, 1), p(5, 1), p(5, 4), p(1, 4), p(1, 1)],
        [p(7, 1), p(11, 1), p(11, 4), p(7, 4), p(7, 1)],
        [p(1, 6), p(11, 6), p(11, 9), p(1, 9), p(1, 6)],
        [p(3, 4), p(3, 6)],
        [p(9, 4), p(9, 6)],
      ],
      objects_line_of_sight: [[p(8, 7), p(10, 7), p(10, 8), p(8, 8), p(8, 7)]],
      portals: [
        { position: p(6, 1), bounds: [p(5.5, 1), p(6.5, 1)], rotation: 0, closed: true },
        { position: p(3, 4.5), bounds: [p(3, 4), p(3, 5)], rotation: 1.5708, closed: false },
      ],
      environment: { baked_lighting: true, ambient_light: "ffffffff" },
      lights: [
        { position: p(3, 2.5), range: 5, intensity: 1, color: "ffeccd8b", shadows: true },
        { position: p(9, 2.5), range: 5, intensity: 0.8, color: "ffffc27a", shadows: true },
        { position: p(6, 7.5), range: 6, intensity: 1, color: "ffeccd8b", shadows: true },
      ],
      image: imagem.toString("base64"),
    }),
    "utf8",
  );
}

for (const c of COMBINACOES) {
  base(`q3 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const mestre = await entrarNoMapa(mesa, "mestre");
      const m = mestre.pagina;
      await escolherTema(m, c.tema);

      // 1. a opção no painel de cenas
      await abrirFaixa(m);
      await expect(m.getByTestId("cena-importar-uvtt")).toBeVisible();
      await foto(m, `q3-${rotulo}-1-opcao`);

      // 2. importa: o resumo no alto
      await m.getByTestId("cena-importar-uvtt-arquivo").setInputFiles({
        name: "Cripta do Rei.dd2vtt",
        mimeType: "application/octet-stream",
        buffer: masmorra(),
      });
      await expect(m.getByTestId("aviso-importacao")).toHaveAttribute("data-estado", "pronto");
      await foto(m, `q3-${rotulo}-2-resumo`);

      // 3. a cena importada, vista pelo mestre, com as paredes e portas à mostra
      const card = m.locator('[data-testid="cena-card"]').filter({ hasText: "Cripta do Rei" });
      await expect(card).toHaveCount(1);
      await card.click();
      // a faixa de cenas recolhida, para o mapa inteiro aparecer
      await m.getByTestId("menu-cenas").click();
      await expect(m.getByTestId("faixa-cenas")).toHaveCount(0);
      await m.getByTestId("aviso-importacao-fechar").click();
      await expect(m.getByTestId("aviso-importacao")).toHaveCount(0);
      await foto(m, `q3-${rotulo}-3-cena`, 1500);
    } finally {
      await mesa.fechar();
    }
  });
}
