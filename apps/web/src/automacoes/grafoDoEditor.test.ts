import {
  ALTURA_DA_PECA,
  ALTURA_DO_MAIS,
  ALTURA_DO_ROTULO,
  type Estado,
  type Fluxo,
  FluxoSchema,
  idDoBotaoDeEvento,
  MARGEM_DA_CAIXA,
  organizarGrafo,
  VAO_DA_CAIXA,
} from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import {
  alturaDoNo,
  caminhoDoFio,
  errosDoFluxo,
  fluxoNovo,
  LARGURA_DO_NO,
  limitesDosNos,
  PECAS,
  pontoDaPorta,
} from "./blocos";
import { botoesDaMesaDeEventos } from "./eventosDaMesa";

// AU2: a geometria da grade, os erros por nó e o que a mesa de eventos mostra a cada um.

const botao = (id: string, nome: string, extra: object = {}): Fluxo =>
  FluxoSchema.parse({
    id,
    nome: `Auto ${nome}`,
    nos: [
      { id: "g", tipo: "gatilho", x: 0, y: 0, config: { tipo: "botao", nome, ...extra } },
      {
        id: "a",
        tipo: "acao",
        x: 300,
        y: 0,
        config: { acao: { acao: "chat.anunciar", texto: "oi" } },
      },
    ],
    fios: [{ de: { no: "g", saida: "saida" }, para: { no: "a", entrada: "entrada" } }],
  });

const estadoCom = (fluxos: Fluxo[], botoes?: Estado["botoes"]): Estado =>
  ({
    cenas: [{ id: "c", nome: "C" }],
    modelos: [],
    assets: [],
    zonas: [],
    automacoes: { fluxos, execucao: {}, esperando: [], ultimaVez: {}, registro: [] },
    ...(botoes ? { botoes } : {}),
  }) as unknown as Estado;

const PEDEM_PREENCHER = new Set([
  "dentroDaZona",
  "estaNaCena",
  "zonaLigada",
  "zonaLigar",
  "som",
  "chat",
]);

describe("a geometria da grade", () => {
  it("a peça guardada numa caixa tem a altura que a caixa conta para ela (o pé da caixa não vaza)", () => {
    const nos = FluxoSchema.parse({
      id: "f",
      nome: "OU de quatro",
      nos: [
        { id: "c", tipo: "caixa", x: 0, y: 0, config: { porta: "ou", espacos: 4 } },
        ...[0, 1, 2, 3].map((i) => ({
          id: `g${i}`,
          tipo: "gatilho",
          x: 0,
          y: 0,
          em: "c",
          espaco: i,
          config: { tipo: "relogio", cadaS: 60 },
        })),
        { id: "s", tipo: "se", x: 0, y: 0, em: "c", espaco: 3, config: {} },
      ].filter((n) => n.id !== "g3"),
      fios: [],
    }).nos;
    const caixa = nos.find((n) => n.id === "c");
    if (!caixa) throw new Error("sem caixa");
    // o desenho soma o que o alturaDoNo dá a cada espaço; tem de bater com a conta da caixa
    const pecas = nos.filter((n) => n.em === "c");
    for (const p of pecas) expect(alturaDoNo(p, nos)).toBe(ALTURA_DA_PECA);
    expect(alturaDoNo(caixa, nos)).toBe(
      MARGEM_DA_CAIXA * 2 +
        4 * ALTURA_DA_PECA +
        3 * (ALTURA_DO_ROTULO + 2 * VAO_DA_CAIXA) +
        VAO_DA_CAIXA +
        ALTURA_DO_MAIS,
    );
  });
  it("as portas ficam nas bordas e a altura cresce com duas saídas", () => {
    const f = fluxoNovo("x");
    const g = f.nos[0];
    if (!g) throw new Error("sem gatilho");
    expect(pontoDaPorta(g, "saida", "saida").x).toBe(g.x + LARGURA_DO_NO);
    expect(pontoDaPorta(g, "saida", "saida").y).toBe(g.y + alturaDoNo(g) / 2);
    const se = { id: "s", tipo: "se" as const, x: 10, y: 20, config: {} };
    expect(alturaDoNo(se)).toBeGreaterThan(alturaDoNo(g));
    const sim = pontoDaPorta(se, "saida", "sim");
    const nao = pontoDaPorta(se, "saida", "nao");
    expect(sim.y).toBeLessThan(nao.y);
    expect(pontoDaPorta(se, "entrada", "condicao").y).toBeGreaterThan(
      pontoDaPorta(se, "entrada", "entrada").y,
    );
  });

  it("o fio é uma curva que sai da esquerda e chega pela direita da entrada", () => {
    expect(caminhoDoFio(0, 0, 200, 100)).toMatch(/^M 0 0 C /);
  });

  it("os limites cobrem todos os nós (para enquadrar sem cortar na borda)", () => {
    const f = botao("b", "B");
    const l = limitesDosNos(f.nos);
    expect(l).toMatchObject({ x: 0, y: 0 });
    expect(l?.largura).toBe(300 + LARGURA_DO_NO);
    expect(limitesDosNos([])).toBeNull();
  });

  it("Organizar não deixa dois nós no mesmo lugar", () => {
    const f = botao("b", "B");
    const nos = organizarGrafo({
      nos: [...f.nos, { ...f.nos[1], id: "b2" } as never],
      fios: f.fios,
    });
    expect(new Set(nos.map((n) => `${n.x},${n.y}`)).size).toBe(nos.length);
  });

  it("toda peça da paleta cria um nó que o schema aceita (com os campos que a pessoa ainda vai preencher)", () => {
    for (const peca of PECAS) {
      const no = { ...peca.criar(), id: "n", x: 0, y: 0 };
      const f = { id: "f", nome: "F", nos: [no], fios: [] };
      const r = FluxoSchema.safeParse(f);
      // estas nascem com um campo para a pessoa preencher (zona, cenas, texto ou som): o schema recusa até ela escolher
      if (PEDEM_PREENCHER.has(peca.id)) expect(r.success, peca.id).toBe(false);
      else expect(r.success, peca.id).toBe(true);
    }
  });
});

