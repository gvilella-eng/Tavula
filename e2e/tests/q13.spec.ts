import type { Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, test, tornarMembros } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa, soSelecionarToken, tokenDe } from "./ajudasMapa";

// Q13: segurar a seta numa cena pesada (muitas paredes, escuro, tocha presa ao token, névoa e memória do mapa) anda
// em ritmo contínuo e linear, sem tarefas longas, e o token nunca passa e volta contra a parede.

// O rastro do Playwright tira um retrato do DOM a cada ação e atrapalha a medida.
test.use({ trace: "off" });

const Q = 1.5;
const ID = "tok-jogador-1";

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

type Seg = {
  id: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  tipo: string;
  estado?: string;
};

/** Uma cena parecida com a do Vilella: um corredor reto com portas abertas e cômodos em volta (~160 paredes). */
function paredesPesadas(
  x0: number,
  y0: number,
  larguraM: number,
  alturaM: number,
  fimX: number,
): Seg[] {
  const out: Seg[] = [];
  let n = 0;
  const nova = (ax: number, ay: number, bx: number, by: number, tipo = "parede", estado?: string) =>
    out.push({
      id: `par-q13-${n++}`,
      a: { x: ax, y: ay },
      b: { x: bx, y: by },
      tipo,
      ...(estado ? { estado } : {}),
    });
  const xa = Math.max(0, x0 - 6);
  const xb = Math.min(larguraM, x0 + 36);
  // o corredor: duas paredes em segmentos de 3 m e uma porta aberta a cada 6 m
  for (let x = xa; x < xb; x += 3) {
    nova(x, y0 - 0.75, x + 3, y0 - 0.75);
    nova(x, y0 + 0.75, x + 3, y0 + 0.75);
  }
  for (let x = x0 + 4.5; x < xb; x += 6) nova(x, y0 - 0.75, x, y0 + 0.75, "porta", "aberta");
  nova(fimX, y0 - 0.75, fimX, y0 + 0.75); // o fim do corredor
  // os cômodos: linhas horizontais a cada 6 m e divisórias entre elas, fora do corredor
  for (const lado of [1, -1]) {
    for (let j = 0; j < 8; j++) {
      const y = y0 + lado * (0.75 + 6 * j);
      if (y < 0 || y > alturaM) continue;
      if (j > 0) for (let x = 0; x < larguraM; x += 6) nova(x, y, x + 6, y);
      const y2 = y + lado * 6;
      if (y2 < 0 || y2 > alturaM) continue;
      for (let x = 3; x < larguraM; x += 6) nova(x, y, x, y2);
    }
  }
  return out.slice(0, 200);
}

export type Medida = {
  quadrados: number;
  porSegundo: number;
  intervaloMedioMs: number;
  piorIntervaloMs: number;
  tarefasLongas: number;
  piorTarefaMs: number;
  piorQuadroMs: number;
  /** O quanto o token voltou contra o sentido do passo, em metros (0 = nunca passou e voltou). */
  recuoM: number;
  /** Quadros `erro` que a sala mandou a quem segurou a tecla. */
  erros: number;
  /** Só quando o token recuou: o instante e o x de cada mudança de posição, para achar a causa. */
  serie?: string;
};

type Estado = {
  amostras: { t: number; x: number; y: number }[];
  longas: number[];
  parar: boolean;
};

/**
 * Mede o token `id` por `ms` com `tecla` segurada em `p`: as passagens por quadrado, os quadros e as tarefas longas
 * da página `observador` (por padrão a mesma de quem segura a tecla; passando a do mestre, mede o que quem só olha vê).
 */
