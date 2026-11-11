import type { Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { menuDoToken } from "./ajudasCombate";
import {
  abrirPainelDoToken,
  centrarNoToken,
  criarToken,
  doTipo,
  entrarNoMapa,
  esperarPosicao,
  type GanchoDoMapa,
  PX_POR_M,
  pontoNaPagina,
  soSelecionarToken,
  tokenDe,
  tokensDe,
} from "./ajudasMapa";

// R5a: interações no mapa e nos tokens. Esc solta a seleção, o painel do token não abre ao selecionar,
// "Novo token" pede nome e lugar, a tocha tem dica e ações no menu do token, condições com menos
// cliques, régua fixa, aviso perto do clique e o estado vazio do jogador sem token.

const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";

const previa = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.previaDoToken());
const alcasDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas());
const portasDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.portas());

/** Espera dois quadros: a tela já processou o que o teclado ou o mouse acabou de fazer. */
const esperarQuadros = (p: Page) =>
  p.evaluate(
    () => new Promise<void>((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok()))),
  );

const selecionado = async (p: Page, id: string) => (await tokenDe(p, id)).selecionado;

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

test("Esc solta a seleção e fecha o menu de contexto, mas não fecha janela nem age com o foco num campo", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;

  // uma janela aberta (ordem de turno) e um token selecionado, com o menu de contexto aberto
  await p.getByTestId("menu-ordem-turno").click();
  await expect(p.getByTestId("janela-ordem")).toBeVisible();
  await soSelecionarToken(p, "tok-jogador-1");
  await menuDoToken(p, "tok-jogador-1");
  await expect(p.getByTestId("menu-token")).toBeVisible();

  await p.keyboard.press("Escape");
  await expect(p.getByTestId("menu-token")).toHaveCount(0);
  await expect.poll(() => selecionado(p, "tok-jogador-1")).toBe(false);
  // Esc não fecha janela (decisão do R3)
  await esperarQuadros(p);
  await expect(p.getByTestId("janela-ordem")).toBeVisible();

  // com o foco num campo de texto, Esc não solta a seleção
  await soSelecionarToken(p, "tok-jogador-1");
  await p.getByTestId("chat-caixa").locator("textarea").focus();
  await p.keyboard.press("Escape");
  await esperarQuadros(p);
  expect(await selecionado(p, "tok-jogador-1")).toBe(true);
  // fora do campo, o mesmo Esc solta
  await p.getByTestId("chat-caixa").locator("textarea").blur();
  await p.keyboard.press("Escape");
  await expect.poll(() => selecionado(p, "tok-jogador-1")).toBe(false);

  // nada disso foi para a sala
  expect(mestre.enviados.filter((f) => f.includes('"token.'))).toEqual([]);

  // com o foco dentro de uma janela (o painel do token), Esc não solta a seleção nem fecha o painel
  await abrirPainelDoToken(p, "tok-jogador-1");
  await p.getByTestId("janela-token-fechar").focus();
  await p.keyboard.press("Escape");
  await esperarQuadros(p);
  await expect(p.getByTestId("painel-token")).toHaveAttribute("data-token-id", "tok-jogador-1");
  expect(await selecionado(p, "tok-jogador-1")).toBe(true);
});

test("Esc no meio do arrasto de um token o devolve ao lugar de onde saiu", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const antes = await tokenDe(p, "tok-jogador-3");
  const ini = await centrarNoToken(p, "tok-jogador-3");
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  await p.mouse.move(ini.x + 3 * PX_POR_M, ini.y, { steps: 8 });
  await expect.poll(async () => (await tokenDe(p, "tok-jogador-3")).x).toBeGreaterThan(antes.x + 1);
  await p.keyboard.press("Escape");
  await p.mouse.up();
  await esperarPosicao(p, "tok-jogador-3", antes.x, antes.y);
  // o que foi para a sala é só a volta ao lugar de origem
  for (const q of doTipo(mestre.enviados, "token.soltar")) {
    expect(JSON.parse(q).dados).toMatchObject({ id: "tok-jogador-3", x: antes.x, y: antes.y });
  }
  // e a sala continua com a posição de antes
  const j = await entrarNoMapa(mesa, "jogador-3");
  await esperarPosicao(j.pagina, "tok-jogador-3", antes.x, antes.y);
});

