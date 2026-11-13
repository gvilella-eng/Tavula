import type { APIRequestContext, Page } from "@playwright/test";
import { derivarSenha } from "../../packages/shared/src/contas.ts";
import { gerarIdDeMesa } from "../../packages/shared/src/mesas.ts";
import {
  abrirAba,
  abrirAbaInicial,
  abrirPreferencia,
  continuarParaAPasta,
  esperarMapa,
  expect,
  ID_DA_MESA,
  Mesa,
  preencherMesaEConta,
  test,
} from "./ajudas";
import { criarToken, tokensDe } from "./ajudasMapa";

// C1: várias mesas no mesmo servidor, id amigável e a tela inicial. A mesa legada (o DO "campanha", com a
// semente de exemplo) tem o id fixo `ID_DA_MESA` em MODO=teste; as outras nascem vazias.

const FORMATO_DO_ID = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;

/** Cria uma mesa pela API (como a tela inicial faz) e devolve o id. */
async function criarMesaPelaApi(pagina: Page, nome: string): Promise<string> {
  const r = await pagina.request.post("/api/mesas", { data: { nome } });
  expect(r.status()).toBe(201);
  const { id } = (await r.json()) as { id: string };
  expect(id).toMatch(FORMATO_DO_ID);
  return id;
}

/**
 * V7: uma mesa nova só tem o mestre. Esta cria uma com a conta do mestre e um jogador já aceito ("Nenhuma": o
 * jogador nasce com o nome da conta, no id `jogador-1`), para os testes que precisam de alguém na mesa.
 */
async function mesaComJogador(request: APIRequestContext, nome: string): Promise<string> {
  const id = gerarIdDeMesa();
  const senha = "senha-boa-1";
  const criar = await request.post("/api/mesas", {
    data: {
      id,
      nome,
      mestre: { login: "chefe", nome: "Chefe", derivada: await derivarSenha(senha, id, "chefe") },
    },
  });
  expect(criar.status()).toBe(201);
  const pedir = await request.post(`/api/m/${id}/conta/pedir`, {
    data: { login: "ana", nome: "Ana", derivada: await derivarSenha(senha, id, "ana") },
  });
  expect(pedir.ok()).toBe(true);
  const { contas } = (await (await request.get(`/api/m/${id}/contas`)).json()) as {
    contas: { id: string; login: string }[];
  };
  const ana = contas.find((c) => c.login === "ana");
  const aceitar = await request.post(`/api/m/${id}/contas/${ana?.id}/aceitar`, { data: {} });
  expect(aceitar.ok()).toBe(true);
  return id;
}

/** Abre a mesa `id` numa aba nova, escolhe o usuário e espera a sala conectar e o mapa subir. */
async function entrarEm(mesa: Mesa, id: string, usuarioId: string) {
  const s = await mesa.abrir();
  await s.pagina.goto(`/m/${id}`);
  await s.pagina.getByTestId(`entrar-${usuarioId}`).click();
  await expect(s.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await esperarMapa(s.pagina);
  return s;
}

test("a tela inicial em / mostra entrar, criar e a lista, com a mesa legada", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("tela-inicial")).toBeVisible();
  await expect(page).toHaveTitle("Távola");
  await expect(page.getByTestId("logo")).toBeVisible();
  // C4: um cartão com três abas; com mesas por aqui abre "Minhas mesas"
  await expect(page.getByTestId("inicio-aba-mesas")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("inicio-aba-entrar")).toHaveText("Entrar com código");
  await expect(page.getByTestId("inicio-aba-criar")).toHaveText("Criar mesa");
  await expect(page.getByTestId("inicio-mesas")).toBeVisible();
  await expect(page.getByTestId("inicio-entrar")).toBeHidden();
  await abrirAbaInicial(page, "entrar");
  await expect(page.getByTestId("inicio-entrar")).toBeVisible();
  await abrirAbaInicial(page, "criar");
  await expect(page.getByTestId("inicio-criar")).toBeVisible();
  await abrirAbaInicial(page, "mesas");
  // no E2E o servidor lista as mesas (LISTAR_MESAS=1): a campanha de sempre está lá, com o id fixo
  const cartao = page.getByTestId(`inicio-mesa-${ID_DA_MESA}`);
  await expect(cartao).toContainText("Campanha");
  await expect(cartao).toContainText(ID_DA_MESA);
  await cartao.click();
  await expect(page).toHaveURL(new RegExp(`/m/${ID_DA_MESA}$`));
  await expect(page.getByTestId("entrar-mestre")).toBeVisible();
  // as rotas antigas, sem id, deixaram de existir
  for (const rota of ["/api/usuarios", "/api/eu"]) {
    expect((await page.request.get(rota)).status()).toBe(404);
  }
});

