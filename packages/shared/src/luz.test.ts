import { describe, expect, it } from "vitest";
import {
  CONFIG_PADRAO,
  criarExportacao,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  type FonteDeLuz,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  luzVisivelPara,
  processar,
  raiosEfetivos,
  reduzir,
  resolverLuzes,
  VERSAO_EXPORTACAO,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const JOGADOR = { id: "j1", papel: "jogador" as const };
const MESTRE = { id: "m", papel: "mestre" as const };

const fonte = (id: string, extra: Partial<FonteDeLuz> = {}): FonteDeLuz => ({
  id,
  cenaId: "c1",
  nome: id,
  portador: { tipo: "cena", x: 10, y: 10 },
  luz: { claraM: 6, penumbraM: 6, cor: "#ffb347", tremula: false },
  intensidade: 1,
  acesa: true,
  ...extra,
});

function criarEstado(): Estado {
  const base = estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
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
      {
        id: "goblin",
        cenaId: "c1",
        nome: "Goblin",
        cor: "#080",
        tamanhoQuadrados: 1,
        x: 20.25,
        y: 20.25,
        camada: "tokens",
        oculto: true,
        controladoPor: [],
      },
      {
        id: "marcador",
        cenaId: "c1",
        nome: "Marcador",
        cor: "#808",
        tamanhoQuadrados: 1,
        x: 22.25,
        y: 20.25,
        camada: "mestre",
        oculto: false,
        controladoPor: [],
      },
    ],
  });
  return {
    ...base,
    luzes: [
      fonte("fixa"),
      fonte("outra-cena", { cenaId: "c2" }),
      fonte("do-t1", { portador: { tipo: "token", tokenId: "t1" } }),
      fonte("do-goblin", { portador: { tipo: "token", tokenId: "goblin" } }),
      fonte("do-marcador", { portador: { tipo: "token", tokenId: "marcador" } }),
    ],
  };
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

describe("raio efetivo", () => {
  const tocha = { luz: fonte("t").luz, intensidade: 1 };
  it("sem mexer em nada vale o raio da luz (6 m + 6 m)", () => {
    expect(raiosEfetivos(tocha, 1)).toEqual({ claraM: 6, totalM: 12 });
  });
  it("multiplica pela intensidade e pelo fator geral", () => {
    expect(raiosEfetivos({ ...tocha, intensidade: 0.5 }, 1)).toEqual({ claraM: 3, totalM: 6 });
    expect(raiosEfetivos({ ...tocha, intensidade: 0.5 }, 0.5)).toEqual({ claraM: 1.5, totalM: 3 });
    expect(raiosEfetivos(tocha, 0)).toEqual({ claraM: 0, totalM: 0 });
  });
  it("resolverLuzes: só as acesas da cena, com o fator da cena; a de token sai do token", () => {
    const e = criarEstado();
    const c1 = { ...(e.cenas[0] as Estado["cenas"][number]), fatorDeLuz: 0.5 };
    const r = resolverLuzes(
      [...e.luzes, fonte("apagada", { acesa: false }), fonte("zerada", { intensidade: 0 })],
      c1,
      e.tokens,
    );
    expect(r.map((l) => l.id).sort()).toEqual(["do-goblin", "do-marcador", "do-t1", "fixa"]);
    const fixa = r.find((l) => l.id === "fixa");
    expect(fixa).toMatchObject({ x: 10, y: 10, claraM: 3, totalM: 6 });
    expect(r.find((l) => l.id === "do-t1")).toMatchObject({ x: 5.25, y: 5.25 });
    // a posição animada na tela vale mais que a do estado
    const animada = resolverLuzes(e.luzes, c1, e.tokens, (id) =>
      id === "t1" ? { x: 7, y: 7 } : undefined,
    );
    expect(animada.find((l) => l.id === "do-t1")).toMatchObject({ x: 7, y: 7 });
  });
});

