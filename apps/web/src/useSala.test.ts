import { describe, expect, it } from "vitest";
import { atrasoDaTentativa, duracaoDoAviso, recusaSilenciosa } from "./useSala";

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

describe("duracaoDoAviso", () => {
  it("fica o mínimo de 6 s em aviso curto", () => {
    expect(duracaoDoAviso("Fora de alcance.")).toBe(6000);
  });

  it("cresce com o tamanho do texto, sem passar de 12 s", () => {
    const medio = duracaoDoAviso("x".repeat(80));
    expect(medio).toBeGreaterThan(6000);
    expect(medio).toBeLessThan(12000);
    expect(duracaoDoAviso("x".repeat(500))).toBe(12000);
  });
});

describe("recusaSilenciosa (Q12: o gesto de mover cujo resultado já se vê não ganha aviso)", () => {
  it("parede, token que não é meu e token que sumiu, em qualquer pedido de mover", () => {
    for (const tipo of ["token.soltar", "token.mover", "tokens.mover"]) {
      expect(recusaSilenciosa(tipo, "trajeto_bloqueado"), tipo).toBe(true);
      expect(recusaSilenciosa(tipo, "sem_permissao"), tipo).toBe(true);
      expect(recusaSilenciosa(tipo, "token_inexistente"), tipo).toBe(true);
    }
  });

  it("erro de verdade e outros pedidos continuam avisando", () => {
    expect(recusaSilenciosa("token.soltar", "dados_invalidos")).toBe(false);
    expect(recusaSilenciosa("token.apagar", "sem_permissao")).toBe(false);
    expect(recusaSilenciosa("porta.alternar", "porta_trancada")).toBe(false);
    expect(recusaSilenciosa(undefined, "trajeto_bloqueado")).toBe(false);
  });
});
