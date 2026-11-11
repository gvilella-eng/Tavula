import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { ligarOrdem, linha } from "../tests/ajudasCombate";
import { DARION_ID, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, soSelecionarToken } from "../tests/ajudasMapa";

// Prints do lote R5b do redesign (combate, fichas, compêndio e PDF), nos temas Grimório, Edgerunner e
// Pergaminho, em 1600×900 e 1280×720: a ordem de turno do mestre (Montar aberto e fechado) e a do jogador,
// a dica de um botão desabilitado, a aba Fichas, o compêndio vazio (mestre e jogador) e com o exemplo do SRD,
// e a revisão do PDF (alto com destino e contagem, seções recolhidas). Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints r5b

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const PDF_DO_DARION = fileURLToPath(
  new URL("../../fixtures/fichas/darion.pdf", import.meta.url),
);
const TEMAS = ["grimorio", "escuro", "claro"] as const;
const TAMANHOS = [
  { nome: "1600x900", width: 1600, height: 900 },
  { nome: "1280x720", width: 1280, height: 720 },
] as const;

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

/** Roda um passo; se falhar, registra e segue (um print que falha não derruba os outros). */
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
  console.log(`[R5b] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[R5b] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

for (const tamanho of TAMANHOS) {
  for (const tema of TEMAS) {
    base(`combate ${tema} ${tamanho.nome}`, async ({ browser, request }) => {
      base.setTimeout(300_000);
      const mesa = new Mesa(browser, {
        viewport: { width: tamanho.width, height: tamanho.height },
      });
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const ms = await entrarNoMapa(mesa, "mestre");
        const js = await entrarNoMapa(mesa, "jogador-1");
        const m = ms.pagina;
        const j = js.pagina;
        const rotulo = `${tema}-${tamanho.nome}`;
        await escolherTema(m, tema);
        await escolherTema(j, tema);

        await soSelecionarToken(m, "tok-ogro");
        await ligarOrdem(m);
        await m.getByTestId("ordem-adicionar-grupo").click();
        await expect(linha(m, "Cael")).toBeVisible();
        await m.getByTestId("ordem-adicionar-selecionados").click();
        await expect(linha(m, "Ogro")).toBeVisible();

        // 1: ordem do mestre com a seção Montar aberta (antes de começar)
        await tentar(`${rotulo} ordem montar aberto`, async () => {
          await foto(m, `${rotulo}-01-ordem-mestre-montar-aberto`);
        });

        // 4: dica de um botão desabilitado (todos já têm valor)
        await tentar(`${rotulo} dica desabilitado`, async () => {
          await m.getByTestId("ordem-rolar-todos").click();
          await expect(m.getByTestId("ordem-rolar-todos")).toHaveAttribute("aria-disabled", "true");
          await m.mouse.move(0, 0);
          await m.getByTestId("ordem-rolar-todos").hover();
          await expect(m.getByTestId("dica-ordem-rolar-todos")).toBeVisible();
          await foto(m, `${rotulo}-04-dica-botao-desabilitado`);
          await m.mouse.move(0, 0);
        });

        // 3: a ordem do jogador (sem os comandos do mestre)
        await tentar(`${rotulo} ordem jogador`, async () => {
          await expect(j.getByTestId("ordem-de-turno")).toBeVisible();
          await foto(j, `${rotulo}-03-ordem-jogador`);
        });

        // 2: o combate começa e Montar se recolhe: sobra uma linha de turno
        await tentar(`${rotulo} ordem montar fechado`, async () => {
          await m.getByTestId("ordem-proximo").click();
          await expect(m.getByTestId("ordem-rodada")).toHaveAttribute("data-rodada", "1");
          await expect(m.getByTestId("ordem-montar-alternar")).toHaveAttribute(
            "aria-expanded",
            "false",
          );
          await foto(m, `${rotulo}-02-ordem-mestre-montar-fechado`);
        });

        // 5: aba Fichas (o item diz "Abrir a ficha" na dica nativa do navegador, que o print não mostra)
        await tentar(`${rotulo} aba fichas`, async () => {
          await abrirAba(m, "fichas");
          const item = m.getByTestId("ficha-abrir-pers-aldric");
          await item.hover();
          await foto(m, `${rotulo}-05-aba-fichas`);
        });

        // 6 e 7: compêndio vazio (mestre e jogador); 8: com o exemplo
        await tentar(`${rotulo} compendio vazio`, async () => {
          await abrirAba(m, "compendio");
          await abrirAba(j, "compendio");
          await expect(m.getByTestId("compendio-usar-exemplo")).toBeVisible();
          await expect(j.getByTestId("compendio-vazio-jogador")).toBeVisible();
          await foto(m, `${rotulo}-06-compendio-vazio-mestre`);
          await foto(j, `${rotulo}-07-compendio-vazio-jogador`, 100);
        });
        await tentar(`${rotulo} compendio exemplo`, async () => {
          await m.getByTestId("compendio-usar-exemplo").click();
          await expect(m.getByTestId("compendio-lista")).toBeVisible();
          await expect(j.getByTestId("compendio-lista")).toBeVisible();
          await foto(m, `${rotulo}-08-compendio-com-exemplo`);
        });

        // 9 e 10: a revisão do PDF (destino e contagem no alto; seções recolhidas com resumo)
        await tentar(`${rotulo} revisao pdf`, async () => {
          await mandar(m, "personagem.criar", {
            personagem: {
              id: DARION_ID,
              pastaId: "pasta-personagens",
              editores: { tipo: "jogadores", ids: ["jogador-1"] },
              nome: "Darion",
              tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
              visao: { alcanceM: null, visaoNoEscuroM: 10 },
              ficha: { pvAtual: 10, pvMax: 10, raca: "Humano" },
            },
          });
          await abrirAba(m, "fichas");
          const [seletor] = await Promise.all([
            m.waitForEvent("filechooser"),
            m.getByTestId("ficha-novo-pdf").click(),
          ]);
          await seletor.setFiles(PDF_DO_DARION);
          await expect(m.getByTestId("revisao-pdf")).toBeVisible();
          await foto(m, `${rotulo}-09-pdf-revisao-alto`);
          await m.getByTestId("revisao-sugestao-usar").click();
          const resumo = m.locator('[data-testid^="revisao-resumo-"]').first();
          await resumo.scrollIntoViewIfNeeded();
          await foto(m, `${rotulo}-10-pdf-revisao-secoes-recolhidas`);
          await m.getByTestId("revisao-cancelar").click();
        });
      } finally {
        await mesa.fechar();
      }
    });
  }
}
