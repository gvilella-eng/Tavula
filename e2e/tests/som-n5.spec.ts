import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "./ajudasMapa";
import { arquivoWav, esperarHashDoSom, somDe } from "./ajudasSom";

// N5: som ambiente. (A trilha e os efeitos do mestre passaram para a mesa de som: som-q4.spec.ts.) A zona toca um som para quem está dentro, a
// automação `som.tocar` toca um efeito, e cada pessoa ajusta o volume nas Preferências. Os arquivos são wavs de silêncio
// gerados aqui; o gancho `__tabletopSom` diz o que "está tocando" (o volume já com as preferências).

const TOK = "tok-jogador-1";
const SEGREDO = "NEVOA-SECRETA-DO-AR-MORTO";
const FORA = { x: 11.25, y: 9.75 };
const DENTRO = { x: 29.25, y: 9.75 };
const POLIGONO = [
  { x: 26.25, y: 6 },
  { x: 33, y: 6 },
  { x: 33, y: 13.5 },
  { x: 26.25, y: 13.5 },
];

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

test("o aviso 'Clique para ativar o som' aparece quando o navegador bloqueia, ativa com um clique e guarda o Agora não", async ({
  mesa,
}) => {
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j = j1.pagina;
  // o aviso do navegador que bloqueia o som: aparece, ativa com um clique, ou "Agora não" e não volta
  await expect(j.getByTestId("aviso-som")).toHaveCount(0);
  await j.evaluate(() =>
    (
      window as unknown as { __tabletopSom: { simularBloqueio(): void } }
    ).__tabletopSom.simularBloqueio(),
  );
  await expect(j.getByTestId("aviso-som")).toContainText("Clique para ativar o som da mesa");
  await j.getByTestId("aviso-som-ativar").click();
  await expect(j.getByTestId("aviso-som")).toHaveCount(0);
  await j.evaluate(() =>
    (
      window as unknown as { __tabletopSom: { simularBloqueio(): void } }
    ).__tabletopSom.simularBloqueio(),
  );
  await expect(j.getByTestId("aviso-som")).toBeVisible();
  await j.getByTestId("aviso-som-dispensar").click();
  await expect(j.getByTestId("aviso-som")).toHaveCount(0);
  // guardado neste navegador (e só nele)
  await j.reload();
  await expect(j.getByTestId("status-conexao")).toHaveText("conectado");
  await j.waitForFunction(() => (window as unknown as { __tabletopSom?: unknown }).__tabletopSom);
  await j.evaluate(() =>
    (
      window as unknown as { __tabletopSom: { simularBloqueio(): void } }
    ).__tabletopSom.simularBloqueio(),
  );
  await expect(j.getByTestId("aviso-som")).toHaveCount(0);
  await abrirPreferencia(j, "som");
  await expect(j.getByTestId("som-ativar")).toBeVisible();
});

