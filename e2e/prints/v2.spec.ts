import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, expect, Mesa } from "../tests/ajudas";
import { definirValor, ligarOrdem, linha } from "../tests/ajudasCombate";
import { abrirFicha, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, soSelecionarToken } from "../tests/ajudasMapa";

// Prints do lote V2 (ordem de turno simples): a ordem do mestre (vazia, com 6 entradas na rodada 2, editando um
// número, editando a rodada, confirmação do Limpar, botão direito numa linha), a do jogador e o jogador com o
// token selecionado clicando em Iniciativa na ficha. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v2

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const TEMAS = ["grimorio", "escuro", "claro", "edgerunner"] as const;
const TAMANHOS = [
  { nome: "1600x900", width: 1600, height: 900 },
  { nome: "1280x720", width: 1280, height: 720 },
] as const;

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
  console.log(`[V2] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V2] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

/** Recorte da janela da ordem (mais fácil de olhar que a tela inteira). */
async function recorte(p: Page, nome: string) {
  await p.waitForTimeout(300);
  await p.getByTestId("janela-ordem").screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

for (const tema of TEMAS) {
  for (const t of TAMANHOS) {
    // o jogador e o mestre vistos nos mesmos temas; o 1280×720 só nos três de sempre
    if (t.nome === "1280x720" && tema === "edgerunner") continue;
    base(`ordem ${tema} ${t.nome}`, async ({ browser, request }) => {
      base.setTimeout(240_000);
      const mesa = new Mesa(browser, { viewport: { width: t.width, height: t.height } });
      const rotulo = `${tema}-${t.nome}`;
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const ms = await entrarNoMapa(mesa, "mestre");
        const js = await entrarNoMapa(mesa, "jogador-1");
        const m = ms.pagina;
        const j = js.pagina;
        await escolherTema(m, tema);
        await escolherTema(j, tema);

        await tentar(`${rotulo} vazia`, async () => {
          await ligarOrdem(m);
          await expect(m.getByTestId("ordem-vazia")).toBeVisible();
          await foto(m, `${rotulo}-01-mestre-vazia`);
          await recorte(m, `${rotulo}-01-mestre-vazia-recorte`);
        });

        await tentar(`${rotulo} jogo`, async () => {
          await mandar(m, "combate.adicionar", {
            entradas: [
              "tok-jogador-1",
              "tok-jogador-2",
              "tok-jogador-3",
              "tok-ogro",
              "tok-goblin-oculto",
              "tok-marcador-mestre",
            ].map((tokenId) => ({ id: `e-${tokenId}`, tokenId })),
          });
          await expect(m.getByTestId("ordem-entrada")).toHaveCount(6);
          const valores: [string, number][] = [
            ["Ogro", 19],
            ["Aldric", 17],
            ["Goblin Emboscado", 14],
            ["Brisa", 12],
            ["Cael", 8],
            ["Marcador Secreto", 3],
          ];
          for (const [nome, v] of valores) await definirValor(m, nome, v);
          await mandar(m, "combate.rodada", { rodada: 2 });
          await mandar(m, "combate.darVez", { id: "e-tok-jogador-2" });
          await expect(m.getByTestId("ordem-rodada")).toHaveAttribute("data-rodada", "2");
          await foto(m, `${rotulo}-02-mestre-seis-entradas-rodada-2`);
          await recorte(m, `${rotulo}-02-mestre-seis-entradas-recorte`);
        });

        await tentar(`${rotulo} editando`, async () => {
          const campo = linha(m, "Aldric").locator('input[type="number"]');
          await campo.fill("21");
          await recorte(m, `${rotulo}-03-mestre-editando-um-numero`);
          await campo.press("Escape");
          const rodada = m.getByTestId("ordem-rodada-valor");
          await rodada.fill("5");
          await recorte(m, `${rotulo}-04-mestre-editando-a-rodada`);
          await rodada.press("Escape");
        });

        await tentar(`${rotulo} menu da linha`, async () => {
          await linha(m, "Cael").click({ button: "right" });
          await expect(m.getByTestId("ordem-menu")).toBeVisible();
          await foto(m, `${rotulo}-05-mestre-botao-direito-na-linha`);
          await m.keyboard.press("Escape");
        });

        await tentar(`${rotulo} limpar`, async () => {
          await m.getByTestId("ordem-encerrar").click();
          await expect(m.getByTestId("ordem-encerrar-confirmar")).toBeVisible();
          await recorte(m, `${rotulo}-06-mestre-confirmar-limpar`);
          await m.getByTestId("ordem-encerrar-nao").click();
        });

        await tentar(`${rotulo} jogador`, async () => {
          await expect(j.getByTestId("ordem-entrada")).toHaveCount(4);
          await foto(j, `${rotulo}-07-jogador-ordem`);
          await recorte(j, `${rotulo}-07-jogador-ordem-recorte`);
        });

        await tentar(`${rotulo} jogador entra pela ficha`, async () => {
          // o Aldric sai da lista; o jogador seleciona o token dele e clica em Iniciativa na ficha
          await mandar(m, "combate.tirar", { id: "e-tok-jogador-1" });
          await expect(linha(j, "Aldric")).toHaveCount(0);
          await soSelecionarToken(j, "tok-jogador-1");
          const ficha = await abrirFicha(j, "pers-aldric");
          await ficha.getByTestId("iniciativa").hover();
          await expect(j.getByTestId("dica-iniciativa")).toBeVisible();
          await foto(j, `${rotulo}-08-jogador-selecionado-iniciativa-na-ficha`);
          await ficha.getByTestId("iniciativa").click();
          await expect(linha(j, "Aldric")).toBeVisible();
          await j.mouse.move(5, 5);
          await foto(j, `${rotulo}-09-jogador-entrou-na-ordem`);
          await ficha.getByTestId("iniciativa").click();
          await expect(ficha.getByTestId("ficha-aviso-ordem")).toBeVisible();
          await foto(j, `${rotulo}-10-jogador-ja-esta-na-ordem`);
        });
      } finally {
        await mesa.fechar();
      }
    });
  }
}
