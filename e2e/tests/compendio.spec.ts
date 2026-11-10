import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, intencaoCrua, type Mesa, test } from "./ajudas";
import { assets, esperarPronto } from "./ajudasAssets";
import { abrirFicha } from "./ajudasFicha";

// Lote 14: compêndio de magias. O `compendio/magias.json` fica na pasta local do mestre (nos testes, a
// `Memoria` do modo e2e); a sala só conhece a meta (hash) e os pedaços passam como os das imagens.

const TEXTO_DO_SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);
const CAMINHO = "compendio/magias.json";
/** Trechos que só existem no texto das magias: se aparecerem num frame de texto, o compêndio vazou. */
const TRECHOS_DO_TEXTO = ["8d6", "dardos brilhantes", "Bola de Fogo"];

/** O mestre "põe o arquivo na pasta": a aba o lê e registra sozinha (e o botão Recarregar relê). */
async function porNaPasta(pagina: Page, texto: string) {
  await assets(pagina, "adicionarNaPasta", CAMINHO, texto);
}

async function itens(pagina: Page): Promise<string[]> {
  return pagina
    .getByTestId("compendio-item")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-nome") ?? ""));
}

async function buscar(pagina: Page, texto: string) {
  await pagina.getByTestId("compendio-busca").fill(texto);
}

/** O mestre põe o exemplo do SRD na pasta e o jogador abre a aba do compêndio já com ele pronto. */
async function mesaComCompendio(mesa: Mesa) {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  await porNaPasta(mestre.pagina, TEXTO_DO_SRD);
  await abrirAba(mestre.pagina, "compendio");
  await expect(mestre.pagina.getByTestId("compendio-lista")).toBeVisible();
  await abrirAba(j1.pagina, "compendio");
  await expect(j1.pagina.getByTestId("compendio-lista")).toBeVisible();
  return { mestre, j1 };
}

test("sem compêndio: o mestre vê como montar o JSON e o jogador vê o aviso", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  await abrirAba(mestre.pagina, "compendio");
  await expect(mestre.pagina.getByTestId("compendio-como-montar")).toBeVisible();
  await expect(mestre.pagina.getByTestId("compendio-exemplo")).toContainText("tabletop-compendio");
  await expect(mestre.pagina.getByTestId("compendio-recarregar")).toBeVisible();
  await expect(mestre.pagina.getByTestId("compendio-sem-arquivo")).toBeVisible();
  await abrirAba(j1.pagina, "compendio");
  await expect(j1.pagina.getByTestId("compendio-vazio-jogador")).toBeVisible();
  await expect(j1.pagina.getByTestId("compendio-como-montar")).toHaveCount(0);
});

test("o mestre aponta a pasta; o jogador busca 'bola' e 'misseis' (sem acento) e acha; o texto só passa pelos pedaços", async ({
  mesa,
}) => {
  const { mestre, j1 } = await mesaComCompendio(mesa);

  // o mestre vê as 3 magias, os créditos e o botão Recarregar
  await expect(mestre.pagina.getByTestId("compendio-contagem")).toHaveText("3 magias");
  await expect(mestre.pagina.getByTestId("compendio-creditos")).toContainText("CC-BY-4.0");
  await expect(mestre.pagina.getByTestId("compendio-recarregar")).toBeVisible();
  // o jogador não tem o Recarregar
  await expect(j1.pagina.getByTestId("compendio-recarregar")).toHaveCount(0);

  await buscar(j1.pagina, "bola");
  expect(await itens(j1.pagina)).toEqual(["Bola de Fogo"]);
  await buscar(j1.pagina, "misseis");
  expect(await itens(j1.pagina)).toEqual(["Mísseis Mágicos"]);
  await buscar(j1.pagina, "MÍSSEIS");
  expect(await itens(j1.pagina)).toEqual(["Mísseis Mágicos"]);
  await buscar(j1.pagina, "fireball");
  expect(await itens(j1.pagina)).toEqual(["Bola de Fogo"]);
  await buscar(j1.pagina, "nada disso");
  await expect(j1.pagina.getByTestId("compendio-nenhuma")).toBeVisible();

  // o arquivo chegou inteiro ao jogador (o hash do cache bate)
  const meta = (await assets(mestre.pagina, "metas")).find((m) => m.tipo === "compendio");
  expect(meta).toBeDefined();
  const hash = meta?.hash ?? "";
  await esperarPronto(j1.pagina, hash);
  const cache = await assets(j1.pagina, "verificarCache");
  expect(cache.find((c) => c.hash === hash)?.ok).toBe(true);

  // nenhum frame de TEXTO (nem do mestre para a sala, nem da sala para o jogador) leva o texto do
  // compêndio: só os pedaços binários do asset, e a meta não carrega conteúdo.
  for (const lista of [mestre.enviados, mestre.frames, j1.enviados, j1.frames]) {
    const tudo = lista.join("\n");
    for (const trecho of TRECHOS_DO_TEXTO) expect(tudo).not.toContain(trecho);
  }
  const metaFrame = mestre.enviados.find((f) => f.includes('"tipo":"compendio"'));
  expect(metaFrame).toBeDefined();
  expect(metaFrame).not.toContain("descricao");
  expect(mestre.enviados.some((f) => f.includes('"tipo":"compendio.definir"'))).toBe(true);
  // ...mas o texto viaja nos pedaços binários que o mestre serviu (a prova de que a checagem acima vale)
  expect(mestre.enviadosBinarios.length).toBeGreaterThan(0);
  expect(Buffer.concat(mestre.enviadosBinarios).toString("utf8")).toContain("8d6");
});

