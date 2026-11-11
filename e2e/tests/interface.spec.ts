import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirFaixa,
  enviarCru,
  escolherCamada,
  esperarMapa,
  expect,
  intencaoCrua,
  menuDaCena,
  test,
} from "./ajudas";
import { arquivoPng, definirMapa, pngDeRuido } from "./ajudasAssets";
import { entrarNoMapa, type GanchoDoMapa, selecionarToken, tokensDe } from "./ajudasMapa";

// Lote 4b: a interface v2 (menus, barras, faixa de cenas, ordem de turno). O que ainda não tem lote
// (pincel, dados, chat, compêndio, eventos, iluminação) só aparece como interface.

const gancho = <K extends keyof GanchoDoMapa>(p: Page, metodo: K, ...args: unknown[]) =>
  p.evaluate(
    ([m, a]) =>
      (
        window as unknown as { __tabletop: Record<string, (...x: unknown[]) => unknown> }
      ).__tabletop[m as string]?.(...(a as unknown[])),
    [metodo, args] as const,
  );

test("a ordem de turno liga e desliga para todos, inclusive o mestre; só o mestre muda; entra na exportação", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  const todos = [mestre, j1, j2];

  // o jogador não tem o menu do mestre nem o painel
  await expect(j1.pagina.getByTestId("menu-superior")).toHaveCount(0);
  for (const s of todos) await expect(s.pagina.getByTestId("ordem-de-turno")).toHaveCount(0);
  await expect(mestre.pagina.getByTestId("menu-ordem-turno")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  const antes = mestre.enviados.length;
  await mestre.pagina.getByTestId("menu-ordem-turno").click();
  for (const s of todos) await expect(s.pagina.getByTestId("ordem-de-turno")).toBeVisible();
  await expect(mestre.pagina.getByTestId("menu-ordem-turno")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // uma única mensagem do mestre
  await mestre.pagina.waitForTimeout(300);
  const enviadas = mestre.enviados.slice(antes);
  expect(enviadas).toHaveLength(1);
  expect(JSON.parse(enviadas[0] ?? "{}")).toMatchObject({
    tipo: "ordemDeTurno.definir",
    dados: { visivel: true },
  });

  // o estado fica na sala: o refresh do jogador mantém o painel; ele chega por evento, não por snapshot
  await j2.pagina.reload();
  await expect(j2.pagina.getByTestId("ordem-de-turno")).toBeVisible();

  // o jogador não liga nem desliga (nem forçando por fora)
  const forcado = await enviarCru(
    j1.pagina,
    intencaoCrua("ordemDeTurno.definir", { visivel: false }),
  );
  expect(forcado?.dados.codigo).toBe("sem_permissao");
  await expect(j1.pagina.getByTestId("ordem-de-turno")).toBeVisible();

  // entra na exportação
  await abrirAba(mestre.pagina, "mesa");
  const [download] = await Promise.all([
    mestre.pagina.waitForEvent("download"),
    mestre.pagina.getByTestId("exportar").click(),
  ]);
  const json = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(json.versao).toBe(12);
  expect(json.dados.ordemDeTurnoVisivel).toBe(true);
  expect(json.dados.pastas.map((p: { id: string }) => p.id)).toEqual([
    "pasta-personagens",
    "pasta-npcs",
  ]);

  // desliga: some para todos
  await mestre.pagina.getByTestId("menu-ordem-turno").click();
  for (const s of todos) await expect(s.pagina.getByTestId("ordem-de-turno")).toHaveCount(0);
});

test("menu superior, camadas, dados rápidos e pincel (interface; o que não tem lote só mostra 'em breve')", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;

  // a etiqueta sobre o mapa saiu; o selo de conexão só aparece quando não está conectado
  await expect(p.getByText("Vendo:")).toHaveCount(0);
  await expect(p.getByText("Grupo em:")).toHaveCount(0);
  await expect(p.locator(".etiqueta")).toHaveCount(0);
  await expect(p.locator(".selo-conexao")).toHaveCount(0);

  // menu do mestre: horizontal, dentro do topo fixo (R2: deixou de ficar centralizado sobre o mapa)
  const menu = await p.getByTestId("menu-superior").boundingBox();
  const topo = await p.getByTestId("topo").boundingBox();
  expect(menu && topo && menu.x >= topo.x && menu.x + menu.width <= topo.x + topo.width).toBe(true);
  expect(menu && topo && menu.y >= topo.y && menu.y + menu.height <= topo.y + topo.height).toBe(
    true,
  );
  expect(menu && menu.width > menu.height * 4).toBe(true);
  for (const id of [
    "menu-cenas",
    "menu-camadas",
    "menu-visao-noturna",
    "novo-token",
    "menu-iluminacao",
    "menu-ordem-turno",
    "menu-ver-como",
  ]) {
    await expect(p.getByTestId(id)).toBeVisible();
    await expect(p.getByTestId(id)).toHaveAttribute("aria-label", /.+/);
  }

  // camadas: 4 (mapa, tokens, mestre, desenho); "Limpar desenhos" desabilitado
  await p.getByTestId("menu-camadas").click();
  for (const c of ["mapa", "tokens", "mestre", "desenho"]) {
    await expect(p.getByTestId(`camada-${c}`)).toBeVisible();
  }
  await expect(p.getByTestId("camada-tokens")).toHaveAttribute("aria-pressed", "true");
  await expect(p.getByTestId("limpar-desenhos")).toBeDisabled();
  await p.getByTestId("camada-desenho").click();
  await expect(p.getByTestId("popover-camadas")).toHaveCount(0);
  // na camada de desenho nenhum token é selecionável
  const aldric = (await tokensDe(p)).find((t) => t.id === "tok-jogador-1");
  const alvo = await p.evaluate(
    ([x, y]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.centrarEm(x as number, y as number);
      return h.paraTela(x as number, y as number);
    },
    [aldric?.x, aldric?.y],
  );
  await p.mouse.click(alvo.x, alvo.y);
  await expect(p.getByTestId("painel-token")).toHaveCount(0);
  expect((await tokensDe(p)).find((t) => t.id === "tok-jogador-1")?.selecionado).toBe(false);
  await escolherCamada(p, "tokens");
  await p.mouse.click(alvo.x, alvo.y);
  // selecionar só seleciona: o painel do token abre por "Editar token…" ou por dois cliques (R5a)
  await expect
    .poll(async () => (await tokensDe(p)).find((t) => t.id === "tok-jogador-1")?.selecionado)
    .toBe(true);
  await expect(p.getByTestId("painel-token")).toHaveCount(0);
  await p.mouse.dblclick(alvo.x, alvo.y);
  await expect(p.getByTestId("painel-token")).toBeVisible();
  // o seletor de camada saiu da barra da esquerda
  await expect(p.getByTestId("barra-ferramentas").getByTestId("camada-tokens")).toHaveCount(0);

  // visão noturna: ligada por padrão desde o Lote 5 (antes era um botão sem efeito); liga e desliga
  await expect(p.getByTestId("menu-visao-noturna")).toHaveAttribute("aria-pressed", "true");
  await p.getByTestId("menu-visao-noturna").click();
  await expect(p.getByTestId("menu-visao-noturna")).toHaveAttribute("aria-pressed", "false");
  await p.getByTestId("menu-visao-noturna").click();
  await expect(p.getByTestId("menu-visao-noturna")).toHaveAttribute("aria-pressed", "true");
  // "Eventos" saiu até o 7b (R4); iluminação (lanterna): uma lista logo abaixo do ícone, no Lote 5
  await expect(p.getByTestId("menu-eventos")).toHaveCount(0);
  await p.getByTestId("menu-iluminacao").click();
  await expect(p.getByTestId("lanterna")).toBeVisible();
  await expect(p.getByTestId("lanterna-iluminacao")).toHaveAttribute("aria-checked", "true");
  await expect(p.getByTestId("lanterna-paredes")).toHaveCount(0); // paredes é ferramenta da barra (R4)
  await expect(p.getByTestId("lanterna-modelos")).toBeEnabled(); // R4: atalho para a aba Mesa
  await expect(p.getByTestId("lanterna-fontes")).toBeEnabled(); // Lote 6: painel de fontes de luz
  await expect(p.getByTestId("lanterna-config")).toBeEnabled(); // Lote 6: configurações de iluminação
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("lanterna")).toHaveCount(0);

  // a barra da esquerda (todos): selecionar, mão, régua, dados e pincel
  for (const s of [mestre, j1]) {
    const barra = s.pagina.getByTestId("barra-ferramentas");
    for (const f of ["selecionar", "mao", "regua", "dados", "pincel"]) {
      await expect(barra.getByTestId(`ferramenta-${f}`)).toBeVisible();
    }
  }

  // dados rápidos: 7 dados nas linhas e as quantidades 2 a 6 nas colunas; o jogador também usa
  for (const s of [mestre, j1]) {
    const q = s.pagina;
    await q.getByTestId("ferramenta-dados").click();
    await expect(q.getByTestId("dados-rapidos").locator("tbody tr")).toHaveCount(7);
    for (const nome of ["D4", "D6", "D8", "D10", "D12", "D20", "D100"]) {
      await expect(q.getByTestId(`dado-${nome}`)).toContainText(nome);
      await expect(q.locator(`[data-testid^="dado-${nome}-"]`)).toHaveCount(5);
    }
    await expect(q.getByTestId("dados-rapidos")).not.toContainText("Em breve");
    await q.getByTestId("dado-D20-3").click();
    await expect(q.getByTestId("dados-rapidos")).toHaveCount(0);
    await q.getByTestId("ferramenta-dados").click();
    await q.getByTestId("dado-D6").click();
  }
  // agora a rolagem é de verdade: vai para a sala (só a notação) e volta no chat de todos
  const rolagens = mestre.enviados.filter((f) => f.includes(`"tipo":"dado.rolar"`));
  expect(rolagens.length).toBe(2);
  expect(rolagens[0]).toContain('"expressao":"3d20"');
  await expect(p.getByTestId("chat-mensagem")).toHaveCount(4);

  // pincel (Lote 13): sub-barra com fechar, voltar (desfazer), selecionar, formas, 8 cores e borracha
  await p.getByTestId("ferramenta-pincel").click();
  const sub = p.getByTestId("sub-barra-pincel");
  await expect(sub).toBeVisible();
  // R2: a barra de 52 px continua à vista; a sub-barra abre ao lado dela, sobre o mapa
  await expect(p.getByTestId("barra-ferramentas")).toBeVisible();
  const barraFixa = await p.getByTestId("barra-esquerda").boundingBox();
  const subBox = await sub.boundingBox();
  expect(barraFixa && subBox && subBox.x >= barraFixa.x + barraFixa.width - 1).toBe(true);
  for (const id of [
    "pincel-fechar",
    "pincel-desfazer",
    "pincel-selecionar",
    "pincel-forma-livre",
    "pincel-forma-linha",
    "pincel-forma-retangulo",
    "pincel-forma-circulo",
    "pincel-borracha",
  ]) {
    await expect(sub.getByTestId(id)).toBeVisible();
  }
  await expect(
    sub.locator('[data-testid^="pincel-cor-"]:not([data-testid="pincel-cor-livre"])'),
  ).toHaveCount(8);
  await expect(sub.getByTestId("pincel-cor-livre")).toBeAttached();
  await sub.getByTestId("pincel-forma-retangulo").click();
  await expect(sub.getByTestId("pincel-forma-retangulo")).toHaveAttribute("aria-pressed", "true");
  await sub.getByTestId("pincel-fechar").click();
  await expect(p.getByTestId("barra-ferramentas")).toBeVisible();
});

