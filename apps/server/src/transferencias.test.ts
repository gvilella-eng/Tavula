import type { CandidatoAProvedor, FrameDePedaco } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { TEMPO_PARADO_MS, Transferencias } from "./transferencias";

const HASH = "a".repeat(64);

type Caso = ReturnType<typeof criar>;

function criar() {
  const posse = new Map<string, CandidatoAProvedor[]>();
  const pedidos: { para: string; indices: number[] }[] = [];
  const repassados: { para: string; indice: number }[] = [];
  const indisponiveis: string[] = [];
  let agora = 0;
  const t = new Transferencias({
    candidatos: (hash) => posse.get(hash) ?? [],
    pedirEnvio: (para, _hash, indices) => pedidos.push({ para, indices }),
    repassar: (para, frame) => repassados.push({ para, indice: new DataView(frame).getUint32(33) }),
    avisarIndisponivel: (para) => indisponiveis.push(para),
    agora: () => agora,
  });
  return {
    t,
    posse,
    pedidos,
    repassados,
    indisponiveis,
    avancar: (ms: number) => {
      agora += ms;
    },
  };
}

const cand = (conexaoId: string, usuarioId: string, papel: "mestre" | "jogador" = "jogador") => ({
  conexaoId,
  usuarioId,
  papel,
});

function frame(indice: number, total = 3, hash = HASH): [FrameDePedaco, ArrayBuffer] {
  const b = new ArrayBuffer(41 + 4);
  new DataView(b).setUint32(33, indice);
  return [{ hash, indice, total, dados: new Uint8Array(4) }, b];
}

const mandar = (c: Caso, de: string, indice: number, total = 3) =>
  c.t.frame(de, ...frame(indice, total));

