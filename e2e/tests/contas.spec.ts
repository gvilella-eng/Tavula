import type { APIRequestContext, Page } from "@playwright/test";
// Só a derivação da senha e o sorteio do id (puros, sem navegador): o teste fala com a API como a tela fala.
import { derivarSenha } from "../../packages/shared/src/contas.ts";
import { gerarIdDeMesa } from "../../packages/shared/src/mesas.ts";
import { abrirAba, expect, ID_DA_MESA, type Mesa, test } from "./ajudas";

// C2: contas por mesa (login e senha), pedidos de entrada aprovados pelo mestre, sessões, limite de tentativas
// e redefinição de senha aprovada pelo mestre. Cada cenário usa mesas novas (ids próprios) ou a legada zerada.

const SENHA = "senha-boa-1";
const OUTRA_SENHA = "outra-senha-2";

test.describe.configure({ timeout: 120_000 });

// --- Montagem -----------------------------------------------------------------------------------

/** Cria uma mesa com a conta do mestre pela tela inicial e devolve o id. */
async function criarMesaComConta(
  p: Page,
  o: { mesa: string; login: string; nome: string; senha?: string },
): Promise<string> {
  const senha = o.senha ?? SENHA;
  await p.goto("/");
  await p.getByTestId("inicio-criar-nome").fill(o.mesa);
  await p.getByTestId("inicio-criar-login").fill(o.login);
  await p.getByTestId("inicio-criar-nome-do-mestre").fill(o.nome);
  await p.getByTestId("inicio-criar-senha").fill(senha);
  await p.getByTestId("inicio-criar-confirmar").fill(senha);
  await p.getByTestId("inicio-criar-botao").click();
  await expect(p.getByTestId("inicio-criada-id")).toBeVisible();
  return (await p.getByTestId("inicio-criada-id").textContent()) ?? "";
}

/** Cria uma mesa com a conta do mestre pela API (como a tela faz) e deixa a sessão no cookie de `request`. */
async function criarMesaPelaApi(
  request: APIRequestContext,
  o: { mesa: string; login: string; nome?: string; senha?: string },
): Promise<string> {
  const id = gerarIdDeMesa();
  const derivada = await derivarSenha(o.senha ?? SENHA, id, o.login);
  const r = await request.post("/api/mesas", {
    data: { id, nome: o.mesa, mestre: { login: o.login, nome: o.nome ?? "Mestre", derivada } },
  });
  expect(r.status()).toBe(201);
  return id;
}

async function naMesa(p: Page) {
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(p.getByTestId("eu-nome")).toBeVisible();
}

async function pedirParaEntrar(
  p: Page,
  id: string,
  o: { nome: string; login: string; senha?: string },
) {
  const senha = o.senha ?? SENHA;
  await p.goto(`/m/${id}`);
  await p.getByTestId("entrada-aba-pedir").click();
  await p.getByTestId("pedir-nome").fill(o.nome);
  await p.getByTestId("pedir-login").fill(o.login);
  await p.getByTestId("pedir-senha").fill(senha);
  await p.getByTestId("pedir-confirmar").fill(senha);
  await p.getByTestId("pedir-enviar").click();
  await expect(p.getByTestId("pedir-enviado")).toHaveText(
    "Pedido enviado. O mestre precisa aceitar; depois entre com seu login e senha.",
  );
}

async function fazerLogin(p: Page, login: string, senha = SENHA) {
  // depois de "Pedir para entrar" a aba aberta é a do pedido
  if (!(await p.getByTestId("entrada-login").isVisible())) {
    await p.getByTestId("entrada-aba-entrar").click();
  }
  await p.getByTestId("entrada-login").fill(login);
  await p.getByTestId("entrada-senha").fill(senha);
  await p.getByTestId("entrada-entrar").click();
}

/** Abre uma aba nova na mesa `id`, já esperando a tela de entrada (sem sessão). */
async function abrirEntrada(mesa: Mesa, id: string) {
  const s = await mesa.abrir();
  await s.pagina.goto(`/m/${id}`);
  await expect(s.pagina.getByTestId("entrada-login")).toBeVisible();
  return s;
}

/** O mestre abre a seção Contas da aba Mesa. */
async function abrirContas(p: Page) {
  await abrirAba(p, "mesa");
  await p.getByTestId("mesa-ir-contas").click();
  await expect(p.getByTestId("contas")).toBeVisible();
}

// --- Cenários -----------------------------------------------------------------------------------

