import { describe, expect, it } from "vitest";
import { ecoDe, nomeDaSala, PORTA_SALA, PORTA_WEB } from "./index.ts";

describe("shared", () => {
  it("usa portas fixas e distintas", () => {
    expect(PORTA_SALA).toBe(8787);
    expect(PORTA_WEB).toBe(5173);
  });

  it("tem uma única sala por campanha", () => {
    expect(nomeDaSala()).toBe("campanha");
  });

  it("devolve o texto recebido como eco", () => {
    expect(ecoDe("olá, mesa")).toBe("olá, mesa");
  });
});
