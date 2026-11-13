import { describe, expect, it } from "vitest";
import { ehCapacidadeDelegavel } from "./capacidades.ts";
import {
  AcaoSchema,
  type Automacoes,
  AutomacoesSchema,
  CicloSchema,
  capacidadeDaIntencao,
  converterAutomacoesDoArquivo,
  criarExportacao,
  type Estado,
  type EventoDeAutomacao,
  type EventoSala,
  estadoInicial,
  eventoPara,
  eventosDoSistema,
  fonteComSemente,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  limiteDeVisaoDoToken,
  modelosPadrao,
  type ObjetoDeLuz,
  PROFUNDIDADE_MAXIMA,
  processar,
  processarEvento,
  processarSistema,
  proximoMarcoDasAutomacoes,
  ReacaoSchema,
  raiosEfetivos,
  TETO_DE_ACOES,
  visaoPara,
} from "./index.ts";

// Relógio falso: a sala "começa" em T0 (mesa rodando) e cada teste passa o `agora` que quiser, em segundos.
const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (segundos: number) => new Date(T0 + segundos * 1000).toISOString();

const MESTRE = { id: "m", papel: "mestre" as const };
const J1 = { id: "j1", papel: "jogador" as const };
const J2 = { id: "j2", papel: "jogador" as const };

const SEGREDO = "SEGREDO-DO-MESTRE";

let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });

const tocha = (id: string, cenaId = "pulmao", extra: Partial<ObjetoDeLuz> = {}): ObjetoDeLuz => ({
  id,
  cenaId,
  nome: id,
  modeloId: "modelo-tocha",
  portador: { tipo: "cena", x: 5, y: 5 },
  luz: { claraM: 6, penumbraM: 6, cor: "#ffb347", tremula: false },
  intensidade: 1,
  estado: "acesa",
  saldoMs: 1_800_000,
  acesaDesdeSala: 0,
  duracaoMs: 1_800_000,
  modificadores: [],
  historico: [],
  ...extra,
});

const token = (id: string, cenaId: string, controlador: string) => ({
  id,
  cenaId,
  nome: id,
  cor: "#0f0",
  tamanhoQuadrados: 1,
  x: 5,
  y: 5,
  camada: "tokens" as const,
  oculto: false,
  controladoPor: [controlador],
});

function criarEstado(luzes: ObjetoDeLuz[] = [tocha("o1")]): Estado {
  return estadoInicial(
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
          larguraM: 30,
          alturaM: 30,
          grid: { quadradoM: 1.5, visivel: true },
        },
        {
          id: "fora",
          nome: "Fora",
          larguraM: 30,
          alturaM: 30,
          grid: { quadradoM: 1.5, visivel: true },
        },
      ],
      cenaAtivaId: "pulmao",
      modelos: modelosPadrao(),
      luzes,
      tokens: [token("t1", "pulmao", "j1"), token("t2", "pulmao", "j2")],
    },
    T0,
  );
}

const comAutomacoes = (e: Estado, parcial: Partial<Automacoes>): Estado => ({
  ...e,
  automacoes: AutomacoesSchema.parse(parcial),
});

/** A respiração da montanha (4.11): o ciclo e a reação da tocha, mais dois anúncios para medir o relógio. */
const RESPIRACAO = {
  id: "respiracao",
  nome: "Respiração da Montanha",
  periodoS: 180,
  cenas: ["pulmao"],
  fases: [
    { emS: 0, evento: "inspiracao", duracaoS: 20 },
    { emS: 90, evento: "expiracao", duracaoS: 30 },
  ],
};
const reacao = (r: object) => ReacaoSchema.parse(r);
const REACAO_DA_TOCHA = reacao({
  id: "tocha-respira",
  nome: SEGREDO,
  fica: { tipo: "modelo", id: "modelo-tocha" },
  ao: "inspiracao",
  fazer: [{ acao: "luz.modificar", raioX: 0.5, porS: 20 }],
});
const ANUNCIOS = [
  reacao({
    id: "a1",
    fica: { tipo: "mesa" },
    ao: "inspiracao",
    fazer: [{ acao: "chat.anunciar", texto: "inspirou" }],
  }),
  reacao({
    id: "a2",
    fica: { tipo: "mesa" },
    ao: "expiracao",
    fazer: [{ acao: "chat.anunciar", texto: "expirou" }],
  }),
];

