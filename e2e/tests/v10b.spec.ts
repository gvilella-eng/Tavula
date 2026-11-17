import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, intencaoCrua, test, tornarMembros } from "./ajudas";
import {
  entrarNoMapa,
  type GanchoDoMapa,
  noElementoDoMapa,
  pontoNaPagina,
  soSelecionarToken,
  tokensDe,
} from "./ajudasMapa";

// V10b: o jogador põe o próprio token no mapa, só na área da bandeira (o ponto de chegada, o centro da cena-1).

const RAIO_M = 4.5;
const CHEGADA = { x: 30, y: 22.5 };

const gancho = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.bandeira());
const aldric = async (p: Page) => (await tokensDe(p)).filter((t) => t.nome === "Aldric");
const perto = (t: { x: number; y: number }) =>
  Math.hypot(t.x - CHEGADA.x, t.y - CHEGADA.y) <= RAIO_M + 1;

/** O jogador 1 tira o token dele com Delete (o seletor de teste do V10). */
async function tirarOToken(p: Page, id = "tok-jogador-1") {
  await soSelecionarToken(p, id);
  await p.keyboard.press("Delete");
  await expect.poll(async () => (await aldric(p)).length).toBe(0);
}

test("sem token na cena o jogador vê a bandeira; Colocar no mapa põe o token ao lado dela, na lista e na ficha", async ({
  mesa,
  request,
}) => {
  test.setTimeout(90_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await abrirAba(j1.pagina, "fichas");

  // com token na cena: sem bandeira e sem botão
  expect(await gancho(j1.pagina)).toBeNull();
  await expect(j1.pagina.getByTestId("ficha-colocar-pers-aldric")).toHaveCount(0);

  // sem token: a bandeira aparece (e a dica diz como pôr)
  await tirarOToken(j1.pagina);
  await expect.poll(() => gancho(j1.pagina)).toEqual(CHEGADA);
  await j1.pagina.evaluate(
    ([x, y]) => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(x, y),
    [CHEGADA.x, CHEGADA.y] as [number, number],
  );
  const tela = await j1.pagina.evaluate(
    ([x, y]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paraTela(
        x as number,
        y as number,
      ),
    [CHEGADA.x, CHEGADA.y],
  );
  await j1.pagina.mouse.move(tela.x + 4, tela.y - 14);
  await j1.pagina.mouse.move(tela.x + 5, tela.y - 13);
  await expect(j1.pagina.getByTestId("dica-bandeira")).toContainText("Ponto de chegada");
  await expect(j1.pagina.getByTestId("dica-bandeira")).toContainText("Colocar no mapa");

  // o botão da lista: cria o token ao lado da bandeira; o mestre o vê; o botão e a bandeira somem
  await expect(j1.pagina.getByTestId("aviso")).toHaveCount(0, { timeout: 15_000 });
  await j1.pagina.getByTestId("ficha-colocar-pers-aldric").click();
  await expect.poll(async () => (await aldric(j1.pagina)).length).toBe(1);
  const novo = (await aldric(j1.pagina))[0];
  if (!novo) throw new Error("sem token");
  expect(novo.id).not.toBe("tok-jogador-1");
  expect(perto(novo)).toBe(true);
  await expect.poll(async () => (await aldric(m.pagina)).length).toBe(1);
  await expect(j1.pagina.getByTestId("ficha-colocar-pers-aldric")).toHaveCount(0);
  await expect.poll(() => gancho(j1.pagina)).toBeNull();

  // Delete de novo; passado o prazo do Desfazer, o botão do cabeçalho da ficha põe o token de volta
  await tirarOToken(j1.pagina, novo.id);
  await expect(j1.pagina.getByTestId("aviso")).toHaveCount(0, { timeout: 15_000 });
  await j1.pagina.getByTestId("ficha-abrir-pers-aldric").click();
  await j1.pagina.getByTestId("ficha-colocar-no-mapa").click();
  await expect.poll(async () => (await aldric(j1.pagina)).length).toBe(1);
  await expect.poll(async () => (await aldric(m.pagina)).length).toBe(1);
  await expect(j1.pagina.getByTestId("ficha-colocar-no-mapa")).toHaveCount(0);
  await expect(j1.pagina.getByTestId("ficha-colocar-pers-aldric")).toHaveCount(0);
});

test("arrastar a ficha: onde quer que solte, o token vai para a bandeira (Q8)", async ({
  mesa,
  request,
}) => {
  test.setTimeout(90_000);
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await abrirAba(j1.pagina, "fichas");
  await tirarOToken(j1.pagina);

  // a área se acende durante o arrasto (o início e o fim do arrasto, sem soltar) e apaga ao terminar
  const item = j1.pagina.getByTestId("ficha-abrir-pers-aldric");
  await expect(item).toHaveAttribute("draggable", "true");
  const acesa = () =>
    j1.pagina.evaluate(() =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.areaDaBandeiraAcesa(),
    );
  expect(await acesa()).toBe(false);
  const dt = await j1.pagina.evaluateHandle(() => new DataTransfer());
  await item.dispatchEvent("dragstart", { dataTransfer: dt });
  await expect.poll(acesa).toBe(true);
  await item.dispatchEvent("dragend", { dataTransfer: dt });
  await expect.poll(acesa).toBe(false);

  // longe da bandeira: o token vai para a bandeira, não para onde soltou (a vista no centro da cena, onde ela fica)
  await j1.pagina.evaluate(
    ([x, y]) => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(x, y),
    [CHEGADA.x, CHEGADA.y] as [number, number],
  );
  const longe = await pontoNaPagina(j1.pagina, CHEGADA.x - 7, CHEGADA.y);
  await item.dragTo(j1.pagina.getByTestId("mapa"), {
    targetPosition: await noElementoDoMapa(j1.pagina, longe),
  });
  await expect.poll(async () => (await aldric(j1.pagina)).length).toBe(1);
  const primeiro = (await aldric(j1.pagina))[0] as {
    id: string;
    x: number;
    y: number;
    camada: string;
  };
  expect(perto(primeiro)).toBe(true);
  expect(primeiro.camada).toBe("tokens");
  await expect.poll(async () => (await aldric(m.pagina)).length).toBe(1);

  // perto: vai para o mesmo lugar (a bandeira, arrumado no grid), não para onde soltou
  await tirarOToken(j1.pagina, primeiro.id);
  const alvo = await pontoNaPagina(j1.pagina, 32.2, 21.4);
  await item.dragTo(j1.pagina.getByTestId("mapa"), {
    targetPosition: await noElementoDoMapa(j1.pagina, alvo),
  });
  await expect
    .poll(async () => (await aldric(j1.pagina))[0])
    .toMatchObject({ x: primeiro.x, y: primeiro.y });
  // depois de criado, o personagem não é mais arrastável (um token por personagem por cena)
  await expect(item).not.toHaveAttribute("draggable", "true");
});

test("a sala confere: quem não controla, segundo token na cena e capacidade desligada são recusados", async ({
  mesa,
  request,
}) => {
  test.setTimeout(90_000);
  await tornarMembros(request, "jogador-1", "jogador-2");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await tirarOToken(j1.pagina);

  const codigo = async (p: Page, dados: object) =>
    (await enviarCru(p, intencaoCrua("token.colocarMeu", dados)))?.dados.codigo;
  // quem não controla o personagem
  expect(await codigo(j2.pagina, { personagemId: "pers-aldric", tokenId: "tok-x1" })).toBe(
    "sem_permissao",
  );
  // Q8: o ponto longe da bandeira não é recusado: o token vai para a bandeira
  const longe = await enviarCru(
    j1.pagina,
    intencaoCrua("token.colocarMeu", {
      personagemId: "pers-aldric",
      tokenId: "tok-x2",
      x: 5,
      y: 5,
    }),
  );
  expect(longe?.tipo).toBe("evento");
  await expect.poll(async () => (await aldric(m.pagina)).filter(perto).length).toBe(1);
  await tirarOToken(j1.pagina, "tok-x2");
  // um segundo token na mesma cena (o primeiro entra pela bandeira; o campo extra do cliente é ignorado)
  const ok = await enviarCru(
    j1.pagina,
    intencaoCrua("token.colocarMeu", {
      personagemId: "pers-aldric",
      tokenId: "tok-x3",
      x: 30.5,
      y: 22,
      nome: "Falso",
      oculto: true,
    }),
  );
  expect(ok?.tipo).toBe("evento");
  await expect.poll(async () => (await aldric(m.pagina)).length).toBe(1);
  expect(await (await tokensDe(m.pagina)).some((t) => t.nome === "Falso")).toBe(false);
  expect(await codigo(j1.pagina, { personagemId: "pers-aldric", tokenId: "tok-x4" })).toBe(
    "dados_invalidos",
  );

  // o mestre desliga a capacidade em Permissões: o botão some e a sala recusa
  await tirarOToken(j1.pagina, "tok-x3");
  await expect(j1.pagina.getByTestId("aviso")).toHaveCount(0, { timeout: 15_000 });
  await abrirAba(j1.pagina, "fichas");
  await expect(j1.pagina.getByTestId("ficha-colocar-pers-aldric")).toBeVisible();
  await abrirAba(m.pagina, "mesa");
  const caixa = m.pagina.getByTestId("perm-padrao-token.colocarProprio");
  await expect(caixa).toBeVisible();
  await expect(caixa).toBeChecked();
  await caixa.click();
  await expect(j1.pagina.getByTestId("ficha-colocar-pers-aldric")).toHaveCount(0);
  await expect.poll(() => gancho(j1.pagina)).toBeNull();
  expect(await codigo(j1.pagina, { personagemId: "pers-aldric", tokenId: "tok-x5" })).toBe(
    "sem_permissao",
  );
});
