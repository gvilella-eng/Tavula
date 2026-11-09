import { describe, expect, it } from "vitest";
import {
  type AssetMeta,
  assetVisivelPara,
  CENA_PADRAO,
  criarExportacao,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  migrarPersonagem,
  PASTA_NPCS_ID,
  PASTA_PERSONAGENS_ID,
  type Pasta,
  type Personagem,
  pastaVisivelPara,
  personagemDoBanco,
  personagemVisivelPara,
  podeEditarPersonagem,
  podeMoverToken,
  processar,
  reduzir,
  type Token,
  tokenVisivelPara,
  VERSAO_EXPORTACAO,
  visaoPara,
} from "./index.ts";

// Lote 4b: pastas das Fichas (quem vê vem da pasta e de quem edita), controle do token por quem
// edita, camada `mapa`, ordem de turno e as exportações (v5 e v1 a v4).

const AGORA = "2026-01-01T00:00:00.000Z";
const mestre = { id: "m", papel: "mestre" as const };
const j1 = { id: "j1", papel: "jogador" as const };
const j2 = { id: "j2", papel: "jogador" as const };
const j3 = { id: "j3", papel: "jogador" as const };
const assistente = { id: "a", papel: "assistente" as const };

const hex = (c: string) => c.repeat(64);

function pasta(id: string, visivel: Pasta["visivel"], ordem = 5): Pasta {
  return { id, nome: `Nome ${id}`, ordem, visivel };
}

function personagem(id: string, pastaId: string, editores: Personagem["editores"]): Personagem {
  return {
    id,
    pastaId,
    editores,
    nome: `Pers ${id}`,
    tokenPadrao: { cor: "#123456", tamanhoQuadrados: 1 },
    visao: { alcanceM: null, visaoNoEscuroM: 0 },
    ficha: { pvAtual: 10, pvMax: 12 },
  };
}

function token(id: string, extra: Partial<Token> = {}): Token {
  return {
    id,
    cenaId: "cena-1",
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

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
      { id: "j3", nome: "J3", papel: "jogador", cor: "#555" },
      { id: "a", nome: "Assistente", papel: "assistente", cor: "#666" },
    ],
    pastas: [
      pasta(PASTA_PERSONAGENS_ID, { tipo: "mestre" }, 0),
      pasta(PASTA_NPCS_ID, { tipo: "mestre" }, 1),
      pasta("pasta-todos", { tipo: "todos" }),
      pasta("pasta-j2", { tipo: "jogadores", ids: ["j2"] }),
    ],
    personagens: [
      personagem("aldric", PASTA_PERSONAGENS_ID, { tipo: "jogadores", ids: ["j1"] }),
      personagem("ogro", PASTA_NPCS_ID, { tipo: "jogadores", ids: [] }),
      personagem("mapa-mundi", "pasta-todos", { tipo: "jogadores", ids: [] }),
      personagem("diario", "pasta-j2", { tipo: "jogadores", ids: [] }),
      personagem("compartilhado", PASTA_NPCS_ID, { tipo: "todos" }),
    ],
    tokens: [
      token("t-aldric", { personagemId: "aldric" }),
      token("t-compartilhado", { personagemId: "compartilhado" }),
      token("t-ogro", { personagemId: "ogro" }),
    ],
  });
}

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `f${++contador}`, tipo, dados });
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

const ids = (l: { id: string }[]) => l.map((x) => x.id).sort();

