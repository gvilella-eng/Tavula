import { describe, expect, it } from "vitest";
import {
  AutomacoesSchema,
  arvoreParaGrafo,
  converterParaArvores,
  type FluxoArvore,
  FluxoArvoreSchema,
  fraseDoFluxo,
  type Gatilho,
  migrarAutomacoes,
  nomesDaMesa,
  numeroEmPortugues,
  problemasDoFluxo,
  semOsNos,
  tempoHumano,
} from "./index.ts";

// AU1: a conversão dos ciclos, reações e botões antigos em fluxos (um caso por lugar de reação), a frase em português e a
// conferência em português com o lugar do problema.

const converter = (antigo: Record<string, unknown>) => {
  const a = AutomacoesSchema.parse(antigo);
  // As asserções olham a ÁRVORE (o que a conversão monta antes de virar grafo); `ligado` vem do grafo (carrega o ciclo pausado).
  const arvores = converterParaArvores({
    ciclos: a.legado?.ciclos ?? [],
    reacoes: a.legado?.reacoes ?? [],
    botoes: a.legado?.botoes ?? [],
  }).map((t) => ({ ...t, ligado: a.fluxos.find((g) => g.id === t.id)?.ligado ?? t.ligado }));
  return { ...a, fluxos: arvores, grafos: a.fluxos };
};
const fluxo = (a: ReturnType<typeof converter>, id: string): FluxoArvore => {
  const f = a.fluxos.find((x) => x.id === id);
  if (!f) throw new Error(`sem o fluxo ${id}: ${a.fluxos.map((x) => x.id).join(", ")}`);
  return f;
};
const json = (v: unknown) => JSON.stringify(v);

const reacao = (r: Record<string, unknown>) => ({ ativa: true, se: [], ...r });
const chat = (texto: string) => ({ acao: "chat.anunciar", texto });

