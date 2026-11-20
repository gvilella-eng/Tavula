import type { APIRequestContext, Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { soltarArquivoNoMapa, soltarArquivosNoMapa } from "./ajudasAssets";
import {
  arrastarToken,
  entrarNoMapa,
  esperarPosicao,
  type GanchoDoMapa,
  tokenDe,
} from "./ajudasMapa";
import { arquivoWav } from "./ajudasSom";

// FG2: o token do mestre que não mexia, a luz com a cor para o mestre, a tocha na mão animada, a fogueira de um fogo só
// e o som arrastado que vai para a biblioteca de música.

const ALDRIC = "pers-aldric";
const BRISA = "pers-brisa";
const TOCHA = "modelo-tocha";

const zoomPara = (p: Page, z: number) =>
  p.evaluate(
    (zz) => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.definirZoom(zz),
    z,
  );

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

async function abrirModelo(p: Page, id: string) {
  await abrirAba(p, "mesa");
  const corpo = p.getByTestId(`modelo-nome-${id}`);
  if (!(await corpo.isVisible())) await p.getByTestId(`modelo-resumo-${id}`).click();
  await expect(corpo).toBeVisible();
}

const chamas = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.chamas());

/** Adianta o relógio da sala (gancho de teste: só existe com MODO=teste). */
async function adiantar(request: APIRequestContext, ms: number) {
  const r = await request.post(`/teste/avancar-relogio?ms=${ms}`);
  expect(r.ok()).toBe(true);
}

const corDaLuz = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([xx, yy]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.corDaLuzNoPonto(
        xx as number,
        yy as number,
      ),
    [x, y],
  );

test("o mestre vê a mesma cor de luz que o jogador, antes e depois de mudar a cor do modelo", async ({
  mesa,
}) => {
  // A Brisa não tem visão no escuro (a do Aldric soma meia luz e lava a cor para quem a tem): é a jogadora que o teste compara.
  const mestre = await entrarNoMapa(mesa, "mestre");
  await ok(mestre.pagina, "mochila.ajustar", { personagemId: BRISA, modeloId: TOCHA, delta: 1 });
  await ok(mestre.pagina, "tocha.acender", {
    personagemId: BRISA,
    modeloId: TOCHA,
    novoId: "tocha-1",
  });
  const j1 = await entrarNoMapa(mesa, "jogador-2");
  // sem tremular, para a cor não variar entre uma leitura e outra
  await abrirModelo(mestre.pagina, TOCHA);
  const tremula = mestre.pagina.getByTestId(`modelo-tremula-${TOCHA}`);
  if (await tremula.isChecked()) {
    await tremula.click();
    await expect(tremula).not.toBeChecked();
  }
  const aldric = await tokenDe(j1.pagina, "tok-jogador-2");
  // dentro do raio da tocha (luz plena de 6 m), sem ser o token
  const alvo = { x: aldric.x + 1.5, y: aldric.y + 2.25 };

  const par = async () => {
    const m = await corDaLuz(mestre.pagina, alvo.x, alvo.y);
    const j = await corDaLuz(j1.pagina, alvo.x, alvo.y);
    return { m, j };
  };
  const igual = (a: number[] | null, b: number[] | null) =>
    a !== null && b !== null && a.every((v, i) => Math.abs(v - (b[i] as number)) <= 12);

  await expect
    .poll(async () => {
      const { m, j } = await par();
      return igual(m, j) ? "igual" : `mestre ${m} jogador ${j}`;
    })
    .toBe("igual");
  const antes = (await par()).m as number[];
  // a tocha laranja: vermelho acima do azul
  expect(antes[0], `luz ${antes}`).toBeGreaterThan(antes[2] as number);

  await mestre.pagina.getByTestId(`modelo-cor-${TOCHA}`).fill("#2266ff");
  await expect
    .poll(async () => {
      const { m, j } = await par();
      if (!igual(m, j)) return `mestre ${m} jogador ${j}`;
      const [vermelho = 0, , azul = 0] = m as number[];
      return azul > vermelho + 20 ? "azul" : `ainda ${m}`;
    })
    .toBe("azul");

  // e a distância: aumentar a luz plena aumenta o que os dois enxergam, juntos
  // (a oeste, longe do braseiro e da outra tocha da cena: só a tocha da Brisa chega aqui)
  const longe = { x: aldric.x - 7.5, y: aldric.y };
  const clara = async (p: Page) => (await corDaLuz(p, longe.x, longe.y)) as number[];
  const antesLonge = await clara(mestre.pagina);
  await abrirModelo(mestre.pagina, TOCHA);
  const campo = mestre.pagina.getByTestId(`modelo-clara-${TOCHA}`);
  await campo.fill("9");
  await campo.blur();
  await expect
    .poll(async () => {
      const m = await clara(mestre.pagina);
      const j = await clara(j1.pagina);
      return igual(m, j) && (m[2] as number) > (antesLonge[2] as number) + 20
        ? "alcance"
        : `mestre ${m} jogador ${j} antes ${antesLonge}`;
    })
    .toBe("alcance");
});

