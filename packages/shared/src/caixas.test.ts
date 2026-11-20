import { describe, expect, it } from "vitest";
import {
  AutomacoesSchema,
  adicionarEspaco,
  agruparGatilhos,
  alternarCaixa,
  conflitoDaCaixa,
  type Estado,
  estadoInicial,
  type Fluxo,
  FluxoSchema,
  fonteComSemente,
  fraseDoFluxo,
  type Intencao,
  IntencaoSchema,
  MAXIMO_DE_ESPACOS,
  motivoDaRecusa,
  moverPeca,
  nomesDaMesa,
  numeroDeEspacos,
  organizarGrafo,
  portasDoNo,
  problemasDoFluxo,
  processar,
  processarSistema,
  removerEspaco,
  reordenarPeca,
  semOsNos,
} from "./index.ts";

// AU3: as portas lógicas viram CAIXAS na grade (E, OU, NÃO), como no Scratch: dois espaços (ou mais), um em cima do outro, cada
// um com UMA peça (gatilho, condição, ação ou outra caixa). O motor é o mesmo por baixo. Aqui: o motor com caixas, o que cabe
// onde, crescer e encolher, as operações do editor, a conversão do AU2 e a frase.

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (s: number) => new Date(T0 + s * 1000).toISOString();
let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `c${++contador}`, tipo, dados });

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

/** [id, tipo, config, em?, espaco?] */
type NoPedido = [
  id: string,
  tipo: string,
  config?: object,
  em?: string | undefined,
  espaco?: number | undefined,
];
type FioPedido = [de: string, saida: string, para: string, entrada?: string];

