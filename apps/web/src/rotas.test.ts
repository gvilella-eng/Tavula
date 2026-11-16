import { describe, expect, it } from "vitest";
import { caminhoDaFicha, lerRota } from "./rotas";

describe("lerRota: a mesa de som na janela própria (Q4b)", () => {
  it("/m/<id>/som é a mesa de som sozinha", () => {
    expect(lerRota("/m/k7m2-qx9p-4tdn/som")).toEqual({
      tipo: "mesa",
      id: "k7m2-qx9p-4tdn",
      bruto: "k7m2-qx9p-4tdn",
      painel: "som",
    });
    expect(lerRota("/m/k7m2-qx9p-4tdn/som/")).toMatchObject({ painel: "som" });
    expect(lerRota("/m/k7m2-qx9p-4tdn/outra")).toEqual({ tipo: "inicio" });
    expect(lerRota("/m/k7m2-qx9p-4tdn")).not.toHaveProperty("painel");
  });
});

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

  it("/m/<id>/ficha/<fichaId> é a ficha na janela própria (V9)", () => {
    expect(lerRota("/m/k7m2-qx9p-4tdn/ficha/pers-darion")).toEqual({
      tipo: "mesa",
      id: "k7m2-qx9p-4tdn",
      bruto: "k7m2-qx9p-4tdn",
      fichaId: "pers-darion",
    });
    expect(lerRota("/m/k7m2-qx9p-4tdn/ficha/pers-darion/")).toMatchObject({
      fichaId: "pers-darion",
    });
    expect(lerRota("/m/k7m2-qx9p-4tdn/ficha/a%20b")).toMatchObject({ fichaId: "a b" });
    expect(lerRota("/m/k7m2-qx9p-4tdn/ficha")).toEqual({ tipo: "inicio" });
  });

  it("caminhoDaFicha e lerRota são inversas", () => {
    const r = lerRota(caminhoDaFicha("k7m2-qx9p-4tdn", "pers x/y"));
    expect(r).toMatchObject({ id: "k7m2-qx9p-4tdn", fichaId: "pers x/y" });
  });
});