test("a chama padrão (tocha e fogueira, três estágios) é uma região só em todo quadro; a fogueira acesa é uma chama só, sem lenha", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  // a silhueta (alfa acima do limiar) das folhas geradas de verdade, no navegador
  for (const estilo of ["tocha", "fogueira"] as const) {
    for (const estagio of ["forte", "fraca", "morrendo"] as const) {
      const regioes = await mestre.pagina.evaluate(
        ([e, s]) =>
          (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.regioesDaChama(
            e as "tocha" | "fogueira",
            s as "forte" | "fraca" | "morrendo",
          ),
        [estilo, estagio],
      );
      expect(regioes, `${estilo} ${estagio}`).toEqual(Array(16).fill(1));
    }
  }

  // uma fogueira acesa no mapa: uma chama só, do estilo da fogueira, no tamanho do inflamável
  await ok(mestre.pagina, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 1 });
  await ok(mestre.pagina, "ponto.criar", {
    ponto: {
      id: "lenha",
      nome: "Fogueira",
      x: 12.75,
      y: 9.75,
      tipo: "inflamavel",
      modeloId: "modelo-fogueira",
      segurarS: 0,
      visivelParaJogadores: true,
    },
  });
  await ok(mestre.pagina, "tocha.acender", {
    personagemId: ALDRIC,
    modeloId: TOCHA,
    novoId: "tocha-1",
  });
  await mestre.pagina.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
        ws.onopen = () => {
          for (const [i, tipo] of ["ponto.acenderInicio", "ponto.acenderFim"].entries()) {
            ws.send(
              JSON.stringify({
                v: 1,
                id: `fg2-${i}`,
                tipo,
                dados: { pontoId: "lenha", objetoId: "tocha-1" },
              }),
            );
          }
          setTimeout(() => {
            ws.close();
            resolve();
          }, 400);
        };
      }),
  );
  await expect.poll(async () => (await chamas(mestre.pagina)).length).toBe(1);
  const f = (await chamas(mestre.pagina))[0];
  expect(f).toMatchObject({ estagio: "forte", origem: "padrao", quadros: 16 });
});

test("a tocha na mão é uma chama animada pequena, com os 3 estágios; a lanterna mantém o ícone", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await ok(mestre.pagina, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 1 });
  await ok(mestre.pagina, "mochila.ajustar", {
    personagemId: ALDRIC,
    modeloId: "modelo-lanterna",
    delta: 1,
  });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await ok(j1.pagina, "tocha.acender", {
    personagemId: ALDRIC,
    modeloId: TOCHA,
    novoId: "tocha-1",
  });
  const naMao = (p: Page) =>
    p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.chamasDaMao());
  for (const p of [j1.pagina, mestre.pagina]) {
    await expect.poll(async () => (await naMao(p)).length).toBe(1);
    expect((await naMao(p))[0]).toMatchObject({ estagio: "forte", origem: "padrao", quadros: 16 });
    // pequena (cabe no pino do token, que mede entre 18 e 30 px)
    const c = (await naMao(p))[0] as Awaited<ReturnType<typeof chamas>>[number];
    expect(c.alturaPx).toBeGreaterThan(18);
    expect(c.alturaPx).toBeLessThan(80);
  }

  // a lanterna não tem fogo (não tremula): continua o ícone, sem chama animada
  await ok(j1.pagina, "tocha.acender", {
    personagemId: ALDRIC,
    modeloId: "modelo-lanterna",
    novoId: "lanterna-1",
  });
  await expect.poll(async () => (await luzesDaMao(j1.pagina)).length).toBe(2);
  expect(await naMao(j1.pagina)).toHaveLength(1);

  // os estágios acompanham o tempo da tocha (60 min; fraca com menos de 50%, morrendo com menos de 10%)
  await adiantar(request, 35 * 60_000);
  for (const p of [j1.pagina, mestre.pagina]) {
    await expect.poll(async () => (await naMao(p))[0]?.estagio).toBe("fraca");
  }
  await adiantar(request, 20 * 60_000);
  for (const p of [j1.pagina, mestre.pagina]) {
    await expect.poll(async () => (await naMao(p))[0]?.estagio).toBe("morrendo");
  }
});

