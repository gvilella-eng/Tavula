import { describe, expect, it } from "vitest";
import {
  CENA_PADRAO,
  type Estado,
  EstadoSchema,
  estadoInicial,
  eventoPara,
  type Intencao,
  IntencaoSchema,
  nomeBaseDoToken,
  nomeNumerado,
  type Personagem,
  processar,
  type Token,
  usaVidaPorToken,
  vidaDoToken,
  visaoPara,
} from "./index.ts";

// Q10: hordas. Vida própria por token de NPC, numeração, pôr vários, copiar.

const AGORA = "2026-01-01T00:00:00.000Z";

function npc(id: string, extra: Partial<Personagem> = {}): Personagem {
  return {
    id,
    pastaId: "npcs",
    editores: { tipo: "jogadores", ids: [] },
    nome: id === "gob" ? "Goblin" : `NPC ${id}`,
    tokenPadrao: { cor: "#2a7", tamanhoQuadrados: 1 },
    visao: { alcanceM: null, visaoNoEscuroM: 0 },
    ficha: { pvAtual: 7, pvMax: 7 },
    ...extra,
  };
}
const heroi: Personagem = {
  id: "heroi",
  pastaId: "grupo",
  editores: { tipo: "jogadores", ids: ["j1"] },
  nome: "Brisa",
  tokenPadrao: { cor: "#c0a", tamanhoQuadrados: 1 },
  visao: { alcanceM: null, visaoNoEscuroM: 0 },
  ficha: { pvAtual: 20, pvMax: 20 },
};

function criarEstado(extra: Partial<Estado> = {}, personagens: Personagem[] = []): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
    ],
    cenas: [
      { ...CENA_PADRAO, id: "a", nome: "A" },
      { ...CENA_PADRAO, id: "b", nome: "B" },
    ],
    cenaAtivaId: "a",
    pastas: [
      { id: "npcs", nome: "NPCs", ordem: 0, visivel: { tipo: "mestre" } },
      { id: "grupo", nome: "Grupo", ordem: 1, visivel: { tipo: "todos" } },
      { id: "amigos", nome: "Amigos", ordem: 2, visivel: { tipo: "todos" } },
    ],
    personagens: [npc("gob"), heroi, ...personagens],
    ...extra,
  });
}

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `h${++contador}`, tipo, dados });
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
const colocarGoblin = (e: Estado, tokenId: string, cenaId = "a") =>
  aplicar(e, "m", intencao("personagem.colocar", { personagemId: "gob", cenaId, tokenId })).estado;
const tokenDe = (e: Estado, id: string) => e.tokens.find((t) => t.id === id) as Token;
const nomes = (e: Estado, cenaId: string) =>
  e.tokens.filter((t) => t.cenaId === cenaId).map((t) => t.nome);

