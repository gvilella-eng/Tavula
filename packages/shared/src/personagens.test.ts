import { describe, expect, it } from "vitest";
import {
  type AssetMeta,
  arrumarNoGrid,
  assetVisivelPara,
  CENA_PADRAO,
  type Cena,
  chegadaDaCena,
  cifrar,
  controlaToken,
  criarExportacao,
  decifrar,
  decifrarEConferir,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  hashesPreparaveis,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  metaDoCifrado,
  type Pacote,
  type Personagem,
  podeMoverToken,
  processar,
  reduzir,
  sha256Hex,
  type Token,
  tokenVisivelPara,
  VERSAO_EXPORTACAO,
  validarMeta,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const mestre = { id: "m", papel: "mestre" as const };
const j1 = { id: "j1", papel: "jogador" as const };
const j2 = { id: "j2", papel: "jogador" as const };
const j3 = { id: "j3", papel: "jogador" as const };

const hex = (c: string) => c.repeat(64);

function cena(id: string, extra: Partial<Cena> = {}): Cena {
  return { ...CENA_PADRAO, id, nome: `Nome ${id}`, ...extra };
}

function token(id: string, extra: Partial<Token> = {}): Token {
  return {
    id,
    cenaId: "c1",
    nome: `Token ${id}`,
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

function personagem(
  id: string,
  donoId: string | null,
  extra: Partial<Personagem> = {},
): Personagem {
  return {
    id,
    pastaId: donoId === null ? "pasta-npcs" : "pasta-personagens",
    editores: { tipo: "jogadores", ids: donoId === null ? [] : [donoId] },
    nome: `Pers ${id}`,
    tokenPadrao: { cor: "#123456", tamanhoQuadrados: 1 },
    visao: { alcanceM: null, visaoNoEscuroM: 0 },
    ficha: { pvAtual: 10, pvMax: 12 },
    ...extra,
  };
}

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
      { id: "j3", nome: "J3", papel: "jogador", cor: "#555" },
    ],
    cenas: [cena("c1"), cena("c2", { chegada: { x: 6, y: 15 } })],
    cenaAtivaId: "c1",
    personagens: [
      personagem("p1", "j1"),
      personagem("p2", "j2"),
      personagem("npc", null, { nome: "Ogro Secreto" }),
    ],
    tokens: [
      token("t-p1", { personagemId: "p1" }),
      token("t-p2", { personagemId: "p2", x: 12, y: 12 }),
      token("t-npc", { personagemId: "npc", x: 20, y: 20 }),
      token("t-livre"),
      token("t-covil", { cenaId: "c2", nome: "Sentinela do Covil" }),
      token("t-covil-oculto", { cenaId: "c2", oculto: true }),
    ],
  });
}

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });
}