describe("quem vê a pasta e o item", () => {
  const e = criarEstado();
  const por = (id: string) => e.personagens.find((p) => p.id === id) as Personagem;
  const pastaPor = (id: string) => e.pastas.find((p) => p.id === id) as Pasta;

  it("pasta: todos veem a de 'todos'; só os citados veem a de jogadores; só o mestre a do mestre", () => {
    expect(pastaVisivelPara(pastaPor("pasta-todos"), j3)).toBe(true);
    expect(pastaVisivelPara(pastaPor("pasta-j2"), j2)).toBe(true);
    expect(pastaVisivelPara(pastaPor("pasta-j2"), j1)).toBe(false);
    expect(pastaVisivelPara(pastaPor(PASTA_NPCS_ID), j1)).toBe(false);
    expect(pastaVisivelPara(pastaPor(PASTA_NPCS_ID), mestre)).toBe(true);
    expect(pastaVisivelPara(pastaPor("pasta-todos"), assistente)).toBe(false);
  });

  it("item: vem da pasta, mais quem o edita; o mestre vê tudo", () => {
    const pastas = e.pastas;
    expect(personagemVisivelPara(por("mapa-mundi"), j3, pastas)).toBe(true);
    expect(personagemVisivelPara(por("diario"), j2, pastas)).toBe(true);
    expect(personagemVisivelPara(por("diario"), j1, pastas)).toBe(false);
    expect(personagemVisivelPara(por("ogro"), j1, pastas)).toBe(false);
    // quem edita vê mesmo numa pasta que não vê
    expect(personagemVisivelPara(por("aldric"), j1, pastas)).toBe(true);
    expect(personagemVisivelPara(por("aldric"), j2, pastas)).toBe(false);
    // "todos os jogadores" edita (e vê) em qualquer pasta
    expect(personagemVisivelPara(por("compartilhado"), j3, pastas)).toBe(true);
    expect(personagemVisivelPara(por("ogro"), mestre, pastas)).toBe(true);
    expect(personagemVisivelPara(por("mapa-mundi"), assistente, pastas)).toBe(false);
  });

  it("o snapshot do jogador nunca traz nome de pasta nem item que ele não vê", () => {
    const v1 = visaoPara(e, j1);
    expect(ids(v1.pastas)).toEqual(["pasta-todos"]);
    expect(ids(v1.personagens)).toEqual(["aldric", "compartilhado", "mapa-mundi"]);
    const texto = JSON.stringify(v1);
    for (const segredo of ["Nome pasta-j2", "Personagens", "NPCs", "Pers ogro", "Pers diario"]) {
      expect(texto, segredo).not.toContain(segredo);
    }
    const v2 = visaoPara(e, j2);
    expect(ids(v2.pastas)).toEqual(["pasta-j2", "pasta-todos"]);
    expect(ids(v2.personagens)).toEqual(["compartilhado", "diario", "mapa-mundi"]);
    expect(ids(visaoPara(e, mestre).pastas)).toHaveLength(4);
    expect(visaoPara(e, mestre).personagens).toHaveLength(5);
  });
});

