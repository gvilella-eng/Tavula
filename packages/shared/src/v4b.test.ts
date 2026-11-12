import { describe, expect, it } from "vitest";
import darionArquivo from "../../../fixtures/fichas/darion.json";
import {
  type ArmaDoCompendio,
  aplicarEntradaNaFicha,
  aplicarOperacoes,
  apresentacaoDoPersonagem,
  ataqueDeArma,
  bonusDeAcerto,
  bonusDeProficiencia,
  bonusPorND,
  conjuracaoSemClasse,
  derivar,
  type EntradaDoCompendio,
  expressaoDeDano,
  type Ficha,
  FichaSchema,
  inserirNoGrupo,
  lerArquivoDeFicha,
  lerCompendio,
  lerEntradaArrastada,
  type MagiaDoCompendio,
  modeloDoItem,
  moverNoGrupo,
  PASTA_NPCS_ID,
  PASTA_PERSONAGENS_ID,
  type Personagem,
  posicoesDoGrupo,
  rolagemDaMagia,
  xpDoND,
} from "./index.ts";

const espada: ArmaDoCompendio = {
  nome: "Espada longa",
  categoria: "marcial",
  distancia: false,
  dano: "1d8",
  tipoDeDano: "Cortante",
  propriedades: ["versátil (1d10)"],
};
const adaga: ArmaDoCompendio = {
  nome: "Adaga",
  categoria: "simples",
  distancia: false,
  dano: "1d4",
  tipoDeDano: "Perfurante",
  propriedades: ["Acuidade", "leve", "arremesso (6/18 m)"],
};
const arco: ArmaDoCompendio = {
  nome: "Arco curto",
  categoria: "simples",
  distancia: true,
  dano: "1d6",
  tipoDeDano: "Perfurante",
  propriedades: ["munição", "duas mãos"],
  alcance: "24/96 m",
};

const magia = (nome: string, nivel: number, descricao: string): MagiaDoCompendio => ({
  nome,
  nivel,
  escola: "Evocação",
  tempo: "1 ação",
  alcance: "36 metros",
  componentes: "V, S",
  duracao: "Instantânea",
  concentracao: false,
  ritual: false,
  classes: ["Mago"],
  descricao,
});

const bolaDeFogo = magia(
  "Bola de Fogo",
  3,
  "Cada criatura na esfera deve realizar uma salvaguarda de Destreza. Um alvo sofre 8d6 de dano de fogo se falhar na salvaguarda, ou metade desse dano se passar.",
);
const raioDeFogo = magia(
  "Raio de Fogo",
  0,
  "Você faz um ataque de magia à distância contra uma criatura. Em um acerto, ela sofre 1d10 de dano de fogo.",
);
const luz = magia("Luz", 0, "O objeto tocado emite luz.");

const mago: Ficha = {
  pvAtual: 10,
  pvMax: 10,
  classes: [{ classe: "Mago", nivel: 5 }],
  atributos: { for: 8, des: 16, con: 12, int: 18, sab: 10, car: 10 },
};

