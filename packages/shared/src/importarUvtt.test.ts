import { describe, expect, it } from "vitest";
import {
  type AssetMeta,
  base64ParaBytes,
  contagemDaImportacao,
  converterUvtt,
  corDoUvtt,
  type DadosUvtt,
  desfazerPassos,
  detectarFormato,
  diffDoEstado,
  type Estado,
  ehArquivoUniversalVtt,
  estadoInicial,
  ImportacaoDeMapaSchema,
  type Intencao,
  IntencaoSchema,
  LIMITES_DA_IMPORTACAO,
  lerUniversalVtt,
  negarEnvio,
  nomeDaCenaDoArquivo,
  processar,
  resumoDaImportacao,
  usoDoArquivo,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const HASH = "a".repeat(64);

function arquivo(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: 0.3,
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: 30, y: 20 },
      pixels_per_grid: 256,
    },
    line_of_sight: [
      [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 4 },
      ],
    ],
    objects_line_of_sight: [
      [
        { x: 8, y: 8 },
        { x: 9, y: 8 },
      ],
    ],
    portals: [
      {
        position: { x: 3, y: 1 },
        bounds: [
          { x: 2.5, y: 1 },
          { x: 3.5, y: 1 },
        ],
        rotation: 0,
        closed: true,
        freestanding: false,
      },
    ],
    environment: { baked_lighting: true, ambient_light: "ffffffff" },
    lights: [
      { position: { x: 4, y: 3 }, range: 6, intensity: 1, color: "ffeccd8b", shadows: true },
    ],
    image: "iVBORw0KGgo=",
    ...extra,
  });
}

function lido(texto: string): DadosUvtt {
  const r = lerUniversalVtt(texto);
  if (!r.ok) throw new Error(r.motivo);
  return r.dados;
}