test("selecionar só seleciona; o painel do token abre por Editar token… e por dois cliques", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;

  await soSelecionarToken(p, "tok-jogador-1");
  await esperarQuadros(p);
  await expect(p.getByTestId("painel-token")).toHaveCount(0);

  // o menu do botão direito tem "Editar token…"
  await menuDoToken(p, "tok-jogador-2");
  await p.getByTestId("menu-token-editar").click();
  await expect(p.getByTestId("menu-token")).toHaveCount(0);
  await expect(p.getByTestId("painel-token")).toHaveAttribute("data-token-id", "tok-jogador-2");
  await expect(p.getByTestId("token-nome")).toHaveValue("Brisa");
  await expect.poll(() => selecionado(p, "tok-jogador-2")).toBe(true);

  // com o painel aberto, ele segue o token selecionado
  await soSelecionarToken(p, "tok-jogador-3");
  await expect(p.getByTestId("painel-token")).toHaveAttribute("data-token-id", "tok-jogador-3");

  // sem seleção o painel some, e a próxima seleção não o abre sozinha
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("painel-token")).toHaveCount(0);
  await soSelecionarToken(p, "tok-ogro");
  await esperarQuadros(p);
  await expect(p.getByTestId("painel-token")).toHaveCount(0);

  // dois cliques no token abrem
  await abrirPainelDoToken(p, "tok-ogro");
  await expect(p.getByTestId("token-nome")).toHaveValue("Ogro");

  // nada foi para a sala só por selecionar e abrir
  expect(mestre.enviados.filter((f) => f.includes('"token.'))).toEqual([]);
});

test("Novo token pede nome, cor e tamanho; entra no modo de pôr (com prévia) e Esc cancela sem criar nada", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  const antes = (await tokensDe(p)).length;

  await p.getByTestId("novo-token").click();
  await expect(p.getByTestId("novo-token-janela")).toBeVisible();
  await expect(p.getByTestId("novo-token-janela")).toContainText(
    "arraste-o da aba Fichas para o mapa",
  );
  await expect(p.getByTestId("novo-token-nome")).toBeFocused();
  // sem nome não há o que pôr
  await expect(p.getByTestId("novo-token-por")).toBeDisabled();
  await p.getByTestId("novo-token-nome").press("Enter");
  await expect(p.getByTestId("novo-token-janela")).toBeVisible();
  await expect(p.getByTestId("modo-pondo-token-selo")).toHaveCount(0);
  // nada de token "Novo token" criado na hora
  expect((await tokensDe(p)).length).toBe(antes);
  expect(doTipo(mestre.enviados, "token.criar")).toHaveLength(0);

  // nome, cor e tamanho; Enter entra no modo de pôr
  await p.getByTestId("novo-token-nome").fill("Goblin 7");
  await p.getByTitle("Laranja").click();
  await p.getByTestId("novo-token-tamanho").selectOption("2");
  await p.getByTestId("novo-token-nome").press("Enter");
  await expect(p.getByTestId("novo-token-janela")).toHaveCount(0);
  await expect(p.getByTestId("modo-pondo-token-selo")).toContainText("Goblin 7");

  // a prévia só aparece com o cursor sobre o mapa e segue o cursor
  const caixa = await p.getByTestId("mapa").boundingBox();
  if (!caixa) throw new Error("sem mapa");
  await p.mouse.move(caixa.x + 300, caixa.y + 300);
  await expect.poll(() => previa(p)).not.toBeNull();
  const a = await previa(p);
  await p.mouse.move(caixa.x + 520, caixa.y + 300, { steps: 6 });
  await expect.poll(async () => (await previa(p))?.x ?? 0).toBeGreaterThan((a?.x ?? 0) + 1);

  // Esc cancela: nenhum frame de criação, a prévia some e o modo acaba
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("modo-pondo-token-selo")).toHaveCount(0);
  await expect.poll(() => previa(p)).toBeNull();
  await p.mouse.click(caixa.x + 520, caixa.y + 300);
  await esperarQuadros(p);
  expect(doTipo(mestre.enviados, "token.criar")).toHaveLength(0);
  expect((await tokensDe(p)).length).toBe(antes);

  // "Cancelar" no selo faz o mesmo; e o formulário também cancela com o botão
  await p.getByTestId("novo-token").click();
  await p.getByTestId("novo-token-nome").fill("Outro");
  await p.getByTestId("novo-token-cancelar").click();
  await expect(p.getByTestId("novo-token-janela")).toHaveCount(0);
  await p.getByTestId("novo-token").click();
  await p.getByTestId("novo-token-nome").fill("Outro");
  await p.getByTestId("novo-token-nome").press("Enter");
  await p.getByTestId("modo-pondo-token-cancelar").click();
  await expect(p.getByTestId("modo-pondo-token-selo")).toHaveCount(0);
  expect(doTipo(mestre.enviados, "token.criar")).toHaveLength(0);

  // agora de verdade: o clique põe o token, com o nome, a cor e o tamanho pedidos, e o seleciona
  const id = await criarToken(p, "Goblin 7", { tamanho: 2 });
  const criar = doTipo(mestre.enviados, "token.criar");
  expect(criar).toHaveLength(1);
  const token = JSON.parse(criar[0] ?? "{}").dados.token as Record<string, unknown>;
  expect(token).toMatchObject({ id, nome: "Goblin 7", tamanhoQuadrados: 2, camada: "tokens" });
  expect(token.cor).toMatch(/^#[0-9a-f]{6}$/i);
  await expect.poll(() => selecionado(p, id)).toBe(true);
  await expect(p.getByTestId("painel-token")).toHaveCount(0);
  await expect(p.getByTestId("modo-pondo-token-selo")).toHaveCount(0);
  // o jogador vê o token novo
  await expect.poll(async () => (await tokensDe(j1.pagina)).some((t) => t.id === id)).toBe(true);
});

