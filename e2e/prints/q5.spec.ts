import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { fonteComSemente, rolarAtaque } from "../../packages/shared/src/index.ts";
import { abrirAba, abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { mandar } from "../tests/ajudasFicha";

// Prints do lote Q5 (rolagens do chat: Fita e Moldura). Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints q5

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

async function semente(p: Page, n: number) {
  expect((await p.request.post(`/teste/dados?semente=${n}`)).ok()).toBe(true);
}

const ATAQUE = {
  nome: "Machadinha",
  bonus: 5,
  dano: "1d6+3",
  danoTipo: "Cortante",
  vantagem: "normal" as const,
};

function acharCritico(): number {
  for (let s = 1; s < 4000; s++) {
    const r = rolarAtaque(ATAQUE, fonteComSemente(s));
    if (r.ok && r.resultado.critico) return s;
  }
  throw new Error("sem semente");
}

for (const c of COMBINACOES) {
  for (const estilo of ["fita", "moldura"] as const) {
    base(`rolagens ${estilo} ${c.tema} ${c.nome}`, async ({ browser, request }) => {
      base.setTimeout(240_000);
      const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const s = await mesa.entrar("mestre");
        const p = s.pagina;
        await abrirPreferencia(p, "aparencia");
        await p.getByTestId(`tema-${c.tema}`).check({ force: true });
        await p.getByTestId(`estilo-rolagem-${estilo}`).check({ force: true });
        await foto(p, `preferencia-${estilo}-${c.tema}-${c.nome}`);
        await abrirAba(p, "chat");

        await mandar(p, "chat.modelo", { modelo: "teste", nome: "Teste de Força", bonus: 3 });
        await mandar(p, "chat.modelo", {
          modelo: "teste",
          nome: "Teste de Força",
          bonus: 3,
          vantagem: "vantagem",
        });
        await mandar(p, "chat.modelo", {
          modelo: "ataque",
          nome: "Cimitarra",
          bonus: 4,
          dano: "1d6+2",
          danoTipo: "Cortante",
          vantagem: "desvantagem",
        });
        await semente(p, acharCritico());
        await mandar(p, "chat.modelo", { modelo: "ataque", ...ATAQUE, danoCritico: undefined });
        await request.post("/teste/dados");
        await mandar(p, "chat.modelo", {
          modelo: "ataque",
          nome: "Chama Sagrada",
          bonus: 0,
          dano: "2d8",
          danoTipo: "Radiante",
          salvaguarda: { cd: 14, atributo: "Destreza", sucesso: "metade" },
        });
        await mandar(p, "chat.enviar", {
          texto: "/r 1d4+1 Mísseis Mágicos, Força",
          espaco: { nivel: 2, quantidade: { total: 4, unidade: "dardo", cada: "1d4+1" } },
        });
        await mandar(p, "chat.enviar", { texto: "/r 2d6+3" });
        await mandar(p, "chat.modelo", {
          modelo: "teste",
          nome: "Furtividade do goblin",
          bonus: 4,
          oculta: true,
        });
        await expect(p.getByTestId("chat-mensagem")).toHaveCount(8);
        await p.mouse.move(5, 5);
        await foto(p, `chat-${estilo}-${c.tema}-${c.nome}`);

        // o balão: sobre a vantagem, o ataque crítico e os dardos
        for (const [i, nome] of [
          [1, "vantagem"],
          [3, "critico"],
          [5, "dardos"],
        ] as const) {
          await p.getByTestId("chat-mensagem").nth(i).locator(".rc").hover();
          await expect(p.getByTestId("rolagem-balao")).toBeVisible();
          await foto(p, `balao-${nome}-${estilo}-${c.tema}-${c.nome}`);
          await p.mouse.move(5, 5);
        }
      } finally {
        await mesa.fechar();
      }
    });
  }
}
