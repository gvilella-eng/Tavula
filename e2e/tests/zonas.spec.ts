import type { Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "./ajudasMapa";

// Lote 7b-2: as zonas das automações. O mestre desenha o polígono com a ferramenta, o token do jogador entra nele e a luz
// da tocha diminui (e volta ao sair), Delete e Desfazer apagam e trazem a zona, e o jogador nunca recebe a zona.

const ALDRIC = "pers-aldric";
const TOK = "tok-jogador-1";
const TOCHA = "modelo-tocha";
/** Um texto que só existe na zona do mestre: se aparecer num frame do jogador, vazou. */
const SEGREDO = "GAS-SECRETO-DA-MONTANHA";
const FORA = { x: 11.25, y: 9.75 };
const DENTRO = { x: 29.25, y: 9.75 };
const POLIGONO = [
  { x: 26.25, y: 6 },
  { x: 33, y: 6 },
  { x: 33, y: 13.5 },
  { x: 26.25, y: 13.5 },
];

const zonasDe = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.zonas());
const desenhando = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.zonaDesenhando());
const luzes = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes());
const luzDe = async (p: Page, id: string) => (await luzes(p)).find((l) => l.id === id);

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r, `${tipo} sem resposta`).not.toBeNull();
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

const centrar = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([a, b]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.centrarEm(
        a as number,
        b as number,
      ),
    [x, y],
  );

test("o mestre desenha a zona com a ferramenta, edita o painel e Delete e Desfazer a apagam e trazem de volta", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await expect(p.getByTestId("ferramenta-zonas")).toBeVisible();
  await p.getByTestId("ferramenta-zonas").click();
  await expect(p.getByTestId("painel-zonas")).toBeVisible();
  await centrar(p, 29.5, 9.75);

  // clique a clique; o duplo clique fecha
  const pt = (x: number, y: number) => pontoNaPagina(p, x, y);
  for (const q of POLIGONO.slice(0, 3)) {
    const t = await pt(q.x, q.y);
    await p.mouse.click(t.x, t.y);
  }
  await expect.poll(async () => (await desenhando(p))?.length).toBe(3);
  const ultimo = await pt(POLIGONO[3]?.x ?? 0, POLIGONO[3]?.y ?? 0);
  await p.mouse.dblclick(ultimo.x, ultimo.y);
  await expect.poll(async () => (await zonasDe(p)).length).toBe(1);
  const zona = (await zonasDe(p))[0];
  expect(zona?.pontos).toEqual(POLIGONO);
  expect(zona?.ativa).toBe(true);
  expect(zona?.nome).toBe("Zona 1");

  // o painel da zona recém-criada: nome, efeitos e a contagem de reações
  await expect(p.getByTestId("zona-selecionada")).toBeVisible();
  await p.getByTestId("zona-nome").fill("Gás");
  await p.getByTestId("zona-nome").press("Enter");
  await p.getByTestId("zona-luz-fator").fill("0.5");
  await p.getByTestId("zona-luz-fator").press("Enter");
  await p.getByTestId("zona-visao").fill("3");
  await p.getByTestId("zona-visao").press("Enter");
  await expect(p.getByTestId("zona-reacoes")).toHaveText("Sem reações");
  await expect.poll(async () => (await zonasDe(p))[0]?.nome).toBe("Gás");
  // duas edições seguidas dos efeitos não se pisam: o último pedido leva o fator e a visão juntos
  const editadas = () =>
    mestre.enviados.filter((f) => f.includes('"zona.editar"') && f.includes("visaoMaxM"));
  await expect.poll(() => editadas().length).toBeGreaterThan(0);
  expect(editadas().at(-1)).toContain('"luzRaioX":0.5');
  expect(editadas().at(-1)).toContain('"visaoMaxM":3');

  // desligar e ligar pelo painel
  await p.getByTestId("zona-ativa").click();
  await expect.poll(async () => (await zonasDe(p))[0]?.ativa).toBe(false);
  await p.getByTestId("zona-ativa").click();
  await expect.poll(async () => (await zonasDe(p))[0]?.ativa).toBe(true);

  // Delete apaga (com o foco no mapa); o aviso oferece o Desfazer e a zona volta igual
  const dentro = await pt(31.5, 11.25); // à direita do painel, que cobre o meio da tela
  await p.mouse.click(dentro.x, dentro.y); // seleciona a zona e leva o foco para o mapa
  await expect(p.getByTestId("zona-selecionada")).toBeVisible();
  await p.keyboard.press("Delete");
  await expect.poll(async () => (await zonasDe(p)).length).toBe(0);
  await expect(p.getByTestId("aviso")).toContainText("Gás");
  await p.getByTestId("aviso-acao").click();
  await expect.poll(async () => (await zonasDe(p)).length).toBe(1);
  const deVolta = (await zonasDe(p))[0];
  expect(deVolta).toMatchObject({ nome: "Gás", ativa: true });
  expect(deVolta?.pontos).toEqual(POLIGONO);
  // os efeitos voltaram também (o painel mostra os valores)
  await expect(p.getByTestId("zona-luz-fator")).toHaveValue("0.5");
  await expect(p.getByTestId("zona-visao")).toHaveValue("3");

  // Esc cancela um polígono em desenho (nada é criado)
  const longe = await pt(25, 18);
  await p.mouse.click(longe.x, longe.y);
  await expect.poll(async () => (await desenhando(p))?.length).toBe(1);
  await p.keyboard.press("Escape");
  await expect.poll(() => desenhando(p)).toBeNull();
  expect((await zonasDe(p)).length).toBe(1);
});

