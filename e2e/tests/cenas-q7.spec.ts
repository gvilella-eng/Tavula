import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirFaixa,
  abrirPreferencia,
  enviarCru,
  expect,
  intencaoCrua,
  test,
} from "./ajudas";
import {
  arquivoPng,
  assets,
  definirMapa,
  imagensDoMapa,
  metaPorNome,
  pngDeCor,
  pngDeRuido,
} from "./ajudasAssets";
import { entrarNoMapa } from "./ajudasMapa";

// Q7: o painel de cenas em grade (cards iguais, 3 linhas e rolagem, busca, botão direito no vazio, fecha ao clicar
// fora), a troca de cena sem sobrar mapa da anterior, as barras de rolagem do tema e a descrição aberta no chat.

test.describe.configure({ timeout: 180_000 });

const criarCena = (p: Page, id: string, nome: string) =>
  enviarCru(p, intencaoCrua("cena.criar", { id, nome }));

/** Os cards de cena (com número e nome). */
const cards = (p: Page) => p.getByTestId("cena-card");
/** Todos os cards da grade, com "Nova cena" e "Importar mapa". */
const cardsDaGrade = (p: Page) => p.locator(".faixa-lista > .cena-card");

/** As caixas (largura e altura) de todos os cards de cena. */
async function caixasDosCards(p: Page) {
  return cardsDaGrade(p).evaluateAll((els) =>
    els.map((e) => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })),
  );
}

test("trocar de cena com o painel aberto deixa só o mapa da cena nova no palco (cartão e levar o grupo)", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre", { limiteTile: 512 });
  const p = mestre.pagina;
  await criarCena(p, "cena-b", "Taverna");
  // O chão liso: os pedaços do mapa são todos iguais (mesmo arquivo), e cada um precisa do seu lugar.
  await definirMapa(p, "cena-1", arquivoPng("liso.png", pngDeCor(1200, 700, [90, 80, 70])));
  await definirMapa(p, "cena-b", arquivoPng("ruido.png", pngDeRuido(1500, 400, 7, 2)));
  const liso = await metaPorNome(p, "liso.png");
  const ruido = await metaPorNome(p, "ruido.png");
  // Os pedaços de cada mapa (um mapa pequeno é um pedaço só, o próprio arquivo).
  const pedacos = (m: typeof liso) =>
    m.tiles ?? [{ hash: m.hash, x: 0, y: 0, largura: m.largura, altura: m.altura }];
  const noPalco = async () => (await imagensDoMapa(p)).tiles;
  // Só os pedaços do mapa esperado, nos seus lugares, nenhum a mais.
  const soEste = (m: typeof liso) => async () => {
    const t = await noPalco();
    const esperado = pedacos(m);
    return (
      t.length === esperado.length &&
      t.every((s) => esperado.some((e) => e.hash === s.hash)) &&
      new Set(t.map((s) => `${s.x},${s.y}`)).size === t.length
    );
  };

  await abrirFaixa(p);
  const irPara = async (id: string) =>
    p.locator(`[data-testid="cena-card"][data-cena-id="${id}"]`).click();

  await irPara("cena-1");
  await expect.poll(soEste(liso)).toBe(true);
  await irPara("cena-b");
  await expect.poll(soEste(ruido)).toBe(true);
  // A cena do Covil não tem mapa: nenhum pedaço fica no palco.
  await irPara("cena-covil");
  await expect.poll(async () => (await noPalco()).length).toBe(0);

  // Levar o grupo (menu do card) para a cena do mapa liso e depois para a do ruído.
  for (const [id, m] of [
    ["cena-b", ruido],
    ["cena-1", liso],
  ] as const) {
    await p.locator(`[data-testid="cena-card"][data-cena-id="${id}"]`).click({ button: "right" });
    await p.getByTestId("menu-cena-levar").click();
    await expect.poll(soEste(m)).toBe(true);
  }
});

test("todos os cards têm a mesma largura e altura, mesmo com um mapa largo e outro alto", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre", { limiteTile: 512 });
  const p = mestre.pagina;
  await criarCena(p, "cena-larga", "Taverna do Dragão Dourado com um nome muito mais comprido");
  await criarCena(p, "cena-alta", "Torre");
  await definirMapa(p, "cena-larga", arquivoPng("larga.png", pngDeRuido(1800, 200, 3, 4)));
  await definirMapa(p, "cena-alta", arquivoPng("alta.png", pngDeRuido(200, 1800, 5, 4)));
  await abrirFaixa(p);
  await expect(cardsDaGrade(p)).toHaveCount(6); // 4 cenas + Nova cena + Importar mapa
  const caixas = await caixasDosCards(p);
  for (const c of caixas) {
    expect(c.w).toBeCloseTo(caixas[0]?.w ?? 0, 0);
    expect(c.h).toBeCloseTo(caixas[0]?.h ?? 0, 0);
  }
  // O nome longo corta com reticências e aparece inteiro na dica.
  const nome = p.getByTestId("cena-nome-cena-larga");
  expect(await nome.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  await expect(nome).toHaveAttribute(
    "title",
    "Taverna do Dragão Dourado com um nome muito mais comprido",
  );
  // A miniatura preenche o card sem deformar (recorte centralizado).
  await expect(p.getByTestId("cena-previa-cena-larga")).toHaveCSS("object-fit", "cover");
});