describe("vida própria do token (Q10)", () => {
  it("o token de NPC nasce com uma cópia dos PV da ficha (o atual e o máximo de agora)", () => {
    const e0 = criarEstado({}, []);
    const e1 = aplicar(
      e0,
      "m",
      intencao("ficha.alterar", {
        personagemId: "gob",
        operacoes: [
          { caminho: "pvAtual", valor: 5 },
          { caminho: "pvTemp", valor: 3 },
        ],
      }),
    ).estado;
    const e = colocarGoblin(e1, "t1");
    expect(tokenDe(e, "t1").pv).toEqual({ atual: 5, max: 7, temp: 3 });
  });

  it("personagem de jogador nunca ganha vida própria no token", () => {
    const e = aplicar(
      criarEstado(),
      "m",
      intencao("personagem.colocar", { personagemId: "heroi", cenaId: "a", tokenId: "th" }),
    ).estado;
    expect(tokenDe(e, "th").pv).toBeUndefined();
    expect(vidaDoToken(tokenDe(e, "th"), heroi)).toMatchObject({ atual: 20, propria: false });
  });

  it("dano em um token não muda o outro nem a ficha", () => {
    let e = colocarGoblin(criarEstado(), "t1");
    e = colocarGoblin(e, "t2");
    e = aplicar(e, "m", intencao("token.vida", { id: "t2", atual: 2 })).estado;
    expect(tokenDe(e, "t1").pv?.atual).toBe(7);
    expect(tokenDe(e, "t2").pv?.atual).toBe(2);
    expect(e.personagens.find((p) => p.id === "gob")?.ficha?.pvAtual).toBe(7);
  });

  it("o atual nunca passa do máximo e o temporário 0 ou null some", () => {
    let e = colocarGoblin(criarEstado(), "t1");
    e = aplicar(e, "m", intencao("token.vida", { id: "t1", atual: 50, temp: 4 })).estado;
    expect(tokenDe(e, "t1").pv).toEqual({ atual: 7, max: 7, temp: 4 });
    e = aplicar(e, "m", intencao("token.vida", { id: "t1", max: 5, temp: null })).estado;
    expect(tokenDe(e, "t1").pv).toEqual({ atual: 5, max: 5 });
  });

  it("com a escolha desligada o token não tem vida própria e volta a usar a ficha", () => {
    let e = aplicar(
      criarEstado(),
      "m",
      intencao("personagem.editar", { id: "gob", mudancas: { vidaPorToken: false } }),
    ).estado;
    e = colocarGoblin(e, "t1");
    const gob = e.personagens.find((p) => p.id === "gob") as Personagem;
    expect(usaVidaPorToken(gob)).toBe(false);
    expect(tokenDe(e, "t1").pv).toBeUndefined();
    expect(vidaDoToken(tokenDe(e, "t1"), gob)).toMatchObject({ atual: 7, propria: false });
    expect(codigo(e, "m", intencao("token.vida", { id: "t1", atual: 1 }))).toBe("dados_invalidos");
  });

  it("desligar depois de pôr: o pv que o token guardou deixa de valer", () => {
    let e = colocarGoblin(criarEstado(), "t1");
    e = aplicar(e, "m", intencao("token.vida", { id: "t1", atual: 1 })).estado;
    e = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "gob", mudancas: { vidaPorToken: false } }),
    ).estado;
    const gob = e.personagens.find((p) => p.id === "gob") as Personagem;
    expect(vidaDoToken(tokenDe(e, "t1"), gob)).toMatchObject({ atual: 7, propria: false });
  });

  it("token antigo (sem pv) de NPC lê a ficha como se fosse dele e a primeira edição grava no token", () => {
    const antigo: Token = {
      id: "velho",
      cenaId: "a",
      nome: "Goblin",
      cor: "#2a7",
      tamanhoQuadrados: 1,
      x: 3,
      y: 3,
      camada: "tokens",
      oculto: false,
      controladoPor: [],
      personagemId: "gob",
    };
    let e = criarEstado({ tokens: [antigo] });
    const gob = e.personagens.find((p) => p.id === "gob") as Personagem;
    expect(vidaDoToken(antigo, gob)).toMatchObject({ atual: 7, propria: true });
    e = aplicar(e, "m", intencao("token.vida", { id: "velho", atual: 4 })).estado;
    expect(tokenDe(e, "velho").pv).toEqual({ atual: 4, max: 7 });
    expect(e.personagens.find((p) => p.id === "gob")?.ficha?.pvAtual).toBe(7);
  });

  it("só o mestre liga ou desliga a escolha da horda", () => {
    const e = criarEstado({}, []);
    e.personagens = e.personagens.map((p) => (p.id === "heroi" ? { ...p, criadoPor: "j1" } : p));
    expect(
      codigo(
        e,
        "j1",
        intencao("personagem.editar", { id: "heroi", mudancas: { vidaPorToken: false } }),
      ),
    ).toBe("sem_permissao");
  });

  it("só o mestre ou quem edita o personagem muda a vida do token", () => {
    const e = colocarGoblin(criarEstado(), "t1");
    expect(codigo(e, "j1", intencao("token.vida", { id: "t1", atual: 1 }))).not.toBeNull();
  });

  it("token.criar de NPC (o Claude) também nasce com a vida do modelo", () => {
    const e = aplicar(
      criarEstado(),
      "m",
      intencao("token.criar", {
        cenaId: "a",
        token: {
          id: "tc",
          nome: "Goblin 1",
          cor: "#2a7",
          tamanhoQuadrados: 1,
          x: 3,
          y: 3,
          camada: "tokens",
          oculto: false,
          controladoPor: [],
          personagemId: "gob",
        },
      }),
    ).estado;
    expect(tokenDe(e, "tc").pv).toEqual({ atual: 7, max: 7 });
  });
});

