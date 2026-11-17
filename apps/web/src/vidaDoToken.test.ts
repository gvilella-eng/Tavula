import { describe, expect, it } from "vitest";
import { deltaDaVidaEmLote, mudancasDaVidaDoToken, operacoesDaVida } from "./vidaDoToken";

describe("mudancasDaVidaDoToken (Q10)", () => {
  const vida = { atual: 12, max: 20, temp: 0 };
  it("vira valores absolutos para o token.vida", () => {
    expect(mudancasDaVidaDoToken("-7", vida)).toEqual({ atual: 5 });
    expect(mudancasDaVidaDoToken("+50", vida)).toEqual({ atual: 20 });
    expect(mudancasDaVidaDoToken("12", vida)).toEqual({});
    expect(mudancasDaVidaDoToken("-4", { ...vida, temp: 3 })).toEqual({ atual: 11, temp: null });
    expect(mudancasDaVidaDoToken("x", vida)).toBeNull();
  });
});

const ficha = { pvAtual: 12, pvMax: 20 };

describe("operacoesDaVida (N1)", () => {
  it("valor absoluto, entre 0 e o máximo", () => {
    expect(operacoesDaVida("15", ficha)).toEqual([{ caminho: "pvAtual", valor: 15 }]);
    expect(operacoesDaVida("99", ficha)).toEqual([{ caminho: "pvAtual", valor: 20 }]);
    expect(operacoesDaVida("0", ficha)).toEqual([{ caminho: "pvAtual", valor: 0 }]);
    expect(operacoesDaVida("12", ficha)).toEqual([]);
  });

  it("relativo: -7 tira, +3 soma, sem passar de 0 nem do máximo", () => {
    expect(operacoesDaVida("-7", ficha)).toEqual([{ caminho: "pvAtual", valor: 5 }]);
    expect(operacoesDaVida("−7", ficha)).toEqual([{ caminho: "pvAtual", valor: 5 }]);
    expect(operacoesDaVida("-50", ficha)).toEqual([{ caminho: "pvAtual", valor: 0 }]);
    expect(operacoesDaVida("+3", ficha)).toEqual([{ caminho: "pvAtual", valor: 15 }]);
    expect(operacoesDaVida("+50", ficha)).toEqual([{ caminho: "pvAtual", valor: 20 }]);
  });

  it("o dano consome o PV temporário primeiro", () => {
    expect(operacoesDaVida("-4", { ...ficha, pvTemp: 3 })).toEqual([
      { caminho: "pvAtual", valor: 11 },
      { caminho: "pvTemp", valor: null },
    ]);
    expect(operacoesDaVida("-2", { ...ficha, pvTemp: 3 })).toEqual([
      { caminho: "pvTemp", valor: 1 },
    ]);
  });

  it("texto que não é número não grava", () => {
    expect(operacoesDaVida("", ficha)).toBeNull();
    expect(operacoesDaVida("abc", ficha)).toBeNull();
    expect(operacoesDaVida("1.5", ficha)).toBeNull();
  });
});

describe("deltaDaVidaEmLote (Q11)", () => {
  it("só -N e +N valem (o mesmo para todos); sem sinal, zero ou lixo não valem", () => {
    expect(deltaDaVidaEmLote("-5")).toBe(-5);
    expect(deltaDaVidaEmLote("−5")).toBe(-5);
    expect(deltaDaVidaEmLote(" +3 ")).toBe(3);
    expect(deltaDaVidaEmLote("12")).toBeNull();
    expect(deltaDaVidaEmLote("-0")).toBeNull();
    expect(deltaDaVidaEmLote("")).toBeNull();
    expect(deltaDaVidaEmLote("-x")).toBeNull();
    expect(deltaDaVidaEmLote("-1.5")).toBeNull();
  });
});