describe("Transferencias", () => {
  it("o provedor envia uma vez e a sala repassa a todos que esperam", () => {
    const c = criar();
    c.posse.set(HASH, [cand("p", "dono")]);
    c.t.pedir("r1", HASH, 3, "dono", [0, 1, 2]);
    c.t.pedir("r2", HASH, 3, "dono", [0, 1, 2]);
    c.t.pedir("r3", HASH, 3, "dono", [1]);
    expect(c.pedidos).toEqual([{ para: "p", indices: [0, 1, 2] }]); // um pedido só
    for (const i of [0, 1, 2]) expect(mandar(c, "p", i)).toBe(true);
    expect(c.repassados.filter((r) => r.para === "r1").map((r) => r.indice)).toEqual([0, 1, 2]);
    expect(c.repassados.filter((r) => r.para === "r2")).toHaveLength(3);
    expect(c.repassados.filter((r) => r.para === "r3").map((r) => r.indice)).toEqual([1]);
    expect(c.t.ativas).toBe(0);
  });

  it("descarta em silêncio frame de quem não foi pedido, índice não pedido, total errado ou hash desconhecido", () => {
    const c = criar();
    c.posse.set(HASH, [cand("p", "dono")]);
    c.t.pedir("r1", HASH, 3, "dono", [0, 1]);
    expect(mandar(c, "intruso", 0)).toBe(false);
    expect(mandar(c, "r1", 0)).toBe(false);
    expect(mandar(c, "p", 2)).toBe(false); // ninguém pediu o 2
    expect(mandar(c, "p", 0, 9)).toBe(false); // total não bate
    expect(c.t.frame("p", ...frame(0, 3, "b".repeat(64)))).toBe(false);
    expect(c.repassados).toEqual([]);
    expect(mandar(c, "p", 0)).toBe(true);
    expect(mandar(c, "p", 0)).toBe(false); // já veio
    expect(c.repassados).toHaveLength(1);
  });

  it("escolhe o dono, depois o mestre, depois qualquer um; quem espera não serve a si mesmo", () => {
    const c = criar();
    c.posse.set(HASH, [cand("x", "j9"), cand("m", "mestre", "mestre"), cand("d", "dono")]);
    c.t.pedir("r1", HASH, 2, "dono", [0, 1]);
    expect(c.pedidos[0]?.para).toBe("d");

    const c2 = criar();
    c2.posse.set(HASH, [cand("x", "j9"), cand("m", "mestre", "mestre")]);
    c2.t.pedir("r1", HASH, 2, "dono", [0]);
    expect(c2.pedidos[0]?.para).toBe("m");

    const c3 = criar();
    c3.posse.set(HASH, [cand("r1", "j1"), cand("x", "j9")]);
    c3.t.pedir("r1", HASH, 2, "dono", [0]); // r1 tem cópia, mas quer um pedaço: outro serve
    expect(c3.pedidos[0]?.para).toBe("x");
  });

  it("quem chega no meio espera o que já está a caminho e pede de novo o que já passou", () => {
    const c = criar();
    c.posse.set(HASH, [cand("p", "dono")]);
    c.t.pedir("r1", HASH, 3, "dono", [0, 1, 2]);
    mandar(c, "p", 0);
    c.t.pedir("r2", HASH, 3, "dono", [0, 1]);
    // o 1 já está pedido (só espera); o 0 já passou: pedido de novo
    expect(c.pedidos).toEqual([
      { para: "p", indices: [0, 1, 2] },
      { para: "p", indices: [0] },
    ]);
    mandar(c, "p", 0);
    mandar(c, "p", 1);
    mandar(c, "p", 2);
    expect(c.repassados.filter((r) => r.para === "r1").map((r) => r.indice)).toEqual([0, 1, 2]);
    expect(c.repassados.filter((r) => r.para === "r2").map((r) => r.indice)).toEqual([0, 1]);
  });

  it("provedor que diz 'não tenho' ou cai: a sala pede o que falta a outro", () => {
    const c = criar();
    c.posse.set(HASH, [cand("p1", "dono"), cand("p2", "j2")]);
    c.t.pedir("r1", HASH, 3, "dono", [0, 1, 2]);
    mandar(c, "p1", 0);
    c.posse.set(HASH, [cand("p2", "j2")]); // a sala tira a posse de quem disse "não tenho"
    c.t.naoTem("p1", HASH);
    expect(c.pedidos.at(-1)).toEqual({ para: "p2", indices: [1, 2] }); // só o que faltava

    c.posse.set(HASH, [cand("p3", "j3")]);
    c.t.conexaoSaiu("p2"); // o segundo cai no meio
    expect(c.pedidos.at(-1)).toEqual({ para: "p3", indices: [1, 2] });
    mandar(c, "p3", 1);
    mandar(c, "p3", 2);
    expect(c.repassados.filter((r) => r.para === "r1").map((r) => r.indice)).toEqual([0, 1, 2]);
    expect(c.t.ativas).toBe(0);
  });

  it("ninguém tem: avisa 'indisponível' uma vez e retoma quando alguém com cópia conectar", () => {
    const c = criar();
    c.t.pedir("r1", HASH, 2, "dono", [0, 1]);
    c.t.pedir("r2", HASH, 2, "dono", [0, 1]);
    expect(c.indisponiveis).toEqual(["r1", "r2"]);
    expect(c.pedidos).toEqual([]);
    c.posse.set(HASH, [cand("p", "dono")]);
    c.t.posseMudou(HASH);
    expect(c.pedidos).toEqual([{ para: "p", indices: [0, 1] }]);
    mandar(c, "p", 0, 2);
    mandar(c, "p", 1, 2);
    expect(c.repassados).toHaveLength(4);
  });

  it("quem espera e fecha sai da lista; sem ninguém esperando a transferência acaba", () => {
    const c = criar();
    c.posse.set(HASH, [cand("p", "dono")]);
    c.t.pedir("r1", HASH, 2, "dono", [0, 1]);
    c.t.conexaoSaiu("r1");
    expect(c.t.ativas).toBe(0);
    expect(mandar(c, "p", 0, 2)).toBe(false);
  });

  it("ignora índices fora do total", () => {
    const c = criar();
    c.posse.set(HASH, [cand("p", "dono")]);
    c.t.pedir("r1", HASH, 2, "dono", [5, -1, 1.5]);
    expect(c.pedidos).toEqual([]);
    expect(c.t.ativas).toBe(0);
  });

  it("provedor parado: um novo pedido refaz o envio", () => {
    const c = criar();
    c.posse.set(HASH, [cand("p", "dono")]);
    c.t.pedir("r1", HASH, 3, "dono", [0, 1, 2]);
    c.avancar(TEMPO_PARADO_MS + 1);
    c.t.pedir("r1", HASH, 3, "dono", [0, 1, 2]);
    expect(c.pedidos).toHaveLength(2);
    expect(c.pedidos[1]).toEqual({ para: "p", indices: [0, 1, 2] });
  });
});
