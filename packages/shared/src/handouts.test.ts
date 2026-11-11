import { describe, expect, it } from "vitest";
import {
  type AssetMeta,
  assetVisivelPara,
  criarExportacao,
  type Estado,
  estadoInicial,
  eventoPara,
  HANDOUT_NOTA_DA_MESA_ID,
  HANDOUT_NOTA_DO_MESTRE_ID,
  type Handout,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  migrarNotasParaHandouts,
  PASTA_HANDOUTS_ID,
  PASTA_NPCS_ID,
  PASTA_PERSONAGENS_ID,
  pastasPadrao,
  processar,
  reduzir,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const MESTRE = { id: "m", papel: "mestre" } as const;
const J1 = { id: "j1", papel: "jogador" } as const;
const J2 = { id: "j2", papel: "jogador" } as const;

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
    ],
  });
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

function codigo(estado: Estado, quem: string, i: Intencao): string | null {
  const r = processar(estado, quem, i, AGORA);
  return r.ok ? null : r.erro.codigo;
}

function handout(id: string, extra: Partial<Handout> = {}): Handout {
  return {
    id,
    pastaId: PASTA_PERSONAGENS_ID,
    titulo: `Título ${id}`,
    texto: `Texto de ${id}`,
    fonte: "livro",
    visivel: { tipo: "mestre" },
    ...extra,
  };
}

function comHandouts(...hs: Handout[]): Estado {
  let e = criarEstado();
  for (const h of hs) e = aplicar(e, "m", intencao("handout.criar", { handout: h })).estado;
  return e;
}

const META_RETRATO: AssetMeta = {
  hash: "a".repeat(64),
  tipo: "retrato",
  mime: "image/webp",
  bytes: 10,
  pedacos: ["b".repeat(64)],
  donoId: "m",
} as unknown as AssetMeta;

