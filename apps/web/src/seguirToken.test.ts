import type { Personagem, Token } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import {
  aoLigarOSeguir,
  candidatosParaSeguir,
  escolherSeguido,
  lerSeguir,
  type PrefDoSeguir,
  SEGUIR_DESLIGADO,
} from "./seguirToken";

function token(id: string, extra: Partial<Token> = {}): Token {
  return {
    id,
    cenaId: "c1",
    nome: id,
    cor: "#fff",
    tamanhoQuadrados: 1,
    x: 1,
    y: 1,
    camada: "tokens",
    oculto: false,
    controladoPor: [],
    ...extra,
  } as Token;
}

const personagens = [
  { id: "pa", donoId: "j1", editores: { tipo: "jogadores", ids: [] } },
  { id: "pb", donoId: "j2", editores: { tipo: "jogadores", ids: [] } },
] as unknown as Personagem[];

const jogador = { id: "j1", papel: "jogador" as const };
const mestre = { id: "m", papel: "mestre" as const };

describe("candidatosParaSeguir", () => {
  const tokens = [
    token("t1", { controladoPor: ["j1"] }),
    token("t2", { controladoPor: ["j1"], cenaId: "c2" }),
    token("t3", { controladoPor: ["j2"] }),
    token("t4", { controladoPor: ["j1"], camada: "mestre" }),
  ];
  it("o jogador só vê os que controla, na cena e na camada dos tokens", () => {
    expect(candidatosParaSeguir(tokens, "c1", jogador, personagens).map((t) => t.id)).toEqual([
      "t1",
    ]);
  });
  it("o mestre vê todos da camada dos tokens da cena", () => {
    expect(candidatosParaSeguir(tokens, "c1", mestre, personagens).map((t) => t.id)).toEqual([
      "t1",
      "t3",
    ]);
  });
  it("sem cena ou sem usuário, nada", () => {
    expect(candidatosParaSeguir(tokens, undefined, jogador, personagens)).toEqual([]);
    expect(candidatosParaSeguir(tokens, "c1", null, personagens)).toEqual([]);
  });
});

describe("escolherSeguido", () => {
  const a = token("a", { personagemId: "pa" });
  const b = token("b", { personagemId: "pb" });
  it("acha o token escolhido", () => {
    expect(escolherSeguido([a, b], { ligado: true, personagemId: "pb", tokenId: "b" })?.id).toBe(
      "b",
    );
  });
  it("na cena nova segue o token do mesmo personagem", () => {
    const novo = token("a2", { personagemId: "pa", cenaId: "c2" });
    expect(escolherSeguido([novo], { ligado: true, personagemId: "pa", tokenId: "a" })?.id).toBe(
      "a2",
    );
  });
  it("sem o token na cena, espera (null)", () => {
    expect(escolherSeguido([b], { ligado: true, personagemId: "pa", tokenId: "a" })).toBeNull();
    expect(escolherSeguido([a], SEGUIR_DESLIGADO)).toBeNull();
  });
  it("token sem personagem só vale pelo id", () => {
    const npc = token("n");
    expect(escolherSeguido([npc], { ligado: true, personagemId: null, tokenId: "n" })?.id).toBe(
      "n",
    );
    expect(
      escolherSeguido([token("n2")], { ligado: true, personagemId: null, tokenId: "n" }),
    ).toBeNull();
  });
});

describe("aoLigarOSeguir", () => {
  const a = token("a", { personagemId: "pa" });
  const b = token("b", { personagemId: "pb" });
  const nada: PrefDoSeguir = SEGUIR_DESLIGADO;
  it("um token só: segue esse, sem lista", () => {
    const r = aoLigarOSeguir([a], nada, null, false);
    expect(r.abrirLista).toBe(false);
    expect(r.pref).toMatchObject({ ligado: true, tokenId: "a", personagemId: "pa" });
  });
  it("vários e sem escolha: abre a lista e ainda não liga", () => {
    const r = aoLigarOSeguir([a, b], nada, null, false);
    expect(r.abrirLista).toBe(true);
    expect(r.pref.ligado).toBe(false);
  });
  it("vários e com escolha guardada: liga nela", () => {
    const r = aoLigarOSeguir(
      [a, b],
      { ligado: false, personagemId: "pb", tokenId: "b" },
      null,
      false,
    );
    expect(r.abrirLista).toBe(false);
    expect(r.pref).toMatchObject({ ligado: true, tokenId: "b" });
  });
  it("o mestre segue o selecionado na hora de ligar", () => {
    const r = aoLigarOSeguir(
      [a, b],
      { ligado: false, personagemId: "pa", tokenId: "a" },
      "b",
      true,
    );
    expect(r.pref).toMatchObject({ ligado: true, tokenId: "b" });
  });
  it("sem token na cena, liga e espera", () => {
    const r = aoLigarOSeguir([], nada, null, false);
    expect(r).toMatchObject({ abrirLista: false, pref: { ligado: true } });
  });
});

describe("lerSeguir", () => {
  it("sem localStorage ou com lixo, volta desligado", () => {
    expect(lerSeguir("mesa-que-nao-existe")).toEqual(SEGUIR_DESLIGADO);
  });
});
