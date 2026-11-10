import type { Locator, Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "./ajudas";
import { abrirFicha, criarDarion, DARION_ID } from "./ajudasFicha";
import { centrarNoToken, entrarNoMapa, selecionarToken } from "./ajudasMapa";

// Redesign R2: a estrutura fixa da Mesa. Topo de 48 px (até onde começa o painel), barra de ferramentas de
// 52 px, painel direito de cima a baixo com largura ajustável (300 px a 1/4 da janela, por navegador) e,
// no meio, a área do mapa, onde o canvas tem exatamente o tamanho dela. Presença e pausa no topo.

const CHAVE = "tabletop:pref:larguraDoPainel";

const test = base.extend<{ grande: Mesa }>({
  grande: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    await use(mesa);
    await mesa.fechar();
  },
});

type Caixa = { x: number; y: number; width: number; height: number };

async function caixa(l: Locator): Promise<Caixa> {
  const c = await l.boundingBox();
  if (!c) throw new Error("elemento sem caixa (não está visível)");
  return c;
}

const perto = (a: number, b: number, tolerancia = 1.5) => Math.abs(a - b) <= tolerancia;

/** A caixa `c` está inteira dentro de `area` (com folga de 1 px). */
function dentro(c: Caixa, area: Caixa) {
  return (
    c.x >= area.x - 1 &&
    c.y >= area.y - 1 &&
    c.x + c.width <= area.x + area.width + 1 &&
    c.y + c.height <= area.y + area.height + 1
  );
}

const larguraDoPainel = async (p: Page) =>
  Math.round((await caixa(p.getByTestId("barra-lateral"))).width);

/** Arrasta a alça do painel até `x` (px da página), com o mouse de verdade. */
async function arrastarAlca(p: Page, x: number) {
  const a = await caixa(p.getByTestId("alca-do-painel"));
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await p.mouse.down();
  await p.mouse.move(x, a.y + a.height / 2, { steps: 10 });
  await p.mouse.up();
}

const guardada = (p: Page) => p.evaluate((k) => localStorage.getItem(k), CHAVE);

test("as quatro regiões fixas: topo de 48 px até o painel, barra de 52 px, painel de ponta a ponta e o canvas do tamanho da área do mapa", async ({
  mesa,
}) => {
  const s = await entrarNoMapa(mesa, "mestre");
  const p = s.pagina;
  const janela = p.viewportSize() as { width: number; height: number };

  const topo = await caixa(p.getByTestId("topo"));
  const barra = await caixa(p.getByTestId("barra-esquerda"));
  const painel = await caixa(p.getByTestId("barra-lateral"));
  const area = await caixa(p.getByTestId("area-do-mapa"));
  const canvas = await caixa(p.locator('[data-testid="mapa"] canvas'));

  // topo: do canto esquerdo até onde começa o painel, 48 px de altura
  expect(topo).toMatchObject({ x: 0, y: 0, height: 48 });
  expect(perto(topo.x + topo.width, painel.x)).toBe(true);
  // barra de ferramentas: 52 px de largura, abaixo do topo, até o fim da tela
  expect(barra.x).toBe(0);
  expect(barra.width).toBe(52);
  expect(perto(barra.y, 48)).toBe(true);
  expect(perto(barra.y + barra.height, janela.height)).toBe(true);
  // painel: de cima a baixo, colado na borda direita, entre 300 px e 1/4 da janela
  expect(painel.y).toBe(0);
  expect(perto(painel.height, janela.height)).toBe(true);
  expect(perto(painel.x + painel.width, janela.width)).toBe(true);
  expect(painel.width).toBeGreaterThanOrEqual(299);
  expect(painel.width).toBeLessThanOrEqual(Math.max(300, janela.width / 4) + 1);
  // a área do mapa ocupa só o que sobra, e o canvas é do tamanho dela
  expect(perto(area.x, 52)).toBe(true);
  expect(perto(area.y, 48)).toBe(true);
  expect(perto(area.x + area.width, painel.x)).toBe(true);
  expect(perto(area.y + area.height, janela.height)).toBe(true);
  for (const k of ["x", "y", "width", "height"] as const) {
    expect(perto(canvas[k], area[k]), `canvas.${k}: ${canvas[k]} × ${area[k]}`).toBe(true);
  }
  // as barras não se sobrepõem entre si nem ao mapa
  expect(topo.y + topo.height).toBeLessThanOrEqual(area.y + 1);
  expect(barra.x + barra.width).toBeLessThanOrEqual(area.x + 1);
  // a página não rola
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // o nome e o símbolo ficam no topo, com o nome da cena do grupo
  await expect(p.getByTestId("topo").getByTestId("logo")).toContainText("Távola");
  await expect(p.getByTestId("topo-cena")).not.toHaveText("");
});

