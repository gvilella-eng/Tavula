import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, intencaoCrua, Mesa, menuDaCena, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina, tokensDe } from "./ajudasMapa";

// V12: o ping no mapa. Segurar o clique parado (Selecionar ou Mão) faz um círculo na cor de quem pingou, para todos
// que veem a cena; com Shift, a tela de todos vai para o ponto. Efêmero: nada é gravado.

const COR_MESTRE = "#d4a017";
const COR_J1 = "#3cb44b";
/** Os E2E rodam com `reducedMotion: "reduce"`: a câmera vai direto ao ponto e o ping é um anel fixo. */
/** Um ponto vazio da cena-1 (longe dos tokens e das paredes da semente). */
const VAZIO = { x: 50, y: 6 };

const recebidos = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.pingsRecebidos());
const naTela = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.pingsNaTela());
const centro = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centroDaVista());
const zoomDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.zoom());
const ferramentaDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.ferramenta());

async function olharPara(p: Page, x: number, y: number) {
  await p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(
        px as number,
        py as number,
      ),
    [x, y],
  );
  return pontoNaPagina(p, x, y);
}

/** Segura o botão esquerdo parado sobre o ponto da página e solta. */
async function segurar(p: Page, ponto: { x: number; y: number }, opcoes?: { shift?: boolean }) {
  await p.mouse.move(ponto.x, ponto.y);
  if (opcoes?.shift) await p.keyboard.down("Shift");
  await p.mouse.down();
  await p.waitForTimeout(650);
  await p.mouse.up();
  if (opcoes?.shift) await p.keyboard.up("Shift");
}

/** A sala deixa 1 ping a cada 0,5 s por usuário: quem pinga duas vezes seguidas espera. */
const respeitarOLimite = (p: Page) => p.waitForTimeout(600);

test("segurar parado faz o ping chegar à outra página, na cor de quem pingou, e a câmera não se mexe", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await olharPara(m.pagina, 30, 22);
  const alvoJ1 = await olharPara(j1.pagina, VAZIO.x, VAZIO.y);
  const camera = await centro(m.pagina);

  await segurar(j1.pagina, alvoJ1);
  await expect.poll(async () => (await recebidos(m.pagina)).length).toBe(1);
  const visto = (await recebidos(m.pagina))[0];
  expect(visto).toMatchObject({
    usuarioId: "jogador-1",
    cor: COR_J1,
    cenaId: "cena-1",
    centralizar: false,
    exibido: true,
  });
  expect(Math.hypot((visto?.x ?? 0) - VAZIO.x, (visto?.y ?? 0) - VAZIO.y)).toBeLessThan(0.5);
  // quem pingou também vê, e o efeito está desenhado e some
  await expect.poll(async () => (await recebidos(j1.pagina)).length).toBe(1);
  await expect.poll(async () => (await naTela(m.pagina)).length).toBe(1);
  expect((await naTela(m.pagina))[0]?.cor).toBe(COR_J1);
  await expect.poll(async () => (await naTela(m.pagina)).length, { timeout: 5000 }).toBe(0);
  // sem Shift, ninguém é centralizado
  expect(await centro(m.pagina)).toEqual(camera);

  // o mestre pinga e o jogador vê na cor do mestre
  const alvoM = await olharPara(m.pagina, VAZIO.x, VAZIO.y);
  await segurar(m.pagina, alvoM);
  await expect.poll(async () => (await recebidos(j1.pagina)).length).toBe(2);
  expect((await recebidos(j1.pagina))[1]).toMatchObject({ usuarioId: "mestre", cor: COR_MESTRE });
});

test("nada é gravado nem fica no histórico: sem evento, sem snapshot e o chat intacto", async ({
  mesa,
}) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const alvo = await olharPara(j1.pagina, VAZIO.x, VAZIO.y);
  const eventosAntes = m.frames.filter((f) => f.includes('"tipo":"evento"')).length;
  const snapshotsAntes = m.frames.filter((f) => f.includes('"tipo":"snapshot"')).length;

  await segurar(j1.pagina, alvo);
  await expect.poll(async () => (await recebidos(m.pagina)).length).toBe(1);

  expect(m.frames.filter((f) => f.includes('"tipo":"evento"')).length).toBe(eventosAntes);
  expect(m.frames.filter((f) => f.includes('"tipo":"snapshot"')).length).toBe(snapshotsAntes);
  expect(m.frames.filter((f) => f.includes('"tipo":"mapa.pingado"'))).toHaveLength(1);
  // um recarregar (snapshot novo) não traz ping nenhum
  await m.pagina.reload();
  await expect(m.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await expect.poll(async () => (await naTela(m.pagina)).length).toBe(0);
  expect(await recebidos(m.pagina)).toEqual([]);
});

