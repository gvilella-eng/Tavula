import type { Page } from "@playwright/test";
import {
  fonteComSemente,
  type PedidoDeAtaque,
  type ResultadoDeModelo,
  rolarAtaque,
} from "../../packages/shared/src/index.ts";
import { abrirAba, abrirPreferencia, expect, test } from "./ajudas";
import { mandar } from "./ajudasFicha";

// Q5: as rolagens do chat no visual novo. Fita (padrão) e Moldura (Preferências), um cartão por rolagem, o número
// grande, o dano só com o ícone do tipo, vantagem e desvantagem com os dois totais, os dados num balão, a rolagem
// secreta como linha pequena. Os dados saem de uma semente escolhida aqui (a mesma conta que a sala faz).

type Ataque = Omit<PedidoDeAtaque, "modelo" | "como" | "oculta">;

/** A primeira semente cujo ataque satisfaz `serve` (a sala usa as mesmas funções, na mesma ordem). */
function achar(
  pedido: Ataque,
  serve: (r: Extract<ResultadoDeModelo, { modelo: "ataque" }>) => boolean,
) {
  for (let s = 1; s < 4000; s++) {
    const r = rolarAtaque(pedido, fonteComSemente(s));
    if (r.ok && serve(r.resultado)) return s;
  }
  throw new Error("nenhuma semente serve");
}

async function semente(page: Page, n: number) {
  expect((await page.request.post(`/teste/dados?semente=${n}`)).ok()).toBe(true);
}

test("ataque com dano, crítico e falha crítica: cartão por rolagem, cores e ícone do tipo", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const p = j1.pagina;
  await abrirAba(p, "chat");

  const machadinha: Ataque = {
    nome: "Machadinha",
    bonus: 5,
    dano: "1d6+3",
    danoTipo: "Cortante",
    vantagem: "normal",
  };
  // um ataque comum
  await semente(
    p,
    achar(machadinha, (r) => !r.critico && !r.falhaCritica),
  );
  await mandar(p, "chat.modelo", { modelo: "ataque", ...machadinha });
  const comum = p.getByTestId("modelo-ataque").first();
  await expect(comum).toBeVisible();
  await expect(comum).toHaveAttribute("data-estilo", "fita");
  await expect(comum).toHaveAttribute("data-tom", "normal");
  // acerto e dano lado a lado, do mesmo tamanho; o dano é só número e ícone (o nome do tipo no aria-label)
  const totais = comum.getByTestId("rolagem-total");
  await expect(totais).toHaveCount(2);
  const [caixaAcerto, caixaDano] = await Promise.all([
    totais.nth(0).boundingBox(),
    totais.nth(1).boundingBox(),
  ]);
  expect(Math.abs((caixaAcerto?.height ?? 0) - (caixaDano?.height ?? 1))).toBeLessThan(2);
  expect(Math.abs((caixaAcerto?.y ?? 0) - (caixaDano?.y ?? 99))).toBeLessThan(3);
  const icone = comum.getByTestId("icone-de-dano");
  await expect(icone).toHaveCount(1);
  await expect(icone).toHaveAttribute("aria-label", "cortante");
  await expect(icone).toHaveAttribute("title", "cortante");
  await expect(comum).not.toContainText("cortante"); // a palavra não aparece na frente
  // o dano nunca é vermelho nem laranja: o número do dano é o texto do tema
  const cores = await totais.nth(1).evaluate((el) => ({
    num: getComputedStyle(el).color,
    texto: getComputedStyle(document.body).color,
  }));
  expect(cores.num).toBe(cores.texto);

  // o crítico: verde fixo na fita e no número
  await semente(
    p,
    achar(machadinha, (r) => r.critico),
  );
  await mandar(p, "chat.modelo", { modelo: "ataque", ...machadinha });
  const critico = p.getByTestId("modelo-ataque").nth(1);
  await expect(critico).toHaveAttribute("data-tom", "critico");
  await expect(critico.getByTestId("modelo-veredito")).toHaveText("Crítico");
  const fita = await critico
    .locator(".rc-fita")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fita).toBe("rgb(47, 164, 106)"); // --critico, o mesmo em todos os temas

  // a falha crítica (1 natural): cinza apagado, nada de vermelho
  await semente(
    p,
    achar(machadinha, (r) => r.falhaCritica),
  );
  await mandar(p, "chat.modelo", { modelo: "ataque", ...machadinha });
  const falha = p.getByTestId("modelo-ataque").nth(2);
  await expect(falha).toHaveAttribute("data-tom", "falha");
  await expect(falha.getByTestId("modelo-veredito")).toHaveText("1 natural");
  const fundoDaFalha = await falha
    .locator(".rc-fita")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fundoDaFalha).not.toBe("rgb(229, 72, 77)"); // o vermelho antigo

  // cartões seguidos do mesmo remetente dividem o cabeçalho (o nome continua no DOM, só não aparece)
  const mensagens = mestre.pagina.getByTestId("chat-mensagem");
  await abrirAba(mestre.pagina, "chat");
  await expect(mensagens).toHaveCount(3);
  await expect(mensagens.nth(0)).not.toHaveClass(/seguida/);
  await expect(mensagens.nth(1)).toHaveClass(/seguida/);
  await expect(mensagens.nth(2)).toHaveClass(/seguida/);
  await expect(mensagens.nth(1).getByTestId("chat-autor")).toHaveText("Jogador 1");
  const cabecalho = await mensagens.nth(1).locator("header").boundingBox();
  expect(cabecalho?.width ?? 0).toBeLessThanOrEqual(1);
  await expect(mensagens.nth(0).getByTestId("chat-autor")).toBeVisible();
});

