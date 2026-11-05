import { describe, expect, it } from "vitest";
import semente from "../../../fixtures/campanha.seed.json";
import { estadoInicial } from "./index.ts";

describe("semente da campanha", () => {
  it("a semente real traz personagens ligados aos tokens, o NPC e uma segunda cena", () => {
    const e = estadoInicial(semente);
    expect(e.personagens.map((p) => p.nome)).toEqual(["Aldric", "Brisa", "Cael", "Ogro"]);
    expect(e.personagens.find((p) => p.nome === "Ogro")?.donoId).toBeNull();
    expect(e.cenas.map((c) => c.nome)).toEqual(["Cena inicial", "Covil"]);
    expect(e.tokens.filter((t) => t.cenaId === "cena-covil").length).toBeGreaterThanOrEqual(1);
    for (const t of e.tokens.filter((x) => x.personagemId !== undefined)) {
      expect(e.personagens.some((p) => p.id === t.personagemId)).toBe(true);
    }
  });

  it("uma semente sem personagens continua valendo (banco e campanhas antigas)", () => {
    const e = estadoInicial({ usuarios: [{ id: "m", nome: "M", papel: "mestre", cor: "#1" }] });
    expect(e.personagens).toEqual([]);
  });
});
