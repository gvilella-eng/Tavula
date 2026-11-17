import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirSecaoDaMesa,
  enviarCru,
  expect,
  intencaoCrua,
  test,
  tornarMembros,
} from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa, soSelecionarToken, tokensDe } from "./ajudasMapa";
import { enviarEEsperarSnapshot } from "./ajudasSom";

// Q8: cada cena tem o token do personagem (ter token em outra cena não importa); o jogador põe o dele sempre na
// bandeira e só o mestre escolhe o ponto; o botão Automações na barra de cima; a aba Mesa no desenho das Preferências.

const CHEGADA = { x: 30, y: 22.5 };
const RAIO_M = 4.5;
const aldric = async (p: Page) => (await tokensDe(p)).filter((t) => t.nome === "Aldric");
const perto = (t: { x: number; y: number }) =>
  Math.hypot(t.x - CHEGADA.x, t.y - CHEGADA.y) <= RAIO_M + 1;
const veNoPonto = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.veNoPonto(
        px as number,
        py as number,
      ),
    [x, y],
  );

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}
async function levarOGrupo(p: Page, cenaId: string) {
  expect(await enviarEEsperarSnapshot(p, intencaoCrua("grupo.moverPara", { cenaId }))).toBe(
    "snapshot",
  );
}
async function tirarOToken(p: Page, id: string) {
  await soSelecionarToken(p, id);
  await p.keyboard.press("Delete");
  await expect.poll(async () => (await tokensDe(p)).some((t) => t.id === id)).toBe(false);
}

