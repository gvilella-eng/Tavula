import type { Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import { abrirFicha, escolherEspaco, mandar } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// V6: conjurar pergunta o espaço (do nível da magia até o 9º, só os que restam), o dano a mais por nível acima vai
// num bloco colado ao cartão do chat, e o ícone ao lado do Conjurar manda o cartão da magia sem gastar nem rolar.

const MAGO = "pers-mago-v6";

async function criarMago(mestre: Page, espacosTotal: Record<string, number>) {
  await mandar(mestre, "personagem.criar", {
    personagem: {
      id: MAGO,
      pastaId: "pasta-personagens",
      editores: { tipo: "jogadores", ids: ["jogador-1"] },
      nome: "Vessa",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 18 },
      ficha: {
        pvAtual: 20,
        pvMax: 20,
        atributos: { int: 16 },
        habilidadeDeConjuracao: "int",
        espacosTotal,
        magias: [
          {
            nome: "Bola de Fogo",
            nivel: 3,
            escola: "Evocação",
            preparada: true,
            descricao: "Uma explosão de chamas.",
            dano: "8d6",
            tipo: "Fogo",
            salvaguarda: { alvo: "des", cdAtributo: "int", sucesso: "metade" },
            porNivelAcima: "1d6",
          },
          { nome: "Escudo Arcano", nivel: 1, preparada: true, descricao: "Reação: +5 na CA." },
          { nome: "Luz", nivel: 0, preparada: true, descricao: "O objeto emite luz." },
        ],
      },
    },
  });
}

test("conjurar com espaço maior: o menu só traz o que dá para gastar e o chat ganha o bloco colado", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarMago(mestre.pagina, { "3": 0, "4": 4 });
  const p = j1.pagina;
  const janela = await abrirFicha(p, MAGO, "magias");
  await expect(janela.getByTestId("espacos-restantes-3")).toHaveText("0");
  await expect(janela.getByTestId("espacos-restantes-4")).toHaveText("4");

  await janela.getByTestId("magia-conjurar-0").click();
  const menu = p.getByTestId("menu-espaco");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("aria-label", "Conjurar Bola de Fogo com espaço de:");
  await expect(menu.getByRole("menuitem")).toHaveCount(1);
  await expect(menu.getByTestId("menu-espaco-4")).toHaveText("4º · 4 restantes");
  await expect(menu.getByTestId("menu-espaco-4")).toBeFocused();
  await menu.getByTestId("menu-espaco-4").click();

  await expect(janela.getByTestId("espacos-restantes-4")).toHaveText("3");
  await abrirAba(p, "chat");
  const bloco = p.getByTestId("bloco-espaco");
  await expect(bloco).toHaveCount(1);
  await expect(p.getByTestId("bloco-espaco-titulo")).toHaveText("Espaço de 4º · +1d6");
  const total = Number(await p.getByTestId("bloco-espaco-total").locator("strong").textContent());
  const meio = Number(
    (await p.getByTestId("bloco-espaco-metade").textContent())?.replace(/\D/g, ""),
  );
  expect(meio).toBe(Math.floor(total / 2));
  // o cartão principal e o bloco são uma peça só: mesma largura, sem espaço entre eles
  const cartao = await p.getByTestId("modelo-livre").boundingBox();
  const colado = await bloco.boundingBox();
  expect(cartao && colado).toBeTruthy();
  if (cartao && colado) {
    expect(Math.abs(cartao.x - colado.x)).toBeLessThan(1);
    expect(Math.abs(cartao.width - colado.width)).toBeLessThan(1);
    expect(Math.abs(cartao.y + cartao.height - colado.y)).toBeLessThan(2);
  }
  // uma mensagem só
  await expect(p.getByTestId("chat-mensagem").filter({ has: bloco })).toHaveCount(1);
  await expect(p.getByTestId("chat-mensagem").filter({ hasText: "Bola de Fogo" })).toHaveCount(1);
});