test("filtros de nível, escola, classe, concentração e ritual", async ({ mesa }) => {
  const { j1 } = await mesaComCompendio(mesa);
  const p = j1.pagina;
  expect(await itens(p)).toEqual(["Bola de Fogo", "Detectar Magia", "Mísseis Mágicos"]);

  await p.getByTestId("compendio-nivel").selectOption("1");
  expect(await itens(p)).toEqual(["Detectar Magia", "Mísseis Mágicos"]);
  await expect(p.getByTestId("compendio-contagem")).toHaveText("2 de 3 magias");
  await p.getByTestId("compendio-nivel").selectOption("3");
  expect(await itens(p)).toEqual(["Bola de Fogo"]);
  await p.getByTestId("compendio-nivel").selectOption("0");
  await expect(p.getByTestId("compendio-nenhuma")).toBeVisible();

  await p.getByTestId("compendio-limpar").click();
  await expect(p.getByTestId("compendio-contagem")).toHaveText("3 magias");
  await p.getByTestId("compendio-concentracao").check();
  expect(await itens(p)).toEqual(["Detectar Magia"]);
  await p.getByTestId("compendio-concentracao").uncheck();
  await p.getByTestId("compendio-ritual").check();
  expect(await itens(p)).toEqual(["Detectar Magia"]);
  await p.getByTestId("compendio-ritual").uncheck();

  await p.getByTestId("compendio-escola").selectOption("Adivinhação");
  expect(await itens(p)).toEqual(["Detectar Magia"]);
  await p.getByTestId("compendio-escola").selectOption("");
  await p.getByTestId("compendio-classe").selectOption("Bardo");
  expect(await itens(p)).toEqual(["Detectar Magia"]);
  await p.getByTestId("compendio-classe").selectOption("Mago");
  expect(await itens(p)).toHaveLength(3);

  // os filtros combinam com a busca
  await p.getByTestId("compendio-nivel").selectOption("1");
  await buscar(p, "misseis");
  expect(await itens(p)).toEqual(["Mísseis Mágicos"]);
});

