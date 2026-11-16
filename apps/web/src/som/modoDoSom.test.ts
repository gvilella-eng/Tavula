import { describe, expect, it } from "vitest";
import {
  ALTURA_CHEIA_DA_FAIXA,
  ALTURA_MINIMA_SEM_ROLAGEM,
  ESCALA_MINIMA_DA_FAIXA,
  escalaDaFaixa,
} from "./modoDoSom";

describe("a escala da faixa do som (Q4b)", () => {
  it("sem altura escolhida, ou com a altura cheia ou maior, tudo no tamanho natural", () => {
    expect(escalaDaFaixa(null)).toBe(1);
    expect(escalaDaFaixa(ALTURA_CHEIA_DA_FAIXA)).toBe(1);
    expect(escalaDaFaixa(ALTURA_CHEIA_DA_FAIXA + 100)).toBe(1);
  });

  it("encolhe aos poucos até o piso e daí não encolhe mais (o corpo rola)", () => {
    const meio = escalaDaFaixa(ALTURA_CHEIA_DA_FAIXA - 30);
    expect(meio).toBeLessThan(1);
    expect(meio).toBeGreaterThan(ESCALA_MINIMA_DA_FAIXA);
    expect(escalaDaFaixa(ALTURA_MINIMA_SEM_ROLAGEM)).toBeCloseTo(ESCALA_MINIMA_DA_FAIXA, 1);
    expect(escalaDaFaixa(ALTURA_MINIMA_SEM_ROLAGEM - 50)).toBe(ESCALA_MINIMA_DA_FAIXA);
    expect(escalaDaFaixa(120)).toBe(ESCALA_MINIMA_DA_FAIXA);
  });

  it("nunca pede mais espaço do que a altura dá (sem rolagem acima do mínimo)", () => {
    for (let h = ALTURA_MINIMA_SEM_ROLAGEM; h < ALTURA_CHEIA_DA_FAIXA; h += 3) {
      const s = escalaDaFaixa(h);
      expect(42 + 20 + 190 * s).toBeLessThanOrEqual(h + 0.5);
    }
  });
});
