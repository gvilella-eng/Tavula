import { describe, expect, it } from "vitest";
import { ehCapacidadeDelegavel } from "./capacidades.ts";
import {
  AcaoDeFluxoSchema,
  AutomacoesSchema,
  type Bloco,
  capacidadeDaIntencao,
  converterAutomacoesDoArquivo,
  criarExportacao,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  type Fluxo,
  FluxoDeQualquerFormaSchema,
  fonteComSemente,
  fraseDoFluxo,
  gatilhoPrincipal,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  limiteDeVisaoDoToken,
  modelosPadrao,
  nomesDaMesa,
  type ObjetoDeLuz,
  PROFUNDIDADE_MAXIMA,
  processar,
  processarSistema,
  proximoMarcoDasAutomacoes,
  TETO_DE_ACOES,
  visaoPara,
} from "./index.ts";

// Relógio falso: a sala "começa" em T0 (mesa rodando) e cada teste passa o `agora` que quiser, em segundos.
const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (segundos: number) => new Date(T0 + segundos * 1000).toISOString();

const MESTRE = { id: "m", papel: "mestre" as const };
const J1 = { id: "j1", papel: "jogador" as const };

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
      modelos: modelosPadrao().map((m) =>
        m.id === "modelo-lanterna" ? { ...m, tags: ["luz"] } : m,
      ),
      luzes,
      tokens: [token("t1", "pulmao", "j1"), token("t2", "pulmao", "j2")],
    },
    T0,
  );
}

const fluxo = (parcial: Record<string, unknown>): Fluxo => {
  const f = FluxoDeQualquerFormaSchema.parse({
    id: "f1",
    nome: "Fluxo",
    gatilho: { tipo: "botao", nome: "Botão" },
    trilhas: [[]],
    ...parcial,
  });
  // A forma de árvore (AU1) não conhece `naCenaAtiva` (AU4): entra no grafo depois.
  return parcial.naCenaAtiva === undefined
    ? f
    : { ...f, naCenaAtiva: parcial.naCenaAtiva as boolean };
};
/** As mudanças de desenho (nós e fios) de um fluxo montado como árvore (o `fluxo.editar` troca o desenho inteiro). */
const muda = (parcial: Record<string, unknown>) => {
  const g = fluxo(parcial);
  return { nos: g.nos, fios: g.fios };
};
const comFluxos = (e: Estado, ...fluxos: Fluxo[]): Estado => ({
  ...e,
  automacoes: AutomacoesSchema.parse({ fluxos }),
});

const acao = (a: object): Bloco => ({ bloco: "acao", acao: a }) as Bloco;
const anunciar = (texto: string, para = "todos"): Bloco =>
  acao({ acao: "chat.anunciar", texto, para });
const paraCadaObjeto = (corpo: Bloco[], alvo: object = {}): Bloco =>
  ({
    bloco: "paraCada",
    alvo: { tipo: "objetos", ...alvo },
    corpo,
  }) as Bloco;
const paraCadaToken = (corpo: Bloco[], alvo: object = {}): Bloco =>
  ({
    bloco: "paraCada",
    alvo: { tipo: "tokens", ...alvo },
    corpo,
  }) as Bloco;
const esperar = (s: number): Bloco => ({ bloco: "esperar", s });
const sinal = (nome: string, atrasoS?: number): Bloco =>
  ({ bloco: "sinal", nome, ...(atrasoS === undefined ? {} : { atrasoS }) }) as Bloco;
const luz = (raioX: number, porS: number): Bloco => acao({ acao: "luz.modificar", raioX, porS });

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
const disparar = (e: Estado, id = "f1", segundos = 0, rng = fonteComSemente(1)) =>
  ok(e, "m", intencao("fluxo.disparar", { id }), segundos, rng);
const textos = (e: Estado) => (e.chat ?? []).filter((m) => m.tipo === "aviso").map((m) => m.texto);
const objeto = (e: Estado, id: string) => e.luzes.find((l) => l.id === id);
const nomes = (eventos: EventoSala[]) => eventos.map((e) => e.tipo);
const registro = (e: Estado) => (e.automacoes?.registro ?? []).map((r) => r.texto);
const modificadoresDe = (e: Estado, id: string) => objeto(e, id)?.modificadores ?? [];