test("barra da direita: Chat, Fichas, Notas, Compêndio, Mesa e Preferências (largura fixa, sem texto cortado)", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const requisicoes: string[] = [];
  mestre.pagina.on("request", (r) => requisicoes.push(r.url()));

  const abas = async (p: Page) =>
    (await p.getByRole("tab").all()).length === 0
      ? []
      : await Promise.all(
          (await p.getByRole("tab").all()).map((a) => a.getAttribute("data-testid")),
        );
  expect(await abas(mestre.pagina)).toEqual([
    "aba-chat",
    "aba-fichas",
    "aba-notas",
    "aba-compendio",
    "aba-mesa",
    "aba-preferencias",
  ]);
  expect(await abas(j1.pagina)).toEqual([
    "aba-chat",
    "aba-fichas",
    "aba-notas",
    "aba-compendio",
    "aba-preferencias",
  ]);
  // não há mais as abas antigas
  for (const velha of [
    "jogadores",
    "personagens",
    "cenas",
    "biblioteca",
    "configuracoes",
    "mestre",
  ]) {
    await expect(mestre.pagina.getByTestId(`aba-${velha}`)).toHaveCount(0);
  }

  // a barra abre no Chat: presença de todos (cor e estado), lista vazia, caixa desabilitada
  const p = mestre.pagina;
  await expect(p.getByTestId("aba-painel-chat")).toBeVisible();
  await expect(p.getByTestId("presenca-estado-mestre")).toHaveText("online");
  await expect(p.getByTestId("presenca-estado-jogador-1")).toHaveText("online");
  await expect(p.getByTestId("presenca-estado-jogador-5")).toHaveText("offline");
  await expect(p.getByTestId("presenca-jogador-1").locator(".avatar")).toHaveCSS(
    "background-color",
    "rgb(60, 180, 75)",
  );
  await expect(p.getByTestId("chat-texto")).toBeEnabled();
  await expect(p.getByTestId("chat-como")).toBeEnabled();
  await expect(p.getByTestId("chat-aviso")).toHaveCount(0);
  await expect(p.getByTestId("chat-mensagens")).toContainText("Nenhuma mensagem");

  // Notas (aba própria desde o R4): a da mesa e a do mestre; as Fichas ficam só com as pastas
  await abrirAba(p, "notas");
  await expect(p.getByTestId("aba-painel-notas").getByTestId("nota-mesa")).toBeVisible();
  await expect(p.getByTestId("aba-painel-notas").getByTestId("nota-mestre")).toBeVisible();
  await expect(j1.pagina.getByTestId("nota-mestre")).toHaveCount(0);
  await abrirAba(p, "fichas");
  await expect(p.getByTestId("aba-painel-fichas").getByTestId("nota-mesa")).toHaveCount(0);
  await expect(p.getByTestId("ficha-pasta-pasta-personagens")).toBeVisible();
  await expect(p.getByTestId("ficha-pasta-pasta-npcs")).toBeVisible();
  // "+ Novo": Personagem e NPC funcionam; Artefato, Tesouro e Handout estão desabilitados
  await p.getByTestId("ficha-novo").click();
  await expect(p.getByTestId("ficha-novo-personagem")).toBeEnabled();
  await expect(p.getByTestId("ficha-novo-npc")).toBeEnabled();
  for (const n of ["artefato", "tesouro", "handout"]) {
    await expect(p.getByTestId(`ficha-novo-${n}`)).toBeDisabled();
  }
  await p.keyboard.press("Escape");
  // a janela da ficha (duplo clique): na aba Configurar, "Importar ficha" já funciona (Lote 9)
  await p.getByTestId("ficha-abrir-pers-ogro").dblclick();
  await p.getByTestId("ficha-aba-configurar").click();
  await expect(p.getByTestId("editor-importar")).toBeEnabled();
  await expect(p.getByTestId("editor-pasta")).toContainText("NPCs");
  await expect(p.getByTestId("editor-pasta-visivel")).toContainText("só o mestre");
  await p.getByTestId("janela-ficha-fechar").click();

  // Compêndio (Lote 14): sem arquivo na pasta, o mestre vê como montar o JSON; nada é buscado na internet
  await abrirAba(p, "compendio");
  await expect(p.getByTestId("compendio-como-montar")).toBeVisible();
  await expect(p.getByTestId("compendio-exemplo")).toContainText("tabletop-compendio");
  await expect(p.getByTestId("compendio-recarregar")).toBeVisible();

  // Preferências: usuário, tema, encaixe, pasta local e transferências
  await abrirAba(p, "preferencias");
  await expect(p.getByTestId("trocar-usuario")).toBeVisible();
  await expect(p.getByTestId("pref-encaixe")).toBeVisible();
  await expect(p.getByTestId("biblioteca-pasta-estado")).toBeVisible();
  await expect(p.getByTestId("transferencias")).toBeVisible();
  // o contador conta o cache do navegador (um mapa feito aqui entra, sem nenhuma transferência)
  await expect(p.getByTestId("transferencias-prontas")).toContainText("0 arquivos prontos");
  await definirMapa(p, "cena-1", arquivoPng("contador.png", pngDeRuido(300, 200, 91, 4)));
  await abrirAba(p, "preferencias");
  await expect(p.getByTestId("transferencias-prontas")).toContainText("1 arquivo pronto");
  await expect(p.getByTestId("transferencia")).toHaveCount(0);

  // Mesa (só do mestre): papéis, capacidades (sem ficha.verOutras), uso (no diagnóstico recolhido), exportar e importar
  await abrirAba(p, "mesa");
  await expect(p.getByTestId("papel-jogador-1")).toBeVisible();
  await expect(p.getByTestId("uso-hoje")).toBeHidden();
  await p.getByTestId("mesa-diagnostico-resumo").click();
  await expect(p.getByTestId("uso-hoje")).toBeVisible();
  await expect(p.getByTestId("exportar")).toBeVisible();
  await expect(p.getByTestId("importar-arquivo")).toBeAttached();
  await expect(p.getByTestId("perm-padrao-token.moverProprio")).toBeVisible();
  await expect(p.getByTestId("perm-padrao-ficha.verOutras")).toHaveCount(0);
  // a presença não tem mais o seletor de papel
  await abrirAba(p, "chat");
  await expect(p.getByTestId("presenca").locator("select")).toHaveCount(0);

  // largura fixa: a barra não muda de tamanho entre as abas e nada passa da borda
  const largurasVistas = new Set<number>();
  for (const aba of ["chat", "fichas", "notas", "compendio", "mesa", "preferencias"]) {
    await abrirAba(p, aba);
    const caixa = await p.getByTestId("barra-lateral").boundingBox();
    largurasVistas.add(Math.round(caixa?.width ?? 0));
    const sobra = await p
      .locator(".lateral-conteudo")
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(sobra, `aba ${aba}`).toBeLessThanOrEqual(0);
  }
  expect(largurasVistas.size).toBe(1);

  expect(
    requisicoes.filter((u) => !/^(http:\/\/127\.0\.0\.1|blob:|data:|about:|ws:)/.test(u)),
  ).toEqual([]);
});