describe("migração das notas para handouts", () => {
  it("as duas notas viram dois handouts numa pasta nova só do mestre", () => {
    const r = migrarNotasParaHandouts(
      { notaMesa: "Para todos", notaMestre: "Segredo" },
      pastasPadrao(),
    );
    expect(r.handouts.map((h) => [h.id, h.titulo, h.texto, h.visivel])).toEqual([
      [HANDOUT_NOTA_DA_MESA_ID, "Nota da mesa", "Para todos", { tipo: "todos" }],
      [HANDOUT_NOTA_DO_MESTRE_ID, "Nota do mestre", "Segredo", { tipo: "mestre" }],
    ]);
    expect(r.handouts.every((h) => h.pastaId === PASTA_HANDOUTS_ID && h.fonte === "simples")).toBe(
      true,
    );
    const nova = r.pastas.find((p) => p.id === PASTA_HANDOUTS_ID);
    expect(nova).toEqual({
      id: PASTA_HANDOUTS_ID,
      nome: "Handouts",
      ordem: 2,
      visivel: { tipo: "mestre" },
    });
    expect(r.pastas).toHaveLength(3);
  });

  it("nota vazia (ou só espaços) não vira handout; sem nada a migrar a pasta nem nasce", () => {
    const so = migrarNotasParaHandouts({ notaMesa: "  \n", notaMestre: "Só esta" }, pastasPadrao());
    expect(so.handouts.map((h) => h.id)).toEqual([HANDOUT_NOTA_DO_MESTRE_ID]);
    const nada = migrarNotasParaHandouts({ notaMesa: "", notaMestre: "" }, pastasPadrao());
    expect(nada.handouts).toEqual([]);
    expect(nada.pastas).toEqual(pastasPadrao());
  });

  it("usa a pasta Handouts que já existir", () => {
    const pastas = [
      ...pastasPadrao(),
      { id: PASTA_HANDOUTS_ID, nome: "Meus", ordem: 5, visivel: { tipo: "todos" as const } },
    ];
    const r = migrarNotasParaHandouts({ notaMesa: "x" }, pastas);
    expect(r.pastas).toEqual(pastas);
  });

  it("importar uma exportação antiga (v12 com notaMesa e notaMestre) cria os dois handouts", () => {
    const e = criarEstado();
    const atual = criarExportacao(e, AGORA);
    const { handouts: _h, ...dados } = atual.dados;
    const antiga = {
      ...atual,
      versao: 12,
      dados: { ...dados, notaMesa: "Aviso", notaMestre: "Plano secreto" },
    };
    const lida = lerExportacao(JSON.parse(JSON.stringify(antiga)));
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.exportacao.versao).toBe(13);
    expect(lida.exportacao.dados.handouts.map((h) => h.titulo)).toEqual([
      "Nota da mesa",
      "Nota do mestre",
    ]);
    expect(lida.exportacao.dados.pastas.map((p) => p.id)).toContain(PASTA_HANDOUTS_ID);
    // As notas não ficam no estado.
    expect(Object.keys(lida.exportacao.dados)).not.toContain("notaMesa");
    expect(Object.keys(lida.exportacao.dados)).not.toContain("notaMestre");
    const r = aplicar(e, "m", intencao("campanha.importar", { dados: antiga }));
    expect(r.estado.handouts).toHaveLength(2);
    expect(Object.keys(r.estado)).not.toContain("notaMesa");
  });

  it("exportação antiga com as notas vazias não cria handout nem pasta", () => {
    const atual = criarExportacao(criarEstado(), AGORA);
    const { handouts: _h, ...dados } = atual.dados;
    const lida = lerExportacao({
      ...atual,
      versao: 11,
      dados: { ...dados, notaMesa: "", notaMestre: "" },
    });
    expect(lida.ok && lida.exportacao.dados.handouts).toEqual([]);
    expect(lida.ok && lida.exportacao.dados.pastas.map((p) => p.id)).toEqual([
      PASTA_PERSONAGENS_ID,
      PASTA_NPCS_ID,
    ]);
  });

  it("a v13 faz a viagem de ida e volta com os handouts", () => {
    const e = comHandouts(
      handout("h1", { visivel: { tipo: "todos" }, fonte: "manuscrito" }),
      handout("h2", { visivel: { tipo: "jogadores", ids: ["j1"] } }),
    );
    const x = criarExportacao(e, AGORA);
    expect(x.versao).toBe(13);
    const lida = lerExportacao(JSON.parse(JSON.stringify(x)));
    expect(lida.ok && lida.exportacao.dados.handouts).toEqual(e.handouts);
  });

  it("recusa handout em pasta inexistente, id repetido e visível para usuário desconhecido", () => {
    const x = criarExportacao(comHandouts(handout("h1")), AGORA);
    const ruim = (handouts: Handout[]) =>
      lerExportacao({ ...x, dados: { ...x.dados, handouts } }).ok;
    expect(ruim([handout("h1")])).toBe(true);
    expect(ruim([handout("h1", { pastaId: "nada" })])).toBe(false);
    expect(ruim([handout("h1"), handout("h1")])).toBe(false);
    expect(ruim([handout("h1", { visivel: { tipo: "jogadores", ids: ["fantasma"] } })])).toBe(
      false,
    );
    expect(ruim([handout("h1", { imagemHash: "c".repeat(64) })])).toBe(false);
  });
});

