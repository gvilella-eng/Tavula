import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, intencaoCrua, test } from "./ajudas";
import {
  definirValor,
  ligarOrdem,
  linha,
  menuDaLinha,
  nomesNaOrdem,
  rodadaDe,
  vezNaOrdem,
} from "./ajudasCombate";
import { abrirFicha, mandar } from "./ajudasFicha";
import { centrarNoToken, entrarNoMapa, soSelecionarToken, tokenDe } from "./ajudasMapa";

// V2: ordem de turno simples. Uma lista com o nome e o número; o mestre abre e fecha para todos, edita os
// números e a rodada, ordena, passa o turno e limpa; o jogador entra pela Iniciativa da ficha, com o token
// selecionado. A semente traz Aldric, Brisa e Cael (jogador-1, 2 e 3), o Ogro, um goblin oculto e um marcador
// na camada do mestre.

const ALDRIC = "pers-aldric";
const BRISA = "pers-brisa";

const selecionado = async (p: Page, id: string) => (await tokenDe(p, id)).selecionado;

/** Entra pela intenção da sala (o que a Iniciativa da ficha faz); o mestre usa para montar a cena do teste. */
const adicionar = (p: Page, tokens: string[]) =>
  mandar(p, "combate.adicionar", {
    entradas: tokens.map((t) => ({ id: `e-${t}`, tokenId: t })),
  });

/** Clica no token com o mouse de verdade, sem exigir que ele fique selecionado. */
async function clicarNoToken(p: Page, id: string) {
  const alvo = await centrarNoToken(p, id);
  await p.mouse.click(alvo.x, alvo.y);
}

/** O total da última rolagem de Iniciativa no chat (abre a aba do chat). */
async function ultimoTotalDoChat(p: Page): Promise<number> {
  await abrirAba(p, "chat");
  const cartao = p.locator('[data-testid="chat-mensagem"][data-tipo="modelo"]').last();
  await expect(cartao).toContainText("Iniciativa");
  return Number(await cartao.getByTestId("rolagem-total").textContent());
}

test("o mestre abre a ordem e o jogador vê; fechar (×) fecha para todos sem apagar; reabrir devolve a lista e a rodada", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  await expect(j1.pagina.getByTestId("ordem-de-turno")).toHaveCount(0);

  await ligarOrdem(m);
  await expect(j1.pagina.getByTestId("ordem-de-turno")).toBeVisible();
  await adicionar(m, ["tok-jogador-1", "tok-ogro"]);
  await expect(linha(j1.pagina, "Ogro")).toBeVisible();
  await definirValor(m, "Aldric", 12);
  await definirValor(m, "Ogro", 17);
  const rodada = m.getByTestId("ordem-rodada-valor");
  await rodada.fill("3");
  await rodada.press("Enter");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 3");
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Ogro", "Aldric"]);

  // o jogador fecha a janela só na tela dele (o × dele não manda nada à sala) e ela volta quando o mestre reabre;
  // minimizar é com dois cliques no cabeçalho, só na tela dele
  await expect(j1.pagina.getByTestId("janela-ordem-minimizar")).toHaveCount(0);
  const antes = j1.enviados.length;
  await j1.pagina.getByTestId("janela-ordem-fechar").click();
  await expect(j1.pagina.getByTestId("ordem-de-turno")).toHaveCount(0);
  await expect(m.getByTestId("ordem-de-turno")).toBeVisible();
  expect(j1.enviados.length).toBe(antes);
  await m.getByTestId("janela-ordem-fechar").click();
  await expect(m.getByTestId("ordem-de-turno")).toHaveCount(0);
  await ligarOrdem(m);
  await expect(j1.pagina.getByTestId("ordem-de-turno")).toBeVisible();
  const cab = await j1.pagina.getByTestId("janela-ordem").getByRole("toolbar").boundingBox();
  if (!cab) throw new Error("sem cabeçalho");
  await j1.pagina.mouse.dblclick(cab.x + 24, cab.y + cab.height / 2);
  await expect(j1.pagina.getByTestId("janela-ordem")).toHaveAttribute("data-minimizada", "true");
  await expect(m.getByTestId("janela-ordem")).toHaveAttribute("data-minimizada", "false");
  await j1.pagina.mouse.dblclick(cab.x + 24, cab.y + cab.height / 2);
  await expect(j1.pagina.getByTestId("janela-ordem")).toHaveAttribute("data-minimizada", "false");

  // o mestre fecha pelo ×: some para todos, e a lista e a rodada ficam guardadas na sala
  await m.getByTestId("janela-ordem-fechar").click();
  for (const s of [mestre, j1]) await expect(s.pagina.getByTestId("ordem-de-turno")).toHaveCount(0);
  await expect(m.getByTestId("menu-ordem-turno")).toHaveAttribute("aria-pressed", "false");

  // reabre pelo menu: a lista, os números e a rodada estão como antes, para todos
  await ligarOrdem(m);
  for (const s of [mestre, j1]) {
    await expect.poll(() => nomesNaOrdem(s.pagina)).toEqual(["Ogro", "Aldric"]);
    await expect(s.pagina.getByTestId("ordem-rodada")).toHaveAttribute("data-rodada", "3");
  }
  await expect(m.getByTestId("ordem-valor-e-tok-ogro")).toHaveValue("17");
  await expect(j1.pagina.getByTestId("ordem-numero-e-tok-ogro")).toHaveText("17");
  await expect(j1.pagina.getByTestId("ordem-numero-e-tok-jogador-1")).toHaveText("12");
});

