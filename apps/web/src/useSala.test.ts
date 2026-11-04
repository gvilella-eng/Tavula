import { describe, expect, it } from "vitest";
import type { StatusConexao } from "./useSala";

describe("web", () => {
  it("conhece os estados da conexão", () => {
    const estados: StatusConexao[] = ["conectando", "conectado", "desconectado"];
    expect(estados).toContain("conectado");
  });
});
