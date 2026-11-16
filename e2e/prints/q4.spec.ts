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
import { entrarNoMapa } from "../tests/ajudasMapa";
import { arquivoWav, configurarLugar, esperarHashDoSom } from "../tests/ajudasSom";

// Prints do lote Q4 (a mesa de som): a janela com efeitos e ambientes tocando, a faixa no pé da tela e a configuração com
// um lugar aberto e a confirmação de apagar. Grimório em 1600×900 e 1280×720 e Pergaminho (claro) em 1600×900. Fora do
// `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints q4

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const EFEITOS = [
  { nome: "Espada", icone: "espadas", cor: "ambar" },
  { nome: "Porta", icone: "porta", cor: "laranja" },
  { nome: "Trovão", icone: "trovao", cor: "azul" },
  { nome: "Sino", icone: "sino", cor: "ambar" },
  { nome: "Passos", icone: "passos", cor: "pedra" },
  { nome: "Grito", icone: "caveira", cor: "vermelho" },
] as const;
const AMBIENTES = [
  { nome: "Taverna", icone: "multidao", cor: "ambar", volume: 0.7 },
  { nome: "Fogueira", icone: "chama", cor: "laranja", volume: 0.45 },
  { nome: "Chuva", icone: "gota", cor: "azul", volume: 0.6 },
  { nome: "Caverna", icone: "criatura", cor: "verde", volume: 0.5 },
  { nome: "Vento", icone: "vento", cor: "pedra", volume: 0.35 },
] as const;

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

async function tentar(nome: string, passo: () => Promise<void>) {
  try {
    await passo();
  } catch (e) {
    const msg = (e as Error).message.split("\n").slice(0, 3).join(" | ");
    falhas.push(`${nome}: ${msg}`);
    console.log(`[FALHOU] ${nome}: ${msg}`);
  }
}

base.afterAll(() => {
  console.log(`[Q4] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[Q4] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

for (const c of COMBINACOES) {
  base(`mesa de som ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);

      // monta a mesa: arquivos de durações diferentes (cada duração é um som), cada um num lugar
      await m.getByTestId("ferramenta-som").click();
      for (const [i, e] of EFEITOS.entries()) {
        await configurarLugar(m, "efeito", i, arquivoWav(`efeito-${i}.wav`, 20 + i), e.nome);
      }
      for (const [i, a] of AMBIENTES.entries()) {
        await configurarLugar(m, "ambiente", i, arquivoWav(`ambiente-${i}.wav`, 30 + i), a.nome);
      }
      for (const [i, e] of EFEITOS.entries()) {
        const hash = await esperarHashDoSom(m, `efeito-${i}.wav`);
        await enviarCru(
          m,
          intencaoCrua("som.lugar", {
            grupo: "efeito",
            indice: i,
            lugar: { hash, nome: e.nome, icone: e.icone, cor: e.cor, volume: 0.8 },
          }),
        );
      }
      for (const [i, a] of AMBIENTES.entries()) {
        const hash = await esperarHashDoSom(m, `ambiente-${i}.wav`);
        await enviarCru(
          m,
          intencaoCrua("som.lugar", {
            grupo: "ambiente",
            indice: i,
            lugar: { hash, nome: a.nome, icone: a.icone, cor: a.cor, volume: a.volume },
          }),
        );
      }
      await m.getByTestId("som-config-pronto").click();
      await expect(m.getByTestId("som-efeito-5")).toContainText("Grito");

      // 1: a janela, com um efeito tocando e dois ambientes ligados
      await tentar(`${rotulo} janela`, async () => {
        await m.getByTestId("som-ambiente-ligar-0").click();
        await m.getByTestId("som-ambiente-ligar-1").click();
        await m.getByTestId("som-efeito-2").click();
        await expect(m.getByTestId("som-efeito-barra-2")).toBeVisible();
        await foto(m, `${rotulo}-1-janela`);
      });

      // 2: a faixa no pé da tela
      await tentar(`${rotulo} faixa`, async () => {
        await m.getByTestId("som-encaixar").click();
        await expect(m.getByTestId("som-faixa")).toBeVisible();
        await foto(m, `${rotulo}-2-faixa`);
        await m.getByTestId("som-soltar").click();
        await expect(m.getByTestId("painel-som")).toBeVisible();
      });

      // 3: a configuração com um lugar aberto e a confirmação de apagar
      await tentar(`${rotulo} configuracao`, async () => {
        await m.getByTestId("som-config-abrir").click();
        await m.getByTestId("som-lugar-efeito-2").click();
        await foto(m, `${rotulo}-3-configuracao`);
        await m.getByTestId("som-config-apagar").click();
        await expect(m.getByTestId("som-config-confirma")).toBeVisible();
        await foto(m, `${rotulo}-4-apagar`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