test("o jogador seleciona o próprio token (só na tela dele), clica em Iniciativa na ficha e entra com o valor rolado, uma vez só", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;

  // seleção do jogador: o próprio token sim; o alheio não; Esc solta; nada vai para a sala; sem painel do token
  const enviadosAntes = j1.enviados.length;
  await soSelecionarToken(p, "tok-jogador-1");
  await expect(p.getByTestId("painel-token")).toHaveCount(0);
  await clicarNoToken(p, "tok-jogador-2");
  await expect.poll(() => selecionado(p, "tok-jogador-2")).toBe(false);
  await expect.poll(() => selecionado(p, "tok-jogador-1")).toBe(false);
  await soSelecionarToken(p, "tok-jogador-1");
  await p.keyboard.press("Escape");
  await expect.poll(() => selecionado(p, "tok-jogador-1")).toBe(false);
  expect(j1.enviados.length).toBe(enviadosAntes);
  await soSelecionarToken(p, "tok-jogador-1");

  // ordem fechada: a Iniciativa da ficha só rola no chat, como antes (não entra em lista nenhuma)
  let ficha = await abrirFicha(p, ALDRIC);
  const iniciativa = ficha.getByTestId("iniciativa");
  await iniciativa.click();
  await expect.poll(() => j1.frames.some((f) => f.includes('"nome":"Iniciativa"'))).toBe(true);
  await expect(mestre.pagina.getByTestId("ordem-de-turno")).toHaveCount(0);
  const aposFechada = await enviarCru(
    p,
    intencaoCrua("combate.entrar", { tokenId: "tok-jogador-1" }),
  );
  expect(aposFechada).toMatchObject({ tipo: "erro", dados: { codigo: "dados_invalidos" } });
  await ficha.getByTestId("janela-ficha-fechar").click();

  // ordem aberta e dois tokens do mesmo personagem: sem seleção, a ficha pede para selecionar
  await ligarOrdem(mestre.pagina);
  await mandar(mestre.pagina, "token.criar", {
    token: {
      id: "tok-aldric-2",
      nome: "Aldric (reserva)",
      cor: "#2ecc71",
      tamanhoQuadrados: 1,
      x: 3,
      y: 3,
      camada: "tokens",
      oculto: false,
      controladoPor: [],
      personagemId: ALDRIC,
    },
  });
  await p.getByTestId("mapa").focus();
  await p.keyboard.press("Escape");
  await expect.poll(() => selecionado(p, "tok-jogador-1")).toBe(false);
  ficha = await abrirFicha(p, ALDRIC);
  await ficha.getByTestId("iniciativa").click();
  await expect(ficha.getByTestId("ficha-aviso-ordem")).toHaveText("Selecione o seu token no mapa.");
  await expect(p.getByTestId("ordem-entrada")).toHaveCount(0);
  await ficha.getByTestId("janela-ficha-fechar").click();

  // com o token selecionado, clicar em Iniciativa rola na sala e põe o token na lista
  await soSelecionarToken(p, "tok-jogador-1");
  ficha = await abrirFicha(p, ALDRIC);
  await ficha.getByTestId("iniciativa").click();
  const entrada = linha(p, "Aldric");
  await expect(entrada).toBeVisible();
  await expect(linha(mestre.pagina, "Aldric")).toBeVisible();
  const id = (await entrada.getAttribute("data-id")) ?? "";
  const naLista = Number(await p.getByTestId(`ordem-numero-${id}`).textContent());
  expect(await ultimoTotalDoChat(p)).toBe(naLista);
  await expect(mestre.pagina.getByTestId(`ordem-valor-${id}`)).toHaveValue(String(naLista));
  const mensagens = await p.locator('[data-testid="chat-mensagem"][data-tipo="modelo"]').count();

  // de novo: não entra outra vez nem rola outra vez
  await ficha.getByTestId("iniciativa").click();
  await expect(ficha.getByTestId("ficha-aviso-ordem")).toHaveText("Já está na ordem de turno.");
  await expect(p.getByTestId("ordem-entrada")).toHaveCount(1);
  expect(await p.locator('[data-testid="chat-mensagem"][data-tipo="modelo"]').count()).toBe(
    mensagens,
  );
  const repetido = await enviarCru(p, intencaoCrua("combate.entrar", { tokenId: "tok-jogador-1" }));
  expect(repetido).toMatchObject({ tipo: "erro", dados: { codigo: "dados_invalidos" } });

  // por fora da tela: token alheio, o oculto e o da camada do mestre
  for (const [tokenId, codigo] of [
    ["tok-jogador-2", "sem_permissao"],
    ["tok-ogro", "sem_permissao"],
    ["tok-goblin-oculto", "token_inexistente"],
    ["tok-marcador-mestre", "token_inexistente"],
  ] as const) {
    const r = await enviarCru(p, intencaoCrua("combate.entrar", { tokenId }));
    expect(r, tokenId).toMatchObject({ tipo: "erro", dados: { codigo } });
  }
});

