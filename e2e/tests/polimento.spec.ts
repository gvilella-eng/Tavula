import type { Locator, Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "./ajudas";
import { ligarOrdem } from "./ajudasCombate";
import { abrirFicha, criarDarion, DARION_ID, mandar } from "./ajudasFicha";
import { entrarNoMapa, type GanchoDoMapa, selecionarToken } from "./ajudasMapa";

// Redesign R6b: tela pequena (1280×720) e os frágeis dos lotes anteriores (ficha estreita, janelas que não se
// cobrem, centro da vista, pílula da pausa), o aviso da pausa sem mestre e as transições discretas.

type Caixa = { x: number; y: number; width: number; height: number };

async function caixa(l: Locator): Promise<Caixa> {
  const c = await l.boundingBox();
  if (!c) throw new Error("elemento sem caixa (não está visível)");
  return c;
}

/** As duas caixas se cobrem em parte? (encostar não conta) */
const sobrepoe = (a: Caixa, b: Caixa) =>
  a.x < b.x + b.width - 0.5 &&
  a.x + a.width > b.x + 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  a.y + a.height > b.y + 0.5;

const janela = (p: Page, id: string) => p.getByTestId(`janela-${id}`);

type Hook = { __tabletop: GanchoDoMapa };
const centrarEm = (p: Page, x: number, y: number) =>
  p.evaluate(([a, b]) => (window as unknown as Hook).__tabletop.centrarEm(a, b), [x, y] as const);
const paraTela = (p: Page, x: number, y: number) =>
  p.evaluate(([a, b]) => (window as unknown as Hook).__tabletop.paraTela(a, b), [x, y] as const);

base("a ficha a 520 px não corta Raça, Antecedente nem Alinhamento", async ({ mesa }) => {
  base.setTimeout(90_000);
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await criarDarion(p);
  const ficha = await abrirFicha(p, DARION_ID, "principal");

  // a ficha abre com 520 px em 1280×720 (o mínimo dela)
  await expect
    .poll(async () => Math.round((await caixa(janela(p, `ficha:${DARION_ID}`))).width))
    .toBe(520);

  // valores longos, de verdade: o texto inteiro tem de caber no campo
  const longos = {
    raca: "Meio-elfo da floresta",
    antecedente: "Artesão de guilda",
    alinhamento: "Caótico e Neutro",
  };
  for (const [campo, valor] of Object.entries(longos)) {
    const c = ficha.getByTestId(`ficha-${campo}`);
    await c.fill(valor);
    await c.press("Enter");
    await c.blur();
    await expect(c).toHaveValue(valor);
  }
  for (const campo of Object.keys(longos)) {
    const c = ficha.getByTestId(`ficha-${campo}`);
    const medidas = await c.evaluate((e) => ({
      rolavel: (e as HTMLInputElement).scrollWidth,
      visivel: (e as HTMLInputElement).clientWidth,
    }));
    expect(medidas.rolavel, `${campo}: o texto passa do campo`).toBe(medidas.visivel);
  }
});

base(
  "em 1280×720 a ordem de turno, a ficha e o painel do token não se cobrem nas posições padrão",
  async ({ mesa }) => {
    base.setTimeout(120_000);
    const p = (await entrarNoMapa(mesa, "mestre")).pagina;
    expect(p.viewportSize()).toEqual({ width: 1280, height: 720 });
    // o painel do token abre antes (as janelas cobririam o centro do mapa)
    await selecionarToken(p, "tok-jogador-1");
    await criarDarion(p);
    await ligarOrdem(p);
    await mandar(p, "combate.adicionar", {
      entradas: [
        { id: "e-aldric", tokenId: "tok-jogador-1" },
        { id: "e-brisa", tokenId: "tok-jogador-2" },
        { id: "e-ogro", tokenId: "tok-ogro" },
        { id: "e-goblin", tokenId: "tok-goblin-oculto" },
      ],
    });
    await expect(p.getByTestId("ordem-entrada")).toHaveCount(4);
    const ficha = await abrirFicha(p, DARION_ID, "principal");

    const confere = async () => {
      const area = await caixa(p.getByTestId("area-do-mapa"));
      const caixas = {
        ordem: await caixa(janela(p, "ordem")),
        ficha: await caixa(ficha),
        token: await caixa(janela(p, "token")),
      };
      for (const [nome, c] of Object.entries(caixas)) {
        expect(c.x, nome).toBeGreaterThanOrEqual(area.x - 1);
        expect(c.y, nome).toBeGreaterThanOrEqual(area.y - 1);
        expect(c.x + c.width, nome).toBeLessThanOrEqual(area.x + area.width + 1);
        expect(c.y + c.height, nome).toBeLessThanOrEqual(area.y + area.height + 1);
      }
      expect(sobrepoe(caixas.ordem, caixas.ficha), "ordem × ficha").toBe(false);
      expect(sobrepoe(caixas.ordem, caixas.token), "ordem × token").toBe(false);
      expect(sobrepoe(caixas.ficha, caixas.token), "ficha × token").toBe(false);
      // o controle de zoom, no canto da área, também fica livre
      const zoom = await caixa(p.getByTestId("zoom-flutuante"));
      expect(sobrepoe(caixas.token, zoom), "token × zoom").toBe(false);
      expect(sobrepoe(caixas.ordem, zoom), "ordem × zoom").toBe(false);
    };
    await confere();

    // a ordem fechada e aberta de novo (agora depois da ficha e do token): continua sem cobrir
    await p.getByTestId("menu-ordem-turno").click();
    await expect(janela(p, "ordem")).toHaveCount(0);
    await ligarOrdem(p);
    await confere();

    // sem o painel do token, a ordem volta a poder crescer (o teto da coluna só vale com os dois abertos)
    const comDivisao = (await caixa(janela(p, "ordem"))).height;
    await janela(p, "token").getByRole("button", { name: "Fechar" }).click();
    await expect(janela(p, "token")).toHaveCount(0);
    await expect
      .poll(async () => (await caixa(janela(p, "ordem"))).height)
      .toBeGreaterThanOrEqual(comDivisao);
  },
);

base("o centro da vista se mantém quando a área do mapa muda de tamanho", async ({ mesa }) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await centrarEm(p, 20, 15);
  const confere = async (rotulo: string) => {
    await expect
      .poll(
        async () => {
          const m = await caixa(p.getByTestId("mapa"));
          const t = await paraTela(p, 20, 15);
          return Math.max(
            Math.abs(t.x - (m.x + m.width / 2)),
            Math.abs(t.y - (m.y + m.height / 2)),
          );
        },
        { message: rotulo },
      )
      .toBeLessThan(2);
  };
  await confere("antes");

  // a alça do painel: o painel mais largo e mais estreito
  const larguraAntes = (await caixa(p.getByTestId("area-do-mapa"))).width;
  await p.getByTestId("alca-do-painel").focus();
  await p.keyboard.press("Home");
  await expect
    .poll(async () => (await caixa(p.getByTestId("area-do-mapa"))).width)
    .toBeGreaterThan(larguraAntes);
  await confere("painel mais estreito");
  await p.keyboard.press("End");
  await expect
    .poll(async () => (await caixa(p.getByTestId("area-do-mapa"))).width)
    .toBeLessThanOrEqual(larguraAntes);
  await confere("painel mais largo");

  // recolher o painel e abri-lo de novo
  await p.getByTestId("lateral-recolher").click();
  await expect
    .poll(async () => (await caixa(p.getByTestId("area-do-mapa"))).width)
    .toBeGreaterThan(larguraAntes + 100);
  await confere("painel recolhido");
  await p.getByTestId("aba-chat").click();
  await confere("painel aberto de novo");

  // a janela do navegador
  await p.setViewportSize({ width: 1100, height: 650 });
  await confere("janela do navegador menor");
  await p.setViewportSize({ width: 1280, height: 720 });
  await confere("janela do navegador de volta");
});