describe("os schemas dos fluxos", () => {
  it("uma ação fora da lista é recusada (sem código livre; som.tocar pede o som; zona.ativar pede a zona)", () => {
    expect(AcaoDeFluxoSchema.safeParse({ acao: "codigo.livre", js: "1" }).success).toBe(false);
    expect(AcaoDeFluxoSchema.safeParse({ acao: "som.tocar", nome: "x" }).success).toBe(false);
    expect(AcaoDeFluxoSchema.safeParse({ acao: "zona.ativar", ativa: true }).success).toBe(false);
    expect(AcaoDeFluxoSchema.safeParse({ acao: "luz.modificar" }).success).toBe(false);
    expect(AcaoDeFluxoSchema.safeParse({ acao: "luz.modificar", raioX: 0.5 }).success).toBe(true);
  });

  it("a intenção com ação fora da lista nem chega ao motor", () => {
    expect(() =>
      intencao("fluxo.criar", {
        fluxo: {
          id: "f1",
          nome: "x",
          gatilho: { tipo: "botao", nome: "B" },
          trilhas: [[acao({ acao: "apagar.tudo" })]],
        },
      }),
    ).toThrow();
  });

  it('o fluxo confere o nome, o relógio e as saídas; o "não" é opcional', () => {
    expect(
      FluxoDeQualquerFormaSchema.safeParse({
        id: "x",
        nome: " ",
        gatilho: { tipo: "turno" },
        trilhas: [[]],
      }).success,
    ).toBe(false);
    expect(
      FluxoDeQualquerFormaSchema.safeParse({
        id: "x",
        nome: "a",
        gatilho: { tipo: "relogio", cadaS: 0 },
        trilhas: [[]],
      }).success,
    ).toBe(false);
    expect(
      FluxoDeQualquerFormaSchema.safeParse({
        id: "x",
        nome: "a",
        gatilho: { tipo: "turno" },
        trilhas: [],
      }).success,
    ).toBe(false);
    const f = fluxo({ trilhas: [[{ bloco: "sortear", chance: 0.5, sim: [anunciar("a")] }]] });
    expect(f.nos.find((n) => n.tipo === "sortear")).toMatchObject({ config: { chance: 0.5 } });
    expect(f.ligado).toBe(true);
    expect(f.cenas).toBeNull();
  });
});

describe("o relógio: a cada tantos segundos", () => {
  const dezS = () =>
    comFluxos(
      criarEstado(),
      fluxo({
        gatilho: { tipo: "relogio", cadaS: 10 },
        trilhas: [[paraCadaObjeto([luz(0.5, 5)])]],
      }),
    );

  it("dispara ao começar, a luz muda e volta no prazo, e dispara de novo no período seguinte", () => {
    // a mesa já corre: a primeira passada cria o relógio e dispara
    let e = tempo(dezS(), 0).estado;
    expect(modificadoresDe(e, "o1")).toHaveLength(1);
    expect(modificadoresDe(e, "o1")[0]).toMatchObject({ raioX: 0.5 });
    e = tempo(e, 6).estado;
    expect(modificadoresDe(e, "o1")).toHaveLength(0);
    e = tempo(e, 9).estado;
    expect(modificadoresDe(e, "o1")).toHaveLength(0);
    e = tempo(e, 10).estado;
    expect(modificadoresDe(e, "o1")).toHaveLength(1);
    // o valor base nunca muda
    expect(objeto(e, "o1")?.luz.claraM).toBe(6);
  });

  it("o alarme sabe quando acordar: o próximo disparo", () => {
    let e = tempo(dezS(), 0).estado;
    // (o fim do efeito de luz é marco do objeto, não da fatia de automações: o que vale aqui é o próximo disparo)
    expect(proximoMarcoDasAutomacoes(e, 0)).toBe(10_000);
    e = tempo(e, 6).estado;
    expect(proximoMarcoDasAutomacoes(e, 6_000)).toBe(4_000);
  });

  it("desligado, o relógio para; ligado de novo, segue de onde parou", () => {
    let e = tempo(dezS(), 0).estado;
    e = ok(e, "m", intencao("fluxo.ligar", { id: "f1", ligado: false }), 4).estado;
    e = tempo(e, 30).estado;
    expect(modificadoresDe(e, "o1")).toHaveLength(0);
    e = ok(e, "m", intencao("fluxo.ligar", { id: "f1", ligado: true }), 40).estado;
    // parou no instante 4 do período de 10: faltam 6 s
    expect(tempo(e, 45).estado.automacoes?.execucao.f1?.pausadoEmTau).toBeUndefined();
    expect(modificadoresDe(tempo(e, 45).estado, "o1")).toHaveLength(0);
    expect(modificadoresDe(tempo(e, 46).estado, "o1")).toHaveLength(1);
  });
});