describe("handouts: as intenções", () => {
  it("o mestre cria, edita (um campo por vez), move, esconde e apaga", () => {
    let e = comHandouts(handout("h1"));
    e = aplicar(
      e,
      "m",
      intencao("handout.editar", { id: "h1", mudancas: { texto: "Novo" } }),
    ).estado;
    e = aplicar(
      e,
      "m",
      intencao("handout.editar", { id: "h1", mudancas: { fonte: "medieval" } }),
    ).estado;
    e = aplicar(
      e,
      "m",
      intencao("handout.editar", {
        id: "h1",
        mudancas: { pastaId: PASTA_NPCS_ID, titulo: "Livro" },
      }),
    ).estado;
    expect(e.handouts[0]).toMatchObject({
      texto: "Novo",
      fonte: "medieval",
      pastaId: PASTA_NPCS_ID,
      titulo: "Livro",
    });
    e = aplicar(e, "m", intencao("handout.apagar", { id: "h1" })).estado;
    expect(e.handouts).toEqual([]);
  });

  it("o jogador não cria, edita, apaga nem mostra handout", () => {
    const e = comHandouts(handout("h1", { visivel: { tipo: "todos" } }));
    for (const i of [
      intencao("handout.criar", { handout: handout("h2") }),
      intencao("handout.editar", { id: "h1", mudancas: { texto: "x" } }),
      intencao("handout.apagar", { id: "h1" }),
      intencao("handout.mostrar", { id: "h1" }),
    ]) {
      expect(codigo(e, "j1", i), i.tipo).toBe("sem_permissao");
    }
  });

  it("recusa pasta, jogador, imagem e handout inexistentes", () => {
    const e = comHandouts(handout("h1"));
    expect(codigo(e, "m", intencao("handout.criar", { handout: handout("h1") }))).toBe(
      "dados_invalidos",
    );
    expect(
      codigo(e, "m", intencao("handout.criar", { handout: handout("h2", { pastaId: "nada" }) })),
    ).toBe("pasta_inexistente");
    expect(
      codigo(
        e,
        "m",
        intencao("handout.criar", {
          handout: handout("h2", { visivel: { tipo: "jogadores", ids: ["m"] } }),
        }),
      ),
    ).toBe("usuario_inexistente");
    expect(
      codigo(
        e,
        "m",
        intencao("handout.criar", { handout: handout("h2", { imagemHash: "d".repeat(64) }) }),
      ),
    ).toBe("asset_inexistente");
    for (const tipo of ["handout.apagar", "handout.mostrar"] as const) {
      expect(codigo(e, "m", intencao(tipo, { id: "nada" }))).toBe("handout_inexistente");
    }
    expect(
      codigo(e, "m", intencao("handout.editar", { id: "nada", mudancas: { texto: "x" } })),
    ).toBe("handout_inexistente");
  });

  it("a imagem do handout (asset retrato) entra e sai com imagemHash null", () => {
    let e = comHandouts(handout("h1"));
    e = { ...e, assets: [META_RETRATO] };
    e = aplicar(
      e,
      "m",
      intencao("handout.editar", { id: "h1", mudancas: { imagemHash: META_RETRATO.hash } }),
    ).estado;
    expect(e.handouts[0]?.imagemHash).toBe(META_RETRATO.hash);
    e = aplicar(
      e,
      "m",
      intencao("handout.editar", { id: "h1", mudancas: { imagemHash: null } }),
    ).estado;
    expect(e.handouts[0]).not.toHaveProperty("imagemHash");
  });

  it("uma pasta com handout não se apaga", () => {
    const e = comHandouts(handout("h1", { pastaId: PASTA_NPCS_ID }));
    expect(codigo(e, "m", intencao("pasta.apagar", { id: PASTA_NPCS_ID }))).toBe("dados_invalidos");
  });

  it("limita título e texto e recusa fonte fora das 5", () => {
    const ruim = (extra: object) =>
      IntencaoSchema.safeParse({
        v: 1,
        id: "p",
        tipo: "handout.criar",
        dados: { handout: { ...handout("h1"), ...extra } },
      }).success;
    expect(ruim({})).toBe(true);
    expect(ruim({ texto: "x".repeat(20_000) })).toBe(true);
    expect(ruim({ texto: "x".repeat(20_001) })).toBe(false);
    expect(ruim({ titulo: "" })).toBe(false);
    expect(ruim({ titulo: "x".repeat(81) })).toBe(false);
    expect(ruim({ fonte: "comic" })).toBe(false);
  });

  it("criar um handout para todos (ou editar quem vê) pede snapshot novo; texto só, não", () => {
    const e = criarEstado();
    const criado = aplicar(
      e,
      "m",
      intencao("handout.criar", { handout: handout("h1", { visivel: { tipo: "todos" } }) }),
    );
    expect(criado.snapshotPara).toBe("todos");
    const soDoMestre = aplicar(e, "m", intencao("handout.criar", { handout: handout("h2") }));
    expect(soDoMestre.snapshotPara).toEqual([]);
    const texto = aplicar(
      criado.estado,
      "m",
      intencao("handout.editar", { id: "h1", mudancas: { texto: "mais" } }),
    );
    expect(texto.snapshotPara).toEqual([]);
    const quemVe = aplicar(
      criado.estado,
      "m",
      intencao("handout.editar", { id: "h1", mudancas: { visivel: { tipo: "mestre" } } }),
    );
    expect(quemVe.snapshotPara).toBe("todos");
  });
});