test("vantagem e desvantagem mostram os dois totais; o que vale grande, o descartado pequeno", async ({
  mesa,
}) => {
  const j1 = await mesa.entrar("jogador-1");
  const p = j1.pagina;
  await abrirAba(p, "chat");
  await mandar(p, "chat.modelo", {
    modelo: "teste",
    nome: "Teste de Força",
    bonus: 3,
    vantagem: "vantagem",
  });
  await mandar(p, "chat.modelo", {
    modelo: "teste",
    nome: "Teste de Destreza",
    bonus: 4,
    vantagem: "desvantagem",
  });
  const van = p.getByTestId("modelo-teste").nth(0);
  const des = p.getByTestId("modelo-teste").nth(1);
  await expect(van.getByTestId("rolagem-vantagem")).toHaveText("vantagem");
  await expect(des.getByTestId("rolagem-vantagem")).toHaveText("desvantagem");
  const numero = async (c: typeof van, id: string) => Number(await c.getByTestId(id).textContent());
  // vantagem: vale o maior (22 e 16 -> 22); desvantagem: vale o menor
  expect(await numero(van, "rolagem-total")).toBeGreaterThanOrEqual(
    await numero(van, "rolagem-total-descartado"),
  );
  expect(await numero(des, "rolagem-total")).toBeLessThanOrEqual(
    await numero(des, "rolagem-total-descartado"),
  );
  // o descartado é menor na tela e esmaecido
  const tamanhos = await van.evaluate((el) => {
    const grande = el.querySelector('[data-testid="rolagem-total"]') as HTMLElement;
    const pequeno = el.querySelector('[data-testid="rolagem-total-descartado"]') as HTMLElement;
    return {
      grande: Number.parseFloat(getComputedStyle(grande).fontSize),
      pequeno: Number.parseFloat(getComputedStyle(pequeno).fontSize),
      opacidade: Number(getComputedStyle(pequeno).opacity),
    };
  });
  expect(tamanhos.pequeno).toBeLessThan(tamanhos.grande);
  expect(tamanhos.opacidade).toBeLessThan(1);
  // no balão: os dois d20, o que vale com a marca e o descartado riscado
  await van.hover();
  const balao = van.getByTestId("rolagem-balao");
  await expect(balao).toBeVisible();
  await expect(balao.getByTestId("d20-chip")).toHaveCount(2);
  await expect(balao.locator('[data-testid="d20-chip"][data-descartado="true"]')).toHaveCount(1);
  await expect(balao.locator(".rc-chip.ok")).toHaveCount(1);
  await expect(balao).toContainText("o maior");
});