test("o mestre entra pelo mesmo caminho (token selecionado e Iniciativa da ficha) e edita o valor", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const m = mestre.pagina;
  await ligarOrdem(m);
  await soSelecionarToken(m, "tok-jogador-2");
  const ficha = await abrirFicha(m, BRISA);
  await ficha.getByTestId("iniciativa").click();
  await expect(linha(m, "Brisa")).toBeVisible();
  await definirValor(m, "Brisa", 18);
  const id = (await linha(m, "Brisa").getAttribute("data-id")) ?? "";
  await expect(m.getByTestId(`ordem-valor-${id}`)).toHaveValue("18");
});

test("o mestre edita o valor e a rodada clicando; Ordenar; Próximo turno abre a rodada 1 e vira; Limpar com confirmação", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  await ligarOrdem(m);
  await adicionar(m, ["tok-jogador-1", "tok-jogador-2", "tok-jogador-3", "tok-ogro"]);
  await expect(linha(m, "Cael")).toBeVisible();
  await expect(m.getByTestId("ordem-rodada")).toContainText("não começou");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: não começou");

  // números: sem valor ficam no fim; vazio tira o valor
  await definirValor(m, "Aldric", 10);
  await definirValor(m, "Brisa", 15);
  await definirValor(m, "Cael", 5);
  await definirValor(m, "Ogro", 20);
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Ogro", "Brisa", "Aldric", "Cael"]);
  await definirValor(m, "Brisa", "");
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Ogro", "Aldric", "Cael", "Brisa"]);
  await expect(j1.pagina.getByTestId("ordem-numero-e-tok-jogador-2")).toHaveText("—");
  await definirValor(m, "Brisa", 15);
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Ogro", "Brisa", "Aldric", "Cael"]);

  // rodada: clicar e escrever; Enter confirma, Esc desfaz
  const rodada = m.getByTestId("ordem-rodada-valor");
  await rodada.fill("4");
  await rodada.press("Enter");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 4");
  await rodada.fill("9");
  await rodada.press("Escape");
  await expect(rodada).toHaveValue("4");
  expect(await rodadaDe(j1.pagina)).toBe(4);
  await rodada.fill("0");
  await rodada.press("Enter");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: não começou");

  // o primeiro Próximo abre a rodada 1; dar a volta soma a rodada
  await m.getByTestId("ordem-proximo").click();
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Ogro");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 1");
  for (let i = 0; i < 4; i++) await m.getByTestId("ordem-proximo").click();
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Ogro");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 2");

  // sem Montar, sem "Passar", sem olho e sem alça: a janela ficou simples
  for (const t of [
    "ordem-montar-alternar",
    "ordem-rolar-todos",
    "ordem-adicionar-grupo",
    "ordem-solta",
  ]) {
    await expect(m.getByTestId(t), t).toHaveCount(0);
  }
  await expect(
    m.locator('[data-testid^="ordem-tirar-"], [data-testid^="ordem-oculta-"]'),
  ).toHaveCount(0);

  // Turno anterior volta (e atravessa a rodada)
  await m.getByTestId("ordem-anterior").click();
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Cael");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 1");
  await m.getByTestId("ordem-proximo").click();
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Ogro");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 2");

  // Ordenar põe a lista em ordem pelos números depois de mexer nela
  await m.getByTestId("ordem-ordenar").click();
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Ogro", "Brisa", "Aldric", "Cael"]);

  // Limpar: pede confirmação; cancelar não apaga; confirmar esvazia a lista e zera a rodada; a janela fica
  await m.getByTestId("ordem-encerrar").click();
  await m.getByTestId("ordem-encerrar-nao").click();
  await expect(linha(m, "Ogro")).toBeVisible();
  await m.getByTestId("ordem-encerrar").click();
  await m.getByTestId("ordem-encerrar-sim").click();
  for (const s of [mestre, j1]) {
    await expect(s.pagina.getByTestId("ordem-vazia")).toBeVisible();
    await expect(s.pagina.getByTestId("ordem-rodada")).toHaveAttribute("data-rodada", "0");
    await expect(s.pagina.getByTestId("ordem-de-turno")).toBeVisible();
  }
});

