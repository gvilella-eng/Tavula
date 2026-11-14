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
import { menuDoToken } from "../tests/ajudasCombate";
import { entrarNoMapa, soSelecionarToken } from "../tests/ajudasMapa";

// Prints do lote N1 (vida e CA no token, "morto" com X e o menu com Camada), em Grimório 1600×900 e 1280×720 e
// Pergaminho (claro) 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints n1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

for (const c of COMBINACOES) {
  base(`n1 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);

      await soSelecionarToken(m, "tok-jogador-1");
      await expect(m.getByTestId("marcas-do-token")).toBeVisible();
      await m.mouse.move(5, 5);
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-01-vida-e-ca.png`) });

      await m.getByTestId("marca-vida").click();
      await expect(m.getByTestId("marca-vida-campo")).toBeFocused();
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-02-vida-em-edicao.png`) });
      await m.getByTestId("marca-vida-campo").press("Escape");

      const r = await enviarCru(
        m,
        intencaoCrua("token.condicoes", { id: "tok-jogador-1", morto: true }),
      );
      expect(r?.tipo).toBe("evento");
      await m.mouse.move(5, 5);
      await m.waitForTimeout(400);
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-03-morto.png`) });

      await menuDoToken(m, "tok-ogro");
      await expect(m.getByTestId("menu-token-grupo-camada")).toBeVisible();
      await m.screenshot({ path: join(PASTA as string, `${rotulo}-04-menu-com-camada.png`) });
      await m.keyboard.press("Escape");
    } finally {
      await mesa.fechar();
    }
  });
}
