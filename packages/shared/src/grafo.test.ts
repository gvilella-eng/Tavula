import { describe, expect, it } from "vitest";
import {
  AutomacoesSchema,
  type Estado,
  estadoInicial,
  type Fio,
  type Fluxo,
  FluxoSchema,
  fonteComSemente,
  fraseDoFluxo,
  gatilhoPrincipal,
  type Intencao,
  IntencaoSchema,
  MAXIMO_DE_NOS,
  nomesDaMesa,
  organizarGrafo,
  podeLigar,
  problemasDoFluxo,
  processar,
  processarSistema,
  semOsNos,
} from "./index.ts";

// AU2: o motor do grafo (OU de gatilhos, E, OU e NÃO, caminhos em paralelo, chegada múltipla, ciclos, limites e hibernação),
// as conferências do grafo e a frase em português.

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (s: number) => new Date(T0 + s * 1000).toISOString();
let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `g${++contador}`, tipo, dados });

const token = (id: string, donos: string[]) => ({
  id,
  cenaId: "pulmao",
  nome: id,
  cor: "#0f0",
  tamanhoQuadrados: 1,
  x: 5,
  y: 5,
  camada: "tokens" as const,
  oculto: false,
  controladoPor: donos,
});

function criarEstado(): Estado {
  return estadoInicial(
    {
      usuarios: [
        { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
        { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      ],
      cenas: [
        {
          id: "pulmao",
          nome: "Pulmão",
          larguraM: 30,
          alturaM: 30,
          grid: { quadradoM: 1.5, visivel: true },
        },
      ],
      cenaAtivaId: "pulmao",
      luzes: [],
      tokens: [token("jogador", ["j1"]), token("monstro", [])],
    },
    T0,
  );
}

type NoPedido = [id: string, tipo: string, config?: object];
type FioPedido = [de: string, saida: string, para: string, entrada?: string];

/** Monta um fluxo-grafo à mão. `fios` em ordem: a ordem dos fios é a ordem em que o motor os segue. */
function grafo(nos: NoPedido[], fios: FioPedido[], extra: Record<string, unknown> = {}): Fluxo {
  return FluxoSchema.parse({
    id: "f1",
    nome: "Grafo",
    ...extra,
    nos: nos.map(([id, tipo, config], i) => ({
      id,
      tipo,
      x: i * 10,
      y: 0,
      config: config ?? {},
    })),
    fios: fios.map(([de, saida, para, entrada]) => ({
      de: { no: de, saida },
      para: { no: para, entrada: entrada ?? "entrada" },
    })),
  });
}

const comFluxos = (e: Estado, ...fluxos: Fluxo[]): Estado => ({
  ...e,
  automacoes: AutomacoesSchema.parse({ fluxos }),
});
function ok(estado: Estado, i: Intencao, s = 0, rng = fonteComSemente(1)) {
  const r = processar(estado, "m", i, iso(s), rng);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} (${r.erro.mensagem})`);
  return r;
}
const tempo = (e: Estado, s: number) => {
  const r = processarSistema(e, iso(s), [], fonteComSemente(1));
  if (!r.ok) throw new Error("recusado");
  return r.estado;
};
const disparar = (e: Estado, id = "f1", s = 0) =>
  ok(e, intencao("fluxo.disparar", { id }), s).estado;
const avisos = (e: Estado) => (e.chat ?? []).filter((m) => m.tipo === "aviso").map((m) => m.texto);
const anuncio = (texto: string): NoPedido => [
  texto,
  "acao",
  { acao: { acao: "chat.anunciar", texto } },
];
const botao: NoPedido = ["q", "gatilho", { tipo: "botao", nome: "B" }];
const verdadeiro = (id: string): NoPedido => [id, "condicao", { condicao: "chance", chance: 1 }];
const falso = (id: string): NoPedido => [id, "condicao", { condicao: "chance", chance: 0 }];

describe("o motor do grafo", () => {
  it("um gatilho percorre os fios; uma saída com vários fios roda os caminhos em paralelo, na ordem dos fios", () => {
    const f = grafo(
      [botao, anuncio("a"), anuncio("b"), anuncio("c")],
      [
        ["q", "saida", "a"],
        ["q", "saida", "b"],
        ["a", "saida", "c"],
      ],
    );
    expect(avisos(disparar(comFluxos(criarEstado(), f)))).toEqual(["a", "c", "b"]);
  });

  it("um bloco com vários fios chegando roda a cada chegada", () => {
    const f = grafo(
      [botao, anuncio("a"), anuncio("b"), anuncio("fim")],
      [
        ["q", "saida", "a"],
        ["q", "saida", "b"],
        ["a", "saida", "fim"],
        ["b", "saida", "fim"],
      ],
    );
    expect(avisos(disparar(comFluxos(criarEstado(), f)))).toEqual(["a", "fim", "b", "fim"]);
  });

  it("vários gatilhos ligados ao mesmo bloco formam um OU: qualquer um dispara", () => {
    const dispara = (nome: string): Fluxo =>
      grafo(
        [
          ["q", "gatilho", { tipo: "botao", nome }],
          ["s", "sinal", { nome }],
        ],
        [["q", "saida", "s"]],
        { id: nome },
      );
    const ouvinte = grafo(
      [
        ["ga", "gatilho", { tipo: "sinal", nome: "a" }],
        ["gb", "gatilho", { tipo: "sinal", nome: "b" }],
        anuncio("ouviu"),
      ],
      [
        ["ga", "saida", "ouviu"],
        ["gb", "saida", "ouviu"],
      ],
      { id: "ouvinte" },
    );
    const e = comFluxos(criarEstado(), dispara("a"), dispara("b"), ouvinte);
    expect(avisos(disparar(e, "a"))).toEqual(["ouviu"]);
    expect(avisos(disparar(e, "b"))).toEqual(["ouviu"]);
    expect(avisos(disparar(disparar(e, "a"), "b"))).toEqual(["ouviu", "ouviu"]);
  });

  describe("as portas lógicas E, OU e NÃO alimentam a condição do se", () => {
    const rodar = (condicoes: NoPedido[], porta: NoPedido, entradas: string[]) => {
      const f = grafo(
        [botao, ["se", "se"], porta, ...condicoes, anuncio("sim"), anuncio("nao")],
        [
          ["q", "saida", "se"],
          ...entradas.map((c): FioPedido => [c, "valor", porta[0], "entradas"]),
          [porta[0], "valor", "se", "condicao"],
          ["se", "sim", "sim"],
          ["se", "nao", "nao"],
        ],
      );
      return avisos(disparar(comFluxos(criarEstado(), f)));
    };

    it("E: só vale se todas valem", () => {
      const E: NoPedido = ["P", "porta", { porta: "e" }];
      expect(rodar([verdadeiro("v1"), verdadeiro("v2")], E, ["v1", "v2"])).toEqual(["sim"]);
      expect(rodar([verdadeiro("v1"), falso("f1")], E, ["v1", "f1"])).toEqual(["nao"]);
    });

    it("OU: vale se alguma vale", () => {
      const OU: NoPedido = ["P", "porta", { porta: "ou" }];
      expect(rodar([falso("f1"), verdadeiro("v1")], OU, ["f1", "v1"])).toEqual(["sim"]);
      expect(rodar([falso("f1"), falso("f2")], OU, ["f1", "f2"])).toEqual(["nao"]);
    });

    it("NÃO: inverte a única entrada", () => {
      const f = (cond: NoPedido) =>
        grafo(
          [
            botao,
            ["se", "se"],
            ["N", "porta", { porta: "nao" }],
            cond,
            anuncio("sim"),
            anuncio("nao"),
          ],
          [
            ["q", "saida", "se"],
            [cond[0], "valor", "N", "entrada"],
            ["N", "valor", "se", "condicao"],
            ["se", "sim", "sim"],
            ["se", "nao", "nao"],
          ],
        );
      expect(avisos(disparar(comFluxos(criarEstado(), f(falso("c")))))).toEqual(["sim"]);
      expect(avisos(disparar(comFluxos(criarEstado(), f(verdadeiro("c")))))).toEqual(["nao"]);
    });

    it('"se NÃO for jogador E chance 100%": roda para o monstro e não para o jogador (cada token da vez)', () => {
      const f = grafo(
        [
          botao,
          ["cada", "paraCada", { alvo: { tipo: "tokens" } }],
          ["se", "se"],
          ["jog", "condicao", { condicao: "tokenDeJogador" }],
          ["N", "porta", { porta: "nao" }],
          verdadeiro("sorte"),
          ["E", "porta", { porta: "e" }],
          ["marca", "acao", { acao: { acao: "chat.anunciar", texto: "monstro agiu" } }],
        ],
        [
          ["q", "saida", "cada"],
          ["cada", "corpo", "se"],
          ["jog", "valor", "N", "entrada"],
          ["N", "valor", "E", "entradas"],
          ["sorte", "valor", "E", "entradas"],
          ["E", "valor", "se", "condicao"],
          ["se", "sim", "marca"],
        ],
      );
      // dois tokens na cena: o do jogador e o NPC; só o NPC passa
      expect(avisos(disparar(comFluxos(criarEstado(), f)))).toEqual(["monstro agiu"]);
    });

    it("a condição chance sorteia a cada conferência, no RNG da sala", () => {
      const f = grafo(
        [
          botao,
          ["se", "se"],
          ["meio", "condicao", { condicao: "chance", chance: 0.5 }],
          anuncio("deu"),
        ],
        [
          ["q", "saida", "se"],
          ["meio", "valor", "se", "condicao"],
          ["se", "sim", "deu"],
        ],
      );
      let rodou = 0;
      for (let semente = 1; semente <= 40; semente++) {
        const r = processar(
          comFluxos(criarEstado(), f),
          "m",
          intencao("fluxo.disparar", { id: "f1" }),
          iso(0),
          fonteComSemente(semente),
        );
        if (r.ok && avisos(r.estado).length > 0) rodou++;
      }
      expect(rodou).toBeGreaterThan(8);
      expect(rodou).toBeLessThan(32);
    });
  });

  it('o "esperar" segura o caminho e a espera sobrevive à hibernação (o estado vai e volta do disco)', () => {
    const f = grafo(
      [
        ["q", "gatilho", { tipo: "relogio", cadaS: 600 }],
        ["e", "esperar", { s: 30 }],
        anuncio("depois"),
      ],
      [
        ["q", "saida", "e"],
        ["e", "saida", "depois"],
      ],
    );
    let e = tempo(comFluxos(criarEstado(), f), 0);
    expect(e.automacoes?.esperando).toHaveLength(1);
    expect(e.automacoes?.esperando[0]?.no).toBe("e");
    // "dorme": o estado inteiro vai para o disco e volta
    e = JSON.parse(JSON.stringify(e)) as Estado;
    e = tempo(e, 10);
    expect(avisos(e)).toEqual([]);
    e = tempo(e, 31);
    expect(avisos(e)).toEqual(["depois"]);
    expect(e.automacoes?.esperando).toEqual([]);
  });

  it("um ciclo que passa por um esperar de 1 s ou mais roda a cada volta", () => {
    const f = grafo(
      [botao, anuncio("tic"), ["e", "esperar", { s: 5 }]],
      [
        ["q", "saida", "tic"],
        ["tic", "saida", "e"],
        ["e", "saida", "tic"],
      ],
    );
    // a conferência aceita
    expect(
      problemasDoFluxo(f, {
        cenas: new Set(["pulmao"]),
        modelos: new Set(),
        zonas: new Set(),
        sons: new Set(),
      }),
    ).toEqual([]);
    let e = disparar(comFluxos(criarEstado(), f), "f1", 0);
    expect(avisos(e)).toEqual(["tic"]);
    e = tempo(e, 6);
    e = tempo(e, 11);
    expect(avisos(e)).toEqual(["tic", "tic", "tic"]);
  });

  it("um ciclo sem esperar é recusado na conferência e, se escapar, o motor corta e anota", () => {
    const f = grafo(
      [botao, anuncio("x"), anuncio("y")],
      [
        ["q", "saida", "x"],
        ["x", "saida", "y"],
        ["y", "saida", "x"],
      ],
    );
    const problemas = problemasDoFluxo(f, {
      cenas: new Set(),
      modelos: new Set(),
      zonas: new Set(),
      sons: new Set(),
    });
    expect(problemas.map((p) => p.mensagem).join(" ")).toContain("ciclo sem pausa");
    const r = processar(
      criarEstado(),
      "m",
      intencao("fluxo.criar", { fluxo: f }),
      iso(0),
      fonteComSemente(1),
    );
    expect(r.ok).toBe(false);
    // sem passar pela conferência (um arquivo editado à mão): o teto de ações corta o ciclo
    const e = disparar(comFluxos(criarEstado(), f));
    expect(avisos(e).length).toBeLessThan(600);
    expect((e.automacoes?.registro ?? []).map((x) => x.texto).join(" ")).toContain("cortada");
  });

  it("limites: nós demais são recusados", () => {
    const nos = Array.from({ length: MAXIMO_DE_NOS + 1 }, (_, i) => ({
      id: `n${i}`,
      tipo: "esperar",
      x: 0,
      y: 0,
      config: { s: 1 },
    }));
    expect(FluxoSchema.safeParse({ id: "f", nome: "F", nos, fios: [] }).success).toBe(false);
  });

  it("fios entre tipos errados, portas que não existem e duplicados são recusados", () => {
    const base = (fios: FioPedido[]) =>
      FluxoSchema.safeParse(
        grafoSemParse([botao, ["se", "se"], verdadeiro("c"), anuncio("a")], fios),
      ).success;
    expect(base([["q", "saida", "se"]])).toBe(true);
    // fio de ordem na entrada de condição
    expect(base([["q", "saida", "se", "condicao"]])).toBe(false);
    // fio de condição na entrada de ordem
    expect(base([["c", "valor", "a"]])).toBe(false);
    // porta que não existe
    expect(base([["q", "nada", "se"]])).toBe(false);
    // dois fios iguais
    expect(
      base([
        ["q", "saida", "se"],
        ["q", "saida", "se"],
      ]),
    ).toBe(false);
    // a condição do se aceita um fio só
    expect(
      base([
        ["c", "valor", "se", "condicao"],
        ["c", "valor", "se", "condicao"],
      ]),
    ).toBe(false);
  });

  it("podeLigar diz o motivo", () => {
    const f = grafo(
      [botao, ["se", "se"], verdadeiro("c"), verdadeiro("c2")],
      [["c", "valor", "se", "condicao"]],
    );
    expect(
      podeLigar(f, { no: "q", saida: "saida" }, { no: "se", entrada: "condicao" }),
    ).toMatchObject({
      ok: false,
    });
    expect(podeLigar(f, { no: "q", saida: "saida" }, { no: "se", entrada: "entrada" })).toEqual({
      ok: true,
    });
    expect(
      podeLigar(f, { no: "c2", saida: "valor" }, { no: "se", entrada: "condicao" }),
    ).toMatchObject({ ok: false, motivo: expect.stringContaining("só um fio") });
  });
});

function grafoSemParse(nos: NoPedido[], fios: FioPedido[]) {
  return {
    id: "f1",
    nome: "G",
    nos: nos.map(([id, tipo, config], i) => ({ id, tipo, x: i, y: 0, config: config ?? {} })),
    fios: fios.map(([de, saida, para, entrada]) => ({
      de: { no: de, saida },
      para: { no: para, entrada: entrada ?? "entrada" },
    })) satisfies Fio[],
  };
}

describe("a conferência do grafo, em português e no próprio nó", () => {
  const ref = {
    cenas: new Set(["pulmao"]),
    modelos: new Set<string>(),
    zonas: new Set<string>(),
    sons: new Set<string>(),
  };
  const mensagens = (f: Fluxo) =>
    Object.fromEntries(
      [...new Set(problemasDoFluxo(f, ref).map((p) => p.caminho))].map((c) => [
        c,
        problemasDoFluxo(f, ref)
          .filter((p) => p.caminho === c)
          .map((p) => p.mensagem)
          .join(" "),
      ]),
    );

  it("fio solto, porta sem entrada, se sem condição e bloco sem gatilho aparecem no nó", () => {
    const f = grafo(
      [
        botao,
        ["se", "se"],
        ["P", "porta", { porta: "e" }],
        verdadeiro("c"),
        anuncio("a"),
        anuncio("solto"),
      ],
      [
        ["q", "saida", "se"],
        ["se", "sim", "a"],
      ],
    );
    const m = mensagens(f);
    expect(m["nos.se"]).toContain("sem condição");
    expect(m["nos.P"]).toContain("sem entrada");
    expect(m["nos.c"]).toContain("Ligue esta condição");
    expect(m["nos.solto"]).toContain("nenhum gatilho");
  });

  it("um gatilho só de relógio e um só de botão por automação", () => {
    const f = grafo(
      [
        ["q1", "gatilho", { tipo: "botao", nome: "A" }],
        ["q2", "gatilho", { tipo: "botao", nome: "B" }],
        anuncio("a"),
      ],
      [
        ["q1", "saida", "a"],
        ["q2", "saida", "a"],
      ],
    );
    expect(mensagens(f)["nos.q2"]).toContain("um gatilho de botão");
  });

  it("sem gatilho e sem blocos", () => {
    expect(mensagens(grafo([anuncio("a")], [])).grafo).toContain("gatilho");
    expect(mensagens(grafo([botao], [])).grafo).toContain("pelo menos um bloco");
  });
});

describe("a árvore do AU1 vira grafo", () => {
  it("o fluxo de árvore entra pela intenção e vira grafo na mesma ordem de execução (esperar e sortear no meio)", () => {
    const e = ok(
      criarEstado(),
      intencao("fluxo.criar", {
        fluxo: {
          id: "arv",
          nome: "Árvore",
          gatilho: { tipo: "botao", nome: "B" },
          trilhas: [
            [
              { bloco: "acao", acao: { acao: "chat.anunciar", texto: "1" } },
              {
                bloco: "sortear",
                chance: 1,
                sim: [{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "sim" } }],
                nao: [{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "nao" } }],
              },
              { bloco: "acao", acao: { acao: "chat.anunciar", texto: "fim" } },
            ],
            [{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "paralela" } }],
          ],
        },
      }),
    ).estado;
    const f = e.automacoes?.fluxos[0];
    expect(f && gatilhoPrincipal(f)).toEqual({ tipo: "botao", nome: "B" });
    expect(avisos(disparar(e, "arv"))).toEqual(["1", "sim", "fim", "paralela"]);
  });
});

describe("a frase do grafo em português", () => {
  const nomes = nomesDaMesa({
    cenas: [{ id: "pulmao", nome: "Pulmão" }] as never,
    modelos: [] as never,
    zonas: [
      { id: "za", nome: "A" },
      { id: "zb", nome: "B" },
    ] as never,
  });

  it("OU de gatilhos, E, NÃO e caminhos paralelos são ditos em palavras", () => {
    const f = grafo(
      [
        ["a", "gatilho", { tipo: "zona", quando: "entra", zona: "za" }],
        ["b", "gatilho", { tipo: "zona", quando: "entra", zona: "zb" }],
        ["se", "se"],
        ["jog", "condicao", { condicao: "tokenDeJogador" }],
        ["N", "porta", { porta: "nao" }],
        ["meio", "condicao", { condicao: "chance", chance: 0.5 }],
        ["E", "porta", { porta: "e" }],
        anuncio("Pegou"),
        ["paralelo", "acao", { acao: { acao: "chat.anunciar", texto: "Outro" } }],
      ],
      [
        ["a", "saida", "se"],
        ["b", "saida", "se"],
        ["jog", "valor", "N", "entrada"],
        ["N", "valor", "E", "entradas"],
        ["meio", "valor", "E", "entradas"],
        ["E", "valor", "se", "condicao"],
        ["se", "sim", "Pegou"],
        ["a", "saida", "paralelo"],
      ],
    );
    const frase = fraseDoFluxo(f, nomes);
    expect(frase).toContain("Quando um token entra na zona A, ou quando um token entra na zona B");
    expect(frase).toContain("NÃO");
    expect(frase).toContain(" E ");
    expect(frase).toContain("sorteio de 50%");
    expect(frase).toContain("Pegou");
    expect(frase).toContain("Outro");
    expect(frase).not.toContain("undefined");
  });

  it("OU entre condições e dois blocos que se encontram no fim", () => {
    const f = grafo(
      [
        botao,
        ["se", "se"],
        ["OU", "porta", { porta: "ou" }],
        ["z", "condicao", { condicao: "etiqueta", etiqueta: "chama" }],
        ["c", "condicao", { condicao: "cena", cenas: ["pulmao"] }],
        anuncio("sim"),
        anuncio("nao"),
        anuncio("fim"),
      ],
      [
        ["q", "saida", "se"],
        ["z", "valor", "OU", "entradas"],
        ["c", "valor", "OU", "entradas"],
        ["OU", "valor", "se", "condicao"],
        ["se", "sim", "sim"],
        ["se", "nao", "nao"],
        ["sim", "saida", "fim"],
        ["nao", "saida", "fim"],
      ],
    );
    const frase = fraseDoFluxo(f, nomes);
    expect(frase).toContain(" OU ");
    expect(frase.match(/fim/g)?.length).toBe(1);
  });
});

describe("arrumar na grade e tirar nós", () => {
  it("organizarGrafo põe cada bloco uma coluna depois do que o chama, sem sobrepor", () => {
    const f = grafo(
      [botao, anuncio("a"), anuncio("b"), verdadeiro("c"), ["se", "se"]],
      [
        ["q", "saida", "se"],
        ["c", "valor", "se", "condicao"],
        ["se", "sim", "a"],
        ["se", "nao", "b"],
      ],
    );
    const nos = organizarGrafo(f);
    const por = new Map(nos.map((n) => [n.id, n]));
    expect((por.get("se")?.x ?? 0) > (por.get("q")?.x ?? 0)).toBe(true);
    expect((por.get("a")?.x ?? 0) > (por.get("se")?.x ?? 0)).toBe(true);
    const celulas = new Set(nos.map((n) => `${n.x},${n.y}`));
    expect(celulas.size).toBe(nos.length);
  });

  it("semOsNos religa quem chegava a quem vinha depois", () => {
    const f = grafo(
      [botao, anuncio("a"), anuncio("b")],
      [
        ["q", "saida", "a"],
        ["a", "saida", "b"],
      ],
    );
    const sem = semOsNos(f, new Set(["a"]));
    expect(sem.nos.map((n) => n.id)).toEqual(["q", "b"]);
    expect(sem.fios).toEqual([
      { de: { no: "q", saida: "saida" }, para: { no: "b", entrada: "entrada" } },
    ]);
  });
});