test("reordenar à mão: arrastar a linha inteira e Alt+setas na linha em foco; botão direito: Dar a vez e Tirar da lista", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  await ligarOrdem(m);
  await adicionar(m, ["tok-jogador-1", "tok-jogador-2", "tok-jogador-3", "tok-ogro"]);
  await definirValor(m, "Ogro", 20);
  await definirValor(m, "Brisa", 15);
  await definirValor(m, "Aldric", 10);
  await definirValor(m, "Cael", 5);
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Ogro", "Brisa", "Aldric", "Cael"]);

  // pelo teclado: a linha em foco desce com Alt+↓ e sobe com Alt+↑ (o foco continua nela). Cada passo espera a
  // lista de quem aperta a tecla (a posição vem da lista que a tela mostra), e depois a do jogador.
  await linha(m, "Ogro").focus();
  await m.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => nomesNaOrdem(m)).toEqual(["Brisa", "Ogro", "Aldric", "Cael"]);
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Brisa", "Ogro", "Aldric", "Cael"]);
  await expect(linha(m, "Ogro")).toBeFocused();
  await m.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => nomesNaOrdem(m)).toEqual(["Brisa", "Aldric", "Ogro", "Cael"]);
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Brisa", "Aldric", "Ogro", "Cael"]);
  await m.keyboard.press("Alt+ArrowUp");
  await expect.poll(() => nomesNaOrdem(m)).toEqual(["Brisa", "Ogro", "Aldric", "Cael"]);
  // na ponta não faz nada (nem erro)
  await linha(m, "Brisa").focus();
  await m.keyboard.press("Alt+ArrowUp");
  await expect(linha(m, "Brisa")).toBeFocused();
  await expect.poll(() => nomesNaOrdem(m)).toEqual(["Brisa", "Ogro", "Aldric", "Cael"]);

  // arrastando a linha inteira (sem alça): Cael vai para o topo
  await linha(m, "Cael").dragTo(linha(m, "Brisa"));
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Cael", "Brisa", "Ogro", "Aldric"]);

  // o jogador não arrasta nem move
  await expect(linha(j1.pagina, "Cael")).not.toHaveAttribute("draggable", "true");
  const forcado = await enviarCru(
    j1.pagina,
    intencaoCrua("combate.mover", { id: "e-tok-ogro", indice: 0 }),
  );
  expect(forcado).toMatchObject({ tipo: "erro", dados: { codigo: "sem_permissao" } });

  // botão direito: Dar a vez (abre a rodada 1) e Tirar da lista
  await menuDaLinha(m, "Ogro", "ordem-menu-dar-vez");
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Ogro");
  await expect(j1.pagina.getByTestId("ordem-rodada")).toHaveText("Rodada: 1");
  await menuDaLinha(m, "Cael", "ordem-menu-tirar");
  await expect.poll(() => nomesNaOrdem(j1.pagina)).toEqual(["Brisa", "Ogro", "Aldric"]);
  await expect.poll(() => vezNaOrdem(j1.pagina)).toBe("Ogro");

  // o menu fecha com Esc e o teclado chega nele (tecla de menu na linha em foco)
  await linha(m, "Aldric").focus();
  await m.keyboard.press("ContextMenu");
  await expect(m.getByTestId("ordem-menu")).toBeVisible();
  await expect(m.getByTestId("ordem-menu-dar-vez")).toBeFocused();
  await m.keyboard.press("Escape");
  await expect(m.getByTestId("ordem-menu")).toHaveCount(0);
});