describe("numeração automática (Q10)", () => {
  it("o primeiro fica sem número e os outros ganham 2, 3...", () => {
    let e = colocarGoblin(criarEstado(), "t1");
    e = colocarGoblin(e, "t2");
    e = colocarGoblin(e, "t3");
    expect(nomes(e, "a")).toEqual(["Goblin", "Goblin 2", "Goblin 3"]);
    expect(tokenDe(e, "t1").numero).toBeUndefined();
    expect(tokenDe(e, "t3").numero).toBe(3);
  });

  it("depois de apagar o 2, o próximo é o 2; ninguém é renomeado", () => {
    let e = colocarGoblin(criarEstado(), "t1");
    e = colocarGoblin(e, "t2");
    e = colocarGoblin(e, "t3");
    e = aplicar(e, "m", intencao("token.apagar", { id: "t2" })).estado;
    e = colocarGoblin(e, "t4");
    expect(nomes(e, "a")).toEqual(["Goblin", "Goblin 3", "Goblin 2"]);
  });

  it("é por cena", () => {
    let e = colocarGoblin(criarEstado(), "t1", "a");
    e = colocarGoblin(e, "t2", "b");
    expect(nomes(e, "a")).toEqual(["Goblin"]);
    expect(nomes(e, "b")).toEqual(["Goblin"]);
  });

  it("nome que o mestre mudou não conta; personagem de jogador não é numerado", () => {
    let e = colocarGoblin(criarEstado(), "t1");
    e = aplicar(e, "m", intencao("token.editar", { id: "t1", mudancas: { nome: "Chefe" } })).estado;
    e = colocarGoblin(e, "t2");
    // há outro token do personagem na cena: o novo leva o 2 mesmo com o primeiro renomeado
    expect(nomes(e, "a")).toEqual(["Chefe", "Goblin 2"]);
    let p = aplicar(
      criarEstado(),
      "m",
      intencao("personagem.colocar", { personagemId: "heroi", cenaId: "a", tokenId: "h1" }),
    ).estado;
    p = aplicar(
      p,
      "m",
      intencao("personagem.colocar", { personagemId: "heroi", cenaId: "b", tokenId: "h2" }),
    ).estado;
    expect(p.tokens.map((t) => t.nome)).toEqual(["Brisa", "Brisa"]);
  });

  it("dois pedidos em seguida nunca repetem o número (a sala numera)", () => {
    let e = colocarGoblin(criarEstado(), "t1");
    const a = aplicar(
      e,
      "m",
      intencao("personagem.colocar", { personagemId: "gob", cenaId: "a", tokenId: "x" }),
    );
    e = a.estado;
    const b = aplicar(
      e,
      "m",
      intencao("personagem.colocar", { personagemId: "gob", cenaId: "a", tokenId: "y" }),
    );
    expect(b.estado.tokens.map((t) => t.nome)).toEqual(["Goblin", "Goblin 2", "Goblin 3"]);
  });

  it("nomeNumerado e nomeBaseDoToken", () => {
    const lista = [{ cenaId: "a", personagemId: "p", nome: "Orc" }];
    expect(nomeNumerado(lista, "a", "p", "Orc")).toEqual({ nome: "Orc 2", numero: 2 });
    expect(nomeNumerado(lista, "b", "p", "Orc")).toEqual({ nome: "Orc" });
    expect(nomeBaseDoToken({ nome: "Orc 4", numero: 4 })).toBe("Orc");
    expect(nomeBaseDoToken({ nome: "Chefe", numero: 4 })).toBe("Chefe");
    expect(nomeBaseDoToken({ nome: "Orc" })).toBe("Orc");
  });
});

