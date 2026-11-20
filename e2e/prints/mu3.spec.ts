import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";
import { arquivoWav, configurarLugar } from "../tests/ajudasSom";

// Prints do lote MU3 (o seletor segmentado nas abas da mesa de som e da configuração, a ficha com o "Ficha de", e o zoom
// acima da faixa), em Grimório e Pergaminho (claro). Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints mu3
// O print da ficha leva o sufixo de ROTULO_DA_FICHA ("antes" ou "depois", padrão "depois").

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });
const ROTULO_DA_FICHA = process.env.ROTULO_DA_FICHA ?? "depois";

const CASOS = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const EFEITOS = ["Aura de fogo", "Ohhh da roda", "Deslizamento"];
const AMBIENTES = ["Taverna viva", "Mata ao luar"];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

for (const caso of CASOS) {
  base(`mu3 mesa de som ${caso.tema} ${caso.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: caso.width, height: caso.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${caso.tema}-${caso.nome}`;
      const m = (await entrarNoMapa(mesa, "mestre")).pagina;
      await escolherTema(m, caso.tema);

      for (const [i, nome] of EFEITOS.entries()) {
        await configurarLugar(m, "efeito", i, arquivoWav(`e${i}.wav`, 2), nome);
      }
      for (const [i, nome] of AMBIENTES.entries()) {
        await configurarLugar(m, "ambiente", i, arquivoWav(`a${i}.wav`, 6), nome);
      }
      // a configuração nas duas abas
      await foto(m, `mu3-${rotulo}-config-efeitos`);
      await m.getByTestId("som-config-aba-musica").click();
      await foto(m, `mu3-${rotulo}-config-musica`);
      await m.getByTestId("som-config-aba-lugares").click();
      await m.getByTestId("som-config-pronto").click();

      // a faixa nas duas abas, com o zoom acima
      await m.getByTestId("som-encaixar").click();
      await expect(m.getByTestId("som-faixa")).toBeVisible();
      await m.getByTestId("som-ambiente-ligar-0").click();
      await m.getByTestId("som-transporte").click();
      await m.getByTestId("som-aba-musica").click();
      await foto(m, `mu3-${rotulo}-faixa-musica`);
      await m.getByTestId("som-aba-efeitos").click();
      await foto(m, `mu3-${rotulo}-faixa-efeitos-zoom-aberta`);
      await m.getByTestId("som-faixa-recolher").click();
      await foto(m, `mu3-${rotulo}-faixa-zoom-recolhida`);
    } finally {
      await mesa.fechar();
    }
  });
}

base(
  `mu3 ficha com o seletor (${ROTULO_DA_FICHA}) grimorio e claro`,
  async ({ browser, request }) => {
    base.setTimeout(180_000);
    for (const tema of ["grimorio", "claro"]) {
      const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const m = (await entrarNoMapa(mesa, "mestre")).pagina;
        await escolherTema(m, tema);
        await abrirAba(m, "fichas");
        await m.getByTestId("ficha-abrir-pers-ogro").dblclick();
        const janela = m.locator('[data-testid="janela-ficha"][data-personagem-id="pers-ogro"]');
        await expect(janela.getByTestId("npc-bloco")).toBeVisible();
        await janela.getByTestId("npc-configurar").click();
        await expect(janela.getByTestId("ficha-apresentacao-escolha")).toBeVisible();
        await foto(m, `mu3-ficha-${tema}-${ROTULO_DA_FICHA}`);
      } finally {
        await mesa.fechar();
      }
    }
  },
);
