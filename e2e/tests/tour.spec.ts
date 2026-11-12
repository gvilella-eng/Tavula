import type { APIRequestContext, Page } from "@playwright/test";
import { PASSOS_DO_JOGADOR, PASSOS_DO_MESTRE } from "../../apps/web/src/tour/passos.ts";
// Só a derivação da senha e o sorteio do id (puros, sem navegador): o teste fala com a API como a tela fala.
import { derivarSenha } from "../../packages/shared/src/contas.ts";
import { gerarIdDeMesa } from "../../packages/shared/src/mesas.ts";
import { abrirAba, expect, ID_DA_MESA, Mesa, test, tornarMembros } from "./ajudas";

// Lote T: o tour de introdução (mestre ~10 passos, jogador ~6), o "já viu" por conta guardado no servidor, o teclado e
// a garantia de que cada passo ainda acha o seu alvo na tela do papel certo, em 1600×900 e 1280×720. Com MODO=teste o
// tour não abre sozinho (para não atrapalhar os E2E antigos): estes testes ligam a chave `tabletop:pref:tourNoTeste`.
// No fim, as duas pendências do C3: o código de recuperação numa linha só e a oferta de proteger a mesa legada.

const SENHA = "senha-boa-1";
const CHAVE = "tabletop:pref:tourNoTeste";

test.describe.configure({ timeout: 120_000 });

const TAMANHOS = [
  { nome: "1600x900", width: 1600, height: 900 },
  { nome: "1280x720", width: 1280, height: 720 },
] as const;

/** Cria uma mesa com a conta do mestre pela API (como a tela faz) e deixa a sessão no cookie de `request`. */
async function criarMesaPelaApi(request: APIRequestContext, login: string): Promise<string> {
  const id = gerarIdDeMesa();
  const derivada = await derivarSenha(SENHA, id, login);
  const r = await request.post("/api/mesas", {
    data: { id, nome: "Mesa do tour", mestre: { login, nome: "Mestre", derivada } },
  });
  expect(r.status()).toBe(201);
  return id;
}

/** Um jogador pede para entrar e o mestre (cookie em `request`) o aceita na vaga dada. */
async function aceitarJogador(
  request: APIRequestContext,
  pedinte: APIRequestContext,
  id: string,
  login: string,
  vaga: string,
) {
  const derivada = await derivarSenha(SENHA, id, login);
  const p = await pedinte.post(`/api/m/${id}/conta/pedir`, {
    data: { login, nome: `Nome ${login}`, derivada },
  });
  expect(p.ok()).toBe(true);
  const lista = (await (await request.get(`/api/m/${id}/contas`)).json()) as {
    contas: { id: string; login: string }[];
  };
  const conta = lista.contas.find((c) => c.login === login);
  expect(conta).toBeTruthy();
  const a = await request.post(`/api/m/${id}/contas/${conta?.id}/aceitar`, {
    data: { vaga: { usuarioId: vaga } },
  });
  expect(a.ok()).toBe(true);
}

