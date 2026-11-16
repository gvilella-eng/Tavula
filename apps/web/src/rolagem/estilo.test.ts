import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHAVE_ESTILO_DAS_ROLAGENS,
  definirEstiloDasRolagens,
  estiloDasRolagensAtual,
  lerEstiloDasRolagens,
} from "./estilo";

describe("estilo das rolagens no chat (Q5)", () => {
  const guardado = new Map<string, string>();
  beforeEach(() => {
    guardado.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("a Fita é o padrão; a escolha fica em tabletop:pref:estiloDasRolagens", () => {
    expect(CHAVE_ESTILO_DAS_ROLAGENS).toBe("tabletop:pref:estiloDasRolagens");
    expect(lerEstiloDasRolagens()).toBe("fita");
    definirEstiloDasRolagens("moldura");
    expect(estiloDasRolagensAtual()).toBe("moldura");
    expect(guardado.get(CHAVE_ESTILO_DAS_ROLAGENS)).toBe("moldura");
    expect(lerEstiloDasRolagens()).toBe("moldura");
    definirEstiloDasRolagens("fita");
    expect(lerEstiloDasRolagens()).toBe("fita");
  });

  it("valor estragado vira o padrão, e sem localStorage não quebra", () => {
    guardado.set(CHAVE_ESTILO_DAS_ROLAGENS, "xis");
    expect(lerEstiloDasRolagens()).toBe("fita");
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(lerEstiloDasRolagens()).toBe("fita");
    expect(() => definirEstiloDasRolagens("moldura")).not.toThrow();
  });
});
