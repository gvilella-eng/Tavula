import { describe, expect, it } from "vitest";
import {
  COOKIE_DE_TESTE,
  cookieDeSessao,
  cookieDeTeste,
  cookiesDeSaida,
  lerCookie,
} from "./autenticacao";

describe("cookies da mesa", () => {
  it("lê o valor de um cookie; sem cookie, vazio ou quebrado → null", () => {
    expect(lerCookie("a=1; tavola_sessao=abc; b=2", "tavola_sessao")).toBe("abc");
    expect(lerCookie(null, "tavola_sessao")).toBeNull();
    expect(lerCookie("tavola_sessao=", "tavola_sessao")).toBeNull();
    expect(lerCookie("tavola_sessao=%E0%A4%A", "tavola_sessao")).toBeNull();
    expect(lerCookie("outro=1", "tavola_sessao")).toBeNull();
    // o cookie de teste e o antigo têm outros nomes: um não é confundido com o outro
    expect(lerCookie("tabletop_sessao=mestre", "tavola_sessao")).toBeNull();
  });

  it("a sessão é HttpOnly, SameSite=Lax, vale só para a mesa e dura 30 dias", () => {
    const c = cookieDeSessao("tokenAleatorio", "k7m2-qx9p-4tdn", false);
    expect(c).toContain("tavola_sessao=tokenAleatorio;");
    expect(c).toContain("Path=/api/m/k7m2-qx9p-4tdn;");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain(`Max-Age=${30 * 24 * 3600}`);
    expect(c).not.toContain("Secure");
  });

  it("Secure quando a requisição veio por https", () => {
    expect(cookieDeSessao("t", "k7m2-qx9p-4tdn", true)).toContain("; Secure");
    for (const s of cookiesDeSaida("k7m2-qx9p-4tdn", true)) expect(s).toContain("; Secure");
  });

  it("o login solto de teste leva o usuário e o id da mesa no Path", () => {
    const c = cookieDeTeste("mestre", "k7m2-qx9p-4tdn");
    expect(c).toContain(`${COOKIE_DE_TESTE}=mestre;`);
    expect(c).toContain("Path=/api/m/k7m2-qx9p-4tdn;");
    expect(c).toContain("HttpOnly");
  });

  it("a saída apaga a sessão, o login de teste da mesa e o cookie antigo", () => {
    const saida = cookiesDeSaida("k7m2-qx9p-4tdn", false);
    expect(saida).toHaveLength(3);
    expect(saida[0]).toContain("tavola_sessao=;");
    expect(saida[0]).toContain("Path=/api/m/k7m2-qx9p-4tdn;");
    expect(saida[0]).toContain("Max-Age=0");
    expect(saida[1]).toContain("tabletop_sessao=;");
    expect(saida[2]).toContain("tabletop_usuario=;");
    expect(saida[2]).toContain("Path=/;");
  });
});