describe("esperar", () => {
  const comEspera = () =>
    comFluxos(
      criarEstado(),
      fluxo({ trilhas: [[anunciar("antes"), esperar(30), anunciar("depois")]] }),
    );

  it("a trilha segue só depois do tempo, no tempo da sala", () => {
    let e = disparar(comEspera()).estado;
    expect(textos(e)).toEqual(["antes"]);
    expect(e.automacoes?.esperando).toHaveLength(1);
    e = tempo(e, 29).estado;
    expect(textos(e)).toEqual(["antes"]);
    e = tempo(e, 31).estado;
    expect(textos(e)).toEqual(["antes", "depois"]);
    expect(e.automacoes?.esperando).toEqual([]);
  });

  it("pausar a mesa pausa a espera", () => {
    let e = disparar(comEspera()).estado;
    e = ok(e, "m", intencao("mesa.pausar"), 10).estado;
    // 90 s parada: não conta
    e = ok(e, "m", intencao("mesa.retomar"), 100).estado;
    e = tempo(e, 119).estado;
    expect(textos(e)).toEqual(["antes"]);
    e = tempo(e, 121).estado;
    expect(textos(e)).toEqual(["antes", "depois"]);
  });

  it("a execução esperando sobrevive à hibernação (vai e volta pelo JSON)", () => {
    let e = disparar(comEspera()).estado;
    const guardada = AutomacoesSchema.parse(JSON.parse(JSON.stringify(e.automacoes)));
    e = { ...e, automacoes: guardada };
    e = tempo(e, 31).estado;
    expect(textos(e)).toEqual(["antes", "depois"]);
  });

  it("desligar cancela o que estava esperando", () => {
    let e = disparar(comEspera()).estado;
    e = ok(e, "m", intencao("fluxo.ligar", { id: "f1", ligado: false }), 5).estado;
    expect(e.automacoes?.esperando).toEqual([]);
    e = tempo(e, 60).estado;
    expect(textos(e)).toEqual(["antes"]);
  });

  it('espera no meio de um "se" continua o que vem depois do "se"', () => {
    const f = fluxo({
      trilhas: [
        [
          {
            bloco: "se",
            condicao: { condicao: "cena", cenas: ["pulmao"] },
            sim: [esperar(5), anunciar("dentro")],
            nao: [],
          } as Bloco,
          anunciar("fim"),
        ],
      ],
    });
    let e = disparar(comFluxos(criarEstado(), f)).estado;
    expect(textos(e)).toEqual([]);
    e = tempo(e, 6).estado;
    expect(textos(e)).toEqual(["dentro", "fim"]);
  });

  it('espera dentro de um "para cada" segura só aquele alvo: o que vem depois não espera', () => {
    const f = fluxo({
      trilhas: [[paraCadaToken([esperar(5), acao({ acao: "token.ocultar" })]), anunciar("já")]],
    });
    let e = disparar(comFluxos(criarEstado(), f)).estado;
    expect(textos(e)).toEqual(["já"]);
    expect(e.automacoes?.esperando).toHaveLength(2);
    e = tempo(e, 6).estado;
    expect(e.tokens.every((t) => t.oculto)).toBe(true);
  });
});

describe("se, sortear e para cada", () => {
  it("sortear com a mesma semente dá o mesmo resultado, e com outra pode mudar", () => {
    const f = fluxo({
      trilhas: [
        [
          paraCadaObjeto([
            {
              bloco: "sortear",
              chance: 0.5,
              sim: [acao({ acao: "objeto.apagar" })],
              nao: [],
            } as Bloco,
          ]),
        ],
      ],
    });
    const luzes = Array.from({ length: 12 }, (_, i) => tocha(`o${i}`));
    const base = comFluxos(criarEstado(luzes), f);
    const apagadas = (semente: number) =>
      disparar(base, "f1", 0, fonteComSemente(semente))
        .estado.luzes.filter((l) => l.estado === "apagada")
        .map((l) => l.id);
    expect(apagadas(3)).toEqual(apagadas(3));
    expect(apagadas(3).length).toBeGreaterThan(0);
    expect(apagadas(3).length).toBeLessThan(12);
    expect(new Set([1, 2, 3, 4, 5, 6].map((s) => apagadas(s).join(","))).size).toBeGreaterThan(1);
  });

  it('"se" com o "não": roda um lado ou o outro', () => {
    const f = fluxo({
      trilhas: [
        [
          paraCadaObjeto([
            {
              bloco: "se",
              condicao: { condicao: "etiqueta", etiqueta: "chama" },
              sim: [anunciar("é chama")],
              nao: [anunciar("não é chama")],
            } as Bloco,
          ]),
        ],
      ],
    });
    const sem = tocha("outra", "pulmao", { modeloId: "modelo-lanterna" });
    const e = disparar(comFluxos(criarEstado([tocha("o1"), sem]), f)).estado;
    expect(textos(e).sort()).toEqual(["não é chama", "é chama"]);
  });

  it('"para cada" de objetos filtra por modelo, etiqueta e aceso; o de tokens, por cena e id', () => {
    const luzes = [tocha("a"), tocha("b", "pulmao", { estado: "apagada" }), tocha("c", "fora")];
    const f = fluxo({
      cenas: ["pulmao"],
      trilhas: [
        [
          paraCadaObjeto([acao({ acao: "objeto.ajustarTempo", deltaS: -60 })], {
            acesos: true,
            etiqueta: "chama",
          }),
        ],
      ],
    });
    const e = disparar(comFluxos(criarEstado(luzes), f)).estado;
    expect(objeto(e, "a")?.saldoMs).toBe(1_740_000);
    expect(objeto(e, "b")?.saldoMs).toBe(1_800_000);
    expect(objeto(e, "c")?.saldoMs).toBe(1_800_000);
    const g = fluxo({
      trilhas: [
        [paraCadaToken([acao({ acao: "visao.limitar", alcanceM: 3, porS: 60 })], { ids: ["t1"] })],
      ],
    });
    const e2 = disparar(comFluxos(criarEstado(), g)).estado;
    expect(limiteDeVisaoDoToken(e2.efeitos, "t1", 1000)).toBe(3);
    expect(limiteDeVisaoDoToken(e2.efeitos, "t2", 1000)).toBeNull();
  });

  it("uma ação sem alvo não faz nada e o motor anota", () => {
    const f = fluxo({ trilhas: [[luz(0.5, 5)]] });
    const e = disparar(comFluxos(criarEstado(), f)).estado;
    expect(modificadoresDe(e, "o1")).toEqual([]);
    expect(registro(e).join(" ")).toContain("sem alvo");
  });

  it("a chance de apagar desconta a penalidade do que sobra e anota no histórico", () => {
    const f = fluxo({
      trilhas: [[paraCadaObjeto([acao({ acao: "objeto.apagar", penalidadeS: 300 })])]],
    });
    const e = disparar(comFluxos(criarEstado(), f), "f1", 60).estado;
    const o = objeto(e, "o1");
    expect(o?.estado).toBe("apagada");
    expect(o?.saldoMs).toBe(1_800_000 - 60_000 - 300_000);
    expect(o?.historico.at(-1)?.texto).toContain("penalidade");
  });

  it("efeitos sobrepostos multiplicam, o refresh renova (não empilha) e nada fica preso", () => {
    const f = fluxo({ trilhas: [[paraCadaObjeto([luz(0.5, 20)])]] });
    const g = fluxo({ id: "f2", trilhas: [[paraCadaObjeto([luz(0.5, 20)])]] });
    let e = disparar(comFluxos(criarEstado(), f, g), "f1", 0).estado;
    e = disparar(e, "f2", 5).estado;
    e = disparar(e, "f1", 10).estado;
    expect(modificadoresDe(e, "o1")).toHaveLength(2);
    const base = objeto(e, "o1");
    expect(base?.luz.claraM).toBe(6);
    e = tempo(e, 40).estado;
    expect(modificadoresDe(e, "o1")).toEqual([]);
  });
});

