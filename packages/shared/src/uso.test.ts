import { describe, expect, it } from "vitest";
import { calcularUso, diaUtc } from "./index.ts";

describe("uso", () => {
  it("20 mensagens = 1 requisição e cada conexão = 1", () => {
    const u = calcularUso("2026-01-01", 40, 3);
    expect(u.requisicoes).toBe(5);
    expect(u.percentual).toBeCloseTo(0.005);
  });

  it("o dia é UTC", () => {
    expect(diaUtc(new Date("2026-03-01T02:30:00-03:00"))).toBe("2026-03-01");
    expect(diaUtc(new Date("2026-03-01T23:30:00-03:00"))).toBe("2026-03-02");
  });
});
