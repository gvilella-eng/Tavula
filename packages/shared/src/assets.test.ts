import { describe, expect, it } from "vitest";
import {
  type AssetMeta,
  arquivoConfere,
  assetVisivelPara,
  criarExportacao,
  dividirEmPedacos,
  type Estado,
  ehManifesto,
  escolherProvedor,
  estadoInicial,
  eventoPara,
  hashDoManifesto,
  hashesDosPedacos,
  hashesUsados,
  type Intencao,
  IntencaoSchema,
  LIMITES_DE_ASSET,
  ladoDoTile,
  lerExportacao,
  lerFrameDePedaco,
  limiteDeTextura,
  type MetaNova,
  montarFrameDePedaco,
  montarManifestoDeMapa,
  pedacoConfere,
  precisaFatiar,
  processar,
  retangulosDeTiles,
  sha256Hex,
  TAMANHO_CABECALHO_FRAME,
  TAMANHO_PEDACO,
  type Token,
  tamanhoDaCenaComMapa,
  totalDePedacos,
  validarMeta,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const mestre = { id: "m", papel: "mestre" as const };
const j1 = { id: "j1", papel: "jogador" as const };
const j2 = { id: "j2", papel: "jogador" as const };

/** Bytes determinísticos (não precisam ser uma imagem). */
function bytes(n: number, semente = 1): Uint8Array {
  const b = new Uint8Array(n);
  let x = semente;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    b[i] = x >> 16;
  }
  return b;
}

async function metaDeArquivo(
  tipo: MetaNova["tipo"],
  dados: Uint8Array,
  extra: Partial<MetaNova> = {},
): Promise<MetaNova> {
  return {
    hash: await sha256Hex(dados),
    tipo,
    mime: "image/webp",
    bytes: dados.length,
    largura: tipo === "token" ? 128 : 1000,
    altura: tipo === "token" ? 128 : 800,
    nomeOriginal: "arquivo.png",
    pedacos: await hashesDosPedacos(dividirEmPedacos(dados)),
    ...extra,
  };
}

describe("tiles", () => {
  it("cobre a imagem inteira, sem sobrepor e sem passar do lado máximo", () => {
    for (const [l, a, lado] of [
      [10_000, 6_000, 4096],
      [4096, 4096, 4096],
      [4097, 100, 4096],
      [1200, 800, 512],
      [7, 3, 2],
    ] as const) {
      const r = retangulosDeTiles(l, a, lado);
      const mapa = new Uint8Array(l * a);
      for (const t of r) {
        expect(t.largura).toBeLessThanOrEqual(lado);
        expect(t.altura).toBeLessThanOrEqual(lado);
        for (let y = t.y; y < t.y + t.altura; y++) {
          for (let x = t.x; x < t.x + t.largura; x++) mapa[y * l + x] = (mapa[y * l + x] ?? 0) + 1;
        }
      }
      expect(
        mapa.every((v) => v === 1),
        `${l}x${a}/${lado}`,
      ).toBe(true);
    }
  });

  it("10000 x 6000 com tiles de 4096 vira 3 x 2, de tamanhos parecidos", () => {
    const r = retangulosDeTiles(10_000, 6_000, 4096);
    expect(r).toHaveLength(6);
    expect(r.map((t) => t.largura)).toEqual([3333, 3334, 3333, 3333, 3334, 3333]);
    expect(r.map((t) => t.altura)).toEqual([3000, 3000, 3000, 3000, 3000, 3000]);
    expect(r[0]).toEqual({ x: 0, y: 0, largura: 3333, altura: 3000 });
  });

  it("imagem pequena é um tile só", () => {
    expect(retangulosDeTiles(300, 200, 4096)).toEqual([{ x: 0, y: 0, largura: 300, altura: 200 }]);
  });

  it("o limite de textura nunca passa de 8192 e o tile nunca passa de 4096", () => {
    expect(limiteDeTextura(16_384)).toBe(8192);
    expect(limiteDeTextura(4096)).toBe(4096);
    expect(ladoDoTile(8192)).toBe(4096);
    expect(ladoDoTile(512)).toBe(512);
    expect(precisaFatiar(8192, 100, 8192)).toBe(false);
    expect(precisaFatiar(8193, 100, 8192)).toBe(true);
    expect(precisaFatiar(100, 600, 512)).toBe(true);
  });

  it("o tamanho da cena é px ÷ pxPorQuadrado × quadradoM", () => {
    expect(tamanhoDaCenaComMapa({ largura: 1400, altura: 700 }, 70, 1.5)).toEqual({
      larguraM: 30,
      alturaM: 15,
    });
  });
});

