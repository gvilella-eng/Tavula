import { afterEach, describe, expect, it, vi } from "vitest";
import { abaVizinha, CHAVE_ABA_DO_SOM, gravarAbaDoSom, lerAbaDoSom } from "./abaDoSom";

function guardaFalsa(inicial: Record<string, string> = {}) {
  const dados = { ...inicial };
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => dados[k] ?? null,
    setItem: (k: string, v: string) => {
      dados[k] = v;
    },
  });
}

describe("aba da mesa de som", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("abre em Efeitos e ambientes por padrão, mesmo sem localStorage", () => {
    expect(lerAbaDoSom()).toBe("efeitos");
    gravarAbaDoSom("musica"); // não quebra
    guardaFalsa();
    expect(lerAbaDoSom()).toBe("efeitos");
  });

  it("lembra a aba escolhida e ignora lixo", () => {
    guardaFalsa();
    gravarAbaDoSom("musica");
    expect(lerAbaDoSom()).toBe("musica");
    guardaFalsa({ [CHAVE_ABA_DO_SOM]: "qualquer" });
    expect(lerAbaDoSom()).toBe("efeitos");
  });

  it("as setas dão a volta", () => {
    expect(abaVizinha("efeitos", 1)).toBe("musica");
    expect(abaVizinha("musica", 1)).toBe("efeitos");
    expect(abaVizinha("efeitos", -1)).toBe("musica");
  });
});
