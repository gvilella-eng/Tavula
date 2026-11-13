import type { Locator, Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, expect, test } from "./ajudas";
import { ATRASO_DA_DICA, congelarRelogio, PASSA_DO_ATRASO, passar } from "./ajudasDicas";
import { entrarNoMapa } from "./ajudasMapa";

// V3b: dicas enxutas. Só onde o controle não tem nome à vista, de uma linha, com atraso (700 ms no mouse, na
// hora no foco do teclado), "Nome — motivo" no desabilitado e uma opção para desligar (por navegador).

const CHAVE = "tabletop:pref:dicas";

const guardada = (p: Page) => p.evaluate((c) => localStorage.getItem(c), CHAVE);
const teclasDa = (dica: Locator) => dica.locator("kbd").allTextContents();

test("botão só de ícone: a dica vem depois de 700 ms, em uma linha, com o atalho", async ({
  mesa,
}) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await congelarRelogio(p);

  const dica = p.getByTestId("dica-ferramenta-regua");
  await p.getByTestId("ferramenta-regua").hover();
  await passar(p, ATRASO_DA_DICA - 50);
  await expect(dica).toBeHidden();
  await passar(p, 100);
  await expect(dica).toBeVisible();
  await expect(dica).toContainText("Régua");
  expect(await teclasDa(dica)).toEqual(["R"]);
  // uma linha só: sem segunda linha de explicação, e a caixa tem a altura de uma linha de texto
  await expect(dica.locator(".dica-texto")).toHaveCount(0);
  const altura = await dica.evaluate((e) => e.getBoundingClientRect().height);
  expect(altura).toBeLessThan(40);

  // sair antes do atraso cancela
  await p.mouse.move(700, 500);
  await expect(dica).toBeHidden();
  await p.getByTestId("ferramenta-mao").hover();
  await passar(p, 300);
  await p.mouse.move(700, 500);
  await passar(p, ATRASO_DA_DICA);
  await expect(p.getByTestId("dica-ferramenta-mao")).toBeHidden();
});

test("com uma dica aberta, passar a outro botão mostra a próxima na hora", async ({ mesa }) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await congelarRelogio(p);

  await p.getByTestId("ferramenta-regua").hover();
  await passar(p, PASSA_DO_ATRASO);
  await expect(p.getByTestId("dica-ferramenta-regua")).toBeVisible();

  await p.getByTestId("ferramenta-mao").hover();
  // sem deixar o tempo correr
  await expect(p.getByTestId("dica-ferramenta-mao")).toBeVisible();
  await expect(p.getByTestId("dica-ferramenta-regua")).toBeHidden();

  // longe dos botões, passado um tempo, a próxima dica espera de novo
  await p.mouse.move(700, 500);
  await passar(p, 1000);
  await p.getByTestId("ferramenta-selecionar").hover();
  await passar(p, 300);
  await expect(p.getByTestId("dica-ferramenta-selecionar")).toBeHidden();
});

test("no foco pelo teclado a dica aparece na hora", async ({ mesa }) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await congelarRelogio(p);

  await p.getByTestId("ferramenta-selecionar").focus();
  await p.keyboard.press("Tab");
  await expect(p.getByTestId("ferramenta-mao")).toBeFocused();
  await expect(p.getByTestId("dica-ferramenta-mao")).toBeVisible();
  expect(await teclasDa(p.getByTestId("dica-ferramenta-mao"))).toEqual(["H"]);
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("dica-ferramenta-mao")).toBeHidden();
});

test("aba com o nome inteiro e botão com texto não têm dica nem title; aba cortada tem", async ({
  mesa,
}) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await abrirAba(p, "fichas");
  await congelarRelogio(p);

  // botão com texto (item da lista de Fichas)
  const item = p.getByTestId("ficha-abrir-pers-aldric");
  await expect(item).not.toHaveAttribute("title", /.+/);
  await item.hover();
  await passar(p, PASSA_DO_ATRASO * 2);
  await expect(p.getByTestId("dica-ficha-abrir-pers-aldric")).toHaveCount(0);
  await p.mouse.move(700, 500);

  // painel no mínimo (300 px): o mestre tem aba cortada
  await p.getByTestId("alca-do-painel").focus();
  await p.keyboard.press("Home");
  const ids = ["chat", "fichas", "compendio", "preferencias", "mesa"];
  let cortadas = 0;
  for (const id of ids) {
    const nome = p.getByTestId(`aba-nome-${id}`);
    const cortada = await nome.evaluate((e) => e.scrollWidth > e.clientWidth);
    const aba = p.getByTestId(`aba-${id}`);
    await expect(aba).not.toHaveAttribute("title", /.+/);
    await aba.hover();
    await passar(p, PASSA_DO_ATRASO);
    const dica = p.getByTestId(`dica-aba-${id}`);
    if (cortada) {
      cortadas++;
      await expect(dica).toBeVisible();
      await expect(dica.locator("strong")).toHaveText((await nome.textContent()) ?? "");
    } else {
      await expect(dica).toBeHidden();
    }
    await p.mouse.move(400, 600);
    await passar(p, 500);
  }
  expect(cortadas, "em 300 px o mestre tem alguma aba cortada").toBeGreaterThan(0);
  expect(cortadas).toBeLessThan(ids.length);
});