async function medirSegurando(
  p: Page,
  id: string,
  tecla: string,
  ms: number,
  observador: Page = p,
): Promise<Medida> {
  const dirX = tecla === "ArrowRight" ? 1 : -1;
  let erros = 0;
  const rede = await p.context().newCDPSession(p);
  await rede.send("Network.enable");
  rede.on("Network.webSocketFrameReceived", (f) => {
    if (f.response.payloadData.includes('"tipo":"erro"')) erros++;
  });
  await observador.evaluate((idDoToken) => {
    const w = window as unknown as { __tabletop: GanchoDoMapa; __q13?: Estado };
    const estado: Estado = { amostras: [], longas: [], parar: false };
    w.__q13 = estado;
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) estado.longas.push(e.duration);
      }).observe({ entryTypes: ["longtask"] });
    } catch {
      // sem longtask
    }
    const laco = (t: number) => {
      const tk = w.__tabletop.tokens().find((x) => x.id === idDoToken);
      if (tk) estado.amostras.push({ t, x: tk.x, y: tk.y });
      if (!estado.parar) requestAnimationFrame(laco);
    };
    requestAnimationFrame(laco);
  }, id);
  await p.waitForTimeout(150);
  // Uma vez só: o app tem relógio próprio e ignora a repetição de tecla do sistema. Nada de ação por quadro aqui
  // (o rastro do Playwright tira retrato do DOM a cada ação e distorce a medida).
  await p.keyboard.down(tecla);
  await p.waitForTimeout(ms);
  await p.keyboard.up(tecla);
  await p.waitForTimeout(400);
  const medida = await observador.evaluate(
    ({ q, dirX }) => {
      const e = (window as unknown as { __q13: Estado }).__q13;
      e.parar = true;
      const a = e.amostras;
      // o instante em que o token entra em cada quadrado novo (entre duas amostras)
      const cel = (s: { x: number; y: number }) => `${Math.floor(s.x / q)},${Math.floor(s.y / q)}`;
      const chegadas: number[] = [];
      for (let i = 1; i < a.length; i++) {
        const ant = a[i - 1];
        const at = a[i];
        if (ant && at && cel(ant) !== cel(at)) chegadas.push((ant.t + at.t) / 2);
      }
      const intervalos = chegadas.slice(1).map((t, i) => t - (chegadas[i] as number));
      const quadros = a.slice(1).map((s, i) => s.t - (a[i] as { t: number }).t);
      const dur =
        chegadas.length > 1
          ? (chegadas[chegadas.length - 1] as number) - (chegadas[0] as number)
          : 0;
      let recuo = 0;
      let ponta = Number.NEGATIVE_INFINITY;
      for (const s of a) {
        ponta = Math.max(ponta, s.x * dirX);
        recuo = Math.max(recuo, ponta - s.x * dirX);
      }
      const media = intervalos.length
        ? intervalos.reduce((s, v) => s + v, 0) / intervalos.length
        : 0;
      return {
        quadrados: chegadas.length,
        porSegundo: dur > 0 ? Math.round(((chegadas.length - 1) / dur) * 10_000) / 10 : 0,
        intervaloMedioMs: Math.round(media),
        piorIntervaloMs: Math.round(Math.max(0, ...intervalos)),
        tarefasLongas: e.longas.length,
        piorTarefaMs: Math.round(Math.max(0, ...e.longas)),
        piorQuadroMs: Math.round(Math.max(0, ...quadros)),
        recuoM: Math.round(recuo * 100) / 100,
        erros: 0,
        serie:
          recuo > 0
            ? a
                .filter((s, i) => i === 0 || s.x !== (a[i - 1] as { x: number }).x)
                .map((s) => `${Math.round(s.t)}:${Math.round(s.x * 100) / 100}`)
                .join(" ")
            : "",
      };
    },
    { q: Q, dirX },
  );
  await rede.detach();
  medida.erros = erros;
  return medida;
}

