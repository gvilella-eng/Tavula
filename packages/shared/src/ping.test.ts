import { describe, expect, it } from "vitest";
import {
  CENA_PADRAO,
  type Estado,
  estadoInicial,
  INTERVALO_MINIMO_DA_CENTRALIZACAO_MS,
  INTERVALO_MINIMO_DO_PING_MS,
  type Intencao,
  IntencaoSchema,
  lerMensagemDaSala,
  limitarPing,
  mensagem,
  PERMISSOES_PADRAO,
  pingVisivelPara,
  processar,
  ROTULO_DA_CAPACIDADE,
} from "./index.ts";

// V12: o ping no mapa é efêmero. A sala valida (cena, quem vê, ponto), limita a frequência e repassa.

const AGORA = "2026-01-01T00:00:00.000Z";

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#aa1111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#22aa22" },
    ],
    cenas: [
      { ...CENA_PADRAO, id: "c1", nome: "C1", larguraM: 30, alturaM: 20 },
      { ...CENA_PADRAO, id: "c2", nome: "C2", larguraM: 30, alturaM: 20 },
    ],
    cenaAtivaId: "c1",
  });
}

let n = 0;
const ping = (dados: object): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `p${++n}`, tipo: "mapa.ping", dados });
const resultado = (e: Estado, quem: string, d: object) => processar(e, quem, ping(d), AGORA);
const codigo = (e: Estado, quem: string, d: object) => {
  const r = resultado(e, quem, d);
  return r.ok ? null : r.erro.codigo;
};

describe("mapa.ping (validação)", () => {
  it("o jogador e o mestre pingam; o ping sai com a cor e o autor da sala", () => {
    const e = criarEstado();
    const j = resultado(e, "j1", { cenaId: "c1", x: 5, y: 6, centralizar: true });
    expect(j.ok && j.ping).toEqual({
      cenaId: "c1",
      x: 5,
      y: 6,
      centralizar: true,
      usuarioId: "j1",
      cor: "#22aa22",
    });
    const m = resultado(e, "m", { cenaId: "c1", x: 1, y: 1 });
    expect(m.ok && m.ping).toMatchObject({ usuarioId: "m", cor: "#aa1111", centralizar: false });
  });

  it("nada é gravado: estado igual, nenhum evento", () => {
    const e = criarEstado();
    const r = resultado(e, "j1", { cenaId: "c1", x: 5, y: 6 });
    expect(r.ok && r.estado).toBe(e);
    expect(r.ok && r.eventos).toEqual([]);
    expect(r.ok && r.snapshotPara).toEqual([]);
  });

  it("cena que não existe", () => {
    expect(codigo(criarEstado(), "m", { cenaId: "xx", x: 1, y: 1 })).toBe("cena_inexistente");
  });

  it("o jogador só pinga na cena do grupo; o mestre, em qualquer uma", () => {
    const e = criarEstado();
    expect(codigo(e, "j1", { cenaId: "c2", x: 1, y: 1 })).toBe("sem_permissao");
    expect(codigo(e, "m", { cenaId: "c2", x: 1, y: 1 })).toBeNull();
  });

  it("o ponto tem de estar dentro da cena", () => {
    const e = criarEstado();
    for (const [x, y] of [
      [-0.1, 1],
      [1, -1],
      [30.1, 1],
      [1, 20.1],
    ]) {
      expect(codigo(e, "j1", { cenaId: "c1", x, y })).toBe("dados_invalidos");
    }
    expect(codigo(e, "j1", { cenaId: "c1", x: 30, y: 20 })).toBeNull();
    expect(
      IntencaoSchema.safeParse({
        v: 1,
        id: "a",
        tipo: "mapa.ping",
        dados: { cenaId: "c1", x: Number.NaN, y: 1 },
      }).success,
    ).toBe(false);
  });

  it("capacidade desligada: o jogador é recusado; o mestre pode sempre", () => {
    const e = criarEstado();
    const sem: Estado = {
      ...e,
      permissoes: {
        ...e.permissoes,
        jogadores: { ...e.permissoes.jogadores, "mapa.pingar": false },
      },
    };
    expect(codigo(sem, "j1", { cenaId: "c1", x: 1, y: 1 })).toBe("sem_permissao");
    expect(codigo(sem, "m", { cenaId: "c1", x: 1, y: 1 })).toBeNull();
    const so: Estado = {
      ...e,
      permissoes: { ...e.permissoes, porUsuario: { j1: { "mapa.pingar": false } } },
    };
    expect(codigo(so, "j1", { cenaId: "c1", x: 1, y: 1 })).toBe("sem_permissao");
  });

  it("a capacidade vem ligada por padrão e tem rótulo", () => {
    expect(PERMISSOES_PADRAO["mapa.pingar"]).toBe(true);
    expect(ROTULO_DA_CAPACIDADE["mapa.pingar"]).toBe("Pingar o mapa e centralizar a tela de todos");
  });
});

describe("quem recebe o ping", () => {
  it("o mestre sempre; o jogador só da cena do grupo", () => {
    expect(pingVisivelPara("c2", { papel: "mestre" }, "c1")).toBe(true);
    expect(pingVisivelPara("c1", { papel: "jogador" }, "c1")).toBe(true);
    expect(pingVisivelPara("c2", { papel: "jogador" }, "c1")).toBe(false);
    expect(pingVisivelPara("c1", { papel: "assistente" }, "c1")).toBe(false);
  });

  it("a mensagem da sala é válida e leva a cor", () => {
    const texto = mensagem({
      tipo: "mapa.pingado",
      dados: { cenaId: "c1", x: 1, y: 2, centralizar: false, usuarioId: "j1", cor: "#22aa22" },
    });
    expect(lerMensagemDaSala(texto).ok).toBe(true);
  });
});

describe("limite de frequência", () => {
  it("o primeiro vale; o seguinte antes de 0,5 s é ignorado", () => {
    const a = limitarPing(undefined, 1000, false);
    expect(a?.centralizar).toBe(false);
    expect(limitarPing(a?.proximo, 1000 + INTERVALO_MINIMO_DO_PING_MS - 1, false)).toBeNull();
    expect(limitarPing(a?.proximo, 1000 + INTERVALO_MINIMO_DO_PING_MS, false)).not.toBeNull();
  });

  it("a centralização vale 1 vez a cada 3 s; o resto sai como ping simples", () => {
    const a = limitarPing(undefined, 1000, true);
    expect(a?.centralizar).toBe(true);
    const b = limitarPing(a?.proximo, 1600, true);
    expect(b?.centralizar).toBe(false);
    // a recusa da centralização não renova o relógio dela
    const c = limitarPing(b?.proximo, 1000 + INTERVALO_MINIMO_DA_CENTRALIZACAO_MS, true);
    expect(c?.centralizar).toBe(true);
  });

  it("quem não pediu centralizar não gasta o limite dela", () => {
    const a = limitarPing(undefined, 1000, false);
    expect(limitarPing(a?.proximo, 1600, true)?.centralizar).toBe(true);
  });
});
