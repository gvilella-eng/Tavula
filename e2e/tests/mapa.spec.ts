import type { Page } from "@playwright/test";
import {
  abrirAba,
  enviarCru,
  escolherCamada,
  esperarMapa,
  expect,
  intencaoCrua,
  type Mesa,
  menuDaCena,
  type Sessao,
  test,
} from "./ajudas";

// O canvas não é DOM: o gancho `window.__tabletop` (só no modo e2e) dá as posições dos tokens
// visíveis e a conversão mundo -> tela, e o mouse de verdade (`page.mouse`) faz as interações.

type TokenVisto = {
  id: string;
  nome: string;
  x: number;
  y: number;
  tamanho: number;
  oculto: boolean;
  camada: string;
};
type Gancho = {
  tokens(): TokenVisto[];
  paraTela(x: number, y: number): { x: number; y: number };
  zoom(): number;
  definirZoom(z: number): void;
  centrarEm(x: number, y: number): void;
  quadradoM(): number;
};
const PX_POR_M = 40; // igual a PX_POR_M do mapa (zoom 1)

const tokensDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: Gancho }).__tabletop.tokens());

async function tokenDe(p: Page, id: string): Promise<TokenVisto> {
  const t = (await tokensDe(p)).find((x) => x.id === id);
  if (!t) throw new Error(`token ${id} não está visível nesta página`);
  return t;
}

/** Entra, espera o mapa e deixa a vista em zoom 1. */
async function entrarNoMapa(mesa: Mesa, usuario: string): Promise<Sessao> {
  const s = await mesa.entrar(usuario);
  await esperarMapa(s.pagina);
  await s.pagina.evaluate(() =>
    (window as unknown as { __tabletop: Gancho }).__tabletop.definirZoom(1),
  );
  return s;
}

/** Leva o token para o meio da tela (longe das barras flutuantes) e devolve onde ele ficou. */
async function centrarNoToken(p: Page, id: string) {
  const t = await tokenDe(p, id);
  return p.evaluate(
    ([x, y]) => {
      const h = (window as unknown as { __tabletop: Gancho }).__tabletop;
      h.centrarEm(x as number, y as number);
      return h.paraTela(x as number, y as number);
    },
    [t.x, t.y],
  );
}

/** Arrasta o token com o mouse de verdade, `dxM`/`dyM` metros a partir do centro dele. */
async function arrastar(p: Page, id: string, dxM: number, dyM: number, alt = false) {
  const ini = await centrarNoToken(p, id);
  const zoom = await p.evaluate(() =>
    (window as unknown as { __tabletop: Gancho }).__tabletop.zoom(),
  );
  const px = PX_POR_M * zoom;
  if (alt) await p.keyboard.down("Alt");
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  await p.mouse.move(ini.x + dxM * px, ini.y + dyM * px, { steps: 12 });
  await p.mouse.up();
  if (alt) await p.keyboard.up("Alt");
}

async function esperarPosicao(p: Page, id: string, x: number, y: number) {
  await expect
    .poll(async () => {
      const t = await tokenDe(p, id).catch(() => null);
      return t ? [Math.round(t.x * 100) / 100, Math.round(t.y * 100) / 100] : null;
    })
    .toEqual([x, y]);
}

/** Frames de token enviados pela interface (os de `enviarCru` têm id "teste-..."). */
const daUi = (frames: string[]) =>
  frames.filter((f) => f.includes('"token.') && !f.includes('"id":"teste-'));

const contar = (frames: string[], tipo: string) =>
  frames.filter((f) => f.includes(`"tipo":"${tipo}"`)).length;

