import { describe, expect, it } from "vitest";
import {
  AutomacoesSchema,
  botaoDentroDoLimite,
  botoesParaJogador,
  type Estado,
  estadoInicial,
  eventoPara,
  fonteComSemente,
  INTERVALO_MINIMO_DO_BOTAO_MS,
  type Intencao,
  IntencaoSchema,
  modelosPadrao,
  nomeDoEvento,
  type ObjetoDeLuz,
  processar,
  situacaoDoCiclo,
  visaoPara,
} from "./index.ts";

// Lote 7b-3: os botões na barra (fixar e liberar), a conferência a cada clique e o sigilo da definição.

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (segundos: number) => new Date(T0 + segundos * 1000).toISOString();
const J1 = { id: "j1", papel: "jogador" as const };
const SEGREDO = "SEGREDO-DO-BOTAO";

let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });

const tocha = (id: string): ObjetoDeLuz => ({
  id,
  cenaId: "pulmao",
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
});

function criarEstado(): Estado {
  return {
    ...estadoInicial(
      {
        usuarios: [
          { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
          { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
        ],
        cenas: [
          {
            id: "pulmao",
            nome: "Pulmão",
            larguraM: 40,
            alturaM: 40,
            grid: { quadradoM: 1.5, visivel: true },
          },
        ],
        cenaAtivaId: "pulmao",
        modelos: modelosPadrao(),
        luzes: [tocha("o1")],
      },
      T0,
    ),
    automacoes: AutomacoesSchema.parse({
      ciclos: [
        {
          id: "resp",
          nome: "Respiração",
          periodoS: 100,
          cenas: ["pulmao"],
          fases: [
            { emS: 0, evento: "inspiracao", duracaoS: 20 },
            { emS: 50, evento: "expiracao" },
          ],
          liberadoParaJogadores: true,
        },
        {
          id: "escondido",
          nome: SEGREDO,
          periodoS: 60,
          fases: [{ emS: 0, evento: "segredo" }],
        },
      ],
      reacoes: [
        {
          id: "r-vento",
          fica: { tipo: "mesa" },
          ao: "vento",
          fazer: [{ acao: "chat.anunciar", texto: "O vento sopra." }],
        },
        {
          id: "r-segredo",
          fica: { tipo: "mesa" },
          ao: "segredo-do-mestre",
          fazer: [{ acao: "chat.anunciar", texto: SEGREDO, para: "mestre" }],
        },
      ],
      botoes: [
        { id: "b1", nome: "Soprar o vento", evento: "vento", liberadoParaJogadores: true },
        { id: "b2", nome: "Botão do mestre", evento: "segredo-do-mestre", fixado: true },
      ],
    }),
  };
}

function ok(estado: Estado, quem: string, i: Intencao, segundos = 0) {
  const r = processar(estado, quem, i, iso(segundos), fonteComSemente(1));
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} (${r.erro.mensagem})`);
  return r;
}
const recusa = (estado: Estado, quem: string, i: Intencao, segundos = 0) => {
  const r = processar(estado, quem, i, iso(segundos), fonteComSemente(1));
  if (r.ok) throw new Error("devia recusar");
  return r.erro;
};
const anuncios = (e: Estado) =>
  (e.chat ?? []).filter((m) => m.tipo === "aviso").map((m) => m.texto);

describe("os botões liberados chegam ao jogador só com o rótulo", () => {
  it("a visão do jogador traz os botões liberados, sem automação", () => {
    const e = criarEstado();
    const v = visaoPara(e, J1, T0);
    expect(v.botoes).toEqual([
      { id: "ciclo:resp", tipo: "ciclo", nome: "Respiração", pausado: false },
      { id: "evento:b1", tipo: "evento", nome: "Soprar o vento" },
    ]);
    expect(v.automacoes).toBeUndefined();
    const json = JSON.stringify(v);
    expect(json).not.toContain(SEGREDO);
    expect(json).not.toContain("inspiracao");
    expect(json).not.toContain("segredo-do-mestre");
    expect(json).not.toContain("periodoS");
  });

  it("sem nada liberado, o jogador não recebe o campo", () => {
    const e = criarEstado();
    const sem: Estado = {
      ...e,
      automacoes: AutomacoesSchema.parse({ ciclos: [], reacoes: [], botoes: [] }),
    };
    expect(visaoPara(sem, J1, T0).botoes).toBeUndefined();
  });

  it("o evento da mudança vira a lista dos botões para o jogador e nada para o resto da fatia", () => {
    const antes = criarEstado();
    const r = ok(antes, "m", intencao("ciclo.pausar", { id: "resp" }));
    const eventos = r.eventos.filter((e) => e.tipo === "automacoes.alterado");
    const evt = eventos.at(-1) as (typeof r.eventos)[number];
    const doMestre = eventoPara(evt, { id: "m", papel: "mestre" }, antes, r.estado, T0);
    expect(doMestre?.tipo).toBe("automacoes.alterado");
    const doJogador = eventoPara(evt, J1, antes, r.estado, T0);
    expect(doJogador?.tipo).toBe("botoes.alterados");
    expect(JSON.stringify(doJogador)).not.toContain(SEGREDO);
    expect(doJogador?.tipo === "botoes.alterados" ? doJogador.dados : null).toEqual({
      botoes: [
        { id: "ciclo:resp", tipo: "ciclo", nome: "Respiração", pausado: true },
        { id: "evento:b1", tipo: "evento", nome: "Soprar o vento" },
      ],
    });
  });

  it("mudança que não muda os botões (editar o botão do mestre) não chega ao jogador", () => {
    const antes = criarEstado();
    const r = ok(
      antes,
      "m",
      intencao("botao.editar", { id: "b2", mudancas: { nome: "Outro nome do mestre" } }),
    );
    for (const e of r.eventos) expect(eventoPara(e, J1, antes, r.estado, T0)).toBeNull();
  });

  it("o evento botoes.alterados nunca vai ao mestre", () => {
    const e = criarEstado();
    const evt = {
      tipo: "botoes.alterados",
      dados: { botoes: [] },
      seq: 1,
      origem: { usuarioId: "m", idPedido: "x" },
    } as never;
    expect(eventoPara(evt, { id: "m", papel: "mestre" }, e, e, T0)).toBeNull();
  });
});

describe("usar um botão", () => {
  it("o jogador dispara o botão de evento liberado e a reação roda", () => {
    const r = ok(criarEstado(), "j1", intencao("botao.usar", { botaoId: "evento:b1" }));
    expect(anuncios(r.estado)).toEqual(["O vento sopra."]);
  });

  it("o jogador dispara, pausa e retoma o ciclo liberado", () => {
    let e = criarEstado();
    e = ok(e, "j1", intencao("botao.usar", { botaoId: "ciclo:resp", acao: "pausar" })).estado;
    expect(e.automacoes?.execucao.resp?.pausadoEmTau).toBeDefined();
    e = ok(e, "j1", intencao("botao.usar", { botaoId: "ciclo:resp", acao: "retomar" }), 5).estado;
    expect(e.automacoes?.execucao.resp?.pausadoEmTau).toBeUndefined();
    const disparou = ok(e, "j1", intencao("botao.usar", { botaoId: "ciclo:resp" }), 6);
    expect(disparou.eventos.length).toBeGreaterThan(0);
  });

  it("sem a liberação a sala recusa, e botão que não existe dá o mesmo erro", () => {
    const e = criarEstado();
    const a = recusa(e, "j1", intencao("botao.usar", { botaoId: "evento:b2" }));
    const b = recusa(e, "j1", intencao("botao.usar", { botaoId: "ciclo:escondido" }));
    const c = recusa(e, "j1", intencao("botao.usar", { botaoId: "ciclo:nao-existe" }));
    expect(a.codigo).toBe("sem_permissao");
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("a liberação é conferida a cada clique: desfeita, o jogador não usa mais", () => {
    let e = criarEstado();
    ok(e, "j1", intencao("botao.usar", { botaoId: "evento:b1" }));
    e = ok(
      e,
      "m",
      intencao("botao.editar", { id: "b1", mudancas: { liberadoParaJogadores: false } }),
    ).estado;
    expect(recusa(e, "j1", intencao("botao.usar", { botaoId: "evento:b1" })).codigo).toBe(
      "sem_permissao",
    );
  });

  it("o mestre usa qualquer botão", () => {
    ok(criarEstado(), "m", intencao("botao.usar", { botaoId: "evento:b2" }));
    ok(criarEstado(), "m", intencao("botao.usar", { botaoId: "ciclo:escondido", acao: "pausar" }));
  });
});

describe("criar, editar e apagar botões e fixar ciclos (só o mestre)", () => {
  it("o jogador não cria, edita nem apaga", () => {
    const e = criarEstado();
    const botao = { id: "x", nome: "X", evento: "vento" };
    expect(recusa(e, "j1", intencao("botao.criar", { botao })).codigo).toBe("sem_permissao");
    expect(
      recusa(e, "j1", intencao("botao.editar", { id: "b1", mudancas: { nome: "Y" } })).codigo,
    ).toBe("sem_permissao");
    expect(recusa(e, "j1", intencao("botao.apagar", { id: "b1" })).codigo).toBe("sem_permissao");
    expect(
      recusa(e, "j1", intencao("ciclo.editar", { id: "resp", mudancas: { fixado: true } })).codigo,
    ).toBe("sem_permissao");
  });

  it("o mestre cria, edita (inclusive a cena) e apaga", () => {
    let e = criarEstado();
    e = ok(
      e,
      "m",
      intencao("botao.criar", {
        botao: { id: "b3", nome: "Novo", evento: "vento", cenaId: "pulmao" },
      }),
    ).estado;
    expect(e.automacoes?.botoes.find((b) => b.id === "b3")?.cenaId).toBe("pulmao");
    e = ok(
      e,
      "m",
      intencao("botao.editar", { id: "b3", mudancas: { nome: "Mudou", fixado: true } }),
    ).estado;
    expect(e.automacoes?.botoes.find((b) => b.id === "b3")).toMatchObject({
      nome: "Mudou",
      fixado: true,
      cenaId: "pulmao",
    });
    e = ok(e, "m", intencao("botao.editar", { id: "b3", mudancas: { cenaId: null } })).estado;
    expect(e.automacoes?.botoes.find((b) => b.id === "b3")?.cenaId).toBeUndefined();
    e = ok(e, "m", intencao("botao.apagar", { id: "b3" })).estado;
    expect(e.automacoes?.botoes.some((b) => b.id === "b3")).toBe(false);
  });

  it("recusa id repetido, cena que não existe e botão que não existe", () => {
    const e = criarEstado();
    const base = { nome: "X", evento: "vento" };
    expect(recusa(e, "m", intencao("botao.criar", { botao: { id: "b1", ...base } })).codigo).toBe(
      "dados_invalidos",
    );
    expect(
      recusa(e, "m", intencao("botao.criar", { botao: { id: "n", ...base, cenaId: "fantasma" } }))
        .codigo,
    ).toBe("cena_inexistente");
    expect(recusa(e, "m", intencao("botao.apagar", { id: "nada" })).codigo).toBe("dados_invalidos");
  });

  it("fixar e liberar um ciclo não reinicia o ciclo nem apaga as cenas", () => {
    let e = criarEstado();
    e = ok(e, "m", intencao("ciclo.editar", { id: "resp", mudancas: { fixado: true } })).estado;
    const ciclo = e.automacoes?.ciclos.find((c) => c.id === "resp");
    expect(ciclo?.fixado).toBe(true);
    expect(ciclo?.cenas).toEqual(["pulmao"]);
    expect(ciclo?.liberadoParaJogadores).toBe(true);
  });

  it("uma campanha antiga, sem o campo botoes, carrega com a lista vazia", () => {
    const a = AutomacoesSchema.parse({ ciclos: [], reacoes: [] });
    expect(a.botoes).toEqual([]);
  });
});

describe("o limite de frequência e os nomes", () => {
  it("um disparo a cada 2 s", () => {
    expect(botaoDentroDoLimite(undefined, 1000)).toBe(true);
    expect(botaoDentroDoLimite(1000, 1000 + INTERVALO_MINIMO_DO_BOTAO_MS - 1)).toBe(false);
    expect(botaoDentroDoLimite(1000, 1000 + INTERVALO_MINIMO_DO_BOTAO_MS)).toBe(true);
  });

  it("os eventos do sistema têm nome amigável; os do mestre seguem como escritos", () => {
    expect(nomeDoEvento("objeto.acendeu")).toBe("Uma luz acendeu");
    expect(nomeDoEvento("inspiracao")).toBe("inspiracao");
  });

  it("botoesParaJogador devolve vazio sem nada liberado", () => {
    expect(botoesParaJogador({ ciclos: [], execucao: {}, botoes: [] })).toEqual([]);
  });
});

describe("situação do ciclo (fase atual e próxima)", () => {
  const ciclo = {
    periodoS: 180,
    fases: [
      { emS: 0, evento: "inspiracao" },
      { emS: 90, evento: "expiracao" },
    ],
  };
  const exec = (disparadoAteS: number) => ({ baseSala: 0, disparadoAteTau: disparadoAteS * 1000 });

  it("no começo, a inspiração; no meio, a expiração; e conta o tempo da próxima", () => {
    const a = situacaoDoCiclo(ciclo, exec(0), 10_000);
    expect(a.atual?.evento).toBe("inspiracao");
    expect(a.proxima?.evento).toBe("expiracao");
    expect(a.proximaEmMs).toBe(80_000);
    const b = situacaoDoCiclo(ciclo, exec(90), 100_000);
    expect(b.atual?.evento).toBe("expiracao");
    expect(b.proxima?.evento).toBe("inspiracao");
    expect(b.proximaEmMs).toBe(80_000);
  });

  it("pausado, o tempo não anda; sem execução, ainda não começou", () => {
    const pausado = { baseSala: 0, pausadoEmTau: 30_000, disparadoAteTau: 0 };
    const s = situacaoDoCiclo(ciclo, pausado, 999_999);
    expect(s.pausado).toBe(true);
    expect(s.proximaEmMs).toBe(60_000);
    const novo = situacaoDoCiclo(ciclo, undefined, 5000);
    expect(novo.pausado).toBe(false);
    expect(novo.proximaEmMs).toBe(0);
  });

  it("antes da primeira fase do primeiro período não há fase atual", () => {
    const c = { periodoS: 100, fases: [{ emS: 40, evento: "a" }] };
    const s = situacaoDoCiclo(c, { baseSala: 0, disparadoAteTau: -1 }, 10_000);
    expect(s.atual).toBeNull();
    expect(s.proximaEmMs).toBe(30_000);
    const depois = situacaoDoCiclo(c, { baseSala: 0, disparadoAteTau: 40_000 }, 120_000);
    expect(depois.atual?.evento).toBe("a");
  });
});
