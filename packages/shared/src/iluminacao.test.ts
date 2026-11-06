import { describe, expect, it } from "vitest";
import {
  CacheDeLuz,
  calcularModelo,
  classeDeNivel,
  type LuzResolvida,
  nivelDeLuz,
  type OlhoDeVisao,
  type Segmento,
  veNoPonto,
  visaoNoPonto,
} from "./index.ts";

const LIMITES = { larguraM: 60, alturaM: 45 };

const luz = (id: string, x: number, y: number, claraM = 6, totalM = 12): LuzResolvida => ({
  id,
  x,
  y,
  claraM,
  totalM,
  cor: "#ffb347",
  tremula: false,
  morrendo: false,
});

const olho = (x: number, y: number, extra: Partial<OlhoDeVisao> = {}): OlhoDeVisao => ({
  x,
  y,
  alcanceM: 24,
  visaoNoEscuroM: 0,
  ...extra,
});

function modelo(
  opcoes: {
    olhos?: OlhoDeVisao[];
    luzes?: LuzResolvida[];
    segmentos?: Segmento[];
    ambiente?: number;
  } = {},
) {
  return calcularModelo({
    olhos: opcoes.olhos ?? [olho(10, 10)],
    luzes: opcoes.luzes ?? [],
    segmentos: opcoes.segmentos ?? [],
    limites: LIMITES,
    ambiente: opcoes.ambiente ?? 0,
  });
}

describe("nível de luz", () => {
  it("a luz plena vale 1, a penumbra 0,5 e fora dela só a ambiente", () => {
    const m = modelo({ luzes: [luz("l", 20, 20)], ambiente: 0.1 });
    expect(nivelDeLuz(m, { x: 22, y: 20 })).toBe(1);
    expect(nivelDeLuz(m, { x: 28, y: 20 })).toBeCloseTo(0.6);
    expect(nivelDeLuz(m, { x: 40, y: 20 })).toBeCloseTo(0.1);
  });
  it("luzes que se sobrepõem somam, até 1", () => {
    const m = modelo({ luzes: [luz("a", 20, 20), luz("b", 29, 20)], ambiente: 0 });
    // 26 m: penumbra das duas (0,5 + 0,5)
    expect(nivelDeLuz(m, { x: 24.5, y: 20 })).toBe(1);
    expect(nivelDeLuz(m, { x: 20, y: 31.5 })).toBe(0.5);
  });
  it("classifica em plena, penumbra e escuro", () => {
    expect(classeDeNivel(1)).toBe("plena");
    expect(classeDeNivel(0.6)).toBe("penumbra");
    expect(classeDeNivel(0.1)).toBe("escuro");
  });
});

describe("a parede bloqueia a luz como bloqueia a visão", () => {
  const parede: Segmento = { a: { x: 24, y: 0 }, b: { x: 24, y: 45 } };
  it("do outro lado da parede não há luz, mesmo perto da fonte", () => {
    const livre = modelo({ luzes: [luz("l", 20, 20)] });
    const murado = modelo({ luzes: [luz("l", 20, 20)], segmentos: [parede] });
    expect(nivelDeLuz(livre, { x: 25.5, y: 20 })).toBe(1);
    expect(nivelDeLuz(murado, { x: 25.5, y: 20 })).toBe(0);
    expect(nivelDeLuz(murado, { x: 22, y: 20 })).toBe(1);
  });
  it("a porta aberta (sem segmento) deixa a luz passar", () => {
    const aberta = modelo({ luzes: [luz("l", 20, 20)], segmentos: [] });
    expect(nivelDeLuz(aberta, { x: 25.5, y: 20 })).toBe(1);
  });
});

describe("o que o jogador vê é a interseção da luz com a visão", () => {
  it("luz sem visão não aparece, e visão sem luz também não", () => {
    // olho com 5 m de alcance; a luz acende (20,10) e arredores
    const m = modelo({ olhos: [olho(10, 10, { alcanceM: 5 })], luzes: [luz("l", 20, 10)] });
    expect(visaoNoPonto(m, { x: 20, y: 10 })).toBe("nenhuma"); // iluminado, mas fora da visão
    expect(visaoNoPonto(m, { x: 7, y: 10 })).toBe("nenhuma"); // na visão, mas no escuro
    const perto = modelo({ olhos: [olho(14, 10, { alcanceM: 10 })], luzes: [luz("l", 20, 10)] });
    expect(visaoNoPonto(perto, { x: 18, y: 10 })).toBe("plena");
    expect(visaoNoPonto(perto, { x: 5, y: 10 })).toBe("nenhuma");
  });
  it("a penumbra aparece como penumbra", () => {
    const m = modelo({ olhos: [olho(20, 10)], luzes: [luz("l", 20, 10)] });
    expect(visaoNoPonto(m, { x: 22, y: 10 })).toBe("plena");
    expect(visaoNoPonto(m, { x: 28, y: 10 })).toBe("penumbra");
    expect(veNoPonto(m, { x: 28, y: 10 })).toBe(true);
  });
  it("uma parede no meio do caminho esconde o que está iluminado do outro lado", () => {
    const m = modelo({
      olhos: [olho(10, 10)],
      luzes: [luz("l", 14, 10)],
      segmentos: [{ a: { x: 12, y: 0 }, b: { x: 12, y: 45 } }],
    });
    expect(visaoNoPonto(m, { x: 15, y: 10 })).toBe("nenhuma");
    expect(visaoNoPonto(m, { x: 11, y: 10 })).toBe("nenhuma"); // do lado do olho, sem luz
  });
  it("sem nenhum olho ninguém vê nada", () => {
    const m = modelo({ olhos: [], luzes: [luz("l", 20, 10)], ambiente: 1 });
    expect(veNoPonto(m, { x: 20, y: 10 })).toBe(false);
  });
  it("a visão dos tokens do jogador se somam (união)", () => {
    const m = modelo({
      olhos: [olho(10, 10, { alcanceM: 4 }), olho(30, 10, { alcanceM: 4 })],
      ambiente: 1,
    });
    expect(veNoPonto(m, { x: 12, y: 10 })).toBe(true);
    expect(veNoPonto(m, { x: 32, y: 10 })).toBe(true);
    expect(veNoPonto(m, { x: 20, y: 10 })).toBe(false);
  });
});

