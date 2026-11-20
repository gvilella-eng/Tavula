import { describe, expect, it } from "vitest";
import {
  AutomacoesSchema,
  botaoDentroDoLimite,
  botoesParaJogador,
  type Estado,
  estadoInicial,
  eventoPara,
  fonteComSemente,
  type Gatilho,
  gatilhoPrincipal,
  INTERVALO_MINIMO_DO_BOTAO_MS,
  type Intencao,
  IntencaoSchema,
  modelosPadrao,
  nomeDoEvento,
  type ObjetoDeLuz,
  processar,
  situacaoDoFluxo,
  visaoPara,
} from "./index.ts";

// Lote 7b-3 (AU1: com os fluxos): os botões na barra (fixar e liberar), a conferência a cada clique e o sigilo da definição.
// As definições aqui são da forma antiga (ciclos, reações e botões): a carga as converte em fluxos, e o id do botão de evento
// vira `botao-<id>`.

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
      { id: "evento:botao-b1", tipo: "evento", nome: "Soprar o vento", rotulo: expect.any(String) },
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
      automacoes: AutomacoesSchema.parse({ fluxos: [] }),
    };
    expect(visaoPara(sem, J1, T0).botoes).toBeUndefined();
  });

  it("o evento da mudança vira a lista dos botões para o jogador e nada para o resto da fatia", () => {
    const antes = criarEstado();
    const r = ok(antes, "m", intencao("fluxo.ligar", { id: "resp", ligado: false }));
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
        {
          id: "evento:botao-b1",
          tipo: "evento",
          nome: "Soprar o vento",
          rotulo: expect.any(String),
        },
      ],
    });
  });

  it("mudança que não muda os botões (editar o botão do mestre) não chega ao jogador", () => {
    const antes = criarEstado();
    const r = ok(
      antes,
      "m",
      intencao("fluxo.editar", { id: "botao-b2", mudancas: { nome: "Outro nome do mestre" } }),
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
    const r = ok(criarEstado(), "j1", intencao("botao.usar", { botaoId: "evento:botao-b1" }));
    expect(anuncios(r.estado)).toEqual(["O vento sopra."]);
  });

  it("o jogador dispara, pausa e retoma o ciclo liberado", () => {
    let e = criarEstado();
    e = ok(e, "j1", intencao("botao.usar", { botaoId: "ciclo:resp", acao: "pausar" })).estado;
    expect(e.automacoes?.fluxos.find((f) => f.id === "resp")?.ligado).toBe(false);
    e = ok(e, "j1", intencao("botao.usar", { botaoId: "ciclo:resp", acao: "retomar" }), 5).estado;
    expect(e.automacoes?.fluxos.find((f) => f.id === "resp")?.ligado).toBe(true);
    const disparou = ok(e, "j1", intencao("botao.usar", { botaoId: "ciclo:resp" }), 6);
    expect(disparou.eventos.length).toBeGreaterThan(0);
  });

  it("sem a liberação a sala recusa, e botão que não existe dá o mesmo erro", () => {
    const e = criarEstado();
    const a = recusa(e, "j1", intencao("botao.usar", { botaoId: "evento:botao-b2" }));
    const b = recusa(e, "j1", intencao("botao.usar", { botaoId: "ciclo:escondido" }));
    const c = recusa(e, "j1", intencao("botao.usar", { botaoId: "ciclo:nao-existe" }));
    expect(a.codigo).toBe("sem_permissao");
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("a liberação é conferida a cada clique: desfeita, o jogador não usa mais", () => {
    let e = criarEstado();
    ok(e, "j1", intencao("botao.usar", { botaoId: "evento:botao-b1" }));
    e = ok(
      e,
      "m",
      intencao("fluxo.editar", { id: "botao-b1", mudancas: { liberadoParaJogadores: false } }),
    ).estado;
    expect(recusa(e, "j1", intencao("botao.usar", { botaoId: "evento:botao-b1" })).codigo).toBe(
      "sem_permissao",
    );
  });

  it("o mestre usa qualquer botão", () => {
    ok(criarEstado(), "m", intencao("botao.usar", { botaoId: "evento:botao-b2" }));
    ok(criarEstado(), "m", intencao("botao.usar", { botaoId: "ciclo:escondido", acao: "pausar" }));
  });
});

describe("fixar, liberar e apagar (só o mestre)", () => {
  it("o jogador não cria, edita nem apaga", () => {
    const e = criarEstado();
    expect(
      recusa(e, "j1", intencao("fluxo.editar", { id: "botao-b1", mudancas: { nome: "Y" } })).codigo,
    ).toBe("sem_permissao");
    expect(recusa(e, "j1", intencao("fluxo.apagar", { id: "botao-b1" })).codigo).toBe(
      "sem_permissao",
    );
    expect(
      recusa(e, "j1", intencao("fluxo.editar", { id: "resp", mudancas: { fixado: true } })).codigo,
    ).toBe("sem_permissao");
  });

  it("o mestre edita (inclusive o gatilho) e apaga o botão", () => {
    let e = criarEstado();
    e = ok(
      e,
      "m",
      intencao("fluxo.editar", { id: "botao-b1", mudancas: { nome: "Mudou", fixado: true } }),
    ).estado;
    expect(e.automacoes?.fluxos.find((f) => f.id === "botao-b1")).toMatchObject({
      nome: "Mudou",
      fixado: true,
    });
    e = ok(
      e,
      "m",
      intencao("fluxo.editar", {
        id: "botao-b1",
        mudancas: {
          nos: (e.automacoes?.fluxos.find((f) => f.id === "botao-b1")?.nos ?? []).map((n) =>
            n.tipo === "gatilho"
              ? { ...n, config: { tipo: "botao" as const, nome: "Mudou", cena: "pulmao" } }
              : n,
          ),
        },
      }),
    ).estado;
    const mudado = e.automacoes?.fluxos.find((f) => f.id === "botao-b1");
    expect(mudado && gatilhoPrincipal(mudado)).toMatchObject({ cena: "pulmao" });
    e = ok(e, "m", intencao("fluxo.apagar", { id: "botao-b1" })).estado;
    expect(e.automacoes?.fluxos.some((f) => f.id === "botao-b1")).toBe(false);
  });

  it("recusa botão que não existe e cena que não existe", () => {
    const e = criarEstado();
    expect(recusa(e, "m", intencao("fluxo.apagar", { id: "nada" })).codigo).toBe(
      "fluxo_inexistente",
    );
    expect(
      recusa(
        e,
        "m",
        intencao("fluxo.editar", {
          id: "botao-b1",
          mudancas: {
            nos: (e.automacoes?.fluxos.find((f) => f.id === "botao-b1")?.nos ?? []).map((n) =>
              n.tipo === "gatilho"
                ? { ...n, config: { tipo: "botao" as const, nome: "X", cena: "fantasma" } }
                : n,
            ),
          },
        }),
      ).codigo,
    ).toBe("dados_invalidos");
  });

  it("fixar e liberar um fluxo de relógio não reinicia o relógio nem apaga as cenas", () => {
    let e = criarEstado();
    e = ok(e, "m", intencao("fluxo.editar", { id: "resp", mudancas: { fixado: true } })).estado;
    const f = e.automacoes?.fluxos.find((x) => x.id === "resp");
    expect(f?.fixado).toBe(true);
    expect(f?.cenas).toEqual(["pulmao"]);
    expect(f?.liberadoParaJogadores).toBe(true);
    expect(e.automacoes?.execucao.resp).toBeDefined();
  });

  it("uma campanha sem o campo fluxos carrega com a lista vazia", () => {
    const a = AutomacoesSchema.parse({});
    expect(a.fluxos).toEqual([]);
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
    expect(botoesParaJogador({ fluxos: [] })).toEqual([]);
  });
});

describe("situação do fluxo de relógio", () => {
  const no = (config: Gatilho) => [{ id: "g", tipo: "gatilho" as const, x: 0, y: 0, config }];
  const f = { nos: no({ tipo: "relogio", cadaS: 100 }), ligado: true };

  it("conta o tempo do próximo disparo", () => {
    const s = situacaoDoFluxo(f, { baseSala: 0, proximoTau: 100_000 }, 40_000);
    expect(s).toEqual({ rodando: true, proximaEmMs: 60_000 });
  });

  it("desligado, o tempo não anda; sem execução, dispara no primeiro instante", () => {
    expect(
      situacaoDoFluxo({ ...f, ligado: false }, { baseSala: 0, proximoTau: 100_000 }, 5000),
    ).toEqual({ rodando: false, proximaEmMs: null });
    expect(situacaoDoFluxo(f, undefined, 5000)).toEqual({ rodando: true, proximaEmMs: 0 });
  });

  it("fluxo de outro gatilho não tem próximo disparo", () => {
    expect(situacaoDoFluxo({ nos: no({ tipo: "turno" }), ligado: true }, undefined, 0)).toEqual({
      rodando: true,
      proximaEmMs: null,
    });
  });
});