base(
  "a pílula da pausa tem a mesma largura rodando e pausada, e não desloca os avatares",
  async ({ mesa }) => {
    const m = (await entrarNoMapa(mesa, "mestre")).pagina;
    const j = (await entrarNoMapa(mesa, "jogador-1")).pagina;
    const medir = async (p: Page, pilula: string) => ({
      pilula: (await caixa(p.getByTestId(pilula))).width,
      avatar: (await caixa(p.getByTestId("presenca-mestre"))).x,
      estado: (await caixa(p.getByTestId("estado-mesa"))).width,
    });

    const mestreRodando = await medir(m, "menu-pausa");
    const jogadorRodando = await medir(j, "estado-mesa");
    await m.getByTestId("menu-pausa").click();
    await expect(m.getByTestId("estado-mesa-selo")).toBeVisible();
    await expect(j.getByTestId("estado-mesa-selo")).toBeVisible();
    const mestrePausada = await medir(m, "menu-pausa");
    const jogadorPausada = await medir(j, "estado-mesa");

    expect(mestrePausada.pilula).toBeCloseTo(mestreRodando.pilula, 0);
    expect(mestrePausada.avatar).toBeCloseTo(mestreRodando.avatar, 0);
    // o jogador: o espaço da pílula já estava reservado
    expect(jogadorPausada.estado).toBeCloseTo(jogadorRodando.estado, 0);
    expect(jogadorPausada.avatar).toBeCloseTo(jogadorRodando.avatar, 0);
  },
);

