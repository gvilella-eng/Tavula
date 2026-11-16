import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirPreferencia,
  test as base,
  enviarCru,
  expect,
  intencaoCrua,
  Mesa,
} from "../tests/ajudas";
import { assets } from "../tests/ajudasAssets";
import { menuDoToken } from "../tests/ajudasCombate";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote Q1: o menu do token com "Abrir ficha", Transferências com nomes longos, o aviso de reautorizar e o aviso de
// escolher a pasta. Grimório em 1600×900 e 1280×720 e Pergaminho em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints q1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const NOME_LONGO =
  "um-nome-de-arquivo-muito-mas-muito-comprido-que-antes-quebrava-uma-letra-por-linha-na-coluna-do-nome-do-arquivo.png";

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

for (const c of COMBINACOES) {
  base(`q1 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(180_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const rotulo = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const mestre = await entrarNoMapa(mesa, "mestre");
      const j1 = await entrarNoMapa(mesa, "jogador-1");
      const p = mestre.pagina;
      await abrirPreferencia(p, "aparencia");
      await p.getByTestId(`tema-${c.tema}`).check({ force: true });
      await expect(p.locator("html")).toHaveAttribute("data-tema", c.tema);
      await abrirAba(p, "chat");

      // o menu do token com "Abrir ficha" no topo
      await menuDoToken(p, "tok-jogador-1");
      await expect(p.getByTestId("menu-token-abrir-ficha")).toBeVisible();
      await foto(p, `${rotulo}-01-menu-do-token`);
      await p.keyboard.press("Escape");

      // um arquivo de nome longo que ninguém online tem: Transferências e o aviso de escolher a pasta
      await enviarCru(
        j1.pagina,
        intencaoCrua("asset.registrar", {
          metas: [
            {
              hash: "c".repeat(64),
              tipo: "token",
              mime: "image/png",
              bytes: 10,
              largura: 10,
              altura: 10,
              nomeOriginal: NOME_LONGO,
              pedacos: ["d".repeat(64)],
            },
          ],
        }),
      );
      await expect(p.getByTestId("aviso-pasta")).toHaveAttribute("data-caso", "escolher", {
        timeout: 30_000,
      });
      await foto(p, `${rotulo}-02-aviso-escolher-a-pasta`);
      await abrirPreferencia(p, "ajuda");
      await expect(p.getByTestId("transferencia").first()).toBeVisible();
      await p.getByTestId("transferencias").scrollIntoViewIfNeeded();
      await foto(p, `${rotulo}-03-transferencias`);

      // a pasta pede permissão de novo
      await assets(p, "simularPasta", "reautorizar");
      await expect(p.getByTestId("aviso-pasta")).toHaveAttribute("data-caso", "reautorizar");
      await abrirAba(p, "chat");
      await foto(p, `${rotulo}-05-aviso-reautorizar`);
    } finally {
      await mesa.fechar();
    }
  });
}