function ok(estado: Estado, quem: string, i: Intencao, segundos = 0, rng = fonteComSemente(1)) {
  const r = processar(estado, quem, i, iso(segundos), rng);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} (${r.erro.mensagem})`);
  return r;
}
function tempo(estado: Estado, segundos: number, rng = fonteComSemente(1)) {
  const r = processarSistema(estado, iso(segundos), [], rng);
  if (!r.ok) throw new Error("processarSistema recusou");
  return r;
}
const anuncios = (e: Estado) =>
  (e.chat ?? []).filter((m) => m.tipo === "aviso").map((m) => `${m.texto}@${m.emSala}`);
const objeto = (e: Estado, id: string) => e.luzes.find((l) => l.id === id);
const nomes = (eventos: EventoSala[]) => eventos.map((e) => e.tipo);

describe("os schemas das automações", () => {
  it("uma ação fora da lista é recusada (sem código livre, sem som.tocar; zona.ativar pede o ligar ou desligar)", () => {
    expect(AcaoSchema.safeParse({ acao: "som.tocar", arquivo: "x.mp3" }).success).toBe(false);
    expect(AcaoSchema.safeParse({ acao: "zona.ativar", zona: "z" }).success).toBe(false);
    expect(AcaoSchema.safeParse({ acao: "zona.ativar", zona: "z", ativa: true }).success).toBe(
      true,
    );
    expect(AcaoSchema.safeParse({ acao: "js.executar", codigo: "alert(1)" }).success).toBe(false);
    expect(AcaoSchema.safeParse({ acao: "luz.modificar", raioX: 0.5, porS: 20 }).success).toBe(
      true,
    );
    // luz.modificar sem nenhum raio não diz nada
    expect(AcaoSchema.safeParse({ acao: "luz.modificar", porS: 20 }).success).toBe(false);
    expect(
      ReacaoSchema.safeParse({
        id: "r",
        fica: { tipo: "mesa" },
        ao: "x",
        fazer: [{ acao: "som.tocar" }],
      }).success,
    ).toBe(false);
  });

  it("a intenção com ação fora da lista nem chega ao motor", () => {
    const r = IntencaoSchema.safeParse({
      v: 1,
      id: "p",
      tipo: "reacao.criar",
      dados: {
        reacao: { id: "r", fica: { tipo: "mesa" }, ao: "x", fazer: [{ acao: "som.tocar" }] },
      },
    });
    expect(r.success).toBe(false);
  });

  it("o ciclo confere o período, as fases e o nome do evento", () => {
    expect(CicloSchema.safeParse(RESPIRACAO).success).toBe(true);
    expect(CicloSchema.safeParse({ ...RESPIRACAO, periodoS: 60 }).success).toBe(false);
    expect(
      CicloSchema.safeParse({
        ...RESPIRACAO,
        fases: [
          { emS: 0, evento: "a" },
          { emS: 0, evento: "b" },
        ],
      }).success,
    ).toBe(false);
    expect(
      CicloSchema.safeParse({ ...RESPIRACAO, fases: [{ emS: 0, evento: "tem espaço" }] }).success,
    ).toBe(false);
    // sem as cenas, vale para todas
    expect(CicloSchema.parse({ ...RESPIRACAO, cenas: undefined }).cenas).toEqual([]);
  });
});

describe("a respiração da campanha de referência", () => {
  const base = comAutomacoes(criarEstado(), { reacoes: [REACAO_DA_TOCHA, ...ANUNCIOS] });

  it("dispara as fases nos segundos certos, em cada período", () => {
    let e = ok(base, "m", intencao("ciclo.criar", { ciclo: RESPIRACAO })).estado;
    // a fase do segundo 0 dispara na hora de começar
    expect(anuncios(e)).toEqual(["inspirou@0"]);
    e = tempo(e, 89.9).estado;
    expect(anuncios(e)).toEqual(["inspirou@0"]);
    e = tempo(e, 90).estado;
    e = tempo(e, 179.9).estado;
    e = tempo(e, 180).estado;
    e = tempo(e, 269.9).estado;
    e = tempo(e, 270).estado;
    expect(anuncios(e)).toEqual([
      "inspirou@0",
      "expirou@90000",
      "inspirou@180000",
      "expirou@270000",
    ]);
  });

  it("o alarme sabe quando acordar: o próximo marco é a próxima fase", () => {
    let e = ok(base, "m", intencao("ciclo.criar", { ciclo: RESPIRACAO })).estado;
    e = tempo(e, 10).estado;
    // faltam 80 s para a expiração (o fim do efeito da luz tem o marco próprio, o da tocha)
    expect(proximoMarcoDasAutomacoes(e, 10_000)).toBe(80_000);
    e = tempo(e, 21).estado;
    expect(proximoMarcoDasAutomacoes(e, 21_000)).toBe(69_000);
  });

  it("a reação da tocha reduz o raio por 20 s e ele volta; o valor base nunca muda", () => {
    let e = ok(base, "m", intencao("ciclo.criar", { ciclo: RESPIRACAO })).estado;
    const baseLuz = objeto(e, "o1")?.luz;
    const raioDe = (est: Estado, s: number) => {
      const v = visaoPara(est, MESTRE, T0 + s * 1000).luzes[0];
      return v ? raiosEfetivos(v, 1) : null;
    };
    expect(objeto(e, "o1")?.modificadores).toHaveLength(1);
    expect(raioDe(e, 1)).toEqual({ claraM: 3, totalM: 6 });
    e = tempo(e, 19.9).estado;
    expect(raioDe(e, 19.9)).toEqual({ claraM: 3, totalM: 6 });
    const depois = tempo(e, 20.1);
    e = depois.estado;
    expect(objeto(e, "o1")?.modificadores).toEqual([]);
    expect(raioDe(e, 21)).toEqual({ claraM: 6, totalM: 12 });
    expect(objeto(e, "o1")?.luz).toEqual(baseLuz);
    // a volta é um evento comum da luz (o jogador a recebe como efeito)
    expect(nomes(depois.eventos)).toContain("fonte.editada");
    // na fase seguinte do período, de novo
    e = tempo(e, 180).estado;
    expect(objeto(e, "o1")?.modificadores).toHaveLength(1);
  });

  it("soma e fator juntos: o valor final é base × fatores + soma", () => {
    const k = { luz: { claraM: 6, penumbraM: 6, cor: "#fff", tremula: false }, intensidade: 1 };
    expect(raiosEfetivos({ ...k, fatorDeRaio: 0.5, somaDeRaioM: -1 }, 1)).toEqual({
      claraM: 2,
      totalM: 5,
    });
    expect(raiosEfetivos({ ...k, somaDeRaioM: -100 }, 1)).toEqual({ claraM: 0, totalM: 0 });
    // a luz apagada pelo fator geral não acende por causa da soma
    expect(raiosEfetivos({ ...k, intensidade: 0, somaDeRaioM: 5 }, 1)).toEqual({
      claraM: 0,
      totalM: 0,
    });
  });
});

describe("a chance de apagar", () => {
  const luzes = Array.from({ length: 20 }, (_, i) => tocha(`o${i + 1}`));
  const sopro = reacao({
    id: "sopro",
    fica: { tipo: "modelo", id: "modelo-tocha" },
    ao: "sopro",
    fazer: [{ acao: "objeto.apagar", chance: 0.3, penalidadeS: 300 }],
  });
  const base = comAutomacoes(criarEstado(luzes), { reacoes: [sopro] });
  const evento: EventoDeAutomacao = { nome: "sopro", cenas: null, origem: "manual" };
  const apagadas = (e: Estado) => e.luzes.filter((l) => l.estado === "apagada").map((l) => l.id);

  it("é reproduzível com a mesma semente e muda com outra", () => {
    const a = processarEvento(base, evento, fonteComSemente(7));
    const b = processarEvento(base, evento, fonteComSemente(7));
    const c = processarEvento(base, evento, fonteComSemente(8));
    expect(apagadas(a.estado)).toEqual(apagadas(b.estado));
    expect(a.eventos).toEqual(b.eventos);
    expect(apagadas(a.estado).length).toBeGreaterThan(0);
    expect(apagadas(a.estado).length).toBeLessThan(20);
    expect(apagadas(c.estado)).not.toEqual(apagadas(a.estado));
  });

  it("desconta a penalidade do que sobra e anota no histórico", () => {
    const e = processarEvento(base, evento, fonteComSemente(7)).estado;
    const o = objeto(e, apagadas(e)[0] ?? "");
    expect(o?.saldoMs).toBe(1_800_000 - 300_000);
    expect(o?.acesaDesdeSala).toBeUndefined();
    expect(o?.historico.at(-1)?.texto).toContain("automação");
  });

  it("a penalidade que gasta o que sobra consome o objeto", () => {
    const gasto = comAutomacoes(criarEstado([tocha("o1", "pulmao", { saldoMs: 200_000 })]), {
      reacoes: [{ ...sopro, fazer: [{ acao: "objeto.apagar", penalidadeS: 300 }] }],
    });
    expect(processarEvento(gasto, evento, fonteComSemente(1)).estado.luzes).toEqual([]);
  });
});

describe("pausar o ciclo e pausar a mesa", () => {
  const base = comAutomacoes(
    criarEstado([tocha("o1", "pulmao", { saldoMs: 100_000, duracaoMs: 100_000 })]),
    { reacoes: ANUNCIOS },
  );

  it("pausar o ciclo não para as tochas", () => {
    let e = ok(base, "m", intencao("ciclo.criar", { ciclo: RESPIRACAO })).estado;
    e = ok(e, "m", intencao("ciclo.pausar", { id: "respiracao" }), 10).estado;
    e = tempo(e, 95).estado;
    // o ciclo parou: nenhuma expiração em 95 s
    expect(anuncios(e)).toEqual(["inspirou@0"]);
    // a tocha seguiu queimando e acabou aos 100 s
    expect(objeto(e, "o1")).toBeDefined();
    e = tempo(e, 101).estado;
    expect(objeto(e, "o1")).toBeUndefined();
    // retomar: o ciclo volta de onde parou (10 s) e a expiração cai 80 s depois
    e = ok(e, "m", intencao("ciclo.retomar", { id: "respiracao" }), 200).estado;
    e = tempo(e, 279).estado;
    expect(anuncios(e)).toEqual(["inspirou@0"]);
    e = tempo(e, 280).estado;
    expect(anuncios(e)).toEqual(["inspirou@0", "expirou@280000"]);
  });

  it("pausar a mesa congela o ciclo e as tochas", () => {
    let e = ok(base, "m", intencao("ciclo.criar", { ciclo: RESPIRACAO })).estado;
    e = ok(e, "m", intencao("mesa.pausar"), 10).estado;
    const congelado = tempo(e, 500);
    expect(congelado.eventos).toEqual([]);
    expect(anuncios(congelado.estado)).toEqual(["inspirou@0"]);
    expect(proximoMarcoDasAutomacoes(e, 10_000)).not.toBeNull(); // o chamador não agenda pausada
    // retoma 490 s depois (tempo real): a sala só andou 10 s
    e = ok(congelado.estado, "m", intencao("mesa.retomar"), 500).estado;
    e = tempo(e, 579).estado;
    expect(anuncios(e)).toEqual(["inspirou@0"]);
    expect(objeto(e, "o1")).toBeDefined();
    e = tempo(e, 580).estado;
    expect(anuncios(e)).toEqual(["inspirou@0", "expirou@90000"]);
    // a tocha de 100 s só acaba aos 90 s de sala depois de 10 s: 500 + 90 = 590
    e = tempo(e, 589).estado;
    expect(objeto(e, "o1")).toBeDefined();
    e = tempo(e, 591).estado;
    expect(objeto(e, "o1")).toBeUndefined();
  });

  it("o ciclo criado pausado não começa; disparar pula para a fase seguinte e o ciclo continua dali", () => {
    let e = ok(base, "m", intencao("ciclo.criar", { ciclo: RESPIRACAO, pausado: true })).estado;
    e = tempo(e, 50).estado;
    expect(anuncios(e)).toEqual([]);
    e = ok(e, "m", intencao("ciclo.disparar", { id: "respiracao" }), 50).estado;
    expect(anuncios(e)).toEqual(["inspirou@50000"]);
    e = ok(e, "m", intencao("ciclo.disparar", { id: "respiracao" }), 51).estado;
    expect(anuncios(e)).toEqual(["inspirou@50000", "expirou@51000"]);
    expect(e.automacoes?.execucao.respiracao?.pausadoEmTau).toBe(90_000);
    // retoma em 60: o ciclo está em 90 s e a próxima inspiração (180 s) cai 90 s depois
    e = ok(e, "m", intencao("ciclo.retomar", { id: "respiracao" }), 60).estado;
    e = tempo(e, 149).estado;
    expect(anuncios(e)).toHaveLength(2);
    e = tempo(e, 150).estado;
    expect(anuncios(e)).toHaveLength(3);
  });
});

describe("o encadeamento tem limite", () => {
  const laco = reacao({
    id: "laco",
    fica: { tipo: "mesa" },
    ao: "a",
    fazer: [
      { acao: "chat.anunciar", texto: "x", para: "mestre" },
      { acao: "evento.disparar", evento: "a" },
    ],
  });
  const base = comAutomacoes(criarEstado(), { reacoes: [laco] });
  const evento: EventoDeAutomacao = { nome: "a", cenas: null, origem: "manual" };

  it("corta além da profundidade máxima e anota no registro do mestre", () => {
    const r = processarEvento(base, evento, fonteComSemente(1));
    // níveis 0 a 5 rodam; o seguinte é cortado
    expect(anuncios(r.estado)).toHaveLength(PROFUNDIDADE_MAXIMA + 1);
    expect(r.estado.automacoes?.registro.at(-1)?.texto).toContain("Encadeamento cortado");
  });

  it("partir de um nível alto reduz o que sobra", () => {
    const r = processarEvento(base, evento, fonteComSemente(1), PROFUNDIDADE_MAXIMA);
    expect(anuncios(r.estado)).toHaveLength(1);
  });

  it("o atraso não zera a conta: o laço no tempo também para", () => {
    const lento = reacao({
      id: "lento",
      fica: { tipo: "mesa" },
      ao: "a",
      fazer: [
        { acao: "chat.anunciar", texto: "y", para: "mestre" },
        { acao: "evento.disparar", evento: "a", atrasoS: 10 },
      ],
    });
    let e = processarEvento(
      comAutomacoes(criarEstado(), { reacoes: [lento] }),
      evento,
      fonteComSemente(1),
    ).estado;
    expect(e.automacoes?.pendentes).toHaveLength(1);
    for (let s = 10; s <= 100; s += 10) e = tempo(e, s).estado;
    expect(anuncios(e)).toHaveLength(PROFUNDIDADE_MAXIMA + 1);
    expect(e.automacoes?.pendentes).toEqual([]);
  });

  it("há um teto de ações por disparo", () => {
    const muitas = Array.from({ length: TETO_DE_ACOES + 20 }, (_, i) => tocha(`o${i}`));
    const base2 = comAutomacoes(criarEstado(muitas), {
      reacoes: [
        reacao({
          id: "todas",
          fica: { tipo: "mesa" },
          ao: "b",
          fazer: [{ acao: "luz.modificar", raioX: 0.5, porS: 5 }],
        }),
      ],
    });
    const r = processarEvento(
      base2,
      { nome: "b", cenas: null, origem: "manual" },
      fonteComSemente(1),
    );
    expect(r.estado.luzes.filter((l) => l.modificadores.length > 0)).toHaveLength(TETO_DE_ACOES);
    expect(r.estado.automacoes?.registro.at(-1)?.texto).toContain("cortada");
  });
});

describe("os modificadores com prazo", () => {
  const dobra = (id: string) =>
    reacao({
      id,
      fica: { tipo: "modelo", id: "modelo-tocha" },
      ao: "sopro",
      fazer: [{ acao: "luz.modificar", raioX: 0.5, porS: 20 }],
    });
  const evento: EventoDeAutomacao = { nome: "sopro", cenas: null, origem: "manual" };

  it("efeitos sobrepostos multiplicam, o refresh renova (não empilha) e nada fica preso", () => {
    let e = comAutomacoes(criarEstado(), { reacoes: [dobra("r1"), dobra("r2")] });
    e = processarEvento(e, evento, fonteComSemente(1), 0, iso(0)).estado;
    const v = visaoPara(e, MESTRE, T0).luzes[0];
    expect(v?.fatorDeRaio).toBe(0.25);
    // o mesmo disparo aos 10 s renova os dois (mesmo id), sem criar outros
    e = processarEvento(e, evento, fonteComSemente(1), 0, iso(10)).estado;
    expect(objeto(e, "o1")?.modificadores).toHaveLength(2);
    expect(objeto(e, "o1")?.modificadores.map((m) => m.ateSala)).toEqual([30_000, 30_000]);
    e = tempo(e, 29.9).estado;
    expect(objeto(e, "o1")?.modificadores).toHaveLength(2);
    e = tempo(e, 30.1).estado;
    expect(objeto(e, "o1")?.modificadores).toEqual([]);
    expect(visaoPara(e, MESTRE, T0 + 31_000).luzes[0]?.fatorDeRaio).toBeUndefined();
  });

  it("o jogador recebe o efeito, mas nunca a lista de modificadores nem a origem", () => {
    const e = processarEvento(
      comAutomacoes(criarEstado(), { reacoes: [dobra("r1")] }),
      evento,
      fonteComSemente(1),
      0,
      iso(0),
    ).estado;
    const dele = visaoPara(e, J1, T0).luzes[0];
    expect(dele?.fatorDeRaio).toBe(0.5);
    expect(dele?.modificadores).toEqual([]);
    expect(JSON.stringify(dele)).not.toContain("auto:");
  });

  it("o limite de visão é um efeito do token (o menor vale) e some no prazo", () => {
    const nevoa = (id: string, alcanceM: number) =>
      reacao({
        id,
        nome: SEGREDO,
        fica: { tipo: "mesa" },
        ao: "nevoa",
        fazer: [{ acao: "visao.limitar", alcanceM, porS: 10 }],
      });
    let e = comAutomacoes(criarEstado(), { reacoes: [nevoa("n1", 6), nevoa("n2", 3)] });
    e = processarEvento(
      e,
      { nome: "nevoa", cenas: ["pulmao"], origem: "manual" },
      fonteComSemente(1),
      0,
      iso(0),
    ).estado;
    expect(e.efeitos).toHaveLength(4);
    expect(limiteDeVisaoDoToken(e.efeitos, "t1", 5_000)).toBe(3);
    expect(limiteDeVisaoDoToken(e.efeitos, "t1", 11_000)).toBeNull();
    // o jogador só recebe o dele, resumido, sem prazo nem origem
    const j1 = visaoPara(e, J1, T0);
    expect(j1.efeitos).toEqual([
      { id: "visao:t1", alvo: { tipo: "token", id: "t1" }, efeito: { visaoMaxM: 3 } },
    ]);
    expect(JSON.stringify(j1)).not.toContain(SEGREDO);
    const r = tempo(e, 11);
    expect(r.estado.efeitos).toEqual([]);
    // o jogador do outro token não percebe a mudança no token alheio...
    const evt = r.eventos.find((x) => x.tipo === "efeitos.alterados");
    expect(evt).toBeDefined();
    if (evt) {
      const para = eventoPara(evt, J1, e, r.estado, T0 + 11_000);
      expect(para?.dados).toEqual({ efeitos: [] });
    }
  });
});

describe("o escopo por cena", () => {
  const base = comAutomacoes(criarEstado([tocha("a", "pulmao"), tocha("b", "fora")]), {
    reacoes: [REACAO_DA_TOCHA],
  });

  it("o evento de um ciclo só atinge o que está nas cenas dele", () => {
    const e = ok(base, "m", intencao("ciclo.criar", { ciclo: RESPIRACAO })).estado;
    expect(objeto(e, "a")?.modificadores).toHaveLength(1);
    expect(objeto(e, "b")?.modificadores).toEqual([]);
  });

  it("ciclo sem cenas vale para todas", () => {
    const e = ok(
      base,
      "m",
      intencao("ciclo.criar", { ciclo: { ...RESPIRACAO, cenas: [] } }),
    ).estado;
    expect(objeto(e, "a")?.modificadores).toHaveLength(1);
    expect(objeto(e, "b")?.modificadores).toHaveLength(1);
  });

  it("a reação presa a uma cena só roda para eventos dessa cena", () => {
    const daCena = reacao({
      id: "so-no-pulmao",
      fica: { tipo: "cena", id: "pulmao" },
      ao: "grito",
      fazer: [{ acao: "chat.anunciar", texto: "eco" }],
    });
    const e = comAutomacoes(criarEstado(), { reacoes: [daCena] });
    const noFora = processarEvento(
      e,
      { nome: "grito", cenas: ["fora"], origem: "manual" },
      fonteComSemente(1),
    );
    expect(anuncios(noFora.estado)).toEqual([]);
    const noPulmao = processarEvento(
      e,
      { nome: "grito", cenas: ["pulmao"], origem: "manual" },
      fonteComSemente(1),
    );
    expect(anuncios(noPulmao.estado)).toHaveLength(1);
    const emTodas = processarEvento(
      e,
      { nome: "grito", cenas: null, origem: "manual" },
      fonteComSemente(1),
    );
    expect(anuncios(emTodas.estado)).toHaveLength(1);
  });

  it("a condição de tag e a de cena valem para o alvo", () => {
    const so = (se: object[]) =>
      comAutomacoes(criarEstado([tocha("a", "pulmao"), tocha("b", "fora")]), {
        reacoes: [
          reacao({
            id: "c",
            fica: { tipo: "mesa" },
            ao: "e",
            fazer: [{ acao: "objeto.apagar", alvo: { tag: "chama" } }],
            se,
          }),
        ],
      });
    const apagadas = (e: Estado) => e.luzes.filter((l) => l.estado === "apagada").map((l) => l.id);
    const evento: EventoDeAutomacao = { nome: "e", cenas: null, origem: "manual" };
    expect(apagadas(processarEvento(so([]), evento, fonteComSemente(1)).estado)).toEqual([
      "a",
      "b",
    ]);
    // sem objeto no evento, `tag` não tem de quem falar: a reação não roda
    expect(
      apagadas(
        processarEvento(so([{ condicao: "tag", tag: "chama" }]), evento, fonteComSemente(1)).estado,
      ),
    ).toEqual([]);
    expect(
      apagadas(
        processarEvento(
          so([{ condicao: "cena", cenas: ["pulmao"] }]),
          { ...evento, cenas: ["pulmao"] },
          fonteComSemente(1),
        ).estado,
      ),
    ).toEqual(["a"]);
    expect(
      apagadas(
        processarEvento(so([{ condicao: "chance", valor: 0 }]), evento, fonteComSemente(1)).estado,
      ),
    ).toEqual([]);
  });
});

describe("os eventos do sistema", () => {
  const aviso = (id: string, ao: string, texto: string) =>
    reacao({ id, fica: { tipo: "mesa" }, ao, fazer: [{ acao: "chat.anunciar", texto }] });

  it("objeto.acendeu e objeto.apagou nascem de qualquer jeito de acender e apagar", () => {
    const base = comAutomacoes(criarEstado([tocha("o1", "pulmao", { estado: "apagada" })]), {
      reacoes: [aviso("r1", "objeto.acendeu", "acendeu"), aviso("r2", "objeto.apagou", "apagou")],
    });
    let e = ok(base, "m", intencao("tocha.alternar", { id: "o1" }), 5).estado;
    expect(anuncios(e)).toEqual(["acendeu@5000"]);
    e = ok(e, "m", intencao("tocha.alternar", { id: "o1" }), 6).estado;
    expect(anuncios(e)).toEqual(["acendeu@5000", "apagou@6000"]);
  });

  it("a tocha que acaba com o tempo também apaga (o alarme)", () => {
    const base = comAutomacoes(criarEstado([tocha("o1", "pulmao", { saldoMs: 10_000 })]), {
      reacoes: [aviso("r2", "objeto.apagou", "apagou")],
    });
    const e = tempo(base, 11).estado;
    expect(e.luzes).toEqual([]);
    expect(anuncios(e)).toEqual(["apagou@11000"]);
  });

  it("a reação do modelo vale para o objeto do evento: a tocha que apagou perde tempo da vizinha? não: só dela", () => {
    const reacaoDoModelo = reacao({
      id: "rm",
      fica: { tipo: "modelo", id: "modelo-tocha" },
      ao: "objeto.acendeu",
      fazer: [{ acao: "luz.modificar", raioSomaM: 2, porS: 60 }],
    });
    const base = comAutomacoes(
      criarEstado([tocha("o1", "pulmao", { estado: "apagada" }), tocha("o2")]),
      { reacoes: [reacaoDoModelo] },
    );
    const e = ok(base, "m", intencao("tocha.alternar", { id: "o1" }), 5).estado;
    expect(objeto(e, "o1")?.modificadores).toHaveLength(1);
    expect(objeto(e, "o1")?.modificadores[0]?.raioSomaM).toBe(2);
    expect(objeto(e, "o2")?.modificadores).toEqual([]);
  });

  it("cena.ativada e turno.inicio saem da diferença entre os estados", () => {
    const antes = criarEstado();
    const depois: Estado = {
      ...antes,
      cenaAtivaId: "fora",
      combate: { entradas: [{ id: "e1", tokenId: "t1", nome: "A" }], atualId: "e1", rodada: 1 },
    };
    expect(eventosDoSistema(antes, depois)).toEqual([
      { nome: "cena.ativada", cenas: ["fora"], origem: "sistema" },
      { nome: "turno.inicio", cenas: ["pulmao"], origem: "sistema", tokenId: "t1" },
    ]);
    expect(eventosDoSistema(depois, depois)).toEqual([]);
  });

  it("ativar a cena pelo mestre roda a reação de cena.ativada", () => {
    const base = comAutomacoes(criarEstado(), {
      reacoes: [aviso("r", "cena.ativada", "chegamos")],
    });
    const e = ok(base, "m", intencao("grupo.moverPara", { cenaId: "fora" }), 3).estado;
    expect(anuncios(e)).toEqual(["chegamos@3000"]);
  });

  it("o evento manual respeita a cena", () => {
    const base = comAutomacoes(criarEstado(), { reacoes: [aviso("r", "alarme", "alarme!")] });
    const r = ok(base, "m", intencao("evento.disparar", { evento: "alarme" }));
    expect(anuncios(r.estado)).toEqual(["alarme!@0"]);
    expect(
      processar(
        base,
        "m",
        intencao("evento.disparar", { evento: "alarme", cenaId: "nao-existe" }),
        iso(0),
      ),
    ).toMatchObject({ ok: false, erro: { codigo: "cena_inexistente" } });
  });
});

describe("as intenções de automação", () => {
  const TIPOS = [
    "ciclo.criar",
    "ciclo.editar",
    "ciclo.apagar",
    "ciclo.disparar",
    "ciclo.pausar",
    "ciclo.retomar",
    "reacao.criar",
    "reacao.editar",
    "reacao.apagar",
    "evento.disparar",
  ] as const;

  it("exigem automacao.editar, que não é delegável", () => {
    for (const t of TIPOS) expect(capacidadeDaIntencao[t]).toBe("automacao.editar");
    expect(ehCapacidadeDelegavel("automacao.editar")).toBe(false);
  });

  it("o jogador não cria, edita, dispara nem apaga nada", () => {
    const base = criarEstado();
    const pedidos: Intencao[] = [
      intencao("ciclo.criar", { ciclo: RESPIRACAO }),
      intencao("ciclo.apagar", { id: "x" }),
      intencao("ciclo.disparar", { id: "x" }),
      intencao("reacao.criar", { reacao: REACAO_DA_TOCHA }),
      intencao("evento.disparar", { evento: "x" }),
    ];
    for (const p of pedidos) {
      expect(processar(base, "j1", p, iso(0))).toMatchObject({
        ok: false,
        erro: { codigo: "sem_permissao" },
      });
    }
  });

  it("criar, editar e apagar ciclos e reações, com as conferências", () => {
    let e = criarEstado();
    e = ok(e, "m", intencao("reacao.criar", { reacao: REACAO_DA_TOCHA })).estado;
    expect(e.automacoes?.reacoes).toHaveLength(1);
    expect(
      processar(e, "m", intencao("reacao.criar", { reacao: REACAO_DA_TOCHA }), iso(0)),
    ).toMatchObject({ ok: false, erro: { codigo: "dados_invalidos" } });
    expect(
      processar(
        e,
        "m",
        intencao("reacao.criar", {
          reacao: { ...REACAO_DA_TOCHA, id: "outra", fica: { tipo: "modelo", id: "nao-existe" } },
        }),
        iso(0),
      ),
    ).toMatchObject({ ok: false, erro: { codigo: "modelo_inexistente" } });
    e = ok(
      e,
      "m",
      intencao("reacao.editar", { id: "tocha-respira", mudancas: { ativa: false } }),
    ).estado;
    expect(e.automacoes?.reacoes[0]?.ativa).toBe(false);
    // reação desligada não roda
    const r = processarEvento(
      e,
      { nome: "inspiracao", cenas: null, origem: "manual" },
      fonteComSemente(1),
    );
    expect(r.eventos).toEqual([]);
    expect(
      processar(e, "m", intencao("reacao.editar", { id: "nada", mudancas: {} }), iso(0)),
    ).toMatchObject({ ok: false, erro: { codigo: "reacao_inexistente" } });
    e = ok(e, "m", intencao("reacao.apagar", { id: "tocha-respira" })).estado;
    expect(e.automacoes?.reacoes).toEqual([]);

    e = ok(e, "m", intencao("ciclo.criar", { ciclo: RESPIRACAO, pausado: true })).estado;
    expect(processar(e, "m", intencao("ciclo.criar", { ciclo: RESPIRACAO }), iso(0))).toMatchObject(
      { ok: false, erro: { codigo: "dados_invalidos" } },
    );
    expect(
      processar(
        e,
        "m",
        intencao("ciclo.criar", { ciclo: { ...RESPIRACAO, id: "z", cenas: ["sumiu"] } }),
        iso(0),
      ),
    ).toMatchObject({ ok: false, erro: { codigo: "cena_inexistente" } });
    // mudar só o nome mantém a execução; mudar o período a reinicia (e mantém pausado)
    e = ok(e, "m", intencao("ciclo.disparar", { id: "respiracao" }), 5).estado;
    e = ok(
      e,
      "m",
      intencao("ciclo.editar", { id: "respiracao", mudancas: { nome: "Outro" } }),
      6,
    ).estado;
    expect(e.automacoes?.execucao.respiracao?.disparadoAteTau).toBe(0);
    e = ok(
      e,
      "m",
      intencao("ciclo.editar", { id: "respiracao", mudancas: { periodoS: 200 } }),
      7,
    ).estado;
    expect(e.automacoes?.execucao.respiracao).toEqual({
      baseSala: 7000,
      pausadoEmTau: 0,
      disparadoAteTau: -1,
    });
    expect(
      processar(
        e,
        "m",
        intencao("ciclo.editar", { id: "respiracao", mudancas: { periodoS: 10 } }),
        iso(8),
      ),
    ).toMatchObject({ ok: false, erro: { codigo: "dados_invalidos" } });
    e = ok(e, "m", intencao("ciclo.apagar", { id: "respiracao" })).estado;
    expect(e.automacoes?.ciclos).toEqual([]);
    expect(e.automacoes?.execucao).toEqual({});
    expect(processar(e, "m", intencao("ciclo.pausar", { id: "respiracao" }), iso(0))).toMatchObject(
      { ok: false, erro: { codigo: "ciclo_inexistente" } },
    );
  });
});

describe("o sigilo: nada de automação chega ao jogador", () => {
  const montar = () => {
    let e = comAutomacoes(criarEstado(), { reacoes: [{ ...REACAO_DA_TOCHA }, ...ANUNCIOS] });
    const frames: EventoSala[] = [];
    const guardar = (r: ReturnType<typeof ok>) => {
      frames.push(...r.eventos);
      e = r.estado;
    };
    guardar(
      ok(
        e,
        "m",
        intencao("reacao.criar", { reacao: { ...REACAO_DA_TOCHA, id: "outra", nome: SEGREDO } }),
      ),
    );
    guardar(ok(e, "m", intencao("ciclo.criar", { ciclo: { ...RESPIRACAO, nome: SEGREDO } })));
    guardar(ok(e, "m", intencao("ciclo.pausar", { id: "respiracao" }), 5));
    guardar(ok(e, "m", intencao("ciclo.retomar", { id: "respiracao" }), 6));
    guardar(ok(e, "m", intencao("evento.disparar", { evento: "inspiracao" }), 7));
    const antes = e;
    const tempoPassou = tempo(e, 40);
    frames.push(...tempoPassou.eventos);
    e = tempoPassou.estado;
    return { e, frames, antes };
  };

  it("o snapshot do jogador não traz a fatia de automações nem a origem", () => {
    const { e } = montar();
    expect(e.automacoes?.ciclos).toHaveLength(1);
    for (const j of [J1, J2]) {
      const visto = visaoPara(e, j, T0 + 40_000);
      expect(visto.automacoes).toBeUndefined();
      const texto = JSON.stringify(visto);
      expect(texto).not.toContain(SEGREDO);
      expect(texto).not.toContain("respiracao");
      expect(texto).not.toContain("tocha-respira");
      expect(texto).not.toContain("automacoes");
    }
    // o mestre vê tudo
    expect(visaoPara(e, MESTRE, T0 + 40_000).automacoes?.ciclos[0]?.nome).toBe(SEGREDO);
  });

  it("nenhum frame do jogador traz a definição de uma automação, só os efeitos", () => {
    const { frames, antes } = montar();
    expect(frames.some((f) => f.tipo === "automacoes.alterado")).toBe(true);
    const recebidos: EventoSala[] = [];
    for (const f of frames) {
      const v = eventoPara(f, J1, antes, antes, T0 + 40_000);
      if (v) recebidos.push(v);
    }
    const texto = JSON.stringify(recebidos);
    expect(texto).not.toContain(SEGREDO);
    expect(texto).not.toContain("automacoes");
    expect(texto).not.toContain("respiracao");
    expect(texto).not.toContain("tocha-respira");
    expect(texto).not.toContain("auto:");
    // chegam os efeitos: a luz que mudou e o anúncio do chat
    expect(nomes(recebidos)).toContain("fonte.editada");
    expect(nomes(recebidos)).toContain("chat.mensagem");
    expect(nomes(recebidos)).not.toContain("automacoes.alterado");
  });

  it("o mestre recebe os eventos de automação e o anúncio só para o mestre não chega ao jogador", () => {
    const base = comAutomacoes(criarEstado(), {
      reacoes: [
        reacao({
          id: "r",
          fica: { tipo: "mesa" },
          ao: "x",
          fazer: [{ acao: "chat.anunciar", texto: "so-mestre", para: "mestre" }],
        }),
      ],
    });
    const r = ok(base, "m", intencao("evento.disparar", { evento: "x" }));
    expect(r.eventos.map((e) => eventoPara(e, MESTRE, base, r.estado, T0)?.tipo)).toContain(
      "chat.mensagem",
    );
    for (const e of r.eventos) {
      const v = eventoPara(e, J1, base, r.estado, T0);
      expect(JSON.stringify(v)).not.toContain("so-mestre");
    }
  });
});

describe("exportar, importar e a campanha antiga", () => {
  const completo = () => {
    let e = comAutomacoes(criarEstado(), { reacoes: [REACAO_DA_TOCHA, ...ANUNCIOS] });
    e = ok(e, "m", intencao("ciclo.criar", { ciclo: RESPIRACAO })).estado;
    e = processarEvento(
      comAutomacoes(e, {
        ...e.automacoes,
        reacoes: [
          ...(e.automacoes?.reacoes ?? []),
          reacao({
            id: "n",
            fica: { tipo: "mesa" },
            ao: "nevoa",
            fazer: [{ acao: "visao.limitar", alcanceM: 3, porS: 600 }],
          }),
        ],
      }),
      { nome: "nevoa", cenas: null, origem: "manual" },
      fonteComSemente(1),
    ).estado;
    return e;
  };

  it("a exportação leva as automações, a execução e os efeitos, e a importação os devolve", () => {
    const e = completo();
    const arquivo = JSON.parse(JSON.stringify(criarExportacao(e, iso(30))));
    const lida = lerExportacao(arquivo);
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.exportacao.dados.automacoes).toEqual(e.automacoes);
    expect(lida.exportacao.dados.efeitos).toEqual(e.efeitos);
    const r = ok(criarEstado(), "m", intencao("campanha.importar", { dados: arquivo }));
    expect(r.estado.automacoes).toEqual(e.automacoes);
    expect(r.estado.efeitos).toEqual(e.efeitos);
    // a mesa importada começa pausada, no tempo em que foi exportada: o ciclo segue de onde estava
    expect(r.estado.relogio.pausada).toBe(true);
  });

  it("o arquivo antigo (sem automações) carrega sem elas e a sala roda igual", () => {
    const arquivo = JSON.parse(JSON.stringify(criarExportacao(criarEstado(), iso(0))));
    expect(arquivo.dados.automacoes).toBeUndefined();
    const lida = lerExportacao(arquivo);
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.exportacao.dados.automacoes).toBeUndefined();
    const importado = ok(
      criarEstado(),
      "m",
      intencao("campanha.importar", { dados: arquivo }),
    ).estado;
    expect(importado.automacoes).toBeUndefined();
    expect(tempo(importado, 100).eventos).toEqual([]);
    expect(visaoPara(importado, J1, T0).automacoes).toBeUndefined();
  });

  it("a forma enxuta do arquivo (ciclos no topo, reações dentro do modelo) vira a fatia automacoes", () => {
    const arquivo = JSON.parse(JSON.stringify(criarExportacao(criarEstado(), iso(0))));
    arquivo.dados.ciclos = [RESPIRACAO];
    arquivo.dados.modelos = arquivo.dados.modelos.map((m: { id: string }) =>
      m.id === "modelo-tocha"
        ? {
            ...m,
            reacoes: [
              {
                ao: "inspiracao",
                fazer: [
                  { acao: "luz.modificar", raioX: 0.5, porS: 20 },
                  { acao: "objeto.apagar", chance: 0.3, penalidadeS: 300 },
                ],
              },
            ],
          }
        : m,
    );
    const lida = lerExportacao(arquivo);
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    const a = lida.exportacao.dados.automacoes;
    expect(a?.ciclos[0]?.id).toBe("respiracao");
    expect(a?.reacoes[0]).toMatchObject({
      id: "reacao-modelo-tocha-1",
      fica: { tipo: "modelo", id: "modelo-tocha" },
      ao: "inspiracao",
      ativa: true,
      se: [],
    });
    // o modelo exportado não carrega a reação (a definição mora só na fatia)
    expect(JSON.stringify(lida.exportacao.dados.modelos)).not.toContain("inspiracao");
    // o ciclo do arquivo (sem execução) começa quando a mesa corre
    const e = ok(criarEstado(), "m", intencao("campanha.importar", { dados: arquivo })).estado;
    expect(e.automacoes?.execucao).toEqual({});
    const rodando = ok(e, "m", intencao("mesa.retomar"), 10).estado;
    expect(rodando.automacoes?.execucao.respiracao?.disparadoAteTau).toBe(0);
    expect(objeto(rodando, "o1")?.modificadores).toHaveLength(1);
  });

  it("ids repetidos de ciclo ou de reação recusam o arquivo", () => {
    const arquivo = JSON.parse(JSON.stringify(criarExportacao(completo(), iso(0))));
    arquivo.dados.automacoes.ciclos.push(arquivo.dados.automacoes.ciclos[0]);
    expect(lerExportacao(arquivo)).toMatchObject({ ok: false });
  });

  it("a conversão não mexe no que não é objeto", () => {
    expect(converterAutomacoesDoArquivo(null)).toBeNull();
    expect(converterAutomacoesDoArquivo({ dados: 3 })).toEqual({ dados: 3 });
  });
});

describe("a fatia no estado (reduzir)", () => {
  it("o evento automacoes.alterado e efeitos.alterados trocam as fatias", () => {
    const e = criarEstado();
    const r = ok(e, "m", intencao("reacao.criar", { reacao: REACAO_DA_TOCHA }));
    expect(nomes(r.eventos)).toEqual(["automacoes.alterado"]);
    expect(r.estado.seq).toBe(e.seq + 1);
  });
});
