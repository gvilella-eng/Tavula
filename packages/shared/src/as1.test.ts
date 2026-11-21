import { describe, expect, it } from "vitest";
import {
  type AssetMeta,
  CENA_PADRAO,
  caminhoNaPastaOrganizada,
  conferirArquivoRecebido,
  detectarFormato,
  type Estado,
  eventoPara,
  filtrarAssets,
  type Intencao,
  IntencaoSchema,
  listarAssetsDaMesa,
  nomeDeArquivoNoDisco,
  PASTA_DO_TIPO,
  processar,
  trechoDeCaminhoSeguro,
  validarMeta,
  verificarApagar,
  visaoPara,
} from "./index.ts";
import { estadoInicial } from "./semente.ts";

// AS1: assets da mesa e a segurança dos arquivos que vêm de outra pessoa.

const AGORA = "2026-01-01T00:00:00.000Z";
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const H3 = "c".repeat(64);
const H4 = "d".repeat(64);

const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const bytes = (...v: number[]) => new Uint8Array(v);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

function chunk(tipo: string, dados: number[] = []): number[] {
  const n = dados.length;
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
    ...[...tipo].map((c) => c.charCodeAt(0)),
    ...dados,
    0,
    0,
    0,
    0,
  ];
}
const pngComum = new Uint8Array([
  ...PNG,
  ...chunk("IHDR", new Array(13).fill(0)),
  ...chunk("IDAT", [1, 2]),
]);
const apng = new Uint8Array([
  ...PNG,
  ...chunk("IHDR", new Array(13).fill(0)),
  ...chunk("acTL", [0, 0, 0, 2, 0, 0, 0, 0]),
  ...chunk("IDAT", [1, 2]),
]);

function meta(hash: string, tipo: AssetMeta["tipo"], extra: Partial<AssetMeta> = {}): AssetMeta {
  return {
    hash,
    tipo,
    mime: tipo === "som" ? "audio/mpeg" : "image/webp",
    bytes: 1000,
    largura: 400,
    altura: 200,
    donoId: "m",
    nomeOriginal: `${tipo}-${hash.slice(0, 2)}.webp`,
    pedacos: [H1],
    ...extra,
  };
}

function criar(extra: Partial<Estado> = {}): Estado {
  const base = estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "Ana", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "Beto", papel: "jogador", cor: "#444" },
    ],
    cenas: [
      { ...CENA_PADRAO, id: "a", nome: "Cena A", mapa: { assetHash: H1, pxPorQuadrado: 70 } },
      {
        ...CENA_PADRAO,
        id: "b",
        nome: "Cena B (escondida)",
        mapa: { assetHash: H2, pxPorQuadrado: 70 },
      },
    ],
    cenaAtivaId: "a",
  });
  return {
    ...base,
    assets: [
      meta(H1, "mapa"),
      meta(H2, "mapa"),
      meta(H3, "imagem", { donoId: "j1", nomeOriginal: "estatua.png" }),
      meta(H4, "som"),
    ],
    ...extra,
  };
}

