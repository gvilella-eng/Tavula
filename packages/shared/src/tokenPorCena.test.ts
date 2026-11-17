import { describe, expect, it } from "vitest";
import {
  CENA_PADRAO,
  cenaDoObjeto,
  type Estado,
  estadoInicial,
  type Intencao,
  IntencaoSchema,
  type Personagem,
  processar,
  type Token,
  tokenDoPersonagemPreferindo,
} from "./index.ts";

// Q8: cada cena tem o seu token do personagem; levar o grupo não duplica.

const AGORA = "2026-01-01T00:00:00.000Z";

function personagem(id: string, donoId: string | null): Personagem {
  return {
    id,
    pastaId: donoId === null ? "pasta-npcs" : "pasta-personagens",
    editores: { tipo: "jogadores", ids: donoId === null ? [] : [donoId] },
    nome: `Pers ${id}`,
    tokenPadrao: { cor: "#123456", tamanhoQuadrados: 1 },
    visao: { alcanceM: 9, visaoNoEscuroM: 6 },
    ficha: { pvAtual: 10, pvMax: 12 },
  };
}

function token(id: string, cenaId: string, personagemId: string, x = 5, y = 5): Token {
  return {
    id,
    cenaId,
    nome: id,
    cor: "#abc",
    tamanhoQuadrados: 1,
    x,
    y,
    camada: "tokens",
    oculto: false,
    controladoPor: [],
    personagemId,
  };
}

function criarEstado(tokens: Token[]): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
    ],
    cenas: [
      { ...CENA_PADRAO, id: "a", nome: "A" },
      { ...CENA_PADRAO, id: "b", nome: "B", chegada: { x: 10, y: 10 } },
    ],
    cenaAtivaId: "a",
    personagens: [personagem("p1", "j1"), personagem("p2", "j1"), personagem("npc", null)],
    tokens,
  });
}

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `q${++contador}`, tipo, dados });
}
function aplicar(estado: Estado, quem: string, i: Intencao) {
  const r = processar(estado, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} ${r.erro.mensagem}`);
  return r;
}
function codigo(estado: Estado, quem: string, i: Intencao): string | null {
  const r = processar(estado, quem, i, AGORA);
  return r.ok ? null : r.erro.codigo;
}
const doPersonagem = (e: Estado, id: string, cenaId: string) =>
  e.tokens.filter((t) => t.personagemId === id && t.cenaId === cenaId);

describe("personagem.colocar (Q8)", () => {
  it("aceita o personagem de jogador com token em outra cena e recusa o segundo na mesma cena", () => {
    const e = criarEstado([token("t-a", "a", "p1")]);
    const colocar = (cenaId: string, tokenId: string) =>
      intencao("personagem.colocar", { personagemId: "p1", cenaId, tokenId });
    const r = aplicar(e, "m", colocar("b", "t-b"));
    expect(doPersonagem(r.estado, "p1", "b")).toHaveLength(1);
    expect(doPersonagem(r.estado, "p1", "a")).toHaveLength(1);
    expect(codigo(r.estado, "m", colocar("b", "t-b2"))).toBe("dados_invalidos");
    expect(codigo(r.estado, "m", colocar("a", "t-a2"))).toBe("dados_invalidos");
  });
});

describe("grupo.moverPara (Q8)", () => {
  it("quem já tem token no destino fica com o de lá; o da origem fica na origem", () => {
    const e = criarEstado([
      token("t-a1", "a", "p1"),
      token("t-b1", "b", "p1", 20, 20),
      token("t-a2", "a", "p2"),
    ]);
    const r = aplicar(e, "m", intencao("grupo.moverPara", { cenaId: "b" }));
    expect(r.estado.cenaAtivaId).toBe("b");
    // p1 não duplica na B e o token dele na A não saiu
    expect(doPersonagem(r.estado, "p1", "b").map((t) => t.id)).toEqual(["t-b1"]);
    expect(doPersonagem(r.estado, "p1", "a").map((t) => t.id)).toEqual(["t-a1"]);
    // o token do destino não foi mexido
    expect(r.estado.tokens.find((t) => t.id === "t-b1")).toMatchObject({ x: 20, y: 20 });
    // p2 (sem token na B) vai junto
    expect(doPersonagem(r.estado, "p2", "b").map((t) => t.id)).toEqual(["t-a2"]);
  });

  it("levar de volta com token nas duas cenas não duplica nada", () => {
    const e = criarEstado([token("t-a1", "a", "p1"), token("t-b1", "b", "p1")]);
    const ida = aplicar(e, "m", intencao("grupo.moverPara", { cenaId: "b" })).estado;
    const volta = aplicar(ida, "m", intencao("grupo.moverPara", { cenaId: "a" })).estado;
    expect(volta.tokens.filter((t) => t.personagemId === "p1")).toHaveLength(2);
    expect(doPersonagem(volta, "p1", "a")).toHaveLength(1);
    expect(doPersonagem(volta, "p1", "b")).toHaveLength(1);
  });
});

describe("buscas do token do personagem (Q8)", () => {
  it("tokenDoPersonagemPreferindo prefere a cena dada e cai em qualquer outra", () => {
    const tokens = [token("t-a", "a", "p1"), token("t-b", "b", "p1")];
    expect(tokenDoPersonagemPreferindo(tokens, "p1", "b")?.id).toBe("t-b");
    expect(tokenDoPersonagemPreferindo(tokens, "p1", "a")?.id).toBe("t-a");
    expect(tokenDoPersonagemPreferindo([tokens[0] as Token], "p1", "b")?.id).toBe("t-a");
    expect(tokenDoPersonagemPreferindo(tokens, "nada", "b")).toBeUndefined();
  });

  it("a luz na mão está na cena ativa quando o dono tem token nas duas", () => {
    const tokens = [token("t-a", "a", "p1"), token("t-b", "b", "p1")];
    const luz = { cenaId: undefined, portador: { tipo: "mao", personagemId: "p1" } } as never;
    expect(cenaDoObjeto(luz, { tokens, pontos: [], cenaAtivaId: "b" })).toBe("b");
    expect(cenaDoObjeto(luz, { tokens, pontos: [], cenaAtivaId: "a" })).toBe("a");
  });
});
