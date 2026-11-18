import { describe, expect, it } from "vitest";
import { compartilharEstrutura } from "./estruturaCompartilhada.ts";
import { aplicarOperacoes, derivar, type Ficha, fichaNova } from "./ficha.ts";

function fichaDeTeste(): Ficha {
  const r = aplicarOperacoes(fichaNova(20), [
    { caminho: "atributos", valor: { for: 16, des: 14, con: 12, int: 10, sab: 8, car: 10 } },
    { caminho: "classes", valor: [{ classe: "Guerreiro", nivel: 5 }] },
    { caminho: "pericias", valor: { atletismo: { nivel: "proficiente" } } },
    { caminho: "salvaguardas", valor: { for: { nivel: "proficiente" } } },
    {
      caminho: "itens",
      valor: [
        { nome: "Corda", quantidade: 1, peso: 5 },
        { nome: "Tocha", quantidade: 3, peso: 1 },
      ],
    },
    {
      caminho: "ataques",
      valor: [{ nome: "Espada", atributo: "for", proficiente: true, dano: "1d8" }],
    },
    { caminho: "caracteristicas", valor: [{ nome: "Surto", descricao: "Um texto." }] },
    { caminho: "notas", valor: "uma nota" },
  ]);
  if (!r.ok) throw new Error(r.motivo);
  return r.ficha;
}

describe("compartilharEstrutura", () => {
  it("devolve a mesma referência quando o conteúdo é igual", () => {
    const antes = { a: { b: [1, 2, { c: "x" }] }, d: null };
    const depois = JSON.parse(JSON.stringify(antes));
    expect(compartilharEstrutura(antes, depois)).toBe(antes);
  });

  it("só o caminho que mudou é novo", () => {
    const antes = { a: { b: [1, 2] }, c: { d: "x" }, e: [{ f: 1 }, { f: 2 }] };
    const depois = { a: { b: [1, 2] }, c: { d: "y" }, e: [{ f: 1 }, { f: 2 }] };
    const r = compartilharEstrutura(antes, depois);
    expect(r).not.toBe(antes);
    expect(r.a).toBe(antes.a);
    expect(r.e).toBe(antes.e);
    expect(r.c).not.toBe(antes.c);
    expect(r).toEqual(depois);
  });

  it("uma lista com um item trocado reaproveita os outros itens", () => {
    const antes = [{ n: 1 }, { n: 2 }, { n: 3 }];
    const r = compartilharEstrutura(antes, [{ n: 1 }, { n: 9 }, { n: 3 }]);
    expect(r[0]).toBe(antes[0]);
    expect(r[1]).not.toBe(antes[1]);
    expect(r[2]).toBe(antes[2]);
  });

  it("chave que some ou aparece conta como mudança", () => {
    const antes = { a: 1 };
    expect(compartilharEstrutura(antes, {})).toEqual({});
    expect(compartilharEstrutura(antes, {})).not.toBe(antes);
    expect(compartilharEstrutura({}, { a: 1 })).toEqual({ a: 1 });
    expect(compartilharEstrutura({ a: undefined }, {})).not.toEqual({ a: 1 });
  });

  it("tipos diferentes devolvem o novo valor", () => {
    expect(compartilharEstrutura([1], { 0: 1 })).toEqual({ 0: 1 });
    expect(compartilharEstrutura("a", "b")).toBe("b");
    expect(compartilharEstrutura(null, { a: 1 })).toEqual({ a: 1 });
  });
});

