import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ajustarLarguraDoPainel,
  chaveDaJanela,
  gravarJanela,
  gravarReguaGrudar,
  lerJanela,
  lerReguaGrudar,
  limitesDoPainel,
} from "./preferencias";
import { lerUnidade } from "./unidade";

// Redesign R2: a largura do painel direito vai de 300 px a 1/4 da janela (se 1/4 for menos que 300, 300).
describe("largura do painel direito", () => {
  it("o máximo é 1/4 da janela e o mínimo é 300", () => {
    expect(limitesDoPainel(1600)).toEqual({ min: 300, max: 400 });
    expect(limitesDoPainel(1280)).toEqual({ min: 300, max: 320 });
    expect(limitesDoPainel(1000)).toEqual({ min: 300, max: 300 });
    expect(limitesDoPainel(800)).toEqual({ min: 300, max: 300 });
    expect(limitesDoPainel(2560)).toEqual({ min: 300, max: 640 });
  });

  it("ajusta para dentro dos limites e arredonda", () => {
    expect(ajustarLarguraDoPainel(100, 1600)).toBe(300);
    expect(ajustarLarguraDoPainel(360, 1600)).toBe(360);
    expect(ajustarLarguraDoPainel(900, 1600)).toBe(400);
    expect(ajustarLarguraDoPainel(360, 1280)).toBe(320);
    expect(ajustarLarguraDoPainel(340.4, 1600)).toBe(340);
    expect(ajustarLarguraDoPainel(500, 900)).toBe(300);
  });
});

// Redesign R3: posição, tamanho e minimizada de cada janela, por navegador, em `tabletop:pref:janela:<id>`.
describe("preferência das janelas", () => {
  const guardado = new Map<string, string>();
  beforeEach(() => {
    guardado.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
      removeItem: (k: string) => void guardado.delete(k),
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("grava e lê por janela, com a chave tabletop:pref:janela:<id>", () => {
    gravarJanela("ficha:pers-aldric", { x: 10.4, y: 20, largura: 640, minimizada: true });
    expect(guardado.has("tabletop:pref:janela:ficha:pers-aldric")).toBe(true);
    expect(chaveDaJanela("ordem")).toBe("tabletop:pref:janela:ordem");
    expect(lerJanela("ficha:pers-aldric")).toEqual({
      x: 10,
      y: 20,
      largura: 640,
      minimizada: true,
    });
    expect(lerJanela("outra")).toEqual({});
  });

  it("sem nada escolhido não deixa lixo guardado", () => {
    gravarJanela("ordem", { x: 1, y: 2 });
    gravarJanela("ordem", {});
    expect(guardado.size).toBe(0);
  });

  it("ignora valor estragado e posição pela metade", () => {
    guardado.set(chaveDaJanela("a"), "isto não é json");
    expect(lerJanela("a")).toEqual({});
    guardado.set(chaveDaJanela("b"), JSON.stringify({ x: 5, largura: -3, altura: "x" }));
    expect(lerJanela("b")).toEqual({});
  });

  it("sem localStorage (bloqueado) nada quebra", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(lerJanela("a")).toEqual({});
    expect(() => gravarJanela("a", { x: 1, y: 1 })).not.toThrow();
  });
});

// V13: a régua gruda no grid por padrão e a unidade é metros por padrão; sem localStorage nada quebra.
describe("preferências da régua e da unidade", () => {
  const guardado = new Map<string, string>();
  beforeEach(() => {
    guardado.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
      removeItem: (k: string) => void guardado.delete(k),
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("a régua gruda por padrão e lembra a escolha em tabletop:pref:reguaGrudar", () => {
    expect(lerReguaGrudar()).toBe(true);
    gravarReguaGrudar(false);
    expect(guardado.get("tabletop:pref:reguaGrudar")).toBe("0");
    expect(lerReguaGrudar()).toBe(false);
  });

  it("a unidade é metros por padrão e lembra os pés em tabletop:pref:unidade", () => {
    expect(lerUnidade()).toBe("m");
    guardado.set("tabletop:pref:unidade", "pes");
    expect(lerUnidade()).toBe("pes");
    guardado.set("tabletop:pref:unidade", "lixo");
    expect(lerUnidade()).toBe("m");
  });

  it("sem localStorage, os padrões valem", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(lerReguaGrudar()).toBe(true);
    expect(lerUnidade()).toBe("m");
    expect(() => gravarReguaGrudar(false)).not.toThrow();
  });
});
