import type { Page } from "@playwright/test";
import {
  CAMINHO_DA_MESA,
  enviarCru,
  esperarMapa,
  expect,
  intencaoCrua,
  test,
  tornarMembros,
} from "./ajudas";
import {
  arrastarToken,
  entrarNoMapa,
  esperarPosicao,
  type GanchoDoMapa,
  soSelecionarToken,
  tokenDe,
} from "./ajudasMapa";

// Q12: sem aviso quando o token bate na parede, setas que andam na hora (a sala confirma depois) e "Seguir meu
// token" (a vista mantém o token no centro da tela). O Aldric (jogador-1) e o Bram (tok-jogador-3) vêm da semente.

const Q = 1.5;

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

const centroDaVista = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centroDaVista());
const paredesDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paredes());

/** A posição do token depois que a animação assentou (duas leituras iguais, com um respiro entre elas). */
async function parado(p: Page, id: string) {
  let ultimo = await tokenDe(p, id);
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(120);
    const agora = await tokenDe(p, id);
    if (agora.x === ultimo.x && agora.y === ultimo.y) return agora;
    ultimo = agora;
  }
  return ultimo;
}

/** O token está no centro da tela (tolerância de ~4 px no zoom 1). */
async function centroNoToken(p: Page, id: string, tolM = 0.1) {
  const t = await tokenDe(p, id);
  const c = await centroDaVista(p);
  return Math.hypot(c.x - t.x, c.y - t.y) <= tolM;
}

/** Entra como o usuário com o WebSocket atravessando um filtro: as mensagens da sala que casam com `atraso()` chegam tarde. */
async function entrarComEcoAtrasado(
  mesa: Parameters<typeof entrarNoMapa>[0],
  usuario: string,
  atraso: () => RegExp | null,
  ms: number,
) {
  const s = await mesa.abrir();
  await s.pagina.routeWebSocket(/\/api\/m\/.*\/ws/, (ws) => {
    const servidor = ws.connectToServer();
    ws.onMessage((m) => servidor.send(m));
    servidor.onMessage((m) => {
      const alvo = atraso();
      if (alvo && typeof m === "string" && alvo.test(m)) setTimeout(() => ws.send(m), ms);
      else ws.send(m);
    });
  });
  await s.pagina.goto(CAMINHO_DA_MESA);
  await s.pagina.getByTestId(`entrar-${usuario}`).click();
  await expect(s.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await esperarMapa(s.pagina);
  await s.pagina.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.definirZoom(1),
  );
  return s;
}

test("o jogador anda contra a parede com as setas e arrastando: o token não passa e nenhum aviso aparece", async ({
  mesa,
  request,
}) => {
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const base = await tokenDe(j1.pagina, "tok-jogador-1");
  await ok(m.pagina, "parede.criar", {
    cenaId: "cena-1",
    paredes: [
      {
        id: "par-q12",
        a: { x: base.x + 0.75, y: base.y - 3 },
        b: { x: base.x + 0.75, y: base.y + 3 },
        tipo: "parede",
      },
    ],
  });
  await expect
    .poll(async () => (await paredesDe(j1.pagina)).some((p) => p.id === "par-q12"))
    .toBe(true);

  // setas: a tela nem tenta o passo (nenhum pedido sai) e o token fica
  await soSelecionarToken(j1.pagina, "tok-jogador-1");
  const antes = j1.enviados.filter((f) => f.includes('"token.soltar"')).length;
  await j1.pagina.keyboard.press("ArrowRight");
  await j1.pagina.keyboard.press("ArrowRight");
  await j1.pagina.waitForTimeout(400);
  expect(j1.enviados.filter((f) => f.includes('"token.soltar"')).length).toBe(antes);
  await esperarPosicao(j1.pagina, "tok-jogador-1", base.x, base.y);
  await expect(j1.pagina.getByTestId("aviso")).toHaveCount(0);

  // arrastar através da parede: o token não passa (fica onde podia estar), nada é solto na sala e não há aviso
  await arrastarToken(j1.pagina, "tok-jogador-1", 3, 0);
  await esperarPosicao(j1.pagina, "tok-jogador-1", base.x, base.y);
  await j1.pagina.waitForTimeout(300);
  expect(j1.enviados.filter((f) => f.includes('"token.soltar"')).length).toBe(antes);
  await esperarPosicao(m.pagina, "tok-jogador-1", base.x, base.y);
  await expect(j1.pagina.getByTestId("aviso")).toHaveCount(0);
});