test("botão desabilitado mostra 'Nome — motivo'", async ({ mesa }) => {
  const p = (await entrarNoMapa(mesa, "mestre")).pagina;
  await p.getByTestId("menu-ordem-turno").click();
  await expect(p.getByTestId("janela-ordem")).toBeVisible();
  await congelarRelogio(p);

  const ordenar = p.getByTestId("ordem-ordenar");
  await expect(ordenar).toHaveAttribute("aria-disabled", "true");
  await ordenar.hover();
  await passar(p, PASSA_DO_ATRASO);
  const dica = p.getByTestId("dica-ordem-ordenar");
  await expect(dica).toBeVisible();
  await expect(dica).toHaveText("Ordenar pela iniciativa — A lista está vazia");
  await expect(dica).toHaveAttribute("data-motivo", "true");
});

test("com as dicas desligadas nada aparece no mouse nem no foco, e o clique no desabilitado mostra o motivo", async ({
  mesa,
}) => {
  const s = await entrarNoMapa(mesa, "mestre");
  const p = s.pagina;
  await abrirPreferencia(p, "mapa");
  const opcao = p.getByTestId("pref-dicas");
  await expect(opcao).toBeChecked();
  expect(await guardada(p)).toBeNull();

  const enviadosAntes = s.enviados.length;
  await opcao.uncheck();
  await expect.poll(() => guardada(p)).toBe("0");
  expect(s.enviados.length).toBe(enviadosAntes);
  // a lista de atalhos continua, e os botões continuam com nome e atalho para o leitor de tela
  await abrirPreferencia(p, "atalhos");
  await expect(p.getByTestId("atalhos")).toBeVisible();
  await expect(p.getByTestId("ferramenta-regua")).toHaveAttribute("aria-label", "Régua");
  await expect(p.getByTestId("ferramenta-regua")).toHaveAttribute("aria-keyshortcuts", "R");

  await p.getByTestId("menu-ordem-turno").click();
  await expect(p.getByTestId("janela-ordem")).toBeVisible();
  await congelarRelogio(p);
  // (abrir a ordem para todos é da sala; daqui em diante, hover, foco e clique em botão desabilitado não mandam nada)
  const enviadosDepoisDeAbrir = s.enviados.length;

  // mouse e foco: nada
  await p.getByTestId("ferramenta-regua").hover();
  await passar(p, PASSA_DO_ATRASO * 2);
  await expect(p.getByTestId("dica-ferramenta-regua")).toBeHidden();
  await p.getByTestId("ferramenta-mao").focus();
  await p.keyboard.press("Tab");
  await expect(p.getByTestId("dica-ferramenta-regua")).toBeHidden();
  await expect(p.getByTestId("dica-ferramenta-mao")).toBeHidden();

  // clicar no desabilitado: um balão curto com o motivo, que some sozinho
  const ordenar = p.getByTestId("ordem-ordenar");
  await ordenar.hover();
  await passar(p, PASSA_DO_ATRASO);
  const balao = p.getByTestId("dica-ordem-ordenar");
  await expect(balao).toBeHidden();
  await ordenar.click({ force: true });
  await expect(balao).toBeVisible();
  await expect(balao).toHaveText("Ordenar pela iniciativa — A lista está vazia");
  await expect(balao).toHaveAttribute("aria-live", "polite");
  await passar(p, 4000);
  await expect(balao).toBeHidden();

  // nada disso foi para a sala
  expect(s.enviados.length).toBe(enviadosDepoisDeAbrir);
});

test("a opção sobrevive ao recarregar e não manda frame", async ({ mesa }) => {
  const s = await entrarNoMapa(mesa, "mestre");
  const p = s.pagina;
  await abrirPreferencia(p, "mapa");
  const enviadosAntes = s.enviados.length;
  await p.getByTestId("pref-dicas").uncheck();
  await expect.poll(() => guardada(p)).toBe("0");
  expect(s.enviados.length).toBe(enviadosAntes);

  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await abrirPreferencia(p, "mapa");
  await expect(p.getByTestId("pref-dicas")).not.toBeChecked();
  expect(await guardada(p)).toBe("0");

  // ligar de novo
  await p.getByTestId("pref-dicas").check();
  await expect.poll(() => guardada(p)).toBe("1");
  await p.getByTestId("ferramenta-regua").hover();
  await expect(p.getByTestId("dica-ferramenta-regua")).toBeVisible();
});
