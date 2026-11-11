import { describe, expect, it } from "vitest";
import {
  contrasteEntre,
  corDoTextoSobre,
  haloDoTexto,
  luminancia,
  TEXTO_CLARO,
  TEXTO_ESCURO,
} from "./contrasteDeCor";

describe("texto sobre a cor do usuário ou do token", () => {
  it("amarelo e outras cores claras pedem texto escuro; cores escuras pedem texto claro", () => {
    expect(corDoTextoSobre("#F5C542")).toBe(TEXTO_ESCURO); // o amarelo do mestre
    expect(corDoTextoSobre("#FFFFFF")).toBe(TEXTO_ESCURO);
    expect(corDoTextoSobre("#E2AE4F")).toBe(TEXTO_ESCURO);
    expect(corDoTextoSobre("#000000")).toBe(TEXTO_CLARO);
    expect(corDoTextoSobre("#1F3A93")).toBe(TEXTO_CLARO);
    expect(corDoTextoSobre("#6B2D5C")).toBe(TEXTO_CLARO);
  });

  it("aceita #rgb e rejeita lixo sem quebrar", () => {
    expect(corDoTextoSobre("#fff")).toBe(TEXTO_ESCURO);
    expect(corDoTextoSobre("#000")).toBe(TEXTO_CLARO);
    expect([TEXTO_CLARO, TEXTO_ESCURO]).toContain(corDoTextoSobre("não é cor"));
    expect(luminancia("#000000")).toBe(0);
    expect(luminancia("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("o halo é a cor contrária ao texto", () => {
    expect(haloDoTexto(TEXTO_CLARO)).toBe(TEXTO_ESCURO);
    expect(haloDoTexto(TEXTO_ESCURO)).toBe(TEXTO_CLARO);
  });

  it("passa de 4,5:1 (AA) sobre qualquer cor da grade RGB (passo de 15)", () => {
    let pior = 21;
    for (let r = 0; r <= 255; r += 15) {
      for (let g = 0; g <= 255; g += 15) {
        for (let b = 0; b <= 255; b += 15) {
          const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
          const c = contrasteEntre(corDoTextoSobre(hex), hex);
          pior = Math.min(pior, c);
          expect(c, hex).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
    expect(pior).toBeGreaterThanOrEqual(4.5);
  });
});
