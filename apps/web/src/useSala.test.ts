import { describe, expect, it } from "vitest";
import { atrasoDaTentativa } from "./useSala";

describe("atrasoDaTentativa", () => {
  it("dobra a cada tentativa a partir de 0,5 s (sem jitter)", () => {
    expect(atrasoDaTentativa(0, 0.5)).toBe(500);
    expect(atrasoDaTentativa(1, 0.5)).toBe(1000);
    expect(atrasoDaTentativa(2, 0.5)).toBe(2000);
  });

  it("nunca passa de 10 s (mais o jitter)", () => {
    expect(atrasoDaTentativa(20, 0.5)).toBe(10_000);
    expect(atrasoDaTentativa(20, 1)).toBeLessThanOrEqual(12_500);
  });

  it("o jitter fica entre 75% e 125% da base", () => {
    expect(atrasoDaTentativa(1, 0)).toBe(750);
    expect(atrasoDaTentativa(1, 1)).toBe(1250);
  });
});