const luzesDaMao = (p: Page) =>
  p.evaluate(() =>
    (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop
      .alcas()
      .filter((a) => a.portador === "mao"),
  );

test("som solto na mesa vai para a biblioteca de música (o mestre); o jogador é recusado", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const alvo = { x: 500, y: 300 };

  // o jogador solta um som: só o aviso, nada entra
  await soltarArquivoNoMapa(j1.pagina, arquivoWav("jogador.wav", 2), alvo);
  await expect(j1.pagina.getByTestId("aviso")).toContainText("Só o mestre põe música");

  // o mestre solta dois de uma vez: os dois entram, com o nome do arquivo e sem etiquetas
  await soltarArquivosNoMapa(
    mestre.pagina,
    [arquivoWav("Taverna.wav", 2), arquivoWav("Cripta.wav", 3)],
    alvo,
  );
  await expect(mestre.pagina.getByTestId("aviso")).toContainText(
    "2 músicas adicionadas à biblioteca de música",
  );
  await mestre.pagina.getByRole("button", { name: "Abrir a biblioteca" }).click();
  await expect(mestre.pagina.getByTestId("musica-biblioteca")).toBeVisible();
  const linhas = mestre.pagina.getByTestId("musica-linha");
  await expect(linhas).toHaveCount(2);
  await expect(linhas.filter({ hasText: "Taverna" })).toHaveCount(1);
  await expect(linhas.filter({ hasText: "Cripta" })).toHaveCount(1);
  // o som do jogador não entrou
  await expect(mestre.pagina.getByTestId("musica-biblioteca")).not.toContainText("jogador");

  // um só arquivo: o aviso no singular; o mesmo arquivo de novo não duplica a faixa
  await soltarArquivoNoMapa(mestre.pagina, arquivoWav("Taverna.wav", 2), alvo);
  await expect(mestre.pagina.getByTestId("aviso")).toContainText(
    "Adicionada à biblioteca de música",
  );
  await expect(linhas).toHaveCount(2);
});

test("o mestre vê a cor de uma tocha numa área que nenhum jogador vê, e mudar a cor do modelo muda para ele", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await ok(mestre.pagina, "mochila.ajustar", { personagemId: BRISA, modeloId: TOCHA, delta: 1 });
  await ok(mestre.pagina, "ponto.criar", {
    ponto: {
      id: "longe",
      nome: "Gancho longe",
      x: 45,
      y: 30,
      tipo: "suporte",
      visivelParaJogadores: true,
    },
  });
  await ok(mestre.pagina, "tocha.acender", {
    personagemId: BRISA,
    modeloId: TOCHA,
    novoId: "tocha-longe",
  });
  await ok(mestre.pagina, "tocha.posar", { id: "tocha-longe", pontoId: "longe" });
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await abrirModelo(mestre.pagina, TOCHA);
  const tremula = mestre.pagina.getByTestId(`modelo-tremula-${TOCHA}`);
  if (await tremula.isChecked()) {
    await tremula.click();
    await expect(tremula).not.toBeChecked();
  }
  const perto = { x: 46.5, y: 30 };
  // nenhum jogador vê ali (a Brisa está a mais de 30 m)
  await expect
    .poll(() =>
      j2.pagina.evaluate(
        ([x, y]) =>
          (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.veNoPonto(
            x as number,
            y as number,
          ),
        [perto.x, perto.y],
      ),
    )
    .toBe(false);
  const lerMestre = async () => (await corDaLuz(mestre.pagina, perto.x, perto.y)) as number[];
  // a tocha laranja: o mestre vê o vermelho acima do azul, mesmo sem jogador vendo
  await expect
    .poll(async () => {
      const [r = 0, , b = 0] = await lerMestre();
      return r > b + 20 ? "laranja" : `${await lerMestre()}`;
    })
    .toBe("laranja");
  // fora do alcance da tocha continua o mapa apagado (cinza), nunca preto
  const fora = (await corDaLuz(mestre.pagina, 40, 20)) as number[];
  expect(Math.min(...fora)).toBeGreaterThan(60);
  await mestre.pagina.getByTestId(`modelo-cor-${TOCHA}`).fill("#2266ff");
  await expect
    .poll(async () => {
      const [r = 0, , b = 0] = await lerMestre();
      return b > r + 20 ? "azul" : `${await lerMestre()}`;
    })
    .toBe("azul");
});

test("o mestre arrasta o token que segura uma tocha, com o mapa afastado, e depois de mudar o modelo dela", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await ok(mestre.pagina, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 1 });
  await ok(mestre.pagina, "tocha.acender", {
    personagemId: ALDRIC,
    modeloId: TOCHA,
    novoId: "tocha-1",
  });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const id = "tok-jogador-1";
  const antes = await tokenDe(mestre.pagina, id);

  // o mapa afastado (o token fica pequeno): o pino da tocha cobria o meio do token e o clique virava arrasto da tocha
  await zoomPara(mestre.pagina, 0.3);
  await arrastarToken(mestre.pagina, id, 0, 1.5);
  await esperarPosicao(mestre.pagina, id, antes.x, antes.y + 1.5);

  await abrirModelo(mestre.pagina, TOCHA);
  const campo = mestre.pagina.getByTestId(`modelo-clara-${TOCHA}`);
  await campo.fill("8");
  await campo.blur();
  await mestre.pagina.getByTestId(`modelo-cor-${TOCHA}`).fill("#33ccff");
  await expect.poll(async () => (await tokenDe(j1.pagina, id)).y).toBeCloseTo(antes.y + 1.5);

  await arrastarToken(mestre.pagina, id, 1.5, 0);
  await esperarPosicao(mestre.pagina, id, antes.x + 1.5, antes.y + 1.5);
  await zoomPara(mestre.pagina, 1);
  await arrastarToken(mestre.pagina, id, -1.5, 0);
  await esperarPosicao(mestre.pagina, id, antes.x, antes.y + 1.5);
  await arrastarToken(j1.pagina, id, 0, -1.5);
  await esperarPosicao(mestre.pagina, id, antes.x, antes.y);
});
