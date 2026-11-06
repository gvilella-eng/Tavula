import { describe, expect, it } from "vitest";
import {
  CONFIG_PADRAO,
  dentroDoAlcance,
  distanciaEmQuadrados,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  formatarRestante,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  lerIntencao,
  modelosPadrao,
  type ObjetoDeLuz,
  type Papel,
  pausarRelogio,
  processar,
  processarSistema,
  proximoMarcoDoObjeto,
  relogioInicial,
  restanteDoObjeto,
  retomarRelogio,
  tempoDaSala,
  VERSAO_EXPORTACAO,
  visaoPara,
} from "./index.ts";

// Relógio falso: a sala "começa" em T0 e cada teste passa o `agora` que quiser.
const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const MIN = 60_000;
const em = (minutos: number) => new Date(T0 + minutos * MIN).toISOString();

const MESTRE = { id: "m", papel: "mestre" as const };
const J1 = { id: "j1", papel: "jogador" as const };
const J2 = { id: "j2", papel: "jogador" as const };

const modelos = () =>
  modelosPadrao().map((m) => (m.id === "modelo-tocha" ? { ...m, duracaoS: 1800 } : m));

const personagem = (
  id: string,
  nome: string,
  dono: string,
  mochila: Record<string, number> = {},
) => ({
  id,
  pastaId: "pasta-personagens",
  editores: { tipo: "jogadores" as const, ids: [dono] },
  nome,
  tokenPadrao: { cor: "#0f0", tamanhoQuadrados: 1 },
  visao: { alcanceM: null, visaoNoEscuroM: 0 },
  mochila,
  ficha: { pvAtual: 10, pvMax: 10 },
});

const token = (id: string, personagemId: string, x: number, y: number) => ({
  id,
  cenaId: "c1",
  nome: id,
  cor: "#0f0",
  tamanhoQuadrados: 1,
  x,
  y,
  camada: "tokens" as const,
  oculto: false,
  controladoPor: [],
  personagemId,
});

