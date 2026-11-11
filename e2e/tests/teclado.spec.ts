import type { Locator, Page } from "@playwright/test";
import { ATALHOS, IDS_DOS_ATALHOS, textoDasTeclas } from "../../apps/web/src/atalhos";
import { TEMAS } from "../../apps/web/src/tema/temas";
import { abrirAba, enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { doTipo, entrarNoMapa, type GanchoDoMapa, soSelecionarToken } from "./ajudasMapa";

// R6a: teclado, dicas com atalho, foco visível e contraste. Tudo o que se faz com o mouse tem caminho pelo
// teclado; toda dica vale no hover e no foco, com o atalho quando há; o menu do token abre com Shift+F10.

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

/** O `data-testid` do elemento em foco (vazio se não há). */
const emFoco = (p: Page) =>
  p.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? "");

/** As teclas (`<kbd>`) de uma dica, uma por elemento. */
const teclasDa = (dica: Locator) => dica.locator("kbd").allTextContents();

/** Todas as teclas de um atalho da tabela, na ordem em que a dica as mostra. */
const teclasDoAtalho = (id: keyof typeof ATALHOS) => ATALHOS[id].teclas.flat();

const alcasDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas());

/** Aperta a seta para baixo até o foco chegar no item (o menu é uma lista longa). */
async function descerAte(p: Page, testid: string) {
  for (let i = 0; i < 40; i++) {
    if ((await emFoco(p)) === testid) return;
    await p.keyboard.press("ArrowDown");
  }
  expect(await emFoco(p)).toBe(testid);
}

test("a dica vale no mouse e no foco por Tab, com o atalho: topo, barra esquerda e janela", async ({
  mesa,
}) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;

  // barra esquerda: mouse, com o atalho em <kbd>
  await p.getByTestId("ferramenta-regua").hover();
  const dicaRegua = p.getByTestId("dica-ferramenta-regua");
  await expect(dicaRegua).toBeVisible();
  await expect(dicaRegua).toContainText("Régua");
  expect(await teclasDa(dicaRegua)).toEqual(teclasDoAtalho("regua"));
  await expect(p.getByTestId("ferramenta-regua")).toHaveAttribute("aria-keyshortcuts", "R");
  await expect(p.getByTestId("ferramenta-regua")).toHaveAttribute(
    "aria-describedby",
    (await dicaRegua.getAttribute("id")) as string,
  );
  await p.mouse.move(700, 400);
  await expect(dicaRegua).toBeHidden();

  // barra esquerda: foco por Tab (Selecionar → Mão), e a dica sai ao perder o foco
  await p.getByTestId("ferramenta-selecionar").focus();
  await expect(p.getByTestId("dica-ferramenta-selecionar")).toBeVisible();
  expect(await teclasDa(p.getByTestId("dica-ferramenta-selecionar"))).toEqual(["V"]);
  await p.keyboard.press("Tab");
  await expect.poll(() => emFoco(p)).toBe("ferramenta-mao");
  await expect(p.getByTestId("dica-ferramenta-mao")).toBeVisible();
  await expect(p.getByTestId("dica-ferramenta-mao")).toContainText("Mão");
  expect(await teclasDa(p.getByTestId("dica-ferramenta-mao"))).toEqual(["H"]);
  await expect(p.getByTestId("dica-ferramenta-selecionar")).toBeHidden();
  await p.keyboard.press("Tab");
  await expect(p.getByTestId("dica-ferramenta-regua")).toBeVisible();
  // Esc esconde a dica sem tirar o foco
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("dica-ferramenta-regua")).toBeHidden();
  await expect(p.getByTestId("ferramenta-regua")).toBeFocused();

  // topo: foco por Tab (Cenas → Camadas); sem atalho, a dica não tem <kbd>
  await p.getByTestId("menu-cenas").focus();
  await p.keyboard.press("Tab");
  await expect.poll(() => emFoco(p)).toBe("menu-camadas");
  await expect(p.getByTestId("dica-menu-camadas")).toBeVisible();
  await expect(p.getByTestId("dica-menu-camadas")).toContainText("Camadas");
  expect(await teclasDa(p.getByTestId("dica-menu-camadas"))).toEqual([]);

  // zoom: era `title` nativo; agora é a dica comum
  await p.getByTestId("zoom-mais").focus();
  await expect(p.getByTestId("dica-zoom-mais")).toBeVisible();
  await expect(p.getByTestId("dica-zoom-mais")).toContainText("Aproximar");
  await expect(p.getByTestId("zoom-mais")).not.toHaveAttribute("title", /.+/);

  // janela: o cabeçalho (mover, com as setas) e os botões
  await p.getByTestId("menu-ordem-turno").click();
  const janela = p.getByTestId("janela-ordem");
  await expect(janela).toBeVisible();
  const cabecalho = janela.getByRole("toolbar");
  await cabecalho.focus();
  const dicaCab = p.getByTestId("dica-janela-ordem-cabecalho");
  await expect(dicaCab).toBeVisible();
  await expect(dicaCab).toContainText("Mover a janela");
  expect(await teclasDa(dicaCab)).toEqual(teclasDoAtalho("janelaMover"));
  await p.keyboard.press("Escape");
  await expect(dicaCab).toBeHidden();
  await cabecalho.hover();
  await expect(dicaCab).toBeVisible();
  // sobre um botão do cabeçalho vale a dica do botão, não a do cabeçalho
  await p.getByTestId("janela-ordem-minimizar").hover();
  await expect(dicaCab).toBeHidden();
  await expect(p.getByTestId("dica-janela-ordem-minimizar")).toBeVisible();
  await expect(p.getByTestId("dica-janela-ordem-minimizar")).toContainText("Minimizar");
  await p.mouse.move(700, 600);
  // o botão Minimizar também mostra a dica no foco, e a janela minimiza com Enter
  await p.getByTestId("janela-ordem-minimizar").focus();
  await expect(p.getByTestId("dica-janela-ordem-minimizar")).toBeVisible();
  await p.keyboard.press("Enter");
  await expect(janela).toHaveAttribute("data-minimizada", "true");
  await expect(p.getByTestId("dica-janela-ordem-minimizar")).toBeHidden();
});

