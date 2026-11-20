import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirPreferencia,
  test as base,
  enviarCru,
  expect,
  importarCampanha,
  intencaoCrua,
} from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote AU1 (automações por blocos): a lista com as frases, o editor (a Respiração da Montanha), o erro no bloco
// e o painel da zona. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints au1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const CASOS = [
  { tema: "grimorio", nome: "grimorio-1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "grimorio-1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "pergaminho-1600x900", width: 1600, height: 900 },
] as const;

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click();
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
}

for (const c of CASOS) {
  base(`au1 ${c.nome}`, async ({ mesa }) => {
    base.setTimeout(150_000);
    const m = (await entrarNoMapa(mesa, "mestre")).pagina;
    await m.setViewportSize({ width: c.width, height: c.height });
    await escolherTema(m, c.tema);
    const foto = async (nome: string) => {
      await m.waitForTimeout(500);
      await m.screenshot({ path: join(PASTA as string, `${c.nome}-${nome}.png`) });
    };

    // a Chama Primordial: a forma antiga entra convertida
    await abrirAba(m, "mesa");
    await importarCampanha(m, {
      name: "chama-primordial.json",
      mimeType: "application/json",
      buffer: readFileSync(
        new URL("../../fixtures/campanhas/chama-primordial.json", import.meta.url),
      ),
    });
    await expect(m.getByTestId("chip-ciclo-respiracao")).toBeVisible();
    await m.getByTestId("menu-pausa").click();
    await m.getByTestId("menu-automacoes").click();
    await expect(m.getByTestId("automacoes-lista")).toBeVisible();
    await foto("01-lista");

    // o menu de uma automação
    await m.getByTestId("auto-menu-botao-rajada").click();
    await foto("02-lista-menu");
    await m.getByTestId("auto-menu-botao-rajada").click();

    // o editor: a Respiração (duas trilhas, para cada, esperar)
    await m.getByTestId("auto-editar-respiracao").click();
    await expect(m.getByTestId("ed-raiz")).toBeVisible();
    await foto("03-editor-respiracao");
    await m.getByTestId("ed-no-t0-b0").click();
    await foto("04-editor-bloco-escolhido");

    // o editor de uma reação convertida, com sortear e as saídas
    await m.getByTestId("ed-voltar").click();
    await m.getByTestId("auto-editar-rx-tocha-inspiracao").click();
    await m.getByTestId("ed-peca-sortear").click();
    await foto("05-editor-sortear");

    // um erro no próprio bloco
    await m.getByTestId("ed-voltar").click();
    await m.getByTestId("auto-nova").click();
    await m.getByTestId("ed-peca-luz").click();
    await m.getByTestId("ed-salvar").click();
    await foto("06-editor-erro-no-bloco");

    // o menu das peças no "+"
    await m.getByTestId("ed-mais-t0-1").click();
    await foto("07-editor-menu-de-pecas");
  });
}

base("au1 painel da zona", async ({ mesa }) => {
  base.setTimeout(90_000);
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  await m.setViewportSize({ width: 1600, height: 900 });
  const r = await enviarCru(
    m,
    intencaoCrua("zona.criar", {
      zona: {
        id: "z-gas",
        cenaId: "cena-1",
        nome: "Gás",
        pontos: [
          { x: 26.25, y: 6 },
          { x: 33, y: 6 },
          { x: 33, y: 13.5 },
          { x: 26.25, y: 13.5 },
        ],
        ativa: true,
        efeitos: { luzRaioX: 0.5 },
      },
    }),
  );
  expect(r?.tipo).toBe("evento");
  await enviarCru(
    m,
    intencaoCrua("fluxo.criar", {
      fluxo: {
        id: "aviso-gas",
        nome: "Aviso do gás",
        gatilho: { tipo: "zona", quando: "entra", zona: "z-gas" },
        trilhas: [
          [{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "Gás!", para: "mestre" } }],
        ],
      },
    }),
  );
  await m.getByTestId("ferramenta-zonas").click();
  await expect(m.getByTestId("painel-zonas")).toBeVisible();
  // seleciona a zona pelo mapa (à direita do painel)
  const gancho = await m.evaluate(() => {
    const g = (window as unknown as { __tabletop: { zonas: () => unknown } }).__tabletop;
    return g.zonas();
  });
  expect(Array.isArray(gancho)).toBe(true);
  await m.mouse.click(1000, 300);
  await m.waitForTimeout(500);
  await m.screenshot({ path: join(PASTA as string, "painel-da-zona.png") });
});
