import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAVE_TOUR_NO_TESTE, tourAbreSozinho } from "./abreSozinho";

afterEach(() => vi.unstubAllGlobals());

function comStorage(valor: string | null, quebra = false) {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => {
      if (quebra) throw new Error("bloqueado");
      return k === CHAVE_TOUR_NO_TESTE ? valor : null;
    },
  });
}

describe("tourAbreSozinho", () => {
  it("abre para a conta que ainda não viu", () => {
    expect(tourAbreSozinho({ tourVisto: false })).toBe(true);
  });

  it("não abre se a conta já viu, nem no usuário solto de teste (sem conta)", () => {
    expect(tourAbreSozinho({ tourVisto: true })).toBe(false);
    expect(tourAbreSozinho({})).toBe(false);
  });

  it("com MODO=teste só abre com a chave ligada (e o localStorage bloqueado conta como desligada)", () => {
    comStorage(null);
    expect(tourAbreSozinho({ tourVisto: false, modoTeste: true })).toBe(false);
    comStorage("1");
    expect(tourAbreSozinho({ tourVisto: false, modoTeste: true })).toBe(true);
    comStorage(null, true);
    expect(tourAbreSozinho({ tourVisto: false, modoTeste: true })).toBe(false);
  });
});
