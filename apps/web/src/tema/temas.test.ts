import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAVES_DE_TOKEN, IDS_DOS_TEMAS, nomeDaVariavel, TEMAS, type Tema } from "./temas";

function luminancia(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const canais = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (canais[0] as number) + 0.7152 * (canais[1] as number) + 0.0722 * (canais[2] as number)
  );
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return ((x as number) + 0.05) / ((y as number) + 0.05);
}

type Par = [texto: keyof Tema, fundo: keyof Tema];

// Todo par de texto e fundo que a interface usa de fato. Texto normal: AA = 4,5:1.
const PARES: Par[] = [
  ...(["barra", "painel", "cabecalho", "campo", "fundo"] as const).flatMap((f): Par[] => [
    ["texto", f],
    ["textoSuave", f],
    ["acentoForte", f],
    ["perigo", f],
  ]),
  ...(["painelTopo", "painelMeio", "painelFim"] as const).flatMap((f): Par[] => [
    ["texto", f],
    ["textoSuave", f],
    ["acentoForte", f],
  ]),
  ["acentoTexto", "acento"],
  ["perigoTexto", "perigo"],
  ["sucesso", "painel"],
  ["sucesso", "cabecalho"],
  ["sucessoTexto", "sucesso"],
  ["aviso", "painel"],
  ["aviso", "cabecalho"],
  ["aviso", "avisoFundo"],
  ["avisoTexto", "aviso"],
  ["oculta", "painel"],
  ["oculta", "cabecalho"],
  ["oculta", "barra"],
  ["texto", "avisoFundo"],
  ["perigo", "perigoFundo"],
  ["texto", "perigoFundo"],
];

describe("temas de cor", () => {
  it("os 3 temas têm exatamente as mesmas chaves, e todas as chaves de token", () => {
    const esperado = [...CHAVES_DE_TOKEN].sort();
    for (const id of IDS_DOS_TEMAS) expect(Object.keys(TEMAS[id]).sort()).toEqual(esperado);
    expect(IDS_DOS_TEMAS).toEqual(["grimorio", "escuro", "claro"]);
  });

  for (const id of IDS_DOS_TEMAS) {
    it(`contraste AA (4,5:1) em todos os pares de texto e fundo do tema ${id}`, () => {
      const tema = TEMAS[id];
      const ruins = PARES.map(([t, f]) => ({ t, f, c: contraste(tema[t], tema[f]) })).filter(
        (p) => p.c < 4.5,
      );
      expect(ruins.map((p) => `${p.t} sobre ${p.f}: ${p.c.toFixed(2)}`)).toEqual([]);
    });
  }

  it("as barras se distinguem do fundo da mesa (couro x carvão)", () => {
    for (const id of IDS_DOS_TEMAS) {
      expect(TEMAS[id].barra).not.toBe(TEMAS[id].fundoMesa);
      expect(TEMAS[id].fundo).not.toBe(TEMAS[id].fundoMesa);
    }
  });

  it("o nome da variável CSS segue o padrão em português", () => {
    expect(nomeDaVariavel("textoSuave")).toBe("--texto-suave");
    expect(nomeDaVariavel("fundoMesa")).toBe("--fundo-mesa");
  });

  it("o index.html pinta o fundo certo antes do JS carregar (cores iguais às dos temas)", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    for (const id of IDS_DOS_TEMAS) {
      const re = new RegExp(`data-tema="${id}"\\]\\s*\\{\\s*background:\\s*(#[0-9a-fA-F]{6})`);
      const m = re.exec(html);
      expect(m?.[1]?.toUpperCase(), id).toBe(TEMAS[id].fundo.toUpperCase());
    }
  });
});