function aplicar(estado: Estado, quem: string, i: Intencao) {
  const r = processar(estado, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} ${r.erro.mensagem}`);
  return r;
}

function codigo(estado: Estado, quem: string, i: Intencao): string | null {
  const r = processar(estado, quem, i, AGORA);
  return r.ok ? null : r.erro.codigo;
}

describe("sigilo de cena", () => {
  const e = criarEstado();

  it("o token de outra cena conta como invisível para o jogador; o mestre vê tudo", () => {
    const naOutra = token("x", { cenaId: "c2" });
    expect(tokenVisivelPara(naOutra, j1, "c1")).toBe(false);
    expect(tokenVisivelPara(naOutra, j1, "c2")).toBe(true);
    expect(tokenVisivelPara(naOutra, mestre, "c1")).toBe(true);
  });

  it("o snapshot do jogador só tem a cena ativa e os tokens dela", () => {
    const v = visaoPara(e, j1);
    expect(v.cenas.map((c) => c.id)).toEqual(["c1"]);
    expect(v.tokens.map((t) => t.id).sort()).toEqual(["t-livre", "t-npc", "t-p1", "t-p2"]);
    const texto = JSON.stringify(v);
    expect(texto).not.toContain("c2");
    expect(texto).not.toContain("Sentinela do Covil");
    expect(texto).not.toContain("Nome c2");
    expect(visaoPara(e, mestre).cenas).toHaveLength(2);
  });

  it("eventos de token e de mapa de outra cena não chegam ao jogador", () => {
    const criar = aplicar(
      e,
      "m",
      intencao("token.criar", { cenaId: "c2", token: token("novo", { cenaId: "c2" }) }),
    );
    expect(criar.estado.tokens.find((t) => t.id === "novo")?.cenaId).toBe("c2");
    expect(criar.eventos.map((ev) => eventoPara(ev, j1, e, criar.estado))).toEqual([null]);
    expect(criar.eventos.map((ev) => eventoPara(ev, mestre, e, criar.estado))).toEqual(
      criar.eventos,
    );

    const grid = aplicar(e, "m", intencao("cena.configurarGrid", { cenaId: "c2", quadradoM: 3 }));
    expect(grid.eventos.map((ev) => eventoPara(ev, j1, e, grid.estado))).toEqual([null]);
    const doGrupo = aplicar(e, "m", intencao("cena.configurarGrid", { quadradoM: 3 }));
    expect(doGrupo.eventos.map((ev) => eventoPara(ev, j1, e, doGrupo.estado))).toEqual(
      doGrupo.eventos,
    );

    const mapa = aplicar(
      aplicar(e, "m", intencao("asset.registrar", { metas: [metaMapa("a")] })).estado,
      "m",
      intencao("cena.definirMapa", { cenaId: "c2", assetHash: hex("a") }),
    );
    expect(mapa.eventos.map((ev) => eventoPara(ev, j1, e, mapa.estado))).toEqual([null]);
  });

  it("renomear a cena do grupo chega ao jogador; as outras não", () => {
    const na2 = aplicar(e, "m", intencao("cena.editar", { cenaId: "c2", nome: "Segredo" }));
    expect(eventoPara(na2.eventos[0] as EventoSala, j1, e, na2.estado)).toBeNull();
    const na1 = aplicar(e, "m", intencao("cena.editar", { cenaId: "c1", nome: "Praça" }));
    expect(eventoPara(na1.eventos[0] as EventoSala, j1, e, na1.estado)).not.toBeNull();
  });

  it("assetVisivelPara: o mapa e as imagens da cena que não é a ativa são invisíveis", () => {
    let s = e;
    s = aplicar(
      s,
      "m",
      intencao("asset.registrar", { metas: [metaMapa("a"), metaToken("b"), metaToken("c")] }),
    ).estado;
    s = aplicar(s, "m", intencao("cena.definirMapa", { cenaId: "c2", assetHash: hex("a") })).estado;
    s = aplicar(
      s,
      "m",
      intencao("token.editar", { id: "t-covil", mudancas: { assetHash: hex("b") } }),
    ).estado;
    expect(assetVisivelPara(hex("a"), s, j1)).toBe(false);
    expect(assetVisivelPara(hex("b"), s, j1)).toBe(false);
    expect(assetVisivelPara(hex("a"), s, mestre)).toBe(true);
    // depois da ida, passam a ser visíveis
    const depois = aplicar(s, "m", intencao("grupo.moverPara", { cenaId: "c2" })).estado;
    expect(assetVisivelPara(hex("a"), depois, j1)).toBe(true);
    expect(assetVisivelPara(hex("b"), depois, j1)).toBe(true);
  });
});

describe("personagens no snapshot", () => {
  it("o jogador vê os que edita; NPC e itens de pasta só do mestre nunca", () => {
    const e = criarEstado();
    expect(visaoPara(e, j1).personagens.map((p) => p.id)).toEqual(["p1"]);
    expect(visaoPara(e, j3).personagens).toEqual([]);
    expect(visaoPara(e, mestre).personagens).toHaveLength(3);
    expect(JSON.stringify(visaoPara(e, j1))).not.toContain("Ogro Secreto");
    // a pasta decide quem vê o item; a capacidade (Lote 9) só decide quem vê a ficha completa e manda snapshot novo
    const com = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "ficha.verOutras", valor: true }),
    );
    expect(com.snapshotPara).toBe("todos");
    expect(visaoPara(com.estado, j1).personagens.map((p) => p.id)).toEqual(["p1"]);
  });

  it("eventos de personagem: o dono e o mestre recebem; NPC e alheio não; a visão some com apagado", () => {
    const e = criarEstado();
    const r = aplicar(
      e,
      "j1",
      intencao("ficha.alterar", {
        personagemId: "p1",
        operacoes: [{ caminho: "pvAtual", valor: 3 }],
      }),
    );
    const ev = r.eventos[0] as EventoSala;
    expect(eventoPara(ev, j1, e, r.estado)).toEqual(ev);
    expect(eventoPara(ev, j2, e, r.estado)).toBeNull();
    expect(eventoPara(ev, mestre, e, r.estado)).toEqual(ev);
    const npc = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "npc", mudancas: { pvAtual: 1 } }),
    );
    expect(eventoPara(npc.eventos[0] as EventoSala, j1, e, npc.estado)).toBeNull();
    // troca de quem edita: quem perdeu a visão recebe "apagado"
    const troca = aplicar(
      e,
      "m",
      intencao("personagem.editar", {
        id: "p1",
        mudancas: { editores: { tipo: "jogadores", ids: ["j3"] } },
      }),
    );
    const evt = troca.eventos[0] as EventoSala;
    expect(eventoPara(evt, j1, e, troca.estado)?.tipo).toBe("personagem.apagado");
    expect(eventoPara(evt, j3, e, troca.estado)?.tipo).toBe("personagem.alterado");
    expect(eventoPara(evt, j2, e, troca.estado)).toBeNull();
  });
});

describe("controle do token", () => {
  const e = criarEstado();
  const tok = (id: string) => e.tokens.find((t) => t.id === id) as Token;

  it("o dono do personagem move; outro jogador não; o mestre sim", () => {
    expect(controlaToken(tok("t-p1"), j1, e.personagens)).toBe(true);
    expect(podeMoverToken(tok("t-p1"), j1, e)).toBe(true);
    expect(podeMoverToken(tok("t-p1"), j2, e)).toBe(false);
    expect(podeMoverToken(tok("t-p1"), mestre, e)).toBe(true);
    expect(podeMoverToken(tok("t-npc"), j1, e)).toBe(false);
  });

  it("quem está em controladoPor também move (o mestre empresta o token)", () => {
    const emprestado = aplicar(
      e,
      "m",
      intencao("token.editar", { id: "t-p1", mudancas: { controladoPor: ["j2"] } }),
    ).estado;
    const t = emprestado.tokens.find((x) => x.id === "t-p1") as Token;
    expect(podeMoverToken(t, j2, emprestado)).toBe(true);
    expect(podeMoverToken(t, j1, emprestado)).toBe(true); // continua sendo o dono
    expect(podeMoverToken(t, j3, emprestado)).toBe(false);
    expect(codigo(e, "j2", intencao("token.soltar", { id: "t-p1", x: 5, y: 5 }))).toBe(
      "sem_permissao",
    );
    expect(
      codigo(emprestado, "j2", intencao("token.soltar", { id: "t-p1", x: 5, y: 5 })),
    ).toBeNull();
  });

  it("jogador não move token de outra cena (responde como inexistente)", () => {
    expect(codigo(e, "j1", intencao("token.soltar", { id: "t-covil", x: 5, y: 5 }))).toBe(
      "token_inexistente",
    );
  });
});

describe("grupo.moverPara", () => {
  it("leva os tokens dos personagens de jogador para a chegada; o NPC fica; a cena ativa muda", () => {
    const e = criarEstado();
    const r = aplicar(e, "m", intencao("grupo.moverPara", { cenaId: "c2" }));
    expect(r.snapshotPara).toBe("todos");
    expect(r.grupoMovido).toEqual({ cenaId: "c2" });
    expect(r.estado.cenaAtivaId).toBe("c2");
    const por = (id: string) => r.estado.tokens.find((t) => t.id === id) as Token;
    expect(por("t-p1").cenaId).toBe("c2");
    expect(por("t-p2").cenaId).toBe("c2");
    expect(por("t-npc")).toEqual(e.tokens.find((t) => t.id === "t-npc"));
    expect(por("t-livre").cenaId).toBe("c1");
    // lado a lado, em quadrados diferentes, perto da chegada (6, 15)
    expect(por("t-p1")).toMatchObject({ x: 6.75, y: 15.75 });
    expect(por("t-p2")).toMatchObject({ x: 8.25, y: 15.75 });
    // depois da ida o jogador vê a cena nova e só ela
    const v = visaoPara(r.estado, j1);
    expect(v.cenaAtivaId).toBe("c2");
    expect(v.cenas.map((c) => c.id)).toEqual(["c2"]);
    expect(v.tokens.map((t) => t.id).sort()).toEqual(["t-covil", "t-p1", "t-p2"]);
  });

  it("o reducer do cliente chega ao mesmo estado que a sala", () => {
    const e = criarEstado();
    const r = aplicar(e, "m", intencao("grupo.moverPara", { cenaId: "c2" }));
    let cliente = e;
    for (const ev of r.eventos) cliente = reduzir(cliente, ev);
    expect(cliente).toEqual(r.estado);
  });

  it("cena inexistente é recusada; ir para a cena atual não muda nada; jogador não pode", () => {
    const e = criarEstado();
    expect(codigo(e, "m", intencao("grupo.moverPara", { cenaId: "nada" }))).toBe(
      "cena_inexistente",
    );
    expect(aplicar(e, "m", intencao("grupo.moverPara", { cenaId: "c1" })).eventos).toEqual([]);
    expect(codigo(e, "j1", intencao("grupo.moverPara", { cenaId: "c2" }))).toBe("sem_permissao");
  });

  it("o evento do grupo é só do mestre (os outros recebem snapshot)", () => {
    const e = criarEstado();
    const r = aplicar(e, "m", intencao("grupo.moverPara", { cenaId: "c2" }));
    const ev = r.eventos[0] as EventoSala;
    expect(eventoPara(ev, j1, e, r.estado)).toBeNull();
    expect(eventoPara(ev, mestre, e, r.estado)).toEqual(ev);
  });
});

describe("arrumarNoGrid", () => {
  const cenaGrande = cena("g");
  const celulas = (c: { x: number; y: number }, tamanho: number) => {
    const i0 = Math.round((c.x - (tamanho * 1.5) / 2) / 1.5);
    const j0 = Math.round((c.y - (tamanho * 1.5) / 2) / 1.5);
    const saida: string[] = [];
    for (let j = j0; j < j0 + tamanho; j++)
      for (let i = i0; i < i0 + tamanho; i++) saida.push(`${i},${j}`);
    return saida;
  };

  it("o primeiro fica na chegada e os outros ao lado, sem sobreposição", () => {
    const pos = arrumarNoGrid({ x: 30, y: 22.5 }, cenaGrande, [1, 1, 1, 1]);
    expect(pos[0]).toEqual({ x: 30.75, y: 23.25 });
    const todas = pos.flatMap((p) => celulas(p, 1));
    expect(new Set(todas).size).toBe(4);
    expect(new Set(pos.map((p) => p.y)).size).toBe(1); // a mesma fileira
  });

  it("tamanhos diferentes não se sobrepõem", () => {
    const tamanhos = [2, 1, 3, 1, 4, 2, 1];
    const pos = arrumarNoGrid({ x: 30, y: 22.5 }, cenaGrande, tamanhos);
    const todas = pos.flatMap((p, i) => celulas(p, tamanhos[i] as number));
    expect(new Set(todas).size).toBe(tamanhos.reduce((s, t) => s + t * t, 0));
  });

  it("não sai da cena (grupo grande numa cena pequena usa as fileiras vizinhas)", () => {
    const pequena = cena("p", { larguraM: 6, alturaM: 6 }); // 4 x 4 quadrados
    const pos = arrumarNoGrid({ x: 0.2, y: 0.2 }, pequena, Array(10).fill(1));
    for (const p of pos) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(6);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(6);
    }
    expect(new Set(pos.map((p) => `${p.x},${p.y}`)).size).toBe(10);
  });

  it("a chegada padrão é o centro", () => {
    expect(chegadaDaCena(cena("a"))).toEqual({ x: 30, y: 22.5 });
    expect(chegadaDaCena(cena("a", { chegada: { x: 1, y: 2 } }))).toEqual({ x: 1, y: 2 });
  });
});

describe("cenas: criar, editar, duplicar, apagar", () => {
  it("criar acrescenta uma cena (id novo) com os padrões", () => {
    const e = criarEstado();
    const r = aplicar(e, "m", intencao("cena.criar", { id: "c3", nome: "Floresta" }));
    expect(r.estado.cenas.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(r.estado.cenas[2]).toMatchObject({ nome: "Floresta", grid: { quadradoM: 1.5 } });
    expect(codigo(e, "m", intencao("cena.criar", { id: "c1", nome: "X" }))).toBe("dados_invalidos");
    expect(codigo(e, "j1", intencao("cena.criar", { id: "c3", nome: "X" }))).toBe("sem_permissao");
  });

  it("editar muda o nome e a chegada (limitada à cena); null volta ao centro", () => {
    const e = criarEstado();
    const r = aplicar(
      e,
      "m",
      intencao("cena.editar", { cenaId: "c1", nome: "Praça", chegada: { x: 500, y: 5 } }),
    );
    expect(r.estado.cenas[0]).toMatchObject({ nome: "Praça", chegada: { x: 60, y: 5 } });
    const volta = aplicar(r.estado, "m", intencao("cena.editar", { cenaId: "c1", chegada: null }));
    expect(volta.estado.cenas[0]?.chegada).toBeUndefined();
    expect(codigo(e, "m", intencao("cena.editar", { cenaId: "nada", nome: "X" }))).toBe(
      "cena_inexistente",
    );
  });

  it("duplicar copia a cena e os tokens, menos os de personagem de jogador, com ids novos", () => {
    const e = aplicar(
      criarEstado(),
      "m",
      intencao("cena.editar", { cenaId: "c1", chegada: { x: 3, y: 4 } }),
    ).estado;
    const r = aplicar(e, "m", intencao("cena.duplicar", { cenaId: "c1", novoId: "c3" }));
    const copia = r.estado.cenas.find((c) => c.id === "c3") as Cena;
    expect(copia).toMatchObject({ nome: "Nome c1 (cópia)", chegada: { x: 3, y: 4 } });
    const dela = r.estado.tokens.filter((t) => t.cenaId === "c3");
    // t-livre e t-npc ficam; t-p1 e t-p2 (jogadores) não
    expect(dela.map((t) => t.nome).sort()).toEqual(["Token t-livre", "Token t-npc"]);
    expect(dela.every((t) => !e.tokens.some((o) => o.id === t.id))).toBe(true);
    expect(dela.find((t) => t.personagemId === "npc")).toBeDefined();
    // a original não mudou
    expect(r.estado.tokens.filter((t) => t.cenaId === "c1")).toHaveLength(4);
    let cliente = e;
    for (const ev of r.eventos) cliente = reduzir(cliente, ev);
    expect(cliente).toEqual(r.estado);
    expect(r.eventos.map((ev) => eventoPara(ev, j1, e, r.estado))).toEqual(
      r.eventos.map(() => null),
    );
  });

  it("apagar remove a cena e os tokens dela, mas nunca a ativa", () => {
    const e = criarEstado();
    expect(codigo(e, "m", intencao("cena.apagar", { cenaId: "c1" }))).toBe("dados_invalidos");
    const r = aplicar(e, "m", intencao("cena.apagar", { cenaId: "c2" }));
    expect(r.estado.cenas.map((c) => c.id)).toEqual(["c1"]);
    expect(r.estado.tokens.some((t) => t.cenaId === "c2")).toBe(false);
    expect(r.estado.tokens).toHaveLength(4);
    expect(codigo(e, "m", intencao("cena.apagar", { cenaId: "nada" }))).toBe("cena_inexistente");
    expect(r.eventos.map((ev) => eventoPara(ev, j1, e, r.estado))).toEqual(
      r.eventos.map(() => null),
    );
  });
});

describe("personagens: criar, editar, colocar, apagar", () => {
  it("criar valida dono (jogador) e imagem; editar muda só o pedido e limita o PV", () => {
    const e = criarEstado();
    const novo = personagem("p9", "j3");
    expect(
      aplicar(e, "m", intencao("personagem.criar", { personagem: novo })).estado.personagens,
    ).toHaveLength(4);
    expect(
      codigo(e, "m", intencao("personagem.criar", { personagem: personagem("p9", "m") })),
    ).toBe("usuario_inexistente");
    expect(
      codigo(e, "m", intencao("personagem.criar", { personagem: personagem("p1", null) })),
    ).toBe("dados_invalidos");
    expect(
      codigo(
        e,
        "m",
        intencao("personagem.criar", {
          personagem: personagem("p9", null, {
            tokenPadrao: { cor: "#1", tamanhoQuadrados: 1, assetHash: hex("f") },
          }),
        }),
      ),
    ).toBe("asset_inexistente");
    expect(codigo(e, "j1", intencao("personagem.criar", { personagem: novo }))).toBe(
      "sem_permissao",
    );
    const ed = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "p1", mudancas: { nome: "Aldric", pvMax: 5 } }),
    ).estado.personagens.find((p) => p.id === "p1") as Personagem;
    expect(ed).toMatchObject({
      nome: "Aldric",
      ficha: { pvAtual: 5, pvMax: 5 },
      editores: { tipo: "jogadores", ids: ["j1"] },
    });
  });

  it("colocar cria o token a partir do token padrão (cópia própria) na chegada", () => {
    const e = criarEstado();
    const r = aplicar(
      e,
      "m",
      intencao("personagem.colocar", { personagemId: "npc", cenaId: "c2", tokenId: "novo" }),
    );
    const t = r.estado.tokens.find((x) => x.id === "novo") as Token;
    expect(t).toMatchObject({
      cenaId: "c2",
      nome: "Ogro Secreto",
      cor: "#123456",
      personagemId: "npc",
      camada: "tokens",
      oculto: false,
      controladoPor: [],
      x: 6.75,
      y: 15.75,
    });
    // mudar o personagem depois não muda o token que já está na mesa
    const depois = aplicar(
      r.estado,
      "m",
      intencao("personagem.editar", { id: "npc", mudancas: { nome: "Outro" } }),
    ).estado;
    expect(depois.tokens.find((x) => x.id === "novo")?.nome).toBe("Ogro Secreto");
    // personagem de jogador só tem um token
    expect(
      codigo(
        e,
        "m",
        intencao("personagem.colocar", { personagemId: "p1", cenaId: "c1", tokenId: "outro" }),
      ),
    ).toBe("dados_invalidos");
    expect(
      codigo(
        e,
        "m",
        intencao("personagem.colocar", { personagemId: "nada", cenaId: "c1", tokenId: "x" }),
      ),
    ).toBe("personagem_inexistente");
    expect(
      codigo(
        e,
        "m",
        intencao("personagem.colocar", { personagemId: "npc", cenaId: "nada", tokenId: "x" }),
      ),
    ).toBe("cena_inexistente");
  });

  it("apagar remove o personagem e os tokens dele", () => {
    const e = criarEstado();
    const r = aplicar(e, "m", intencao("personagem.apagar", { id: "p1" }));
    expect(r.estado.personagens.map((p) => p.id)).toEqual(["p2", "npc"]);
    expect(r.estado.tokens.some((t) => t.personagemId === "p1")).toBe(false);
    // o jogador recebe o token.apagado e o personagem.apagado
    const vistos = r.eventos.map((ev) => eventoPara(ev, j1, e, r.estado)?.tipo);
    expect(vistos).toEqual(["token.apagado", "personagem.apagado"]);
    let cliente = visaoPara(e, j1);
    for (const ev of r.eventos) {
      const visto = eventoPara(ev, j1, e, r.estado);
      if (visto) cliente = reduzir(cliente, visto);
    }
    expect(cliente.personagens).toEqual([]);
    expect(cliente.tokens.some((t) => t.id === "t-p1")).toBe(false);
  });
});

describe("ficha.alterar", () => {
  const e = criarEstado();

  it("o dono e o mestre alteram; outro jogador não; NPC responde como inexistente", () => {
    const dono = aplicar(
      e,
      "j1",
      intencao("ficha.alterar", {
        personagemId: "p1",
        operacoes: [{ caminho: "pvAtual", valor: 4 }],
      }),
    );
    expect(dono.estado.personagens.find((p) => p.id === "p1")?.ficha).toEqual({
      pvAtual: 4,
      pvMax: 12,
    });
    expect(
      aplicar(
        e,
        "m",
        intencao("ficha.alterar", {
          personagemId: "p1",
          operacoes: [{ caminho: "pvMax", valor: 20 }],
        }),
      ).estado.personagens[0]?.ficha,
    ).toEqual({ pvAtual: 10, pvMax: 20 });
    // sem poder ver o personagem alheio: inexistente; vendo (pasta de todos): sem permissão
    expect(
      codigo(
        e,
        "j2",
        intencao("ficha.alterar", {
          personagemId: "p1",
          operacoes: [{ caminho: "pvAtual", valor: 1 }],
        }),
      ),
    ).toBe("personagem_inexistente");
    const vendo = aplicar(
      e,
      "m",
      intencao("pasta.editar", { id: "pasta-personagens", visivel: { tipo: "todos" } }),
    ).estado;
    expect(
      codigo(
        vendo,
        "j2",
        intencao("ficha.alterar", {
          personagemId: "p1",
          operacoes: [{ caminho: "pvAtual", valor: 1 }],
        }),
      ),
    ).toBe("sem_permissao");
    expect(
      codigo(
        vendo,
        "j1",
        intencao("ficha.alterar", {
          personagemId: "npc",
          operacoes: [{ caminho: "pvAtual", valor: 1 }],
        }),
      ),
    ).toBe("personagem_inexistente");
    expect(
      codigo(
        e,
        "m",
        intencao("ficha.alterar", {
          personagemId: "npc",
          operacoes: [{ caminho: "pvAtual", valor: 1 }],
        }),
      ),
    ).toBeNull();
  });

  it("PV atual nunca passa do máximo e não muda nada se o valor é o mesmo", () => {
    const r = aplicar(
      e,
      "j1",
      intencao("ficha.alterar", {
        personagemId: "p1",
        operacoes: [{ caminho: "pvAtual", valor: 99 }],
      }),
    );
    expect(r.estado.personagens.find((p) => p.id === "p1")?.ficha?.pvAtual).toBe(12);
    expect(
      aplicar(
        e,
        "j1",
        intencao("ficha.alterar", {
          personagemId: "p1",
          operacoes: [{ caminho: "pvAtual", valor: 10 }],
        }),
      ).eventos,
    ).toEqual([]);
  });

  it("os PV se mantêm quando o grupo troca de cena", () => {
    const baixo = aplicar(
      e,
      "j1",
      intencao("ficha.alterar", {
        personagemId: "p1",
        operacoes: [{ caminho: "pvAtual", valor: 3 }],
      }),
    ).estado;
    const fora = aplicar(baixo, "m", intencao("grupo.moverPara", { cenaId: "c2" })).estado;
    expect(fora.personagens.find((p) => p.id === "p1")?.ficha?.pvAtual).toBe(3);
    expect(visaoPara(fora, j1).personagens[0]?.ficha?.pvAtual).toBe(3);
  });
});

function metaMapa(c: string): Omit<AssetMeta, "donoId"> {
  return {
    hash: hex(c),
    tipo: "mapa",
    mime: "image/webp",
    bytes: 10,
    largura: 700,
    altura: 700,
    nomeOriginal: "mapa-secreto.webp",
    pedacos: [hex("9")],
  };
}
function metaToken(c: string): Omit<AssetMeta, "donoId"> {
  return { ...metaMapa(c), tipo: "token", largura: 64, altura: 64, nomeOriginal: "tok.webp" };
}

describe("cifra do pré-envio", () => {
  it("cifra, decifra e confere o SHA-256 do original", async () => {
    const original = new Uint8Array(300_000).map((_, i) => (i * 7) % 251);
    const hashOriginal = await sha256Hex(original);
    const { cifrado, chave } = await cifrar(original);
    expect(chave).toMatch(/^[0-9a-f]{64}$/);
    expect(cifrado.length).toBe(original.length + 28);
    expect(await decifrar(cifrado, chave)).toEqual(original);
    expect(await decifrarEConferir(cifrado, chave, hashOriginal)).toEqual(original);
  });

  it("chave nova e IV novo a cada vez; o cifrado não contém o original", async () => {
    const original = new Uint8Array(1000).fill(65);
    const a = await cifrar(original);
    const b = await cifrar(original);
    expect(a.chave).not.toBe(b.chave);
    expect(await sha256Hex(a.cifrado)).not.toBe(await sha256Hex(b.cifrado));
    const sequencia = "A".repeat(64);
    let texto = "";
    for (const b of a.cifrado) texto += String.fromCharCode(b);
    expect(texto).not.toContain(sequencia);
  });

  it("chave errada, arquivo adulterado ou hash errado: não abre", async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const hashOriginal = await sha256Hex(original);
    const { cifrado, chave } = await cifrar(original);
    const outra = (await cifrar(original)).chave;
    expect(await decifrarEConferir(cifrado, outra, hashOriginal)).toBeNull();
    const adulterado = cifrado.slice();
    adulterado[adulterado.length - 1] = (adulterado[adulterado.length - 1] ?? 0) ^ 1;
    expect(await decifrarEConferir(adulterado, chave, hashOriginal)).toBeNull();
    expect(await decifrarEConferir(cifrado, chave, hex("0"))).toBeNull();
    expect(await decifrarEConferir(new Uint8Array(5), chave, hashOriginal)).toBeNull();
  });

  it("a meta do cifrado não tem nome real nem dimensões, e passa na validação", async () => {
    const { cifrado } = await cifrar(new Uint8Array(600_000).fill(3));
    const meta = await metaDoCifrado(cifrado);
    expect(meta).toMatchObject({
      tipo: "cifrado",
      nomeOriginal: "cifrado",
      largura: 1,
      altura: 1,
      bytes: 600_028,
    });
    expect(meta.pedacos).toHaveLength(3);
    expect(validarMeta(meta)).toBeNull();
  });
});

describe("cena.preparar", () => {
  function cenario() {
    let e = criarEstado();
    e = aplicar(
      e,
      "m",
      intencao("asset.registrar", {
        metas: [
          metaMapa("a"),
          metaToken("b"),
          metaToken("c"),
          { ...metaToken("d"), tipo: "cifrado" },
        ],
      }),
    ).estado;
    e = aplicar(e, "m", intencao("cena.definirMapa", { cenaId: "c2", assetHash: hex("a") })).estado;
    e = aplicar(
      e,
      "m",
      intencao("token.editar", { id: "t-covil", mudancas: { assetHash: hex("b") } }),
    ).estado;
    e = aplicar(
      e,
      "m",
      intencao("token.editar", { id: "t-covil-oculto", mudancas: { assetHash: hex("c") } }),
    ).estado;
    return e;
  }
  const pacote = (original: string): Pacote => ({
    hashCifrado: hex("d"),
    hashOriginal: hex(original),
    chave: hex("e"),
  });

  it("só o mapa e a imagem dos tokens visíveis são preparáveis (o oculto não)", () => {
    expect(hashesPreparaveis(cenario(), "c2").sort()).toEqual([hex("a"), hex("b")]);
  });

  it("aceita pacotes da cena e devolve o preparo à sala; só mestre", () => {
    const e = cenario();
    const r = aplicar(
      e,
      "m",
      intencao("cena.preparar", { cenaId: "c2", pacotes: [pacote("a"), pacote("b")] }),
    );
    expect(r.preparo?.cenaId).toBe("c2");
    expect(r.preparo?.pacotes).toHaveLength(2);
    expect(r.eventos).toEqual([]);
    expect(
      codigo(e, "j1", intencao("cena.preparar", { cenaId: "c2", pacotes: [pacote("a")] })),
    ).toBe("sem_permissao");
  });

  it("recusa pacote do token oculto, de arquivo que não é da cena e cifrado não registrado", () => {
    const e = cenario();
    expect(
      codigo(e, "m", intencao("cena.preparar", { cenaId: "c2", pacotes: [pacote("c")] })),
    ).toBe("dados_invalidos");
    expect(
      codigo(e, "m", intencao("cena.preparar", { cenaId: "c1", pacotes: [pacote("a")] })),
    ).toBe("dados_invalidos");
    expect(
      codigo(
        e,
        "m",
        intencao("cena.preparar", {
          cenaId: "c2",
          pacotes: [{ ...pacote("a"), hashCifrado: hex("7") }],
        }),
      ),
    ).toBe("asset_inexistente");
    expect(
      codigo(e, "m", intencao("cena.preparar", { cenaId: "nada", pacotes: [pacote("a")] })),
    ).toBe("cena_inexistente");
  });

  it("o arquivo cifrado é visível a todo jogador; só o mestre registra", () => {
    const e = cenario();
    expect(assetVisivelPara(hex("d"), e, j1)).toBe(true);
    expect(assetVisivelPara(hex("d"), e, j3)).toBe(true);
    expect(assetVisivelPara(hex("d"), e, { id: "a", papel: "assistente" })).toBe(false);
    expect(
      codigo(
        e,
        "j1",
        intencao("asset.registrar", { metas: [{ ...metaToken("1"), tipo: "cifrado" }] }),
      ),
    ).toBe("sem_permissao");
  });
});

describe("exportação v5", () => {
  it("leva personagens e a chegada das cenas; volta igual; nunca leva preparos nem cifrados", () => {
    let e = criarEstado();
    e = aplicar(
      e,
      "m",
      intencao("asset.registrar", { metas: [{ ...metaToken("d"), tipo: "cifrado" }] }),
    ).estado;
    const x = criarExportacao(e, AGORA);
    expect(x.versao).toBe(VERSAO_EXPORTACAO);
    expect(x.versao).toBe(13);
    expect(x.dados.personagens).toHaveLength(3);
    expect(x.dados.pastas.map((p) => p.id)).toEqual(["pasta-personagens", "pasta-npcs"]);
    expect(x.dados.cenas[1]?.chegada).toEqual({ x: 6, y: 15 });
    expect(x.dados.assets).toEqual([]); // o cifrado não é usado por nada da campanha
    expect(JSON.stringify(x)).not.toContain("chave");
    const lida = lerExportacao(JSON.parse(JSON.stringify(x)));
    expect(lida.ok && lida.exportacao.dados).toEqual(x.dados);
  });

  it("importa v1, v2 e v3 (sem personagens) como v5 e recusa personagem incoerente", () => {
    const e = criarEstado();
    const v4 = criarExportacao(e, AGORA);
    const { personagens: _p, ...resto } = v4.dados;
    const dadosV3 = {
      ...resto,
      tokens: resto.tokens.map(({ personagemId: _id, ...t }) => t),
    };
    const v3 = { ...v4, versao: 3, dados: dadosV3 };
    const l3 = lerExportacao(v3);
    expect(l3.ok && l3.exportacao.versao).toBe(13);
    expect(l3.ok && l3.exportacao.dados.personagens).toEqual([]);
    expect(l3.ok && l3.exportacao.dados.cenas).toHaveLength(2);
    const { assets: _a, ...dadosV2 } = dadosV3;
    const l2 = lerExportacao({ ...v4, versao: 2, dados: dadosV2 });
    expect(l2.ok && l2.exportacao.dados.personagens).toEqual([]);
    const { cenas: _c, cenaAtivaId: _i, tokens: _t, ...dadosV1 } = dadosV2;
    const l1 = lerExportacao({ ...v4, versao: 1, dados: dadosV1 });
    expect(l1.ok && l1.exportacao.dados.cenas).toEqual([CENA_PADRAO]);

    const ruim = (dados: object) => lerExportacao({ ...v4, dados: { ...v4.dados, ...dados } }).ok;
    expect(ruim({})).toBe(true);
    expect(ruim({ personagens: [personagem("p1", "fantasma")] })).toBe(false);
    expect(ruim({ personagens: [personagem("p1", "j1"), personagem("p1", "j2")] })).toBe(false);
    expect(ruim({ personagens: [] })).toBe(false); // há tokens de personagem
    expect(ruim({ personagens: [{ ...personagem("p1", "j1"), pastaId: "nada" }] })).toBe(false);
    expect(
      ruim({
        personagens: [
          personagem("p1", "j1", {
            tokenPadrao: { cor: "#1", tamanhoQuadrados: 1, assetHash: hex("9") },
          }),
        ],
        tokens: [],
      }),
    ).toBe(false);
  });

  it("a importação mantém os personagens e os tokens ligados a eles", () => {
    const e = criarEstado();
    const outro = estadoInicial({ usuarios: e.usuarios.map((u) => u) });
    const r = aplicar(
      outro,
      "m",
      intencao("campanha.importar", { dados: criarExportacao(e, AGORA) }),
    );
    expect(r.estado.personagens).toHaveLength(3);
    expect(r.estado.tokens.find((t) => t.id === "t-p1")?.personagemId).toBe("p1");
  });
});
