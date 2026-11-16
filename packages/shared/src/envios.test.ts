import { describe, expect, it } from "vitest";
import {
  BYTES_DO_SEGREDO_DE_ENVIO,
  caminhoDoLinkDeEnvio,
  comandoDeEnvio,
  detectarFormato,
  FORMATO_DO_SEGREDO_DE_ENVIO,
  LIMITES_DO_ENVIO,
  limiteDoUso,
  limparNomeDoEnvio,
  motivoDoFormato,
  novoSegredoDeEnvio,
  pxDoMapa,
  usoDoArquivo,
} from "./envios.ts";

const bytes = (...v: number[]) => new Uint8Array(v);
const ascii = (s: string) => new TextEncoder().encode(s);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);

describe("M1: o formato vem dos primeiros bytes", () => {
  it("reconhece png, jpg, gif, webp, mp3, ogg, wav e json", () => {
    expect(detectarFormato(PNG)).toMatchObject({ familia: "imagem", mime: "image/png" });
    expect(detectarFormato(bytes(0xff, 0xd8, 0xff, 0xe0))).toMatchObject({ mime: "image/jpeg" });
    expect(detectarFormato(ascii("GIF89a...."))).toMatchObject({ mime: "image/gif" });
    expect(detectarFormato(ascii("RIFF\0\0\0\0WEBPVP8 "))).toMatchObject({ mime: "image/webp" });
    expect(detectarFormato(ascii("ID3\u0004\0\0"))).toMatchObject({
      familia: "som",
      mime: "audio/mpeg",
    });
    expect(detectarFormato(bytes(0xff, 0xfb, 0x90, 0x00))).toMatchObject({ familia: "som" });
    expect(detectarFormato(ascii("OggS\0\u0002"))).toMatchObject({ mime: "audio/ogg" });
    expect(detectarFormato(ascii("RIFF\0\0\0\0WAVEfmt "))).toMatchObject({ mime: "audio/wav" });
    expect(detectarFormato(ascii('  {"magias": []}'))).toMatchObject({ familia: "json" });
    expect(detectarFormato(new Uint8Array([0xef, 0xbb, 0xbf, 0x5b, 0x5d]))).toMatchObject({
      familia: "json",
    });
  });

  it("o nome e o tipo que o cliente diz não valem: texto qualquer e executável não passam", () => {
    expect(detectarFormato(ascii("MZ\u0090\0\u0003"))).toBeNull();
    expect(detectarFormato(ascii("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectarFormato(ascii("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectarFormato(new Uint8Array())).toBeNull();
  });

  it("cada uso aceita só a sua família e respeita o limite", () => {
    const png = detectarFormato(PNG);
    const mp3 = detectarFormato(ascii("ID3...."));
    expect(motivoDoFormato("mapa", png, 1000)).toBeNull();
    expect(motivoDoFormato("retrato", png, 1000)).toBeNull();
    expect(motivoDoFormato("som", mp3, 1000)).toBeNull();
    expect(motivoDoFormato("mapa", mp3, 1000)).toMatch(/um som/);
    expect(motivoDoFormato("som", png, 1000)).toMatch(/uma imagem/);
    expect(motivoDoFormato("compendio", png, 1000)).toMatch(/json/);
    expect(motivoDoFormato("mapa", null, 1000)).toMatch(/Não reconheci/);
    expect(motivoDoFormato("mapa", png, 0)).toMatch(/vazio/);
    expect(motivoDoFormato("token", png, limiteDoUso("token") + 1)).toMatch(/grande demais/);
    expect(motivoDoFormato("mapa", png, limiteDoUso("mapa"))).toBeNull();
    expect(limiteDoUso("mapa")).toBeGreaterThan(limiteDoUso("token"));
  });
});

describe("M1: o nome do arquivo é só para exibição", () => {
  it("tira a pasta (nenhum caminho do computador chega à sala), controle e excesso", () => {
    expect(limparNomeDoEnvio("C:\\Users\\mestre\\Desktop\\cripta.png")).toBe("cripta.png");
    expect(limparNomeDoEnvio("/home/mestre/mapas/cripta.png")).toBe("cripta.png");
    expect(limparNomeDoEnvio("a\u0000b\nc.png")).toBe("abc.png");
    expect(limparNomeDoEnvio("   ")).toBe("arquivo");
    expect(limparNomeDoEnvio("x".repeat(500))).toHaveLength(120);
  });
});

describe("M1: o segredo do link", () => {
  it("tem 32 bytes aleatórios, um prefixo e nunca se repete", () => {
    const a = novoSegredoDeEnvio();
    const b = novoSegredoDeEnvio();
    expect(a).toMatch(FORMATO_DO_SEGREDO_DE_ENVIO);
    expect(a).not.toBe(b);
    let pedido = 0;
    novoSegredoDeEnvio((n) => {
      pedido = n;
      return new Uint8Array(n);
    });
    expect(pedido).toBe(BYTES_DO_SEGREDO_DE_ENVIO);
  });

  it("o link e o comando levam o caminho da mesa e não o caminho do computador", () => {
    const link = `http://127.0.0.1:5173${caminhoDoLinkDeEnvio("mesa-1", "tve_x")}`;
    expect(link).toBe("http://127.0.0.1:5173/api/m/mesa-1/claude/envio/tve_x");
    expect(comandoDeEnvio(link)).toBe(`curl -sS -T "<caminho do arquivo>" "${link}"`);
    expect(LIMITES_DO_ENVIO.prazoDoLinkMs).toBe(15 * 60 * 1000);
  });
});

describe("M1: o tamanho da cena segue a imagem", () => {
  it("pxPorQuadrado vale como veio; quadrados divide o lado maior da imagem; sem nenhum, nada muda", () => {
    const meta = { largura: 3150, altura: 3150 };
    expect(pxDoMapa(meta, { pxPorQuadrado: 70 })).toBe(70);
    expect(pxDoMapa(meta, { quadrados: 45 })).toBe(70);
    expect(pxDoMapa({ largura: 2100, altura: 3150 }, { quadrados: 45 })).toBe(70);
    expect(pxDoMapa(meta, {})).toBeNull();
    // 3150 px em 500 quadrados dá 6 px por quadrado: abaixo de 10 não serve.
    expect(pxDoMapa(meta, { quadrados: 500 })).toBe("invalido");
    expect(pxDoMapa(undefined, { quadrados: 45 })).toBe("invalido");
  });
});

describe("M1: o que cada uso aplica na mesa", () => {
  const hash = "a".repeat(64);
  const meta = { largura: 3150, altura: 3150, nomeOriginal: "cripta.png" };

  it("mapa: cena.definirMapa com o px calculado (a cena ganha o tamanho da imagem)", () => {
    const r = usoDoArquivo("mapa", { cenaId: "c1" }, hash, meta, { quadrados: 45 });
    expect(r).toMatchObject({
      ok: true,
      tipo: "cena.definirMapa",
      dados: { cenaId: "c1", assetHash: hash, pxPorQuadrado: 70 },
    });
    const semPx = usoDoArquivo("mapa", {}, hash, meta, {});
    expect(semPx).toMatchObject({ ok: true, dados: { assetHash: hash } });
    if (semPx.ok && semPx.tipo) expect(semPx.dados).not.toHaveProperty("pxPorQuadrado");
    expect(usoDoArquivo("mapa", {}, hash, meta, { quadrados: 500 })).toMatchObject({ ok: false });
  });

  it("token: no token da cena ou no token padrão da ficha; retrato e handout pedem o alvo", () => {
    expect(usoDoArquivo("token", { tokenId: "t1" }, hash, meta, {})).toMatchObject({
      tipo: "token.definirImagem",
      dados: { id: "t1", assetHash: hash },
    });
    expect(usoDoArquivo("token", { fichaId: "p1" }, hash, meta, {})).toMatchObject({
      tipo: "personagem.editar",
      dados: { id: "p1", mudancas: { assetHash: hash } },
    });
    expect(usoDoArquivo("token", {}, hash, meta, {})).toMatchObject({ ok: false });
    expect(usoDoArquivo("retrato", { fichaId: "p1" }, hash, meta, {})).toMatchObject({
      tipo: "personagem.editar",
      dados: { id: "p1", mudancas: { retratoHash: hash } },
    });
    expect(usoDoArquivo("retrato", {}, hash, meta, {})).toMatchObject({ ok: false });
    expect(usoDoArquivo("handout", { handoutId: "h1" }, hash, meta, {})).toMatchObject({
      tipo: "handout.editar",
      dados: { id: "h1", mudancas: { imagemHash: hash } },
    });
    expect(usoDoArquivo("handout", {}, hash, meta, {})).toMatchObject({ ok: false });
  });

  it("som: só entra na mesa (um lugar da mesa de som o faz tocar); compêndio: aponta o arquivo e conta as magias", () => {
    expect(
      usoDoArquivo(
        "som",
        { cenaId: "c1" },
        hash,
        { ...meta, nomeOriginal: "taverna.mp3" },
        { volume: 0.3 },
      ),
    ).toMatchObject({ ok: true, tipo: null });
    expect(usoDoArquivo("som", {}, hash, meta, {})).toMatchObject({ ok: true, tipo: null });
    expect(
      usoDoArquivo(
        "compendio",
        {},
        hash,
        { ...meta, nomeOriginal: "magias.json" },
        {},
        { magias: 12 },
      ),
    ).toMatchObject({
      tipo: "compendio.definir",
      dados: { compendio: { hash, nomeOriginal: "magias.json", magias: 12 } },
    });
  });
});