describe("os limites", () => {
  it("um sinal que chama a si mesmo é cortado além da profundidade máxima e anota no registro", () => {
    const f = fluxo({
      gatilho: { tipo: "sinal", nome: "ping" },
      trilhas: [[anunciar("tic"), sinal("ping")]],
    });
    const g = fluxo({ id: "f0", nome: "Começa", trilhas: [[sinal("ping")]] });
    const e = disparar(comFluxos(criarEstado(), g, f), "f0").estado;
    expect(textos(e)).toHaveLength(PROFUNDIDADE_MAXIMA);
    expect(registro(e).join(" ")).toContain("Encadeamento cortado");
  });

  it("o atraso não zera a conta: o laço no tempo também para", () => {
    const f = fluxo({
      gatilho: { tipo: "sinal", nome: "ping" },
      trilhas: [[anunciar("tic"), sinal("ping", 1)]],
    });
    const g = fluxo({ id: "f0", nome: "Começa", trilhas: [[sinal("ping", 1)]] });
    let e = disparar(comFluxos(criarEstado(), g, f), "f0").estado;
    for (let t = 1; t <= 20; t++) e = tempo(e, t).estado;
    expect(textos(e)).toHaveLength(PROFUNDIDADE_MAXIMA);
    expect(registro(e).join(" ")).toContain("Encadeamento cortado");
    expect(e.automacoes?.esperando).toEqual([]);
  });

  it("há um teto de ações por disparo", () => {
    const luzes = Array.from({ length: 30 }, (_, i) => tocha(`o${i}`));
    const f = fluxo({
      trilhas: [
        Array.from({ length: Math.ceil(TETO_DE_ACOES / 30) + 3 }, () =>
          paraCadaObjeto([luz(0.9, 5)]),
        ),
      ],
    });
    const e = disparar(comFluxos(criarEstado(luzes), f)).estado;
    expect(registro(e).join(" ")).toContain("Automação cortada");
  });
});

