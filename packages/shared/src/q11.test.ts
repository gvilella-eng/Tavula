import { describe, expect, it } from "vitest";
import {
  BORDAS,
  BordaSchema,
  barraDeVidaLigada,
  barraDeVidaPadrao,
  CENA_PADRAO,
  CORES_DA_BORDA,
  type Estado,
  EstadoSchema,
  estadoInicial,
  eventoPara,
  type Intencao,
  IntencaoSchema,
  type Personagem,
  processar,
  ROTULO_DA_BORDA,
  type Token,
  TokenSchema,
  visaoPara,
} from "./index.ts";

// Q11: barra de vida opcional, borda colorida, mover vários e dano em lote.

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
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
    ],
    cenas: [
      { ...CENA_PADRAO, id: "a", nome: "A" },
      { ...CENA_PADRAO, id: "b", nome: "B" },
    ],
    cenaAtivaId: "a",
    pastas: [
      { id: "npcs", nome: "NPCs", ordem: 0, visivel: { tipo: "mestre" } },
      { id: "grupo", nome: "Grupo", ordem: 1, visivel: { tipo: "todos" } },
    ],
    personagens: [npc("gob"), heroi, ...personagens],
    ...extra,
  });
}

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `q${++contador}`, tipo, dados });
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
const colocar = (e: Estado, personagemId: string, tokenId: string, cenaId = "a") =>
  aplicar(e, "m", intencao("personagem.colocar", { personagemId, cenaId, tokenId })).estado;
const tokenDe = (e: Estado, id: string) => e.tokens.find((t) => t.id === id) as Token;

/** Três goblins nos ids g1, g2, g3, cada um com a sua vida. */
function horda(e = criarEstado()): Estado {
  let r = e;
  for (const id of ["g1", "g2", "g3"]) r = colocar(r, "gob", id);
  return r;
}