test("a lista 'Atalhos do teclado' das Preferências bate com a tabela única", async ({ mesa }) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await abrirAba(p, "preferencias");
  const lista = p.getByTestId("atalhos");
  await lista.scrollIntoViewIfNeeded();
  await expect(lista).toBeVisible();
  await expect(lista.getByRole("heading", { name: "Atalhos do teclado" })).toBeVisible();
  // uma linha por atalho da tabela, na mesma ordem, com as mesmas teclas e a mesma descrição
  const ids = await lista
    .locator("[data-testid^='atalho-']")
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid ?? ""));
  expect(ids).toEqual(IDS_DOS_ATALHOS.map((id) => `atalho-${id}`));
  for (const id of IDS_DOS_ATALHOS) {
    const linha = p.getByTestId(`atalho-${id}`);
    await expect(linha).toContainText(ATALHOS[id].descricao);
    expect(await teclasDa(linha), id).toEqual(ATALHOS[id].teclas.flat());
  }
  // os que o código já tinha estão lá
  expect(textoDasTeclas(ATALHOS.regua.teclas)).toBe("R");
  await expect(p.getByTestId("atalho-menuDoToken")).toContainText("Shift");
  await expect(p.getByTestId("atalho-menuDoToken")).toContainText("F10");
  // e a ferramenta Régua de fato troca com a tecla da tabela
  await p.getByTestId("mapa").click({ position: { x: 300, y: 300 } });
  await p.keyboard.press("r");
  await expect(p.getByTestId("ferramenta-regua")).toHaveAttribute("aria-pressed", "true");
  await p.keyboard.press("h");
  await expect(p.getByTestId("ferramenta-mao")).toHaveAttribute("aria-pressed", "true");
  await p.keyboard.press("v");
  await expect(p.getByTestId("ferramenta-selecionar")).toHaveAttribute("aria-pressed", "true");
});