describe("sigilo das fontes de luz", () => {
  const e = criarEstado();
  it("o snapshot do jogador só tem as da cena ativa, sem a do token oculto nem a da camada do mestre", () => {
    const ids = visaoPara(e, JOGADOR)
      .luzes.map((l) => l.id)
      .sort();
    expect(ids).toEqual(["do-t1", "fixa"]);
    expect(visaoPara(e, MESTRE).luzes).toHaveLength(5);
    const texto = JSON.stringify(visaoPara(e, JOGADOR));
    for (const proibido of ["outra-cena", "do-goblin", "do-marcador"]) {
      expect(texto).not.toContain(proibido);
    }
  });
  it("luzVisivelPara: o mestre vê todas", () => {
    for (const l of e.luzes) expect(luzVisivelPara(l, MESTRE, e.tokens, "c1")).toBe(true);
  });
  it("o evento de uma luz de outra cena ou de token oculto não chega ao jogador", () => {
    const outra = aplicar(
      e,
      "m",
      intencao("fonte.editar", { id: "outra-cena", mudancas: { intensidade: 0.2 } }),
    );
    expect(eventoPara(outra.eventos[0] as EventoSala, JOGADOR, e, outra.estado)).toBeNull();
    const goblin = aplicar(
      e,
      "m",
      intencao("fonte.editar", { id: "do-goblin", mudancas: { intensidade: 0.2 } }),
    );
    expect(eventoPara(goblin.eventos[0] as EventoSala, JOGADOR, e, goblin.estado)).toBeNull();
    const visivel = aplicar(
      e,
      "m",
      intencao("fonte.editar", { id: "fixa", mudancas: { intensidade: 0.2 } }),
    );
    expect(eventoPara(visivel.eventos[0] as EventoSala, JOGADOR, e, visivel.estado)?.tipo).toBe(
      "fonte.editada",
    );
    // o mestre recebe todos
    expect(eventoPara(goblin.eventos[0] as EventoSala, MESTRE, e, goblin.estado)).not.toBeNull();
  });
  it("esconder o token que carrega a luz a tira do jogador (snapshot novo); apagar o token apaga a luz", () => {
    const esconde = aplicar(
      e,
      "m",
      intencao("token.editar", { id: "t1", mudancas: { oculto: true } }),
    );
    expect(esconde.snapshotPara).toBe("todos");
    expect(visaoPara(esconde.estado, JOGADOR).luzes.map((l) => l.id)).toEqual(["fixa"]);
    // token sem luz: nenhum snapshot extra
    const semLuz = criarEstado();
    const t = aplicar(
      { ...semLuz, luzes: [] },
      "m",
      intencao("token.editar", { id: "t1", mudancas: { oculto: true } }),
    );
    expect(t.snapshotPara).toEqual([]);
    const apaga = aplicar(e, "m", intencao("token.apagar", { id: "t1" }));
    expect(apaga.estado.luzes.map((l) => l.id)).not.toContain("do-t1");
    expect(apaga.eventos.map((x) => x.tipo)).toContain("fonte.apagada");
  });
  it("só o mestre mexe nas fontes", () => {
    expect(codigo(e, "j1", intencao("fonte.apagar", { id: "fixa" }))).toBe("sem_permissao");
    expect(codigo(e, "j1", intencao("config.iluminacao", { mudancas: {} }))).toBe("sem_permissao");
    expect(codigo(e, "j1", intencao("memoria.esquecer"))).toBe("sem_permissao");
  });
});