test("a seta anda o token na hora, antes do eco da sala; segurar anda vários quadrados e soltar para", async ({
  mesa,
  request,
}) => {
  test.setTimeout(90_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  let atrasar: RegExp | null = null;
  const j1 = await entrarComEcoAtrasado(mesa, "jogador-1", () => atrasar, 1_500);
  const base = await tokenDe(j1.pagina, "tok-jogador-1");
  await soSelecionarToken(j1.pagina, "tok-jogador-1");

  // um toque: o token chega ao quadrado seguinte com o eco da sala ainda a caminho
  atrasar = /"token\.movido"/;
  await j1.pagina.keyboard.press("ArrowRight");
  await esperarPosicao(j1.pagina, "tok-jogador-1", base.x + Q, base.y);
  // a sala ainda não mandou: o mestre ainda vê o token no lugar antigo ou já no novo (o eco só atrasa para o jogador)
  await esperarPosicao(m.pagina, "tok-jogador-1", base.x + Q, base.y);

  // segurar 1 s: vários quadrados seguidos (a sala está atrasada 1,5 s, então não é o eco que anda o token)
  const x0 = (await tokenDe(j1.pagina, "tok-jogador-1")).x;
  await j1.pagina.keyboard.down("ArrowRight");
  const t0 = Date.now();
  while (Date.now() - t0 < 1_000) {
    await j1.pagina.keyboard.down("ArrowRight"); // a repetição de tecla do sistema não é o que anda o token
    await j1.pagina.waitForTimeout(40);
  }
  const noSoltar = (await tokenDe(j1.pagina, "tok-jogador-1")).x;
  await j1.pagina.keyboard.up("ArrowRight");
  const andou = Math.round((noSoltar - x0) / Q);
  expect(andou).toBeGreaterThanOrEqual(6);
  expect(andou).toBeLessThanOrEqual(12);

  // soltar a tecla para na hora: o token não anda mais (espera só a animação assentar e confere que nada mais vem)
  await j1.pagina.waitForTimeout(400);
  const parou = Math.round(((await tokenDe(j1.pagina, "tok-jogador-1")).x - x0) / Q);
  await j1.pagina.waitForTimeout(500);
  expect(Math.round(((await tokenDe(j1.pagina, "tok-jogador-1")).x - x0) / Q)).toBe(parou);
  // e a sala, quando responde, acaba no mesmo quadrado
  const destino = (await tokenDe(j1.pagina, "tok-jogador-1")).x;
  await esperarPosicao(m.pagina, "tok-jogador-1", destino, base.y);
});

test("se a sala recusa um passo que a tela já mostrou, o token volta para onde a sala o tem (sem aviso)", async ({
  mesa,
  request,
}) => {
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  let atrasar: RegExp | null = null;
  const j1 = await entrarComEcoAtrasado(mesa, "jogador-1", () => atrasar, 1_500);
  const base = await tokenDe(j1.pagina, "tok-jogador-1");
  await soSelecionarToken(j1.pagina, "tok-jogador-1");

  // a parede nasce na sala mas só chega ao jogador depois: a tela deixa o passo, a sala o recusa
  // (e a recusa da sala também chega tarde, para dar tempo de ver o passo na tela)
  atrasar = /"parede\.criada"|"tipo":"erro"/;
  await ok(m.pagina, "parede.criar", {
    cenaId: "cena-1",
    paredes: [
      {
        id: "par-q12-tarde",
        a: { x: base.x + 0.75, y: base.y - 3 },
        b: { x: base.x + 0.75, y: base.y + 3 },
        tipo: "parede",
      },
    ],
  });
  await j1.pagina.keyboard.press("ArrowRight");
  // por um instante o token aparece no quadrado novo...
  await expect
    .poll(async () => (await tokenDe(j1.pagina, "tok-jogador-1")).x, { timeout: 1_000 })
    .toBeGreaterThan(base.x + 0.5);
  // ...e a recusa da sala o devolve ao lugar de antes
  await esperarPosicao(j1.pagina, "tok-jogador-1", base.x, base.y);
  await expect(j1.pagina.getByTestId("aviso")).toHaveCount(0);
  await esperarPosicao(m.pagina, "tok-jogador-1", base.x, base.y);
});

test("Seguir meu token: o token fica no centro da tela, arrastar a vista desliga, e dois tokens pedem a escolha", async ({
  mesa,
  request,
}) => {
  test.setTimeout(120_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  const botao = p.getByTestId("zoom-seguir");

  // o mestre: segue o token selecionado na hora de ligar
  await soSelecionarToken(m.pagina, "tok-jogador-3");
  await m.pagina.getByTestId("zoom-seguir").click();
  await expect(m.pagina.getByTestId("zoom-seguir")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => centroNoToken(m.pagina, "tok-jogador-3")).toBe(true);
  await m.pagina.getByTestId("zoom-seguir").click();
  await expect(m.pagina.getByTestId("zoom-seguir")).toHaveAttribute("aria-pressed", "false");

  // o jogador com um token só: liga e a vista vai para ele; andando, ele fica no centro
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await expect(p.getByTestId("zoom-seguir-lista")).toHaveCount(0);
  await botao.click();
  await expect(botao).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => centroNoToken(p, "tok-jogador-1")).toBe(true);
  await soSelecionarToken(p, "tok-jogador-1");
  // `soSelecionarToken` leva a vista ao token (o seguir a mantém lá); as setas andam e a vista vai junto
  await expect(botao).toHaveAttribute("aria-pressed", "true");
  for (const tecla of ["ArrowLeft", "ArrowLeft", "ArrowDown", "ArrowDown", "ArrowLeft"]) {
    await p.keyboard.press(tecla);
  }
  await expect.poll(() => centroNoToken(p, "tok-jogador-1")).toBe(true);
  // o mestre move o token do jogador: a vista também acompanha
  const aqui = await parado(p, "tok-jogador-1");
  await ok(m.pagina, "token.soltar", { id: "tok-jogador-1", x: aqui.x + 3, y: aqui.y });
  await esperarPosicao(p, "tok-jogador-1", aqui.x + 3, aqui.y);
  await expect.poll(() => centroNoToken(p, "tok-jogador-1")).toBe(true);
  // o zoom é livre e o token continua no centro
  await p.getByTestId("zoom-mais").click();
  await expect.poll(() => centroNoToken(p, "tok-jogador-1")).toBe(true);

  // arrastar a vista à mão (Espaço + arrastar) desliga o seguir
  await p.getByTestId("mapa").focus();
  const caixa = await p.getByTestId("mapa").boundingBox();
  if (!caixa) throw new Error("o mapa não está visível");
  await p.keyboard.down("Space");
  await p.mouse.move(caixa.x + 300, caixa.y + 300);
  await p.mouse.down();
  await p.mouse.move(caixa.x + 380, caixa.y + 340, { steps: 6 });
  await p.mouse.up();
  await p.keyboard.up("Space");
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  const longe = await centroDaVista(p);
  await ok(m.pagina, "token.soltar", { id: "tok-jogador-1", x: aqui.x + 6, y: aqui.y });
  await esperarPosicao(p, "tok-jogador-1", aqui.x + 6, aqui.y);
  expect(await centroDaVista(p)).toEqual(longe);

  // a tecla F liga e desliga; centralizar o mapa também desliga
  await p.getByTestId("mapa").focus();
  await p.keyboard.press("f");
  await expect(botao).toHaveAttribute("aria-pressed", "true");
  await p.keyboard.press("f");
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await botao.click();
  await expect(botao).toHaveAttribute("aria-pressed", "true");
  await p.getByTestId("zoom-centralizar").click();
  await expect(botao).toHaveAttribute("aria-pressed", "false");

  // dois tokens: a lista aparece ao ligar, a escolha vale e sobrevive ao recarregar
  await ok(m.pagina, "token.criar", {
    cenaId: "cena-1",
    token: {
      id: "tok-corvo-q12",
      nome: "Corvo",
      cor: "#e6194b",
      tamanhoQuadrados: 1,
      x: 30.75,
      y: 9.75,
      camada: "tokens",
      oculto: false,
      controladoPor: ["jogador-1"],
    },
  });
  await expect
    .poll(() =>
      tokenDe(p, "tok-corvo-q12")
        .then((t) => t.x)
        .catch(() => null),
    )
    .toBe(30.75);
  await expect(p.getByTestId("zoom-seguir-lista")).toBeVisible();
  // sem escolha guardada (o jogador nunca escolheu entre os dois), ligar abre a lista em vez de ligar
  await p.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("tabletop:pref:seguir:")) localStorage.removeItem(k);
    }
  });
  await p.reload();
  await esperarMapa(p);
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await botao.click();
  await expect(p.getByTestId("zoom-seguir-menu")).toBeVisible();
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await expect(p.getByTestId("zoom-seguir-menu").getByRole("menuitemradio")).toHaveCount(2);
  await p.getByTestId("zoom-seguir-tok-corvo-q12").click();
  await expect(p.getByTestId("zoom-seguir-menu")).toHaveCount(0);
  await expect(botao).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => centroNoToken(p, "tok-corvo-q12")).toBe(true);
  // a setinha reabre a lista e troca para o outro
  await p.getByTestId("zoom-seguir-lista").click();
  await p.getByTestId("zoom-seguir-tok-jogador-1").click();
  await expect.poll(() => centroNoToken(p, "tok-jogador-1")).toBe(true);
  await p.getByTestId("zoom-seguir-lista").click();
  await p.getByTestId("zoom-seguir-tok-corvo-q12").click();
  await expect.poll(() => centroNoToken(p, "tok-corvo-q12")).toBe(true);

  await p.reload();
  await esperarMapa(p);
  await expect(p.getByTestId("zoom-seguir")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => centroNoToken(p, "tok-corvo-q12")).toBe(true);
});