async function entrarComConta(mesa: Mesa, id: string, login: string, comTour: boolean) {
  const s = await mesa.abrir();
  if (comTour) await s.pagina.addInitScript((c) => localStorage.setItem(c, "1"), CHAVE);
  await s.pagina.goto(`/m/${id}`);
  await expect(s.pagina.getByTestId("entrada-login")).toBeVisible();
  await s.pagina.getByTestId("entrada-login").fill(login);
  await s.pagina.getByTestId("entrada-senha").fill(SENHA);
  await s.pagina.getByTestId("entrada-entrar").click();
  await expect(s.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(s.pagina.getByTestId("eu-nome")).toBeVisible();
  return s;
}

const cartao = (p: Page) => p.getByTestId("tour-cartao");

/** O cartão está inteiro dentro da janela. */
async function cartaoDentroDaJanela(p: Page) {
  const caixa = await cartao(p).boundingBox();
  const janela = p.viewportSize();
  expect(caixa).not.toBeNull();
  if (!caixa || !janela) return;
  expect(caixa.x).toBeGreaterThanOrEqual(0);
  expect(caixa.y).toBeGreaterThanOrEqual(0);
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(janela.width);
  expect(caixa.y + caixa.height).toBeLessThanOrEqual(janela.height);
}

/** Anda pelos passos de `passos`: cada um tem de aparecer (nenhum pulado), com o alvo iluminado e o cartão na janela. */
async function percorrer(
  p: Page,
  passos: readonly { id: string; titulo: string; alvo: string | null }[],
) {
  for (const [i, passo] of passos.entries()) {
    await expect(p.getByTestId("tour")).toHaveAttribute("data-passo", passo.id);
    await expect(cartao(p)).toHaveAttribute("data-pronto", "sim");
    await expect(p.getByTestId("tour-titulo")).toHaveText(passo.titulo);
    const ultimo = i === passos.length - 1;
    await expect(p.getByTestId("tour-proximo")).toHaveText(
      `${ultimo ? "Concluir" : "Próximo"} ${i + 1}/${passos.length}`,
    );
    if (passo.alvo) {
      // o alvo existe na tela deste papel, está à vista e é o que o buraco do véu cerca
      await expect(p.getByTestId(passo.alvo).first()).toBeVisible();
      await expect(p.getByTestId("tour-buraco")).toBeVisible();
      const alvo = await p.getByTestId(passo.alvo).first().boundingBox();
      const buraco = await p.getByTestId("tour-buraco").boundingBox();
      expect(alvo && buraco).toBeTruthy();
      if (alvo && buraco) {
        expect(Math.abs(buraco.x - (alvo.x - 4))).toBeLessThan(2);
        expect(Math.abs(buraco.y - (alvo.y - 4))).toBeLessThan(2);
      }
    } else {
      await expect(p.getByTestId("tour-buraco")).toHaveCount(0);
    }
    await expect(p.getByTestId("tour-texto")).not.toHaveText("");
    await cartaoDentroDaJanela(p);
    await p.getByTestId("tour-proximo").click();
  }
  await expect(p.getByTestId("tour")).toHaveCount(0);
}

const tourVisto = async (p: Page, id: string) =>
  ((await (await p.request.get(`/api/m/${id}/eu`)).json()) as { tourVisto?: boolean }).tourVisto;

// --- O primeiro acesso -------------------------------------------------------------------------------

test("o tour abre no primeiro acesso de uma conta nova, Pular o guarda no servidor e não abre no segundo (nem em outro navegador)", async ({
  mesa,
  request,
}) => {
  const id = await criarMesaPelaApi(request, "chefe");

  // MODO=teste sem a chave: nunca abre sozinho
  const sem = await entrarComConta(mesa, id, "chefe", false);
  await expect(sem.pagina.getByTestId("tour")).toHaveCount(0);
  expect(await tourVisto(sem.pagina, id)).toBe(false);

  // com a chave: abre, com o título e o contador do primeiro passo
  const a = await entrarComConta(mesa, id, "chefe", true);
  const p = a.pagina;
  await expect(p.getByTestId("tour")).toBeVisible();
  await expect(p.getByTestId("tour-titulo")).toHaveText("Bem-vindo, mestre");
  await expect(p.getByTestId("tour-proximo")).toHaveText("Próximo 1/10");
  await expect(cartao(p)).toHaveAttribute("role", "dialog");
  await expect(cartao(p)).toHaveAttribute("aria-modal", "true");

  // o servidor devolve só o 0/1 do tour (e nenhum segredo da conta)
  const corpo = await (await p.request.get(`/api/m/${id}/eu`)).text();
  expect(JSON.parse(corpo)).toMatchObject({ login: "chefe", tourVisto: false });
  expect(corpo).not.toMatch(/"(sal|hash|derivada|senha|token)"/);

  await p.getByTestId("tour-pular").click();
  await expect(p.getByTestId("tour")).toHaveCount(0);
  await expect.poll(() => tourVisto(p, id)).toBe(true);

  // recarregar: não abre de novo
  await p.reload();
  await expect(p.getByTestId("eu-nome")).toBeVisible();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(p.getByTestId("tour")).toHaveCount(0);

  // outro navegador, a mesma conta: o "já viu" é do servidor
  const b = await entrarComConta(mesa, id, "chefe", true);
  await expect(b.pagina.getByTestId("tour")).toHaveCount(0);

  // sem sessão não se marca nada
  const anonimo = await mesa.abrir();
  expect((await anonimo.pagina.request.post(`/api/m/${id}/conta/tour-visto`)).ok()).toBe(false);
});

test("o jogador (conta aceita pelo mestre) vê o tour do jogador no primeiro acesso, e terminar o guarda", async ({
  mesa,
  request,
}) => {
  const id = await criarMesaPelaApi(request, "dono");
  const pedinte = (await mesa.abrir()).pagina.request;
  await aceitarJogador(request, pedinte, id, "ana", "jogador-1");

  const s = await entrarComConta(mesa, id, "ana", true);
  const p = s.pagina;
  await expect(p.getByTestId("tour-titulo")).toHaveText("Bem-vindo à mesa");
  await expect(p.getByTestId("tour-proximo")).toHaveText("Próximo 1/6");
  // o primeiro passo do jogador não tem alvo: a tela toda escurece
  await expect(p.getByTestId("tour-buraco")).toHaveCount(0);
  await percorrer(p, PASSOS_DO_JOGADOR);
  await expect.poll(() => tourVisto(p, id)).toBe(true);

  // a conta do mestre é outra: ainda não viu
  expect(
    ((await (await request.get(`/api/m/${id}/eu`)).json()) as { tourVisto?: boolean }).tourVisto,
  ).toBe(false);
});

// --- Teclado, foco e "de novo" ------------------------------------------------------------------------

test("teclado: setas e Enter andam, Esc pula, o foco fica preso no cartão e as letras do app não passam", async ({
  mesa,
  request,
}) => {
  const id = await criarMesaPelaApi(request, "teclas");
  const s = await entrarComConta(mesa, id, "teclas", true);
  const p = s.pagina;
  await expect(p.getByTestId("tour-proximo")).toHaveText("Próximo 1/10");
  // o foco já está no cartão, em "Próximo"
  await expect(p.getByTestId("tour-proximo")).toBeFocused();

  await p.keyboard.press("ArrowRight");
  await expect(p.getByTestId("tour")).toHaveAttribute("data-indice", "1");
  await expect(p.getByTestId("tour-titulo")).toHaveText("Cenas");
  await p.keyboard.press("ArrowLeft");
  await expect(p.getByTestId("tour")).toHaveAttribute("data-indice", "0");
  // Enter com o foco em "Próximo" avança (o clique nativo do botão)
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("tour")).toHaveAttribute("data-indice", "1");
  // Enter fora dos botões também avança
  await p.getByTestId("tour-proximo").blur();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("tour")).toHaveAttribute("data-indice", "2");

  // o Tab nunca sai do cartão (nem com Shift)
  for (let i = 0; i < 6; i++) {
    await p.keyboard.press("Tab");
    expect(
      await p.evaluate(() => !!document.activeElement?.closest('[data-testid="tour-cartao"]')),
    ).toBe(true);
  }
  for (let i = 0; i < 6; i++) {
    await p.keyboard.press("Shift+Tab");
    expect(
      await p.evaluate(() => !!document.activeElement?.closest('[data-testid="tour-cartao"]')),
    ).toBe(true);
  }

  // "R" é a régua no app: com o tour aberto nada muda por baixo do véu
  await p.keyboard.press("r");
  await expect(p.getByTestId("ferramenta-regua")).toHaveAttribute("aria-pressed", "false");

  // Esc pula o tour todo
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("tour")).toHaveCount(0);
  await expect.poll(() => tourVisto(p, id)).toBe(true);
});