test("a tocha tem dica na alça e as ações dela estão no menu do token, com o mesmo frame dos dois cliques", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 3 });
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-1" });
  const alcas = () => alcasDe(p);
  await expect.poll(async () => (await alcas()).length).toBe(1);
  const a = (await alcas())[0];
  if (!a) throw new Error("sem alça");

  // a dica aparece ao passar o mouse na alça e some ao sair
  await p.mouse.move(a.x, a.y);
  const dica = p.getByTestId("dica-tocha");
  await expect(dica).toBeVisible();
  await expect(dica).toContainText("Dois cliques: apagar ou acender");
  await expect(dica).toContainText("Botão direito: mais ações");
  await p.mouse.move(a.x + 160, a.y + 160);
  await expect(dica).toHaveCount(0);

  // dois cliques apagam: o frame de referência
  await p.mouse.dblclick(a.x, a.y);
  await expect.poll(async () => (await alcas())[0]?.estado).toBe("apagada");
  const dosCliques = JSON.parse(doTipo(mestre.enviados, "tocha.alternar")[0] ?? "{}");
  expect(dosCliques.dados).toEqual({ id: "tocha-1" });

  // o menu do token tem o grupo Tocha: acende pelo menu, com o mesmo frame
  await menuDoToken(p, "tok-jogador-1");
  await expect(p.getByTestId("menu-token-grupo-tocha")).toBeVisible();
  const alternar = p.getByTestId("menu-token-tocha-alternar-tocha-1");
  await expect(alternar).toHaveText("Acender a tocha");
  await alternar.click();
  await expect.poll(async () => (await alcas())[0]?.estado).toBe("acesa");
  // o menu fica aberto e o item agora diz "Apagar"
  await expect(alternar).toHaveText("Apagar a tocha");
  await alternar.click();
  await expect.poll(async () => (await alcas())[0]?.estado).toBe("apagada");
  const frames = doTipo(mestre.enviados, "tocha.alternar").map((f) => JSON.parse(f));
  expect(frames).toHaveLength(3);
  for (const f of frames) expect(f.dados).toEqual(dosCliques.dados);
  expect(frames.every((f) => f.tipo === dosCliques.tipo)).toBe(true);

  // guardar na mochila pelo menu: a alça some e o menu fecha
  await p.getByTestId("menu-token-tocha-guardar-tocha-1").click();
  await expect(p.getByTestId("menu-token")).toHaveCount(0);
  await expect.poll(async () => (await alcas()).length).toBe(0);
  expect(doTipo(mestre.enviados, "tocha.guardar")).toHaveLength(1);

  // sem tocha na mão o grupo não aparece
  await menuDoToken(p, "tok-jogador-1");
  await expect(p.getByTestId("menu-token")).toBeVisible();
  await expect(p.getByTestId("menu-token-grupo-tocha")).toHaveCount(0);
});