test("zoom inicial legível (100%, centrado no grupo) e painel do token compacto sem cobrir o mapa", async ({
  mesa,
}) => {
  test.setTimeout(60_000);
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  for (const s of [mestre, j1]) {
    await esperarMapa(s.pagina);
    expect(await gancho(s.pagina, "zoom")).toBeCloseTo(1, 2);
    // o mestre abre no centro do grupo (média dos 3 jogadores: 15,75 m e 9,75 m); o jogador, no token dele
    // (os outros personagens não chegam a ele)
    const foco = s === mestre ? { x: 15.75, y: 9.75 } : { x: 11.25, y: 9.75 };
    const caixa = await s.pagina.getByTestId("mapa").boundingBox();
    const tela = (await gancho(s.pagina, "paraTela", foco.x, foco.y)) as {
      x: number;
      y: number;
    };
    expect(Math.abs(tela.x - ((caixa?.x ?? 0) + (caixa?.width ?? 0) / 2))).toBeLessThan(3);
    expect(Math.abs(tela.y - ((caixa?.y ?? 0) + (caixa?.height ?? 0) / 2))).toBeLessThan(3);
  }
  // sem grupo na cena (o Covil), a vista abre no centro da cena
  await menuDaCena(mestre.pagina, "cena-covil", "ir");
  await expect(mestre.pagina.getByTestId("cena-nome")).toHaveText("Covil");
  const caixa = await mestre.pagina.getByTestId("mapa").boundingBox();
  await expect
    .poll(async () => {
      const t = (await gancho(mestre.pagina, "paraTela", 20, 15)) as { x: number; y: number };
      return Math.abs(t.x - ((caixa?.x ?? 0) + (caixa?.width ?? 0) / 2));
    })
    .toBeLessThan(3);
  expect(await gancho(mestre.pagina, "zoom")).toBeCloseTo(1, 2);

  // o painel do token é compacto e não cobre o token selecionado
  await menuDaCena(mestre.pagina, "cena-1", "ir");
  await expect(mestre.pagina.getByTestId("cena-nome")).toHaveText("Cena inicial");
  await mestre.pagina.getByTestId("menu-cenas").click(); // fecha a faixa
  await selecionarToken(mestre.pagina, "tok-jogador-2");
  const painel = await mestre.pagina.getByTestId("painel-token").boundingBox();
  const alvo = (await gancho(mestre.pagina, "paraTela", 15.75, 9.75)) as { x: number; y: number };
  expect(painel && painel.width <= 260).toBe(true);
  expect(painel && painel.height <= 420).toBe(true);
  const dentro =
    painel !== null &&
    alvo.x >= painel.x &&
    alvo.x <= painel.x + painel.width &&
    alvo.y >= painel.y &&
    alvo.y <= painel.y + painel.height;
  expect(dentro).toBe(false);
});

