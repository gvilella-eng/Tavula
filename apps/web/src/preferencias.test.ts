import { describe, expect, it } from "vitest";
import { ajustarLarguraDoPainel, limitesDoPainel } from "./preferencias";

// Redesign R2: a largura do painel direito vai de 300 px a 1/4 da janela (se 1/4 for menos que 300, 300).
describe("largura do painel direito", () => {
  it("o máximo é 1/4 da janela e o mínimo é 300", () => {
    expect(limitesDoPainel(1600)).toEqual({ min: 300, max: 400 });
    expect(limitesDoPainel(1280)).toEqual({ min: 300, max: 320 });
    expect(limitesDoPainel(1000)).toEqual({ min: 300, max: 300 });
    expect(limitesDoPainel(800)).toEqual({ min: 300, max: 300 });
    expect(limitesDoPainel(2560)).toEqual({ min: 300, max: 640 });
  });

  it("ajusta para dentro dos limites e arredonda", () => {
    expect(ajustarLarguraDoPainel(100, 1600)).toBe(300);
    expect(ajustarLarguraDoPainel(360, 1600)).toBe(360);
    expect(ajustarLarguraDoPainel(900, 1600)).toBe(400);
    expect(ajustarLarguraDoPainel(360, 1280)).toBe(320);
    expect(ajustarLarguraDoPainel(340.4, 1600)).toBe(340);
    expect(ajustarLarguraDoPainel(500, 900)).toBe(300);
  });
});