test("o canvas acompanha a área do mapa: janela, painel ajustado e painel recolhido", async ({
  grande,
}) => {
  const s = await entrarNoMapa(grande, "mestre");
  const p = s.pagina;
  const igual = async () => {
    const area = await caixa(p.getByTestId("area-do-mapa"));
    const canvas = await caixa(p.locator('[data-testid="mapa"] canvas'));
    return [canvas.x, canvas.y, canvas.width, canvas.height].map(Math.round).join(",") ===
      [area.x, area.y, area.width, area.height].map(Math.round).join(",")
      ? "igual"
      : `canvas ${JSON.stringify(canvas)} × área ${JSON.stringify(area)}`;
  };
  await expect.poll(igual).toBe("igual");

  await arrastarAlca(p, 1600 - 300);
  await expect.poll(igual).toBe("igual");

  await p.setViewportSize({ width: 1100, height: 700 });
  await expect.poll(igual).toBe("igual");

  // recolhido, o mapa ganha o espaço: a área vai até a trilha de 52 px
  await p.getByTestId("lateral-recolher").click();
  const painel = await caixa(p.getByTestId("barra-lateral"));
  expect(Math.round(painel.width)).toBe(52);
  await expect.poll(igual).toBe("igual");
  const area = await caixa(p.getByTestId("area-do-mapa"));
  expect(perto(area.x + area.width, painel.x)).toBe(true);
  expect(area.width).toBeGreaterThan(1100 - 52 - 52 - 2);

  // e volta: clicar numa aba abre o painel (não há botão na trilha)
  await p.getByTestId("aba-chat").click();
  await expect(p.getByTestId("alca-do-painel")).toBeVisible();
  await expect.poll(igual).toBe("igual");
});

test("arrastar a alça: mínimo de 300 px, máximo de 1/4 da janela, guardado por navegador e sem frame para a sala", async ({
  grande,
}) => {
  const s = await entrarNoMapa(grande, "mestre");
  const p = s.pagina;
  const alca = p.getByTestId("alca-do-painel");
  await expect(alca).toHaveAttribute("aria-label", "Ajustar a largura do painel");
  await expect(alca).toHaveAttribute("aria-valuemin", "300");
  await expect(alca).toHaveAttribute("aria-valuemax", "400");

  // até o máximo (1600 / 4 = 400)
  const enviadosAntes = s.enviados.length;
  await arrastarAlca(p, 700);
  await expect.poll(() => larguraDoPainel(p)).toBe(400);
  await expect(alca).toHaveAttribute("aria-valuenow", "400");
  expect(await guardada(p)).toBe("400");

  // até o mínimo
  await arrastarAlca(p, 1590);
  await expect.poll(() => larguraDoPainel(p)).toBe(300);
  expect(await guardada(p)).toBe("300");

  // um meio-termo
  await arrastarAlca(p, 1600 - 340);
  await expect.poll(() => larguraDoPainel(p)).toBe(340);
  expect(await guardada(p)).toBe("340");

  // nada disso foi para a sala
  expect(s.enviados.length).toBe(enviadosAntes);

  // fica ao recarregar
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await expect.poll(() => larguraDoPainel(p)).toBe(340);

  // outro navegador (outro contexto, outro usuário) não é afetado: a largura é padrão (360)
  const outro = await entrarNoMapa(grande, "jogador-1");
  expect(await guardada(outro.pagina)).toBeNull();
  await expect.poll(() => larguraDoPainel(outro.pagina)).toBe(360);
  // e o primeiro continua com a dele
  expect(await larguraDoPainel(p)).toBe(340);
});

