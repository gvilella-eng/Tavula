import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { assets } from "../tests/ajudasAssets";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote Q2 (compêndio por seções, com blocos e busca em português e inglês): Grimório em 1600×900 e 1280×720,
// Pergaminho (claro) em 1600×900. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints q2
// Com `COMPENDIO_REAL` apontando para a pasta dos arquivos do mestre (fora do repositório), um print extra carrega
// os arquivos de verdade e anota o tempo de abrir as listas.

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

/** Magias inventadas, de vários níveis, para os blocos aparecerem (nada de livro). */
const MAGIAS_DE_TESTE = Array.from({ length: 40 }, (_, i) => {
  const nivel = i % 10;
  return {
    ...SRD.magias[0],
    nome: `Magia de teste ${String(i + 1).padStart(2, "0")}`,
    nomeOriginal: `Test spell ${i + 1}`,
    nivel,
    classes: i % 2 === 0 ? ["Mago", "Bruxo"] : ["Clérigo"],
    escola: i % 3 === 0 ? "Evocação" : "Abjuração",
  };
});
const MONSTROS_DE_TESTE = [
  { nome: "Rato Gigante", nomeOriginal: "Giant Rat", nd: "1/8", tipo: "Fera", tamanho: "Pequeno" },
  {
    nome: "Urso-coruja",
    nomeOriginal: "Owlbear",
    nd: "3",
    tipo: "Monstruosidade",
    tamanho: "Grande",
  },
  { nome: "Ogro", nomeOriginal: "Ogre", nd: "2", tipo: "Gigante", tamanho: "Grande" },
  { nome: "Esqueleto", nomeOriginal: "Skeleton", nd: "1/4", tipo: "Morto-vivo", tamanho: "Médio" },
  {
    nome: "Dragão Vermelho Jovem",
    nomeOriginal: "Young Red Dragon",
    nd: "10",
    tipo: "Dragão",
    tamanho: "Grande",
  },
].map((m) => ({ ...SRD.monstros[1], ...m }));
const COMPENDIO = JSON.stringify({
  ...SRD,
  magias: [...SRD.magias, ...MAGIAS_DE_TESTE],
  monstros: [...SRD.monstros, ...MONSTROS_DE_TESTE],
});

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
  console.log(`[Q2] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[Q2] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

for (const c of COMBINACOES) {
  base(`q2 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
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

      await tentar(`${rotulo} magias`, async () => {
        await m.getByTestId("compendio-bloco-magias-3-titulo").click();
        await expect(m.getByTestId("compendio-bloco-magias-3-titulo")).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        await foto(m, `${rotulo}-01-magias-por-nivel`);
      });

      await tentar(`${rotulo} monstros`, async () => {
        await m.getByTestId("compendio-secao-monstros").click();
        await expect(m.getByTestId("compendio-lista-monstros")).toBeVisible();
        await foto(m, `${rotulo}-02-monstros-por-nd`);
      });

      await tentar(`${rotulo} itens magicos`, async () => {
        await m.getByTestId("compendio-secao-itensMagicos").click();
        await expect(m.getByTestId("compendio-lista-entradas")).toBeVisible();
        await foto(m, `${rotulo}-03-itens-por-raridade`);
      });

      await tentar(`${rotulo} busca em ingles`, async () => {
        await m.getByTestId("compendio-secao-todas").click();
        await m.getByTestId("compendio-busca").fill("fire");
        await expect(m.getByTestId("compendio-todas")).toBeVisible();
        await foto(m, `${rotulo}-04-busca-em-ingles`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}

const REAL = process.env.COMPENDIO_REAL;
if (REAL && existsSync(join(REAL, "magias.json"))) {
  base("q2 arquivos reais (fora do repositório)", async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      for (const arq of ["magias", "monstros", "itens"]) {
        const caminho = join(REAL, `${arq}.json`);
        if (existsSync(caminho))
          await assets(
            m,
            "adicionarNaPasta",
            `compendio/${arq}.json`,
            readFileSync(caminho, "utf8"),
          );
      }
      let t = Date.now();
      await abrirAba(m, "compendio");
      await expect(m.getByTestId("compendio-lista")).toBeVisible({ timeout: 60_000 });
      // os três arquivos entram juntos: relê a pasta até a mesa juntar tudo (o seletor de seções aparece)
      await m.getByTestId("compendio-recarregar").click();
      await expect(m.getByTestId("compendio-secao-todas")).toBeVisible({ timeout: 60_000 });
      console.log(`[Q2 REAL] aba aberta com as listas fechadas: ${Date.now() - t} ms`);
      await foto(m, "real-01-magias-fechadas");
      t = Date.now();
      await m.getByTestId("compendio-bloco-magias-3-titulo").click();
      await expect(m.getByTestId("compendio-bloco-magias-3-titulo")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      console.log(
        `[Q2 REAL] bloco do 3º nível aberto (${await m.getByTestId("compendio-item").count()} linhas): ${Date.now() - t} ms`,
      );
      await foto(m, "real-02-magias-3o-nivel");
      t = Date.now();
      await m.getByTestId("compendio-secao-todas").click();
      await m.getByTestId("compendio-busca").fill("fire");
      await expect(m.getByTestId("compendio-todas")).toBeVisible();
      console.log(`[Q2 REAL] busca "fire" em Todas: ${Date.now() - t} ms`);
      await foto(m, "real-03-busca-fire");
      await m.getByTestId("compendio-busca").fill("");
      await m.getByTestId("compendio-secao-monstros").click();
      await foto(m, "real-04-monstros-por-nd");
      await m.getByTestId("compendio-secao-itensMagicos").click();
      await foto(m, "real-05-itens-por-raridade");
    } finally {
      await mesa.fechar();
    }
  });
}
