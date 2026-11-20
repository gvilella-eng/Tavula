import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  test as base,
  expect,
  type Page,
} from "@playwright/test";

/**
 * A mesa legada em `MODO=teste` (o DO "campanha", semeado com o exemplo): o id é fixo, o mesmo de
 * `ID_DA_MESA_LEGADA_DE_TESTE` em packages/shared/src/mesas.ts (a unidade confere o formato).
 */
export const ID_DA_MESA = "t3st-m3sa-e2e7";
export const CAMINHO_DA_MESA = `/m/${ID_DA_MESA}`;

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

/**
 * V7: na mesa só existe quem entrou. Em MODO=teste o login solto (`/entrar`) numa vaga a torna membro, sem abrir
 * página: serve para os testes que precisam ver uma vaga nas listas (exceções, Papéis, "+N" do topo) sem ter
 * alguém conectado nela.
 */
export async function tornarMembros(request: APIRequestContext, ...usuarios: string[]) {
  for (const usuarioId of usuarios) {
    const r = await request.post(`/api/m/${ID_DA_MESA}/entrar`, { data: { usuarioId } });
    expect(r.ok()).toBe(true);
  }
}

/** Abre uma aba da barra lateral (a barra pode estar recolhida) e espera o painel aparecer. */
export async function abrirAba(pagina: Page, id: string): Promise<void> {
  await pagina.getByTestId(`aba-${id}`).click();
  await expect(pagina.getByTestId(`aba-painel-${id}`)).toBeVisible();
  // Q8: a aba Mesa tem cartões que abrem e fecham (como Preferências); quem só quer a aba vê tudo aberto.
  if (id === "mesa") await abrirTodasAsSecoesDaMesa(pagina);
}

/** Q8: as seções da aba Mesa, na ordem em que aparecem. */
export type SecaoDaMesa =
  | "esta-mesa"
  | "regras"
  | "luz"
  | "assets"
  | "gravacoes"
  | "automacoes"
  | "pessoas"
  | "campanha"
  | "diagnostico";

/** Q8: abre a seção pedida da aba Mesa (se já estiver aberta, não mexe). A aba precisa estar aberta. */
export async function abrirSecaoDaMesa(pagina: Page, secao: SecaoDaMesa): Promise<void> {
  const titulo = pagina.getByTestId(`mesa-secao-${secao}-titulo`);
  await expect(titulo).toBeVisible();
  if ((await titulo.getAttribute("aria-expanded")) !== "true") await titulo.click();
  await expect(titulo).toHaveAttribute("aria-expanded", "true");
}

/** Q8: abre todas as seções da aba Mesa. */
export async function abrirTodasAsSecoesDaMesa(pagina: Page): Promise<void> {
  for (const s of [
    "esta-mesa",
    "regras",
    "luz",
    "assets",
    "automacoes",
    "pessoas",
    "campanha",
    "diagnostico",
  ] as const) {
    await abrirSecaoDaMesa(pagina, s);
  }
}

/** P1: as seções da aba Preferências, na ordem em que aparecem. */
export type SecaoDePreferencias =
  | "conta"
  | "aparencia"
  | "som"
  | "mapa"
  | "assets"
  | "ajuda"
  | "claude"
  | "seguranca"
  | "atalhos";

/** P1: abre a aba Preferências e a seção pedida (se já estiver aberta, não mexe). Só a Conta abre por padrão. */
export async function abrirPreferencia(pagina: Page, secao: SecaoDePreferencias): Promise<void> {
  await abrirAba(pagina, "preferencias");
  const titulo = pagina.getByTestId(`pref-secao-${secao}-titulo`);
  if ((await titulo.getAttribute("aria-expanded")) !== "true") await titulo.click();
  await expect(titulo).toHaveAttribute("aria-expanded", "true");
}

/**
 * V14: escolhe o arquivo de uma campanha exportada na aba Mesa e confirma "Importar e substituir" (o arquivo escolhido
 * espera a confirmação na própria página). A aba Mesa precisa estar aberta.
 */
export async function importarCampanha(
  pagina: Page,
  arquivo: string | { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await pagina.getByTestId("importar-arquivo").setInputFiles(arquivo);
  await pagina.getByTestId("importar-confirmar").click();
}

/** Menu superior do mestre → Cenas: abre a faixa de cenas (se já não está aberta). */
export async function abrirFaixa(pagina: Page): Promise<void> {
  if (!(await pagina.getByTestId("faixa-cenas").isVisible())) {
    await pagina.getByTestId("menu-cenas").click();
  }
  await expect(pagina.getByTestId("faixa-cenas")).toBeVisible();
}

export type AcaoDaCena =
  | "ir"
  | "levar"
  | "duplicar"
  | "preparar"
  | "apagar"
  | "configurar"
  | "cartao";

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
    await sessao.pagina.goto(CAMINHO_DA_MESA);
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
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
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

/** C4: a tela inicial é um cartão com abas; clica na aba (`mesas`, `entrar` ou `criar`) e espera ela abrir. */
export async function abrirAbaInicial(pagina: Page, aba: "mesas" | "entrar" | "criar") {
  const botao = pagina.getByTestId(`inicio-aba-${aba}`);
  await botao.click();
  await expect(botao).toHaveAttribute("aria-selected", "true");
}

/** C4: abre a aba "Criar mesa" e preenche o passo 1 (mesa e conta). A senha repetida é `confirmar` (padrão: a mesma). */
export async function preencherMesaEConta(
  pagina: Page,
  o: { mesa: string; login: string; nome: string; senha: string; confirmar?: string },
) {
  await abrirAbaInicial(pagina, "criar");
  await pagina.getByTestId("inicio-criar-nome").fill(o.mesa);
  await pagina.getByTestId("inicio-criar-login").fill(o.login);
  await pagina.getByTestId("inicio-criar-nome-do-mestre").fill(o.nome);
  await pagina.getByTestId("inicio-criar-senha").fill(o.senha);
  await pagina.getByTestId("inicio-criar-confirmar").fill(o.confirmar ?? o.senha);
}

/** C4: do passo 1 ao passo 2 ("Pasta da mesa"). */
export async function continuarParaAPasta(pagina: Page) {
  await pagina.getByTestId("inicio-criar-continuar").click();
  await expect(pagina.getByTestId("inicio-criar-passo")).toHaveText("Passo 2 de 2");
}
