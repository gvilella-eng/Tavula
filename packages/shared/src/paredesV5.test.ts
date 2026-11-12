import { describe, expect, it } from "vitest";
import {
  arcoDaParede,
  arcoPorTresPontos,
  bloqueiaVisao,
  CenaSchema,
  calcularModelo,
  criarExportacao,
  type Estado,
  encaixarMeiaCelula,
  estadoInicial,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  meioDaParede,
  meioDoArcoTangente,
  PASSO_DO_ARCO_GRAUS,
  type Parede,
  ParedeSchema,
  type Ponto,
  poligonoDeVisibilidade,
  pontoNaUniao,
  processar,
  segmentosDaParede,
  tangenteNoFim,
  trajetoBloqueado,
  veNoPonto,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const SALA = { larguraM: 40, alturaM: 40 };
const p = (x: number, y: number): Ponto => ({ x, y });
const perto = (a: Ponto, b: Ponto, tol = 1e-3) =>
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(tol);

function parede(extra: Partial<Parede> = {}): Parede {
  return { id: "w", cenaId: "c1", a: p(0, 0), b: p(2, 0), tipo: "parede", ...extra };
}

describe("encaixe em meia célula", () => {
  it("a rede tem 9 pontos por quadrado (cantos, meios das arestas e centro)", () => {
    const q = 2;
    const pontos = new Set<string>();
    for (let x = 0; x <= 2.0001; x += 0.05) {
      for (let y = 0; y <= 2.0001; y += 0.05) {
        const e = encaixarMeiaCelula(p(x, y), q);
        pontos.add(`${e.x},${e.y}`);
      }
    }
    expect([...pontos].sort()).toEqual(
      ["0,0", "1,0", "2,0", "0,1", "1,1", "2,1", "0,2", "1,2", "2,2"].sort(),
    );
  });
  it("usa o meio da célula, não só o canto: num quadrado de 1,5, 0,4 vai para 0,75", () => {
    expect(encaixarMeiaCelula(p(0.4, 1.2), 1.5)).toEqual(p(0.75, 1.5));
    expect(encaixarMeiaCelula(p(0.5, 0.5), 1.5)).toEqual(p(0.75, 0.75));
  });
  it("a diagonal vale e o menor segmento é meia célula", () => {
    const a = encaixarMeiaCelula(p(0.1, 0.1), 1.5);
    const b = encaixarMeiaCelula(p(0.9, 0.9), 1.5);
    expect(a).toEqual(p(0, 0));
    expect(b).toEqual(p(0.75, 0.75));
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(0.75 * Math.SQRT2, 6);
    expect(encaixarMeiaCelula(p(0.2, 0.05), 1.5)).toEqual(p(0, 0));
    expect(encaixarMeiaCelula(p(0.5, 0.05), 1.5)).toEqual(p(0.75, 0));
  });
});

describe("arco para segmentos", () => {
  it("parede sem meio é reta: um segmento só, como sempre", () => {
    const w = parede();
    expect(arcoDaParede(w)).toBeNull();
    expect(segmentosDaParede(w)).toEqual([{ a: w.a, b: w.b }]);
    expect(meioDaParede(w)).toEqual(p(1, 0));
  });
  it("três pontos alinhados viram reta", () => {
    expect(arcoPorTresPontos(p(0, 0), p(1, 0), p(2, 0))).toBeNull();
  });
  it("arco de 3 pontos: meia circunferência, tudo sobre o círculo, pontas e passo de ~10 graus", () => {
    const w = parede({ a: p(0, 0), b: p(10, 0), meio: p(5, 5) });
    const arco = arcoDaParede(w);
    expect(arco?.raio).toBeCloseTo(5, 6);
    perto(arco?.centro as Ponto, p(5, 0));
    const segs = segmentosDaParede(w);
    expect(segs).toHaveLength(18);
    perto(segs[0]?.a as Ponto, w.a);
    perto(segs[17]?.b as Ponto, w.b);
    for (const s of segs) {
      expect(Math.hypot(s.a.x - 5, s.a.y - 0)).toBeCloseTo(5, 6);
      const ang = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) / 5;
      expect((ang * 180) / Math.PI).toBeLessThanOrEqual(PASSO_DO_ARCO_GRAUS + 1e-6);
    }
    expect(segs.some((s) => Math.abs(s.a.x - 5) < 1e-6 && Math.abs(s.a.y - 5) < 1e-6)).toBe(true);
    perto(meioDaParede(w), p(5, 5));
  });
  it("arco pequeno ainda tem ao menos 2 segmentos e fica perto da corda", () => {
    const w = parede({ a: p(0, 0), b: p(4, 0), meio: p(2, 0.1) });
    const segs = segmentosDaParede(w);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    for (const s of segs) expect(Math.abs(s.a.y)).toBeLessThan(0.11);
  });
  it("arco grande (mais de 180 graus) dá a volta pelo lado do ponto do meio", () => {
    const w = parede({ a: p(5, 0.5), b: p(6, 0.5), meio: p(5.5, 8) });
    const arco = arcoDaParede(w);
    expect(Math.abs(arco?.varredura ?? 0)).toBeGreaterThan(Math.PI);
    const segs = segmentosDaParede(w);
    const maxY = Math.max(...segs.map((s) => s.a.y));
    expect(maxY).toBeGreaterThan(7.9);
    perto(segs[0]?.a as Ponto, w.a);
    perto(segs[segs.length - 1]?.b as Ponto, w.b);
  });
  it("o arco abre para o lado do ponto do meio", () => {
    const cima = segmentosDaParede(parede({ a: p(0, 0), b: p(10, 0), meio: p(5, 5) }));
    const baixo = segmentosDaParede(parede({ a: p(0, 0), b: p(10, 0), meio: p(5, -5) }));
    expect(Math.min(...baixo.map((s) => s.a.y))).toBeLessThan(-4.9);
    expect(Math.min(...cima.map((s) => s.a.y))).toBeGreaterThanOrEqual(-1e-9);
  });
  it("arco tangente: sai tangente à reta anterior e chega no ponto", () => {
    const meio = meioDoArcoTangente(p(0, 0), p(1, 0), p(2, 2));
    perto(meio as Ponto, p(Math.SQRT2, 2 - Math.SQRT2));
    const w = parede({ a: p(0, 0), b: p(2, 2), meio: meio as Ponto });
    const arco = arcoDaParede(w);
    expect(arco?.raio).toBeCloseTo(2, 3);
    perto(arco?.centro as Ponto, p(0, 2));
    const s0 = segmentosDaParede(w)[0] as { a: Ponto; b: Ponto };
    expect(Math.abs(s0.b.x - s0.a.x)).toBeGreaterThan(Math.abs(s0.b.y - s0.a.y));
    const t = tangenteNoFim(w);
    expect(t.x).toBeCloseTo(0, 3);
    expect(t.y).toBeCloseTo(1, 3);
  });
  it("arco tangente para o outro lado e com fim para trás (arco grande)", () => {
    const outro = meioDoArcoTangente(p(0, 0), p(1, 0), p(2, -2));
    perto(outro as Ponto, p(Math.SQRT2, -2 + Math.SQRT2));
    const grande = meioDoArcoTangente(p(0, 0), p(1, 0), p(-1, 1));
    expect(grande).not.toBeNull();
    const arco = arcoDaParede(parede({ a: p(0, 0), b: p(-1, 1), meio: grande as Ponto }));
    expect(Math.abs(arco?.varredura ?? 0)).toBeGreaterThan(Math.PI);
  });
  it("arco tangente com o fim sobre a tangente não existe (vira reta)", () => {
    expect(meioDoArcoTangente(p(0, 0), p(1, 0), p(5, 0))).toBeNull();
    expect(meioDoArcoTangente(p(0, 0), p(1, 0), p(0, 0))).toBeNull();
  });
  it("a tangente do fim de uma reta é a direção dela", () => {
    expect(tangenteNoFim(parede({ a: p(0, 0), b: p(0, 3) }))).toEqual(p(0, 1));
  });
});

