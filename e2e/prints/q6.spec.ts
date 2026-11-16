import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { assets } from "../tests/ajudasAssets";
import { entrarNoMapa } from "../tests/ajudasMapa";
import { arquivoWav, configurarLugar } from "../tests/ajudasSom";

// Prints do lote Q6 (Q2b + Q4b): o compêndio com os blocos fechados e os botões, uma busca com erro de digitação; a mesa
// de som vazia, com o transporte, a faixa em duas alturas, a configuração por cima da faixa e a mesa de som na janela
// própria. Grimório em 1600×900 e 1280×720 e Pergaminho (claro) em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints q6

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const SRD = JSON.parse(
  readFileSync(new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url), "utf8"),
);
const ENCHIMENTO = [
  ...Array.from({ length: 6 }, (_, i) => ({ nivel: 0, n: i })),
  ...Array.from({ length: 24 }, (_, i) => ({ nivel: 2, n: i })),
].map(({ nivel, n }) => ({
  nome: `Teste ${nivel === 0 ? "Truque" : "Segundo"} ${String(n).padStart(2, "0")}`,
  nomeOriginal: `Test ${nivel === 0 ? "Cantrip" : "Second"} ${n}`,
  nivel,
  escola: n % 2 === 0 ? "Necromancia" : "Ilusão",
  tempo: "1 ação",
  alcance: "9 m",
  componentes: "V",
  duracao: "Instantânea",
  concentracao: false,
  ritual: false,
  classes: n % 2 === 0 ? ["Bruxo"] : ["Druida"],
  descricao: "Texto de teste.",
}));
const COMPENDIO = JSON.stringify({ ...SRD, magias: [...SRD.magias, ...ENCHIMENTO] });

const LUGARES_EFEITO = ["Espada", "Porta", "Trovão", "Sino", "Passos", "Grito"];
const LUGARES_AMBIENTE = ["Taverna", "Fogueira", "Chuva", "Caverna", "Vento"];

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
  console.log(`[Q6] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[Q6] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

for (const c of COMBINACOES) {
  base(`q6 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);

      // Compêndio: os blocos fechados e os botões; uma busca com erro de digitação
      await tentar(`${rotulo} compendio`, async () => {
        await assets(m, "adicionarNaPasta", "compendio/magias.json", COMPENDIO);
        await abrirAba(m, "compendio");
        await expect(m.getByTestId("compendio-lista")).toBeVisible();
        await m.getByTestId("compendio-barra-mestre").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-1-compendio-blocos-e-botoes`);
        await m.getByTestId("compendio-busca").fill("foggo");
        await expect(m.getByTestId("compendio-item")).toHaveCount(1);
        await foto(m, `${rotulo}-2-compendio-busca-foggo`);
        await m.getByTestId("compendio-busca").fill("");
        await abrirAba(m, "chat");
      });

      // A mesa de som vazia (janela) e a faixa vazia
      await tentar(`${rotulo} som vazio`, async () => {
        await m.getByTestId("ferramenta-som").click();
        await expect(m.getByTestId("som-vazio-geral")).toBeVisible();
        await foto(m, `${rotulo}-3-som-vazio-janela`);
        await m.getByTestId("som-encaixar").click();
        await expect(m.getByTestId("som-faixa")).toBeVisible();
        await foto(m, `${rotulo}-4-som-vazio-faixa`);
        await m.getByTestId("som-soltar").click();
      });

      // Monta a mesa de som
      for (const [i, nome] of LUGARES_EFEITO.entries()) {
        await configurarLugar(m, "efeito", i, arquivoWav(`efeito-${i}.wav`, 20 + i), nome);
      }
      for (const [i, nome] of LUGARES_AMBIENTE.entries()) {
        await configurarLugar(m, "ambiente", i, arquivoWav(`ambiente-${i}.wav`, 30 + i), nome);
      }
      await m.getByTestId("som-config-pronto").click();
      await expect(m.getByTestId("som-efeito-5")).toContainText("Grito");

      // O transporte: ambientes marcados e parado, e tocando
      await tentar(`${rotulo} transporte`, async () => {
        await m.getByTestId("som-ambiente-ligar-0").click();
        await m.getByTestId("som-ambiente-ligar-2").click();
        await foto(m, `${rotulo}-5-transporte-parado`);
        await m.getByTestId("som-transporte").click();
        await expect(m.getByTestId("som-transporte")).toHaveAttribute("data-tocando", "sim");
        await foto(m, `${rotulo}-6-transporte-tocando`);
      });

      // A faixa em duas alturas
      await tentar(`${rotulo} faixa alturas`, async () => {
        await m.getByTestId("som-encaixar").click();
        await expect(m.getByTestId("som-faixa")).toBeVisible();
        await foto(m, `${rotulo}-7-faixa-altura-cheia`);
        await m.getByTestId("som-faixa-alca").focus();
        await m.keyboard.press("Shift+ArrowDown");
        await foto(m, `${rotulo}-8-faixa-menor`);
        await m.keyboard.press("End");
        await foto(m, `${rotulo}-9-faixa-minima-com-rolagem`);
        await m.keyboard.press("Shift+ArrowDown");
        await m.keyboard.press("Home");
      });

      // A configuração por cima da faixa
      await tentar(`${rotulo} config sobre a faixa`, async () => {
        await m.getByTestId("som-config-abrir").click();
        await expect(m.getByTestId("som-config")).toBeVisible();
        await m.getByTestId("som-lugar-ambiente-0").click();
        await foto(m, `${rotulo}-10-config-por-cima-da-faixa`);
        await m.getByTestId("som-config-pronto").click();
        await m.getByTestId("som-soltar").click();
      });

      // A mesa de som na janela própria do navegador
      await tentar(`${rotulo} janela propria`, async () => {
        const [popup] = await Promise.all([
          ms.contexto.waitForEvent("page"),
          m.getByTestId("som-abrir-em-janela").click(),
        ]);
        await expect(popup.getByTestId("som-propria")).toBeVisible();
        await popup.setViewportSize({ width: 460, height: 720 });
        await foto(popup, `${rotulo}-11-janela-propria`);
        await popup.close();
      });
    } finally {
      await mesa.fechar();
    }
  });
}