describe("borda colorida do token (Q11)", () => {
  it("são 8 cores fixas, todas em hexadecimal, sem roxo, e cada uma tem nome", () => {
    expect(BORDAS).toHaveLength(8);
    for (const b of BORDAS) {
      expect(CORES_DA_BORDA[b]).toMatch(/^#[0-9a-f]{6}$/);
      expect(ROTULO_DA_BORDA[b].length).toBeGreaterThan(2);
    }
    expect(new Set(Object.values(CORES_DA_BORDA)).size).toBe(8);
    for (const nome of ["roxo", "violeta", "#ff0000", ""]) {
      expect(BordaSchema.safeParse(nome).success).toBe(false);
    }
  });

  it("o token aceita só as 8 cores; sem o campo, sem borda", () => {
    const base = {
      id: "t",
      cenaId: "a",
      nome: "T",
      cor: "#fff",
      tamanhoQuadrados: 1,
      x: 1,
      y: 1,
      camada: "tokens",
      oculto: false,
      controladoPor: [],
    };
    expect(TokenSchema.safeParse(base).success).toBe(true);
    for (const b of BORDAS) expect(TokenSchema.safeParse({ ...base, borda: b }).success).toBe(true);
    expect(TokenSchema.safeParse({ ...base, borda: "roxo" }).success).toBe(false);
    expect(
      IntencaoSchema.safeParse({
        v: 1,
        id: "x",
        tipo: "token.editar",
        dados: { id: "t", mudancas: { borda: "roxo" } },
      }).success,
    ).toBe(false);
  });

  it("token.editar põe e tira a borda (null tira)", () => {
    let e = colocar(criarEstado(), "gob", "g1");
    e = aplicar(
      e,
      "m",
      intencao("token.editar", { id: "g1", mudancas: { borda: "vermelho" } }),
    ).estado;
    expect(tokenDe(e, "g1").borda).toBe("vermelho");
    e = aplicar(e, "m", intencao("token.editar", { id: "g1", mudancas: { borda: null } })).estado;
    expect("borda" in tokenDe(e, "g1")).toBe(false);
  });

  it("tokens.editar põe a mesma borda em vários num pedido só e não toca nos outros", () => {
    const e0 = horda();
    const r = aplicar(
      e0,
      "m",
      intencao("tokens.editar", { ids: ["g1", "g3"], mudancas: { borda: "azul" } }),
    );
    expect(r.eventos.filter((x) => x.tipo === "token.editado")).toHaveLength(2);
    expect(tokenDe(r.estado, "g1").borda).toBe("azul");
    expect(tokenDe(r.estado, "g3").borda).toBe("azul");
    expect(tokenDe(r.estado, "g2").borda).toBeUndefined();
  });

  it("tokens.editar: um id que não existe recusa o pedido inteiro; só o mestre edita", () => {
    const e0 = horda();
    expect(
      codigo(
        e0,
        "m",
        intencao("tokens.editar", { ids: ["g1", "nao"], mudancas: { borda: "azul" } }),
      ),
    ).toBe("token_inexistente");
    expect(
      codigo(e0, "j1", intencao("tokens.editar", { ids: ["g1"], mudancas: { borda: "azul" } })),
    ).toBe("sem_permissao");
    expect(
      codigo(e0, "j1", intencao("token.editar", { id: "g1", mudancas: { borda: "azul" } })),
    ).toBe("sem_permissao");
  });

  it("todos que veem o token recebem a borda (snapshot e evento)", () => {
    const e0 = horda();
    const r = aplicar(
      e0,
      "m",
      intencao("tokens.editar", { ids: ["g1"], mudancas: { borda: "verde" } }),
    );
    const v = visaoPara(r.estado, { id: "j1", papel: "jogador" });
    expect(v.tokens.find((t) => t.id === "g1")?.borda).toBe("verde");
    const ev = r.eventos.find((x) => x.tipo === "token.editado");
    const visto = eventoPara(ev as never, { id: "j1", papel: "jogador" }, e0, r.estado);
    expect((visto as { dados: { token: Token } }).dados.token.borda).toBe("verde");
  });

  it("a cópia leva a borda e a barra de vida do original", () => {
    let e = colocar(criarEstado(), "gob", "g1");
    e = aplicar(
      e,
      "m",
      intencao("token.editar", { id: "g1", mudancas: { borda: "rosa", barraDeVida: false } }),
    ).estado;
    e = aplicar(
      e,
      "m",
      intencao("token.copiar", { cenaId: "a", itens: [{ origemId: "g1", id: "g1b", x: 9, y: 9 }] }),
    ).estado;
    expect(tokenDe(e, "g1b")).toMatchObject({
      borda: "rosa",
      barraDeVida: false,
      nome: "Goblin 2",
    });
  });
});

describe("barra de vida do token (Q11)", () => {
  it("sem o campo vale ligada (token e token padrão)", () => {
    const e = colocar(criarEstado(), "gob", "g1");
    expect(barraDeVidaLigada(tokenDe(e, "g1"))).toBe(true);
    expect(barraDeVidaLigada({ barraDeVida: false })).toBe(false);
    expect(barraDeVidaLigada({ barraDeVida: true })).toBe(true);
    expect(barraDeVidaPadrao(npc("gob"))).toBe(true);
    expect(
      barraDeVidaPadrao(
        npc("gob", { tokenPadrao: { cor: "#fff", tamanhoQuadrados: 1, barraDeVida: false } }),
      ),
    ).toBe(false);
    expect("barraDeVida" in tokenDe(e, "g1")).toBe(false);
  });

  it("o token nasce com a escolha do token padrão do personagem", () => {
    let e = aplicar(
      criarEstado(),
      "m",
      intencao("personagem.editar", { id: "gob", mudancas: { barraDeVida: false } }),
    ).estado;
    expect(e.personagens.find((p) => p.id === "gob")?.tokenPadrao.barraDeVida).toBe(false);
    e = colocar(e, "gob", "g1");
    expect(tokenDe(e, "g1").barraDeVida).toBe(false);
    // os que nascem em horda também
    e = aplicar(
      e,
      "m",
      intencao("personagem.colocarVarios", {
        personagemId: "gob",
        cenaId: "a",
        tokenIds: ["h1", "h2"],
      }),
    ).estado;
    expect(tokenDe(e, "h2").barraDeVida).toBe(false);
    // ligar de novo tira o campo do padrão; o token já posto continua como estava
    e = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "gob", mudancas: { barraDeVida: true } }),
    ).estado;
    expect("barraDeVida" in (e.personagens.find((p) => p.id === "gob")?.tokenPadrao ?? {})).toBe(
      false,
    );
    expect(tokenDe(e, "g1").barraDeVida).toBe(false);
    e = colocar(e, "gob", "g9");
    expect("barraDeVida" in tokenDe(e, "g9")).toBe(false);
  });

  it("mudar outra coisa do token padrão não apaga a escolha da barra", () => {
    let e = aplicar(
      criarEstado(),
      "m",
      intencao("personagem.editar", { id: "gob", mudancas: { barraDeVida: false } }),
    ).estado;
    e = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "gob", mudancas: { cor: "#123456" } }),
    ).estado;
    expect(e.personagens.find((p) => p.id === "gob")?.tokenPadrao).toMatchObject({
      cor: "#123456",
      barraDeVida: false,
    });
  });

  it("token.criar de NPC (o Claude) também nasce com a escolha do padrão", () => {
    const e0 = aplicar(
      criarEstado(),
      "m",
      intencao("personagem.editar", { id: "gob", mudancas: { barraDeVida: false } }),
    ).estado;
    const e = aplicar(
      e0,
      "m",
      intencao("token.criar", {
        cenaId: "a",
        token: {
          id: "c1",
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
      }),
    ).estado;
    expect(tokenDe(e, "c1").barraDeVida).toBe(false);
  });

  it("tokens.editar liga e desliga a barra de vários (true volta ao padrão, sem o campo)", () => {
    let e = aplicar(
      horda(),
      "m",
      intencao("tokens.editar", { ids: ["g1", "g2"], mudancas: { barraDeVida: false } }),
    ).estado;
    expect(tokenDe(e, "g1").barraDeVida).toBe(false);
    expect(tokenDe(e, "g2").barraDeVida).toBe(false);
    expect(tokenDe(e, "g3").barraDeVida).toBeUndefined();
    e = aplicar(
      e,
      "m",
      intencao("tokens.editar", { ids: ["g1"], mudancas: { barraDeVida: true } }),
    ).estado;
    expect("barraDeVida" in tokenDe(e, "g1")).toBe(false);
  });

  it("a campanha antiga (sem os campos) carrega e passa pelo JSON com os campos novos", () => {
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
    const e = aplicar(
      antigo,
      "m",
      intencao("tokens.editar", {
        ids: ["velho"],
        mudancas: { borda: "ciano", barraDeVida: false },
      }),
    ).estado;
    const volta = EstadoSchema.parse(JSON.parse(JSON.stringify(e)));
    expect(volta.tokens[0]).toMatchObject({ borda: "ciano", barraDeVida: false });
  });
});

