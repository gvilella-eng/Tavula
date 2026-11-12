import { describe, expect, it } from "vitest";
import { PASSOS_DO_JOGADOR, PASSOS_DO_MESTRE, textoDoPasso } from "./passos";

describe("passos do tour", () => {
  it("o mestre tem cerca de 10 passos e o jogador cerca de 6", () => {
    expect(PASSOS_DO_MESTRE.length).toBe(10);
    expect(PASSOS_DO_JOGADOR.length).toBe(6);
  });

  for (const [papel, passos] of [
    ["mestre", PASSOS_DO_MESTRE],
    ["jogador", PASSOS_DO_JOGADOR],
  ] as const) {
    it(`${papel}: cada passo tem título, texto de 1 a 2 frases e ids únicos`, () => {
      expect(new Set(passos.map((p) => p.id)).size).toBe(passos.length);
      for (const p of passos) {
        expect(p.titulo.trim()).not.toBe("");
        const texto = textoDoPasso(p);
        expect(texto, `texto de ${p.id}`).not.toBe("");
        const frases = texto.split(/[.!?](?:\s|$)/).filter((f) => f.trim() !== "");
        expect(frases.length, `frases de ${p.id}: ${texto}`).toBeLessThanOrEqual(2);
      }
    });
  }
});