describe("personagem.colocarVarios (Q10)", () => {
  it("põe 4 goblins numerados, arrumados no grid, cada um com a sua vida, num pedido só", () => {
    const r = aplicar(
      criarEstado(),
      "m",
      intencao("personagem.colocarVarios", {
        personagemId: "gob",
        cenaId: "a",
        tokenIds: ["g1", "g2", "g3", "g4"],
        x: 15,
        y: 15,
      }),
    );
    expect(nomes(r.estado, "a")).toEqual(["Goblin", "Goblin 2", "Goblin 3", "Goblin 4"]);
    expect(r.eventos.filter((ev) => ev.tipo === "token.criado")).toHaveLength(4);
    const lugares = r.estado.tokens.map((t) => `${t.x},${t.y}`);
    expect(new Set(lugares).size).toBe(4);
    for (const t of r.estado.tokens) expect(t.pv).toEqual({ atual: 7, max: 7 });
  });

  it("continua a numeração de quem já está na cena e recusa ids repetidos ou jogador", () => {
    const e = colocarGoblin(criarEstado(), "t1");
    const r = aplicar(
      e,
      "m",
      intencao("personagem.colocarVarios", {
        personagemId: "gob",
        cenaId: "a",
        tokenIds: ["g1", "g2"],
      }),
    );
    expect(nomes(r.estado, "a")).toEqual(["Goblin", "Goblin 2", "Goblin 3"]);
    expect(
      codigo(
        e,
        "m",
        intencao("personagem.colocarVarios", {
          personagemId: "gob",
          cenaId: "a",
          tokenIds: ["g1", "g1"],
        }),
      ),
    ).toBe("dados_invalidos");
    expect(
      codigo(
        e,
        "m",
        intencao("personagem.colocarVarios", {
          personagemId: "heroi",
          cenaId: "a",
          tokenIds: ["h1", "h2"],
        }),
      ),
    ).toBe("dados_invalidos");
  });

  it("só o mestre", () => {
    expect(
      codigo(
        criarEstado(),
        "j1",
        intencao("personagem.colocarVarios", {
          personagemId: "gob",
          cenaId: "a",
          tokenIds: ["g1"],
        }),
      ),
    ).toBe("sem_permissao");
  });

  it("o limite é 20", () => {
    const ids = Array.from({ length: 21 }, (_, i) => `g${i}`);
    expect(
      IntencaoSchema.safeParse({
        v: 1,
        id: "z",
        tipo: "personagem.colocarVarios",
        dados: { personagemId: "gob", cenaId: "a", tokenIds: ids },
      }).success,
    ).toBe(false);
  });
});