describe("tokens.mover (Q11)", () => {
  it("o mestre move vários num pedido só (um evento por token, todos no mesmo pedido)", () => {
    const e0 = horda();
    const r = aplicar(
      e0,
      "m",
      intencao("tokens.mover", {
        itens: [
          { id: "g1", x: 10, y: 10 },
          { id: "g2", x: 12, y: 10 },
          { id: "g3", x: 14, y: 10 },
        ],
      }),
    );
    expect(r.eventos.map((x) => x.tipo)).toEqual(["token.movido", "token.movido", "token.movido"]);
    expect(new Set(r.eventos.map((x) => x.origem.idPedido)).size).toBe(1);
    expect([
      tokenDe(r.estado, "g1").x,
      tokenDe(r.estado, "g2").x,
      tokenDe(r.estado, "g3").x,
    ]).toEqual([10, 12, 14]);
  });

  it("recusa id repetido, id que não existe e o jogador sem controle (nenhum se move)", () => {
    const e0 = horda();
    expect(
      codigo(
        e0,
        "m",
        intencao("tokens.mover", {
          itens: [
            { id: "g1", x: 1, y: 1 },
            { id: "g1", x: 2, y: 2 },
          ],
        }),
      ),
    ).toBe("dados_invalidos");
    expect(
      codigo(
        e0,
        "m",
        intencao("tokens.mover", {
          itens: [
            { id: "g1", x: 1, y: 1 },
            { id: "nao", x: 2, y: 2 },
          ],
        }),
      ),
    ).toBe("token_inexistente");
    expect(codigo(e0, "j1", intencao("tokens.mover", { itens: [{ id: "g1", x: 1, y: 1 }] }))).toBe(
      "sem_permissao",
    );
  });

  it("o jogador não atravessa parede (e nada se move); o mestre ignora", () => {
    const parede = {
      id: "p1",
      cenaId: "a",
      a: { x: 20, y: 0 },
      b: { x: 20, y: 50 },
      tipo: "parede" as const,
    };
    let e = criarEstado({ paredes: [parede] });
    e = aplicar(
      e,
      "m",
      intencao("token.criar", {
        cenaId: "a",
        token: {
          id: "h1",
          nome: "Brisa",
          cor: "#fff",
          tamanhoQuadrados: 1,
          x: 5,
          y: 5,
          camada: "tokens",
          oculto: false,
          controladoPor: ["j1"],
        },
      }),
    ).estado;
    e = aplicar(
      e,
      "m",
      intencao("token.criar", {
        cenaId: "a",
        token: {
          id: "h2",
          nome: "Capanga",
          cor: "#fff",
          tamanhoQuadrados: 1,
          x: 6,
          y: 8,
          camada: "tokens",
          oculto: false,
          controladoPor: ["j1"],
        },
      }),
    ).estado;
    const atravessando = intencao("tokens.mover", {
      itens: [
        { id: "h1", x: 25, y: 5 },
        { id: "h2", x: 26, y: 8 },
      ],
    });
    expect(codigo(e, "j1", atravessando)).toBe("trajeto_bloqueado");
    // sem parede no caminho o jogador move os dois que controla
    const livre = aplicar(
      e,
      "j1",
      intencao("tokens.mover", {
        itens: [
          { id: "h1", x: 8, y: 5 },
          { id: "h2", x: 9, y: 8 },
        ],
      }),
    );
    expect(tokenDe(livre.estado, "h2").x).toBe(9);
    // o mestre ignora a parede
    const mestre = aplicar(e, "m", atravessando);
    expect(tokenDe(mestre.estado, "h1").x).toBe(25);
    expect(tokenDe(mestre.estado, "h2").x).toBe(26);
  });

  it("o destino fica dentro da cena", () => {
    const e = aplicar(
      horda(),
      "m",
      intencao("tokens.mover", { itens: [{ id: "g1", x: -50, y: 9999 }] }),
    ).estado;
    const cena = CENA_PADRAO;
    expect(tokenDe(e, "g1").x).toBeGreaterThanOrEqual(0);
    expect(tokenDe(e, "g1").y).toBeLessThanOrEqual(cena.alturaM);
  });
});

