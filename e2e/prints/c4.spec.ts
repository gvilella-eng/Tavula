import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirAbaInicial,
  test as base,
  continuarParaAPasta,
  expect,
  Mesa,
  preencherMesaEConta,
} from "../tests/ajudas";

// Prints do lote C4 (tela inicial no modelo B, o cartão com abas): Grimório em 1600×900 e 1280×720 e Pergaminho
// ("claro") em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints c4

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const tiradas: string[] = [];

async function foto(p: Page, nome: string, espera = 400) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

base.afterAll(() => {
  console.log(`[C4] ${tiradas.length} prints: ${tiradas.join(", ")}`);
});

const DIA = 86_400_000;

for (const c of COMBINACOES) {
  base(`c4 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(120_000);
    const rotulo = `${c.tema}-${c.nome}`;
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const p = (await mesa.abrir()).pagina;
      await p.addInitScript((t) => localStorage.setItem("tabletop:pref:tema", t), c.tema);
      // mesas lembradas neste navegador, para a lista ter "aberta hoje", "ontem" e "há N dias"
      await p.addInitScript(
        ([agora, dia]) => {
          if (localStorage.getItem("tabletop:mesas")) return;
          localStorage.setItem(
            "tabletop:mesas",
            JSON.stringify([
              { id: "t3st-m3sa-e2e7", nome: "Campanha", ultimaVez: (agora as number) - 3_600_000 },
              {
                id: "k7m2-qx9p-4tdn",
                nome: "Mesa de teste",
                ultimaVez: (agora as number) - (dia as number),
              },
              {
                id: "m4ph-7rcz-2kvd",
                nome: "One-shot: A Cripta dos Sussurros e das Sombras Antigas",
                ultimaVez: (agora as number) - 12 * (dia as number),
              },
            ]),
          );
        },
        [Date.now(), DIA],
      );

      await p.goto("/");
      await expect(p.getByTestId("inicio-mesas-lista")).toBeVisible();
      await foto(p, `${rotulo}-01-minhas-mesas`);

      await abrirAbaInicial(p, "entrar");
      await foto(p, `${rotulo}-02-entrar-com-codigo`);
      await p.getByTestId("inicio-entrar-campo").fill("campanha");
      await p.getByTestId("inicio-entrar-botao").click();
      await expect(p.getByTestId("inicio-entrar-erro")).toBeVisible();
      await foto(p, `${rotulo}-03-entrar-com-erro`, 200);

      await preencherMesaEConta(p, {
        mesa: "A Masmorra dos Ecos",
        login: "vilela",
        nome: "Vilela",
        senha: "senha-boa-1",
        confirmar: "senha-boa-2",
      });
      await foto(p, `${rotulo}-04-criar-passo-1`);
      await p.getByTestId("inicio-criar-continuar").click();
      await expect(p.getByTestId("inicio-criar-erro")).toBeVisible();
      await foto(p, `${rotulo}-05-criar-passo-1-com-erro`, 200);
      await p.getByTestId("inicio-criar-confirmar").fill("senha-boa-1");
      await continuarParaAPasta(p);
      await foto(p, `${rotulo}-06-criar-passo-2`);
      await p.getByTestId("inicio-criar-botao").click();
      await expect(p.getByTestId("inicio-criada-id")).toBeVisible();
      await foto(p, `${rotulo}-07-mesa-criada`);
      await p.getByTestId("codigo-anotei").check();
      await foto(p, `${rotulo}-08-mesa-criada-anotado`, 200);

      // a lista vazia: sem lista do servidor e sem mesas lembradas
      const q = (await mesa.abrir()).pagina;
      await q.addInitScript((t) => localStorage.setItem("tabletop:pref:tema", t), c.tema);
      await q.route("**/api/mesas", (rota) =>
        rota.request().method() === "GET"
          ? rota.fulfill({ status: 404, body: "Não encontrado" })
          : rota.fallback(),
      );
      await q.goto("/");
      await expect(q.getByTestId("inicio-aba-entrar")).toHaveAttribute("aria-selected", "true");
      await abrirAbaInicial(q, "mesas");
      await expect(q.getByTestId("inicio-mesas-vazio")).toBeVisible();
      await foto(q, `${rotulo}-09-lista-vazia`);
    } finally {
      await mesa.fechar();
    }
  });
}
