import type { Page } from "@playwright/test";
import { PORTA_WEB_E2E } from "../portas.ts";
import {
  abrirAba,
  abrirPreferencia,
  continuarParaAPasta,
  expect,
  preencherMesaEConta,
  test,
} from "./ajudas";

// C3: pasta da mesa com chave (ECDSA), código de recuperação mostrado uma vez, recuperação do mestre pela pasta e
// pelo código, pasta de outra mesa recusada, "Proteger com a pasta da mesa" e a conferência da Origin. A pasta
// do navegador (File System Access) é trocada por uma pasta de teste (`window.__tabletopPastas`, só no modo e2e).

const SENHA = "senha-boa-1";
const NOVA_SENHA = "senha-nova-2";
const ARQUIVO = "tavola-mestre.json";
const PADRAO_DO_CODIGO = /^([a-z2-9]{4}-){4}[a-z2-9]{4}$/;

test.describe.configure({ timeout: 120_000 });

type Ganchos = {
  __tabletopPastas: {
    escolher(nome: string | null): void;
    ler(nome: string, arquivo: string): string | null;
    arquivos(nome: string): string[];
  };
};

const escolherPasta = (p: Page, nome: string) =>
  p.evaluate((n) => (window as unknown as Ganchos).__tabletopPastas.escolher(n), nome);
const lerDaPasta = (p: Page, nome: string, arquivo = ARQUIVO) =>
  p.evaluate(
    ([n, a]) => (window as unknown as Ganchos).__tabletopPastas.ler(n as string, a as string),
    [nome, arquivo],
  );

/** Cria uma mesa pela tela inicial (com a pasta de teste `pasta`, se vier) e devolve o id e o código mostrado. */
async function criarMesa(
  p: Page,
  o: { mesa: string; login: string; pasta?: string; senha?: string },
): Promise<{ id: string; codigo: string }> {
  const senha = o.senha ?? SENHA;
  await p.goto("/");
  await preencherMesaEConta(p, {
    mesa: o.mesa,
    login: o.login,
    nome: "Mestre do Teste",
    senha,
  });
  await continuarParaAPasta(p);
  if (o.pasta) {
    await escolherPasta(p, o.pasta);
    await p.getByTestId("inicio-criar-pasta").click();
    await expect(p.getByTestId("inicio-criar-pasta-nome")).toHaveText(`Pasta: ${o.pasta}`);
  }
  await p.getByTestId("inicio-criar-botao").click();
  await expect(p.getByTestId("inicio-criada-id")).toBeVisible();
  const id = ((await p.getByTestId("inicio-criada-id").textContent()) ?? "").trim();
  const codigo = ((await p.getByTestId("codigo-valor").textContent()) ?? "").trim();
  return { id, codigo };
}

async function anotarEAbrir(p: Page, id: string) {
  await p.getByTestId("codigo-anotei").check();
  await p.getByTestId("inicio-abrir-mesa").click();
  await expect(p).toHaveURL(new RegExp(`/m/${id}$`));
  await naMesa(p);
}

async function naMesa(p: Page) {
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(p.getByTestId("eu-nome")).toBeVisible();
}

async function sair(p: Page) {
  await abrirPreferencia(p, "conta");
  await p.getByTestId("trocar-usuario").click();
  await expect(p.getByTestId("tela-de-entrada")).toBeVisible();
}

async function irParaRecuperacao(p: Page, modo: "pasta" | "codigo") {
  await p.getByTestId("mestre-esqueci-link").click();
  await expect(p.getByTestId("mestre-opcoes")).toBeVisible();
  await p.getByTestId(`mestre-opcao-${modo}`).click();
}

async function entrarComoMestre(p: Page, login: string, senha: string) {
  await p.getByTestId("entrada-login").fill(login);
  await p.getByTestId("entrada-senha").fill(senha);
  await p.getByTestId("entrada-entrar").click();
}

