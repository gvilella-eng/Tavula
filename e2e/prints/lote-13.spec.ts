import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import {
  abrirPincel,
  centrar,
  comecarTraco,
  desenhoNaPagina,
  desenhosDe,
  escolherNoPincel,
  rascunhosDe,
  zigueZague,
} from "../tests/ajudasDesenho";
import { mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do Lote 13 (pincel e camada de desenho), em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-13

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const test = base.extend<{ grande: Mesa }>({
  grande: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    await use(mesa);
    await mesa.fechar();
  },
});

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(600);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

/** Foto de um retângulo da página (px). */
async function recorte(
  p: Page,
  nome: string,
  area: { x: number; y: number; width: number; height: number },
) {
  await p.waitForTimeout(600);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`), clip: area });
}

type Forma = "livre" | "linha" | "retangulo" | "circulo";
type Ponto = { x: number; y: number };

/** O mesmo que o navegador mandaria ao soltar o traço (o desenho nasce do autor da página). */
async function desenhar(
  p: Page,
  id: string,
  forma: Forma,
  pontos: Ponto[],
  cor: string,
  extra: { espessura?: number; preenchido?: boolean } = {},
) {
  await mandar(p, "desenho.criar", {
    desenho: { id, forma, pontos, cor, espessura: extra.espessura ?? 4, ...extra },
  });
}

/** Uma onda de `n` pontos, para um traço livre com cara de mão levantada. */
function onda(x0: number, y0: number, x1: number, n = 36): Ponto[] {
  return Array.from({ length: n }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / (n - 1),
    y: y0 + Math.sin(i / 3) * 1.1,
  }));
}

/** Os quatro desenhos do print do mapa: traço livre, linha, retângulo preenchido e círculo. */
async function desenharExemplos(mestre: Page, j1: Page) {
  await desenhar(j1, "ex-livre", "livre", onda(4, 6, 14), "#e6194b", { espessura: 8 });
  await desenhar(
    mestre,
    "ex-linha",
    "linha",
    [
      { x: 5, y: 10.5 },
      { x: 15, y: 13 },
    ],
    "#e0a030",
    {
      espessura: 4,
    },
  );
  await desenhar(
    j1,
    "ex-ret",
    "retangulo",
    [
      { x: 18, y: 4 },
      { x: 24, y: 8.5 },
    ],
    "#4363d8",
    { espessura: 4, preenchido: true },
  );
  await desenhar(
    mestre,
    "ex-circ",
    "circulo",
    [
      { x: 20.5, y: 13 },
      { x: 23.5, y: 13 },
    ],
    "#3cb44b",
    {
      espessura: 6,
    },
  );
}

test("lote 13: sub-barra do pincel, desenhos de cores e formas, rascunho ao vivo e seleção", async ({
  grande,
}) => {
  test.setTimeout(240_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");
  await centrar(mestre.pagina, 16, 10);
  await centrar(j1.pagina, 16, 10);

  // 1. a sub-barra do pincel aberta, com a paleta, a espessura e a cor livre
  await abrirPincel(j1.pagina);
  await escolherNoPincel(j1.pagina, "retangulo");
  await j1.pagina.getByTestId("pincel-preenchido").click();
  await j1.pagina.getByTestId("pincel-cor-4363d8").click();
  await j1.pagina.getByTestId("pincel-espessura-8").click();
  await recorte(j1.pagina, "01-subbarra-pincel", { x: 0, y: 150, width: 420, height: 600 });
  await foto(j1.pagina, "01b-subbarra-pincel-tela-inteira");

  // 2. um mapa com traço livre, linha, retângulo preenchido e círculo, de cores diferentes
  await desenharExemplos(mestre.pagina, j1.pagina);
  await expect.poll(async () => (await desenhosDe(j1.pagina)).length).toBe(4);
  await expect.poll(async () => (await desenhosDe(mestre.pagina)).length).toBe(4);
  await j1.pagina.getByTestId("pincel-fechar").click();
  await foto(j1.pagina, "02-mapa-com-desenhos-jogador");
  await foto(mestre.pagina, "02b-mapa-com-desenhos-mestre");

  // 3. o rascunho ao vivo: o jogador ainda está com o mouse apertado e o mestre já vê o traço
  await abrirPincel(j1.pagina);
  await escolherNoPincel(j1.pagina, "livre");
  await j1.pagina.getByTestId("pincel-cor-f58231").click();
  await j1.pagina.getByTestId("pincel-espessura-8").click();
  const soltar = await comecarTraco(j1.pagina, zigueZague({ x: 6, y: 16 }, { x: 17, y: 19 }, 12));
  await expect.poll(async () => (await rascunhosDe(mestre.pagina)).length).toBe(1);
  await foto(mestre.pagina, "03-rascunho-ao-vivo-visto-pelo-mestre");
  await soltar();
  await expect.poll(async () => (await desenhosDe(mestre.pagina)).length).toBe(5);
  await j1.pagina.getByTestId("pincel-fechar").click();

  // 4. um desenho selecionado, com o destaque de seleção (o mestre seleciona o retângulo azul)
  await abrirPincel(mestre.pagina);
  await escolherNoPincel(mestre.pagina, "selecionar");
  const alvo = await desenhoNaPagina(mestre.pagina, "ex-ret");
  if (!alvo) throw new Error("sem ponto");
  await mestre.pagina.mouse.click(alvo.x, alvo.y);
  await foto(mestre.pagina, "04-desenho-selecionado");
});

test("lote 13: desenhos visíveis numa cena escura, vistos pelo jogador", async ({ grande }) => {
  test.setTimeout(240_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const j2 = await entrarNoMapa(grande, "jogador-2");
  await mandar(mestre.pagina, "cena.configurarIluminacao", { luzAmbiente: 0 });
  await centrar(mestre.pagina, 14, 10);
  await centrar(j2.pagina, 14, 10);
  // desenhos longe da Brisa (que não enxerga no escuro) e longe das luzes
  await desenhar(mestre.pagina, "e-livre", "livre", onda(3, 5, 12), "#e6194b", { espessura: 8 });
  await desenhar(
    mestre.pagina,
    "e-ret",
    "retangulo",
    [
      { x: 4, y: 13 },
      { x: 11, y: 17 },
    ],
    "#42d4f4",
    {
      espessura: 4,
      preenchido: true,
    },
  );
  await desenhar(
    mestre.pagina,
    "e-circ",
    "circulo",
    [
      { x: 19, y: 15.5 },
      { x: 22, y: 15.5 },
    ],
    "#e0a030",
    {
      espessura: 6,
    },
  );
  await expect.poll(async () => (await desenhosDe(j2.pagina)).length).toBe(3);
  await foto(j2.pagina, "05-desenhos-no-escuro-visto-pelo-jogador");
});

test("lote 13: confirmação de Limpar desenhos e o jogador sem a capacidade", async ({ grande }) => {
  test.setTimeout(240_000);
  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");
  await centrar(mestre.pagina, 16, 10);
  await centrar(j1.pagina, 16, 10);
  await desenharExemplos(mestre.pagina, j1.pagina);
  await expect.poll(async () => (await desenhosDe(mestre.pagina)).length).toBe(4);

  // 6. a confirmação de "Limpar desenhos"
  await mestre.pagina.getByTestId("menu-camadas").click();
  await mestre.pagina.getByTestId("limpar-desenhos").click();
  await expect(mestre.pagina.getByTestId("limpar-desenhos-confirmacao")).toBeVisible();
  await recorte(mestre.pagina, "06-limpar-desenhos-confirmacao", {
    x: 450,
    y: 0,
    width: 700,
    height: 500,
  });
  await mestre.pagina.getByTestId("limpar-desenhos-cancelar").click();
  await mestre.pagina.keyboard.press("Escape");

  // 7. o mestre desliga o desenho e o jogador fica sem o pincel, com a explicação
  await abrirAba(mestre.pagina, "mestre");
  await mestre.pagina.getByTestId("perm-padrao-desenho.criar").click();
  await expect(j1.pagina.getByTestId("ferramenta-pincel")).toHaveAttribute("aria-disabled", "true");
  await j1.pagina.getByTestId("ferramenta-pincel").click({ force: true });
  await expect(j1.pagina.getByTestId("pincel-sem-permissao")).toBeVisible();
  await recorte(j1.pagina, "07-jogador-sem-a-capacidade", {
    x: 0,
    y: 250,
    width: 520,
    height: 400,
  });
  await foto(mestre.pagina, "07b-painel-do-mestre-desenho-desligado");
});
