import type { Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import { abrirFicha } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// V4b: a ficha de NPC no desenho N (docs/desenho/NpcN.dc.html): o bloco de monstro, as ações bem fechadinhas, o editor
// na própria linha, recarga e usos, reações e lendárias só quando existem, e a janela que minimiza.

const OGRO = "pers-ogro";

/** Fichas → duplo clique no NPC: a janela abre direto no bloco (sem abas). */
async function abrirNpc(p: Page, id: string) {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${id}`).dblclick();
  const janela = p.locator(`[data-testid="janela-ficha"][data-personagem-id="${id}"]`);
  await expect(janela.getByTestId("npc-bloco")).toBeVisible();
  return janela;
}

test("o NPC abre no bloco de monstro e o personagem segue na ficha de personagem; a escolha em Configurar troca", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const janela = await abrirNpc(p, OGRO);

  // o Ogro da semente (SRD 5.1): estandarte, CA, PV com a fórmula, atributos, linhas e as duas ações
  await expect(janela.getByTestId("ficha-nome")).toHaveValue("gro");
  await expect(janela.getByTestId("npc-tamanho")).toHaveValue("Grande");
  await expect(janela.getByTestId("npc-tipo")).toHaveValue("Gigante");
  await expect(janela.getByTestId("npc-tendencia")).toHaveValue("Caótico e Mau");
  await expect(janela.getByTestId(`ca-${OGRO}`)).toHaveValue("11");
  await expect(janela.getByTestId(`pv-atual-${OGRO}`)).toHaveValue("59");
  await expect(janela.getByTestId(`pv-max-${OGRO}`)).toHaveValue("59");
  await expect(janela.getByTestId("npc-pv-formula")).toHaveValue("7d10 + 21");
  await expect(janela.getByTestId("npc-deslocamento")).toHaveValue("12");
  await expect(janela.getByTestId("atributo-mod-for")).toContainText("+4");
  await expect(janela.getByTestId("atributo-mod-des")).toContainText("−1");
  await expect(janela.getByTestId("npc-xp")).toContainText("450 XP");
  await expect(janela.getByTestId("percepcao-passiva")).toContainText("Percepção passiva 8");
  await expect(janela.getByTestId("npc-idiomas-campo")).toHaveValue("Comum, Gigante");
  await expect(janela.getByTestId("npc-acao-titulo-0")).toContainText("Clava Grande");
  await expect(janela.getByTestId("npc-acao-acerto-0")).toHaveText("+6");
  await expect(janela.getByTestId("npc-acao-dano-0")).toHaveText("2d8+4");
  await expect(janela.getByTestId("npc-acao-titulo-1")).toContainText("Azagaia");
  await expect(janela.getByTestId("npc-acao-dano-1")).toHaveText("2d6+4");
  // sem Reações nem Lendárias: as seções não existem, só o "+" discreto de quem edita
  await expect(janela.getByTestId("npc-secao-reacao")).toHaveCount(0);
  await expect(janela.getByTestId("npc-secao-lendaria")).toHaveCount(0);
  await expect(janela.getByTestId("npc-nova-reacao")).toBeVisible();
  await expect(janela.getByTestId("npc-nova-lendaria")).toBeVisible();
  // a ficha de personagem não aparece
  await expect(janela.getByTestId("ficha-cabecalho")).toHaveCount(0);
  await expect(janela.getByTestId("ficha-aba-magias")).toHaveCount(0);

  // Configurar → "Ficha de": o Ogro vira ficha de personagem e volta, e a escolha fica na ficha
  await janela.getByTestId("npc-configurar").click();
  await expect(janela.getByTestId("ficha-apresentacao-escolha")).toBeVisible();
  await expect(janela.getByTestId("apresentacao-npc")).toHaveAttribute("aria-pressed", "true");
  await janela.getByTestId("apresentacao-personagem").click();
  await expect(janela.getByTestId("ficha-cabecalho")).toBeVisible();
  await expect(janela.getByTestId("npc-bloco")).toHaveCount(0);
  await janela.getByTestId("ficha-aba-configurar").click();
  await janela.getByTestId("apresentacao-npc").click();
  await expect(janela.getByTestId("ficha-cabecalho")).toHaveCount(0);
  await janela.getByTestId("npc-configurar").click();
  await expect(janela.getByTestId("npc-bloco")).toBeVisible();

  await janela.getByTestId("janela-ficha-fechar").click();
  // o personagem de jogador continua na ficha de personagem
  const aldric = await abrirFicha(p, "pers-aldric", "principal");
  await expect(aldric.getByTestId("ficha-cabecalho")).toBeVisible();
  await expect(aldric.getByTestId("npc-bloco")).toHaveCount(0);

  // um NPC novo ("+ Novo" → NPC) nasce na pasta NPCs, no bloco; um "Novo personagem" nasce na ficha de personagem
  await abrirAba(p, "fichas");
  await p.getByTestId("ficha-novo").click();
  await p.getByTestId("ficha-novo-npc").click();
  const novo = p.getByTestId("janela-ficha").last();
  await expect(novo.getByTestId("editor-item")).toBeVisible();
  await novo.getByTestId("npc-configurar").click();
  await expect(novo.getByTestId("npc-bloco")).toBeVisible();
  await novo.getByTestId("janela-ficha-fechar").click();
  await p.getByTestId("ficha-novo").click();
  await p.getByTestId("ficha-novo-personagem").click();
  const novoPj = p.getByTestId("janela-ficha").last();
  await expect(novoPj.getByTestId("editor-item")).toBeVisible();
  await expect(novoPj.getByTestId("ficha-aba-magias")).toBeVisible();
  await expect(novoPj.getByTestId("npc-bloco")).toHaveCount(0);
});

test("atacar com uma ação (acerto e dano no chat, só o dano), expandir e mandar ao chat", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const janela = await abrirNpc(p, OGRO);

  // o botão de acerto rola acerto e dano no mesmo bloco do chat, como o Ogro: +6 e 2d8+4
  await janela.getByTestId("npc-acao-acerto-0").click();
  await abrirAba(p, "chat");
  const cartao = p.getByTestId("modelo-ataque").filter({ hasText: "Clava Grande" });
  await expect(cartao).toHaveCount(1);
  await cartao.hover(); // os dados e as fórmulas ficam no balão
  await expect(cartao).toContainText(/\+\s?6/);
  // 20 natural dobra os dados (crítico, 1 em 20): 2d8 ou 4d8
  await expect(cartao.getByTestId("modelo-dano-formula")).toContainText(/[24]d8\s?\+\s?4/);
  await expect(p.getByTestId("chat-autor").last()).toHaveText("Ogro");

  // o botão de dano rola só o dano (uma mensagem a mais)
  const antes = await p.getByTestId("chat-mensagem").count();
  await janela.getByTestId("npc-acao-dano-1").click();
  await expect(p.getByTestId("chat-mensagem")).toHaveCount(antes + 1);
  await p.getByTestId("chat-mensagem").last().locator(".rc").hover(); // a fórmula fica no balão
  await expect(p.getByTestId("chat-mensagem").last()).toContainText(/2d6\s?\+\s?4/);
  await expect(p.getByTestId("chat-mensagem").last()).toContainText("Azagaia");

  // o título expande o texto completo; um clique curto não levanta a linha
  const titulo = janela.getByTestId("npc-acao-titulo-0");
  await expect(titulo).toHaveAttribute("aria-expanded", "false");
  await titulo.click();
  await expect(titulo).toHaveAttribute("aria-expanded", "true");
  await expect(janela.getByTestId("npc-acao-texto-0")).toContainText(
    "13 (2d8 + 4) de dano contundente",
  );
  await expect(janela.getByTestId("npc-acao-0")).not.toHaveAttribute("data-levantada", "true");
  await janela.getByTestId("npc-acao-mandar-0").click();
  const carta = p.getByTestId("caracteristica-chat").last();
  await expect(carta.getByTestId("caracteristica-chat-nome")).toHaveText("Clava Grande");
  await expect(carta.getByTestId("caracteristica-chat-origem")).toHaveText("Ação");
  await titulo.click();
  await expect(janela.getByTestId("npc-acao-texto-0")).toHaveCount(0);
});

test("recarga e usos por dia, o editor na própria linha, reações e lendárias só quando existem e o minimizar", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const janela = await abrirNpc(p, OGRO);

  // a engrenagem abre o mesmo editor do personagem, dentro da linha, com as opções do monstro
  await janela.getByTestId("npc-acao-editar-0").click();
  const linha = janela.getByTestId("npc-acao-0");
  await expect(linha.getByTestId("editor-ataque")).toBeVisible();
  await linha.getByTestId("npc-extra-recarga").selectOption("5");
  await linha.getByTestId("npc-extra-usos").fill("3");
  await expect(linha.getByTestId("previa-acerto")).toHaveText("+6 para acertar");
  await linha.getByTestId("editor-voltar").click();
  await expect(linha.getByTestId("editor-ataque")).toHaveCount(0);

  // Recarga 5–6: disponível, gasta ao marcar e o botão rola o d6 no chat
  const recarga = janela.getByTestId("npc-recarga-0");
  await expect(recarga).toBeChecked();
  await expect(linha).toContainText("Recarga 5–6");
  await recarga.uncheck();
  await expect(recarga).not.toBeChecked();
  await janela.getByTestId("npc-recarga-rolar-0").click();
  await abrirAba(p, "chat");
  await expect(p.getByTestId("chat-mensagem").last()).toContainText("Recarga de Clava Grande");
  await recarga.check();
  await expect(recarga).toBeChecked();

  // 3 por dia: três bolinhas; gastar uma deixa duas
  await expect(linha).toContainText("3 por dia");
  await expect(janela.getByTestId("npc-uso-0-2")).toBeVisible();
  await janela.getByTestId("npc-uso-0-0").uncheck();
  await expect(janela.getByTestId("npc-uso-0-0")).not.toBeChecked();
  await expect(janela.getByTestId("npc-uso-0-1")).toBeChecked();
  // a ficha guarda: fechar a janela manda o que sobrou; recarregar a página e abrir de novo mostra o mesmo
  await janela.getByTestId("janela-ficha-fechar").click();
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  const depois = await abrirNpc(p, OGRO);
  await expect(depois.getByTestId("npc-uso-0-0")).not.toBeChecked();
  await expect(depois.getByTestId("npc-uso-0-1")).toBeChecked();

  // "+ Reação" cria a seção; a seção só existe enquanto há reação
  await depois.getByTestId("npc-nova-reacao").click();
  await depois.getByTestId("editor-nome").fill("Aparar");
  await depois.getByTestId("editor-voltar").click();
  await expect(depois.getByTestId("npc-secao-reacao")).toBeVisible();
  await expect(depois.getByTestId("npc-titulo-reacao")).toHaveText("Reações");
  await expect(depois.getByTestId("npc-secao-reacao")).toContainText("Aparar");
  const novas = depois.getByTestId("npc-novas-categorias");
  await expect(novas.getByTestId("npc-nova-reacao")).toHaveCount(0);
  await expect(novas.getByTestId("npc-nova-lendaria")).toBeVisible();
  await novas.getByTestId("npc-nova-lendaria").click();
  await depois.getByTestId("editor-voltar").click();
  await expect(depois.getByTestId("npc-titulo-lendaria")).toHaveText("Ações lendárias");
  // uma ação sem jogada tem o botão "Mandar ao chat" no lugar de acerto e dano
  await expect(
    depois.getByTestId("npc-secao-lendaria").getByTestId("npc-acao-chat-3"),
  ).toBeVisible();

  // minimizar: só o nome, numa janela estreita; duplo clique restaura
  const caixa = p.getByTestId(`janela-ficha:${OGRO}`);
  const cheia = (await caixa.boundingBox()) as { width: number; height: number };
  await depois.getByTestId("janela-ficha-cabecalho").dblclick({ position: { x: 150, y: 12 } });
  await expect(caixa).toHaveAttribute("data-minimizada", "true");
  await expect(depois.getByTestId("janela-ficha-nome")).toHaveText("Ogro");
  await expect(depois.getByTestId("npc-bloco")).toBeHidden();
  const pequena = (await caixa.boundingBox()) as { width: number; height: number };
  expect(pequena.height).toBeLessThan(60);
  expect(pequena.width).toBeLessThan(cheia.width / 2);
  await depois.getByTestId("janela-ficha-cabecalho").dblclick();
  await expect(caixa).toHaveAttribute("data-minimizada", "false");
  await expect(depois.getByTestId("npc-bloco")).toBeVisible();
});