describe("V4b: ND, proficiência e a regra de NPC", () => {
  it("o bônus de proficiência e o XP saem do nível de desafio", () => {
    expect(bonusPorND("0")).toBe(2);
    expect(bonusPorND("1/2")).toBe(2);
    expect(bonusPorND("4")).toBe(2);
    expect(bonusPorND("5")).toBe(3);
    expect(bonusPorND("9")).toBe(4);
    expect(bonusPorND("17")).toBe(6);
    expect(bonusPorND("30")).toBe(9);
    expect(bonusPorND("31")).toBeUndefined();
    expect(xpDoND("2")).toBe(450);
    expect(xpDoND("1/4")).toBe(50);
    expect(xpDoND(undefined)).toBeUndefined();
  });

  it("a ficha de monstro usa o ND; sem ND vale o nível das classes", () => {
    expect(bonusDeProficiencia({ pvAtual: 1, pvMax: 1, npc: { nd: "9" } })).toBe(4);
    expect(bonusDeProficiencia(mago)).toBe(3);
  });

  it("NPC é quem está na pasta NPCs ou não tem jogador; a escolha da ficha vale mais", () => {
    const base = { ficha: undefined };
    const semJogador: Personagem["editores"] = { tipo: "jogadores", ids: [] };
    const comJogador: Personagem["editores"] = { tipo: "jogadores", ids: ["j1"] };
    expect(
      apresentacaoDoPersonagem({ ...base, editores: semJogador, pastaId: PASTA_PERSONAGENS_ID }),
    ).toBe("npc");
    expect(
      apresentacaoDoPersonagem({ ...base, editores: comJogador, pastaId: PASTA_NPCS_ID }),
    ).toBe("npc");
    expect(
      apresentacaoDoPersonagem({ ...base, editores: comJogador, pastaId: PASTA_PERSONAGENS_ID }),
    ).toBe("personagem");
    expect(apresentacaoDoPersonagem({ ...base, editores: { tipo: "todos" }, pastaId: "x" })).toBe(
      "personagem",
    );
    expect(
      apresentacaoDoPersonagem({
        editores: semJogador,
        pastaId: PASTA_NPCS_ID,
        ficha: { pvAtual: 1, pvMax: 1, apresentacao: "personagem" },
      }),
    ).toBe("personagem");
    expect(
      apresentacaoDoPersonagem({
        editores: comJogador,
        pastaId: PASTA_PERSONAGENS_ID,
        ficha: { pvAtual: 1, pvMax: 1, apresentacao: "npc" },
      }),
    ).toBe("npc");
  });

  it("a ficha antiga de NPC (só PV, ataques e características) carrega igual, e exportar e importar guardam o bloco", () => {
    const antiga = {
      pvAtual: 59,
      pvMax: 59,
      ataques: [{ nome: "Clava", dano: "2d8", tipo: "Contundente" }],
      caracteristicas: [{ nome: "Rugido", descricao: "Assusta." }],
    };
    const lida = FichaSchema.parse(antiga);
    expect(lida).toEqual(antiga);
    expect(lida.npc).toBeUndefined();
    expect(FichaSchema.safeParse(darionArquivo.ficha).success).toBe(true);

    const completa: Ficha = {
      pvAtual: 59,
      pvMax: 59,
      apresentacao: "npc",
      npc: { tamanho: "Grande", tipo: "Gigante", pvFormula: "7d10 + 21", nd: "2" },
      ataques: [
        {
          nome: "Sopro",
          categoria: "acao",
          tipoDeAcao: "esp",
          recarga: 5,
          recarregado: false,
          usos: { max: 3, gastos: 1 },
        },
        { nome: "Cauda", categoria: "lendaria" },
      ],
    };
    const arquivo = { formato: "tabletop-ficha", versao: 2, nome: "Ogro", ficha: completa };
    const volta = lerArquivoDeFicha(JSON.parse(JSON.stringify(arquivo)));
    expect(volta.ok).toBe(true);
    if (volta.ok) expect(volta.arquivo.ficha).toEqual(completa);
  });
});

describe("V4b: ordem das listas", () => {
  const lista = ["a1", "r1", "a2", "r2", "a3"];
  const acoes = posicoesDoGrupo(lista, (x) => x.startsWith("a"));

  it("move dentro do grupo e deixa os de fora no lugar", () => {
    expect(acoes).toEqual([0, 2, 4]);
    expect(moverNoGrupo(lista, acoes, 0, 2)).toEqual(["a2", "r1", "a3", "r2", "a1"]);
    expect(moverNoGrupo(lista, acoes, 2, 0)).toEqual(["a3", "r1", "a1", "r2", "a2"]);
    expect(moverNoGrupo(lista, acoes, 1, 1)).toEqual(lista);
    expect(moverNoGrupo(lista, acoes, 1, 5)).toEqual(lista);
  });

  it("insere na posição do grupo, ou no fim dele", () => {
    expect(inserirNoGrupo(lista, acoes, "novo", 1)).toEqual(["a1", "r1", "novo", "a2", "r2", "a3"]);
    expect(inserirNoGrupo(lista, acoes, "novo", null)).toEqual([
      "a1",
      "r1",
      "a2",
      "r2",
      "a3",
      "novo",
    ]);
    const reacoes = posicoesDoGrupo(lista, (x) => x.startsWith("r"));
    expect(inserirNoGrupo(lista, reacoes, "novo", null)).toEqual([
      "a1",
      "r1",
      "a2",
      "r2",
      "novo",
      "a3",
    ]);
    expect(inserirNoGrupo(["x"], [], "novo", 0)).toEqual(["x", "novo"]);
  });

  it("a ordem nova entra na ficha numa operação só", () => {
    const f: Ficha = {
      pvAtual: 1,
      pvMax: 1,
      itens: [
        { nome: "A", quantidade: 1 },
        { nome: "B", quantidade: 1 },
        { nome: "C", quantidade: 1 },
      ],
    };
    const todos = posicoesDoGrupo(f.itens ?? [], () => true);
    const nova = moverNoGrupo(f.itens ?? [], todos, 2, 0);
    const r = aplicarOperacoes(f, [{ caminho: "itens", valor: nova }]);
    expect(r.ok && r.ficha.itens?.map((i) => i.nome)).toEqual(["C", "A", "B"]);
  });
});

