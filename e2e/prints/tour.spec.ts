import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";

// Prints do lote T (o tour de introdução): Grimório em 1600×900 e 1280×720 e Pergaminho ("claro") em 1600×900.
// Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints tour

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const tiradas: string[] = [];

async function foto(p: Page, nome: string) {
  await expect(p.getByTestId("tour-cartao")).toHaveAttribute("data-pronto", "sim");
  await p.waitForTimeout(300);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

async function irAte(p: Page, passo: string) {
  for (let i = 0; i < 12; i++) {
    if ((await p.getByTestId("tour").getAttribute("data-passo")) === passo) return;
    await p.getByTestId("tour-proximo").click();
    await p.waitForTimeout(150);
  }
  throw new Error(`passo ${passo} não encontrado`);
}

base.afterAll(() => {
  console.log(`[T] ${tiradas.length} prints: ${tiradas.join(", ")}`);
});

for (const c of COMBINACOES) {
  base(`tour ${c.tema} ${c.nome}`, async ({ browser }) => {
    base.setTimeout(180_000);
    const rotulo = `${c.tema}-${c.nome}`;
    const viewport = { width: c.width, height: c.height };

    // mestre
    const mm = new Mesa(browser, { viewport });
    try {
      const m = await mm.abrir();
      const p = m.pagina;
      await p.addInitScript((t) => localStorage.setItem("tabletop:pref:tema", t), c.tema);
      await p.goto("/m/t3st-m3sa-e2e7");
      await p.getByTestId("entrar-mestre").click();
      await expect(p.getByTestId("eu-nome")).toBeVisible();
      await abrirAba(p, "preferencias");
      await p.getByTestId("tour-refazer").click();
      await foto(p, `${rotulo}-mestre-1-boas-vindas`);
      await irAte(p, "paredes");
      await foto(p, `${rotulo}-mestre-5-paredes`);
      await irAte(p, "contas");
      await foto(p, `${rotulo}-mestre-10-contas`);
    } finally {
      await mm.fechar();
    }

    // jogador
    const jm = new Mesa(browser, { viewport });
    try {
      const j = await jm.abrir();
      const p = j.pagina;
      await p.addInitScript((t) => localStorage.setItem("tabletop:pref:tema", t), c.tema);
      await p.goto("/m/t3st-m3sa-e2e7");
      await p.getByTestId("entrar-jogador-1").click();
      await expect(p.getByTestId("eu-nome")).toBeVisible();
      await abrirAba(p, "preferencias");
      await p.getByTestId("tour-refazer").click();
      await irAte(p, "mapa");
      await foto(p, `${rotulo}-jogador-2-mapa`);
      await irAte(p, "regua");
      // a régua fica na borda esquerda e o cartão perto da borda: o mais apertado em 1280×720
      await foto(p, `${rotulo}-jogador-5-regua-cartao-na-borda`);
      await irAte(p, "preferencias");
      await foto(p, `${rotulo}-jogador-6-preferencias`);
    } finally {
      await jm.fechar();
    }
  });
}