describe("frame binário de pedaço", () => {
  const hash = "ab".repeat(32);

  it("monta e lê de volta (e o cabeçalho tem o formato combinado)", () => {
    const dados = bytes(1000);
    const frame = montarFrameDePedaco({ hash, indice: 3, total: 9, dados });
    expect(frame.length).toBe(TAMANHO_CABECALHO_FRAME + 1000);
    expect(frame[0]).toBe(1);
    expect([...frame.subarray(1, 33)]).toEqual(Array(32).fill(0xab));
    expect([...frame.subarray(33, 41)]).toEqual([0, 0, 0, 3, 0, 0, 0, 9]);
    const lido = lerFrameDePedaco(frame);
    expect(lido?.hash).toBe(hash);
    expect(lido?.indice).toBe(3);
    expect(lido?.total).toBe(9);
    expect([...(lido?.dados ?? [])]).toEqual([...dados]);
  });

  it("lê também de um ArrayBuffer e de uma visão com deslocamento", () => {
    const frame = montarFrameDePedaco({ hash, indice: 0, total: 1, dados: bytes(10) });
    expect(lerFrameDePedaco(frame.buffer as ArrayBuffer)?.indice).toBe(0);
    const solto = new Uint8Array(frame.length + 5);
    solto.set(frame, 5);
    expect(lerFrameDePedaco(solto.subarray(5))?.hash).toBe(hash);
  });

  it("recusa frame curto, de outro tipo ou com índice fora do total", () => {
    const frame = montarFrameDePedaco({ hash, indice: 0, total: 2, dados: bytes(4) });
    expect(lerFrameDePedaco(frame.subarray(0, 40))).toBeNull();
    expect(lerFrameDePedaco(new Uint8Array(0))).toBeNull();
    const outroTipo = frame.slice();
    outroTipo[0] = 2;
    expect(lerFrameDePedaco(outroTipo)).toBeNull();
    expect(
      lerFrameDePedaco(montarFrameDePedaco({ hash, indice: 2, total: 2, dados: bytes(1) })),
    ).toBeNull();
    expect(
      lerFrameDePedaco(montarFrameDePedaco({ hash, indice: 0, total: 0, dados: bytes(1) })),
    ).toBeNull();
  });
});

describe("pedaços e hash", () => {
  it("divide em pedaços de 256 KB, o último menor", () => {
    const dados = bytes(TAMANHO_PEDACO * 2 + 10);
    const p = dividirEmPedacos(dados);
    expect(p.map((x) => x.length)).toEqual([TAMANHO_PEDACO, TAMANHO_PEDACO, 10]);
    expect(totalDePedacos(dados.length)).toBe(3);
  });

  it("confere cada pedaço pelo hash do manifesto e detecta o corrompido", async () => {
    const dados = bytes(TAMANHO_PEDACO + 500);
    const meta = await metaDeArquivo("mapa", dados);
    const [a, b] = dividirEmPedacos(dados) as [Uint8Array, Uint8Array];
    expect(await pedacoConfere(meta, 0, a)).toBe(true);
    expect(await pedacoConfere(meta, 1, b)).toBe(true);
    const ruim = a.slice();
    ruim[100] = (ruim[100] ?? 0) ^ 1;
    expect(await pedacoConfere(meta, 0, ruim)).toBe(false);
    expect(await pedacoConfere(meta, 1, a)).toBe(false); // pedaço de outro índice
    expect(await pedacoConfere(meta, 1, b.subarray(1))).toBe(false); // tamanho errado
    expect(await pedacoConfere(meta, 2, b)).toBe(false); // índice inexistente
  });

  it("confere o arquivo inteiro", async () => {
    const dados = bytes(5000);
    const meta = await metaDeArquivo("token", dados);
    expect(await arquivoConfere(meta, dados)).toBe(true);
    const ruim = dados.slice();
    ruim[0] = (ruim[0] ?? 0) ^ 255;
    expect(await arquivoConfere(meta, ruim)).toBe(false);
    expect(await arquivoConfere(meta, dados.subarray(1))).toBe(false);
  });
});

