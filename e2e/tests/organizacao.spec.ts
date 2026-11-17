import type { Locator, Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, expect, menuDaCena, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "./ajudasMapa";

// Redesign R4: organização do mestre. Menu do topo em grupos e com nomes, "Ver como" em botão próprio,
// Paredes e portas como ferramenta da barra, Notas em aba própria, Mesa (só mestre) e Preferências
// (todos), grid na configuração da cena e o atalho "Modelos de tocha…". Nada muda na sala nem no
// protocolo: só o lugar de cada coisa.

type Caixa = { x: number; y: number; width: number; height: number };

async function caixa(l: Locator): Promise<Caixa> {
  const c = await l.boundingBox();
  if (!c) throw new Error("elemento sem caixa (não está visível)");
  return c;
}

const GRUPOS = ["cena", "mapa", "luz", "combate", "automacoes", "ver-como"] as const;

const BOTOES: { testid: string; nome: string; grupo: (typeof GRUPOS)[number] }[] = [
  { testid: "menu-cenas", nome: "Cenas", grupo: "cena" },
  { testid: "menu-camadas", nome: "Camadas", grupo: "cena" },
  { testid: "novo-token", nome: "Novo token", grupo: "mapa" },
  { testid: "menu-visao-noturna", nome: "Visão do mestre", grupo: "luz" },
  { testid: "menu-iluminacao", nome: "Iluminação", grupo: "luz" },
  { testid: "menu-ordem-turno", nome: "Ordem de turno", grupo: "combate" },
  { testid: "menu-automacoes", nome: "Automações", grupo: "automacoes" },
  { testid: "menu-ver-como", nome: "Ver como", grupo: "ver-como" },
];

test("o topo do mestre tem grupos (sem rótulo na barra) e cada botão tem nome e dica com o grupo (mouse e teclado)", async ({
  mesa,
}) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;

  // os seis grupos (Q8: Automações entrou antes de Ver como), na ordem, cada um com o nome só para leitor de tela (V3: não há rótulo desenhado na barra)
  const nomes = await p.locator('[data-testid^="menu-grupo-"]').evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute("data-testid"),
      nome: e.getAttribute("aria-label"),
      rotulo: e.querySelector(".menu-grupo-nome") !== null,
    })),
  );
  expect(nomes).toEqual([
    { id: "menu-grupo-cena", nome: "Cena", rotulo: false },
    { id: "menu-grupo-mapa", nome: "Mapa", rotulo: false },
    { id: "menu-grupo-luz", nome: "Luz", rotulo: false },
    { id: "menu-grupo-combate", nome: "Combate", rotulo: false },
    { id: "menu-grupo-automacoes", nome: "Automações", rotulo: false },
    { id: "menu-grupo-ver-como", nome: "Ver como", rotulo: false },
  ]);
  for (const b of BOTOES) {
    const botao = p.getByTestId(b.testid);
    await expect(botao).toBeVisible();
    await expect(botao).toHaveAttribute("aria-label", new RegExp(`^${b.nome}`));
    // o botão está dentro do grupo certo
    await expect(p.getByTestId(`menu-grupo-${b.grupo}`).getByTestId(b.testid)).toHaveCount(1);
    // sem dica enquanto não há mouse nem foco
    await expect(p.getByTestId(`dica-${b.testid}`)).toBeHidden();
  }

  // dica no mouse: o grupo e o nome ("Cena · Camadas"), numa linha só
  await p.getByTestId("menu-camadas").hover();
  const dica = p.getByTestId("dica-menu-camadas");
  await expect(dica).toBeVisible();
  await expect(dica).toContainText("Cena · Camadas");
  await expect(dica).toHaveText("Cena · Camadas");
  await p.mouse.move(600, 400);
  await expect(dica).toBeHidden();

  // dica no foco do teclado (e sai ao perder o foco)
  await p.getByTestId("menu-ordem-turno").focus();
  await expect(p.getByTestId("dica-menu-ordem-turno")).toBeVisible();
  await expect(p.getByTestId("dica-menu-ordem-turno")).toContainText("Combate · Ordem de turno");
  await expect(p.getByTestId("menu-ordem-turno")).toHaveAttribute(
    "aria-describedby",
    (await p.getByTestId("dica-menu-ordem-turno").getAttribute("id")) as string,
  );
  await p.keyboard.press("Tab");
  await expect(p.getByTestId("dica-menu-ordem-turno")).toBeHidden();
  await expect(p.getByTestId("dica-menu-automacoes")).toBeVisible();

  // cabe no topo de 48 px, em uma linha, sem cobrir a presença nem a pausa
  const topo = await caixa(p.getByTestId("topo"));
  const menu = await caixa(p.getByTestId("menu-superior"));
  expect(Math.round(topo.height)).toBe(48);
  expect(menu.y).toBeGreaterThanOrEqual(topo.y);
  expect(menu.y + menu.height).toBeLessThanOrEqual(topo.y + topo.height + 1);
  for (const testid of ["presenca", "menu-pausa"]) {
    const outro = await caixa(p.getByTestId(testid));
    expect(menu.x + menu.width, `menu antes de ${testid}`).toBeLessThanOrEqual(outro.x + 1);
  }
  for (const b of BOTOES) {
    const c = await caixa(p.getByTestId(b.testid));
    expect(c.y).toBeGreaterThanOrEqual(topo.y);
    expect(c.y + c.height).toBeLessThanOrEqual(topo.y + topo.height);
  }
});

