import type { Page } from "@playwright/test";
import { esperarMapa, expect, type Mesa } from "./ajudas";

// Ajudas para falar com o canvas (gancho window.__tabletop, só no modo e2e) nos testes da interface v2.

export const PX_POR_M = 40;

export type TokenVisto = {
  id: string;
  nome: string;
  x: number;
  y: number;
  tamanho: number;
  oculto: boolean;
  camada: string;
  /** Está sendo desenhado (o jogador não desenha o que está fora da visão). */
  desenhado: boolean;
  /** O anel da vez (ordem de turno) está aceso. */
  emVez: boolean;
  /** Os marcadores de condição desenhados na borda (título de cada um). */
  marcas: string[];
};

export type GanchoDoMapa = {
  tokens(): TokenVisto[];
  /** Onde está o marcador de condição `indice` do token (posição na página). */
  marcaNaPagina(id: string, indice: number): { x: number; y: number } | null;
  paraTela(x: number, y: number): { x: number; y: number };
  zoom(): number;
  definirZoom(z: number): void;
  centrarEm(x: number, y: number): void;
  quadradoM(): number;
  bandeira(): { x: number; y: number } | null;
  portas(): { id: string; tipo: string; estado?: string; meio: { x: number; y: number } }[];
  paredes(): { id: string; tipo: string; estado?: string }[];
  visao(): { modo: "jogador" | "noturna" | "claro"; poligonos: number };
  veNoPonto(x: number, y: number): boolean;
  veuVisivel(): boolean;
  /** O que o jogador vê no ponto (luz ∩ visão, ou visão no escuro): nenhuma, cinza, penumbra ou plena. */
  visaoNoPonto(x: number, y: number): "nenhuma" | "cinza" | "penumbra" | "plena";
  nivelNoPonto(x: number, y: number): number;
  /** As luzes que valem agora, com os raios já multiplicados (intensidade × fator geral). */
  luzes(): { id: string; x: number; y: number; claraM: number; totalM: number }[];
  memoria(): {
    carregada: boolean;
    lembradas: number;
    pendente: boolean;
    esquecimento: number;
    /** O alcance da memória (m) de cada token do jogador. */
    alcancesM: number[];
  };
  lembraNoPonto(x: number, y: number): boolean;
  opacidadeDaMemoria(x: number, y: number): number;
  marcasDeLuz(): { id: string; x: number; y: number }[];
  /** As alças das tochas e os ícones dos objetos nos pontos (posição na página). */
  alcas(): {
    id: string;
    estado: "acesa" | "apagada";
    portador: string;
    rotulo: string;
    x: number;
    y: number;
  }[];
  /** Os pontos de luz que a tela mostra (posição na página). */
  pontos(): { id: string; tipo: string; x: number; y: number }[];
  /** A contagem de acender (0 a 1) enquanto se segura a tocha sobre um inflamável. */
  anelDeAcender(): number | null;
};

export const tokensDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.tokens());

/** Entra, espera o mapa subir e (a menos que `zoom` seja `null`) deixa a vista em zoom 1. */
export async function entrarNoMapa(
  mesa: Mesa,
  usuario: string,
  opcoes?: Parameters<Mesa["entrar"]>[1],
) {
  const s = await mesa.entrar(usuario, opcoes);
  await esperarMapa(s.pagina);
  await s.pagina.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.definirZoom(1),
  );
  return s;
}

export async function tokenDe(p: Page, id: string): Promise<TokenVisto> {
  const t = (await tokensDe(p)).find((x) => x.id === id);
  if (!t) throw new Error(`token ${id} não está visível`);
  return t;
}

export async function esperarPosicao(p: Page, id: string, x: number, y: number) {
  await expect
    .poll(async () => {
      const t = await tokenDe(p, id).catch(() => null);
      return t ? [Math.round(t.x * 100) / 100, Math.round(t.y * 100) / 100] : null;
    })
    .toEqual([x, y]);
}

/** Leva o token ao centro da tela e devolve onde ele está na página. */
export async function centrarNoToken(p: Page, id: string) {
  const t = await tokenDe(p, id);
  return p.evaluate(
    ([x, y]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.centrarEm(x as number, y as number);
      return h.paraTela(x as number, y as number);
    },
    [t.x, t.y],
  );
}

/** Arrasta o token com o mouse de verdade, `dxM`/`dyM` metros a partir do centro dele. */
export async function arrastarToken(p: Page, id: string, dxM: number, dyM: number) {
  const ini = await centrarNoToken(p, id);
  const zoom = await p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.zoom(),
  );
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  await p.mouse.move(ini.x + dxM * PX_POR_M * zoom, ini.y + dyM * PX_POR_M * zoom, { steps: 12 });
  await p.mouse.up();
}

/** Clica no token (mouse de verdade) para selecioná-lo; abre o painel do token do mestre. */
export async function selecionarToken(p: Page, id: string) {
  const alvo = await centrarNoToken(p, id);
  await p.mouse.click(alvo.x, alvo.y);
  await expect(p.getByTestId("painel-token")).toBeVisible();
}

/** Ponto da página onde está o ponto do mundo (metros), com o mapa já posicionado. */
export function pontoNaPagina(p: Page, x: number, y: number) {
  return p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paraTela(
        px as number,
        py as number,
      ),
    [x, y],
  );
}

/** Mensagens de texto de um tipo (só as que a interface enviou, ou a sala mandou). */
export const doTipo = (frames: string[], tipo: string) =>
  frames.filter((f) => f.includes(`"tipo":"${tipo}"`));