describe("intenções das fontes de luz", () => {
  const e = criarEstado();
  const nova = (id: string, extra: object = {}) =>
    intencao("fonte.criar", {
      fonte: {
        id,
        nome: "Tocha",
        portador: { tipo: "cena", x: 50, y: -3 },
        luz: { claraM: 6, penumbraM: 6, cor: "#ffffff", tremula: true },
        intensidade: 1,
        acesa: true,
        ...extra,
      },
    });
  it("cria na cena ativa, com o ponto limitado à cena", () => {
    const r = aplicar(e, "m", nova("n1"));
    const criada = r.estado.luzes.find((l) => l.id === "n1");
    expect(criada).toMatchObject({ cenaId: "c1", portador: { tipo: "cena", x: 30, y: 0 } });
  });
  it("recusa id repetido, cena e token inexistentes", () => {
    expect(codigo(e, "m", nova("fixa"))).toBe("dados_invalidos");
    expect(codigo(e, "m", intencao("fonte.criar", { cenaId: "x", fonte: fonte("z") }))).toBe(
      "cena_inexistente",
    );
    expect(codigo(e, "m", nova("n2", { portador: { tipo: "token", tokenId: "nao" } }))).toBe(
      "token_inexistente",
    );
  });
  it("edita raios, cor, tremular, intensidade e move a luz fixa", () => {
    const r = aplicar(
      e,
      "m",
      intencao("fonte.editar", {
        id: "fixa",
        mudancas: {
          luz: { claraM: 9, cor: "#ff0000", tremula: true },
          intensidade: 0.4,
          portador: { tipo: "cena", x: 3, y: 4 },
        },
      }),
    );
    const f = r.estado.luzes.find((l) => l.id === "fixa");
    expect(f?.luz).toEqual({ claraM: 9, penumbraM: 6, cor: "#ff0000", tremula: true });
    expect(f?.intensidade).toBe(0.4);
    expect(f?.portador).toEqual({ tipo: "cena", x: 3, y: 4 });
  });
  it("editar sem mudar nada não emite evento; fonte inexistente é recusada", () => {
    expect(aplicar(e, "m", intencao("fonte.editar", { id: "fixa", mudancas: {} })).eventos).toEqual(
      [],
    );
    expect(codigo(e, "m", intencao("fonte.editar", { id: "x", mudancas: {} }))).toBe(
      "fonte_inexistente",
    );
    expect(codigo(e, "m", intencao("fonte.apagar", { id: "x" }))).toBe("fonte_inexistente");
  });
  it("apaga", () => {
    const r = aplicar(e, "m", intencao("fonte.apagar", { id: "fixa" }));
    expect(r.estado.luzes.some((l) => l.id === "fixa")).toBe(false);
  });
  it("o fator geral e a luz ambiente da cena entram em cena.configurarIluminacao", () => {
    const r = aplicar(
      e,
      "m",
      intencao("cena.configurarIluminacao", { luzAmbiente: 0.2, fatorDeLuz: 0.5 }),
    );
    expect(r.estado.cenas[0]).toMatchObject({ luzAmbiente: 0.2, fatorDeLuz: 0.5 });
    // não mexe na iluminação dinâmica nem no que não veio
    expect(r.estado.cenas[0]?.iluminacaoDinamica).toBeUndefined();
    expect(
      IntencaoSchema.safeParse({
        v: 1,
        id: "x",
        tipo: "cena.configurarIluminacao",
        dados: { luzAmbiente: 2 },
      }).success,
    ).toBe(false);
    // mesmo valor: nenhum evento
    expect(
      aplicar(e, "m", intencao("cena.configurarIluminacao", { luzAmbiente: 1, fatorDeLuz: 1 }))
        .eventos,
    ).toEqual([]);
  });
  it("duplicar a cena leva as luzes fixas; apagar a cena apaga as dela", () => {
    const dup = aplicar(e, "m", intencao("cena.duplicar", { cenaId: "c1", novoId: "c3" }));
    expect(dup.estado.luzes.filter((l) => l.cenaId === "c3").length).toBeGreaterThan(0);
    const apaga = aplicar(e, "m", intencao("cena.apagar", { cenaId: "c2" }));
    expect(apaga.estado.luzes.some((l) => l.cenaId === "c2")).toBe(false);
  });
  it("a luz presa a um token muda de cena com o grupo", () => {
    const com = {
      ...e,
      personagens: [
        {
          id: "p1",
          pastaId: "pasta-personagens",
          editores: { tipo: "jogadores" as const, ids: ["j1"] },
          nome: "Aldric",
          tokenPadrao: { cor: "#0f0", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 0 },
          ficha: { pvAtual: 1, pvMax: 1 },
        },
      ],
      tokens: e.tokens.map((t) => (t.id === "t1" ? { ...t, personagemId: "p1" } : t)),
    };
    const r = aplicar(com, "m", intencao("grupo.moverPara", { cenaId: "c2" }));
    expect(r.estado.luzes.find((l) => l.id === "do-t1")?.cenaId).toBe("c2");
    expect(r.estado.luzes.find((l) => l.id === "fixa")?.cenaId).toBe("c1");
  });
});

describe("configuração da mesa e esquecer a memória", () => {
  const e = criarEstado();
  it("a configuração nasce com o padrão (memória ligada, 15 m + 3 m por modificador)", () => {
    expect(e.config).toEqual(CONFIG_PADRAO);
    expect(e.config.iluminacao).toMatchObject({
      memoriaLigada: true,
      memoriaModo: "inteligencia",
      memoriaBaseM: 15,
      memoriaPorModM: 3,
    });
  });
  it("o mestre muda só o que vem; todos recebem o evento", () => {
    const r = aplicar(
      e,
      "m",
      intencao("config.iluminacao", { mudancas: { memoriaLigada: false, memoriaFixaM: 20 } }),
    );
    expect(r.estado.config.iluminacao).toMatchObject({
      memoriaLigada: false,
      memoriaFixaM: 20,
      memoriaBaseM: 15,
    });
    expect(eventoPara(r.eventos[0] as EventoSala, JOGADOR, e, r.estado)?.tipo).toBe(
      "config.alterada",
    );
    expect(visaoPara(r.estado, JOGADOR).config.iluminacao.memoriaLigada).toBe(false);
    expect(
      aplicar(e, "m", intencao("config.iluminacao", { mudancas: { memoriaBaseM: 15 } })).eventos,
    ).toEqual([]);
  });
  it("esquecer a memória grava o seq do evento e chega à cena ativa; a outra cena não chega ao jogador", () => {
    const r = aplicar(e, "m", intencao("memoria.esquecer"));
    expect(r.estado.memoriaEsquecida?.c1).toBe(r.estado.seq);
    expect(eventoPara(r.eventos[0] as EventoSala, JOGADOR, e, r.estado)?.tipo).toBe(
      "memoria.esquecida",
    );
    const outra = aplicar(e, "m", intencao("memoria.esquecer", { cenaId: "c2" }));
    expect(eventoPara(outra.eventos[0] as EventoSala, JOGADOR, e, outra.estado)).toBeNull();
    expect(visaoPara(outra.estado, JOGADOR).memoriaEsquecida).toBeUndefined();
    expect(visaoPara(r.estado, JOGADOR).memoriaEsquecida).toEqual({ c1: r.estado.seq });
    // o cliente aplica o mesmo evento e chega ao mesmo estado
    expect(reduzir(e, r.eventos[0] as EventoSala).memoriaEsquecida).toEqual({ c1: r.estado.seq });
  });
});

