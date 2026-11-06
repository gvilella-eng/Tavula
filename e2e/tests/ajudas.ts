import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  test as base,
  expect,
  type Page,
} from "@playwright/test";

export const USUARIOS = [
  "mestre",
  "jogador-1",
  "jogador-2",
  "jogador-3",
  "jogador-4",
  "jogador-5",
  "jogador-6",
  "jogador-7",
];

/**
 * `frames` e `enviados`: os frames de TEXTO recebidos da sala e enviados pelo navegador.
 * `binarios` e `enviadosBinarios`: os frames binários (pedaços de arquivo), como `Buffer`.
 */
export type Sessao = {
  contexto: BrowserContext;
  pagina: Page;
  frames: string[];
  enviados: string[];
  binarios: Buffer[];
  enviadosBinarios: Buffer[];
};

/** Ganchos do modo e2e para os assets (ver apps/web/src/assets/gerente.ts). */
export type GanchoDeAssets = {
  atrasoPorPedacoMs?: number;
  corromperIndice?: number;
  corromperVezes?: number;
  limiteTile?: number;
};

/** Abre uma aba da barra lateral (a barra pode estar recolhida) e espera o painel aparecer. */
export async function abrirAba(pagina: Page, id: string): Promise<void> {
  await pagina.getByTestId(`aba-${id}`).click();
  await expect(pagina.getByTestId(`aba-painel-${id}`)).toBeVisible();
}

/** Menu superior do mestre → Cenas: abre a faixa de cenas (se já não está aberta). */
export async function abrirFaixa(pagina: Page): Promise<void> {
  if (!(await pagina.getByTestId("faixa-cenas").isVisible())) {
    await pagina.getByTestId("menu-cenas").click();
  }
  await expect(pagina.getByTestId("faixa-cenas")).toBeVisible();
}

export type AcaoDaCena = "ir" | "levar" | "duplicar" | "preparar" | "apagar" | "configurar";

/** Botão direito no card da cena e escolhe uma linha do menu de contexto. */
export async function menuDaCena(pagina: Page, cenaId: string, acao: AcaoDaCena): Promise<void> {
  await abrirFaixa(pagina);
  await pagina.locator(`[data-testid="cena-card"][data-cena-id="${cenaId}"]`).click({
    button: "right",
  });
  await expect(pagina.getByTestId("menu-cena")).toBeVisible();
  await pagina.getByTestId(`menu-cena-${acao}`).click();
}

/** Menu superior → Camadas → escolhe a camada de trabalho. */
export async function escolherCamada(
  pagina: Page,
  camada: "mapa" | "tokens" | "mestre" | "desenho",
): Promise<void> {
  await pagina.getByTestId("menu-camadas").click();
  await pagina.getByTestId(`camada-${camada}`).click();
}

/** Espera o mapa (PixiJS) subir: o gancho de teste só existe no modo e2e. */
export async function esperarMapa(pagina: Page): Promise<void> {
  await expect
    .poll(() =>
      pagina.evaluate(
        () => (window as unknown as { __tabletop?: unknown }).__tabletop !== undefined,
      ),
    )
    .toBe(true);
}

/** Um conjunto de navegadores (um contexto por usuário, como se fossem PCs diferentes). */
export class Mesa {
  private readonly sessoes: Sessao[] = [];
  /** `contexto`: opções de cada navegador aberto (os prints usam um viewport de 1600×900). */
  constructor(
    private readonly browser: Browser,
    private readonly contexto: BrowserContextOptions = {},
  ) {}

  /**
   * Abre um contexto, escolhe o usuário na tela de entrada e espera a sala conectar. `gancho`
   * vira `window.__tabletopE2E` antes da página carregar (envio lento, pedaço corrompido, limite
   * do tile); só vale no modo e2e.
   */
  async entrar(usuarioId: string, gancho?: GanchoDeAssets): Promise<Sessao> {
    const sessao = await this.abrir();
    if (gancho) {
      await sessao.pagina.addInitScript((g) => {
        (window as unknown as { __tabletopE2E?: unknown }).__tabletopE2E = g;
      }, gancho);
    }
    await sessao.pagina.goto("/");
    await sessao.pagina.getByTestId(`entrar-${usuarioId}`).click();
    await expect(sessao.pagina.getByTestId("status-conexao")).toHaveText("conectado");
    await expect(sessao.pagina.getByTestId("eu-nome")).toBeVisible();
    return sessao;
  }

  /** Abre um contexto sem entrar. Registra os frames de WebSocket recebidos. */
  async abrir(): Promise<Sessao> {
    const contexto = await this.browser.newContext(this.contexto);
    const pagina = await contexto.newPage();
    // Erro de JavaScript na página aparece no relatório (um mapa que trava em silêncio é difícil de achar).
    pagina.on("pageerror", (e) => console.log("[erro na página]", e.message, e.stack));
    const frames: string[] = [];
    const enviados: string[] = [];
    const binarios: Buffer[] = [];
    const enviadosBinarios: Buffer[] = [];
    // Texto chega como string e binário como Buffer: cada um vai para a sua lista.
    const guardar = (texto: string[], binario: Buffer[]) => (f: { payload: string | Buffer }) => {
      if (typeof f.payload === "string") texto.push(f.payload);
      else binario.push(Buffer.from(f.payload));
    };
    pagina.on("websocket", (ws) => {
      ws.on("framereceived", guardar(frames, binarios));
      ws.on("framesent", guardar(enviados, enviadosBinarios));
    });
    const sessao = { contexto, pagina, frames, enviados, binarios, enviadosBinarios };
    this.sessoes.push(sessao);
    return sessao;
  }

  async fechar(): Promise<void> {
    await Promise.all(this.sessoes.map((s) => s.contexto.close().catch(() => {})));
    this.sessoes.length = 0;
  }
}

export const test = base.extend<{ mesa: Mesa; zerado: undefined }>({
  // Todo teste começa com a sala zerada (e reaplicada a semente).
  zerado: [
    async ({ request }, use) => {
      const r = await request.post("/teste/zerar");
      expect(r.ok()).toBe(true);
      await use(undefined);
    },
    { auto: true },
  ],
  mesa: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser);
    await use(mesa);
    await mesa.fechar();
  },
});

export { expect };

/**
 * Abre um segundo WebSocket na página (com o cookie dela) e envia texto cru; devolve a primeira
 * mensagem de `erro` ou `evento` que a sala mandar de volta (ou `null` se nada vier).
 */
export async function enviarCru(
  pagina: Page,
  texto: string,
): Promise<{ tipo: string; dados: { codigo?: string } } | null> {
  return pagina.evaluate(
    (t) =>
      new Promise((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/ws`);
        const fim = setTimeout(() => {
          ws.close();
          resolve(null);
        }, 4000);
        ws.onopen = () => ws.send(t);
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data as string);
          if (m.tipo === "erro" || m.tipo === "evento") {
            clearTimeout(fim);
            ws.close();
            resolve(m);
          }
        };
      }),
    texto,
  );
}

export function intencaoCrua(tipo: string, dados: object): string {
  return JSON.stringify({ v: 1, id: `teste-${Math.random().toString(36).slice(2)}`, tipo, dados });
}
