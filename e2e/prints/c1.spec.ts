import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";

// Prints do lote C1 (várias mesas, id amigável e a tela inicial): Grimório em 1600×900 e 1280×720 e
// Pergaminho ("claro") em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints c1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const tiradas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

base.afterAll(() => {
  console.log(`[C1] ${tiradas.length} prints: ${tiradas.join(", ")}`);
});

for (const c of COMBINACOES) {
  base(`c1 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(180_000);
    const rotulo = `${c.tema}-${c.nome}`;
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      // uma mesa já existente para a lista não ficar só com a campanha
      const feita = await request.post("/api/mesas", { data: { nome: "A Masmorra dos Ecos" } });
      expect(feita.ok()).toBe(true);

      const s = await mesa.abrir();
      const p = s.pagina;
      await p.addInitScript((t) => localStorage.setItem("tabletop:pref:tema", t), c.tema);

      // 1. a tela inicial com a lista
      await p.goto("/");
      await expect(p.getByTestId(`inicio-mesa-${(await feita.json()).id}`)).toBeVisible();
      await foto(p, `${rotulo}-01-tela-inicial-com-lista`);

      // 2. a mesa recém-criada, com o id grande
      await p.getByTestId("inicio-criar-nome").fill("Crônicas de Távola");
      await p.getByTestId("inicio-criar-botao").click();
      await expect(p.getByTestId("inicio-criada-id")).toBeVisible();
      const id = (await p.getByTestId("inicio-criada-id").textContent()) ?? "";
      await foto(p, `${rotulo}-02-mesa-criada-com-id-grande`);

      // 3. a aba Mesa, com o nome e o id
      await p.getByTestId("inicio-abrir-mesa").click();
      await p.getByTestId("entrar-mestre").click();
      await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
      await abrirAba(p, "mesa");
      await expect(p.getByTestId("mesa-id")).toHaveText(id);
      await foto(p, `${rotulo}-03-aba-mesa-nome-e-id`);

      // 4. o id inexistente
      await p.goto("/m/k7m2-qx9p-4tdn");
      await expect(p.getByTestId("mesa-inexistente")).toBeVisible();
      await foto(p, `${rotulo}-04-id-inexistente`);
    } finally {
      await mesa.fechar();
    }
  });
}
