import type { Page } from "@playwright/test";
import { expect } from "./ajudas";
import { PX_POR_M, pontoNaPagina } from "./ajudasMapa";

// Ajudas do Lote 13 (pincel e camada de desenho): abrir o pincel, desenhar com o mouse de verdade e ler o
// que a tela mostra (gancho window.__tabletop, só no modo e2e).

export type DesenhoVisto = {
  id: string;
  forma: "livre" | "linha" | "retangulo" | "circulo";
  autorId: string;
  cor: string;
  pontos: number;
  /** O primeiro ponto, em metros (mostra o quanto o desenho andou). */
  ponto0: { x: number; y: number } | null;
  preenchido: boolean;
};
export type RascunhoVisto = { id: string; autorId: string; forma: string; pontos: number };

type Gancho = {
  desenhos(): DesenhoVisto[];
  desenhoSelecionado(): string | null;
  rascunhos(): RascunhoVisto[];
  desenhoNaPagina(id: string): { x: number; y: number } | null;
  camadaDeDesenho(): { acimaDoVeu: boolean; visivel: boolean };
  pixelNoMapa(x: number, y: number): number[];
  centrarEm(x: number, y: number): void;
  definirZoom(z: number): void;
  zoom(): number;
};

export const desenhosDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: Gancho }).__tabletop.desenhos());
export const rascunhosDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: Gancho }).__tabletop.rascunhos());
export const desenhoSelecionado = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: Gancho }).__tabletop.desenhoSelecionado());
export const camadaDeDesenho = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: Gancho }).__tabletop.camadaDeDesenho());

export const pixelNoMapa = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: Gancho }).__tabletop.pixelNoMapa(
        px as number,
        py as number,
      ),
    [x, y],
  );

export const desenhoNaPagina = (p: Page, id: string) =>
  p.evaluate(
    (i) => (window as unknown as { __tabletop: Gancho }).__tabletop.desenhoNaPagina(i),
    id,
  );

/** Abre a sub-barra do pincel (a barra da esquerda). */
export async function abrirPincel(p: Page) {
  await p.getByTestId("ferramenta-pincel").click();
  await expect(p.getByTestId("sub-barra-pincel")).toBeVisible();
}

export type ModoDoPincel = "livre" | "linha" | "retangulo" | "circulo" | "selecionar" | "borracha";

/** Escolhe o que o pincel faz (forma, selecionar ou borracha). */
export async function escolherNoPincel(p: Page, modo: ModoDoPincel) {
  const id = modo === "selecionar" || modo === "borracha" ? modo : `forma-${modo}`;
  await p.getByTestId(`pincel-${id}`).click();
  await expect(p.getByTestId(`pincel-${id}`)).toHaveAttribute("aria-pressed", "true");
}

/** Deixa a vista em zoom 1 centrada no ponto (metros). */
export async function centrar(p: Page, x: number, y: number) {
  await p.evaluate(
    ([px, py]) => {
      const h = (window as unknown as { __tabletop: Gancho }).__tabletop;
      h.definirZoom(1);
      h.centrarEm(px as number, py as number);
    },
    [x, y],
  );
}

type PontoM = { x: number; y: number };

/**
 * Começa a desenhar (mouse apertado) e passa por todos os pontos, em metros. Devolve a função que
 * solta o mouse, para o teste olhar o rascunho com o traço ainda em andamento.
 */
export async function comecarTraco(p: Page, pontos: PontoM[]) {
  const [primeiro, ...resto] = pontos;
  if (!primeiro) throw new Error("sem pontos");
  const ini = await pontoNaPagina(p, primeiro.x, primeiro.y);
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  for (const m of resto) {
    const t = await pontoNaPagina(p, m.x, m.y);
    await p.mouse.move(t.x, t.y, { steps: 8 });
  }
  return async () => {
    await p.mouse.up();
  };
}

/** Desenha de uma vez (aperta, passa pelos pontos e solta). */
export async function tracar(p: Page, pontos: PontoM[]) {
  const soltar = await comecarTraco(p, pontos);
  await soltar();
}

/** Um zigue-zague de `n` pontos entre dois cantos (metros): serve de traço livre. */
export function zigueZague(de: PontoM, ate: PontoM, n = 8): PontoM[] {
  return Array.from({ length: n }, (_, i) => ({
    x: de.x + ((ate.x - de.x) * i) / (n - 1),
    y: de.y + ((ate.y - de.y) * i) / (n - 1) + (i % 2 === 0 ? 0 : 0.8),
  }));
}

export { PX_POR_M };