describe("mover de pasta e mudar a visibilidade", () => {
  const e = criarEstado();

  it("mover o item para uma pasta de 'todos' faz ele aparecer; de volta, sumir (para quem não edita)", () => {
    const pra = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "ogro", mudancas: { pastaId: "pasta-todos" } }),
    );
    const ev = pra.eventos[0] as EventoSala;
    expect(eventoPara(ev, j1, e, pra.estado)?.tipo).toBe("personagem.alterado");
    expect(eventoPara(ev, mestre, e, pra.estado)).toEqual(ev);
    // o cliente chega ao mesmo que o snapshot novo
    let cliente = visaoPara(e, j1);
    for (const x of pra.eventos) {
      const visto = eventoPara(x, j1, e, pra.estado);
      if (visto) cliente = reduzir(cliente, visto);
    }
    expect(ids(cliente.personagens)).toEqual(ids(visaoPara(pra.estado, j1).personagens));
    expect(cliente.personagens.some((p) => p.id === "ogro")).toBe(true);

    const volta = aplicar(
      pra.estado,
      "m",
      intencao("personagem.editar", { id: "ogro", mudancas: { pastaId: PASTA_NPCS_ID } }),
    );
    const evVolta = volta.eventos[0] as EventoSala;
    expect(eventoPara(evVolta, j1, pra.estado, volta.estado)?.tipo).toBe("personagem.apagado");
    // quem edita continua vendo o item que mudou de pasta
    const editado = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "aldric", mudancas: { pastaId: "pasta-j2" } }),
    );
    expect(eventoPara(editado.eventos[0] as EventoSala, j1, e, editado.estado)?.tipo).toBe(
      "personagem.alterado",
    );
    // quem não via nem passa a ver: nada
    expect(eventoPara(evVolta, j3, pra.estado, volta.estado)?.tipo).toBe("personagem.apagado");
    expect(eventoPara(ev, assistente, e, pra.estado)).toBeNull();
  });

  it("mudar quem vê a pasta manda snapshot novo a todos; o jogador ganha ou perde a pasta e os itens", () => {
    const abre = aplicar(
      e,
      "m",
      intencao("pasta.editar", { id: PASTA_NPCS_ID, visivel: { tipo: "jogadores", ids: ["j3"] } }),
    );
    expect(abre.snapshotPara).toBe("todos");
    expect(ids(visaoPara(abre.estado, j3).pastas)).toEqual([PASTA_NPCS_ID, "pasta-todos"]);
    expect(ids(visaoPara(abre.estado, j3).personagens)).toContain("ogro");
    expect(ids(visaoPara(abre.estado, j1).personagens)).not.toContain("ogro");
    // o evento da pasta também é filtrado: quem passa a ver recebe a pasta; quem não, nada
    const ev = abre.eventos[0] as EventoSala;
    expect(eventoPara(ev, j3, e, abre.estado)?.tipo).toBe("pasta.alterada");
    expect(eventoPara(ev, j1, e, abre.estado)).toBeNull();
    // fechar de novo: quem via recebe "pasta.apagada" (sem nome), e some do snapshot
    const fecha = aplicar(
      abre.estado,
      "m",
      intencao("pasta.editar", { id: PASTA_NPCS_ID, visivel: { tipo: "mestre" } }),
    );
    expect(eventoPara(fecha.eventos[0] as EventoSala, j3, abre.estado, fecha.estado)).toEqual({
      ...(fecha.eventos[0] as EventoSala),
      tipo: "pasta.apagada",
      dados: { id: PASTA_NPCS_ID },
    });
    expect(ids(visaoPara(fecha.estado, j3).personagens)).not.toContain("ogro");
    // só renomear não manda snapshot
    const renomeia = aplicar(
      e,
      "m",
      intencao("pasta.editar", { id: "pasta-todos", nome: "Pistas" }),
    );
    expect(renomeia.snapshotPara).toEqual([]);
    const visto = eventoPara(renomeia.eventos[0] as EventoSala, j1, e, renomeia.estado);
    expect(visto?.tipo).toBe("pasta.alterada");
    expect(visto?.tipo === "pasta.alterada" && visto.dados.pasta.nome).toBe("Pistas");
  });

  it("criar, editar e apagar pasta é do mestre; só pasta vazia é apagada; jogador forçando é recusado", () => {
    const nova = pasta("pasta-nova", { tipo: "mestre" });
    expect(codigo(e, "j1", intencao("pasta.criar", { pasta: nova }))).toBe("sem_permissao");
    expect(codigo(e, "j1", intencao("pasta.editar", { id: "pasta-todos", nome: "x" }))).toBe(
      "sem_permissao",
    );
    expect(codigo(e, "j1", intencao("pasta.apagar", { id: "pasta-j2" }))).toBe("sem_permissao");
    const com = aplicar(e, "m", intencao("pasta.criar", { pasta: nova })).estado;
    expect(com.pastas).toHaveLength(5);
    expect(codigo(com, "m", intencao("pasta.criar", { pasta: nova }))).toBe("dados_invalidos");
    expect(
      codigo(
        e,
        "m",
        intencao("pasta.criar", { pasta: pasta("x", { tipo: "jogadores", ids: ["fantasma"] }) }),
      ),
    ).toBe("usuario_inexistente");
    expect(codigo(com, "m", intencao("pasta.apagar", { id: "pasta-nova" }))).toBeNull();
    expect(codigo(e, "m", intencao("pasta.apagar", { id: "pasta-todos" }))).toBe("dados_invalidos");
    expect(codigo(e, "m", intencao("pasta.apagar", { id: "nada" }))).toBe("pasta_inexistente");
    expect(
      codigo(e, "m", intencao("personagem.editar", { id: "ogro", mudancas: { pastaId: "nada" } })),
    ).toBe("pasta_inexistente");
  });

  it("personagem de pasta que o jogador não vê responde como inexistente", () => {
    expect(
      codigo(
        e,
        "j1",
        intencao("ficha.alterar", {
          personagemId: "diario",
          operacoes: [{ caminho: "pvAtual", valor: 1 }],
        }),
      ),
    ).toBe("personagem_inexistente");
    expect(
      codigo(
        e,
        "j1",
        intencao("personagem.editar", { id: "diario", mudancas: { assetHash: hex("a") } }),
      ),
    ).toBe("personagem_inexistente");
    // vendo mas sem editar: sem permissão
    expect(
      codigo(
        e,
        "j3",
        intencao("ficha.alterar", {
          personagemId: "mapa-mundi",
          operacoes: [{ caminho: "pvAtual", valor: 1 }],
        }),
      ),
    ).toBe("sem_permissao");
  });
});

