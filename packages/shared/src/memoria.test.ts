import { describe, expect, it } from "vitest";
import {
  alcanceDaMemoria,
  CONFIG_ILUMINACAO_PADRAO,
  contarLembradas,
  corEmCanais,
  criarGrade,
  esquecerAlemDoAlcance,
  esquecerTudo,
  gradeServe,
  imagemDaMemoria,
  lembraDoPonto,
  marcarVisto,
  opacidadeDaMemoria,
  opacidadeNoPonto,
} from "./index.ts";

const config = CONFIG_ILUMINACAO_PADRAO;

describe("alcance da memória", () => {
  it("15 m + 3 m × modificador de Inteligência (padrão)", () => {
    expect(alcanceDaMemoria(config, 0)).toBe(15);
    expect(alcanceDaMemoria(config, 2)).toBe(21);
    expect(alcanceDaMemoria(config, -2)).toBe(9);
  });
  it("nunca abaixo de 0", () => {
    expect(alcanceDaMemoria(config, -5)).toBe(0);
    expect(alcanceDaMemoria({ ...config, memoriaBaseM: 6 }, -5)).toBe(0);
  });
  it("o modo fixo ignora o modificador", () => {
    const fixo = { ...config, memoriaModo: "fixo" as const, memoriaFixaM: 30 };
    expect(alcanceDaMemoria(fixo, -5)).toBe(30);
    expect(alcanceDaMemoria(fixo, 4)).toBe(30);
  });
  it("memória desligada: alcance 0", () => {
    expect(alcanceDaMemoria({ ...config, memoriaLigada: false }, 3)).toBe(0);
  });
});

describe("desbotamento", () => {
  it("é plena junto do token, cai em linha reta e some no alcance", () => {
    expect(opacidadeDaMemoria(0, 15)).toBe(1);
    expect(opacidadeDaMemoria(7.5, 15)).toBe(0.5);
    expect(opacidadeDaMemoria(15, 15)).toBe(0);
    expect(opacidadeDaMemoria(40, 15)).toBe(0);
    expect(opacidadeDaMemoria(1, 0)).toBe(0);
  });
  it("vale o token mais próximo (a maior opacidade) e a imagem sai escurecida pelo tom", () => {
    const g = criarGrade(10, 10, 1);
    g.dados.fill(1);
    const tom = corEmCanais("#808080");
    const img = imagemDaMemoria(g, [{ x: 0.5, y: 0.5, alcanceM: 10 }], tom);
    // célula do token: opacidade ~0,95 -> cinza ~122; célula distante: menor
    const r = (c: number, l: number) => img[(l * g.colunas + c) * 4] as number;
    expect(r(0, 0)).toBeGreaterThan(r(5, 0));
    expect(r(5, 0)).toBeGreaterThan(r(9, 9));
    // alfa sempre 255 (a imagem é multiplicada sobre o mapa)
    expect(img[3]).toBe(255);
    // dois tokens: vale o mais perto de cada célula
    const dois = imagemDaMemoria(
      g,
      [
        { x: 0.5, y: 0.5, alcanceM: 10 },
        { x: 9.5, y: 9.5, alcanceM: 10 },
      ],
      tom,
    );
    expect(dois[(9 * g.colunas + 9) * 4] as number).toBeGreaterThan(r(9, 9));
  });
  it("opacidadeNoPonto: zero onde não há lembrança", () => {
    const g = criarGrade(10, 10, 1);
    g.dados[0] = 1;
    const f = [{ x: 0.5, y: 0.5, alcanceM: 10 }];
    expect(opacidadeNoPonto(g, f, { x: 0.5, y: 0.5 })).toBeGreaterThan(0.9);
    expect(opacidadeNoPonto(g, f, { x: 5.5, y: 5.5 })).toBe(0);
  });
});

describe("marcar o que foi visto", () => {
  it("marca só as células cujo centro foi visto, dentro da caixa", () => {
    const g = criarGrade(10, 10, 0.5);
    const novas = marcarVisto(g, { x0: 0, y0: 0, x1: 5, y1: 5 }, (c) => c.x < 2);
    expect(novas).toBeGreaterThan(0);
    expect(lembraDoPonto(g, { x: 1, y: 1 })).toBe(true);
    expect(lembraDoPonto(g, { x: 3, y: 1 })).toBe(false);
    // de novo: nada novo
    expect(marcarVisto(g, { x0: 0, y0: 0, x1: 5, y1: 5 }, (c) => c.x < 2)).toBe(0);
  });
  it("gradeServe confere o tamanho da cena", () => {
    const g = criarGrade(60, 45);
    expect(gradeServe(g, 60, 45)).toBe(true);
    expect(gradeServe(g, 60, 50)).toBe(false);
  });
});

describe("esquecer além do alcance", () => {
  it("o que está além do alcance de todos os tokens some; o resto fica", () => {
    const g = criarGrade(60, 10, 0.5);
    marcarVisto(g, null, () => true);
    const total = contarLembradas(g);
    const esquecidas = esquecerAlemDoAlcance(g, [{ x: 5, y: 5, alcanceM: 15 }]);
    expect(esquecidas).toBeGreaterThan(0);
    expect(contarLembradas(g)).toBe(total - esquecidas);
    expect(lembraDoPonto(g, { x: 10, y: 5 })).toBe(true);
    expect(lembraDoPonto(g, { x: 25, y: 5 })).toBe(false);
  });
  it("vale o token que alcança: dois tokens guardam as duas pontas", () => {
    const g = criarGrade(60, 10, 0.5);
    marcarVisto(g, null, () => true);
    esquecerAlemDoAlcance(g, [
      { x: 5, y: 5, alcanceM: 10 },
      { x: 55, y: 5, alcanceM: 10 },
    ]);
    expect(lembraDoPonto(g, { x: 8, y: 5 })).toBe(true);
    expect(lembraDoPonto(g, { x: 52, y: 5 })).toBe(true);
    expect(lembraDoPonto(g, { x: 30, y: 5 })).toBe(false);
  });
  it("alcance 0 esquece tudo; sem tokens não esquece nada", () => {
    const g = criarGrade(10, 10, 1);
    marcarVisto(g, null, () => true);
    expect(esquecerAlemDoAlcance(g, [])).toBe(0);
    expect(contarLembradas(g)).toBe(100);
    esquecerAlemDoAlcance(g, [{ x: 5, y: 5, alcanceM: 0 }]);
    expect(contarLembradas(g)).toBe(0);
  });
  it("esquecerTudo zera a grade", () => {
    const g = criarGrade(10, 10, 1);
    marcarVisto(g, null, () => true);
    esquecerTudo(g);
    expect(contarLembradas(g)).toBe(0);
  });
});
