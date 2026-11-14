import { describe, expect, it } from "vitest";
import {
  AutomacoesSchema,
  CicloSchema,
  capacidadeDaIntencao,
  criarExportacao,
  desfazerPassos,
  diffDoEstado,
  type Estado,
  estadoInicial,
  eventoPara,
  fonteComSemente,
  gastarFicha,
  INTENCOES_PROIBIDAS_AO_CLAUDE,
  type Intencao,
  IntencaoSchema,
  idDaPastaDoJogador,
  LIMITE_DO_CLAUDE,
  listarRascunhos,
  modelosPadrao,
  type Passo,
  processar,
  processarSistema,
  recusaDoClaude,
  TETO_DE_CRIACAO_DO_JOGADOR,
  tokenDoCabecalho,
  visaoPara,
} from "./index.ts";

// 12-1: o Claude entra como o próprio usuário e nunca alcança mais do que ele; o que o Claude do mestre cria é rascunho;
// o jogador cria as próprias fichas e handouts (com teto); "Desfazer o que o Claude fez".

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (s = 0) => new Date(T0 + s * 1000).toISOString();
const CLAUDE = { claude: true } as const;

let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });

const personagem = (id: string, extra: object = {}) => ({
  id,
  pastaId: "pasta-npcs",
  editores: { tipo: "jogadores", ids: [] },
  nome: `Nome ${id}`,
  tokenPadrao: { cor: "#c0392b", tamanhoQuadrados: 1 },
  visao: { alcanceM: null, visaoNoEscuroM: 0 },
  ...extra,
});
const handout = (id: string, extra: object = {}) => ({
  id,
  pastaId: "pasta-personagens",
  titulo: `Handout ${id}`,
  texto: `Texto ${id}`,
  fonte: "livro",
  visivel: { tipo: "mestre" },
  ...extra,
});