describe("exportação v7", () => {
  it("leva as fontes, a configuração, a luz ambiente e o fator da cena, e volta igual", () => {
    let e = criarEstado();
    e = aplicar(
      e,
      "m",
      intencao("cena.configurarIluminacao", { luzAmbiente: 0.1, fatorDeLuz: 0.8 }),
    ).estado;
    e = aplicar(e, "m", intencao("config.iluminacao", { mudancas: { memoriaBaseM: 20 } })).estado;
    e = aplicar(e, "m", intencao("memoria.esquecer")).estado;
    const x = criarExportacao(e, AGORA);
    expect(x.versao).toBe(7);
    expect(VERSAO_EXPORTACAO).toBe(7);
    expect(x.dados.luzes).toEqual(e.luzes);
    expect(x.dados.config.iluminacao.memoriaBaseM).toBe(20);
    // a memória esquecida é da sessão, não da campanha
    expect("memoriaEsquecida" in x.dados).toBe(false);
    const volta = lerExportacao(JSON.parse(JSON.stringify(x)));
    expect(volta.ok).toBe(true);
    if (!volta.ok) return;
    expect(volta.exportacao.dados.luzes).toEqual(e.luzes);
    expect(volta.exportacao.dados.cenas[0]).toMatchObject({ luzAmbiente: 0.1, fatorDeLuz: 0.8 });
  });
  it("importa de v1 a v6 como v7, com luzes vazias e a configuração padrão", () => {
    const e = criarEstado();
    const v7 = criarExportacao(e, AGORA);
    const { luzes: _l, config: _c, ...semLuz } = v7.dados;
    const v6 = { ...v7, versao: 6, dados: semLuz };
    const l6 = lerExportacao(v6);
    expect(l6.ok && l6.exportacao.versao).toBe(7);
    expect(l6.ok && l6.exportacao.dados.luzes).toEqual([]);
    expect(l6.ok && l6.exportacao.dados.config).toEqual(CONFIG_PADRAO);
    const v5 = { ...v6, versao: 5 };
    const { paredes: _p, ...semParedes } = semLuz;
    expect(lerExportacao({ ...v5, dados: semParedes }).ok).toBe(true);
    // v1: sem cenas nem tokens
    const { cenas: _c1, cenaAtivaId: _a, tokens: _t, ...v1dados } = semParedes;
    const { assets: _as, personagens: _pe, pastas: _pa, ordemDeTurnoVisivel: _o, ...v1 } = v1dados;
    const l1 = lerExportacao({ ...v7, versao: 1, dados: v1 });
    expect(l1.ok && l1.exportacao.versao).toBe(7);
    expect(l1.ok && l1.exportacao.dados.config).toEqual(CONFIG_PADRAO);
    // v2, v3, v4
    for (const versao of [2, 3, 4]) {
      const { pastas: _x, ordemDeTurnoVisivel: _y, personagens: _z, ...resto } = semParedes;
      const dados =
        versao === 2
          ? (({ assets: _w, ...r2 }) => r2)(resto)
          : versao === 3
            ? resto
            : { ...resto, personagens: [] };
      const l = lerExportacao({ ...v7, versao, dados });
      expect(l.ok, `v${versao}`).toBe(true);
      expect(l.ok && l.exportacao.dados.luzes).toEqual([]);
    }
  });
  it("recusa fonte em cena ou token inexistente e ids repetidos", () => {
    const e = criarEstado();
    const base = criarExportacao(e, AGORA);
    const com = (luzes: FonteDeLuz[]) =>
      lerExportacao({ ...base, dados: { ...base.dados, luzes } });
    expect(com([fonte("a", { cenaId: "nao" })]).ok).toBe(false);
    expect(com([fonte("a", { portador: { tipo: "token", tokenId: "nao" } })]).ok).toBe(false);
    expect(com([fonte("a"), fonte("a")]).ok).toBe(false);
    expect(com([fonte("a")]).ok).toBe(true);
  });
});