async function montarCenaPesada(
  mesa: Parameters<typeof entrarNoMapa>[0],
  request: Parameters<typeof tornarMembros>[0],
) {
  await tornarMembros(request, "jogador-1");
  const m = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const base = await tokenDe(j1.pagina, ID);
  const dir = base.x < 25 ? 1 : -1;
  const x0 = dir === 1 ? base.x : base.x - 36;
  await ok(m.pagina, "cena.configurarIluminacao", { luzAmbiente: 0 });
  const paredes = paredesPesadas(
    x0,
    base.y,
    60,
    45,
    dir === 1 ? Math.min(60, x0 + 36) : Math.max(0, x0 - 6),
  );
  for (let i = 0; i < paredes.length; i += 100) {
    await ok(m.pagina, "parede.criar", { cenaId: "cena-1", paredes: paredes.slice(i, i + 100) });
  }
  await ok(m.pagina, "fonte.criar", {
    fonte: {
      id: "luz-q13",
      nome: "Tocha do Aldric",
      portador: { tipo: "token", tokenId: ID },
      luz: { claraM: 6, penumbraM: 6, cor: "#ffcc88", tremula: true },
      intensidade: 1,
      estado: "acesa",
    },
  });
  // névoa: cobre tudo e revela o corredor
  await ok(m.pagina, "nevoa.tracar", {
    cenaId: "cena-1",
    traco: { forma: "tudo", modo: "cobrir", pontos: [] },
  });
  await ok(m.pagina, "nevoa.tracar", {
    cenaId: "cena-1",
    traco: {
      forma: "retangulo",
      modo: "revelar",
      pontos: [
        { x: x0 - 3, y: base.y - 3 },
        { x: x0 + 40, y: base.y + 3 },
      ],
    },
  });
  await expect
    .poll(
      async () =>
        (
          await j1.pagina.evaluate(() =>
            (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paredes(),
          )
        ).length,
    )
    .toBeGreaterThan(paredes.length - 1);
  await soSelecionarToken(j1.pagina, ID);
  return { m, j1, base, dir, tecla: dir === 1 ? "ArrowRight" : "ArrowLeft" };
}

function mostrar(rotulo: string, m: Medida) {
  console.log(`Q13 ${rotulo}: ${JSON.stringify(m)}`);
}

/** O token parou: a tela de quem andou e a do mestre (a posição da sala) o mostram no mesmo lugar, e não se mexe. */
async function esperarAsentar(m: Page, j: Page) {
  const ondeEsta = async () => {
    const [a, b] = await Promise.all([tokenDe(m, ID), tokenDe(j, ID)]);
    return { a, b };
  };
  await expect
    .poll(
      async () => {
        const antes = await ondeEsta();
        await j.waitForTimeout(350);
        const depois = await ondeEsta();
        const igual = Math.hypot(depois.a.x - depois.b.x, depois.a.y - depois.b.y) < 0.01;
        const parado =
          Math.hypot(antes.a.x - depois.a.x, antes.a.y - depois.a.y) < 0.001 &&
          Math.hypot(antes.b.x - depois.b.x, antes.b.y - depois.b.y) < 0.001;
        return igual && parado;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

test("cena pesada: segurar a seta 2 s anda em ritmo contínuo, e a luz e a memória vão junto", async ({
  mesa,
  request,
}) => {
  test.setTimeout(120_000);
  const { m, j1, base, dir, tecla } = await montarCenaPesada(mesa, request);
  const med = await medirSegurando(j1.pagina, ID, tecla, 2_000);
  mostrar("jogador", med);
  // Meta do lote: >= 8 por segundo neste notebook; a asserção é folgada para não ficar instável na bateria.
  expect(med.quadrados).toBeGreaterThanOrEqual(6);
  expect(med.porSegundo).toBeGreaterThanOrEqual(6);
  expect(med.piorIntervaloMs).toBeLessThanOrEqual(Math.max(250, med.intervaloMedioMs * 2.5));
  expect(med.recuoM).toBe(0);
  expect(med.erros).toBe(0);

  // Parou: o mestre vê o token onde o jogador o deixou, e a luz da tocha, a visão e a memória estão certas.
  await esperarAsentar(m.pagina, j1.pagina);
  const fim = await tokenDe(j1.pagina, ID);
  expect(Math.abs(fim.x - base.x)).toBeGreaterThan(Q * 5);
  await expect
    .poll(
      async () =>
        j1.pagina.evaluate(
          ([x, y]) => {
            const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
            const l = h.luzes().find((u) => u.id === "luz-q13");
            return !!l && Math.hypot(l.x - (x as number), l.y - (y as number)) < 0.01;
          },
          [fim.x, fim.y],
        ),
      { timeout: 5_000 },
    )
    .toBe(true);
  const certo = await j1.pagina.evaluate(
    ([x, y, bx, by]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      return {
        luzNoToken: h.visaoNoPonto(x as number, y as number),
        atras: h.lembraNoPonto(bx as number, by as number),
        memoria: h.memoria().lembradas,
      };
    },
    [fim.x, fim.y, fim.x - dir * Q * 3, fim.y],
  );
  expect(certo.luzNoToken).toBe("plena");
  expect(certo.memoria).toBeGreaterThan(0);
  // Três quadrados atrás de onde ele parou (dentro do alcance da luz e da memória): lembrado.
  expect(certo.atras).toBe(true);
});

test("cena pesada: o mestre, olhando, vê o token do jogador andar em linha", async ({
  mesa,
  request,
}) => {
  test.setTimeout(120_000);
  const { m, j1, tecla } = await montarCenaPesada(mesa, request);
  const volta = tecla === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
  // Anda um pouco para dentro do corredor e depois mede a volta na tela do mestre.
  await j1.pagina.keyboard.down(tecla);
  await j1.pagina.waitForTimeout(900);
  await j1.pagina.keyboard.up(tecla);
  await esperarAsentar(m.pagina, j1.pagina);
  const med = await medirSegurando(j1.pagina, ID, volta, 1_000, m.pagina);
  mostrar("mestre olhando", med);
  expect(med.quadrados).toBeGreaterThanOrEqual(4);
  expect(med.piorIntervaloMs).toBeLessThanOrEqual(Math.max(300, med.intervaloMedioMs * 3));
  expect(med.recuoM).toBe(0);
  expect(med.erros).toBe(0);
});

test("cena pesada: segurar a seta até a parede do fim do corredor: para nela, sem passar e voltar", async ({
  mesa,
  request,
}) => {
  test.setTimeout(120_000);
  const { m, j1, base, dir, tecla } = await montarCenaPesada(mesa, request);
  // O corredor tem 36 m (24 quadrados) até a parede: 4,5 s dá e sobra.
  const med = await medirSegurando(j1.pagina, ID, tecla, 4_500);
  mostrar("até a parede", med);
  expect(med.recuoM).toBe(0);
  expect(med.erros).toBe(0);
  await esperarAsentar(m.pagina, j1.pagina);
  const fim = await tokenDe(m.pagina, ID);
  // Parou no último quadrado antes da parede: dentro do corredor, na linha de partida, sem atravessá-la.
  const x0 = dir === 1 ? base.x : base.x - 36;
  const parede = dir === 1 ? Math.min(60, x0 + 36) : Math.max(0, x0 - 6);
  expect(Math.abs(fim.y - base.y)).toBeLessThan(0.01);
  expect((parede - fim.x) * dir).toBeGreaterThan(0);
  expect((parede - fim.x) * dir).toBeLessThanOrEqual(Q);
  // E segura parado: nenhum passo a mais depois de a parede segurar.
  const antes = await tokenDe(j1.pagina, ID);
  await j1.pagina.waitForTimeout(500);
  const depois = await tokenDe(j1.pagina, ID);
  expect(depois.x).toBe(antes.x);
});

// A máquina do Vilella roda o `pnpm dev` mais devagar que a de teste: a CPU 4x mais lenta reproduz o que ele viu
// (cerca de 4 quadrados por segundo, tarefas longas de 300 ms) antes do Q13.
test("cena pesada: com a CPU 4x mais lenta o ritmo se sustenta", async ({ mesa, request }) => {
  test.setTimeout(120_000);
  const { j1, tecla } = await montarCenaPesada(mesa, request);
  const cdp = await j1.pagina.context().newCDPSession(j1.pagina);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  try {
    if (process.env.Q13_PERFIL) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
      await cdp.send("Profiler.start");
    }
    const med = await medirSegurando(j1.pagina, ID, tecla, 3_000);
    if (process.env.Q13_PERFIL) {
      const { profile } = await cdp.send("Profiler.stop");
      (await import("node:fs")).writeFileSync(process.env.Q13_PERFIL, JSON.stringify(profile));
    }
    mostrar("jogador, CPU 4x", med);
    expect(med.porSegundo).toBeGreaterThanOrEqual(5);
    expect(med.recuoM).toBe(0);
    expect(med.erros).toBe(0);
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
});