describe("ler o Universal VTT", () => {
  it("lê paredes, objetos, portas, luzes, ambiente e a grade", () => {
    const d = lido(arquivo());
    expect(d.pxPorQuadrado).toBe(256);
    expect(d.quadradosX).toBe(30);
    expect(d.quadradosY).toBe(20);
    expect(d.paredes).toEqual([
      [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 4 },
      ],
    ]);
    expect(d.paredesDeObjetos).toHaveLength(1);
    expect(d.portas).toEqual([{ a: { x: 2.5, y: 1 }, b: { x: 3.5, y: 1 }, fechada: true }]);
    expect(d.luzes).toEqual([{ x: 4, y: 3, alcance: 6, intensidade: 1, cor: "#eccd8b" }]);
    expect(d.luzCozida).toBe(true);
    expect(d.corAmbiente).toBe("#ffffff");
    expect(d.imagemBase64).toBe("iVBORw0KGgo=");
  });

  it("desconta a origem do mapa, em tudo", () => {
    const d = lido(
      arquivo({
        resolution: {
          map_origin: { x: 2, y: 3 },
          map_size: { x: 30, y: 20 },
          pixels_per_grid: 100,
        },
      }),
    );
    expect(d.paredes[0]?.[0]).toEqual({ x: -1, y: -2 });
    expect(d.portas[0]?.a).toEqual({ x: 0.5, y: -2 });
    expect(d.luzes[0]).toMatchObject({ x: 2, y: 0 });
  });

  it("aceita a imagem com o prefixo data: e com quebras de linha", () => {
    expect(lido(arquivo({ image: "data:image/png;base64,iVBO\nRw0KGgo=" })).imagemBase64).toBe(
      "iVBORw0KGgo=",
    );
  });

  it("é tolerante: sem paredes, portas, luzes, ambiente nem imagem, e pontos quebrados", () => {
    const d = lido(
      JSON.stringify({
        resolution: { pixels_per_grid: 70 },
        line_of_sight: [
          [{ x: 1 }, { x: 2, y: 2 }],
          "lixo",
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        ],
        portals: [{}, { position: { x: 1, y: 1 }, rotation: Math.PI / 2, closed: false }],
        lights: [{ range: 3 }, { position: { x: 1, y: 1 } }],
      }),
    );
    expect(d.paredes).toEqual([
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    ]);
    // Sem `bounds`: meio quadrado para cada lado da posição, na direção da rotação.
    expect(d.portas).toHaveLength(1);
    expect(d.portas[0]?.fechada).toBe(false);
    expect(d.portas[0]?.a.x).toBeCloseTo(1, 5);
    expect(d.portas[0]?.a.y).toBeCloseTo(0.5, 5);
    expect(d.luzes).toEqual([{ x: 1, y: 1, alcance: 0, intensidade: 1, cor: "#ffffff" }]);
    expect(d.imagemBase64).toBeNull();
    expect(d.luzCozida).toBe(true);
  });

  it("sem pixels_per_grid usa 70 e avisa; fora de 10 a 1000 recusa", () => {
    const d = lido("{}");
    expect(d.pxPorQuadrado).toBe(70);
    expect(d.avisos.join(" ")).toMatch(/70/);
    const r = lerUniversalVtt(JSON.stringify({ resolution: { pixels_per_grid: 5 } }));
    expect(r.ok).toBe(false);
  });

  it("recusa o que não é JSON nem objeto", () => {
    expect(lerUniversalVtt("isto não é json").ok).toBe(false);
    expect(lerUniversalVtt("[1,2]").ok).toBe(false);
  });

  it("reconhece a cor ARGB, RGB e com #", () => {
    expect(corDoUvtt("ffeccd8b")).toBe("#eccd8b");
    expect(corDoUvtt("ECCD8B")).toBe("#eccd8b");
    expect(corDoUvtt("#112233")).toBe("#112233");
    expect(corDoUvtt("azul")).toBeNull();
    expect(corDoUvtt(12)).toBeNull();
  });

  it("o arquivo é detectado como json pelos primeiros bytes", () => {
    expect(detectarFormato(new TextEncoder().encode(arquivo()))?.familia).toBe("json");
  });

  it("reconhece a extensão e dá o nome da cena", () => {
    expect(ehArquivoUniversalVtt("Cripta.DD2VTT")).toBe(true);
    expect(ehArquivoUniversalVtt("a.uvtt")).toBe(true);
    expect(ehArquivoUniversalVtt("a.df2vtt")).toBe(true);
    expect(ehArquivoUniversalVtt("a.png")).toBe(false);
    expect(nomeDaCenaDoArquivo("C:\\mapas\\Cripta do Rei.dd2vtt")).toBe("Cripta do Rei");
    expect(nomeDaCenaDoArquivo(".dd2vtt")).toBe("Mapa importado");
    expect(nomeDaCenaDoArquivo(`${"x".repeat(100)}.uvtt`)).toHaveLength(64);
  });
});

describe("decodificar a imagem aos pedaços", () => {
  it("volta os mesmos bytes, com e sem o preenchimento", () => {
    const bytes = Uint8Array.from({ length: 1000 }, (_, i) => (i * 7) % 256);
    const b64 = Buffer.from(bytes).toString("base64");
    expect(base64ParaBytes(b64)).toEqual(bytes);
    expect(base64ParaBytes(b64.replace(/=+$/, ""))).toEqual(bytes);
    expect(base64ParaBytes("a")).toBeNull();
    expect(base64ParaBytes("@@@@")).toBeNull();
  });

  it("um arquivo grande (24 MB de imagem) decodifica rápido e sem erro", () => {
    const grande = new Uint8Array(24 * 1024 * 1024);
    for (let i = 0; i < grande.length; i += 4099) grande[i] = i % 251;
    const b64 = Buffer.from(grande).toString("base64");
    const t0 = performance.now();
    const volta = base64ParaBytes(b64);
    const ms = performance.now() - t0;
    expect(volta?.length).toBe(grande.length);
    expect(volta?.[4099]).toBe(grande[4099]);
    // Folga grande: a medida real fica em centenas de ms (relatório do Q3).
    expect(ms).toBeLessThan(8000);
  });
});