test("Fazer o tour de novo (Preferências) abre o tour outra vez, no primeiro passo, mesmo já visto", async ({
  mesa,
}) => {
  const s = await mesa.entrar("jogador-1");
  const p = s.pagina;
  // usuário solto de teste (sem conta): nunca abre sozinho
  await expect(p.getByTestId("tour")).toHaveCount(0);
  await abrirAba(p, "preferencias");
  await p.getByTestId("tour-refazer").click();
  await expect(p.getByTestId("tour-titulo")).toHaveText("Bem-vindo à mesa");
  await expect(p.getByTestId("tour-proximo")).toHaveText("Próximo 1/6");
  await p.keyboard.press("ArrowRight");
  await expect(p.getByTestId("tour-titulo")).toHaveText("O mapa e o seu token");
  await p.getByTestId("tour-voltar").click();
  await expect(p.getByTestId("tour-titulo")).toHaveText("Bem-vindo à mesa");
  await expect(p.getByTestId("tour-voltar")).toBeDisabled();
  await p.getByTestId("tour-pular").click();
  await expect(p.getByTestId("tour")).toHaveCount(0);
  // o foco volta para onde estava (o botão de refazer)
  await expect(p.getByTestId("tour-refazer")).toBeFocused();
});

// --- Cada passo acha o seu alvo -----------------------------------------------------------------------

for (const t of TAMANHOS) {
  test(`cada passo do tour do mestre acha o alvo na tela do mestre (${t.nome})`, async ({
    browser,
  }) => {
    const m = new Mesa(browser, { viewport: { width: t.width, height: t.height } });
    try {
      const p = (await m.entrar("mestre")).pagina;
      await abrirAba(p, "preferencias");
      await p.getByTestId("tour-refazer").click();
      await percorrer(p, PASSOS_DO_MESTRE);
    } finally {
      await m.fechar();
    }
  });

  test(`cada passo do tour do jogador acha o alvo na tela do jogador (${t.nome})`, async ({
    browser,
  }) => {
    const m = new Mesa(browser, { viewport: { width: t.width, height: t.height } });
    try {
      const p = (await m.entrar("jogador-1")).pagina;
      await abrirAba(p, "preferencias");
      await p.getByTestId("tour-refazer").click();
      await percorrer(p, PASSOS_DO_JOGADOR);
    } finally {
      await m.fechar();
    }
  });
}

