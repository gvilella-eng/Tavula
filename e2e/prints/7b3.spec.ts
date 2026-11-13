import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, enviarCru, expect, intencaoCrua, Mesa } from "../tests/ajudas";
import { entrarNoMapa, pontoNaPagina } from "../tests/ajudasMapa";

// Prints do lote 7b-3 (o editor das automações, os botões na barra, o painel das Zonas à direita): Grimório em 1600×900 e
// 1280×720 e Pergaminho (claro) em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints 7b3

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 400) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
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
  if (falhas.length) console.log(`[7b3] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function mandar(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

type GanchoCentro = { __tabletop: { centrarEm(x: number, y: number): void } };
const centrar = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([a, b]) => (window as unknown as GanchoCentro).__tabletop.centrarEm(a as number, b as number),
    [x, y],
  );

for (const c of COMBINACOES) {
  base(`automações ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const rotulo = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);

      // o painel das Zonas abre à direita e deixa a zona à vista
      await tentar(`${rotulo} zonas`, async () => {
        await mandar(m, "zona.criar", {
          zona: {
            id: "zona-ar",
            cenaId: "cena-1",
            nome: "Ar Morto",
            pontos: [
              { x: 26.25, y: 6 },
              { x: 33, y: 6 },
              { x: 33, y: 13.5 },
              { x: 26.25, y: 13.5 },
            ],
            efeitos: { luzRaioX: 0.5, visaoMaxM: 3 },
          },
        });
        await m.getByTestId("ferramenta-zonas").click();
        await centrar(m, 29.5, 9.75);
        const meio = await pontoNaPagina(m, 29.25, 9.75);
        await m.mouse.click(meio.x, meio.y);
        await expect(m.getByTestId("zona-selecionada")).toBeVisible();
        await foto(m, `${rotulo}-00-zonas-painel-a-direita`);
        await m.getByTestId("ferramenta-zonas").click();
      });

      // a Chama Primordial pela lista de exemplos; o ciclo fixado aparece na barra
      await abrirAba(m, "mesa");
      await m.getByTestId("exemplo-chama-primordial-escolher").click();
      await m.getByTestId("importar-confirmar").click();
      await expect(m.getByTestId("chip-ciclo-respiracao")).toBeVisible();
      await mandar(m, "ciclo.editar", {
        id: "respiracao",
        mudancas: { liberadoParaJogadores: true },
      });
      await mandar(m, "botao.editar", {
        id: "rajada",
        mudancas: { fixado: true, liberadoParaJogadores: true },
      });
      await m.getByTestId("aba-chat").click();
      // a campanha importada vem com a mesa pausada: retoma pelo botão do topo
      await expect(m.getByTestId("estado-mesa-selo")).toBeVisible();
      await m.getByTestId("menu-pausa").click();
      await expect(m.getByTestId("estado-mesa-selo")).toHaveCount(0);
      await tentar(`${rotulo} chip`, async () => {
        await expect(m.getByTestId("chip-evento-rajada")).toBeVisible();
        await foto(m, `${rotulo}-04-chip-do-ciclo-na-barra`);
        await m.getByTestId("topo").screenshot({
          path: join(PASTA as string, `${rotulo}-04-topo-com-chips.png`),
        });
      });

      // o jogador vê só o chip liberado
      await tentar(`${rotulo} jogador`, async () => {
        const j = await entrarNoMapa(mesa, "jogador-1");
        await escolherTema(j.pagina, c.tema);
        await expect(j.pagina.getByTestId("chip-botao-respiracao")).toBeVisible();
        await foto(j.pagina, `${rotulo}-05-chip-liberado-visto-pelo-jogador`);
        await j.pagina.getByTestId("topo").screenshot({
          path: join(PASTA as string, `${rotulo}-05-topo-do-jogador.png`),
        });
      });

      // o editor: a lista, o formulário de uma reação e a vista JSON com erro
      await tentar(`${rotulo} editor`, async () => {
        await abrirAba(m, "mesa");
        await m.getByTestId("automacoes-abrir").click();
        await expect(m.getByTestId("automacoes-lista")).toBeVisible();
        await foto(m, `${rotulo}-01-editor-lista`);

        await m.getByTestId("auto-reacao-tocha-inspiracao-editar").click();
        await expect(m.getByTestId("form-reacao")).toBeVisible();
        await foto(m, `${rotulo}-02-formulario-da-reacao`);

        await m.getByTestId("form-reacao-json").locator("summary").click();
        await m.getByTestId("form-reacao-json-texto").fill(
          JSON.stringify(
            {
              id: "tocha-inspiracao",
              nome: "A rajada encolhe e pode apagar a tocha",
              ativa: true,
              fica: { tipo: "modelo", id: "modelo-tocha" },
              ao: "inspiracao",
              se: [{ condicao: "chance", valor: 3 }],
              fazer: [{ acao: "luz.modificar", raioX: 9, porS: -2 }],
            },
            null,
            2,
          ),
        );
        await expect(m.getByTestId("form-reacao-json-erros")).toBeVisible();
        await m.getByTestId("form-reacao-salvar").click();
        // a janela rola: leva o fim (o JSON, os erros e o resumo) para a vista
        await m
          .locator('[data-testid="janela-automacoes"] .janela-corpo')
          .evaluate((el) => el.scrollTo(0, el.scrollHeight));
        await foto(m, `${rotulo}-03-vista-json-com-erro`);
      });
    } finally {
      await mesa.fechar();
    }
  });
}
