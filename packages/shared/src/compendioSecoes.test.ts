import { describe, expect, it } from "vitest";
import {
  type ArmaDoCompendio,
  buscarItensMagicos,
  type ItemMagicoDoCompendio,
  type MagiaDoCompendio,
  type MonstroDoCompendio,
} from "./compendio.ts";
import {
  agruparArmas,
  agruparItensMagicosPorRaridade,
  agruparMagiasPorNivel,
  agruparMonstrosPorND,
  buscarEmTodas,
  casaComABusca,
  compararNomes,
} from "./compendioSecoes.ts";

const magia = (nome: string, nivel: number, nomeOriginal?: string): MagiaDoCompendio => ({
  nome,
  ...(nomeOriginal ? { nomeOriginal } : {}),
  nivel,
  escola: "Evocação",
  tempo: "1 ação",
  alcance: "9 m",
  componentes: "V",
  duracao: "Instantânea",
  concentracao: false,
  ritual: false,
  classes: [],
  descricao: "x",
});
const monstro = (nome: string, nd: string, nomeOriginal?: string) =>
  ({ nome, nd, ...(nomeOriginal ? { nomeOriginal } : {}) }) as MonstroDoCompendio;
const itemMagico = (nome: string, raridade: ItemMagicoDoCompendio["raridade"]) =>
  ({ nome, raridade, tipo: "anel" }) as ItemMagicoDoCompendio;

describe("blocos do compêndio (Q2)", () => {
  it("magias por nível: truques primeiro, alfabético sem acento dentro", () => {
    const g = agruparMagiasPorNivel([
      magia("Raio", 3),
      magia("Zumbido", 0),
      magia("Água", 0),
      magia("Bola", 3),
      magia("Aura", 1),
    ]);
    expect(g.map((b) => b.rotulo)).toEqual(["Truques", "1º nível", "3º nível"]);
    expect(g[0]?.entradas.map((m) => m.nome)).toEqual(["Água", "Zumbido"]);
    expect(g[2]?.entradas.map((m) => m.nome)).toEqual(["Bola", "Raio"]);
  });

  it("monstros por ND: 0 < 1/8 < 1/4 < 1/2 < 1 < 10 < 30", () => {
    const g = agruparMonstrosPorND([
      monstro("A", "10"),
      monstro("B", "1/2"),
      monstro("C", "1"),
      monstro("D", "1/8"),
      monstro("E", "30"),
      monstro("F", "0"),
      monstro("H", "1/4"),
      monstro("G", "1/4"),
    ]);
    expect(g.map((b) => b.chave)).toEqual(["0", "1/8", "1/4", "1/2", "1", "10", "30"]);
    expect(g[2]?.entradas.map((m) => m.nome)).toEqual(["G", "H"]);
    expect(g[0]?.rotulo).toBe("ND 0");
  });

  it("itens mágicos por raridade, na ordem das raridades", () => {
    const g = agruparItensMagicosPorRaridade([
      itemMagico("Z", "varia"),
      itemMagico("Y", "lendário"),
      itemMagico("X", "comum"),
      itemMagico("W", "muito raro"),
      itemMagico("V", "comum"),
    ]);
    expect(g.map((b) => b.chave)).toEqual(["comum", "muito raro", "lendário", "varia"]);
    expect(g[0]?.entradas.map((i) => i.nome)).toEqual(["V", "X"]);
  });

  it("armas por categoria e alcance", () => {
    const arma = (nome: string, categoria: "simples" | "marcial", distancia: boolean) =>
      ({ nome, categoria, distancia }) as ArmaDoCompendio;
    const g = agruparArmas([
      arma("Arco longo", "marcial", true),
      arma("Clava", "simples", false),
      arma("Espada", "marcial", false),
    ]);
    expect(g.map((b) => b.rotulo)).toEqual([
      "Simples, corpo a corpo",
      "Marciais, corpo a corpo",
      "Marciais, à distância",
    ]);
  });
});

describe("filtro de sintonização (Q2)", () => {
  it("separa os itens mágicos que exigem sintonização dos que não exigem", () => {
    const com = {
      ...itemMagico("Com", "raro"),
      sintonizacao: { necessaria: true },
    } as ItemMagicoDoCompendio;
    const sem = itemMagico("Sem", "raro");
    expect(buscarItensMagicos([com, sem], { sintonizacao: true }).map((i) => i.nome)).toEqual([
      "Com",
    ]);
    expect(buscarItensMagicos([com, sem], { sintonizacao: false }).map((i) => i.nome)).toEqual([
      "Sem",
    ]);
    expect(buscarItensMagicos([com, sem], {})).toHaveLength(2);
  });
});

describe("busca por nome em português e inglês (Q2)", () => {
  it("sem acento e sem caixa, no nome e no nome original", () => {
    const bola = magia("Bola de Fogo", 3, "Fireball");
    expect(casaComABusca(bola, "bola de fogo")).toBe(true);
    expect(casaComABusca(bola, "FIREBALL")).toBe(true);
    expect(casaComABusca(magia("Mísseis", 1), "misseis")).toBe(true);
    expect(casaComABusca(bola, "ice")).toBe(false);
    expect(casaComABusca(bola, "  ")).toBe(true);
  });

  it("acha em todas as seções, e esconde os monstros do jogador", () => {
    const c = {
      magias: [magia("Bola de Fogo", 3, "Fireball")],
      monstros: [monstro("Bola de Fogo Viva", "3", "Living Fireball")],
      itensMagicos: [itemMagico("Anel do Fogo", "raro")],
      armas: [],
      itens: [{ nome: "Tocha", nomeOriginal: "Torch" }],
    };
    const mestre = buscarEmTodas(c, "fireball", true);
    expect(mestre.magias).toHaveLength(1);
    expect(mestre.monstros).toHaveLength(1);
    expect(buscarEmTodas(c, "torch", true).itens).toHaveLength(1);
    expect(buscarEmTodas(c, "fogo", false).monstros).toHaveLength(0);
    expect(buscarEmTodas(c, "fogo", false).itensMagicos).toHaveLength(1);
  });
});

describe("ordenação por nome (equivalência com a versão antiga)", () => {
  const antiga = (a: { nome: string }, b: { nome: string }): number => {
    const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
    return (
      norm(a.nome).localeCompare(norm(b.nome), "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR")
    );
  };

  it("compararNomes ordena igual à comparação antiga, inclusive nos empates", () => {
    const nomes = [
      "Árvore",
      "arvore",
      "Arvore",
      "ÁRVORE",
      "Zebra",
      "zebra",
      "Écu",
      "Ecu",
      "ecu",
      "Ação",
      "Acao",
      "Bola de Fogo",
      "bola de fogo",
      "Bôla de Fogo",
      " Bola",
      "Bola",
      "Ñandu",
      "Nandu",
      "Çedilha",
      "Cedilha",
      "Orc",
      "Órc",
      "orc",
      "",
      "A",
      "a",
      "á",
      "Ab",
      "ab",
      "Ac",
    ].map((nome) => ({ nome }));
    for (const a of nomes) {
      for (const b of nomes) {
        expect(Math.sign(compararNomes(a, b))).toBe(Math.sign(antiga(a, b)));
      }
    }
    expect([...nomes].sort(compararNomes)).toEqual([...nomes].sort(antiga));
  });
});