describe("token.copiar (Q10)", () => {
  function comGoblinFerido() {
    let e = colocarGoblin(criarEstado(), "t1");
    e = aplicar(e, "m", intencao("token.vida", { id: "t1", atual: 3 })).estado;
    e = aplicar(
      e,
      "m",
      intencao("token.editar", {
        id: "t1",
        mudancas: { oculto: true, camada: "mestre", tamanhoQuadrados: 2 },
      }),
    ).estado;
    e = aplicar(
      e,
      "m",
      intencao("token.condicoes", { id: "t1", condicoes: ["caido"], exaustao: 2 }),
    ).estado;
    return e;
  }

  it("a cópia é igual ao original (vida de agora, condições, camada, oculto, tamanho) com o próximo número", () => {
    const e = comGoblinFerido();
    const r = aplicar(
      e,
      "m",
      intencao("token.copiar", { cenaId: "a", itens: [{ origemId: "t1", id: "c1", x: 9, y: 9 }] }),
    );
    const copia = tokenDe(r.estado, "c1");
    const origem = tokenDe(r.estado, "t1");
    expect(copia).toMatchObject({
      nome: "Goblin 2",
      numero: 2,
      x: 9,
      y: 9,
      cenaId: "a",
      tamanhoQuadrados: 2,
      camada: "mestre",
      oculto: true,
      condicoes: ["caido"],
      exaustao: 2,
      personagemId: "gob",
      pv: { atual: 3, max: 7 },
    });
    expect(origem.nome).toBe("Goblin");
  });

  it("dois itens no mesmo pedido saem numerados em sequência", () => {
    const r = aplicar(
      comGoblinFerido(),
      "m",
      intencao("token.copiar", {
        cenaId: "a",
        itens: [
          { origemId: "t1", id: "c1", x: 9, y: 9 },
          { origemId: "t1", id: "c2", x: 10, y: 9 },
        ],
      }),
    );
    expect(nomes(r.estado, "a")).toEqual(["Goblin", "Goblin 2", "Goblin 3"]);
  });

  it("copiar de uma cena e colar em outra: o nome volta ao do modelo e o número segue a cena nova", () => {
    let e = colocarGoblin(criarEstado(), "t1");
    e = colocarGoblin(e, "t2");
    const r = aplicar(
      e,
      "m",
      intencao("token.copiar", { cenaId: "b", itens: [{ origemId: "t2", id: "c1", x: 4, y: 4 }] }),
    );
    expect(tokenDe(r.estado, "c1")).toMatchObject({ cenaId: "b", nome: "Goblin" });
    expect(tokenDe(r.estado, "c1").numero).toBeUndefined();
    expect(tokenDe(r.estado, "c1").pv).toEqual({ atual: 7, max: 7 });
  });

  it("personagem de jogador: um token só por cena (Q8); em outra cena a cópia entra com o mesmo nome", () => {
    const e = aplicar(
      criarEstado(),
      "m",
      intencao("personagem.colocar", { personagemId: "heroi", cenaId: "a", tokenId: "h1" }),
    ).estado;
    expect(
      codigo(
        e,
        "m",
        intencao("token.copiar", {
          cenaId: "a",
          itens: [{ origemId: "h1", id: "h2", x: 8, y: 8 }],
        }),
      ),
    ).toBe("dados_invalidos");
    // dois do mesmo jogador no mesmo pedido, para uma cena onde ele não está: também não
    expect(
      codigo(
        e,
        "m",
        intencao("token.copiar", {
          cenaId: "b",
          itens: [
            { origemId: "h1", id: "h2", x: 8, y: 8 },
            { origemId: "h1", id: "h3", x: 9, y: 8 },
          ],
        }),
      ),
    ).toBe("dados_invalidos");
    const outra = aplicar(
      e,
      "m",
      intencao("token.copiar", { cenaId: "b", itens: [{ origemId: "h1", id: "h2", x: 8, y: 8 }] }),
    ).estado;
    expect(outra.tokens.filter((t) => t.personagemId === "heroi").map((t) => t.nome)).toEqual([
      "Brisa",
      "Brisa",
    ]);
    expect(tokenDe(outra, "h2").cenaId).toBe("b");
  });

  it("token sem personagem: cópia com o mesmo nome", () => {
    const solto: Token = {
      id: "s1",
      cenaId: "a",
      nome: "Barril",
      cor: "#555",
      tamanhoQuadrados: 1,
      x: 2,
      y: 2,
      camada: "tokens",
      oculto: false,
      controladoPor: [],
    };
    const r = aplicar(
      criarEstado({ tokens: [solto] }),
      "m",
      intencao("token.copiar", { cenaId: "a", itens: [{ origemId: "s1", id: "s2", x: 6, y: 6 }] }),
    );
    expect(tokenDe(r.estado, "s2").nome).toBe("Barril");
  });

  it("só o mestre; origem sumida e id repetido são recusados", () => {
    const e = colocarGoblin(criarEstado(), "t1");
    const copiar = (itens: object[]) => intencao("token.copiar", { cenaId: "a", itens });
    expect(codigo(e, "j1", copiar([{ origemId: "t1", id: "c1", x: 1, y: 1 }]))).toBe(
      "sem_permissao",
    );
    expect(codigo(e, "m", copiar([{ origemId: "nada", id: "c1", x: 1, y: 1 }]))).toBe(
      "token_inexistente",
    );
    expect(codigo(e, "m", copiar([{ origemId: "t1", id: "t1", x: 1, y: 1 }]))).toBe(
      "dados_invalidos",
    );
  });
});