describe("a conversão do formato antigo em fluxos", () => {
  it('o ciclo vira um fluxo de relógio com uma trilha por fase; o "dura" da fase vira o prazo', () => {
    const a = converter({
      ciclos: [
        {
          id: "c",
          nome: "Ciclo",
          periodoS: 180,
          cenas: ["pulmao"],
          fases: [
            { emS: 90, evento: "b", duracaoS: 30 },
            { emS: 0, evento: "a", duracaoS: 20 },
          ],
          fixado: true,
        },
      ],
      reacoes: [
        reacao({
          id: "ra",
          fica: { tipo: "mesa" },
          ao: "a",
          fazer: [{ acao: "luz.modificar", raioX: 0.5 }],
        }),
        reacao({
          id: "rb",
          fica: { tipo: "mesa" },
          ao: "b",
          fazer: [{ acao: "visao.limitar", alcanceM: 2 }],
        }),
      ],
    });
    const f = fluxo(a, "c");
    expect(f).toMatchObject({ nome: "Ciclo", ligado: true, cenas: ["pulmao"], fixado: true });
    expect(f.gatilho).toEqual({ tipo: "relogio", cadaS: 180 });
    expect(f.trilhas).toHaveLength(2);
    // as fases em ordem de tempo; a da fase em 90 s começa esperando
    expect(f.trilhas[1]?.[0]).toEqual({ bloco: "esperar", s: 90 });
    expect(json(f.trilhas[0])).toContain('"porS":20');
    expect(json(f.trilhas[1])).toContain('"porS":30');
    // as reações que só esse ciclo emite ficaram dentro da trilha
    expect(a.fluxos).toHaveLength(1);
    expect(a.legado?.ciclos).toHaveLength(1);
    expect(a.legado?.reacoes).toHaveLength(2);
  });

  it("o evento com mais de um uso (um botão também o emite) fica como sinal, e a reação ouve o sinal", () => {
    const a = converter({
      ciclos: [{ id: "c", nome: "C", periodoS: 60, cenas: [], fases: [{ emS: 0, evento: "x" }] }],
      botoes: [
        { id: "b", nome: "Soprar", evento: "x", cenaId: "pulmao", liberadoParaJogadores: true },
      ],
      reacoes: [
        reacao({ id: "r", nome: "Ouve", fica: { tipo: "mesa" }, ao: "x", fazer: [chat("oi")] }),
      ],
    });
    expect(json(fluxo(a, "c").trilhas)).toContain('{"bloco":"sinal","nome":"x"}');
    expect(fluxo(a, "botao-b")).toMatchObject({
      nome: "Soprar",
      liberadoParaJogadores: true,
      gatilho: { tipo: "botao", nome: "Soprar", cena: "pulmao" },
      trilhas: [[{ bloco: "sinal", nome: "x" }]],
    });
    expect(fluxo(a, "rx-r")).toMatchObject({ nome: "Ouve", gatilho: { tipo: "sinal", nome: "x" } });
  });

  it('reação de modelo: "para cada objeto do modelo", com as condições por dentro', () => {
    const a = converter({
      reacoes: [
        reacao({
          id: "r",
          fica: { tipo: "modelo", id: "m1" },
          ao: "vento",
          se: [{ condicao: "chance", valor: 0.3 }],
          fazer: [{ acao: "objeto.apagar", penalidadeS: 60 }],
        }),
      ],
    });
    const f = fluxo(a, "rx-r");
    expect(f.gatilho).toEqual({ tipo: "sinal", nome: "vento" });
    expect(f.trilhas[0]).toEqual([
      {
        bloco: "paraCada",
        alvo: { tipo: "objetos", modelo: "m1" },
        corpo: [
          {
            bloco: "sortear",
            chance: 0.3,
            sim: [{ bloco: "acao", acao: { acao: "objeto.apagar", penalidadeS: 60 } }],
            nao: [],
          },
        ],
      },
    ]);
  });

  it("reação de modelo ao evento do sistema: o gatilho filtra pelo modelo, e a ação vai ao objeto do evento", () => {
    const a = converter({
      reacoes: [
        reacao({
          id: "r",
          fica: { tipo: "modelo", id: "m1" },
          ao: "objeto.apagou",
          fazer: [chat("apagou")],
        }),
      ],
    });
    expect(fluxo(a, "rx-r").gatilho).toEqual({ tipo: "tocha", muda: "apaga", modelo: "m1" });
  });

  it("reação de cena: as cenas do fluxo; a da mesa: sem cenas; a condição de etiqueta sobe para o gatilho", () => {
    const a = converter({
      reacoes: [
        reacao({
          id: "rc",
          fica: { tipo: "cena", id: "pulmao" },
          ao: "cena.ativada",
          fazer: [chat("a")],
        }),
        reacao({
          id: "rm",
          fica: { tipo: "mesa" },
          ao: "objeto.acendeu",
          se: [{ condicao: "tag", tag: "chama" }],
          fazer: [chat("b")],
        }),
      ],
    });
    expect(fluxo(a, "rx-rc")).toMatchObject({ cenas: ["pulmao"], gatilho: { tipo: "cena" } });
    expect(fluxo(a, "rx-rm")).toMatchObject({
      cenas: null,
      gatilho: { tipo: "tocha", muda: "acende", etiqueta: "chama" },
    });
    // a etiqueta virou filtro: não sobra "se" no corpo
    expect(json(fluxo(a, "rx-rm").trilhas)).not.toContain('"bloco":"se"');
  });

  it("reação de zona: o gatilho é a zona e, nos outros eventos, só quem está dentro", () => {
    const a = converter({
      reacoes: [
        reacao({
          id: "rz",
          fica: { tipo: "zona", id: "z1" },
          ao: "token.entrouNaZona",
          fazer: [
            { acao: "visao.limitar", alcanceM: 2 },
            { acao: "luz.modificar", raioX: 0.5 },
          ],
        }),
        reacao({
          id: "rx",
          fica: { tipo: "zona", id: "z1" },
          ao: "gas",
          fazer: [{ acao: "luz.modificar", raioX: 0.5 }],
        }),
      ],
    });
    const entra = fluxo(a, "rx-rz");
    expect(entra.gatilho).toEqual({ tipo: "zona", quando: "entra", zona: "z1" });
    // a visão vai ao token que entrou (sem "para cada"); a luz, a cada objeto dentro da zona
    expect(entra.trilhas[0]?.[0]).toMatchObject({ bloco: "acao", acao: { acao: "visao.limitar" } });
    expect(entra.trilhas[0]?.[1]).toMatchObject({
      bloco: "paraCada",
      alvo: { tipo: "objetos", naZona: "z1" },
    });
    const gas = fluxo(a, "rx-rx");
    expect(gas.trilhas[0]?.[0]).toMatchObject({
      bloco: "se",
      condicao: { condicao: "zonaLigada", zona: "z1" },
    });
    expect(json(gas.trilhas)).toContain('"naZona":"z1"');
  });

  it('a ação com alvo antigo vira "para cada"; o evento.disparar vira o bloco sinal', () => {
    const a = converter({
      reacoes: [
        reacao({
          id: "r",
          fica: { tipo: "mesa" },
          ao: "x",
          fazer: [
            { acao: "luz.modificar", raioX: 0.5, alvo: { modeloId: "m1", tag: "chama" } },
            { acao: "evento.disparar", evento: "y", atrasoS: 5 },
          ],
        }),
      ],
    });
    const f = fluxo(a, "rx-r");
    expect(f.trilhas[0]?.[0]).toMatchObject({
      bloco: "paraCada",
      alvo: { tipo: "objetos", modelo: "m1", etiqueta: "chama" },
    });
    expect(f.trilhas[0]?.[1]).toEqual({ bloco: "sinal", nome: "y", atrasoS: 5 });
  });

  it("reação desligada ou em rascunho não é embutida no ciclo e mantém o estado", () => {
    const a = converter({
      ciclos: [{ id: "c", nome: "C", periodoS: 60, cenas: [], fases: [{ emS: 0, evento: "x" }] }],
      reacoes: [
        reacao({ id: "r", ativa: false, fica: { tipo: "mesa" }, ao: "x", fazer: [chat("oi")] }),
      ],
    });
    expect(fluxo(a, "rx-r")).toMatchObject({
      ligado: false,
      gatilho: { tipo: "sinal", nome: "x" },
    });
    expect(json(fluxo(a, "c").trilhas)).toContain('"sinal"');
  });

  it("o rascunho do Claude e o ciclo pausado continuam como eram", () => {
    const a = converter({
      ciclos: [
        { id: "c1", nome: "Parado", periodoS: 60, cenas: [], fases: [{ emS: 0, evento: "x" }] },
        {
          id: "c2",
          nome: "Rasc",
          periodoS: 60,
          cenas: [],
          fases: [{ emS: 0, evento: "y" }],
          rascunho: true,
        },
      ],
      execucao: { c1: { baseSala: 0, pausadoEmTau: 5000, disparadoAteTau: 0 } },
    });
    expect(fluxo(a, "c1").ligado).toBe(false);
    expect(a.execucao.c1?.pausadoEmTau).toBe(5000);
    expect(fluxo(a, "c2").rascunho).toBe(true);
  });

  it("o formato novo passa como está, a conversão é idempotente e o lixo não derruba", () => {
    const a = converter({
      ciclos: [{ id: "c", nome: "C", periodoS: 60, cenas: [], fases: [{ emS: 0, evento: "x" }] }],
    });
    const de_novo = AutomacoesSchema.parse(JSON.parse(JSON.stringify(a)));
    expect(de_novo.fluxos).toEqual(a.grafos);
    expect(de_novo.legado).toEqual(a.legado);
    expect(migrarAutomacoes(null)).toBeNull();
    // item antigo inválido é pulado (não derruba a mesa)
    const b = converter({
      ciclos: [
        { id: "x" },
        { id: "c", nome: "C", periodoS: 60, cenas: [], fases: [{ emS: 0, evento: "x" }] },
      ],
    });
    expect(b.fluxos.map((f) => f.id)).toEqual(["c"]);
  });
});