test("criar mesa com conta: o mestre entra, o cookie é da mesa e HttpOnly, sair e voltar pede login e senha", async ({
  mesa,
}) => {
  const s = await mesa.abrir();
  const p = s.pagina;
  const corpos: string[] = [];
  p.on("request", (r) => {
    if (r.url().includes("/api/")) corpos.push(r.postData() ?? "");
  });

  const id = await criarMesaComConta(p, { mesa: "Mesa com dono", login: "Vila", nome: "Vilela" });
  await expect(p.getByTestId("inicio-criada")).toContainText("Mesa com dono");
  // C3: o código de recuperação aparece uma vez e a mesa só abre depois de "Anotei o código"
  await p.getByTestId("codigo-anotei").check();
  await p.getByTestId("inicio-abrir-mesa").click();
  await expect(p).toHaveURL(new RegExp(`/m/${id}$`));
  // direto na mesa, como mestre, com o nome que ele escolheu
  await naMesa(p);
  await expect(p.getByTestId("eu-nome")).toHaveText("Vilela");
  await expect(p.getByTestId("aba-mesa")).toBeVisible();

  // o cookie de sessão: aleatório, só desta mesa, HttpOnly, SameSite=Lax; o JavaScript da página não o vê
  const cookies = await s.contexto.cookies();
  const sessao = cookies.find((c) => c.name === "tavola_sessao");
  expect(sessao).toMatchObject({ httpOnly: true, sameSite: "Lax", path: `/api/m/${id}` });
  expect(sessao?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await p.evaluate(() => document.cookie)).not.toContain("tavola_sessao");

  // recarregar mantém a sessão
  await p.reload();
  await naMesa(p);

  // sair (Preferências) volta à tela de entrada e apaga o cookie
  await abrirAba(p, "preferencias");
  await expect(p.getByTestId("trocar-usuario")).toHaveText("Sair");
  await p.getByTestId("trocar-usuario").click();
  await expect(p.getByTestId("tela-de-entrada")).toBeVisible();
  expect((await s.contexto.cookies()).some((c) => c.name === "tavola_sessao")).toBe(false);

  // login errado e senha errada dão a mesma resposta
  await fazerLogin(p, "ninguem");
  await expect(p.getByTestId("entrada-erro")).toHaveText("Login ou senha incorretos.");
  await fazerLogin(p, "vila", "senha-errada");
  await expect(p.getByTestId("entrada-erro")).toHaveText("Login ou senha incorretos.");
  // login certo (o login não diferencia maiúsculas)
  await fazerLogin(p, "  VILA ");
  await naMesa(p);
  await expect(p.getByTestId("eu-nome")).toHaveText("Vilela");

  // a senha nunca saiu do navegador: nenhuma requisição nem frame a levou
  for (const c of corpos) expect(c).not.toContain(SENHA);
  for (const f of s.enviados) expect(f).not.toContain(SENHA);
  expect(corpos.some((c) => /"derivada":"[A-Za-z0-9_-]{43}"/.test(c))).toBe(true);
});

