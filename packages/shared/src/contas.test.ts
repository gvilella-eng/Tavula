import { describe, expect, it } from "vitest";
import {
  base64UrlParaBytes,
  bloqueioDoIp,
  bytesParaBase64Url,
  CorpoEntrarSchema,
  derivarSenha,
  ESPERAS_DA_CONTA_MIN,
  erroDaSenha,
  ITERACOES_PBKDF2,
  loginValido,
  mensagemDeErroDeConta,
  minutosAte,
  nomeDeExibicaoValido,
  normalizarLogin,
  registrarFalhaDaConta,
  SESSAO_VALE_MS,
  salDaDerivacao,
  sessaoPrecisaRenovar,
  sessaoValida,
} from "./contas.ts";

const MIN = 60_000;

describe("derivação da senha no navegador", () => {
  it("o sal leva o id da mesa e o login normalizado", () => {
    expect(salDaDerivacao("k7m2-qx9p-4tdn", "  Vilella ")).toBe("tavola:k7m2-qx9p-4tdn:vilella");
  });

  it("PBKDF2-SHA256 de 600.000 iterações: vetor fixo (calculado à parte com o crypto do Node)", async () => {
    expect(ITERACOES_PBKDF2).toBe(600_000);
    // o login em maiúsculas e com espaços dá a mesma derivada: o sal usa o login normalizado
    const d = await derivarSenha("senha-do-mestre", "k7m2-qx9p-4tdn", " VILELLA ");
    expect(d).toBe("FmYUBGmoeaetIXXgaF8lwLPBruYcDQbpjioPoSlge0U");
    expect(base64UrlParaBytes(d)?.length).toBe(32);
  });

  it("com poucas iterações (vetor rápido) e o sal muda a derivada", async () => {
    expect(await derivarSenha("abc12", "k7m2-qx9p-4tdn", "ana", 1000)).toBe(
      "pPjOoLQ2IsR0DWT0sNie0O6jBxJ3-_YYR39tGGpj5V4",
    );
    expect(await derivarSenha("abc12", "aaaa-bbbb-cccc", "ana", 1000)).not.toBe(
      "pPjOoLQ2IsR0DWT0sNie0O6jBxJ3-_YYR39tGGpj5V4",
    );
  });

  it("base64url ida e volta, sem preenchimento", () => {
    const bytes = Uint8Array.from([0, 250, 251, 252, 253, 254, 255]);
    const t = bytesParaBase64Url(bytes);
    expect(t).not.toMatch(/[+/=]/);
    expect(Array.from(base64UrlParaBytes(t) ?? [])).toEqual(Array.from(bytes));
    expect(base64UrlParaBytes("a")).toBeNull();
    expect(base64UrlParaBytes("a+b")).toBeNull();
  });
});

describe("validação do que a pessoa digita", () => {
  it("login: 3 a 32, letras, dígitos, ponto, hífen e sublinhado; vale em minúsculas", () => {
    expect(normalizarLogin("  AnA ")).toBe("ana");
    expect(loginValido(" Ana.Souza ")).toBe("ana.souza");
    expect(loginValido("ab")).toBeNull();
    expect(loginValido("a".repeat(33))).toBeNull();
    expect(loginValido("a".repeat(32))).toBe("a".repeat(32));
    expect(loginValido("com espaço")).toBeNull();
    expect(loginValido("açúcar")).toBeNull();
    expect(loginValido("a_b-c.d9")).toBe("a_b-c.d9");
    expect(loginValido(5)).toBeNull();
  });

  it("nome de exibição: 1 a 40, espaços e controles limpos", () => {
    expect(nomeDeExibicaoValido("  Ana   Souza ")).toBe("Ana Souza");
    expect(nomeDeExibicaoValido("")).toBeNull();
    expect(nomeDeExibicaoValido("   ")).toBeNull();
    expect(nomeDeExibicaoValido("x".repeat(41))).toBeNull();
    expect(nomeDeExibicaoValido("x".repeat(40))).toBe("x".repeat(40));
    expect(nomeDeExibicaoValido("a\u0000b")).toBe("a b");
  });

  it("senha: mais de 4 caracteres e no máximo 128", () => {
    expect(erroDaSenha("1234")).toMatch(/pelo menos 5/);
    expect(erroDaSenha("12345")).toBeNull();
    expect(erroDaSenha("x".repeat(128))).toBeNull();
    expect(erroDaSenha("x".repeat(129))).toMatch(/no máximo 128/);
  });

  it("o corpo de entrar só aceita derivada de 32 bytes em base64url", () => {
    const boa = "pPjOoLQ2IsR0DWT0sNie0O6jBxJ3-_YYR39tGGpj5V4";
    expect(CorpoEntrarSchema.safeParse({ login: "ana", derivada: boa }).success).toBe(true);
    expect(CorpoEntrarSchema.safeParse({ login: "ana", derivada: "senha123" }).success).toBe(false);
    expect(CorpoEntrarSchema.safeParse({ login: "a", derivada: boa }).success).toBe(false);
    expect(CorpoEntrarSchema.safeParse({ login: "ana" }).success).toBe(false);
  });
});

