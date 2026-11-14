import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "./ajudasMapa";
import { arquivoWav, enviarEEsperarSnapshot, esperarHashDoSom, somDe } from "./ajudasSom";

// N5: som ambiente. O mestre toca a trilha e os efeitos pelo painel de Som, a zona toca um som para quem está dentro, a
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

/** 0,8 (volume do som) × 0,8 (volume geral padrão) × 1 (categoria): o que o jogador ouve com os padrões. */
const COM_OS_PADROES = 0.64;

test("o mestre toca a trilha e o jogador a ouve; o efeito toca uma vez por clique; volume zero, silenciar e parar funcionam", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;

  // o botão e o painel são só do mestre
  await expect(j.getByTestId("ferramenta-som")).toHaveCount(0);
  await m.getByTestId("ferramenta-som").click();
  await expect(m.getByTestId("painel-som")).toBeVisible();
  await expect(m.getByTestId("som-trilha-agora")).toHaveText("Parada");
  expect((await somDe(j)).trilha).toBeNull();

  // escolher um arquivo vira asset e toca como trilha
  await m.getByTestId("som-trilha-escolher-arquivo").setInputFiles(arquivoWav("taverna.wav", 1));
  await expect(m.getByTestId("som-trilha-agora")).toHaveText("taverna");
  const hash = await esperarHashDoSom(m, "taverna.wav");
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  // o jogador baixa o arquivo (pelo mesmo caminho dos assets de imagem) e passa a ouvir, no volume dele
  for (const p of [m, j]) {
    await expect.poll(async () => (await somDe(p)).trilha?.hash).toBe(hash);
    await expect
      .poll(async () => (await somDe(p)).trilha?.volume ?? 0)
      .toBeCloseTo(COM_OS_PADROES, 5);
  }

  // o volume da trilha do mestre vale para todos (e o jogador ainda tem o dele)
  await m.getByTestId("som-trilha-volume").fill("50");
  await expect.poll(async () => (await somDe(j)).trilha?.volume ?? 0).toBeCloseTo(0.5 * 0.8, 5);
  await m.getByTestId("som-trilha-volume").fill("80");
  await expect
    .poll(async () => (await somDe(j)).trilha?.volume ?? 0)
    .toBeCloseTo(COM_OS_PADROES, 5);

  // efeitos: um clique, uma vez
  await m.getByTestId("som-efeito-arquivo").setInputFiles(arquivoWav("sopro.wav", 2));
  const sopro = await esperarHashDoSom(m, "sopro.wav");
  expect(sopro).toMatch(/^[0-9a-f]{64}$/);
  for (const p of [m, j]) {
    await expect.poll(async () => (await somDe(p)).efeitos.length).toBe(1);
    expect((await somDe(p)).efeitos[0]).toMatchObject({ hash: sopro });
    expect((await somDe(p)).efeitos[0]?.volume).toBeCloseTo(COM_OS_PADROES, 5);
  }
  await m.getByTestId("som-efeito-item").filter({ hasText: "sopro.wav" }).click();
  for (const p of [m, j]) await expect.poll(async () => (await somDe(p)).efeitos.length).toBe(2);
  // trocar a trilha não toca efeito nenhum
  expect((await somDe(j)).efeitos).toHaveLength(2);

  // o jogador: volume e silenciar são só dele
  await abrirPreferencia(j, "som");
  await expect(j.getByTestId("pref-resumo-som")).toHaveText("Volume 80% · trilha ligada");
  await j.getByTestId("som-silenciar").check();
  await expect(j.getByTestId("pref-resumo-som")).toHaveText("Tudo silenciado");
  await expect.poll(async () => (await somDe(j)).trilha?.volume).toBe(0);
  expect((await somDe(m)).trilha?.volume).toBeCloseTo(COM_OS_PADROES, 5);
  await m.getByTestId("som-efeito-item").filter({ hasText: "sopro.wav" }).click();
  await expect.poll(async () => (await somDe(j)).efeitos.length).toBe(3);
  expect((await somDe(j)).efeitos[2]?.volume).toBe(0);
  await j.getByTestId("som-silenciar").uncheck();
  await expect
    .poll(async () => (await somDe(j)).trilha?.volume ?? 0)
    .toBeCloseTo(COM_OS_PADROES, 5);
  // volume da trilha em zero: a trilha segue "tocando" (no relógio da sala), sem som
  await j.getByTestId("som-volume-trilha").fill("0");
  await expect(j.getByTestId("pref-resumo-som")).toHaveText("Volume 80% · trilha desligada");
  await expect.poll(async () => (await somDe(j)).trilha?.volume).toBe(0);
  expect((await somDe(j)).trilha?.hash).toBe(hash);
  await j.getByTestId("som-volume-trilha").fill("100");
  await expect
    .poll(async () => (await somDe(j)).trilha?.volume ?? 0)
    .toBeCloseTo(COM_OS_PADROES, 5);
  // volume dos efeitos em zero
  await j.getByTestId("som-volume-efeitos").fill("0");
  await m.getByTestId("som-efeito-item").filter({ hasText: "sopro.wav" }).click();
  await expect.poll(async () => (await somDe(j)).efeitos.length).toBe(4);
  expect((await somDe(j)).efeitos[3]?.volume).toBe(0);
  // a escolha é do navegador: nada disso foi mandado à sala
  expect(j1.enviados.filter((f) => f.includes("som.") && f.includes("volume"))).toHaveLength(0);

  // quem entra no meio ouve a trilha que já toca
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await expect.poll(async () => (await somDe(j2.pagina)).trilha?.hash).toBe(hash);

  // parar: some para todos
  await m.getByTestId("som-trilha-parar").click();
  await expect(m.getByTestId("som-trilha-agora")).toHaveText("Parada");
  for (const p of [m, j, j2.pagina]) {
    await expect.poll(async () => (await somDe(p)).trilha).toBeNull();
  }
  // o jogador não consegue tocar nem parar nada
  const recusa = await enviarCru(j, intencaoCrua("som.trilha", { hash, volume: 0.5 }));
  expect(recusa?.dados.codigo).toBe("sem_permissao");
  const recusaEfeito = await enviarCru(j, intencaoCrua("som.efeito", { hash: sopro, volume: 0.5 }));
  expect(recusaEfeito?.dados.codigo).toBe("sem_permissao");
});