function caixas(nos: NoPedido[], fios: FioPedido[], extra: Record<string, unknown> = {}): Fluxo {
  return FluxoSchema.parse({
    id: "f1",
    nome: "Caixas",
    ...extra,
    nos: nos.map(([id, tipo, config, em, espaco], i) => ({
      id,
      tipo,
      x: i * 10,
      y: 0,
      config: config ?? {},
      ...(em === undefined ? {} : { em }),
      ...(espaco === undefined ? {} : { espaco }),
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
const disparar = (e: Estado, id = "f1", s = 0, rng = fonteComSemente(1)) =>
  ok(e, intencao("fluxo.disparar", { id }), s, rng).estado;
const avisos = (e: Estado) => (e.chat ?? []).filter((m) => m.tipo === "aviso").map((m) => m.texto);

const na = (id: string, em: string, espaco: number, texto = id): NoPedido => [
  id,
  "acao",
  { acao: { acao: "chat.anunciar", texto } },
  em,
  espaco,
];
const anuncio = (texto: string): NoPedido => [
  texto,
  "acao",
  { acao: { acao: "chat.anunciar", texto } },
];
const chance = (id: string, p: number, em?: string, espaco?: number): NoPedido => [
  id,
  "condicao",
  { condicao: "chance", chance: p },
  em,
  espaco,
];
const verdadeiro = (id: string, em?: string, espaco?: number) => chance(id, 1, em, espaco);
const falso = (id: string, em?: string, espaco?: number) => chance(id, 0, em, espaco);
const botao = (id: string, nome = id, em?: string, espaco?: number): NoPedido => [
  id,
  "gatilho",
  { tipo: "botao", nome },
  em,
  espaco,
];
const sinal = (id: string, nome: string, em?: string, espaco?: number): NoPedido => [
  id,
  "gatilho",
  { tipo: "sinal", nome },
  em,
  espaco,
];
const caixa = (
  id: string,
  porta: "e" | "ou" | "nao",
  em?: string,
  espaco?: number,
  espacos?: number,
): NoPedido => [id, "caixa", espacos === undefined ? { porta } : { porta, espacos }, em, espaco];
const mensagens = (f: Fluxo): Record<string, string> => {
  const ref = {
    cenas: new Set(["pulmao"]),
    modelos: new Set<string>(),
    zonas: new Set<string>(),
    sons: new Set<string>(),
  };
  const r: Record<string, string> = {};
  for (const p of problemasDoFluxo(f, ref)) r[p.caminho] = `${r[p.caminho] ?? ""}${p.mensagem} `;
  return r;
};

describe("o motor com caixas: gatilhos", () => {
  it("gatilho OU gatilho: qualquer um dispara a cadeia da caixa", () => {
    const f = caixas(
      [caixa("c", "ou"), sinal("a", "x", "c", 0), botao("b", "Combate", "c", 1), anuncio("fogo")],
      [["c", "saida", "fogo"]],
    );
    expect(mensagens(f)).toEqual({});
    expect(avisos(disparar(comFluxos(criarEstado(), f)))).toEqual(["fogo"]);
  });

  it("relógio OU botão: o relógio roda ao começar e a cada intervalo", () => {
    const f = caixas(
      [
        caixa("c", "ou"),
        ["rel", "gatilho", { tipo: "relogio", cadaS: 180 }, "c", 0],
        botao("b", "Combate", "c", 1),
        anuncio("fogo"),
      ],
      [["c", "saida", "fogo"]],
    );
    const primeira = tempo(comFluxos(criarEstado(), f), 0);
    expect(avisos(primeira)).toEqual(["fogo"]);
    expect(avisos(tempo(primeira, 100))).toEqual(["fogo"]);
    expect(avisos(tempo(primeira, 181))).toEqual(["fogo", "fogo"]);
  });

  it("dois gatilhos sinal dentro da caixa: qualquer um dos dois dispara, e só ele", () => {
    const ouvinte = caixas(
      [caixa("c", "ou"), sinal("ga", "a", "c", 0), sinal("gb", "b", "c", 1), anuncio("ouviu")],
      [["c", "saida", "ouviu"]],
      { id: "ouvinte" },
    );
    const manda = (nome: string): Fluxo =>
      caixas([botao("q", nome), ["s", "sinal", { nome }]], [["q", "saida", "s"]], { id: nome });
    const e = comFluxos(criarEstado(), manda("a"), manda("b"), manda("c"), ouvinte);
    expect(avisos(disparar(e, "a"))).toEqual(["ouviu"]);
    expect(avisos(disparar(e, "b"))).toEqual(["ouviu"]);
    expect(avisos(disparar(e, "c"))).toEqual([]);
  });

  it("gatilho E condição: quando o gatilho acontece, segue só se a condição vale (nos dois sentidos de ordem)", () => {
    const roda = (p: number, gatilhoEmCima: boolean) => {
      const f = caixas(
        [
          caixa("c", "e"),
          botao("b", "B", "c", gatilhoEmCima ? 0 : 1),
          chance("cond", p, "c", gatilhoEmCima ? 1 : 0),
          anuncio("passou"),
        ],
        [["c", "saida", "passou"]],
      );
      expect(mensagens(f)).toEqual({});
      return avisos(disparar(comFluxos(criarEstado(), f)));
    };
    expect(roda(1, true)).toEqual(["passou"]);
    expect(roda(0, true)).toEqual([]);
    expect(roda(1, false)).toEqual(["passou"]);
    expect(roda(0, false)).toEqual([]);
  });

  it("gatilho E duas condições (três espaços): segue só se as duas valem", () => {
    const f = (b: number) =>
      caixas(
        [
          caixa("c", "e", undefined, undefined, 3),
          botao("g", "G", "c", 0),
          chance("a", 1, "c", 1),
          chance("b", b, "c", 2),
          anuncio("passou"),
        ],
        [["c", "saida", "passou"]],
      );
    expect(avisos(disparar(comFluxos(criarEstado(), f(1))))).toEqual(["passou"]);
    expect(avisos(disparar(comFluxos(criarEstado(), f(0))))).toEqual([]);
  });
});

describe("o motor com caixas: condições", () => {
  const rodarSe = (nos: NoPedido[]) => {
    const f = caixas(
      [botao("q", "B"), ["se", "se"], ...nos, anuncio("sim"), anuncio("nao")],
      [
        ["q", "saida", "se"],
        ["raiz", "saida", "se", "condicao"],
        ["se", "sim", "sim"],
        ["se", "nao", "nao"],
      ],
    );
    return { f, avisos: avisos(disparar(comFluxos(criarEstado(), f))) };
  };

  it("E: só vale se todas valem", () => {
    const t = (a: NoPedido, b: NoPedido) => rodarSe([caixa("raiz", "e"), a, b]).avisos;
    expect(t(verdadeiro("a", "raiz", 0), verdadeiro("b", "raiz", 1))).toEqual(["sim"]);
    expect(t(verdadeiro("a", "raiz", 0), falso("b", "raiz", 1))).toEqual(["nao"]);
  });

  it("OU: vale se alguma vale", () => {
    const t = (a: NoPedido, b: NoPedido) => rodarSe([caixa("raiz", "ou"), a, b]).avisos;
    expect(t(falso("a", "raiz", 0), verdadeiro("b", "raiz", 1))).toEqual(["sim"]);
    expect(t(falso("a", "raiz", 0), falso("b", "raiz", 1))).toEqual(["nao"]);
  });

  it("uma caixa com três itens (A ou B ou C): vale se qualquer um vale", () => {
    const t = (c: number) =>
      rodarSe([
        caixa("raiz", "ou", undefined, undefined, 3),
        falso("a", "raiz", 0),
        falso("b", "raiz", 1),
        chance("c", c, "raiz", 2),
      ]).avisos;
    expect(t(1)).toEqual(["sim"]);
    expect(t(0)).toEqual(["nao"]);
  });

  it("NÃO inverte a peça única (uma condição, ou uma caixa)", () => {
    const t = (...c: NoPedido[]) => rodarSe([caixa("raiz", "nao"), ...c]).avisos;
    expect(t(falso("a", "raiz", 0))).toEqual(["sim"]);
    expect(t(verdadeiro("a", "raiz", 0))).toEqual(["nao"]);
    // NÃO ( E ( verdadeiro, falso ) ) = verdadeiro
    expect(
      t(caixa("todas", "e", "raiz", 0), verdadeiro("a", "todas", 0), falso("b", "todas", 1)),
    ).toEqual(["sim"]);
  });

  it("caixa dentro de caixa: E ( OU ( falso, verdadeiro ), NÃO ( falso ) ) vale", () => {
    const r = rodarSe([
      caixa("raiz", "e"),
      caixa("algum", "ou", "raiz", 0),
      falso("f1", "algum", 0),
      verdadeiro("v1", "algum", 1),
      caixa("inverte", "nao", "raiz", 1),
      falso("f2", "inverte", 0),
    ]);
    expect(mensagens(r.f)).toEqual({});
    expect(r.avisos).toEqual(["sim"]);
  });

  it('"se NÃO for jogador E chance 100%" por caixas roda para o monstro e não para o jogador', () => {
    const f = caixas(
      [
        botao("q", "B"),
        ["cada", "paraCada", { alvo: { tipo: "tokens" } }],
        ["se", "se"],
        caixa("raiz", "e"),
        caixa("nao", "nao", "raiz", 0),
        ["jog", "condicao", { condicao: "tokenDeJogador" }, "nao", 0],
        verdadeiro("sorte", "raiz", 1),
        ["marca", "acao", { acao: { acao: "token.ocultar" } }],
      ],
      [
        ["q", "saida", "cada"],
        ["cada", "corpo", "se"],
        ["raiz", "saida", "se", "condicao"],
        ["se", "sim", "marca"],
      ],
    );
    expect(mensagens(f)).toEqual({});
    const e = disparar(comFluxos(criarEstado(), f));
    expect(e.tokens.find((t) => t.id === "monstro")?.oculto).toBe(true);
    expect(e.tokens.find((t) => t.id === "jogador")?.oculto).toBe(false);
  });
});

describe("o motor com caixas: ações", () => {
  it("ação E ação: as duas acontecem, de cima para baixo", () => {
    const f = caixas(
      [botao("q", "B"), caixa("c", "e"), na("um", "c", 0), na("dois", "c", 1), anuncio("depois")],
      [
        ["q", "saida", "c"],
        ["c", "saida", "depois"],
      ],
    );
    expect(mensagens(f)).toEqual({});
    expect(avisos(disparar(comFluxos(criarEstado(), f)))).toEqual(["um", "dois", "depois"]);
  });

  it("ação OU ação: sorteia uma das duas, 50/50 (sempre uma só)", () => {
    const f = caixas(
      [botao("q", "B"), caixa("c", "ou"), na("um", "c", 0), na("dois", "c", 1), anuncio("depois")],
      [
        ["q", "saida", "c"],
        ["c", "saida", "depois"],
      ],
    );
    expect(mensagens(f)).toEqual({});
    const e = comFluxos(criarEstado(), f);
    const vistos = new Set<string>();
    for (let semente = 1; semente <= 40; semente++) {
      const a = avisos(disparar(e, "f1", 0, fonteComSemente(semente)));
      expect(a).toHaveLength(2);
      expect(a[1]).toBe("depois");
      vistos.add(a[0] as string);
    }
    expect(vistos).toEqual(new Set(["um", "dois"]));
  });

  it("ação OU ação OU ação (três espaços): uma só, e as três saem", () => {
    const f = caixas(
      [
        botao("q", "B"),
        caixa("c", "ou", undefined, undefined, 3),
        na("um", "c", 0),
        na("dois", "c", 1),
        na("tres", "c", 2),
      ],
      [["q", "saida", "c"]],
    );
    const e = comFluxos(criarEstado(), f);
    const vistos = new Set<string>();
    for (let semente = 1; semente <= 60; semente++) {
      const a = avisos(disparar(e, "f1", 0, fonteComSemente(semente)));
      expect(a).toHaveLength(1);
      vistos.add(a[0] as string);
    }
    expect(vistos).toEqual(new Set(["um", "dois", "tres"]));
  });

  it("caixa de ação dentro de caixa de ação: E ( ação, OU ( ação, ação ) )", () => {
    const f = caixas(
      [
        botao("q", "B"),
        caixa("c", "e"),
        na("sempre", "c", 0),
        caixa("sorteio", "ou", "c", 1),
        na("a", "sorteio", 0),
        na("b", "sorteio", 1),
      ],
      [["q", "saida", "c"]],
    );
    expect(mensagens(f)).toEqual({});
    const a = avisos(disparar(comFluxos(criarEstado(), f)));
    expect(a[0]).toBe("sempre");
    expect(a).toHaveLength(2);
  });
});

describe("as caixas e o que cabe nelas", () => {
  const base = (): Fluxo =>
    caixas(
      [
        caixa("ou", "ou"),
        caixa("e", "e"),
        caixa("nao", "nao"),
        botao("g1"),
        ["g2", "gatilho", { tipo: "relogio", cadaS: 60 }],
        verdadeiro("c1"),
        verdadeiro("c2"),
        anuncio("acao"),
        anuncio("acao2"),
      ],
      [],
    );
  const com = (f: Fluxo, id: string, caixaId: string, espaco: number): Fluxo => {
    const r = moverPeca(f, id, caixaId, { espaco });
    if (!r.ok) throw new Error(r.motivo);
    return r.fluxo;
  };

  it("gatilho E gatilho é recusado, com a dica de usar OU; gatilho OU gatilho vale", () => {
    let f = com(base(), "g1", "e", 0);
    expect(motivoDaRecusa(f.nos, "g2", "e", { espaco: 1 })).toContain("use OU");
    f = com(base(), "g1", "ou", 0);
    expect(motivoDaRecusa(f.nos, "g2", "ou", { espaco: 1 })).toBeNull();
  });

  it("gatilho E condição vale; gatilho OU condição é recusado", () => {
    const e = com(base(), "g1", "e", 0);
    expect(motivoDaRecusa(e.nos, "c1", "e", { espaco: 1 })).toBeNull();
    const ou = com(base(), "g1", "ou", 0);
    expect(motivoDaRecusa(ou.nos, "c1", "ou", { espaco: 1 })).toContain("precisa do E");
  });

  it("NÃO só aceita condição (ou caixa de condição), num espaço só", () => {
    const f = base();
    expect(motivoDaRecusa(f.nos, "g1", "nao", { espaco: 0 })).toContain("NÃO nega uma condição");
    expect(motivoDaRecusa(f.nos, "acao", "nao", { espaco: 0 })).toContain("NÃO nega uma condição");
    expect(motivoDaRecusa(f.nos, "c1", "nao", { espaco: 0 })).toBeNull();
    expect(motivoDaRecusa(f.nos, "e", "nao", { espaco: 0 })).toBeNull();
    expect(motivoDaRecusa(f.nos, "c1", "nao", { inserirEm: 1 })).toContain("espaço só");
    const g = com(f, "c1", "nao", 0);
    expect(motivoDaRecusa(g.nos, "c2", "nao", { espaco: 0 })).toContain("já tem uma peça");
  });

  it("ação misturada com gatilho ou com condição é recusada; ação com ação vale", () => {
    const a = com(base(), "acao", "e", 0);
    expect(motivoDaRecusa(a.nos, "g1", "e", { espaco: 1 })).toContain("Uma ação não se mistura");
    expect(motivoDaRecusa(a.nos, "c1", "e", { espaco: 1 })).toContain("Uma ação não se mistura");
    expect(motivoDaRecusa(a.nos, "acao2", "e", { espaco: 1 })).toBeNull();
    const g = com(base(), "g1", "ou", 0);
    expect(motivoDaRecusa(g.nos, "acao", "ou", { espaco: 1 })).toContain("Uma ação não se mistura");
  });

  it("os outros blocos de fluxo não entram: ficam na grade", () => {
    const f = caixas([caixa("c", "ou"), ["se", "se"], ["e", "esperar", { s: 5 }]], []);
    expect(motivoDaRecusa(f.nos, "se", "c", { espaco: 0 })).toContain("ficam na grade");
    expect(motivoDaRecusa(f.nos, "e", "c", { espaco: 0 })).toContain("ficam na grade");
  });

  it("um espaço guarda uma peça só, e solta entre dois espaços abre um novo", () => {
    const f = com(base(), "c1", "e", 0);
    expect(motivoDaRecusa(f.nos, "c2", "e", { espaco: 0 })).toContain("já tem uma peça");
    expect(motivoDaRecusa(f.nos, "c2", "e", { espaco: 7 })).toContain("não existe");
    expect(motivoDaRecusa(f.nos, "c2", "e", { inserirEm: 1 })).toBeNull();
  });

  it("o conflito se propaga às caixas de fora: um gatilho numa caixa dentro de uma E já com gatilho é recusado", () => {
    let f = com(base(), "g1", "e", 0);
    f = com(f, "ou", "e", 1);
    // a caixa OU (vazia) está no espaço 1 da E; um gatilho nela faria "gatilho E gatilho"
    expect(motivoDaRecusa(f.nos, "g2", "ou", { espaco: 0 })).toContain("use OU");
  });

  it("uma caixa não cabe dentro dela mesma nem de uma caixa dela, e o limite é de 4 níveis", () => {
    const f = caixas(
      [
        caixa("a", "ou"),
        caixa("b", "ou", "a", 0),
        caixa("c", "ou", "b", 0),
        caixa("d", "ou", "c", 0),
        caixa("x", "ou"),
      ],
      [],
    );
    expect(motivoDaRecusa(f.nos, "a", "a", { espaco: 0 })).toContain("dentro dela mesma");
    expect(motivoDaRecusa(f.nos, "a", "c", { espaco: 1 })).toContain("dentro dela mesma");
    expect(motivoDaRecusa(f.nos, "x", "d", { espaco: 0 })).toContain("No máximo 4");
    expect(motivoDaRecusa(f.nos, "x", "c", { espaco: 1 })).toBeNull();
  });

  it("a conferência aponta caixa vazia, espaço sem peça, e caixa sem saída ligada", () => {
    const vazia = caixas([caixa("ou", "ou")], []);
    expect(mensagens(vazia)["nos.ou"]).toContain("vazia");
    expect(mensagens(vazia)["nos.ou"]).toContain("saída");
    const meio = caixas(
      [caixa("ou", "ou"), botao("a", "A", "ou", 0), anuncio("x")],
      [["ou", "saida", "x"]],
    );
    expect(mensagens(meio)["nos.ou"]).toContain("Falta uma peça no espaço 2");
    const nao = caixas([caixa("n", "nao")], []);
    expect(mensagens(nao)["nos.n"]).toContain("NÃO está vazio");
  });

  it("o esquema recusa dois blocos no mesmo espaço, espaço que a caixa não tem e peça numa caixa que não existe", () => {
    expect(() =>
      caixas([caixa("c", "ou"), verdadeiro("a", "c", 0), verdadeiro("b", "c", 0)], []),
    ).toThrow();
    expect(() => caixas([caixa("c", "ou"), verdadeiro("a", "c", 2)], [])).toThrow();
    expect(() => caixas([caixa("n", "nao"), verdadeiro("a", "n", 1)], [])).toThrow();
    expect(() => caixas([verdadeiro("c", "nada", 0)], [])).toThrow();
  });

  it("peça guardada não tem fio próprio; a saída da caixa depende do que ela tem dentro", () => {
    const f = caixas(
      [
        caixa("g", "ou"),
        botao("a", "A", "g", 0),
        caixa("v", "e"),
        verdadeiro("c", "v", 0),
        caixa("x", "e"),
        na("q", "x", 0),
      ],
      [],
    );
    const por = (id: string) => f.nos.find((n) => n.id === id) as never;
    expect(portasDoNo(por("a"), f.nos)).toEqual({ entradas: [], saidas: [] });
    expect(portasDoNo(por("g"), f.nos).saidas.map((p) => p.tipo)).toEqual(["exec"]);
    expect(portasDoNo(por("g"), f.nos).entradas).toEqual([]);
    expect(portasDoNo(por("v"), f.nos).saidas.map((p) => p.tipo)).toEqual(["valor"]);
    const acao = portasDoNo(por("x"), f.nos);
    expect(acao.entradas.map((p) => p.tipo)).toEqual(["exec"]);
    expect(acao.saidas.map((p) => p.tipo)).toEqual(["exec"]);
    expect(() =>
      caixas([caixa("ou", "ou"), botao("g", "G", "ou", 0), anuncio("x")], [["g", "saida", "x"]]),
    ).toThrow();
  });
});

describe("crescer e encolher", () => {
  it("a caixa nasce com 2 espaços; o + acrescenta um (até o máximo)", () => {
    let f = caixas([caixa("c", "e")], []);
    expect(numeroDeEspacos(f.nos, "c")).toBe(2);
    for (let i = 3; i <= MAXIMO_DE_ESPACOS; i++) {
      const r = adicionarEspaco(f, "c");
      expect(r.ok).toBe(true);
      if (r.ok) f = r.fluxo;
      expect(numeroDeEspacos(f.nos, "c")).toBe(i);
    }
    const alem = adicionarEspaco(f, "c");
    expect(alem.ok).toBe(false);
    expect(FluxoSchema.safeParse(f).success).toBe(true);
  });

  it("o NÃO não tem + e fica com um espaço", () => {
    const f = caixas([caixa("n", "nao")], []);
    expect(numeroDeEspacos(f.nos, "n")).toBe(1);
    const r = adicionarEspaco(f, "n");
    expect(r.ok).toBe(false);
  });

  it("soltar entre dois espaços abre um novo ali, empurrando os de baixo", () => {
    const f = caixas(
      [caixa("c", "e"), verdadeiro("a", "c", 0), verdadeiro("b", "c", 1), verdadeiro("novo")],
      [],
    );
    const r = moverPeca(f, "novo", "c", { inserirEm: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const espaco = (id: string) => r.fluxo.nos.find((n) => n.id === id)?.espaco;
    expect([espaco("a"), espaco("novo"), espaco("b")]).toEqual([0, 1, 2]);
    expect(numeroDeEspacos(r.fluxo.nos, "c")).toBe(3);
    expect(FluxoSchema.safeParse(r.fluxo).success).toBe(true);
  });

  it("soltar logo abaixo do último abre um espaço no fim", () => {
    const f = caixas(
      [caixa("c", "ou"), verdadeiro("a", "c", 0), verdadeiro("b", "c", 1), verdadeiro("novo")],
      [],
    );
    const r = moverPeca(f, "novo", "c", { inserirEm: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fluxo.nos.find((n) => n.id === "novo")?.espaco).toBe(2);
      expect(numeroDeEspacos(r.fluxo.nos, "c")).toBe(3);
    }
  });

  it("tirar a peça de uma caixa com mais de 2 espaços remove o espaço; com 2, o espaço fica vazio", () => {
    const tres = caixas(
      [
        caixa("c", "ou", undefined, undefined, 3),
        verdadeiro("a", "c", 0),
        verdadeiro("b", "c", 1),
        verdadeiro("d", "c", 2),
      ],
      [],
    );
    const r = moverPeca(tres, "b", null, { x: 400, y: 300 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(numeroDeEspacos(r.fluxo.nos, "c")).toBe(2);
    expect(r.fluxo.nos.find((n) => n.id === "d")?.espaco).toBe(1);
    expect(r.fluxo.nos.find((n) => n.id === "b")).toMatchObject({ x: 400, y: 300 });
    expect(r.fluxo.nos.find((n) => n.id === "b")?.em).toBeUndefined();
    // com 2 espaços, tirar uma peça deixa o espaço vazio (o mínimo é 2)
    const r2 = moverPeca(r.fluxo, "d", null);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(numeroDeEspacos(r2.fluxo.nos, "c")).toBe(2);
    expect(FluxoSchema.safeParse(r.fluxo).success).toBe(true);
  });

  it("o × tira um espaço vazio a mais, mas nunca abaixo de 2 nem um com peça", () => {
    let f = caixas(
      [caixa("c", "e", undefined, undefined, 4), verdadeiro("a", "c", 0), verdadeiro("b", "c", 3)],
      [],
    );
    expect(removerEspaco(f, "c", 0).ok).toBe(false);
    const r = removerEspaco(f, "c", 1);
    expect(r.ok).toBe(true);
    if (r.ok) f = r.fluxo;
    expect(numeroDeEspacos(f.nos, "c")).toBe(3);
    expect(f.nos.find((n) => n.id === "b")?.espaco).toBe(2);
    const r2 = removerEspaco(f, "c", 1);
    expect(r2.ok).toBe(true);
    if (r2.ok) f = r2.fluxo;
    expect(numeroDeEspacos(f.nos, "c")).toBe(2);
    expect(removerEspaco(f, "c", 1).ok).toBe(false);
  });

  it("caixa dentro de caixa, em qualquer espaço", () => {
    const f = caixas(
      [
        caixa("raiz", "ou", undefined, undefined, 3),
        caixa("a", "e", "raiz", 0),
        verdadeiro("x", "a", 0),
        verdadeiro("y", "a", 1),
        caixa("b", "nao", "raiz", 2),
        falso("z", "b", 0),
        falso("w", "raiz", 1),
      ],
      [],
    );
    expect(FluxoSchema.safeParse(f).success).toBe(true);
    expect(mensagens(f)["nos.raiz"]).toContain("saída");
  });
});

describe("as operações do editor", () => {
  it("trocar E por OU pelo rótulo só vale se as peças combinam com o novo", () => {
    const f = caixas([caixa("c", "e"), botao("a", "A", "c", 0), verdadeiro("b", "c", 1)], []);
    // gatilho E condição vira gatilho OU condição: não vale
    const r = alternarCaixa(f, "c");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("precisa do E");
    const g = caixas([caixa("c", "e"), verdadeiro("a", "c", 0), falso("b", "c", 1)], []);
    const t = alternarCaixa(g, "c");
    expect(t.ok).toBe(true);
    if (t.ok) {
      expect(t.fluxo.nos.find((n) => n.id === "c")).toMatchObject({ config: { porta: "ou" } });
      expect(alternarCaixa(t.fluxo, "c").ok).toBe(true);
    }
    expect(alternarCaixa(caixas([caixa("n", "nao")], []), "n").ok).toBe(false);
  });

  it("subir e descer troca de lugar a peça com a do espaço vizinho", () => {
    let f = caixas(
      [caixa("c", "ou"), botao("a", "A", "c", 0), botao("b", "B", "c", 1), anuncio("x")],
      [["c", "saida", "x"]],
    );
    f = reordenarPeca(f, "b", -1);
    expect(f.nos.find((n) => n.id === "b")?.espaco).toBe(0);
    expect(f.nos.find((n) => n.id === "a")?.espaco).toBe(1);
    const mesmo = reordenarPeca(f, "b", -1);
    expect(mesmo).toBe(f);
  });

  it("esvaziar uma caixa de gatilho corta o fio de saída dela", () => {
    const f = caixas(
      [caixa("ou", "ou"), botao("g1", "A", "ou", 0), anuncio("x")],
      [["ou", "saida", "x"]],
    );
    const r = moverPeca(f, "g1", null);
    expect(r.ok && r.fluxo.fios).toEqual([]);
  });

  it("pôr o gatilho solto (com fios) numa caixa sem fios entrega os fios dele à caixa", () => {
    const f = caixas([caixa("ou", "ou"), botao("g", "B"), anuncio("x")], [["g", "saida", "x"]]);
    const r = moverPeca(f, "g", "ou", { espaco: 0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fluxo.fios).toEqual([
      { de: { no: "ou", saida: "saida" }, para: { no: "x", entrada: "entrada" } },
    ]);
  });

  it("soltar um gatilho em cima de outro cria uma caixa OU com os dois, herdando os fios", () => {
    const f = caixas(
      [botao("a"), sinal("b", "b"), anuncio("x")],
      [
        ["a", "saida", "x"],
        ["b", "saida", "x"],
      ],
      { caixas: true },
    );
    const r = agruparGatilhos(f, "a", "b");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fluxo.nos.find((n) => n.id === r.caixa)).toMatchObject({
      tipo: "caixa",
      config: { porta: "ou" },
    });
    expect(
      r.fluxo.nos
        .filter((n) => n.em === r.caixa)
        .map((n) => n.id)
        .sort(),
    ).toEqual(["a", "b"]);
    expect(r.fluxo.fios).toEqual([
      { de: { no: r.caixa, saida: "saida" }, para: { no: "x", entrada: "entrada" } },
    ]);
    expect(() => FluxoSchema.parse(r.fluxo)).not.toThrow();
  });

  it("apagar uma caixa apaga o que está dentro dela", () => {
    const f = caixas(
      [
        caixa("e", "e"),
        verdadeiro("c1", "e", 0),
        caixa("n", "nao", "e", 1),
        falso("c2", "n", 0),
        anuncio("fica"),
      ],
      [],
    );
    expect(semOsNos(f, new Set(["e"])).nos.map((n) => n.id)).toEqual(["fica"]);
  });

  it("organizar na grade deixa as peças de dentro com a caixa", () => {
    const f = caixas(
      [
        caixa("ou", "ou"),
        botao("g1", "A", "ou", 0),
        botao("g2", "B", "ou", 1),
        anuncio("x"),
        anuncio("y"),
      ],
      [
        ["ou", "saida", "x"],
        ["x", "saida", "y"],
      ],
    );
    const nos = organizarGrafo(f);
    const por = (id: string) => nos.find((n) => n.id === id);
    expect(por("g1")).toMatchObject({ x: f.nos[1]?.x, y: f.nos[1]?.y });
    expect((por("x")?.x ?? 0) > (por("ou")?.x ?? 0)).toBe(true);
  });
});

describe("a conversão do AU2 em caixas", () => {
  const velho = (): unknown => ({
    id: "f1",
    nome: "Velho",
    ligado: true,
    cenas: null,
    nos: [
      { id: "ga", tipo: "gatilho", x: 0, y: 0, config: { tipo: "botao", nome: "A" } },
      { id: "gb", tipo: "gatilho", x: 0, y: 100, config: { tipo: "sinal", nome: "b" } },
      { id: "jog", tipo: "condicao", x: 0, y: 0, config: { condicao: "tokenDeJogador" } },
      { id: "N", tipo: "porta", x: 0, y: 0, config: { porta: "nao" } },
      { id: "sorte", tipo: "condicao", x: 0, y: 0, config: { condicao: "chance", chance: 1 } },
      { id: "E", tipo: "porta", x: 0, y: 0, config: { porta: "e" } },
      { id: "se", tipo: "se", x: 0, y: 0, config: {} },
      {
        id: "x",
        tipo: "acao",
        x: 0,
        y: 0,
        config: { acao: { acao: "chat.anunciar", texto: "x" } },
      },
    ],
    fios: [
      { de: { no: "ga", saida: "saida" }, para: { no: "se", entrada: "entrada" } },
      { de: { no: "gb", saida: "saida" }, para: { no: "se", entrada: "entrada" } },
      { de: { no: "jog", saida: "valor" }, para: { no: "N", entrada: "entrada" } },
      { de: { no: "N", saida: "valor" }, para: { no: "E", entrada: "entradas" } },
      { de: { no: "sorte", saida: "valor" }, para: { no: "E", entrada: "entradas" } },
      { de: { no: "E", saida: "valor" }, para: { no: "se", entrada: "condicao" } },
      { de: { no: "se", saida: "sim" }, para: { no: "x", entrada: "entrada" } },
    ],
  });

  it("portas E/OU/NÃO viram caixas com as peças nos espaços, e os gatilhos do mesmo bloco viram uma caixa OU", () => {
    const f = FluxoSchema.parse(velho());
    expect(f.nos.some((n) => (n.tipo as string) === "porta")).toBe(false);
    const caixasDe = f.nos.filter((n) => n.tipo === "caixa");
    expect(caixasDe.map((n) => (n.tipo === "caixa" ? n.config.porta : "")).sort()).toEqual([
      "e",
      "nao",
      "ou",
    ]);
    const dentroDe = (id: string) =>
      f.nos
        .filter((n) => n.em === id)
        .sort((a, b) => (a.espaco ?? 0) - (b.espaco ?? 0))
        .map((n) => n.id);
    expect(dentroDe("E")).toEqual(["N", "sorte"]);
    expect(dentroDe("N")).toEqual(["jog"]);
    const ou = caixasDe.find((n) => n.tipo === "caixa" && n.config.porta === "ou");
    expect(dentroDe(ou?.id ?? "")).toEqual(["ga", "gb"]);
    expect(f.fios).toContainEqual({
      de: { no: ou?.id, saida: "saida" },
      para: { no: "se", entrada: "entrada" },
    });
    expect(f.fios).toContainEqual({
      de: { no: "E", saida: "saida" },
      para: { no: "se", entrada: "condicao" },
    });
    expect(f.caixas).toBe(true);
    expect(mensagens(f)).toEqual({});
  });

  it("uma porta com três entradas vira uma caixa com três espaços, sem aninhar à força", () => {
    const f = FluxoSchema.parse({
      id: "f1",
      nome: "Tres",
      nos: [
        { id: "g", tipo: "gatilho", x: 0, y: 0, config: { tipo: "botao", nome: "B" } },
        { id: "a", tipo: "condicao", x: 0, y: 0, config: { condicao: "chance", chance: 0 } },
        { id: "b", tipo: "condicao", x: 0, y: 0, config: { condicao: "chance", chance: 0 } },
        { id: "c", tipo: "condicao", x: 0, y: 0, config: { condicao: "chance", chance: 1 } },
        { id: "P", tipo: "porta", x: 0, y: 0, config: { porta: "ou" } },
        { id: "se", tipo: "se", x: 0, y: 0, config: {} },
        {
          id: "ok",
          tipo: "acao",
          x: 0,
          y: 0,
          config: { acao: { acao: "chat.anunciar", texto: "ok" } },
        },
      ],
      fios: [
        { de: { no: "g", saida: "saida" }, para: { no: "se", entrada: "entrada" } },
        { de: { no: "a", saida: "valor" }, para: { no: "P", entrada: "entradas" } },
        { de: { no: "b", saida: "valor" }, para: { no: "P", entrada: "entradas" } },
        { de: { no: "c", saida: "valor" }, para: { no: "P", entrada: "entradas" } },
        { de: { no: "P", saida: "valor" }, para: { no: "se", entrada: "condicao" } },
        { de: { no: "se", saida: "sim" }, para: { no: "ok", entrada: "entrada" } },
      ],
    });
    expect(f.nos.filter((n) => n.tipo === "caixa")).toHaveLength(1);
    expect(numeroDeEspacos(f.nos, "P")).toBe(3);
    expect(f.nos.filter((n) => n.em === "P").map((n) => n.espaco)).toEqual([0, 1, 2]);
    expect(avisos(disparar(comFluxos(criarEstado(), f)))).toEqual(["ok"]);
  });

  it("a mesa salva do AU2 (a fatia de automações, como vem do disco ou de um arquivo) carrega com caixas", () => {
    const a = AutomacoesSchema.parse({ fluxos: [velho()] });
    const f = a.fluxos[0];
    expect(f?.nos.some((n) => (n.tipo as string) === "porta")).toBe(false);
    expect(f?.nos.filter((n) => n.tipo === "caixa")).toHaveLength(3);
    const volta = AutomacoesSchema.parse(JSON.parse(JSON.stringify(a)));
    expect(volta.fluxos[0]).toEqual(f);
  });

  it("uma condição que servia a duas portas é copiada, não perdida", () => {
    const f = FluxoSchema.parse({
      id: "f1",
      nome: "Dupla",
      nos: [
        { id: "g", tipo: "gatilho", x: 0, y: 0, config: { tipo: "botao", nome: "B" } },
        { id: "c", tipo: "condicao", x: 0, y: 0, config: { condicao: "chance", chance: 1 } },
        { id: "d", tipo: "condicao", x: 0, y: 0, config: { condicao: "chance", chance: 1 } },
        { id: "P1", tipo: "porta", x: 0, y: 0, config: { porta: "e" } },
        { id: "P2", tipo: "porta", x: 0, y: 0, config: { porta: "ou" } },
        { id: "s1", tipo: "se", x: 0, y: 0, config: {} },
        { id: "s2", tipo: "se", x: 0, y: 0, config: {} },
      ],
      fios: [
        { de: { no: "g", saida: "saida" }, para: { no: "s1", entrada: "entrada" } },
        { de: { no: "g", saida: "saida" }, para: { no: "s2", entrada: "entrada" } },
        { de: { no: "c", saida: "valor" }, para: { no: "P1", entrada: "entradas" } },
        { de: { no: "d", saida: "valor" }, para: { no: "P1", entrada: "entradas" } },
        { de: { no: "c", saida: "valor" }, para: { no: "P2", entrada: "entradas" } },
        { de: { no: "d", saida: "valor" }, para: { no: "P2", entrada: "entradas" } },
        { de: { no: "P1", saida: "valor" }, para: { no: "s1", entrada: "condicao" } },
        { de: { no: "P2", saida: "valor" }, para: { no: "s2", entrada: "condicao" } },
      ],
    });
    expect(f.nos.filter((n) => n.tipo === "condicao")).toHaveLength(4);
    expect(f.nos.filter((n) => n.em === "P1")).toHaveLength(2);
    expect(f.nos.filter((n) => n.em === "P2")).toHaveLength(2);
  });

  it("converter duas vezes não muda nada (a marca impede reagrupar)", () => {
    const uma = FluxoSchema.parse(velho());
    expect(FluxoSchema.parse(uma)).toEqual(uma);
  });

  it("um fluxo já em caixas com dois gatilhos soltos no mesmo bloco continua do jeito que está", () => {
    const f = caixas(
      [botao("a"), sinal("b", "b"), anuncio("x")],
      [
        ["a", "saida", "x"],
        ["b", "saida", "x"],
      ],
      { caixas: true },
    );
    expect(f.nos.filter((n) => n.tipo === "caixa")).toHaveLength(0);
  });
});

describe("a frase das caixas", () => {
  const nomes = nomesDaMesa(criarEstado());

  it('"Quando qualquer um destes acontecer (a cada 3 min, ou ao apertar o botão...)" e a condição com "e"', () => {
    const f = caixas(
      [
        caixa("ou", "ou"),
        ["rel", "gatilho", { tipo: "relogio", cadaS: 180 }, "ou", 0],
        botao("bot", "Combate", "ou", 1),
        ["se", "se"],
        caixa("e", "e"),
        ["c1", "condicao", { condicao: "tokenDeJogador" }, "e", 0],
        chance("c2", 0.5, "e", 1),
        anuncio("pronto"),
      ],
      [
        ["ou", "saida", "se"],
        ["e", "saida", "se", "condicao"],
        ["se", "sim", "pronto"],
      ],
    );
    const frase = fraseDoFluxo(f, nomes);
    expect(frase).toContain("Quando qualquer um destes acontecer");
    expect(frase).toContain("a cada 3 min");
    expect(frase).toContain("ao apertar o botão “Combate”");
    expect(frase).toContain("for de um jogador e o sorteio de 50% der certo");
  });

  it("OU, NÃO e caixa dentro de caixa, em português claro, com parênteses", () => {
    const f = caixas(
      [
        botao("q", "B"),
        ["se", "se"],
        caixa("ou", "ou"),
        caixa("n", "nao", "ou", 0),
        ["c1", "condicao", { condicao: "tokenDeJogador" }, "n", 0],
        chance("c2", 0.3, "ou", 1),
        anuncio("ok"),
      ],
      [
        ["q", "saida", "se"],
        ["ou", "saida", "se", "condicao"],
        ["se", "sim", "ok"],
      ],
    );
    const frase = fraseDoFluxo(f, nomes);
    expect(frase).toContain("(NÃO o token for de um jogador) ou o sorteio de 30% der certo");
  });

  it("gatilho E condição e ação OU ação são ditos em palavras", () => {
    const f = caixas(
      [
        caixa("g", "e"),
        botao("b", "Combate", "g", 0),
        chance("c", 0.5, "g", 1),
        caixa("a", "ou"),
        na("um", "a", 0, "um"),
        na("dois", "a", 1, "dois"),
      ],
      [["g", "saida", "a"]],
    );
    const frase = fraseDoFluxo(f, nomes);
    expect(frase).toContain("mas só se o sorteio de 50% der certo");
    expect(frase).toContain("sorteia uma destas: (avisa no chat: “um”) ou (avisa no chat: “dois”)");
  });

  it("conflito: uma caixa com gatilho E gatilho é recusada pela conferência", () => {
    const f = caixas([caixa("c", "e"), botao("a", "A", "c", 0), botao("b", "B", "c", 1)], []);
    expect(conflitoDaCaixa(f.nos, "c")).toContain("use OU");
    expect(mensagens(f)["nos.c"]).toContain("use OU");
  });
});
