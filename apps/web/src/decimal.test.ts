import { describe, expect, it } from "vitest";
import { formatarDecimal, lerDecimal } from "./decimal";

describe("decimal em pt-BR", () => {
  it("mostra com vírgula e sem zeros à toa", () => {
    expect(formatarDecimal(0.5)).toBe("0,5");
    expect(formatarDecimal(3)).toBe("3");
    expect(formatarDecimal(1.2345)).toBe("1,23");
    expect(formatarDecimal(-2.5)).toBe("-2,5");
  });

  it("aceita vírgula ou ponto na digitação", () => {
    expect(lerDecimal("0,5")).toBe(0.5);
    expect(lerDecimal("0.5")).toBe(0.5);
    expect(lerDecimal(" 12 ")).toBe(12);
    expect(lerDecimal("-1,25")).toBe(-1.25);
    expect(lerDecimal(",5")).toBe(0.5);
  });

  it("vazio é nulo e lixo é inválido", () => {
    expect(lerDecimal("")).toBeNull();
    expect(lerDecimal("   ")).toBeNull();
    expect(lerDecimal("abc")).toBe("invalido");
    expect(lerDecimal("1,2,3")).toBe("invalido");
    expect(lerDecimal("1e3")).toBe("invalido");
  });
});