test("'Ver como' tem botão próprio (sem clique direito) e a lua só liga a visão noturna", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;

  // clique direito na lua não abre mais nada
  await p.getByTestId("menu-visao-noturna").click({ button: "right" });
  await expect(p.getByTestId("ver-como")).toHaveCount(0);
  await expect(p.getByTestId("menu-visao-noturna")).toHaveAttribute("aria-pressed", "true");
  await p.getByTestId("menu-visao-noturna").click();
  await expect(p.getByTestId("menu-visao-noturna")).toHaveAttribute("aria-pressed", "false");
  await p.getByTestId("menu-visao-noturna").click();

  // o botão abre a lista: "Eu mesmo (mestre)" e os jogadores
  await p.getByTestId("menu-ver-como").click();
  await expect(p.getByTestId("ver-como")).toBeVisible();
  await expect(p.getByTestId("ver-como-eu")).toContainText("Eu mesmo (mestre)");
  await expect(p.getByTestId("ver-como-eu")).toHaveAttribute("aria-checked", "true");
  await p.getByTestId("ver-como-jogador-1").click();
  await expect(p.getByTestId("ver-como")).toHaveCount(0);
  await expect(p.getByTestId("ver-como-selo")).toBeVisible();
  await expect(p.getByTestId("ver-como-selo")).toContainText("Jogador 1");
  await expect(p.getByTestId("menu-ver-como")).toHaveAttribute("aria-pressed", "true");
  // vendo como jogador, a ferramenta Paredes não está na barra
  await expect(p.getByTestId("ferramenta-paredes")).toHaveCount(0);

  await p.getByTestId("menu-ver-como").click();
  await p.getByTestId("ver-como-eu").click();
  await expect(p.getByTestId("ver-como-selo")).toHaveCount(0);
  await expect(p.getByTestId("menu-ver-como")).toHaveAttribute("aria-pressed", "false");
  await expect(p.getByTestId("ferramenta-paredes")).toBeVisible();
});

test("'Eventos' saiu do menu e a iluminação traz 'Modelos de tocha…' no lugar de 'Paredes e portas'", async ({
  mesa,
}) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await expect(p.getByTestId("menu-eventos")).toHaveCount(0);
  await expect(p.getByTestId("painel-eventos")).toHaveCount(0);
  await expect(p.getByText("em breve", { exact: false })).toHaveCount(0);

  await p.getByTestId("menu-iluminacao").click();
  await expect(p.getByTestId("lanterna")).toBeVisible();
  await expect(p.getByTestId("lanterna-paredes")).toHaveCount(0);
  await expect(p.getByTestId("lanterna-iluminacao")).toBeVisible();
  await expect(p.getByTestId("lanterna-fontes")).toBeVisible();
  await expect(p.getByTestId("lanterna-config")).toBeVisible();
  await expect(p.getByTestId("lanterna-modelos")).toContainText("Modelos de tocha…");
});