describe("controle por quem edita", () => {
  const e = criarEstado();
  const tok = (id: string) => e.tokens.find((t) => t.id === id) as Token;

  it("quem edita o personagem move o token e altera o PV; outro jogador não", () => {
    expect(podeEditarPersonagem(e.personagens[0] as Personagem, j1)).toBe(true);
    expect(podeMoverToken(tok("t-aldric"), j1, e)).toBe(true);
    expect(podeMoverToken(tok("t-aldric"), j2, e)).toBe(false);
    expect(codigo(e, "j1", intencao("token.soltar", { id: "t-aldric", x: 5, y: 5 }))).toBeNull();
    expect(codigo(e, "j2", intencao("token.soltar", { id: "t-aldric", x: 5, y: 5 }))).toBe(
      "sem_permissao",
    );
    expect(
      aplicar(
        e,
        "j1",
        intencao("ficha.alterar", {
          personagemId: "aldric",
          operacoes: [{ caminho: "pvAtual", valor: 2 }],
        }),
      ).estado.personagens[0]?.ficha?.pvAtual,
    ).toBe(2);
    expect(
      codigo(
        e,
        "j2",
        intencao("ficha.alterar", {
          personagemId: "aldric",
          operacoes: [{ caminho: "pvAtual", valor: 2 }],
        }),
      ),
    ).toBe("personagem_inexistente");
  });

  it("'todos os jogadores' controla o token e edita a ficha de qualquer um; NPC só o mestre", () => {
    for (const j of [j1, j2, j3]) {
      expect(podeMoverToken(tok("t-compartilhado"), j, e)).toBe(true);
      expect(
        codigo(
          e,
          j.id,
          intencao("ficha.alterar", {
            personagemId: "compartilhado",
            operacoes: [{ caminho: "pvAtual", valor: 1 }],
          }),
        ),
      ).toBeNull();
      expect(podeMoverToken(tok("t-ogro"), j, e)).toBe(false);
    }
    expect(podeMoverToken(tok("t-ogro"), mestre, e)).toBe(true);
  });

  it("o mestre muda quem edita e o controle muda junto; jogador não muda isso", () => {
    const troca = aplicar(
      e,
      "m",
      intencao("personagem.editar", {
        id: "aldric",
        mudancas: { editores: { tipo: "jogadores", ids: ["j2"] } },
      }),
    ).estado;
    expect(podeMoverToken(troca.tokens[0] as Token, j2, troca)).toBe(true);
    expect(podeMoverToken(troca.tokens[0] as Token, j1, troca)).toBe(false);
    expect(
      codigo(
        e,
        "j1",
        intencao("personagem.editar", {
          id: "aldric",
          mudancas: { editores: { tipo: "todos" } },
        }),
      ),
    ).toBe("sem_permissao");
    expect(
      codigo(e, "j1", intencao("personagem.editar", { id: "aldric", mudancas: { nome: "Novo" } })),
    ).toBe("sem_permissao");
    expect(
      codigo(
        e,
        "m",
        intencao("personagem.editar", {
          id: "aldric",
          mudancas: { editores: { tipo: "jogadores", ids: ["m"] } },
        }),
      ),
    ).toBe("usuario_inexistente");
  });

  it("quem edita troca o retrato e o token padrão (com asset.subir); sem a capacidade, não", () => {
    const meta: Omit<AssetMeta, "donoId"> = {
      hash: hex("b"),
      tipo: "retrato",
      mime: "image/webp",
      bytes: 100,
      largura: 64,
      altura: 64,
      nomeOriginal: "r.png",
      pedacos: [hex("c")],
    };
    const comAsset = aplicar(e, "j1", intencao("asset.registrar", { metas: [meta] })).estado;
    const feito = aplicar(
      comAsset,
      "j1",
      intencao("personagem.editar", {
        id: "aldric",
        mudancas: { retratoHash: hex("b"), assetHash: hex("b") },
      }),
    ).estado;
    expect(feito.personagens[0]).toMatchObject({
      retratoHash: hex("b"),
      tokenPadrao: { assetHash: hex("b") },
    });
    const tira = aplicar(
      feito,
      "j1",
      intencao("personagem.editar", { id: "aldric", mudancas: { retratoHash: null } }),
    ).estado;
    expect(tira.personagens[0]?.retratoHash).toBeUndefined();
    const semCapacidade = aplicar(
      comAsset,
      "m",
      intencao("permissao.alterar", { capacidade: "asset.subir", valor: false }),
    ).estado;
    expect(
      codigo(
        semCapacidade,
        "j1",
        intencao("personagem.editar", { id: "aldric", mudancas: { retratoHash: hex("b") } }),
      ),
    ).toBe("sem_permissao");
    // o retrato é visível a quem vê o personagem, e só a ele
    expect(assetVisivelPara(hex("b"), feito, j1)).toBe(true);
    expect(assetVisivelPara(hex("b"), feito, j2)).toBe(false);
  });
});