describe("a frase em português", () => {
  const nomes = nomesDaMesa({
    cenas: [{ id: "pulmao", nome: "Pulmão" }] as never,
    modelos: [{ id: "tocha", nome: "Tocha" }] as never,
    zonas: [{ id: "z1", nome: "Ar Morto" }] as never,
  });
  const frase = (gatilho: Gatilho, trilhas: unknown[][], cenas: string[] | null = null) =>
    fraseDoFluxo(
      arvoreParaGrafo(FluxoArvoreSchema.parse({ id: "x", nome: "x", gatilho, trilhas, cenas })),
      nomes,
    );

  it("conta o fluxo inteiro, sem ids, com o tempo em linguagem humana", () => {
    const f = frase(
      { tipo: "relogio", cadaS: 180 },
      [
        [
          {
            bloco: "paraCada",
            alvo: { tipo: "objetos", modelo: "tocha", acesos: true },
            corpo: [
              { bloco: "acao", acao: { acao: "luz.modificar", raioX: 0.5, porS: 20 } },
              { bloco: "acao", acao: { acao: "objeto.apagar", chance: 0.3, penalidadeS: 300 } },
            ],
          },
        ],
        [
          { bloco: "esperar", s: 90 },
          {
            bloco: "paraCada",
            alvo: { tipo: "tokens" },
            corpo: [{ bloco: "acao", acao: { acao: "visao.limitar", alcanceM: 1.5, porS: 30 } }],
          },
        ],
      ],
      ["pulmao"],
    );
    expect(f).toBe(
      "A cada 3 min, na cena Pulmão: cada tocha acesa fica com metade da luz por 20 s e tem 30% de chance de apagar (perde 5 min). 90 s depois, a visão de cada token na cena Pulmão cai para 1,5 m por 30 s.",
    );
  });

  it("cada gatilho tem a sua frase", () => {
    const vazio = [[{ bloco: "sinal", nome: "x" }]];
    expect(frase({ tipo: "botao", nome: "Soprar" }, vazio)).toContain(
      "Ao apertar o botão “Soprar”: manda o sinal “x”",
    );
    expect(frase({ tipo: "sinal", nome: "vento" }, vazio)).toContain("Ao receber o sinal “vento”");
    expect(
      frase({ tipo: "tocha", muda: "apaga", modelo: "tocha", etiqueta: "chama" }, vazio),
    ).toContain("Quando uma tocha apaga (do modelo Tocha e com a etiqueta “chama”)");
    expect(frase({ tipo: "zona", quando: "sai", zona: "z1" }, vazio)).toContain(
      "Quando um token sai da zona Ar Morto",
    );
    expect(frase({ tipo: "zona", quando: "entra" }, vazio)).toContain("entra numa zona");
    expect(frase({ tipo: "turno" }, vazio)).toContain("começa o turno de alguém");
    expect(frase({ tipo: "cena", cena: "pulmao" }, vazio)).toContain("vai para a cena Pulmão");
  });

  it("se, sortear, esperar no meio e nomes que sumiram", () => {
    const f = frase({ tipo: "tocha", muda: "acende" }, [
      [
        {
          bloco: "se",
          condicao: { condicao: "etiqueta", etiqueta: "chama" },
          sim: [{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "oi", para: "mestre" } }],
          nao: [{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "ixi" } }],
        },
        { bloco: "esperar", s: 5 },
        {
          bloco: "sortear",
          chance: 0.25,
          sim: [{ bloco: "acao", acao: { acao: "zona.ativar", zona: "apagada", ativa: false } }],
          nao: [],
        },
      ],
    ]);
    expect(f).toContain(
      "se a tocha tiver a etiqueta “chama”, avisa só o mestre: “oi”; senão, avisa no chat: “ixi”",
    );
    expect(f).toContain("5 s depois, com 25% de chance, desliga a zona (apagado)");
  });

  it("tempo e número em português", () => {
    expect([20, 90, 180, 300, 330, 3600, 7200, 0.5].map(tempoHumano)).toEqual([
      "20 s",
      "90 s",
      "3 min",
      "5 min",
      "5 min 30 s",
      "1 h",
      "2 h",
      "0,5 s",
    ]);
    expect(numeroEmPortugues(1.5)).toBe("1,5");
  });
});