describe("o escopo por cena", () => {
  it("o fluxo preso a uma cena só atinge o que está nela", () => {
    const f = fluxo({ cenas: ["fora"], trilhas: [[paraCadaObjeto([luz(0.5, 5)])]] });
    const e = disparar(
      comFluxos(criarEstado([tocha("a", "pulmao"), tocha("b", "fora")]), f),
    ).estado;
    expect(modificadoresDe(e, "a")).toEqual([]);
    expect(modificadoresDe(e, "b")).toHaveLength(1);
  });

  it("sem cenas vale para todas", () => {
    const f = fluxo({ trilhas: [[paraCadaObjeto([luz(0.5, 5)])]] });
    const e = disparar(
      comFluxos(criarEstado([tocha("a", "pulmao"), tocha("b", "fora")]), f),
    ).estado;
    expect(modificadoresDe(e, "a")).toHaveLength(1);
    expect(modificadoresDe(e, "b")).toHaveLength(1);
  });

  describe("AU4: cena ativa", () => {
    const dois = () => criarEstado([tocha("a", "pulmao"), tocha("b", "fora")]);

    it("só atinge o que está na cena ativa", () => {
      const f = fluxo({ naCenaAtiva: true, trilhas: [[paraCadaObjeto([luz(0.5, 5)])]] });
      const e = disparar(comFluxos(dois(), f)).estado;
      expect(modificadoresDe(e, "a")).toHaveLength(1);
      expect(modificadoresDe(e, "b")).toEqual([]);
    });

    it("depois de trocar a cena do grupo, vale na nova", () => {
      const f = fluxo({ naCenaAtiva: true, trilhas: [[paraCadaObjeto([luz(0.5, 5)])]] });
      const trocada = ok(
        comFluxos(dois(), f),
        "m",
        intencao("grupo.moverPara", { cenaId: "fora" }),
        1,
      ).estado;
      const e = disparar(trocada, "f1", 2).estado;
      expect(modificadoresDe(e, "a")).toEqual([]);
      expect(modificadoresDe(e, "b")).toHaveLength(1);
    });

    it("soma-se às cenas marcadas", () => {
      const f = fluxo({
        naCenaAtiva: true,
        cenas: ["fora"],
        trilhas: [[paraCadaObjeto([luz(0.5, 5)])]],
      });
      const e = disparar(comFluxos(dois(), f)).estado;
      expect(modificadoresDe(e, "a")).toHaveLength(1);
      expect(modificadoresDe(e, "b")).toHaveLength(1);
    });

    it("um evento de outra cena não dispara um fluxo que só vale na ativa", () => {
      const quem = fluxo({ id: "f0", nome: "Quem", cenas: ["fora"], trilhas: [[sinal("vento")]] });
      const ouve = fluxo({
        naCenaAtiva: true,
        gatilho: { tipo: "sinal", nome: "vento" },
        trilhas: [[paraCadaObjeto([luz(0.5, 5)])]],
      });
      const e = disparar(comFluxos(dois(), quem, ouve), "f0").estado;
      expect(modificadoresDe(e, "a")).toEqual([]);
      expect(modificadoresDe(e, "b")).toEqual([]);
    });

    it("sem marcar nada e sem cena ativa, vale em todas", () => {
      const f = fluxo({ naCenaAtiva: false, trilhas: [[paraCadaObjeto([luz(0.5, 5)])]] });
      const e = disparar(comFluxos(dois(), f)).estado;
      expect(modificadoresDe(e, "a")).toHaveLength(1);
      expect(modificadoresDe(e, "b")).toHaveLength(1);
    });

    it("a frase diz 'na cena ativa'", () => {
      const e = dois();
      const nomes = nomesDaMesa(e);
      const frase = (p: Record<string, unknown>) => fraseDoFluxo(fluxo(p), nomes);
      expect(frase({ naCenaAtiva: true })).toContain("na cena ativa");
      expect(frase({ naCenaAtiva: true })).not.toContain("na cena ativa e");
      expect(frase({ naCenaAtiva: true, cenas: ["fora"] })).toContain(
        "na cena ativa e na cena Fora",
      );
      expect(frase({ naCenaAtiva: true, cenas: ["fora", "pulmao"] })).toContain(
        "na cena ativa e nas cenas Fora e Pulmão",
      );
      expect(frase({})).not.toContain("cena ativa");
    });

    it("o schema aceita o campo e ele é opcional", () => {
      expect(fluxo({ naCenaAtiva: true }).naCenaAtiva).toBe(true);
      expect(fluxo({}).naCenaAtiva).toBeUndefined();
    });
  });

  it("um sinal leva as cenas de quem o mandou", () => {
    const quem = fluxo({ id: "f0", nome: "Quem", cenas: ["fora"], trilhas: [[sinal("vento")]] });
    const ouve = fluxo({
      gatilho: { tipo: "sinal", nome: "vento" },
      trilhas: [[paraCadaObjeto([luz(0.5, 5)])]],
    });
    const e = disparar(
      comFluxos(criarEstado([tocha("a", "pulmao"), tocha("b", "fora")]), quem, ouve),
      "f0",
    ).estado;
    expect(modificadoresDe(e, "a")).toEqual([]);
    expect(modificadoresDe(e, "b")).toHaveLength(1);
  });

  it('"se na cena" estreita o escopo dentro do "sim"', () => {
    const f = fluxo({
      trilhas: [
        [
          {
            bloco: "se",
            condicao: { condicao: "cena", cenas: ["fora"] },
            sim: [paraCadaObjeto([luz(0.5, 5)])],
            nao: [],
          } as Bloco,
        ],
      ],
    });
    const e = disparar(
      comFluxos(criarEstado([tocha("a", "pulmao"), tocha("b", "fora")]), f),
    ).estado;
    expect(modificadoresDe(e, "a")).toEqual([]);
    expect(modificadoresDe(e, "b")).toHaveLength(1);
  });
});