test("o cartão da magia mostra todos os campos e a descrição completa", async ({ mesa }) => {
  const { j1 } = await mesaComCompendio(mesa);
  const p = j1.pagina;
  await buscar(p, "bola");
  await p.getByTestId("compendio-item").click();
  const cartao = p.getByTestId("compendio-cartao");
  await expect(cartao.getByTestId("compendio-cartao-nome")).toHaveText("Bola de Fogo");
  await expect(cartao).toContainText("Fireball");
  await expect(cartao).toContainText("3º nível · Evocação");
  await expect(cartao).toContainText("1 ação");
  await expect(cartao).toContainText("45 metros (150 pés)");
  await expect(cartao).toContainText("V, S, M");
  await expect(cartao).toContainText("Instantânea");
  await expect(cartao).toContainText("Feiticeiro, Mago");
  await expect(cartao.getByTestId("magia-texto")).toContainText("8d6 de dano de fogo");
  await expect(cartao.getByTestId("magia-niveis-superiores")).toContainText("1d6");
  await expect(cartao.getByTestId("marca-ritual")).toHaveCount(0);
  await p.getByTestId("compendio-voltar").click();
  // a busca continua onde estava
  await expect(p.getByTestId("compendio-busca")).toHaveValue("bola");
  await buscar(p, "detectar");
  await p.getByTestId("compendio-item").click();
  await expect(p.getByTestId("marca-concentracao")).toBeVisible();
  await expect(p.getByTestId("marca-ritual")).toBeVisible();
});

test("o jogador manda a magia para o chat como o personagem dele e o mestre vê o cartão recolhido", async ({
  mesa,
}) => {
  const { mestre, j1 } = await mesaComCompendio(mesa);
  const j2 = await mesa.entrar("jogador-2");
  const p = j1.pagina;
  await buscar(p, "bola");
  await p.getByTestId("compendio-item").click();
  await p.getByTestId("compendio-como").selectOption({ label: "Aldric" });
  await p.getByTestId("compendio-chat").click();
  await expect(p.getByTestId("compendio-aviso-acao")).toContainText("Enviada ao chat");

  // o mestre (e outro jogador) leem a mensagem pública
  for (const alvo of [mestre.pagina, j2.pagina]) {
    await abrirAba(alvo, "chat");
    const msg = alvo.locator('[data-testid="chat-mensagem"][data-tipo="magia"]');
    await expect(msg).toHaveCount(1);
    await expect(msg.getByTestId("chat-autor")).toHaveText("Aldric");
    await expect(msg.getByTestId("magia-chat-nome")).toHaveText("Bola de Fogo");
    await expect(msg).toContainText("3º nível · Evocação");
    await expect(msg.getByTestId("magia-chat-descricao")).toHaveCount(0); // recolhida
    await msg.getByTestId("magia-chat-alternar").click();
    await expect(msg.getByTestId("magia-chat-descricao")).toContainText("8d6 de dano de fogo");
    await msg.getByTestId("magia-chat-alternar").click();
    await expect(msg.getByTestId("magia-chat-descricao")).toHaveCount(0);
  }
  // a escolha de "Como" é a mesma do chat
  await abrirAba(p, "chat");
  await expect(p.getByTestId("chat-como")).toHaveValue("pers-aldric");
});