test("criar mesa com pasta: o arquivo da chave aparece, o código é mostrado uma vez e a privada nunca viaja", async ({
  mesa,
}) => {
  const s = await mesa.abrir();
  const p = s.pagina;
  const corpos: string[] = [];
  p.on("request", (r) => {
    if (r.url().includes("/api/")) corpos.push(r.postData() ?? "");
  });
  await p.goto("/");
  const { id, codigo } = await criarMesa(p, {
    mesa: "Mesa da pasta",
    login: "chaveiro",
    pasta: "A",
  });

  // o arquivo de chave está na pasta, com o aviso, o id da mesa e a chave privada (JWK)
  expect(await lerDaPasta(p, "A", "outro.json")).toBeNull();
  const arquivo = JSON.parse((await lerDaPasta(p, "A")) ?? "null");
  expect(arquivo).toMatchObject({
    formato: "tavola-mestre-v1",
    mesaId: id,
    nomeDaMesa: "Mesa da pasta",
    chavePrivada: { kty: "EC", crv: "P-256" },
  });
  expect(arquivo.aviso).toContain("Não o compartilhe");
  expect(arquivo.chavePrivada.d).toMatch(/^[A-Za-z0-9_-]{43}$/);

  // o código: 20 caracteres do alfabeto dos ids em 5 grupos; a mesa só abre depois de "Anotei o código"
  expect(codigo).toMatch(PADRAO_DO_CODIGO);
  await expect(p.getByTestId("inicio-abrir-mesa")).toBeDisabled();
  await expect(p.getByTestId("inicio-criar-outra")).toBeDisabled();
  await p.getByTestId("codigo-copiar").click();
  await expect(p.getByTestId("codigo-copiado")).toBeVisible();
  await anotarEAbrir(p, id);

  // nem a chave privada nem o código voltam a aparecer: não estão na tela da mesa nem foram pedidos de novo
  await abrirAba(p, "mesa");
  await expect(p.getByTestId("protecao-chave-estado")).toHaveText("Pasta com chave: protegida");
  await expect(p.getByTestId("protecao-codigo-estado")).toHaveText("Código de recuperação: gerado");
  await expect(p.locator("body")).not.toContainText(codigo);
  // a privada (o `d`) nunca saiu do navegador: nenhum corpo enviado ao servidor a leva
  for (const c of corpos) expect(c).not.toContain(arquivo.chavePrivada.d);
  // a pública, sim: é só ela que o servidor recebe
  const criacao = corpos.find((c) => c.includes('"chavePublica"')) ?? "";
  expect(criacao).toContain(arquivo.chavePrivada.x);
  // nenhum frame da sala leva o código nem a chave
  for (const f of s.frames) {
    expect(f).not.toContain(codigo);
    expect(f).not.toContain(arquivo.chavePrivada.d);
  }
});

test("recuperar pela pasta: a chave assina o desafio, a senha nova vale e a antiga não", async ({
  mesa,
}) => {
  const s = await mesa.abrir();
  const p = s.pagina;
  const { id } = await criarMesa(p, { mesa: "Pela pasta", login: "chaveiro", pasta: "P1" });
  await anotarEAbrir(p, id);
  await sair(p);

  await irParaRecuperacao(p, "pasta");
  await p.getByTestId("mestre-pasta-login").fill("chaveiro");
  await p.getByTestId("mestre-pasta-senha").fill(NOVA_SENHA);
  await p.getByTestId("mestre-pasta-confirmar").fill(NOVA_SENHA);
  await escolherPasta(p, "P1");
  await p.getByTestId("mestre-pasta-enviar").click();
  await expect(p.getByTestId("mestre-recuperado")).toBeVisible();
  await p.getByTestId("mestre-recuperado-entrar").click();
  await naMesa(p);
  await expect(p.getByTestId("eu-nome")).toHaveText("Mestre do Teste");

  // a senha antiga não vale mais; a nova, sim
  await sair(p);
  await entrarComoMestre(p, "chaveiro", SENHA);
  await expect(p.getByTestId("entrada-erro")).toHaveText("Login ou senha incorretos.");
  await entrarComoMestre(p, "chaveiro", NOVA_SENHA);
  await naMesa(p);
});

