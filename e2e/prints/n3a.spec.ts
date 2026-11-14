import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { assets } from "../tests/ajudasAssets";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote N3a (compêndio com monstros e itens mágicos): Grimório em 1600×900 e 1280×720, Pergaminho (claro) em
// 1600×900. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints n3a

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

/** Mais alguns monstros inventados para o print mostrar a lista e o filtro de ND (nada de livro). */
const DE_TESTE = [
  { nome: "Rato Gigante", nd: "1/8", tipo: "Fera", tamanho: "Pequeno" },
  { nome: "Urso-coruja", nd: "3", tipo: "Monstruosidade", tamanho: "Grande" },
  { nome: "Ogro", nd: "2", tipo: "Gigante", tamanho: "Grande" },
  { nome: "Esqueleto", nd: "1/4", tipo: "Morto-vivo", tamanho: "Médio" },
].map((m) => ({ ...SRD.monstros[1], ...m, nomeOriginal: undefined }));
const COMPENDIO = JSON.stringify({ ...SRD, monstros: [...SRD.monstros, ...DE_TESTE] });

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
  console.log(`[N3a] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[N3a] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

for (const c of COMBINACOES) {
  base(`n3a ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const rotulo = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      await assets(m, "adicionarNaPasta", "compendio/magias.json", COMPENDIO);
      await abrirAba(m, "compendio");
      await expect(m.getByTestId("compendio-lista")).toBeVisible();

      await tentar(`${rotulo} monstros`, async () => {
        await m.getByTestId("compendio-secao-monstros").click();
        await expect(m.getByTestId("compendio-contagem")).toHaveText("7 monstros");
        await foto(m, `${rotulo}-01-monstros`);
        await m.getByTestId("compendio-monstro-nd-ate").selectOption("1/4");
        await expect(m.getByTestId("compendio-contagem")).toContainText("de 7 monstros");
        await foto(m, `${rotulo}-02-monstros-filtro-de-nd`);
        await m.getByTestId("compendio-limpar").click();
      });

      await tentar(`${rotulo} monstro aberto`, async () => {
        await m.locator('[data-testid="compendio-monstro"][data-nome="Mago"]').click();
        await expect(m.getByTestId("compendio-monstro-cartao")).toBeVisible();
        await foto(m, `${rotulo}-03-monstro-aberto`);
        await m.getByTestId("compendio-monstro-conjuracao").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-03b-monstro-conjuracao`, 300);
        await m.getByTestId("compendio-voltar").click();
      });

      await tentar(`${rotulo} npc criado`, async () => {
        await m
          .locator('[data-testid="compendio-monstro"][data-nome="Mago"]')
          .locator("xpath=ancestor::div[contains(@class,'entrada-do-compendio')]")
          .getByTestId("compendio-monstro-criar")
          .click();
        await expect(m.getByTestId("npc-bloco")).toBeVisible();
        await foto(m, `${rotulo}-04-npc-criado`, 700);
        await m.getByTestId("npc-fita-conjuracao").click();
        await foto(m, `${rotulo}-04b-npc-conjuracao`, 500);
        await m.getByTestId("janela-ficha-fechar").click();
      });

      await tentar(`${rotulo} itens magicos`, async () => {
        await m.getByTestId("compendio-secao-itensMagicos").click();
        await expect(m.getByTestId("compendio-contagem")).toHaveText("4 itens mágicos");
        await m
          .locator('[data-testid="compendio-entrada-itemMagico"][data-nome="Anel de Proteção"]')
          .click();
        await foto(m, `${rotulo}-05-itens-magicos-com-raridade`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