test("Shift+F10 abre o menu do token selecionado; setas e Enter marcam uma condição; Esc fecha e devolve o foco", async ({
  mesa,
}) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;

  // sem token selecionado a tecla não abre nada
  await p.getByTestId("mapa").focus();
  await p.keyboard.press("Shift+F10");
  await expect(p.getByTestId("menu-token")).toHaveCount(0);

  await soSelecionarToken(p, "tok-ogro");
  await p.getByTestId("mapa").focus();
  await p.keyboard.press("Shift+F10");
  const menu = p.getByTestId("menu-token");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("aria-label", /Token: /);
  // o foco vai para o primeiro item; as setas andam
  await expect.poll(() => emFoco(p)).toBe("menu-token-editar");
  await p.keyboard.press("ArrowDown");
  await expect.poll(() => emFoco(p)).toBe("menu-token-iniciativa");
  await p.keyboard.press("ArrowUp");
  await expect.poll(() => emFoco(p)).toBe("menu-token-editar");
  // End vai ao último controle (o campo da concentração; nele Home e End são do texto); a seta para baixo dá a volta
  await p.keyboard.press("End");
  await expect.poll(() => emFoco(p)).toBe("concentracao-input");
  await p.keyboard.press("ArrowDown");
  await expect.poll(() => emFoco(p)).toBe("menu-token-editar");

  // Enter marca "Caído": o mesmo frame do clique
  await descerAte(p, "condicao-caido");
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("condicao-caido")).toHaveAttribute("aria-checked", "true");
  await expect(menu).toBeVisible();
  // Espaço também ativa (outro item): marca a que estiver em foco depois de uma seta
  await p.keyboard.press("ArrowDown");
  const proximo = await emFoco(p);
  expect(proximo).toMatch(/^condicao-/);
  await p.keyboard.press("Space");
  await expect(p.getByTestId(proximo)).toHaveAttribute("aria-checked", "true");

  const frames = doTipo(m.enviados, "token.condicoes").map((f) => JSON.parse(f));
  expect(frames).toHaveLength(2);
  expect(frames[0].dados).toEqual({ id: "tok-ogro", condicoes: ["caido"] });
  // o clique do mouse manda o mesmo tipo de frame, com o mesmo formato
  const outra = proximo === "condicao-cego" ? "condicao-surdo" : "condicao-cego";
  await p.getByTestId(outra).click();
  await expect(p.getByTestId(outra)).toHaveAttribute("aria-checked", "true");
  const doClique = JSON.parse(doTipo(m.enviados, "token.condicoes")[2] ?? "{}");
  expect(doClique.tipo).toBe(frames[0].tipo);
  expect(Object.keys(doClique.dados).sort()).toEqual(Object.keys(frames[0].dados).sort());

  // Esc fecha e devolve o foco ao mapa
  await p.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(p.getByTestId("mapa")).toBeFocused();
});

test("com o foco num campo de texto Shift+F10 não abre o menu do token", async ({ mesa }) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await soSelecionarToken(p, "tok-ogro");
  await abrirAba(p, "chat");
  await p.getByTestId("chat-texto").focus();
  await p.keyboard.press("Shift+F10");
  await expect(p.getByTestId("menu-token")).toHaveCount(0);
});