test("arrastar não pinga: o token anda e o mapa também (Mão), sem nenhum ping", async ({
  mesa,
}) => {
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  const t0 = (await tokensDe(p)).find((t) => t.id === "tok-jogador-1");
  if (!t0) throw new Error("sem token");
  await olharPara(p, t0.x, t0.y);
  const sobre = await pontoNaPagina(p, t0.x, t0.y);

  // Selecionar: segurar e arrastar o token, devagar
  await p.mouse.move(sobre.x, sobre.y);
  await p.mouse.down();
  await p.waitForTimeout(150);
  await p.mouse.move(sobre.x + 20, sobre.y, { steps: 5 });
  await p.waitForTimeout(650);
  await p.mouse.move(sobre.x + 60, sobre.y, { steps: 5 });
  await p.mouse.up();
  await expect
    .poll(async () => (await tokensDe(m.pagina)).find((t) => t.id === "tok-jogador-1")?.x)
    .not.toBe(t0.x);

  // Mão: arrastar o mapa não pinga
  await p.keyboard.press("h");
  const antes = await centro(p);
  await p.mouse.move(400, 400);
  await p.mouse.down();
  await p.waitForTimeout(150);
  await p.mouse.move(460, 430, { steps: 6 });
  await p.waitForTimeout(650);
  await p.mouse.up();
  expect(await centro(p)).not.toEqual(antes);
  expect(await recebidos(m.pagina)).toEqual([]);
  expect(await recebidos(p)).toEqual([]);
});

test("a Mão e um token também pingam segurando parado; o token fica onde está e soltar não faz mais nada", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = j1.pagina;
  const t0 = (await tokensDe(p)).find((t) => t.id === "tok-jogador-1");
  if (!t0) throw new Error("sem token");
  const sobre = await olharPara(p, t0.x, t0.y);

  // em cima do token (Selecionar)
  await segurar(p, sobre);
  await expect.poll(async () => (await recebidos(m.pagina)).length).toBe(1);
  expect((await recebidos(m.pagina))[0]?.usuarioId).toBe("jogador-1");
  const t1 = (await tokensDe(p)).find((t) => t.id === "tok-jogador-1");
  expect([t1?.x, t1?.y]).toEqual([t0.x, t0.y]);

  // com a ferramenta Mão, no fundo
  await respeitarOLimite(p);
  await p.keyboard.press("h");
  const vazio = await olharPara(p, VAZIO.x, VAZIO.y);
  await segurar(p, vazio);
  await expect.poll(async () => (await recebidos(m.pagina)).length).toBe(2);
  expect(await ferramentaDe(p)).toBe("mao");
});

test("Shift e segurar leva a câmera de todos para o ponto, sem mudar o zoom", async ({ mesa }) => {
  test.setTimeout(90_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await olharPara(m.pagina, 10, 35);
  await olharPara(j1.pagina, 12, 30);
  const zoomM = await zoomDe(m.pagina);
  const zoomJ = await zoomDe(j1.pagina);
  const ponto = await pontoNaPagina(m.pagina, 10, 35);
  const alvo = { x: 10, y: 35 };

  await segurar(m.pagina, ponto, { shift: true });
  await expect.poll(async () => (await recebidos(j1.pagina)).length).toBe(1);
  expect((await recebidos(j1.pagina))[0]?.centralizar).toBe(true);
  await expect
    .poll(async () => {
      const c = await centro(j1.pagina);
      return Math.hypot(c.x - alvo.x, c.y - alvo.y);
    })
    .toBeLessThan(0.5);
  expect(await zoomDe(j1.pagina)).toBe(zoomJ);
  expect(await zoomDe(m.pagina)).toBe(zoomM);
  // o próprio mestre também fica com o ponto no centro
  const cm = await centro(m.pagina);
  expect(Math.hypot(cm.x - alvo.x, cm.y - alvo.y)).toBeLessThan(0.5);
});

test("a tecla P pinga sob o ponteiro e Shift+P também centraliza; nenhuma janela sai do lugar", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await olharPara(j1.pagina, 20, 30);
  const ponto = await olharPara(m.pagina, VAZIO.x, VAZIO.y);
  await m.pagina.mouse.move(ponto.x, ponto.y);

  await m.pagina.keyboard.press("p");
  await expect.poll(async () => (await recebidos(j1.pagina)).length).toBe(1);
  const primeiro = (await recebidos(j1.pagina))[0];
  expect(primeiro?.centralizar).toBe(false);
  expect(Math.hypot((primeiro?.x ?? 0) - VAZIO.x, (primeiro?.y ?? 0) - VAZIO.y)).toBeLessThan(0.5);

  await respeitarOLimite(m.pagina);
  await m.pagina.keyboard.press("Shift+P");
  await expect.poll(async () => (await recebidos(j1.pagina)).length).toBe(2);
  await expect
    .poll(async () => {
      const c = await centro(j1.pagina);
      return Math.hypot(c.x - VAZIO.x, c.y - VAZIO.y);
    })
    .toBeLessThan(0.5);
});