test("a zona toca um som para quem está dentro, com o sigilo da zona intacto; o jogador sai e o som para", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  const m = mestre.pagina;
  await ok(m, "zona.criar", {
    zona: { id: "zona-ar", cenaId: "cena-1", nome: SEGREDO, pontos: POLIGONO, efeitos: {} },
  });
  // o mestre escolhe o som da zona no painel dela
  await m.getByTestId("ferramenta-zonas").click();
  await centrar(m, 29.5, 9.75);
  const clique = await pontoNaPagina(m, 31.5, 11.25);
  await m.mouse.click(clique.x, clique.y);
  await expect(m.getByTestId("zona-selecionada")).toBeVisible();
  await expect(m.getByTestId("zona-som")).toBeVisible();
  await m.getByTestId("zona-som-escolher").click();
  await m
    .getByTestId("zona-som-escolher-lista-arquivo")
    .setInputFiles(arquivoWav("sussurros.wav", 1));
  await expect(m.getByTestId("zona-som-nome")).toHaveText("sussurros");
  const hash = await esperarHashDoSom(m, "sussurros.wav");
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  // som e laço da zona
  await expect(m.getByTestId("zona-som-laco")).toBeChecked();
  await m.getByTestId("zona-som-volume").fill("60");
  await expect(m.getByTestId("zona-som-volume-valor")).toHaveText("60%");

  // fora da zona ninguém ouve nada
  await ok(j1.pagina, "token.soltar", { id: TOK, ...FORA });
  expect((await somDe(j1.pagina)).zonas).toEqual([]);
  // o jogador entra: passa a ouvir (a sala manda só o som); o outro jogador, que está fora, não
  await ok(j1.pagina, "token.soltar", { id: TOK, ...DENTRO });
  await expect.poll(async () => (await somDe(j1.pagina)).zonas.length).toBe(1);
  const ouvindo = (await somDe(j1.pagina)).zonas[0];
  expect(ouvindo?.hash).toBe(hash);
  expect(ouvindo?.volume).toBeCloseTo(0.6 * 0.8, 5);
  expect((await somDe(j2.pagina)).zonas).toEqual([]);
  // ...e sai: o som para
  await ok(j1.pagina, "token.soltar", { id: TOK, ...FORA });
  await expect.poll(async () => (await somDe(j1.pagina)).zonas.length).toBe(0);
  // entra de novo e o mestre desliga a zona: o som para, nada fica preso
  await ok(j1.pagina, "token.soltar", { id: TOK, ...DENTRO });
  await expect.poll(async () => (await somDe(j1.pagina)).zonas.length).toBe(1);
  await ok(m, "zona.editar", { id: "zona-ar", mudancas: { ativa: false } });
  await expect.poll(async () => (await somDe(j1.pagina)).zonas.length).toBe(0);
  await ok(m, "zona.editar", { id: "zona-ar", mudancas: { ativa: true } });
  await expect.poll(async () => (await somDe(j1.pagina)).zonas.length).toBe(1);

  // o sigilo: o jogador recebeu só o som (hash e volume), nunca a zona
  const doJogador = j1.frames.join("\n");
  expect(doJogador).toContain('"som.zona"');
  expect(doJogador).toContain(hash ?? "sem-hash");
  const mensagensDeSom = j1.frames.filter((f) => f.includes('"som.zona"'));
  expect(mensagensDeSom.length).toBeGreaterThan(0);
  for (const f of mensagensDeSom) {
    expect(Object.keys((JSON.parse(f) as { dados: object }).dados)).toEqual(["sons"]);
  }
  for (const proibido of [SEGREDO, "zona-ar", '"zonas"', "zona.alterada", "zona:", "sussurros"]) {
    expect(doJogador, `o frame do jogador trouxe "${proibido}"`).not.toContain(proibido);
  }
  // o outro jogador nunca ouviu nem recebeu nada da zona
  expect(j2.frames.join("\n")).not.toContain('"som.zona"');
});

test("a automação som.tocar: o editor monta o bloco e o botão toca o som para todos; o jogador nunca recebe a definição", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await abrirAba(p, "mesa");
  await p.getByTestId("automacoes-abrir").click();
  await expect(p.getByTestId("automacoes-janela")).toBeVisible();
  await p.getByTestId("auto-nova").click();
  await p.getByTestId("ed-nome").fill("Sopro");
  await p.getByTestId("ed-peca-botao").click();
  await p.getByTestId("ed-campo-botao").fill("Soprar");
  await p.getByTestId("ed-mais-t0-0").click();
  await p.getByTestId("ed-menu-t0-0-som").click();
  await p.getByTestId("ed-adicionar-som").locator("summary").click();
  await p
    .getByTestId("ed-escolher-som-arquivo")
    .setInputFiles(arquivoWav("sopro-do-pulmao.wav", 1));
  const hash = await esperarHashDoSom(p, "sopro-do-pulmao.wav");
  await expect(p.getByTestId("ed-campo-som")).toHaveValue(hash ?? "sem-hash");
  await p.getByTestId("ed-campo-volume").fill("50");
  await p.getByTestId("ed-campo-para").selectOption("todos");
  await p.getByTestId("ed-salvar").click();
  await expect(p.getByTestId("auto-item-sopro")).toContainText("Soprar");
  expect(
    mestre.enviados.filter((f) => f.includes('"fluxo.criar"') && f.includes("som.tocar")).length,
  ).toBe(1);

  // o botão (ou o relógio, ou o próprio sistema) toca o efeito uma vez, para todos
  expect((await somDe(j1.pagina)).efeitos).toEqual([]);
  await p.getByTestId("auto-disparar-sopro").click();
  for (const s of [mestre.pagina, j1.pagina]) {
    await expect.poll(async () => (await somDe(s)).efeitos.length).toBe(1);
    expect((await somDe(s)).efeitos[0]?.hash).toBe(hash);
    expect((await somDe(s)).efeitos[0]?.volume).toBeCloseTo(0.5 * 0.8, 5);
  }
  // a definição da reação é segredo do mestre: o jogador recebeu o efeito, não a reação
  const doJogador = j1.frames.join("\n");
  expect(doJogador).toContain("som.efeitoTocado");
  for (const proibido of ["som.tocar", "fluxo.criar", "automacoes", "trilhas"]) {
    expect(doJogador, `o frame do jogador trouxe "${proibido}"`).not.toContain(proibido);
  }
});