test("o caso dele: token na cena A, grupo na B, o jogador põe o token na B e ele vai para a bandeira; o mestre põe onde quiser", async ({
  mesa,
  request,
}) => {
  test.setTimeout(120_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");

  // o grupo vai para a cena B (o token do Aldric vai junto) e o mestre põe outro token do Aldric na cena A
  await ok(m.pagina, "cena.criar", { id: "cena-q8", nome: "Outra" });
  await levarOGrupo(m.pagina, "cena-q8");
  await ok(m.pagina, "personagem.colocar", {
    personagemId: "pers-aldric",
    cenaId: "cena-1",
    tokenId: "tok-q8-a",
    x: 5,
    y: 5,
  });

  // na B o jogador tira o token dele: sobra só o da A
  await expect.poll(async () => (await aldric(j1.pagina)).length).toBe(1);
  await tirarOToken(j1.pagina, "tok-jogador-1");
  await abrirAba(j1.pagina, "fichas");

  // pela tela: o botão da ficha põe o token na bandeira da B, mesmo com token dele na A
  await j1.pagina.getByTestId("ficha-colocar-pers-aldric").click();
  await expect.poll(async () => (await aldric(j1.pagina)).length).toBe(1);
  const novo = (await aldric(j1.pagina))[0] as { x: number; y: number; camada: string };
  expect(perto(novo)).toBe(true);
  expect(novo.camada).toBe("tokens");
  await expect(j1.pagina.getByTestId("ficha-colocar-pers-aldric")).toHaveCount(0);

  // soltar longe (pela sala, sem o aviso de antes) também vai para a bandeira, no mesmo lugar
  await tirarOToken(j1.pagina, (await aldric(j1.pagina))[0]?.id as string);
  const longe = await enviarCru(
    j1.pagina,
    intencaoCrua("token.colocarMeu", {
      personagemId: "pers-aldric",
      tokenId: "tok-q8-longe",
      x: 3,
      y: 3,
    }),
  );
  expect(longe?.tipo).toBe("evento");
  await expect
    .poll(async () => (await aldric(j1.pagina))[0])
    .toMatchObject({ id: "tok-q8-longe", x: novo.x, y: novo.y });

  // o mestre põe onde quiser (aqui, o personagem do outro jogador, que está na B)
  await ok(m.pagina, "token.colocarMeu", {
    personagemId: "pers-aldric",
    tokenId: "tok-q8-mestre",
    x: 12,
    y: 12,
  });
  await expect
    .poll(async () => (await tokensDe(m.pagina)).find((t) => t.id === "tok-q8-mestre"))
    .toMatchObject({ x: 12, y: 12 });

  // a visão do jogador na B vem do token da B (o da A fica em outra cena, em outro canto)
  await tirarOToken(m.pagina, "tok-q8-mestre");
  await expect.poll(() => veNoPonto(j1.pagina, 30, 22.5)).toBe(true);
  // o da A fica em outra cena, em outro canto: o ponto onde ele estaria na B não é visto
  expect(await veNoPonto(j1.pagina, 5, 5)).toBe(false);
});

test("levar o grupo de volta à A com token do mesmo personagem nas duas cenas não duplica", async ({
  mesa,
  request,
}) => {
  test.setTimeout(120_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  await ok(m.pagina, "cena.criar", { id: "cena-q8", nome: "Outra" });
  // o Aldric tem token na A; o mestre pôs outro na B (antes o "grupo leva o token junto" recusava)
  await ok(m.pagina, "personagem.colocar", {
    personagemId: "pers-aldric",
    cenaId: "cena-q8",
    tokenId: "tok-q8-b",
    x: 20,
    y: 20,
  });
  await levarOGrupo(m.pagina, "cena-q8");
  // o da A não veio: na B só o do destino (e os outros do grupo)
  await expect.poll(async () => (await aldric(m.pagina)).map((t) => t.id)).toEqual(["tok-q8-b"]);
  await levarOGrupo(m.pagina, "cena-1");
  // de volta na A: o token original, uma vez só
  await expect
    .poll(async () => (await aldric(m.pagina)).map((t) => t.id))
    .toEqual(["tok-jogador-1"]);
  await levarOGrupo(m.pagina, "cena-q8");
  await expect.poll(async () => (await aldric(m.pagina)).map((t) => t.id)).toEqual(["tok-q8-b"]);
});

test("o botão Automações da barra abre a janela e dá para editar por ela; o jogador não o vê; a aba Mesa tem a linha que abre a janela", async ({
  mesa,
  request,
}) => {
  test.setTimeout(90_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = m.pagina;

  await expect(j1.pagina.getByTestId("menu-automacoes")).toHaveCount(0);
  await expect(p.getByTestId("menu-automacoes")).toBeVisible();
  await expect(p.getByTestId("automacoes-janela")).toHaveCount(0);
  await p.getByTestId("menu-automacoes").click();
  await expect(p.getByTestId("automacoes-janela")).toBeVisible();
  await expect(p.getByTestId("menu-automacoes")).toHaveAttribute("aria-pressed", "true");

  // edita uma automação por ela: uma reação nova aparece na lista
  await p.getByTestId("auto-nova-reacao").click();
  await p.getByTestId("form-reacao-nome").fill("Treme");
  await p.getByTestId("form-reacao-ao").selectOption("__outro");
  await p.getByTestId("form-reacao-ao-outro").fill("inspiracao");
  await p.getByTestId("form-acao-0-tipo").selectOption("luz.modificar");
  await p.getByTestId("form-acao-0-raioX").fill("0,5");
  await p.getByTestId("form-acao-0-raioX").press("Tab");
  await p.getByTestId("form-reacao-salvar").click();
  await expect(p.getByTestId("auto-reacao-treme")).toContainText("inspiracao");

  // o botão fecha a janela; a aba Mesa abre de novo pela linha dela
  await p.getByTestId("menu-automacoes").click();
  await expect(p.getByTestId("automacoes-janela")).toHaveCount(0);
  await abrirAba(p, "mesa");
  await abrirSecaoDaMesa(p, "automacoes");
  await expect(p.getByTestId("mesa-secao-automacoes")).toContainText(
    "As automações ficam no botão Automações da barra de cima.",
  );
  await expect(p.getByTestId("automacoes-resumo")).toContainText("1 reação");
  await p.getByTestId("automacoes-abrir").click();
  await expect(p.getByTestId("automacoes-janela")).toBeVisible();
  await expect(p.getByTestId("auto-reacao-treme")).toBeVisible();
});

test("a aba Mesa: cartões como nas Preferências, cada um abre e fecha e os campos continuam funcionando", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const p = m.pagina;
  await p.getByTestId("aba-mesa").click();
  await expect(p.getByTestId("aba-painel-mesa")).toBeVisible();

  // só "Esta mesa" abre por padrão; o resto mostra um resumo embaixo do título
  await expect(p.getByTestId("mesa-secao-esta-mesa-titulo")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  for (const id of ["regras", "luz", "automacoes", "pessoas", "campanha", "diagnostico"]) {
    await expect(p.getByTestId(`mesa-secao-${id}-titulo`)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(p.getByTestId(`mesa-resumo-${id}`)).not.toHaveText("");
  }
  // não há mais a fileira de chips nem o rótulo comprido
  await expect(p.getByTestId("mesa-indice")).toHaveCount(0);

  // Esta mesa: o nome e o id
  await expect(p.getByTestId("mesa-nome")).toBeVisible();
  await expect(p.getByTestId("mesa-id")).toBeVisible();

  // Regras: um campo muda a regra (e o rótulo é curto, com a ajuda embaixo)
  await abrirSecaoDaMesa(p, "regras");
  await expect(p.getByTestId("cfg-alcance")).toBeVisible();
  await expect(p.getByTestId("config-mesa")).not.toContainText("entregar tocha, usar ponto");
  await p.getByTestId("cfg-maos").fill("3");
  await p.getByTestId("cfg-maos").press("Tab");
  await expect(p.getByTestId("mesa-resumo-regras")).toHaveText("3 mãos por personagem");

  // Luz, Pessoas, Campanha e Diagnóstico
  await abrirSecaoDaMesa(p, "luz");
  await expect(p.getByTestId("config-objetos")).toBeVisible();
  await abrirSecaoDaMesa(p, "pessoas");
  await expect(p.getByTestId("papeis")).toBeVisible();
  await expect(p.getByTestId("mesa-secao-contas")).toBeVisible();
  await expect(p.getByTestId("perm-padrao-token.moverProprio")).toBeVisible();
  await abrirSecaoDaMesa(p, "campanha");
  await expect(p.getByTestId("exportar")).toBeVisible();
  await abrirSecaoDaMesa(p, "diagnostico");
  await expect(p.getByTestId("uso-hoje")).toContainText("uso de hoje");

  // fechar esconde; o que se abriu fica lembrado depois de recarregar a página
  await p.getByTestId("mesa-secao-campanha-titulo").click();
  await expect(p.getByTestId("exportar")).toBeHidden();
  await p.reload();
  await esperarAbaMesa(p);
  await expect(p.getByTestId("mesa-secao-campanha-titulo")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(p.getByTestId("mesa-secao-regras-titulo")).toHaveAttribute("aria-expanded", "true");
});

async function esperarAbaMesa(p: Page) {
  await expect(p.getByTestId("aba-mesa")).toBeVisible();
  const aba = p.getByTestId("aba-mesa");
  if ((await aba.getAttribute("aria-selected")) !== "true") await aba.click();
  await expect(p.getByTestId("aba-painel-mesa")).toBeVisible();
}
