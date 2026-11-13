import { describe, expect, it } from "vitest";
import {
  CenaSchema,
  cenaEhCartao,
  criarExportacao,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  processar,
  visaoLimitadaNaCena,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const J1 = { id: "j1", papel: "jogador" as const };
const MESTRE = { id: "m", papel: "mestre" as const };

function criarEstado(): Estado {
  const token = (id: string, x: number, extra: object = {}) => ({
    id,
    cenaId: "c1",
    nome: id,
    cor: "#0f0",
    tamanhoQuadrados: 1,
    x,
    y: 5.25,
    camada: "tokens" as const,
    oculto: false,
    controladoPor: ["j1"],
    ...extra,
  });
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
    ],
    cenas: [
      {
        id: "c1",
        nome: "Cidade",
        larguraM: 30,
        alturaM: 30,
        grid: { quadradoM: 1.5, visivel: true },
      },
    ],
    cenaAtivaId: "c1",
    tokens: [
      token("t1", 5.25),
      token("longe", 25.25, { controladoPor: [] }),
      token("escondido", 15.25, { controladoPor: [], oculto: true }),
    ],
    paredes: [
      { id: "w1", cenaId: "c1", a: { x: 8, y: 0 }, b: { x: 8, y: 20 }, tipo: "parede" },
      { id: "w2", cenaId: "c1", a: { x: 12, y: 0 }, b: { x: 12, y: 20 }, tipo: "secreta" },
    ],
  });
}