test("com muitas cenas a grade quebra em linhas, mostra 3 e rola na vertical, sem rolagem horizontal", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  for (let i = 3; i <= 20; i++) await criarCena(p, `cena-x${i}`, `Sala ${i}`);
  await abrirFaixa(p);
  await expect(cardsDaGrade(p)).toHaveCount(22);
  const lista = p.getByTestId("faixa-lista");
  const medidas = () =>
    lista.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const linhas = new Set<number>();
      for (const c of el.querySelectorAll<HTMLElement>("[data-testid=cena-card]")) {
        const b = c.getBoundingClientRect();
        if (b.top >= r.top - 1 && b.bottom <= r.bottom + 1) linhas.add(Math.round(b.top));
      }
      return {
        linhasVisiveis: linhas.size,
        rolagemV: el.scrollHeight > el.clientHeight,
        rolagemH: el.scrollWidth > el.clientWidth,
        paginaH: document.documentElement.scrollWidth > window.innerWidth,
        scrollTop: el.scrollTop,
      };
    });
  const antes = await medidas();
  expect(antes.linhasVisiveis).toBe(3);
  expect(antes.rolagemV).toBe(true);
  expect(antes.rolagemH).toBe(false);
  expect(antes.paginaH).toBe(false);
  await lista.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect.poll(async () => (await medidas()).scrollTop).toBeGreaterThan(0);
  // O número de cada card é o da ordem real.
  const numeros = await p
    .locator("[data-testid^=cena-numero-]")
    .evaluateAll((els) => els.map((e) => e.textContent));
  expect(numeros).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)));
});

test("a busca acha por parte do nome, sem acento e com um erro de digitação; o número não muda", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarCena(p, "cena-t", "Taverna do Dragão");
  await criarCena(p, "cena-c", "Cripta dos Esquecidos");
  await abrirFaixa(p);
  const busca = p.getByTestId("cenas-busca");
  const ids = () =>
    p
      .locator("[data-testid=cena-card][data-cena-id]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-cena-id")));
  await busca.fill("dragao");
  await expect.poll(ids).toEqual(["cena-t"]);
  await expect(p.getByTestId("cena-numero-cena-t")).toHaveText("3"); // a ordem real
  await busca.fill("esqu");
  await expect.poll(ids).toEqual(["cena-c"]);
  await expect(p.getByTestId("cena-numero-cena-c")).toHaveText("4");
  await busca.fill("tavrna"); // um erro de digitação
  await expect.poll(ids).toEqual(["cena-t"]);
  await busca.fill("nada disso");
  await expect(p.getByTestId("cenas-sem-resultado")).toHaveText("Nenhuma cena com esse nome");
  await expect.poll(ids).toEqual([]);
  // Nova cena e Importar mapa continuam à mão.
  await expect(p.getByTestId("cena-nova")).toBeVisible();
  // Esc limpa a busca; Esc de novo fecha o painel.
  await busca.press("Escape");
  await expect(busca).toHaveValue("");
  await expect(p.getByTestId("faixa-cenas")).toBeVisible();
  await busca.press("Escape");
  await expect(p.getByTestId("faixa-cenas")).toHaveCount(0);
});

test("botão direito no vazio (e Shift+F10) abre Nova cena e Importar mapa, e cada um funciona", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirFaixa(p);
  await expect(cardsDaGrade(p)).toHaveCount(4);

  // O espaço entre dois cards (o vão de 10 px à direita do primeiro).
  const noVao = async () => {
    const lista = (await p.getByTestId("faixa-lista").boundingBox()) as { x: number; y: number };
    const primeiro = (await cards(p).first().boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    await p.mouse.click(primeiro.x + primeiro.width + 5, lista.y + 20, { button: "right" });
  };
  await noVao();
  await expect(p.getByTestId("menu-cena")).toBeVisible();
  await expect(p.getByTestId("menu-cena-nova")).toContainText("Nova cena");
  await expect(p.getByTestId("menu-cena-importar")).toContainText("Importar mapa");
  // Um clique num item do menu não fecha o painel.
  await p.getByTestId("menu-cena-nova").click();
  await expect(cardsDaGrade(p)).toHaveCount(5);
  await expect(p.getByTestId("faixa-cenas")).toBeVisible();

  // Importar abre o seletor de arquivo.
  await noVao();
  const seletor = p.waitForEvent("filechooser");
  await p.getByTestId("menu-cena-importar").click();
  expect((await seletor).isMultiple()).toBe(false);
  await expect(p.getByTestId("faixa-cenas")).toBeVisible();

  // Pelo teclado: Shift+F10 com o foco na grade.
  await p.getByTestId("cena-nova").focus();
  await p.keyboard.press("Shift+F10");
  await expect(p.getByTestId("menu-cena-nova")).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("menu-cena")).toHaveCount(0);
  await expect(p.getByTestId("faixa-cenas")).toBeVisible();

  // No card, o botão direito segue abrindo o menu da cena.
  await cards(p).first().click({ button: "right" });
  await expect(p.getByTestId("menu-cena-duplicar")).toBeVisible();
});