function criarEstado(): Estado {
  return estadoInicial(
    {
      usuarios: [
        { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
        { id: "j1", nome: "Ana", papel: "jogador", cor: "#333" },
        { id: "j2", nome: "Bia", papel: "jogador", cor: "#444" },
      ],
      cenas: [
        {
          id: "c1",
          nome: "Cena 1",
          larguraM: 30,
          alturaM: 30,
          grid: { quadradoM: 1.5, visivel: true },
        },
      ],
      cenaAtivaId: "c1",
      modelos: modelosPadrao(),
    },
    T0,
  );
}

type Opcoes = { claude?: boolean };
function ok(e: Estado, quem: string, i: Intencao, o: Opcoes = {}, segundos = 0) {
  const r = processar(e, quem, i, iso(segundos), fonteComSemente(1), [], o);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} (${r.erro.mensagem})`);
  return r;
}
function erro(e: Estado, quem: string, i: Intencao, o: Opcoes = {}): string | null {
  const r = processar(e, quem, i, iso(), fonteComSemente(1), [], o);
  return r.ok ? null : r.erro.codigo;
}
const J = (id: string) => ({ id, papel: "jogador" as const });
const M = { id: "m", papel: "mestre" as const };

describe("o que o Claude nunca faz (lista num lugar só)", () => {
  it("a lista cobre papéis, permissões, importar e exportar e o vaivém de arquivos; todos são intenções de verdade", () => {
    expect([...INTENCOES_PROIBIDAS_AO_CLAUDE].sort()).toEqual(
      [
        "asset.inventario",
        "asset.naoTenho",
        "asset.pedir",
        "asset.tenho",
        "caixa.concluir",
        "caixa.falhar",
        "campanha.exportar",
        "campanha.importar",
        "papel.alterar",
        "permissao.alterar",
      ].sort(),
    );
    for (const t of INTENCOES_PROIBIDAS_AO_CLAUDE) expect(t in capacidadeDaIntencao).toBe(true);
    expect(recusaDoClaude("papel.alterar")).toContain("O Claude não pode");
    expect(recusaDoClaude("token.criar")).toBeNull();
  });

  it("recusa com sem_permissao mesmo para o mestre, e a mesma intenção passa fora do Claude", () => {
    const e = criarEstado();
    const hash = "a".repeat(64);
    const proibidas: Intencao[] = [
      intencao("papel.alterar", { usuarioId: "j1", papel: "mestre" }),
      intencao("permissao.alterar", { capacidade: "nota.editar", valor: false }),
      intencao("campanha.exportar"),
      intencao("campanha.importar", { dados: criarExportacao(e, iso()) }),
      intencao("asset.pedir", { hash }),
      intencao("asset.inventario", { hashes: [hash] }),
      intencao("asset.tenho", { hash }),
      intencao("asset.naoTenho", { hash }),
      // M1: a caixa de entrada é do mestre pelo navegador, nunca do Claude.
      intencao("caixa.concluir", { envioId: "env-1", hash }),
      intencao("caixa.falhar", { envioId: "env-1", motivo: "x" }),
    ];
    expect(proibidas.map((i) => i.tipo).sort()).toEqual([...INTENCOES_PROIBIDAS_AO_CLAUDE].sort());
    for (const i of proibidas) {
      const r = processar(e, "m", i, iso(), fonteComSemente(1), [], CLAUDE);
      expect(r.ok, i.tipo).toBe(false);
      expect(!r.ok && r.erro.codigo, i.tipo).toBe("sem_permissao");
      expect(!r.ok && r.erro.mensagem, i.tipo).toContain("O Claude não pode");
    }
    // o mestre, pela mesa, faz (papel e permissão)
    expect(erro(e, "m", proibidas[0] as Intencao)).toBeNull();
    expect(erro(e, "m", proibidas[1] as Intencao)).toBeNull();
    expect(erro(e, "m", proibidas[2] as Intencao)).toBeNull();
  });
});

describe("o Claude do jogador não alcança mais do que o jogador", () => {
  it("não edita a ficha de outro nem vê o que o jogador não vê", () => {
    let e = criarEstado();
    // a ficha da Bia (j2), na pasta só do mestre
    e = ok(
      e,
      "m",
      intencao("personagem.criar", {
        personagem: personagem("bia", {
          pastaId: "pasta-personagens",
          editores: { tipo: "jogadores", ids: ["j2"] },
          ficha: { pvAtual: 10, pvMax: 10 },
        }),
      }),
    ).estado;
    // um handout oculto (só mestre)
    e = ok(e, "m", intencao("handout.criar", { handout: handout("segredo") })).estado;
    const j1 = { claude: true };
    expect(
      erro(
        e,
        "j1",
        intencao("ficha.alterar", {
          personagemId: "bia",
          operacoes: [{ caminho: "pvAtual", valor: 1 }],
        }),
        j1,
      ),
    ).toBe("personagem_inexistente");
    expect(
      erro(e, "j1", intencao("personagem.editar", { id: "bia", mudancas: { nome: "X" } }), j1),
    ).toBe("personagem_inexistente");
    expect(erro(e, "j1", intencao("personagem.apagar", { id: "bia" }), j1)).toBe(
      "personagem_inexistente",
    );
    expect(
      erro(e, "j1", intencao("handout.editar", { id: "segredo", mudancas: { texto: "x" } }), j1),
    ).toBe("handout_inexistente");
    expect(erro(e, "j1", intencao("handout.apagar", { id: "segredo" }), j1)).toBe(
      "handout_inexistente",
    );
    // a visão do jogador é a mesma, com ou sem o Claude: nada do que ele não vê
    const visao = visaoPara(e, J("j1"), T0);
    expect(visao.personagens.map((p) => p.id)).not.toContain("bia");
    expect(visao.handouts.map((h) => h.id)).not.toContain("segredo");
  });

  it("não mexe em automação, zona, cena, mesa, papéis nem permissões", () => {
    const e = criarEstado();
    const ciclo = { id: "c", nome: "C", periodoS: 60, cenas: [], fases: [{ emS: 0, evento: "x" }] };
    for (const i of [
      intencao("ciclo.criar", { ciclo }),
      intencao("botao.criar", { botao: { id: "b", nome: "B", evento: "x" } }),
      intencao("reacao.criar", {
        reacao: {
          id: "r",
          fica: { tipo: "mesa" },
          ao: "x",
          fazer: [{ acao: "chat.anunciar", texto: "oi" }],
        },
      }),
      intencao("zona.criar", {
        zona: {
          id: "z",
          cenaId: "c1",
          nome: "Z",
          pontos: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 5 },
          ],
        },
      }),
      intencao("evento.disparar", { evento: "x" }),
      intencao("cena.criar", { id: "nova", nome: "Nova" }),
      intencao("token.criar", {
        token: {
          id: "t",
          nome: "T",
          cor: "#fff",
          tamanhoQuadrados: 1,
          x: 1,
          y: 1,
          camada: "tokens",
          oculto: false,
          controladoPor: [],
        },
      }),
      intencao("config.mesa", { mudancas: { maosPorPersonagem: 3 } }),
      intencao("mesa.pausar"),
      intencao("papel.alterar", { usuarioId: "j1", papel: "mestre" }),
      intencao("permissao.alterar", { capacidade: "nota.editar", valor: false }),
    ]) {
      expect(erro(e, "j1", i, CLAUDE), i.tipo).toBe("sem_permissao");
    }
  });

  it("o que o jogador faz pela mesa o Claude dele faz igual, só com a marca; nunca rascunho", () => {
    const e = criarEstado();
    const i = () => intencao("personagem.criar", { personagem: personagem("p1") });
    const pelaMesa = ok(e, "j1", i());
    const peloClaude = ok(e, "j1", i(), CLAUDE);
    expect(JSON.stringify(peloClaude.estado.personagens)).toBe(
      JSON.stringify(pelaMesa.estado.personagens),
    );
    expect(peloClaude.estado.personagens[0]?.rascunho).toBeUndefined();
    expect(listarRascunhos(peloClaude.estado)).toEqual([]);
  });
});

describe("o jogador cria as próprias fichas e handouts", () => {
  it("a ficha é dele (só ele edita), na pasta própria dele; o mestre vê; os outros não", () => {
    const e0 = criarEstado();
    // o cliente tenta mandar outros editores, outra pasta e outro dono: a sala refaz tudo
    const r = ok(
      e0,
      "j1",
      intencao("personagem.criar", {
        personagem: personagem("minha", {
          pastaId: "pasta-personagens",
          editores: { tipo: "todos" },
          criadoPor: "m",
        }),
      }),
    );
    const p = r.estado.personagens.find((x) => x.id === "minha");
    expect(p).toMatchObject({
      criadoPor: "j1",
      editores: { tipo: "jogadores", ids: ["j1"] },
      pastaId: idDaPastaDoJogador("j1"),
    });
    const pasta = r.estado.pastas.find((x) => x.id === idDaPastaDoJogador("j1"));
    expect(pasta).toMatchObject({ visivel: { tipo: "jogadores", ids: ["j1"] }, criadoPor: "j1" });
    expect(visaoPara(r.estado, J("j1"), T0).personagens.map((x) => x.id)).toContain("minha");
    expect(visaoPara(r.estado, M, T0).personagens.map((x) => x.id)).toContain("minha");
    expect(visaoPara(r.estado, J("j2"), T0).personagens.map((x) => x.id)).not.toContain("minha");
    expect(visaoPara(r.estado, J("j2"), T0).pastas.map((x) => x.id)).not.toContain(
      idDaPastaDoJogador("j1"),
    );
    // a segunda ficha reaproveita a pasta
    const r2 = ok(
      r.estado,
      "j1",
      intencao("personagem.criar", { personagem: personagem("outra") }),
    );
    expect(r2.estado.pastas.filter((x) => x.id === idDaPastaDoJogador("j1"))).toHaveLength(1);
  });

  it("edita (nome, ficha) e apaga a que criou; não muda quem edita nem a pasta; não mexe na dos outros", () => {
    let e = criarEstado();
    e = ok(e, "j1", intencao("personagem.criar", { personagem: personagem("minha") })).estado;
    e = ok(e, "j2", intencao("personagem.criar", { personagem: personagem("dela") })).estado;
    e = ok(
      e,
      "j1",
      intencao("personagem.editar", { id: "minha", mudancas: { nome: "Aldric", cor: "#fff" } }),
    ).estado;
    expect(e.personagens.find((p) => p.id === "minha")?.nome).toBe("Aldric");
    e = ok(
      e,
      "j1",
      intencao("ficha.alterar", {
        personagemId: "minha",
        operacoes: [{ caminho: "pvAtual", valor: 3 }],
      }),
    ).estado;
    expect(
      erro(
        e,
        "j1",
        intencao("personagem.editar", { id: "minha", mudancas: { editores: { tipo: "todos" } } }),
      ),
    ).toBe("sem_permissao");
    expect(
      erro(
        e,
        "j1",
        intencao("personagem.editar", { id: "minha", mudancas: { pastaId: "pasta-npcs" } }),
      ),
    ).toBe("sem_permissao");
    // a da outra jogadora: ele nem a vê
    expect(erro(e, "j1", intencao("personagem.apagar", { id: "dela" }))).toBe(
      "personagem_inexistente",
    );
    expect(
      erro(e, "j1", intencao("personagem.editar", { id: "dela", mudancas: { nome: "x" } })),
    ).toBe("personagem_inexistente");
    e = ok(e, "j1", intencao("personagem.apagar", { id: "minha" })).estado;
    expect(e.personagens.map((p) => p.id)).toEqual(["dela"]);
    // o mestre sempre apaga
    e = ok(e, "m", intencao("personagem.apagar", { id: "dela" })).estado;
    expect(e.personagens).toEqual([]);
  });

  it("o handout é dele: escolhe quem vê, o mestre sempre vê; edita e apaga só o que criou", () => {
    let e = criarEstado();
    e = ok(
      e,
      "m",
      intencao("handout.criar", { handout: handout("do-mestre", { visivel: { tipo: "todos" } }) }),
    ).estado;
    const r = ok(
      e,
      "j1",
      intencao("handout.criar", {
        handout: handout("meu", {
          pastaId: "pasta-personagens",
          visivel: { tipo: "jogadores", ids: ["j2"] },
          criadoPor: "m",
        }),
      }),
    );
    e = r.estado;
    expect(e.handouts.find((h) => h.id === "meu")).toMatchObject({
      criadoPor: "j1",
      pastaId: idDaPastaDoJogador("j1"),
    });
    // quem vê: o mestre, a Bia (escolhida) e a própria Ana (dona, que o criou: vê pela visibilidade? só se citada)
    expect(visaoPara(e, M, T0).handouts.map((h) => h.id)).toContain("meu");
    expect(visaoPara(e, J("j2"), T0).handouts.map((h) => h.id)).toContain("meu");
    e = ok(
      e,
      "j1",
      intencao("handout.editar", {
        id: "meu",
        mudancas: { texto: "novo", visivel: { tipo: "todos" } },
      }),
    ).estado;
    expect(e.handouts.find((h) => h.id === "meu")?.texto).toBe("novo");
    // o handout do mestre: sem permissão (ele o vê) ; pasta não muda
    expect(
      erro(e, "j1", intencao("handout.editar", { id: "do-mestre", mudancas: { texto: "x" } })),
    ).toBe("sem_permissao");
    expect(erro(e, "j1", intencao("handout.apagar", { id: "do-mestre" }))).toBe("sem_permissao");
    expect(
      erro(e, "j1", intencao("handout.editar", { id: "meu", mudancas: { pastaId: "pasta-npcs" } })),
    ).toBe("sem_permissao");
    expect(erro(e, "j2", intencao("handout.apagar", { id: "meu" }))).toBe("sem_permissao");
    expect(erro(e, "j1", intencao("handout.mostrar", { id: "meu" }))).toBe("sem_permissao");
    e = ok(e, "j1", intencao("handout.apagar", { id: "meu" })).estado;
    expect(e.handouts.map((h) => h.id)).toEqual(["do-mestre"]);
  });

  it("o teto é de 20 fichas e 20 handouts por jogador, com mensagem clara; o outro jogador e o mestre não são afetados", () => {
    let e = criarEstado();
    for (let i = 0; i < TETO_DE_CRIACAO_DO_JOGADOR; i++) {
      e = ok(e, "j1", intencao("personagem.criar", { personagem: personagem(`f${i}`) })).estado;
      e = ok(e, "j1", intencao("handout.criar", { handout: handout(`h${i}`) })).estado;
    }
    const f = processar(
      e,
      "j1",
      intencao("personagem.criar", { personagem: personagem("f-demais") }),
      iso(),
    );
    expect(!f.ok && f.erro.codigo).toBe("limite_de_criacao");
    expect(!f.ok && f.erro.mensagem).toContain("20 fichas");
    const h = processar(
      e,
      "j1",
      intencao("handout.criar", { handout: handout("h-demais") }),
      iso(),
    );
    expect(!h.ok && h.erro.codigo).toBe("limite_de_criacao");
    expect(!h.ok && h.erro.mensagem).toContain("20 handouts");
    // a conexão do Claude dele tem o mesmo teto
    expect(
      erro(e, "j1", intencao("personagem.criar", { personagem: personagem("f-demais") }), CLAUDE),
    ).toBe("limite_de_criacao");
    // apagar uma abre vaga
    e = ok(e, "j1", intencao("personagem.apagar", { id: "f0" })).estado;
    expect(
      erro(e, "j1", intencao("personagem.criar", { personagem: personagem("f-demais") })),
    ).toBeNull();
    // outro jogador e o mestre seguem livres
    expect(
      erro(e, "j2", intencao("personagem.criar", { personagem: personagem("da-bia") })),
    ).toBeNull();
    expect(
      erro(e, "m", intencao("personagem.criar", { personagem: personagem("npc") })),
    ).toBeNull();
  });

  it("a capacidade é delegável, vem ligada por padrão e vale por jogador (exceção); desligada recusa criar mas não tira o que ele já tem", () => {
    let e = criarEstado();
    expect(e.permissoes.jogadores["personagem.criarProprio"]).toBe(true);
    e = ok(e, "j1", intencao("personagem.criar", { personagem: personagem("minha") })).estado;
    // desliga só para a Ana (exceção por jogador)
    e = ok(
      e,
      "m",
      intencao("permissao.alterar", {
        capacidade: "personagem.criarProprio",
        valor: false,
        usuarioId: "j1",
      }),
    ).estado;
    expect(erro(e, "j1", intencao("personagem.criar", { personagem: personagem("outra") }))).toBe(
      "sem_permissao",
    );
    expect(erro(e, "j1", intencao("handout.criar", { handout: handout("h") }))).toBe(
      "sem_permissao",
    );
    expect(
      erro(e, "j2", intencao("personagem.criar", { personagem: personagem("da-bia") })),
    ).toBeNull();
    expect(
      erro(e, "j1", intencao("personagem.editar", { id: "minha", mudancas: { nome: "Y" } })),
    ).toBeNull();
    // mestre não é afetado e o Claude do jogador segue a mesma capacidade
    expect(
      erro(e, "j1", intencao("personagem.criar", { personagem: personagem("outra") }), CLAUDE),
    ).toBe("sem_permissao");
  });
});

describe("rascunhos do Claude do mestre", () => {
  const modelo = {
    id: "mod",
    nome: "Lanterna",
    luz: { claraM: 4, penumbraM: 4, cor: "#ffffff", tremula: false },
    duracaoS: null,
    ocupaMao: false,
    tags: [],
  };
  const ciclo = {
    id: "cic",
    nome: "Ciclo",
    periodoS: 60,
    cenas: [],
    fases: [{ emS: 0, evento: "pulso" }],
  };
  const reacao = {
    id: "rea",
    nome: "Anuncia",
    fica: { tipo: "mesa" },
    ao: "pulso",
    fazer: [{ acao: "chat.anunciar", texto: "pulsou" }],
  };
  const zona = {
    id: "zon",
    cenaId: "c1",
    nome: "Zona",
    pontos: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ],
  };

  /** O Claude do mestre cria um de cada. */
  function claudeCriaTudo(base = criarEstado()): Estado {
    let e = base;
    const c = (tipo: Intencao["tipo"], dados: object) => {
      e = ok(e, "m", intencao(tipo, dados), CLAUDE).estado;
    };
    c("cena.criar", { id: "nova", nome: "Cena nova" });
    c("pasta.criar", {
      pasta: { id: "pasta-claude", nome: "Do Claude", ordem: 5, visivel: { tipo: "todos" } },
    });
    c("personagem.criar", {
      personagem: personagem("npc-claude", { pastaId: "pasta-claude", rascunho: false }),
    });
    c("handout.criar", {
      handout: handout("hand-claude", { pastaId: "pasta-claude", visivel: { tipo: "todos" } }),
    });
    c("modelo.criar", { modelo });
    c("ponto.criar", {
      ponto: { id: "pon", nome: "Ponto", x: 2, y: 2, tipo: "suporte", visivelParaJogadores: true },
    });
    c("fonte.criar", {
      fonte: {
        id: "luz",
        nome: "Luz",
        portador: { tipo: "cena", x: 3, y: 3 },
        luz: { claraM: 3, penumbraM: 3, cor: "#ffffff", tremula: false },
        intensidade: 1,
        estado: "acesa",
      },
    });
    c("token.criar", {
      token: {
        id: "tok",
        nome: "Goblin",
        cor: "#0f0",
        tamanhoQuadrados: 1,
        x: 1,
        y: 1,
        camada: "tokens",
        oculto: false,
        controladoPor: [],
        rascunho: false,
      },
    });
    c("zona.criar", { zona });
    c("ciclo.criar", { ciclo });
    c("reacao.criar", { reacao });
    c("botao.criar", {
      botao: { id: "bot", nome: "Soprar", evento: "pulso", liberadoParaJogadores: true },
    });
    return e;
  }

  it("cenas, fichas, handouts, pastas, modelos, pontos, luzes, tokens, zonas, ciclos, reações e botões nascem como rascunho", () => {
    const e = claudeCriaTudo();
    const tipos = listarRascunhos(e).map((r) => r.tipo);
    expect(tipos.sort()).toEqual(
      [
        "botao",
        "cena",
        "ciclo",
        "handout",
        "luz",
        "modelo",
        "pasta",
        "personagem",
        "ponto",
        "reacao",
        "token",
        "zona",
      ].sort(),
    );
    // o cliente nunca escolhe a marca: `rascunho: false` mandado pelo Claude vira true
    expect(e.personagens.find((p) => p.id === "npc-claude")?.rascunho).toBe(true);
    expect(e.tokens.find((t) => t.id === "tok")?.rascunho).toBe(true);
  });

  it("o que o mestre cria pela mesa nunca é rascunho, nem se o cliente mandar a marca", () => {
    let e = criarEstado();
    e = ok(
      e,
      "m",
      intencao("personagem.criar", { personagem: personagem("p", { rascunho: true }) }),
    ).estado;
    e = ok(e, "m", intencao("handout.criar", { handout: handout("h", { rascunho: true }) })).estado;
    e = ok(e, "m", intencao("ciclo.criar", { ciclo: { ...ciclo, rascunho: true } })).estado;
    expect(listarRascunhos(e)).toEqual([]);
    expect(JSON.stringify(e)).not.toContain("rascunho");
  });

  it("o rascunho não chega ao jogador: nem no snapshot nem em evento", () => {
    let e = claudeCriaTudo();
    // dados de teste visíveis: pasta e handout para todos, ponto visível, token da cena ativa
    const antes = criarEstado();
    // 1. snapshot
    const v = visaoPara(e, J("j1"), T0);
    expect(v.cenas.map((c) => c.id)).toEqual(["c1"]);
    expect(v.tokens.map((t) => t.id)).not.toContain("tok");
    expect(v.personagens.map((p) => p.id)).not.toContain("npc-claude");
    expect(v.handouts.map((h) => h.id)).not.toContain("hand-claude");
    expect(v.pastas.map((p) => p.id)).not.toContain("pasta-claude");
    expect(v.modelos.map((m) => m.id)).not.toContain("mod");
    expect(v.pontos.map((p) => p.id)).not.toContain("pon");
    expect(v.luzes.map((l) => l.id)).not.toContain("luz");
    expect(v.automacoes).toBeUndefined();
    expect(v.zonas).toBeUndefined();
    expect(v.botoes ?? []).toEqual([]);
    expect(JSON.stringify(v)).not.toContain("npc-claude");
    expect(JSON.stringify(v)).not.toContain("Goblin");
    // o mestre vê tudo, marcado
    const vm = visaoPara(e, M, T0);
    expect(vm.personagens.find((p) => p.id === "npc-claude")?.rascunho).toBe(true);
    // 2. eventos: refaz a criação passo a passo e confere cada evento contra o jogador
    e = antes;
    let ultimo = e;
    const passos: Intencao[] = [
      intencao("pasta.criar", {
        pasta: { id: "pasta-claude", nome: "Do Claude", ordem: 5, visivel: { tipo: "todos" } },
      }),
      intencao("personagem.criar", {
        personagem: personagem("npc-claude", { pastaId: "pasta-claude" }),
      }),
      intencao("handout.criar", {
        handout: handout("hand-claude", { pastaId: "pasta-claude", visivel: { tipo: "todos" } }),
      }),
      intencao("modelo.criar", { modelo }),
      intencao("ponto.criar", {
        ponto: {
          id: "pon",
          nome: "Ponto",
          x: 2,
          y: 2,
          tipo: "suporte",
          visivelParaJogadores: true,
        },
      }),
      intencao("token.criar", {
        token: {
          id: "tok",
          nome: "Goblin",
          cor: "#0f0",
          tamanhoQuadrados: 1,
          x: 1,
          y: 1,
          camada: "tokens",
          oculto: false,
          controladoPor: [],
        },
      }),
      intencao("fonte.criar", {
        fonte: {
          id: "luz",
          nome: "Luz",
          portador: { tipo: "cena", x: 3, y: 3 },
          luz: { claraM: 3, penumbraM: 3, cor: "#ffffff", tremula: false },
          intensidade: 1,
          estado: "acesa",
        },
      }),
      intencao("ciclo.criar", { ciclo: { ...ciclo, liberadoParaJogadores: true } }),
      intencao("botao.criar", {
        botao: { id: "bot", nome: "Soprar", evento: "pulso", liberadoParaJogadores: true },
      }),
    ];
    for (const i of passos) {
      const r = ok(ultimo, "m", i, CLAUDE);
      for (const ev of r.eventos) {
        expect(eventoPara(ev, J("j1"), ultimo, r.estado, T0), `${i.tipo} -> ${ev.tipo}`).toBeNull();
      }
      ultimo = r.estado;
    }
    // apagar o rascunho (descartar) também não diz nada ao jogador
    const d = ok(
      ultimo,
      "m",
      intencao("rascunho.descartar", { itens: [{ tipo: "personagem", id: "npc-claude" }] }),
    );
    for (const ev of d.eventos)
      expect(eventoPara(ev, J("j1"), ultimo, d.estado, T0), ev.tipo).toBeNull();
  });

  it("a cena em rascunho não pode virar a cena do grupo; o que está nela não leva a marca", () => {
    let e = criarEstado();
    e = ok(e, "m", intencao("cena.criar", { id: "nova", nome: "Nova" }), CLAUDE).estado;
    expect(erro(e, "m", intencao("grupo.moverPara", { cenaId: "nova" }))).toBe("dados_invalidos");
    e = ok(
      e,
      "m",
      intencao("token.criar", {
        cenaId: "nova",
        token: {
          id: "t",
          nome: "T",
          cor: "#fff",
          tamanhoQuadrados: 1,
          x: 1,
          y: 1,
          camada: "tokens",
          oculto: false,
          controladoPor: [],
        },
      }),
      CLAUDE,
    ).estado;
    expect(e.tokens[0]?.rascunho).toBeUndefined();
    expect(listarRascunhos(e).map((r) => r.tipo)).toEqual(["cena"]);
    // publicada, o grupo vai
    e = ok(e, "m", intencao("rascunho.publicar", { itens: [{ tipo: "cena", id: "nova" }] })).estado;
    expect(erro(e, "m", intencao("grupo.moverPara", { cenaId: "nova" }))).toBeNull();
  });

  it("ciclo e reação em rascunho não rodam; publicados, rodam; botão em rascunho não aparece nem vale para o jogador", () => {
    let e = claudeCriaTudo();
    e = {
      ...e,
      automacoes: AutomacoesSchema.parse({
        ...e.automacoes,
        ciclos: [{ ...(e.automacoes?.ciclos[0] as object), liberadoParaJogadores: true }],
      }),
    };
    const anuncios = (x: Estado) => (x.chat ?? []).filter((m) => m.tipo === "aviso").length;
    let t = processarSistema(e, iso(5), [], fonteComSemente(1));
    if (!t.ok) throw new Error("sistema");
    expect(anuncios(t.estado)).toBe(0);
    t = processarSistema(t.estado, iso(200), [], fonteComSemente(1));
    if (!t.ok) throw new Error("sistema");
    expect(anuncios(t.estado)).toBe(0);
    // botão e ciclo liberados, mas em rascunho: o jogador não os recebe nem usa
    expect(visaoPara(e, J("j1"), T0).botoes ?? []).toEqual([]);
    expect(erro(e, "j1", intencao("botao.usar", { botaoId: "evento:bot" }))).toBe("sem_permissao");
    expect(erro(e, "j1", intencao("botao.usar", { botaoId: "ciclo:cic" }))).toBe("sem_permissao");
    // o evento manual também ignora a reação em rascunho
    const d = ok(e, "m", intencao("evento.disparar", { evento: "pulso" }));
    expect(anuncios(d.estado)).toBe(0);

    // publicados: rodam
    const p = ok(
      e,
      "m",
      intencao("rascunho.publicar", {
        itens: [
          { tipo: "ciclo", id: "cic" },
          { tipo: "reacao", id: "rea" },
          { tipo: "botao", id: "bot" },
        ],
      }),
    );
    expect(listarRascunhos(p.estado).map((r) => r.tipo)).not.toContain("ciclo");
    t = processarSistema(p.estado, iso(5), [], fonteComSemente(1)) as typeof t;
    if (!t.ok) throw new Error("sistema");
    expect(anuncios(t.estado)).toBeGreaterThan(0);
    expect(
      visaoPara(p.estado, J("j1"), T0)
        .botoes?.map((b) => b.id)
        .sort(),
    ).toEqual(["ciclo:cic", "evento:bot"]);
  });

  it("publicar (por item ou tudo) revela ao jogador; descartar apaga e só vale para rascunho", () => {
    let e = claudeCriaTudo();
    // por item
    const um = ok(
      e,
      "m",
      intencao("rascunho.publicar", {
        itens: [
          { tipo: "pasta", id: "pasta-claude" },
          { tipo: "personagem", id: "npc-claude" },
        ],
      }),
    );
    const vi = visaoPara(um.estado, J("j1"), T0);
    expect(vi.pastas.map((p) => p.id)).toContain("pasta-claude");
    expect(vi.personagens.map((p) => p.id)).not.toContain("tok");
    expect(listarRascunhos(um.estado).some((r) => r.id === "npc-claude")).toBe(false);
    expect(um.snapshotPara).toBe("todos");
    // tudo
    const tudo = ok(e, "m", intencao("rascunho.publicar", {}));
    expect(listarRascunhos(tudo.estado)).toEqual([]);
    const vt = visaoPara(tudo.estado, J("j1"), T0);
    expect(vt.tokens.map((t) => t.id)).toContain("tok");
    expect(vt.handouts.map((h) => h.id)).toContain("hand-claude");
    expect(vt.modelos.map((m) => m.id)).toContain("mod");
    expect(vt.luzes.map((l) => l.id)).toContain("luz");
    expect(vt.pontos.map((p) => p.id)).toContain("pon");
    // publicar o que não é rascunho: recusa
    expect(
      erro(
        tudo.estado,
        "m",
        intencao("rascunho.publicar", { itens: [{ tipo: "token", id: "tok" }] }),
      ),
    ).toBe("dados_invalidos");
    // descartar: apaga (a cena leva o que há nela)
    const dc = ok(
      e,
      "m",
      intencao("rascunho.descartar", {
        itens: [
          { tipo: "token", id: "tok" },
          { tipo: "ciclo", id: "cic" },
          { tipo: "reacao", id: "rea" },
          { tipo: "zona", id: "zon" },
        ],
      }),
    );
    expect(dc.estado.tokens).toEqual([]);
    expect(dc.estado.automacoes?.ciclos).toEqual([]);
    expect(dc.estado.zonas ?? []).toEqual([]);
    expect(
      erro(
        dc.estado,
        "m",
        intencao("rascunho.descartar", { itens: [{ tipo: "token", id: "tok" }] }),
      ),
    ).toBe("dados_invalidos");
    // só o mestre publica e descarta; o jogador nem o Claude dele
    expect(erro(e, "j1", intencao("rascunho.publicar", {}))).toBe("sem_permissao");
    expect(
      erro(
        e,
        "j1",
        intencao("rascunho.descartar", { itens: [{ tipo: "token", id: "tok" }] }),
        CLAUDE,
      ),
    ).toBe("sem_permissao");
    // o Claude do mestre também pode publicar (assumido)
    expect(erro(e, "m", intencao("rascunho.publicar", {}), CLAUDE)).toBeNull();
    // pasta com item dentro não se descarta sozinha
    expect(
      erro(
        e,
        "m",
        intencao("rascunho.descartar", { itens: [{ tipo: "pasta", id: "pasta-claude" }] }),
      ),
    ).toBe("dados_invalidos");
    e = ok(
      e,
      "m",
      intencao("rascunho.descartar", {
        itens: [
          { tipo: "personagem", id: "npc-claude" },
          { tipo: "handout", id: "hand-claude" },
          { tipo: "pasta", id: "pasta-claude" },
        ],
      }),
    ).estado;
    expect(e.pastas.map((p) => p.id)).not.toContain("pasta-claude");
  });

  it("editar pelo Claude algo já publicado aplica direto (e não vira rascunho)", () => {
    let e = criarEstado();
    e = ok(e, "m", intencao("personagem.criar", { personagem: personagem("pub") })).estado;
    e = ok(
      e,
      "m",
      intencao("personagem.editar", { id: "pub", mudancas: { nome: "Novo nome" } }),
      CLAUDE,
    ).estado;
    expect(e.personagens[0]).toMatchObject({ nome: "Novo nome" });
    expect(e.personagens[0]?.rascunho).toBeUndefined();
    // e editar um rascunho não o publica por acidente
    e = ok(e, "m", intencao("personagem.criar", { personagem: personagem("rasc") }), CLAUDE).estado;
    e = ok(
      e,
      "m",
      intencao("personagem.editar", { id: "rasc", mudancas: { nome: "Outro" } }),
      CLAUDE,
    ).estado;
    e = ok(
      e,
      "m",
      intencao("personagem.editar", { id: "rasc", mudancas: { nome: "Mais outro" } }),
    ).estado;
    expect(e.personagens.find((p) => p.id === "rasc")?.rascunho).toBe(true);
  });
});

describe("Desfazer o que o Claude fez", () => {
  /** Aplica e devolve o passo anotado (o que a sala guardaria no diário). */
  function comDiario(e: Estado, quem: string, i: Intencao, o: Opcoes = {}) {
    const r = ok(e, quem, i, o);
    return { estado: r.estado, passo: diffDoEstado(e, r.estado) as Passo };
  }

  it("desfaz um lote: o que foi criado some, o que foi editado volta e o que foi apagado volta, na ordem inversa", () => {
    let e = criarEstado();
    e = ok(e, "m", intencao("personagem.criar", { personagem: personagem("antigo") })).estado;
    e = ok(e, "m", intencao("handout.criar", { handout: handout("velho") })).estado;
    const inicio = JSON.stringify(e);
    const passos: Passo[] = [];
    const sobe = (i: Intencao) => {
      const r = comDiario(e, "m", i, CLAUDE);
      e = r.estado;
      passos.push(r.passo);
    };
    sobe(
      intencao("pasta.criar", {
        pasta: { id: "pasta-claude", nome: "Do Claude", ordem: 5, visivel: { tipo: "mestre" } },
      }),
    );
    sobe(
      intencao("personagem.criar", {
        personagem: personagem("novo-1", { pastaId: "pasta-claude" }),
      }),
    );
    sobe(
      intencao("personagem.criar", {
        personagem: personagem("novo-2", { pastaId: "pasta-claude" }),
      }),
    );
    sobe(intencao("personagem.editar", { id: "antigo", mudancas: { nome: "Mudado" } }));
    sobe(intencao("handout.apagar", { id: "velho" }));
    sobe(intencao("cena.criar", { id: "nova", nome: "Nova" }));
    expect(e.personagens.map((p) => p.id).sort()).toEqual(["antigo", "novo-1", "novo-2"]);
    const r = desfazerPassos(e, passos, { usuarioId: "m", idPedido: "d1" });
    expect(r.pulados).toEqual([]);
    expect(r.aplicados).toBeGreaterThanOrEqual(6);
    expect(r.estado.personagens.map((p) => p.id)).toEqual(["antigo"]);
    expect(r.estado.personagens[0]?.nome).toBe("Nome antigo");
    expect(r.estado.handouts.map((h) => h.id)).toEqual(["velho"]);
    expect(r.estado.pastas.map((p) => p.id)).not.toContain("pasta-claude");
    expect(r.estado.cenas.map((c) => c.id)).toEqual(["c1"]);
    expect(r.eventos.length).toBeGreaterThan(0);
    // os eventos continuam numerados a partir do estado de antes
    expect(r.eventos[0]?.seq).toBe(e.seq + 1);
    // volta ao começo (ignorando o seq)
    expect(JSON.stringify({ ...r.estado, seq: 0 })).toBe(
      JSON.stringify({ ...JSON.parse(inicio), seq: 0 }),
    );
  });

  it("o item que mudou depois por outra pessoa é pulado, e o aviso diz qual", () => {
    let e = criarEstado();
    const passos: Passo[] = [];
    const sobe = (quem: string, i: Intencao, o: Opcoes = {}) => {
      const r = comDiario(e, quem, i, o);
      e = r.estado;
      return r.passo;
    };
    passos.push(sobe("m", intencao("personagem.criar", { personagem: personagem("a") }), CLAUDE));
    passos.push(sobe("m", intencao("personagem.criar", { personagem: personagem("b") }), CLAUDE));
    // depois, outra pessoa (a mesa) renomeia "a"
    sobe(
      "m",
      intencao("personagem.editar", { id: "a", mudancas: { nome: "Renomeada pela mesa" } }),
    );
    const r = desfazerPassos(e, passos, { usuarioId: "m", idPedido: "d2" });
    expect(r.pulados).toEqual(['ficha "Nome a"']);
    expect(r.estado.personagens.map((p) => p.id)).toEqual(["a"]);
    expect(r.aplicados).toBe(1);
    // desfazer de novo (a mesma lista) não quebra: "b" já não existe
    expect(
      desfazerPassos(r.estado, passos, { usuarioId: "m", idPedido: "d3" }).estado.personagens.map(
        (p) => p.id,
      ),
    ).toEqual(["a"]);
  });

  it("o apagado que alguém recriou fica como está; pasta com coisa dentro e cena com coisa dentro não saem", () => {
    let e = criarEstado();
    e = ok(e, "m", intencao("handout.criar", { handout: handout("h") })).estado;
    const apaga = comDiario(e, "m", intencao("handout.apagar", { id: "h" }), CLAUDE);
    e = apaga.estado;
    e = ok(e, "m", intencao("handout.criar", { handout: handout("h", { texto: "outro" }) })).estado;
    const r = desfazerPassos(e, [apaga.passo], { usuarioId: "m", idPedido: "d4" });
    expect(r.pulados).toHaveLength(1);
    expect(r.estado.handouts[0]?.texto).toBe("outro");

    // pasta criada pelo Claude e depois usada por outra pessoa
    let f = criarEstado();
    const pasta = comDiario(
      f,
      "m",
      intencao("pasta.criar", {
        pasta: { id: "pc", nome: "PC", ordem: 5, visivel: { tipo: "mestre" } },
      }),
      CLAUDE,
    );
    f = ok(
      pasta.estado,
      "m",
      intencao("handout.criar", { handout: handout("dentro", { pastaId: "pc" }) }),
    ).estado;
    const r2 = desfazerPassos(f, [pasta.passo], { usuarioId: "m", idPedido: "d5" });
    expect(r2.pulados).toEqual(['pasta "PC"']);
    expect(r2.estado.pastas.map((p) => p.id)).toContain("pc");
  });

  it("publicar o que o Claude criou não conta como mudança de outra pessoa: o Desfazer ainda desfaz; a publicação em si é um passo", () => {
    let e = criarEstado();
    const criou = comDiario(
      e,
      "m",
      intencao("personagem.criar", { personagem: personagem("n1") }),
      CLAUDE,
    );
    e = criou.estado;
    expect(e.personagens[0]?.rascunho).toBe(true);
    const publicou = comDiario(e, "m", intencao("rascunho.publicar", {}), CLAUDE);
    e = publicou.estado;
    expect(e.personagens[0]?.rascunho).toBeUndefined();
    expect(publicou.passo).toHaveLength(1);
    const r = desfazerPassos(e, [criou.passo], { usuarioId: "m", idPedido: "d7" });
    expect(r.pulados).toEqual([]);
    expect(r.estado.personagens).toEqual([]);
    // desfazer a publicação (o lote dela) devolve o rascunho
    const volta = desfazerPassos(e, [publicou.passo], { usuarioId: "m", idPedido: "d8" });
    expect(volta.estado.personagens[0]?.rascunho).toBe(true);
  });

  it("o diff só vê as coleções: relógio, chat e permissões não entram", () => {
    const e = criarEstado();
    const r = ok(e, "m", intencao("mesa.pausar"), CLAUDE);
    expect(diffDoEstado(e, r.estado)).toEqual([]);
    const c = ok(e, "m", intencao("dado.rolar", { expressao: "1d6" }), CLAUDE);
    expect(diffDoEstado(e, c.estado)).toEqual([]);
  });

  it("o jogador desfaz o que o Claude dele criou (a ficha própria some junto com a pasta que a sala criou)", () => {
    let e = criarEstado();
    const r = comDiario(
      e,
      "j1",
      intencao("personagem.criar", { personagem: personagem("minha") }),
      CLAUDE,
    );
    e = r.estado;
    expect(r.passo.map((d) => d.c).sort()).toEqual(["pastas", "personagens"]);
    const u = desfazerPassos(e, [r.passo], { usuarioId: "j1", idPedido: "d6" });
    expect(u.estado.personagens).toEqual([]);
    expect(u.estado.pastas.map((p) => p.id)).not.toContain(idDaPastaDoJogador("j1"));
  });
});

describe('a marca "pelo Claude" no chat e nas rolagens', () => {
  it("toda mensagem e rolagem da conexão do Claude leva a marca, visível para todos; a da mesa não", () => {
    const e = criarEstado();
    const pelaMesa = ok(e, "j1", intencao("dado.rolar", { expressao: "1d20" }));
    const peloClaude = ok(e, "j1", intencao("dado.rolar", { expressao: "1d20" }), CLAUDE);
    expect(pelaMesa.estado.chat?.[0]?.peloClaude).toBeUndefined();
    expect(peloClaude.estado.chat?.[0]).toMatchObject({
      tipo: "rolagem",
      peloClaude: true,
      visivelPara: "todos",
    });
    // quem rola é a sala: o resultado vem dos dados da sala
    expect(peloClaude.estado.chat?.[0]?.rolagens?.[0]?.total).toBeGreaterThanOrEqual(1);
    // todos veem a marca
    const ev = peloClaude.eventos.find((x) => x.tipo === "chat.mensagem");
    for (const quem of [M, J("j2"), J("j1")]) {
      const visto = ev && eventoPara(ev, quem, e, peloClaude.estado, T0);
      expect(visto && visto.tipo === "chat.mensagem" && visto.dados.mensagem.peloClaude).toBe(true);
    }
    const texto = ok(e, "j1", intencao("chat.enviar", { texto: "olá" }), CLAUDE);
    expect(texto.estado.chat?.[0]?.peloClaude).toBe(true);
  });

  it("a rolagem oculta segue a capacidade do usuário: jogador sem ela é recusado, mestre rola oculta", () => {
    const e = criarEstado();
    expect(erro(e, "j1", intencao("dado.rolar", { expressao: "1d20", oculta: true }), CLAUDE)).toBe(
      "sem_permissao",
    );
    const com = ok(
      e,
      "m",
      intencao("permissao.alterar", {
        capacidade: "dado.rolarOculto",
        valor: true,
        usuarioId: "j1",
      }),
    ).estado;
    const r = ok(com, "j1", intencao("dado.rolar", { expressao: "1d20", oculta: true }), CLAUDE);
    expect(r.estado.chat?.[0]).toMatchObject({ oculta: true, peloClaude: true });
    // a oculta não chega à outra jogadora
    const ev = r.eventos.find((x) => x.tipo === "chat.mensagem");
    expect(ev && eventoPara(ev, J("j2"), com, r.estado, T0)).toBeNull();
  });
});

describe("limite de frequência e o token no cabeçalho", () => {
  it("rajada de 40, depois 20 por segundo; o excesso diz quanto esperar", () => {
    let balde: ReturnType<typeof gastarFicha>["balde"] | undefined;
    let t = 1_000_000;
    let aceitos = 0;
    for (let i = 0; i < 100; i++) {
      const g = gastarFicha(balde, t);
      balde = g.balde;
      if (g.ok) aceitos++;
    }
    expect(aceitos).toBe(LIMITE_DO_CLAUDE.rajada);
    const recusado = gastarFicha(balde, t);
    expect(recusado.ok).toBe(false);
    expect(recusado.esperaMs).toBeGreaterThan(0);
    expect(recusado.esperaMs).toBeLessThanOrEqual(50);
    // 1 segundo depois, 20 pedidos passam
    t += 1000;
    let depois = 0;
    for (let i = 0; i < 40; i++) {
      const g = gastarFicha(balde, t);
      balde = g.balde;
      if (g.ok) depois++;
    }
    expect(depois).toBe(LIMITE_DO_CLAUDE.porSegundo);
  });

  it("lê o token do cabeçalho Authorization: Bearer", () => {
    expect(tokenDoCabecalho("Bearer tvc_abc")).toBe("tvc_abc");
    expect(tokenDoCabecalho("bearer   tvc_abc ")).toBe("tvc_abc");
    expect(tokenDoCabecalho("Basic abc")).toBeNull();
    expect(tokenDoCabecalho("Bearer")).toBeNull();
    expect(tokenDoCabecalho(null)).toBeNull();
    expect(CicloSchema.safeParse({}).success).toBe(false);
  });
});
