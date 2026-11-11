import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./ajudas";
import { congelarRelogio, PASSA_DO_ATRASO, passar } from "./ajudasDicas";
import { entrarNoMapa } from "./ajudasMapa";

// V3, item 0 (pedido do Vilella com print): os ícones do topo e as abas do painel têm tamanho e espaçamento iguais.
// No topo, o rótulo do grupo saiu (o nome do grupo vai para a dica de cada botão); nas abas, a largura é a do
// painel dividida pelo número de abas e o nome que não cabe é cortado com reticências (a dica traz o inteiro).

type Caixa = { x: number; y: number; width: number; height: number };

async function caixa(l: Locator): Promise<Caixa> {
  const c = await l.boundingBox();
  if (!c) throw new Error("elemento sem caixa (não está visível)");
  return c;
}

const iguais = (valores: number[], tolerancia = 1) =>
  Math.max(...valores) - Math.min(...valores) <= tolerancia;

const larguraDoPainel = async (p: Page) =>
  Math.round((await caixa(p.getByTestId("barra-lateral"))).width);

/** Os botões do topo do mestre, na ordem da tela, com o grupo de cada um. */
const BOTOES = [
  { testid: "menu-cenas", grupo: "cena", dica: "Cena · Cenas" },
  { testid: "menu-camadas", grupo: "cena", dica: "Cena · Camadas" },
  { testid: "novo-token", grupo: "mapa", dica: "Mapa · Novo token" },
  { testid: "menu-visao-noturna", grupo: "luz", dica: "Luz · Visão noturna" },
  { testid: "menu-iluminacao", grupo: "luz", dica: "Luz · Iluminação" },
  { testid: "menu-ordem-turno", grupo: "combate", dica: "Combate · Ordem de turno" },
  { testid: "menu-ver-como", grupo: "ver-como", dica: "Ver como" },
] as const;

test("topo do mestre: todos os botões com o mesmo tamanho e o mesmo espaço, o mesmo filete entre os grupos e sem rótulo de grupo", async ({
  mesa,
}) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  const caixas: Caixa[] = [];
  for (const b of BOTOES) caixas.push(await caixa(p.getByTestId(b.testid)));

  // mesmo tamanho (largura e altura), e na mesma linha
  expect(iguais(caixas.map((c) => c.width))).toBe(true);
  expect(iguais(caixas.map((c) => c.height))).toBe(true);
  expect(iguais(caixas.map((c) => c.y))).toBe(true);

  // o espaço entre botões do mesmo grupo é igual; o espaço entre grupos também (e é maior: tem o filete)
  const dentroDoGrupo: number[] = [];
  const entreGrupos: number[] = [];
  for (let i = 1; i < BOTOES.length; i++) {
    const anterior = caixas[i - 1] as Caixa;
    const atual = caixas[i] as Caixa;
    const espaco = atual.x - (anterior.x + anterior.width);
    if (BOTOES[i]?.grupo === BOTOES[i - 1]?.grupo) dentroDoGrupo.push(espaco);
    else entreGrupos.push(espaco);
  }
  expect(dentroDoGrupo).toHaveLength(2);
  expect(entreGrupos).toHaveLength(4);
  expect(iguais(dentroDoGrupo), `dentro dos grupos: ${dentroDoGrupo}`).toBe(true);
  expect(iguais(entreGrupos), `entre os grupos: ${entreGrupos}`).toBe(true);
  expect(Math.min(...entreGrupos)).toBeGreaterThan(Math.max(...dentroDoGrupo) + 4);

  // o mesmo filete entre os grupos (todos menos o primeiro) e nenhum rótulo desenhado
  const filetes = await p
    .locator('[data-testid^="menu-grupo-"]')
    .evaluateAll((els) =>
      els.map((e) => `${getComputedStyle(e).borderLeftWidth}|${getComputedStyle(e).paddingLeft}`),
    );
  expect(filetes[0]?.startsWith("0px")).toBe(true);
  expect(new Set(filetes.slice(1)).size).toBe(1);
  expect(filetes[1]?.startsWith("1px")).toBe(true);
  await expect(p.locator(".menu-grupo-nome")).toHaveCount(0);

  // o nome do grupo vai para a dica de cada botão
  for (const b of BOTOES) {
    await p.getByTestId(b.testid).hover();
    await expect(p.getByTestId(`dica-${b.testid}`)).toContainText(b.dica);
    await p.mouse.move(640, 500);
  }

  // continuam dentro do topo (1280 px) e sem cobrir a presença nem a pausa
  const topo = await caixa(p.getByTestId("topo"));
  const menu = await caixa(p.getByTestId("menu-superior"));
  expect(menu.y).toBeGreaterThanOrEqual(topo.y);
  expect(menu.y + menu.height).toBeLessThanOrEqual(topo.y + topo.height + 1);
  for (const testid of ["presenca", "menu-pausa"]) {
    const outro = await caixa(p.getByTestId(testid));
    expect(menu.x + menu.width, `menu antes de ${testid}`).toBeLessThanOrEqual(outro.x + 1);
  }
  const marca = await caixa(p.getByTestId("topo").locator(".topo-marca"));
  expect(marca.x + marca.width).toBeLessThanOrEqual(menu.x + 1);
});

