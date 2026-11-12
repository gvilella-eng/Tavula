import { describe, expect, it } from "vitest";
import {
  assinarMensagem,
  ChavePublicaSchema,
  chavePublicaValida,
  gerarCodigoDeRecuperacao,
  gerarParDeChaves,
  lerArquivoDaChave,
  mensagemParaAssinar,
  montarArquivoDaChave,
  normalizarCodigoDeRecuperacao,
  publicaDe,
  TAMANHO_DO_CODIGO,
  verificarAssinatura,
} from "./recuperacao.ts";

describe("código de recuperação", () => {
  it("20 caracteres do alfabeto dos ids, em 5 grupos de 4", () => {
    const c = gerarCodigoDeRecuperacao();
    expect(c).toMatch(
      /^([abcdefghjkmnpqrstuvwxyz23456789]{4}-){4}[abcdefghjkmnpqrstuvwxyz23456789]{4}$/,
    );
    expect(c.replaceAll("-", "")).toHaveLength(TAMANHO_DO_CODIGO);
    expect(gerarCodigoDeRecuperacao()).not.toBe(c);
  });

  it("descarta bytes que dariam viés (>= 248)", () => {
    const fonte = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 255 : 0));
    // só os bytes 0 entram: tudo "a"
    expect(gerarCodigoDeRecuperacao(fonte)).toBe("aaaa-aaaa-aaaa-aaaa-aaaa");
  });

  it("normaliza maiúsculas, espaços e hífens; recusa o que não é código", () => {
    const c = "k7m2-qx9p-4tdn-h8wc-s5ab";
    expect(normalizarCodigoDeRecuperacao("  K7M2 QX9P 4TDN H8WC S5AB ")).toBe(c);
    expect(normalizarCodigoDeRecuperacao("k7m2qx9p4tdnh8wcs5ab")).toBe(c);
    expect(normalizarCodigoDeRecuperacao("k7m2-qx9p-4tdn")).toBeNull();
    expect(normalizarCodigoDeRecuperacao("k7m2-qx9p-4tdn-h8wc-s5a0")).toBeNull();
    expect(normalizarCodigoDeRecuperacao(42)).toBeNull();
  });
});

describe("chave da pasta (ECDSA P-256)", () => {
  it("assina e verifica; mensagem alterada, outra chave e assinatura torta não passam", async () => {
    const par = await gerarParDeChaves();
    const outra = await gerarParDeChaves();
    const msg = mensagemParaAssinar("k7m2-qx9p-4tdn", "n".repeat(43));
    const assinatura = await assinarMensagem(par.privada, msg);
    expect(assinatura).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(await verificarAssinatura(par.publica, msg, assinatura)).toBe(true);
    expect(await verificarAssinatura(par.publica, `${msg}x`, assinatura)).toBe(false);
    expect(
      await verificarAssinatura(
        par.publica,
        mensagemParaAssinar("outr-amesa-aaaa", "n".repeat(43)),
        assinatura,
      ),
    ).toBe(false);
    expect(await verificarAssinatura(outra.publica, msg, assinatura)).toBe(false);
    expect(await verificarAssinatura(par.publica, msg, "abc")).toBe(false);
    expect(await verificarAssinatura(par.publica, msg, "A".repeat(86))).toBe(false);
  });

  it("a pública não leva a privada; chave com `d` ou fora da curva é recusada", async () => {
    const par = await gerarParDeChaves();
    expect(Object.keys(par.publica).sort()).toEqual(["crv", "kty", "x", "y"]);
    expect(publicaDe(par.privada)).toEqual(par.publica);
    expect(ChavePublicaSchema.safeParse({ ...par.publica, d: par.privada.d }).success).toBe(false);
    expect(await chavePublicaValida(par.publica)).toBe(true);
    expect(await chavePublicaValida({ ...par.publica, y: par.publica.x })).toBe(false);
    expect(await chavePublicaValida({ kty: "RSA" })).toBe(false);
  });

  it("o arquivo da pasta vai e volta, com o aviso; lixo não é lido", async () => {
    const par = await gerarParDeChaves();
    const texto = montarArquivoDaChave({
      mesaId: "k7m2-qx9p-4tdn",
      nomeDaMesa: "Campanha",
      chavePrivada: par.privada,
    });
    expect(texto).toContain("prova de que você é o mestre");
    const lido = lerArquivoDaChave(texto);
    expect(lido?.mesaId).toBe("k7m2-qx9p-4tdn");
    expect(lido?.chavePrivada).toEqual(par.privada);
    expect(lerArquivoDaChave("{}")).toBeNull();
    expect(lerArquivoDaChave("não é json")).toBeNull();
  });
});