let n = 0;
const intencao = (tipo: Intencao["tipo"], dados: object): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `i${++n}`, tipo, dados });
function aplicar(e: Estado, quem: string, i: Intencao) {
  const r = processar(e, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} ${r.erro.mensagem}`);
  return r;
}
function recusa(e: Estado, quem: string, i: Intencao) {
  const r = processar(e, quem, i, AGORA);
  return r.ok ? null : r.erro;
}

describe("segurança dos arquivos (AS1)", () => {
  it("o tipo vem dos bytes: um .png que é outra coisa não passa", () => {
    // O nome diz "foto.png", os bytes são de um programa do Windows, de um script e de uma página.
    const exe = ascii("MZ\u0090\0\u0003\0\0\0");
    const r = conferirArquivoRecebido(exe, { tipo: "imagem", mime: "image/png" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/programa do Windows/);
    expect(
      conferirArquivoRecebido(ascii("#!/bin/sh\nrm -rf"), { tipo: "token", mime: "image/webp" }).ok,
    ).toBe(false);
    expect(
      conferirArquivoRecebido(ascii("<html><script>x</script>"), {
        tipo: "imagem",
        mime: "image/png",
      }).ok,
    ).toBe(false);
  });

  it("SVG é recusado (pode levar script), mesmo dizendo ser png", () => {
    const svg = ascii(
      "<?xml version='1.0'?><svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>",
    );
    expect(detectarFormato(svg)).toBeNull();
    const r = conferirArquivoRecebido(svg, { tipo: "imagem", mime: "image/png" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/SVG/);
    expect(validarMeta({ ...meta(H1, "imagem"), mime: "image/svg+xml" })).toMatch(
      /png, jpg, webp ou gif/,
    );
  });

  it("o tipo declarado tem de bater com os bytes", () => {
    const r = conferirArquivoRecebido(pngComum, { tipo: "imagem", mime: "image/webp" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/image\/webp.*image\/png/);
    expect(conferirArquivoRecebido(pngComum, { tipo: "imagem", mime: "image/png" }).ok).toBe(true);
    // imagem não serve para som, nem som para imagem
    expect(conferirArquivoRecebido(pngComum, { tipo: "som", mime: "image/png" }).ok).toBe(false);
    expect(
      conferirArquivoRecebido(ascii("ID3\u0004\0\0"), { tipo: "imagem", mime: "audio/mpeg" }).ok,
    ).toBe(false);
  });

  it("reconhece apng, gif e webp animado como animados", () => {
    expect(detectarFormato(pngComum)?.animado).toBe(false);
    expect(detectarFormato(apng)).toMatchObject({ mime: "image/png", animado: true });
    expect(detectarFormato(ascii("GIF89a...."))?.animado).toBe(true);
    const webpAnimado = new Uint8Array([...ascii("RIFF\0\0\0\0WEBPVP8X\n\0\0\0"), 0x02, 0, 0, 0]);
    const webpParado = new Uint8Array([...ascii("RIFF\0\0\0\0WEBPVP8X\n\0\0\0"), 0x00, 0, 0, 0]);
    expect(detectarFormato(webpAnimado)?.animado).toBe(true);
    expect(detectarFormato(webpParado)?.animado).toBe(false);
    expect(conferirArquivoRecebido(apng, { tipo: "animacao", mime: "image/png" }).ok).toBe(true);
  });

  it("respeita o limite de tamanho do tipo", () => {
    const grande = new Uint8Array(5 * 1024 * 1024);
    grande.set(ascii("GIF89a"));
    const r = conferirArquivoRecebido(grande, { tipo: "animacao", mime: "image/gif" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/limite/);
    expect(
      conferirArquivoRecebido(new Uint8Array(), { tipo: "imagem", mime: "image/png" }).ok,
    ).toBe(false);
  });

  it("o nome no disco: extensão do tipo detectado, nada de .., barras, .exe nem nome reservado", () => {
    const png = { extensao: "png" };
    expect(nomeDeArquivoNoDisco("foto.png", png, H1)).toBe("foto-aaaaaaaa.png");
    // A extensão do arquivo original nunca vale: um .exe que é png vira .png.
    expect(nomeDeArquivoNoDisco("virus.exe", png, H1)).toBe("virus-aaaaaaaa.png");
    expect(nomeDeArquivoNoDisco("foto.exe.png", png, H1)).toBe("foto-exe-aaaaaaaa.png");
    expect(nomeDeArquivoNoDisco("..\\..\\Windows\\system32\\x.dll", png, H1)).not.toMatch(
      /[\\/]|\.\./,
    );
    expect(nomeDeArquivoNoDisco("../../etc/passwd", png, H1)).not.toMatch(/[\\/]|\.\./);
    expect(nomeDeArquivoNoDisco("CON.png", png, H1)).toBe("_CON-aaaaaaaa.png");
    expect(nomeDeArquivoNoDisco("nul", png, H1)).toBe("_nul-aaaaaaaa.png");
    expect(nomeDeArquivoNoDisco("lixo . .", png, H1)).toBe("lixo-aaaaaaaa.png");
    expect(nomeDeArquivoNoDisco("a\u0000b\u001fc", png, H1)).toBe("abc-aaaaaaaa.png");
    expect(nomeDeArquivoNoDisco("", png, H1)).toBe("arquivo-aaaaaaaa.png");
    // Nunca existe nome com extensão executável, mesmo se o "formato" fosse adulterado.
    for (const ext of [
      "exe",
      "bat",
      "cmd",
      "ps1",
      "lnk",
      "scr",
      "hta",
      "js",
      "vbs",
      "svg",
      "html",
    ]) {
      expect(() => nomeDeArquivoNoDisco("x", { extensao: ext }, H1)).toThrow();
    }
  });

  it("pessoa e tipo viram trechos de caminho seguros", () => {
    expect(trechoDeCaminhoSeguro("..\\..")).toBe("arquivo");
    expect(trechoDeCaminhoSeguro("Ana/Beto")).toBe("Ana_Beto");
    expect(trechoDeCaminhoSeguro("AUX")).toBe("_AUX");
    expect(trechoDeCaminhoSeguro("Ana. ")).toBe("Ana");
  });

  it("a pasta organizada: assets/<pessoa>/<tipo>/<nome>-<hash>.<ext>; tile e cifrado ficam fora", () => {
    const c = caminhoNaPastaOrganizada(meta(H3, "imagem", { nomeOriginal: "Estátua.PNG" }), "Ana", {
      extensao: "webp",
    });
    expect(c).toEqual({ pasta: ["assets", "Ana", "imagens"], nome: "Estátua-cccccccc.webp" });
    const mapa = caminhoNaPastaOrganizada(meta(H1, "mapa"), "Mestre", { extensao: "webp" });
    expect(mapa?.pasta).toEqual(["assets", "Mestre", "mapas"]);
    expect(caminhoNaPastaOrganizada(meta(H1, "tile"), "x", { extensao: "webp" })).toBeNull();
    expect(caminhoNaPastaOrganizada(meta(H1, "cifrado"), "x", { extensao: "bin" })).toBeNull();
    // LP1: nenhuma pasta para o que não vai para a organizada
    expect(Object.keys(PASTA_DO_TIPO)).not.toContain("cifrado");
    expect(Object.keys(PASTA_DO_TIPO)).not.toContain("tile");
    // Dois arquivos de mesmo nome não se sobrescrevem (o hash entra no nome); o mesmo arquivo sempre cai no mesmo lugar.
    const a = caminhoNaPastaOrganizada(meta(H1, "imagem", { nomeOriginal: "x.png" }), "Ana", {
      extensao: "webp",
    });
    const b = caminhoNaPastaOrganizada(meta(H2, "imagem", { nomeOriginal: "x.png" }), "Ana", {
      extensao: "webp",
    });
    expect(a?.nome).not.toBe(b?.nome);
    expect(
      caminhoNaPastaOrganizada(meta(H1, "imagem", { nomeOriginal: "x.png" }), "Ana", {
        extensao: "webp",
      }),
    ).toEqual(a);
  });

  it("a sala recusa uma meta de imagem com tipo que não está na lista fechada", () => {
    const e = criar();
    const ruim = { ...meta(H3, "imagem"), hash: "e".repeat(64), mime: "text/html" };
    const { donoId: _d, ...nova } = ruim;
    const r = recusa(e, "j1", intencao("asset.registrar", { metas: [nova] }));
    expect(r?.codigo).toBe("dados_invalidos");
  });
});

describe("lista de assets da mesa (AS1)", () => {
  it("o mestre vê todos os arquivos, com quem enviou e onde cada um é usado", () => {
    const e = criar({
      tokens: [
        {
          id: "t1",
          cenaId: "a",
          nome: "Estátua",
          cor: "#888",
          tamanhoQuadrados: 1,
          x: 5,
          y: 5,
          camada: "mapa",
          oculto: false,
          controladoPor: [],
          assetHash: H3,
          imagem: { larguraM: 3, alturaM: 3, rotacao: 0, por: "j1" },
        },
      ],
    });
    const linhas = listarAssetsDaMesa(e, { id: "m", papel: "mestre" });
    expect(linhas.map((l) => l.tipo).sort()).toEqual(["imagem", "mapa", "mapa", "som"]);
    const estatua = linhas.find((l) => l.hash === H3);
    expect(estatua?.donoNome).toBe("Ana");
    expect(estatua?.categoria).toBe("imagem");
    expect(estatua?.usos[0]).toMatch(/imagem solta Estátua \(cena Cena A\)/);
    expect(linhas.find((l) => l.hash === H1)?.usos).toEqual(["mapa da cena Cena A"]);
    expect(linhas.find((l) => l.hash === H4)?.usos).toEqual([]);
  });

  it("o jogador vê só o que é dele e o que está em uso numa coisa que ele vê: nunca o mapa escondido nem os sons do mestre", () => {
    const e = criar({
      tokens: [
        {
          id: "t1",
          cenaId: "a",
          nome: "Estátua",
          cor: "#888",
          tamanhoQuadrados: 1,
          x: 5,
          y: 5,
          camada: "mapa",
          oculto: false,
          controladoPor: [],
          assetHash: H3,
          imagem: { larguraM: 3, alturaM: 3, rotacao: 0, por: "m" },
        },
      ],
      mesaDeSom: {
        efeitos: [{ hash: H4, nome: "Trovão", icone: "trovao", cor: "ambar", volume: 1 }],
        ambientes: [],
      },
    });
    // Ana vê o mapa da cena ativa (A), a estátua (dela e visível); Beto também vê a estátua (em uso, visível) e o mapa A.
    for (const id of ["j1", "j2"]) {
      const linhas = listarAssetsDaMesa(e, { id, papel: "jogador" });
      const hashes = linhas.map((l) => l.hash);
      expect(hashes).toContain(H1);
      expect(hashes).toContain(H3);
      expect(hashes).not.toContain(H2); // o mapa da cena B (escondida)
      expect(hashes).not.toContain(H4); // o som do mestre
    }
    // O uso que o jogador lê só cita o que ele vê: o trovão da mesa de som nunca aparece.
    const dele = listarAssetsDaMesa(e, { id: "j1", papel: "jogador" });
    expect(dele.flatMap((l) => l.usos).join(" ")).not.toMatch(/Trovão|Cena B/);
  });

  it("imagem solta na camada do mestre ou escondida não aparece para o jogador (a não ser que seja dele)", () => {
    const base = {
      cenaId: "a",
      nome: "Segredo",
      cor: "#888",
      tamanhoQuadrados: 1,
      x: 1,
      y: 1,
      controladoPor: [],
      assetHash: H3,
    };
    const e = criar({
      tokens: [
        {
          ...base,
          id: "t1",
          camada: "mestre",
          oculto: false,
          imagem: { larguraM: 3, alturaM: 3, rotacao: 0, por: "m" },
        },
      ],
      // o arquivo é do mestre: nenhum jogador o enviou
      assets: [meta(H1, "mapa"), meta(H3, "imagem", { donoId: "m" })],
    });
    const linhas = listarAssetsDaMesa(e, { id: "j2", papel: "jogador" });
    expect(linhas.map((l) => l.hash)).not.toContain(H3);
    // quem enviou continua vendo o próprio arquivo (sem o uso escondido)
    const dono = criar({
      tokens: e.tokens,
      assets: [meta(H1, "mapa"), meta(H3, "imagem", { donoId: "j2" })],
    });
    const dele = listarAssetsDaMesa(dono, { id: "j2", papel: "jogador" }).find(
      (l) => l.hash === H3,
    );
    expect(dele?.usos).toEqual([]);
  });

  it("filtra por tipo, por quem enviou e por busca; ordena por nome, data e tamanho", () => {
    const e = criar();
    const todas = listarAssetsDaMesa(e, { id: "m", papel: "mestre" });
    expect(filtrarAssets(todas, { categoria: "imagem" }).map((l) => l.hash)).toEqual([H3]);
    expect(filtrarAssets(todas, { dono: "j1" }).map((l) => l.hash)).toEqual([H3]);
    expect(filtrarAssets(todas, { busca: "ESTATUA" }).map((l) => l.hash)).toEqual([H3]);
    expect(filtrarAssets(todas, { busca: "ana" }).map((l) => l.hash)).toEqual([H3]);
    expect(filtrarAssets(todas, { ordem: "data" })[0]?.hash).toBe(H4);
    const grande = listarAssetsDaMesa(
      criar({ assets: [meta(H1, "mapa", { bytes: 10 }), meta(H3, "imagem", { bytes: 99999 })] }),
      { id: "m", papel: "mestre" },
    );
    expect(filtrarAssets(grande, { ordem: "tamanho" })[0]?.hash).toBe(H3);
    expect(filtrarAssets(grande, { ordem: "nome" }).map((l) => l.nome)).toEqual(
      [...grande.map((l) => l.nome)].sort((a, b) => a.localeCompare(b, "pt-BR")),
    );
  });

  it("apagar em uso avisa onde; sem uso apaga; uso que não se arruma sozinho recusa", () => {
    const e = criar({
      mesaDeSom: {
        efeitos: [{ hash: H4, nome: "Trovão", icone: "trovao", cor: "ambar", volume: 1 }],
        ambientes: [],
      },
    });
    const mapa = verificarApagar(e, H1);
    expect(mapa).toMatchObject({ ok: true, semUso: false });
    if (mapa.ok && !mapa.semUso) expect(mapa.usos).toEqual(["mapa da cena Cena A"]);
    expect(verificarApagar(e, H3)).toEqual({ ok: true, semUso: true });
    const som = verificarApagar(e, H4);
    expect(som.ok).toBe(false);
    expect(verificarApagar(e, "9".repeat(64)).ok).toBe(false);
  });
});

describe("imagem solta na cena e assets (AS1, na sala)", () => {
  const colocar = (id: string, extra: object = {}) =>
    intencao("imagem.colocar", { id, assetHash: H3, x: 10, y: 8, ...extra });

  it("o mestre põe a imagem no ponto e na camada ativa; o tamanho vem da proporção do arquivo", () => {
    const e = criar();
    const r = aplicar(e, "m", colocar("img1", { camada: "mapa" }));
    const t = r.estado.tokens.find((x) => x.id === "img1");
    expect(t).toMatchObject({ x: 10, y: 8, camada: "mapa", cenaId: "a", assetHash: H3 });
    // 400 x 200 px a 70 px por quadrado: 5,7 quadrados de largura (cabe entre 1 e 8), altura pela proporção 1:2.
    expect(t?.imagem?.alturaM).toBeCloseTo((t?.imagem?.larguraM ?? 0) / 2, 5);
    expect(t?.imagem?.por).toBe("m");
    expect(r.eventos.map((v) => v.tipo)).toEqual(["token.criado"]);
  });

  it("o jogador sem a capacidade não põe; com ela só na cena ativa e fora da camada do mestre", () => {
    const e = criar();
    expect(recusa(e, "j1", colocar("img1"))?.codigo).toBe("sem_permissao");
    const com = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "imagem.colocar", valor: true }),
    ).estado;
    expect(recusa(com, "j1", colocar("img1", { camada: "mestre" }))?.codigo).toBe("sem_permissao");
    expect(recusa(com, "j1", colocar("img1", { cenaId: "b" }))?.codigo).toBe("sem_permissao");
    const r = aplicar(com, "j1", colocar("img1"));
    expect(r.estado.tokens[0]).toMatchObject({ camada: "tokens", imagem: { por: "j1" } });
  });

  it("recusa asset que não é imagem, id repetido e arquivo que o jogador não vê", () => {
    const e = aplicar(
      criar(),
      "m",
      intencao("permissao.alterar", { capacidade: "imagem.colocar", valor: true }),
    ).estado;
    expect(
      recusa(e, "m", intencao("imagem.colocar", { id: "x", assetHash: H4, x: 1, y: 1 }))?.codigo,
    ).toBe("asset_inexistente");
    // O mapa inteiro (sem pedaços) só o mestre põe; o jogador não, nem o que ele vê.
    expect(
      aplicar(e, "m", intencao("imagem.colocar", { id: "mapa1", assetHash: H1, x: 1, y: 1 })).estado
        .tokens,
    ).toHaveLength(1);
    expect(
      recusa(e, "j1", intencao("imagem.colocar", { id: "x", assetHash: H1, x: 1, y: 1 }))?.codigo,
    ).toBe("asset_inexistente");
    expect(
      recusa(e, "m", intencao("imagem.colocar", { id: "x", assetHash: "9".repeat(64), x: 1, y: 1 }))
        ?.codigo,
    ).toBe("asset_inexistente");
    const posta = aplicar(e, "m", colocar("img1")).estado;
    expect(recusa(posta, "m", colocar("img1"))?.codigo).toBe("dados_invalidos");
    // Beto não enviou nem vê H3 (imagem de Ana, sem uso): não pode pô-la.
    expect(recusa(e, "j2", colocar("img2"))?.codigo).toBe("asset_inexistente");
  });

  it("mover, esticar, girar e esconder: o mestre mexe em qualquer imagem; o jogador só nas dele e sem esconder", () => {
    let e = aplicar(
      criar(),
      "m",
      intencao("permissao.alterar", { capacidade: "imagem.colocar", valor: true }),
    ).estado;
    e = aplicar(e, "j1", colocar("minha")).estado;
    e = aplicar(e, "m", colocar("dele", { camada: "mapa" })).estado;
    const aj = (id: string, mudancas: object) => intencao("imagem.ajustar", { id, mudancas });
    const girada = aplicar(
      e,
      "j1",
      aj("minha", { rotacao: 90, larguraM: 4, x: 3, y: 4 }),
    ).estado.tokens.find((t) => t.id === "minha");
    expect(girada).toMatchObject({ x: 3, y: 4, imagem: { rotacao: 90, larguraM: 4 } });
    expect(recusa(e, "j1", aj("dele", { rotacao: 10 }))?.codigo).toBe("sem_permissao");
    expect(recusa(e, "j1", aj("minha", { oculto: true }))?.codigo).toBe("sem_permissao");
    expect(recusa(e, "j1", aj("minha", { camada: "mestre" }))?.codigo).toBe("sem_permissao");
    const oculta = aplicar(
      e,
      "m",
      aj("minha", { oculto: true, camada: "mestre" }),
    ).estado.tokens.find((t) => t.id === "minha");
    expect(oculta).toMatchObject({ oculto: true, camada: "mestre" });
    // Imagem que o jogador não vê (camada do mestre) responde como se não existisse.
    expect(
      recusa(
        oculta
          ? {
              ...e,
              tokens: e.tokens.map((t) =>
                t.id === "dele" ? { ...t, camada: "mestre" as const } : t,
              ),
            }
          : e,
        "j1",
        aj("dele", { rotacao: 1 }),
      )?.codigo,
    ).toBe("token_inexistente");
    // Sem a capacidade (desligada depois), o jogador perde o ajuste.
    const sem = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "imagem.colocar", valor: false }),
    ).estado;
    expect(recusa(sem, "j1", aj("minha", { rotacao: 5 }))?.codigo).toBe("sem_permissao");
  });

  it("a imagem do mestre na camada dele não chega ao jogador (frames e snapshot)", () => {
    const e = criar();
    const r = aplicar(e, "m", colocar("seg", { camada: "mestre" }));
    const evento = r.eventos[0];
    if (!evento) throw new Error("sem evento");
    expect(eventoPara(evento, { id: "j1", papel: "jogador" }, e, r.estado)).toBeNull();
    expect(visaoPara(r.estado, { id: "j1", papel: "jogador" }).tokens).toHaveLength(0);
    const aberta = aplicar(e, "m", colocar("aberta", { camada: "mapa" }));
    const ev2 = aberta.eventos[0];
    if (!ev2) throw new Error("sem evento");
    expect(eventoPara(ev2, { id: "j1", papel: "jogador" }, e, aberta.estado)?.tipo).toBe(
      "token.criado",
    );
    expect(visaoPara(aberta.estado, { id: "j1", papel: "jogador" }).tokens).toHaveLength(1);
  });

  it("o jogador com a capacidade move e apaga a imagem que pôs; a dos outros não; sem a capacidade, nada", () => {
    let e = aplicar(
      criar(),
      "m",
      intencao("permissao.alterar", { capacidade: "imagem.colocar", valor: true }),
    ).estado;
    e = aplicar(e, "j1", colocar("minha")).estado;
    e = aplicar(e, "m", colocar("dele", { camada: "mapa" })).estado;
    expect(
      aplicar(e, "j1", intencao("token.soltar", { id: "minha", x: 5, y: 6 })).estado.tokens.find(
        (t) => t.id === "minha",
      ),
    ).toMatchObject({ x: 5, y: 6 });
    expect(recusa(e, "j1", intencao("token.soltar", { id: "dele", x: 5, y: 6 }))?.codigo).toBe(
      "sem_permissao",
    );
    expect(recusa(e, "j2", intencao("token.soltar", { id: "minha", x: 5, y: 6 }))?.codigo).toBe(
      "sem_permissao",
    );
    expect(recusa(e, "j1", intencao("token.apagar", { id: "dele" }))?.codigo).toBe("sem_permissao");
    expect(
      aplicar(e, "j1", intencao("token.apagar", { id: "minha" })).estado.tokens.map((t) => t.id),
    ).toEqual(["dele"]);
    const sem = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "imagem.colocar", valor: false }),
    ).estado;
    expect(recusa(sem, "j1", intencao("token.apagar", { id: "minha" }))?.codigo).toBe(
      "sem_permissao",
    );
  });

  it("apagar a imagem (token.apagar) e o desfazer (token.restaurar)", () => {
    const e = aplicar(criar(), "m", colocar("img1", { camada: "mapa" })).estado;
    const ap = processar(e, "m", intencao("token.apagar", { id: "img1" }), AGORA);
    if (!ap.ok || !ap.apagado) throw new Error("não apagou");
    expect(ap.estado.tokens).toHaveLength(0);
    const de = processar(
      ap.estado,
      "m",
      intencao("token.restaurar", { id: "img1" }),
      AGORA,
      undefined,
      [{ ...ap.apagado, emMs: 0 }],
    );
    expect(de.ok && de.estado.tokens[0]?.imagem?.por).toBe("m");
  });

  it("renomear: só o mestre; o nome de exibição some do evento do jogador; voltar ao original", () => {
    const e = criar();
    expect(recusa(e, "j1", intencao("asset.renomear", { hash: H3, nome: "Outro" }))?.codigo).toBe(
      "sem_permissao",
    );
    const r = aplicar(
      e,
      "m",
      intencao("asset.renomear", { hash: H3, nome: "  Estátua da praça " }),
    );
    expect(r.estado.assets?.find((a) => a.hash === H3)?.nomeExibicao).toBe("Estátua da praça");
    expect(
      eventoPara(r.eventos[0] as never, { id: "j1", papel: "jogador" }, e, r.estado),
    ).toBeNull();
    const volta = aplicar(
      r.estado,
      "m",
      intencao("asset.renomear", { hash: H3, nome: "estatua.png" }),
    );
    expect(volta.estado.assets?.find((a) => a.hash === H3)?.nomeExibicao).toBeUndefined();
    expect(
      recusa(e, "m", intencao("asset.renomear", { hash: "9".repeat(64), nome: "x" }))?.codigo,
    ).toBe("asset_inexistente");
  });

  it("apagar asset em uso recusa e diz onde; confirmando, tira a imagem dos lugares; restaurar volta o arquivo", () => {
    let e = aplicar(criar(), "m", colocar("img1", { camada: "mapa" })).estado;
    const r1 = recusa(e, "m", intencao("asset.apagar", { hash: H3 }));
    expect(r1?.codigo).toBe("asset_em_uso");
    expect(r1?.mensagem).toMatch(/imagem solta/);
    const confirmado = aplicar(e, "m", intencao("asset.apagar", { hash: H3, removerUsos: true }));
    expect(confirmado.estado.tokens).toHaveLength(0);
    expect(confirmado.estado.assets?.some((a) => a.hash === H3)).toBe(false);
    // O mapa em uso também se arruma: a cena fica sem mapa.
    const semMapa = aplicar(e, "m", intencao("asset.apagar", { hash: H1, removerUsos: true }));
    expect(semMapa.estado.cenas.find((c) => c.id === "a")?.mapa).toBeUndefined();
    // Sem uso, apaga direto. Jogador nunca.
    e = confirmado.estado;
    expect(recusa(criar(), "j1", intencao("asset.apagar", { hash: H3 }))?.codigo).toBe(
      "sem_permissao",
    );
    const sem = aplicar(criar(), "m", intencao("asset.apagar", { hash: H3 }));
    expect(sem.estado.assets?.some((a) => a.hash === H3)).toBe(false);
    // Desfazer: a meta volta com o mesmo dono e nome.
    const meta3 = criar().assets?.find((a) => a.hash === H3) as AssetMeta;
    const volta = aplicar(sem.estado, "m", intencao("asset.restaurar", { metas: [meta3] }));
    expect(volta.estado.assets?.find((a) => a.hash === H3)).toMatchObject({
      donoId: "j1",
      nomeOriginal: "estatua.png",
    });
    // Som em uso numa zona de som: não se apaga por aqui.
    const comSom = criar({
      mesaDeSom: {
        efeitos: [{ hash: H4, nome: "Trovão", icone: "trovao", cor: "ambar", volume: 1 }],
        ambientes: [],
      },
    });
    expect(
      recusa(comSom, "m", intencao("asset.apagar", { hash: H4, removerUsos: true }))?.codigo,
    ).toBe("asset_em_uso");
  });

  it("o upload do jogador entra nos assets com o nome dele; o nome de exibição que ele mandar é ignorado", () => {
    const e = criar();
    const nova = { ...meta("e".repeat(64), "imagem"), nomeExibicao: "Fingindo ser outra coisa" };
    const { donoId: _d, ...semDono } = nova;
    const r = aplicar(e, "j2", intencao("asset.registrar", { metas: [semDono] }));
    const registrado = r.estado.assets?.find((a) => a.hash === "e".repeat(64));
    expect(registrado?.donoId).toBe("j2");
    expect(registrado?.nomeExibicao).toBeUndefined();
    const linhas = listarAssetsDaMesa(r.estado, { id: "m", papel: "mestre" });
    expect(linhas.find((l) => l.hash === "e".repeat(64))?.donoNome).toBe("Beto");
  });

  it("animação (gif) do jogador só com a capacidade de pôr imagem", () => {
    const e = criar();
    const gif = { ...meta("f".repeat(64), "animacao", { mime: "image/gif" }) };
    const { donoId: _d, ...semDono } = gif;
    expect(recusa(e, "j1", intencao("asset.registrar", { metas: [semDono] }))?.codigo).toBe(
      "sem_permissao",
    );
    const com = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "imagem.colocar", valor: true }),
    ).estado;
    expect(
      aplicar(com, "j1", intencao("asset.registrar", { metas: [semDono] })).estado.assets?.some(
        (a) => a.hash === "f".repeat(64),
      ),
    ).toBe(true);
  });

  it("a lista pedida pelo jogador é só dele (assets.listar não muda o estado)", () => {
    const e = criar();
    const r = aplicar(e, "j1", intencao("assets.listar", {}));
    expect(r.eventos).toEqual([]);
    expect(r.estado).toBe(e);
  });
});