test("o token do jogador entra na zona e a luz da tocha diminui; sai e a luz volta; o jogador nunca recebe a zona", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await ok(mestre.pagina, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 2 });
  await ok(mestre.pagina, "tocha.acender", {
    personagemId: ALDRIC,
    modeloId: TOCHA,
    novoId: "tocha-a",
  });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await expect.poll(async () => (await luzDe(j1.pagina, "tocha-a"))?.claraM).toBeGreaterThan(0);
  const cheio = (await luzDe(j1.pagina, "tocha-a"))?.claraM ?? 0;

  await ok(mestre.pagina, "zona.criar", {
    zona: {
      id: "zona-gas",
      cenaId: "cena-1",
      nome: SEGREDO,
      pontos: POLIGONO,
      efeitos: { luzRaioX: 0.5, visaoMaxM: 3 },
    },
  });
  // o mestre vê a zona; o jogador, não
  await expect.poll(async () => (await zonasDe(mestre.pagina)).length).toBe(1);
  expect((await zonasDe(j1.pagina)).length).toBe(0);
  expect((await luzDe(j1.pagina, "tocha-a"))?.claraM).toBeCloseTo(cheio, 5);

  // o jogador anda para dentro da zona: a luz dele cai pela metade, para os dois
  await ok(j1.pagina, "token.soltar", { id: TOK, ...DENTRO });
  for (const s of [mestre, j1]) {
    await expect
      .poll(async () => (await luzDe(s.pagina, "tocha-a"))?.claraM)
      .toBeCloseTo(cheio * 0.5, 5);
  }
  // ...e sai: a luz volta
  await ok(j1.pagina, "token.soltar", { id: TOK, ...FORA });
  for (const s of [mestre, j1]) {
    await expect.poll(async () => (await luzDe(s.pagina, "tocha-a"))?.claraM).toBeCloseTo(cheio, 5);
  }
  // entra de novo e o mestre desliga a zona com o token dentro: nada fica preso
  await ok(j1.pagina, "token.soltar", { id: TOK, ...DENTRO });
  await expect
    .poll(async () => (await luzDe(j1.pagina, "tocha-a"))?.claraM)
    .toBeCloseTo(cheio * 0.5, 5);
  await ok(mestre.pagina, "zona.editar", { id: "zona-gas", mudancas: { ativa: false } });
  await expect.poll(async () => (await luzDe(j1.pagina, "tocha-a"))?.claraM).toBeCloseTo(cheio, 5);

  // o sigilo: a zona (nome, forma, id, efeitos) não está em nenhum frame do jogador, nem snapshot nem evento
  const doMestre = mestre.frames.join("\n");
  expect(doMestre).toContain(SEGREDO);
  const doJogador = j1.frames.join("\n");
  expect(doJogador).toContain("fonte.editada"); // ele recebeu só o resultado: a luz...
  expect(doJogador).toContain("efeitos.alterados"); // ...e a visão limitada
  for (const proibido of [SEGREDO, "zona-gas", "zonas", "zona.alterada", "zona:", "luzRaioX"]) {
    expect(doJogador, `o frame do jogador trouxe "${proibido}"`).not.toContain(proibido);
  }
});