describe("aplicarOperacoes compartilha estrutura com a ficha de entrada (Q14)", () => {
  const ref = (f: Ficha, k: keyof Ficha) => f[k];

  it("mudar o texto de um talento não troca atributos, perícias, itens, ataques nem notas", () => {
    const antes = fichaDeTeste();
    const r = aplicarOperacoes(antes, [{ caminho: "caracteristicas.0.descricao", valor: "Novo." }]);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.ficha.caracteristicas?.[0]?.descricao).toBe("Novo.");
    expect(r.ficha.caracteristicas).not.toBe(antes.caracteristicas);
    for (const k of [
      "atributos",
      "pericias",
      "salvaguardas",
      "itens",
      "ataques",
      "classes",
      "notas",
    ] as const) {
      expect(ref(r.ficha, k), k).toBe(ref(antes, k));
    }
  });

  it("mudar um atributo troca só os atributos", () => {
    const antes = fichaDeTeste();
    const r = aplicarOperacoes(antes, [{ caminho: "atributos.for", valor: 18 }]);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.ficha.atributos).not.toBe(antes.atributos);
    expect(r.ficha.atributos?.for).toBe(18);
    for (const k of [
      "pericias",
      "salvaguardas",
      "itens",
      "ataques",
      "classes",
      "caracteristicas",
      "notas",
    ] as const) {
      expect(ref(r.ficha, k), k).toBe(ref(antes, k));
    }
  });

  it("mudar a quantidade de um item reaproveita o outro item", () => {
    const antes = fichaDeTeste();
    const r = aplicarOperacoes(antes, [{ caminho: "itens.1.quantidade", valor: 4 }]);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.ficha.itens).not.toBe(antes.itens);
    expect(r.ficha.itens?.[0]).toBe(antes.itens?.[0]);
    expect(r.ficha.itens?.[1]?.quantidade).toBe(4);
  });

  it("sem mudança de conteúdo devolve a própria ficha", () => {
    const antes = fichaDeTeste();
    const r = aplicarOperacoes(antes, [{ caminho: "notas", valor: "uma nota" }]);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.ficha).toBe(antes);
  });

  it("os PV atuais continuam presos ao máximo", () => {
    const antes = fichaDeTeste();
    const r = aplicarOperacoes(antes, [{ caminho: "pvAtual", valor: 9999 }]);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.ficha.pvAtual).toBe(antes.pvMax);
  });

  it("não altera a ficha de entrada", () => {
    const antes = fichaDeTeste();
    const copia = JSON.parse(JSON.stringify(antes));
    aplicarOperacoes(antes, [{ caminho: "atributos.for", valor: 20 }]);
    expect(antes).toEqual(copia);
  });
});

describe("derivadas iguais antes e depois do compartilhamento (Q14)", () => {
  it("atributo → perícias, salvaguardas, ataque e CA; nível → proficiência", () => {
    const antes = fichaDeTeste();
    const forte = aplicarOperacoes(antes, [{ caminho: "atributos.for", valor: 20 }]);
    if (!forte.ok) throw new Error(forte.motivo);
    // o resultado compartilhado vale o mesmo que a ficha montada do zero
    expect(derivar(forte.ficha)).toEqual(derivar(JSON.parse(JSON.stringify(forte.ficha))));
    expect(derivar(forte.ficha).atributos.for.mod).toBe(5);
    expect(derivar(forte.ficha).salvaguardas.for.total).toBe(5 + derivar(forte.ficha).proficiencia);
    const atletismo = (f: Ficha) => derivar(f).pericias.find((p) => p.id === "atletismo")?.total;
    expect(atletismo(forte.ficha)).toBe(5 + derivar(forte.ficha).proficiencia);
    expect(atletismo(forte.ficha)).not.toBe(atletismo(antes));

    const nivel = aplicarOperacoes(antes, [
      { caminho: "classes", valor: [{ classe: "Guerreiro", nivel: 9 }] },
    ]);
    if (!nivel.ok) throw new Error(nivel.motivo);
    expect(derivar(antes).proficiencia).toBe(3);
    expect(derivar(nivel.ficha).proficiencia).toBe(4);
  });

  it("derivar compartilha com a derivada anterior: o que não mudou mantém a referência", () => {
    const antes = fichaDeTeste();
    const dAntes = derivar(antes);
    const r = aplicarOperacoes(antes, [
      { caminho: "caracteristicas.0.descricao", valor: "Outro." },
    ]);
    if (!r.ok) throw new Error(r.motivo);
    const dDepois = compartilharEstrutura(dAntes, derivar(r.ficha));
    expect(dDepois).toBe(dAntes);
    const forte = aplicarOperacoes(antes, [{ caminho: "atributos.for", valor: 20 }]);
    if (!forte.ok) throw new Error(forte.motivo);
    const dForte = compartilharEstrutura(dAntes, derivar(forte.ficha));
    expect(dForte.atributos).not.toBe(dAntes.atributos);
    expect(dForte.dadosDeVida).toBe(dAntes.dadosDeVida);
    expect(dForte.percepcaoPassiva).toBe(dAntes.percepcaoPassiva);
  });
});