describe("handouts: o que o jogador recebe", () => {
  const e = comHandouts(
    handout("segredo", { titulo: "MEU SEGREDO", texto: "SÓ DO MESTRE" }),
    handout("geral", { visivel: { tipo: "todos" }, pastaId: PASTA_NPCS_ID }),
    handout("so-j1", { visivel: { tipo: "jogadores", ids: ["j1"] }, pastaId: PASTA_NPCS_ID }),
  );

  it("o snapshot do jogador não leva o handout do mestre (nem o título)", () => {
    const v = visaoPara(e, J1);
    expect(JSON.stringify(v)).not.toContain("MEU SEGREDO");
    expect(JSON.stringify(v)).not.toContain("SÓ DO MESTRE");
    expect(v.handouts.map((h) => h.id).sort()).toEqual(["geral", "so-j1"]);
    const v2 = visaoPara(e, J2);
    expect(v2.handouts.map((h) => h.id)).toEqual(["geral"]);
    expect(visaoPara(e, MESTRE).handouts).toHaveLength(3);
  });

  it("a pasta aparece por causa do handout visível, e só com esses itens", () => {
    const v = visaoPara(e, J1);
    // As duas pastas são só do mestre: a dos handouts visíveis chega, a do segredo não.
    expect(v.pastas.map((p) => p.id)).toEqual([PASTA_NPCS_ID]);
    expect(v.handouts.every((h) => h.pastaId === PASTA_NPCS_ID)).toBe(true);
    expect(visaoPara(criarEstado(), J1).pastas).toEqual([]);
  });

  it("um personagem na pasta que só chega por causa do handout continua escondido", () => {
    const base = comHandouts(
      handout("geral", { visivel: { tipo: "todos" }, pastaId: PASTA_NPCS_ID }),
    );
    const comNpc = aplicar(
      base,
      "m",
      intencao("personagem.criar", {
        personagem: {
          id: "npc1",
          pastaId: PASTA_NPCS_ID,
          editores: { tipo: "jogadores", ids: [] },
          nome: "Vilão",
          tokenPadrao: { cor: "#c00", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 0 },
        },
      }),
    ).estado;
    const v = visaoPara(comNpc, J1);
    expect(v.pastas.map((p) => p.id)).toEqual([PASTA_NPCS_ID]);
    expect(v.personagens).toEqual([]);
    expect(JSON.stringify(v)).not.toContain("Vilão");
  });

  it("os eventos do handout só vão a quem pode vê-lo", () => {
    const criado = aplicar(
      criarEstado(),
      "m",
      intencao("handout.criar", { handout: handout("h1", { titulo: "MEU SEGREDO" }) }),
    );
    const ev = criado.eventos[0];
    if (!ev) throw new Error("sem evento");
    expect(eventoPara(ev, J1, criarEstado(), criado.estado)).toBeNull();
    expect(eventoPara(ev, MESTRE, criarEstado(), criado.estado)).toEqual(ev);
    // Sem o estado (falha fechada), o jogador não recebe nada.
    expect(eventoPara(ev, J1)).toBeNull();
  });

  it("ao ganhar a permissão o jogador recebe o handout; ao perder, ele some (sem título)", () => {
    const antes = comHandouts(handout("h1", { titulo: "MEU SEGREDO" }));
    const mostrar = aplicar(
      antes,
      "m",
      intencao("handout.editar", {
        id: "h1",
        mudancas: { visivel: { tipo: "jogadores", ids: ["j1"] } },
      }),
    );
    const ev = mostrar.eventos[0];
    if (!ev) throw new Error("sem evento");
    expect(mostrar.snapshotPara).toBe("todos");
    const visto = eventoPara(ev, J1, antes, mostrar.estado);
    expect(visto?.tipo).toBe("handout.alterado");
    expect(eventoPara(ev, J2, antes, mostrar.estado)).toBeNull();
    expect(JSON.stringify(visaoPara(mostrar.estado, J1).handouts)).toContain("MEU SEGREDO");

    const esconder = aplicar(
      mostrar.estado,
      "m",
      intencao("handout.editar", { id: "h1", mudancas: { visivel: { tipo: "mestre" } } }),
    );
    const evSumiu = esconder.eventos[0];
    if (!evSumiu) throw new Error("sem evento");
    const sumiu = eventoPara(evSumiu, J1, mostrar.estado, esconder.estado);
    expect(sumiu).toMatchObject({ tipo: "handout.apagado", dados: { id: "h1" } });
    expect(JSON.stringify(sumiu)).not.toContain("MEU SEGREDO");
    expect(eventoPara(evSumiu, J2, mostrar.estado, esconder.estado)).toBeNull();
  });

  it("o cliente do jogador chega ao mesmo estado aplicando os eventos e os snapshots", () => {
    let sala = criarEstado();
    let cliente = visaoPara(sala, J1);
    const passos: Intencao[] = [
      intencao("handout.criar", { handout: handout("a", { visivel: { tipo: "todos" } }) }),
      intencao("handout.criar", { handout: handout("b") }),
      intencao("handout.editar", { id: "a", mudancas: { texto: "Mudou" } }),
      intencao("handout.editar", {
        id: "b",
        mudancas: { visivel: { tipo: "jogadores", ids: ["j1"] } },
      }),
      intencao("handout.editar", { id: "a", mudancas: { visivel: { tipo: "mestre" } } }),
      intencao("handout.apagar", { id: "b" }),
    ];
    for (const i of passos) {
      const anterior = sala;
      const r = aplicar(sala, "m", i);
      sala = r.estado;
      for (const ev of r.eventos) {
        const visto = eventoPara(ev, J1, anterior, sala);
        if (visto) cliente = reduzir(cliente, visto);
      }
      if (r.snapshotPara === "todos") cliente = visaoPara(sala, J1);
      expect(cliente.handouts).toEqual(visaoPara(sala, J1).handouts);
    }
  });

  it('"Mostrar agora" só chega a quem vê o handout e não muda o estado', () => {
    const base = comHandouts(
      handout("h1", { visivel: { tipo: "jogadores", ids: ["j1"] } }),
      handout("h2"),
    );
    const r = aplicar(base, "m", intencao("handout.mostrar", { id: "h1" }));
    expect(r.estado.handouts).toEqual(base.handouts);
    const ev = r.eventos[0];
    if (!ev) throw new Error("sem evento");
    expect(ev).toMatchObject({ tipo: "handout.mostrado", dados: { id: "h1" } });
    expect(eventoPara(ev, J1, base, r.estado)).toEqual(ev);
    expect(eventoPara(ev, J2, base, r.estado)).toBeNull();
    expect(eventoPara(ev, MESTRE, base, r.estado)).toEqual(ev);
    // Handout só do mestre: ninguém mais o recebe.
    const so = aplicar(base, "m", intencao("handout.mostrar", { id: "h2" }));
    const evSo = so.eventos[0];
    if (!evSo) throw new Error("sem evento");
    expect(eventoPara(evSo, J1, base, so.estado)).toBeNull();
    expect(eventoPara(evSo, J2, base, so.estado)).toBeNull();
  });
});

describe("handouts: a imagem", () => {
  it("o jogador só vê o arquivo da imagem de um handout que ele vê", () => {
    const base = {
      ...comHandouts(handout("h1", { visivel: { tipo: "jogadores", ids: ["j1"] } })),
      assets: [META_RETRATO],
    };
    const e = {
      ...base,
      handouts: base.handouts.map((h) => ({ ...h, imagemHash: META_RETRATO.hash })),
    };
    expect(assetVisivelPara(META_RETRATO.hash, e, J1)).toBe(true);
    expect(assetVisivelPara(META_RETRATO.hash, e, J2)).toBe(false);
    expect(assetVisivelPara(META_RETRATO.hash, e, MESTRE)).toBe(true);
  });

  it("a exportação leva a meta da imagem do handout", () => {
    const base = comHandouts(handout("h1"));
    const e = {
      ...base,
      assets: [META_RETRATO],
      handouts: base.handouts.map((h) => ({ ...h, imagemHash: META_RETRATO.hash })),
    };
    const x = criarExportacao(e, AGORA);
    expect(x.dados.assets.map((a) => a.hash)).toEqual([META_RETRATO.hash]);
  });
});