test("recuperar pelo código: o código usado morre e um novo aparece na hora", async ({
  mesa,
  request,
}) => {
  const s = await mesa.abrir();
  const p = s.pagina;
  const { id, codigo } = await criarMesa(p, { mesa: "Pelo código", login: "codigueiro" });
  await anotarEAbrir(p, id);
  await sair(p);

  await irParaRecuperacao(p, "codigo");
  // código errado: mensagem genérica
  await p.getByTestId("mestre-codigo-login").fill("codigueiro");
  await p.getByTestId("mestre-codigo-codigo").fill("aaaa-aaaa-aaaa-aaaa-aaaa");
  await p.getByTestId("mestre-codigo-senha").fill(NOVA_SENHA);
  await p.getByTestId("mestre-codigo-confirmar").fill(NOVA_SENHA);
  await p.getByTestId("mestre-codigo-enviar").click();
  await expect(p.getByTestId("mestre-codigo-erro")).toHaveText(
    "Não foi possível recuperar o acesso com isso. Confira e tente de novo.",
  );

  // o certo (maiúsculas e sem hífens também servem)
  await p.getByTestId("mestre-codigo-codigo").fill(codigo.toUpperCase().replaceAll("-", " "));
  await p.getByTestId("mestre-codigo-enviar").click();
  await expect(p.getByTestId("tela-do-codigo")).toBeVisible();
  const novo = ((await p.getByTestId("codigo-valor").textContent()) ?? "").trim();
  expect(novo).toMatch(PADRAO_DO_CODIGO);
  expect(novo).not.toBe(codigo);
  await expect(p.getByTestId("codigo-continuar")).toBeDisabled();
  await p.getByTestId("codigo-anotei").check();
  await p.getByTestId("codigo-continuar").click();
  await naMesa(p);

  // o código usado está morto: a API recusa igual a qualquer código errado
  const usado = await request.post(`/api/m/${id}/conta/recuperar/codigo`, {
    data: {
      login: "codigueiro",
      codigo,
      derivada: "A".repeat(43),
    },
  });
  expect(usado.status()).toBe(401);
  expect((await usado.json()).erro).toBe("recuperacao_invalida");
});

test("a pasta de outra mesa é recusada antes de pedir o desafio", async ({ mesa }) => {
  const s = await mesa.abrir();
  const p = s.pagina;
  const a = await criarMesa(p, { mesa: "Mesa A", login: "dona.a", pasta: "FA" });
  await anotarEAbrir(p, a.id);
  await sair(p);
  const b = await criarMesa(p, { mesa: "Mesa B", login: "dono.b", pasta: "FB" });
  await anotarEAbrir(p, b.id);
  await sair(p);

  // na mesa A, com a pasta da B
  await p.goto(`/m/${a.id}`);
  await irParaRecuperacao(p, "pasta");
  const desafios: string[] = [];
  p.on("request", (r) => {
    if (r.url().includes("recuperar/")) desafios.push(r.url());
  });
  await p.getByTestId("mestre-pasta-login").fill("dona.a");
  await p.getByTestId("mestre-pasta-senha").fill(NOVA_SENHA);
  await p.getByTestId("mestre-pasta-confirmar").fill(NOVA_SENHA);
  await escolherPasta(p, "FB");
  await p.getByTestId("mestre-pasta-enviar").click();
  await expect(p.getByTestId("mestre-pasta-erro")).toHaveText("Esta pasta é de outra mesa.");
  expect(desafios).toEqual([]);

  // uma pasta sem o arquivo também é recusada, sem dizer nada da mesa
  await escolherPasta(p, "vazia");
  await p.getByTestId("mestre-pasta-enviar").click();
  await expect(p.getByTestId("mestre-pasta-erro")).toContainText(`Não achei o ${ARQUIVO}`);
});

