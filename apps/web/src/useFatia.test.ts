import { type Estado, estadoInicial } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { fatiaEstavel } from "./useFatia";

const base = (): Estado =>
  estadoInicial({ usuarios: [{ id: "m", nome: "Mestre", papel: "mestre", cor: "#fff" }] }, 0);
const CHAVES = ["chat", "usuarios"] as const;

describe("fatiaEstavel", () => {
  it("devolve null com o estado null", () => {
    expect(fatiaEstavel(null, null, CHAVES)).toBeNull();
    expect(fatiaEstavel({ usuarios: [] }, null, CHAVES)).toBeNull();
  });

  it("monta um objeto só com as chaves pedidas", () => {
    const e = base();
    const f = fatiaEstavel(null, e, CHAVES);
    expect(f).not.toBeNull();
    expect(Object.keys(f ?? {})).toEqual(["usuarios"]);
    expect(f?.usuarios).toBe(e.usuarios);
  });

  it("mantém a identidade quando só muda uma chave de fora", () => {
    const e = base();
    const f1 = fatiaEstavel(null, e, CHAVES);
    const e2: Estado = { ...e, seq: e.seq + 1, tokens: [...e.tokens] };
    expect(fatiaEstavel(f1, e2, CHAVES)).toBe(f1);
  });

  it("devolve um objeto novo quando muda uma chave de dentro", () => {
    const e = base();
    const f1 = fatiaEstavel(null, e, CHAVES);
    const e2: Estado = { ...e, chat: [] };
    const f2 = fatiaEstavel(f1, e2, CHAVES);
    expect(f2).not.toBe(f1);
    expect(f2?.chat).toBe(e2.chat);
    expect(f2?.usuarios).toBe(e.usuarios);
    // e volta a ser estável enquanto nada de dentro muda
    expect(fatiaEstavel(f2, { ...e2, seq: 9 }, CHAVES)).toBe(f2);
  });

  it("chave opcional ausente nos dois lados é igual, e aparecer ou sumir é mudança", () => {
    const e = base();
    expect(e.chat).toBeUndefined();
    const f1 = fatiaEstavel(null, e, CHAVES);
    expect("chat" in (f1 ?? {})).toBe(false);
    expect(fatiaEstavel(f1, { ...e, seq: 2 }, CHAVES)).toBe(f1);
    const f2 = fatiaEstavel(f1, { ...e, chat: [] }, CHAVES);
    expect(f2).not.toBe(f1);
    const { chat: _chat, ...semChat } = { ...e, chat: [] };
    expect(fatiaEstavel(f2, semChat, CHAVES)).not.toBe(f2);
  });
});