test("criar uma mesa mostra o id grande, copia o id e o link e abre uma mesa vazia", async ({
  browser,
}) => {
  const mesa = new Mesa(browser, { permissions: ["clipboard-read", "clipboard-write"] });
  try {
    const s = await mesa.abrir();
    const p = s.pagina;
    await p.goto("/");
    await abrirAbaInicial(p, "criar");
    await expect(p.getByTestId("inicio-criar-continuar")).toBeDisabled();
    // C2: a mesa nasce com a conta do mestre (login, nome e senha com confirmação); C4: no passo 1, que não avança
    await preencherMesaEConta(p, {
      mesa: "Masmorra do teste",
      login: "vila",
      nome: "Vilela",
      senha: "senha-boa-1",
      confirmar: "senha-boa-2",
    });
    await p.getByTestId("inicio-criar-continuar").click();
    await expect(p.getByTestId("inicio-criar-erro")).toHaveText(
      "A confirmação não é igual à senha.",
    );
    await expect(p.getByTestId("inicio-criar-passo")).toHaveText("Passo 1 de 2");
    await p.getByTestId("inicio-criar-confirmar").fill("senha-boa-1");
    await continuarParaAPasta(p);
    await p.getByTestId("inicio-criar-botao").click();

    const idGrande = p.getByTestId("inicio-criada-id");
    await expect(idGrande).toHaveText(FORMATO_DO_ID);
    const id = (await idGrande.textContent()) ?? "";
    await expect(p.getByTestId("inicio-criada")).toContainText("Masmorra do teste");

    await p.getByTestId("inicio-criada-copiar-id").click();
    await expect(p.getByTestId("inicio-criada-copiado")).toHaveText("Id copiado.");
    expect(await p.evaluate(() => navigator.clipboard.readText())).toBe(id);
    await p.getByTestId("inicio-criada-copiar-link").click();
    await expect(p.getByTestId("inicio-criada-copiado")).toHaveText("Link copiado.");
    expect(await p.evaluate(() => navigator.clipboard.readText())).toBe(
      `${new URL(p.url()).origin}/m/${id}`,
    );

    await p.getByTestId("codigo-anotei").check();
    await p.getByTestId("inicio-abrir-mesa").click();
    await expect(p).toHaveURL(new RegExp(`/m/${id}$`));
    // a sessão da conta já está aberta: entra direto na mesa vazia, como mestre
    await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
    await esperarMapa(p);
    expect(await tokensDe(p)).toEqual([]);
    await expect(p.getByTestId("eu-nome")).toHaveText("Vilela");
    await expect(p).toHaveTitle(/^Távola · Masmorra do teste/);

    // num navegador sem sessão: a tela de entrada da mesa e, só em MODO=teste, a escolha de usuário de
    // sempre (só o mestre, V7: nada da semente de exemplo nem vagas "Jogador N")
    const outro = await mesa.abrir();
    await outro.pagina.goto(`/m/${id}`);
    await expect(outro.pagina.getByTestId("entrada-nome-da-mesa")).toHaveText("Masmorra do teste");
    await expect(outro.pagina.getByTestId("entrada-login")).toBeVisible();
    await expect(outro.pagina.getByTestId("entrar-mestre")).toBeVisible();
    await expect(outro.pagina.getByTestId("entrar-jogador-1")).toHaveCount(0);
    await expect(outro.pagina).toHaveTitle("Távola · Masmorra do teste");
  } finally {
    await mesa.fechar();
  }
});