test("o jogador dono da tocha também a controla pelo menu do próprio token", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await ok(mestre.pagina, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 1 });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-1" });
  await expect.poll(async () => (await alcasDe(p)).length).toBe(1);
  await menuDoToken(p, "tok-jogador-1");
  await p.getByTestId("menu-token-tocha-alternar-tocha-1").click();
  await expect.poll(async () => (await alcasDe(p))[0]?.estado).toBe("apagada");
  // o jogador não tem "Editar token…"
  await expect(p.getByTestId("menu-token-editar")).toHaveCount(0);
});

/** O marcador `i` do token, com o mapa centrado nele (posição na página). */
async function marcaDe(p: Page, id: string, i: number) {
  const t = await tokenDe(p, id);
  const m = await p.evaluate(
    ([x, y, tid, k]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.centrarEm(x as number, y as number);
      return h.marcaNaPagina(tid as string, k as number);
    },
    [t.x, t.y, id, i],
  );
  if (!m) throw new Error("sem marcador");
  return m;
}

test("condições: duas marcadas pelo menu sem reabrir, e a regra abre por clique no marcador", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;

  // o menu já mostra as condições (sem "Condições…" nem "Fechar") e fica aberto entre as marcações
  await menuDoToken(p, "tok-ogro");
  await expect(p.getByTestId("menu-token-painel-condicoes")).toBeVisible();
  await expect(p.getByTestId("menu-token-condicoes")).toHaveCount(0);
  await expect(p.getByTestId("menu-token-fechar")).toHaveCount(0);
  const caido = p.getByTestId("condicao-caido");
  const cego = p.getByTestId("condicao-cego");
  await caido.click();
  await expect(caido).toHaveAttribute("aria-checked", "true");
  await cego.click();
  await expect(cego).toHaveAttribute("aria-checked", "true");
  await expect(p.getByTestId("menu-token")).toBeVisible();
  await expect.poll(async () => (await tokenDe(p, "tok-ogro")).marcas).toEqual(["Caído", "Cego"]);
  // desmarcar também é um clique
  await caido.click();
  await expect(caido).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => (await tokenDe(p, "tok-ogro")).marcas).toEqual(["Cego"]);
  await caido.click();
  await expect.poll(async () => (await tokenDe(p, "tok-ogro")).marcas).toEqual(["Caído", "Cego"]);
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("menu-token")).toHaveCount(0);

  // a regra abre por clique no marcador e fecha com Esc
  const alvo = await marcaDe(p, "tok-ogro", 0);
  await p.mouse.click(alvo.x, alvo.y);
  const regra = p.getByTestId("regra-condicao");
  await expect(regra).toBeVisible();
  await expect(regra).toContainText("Caído");
  await expect(regra).toContainText("Desvantagem");
  // com a regra aberta, a dica do mouse não fica por cima dela
  await expect(p.getByTestId("dica-condicao")).toHaveCount(0);
  await p.keyboard.press("Escape");
  await expect(regra).toHaveCount(0);

  // abre de novo no segundo marcador e fecha com um clique fora
  const segundo = await marcaDe(p, "tok-ogro", 1);
  await p.mouse.click(segundo.x, segundo.y);
  await expect(regra).toBeVisible();
  await expect(regra).toContainText("Cego");
  await p.mouse.click(segundo.x + 260, segundo.y + 180);
  await expect(regra).toHaveCount(0);

  // clicar no marcador não arrasta o token nem manda nada além das condições
  expect(doTipo(mestre.enviados, "token.soltar")).toHaveLength(0);
  expect(doTipo(mestre.enviados, "token.mover")).toHaveLength(0);
});