test("arrastar no mestre move no jogador (e o jogador move o próprio); refresh mantém", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");

  // seed: o Aldric (jogador-1) está em (11.25; 9.75), e o jogador vê só 4 tokens (sem oculto nem do mestre)
  await esperarPosicao(j1.pagina, "tok-jogador-1", 11.25, 9.75);
  expect((await tokensDe(j1.pagina)).map((t) => t.id).sort()).toEqual([
    "tok-jogador-1",
    "tok-jogador-2",
    "tok-jogador-3",
    "tok-ogro",
  ]);
  expect((await tokensDe(mestre.pagina)).length).toBe(6);

  // o mestre arrasta o token do jogador 1: +9 m e +4,5 m (encaixa no centro da célula)
  await arrastar(mestre.pagina, "tok-jogador-1", 9, 4.5);
  await esperarPosicao(mestre.pagina, "tok-jogador-1", 20.25, 14.25);
  await esperarPosicao(j1.pagina, "tok-jogador-1", 20.25, 14.25);
  // selecionar abre o painel do token para o mestre
  await expect(mestre.pagina.getByTestId("token-nome")).toHaveValue("Aldric");

  // o jogador 1 arrasta o próprio token; o mestre vê o mesmo lugar final
  await arrastar(j1.pagina, "tok-jogador-1", -3, 3);
  await esperarPosicao(j1.pagina, "tok-jogador-1", 17.25, 17.25);
  await esperarPosicao(mestre.pagina, "tok-jogador-1", 17.25, 17.25);

  // tamanho 2 (o ogro) encaixa na interseção das linhas
  await arrastar(mestre.pagina, "tok-ogro", 4.4, 0);
  await esperarPosicao(mestre.pagina, "tok-ogro", 34.5, 15);
  await esperarPosicao(j1.pagina, "tok-ogro", 34.5, 15);

  // refresh: as posições gravadas voltam
  await mestre.pagina.reload();
  await j1.pagina.reload();
  await esperarMapa(mestre.pagina);
  await esperarMapa(j1.pagina);
  for (const s of [mestre, j1]) {
    await esperarPosicao(s.pagina, "tok-jogador-1", 17.25, 17.25);
    await esperarPosicao(s.pagina, "tok-ogro", 34.5, 15);
  }
});

test("quem fecha a aba no meio do arraste não deixa o token fora do lugar para os outros", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await esperarPosicao(j1.pagina, "tok-jogador-1", 11.25, 9.75);

  // o mestre começa a arrastar e o jogador vê o movimento ao vivo...
  const ini = await centrarNoToken(mestre.pagina, "tok-jogador-1");
  await mestre.pagina.mouse.move(ini.x, ini.y);
  await mestre.pagina.mouse.down();
  await mestre.pagina.mouse.move(ini.x + 9 * PX_POR_M, ini.y, { steps: 12 });
  await expect.poll(async () => (await tokenDe(j1.pagina, "tok-jogador-1")).x).toBeGreaterThan(15);

  // ...e fecha a aba sem soltar: o jogador volta a ver a posição gravada
  await mestre.contexto.close();
  await esperarPosicao(j1.pagina, "tok-jogador-1", 11.25, 9.75);
});

test("segurar Alt solta o token sem encaixe; a preferência desliga o encaixe", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j2 = await entrarNoMapa(mesa, "jogador-2");

  await arrastar(mestre.pagina, "tok-jogador-2", 4, 2, true);
  await esperarPosicao(mestre.pagina, "tok-jogador-2", 19.75, 11.75);
  await esperarPosicao(j2.pagina, "tok-jogador-2", 19.75, 11.75);

  await abrirAba(mestre.pagina, "preferencias");
  await mestre.pagina.getByTestId("pref-encaixe").uncheck();
  await arrastar(mestre.pagina, "tok-jogador-3", 1, 1);
  await esperarPosicao(mestre.pagina, "tok-jogador-3", 21.25, 10.75);
  await esperarPosicao(j2.pagina, "tok-jogador-3", 21.25, 10.75);
});

test("arrastar continuamente por 5 s envia no máximo ~110 token.mover", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  // sem encaixe, para cada pixel ser uma posição nova (o pior caso para o limitador)
  await abrirAba(mestre.pagina, "preferencias");
  await mestre.pagina.getByTestId("pref-encaixe").uncheck();

  const p = mestre.pagina;
  const centro = await centrarNoToken(p, "tok-jogador-2");
  await p.mouse.move(centro.x, centro.y);
  await p.mouse.down();
  const inicio = Date.now();
  let i = 0;
  while (Date.now() - inicio < 5000) {
    const ang = i++ * 0.12;
    await p.mouse.move(centro.x + 150 * Math.cos(ang), centro.y + 100 * Math.sin(ang));
  }
  await p.mouse.up();

  const mover = contar(mestre.enviados, "token.mover");
  expect(mover).toBeLessThanOrEqual(110);
  expect(mover).toBeGreaterThan(40); // controle: o arraste de fato enviou
  expect(contar(mestre.enviados, "token.soltar")).toBe(1);
  // o outro lado recebeu o movimento ao vivo e termina na posição final exata
  await expect.poll(() => j1.frames.some((f) => f.includes('"tipo":"token.movendo"'))).toBe(true);
  const final = await tokenDe(mestre.pagina, "tok-jogador-2");
  await esperarPosicao(
    j1.pagina,
    "tok-jogador-2",
    Math.round(final.x * 100) / 100,
    Math.round(final.y * 100) / 100,
  );
});