test("a ferramenta Paredes e portas liga o modo visível, desenha e sai ao trocar de ferramenta", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const botao = p.getByTestId("ferramenta-paredes");
  const quantas = () =>
    p.evaluate(
      () => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paredes().length,
    );
  const antes = await quantas();

  await expect(botao).toBeVisible();
  await expect(botao).toHaveAttribute("aria-label", /Paredes e portas/);
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await expect(p.getByTestId("modo-paredes-selo")).toHaveCount(0);

  // liga: botão apertado, selo no mapa, janela com o tipo, cursor de mira
  await botao.click();
  await expect(botao).toHaveAttribute("aria-pressed", "true");
  await expect(p.getByTestId("ferramenta-selecionar")).toHaveAttribute("aria-pressed", "false");
  await expect(p.getByTestId("modo-paredes-selo")).toBeVisible();
  await expect(p.getByTestId("modo-paredes-selo")).toContainText("Paredes e portas");
  await expect(p.getByTestId("painel-paredes")).toBeVisible();
  await expect(p.getByTestId("parede-novo-parede")).toBeVisible();
  await expect(p.locator("[data-area-do-mapa] canvas")).toHaveCSS("cursor", "crosshair");
  // o selo fica na área do mapa
  const area = await caixa(p.getByTestId("area-do-mapa"));
  const selo = await caixa(p.getByTestId("modo-paredes-selo"));
  expect(selo.x).toBeGreaterThanOrEqual(area.x);
  expect(selo.x + selo.width).toBeLessThanOrEqual(area.x + area.width);

  // desenha uma parede (clique, duplo clique)
  await p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(45, 5),
  );
  const a = await pontoNaPagina(p, 42, 6);
  const b = await pontoNaPagina(p, 48, 6);
  await p.mouse.click(a.x, a.y);
  await p.mouse.dblclick(b.x, b.y);
  await expect.poll(quantas).toBe(antes + 1);
  expect(mestre.enviados.filter((f) => f.includes('"parede.criar"'))).toHaveLength(1);

  // trocar de ferramenta sai do modo: botão solto, selo e janela somem
  await p.getByTestId("ferramenta-selecionar").click();
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await expect(p.getByTestId("modo-paredes-selo")).toHaveCount(0);
  await expect(p.getByTestId("painel-paredes")).toHaveCount(0);

  // apertar de novo o próprio botão também sai
  await botao.click();
  await expect(p.getByTestId("modo-paredes-selo")).toBeVisible();
  await botao.click();
  await expect(p.getByTestId("modo-paredes-selo")).toHaveCount(0);
  await expect(p.getByTestId("painel-paredes")).toHaveCount(0);

  // fechar a janela também sai do modo (e o botão do selo)
  await botao.click();
  await expect(p.getByTestId("painel-paredes")).toBeVisible();
  await p.getByTestId("paredes-fechar").click();
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await expect(p.getByTestId("modo-paredes-selo")).toHaveCount(0);
  await botao.click();
  await p.getByTestId("modo-paredes-sair").click();
  await expect(botao).toHaveAttribute("aria-pressed", "false");

  // outra ferramenta (régua, pelo teclado) também tira do modo
  await botao.click();
  await expect(p.getByTestId("modo-paredes-selo")).toBeVisible();
  await p.getByTestId("ferramenta-regua").click();
  await expect(p.getByTestId("modo-paredes-selo")).toHaveCount(0);
  await expect(p.getByTestId("ferramenta-regua")).toHaveAttribute("aria-pressed", "true");
});

test("o jogador não vê a ferramenta Paredes nem a aba Mesa; as abas de cada um", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j = (await entrarNoMapa(mesa, "jogador-1")).pagina;
  await expect(j.getByTestId("barra-ferramentas")).toBeVisible();
  await expect(j.getByTestId("ferramenta-paredes")).toHaveCount(0);
  await expect(j.getByTestId("aba-mesa")).toHaveCount(0);
  await expect(j.getByTestId("aba-painel-mesa")).toHaveCount(0);
  await expect(j.getByTestId("menu-superior")).toHaveCount(0);
  const abas = (p: Page) => p.getByRole("tab").evaluateAll((els) => els.map((e) => e.textContent));
  expect(await abas(mestre.pagina)).toEqual([
    "Chat",
    "Fichas",
    "Compêndio",
    "Preferências",
    "Mesa",
  ]);
  expect(await abas(j)).toEqual(["Chat", "Fichas", "Compêndio", "Preferências"]);
});

