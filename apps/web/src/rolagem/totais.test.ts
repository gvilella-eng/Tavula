import { type FonteDeAleatoriedade, lerExpressao, type Rolagem, rolar } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { lerRotuloDeDano, naturalDoD20, totaisDaVantagem } from "./totais";

/** Rola a expressão com os valores dados, na ordem (os dados de verdade, de 1 a N). */
function rolada(expressao: string, ...valores: number[]): Rolagem {
  const lida = lerExpressao(expressao);
  if (!lida.ok) throw new Error(lida.motivo);
  const fila = [...valores];
  const fonte: FonteDeAleatoriedade = () => (fila.shift() ?? 1) - 1;
  return rolar(lida.expressao, fonte);
}

describe("totais da vantagem e da desvantagem (Q5)", () => {
  it("vantagem: 13 e 19, +3 -> 16 | 22, e o que vale é o total da rolagem", () => {
    const r = rolada("2d20kh1+3", 13, 19);
    expect(r.total).toBe(22);
    const t = totaisDaVantagem(r);
    expect(t).not.toBeNull();
    expect(t?.vale).toBe(22);
    expect(t?.descartado).toBe(16);
    expect(t?.dados).toEqual([
      { valor: 13, descartado: true },
      { valor: 19, descartado: false },
    ]);
  });

  it("vantagem com o primeiro dado maior: o descartado é o segundo", () => {
    const t = totaisDaVantagem(rolada("2d20kh1+5", 18, 4));
    expect(t?.vale).toBe(23);
    expect(t?.descartado).toBe(9);
  });

  it("desvantagem: 7 e 4, +4 -> o menor vale (8) e o maior esmaece (11)", () => {
    const r = rolada("2d20kl1+4", 7, 4);
    expect(r.total).toBe(8);
    const t = totaisDaVantagem(r);
    expect(t?.vale).toBe(8);
    expect(t?.descartado).toBe(11);
  });

  it("bônus negativo e sem bônus", () => {
    expect(totaisDaVantagem(rolada("2d20kh1-2", 10, 3))).toMatchObject({ vale: 8, descartado: 1 });
    expect(totaisDaVantagem(rolada("2d20kl1", 10, 3))).toMatchObject({ vale: 3, descartado: 10 });
  });

  it("empate: os dois totais são iguais", () => {
    expect(totaisDaVantagem(rolada("2d20kh1+3", 12, 12))).toMatchObject({
      vale: 15,
      descartado: 15,
    });
  });

  it("rolagem normal, sem d20 e sem descarte: não há dois totais", () => {
    expect(totaisDaVantagem(rolada("1d20+5", 11))).toBeNull();
    expect(totaisDaVantagem(rolada("2d6+3", 3, 4))).toBeNull();
    expect(totaisDaVantagem(rolada("4d6kh3", 1, 2, 3, 4))).toBeNull();
  });
});

describe("20 e 1 naturais (crítico e falha)", () => {
  it("lê o d20 que ficou", () => {
    expect(naturalDoD20(rolada("1d20+5", 20))).toBe("20");
    expect(naturalDoD20(rolada("1d20+5", 1))).toBe("1");
    expect(naturalDoD20(rolada("1d20+5", 12))).toBe("");
    // com vantagem vale o que ficou: 20 e 3 -> 20; 1 e 15 -> 15; com desvantagem 1 e 15 -> 1
    expect(naturalDoD20(rolada("2d20kh1", 20, 3))).toBe("20");
    expect(naturalDoD20(rolada("2d20kh1", 1, 15))).toBe("");
    expect(naturalDoD20(rolada("2d20kl1", 1, 15))).toBe("1");
  });
});

describe("o comentário de um dano mandado como /r", () => {
  it("magia de salvaguarda: nome, CD e tipo", () => {
    expect(lerRotuloDeDano("Chama Sagrada, CD 14, radiante")).toEqual({
      nome: "Chama Sagrada",
      cd: 14,
      tipos: ["radiante"],
      tipoTexto: "radiante",
    });
  });

  it("truque por nível: o (nível 5) vai para um campo próprio", () => {
    expect(lerRotuloDeDano("Raio de Fogo (nível 5), fogo")).toMatchObject({
      nome: "Raio de Fogo",
      nivelDoTruque: 5,
      tipos: ["fogo"],
    });
  });

  it("dois tipos de dano e o dano de energia da ficha (Força)", () => {
    expect(lerRotuloDeDano("Lâmina Solar, Cortante + Fogo")?.tipos).toEqual(["cortante", "fogo"]);
    expect(lerRotuloDeDano("Mísseis Mágicos, Força")?.tipos).toEqual(["energia"]);
  });

  it("só CD, sem tipo", () => {
    expect(lerRotuloDeDano("Pavor, CD 13")).toMatchObject({ nome: "Pavor", cd: 13, tipos: [] });
  });

  it("um /r qualquer não vira cartão de dano", () => {
    expect(lerRotuloDeDano(undefined)).toBeNull();
    expect(lerRotuloDeDano("")).toBeNull();
    expect(lerRotuloDeDano("espadada no goblin")).toBeNull();
    expect(lerRotuloDeDano("acertei, queimou tudo com fogo e gritou muito alto")).toBeNull();
  });
});