describe("manifesto de mapa fatiado", () => {
  it("monta o manifesto a partir dos tiles, com hash estável e coerente", async () => {
    const rects = retangulosDeTiles(1200, 800, 512);
    const tiles = await Promise.all(
      rects.map(async (r, i) => ({ ...r, hash: await sha256Hex(bytes(100, i + 1)) })),
    );
    const m = await montarManifestoDeMapa({
      largura: 1200,
      altura: 800,
      nomeOriginal: "masmorra.png",
      mime: "image/webp",
      tiles,
    });
    expect(ehManifesto(m)).toBe(true);
    expect(m.tipo).toBe("mapa");
    expect(m.bytes).toBe(0);
    expect(m.pedacos).toEqual([]);
    expect(m.tiles).toHaveLength(6);
    expect(m.hash).toBe(await hashDoManifesto(tiles));
    expect(validarMeta(m)).toBeNull();
    // outro conjunto de tiles muda o hash
    expect(await hashDoManifesto([...tiles].reverse())).not.toBe(m.hash);
  });

  it("recusa manifesto com tile fora do mapa, que não cobre o mapa ou que carrega bytes", async () => {
    const h = await sha256Hex(bytes(3));
    const base: MetaNova = {
      hash: h,
      tipo: "mapa",
      mime: "image/webp",
      bytes: 0,
      largura: 100,
      altura: 100,
      nomeOriginal: "m.png",
      pedacos: [],
      tiles: [{ hash: h, x: 0, y: 0, largura: 100, altura: 100 }],
    };
    expect(validarMeta(base)).toBeNull();
    expect(
      validarMeta({ ...base, tiles: [{ hash: h, x: 50, y: 0, largura: 100, altura: 100 }] }),
    ).toMatch(/fora do mapa/);
    expect(
      validarMeta({ ...base, tiles: [{ hash: h, x: 0, y: 0, largura: 50, altura: 100 }] }),
    ).toMatch(/não cobrem/);
    expect(validarMeta({ ...base, bytes: 10 })).toMatch(/não leva bytes/);
    expect(validarMeta({ ...base, tipo: "token" })).toMatch(/só mapa/);
  });
});

describe("limites", () => {
  it("valida tamanho, pedaços e dimensões", async () => {
    const dados = bytes(TAMANHO_PEDACO + 1);
    const ok = await metaDeArquivo("mapa", dados);
    expect(validarMeta(ok)).toBeNull();
    expect(validarMeta({ ...ok, bytes: 0 })).toMatch(/vazio/);
    expect(validarMeta({ ...ok, bytes: LIMITES_DE_ASSET.bytesPorArquivo + 1 })).toMatch(
      /grande demais/,
    );
    expect(validarMeta({ ...ok, pedacos: ok.pedacos.slice(1) })).toMatch(/pedaços/);
    expect(validarMeta({ ...ok, largura: 9000 })).toMatch(/sem tiles/);
    const token = await metaDeArquivo("token", bytes(100), { largura: 513, altura: 100 });
    expect(validarMeta(token)).toMatch(/token/);
    const tile = await metaDeArquivo("tile", bytes(100), { largura: 4097, altura: 10 });
    expect(validarMeta(tile)).toMatch(/tile/);
  });
});

