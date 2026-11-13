import { CONDICOES, iconesDoToken } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { CHAVES_DE_ICONE, iconeDaChave, svgDoIcone } from "./condicoesIcones";

describe("ícones das condições (V11)", () => {
  it("toda condição, a exaustão e a concentração têm ícone", () => {
    for (const c of CONDICOES) expect(iconeDaChave(c), c).toBeDefined();
    expect(iconeDaChave("exaustao")).toBeDefined();
    expect(iconeDaChave("concentracao")).toBeDefined();
    expect(CHAVES_DE_ICONE).toHaveLength(CONDICOES.length + 2);
  });

  it("os ícones não se repetem", () => {
    const icones = CHAVES_DE_ICONE.map((c) => iconeDaChave(c));
    expect(new Set(icones).size).toBe(icones.length);
  });

  it("o SVG sai com a cor pedida", () => {
    const svg = svgDoIcone("cego", "#9aa7bd");
    expect(svg).toContain("<svg");
    expect(svg).toContain("#9aa7bd");
    expect(svgDoIcone("nao-existe", "#fff")).toBeNull();
  });

  it("os marcadores do token trazem uma chave que tem ícone", () => {
    const marcas = iconesDoToken({
      condicoes: [...CONDICOES],
      exaustao: 3,
      concentracao: "Bênção",
    });
    expect(marcas).toHaveLength(CONDICOES.length + 2);
    for (const m of marcas) expect(iconeDaChave(m.chave), m.chave).toBeDefined();
    expect(marcas.find((m) => m.chave === "exaustao")?.nivel).toBe(3);
  });
});
