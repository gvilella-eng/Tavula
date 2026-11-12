import { beforeEach, describe, expect, it } from "vitest";
import { esquecerMesa, lembrarMesa, lerMesasLembradas, ordenarMesasPorUso } from "./mesasLocais";

// O ambiente de unidade é o Node: um localStorage mínimo em memória.
class ArmazemFalso {
  private dados = new Map<string, string>();
  getItem(k: string) {
    return this.dados.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.dados.set(k, v);
  }
}

describe("mesas lembradas", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new ArmazemFalso();
  });

  it("lembra, atualiza o nome e a hora, e lista a mais recente primeiro", () => {
    lembrarMesa("aaaa-aaaa-aaaa", "A", 10);
    lembrarMesa("bbbb-bbbb-bbbb", "B", 20);
    expect(lerMesasLembradas().map((m) => m.id)).toEqual(["bbbb-bbbb-bbbb", "aaaa-aaaa-aaaa"]);
    lembrarMesa("aaaa-aaaa-aaaa", "A renomeada", 30);
    const lista = lerMesasLembradas();
    expect(lista).toHaveLength(2);
    expect(lista[0]).toEqual({ id: "aaaa-aaaa-aaaa", nome: "A renomeada", ultimaVez: 30 });
  });

  it("esquecer tira só a mesa pedida", () => {
    lembrarMesa("aaaa-aaaa-aaaa", "A", 1);
    lembrarMesa("bbbb-bbbb-bbbb", "B", 2);
    esquecerMesa("aaaa-aaaa-aaaa");
    expect(lerMesasLembradas().map((m) => m.id)).toEqual(["bbbb-bbbb-bbbb"]);
  });

  it("lixo no armazém ou sem localStorage não quebra nada", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => "{não é json",
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(lerMesasLembradas()).toEqual([]);
    expect(() => lembrarMesa("aaaa-aaaa-aaaa", "A")).not.toThrow();
    (globalThis as { localStorage?: unknown }).localStorage = undefined;
    expect(lerMesasLembradas()).toEqual([]);
  });

  it("ignora entradas malformadas", () => {
    const a = new ArmazemFalso();
    a.setItem(
      "tabletop:mesas",
      JSON.stringify([{ id: 1 }, null, { id: "x", nome: "X", ultimaVez: 5 }]),
    );
    (globalThis as { localStorage?: unknown }).localStorage = a;
    expect(lerMesasLembradas()).toEqual([{ id: "x", nome: "X", ultimaVez: 5 }]);
  });
});

describe("ordem da lista de mesas", () => {
  it("da usada mais recentemente para a mais antiga; as nunca abertas depois, a legada primeiro", () => {
    const lista = [
      { id: "leg", nome: "Campanha", legada: true },
      { id: "n1", nome: "Nova 1" },
      { id: "u1", nome: "Usada antes", ultimaVez: 10 },
      { id: "n2", nome: "Nova 2" },
      { id: "u2", nome: "Usada agora", ultimaVez: 50 },
    ];
    expect(ordenarMesasPorUso(lista).map((m) => m.id)).toEqual(["u2", "u1", "leg", "n1", "n2"]);
  });

  it("sem nenhum uso registrado, a legada fica em primeiro e o resto na ordem do servidor", () => {
    const lista = [
      { id: "a", nome: "A" },
      { id: "leg", nome: "Campanha", legada: true },
      { id: "b", nome: "B" },
    ];
    expect(ordenarMesasPorUso(lista).map((m) => m.id)).toEqual(["leg", "a", "b"]);
  });

  it("a legada usada mais recentemente fica na frente das outras usadas", () => {
    const lista = [
      { id: "u1", nome: "U1", ultimaVez: 5 },
      { id: "leg", nome: "Campanha", legada: true, ultimaVez: 9 },
    ];
    expect(ordenarMesasPorUso(lista).map((m) => m.id)).toEqual(["leg", "u1"]);
  });
});
