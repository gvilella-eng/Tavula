import { describe, expect, it } from "vitest";
import {
  casaComABusca,
  distanciaDeEdicao,
  filtrarEOrdenar,
  normalizarParaBusca,
  pontuarBusca,
  prepararConsulta,
  toleranciaDeErros,
} from "./index.ts";

type E = { nome: string; nomeOriginal?: string };
const alfabetica = (a: E, b: E) => a.nome.localeCompare(b.nome, "pt-BR");

const BOLA: E = { nome: "Bola de Fogo", nomeOriginal: "Fireball" };
const MISSEIS: E = { nome: "Mísseis Mágicos", nomeOriginal: "Magic Missile" };
const CURA: E = { nome: "Curar Ferimentos", nomeOriginal: "Cure Wounds" };
const INVENTADA: E = { nome: "Ventania de Brasas" };
const LISTA: E[] = [BOLA, MISSEIS, CURA, INVENTADA];

const acha = (lista: E[], texto: string) =>
  filtrarEOrdenar(lista, texto, alfabetica).map((e) => e.nome);

describe("busca do compêndio (Q2b)", () => {
  it("normaliza: caixa, acento, pontuação e espaços", () => {
    expect(normalizarParaBusca("  Mísseis,   Mágicos! ")).toBe("misseis magicos");
    expect(normalizarParaBusca("Bola-de-Fogo")).toBe("bola de fogo");
  });

  it("acha pelo nome em português e pelo nome original, sem acento", () => {
    expect(acha(LISTA, "fireball")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "BOLA")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "misseis magicos")).toEqual(["Mísseis Mágicos"]);
    expect(acha(LISTA, "magic missile")).toEqual(["Mísseis Mágicos"]);
  });

  it("por palavra, em qualquer ordem", () => {
    expect(acha(LISTA, "fogo bola")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "missile magic")).toEqual(["Mísseis Mágicos"]);
    expect(acha(LISTA, "brasas ventania")).toEqual(["Ventania de Brasas"]);
  });

  it("começo de palavra", () => {
    expect(acha(LISTA, "fire")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "misse")).toEqual(["Mísseis Mágicos"]);
    expect(acha(LISTA, "vent")).toEqual(["Ventania de Brasas"]);
  });

  it("palavras de ligação na consulta não atrapalham", () => {
    expect(acha(LISTA, "bola de fogo")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "the fireball")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "ventania da brasas")).toEqual(["Ventania de Brasas"]);
  });

  it("uma consulta só de ligação ainda vale como começo de palavra", () => {
    expect(prepararConsulta("de")?.palavras).toEqual(["de"]);
    expect(acha(LISTA, "de")).toEqual(["Bola de Fogo", "Ventania de Brasas"]);
  });

  it("tolera erro de digitação (1 erro em 4 a 7 letras, 2 em 8 ou mais)", () => {
    expect(toleranciaDeErros(3)).toBe(0);
    expect(toleranciaDeErros(4)).toBe(1);
    expect(toleranciaDeErros(7)).toBe(1);
    expect(toleranciaDeErros(8)).toBe(2);
    expect(acha(LISTA, "foggo")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "bolla")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "firebal")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "fierball")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "ventanai")).toEqual(["Ventania de Brasas"]);
    expect(acha(LISTA, "misseiss")).toEqual(["Mísseis Mágicos"]);
    // letras trocadas de lugar contam como um erro só
    expect(acha(LISTA, "fgoo")).toEqual(["Bola de Fogo"]);
    expect(acha(LISTA, "fogo")).toEqual(["Bola de Fogo"]);
    expect(distanciaDeEdicao("fogo", "fgoo", 2)).toBe(1);
  });

  it("não acha o que não existe, nem por palavras curtas ou por pedaços soltos", () => {
    expect(acha(LISTA, "zzzz")).toEqual([]);
    expect(acha(LISTA, "dragao")).toEqual([]);
    expect(acha(LISTA, "xy")).toEqual([]);
    // uma palavra curta não é "semelhante" a nada: só começo ou pedaço
    expect(acha(LISTA, "fgo")).toEqual([]);
    // todas as palavras precisam casar
    expect(acha(LISTA, "fogo missile")).toEqual([]);
    // "de" não puxa tudo quando há outra palavra
    expect(acha(LISTA, "de dragao")).toEqual([]);
    expect(casaComABusca(BOLA, "   ")).toBe(true);
  });

  it("ordena por relevância: exato, depois começo, depois semelhante", () => {
    const lista: E[] = [
      { nome: "Folhagem" }, // ruído: não casa
      { nome: "Fogofátuo Ardente" }, // começo
      { nome: "Fogo" }, // exato (e é o nome todo)
      { nome: "Foggo Estranho" }, // semelhante
      { nome: "Pé de Fogo" }, // exato, mas não é o nome todo
    ];
    expect(acha(lista, "fogo")).toEqual([
      "Fogo",
      "Pé de Fogo",
      "Fogofátuo Ardente",
      "Foggo Estranho",
    ]);
  });

  it("sem busca, a ordem alfabética de sempre", () => {
    expect(acha(LISTA, "")).toEqual([
      "Bola de Fogo",
      "Curar Ferimentos",
      "Mísseis Mágicos",
      "Ventania de Brasas",
    ]);
  });

  it("a nota é nula quando não casa e maior para o nome todo", () => {
    const c = prepararConsulta("fireball");
    expect(pontuarBusca(BOLA, c)).toBeGreaterThan(0);
    expect(pontuarBusca(CURA, c)).toBeNull();
    expect(pontuarBusca(BOLA, prepararConsulta("fireball")) ?? 0).toBeGreaterThan(
      pontuarBusca(BOLA, prepararConsulta("fire")) ?? 0,
    );
  });

  it("é rápida com cerca de 1.100 entradas", () => {
    const base = ["fogo", "gelo", "vento", "trovao", "sombra", "luz", "pedra", "agua", "terra"];
    const grande: E[] = Array.from({ length: 1100 }, (_, i) => ({
      nome: `${base[i % base.length]} ${base[(i * 7) % base.length]} ${i}`,
      nomeOriginal: `Name ${i} of ${base[(i * 3) % base.length]}`,
    }));
    acha(grande, "fogo"); // aquece as palavras guardadas
    const t0 = performance.now();
    for (let k = 0; k < 10; k++) acha(grande, "trovaoo sombra");
    const porBusca = (performance.now() - t0) / 10;
    expect(porBusca).toBeLessThan(30);
  });
});
