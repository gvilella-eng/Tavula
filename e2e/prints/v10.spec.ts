import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, expect, Mesa, menuDaCena } from "../tests/ajudas";
import { entrarNoMapa, soSelecionarToken } from "../tests/ajudasMapa";

// Prints do lote V10: o seletor de imagem por cima do Configurar cena, o aviso "Token removido do mapa." com
// Desfazer e a bandeira com a dica e a faixa de Cenas aberta. Grimório 1600×900 e 1280×720 e Pergaminho
// (claro) 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v10

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

type Gancho = {
  bandeira(): { x: number; y: number } | null;
  centrarEm(x: number, y: number): void;
  paraTela(x: number, y: number): { x: number; y: number };
};

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

for (const c of COMBINACOES) {
  base(`V10 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(120_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const m = (await entrarNoMapa(mesa, "mestre")).pagina;
      const rotulo = `${c.tema}-${c.nome}`;
      await m.getByTestId("aba-preferencias").click();
      await m.getByTestId(`tema-${c.tema}`).check({ force: true });
      await expect(m.locator("html")).toHaveAttribute("data-tema", c.tema);
      await m.getByTestId("aba-chat").click();

      // 1. o seletor por cima do Configurar cena
      await menuDaCena(m, "cena-covil", "configurar");
      await m.getByTestId("cfg-mapa").click();
      await expect(m.getByTestId("seletor-imagem")).toBeVisible();
      await foto(m, `${rotulo}-01-seletor-sobre-configurar`);
      await m.keyboard.press("Escape");
      await m.keyboard.press("Escape");
      await expect(m.getByTestId("configurar-cena")).toHaveCount(0);

      // 2. o aviso com Desfazer
      await m.getByTestId("menu-cenas").click();
      await expect(m.getByTestId("faixa-cenas")).toHaveCount(0);
      await soSelecionarToken(m, "tok-jogador-3");
      await m.keyboard.press("Delete");
      await expect(m.getByTestId("aviso-acao")).toBeVisible();
      await foto(m, `${rotulo}-02-token-removido-desfazer`);
      await m.getByTestId("aviso-acao").click();

      // 3. a bandeira com a dica e a faixa de Cenas aberta
      await m.getByTestId("menu-cenas").click();
      await expect(m.getByTestId("faixa-cenas")).toBeVisible();
      await expect
        .poll(() =>
          m.evaluate(() => (window as unknown as { __tabletop: Gancho }).__tabletop.bandeira()),
        )
        .not.toBeNull();
      const tela = await m.evaluate(() => {
        const h = (window as unknown as { __tabletop: Gancho }).__tabletop;
        const b = h.bandeira() as { x: number; y: number };
        h.centrarEm(b.x, b.y);
        return h.paraTela(b.x, b.y);
      });
      await m.mouse.move(tela.x + 4, tela.y - 14);
      await m.mouse.move(tela.x + 5, tela.y - 13);
      await expect(m.getByTestId("dica-bandeira")).toBeVisible();
      await foto(m, `${rotulo}-03-bandeira-com-dica`);
    } finally {
      await mesa.fechar();
    }
  });
}
