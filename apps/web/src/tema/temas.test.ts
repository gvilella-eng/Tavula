import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHAVES_DE_TOKEN,
  IDS_DOS_TEMAS,
  NOMES_DOS_TEMAS,
  nomeDaVariavel,
  TEMAS,
  type Tema,
} from "./temas";

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
  it("os 11 temas têm exatamente as mesmas chaves, e todas as chaves de token", () => {
    const esperado = [...CHAVES_DE_TOKEN].sort();
    for (const id of IDS_DOS_TEMAS) expect(Object.keys(TEMAS[id]).sort()).toEqual(esperado);
    expect(IDS_DOS_TEMAS).toEqual([
      "grimorio",
      "taverna",
      "forja",
      "licantropo",
      "paladino",
      "druida",
      "leviata",
      "vampiro",
      "arcana",
      "escuro",
      "claro",
    ]);
  });

  it("cada tema tem nome, e os ids antigos continuam com os nomes novos", () => {
    for (const id of IDS_DOS_TEMAS) expect(NOMES_DOS_TEMAS[id].length).toBeGreaterThan(0);
    expect(new Set(Object.values(NOMES_DOS_TEMAS)).size).toBe(IDS_DOS_TEMAS.length);
    expect(NOMES_DOS_TEMAS.grimorio).toBe("Grimório");
    expect(NOMES_DOS_TEMAS.escuro).toBe("Edgerunner");
    expect(NOMES_DOS_TEMAS.claro).toBe("Pergaminho");
  });

  it("o degradê do painel segue os coeficientes aprovados sobre a barra de cada tema", () => {
    const canal = (h: string, i: number) => Number.parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
    const quase = (a: string, b: string) =>
      [0, 1, 2].every((i) => Math.abs(canal(a, i) - canal(b, i)) <= 2);
    const escalar = (h: string, k: number) =>
      `#${[0, 1, 2]
        .map((i) =>
          Math.min(255, Math.round(canal(h, i) * k))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`;
    // O Claro tem o seu próprio degradê (claro, não escuro): só os temas escuros seguem a conta.
    for (const id of IDS_DOS_TEMAS.filter((i) => i !== "claro")) {
      const t = TEMAS[id];
      expect(quase(t.painelTopo, escalar(t.barra, 1.2)), `${id} topo`).toBe(true);
      expect(quase(t.painelMeio, escalar(t.barra, 0.88)), `${id} meio`).toBe(true);
      expect(quase(t.painelFim, escalar(t.barra, 0.79)), `${id} fim`).toBe(true);
    }
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

  // R6a: o anel de foco do teclado (`--foco`) é elemento de interface, não texto: WCAG 1.4.11 pede 3:1 contra o que
  // está em volta. Confere contra toda superfície onde um controle pode receber foco, em todos os temas.
  const SUPERFICIES_DO_FOCO: (keyof Tema)[] = [
    "fundoMesa",
    "fundo",
    "barra",
    "painelTopo",
    "painelMeio",
    "painelFim",
    "painel",
    "cabecalho",
    "campo",
  ];
  for (const id of IDS_DOS_TEMAS) {
    it(`o anel de foco tem 3:1 contra toda superfície do tema ${id}`, () => {
      const tema = TEMAS[id];
      expect(tema.foco).toMatch(/^#[0-9A-Fa-f]{6}$/);
      const ruins = SUPERFICIES_DO_FOCO.map((f) => ({
        f,
        c: contraste(tema.foco, tema[f]),
      })).filter((p) => p.c < 3);
      expect(ruins.map((p) => `foco sobre ${p.f}: ${p.c.toFixed(2)}`)).toEqual([]);
    });
  }

  it("o anel de foco existe nos 3 temas principais e vira a variável --foco", () => {
    for (const id of ["grimorio", "escuro", "claro"] as const) {
      expect(TEMAS[id].foco.length).toBe(7);
    }
    expect(nomeDaVariavel("foco")).toBe("--foco");
  });

  it("as barras se distinguem do fundo da mesa", () => {
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

  // R3: a metade de cima da bolinha do seletor usa `amostra`, a cor viva do tema (a barra é quase preta em
  // nove deles). Cada tema tem de ser reconhecível e diferente dos outros.
  it("a amostra da bolinha se distingue da barra e das amostras dos outros temas", () => {
    const rgb = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
    };
    const distancia = (a: string, b: string) => {
      const [r1, g1, b1] = rgb(a);
      const [r2, g2, b2] = rgb(b);
      return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
    };
    for (const id of IDS_DOS_TEMAS) {
      expect(distancia(TEMAS[id].amostra, TEMAS[id].barra), `${id} x barra`).toBeGreaterThan(40);
    }
    for (const a of IDS_DOS_TEMAS) {
      for (const b of IDS_DOS_TEMAS) {
        if (a < b) {
          expect(distancia(TEMAS[a].amostra, TEMAS[b].amostra), `${a} x ${b}`).toBeGreaterThan(40);
        }
      }
    }
  });
});