/** As abas do painel: mesma largura, mesma altura, mesmo ícone e o mesmo espaço entre elas. */
async function conferirAbas(p: Page, ids: readonly string[], rotulo: string) {
  const abas: Caixa[] = [];
  for (const id of ids) abas.push(await caixa(p.getByTestId(`aba-${id}`)));
  expect(iguais(abas.map((c) => c.width)), `${rotulo}: larguras ${abas.map((c) => c.width)}`).toBe(
    true,
  );
  expect(iguais(abas.map((c) => c.height)), `${rotulo}: alturas`).toBe(true);
  expect(iguais(abas.map((c) => c.y)), `${rotulo}: mesma linha`).toBe(true);
  const espacos = abas
    .slice(1)
    .map((c, i) => c.x - ((abas[i] as Caixa).x + (abas[i] as Caixa).width));
  expect(iguais(espacos), `${rotulo}: espaços ${espacos}`).toBe(true);
  const icones: Caixa[] = [];
  for (const id of ids)
    icones.push(await caixa(p.getByTestId(`aba-${id}`).locator(".aba-icone svg")));
  expect(iguais(icones.map((c) => c.width)), `${rotulo}: ícones`).toBe(true);
  expect(iguais(icones.map((c) => c.height)), `${rotulo}: ícones`).toBe(true);
  // a largura de cada aba é a do painel dividida pelo número de abas (a lista toda cabe no painel)
  const painel = await caixa(p.getByTestId("barra-lateral"));
  const ultima = abas[abas.length - 1] as Caixa;
  expect(ultima.x + ultima.width).toBeLessThanOrEqual(painel.x + painel.width + 1);
  return abas;
}

