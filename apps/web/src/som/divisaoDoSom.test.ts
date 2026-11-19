import { beforeEach, describe, expect, it } from "vitest";
import {
  CHAVE_DIVISAO_DO_SOM,
  DIVISAO_MAXIMA,
  DIVISAO_MINIMA,
  DIVISAO_PADRAO,
  gravarDivisao,
  gravarLadoMinimizado,
  lerDivisao,
  lerLadoMinimizado,
  limitarDivisao,
  rotuloDaDivisao,
} from "./divisaoDoSom";

// O ambiente de unidade é o Node: um localStorage mínimo em memória.
class ArmazemFalso {
  private dados = new Map<string, string>();
  getItem(k: string) {
    return this.dados.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.dados.set(k, v);
  }
  removeItem(k: string) {
    this.dados.delete(k);
  }
}

describe("a divisão da mesa de som (MU1)", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new ArmazemFalso();
  });

  it("cerca a divisão em 18% de cada lado e ignora lixo", () => {
    expect(limitarDivisao(0.05)).toBe(DIVISAO_MINIMA);
    expect(limitarDivisao(0.99)).toBe(DIVISAO_MAXIMA);
    expect(limitarDivisao(0.4)).toBe(0.4);
    expect(limitarDivisao(Number.NaN)).toBe(DIVISAO_PADRAO);
  });

  it("o rótulo mostra os dois lados somando 100%", () => {
    expect(rotuloDaDivisao(0.55)).toBe("55% · 45%");
    expect(rotuloDaDivisao(0.1)).toBe("18% · 82%");
  });

  it("lembra a divisão e o lado minimizado; sem localStorage, volta ao meio", () => {
    expect(lerDivisao()).toBe(DIVISAO_PADRAO);
    gravarDivisao(0.3);
    expect(lerDivisao()).toBe(0.3);
    localStorage.setItem(CHAVE_DIVISAO_DO_SOM, "lixo");
    expect(lerDivisao()).toBe(DIVISAO_PADRAO);
    expect(lerLadoMinimizado()).toBeNull();
    gravarLadoMinimizado("musica");
    expect(lerLadoMinimizado()).toBe("musica");
    gravarLadoMinimizado(null);
    expect(lerLadoMinimizado()).toBeNull();
  });
});