describe("visão, luz e passagem bloqueadas pelo arco", () => {
  const escudo = parede({ a: p(14, 6), b: p(14, 14), meio: p(18, 10) });
  const segs = bloqueiaVisao(escudo) ? segmentosDaParede(escudo) : [];

  it("a visão bloqueia atrás do arco e vê o que está antes dele", () => {
    const poli = poligonoDeVisibilidade(p(8, 10), segs, SALA, null);
    expect(pontoNaUniao(p(16, 10), [poli])).toBe(true);
    expect(pontoNaUniao(p(25, 10), [poli])).toBe(false);
    expect(pontoNaUniao(p(21, 12), [poli])).toBe(false);
  });
  it("a luz do lado de dentro do arco não vaza para fora", () => {
    const modelo = calcularModelo({
      olhos: [],
      luzes: [
        { x: 15, y: 10, claraM: 4, totalM: 8, cor: "#ffffff", intensidade: 1, tremula: false },
      ] as never,
      segmentos: segs,
      limites: SALA,
      ambiente: 0,
    });
    const comVisao = { ...modelo, visao: modelo.luzes.map((l) => l.total) };
    expect(veNoPonto(comVisao, p(17, 10))).toBe(true);
    expect(veNoPonto(comVisao, p(21, 10))).toBe(false);
  });
  it("o token não atravessa o arco (e passa pela abertura)", () => {
    expect(trajetoBloqueado(p(8, 10), p(22, 10), [escudo])).toBe(true);
    expect(trajetoBloqueado(p(8, 10), p(22, 0), [escudo])).toBe(false);
    expect(trajetoBloqueado(p(8, 10), p(12, 10), [escudo])).toBe(false);
    expect(trajetoBloqueado(p(18, 10), p(22, 10), [escudo])).toBe(false);
  });
  it("porta em arco aberta não bloqueia; fechada bloqueia", () => {
    const porta = { ...escudo, tipo: "porta" as const, estado: "aberta" as const };
    expect(trajetoBloqueado(p(8, 10), p(22, 10), [porta])).toBe(false);
    expect(trajetoBloqueado(p(8, 10), p(22, 10), [{ ...porta, estado: "fechada" }])).toBe(true);
  });
});

