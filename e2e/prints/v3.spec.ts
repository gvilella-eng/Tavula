import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { arquivoPrivado } from "../privado";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { arquivoPng, escolherNoSeletor, pngDeRuido } from "../tests/ajudasAssets";
import { abrirHandout, criarHandoutPelaSala } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V3 (fichas em árvore, handouts, topo e abas com tamanho igual). Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints v3

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const PDF = arquivoPrivado("fixtures/fichas/darion.pdf");
const TEMAS = ["grimorio", "escuro", "claro", "edgerunner"] as const;
const TAMANHOS = [
  { nome: "1600x900", width: 1600, height: 900 },
  { nome: "1280x720", width: 1280, height: 720 },
] as const;
const FONTES = ["simples", "livro", "manuscrito", "medieval", "datilografado"] as const;
const TEXTO =
  "Na primeira página, em tinta já marrom:\n\nQuem abrir a terceira porta não voltará a ver o sol.\nLeve a chave de ossos e nunca olhe para trás.";

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
  console.log(`[V3] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V3] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function recorte(p: Page, testid: string, nome: string) {
  await p.waitForTimeout(300);
  await p
    .getByTestId(testid)
    .first()
    .screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

for (const tema of TEMAS) {
  for (const t of TAMANHOS) {
    if (t.nome === "1280x720" && tema === "edgerunner") continue;
    base(`v3 ${tema} ${t.nome}`, async ({ browser, request }) => {
      base.setTimeout(300_000);
      const mesa = new Mesa(browser, { viewport: { width: t.width, height: t.height } });
      const rotulo = `${tema}-${t.nome}`;
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const ms = await entrarNoMapa(mesa, "mestre");
        const js = await entrarNoMapa(mesa, "jogador-1");
        const j2 = await entrarNoMapa(mesa, "jogador-2");
        const m = ms.pagina;
        const j = js.pagina;
        await escolherTema(m, tema);
        await escolherTema(j, tema);
        await escolherTema(j2.pagina, tema);

        // item 0: topo e abas
        await tentar(`${rotulo} topo`, async () => {
          await recorte(m, "topo", `${rotulo}-01-topo-mestre`);
          await recorte(j, "topo", `${rotulo}-02-topo-jogador`);
          await m.getByTestId("menu-visao-noturna").hover();
          await foto(m, `${rotulo}-03-mestre-dica-do-topo`);
          await m.mouse.move(600, 500);
        });
        await tentar(`${rotulo} abas`, async () => {
          for (const [p, quem] of [
            [m, "mestre"],
            [j, "jogador"],
          ] as const) {
            await p.getByTestId("alca-do-painel").focus();
            await p.keyboard.press("Home");
            await p.waitForTimeout(300);
            await recorte(p, "barra-lateral", `${rotulo}-04-abas-300-${quem}`);
            await p.keyboard.press("End");
            await p.waitForTimeout(300);
            await recorte(p, "barra-lateral", `${rotulo}-05-abas-maximo-${quem}`);
            await p.keyboard.press("Home");
          }
          await m.getByTestId("lateral-recolher").click();
          await m.waitForTimeout(300);
          await recorte(m, "barra-lateral", `${rotulo}-06-abas-recolhido-mestre`);
          await m.getByTestId("aba-fichas").click();
        });

        // a árvore: 3 pastas (uma recolhida), fichas e handouts
        await tentar(`${rotulo} arvore`, async () => {
          await abrirAba(m, "fichas");
          const extra = await (async () => {
            await m.getByTestId("ficha-novo").click();
            await foto(m, `${rotulo}-10-menu-novo`);
            await m.getByTestId("ficha-nova-pasta").click();
            const secoes = m.locator('section[data-testid^="ficha-pasta-pasta-"]');
            return (await secoes.last().getAttribute("data-pasta-id")) as string;
          })();
          await m.getByTestId(`ficha-pasta-nome-${extra}`).click();
          await m.getByTestId(`ficha-pasta-nome-editar-${extra}`).fill("Pistas e cartas");
          await foto(m, `${rotulo}-11-renomear-pasta`);
          await m.getByTestId(`ficha-pasta-nome-editar-${extra}`).press("Enter");
          await criarHandoutPelaSala(m, {
            pastaId: extra,
            titulo: "Carta do rei",
            texto: TEXTO,
            fonte: "manuscrito",
            visivel: { tipo: "todos" },
          });
          await criarHandoutPelaSala(m, {
            pastaId: extra,
            titulo: "O Livro dos Ossos",
            texto: TEXTO,
            fonte: "medieval",
            visivel: { tipo: "jogadores", ids: ["jogador-1"] },
          });
          await criarHandoutPelaSala(m, {
            pastaId: extra,
            titulo: "Plano do mestre",
            texto: "segredo",
          });
          await m.getByTestId("ficha-pasta-alternar-pasta-npcs").click();
          await expect(m.getByTestId("ficha-item-pers-aldric")).toBeVisible();
          await foto(m, `${rotulo}-12-arvore-mestre`);
          await abrirAba(j, "fichas");
          await foto(j, `${rotulo}-13-arvore-jogador`);

          // botão direito: item e pasta
          await m.getByTestId("ficha-abrir-pers-aldric").click({ button: "right" });
          await foto(m, `${rotulo}-14-menu-do-item`);
          await m.keyboard.press("Escape");
          await m.getByTestId(`ficha-pasta-nome-${extra}`).click({ button: "right" });
          await foto(m, `${rotulo}-15-menu-da-pasta`);
          await m.keyboard.press("Escape");
        });

        // ficha nova em Configurar com "Importar PDF"
        await tentar(`${rotulo} ficha nova`, async () => {
          await m.getByTestId("ficha-novo").click();
          await m.getByTestId("ficha-novo-personagem").click();
          await expect(m.getByTestId("editor-importar-pdf")).toBeVisible();
          await foto(m, `${rotulo}-16-ficha-nova-configurar`);
          const [seletor] = await Promise.all([
            m.waitForEvent("filechooser"),
            m.getByTestId("editor-importar-pdf").click(),
          ]);
          await seletor.setFiles({
            name: "ficha.pdf",
            mimeType: "application/pdf",
            buffer: readFileSync(PDF),
          });
          await expect(m.getByTestId("revisao-pdf")).toBeVisible({ timeout: 60_000 });
          await foto(m, `${rotulo}-17-importar-pdf`);
          await m.getByTestId("revisao-cancelar").click();
          await m.getByTestId("janela-ficha-fechar").click();
        });

        // handouts nas 5 fontes (com e sem imagem) e o "Mostrar agora"
        await tentar(`${rotulo} handouts`, async () => {
          const id = await criarHandoutPelaSala(m, {
            titulo: "O Livro dos Ossos",
            texto: TEXTO,
            visivel: { tipo: "todos" },
          });
          const janela = await abrirHandout(m, id);
          for (const f of FONTES) {
            await janela.getByTestId(`handout-fonte-${f}`).click();
            await expect(janela.getByTestId("handout-texto-campo")).toHaveAttribute(
              "data-fonte",
              f,
            );
            await foto(m, `${rotulo}-20-handout-${f}-sem-imagem-mestre`);
          }
          await janela.getByTestId("handout-imagem-escolher").click();
          await escolherNoSeletor(m, arquivoPng("h.png", pngDeRuido(240, 300, 95, 4)));
          await expect(janela.getByTestId("handout-imagem-escolher")).toHaveAttribute(
            "data-com-imagem",
            "true",
            { timeout: 30_000 },
          );
          for (const f of FONTES) {
            await janela.getByTestId(`handout-fonte-${f}`).click();
            await expect(janela.getByTestId("handout-texto-campo")).toHaveAttribute(
              "data-fonte",
              f,
            );
            await foto(m, `${rotulo}-21-handout-${f}-com-imagem-mestre`);
          }
          await janela.getByTestId("handout-fonte-livro").click();
          // o jogador abre pelo "Mostrar agora"; o que não vê (jogador 2) fica sem janela
          await janela.getByTestId("handout-visib-jogador-jogador-1").click();
          await janela.getByTestId("handout-mostrar").click();
          const naTela = j.locator(`[data-testid="janela-handout"][data-handout-id="${id}"]`);
          await expect(naTela).toBeVisible();
          await expect(naTela.getByTestId("handout-imagem")).toHaveAttribute(
            "data-com-imagem",
            "true",
            { timeout: 30_000 },
          );
          await foto(j, `${rotulo}-22-mostrar-agora-na-tela-do-jogador`);
          await foto(j2.pagina, `${rotulo}-23-jogador-2-nao-recebe`);
          await foto(m, `${rotulo}-24-mestre-apos-mostrar`);
        });
      } finally {
        await mesa.fechar();
      }
    });
  }
}