describe("camada mapa", () => {
  const e = criarEstado();
  const cenario = token("t-cenario", { camada: "mapa", controladoPor: ["j1"] });

  it("o jogador vê o objeto do mapa mas não o move; o mestre move", () => {
    expect(tokenVisivelPara(cenario, j2, "cena-1")).toBe(true);
    expect(tokenVisivelPara({ ...cenario, oculto: true }, j2, "cena-1")).toBe(false);
    expect(tokenVisivelPara({ ...cenario, cenaId: "outra" }, j2, "cena-1")).toBe(false);
    expect(podeMoverToken(cenario, j1, e)).toBe(false); // nem quem está em controladoPor
    expect(podeMoverToken(cenario, mestre, e)).toBe(true);
    expect(tokenVisivelPara(token("m", { camada: "mestre" }), j1, "cena-1")).toBe(false);
  });

  it("a sala cria o token na camada mapa, entrega ao jogador e recusa que ele o mova", () => {
    const r = aplicar(
      e,
      "m",
      intencao("token.criar", { token: { ...cenario, cenaId: undefined, controladoPor: [] } }),
    );
    expect(r.estado.tokens.find((t) => t.id === "t-cenario")?.camada).toBe("mapa");
    const ev = r.eventos[0] as EventoSala;
    expect(eventoPara(ev, j1, e, r.estado)).toEqual(ev);
    expect(visaoPara(r.estado, j1).tokens.some((t) => t.id === "t-cenario")).toBe(true);
    expect(codigo(r.estado, "j1", intencao("token.soltar", { id: "t-cenario", x: 1, y: 1 }))).toBe(
      "sem_permissao",
    );
    expect(
      codigo(r.estado, "m", intencao("token.soltar", { id: "t-cenario", x: 1, y: 1 })),
    ).toBeNull();
    // o mestre manda o token para a camada do mestre: some do jogador
    const some = aplicar(
      r.estado,
      "m",
      intencao("token.editar", { id: "t-cenario", mudancas: { camada: "mestre" } }),
    );
    expect(eventoPara(some.eventos[0] as EventoSala, j1, r.estado, some.estado)?.tipo).toBe(
      "token.sumiu",
    );
  });
});