describe("tokens.vidaDelta (Q11)", () => {
  it("dano igual em vários tokens de horda: cada um com a sua vida, só os escolhidos", () => {
    let e = horda();
    e = aplicar(e, "m", intencao("token.vida", { id: "g2", atual: 4 })).estado;
    const r = aplicar(e, "m", intencao("tokens.vidaDelta", { ids: ["g1", "g2"], delta: -3 }));
    expect(r.eventos.every((x) => x.origem.idPedido === r.eventos[0]?.origem.idPedido)).toBe(true);
    expect(tokenDe(r.estado, "g1").pv?.atual).toBe(4);
    expect(tokenDe(r.estado, "g2").pv?.atual).toBe(1);
    expect(tokenDe(r.estado, "g3").pv?.atual).toBe(7);
    expect(r.estado.personagens.find((p) => p.id === "gob")?.ficha?.pvAtual).toBe(7);
  });

  it("os temporários absorvem o dano primeiro; o dano passa do atual só depois", () => {
    let e = horda();
    e = aplicar(e, "m", intencao("token.vida", { id: "g1", temp: 4 })).estado;
    e = aplicar(e, "m", intencao("token.vida", { id: "g2", temp: 10 })).estado;
    e = aplicar(
      e,
      "m",
      intencao("tokens.vidaDelta", { ids: ["g1", "g2", "g3"], delta: -6 }),
    ).estado;
    expect(tokenDe(e, "g1").pv).toEqual({ atual: 5, max: 7 });
    expect(tokenDe(e, "g2").pv).toEqual({ atual: 7, max: 7, temp: 4 });
    expect(tokenDe(e, "g3").pv).toEqual({ atual: 1, max: 7 });
  });

  it("o dano nunca passa de zero e a cura nunca passa do máximo (e não mexe nos temporários)", () => {
    let e = horda();
    e = aplicar(e, "m", intencao("token.vida", { id: "g1", atual: 5, temp: 2 })).estado;
    e = aplicar(e, "m", intencao("tokens.vidaDelta", { ids: ["g1", "g2"], delta: 30 })).estado;
    expect(tokenDe(e, "g1").pv).toEqual({ atual: 7, max: 7, temp: 2 });
    expect(tokenDe(e, "g2").pv).toEqual({ atual: 7, max: 7 });
    e = aplicar(e, "m", intencao("tokens.vidaDelta", { ids: ["g1", "g3"], delta: -99 })).estado;
    expect(tokenDe(e, "g1").pv).toEqual({ atual: 0, max: 7 });
    expect(tokenDe(e, "g3").pv?.atual).toBe(0);
  });

  it("vida da ficha: UMA vez por personagem, mesmo com dois tokens ligados à mesma ficha", () => {
    let e = aplicar(
      criarEstado(),
      "m",
      intencao("personagem.editar", { id: "gob", mudancas: { vidaPorToken: false } }),
    ).estado;
    e = colocar(e, "gob", "u1");
    e = colocar(e, "gob", "u2");
    e = colocar(e, "heroi", "h1", "a");
    e = colocar(e, "heroi", "h2", "b");
    const antes = e;
    // os dois do mesmo vilão e os dois do herói (em cenas diferentes)
    expect(tokenDe(e, "u1").pv).toBeUndefined();
    const r = aplicar(e, "m", intencao("tokens.vidaDelta", { ids: ["u1", "u2", "h1"], delta: -3 }));
    expect(r.estado.personagens.find((p) => p.id === "gob")?.ficha?.pvAtual).toBe(4);
    expect(r.estado.personagens.find((p) => p.id === "heroi")?.ficha?.pvAtual).toBe(17);
    expect(r.eventos.filter((x) => x.tipo === "personagem.alterado")).toHaveLength(2);
    expect(r.eventos.filter((x) => x.tipo === "token.editado")).toHaveLength(0);
    // temporários da ficha também são consumidos primeiro
    const comTemp = aplicar(
      antes,
      "m",
      intencao("ficha.alterar", {
        personagemId: "heroi",
        operacoes: [{ caminho: "pvTemp", valor: 5 }],
      }),
    ).estado;
    const r2 = aplicar(
      comTemp,
      "m",
      intencao("tokens.vidaDelta", { ids: ["h1", "h2"], delta: -8 }),
    );
    expect(r2.estado.personagens.find((p) => p.id === "heroi")?.ficha).toMatchObject({
      pvAtual: 17,
    });
    expect(r2.estado.personagens.find((p) => p.id === "heroi")?.ficha?.pvTemp).toBeUndefined();
  });

  it("misturar horda, ficha e token sem personagem: o sem personagem fica de fora", () => {
    let e = horda();
    e = aplicar(
      e,
      "m",
      intencao("token.criar", {
        cenaId: "a",
        token: {
          id: "solto",
          nome: "Pedra",
          cor: "#999",
          tamanhoQuadrados: 1,
          x: 3,
          y: 3,
          camada: "tokens",
          oculto: false,
          controladoPor: [],
        },
      }),
    ).estado;
    e = colocar(e, "heroi", "h1");
    const r = aplicar(
      e,
      "m",
      intencao("tokens.vidaDelta", { ids: ["g1", "solto", "h1"], delta: -2 }),
    );
    expect(tokenDe(r.estado, "g1").pv?.atual).toBe(5);
    expect(r.estado.personagens.find((p) => p.id === "heroi")?.ficha?.pvAtual).toBe(18);
  });

  it("recusa delta 0, ids repetidos, token que não existe; o jogador só nos tokens do personagem que edita", () => {
    let e = horda();
    e = colocar(e, "heroi", "h1");
    expect(
      IntencaoSchema.safeParse({
        v: 1,
        id: "z",
        tipo: "tokens.vidaDelta",
        dados: { ids: ["g1"], delta: 0 },
      }).success,
    ).toBe(false);
    expect(codigo(e, "m", intencao("tokens.vidaDelta", { ids: ["g1", "g1"], delta: -1 }))).toBe(
      "dados_invalidos",
    );
    expect(codigo(e, "m", intencao("tokens.vidaDelta", { ids: ["g1", "nao"], delta: -1 }))).toBe(
      "token_inexistente",
    );
    // o jogador não vê a pasta dos NPCs: o goblin responde como se não existisse para a ficha
    expect(codigo(e, "j1", intencao("tokens.vidaDelta", { ids: ["g1"], delta: -1 }))).toBe(
      "token_inexistente",
    );
    expect(codigo(e, "j2", intencao("tokens.vidaDelta", { ids: ["h1"], delta: -1 }))).toBe(
      "sem_permissao",
    );
    // quem edita o herói muda a vida dele
    const r = aplicar(e, "j1", intencao("tokens.vidaDelta", { ids: ["h1"], delta: -4 }));
    expect(r.estado.personagens.find((p) => p.id === "heroi")?.ficha?.pvAtual).toBe(16);
  });

  it("o jogador não recebe a vida própria do token de NPC (eventos do dano em lote passam pelo filtro)", () => {
    const e0 = horda();
    const r = aplicar(e0, "m", intencao("tokens.vidaDelta", { ids: ["g1", "g2"], delta: -3 }));
    const eventos = r.eventos.filter((x) => x.tipo === "token.editado");
    expect(eventos).toHaveLength(2);
    for (const ev of eventos) {
      const doJogador = eventoPara(ev as never, { id: "j1", papel: "jogador" }, e0, r.estado);
      expect(JSON.stringify(doJogador)).not.toContain('"atual"');
      const doMestre = eventoPara(ev as never, { id: "m", papel: "mestre" }, e0, r.estado);
      expect(JSON.stringify(doMestre)).toContain('"atual":4');
    }
    const v = visaoPara(r.estado, { id: "j1", papel: "jogador" });
    expect(JSON.stringify(v.tokens)).not.toContain('"atual"');
  });

  it("a vida da ficha do herói chega ao jogador dono (personagem.alterado)", () => {
    let e0 = colocar(horda(), "heroi", "h1");
    e0 = aplicar(
      e0,
      "m",
      intencao("permissao.alterar", { capacidade: "ficha.verOutras", valor: true }),
    ).estado;
    const r = aplicar(e0, "m", intencao("tokens.vidaDelta", { ids: ["h1"], delta: -5 }));
    const ev = r.eventos.find((x) => x.tipo === "personagem.alterado");
    const visto = eventoPara(ev as never, { id: "j1", papel: "jogador" }, e0, r.estado);
    expect(JSON.stringify(visto)).toContain('"pvAtual":15');
  });
});