test("a mesa legada pede a conta do mestre só de uma requisição local, e uma mesa com dono não aceita outra", async ({
  mesa,
  request,
}) => {
  // a legada zerada não tem conta: a tela de entrada oferece criar a conta do mestre
  const s = await mesa.abrir();
  const p = s.pagina;
  await p.goto(`/m/${ID_DA_MESA}`);
  await expect(p.getByTestId("entrada-mestre-inicial")).toBeVisible();
  await expect(p.getByTestId("entrada-mestre-inicial")).toContainText(
    "Criar a conta do mestre desta mesa",
  );
  // a escolha de usuário de teste continua ao lado (só MODO=teste)
  await expect(p.getByTestId("entrar-mestre")).toBeVisible();

  // de uma requisição "da internet" (com CF-Connecting-IP) o servidor recusa
  const derivada = await derivarSenha(SENHA, ID_DA_MESA, "dono");
  const corpo = { login: "dono", nome: "Dono", derivada };
  const fora = await request.post(`/api/m/${ID_DA_MESA}/conta/mestre-inicial`, {
    data: corpo,
    headers: { "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(fora.status()).toBe(403);
  expect((await fora.json()).erro).toBe("so_local");
  // a situação também diz que não pode
  const situacaoFora = await request.get(`/api/m/${ID_DA_MESA}/situacao`, {
    headers: { "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(await situacaoFora.json()).toMatchObject({ semMestre: true, podeCriarMestre: false });
  // sem conta de mestre ninguém pede para entrar
  const pedido = await request.post(`/api/m/${ID_DA_MESA}/conta/pedir`, {
    data: { login: "ana", nome: "Ana", derivada },
  });
  expect(pedido.status()).toBe(409);

  // pela tela (local): cria, entra ligado à vaga mestre que já existe e vê a campanha de hoje
  await p.getByTestId("mestre-inicial-login").fill("dono");
  await p.getByTestId("mestre-inicial-nome").fill("Dono da Mesa");
  await p.getByTestId("mestre-inicial-senha").fill(SENHA);
  await p.getByTestId("mestre-inicial-confirmar").fill("diferente");
  await p.getByTestId("mestre-inicial-criar").click();
  await expect(p.getByTestId("mestre-inicial-erro")).toHaveText(
    "A confirmação não é igual à senha.",
  );
  await p.getByTestId("mestre-inicial-confirmar").fill(SENHA);
  await p.getByTestId("mestre-inicial-criar").click();
  // C3: a conta do mestre da legada nasce com o código de recuperação, mostrado antes de entrar
  await p.getByTestId("codigo-anotei").check();
  await p.getByTestId("codigo-continuar").click();
  // lote T: depois do código, a oferta de proteger com a pasta da mesa ("Agora não" segue para a mesa)
  await expect(p.getByTestId("oferta-de-pasta")).toBeVisible();
  await p.getByTestId("oferta-agora-nao").click();
  await naMesa(p);
  await expect(p.getByTestId("eu-nome")).toHaveText("Dono da Mesa");
  await abrirAba(p, "fichas");
  await expect(p.getByTestId("aba-painel-fichas")).toContainText("Aldric");

  // agora a mesa tem dono: uma segunda conta de mestre não nasce, nem localmente
  const outra = await request.post(`/api/m/${ID_DA_MESA}/conta/mestre-inicial`, {
    data: { login: "intruso", nome: "Intruso", derivada },
  });
  expect(outra.status()).toBe(409);
  expect((await outra.json()).erro).toBe("ja_tem_mestre");
  // e a tela de entrada não oferece mais
  const s2 = await mesa.abrir();
  await s2.pagina.goto(`/m/${ID_DA_MESA}`);
  await expect(s2.pagina.getByTestId("entrada-login")).toBeVisible();
  await expect(s2.pagina.getByTestId("entrada-mestre-inicial")).toHaveCount(0);

  // uma mesa nova, criada com conta, também não aceita
  const id = await criarMesaPelaApi(request, { mesa: "Já tem dono", login: "chefe" });
  const nova = await request.post(`/api/m/${id}/conta/mestre-inicial`, {
    data: { login: "outro", nome: "Outro", derivada },
  });
  expect(nova.status()).toBe(409);
});

test("o jogador pede, o mestre vê o aviso, aceita numa vaga com ficha, e o jogador entra e vê a ficha", async ({
  mesa,
}) => {
  // o mestre cria a conta na legada (que tem fichas: a Aldric é do Jogador 1)
  const m = await mesa.abrir();
  const mp = m.pagina;
  await mp.goto(`/m/${ID_DA_MESA}`);
  await mp.getByTestId("mestre-inicial-login").fill("mestre.real");
  await mp.getByTestId("mestre-inicial-nome").fill("Vilela");
  await mp.getByTestId("mestre-inicial-senha").fill(SENHA);
  await mp.getByTestId("mestre-inicial-confirmar").fill(SENHA);
  await mp.getByTestId("mestre-inicial-criar").click();
  await mp.getByTestId("codigo-anotei").check();
  await mp.getByTestId("codigo-continuar").click();
  await mp.getByTestId("oferta-agora-nao").click();
  await naMesa(mp);
  await expect(mp.getByTestId("aviso-de-contas")).toHaveCount(0);

  // o jogador pede para entrar (outro navegador)
  const j = await mesa.abrir();
  const jp = j.pagina;
  await pedirParaEntrar(jp, ID_DA_MESA, { nome: "Ana", login: "ana" });
  // enquanto pendente, o login certo diz que o pedido ainda não foi aceito; a senha errada, não
  await fazerLogin(jp, "ana");
  await expect(jp.getByTestId("entrada-erro")).toHaveText("Seu pedido ainda não foi aceito.");
  await fazerLogin(jp, "ana", "errada-errada");
  await expect(jp.getByTestId("entrada-erro")).toHaveText("Login ou senha incorretos.");

  // o aviso chega ao mestre ao vivo, no topo, e leva à seção Contas
  await expect(mp.getByTestId("aviso-de-contas")).toHaveText("1 pedido de entrada");
  await mp.getByTestId("aviso-de-contas").click();
  await expect(mp.getByTestId("contas")).toBeVisible();
  const pedido = mp.getByTestId("conta-pedido-ana");
  await expect(pedido).toContainText("Ana");
  await expect(pedido).toContainText("login: ana");
  // as vagas livres e a "Nova vaga" são as opções
  const opcoes = await mp.getByTestId("conta-vaga-ana").locator("option").allTextContents();
  expect(opcoes).toContain("Jogador 1");
  expect(opcoes.at(-1)).toBe("Nova vaga");
  await mp.getByTestId("conta-vaga-ana").selectOption("jogador-1");
  await mp.getByTestId("conta-aceitar-ana").click();
  await expect(mp.getByTestId("conta-pedido-ana")).toHaveCount(0);
  await expect(mp.getByTestId("conta-status-ana")).toHaveText("Ativa");
  await expect(mp.getByTestId("aviso-de-contas")).toHaveCount(0);
  // a vaga ganhou o nome dela (e as fichas continuam da vaga)
  await expect(mp.getByTestId("papel-linha-jogador-1")).toContainText("Ana");

  // o jogador entra e vê a ficha da vaga
  await fazerLogin(jp, "ana");
  await naMesa(jp);
  await expect(jp.getByTestId("eu-nome")).toHaveText("Ana");
  await abrirAba(jp, "fichas");
  await expect(jp.getByTestId("aba-painel-fichas")).toContainText("Aldric");
  // jogador não tem a seção de contas nem o aviso
  await expect(jp.getByTestId("aba-mesa")).toHaveCount(0);
  await expect(jp.getByTestId("aviso-de-contas")).toHaveCount(0);
  // e a rota de contas é só do mestre
  expect((await jp.request.get(`/api/m/${ID_DA_MESA}/contas`)).status()).toBe(403);
  expect(
    (await jp.request.post(`/api/m/${ID_DA_MESA}/contas/qualquer/aceitar`, { data: {} })).status(),
  ).toBe(403);

  // "Nova vaga": um segundo pedido entra numa vaga criada na hora
  const k = await mesa.abrir();
  await pedirParaEntrar(k.pagina, ID_DA_MESA, { nome: "Beto", login: "beto" });
  await expect(mp.getByTestId("conta-pedido-beto")).toBeVisible();
  await mp.getByTestId("conta-vaga-beto").selectOption("nova");
  await mp.getByTestId("conta-aceitar-beto").click();
  await expect(mp.getByTestId("conta-status-beto")).toHaveText("Ativa");
  await expect(mp.getByTestId("conta-vaga-beto")).toHaveValue("jogador-8");
  await fazerLogin(k.pagina, "beto");
  await naMesa(k.pagina);
  await expect(k.pagina.getByTestId("eu-nome")).toHaveText("Beto");
});

test("recusar: o login diz que o pedido foi recusado e só dá para pedir de novo depois de 10 minutos", async ({
  mesa,
  request,
}) => {
  const id = await criarMesaPelaApi(request, { mesa: "Recusa", login: "chefe" });
  const m = await mesa.abrir();
  await m.pagina.goto(`/m/${id}`);
  await fazerLogin(m.pagina, "chefe");
  await naMesa(m.pagina);

  const j = await mesa.abrir();
  await pedirParaEntrar(j.pagina, id, { nome: "Carlos", login: "carlos" });
  await abrirContas(m.pagina);
  await expect(m.pagina.getByTestId("conta-pedido-carlos")).toBeVisible();
  await m.pagina.getByTestId("conta-recusar-carlos").click();
  await expect(m.pagina.getByTestId("conta-pedido-carlos")).toHaveCount(0);
  await expect(m.pagina.getByTestId("conta-status-carlos")).toHaveText("Recusada");

  await fazerLogin(j.pagina, "carlos");
  await expect(j.pagina.getByTestId("entrada-erro")).toHaveText("Seu pedido foi recusado.");
  // pedir de novo logo em seguida: espera
  await j.pagina.getByTestId("entrada-aba-pedir").click();
  await j.pagina.getByTestId("pedir-nome").fill("Carlos");
  await j.pagina.getByTestId("pedir-login").fill("carlos");
  await j.pagina.getByTestId("pedir-senha").fill(SENHA);
  await j.pagina.getByTestId("pedir-confirmar").fill(SENHA);
  await j.pagina.getByTestId("pedir-enviar").click();
  await expect(j.pagina.getByTestId("pedir-erro")).toContainText(
    "Seu pedido foi recusado. Você pode pedir de novo em",
  );
});

test("senha errada 5 vezes bloqueia a conta e a espera é dita; login que não existe responde igual", async ({
  mesa,
  request,
}) => {
  const id = await criarMesaPelaApi(request, { mesa: "Bloqueio", login: "chefe" });
  const tentar = (login: string, derivada: string) =>
    request.post(`/api/m/${id}/conta/entrar`, { data: { login, derivada } });
  const errada = (n: number) => `${String(n).padStart(2, "0")}${"x".repeat(41)}`;

  // login que não existe e senha errada: mesma resposta
  const semConta = await tentar("fantasma", errada(0));
  const comConta = await tentar("chefe", errada(1));
  expect(semConta.status()).toBe(401);
  expect(await semConta.json()).toEqual(await comConta.json());
  expect((await comConta.json()).mensagem).toBe("Login ou senha incorretos.");

  // a 2ª, 3ª e 4ª falhas ainda são "incorretos"; a 5ª bloqueia e diz quanto esperar
  for (let i = 2; i <= 4; i++) {
    expect((await (await tentar("chefe", errada(i))).json()).erro).toBe("credenciais");
  }
  const quinta = await tentar("chefe", errada(5));
  expect(quinta.status()).toBe(429);
  expect(await quinta.json()).toMatchObject({
    erro: "bloqueada",
    minutos: 1,
    mensagem: "Muitas tentativas. Tente de novo em 1 minuto.",
  });
  expect(quinta.headers()["retry-after"]).toBe("60");

  // mesmo a senha certa fica bloqueada, e a tela mostra a espera
  const certa = await derivarSenha(SENHA, id, "chefe");
  expect((await tentar("chefe", certa)).status()).toBe(429);
  const s = await abrirEntrada(mesa, id);
  await fazerLogin(s.pagina, "chefe");
  await expect(s.pagina.getByTestId("entrada-erro")).toHaveText(
    "Muitas tentativas. Tente de novo em 1 minuto.",
  );
  // outra conta da mesma mesa não é afetada pelo bloqueio da primeira (só o IP acumula)
  const outra = await tentar("fantasma", errada(9));
  expect((await outra.json()).erro).toBe("credenciais");
});

test("esqueci a senha: o mestre aprova, o jogador redefine e a sessão antiga cai", async ({
  mesa,
  request,
}) => {
  const id = await criarMesaPelaApi(request, { mesa: "Redefinir", login: "chefe" });
  const m = await mesa.abrir();
  await m.pagina.goto(`/m/${id}`);
  await fazerLogin(m.pagina, "chefe");
  await naMesa(m.pagina);

  // a Ana entra como jogadora (pedido e aceite) e fica logada no computador A
  const antigo = await mesa.abrir();
  await pedirParaEntrar(antigo.pagina, id, { nome: "Ana", login: "ana" });
  await abrirContas(m.pagina);
  await m.pagina.getByTestId("conta-aceitar-ana").click();
  await expect(m.pagina.getByTestId("conta-status-ana")).toHaveText("Ativa");
  await fazerLogin(antigo.pagina, "ana");
  await naMesa(antigo.pagina);
  // um socket de contagem, só para ver o fechamento com o código 4001
  await antigo.pagina.evaluate((mesaId) => {
    const ws = new WebSocket(`ws://${location.host}/api/m/${mesaId}/ws`);
    (window as unknown as { __fechou: number | null }).__fechou = null;
    ws.onclose = (e) => {
      (window as unknown as { __fechou: number | null }).__fechou = e.code;
    };
  }, id);

  // no computador B: "Esqueci a senha"
  const novo = await abrirEntrada(mesa, id);
  const b = novo.pagina;
  await b.getByTestId("esqueci-link").click();
  await b.getByTestId("esqueci-login").fill("ana");
  await b.getByTestId("esqueci-enviar").click();
  await expect(b.getByTestId("esqueci-enviado")).toBeVisible();
  // sem a liberação, redefinir não vale
  await b.getByTestId("redefinir-link").click();
  await b.getByTestId("redefinir-login").fill("ana");
  await b.getByTestId("redefinir-senha").fill(OUTRA_SENHA);
  await b.getByTestId("redefinir-confirmar").fill(OUTRA_SENHA);
  await b.getByTestId("redefinir-enviar").click();
  await expect(b.getByTestId("redefinir-erro")).toContainText("Não há redefinição liberada");

  // o mestre vê o pedido de redefinição, com o aviso, e aprova
  await expect(m.pagina.getByTestId("aviso-de-contas")).toHaveText("1 pedido de redefinição");
  await expect(m.pagina.getByTestId("conta-redefinicao-ana")).toBeVisible();
  await expect(m.pagina.getByTestId("contas-aviso-redefinicao")).toHaveText(
    "Confirme por voz ou mensagem que é a própria pessoa.",
  );
  await m.pagina.getByTestId("conta-liberar-ana").click();
  await expect(m.pagina.getByTestId("conta-redefinicao-ana")).toHaveCount(0);
  await expect(m.pagina.getByTestId("conta-liberada-ana")).toBeVisible();

  // agora a nova senha vale e já entra
  await b.getByTestId("redefinir-enviar").click();
  await naMesa(b);
  await expect(b.getByTestId("eu-nome")).toHaveText("Ana");

  // a sessão antiga caiu: o socket fechou com 4001, a página voltou à entrada e a API recusa o cookie
  await expect
    .poll(() =>
      antigo.pagina.evaluate(() => (window as unknown as { __fechou: number | null }).__fechou),
    )
    .toBe(4001);
  await expect(antigo.pagina.getByTestId("tela-de-entrada")).toBeVisible();
  // a senha antiga não entra mais; a nova, sim
  const velha = await request.post(`/api/m/${id}/conta/entrar`, {
    data: { login: "ana", derivada: await derivarSenha(SENHA, id, "ana") },
  });
  expect(velha.status()).toBe(401);
  const nova = await request.post(`/api/m/${id}/conta/entrar`, {
    data: { login: "ana", derivada: await derivarSenha(OUTRA_SENHA, id, "ana") },
  });
  expect(nova.status()).toBe(200);
  // a liberação valeu uma vez só
  const denovo = await request.post(`/api/m/${id}/conta/redefinir`, {
    data: { login: "ana", derivada: await derivarSenha(SENHA, id, "ana") },
  });
  expect(denovo.status()).toBe(403);
});

test("remover a conta derruba o socket; a vaga fica e a pessoa não entra mais", async ({
  mesa,
  request,
}) => {
  const id = await criarMesaPelaApi(request, { mesa: "Remover", login: "chefe" });
  const m = await mesa.abrir();
  await m.pagina.goto(`/m/${id}`);
  await fazerLogin(m.pagina, "chefe");
  await naMesa(m.pagina);

  const j = await mesa.abrir();
  await pedirParaEntrar(j.pagina, id, { nome: "Dani", login: "dani" });
  await abrirContas(m.pagina);
  await m.pagina.getByTestId("conta-vaga-dani").selectOption("jogador-2");
  await m.pagina.getByTestId("conta-aceitar-dani").click();
  await expect(m.pagina.getByTestId("conta-status-dani")).toHaveText("Ativa");
  await fazerLogin(j.pagina, "dani");
  await naMesa(j.pagina);
  await j.pagina.evaluate((mesaId) => {
    const ws = new WebSocket(`ws://${location.host}/api/m/${mesaId}/ws`);
    (window as unknown as { __fechou: number | null }).__fechou = null;
    ws.onclose = (e) => {
      (window as unknown as { __fechou: number | null }).__fechou = e.code;
    };
  }, id);

  // o mestre não remove a própria conta
  await expect(m.pagina.getByTestId("conta-remover-chefe")).toHaveCount(0);
  // remover pede confirmação
  await m.pagina.getByTestId("conta-remover-dani").click();
  await m.pagina.getByTestId("conta-remover-cancelar-dani").click();
  await expect(m.pagina.getByTestId("conta-linha-dani")).toBeVisible();
  await m.pagina.getByTestId("conta-remover-dani").click();
  await m.pagina.getByTestId("conta-remover-confirmar-dani").click();
  await expect(m.pagina.getByTestId("conta-linha-dani")).toHaveCount(0);

  await expect
    .poll(() =>
      j.pagina.evaluate(() => (window as unknown as { __fechou: number | null }).__fechou),
    )
    .toBe(4001);
  await expect(j.pagina.getByTestId("tela-de-entrada")).toBeVisible();
  // a vaga ficou (com o nome dela) e a conta sumiu
  await expect(m.pagina.getByTestId("papel-linha-jogador-2")).toContainText("Dani");
  await fazerLogin(j.pagina, "dani");
  await expect(j.pagina.getByTestId("entrada-erro")).toHaveText("Login ou senha incorretos.");
});

test("o cookie de uma mesa não vale em outra, nem o token copiado à mão", async ({
  mesa,
  request,
}) => {
  const a = await criarMesaPelaApi(request, { mesa: "Mesa A", login: "chefe" });
  const b = await criarMesaPelaApi(request, { mesa: "Mesa B", login: "chefe" });
  // O `request` guardou a sessão do mestre da A e a da B (cada uma com o Path da sua mesa).
  expect((await request.get(`/api/m/${a}/eu`)).status()).toBe(200);
  expect((await request.get(`/api/m/${b}/eu`)).status()).toBe(200);

  // numa mesa sem sessão (o navegador do jogador) o token da A, copiado à mão, também não vale na B
  const s = await mesa.abrir();
  await s.pagina.goto(`/m/${a}`);
  await fazerLogin(s.pagina, "chefe");
  await naMesa(s.pagina);
  const tokenA = (await s.contexto.cookies()).find((c) => c.name === "tavola_sessao")?.value ?? "";
  expect(tokenA).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const cabecalho = { Cookie: `tavola_sessao=${tokenA}` };
  const naB = await s.pagina.request.get(`/api/m/${b}/eu`, { headers: cabecalho });
  expect(naB.status()).toBe(401);
  const wsNaB = await s.pagina.request.get(`/api/m/${b}/ws`, {
    headers: { ...cabecalho, Upgrade: "websocket", Connection: "Upgrade" },
  });
  expect(wsNaB.status()).toBe(401);
  const contasNaB = await s.pagina.request.get(`/api/m/${b}/contas`, { headers: cabecalho });
  expect(contasNaB.status()).toBe(401);
  // e na própria A, o mesmo cabeçalho vale
  expect((await s.pagina.request.get(`/api/m/${a}/eu`, { headers: cabecalho })).status()).toBe(200);

  // o navegador não manda o cookie da A para a B (o Path), e a B mostra a entrada
  await s.pagina.goto(`/m/${b}`);
  await expect(s.pagina.getByTestId("entrada-login")).toBeVisible();
  // o login solto de teste (id do usuário) não vale numa conta de verdade: só o `tabletop_sessao` de MODO=teste
  for (const falso of ["tavola_sessao=mestre", "tabletop_sessao=mestre"]) {
    const solto = await s.pagina.request.get(`/api/m/${b}/contas`, { headers: { Cookie: falso } });
    expect(solto.status()).toBe(401);
  }
});

test("nenhum frame, resposta nem exportação leva senha, derivada, sal, hash ou token de sessão", async ({
  mesa,
  request,
}) => {
  const id = await criarMesaPelaApi(request, { mesa: "Sigilo", login: "chefe.sigilo" });
  const derivadaDoMestre = await derivarSenha(SENHA, id, "chefe.sigilo");
  const derivadaDaAna = await derivarSenha(OUTRA_SENHA, id, "ana.sigilo");

  const m = await mesa.abrir();
  await m.pagina.goto(`/m/${id}`);
  await fazerLogin(m.pagina, "chefe.sigilo");
  await naMesa(m.pagina);
  const tokenDoMestre =
    (await m.contexto.cookies()).find((c) => c.name === "tavola_sessao")?.value ?? "";

  const j = await mesa.abrir();
  await pedirParaEntrar(j.pagina, id, {
    nome: "Ana Sigilo",
    login: "ana.sigilo",
    senha: OUTRA_SENHA,
  });
  await abrirContas(m.pagina);
  await m.pagina.getByTestId("conta-aceitar-ana.sigilo").click();
  await expect(m.pagina.getByTestId("conta-status-ana.sigilo")).toHaveText("Ativa");
  await fazerLogin(j.pagina, "ana.sigilo", OUTRA_SENHA);
  await naMesa(j.pagina);
  const tokenDaAna =
    (await j.contexto.cookies()).find((c) => c.name === "tavola_sessao")?.value ?? "";

  // o mestre exporta a campanha (o arquivo chega como frame) e lê a lista de contas pela rota própria
  await abrirAba(m.pagina, "mesa");
  const baixa = m.pagina.waitForEvent("download");
  await m.pagina.getByTestId("exportar").click();
  const arquivo = await (await baixa).createReadStream();
  const exportado = await new Promise<string>((ok) => {
    const partes: Buffer[] = [];
    arquivo.on("data", (c: Buffer) => partes.push(c));
    arquivo.on("end", () => ok(Buffer.concat(partes).toString("utf8")));
  });
  const listaDoMestre = await (await m.pagina.request.get(`/api/m/${id}/contas`)).text();
  expect(listaDoMestre).toContain("ana.sigilo");

  const segredos = [SENHA, OUTRA_SENHA, derivadaDoMestre, derivadaDaAna, tokenDoMestre, tokenDaAna];
  const tudo = [
    ...m.frames,
    ...j.frames,
    exportado,
    listaDoMestre,
    await (await m.pagina.request.get(`/api/m/${id}/eu`)).text(),
    await (await m.pagina.request.get(`/api/m/${id}/situacao`)).text(),
  ];
  expect(m.frames.length).toBeGreaterThan(1);
  expect(j.frames.length).toBeGreaterThan(1);
  for (const texto of tudo) {
    for (const segredo of segredos) expect(texto).not.toContain(segredo);
    // as chaves da conta guardada (sal e hash da senha, token de sessão) nunca aparecem
    expect(texto).not.toMatch(/"(sal|derivada|senha|hashDaSenha|hash_token)"\s*:/);
  }
  // o jogador nem a lista de contas pode ler
  expect((await j.pagina.request.get(`/api/m/${id}/contas`)).status()).toBe(403);
  // a exportação não leva contas nem logins
  expect(exportado).not.toContain("ana.sigilo");
  expect(exportado).not.toContain("chefe.sigilo");
  // nem a lista do mestre tem sal, hash ou token
  const campos = new Set(
    (JSON.parse(listaDoMestre) as { contas: object[] }).contas.flatMap((c) => Object.keys(c)),
  );
  expect([...campos].sort()).toEqual(
    [
      "criadaEm",
      "id",
      "login",
      "nome",
      "papel",
      "redefinicaoAte",
      "redefinicaoPedida",
      "status",
      "ultimoAcesso",
      "vagaId",
      "vagaNome",
    ].sort(),
  );
  // o único frame de contas que o mestre recebe é o aviso, só com números e o nome e o login do pedido
  const avisos = m.frames.filter((f) => f.includes('"contas.aviso"'));
  expect(avisos.length).toBeGreaterThan(0);
  for (const a of avisos) {
    const dados = JSON.parse(a).dados as Record<string, unknown>;
    expect(Object.keys(dados).sort()).toEqual(["novo", "pendentes", "redefinicoes"]);
  }
  // o jogador nunca recebe o aviso de contas
  expect(j.frames.some((f) => f.includes('"contas.aviso"'))).toBe(false);
});

test("trocar a senha em Preferências derruba as outras sessões e mantém a atual; renomear a mesa chega ao vivo", async ({
  mesa,
  request,
}) => {
  const id = await criarMesaPelaApi(request, { mesa: "Nome de antes", login: "chefe" });
  const m = await mesa.abrir();
  await m.pagina.goto(`/m/${id}`);
  await fazerLogin(m.pagina, "chefe");
  await naMesa(m.pagina);

  // o mesmo mestre em outro computador
  const outro = await mesa.abrir();
  await outro.pagina.goto(`/m/${id}`);
  await fazerLogin(outro.pagina, "chefe");
  await naMesa(outro.pagina);
  await expect(outro.pagina).toHaveTitle(/^Távola · Nome de antes/);

  // renomear: quem está na mesa vê o nome novo sem recarregar
  await abrirAba(m.pagina, "mesa");
  await m.pagina.getByTestId("mesa-nome").fill("Nome ao vivo");
  await m.pagina.getByTestId("mesa-nome-salvar").click();
  await expect(outro.pagina).toHaveTitle(/^Távola · Nome ao vivo/);
  await expect(outro.pagina.getByTestId("topo")).toBeVisible();

  // trocar a senha: a atual errada é recusada; a certa troca e derruba a outra sessão
  await abrirAba(m.pagina, "preferencias");
  await m.pagina.getByTestId("senha-atual").fill("errada-errada");
  await m.pagina.getByTestId("senha-nova").fill(OUTRA_SENHA);
  await m.pagina.getByTestId("senha-confirmar").fill("nao-bate");
  await m.pagina.getByTestId("senha-trocar").click();
  await expect(m.pagina.getByTestId("senha-erro")).toHaveText(
    "A confirmação não é igual à nova senha.",
  );
  await m.pagina.getByTestId("senha-confirmar").fill(OUTRA_SENHA);
  await m.pagina.getByTestId("senha-trocar").click();
  await expect(m.pagina.getByTestId("senha-erro")).toHaveText("A senha atual não confere.");
  await m.pagina.getByTestId("senha-atual").fill(SENHA);
  await m.pagina.getByTestId("senha-trocar").click();
  await expect(m.pagina.getByTestId("senha-trocada")).toBeVisible();

  await expect(outro.pagina.getByTestId("tela-de-entrada")).toBeVisible();
  // a sessão de quem trocou continua: recarregar não pede login
  await m.pagina.reload();
  await naMesa(m.pagina);
  // a senha antiga não entra mais, a nova sim
  const velha = await request.post(`/api/m/${id}/conta/entrar`, {
    data: { login: "chefe", derivada: await derivarSenha(SENHA, id, "chefe") },
  });
  expect(velha.status()).toBe(401);
  const nova = await request.post(`/api/m/${id}/conta/entrar`, {
    data: { login: "chefe", derivada: await derivarSenha(OUTRA_SENHA, id, "chefe") },
  });
  expect(nova.status()).toBe(200);
});