describe("converter para a Távola", () => {
  const como = { id: "cena-x", nome: "Cripta" };

  it("quadrados viram metros (1,5 m), a porta fica fechada e a luz vira fonte fixa", () => {
    const { importacao: i } = converterUvtt(lido(arquivo()), como);
    expect(ImportacaoDeMapaSchema.safeParse(i).success).toBe(true);
    expect(i.pxPorQuadrado).toBe(256);
    const porta = i.paredes.find((p) => p.tipo === "porta");
    expect(porta).toMatchObject({
      a: { x: 3.75, y: 1.5 },
      b: { x: 5.25, y: 1.5 },
      estado: "fechada",
    });
    // 2 trechos da linha + 1 do objeto + 1 porta; nada de parede sob a porta.
    expect(i.paredes).toHaveLength(4);
    expect(i.paredes.filter((p) => p.tipo === "parede")).toHaveLength(3);
    expect(i.fontes).toEqual([
      {
        id: "cena-x-l1",
        nome: "Luz 1",
        portador: { tipo: "cena", x: 6, y: 4.5 },
        luz: { claraM: 4.5, penumbraM: 4.5, cor: "#eccd8b", tremula: false },
        intensidade: 1,
        estado: "acesa",
      },
    ]);
    expect(i.luzAmbiente).toBeUndefined();
    expect(contagemDaImportacao(i)).toEqual({ paredes: 3, portas: 1, luzes: 1 });
    expect(resumoDaImportacao(i)).toBe("Cena criada: 1 mapa, 3 paredes, 1 porta, 1 luz.");
  });

  it("a porta aberta no arquivo entra aberta; o trecho de parede sob a porta é ignorado e avisado", () => {
    const d = lido(
      arquivo({
        line_of_sight: [
          [
            { x: 0, y: 1 },
            { x: 2.5, y: 1 },
            { x: 3, y: 1 },
            { x: 3.5, y: 1 },
            { x: 6, y: 1 },
          ],
        ],
        portals: [
          {
            position: { x: 3, y: 1 },
            bounds: [
              { x: 2.5, y: 1 },
              { x: 3.5, y: 1 },
            ],
            closed: false,
          },
        ],
      }),
    );
    const { importacao: i } = converterUvtt(d, como);
    expect(i.paredes.find((p) => p.tipo === "porta")?.estado).toBe("aberta");
    // Os dois trechos de 0,5 que ficam sob a porta saem; sobram 0..2,5 e 3,5..6 (e o do objeto).
    expect(i.paredes.filter((p) => p.tipo === "parede")).toHaveLength(3);
    expect(i.avisos?.join(" ")).toMatch(/2 trechos de parede cobertos por portas/);
  });

  it("não repete segmento (nem o invertido) nem cria parede sem comprimento", () => {
    const d = lido(
      arquivo({
        line_of_sight: [
          [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 1 },
          ],
        ],
        objects_line_of_sight: [],
        portals: [],
      }),
    );
    expect(converterUvtt(d, como).importacao.paredes).toHaveLength(1);
  });

  it("luz: intensidade limitada a 0..1, alcance 0 avisado, e mapa sem luz cozida escurece", () => {
    const d = lido(
      arquivo({
        lights: [
          { position: { x: 1, y: 1 }, range: 2, intensity: 3, color: "ff0000ff" },
          { position: { x: 2, y: 2 }, range: 0, intensity: -1 },
        ],
        environment: { baked_lighting: false, ambient_light: "ff404040" },
      }),
    );
    const { importacao: i } = converterUvtt(d, como);
    expect(i.fontes.map((f) => f.intensidade)).toEqual([1, 0]);
    expect(i.fontes[0]?.luz.cor).toBe("#0000ff");
    expect(i.avisos?.join(" ")).toMatch(/sem alcance/);
    expect(i.luzAmbiente).toBeCloseTo(0.25, 2);
  });

  it("luz cozida é dia: sem o campo luzAmbiente", () => {
    const d = lido(arquivo({ environment: { baked_lighting: true, ambient_light: "ff000000" } }));
    expect(converterUvtt(d, como).importacao.luzAmbiente).toBeUndefined();
  });

  it("os limites: entra o que cabe, portas primeiro, e o aviso diz o resto", () => {
    const linha = Array.from({ length: LIMITES_DA_IMPORTACAO.paredes + 501 }, (_, i) => ({
      x: i,
      y: i % 2,
    }));
    const luzes = Array.from({ length: LIMITES_DA_IMPORTACAO.luzes + 50 }, (_, i) => ({
      position: { x: i, y: 1 },
      range: 4,
      intensity: 1,
      color: "ffffffff",
    }));
    const { importacao: i } = converterUvtt(
      lido(arquivo({ line_of_sight: [linha], objects_line_of_sight: [], lights: luzes })),
      como,
    );
    expect(i.paredes).toHaveLength(LIMITES_DA_IMPORTACAO.paredes);
    expect(i.paredes[0]?.tipo).toBe("porta");
    expect(i.fontes).toHaveLength(LIMITES_DA_IMPORTACAO.luzes);
    expect(i.avisos?.some((a) => /primeiras 3000/.test(a))).toBe(true);
    expect(i.avisos?.some((a) => /primeiras 200./.test(a))).toBe(true);
    expect(ImportacaoDeMapaSchema.safeParse(i).success).toBe(true);
  });
});

