import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirPreferencia,
  test as base,
  enviarCru,
  expect,
  intencaoCrua,
  Mesa,
} from "../tests/ajudas";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "../tests/ajudasMapa";
import { arquivoWav, hashDoSom, somDe } from "../tests/ajudasSom";

// Prints do lote N5 (som ambiente): o painel de Som do mestre (com uma trilha tocando), o painel da zona com o som, o
// cartão Som das Preferências e o aviso "Clique para ativar o som da mesa". Grimório 1600×900 e 1280×720 e Pergaminho
// (claro) 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints n5

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const POLIGONO = [
  { x: 26.25, y: 6 },
  { x: 33, y: 6 },
  { x: 33, y: 13.5 },
  { x: 26.25, y: 13.5 },
];

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const centrar = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([a, b]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(
        a as number,
        b as number,
      ),
    [x, y],
  );

for (const c of COMBINACOES) {
  base(`n5 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      const jg = await entrarNoMapa(mesa, "jogador-1");
      const j = jg.pagina;
      await escolherTema(j, c.tema);

      // 1: o painel de Som com a trilha tocando e a lista de efeitos
      await m.getByTestId("ferramenta-som").click();
      await expect(m.getByTestId("painel-som")).toBeVisible();
      await m
        .getByTestId("som-trilha-escolher-arquivo")
        .setInputFiles(arquivoWav("Taverna.wav", 1));
      await expect(m.getByTestId("som-trilha-agora")).toHaveText("Taverna");
      await m.getByTestId("som-efeito-arquivo").setInputFiles(arquivoWav("Sopro do Pulmão.wav", 2));
      await m.getByTestId("som-efeito-arquivo").setInputFiles(arquivoWav("Sussurros.wav", 3));
      await expect(m.getByTestId("som-efeito-item")).toHaveCount(3);
      await m.getByTestId("som-cena-usar").click();
      await expect(m.getByTestId("som-cena-trilha")).toContainText("Taverna");
      await m.mouse.move(c.width / 2, c.height - 40);
      await m.waitForTimeout(400);
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-01-painel-de-som.png`) });
      await m.getByTestId("som-fechar").click();

      // 2: o painel da zona com o "Som enquanto dentro"
      await enviarCru(
        m,
        intencaoCrua("zona.criar", {
          zona: {
            id: "zona-ar",
            cenaId: "cena-1",
            nome: "Ar Morto",
            pontos: POLIGONO,
            efeitos: {},
          },
        }),
      );
      await m.getByTestId("ferramenta-zonas").click();
      await centrar(m, 29.5, 9.75);
      const dentro = await pontoNaPagina(m, 31.5, 11.25);
      await m.mouse.click(dentro.x, dentro.y);
      await expect(m.getByTestId("zona-selecionada")).toBeVisible();
      await m.getByTestId("zona-som-escolher").click();
      await m
        .getByTestId("zona-som-escolher-lista-arquivo")
        .setInputFiles(arquivoWav("Sussurros.wav", 3));
      await expect(m.getByTestId("zona-som-nome")).toHaveText("Sussurros");
      await m.getByTestId("zona-som-volume").fill("60");
      expect(await hashDoSom(m, "Sussurros.wav")).toMatch(/^[0-9a-f]{64}$/);
      await m.mouse.move(c.width / 2, c.height - 40);
      await m.waitForTimeout(400);
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-02-painel-da-zona.png`) });
      await m
        .getByTestId("zonas-fechar")
        .click({ timeout: 2000 })
        .catch(() => undefined);

      // 3: o cartão Som em Preferências (do jogador)
      await abrirPreferencia(j, "som");
      await expect.poll(async () => (await somDe(j)).trilha?.hash).toBeTruthy();
      await j.getByTestId("som-geral").fill("65");
      await j.waitForTimeout(400);
      await j.screenshot({ path: join(PASTA as string, `${rotulo}-03-preferencias-som.png`) });

      // 4: o aviso "Clique para ativar o som" (o navegador bloqueou)
      await j.getByTestId("aba-chat").click();
      await j.evaluate(() =>
        (
          window as unknown as { __tabletopSom: { simularBloqueio(): void } }
        ).__tabletopSom.simularBloqueio(),
      );
      await expect(j.getByTestId("aviso-som")).toBeVisible();
      await j.waitForTimeout(400);
      await j.screenshot({ path: join(PASTA as string, `${rotulo}-04-aviso-de-som.png`) });
    } finally {
      await mesa.fechar();
    }
  });
}
