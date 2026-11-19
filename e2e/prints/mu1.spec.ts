import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";
import { arquivoWav, configurarLugar } from "../tests/ajudasSom";

// Prints do lote MU1 (a música da mesa: a seção Música com o divisor na faixa e na janela, a biblioteca com etiquetas e o
// lote), em Grimório 1600×900 e 1280×720 e Pergaminho (claro) 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints mu1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const CASOS = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const NOMES = [
  "Lâminas no Vau",
  "O Trono Partido",
  "Garras na Neve",
  "Taverna do Javali",
  "Cripta Silenciosa",
];

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
  base(`música ${caso.tema} ${caso.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: caso.width, height: caso.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${caso.tema}-${caso.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, caso.tema);

      // dois efeitos e um ambiente, para a mesa de som não ficar vazia
      await configurarLugar(m, "efeito", 0, arquivoWav("sopro.wav", 2), "Sopro");
      await configurarLugar(m, "efeito", 1, arquivoWav("trovao.wav", 3), "Trovão");
      await configurarLugar(m, "ambiente", 0, arquivoWav("taverna.wav", 6), "Taverna");
      await m.getByTestId("som-config-aba-musica").click();
      await m
        .getByTestId("musica-adicionar-arquivo")
        .setInputFiles(NOMES.map((n, i) => arquivoWav(`${n}.wav`, 4 + i)));
      await expect(m.getByTestId("musica-linha")).toHaveCount(NOMES.length);
      const marcar = async (...nomes: string[]) => {
        for (const l of await m.getByTestId("musica-linha").all()) {
          const quer = nomes.includes((await l.getAttribute("data-nome")) ?? "");
          if ((await l.getByTestId("musica-marcar").isChecked()) !== quer) {
            await l.getByTestId("musica-marcar").click();
          }
        }
      };
      const etiquetar = async (etiqueta: string, energia: number, ...nomes: string[]) => {
        await marcar(...nomes);
        await m.getByTestId("musica-lote-mais").click();
        await m.getByTestId("musica-lote-mais-entrada").fill(etiqueta);
        await m.getByTestId("musica-lote-mais-aplicar").click();
        await m.getByTestId("musica-lote-energia").click();
        await m.getByTestId(`musica-lote-energia-${energia}`).click();
      };
      await etiquetar("Combate", 4, NOMES[0] as string, NOMES[2] as string);
      await etiquetar("Chefe", 5, NOMES[1] as string);
      await etiquetar("Taverna", 2, NOMES[3] as string);
      await etiquetar("Masmorra", 1, NOMES[4] as string);
      // o chefe também é combate
      await marcar(NOMES[1] as string);
      await m.getByTestId("musica-lote-mais").click();
      await m.getByTestId("musica-lote-mais-entrada").fill("Combate");
      await m.getByTestId("musica-lote-mais-aplicar").click();
      await m.getByTestId("musica-ordem-crescente").click();
      await m.getByTestId("musica-etiqueta-Combate").click();
      await m.getByTestId("musica-salvar-botao").click();
      await m.getByTestId("musica-botao-nome").fill("Combate");
      await m.getByTestId("musica-botao-confirmar").click();
      await m.getByTestId("musica-etiqueta-Combate").click();
      for (const [etiqueta, nome] of [
        ["Chefe", "Chefe"],
        ["Taverna", "Taverna"],
        ["Masmorra", "Masmorra"],
      ] as const) {
        await m.getByTestId(`musica-etiqueta-${etiqueta}`).click();
        await m.getByTestId("musica-ordem-aleatoria").click();
        await m.getByTestId("musica-salvar-botao").click();
        await m.getByTestId("musica-botao-nome").fill(nome);
        await m.getByTestId("musica-botao-confirmar").click();
        await m.getByTestId(`musica-etiqueta-${etiqueta}`).click();
      }
      // a biblioteca com o filtro de uma etiqueta, duas músicas marcadas e a barra de lote
      await m.getByTestId("musica-etiqueta-Combate").click();
      await marcar(NOMES[0] as string, NOMES[2] as string);
      await m.getByTestId("musica-lote-menos").click();
      await foto(m, `mu1-${rotulo}-biblioteca`);
      await marcar();
      await m.getByTestId("musica-etiqueta-Combate").click();
      await m.getByTestId("som-config-pronto").click();

      // a janela flutuante, tocando o botão crescente
      await m.getByTestId("musica-botao").first().click();
      await expect(m.getByTestId("musica-atual")).toBeVisible();
      await foto(m, `mu1-${rotulo}-janela`);

      // a faixa no pé da tela, com o divisor a 60% e depois com a música minimizada
      await m.getByTestId("som-encaixar").click();
      await expect(m.getByTestId("som-faixa")).toBeVisible();
      await m.getByTestId("som-divisor").focus();
      await m.keyboard.press("ArrowRight");
      await m.keyboard.press("ArrowRight");
      await foto(m, `mu1-${rotulo}-faixa`);
      await m.getByTestId("musica-botao").nth(1).click();
      await foto(m, `mu1-${rotulo}-faixa-voltar`);
      await m.getByTestId("som-minimizar-musica").click();
      await foto(m, `mu1-${rotulo}-faixa-minimizada`);
    } finally {
      await mesa.fechar();
    }
  });
}
