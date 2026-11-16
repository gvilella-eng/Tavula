import type { Mensagem } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { continuaORemetente, ehCartaoDeRolagem } from "./agrupar";

const rolagem = {
  expressao: "1d20",
  termos: [
    {
      tipo: "dados" as const,
      sinal: 1 as const,
      quantidade: 1,
      faces: 20,
      dados: [{ valor: 5 }],
      subtotal: 5,
    },
  ],
  total: 5,
};

function msg(extra: Partial<Mensagem>): Mensagem {
  return {
    id: "m",
    seq: 1,
    emReal: 1_000_000,
    autorId: "u1",
    tipo: "rolagem",
    rolagens: [rolagem],
    visivelPara: "todos",
    ...extra,
  };
}

describe("cartões seguidos do mesmo remetente (Q5)", () => {
  it("só rolagem solta e modelo são cartões; texto e [[...]] não", () => {
    expect(ehCartaoDeRolagem(msg({}))).toBe(true);
    expect(ehCartaoDeRolagem(msg({ inline: true }))).toBe(false);
    expect(ehCartaoDeRolagem(msg({ tipo: "texto", rolagens: undefined }))).toBe(false);
  });

  it("dois cartões do mesmo autor, juntos, dividem o cabeçalho", () => {
    expect(continuaORemetente(msg({}), msg({ emReal: 1_030_000 }))).toBe(true);
  });

  it("outro autor, outro personagem, muito tempo depois ou texto no meio: cabeçalho novo", () => {
    expect(continuaORemetente(msg({}), msg({ autorId: "u2" }))).toBe(false);
    expect(
      continuaORemetente(
        msg({ como: { personagemId: "a", nome: "A" } }),
        msg({ como: { personagemId: "b", nome: "B" } }),
      ),
    ).toBe(false);
    expect(continuaORemetente(msg({}), msg({ emReal: 1_000_000 + 200_000 }))).toBe(false);
    expect(continuaORemetente(msg({ tipo: "texto", rolagens: undefined }), msg({}))).toBe(false);
    expect(continuaORemetente(undefined, msg({}))).toBe(false);
    expect(continuaORemetente(msg({ oculta: true }), msg({}))).toBe(false);
  });
});