test("frames do jogador nunca têm o token oculto nem o da camada do mestre", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const segredos = [
    "tok-goblin-oculto",
    "Goblin Emboscado",
    "tok-marcador-mestre",
    "Marcador Secreto",
  ];
  const vazou = (frames: string[]) => frames.filter((f) => segredos.some((s) => f.includes(s)));

  // o snapshot do jogador (já recebido) não tem os dois
  expect(vazou(j1.frames)).toEqual([]);
  expect((await tokensDe(mestre.pagina)).map((t) => t.id)).toContain("tok-goblin-oculto");

  // o mestre arrasta o oculto e o da camada do mestre
  await arrastar(mestre.pagina, "tok-goblin-oculto", 3, 3);
  await esperarPosicao(mestre.pagina, "tok-goblin-oculto", 39.75, 21.75);
  await escolherCamada(mestre.pagina, "mestre");
  await arrastar(mestre.pagina, "tok-marcador-mestre", -3, 0);
  await esperarPosicao(mestre.pagina, "tok-marcador-mestre", 27.75, 30.75);
  await escolherCamada(mestre.pagina, "tokens");

  // movimento de token visível chega (controle de que a captura enxerga o movimento)
  await arrastar(mestre.pagina, "tok-jogador-3", 3, 0);
  await esperarPosicao(j1.pagina, "tok-jogador-3", 23.25, 9.75);
  expect(contar(j1.frames, "token.movendo")).toBeGreaterThan(0);

  // esconder o Ogro (visível): o jogador recebe só token.sumiu { id }
  const pos = await centrarNoToken(mestre.pagina, "tok-ogro");
  await mestre.pagina.mouse.click(pos.x, pos.y);
  await expect(mestre.pagina.getByTestId("token-nome")).toHaveValue("Ogro");
  const antes = j1.frames.length;
  await mestre.pagina.getByTestId("token-oculto").click();
  await expect.poll(() => contar(j1.frames, "token.sumiu")).toBe(1);
  const frameSumiu = j1.frames.slice(antes).filter((f) => f.includes('"token.sumiu"'));
  expect(frameSumiu).toHaveLength(1);
  expect(JSON.parse(frameSumiu[0] ?? "{}").dados.dados).toEqual({ id: "tok-ogro" });
  expect(frameSumiu[0]).not.toContain("Ogro");
  expect(
    j1.frames.slice(antes).filter((f) => !f.includes('"token.sumiu"') && f.includes('"evento"')),
  ).toEqual([]);
  await expect
    .poll(async () => (await tokensDe(j1.pagina)).some((t) => t.id === "tok-ogro"))
    .toBe(false);

  // o mestre arrasta o Ogro oculto: nada chega ao jogador
  const antesDoArraste = j1.frames.length;
  await arrastar(mestre.pagina, "tok-ogro", 0, 3);
  await esperarPosicao(mestre.pagina, "tok-ogro", 30, 18);
  expect(j1.frames.slice(antesDoArraste).some((f) => f.includes("tok-ogro"))).toBe(false);

  // revelar: o jogador recebe o token inteiro, já na posição nova
  await mestre.pagina.getByTestId("token-oculto").click();
  await esperarPosicao(j1.pagina, "tok-ogro", 30, 18);

  // reconexão (snapshot novo) e uma edição do oculto: nada vaza
  await j1.pagina.reload();
  await esperarMapa(j1.pagina);
  expect(contar(j1.frames, "snapshot")).toBeGreaterThanOrEqual(2);
  expect(vazou(j1.frames)).toEqual([]);

  // controle: o mestre recebeu os segredos
  expect(vazou(mestre.frames).length).toBeGreaterThan(0);
});

