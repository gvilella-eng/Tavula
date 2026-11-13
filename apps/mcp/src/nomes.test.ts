import { describe, expect, it } from "vitest";
import { ErroDoMcp } from "./erros.ts";
import { achar, acharExato, nomeNumerado } from "./nomes.ts";

type Item = { id: string; nome: string };
const itens: Item[] = [
  { id: "a1", nome: "Goblin" },
  { id: "a2", nome: "Goblin Chefe" },
  { id: "a3", nome: "Ogro" },
  { id: "a4", nome: "Ogro" },
  { id: "a5", nome: "Lobo Sombrio" },
];
const o = { rotulo: "ficha", nomeDe: (i: Item) => i.nome, idDe: (i: Item) => i.id };

describe("tradução de nomes para ids", () => {
  it("acha pelo nome sem acento nem caixa e pelo id", () => {
    expect(achar(itens, "lobo SOMBRIO", o).id).toBe("a5");
    expect(achar(itens, "a3", o).id).toBe("a3");
  });

  it("o nome igual ganha de um trecho (Goblin não é ambíguo com Goblin Chefe)", () => {
    expect(achar(itens, "goblin", o).id).toBe("a1");
  });

  it("aceita um trecho que só um item tem", () => {
    expect(achar(itens, "sombrio", o).id).toBe("a5");
  });

  it("nome repetido dá um erro que pede o id", () => {
    expect(() => achar(itens, "Ogro", o)).toThrow(ErroDoMcp);
    expect(() => achar(itens, "Ogro", o)).toThrow(/Use o id: a3, a4/);
  });

  it("trecho que serve para vários dá um erro que lista os candidatos", () => {
    const lista: Item[] = [
      { id: "x1", nome: "Espada Longa" },
      { id: "x2", nome: "Espada Curta" },
    ];
    expect(() => achar(lista, "espada", o)).toThrow(/Espada Longa.*Espada Curta/);
  });

  it("nome que não existe diz o que existe", () => {
    expect(() => achar(itens, "Dragão", o)).toThrow(
      /Não achei a ficha "Dragão"\. Existem: "Goblin"/,
    );
  });

  it("lista vazia e nome vazio têm erro claro", () => {
    expect(() => achar([], "x", o)).toThrow(/Não existe nenhuma ficha/);
    expect(() => achar(itens, "  ", o)).toThrow(/Diga o nome/);
  });

  it("acharExato só aceita o nome inteiro (serve para decidir criar ou editar)", () => {
    expect(acharExato(itens, "ogro", (i) => i.nome)?.id).toBe("a3");
    expect(acharExato(itens, "gob", (i) => i.nome)).toBeUndefined();
  });

  it("nomeNumerado põe o próximo número livre", () => {
    expect(nomeNumerado("Goblin", ["Ogro"])).toBe("Goblin");
    expect(nomeNumerado("Goblin", ["Goblin", "Goblin 2"])).toBe("Goblin 3");
  });
});
