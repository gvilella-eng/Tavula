import {
  type Browser,
  type BrowserContext,
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

/** `frames`: recebidos da sala; `enviados`: enviados pelo navegador. */
export type Sessao = {
  contexto: BrowserContext;
  pagina: Page;
  frames: string[];
  enviados: string[];
};

const textoDoFrame = (payload: string | Buffer) =>
  typeof payload === "string" ? payload : payload.toString("utf8");

/** Abre uma aba da barra lateral (a barra pode estar recolhida) e espera o painel aparecer. */
export async function abrirAba(pagina: Page, id: string): Promise<void> {
  await pagina.getByTestId(`aba-${id}`).click();
  await expect(pagina.getByTestId(`aba-painel-${id}`)).toBeVisible();
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
  constructor(private readonly browser: Browser) {}

  /** Abre um contexto, escolhe o usuário na tela de entrada e espera a sala conectar. */
  async entrar(usuarioId: string): Promise<Sessao> {
    const sessao = await this.abrir();
    await sessao.pagina.goto("/");
    await sessao.pagina.getByTestId(`entrar-${usuarioId}`).click();
    await expect(sessao.pagina.getByTestId("status-conexao")).toHaveText("conectado");
    await expect(sessao.pagina.getByTestId("eu-nome")).toBeVisible();
    return sessao;
  }

  /** Abre um contexto sem entrar. Registra os frames de WebSocket recebidos. */
  async abrir(): Promise<Sessao> {
    const contexto = await this.browser.newContext();
    const pagina = await contexto.newPage();
    const frames: string[] = [];
    const enviados: string[] = [];
    pagina.on("websocket", (ws) => {
      ws.on("framereceived", (f) => frames.push(textoDoFrame(f.payload)));
      ws.on("framesent", (f) => enviados.push(textoDoFrame(f.payload)));
    });
    const sessao = { contexto, pagina, frames, enviados };
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
