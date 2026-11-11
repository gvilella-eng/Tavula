import { describe, expect, it } from "vitest";
import {
  CAPACIDADES_DELEGAVEIS,
  CAPACIDADES_DO_MESTRE,
  criarExportacao,
  type Estado,
  estadoInicial,
  eventoPara,
  type Intencao,
  IntencaoSchema,
  PASTA_PERSONAGENS_ID,
  PERMISSOES_PADRAO,
  pode,
  processar,
  reduzir,
  TODAS_AS_CAPACIDADES,
  visaoPara,
} from "./index.ts";

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "m2", nome: "Mestre 2", papel: "mestre", cor: "#222" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
      { id: "a", nome: "Assistente", papel: "assistente", cor: "#555" },
    ],
  });
}

/** Um handout para os testes (id e título iguais); só o mestre o vê, salvo se `visivel` disser outra coisa. */
function handoutNovo(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    pastaId: PASTA_PERSONAGENS_ID,
    titulo: id,
    texto: "",
    fonte: "simples",
    visivel: { tipo: "mestre" },
    ...extra,
  };
}

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object = {}): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });
}
const AGORA = "2026-01-01T00:00:00.000Z";

function aplicar(estado: Estado, quem: string, i: Intencao) {
  const r = processar(estado, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo}`);
  return r;
}

function codigoDoErro(estado: Estado, quem: string, i: Intencao): string | null {
  const r = processar(estado, quem, i, AGORA);
  return r.ok ? null : r.erro.codigo;
}

function primeiroEvento(r: ReturnType<typeof aplicar>) {
  const ev = r.eventos[0];
  if (!ev) throw new Error("sem evento");
  return ev;
}

describe("pode()", () => {
  const estado = criarEstado();
  const get = (id: string) => {
    const u = estado.usuarios.find((x) => x.id === id);
    if (!u) throw new Error(id);
    return u;
  };

  it("o mestre pode tudo", () => {
    for (const c of TODAS_AS_CAPACIDADES) expect(pode(get("m"), c, estado.permissoes)).toBe(true);
  });

  it("o jogador nunca exerce as exclusivas do mestre, nem com exceção", () => {
    const permissoes = { ...estado.permissoes, porUsuario: { j1: { "nota.editar": true } } };
    for (const c of CAPACIDADES_DO_MESTRE) expect(pode(get("j1"), c, permissoes)).toBe(false);
  });

  it("o jogador segue o padrão da mesa", () => {
    expect(pode(get("j1"), "nota.editar", estado.permissoes)).toBe(true);
    const desligado = {
      ...estado.permissoes,
      jogadores: { ...estado.permissoes.jogadores, "nota.editar": false },
    };
    expect(pode(get("j1"), "nota.editar", desligado)).toBe(false);
  });

  it("a exceção por usuário vale mais que o padrão (nos dois sentidos)", () => {
    const base = estado.permissoes;
    const liga = { ...base, porUsuario: { j1: { "luz.apagar": true } } };
    expect(pode(get("j1"), "luz.apagar", liga)).toBe(true);
    expect(pode(get("j2"), "luz.apagar", liga)).toBe(false);
    const desliga = { ...base, porUsuario: { j1: { "nota.editar": false } } };
    expect(pode(get("j1"), "nota.editar", desliga)).toBe(false);
    expect(pode(get("j2"), "nota.editar", desliga)).toBe(true);
  });

  it("o assistente não pode nada por enquanto", () => {
    for (const c of TODAS_AS_CAPACIDADES) expect(pode(get("a"), c, estado.permissoes)).toBe(false);
  });

  it("as listas de capacidades não se sobrepõem", () => {
    const todas = [...CAPACIDADES_DELEGAVEIS, ...CAPACIDADES_DO_MESTRE];
    expect(new Set(todas).size).toBe(todas.length);
  });
});

describe("processar()", () => {
  it("cria um handout e numera o evento", () => {
    const r = aplicar(
      criarEstado(),
      "m",
      intencao("handout.criar", { handout: handoutNovo("h1", { texto: "oi" }) }),
    );
    expect(r.estado.handouts.map((h) => h.texto)).toEqual(["oi"]);
    expect(r.estado.seq).toBe(1);
    expect(r.eventos[0]).toMatchObject({ seq: 1, tipo: "handout.alterado" });
    expect(r.eventos[0]?.origem.usuarioId).toBe("m");
  });

  it("o jogador não executa ações de mestre", () => {
    const e = criarEstado();
    const proibidas: Intencao[] = [
      intencao("handout.criar", { handout: handoutNovo("h1") }),
      intencao("handout.mostrar", { id: "h1" }),
      intencao("papel.alterar", { usuarioId: "j1", papel: "mestre" }),
      intencao("permissao.alterar", { capacidade: "nota.editar", valor: false }),
      intencao("campanha.exportar"),
      intencao("campanha.importar", { dados: criarExportacao(e, AGORA) }),
    ];
    for (const i of proibidas) expect(codigoDoErro(e, "j1", i), i.tipo).toBe("sem_permissao");
  });

  it("capacidade desligada recusa a intenção; exceção por usuário a devolve", () => {
    let e = aplicar(
      criarEstado(),
      "m",
      intencao("permissao.alterar", { capacidade: "porta.abrir", valor: false }),
    ).estado;
    // Sem porta na cena: com a capacidade o erro é outro (porta_inexistente), nunca sem_permissao.
    const i = intencao("porta.alternar", { id: "x" });
    expect(codigoDoErro(e, "j1", i)).toBe("sem_permissao");
    e = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "porta.abrir", valor: true, usuarioId: "j1" }),
    ).estado;
    expect(codigoDoErro(e, "j1", i)).toBe("porta_inexistente");
    expect(codigoDoErro(e, "j2", i)).toBe("sem_permissao");
    e = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "porta.abrir", valor: null, usuarioId: "j1" }),
    ).estado;
    expect(e.permissoes.porUsuario).toEqual({});
    expect(codigoDoErro(e, "j1", i)).toBe("sem_permissao");
  });

  it("recusa mudar capacidade exclusiva do mestre", () => {
    const i = intencao("permissao.alterar", {
      capacidade: "papel.alterar",
      valor: true,
      usuarioId: "j1",
    });
    expect(codigoDoErro(criarEstado(), "m", i)).toBe("capacidade_nao_delegavel");
  });

  it("o último mestre não se rebaixa nem é rebaixado", () => {
    const r1 = aplicar(
      criarEstado(),
      "m",
      intencao("papel.alterar", { usuarioId: "m2", papel: "jogador" }),
    );
    // com dois mestres, rebaixar um é permitido, e ele recebe snapshot novo
    expect(r1.snapshotPara).toEqual(["m2"]);
    const rebaixar = intencao("papel.alterar", { usuarioId: "m", papel: "jogador" });
    expect(codigoDoErro(r1.estado, "m", rebaixar)).toBe("ultimo_mestre");
  });

  it("promover um jogador o torna mestre", () => {
    const r = aplicar(
      criarEstado(),
      "m",
      intencao("papel.alterar", { usuarioId: "j1", papel: "mestre" }),
    );
    expect(r.estado.usuarios.find((u) => u.id === "j1")?.papel).toBe("mestre");
  });

  it("recusa usuário inexistente", () => {
    const i = intencao("papel.alterar", { usuarioId: "zzz", papel: "mestre" });
    expect(codigoDoErro(criarEstado(), "m", i)).toBe("usuario_inexistente");
  });
});

describe("filtro por papel", () => {
  const base = aplicar(
    aplicar(
      criarEstado(),
      "m",
      intencao("handout.criar", { handout: handoutNovo("h1", { texto: "SEGREDO" }) }),
    ).estado,
    "m",
    intencao("permissao.alterar", { capacidade: "luz.apagar", valor: true, usuarioId: "j2" }),
  ).estado;

  it("visaoPara nunca entrega o handout do mestre nem exceções alheias a jogador", () => {
    const v = visaoPara(base, { id: "j1", papel: "jogador" });
    expect(JSON.stringify(v)).not.toContain("SEGREDO");
    expect(v.permissoes.porUsuario).toEqual({});
    const v2 = visaoPara(base, { id: "j2", papel: "jogador" });
    expect(v2.permissoes.porUsuario).toEqual({ j2: { "luz.apagar": true } });
  });

  it("o assistente também não recebe o handout do mestre", () => {
    const v = visaoPara(base, { id: "a", papel: "assistente" });
    expect(JSON.stringify(v)).not.toContain("SEGREDO");
  });

  it("o mestre recebe tudo", () => {
    // O relógio vai na forma do navegador (sem `desdeReal`); o resto é igual.
    const { relogio: _a, ...vista } = visaoPara(base, { id: "m", papel: "mestre" });
    const { relogio: _b, ...tudo } = base;
    expect(vista).toEqual(tudo);
  });

  it("eventoPara omite o que o jogador não vê", () => {
    const criado = aplicar(
      criarEstado(),
      "m",
      intencao("handout.criar", { handout: handoutNovo("h1", { texto: "SEGREDO" }) }),
    );
    const ev = primeiroEvento(criado);
    expect(eventoPara(ev, { id: "j1", papel: "jogador" }, undefined, criado.estado)).toBeNull();
    expect(eventoPara(ev, { id: "m2", papel: "mestre" })).toEqual(ev);

    const p = primeiroEvento(
      aplicar(
        criarEstado(),
        "m",
        intencao("permissao.alterar", { capacidade: "luz.apagar", valor: true, usuarioId: "j2" }),
      ),
    );
    expect(eventoPara(p, { id: "j1", papel: "jogador" })).toBeNull();
    expect(eventoPara(p, { id: "j2", papel: "jogador" })).toEqual(p);
    expect(eventoPara(p, { id: "m", papel: "mestre" })).toEqual(p);
  });
});

describe("reduzir()", () => {
  it("o cliente chega ao mesmo estado que a sala aplicando os eventos filtrados", () => {
    let sala = criarEstado();
    let cliente = visaoPara(sala, { id: "j1", papel: "jogador" });
    const passos: [string, Intencao][] = [
      [
        "m",
        intencao("handout.criar", { handout: handoutNovo("h1", { visivel: { tipo: "todos" } }) }),
      ],
      ["m", intencao("handout.criar", { handout: handoutNovo("h2", { texto: "segredo" }) })],
      ["m", intencao("permissao.alterar", { capacidade: "luz.apagar", valor: true })],
      [
        "m",
        intencao("permissao.alterar", { capacidade: "asset.subir", valor: false, usuarioId: "j1" }),
      ],
      [
        "m",
        intencao("permissao.alterar", { capacidade: "asset.subir", valor: null, usuarioId: "j1" }),
      ],
      ["m", intencao("handout.editar", { id: "h1", mudancas: { texto: "b" } })],
    ];
    for (const [quem, i] of passos) {
      const anterior = sala;
      const r = aplicar(sala, quem, i);
      sala = r.estado;
      for (const ev of r.eventos) {
        const visto = eventoPara(ev, { id: "j1", papel: "jogador" }, anterior, sala);
        if (visto) cliente = reduzir(cliente, visto);
      }
      // O que muda quem vê (a pasta de um handout, por exemplo) vem num snapshot novo.
      if (r.snapshotPara === "todos") cliente = visaoPara(sala, { id: "j1", papel: "jogador" });
    }
    expect(cliente).toEqual(visaoPara(sala, { id: "j1", papel: "jogador" }));
  });

  it("ignora eventos com seq antigo", () => {
    const r = aplicar(
      criarEstado(),
      "m",
      intencao("handout.criar", { handout: handoutNovo("h1") }),
    );
    expect(reduzir(r.estado, primeiroEvento(r))).toBe(r.estado);
  });
});

describe("exportar e importar", () => {
  it("exportar → importar devolve o mesmo estado", () => {
    let e = criarEstado();
    e = aplicar(
      e,
      "m",
      intencao("handout.criar", { handout: handoutNovo("h1", { texto: "mesa", fonte: "livro" }) }),
    ).estado;
    e = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "luz.apagar", valor: true, usuarioId: "j1" }),
    ).estado;
    const exportacao = aplicar(e, "m", intencao("campanha.exportar")).exportacao;
    const texto = JSON.stringify(exportacao);

    const r = aplicar(
      criarEstado(),
      "m",
      intencao("campanha.importar", { dados: JSON.parse(texto) }),
    );
    // A campanha restaurada volta com a mesa pausada, no tempo em que foi exportada.
    const { relogio: relogioImportado, ...importado } = r.estado;
    const { relogio: _original, ...original } = e;
    expect(importado).toEqual(original);
    expect(relogioImportado.pausada).toBe(true);
    expect(r.snapshotPara).toBe("todos");
  });

  it("a exportação não leva uso nem presença", () => {
    const x = criarExportacao(criarEstado(), AGORA);
    expect(Object.keys(x.dados).sort()).toEqual(
      [
        "assets",
        "cenaAtivaId",
        "cenas",
        "config",
        "desenhos",
        "luzes",
        "handouts",
        "modelos",
        "ordemDeTurnoVisivel",
        "paredes",
        "pastas",
        "permissoes",
        "personagens",
        "pontos",
        "relogio",
        "seq",
        "tokens",
        "usuarios",
      ].sort(),
    );
  });

  it("importação inválida é recusada", () => {
    const e = criarEstado();
    const boa = criarExportacao(e, AGORA);
    const primeiro = boa.dados.usuarios[0];
    const casos: unknown[] = [
      null,
      "texto",
      {},
      { ...boa, formato: "outro" },
      { ...boa, versao: 14 },
      { ...boa, dados: { ...boa.dados, usuarios: [] } },
      {
        ...boa,
        dados: {
          ...boa.dados,
          usuarios: boa.dados.usuarios.map((u) => ({ ...u, papel: "jogador" })),
        },
      },
      { ...boa, dados: { ...boa.dados, usuarios: [...boa.dados.usuarios, primeiro] } },
      {
        ...boa,
        dados: {
          ...boa.dados,
          permissoes: { jogadores: { "luz.apagar": "sim" }, porUsuario: {} },
        },
      },
      {
        ...boa,
        dados: {
          ...boa.dados,
          permissoes: { ...boa.dados.permissoes, porUsuario: { fantasma: {} } },
        },
      },
    ];
    for (const dados of casos) {
      const i = intencao("campanha.importar", { dados });
      expect(codigoDoErro(e, "m", i), JSON.stringify(dados)).toBe("importacao_invalida");
    }
  });

  it("o seq não volta ao importar uma exportação mais antiga", () => {
    const antiga = criarExportacao(criarEstado(), AGORA);
    let e = criarEstado();
    for (const id of ["a", "b", "c"]) {
      e = aplicar(e, "m", intencao("handout.criar", { handout: handoutNovo(id) })).estado;
    }
    const r = aplicar(e, "m", intencao("campanha.importar", { dados: antiga }));
    expect(r.estado.seq).toBe(e.seq);
    expect(r.estado.handouts).toEqual(antiga.dados.handouts);
  });

  it("exportação sem uma capacidade nova importa com o padrão da mesa", () => {
    const x = criarExportacao(criarEstado(), AGORA);
    const { "luz.apagar": _sem, ...jogadores } = x.dados.permissoes.jogadores;
    const dados = { ...x, dados: { ...x.dados, permissoes: { ...x.dados.permissoes, jogadores } } };
    const r = aplicar(criarEstado(), "m", intencao("campanha.importar", { dados }));
    expect(r.estado.permissoes.jogadores["luz.apagar"]).toBe(PERMISSOES_PADRAO["luz.apagar"]);
  });

  it("quem importa precisa continuar mestre na campanha importada", () => {
    const e = criarEstado();
    const x = criarExportacao(e, AGORA);
    const usuarios = x.dados.usuarios.map((u) => (u.id === "m" ? { ...u, papel: "jogador" } : u));
    const dados = { ...x, dados: { ...x.dados, usuarios } };
    expect(codigoDoErro(e, "m", intencao("campanha.importar", { dados }))).toBe(
      "importacao_invalida",
    );
  });
});