test("a janela muda de tamanho: o painel se reajusta ao limite de 1/4 (e nunca passa de 300 quando 1/4 é menos)", async ({
  grande,
}) => {
  const s = await entrarNoMapa(grande, "mestre");
  const p = s.pagina;
  await arrastarAlca(p, 700); // 400
  await expect.poll(() => larguraDoPainel(p)).toBe(400);

  await p.setViewportSize({ width: 1200, height: 800 }); // 1/4 = 300
  await expect.poll(() => larguraDoPainel(p)).toBe(300);
  await p.setViewportSize({ width: 900, height: 700 }); // 1/4 = 225: vale o mínimo
  await expect.poll(() => larguraDoPainel(p)).toBe(300);
  await expect(p.getByTestId("alca-do-painel")).toHaveAttribute("aria-valuemax", "300");

  // a escolha da pessoa volta quando a janela cresce
  await p.setViewportSize({ width: 1600, height: 900 });
  await expect.poll(() => larguraDoPainel(p)).toBe(400);
});

test("a alça também funciona pelo teclado", async ({ grande }) => {
  const s = await entrarNoMapa(grande, "mestre");
  const p = s.pagina;
  const alca = p.getByTestId("alca-do-painel");
  const enviadosAntes = s.enviados.length;
  await expect.poll(() => larguraDoPainel(p)).toBe(360);

  await alca.focus();
  await p.keyboard.press("ArrowLeft"); // alarga 16
  await expect.poll(() => larguraDoPainel(p)).toBe(376);
  await p.keyboard.press("ArrowRight"); // estreita 16
  await expect.poll(() => larguraDoPainel(p)).toBe(360);
  await p.keyboard.press("Shift+ArrowRight"); // estreita 64
  await expect.poll(() => larguraDoPainel(p)).toBe(300);
  await p.keyboard.press("ArrowRight"); // já no mínimo
  await expect.poll(() => larguraDoPainel(p)).toBe(300);
  await p.keyboard.press("End");
  await expect.poll(() => larguraDoPainel(p)).toBe(400);
  await p.keyboard.press("ArrowLeft"); // já no máximo
  await expect.poll(() => larguraDoPainel(p)).toBe(400);
  await p.keyboard.press("Home");
  await expect.poll(() => larguraDoPainel(p)).toBe(300);
  expect(await guardada(p)).toBe("300");
  expect(s.enviados.length).toBe(enviadosAntes);
});