test("faixa de cenas: cards numerados com prévia, menu de contexto (ir, levar, duplicar, preparar, configurar, apagar) e nova cena", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre", { limiteTile: 512 });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;

  // o jogador não tem o ícone nem a faixa
  await expect(j1.pagina.getByTestId("menu-cenas")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("faixa-cenas")).toHaveCount(0);

  // abre logo abaixo do menu superior, ~160 px de altura e toda a largura disponível
  await expect(p.getByTestId("faixa-cenas")).toHaveCount(0);
  await p.getByTestId("menu-cenas").click();
  const faixa = await p.getByTestId("faixa-cenas").boundingBox();
  const menu = await p.getByTestId("menu-superior").boundingBox();
  const lateral = await p.getByTestId("barra-lateral").boundingBox();
  expect(faixa && menu && faixa.y >= menu.y + menu.height).toBe(true);
  expect(faixa && Math.abs(faixa.height - 164) <= 12).toBe(true);
  expect(faixa && lateral && faixa.x + faixa.width <= lateral.x).toBe(true);
  expect(faixa && lateral && lateral.x - (faixa.x + faixa.width) < 40).toBe(true);
  expect(faixa && faixa.width > 600).toBe(true);

  // cards na ordem: número, nome e prévia (padrão de grid, sem mapa); marca do grupo e destaque da vista
  const cards = p.getByTestId("cena-card");
  await expect(cards).toHaveCount(2);
  await expect(p.getByTestId("cena-numero-cena-1")).toHaveText("1");
  await expect(p.getByTestId("cena-numero-cena-covil")).toHaveText("2");
  await expect(p.getByTestId("cena-nome-cena-1")).toHaveText("Cena inicial");
  await expect(p.getByTestId("cena-nome-cena-covil")).toHaveText("Covil");
  await expect(p.getByTestId("cena-previa-grid-cena-1")).toBeVisible();
  await expect(p.getByTestId("cena-grupo-cena-1")).toBeVisible();
  await expect(p.getByTestId("cena-grupo-cena-covil")).toHaveCount(0);
  await expect(p.getByTestId("cena-vista-cena-1")).toBeVisible();
  await expect(p.getByTestId("cena-nova")).toBeVisible();

  // botão direito: menu pequeno ao lado do card, uma linha por opção, na ordem
  const card2 = p.locator('[data-testid="cena-card"][data-cena-id="cena-covil"]');
  await card2.click({ button: "right" });
  const menuDaCena2 = p.getByTestId("menu-cena");
  await expect(menuDaCena2).toBeVisible();
  await expect(menuDaCena2.getByRole("menuitem")).toHaveText([
    "Ir para",
    "Levar grupo",
    "Duplicar",
    "Preparar",
    "Configurar…",
    "Apagar",
  ]);
  const caixaMenu = await menuDaCena2.boundingBox();
  const caixaCard = await card2.boundingBox();
  expect(caixaMenu && caixaCard && caixaMenu.x >= caixaCard.x + caixaCard.width).toBe(true);
  // fecha com Esc e com clique fora
  await p.keyboard.press("Escape");
  await expect(menuDaCena2).toHaveCount(0);
  await card2.click({ button: "right" });
  await expect(menuDaCena2).toBeVisible();
  await p.getByTestId("mapa").click({ position: { x: 300, y: 500 } });
  await expect(menuDaCena2).toHaveCount(0);
  // a cena do grupo: levar, preparar e apagar ficam desabilitados
  await p.locator('[data-testid="cena-card"][data-cena-id="cena-1"]').click({ button: "right" });
  for (const a of ["levar", "preparar", "apagar"]) {
    await expect(p.getByTestId(`menu-cena-${a}`)).toBeDisabled();
  }
  await expect(p.getByTestId("menu-cena-ir")).toBeDisabled(); // já está vendo esta
  await p.keyboard.press("Escape");

  // Configurar…: nome, mapa (a imagem entra aqui), pixels por quadrado e grid visível
  await menuDaCena(p, "cena-covil", "configurar");
  const dialogo = p.getByTestId("configurar-cena");
  await expect(dialogo).toBeVisible();
  await dialogo.getByTestId("cfg-nome").fill("Covil Fundo");
  await dialogo.getByTestId("cfg-px").fill("5");
  await dialogo.getByTestId("cfg-salvar").click();
  await expect(dialogo.getByTestId("cfg-erro")).toContainText("entre 10 e 1000");
  await dialogo.getByTestId("cfg-px").fill("60");
  await dialogo.getByTestId("cfg-grid-visivel").uncheck();
  await dialogo.getByTestId("cfg-mapa").click();
  await p
    .getByTestId("seletor-arquivo")
    .setInputFiles(arquivoPng("fundo.png", pngDeRuido(1200, 800, 92, 2)));
  await expect(p.getByTestId("seletor-imagem")).toHaveCount(0, { timeout: 30_000 });
  await dialogo.getByTestId("cfg-salvar").click();
  await expect(dialogo).toHaveCount(0);
  await expect(p.getByTestId("cena-nome-cena-covil")).toHaveText("Covil Fundo");
  // a prévia do mapa em baixa resolução (mapa fatiado em tiles) aparece no card
  const previa = p.getByTestId("cena-previa-cena-covil");
  await expect(previa).toBeVisible({ timeout: 30_000 });
  const tamanho = await previa.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ]);
  expect(tamanho).toEqual([256, 171]);

  // Ir para: o mestre passa a ver a cena; o grupo não sai do lugar
  await menuDaCena(p, "cena-covil", "ir");
  await expect(p.getByTestId("cena-nome")).toHaveText("Covil Fundo");
  await expect(p.getByTestId("grupo-em")).toHaveText("Cena inicial");
  await expect(p.getByTestId("cena-vista-cena-covil")).toBeVisible();
  await expect(p.getByTestId("cena-vista-cena-1")).toHaveCount(0);
  await expect(p.getByTestId("cena-grupo-cena-1")).toBeVisible();
  await expect(j1.pagina.getByTestId("cena-nome")).toHaveText("Cena inicial");

  // a bandeira do ponto de chegada só existe para o mestre
  expect(await gancho(p, "bandeira")).not.toBeNull();
  expect(await gancho(j1.pagina, "bandeira")).toBeNull();

  // Preparar: o card mostra o progresso (arquivos preparados e jogadores que já têm tudo)
  await menuDaCena(p, "cena-covil", "preparar");
  await expect(p.getByTestId("cena-progresso-cena-covil")).toContainText("6 arquivos", {
    timeout: 60_000,
  });

  // Duplicar
  await menuDaCena(p, "cena-covil", "duplicar");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(2).getByText("Covil Fundo (cópia)")).toBeVisible();

  // Apagar pede confirmação; cancelar não apaga, confirmar apaga
  await menuDaCena(p, "cena-covil", "apagar");
  await expect(p.getByTestId("confirmar-apagar-cena")).toContainText("Covil Fundo");
  await p.getByTestId("confirmar-apagar-cena-nao").click();
  await expect(cards).toHaveCount(3);
  await menuDaCena(p, "cena-covil", "apagar");
  await p.getByTestId("confirmar-apagar-cena-sim").click();
  await expect(cards).toHaveCount(2);

  // + Nova cena, e duplo clique renomeia
  await p.getByTestId("cena-nova").click();
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(2).getByTestId(/cena-numero-/)).toHaveText("3");
  const nova = cards.nth(2);
  await nova.getByTestId(/cena-nome-cena-/).dblclick();
  const campo = nova.getByRole("textbox");
  await campo.fill("Floresta");
  await campo.press("Enter");
  await expect(nova.getByText("Floresta")).toBeVisible();

  // Levar grupo (pelo menu): o jogador muda de cena
  const idNova = (await nova.getAttribute("data-cena-id")) as string;
  await menuDaCena(p, idNova, "levar");
  await expect(j1.pagina.getByTestId("cena-nome")).toHaveText("Floresta");
  await expect(p.getByTestId(`cena-grupo-${idNova}`)).toBeVisible();

  // o ícone de cenas fecha a faixa
  await p.getByTestId("menu-cenas").click();
  await expect(p.getByTestId("faixa-cenas")).toHaveCount(0);
  await abrirFaixa(p);
});