// --- A sala ---------------------------------------------------------------------------------

const MAPA: AssetMeta = {
  hash: HASH,
  tipo: "mapa",
  mime: "image/webp",
  bytes: 0,
  largura: 7680,
  altura: 5120,
  donoId: "m",
  nomeOriginal: "cripta.png",
  pedacos: [],
};

function criarEstado(): Estado {
  return {
    ...estadoInicial({
      usuarios: [
        { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
        { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      ],
      cenas: [
        {
          id: "c1",
          nome: "Sala",
          larguraM: 30,
          alturaM: 30,
          grid: { quadradoM: 1.5, visivel: true },
        },
      ],
      cenaAtivaId: "c1",
      tokens: [],
    }),
    assets: [MAPA],
  };
}

let contador = 0;
const pedido = (dados: object): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `q3-${++contador}`, tipo: "cena.importarMapa", dados });

function dadosDaImportacao() {
  const { importacao } = converterUvtt(lido(arquivo()), { id: "cena-uvtt", nome: "Cripta" });
  return { ...importacao, assetHash: HASH };
}

describe("cena.importarMapa na sala", () => {
  it("cria a cena com o mapa no tamanho certo, as paredes, a porta e a luz, sem mover o grupo", () => {
    const r = processar(criarEstado(), "m", pedido(dadosDaImportacao()), AGORA);
    if (!r.ok) throw new Error(r.erro.mensagem);
    const e = r.estado;
    const cena = e.cenas.find((c) => c.id === "cena-uvtt");
    // 7680 px / 256 px por quadrado = 30 quadrados x 1,5 m = 45 m; 5120 / 256 = 20 quadrados = 30 m.
    expect(cena).toMatchObject({
      nome: "Cripta",
      larguraM: 45,
      alturaM: 30,
      mapa: { assetHash: HASH, pxPorQuadrado: 256 },
      grid: { quadradoM: 1.5, visivel: true },
    });
    expect(e.cenaAtivaId).toBe("c1");
    const paredes = e.paredes.filter((p) => p.cenaId === "cena-uvtt");
    expect(paredes).toHaveLength(4);
    expect(paredes.find((p) => p.tipo === "porta")?.estado).toBe("fechada");
    const luzes = e.luzes.filter((l) => l.cenaId === "cena-uvtt");
    expect(luzes).toHaveLength(1);
    expect(luzes[0]?.portador).toEqual({ tipo: "cena", x: 6, y: 4.5 });
  });

  it("a luz ambiente vai para a cena, e o jogador não cria cena", () => {
    const dados = { ...dadosDaImportacao(), luzAmbiente: 0.3 };
    const r = processar(criarEstado(), "m", pedido(dados), AGORA);
    if (!r.ok) throw new Error(r.erro.mensagem);
    expect(r.estado.cenas.find((c) => c.id === "cena-uvtt")?.luzAmbiente).toBe(0.3);
    const negado = processar(criarEstado(), "j1", pedido(dadosDaImportacao()), AGORA);
    expect(negado.ok).toBe(false);
    if (!negado.ok) expect(negado.erro.codigo).toBe("sem_permissao");
  });

  it("recusa mapa que não existe, id repetido e mapa grande demais", () => {
    const semMapa = processar(
      criarEstado(),
      "m",
      pedido({ ...dadosDaImportacao(), assetHash: "b".repeat(64) }),
      AGORA,
    );
    expect(semMapa.ok).toBe(false);
    const repetida = processar(
      criarEstado(),
      "m",
      pedido({ ...dadosDaImportacao(), id: "c1" }),
      AGORA,
    );
    expect(repetida.ok).toBe(false);
    // 7680 px a 10 px por quadrado = 768 quadrados = 1152 m: passa de 1000 m.
    const grande = processar(
      criarEstado(),
      "m",
      pedido({ ...dadosDaImportacao(), pxPorQuadrado: 10 }),
      AGORA,
    );
    expect(grande.ok).toBe(false);
  });

  it("parede fora do mapa é encostada na borda; a que fica sem comprimento sai", () => {
    const dados = {
      ...dadosDaImportacao(),
      paredes: [
        { id: "w1", a: { x: -5, y: 1 }, b: { x: 3, y: 1 }, tipo: "parede" },
        { id: "w2", a: { x: 100, y: 1 }, b: { x: 200, y: 5 }, tipo: "parede" },
      ],
    };
    const r = processar(criarEstado(), "m", pedido(dados), AGORA);
    if (!r.ok) throw new Error(r.erro.mensagem);
    const doMapa = r.estado.paredes.filter((p) => p.cenaId === "cena-uvtt");
    expect(doMapa).toHaveLength(2);
    expect(doMapa[0]?.a.x).toBe(0);
    expect(doMapa[1]?.a.x).toBe(45);
  });

  it("o Desfazer apaga a cena criada com as paredes e as luzes, num passo só", () => {
    const antes = criarEstado();
    const r = processar(antes, "m", pedido(dadosDaImportacao()), AGORA);
    if (!r.ok) throw new Error(r.erro.mensagem);
    const passo = diffDoEstado(antes, r.estado);
    expect(passo.some((d) => d.c === "cenas" && d.id === "cena-uvtt")).toBe(true);
    const volta = desfazerPassos(r.estado, [passo], { usuarioId: "m", idPedido: "d1" });
    expect(volta.pulados).toEqual([]);
    expect(volta.estado.cenas.map((c) => c.id)).toEqual(["c1"]);
    expect(volta.estado.paredes.filter((p) => p.cenaId === "cena-uvtt")).toHaveLength(0);
    expect(volta.estado.luzes.filter((l) => l.cenaId === "cena-uvtt")).toHaveLength(0);
  });

  it("a parede da cena importada bloqueia a visão (a porta fechada também)", () => {
    const r = processar(criarEstado(), "m", pedido(dadosDaImportacao()), AGORA);
    if (!r.ok) throw new Error(r.erro.mensagem);
    const porta = r.estado.paredes.find((p) => p.tipo === "porta");
    expect(porta?.estado).toBe("fechada");
    const aberta = processar(
      r.estado,
      "m",
      IntencaoSchema.parse({
        v: 1,
        id: `q3-${++contador}`,
        tipo: "porta.alternar",
        dados: { id: porta?.id },
      }),
      AGORA,
    );
    if (!aberta.ok) throw new Error(aberta.erro.mensagem);
    expect(aberta.estado.paredes.find((p) => p.id === porta?.id)?.estado).toBe("aberta");
  });
});

describe("o uso mapa-uvtt na caixa do Claude", () => {
  it("só o mestre; a conclusão leva a cena e a frase traz o resumo", () => {
    const e = criarEstado();
    const jogador = e.usuarios.find((u) => u.id === "j1");
    const mestre = e.usuarios.find((u) => u.id === "m");
    if (!jogador || !mestre) throw new Error("sem usuários");
    expect(negarEnvio(e, jogador, "mapa-uvtt", {}, {})).toMatch(/Só o mestre/);
    expect(negarEnvio(e, mestre, "mapa-uvtt", {}, {})).toBeNull();
    const { importacao } = converterUvtt(lido(arquivo()), { id: "cena-uvtt", nome: "Cripta" });
    const u = usoDoArquivo("mapa-uvtt", {}, HASH, MAPA, {}, { importacao });
    expect(u.ok && u.tipo).toBe("cena.importarMapa");
    expect(u.ok && u.frase).toBe("cena criada: 1 mapa, 3 paredes, 1 porta, 1 luz");
  });
});
