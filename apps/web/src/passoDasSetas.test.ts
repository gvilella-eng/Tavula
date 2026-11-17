import type { Parede } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { direcaoDaSeta, proximoPasso, teclasDeSetaDepois } from "./passoDasSetas";

const Q = 1.5;
const cena = { larguraM: 30, alturaM: 30 };

function parede(a: [number, number], b: [number, number], extra: Partial<Parede> = {}): Parede {
  return {
    id: "p",
    cenaId: "c",
    a: { x: a[0], y: a[1] },
    b: { x: b[0], y: b[1] },
    tipo: "parede",
    ...extra,
  } as Parede;
}

const base = {
  tamanhoQuadrados: 1,
  quadradoM: Q,
  cena,
  paredes: [] as Parede[],
  ehMestre: false,
};

describe("proximoPasso (as setas, com a posição pendente)", () => {
  it("anda um quadrado a partir de onde o token está na tela", () => {
    expect(proximoPasso({ ...base, de: { x: 11.25, y: 9.75 }, dx: 1, dy: 0 })).toEqual({
      x: 12.75,
      y: 9.75,
    });
    // dois passos seguidos, sem esperar a sala: o segundo parte do primeiro
    const um = proximoPasso({ ...base, de: { x: 11.25, y: 9.75 }, dx: 1, dy: 0 });
    expect(um && proximoPasso({ ...base, de: um, dx: 1, dy: 0 })).toEqual({ x: 14.25, y: 9.75 });
  });

  it("na borda da cena não anda", () => {
    expect(proximoPasso({ ...base, de: { x: 0.75, y: 9.75 }, dx: -1, dy: 0 })).toBeNull();
    expect(proximoPasso({ ...base, de: { x: 29.25, y: 9.75 }, dx: 1, dy: 0 })).toBeNull();
  });

  it("o jogador não tenta o passo que bate na parede; o mestre atravessa", () => {
    const muro = [parede([12, 0], [12, 20])];
    const de = { x: 11.25, y: 9.75 };
    expect(proximoPasso({ ...base, de, dx: 1, dy: 0, paredes: muro })).toBeNull();
    expect(proximoPasso({ ...base, de, dx: 1, dy: 0, paredes: muro, ehMestre: true })).toEqual({
      x: 12.75,
      y: 9.75,
    });
    // paralelo à parede, sem cruzar: anda
    expect(proximoPasso({ ...base, de, dx: 0, dy: 1, paredes: muro })).toEqual({
      x: 11.25,
      y: 11.25,
    });
  });

  it("porta fechada barra e porta aberta deixa passar; na cena-cartão nada barra", () => {
    const de = { x: 11.25, y: 9.75 };
    const fechada = [parede([12, 0], [12, 20], { tipo: "porta", estado: "fechada" })];
    const aberta = [parede([12, 0], [12, 20], { tipo: "porta", estado: "aberta" })];
    expect(proximoPasso({ ...base, de, dx: 1, dy: 0, paredes: fechada })).toBeNull();
    expect(proximoPasso({ ...base, de, dx: 1, dy: 0, paredes: aberta })).not.toBeNull();
    expect(
      proximoPasso({
        ...base,
        de,
        dx: 1,
        dy: 0,
        paredes: fechada,
        cena: { ...cena, cartao: true },
      }),
    ).not.toBeNull();
  });

  it("token grande encaixa pelo tamanho dele", () => {
    expect(
      proximoPasso({ ...base, tamanhoQuadrados: 2, de: { x: 3, y: 3 }, dx: 1, dy: 0 }),
    ).toEqual({ x: 4.5, y: 3 });
  });
});

describe("as teclas de seta seguradas", () => {
  it("reconhece as quatro setas e mais nada", () => {
    expect(direcaoDaSeta("ArrowLeft")).toEqual({ dx: -1, dy: 0 });
    expect(direcaoDaSeta("ArrowDown")).toEqual({ dx: 0, dy: 1 });
    expect(direcaoDaSeta("a")).toBeNull();
  });

  it("a última apertada vale; soltar uma devolve a anterior", () => {
    let t: string[] = [];
    t = teclasDeSetaDepois(t, "ArrowRight", "baixo");
    t = teclasDeSetaDepois(t, "ArrowDown", "baixo");
    expect(t).toEqual(["ArrowRight", "ArrowDown"]);
    t = teclasDeSetaDepois(t, "ArrowDown", "cima");
    expect(t).toEqual(["ArrowRight"]);
    t = teclasDeSetaDepois(t, "ArrowRight", "cima");
    expect(t).toEqual([]);
    // a mesma tecla apertada de novo não se repete na lista
    t = teclasDeSetaDepois(["ArrowLeft"], "ArrowLeft", "baixo");
    expect(t).toEqual(["ArrowLeft"]);
  });
});
