import { ecoDe, nomeDaSala } from "@tabletop/shared";
import { describe, expect, it } from "vitest";

describe("lógica pura usada pela sala", () => {
  it("o eco devolve exatamente o que recebeu", () => {
    expect(ecoDe("ping")).toBe("ping");
  });

  it("a sala única se chama campanha", () => {
    expect(nomeDaSala()).toBe("campanha");
  });
});