test("abas do painel: a mesma largura em 300 px e na largura máxima, nome numa linha, cortado com reticências e a dica com o nome inteiro só onde ele foi cortado", async ({
  mesa,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  const j = (await entrarNoMapa(mesa, "jogador-1")).pagina;
  const nomes: Record<string, string> = {
    chat: "Chat",
    fichas: "Fichas",
    compendio: "Compêndio",
    preferencias: "Preferências",
    mesa: "Mesa",
  };

  for (const [p, quem, ids] of [
    [m, "mestre", ["chat", "fichas", "compendio", "preferencias", "mesa"]],
    [j, "jogador", ["chat", "fichas", "compendio", "preferencias"]],
  ] as const) {
    await congelarRelogio(p);
    await p.getByTestId("alca-do-painel").focus();
    for (const [tecla, largura] of [
      ["Home", 300],
      ["End", null],
    ] as const) {
      await p.keyboard.press(tecla);
      if (largura !== null) await expect.poll(() => larguraDoPainel(p)).toBe(largura);
      else await expect.poll(() => larguraDoPainel(p)).toBeGreaterThan(300);
      const abas = await conferirAbas(p, ids, `${quem} ${tecla}`);

      // cada aba tem a largura do painel dividida pelo número de abas (com os vãos e a folga lateral)
      const painel = await caixa(p.getByTestId("barra-lateral"));
      const media = (painel.width - 12 - 2 * (ids.length - 1)) / ids.length;
      expect(Math.abs((abas[0] as Caixa).width - media)).toBeLessThanOrEqual(1.5);

      for (const id of ids) {
        const nome = p.getByTestId(`aba-nome-${id}`);
        await expect(nome).toHaveText(nomes[id] as string);
        // uma linha só, cortado com reticências
        await expect(nome).toHaveCSS("white-space", "nowrap");
        await expect(nome).toHaveCSS("text-overflow", "ellipsis");
        expect(await nome.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
        // V3b: só o nome que foi cortado tem a dica (com o nome inteiro); o nome inteiro à vista não precisa dela
        const cortado = await nome.evaluate((e) => e.scrollWidth > e.clientWidth);
        await p.getByTestId(`aba-${id}`).hover();
        await passar(p, PASSA_DO_ATRASO);
        const dica = p.getByTestId(`dica-aba-${id}`);
        if (cortado) {
          await expect(
            dica,
            `dica da aba ${id} (${quem} ${tecla}, cortado: ${cortado})`,
          ).toBeVisible();
          await expect(dica).toHaveText(nomes[id] as string);
        } else {
          await expect(
            dica,
            `aba ${id} (${quem} ${tecla}) tem o nome inteiro: sem dica`,
          ).toBeHidden();
        }
        await p.mouse.move(400, 600);
        await passar(p, 500);
      }
    }
    // em 300 px o mestre tem nome cortado (cinco abas); a dica já foi conferida acima para todos
    await p.keyboard.press("Home");
    await expect.poll(() => larguraDoPainel(p)).toBe(300);
    if (quem === "mestre") {
      const cortadas = await Promise.all(
        ids.map((id) =>
          p.getByTestId(`aba-nome-${id}`).evaluate((e) => e.scrollWidth > e.clientWidth),
        ),
      );
      expect(cortadas.some(Boolean), "em 300 px alguma aba do mestre tem o nome cortado").toBe(
        true,
      );
    }
  }
});

test("painel recolhido: só os ícones, todos do mesmo tamanho e com o mesmo espaço", async ({
  mesa,
}) => {
  const m = (await entrarNoMapa(mesa, "mestre")).pagina;
  const ids = ["chat", "fichas", "compendio", "preferencias", "mesa"];
  await m.getByTestId("lateral-recolher").click();
  for (const id of ids) {
    await expect(m.getByTestId(`aba-${id}`)).toBeVisible();
    await expect(m.getByTestId(`aba-nome-${id}`)).toBeHidden();
  }
  const abas: Caixa[] = [];
  for (const id of ids) abas.push(await caixa(m.getByTestId(`aba-${id}`)));
  expect(iguais(abas.map((c) => c.width))).toBe(true);
  expect(iguais(abas.map((c) => c.height))).toBe(true);
  expect(iguais(abas.map((c) => c.x))).toBe(true);
  const espacos = abas
    .slice(1)
    .map((c, i) => c.y - ((abas[i] as Caixa).y + (abas[i] as Caixa).height));
  expect(iguais(espacos), `espaços ${espacos}`).toBe(true);
  const icones: Caixa[] = [];
  for (const id of ids) icones.push(await caixa(m.getByTestId(`aba-${id}`).locator("svg")));
  expect(iguais(icones.map((c) => c.width))).toBe(true);
  // sem nome na tela, a dica diz qual aba é
  await m.getByTestId("aba-preferencias").hover();
  await expect(m.getByTestId("dica-aba-preferencias")).toContainText("Preferências");
});