function criarEstado(config: Partial<typeof CONFIG_PADRAO> = {}): Estado {
  return estadoInicial(
    {
      usuarios: [
        { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
        { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
        { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
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
      modelos: modelos(),
      config: { ...CONFIG_PADRAO, ...config },
      personagens: [
        personagem("p1", "Aldric", "j1", { "modelo-tocha": 5 }),
        personagem("p2", "Bela", "j2", { "modelo-tocha": 2 }),
        personagem("p3", "Caio", "j1", { "modelo-tocha": 2 }),
      ],
      tokens: [
        token("t1", "p1", 5.25, 5.25),
        token("t2", "p2", 6.75, 5.25), // vizinho do t1
        token("t3", "p3", 15.75, 5.25), // longe
      ],
    },
    T0,
  );
}

let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });

function ok(estado: Estado, quem: string, i: Intencao, agora = em(0)) {
  const r = processar(estado, quem, i, agora);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} (${r.erro.mensagem})`);
  return r;
}
function recusa(estado: Estado, quem: string, i: Intencao, agora = em(0)): string | null {
  const r = processar(estado, quem, i, agora);
  return r.ok ? null : r.erro.codigo;
}
const luz = (e: Estado, id: string): ObjetoDeLuz | undefined => e.luzes.find((l) => l.id === id);
const acender = (e: Estado, quem: string, personagemId: string, novoId: string, agora = em(0)) =>
  ok(e, quem, intencao("tocha.acender", { personagemId, modeloId: "modelo-tocha", novoId }), agora)
    .estado;

describe("relogio da sala", () => {
  it("conta enquanto roda, congela na pausa e continua de onde parou", () => {
    const r0 = relogioInicial(T0);
    expect(tempoDaSala(r0, T0 + 10 * MIN)).toBe(10 * MIN);
    const pausado = pausarRelogio(r0, T0 + 10 * MIN);
    expect(pausado).toEqual({ pausada: true, acumuladoMs: 10 * MIN });
    expect(tempoDaSala(pausado, T0 + 99 * MIN)).toBe(10 * MIN);
    const retomado = retomarRelogio(pausado, T0 + 20 * MIN);
    expect(tempoDaSala(retomado, T0 + 25 * MIN)).toBe(15 * MIN);
  });
  it("formata o restante", () => {
    expect(formatarRestante(754_000)).toBe("12:34");
    expect(formatarRestante(3_725_000)).toBe("1:02:05");
    expect(formatarRestante(0)).toBe("00:00");
  });
});

describe("alcance (Chebyshev no grid)", () => {
  const q = 1.5;
  const a = { x: 5.25, y: 5.25, tamanhoQuadrados: 1 };
  it("vizinhos, inclusive na diagonal, estão a 1 quadrado", () => {
    expect(distanciaEmQuadrados(a, { x: 6.75, y: 5.25, tamanhoQuadrados: 1 }, q)).toBe(1);
    expect(distanciaEmQuadrados(a, { x: 6.75, y: 6.75, tamanhoQuadrados: 1 }, q)).toBe(1);
    expect(distanciaEmQuadrados(a, { x: 8.25, y: 5.25, tamanhoQuadrados: 1 }, q)).toBe(2);
    expect(distanciaEmQuadrados(a, a, q)).toBe(0);
  });
  it("com 1,5 m só os adjacentes; com 3 m, até dois quadrados", () => {
    const vizinho = { x: 6.75, y: 6.75, tamanhoQuadrados: 1 };
    const longe = { x: 8.25, y: 5.25, tamanhoQuadrados: 1 };
    expect(dentroDoAlcance(a, vizinho, 1.5, q)).toBe(true);
    expect(dentroDoAlcance(a, longe, 1.5, q)).toBe(false);
    expect(dentroDoAlcance(a, longe, 3, q)).toBe(true);
  });
  it("token grande: conta do quadrado mais próximo", () => {
    const grande = { x: 9, y: 5.25 + 0.75, tamanhoQuadrados: 2 }; // cobre colunas 5-6, linhas 3-4
    expect(distanciaEmQuadrados(a, grande, q)).toBe(2);
    expect(dentroDoAlcance(a, grande, 1.5, q)).toBe(false);
    expect(dentroDoAlcance({ ...a, x: 7.5 }, grande, 1.5, q)).toBe(true);
  });
  it("o ponto ocupa o quadrado que o contém", () => {
    expect(distanciaEmQuadrados(a, { x: 6.2, y: 5.4 }, q)).toBe(1);
    expect(dentroDoAlcance(a, { x: 5.0, y: 5.0 }, 1.5, q)).toBe(true);
  });
});

describe("acender da mochila e as mãos", () => {
  it("acender põe a tocha na mão, desconta uma nova e começa a contar", () => {
    const e = acender(criarEstado(), "j1", "p1", "o1");
    const o = luz(e, "o1");
    expect(o).toMatchObject({
      estado: "acesa",
      portador: { tipo: "mao", personagemId: "p1", mao: 0 },
      saldoMs: 30 * MIN,
      acesaDesdeSala: 0,
    });
    expect(e.personagens.find((p) => p.id === "p1")?.mochila?.["modelo-tocha"]).toBe(4);
  });
  it("a terceira tocha com duas mãos é recusada; guardar libera a mão", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = acender(e, "j1", "p1", "o2");
    expect(luz(e, "o2")?.portador).toMatchObject({ mao: 1 });
    expect(
      recusa(
        e,
        "j1",
        intencao("tocha.acender", { personagemId: "p1", modeloId: "modelo-tocha", novoId: "o3" }),
      ),
    ).toBe("maos_cheias");
    e = ok(e, "j1", intencao("tocha.guardar", { id: "o1" })).estado;
    expect(luz(e, "o1")?.portador.tipo).toBe("mochila");
    e = acender(e, "j1", "p1", "o3");
    expect(luz(e, "o3")?.portador).toMatchObject({ mao: 0 });
  });
  it("a tocha apagada continua ocupando a mão", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = acender(e, "j1", "p1", "o2");
    e = ok(e, "j1", intencao("tocha.alternar", { id: "o1" })).estado;
    expect(luz(e, "o1")?.estado).toBe("apagada");
    expect(
      recusa(
        e,
        "j1",
        intencao("tocha.acender", { personagemId: "p1", modeloId: "modelo-tocha", novoId: "o3" }),
      ),
    ).toBe("maos_cheias");
  });
  it("mãos por personagem vêm da configuração", () => {
    let e = criarEstado({ maosPorPersonagem: 1 });
    e = acender(e, "j1", "p1", "o1");
    expect(
      recusa(
        e,
        "j1",
        intencao("tocha.acender", { personagemId: "p1", modeloId: "modelo-tocha", novoId: "o2" }),
      ),
    ).toBe("maos_cheias");
  });
  it("sem nova na mochila, recusa; a usada guardada acende de novo", () => {
    let e = ok(
      criarEstado(),
      "m",
      intencao("mochila.ajustar", { personagemId: "p2", modeloId: "modelo-tocha", delta: -2 }),
    ).estado;
    expect(
      recusa(
        e,
        "j2",
        intencao("tocha.acender", { personagemId: "p2", modeloId: "modelo-tocha", novoId: "x" }),
      ),
    ).toBe("dados_invalidos");
    e = acender(e, "j1", "p1", "o1");
    e = ok(e, "j1", intencao("tocha.guardar", { id: "o1" }), em(5)).estado;
    e = ok(
      e,
      "j1",
      intencao("tocha.acender", { personagemId: "p1", modeloId: "modelo-tocha", objetoId: "o1" }),
      em(6),
    ).estado;
    expect(luz(e, "o1")).toMatchObject({ estado: "acesa", portador: { tipo: "mao" } });
    expect(restanteDoObjeto(luz(e, "o1") as ObjetoDeLuz, 6 * MIN)).toBe(25 * MIN);
    expect(e.personagens.find((p) => p.id === "p1")?.mochila?.["modelo-tocha"]).toBe(4);
  });
  it("só o dono (ou o mestre) acende para o personagem", () => {
    const e = criarEstado();
    const i = intencao("tocha.acender", {
      personagemId: "p1",
      modeloId: "modelo-tocha",
      novoId: "o1",
    });
    expect(recusa(e, "j2", i)).toBe("personagem_inexistente"); // nem vê o personagem
    expect(recusa(e, "m", i)).toBeNull();
  });
});

describe("tempo: fim, pausa, penalidade, ajuste", () => {
  it("tocha de 30 min apaga aos 30 min e libera a mão", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    const antes = processarSistema(e, em(29.99));
    if (!antes.ok) throw new Error("falhou");
    expect(luz(antes.estado, "o1")).toBeDefined();
    const r = processarSistema(e, em(30));
    if (!r.ok) throw new Error("falhou");
    expect(r.eventos.map((v) => v.tipo)).toEqual(["fonte.apagada"]);
    expect(luz(r.estado, "o1")).toBeUndefined();
    e = acender(r.estado, "j1", "p1", "o2", em(30));
    expect(luz(e, "o2")?.portador).toMatchObject({ mao: 0 });
  });
  it("pausa de 5 min empurra o fim em 5 min", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = ok(e, "m", intencao("mesa.pausar"), em(10)).estado;
    expect(e.relogio).toEqual({ pausada: true, acumuladoMs: 10 * MIN });
    // Pausada, o tempo não passa, mesmo muito depois.
    const durante = processarSistema(e, em(500));
    if (!durante.ok) throw new Error("falhou");
    expect(luz(durante.estado, "o1")).toBeDefined();
    e = ok(e, "m", intencao("mesa.retomar"), em(15)).estado;
    // Teria acabado em 30; com 5 min de pausa acaba em 35.
    const aos30 = processarSistema(e, em(30));
    const aos34 = processarSistema(e, em(34.9));
    const aos35 = processarSistema(e, em(35));
    if (!aos30.ok || !aos34.ok || !aos35.ok) throw new Error("falhou");
    expect(luz(aos30.estado, "o1")).toBeDefined();
    expect(luz(aos34.estado, "o1")).toBeDefined();
    expect(luz(aos35.estado, "o1")).toBeUndefined();
  });
  it("pausar e retomar de novo é inofensivo; só o mestre faz", () => {
    const e = criarEstado();
    expect(recusa(e, "j1", intencao("mesa.pausar"))).toBe("sem_permissao");
    expect(ok(e, "m", intencao("mesa.retomar")).eventos).toHaveLength(0);
    const p = ok(e, "m", intencao("mesa.pausar"));
    expect(p.snapshotPara).toBe("todos");
    expect(ok(p.estado, "m", intencao("mesa.pausar")).eventos).toHaveLength(0);
  });
  it("apagar desconta a penalidade; reacender usa o mesmo saldo", () => {
    let e = criarEstado({ penalidadeAoApagarS: 60 });
    e = acender(e, "j1", "p1", "o1");
    e = ok(e, "j1", intencao("tocha.alternar", { id: "o1" }), em(5)).estado;
    const apagada = luz(e, "o1") as ObjetoDeLuz;
    expect(apagada.estado).toBe("apagada");
    expect(apagada.saldoMs).toBe(24 * MIN); // 30 − 5 − 1
    expect(apagada.acesaDesdeSala).toBeUndefined();
    expect(apagada.historico.at(-1)).toMatchObject({ deltaMs: -60_000 });
    e = ok(e, "j1", intencao("tocha.alternar", { id: "o1" }), em(8)).estado;
    expect(restanteDoObjeto(luz(e, "o1") as ObjetoDeLuz, 8 * MIN)).toBe(24 * MIN);
  });
  it("apagar com a penalidade maior que o que sobra consome a tocha", () => {
    let e = criarEstado({ penalidadeAoApagarS: 60 });
    e = acender(e, "j1", "p1", "o1");
    const r = ok(e, "j1", intencao("tocha.alternar", { id: "o1" }), em(29.5));
    expect(luz(r.estado, "o1")).toBeUndefined();
  });
  it("o ajuste do mestre soma no saldo e entra no histórico", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = ok(
      e,
      "m",
      intencao("objeto.ajustar", {
        id: "o1",
        ajuste: { acao: "tempo", deltaMs: MIN, nota: "apagou sem querer" },
      }),
      em(10),
    ).estado;
    const o = luz(e, "o1") as ObjetoDeLuz;
    expect(restanteDoObjeto(o, 10 * MIN)).toBe(21 * MIN);
    expect(o.historico.at(-1)).toMatchObject({ deltaMs: MIN });
    expect(o.historico.at(-1)?.texto).toContain("+1 min (mestre)");
    expect(o.historico.at(-1)?.texto).toContain("apagou sem querer");
    e = ok(
      e,
      "m",
      intencao("objeto.ajustar", { id: "o1", ajuste: { acao: "tempo", deltaMs: -MIN } }),
      em(10),
    ).estado;
    expect(restanteDoObjeto(luz(e, "o1") as ObjetoDeLuz, 10 * MIN)).toBe(20 * MIN);
    // tirar mais do que sobra consome
    const fim = ok(
      e,
      "m",
      intencao("objeto.ajustar", { id: "o1", ajuste: { acao: "tempo", deltaMs: -25 * MIN } }),
      em(10),
    );
    expect(luz(fim.estado, "o1")).toBeUndefined();
  });
  it("o jogador não ajusta nem consome; o mestre consome (lixeira)", () => {
    const e = acender(criarEstado(), "j1", "p1", "o1");
    const i = intencao("objeto.ajustar", { id: "o1", ajuste: { acao: "consumir" } });
    expect(recusa(e, "j1", i)).toBe("sem_permissao");
    expect(luz(ok(e, "m", i).estado, "o1")).toBeUndefined();
  });
  it("modificador de raio com prazo vence sozinho pelo relógio da sala", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = ok(
      e,
      "m",
      intencao("objeto.ajustar", {
        id: "o1",
        ajuste: { acao: "modificar", modificador: { id: "mod1", raioX: 0.5, duracaoMs: 2 * MIN } },
      }),
      em(1),
    ).estado;
    expect(visaoPara(e, J1, T0 + 2 * MIN).luzes.find((l) => l.id === "o1")?.fatorDeRaio).toBe(0.5);
    expect(
      visaoPara(e, J1, T0 + 4 * MIN).luzes.find((l) => l.id === "o1")?.fatorDeRaio,
    ).toBeUndefined();
    const r = processarSistema(e, em(4));
    if (!r.ok) throw new Error("falhou");
    expect(luz(r.estado, "o1")?.modificadores).toHaveLength(0);
    expect(r.eventos.map((v) => v.tipo)).toEqual(["fonte.editada"]);
  });
  it("o próximo marco: estágio fraca (50%), morrendo (10%) e o fim", () => {
    const e = acender(criarEstado(), "j1", "p1", "o1");
    const o = luz(e, "o1") as ObjetoDeLuz;
    const est = e.config.estagios;
    expect(proximoMarcoDoObjeto(o, 0, est)).toBe(15 * MIN);
    expect(proximoMarcoDoObjeto(o, 15 * MIN, est)).toBe(12 * MIN); // 15 → 3 min restantes
    expect(proximoMarcoDoObjeto(o, 27 * MIN, est)).toBe(3 * MIN);
    expect(proximoMarcoDoObjeto({ ...o, estado: "apagada" }, 0, est)).toBeNull();
  });
});

describe("entregar, suporte e inflamável", () => {
  it("o portador entrega a tocha a um token adjacente e o saldo vai junto", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = ok(e, "j1", intencao("tocha.entregar", { id: "o1", tokenId: "t2" }), em(10)).estado;
    const o = luz(e, "o1") as ObjetoDeLuz;
    expect(o.portador).toMatchObject({ tipo: "mao", personagemId: "p2" });
    expect(restanteDoObjeto(o, 10 * MIN)).toBe(20 * MIN);
    expect(o.historico.at(-1)?.texto).toContain("Bela");
  });
  it("entregar fora do alcance é recusado", () => {
    const e = acender(criarEstado(), "j1", "p1", "o1");
    expect(recusa(e, "j1", intencao("tocha.entregar", { id: "o1", tokenId: "t3" }))).toBe(
      "fora_de_alcance",
    );
    // o alcance vem da configuração
    const largo = acender(criarEstado({ alcanceInteracaoM: 12 }), "j1", "p1", "o1");
    expect(recusa(largo, "j1", intencao("tocha.entregar", { id: "o1", tokenId: "t3" }))).toBeNull();
  });
  it("sem mão livre no destino, recusa", () => {
    let e = acender(criarEstado({ maosPorPersonagem: 1 }), "j1", "p1", "o1");
    e = ok(
      e,
      "j2",
      intencao("tocha.acender", { personagemId: "p2", modeloId: "modelo-tocha", novoId: "x" }),
    ).estado;
    expect(recusa(e, "j1", intencao("tocha.entregar", { id: "o1", tokenId: "t2" }))).toBe(
      "maos_cheias",
    );
  });
  it("outro jogador não mexe na tocha alheia (nem a vê: responde como inexistente)", () => {
    const e = acender(criarEstado(), "j1", "p1", "o1");
    for (const tipo of ["tocha.alternar", "tocha.guardar"] as const) {
      expect(recusa(e, "j2", intencao(tipo, { id: "o1" }))).toBe("sem_permissao");
    }
    expect(recusa(e, "j2", intencao("tocha.entregar", { id: "o1", tokenId: "t2" }))).toBe(
      "sem_permissao",
    );
    // o mestre pode
    expect(recusa(e, "m", intencao("tocha.entregar", { id: "o1", tokenId: "t2" }))).toBeNull();
  });
  it("quem controla outro personagem pelo token também entrega a dele", () => {
    let e = criarEstado();
    // j1 edita p1 e p3: a tocha de p3 também é dele
    e = acender(e, "j1", "p3", "o3");
    expect(recusa(e, "j1", intencao("tocha.entregar", { id: "o3", tokenId: "t1" }))).toBe(
      "fora_de_alcance",
    );
  });
  it("suporte: posa a tocha com alcance e espaço; tirar exige alcance e mão livre", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = ok(
      e,
      "m",
      intencao("ponto.criar", {
        ponto: {
          id: "s1",
          nome: "Suporte",
          x: 5.25,
          y: 6.75,
          tipo: "suporte",
          visivelParaJogadores: true,
        },
      }),
    ).estado;
    e = ok(
      e,
      "m",
      intencao("ponto.criar", {
        ponto: {
          id: "longe",
          nome: "Suporte longe",
          x: 25,
          y: 25,
          tipo: "suporte",
          visivelParaJogadores: true,
        },
      }),
    ).estado;
    expect(recusa(e, "j1", intencao("tocha.posar", { id: "o1", pontoId: "longe" }))).toBe(
      "fora_de_alcance",
    );
    e = ok(e, "j1", intencao("tocha.posar", { id: "o1", pontoId: "s1" })).estado;
    expect(luz(e, "o1")?.portador).toEqual({ tipo: "ponto", pontoId: "s1" });
    // o suporte tem capacidade 1
    e = acender(e, "j1", "p1", "o2");
    expect(recusa(e, "j1", intencao("tocha.posar", { id: "o2", pontoId: "s1" }))).toBe(
      "suporte_cheio",
    );
    // quem está longe não pega; quem está perto, sim
    expect(recusa(e, "j1", intencao("ponto.pegar", { id: "o1", personagemId: "p3" }))).toBe(
      "fora_de_alcance",
    );
    e = ok(e, "j1", intencao("tocha.guardar", { id: "o2" })).estado;
    e = ok(e, "j1", intencao("ponto.pegar", { id: "o1", personagemId: "p1" })).estado;
    expect(luz(e, "o1")?.portador).toMatchObject({ tipo: "mao", personagemId: "p1" });
  });
  it("inflamável: antes de segurarS é recusado; depois acende o modelo do ponto e o torna visível", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = ok(
      e,
      "m",
      intencao("ponto.criar", {
        ponto: {
          id: "lenha",
          nome: "Lenha",
          x: 5.25,
          y: 6.75,
          tipo: "inflamavel",
          modeloId: "modelo-fogueira",
          visivelParaJogadores: false,
        },
      }),
    ).estado;
    // sem o ponto visível o jogador nem o enxerga
    expect(
      recusa(e, "j1", intencao("ponto.acenderInicio", { pontoId: "lenha", objetoId: "o1" })),
    ).toBe("ponto_inexistente");
    e = ok(
      e,
      "m",
      intencao("ponto.editar", {
        id: "lenha",
        mudancas: { visivelParaJogadores: true, segurarS: 5 },
      }),
    ).estado;
    // fim sem início
    expect(
      recusa(e, "j1", intencao("ponto.acenderFim", { pontoId: "lenha", objetoId: "o1" }), em(1)),
    ).toBe("segurar_incompleto");
    e = ok(
      e,
      "j1",
      intencao("ponto.acenderInicio", { pontoId: "lenha", objetoId: "o1" }),
      em(1),
    ).estado;
    const cedo = processar(
      e,
      "j1",
      intencao("ponto.acenderFim", { pontoId: "lenha", objetoId: "o1" }),
      new Date(T0 + MIN + 3000).toISOString(),
    );
    expect(cedo.ok ? null : cedo.erro.codigo).toBe("segurar_incompleto");
    const certo = processar(
      e,
      "j1",
      intencao("ponto.acenderFim", { pontoId: "lenha", objetoId: "o1" }),
      new Date(T0 + MIN + 5100).toISOString(),
    );
    if (!certo.ok) throw new Error("falhou");
    const fogo = certo.estado.luzes.find((l) => l.portador.tipo === "ponto");
    expect(fogo).toMatchObject({ modeloId: "modelo-fogueira", estado: "acesa", saldoMs: null });
    // a tocha continua na mão e o ponto ficou visível (o início pendente foi gasto)
    expect(luz(certo.estado, "o1")?.portador.tipo).toBe("mao");
    expect(certo.estado.pontos.find((p) => p.id === "lenha")?.visivelParaJogadores).toBe(true);
    expect(certo.estado.acendimentos).toEqual({});
    // já tem fogo: não acende de novo
    expect(
      recusa(
        certo.estado,
        "j1",
        intencao("ponto.acenderInicio", { pontoId: "lenha", objetoId: "o1" }),
      ),
    ).toBe("dados_invalidos");
  });
  it("inflamável: tocha apagada ou longe do ponto não acende", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = ok(
      e,
      "m",
      intencao("ponto.criar", {
        ponto: {
          id: "lenha",
          nome: "Lenha",
          x: 25,
          y: 25,
          tipo: "inflamavel",
          modeloId: "modelo-fogueira",
          visivelParaJogadores: true,
        },
      }),
    ).estado;
    expect(
      recusa(e, "j1", intencao("ponto.acenderInicio", { pontoId: "lenha", objetoId: "o1" })),
    ).toBe("fora_de_alcance");
    e = ok(
      e,
      "m",
      intencao("ponto.editar", { id: "lenha", mudancas: { x: 5.25, y: 6.75 } }),
    ).estado;
    e = ok(e, "j1", intencao("tocha.alternar", { id: "o1" })).estado;
    expect(
      recusa(e, "j1", intencao("ponto.acenderInicio", { pontoId: "lenha", objetoId: "o1" })),
    ).toBe("dados_invalidos");
  });
  it("apagar a fogueira de um ponto exige luz.apagar (desligado para jogador) e alcance", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = ok(
      e,
      "m",
      intencao("ponto.criar", {
        ponto: {
          id: "lenha",
          nome: "Lenha",
          x: 5.25,
          y: 6.75,
          tipo: "inflamavel",
          modeloId: "modelo-fogueira",
          segurarS: 0,
          visivelParaJogadores: true,
        },
      }),
    ).estado;
    e = ok(e, "j1", intencao("ponto.acenderInicio", { pontoId: "lenha", objetoId: "o1" })).estado;
    e = ok(e, "j1", intencao("ponto.acenderFim", { pontoId: "lenha", objetoId: "o1" })).estado;
    const fogo = e.luzes.find((l) => l.portador.tipo === "ponto") as ObjetoDeLuz;
    expect(recusa(e, "j1", intencao("tocha.alternar", { id: fogo.id }))).toBe("sem_permissao");
    const mestreApaga = ok(e, "m", intencao("tocha.alternar", { id: fogo.id })).estado;
    expect(luz(mestreApaga, fogo.id)?.estado).toBe("apagada");
  });
});

describe("pontos e modelos", () => {
  it("ponto.apagar leva os objetos que estão nele", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = ok(
      e,
      "m",
      intencao("ponto.criar", {
        ponto: {
          id: "s1",
          nome: "S",
          x: 5.25,
          y: 6.75,
          tipo: "suporte",
          visivelParaJogadores: true,
        },
      }),
    ).estado;
    e = ok(e, "j1", intencao("tocha.posar", { id: "o1", pontoId: "s1" })).estado;
    e = ok(e, "m", intencao("ponto.apagar", { id: "s1" })).estado;
    expect(luz(e, "o1")).toBeUndefined();
    expect(e.pontos).toHaveLength(0);
  });
  it("só o mestre mexe em pontos, modelos e na configuração", () => {
    const e = criarEstado();
    expect(
      recusa(
        e,
        "j1",
        intencao("ponto.criar", {
          ponto: { id: "s", nome: "S", x: 1, y: 1, tipo: "suporte", visivelParaJogadores: true },
        }),
      ),
    ).toBe("sem_permissao");
    expect(recusa(e, "j1", intencao("config.mesa", { mudancas: { maosPorPersonagem: 3 } }))).toBe(
      "sem_permissao",
    );
    expect(recusa(e, "j1", intencao("modelo.apagar", { id: "modelo-lanterna" }))).toBe(
      "sem_permissao",
    );
    expect(
      recusa(
        e,
        "j1",
        intencao("mochila.ajustar", { personagemId: "p1", modeloId: "modelo-tocha", delta: 1 }),
      ),
    ).toBe("sem_permissao");
  });
  it("config.mesa muda os campos e valida os estágios; modelo em uso não se apaga", () => {
    let e = criarEstado();
    e = ok(
      e,
      "m",
      intencao("config.mesa", {
        mudancas: {
          penalidadeAoApagarS: 60,
          tempoParaJogadores: "oculto",
          estagios: { morrendo: 0.2 },
        },
      }),
    ).estado;
    expect(e.config).toMatchObject({
      penalidadeAoApagarS: 60,
      tempoParaJogadores: "oculto",
      estagios: { fraca: 0.5, morrendo: 0.2 },
    });
    expect(
      recusa(e, "m", intencao("config.mesa", { mudancas: { estagios: { fraca: 0.1 } } })),
    ).toBe("dados_invalidos");
    expect(recusa(e, "m", intencao("modelo.apagar", { id: "modelo-tocha" }))).toBe(
      "dados_invalidos",
    );
    e = ok(e, "m", intencao("modelo.apagar", { id: "modelo-lanterna" })).estado;
    expect(e.modelos.map((m) => m.id)).not.toContain("modelo-lanterna");
    e = ok(
      e,
      "m",
      intencao("modelo.criar", {
        modelo: {
          id: "m-novo",
          nome: "Vela",
          luz: { claraM: 1.5, penumbraM: 1.5, cor: "#ffffff", tremula: true },
          duracaoS: 600,
          ocupaMao: true,
          tags: [],
        },
      }),
    ).estado;
    e = ok(
      e,
      "m",
      intencao("modelo.editar", { id: "m-novo", mudancas: { duracaoS: null, luz: { claraM: 3 } } }),
    ).estado;
    expect(e.modelos.find((m) => m.id === "m-novo")).toMatchObject({
      duracaoS: null,
      luz: { claraM: 3, penumbraM: 1.5 },
    });
  });
  it("mochila.ajustar muda a quantidade (nunca abaixo de 0)", () => {
    let e = criarEstado();
    e = ok(
      e,
      "m",
      intencao("mochila.ajustar", { personagemId: "p2", modeloId: "modelo-tocha", delta: 3 }),
    ).estado;
    expect(e.personagens.find((p) => p.id === "p2")?.mochila?.["modelo-tocha"]).toBe(5);
    e = ok(
      e,
      "m",
      intencao("mochila.ajustar", { personagemId: "p2", modeloId: "modelo-tocha", delta: -9 }),
    ).estado;
    expect(e.personagens.find((p) => p.id === "p2")?.mochila?.["modelo-tocha"]).toBe(0);
  });
});

describe("a intenção do tempo é só do sistema", () => {
  it("nenhum cliente consegue mandar o vencimento", () => {
    for (const tipo of ["sistema.processarTempo", "sistema.vencer", "tempo.passou", "luz.vencer"]) {
      const lida = lerIntencao(JSON.stringify({ v: 1, id: "x", tipo, dados: {} }));
      expect(lida.ok, tipo).toBe(false);
    }
    const tipos = IntencaoSchema.options.map((o) => o.shape.tipo.value as string);
    expect(tipos.filter((t) => /sistema|vencer|vencimento|tempo\./.test(t))).toEqual([]);
  });
  it("processar não reconhece o usuário 'sistema'", () => {
    const e = criarEstado();
    const r = processar(e, "sistema", intencao("mesa.pausar"), em(0));
    expect(r.ok).toBe(false);
  });
  it("o evento do sistema vem com a origem do sistema", () => {
    const e = acender(criarEstado(), "j1", "p1", "o1");
    const r = processarSistema(e, em(31));
    if (!r.ok) throw new Error("falhou");
    expect(r.eventos[0]?.origem.usuarioId).toBe("sistema");
  });
});

describe("sigilo do tempo", () => {
  const preparado = (tempo: "exato" | "estagio" | "oculto") => {
    let e = criarEstado({ tempoParaJogadores: tempo });
    e = acender(e, "j1", "p1", "o1");
    // outra tocha no suporte escondido: só chega acesa, e como luz fixa
    e = ok(
      e,
      "m",
      intencao("ponto.criar", {
        ponto: {
          id: "esc",
          nome: "Escondido",
          x: 20,
          y: 20,
          tipo: "suporte",
          visivelParaJogadores: false,
        },
      }),
    ).estado;
    return e;
  };
  const proibidos = ["saldoMs", "acesaDesdeSala"];
  const tempoVisivel = ['"restanteMs"', '"estagio"', '"contando"'];
  const eventosDe = (
    antes: Estado,
    r: ReturnType<typeof ok>,
    usuario: { id: string; papel: Papel },
  ) =>
    r.eventos
      .map((ev) => eventoPara(ev, usuario, antes, r.estado, T0 + 10 * MIN))
      .filter((x): x is EventoSala => x !== null);

  it("com tempo oculto, nada de restanteMs, estagio, saldo ou desde para o jogador", () => {
    const e = preparado("oculto");
    const snap = JSON.stringify(visaoPara(e, J1, T0 + 10 * MIN));
    for (const campo of [...proibidos, ...tempoVisivel]) {
      expect(snap, campo).not.toContain(campo);
    }
    // eventos de uma luz mexida (ajuste do mestre) e de um novo acender
    const mexido = ok(
      e,
      "m",
      intencao("objeto.ajustar", { id: "o1", ajuste: { acao: "tempo", deltaMs: MIN } }),
      em(10),
    );
    const novo = ok(
      e,
      "j1",
      intencao("tocha.acender", { personagemId: "p1", modeloId: "modelo-tocha", novoId: "o2" }),
      em(10),
    );
    for (const r of [mexido, novo]) {
      const texto = JSON.stringify(eventosDe(e, r, J1));
      expect(texto).toContain("fonte.");
      for (const campo of [...proibidos, ...tempoVisivel, '"historico":[{']) {
        expect(texto, campo).not.toContain(campo);
      }
    }
  });
  it("com tempo por estágio, o jogador recebe só o estagio", () => {
    const e = preparado("estagio");
    const o = visaoPara(e, J1, T0 + 20 * MIN).luzes.find((l) => l.id === "o1") as ObjetoDeLuz;
    expect(o.estagio).toBe("fraca");
    expect(o.restanteMs).toBeUndefined();
    expect(o.contando).toBeUndefined();
    const snap = JSON.stringify(visaoPara(e, J1, T0 + 20 * MIN));
    for (const campo of [...proibidos, "restanteMs"]) expect(snap, campo).not.toContain(campo);
    const r = processarSistema(e, em(20), ["o1"]);
    if (!r.ok) throw new Error("falhou");
    const ev = r.eventos.map((x) => eventoPara(x, J1, e, r.estado, T0 + 20 * MIN));
    const texto = JSON.stringify(ev);
    expect(texto).toContain('"estagio":"fraca"');
    for (const campo of [...proibidos, "restanteMs"]) expect(texto, campo).not.toContain(campo);
  });
  it("com tempo exato, só restanteMs (e contando); nunca o saldo", () => {
    const e = preparado("exato");
    const o = visaoPara(e, J1, T0 + 10 * MIN).luzes.find((l) => l.id === "o1") as ObjetoDeLuz;
    expect(o.restanteMs).toBe(20 * MIN);
    expect(o.contando).toBe(true);
    expect(o.estagio).toBeUndefined();
    expect(o.historico).toEqual([]);
    expect(o.modificadores).toEqual([]);
    expect(JSON.stringify(visaoPara(e, J1, T0 + 10 * MIN))).not.toContain("saldoMs");
    // pausada: não está contando
    const p = ok(e, "m", intencao("mesa.pausar"), em(10)).estado;
    const pausado = visaoPara(p, J1, T0 + 50 * MIN).luzes.find((l) => l.id === "o1") as ObjetoDeLuz;
    expect(pausado).toMatchObject({ restanteMs: 20 * MIN, contando: false });
  });
  it("o mestre vê restanteMs, estagio e histórico, e nunca saldoMs nem acesaDesdeSala", () => {
    for (const modo of ["exato", "estagio", "oculto"] as const) {
      const e = preparado(modo);
      const vista = visaoPara(e, MESTRE, T0 + 10 * MIN);
      const o = vista.luzes.find((l) => l.id === "o1") as ObjetoDeLuz;
      expect(o).toMatchObject({ restanteMs: 20 * MIN, estagio: "forte", contando: true });
      expect(o.historico.length).toBeGreaterThan(0);
      const snap = JSON.stringify(vista);
      for (const campo of proibidos) expect(snap, campo).not.toContain(campo);
      const r = ok(
        e,
        "m",
        intencao("objeto.ajustar", { id: "o1", ajuste: { acao: "tempo", deltaMs: MIN } }),
        em(10),
      );
      const texto = JSON.stringify(eventosDe(e, r, MESTRE));
      expect(texto).toContain("restanteMs");
      for (const campo of proibidos) expect(texto, campo).not.toContain(campo);
    }
  });
  it("o ponto escondido não chega ao jogador; o objeto nele só chega aceso, como luz fixa", () => {
    let e = preparado("exato");
    e = ok(e, "m", intencao("tocha.alternar", { id: "o1" })).estado; // apaga, sem relação com o ponto
    e = ok(e, "m", intencao("tocha.entregar", { id: "o1", tokenId: "t2" })).estado;
    // tocha acesa no suporte escondido: o mestre põe pela mão de quem está perto
    e = ok(e, "m", intencao("ponto.editar", { id: "esc", mudancas: { x: 6.75, y: 6.75 } })).estado;
    e = ok(e, "m", intencao("tocha.posar", { id: "o1", pontoId: "esc" })).estado;
    expect(luz(e, "o1")?.estado).toBe("apagada");
    const apagada = visaoPara(e, J2, T0);
    expect(apagada.pontos).toHaveLength(0);
    expect(apagada.luzes.find((l) => l.id === "o1")).toBeUndefined();
    e = ok(e, "m", intencao("tocha.alternar", { id: "o1" })).estado;
    const acesa = visaoPara(e, J2, T0);
    expect(acesa.pontos).toHaveLength(0);
    const o = acesa.luzes.find((l) => l.id === "o1") as ObjetoDeLuz;
    expect(o.portador).toEqual({ tipo: "cena", x: 6.75, y: 6.75 });
    expect(JSON.stringify(acesa)).not.toContain("pontoId");
    expect(visaoPara(e, MESTRE, T0).pontos).toHaveLength(1);
  });
  it("a mochila só chega a quem vê o personagem", () => {
    let e = criarEstado();
    e = acender(e, "j1", "p1", "o1");
    e = ok(e, "j1", intencao("tocha.guardar", { id: "o1" })).estado;
    expect(visaoPara(e, J1, T0).luzes.map((l) => l.id)).toContain("o1");
    expect(visaoPara(e, J2, T0).luzes.map((l) => l.id)).not.toContain("o1");
  });
  it("a configuração e os modelos: o jogador não recebe a duração fora do modo exato", () => {
    const e = criarEstado({ tempoParaJogadores: "oculto" });
    const dele = visaoPara(e, J1, T0).modelos.find((m) => m.id === "modelo-tocha");
    expect(dele?.duracaoS).not.toBe(1800);
    expect(visaoPara(e, MESTRE, T0).modelos.find((m) => m.id === "modelo-tocha")?.duracaoS).toBe(
      1800,
    );
    expect(
      visaoPara(criarEstado(), J1, T0).modelos.find((m) => m.id === "modelo-tocha")?.duracaoS,
    ).toBe(1800);
  });
  it("o relógio do jogador não traz o tempo da sala", () => {
    const e = ok(criarEstado(), "m", intencao("mesa.pausar"), em(10)).estado;
    expect(visaoPara(e, J1, T0 + 99 * MIN).relogio).toEqual({ pausada: true, acumuladoMs: 0 });
    expect(visaoPara(e, MESTRE, T0 + 99 * MIN).relogio).toEqual({
      pausada: true,
      acumuladoMs: 10 * MIN,
    });
  });
});

describe("exportação v8", () => {
  it("importa uma v7 (fonte com acesa) como v8: estado, modelos da semente e relógio", () => {
    const base = criarEstado();
    const v8 = ok(base, "m", intencao("campanha.exportar")).exportacao;
    if (!v8) throw new Error("sem exportação");
    const { modelos: _m, pontos: _p, relogio: _r, ...dadosV7 } = v8.dados;
    const v7 = {
      ...v8,
      versao: 7,
      dados: {
        ...dadosV7,
        config: { iluminacao: base.config.iluminacao },
        luzes: [
          {
            id: "f1",
            cenaId: "c1",
            nome: "Tocha da sala",
            portador: { tipo: "cena", x: 3, y: 3 },
            luz: { claraM: 6, penumbraM: 6, cor: "#ffb347", tremula: true },
            intensidade: 1,
            acesa: true,
          },
          {
            id: "f2",
            cenaId: "c1",
            nome: "Apagada",
            portador: { tipo: "token", tokenId: "t1" },
            luz: { claraM: 3, penumbraM: 3, cor: "#ffffff", tremula: false },
            intensidade: 0.5,
            acesa: false,
          },
        ],
      },
    };
    const lida = lerExportacao(JSON.parse(JSON.stringify(v7)));
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.versao).toBe(VERSAO_EXPORTACAO);
    expect(VERSAO_EXPORTACAO).toBe(8);
    const d = lida.exportacao.dados;
    expect(d.luzes[0]).toMatchObject({
      id: "f1",
      estado: "acesa",
      saldoMs: null,
      modificadores: [],
      historico: [],
    });
    expect(d.luzes[1]).toMatchObject({ id: "f2", estado: "apagada", intensidade: 0.5 });
    expect(JSON.stringify(d.luzes)).not.toContain('"acesa":');
    expect(d.modelos.map((m) => m.nome)).toEqual(["Tocha 5e", "Lanterna", "Fogueira"]);
    expect(d.pontos).toEqual([]);
    expect(d.relogio.pausada).toBe(false);
    expect(d.config).toMatchObject({
      maosPorPersonagem: 2,
      penalidadeAoApagarS: 0,
      alcanceInteracaoM: 1.5,
      tempoParaJogadores: "exato",
    });
    // importa de verdade: o relógio começa a contar na hora da importação
    const r = processar(
      base,
      "m",
      intencao("campanha.importar", { dados: JSON.parse(JSON.stringify(v7)) }),
      em(7),
    );
    if (!r.ok) throw new Error(r.erro.mensagem);
    expect(r.estado.relogio).toEqual({ pausada: false, acumuladoMs: 0, desdeReal: T0 + 7 * MIN });
    expect(r.estado.luzes.find((l) => l.id === "f1")?.estado).toBe("acesa");
  });
  it("exportar leva saldo, histórico, pontos e modelos; volta igual (mesa pausada)", () => {
    let e = acender(criarEstado(), "j1", "p1", "o1");
    e = ok(
      e,
      "m",
      intencao("ponto.criar", {
        ponto: { id: "s1", nome: "S", x: 1.5, y: 1.5, tipo: "suporte", visivelParaJogadores: true },
      }),
    ).estado;
    const x = ok(e, "m", intencao("campanha.exportar"), em(10)).exportacao;
    if (!x) throw new Error("sem exportação");
    expect(x.versao).toBe(8);
    expect(x.dados.relogio).toEqual({ pausada: true, acumuladoMs: 10 * MIN });
    expect(x.dados.luzes.find((l) => l.id === "o1")?.saldoMs).toBe(30 * MIN);
    expect(JSON.stringify(x)).not.toContain("acendimentos");
    const r = ok(
      criarEstado(),
      "m",
      intencao("campanha.importar", { dados: JSON.parse(JSON.stringify(x)) }),
    );
    expect(r.estado.luzes.find((l) => l.id === "o1")?.acesaDesdeSala).toBe(0);
    expect(r.estado.pontos).toHaveLength(1);
    expect(r.estado.relogio.pausada).toBe(true);
  });
  it("objeto numa mão de personagem inexistente invalida a importação", () => {
    const e = acender(criarEstado(), "j1", "p1", "o1");
    const x = ok(e, "m", intencao("campanha.exportar")).exportacao;
    if (!x) throw new Error("sem exportação");
    const ruim = JSON.parse(JSON.stringify(x));
    ruim.dados.personagens = ruim.dados.personagens.filter((p: { id: string }) => p.id !== "p1");
    ruim.dados.tokens = ruim.dados.tokens.filter(
      (t: { personagemId: string }) => t.personagemId !== "p1",
    );
    expect(lerExportacao(ruim).ok).toBe(false);
  });
});
