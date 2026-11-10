import { describe, expect, it } from "vitest";
import {
  CAPACIDADES_DELEGAVEIS,
  caixaDoDesenho,
  criarExportacao,
  type Desenho,
  desenhoTocadoEm,
  desenhoVisivelPara,
  deslocamentoNaCena,
  type Estado,
  estadoInicial,
  eventoPara,
  type Intencao,
  IntencaoSchema,
  LIMITES_DO_DESENHO,
  lerExportacao,
  PERMISSOES_PADRAO,
  pode,
  prepararTraco,
  processar,
  rascunhoDentroDoLimite,
  simplificarTraco,
  VERSAO_EXPORTACAO,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object = {}): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });
}

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
      { id: "a", nome: "Assistente", papel: "assistente", cor: "#555" },
    ],
  });
}

function aplicar(estado: Estado, quem: string, tipo: Intencao["tipo"], dados: object = {}) {
  const r = processar(estado, quem, intencao(tipo, dados), AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} ${r.erro.mensagem}`);
  return r;
}

function recusa(estado: Estado, quem: string, tipo: Intencao["tipo"], dados: object = {}) {
  const r = processar(estado, quem, intencao(tipo, dados), AGORA);
  return r.ok ? null : r.erro.codigo;
}

const traco = {
  forma: "livre" as const,
  pontos: [
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ],
  cor: "#e6194b",
  espessura: 4,
};

/** Cria um desenho e devolve o novo estado. */
function desenhar(estado: Estado, quem: string, id: string, extra: object = {}): Estado {
  return aplicar(estado, quem, "desenho.criar", { desenho: { id, ...traco, ...extra } }).estado;
}

/** Estado com duas cenas (a ativa é `cena-1`). */
function comDuasCenas(): Estado {
  return aplicar(criarEstado(), "m", "cena.criar", { id: "cena-2", nome: "Porão" }).estado;
}

describe("simplificação do traço (Douglas–Peucker)", () => {
  it("uma reta com ruído mínimo vira dois pontos", () => {
    const reta = Array.from({ length: 50 }, (_, i) => ({ x: i * 0.1, y: i % 2 === 0 ? 0 : 0.01 }));
    const r = simplificarTraco(reta, 0.05);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual(reta[0]);
    expect(r[1]).toEqual(reta[49]);
  });

  it("guarda a curva: um 'L' mantém o canto", () => {
    const l = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ];
    expect(simplificarTraco(l, 0.05)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]);
  });

  it("com tolerância 0 mantém tudo o que não é colinear; 1 ou 2 pontos voltam como estão", () => {
    expect(simplificarTraco([{ x: 1, y: 1 }], 1)).toEqual([{ x: 1, y: 1 }]);
    expect(
      simplificarTraco(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        1,
      ),
    ).toHaveLength(2);
    const zig = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
      { x: 3, y: 1 },
    ];
    expect(simplificarTraco(zig, 0)).toEqual(zig);
  });

  it("aguenta dezenas de milhares de pontos sem estourar a pilha", () => {
    const longo = Array.from({ length: 50_000 }, (_, i) => ({ x: i * 0.01, y: Math.sin(i / 50) }));
    expect(simplificarTraco(longo, 0.001).length).toBeGreaterThan(2);
  });

  it("prepararTraco: nunca passa do limite de 2000 pontos e arredonda ao centímetro", () => {
    const ruidoso = Array.from({ length: 6000 }, (_, i) => ({
      x: i * 0.013 + 0.0004,
      y: Math.sin(i / 3) * 3,
    }));
    const r = prepararTraco(ruidoso);
    expect(r.length).toBeLessThanOrEqual(LIMITES_DO_DESENHO.pontos);
    expect(r.length).toBeGreaterThan(10);
    for (const p of r) expect(Math.round(p.x * 100) / 100).toBe(p.x);
  });

  it("prepararTraco: pontos repetidos viram um (um toque é um pingo)", () => {
    expect(
      prepararTraco([
        { x: 3, y: 3 },
        { x: 3.001, y: 3 },
        { x: 3, y: 3.002 },
      ]),
    ).toEqual([{ x: 3, y: 3 }]);
  });
});

describe("geometria", () => {
  const retangulo = (preenchido?: boolean) => ({
    forma: "retangulo" as const,
    pontos: [
      { x: 2, y: 2 },
      { x: 6, y: 5 },
    ],
    ...(preenchido ? { preenchido } : {}),
  });

  it("toque: linha, traço livre e pingo", () => {
    const linha = {
      forma: "linha" as const,
      pontos: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    expect(desenhoTocadoEm(linha, { x: 5, y: 0.2 }, 0.3)).toBe(true);
    expect(desenhoTocadoEm(linha, { x: 5, y: 1 }, 0.3)).toBe(false);
    expect(
      desenhoTocadoEm({ forma: "livre", pontos: [{ x: 1, y: 1 }] }, { x: 1.1, y: 1 }, 0.3),
    ).toBe(true);
    expect(
      desenhoTocadoEm(
        {
          forma: "livre",
          pontos: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
          ],
        },
        { x: 4.1, y: 2 },
        0.3,
      ),
    ).toBe(true);
  });

  it("retângulo vazado só toca a borda; preenchido toca por dentro", () => {
    expect(desenhoTocadoEm(retangulo(), { x: 4, y: 3.5 }, 0.3)).toBe(false);
    expect(desenhoTocadoEm(retangulo(), { x: 4, y: 2.1 }, 0.3)).toBe(true);
    expect(desenhoTocadoEm(retangulo(true), { x: 4, y: 3.5 }, 0.3)).toBe(true);
    expect(desenhoTocadoEm(retangulo(true), { x: 9, y: 3.5 }, 0.3)).toBe(false);
  });

  it("círculo: o raio é a distância entre os dois pontos", () => {
    const circulo = (preenchido?: boolean) => ({
      forma: "circulo" as const,
      pontos: [
        { x: 10, y: 10 },
        { x: 13, y: 10 },
      ],
      ...(preenchido ? { preenchido } : {}),
    });
    expect(desenhoTocadoEm(circulo(), { x: 10, y: 10 }, 0.3)).toBe(false);
    expect(desenhoTocadoEm(circulo(), { x: 10, y: 13.1 }, 0.3)).toBe(true);
    expect(desenhoTocadoEm(circulo(true), { x: 10, y: 10 }, 0.3)).toBe(true);
    expect(caixaDoDesenho(circulo())).toEqual({ x0: 7, y0: 7, x1: 13, y1: 13 });
  });

  it("o deslocamento é limitado para o desenho ficar na cena", () => {
    const cena = { larguraM: 20, alturaM: 10 };
    const d = retangulo();
    expect(deslocamentoNaCena(d, cena, 100, 100)).toEqual({ dx: 14, dy: 5 });
    expect(deslocamentoNaCena(d, cena, -100, -100)).toEqual({ dx: -2, dy: -2 });
    expect(deslocamentoNaCena(d, cena, 1, 1)).toEqual({ dx: 1, dy: 1 });
  });
});

describe("limite de frequência do rascunho", () => {
  it("passa o primeiro e os que respeitam o intervalo; descarta os apressados", () => {
    expect(rascunhoDentroDoLimite(undefined, 1000)).toBe(true);
    expect(rascunhoDentroDoLimite(1000, 1010)).toBe(false);
    expect(rascunhoDentroDoLimite(1000, 1030)).toBe(true);
  });
});

describe("capacidade desenho.criar", () => {
  it("é delegável e vem ligada por padrão; o jogador a perde quando o mestre desliga", () => {
    expect(CAPACIDADES_DELEGAVEIS).toContain("desenho.criar");
    expect(PERMISSOES_PADRAO["desenho.criar"]).toBe(true);
    const estado = criarEstado();
    const j1 = estado.usuarios.find((u) => u.id === "j1");
    if (!j1) throw new Error("sem j1");
    expect(pode(j1, "desenho.criar", estado.permissoes)).toBe(true);
    const desligado = aplicar(estado, "m", "permissao.alterar", {
      capacidade: "desenho.criar",
      valor: false,
    }).estado;
    expect(pode(j1, "desenho.criar", desligado.permissoes)).toBe(false);
  });

  it("sem a capacidade o jogador não desenha, não move, não apaga e não faz rascunho", () => {
    let estado = desenhar(criarEstado(), "j1", "d1");
    estado = aplicar(estado, "m", "permissao.alterar", {
      capacidade: "desenho.criar",
      valor: false,
    }).estado;
    expect(recusa(estado, "j1", "desenho.criar", { desenho: { id: "d2", ...traco } })).toBe(
      "sem_permissao",
    );
    expect(recusa(estado, "j1", "desenho.mover", { id: "d1", dx: 1, dy: 1 })).toBe("sem_permissao");
    expect(recusa(estado, "j1", "desenho.apagar", { ids: ["d1"] })).toBe("sem_permissao");
    expect(recusa(estado, "j1", "desenho.voltar")).toBe("sem_permissao");
    expect(recusa(estado, "j1", "desenho.rascunho", { id: "d3", desenho: { ...traco } })).toBe(
      "sem_permissao",
    );
    // a exceção por usuário devolve o pincel a quem o mestre quiser
    const excecao = aplicar(estado, "m", "permissao.alterar", {
      capacidade: "desenho.criar",
      valor: true,
      usuarioId: "j1",
    }).estado;
    expect(recusa(excecao, "j1", "desenho.criar", { desenho: { id: "d4", ...traco } })).toBeNull();
    expect(recusa(excecao, "j2", "desenho.criar", { desenho: { id: "d5", ...traco } })).toBe(
      "sem_permissao",
    );
  });

  it("o assistente não desenha", () => {
    expect(recusa(criarEstado(), "a", "desenho.criar", { desenho: { id: "x", ...traco } })).toBe(
      "sem_permissao",
    );
  });

  it("campanha antiga (permissões sem a capacidade nova) ganha o padrão ao carregar a exportação", () => {
    const x = JSON.parse(JSON.stringify(criarExportacao(criarEstado(), AGORA)));
    delete x.dados.permissoes.jogadores["desenho.criar"];
    const lida = lerExportacao(x);
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.dados.permissoes.jogadores["desenho.criar"]).toBe(true);
  });
});

describe("criar, mover, apagar, voltar e limpar", () => {
  it("o jogador desenha na cena ativa, com o autor dele; o evento leva o desenho completo", () => {
    const r = aplicar(criarEstado(), "j1", "desenho.criar", {
      desenho: { id: "d1", ...traco, cor: "#E6194B", autorId: "m" },
    });
    expect(r.eventos.map((e) => e.tipo)).toEqual(["desenho.criado"]);
    expect(r.estado.desenhos).toEqual([
      { id: "d1", cenaId: "cena-1", autorId: "j1", ...traco, cor: "#e6194b" },
    ]);
  });

  it("preenchido só vale para retângulo e círculo", () => {
    let e = desenhar(criarEstado(), "j1", "d1", { preenchido: true });
    e = desenhar(e, "j1", "d2", {
      forma: "retangulo",
      pontos: [
        { x: 1, y: 1 },
        { x: 3, y: 3 },
      ],
      preenchido: true,
    });
    expect(e.desenhos.find((d) => d.id === "d1")?.preenchido).toBeUndefined();
    expect(e.desenhos.find((d) => d.id === "d2")?.preenchido).toBe(true);
  });

  it("o jogador só desenha na cena ativa; o mestre, em qualquer uma", () => {
    const estado = comDuasCenas();
    expect(
      recusa(estado, "j1", "desenho.criar", { desenho: { id: "d1", ...traco, cenaId: "cena-2" } }),
    ).toBe("sem_permissao");
    const e = desenhar(estado, "m", "d2", { cenaId: "cena-2" });
    expect(e.desenhos[0]?.cenaId).toBe("cena-2");
    expect(
      recusa(estado, "m", "desenho.criar", {
        desenho: { id: "d3", ...traco, cenaId: "nao-existe" },
      }),
    ).toBe("cena_inexistente");
  });

  it("recusa id repetido, cor inválida, espessura fora da faixa e forma com pontos errados", () => {
    const estado = desenhar(criarEstado(), "j1", "d1");
    expect(recusa(estado, "j2", "desenho.criar", { desenho: { id: "d1", ...traco } })).toBe(
      "dados_invalidos",
    );
    const invalidas = [
      { cor: "vermelho" },
      { cor: "#fff" },
      { espessura: 0 },
      { espessura: 25 },
      { forma: "linha" }, // linha precisa de exatamente dois pontos
      { forma: "circulo", pontos: [{ x: 1, y: 1 }] },
      { pontos: [] },
      { pontos: [{ x: Number.NaN, y: 1 }] },
    ];
    for (const i of invalidas) {
      const lida = IntencaoSchema.safeParse({
        v: 1,
        id: "x",
        tipo: "desenho.criar",
        dados: {
          desenho: {
            id: "novo",
            ...traco,
            ...i,
            ...(i.forma === "linha" ? { pontos: [...traco.pontos, { x: 3, y: 3 }] } : {}),
          },
        },
      });
      expect(lida.success, JSON.stringify(i)).toBe(false);
    }
  });

  it("limite de pontos por desenho (2000)", () => {
    const pontos = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i * 0.01, y: 1 }));
    const lida = (n: number) =>
      IntencaoSchema.safeParse({
        v: 1,
        id: "x",
        tipo: "desenho.criar",
        dados: { desenho: { id: "novo", ...traco, pontos: pontos(n) } },
      }).success;
    expect(lida(2000)).toBe(true);
    expect(lida(2001)).toBe(false);
  });

  it("limite de 1000 desenhos por cena (a outra cena não conta)", () => {
    let estado = comDuasCenas();
    const desenhos: Desenho[] = Array.from({ length: LIMITES_DO_DESENHO.porCena }, (_, i) => ({
      id: `n${i}`,
      cenaId: "cena-1",
      autorId: "j1",
      ...traco,
    }));
    estado = { ...estado, desenhos };
    expect(recusa(estado, "j2", "desenho.criar", { desenho: { id: "mais", ...traco } })).toBe(
      "limite_de_desenhos",
    );
    expect(
      recusa(estado, "m", "desenho.criar", {
        desenho: { id: "outra", ...traco, cenaId: "cena-2" },
      }),
    ).toBeNull();
  });

  it("pontos fora da cena são trazidos para dentro", () => {
    const e = desenhar(criarEstado(), "j1", "d1", {
      pontos: [
        { x: -5, y: 1 },
        { x: 9999, y: 9999 },
      ],
    });
    expect(e.desenhos[0]?.pontos).toEqual([
      { x: 0, y: 1 },
      { x: 60, y: 45 },
    ]);
  });

  it("mover: o jogador só move o próprio; o mestre move todos; o desenho fica dentro da cena", () => {
    let estado = desenhar(criarEstado(), "j1", "meu");
    estado = desenhar(estado, "m", "do-mestre");
    expect(recusa(estado, "j2", "desenho.mover", { id: "meu", dx: 1, dy: 1 })).toBe(
      "sem_permissao",
    );
    expect(recusa(estado, "j1", "desenho.mover", { id: "do-mestre", dx: 1, dy: 1 })).toBe(
      "sem_permissao",
    );
    expect(recusa(estado, "j1", "desenho.mover", { id: "nada", dx: 1, dy: 1 })).toBe(
      "desenho_inexistente",
    );
    const r = aplicar(estado, "j1", "desenho.mover", { id: "meu", dx: 3, dy: -0.5 });
    expect(r.eventos.map((e) => e.tipo)).toEqual(["desenho.movido"]);
    expect(r.estado.desenhos.find((d) => d.id === "meu")?.pontos).toEqual([
      { x: 4, y: 0.5 },
      { x: 5, y: 1.5 },
    ]);
    const mestre = aplicar(r.estado, "m", "desenho.mover", { id: "meu", dx: -999, dy: 0 });
    expect(mestre.estado.desenhos.find((d) => d.id === "meu")?.pontos[0]?.x).toBe(0);
    // empurrar para fora não muda nada e não gera evento
    expect(
      aplicar(mestre.estado, "m", "desenho.mover", { id: "meu", dx: -5, dy: 0 }).eventos,
    ).toEqual([]);
  });

  it("apagar: o jogador só os próprios; um sozinho de fora recusa o pedido inteiro; o mestre apaga todos", () => {
    let estado = desenhar(criarEstado(), "j1", "a");
    estado = desenhar(estado, "j1", "b");
    estado = desenhar(estado, "m", "c");
    estado = desenhar(estado, "j2", "d");
    expect(recusa(estado, "j1", "desenho.apagar", { ids: ["a", "c"] })).toBe("sem_permissao");
    expect(recusa(estado, "j1", "desenho.apagar", { ids: ["d"] })).toBe("sem_permissao");
    const um = aplicar(estado, "j1", "desenho.apagar", { ids: ["a", "b"] });
    expect(um.eventos.map((e) => e.tipo)).toEqual(["desenho.apagado", "desenho.apagado"]);
    expect(um.estado.desenhos.map((d) => d.id)).toEqual(["c", "d"]);
    const tudo = aplicar(estado, "m", "desenho.apagar", { ids: ["a", "c", "d", "a"] });
    expect(tudo.estado.desenhos.map((d) => d.id)).toEqual(["b"]);
    // um id que já sumiu (apagado ao mesmo tempo por outra pessoa) não é erro
    expect(aplicar(estado, "j1", "desenho.apagar", { ids: ["fantasma"] }).eventos).toEqual([]);
  });

  it("voltar apaga só o meu desenho mais recente da cena", () => {
    let estado = comDuasCenas();
    estado = desenhar(estado, "j1", "a");
    estado = desenhar(estado, "j2", "b");
    estado = desenhar(estado, "j1", "c");
    estado = desenhar(estado, "m", "x", { cenaId: "cena-2" });
    estado = desenhar(estado, "j1", "d");
    estado = aplicar(estado, "j1", "desenho.voltar").estado;
    expect(estado.desenhos.map((d) => d.id)).toEqual(["a", "b", "c", "x"]);
    estado = aplicar(estado, "j1", "desenho.voltar").estado;
    estado = aplicar(estado, "j1", "desenho.voltar").estado;
    expect(estado.desenhos.map((d) => d.id)).toEqual(["b", "x"]);
    // sem nada meu: não apaga o dos outros e não dá erro
    const vazio = aplicar(estado, "j1", "desenho.voltar");
    expect(vazio.eventos).toEqual([]);
    expect(vazio.estado.desenhos).toHaveLength(2);
    // o mestre volta na cena que ele escolhe
    const doMestre = aplicar(estado, "m", "desenho.voltar", { cenaId: "cena-2" });
    expect(doMestre.estado.desenhos.map((d) => d.id)).toEqual(["b"]);
  });

  it("limpar é só do mestre e só da cena pedida", () => {
    let estado = comDuasCenas();
    estado = desenhar(estado, "j1", "a");
    estado = desenhar(estado, "m", "b", { cenaId: "cena-2" });
    expect(recusa(estado, "j1", "desenho.limpar")).toBe("sem_permissao");
    const r = aplicar(estado, "m", "desenho.limpar");
    expect(r.eventos.map((e) => e.tipo)).toEqual(["desenho.limpo"]);
    expect(r.estado.desenhos.map((d) => d.id)).toEqual(["b"]);
    expect(aplicar(r.estado, "m", "desenho.limpar").eventos).toEqual([]);
    const outra = aplicar(estado, "m", "desenho.limpar", { cenaId: "cena-2" });
    expect(outra.estado.desenhos.map((d) => d.id)).toEqual(["a"]);
  });

  it("o rascunho só é repassado: não muda o estado nem gera evento", () => {
    const estado = criarEstado();
    const r = aplicar(estado, "j1", "desenho.rascunho", { id: "r1", desenho: { ...traco } });
    expect(r.eventos).toEqual([]);
    expect(r.estado).toBe(estado);
    expect(r.rascunho).toMatchObject({ desenho: { id: "r1", autorId: "j1", cenaId: "cena-1" } });
    const fim = aplicar(estado, "j1", "desenho.rascunho", { id: "r1", desenho: null });
    expect(fim.rascunho).toEqual({ fimId: "r1" });
    expect(
      recusa(comDuasCenas(), "j1", "desenho.rascunho", {
        id: "r2",
        desenho: { ...traco, cenaId: "cena-2" },
      }),
    ).toBe("sem_permissao");
  });
});

describe("sigilo: quem recebe os desenhos", () => {
  it("a regra: o mestre recebe todos; o jogador, os da cena ativa", () => {
    expect(desenhoVisivelPara("c2", { id: "m", papel: "mestre" }, "c1")).toBe(true);
    expect(desenhoVisivelPara("c2", { id: "j", papel: "jogador" }, "c1")).toBe(false);
    expect(desenhoVisivelPara("c1", { id: "j", papel: "jogador" }, "c1")).toBe(true);
  });

  it("o snapshot do jogador só traz os desenhos da cena ativa; o do mestre traz todos", () => {
    let estado = comDuasCenas();
    estado = desenhar(estado, "j1", "a");
    estado = desenhar(estado, "m", "b", { cenaId: "cena-2" });
    expect(visaoPara(estado, { id: "j2", papel: "jogador" }).desenhos.map((d) => d.id)).toEqual([
      "a",
    ]);
    expect(visaoPara(estado, { id: "m", papel: "mestre" }).desenhos.map((d) => d.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("o evento de um desenho de outra cena nunca chega ao jogador (criar, mover, apagar, limpar)", () => {
    const base = comDuasCenas();
    const mestre = { id: "m", papel: "mestre" as const };
    const jogador = { id: "j1", papel: "jogador" as const };
    const criado = aplicar(base, "m", "desenho.criar", {
      desenho: { id: "x", ...traco, cenaId: "cena-2" },
    });
    const ev = criado.eventos[0];
    if (!ev) throw new Error("sem evento");
    expect(eventoPara(ev, jogador, base, criado.estado)).toBeNull();
    expect(eventoPara(ev, mestre, base, criado.estado)).toEqual(ev);

    const movido = aplicar(criado.estado, "m", "desenho.mover", { id: "x", dx: 1, dy: 1 });
    const evMovido = movido.eventos[0];
    if (!evMovido) throw new Error("sem evento");
    expect(eventoPara(evMovido, jogador, criado.estado, movido.estado)).toBeNull();

    const apagado = aplicar(movido.estado, "m", "desenho.apagar", { ids: ["x"] });
    const evApagado = apagado.eventos[0];
    if (!evApagado) throw new Error("sem evento");
    expect(eventoPara(evApagado, jogador, movido.estado, apagado.estado)).toBeNull();

    const limpo = aplicar(criado.estado, "m", "desenho.limpar", { cenaId: "cena-2" });
    const evLimpo = limpo.eventos[0];
    if (!evLimpo) throw new Error("sem evento");
    expect(eventoPara(evLimpo, jogador, criado.estado, limpo.estado)).toBeNull();
  });

  it("o evento da cena ativa chega ao jogador", () => {
    const base = criarEstado();
    const jogador = { id: "j2", papel: "jogador" as const };
    const r = aplicar(base, "j1", "desenho.criar", { desenho: { id: "x", ...traco } });
    const ev = r.eventos[0];
    if (!ev) throw new Error("sem evento");
    expect(eventoPara(ev, jogador, base, r.estado)).toEqual(ev);
    const limpo = aplicar(r.estado, "m", "desenho.limpar");
    const evLimpo = limpo.eventos[0];
    if (!evLimpo) throw new Error("sem evento");
    expect(eventoPara(evLimpo, jogador, r.estado, limpo.estado)).toEqual(evLimpo);
  });

  it("o rascunho: a mesma regra decide quem o recebe (a sala usa desenhoVisivelPara com a cena dele)", () => {
    const estado = comDuasCenas();
    const r = aplicar(estado, "m", "desenho.rascunho", {
      id: "r1",
      desenho: { ...traco, cenaId: "cena-2" },
    });
    if (!r.rascunho || !("desenho" in r.rascunho)) throw new Error("sem rascunho");
    const { cenaId } = r.rascunho.desenho;
    expect(cenaId).toBe("cena-2");
    expect(desenhoVisivelPara(cenaId, { id: "j1", papel: "jogador" }, estado.cenaAtivaId)).toBe(
      false,
    );
    expect(desenhoVisivelPara(cenaId, { id: "m", papel: "mestre" }, estado.cenaAtivaId)).toBe(true);
  });
});

describe("cenas: apagar e duplicar", () => {
  it("apagar a cena apaga os desenhos dela (e só os dela)", () => {
    let estado = comDuasCenas();
    estado = desenhar(estado, "j1", "a");
    estado = desenhar(estado, "m", "b", { cenaId: "cena-2" });
    const r = aplicar(estado, "m", "cena.apagar", { cenaId: "cena-2" });
    expect(r.estado.desenhos.map((d) => d.id)).toEqual(["a"]);
  });

  it("duplicar a cena duplica os desenhos, com ids novos e o mesmo autor", () => {
    let estado = comDuasCenas();
    estado = desenhar(estado, "m", "a", { cenaId: "cena-2" });
    estado = desenhar(estado, "j1", "b", { cenaId: undefined });
    estado = aplicar(estado, "m", "desenho.criar", {
      desenho: {
        id: "c",
        forma: "circulo",
        pontos: [
          { x: 5, y: 5 },
          { x: 7, y: 5 },
        ],
        cor: "#3cb44b",
        espessura: 8,
        preenchido: true,
        cenaId: "cena-2",
      },
    }).estado;
    const r = aplicar(estado, "m", "cena.duplicar", { cenaId: "cena-2", novoId: "cena-3" });
    const copias = r.estado.desenhos.filter((d) => d.cenaId === "cena-3");
    expect(copias).toHaveLength(2);
    expect(new Set(r.estado.desenhos.map((d) => d.id)).size).toBe(r.estado.desenhos.length);
    expect(copias.find((d) => d.forma === "circulo")).toMatchObject({
      autorId: "m",
      preenchido: true,
      pontos: [
        { x: 5, y: 5 },
        { x: 7, y: 5 },
      ],
    });
    // os originais continuam onde estavam
    expect(r.estado.desenhos.filter((d) => d.cenaId === "cena-2")).toHaveLength(2);
  });
});

describe("exportação v11", () => {
  it("os desenhos fazem a viagem de ida e volta", () => {
    let estado = desenhar(criarEstado(), "j1", "a");
    estado = desenhar(estado, "m", "b", {
      forma: "retangulo",
      pontos: [
        { x: 1, y: 1 },
        { x: 4, y: 3 },
      ],
      preenchido: true,
    });
    const x = criarExportacao(estado, AGORA);
    expect(x.versao).toBe(VERSAO_EXPORTACAO);
    expect(VERSAO_EXPORTACAO).toBe(12);
    const lida = lerExportacao(JSON.parse(JSON.stringify(x)));
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.dados.desenhos).toEqual(estado.desenhos);
    // importar leva os desenhos para o estado novo
    const importado = aplicar(criarEstado(), "m", "campanha.importar", { dados: x }).estado;
    expect(importado.desenhos).toEqual(estado.desenhos);
  });

  it("uma exportação v10 (sem desenhos) continua importando", () => {
    const x = JSON.parse(JSON.stringify(criarExportacao(criarEstado(), AGORA)));
    x.versao = 10;
    x.dados.desenhos = undefined;
    const lida = lerExportacao(x);
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.versao).toBe(12);
    expect(lida.exportacao.dados.desenhos).toEqual([]);
  });

  it("recusa desenho de cena ou de usuário desconhecidos, id repetido e desenhos demais", () => {
    const estado = desenhar(criarEstado(), "j1", "a");
    const x = JSON.parse(JSON.stringify(criarExportacao(estado, AGORA)));
    const com = (mudanca: (d: Desenho[]) => Desenho[]) => ({
      ...x,
      dados: { ...x.dados, desenhos: mudanca(x.dados.desenhos) },
    });
    expect(lerExportacao(com((d) => d.map((i) => ({ ...i, cenaId: "fantasma" })))).ok).toBe(false);
    expect(lerExportacao(com((d) => d.map((i) => ({ ...i, autorId: "fantasma" })))).ok).toBe(false);
    expect(lerExportacao(com((d) => [...d, ...d])).ok).toBe(false);
    const muitos = Array.from({ length: LIMITES_DO_DESENHO.porCena + 1 }, (_, i) => ({
      ...(estado.desenhos[0] as Desenho),
      id: `n${i}`,
    }));
    expect(lerExportacao(com(() => muitos)).ok).toBe(false);
  });
});