test("sigilo: token na camada do mestre, oculto ou de NPC não aparece para o jogador (frames), nem a entrada que ele ganha ao ir para a camada do mestre", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await ligarOrdem(mestre.pagina);
  await expect(j1.pagina.getByTestId("ordem-de-turno")).toBeVisible();

  // o mestre entra com NPCs, um oculto e um da camada do mestre (a sala rola; as rolagens de NPC são ocultas)
  for (const t of ["tok-ogro", "tok-goblin-oculto", "tok-marcador-mestre"]) {
    await mandar(mestre.pagina, "combate.entrar", { tokenId: t });
  }
  await expect(mestre.pagina.getByTestId("ordem-entrada")).toHaveCount(3);
  await expect(j1.pagina.getByTestId("ordem-entrada")).toHaveCount(1);
  await expect(linha(j1.pagina, "Ogro")).toBeVisible();

  // o jogador entra com o próprio token: a rolagem dele é pública
  await mandar(j1.pagina, "combate.entrar", { tokenId: "tok-jogador-1" });
  await expect(j1.pagina.getByTestId("ordem-entrada")).toHaveCount(2);

  // o token do jogador vai para a camada do mestre: a entrada some para ele e continua para o mestre
  // (o jogador recebe um snapshot, não um evento: `enviarCru` não devolve nada, e tudo bem)
  await enviarCru(
    mestre.pagina,
    intencaoCrua("token.editar", { id: "tok-jogador-1", mudancas: { camada: "mestre" } }),
  );
  await expect(j1.pagina.getByTestId("ordem-entrada")).toHaveCount(1);
  await expect(linha(j1.pagina, "Aldric")).toHaveCount(0);
  await expect(mestre.pagina.getByTestId("ordem-entrada")).toHaveCount(4);

  // recarregar (snapshot novo) também não traz nada disso
  await j1.pagina.reload();
  await expect(j1.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(j1.pagina.getByTestId("ordem-entrada")).toHaveCount(1);

  const quadros = j1.frames.join("\n");
  // o que é do mestre nunca chegou ao jogador (nem o nome nem a rolagem)
  for (const segredo of [
    "Goblin Emboscado",
    "Marcador Secreto",
    "tok-goblin-oculto",
    "tok-marcador-mestre",
  ]) {
    expect(quadros, segredo).not.toContain(segredo);
  }
  expect(quadros).not.toContain("destreza");
  // só a rolagem dele (pública) está no chat do jogador; as dos NPCs foram ocultas
  const rolagens = j1.frames.filter((f) => f.includes('"nome":"Iniciativa"'));
  expect(rolagens.length).toBeGreaterThanOrEqual(1);
  expect(rolagens.every((f) => f.includes('"visivelPara":"todos"'))).toBe(true);
  await abrirAba(j1.pagina, "chat");
  await expect(j1.pagina.locator('[data-testid="chat-mensagem"][data-tipo="modelo"]')).toHaveCount(
    1,
  );
  // o mestre recebeu tudo
  const doMestre = mestre.frames.join("\n");
  expect(doMestre).toContain("Goblin Emboscado");
});