test("régua: a medida fica na tela com Fixar (ou Shift ao soltar) e some com Esc, clique nela ou trocando de ferramenta", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await p.getByTestId("ferramenta-regua").click();
  const ini = await p.evaluate(() => {
    const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
    h.centrarEm(24, 24);
    return h.paraTela(24.75, 24.75);
  });
  // cada medida parte de um ponto diferente (apertar sobre uma medida fixa a tira em vez de medir)
  const medir = async (dx: number, dy: number, shift = false, de = { x: 0, y: 0 }) => {
    const x0 = ini.x + de.x;
    const y0 = ini.y + de.y;
    await p.mouse.move(x0, y0);
    await p.mouse.down();
    await p.mouse.move(x0 + dx * PX_POR_M, y0 + dy * PX_POR_M, { steps: 6 });
    if (shift) await p.keyboard.down("Shift");
    await p.mouse.up();
    if (shift) await p.keyboard.up("Shift");
  };

  // solta: a medida continua e há o botão Fixar; fixar a deixa na tela e libera para medir outra
  await medir(4.5, 0, false, { x: 0, y: -150 });
  await expect(p.getByTestId("regua-rotulo")).toHaveText("4,5 m (3 quadrados)");
  await p.getByTestId("regua-fixar").click();
  await expect(p.getByTestId("regua-rotulo")).toHaveCount(0);
  await expect(p.getByTestId("regua-fixa-rotulo")).toHaveText("4,5 m (3 quadrados)");
  await expect(p.getByTestId("regua-fixar")).toHaveCount(0);

  // outra medida (solta, ainda não fixa) convive com a fixa
  await medir(0, 3, false);
  await expect(p.getByTestId("regua-rotulo")).toHaveText("3,0 m (2 quadrados)");
  await expect(p.getByTestId("regua-fixa-rotulo")).toHaveCount(1);

  // Shift ao soltar fixa direto
  await medir(3, 3, true, { x: 260, y: -50 });
  await expect(p.getByTestId("regua-fixa-rotulo")).toHaveCount(2);

  // Esc tira tudo
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("regua-fixa-rotulo")).toHaveCount(0);
  await expect(p.getByTestId("regua-rotulo")).toHaveCount(0);

  // um clique na medida fixa a tira
  await medir(3, 0, true);
  await expect(p.getByTestId("regua-fixa-rotulo")).toHaveCount(1);
  await p.getByTestId("regua-fixa-rotulo").click();
  await expect(p.getByTestId("regua-fixa-rotulo")).toHaveCount(0);

  // trocar de ferramenta também tira
  await medir(3, 0, true);
  await expect(p.getByTestId("regua-fixa-rotulo")).toHaveCount(1);
  await p.keyboard.press("v");
  await expect(p.getByTestId("regua-fixa-rotulo")).toHaveCount(0);

  // a régua continua só da tela de quem mediu
  await expect(j1.pagina.getByTestId("regua-fixa-rotulo")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("regua-rotulo")).toHaveCount(0);
  expect(mestre.enviados.filter((f) => f.includes('"token.'))).toEqual([]);
});

