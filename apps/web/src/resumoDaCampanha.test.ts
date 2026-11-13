import { describe, expect, it } from "vitest";
import { resumoDaCampanha, textoDoResumo } from "./resumoDaCampanha";

describe("resumoDaCampanha", () => {
  it("conta cenas, fichas e tokens", () => {
    const r = resumoDaCampanha({
      formato: "tabletop-campanha",
      dados: { cenas: [{}, {}], personagens: [{}], tokens: [{}, {}, {}] },
    });
    expect(r).toEqual({ cenas: 2, fichas: 1, tokens: 3 });
    expect(r && textoDoResumo(r)).toBe("2 cenas · 1 ficha · 3 tokens");
  });
  it("arquivo antigo sem fichas conta zero", () => {
    expect(resumoDaCampanha({ dados: { cenas: [{}], tokens: [] } })).toEqual({
      cenas: 1,
      fichas: 0,
      tokens: 0,
    });
  });
  it("o que não é campanha dá nada", () => {
    expect(resumoDaCampanha(null)).toBeNull();
    expect(resumoDaCampanha({ formato: "outro" })).toBeNull();
    expect(resumoDaCampanha("texto")).toBeNull();
    expect(resumoDaCampanha({ dados: { cenas: 1 } })).toBeNull();
  });
});
