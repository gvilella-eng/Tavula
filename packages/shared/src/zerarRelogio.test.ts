import { describe, expect, it } from "vitest";
import {
  CONFIG_PADRAO,
  criarExportacao,
  type Estado,
  estadoInicial,
  eventoPara,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  modelosPadrao,
  processar,
  processarSistema,
  RelogioSalaSchema,
  restanteDoObjeto,
  tempoDaPilula,
  tempoDaSala,
  visaoPara,
} from "./index.ts";

// V1: "zerar o relógio" da pílula do mestre. É um marco: o tempo da sala (e as tochas) não muda.
const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const MIN = 60_000;
const em = (minutos: number) => new Date(T0 + minutos * MIN).toISOString();
const MESTRE = { id: "m", papel: "mestre" as const };
const J1 = { id: "j1", papel: "jogador" as const };

function criarEstado(): Estado {
  return estadoInicial(
    {
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
      modelos: modelosPadrao().map((m) => (m.id === "modelo-tocha" ? { ...m, duracaoS: 1800 } : m)),
      config: CONFIG_PADRAO,
      personagens: [
        {
          id: "p1",
          pastaId: "pasta-personagens",
          editores: { tipo: "jogadores" as const, ids: ["j1"] },
          nome: "Aldric",
          tokenPadrao: { cor: "#0f0", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 0 },
          ficha: {
            pvAtual: 10,
            pvMax: 10,
            itens: [{ nome: "Tocha", quantidade: 3, modeloId: "modelo-tocha" }],
          },
        },
      ],
      tokens: [
        {
          id: "t1",
          cenaId: "c1",
          nome: "t1",
          cor: "#0f0",
          tamanhoQuadrados: 1,
          x: 5.25,
          y: 5.25,
          camada: "tokens" as const,
          oculto: false,
          controladoPor: [],
          personagemId: "p1",
        },
      ],
    },
    T0,
  );
}

