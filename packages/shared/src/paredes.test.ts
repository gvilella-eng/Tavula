import { describe, expect, it } from "vitest";
import {
  alcanceDeVisao,
  alternarPortaDoJogador,
  criarExportacao,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  type Intencao,
  IntencaoSchema,
  iluminacaoDinamicaLigada,
  lerExportacao,
  type Parede,
  paredeParaJogador,
  processar,
  reduzir,
  trajetoBloqueado,
  VERSAO_EXPORTACAO,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";

function criarEstado(): Estado {
  return estadoInicial({
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
      {
        id: "c2",
        nome: "Outra",
        larguraM: 30,
        alturaM: 30,
        grid: { quadradoM: 1.5, visivel: true },
      },
    ],
    cenaAtivaId: "c1",
    tokens: [
      {
        id: "t1",
        cenaId: "c1",
        nome: "Aldric",
        cor: "#0f0",
        tamanhoQuadrados: 1,
        x: 5.25,
        y: 5.25,
        camada: "tokens",
        oculto: false,
        controladoPor: ["j1"],
      },
    ],
  });
}

function tokenBase() {
  const t = criarEstado().tokens[0];
  if (!t) throw new Error("sem token");
  return t;
}

function cenaDe(estado: Estado, id: string) {
  const c = estado.cenas.find((x) => x.id === id);
  if (!c) throw new Error(id);
  return c;
}

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object = {}): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });
}

