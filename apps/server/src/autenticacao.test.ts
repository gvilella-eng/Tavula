import { describe, expect, it } from "vitest";
import { AutenticacaoDev, lerCookie } from "./autenticacao";

describe("AutenticacaoDev", () => {
  const auth = new AutenticacaoDev();
  const pedido = (cookie?: string) =>
    new Request("http://x/ws", cookie ? { headers: { Cookie: cookie } } : {});

  it("lê o usuário do cookie", () => {
    expect(auth.identificar(pedido("a=1; tabletop_usuario=jogador-3; b=2"))).toBe("jogador-3");
  });

  it("sem cookie ou com cookie vazio ou quebrado → null", () => {
    expect(auth.identificar(pedido())).toBeNull();
    expect(auth.identificar(pedido("tabletop_usuario="))).toBeNull();
    expect(auth.identificar(pedido("tabletop_usuario=%E0%A4%A"))).toBeNull();
    expect(lerCookie("outro=1", "tabletop_usuario")).toBeNull();
  });

  it("os cabeçalhos de entrada e saída usam o mesmo cookie", () => {
    expect(auth.cabecalhoDeEntrada("mestre")).toContain("tabletop_usuario=mestre;");
    expect(auth.cabecalhoDeSaida()).toContain("Max-Age=0");
  });
});