test("Esc cancela sem gastar; o teclado escolhe (setas, Enter e o número do nível) e o foco volta ao botão", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarMago(mestre.pagina, { "3": 0, "4": 4, "5": 2 });
  const p = j1.pagina;
  const janela = await abrirFicha(p, MAGO, "magias");
  const botao = janela.getByTestId("magia-conjurar-0");

  await botao.click();
  await expect(p.getByTestId("menu-espaco")).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("menu-espaco")).toHaveCount(0);
  await expect(botao).toBeFocused();
  await expect(janela.getByTestId("espacos-restantes-4")).toHaveText("4");
  await expect(janela.getByTestId("espacos-restantes-5")).toHaveText("2");

  // clicar fora também cancela
  await botao.click();
  await expect(p.getByTestId("menu-espaco")).toBeVisible();
  await janela.getByTestId("espacos-restantes-3").click();
  await expect(p.getByTestId("menu-espaco")).toHaveCount(0);
  await expect(janela.getByTestId("espacos-restantes-4")).toHaveText("4");

  // só pelo teclado: Enter abre, seta para baixo vai ao 5º, Enter escolhe
  await botao.focus();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("menu-espaco-4")).toBeFocused();
  await p.keyboard.press("ArrowDown");
  await expect(p.getByTestId("menu-espaco-5")).toBeFocused();
  await p.keyboard.press("Enter");
  await expect(janela.getByTestId("espacos-restantes-5")).toHaveText("1");
  await expect(janela.getByTestId("espacos-restantes-4")).toHaveText("4");
  await expect(botao).toBeFocused();

  // o número do nível escolhe direto
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("menu-espaco")).toBeVisible();
  await p.keyboard.press("4");
  await expect(janela.getByTestId("espacos-restantes-4")).toHaveText("3");
  await abrirAba(p, "chat");
  await expect(p.getByTestId("bloco-espaco-titulo")).toHaveCount(2);
  await expect(p.getByTestId("bloco-espaco-titulo").first()).toHaveText("Espaço de 5º · +2d6");
  await expect(p.getByTestId("bloco-espaco-titulo").last()).toHaveText("Espaço de 4º · +1d6");
});

test("sem porNivelAcima não há bloco: o cartão diz o espaço; sem espaço nenhum avisa; truque não pergunta", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarMago(mestre.pagina, { "1": 0, "2": 0, "3": 0, "4": 1 });
  const p = j1.pagina;
  const janela = await abrirFicha(p, MAGO, "magias");

  // Escudo Arcano (1º, sem rolagem) sobe para o 4º: o cartão da mensagem diz o espaço
  await janela.getByTestId("magia-conjurar-1").click();
  await escolherEspaco(p, 4);
  await expect(janela.getByTestId("espacos-restantes-4")).toHaveText("0");
  await abrirAba(p, "chat");
  await expect(p.getByTestId("bloco-espaco")).toHaveCount(0);
  await expect(p.getByTestId("caracteristica-chat-nome")).toContainText("Escudo Arcano");
  await expect(p.getByTestId("caracteristica-chat-origem")).toContainText("com espaço de 4º");

  // acabou tudo: aviso padrão, sem menu
  await abrirAba(p, "fichas");
  await janela.getByTestId("magia-conjurar-0").click();
  await expect(p.getByTestId("menu-espaco")).toHaveCount(0);
  await expect(p.getByTestId("aviso")).toContainText(
    "Sem espaços de 3º nível ou maior para Bola de Fogo.",
  );

  // truque: conjura direto, sem menu
  await janela.getByTestId("magia-conjurar-2").click();
  await expect(p.getByTestId("menu-espaco")).toHaveCount(0);
  await abrirAba(p, "chat");
  await expect(
    p.getByTestId("caracteristica-chat-nome").filter({ hasText: "conjura Luz" }),
  ).toHaveCount(1);
});

test("o ícone ao lado do Conjurar manda o cartão ao chat sem gastar espaço nem rolar", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarMago(mestre.pagina, { "3": 2 });
  const p = j1.pagina;
  const janela = await abrirFicha(p, MAGO, "magias");
  const ping = janela.getByTestId("magia-pingar-0");
  await expect(ping).toBeVisible();
  await expect(ping).toHaveAttribute("aria-label", "Mandar Bola de Fogo ao chat");
  await ping.click();
  await expect(janela.getByTestId("espacos-restantes-3")).toHaveText("2");
  await abrirAba(p, "chat");
  await expect(p.getByTestId("caracteristica-chat-nome")).toHaveText("Bola de Fogo");
  await expect(p.getByTestId("caracteristica-chat-origem")).toHaveText("3º nível · Evocação");
  await expect(p.getByTestId("modelo-livre")).toHaveCount(0);
  await expect(p.getByTestId("modelo-ataque")).toHaveCount(0);
});

test("o campo Por nível acima do editor da magia grava e a dica explica", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await criarMago(mestre.pagina, { "3": 2 });
  const janela = await abrirFicha(j1.pagina, MAGO, "magias");
  await janela.getByTestId("magia-editar-0").click();
  const campo = janela.getByTestId("editor-por-nivel-acima");
  await expect(campo).toHaveValue("1d6");
  await expect(janela.getByTestId("editor-ataque")).toContainText(
    "dados a mais por nível de espaço acima do da magia",
  );
  await campo.fill("1d8");
  await campo.blur();
  await janela.getByTestId("editor-voltar").click();
  await janela.getByTestId("magia-conjurar-0").click();
  await escolherEspaco(j1.pagina, 3);
  // no nível da magia não há dado a mais
  await abrirAba(j1.pagina, "chat");
  await expect(j1.pagina.getByTestId("bloco-espaco")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("espaco-usado")).toHaveCount(0);
});