test("magia de salvaguarda (CD | dano) e dardos por nível", async ({ mesa }) => {
  const j1 = await mesa.entrar("jogador-1");
  const p = j1.pagina;
  await abrirAba(p, "chat");
  await mandar(p, "chat.modelo", {
    modelo: "ataque",
    nome: "Bola de Fogo",
    bonus: 0,
    dano: "8d6",
    danoTipo: "Fogo",
    salvaguarda: { cd: 15, atributo: "Destreza", sucesso: "metade" },
  });
  const bola = p.getByTestId("modelo-ataque").first();
  await expect(bola.getByTestId("modelo-cd")).toContainText("CD");
  await expect(bola.getByTestId("modelo-cd-valor")).toHaveText("15");
  await expect(bola.getByTestId("modelo-cd")).toContainText("Destreza");
  await expect(bola.getByTestId("icone-de-dano")).toHaveAttribute("aria-label", "fogo");
  await expect(bola).toContainText("metade");
  // o acerto, que saiu da frente, está no balão
  await bola.hover();
  const balaoDaBola = bola.getByTestId("rolagem-balao");
  await expect(balaoDaBola).toContainText("acerto");
  await expect(balaoDaBola.getByTestId("modelo-dano-formula")).toContainText("8d6 fogo");

  // dardos: o total no cartão e cada dardo no balão
  await p.mouse.move(0, 0);
  await mandar(p, "chat.enviar", {
    texto: "/r 1d4+1 Mísseis Mágicos, Força",
    espaco: { nivel: 2, quantidade: { total: 4, unidade: "dardo", cada: "1d4+1" } },
  });
  const misseis = p.getByTestId("modelo-livre").last();
  await expect(misseis).toContainText("Mísseis Mágicos");
  await expect(misseis.getByTestId("icone-de-dano")).toHaveAttribute("aria-label", "energia");
  await expect(misseis.getByTestId("espaco-usado")).toHaveText("com espaço de 2º · 4 dardos");
  const total = Number(await misseis.getByTestId("rolagem-total").textContent());
  expect(total).toBeGreaterThanOrEqual(8);
  expect(total).toBeLessThanOrEqual(20);
  await misseis.hover();
  await expect(misseis.getByTestId("bloco-quantidade-titulo")).toHaveText(
    "4 dardos · 1d4 + 1 cada",
  );
  await expect(misseis.getByTestId("bloco-quantidade-total").locator("strong")).toHaveText(
    String(total),
  );
});