test("'Como:' só de personagem que eu edito; compêndio e arquivo são do mestre; o limite do chat vale", async ({
  mesa,
}) => {
  const { mestre, j1 } = await mesaComCompendio(mesa);
  const magia = JSON.parse(TEXTO_DO_SRD).magias[0];
  const erro = async (p: Page, tipo: string, dados: object) =>
    (await enviarCru(p, intencaoCrua(tipo, dados)))?.dados.codigo;
  expect(await erro(j1.pagina, "chat.magia", { magia, como: "pers-ogro" })).toBe(
    "personagem_inexistente",
  );
  expect(await erro(j1.pagina, "chat.magia", { magia, como: "pers-brisa" })).toBe(
    "personagem_inexistente",
  );
  // o mestre pode falar como qualquer personagem
  const ok = await enviarCru(
    mestre.pagina,
    intencaoCrua("chat.magia", { magia, como: "pers-ogro" }),
  );
  expect(ok?.tipo).toBe("evento");

  // só o mestre define o compêndio e registra o asset
  const hash = (await assets(mestre.pagina, "metas")).find((m) => m.tipo === "compendio")?.hash;
  expect(
    await erro(j1.pagina, "compendio.definir", {
      compendio: { hash, nomeOriginal: "magias.json", magias: 3 },
    }),
  ).toBe("sem_permissao");
  expect(await erro(j1.pagina, "compendio.definir", { compendio: null })).toBe("sem_permissao");
  expect(
    await erro(j1.pagina, "asset.registrar", {
      metas: [
        {
          hash: "a".repeat(64),
          tipo: "compendio",
          mime: "application/json",
          bytes: 10,
          largura: 1,
          altura: 1,
          nomeOriginal: "magias.json",
          pedacos: ["b".repeat(64)],
        },
      ],
    }),
  ).toBe("sem_permissao");
  // magia fora dos limites não passa no schema (a sala responde mensagem_invalida)
  expect(
    await erro(j1.pagina, "chat.magia", { magia: { ...magia, descricao: "x".repeat(13_000) } }),
  ).toBe("mensagem_invalida");

  // o limite de mensagens por segundo do Lote 8 vale para a magia também (15 numa rajada: 5 recusadas)
  const resultado = await j1.pagina.evaluate(
    ([m]) =>
      new Promise<{ erros: string[] }>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/ws`);
        const erros: string[] = [];
        ws.onopen = () => {
          for (let i = 0; i < 15; i++) {
            ws.send(JSON.stringify({ v: 1, id: `r${i}`, tipo: "chat.magia", dados: { magia: m } }));
          }
          setTimeout(() => {
            ws.close();
            resolve({ erros });
          }, 1500);
        };
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data as string);
          if (msg.tipo === "erro") erros.push(msg.dados.codigo);
        };
      }),
    [magia],
  );
  expect(resultado.erros.filter((c) => c === "muitas_mensagens")).toHaveLength(5);
});

test("o jogador adiciona a magia à ficha do personagem dele; adicionar de novo avisa e não duplica", async ({
  mesa,
}) => {
  const { j1 } = await mesaComCompendio(mesa);
  const p = j1.pagina;
  await buscar(p, "detectar");
  await p.getByTestId("compendio-item").click();
  // o jogador só escolhe entre os personagens que ele edita
  const opcoes = await p.getByTestId("compendio-personagem").locator("option").allInnerTexts();
  expect(opcoes).toEqual(["Aldric"]);
  await p.getByTestId("compendio-personagem").selectOption("pers-aldric");
  await p.getByTestId("compendio-ficha").click();
  await expect(p.getByTestId("compendio-aviso-acao")).toContainText(
    "Detectar Magia entrou na ficha de Aldric",
  );

  const janela = await abrirFicha(p, "pers-aldric", "magias");
  await expect(janela.getByTestId("magias-nivel-1")).toBeVisible();
  await expect(janela.getByTestId("magia-nome-0")).toHaveValue("Detectar Magia");
  await expect(janela.getByTestId("magia-escola-0")).toHaveValue("Adivinhação");
  await janela.getByTestId("magia-detalhes-0").click();
  const descricao = janela.getByTestId("magia-descricao-0");
  await expect(descricao).toHaveValue(/Tempo de conjuração: 1 ação/);
  await expect(descricao).toHaveValue(/Alcance: Pessoal/);
  await expect(descricao).toHaveValue(/Concentração · Ritual/);
  await expect(descricao).toHaveValue(/sente a presença de magia/);
  await janela.getByTestId("janela-ficha-fechar").click();

  // de novo: avisa e não duplica
  await abrirAba(p, "compendio");
  await p.getByTestId("compendio-ficha").click();
  await expect(p.getByTestId("compendio-aviso-acao")).toContainText(
    "Aldric já tem Detectar Magia na lista de magias",
  );
  const janela2 = await abrirFicha(p, "pers-aldric", "magias");
  await expect(janela2.getByTestId("magia-nome-1")).toHaveCount(0);
  await expect(janela2.getByTestId("magias-nivel-1")).toContainText("(1)");
});

test("JSON inválido mostra o erro ao mestre com o campo e nada é distribuído; corrigido e recarregado, vai", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const invalido = JSON.parse(TEXTO_DO_SRD);
  invalido.magias[1].nivel = 12;
  await porNaPasta(mestre.pagina, JSON.stringify(invalido));
  await abrirAba(mestre.pagina, "compendio");
  await expect(mestre.pagina.getByTestId("compendio-erro")).toBeVisible();
  await expect(mestre.pagina.getByTestId("compendio-erro-motivo")).toContainText(
    "magia 2, campo nivel",
  );
  // continua mostrando como montar
  await expect(mestre.pagina.getByTestId("compendio-exemplo")).toBeVisible();
  // nada foi distribuído: nem registro, nem definição, nem compêndio para o jogador
  await mestre.pagina.waitForTimeout(500);
  expect(mestre.enviados.some((f) => f.includes('"tipo":"asset.registrar"'))).toBe(false);
  expect(mestre.enviados.some((f) => f.includes('"tipo":"compendio.definir"'))).toBe(false);
  expect(mestre.enviadosBinarios).toHaveLength(0);
  await abrirAba(j1.pagina, "compendio");
  await expect(j1.pagina.getByTestId("compendio-vazio-jogador")).toBeVisible();
  expect(await assets(mestre.pagina, "metas")).toHaveLength(0);

  // JSON quebrado também
  await porNaPasta(mestre.pagina, "{ não é json");
  await mestre.pagina.getByTestId("compendio-recarregar").click();
  await expect(mestre.pagina.getByTestId("compendio-erro-motivo")).toContainText("JSON válido");

  // corrigido: o botão Recarregar relê e distribui
  await porNaPasta(mestre.pagina, TEXTO_DO_SRD);
  await mestre.pagina.getByTestId("compendio-recarregar").click();
  await expect(mestre.pagina.getByTestId("compendio-lista")).toBeVisible();
  await expect(mestre.pagina.getByTestId("compendio-erro")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("compendio-lista")).toBeVisible();
});

test("trocar o arquivo e recarregar atualiza a mesa; o arquivo antigo deixa de ser baixável por jogadores", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  await porNaPasta(mestre.pagina, TEXTO_DO_SRD);
  await abrirAba(mestre.pagina, "compendio");
  await expect(mestre.pagina.getByTestId("compendio-lista")).toBeVisible();
  const primeiro = (await assets(mestre.pagina, "metas")).find((m) => m.tipo === "compendio");
  await abrirAba(j1.pagina, "compendio");
  await expect(j1.pagina.getByTestId("compendio-lista")).toBeVisible();

  // um arquivo novo, só com uma magia
  const novo = JSON.parse(TEXTO_DO_SRD);
  novo.magias = [novo.magias[2]];
  await porNaPasta(mestre.pagina, JSON.stringify(novo));
  await mestre.pagina.getByTestId("compendio-recarregar").click();
  await expect(mestre.pagina.getByTestId("compendio-contagem")).toHaveText("1 magia");
  await expect(j1.pagina.getByTestId("compendio-contagem")).toHaveText("1 magia");
  const todos = (await assets(mestre.pagina, "metas")).filter((m) => m.tipo === "compendio");
  expect(todos).toHaveLength(2);

  // o antigo (que não é mais o da mesa) segue a regra normal: o jogador não o pede
  const pedir = (hash: string) => enviarCru(j1.pagina, intencaoCrua("asset.pedir", { hash }));
  const antigo = await pedir(primeiro?.hash ?? "");
  expect(antigo?.dados.codigo).toBe("asset_inexistente");
  const atual = todos.find((m) => m.hash !== primeiro?.hash);
  expect((await pedir(atual?.hash ?? ""))?.tipo).not.toBe("erro");
});

test("o compêndio da mesa persiste: quem entra depois (e quem recarrega a página) já o recebe", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  await porNaPasta(mestre.pagina, TEXTO_DO_SRD);
  await abrirAba(mestre.pagina, "compendio");
  await expect(mestre.pagina.getByTestId("compendio-lista")).toBeVisible();

  const j3 = await mesa.entrar("jogador-3");
  await abrirAba(j3.pagina, "compendio");
  await expect(j3.pagina.getByTestId("compendio-lista")).toBeVisible();
  expect(await itens(j3.pagina)).toHaveLength(3);

  // recarregar a página: o arquivo já está no cache local, sem baixar de novo
  const antes = j3.binarios.length;
  await j3.pagina.reload();
  await expect(j3.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await abrirAba(j3.pagina, "compendio");
  await expect(j3.pagina.getByTestId("compendio-lista")).toBeVisible();
  expect(j3.binarios.length).toBe(antes);
});
