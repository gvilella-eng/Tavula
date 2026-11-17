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

describe("otimizações da busca (equivalência com a versão antiga)", () => {
  // A versão de antes, com arrays novos a cada chamada.
  function distanciaAntiga(a: string, b: string, limite: number): number {
    if (Math.abs(a.length - b.length) > limite) return limite + 1;
    let anterior2: number[] = [];
    let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const atual = [i];
      let menor = i;
      for (let j = 1; j <= b.length; j++) {
        const custo = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(
          (anterior[j] ?? 0) + 1,
          (atual[j - 1] ?? 0) + 1,
          (anterior[j - 1] ?? 0) + custo,
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          v = Math.min(v, (anterior2[j - 2] ?? 0) + 1);
        }
        atual.push(v);
        if (v < menor) menor = v;
      }
      if (menor > limite) return limite + 1;
      anterior2 = anterior;
      anterior = atual;
    }
    return anterior[b.length] ?? limite + 1;
  }

  it("distanciaDeEdicao com buffers reutilizados dá o mesmo que a versão antiga", () => {
    let semente = 7;
    const alea = () => {
      semente = (semente * 1664525 + 1013904223) % 4294967296;
      return semente / 4294967296;
    };
    const palavra = () =>
      Array.from({ length: Math.floor(alea() * 9) }, () => "abcd"[Math.floor(alea() * 4)]).join("");
    for (let k = 0; k < 4000; k++) {
      const a = palavra();
      const b = palavra();
      const limite = Math.floor(alea() * 4);
      expect(distanciaDeEdicao(a, b, limite)).toBe(distanciaAntiga(a, b, limite));
    }
  });
});