test("a sala só manda o ping a quem vê a cena: o jogador da cena do grupo não recebe o da outra cena", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");

  // o jogador só pinga na cena dele
  const recusa = await enviarCru(
    j1.pagina,
    intencaoCrua("mapa.ping", { cenaId: "cena-covil", x: 5, y: 5 }),
  );
  expect(recusa?.tipo).toBe("erro");
  expect(recusa?.dados.codigo).toBe("sem_permissao");
  // cena que não existe, ponto fora da cena
  expect(
    (await enviarCru(j1.pagina, intencaoCrua("mapa.ping", { cenaId: "nao-existe", x: 5, y: 5 })))
      ?.dados.codigo,
  ).toBe("cena_inexistente");
  expect(
    (await enviarCru(j1.pagina, intencaoCrua("mapa.ping", { cenaId: "cena-1", x: 999, y: 5 })))
      ?.dados.codigo,
  ).toBe("dados_invalidos");

  // o mestre pinga na outra cena (ele vê todas): quem olha a cena do grupo não recebe nada
  await enviarCru(m.pagina, intencaoCrua("mapa.ping", { cenaId: "cena-covil", x: 5, y: 5 }));
  await expect.poll(async () => (await recebidos(m.pagina)).length).toBe(1);
  expect((await recebidos(m.pagina))[0]).toMatchObject({ cenaId: "cena-covil", exibido: false });
  expect(await naTela(m.pagina)).toEqual([]);
  expect(j1.frames.filter((f) => f.includes('"tipo":"mapa.pingado"'))).toHaveLength(0);
  expect(await recebidos(j1.pagina)).toEqual([]);
});

test("com a capacidade desligada em Permissões o jogador não pinga; o mestre continua pingando", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await abrirAba(m.pagina, "mesa");
  const caixa = m.pagina.getByTestId("perm-padrao-mapa.pingar");
  await expect(caixa).toBeVisible();
  await expect(caixa).toHaveAccessibleName(/Pingar o mapa e centralizar a tela de todos/);
  await expect(caixa).toBeChecked();
  await caixa.click();
  await expect(caixa).not.toBeChecked();

  const alvoJ = await olharPara(j1.pagina, VAZIO.x, VAZIO.y);
  await expect
    .poll(
      async () =>
        (await enviarCru(j1.pagina, intencaoCrua("mapa.ping", { cenaId: "cena-1", x: 5, y: 5 })))
          ?.dados.codigo,
    )
    .toBe("sem_permissao");
  await segurar(j1.pagina, alvoJ);
  await j1.pagina.keyboard.press("p");
  await j1.pagina.waitForTimeout(300);
  // o cliente nem chega a pedir
  // (o ping cru de cima, x=5 e y=5, é o único que a página mandou)
  expect(
    j1.enviados.filter((f) => f.includes('"tipo":"mapa.ping"') && !f.includes('"x":5,"y":5')),
  ).toHaveLength(0);
  expect(await recebidos(m.pagina)).toEqual([]);

  // o mestre pode sempre
  const alvoM = await olharPara(m.pagina, VAZIO.x, VAZIO.y);
  await m.pagina.keyboard.press("Escape");
  await segurar(m.pagina, alvoM);
  await expect.poll(async () => (await recebidos(j1.pagina)).length).toBe(1);

  // ligada de novo, o jogador pinga
  await abrirAba(m.pagina, "mesa");
  await m.pagina.getByTestId("perm-padrao-mapa.pingar").click();
  await expect(m.pagina.getByTestId("perm-padrao-mapa.pingar")).toBeChecked();
  await expect
    .poll(async () => {
      await segurar(j1.pagina, alvoJ);
      return (await recebidos(m.pagina)).length;
    })
    .toBeGreaterThan(0);
});

test("numa cena-cartão o ping também funciona", async ({ mesa }) => {
  test.setTimeout(90_000);
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await menuDaCena(m.pagina, "cena-1", "cartao");
  await expect(j1.pagina.getByTestId("sem-token")).toHaveCount(0);
  // a câmera enquadra a imagem inteira: um ponto vazio perto do canto da cena
  const alvo = await pontoNaPagina(j1.pagina, 40, 8);
  await segurar(j1.pagina, alvo);
  await expect.poll(async () => (await recebidos(m.pagina)).length).toBe(1);
  expect((await recebidos(m.pagina))[0]).toMatchObject({ usuarioId: "jogador-1", exibido: true });
});

test("com movimento ligado a câmera desliza até o ponto e o ping se abre e some sozinho", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const mesa = new Mesa(browser, { reducedMotion: "no-preference" });
  try {
    const m = await entrarNoMapa(mesa, "mestre");
    const j1 = await entrarNoMapa(mesa, "jogador-1");
    await olharPara(j1.pagina, 12, 30);
    const ponto = await olharPara(m.pagina, 10, 35);
    await segurar(m.pagina, ponto, { shift: true });
    await expect.poll(async () => (await naTela(j1.pagina)).length).toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const c = await centro(j1.pagina);
        return Math.hypot(c.x - 10, c.y - 35);
      })
      .toBeLessThan(0.5);
    await expect.poll(async () => (await naTela(j1.pagina)).length, { timeout: 5000 }).toBe(0);
  } finally {
    await mesa.fechar();
  }
});
