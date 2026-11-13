import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, enviarCru, expect, intencaoCrua, Mesa } from "../tests/ajudas";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "../tests/ajudasMapa";

// Prints do lote 7b-2 (as zonas): o mestre desenhando uma zona, a zona pronta com o painel e a mesma cena vista pelo
// jogador (sem a zona, com a luz menor), em Grimório 1600×900 e 1280×720 e Pergaminho (claro) 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints 7b2

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

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
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

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

for (const c of COMBINACOES) {
  base(`zonas ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const mestre = await entrarNoMapa(mesa, "mestre");
      const m = mestre.pagina;
      await escolherTema(m, c.tema);
      // a tocha acesa na mão do Aldric, para a luz menor ficar à vista do jogador
      await ok(m, "mochila.ajustar", {
        personagemId: "pers-aldric",
        modeloId: "modelo-tocha",
        delta: 2,
      });
      await ok(m, "tocha.acender", {
        personagemId: "pers-aldric",
        modeloId: "modelo-tocha",
        novoId: "tocha-a",
      });
      const j1 = await entrarNoMapa(mesa, "jogador-1");
      await escolherTema(j1.pagina, c.tema);

      // 1. o mestre desenhando: três cantos clicados e o cursor no quarto
      await m.getByTestId("ferramenta-zonas").click();
      await centrar(m, 29.5, 9.75);
      for (const q of POLIGONO.slice(0, 3)) {
        const t = await pontoNaPagina(m, q.x, q.y);
        await m.mouse.click(t.x, t.y);
      }
      const quarto = await pontoNaPagina(m, POLIGONO[3]?.x ?? 0, POLIGONO[3]?.y ?? 0);
      await m.mouse.move(quarto.x, quarto.y, { steps: 4 });
      await foto(m, `${rotulo}-1-desenhando`);

      // 2. a zona pronta com o painel (efeitos preenchidos)
      await m.mouse.dblclick(quarto.x, quarto.y);
      await expect(m.getByTestId("zona-selecionada")).toBeVisible();
      await m.getByTestId("zona-nome").fill("Gás da montanha");
      await m.getByTestId("zona-nome").press("Enter");
      await m.getByTestId("zona-luz-fator").fill("0.5");
      await m.getByTestId("zona-luz-fator").press("Enter");
      await m.getByTestId("zona-visao").fill("3");
      await m.getByTestId("zona-visao").press("Enter");
      await expect(m.getByTestId("zona-visao")).toHaveValue("3");
      await m.mouse.move(quarto.x + 120, quarto.y + 120);
      await foto(m, `${rotulo}-2-zona-e-painel`);

      // 3. o jogador dentro da zona: sem polígono, com a luz menor e a visão curta
      await ok(j1.pagina, "token.soltar", { id: "tok-jogador-1", x: 29.25, y: 9.75 });
      await centrar(j1.pagina, 29.25, 9.75);
      await expect
        .poll(() =>
          j1.pagina.evaluate(
            () =>
              (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop
                .luzes()
                .find((l) => l.id === "tocha-a")?.claraM,
          ),
        )
        .toBeGreaterThan(0);
      await foto(j1.pagina, `${rotulo}-3-jogador`);
    } finally {
      await mesa.fechar();
    }
  });
}