describe("migração: o campo novo da parede e da cena", () => {
  it("parede antiga (sem meio) carrega e fica reta", () => {
    const antiga = ParedeSchema.parse({
      id: "w",
      cenaId: "c1",
      a: p(0, 0),
      b: p(2, 0),
      tipo: "parede",
    });
    expect(antiga.meio).toBeUndefined();
    expect(segmentosDaParede(antiga)).toHaveLength(1);
  });
  it("cena antiga carrega sem o campo (desligado)", () => {
    const cena = CenaSchema.parse({
      id: "c1",
      nome: "Sala",
      larguraM: 30,
      alturaM: 30,
      grid: { quadradoM: 1.5, visivel: true },
    });
    expect(cena.mostrarParedesAosJogadores).toBeUndefined();
  });
});

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
    ],
    cenas: [
      {
        id: "c1",
        nome: "Sala",
        larguraM: 30,
        alturaM: 30,
        grid: { quadradoM: 1.5, visivel: true },
      },
    ],
    cenaAtivaId: "c1",
    tokens: [],
  });
}
let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `v5-${++contador}`, tipo, dados });
function aplicar(e: Estado, quem: string, i: Intencao): Estado {
  const r = processar(e, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo}`);
  return r.estado;
}

describe("parede em arco na sala", () => {
  it("criar guarda o meio; editar uma ponta leva o arco junto; null endireita", () => {
    let e = aplicar(
      criarEstado(),
      "m",
      intencao("parede.criar", {
        paredes: [{ id: "arco", a: p(2, 2), b: p(8, 2), meio: p(5, 5), tipo: "parede" }],
      }),
    );
    expect(e.paredes[0]?.meio).toEqual(p(5, 5));
    e = aplicar(e, "m", intencao("parede.editar", { id: "arco", b: p(10, 2) }));
    expect(e.paredes[0]?.meio).toEqual(p(6, 5));
    e = aplicar(e, "m", intencao("parede.editar", { id: "arco", meio: null }));
    expect(e.paredes[0]?.meio).toBeUndefined();
  });
  it("três pontos alinhados: a parede nasce reta", () => {
    const e = aplicar(
      criarEstado(),
      "m",
      intencao("parede.criar", {
        paredes: [{ id: "x", a: p(2, 2), b: p(8, 2), meio: p(5, 2), tipo: "parede" }],
      }),
    );
    expect(e.paredes[0]?.meio).toBeUndefined();
  });
  it("jogador não cria parede", () => {
    const r = processar(
      criarEstado(),
      "j1",
      intencao("parede.criar", { paredes: [{ id: "z", a: p(1, 1), b: p(2, 2), tipo: "parede" }] }),
      AGORA,
    );
    expect(r.ok).toBe(false);
  });
  it("o campo da cena liga e desliga (e some do estado ao desligar)", () => {
    let e = aplicar(
      criarEstado(),
      "m",
      intencao("cena.editar", { cenaId: "c1", mostrarParedesAosJogadores: true }),
    );
    expect(e.cenas[0]?.mostrarParedesAosJogadores).toBe(true);
    expect(visaoPara(e, { id: "j1", papel: "jogador" }).cenas[0]?.mostrarParedesAosJogadores).toBe(
      true,
    );
    e = aplicar(
      e,
      "m",
      intencao("cena.editar", { cenaId: "c1", nome: "Sala 2", mostrarParedesAosJogadores: false }),
    );
    expect(e.cenas[0]).not.toHaveProperty("mostrarParedesAosJogadores");
    expect(e.cenas[0]?.nome).toBe("Sala 2");
  });
  it("o jogador recebe o arco, mas a secreta (em arco) chega como parede e nunca como secreta", () => {
    let e = aplicar(
      criarEstado(),
      "m",
      intencao("parede.criar", {
        paredes: [
          { id: "s", a: p(2, 2), b: p(8, 2), meio: p(5, 5), tipo: "secreta", estado: "fechada" },
          { id: "arco", a: p(2, 8), b: p(8, 8), meio: p(5, 11), tipo: "janela" },
        ],
      }),
    );
    const visto = visaoPara(e, { id: "j1", papel: "jogador" });
    expect(JSON.stringify(visto)).not.toContain("secreta");
    const s = visto.paredes.find((w) => w.id === "s");
    expect(s?.tipo).toBe("parede");
    expect(s?.estado).toBeUndefined();
    expect(s?.meio).toEqual(p(5, 5));
    expect(visto.paredes.find((w) => w.id === "arco")?.meio).toEqual(p(5, 11));
    e = aplicar(e, "m", intencao("porta.alternar", { id: "s" }));
    expect(JSON.stringify(visaoPara(e, { id: "j1", papel: "jogador" }))).not.toContain("secreta");
  });
  it("exportar e importar a mesa preserva o arco e o campo da cena; arquivo antigo carrega", () => {
    let e = aplicar(
      criarEstado(),
      "m",
      intencao("parede.criar", {
        paredes: [{ id: "arco", a: p(2, 2), b: p(8, 2), meio: p(5, 5), tipo: "parede" }],
      }),
    );
    e = aplicar(
      e,
      "m",
      intencao("cena.editar", { cenaId: "c1", mostrarParedesAosJogadores: true }),
    );
    const arquivo = JSON.parse(JSON.stringify(criarExportacao(e, AGORA)));
    const lido = lerExportacao(arquivo);
    expect(lido.ok).toBe(true);
    if (lido.ok) {
      expect(lido.exportacao.dados.paredes[0]?.meio).toEqual(p(5, 5));
      expect(lido.exportacao.dados.cenas[0]?.mostrarParedesAosJogadores).toBe(true);
    }
    const velho = JSON.parse(JSON.stringify(arquivo));
    delete velho.dados.paredes[0].meio;
    delete velho.dados.cenas[0].mostrarParedesAosJogadores;
    expect(lerExportacao(velho).ok).toBe(true);
  });
});