test("abre pelo id digitado com maiúsculas e espaços e pelo link colado", async ({ page }) => {
  const id = await criarMesaPelaApi(page, "Mesa dos ids");
  const digitado = id.toUpperCase().replaceAll("-", " ");

  await page.goto("/");
  await abrirAbaInicial(page, "entrar");
  await page.getByTestId("inicio-entrar-campo").fill(`  ${digitado}  `);
  await page.getByTestId("inicio-entrar-botao").click();
  await expect(page).toHaveURL(new RegExp(`/m/${id}$`));
  await expect(page.getByTestId("entrada-nome-da-mesa")).toHaveText("Mesa dos ids");

  // o link inteiro, colado no mesmo campo
  await page.getByTestId("entrada-trocar-de-mesa").click();
  await expect(page.getByTestId("tela-inicial")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await abrirAbaInicial(page, "entrar");
  await page.getByTestId("inicio-entrar-campo").fill(`http://127.0.0.1:5174/m/${id.toUpperCase()}`);
  await page.getByTestId("inicio-entrar-campo").press("Enter");
  await expect(page).toHaveURL(new RegExp(`/m/${id}$`));
  await expect(page.getByTestId("entrada-nome-da-mesa")).toHaveText("Mesa dos ids");

  // o botão de voltar do navegador volta à tela inicial
  await page.goBack();
  await expect(page.getByTestId("tela-inicial")).toBeVisible();
  await abrirAbaInicial(page, "entrar");

  // o que não parece id é recusado na própria tela
  await page.getByTestId("inicio-entrar-campo").fill("campanha");
  await page.getByTestId("inicio-entrar-botao").click();
  await expect(page.getByTestId("inicio-entrar-erro")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("id inexistente mostra a mensagem e o caminho de volta ao início", async ({ page }) => {
  await page.goto("/m/aaaa-aaaa-aaaa");
  await expect(page.getByTestId("mesa-inexistente")).toBeVisible();
  await expect(page.getByTestId("mesa-inexistente-texto")).toContainText("aaaa-aaaa-aaaa");
  await page.getByTestId("voltar-ao-inicio").click();
  await expect(page.getByTestId("tela-inicial")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  // o que nem tem o formato de um id
  await page.goto("/m/nao-e-um-id");
  await expect(page.getByTestId("mesa-inexistente")).toBeVisible();

  // a API responde 404 em JSON
  const r = await page.request.get("/api/m/aaaa-aaaa-aaaa/usuarios");
  expect(r.status()).toBe(404);
  expect(await r.json()).toEqual({ erro: "mesa_inexistente" });
  expect((await page.request.get("/api/mesas/aaaa-aaaa-aaaa")).status()).toBe(404);
  const ws = await page.request.get("/api/m/aaaa-aaaa-aaaa/ws", {
    headers: { Upgrade: "websocket", Connection: "Upgrade" },
  });
  expect(ws.status()).toBe(404);
});

test("duas mesas são isoladas: token e cookie de uma não valem na outra", async ({
  mesa,
  page,
}) => {
  const a = await criarMesaPelaApi(page, "Mesa A");
  const b = await criarMesaPelaApi(page, "Mesa B");

  // O mestre entra na A e cria um token; o jogador entra na B (que nasce vazia).
  const naA = await entrarEm(mesa, a, "mestre");
  const naB = await entrarEm(mesa, b, "mestre");
  expect(await tokensDe(naA.pagina)).toEqual([]);
  const id = await criarToken(naA.pagina, "Só da mesa A");
  await expect.poll(async () => (await tokensDe(naA.pagina)).map((t) => t.id)).toContain(id);
  // dá tempo da sala difundir; a B continua vazia, também depois de recarregar
  await naB.pagina.reload();
  await esperarMapa(naB.pagina);
  expect(await tokensDe(naB.pagina)).toEqual([]);
  // e a mesa legada (a semente de exemplo) não ganhou o token
  const legada = await entrarEm(mesa, ID_DA_MESA, "mestre");
  expect((await tokensDe(legada.pagina)).some((t) => t.nome === "Só da mesa A")).toBe(false);

  // O cookie de "mestre" da A, no mesmo navegador, não entra na B nem na legada.
  const ctx = (await mesa.abrir()).pagina;
  await ctx.goto(`/m/${a}`);
  await ctx.getByTestId("entrar-mestre").click();
  await expect(ctx.getByTestId("status-conexao")).toHaveText("conectado");
  expect((await ctx.request.get(`/api/m/${a}/eu`)).status()).toBe(200);
  expect((await ctx.request.get(`/api/m/${b}/eu`)).status()).toBe(401);
  expect((await ctx.request.get(`/api/m/${ID_DA_MESA}/eu`)).status()).toBe(401);
  const semCookie = await ctx.request.get(`/api/m/${b}/ws`, {
    headers: { Upgrade: "websocket", Connection: "Upgrade" },
  });
  expect(semCookie.status()).toBe(401);
  await ctx.goto(`/m/${b}`);
  await expect(ctx.getByTestId("tela-de-entrada")).toBeVisible();
  await ctx.goto(`/m/${a}`);
  await expect(ctx.getByTestId("eu-nome")).toBeVisible();
});

test("a lista 'Mesas neste computador' lembra as mesas abertas aqui, mesmo sem a lista do servidor", async ({
  page,
}) => {
  const id = await criarMesaPelaApi(page, "Mesa lembrada");
  // o servidor lista (E2E): a mesa nova aparece
  await page.goto("/");
  await expect(page.getByTestId(`inicio-mesa-${id}`)).toContainText("Mesa lembrada");

  // abrir a mesa a anota neste navegador
  await page.goto(`/m/${id}`);
  await expect(page.getByTestId("entrada-nome-da-mesa")).toHaveText("Mesa lembrada");

  // na internet o servidor não lista: a lista vem do navegador (aqui, simulando o 404 da rota)
  await page.route("**/api/mesas", (rota) =>
    rota.request().method() === "GET"
      ? rota.fulfill({ status: 404, body: "Não encontrado" })
      : rota.fallback(),
  );
  await page.goto("/");
  const cartao = page.getByTestId(`inicio-mesa-${id}`);
  await expect(cartao).toContainText("Mesa lembrada");
  await expect(cartao).toContainText(id);
  // só o que este navegador abriu: a campanha legada não foi aberta aqui
  await expect(page.getByTestId(`inicio-mesa-${ID_DA_MESA}`)).toHaveCount(0);
  await cartao.click();
  await expect(page).toHaveURL(new RegExp(`/m/${id}$`));
});

test("a aba Mesa mostra o nome e o id; o mestre renomeia e o jogador não", async ({
  mesa,
  page,
  request,
}) => {
  const id = await mesaComJogador(request, "Nome antigo");
  const mestre = await entrarEm(mesa, id, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "mesa");
  await expect(p.getByTestId("mesa-id")).toHaveText(id);
  await expect(p.getByTestId("mesa-nome")).toHaveValue("Nome antigo");
  await expect(p.getByTestId("mesa-nome-salvar")).toBeDisabled();

  await p.getByTestId("mesa-nome").fill("Nome novo da mesa");
  await p.getByTestId("mesa-nome-salvar").click();
  await expect(p).toHaveTitle(/^Távola · Nome novo da mesa/);
  await expect(p.getByTestId("mesa-nome-salvar")).toBeDisabled();
  // o diretório gravou: a consulta pelo id e a recarga mostram o nome novo
  await expect
    .poll(async () => (await (await p.request.get(`/api/mesas/${id}`)).json()).nome)
    .toBe("Nome novo da mesa");
  await p.reload();
  await expect(p).toHaveTitle(/^Távola · Nome novo da mesa/);

  // "Trocar de mesa" (Preferências) vai para a tela inicial, onde a mesa está com o nome novo
  await abrirPreferencia(p, "conta");
  await p.getByTestId("trocar-de-mesa").click();
  await expect(p.getByTestId("tela-inicial")).toBeVisible();
  await expect(p.getByTestId(`inicio-mesa-${id}`)).toContainText("Nome novo da mesa");

  // um jogador não renomeia (a aba Mesa nem aparece para ele); sem sessão, 401
  const jogador = await entrarEm(mesa, id, "jogador-1");
  await expect(jogador.pagina.getByTestId("aba-mesa")).toHaveCount(0);
  const tentativa = await jogador.pagina.request.post(`/api/m/${id}/renomear`, {
    data: { nome: "Invasor" },
  });
  expect(tentativa.status()).toBe(403);
  const anonimo = await page.request.post(`/api/m/${id}/renomear`, { data: { nome: "Invasor" } });
  expect(anonimo.status()).toBe(401);
  // nome inválido
  const vazio = await p.request.post(`/api/m/${id}/renomear`, { data: { nome: "   " } });
  expect(vazio.status()).toBe(400);
  expect((await (await page.request.get(`/api/mesas/${id}`)).json()).nome).toBe(
    "Nome novo da mesa",
  );
});

test("criar mesa pela API valida o nome e o tipo do corpo", async ({ page }) => {
  expect((await page.request.post("/api/mesas", { data: { nome: "" } })).status()).toBe(400);
  expect((await page.request.post("/api/mesas", { data: { nome: "x".repeat(61) } })).status()).toBe(
    400,
  );
  expect((await page.request.post("/api/mesas", { data: { nome: 5 } })).status()).toBe(400);
  const texto = await page.request.post("/api/mesas", {
    headers: { "Content-Type": "text/plain" },
    data: JSON.stringify({ nome: "x" }),
  });
  expect(texto.status()).toBe(415);
});
