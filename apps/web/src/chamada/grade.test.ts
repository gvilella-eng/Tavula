import { describe, expect, it } from "vitest";
import { calcularGrade, itensDaPagina, QUADROS_POR_PAGINA, totalDePaginas } from "./grade";

const TAMANHOS: [number, number][] = [
  [1280, 560],
  [1920, 800],
  [900, 500],
  [640, 300],
  [400, 700],
];

describe("calcularGrade", () => {
  it("de 1 a 12 quadros nunca passa do espaço, mantém 16:9 e o número de células basta", () => {
    for (const [l, a] of TAMANHOS) {
      for (let n = 1; n <= 12; n++) {
        const g = calcularGrade(n, l, a, 12);
        expect(g.colunas * g.linhas).toBeGreaterThanOrEqual(n);
        expect(g.colunas * g.largura + (g.colunas - 1) * 12).toBeLessThanOrEqual(l);
        expect(g.linhas * g.altura + (g.linhas - 1) * 12).toBeLessThanOrEqual(a);
        expect(Math.abs(g.largura / g.altura - 16 / 9)).toBeLessThan(0.1);
      }
    }
  });

  it("escolhe a disposição de quadros maiores: dois quadros numa tela larga ficam lado a lado", () => {
    const g = calcularGrade(2, 1600, 700, 12);
    expect(g.colunas).toBe(2);
    expect(g.linhas).toBe(1);
  });

  it("três quadros numa janela alta empilham mais do que enfileiram", () => {
    const g = calcularGrade(3, 500, 900, 12);
    expect(g.colunas).toBe(1);
    expect(g.linhas).toBe(3);
  });

  it("nenhum quadro menor do que o de menos quadros (mais gente não aumenta o quadro)", () => {
    for (const [l, a] of TAMANHOS) {
      let anterior = Number.POSITIVE_INFINITY;
      for (let n = 1; n <= 12; n++) {
        const w = calcularGrade(n, l, a, 12).largura;
        expect(w).toBeLessThanOrEqual(anterior);
        anterior = w;
      }
    }
  });

  it("espaço zero ou negativo e n inválido não quebram", () => {
    expect(calcularGrade(0, 0, 0, 12).largura).toBe(0);
    expect(calcularGrade(-3, -5, 100, 12).colunas).toBe(1);
  });
});

describe("páginas da grade", () => {
  it("até 9 quadros por página", () => {
    expect(QUADROS_POR_PAGINA).toBe(9);
    expect(totalDePaginas(0)).toBe(1);
    expect(totalDePaginas(9)).toBe(1);
    expect(totalDePaginas(10)).toBe(2);
    expect(totalDePaginas(18)).toBe(2);
    expect(totalDePaginas(19)).toBe(3);
  });

  it("corta a página e segura o índice dentro do intervalo", () => {
    const itens = Array.from({ length: 11 }, (_, i) => i);
    expect(itensDaPagina(itens, 0)).toHaveLength(9);
    expect(itensDaPagina(itens, 1)).toEqual([9, 10]);
    expect(itensDaPagina(itens, 7)).toEqual([9, 10]);
    expect(itensDaPagina(itens, -2)).toHaveLength(9);
  });
});
