import { describe, expect, it } from "vitest";
import {
  acrescentarTraco,
  CenaSchema,
  compactarNevoa,
  criarExportacao,
  type Estado,
  estadoInicial,
  eventoPara,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  MAXIMO_DE_PONTOS_DA_NEVOA,
  MAXIMO_DE_TRACOS_DA_NEVOA,
  nevoaCobreAlgo,
  pontoNaNevoa,
  processar,
  simplificarCaminho,
  type TracoDaNevoa,
  tirarUltimoTraco,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const J1 = { id: "j1", papel: "jogador" as const };
const MESTRE = { id: "m", papel: "mestre" as const };

const tudo = (modo: "cobrir" | "revelar"): TracoDaNevoa => ({ forma: "tudo", modo, pontos: [] });
const retangulo = (modo: "cobrir" | "revelar", x0: number, y0: number, x1: number, y1: number) =>
  ({
    forma: "retangulo",
    modo,
    pontos: [
      { x: x0, y: y0 },
      { x: x1, y: y1 },
    ],
  }) satisfies TracoDaNevoa;
const pincel = (modo: "cobrir" | "revelar", pontos: { x: number; y: number }[], raio = 1) =>
  ({ forma: "pincel", modo, pontos, raio }) satisfies TracoDaNevoa;

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
    ],
    cenas: [
      {
        id: "c1",
        nome: "Cidade",
        larguraM: 30,
        alturaM: 30,
        grid: { quadradoM: 1.5, visivel: true },
      },
      {
        id: "c2",
        nome: "Outra",
        larguraM: 30,
        alturaM: 30,
        grid: { quadradoM: 1.5, visivel: true },
      },
    ],
    cenaAtivaId: "c1",
  });
}