test("Preferências (todos) e Mesa (só mestre) separam o pessoal do que vale para a sala", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");

  for (const s of [mestre, j]) {
    await abrirPreferencia(s.pagina, "conta");
    await abrirPreferencia(s.pagina, "aparencia");
    await abrirPreferencia(s.pagina, "mapa");
    await abrirPreferencia(s.pagina, "ajuda");
    const painel = s.pagina.getByTestId("aba-painel-preferencias");
    await expect(painel.getByTestId("trocar-usuario")).toBeVisible();
    await expect(painel.getByTestId("seletor-de-tema")).toBeVisible();
    await expect(painel.getByTestId("pref-encaixe")).toBeVisible();
    await expect(painel.getByTestId("biblioteca-pasta-estado")).toBeVisible();
    await expect(painel.getByTestId("transferencias")).toBeVisible();
    // nada da sala aqui
    for (const t of ["config-mesa", "config-objetos", "papeis", "exportar", "uso-hoje"]) {
      await expect(painel.getByTestId(t)).toHaveCount(0);
    }
  }

  // Mesa: regras, modelos de tocha, papéis, capacidades, campanha e o diagnóstico recolhido
  await abrirAba(mestre.pagina, "mesa");
  const m = mestre.pagina.getByTestId("aba-painel-mesa");
  for (const t of [
    "config-mesa",
    "config-objetos",
    "papeis",
    "perm-padrao-token.moverProprio",
    "exportar",
    "importar-arquivo",
  ]) {
    await expect(m.getByTestId(t)).toBeAttached();
  }
  await expect(m.getByTestId("pref-encaixe")).toHaveCount(0);
  await expect(m.getByTestId("seletor-de-tema")).toHaveCount(0);
  // o "uso de hoje" fica no cartão do diagnóstico, que abre e fecha
  await expect(m.getByTestId("uso-hoje")).toContainText("uso de hoje");
  await m.getByTestId("mesa-secao-diagnostico-titulo").click();
  await expect(m.getByTestId("uso-hoje")).toBeHidden();
  await m.getByTestId("mesa-secao-diagnostico-titulo").click();
  await expect(m.getByTestId("uso-hoje")).toContainText("uso de hoje");
  // o grid não está mais na Mesa
  await expect(m.getByTestId("grid-quadrado")).toHaveCount(0);
  await expect(m.getByTestId("grid-visivel")).toHaveCount(0);

  // Q8: a aba tem os mesmos cartões da aba Preferências, e cada um abre e fecha no título
  for (const id of [
    "esta-mesa",
    "regras",
    "luz",
    "automacoes",
    "pessoas",
    "campanha",
    "diagnostico",
  ]) {
    await expect(m.getByTestId(`mesa-secao-${id}-titulo`)).toBeVisible();
  }
  await m.getByTestId("mesa-secao-campanha-titulo").click();
  await expect(m.getByTestId("mesa-secao-campanha-titulo")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(m.getByTestId("exportar")).toBeHidden();
  await m.getByTestId("mesa-secao-campanha-titulo").click();
  await expect(m.getByTestId("exportar")).toBeVisible();
  await expect(mestre.pagina.getByTestId("barra-lateral")).toBeVisible();
});