describe("V4b: do compêndio para a ficha", () => {
  it("arma de corpo a corpo vira ataque calculado por Força, com proficiência", () => {
    const f: Ficha = { ...mago, atributos: { ...mago.atributos, for: 16 } };
    const a = ataqueDeArma(f, espada);
    expect(a).toMatchObject({ dano: "1d8", tipo: "Cortante", atributoDano: "for" });
    expect(a.acerto).toEqual({ tipo: "formula", atributo: "for", proficiente: true });
    // Força +3, proficiência +3 (nível 5)
    expect(bonusDeAcerto(f, a)).toBe(6);
    expect(expressaoDeDano(f, a)).toBe("1d8+3");
    expect(a.descricao).toContain("versátil (1d10)");
  });

  it("acuidade usa o maior entre Força e Destreza; à distância usa Destreza", () => {
    expect(ataqueDeArma(mago, adaga).acerto).toMatchObject({ atributo: "des" });
    const forte: Ficha = { ...mago, atributos: { ...mago.atributos, for: 18, des: 10 } };
    expect(ataqueDeArma(forte, adaga).acerto).toMatchObject({ atributo: "for" });
    expect(ataqueDeArma(forte, arco).acerto).toMatchObject({ atributo: "des" });
    expect(ataqueDeArma(mago, arco).alcance).toBe("24/96 m");
    expect(ataqueDeArma(mago, espada).alcance).toBe("1,5 m");
  });

  it("magia de salvaguarda e de ataque ganham a jogada pela habilidade de conjuração", () => {
    const sg = rolagemDaMagia(mago, bolaDeFogo);
    expect(sg.dano).toBe("8d6");
    expect(sg.tipo).toBe("Fogo");
    expect(sg.salvaguarda).toEqual({ alvo: "des", cdAtributo: "int", sucesso: "metade" });
    const at = rolagemDaMagia(mago, raioDeFogo);
    expect(at.acerto).toEqual({ tipo: "formula", atributo: "int", proficiente: true });
    expect(at.dano).toBe("1d10");
    expect(rolagemDaMagia(mago, luz)).toEqual({});
  });

  it("a magia entra no círculo dela, na posição pedida, e some do duplicado", () => {
    const f: Ficha = {
      ...mago,
      magias: [
        { nome: "Truque 1", nivel: 0, preparada: true, descricao: "" },
        { nome: "Dardo", nivel: 1, preparada: true, descricao: "" },
        { nome: "Truque 2", nivel: 0, preparada: true, descricao: "" },
      ],
    };
    const r = aplicarEntradaNaFicha(f, { tipo: "magia", magia: raioDeFogo }, "personagem", {
      posicao: 1,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // o truque novo fica na posição 1 do grupo dos truques (entre "Truque 1" e "Truque 2")
    const nova = aplicarOperacoes(f, r.operacoes);
    expect(nova.ok && nova.ficha.magias?.map((m) => m.nome)).toEqual([
      "Truque 1",
      "Dardo",
      "Raio de Fogo",
      "Truque 2",
    ]);
    expect(nova.ok && nova.ficha.magias?.[2]?.emAtaques).toBe(true);
    const outra = aplicarEntradaNaFicha(f, { tipo: "magia", magia: luz }, "personagem", {
      posicao: null,
      emAtaques: true,
    });
    expect(outra.ok && aplicarOperacoes(f, outra.operacoes)).toMatchObject({ ok: true });
    const repetida = aplicarEntradaNaFicha(
      { ...f, magias: [{ nome: "luz", nivel: 0, preparada: true, descricao: "" }] },
      { tipo: "magia", magia: luz },
      "personagem",
    );
    expect(repetida.ok).toBe(false);
  });

  it("item vai para o Equipamento com quantidade 1 e peso; repetido soma uma unidade", () => {
    const entrada: EntradaDoCompendio = {
      tipo: "item",
      item: { nome: "Corda de seda", peso: 2.5 },
    };
    const r = aplicarEntradaNaFicha(mago, entrada, "personagem");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f2 = aplicarOperacoes(mago, r.operacoes);
    expect(f2.ok && f2.ficha.itens).toEqual([{ nome: "Corda de seda", quantidade: 1, peso: 2.5 }]);
    if (!f2.ok) return;
    const r2 = aplicarEntradaNaFicha(f2.ficha, entrada, "personagem");
    expect(r2.ok && r2.operacoes).toEqual([{ caminho: "itens.0.quantidade", valor: 2 }]);
  });

  it("item com o nome de um modelo de luz da mesa acende pela regra do V4a2", () => {
    const r = aplicarEntradaNaFicha(mago, { tipo: "item", item: { nome: "Tocha" } }, "personagem");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f2 = aplicarOperacoes(mago, r.operacoes);
    expect(f2.ok).toBe(true);
    if (!f2.ok) return;
    const item = f2.ficha.itens?.[0];
    expect(item && modeloDoItem(item, [{ id: "modelo-tocha", nome: "Tocha" }])).toBe(
      "modelo-tocha",
    );
  });

  it("no NPC, a arma vira ação calculada pelo ND e entra na posição da lista de ações", () => {
    const ogro: Ficha = {
      pvAtual: 59,
      pvMax: 59,
      npc: { nd: "5" },
      atributos: { for: 19, des: 8, con: 16, int: 5, sab: 7, car: 7 },
      ataques: [
        { nome: "Clava", categoria: "acao" },
        { nome: "Reação X", categoria: "reacao" },
        { nome: "Azagaia" },
      ],
    };
    const r = aplicarEntradaNaFicha(ogro, { tipo: "arma", arma: espada }, "npc", { posicao: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f2 = aplicarOperacoes(ogro, r.operacoes);
    expect(f2.ok && f2.ficha.ataques?.map((a) => a.nome)).toEqual([
      "Clava",
      "Reação X",
      "Espada longa",
      "Azagaia",
    ]);
    if (!f2.ok) return;
    const nova = f2.ficha.ataques?.[2];
    expect(nova?.categoria).toBe("acao");
    expect(nova?.tipoDeAcao).toBe("cac");
    // Força +4, proficiência +3 (ND 5)
    expect(nova && bonusDeAcerto(f2.ficha, nova)).toBe(7);
  });

  it("no NPC, a magia solta vai para `magias` no círculo dela (e não para um traço), com o atributo escolhido", () => {
    const lich: Ficha = {
      pvAtual: 1,
      pvMax: 1,
      npc: { nd: "5" },
      atributos: { for: 10, des: 10, con: 10, int: 18, sab: 10, car: 12 },
    };
    const r = aplicarEntradaNaFicha(lich, { tipo: "magia", magia: bolaDeFogo }, "npc");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f2 = aplicarOperacoes(lich, r.operacoes);
    expect(f2.ok).toBe(true);
    if (!f2.ok) return;
    expect(f2.ficha.caracteristicas ?? []).toEqual([]);
    expect(f2.ficha.habilidadeDeConjuracao).toBe("int");
    expect(f2.ficha.magias).toHaveLength(1);
    const m = f2.ficha.magias?.[0];
    expect(m?.nome).toBe("Bola de Fogo");
    expect(m?.nivel).toBe(3);
    expect(m?.salvaguarda).toEqual({ alvo: "des", cdAtributo: "int", sucesso: "metade" });
    // ND 5: proficiência +3 e Inteligência 18 (+4): CD 15 e ataque +7
    expect(conjuracaoSemClasse(f2.ficha)).toEqual({ habilidade: "int", cd: 15, ataque: 7 });
    expect(derivar(f2.ficha).conjuracaoSemClasse).toMatchObject({ cd: 15, ataque: 7 });
    // a mesma magia de novo é recusada
    const deNovo = aplicarEntradaNaFicha(f2.ficha, { tipo: "magia", magia: bolaDeFogo }, "npc");
    expect(deNovo.ok).toBe(false);
    // com o atributo já escolhido, ele vale (Carisma +1, ND 5: ataque +4)
    const r2 = aplicarEntradaNaFicha(
      { ...lich, habilidadeDeConjuracao: "car" },
      { tipo: "magia", magia: raioDeFogo },
      "npc",
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.operacoes).toHaveLength(1);
    const lista = r2.operacoes[0]?.valor as { acerto?: unknown }[];
    expect(lista[0]?.acerto).toEqual({ tipo: "formula", atributo: "car", proficiente: true });
  });

  it("trocar a apresentação Personagem ↔ NPC mantém as magias e os espaços", () => {
    const f: Ficha = {
      pvAtual: 1,
      pvMax: 1,
      npc: { nd: "3" },
      habilidadeDeConjuracao: "sab",
      espacosTotal: { "1": 4, "2": 3 },
      espacosGastos: { "1": 1 },
      magias: [{ nome: "Luz", nivel: 0, preparada: true, descricao: "x" }],
    };
    const ida = aplicarOperacoes(f, [{ caminho: "apresentacao", valor: "personagem" }]);
    expect(ida.ok).toBe(true);
    if (!ida.ok) return;
    const volta = aplicarOperacoes(ida.ficha, [{ caminho: "apresentacao", valor: "npc" }]);
    expect(volta.ok && volta.ficha.magias).toEqual(f.magias);
    expect(volta.ok && volta.ficha.espacosTotal).toEqual({ "1": 4, "2": 3 });
    expect(volta.ok && volta.ficha.espacosGastos).toEqual({ "1": 1 });
    expect(volta.ok && volta.ficha.habilidadeDeConjuracao).toBe("sab");
    expect(derivar(f).espacos.map((e) => [e.nivel, e.total, e.restantes])).toEqual([
      [1, 4, 3],
      [2, 3, 3],
    ]);
  });

  it("no NPC o item vira traço", () => {
    const r = aplicarEntradaNaFicha(
      { pvAtual: 1, pvMax: 1, caracteristicas: [{ nome: "Rugido", descricao: "x" }] },
      { tipo: "item", item: { nome: "Poção de Cura", descricao: "Cura 2d4+2." } },
      "npc",
      { posicao: 0 },
    );
    expect(r.ok && r.operacoes[0]?.valor).toEqual([
      { nome: "Poção de Cura", descricao: "Cura 2d4+2." },
      { nome: "Rugido", descricao: "x" },
    ]);
  });

  it("o arrasto só aceita entradas válidas", () => {
    const texto = JSON.stringify({ tipo: "arma", arma: espada });
    expect(lerEntradaArrastada(texto)?.tipo).toBe("arma");
    expect(lerEntradaArrastada("{")).toBeNull();
    expect(lerEntradaArrastada(JSON.stringify({ tipo: "arma", arma: { nome: "x" } }))).toBeNull();
  });

  it("o compêndio antigo (só magias) continua valendo e o novo traz armas e itens", () => {
    const base = {
      formato: "tabletop-compendio",
      versao: 1,
      magias: [{ ...luz, nome: "Luz" }],
    };
    expect(lerCompendio(JSON.stringify(base)).ok).toBe(true);
    const novo = lerCompendio(
      JSON.stringify({ ...base, armas: [espada], itens: [{ nome: "Corda", peso: 5 }] }),
    );
    expect(novo.ok && novo.compendio.armas?.length).toBe(1);
    const ruim = lerCompendio(JSON.stringify({ ...base, armas: [{ nome: "x" }] }));
    expect(ruim.ok).toBe(false);
    if (!ruim.ok) expect(ruim.motivo).toContain("arma 1");
  });
});