describe("a conferência do fluxo, em português e com o lugar do problema", () => {
  const ref = {
    cenas: new Set(["pulmao"]),
    modelos: new Set(["tocha"]),
    zonas: new Set(["z1"]),
    sons: new Set<string>(),
  };
  const base = { id: "f", nome: "F", ligado: true, cenas: null };
  const confere = (gatilho: Gatilho, trilhas: unknown[][], extra: Record<string, unknown> = {}) =>
    problemasDoFluxo(
      arvoreParaGrafo(FluxoArvoreSchema.parse({ ...base, ...extra, gatilho, trilhas })),
      ref,
    );

  it("ação solta, zona e cena que sumiram, sinal sem alvo e blocos vazios", () => {
    const p = confere({ tipo: "zona", quando: "entra", zona: "z-sumiu" }, [
      [
        { bloco: "acao", acao: { acao: "luz.modificar", raioX: 0.5 } },
        { bloco: "se", condicao: { condicao: "dentroDaZona", zona: "z-sumiu" }, sim: [], nao: [] },
        {
          bloco: "paraCada",
          alvo: { tipo: "tokens", naCena: "outra" },
          corpo: [{ bloco: "acao", acao: { acao: "som.tocar", hash: "a".repeat(64), nome: "s" } }],
        },
      ],
    ]);
    const onde = Object.fromEntries(p.map((x) => [x.caminho, x.mensagem]));
    expect(onde["nos.n1"]).toContain("zona não existe");
    expect(onde["nos.n2"]).toContain("para cada");
    expect(onde["nos.n4"]).toContain("zona não existe");
    expect(onde["nos.n3"]).toBeUndefined(); // "se" com os dois ramos vazios segue direto para o bloco de baixo
    expect(onde["nos.n5"]).toContain("cena não existe");
    expect(onde["nos.n6"]).toContain("som não está mais");
  });

  it("a ação de luz num gatilho de tocha vale; um fluxo sem nenhum bloco não", () => {
    expect(
      confere({ tipo: "tocha", muda: "acende" }, [
        [{ bloco: "acao", acao: { acao: "luz.modificar", raioX: 0.5 } }],
      ]),
    ).toEqual([]);
    expect(confere({ tipo: "turno" }, [[]])[0]?.mensagem).toContain("pelo menos um bloco");
  });

  it("tirar as ações de um som religa o que vinha antes ao que vinha depois (a automação segue de pé)", () => {
    const hash = "b".repeat(64);
    const g = arvoreParaGrafo(
      FluxoArvoreSchema.parse({
        id: "f",
        nome: "F",
        gatilho: { tipo: "botao", nome: "B" },
        trilhas: [
          [
            {
              bloco: "acao",
              acao: { acao: "som.tocar", hash, nome: "s", volume: 0.8, para: "todos" },
            },
            { bloco: "acao", acao: { acao: "chat.anunciar", texto: "fica", para: "todos" } },
          ],
        ],
      }),
    );
    const som = g.nos.find((n) => n.tipo === "acao" && n.config.acao.acao === "som.tocar");
    const sem = semOsNos(g, new Set(som ? [som.id] : []));
    expect(sem.nos.map((n) => n.tipo)).toEqual(["gatilho", "acao"]);
    expect(sem.fios).toHaveLength(1);
    expect(sem.fios[0]?.de.no).toBe(g.nos[0]?.id);
    expect(problemasDoFluxo(sem, ref)).toEqual([]);
  });
});