test("passo cujo alvo não existe é pulado, nos dois sentidos, e o tour não trava (Paredes some em Ver como jogador)", async ({
  mesa,
  request,
}) => {
  await tornarMembros(request, "jogador-1");
  const p = (await mesa.entrar("mestre")).pagina;
  // "Ver como" um jogador: a ferramenta Paredes sai da barra (só o mestre a tem)
  await p.getByTestId("menu-ver-como").click();
  await p.getByTestId("ver-como-jogador-1").click();
  await expect(p.getByTestId("ferramenta-paredes")).toHaveCount(0);
  await abrirAba(p, "preferencias");
  await p.getByTestId("tour-refazer").click();
  for (let i = 0; i < 3; i++) await p.getByTestId("tour-proximo").click();
  await expect(p.getByTestId("tour")).toHaveAttribute("data-passo", "ferramentas");
  // para frente: Paredes não aparece e o tour segue para a Luz
  await p.getByTestId("tour-proximo").click();
  await expect(p.getByTestId("tour")).toHaveAttribute("data-passo", "luz", { timeout: 6000 });
  await expect(cartao(p)).toHaveAttribute("data-pronto", "sim");
  // para trás: volta direto às Ferramentas
  await p.getByTestId("tour-voltar").click();
  await expect(p.getByTestId("tour")).toHaveAttribute("data-passo", "ferramentas", {
    timeout: 6000,
  });
});

// --- Pendências do C3 -----------------------------------------------------------------------------------

test("o código de recuperação cabe numa linha só em 1280×720 e a mesa legada oferece proteger com a pasta (Agora não / Proteger)", async ({
  browser,
}) => {
  const m = new Mesa(browser, { viewport: { width: 1280, height: 720 } });
  try {
    const p = (await m.abrir()).pagina;
    await p.goto(`/m/${ID_DA_MESA}`);
    await p.getByTestId("mestre-inicial-login").fill("legado");
    await p.getByTestId("mestre-inicial-nome").fill("Mestre Legado");
    await p.getByTestId("mestre-inicial-senha").fill(SENHA);
    await p.getByTestId("mestre-inicial-confirmar").fill(SENHA);
    await p.getByTestId("mestre-inicial-criar").click();

    // o código inteiro numa linha só, sem corte
    const codigo = p.getByTestId("codigo-valor");
    await expect(codigo).toBeVisible();
    const medidas = await codigo.evaluate((el) => ({
      cabe: el.scrollWidth <= el.clientWidth,
      altura: el.getBoundingClientRect().height,
      linha:
        Number.parseFloat(getComputedStyle(el).lineHeight) ||
        Number.parseFloat(getComputedStyle(el).fontSize) * 1.5,
    }));
    expect(medidas.cabe).toBe(true);
    expect(medidas.altura).toBeLessThan(medidas.linha * 2 + 2);
    expect(((await codigo.textContent()) ?? "").trim()).toMatch(/^([a-z2-9]{4}-){4}[a-z2-9]{4}$/);

    // depois de anotar, a oferta: proteger com a pasta da mesa ou "Agora não"
    await p.getByTestId("codigo-anotei").check();
    await p.getByTestId("codigo-continuar").click();
    await expect(p.getByTestId("oferta-de-pasta")).toBeVisible();
    await expect(p.getByTestId("oferta-agora-nao")).toBeVisible();
    await p.evaluate(() =>
      (
        window as unknown as { __tabletopPastas: { escolher(n: string): void } }
      ).__tabletopPastas.escolher("OFERTA"),
    );
    await p.getByTestId("oferta-proteger").click();
    // a chave foi gravada na pasta e a mesa abriu
    await expect(p.getByTestId("eu-nome")).toHaveText("Mestre Legado");
    const arquivos = await p.evaluate(() =>
      (
        window as unknown as { __tabletopPastas: { arquivos(n: string): string[] } }
      ).__tabletopPastas.arquivos("OFERTA"),
    );
    expect(arquivos).toContain("tavola-mestre.json");
    await abrirAba(p, "mesa");
    await p.getByTestId("mesa-ir-contas").click();
    await expect(p.getByTestId("protecao-chave-estado")).toHaveText("Pasta com chave: protegida");
  } finally {
    await m.fechar();
  }
});
