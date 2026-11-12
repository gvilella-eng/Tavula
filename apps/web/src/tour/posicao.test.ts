import { describe, expect, it } from "vitest";
import { posicionarCartao, type Retangulo } from "./posicao";

const CARTAO = { w: 340, h: 190 };
const JANELA = { w: 1280, h: 720 };

function dentro(p: { x: number; y: number }, j = JANELA) {
  expect(p.x).toBeGreaterThanOrEqual(12);
  expect(p.y).toBeGreaterThanOrEqual(12);
  expect(p.x + CARTAO.w).toBeLessThanOrEqual(j.w - 12);
  expect(p.y + CARTAO.h).toBeLessThanOrEqual(j.h - 12);
}

function cobre(p: { x: number; y: number }, a: Retangulo) {
  return p.x < a.x + a.w && p.x + CARTAO.w > a.x && p.y < a.y + a.h && p.y + CARTAO.h > a.y;
}

describe("posicionarCartao", () => {
  it("sem alvo, fica no meio", () => {
    const p = posicionarCartao(null, CARTAO, JANELA);
    expect(p).toEqual({ x: (1280 - 340) / 2, y: (720 - 190) / 2 });
  });

  it("alvo largo no alto: o cartão desce para baixo dele", () => {
    const alvo = { x: 200, y: 4, w: 120, h: 40 };
    const p = posicionarCartao(alvo, CARTAO, JANELA);
    expect(p.y).toBeGreaterThan(alvo.y + alvo.h);
    dentro(p);
  });

  it("alvo alto na borda direita (o painel): o cartão vai para a esquerda dele", () => {
    const alvo = { x: 920, y: 48, w: 360, h: 672 };
    const p = posicionarCartao(alvo, CARTAO, JANELA);
    expect(p.x + CARTAO.w).toBeLessThanOrEqual(alvo.x);
    dentro(p);
  });

  it("alvo alto na borda esquerda (as ferramentas): o cartão vai para a direita", () => {
    const alvo = { x: 0, y: 60, w: 52, h: 400 };
    const p = posicionarCartao(alvo, CARTAO, JANELA);
    expect(p.x).toBeGreaterThanOrEqual(alvo.x + alvo.w);
    dentro(p);
  });

  it("alvo no canto de baixo: o cartão sobe e não sai da janela", () => {
    const alvo = { x: 1100, y: 690, w: 150, h: 30 };
    const p = posicionarCartao(alvo, CARTAO, JANELA);
    dentro(p);
    expect(cobre(p, alvo)).toBe(false);
  });

  it("alvo que ocupa quase tudo (o mapa): cabe dentro da janela mesmo cobrindo o alvo", () => {
    const alvo = { x: 52, y: 48, w: 868, h: 672 };
    dentro(posicionarCartao(alvo, CARTAO, JANELA));
  });

  it("em qualquer alvo e janela pequena, o cartão cabe inteiro", () => {
    const pequena = { w: 700, h: 520 };
    for (const alvo of [
      { x: 0, y: 0, w: 50, h: 30 },
      { x: 650, y: 490, w: 50, h: 30 },
      { x: 300, y: 200, w: 100, h: 100 },
      { x: 0, y: 0, w: 700, h: 520 },
    ]) {
      dentro(posicionarCartao(alvo, CARTAO, pequena), pequena);
    }
  });
});