describe("os gatilhos do sistema", () => {
  it("tocha acende, com filtro de etiqueta: avisa só quando é da etiqueta", () => {
    const f = fluxo({
      gatilho: { tipo: "tocha", muda: "acende", etiqueta: "chama" },
      trilhas: [[anunciar("reacesa", "mestre"), paraCadaObjeto([], {})].slice(0, 1)],
    });
    const apagada = tocha("o1", "pulmao", { estado: "apagada", acesaDesdeSala: undefined });
    const e = comFluxos(criarEstado([apagada]), f);
    const r = ok(e, "m", intencao("tocha.alternar", { id: "o1" }), 5);
    expect(textos(r.estado)).toEqual(["reacesa"]);
    // a lanterna não tem a etiqueta
    const lanterna = tocha("o2", "pulmao", {
      estado: "apagada",
      acesaDesdeSala: undefined,
      modeloId: "modelo-lanterna",
    });
    const r2 = ok(
      comFluxos(criarEstado([lanterna]), f),
      "m",
      intencao("tocha.alternar", { id: "o2" }),
      5,
    );
    expect(textos(r2.estado)).toEqual([]);
  });

  it("tocha apaga: a ação cai na tocha que apagou", () => {
    const f = fluxo({
      gatilho: { tipo: "tocha", muda: "apaga" },
      trilhas: [[acao({ acao: "objeto.ajustarTempo", deltaS: -10 })]],
    });
    const e = comFluxos(criarEstado([tocha("o1")]), f);
    const r = ok(e, "m", intencao("tocha.alternar", { id: "o1" }), 5);
    // a tocha apagada não é "acesa": o ajuste só mexe no que ainda queima, então nada muda e nada quebra
    expect(r.estado.luzes[0]?.estado).toBe("apagada");
  });

  it("a cena do grupo muda: roda o fluxo da cena nova", () => {
    const f = fluxo({
      gatilho: { tipo: "cena", cena: "fora" },
      trilhas: [[anunciar("chegou")]],
    });
    const e = comFluxos(criarEstado(), f);
    const r = ok(e, "m", intencao("grupo.moverPara", { cenaId: "fora" }), 3);
    expect(textos(r.estado)).toEqual(["chegou"]);
    const volta = ok(r.estado, "m", intencao("grupo.moverPara", { cenaId: "pulmao" }), 4);
    expect(textos(volta.estado)).toEqual(["chegou"]);
  });
});

describe("as intenções de automação", () => {
  const TIPOS = [
    "fluxo.criar",
    "fluxo.editar",
    "fluxo.apagar",
    "fluxo.ligar",
    "fluxo.disparar",
  ] as const;

  it("exigem automacao.editar, que não é delegável", () => {
    for (const t of TIPOS) expect(capacidadeDaIntencao[t]).toBe("automacao.editar");
    expect(ehCapacidadeDelegavel("automacao.editar")).toBe(false);
  });

  it("o jogador não cria, edita, dispara nem apaga nada", () => {
    const base = comFluxos(criarEstado(), fluxo({}));
    const pedidos: Intencao[] = [
      intencao("fluxo.criar", { fluxo: fluxo({ id: "novo" }) }),
      intencao("fluxo.apagar", { id: "f1" }),
      intencao("fluxo.disparar", { id: "f1" }),
      intencao("fluxo.ligar", { id: "f1", ligado: false }),
      intencao("fluxo.editar", { id: "f1", mudancas: { nome: "x" } }),
    ];
    for (const p of pedidos) {
      expect(processar(base, "j1", p, iso(0))).toMatchObject({
        ok: false,
        erro: { codigo: "sem_permissao" },
      });
    }
  });

  it("criar, editar, ligar e apagar, com as conferências em português", () => {
    let e = criarEstado();
    const f = fluxo({
      gatilho: { tipo: "relogio", cadaS: 60 },
      trilhas: [[paraCadaObjeto([luz(0.5, 5)])]],
    });
    e = ok(e, "m", intencao("fluxo.criar", { fluxo: f })).estado;
    expect(e.automacoes?.fluxos.map((x) => x.id)).toEqual(["f1"]);
    expect(processar(e, "m", intencao("fluxo.criar", { fluxo: f }), iso(0))).toMatchObject({
      ok: false,
      erro: { codigo: "dados_invalidos" },
    });
    // editar só o nome mantém o resto
    e = ok(e, "m", intencao("fluxo.editar", { id: "f1", mudancas: { nome: "Novo nome" } })).estado;
    expect(e.automacoes?.fluxos[0]).toMatchObject({
      nome: "Novo nome",
      ligado: true,
      nos: f.nos,
    });
    // erro de validação: ação de luz solta, zona que não existe, cena que não existe
    const solta = processar(
      e,
      "m",
      intencao("fluxo.editar", {
        id: "f1",
        mudancas: muda({ gatilho: { tipo: "relogio", cadaS: 60 }, trilhas: [[luz(0.5, 5)]] }),
      }),
      iso(0),
    );
    expect(solta).toMatchObject({ ok: false, erro: { codigo: "dados_invalidos" } });
    if (!solta.ok) expect(solta.erro.mensagem).toContain("para cada");
    const semZona = processar(
      e,
      "m",
      intencao("fluxo.editar", {
        id: "f1",
        mudancas: muda({
          gatilho: { tipo: "zona", quando: "entra", zona: "nada" },
          trilhas: [[anunciar("a")]],
        }),
      }),
      iso(0),
    );
    if (semZona.ok) throw new Error("devia recusar");
    expect(semZona.erro.mensagem).toContain("zona não existe");
    expect(
      processar(
        e,
        "m",
        intencao("fluxo.editar", { id: "f1", mudancas: { cenas: ["nada"] } }),
        iso(0),
      ),
    ).toMatchObject({ ok: false });
    expect(
      processar(e, "m", intencao("fluxo.editar", { id: "nada", mudancas: { nome: "x" } }), iso(0)),
    ).toMatchObject({ ok: false, erro: { codigo: "fluxo_inexistente" } });
    e = ok(e, "m", intencao("fluxo.ligar", { id: "f1", ligado: false })).estado;
    expect(e.automacoes?.fluxos[0]?.ligado).toBe(false);
    e = ok(e, "m", intencao("fluxo.apagar", { id: "f1" })).estado;
    expect(e.automacoes?.fluxos).toEqual([]);
  });

  it('"Testar agora" dispara de verdade, uma vez, mesmo desligado', () => {
    const f = fluxo({ ligado: false, trilhas: [[anunciar("testei")]] });
    const e = disparar(comFluxos(criarEstado(), f)).estado;
    expect(textos(e)).toEqual(["testei"]);
  });

  it("editar o gatilho ou as trilhas reinicia o relógio e cancela o que esperava", () => {
    const f = fluxo({
      gatilho: { tipo: "relogio", cadaS: 60 },
      trilhas: [[esperar(30), anunciar("x")]],
    });
    let e = tempo(comFluxos(criarEstado(), f), 0).estado;
    expect(e.automacoes?.esperando).toHaveLength(1);
    e = ok(
      e,
      "m",
      intencao("fluxo.editar", {
        id: "f1",
        mudancas: muda({ gatilho: { tipo: "relogio", cadaS: 60 }, trilhas: [[anunciar("y")]] }),
      }),
      1,
    ).estado;
    expect(e.automacoes?.esperando).toEqual([]);
    expect(textos(e)).toContain("y");
  });
});