let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `cartao-${++contador}`, tipo, dados });
function aplicar(e: Estado, quem: string, i: Intencao) {
  const r = processar(e, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo}`);
  return r;
}
const comCartao = (e: Estado) =>
  aplicar(e, "m", intencao("cena.editar", { cenaId: "c1", cartao: true })).estado;

describe("V10c: o campo cartao da cena", () => {
  it("cena antiga carrega sem o campo e é mapa", () => {
    const cena = CenaSchema.parse({
      id: "c1",
      nome: "Sala",
      larguraM: 30,
      alturaM: 30,
      grid: { quadradoM: 1.5, visivel: true },
    });
    expect(cena.cartao).toBeUndefined();
    expect(cenaEhCartao(cena)).toBe(false);
    expect(visaoLimitadaNaCena(cena)).toBe(true);
  });

  it("o mestre liga e desliga; ao desligar o campo some e nada mais muda", () => {
    const antes = criarEstado();
    let e = comCartao(antes);
    expect(e.cenas[0]?.cartao).toBe(true);
    // paredes e tokens guardados continuam no estado
    expect(e.paredes).toHaveLength(2);
    expect(e.tokens).toHaveLength(3);
    e = aplicar(e, "m", intencao("cena.editar", { cenaId: "c1", cartao: false })).estado;
    expect(e.cenas[0]).not.toHaveProperty("cartao");
    expect(e.cenas[0]).toEqual(antes.cenas[0]);
  });

  it("editar o nome de um cartão não o desfaz; a iluminação guardada não o desfaz", () => {
    let e = comCartao(criarEstado());
    e = aplicar(e, "m", intencao("cena.editar", { cenaId: "c1", nome: "Praça" })).estado;
    expect(e.cenas[0]?.cartao).toBe(true);
    e = aplicar(
      e,
      "m",
      intencao("cena.configurarIluminacao", { cenaId: "c1", dinamica: true }),
    ).estado;
    expect(e.cenas[0]?.cartao).toBe(true);
    const cena = e.cenas[0];
    expect(cena && visaoLimitadaNaCena(cena)).toBe(false);
  });

  it("só quem tem cena.editar muda o campo", () => {
    const e = criarEstado();
    const r = processar(e, "j1", intencao("cena.editar", { cenaId: "c1", cartao: true }), AGORA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("sem_permissao");
    // `cena.editar` não é delegável: nem com a permissão tentada o jogador passa
    const tenta = processar(
      e,
      "m",
      intencao("permissao.alterar", { usuarioId: "j1", capacidade: "cena.editar", valor: true }),
      AGORA,
    );
    expect(tenta.ok).toBe(false);
  });

  it("duplicar a cena leva o cartão", () => {
    const e = aplicar(
      comCartao(criarEstado()),
      "m",
      intencao("cena.duplicar", { cenaId: "c1", novoId: "c2" }),
    ).estado;
    expect(e.cenas.find((c) => c.id === "c2")?.cartao).toBe(true);
  });

  it("exportar e importar levam o campo; arquivo antigo (sem ele) carrega", () => {
    const e = comCartao(criarEstado());
    const arquivo = JSON.parse(JSON.stringify(criarExportacao(e, AGORA)));
    const lido = lerExportacao(arquivo);
    expect(lido.ok).toBe(true);
    if (lido.ok) expect(lido.exportacao.dados.cenas[0]?.cartao).toBe(true);
    const velho = JSON.parse(JSON.stringify(arquivo));
    delete velho.dados.cenas[0].cartao;
    const lidoVelho = lerExportacao(velho);
    expect(lidoVelho.ok).toBe(true);
    if (lidoVelho.ok) expect(lidoVelho.exportacao.dados.cenas[0]?.cartao).toBeUndefined();
  });
});

describe("V10c: o que a sala manda ao jogador numa cena-cartão", () => {
  it("a sala não filtra tokens por visão: vêm todos os visíveis, em mapa ou cartão", () => {
    const mapa = visaoPara(criarEstado(), J1);
    const cartao = visaoPara(comCartao(criarEstado()), J1);
    const ids = (e: Estado) => e.tokens.map((t) => t.id).sort();
    expect(ids(mapa)).toEqual(["longe", "t1"]);
    expect(ids(cartao)).toEqual(ids(mapa));
    expect(cartao.cenas[0]?.cartao).toBe(true);
  });

  it("os segredos continuam secretos: token oculto e parede secreta", () => {
    const visto = visaoPara(comCartao(criarEstado()), J1);
    expect(visto.tokens.some((t) => t.id === "escondido")).toBe(false);
    expect(JSON.stringify(visto)).not.toContain("secreta");
    // o mestre continua vendo tudo, inclusive as paredes guardadas
    const doMestre = visaoPara(comCartao(criarEstado()), MESTRE);
    expect(doMestre.tokens).toHaveLength(3);
    expect(doMestre.paredes).toHaveLength(2);
  });

  it("as paredes guardadas não chegam ao jogador e voltam quando a cena volta a ser mapa", () => {
    expect(visaoPara(criarEstado(), J1).paredes).toHaveLength(2);
    const e = comCartao(criarEstado());
    expect(visaoPara(e, J1).paredes).toEqual([]);
    const volta = aplicar(e, "m", intencao("cena.editar", { cenaId: "c1", cartao: false })).estado;
    expect(visaoPara(volta, J1).paredes).toHaveLength(2);
  });

  it("virar cartão e voltar a mapa manda snapshot novo a todos; editar só o nome, não", () => {
    const liga = aplicar(
      criarEstado(),
      "m",
      intencao("cena.editar", { cenaId: "c1", cartao: true }),
    );
    expect(liga.snapshotPara).toBe("todos");
    const nome = aplicar(liga.estado, "m", intencao("cena.editar", { cenaId: "c1", nome: "X" }));
    expect(nome.snapshotPara).toEqual([]);
    const desliga = aplicar(
      liga.estado,
      "m",
      intencao("cena.editar", { cenaId: "c1", cartao: false }),
    );
    expect(desliga.snapshotPara).toBe("todos");
  });

  it("eventos de parede não chegam ao jogador numa cena-cartão, mas chegam ao mestre", () => {
    const e = comCartao(criarEstado());
    const cria = aplicar(
      e,
      "m",
      intencao("parede.criar", {
        paredes: [{ id: "w3", a: { x: 1, y: 1 }, b: { x: 4, y: 1 }, tipo: "parede" }],
      }),
    );
    const ev = cria.eventos[0] as EventoSala;
    expect(eventoPara(ev, J1, e, cria.estado)).toBeNull();
    expect(eventoPara(ev, MESTRE, e, cria.estado)).not.toBeNull();
    const apaga = aplicar(cria.estado, "m", intencao("parede.apagar", { id: "w1" }));
    const evApaga = apaga.eventos[0] as EventoSala;
    expect(eventoPara(evApaga, J1, cria.estado, apaga.estado)).toBeNull();
    expect(eventoPara(evApaga, MESTRE, cria.estado, apaga.estado)).not.toBeNull();
  });

  it("numa cena-cartão a parede não barra o token do jogador; no mapa barra", () => {
    const soltar = (e: Estado) =>
      processar(e, "j1", intencao("token.soltar", { id: "t1", x: 10, y: 5.25 }), AGORA);
    const mapa = soltar(criarEstado());
    expect(mapa.ok).toBe(false);
    if (!mapa.ok) expect(mapa.erro.codigo).toBe("trajeto_bloqueado");
    expect(soltar(comCartao(criarEstado())).ok).toBe(true);
  });
});