test("a trilha da cena começa ao levar o grupo, e o aviso 'Clique para ativar o som' guarda a escolha", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const m = mestre.pagina;
  const j = j1.pagina;
  await m.getByTestId("ferramenta-som").click();
  await m.getByTestId("som-trilha-escolher-arquivo").setInputFiles(arquivoWav("vento.wav", 1));
  const vento = await esperarHashDoSom(m, "vento.wav");
  await expect.poll(async () => (await somDe(j)).trilha?.hash).toBe(vento);
  // usar a que toca como a trilha desta cena, e parar
  await m.getByTestId("som-cena-usar").click();
  await expect(m.getByTestId("som-cena-trilha")).toContainText("vento");
  await m.getByTestId("som-trilha-parar").click();
  await expect.poll(async () => (await somDe(j)).trilha).toBeNull();
  // outra cena para levar o grupo e voltar
  await ok(m, "cena.criar", { id: "cena-som", nome: "Outra" });
  expect(
    await enviarEEsperarSnapshot(m, intencaoCrua("grupo.moverPara", { cenaId: "cena-som" })),
  ).toBe("snapshot");
  await expect.poll(async () => (await somDe(j)).trilha).toBeNull();
  expect(
    await enviarEEsperarSnapshot(m, intencaoCrua("grupo.moverPara", { cenaId: "cena-1" })),
  ).toBe("snapshot");
  await expect.poll(async () => (await somDe(j)).trilha?.hash).toBe(vento);
  await expect.poll(async () => (await somDe(m)).trilha?.hash).toBe(vento);

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

test("a automação som.tocar: o editor monta a reação e o evento toca o som para todos; o jogador nunca recebe a definição", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const p = mestre.pagina;
  await abrirAba(p, "mesa");
  await p.getByTestId("automacoes-abrir").click();
  await expect(p.getByTestId("automacoes-janela")).toBeVisible();
  await p.getByTestId("auto-nova-reacao").click();
  await p.getByTestId("form-reacao-nome").fill("Sopro");
  await p.getByTestId("form-reacao-ao").selectOption("__outro");
  await p.getByTestId("form-reacao-ao-outro").fill("inspiracao");
  await p.getByTestId("form-acao-0-tipo").selectOption("som.tocar");
  await p.getByTestId("form-acao-0-adicionar-som").locator("summary").click();
  await p
    .getByTestId("form-acao-0-escolher-arquivo")
    .setInputFiles(arquivoWav("sopro-do-pulmao.wav", 1));
  const hash = await esperarHashDoSom(p, "sopro-do-pulmao.wav");
  await expect(p.getByTestId("form-acao-0-som")).toHaveValue(hash ?? "sem-hash");
  await p.getByTestId("form-acao-0-volume").fill("50");
  await p.getByTestId("form-acao-0-para").selectOption("todos");
  await p.getByTestId("form-reacao-salvar").click();
  await expect(p.getByTestId("auto-reacao-sopro")).toContainText("inspiracao");
  expect(
    mestre.enviados.filter((f) => f.includes('"reacao.criar"') && f.includes("som.tocar")).length,
  ).toBe(1);

  // o evento (um botão, um ciclo ou o próprio sistema) toca o efeito uma vez, para todos
  expect((await somDe(j1.pagina)).efeitos).toEqual([]);
  await ok(p, "evento.disparar", { evento: "inspiracao" });
  for (const s of [mestre.pagina, j1.pagina]) {
    await expect.poll(async () => (await somDe(s)).efeitos.length).toBe(1);
    expect((await somDe(s)).efeitos[0]?.hash).toBe(hash);
    expect((await somDe(s)).efeitos[0]?.volume).toBeCloseTo(0.5 * 0.8, 5);
  }
  // a definição da reação é segredo do mestre: o jogador recebeu o efeito, não a reação
  const doJogador = j1.frames.join("\n");
  expect(doJogador).toContain("som.efeitoTocado");
  for (const proibido of ["som.tocar", "reacao.criar", "automacoes", "inspiracao"]) {
    expect(doJogador, `o frame do jogador trouxe "${proibido}"`).not.toContain(proibido);
  }
});
