import { describe, expect, it } from "vitest";
import {
  bloqueiaVisao,
  type Parede,
  type Ponto,
  poligonoDeVisibilidade,
  pontoNaUniao,
  pontoNoPoligono,
  type Segmento,
} from "./index.ts";

declare const performance: { now(): number };

const SALA = { larguraM: 20, alturaM: 20 };

/** Área pela fórmula do cadarço. */
function area(p: readonly Ponto[]): number {
  let soma = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i] as Ponto;
    const b = p[(i + 1) % p.length] as Ponto;
    soma += a.x * b.y - b.x * a.y;
  }
  return Math.abs(soma) / 2;
}

const seg = (x1: number, y1: number, x2: number, y2: number): Segmento => ({
  a: { x: x1, y: y1 },
  b: { x: x2, y: y2 },
});

function parede(tipo: Parede["tipo"], estado?: Parede["estado"]): Parede {
  return {
    id: "p",
    cenaId: "c",
    a: { x: 10, y: 0 },
    b: { x: 10, y: 20 },
    tipo,
    ...(estado ? { estado } : {}),
  };
}

describe("o que bloqueia a visão", () => {
  it("parede, porta fechada ou trancada e secreta fechada; não a janela, a invisível nem as abertas", () => {
    expect(bloqueiaVisao(parede("parede"))).toBe(true);
    expect(bloqueiaVisao(parede("porta", "fechada"))).toBe(true);
    expect(bloqueiaVisao(parede("porta", "trancada"))).toBe(true);
    expect(bloqueiaVisao(parede("secreta", "fechada"))).toBe(true);
    expect(bloqueiaVisao(parede("porta", "aberta"))).toBe(false);
    expect(bloqueiaVisao(parede("secreta", "aberta"))).toBe(false);
    expect(bloqueiaVisao(parede("janela"))).toBe(false);
    expect(bloqueiaVisao(parede("invisivel"))).toBe(false);
  });
});

