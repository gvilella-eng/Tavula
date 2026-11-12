import { describe, expect, it } from "vitest";
import { AutenticacaoDev, lerCookie } from "./autenticacao";

describe("AutenticacaoDev", () => {
  const auth = new AutenticacaoDev();
  const pedido = (cookie?: string) =>
    new Request("http://x/ws", cookie ? { headers: { Cookie: cookie } } : {});

  it("lê o usuário do cookie", () => {
    expect(auth.identificar(pedido("a=1; tabletop_sessao=jogador-3; b=2"))).toBe("jogador-3");
  });

  it("sem cookie, com cookie vazio ou quebrado, ou só com o cookie antigo (Path=/) → null", () => {
    expect(auth.identificar(pedido())).toBeNull();
    expect(auth.identificar(pedido("tabletop_sessao="))).toBeNull();
    expect(auth.identificar(pedido("tabletop_sessao=%E0%A4%A"))).toBeNull();
    expect(auth.identificar(pedido("tabletop_usuario=mestre"))).toBeNull();
    expect(lerCookie("outro=1", "tabletop_sessao")).toBeNull();
  });

  it("o cookie vale só para a mesa: o Path leva o id", () => {
    const entrada = auth.cabecalhoDeEntrada("mestre", "k7m2-qx9p-4tdn");
    expect(entrada).toContain("tabletop_sessao=mestre;");
    expect(entrada).toContain("Path=/api/m/k7m2-qx9p-4tdn;");
    expect(entrada).toContain("HttpOnly");
  });

  it("a saída apaga o cookie da mesa e o cookie antigo", () => {
    const saida = auth.cabecalhosDeSaida("k7m2-qx9p-4tdn");
    expect(saida).toHaveLength(2);
    expect(saida[0]).toContain("Path=/api/m/k7m2-qx9p-4tdn;");
    expect(saida[0]).toContain("Max-Age=0");
    expect(saida[1]).toContain("tabletop_usuario=;");
    expect(saida[1]).toContain("Path=/;");
  });
});