describe("os erros por nó", () => {
  it("o nome vazio é do nome; o bloco solto e a caixa vazia são do nó", () => {
    const f: Fluxo = {
      ...fluxoNovo("x"),
      nos: [
        { id: "n1", tipo: "gatilho", x: 0, y: 0, config: { tipo: "botao", nome: "B" } },
        { id: "n2", tipo: "caixa", x: 0, y: 0, config: { porta: "e" } },
        { id: "n3", tipo: "esperar", x: 0, y: 0, config: { s: 5 } },
      ],
    };
    const e = errosDoFluxo(f, estadoCom([]));
    expect(e.some((x) => x.onde === "nome")).toBe(true);
    expect(e.find((x) => x.onde === "n2")?.texto).toContain("vazia");
    expect(e.find((x) => x.onde === "n3")?.texto).toContain("nenhum gatilho");
  });

  it("um fluxo certo não tem erro", () => {
    const f = botao("b", "B");
    expect(errosDoFluxo(f, estadoCom([f]))).toEqual([]);
  });
});

describe("a mesa de eventos", () => {
  it("o mestre vê as automações de botão (o relógio não), com cor e ícone padrão ou escolhidos", () => {
    const a = botao("a", "Trovão", { cor: "azul", icone: "trovao" });
    const b = botao("b", "Sino");
    const rel = FluxoSchema.parse({
      id: "r",
      nome: "Relógio",
      nos: [{ id: "g", tipo: "gatilho", x: 0, y: 0, config: { tipo: "relogio", cadaS: 60 } }],
      fios: [],
    });
    const desligada = { ...b, id: "d", ligado: false };
    const rascunho = { ...botao("z", "Z"), rascunho: true };
    const lista = botoesDaMesaDeEventos(estadoCom([a, b, rel, desligada, rascunho]), true);
    expect(lista.map((x) => x.fluxoId)).toEqual(["a", "b", "d"]);
    expect(lista[0]).toMatchObject({
      botaoId: idDoBotaoDeEvento("a"),
      nome: "Trovão",
      cor: "azul",
      icone: "trovao",
      ligada: true,
    });
    expect(lista[1]).toMatchObject({ cor: "ambar", icone: "chama" });
    expect(lista[2]?.ligada).toBe(false);
  });

  it("o jogador vê só os botões que a sala lhe mandou, sem a definição", () => {
    const lista = botoesDaMesaDeEventos(
      estadoCom([], [
        { id: "evento:soprar", tipo: "evento", nome: "Soprar", rotulo: "Sopro", cor: "verde" },
        { id: "ciclo:resp", tipo: "ciclo", nome: "Respiração", pausado: false },
      ] as never),
      false,
    );
    expect(lista).toEqual([
      {
        botaoId: "evento:soprar",
        fluxoId: "soprar",
        nome: "Sopro",
        cor: "verde",
        icone: "chama",
        ligada: true,
      },
    ]);
  });
});