test("o jogador não move token que não controla, nem sem token.moverProprio", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");

  // pelo mouse: o token do jogador 2 não se mexe e nada é enviado
  const alvo = await centrarNoToken(j1.pagina, "tok-jogador-2");
  await j1.pagina.mouse.move(alvo.x, alvo.y);
  await j1.pagina.mouse.down();
  await j1.pagina.mouse.move(alvo.x + 150, alvo.y + 90, { steps: 8 });
  await j1.pagina.mouse.up();
  await esperarPosicao(j1.pagina, "tok-jogador-2", 15.75, 9.75);
  expect(daUi(j1.enviados)).toEqual([]);

  // forçando o envio por fora da interface: a sala recusa
  const naoControla = await enviarCru(
    j1.pagina,
    intencaoCrua("token.soltar", { id: "tok-jogador-2", x: 1, y: 1 }),
  );
  expect(naoControla?.dados.codigo).toBe("sem_permissao");
  const mover = await enviarCru(
    j1.pagina,
    intencaoCrua("token.mover", { id: "tok-jogador-2", x: 1, y: 1 }),
  );
  expect(mover?.dados.codigo).toBe("sem_permissao");
  // token oculto ou do mestre responde como se não existisse (não revela nada)
  for (const id of ["tok-goblin-oculto", "tok-marcador-mestre"]) {
    const r = await enviarCru(j1.pagina, intencaoCrua("token.soltar", { id, x: 1, y: 1 }));
    expect(r?.dados.codigo).toBe("token_inexistente");
  }
  // ações de mestre
  const criar = await enviarCru(j1.pagina, intencaoCrua("token.apagar", { id: "tok-jogador-2" }));
  expect(criar?.dados.codigo).toBe("sem_permissao");
  await esperarPosicao(mestre.pagina, "tok-jogador-2", 15.75, 9.75);

  // o mestre desliga token.moverProprio: o jogador perde até o próprio token
  await abrirAba(mestre.pagina, "mesa");
  await mestre.pagina.getByTestId("perm-padrao-token.moverProprio").click();
  await expect
    .poll(() => j1.frames.some((f) => f.includes('"capacidade":"token.moverProprio"')))
    .toBe(true);
  await j1.pagina.waitForTimeout(200); // o React aplica o evento
  await arrastar(j1.pagina, "tok-jogador-1", 3, 0);
  await j1.pagina.waitForTimeout(300);
  expect((await tokenDe(j1.pagina, "tok-jogador-1")).x).toBe(11.25);
  expect(daUi(j1.enviados)).toEqual([]);
  const proprio = await enviarCru(
    j1.pagina,
    intencaoCrua("token.soltar", { id: "tok-jogador-1", x: 1, y: 1 }),
  );
  expect(proprio?.dados.codigo).toBe("sem_permissao");
  await esperarPosicao(mestre.pagina, "tok-jogador-1", 11.25, 9.75);

  // exceção por usuário devolve o movimento só ao jogador 1
  await mestre.pagina.getByTestId("excecao-usuario").selectOption({ label: "Jogador 1" });
  await mestre.pagina.getByTestId("perm-excecao-token.moverProprio").selectOption("sim");
  await expect.poll(() => j1.frames.some((f) => f.includes('"usuarioId":"jogador-1"'))).toBe(true);
  await j1.pagina.waitForTimeout(200);
  await arrastar(j1.pagina, "tok-jogador-1", 3, 0);
  await esperarPosicao(mestre.pagina, "tok-jogador-1", 14.25, 9.75);
});

