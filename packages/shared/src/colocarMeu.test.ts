import { describe, expect, it } from "vitest";
import {
  areaDaBandeira,
  CENA_PADRAO,
  criarExportacao,
  dentroDaAreaDaBandeira,
  type Estado,
  estadoInicial,
  type Intencao,
  IntencaoSchema,
  jogadorVeABandeira,
  lerExportacao,
  type Personagem,
  podeColocarProprioToken,
  processar,
  type Token,
  visaoPara,
} from "./index.ts";

// V10b: o jogador põe o token do personagem que controla, na cena do grupo e na área da bandeira.

const AGORA = "2026-01-01T00:00:00.000Z";
const j1 = { id: "j1", papel: "jogador" as const };

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
    tokenPadrao: { cor: "#123456", tamanhoQuadrados: 1, assetHash: "a".repeat(64) },
    visao: { alcanceM: 9, visaoNoEscuroM: 6 },
    ficha: { pvAtual: 10, pvMax: 12 },
    ...extra,
  };
}

function token(id: string, extra: Partial<Token> = {}): Token {
  return {
    id,
    cenaId: "c1",
    nome: `Token ${id}`,
    cor: "#abc",
    tamanhoQuadrados: 1,
    x: 5,
    y: 5,
    camada: "tokens",
    oculto: false,
    controladoPor: [],
    ...extra,
  };
}

function criarEstado(tokens: Token[] = []): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
    ],
    cenas: [
      { ...CENA_PADRAO, id: "c1", nome: "C1" },
      { ...CENA_PADRAO, id: "c2", nome: "C2", chegada: { x: 10, y: 10 } },
    ],
    cenaAtivaId: "c1",
    personagens: [personagem("p1", "j1"), personagem("p2", "j2"), personagem("npc", null)],
    tokens,
  });
}

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });
}
const meu = (dados: object) => intencao("token.colocarMeu", dados);