base(
  "com a mesa pausada e sem mestre, o jogador recebe o aviso e a dica certa",
  async ({ mesa }) => {
    base.setTimeout(60_000);
    const m = await entrarNoMapa(mesa, "mestre");
    const j = (await entrarNoMapa(mesa, "jogador-1")).pagina;

    // pausa manual, com o mestre na mesa: dica da pausa manual e nenhum aviso
    await m.pagina.getByTestId("menu-pausa").click();
    await expect(j.getByTestId("estado-mesa-selo")).toBeVisible();
    await j.getByTestId("estado-mesa-selo").hover();
    await expect(j.getByTestId("dica-estado-mesa-selo")).toContainText(/^O mestre pausou a mesa/);
    await expect(j.getByTestId("estado-mesa")).toHaveAttribute("data-sem-mestre", "false");
    await expect(j.getByTestId("aviso")).toHaveCount(0);

    // o mestre sai: não há mestre online; o aviso aparece no alto da área do mapa
    await m.pagina.close();
    await expect(j.getByTestId("estado-mesa")).toHaveAttribute("data-sem-mestre", "true");
    await j.getByTestId("estado-mesa-selo").hover();
    await expect(j.getByTestId("dica-estado-mesa-selo")).toContainText(
      "Pausada: o mestre saiu da mesa; ela volta quando o mestre retomar",
    );
    const aviso = j.getByTestId("aviso");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("o mestre saiu");
    await expect(aviso).toHaveAttribute("data-origem", "alto");
    const area = await caixa(j.getByTestId("area-do-mapa"));
    expect((await caixa(aviso)).y - area.y).toBeLessThan(40);
    // a pílula continua sem a palavra (só o ícone e o amarelo)
    await expect(j.getByTestId("estado-mesa-selo")).not.toHaveText(/Pausada/);

    // o mestre volta e retoma: o estado some
    const m2 = await mesa.entrar("mestre");
    await expect(j.getByTestId("estado-mesa")).toHaveAttribute("data-sem-mestre", "false");
    await m2.pagina.getByTestId("menu-pausa").click();
    await expect(j.getByTestId("estado-mesa-selo")).toHaveCount(0);
  },
);

const animacaoDe = (l: Locator) =>
  l.evaluate((e) => {
    const c = getComputedStyle(e);
    return { nome: c.animationName, duracao: c.animationDuration };
  });

base(
  "sem a preferência de menos movimento a interface anima em 140 ms; com ela, nada anima",
  async ({ browser, zerado: _ }) => {
    base.setTimeout(90_000);
    const alvos = async (mesa: Mesa) => {
      const p = (await entrarNoMapa(mesa, "mestre")).pagina;
      await ligarOrdem(p);
      await expect(janela(p, "ordem")).toBeVisible();
      await abrirAba(p, "fichas");
      await p.getByTestId("ferramenta-regua").hover();
      await expect(p.getByTestId("dica-ferramenta-regua")).toBeVisible();
      return {
        janela: await animacaoDe(janela(p, "ordem")),
        aba: await animacaoDe(p.getByTestId("aba-painel-fichas")),
        dica: await animacaoDe(p.getByTestId("dica-ferramenta-regua")),
        canvas: await animacaoDe(p.getByTestId("mapa")),
      };
    };

    const comMovimento = new Mesa(browser, { reducedMotion: "no-preference" });
    const com = await alvos(comMovimento);
    await comMovimento.fechar();
    for (const k of ["janela", "aba", "dica"] as const) {
      expect(com[k].nome, k).toBe("entrada");
      expect(com[k].duracao, k).toBe("0.14s");
    }
    // nada no canvas do mapa
    expect(com.canvas.nome).toBe("none");

    const semMovimento = new Mesa(browser, { reducedMotion: "reduce" });
    const sem = await alvos(semMovimento);
    await semMovimento.fechar();
    for (const k of ["janela", "aba", "dica", "canvas"] as const) {
      expect(sem[k].nome, k).toBe("none");
    }
  },
);