describe("visão no escuro", () => {
  const dv = (extra: Partial<OlhoDeVisao> = {}) => olho(10, 10, { visaoNoEscuroM: 18, ...extra });
  it("o escuro aparece em tons de cinza dentro do alcance, e nada fora dele", () => {
    const m = modelo({ olhos: [dv()], ambiente: 0 });
    expect(visaoNoPonto(m, { x: 20, y: 10 })).toBe("cinza");
    expect(visaoNoPonto(m, { x: 29, y: 10 })).toBe("nenhuma"); // 19 m: além dos 18 m
  });
  it("sem visão no escuro o mesmo lugar é invisível", () => {
    const m = modelo({ olhos: [olho(10, 10)], ambiente: 0 });
    expect(visaoNoPonto(m, { x: 20, y: 10 })).toBe("nenhuma");
  });
  it("a penumbra vale como luz plena para quem tem visão no escuro", () => {
    const luzes = [luz("l", 20, 10)];
    const com = modelo({ olhos: [dv()], luzes });
    const sem = modelo({ olhos: [olho(10, 10)], luzes });
    expect(visaoNoPonto(sem, { x: 27, y: 10 })).toBe("penumbra");
    expect(visaoNoPonto(com, { x: 27, y: 10 })).toBe("plena");
    // a luz plena segue plena
    expect(visaoNoPonto(com, { x: 22, y: 10 })).toBe("plena");
  });
  it("a visão no escuro também respeita as paredes", () => {
    const m = modelo({
      olhos: [dv()],
      segmentos: [{ a: { x: 14, y: 0 }, b: { x: 14, y: 45 } }],
    });
    expect(visaoNoPonto(m, { x: 12, y: 10 })).toBe("cinza");
    expect(visaoNoPonto(m, { x: 18, y: 10 })).toBe("nenhuma");
  });
  it("não passa do alcance de visão do token", () => {
    const m = modelo({ olhos: [dv({ alcanceM: 6 })], ambiente: 0 });
    expect(visaoNoPonto(m, { x: 14, y: 10 })).toBe("cinza");
    expect(visaoNoPonto(m, { x: 20, y: 10 })).toBe("nenhuma");
  });
});

describe("desempenho", () => {
  it("30 luzes e 500 paredes: os polígonos saem em tempo razoável", () => {
    const segmentos: Segmento[] = [];
    // 500 paredes curtas espalhadas numa grade de pilares e corredores
    for (let i = 0; i < 500; i++) {
      const x = 2 + (i % 25) * 2.3;
      const y = 2 + Math.floor(i / 25) * 2.1;
      segmentos.push(
        i % 2 === 0 ? { a: { x, y }, b: { x: x + 1.5, y } } : { a: { x, y }, b: { x, y: y + 1.5 } },
      );
    }
    const luzes: LuzResolvida[] = [];
    for (let i = 0; i < 30; i++) {
      luzes.push(luz(`l${i}`, 4 + (i % 6) * 9, 4 + Math.floor(i / 6) * 8, 4, 8));
    }
    const olhos = [olho(5, 5), olho(30, 20, { visaoNoEscuroM: 18 })];
    const inicio = Date.now();
    const m = calcularModelo({
      olhos,
      luzes,
      segmentos,
      limites: { larguraM: 60, alturaM: 45 },
      ambiente: 0.1,
    });
    const ms = Date.now() - inicio;
    expect(m.luzes).toHaveLength(30);
    expect(m.luzes.every((l) => l.total.length > 3)).toBe(true);
    // Folga grande para não ficar frágil em máquina lenta; a medição normal fica na casa de 10 a 40 ms.
    expect(ms).toBeLessThan(500);
  });
});

describe("cache dos polígonos das luzes", () => {
  it("reaproveita a luz que não mudou e refaz quando a luz ou as paredes mudam", () => {
    const cache = new CacheDeLuz();
    const entrada = (luzes: LuzResolvida[], segmentos: Segmento[] = []) =>
      calcularModelo({
        olhos: [olho(10, 10)],
        luzes,
        segmentos,
        limites: LIMITES,
        ambiente: 0,
        cache,
      });
    const a = entrada([luz("l", 20, 20)]);
    const b = entrada([luz("l", 20, 20)]); // o olho poderia ter andado: a luz é a mesma
    expect(b.luzes[0]?.total).toBe(a.luzes[0]?.total);
    const movida = entrada([luz("l", 21, 20)]);
    expect(movida.luzes[0]?.total).not.toBe(a.luzes[0]?.total);
    const murada = entrada([luz("l", 21, 20)], [{ a: { x: 24, y: 0 }, b: { x: 24, y: 45 } }]);
    expect(murada.luzes[0]?.total).not.toBe(movida.luzes[0]?.total);
    expect(nivelDeLuz(murada, { x: 25.5, y: 20 })).toBe(0);
  });
});