describe("quem serve o arquivo", () => {
  const c = (conexaoId: string, usuarioId: string, papel: "mestre" | "jogador") => ({
    conexaoId,
    usuarioId,
    papel,
  });
  it("dono, depois mestre, depois qualquer um; ninguém: null", () => {
    const lista = [c("1", "j2", "jogador"), c("2", "m", "mestre"), c("3", "j1", "jogador")];
    expect(escolherProvedor(lista, "j1")?.conexaoId).toBe("3");
    expect(escolherProvedor(lista, "j9")?.conexaoId).toBe("2");
    expect(
      escolherProvedor([c("1", "j2", "jogador"), c("3", "j1", "jogador")], "j9")?.conexaoId,
    ).toBe("1");
    expect(escolherProvedor([], "j1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Estado com assets: visibilidade, intenções, exportação
// ---------------------------------------------------------------------------------------------

function token(id: string, extra: Partial<Token> = {}): Token {
  return {
    id,
    cenaId: "cena-1",
    nome: id,
    cor: "#abc",
    tamanhoQuadrados: 1,
    x: 5,
    y: 5,
    camada: "tokens",
    oculto: false,
    controladoPor: [],
    ...extra,
  };
}

function usuarios() {
  return [
    { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
    { id: "j1", nome: "Um", papel: "jogador", cor: "#222" },
    { id: "j2", nome: "Dois", papel: "jogador", cor: "#333" },
    { id: "a", nome: "Assistente", papel: "assistente", cor: "#444" },
  ];
}

type NomesDeMeta =
  | "imgJ1"
  | "imgOculto"
  | "imgMestre"
  | "imgDoJ2"
  | "tileA"
  | "tileB"
  | "manifesto"
  | "outroMapa";
type Fixos = { estado: Estado; metas: Record<NomesDeMeta, AssetMeta> };

/** Estado com: token visível do j1 e goblin oculto, cada um com imagem; mapa fatiado na cena. */
async function cenario(): Promise<Fixos> {
  const dono = (id: string, m: MetaNova): AssetMeta => ({ ...m, donoId: id });
  const imgJ1 = dono("j1", await metaDeArquivo("token", bytes(300, 1)));
  const imgOculto = dono("m", await metaDeArquivo("token", bytes(300, 2)));
  const imgMestre = dono("m", await metaDeArquivo("token", bytes(300, 3)));
  const imgDoJ2 = dono("j2", await metaDeArquivo("retrato", bytes(300, 4)));
  const tileA = dono(
    "m",
    await metaDeArquivo("tile", bytes(300, 5), { largura: 100, altura: 100 }),
  );
  const tileB = dono(
    "m",
    await metaDeArquivo("tile", bytes(300, 6), { largura: 100, altura: 100 }),
  );
  const manifesto = dono(
    "m",
    await montarManifestoDeMapa({
      largura: 200,
      altura: 100,
      nomeOriginal: "mapa.png",
      mime: "image/webp",
      tiles: [
        { hash: tileA.hash, x: 0, y: 0, largura: 100, altura: 100 },
        { hash: tileB.hash, x: 100, y: 0, largura: 100, altura: 100 },
      ],
    }),
  );
  const outroMapa = dono("m", await metaDeArquivo("mapa", bytes(400, 7)));
  const metas = { imgJ1, imgOculto, imgMestre, imgDoJ2, tileA, tileB, manifesto, outroMapa };
  const base = estadoInicial({ usuarios: usuarios() });
  const estado: Estado = {
    ...base,
    tokens: [
      token("t-j1", { controladoPor: ["j1"], assetHash: imgJ1.hash }),
      token("goblin", { oculto: true, assetHash: imgOculto.hash }),
      token("marcador", { camada: "mestre", assetHash: imgMestre.hash }),
    ],
    cenas: [
      {
        ...base.cenas[0],
        id: "cena-1",
        nome: "c",
        larguraM: 60,
        alturaM: 45,
        grid: { quadradoM: 1.5, visivel: true },
        mapa: { assetHash: manifesto.hash, pxPorQuadrado: 70 },
      },
    ],
    assets: Object.values(metas),
  };
  return { estado, metas };
}

function intencao(tipo: string, dados: object): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `id-${Math.random()}`, tipo, dados });
}

describe("assetVisivelPara", () => {
  it("o mestre vê tudo o que existe; asset inexistente ninguém vê", async () => {
    const { estado, metas } = await cenario();
    for (const m of Object.values(metas))
      expect(assetVisivelPara(m.hash, estado, mestre)).toBe(true);
    expect(assetVisivelPara("0".repeat(64), estado, mestre)).toBe(false);
    expect(assetVisivelPara("0".repeat(64), estado, j1)).toBe(false);
  });

  it("o jogador vê a imagem de token visível, o mapa da cena ativa, os tiles dele e o que é dele", async () => {
    const { estado, metas } = await cenario();
    expect(assetVisivelPara(metas.imgJ1.hash, estado, j2)).toBe(true); // token visível
    expect(assetVisivelPara(metas.manifesto.hash, estado, j2)).toBe(true); // mapa da cena ativa
    expect(assetVisivelPara(metas.tileA.hash, estado, j2)).toBe(true); // tile do mapa
    expect(assetVisivelPara(metas.tileB.hash, estado, j1)).toBe(true);
    expect(assetVisivelPara(metas.imgDoJ2.hash, estado, j2)).toBe(true); // é dele
  });

  it("o jogador não vê imagem de token oculto ou da camada do mestre, nem mapa fora da cena, nem de outro", async () => {
    const { estado, metas } = await cenario();
    expect(assetVisivelPara(metas.imgOculto.hash, estado, j1)).toBe(false);
    expect(assetVisivelPara(metas.imgMestre.hash, estado, j1)).toBe(false);
    expect(assetVisivelPara(metas.outroMapa.hash, estado, j1)).toBe(false);
    expect(assetVisivelPara(metas.imgDoJ2.hash, estado, j1)).toBe(false);
    expect(assetVisivelPara(metas.imgJ1.hash, estado, { id: "a", papel: "assistente" })).toBe(
      false,
    );
  });

  it("o goblin revelado passa a ter a imagem visível; o mapa trocado esconde o antigo", async () => {
    const { estado, metas } = await cenario();
    const revelado = {
      ...estado,
      tokens: estado.tokens.map((t) => (t.id === "goblin" ? { ...t, oculto: false } : t)),
    };
    expect(assetVisivelPara(metas.imgOculto.hash, revelado, j1)).toBe(true);
    const outro = {
      ...estado,
      cenas: estado.cenas.map((c) => ({
        ...c,
        mapa: { assetHash: metas.outroMapa.hash, pxPorQuadrado: 70 },
      })),
    };
    expect(assetVisivelPara(metas.tileA.hash, outro, j1)).toBe(false);
    expect(assetVisivelPara(metas.outroMapa.hash, outro, j1)).toBe(true);
  });

  it("o snapshot nunca leva as metas para o jogador (nem as do mestre; ele as recebe)", async () => {
    const { estado } = await cenario();
    expect(visaoPara(estado, j1).assets).toBeUndefined();
    expect(visaoPara(estado, mestre).assets).toHaveLength(estado.assets?.length ?? -1);
    const textoDoJogador = JSON.stringify(visaoPara(estado, j1));
    for (const a of estado.assets ?? []) {
      // só o hash de imagem de token visível pode aparecer (vai junto com o token)
      const aparece = textoDoJogador.includes(a.hash);
      expect(aparece).toBe(
        a.hash === estado.tokens[0]?.assetHash || a.hash === estado.cenas[0]?.mapa?.assetHash,
      );
    }
  });
});

describe("intenções de asset", () => {
  it("jogador registra token, mas não mapa nem tile; o dono é sempre quem mandou", async () => {
    const { estado } = await cenario();
    const m = await metaDeArquivo("token", bytes(200, 90), { nomeOriginal: "meu.png" });
    const r = processar(estado, "j1", intencao("asset.registrar", { metas: [m] }), AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estado.assets?.find((a) => a.hash === m.hash)?.donoId).toBe("j1");
    expect(r.eventos.map((e) => e.tipo)).toEqual(["asset.registrado"]);

    const mapa = await metaDeArquivo("mapa", bytes(200, 91));
    const recusa = processar(estado, "j1", intencao("asset.registrar", { metas: [mapa] }), AGORA);
    expect(recusa.ok ? "" : recusa.erro.codigo).toBe("sem_permissao");
  });

  it("registrar de novo um hash que existe não muda dono nem gera evento", async () => {
    const { estado, metas } = await cenario();
    const { donoId: _d, ...igual } = metas.imgOculto;
    const r = processar(estado, "j2", intencao("asset.registrar", { metas: [igual] }), AGORA);
    expect(r.ok && r.eventos).toEqual([]);
    expect(r.ok && r.estado.assets?.find((a) => a.hash === igual.hash)?.donoId).toBe("m");
  });

  it("manifesto exige os tiles registrados (antes ou no mesmo lote)", async () => {
    const base = estadoInicial({ usuarios: usuarios() });
    const t = await metaDeArquivo("tile", bytes(100, 50), { largura: 100, altura: 100 });
    const man = await montarManifestoDeMapa({
      largura: 100,
      altura: 100,
      nomeOriginal: "m.png",
      mime: "image/webp",
      tiles: [{ hash: t.hash, x: 0, y: 0, largura: 100, altura: 100 }],
    });
    const sozinho = processar(base, "m", intencao("asset.registrar", { metas: [man] }), AGORA);
    expect(sozinho.ok ? "" : sozinho.erro.codigo).toBe("dados_invalidos");
    const junto = processar(base, "m", intencao("asset.registrar", { metas: [t, man] }), AGORA);
    expect(junto.ok && junto.eventos).toHaveLength(2);
  });

  it("recusa meta fora dos limites", async () => {
    const { estado } = await cenario();
    const m = await metaDeArquivo("token", bytes(100, 60));
    const r = processar(
      estado,
      "j1",
      intencao("asset.registrar", { metas: [{ ...m, bytes: TAMANHO_PEDACO * 3 }] }),
      AGORA,
    );
    expect(r.ok ? "" : r.erro.codigo).toBe("dados_invalidos");
  });

  it("sem asset.subir o jogador não registra nem troca a imagem; vaivém de arquivos não exige capacidade", async () => {
    const { estado, metas } = await cenario();
    const sem = {
      ...estado,
      permissoes: { ...estado.permissoes, porUsuario: { j1: { "asset.subir": false } } },
    };
    const m = await metaDeArquivo("token", bytes(100, 61));
    expect(processar(sem, "j1", intencao("asset.registrar", { metas: [m] }), AGORA).ok).toBe(false);
    const troca = processar(
      sem,
      "j1",
      intencao("token.definirImagem", { id: "t-j1", assetHash: null }),
      AGORA,
    );
    expect(troca.ok ? "" : troca.erro.codigo).toBe("sem_permissao");
    for (const [tipo, dados] of [
      ["asset.pedir", { hash: metas.tileA.hash }],
      ["asset.inventario", { hashes: [] }],
      ["asset.tenho", { hash: metas.tileA.hash }],
      ["asset.naoTenho", { hash: metas.tileA.hash }],
    ] as const) {
      const r = processar(sem, "j1", intencao(tipo, dados), AGORA);
      expect(r.ok && r.eventos).toEqual([]);
    }
    const assistente = processar(
      estado,
      "a",
      intencao("asset.pedir", { hash: metas.tileA.hash }),
      AGORA,
    );
    expect(assistente.ok).toBe(false);
  });

  it("cena.definirMapa: só o mestre; a cena ganha o tamanho do mapa (px ÷ pxPorQuadrado × quadradoM)", async () => {
    const { estado, metas } = await cenario();
    const dados = { assetHash: metas.outroMapa.hash, pxPorQuadrado: 50 };
    const recusa = processar(estado, "j1", intencao("cena.definirMapa", dados), AGORA);
    expect(recusa.ok ? "" : recusa.erro.codigo).toBe("sem_permissao");
    const r = processar(estado, "m", intencao("cena.definirMapa", dados), AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cena = r.estado.cenas[0];
    expect(cena?.mapa).toEqual({ assetHash: metas.outroMapa.hash, pxPorQuadrado: 50 });
    expect(cena?.larguraM).toBeCloseTo((1000 / 50) * 1.5);
    expect(cena?.alturaM).toBeCloseTo((800 / 50) * 1.5);
    // o padrão é 70 px por quadrado; hash que não é mapa ou não existe: asset_inexistente
    const padrao = processar(
      estado,
      "m",
      intencao("cena.definirMapa", { assetHash: metas.outroMapa.hash }),
      AGORA,
    );
    expect(padrao.ok && padrao.estado.cenas[0]?.mapa?.pxPorQuadrado).toBe(70);
    for (const hash of [metas.imgJ1.hash, "f".repeat(64)]) {
      const e = processar(estado, "m", intencao("cena.definirMapa", { assetHash: hash }), AGORA);
      expect(e.ok ? "" : e.erro.codigo).toBe("asset_inexistente");
    }
  });

  it("tirar o mapa mantém o tamanho; mudar o quadrado com mapa muda o tamanho da cena", async () => {
    const { estado } = await cenario();
    const sem = processar(estado, "m", intencao("cena.definirMapa", { assetHash: null }), AGORA);
    expect(sem.ok && sem.estado.cenas[0]?.mapa).toBeUndefined();
    expect(sem.ok && sem.estado.cenas[0]?.larguraM).toBe(60);
    const grid = processar(estado, "m", intencao("cena.configurarGrid", { quadradoM: 3 }), AGORA);
    // mapa 200 x 100 px a 70 px/quadrado, quadrado de 3 m
    expect(grid.ok && grid.estado.cenas[0]?.larguraM).toBeCloseTo((200 / 70) * 3);
    expect(grid.ok && grid.estado.cenas[0]?.alturaM).toBeCloseTo((100 / 70) * 3);
  });

  it("jogador põe imagem registrada no próprio token; o mestre em qualquer um", async () => {
    const { estado, metas } = await cenario();
    const m = await metaDeArquivo("token", bytes(200, 70));
    const a = processar(estado, "j1", intencao("asset.registrar", { metas: [m] }), AGORA);
    if (!a.ok) throw new Error("registro");
    const r = processar(
      a.estado,
      "j1",
      intencao("token.definirImagem", { id: "t-j1", assetHash: m.hash }),
      AGORA,
    );
    expect(r.ok && r.estado.tokens.find((t) => t.id === "t-j1")?.assetHash).toBe(m.hash);
    expect(r.ok && r.eventos.map((e) => e.tipo)).toEqual(["token.editado"]);
    // o mesmo arquivo que outro jogador registrou antes (mesma arte, mesmo hash) também serve
    const mesmaArte = processar(
      estado,
      "j1",
      intencao("token.definirImagem", { id: "t-j1", assetHash: metas.imgDoJ2.hash }),
      AGORA,
    );
    expect(mesmaArte.ok && mesmaArte.estado.tokens.find((t) => t.id === "t-j1")?.assetHash).toBe(
      metas.imgDoJ2.hash,
    );
    // asset que não existe, token que não controla, token invisível: sem revelar nada
    const inexistente = processar(
      estado,
      "j1",
      intencao("token.definirImagem", { id: "t-j1", assetHash: "e".repeat(64) }),
      AGORA,
    );
    expect(inexistente.ok ? "" : inexistente.erro.codigo).toBe("asset_inexistente");
    const alheio = processar(
      a.estado,
      "j2",
      intencao("token.definirImagem", { id: "t-j1", assetHash: metas.imgDoJ2.hash }),
      AGORA,
    );
    expect(alheio.ok ? "" : alheio.erro.codigo).toBe("sem_permissao");
    const oculto = processar(
      a.estado,
      "j1",
      intencao("token.definirImagem", { id: "goblin", assetHash: m.hash }),
      AGORA,
    );
    expect(oculto.ok ? "" : oculto.erro.codigo).toBe("token_inexistente");
    const mestreMexe = processar(
      estado,
      "m",
      intencao("token.definirImagem", { id: "goblin", assetHash: metas.imgJ1.hash }),
      AGORA,
    );
    expect(
      mestreMexe.ok && mestreMexe.estado.tokens.find((t) => t.id === "goblin")?.assetHash,
    ).toBe(metas.imgJ1.hash);
    const tira = processar(
      estado,
      "j1",
      intencao("token.definirImagem", { id: "t-j1", assetHash: null }),
      AGORA,
    );
    expect(tira.ok && tira.estado.tokens.find((t) => t.id === "t-j1")?.assetHash).toBeUndefined();
  });

  it("o mestre também define a imagem por token.editar e token.criar; mapa não serve de imagem", async () => {
    const { estado, metas } = await cenario();
    const edita = processar(
      estado,
      "m",
      intencao("token.editar", { id: "t-j1", mudancas: { assetHash: metas.imgOculto.hash } }),
      AGORA,
    );
    expect(edita.ok && edita.estado.tokens.find((t) => t.id === "t-j1")?.assetHash).toBe(
      metas.imgOculto.hash,
    );
    const tira = processar(
      estado,
      "m",
      intencao("token.editar", { id: "t-j1", mudancas: { assetHash: null } }),
      AGORA,
    );
    expect(tira.ok && tira.estado.tokens.find((t) => t.id === "t-j1")?.assetHash).toBeUndefined();
    const mapa = processar(
      estado,
      "m",
      intencao("token.editar", { id: "t-j1", mudancas: { assetHash: metas.outroMapa.hash } }),
      AGORA,
    );
    expect(mapa.ok ? "" : mapa.erro.codigo).toBe("asset_inexistente");
    const cria = processar(
      estado,
      "m",
      intencao("token.criar", {
        token: { ...token("novo"), cenaId: undefined, assetHash: metas.imgJ1.hash },
      }),
      AGORA,
    );
    expect(cria.ok && cria.estado.tokens.find((t) => t.id === "novo")?.assetHash).toBe(
      metas.imgJ1.hash,
    );
    const semAsset = processar(
      estado,
      "m",
      intencao("token.criar", {
        token: { ...token("novo2"), cenaId: undefined, assetHash: "d".repeat(64) },
      }),
      AGORA,
    );
    expect(semAsset.ok ? "" : semAsset.erro.codigo).toBe("asset_inexistente");
  });

  it("a imagem posta num token oculto não chega ao jogador (nem como evento); no visível chega com o token", async () => {
    const { estado, metas } = await cenario();
    const pelaSala = (id: string, hash: string) => {
      const r = processar(
        estado,
        "m",
        intencao("token.definirImagem", { id, assetHash: hash }),
        AGORA,
      );
      if (!r.ok) throw new Error("falhou");
      return r.eventos.map((e) => eventoPara(e, j1, estado, r.estado));
    };
    expect(pelaSala("goblin", metas.imgJ1.hash)).toEqual([null]);
    expect(pelaSala("marcador", metas.imgJ1.hash)).toEqual([null]);
    const visivel = pelaSala("t-j1", metas.imgOculto.hash);
    expect(JSON.stringify(visivel)).toContain(metas.imgOculto.hash);
  });
});

describe("exportação v3", () => {
  it("leva as metas dos assets usados (e dos tiles deles), nunca dos não usados, e volta igual", async () => {
    const { estado, metas } = await cenario();
    const x = criarExportacao(estado, AGORA);
    expect(x.versao).toBe(3);
    const hashes = x.dados.assets.map((a) => a.hash).sort();
    expect(hashes).toEqual(
      [metas.imgJ1, metas.imgOculto, metas.imgMestre, metas.tileA, metas.tileB, metas.manifesto]
        .map((a) => a.hash)
        .sort(),
    );
    expect(hashesUsados(estado).has(metas.outroMapa.hash)).toBe(false);
    const texto = JSON.stringify(x);
    const lida = lerExportacao(JSON.parse(texto));
    expect(lida.ok && lida.exportacao.dados).toEqual(x.dados);
    // só metadados: nenhum campo carrega bytes
    expect(texto.length).toBeLessThan(20_000);
  });

  it("recusa referência a asset sem meta, hashes repetidos e tile sem meta", async () => {
    const { estado } = await cenario();
    const x = criarExportacao(estado, AGORA);
    const sem = (filtro: (a: AssetMeta) => boolean) =>
      lerExportacao({ ...x, dados: { ...x.dados, assets: x.dados.assets.filter(filtro) } }).ok;
    expect(sem(() => true)).toBe(true);
    expect(sem((a) => a.tipo !== "token")).toBe(false); // token cita imagem sem meta
    expect(sem((a) => a.tipo !== "tile")).toBe(false); // manifesto cita tile sem meta
    expect(sem((a) => a.tipo !== "mapa")).toBe(false); // cena cita mapa sem meta
    const repetido = {
      ...x,
      dados: { ...x.dados, assets: [...x.dados.assets, ...x.dados.assets] },
    };
    expect(lerExportacao(repetido).ok).toBe(false);
  });

  it("importa v1 e v2 (sem assets) e mantém a v3 com mapa e imagens", async () => {
    const { estado } = await cenario();
    const v3 = criarExportacao(estado, AGORA);
    const { assets: _a, ...dadosV2 } = v3.dados;
    const v2 = {
      ...v3,
      versao: 2,
      dados: {
        ...dadosV2,
        cenas: dadosV2.cenas.map(({ mapa: _m, ...c }) => c),
        tokens: dadosV2.tokens.map(({ assetHash: _h, ...t }) => t),
      },
    };
    const lidaV2 = lerExportacao(v2);
    expect(lidaV2.ok && lidaV2.exportacao.versao).toBe(3);
    expect(lidaV2.ok && lidaV2.exportacao.dados.assets).toEqual([]);
    const { cenas: _c, cenaAtivaId: _i, tokens: _t, ...dadosV1 } = v2.dados;
    const lidaV1 = lerExportacao({ ...v2, versao: 1, dados: dadosV1 });
    expect(lidaV1.ok && lidaV1.exportacao.dados.assets).toEqual([]);
    const importa = processar(
      estado,
      "m",
      intencao("campanha.importar", { dados: JSON.parse(JSON.stringify(v3)) }),
      AGORA,
    );
    expect(importa.ok && importa.estado.cenas[0]?.mapa?.assetHash).toBe(
      estado.cenas[0]?.mapa?.assetHash,
    );
    expect(
      importa.ok && importa.estado.tokens.find((t) => t.id === "t-j1")?.assetHash,
    ).toBeDefined();
    expect(importa.ok && importa.estado.assets).toHaveLength(6);
  });
});
