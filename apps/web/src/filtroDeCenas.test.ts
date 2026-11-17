import { describe, expect, it } from "vitest";
import { filtrarCenas } from "./filtroDeCenas";

const cenas = [
  { nome: "Cena inicial" },
  { nome: "Covil" },
  { nome: "Taverna do Dragão Dourado" },
  { nome: "Cripta dos Esquecidos" },
];

describe("filtrarCenas", () => {
  it("sem texto devolve todas, na ordem", () => {
    expect(filtrarCenas(cenas, "")).toEqual(cenas);
    expect(filtrarCenas(cenas, "   ")).toEqual(cenas);
  });

  it("acha por palavra, começo de palavra, sem acento e sem diferenciar maiúsculas", () => {
    expect(filtrarCenas(cenas, "dragao").map((c) => c.nome)).toEqual(["Taverna do Dragão Dourado"]);
    expect(filtrarCenas(cenas, "TAV").map((c) => c.nome)).toEqual(["Taverna do Dragão Dourado"]);
    expect(filtrarCenas(cenas, "cri esq").map((c) => c.nome)).toEqual(["Cripta dos Esquecidos"]);
  });

  it("tolera um erro de digitação", () => {
    expect(filtrarCenas(cenas, "tavrna").map((c) => c.nome)).toEqual(["Taverna do Dragão Dourado"]);
  });

  it("sem resultado devolve lista vazia", () => {
    expect(filtrarCenas(cenas, "xyzxyz")).toEqual([]);
  });
});