describe("ordem de turno", () => {
  const e = criarEstado();

  it("só o mestre liga e desliga; o evento chega a todos", () => {
    expect(e.ordemDeTurnoVisivel).toBe(false);
    expect(codigo(e, "j1", intencao("ordemDeTurno.definir", { visivel: true }))).toBe(
      "sem_permissao",
    );
    const r = aplicar(e, "m", intencao("ordemDeTurno.definir", { visivel: true }));
    expect(r.estado.ordemDeTurnoVisivel).toBe(true);
    const ev = r.eventos[0] as EventoSala;
    for (const u of [mestre, j1, j2]) expect(eventoPara(ev, u, e, r.estado)).toEqual(ev);
    expect(visaoPara(r.estado, j1).ordemDeTurnoVisivel).toBe(true);
    let cliente = visaoPara(e, j2);
    cliente = reduzir(cliente, ev);
    expect(cliente.ordemDeTurnoVisivel).toBe(true);
    // repetir o mesmo valor não gera evento
    expect(
      aplicar(r.estado, "m", intencao("ordemDeTurno.definir", { visivel: true })).eventos,
    ).toEqual([]);
  });
});

describe("migração do donoId e exportações", () => {
  const antigo = (donoId: string | null, extra: object = {}) => ({
    id: "p",
    donoId,
    nome: "Antigo",
    tokenPadrao: { cor: "#1", tamanhoQuadrados: 1 },
    visao: { alcanceM: null, visaoNoEscuroM: 0 },
    ficha: { pvAtual: 3, pvMax: 4 },
    ...extra,
  });

  it("o dono vira 'quem edita' numa pasta só do mestre; NPC vai para NPCs sem editor", () => {
    const jogador = migrarPersonagem(antigo("j1") as never);
    expect(jogador).toMatchObject({
      pastaId: PASTA_PERSONAGENS_ID,
      editores: { tipo: "jogadores", ids: ["j1"] },
    });
    expect(jogador).not.toHaveProperty("donoId");
    expect(migrarPersonagem(antigo(null) as never)).toMatchObject({
      pastaId: PASTA_NPCS_ID,
      editores: { tipo: "jogadores", ids: [] },
    });
    // do banco: o formato antigo migra, o novo passa direto
    expect(personagemDoBanco(antigo("j2")).editores).toEqual({ tipo: "jogadores", ids: ["j2"] });
    const novo = personagem("x", "pasta-todos", { tipo: "todos" });
    expect(personagemDoBanco(JSON.parse(JSON.stringify(novo)))).toEqual(novo);
  });

  it("só o antigo dono e o mestre continuam vendo o personagem migrado (como antes)", () => {
    const e = estadoInicial({
      usuarios: criarEstado().usuarios,
      personagens: [migrarPersonagem(antigo("j1") as never)],
    });
    expect(visaoPara(e, j1).personagens).toHaveLength(1);
    expect(visaoPara(e, j2).personagens).toEqual([]);
    expect(visaoPara(e, j2).pastas).toEqual([]);
    expect(visaoPara(e, mestre).personagens).toHaveLength(1);
  });

  it("a exportação v5 leva pastas, editores, retrato e a ordem de turno, e volta igual", () => {
    let e = criarEstado();
    e = aplicar(e, "m", intencao("ordemDeTurno.definir", { visivel: true })).estado;
    const x = criarExportacao(e, AGORA);
    expect(x.versao).toBe(VERSAO_EXPORTACAO);
    expect(x.versao).toBe(10);
    expect(x.dados.pastas).toHaveLength(4);
    expect(x.dados.ordemDeTurnoVisivel).toBe(true);
    const lida = lerExportacao(JSON.parse(JSON.stringify(x)));
    expect(lida.ok && lida.exportacao.dados).toEqual(x.dados);
    // incoerências: pasta que não existe, pasta repetida, editor desconhecido
    const ruim = (dados: object) => lerExportacao({ ...x, dados: { ...x.dados, ...dados } }).ok;
    expect(ruim({})).toBe(true);
    expect(ruim({ pastas: [] })).toBe(false);
    expect(ruim({ pastas: [...x.dados.pastas, x.dados.pastas[0]] })).toBe(false);
    expect(
      ruim({
        personagens: [
          { ...personagem("p", PASTA_NPCS_ID, { tipo: "jogadores", ids: ["fantasma"] }) },
          ...x.dados.personagens.slice(1),
        ],
      }),
    ).toBe(false);
  });

  it("importa de v1 a v4 como v5: v4 migra o dono; v1 a v3 ganham as duas pastas padrão", () => {
    const base = criarExportacao(criarEstado(), AGORA).dados;
    const { pastas: _p, ordemDeTurnoVisivel: _o, personagens: _ps, ...comum } = base;
    const v4 = {
      formato: "tabletop-campanha",
      versao: 4,
      exportadoEm: AGORA,
      dados: {
        ...comum,
        tokens: comum.tokens.filter(
          (t) => t.personagemId === "aldric" || t.personagemId === "ogro",
        ),
        personagens: [antigo("j1", { id: "aldric" }), antigo(null, { id: "ogro" })],
      },
    };
    const l4 = lerExportacao(v4);
    expect(l4.ok).toBe(true);
    if (!l4.ok) return;
    expect(l4.exportacao.versao).toBe(10);
    expect(l4.exportacao.dados.pastas.map((p) => [p.id, p.visivel.tipo])).toEqual([
      [PASTA_PERSONAGENS_ID, "mestre"],
      [PASTA_NPCS_ID, "mestre"],
    ]);
    expect(l4.exportacao.dados.ordemDeTurnoVisivel).toBe(false);
    expect(l4.exportacao.dados.personagens.map((p) => [p.id, p.pastaId, p.editores])).toEqual([
      ["aldric", PASTA_PERSONAGENS_ID, { tipo: "jogadores", ids: ["j1"] }],
      ["ogro", PASTA_NPCS_ID, { tipo: "jogadores", ids: [] }],
    ]);
    // v4 com dono desconhecido continua sendo recusado
    expect(
      lerExportacao({
        ...v4,
        dados: { ...v4.dados, personagens: [antigo("fantasma", { id: "aldric" })] },
      }).ok,
    ).toBe(false);

    const { tokens: _t, personagens: _x, ...dadosV3 } = v4.dados;
    const semTokens = { ...dadosV3, tokens: [] as Token[] };
    for (const versao of [3, 2]) {
      const dados = versao === 2 ? (({ assets: _a, ...r }) => r)(semTokens) : semTokens;
      const l = lerExportacao({ ...v4, versao, dados });
      expect(l.ok && l.exportacao.versao).toBe(10);
      expect(l.ok && l.exportacao.dados.personagens).toEqual([]);
      expect(l.ok && l.exportacao.dados.pastas.map((p) => p.id)).toEqual([
        PASTA_PERSONAGENS_ID,
        PASTA_NPCS_ID,
      ]);
    }
    const { cenas: _c, cenaAtivaId: _i, tokens: _tk, assets: _as, ...dadosV1 } = semTokens;
    const l1 = lerExportacao({ ...v4, versao: 1, dados: dadosV1 });
    expect(l1.ok && l1.exportacao.dados.cenas).toEqual([CENA_PADRAO]);
  });

  it("importar v5 pela sala troca as pastas e os personagens (e o snapshot do jogador acompanha)", () => {
    const origem = criarEstado();
    const outro = estadoInicial({ usuarios: origem.usuarios });
    const r = aplicar(
      outro,
      "m",
      intencao("campanha.importar", { dados: criarExportacao(origem, AGORA) }),
    );
    expect(r.estado.pastas).toHaveLength(4);
    expect(r.snapshotPara).toBe("todos");
    expect(ids(visaoPara(r.estado, j3).pastas)).toEqual(["pasta-todos"]);
  });
});
