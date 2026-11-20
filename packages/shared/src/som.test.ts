import { describe, expect, it } from "vitest";
import {
  type AssetMeta,
  type Automacoes,
  AutomacoesSchema,
  acoesDoFluxo,
  ambientesLigados,
  assetVisivelPara,
  criarExportacao,
  desvioDoRelogio,
  type Estado,
  type EventoSala,
  efeitoChegaPara,
  estadoInicial,
  eventoPara,
  type Fluxo,
  fonteComSemente,
  hashesUsados,
  type Intencao,
  IntencaoSchema,
  LIMITES_DE_ASSET,
  lerExportacao,
  lugaresDe,
  migrarSomDoN5,
  mimeDeSomValido,
  mimeDoSomPeloNome,
  modelosPadrao,
  pontoDaTrilha,
  processar,
  type Reacao,
  ReacaoSchema,
  sonsDasZonasParaJogador,
  sonsDasZonasParaTokens,
  tocandoAgora,
  usosDoSom,
  validarMeta,
  visaoPara,
  volumeFinal,
  volumeGeralDe,
  type Zona,
  ZonaSchema,
} from "./index.ts";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (segundos: number) => new Date(T0 + segundos * 1000).toISOString();
const SEGREDO = "ZONA-SECRETA-DO-MESTRE";
const HASH_SOPRO = "a".repeat(64);
const HASH_SUSSURROS = "b".repeat(64);
const HASH_TRILHA = "c".repeat(64);
const HASH_OUTRA = "d".repeat(64);

let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `s${++contador}`, tipo, dados });

const som = (hash: string, nome: string, extra: Partial<AssetMeta> = {}): AssetMeta => ({
  hash,
  tipo: "som",
  mime: "audio/wav",
  bytes: 1000,
  largura: 1,
  altura: 1,
  donoId: "m",
  nomeOriginal: `${nome}.wav`,
  pedacos: ["e".repeat(64)],
  ...extra,
});

const QUADRADO = [
  { x: 10, y: 10 },
  { x: 20, y: 10 },
  { x: 20, y: 20 },
  { x: 10, y: 20 },
];

const zona = (parcial: Partial<Zona> = {}): Zona =>
  ZonaSchema.parse({
    id: "z1",
    cenaId: "pulmao",
    nome: SEGREDO,
    pontos: QUADRADO,
    efeitos: { som: { hash: HASH_SUSSURROS, nome: "sussurros", volume: 0.6, laco: true } },
    ...parcial,
  });

const token = (id: string, x: number, y: number, cenaId = "pulmao") => ({
  id,
  cenaId,
  nome: id,
  cor: "#0f0",
  tamanhoQuadrados: 1,
  x,
  y,
  camada: "tokens" as const,
  oculto: false,
  controladoPor: id === "t1" ? ["j1"] : id === "t3" ? ["j2"] : [],
});

