import { describe, expect, it } from "vitest";
import { limitarNaArea, limitarTamanho, noCanto, noTopoAoCentro } from "./geometria";

const area = { largura: 900, altura: 600 };
const janela = { largura: 300, altura: 200 };

describe("limitarNaArea", () => {
  it("não mexe no que já está dentro", () => {
    expect(limitarNaArea({ x: 100, y: 50 }, janela, area)).toEqual({ x: 100, y: 50 });
  });
  it("empurra para dentro pelos quatro lados", () => {
    expect(limitarNaArea({ x: -40, y: -9 }, janela, area)).toEqual({ x: 0, y: 0 });
    expect(limitarNaArea({ x: 800, y: 590 }, janela, area)).toEqual({ x: 600, y: 400 });
  });
  it("janela maior que a área fica no canto de cima", () => {
    expect(limitarNaArea({ x: 50, y: 50 }, { largura: 1000, altura: 700 }, area)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("limitarTamanho", () => {
  it("respeita o mínimo e o que sobra", () => {
    expect(limitarTamanho(100, 300, 800)).toBe(300);
    expect(limitarTamanho(900, 300, 800)).toBe(800);
    expect(limitarTamanho(500, 300, 800)).toBe(500);
    // sobra menos que o mínimo: vale o mínimo
    expect(limitarTamanho(500, 300, 200)).toBe(300);
  });
});

describe("posições padrão", () => {
  it("cantos e centro com folga", () => {
    expect(noCanto("topo-direita")(area, janela)).toEqual({ x: 588, y: 12 });
    expect(noCanto("baixo-esquerda")(area, janela)).toEqual({ x: 12, y: 388 });
    expect(noTopoAoCentro()(area, janela)).toEqual({ x: 300, y: 12 });
  });
});
