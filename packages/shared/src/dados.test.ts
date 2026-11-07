import { describe, expect, it } from "vitest";
import {
  d20Natural,
  dobrarDados,
  expressaoDoD20,
  fonteComSemente,
  fonteCrypto,
  formatarExpressao,
  LIMITES_DE_DADOS,
  lerExpressao,
  pedidoDeAtaque,
  pedidoDeTeste,
  rolar,
  rolarAtaque,
  rolarTeste,
} from "./index.ts";

/** Uma fonte que devolve valores prontos (0 a faces-1) na ordem; sobrando, repete o último. */
function roteiro(...faces: number[]) {
  let i = 0;
  return (max: number) => {
    const v = (faces[Math.min(i++, faces.length - 1)] as number) - 1;
    if (v < 0 || v >= max) throw new Error(`face ${v + 1} fora de d${max}`);
    return v;
  };
}

function ler(texto: string) {
  const r = lerExpressao(texto);
  if (!r.ok) throw new Error(r.motivo);
  return r.expressao;
}

describe("parser de notação", () => {
  it("lê os termos válidos e devolve a forma canônica", () => {
    const casos: [string, string][] = [
      ["1d20", "1d20"],
      ["d20", "1d20"],
      ["D20", "1d20"],
      ["d%", "1d100"],
      ["2d6+3", "2d6+3"],
      ["1d20 + 5 + 1d4", "1d20+5+1d4"],
      ["  1d8 - 2  ", "1d8-2"],
      ["1d8 − 2", "1d8-2"],
      ["-1d4+10", "-1d4+10"],
      ["2d20kh1", "2d20kh1"],
      ["2D20KL1+5", "2d20kl1+5"],
      ["4d6kh3", "4d6kh3"],
      ["1d6+1d6+1d6", "1d6+1d6+1d6"],
      ["10d6", "10d6"],
      ["1d1000", "1d1000"],
      ["100d6", "100d6"],
    ];
    for (const [entrada, saida] of casos) {
      expect(formatarExpressao(ler(entrada)), entrada).toBe(saida);
    }
  });

  it("recusa o que não é notação, com o motivo", () => {
    const invalidos = [
      "",
      "   ",
      "abc",
      "1d",
      "d",
      "1d0",
      "1d1",
      "0d6",
      "5",
      "+5",
      "1d20+",
      "1d20 5",
      "1d20++5",
      "1d20x",
      "2d20kh",
      "2d20kh0",
      "2d20kh3",
      "2d20k1",
      "1.5d6",
      "1d6;drop",
      "1d20 + abc",
    ];
    for (const entrada of invalidos) {
      const r = lerExpressao(entrada);
      expect(r.ok, `"${entrada}" deveria ser recusada`).toBe(false);
      if (!r.ok) expect(r.motivo.length).toBeGreaterThan(0);
    }
  });

  it("respeita os limites: 100 dados por termo, 1000 faces, 20 termos", () => {
    expect(lerExpressao("100d6").ok).toBe(true);
    const muitosDados = lerExpressao("101d6");
    expect(muitosDados).toEqual({ ok: false, motivo: "No máximo 100 dados por termo." });
    expect(lerExpressao("1d1000").ok).toBe(true);
    expect(lerExpressao("1d1001")).toEqual({ ok: false, motivo: "No máximo 1000 faces." });
    const vinte = Array.from({ length: 20 }, () => "1d4").join("+");
    expect(lerExpressao(vinte).ok).toBe(true);
    expect(lerExpressao(`${vinte}+1`)).toEqual({ ok: false, motivo: "No máximo 20 termos." });
    expect(lerExpressao(`1d6+${LIMITES_DE_DADOS.constante + 1}`).ok).toBe(false);
    expect(lerExpressao("1d6+".padEnd(LIMITES_DE_DADOS.caracteres + 5, "1")).ok).toBe(false);
  });

  it("recusa expressão sem nenhum dado", () => {
    expect(lerExpressao("5+3").ok).toBe(false);
  });
});