test("régua: 3 quadrados = 4,5 m; diagonal conta 1 por quadrado; é local", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;

  await p.getByTestId("ferramenta-regua").click();
  const ini = await p.evaluate(() => {
    const h = (window as unknown as { __tabletop: Gancho }).__tabletop;
    h.centrarEm(24, 24);
    return h.paraTela(24.75, 24.75); // centro de uma célula vazia
  });
  const px = PX_POR_M;
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  await p.mouse.move(ini.x + 4.5 * px, ini.y, { steps: 6 });
  await expect(p.getByTestId("regua-rotulo")).toHaveText("4,5 m (3 quadrados)");
  await p.mouse.up();
  // a medida continua na tela depois de soltar
  await expect(p.getByTestId("regua-rotulo")).toHaveText("4,5 m (3 quadrados)");

  // diagonal: 3 quadrados em cada eixo = 3 quadrados (5e 2014), 6,4 m em linha reta
  await p.mouse.move(ini.x, ini.y);
  await p.mouse.down();
  await p.mouse.move(ini.x + 4.5 * px, ini.y + 4.5 * px, { steps: 6 });
  await expect(p.getByTestId("regua-rotulo")).toHaveText("6,4 m (3 quadrados)");
  await p.mouse.up();

  // a régua é local: o outro usuário não vê nada e nada foi enviado
  await expect(j1.pagina.getByTestId("regua-rotulo")).toHaveCount(0);
  expect(mestre.enviados.filter((f) => f.includes('"token.'))).toEqual([]);

  // Esc limpa; trocar de ferramenta também
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("regua-rotulo")).toHaveCount(0);
});

test("pan (mão), zoom pela roda e pelos botões; atalhos V, H e R", async ({ mesa }) => {
  const s = await entrarNoMapa(mesa, "jogador-3");
  const p = s.pagina;
  const tela = (id: string) =>
    p.evaluate((i) => {
      const h = (window as unknown as { __tabletop: Gancho }).__tabletop;
      const t = h.tokens().find((x) => x.id === i);
      return t ? h.paraTela(t.x, t.y) : null;
    }, id);
  const ferramenta = () =>
    p.evaluate(() =>
      (
        window as unknown as { __tabletop: Gancho & { ferramenta(): string } }
      ).__tabletop.ferramenta(),
    );

  await p.keyboard.press("h");
  expect(await ferramenta()).toBe("mao");
  await p.keyboard.press("r");
  expect(await ferramenta()).toBe("regua");
  await p.keyboard.press("v");
  expect(await ferramenta()).toBe("selecionar");

  // pan com a ferramenta Mão: arrastar numa área vazia leva o mapa junto
  await centrarNoToken(p, "tok-jogador-3");
  const antes = await tela("tok-jogador-3");
  await p.getByTestId("ferramenta-mao").click();
  await p.mouse.move(600, 600);
  await p.mouse.down();
  await p.mouse.move(700, 560, { steps: 5 });
  await p.mouse.up();
  const depois = await tela("tok-jogador-3");
  expect(Math.round((depois?.x ?? 0) - (antes?.x ?? 0))).toBe(100);
  expect(Math.round((depois?.y ?? 0) - (antes?.y ?? 0))).toBe(-40);

  // botão do meio também faz pan
  await p.getByTestId("ferramenta-selecionar").click();
  await p.mouse.move(600, 600);
  await p.mouse.down({ button: "middle" });
  await p.mouse.move(560, 600, { steps: 4 });
  await p.mouse.up({ button: "middle" });
  expect(Math.round(((await tela("tok-jogador-3"))?.x ?? 0) - (depois?.x ?? 0))).toBe(-40);

  // roda: aproxima centrado no cursor (o ponto do mundo sob o cursor não se mexe)
  const zoom0 = await p.evaluate(() =>
    (window as unknown as { __tabletop: Gancho }).__tabletop.zoom(),
  );
  const alvo = (await tela("tok-jogador-3")) ?? { x: 600, y: 400 };
  await p.mouse.move(alvo.x, alvo.y);
  await p.mouse.wheel(0, -400);
  await expect
    .poll(() => p.evaluate(() => (window as unknown as { __tabletop: Gancho }).__tabletop.zoom()))
    .toBeGreaterThan(zoom0 * 1.3);
  const sob = await tela("tok-jogador-3");
  expect(Math.abs((sob?.x ?? 0) - alvo.x)).toBeLessThan(1.5);
  expect(Math.abs((sob?.y ?? 0) - alvo.y)).toBeLessThan(1.5);

  // botões do zoom flutuante e centralizar
  const nivel = async () => p.getByTestId("zoom-nivel").textContent();
  const n0 = await nivel();
  await p.getByTestId("zoom-menos").click();
  await expect.poll(nivel).not.toBe(n0);
  await p.getByTestId("zoom-mais").click();
  await p.getByTestId("zoom-centralizar").click();
  await expect(p.getByTestId("zoom-trilho")).toBeVisible();
});