test("o aviso de erro aparece perto do clique, dentro da área do mapa, e um clique o dispensa", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  // o Aldric longe da porta: o clique nela é recusado (fora de alcance)
  await ok(mestre.pagina, "token.soltar", { id: "tok-jogador-1", x: 11.25, y: 30.75 });
  await esperarPosicao(p, "tok-jogador-1", 11.25, 30.75);
  const porta = (await portasDe(p)).find((q) => q.id === "par-sala-porta");
  if (!porta) throw new Error("sem porta");
  await p.evaluate(
    ([x, y]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(
        x as number,
        y as number,
      ),
    [porta.meio.x, porta.meio.y],
  );
  const clique = await pontoNaPagina(p, porta.meio.x, porta.meio.y);
  await p.mouse.click(clique.x, clique.y);

  const aviso = p.getByTestId("aviso");
  await expect(aviso).toHaveAttribute("data-codigo", "fora_de_alcance");
  await expect(aviso).toHaveAttribute("data-origem", "clique");
  const caixa = await aviso.boundingBox();
  const area = await p.getByTestId("area-do-mapa").boundingBox();
  if (!caixa || !area) throw new Error("sem caixa");
  // perto do clique: o ponto do clique fica a no máximo 60 px da caixa, e fora dela (não o cobre)
  const dx = Math.max(caixa.x - clique.x, 0, clique.x - (caixa.x + caixa.width));
  const dy = Math.max(caixa.y - clique.y, 0, clique.y - (caixa.y + caixa.height));
  expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(60);
  expect(dx + dy).toBeGreaterThan(0);
  // dentro da área do mapa, não no rodapé da tela
  expect(caixa.x).toBeGreaterThanOrEqual(area.x);
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(area.x + area.width + 1);
  expect(caixa.y).toBeGreaterThanOrEqual(area.y);
  expect(caixa.y + caixa.height).toBeLessThanOrEqual(area.y + area.height + 1);

  // um clique nele o dispensa
  await aviso.click();
  await expect(aviso).toHaveCount(0);

  // o X do aviso também dispensa (é o caminho do teclado)
  await p.mouse.click(clique.x, clique.y);
  await expect(aviso).toBeVisible();
  await aviso.getByRole("button", { name: "Dispensar o aviso" }).click();
  await expect(aviso).toHaveCount(0);
});

test("jogador sem token na cena vê um estado vazio que explica e some quando o token aparece", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j4 = await entrarNoMapa(mesa, "jogador-4");
  const p = j4.pagina;

  const vazio = p.getByTestId("sem-token");
  await expect(vazio).toBeVisible();
  await expect(vazio).toContainText("Você ainda não tem um personagem nesta cena");
  await expect(vazio).toContainText("Peça ao mestre para pôr o seu token no mapa");
  // no meio da área do mapa
  const caixa = await vazio.boundingBox();
  const area = await p.getByTestId("area-do-mapa").boundingBox();
  if (!caixa || !area) throw new Error("sem caixa");
  expect(Math.abs(caixa.x + caixa.width / 2 - (area.x + area.width / 2))).toBeLessThan(4);
  expect(Math.abs(caixa.y + caixa.height / 2 - (area.y + area.height / 2))).toBeLessThan(4);
  // o mestre não vê isso
  await expect(mestre.pagina.getByTestId("sem-token")).toHaveCount(0);

  // o mestre põe um token controlado pelo jogador 4: o estado vazio some
  await ok(mestre.pagina, "token.criar", {
    cenaId: "cena-1",
    token: {
      id: "tok-jogador-4",
      nome: "Dara",
      cor: "#911eb4",
      tamanhoQuadrados: 1,
      x: 14.25,
      y: 9.75,
      camada: "tokens",
      oculto: false,
      controladoPor: ["jogador-4"],
    },
  });
  await expect(vazio).toHaveCount(0);
  await expect
    .poll(async () => (await tokensDe(p)).some((t) => t.id === "tok-jogador-4"))
    .toBe(true);
});

test("jogador com personagem cujo token não está nesta cena vê a explicação certa", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j3 = await entrarNoMapa(mesa, "jogador-3");
  await expect(j3.pagina.getByTestId("sem-token")).toHaveCount(0);

  // o mestre tira o token do Cael da cena: o personagem existe, mas não está no mapa
  await ok(mestre.pagina, "token.apagar", { id: "tok-jogador-3" });
  const vazio = j3.pagina.getByTestId("sem-token");
  await expect(vazio).toBeVisible();
  await expect(vazio).toContainText("Seu personagem não está nesta cena");
  await expect(vazio).toContainText("Cael");

  // e o personagem na mesma cena de novo (o mestre o coloca pela ficha) faz o aviso sumir
  await ok(mestre.pagina, "personagem.colocar", {
    personagemId: "pers-cael",
    cenaId: "cena-1",
    tokenId: "tok-cael-2",
    x: 14.25,
    y: 12.75,
  });
  await expect(vazio).toHaveCount(0);
});