describe("polígono de visibilidade", () => {
  it("sala quadrada vazia: enxerga a sala inteira", () => {
    const p = poligonoDeVisibilidade({ x: 7, y: 5 }, [], SALA, null);
    expect(area(p)).toBeCloseTo(400, 3);
    expect(pontoNoPoligono({ x: 1, y: 1 }, p)).toBe(true);
    expect(pontoNoPoligono({ x: 19, y: 19 }, p)).toBe(true);
  });

  it("origem fora da cena: nada", () => {
    expect(poligonoDeVisibilidade({ x: -1, y: 5 }, [], SALA, null)).toEqual([]);
  });

  it("o alcance limita a visão a (quase) um círculo", () => {
    const p = poligonoDeVisibilidade({ x: 10, y: 10 }, [], SALA, 5);
    // polígono inscrito de 32 lados: um pouco menos que o círculo de raio 5
    expect(area(p)).toBeGreaterThan(Math.PI * 25 * 0.98);
    expect(area(p)).toBeLessThan(Math.PI * 25 * 1.001);
    expect(pontoNoPoligono({ x: 10, y: 14 }, p)).toBe(true);
    expect(pontoNoPoligono({ x: 10, y: 16 }, p)).toBe(false);
  });

  it("pilar no meio: cria sombra atrás dele", () => {
    const pilar = [seg(9, 9, 11, 9), seg(11, 9, 11, 11), seg(11, 11, 9, 11), seg(9, 11, 9, 9)];
    const p = poligonoDeVisibilidade({ x: 4, y: 10 }, pilar, SALA, null);
    expect(pontoNoPoligono({ x: 8, y: 10 }, p)).toBe(true);
    expect(pontoNoPoligono({ x: 15, y: 10 }, p)).toBe(false); // atrás do pilar
    expect(pontoNoPoligono({ x: 15, y: 3 }, p)).toBe(true); // de lado
    expect(area(p)).toBeLessThan(400 - 4);
  });

  it("parede dividindo a sala: não vê o outro lado; porta aberta deixa ver", () => {
    const paredeCheia = [seg(10, 0, 10, 20)];
    const fechada = poligonoDeVisibilidade({ x: 5, y: 10 }, paredeCheia, SALA, null);
    expect(pontoNoPoligono({ x: 15, y: 10 }, fechada)).toBe(false);
    expect(area(fechada)).toBeCloseTo(200, 1);

    // a mesma parede com um vão de 2 m (a porta aberta) entre y = 9 e y = 11
    const comVao = [seg(10, 0, 10, 9), seg(10, 11, 10, 20)];
    const aberta = poligonoDeVisibilidade({ x: 5, y: 10 }, comVao, SALA, null);
    expect(pontoNoPoligono({ x: 15, y: 10 }, aberta)).toBe(true);
    expect(pontoNoPoligono({ x: 15, y: 17 }, aberta)).toBe(false);
  });

  it("porta fechada × aberta pelas regras de bloqueio", () => {
    const todas: Parede[] = [
      { id: "a", cenaId: "c", a: { x: 10, y: 0 }, b: { x: 10, y: 9 }, tipo: "parede" },
      {
        id: "b",
        cenaId: "c",
        a: { x: 10, y: 9 },
        b: { x: 10, y: 11 },
        tipo: "porta",
        estado: "fechada",
      },
      { id: "c", cenaId: "c", a: { x: 10, y: 11 }, b: { x: 10, y: 20 }, tipo: "parede" },
    ];
    const comoSegmentos = (lista: Parede[]) => lista.filter(bloqueiaVisao);
    const fechada = poligonoDeVisibilidade({ x: 5, y: 10 }, comoSegmentos(todas), SALA, null);
    expect(pontoNoPoligono({ x: 15, y: 10 }, fechada)).toBe(false);
    const abertas = todas.map((p) => (p.id === "b" ? { ...p, estado: "aberta" as const } : p));
    const aberta = poligonoDeVisibilidade({ x: 5, y: 10 }, comoSegmentos(abertas), SALA, null);
    expect(pontoNoPoligono({ x: 15, y: 10 }, aberta)).toBe(true);
  });

  it("janela não bloqueia a visão", () => {
    const todas: Parede[] = [
      { id: "a", cenaId: "c", a: { x: 10, y: 0 }, b: { x: 10, y: 20 }, tipo: "janela" },
    ];
    const p = poligonoDeVisibilidade({ x: 5, y: 10 }, todas.filter(bloqueiaVisao), SALA, null);
    expect(pontoNoPoligono({ x: 15, y: 10 }, p)).toBe(true);
    expect(area(p)).toBeCloseTo(400, 3);
  });

  it("token encostado num canto enxerga os dois lados da quina e não vaza pelas paredes", () => {
    // quina interna de um corredor em L: duas paredes se encontram em (10, 10)
    const quina = [seg(10, 0, 10, 10), seg(10, 10, 20, 10)];
    const p = poligonoDeVisibilidade({ x: 10.05, y: 9.95 }, quina, SALA, null);
    expect(p.length).toBeGreaterThan(4);
    expect(pontoNoPoligono({ x: 10.05, y: 9.95 }, p)).toBe(true);
    expect(pontoNoPoligono({ x: 15, y: 5 }, p)).toBe(true); // o canto livre, à direita e acima
    expect(pontoNoPoligono({ x: 5, y: 5 }, p)).toBe(false); // atrás da parede vertical
    expect(pontoNoPoligono({ x: 15, y: 15 }, p)).toBe(false); // atrás da parede horizontal
    for (const ponto of p) {
      expect(Number.isFinite(ponto.x) && Number.isFinite(ponto.y)).toBe(true);
    }
  });

  it("segmentos colineares (uma parede em dois pedaços) bloqueiam como uma só", () => {
    const duas = [seg(10, 0, 10, 8), seg(10, 8, 10, 20)];
    const p = poligonoDeVisibilidade({ x: 5, y: 10 }, duas, SALA, null);
    expect(area(p)).toBeCloseTo(200, 1);
    expect(pontoNoPoligono({ x: 15, y: 8 }, p)).toBe(false);
    expect(pontoNoPoligono({ x: 15, y: 10 }, p)).toBe(false);
    // olhando exatamente ao longo da linha da parede
    const ao_longo = poligonoDeVisibilidade({ x: 10, y: 19 }, duas, SALA, null);
    expect(ao_longo.length).toBeGreaterThan(0);
  });

  it("a união de dois polígonos enxerga o que cada um enxerga", () => {
    const paredeCheia = [seg(10, 0, 10, 20)];
    const esquerda = poligonoDeVisibilidade({ x: 5, y: 10 }, paredeCheia, SALA, null);
    const direita = poligonoDeVisibilidade({ x: 15, y: 10 }, paredeCheia, SALA, null);
    expect(pontoNaUniao({ x: 2, y: 2 }, [esquerda, direita])).toBe(true);
    expect(pontoNaUniao({ x: 18, y: 18 }, [esquerda, direita])).toBe(true);
    expect(pontoNaUniao({ x: 18, y: 18 }, [esquerda])).toBe(false);
  });

  it("desempenho: 500 segmentos e 8 fontes em menos de 16 ms", () => {
    // Pseudoaleatório determinístico: paredes curtas (1 a 4 m) espalhadas numa cena de 60 x 45 m e
    // oito fontes, com alcance de 18 m (a visão de um personagem) e sem limite.
    let semente = 12345;
    const aleatorio = () => {
      semente = (semente * 1664525 + 1013904223) % 4294967296;
      return semente / 4294967296;
    };
    const cena = { larguraM: 60, alturaM: 45 };
    const segmentos: Segmento[] = Array.from({ length: 500 }, () => {
      const x = aleatorio() * 60;
      const y = aleatorio() * 45;
      const ang = aleatorio() * Math.PI * 2;
      const len = 1 + aleatorio() * 3;
      return seg(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    });
    const fontes: Ponto[] = Array.from({ length: 8 }, (_, i) => ({ x: 6 + i * 6.5, y: 22 }));
    for (const alcance of [18, null]) {
      const rodar = () => fontes.map((f) => poligonoDeVisibilidade(f, segmentos, cena, alcance));
      rodar(); // aquecimento do JIT
      const melhor = Math.min(
        ...Array.from({ length: 8 }, () => {
          const t0 = performance.now();
          rodar();
          return performance.now() - t0;
        }),
      );
      expect(melhor, `alcance ${alcance}`).toBeLessThan(16);
    }
  });
});
