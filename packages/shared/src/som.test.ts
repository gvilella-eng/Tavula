import { describe, expect, it } from "vitest";
import {
  type AssetMeta,
  type Automacoes,
  AutomacoesSchema,
  assetVisivelPara,
  criarExportacao,
  desvioDoRelogio,
  type Estado,
  type EventoSala,
  efeitoChegaPara,
  estadoInicial,
  eventoPara,
  fonteComSemente,
  hashesUsados,
  type Intencao,
  IntencaoSchema,
  LIMITES_DE_ASSET,
  lerExportacao,
  mimeDeSomValido,
  mimeDoSomPeloNome,
  modelosPadrao,
  pontoDaTrilha,
  processar,
  type Reacao,
  ReacaoSchema,
  sonsDasZonasParaJogador,
  sonsDasZonasParaTokens,
  validarMeta,
  visaoPara,
  volumeFinal,
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

describe("a trilha", () => {
  it("o mestre toca, troca e para; o jogador não pode", () => {
    const e = criarEstado();
    expect(recusado(e, "j1", intencao("som.trilha", { hash: HASH_TRILHA, volume: 0.5 }))).toBe(
      "sem_permissao",
    );
    expect(recusado(e, "j1", intencao("som.parar"))).toBe("sem_permissao");
    expect(recusado(e, "j1", intencao("som.efeito", { hash: HASH_SOPRO, volume: 0.5 }))).toBe(
      "sem_permissao",
    );
    const tocando = ok(
      e,
      "m",
      intencao("som.trilha", { hash: HASH_TRILHA, volume: 0.5 }),
      10,
    ).estado;
    expect(tocando.trilha).toMatchObject({
      hash: HASH_TRILHA,
      nome: "taverna",
      volume: 0.5,
      inicioMs: T0 + 10_000,
    });
    // o mesmo som de novo só muda o volume: a trilha não recomeça
    const mais = ok(
      tocando,
      "m",
      intencao("som.trilha", { hash: HASH_TRILHA, volume: 0.9 }),
      50,
    ).estado;
    expect(mais.trilha).toMatchObject({ volume: 0.9, inicioMs: T0 + 10_000 });
    // outro som recomeça
    const outra = ok(
      mais,
      "m",
      intencao("som.trilha", { hash: HASH_SOPRO, volume: 0.9 }),
      60,
    ).estado;
    expect(outra.trilha).toMatchObject({ hash: HASH_SOPRO, inicioMs: T0 + 60_000 });
    const parada = ok(outra, "m", intencao("som.parar")).estado;
    expect(parada.trilha).toBeUndefined();
  });

  it("recusa o que não é um som registrado", () => {
    const e = criarEstado();
    expect(recusado(e, "m", intencao("som.trilha", { hash: HASH_OUTRA, volume: 0.5 }))).toBe(
      "asset_inexistente",
    );
    expect(recusado(e, "m", intencao("som.efeito", { hash: HASH_OUTRA, volume: 0.5 }))).toBe(
      "asset_inexistente",
    );
    const comMapa = criarEstado({
      assets: [{ ...som(HASH_OUTRA, "mapa"), tipo: "mapa", mime: "image/webp" }],
    });
    expect(recusado(comMapa, "m", intencao("som.trilha", { hash: HASH_OUTRA, volume: 0.5 }))).toBe(
      "asset_inexistente",
    );
  });

  it("quem entra no meio recebe a trilha com o relógio da sala de agora (alinhamento)", () => {
    const e = ok(
      criarEstado(),
      "m",
      intencao("som.trilha", { hash: HASH_TRILHA, volume: 0.5 }),
      0,
    ).estado;
    const visao = visaoPara(e, { id: "j1", papel: "jogador" }, T0 + 95_000);
    expect(visao.trilha).toMatchObject({
      hash: HASH_TRILHA,
      inicioMs: T0,
      servidorMs: T0 + 95_000,
    });
    // o navegador está 2 s atrás da sala: o desvio corrige
    const agoraLocal = T0 + 93_000;
    const desvio = desvioDoRelogio(visao.trilha ?? { servidorMs: 0 }, agoraLocal);
    expect(desvio).toBe(2_000);
    // 95 s depois do início, num arquivo de 40 s: ponto 15 s
    expect(pontoDaTrilha({ inicioMs: T0 }, agoraLocal, desvio, 40)).toBeCloseTo(15, 5);
    // sem a duração, devolve o tempo corrido
    expect(pontoDaTrilha({ inicioMs: T0 }, agoraLocal, desvio)).toBeCloseTo(95, 5);
    // nunca negativo (trilha que "começa no futuro" por causa de um relógio adiantado)
    expect(pontoDaTrilha({ inicioMs: T0 + 5_000 }, T0, 0, 40)).toBe(0);
  });

  it("o evento da trilha chega a todos com o relógio refeito e some da exportação", () => {
    const r = ok(criarEstado(), "m", intencao("som.trilha", { hash: HASH_TRILHA, volume: 0.5 }), 3);
    const ev = r.eventos.find((x) => x.tipo === "som.trilhaAlterada") as EventoSala;
    for (const quem of [
      { id: "m", papel: "mestre" as const },
      { id: "j1", papel: "jogador" as const },
    ]) {
      const visto = eventoPara(ev, quem, criarEstado(), r.estado, T0 + 7_000);
      expect(visto).toMatchObject({
        tipo: "som.trilhaAlterada",
        dados: { trilha: { hash: HASH_TRILHA, servidorMs: T0 + 7_000 } },
      });
    }
    // o relógio de uma sessão não é da campanha: a exportação não leva a trilha, só o som como referência
    const exp = criarExportacao(r.estado, iso(5));
    expect(JSON.stringify(exp)).not.toContain("inicioMs");
  });

  it("a trilha da cena começa ao levar o grupo, e a que já toca segue sem recomeçar", () => {
    let e = criarEstado();
    expect(recusado(e, "j1", intencao("cena.editar", { cenaId: "fora", trilha: null }))).toBe(
      "sem_permissao",
    );
    expect(
      recusado(
        e,
        "m",
        intencao("cena.editar", {
          cenaId: "fora",
          trilha: { hash: HASH_OUTRA, nome: "x", volume: 0.5 },
        }),
      ),
    ).toBe("asset_inexistente");
    e = ok(
      e,
      "m",
      intencao("cena.editar", {
        cenaId: "fora",
        trilha: { hash: HASH_TRILHA, nome: "taverna", volume: 0.4 },
      }),
    ).estado;
    expect(e.cenas.find((c) => c.id === "fora")?.trilha).toMatchObject({ hash: HASH_TRILHA });
    expect(hashesUsados(e).has(HASH_TRILHA)).toBe(true);
    const levado = ok(e, "m", intencao("grupo.moverPara", { cenaId: "fora" }), 20).estado;
    expect(levado.trilha).toMatchObject({ hash: HASH_TRILHA, volume: 0.4, inicioMs: T0 + 20_000 });
    // de volta à cena sem trilha: a que toca segue
    const volta = ok(levado, "m", intencao("grupo.moverPara", { cenaId: "pulmao" }), 40).estado;
    expect(volta.trilha).toMatchObject({ inicioMs: T0 + 20_000 });
    // para a cena com a mesma trilha que já toca: não recomeça
    const denovo = ok(volta, "m", intencao("grupo.moverPara", { cenaId: "fora" }), 60).estado;
    expect(denovo.trilha).toMatchObject({ inicioMs: T0 + 20_000 });
    // tirar a trilha da cena
    const sem = ok(denovo, "m", intencao("cena.editar", { cenaId: "fora", trilha: null })).estado;
    expect(sem.cenas.find((c) => c.id === "fora")?.trilha).toBeUndefined();
  });
});

describe("os efeitos", () => {
  it("tocar um efeito vai a todos e não muda o estado", () => {
    const e = criarEstado();
    const r = ok(e, "m", intencao("som.efeito", { hash: HASH_SOPRO, volume: 0.7 }));
    expect(JSON.stringify(r.estado.trilha)).toBe(undefined);
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
    automacoes: AutomacoesSchema.parse({ reacoes: [r] } satisfies Partial<Automacoes>),
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
    const r = ok(e, "m", intencao("evento.disparar", { evento: "turno.inicio" }));
    const sons = r.eventos.filter((x) => x.tipo === "som.efeitoTocado");
    expect(sons).toHaveLength(1);
    expect(sons[0]).toMatchObject({
      dados: { hash: HASH_SOPRO, volume: 0.5, alvo: { tipo: "todos" } },
    });
  });

  it("para a cena e para o token do evento chega só a quem deve", () => {
    const e = comReacao(reacaoSom("cena"));
    const r = ok(e, "m", intencao("evento.disparar", { evento: "turno.inicio" }));
    const ev = r.eventos.find((x) => x.tipo === "som.efeitoTocado") as EventoSala;
    expect(ev).toMatchObject({ dados: { alvo: { tipo: "cena", cenaId: "pulmao" } } });
    expect(eventoPara(ev, { id: "j1", papel: "jogador" }, e, r.estado, T0)).not.toBeNull();
    const noutraCena = { ...r.estado, cenaAtivaId: "fora" };
    expect(eventoPara(ev, { id: "j1", papel: "jogador" }, e, noutraCena, T0)).toBeNull();
    expect(eventoPara(ev, { id: "m", papel: "mestre" }, e, noutraCena, T0)).not.toBeNull();
  });

  it("um som que saiu da mesa não toca e o motor anota no registro", () => {
    const e = comReacao(reacaoSom("todos"), criarEstado({ assets: [] }));
    const r = ok(e, "m", intencao("evento.disparar", { evento: "turno.inicio" }));
    expect(r.eventos.some((x) => x.tipo === "som.efeitoTocado")).toBe(false);
    expect(JSON.stringify(r.estado.automacoes?.registro)).toContain("não está mais na mesa");
  });

  it("para o token do evento sem token no evento: não toca e anota", () => {
    const e = comReacao(reacaoSom("token"));
    const r = ok(e, "m", intencao("evento.disparar", { evento: "turno.inicio" }));
    expect(r.eventos.some((x) => x.tipo === "som.efeitoTocado")).toBe(false);
    expect(JSON.stringify(r.estado.automacoes?.registro)).toContain("não tem token");
  });
});

describe("importar e exportar com som", () => {
  it("a exportação leva as referências (metas, trilha da cena, som da zona), nunca os bytes, e relê", () => {
    let e = criarEstado();
    e = ok(
      e,
      "m",
      intencao("cena.editar", {
        cenaId: "fora",
        trilha: { hash: HASH_TRILHA, nome: "taverna", volume: 0.4 },
      }),
    ).estado;
    e = { ...e, zonas: [zona()] };
    const exp = criarExportacao(e, iso(1));
    const texto = JSON.stringify(exp);
    expect(texto).toContain(HASH_TRILHA);
    expect(texto).toContain(HASH_SUSSURROS);
    const lida = lerExportacao(JSON.parse(texto));
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.exportacao.dados.cenas.find((c) => c.id === "fora")?.trilha).toMatchObject({
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