let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `z${++contador}`, tipo, dados });
function ok(estado: Estado, quem: string, i: Intencao, agora: string) {
  const r = processar(estado, quem, i, agora);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo}`);
  return r;
}

describe("zerar o relógio da pílula (V1)", () => {
  it("a conta da pílula: tempo da sala menos o marco, sem passar de zero", () => {
    expect(tempoDaPilula({ pausada: true, acumuladoMs: 5 * MIN }, T0)).toBe(5 * MIN);
    expect(tempoDaPilula({ pausada: true, acumuladoMs: 5 * MIN, marcoMs: 2 * MIN }, T0)).toBe(
      3 * MIN,
    );
    const rodando = { pausada: false, acumuladoMs: 5 * MIN, desdeReal: T0, marcoMs: 5 * MIN };
    expect(tempoDaPilula(rodando, T0)).toBe(0);
    expect(tempoDaPilula(rodando, T0 + 90_000)).toBe(90_000);
    expect(tempoDaPilula({ ...rodando, marcoMs: 99 * MIN }, T0)).toBe(0);
  });

  it("estado antigo, sem marco, vale marco 0 (migração trivial)", () => {
    const velho = RelogioSalaSchema.parse(JSON.parse('{"pausada":false,"acumuladoMs":1000}'));
    expect(velho.marcoMs).toBeUndefined();
    expect(tempoDaPilula(velho, T0)).toBe(1000);
    // O que a sala gravou depois (com marco) também lê.
    expect(RelogioSalaSchema.parse({ pausada: true, acumuladoMs: 9, marcoMs: 4 }).marcoMs).toBe(4);
  });

  it("zera rodando: o relógio segue contando e o tempo da sala não muda", () => {
    const e = criarEstado();
    const antes = tempoDaSala(e.relogio, Date.parse(em(10)));
    const r = ok(e, "m", intencao("mesa.zerarRelogio"), em(10));
    expect(r.eventos.map((v) => v.tipo)).toEqual(["mesa.relogioZerado"]);
    expect(r.snapshotPara).toEqual([]);
    expect(r.estado.relogio.pausada).toBe(false);
    expect(r.estado.relogio.marcoMs).toBe(10 * MIN);
    expect(tempoDaSala(r.estado.relogio, Date.parse(em(10)))).toBe(antes);
    expect(tempoDaSala(r.estado.relogio, Date.parse(em(25)))).toBe(25 * MIN);
    expect(tempoDaPilula(r.estado.relogio, Date.parse(em(10)))).toBe(0);
    expect(tempoDaPilula(r.estado.relogio, Date.parse(em(12)))).toBe(2 * MIN);
  });

  it("zera pausada: continua pausada, em 00:00, e ao retomar volta a contar do zero", () => {
    let e = ok(criarEstado(), "m", intencao("mesa.pausar"), em(7)).estado;
    e = ok(e, "m", intencao("mesa.zerarRelogio"), em(30)).estado;
    expect(e.relogio.pausada).toBe(true);
    expect(tempoDaSala(e.relogio, Date.parse(em(99)))).toBe(7 * MIN);
    expect(tempoDaPilula(e.relogio, Date.parse(em(99)))).toBe(0);
    e = ok(e, "m", intencao("mesa.retomar"), em(40)).estado;
    expect(e.relogio.marcoMs).toBe(7 * MIN);
    expect(tempoDaPilula(e.relogio, Date.parse(em(43)))).toBe(3 * MIN);
    // Pausar de novo também guarda o marco.
    const p = ok(e, "m", intencao("mesa.pausar"), em(44)).estado;
    expect(p.relogio.marcoMs).toBe(7 * MIN);
    expect(tempoDaPilula(p.relogio, Date.parse(em(99)))).toBe(4 * MIN);
  });

  it("só o mestre zera (capacidade mesa.configurar)", () => {
    const r = processar(criarEstado(), "j1", intencao("mesa.zerarRelogio"), em(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("sem_permissao");
  });

  it("as tochas ficam com o mesmo restante antes e depois de zerar, e acabam na mesma hora", () => {
    const acesa = ok(
      criarEstado(),
      "j1",
      intencao("tocha.acender", { personagemId: "p1", modeloId: "modelo-tocha", novoId: "o1" }),
      em(0),
    ).estado;
    const zerado = ok(acesa, "m", intencao("mesa.zerarRelogio"), em(10)).estado;
    for (const min of [10, 15, 29]) {
      const sala = (x: Estado) => tempoDaSala(x.relogio, Date.parse(em(min)));
      const l = (x: Estado) => x.luzes.find((v) => v.id === "o1");
      expect(sala(zerado)).toBe(sala(acesa));
      expect(restanteDoObjeto(l(zerado) as never, sala(zerado))).toBe(
        restanteDoObjeto(l(acesa) as never, sala(acesa)),
      );
    }
    const aos29 = processarSistema(zerado, em(29.9));
    const aos30 = processarSistema(zerado, em(30));
    if (!aos29.ok || !aos30.ok) throw new Error("falhou");
    expect(aos29.estado.luzes.find((v) => v.id === "o1")).toBeDefined();
    expect(aos30.estado.luzes.find((v) => v.id === "o1")).toBeUndefined();
  });

  it("o jogador não recebe o marco: nem no evento nem no snapshot", () => {
    const e = criarEstado();
    const r = ok(e, "m", intencao("mesa.zerarRelogio"), em(10));
    const ev = r.eventos[0];
    if (!ev) throw new Error("sem evento");
    expect(eventoPara(ev, J1, e, r.estado, Date.parse(em(10)))).toBeNull();
    expect(eventoPara(ev, MESTRE, e, r.estado, Date.parse(em(10)))).toEqual(ev);
    const jogador = visaoPara(r.estado, J1, Date.parse(em(11)));
    expect(jogador.relogio).toEqual({ pausada: false, acumuladoMs: 0 });
    expect(JSON.stringify(jogador)).not.toContain("marcoMs");
    const mestre = visaoPara(r.estado, MESTRE, Date.parse(em(11)));
    expect(mestre.relogio).toEqual({ pausada: false, acumuladoMs: 11 * MIN, marcoMs: 10 * MIN });
  });

  it("exportar leva o marco; importar a versão antiga (sem marco) vale marco 0", () => {
    const zerado = ok(criarEstado(), "m", intencao("mesa.zerarRelogio"), em(10)).estado;
    const x = criarExportacao(zerado, em(12));
    expect(x.dados.relogio).toEqual({ pausada: true, acumuladoMs: 12 * MIN, marcoMs: 10 * MIN });
    const lida = lerExportacao(JSON.parse(JSON.stringify(x)));
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.dados.relogio.marcoMs).toBe(10 * MIN);

    const semMarco = JSON.parse(JSON.stringify(criarExportacao(criarEstado(), em(12))));
    expect(semMarco.dados.relogio.marcoMs).toBeUndefined();
    const antiga = lerExportacao(semMarco);
    if (!antiga.ok) throw new Error(antiga.motivo);
    expect(antiga.exportacao.dados.relogio.marcoMs).toBeUndefined();
    expect(tempoDaPilula(antiga.exportacao.dados.relogio, T0)).toBe(12 * MIN);
  });
});