test("o jogador abre o menu do token que controla, pelo teclado, e não o de outro", async ({
  mesa,
}) => {
  await entrarNoMapa(mesa, "mestre");
  const j = await entrarNoMapa(mesa, "jogador-1");
  const p = j.pagina;
  // o jogador não seleciona tokens: a tecla abre o menu do token que ele controla
  await p.getByTestId("mapa").focus();
  await p.keyboard.press("Shift+F10");
  await expect(p.getByTestId("menu-token")).toBeVisible();
  await expect(p.getByTestId("menu-token")).toHaveAttribute("aria-label", "Token: Aldric");
  // sem "Editar token…" (é do mestre): o foco vai para o primeiro item que existe
  await expect(p.getByTestId("menu-token-editar")).toHaveCount(0);
  await expect.poll(() => emFoco(p)).toMatch(/^condicao-/);
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("menu-token")).toHaveCount(0);
  await expect(p.getByTestId("mapa")).toBeFocused();
});

test("apagar e acender a tocha pelo menu do token, só pelo teclado, com os frames de sempre", async ({
  mesa,
}) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await ok(p, "mochila.ajustar", {
    personagemId: "pers-aldric",
    modeloId: "modelo-tocha",
    delta: 2,
  });
  await ok(p, "tocha.acender", {
    personagemId: "pers-aldric",
    modeloId: "modelo-tocha",
    novoId: "tocha-1",
  });
  await expect.poll(async () => (await alcasDe(p)).length).toBe(1);
  expect((await alcasDe(p))[0]?.estado).toBe("acesa");

  await soSelecionarToken(p, "tok-jogador-1");
  await p.getByTestId("mapa").focus();
  await p.keyboard.press("ContextMenu");
  await expect(p.getByTestId("menu-token")).toBeVisible();
  const alternar = p.getByTestId("menu-token-tocha-alternar-tocha-1");
  await descerAte(p, "menu-token-tocha-alternar-tocha-1");
  await expect(alternar).toHaveText("Apagar a tocha");
  await p.keyboard.press("Enter");
  await expect.poll(async () => (await alcasDe(p))[0]?.estado).toBe("apagada");
  await expect(alternar).toHaveText("Acender a tocha");
  // o menu fica aberto e o foco no mesmo item: Enter de novo acende
  await expect.poll(() => emFoco(p)).toBe("menu-token-tocha-alternar-tocha-1");
  await p.keyboard.press("Enter");
  await expect.poll(async () => (await alcasDe(p))[0]?.estado).toBe("acesa");
  const frames = doTipo(m.enviados, "tocha.alternar").map((f) => JSON.parse(f));
  expect(frames).toHaveLength(2);
  for (const f of frames) expect(f.dados).toEqual({ id: "tocha-1" });

  // guardar na mochila (fecha o menu) também pelo teclado
  await p.keyboard.press("ArrowDown");
  await expect.poll(() => emFoco(p)).toBe("menu-token-tocha-guardar-tocha-1");
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("menu-token")).toHaveCount(0);
  await expect.poll(async () => (await alcasDe(p)).length).toBe(0);
  expect(doTipo(m.enviados, "tocha.guardar")).toHaveLength(1);
});

test("o '+N' da presença abre e fecha pelo teclado e o foco continua nele", async ({ mesa }) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  const mais = p.getByTestId("presenca-mais");
  const lista = p.getByTestId("presenca-lista");
  await expect(mais).toBeVisible();
  await expect(mais).toHaveAttribute("aria-expanded", "false");
  await p.keyboard.press("Tab");
  await mais.focus();
  // a dica aparece no foco, com o nome e o que faz
  await expect(p.getByTestId("dica-presenca-mais")).toBeVisible();
  await expect(p.getByTestId("dica-presenca-mais")).toContainText("lista");
  await p.keyboard.press("Enter");
  await expect(lista).toBeVisible();
  await expect(mais).toHaveAttribute("aria-expanded", "true");
  await expect(mais).toBeFocused();
  await p.keyboard.press("Escape");
  await expect(lista).toBeHidden();
  await expect(mais).toHaveAttribute("aria-expanded", "false");
  await expect(mais).toBeFocused();
  // Espaço também abre; Enter de novo fecha
  await p.keyboard.press("Space");
  await expect(lista).toBeVisible();
  await p.keyboard.press("Enter");
  await expect(lista).toBeHidden();
});