test("o grid muda pela configuração da cena e todos veem", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");
  const quadrado = (p: Page) =>
    p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.quadradoM());
  const antes = await quadrado(mestre.pagina);
  expect(antes).not.toBe(2.5);

  await menuDaCena(mestre.pagina, "cena-1", "configurar");
  const dialogo = mestre.pagina.getByTestId("configurar-cena");
  await expect(dialogo.getByTestId("cfg-grid")).toBeVisible();
  await expect(dialogo.getByTestId("cfg-grid-visivel")).toBeChecked();
  await expect(dialogo.getByTestId("grid-quadrado")).toHaveValue(String(antes));
  // valor inválido: erro e nada é enviado
  await dialogo.getByTestId("grid-quadrado").fill("50");
  await dialogo.getByTestId("cfg-salvar").click();
  await expect(dialogo.getByTestId("cfg-erro")).toContainText("Quadrado do grid");
  await dialogo.getByTestId("grid-quadrado").fill("2.5");
  await dialogo.getByTestId("cfg-salvar").click();
  await expect(dialogo).toHaveCount(0);
  for (const s of [mestre, j]) {
    await expect.poll(() => quadrado(s.pagina)).toBe(2.5);
  }
  // é o mesmo frame de sempre (cena.configurarGrid), só que editado em outro lugar
  expect(mestre.enviados.filter((f) => f.includes('"cena.configurarGrid"'))).toHaveLength(1);
  expect(mestre.enviados.find((f) => f.includes('"cena.configurarGrid"'))).toContain(
    '"quadradoM":2.5',
  );
});

test("'Modelos de tocha…' abre a aba Mesa já na seção de luz", async ({ mesa }) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await expect(p.getByTestId("aba-painel-chat")).toBeVisible();
  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-modelos").click();
  await expect(p.getByTestId("aba-mesa")).toHaveAttribute("aria-selected", "true");
  await expect(p.getByTestId("aba-painel-mesa")).toBeVisible();
  await expect(p.getByTestId("mesa-secao-luz")).toBeVisible();
  // a seção está no alto da área rolável (logo abaixo do índice), não escondida mais para baixo
  const conteudo = await caixa(p.locator(".lateral-conteudo"));
  await expect
    .poll(async () => (await caixa(p.getByTestId("mesa-secao-luz"))).y - conteudo.y)
    .toBeLessThan(120);
  await expect(p.getByTestId("config-objetos")).toBeVisible();

  // com o painel recolhido o atalho também abre e rola
  await p.getByTestId("aba-chat").click();
  await p.getByTestId("lateral-recolher").click();
  await p.getByTestId("menu-iluminacao").click();
  await p.getByTestId("lanterna-modelos").click();
  await expect(p.getByTestId("aba-painel-mesa")).toBeVisible();
  await expect(p.getByTestId("config-objetos")).toBeVisible();
});

test("as cinco abas do mestre dividem o painel em partes iguais em 300 px, dentro do painel e com o nome numa linha", async ({
  mesa,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  const j = (await entrarNoMapa(mesa, "jogador-1")).pagina;
  const nomes: Record<string, string> = {
    chat: "Chat",
    fichas: "Fichas",
    compendio: "Compêndio",
    mesa: "Mesa",
    preferencias: "Preferências",
  };
  for (const [p, ids] of [
    [m, ["chat", "fichas", "compendio", "preferencias", "mesa"]],
    [j, ["chat", "fichas", "compendio", "preferencias"]],
  ] as const) {
    await p.getByTestId("alca-do-painel").focus();
    await p.keyboard.press("Home");
    await expect
      .poll(async () => Math.round((await caixa(p.getByTestId("barra-lateral"))).width))
      .toBe(300);
    const painel = await caixa(p.getByTestId("barra-lateral"));
    for (const id of ids) {
      const aba = p.getByTestId(`aba-${id}`);
      const nome = p.getByTestId(`aba-nome-${id}`);
      await expect(nome).toHaveText(nomes[id] as string);
      // V3: o nome é de uma linha só (cortado com reticências, se não couber; a dica traz o inteiro)
      expect(await nome.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
      const c = await caixa(aba);
      expect(c.x).toBeGreaterThanOrEqual(painel.x);
      expect(c.x + c.width).toBeLessThanOrEqual(painel.x + painel.width + 1);
      await expect(aba.locator("svg")).toBeVisible();
    }
    // o corpo de cada aba não rola de lado
    for (const id of ids) {
      await abrirAba(p, id);
      const sobra = await p
        .locator(".lateral-conteudo")
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(sobra, `aba ${id}`).toBeLessThanOrEqual(0);
    }
  }
});
