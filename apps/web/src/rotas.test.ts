import { describe, expect, it } from "vitest";
import { lerRota } from "./rotas";

describe("lerRota", () => {
  it("a raiz e qualquer caminho desconhecido são a tela inicial", () => {
    expect(lerRota("/")).toEqual({ tipo: "inicio" });
    expect(lerRota("/qualquer/coisa")).toEqual({ tipo: "inicio" });
    expect(lerRota("/m")).toEqual({ tipo: "inicio" });
  });

  it("/m/<id> é a mesa, com o id na forma canônica", () => {
    expect(lerRota("/m/k7m2-qx9p-4tdn")).toEqual({
      tipo: "mesa",
      id: "k7m2-qx9p-4tdn",
      bruto: "k7m2-qx9p-4tdn",
    });
    expect(lerRota("/m/K7M2-QX9P-4TDN/")).toMatchObject({ id: "k7m2-qx9p-4tdn" });
  });

  it("id inválido vira a mesa com id nulo (a tela mostra a mensagem)", () => {
    expect(lerRota("/m/nao-e-id")).toMatchObject({ tipo: "mesa", id: null });
    expect(lerRota("/m/%E0%A4%A")).toMatchObject({ tipo: "mesa", id: null });
  });
});
