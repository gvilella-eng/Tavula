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
  /** O anel de seleção (dourado) está aceso. */
  selecionado: boolean;
  /** Q11: a barra de vida desenhada (a fração do atual e os temporários) ou `null` sem barra para quem olha. */
  barra?: { fracao: number; temp: number } | null;
  /** Q11: o nome da cor da borda desenhada (`null` sem borda). */
  borda?: string | null;
  /** N1: o X de morto está desenhado. */
  morto: boolean;
  /** Os marcadores de condição desenhados na borda (título de cada um). */
  marcas: string[];
};

export type GanchoDoMapa = {
  tokens(): TokenVisto[];
  /** Onde está o marcador de condição `indice` do token (posição na página). */
  marcaNaPagina(id: string, indice: number): { x: number; y: number } | null;
  /** A prévia do modo "pôr token": onde está (metros) ou `null` se não aparece. */
  previaDoToken(): { x: number; y: number } | null;
  paraTela(x: number, y: number): { x: number; y: number };
  zoom(): number;
  ferramenta(): string;
  /** V10c: a imagem da cena e a área do mapa na página (pixels), para conferir o enquadramento. */
  quadroDaCena(): {
    cena: { x: number; y: number; largura: number; altura: number };
    area: { x: number; y: number; largura: number; altura: number };
  } | null;
  /** V12: o centro da tela (a câmera), em metros; os pings que chegaram (`exibido`: eram da cena vista) e os na tela. */
  centroDaVista(): { x: number; y: number };
  pingsRecebidos(): {
    cenaId: string;
    x: number;
    y: number;
    centralizar: boolean;
    usuarioId: string;
    cor: string;
    exibido: boolean;
  }[];
  pingsNaTela(): { x: number; y: number; cor: string }[];
  definirZoom(z: number): void;
  centrarEm(x: number, y: number): void;
  quadradoM(): number;
  bandeira(): { x: number; y: number } | null;
  areaDaBandeiraAcesa(): boolean;
  portas(): { id: string; tipo: string; estado?: string; meio: { x: number; y: number } }[];
  paredes(): {
    id: string;
    tipo: string;
    estado?: string;
    a: { x: number; y: number };
    b: { x: number; y: number };
    meio?: { x: number; y: number };
  }[];
  /** V5: os contornos de parede e porta estão desenhados (ferramenta, Visão do mestre ou opção da cena)? */
  contornos(): boolean;
  /** 7b-2: as zonas que a tela tem (só o mestre as recebe) e o polígono em desenho. */
  zonas(): { id: string; nome: string; ativa: boolean; pontos: { x: number; y: number }[] }[];
  zonaDesenhando(): { x: number; y: number }[] | null;
  /** N4: os traços da névoa manual que a tela tem, a camada desenhada (visível e o alpha do véu), se um ponto (m) está coberto e o traço em andamento. */
  nevoa(): { forma: string; modo: string; pontos: { x: number; y: number }[]; raio?: number }[];
  nevoaDesenhada(): { visivel: boolean; alpha: number };
  nevoaCobre(x: number, y: number): boolean;
  nevoaEmAndamento(): { x: number; y: number }[] | null;
  /** V5: a porta sob o cursor, o modo de arco, o cursor do mouse e o ponto de fixação (metros). */
  portaDestacada(): string | null;
  modoArco(): boolean;
  cursor(): string;
  pontoDeFixacao(): { x: number; y: number } | null;
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
    /** V11: a mão (0 = 1ª) da tocha na mão de um token; `null` nos objetos de um ponto. */
    mao: number | null;
    /** V11: o raio da alça na tela (px). */
    raio: number;
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

/**
 * Clica no token (mouse de verdade) para selecioná-lo, e confere que foi ESTE o selecionado: logo depois
 * de trocar o mapa da cena, a vista ainda pode se ajustar e o clique cair no token vizinho (tenta de
 * novo). Desde o R5a selecionar NÃO abre o painel do token.
 */
export async function soSelecionarToken(p: Page, id: string) {
  await expect(async () => {
    const alvo = await centrarNoToken(p, id);
    await p.mouse.click(alvo.x, alvo.y);
    await expect
      .poll(async () => (await tokenDe(p, id)).selecionado, { timeout: 1_500 })
      .toBe(true);
  }).toPass({ timeout: 15_000 });
}

/**
 * Abre o painel do token do mestre com dois cliques no token (e confere que é o dele). Desde o R5a o painel
 * não abre mais ao selecionar.
 */
export async function abrirPainelDoToken(p: Page, id: string) {
  await expect(async () => {
    const alvo = await centrarNoToken(p, id);
    await p.mouse.dblclick(alvo.x, alvo.y);
    await expect(p.getByTestId("painel-token")).toHaveAttribute("data-token-id", id, {
      timeout: 1_500,
    });
  }).toPass({ timeout: 15_000 });
}

/** Seleciona o token e abre o painel dele (o que "selecionar" fazia antes do R5a). */
export async function selecionarToken(p: Page, id: string) {
  await soSelecionarToken(p, id);
  await abrirPainelDoToken(p, id);
}

/**
 * "Novo token" pelo caminho novo: formulário (nome, tamanho), Enter, e um clique no mapa (no ponto da
 * página `alvo`, ou no meio do mapa). Devolve o id do token que a sala criou.
 */
export async function criarToken(
  p: Page,
  nome: string,
  opcoes: { tamanho?: number; alvo?: { x: number; y: number } } = {},
): Promise<string> {
  const antes = new Set((await tokensDe(p)).map((t) => t.id));
  await p.getByTestId("novo-token").click();
  await p.getByTestId("novo-token-nome").fill(nome);
  if (opcoes.tamanho) {
    await p.getByTestId("novo-token-tamanho").selectOption(String(opcoes.tamanho));
  }
  await p.getByTestId("novo-token-nome").press("Enter");
  await expect(p.getByTestId("modo-pondo-token-selo")).toBeVisible();
  let alvo = opcoes.alvo;
  if (!alvo) {
    const caixa = await p.getByTestId("mapa").boundingBox();
    if (!caixa) throw new Error("o mapa não está visível");
    alvo = { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 };
  }
  await p.mouse.move(alvo.x, alvo.y);
  await expect
    .poll(() =>
      p.evaluate(() =>
        (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.previaDoToken(),
      ),
    )
    .not.toBeNull();
  await p.mouse.click(alvo.x, alvo.y);
  let id = "";
  await expect
    .poll(async () => {
      id = (await tokensDe(p)).find((t) => t.nome === nome && !antes.has(t.id))?.id ?? "";
      return id;
    })
    .not.toBe("");
  return id;
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

/**
 * Um ponto da página (ex.: de `pontoNaPagina`) como posição dentro do elemento do mapa: o alvo do
 * `dragTo` é relativo à caixa dele, que (desde o R2) não começa mais no canto da janela.
 */
export async function noElementoDoMapa(p: Page, ponto: { x: number; y: number }) {
  const caixa = await p.getByTestId("mapa").boundingBox();
  if (!caixa) throw new Error("o mapa não está visível");
  return { x: ponto.x - caixa.x, y: ponto.y - caixa.y };
}