function criarEstado(extra: Partial<Estado> = {}): Estado {
  return {
    ...estadoInicial(
      {
        usuarios: [
          { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
          { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
          { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
        ],
        cenas: [
          {
            id: "pulmao",
            nome: "Pulmão",
            larguraM: 40,
            alturaM: 40,
            grid: { quadradoM: 1.5, visivel: true },
          },
          {
            id: "fora",
            nome: "Fora",
            larguraM: 40,
            alturaM: 40,
            grid: { quadradoM: 1.5, visivel: true },
          },
        ],
        cenaAtivaId: "pulmao",
        modelos: modelosPadrao(),
        luzes: [],
        tokens: [token("t1", 15, 15), token("t2", 15, 15), token("t3", 5, 5)],
      },
      T0,
    ),
    assets: [
      som(HASH_SOPRO, "sopro"),
      som(HASH_SUSSURROS, "sussurros"),
      som(HASH_TRILHA, "taverna"),
    ],
    ...extra,
  };
}

function ok(estado: Estado, quem: string, i: Intencao, segundos = 0) {
  const r = processar(estado, quem, i, iso(segundos), fonteComSemente(1));
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} (${r.erro.mensagem})`);
  return r;
}
const recusado = (estado: Estado, quem: string, i: Intencao) => {
  const r = processar(estado, quem, i, iso(0), fonteComSemente(1));
  expect(r.ok).toBe(false);
  return r.ok ? null : r.erro.codigo;
};

describe("o asset de som", () => {
  it("aceita mp3, ogg e wav até 20 MB e recusa o resto", () => {
    expect(mimeDeSomValido("audio/mpeg")).toBe(true);
    expect(mimeDeSomValido("AUDIO/WAV")).toBe(true);
    expect(mimeDeSomValido("audio/flac")).toBe(false);
    expect(mimeDoSomPeloNome("Sopro.OGG")).toBe("audio/ogg");
    expect(mimeDoSomPeloNome("nota.txt")).toBeNull();
    expect(validarMeta(som(HASH_SOPRO, "x"))).toBeNull();
    expect(validarMeta(som(HASH_SOPRO, "x", { mime: "audio/flac" }))).toMatch(/mp3, ogg e wav/);
    const grande = LIMITES_DE_ASSET.bytesDoSom + 1;
    const pedacos = Array.from({ length: Math.ceil(grande / (256 * 1024)) }, () => "e".repeat(64));
    expect(validarMeta(som(HASH_SOPRO, "x", { bytes: grande, pedacos }))).toMatch(/grande demais/);
    const limite = LIMITES_DE_ASSET.bytesDoSom;
    const pedacosDoLimite = Array.from({ length: 80 }, () => "e".repeat(64));
    expect(
      validarMeta(som(HASH_SOPRO, "x", { bytes: limite, pedacos: pedacosDoLimite })),
    ).toBeNull();
  });

  it("só o mestre registra som; o jogador baixa qualquer som da mesa", () => {
    const e = criarEstado({ assets: [] });
    const meta = som(HASH_SOPRO, "sopro");
    const { donoId: _dono, ...nova } = meta;
    expect(recusado(e, "j1", intencao("asset.registrar", { metas: [nova] }))).toBe("sem_permissao");
    expect(ok(e, "m", intencao("asset.registrar", { metas: [nova] })).estado.assets).toHaveLength(
      1,
    );
    const com = criarEstado();
    expect(assetVisivelPara(HASH_SOPRO, com, { id: "j1", papel: "jogador" })).toBe(true);
  });
});

/** Um lugar completo da mesa de som. */
const lugar = (hash: string, nome: string, extra: Record<string, unknown> = {}) => ({
  hash,
  nome,
  icone: "chama",
  cor: "ambar",
  volume: 0.5,
  ...extra,
});
const poeLugar = (
  e: Estado,
  grupo: "efeito" | "ambiente",
  indice: number,
  l: ReturnType<typeof lugar> | null,
) => ok(e, "m", intencao("som.lugar", { grupo, indice, lugar: l })).estado;
const J1 = { id: "j1", papel: "jogador" as const };
const MESTRE = { id: "m", papel: "mestre" as const };

describe("a mesa de som (Q4): os 16 lugares", () => {
  it("só o mestre configura; 8 lugares por grupo, nome de até 12 letras, só som registrado", () => {
    const e = criarEstado();
    const dados = { grupo: "efeito", indice: 0, lugar: lugar(HASH_SOPRO, "Sopro") };
    expect(recusado(e, "j1", intencao("som.lugar", dados))).toBe("sem_permissao");
    const base = { v: 1, id: "x", tipo: "som.lugar" };
    const parse = (d: object) => IntencaoSchema.safeParse({ ...base, dados: d }).success;
    expect(parse({ ...dados, indice: 7 })).toBe(true);
    expect(parse({ ...dados, indice: 8 })).toBe(false);
    expect(parse({ ...dados, lugar: lugar(HASH_SOPRO, "treze letras!") })).toBe(false);
    expect(parse({ ...dados, lugar: lugar(HASH_SOPRO, "") })).toBe(false);
    expect(parse({ ...dados, lugar: lugar(HASH_SOPRO, "x", { icone: "foguete" }) })).toBe(false);
    expect(parse({ ...dados, lugar: lugar(HASH_SOPRO, "x", { cor: "rosa" }) })).toBe(false);
    expect(parse({ ...dados, lugar: lugar(HASH_SOPRO, "x", { volume: 1.5 }) })).toBe(false);
    expect(
      recusado(e, "m", intencao("som.lugar", { ...dados, lugar: lugar(HASH_OUTRA, "Nada") })),
    ).toBe("asset_inexistente");
    const com = poeLugar(e, "efeito", 0, lugar(HASH_SOPRO, "Sopro"));
    expect(lugaresDe(com.mesaDeSom).efeitos[0]?.nome).toBe("Sopro");
    expect(lugaresDe(com.mesaDeSom).efeitos).toHaveLength(8);
    expect(lugaresDe(com.mesaDeSom).ambientes.every((x) => x === null)).toBe(true);
    expect(hashesUsados(com).has(HASH_SOPRO)).toBe(true);
  });

  it("os 8 lugares dos dois grupos enchem e esvaziam; mesa vazia some do estado", () => {
    let e = criarEstado();
    const hashes = [HASH_SOPRO, HASH_SUSSURROS, HASH_TRILHA];
    for (let i = 0; i < 8; i++) {
      e = poeLugar(e, "efeito", i, lugar(hashes[i % 3] as string, `E${i}`));
      e = poeLugar(e, "ambiente", i, lugar(hashes[i % 3] as string, `A${i}`));
    }
    expect(lugaresDe(e.mesaDeSom).efeitos.filter(Boolean)).toHaveLength(8);
    expect(lugaresDe(e.mesaDeSom).ambientes.filter(Boolean)).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      e = poeLugar(e, "efeito", i, null);
      e = poeLugar(e, "ambiente", i, null);
    }
    expect(e.mesaDeSom).toBeUndefined();
  });

  it("efeito ou ambiente num lugar vazio é recusado", () => {
    const e = criarEstado();
    expect(recusado(e, "m", intencao("som.efeito", { lugar: 3 }))).toBe("dados_invalidos");
    expect(recusado(e, "m", intencao("som.ambiente", { indice: 3, ligado: true }))).toBe(
      "dados_invalidos",
    );
    expect(IntencaoSchema.safeParse({ v: 1, id: "x", tipo: "som.efeito", dados: {} }).success).toBe(
      false,
    );
  });
});

describe("os ambientes (Q4)", () => {
  const comDois = () => {
    let e = criarEstado();
    e = poeLugar(e, "ambiente", 0, lugar(HASH_TRILHA, "Taverna", { volume: 0.4 }));
    e = poeLugar(e, "ambiente", 3, lugar(HASH_SUSSURROS, "Vento", { volume: 0.7 }));
    return e;
  };

  it("dois ambientes ligam juntos, cada um com o seu volume e o seu início; desligar tira só ele", () => {
    const e = comDois();
    expect(recusado(e, "j1", intencao("som.ambiente", { indice: 0, ligado: true }))).toBe(
      "sem_permissao",
    );
    const um = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true }), 10).estado;
    const dois = ok(
      um,
      "m",
      intencao("som.ambiente", { indice: 3, ligado: true, volume: 0.2 }),
      30,
    ).estado;
    expect(ambientesLigados(dois)).toMatchObject([
      { indice: 0, hash: HASH_TRILHA, volume: 0.4, inicioMs: T0 + 10_000 },
      { indice: 3, hash: HASH_SUSSURROS, volume: 0.2, inicioMs: T0 + 30_000 },
    ]);
    // só muda o volume: o ambiente não recomeça
    const mais = ok(
      dois,
      "m",
      intencao("som.ambiente", { indice: 0, ligado: true, volume: 0.9 }),
      50,
    );
    expect(ambientesLigados(mais.estado)[0]).toMatchObject({ volume: 0.9, inicioMs: T0 + 10_000 });
    // ligar de novo no mesmo volume não muda nada
    expect(
      ok(mais.estado, "m", intencao("som.ambiente", { indice: 0, ligado: true, volume: 0.9 }))
        .eventos,
    ).toHaveLength(0);
    const sem = ok(mais.estado, "m", intencao("som.ambiente", { indice: 0, ligado: false }), 60);
    expect(ambientesLigados(sem.estado)).toMatchObject([{ indice: 3, hash: HASH_SUSSURROS }]);
    const nada = ok(sem.estado, "m", intencao("som.ambiente", { indice: 3, ligado: false })).estado;
    expect(nada.somLigado).toBeUndefined();
  });

  it("quem entra no meio recebe cada ambiente com o relógio da sala de agora (alinhamento por ambiente)", () => {
    let e = comDois();
    e = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true }), 0).estado;
    e = ok(e, "m", intencao("som.ambiente", { indice: 3, ligado: true }), 20).estado;
    const visao = visaoPara(e, J1, T0 + 95_000);
    expect(visao.somLigado?.ambientes).toMatchObject([
      { indice: 0, inicioMs: T0, servidorMs: T0 + 95_000 },
      { indice: 3, inicioMs: T0 + 20_000, servidorMs: T0 + 95_000 },
    ]);
    const agoraLocal = T0 + 93_000; // o navegador está 2 s atrás da sala
    const [a, b] = visao.somLigado?.ambientes ?? [];
    const desvio = desvioDoRelogio(a ?? { servidorMs: 0 }, agoraLocal);
    expect(desvio).toBe(2_000);
    // 95 s depois do início num arquivo de 40 s: ponto 15 s; o segundo começou 20 s depois: 75 s, num de 30 s: 15 s
    expect(pontoDaTrilha({ inicioMs: a?.inicioMs ?? 0 }, agoraLocal, desvio, 40)).toBeCloseTo(
      15,
      5,
    );
    expect(pontoDaTrilha({ inicioMs: b?.inicioMs ?? 0 }, agoraLocal, desvio, 30)).toBeCloseTo(
      15,
      5,
    );
    // sem a duração devolve o tempo corrido; nunca negativo
    expect(pontoDaTrilha({ inicioMs: T0 }, agoraLocal, desvio)).toBeCloseTo(95, 5);
    expect(pontoDaTrilha({ inicioMs: T0 + 5_000 }, T0, 0, 40)).toBe(0);
  });

  it("o evento chega a todos com o relógio refeito; a exportação leva os lugares e não leva o que toca", () => {
    const e = comDois();
    const r = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true }), 3);
    const ev = r.eventos.find((x) => x.tipo === "som.ligadoAlterado") as EventoSala;
    for (const quem of [MESTRE, J1]) {
      expect(eventoPara(ev, quem, e, r.estado, T0 + 7_000)).toMatchObject({
        tipo: "som.ligadoAlterado",
        dados: { somLigado: { ambientes: [{ hash: HASH_TRILHA, servidorMs: T0 + 7_000 }] } },
      });
    }
    const texto = JSON.stringify(criarExportacao(r.estado, iso(5)));
    expect(texto).not.toContain("inicioMs");
    expect(texto).toContain("Taverna");
    const lida = lerExportacao(JSON.parse(texto));
    expect(lida.ok && lugaresDe(lida.exportacao.dados.mesaDeSom).ambientes[0]?.nome).toBe(
      "Taverna",
    );
  });

  it("trocar o arquivo de um ambiente que toca, ou esvaziá-lo, desliga o ambiente", () => {
    let e = comDois();
    e = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true })).estado;
    const renomeado = poeLugar(e, "ambiente", 0, lugar(HASH_TRILHA, "Salão", { volume: 0.4 }));
    expect(ambientesLigados(renomeado)).toHaveLength(1); // só o nome mudou: segue tocando
    const trocado = poeLugar(e, "ambiente", 0, lugar(HASH_SOPRO, "Outro"));
    expect(ambientesLigados(trocado)).toHaveLength(0);
    expect(ambientesLigados(poeLugar(e, "ambiente", 0, null))).toHaveLength(0);
  });

  it("os ambientes da cena ligam ao levar o grupo e os outros desligam; os que já tocam seguem", () => {
    let e = comDois();
    e = poeLugar(e, "ambiente", 5, lugar(HASH_SOPRO, "Chuva"));
    expect(recusado(e, "j1", intencao("cena.editar", { cenaId: "fora", ambientes: [0] }))).toBe(
      "sem_permissao",
    );
    e = ok(e, "m", intencao("cena.editar", { cenaId: "fora", ambientes: [5, 0, 5] })).estado;
    expect(e.cenas.find((c) => c.id === "fora")?.ambientes).toEqual([0, 5]);
    // o jogador nunca vê os ambientes da cena
    expect(JSON.stringify(visaoPara(e, J1, T0))).not.toContain('ambientes":[0');
    e = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true }), 4).estado;
    e = ok(e, "m", intencao("som.transporte", { tocando: true }), 4).estado; // Q4b: só toca com o transporte
    e = ok(e, "m", intencao("som.ambiente", { indice: 3, ligado: true }), 6).estado;
    const levado = ok(e, "m", intencao("grupo.moverPara", { cenaId: "fora" }), 20).estado;
    expect(ambientesLigados(levado)).toMatchObject([
      { indice: 0, inicioMs: T0 + 4_000 }, // já tocava: não recomeça
      { indice: 5, inicioMs: T0 + 20_000 },
    ]);
    // cena sem a lista não mexe
    const volta = ok(levado, "m", intencao("grupo.moverPara", { cenaId: "pulmao" }), 40).estado;
    expect(ambientesLigados(volta)).toHaveLength(2);
    // lista vazia: silêncio; null: tira a lista
    const quieta = ok(
      volta,
      "m",
      intencao("cena.editar", { cenaId: "fora", ambientes: [] }),
    ).estado;
    expect(
      ambientesLigados(ok(quieta, "m", intencao("grupo.moverPara", { cenaId: "fora" }), 50).estado),
    ).toHaveLength(0);
    const sem = ok(volta, "m", intencao("cena.editar", { cenaId: "fora", ambientes: null })).estado;
    expect(sem.cenas.find((c) => c.id === "fora")?.ambientes).toBeUndefined();
  });
});

describe("volume geral e parar tudo (Q4)", () => {
  it("o volume geral vale para os efeitos (já multiplicado) e fica no estado ao lado dos ambientes", () => {
    let e = poeLugar(criarEstado(), "efeito", 1, lugar(HASH_SOPRO, "Sopro", { volume: 0.8 }));
    e = poeLugar(e, "ambiente", 0, lugar(HASH_TRILHA, "Taverna"));
    expect(recusado(e, "j1", intencao("som.volumeGeral", { volume: 0.5 }))).toBe("sem_permissao");
    e = ok(e, "m", intencao("som.volumeGeral", { volume: 0.5 })).estado;
    expect(volumeGeralDe(e)).toBe(0.5);
    const r = ok(e, "m", intencao("som.efeito", { lugar: 1 }));
    const tocado = r.eventos.find((x) => x.tipo === "som.efeitoTocado");
    expect(tocado?.dados).toMatchObject({ hash: HASH_SOPRO, lugar: 1 });
    expect(tocado?.dados).toMatchObject({ volume: expect.closeTo(0.4, 5) });
    // ligar um ambiente guarda o geral junto
    e = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true })).estado;
    expect(e.somLigado?.volumeGeral).toBe(0.5);
    // o jogador recebe o volume geral (vale para todos), sem o nome do ambiente
    const visao = visaoPara(e, J1, T0);
    expect(visao.somLigado?.volumeGeral).toBe(0.5);
    expect(JSON.stringify(visao)).not.toContain("Taverna");
    // de volta ao padrão sem ambiente: nada guardado
    const limpo = ok(
      ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: false })).estado,
      "m",
      intencao("som.volumeGeral", { volume: 1 }),
    ).estado;
    expect(limpo.somLigado).toBeUndefined();
  });

  it("parar tudo corta os efeitos e desliga todos os ambientes, mas guarda o volume geral", () => {
    let e = poeLugar(criarEstado(), "ambiente", 0, lugar(HASH_TRILHA, "Taverna"));
    e = poeLugar(e, "ambiente", 1, lugar(HASH_SOPRO, "Sopro"));
    e = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true })).estado;
    e = ok(e, "m", intencao("som.ambiente", { indice: 1, ligado: true })).estado;
    e = ok(e, "m", intencao("som.volumeGeral", { volume: 0.6 })).estado;
    expect(recusado(e, "j1", intencao("som.pararTudo"))).toBe("sem_permissao");
    const r = ok(e, "m", intencao("som.pararTudo"));
    expect(ambientesLigados(r.estado)).toHaveLength(0);
    expect(r.estado.somLigado).toEqual({ volumeGeral: 0.6, ambientes: [] });
    expect(r.eventos.map((x) => x.tipo)).toEqual(["som.efeitoParado", "som.ligadoAlterado"]);
    // o corte de um efeito (um lugar ou todos) chega ao jogador
    const parar = ok(e, "m", intencao("som.efeitoParar", { lugar: 2 })).eventos[0] as EventoSala;
    expect(eventoPara(parar, J1, e, e, T0)).toMatchObject({ dados: { lugar: 2 } });
  });
});

describe("apagar um som da mesa (Q4)", () => {
  it("sai da mesa, dos lugares, das zonas e das automações, e o aviso diz onde estava", () => {
    let e = criarEstado();
    e = poeLugar(e, "efeito", 2, lugar(HASH_SUSSURROS, "Susto"));
    e = poeLugar(e, "ambiente", 4, lugar(HASH_SUSSURROS, "Cochicho"));
    e = poeLugar(e, "ambiente", 5, lugar(HASH_TRILHA, "Taverna"));
    e = ok(e, "m", intencao("som.ambiente", { indice: 4, ligado: true })).estado;
    e = ok(e, "m", intencao("som.ambiente", { indice: 5, ligado: true })).estado;
    e = { ...e, zonas: [zona()] };
    const reacao = (id: string, fazer: object[]) =>
      ReacaoSchema.parse({ id, nome: id, fica: { tipo: "mesa" }, ao: "turno.inicio", fazer });
    const automacoes: Automacoes = AutomacoesSchema.parse({
      reacoes: [
        reacao("so-som", [
          { acao: "som.tocar", hash: HASH_SUSSURROS, nome: "sussurros", volume: 0.5 },
        ]),
        reacao("misto", [
          { acao: "chat.anunciar", texto: "oi" },
          { acao: "som.tocar", hash: HASH_SUSSURROS, nome: "sussurros", volume: 0.5 },
        ]),
        reacao("outro", [{ acao: "som.tocar", hash: HASH_TRILHA, nome: "taverna", volume: 0.5 }]),
      ],
    });
    e = { ...e, automacoes };
    const usos = usosDoSom(e, HASH_SUSSURROS);
    expect(usos.lugares).toEqual([
      { grupo: "efeito", indice: 2, nome: "Susto" },
      { grupo: "ambiente", indice: 4, nome: "Cochicho" },
    ]);
    expect(usos.zonas).toEqual([SEGREDO]);
    expect(usos.automacoes).toEqual(["so-som", "misto"]);

    expect(recusado(e, "j1", intencao("som.apagar", { hash: HASH_SUSSURROS }))).toBe(
      "sem_permissao",
    );
    expect(recusado(e, "m", intencao("som.apagar", { hash: HASH_OUTRA }))).toBe(
      "asset_inexistente",
    );
    const r = ok(e, "m", intencao("som.apagar", { hash: HASH_SUSSURROS }));
    const depois = r.estado;
    expect(depois.assets?.some((a) => a.hash === HASH_SUSSURROS)).toBe(false);
    expect(depois.assets?.some((a) => a.hash === HASH_TRILHA)).toBe(true);
    expect(lugaresDe(depois.mesaDeSom).efeitos[2]).toBeNull();
    expect(lugaresDe(depois.mesaDeSom).ambientes[4]).toBeNull();
    expect(lugaresDe(depois.mesaDeSom).ambientes[5]?.nome).toBe("Taverna");
    expect(ambientesLigados(depois).map((a) => a.indice)).toEqual([5]);
    expect(depois.zonas?.[0]?.efeitos.som).toBeUndefined();
    expect(depois.automacoes?.fluxos.map((x) => x.id)).toEqual(["rx-misto", "rx-outro"]);
    expect(acoesDoFluxo(depois.automacoes?.fluxos[0] as Fluxo)).toHaveLength(1);
    expect(usosDoSom(depois, HASH_SUSSURROS)).toEqual({ lugares: [], zonas: [], automacoes: [] });
    // o jogador nunca recebe o evento do lugar nem o da meta
    for (const ev of r.eventos) {
      const visto = eventoPara(ev, J1, e, depois, T0);
      if (ev.tipo === "som.lugarAlterado" || ev.tipo === "asset.removido") expect(visto).toBeNull();
    }
  });
});

describe("o jogador não vê a mesa de som (Q4)", () => {
  it("a visão e os eventos do jogador não trazem nome, ícone nem cor dos lugares", () => {
    let e = poeLugar(criarEstado(), "efeito", 0, lugar(HASH_SOPRO, "Segredo"));
    e = poeLugar(e, "ambiente", 0, lugar(HASH_TRILHA, "Oculta", { icone: "criatura" }));
    expect(e.mesaDeSom).toBeDefined();
    const visao = visaoPara(e, J1, T0);
    expect(visao.mesaDeSom).toBeUndefined();
    const texto = JSON.stringify(visao);
    expect(texto).not.toContain("Segredo");
    expect(texto).not.toContain("Oculta");
    expect(visaoPara(e, MESTRE, T0).mesaDeSom).toBeDefined();
    const r = ok(
      criarEstado(),
      "m",
      intencao("som.lugar", { grupo: "efeito", indice: 1, lugar: lugar(HASH_SOPRO, "Z") }),
    );
    const ev = r.eventos[0] as EventoSala;
    expect(eventoPara(ev, J1, criarEstado(), r.estado, T0)).toBeNull();
    expect(eventoPara(ev, MESTRE, criarEstado(), r.estado, T0)).not.toBeNull();
  });
});

describe("a conversão do som do N5 (Q4)", () => {
  const antigo = () => {
    const e = criarEstado();
    return {
      ...e,
      trilha: {
        hash: HASH_TRILHA,
        nome: "taverna.wav",
        volume: 0.4,
        inicioMs: T0 + 1000,
        servidorMs: T0 + 5000,
      },
      cenas: e.cenas.map((c) =>
        c.id === "fora"
          ? { ...c, trilha: { hash: HASH_SUSSURROS, nome: "sussurros", volume: 0.3 } }
          : c,
      ),
    } satisfies Estado;
  };

  it("a trilha que tocava vira um ambiente ligado e a da cena vira um ambiente da cena", () => {
    const novo = migrarSomDoN5(antigo());
    expect(novo.trilha).toBeUndefined();
    expect(novo.cenas.every((c) => c.trilha === undefined)).toBe(true);
    const ambientes = lugaresDe(novo.mesaDeSom).ambientes;
    expect(ambientes[0]).toMatchObject({
      hash: HASH_TRILHA,
      nome: "taverna",
      icone: "musica",
      cor: "ambar",
      volume: 0.4,
    });
    expect(ambientes[1]).toMatchObject({ hash: HASH_SUSSURROS, nome: "sussurros", volume: 0.3 });
    expect(ambientesLigados(novo)).toMatchObject([
      { indice: 0, hash: HASH_TRILHA, volume: 0.4, inicioMs: T0 + 1000 },
    ]);
    expect(novo.cenas.find((c) => c.id === "fora")?.ambientes).toEqual([1]);
    // idempotente: o que já foi convertido não muda mais
    expect(migrarSomDoN5(novo)).toBe(novo);
  });

  it("a mesma música na trilha e na cena usa um lugar só; sem lugar livre a trilha antiga é descartada", () => {
    const e = antigo();
    const mesmo = migrarSomDoN5({
      ...e,
      cenas: e.cenas.map((c) =>
        c.id === "fora" ? { ...c, trilha: { hash: HASH_TRILHA, nome: "t", volume: 0.4 } } : c,
      ),
    });
    expect(lugaresDe(mesmo.mesaDeSom).ambientes.filter(Boolean)).toHaveLength(1);
    expect(mesmo.cenas.find((c) => c.id === "fora")?.ambientes).toEqual([0]);
    let cheio: Estado = criarEstado();
    for (let i = 0; i < 8; i++) cheio = poeLugar(cheio, "ambiente", i, lugar(HASH_SOPRO, `A${i}`));
    const sem = migrarSomDoN5({ ...cheio, trilha: antigo().trilha });
    expect(ambientesLigados(sem)).toHaveLength(0);
    expect(sem.trilha).toBeUndefined();
  });

  it("um arquivo exportado no N5 (trilha da cena, sem mesa de som) abre convertido", () => {
    const e = antigo();
    const comTrilhaDaCena = { ...e, trilha: undefined };
    const texto = JSON.stringify(criarExportacao(comTrilhaDaCena, iso(1)));
    const lida = lerExportacao(JSON.parse(texto));
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.exportacao.dados.cenas.find((c) => c.id === "fora")?.trilha).toBeUndefined();
    expect(lida.exportacao.dados.cenas.find((c) => c.id === "fora")?.ambientes).toEqual([0]);
    expect(lugaresDe(lida.exportacao.dados.mesaDeSom).ambientes[0]?.hash).toBe(HASH_SUSSURROS);
    // importar aplica a conversão e a mesa começa sem nada tocando
    const importado = ok(
      criarEstado(),
      "m",
      intencao("campanha.importar", { dados: JSON.parse(texto) }),
    ).estado;
    expect(importado.somLigado).toBeUndefined();
    expect(importado.cenas.find((c) => c.id === "fora")?.ambientes).toEqual([0]);
  });
});

describe("os efeitos", () => {
  it("tocar um efeito vai a todos e não muda o estado", () => {
    const e = criarEstado();
    const r = ok(e, "m", intencao("som.efeito", { hash: HASH_SOPRO, volume: 0.7 }));
    expect(r.estado.somLigado).toBeUndefined();
    const ev = r.eventos.find((x) => x.tipo === "som.efeitoTocado") as EventoSala;
    expect(ev).toBeDefined();
    for (const id of ["m", "j1", "j2"]) {
      const quem = { id, papel: id === "m" ? ("mestre" as const) : ("jogador" as const) };
      expect(eventoPara(ev, quem, e, r.estado, T0)).toMatchObject({
        dados: { hash: HASH_SOPRO, volume: 0.7, alvo: { tipo: "todos" } },
      });
    }
  });

  it("quem ouve: todos, os da cena do grupo ou quem controla o token", () => {
    const e = criarEstado();
    const j1 = { id: "j1", papel: "jogador" as const };
    const j2 = { id: "j2", papel: "jogador" as const };
    const m = { id: "m", papel: "mestre" as const };
    expect(efeitoChegaPara({ tipo: "todos" }, j1, e)).toBe(true);
    expect(efeitoChegaPara({ tipo: "cena", cenaId: "pulmao" }, j1, e)).toBe(true);
    expect(efeitoChegaPara({ tipo: "cena", cenaId: "fora" }, j1, e)).toBe(false);
    expect(efeitoChegaPara({ tipo: "token", tokenId: "t1" }, j1, e)).toBe(true);
    expect(efeitoChegaPara({ tipo: "token", tokenId: "t1" }, j2, e)).toBe(false);
    expect(efeitoChegaPara({ tipo: "token", tokenId: "nao-existe" }, j1, e)).toBe(false);
    // o mestre ouve tudo o que toca
    expect(efeitoChegaPara({ tipo: "cena", cenaId: "fora" }, m, e)).toBe(true);
    expect(efeitoChegaPara({ tipo: "token", tokenId: "t1" }, m, e)).toBe(true);
  });

  it("o volume e o silenciar das preferências multiplicam, e silenciar zera", () => {
    expect(volumeFinal(0.5, 0.8, 1, false)).toBeCloseTo(0.4, 5);
    expect(volumeFinal(1, 1, 0, false)).toBe(0);
    expect(volumeFinal(0, 1, 1, false)).toBe(0);
    expect(volumeFinal(1, 1, 1, true)).toBe(0);
    expect(volumeFinal(2, 2, 2, false)).toBe(1);
    expect(volumeFinal(Number.NaN, 1, 1, false)).toBe(0);
  });
});

describe("o som da zona", () => {
  const comZona = (e: Estado, z: Zona = zona()): Estado => ({
    ...e,
    zonas: [...(e.zonas ?? []), z],
  });
  const j1 = { id: "j1", papel: "jogador" as const };
  const j2 = { id: "j2", papel: "jogador" as const };

  it("o jogador cujo token está dentro ouve; os outros não", () => {
    const e = comZona(criarEstado());
    expect(sonsDasZonasParaJogador(e, j1)).toEqual([
      { hash: HASH_SUSSURROS, volume: 0.6, laco: true },
    ]);
    // o token do j2 (t3) está fora
    expect(sonsDasZonasParaJogador(e, j2)).toEqual([]);
    // o mestre não recebe pela sala: ele escolhe pelo token selecionado
    expect(sonsDasZonasParaJogador(e, { id: "m", papel: "mestre" })).toEqual([]);
    expect(sonsDasZonasParaTokens(e, [token("t3", 5, 5)])).toEqual([]);
    expect(sonsDasZonasParaTokens(e, [token("t2", 15, 15)])).toHaveLength(1);
  });

  it("entra, ouve; sai, para (a lista fica vazia)", () => {
    const e0 = comZona(criarEstado());
    const fora = ok(e0, "m", intencao("token.soltar", { id: "t1", x: 5, y: 5 })).estado;
    expect(sonsDasZonasParaJogador(fora, j1)).toEqual([]);
    const dentro = ok(fora, "m", intencao("token.soltar", { id: "t1", x: 12, y: 12 })).estado;
    expect(sonsDasZonasParaJogador(dentro, j1)).toHaveLength(1);
  });

  it("zona desligada, em rascunho, de outra cena ou sem som não toca", () => {
    expect(sonsDasZonasParaJogador(comZona(criarEstado(), zona({ ativa: false })), j1)).toEqual([]);
    expect(sonsDasZonasParaJogador(comZona(criarEstado(), zona({ rascunho: true })), j1)).toEqual(
      [],
    );
    expect(sonsDasZonasParaJogador(comZona(criarEstado(), zona({ cenaId: "fora" })), j1)).toEqual(
      [],
    );
    expect(sonsDasZonasParaJogador(comZona(criarEstado(), zona({ efeitos: {} })), j1)).toEqual([]);
  });

  it("duas zonas com o mesmo som tocam uma vez, no volume maior", () => {
    const e = comZona(
      comZona(criarEstado(), zona({ id: "z1" })),
      zona({
        id: "z2",
        efeitos: { som: { hash: HASH_SUSSURROS, nome: "sussurros", volume: 0.9, laco: true } },
      }),
    );
    expect(sonsDasZonasParaJogador(e, j1)).toEqual([
      { hash: HASH_SUSSURROS, volume: 0.9, laco: true },
    ]);
  });

  it("a zona continua secreta: a visão e os eventos do jogador não trazem a zona nem o som dela", () => {
    const e0 = criarEstado();
    const criada = ok(e0, "m", intencao("zona.criar", { zona: zona() }));
    const visao = visaoPara(criada.estado, j1, T0);
    expect(visao.zonas).toBeUndefined();
    expect(JSON.stringify(visao)).not.toContain(SEGREDO);
    // o que a sala manda ao jogador por causa da zona é só a lista de sons (sem forma, nome nem regras)
    const dele = JSON.stringify(sonsDasZonasParaJogador(criada.estado, j1));
    expect(dele).not.toContain(SEGREDO);
    expect(dele).not.toContain("pontos");
    expect(dele).not.toContain("z1");
    // criar, editar e apagar a zona não chegam ao jogador
    for (const ev of criada.eventos) {
      expect(JSON.stringify(eventoPara(ev, j1, e0, criada.estado, T0))).not.toContain(SEGREDO);
    }
    const editada = ok(
      criada.estado,
      "m",
      intencao("zona.editar", {
        id: "z1",
        mudancas: {
          efeitos: { som: { hash: HASH_SUSSURROS, nome: "sussurros", volume: 0.2, laco: false } },
        },
      }),
    );
    for (const ev of editada.eventos) {
      expect(eventoPara(ev, j1, criada.estado, editada.estado, T0)).toBeNull();
    }
    expect(editada.estado.zonas?.[0]?.efeitos.som).toMatchObject({ volume: 0.2, laco: false });
    // o hash do som da zona vai na exportação como referência
    expect(hashesUsados(editada.estado).has(HASH_SUSSURROS)).toBe(true);
  });
});

describe("a ação som.tocar das automações", () => {
  const reacaoSom = (para: string, extra: object = {}) =>
    ReacaoSchema.parse({
      id: "r-som",
      fica: { tipo: "mesa" },
      ao: "turno.inicio",
      fazer: [{ acao: "som.tocar", hash: HASH_SOPRO, nome: "sopro", volume: 0.5, para, ...extra }],
    });
  const comReacao = (r: Reacao, e = criarEstado()): Estado => ({
    ...e,
    automacoes: AutomacoesSchema.parse({ reacoes: [r] }),
  });

  it("entra na lista fechada, com som, volume e para quem (o resto é recusado)", () => {
    expect(reacaoSom("todos").fazer[0]).toMatchObject({
      acao: "som.tocar",
      para: "todos",
      volume: 0.5,
    });
    expect(
      ReacaoSchema.safeParse({
        id: "r",
        fica: { tipo: "mesa" },
        ao: "x",
        fazer: [{ acao: "som.tocar", hash: "curto", nome: "x" }],
      }).success,
    ).toBe(false);
    expect(
      ReacaoSchema.safeParse({
        id: "r",
        fica: { tipo: "mesa" },
        ao: "x",
        fazer: [{ acao: "som.tocar", hash: HASH_SOPRO, nome: "x", volume: 2 }],
      }).success,
    ).toBe(false);
    // padrões: volume 0,8 e para todos
    const padrao = ReacaoSchema.parse({
      id: "r",
      fica: { tipo: "mesa" },
      ao: "x",
      fazer: [{ acao: "som.tocar", hash: HASH_SOPRO, nome: "x" }],
    });
    expect(padrao.fazer[0]).toMatchObject({ volume: 0.8, para: "todos" });
  });

  it("a reação toca o som uma vez para todos e a lista de usados leva o hash", () => {
    const e = comReacao(reacaoSom("todos"));
    expect(hashesUsados(e).has(HASH_SOPRO)).toBe(true);
    const r = ok(e, "m", intencao("fluxo.disparar", { id: "rx-r-som" }));
    const sons = r.eventos.filter((x) => x.tipo === "som.efeitoTocado");
    expect(sons).toHaveLength(1);
    expect(sons[0]).toMatchObject({
      dados: { hash: HASH_SOPRO, volume: 0.5, alvo: { tipo: "todos" } },
    });
  });

  it("para a cena e para o token do evento chega só a quem deve", () => {
    const e = comReacao(reacaoSom("cena"));
    const r = ok(e, "m", intencao("fluxo.disparar", { id: "rx-r-som" }));
    const ev = r.eventos.find((x) => x.tipo === "som.efeitoTocado") as EventoSala;
    expect(ev).toMatchObject({ dados: { alvo: { tipo: "cena", cenaId: "pulmao" } } });
    expect(eventoPara(ev, { id: "j1", papel: "jogador" }, e, r.estado, T0)).not.toBeNull();
    const noutraCena = { ...r.estado, cenaAtivaId: "fora" };
    expect(eventoPara(ev, { id: "j1", papel: "jogador" }, e, noutraCena, T0)).toBeNull();
    expect(eventoPara(ev, { id: "m", papel: "mestre" }, e, noutraCena, T0)).not.toBeNull();
  });

  it("um som que saiu da mesa não toca e o motor anota no registro", () => {
    const e = comReacao(reacaoSom("todos"), criarEstado({ assets: [] }));
    const r = ok(e, "m", intencao("fluxo.disparar", { id: "rx-r-som" }));
    expect(r.eventos.some((x) => x.tipo === "som.efeitoTocado")).toBe(false);
    expect(JSON.stringify(r.estado.automacoes?.registro)).toContain("não está mais na mesa");
  });

  it("para o token do evento sem token no evento: não toca e anota", () => {
    const e = comReacao(reacaoSom("token"));
    const r = ok(e, "m", intencao("fluxo.disparar", { id: "rx-r-som" }));
    expect(r.eventos.some((x) => x.tipo === "som.efeitoTocado")).toBe(false);
    expect(JSON.stringify(r.estado.automacoes?.registro)).toContain("não há token");
  });
});

describe("importar e exportar com som", () => {
  it("a exportação leva as referências (metas, trilha da cena, som da zona), nunca os bytes, e relê", () => {
    let e = criarEstado();
    e = poeLugar(e, "ambiente", 0, lugar(HASH_TRILHA, "Taverna", { volume: 0.4 }));
    e = ok(e, "m", intencao("cena.editar", { cenaId: "fora", ambientes: [0] })).estado;
    e = { ...e, zonas: [zona()] };
    const exp = criarExportacao(e, iso(1));
    const texto = JSON.stringify(exp);
    expect(texto).toContain(HASH_TRILHA);
    expect(texto).toContain(HASH_SUSSURROS);
    const lida = lerExportacao(JSON.parse(texto));
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.exportacao.dados.cenas.find((c) => c.id === "fora")?.ambientes).toEqual([0]);
    expect(lugaresDe(lida.exportacao.dados.mesaDeSom).ambientes[0]).toMatchObject({
      hash: HASH_TRILHA,
    });
    expect(lida.exportacao.dados.zonas?.[0]?.efeitos.som).toMatchObject({ hash: HASH_SUSSURROS });
    expect(lida.exportacao.dados.assets?.filter((a) => a.tipo === "som").length).toBeGreaterThan(0);
    expect((lida.exportacao.dados as { trilha?: unknown }).trilha).toBeUndefined();
  });

  it("um arquivo antigo (sem som nenhum) continua abrindo", () => {
    const antigo = criarEstado({ assets: [] });
    const exp = criarExportacao(antigo, iso(1));
    const lida = lerExportacao(JSON.parse(JSON.stringify(exp)));
    expect(lida.ok).toBe(true);
  });
});

describe("o transporte da mesa de som (Q4b)", () => {
  const comDois = () => {
    let e = criarEstado();
    e = poeLugar(e, "ambiente", 0, lugar(HASH_TRILHA, "Taverna", { volume: 0.4 }));
    e = poeLugar(e, "ambiente", 3, lugar(HASH_SUSSURROS, "Vento", { volume: 0.7 }));
    return e;
  };
  const tocar = (e: Estado, tocando: boolean, s = 0) =>
    ok(e, "m", intencao("som.transporte", { tocando }), s);

  it("marcar ambientes com o transporte parado só marca; Tocar toca os dois juntos, do mesmo instante", () => {
    let e = comDois();
    e = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true }), 10).estado;
    e = ok(e, "m", intencao("som.ambiente", { indice: 3, ligado: true }), 20).estado;
    expect(ambientesLigados(e)).toHaveLength(2);
    expect(tocandoAgora(e)).toBe(false);
    expect(e.somLigado?.tocando).toBe(false);
    expect(recusado(e, "j1", intencao("som.transporte", { tocando: true }))).toBe("sem_permissao");
    const r = tocar(e, true, 30);
    expect(tocandoAgora(r.estado)).toBe(true);
    expect(ambientesLigados(r.estado)).toMatchObject([
      { indice: 0, inicioMs: T0 + 30_000 },
      { indice: 3, inicioMs: T0 + 30_000 },
    ]);
    // tocar de novo não muda nada
    expect(tocar(r.estado, true).eventos).toHaveLength(0);
  });

  it("Tocar sem nenhum ambiente marcado é recusado (a tela mostra a dica)", () => {
    expect(recusado(comDois(), "m", intencao("som.transporte", { tocando: true }))).toBe(
      "dados_invalidos",
    );
  });

  it("com o transporte tocando, ligar entra na hora e desligar tira só ele", () => {
    let e = comDois();
    e = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true })).estado;
    e = tocar(e, true, 5).estado;
    e = ok(e, "m", intencao("som.ambiente", { indice: 3, ligado: true }), 40).estado;
    expect(tocandoAgora(e)).toBe(true);
    expect(ambientesLigados(e)).toMatchObject([
      { indice: 0, inicioMs: T0 + 5_000 },
      { indice: 3, inicioMs: T0 + 40_000 },
    ]);
    e = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: false }), 50).estado;
    expect(ambientesLigados(e)).toMatchObject([{ indice: 3 }]);
    expect(tocandoAgora(e)).toBe(true);
  });

  it("Parar cala os ambientes (que seguem marcados) e corta os efeitos; Tocar volta", () => {
    let e = comDois();
    e = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true })).estado;
    e = tocar(e, true).estado;
    const parado = tocar(e, false);
    expect(parado.eventos.map((x) => x.tipo)).toEqual(["som.efeitoParado", "som.ligadoAlterado"]);
    expect(tocandoAgora(parado.estado)).toBe(false);
    expect(ambientesLigados(parado.estado)).toHaveLength(1);
    expect(tocandoAgora(tocar(parado.estado, true).estado)).toBe(true);
    // parar o que já está parado só corta os efeitos
    expect(tocar(parado.estado, false).eventos.map((x) => x.tipo)).toEqual(["som.efeitoParado"]);
  });

  it("o estado de antes do Q4b (sem o campo) vale como tocando se há ambiente marcado", () => {
    const antigo = criarEstado({
      somLigado: {
        volumeGeral: 1,
        ambientes: [{ indice: 0, hash: HASH_TRILHA, volume: 0.5, inicioMs: T0 }],
      },
    });
    expect(tocandoAgora(antigo)).toBe(true);
    expect(tocandoAgora(criarEstado())).toBe(false);
    expect(tocandoAgora(criarEstado({ somLigado: { volumeGeral: 0.5, ambientes: [] } }))).toBe(
      false,
    );
  });

  it("levar o grupo para uma cena com ambientes põe o transporte para tocar, tudo do mesmo instante", () => {
    let e = comDois();
    e = ok(e, "m", intencao("som.ambiente", { indice: 3, ligado: true }), 2).estado;
    expect(tocandoAgora(e)).toBe(false);
    e = ok(e, "m", intencao("cena.editar", { cenaId: "fora", ambientes: [0, 3] })).estado;
    e = ok(e, "m", intencao("grupo.moverPara", { cenaId: "fora" }), 20).estado;
    expect(tocandoAgora(e)).toBe(true);
    expect(ambientesLigados(e)).toMatchObject([
      { indice: 0, inicioMs: T0 + 20_000 },
      { indice: 3, inicioMs: T0 + 20_000 },
    ]);
  });

  it("parar tudo volta ao começo: nada marcado e transporte parado", () => {
    let e = comDois();
    e = ok(e, "m", intencao("som.ambiente", { indice: 0, ligado: true })).estado;
    e = tocar(e, true).estado;
    e = ok(e, "m", intencao("som.pararTudo")).estado;
    expect(tocandoAgora(e)).toBe(false);
    expect(e.somLigado).toBeUndefined();
  });
});
