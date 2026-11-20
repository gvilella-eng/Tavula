import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";
import { arquivoWav, configurarLugar } from "../tests/ajudasSom";

// Prints do lote MU2 (a mesa de som em duas abas: "Efeitos e ambientes" e "Música", na faixa, na janela flutuante e com o
// nome do efeito em duas linhas), em Grimório e Pergaminho (claro) a 1366×768 e 1280×720. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints mu2

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const CASOS = [
  { tema: "grimorio", nome: "1366x768", width: 1366, height: 768 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1366x768", width: 1366, height: 768 },
  { tema: "claro", nome: "1280x720", width: 1280, height: 720 },
] as const;

const EFEITOS = ["Aura de fogo", "Ohhh da roda", "Deslizamento", "Faca na mesa", "Espada longa"];
const AMBIENTES = ["Taverna viva", "Mata ao luar", "Cripta fria"];
const MUSICAS = ["Lâminas no Vau", "O Trono Partido", "Taverna do Javali"];

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
  base(`mesa de som em abas ${caso.tema} ${caso.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: caso.width, height: caso.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${caso.tema}-${caso.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, caso.tema);

      for (const [i, nome] of EFEITOS.entries()) {
        await configurarLugar(m, "efeito", i, arquivoWav(`e${i}.wav`, 2), nome);
      }
      for (const [i, nome] of AMBIENTES.entries()) {
        await configurarLugar(m, "ambiente", i, arquivoWav(`a${i}.wav`, 6), nome);
      }
      // a biblioteca: três músicas e um botão "Combate"
      await m.getByTestId("som-config-aba-musica").click();
      await m
        .getByTestId("musica-adicionar-arquivo")
        .setInputFiles(MUSICAS.map((n, i) => arquivoWav(`${n}.wav`, 4 + i)));
      await expect(m.getByTestId("musica-linha")).toHaveCount(MUSICAS.length);
      for (const l of await m.getByTestId("musica-linha").all()) {
        await l.getByTestId("musica-marcar").click();
      }
      await m.getByTestId("musica-lote-mais").click();
      await m.getByTestId("musica-lote-mais-entrada").fill("Combate");
      await m.getByTestId("musica-lote-mais-aplicar").click();
      for (const l of await m.getByTestId("musica-linha").all()) {
        if (await l.getByTestId("musica-marcar").isChecked()) {
          await l.getByTestId("musica-marcar").click();
        }
      }
      await m.getByTestId("musica-etiqueta-Combate").click();
      await m.getByTestId("musica-salvar-botao").click();
      await m.getByTestId("musica-botao-nome").fill("Combate");
      await m.getByTestId("musica-botao-confirmar").click();
      await m.getByTestId("som-config-pronto").click();

      // a janela flutuante, nas duas abas
      await foto(m, `mu2-${rotulo}-janela-efeitos`);
      await m.getByTestId("som-aba-musica").click();
      await foto(m, `mu2-${rotulo}-janela-musica`);

      // a faixa: um ambiente ligado e a música tocando, vendo cada aba com o ponto na outra
      await m.getByTestId("som-encaixar").click();
      await expect(m.getByTestId("som-faixa")).toBeVisible();
      await m.getByTestId("som-aba-efeitos").click();
      await m.getByTestId("som-ambiente-ligar-0").click();
      await m.getByTestId("som-ambiente-ligar-1").click();
      await foto(m, `mu2-${rotulo}-faixa-efeitos-parada`);
      await m.getByTestId("som-aba-musica").click();
      await m.getByTestId("musica-botao").first().click();
      await expect(m.getByTestId("musica-atual")).toBeVisible();
      await foto(m, `mu2-${rotulo}-faixa-musica`);
      await m.getByTestId("som-transporte").click();
      await m.getByTestId("som-aba-efeitos").click();
      await m.getByTestId("som-efeito-0").click();
      await foto(m, `mu2-${rotulo}-faixa-efeitos`);
    } finally {
      await mesa.fechar();
    }
  });
}