test("o mestre cria, edita e apaga tokens; camada e grid", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const idsDe = async (p: Page) => (await tokensDe(p)).map((t) => t.id);
  // o jogador não tem as ferramentas do mestre
  await expect(j1.pagina.getByTestId("novo-token")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("camada-mestre")).toHaveCount(0);

  // novo token na camada de tokens: aparece para o jogador
  await mestre.pagina.getByTestId("novo-token").click();
  await expect(mestre.pagina.getByTestId("token-nome")).toHaveValue("Novo token");
  await expect.poll(async () => (await idsDe(j1.pagina)).length).toBe(5);
  const criado = (await tokensDe(mestre.pagina)).find((t) => t.nome === "Novo token");
  expect(criado).toBeTruthy();

  // editar: nome, tamanho, quem controla
  await mestre.pagina.getByTestId("token-nome").fill("Batedor");
  await mestre.pagina.getByTestId("token-nome").press("Enter");
  await mestre.pagina.getByTestId("token-tamanho").selectOption("3");
  await mestre.pagina.getByTestId("token-controla-jogador-1").click();
  await expect
    .poll(async () => (await tokensDe(j1.pagina)).find((t) => t.id === criado?.id)?.nome)
    .toBe("Batedor");
  await expect
    .poll(async () => (await tokensDe(j1.pagina)).find((t) => t.id === criado?.id)?.tamanho)
    .toBe(3);
  // o jogador 1 passa a poder mover esse token (tamanho 3: centro na célula); a permissão chega num
  // evento próprio, depois do nome e do tamanho, então espera por ela antes de arrastar
  await expect
    .poll(() =>
      j1.frames.some(
        (f) => f.includes(criado?.id ?? "") && f.includes('"controladoPor":["jogador-1"]'),
      ),
    )
    .toBe(true);
  await arrastar(j1.pagina, criado?.id ?? "", 3, 0);
  await expect
    .poll(async () => (await tokenDe(mestre.pagina, criado?.id ?? "")).x)
    .toBeGreaterThan((criado?.x ?? 0) + 1);

  // camada do mestre: token novo que o jogador não vê
  await escolherCamada(mestre.pagina, "mestre");
  await mestre.pagina.getByTestId("novo-token").click();
  await expect.poll(async () => (await idsDe(mestre.pagina)).length).toBe(8);
  expect((await idsDe(j1.pagina)).length).toBe(5);

  // apagar
  await mestre.pagina.getByTestId("token-apagar").click();
  await expect.poll(async () => (await idsDe(mestre.pagina)).length).toBe(7);
  await escolherCamada(mestre.pagina, "tokens");
  await centrarNoToken(mestre.pagina, criado?.id ?? "");
  const t = await tokenDe(mestre.pagina, criado?.id ?? "");
  const pos = await mestre.pagina.evaluate(
    ([x, y]) =>
      (window as unknown as { __tabletop: Gancho }).__tabletop.paraTela(x as number, y as number),
    [t.x, t.y],
  );
  await mestre.pagina.mouse.click(pos.x, pos.y);
  await mestre.pagina.getByTestId("token-apagar").click();
  await expect.poll(async () => (await idsDe(j1.pagina)).length).toBe(4);

  // grid da cena (configuração da cena, desde o R4): o quadrado vale para todos
  await menuDaCena(mestre.pagina, "cena-1", "configurar");
  await mestre.pagina.getByTestId("grid-quadrado").fill("3");
  await mestre.pagina.getByTestId("cfg-salvar").click();
  await expect(mestre.pagina.getByTestId("configurar-cena")).toHaveCount(0);
  for (const s of [mestre, j1]) {
    await expect
      .poll(() =>
        s.pagina.evaluate(() =>
          (window as unknown as { __tabletop: Gancho }).__tabletop.quadradoM(),
        ),
      )
      .toBe(3);
  }
  await menuDaCena(mestre.pagina, "cena-1", "configurar");
  await expect(mestre.pagina.getByTestId("cfg-grid-visivel")).toBeChecked();
  await mestre.pagina.getByTestId("cfg-grid-visivel").uncheck();
  await mestre.pagina.getByTestId("cfg-salvar").click();
  await expect
    .poll(() =>
      mestre.enviados.some(
        (f) => f.includes("cena.configurarGrid") && f.includes('"visivel":false'),
      ),
    )
    .toBe(true);
});