function aplicar(estado: Estado, quem: string, i: Intencao) {
  const r = processar(estado, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo}`);
  return r;
}
const codigo = (estado: Estado, quem: string, i: Intencao) => {
  const r = processar(estado, quem, i, AGORA);
  return r.ok ? null : r.erro.codigo;
};

const ponto = (x: number, y: number) => ({ x, y });
function parede(
  id: string,
  a: [number, number],
  b: [number, number],
  tipo: Parede["tipo"] = "parede",
  estado?: Parede["estado"],
): Parede {
  return {
    id,
    cenaId: "c1",
    a: ponto(...a),
    b: ponto(...b),
    tipo,
    ...(estado ? { estado } : {}),
  };
}

/** Estado com as paredes dadas, sem passar pelas intenções. */
function comParedes(...paredes: Parede[]): Estado {
  return { ...criarEstado(), paredes };
}

describe("trajeto bloqueado", () => {
  const de = ponto(5, 5);
  const para = ponto(10, 5);
  it("parede, porta fechada, trancada, janela e invisível recusam", () => {
    for (const [tipo, estado] of [
      ["parede", undefined],
      ["porta", "fechada"],
      ["porta", "trancada"],
      ["secreta", "fechada"],
      ["janela", undefined],
      ["invisivel", undefined],
    ] as const) {
      const p = parede("p", [7, 0], [7, 20], tipo, estado);
      expect(trajetoBloqueado(de, para, [p]), `${tipo} ${estado}`).toBe(true);
    }
  });
  it("porta aberta (e secreta aberta) deixa passar", () => {
    expect(trajetoBloqueado(de, para, [parede("p", [7, 0], [7, 20], "porta", "aberta")])).toBe(
      false,
    );
    expect(trajetoBloqueado(de, para, [parede("p", [7, 0], [7, 20], "secreta", "aberta")])).toBe(
      false,
    );
  });
  it("só conta o que está no caminho; parar sobre a parede também é recusado", () => {
    expect(trajetoBloqueado(de, para, [parede("p", [12, 0], [12, 20])])).toBe(false);
    expect(trajetoBloqueado(de, para, [parede("p", [7, 8], [7, 20])])).toBe(false);
    expect(trajetoBloqueado(de, ponto(7, 5), [parede("p", [7, 0], [7, 20])])).toBe(true);
    expect(trajetoBloqueado(de, de, [parede("p", [5, 0], [5, 20])])).toBe(false);
  });
  it("quem já está sobre a parede consegue sair", () => {
    expect(trajetoBloqueado(ponto(7, 5), para, [parede("p", [7, 0], [7, 20])])).toBe(false);
  });
});

describe("token.soltar atravessando parede", () => {
  const e = comParedes(parede("p", [7.5, 0], [7.5, 20]));
  it("o jogador é recusado com trajeto_bloqueado; o mestre ignora", () => {
    const soltar = (x: number) => intencao("token.soltar", { id: "t1", x, y: 5.25 });
    expect(codigo(e, "j1", soltar(11.25))).toBe("trajeto_bloqueado");
    expect(codigo(e, "j1", soltar(6.75))).toBeNull();
    expect(codigo(e, "m", soltar(11.25))).toBeNull();
  });
  it("com a porta aberta o jogador passa", () => {
    const aberta = comParedes(parede("p", [7.5, 0], [7.5, 20], "porta", "aberta"));
    expect(
      codigo(aberta, "j1", intencao("token.soltar", { id: "t1", x: 11.25, y: 5.25 })),
    ).toBeNull();
  });
  it("parede de outra cena não bloqueia", () => {
    const outra = { ...e, paredes: [{ ...(e.paredes[0] as Parede), cenaId: "c2" }] };
    expect(
      codigo(outra, "j1", intencao("token.soltar", { id: "t1", x: 11.25, y: 5.25 })),
    ).toBeNull();
  });
});

describe("a porta secreta chega ao jogador como parede", () => {
  it("paredeParaJogador: fechada vira parede sem estado, aberta vira porta aberta, nunca secreta", () => {
    const fechada = paredeParaJogador(parede("s", [1, 1], [2, 1], "secreta", "fechada"));
    expect(fechada.tipo).toBe("parede");
    expect(fechada.estado).toBeUndefined();
    expect(paredeParaJogador(parede("s", [1, 1], [2, 1], "secreta", "trancada")).tipo).toBe(
      "parede",
    );
    const aberta = paredeParaJogador(parede("s", [1, 1], [2, 1], "secreta", "aberta"));
    expect(aberta.tipo).toBe("porta");
    expect(aberta.estado).toBe("aberta");
    const comum = parede("p", [1, 1], [2, 1], "porta", "trancada");
    expect(paredeParaJogador(comum)).toEqual(comum);
  });

  it("o snapshot do jogador só tem paredes da cena ativa e nunca a secreta", () => {
    const e = comParedes(
      parede("a", [1, 1], [5, 1]),
      parede("s", [5, 1], [5, 5], "secreta", "fechada"),
      { ...parede("o", [1, 1], [5, 1]), cenaId: "c2" },
    );
    const visto = visaoPara(e, { id: "j1", papel: "jogador" });
    expect(visto.paredes.map((p) => p.id).sort()).toEqual(["a", "s"]);
    expect(visto.paredes.find((p) => p.id === "s")).toEqual({
      id: "s",
      cenaId: "c1",
      a: ponto(5, 1),
      b: ponto(5, 5),
      tipo: "parede",
    });
    expect(JSON.stringify(visto)).not.toContain("secreta");
    // o mestre vê tudo
    expect(visaoPara(e, { id: "m", papel: "mestre" }).paredes).toHaveLength(3);
  });

  it("as transições da secreta chegam ao jogador já convertidas", () => {
    const e0 = comParedes(parede("s", [5, 1], [5, 5], "secreta", "fechada"));
    const jogador = { id: "j1", papel: "jogador" as const };
    const ver = (antes: Estado, depois: Estado, eventos: EventoSala[]) =>
      eventos.map((ev) => eventoPara(ev, jogador, antes, depois));

    // o mestre abre: o jogador recebe uma porta aberta
    const abre = aplicar(e0, "m", intencao("porta.alternar", { id: "s" }));
    const [aberta] = ver(e0, abre.estado, abre.eventos);
    expect(aberta?.tipo).toBe("parede.editada");
    expect(aberta && "parede" in aberta.dados ? aberta.dados.parede.tipo : null).toBe("porta");
    expect(aberta && "parede" in aberta.dados ? aberta.dados.parede.estado : null).toBe("aberta");

    // o mestre fecha: volta a ser parede
    const fecha = aplicar(abre.estado, "m", intencao("porta.alternar", { id: "s" }));
    const [fechada] = ver(abre.estado, fecha.estado, fecha.eventos);
    expect(fechada && "parede" in fechada.dados ? fechada.dados.parede.tipo : null).toBe("parede");
    expect(
      fechada && "parede" in fechada.dados ? fechada.dados.parede.estado : "x",
    ).toBeUndefined();

    // o mestre tranca e destranca: nada muda para o jogador, então nada chega
    const tranca = aplicar(e0, "m", intencao("parede.editar", { id: "s", estado: "trancada" }));
    expect(ver(e0, tranca.estado, tranca.eventos)).toEqual([null]);

    // virar porta de verdade é perceptível; virar parede também
    const viraPorta = aplicar(e0, "m", intencao("parede.editar", { id: "s", tipo: "porta" }));
    const [porta] = ver(e0, viraPorta.estado, viraPorta.eventos);
    expect(porta && "parede" in porta.dados ? porta.dados.parede.tipo : null).toBe("porta");

    // nenhum evento entregue ao jogador menciona "secreta"
    for (const r of [abre, fecha, tranca, viraPorta]) {
      for (const ev of r.eventos) {
        const antes = r === abre ? e0 : r === fecha ? abre.estado : e0;
        expect(JSON.stringify(eventoPara(ev, jogador, antes, r.estado))).not.toContain("secreta");
      }
    }
  });

  it("criar a secreta chega como parede; apagar chega como apagada; outra cena não chega", () => {
    const e0 = criarEstado();
    const jogador = { id: "j1", papel: "jogador" as const };
    const cria = aplicar(
      e0,
      "m",
      intencao("parede.criar", {
        paredes: [{ id: "s", a: ponto(3, 3), b: ponto(6, 3), tipo: "secreta" }],
      }),
    );
    const visto = eventoPara(cria.eventos[0] as EventoSala, jogador, e0, cria.estado);
    expect(visto?.tipo).toBe("parede.criada");
    expect(JSON.stringify(visto)).not.toContain("secreta");
    const apaga = aplicar(cria.estado, "m", intencao("parede.apagar", { id: "s" }));
    expect(
      eventoPara(apaga.eventos[0] as EventoSala, jogador, cria.estado, apaga.estado)?.tipo,
    ).toBe("parede.apagada");
    const outra = aplicar(
      e0,
      "m",
      intencao("parede.criar", {
        cenaId: "c2",
        paredes: [{ id: "x", a: ponto(3, 3), b: ponto(6, 3), tipo: "parede" }],
      }),
    );
    expect(eventoPara(outra.eventos[0] as EventoSala, jogador, e0, outra.estado)).toBeNull();
  });
});

describe("abrir e fechar portas", () => {
  const porta = (estado: Parede["estado"]) => parede("d", [7.5, 4.5], [7.5, 6], "porta", estado);
  const alternar = intencao("porta.alternar", { id: "d" });

  it("o jogador abre e fecha a porta destrancada ao alcance de um token dele", () => {
    // t1 está em (5.25; 5.25): o meio da porta (7.5; 5.25) está a 2,25 m
    const longe = comParedes(porta("fechada"));
    expect(codigo(longe, "j1", alternar)).toBe("fora_de_alcance");
    const perto = {
      ...longe,
      tokens: longe.tokens.map((t) => ({ ...t, x: 6.75, y: 5.25 })),
    };
    const abre = aplicar(perto, "j1", alternar);
    expect(abre.estado.paredes[0]?.estado).toBe("aberta");
    const fecha = aplicar(abre.estado, "j1", alternar);
    expect(fecha.estado.paredes[0]?.estado).toBe("fechada");
  });

  it("porta trancada responde trancada; o mestre abre mesmo assim", () => {
    const e = {
      ...comParedes(porta("trancada")),
      tokens: [{ ...tokenBase(), x: 6.75, y: 5.25 }],
    };
    expect(codigo(e, "j1", alternar)).toBe("porta_trancada");
    expect(aplicar(e, "m", alternar).estado.paredes[0]?.estado).toBe("aberta");
  });

  it("quem não controla nenhum token ao alcance não abre; o outro jogador também não", () => {
    const e = {
      ...comParedes(porta("fechada")),
      tokens: [{ ...tokenBase(), x: 6.75, y: 5.25 }],
    };
    expect(codigo(e, "j2", alternar)).toBe("fora_de_alcance");
  });

  it("a secreta responde como parede para o jogador (e parede comum também)", () => {
    const base = { tokens: [{ ...tokenBase(), x: 6.75, y: 5.25 }] };
    const secreta = {
      ...comParedes(parede("d", [7.5, 4.5], [7.5, 6], "secreta", "fechada")),
      ...base,
    };
    expect(codigo(secreta, "j1", alternar)).toBe("porta_inexistente");
    const comum = { ...comParedes(parede("d", [7.5, 4.5], [7.5, 6])), ...base };
    expect(codigo(comum, "j1", alternar)).toBe("porta_inexistente");
    expect(codigo(comParedes(), "j1", alternar)).toBe("porta_inexistente");
    // o mestre alterna a secreta
    expect(aplicar(secreta, "m", alternar).estado.paredes[0]?.estado).toBe("aberta");
  });

  it("sem a capacidade porta.abrir o jogador não abre", () => {
    const e = {
      ...comParedes(porta("fechada")),
      tokens: [{ ...tokenBase(), x: 6.75, y: 5.25 }],
    };
    const sem = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "porta.abrir", valor: false }),
    ).estado;
    expect(codigo(sem, "j1", alternar)).toBe("sem_permissao");
  });

  it("alternarPortaDoJogador: alcance exato", () => {
    const p = porta("fechada");
    const token = (x: number) => [{ x, y: 5.25, cenaId: "c1" }];
    expect(alternarPortaDoJogador(p, token(6), 1.5).ok).toBe(true);
    expect(alternarPortaDoJogador(p, token(5.9), 1.5)).toEqual({ ok: false, motivo: "longe" });
  });
});

describe("editar paredes", () => {
  it("criar em lote, editar pontas, tipo e estado, apagar", () => {
    let e = criarEstado();
    const cria = aplicar(
      e,
      "m",
      intencao("parede.criar", {
        paredes: [
          { id: "a", a: ponto(1.5, 1.5), b: ponto(7.5, 1.5), tipo: "parede" },
          { id: "b", a: ponto(7.5, 1.5), b: ponto(7.5, 7.5), tipo: "porta" },
        ],
      }),
    );
    expect(cria.eventos).toHaveLength(2);
    e = cria.estado;
    expect(e.paredes.map((p) => p.id)).toEqual(["a", "b"]);
    expect(e.paredes[1]?.estado).toBe("fechada"); // porta sem estado nasce fechada
    expect(e.paredes[0]?.estado).toBeUndefined();

    e = aplicar(
      e,
      "m",
      intencao("parede.editar", { id: "a", b: ponto(9, 1.5), tipo: "janela" }),
    ).estado;
    expect(e.paredes[0]).toMatchObject({ b: ponto(9, 1.5), tipo: "janela" });
    e = aplicar(e, "m", intencao("parede.editar", { id: "b", estado: "trancada" })).estado;
    expect(e.paredes[1]?.estado).toBe("trancada");
    e = aplicar(e, "m", intencao("parede.editar", { id: "b", tipo: "parede" })).estado;
    expect(e.paredes[1]?.estado).toBeUndefined(); // perde o estado ao deixar de ser porta
    e = aplicar(e, "m", intencao("parede.apagar", { id: "a" })).estado;
    expect(e.paredes.map((p) => p.id)).toEqual(["b"]);
  });

  it("recusas: jogador, id repetido, sem comprimento, inexistente", () => {
    const e = comParedes(parede("a", [1, 1], [4, 1]));
    const nova = (id: string, a: [number, number], b: [number, number]) =>
      intencao("parede.criar", {
        paredes: [{ id, a: ponto(...a), b: ponto(...b), tipo: "parede" }],
      });
    expect(codigo(e, "j1", nova("x", [1, 1], [2, 2]))).toBe("sem_permissao");
    expect(codigo(e, "m", nova("a", [1, 1], [2, 2]))).toBe("dados_invalidos");
    expect(codigo(e, "m", nova("x", [3, 3], [3, 3]))).toBe("dados_invalidos");
    expect(codigo(e, "m", intencao("parede.editar", { id: "nao" }))).toBe("parede_inexistente");
    expect(codigo(e, "m", intencao("parede.apagar", { id: "nao" }))).toBe("parede_inexistente");
    expect(codigo(e, "j1", intencao("parede.apagar", { id: "a" }))).toBe("sem_permissao");
  });

  it("cena duplicada leva as paredes; cena apagada tira as dela", () => {
    const e = comParedes(parede("a", [1, 1], [4, 1]));
    const dup = aplicar(e, "m", intencao("cena.duplicar", { cenaId: "c1", novoId: "c3" }));
    expect(dup.estado.paredes.filter((p) => p.cenaId === "c3")).toHaveLength(1);
    const apaga = aplicar(dup.estado, "m", intencao("cena.apagar", { cenaId: "c3" }));
    expect(apaga.estado.paredes.every((p) => p.cenaId === "c1")).toBe(true);
  });

  it("o reducer aplica os eventos igual à sala", () => {
    const e = criarEstado();
    const r = aplicar(
      e,
      "m",
      intencao("parede.criar", {
        paredes: [{ id: "a", a: ponto(1, 1), b: ponto(4, 1), tipo: "parede" }],
      }),
    );
    expect(r.eventos.reduce(reduzir, e)).toEqual(r.estado);
  });
});

describe("iluminação dinâmica por cena", () => {
  it("vale ligada por padrão; o mestre liga e desliga; jogador não", () => {
    const e = criarEstado();
    expect(iluminacaoDinamicaLigada(cenaDe(e, "c1"))).toBe(true);
    const off = aplicar(e, "m", intencao("cena.configurarIluminacao", { dinamica: false }));
    expect(iluminacaoDinamicaLigada(cenaDe(off.estado, "c1"))).toBe(false);
    expect(iluminacaoDinamicaLigada(cenaDe(off.estado, "c2"))).toBe(true); // por cena
    expect(off.eventos[0]?.tipo).toBe("cena.editada");
    // o jogador recebe a mudança da cena ativa (é a visão dele)
    expect(
      eventoPara(off.eventos[0] as EventoSala, { id: "j1", papel: "jogador" }, e, off.estado),
    ).not.toBeNull();
    // não muda nada: nenhum evento
    expect(
      aplicar(e, "m", intencao("cena.configurarIluminacao", { dinamica: true })).eventos,
    ).toEqual([]);
    expect(codigo(e, "j1", intencao("cena.configurarIluminacao", { dinamica: false }))).toBe(
      "sem_permissao",
    );
    expect(
      codigo(e, "m", intencao("cena.configurarIluminacao", { cenaId: "nao", dinamica: false })),
    ).toBe("cena_inexistente");
  });
});

describe("visão do token", () => {
  it("o personagem manda; sem personagem vale o alcance do token; sem nada, sem limite", () => {
    const personagens = [{ id: "p", visao: { alcanceM: 9, visaoNoEscuroM: 0 } }];
    expect(alcanceDeVisao({ personagemId: "p" }, personagens)).toBe(9);
    expect(alcanceDeVisao({ alcanceVisaoM: 12 }, personagens)).toBe(12);
    expect(alcanceDeVisao({}, personagens)).toBeNull();
    expect(alcanceDeVisao({ personagemId: "p", alcanceVisaoM: 3 }, personagens)).toBe(9);
    expect(alcanceDeVisao({ personagemId: "sumiu", alcanceVisaoM: 3 }, personagens)).toBe(3);
  });

  it("o mestre edita o alcance do token (null tira o limite)", () => {
    const e = criarEstado();
    const com = aplicar(
      e,
      "m",
      intencao("token.editar", { id: "t1", mudancas: { alcanceVisaoM: 12 } }),
    );
    expect(com.estado.tokens[0]?.alcanceVisaoM).toBe(12);
    const sem = aplicar(
      com.estado,
      "m",
      intencao("token.editar", { id: "t1", mudancas: { alcanceVisaoM: null } }),
    );
    expect(sem.estado.tokens[0]?.alcanceVisaoM).toBeUndefined();
    expect(
      codigo(e, "j1", intencao("token.editar", { id: "t1", mudancas: { alcanceVisaoM: 3 } })),
    ).toBe("sem_permissao");
  });
});

describe("exportação v6", () => {
  it("leva as paredes e a iluminação dinâmica por cena e volta igual", () => {
    let e = comParedes(
      parede("a", [1, 1], [4, 1]),
      parede("d", [4, 1], [4, 4], "secreta", "trancada"),
    );
    e = aplicar(
      e,
      "m",
      intencao("cena.configurarIluminacao", { cenaId: "c2", dinamica: false }),
    ).estado;
    const x = criarExportacao(e, AGORA);
    expect(x.versao).toBe(9);
    expect(VERSAO_EXPORTACAO).toBe(9);
    expect(x.dados.paredes).toHaveLength(2);
    const volta = lerExportacao(JSON.parse(JSON.stringify(x)));
    expect(volta.ok).toBe(true);
    if (!volta.ok) return;
    expect(volta.exportacao.dados.paredes).toEqual(e.paredes);
    expect(volta.exportacao.dados.cenas.find((c) => c.id === "c2")?.iluminacaoDinamica).toBe(false);
    const importa = aplicar(
      criarEstado(),
      "m",
      intencao("campanha.importar", { dados: JSON.parse(JSON.stringify(x)) }),
    );
    expect(importa.estado.paredes).toEqual(e.paredes);
  });

  it("importa v1 a v5 (sem paredes) como v6", () => {
    const base = criarExportacao(criarEstado(), AGORA);
    const { paredes: _p, ...sem } = base.dados;
    const { personagens: _pe, pastas: _pa, ordemDeTurnoVisivel: _o, assets: _a, ...v2 } = sem;
    const { assets: _as, ...v2Puro } = { ...v2, assets: [] };
    const { cenas: _c, cenaAtivaId: _ca, tokens: _t, ...v1 } = v2Puro;
    const casos: [number, object][] = [
      [1, v1],
      [2, v2Puro],
      [3, { ...v2Puro, assets: [] }],
      [4, { ...v2Puro, assets: [], personagens: [] }],
      [5, sem],
    ];
    for (const [versao, dados] of casos) {
      const lida = lerExportacao({
        formato: "tabletop-campanha",
        versao,
        exportadoEm: AGORA,
        dados,
      });
      expect(lida.ok, `v${versao}`).toBe(true);
      if (!lida.ok) continue;
      expect(lida.exportacao.versao).toBe(9);
      expect(lida.exportacao.dados.paredes).toEqual([]);
    }
  });

  it("recusa parede em cena inexistente e ids repetidos", () => {
    const e = criarEstado();
    const x = criarExportacao(e, AGORA);
    const ruim = (paredes: Parede[]) => lerExportacao({ ...x, dados: { ...x.dados, paredes } }).ok;
    expect(ruim([{ ...parede("a", [1, 1], [2, 1]), cenaId: "nao" }])).toBe(false);
    expect(ruim([parede("a", [1, 1], [2, 1]), parede("a", [2, 1], [3, 1])])).toBe(false);
    expect(ruim([parede("a", [1, 1], [2, 1])])).toBe(true);
  });
});