function rgbDe(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

for (const tema of ["grimorio", "escuro", "claro"] as const) {
  test(`anel de foco visível nos controles, na cor do tema ${tema}`, async ({ mesa }) => {
    const m = await entrarNoMapa(mesa, "mestre");
    const p = m.pagina;
    await abrirAba(p, "preferencias");
    await p.getByTestId(`tema-${tema}`).check({ force: true });
    await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
    await p.getByTestId("menu-ordem-turno").click();
    await expect(p.getByTestId("janela-ordem")).toBeVisible();
    const esperada = rgbDe(TEMAS[tema].foco);

    // a modalidade de teclado vale desde o primeiro Tab
    await p.keyboard.press("Tab");
    const amostra = [
      "ferramenta-selecionar",
      "menu-cenas",
      "novo-token",
      "aba-chat",
      "aba-mesa",
      "zoom-mais",
      "lateral-recolher",
      "alca-do-painel",
      "janela-ordem-minimizar",
      "presenca-mais",
      "mapa",
    ];
    for (const id of amostra) {
      const alvo = p.getByTestId(id);
      await alvo.focus();
      await expect(alvo, id).toBeFocused();
      const css = await alvo.evaluate((el) => {
        const c = getComputedStyle(el);
        return {
          estilo: c.outlineStyle,
          largura: Number.parseFloat(c.outlineWidth),
          cor: c.outlineColor,
          focoVisivel: el.matches(":focus-visible"),
        };
      });
      expect(css.focoVisivel, `${id} :focus-visible`).toBe(true);
      expect(css.estilo, `${id} outline-style`).not.toBe("none");
      expect(css.largura, `${id} outline-width`).toBeGreaterThanOrEqual(2);
      expect(css.cor, `${id} outline-color`).toBe(esperada);
    }
    // o cabeçalho da janela e o seletor de tema (o rádio fica escondido, o anel é do rótulo)
    await p.getByTestId("janela-ordem").getByRole("toolbar").focus();
    expect(
      await p
        .getByTestId("janela-ordem")
        .getByRole("toolbar")
        .evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe("none");
    await p.getByTestId("tema-grimorio").focus();
    const anelDoTema = await p
      .locator(".opcao-de-tema")
      .first()
      .evaluate((el) => ({
        estilo: getComputedStyle(el).outlineStyle,
        cor: getComputedStyle(el).outlineColor,
      }));
    expect(anelDoTema.estilo).not.toBe("none");
    expect(anelDoTema.cor).toBe(esperada);
  });
}

test("o texto das iniciais fica legível sobre o amarelo do mestre e sobre cores escuras (avatar)", async ({
  mesa,
}) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  const lido = await p
    .getByTestId("presenca-mestre")
    .locator(".avatar")
    .evaluate((el) => {
      const c = getComputedStyle(el);
      return { fundo: c.backgroundColor, texto: c.color };
    });
  const canal = (s: string) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map((v) => {
      const x = (v ?? 0) / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  };
  const [a, b] = [lum(canal(lido.fundo)), lum(canal(lido.texto))].sort((x, y) => y - x);
  expect(((a as number) + 0.05) / ((b as number) + 0.05)).toBeGreaterThanOrEqual(4.5);
  // todos os avatares do topo passam, qualquer que seja a cor do usuário
  const todos = await p.locator(".presenca-avatares .avatar").evaluateAll((els) =>
    els.map((el) => {
      const c = getComputedStyle(el);
      return [c.backgroundColor, c.color];
    }),
  );
  expect(todos.length).toBeGreaterThan(0);
  for (const [fundo, texto] of todos) {
    const [x, y] = [lum(canal(fundo as string)), lum(canal(texto as string))].sort((u, v) => v - u);
    expect(
      ((x as number) + 0.05) / ((y as number) + 0.05),
      `${fundo} / ${texto}`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});