describe("o que o AU1 guardou na mesa (árvore) carrega como grafo (AU2)", () => {
  it("o fluxo de árvore vira grafo, as esperas antigas (pelo caminho da árvore) caem e as novas e os sinais ficam", () => {
    const a = AutomacoesSchema.parse({
      fluxos: [
        {
          id: "f",
          nome: "F",
          ligado: true,
          cenas: null,
          gatilho: { tipo: "relogio", cadaS: 60 },
          trilhas: [
            [
              { bloco: "esperar", s: 5 },
              { bloco: "acao", acao: { acao: "chat.anunciar", texto: "x" } },
            ],
          ],
        },
      ],
      execucao: { f: { baseSala: 0, proximoTau: 60000 } },
      esperando: [
        {
          id: "e1",
          ateSala: 5000,
          profundidade: 0,
          fluxoId: "f",
          caminho: [0, 1],
          contexto: { cenas: null },
        },
        {
          id: "e2",
          ateSala: 5000,
          profundidade: 0,
          fluxoId: "f",
          no: "n2",
          contexto: { cenas: null },
        },
        {
          id: "e3",
          ateSala: 5000,
          profundidade: 1,
          sinal: "vento",
          fluxoId: "f",
          contexto: { cenas: null },
        },
      ],
    });
    const f = a.fluxos[0];
    expect(f?.nos.map((n) => n.tipo)).toEqual(["gatilho", "esperar", "acao"]);
    expect(f?.fios).toHaveLength(2);
    expect("trilhas" in (f ?? {})).toBe(false);
    expect(a.execucao.f?.proximoTau).toBe(60000);
    expect(a.esperando.map((e) => e.id)).toEqual(["e2", "e3"]);
    // e o grafo, salvo e lido de novo, é o mesmo
    expect(AutomacoesSchema.parse(JSON.parse(JSON.stringify(a))).fluxos).toEqual(a.fluxos);
  });
});
