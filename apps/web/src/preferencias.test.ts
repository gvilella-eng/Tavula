import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ajustarLarguraDoPainel,
  chaveDaJanela,
  gravarJanela,
  gravarMontarDaOrdem,
  lerJanela,
  lerMontarDaOrdem,
  limitesDoPainel,
} from "./preferencias";

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

// Redesign R5b: a seção "Montar" da ordem de turno, aberta ou fechada, é preferência deste navegador.
describe("preferência da seção Montar da ordem de turno", () => {
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

  it("sem escolha devolve null; depois de escolher, lembra", () => {
    expect(lerMontarDaOrdem()).toBeNull();
    gravarMontarDaOrdem(false);
    expect(guardado.get("tabletop:pref:ordem:montar")).toBe("0");
    expect(lerMontarDaOrdem()).toBe(false);
    gravarMontarDaOrdem(true);
    expect(lerMontarDaOrdem()).toBe(true);
  });

  it("sem localStorage não quebra", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(lerMontarDaOrdem()).toBeNull();
    expect(() => gravarMontarDaOrdem(true)).not.toThrow();
  });
});