function codigo(estado: Estado, quem: string, i: Intencao): string | null {
  const r = processar(estado, quem, i, AGORA);
  return r.ok ? null : r.erro.codigo;
}
function aplicar(estado: Estado, quem: string, i: Intencao) {
  const r = processar(estado, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} ${r.erro.mensagem}`);
  return r;
}
const dessePersonagem = (e: Estado, id: string) => e.tokens.filter((t) => t.personagemId === id);
const semLigar = (e: Estado, valor: boolean): Estado => ({
  ...e,
  permissoes: {
    ...e.permissoes,
    jogadores: { ...e.permissoes.jogadores, "token.colocarProprio": valor },
  },
});

describe("token.colocarMeu", () => {
  it("o jogador tem a capacidade por padrão", () => {
    expect(codigo(criarEstado(), "j1", meu({ personagemId: "p1", tokenId: "t1" }))).toBeNull();
  });

  it("quem controla põe o token; sem ponto, a sala usa o arranjo da chegada (centro da cena)", () => {
    const e = aplicar(criarEstado(), "j1", meu({ personagemId: "p1", tokenId: "t1" })).estado;
    const t = dessePersonagem(e, "p1")[0] as Token;
    expect(t).toMatchObject({ id: "t1", cenaId: "c1", camada: "tokens", oculto: false });
    expect(dentroDaAreaDaBandeira(e.cenas[0] as never, t)).toBe(true);
  });

  it("quem não controla não põe", () => {
    const e = criarEstado();
    expect(codigo(e, "j2", meu({ personagemId: "p1", tokenId: "t1" }))).toBe("sem_permissao");
    expect(codigo(e, "j1", meu({ personagemId: "npc", tokenId: "t1" }))).toBe("sem_permissao");
    expect(codigo(e, "j1", meu({ personagemId: "nada", tokenId: "t1" }))).toBe("sem_permissao");
  });

  it("personagem de todos os jogadores: qualquer um põe", () => {
    const e = criarEstado();
    e.personagens = [personagem("pt", null, { editores: { tipo: "todos" } })];
    expect(codigo(e, "j2", meu({ personagemId: "pt", tokenId: "t1" }))).toBeNull();
  });

  it("um segundo token do mesmo personagem na mesma cena é recusado; em outra cena, não", () => {
    let e = aplicar(criarEstado(), "j1", meu({ personagemId: "p1", tokenId: "t1" })).estado;
    expect(codigo(e, "j1", meu({ personagemId: "p1", tokenId: "t2" }))).toBe("dados_invalidos");
    e = { ...e, cenaAtivaId: "c2" };
    expect(codigo(e, "j1", meu({ personagemId: "p1", tokenId: "t2" }))).toBeNull();
  });

  it("recusa um id de token que já existe", () => {
    const e = criarEstado([token("t1")]);
    expect(codigo(e, "j1", meu({ personagemId: "p1", tokenId: "t1" }))).toBe("dados_invalidos");
  });

  it("um ponto fora da área é recusado; dentro é aceito e encaixado no grid", () => {
    const e = criarEstado();
    const { x, y, raioM } = areaDaBandeira(e.cenas[0] as never);
    expect(raioM).toBeCloseTo(4.5);
    expect(codigo(e, "j1", meu({ personagemId: "p1", tokenId: "t1", x: x + raioM + 0.5, y }))).toBe(
      "dados_invalidos",
    );
    expect(codigo(e, "j1", meu({ personagemId: "p1", tokenId: "t1", x: 2, y: 2 }))).toBe(
      "dados_invalidos",
    );
    const r = aplicar(e, "j1", meu({ personagemId: "p1", tokenId: "t1", x: x + 3.1, y: y + 0.2 }));
    const t = dessePersonagem(r.estado, "p1")[0] as Token;
    // encaixado no centro do quadrado de 1,5 m
    expect(t.x).toBeCloseTo((Math.floor((x + 3.1) / 1.5) + 0.5) * 1.5);
    expect(t.y).toBeCloseTo((Math.floor((y + 0.2) / 1.5) + 0.5) * 1.5);
  });

  it("a área segue a chegada definida pelo mestre", () => {
    const e = { ...criarEstado(), cenaAtivaId: "c2" };
    expect(codigo(e, "j1", meu({ personagemId: "p1", tokenId: "t1", x: 11, y: 11 }))).toBeNull();
    expect(codigo(e, "j1", meu({ personagemId: "p1", tokenId: "t2", x: 30, y: 22 }))).toBe(
      "dados_invalidos",
    );
  });

  it("x sem y é recusado", () => {
    expect(codigo(criarEstado(), "j1", meu({ personagemId: "p1", tokenId: "t1", x: 30 }))).toBe(
      "dados_invalidos",
    );
  });

  it("os campos vêm da ficha; um campo extra do cliente é ignorado", () => {
    const i = meu({
      personagemId: "p1",
      tokenId: "t1",
      nome: "Falso",
      assetHash: "f".repeat(64),
      alcanceVisaoM: 999,
      controladoPor: ["j2"],
      oculto: true,
      camada: "mestre",
      tamanhoQuadrados: 4,
    });
    const t = dessePersonagem(aplicar(criarEstado(), "j1", i).estado, "p1")[0] as Token;
    expect(t).toMatchObject({
      nome: "Pers p1",
      cor: "#123456",
      tamanhoQuadrados: 1,
      assetHash: "a".repeat(64),
      camada: "tokens",
      oculto: false,
      controladoPor: [],
      personagemId: "p1",
    });
    expect(t.alcanceVisaoM).toBeUndefined();
  });

  it("a capacidade desligada recusa (geral e por usuário)", () => {
    const e = criarEstado();
    expect(codigo(semLigar(e, false), "j1", meu({ personagemId: "p1", tokenId: "t1" }))).toBe(
      "sem_permissao",
    );
    const porUsuario: Estado = {
      ...e,
      permissoes: { ...e.permissoes, porUsuario: { j1: { "token.colocarProprio": false } } },
    };
    expect(codigo(porUsuario, "j1", meu({ personagemId: "p1", tokenId: "t1" }))).toBe(
      "sem_permissao",
    );
    expect(codigo(porUsuario, "j2", meu({ personagemId: "p2", tokenId: "t1" }))).toBeNull();
  });

  it("o mestre segue sem limite: onde quiser e mais de um token do mesmo personagem", () => {
    let e = criarEstado();
    e = aplicar(e, "m", meu({ personagemId: "npc", tokenId: "a", x: 2, y: 2 })).estado;
    e = aplicar(e, "m", meu({ personagemId: "npc", tokenId: "b", x: 50, y: 40 })).estado;
    expect(dessePersonagem(e, "npc")).toHaveLength(2);
    expect(dessePersonagem(e, "npc")[0]).toMatchObject({ x: 2, y: 2 });
  });

  it("vários jogadores sem ponto: cada token cai ao lado do outro, sem sobreposição", () => {
    let e = criarEstado();
    e = aplicar(e, "j1", meu({ personagemId: "p1", tokenId: "t1" })).estado;
    e = aplicar(e, "j2", meu({ personagemId: "p2", tokenId: "t2" })).estado;
    const [a, b] = e.tokens as [Token, Token];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(1.5 - 1e-6);
  });

  it("o token novo chega a quem vê a cena (evento token.criado)", () => {
    const r = aplicar(criarEstado(), "j1", meu({ personagemId: "p1", tokenId: "t1" }));
    expect(r.eventos.map((v) => v.tipo)).toEqual(["token.criado"]);
    expect(visaoPara(r.estado, j1).tokens.map((t) => t.id)).toContain("t1");
  });
});

describe("campanha antiga", () => {
  it("permissões sem a capacidade nova ganham o padrão (ligada) ao importar", () => {
    const base = { ...criarEstado(), personagens: [] };
    const x = JSON.parse(JSON.stringify(criarExportacao(base, AGORA)));
    delete x.dados.permissoes.jogadores["token.colocarProprio"];
    const lida = lerExportacao(x);
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.dados.permissoes.jogadores["token.colocarProprio"]).toBe(true);
  });
});

describe("regras do cliente (podeColocarProprioToken e jogadorVeABandeira)", () => {
  it("sem token na cena: pode e vê a bandeira; com token: não", () => {
    const sem = criarEstado();
    expect(podeColocarProprioToken(sem, j1, sem.personagens[0] as Personagem)).toBe(true);
    expect(jogadorVeABandeira(sem, j1)).toBe(true);
    const com = criarEstado([token("t", { personagemId: "p1" })]);
    expect(podeColocarProprioToken(com, j1, com.personagens[0] as Personagem)).toBe(false);
    expect(jogadorVeABandeira(com, j1)).toBe(false);
  });

  it("token em outra cena não conta; o mestre e quem não controla nada não veem a bandeira", () => {
    const e = criarEstado([token("t", { personagemId: "p1", cenaId: "c2" })]);
    expect(jogadorVeABandeira(e, j1)).toBe(true);
    expect(jogadorVeABandeira(e, { id: "m", papel: "mestre" })).toBe(false);
    expect(jogadorVeABandeira({ ...e, personagens: [] }, j1)).toBe(false);
  });

  it("capacidade desligada: nem pode nem vê", () => {
    const off = semLigar(criarEstado(), false);
    expect(jogadorVeABandeira(off, j1)).toBe(false);
    expect(podeColocarProprioToken(off, j1, off.personagens[0] as Personagem)).toBe(false);
  });
});
