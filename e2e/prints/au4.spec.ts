import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirPreferencia,
  test as base,
  CAMINHO_DA_MESA,
  enviarCru,
  esperarMapa,
  expect,
  intencaoCrua,
} from "../tests/ajudas";

// Prints do lote AU4 ("Cena ativa" em "Cenas onde vale"): o painel "Esta automação" com a caixa nova alinhada às outras.
// Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints au4

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const CASOS = [
  { tema: "grimorio", nome: "grimorio-1600x900", width: 1600, height: 900 },
  { tema: "claro", nome: "pergaminho-1600x900", width: 1600, height: 900 },
] as const;

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click();
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
}

for (const c of CASOS) {
  base(`au4 ${c.nome}`, async ({ mesa }) => {
    base.setTimeout(120_000);
    const s = await mesa.abrir();
    const m = s.pagina;
    await m.goto(CAMINHO_DA_MESA);
    await m.getByTestId("entrar-mestre").click();
    await expect(m.getByTestId("status-conexao")).toHaveText("conectado");
    await esperarMapa(m);
    await m.setViewportSize({ width: c.width, height: c.height });
    await escolherTema(m, c.tema);
    await enviarCru(m, intencaoCrua("cena.criar", { id: "cena-b", nome: "Taverna" }));
    await enviarCru(
      m,
      intencaoCrua("fluxo.criar", {
        fluxo: {
          id: "apagar",
          nome: "Apagar tochas",
          gatilho: { tipo: "botao", nome: "Apagar" },
          trilhas: [
            [
              {
                bloco: "paraCada",
                alvo: { tipo: "objetos", acesos: true },
                corpo: [{ bloco: "acao", acao: { acao: "objeto.apagar" } }],
              },
            ],
          ],
        },
      }),
    );
    await m.getByTestId("menu-automacoes").click();
    const [e] = await Promise.all([
      m.waitForEvent("popup"),
      m.getByTestId("auto-editar-apagar").click(),
    ]);
    await e.setViewportSize({ width: c.width, height: c.height });
    await expect(e.getByTestId("ed-raiz")).toBeVisible();
    await e.getByTestId("ed-cena-ativa").check();
    await e.getByTestId("ed-cena-cena-b").check();
    await e.waitForTimeout(500);
    await e.screenshot({ path: join(PASTA as string, `${c.nome}-01-editor.png`) });
    await e
      .locator(".ed-cenas")
      .screenshot({ path: join(PASTA as string, `${c.nome}-02-cenas-onde-vale.png`) });
  });
}
