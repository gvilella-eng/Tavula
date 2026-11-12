import { describe, expect, it } from "vitest";
import {
  derivarMembros,
  type Estado,
  estadoDeMesaNova,
  fichasSemMembro,
  jogadoresDaMesa,
  membrosDaMesa,
  type Personagem,
  planejarAceite,
  proximoIdDeJogador,
  USUARIOS_DA_MESA_NOVA,
  type Usuario,
} from "./index.ts";

const MESTRE: Usuario = { id: "mestre", nome: "Mestre", papel: "mestre", cor: "#d4a017" };
const vaga = (n: number): Usuario => ({
  id: `jogador-${n}`,
  nome: `Jogador ${n}`,
  papel: "jogador",
  cor: "#3cb44b",
});
const ficha = (id: string, ids: string[] | "todos", pj = false): Personagem =>
  ({
    id,
    nome: id,
    pastaId: "p",
    editores: ids === "todos" ? { tipo: "todos" } : { tipo: "jogadores", ids },
    ...(pj ? { ficha: { apresentacao: "personagem" } } : {}),
  }) as Personagem;

/** A campanha: o mestre, a vaga 1 com conta (Uker) e as vagas 2 a 4 escondidas. */
function campanha(extra: Partial<Estado> = {}): Estado {
  return {
    ...estadoDeMesaNova(1000),
    usuarios: [MESTRE, vaga(1), vaga(2), vaga(3), vaga(4)],
    personagens: [
      ficha("uker", ["jogador-1"]),
      ficha("bruxa", ["jogador-2"]),
      ficha("npc", []),
      ficha("orfa", [], true),
      ficha("grupo", "todos"),
    ],
    ...extra,
  };
}

describe("V7: membros da mesa", () => {
  it("a mesa nova nasce só com o mestre", () => {
    expect(USUARIOS_DA_MESA_NOVA.map((u) => u.id)).toEqual(["mestre"]);
  });

  it("sem o campo `membros` todos contam (estado antigo e testes de unidade)", () => {
    expect(membrosDaMesa(campanha()).map((u) => u.id)).toEqual([
      "mestre",
      "jogador-1",
      "jogador-2",
      "jogador-3",
      "jogador-4",
    ]);
  });

  it("com `membros`, só o mestre e quem está na lista; o jogador filtra igual", () => {
    const e = campanha({ membros: ["jogador-1"] });
    expect(membrosDaMesa(e).map((u) => u.id)).toEqual(["mestre", "jogador-1"]);
    expect(jogadoresDaMesa(e).map((u) => u.id)).toEqual(["jogador-1"]);
    // o mestre é sempre membro, mesmo que a lista não o cite
    expect(membrosDaMesa(campanha({ membros: [] })).map((u) => u.id)).toEqual(["mestre"]);
  });

  it("derivarMembros: mestre e contas ativas; o login solto de teste só vale em MODO=teste", () => {
    const todos = [MESTRE, vaga(1), vaga(2), vaga(3)];
    const contas = new Set(["jogador-1"]);
    expect(derivarMembros(todos, contas, ["jogador-3"], false)).toEqual(["mestre", "jogador-1"]);
    expect(derivarMembros(todos, contas, ["jogador-3"], true)).toEqual([
      "mestre",
      "jogador-1",
      "jogador-3",
    ]);
    expect(derivarMembros(todos, new Set(), [], true)).toEqual(["mestre"]);
  });

  it("fichas sem membro: as de vaga escondida e as sem dono; nunca as de um membro, as de todos nem NPC", () => {
    const e = campanha({ membros: ["jogador-1"] });
    expect(fichasSemMembro(e).map((p) => p.id)).toEqual(["bruxa", "orfa"]);
  });
});

describe("V7: aceitar um pedido", () => {
  const ativas = new Set(["jogador-1"]);

  it("Nenhuma: usuário novo com o id seguinte", () => {
    const e = campanha();
    expect(planejarAceite(e, ativas, undefined, proximoIdDeJogador(e.usuarios))).toEqual({
      tipo: "nova",
      usuarioId: "jogador-5",
      criar: true,
    });
  });

  it("ficha de uma vaga escondida: a conta fica ligada àquela vaga", () => {
    const e = campanha();
    expect(planejarAceite(e, ativas, "bruxa", "jogador-5")).toEqual({
      tipo: "vaga-existente",
      usuarioId: "jogador-2",
    });
  });

  it("ficha sem dono: usuário novo, dono da ficha", () => {
    const e = campanha();
    expect(planejarAceite(e, ativas, "orfa", "jogador-5")).toEqual({
      tipo: "nova",
      usuarioId: "jogador-5",
      criar: true,
      fichaId: "orfa",
    });
  });

  it("ficha de um membro, ficha de todos, NPC ou ficha que não existe: recusa", () => {
    const e = campanha();
    for (const f of ["uker", "grupo", "npc", "nada"]) {
      expect(planejarAceite(e, ativas, f, "jogador-5")).toEqual({
        tipo: "erro",
        erro: "vaga_invalida",
      });
    }
  });

  it("limite cheio: reaproveita uma vaga escondida que não é dona de nada (a 2 é dona de ficha, a 3 não)", () => {
    const e = campanha();
    expect(planejarAceite(e, ativas, undefined, "jogador-5", 4)).toEqual({
      tipo: "nova",
      usuarioId: "jogador-3",
      criar: false,
    });
  });

  it("limite cheio e todas as escondidas com dono: recusa", () => {
    const e = campanha({
      tokens: [{ controladoPor: ["jogador-3"] }, { controladoPor: ["jogador-4"] }] as never,
    });
    expect(planejarAceite(e, ativas, undefined, "jogador-5", 4)).toEqual({
      tipo: "erro",
      erro: "vaga_invalida",
    });
  });
});