describe("o sigilo: nada de automação chega ao jogador", () => {
  const montar = () => {
    let e = criarEstado();
    const frames: EventoSala[] = [];
    const guardar = (r: ReturnType<typeof ok>) => {
      frames.push(...r.eventos);
      e = r.estado;
    };
    guardar(
      ok(
        e,
        "m",
        intencao("fluxo.criar", {
          fluxo: fluxo({
            id: "respiracao",
            nome: SEGREDO,
            gatilho: { tipo: "relogio", cadaS: 180 },
            trilhas: [
              [paraCadaObjeto([luz(0.5, 20)]), anunciar("para todos")],
              [esperar(90), anunciar("so-mestre", "mestre")],
            ],
          }),
        }),
      ),
    );
    guardar(ok(e, "m", intencao("fluxo.ligar", { id: "respiracao", ligado: false }), 5));
    guardar(ok(e, "m", intencao("fluxo.ligar", { id: "respiracao", ligado: true }), 6));
    guardar(ok(e, "m", intencao("fluxo.disparar", { id: "respiracao" }), 7));
    const antes = e;
    const passou = tempo(e, 100);
    frames.push(...passou.eventos);
    e = passou.estado;
    return { e, frames, antes };
  };

  it("o snapshot do jogador não traz a fatia de automações nem a origem", () => {
    const { e } = montar();
    expect(e.automacoes?.fluxos).toHaveLength(1);
    const visto = visaoPara(e, J1, T0 + 100_000);
    expect(visto.automacoes).toBeUndefined();
    const texto = JSON.stringify(visto);
    for (const proibido of [SEGREDO, "respiracao", "automacoes", "fluxos", "so-mestre"]) {
      expect(texto).not.toContain(proibido);
    }
    expect(visaoPara(e, MESTRE, T0 + 100_000).automacoes?.fluxos[0]?.nome).toBe(SEGREDO);
  });

  it("nenhum frame do jogador traz a definição de uma automação, só os efeitos", () => {
    const { frames, antes } = montar();
    expect(frames.some((f) => f.tipo === "automacoes.alterado")).toBe(true);
    const recebidos: EventoSala[] = [];
    for (const f of frames) {
      const v = eventoPara(f, J1, antes, antes, T0 + 100_000);
      if (v) recebidos.push(v);
    }
    const texto = JSON.stringify(recebidos);
    for (const proibido of [SEGREDO, "automacoes", "respiracao", "auto:", "so-mestre"]) {
      expect(texto).not.toContain(proibido);
    }
    expect(nomes(recebidos)).toContain("fonte.editada");
    expect(nomes(recebidos)).toContain("chat.mensagem");
    expect(nomes(recebidos)).not.toContain("automacoes.alterado");
  });

  it("o anúncio só para o mestre não chega ao jogador", () => {
    const base = comFluxos(criarEstado(), fluxo({ trilhas: [[anunciar("so-mestre", "mestre")]] }));
    const r = disparar(base);
    expect(r.eventos.map((e) => eventoPara(e, MESTRE, base, r.estado, T0)?.tipo)).toContain(
      "chat.mensagem",
    );
    for (const e of r.eventos) {
      expect(JSON.stringify(eventoPara(e, J1, base, r.estado, T0))).not.toContain("so-mestre");
    }
  });

  it("o jogador só recebe os botões que o mestre liberou, com o rótulo", () => {
    const base = comFluxos(
      criarEstado(),
      fluxo({ id: "a", nome: "Soprar", liberadoParaJogadores: true, trilhas: [[anunciar("x")]] }),
      fluxo({ id: "b", nome: SEGREDO, trilhas: [[anunciar("y")]] }),
    );
    const v = visaoPara(base, J1, T0);
    expect(v.botoes).toEqual([{ id: "evento:a", tipo: "evento", nome: "Soprar", rotulo: "Botão" }]);
    expect(JSON.stringify(v)).not.toContain(SEGREDO);
    // ele aperta o liberado, e o que não está liberado dá recusa
    const ok1 = processar(base, "j1", intencao("botao.usar", { botaoId: "evento:a" }), iso(1));
    expect(ok1.ok).toBe(true);
    expect(
      processar(base, "j1", intencao("botao.usar", { botaoId: "evento:b" }), iso(1)),
    ).toMatchObject({ ok: false, erro: { codigo: "sem_permissao" } });
  });
});

