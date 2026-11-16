import { describe, expect, it } from "vitest";
import { NOME_DO_TIPO_DE_DANO, TIPOS_DE_DANO, tiposDeDanoDoTexto } from "./danos";
import { ICONE_DO_TIPO_DE_DANO } from "./IconeDoDano";

const OS_13_DA_5E = [
  "ácido",
  "contundente",
  "cortante",
  "elétrico",
  "energia",
  "fogo",
  "frio",
  "necrótico",
  "perfurante",
  "psíquico",
  "radiante",
  "trovejante",
  "veneno",
] as const;

describe("tipos de dano e seus ícones (Q5)", () => {
  it("cada um dos 13 tipos da 5e tem nome e um ícone próprio", () => {
    const icones = OS_13_DA_5E.map((nome) => {
      const chave = TIPOS_DE_DANO.find((t) => NOME_DO_TIPO_DE_DANO[t] === nome);
      expect(chave, nome).toBeDefined();
      return chave ? ICONE_DO_TIPO_DE_DANO[chave] : undefined;
    });
    expect(icones.every((i) => i !== undefined)).toBe(true);
    expect(new Set(icones).size).toBe(13); // nenhum repetido
  });

  it("todo tipo da lista tem ícone", () => {
    for (const t of TIPOS_DE_DANO) expect(ICONE_DO_TIPO_DE_DANO[t], t).toBeDefined();
  });

  it("lê o tipo como a ficha o escreve (com ou sem acento e caixa)", () => {
    expect(tiposDeDanoDoTexto("Ácido")).toEqual(["acido"]);
    expect(tiposDeDanoDoTexto("ELÉTRICO")).toEqual(["eletrico"]);
    expect(tiposDeDanoDoTexto("psiquico")).toEqual(["psiquico"]);
    expect(tiposDeDanoDoTexto("Força")).toEqual(["energia"]);
    expect(tiposDeDanoDoTexto("Cortante + Fogo")).toEqual(["cortante", "fogo"]);
    expect(tiposDeDanoDoTexto("fogo e fogo")).toEqual(["fogo"]);
    expect(tiposDeDanoDoTexto("Cura")).toEqual(["cura"]);
  });

  it("texto sem tipo, vazio ou ausente", () => {
    expect(tiposDeDanoDoTexto("mágico")).toEqual([]);
    expect(tiposDeDanoDoTexto("")).toEqual([]);
    expect(tiposDeDanoDoTexto(undefined)).toEqual([]);
  });
});
