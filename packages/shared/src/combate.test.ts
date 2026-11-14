import { describe, expect, it } from "vitest";
import {
  CONDICOES,
  type Combate,
  criarExportacao,
  type EntradaDeCombate,
  type Estado,
  estadoInicial,
  eventoPara,
  fonteComSemente,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  ordenarEntradas,
  type Personagem,
  processar,
  proximoTurno,
  reduzir,
  type Token,
  TokenSchema,
  tirarEntrada,
  turnoAnterior,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const mestre = { id: "m", papel: "mestre" as const };
const j1 = { id: "j1", papel: "jogador" as const };
const j2 = { id: "j2", papel: "jogador" as const };

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object = {}): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });
}

function entrada(id: string, extra: Partial<EntradaDeCombate> = {}): EntradaDeCombate {
  return { id, nome: id, ...extra };
}

describe("ordenação da iniciativa", () => {
  it("maior primeiro; sem valor no fim, na ordem em que estavam", () => {
    const r = ordenarEntradas([
      entrada("a", { iniciativa: 5 }),
      entrada("sem1"),
      entrada("b", { iniciativa: 18 }),
      entrada("sem2"),
      entrada("c", { iniciativa: 12 }),
    ]);
    expect(r.map((e) => e.id)).toEqual(["b", "c", "a", "sem1", "sem2"]);
  });

  it("empate: maior Destreza; depois PJ antes de NPC; depois o nome; depois a posição de antes", () => {
    const r = ordenarEntradas([
      entrada("zeca", { iniciativa: 15, destreza: 10 }),
      entrada("goblin", { iniciativa: 15, destreza: 14 }),
      entrada("orc", { iniciativa: 15, destreza: 10 }),
      entrada("Brisa", { iniciativa: 15, destreza: 10, jogador: true }),
      entrada("Aldric", { iniciativa: 15, destreza: 10, jogador: true }),
      entrada("alto", { iniciativa: 20 }),
      entrada("dupla-1", { iniciativa: 3, destreza: 8 }),
      entrada("dupla-1b", { iniciativa: 3, destreza: 8, nome: "dupla-1" }),
    ]);
    expect(r.map((e) => e.id)).toEqual([
      "alto",
      "goblin", // Destreza 14 vence
      "Aldric", // Destreza igual: PJ antes de NPC, e Aldric antes de Brisa (nome)
      "Brisa",
      "orc", // os NPCs, pelo nome
      "zeca",
      "dupla-1", // nome igual: fica como estava
      "dupla-1b",
    ]);
  });

  it("sem Destreza conta como a menor", () => {
    const r = ordenarEntradas([
      entrada("sem", { iniciativa: 10 }),
      entrada("com", { iniciativa: 10, destreza: 1 }),
    ]);
    expect(r.map((e) => e.id)).toEqual(["com", "sem"]);
  });

  it("ordenar não muda a lista original", () => {
    const original = [entrada("a", { iniciativa: 1 }), entrada("b", { iniciativa: 2 })];
    ordenarEntradas(original);
    expect(original.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("turnos (puro)", () => {
  const base: Combate = {
    entradas: [entrada("a"), entrada("b"), entrada("c")],
    rodada: 0,
  };

  it("o primeiro Próximo abre a rodada 1 na primeira entrada; a última volta e soma a rodada", () => {
    let c = proximoTurno(base);
    expect(c).toMatchObject({ atualId: "a", rodada: 1 });
    c = proximoTurno(proximoTurno(c));
    expect(c).toMatchObject({ atualId: "c", rodada: 1 });
    c = proximoTurno(c);
    expect(c).toMatchObject({ atualId: "a", rodada: 2 });
  });

  it("Anterior volta, atravessa a rodada e para na rodada 1", () => {
    const rodada2: Combate = { ...base, atualId: "a", rodada: 2 };
    expect(turnoAnterior(rodada2)).toMatchObject({ atualId: "c", rodada: 1 });
    const rodada1: Combate = { ...base, atualId: "a", rodada: 1 };
    expect(turnoAnterior(rodada1)).toBe(rodada1);
    expect(turnoAnterior(base)).toBe(base);
  });

  it("sem entradas o Próximo não faz nada", () => {
    const vazio: Combate = { entradas: [], rodada: 0 };
    expect(proximoTurno(vazio)).toBe(vazio);
  });

  it("tirar a entrada da vez passa o turno; a última vira a rodada; a única esvazia", () => {
    const meio: Combate = { ...base, atualId: "b", rodada: 3 };
    expect(tirarEntrada(meio, "b")).toMatchObject({ atualId: "c", rodada: 3 });
    const fim: Combate = { ...base, atualId: "c", rodada: 3 };
    expect(tirarEntrada(fim, "c")).toMatchObject({ atualId: "a", rodada: 4 });
    const so: Combate = { entradas: [entrada("a")], atualId: "a", rodada: 2 };
    const vazio = tirarEntrada(so, "a");
    expect(vazio.atualId).toBeUndefined();
    expect(vazio.entradas).toEqual([]);
    // tirar quem não é a vez não mexe na vez
    expect(tirarEntrada(meio, "a")).toMatchObject({ atualId: "b", rodada: 3 });
  });
});

// ---------------------------------------------------------------------------------------------
// Combate dentro do `processar`: 3 PJs e 4 NPCs
// ---------------------------------------------------------------------------------------------

function pers(id: string, nome: string, donoId: string | null, des: number, bonus = 0): Personagem {
  return {
    id,
    pastaId: donoId === null ? "pasta-npcs" : "pasta-personagens",
    editores: { tipo: "jogadores", ids: donoId === null ? [] : [donoId] },
    nome,
    tokenPadrao: { cor: "#123456", tamanhoQuadrados: 1 },
    visao: { alcanceM: null, visaoNoEscuroM: 0 },
    ficha: {
      pvAtual: 10,
      pvMax: 10,
      atributos: { des },
      ...(bonus === 0 ? {} : { iniciativaBonus: bonus }),
    },
  };
}

function tok(
  id: string,
  nome: string,
  personagemId: string | undefined,
  extra: Partial<Token> = {},
): Token {
  return {
    id,
    cenaId: "cena-1",
    nome,
    cor: "#abc",
    tamanhoQuadrados: 1,
    x: 5.25,
    y: 5.25,
    camada: "tokens",
    oculto: false,
    controladoPor: [],
    ...(personagemId === undefined ? {} : { personagemId }),
    ...extra,
  };
}

/** 3 PJs (Aldric, Brisa, Cael), 4 NPCs: dois comuns, um oculto e um na camada do mestre. */
function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
      { id: "j3", nome: "J3", papel: "jogador", cor: "#555" },
    ],
    personagens: [
      pers("pa", "Aldric", "j1", 16, 2),
      pers("pb", "Brisa", "j2", 14),
      pers("pc", "Cael", "j3", 12),
      pers("pg", "Goblin A", null, 14),
    ],
    tokens: [
      tok("ta", "Aldric", "pa"),
      tok("tb", "Brisa", "pb"),
      tok("tc", "Cael", "pc"),
      tok("tg1", "Goblin A", "pg"),
      tok("tg2", "Goblin B", undefined),
      tok("tg3", "Emboscado", undefined, { oculto: true }),
      tok("tg4", "Marcador", undefined, { camada: "mestre" }),
    ],
  });
}

const TODOS = ["ta", "tb", "tc", "tg1", "tg2", "tg3", "tg4"];

function aplicar(
  estado: Estado,
  quem: string,
  tipo: Intencao["tipo"],
  dados: object = {},
  semente = 7,
) {
  const r = processar(estado, quem, intencao(tipo, dados), AGORA, fonteComSemente(semente));
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} ${r.erro.mensagem}`);
  return r;
}

function recusa(
  estado: Estado,
  quem: string,
  tipo: Intencao["tipo"],
  dados: object = {},
): string | null {
  // O schema barra a mensagem malformada antes de chegar ao núcleo (a sala responde `mensagem_invalida`).
  const lida = IntencaoSchema.safeParse({ v: 1, id: "p", tipo, dados });
  if (!lida.success) return "mensagem_invalida";
  const r = processar(estado, quem, lida.data, AGORA, fonteComSemente(7));
  return r.ok ? null : r.erro.codigo;
}

function comCombate(): Estado {
  return aplicar(criarEstado(), "m", "combate.adicionar", {
    entradas: TODOS.map((t) => ({ id: `e-${t}`, tokenId: t })),
  }).estado;
}

describe("um combate inteiro (3 PJs e 4 NPCs)", () => {
  it("adicionar, rolar para todos, ordenar, avançar, virar a rodada, voltar, tirar a vez e encerrar", () => {
    let estado = criarEstado();

    // adicionar tokens: o nome e a Destreza vêm do token e da ficha
    let r = aplicar(estado, "m", "combate.adicionar", {
      entradas: TODOS.map((t) => ({ id: `e-${t}`, tokenId: t })),
    });
    estado = r.estado;
    expect(estado.combate?.entradas).toHaveLength(7);
    expect(estado.combate?.rodada).toBe(0);
    expect(estado.combate?.atualId).toBeUndefined();
    expect(estado.combate?.entradas.find((e) => e.id === "e-ta")).toMatchObject({
      nome: "Aldric",
      destreza: 16,
      jogador: true,
    });
    expect(estado.combate?.entradas.find((e) => e.id === "e-tg2")?.destreza).toBeUndefined();
    // o mesmo token não entra duas vezes
    r = aplicar(estado, "m", "combate.adicionar", { entradas: [{ id: "outra", tokenId: "ta" }] });
    expect(r.estado.combate?.entradas).toHaveLength(7);
    expect(r.eventos).toHaveLength(0);

    // rolar para todos: uma mensagem por entrada; PJ pública, NPC oculta
    r = aplicar(estado, "m", "combate.rolar", {});
    estado = r.estado;
    const mensagens = r.eventos.flatMap((e) =>
      e.tipo === "chat.mensagem" ? [e.dados.mensagem] : [],
    );
    expect(mensagens).toHaveLength(7);
    expect(new Set(mensagens.map((m) => m.id)).size).toBe(7);
    for (const m of mensagens) {
      const pj =
        m.como?.personagemId !== undefined && ["pa", "pb", "pc"].includes(m.como.personagemId);
      expect(m.tipo).toBe("modelo");
      expect(m.modelo?.modelo).toBe("teste");
      if (pj) expect(m.visivelPara).toBe("todos");
      else {
        expect(m.visivelPara).toEqual({ ids: [] });
        expect(m.oculta).toBe(true);
      }
    }
    expect(mensagens.filter((m) => m.oculta)).toHaveLength(4);

    const lista = estado.combate?.entradas ?? [];
    expect(lista.every((e) => e.iniciativa !== undefined)).toBe(true);
    const valores = lista.map((e) => e.iniciativa ?? 0);
    expect(valores).toEqual([...valores].sort((a, b) => b - a));
    // o bônus de iniciativa da ficha entra: Aldric (Des 16 = +3, bônus +2) rola d20+5
    const aldric = mensagens.find((m) => m.como?.nome === "Aldric");
    expect(aldric?.modelo?.modelo === "teste" && aldric.modelo.rolagem.termos.at(-1)).toMatchObject(
      {
        tipo: "constante",
        valor: 5,
      },
    );

    // reordenar pelos valores é estável
    r = aplicar(estado, "m", "combate.ordenar");
    expect(r.estado.combate?.entradas.map((e) => e.id)).toEqual(lista.map((e) => e.id));

    // editar um valor reordena
    r = aplicar(estado, "m", "combate.editar", { id: lista[6]?.id, mudancas: { iniciativa: 99 } });
    estado = r.estado;
    expect(estado.combate?.entradas[0]?.id).toBe(lista[6]?.id);
    const ordem = estado.combate?.entradas.map((e) => e.id) ?? [];

    // avançar: o primeiro Próximo abre a rodada 1
    estado = aplicar(estado, "m", "combate.proximo").estado;
    expect(estado.combate).toMatchObject({ atualId: ordem[0], rodada: 1 });
    for (let i = 1; i < 7; i++) {
      estado = aplicar(estado, "m", "combate.proximo").estado;
      expect(estado.combate).toMatchObject({ atualId: ordem[i], rodada: 1 });
    }
    // virar a rodada
    estado = aplicar(estado, "m", "combate.proximo").estado;
    expect(estado.combate).toMatchObject({ atualId: ordem[0], rodada: 2 });
    // voltar
    estado = aplicar(estado, "m", "combate.anterior").estado;
    expect(estado.combate).toMatchObject({ atualId: ordem[6], rodada: 1 });
    estado = aplicar(estado, "m", "combate.proximo").estado;
    estado = aplicar(estado, "m", "combate.proximo").estado;
    expect(estado.combate).toMatchObject({ atualId: ordem[1], rodada: 2 });

    // tirar uma entrada que é a vez: o turno passa para a seguinte
    estado = aplicar(estado, "m", "combate.tirar", { id: ordem[1] }).estado;
    expect(estado.combate?.entradas).toHaveLength(6);
    expect(estado.combate).toMatchObject({ atualId: ordem[2], rodada: 2 });

    // apagar o token tira a entrada dele
    const tokenDaVez = estado.combate?.entradas.find((e) => e.id === ordem[2])?.tokenId;
    estado = aplicar(estado, "m", "token.apagar", { id: tokenDaVez }).estado;
    expect(estado.combate?.entradas.some((e) => e.tokenId === tokenDaVez)).toBe(false);
    expect(estado.combate?.atualId).toBe(ordem[3]);

    // encerrar limpa tudo
    estado = aplicar(estado, "m", "combate.encerrar").estado;
    expect(estado.combate).toBeUndefined();
  });

  it('entrada solta ("Covil, 20"), editar nome e sigilo, mover à mão e Ordenar', () => {
    let estado = aplicar(comCombate(), "m", "combate.rolar", {}).estado;
    estado = aplicar(estado, "m", "combate.adicionar", {
      entradas: [{ id: "covil", nome: "Covil", iniciativa: 100 }],
    }).estado;
    expect(estado.combate?.entradas[0]).toMatchObject({
      id: "covil",
      nome: "Covil",
      iniciativa: 100,
    });
    expect(recusa(estado, "m", "combate.adicionar", { entradas: [{ id: "x" }] })).toBe(
      "mensagem_invalida",
    );
    estado = aplicar(estado, "m", "combate.mover", { id: "covil", indice: 3 }).estado;
    expect(estado.combate?.entradas.findIndex((e) => e.id === "covil")).toBe(3);
    estado = aplicar(estado, "m", "combate.ordenar").estado;
    expect(estado.combate?.entradas[0]?.id).toBe("covil");
    estado = aplicar(estado, "m", "combate.editar", {
      id: "covil",
      mudancas: { nome: "Covil do dragão", valorOculto: true },
    }).estado;
    expect(estado.combate?.entradas[0]).toMatchObject({
      nome: "Covil do dragão",
      valorOculto: true,
    });
    // tirar o valor: a entrada vai para o fim
    estado = aplicar(estado, "m", "combate.editar", {
      id: "covil",
      mudancas: { iniciativa: null },
    }).estado;
    expect(estado.combate?.entradas.at(-1)?.id).toBe("covil");
  });

  it("rolar de novo só as entradas pedidas; rolar para todos pula quem já tem valor", () => {
    let estado = comCombate();
    estado = aplicar(estado, "m", "combate.rolar", { ids: ["e-tg1"] }).estado;
    expect(estado.combate?.entradas.filter((e) => e.iniciativa !== undefined)).toHaveLength(1);
    const r = aplicar(estado, "m", "combate.rolar", {});
    const msgs = r.eventos.filter((e) => e.tipo === "chat.mensagem");
    expect(msgs).toHaveLength(6);
  });

  it("é determinístico: a sala rola, o cliente não manda resultado", () => {
    const a = aplicar(comCombate(), "m", "combate.rolar", {}, 3).estado.combate;
    const b = aplicar(comCombate(), "m", "combate.rolar", {}, 3).estado.combate;
    expect(a).toEqual(b);
  });
});

describe("combate: permissões", () => {
  it("o jogador não gerencia nada", () => {
    const estado = comCombate();
    expect(recusa(estado, "j1", "combate.adicionar", { entradas: [{ id: "x", nome: "x" }] })).toBe(
      "sem_permissao",
    );
    for (const tipo of [
      "combate.tirar",
      "combate.editar",
      "combate.mover",
      "combate.ordenar",
      "combate.proximo",
      "combate.anterior",
      "combate.encerrar",
    ] as const) {
      const dados =
        tipo === "combate.tirar"
          ? { id: "e-ta" }
          : tipo === "combate.editar"
            ? { id: "e-ta", mudancas: { iniciativa: 99 } }
            : tipo === "combate.mover"
              ? { id: "e-ta", indice: 0 }
              : {};
      expect(recusa(estado, "j1", tipo, dados)).toBe("sem_permissao");
    }
    // nem com permissão por usuário: `combate.gerir` não é delegável
    const delegado = {
      ...estado,
      permissoes: { ...estado.permissoes, porUsuario: { j1: { "luz.apagar": true } } },
    };
    expect(recusa(delegado, "j1", "combate.proximo")).toBe("sem_permissao");
  });

  it("o jogador rola só a própria iniciativa, e só uma vez", () => {
    let estado = comCombate();
    // sem ids, ou a entrada de outro, ou de NPC: recusado
    expect(recusa(estado, "j1", "combate.rolar", {})).toBe("sem_permissao");
    expect(recusa(estado, "j1", "combate.rolar", { ids: ["e-tb"] })).toBe("sem_permissao");
    expect(recusa(estado, "j1", "combate.rolar", { ids: ["e-tg1"] })).toBe("sem_permissao");
    // entrada que ele não vê responde como inexistente
    expect(recusa(estado, "j1", "combate.rolar", { ids: ["e-tg3"] })).toBe("dados_invalidos");
    expect(recusa(estado, "j1", "combate.rolar", { ids: ["e-tg4"] })).toBe("dados_invalidos");
    const r = aplicar(estado, "j1", "combate.rolar", { ids: ["e-ta"] });
    estado = r.estado;
    expect(estado.combate?.entradas.find((e) => e.id === "e-ta")?.iniciativa).toBeDefined();
    expect(estado.combate?.entradas.filter((e) => e.iniciativa !== undefined)).toHaveLength(1);
    const msg = r.eventos.find((e) => e.tipo === "chat.mensagem");
    expect(msg?.tipo === "chat.mensagem" && msg.dados.mensagem.visivelPara).toBe("todos");
    // de novo: recusado (o mestre muda o valor se for o caso)
    expect(recusa(estado, "j1", "combate.rolar", { ids: ["e-ta"] })).toBe("dados_invalidos");
  });

  it("só passa o turno quem edita o personagem da vez (ou o mestre)", () => {
    let estado = aplicar(comCombate(), "m", "combate.rolar", {}).estado;
    estado = aplicar(estado, "m", "combate.proximo").estado;
    const vez = estado.combate?.entradas.find((e) => e.id === estado.combate?.atualId);
    expect(vez).toBeDefined();
    // leva o turno até a Brisa (j2)
    while (
      estado.combate?.entradas.find((e) => e.id === estado.combate?.atualId)?.nome !== "Brisa"
    ) {
      estado = aplicar(estado, "m", "combate.proximo").estado;
    }
    expect(recusa(estado, "j1", "combate.passar")).toBe("sem_permissao");
    expect(recusa(estado, "m", "combate.passar")).toBeNull();
    const r = aplicar(estado, "j2", "combate.passar");
    expect(r.estado.combate?.atualId).not.toBe(estado.combate?.atualId);
    // a vez de NPC: nenhum jogador passa
    let npc = r.estado;
    while (npc.combate?.entradas.find((e) => e.id === npc.combate?.atualId)?.jogador === true) {
      npc = aplicar(npc, "m", "combate.proximo").estado;
    }
    expect(recusa(npc, "j1", "combate.passar")).toBe("sem_permissao");
    expect(recusa(npc, "j2", "combate.passar")).toBe("sem_permissao");
    // sem combate em andamento
    expect(recusa(comCombate(), "j1", "combate.passar")).toBe("sem_permissao");
  });

  it("condições e concentração: o mestre, ou quem edita o personagem do token", () => {
    const estado = criarEstado();
    const dados = { id: "ta", condicoes: ["caido", "cego"], exaustao: 2, concentracao: "Bênção" };
    expect(recusa(estado, "j2", "token.condicoes", dados)).toBe("sem_permissao");
    expect(recusa(estado, "j1", "token.condicoes", { ...dados, id: "tg1" })).toBe("sem_permissao");
    // token oculto responde como inexistente
    expect(recusa(estado, "j1", "token.condicoes", { ...dados, id: "tg3" })).toBe(
      "token_inexistente",
    );
    const r = aplicar(estado, "j1", "token.condicoes", dados);
    expect(r.estado.tokens.find((t) => t.id === "ta")).toMatchObject({
      condicoes: ["caido", "cego"],
      exaustao: 2,
      concentracao: "Bênção",
    });
    expect(r.eventos.map((e) => e.tipo)).toEqual(["token.editado"]);
    // o mestre mexe em qualquer um; tirar tudo remove os campos
    let e2 = aplicar(r.estado, "m", "token.condicoes", {
      id: "tg1",
      condicoes: ["envenenado"],
    }).estado;
    e2 = aplicar(e2, "j1", "token.condicoes", {
      id: "ta",
      condicoes: [],
      exaustao: 0,
      concentracao: null,
    }).estado;
    const ta = e2.tokens.find((t) => t.id === "ta");
    expect(ta?.condicoes).toBeUndefined();
    expect(ta?.exaustao).toBeUndefined();
    expect(ta?.concentracao).toBeUndefined();
    // sem mudança: sem evento; condição repetida vira uma só; condição desconhecida é recusada
    expect(aplicar(e2, "j1", "token.condicoes", { id: "ta", condicoes: [] }).eventos).toHaveLength(
      0,
    );
    expect(
      aplicar(estado, "m", "token.condicoes", { id: "ta", condicoes: ["cego", "cego"] }).estado
        .tokens[0]?.condicoes,
    ).toEqual(["cego"]);
    expect(recusa(estado, "m", "token.condicoes", { id: "ta", condicoes: ["encantado"] })).toBe(
      "mensagem_invalida",
    );
    expect(CONDICOES).toHaveLength(14);
  });

  it("N1: a marca de morto é do mestre e de quem controla o token; tirar apaga o campo", () => {
    const estado = criarEstado();
    expect(recusa(estado, "j2", "token.condicoes", { id: "ta", morto: true })).toBe(
      "sem_permissao",
    );
    const morto = aplicar(estado, "j1", "token.condicoes", { id: "ta", morto: true });
    expect(morto.estado.tokens.find((t) => t.id === "ta")?.morto).toBe(true);
    // marcar de novo não emite nada; as condições continuam como estavam
    expect(
      aplicar(morto.estado, "m", "token.condicoes", { id: "ta", morto: true }).eventos,
    ).toHaveLength(0);
    const vivo = aplicar(morto.estado, "m", "token.condicoes", { id: "ta", morto: false });
    expect(vivo.estado.tokens.find((t) => t.id === "ta")).not.toHaveProperty("morto");
    // token sem o campo (mesa antiga) continua válido
    expect(TokenSchema.safeParse({ ...estado.tokens[0], morto: undefined }).success).toBe(true);
  });

  it("o token entregue a um jogador (controladoPor, como um familiar) também é dele: rola, passa e marca", () => {
    // Goblin B (tg2, sem personagem) passa a ser controlado pelo j1.
    const base = criarEstado();
    const estado: Estado = {
      ...base,
      tokens: base.tokens.map((t) => (t.id === "tg2" ? { ...t, controladoPor: ["j1"] } : t)),
    };
    let e = aplicar(estado, "m", "combate.adicionar", {
      entradas: [
        { id: "e-ta", tokenId: "ta" },
        { id: "e-tg2", tokenId: "tg2" },
      ],
    }).estado;
    expect(recusa(e, "j2", "combate.rolar", { ids: ["e-tg2"] })).toBe("sem_permissao");
    e = aplicar(e, "j1", "combate.rolar", { ids: ["e-tg2"] }).estado;
    expect(e.combate?.entradas.find((x) => x.id === "e-tg2")?.iniciativa).toBeTypeOf("number");
    e = aplicar(e, "m", "combate.editar", { id: "e-tg2", mudancas: { iniciativa: 30 } }).estado;
    e = aplicar(e, "m", "combate.proximo").estado;
    expect(e.combate?.atualId).toBe("e-tg2");
    expect(recusa(e, "j2", "combate.passar")).toBe("sem_permissao");
    expect(aplicar(e, "j1", "combate.passar").estado.combate?.atualId).toBe("e-ta");
    const r = aplicar(e, "j1", "token.condicoes", { id: "tg2", condicoes: ["caido"] });
    expect(r.estado.tokens.find((t) => t.id === "tg2")?.condicoes).toEqual(["caido"]);
    expect(recusa(e, "j2", "token.condicoes", { id: "tg2", condicoes: ["caido"] })).toBe(
      "sem_permissao",
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Sigilo
// ---------------------------------------------------------------------------------------------

describe("combate: sigilo", () => {
  it("a visão do jogador não traz entrada de token oculto, da camada do mestre nem solta oculta", () => {
    let estado = aplicar(comCombate(), "m", "combate.adicionar", {
      entradas: [
        { id: "solta-publica", nome: "Covil", iniciativa: 20 },
        { id: "solta-oculta", nome: "Armadilha secreta", iniciativa: 17, oculta: true },
      ],
    }).estado;
    estado = aplicar(estado, "m", "combate.rolar", {}).estado;
    const visao = visaoPara(estado, j1).combate;
    const nomes = visao?.entradas.map((e) => e.nome) ?? [];
    expect(nomes).toContain("Aldric");
    expect(nomes).toContain("Goblin B");
    expect(nomes).toContain("Covil");
    expect(nomes).not.toContain("Emboscado");
    expect(nomes).not.toContain("Marcador");
    expect(nomes).not.toContain("Armadilha secreta");
    expect(
      visao?.entradas.some((e) => e.id === "e-tg3" || e.id === "e-tg4" || e.id === "solta-oculta"),
    ).toBe(false);
    // o mestre vê tudo
    expect(visaoPara(estado, mestre).combate?.entradas).toHaveLength(9);
    // a Destreza e a marca `oculta` nunca viajam
    const json = JSON.stringify(visao);
    expect(json).not.toContain("destreza");
    expect(json).not.toContain("oculta");
    expect(json).not.toContain("Armadilha");
    expect(json).not.toContain("Emboscado");
  });

  it("valorOculto mostra o nome sem o número", () => {
    let estado = aplicar(comCombate(), "m", "combate.rolar", {}).estado;
    const alvo = estado.combate?.entradas.find((e) => e.id === "e-tg1");
    estado = aplicar(estado, "m", "combate.editar", {
      id: "e-tg1",
      mudancas: { valorOculto: true },
    }).estado;
    const visto = visaoPara(estado, j1).combate?.entradas.find((e) => e.id === "e-tg1");
    expect(visto).toEqual({ id: "e-tg1", tokenId: "tg1", nome: "Goblin A", valorOculto: true });
    expect(visto && "iniciativa" in visto).toBe(false);
    expect(alvo?.iniciativa).toBeDefined();
    // o mestre continua vendo o número
    expect(
      visaoPara(estado, mestre).combate?.entradas.find((e) => e.id === "e-tg1")?.iniciativa,
    ).toBe(alvo?.iniciativa);
  });

  it("a vez de uma entrada que o jogador não vê não destaca ninguém para ele; a rodada chega", () => {
    let estado = comCombate();
    estado = aplicar(estado, "m", "combate.editar", {
      id: "e-tg3",
      mudancas: { iniciativa: 50 },
    }).estado;
    estado = aplicar(estado, "m", "combate.proximo").estado;
    expect(estado.combate).toMatchObject({ atualId: "e-tg3", rodada: 1 });
    const visao = visaoPara(estado, j1).combate;
    expect(visao?.atualId).toBeUndefined();
    expect(visao?.rodada).toBe(1);
    expect(visaoPara(estado, mestre).combate?.atualId).toBe("e-tg3");
  });

  it("eventos: o que o jogador não vê não chega; o que muda o que ele vê chega filtrado", () => {
    const antes = comCombate();
    const r = aplicar(antes, "m", "combate.rolar", {});
    const evento = r.eventos.find((e) => e.tipo === "combate.alterado");
    if (!evento) throw new Error("sem evento");
    const visto = eventoPara(evento, j1, antes, r.estado);
    if (visto?.tipo !== "combate.alterado") throw new Error("o jogador devia receber");
    const nomes = visto.dados.combate?.entradas.map((e) => e.nome) ?? [];
    expect(nomes).not.toContain("Emboscado");
    expect(nomes).not.toContain("Marcador");
    expect(JSON.stringify(visto)).not.toContain("destreza");
    // o mestre recebe o evento inteiro
    expect(eventoPara(evento, mestre, antes, r.estado)).toBe(evento);

    // mudança só numa entrada oculta (valor): nada chega ao jogador
    const r2 = aplicar(r.estado, "m", "combate.editar", {
      id: "e-tg3",
      mudancas: { iniciativa: 1 },
    });
    const ev2 = r2.eventos[0];
    if (!ev2) throw new Error("sem evento");
    expect(eventoPara(ev2, j1, r.estado, r2.estado)).toBeNull();
    // mudar o valor de uma entrada visível chega
    const r3 = aplicar(r.estado, "m", "combate.editar", {
      id: "e-tg2",
      mudancas: { iniciativa: 1 },
    });
    const ev3 = r3.eventos[0];
    if (!ev3) throw new Error("sem evento");
    expect(eventoPara(ev3, j1, r.estado, r3.estado)).not.toBeNull();
    // encerrar chega com null
    const r4 = aplicar(r.estado, "m", "combate.encerrar");
    const ev4 = r4.eventos[0];
    if (!ev4) throw new Error("sem evento");
    expect(eventoPara(ev4, j1, r.estado, r4.estado)).toMatchObject({ dados: { combate: null } });
    // o cliente aplica o evento filtrado e fica igual à visão
    const aplicado = reduzir(visaoPara(antes, j1), visto);
    expect(aplicado.combate).toEqual(visaoPara(r.estado, j1).combate);
  });

  it("a rolagem de NPC é oculta: o jogador não recebe a mensagem; a de PJ é pública", () => {
    const antes = comCombate();
    const r = aplicar(antes, "m", "combate.rolar", {});
    const msgs = r.eventos.filter((e) => e.tipo === "chat.mensagem");
    const paraJogador = msgs.filter((e) => eventoPara(e, j2, antes, r.estado) !== null);
    // só as três dos PJs
    expect(paraJogador).toHaveLength(3);
    for (const e of paraJogador) {
      expect(e.tipo === "chat.mensagem" && ["Aldric", "Brisa", "Cael"]).toContain(
        e.tipo === "chat.mensagem" ? e.dados.mensagem.como?.nome : "",
      );
    }
    expect(msgs.filter((e) => eventoPara(e, mestre, antes, r.estado) !== null)).toHaveLength(7);
  });

  it("esconder o token que está na ordem manda snapshot novo; mostrar de novo devolve a entrada", () => {
    const estado = comCombate();
    const r = aplicar(estado, "m", "token.editar", { id: "tg2", mudancas: { oculto: true } });
    expect(r.snapshotPara).toBe("todos");
    expect(visaoPara(r.estado, j1).combate?.entradas.some((e) => e.id === "e-tg2")).toBe(false);
    const r2 = aplicar(r.estado, "m", "token.editar", { id: "tg2", mudancas: { oculto: false } });
    expect(r2.snapshotPara).toBe("todos");
    expect(visaoPara(r2.estado, j1).combate?.entradas.some((e) => e.id === "e-tg2")).toBe(true);
    // token sem entrada: nada de snapshot
    const sem = aplicar(criarEstado(), "m", "token.editar", {
      id: "tg2",
      mudancas: { oculto: true },
    });
    expect(sem.snapshotPara).toEqual([]);
  });

  it("apagar o personagem ou a cena tira as entradas dos tokens", () => {
    const estado = comCombate();
    const semPersonagem = aplicar(estado, "m", "personagem.apagar", { id: "pg" }).estado;
    expect(semPersonagem.combate?.entradas.some((e) => e.tokenId === "tg1")).toBe(false);
    expect(semPersonagem.combate?.entradas).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------------------------

describe("combate: exportação (v10 em diante)", () => {
  it("a ordem de turno, as condições e a concentração fazem a viagem de ida e volta", () => {
    let estado = aplicar(comCombate(), "m", "combate.rolar", {}).estado;
    estado = aplicar(estado, "m", "combate.proximo").estado;
    estado = aplicar(estado, "j1", "token.condicoes", {
      id: "ta",
      condicoes: ["caido"],
      exaustao: 2,
      concentracao: "Bênção",
    }).estado;
    const exportacao = criarExportacao(estado, AGORA);
    expect(exportacao.versao).toBe(13);
    const lida = lerExportacao(JSON.parse(JSON.stringify(exportacao)));
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.dados.combate).toEqual(estado.combate);
    expect(lida.exportacao.dados.tokens.find((t) => t.id === "ta")).toMatchObject({
      condicoes: ["caido"],
      exaustao: 2,
      concentracao: "Bênção",
    });
    // importar põe o combate no estado
    const r = aplicar(estado, "m", "campanha.importar", {
      dados: JSON.parse(JSON.stringify(exportacao)),
    });
    expect(r.estado.combate).toEqual(estado.combate);
  });

  it("uma exportação v9 (sem combate) continua importando", () => {
    const v10 = JSON.parse(JSON.stringify(criarExportacao(criarEstado(), AGORA)));
    v10.versao = 9;
    v10.dados.combate = undefined;
    const lida = lerExportacao(v10);
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.versao).toBe(13);
    expect(lida.exportacao.dados.combate).toBeUndefined();
  });

  it("recusa combate com a vez numa entrada inexistente ou token desconhecido", () => {
    const base = JSON.parse(JSON.stringify(criarExportacao(comCombate(), AGORA)));
    expect(
      lerExportacao({
        ...base,
        dados: { ...base.dados, combate: { ...base.dados.combate, atualId: "fantasma" } },
      }).ok,
    ).toBe(false);
    const ruim = {
      ...base.dados.combate,
      entradas: [{ id: "x", tokenId: "nao-existe", nome: "x" }],
    };
    expect(lerExportacao({ ...base, dados: { ...base.dados, combate: ruim } }).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// V2: ordem de turno simples (entrar pela ficha, rodada à mão, dar a vez)
// ---------------------------------------------------------------------------------------------

describe("V2: combate.entrar", () => {
  const aberta = () =>
    aplicar(criarEstado(), "m", "ordemDeTurno.definir", { visivel: true }).estado;

  it("com a ordem aberta, o jogador entra com o token que controla: a sala rola 1d20 + a ficha e manda ao chat", () => {
    const r = aplicar(aberta(), "j1", "combate.entrar", { tokenId: "ta" });
    const e = r.estado.combate?.entradas.find((x) => x.tokenId === "ta");
    expect(e).toMatchObject({ nome: "Aldric", jogador: true, destreza: 16 });
    // d20 + 2 da ficha do Aldric
    expect(e?.iniciativa).toBeGreaterThanOrEqual(3);
    expect(e?.iniciativa).toBeLessThanOrEqual(22);
    const msg = r.eventos.find((x) => x.tipo === "chat.mensagem");
    expect(msg?.tipo === "chat.mensagem" && msg.dados.mensagem.visivelPara).toBe("todos");
    expect(msg?.tipo === "chat.mensagem" && msg.dados.mensagem.como?.nome).toBe("Aldric");
    // o número da lista é o mesmo da rolagem do chat
    const modelo = msg?.tipo === "chat.mensagem" ? msg.dados.mensagem.modelo : undefined;
    const total = modelo?.modelo === "teste" ? modelo.rolagem.total : null;
    expect(e?.iniciativa).toBe(total);
  });

  it("é determinístico e o jogador não manda o número (campo extra é descartado)", () => {
    const a = aplicar(aberta(), "j1", "combate.entrar", { tokenId: "ta" }, 3).estado;
    const b = aplicar(aberta(), "j1", "combate.entrar", { tokenId: "ta" }, 3).estado;
    expect(a.combate?.entradas[0]?.iniciativa).toBe(b.combate?.entradas[0]?.iniciativa);
    const lida = IntencaoSchema.safeParse({
      v: 1,
      id: "p",
      tipo: "combate.entrar",
      dados: { tokenId: "ta", iniciativa: 99 },
    });
    expect(lida.success && "iniciativa" in lida.data.dados).toBe(false);
  });

  it("recusa com a ordem fechada, token alheio, token invisível, de outra cena e repetido", () => {
    expect(recusa(criarEstado(), "j1", "combate.entrar", { tokenId: "ta" })).toBe(
      "dados_invalidos",
    );
    const e = aberta();
    expect(recusa(e, "j1", "combate.entrar", { tokenId: "tb" })).toBe("sem_permissao");
    expect(recusa(e, "j1", "combate.entrar", { tokenId: "tg1" })).toBe("sem_permissao");
    // oculto e camada do mestre respondem como inexistentes para o jogador
    expect(recusa(e, "j1", "combate.entrar", { tokenId: "tg3" })).toBe("token_inexistente");
    expect(recusa(e, "j1", "combate.entrar", { tokenId: "tg4" })).toBe("token_inexistente");
    expect(recusa(e, "j1", "combate.entrar", { tokenId: "nao-existe" })).toBe("token_inexistente");
    const outraCena: Estado = {
      ...e,
      tokens: e.tokens.map((t) => (t.id === "ta" ? { ...t, cenaId: "cena-2" } : t)),
    };
    expect(recusa(outraCena, "m", "combate.entrar", { tokenId: "ta" })).not.toBeNull();
    // repetido: não entra de novo nem rola outra vez
    const dentro = aplicar(e, "j1", "combate.entrar", { tokenId: "ta" });
    const mensagens = dentro.estado.chat?.length ?? 0;
    expect(recusa(dentro.estado, "j1", "combate.entrar", { tokenId: "ta" })).toBe(
      "dados_invalidos",
    );
    expect(recusa(dentro.estado, "m", "combate.entrar", { tokenId: "ta" })).toBe("dados_invalidos");
    expect(dentro.estado.chat?.length ?? 0).toBe(mensagens);
  });

  it("o mestre entra com qualquer token; a rolagem de NPC é oculta e o oculto não chega ao jogador", () => {
    const antes = aberta();
    const r = aplicar(antes, "m", "combate.entrar", { tokenId: "tg1" });
    const msg = r.eventos.find((x) => x.tipo === "chat.mensagem");
    expect(msg && eventoPara(msg, j1, antes, r.estado)).toBeNull();
    expect(r.estado.combate?.entradas[0]).toMatchObject({ nome: "Goblin A" });
    const oculto = aplicar(r.estado, "m", "combate.entrar", { tokenId: "tg3" }).estado;
    expect(visaoPara(oculto, j1).combate?.entradas.map((x) => x.nome)).toEqual(["Goblin A"]);
  });

  it("o token entregue a um jogador (controladoPor) também entra", () => {
    const e = aberta();
    const dele: Estado = {
      ...e,
      tokens: e.tokens.map((t) => (t.id === "tg2" ? { ...t, controladoPor: ["j2"] } : t)),
    };
    const r = aplicar(dele, "j2", "combate.entrar", { tokenId: "tg2" });
    expect(r.estado.combate?.entradas[0]).toMatchObject({ nome: "Goblin B" });
  });

  it("o token que vai para a camada do mestre some da lista do jogador", () => {
    const e = aplicar(aberta(), "j1", "combate.entrar", { tokenId: "ta" }).estado;
    expect(visaoPara(e, j2).combate?.entradas).toHaveLength(1);
    const r = aplicar(e, "m", "token.editar", { id: "ta", mudancas: { camada: "mestre" } });
    expect(r.snapshotPara).toBe("todos");
    expect(visaoPara(r.estado, j2).combate?.entradas).toHaveLength(0);
    expect(visaoPara(r.estado, mestre).combate?.entradas).toHaveLength(1);
  });
});

describe("V2: rodada, dar a vez, limpar e fechar", () => {
  it("o mestre escreve a rodada; 0 volta a 'não começou' e tira a vez; o jogador não escreve", () => {
    let e = comCombate();
    e = aplicar(e, "m", "combate.rodada", { rodada: 5 }).estado;
    expect(e.combate?.rodada).toBe(5);
    e = aplicar(e, "m", "combate.proximo").estado;
    expect(e.combate?.rodada).toBe(5);
    expect(e.combate?.atualId).toBeDefined();
    e = aplicar(e, "m", "combate.rodada", { rodada: 0 }).estado;
    expect(e.combate?.rodada).toBe(0);
    expect(e.combate?.atualId).toBeUndefined();
    expect(recusa(e, "j1", "combate.rodada", { rodada: 2 })).toBe("sem_permissao");
    expect(recusa(e, "m", "combate.rodada", { rodada: -1 })).toBe("mensagem_invalida");
    expect(recusa(e, "m", "combate.rodada", { rodada: 10000 })).toBe("mensagem_invalida");
    const novo = aplicar(criarEstado(), "m", "combate.rodada", { rodada: 3 }).estado;
    expect(novo.combate).toMatchObject({ entradas: [], rodada: 3 });
  });

  it("a rodada chega ao jogador", () => {
    const e = aplicar(comCombate(), "m", "combate.rodada", { rodada: 4 }).estado;
    expect(visaoPara(e, j1).combate?.rodada).toBe(4);
  });

  it("dar a vez: a rodada continua (ou abre a 1); entrada inexistente e jogador recusados", () => {
    let e = comCombate();
    e = aplicar(e, "m", "combate.darVez", { id: "e-tb" }).estado;
    expect(e.combate).toMatchObject({ atualId: "e-tb", rodada: 1 });
    e = aplicar(e, "m", "combate.rodada", { rodada: 3 }).estado;
    e = aplicar(e, "m", "combate.darVez", { id: "e-tc" }).estado;
    expect(e.combate).toMatchObject({ atualId: "e-tc", rodada: 3 });
    expect(recusa(e, "m", "combate.darVez", { id: "nada" })).toBe("dados_invalidos");
    expect(recusa(e, "j1", "combate.darVez", { id: "e-ta" })).toBe("sem_permissao");
  });

  it("Limpar zera a lista e a rodada e não fecha a janela (a ordem continua aberta)", () => {
    let e = aplicar(comCombate(), "m", "ordemDeTurno.definir", { visivel: true }).estado;
    e = aplicar(e, "m", "combate.rodada", { rodada: 3 }).estado;
    e = aplicar(e, "m", "combate.encerrar").estado;
    expect(e.combate).toBeUndefined();
    expect(e.ordemDeTurnoVisivel).toBe(true);
  });

  it("fechar a ordem não apaga a lista nem a rodada; abrir de novo a devolve igual", () => {
    let e = aplicar(comCombate(), "m", "ordemDeTurno.definir", { visivel: true }).estado;
    e = aplicar(e, "m", "combate.rodada", { rodada: 2 }).estado;
    const antes = e.combate;
    e = aplicar(e, "m", "ordemDeTurno.definir", { visivel: false }).estado;
    expect(e.combate).toEqual(antes);
    e = aplicar(e, "m", "ordemDeTurno.definir", { visivel: true }).estado;
    expect(e.combate).toEqual(antes);
  });

  it("exportar e importar a mesa leva a ordem, a rodada e a ordem aberta", () => {
    let e = aplicar(comCombate(), "m", "ordemDeTurno.definir", { visivel: true }).estado;
    e = aplicar(e, "m", "combate.rodada", { rodada: 6 }).estado;
    const volta = lerExportacao(JSON.parse(JSON.stringify(criarExportacao(e, AGORA))));
    expect(volta.ok).toBe(true);
    if (!volta.ok) return;
    expect(volta.exportacao.dados.combate?.rodada).toBe(6);
    expect(volta.exportacao.dados.ordemDeTurnoVisivel).toBe(true);
  });
});