describe("exportar, importar e a campanha antiga", () => {
  const completo = () => {
    let e = comFluxos(
      criarEstado(),
      fluxo({
        id: "vento",
        nome: "Vento",
        gatilho: { tipo: "relogio", cadaS: 180 },
        trilhas: [[paraCadaObjeto([luz(0.5, 20)])]],
      }),
    );
    e = tempo(e, 0).estado;
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
  });

  it("a forma enxuta do arquivo (ciclos no topo, reações dentro do modelo) é convertida em fluxos", () => {
    const arquivo = JSON.parse(JSON.stringify(criarExportacao(criarEstado(), iso(0))));
    arquivo.dados.ciclos = [
      {
        id: "respiracao",
        nome: "Respiração",
        periodoS: 180,
        cenas: ["pulmao"],
        fases: [
          { emS: 0, evento: "inspiracao", duracaoS: 20 },
          { emS: 90, evento: "expiracao", duracaoS: 30 },
        ],
      },
    ];
    arquivo.dados.modelos = arquivo.dados.modelos.map((m: { id: string }) =>
      m.id === "modelo-tocha"
        ? {
            ...m,
            reacoes: [
              {
                ao: "inspiracao",
                fazer: [
                  { acao: "luz.modificar", raioX: 0.5 },
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
    expect(a?.fluxos.map((f) => gatilhoPrincipal(f)?.tipo)).toEqual(["relogio"]);
    // a reação só liga àquele ciclo: fica dentro da trilha da fase, com o "dura" da fase como prazo
    expect(JSON.stringify(a?.fluxos[0]?.nos)).toContain('"porS":20');
    expect(a?.legado?.ciclos).toHaveLength(1);
    expect(a?.legado?.reacoes).toHaveLength(1);
    // o modelo exportado não carrega a reação
    expect(JSON.stringify(lida.exportacao.dados.modelos)).not.toContain("inspiracao");
    // o fluxo do arquivo (sem execução) começa quando a mesa corre
    const e = ok(criarEstado(), "m", intencao("campanha.importar", { dados: arquivo })).estado;
    expect(e.automacoes?.execucao).toEqual({});
    const rodando = ok(e, "m", intencao("mesa.retomar"), 10).estado;
    expect(modificadoresDe(rodando, "o1")).toHaveLength(1);
  });

  it("ids repetidos de automação recusam o arquivo", () => {
    const arquivo = JSON.parse(JSON.stringify(criarExportacao(completo(), iso(0))));
    arquivo.dados.automacoes.fluxos.push(arquivo.dados.automacoes.fluxos[0]);
    expect(lerExportacao(arquivo)).toMatchObject({ ok: false });
  });

  it("a conversão não mexe no que não é objeto", () => {
    expect(converterAutomacoesDoArquivo(null)).toBeNull();
    expect(converterAutomacoesDoArquivo({ dados: 3 })).toEqual({ dados: 3 });
  });
});

describe("a fatia no estado (reduzir)", () => {
  it("o evento automacoes.alterado troca a fatia", () => {
    const e = criarEstado();
    const r = ok(e, "m", intencao("fluxo.criar", { fluxo: fluxo({ trilhas: [[anunciar("a")]] }) }));
    expect(nomes(r.eventos)).toEqual(["automacoes.alterado"]);
    expect(r.estado.seq).toBe(e.seq + 1);
  });
});
