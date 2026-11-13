import { describe, expect, it } from "vitest";
import { posicaoDoRotulo } from "./posicaoDaRegua";

const area = { largura: 800, altura: 600 };
const rotulo = { largura: 200, altura: 24 };
const afastamento = { dx: 14, dy: 14 };

describe("posicaoDoRotulo", () => {
  it("à direita e embaixo quando cabe", () => {
    expect(posicaoDoRotulo({ x: 100, y: 100 }, afastamento, rotulo, area, [])).toEqual({
      x: 114,
      y: 114,
    });
  });
  it("à esquerda quando não cabe à direita", () => {
    const p = posicaoDoRotulo({ x: 700, y: 100 }, afastamento, rotulo, area, []);
    expect(p).toEqual({ x: 700 - 14 - 200, y: 114 });
    expect(p.x + rotulo.largura).toBeLessThanOrEqual(area.largura);
  });
  it("em cima quando não cabe embaixo", () => {
    expect(posicaoDoRotulo({ x: 100, y: 590 }, afastamento, rotulo, area, [])).toEqual({
      x: 114,
      y: 590 - 14 - 24,
    });
  });
  it("à esquerda e em cima no canto de baixo à direita", () => {
    expect(posicaoDoRotulo({ x: 790, y: 590 }, afastamento, rotulo, area, [])).toEqual({
      x: 790 - 14 - 200,
      y: 590 - 14 - 24,
    });
  });
  it("foge do retângulo do zoom", () => {
    const zoom = { x: 500, y: 540, largura: 290, altura: 50 };
    const p = posicaoDoRotulo({ x: 450, y: 530 }, afastamento, rotulo, area, [zoom]);
    // à direita e embaixo cairia em cima do zoom: vai para a esquerda, que está livre
    expect(p.x + rotulo.largura).toBeLessThanOrEqual(zoom.x);
  });
  it("sem lugar nenhum, fica preso dentro da área", () => {
    const p = posicaoDoRotulo(
      { x: 50, y: 50 },
      afastamento,
      { largura: 900, altura: 24 },
      area,
      [],
    );
    expect(p.x).toBeGreaterThanOrEqual(4);
  });
});