describe("limite de tentativas", () => {
  it("5 falhas seguidas bloqueiam a conta por 1, 5, 15 e 60 minutos (e fica em 60)", () => {
    let e = { falhas: 0, bloqueios: 0 };
    const esperas: number[] = [];
    for (let rodada = 0; rodada < 6; rodada++) {
      for (let i = 0; i < 4; i++) {
        const r = registrarFalhaDaConta(e, 1_000);
        expect(r.bloqueadaAte).toBe(0);
        e = r;
      }
      const r = registrarFalhaDaConta(e, 1_000);
      esperas.push((r.bloqueadaAte - 1_000) / MIN);
      e = r;
      expect(e.falhas).toBe(0);
    }
    expect(esperas).toEqual([...ESPERAS_DA_CONTA_MIN, 60, 60]);
  });

  it("minutos de espera arredondam para cima e nunca dão zero", () => {
    expect(minutosAte(1_000 + 90_000, 1_000)).toBe(2);
    expect(minutosAte(1_000 + 60_000, 1_000)).toBe(1);
    expect(minutosAte(1_000, 1_000)).toBe(1);
  });

  it("IP: 30 falhas em 15 minutos bloqueiam o IP por 15 minutos", () => {
    const agora = 100 * MIN;
    const falhas = Array.from({ length: 29 }, (_, i) => agora - i * 1000);
    expect(bloqueioDoIp(falhas, agora)).toBe(0);
    const com30 = [...falhas, agora - 29 * 1000];
    // a 30ª mais recente é a de agora-29s; o bloqueio dura 15 min a partir dela
    expect(bloqueioDoIp(com30, agora)).toBe(agora - 29_000 + 15 * MIN);
    // 16 minutos depois, nenhuma está na janela
    expect(bloqueioDoIp(com30, agora + 16 * MIN)).toBe(0);
    // falhas fora da janela não contam
    const antigas = Array.from({ length: 40 }, () => agora - 20 * MIN);
    expect(bloqueioDoIp(antigas, agora)).toBe(0);
  });
});

describe("sessão", () => {
  it("expira em 30 dias e renova com o uso depois de uma hora", () => {
    expect(SESSAO_VALE_MS).toBe(30 * 24 * 60 * MIN);
    expect(sessaoValida(1_000, 999)).toBe(true);
    expect(sessaoValida(1_000, 1_000)).toBe(false);
    expect(sessaoPrecisaRenovar(0, 59 * MIN)).toBe(false);
    expect(sessaoPrecisaRenovar(0, 60 * MIN)).toBe(true);
  });
});

describe("mensagens de erro de conta", () => {
  it("login inexistente e senha errada dizem o mesmo; a espera é dita", () => {
    expect(mensagemDeErroDeConta("credenciais")).toBe("Login ou senha incorretos.");
    expect(mensagemDeErroDeConta("bloqueada", 5)).toBe(
      "Muitas tentativas. Tente de novo em 5 minutos.",
    );
    expect(mensagemDeErroDeConta("bloqueada", 1)).toContain("1 minuto.");
    expect(mensagemDeErroDeConta("pedido_pendente")).toBe("Seu pedido ainda não foi aceito.");
    expect(mensagemDeErroDeConta("pedido_recusado")).toBe("Seu pedido foi recusado.");
  });
});