describe("o jogador e a vida do token de NPC (Q10)", () => {
  function comGoblins(extra: Partial<Estado> = {}, personagens: Personagem[] = []) {
    let e = criarEstado(extra, personagens);
    e = colocarGoblin(e, "t1");
    return aplicar(e, "m", intencao("token.vida", { id: "t1", atual: 4 })).estado;
  }

  it("o snapshot do jogador não leva o pv do token de NPC (a ficha não chega a ele)", () => {
    const v = visaoPara(comGoblins(), { id: "j1", papel: "jogador" });
    const t = v.tokens.find((x) => x.id === "t1") as Token;
    expect(t).toBeDefined();
    expect(t.pv).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain('"atual":4');
  });

  it("o mestre recebe o pv", () => {
    const v = visaoPara(comGoblins(), { id: "m", papel: "mestre" });
    expect(v.tokens.find((x) => x.id === "t1")?.pv).toEqual({ atual: 4, max: 7 });
  });

  it("o evento de criar, editar e copiar também chega sem o pv", () => {
    const e0 = criarEstado();
    const r = aplicar(
      e0,
      "m",
      intencao("personagem.colocar", { personagemId: "gob", cenaId: "a", tokenId: "t1" }),
    );
    const ev = r.eventos.find((x) => x.tipo === "token.criado");
    const visto = eventoPara(ev as never, { id: "j1", papel: "jogador" }, e0, r.estado);
    expect(visto?.tipo).toBe("token.criado");
    expect((visto as { dados: { token: Token } }).dados.token.pv).toBeUndefined();
    const v2 = aplicar(r.estado, "m", intencao("token.vida", { id: "t1", atual: 1 }));
    const ed = v2.eventos.find((x) => x.tipo === "token.editado");
    const visto2 = eventoPara(ed as never, { id: "j1", papel: "jogador" }, r.estado, v2.estado);
    expect((visto2 as { dados: { token: Token } }).dados.token.pv).toBeUndefined();
    const doMestre = eventoPara(ed as never, { id: "m", papel: "mestre" }, r.estado, v2.estado);
    expect((doMestre as { dados: { token: Token } }).dados.token.pv).toEqual({ atual: 1, max: 7 });
    // sem o estado de antes e de depois, o jogador não recebe nada (falha fechada)
    const semEstado = eventoPara(ed as never, { id: "j1", papel: "jogador" });
    expect(semEstado).toBeNull();
  });

  it("se a ficha chegaria hoje (pasta visível e ficha.verOutras), o pv chega", () => {
    const visivel = npc("amigo", { pastaId: "amigos" });
    let e = criarEstado({}, [visivel]);
    e = aplicar(
      e,
      "m",
      intencao("personagem.colocar", { personagemId: "amigo", cenaId: "a", tokenId: "ta" }),
    ).estado;
    // pasta visível, mas sem ficha.verOutras: a ficha não chega, o pv também não
    let v = visaoPara(e, { id: "j1", papel: "jogador" });
    expect(v.tokens.find((x) => x.id === "ta")?.pv).toBeUndefined();
    expect(v.personagens.find((p) => p.id === "amigo")?.ficha).toBeUndefined();
    e = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "ficha.verOutras", valor: true }),
    ).estado;
    v = visaoPara(e, { id: "j1", papel: "jogador" });
    expect(v.personagens.find((p) => p.id === "amigo")?.ficha).toBeDefined();
    expect(v.tokens.find((x) => x.id === "ta")?.pv).toEqual({ atual: 7, max: 7 });
  });

  it("o jogador não cola, não duplica nem põe vários", () => {
    const e = comGoblins();
    expect(
      codigo(
        e,
        "j1",
        intencao("token.copiar", { cenaId: "a", itens: [{ origemId: "t1", id: "z", x: 1, y: 1 }] }),
      ),
    ).toBe("sem_permissao");
  });

  it("mudar quem vê a ficha do NPC manda snapshot novo aos jogadores", () => {
    const e = comGoblins();
    const r = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "gob", mudancas: { pastaId: "amigos" } }),
    );
    expect(r.snapshotPara).toBe("todos");
  });
});

describe("campanha antiga e exportação (Q10)", () => {
  it("o estado sem pv, numero e vidaPorToken carrega e continua valendo", () => {
    const antigo = criarEstado({
      tokens: [
        {
          id: "velho",
          cenaId: "a",
          nome: "Goblin",
          cor: "#2a7",
          tamanhoQuadrados: 1,
          x: 3,
          y: 3,
          camada: "tokens",
          oculto: false,
          controladoPor: [],
          personagemId: "gob",
        },
      ],
    });
    expect(EstadoSchema.safeParse(JSON.parse(JSON.stringify(antigo))).success).toBe(true);
  });

  it("o estado com pv, numero e vidaPorToken passa pelo JSON (exportar e importar a mesa)", () => {
    let e = colocarGoblin(criarEstado(), "t1");
    e = colocarGoblin(e, "t2");
    e = aplicar(e, "m", intencao("token.vida", { id: "t2", atual: 2, temp: 5 })).estado;
    e = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "gob", mudancas: { vidaPorToken: true } }),
    ).estado;
    const volta = EstadoSchema.parse(JSON.parse(JSON.stringify(e)));
    expect(volta.tokens.find((t) => t.id === "t2")).toMatchObject({
      numero: 2,
      pv: { atual: 2, max: 7, temp: 5 },
    });
  });
});