test("as abas mostram ícone e nome, legíveis na largura mínima (300 px), do mestre e do jogador", async ({
  mesa,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  const j = (await entrarNoMapa(mesa, "jogador-1")).pagina;
  const nomes: Record<string, string> = {
    chat: "Chat",
    fichas: "Fichas",
    compendio: "Compêndio",
    configuracoes: "Configurações",
    mestre: "Mestre",
  };

  for (const [p, ids] of [
    [m, ["chat", "fichas", "compendio", "configuracoes", "mestre"]],
    [j, ["chat", "fichas", "compendio", "configuracoes"]],
  ] as const) {
    await p.getByTestId("alca-do-painel").focus();
    await p.keyboard.press("Home");
    await expect.poll(() => larguraDoPainel(p)).toBe(300);
    const painel = await caixa(p.getByTestId("barra-lateral"));
    for (const id of ids) {
      const aba = p.getByTestId(`aba-${id}`);
      const nome = p.getByTestId(`aba-nome-${id}`);
      await expect(nome).toBeVisible();
      await expect(nome).toHaveText(nomes[id] as string);
      // o texto cabe inteiro (nada cortado) e a aba está toda dentro do painel
      expect(await nome.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      expect(dentro(await caixa(nome), await caixa(aba))).toBe(true);
      expect(dentro(await caixa(aba), painel)).toBe(true);
      await expect(aba.locator("svg")).toBeVisible(); // o ícone
    }
  }
  // o jogador só vê as dele
  await expect(j.getByTestId("aba-mestre")).toHaveCount(0);
  // a aba escolhida abre e fica marcada
  await m.getByTestId("aba-mestre").click();
  await expect(m.getByTestId("aba-mestre")).toHaveAttribute("aria-selected", "true");
  await expect(m.getByTestId("aba-painel-mestre")).toBeVisible();
});

test("a presença está no topo: um segundo usuário entra e o avatar fica online; quando sai, fica offline", async ({
  mesa,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  const topo = m.getByTestId("topo");
  // a lista de presença saiu do chat
  await abrirAba(m, "chat");
  await expect(m.getByTestId("aba-painel-chat").getByTestId("presenca")).toHaveCount(0);
  await expect(topo.getByTestId("presenca")).toBeVisible();

  // o mestre está online (e é ele); o jogador 1 ainda não entrou: offline, esmaecido
  await expect(m.getByTestId("presenca-estado-mestre")).toHaveText("online");
  await expect(m.getByTestId("presenca-estado-jogador-1")).toHaveText("offline");
  await expect(m.getByTestId("presenca-mestre")).toHaveAttribute("title", /você.*online/);

  const j = await mesa.entrar("jogador-1");
  const avatar = topo.getByTestId("presenca-jogador-1");
  await expect(m.getByTestId("presenca-estado-jogador-1")).toHaveText("online");
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveAttribute("data-estado", "online");
  await expect(avatar).toHaveAttribute("title", /\(jogador\).*online/);
  await expect(avatar.locator(".avatar")).toHaveCSS("opacity", "1");
  // com 8 pessoas na sala o topo mostra os online e um "+N" com o resto
  await expect(m.getByTestId("presenca-mais")).toHaveText(/^\+\d+$/);
  await m.getByTestId("presenca-mais").click();
  await expect(m.getByTestId("presenca-lista")).toBeVisible();
  await expect(m.getByTestId("presenca-lista")).toContainText("offline");
  await m.keyboard.press("Escape");
  await expect(m.getByTestId("presenca-lista")).toBeHidden();

  // o jogador sai: offline
  await j.contexto.close();
  await expect(m.getByTestId("presenca-estado-jogador-1")).toHaveText("offline", {
    timeout: 20_000,
  });
  await expect(m.getByTestId("presenca-jogador-1")).toHaveAttribute("data-estado", "offline");
});

test("a pausa é óbvia no topo, para o mestre e para o jogador", async ({ mesa }) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  const j = (await entrarNoMapa(mesa, "jogador-1")).pagina;

  // rodando: sem selo; o botão do mestre diz "Pausar" e leva o relógio dentro dele
  await expect(j.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "false");
  await expect(j.getByTestId("estado-mesa-selo")).toHaveCount(0);
  await expect(m.getByTestId("menu-pausa")).toHaveAttribute("title", /^Pausar/);
  await expect(m.getByTestId("menu-pausa").getByTestId("relogio-sala")).toHaveAttribute(
    "data-pausada",
    "false",
  );

  await m.getByTestId("menu-pausa").click();
  for (const p of [m, j]) {
    await expect(p.getByTestId("topo").getByTestId("estado-mesa")).toHaveAttribute(
      "data-pausada",
      "true",
    );
    // sem a palavra na tela: o ícone e o amarelo bastam; o nome fica no aria-label
    await expect(p.getByTestId("estado-mesa-selo")).toHaveAttribute("aria-label", "Mesa pausada");
    await expect(p.getByTestId("estado-mesa-selo")).not.toHaveText(/Pausada/);
    await expect(p.getByTestId("estado-mesa-selo")).toBeVisible();
    // a pílula está no topo e a faixa antiga no meio do mapa não existe mais
    expect(
      dentro(await caixa(p.getByTestId("estado-mesa-selo")), await caixa(p.getByTestId("topo"))),
    ).toBe(true);
    await expect(p.getByTestId("selo-pausa")).toHaveCount(0);
  }
  // o jogador: pílula sem clique, com a dica do que houve
  await expect(j.getByTestId("estado-mesa-selo")).toHaveAttribute(
    "title",
    /^O mestre pausou a mesa/,
  );
  await expect(j.getByTestId("estado-mesa-selo")).toHaveCSS("cursor", "auto");
  // o mestre: um controle só, a pílula "Pausada · relógio" que retoma; o relógio está dentro dele
  await expect(m.getByTestId("menu-pausa")).toHaveAttribute("title", /^Retomar/);
  await expect(m.getByTestId("menu-pausa").getByTestId("estado-mesa-selo")).toHaveAttribute(
    "aria-label",
    "Mesa pausada",
  );
  await expect(m.getByTestId("menu-pausa")).toContainText(/[0-9]/);
  await expect(m.getByTestId("menu-pausa").getByTestId("relogio-sala")).toBeVisible();
  await expect(m.getByTestId("relogio-sala")).toHaveAttribute("data-pausada", "true");
  const corRodando = "rgb(237, 237, 237)"; // --texto do Grimório (Carvão)
  await expect(m.getByTestId("menu-pausa")).not.toHaveCSS("color", corRodando);
  // o jogador não tem o botão nem o relógio
  await expect(j.getByTestId("menu-pausa")).toHaveCount(0);

  await m.getByTestId("menu-pausa").click();
  await expect(j.getByTestId("estado-mesa-selo")).toHaveCount(0);
  await expect(j.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "false");
  await expect(m.getByTestId("estado-mesa-selo")).toHaveCount(0);
  await expect(m.getByTestId("menu-pausa").getByTestId("relogio-sala")).toBeVisible();
});

test("o zoom fica no canto inferior direito da área do mapa, nunca embaixo do painel", async ({
  grande,
}) => {
  const s = await entrarNoMapa(grande, "jogador-1");
  const p = s.pagina;
  const zoom = p.getByTestId("zoom-flutuante");
  const conferir = async () => {
    const area = await caixa(p.getByTestId("area-do-mapa"));
    const z = await caixa(zoom);
    const painel = await caixa(p.getByTestId("barra-lateral"));
    expect(dentro(z, area)).toBe(true);
    expect(z.x + z.width).toBeLessThanOrEqual(painel.x + 1);
    // no canto: encostado (12 px) embaixo e à direita da área
    expect(perto(area.x + area.width - (z.x + z.width), 12, 2)).toBe(true);
    expect(perto(area.y + area.height - (z.y + z.height), 12, 2)).toBe(true);
  };
  await conferir();
  await arrastarAlca(p, 700); // painel largo
  await expect.poll(() => larguraDoPainel(p)).toBe(400);
  await conferir();
  await p.getByTestId("alca-do-painel").focus();
  await p.keyboard.press("Home"); // painel estreito
  await expect.poll(() => larguraDoPainel(p)).toBe(300);
  await conferir();
  await p.getByTestId("lateral-recolher").click(); // recolhido
  await expect.poll(() => larguraDoPainel(p)).toBe(52);
  await conferir();
  // continua funcionando
  await p.getByTestId("zoom-mais").click();
  await expect(p.getByTestId("zoom-nivel")).not.toHaveText("100%");
});

test("centralizar considera só a área visível: o token e o mapa vão para o centro da área, com o painel estreito e largo", async ({
  grande,
}) => {
  const s = await entrarNoMapa(grande, "mestre");
  const p = s.pagina;
  const centroDaArea = async () => {
    const a = await caixa(p.getByTestId("area-do-mapa"));
    return { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  };

  for (const tecla of ["Home", "End"]) {
    await p.getByTestId("alca-do-painel").focus();
    await p.keyboard.press(tecla);
    await expect.poll(() => larguraDoPainel(p)).toBe(tecla === "Home" ? 300 : 400);
    // o canvas já tem o tamanho novo antes de centralizar
    await expect
      .poll(async () => Math.round((await caixa(p.locator('[data-testid="mapa"] canvas'))).width))
      .toBe(Math.round((await caixa(p.getByTestId("area-do-mapa"))).width));

    // no token
    const t = await centrarNoToken(p, "tok-jogador-1");
    const c = await centroDaArea();
    expect(perto(t.x, c.x, 2), `x do token ${t.x} × centro ${c.x}`).toBe(true);
    expect(perto(t.y, c.y, 2), `y do token ${t.y} × centro ${c.y}`).toBe(true);

    // "Centralizar o mapa": a cena inteira, no centro da área
    await p.getByTestId("zoom-centralizar").click();
    const meio = await p.evaluate(() => {
      const h = (
        window as unknown as {
          __tabletop: { paraTela(x: number, y: number): { x: number; y: number } };
        }
      ).__tabletop;
      return h.paraTela(30, 22.5); // o centro da Cena inicial (60 × 45 m)
    });
    const c2 = await centroDaArea();
    expect(perto(meio.x, c2.x, 2), `x da cena ${meio.x} × centro ${c2.x}`).toBe(true);
    expect(perto(meio.y, c2.y, 2), `y da cena ${meio.y} × centro ${c2.y}`).toBe(true);
  }
});

test("em 1280×720 tudo o que abre sobre o mapa fica dentro da área, sem cobrir as barras", async ({
  mesa,
  request,
}) => {
  test.setTimeout(90_000);
  expect((await request.post("/teste/dados?semente=5")).ok()).toBe(true);
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  await criarDarion(m);
  const area = async () => caixa(m.getByTestId("area-do-mapa"));
  const naArea = async (id: string) => {
    const a = await area();
    const c = await caixa(m.getByTestId(id));
    expect(dentro(c, a), `${id}: ${JSON.stringify(c)} fora da área ${JSON.stringify(a)}`).toBe(
      true,
    );
  };

  // ordem de turno
  await m.getByTestId("menu-ordem-turno").click();
  await expect(m.getByTestId("ordem-de-turno")).toBeVisible();
  await naArea("ordem-de-turno");

  // painel do token (o token é selecionado com o mouse de verdade)
  await selecionarToken(m, "tok-jogador-1");
  await naArea("painel-token");
  await naArea("zoom-flutuante");

  // faixa de cenas
  await m.getByTestId("menu-cenas").click();
  await expect(m.getByTestId("faixa-cenas")).toBeVisible();
  await naArea("faixa-cenas");
  await m.getByTestId("menu-cenas").click();

  // iluminação: fontes de luz, paredes e configurações
  await m.getByTestId("menu-iluminacao").click();
  await m.getByTestId("lanterna-fontes").click();
  await expect(m.getByTestId("painel-fontes")).toBeVisible();
  await naArea("painel-fontes");
  await m.getByTestId("menu-iluminacao").click();
  await m.getByTestId("lanterna-config").click();
  await expect(m.getByTestId("painel-config-iluminacao")).toBeVisible();
  await naArea("painel-config-iluminacao");
  await m.getByTestId("config-fechar").click(); // ele cobre o centro do mapa
  await m.getByTestId("painel-fontes-fechar").click(); // abre sobre o mesmo canto das paredes
  await m.getByTestId("menu-iluminacao").click();
  await m.getByTestId("lanterna-paredes").click();
  await expect(m.getByTestId("painel-paredes")).toBeVisible();
  await naArea("painel-paredes");
  await m.getByTestId("paredes-fechar").click(); // o clique direito no token só vale fora do modo paredes

  // dados rápidos e sub-barra do pincel abrem ao lado da barra de ferramentas, sobre o mapa
  await m.getByTestId("ferramenta-dados").click();
  await expect(m.getByTestId("dados-rapidos")).toBeVisible();
  const barra = await caixa(m.getByTestId("barra-esquerda"));
  const dados = await caixa(m.getByTestId("dados-rapidos"));
  expect(dados.x).toBeGreaterThanOrEqual(barra.x + barra.width - 1);
  await m.getByTestId("ferramenta-dados").click();
  await m.getByTestId("ferramenta-pincel").click();
  await expect(m.getByTestId("sub-barra-pincel")).toBeVisible();
  const sub = await caixa(m.getByTestId("sub-barra-pincel"));
  expect(sub.x).toBeGreaterThanOrEqual(barra.x + barra.width - 1);
  expect(await dentroDaJanela(m, sub)).toBe(true);
  expect(sub.y).toBeGreaterThanOrEqual(48 - 1);
  await m.getByTestId("pincel-fechar").click();

  // a janela da ficha
  const ficha = await abrirFicha(m, DARION_ID, "principal");
  await expect(ficha).toBeVisible();
  await naArea("janela-ficha");
  // arrastada para longe, ainda não passa por cima das barras (a janela é cortada pela área)
  const cab = await caixa(m.getByTestId("janela-ficha-cabecalho"));
  await m.mouse.move(cab.x + 200, cab.y + 10);
  await m.mouse.down();
  await m.mouse.move(cab.x + 900, cab.y - 400, { steps: 8 });
  await m.mouse.up();
  const a = await area();
  const f = await caixa(m.getByTestId("janela-ficha"));
  expect(f.y).toBeGreaterThanOrEqual(a.y - 1);
  const visivel = {
    x: Math.max(f.x, a.x),
    right: Math.min(f.x + f.width, a.x + a.width),
  };
  expect(visivel.right - visivel.x).toBeGreaterThanOrEqual(79);

  // o menu do botão direito no token abre dentro da área
  await m.getByTestId("janela-ficha-fechar").click();
  const t = await centrarNoToken(m, "tok-jogador-1");
  await m.mouse.click(t.x, t.y, { button: "right" });
  await expect(m.getByTestId("menu-token")).toBeVisible();
  await naArea("menu-token");
});

async function dentroDaJanela(p: Page, c: Caixa) {
  const j = p.viewportSize() as { width: number; height: number };
  return c.x >= 0 && c.y >= 0 && c.x + c.width <= j.width + 1 && c.y + c.height <= j.height + 1;
}

test("recolhido, o painel mostra só os ícones das abas; clicar numa aba abre o painel nela", async ({
  mesa,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  await expect(m.getByTestId("aba-painel-chat")).toBeVisible();
  await m.getByTestId("lateral-recolher").click();

  // a trilha tem 52 px e nada do conteúdo (nem o chat) está na tela; não há botão de abrir na trilha
  const trilha = await caixa(m.getByTestId("barra-lateral"));
  expect(Math.round(trilha.width)).toBe(52);
  await expect(m.getByTestId("lateral-recolher")).toHaveCount(0);
  for (const id of ["chat", "fichas", "compendio", "configuracoes", "mestre"]) {
    await expect(m.getByTestId(`aba-painel-${id}`)).toBeHidden();
    await expect(m.getByTestId(`aba-nome-${id}`)).toBeHidden();
    await expect(m.getByTestId(`aba-${id}`)).toBeVisible();
  }
  await expect(m.getByTestId("chat-texto")).toBeHidden();
  await expect(m.getByTestId("chat-mensagens")).toBeHidden();
  await expect(m.getByTestId("alca-do-painel")).toHaveCount(0);
  // nada dentro da trilha passa dos 52 px
  const fora = await m.getByTestId("barra-lateral").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [...el.querySelectorAll("*")].some((e) => {
      const b = e.getBoundingClientRect();
      return b.width > 0 && (b.left < r.left - 1 || b.right > r.right + 1);
    });
  });
  expect(fora).toBe(false);

  // clicar em Fichas abre o painel já na aba Fichas
  await m.getByTestId("aba-fichas").click();
  await expect(m.getByTestId("aba-painel-fichas")).toBeVisible();
  await expect(m.getByTestId("aba-fichas")).toHaveAttribute("aria-selected", "true");
  await expect(m.getByTestId("aba-painel-chat")).toBeHidden();
  expect((await caixa(m.getByTestId("barra-lateral"))).width).toBeGreaterThanOrEqual(299);
  await expect(m.getByTestId("alca-do-painel")).toBeVisible();
});