test("clicar fora fecha o painel; o botão da barra alterna; menus e diálogos dele não fecham", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const faixa = p.getByTestId("faixa-cenas");
  await abrirFaixa(p);

  // Clicar no próprio botão fecha (alterna), e de novo abre.
  await p.getByTestId("menu-cenas").click();
  await expect(faixa).toHaveCount(0);
  await p.getByTestId("menu-cenas").click();
  await expect(faixa).toBeVisible();

  // Clicar num card e nos diálogos que ele abriu não fecha.
  await cards(p).nth(1).click();
  await expect(faixa).toBeVisible();
  await cards(p).nth(1).click({ button: "right" });
  await p.getByTestId("menu-cena-apagar").click();
  await expect(p.getByTestId("confirmar-apagar-cena")).toBeVisible();
  await p.getByTestId("confirmar-apagar-cena-nao").click();
  await expect(faixa).toBeVisible();
  await cards(p).nth(1).click({ button: "right" });
  await p.getByTestId("menu-cena-configurar").click();
  await expect(p.getByTestId("configurar-cena")).toBeVisible();
  await p.getByTestId("configurar-cena").click({ position: { x: 10, y: 10 } });
  await expect(faixa).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("configurar-cena")).toHaveCount(0);
  await expect(faixa).toBeVisible();

  // Clicar no mapa fecha.
  await p.mouse.click(500, 550);
  await expect(faixa).toHaveCount(0);
});

test("a barra de rolagem do chat e a do painel de cenas usam as cores do tema", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const cores = (alvo: string) =>
    p.evaluate((seletor) => {
      const el = document.querySelector(seletor) as HTMLElement;
      const sonda = document.createElement("i");
      document.body.append(sonda);
      const lido = (v: string) => {
        sonda.style.color = `var(${v})`;
        return getComputedStyle(sonda).color;
      };
      const r = {
        barra: getComputedStyle(el).scrollbarColor,
        polegar: lido("--rolagem-polegar"),
        trilho: lido("--rolagem-trilho"),
      };
      sonda.remove();
      return r;
    }, alvo);
  const vistos: string[] = [];
  for (const tema of ["grimorio", "vampiro", "claro"]) {
    await abrirPreferencia(p, "aparencia");
    await p.getByTestId(`tema-${tema}`).click();
    await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
    await abrirAba(p, "chat");
    await abrirFaixa(p);
    for (const alvo of ["[data-testid=faixa-lista]", "[data-testid=chat-mensagens]"]) {
      const c = await cores(alvo);
      expect(c.barra, `${tema} ${alvo}`).toBe(`${c.polegar} ${c.trilho}`);
    }
    vistos.push((await cores("[data-testid=faixa-lista]")).polegar);
    await p.getByTestId("menu-cenas").click(); // fecha o painel para o próximo tema
    await expect(p.getByTestId("faixa-cenas")).toHaveCount(0);
  }
  // O polegar muda de um tema para o outro.
  expect(new Set(vistos).size).toBe(3);
});

const SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);

test("o cartão de magia chega ao chat com a descrição aberta; esconder num navegador não esconde no outro", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  await assets(mestre.pagina, "adicionarNaPasta", "compendio/magias.json", SRD);
  await abrirAba(j1.pagina, "compendio");
  await expect(j1.pagina.getByTestId("compendio-lista")).toBeVisible();
  await j1.pagina.getByTestId("compendio-busca").fill("bola");
  await j1.pagina.getByTestId("compendio-item").click();
  await j1.pagina.getByTestId("compendio-como").selectOption({ label: "Aldric" });
  await j1.pagina.getByTestId("compendio-chat").click();
  await expect(j1.pagina.getByTestId("compendio-aviso-acao")).toContainText("Enviada ao chat");

  const mensagem = (p: Page) => p.locator('[data-testid="chat-mensagem"][data-tipo="magia"]');
  for (const alvo of [mestre.pagina, j1.pagina]) {
    await abrirAba(alvo, "chat");
    await expect(mensagem(alvo).getByTestId("magia-chat-descricao")).toContainText(
      "8d6 de dano de fogo",
    );
  }
  // O jogador esconde; o mestre continua vendo aberta (e nenhum frame vai para a sala).
  const enviadosAntes = j1.enviados.length;
  await mensagem(j1.pagina).getByTestId("magia-chat-alternar").click();
  await expect(mensagem(j1.pagina).getByTestId("magia-chat-descricao")).toHaveCount(0);
  await expect(mensagem(mestre.pagina).getByTestId("magia-chat-descricao")).toBeVisible();
  expect(j1.enviados.length).toBe(enviadosAntes);
});