test("o balão dos dados: mouse parado, foco, Esc; a rolagem oculta é uma linha pequena", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const p = mestre.pagina;
  await abrirAba(p, "chat");
  await mandar(p, "chat.modelo", {
    modelo: "teste",
    nome: "Percepção",
    bonus: 2,
    vantagem: "normal",
  });
  const cartao = p.getByTestId("modelo-teste").first();
  await expect(cartao).toBeVisible();
  await expect(cartao.getByTestId("rolagem-balao")).toHaveCount(0); // só monta no hover
  // com o mouse parado ~350 ms
  const antes = Date.now();
  await cartao.hover();
  await expect(cartao.getByTestId("rolagem-balao")).toBeVisible();
  expect(Date.now() - antes).toBeGreaterThanOrEqual(300);
  await expect(cartao.getByTestId("d20-chip")).toHaveCount(1);
  // o balão não empurra o chat: o cartão fica onde estava
  const caixa = await cartao.boundingBox();
  await p.mouse.move(0, 0);
  await expect(cartao.getByTestId("rolagem-balao")).toHaveCount(0);
  const caixaDepois = await cartao.boundingBox();
  expect(caixaDepois?.y).toBe(caixa?.y);
  expect(caixaDepois?.height).toBe(caixa?.height);
  // com o teclado: o foco mostra o mesmo, Esc fecha
  await cartao.focus();
  await expect(cartao.getByTestId("rolagem-balao")).toBeVisible();
  await expect(cartao).toHaveAttribute("aria-describedby", /.+/);
  await p.keyboard.press("Escape");
  await expect(cartao.getByTestId("rolagem-balao")).toHaveCount(0);

  // rolagem oculta (só o mestre pode): uma linha pequena em itálico, sem caixa
  await mandar(p, "chat.modelo", {
    modelo: "teste",
    nome: "Furtividade do goblin",
    bonus: 4,
    vantagem: "normal",
    oculta: true,
  });
  const secreta = p.getByTestId("modelo-teste").last();
  await expect(secreta).toHaveClass(/rc-secreta/);
  await expect(secreta.locator(".rc-borda")).toHaveCount(0);
  await expect(secreta.getByTestId("etiqueta-oculta")).toHaveText("Rolagem oculta");
  await expect(secreta).toContainText("Furtividade do goblin");
  const estilo = await secreta.evaluate((el) => {
    const c = getComputedStyle(el);
    return { italico: c.fontStyle, fundo: c.backgroundColor, borda: c.borderTopWidth };
  });
  expect(estilo.italico).toBe("italic");
  expect(estilo.fundo).toBe("rgba(0, 0, 0, 0)");
  expect(estilo.borda).toBe("0px");
  // os dados dela também ficam no balão
  await secreta.hover();
  await expect(secreta.getByTestId("rolagem-balao")).toBeVisible();
});

test("Preferências → Aparência: trocar para Moldura muda o estilo, é lembrado e não vai para a sala", async ({
  mesa,
}) => {
  const j1 = await mesa.entrar("jogador-1");
  const p = j1.pagina;
  await abrirAba(p, "chat");
  await mandar(p, "chat.modelo", {
    modelo: "teste",
    nome: "Atletismo",
    bonus: 1,
    vantagem: "normal",
  });
  const cartao = p.getByTestId("modelo-teste").first();
  await expect(cartao).toHaveAttribute("data-estilo", "fita");

  await abrirPreferencia(p, "aparencia");
  await expect(p.getByTestId("estilo-rolagem-fita")).toBeChecked();
  const antes = j1.enviados.length;
  await p.getByTestId("estilo-rolagem-moldura").check({ force: true });
  await expect(p.getByTestId("estilo-rolagem-moldura")).toBeChecked();
  expect(await p.evaluate(() => localStorage.getItem("tabletop:pref:estiloDasRolagens"))).toBe(
    "moldura",
  );
  // só visual: nenhum frame novo para a sala por causa da preferência
  expect(j1.enviados.slice(antes).join("")).not.toContain("estilo");

  await abrirAba(p, "chat");
  await expect(p.getByTestId("modelo-teste").first()).toHaveAttribute("data-estilo", "moldura");
  // a moldura de grimório tem a régua com o losango
  await expect(p.getByTestId("modelo-teste").first().locator(".rc-regra")).toBeVisible();

  // lembrado ao recarregar
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await abrirAba(p, "chat");
  await expect(p.getByTestId("modelo-teste").first()).toHaveAttribute("data-estilo", "moldura");
  // voltar para a Fita
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId("estilo-rolagem-fita").check({ force: true });
  await abrirAba(p, "chat");
  await expect(p.getByTestId("modelo-teste").first()).toHaveAttribute("data-estilo", "fita");
});
