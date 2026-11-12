import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, enviarCru, expect, intencaoCrua, Mesa, menuDaCena } from "../tests/ajudas";
import { arquivoPng, definirMapa, pngDeSalaRedonda } from "../tests/ajudasAssets";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "../tests/ajudasMapa";

// Prints do lote V5 (paredes e portas: quem vê, Visão do mestre, meia célula e arcos): Grimório em 1600×900 e
// 1280×720 e Pergaminho em 1600×900. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v5

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 600) {
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
  console.log(`[V5] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V5] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

/** A faixa de cenas fica aberta depois do menu da cena: fecha para ela não cobrir o mapa nos prints. */
async function fecharFaixa(p: Page) {
  if (await p.getByTestId("faixa-cenas").isVisible()) await p.getByTestId("menu-cenas").click();
  await expect(p.getByTestId("faixa-cenas")).toBeHidden();
}

const gancho = <T>(p: Page, f: string, ...args: number[]) =>
  p.evaluate(
    ([nome, a]) =>
      (
        (window as unknown as { __tabletop: Record<string, (...x: number[]) => unknown> })
          .__tabletop[nome as string] as (...x: number[]) => unknown
      )(...(a as number[])),
    [f, args],
  ) as Promise<T>;

const centrar = (p: Page, x: number, y: number, zoom: number) =>
  p.evaluate(
    ([px, py, z]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.definirZoom(z as number);
      h.centrarEm(px as number, py as number);
    },
    [x, y, zoom],
  );

// A sala redonda: centro (15; 11,25) m, raio 8 m, num mapa de 30 × 22,5 m (70 px por quadrado de 1,5 m).
const CENTRO = { x: 15, y: 11.25 };
const R = 8;
const NA = (graus: number) => ({
  x: Math.round((CENTRO.x + R * Math.cos((graus * Math.PI) / 180)) * 1000) / 1000,
  y: Math.round((CENTRO.y + R * Math.sin((graus * Math.PI) / 180)) * 1000) / 1000,
});
const ARCOS = [
  { id: "arco-ne", de: 270, ate: 0, tipo: "parede" },
  { id: "arco-se", de: 0, ate: 90, tipo: "porta" },
  { id: "arco-so", de: 90, ate: 180, tipo: "parede" },
  { id: "arco-no", de: 180, ate: 270, tipo: "janela" },
] as const;

for (const c of COMBINACOES) {
  base(`v5 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const rotulo = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const js = await entrarNoMapa(mesa, "jogador-1");
      const m = ms.pagina;
      const j = js.pagina;
      await escolherTema(m, c.tema);
      await escolherTema(j, c.tema);

      // a sala redonda: mapa, cena nova, o grupo vai para lá e as paredes são arcos
      await enviarCru(m, intencaoCrua("cena.criar", { id: "cena-redonda", nome: "Sala redonda" }));
      await definirMapa(
        m,
        "cena-redonda",
        arquivoPng(
          "sala-redonda.png",
          pngDeSalaRedonda(
            1400,
            1050,
            { x: (CENTRO.x / 1.5) * 70, y: (CENTRO.y / 1.5) * 70 },
            (R / 1.5) * 70,
          ),
        ),
        70,
      );
      await menuDaCena(m, "cena-redonda", "levar");
      await expect
        .poll(async () => (await gancho<{ id: string }[]>(j, "tokens")).length)
        .toBeGreaterThan(0);
      await enviarCru(
        m,
        intencaoCrua("parede.criar", {
          cenaId: "cena-redonda",
          paredes: ARCOS.map((a) => {
            const meio = NA((a.de + (a.ate === 0 ? 360 : a.ate)) / 2);
            return { id: a.id, a: NA(a.de), b: NA(a.ate), meio, tipo: a.tipo };
          }),
        }),
      );
      await expect
        .poll(async () => (await gancho<{ id: string }[]>(j, "paredes")).length)
        .toBe(ARCOS.length);
      // o jogador dentro da sala, perto da porta do sudeste
      await enviarCru(m, intencaoCrua("token.soltar", { id: "tok-jogador-1", x: 19.5, y: 15 }));
      await fecharFaixa(m);
      await centrar(m, CENTRO.x, CENTRO.y, c.height >= 900 ? 0.95 : 0.7);
      await centrar(j, CENTRO.x, CENTRO.y, c.height >= 900 ? 0.95 : 0.7);

      await tentar(`${rotulo} mestre com a Visão do mestre`, async () => {
        await expect(m.getByTestId("menu-visao-noturna")).toHaveAttribute("aria-pressed", "true");
        await foto(m, `${rotulo}-01-mestre-visao-do-mestre-ligada`);
      });
      await tentar(`${rotulo} mestre sem a Visão do mestre`, async () => {
        await m.getByTestId("menu-visao-noturna").click();
        await expect.poll(() => gancho<boolean>(m, "contornos")).toBe(false);
        await foto(m, `${rotulo}-02-mestre-visao-do-mestre-desligada`);
        await m.getByTestId("menu-visao-noturna").click();
        await expect.poll(() => gancho<boolean>(m, "contornos")).toBe(true);
      });
      await tentar(`${rotulo} jogador sem contornos`, async () => {
        await foto(j, `${rotulo}-03-jogador-sem-contornos`);
      });
      await tentar(`${rotulo} hover da porta escondida`, async () => {
        const portas = await gancho<{ id: string; meio: { x: number; y: number } }[]>(j, "portas");
        const porta = portas.find((q) => q.id === "arco-se");
        if (!porta) throw new Error("a porta em arco não aparece");
        const alvo = await pontoNaPagina(j, porta.meio.x, porta.meio.y);
        await j.mouse.move(alvo.x - 90, alvo.y - 40);
        await j.mouse.move(alvo.x, alvo.y, { steps: 5 });
        await expect.poll(() => gancho<string | null>(j, "portaDestacada")).toBe("arco-se");
        await foto(j, `${rotulo}-04-jogador-hover-da-porta`);
        await j.mouse.move(40, 40);
      });
      await tentar(`${rotulo} jogador com contornos`, async () => {
        await menuDaCena(m, "cena-redonda", "configurar");
        await m.getByTestId("cfg-mostrar-paredes").check();
        await foto(m, `${rotulo}-05-configurar-cena-opcao`, 300);
        await m.getByTestId("cfg-salvar").click();
        await fecharFaixa(m);
        await expect.poll(() => gancho<boolean>(j, "contornos")).toBe(true);
        await foto(j, `${rotulo}-06-jogador-com-contornos`);
      });
      await tentar(`${rotulo} desenho com arco tangente`, async () => {
        await m.getByTestId("ferramenta-paredes").click();
        await centrar(m, 5.5, 4.5, 1.4);
        const pt = (x: number, y: number) => pontoNaPagina(m, x, y);
        let q = await pt(3, 3);
        await m.mouse.click(q.x, q.y);
        q = await pt(6, 3);
        await m.mouse.click(q.x, q.y);
        await m.keyboard.press("a");
        q = await pt(7.45, 4.4);
        await m.mouse.move(q.x - 30, q.y - 30);
        await m.mouse.move(q.x, q.y, { steps: 4 });
        await foto(m, `${rotulo}-07-desenhando-arco-tangente`);
        await m.keyboard.press("a");
        await m.keyboard.press("Escape");
      });
    } finally {
      await mesa.fechar();
    }
  });
}