describe("rolagem", () => {
  it("guarda cada dado, o subtotal e o total (soma e subtração)", () => {
    const r = rolar(ler("2d6+1d4-3"), roteiro(4, 5, 2));
    expect(r.expressao).toBe("2d6+1d4-3");
    expect(r.total).toBe(4 + 5 + 2 - 3);
    expect(r.termos).toEqual([
      {
        tipo: "dados",
        sinal: 1,
        quantidade: 2,
        faces: 6,
        dados: [{ valor: 4 }, { valor: 5 }],
        subtotal: 9,
      },
      { tipo: "dados", sinal: 1, quantidade: 1, faces: 4, dados: [{ valor: 2 }], subtotal: 2 },
      { tipo: "constante", sinal: -1, valor: 3, subtotal: -3 },
    ]);
  });

  it("dado subtraído entra com sinal negativo", () => {
    const r = rolar(ler("1d20-1d4"), roteiro(10, 3));
    expect(r.total).toBe(7);
  });

  it("kh1 (vantagem) fica com o maior e risca o menor", () => {
    const r = rolar(ler("2d20kh1+5"), roteiro(7, 15));
    expect(r.total).toBe(20);
    const t = r.termos[0];
    expect(t?.tipo === "dados" && t.dados).toEqual([{ valor: 7, descartado: true }, { valor: 15 }]);
    expect(d20Natural(r)).toBe(15);
  });

  it("kl1 (desvantagem) fica com o menor", () => {
    const r = rolar(ler("2d20kl1"), roteiro(7, 15));
    expect(r.total).toBe(7);
    const t = r.termos[0];
    expect(t?.tipo === "dados" && t.dados).toEqual([{ valor: 7 }, { valor: 15, descartado: true }]);
  });

  it("4d6kh3 descarta só o menor; no empate descarta o último dos menores", () => {
    const r = rolar(ler("4d6kh3"), roteiro(2, 6, 2, 5));
    expect(r.total).toBe(6 + 2 + 5);
    const t = r.termos[0];
    expect(t?.tipo === "dados" && t.dados.map((d) => d.descartado === true)).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it("d20Natural é o d20 que ficou; sem d20 na rolagem é null", () => {
    expect(d20Natural(rolar(ler("1d20+5"), roteiro(20)))).toBe(20);
    expect(d20Natural(rolar(ler("2d20kl1"), roteiro(1, 20)))).toBe(1);
    expect(d20Natural(rolar(ler("1d8+3"), roteiro(8)))).toBeNull();
  });

  it("com a mesma semente a rolagem se repete; com outra, difere", () => {
    const e = ler("10d20+1d6");
    const a = rolar(e, fonteComSemente(123));
    const b = rolar(e, fonteComSemente(123));
    const c = rolar(e, fonteComSemente(124));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("crítico dobra os dados, não os modificadores", () => {
  it("dobrarDados mexe só nos termos de dados", () => {
    expect(formatarExpressao(dobrarDados(ler("2d6+1d4+3")))).toBe("4d6+2d4+3");
    expect(formatarExpressao(dobrarDados(ler("1d8-2")))).toBe("2d8-2");
  });

  it("20 natural no ataque rola o dobro de dados de dano e mantém o bônus", () => {
    // d20 = 20, depois 4 dados de d6 (2d6 dobrado) = 1, 2, 3, 4
    const r = rolarAtaque({ nome: "Espada", bonus: 5, dano: "2d6+3" }, roteiro(20, 1, 2, 3, 4));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultado.critico).toBe(true);
    expect(r.resultado.falhaCritica).toBe(false);
    expect(r.resultado.acerto.total).toBe(25);
    expect(r.resultado.dano.expressao).toBe("4d6+3");
    expect(r.resultado.dano.total).toBe(1 + 2 + 3 + 4 + 3);
  });

  it("sem 20 natural o dano não dobra", () => {
    const r = rolarAtaque({ nome: "Espada", bonus: 5, dano: "2d6+3" }, roteiro(19, 3, 4));
    expect(r.ok && r.resultado.critico).toBe(false);
    expect(r.ok && r.resultado.dano.expressao).toBe("2d6+3");
    expect(r.ok && r.resultado.dano.total).toBe(10);
  });

  it("com vantagem o crítico vale pelo d20 que ficou", () => {
    const r = rolarAtaque(
      { nome: "Arco", bonus: 4, dano: "1d8+2", vantagem: "vantagem" },
      roteiro(3, 20, 5, 6),
    );
    expect(r.ok && r.resultado.critico).toBe(true);
    expect(r.ok && r.resultado.dano.expressao).toBe("2d8+2");
    // com desvantagem os mesmos dados dão 3: não é crítico
    const d = rolarAtaque(
      { nome: "Arco", bonus: 4, dano: "1d8+2", vantagem: "desvantagem" },
      roteiro(3, 20, 5),
    );
    expect(d.ok && d.resultado.critico).toBe(false);
    expect(d.ok && d.resultado.acerto.total).toBe(7);
  });

  it("1 natural é falha crítica (e o dano ainda rola)", () => {
    const r = rolarAtaque({ nome: "Adaga", bonus: 6, dano: "1d4+2" }, roteiro(1, 3));
    expect(r.ok && r.resultado.falhaCritica).toBe(true);
    expect(r.ok && r.resultado.critico).toBe(false);
    expect(r.ok && r.resultado.dano.total).toBe(5);
  });

  it("dano inválido é recusado com o motivo", () => {
    const r = rolarAtaque({ nome: "Espada", bonus: 0, dano: "abc" }, roteiro(10));
    expect(r.ok).toBe(false);
  });
});

describe("teste com CD e teste simples", () => {
  it("expressaoDoD20 monta normal, vantagem e desvantagem", () => {
    expect(expressaoDoD20(5)).toBe("1d20+5");
    expect(expressaoDoD20(-2)).toBe("1d20-2");
    expect(expressaoDoD20(0)).toBe("1d20");
    expect(expressaoDoD20(3, "vantagem")).toBe("2d20kh1+3");
    expect(expressaoDoD20(3, "desvantagem")).toBe("2d20kl1+3");
  });

  it("com CD mostra sucesso quando o total alcança a CD", () => {
    const igual = rolarTeste(pedidoDeTeste({ nome: "Furtividade", bonus: 5, cd: 15 }), roteiro(10));
    expect(igual.ok && igual.resultado.sucesso).toBe(true);
    const abaixo = rolarTeste(
      pedidoDeTeste({ nome: "Furtividade", bonus: 5, cd: 16 }),
      roteiro(10),
    );
    expect(abaixo.ok && abaixo.resultado.sucesso).toBe(false);
  });

  it("sem CD não há veredito", () => {
    const r = rolarTeste(pedidoDeTeste({ nome: "Percepção", bonus: 2 }), roteiro(10));
    expect(r.ok && r.resultado.cd).toBeUndefined();
    expect(r.ok && r.resultado.sucesso).toBeUndefined();
  });

  it("vantagem em teste usa o maior dos dois d20", () => {
    const r = rolarTeste(
      pedidoDeTeste({ nome: "Atletismo", bonus: 1, cd: 12, vantagem: "vantagem" }),
      roteiro(4, 14),
    );
    expect(r.ok && r.resultado.rolagem.total).toBe(15);
    expect(r.ok && r.resultado.sucesso).toBe(true);
  });

  it("pedidoDeAtaque monta o pedido que a ficha manda", () => {
    expect(pedidoDeAtaque({ nome: "Maça", bonus: 4, dano: "1d6+2" }).modelo).toBe("ataque");
  });
});

describe("fonte de aleatoriedade", () => {
  it("fonteCrypto devolve sempre um inteiro dentro da faixa", () => {
    const f = fonteCrypto();
    for (const max of [2, 3, 6, 20, 100, 1000]) {
      for (let i = 0; i < 500; i++) {
        const v = f(max);
        expect(Number.isInteger(v) && v >= 0 && v < max).toBe(true);
      }
    }
  });

  it("rejeita os valores que causariam viés de módulo", () => {
    // d6: o maior múltiplo de 6 abaixo de 2^32 é 4294967292; 4294967293..95 são descartados.
    const sequencia = [4294967295, 4294967294, 4294967293, 7];
    let chamadas = 0;
    const f = fonteCrypto((b) => {
      b[0] = sequencia[chamadas++] as number;
    });
    expect(f(6)).toBe(7 % 6);
    expect(chamadas).toBe(4); // os três primeiros foram jogados fora
    // o último valor aceito (limite - 1) entra
    const g = fonteCrypto((b) => {
      b[0] = 4294967291;
    });
    expect(g(6)).toBe(4294967291 % 6);
  });

  it("rejeita máximo inválido", () => {
    expect(() => fonteCrypto()(0)).toThrow();
    expect(() => fonteCrypto()(1.5)).toThrow();
  });

  it("d20 em 100 mil rolagens: cada face perto de 5% e o qui-quadrado dentro do esperado", () => {
    const f = fonteCrypto();
    const N = 100_000;
    const contagem = new Array<number>(20).fill(0);
    for (let i = 0; i < N; i++) {
      const face = f(20);
      contagem[face] = (contagem[face] ?? 0) + 1;
    }
    const esperado = N / 20;
    // cada face: 5% ± 0,6 ponto (cerca de 8 desvios-padrão: não falha por acaso)
    for (const c of contagem) {
      expect(c / N).toBeGreaterThan(0.044);
      expect(c / N).toBeLessThan(0.056);
    }
    const quiQuadrado = contagem.reduce((s, c) => s + (c - esperado) ** 2 / esperado, 0);
    // 19 graus de liberdade: o valor crítico a 0,001 é 43,8
    expect(quiQuadrado).toBeLessThan(43.8);
  });

  it("d20 pelo caminho completo (rolar) em 100 mil rolagens: média perto de 10,5", () => {
    const f = fonteCrypto();
    const e = ler("1d20");
    let soma = 0;
    for (let i = 0; i < 100_000; i++) soma += rolar(e, f).total;
    expect(soma / 100_000).toBeGreaterThan(10.4);
    expect(soma / 100_000).toBeLessThan(10.6);
  });
});