test("mesa sem chave: 'Proteger com a pasta da mesa' grava o arquivo e 'Gerar novo código' troca o código", async ({
  mesa,
  request,
}) => {
  const s = await mesa.abrir();
  const p = s.pagina;
  const { id, codigo } = await criarMesa(p, { mesa: "Sem chave", login: "semchave" });
  await expect(p.getByTestId("inicio-criada-pasta")).toContainText("ficou sem a chave da pasta");
  await anotarEAbrir(p, id);
  await abrirAba(p, "mesa");
  await expect(p.getByTestId("protecao-chave-estado")).toHaveText(
    "Pasta com chave: ainda sem chave",
  );
  await expect(p.getByTestId("protecao-pasta")).toHaveText("Proteger com a pasta da mesa");

  // pede a senha atual: com a errada nada é gravado
  await p.getByTestId("protecao-senha").fill("senha-errada");
  await escolherPasta(p, "PC");
  await p.getByTestId("protecao-pasta").click();
  await expect(p.getByTestId("protecao-erro")).toHaveText("A senha atual não confere.");
  expect(await lerDaPasta(p, "PC")).toBeNull();

  await p.getByTestId("protecao-senha").fill(SENHA);
  await escolherPasta(p, "PC");
  await p.getByTestId("protecao-pasta").click();
  await expect(p.getByTestId("protecao-aviso")).toContainText(ARQUIVO);
  await expect(p.getByTestId("protecao-chave-estado")).toHaveText("Pasta com chave: protegida");
  await expect(p.getByTestId("protecao-pasta")).toHaveText("Trocar a chave da pasta");
  expect(JSON.parse((await lerDaPasta(p, "PC")) ?? "null")).toMatchObject({ mesaId: id });

  // novo código: aparece uma vez, o anterior morre
  await p.getByTestId("protecao-senha").fill(SENHA);
  await p.getByTestId("protecao-novo-codigo").click();
  await expect(p.getByTestId("codigo-de-recuperacao")).toBeVisible();
  const novo = ((await p.getByTestId("codigo-valor").textContent()) ?? "").trim();
  expect(novo).toMatch(PADRAO_DO_CODIGO);
  expect(novo).not.toBe(codigo);
  await expect(p.getByTestId("protecao-codigo-fechar")).toBeDisabled();
  await p.getByTestId("codigo-anotei").check();
  await p.getByTestId("protecao-codigo-fechar").click();
  await expect(p.getByTestId("codigo-de-recuperacao")).toHaveCount(0);
  const velho = await request.post(`/api/m/${id}/conta/recuperar/codigo`, {
    data: { login: "semchave", codigo, derivada: "A".repeat(43) },
  });
  expect((await velho.json()).erro).toBe("recuperacao_invalida");

  // trocar a chave: a pasta é de outra mesa? A mesma pasta, da mesma mesa, serve
  await p.getByTestId("protecao-senha").fill(SENHA);
  const antes = await lerDaPasta(p, "PC");
  await escolherPasta(p, "PC");
  await p.getByTestId("protecao-pasta").click();
  await expect(p.getByTestId("protecao-aviso")).toBeVisible();
  expect(await lerDaPasta(p, "PC")).not.toBe(antes);
});

test("a Origin é conferida no WebSocket e nos POSTs: de outro site, 403; sem Origin ou da mesma origem, passa", async ({
  mesa,
  request,
}) => {
  const s = await mesa.abrir();
  const base = new URL(
    s.pagina.url() === "about:blank" ? `http://127.0.0.1:${PORTA_WEB_E2E}` : s.pagina.url(),
  );
  const propria = base.origin;

  const de = (origin: string) => ({ headers: { Origin: origin }, data: { nome: "" } });
  const fora = await request.post("/api/mesas", de("https://evil.example"));
  expect(fora.status()).toBe(403);
  expect((await fora.json()).erro).toBe("origem_invalida");
  // a mesma origem chega à validação do corpo (400), sem Origin também
  expect((await request.post("/api/mesas", de(propria))).status()).toBe(400);
  expect((await request.post("/api/mesas", { data: { nome: "" } })).status()).toBe(400);

  // o upgrade do WebSocket de outro site é recusado antes de qualquer outra coisa
  const ws = await request.get("/api/m/t3st-m3sa-e2e7/ws", {
    headers: { Origin: "https://evil.example", Upgrade: "websocket", Connection: "Upgrade" },
  });
  expect(ws.status()).toBe(403);
  // e a rota de conta da mesa também (POST)
  const conta = await request.post("/api/m/t3st-m3sa-e2e7/conta/entrar", {
    headers: { Origin: "https://evil.example" },
    data: {},
  });
  expect(conta.status()).toBe(403);
});