let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `nevoa-${++contador}`, tipo, dados });
function aplicar(e: Estado, quem: string, i: Intencao) {
  const r = processar(e, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo}`);
  return r;
}
const tracar = (e: Estado, traco: TracoDaNevoa, cenaId = "c1") =>
  aplicar(e, "m", intencao("nevoa.tracar", { cenaId, traco })).estado;

describe("N4: composição de cobrir e revelar", () => {
  it("sem traço está revelado; o último traço que contém o ponto decide", () => {
    const dentro = { x: 5, y: 5 };
    expect(pontoNaNevoa(undefined, dentro)).toBe(false);
    expect(pontoNaNevoa([], dentro)).toBe(false);
    const lista = [tudo("cobrir"), retangulo("revelar", 0, 0, 10, 10)];
    expect(pontoNaNevoa(lista, dentro)).toBe(false);
    expect(pontoNaNevoa(lista, { x: 20, y: 20 })).toBe(true);
    // cobrir de novo por cima do que foi revelado
    const recoberto = [...lista, retangulo("cobrir", 4, 4, 6, 6)];
    expect(pontoNaNevoa(recoberto, dentro)).toBe(true);
    expect(pontoNaNevoa(recoberto, { x: 1, y: 1 })).toBe(false);
  });

  it("o pincel cobre a faixa em volta do caminho; o polígono, a área", () => {
    const caminho = [
      tudo("cobrir"),
      pincel(
        "revelar",
        [
          { x: 2, y: 5 },
          { x: 20, y: 5 },
        ],
        1,
      ),
    ];
    expect(pontoNaNevoa(caminho, { x: 10, y: 5.9 })).toBe(false);
    expect(pontoNaNevoa(caminho, { x: 10, y: 6.5 })).toBe(true);
    // ponto só (um clique): círculo
    const clique = [tudo("cobrir"), pincel("revelar", [{ x: 8, y: 8 }], 2)];
    expect(pontoNaNevoa(clique, { x: 9, y: 9 })).toBe(false);
    expect(pontoNaNevoa(clique, { x: 11, y: 8 })).toBe(true);
    const triangulo: TracoDaNevoa = {
      forma: "poligono",
      modo: "cobrir",
      pontos: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ],
    };
    expect(pontoNaNevoa([triangulo], { x: 2, y: 2 })).toBe(true);
    expect(pontoNaNevoa([triangulo], { x: 8, y: 8 })).toBe(false);
  });

  it('só cobre algo se, do último "tudo" em diante, houver cobrir', () => {
    expect(nevoaCobreAlgo(undefined)).toBe(false);
    expect(nevoaCobreAlgo([retangulo("revelar", 0, 0, 1, 1)])).toBe(false);
    expect(nevoaCobreAlgo([tudo("cobrir")])).toBe(true);
    expect(nevoaCobreAlgo([tudo("cobrir"), tudo("revelar")])).toBe(false);
    expect(nevoaCobreAlgo([retangulo("cobrir", 0, 0, 1, 1), tudo("revelar")])).toBe(false);
    expect(nevoaCobreAlgo([tudo("revelar"), retangulo("cobrir", 0, 0, 1, 1)])).toBe(true);
  });

  it("o desfazer tira o último traço", () => {
    const lista = [tudo("cobrir"), retangulo("revelar", 0, 0, 10, 10)];
    expect(tirarUltimoTraco(lista)).toEqual([lista[0]]);
    expect(tirarUltimoTraco(undefined)).toEqual([]);
  });

  it("o traço inválido é recusado pelo schema", () => {
    const ruim = (traco: object) =>
      IntencaoSchema.safeParse({
        v: 1,
        id: "x",
        tipo: "nevoa.tracar",
        dados: { cenaId: "c1", traco },
      }).success;
    expect(ruim({ forma: "poligono", modo: "cobrir", pontos: [{ x: 0, y: 0 }] })).toBe(false);
    expect(ruim({ forma: "pincel", modo: "cobrir", pontos: [{ x: 0, y: 0 }] })).toBe(false);
    expect(ruim({ forma: "tudo", modo: "cobrir", pontos: [{ x: 0, y: 0 }] })).toBe(false);
    expect(ruim({ forma: "tudo", modo: "cobrir", pontos: [] })).toBe(true);
  });
});

describe("N4: a sala (intenções e eventos)", () => {
  it("o mestre cobre tudo, revela um retângulo e desfaz; a cena guarda os traços", () => {
    let e = tracar(criarEstado(), tudo("cobrir"));
    e = tracar(e, retangulo("revelar", 3, 3, 9, 9));
    expect(e.cenas[0]?.nevoa).toHaveLength(2);
    expect(pontoNaNevoa(e.cenas[0]?.nevoa, { x: 5, y: 5 })).toBe(false);
    expect(pontoNaNevoa(e.cenas[0]?.nevoa, { x: 20, y: 20 })).toBe(true);
    e = aplicar(e, "m", intencao("nevoa.desfazer", { cenaId: "c1" })).estado;
    expect(pontoNaNevoa(e.cenas[0]?.nevoa, { x: 5, y: 5 })).toBe(true);
    e = aplicar(e, "m", intencao("nevoa.desfazer", { cenaId: "c1" })).estado;
    // lista vazia: o campo some (cena como as antigas)
    expect(e.cenas[0]).not.toHaveProperty("nevoa");
    // desfazer sem nada não é erro
    aplicar(e, "m", intencao("nevoa.desfazer", { cenaId: "c1" }));
  });

  it("só o mestre (cena.editar) traça; cena que não existe é recusada", () => {
    const e = criarEstado();
    const r = processar(
      e,
      "j1",
      intencao("nevoa.tracar", { cenaId: "c1", traco: tudo("cobrir") }),
      AGORA,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("sem_permissao");
    const d = processar(e, "j1", intencao("nevoa.desfazer", { cenaId: "c1" }), AGORA);
    expect(d.ok).toBe(false);
    const inexistente = processar(
      e,
      "m",
      intencao("nevoa.tracar", { cenaId: "nada", traco: tudo("cobrir") }),
      AGORA,
    );
    expect(inexistente.ok).toBe(false);
    if (!inexistente.ok) expect(inexistente.erro.codigo).toBe("cena_inexistente");
  });

  it("o jogador recebe a névoa da cena ativa (snapshot e evento), não a de outra cena", () => {
    const e = tracar(criarEstado(), tudo("cobrir"));
    expect(visaoPara(e, J1).cenas[0]?.nevoa).toHaveLength(1);
    const r = aplicar(
      e,
      "m",
      intencao("nevoa.tracar", { cenaId: "c1", traco: retangulo("revelar", 1, 1, 4, 4) }),
    );
    const ev = r.eventos[0];
    if (!ev) throw new Error("sem evento");
    expect(ev.tipo).toBe("nevoa.tracada");
    expect(eventoPara(ev, J1, e, r.estado)).not.toBeNull();
    expect(eventoPara(ev, MESTRE, e, r.estado)).not.toBeNull();
    const outra = aplicar(
      e,
      "m",
      intencao("nevoa.tracar", { cenaId: "c2", traco: tudo("cobrir") }),
    );
    const evOutra = outra.eventos[0];
    if (!evOutra) throw new Error("sem evento");
    expect(eventoPara(evOutra, J1, e, outra.estado)).toBeNull();
    expect(eventoPara(evOutra, MESTRE, e, outra.estado)).not.toBeNull();
  });

  it("duplicar a cena leva a névoa", () => {
    let e = tracar(criarEstado(), tudo("cobrir"));
    e = tracar(e, retangulo("revelar", 1, 1, 4, 4));
    e = aplicar(e, "m", intencao("cena.duplicar", { cenaId: "c1", novoId: "c3" })).estado;
    expect(e.cenas.find((c) => c.id === "c3")?.nevoa).toEqual(e.cenas[0]?.nevoa);
  });

  it("exportar e importar levam a névoa; arquivo antigo (sem ela) carrega", () => {
    let e = tracar(criarEstado(), tudo("cobrir"));
    e = tracar(
      e,
      pincel(
        "revelar",
        [
          { x: 1, y: 1 },
          { x: 5, y: 5 },
        ],
        1.5,
      ),
    );
    const arquivo = JSON.parse(JSON.stringify(criarExportacao(e, AGORA)));
    const lido = lerExportacao(arquivo);
    expect(lido.ok).toBe(true);
    if (lido.ok) expect(lido.exportacao.dados.cenas[0]?.nevoa).toEqual(e.cenas[0]?.nevoa);
    const velho = JSON.parse(JSON.stringify(arquivo));
    delete velho.dados.cenas[0].nevoa;
    const lidoVelho = lerExportacao(velho);
    expect(lidoVelho.ok).toBe(true);
    if (lidoVelho.ok) expect(lidoVelho.exportacao.dados.cenas[0]?.nevoa).toBeUndefined();
  });

  it("a cena antiga carrega sem o campo", () => {
    const cena = CenaSchema.parse({
      id: "c1",
      nome: "Sala",
      larguraM: 30,
      alturaM: 30,
      grid: { quadradoM: 1.5, visivel: true },
    });
    expect(cena.nevoa).toBeUndefined();
  });
});

describe("N4: o limite de crescimento", () => {
  it("compactar: o começo vale a partir do último 'tudo' e 'revelar' antes de cobrir sai", () => {
    expect(compactarNevoa([retangulo("revelar", 0, 0, 1, 1)])).toEqual([]);
    expect(
      compactarNevoa([tudo("cobrir"), retangulo("revelar", 0, 0, 1, 1), tudo("revelar")]),
    ).toEqual([]);
    const lista = [
      retangulo("cobrir", 0, 0, 1, 1),
      tudo("cobrir"),
      retangulo("revelar", 0, 0, 5, 5),
    ];
    expect(compactarNevoa(lista)).toEqual(lista.slice(1));
  });

  it("passando do limite de traços a lista é compactada; se nem assim couber, recusa", () => {
    let lista: TracoDaNevoa[] = [tudo("cobrir")];
    for (let i = 0; i < MAXIMO_DE_TRACOS_DA_NEVOA - 1; i++) {
      lista =
        acrescentarTraco(lista, retangulo(i % 2 ? "cobrir" : "revelar", i, 0, i + 1, 1)) ?? lista;
    }
    expect(lista).toHaveLength(MAXIMO_DE_TRACOS_DA_NEVOA);
    // mais um "tudo": compacta para ele sozinho
    const zerada = acrescentarTraco(lista, tudo("cobrir"));
    expect(zerada).toEqual([tudo("cobrir")]);
    // mais um retângulo: a compactação não ajuda (não há "tudo" depois do primeiro): recusa
    const semTudo = lista.filter((t) => t.forma !== "tudo");
    const cheia = [retangulo("cobrir", 0, 0, 1, 1), ...semTudo].slice(0, MAXIMO_DE_TRACOS_DA_NEVOA);
    expect(acrescentarTraco(cheia, retangulo("cobrir", 0, 0, 2, 2))).toBeNull();
  });

  it("o limite de pontos vale", () => {
    const longo = pincel(
      "cobrir",
      Array.from({ length: 100 }, (_, i) => ({ x: i, y: 0 })),
    );
    let lista: TracoDaNevoa[] = [];
    let n = 0;
    for (;;) {
      const prox = acrescentarTraco(lista, longo);
      if (prox === null) break;
      lista = prox;
      n++;
    }
    expect(n).toBe(Math.floor(MAXIMO_DE_PONTOS_DA_NEVOA / 100));
  });

  it("o pincel de mão levantada vira poucos pontos e a forma se mantém", () => {
    const mao = Array.from({ length: 2000 }, (_, i) => ({
      x: i * 0.01,
      y: Math.sin(i / 40) * 3 + (i % 2) * 0.004,
    }));
    const simples = simplificarCaminho(mao);
    expect(simples.length).toBeLessThanOrEqual(128);
    expect(simples.length).toBeGreaterThan(5);
    expect(simples[0]).toEqual({
      x: 0,
      y: mao[0]?.y !== undefined ? Math.round(mao[0].y * 100) / 100 : 0,
    });
    // cada ponto original fica perto do caminho simplificado (tolerância cresce, mas é pequena)
    const traco = pincel("cobrir", simples, 0.6);
    const fora = mao.filter((p) => !pontoNaNevoa([traco], p));
    expect(fora).toHaveLength(0);
  });

  it("medida: uma cena com 300 traços de pincel de 40 pontos pesa pouco e a consulta é rápida", () => {
    let lista: TracoDaNevoa[] = [tudo("cobrir")];
    for (let i = 0; i < MAXIMO_DE_TRACOS_DA_NEVOA - 1; i++) {
      const pontos = Array.from({ length: 20 }, (_, k) => ({
        x: (i % 50) + k * 0.4,
        y: (i % 30) + k * 0.1,
      }));
      lista = acrescentarTraco(lista, pincel(i % 3 ? "revelar" : "cobrir", pontos, 1)) ?? lista;
    }
    expect(lista.length).toBe(MAXIMO_DE_TRACOS_DA_NEVOA);
    const bytes = JSON.stringify(lista).length;
    expect(bytes).toBeLessThan(200_000);
    // A melhor de 3 rodadas: mede o código, não a máquina ocupada com os outros pacotes testando ao mesmo tempo
    // (com uma rodada só, deu 253 ms sob carga no verify e passava sozinho).
    let ms = Number.POSITIVE_INFINITY;
    let cobertos = 0;
    for (let rodada = 0; rodada < 3; rodada++) {
      const inicio = performance.now();
      cobertos = 0;
      for (let k = 0; k < 400; k++) if (pontoNaNevoa(lista, { x: k % 40, y: k % 25 })) cobertos++;
      ms = Math.min(ms, performance.now() - inicio);
    }
    expect(cobertos).toBeGreaterThanOrEqual(0);
    // 400 consultas (um mapa cheio de tokens) em bem menos de um quadro
    expect(ms).toBeLessThan(250);
  });
});
