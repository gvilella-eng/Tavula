import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHAVES_DE_TOKEN,
  IDS_DOS_TEMAS,
  NOMES_DOS_TEMAS,
  nomeDaVariavel,
  TEMAS,
  TEMAS_CLAROS,
  TEMAS_PADRAO,
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
  // Q4: o ícone da etiqueta dos lugares da mesa de som (sobre o campo escuro do botão) e o nome da cor no painel.
  ...(["painel", "cabecalho", "campo"] as const).flatMap((f): Par[] => [
    ["etiquetaAzul", f],
    ["etiquetaVermelho", f],
  ]),
  ["sucesso", "campo"],
  ["aviso", "campo"],
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
  // Rolagens do chat (V4a): texto do crítico (verde) e da falha crítica (vermelho) sobre o próprio fundo.
  ["criticoTexto", "critico"],
  ["falhaCriticaTexto", "falhaCritica"],
];

describe("temas de cor", () => {
  it("os 14 temas têm exatamente as mesmas chaves, e todas as chaves de token", () => {
    const esperado = [...CHAVES_DE_TOKEN].sort();
    for (const id of IDS_DOS_TEMAS) expect(Object.keys(TEMAS[id]).sort()).toEqual(esperado);
    // V1: os três padrão primeiro, depois os escuros com personalidade, depois os claros novos.
    expect(IDS_DOS_TEMAS).toEqual([
      "grimorio",
      "escuro",
      "claro",
      "edgerunner",
      "vampiro",
      "licantropo",
      "taverna",
      "forja",
      "paladino",
      "druida",
      "leviata",
      "arcana",
      "elfico",
      "celestial",
    ]);
  });

  it("cada tema tem nome, e os ids antigos continuam com os nomes novos", () => {
    for (const id of IDS_DOS_TEMAS) expect(NOMES_DOS_TEMAS[id].length).toBeGreaterThan(0);
    expect(new Set(Object.values(NOMES_DOS_TEMAS)).size).toBe(IDS_DOS_TEMAS.length);
    expect(NOMES_DOS_TEMAS.grimorio).toBe("Grimório");
    // V1: o id `escuro` passou a se chamar Masmorra; "Edgerunner" é o tema cyberpunk novo (`edgerunner`).
    expect(NOMES_DOS_TEMAS.escuro).toBe("Masmorra");
    expect(NOMES_DOS_TEMAS.edgerunner).toBe("Edgerunner");
    expect(NOMES_DOS_TEMAS.claro).toBe("Pergaminho");
    expect(NOMES_DOS_TEMAS.elfico).toBe("Élfico");
    expect(NOMES_DOS_TEMAS.celestial).toBe("Celestial");
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
    // Os claros têm o seu próprio degradê (claro, não escuro): só os temas escuros seguem a conta.
    for (const id of IDS_DOS_TEMAS.filter((i) => !TEMAS_CLAROS.includes(i))) {
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

  // V4a: o verde do crítico e o vermelho da falha crítica são iguais em todos os temas.
  it("o verde de crítico e o vermelho de falha crítica são fixos, iguais nos 14 temas", () => {
    for (const id of IDS_DOS_TEMAS) {
      const t = TEMAS[id];
      expect(t.critico, id).toBe("#2FA46A");
      expect(t.criticoTexto, id).toBe("#0B2416");
      expect(t.falhaCritica, id).toBe("#E5484D");
      expect(t.falhaCriticaTexto, id).toBe("#1A0507");
    }
  });

  it("o anel de foco existe nos temas e vira a variável --foco", () => {
    for (const id of IDS_DOS_TEMAS) {
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

  // V1: só Grimório, Masmorra e Pergaminho são discretos; os outros têm a sua identidade e não repetem o acento
  // dourado do Grimório (nem se confundem entre si pelo acento).
  it("os temas com personalidade não usam o acento do Grimório nem repetem o de outro tema", () => {
    const comPersonalidade = IDS_DOS_TEMAS.filter((i) => !TEMAS_PADRAO.includes(i));
    expect(comPersonalidade).toHaveLength(11);
    expect(TEMAS_PADRAO).toEqual(["grimorio", "escuro", "claro"]);
    for (const id of comPersonalidade) {
      expect(TEMAS[id].acento.toUpperCase(), id).not.toBe(TEMAS.grimorio.acento.toUpperCase());
      expect(TEMAS[id].acentoForte.toUpperCase(), id).not.toBe(
        TEMAS.grimorio.acentoForte.toUpperCase(),
      );
    }
    const acentos = IDS_DOS_TEMAS.map((i) => TEMAS[i].acento.toUpperCase());
    // O Pergaminho repete o dourado do Grimório de propósito (é o par claro dele): só ele.
    expect(new Set(acentos).size).toBe(IDS_DOS_TEMAS.length - 1);
  });

  it("Vampiro e Licantropo não têm amarelo no acento nem no destaque", () => {
    // matiz do hex em graus (amarelo = 40 a 70)
    const matiz = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [
        number,
        number,
        number,
      ];
      const max = Math.max(r, g, b);
      const d = max - Math.min(r, g, b);
      if (d === 0) return 0;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const id of ["vampiro", "licantropo"] as const) {
      for (const chave of ["acento", "acentoForte", "aviso"] as const) {
        const h = matiz(TEMAS[id][chave]);
        expect(h < 40 || h > 70, `${id} ${chave} (matiz ${Math.round(h)})`).toBe(true);
      }
    }
  });

  it("a ordem dos temas é a pedida: padrão, escuros com personalidade, claros novos", () => {
    expect(IDS_DOS_TEMAS.slice(0, 3)).toEqual([...TEMAS_PADRAO]);
    expect(IDS_DOS_TEMAS.slice(-2)).toEqual(["elfico", "celestial"]);
  });
});
