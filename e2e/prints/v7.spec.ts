import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { derivarSenha } from "../../packages/shared/src/contas.ts";
import { test as base, expect, ID_DA_MESA, Mesa } from "../tests/ajudas";

// Prints do lote V7 (fim das vagas "Jogador N"): Mesa → Papéis e Contas, o pedido com "Ficha dele", o "Quem vê"
// do handout com o chat aberto e o topo com as bolinhas. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v7
// Só Grimório e Pergaminho (claro), como pedem as regras dos lotes.

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const SENHA = "senha-boa-1";
const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 400) {
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
  console.log(`[V7] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V7] FALHAS:\n - ${falhas.join("\n - ")}`);
});

for (const c of COMBINACOES) {
  base(`v7 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await mesa.abrir();
      const m = ms.pagina;

      // a conta do mestre da Campanha (legada de teste)
      await m.goto(`/m/${ID_DA_MESA}`);
      await m.getByTestId("mestre-inicial-login").fill("mestre.real");
      await m.getByTestId("mestre-inicial-nome").fill("Gabriel Vilella");
      await m.getByTestId("mestre-inicial-senha").fill(SENHA);
      await m.getByTestId("mestre-inicial-confirmar").fill(SENHA);
      await m.getByTestId("mestre-inicial-criar").click();
      await m.getByTestId("codigo-anotei").check();
      await m.getByTestId("codigo-continuar").click();
      await m.getByTestId("oferta-agora-nao").click();
      await expect(m.getByTestId("eu-nome")).toBeVisible();
      await m.getByTestId("aba-preferencias").click();
      await m.getByTestId(`tema-${c.tema}`).check({ force: true });
      await expect(m.locator("html")).toHaveAttribute("data-tema", c.tema);
      await m.getByTestId("aba-chat").click();

      // dois pedidos de entrada, pela API, como a tela faz
      for (const [login, nome] of [
        ["uker", "Uker"],
        ["beto", "Beto"],
      ] as const) {
        const derivada = await derivarSenha(SENHA, ID_DA_MESA, login);
        const r = await request.post(`/api/m/${ID_DA_MESA}/conta/pedir`, {
          data: { login, nome, derivada },
        });
        expect(r.status()).toBeLessThan(300);
      }
      await expect(m.getByTestId("aviso-de-contas")).toHaveText("2 pedidos de entrada");

      await tentar(`${rotulo} pedido com Ficha dele`, async () => {
        await m.getByTestId("aviso-de-contas").click();
        await expect(m.getByTestId("conta-pedido-uker")).toBeVisible();
        await m.getByTestId("conta-ficha-uker").selectOption({ label: "Aldric" });
        await m.getByTestId("conta-pedido-uker").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-01-pedido-com-ficha-dele`);
      });

      await tentar(`${rotulo} depois de aceitar`, async () => {
        await m.getByTestId("conta-aceitar-uker").click();
        await expect(m.getByTestId("conta-status-uker")).toHaveText("Ativa");
        await m.getByTestId("conta-aceitar-beto").click();
        await expect(m.getByTestId("conta-status-beto")).toHaveText("Ativa");
        await m.getByTestId("mesa-ir-contas").click();
        await foto(m, `${rotulo}-02-contas-depois-de-aceitar`);
        await m.getByTestId("mesa-ir-papeis").click();
        await foto(m, `${rotulo}-03-papeis-so-quem-entrou`);
      });

      await tentar(`${rotulo} topo`, async () => {
        await m.getByTestId("topo").screenshot({
          path: join(PASTA as string, `${rotulo}-04-topo-com-as-bolinhas.png`),
        });
        tiradas.push(`${rotulo}-04-topo`);
      });

      await tentar(`${rotulo} quem vê do handout com o chat aberto`, async () => {
        await m.getByTestId("aba-fichas").click();
        await m.getByTestId("ficha-novo").click();
        await m.getByTestId("ficha-novo-handout").click();
        const janela = m.locator('[data-testid="janela-handout"]');
        await expect(janela).toBeVisible();
        await janela.getByTestId("handout-visib-todos").click();
        await m.getByTestId("aba-chat").click();
        await foto(m, `${rotulo}-05-quem-ve-do-handout-e-chat`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
