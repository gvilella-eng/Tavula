import { describe, expect, it } from "vitest";
import { nomeDaSala, PORTA_SALA, PORTA_SALA_E2E, PORTA_WEB, PORTA_WEB_E2E } from "./index.ts";

describe("constantes", () => {
  it("usa portas fixas e distintas; o E2E tem as dele", () => {
    expect(new Set([PORTA_SALA, PORTA_WEB, PORTA_SALA_E2E, PORTA_WEB_E2E]).size).toBe(4);
  });

  it("tem uma única sala por campanha", () => {
    expect(nomeDaSala()).toBe("campanha");
  });
});
