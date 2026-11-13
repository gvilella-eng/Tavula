import { describe, expect, it } from "vitest";
import {
  CENA_PADRAO,
  criarExportacao,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  processar,
  reduzir,
  type Token,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const mestre = { id: "m", papel: "mestre" as const };
const j1 = { id: "j1", papel: "jogador" as const };
const j2 = { id: "j2", papel: "jogador" as const };

function token(id: string, extra: Partial<Token> = {}): Token {
  return {
    id,
    cenaId: "cena-1",
    nome: `Nome ${id}`,
    cor: "#abc",
    tamanhoQuadrados: 1,
    x: 10.5,
    y: 10.5,
    camada: "tokens",
    oculto: false,
    controladoPor: [],
    ...extra,
  };
}

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
    ],
    tokens: [
      token("visivel", { controladoPor: ["j1"] }),
      token("oculto", { oculto: true }),
      token("do-mestre", { camada: "mestre" }),
    ],
  });
}

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });
}

function aplicar(estado: Estado, quem: string, i: Intencao) {
  const r = processar(estado, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo}`);
  return r;
}
function codigo(estado: Estado, quem: string, i: Intencao): string | null {
  const r = processar(estado, quem, i, AGORA);
  return r.ok ? null : r.erro.codigo;
}

/** O que `quem` recebe depois de `i`, do jeito que a sala distribui. */
function recebido(antes: Estado, quem: { id: string; papel: "mestre" | "jogador" }, i: Intencao) {
  const r = aplicar(antes, "m", i);
  return r.eventos
    .map((e) => eventoPara(e, quem, antes, r.estado))
    .filter((e): e is EventoSala => e !== null);
}

describe("estado inicial", () => {
  it("a semente sem cena ganha a cena padrão", () => {
    const e = estadoInicial({ usuarios: [{ id: "m", nome: "M", papel: "mestre", cor: "#1" }] });
    expect(e.cenas).toEqual([CENA_PADRAO]);
    expect(e.cenaAtivaId).toBe("cena-1");
    expect(e.tokens).toEqual([]);
    expect(CENA_PADRAO.grid.quadradoM).toBe(1.5);
  });
});

describe("intenções de token e cena (só do mestre)", () => {
  it("jogador não cria, edita, apaga nem configura o grid", () => {
    const e = criarEstado();
    const novo = {
      id: "n",
      nome: "N",
      cor: "#fff",
      tamanhoQuadrados: 1,
      x: 1,
      y: 1,
      camada: "tokens",
      oculto: false,
      controladoPor: [],
    };
    expect(codigo(e, "j1", intencao("token.criar", { token: novo }))).toBe("sem_permissao");
    expect(
      codigo(e, "j1", intencao("token.editar", { id: "visivel", mudancas: { nome: "x" } })),
    ).toBe("sem_permissao");
    // V10: o jogador apaga o token que controla; o dos outros e o cenário, não.
    expect(codigo(e, "j2", intencao("token.apagar", { id: "visivel" }))).toBe("sem_permissao");
    expect(codigo(e, "j1", intencao("cena.configurarGrid", { visivel: false }))).toBe(
      "sem_permissao",
    );
  });

  it("criar, editar e apagar mudam o estado", () => {
    let e = criarEstado();
    const novo = {
      id: "n",
      nome: "Novo",
      cor: "#fff",
      tamanhoQuadrados: 2,
      x: 5,
      y: 5,
      camada: "tokens",
      oculto: false,
      controladoPor: ["j2"],
    };
    e = aplicar(e, "m", intencao("token.criar", { token: novo })).estado;
    expect(e.tokens.find((t) => t.id === "n")).toMatchObject({
      cenaId: "cena-1",
      controladoPor: ["j2"],
    });
    e = aplicar(
      e,
      "m",
      intencao("token.editar", { id: "n", mudancas: { nome: "Outro", oculto: true } }),
    ).estado;
    expect(e.tokens.find((t) => t.id === "n")).toMatchObject({ nome: "Outro", oculto: true });
    e = aplicar(e, "m", intencao("token.apagar", { id: "n" })).estado;
    expect(e.tokens.some((t) => t.id === "n")).toBe(false);
  });

  it("recusa id repetido, usuário de controle inexistente e token inexistente", () => {
    const e = criarEstado();
    const base = {
      nome: "N",
      cor: "#fff",
      tamanhoQuadrados: 1,
      x: 1,
      y: 1,
      camada: "tokens",
      oculto: false,
    };
    expect(
      codigo(
        e,
        "m",
        intencao("token.criar", { token: { ...base, id: "visivel", controladoPor: [] } }),
      ),
    ).toBe("dados_invalidos");
    expect(
      codigo(
        e,
        "m",
        intencao("token.criar", { token: { ...base, id: "z", controladoPor: ["fantasma"] } }),
      ),
    ).toBe("usuario_inexistente");
    expect(codigo(e, "m", intencao("token.editar", { id: "nada", mudancas: {} }))).toBe(
      "token_inexistente",
    );
    expect(codigo(e, "m", intencao("token.apagar", { id: "nada" }))).toBe("token_inexistente");
  });

  it("tamanho fora de 1..4 é recusado pelo schema", () => {
    const base = {
      id: "z",
      nome: "N",
      cor: "#fff",
      x: 1,
      y: 1,
      camada: "tokens",
      oculto: false,
      controladoPor: [],
    };
    for (const tamanhoQuadrados of [0, 5, 1.5]) {
      expect(
        IntencaoSchema.safeParse({
          v: 1,
          id: "p",
          tipo: "token.criar",
          dados: { token: { ...base, tamanhoQuadrados } },
        }).success,
      ).toBe(false);
    }
  });

  it("cena.configurarGrid muda o grid da cena ativa", () => {
    const e = aplicar(
      criarEstado(),
      "m",
      intencao("cena.configurarGrid", { quadradoM: 3, visivel: false }),
    ).estado;
    expect(e.cenas[0]?.grid).toEqual({ quadradoM: 3, visivel: false });
  });

  it("posição fora da cena é limitada à borda (criar, mover e soltar)", () => {
    const e = criarEstado();
    const r = aplicar(e, "m", intencao("token.soltar", { id: "visivel", x: -50, y: 500 }));
    expect(r.estado.tokens.find((t) => t.id === "visivel")).toMatchObject({ x: 0, y: 45 });
    const m = aplicar(e, "m", intencao("token.mover", { id: "visivel", x: 999, y: -1 }));
    expect(m.movendo).toEqual({ id: "visivel", x: 60, y: 0 });
  });
});

describe("movimento", () => {
  it("token.mover é transitório: sem evento, sem mudar o estado, sem seq", () => {
    const e = criarEstado();
    const r = aplicar(e, "m", intencao("token.mover", { id: "visivel", x: 3, y: 4 }));
    expect(r.eventos).toEqual([]);
    expect(r.estado).toBe(e);
    expect(r.movendo).toEqual({ id: "visivel", x: 3, y: 4 });
  });

  it("token.soltar grava e gera token.movido com seq", () => {
    const e = criarEstado();
    const r = aplicar(e, "m", intencao("token.soltar", { id: "visivel", x: 3, y: 4 }));
    expect(r.eventos).toHaveLength(1);
    expect(r.eventos[0]).toMatchObject({
      tipo: "token.movido",
      seq: e.seq + 1,
      dados: { id: "visivel", x: 3, y: 4 },
    });
    expect(r.estado.tokens.find((t) => t.id === "visivel")).toMatchObject({ x: 3, y: 4 });
  });

  it("o jogador move o que controla; não move o dos outros", () => {
    const e = criarEstado();
    expect(codigo(e, "j1", intencao("token.soltar", { id: "visivel", x: 2, y: 2 }))).toBeNull();
    expect(codigo(e, "j2", intencao("token.soltar", { id: "visivel", x: 2, y: 2 }))).toBe(
      "sem_permissao",
    );
    expect(codigo(e, "j2", intencao("token.mover", { id: "visivel", x: 2, y: 2 }))).toBe(
      "sem_permissao",
    );
  });

  it("com token.moverProprio desligado o jogador não move nem o próprio", () => {
    let e = criarEstado();
    e = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "token.moverProprio", valor: false }),
    ).estado;
    expect(codigo(e, "j1", intencao("token.soltar", { id: "visivel", x: 2, y: 2 }))).toBe(
      "sem_permissao",
    );
    expect(codigo(e, "m", intencao("token.soltar", { id: "visivel", x: 2, y: 2 }))).toBeNull();
  });

  it("token invisível para o jogador responde como inexistente, mesmo se ele o controla", () => {
    let e = criarEstado();
    e = aplicar(
      e,
      "m",
      intencao("token.editar", { id: "oculto", mudancas: { controladoPor: ["j1"] } }),
    ).estado;
    expect(codigo(e, "j1", intencao("token.soltar", { id: "oculto", x: 2, y: 2 }))).toBe(
      "token_inexistente",
    );
    expect(codigo(e, "j1", intencao("token.mover", { id: "do-mestre", x: 2, y: 2 }))).toBe(
      "token_inexistente",
    );
    expect(codigo(e, "m", intencao("token.soltar", { id: "oculto", x: 2, y: 2 }))).toBeNull();
  });
});

describe("sigilo: snapshot", () => {
  it("o jogador não recebe token oculto nem da camada do mestre; o mestre recebe tudo", () => {
    const e = criarEstado();
    expect(visaoPara(e, j1).tokens.map((t) => t.id)).toEqual(["visivel"]);
    expect(visaoPara(e, mestre).tokens).toHaveLength(3);
    const texto = JSON.stringify(visaoPara(e, j2));
    expect(texto).not.toContain('"id":"oculto"');
    expect(texto).not.toContain("do-mestre");
    expect(texto).not.toContain("Nome oculto");
  });
});

describe("sigilo: eventos", () => {
  const e = criarEstado();

  it("criar token invisível: nada chega ao jogador; visível: chega", () => {
    const base = { nome: "N", cor: "#fff", tamanhoQuadrados: 1, x: 1, y: 1, controladoPor: [] };
    expect(
      recebido(
        e,
        j1,
        intencao("token.criar", { token: { ...base, id: "a", camada: "tokens", oculto: true } }),
      ),
    ).toEqual([]);
    expect(
      recebido(
        e,
        j1,
        intencao("token.criar", { token: { ...base, id: "b", camada: "mestre", oculto: false } }),
      ),
    ).toEqual([]);
    expect(
      recebido(
        e,
        j1,
        intencao("token.criar", { token: { ...base, id: "c", camada: "tokens", oculto: false } }),
      ),
    ).toHaveLength(1);
    expect(
      recebido(
        e,
        mestre,
        intencao("token.criar", { token: { ...base, id: "a", camada: "tokens", oculto: true } }),
      ),
    ).toHaveLength(1);
  });

  it("editar ou mover token que continua invisível: nada chega ao jogador", () => {
    expect(
      recebido(e, j1, intencao("token.editar", { id: "oculto", mudancas: { nome: "Outro nome" } })),
    ).toEqual([]);
    expect(
      recebido(e, j1, intencao("token.editar", { id: "do-mestre", mudancas: { cor: "#000" } })),
    ).toEqual([]);
    expect(recebido(e, j1, intencao("token.soltar", { id: "oculto", x: 5, y: 5 }))).toEqual([]);
    expect(recebido(e, j1, intencao("token.apagar", { id: "do-mestre" }))).toEqual([]);
  });

  it("esconder um token visível: o jogador recebe só token.sumiu { id }", () => {
    const [ev, ...resto] = recebido(
      e,
      j1,
      intencao("token.editar", { id: "visivel", mudancas: { oculto: true, nome: "NOME-SECRETO" } }),
    );
    expect(resto).toEqual([]);
    expect(ev).toMatchObject({ tipo: "token.sumiu", dados: { id: "visivel" } });
    expect(Object.keys(ev?.dados ?? {})).toEqual(["id"]);
    expect(JSON.stringify(ev)).not.toContain("NOME-SECRETO");
  });

  it("mudar um token visível para a camada do mestre também faz sumir", () => {
    const [ev] = recebido(
      e,
      j2,
      intencao("token.editar", { id: "visivel", mudancas: { camada: "mestre" } }),
    );
    expect(ev).toMatchObject({ tipo: "token.sumiu", dados: { id: "visivel" } });
  });

  it("revelar um token: o jogador recebe o token inteiro e o reduzir o insere", () => {
    const antes = visaoPara(e, j1);
    const [ev] = recebido(
      e,
      j1,
      intencao("token.editar", { id: "oculto", mudancas: { oculto: false } }),
    );
    expect(ev).toMatchObject({
      tipo: "token.editado",
      dados: { token: { id: "oculto", nome: "Nome oculto" } },
    });
    if (!ev) throw new Error("sem evento");
    const depois = reduzir(antes, ev);
    expect(depois.tokens.map((t) => t.id).sort()).toEqual(["oculto", "visivel"]);
  });

  it("o cliente reproduz: esconder e depois revelar volta ao mesmo token", () => {
    let mestreE = e;
    let jogadorE = visaoPara(e, j1);
    for (const mudancas of [{ oculto: true }, { oculto: false }]) {
      const r = aplicar(mestreE, "m", intencao("token.editar", { id: "visivel", mudancas }));
      for (const ev of r.eventos) {
        const visto = eventoPara(ev, j1, mestreE, r.estado);
        if (visto) jogadorE = reduzir(jogadorE, visto);
      }
      mestreE = r.estado;
    }
    expect(jogadorE.tokens.find((t) => t.id === "visivel")).toEqual(
      mestreE.tokens.find((t) => t.id === "visivel"),
    );
  });

  it("soltar token visível chega ao jogador; apagar token visível também", () => {
    expect(
      recebido(e, j2, intencao("token.soltar", { id: "visivel", x: 5, y: 5 }))[0],
    ).toMatchObject({ tipo: "token.movido" });
    expect(recebido(e, j2, intencao("token.apagar", { id: "visivel" }))[0]).toMatchObject({
      tipo: "token.apagado",
    });
  });

  it("sem o estado de antes e depois, o jogador não recebe evento de token (falha fechada)", () => {
    const r = aplicar(
      e,
      "m",
      intencao("token.editar", { id: "visivel", mudancas: { oculto: true } }),
    );
    const ev = r.eventos[0];
    if (!ev) throw new Error("sem evento");
    expect(eventoPara(ev, j1)).toBeNull();
  });

  it("o grid vai para todos", () => {
    expect(recebido(e, j1, intencao("cena.configurarGrid", { visivel: false }))[0]).toMatchObject({
      tipo: "cena.gridAlterado",
    });
  });
});

describe("sigilo: token.movendo", () => {
  it("a sala só tem o que repassar quando o token é visível para o destinatário", () => {
    const e = criarEstado();
    for (const id of ["oculto", "do-mestre", "visivel"]) {
      const r = aplicar(e, "m", intencao("token.mover", { id, x: 3, y: 3 }));
      const alvo = e.tokens.find((t) => t.id === id);
      expect(r.movendo?.id).toBe(id);
      // o filtro da sala (tokenVisivelPara) decide o destinatário
      expect(alvo && visaoPara(e, j1).tokens.some((t) => t.id === alvo.id)).toBe(id === "visivel");
    }
  });
});

describe("exportação v5 e importação de v1 e v2", () => {
  it("a exportação traz cenas, cena ativa, tokens e assets, em versão 5", () => {
    const e = criarEstado();
    const x = criarExportacao(e, AGORA);
    expect(x.versao).toBe(13);
    expect(x.dados.tokens).toHaveLength(3);
    expect(x.dados.cenas).toEqual(e.cenas);
    const lida = lerExportacao(JSON.parse(JSON.stringify(x)));
    expect(lida.ok && lida.exportacao.dados).toEqual(x.dados);
  });

  it("aceita a v1 (sem cena nem tokens): cena padrão e nenhum token", () => {
    const e = criarEstado();
    const { cenas: _c, cenaAtivaId: _a, tokens: _t, ...dadosV1 } = criarExportacao(e, AGORA).dados;
    const v1 = { formato: "tabletop-campanha", versao: 1, exportadoEm: AGORA, dados: dadosV1 };
    const lida = lerExportacao(v1);
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.exportacao.versao).toBe(13);
    expect(lida.exportacao.dados.assets).toEqual([]);
    expect(lida.exportacao.dados.cenas).toEqual([CENA_PADRAO]);
    expect(lida.exportacao.dados.cenaAtivaId).toBe("cena-1");
    expect(lida.exportacao.dados.tokens).toEqual([]);
    const r = aplicar(e, "m", intencao("campanha.importar", { dados: v1 }));
    expect(r.estado.tokens).toEqual([]);
  });

  it("recusa token em cena inexistente, id repetido e controle por usuário desconhecido", () => {
    const x = criarExportacao(criarEstado(), AGORA);
    const ruim = (tokens: Token[]) => lerExportacao({ ...x, dados: { ...x.dados, tokens } }).ok;
    expect(ruim([token("a", { cenaId: "nada" })])).toBe(false);
    expect(ruim([token("a"), token("a")])).toBe(false);
    expect(ruim([token("a", { controladoPor: ["fantasma"] })])).toBe(false);
    expect(ruim([token("a")])).toBe(true);
    expect(lerExportacao({ ...x, dados: { ...x.dados, cenaAtivaId: "nada" } }).ok).toBe(false);
  });
});

describe("tirar o token do mapa e desfazer (V10)", () => {
  const apagarComo = (quem: string, id: string) =>
    processar(criarEstado(), quem, intencao("token.apagar", { id }), AGORA);

  it("quem controla apaga; quem não controla não; o mestre apaga qualquer um", () => {
    expect(apagarComo("j1", "visivel").ok).toBe(true);
    const outro = apagarComo("j2", "visivel");
    expect(outro.ok ? null : outro.erro.codigo).toBe("sem_permissao");
    expect(apagarComo("m", "visivel").ok).toBe(true);
    expect(apagarComo("m", "do-mestre").ok).toBe(true);
  });

  it("o jogador não apaga o token da camada do mestre nem o que não vê", () => {
    const e = criarEstado();
    e.tokens = e.tokens.map((t) =>
      t.id === "do-mestre" || t.id === "oculto" ? { ...t, controladoPor: ["j1"] } : t,
    );
    for (const id of ["do-mestre", "oculto"]) {
      const r = processar(e, "j1", intencao("token.apagar", { id }), AGORA);
      expect(r.ok).toBe(false);
    }
  });

  it("restaurar dentro do prazo funciona; o token volta igual", () => {
    const e = criarEstado();
    const r = processar(e, "j1", intencao("token.apagar", { id: "visivel" }), AGORA);
    if (!r.ok || !r.apagado) throw new Error("devia apagar");
    const guardado = [{ ...r.apagado, emMs: Date.parse(AGORA) }];
    const volta = processar(
      r.estado,
      "j1",
      intencao("token.restaurar", { id: "visivel" }),
      new Date(Date.parse(AGORA) + 9_000).toISOString(),
      undefined,
      guardado,
    );
    expect(volta.ok).toBe(true);
    if (volta.ok) {
      expect(volta.estado.tokens.find((t) => t.id === "visivel")).toEqual(
        e.tokens.find((t) => t.id === "visivel"),
      );
    }
  });

  it("fora do prazo ou por outra pessoa é recusado; o mestre ainda restaura", () => {
    const e = criarEstado();
    const r = processar(e, "j1", intencao("token.apagar", { id: "visivel" }), AGORA);
    if (!r.ok || !r.apagado) throw new Error("devia apagar");
    const guardado = [{ ...r.apagado, emMs: Date.parse(AGORA) }];
    const tarde = new Date(Date.parse(AGORA) + 11_000).toISOString();
    const pedir = (quem: string, quando: string) =>
      processar(
        r.estado,
        quem,
        intencao("token.restaurar", { id: "visivel" }),
        quando,
        undefined,
        guardado,
      );
    expect(pedir("j1", tarde).ok).toBe(false);
    expect(pedir("j2", AGORA).ok).toBe(false);
    expect(pedir("m", tarde).ok).toBe(true);
    // Sem registro nenhum (a sala reiniciou ou já passou muito tempo): recusa.
    const semRegistro = processar(
      r.estado,
      "j1",
      intencao("token.restaurar", { id: "visivel" }),
      AGORA,
    );
    expect(semRegistro.ok).toBe(false);
  });
});
