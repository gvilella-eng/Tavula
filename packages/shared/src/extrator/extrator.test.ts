import { describe, expect, it } from "vitest";
import { lerCompendio } from "../compendio.ts";
import { estaDentro, lerArgumentos } from "./cli.ts";
import { lerItensMagicos } from "./itens.ts";
import { type ItemDoPdf, type Linha, linhasDaPagina, type PaginaDoPdf } from "./linhas.ts";
import {
  arquivoDoCompendio,
  extrairItensDoLivro,
  extrairMagiasDoLivro,
  extrairMonstrosDoLivro,
} from "./livros.ts";
import {
  chaveDeNome,
  juntarLinha,
  lerLinhaDaEscola,
  lerListasPorClasse,
  lerMagias,
  ligarClasses,
} from "./magias.ts";
import {
  blocosDeMonstros,
  emTitulo,
  lerConjuracaoInata,
  lerConjuracaoPorEspacos,
  lerMonstro,
  numerosDaAcao,
} from "./monstros.ts";
import { aplicarNomesOriginais, lerTabelaDeNomes } from "./nomes.ts";
import { amostraDeNomes, montarRelatorio } from "./relatorio.ts";

// Tudo aqui é INVENTADO: imita o formato dos livros (duas colunas, versalete, rótulos), sem uma linha do conteúdo
// real. O conteúdo dos livros nunca entra no repositório.

const CORPO = "f4";
const NEGRITO = "f11";
const ITALICO = "f12";
const TRACO = "f22";
const TITULO = "f27";

type Parte = [texto: string, fonte?: string, tam?: number];

/** Uma linha do livro como itens do PDF (cada parte é um item, na mesma altura). */
function itens(x: number, y: number, partes: Parte[]): ItemDoPdf[] {
  let atual = x;
  return partes.map(([s, f = CORPO, fs = 9.5]) => {
    const item = { s, x: atual, y, fs, f };
    atual += s.length * fs * 0.5;
    return item;
  });
}

const pagina = (...grupos: ItemDoPdf[][]): PaginaDoPdf => ({
  w: 595.32,
  h: 841.92,
  items: grupos.flat(),
});

/** Uma Linha pronta (para testar os leitores sem passar pelo PDF). */
function linha(partes: Parte[], extra: Partial<Linha> = {}): Linha {
  const trechos = itens(extra.x ?? 40.9, extra.y ?? 500, partes).map((i) => ({
    t: i.s,
    f: i.f,
    fs: i.fs,
    x: i.x,
  }));
  return {
    pagina: 1,
    col: 0,
    y: 500,
    x: 40.9,
    tam: Math.max(...partes.map((p) => p[2] ?? 9)),
    trechos,
    texto: partes
      .map((p) => p[0])
      .join("")
      .replace(/\s+/g, " ")
      .trim(),
    ...extra,
  };
}

const caixa = (texto: string, f = CORPO, extra: Partial<Linha> = {}): Linha =>
  linha([[texto, f, 9]], extra);

describe("linhas: do PDF para a ordem de leitura", () => {
  it("lê a coluna da esquerda e depois a da direita, e tira o número da página", () => {
    const p = pagina(
      itens(35.4, 780, [["primeira da esquerda"]]),
      itens(35.4, 770, [["segunda da esquerda"]]),
      itens(304.9, 780, [["primeira da direita"]]),
      itens(35.4, 27.7, [["234"]]),
    );
    expect(linhasDaPagina(1, p).map((l) => [l.col, l.texto])).toEqual([
      [0, "primeira da esquerda"],
      [0, "segunda da esquerda"],
      [1, "primeira da direita"],
    ]);
  });

  it("junta os versaletes: maiúscula só na letra grande", () => {
    const p = pagina(
      itens(35.4, 700, [
        ["R", TITULO, 11],
        ["AIO", TITULO, 8],
        [" ", TITULO, 8],
        ["DE", TITULO, 8],
        [" ", TITULO, 8],
        ["T", TITULO, 11],
        ["ESTE", TITULO, 8],
      ]),
    );
    expect(linhasDaPagina(1, p)[0]?.texto).toBe("Raio de Teste");
  });

  it("não mexe na caixa de uma linha comum, nem na de nome todo em maiúsculas sem versalete", () => {
    const p = pagina(
      itens(35.4, 700, [["Tempo de Conjuração"]]),
      itens(35.4, 690, [["DRAGÃO JOVEM", TITULO, 14]]),
    );
    expect(linhasDaPagina(1, p).map((l) => l.texto)).toEqual([
      "Tempo de Conjuração",
      "DRAGÃO JOVEM",
    ]);
  });

  it("aceita três colunas quando se passam os cortes (as listas por classe)", () => {
    const p = pagina(itens(35.4, 700, [["a"]]), itens(215, 700, [["b"]]), itens(394, 700, [["c"]]));
    expect(linhasDaPagina(1, p, [205, 385]).map((l) => [l.col, l.texto])).toEqual([
      [0, "a"],
      [1, "b"],
      [2, "c"],
    ]);
  });

  it("troca o marcador de lista do livro (caractere de uso privado) por um ponto", () => {
    const p = pagina(itens(35.4, 700, [[" Item da lista"]]));
    expect(linhasDaPagina(1, p)[0]?.texto).toBe("• Item da lista");
  });

  it("refaz o hífen de quebra de linha e mantém o de palavra composta", () => {
    expect(juntarLinha("o pala-", "vrão")).toBe("o palavrão");
    expect(juntarLinha("Ataque Corpo-a-", "Corpo")).toBe("Ataque Corpo-a-Corpo");
    expect(juntarLinha("Ataque corpo-", "a-corpo")).toBe("Ataque corpo-a-corpo");
    expect(juntarLinha("um", "dois")).toBe("um dois");
  });
});

/** Uma magia inventada, no formato do Livro do Jogador, numa página de duas colunas. */
function paginaDeMagias(): PaginaDoPdf {
  const rotulo = (y: number, nome: string, valor: string, x = 35.4) => [
    ...itens(x, y, [[nome, NEGRITO]]),
    { s: valor, x: x + 110, y, fs: 9.5, f: CORPO },
  ];
  return pagina(
    // coluna da esquerda: a primeira magia
    itens(35.4, 700, [
      ["R", TITULO, 11],
      ["AIO", TITULO, 8],
      [" ", TITULO, 8],
      ["DE", TITULO, 8],
      [" ", TITULO, 8],
      ["T", TITULO, 11],
      ["ESTE", TITULO, 8],
    ]),
    itens(35.4, 690, [["2° nível de evocação (ritual)", ITALICO]]),
    rotulo(680, "Tempo de Conjuração", ": 1 ação"),
    rotulo(670, "Alcance", ": 18 metros"),
    rotulo(660, "Componentes", ": V, S, M (um pedacinho de teste"),
    itens(49.6, 650, [["inventado e pó de ouro)"]]),
    rotulo(640, "Duração", ": Concentração, até 1 minuto"),
    itens(35.4, 630, [["Um raio de luz inventado surge e che-"]]),
    itens(35.4, 620, [["ga ao alvo, sem machucar ninguém."]]),
    itens(49.6, 610, [["Segundo parágrafo, também inventado."]]),
    itens(49.6, 600, [
      ["Em Níveis Superiores.", NEGRITO],
      [" Com um espaço de 3° nível ou superior, o dano aumenta em 1d8."],
    ]),
    // coluna da direita: a segunda magia (truque)
    itens(304.9, 780, [
      ["F", TITULO, 11],
      ["AÍSCA", TITULO, 8],
    ]),
    itens(304.9, 770, [["Truque de ilusão", ITALICO]]),
    rotulo(760, "Tempo de Conjuração", ": 1 ação", 304.9),
    rotulo(750, "Alcance", ": Pessoal", 304.9),
    rotulo(740, "Componentes", ": V", 304.9),
    rotulo(730, "Duração", ": Instantânea", 304.9),
    itens(304.9, 720, [["Uma faísca inventada pisca na ponta do dedo."]]),
    itens(35.4, 27.7, [["234"]]),
  );
}

describe("magias", () => {
  it("lê a linha da escola: nível, escola, truque e ritual", () => {
    expect(lerLinhaDaEscola("3° nível de abjuração (ritual)")).toEqual({
      nivel: 3,
      escola: "Abjuração",
      ritual: true,
    });
    expect(lerLinhaDaEscola("Truque de evocação")).toEqual({
      nivel: 0,
      escola: "Evocação",
      ritual: false,
    });
    expect(lerLinhaDaEscola("Uma frase qualquer")).toBeNull();
    expect(lerLinhaDaEscola("2° nível de culinária")).toBeNull();
  });

  it("lê uma magia inteira: cabeçalho com material que quebra, parágrafos, em níveis superiores", () => {
    const linhas = linhasDaPagina(1, paginaDeMagias());
    const lidas = lerMagias(linhas);
    expect(lidas.map((m) => m.magia.nome)).toEqual(["Raio de Teste", "Faísca"]);
    const raio = lidas[0]?.magia;
    expect(raio).toMatchObject({
      nivel: 2,
      escola: "Evocação",
      ritual: true,
      concentracao: true,
      tempo: "1 ação",
      alcance: "18 metros",
      componentes: "V, S, M (um pedacinho de teste inventado e pó de ouro)",
      duracao: "Concentração, até 1 minuto",
      emNiveisSuperiores: "Com um espaço de 3° nível ou superior, o dano aumenta em 1d8.",
    });
    expect(raio?.descricao).toBe(
      "Um raio de luz inventado surge e chega ao alvo, sem machucar ninguém.\nSegundo parágrafo, também inventado.",
    );
    expect(lidas[0]?.faltando).toEqual([]);
    expect(lidas[1]?.magia).toMatchObject({
      nivel: 0,
      escola: "Ilusão",
      concentracao: false,
      ritual: false,
    });
  });

  it("move para a descrição o cabeçalho que passa do limite do formato, sem perder o texto", () => {
    const longo = `V, S, M (${"material inventado, ".repeat(20)}fim)`;
    const p = pagina(
      itens(35.4, 700, [
        ["F", TITULO, 11],
        ["AÍSCA", TITULO, 8],
      ]),
      itens(35.4, 690, [["1° nível de ilusão", ITALICO]]),
      itens(35.4, 680, [["Tempo de Conjuração", NEGRITO], [": 1 ação"]]),
      itens(35.4, 670, [["Alcance", NEGRITO], [": Toque"]]),
      itens(35.4, 660, [["Componentes", NEGRITO], [`: ${longo}`]]),
      itens(35.4, 650, [["Duração", NEGRITO], [": 1 hora"]]),
      itens(35.4, 640, [["Descrição inventada."]]),
    );
    const [m] = lerMagias(linhasDaPagina(1, p));
    expect(m?.magia.componentes).toBe("V, S, M (material na descrição)");
    expect(m?.magia.descricao).toContain("material inventado");
    expect(m?.magia.descricao).toContain("Descrição inventada.");
  });

  it("a última magia termina no apêndice", () => {
    const p = pagina(
      itens(35.4, 700, [
        ["F", TITULO, 11],
        ["AÍSCA", TITULO, 8],
      ]),
      itens(35.4, 690, [["1° nível de ilusão", ITALICO]]),
      itens(35.4, 680, [["Tempo de Conjuração", NEGRITO], [": 1 ação"]]),
      itens(35.4, 670, [["Alcance", NEGRITO], [": Toque"]]),
      itens(35.4, 660, [["Componentes", NEGRITO], [": V"]]),
      itens(35.4, 650, [["Duração", NEGRITO], [": 1 hora"]]),
      itens(35.4, 640, [["Descrição inventada."]]),
      itens(35.4, 600, [["Apêndice A: Coisas"]]),
      itens(35.4, 590, [["Texto de outro capítulo."]]),
    );
    const [m] = lerMagias(linhasDaPagina(1, p));
    expect(m?.magia.descricao).toBe("Descrição inventada.");
  });

  it("lê as listas por classe, com a entrada que quebra, e liga nomes com erro de digitação", () => {
    const l = (t: string) => caixa(t, CORPO, { x: 35.4 });
    const listas = lerListasPorClasse([
      l("Capítulo: introdução sem lista"),
      l("Magias de Mago"),
      l("Truques (Nível 0)"),
      l("Faísca (ilusão)"),
      l("1° Nível"),
      l("Raio de Teste (evocação, ritual)"),
      l("Comunhão Inventada"),
      l("(adivinhação, ritual)"),
      l("Magias de Bardo"),
      l("1° Nível"),
      l("Raio de Teste (evocação, ritual)"),
      l("Banquete dos Herois (conjuração)"),
    ]);
    expect([...(listas.get(chaveDeNome("Raio de Teste")) ?? [])].sort()).toEqual(["Bardo", "Mago"]);
    expect(listas.has(chaveDeNome("Comunhão Inventada"))).toBe(true);

    const magias = [
      { nome: "Raio de Teste" },
      { nome: "Faísca" },
      { nome: "Banquete de Heróis" },
    ] as { nome: string; classes?: string[] }[];
    const r = ligarClasses(magias, listas);
    expect(r.aproximados).toHaveLength(1);
    expect(r.semPar).toEqual([chaveDeNome("Comunhão Inventada")]);
    expect(magias[0]?.classes).toEqual(["Bardo", "Mago"]);
    expect(magias[2]?.classes).toEqual(["Bardo"]);
  });

  it("extrairMagiasDoLivro acha as listas e as descrições e valida com o zod", () => {
    const lista = pagina(
      itens(35.4, 780, [
        ["M", TITULO, 11],
        ["AGIAS", TITULO, 8],
        [" ", TITULO, 8],
        ["DE", TITULO, 8],
        [" ", TITULO, 8],
        ["B", TITULO, 11],
        ["ARDO", TITULO, 8],
      ]),
      itens(35.4, 770, [["1° Nível"]]),
      itens(35.4, 760, [["Raio de Teste (evocação, ritual)"]]),
    );
    const descricoes = paginaDeMagias();
    descricoes.items.push(...itens(35.4, 800, [["Descrições das Magias"]]));
    const r = extrairMagiasDoLivro([lista, descricoes]);
    expect(r.lidas).toBe(2);
    expect(r.validas).toHaveLength(2);
    expect(r.validas[0]?.classes).toEqual(["Bardo"]);
    expect(r.vazios.classes).toBe(1);
    expect(r.completas).toBe(1);
  });
});

// ---- monstros ----

/** Um bloco de estatísticas inventado, com a mesma forma do Manual dos Monstros. */
function blocoInventado(): Linha[] {
  const n = (t: string, f = CORPO, extra: Partial<Linha> = {}) => caixa(t, f, extra);
  const rot = (rotulo: string, valor: string) =>
    linha(
      [
        [`${rotulo} `, NEGRITO],
        [valor, CORPO],
      ],
      { x: 40.9 },
    );
  return [
    linha([["Goblinzinho", TITULO, 14]]),
    n("Humanoide Médio (goblinoide), leal e mau", ITALICO),
    rot("Classe de Armadura", "15 (couro batido, escudo)"),
    rot("Pontos de Vida", "11 (2d8 + 2)"),
    rot("Deslocamento", "9 m, voo 18 m"),
    n("FORDESCONINTSABCAR", NEGRITO),
    n("13 (+1)12 (+1)12 (+1)10 (+0)10 (+)9 (–1)"),
    rot("Testes de Resistência", "Des +4, Sab +2"),
    rot("Perícias", "Furtividade +6,"),
    n("Percepção +2", CORPO, { x: 49.7 }),
    rot("Imunidade a Dano", "veneno"),
    rot("Sentidos", "visão no escuro 18 m, Percepção passiva 10"),
    rot("Idiomas", "Comum, Goblin"),
    rot("Nível de Desafio", "1/2 (100 XP)"),
    linha([["Vantagem Marcial", TRACO], [". Uma vez por turno, pode causar 7"]]),
    n("(2d6) de dano extra."),
    linha([["Conjuração Inata", TRACO], [". A habilidade de conjuração é"]]),
    n("Carisma (CD de resistência de magia 13). Pode conjurar,"),
    n("inatamente, as seguintes magias:"),
    n("À vontade: luz, mãos mágicas"),
    n("3/dia cada: raio de teste, faísca"),
    n("1/dia: sono"),
    n("Ações", NEGRITO, { tam: 11 }),
    linha([["Espada Longa", TRACO], [". Ataque Corpo-a-"]]),
    n(
      "Corpo com Arma: +3 para atingir, alcance 1,5 m, um alvo. Acerto: 5 (1d8 + 1) de dano cortante ou 6",
    ),
    n("(1d10 + 1) de dano cortante se usada com as duas mãos."),
    linha([["Sopro Gélido (Recarrega 5–6)", TRACO], [". O goblin sopra um cone de 4,5 metros."]]),
    n(
      "Cada criatura deve ser bem sucedida num teste de resistência de Constituição CD 12, sofrendo 9 (2d8) de dano de frio se falhar, ou metade desse dano se obtiver sucesso.",
    ),
    linha([["Toque Curativo (3/Dia)", TRACO], [". O goblin toca outra criatura."]]),
    n("Reações", NEGRITO, { tam: 11 }),
    linha([["Aparar", TRACO], [". O goblin adiciona 2 à sua CA."]]),
    n("Ações Lendárias", NEGRITO, { tam: 11 }),
    n("O goblin pode realizar 3 ações lendárias, escolhidas dentre as opções abaixo."),
    linha([["Detectar", NEGRITO], [". Faz um teste de Percepção."]]),
    linha([["Ataque com Cauda (Custa 2 Ações)", NEGRITO], [". Um ataque de cauda."]]),
  ];
}

describe("monstros", () => {
  it("lê o bloco inteiro: cabeçalho, atributos (com erro de digitação), traços, ações, reações e lendárias", () => {
    const linhas = [
      caixa("Texto corrido anterior.", CORPO, { tam: 9.5 }),
      caixa("Texto corrido anterior.", CORPO, { tam: 9.5 }),
      ...blocoInventado(),
      caixa("Texto corrido depois.", CORPO, { tam: 9.5 }),
    ];
    const blocos = blocosDeMonstros(linhas);
    expect(blocos).toHaveLength(1);
    expect(blocos[0]?.nome).toBe("Goblinzinho");
    const { monstro: m, faltando } = lerMonstro(blocos[0] as NonNullable<(typeof blocos)[0]>);
    expect(faltando).toEqual([]);
    expect(m).toMatchObject({
      nome: "Goblinzinho",
      tamanho: "Médio",
      tipo: "Humanoide (goblinoide)",
      tendencia: "Leal e mau",
      ca: { valor: 15, fonte: "couro batido, escudo" },
      pv: { media: 11, formula: "2d8 + 2" },
      deslocamento: "9 m, voo 18 m",
      deslocamentoM: 9,
      atributos: { for: 13, des: 12, con: 12, int: 10, sab: 10, car: 9 },
      salvaguardas: { des: 4, sab: 2 },
      pericias: { Furtividade: 6, Percepção: 2 },
      imunidades: "veneno",
      sentidos: "visão no escuro 18 m, Percepção passiva 10",
      idiomas: "Comum, Goblin",
      nd: "1/2",
      xp: 100,
    });
    expect(m.tracos?.map((t) => t.nome)).toEqual(["Vantagem Marcial", "Conjuração Inata"]);
    const acoes = m.acoes ?? [];
    expect(acoes.map((a) => a.nome)).toEqual(["Espada Longa", "Sopro Gélido", "Toque Curativo"]);
    expect(acoes[0]).toMatchObject({
      tipo: "cac",
      acerto: 3,
      alcance: "1,5 m",
      dano: "1d8+1",
      tipoDeDano: "Cortante",
    });
    expect(acoes[1]).toMatchObject({
      recarga: 5,
      dano: "2d8",
      tipoDeDano: "Frio",
      salvaguarda: { atributo: "con", cd: 12, sucesso: "metade" },
    });
    expect(acoes[2]?.usos).toBe(3);
    expect(m.reacoes?.map((a) => a.nome)).toEqual(["Aparar"]);
    expect(m.textoDasAcoesLendarias).toContain("3 ações lendárias");
    expect(m.acoesLendarias?.map((a) => a.nome)).toEqual([
      "Detectar",
      "Ataque com Cauda (Custa 2 Ações)",
    ]);
    expect(m.conjuracaoInata).toMatchObject({
      habilidade: "car",
      cd: 13,
      grupoMax: 1,
      magias: [
        { nome: "Luz", frequencia: "vontade" },
        { nome: "Mãos Mágicas", frequencia: "vontade" },
        { nome: "Raio de Teste", frequencia: "cada", max: 3 },
        { nome: "Faísca", frequencia: "cada", max: 3 },
        { nome: "Sono", frequencia: "grupo" },
      ],
    });
  });

  it("o bloco que acaba no pé da coluna continua na seguinte, embaixo do texto corrido", () => {
    const completo = blocoInventado();
    const corte = completo.findIndex((l) => l.texto === "Ações");
    const primeira = completo.slice(0, corte).map((l) => ({ ...l, col: 0, y: 80 }));
    const resto = completo.slice(corte).map((l) => ({ ...l, col: 1, pagina: 1 }));
    const prosa = [0, 1].map(() =>
      caixa("Texto corrido que abre a coluna.", CORPO, { tam: 9.5, col: 1 }),
    );
    const blocos = blocosDeMonstros([
      ...primeira,
      ...prosa,
      ...resto,
      caixa("Fim.", CORPO, { tam: 9.5, col: 1 }),
    ]);
    expect(blocos).toHaveLength(1);
    const { monstro } = lerMonstro(blocos[0] as NonNullable<(typeof blocos)[0]>);
    expect(monstro.acoes?.map((a) => a.nome)).toEqual([
      "Espada Longa",
      "Sopro Gélido",
      "Toque Curativo",
    ]);
    expect(monstro.acoesLendarias).toHaveLength(2);
  });

  it("o bloco que acaba no meio da coluna não engole o texto corrido que vem depois", () => {
    const completo = blocoInventado().map((l) => ({ ...l, y: 400 }));
    const blocos = blocosDeMonstros([
      caixa("a", CORPO, { tam: 9.5 }),
      caixa("b", CORPO, { tam: 9.5 }),
      ...completo,
      caixa("Prosa.", CORPO, { tam: 9.5 }),
      caixa("Mais um texto de 9 pontos fora da caixa?", CORPO, { tam: 9, y: 300 }),
    ]);
    expect(blocos[0]?.linhas.at(-1)?.texto).not.toContain("Prosa");
    expect(blocos[0]?.linhas.some((l) => l.texto.includes("Mais um texto"))).toBe(false);
  });

  it("nome todo em maiúsculas vira caixa de título; tipo com tamanho antes ou depois", () => {
    expect(emTitulo("DRAGÃO DE PRATA JOVEM")).toBe("Dragão de Prata Jovem");
    const blocos = blocosDeMonstros([
      caixa("x", CORPO, { tam: 9.5 }),
      caixa("y", CORPO, { tam: 9.5 }),
      linha([["DRAGÃO DE PRATA JOVEM", TITULO, 11]], { tam: 11 }),
      caixa("Dragão Grande, leal e bom", ITALICO),
      linha([["Classe de Armadura ", NEGRITO], ["18 (armadura natural)"]]),
      linha([["Pontos de Vida ", NEGRITO], ["168 (16d10 + 80)"]]),
      caixa("FORDESCONINTSABCAR", NEGRITO),
      caixa("23 (+6)10 (+0)21 (+5)14 (+2)11 (+0)19 (+4)"),
      linha([["Nível de Desafio ", NEGRITO], ["9 (5.000 XP)"]]),
    ]);
    const { monstro } = lerMonstro(blocos[0] as NonNullable<(typeof blocos)[0]>);
    expect(monstro).toMatchObject({
      nome: "Dragão de Prata Jovem",
      tamanho: "Grande",
      tipo: "Dragão",
      nd: "9",
      xp: 5000,
    });
  });

  it("os números da ação: ataque à distância, dano duplo, dano composto e flat", () => {
    expect(
      numerosDaAcao(
        "Arco Curto",
        "Ataque à Distância com Arma: +4 para atingir, distância 24/96 m, um alvo. Acerto: 5 (1d6 + 2) de dano perfurante.",
      ),
    ).toMatchObject({
      tipo: "dist",
      acerto: 4,
      alcance: "24/96 m",
      dano: "1d6+2",
      tipoDeDano: "Perfurante",
    });
    expect(
      numerosDaAcao(
        "Mordida",
        "Ataque Corpo-a-Corpo com Arma: +17 para atingir, alcance 4,5 m, um alvo. Acerto: 21 (2d10 + 10) de dano perfurante mais 14 (4d6) de dano de fogo.",
      ),
    ).toMatchObject({
      dano: "2d10+10",
      tipoDeDano: "Perfurante",
      dano2: { dano: "4d6", tipoDeDano: "Fogo" },
    });
    expect(
      numerosDaAcao(
        "Machado",
        "Ataque Corpo-a-Corpo com Arma: +6 para atingir, alcance 1,5 m, um alvo. Acerto: 14 (1d12 + 4 mais 1d8) de dano cortante.",
      ),
    ).toMatchObject({ dano: "1d12+4", dano2: { dano: "1d8", tipoDeDano: "Cortante" } });
    expect(
      numerosDaAcao(
        "Lança",
        "Ataque Corpo-a-Corpo ou à Distância com Arma: +5 para atingir, alcance 1,5 m ou distância 6/18 m, um alvo. Acerto: 4 (1d6 + 1) de dano perfurante.",
      ),
    ).toMatchObject({ tipo: "cacdist", alcance: "1,5 m ou distância 6/18 m" });
    expect(
      numerosDaAcao(
        "Toque",
        "Ataque Corpo-a-Corpo: +1 para atingir, alcance 1,5 m, um alvo. Acerto: 1 de dano de veneno.",
      ),
    ).toMatchObject({ dano: "1", tipoDeDano: "Veneno" });
    expect(numerosDaAcao("Ataques Múltiplos", "O monstro realiza dois ataques.")).toEqual({});
  });

  it("conjuração inata (curta, por espaços) e o nome das magias vem do Livro do Jogador", () => {
    const canonicos = new Map([[chaveDeNome("Bola de Fogo"), "Bola de Fogo"]]);
    expect(
      lerConjuracaoInata(
        "A habilidade de conjuração é Sabedoria (CD de resistência de magia 11). Pode conjurar, inatamente, as seguintes magias:\nÀ vontade: bola de fogo (versão inventada)\n2/dia: luz",
        canonicos,
      ),
    ).toMatchObject({
      habilidade: "sab",
      cd: 11,
      grupoMax: 2,
      magias: [
        { nome: "Bola de Fogo", frequencia: "vontade" },
        { nome: "Luz", frequencia: "grupo" },
      ],
    });
    expect(
      lerConjuracaoInata(
        "O mephit pode conjurar, inatamente, sono, sem necessidade de componentes.",
        undefined,
        "Conjuração Inata (1/Dia)",
      ),
    ).toMatchObject({ magias: [{ nome: "Sono", frequencia: "cada", max: 1 }] });
    expect(
      lerConjuracaoPorEspacos(
        "O mago é um conjurador de 9° nível. Sua habilidade de conjuração é Inteligência (CD 14). Magias de mago preparadas:\nTruques (à vontade): luz, mãos mágicas\n1° nível (4 espaços): escudo, mísseis mágicos\n3° nível (3 espaços): bola de fogo",
        canonicos,
      ),
    ).toMatchObject({
      habilidade: "int",
      espacos: { "1": 4, "3": 3 },
      magias: [
        { nome: "Luz", nivel: 0 },
        { nome: "Mãos Mágicas", nivel: 0 },
        { nome: "Escudo", nivel: 1 },
        { nome: "Mísseis Mágicos", nivel: 1 },
        { nome: "Bola de Fogo", nivel: 3 },
      ],
    });
  });

  it("texto corrido colado no fim da lista de magias não vira nome", () => {
    const r = lerConjuracaoInata(
      "Pode conjurar:\n1/dia cada: viagem planar Os gênios têm outras capacidades",
    );
    expect(r?.magias.map((m) => m.nome)).toEqual(["Viagem Planar"]);
  });

  it("extrairMonstrosDoLivro valida com o zod e conta as ações", () => {
    const linhas = blocoInventado();
    // Reaproveita o bloco inventado como uma página: cada linha vira itens numa coluna.
    let y = 780;
    const items = linhas.flatMap((l) => {
      y -= 10;
      // O corpo da caixa é de 9 pontos (as linhas de teste sem tamanho trazem o padrão 9,5 dos itens).
      return l.trechos.map((t) => ({ s: t.t, x: t.x, y, fs: t.fs === 9.5 ? 9 : t.fs, f: t.f }));
    });
    const r = extrairMonstrosDoLivro([
      {
        w: 595.32,
        h: 841.92,
        items: [
          ...itens(40.9, 790, [["Texto.", CORPO, 9.5]]),
          ...itens(40.9, 785, [["Texto.", CORPO, 9.5]]),
          ...items,
        ],
      },
    ]);
    expect(r.lidas).toBe(1);
    expect(r.falhas).toEqual([]);
    expect(r.validas).toHaveLength(1);
    expect(r.completas).toBe(1);
  });

  it("um bloco que não passa no zod vai para as falhas, com o motivo", () => {
    const [bloco] = blocosDeMonstros([
      caixa("x", CORPO, { tam: 9.5 }),
      caixa("y", CORPO, { tam: 9.5 }),
      linha([["BICHO", TITULO, 11]], { tam: 11 }),
      caixa("Fera Média, imparcial", ITALICO),
      linha([["Classe de Armadura ", NEGRITO], ["12"]]),
      linha([["Pontos de Vida ", NEGRITO], ["5 (1d8 + 1)"]]),
      linha([["Nível de Desafio ", NEGRITO], ["1/2 (100 XP)"]]),
    ]);
    const lido = lerMonstro(bloco as NonNullable<typeof bloco>);
    expect(lido.faltando).toContain("atributos");
    expect(lido.faltando).toContain("acoes");
  });
});

// ---- itens ----

function paginaDeItens(): PaginaDoPdf {
  return pagina(
    itens(35.4, 700, [
      ["E", TITULO, 11],
      ["SPADA", TITULO, 8],
      [" ", TITULO, 8],
      ["DE", TITULO, 8],
      [" ", TITULO, 8],
      ["T", TITULO, 11],
      ["ESTE", TITULO, 8],
    ]),
    itens(35.4, 690, [["Arma (qualquer espada que cause dano cortante),", ITALICO]]),
    itens(35.4, 680, [["lendária (requer sintonização por um guerreiro)", ITALICO]]),
    itens(35.4, 670, [
      ["Você recebe +3 de bônus nas jogadas de ataque e dano feitas com esta arma."],
    ]),
    itens(49.6, 660, [["Segundo parágrafo inventado."]]),
    itens(35.4, 650, [[" Item de lista inventado"]]),
    itens(304.9, 780, [
      ["P", TITULO, 11],
      ["OÇÃO", TITULO, 8],
      [" ", TITULO, 8],
      ["I", TITULO, 11],
      ["NVENTADA", TITULO, 8],
    ]),
    itens(304.9, 770, [["Poção, raridade variável", ITALICO]]),
    itens(304.9, 760, [["Você bebe e acontece algo inventado."]]),
    itens(304.9, 700, [["Capítulo", TITULO, 14]]),
    itens(304.9, 690, [["Texto de outra seção, que não pertence ao item."]]),
  );
}

describe("itens mágicos", () => {
  it("lê o nome, o tipo que quebra em duas linhas, a raridade, a sintonização e o bônus", () => {
    const lidos = lerItensMagicos(linhasDaPagina(1, paginaDeItens()));
    expect(lidos.map((i) => i.item.nome)).toEqual(["Espada de Teste", "Poção Inventada"]);
    expect(lidos[0]?.item).toMatchObject({
      tipo: "Arma (qualquer espada que cause dano cortante)",
      raridade: "lendário",
      sintonizacao: { necessaria: true, por: "um guerreiro" },
      bonus: 3,
    });
    expect(lidos[0]?.item.descricao).toBe(
      "Você recebe +3 de bônus nas jogadas de ataque e dano feitas com esta arma.\nSegundo parágrafo inventado.\n• Item de lista inventado",
    );
    expect(lidos[1]?.item).toMatchObject({ tipo: "Poção", raridade: "varia" });
    expect(lidos[1]?.item.descricao).toBe("Você bebe e acontece algo inventado.");
  });

  it("não confunde um título de seção com uma linha de raridade", () => {
    const p = pagina(
      itens(35.4, 700, [
        ["R", TITULO, 11],
        ["ARIDADE", TITULO, 8],
      ]),
      itens(35.4, 690, [["Cada item tem uma raridade: comum, incomum, raro e lendário.", ITALICO]]),
    );
    expect(lerItensMagicos(linhasDaPagina(1, p))).toEqual([]);
  });

  it("o nome que quebra em duas linhas (a de baixo com corpo 10) vira um nome só", () => {
    const p = pagina(
      itens(35.4, 700, [
        ["A", TITULO, 11],
        ["MULETO", TITULO, 8],
        [" ", TITULO, 8],
        ["DE", TITULO, 8],
        [" ", TITULO, 8],
        ["P", TITULO, 11],
        ["ROTEÇÃO", TITULO, 8],
        [" ", TITULO, 8],
        ["E", TITULO, 8],
      ]),
      itens(35.4, 690, [
        ["L", TITULO, 10],
        ["OCALIZAÇÃO", TITULO, 8],
      ]),
      itens(35.4, 680, [["Item maravilhoso, incomum (requer sintonização)", ITALICO]]),
      itens(35.4, 670, [["Descrição inventada do amuleto."]]),
    );
    const [i] = lerItensMagicos(linhasDaPagina(1, p));
    expect(i?.item.nome).toBe("Amuleto de Proteção e Localização");
    expect(i?.item.raridade).toBe("incomum");
    expect(i?.item.descricao).toBe("Descrição inventada do amuleto.");
  });

  it("extrairItensDoLivro valida com o zod", () => {
    const r = extrairItensDoLivro([paginaDeItens()]);
    expect(r.lidas).toBe(2);
    expect(r.validas).toHaveLength(2);
    expect(r.completas).toBe(2);
  });
});

describe("arquivo, relatório e linha de comando", () => {
  it("o arquivo gerado passa pela mesma leitura que a mesa faz, com os créditos", () => {
    const r = extrairItensDoLivro([paginaDeItens()]);
    const texto = JSON.stringify(arquivoDoCompendio("itens", { itensMagicos: r.validas }));
    const lido = lerCompendio(texto);
    expect(lido.ok).toBe(true);
    if (lido.ok) {
      expect(lido.compendio.itensMagicos).toHaveLength(2);
      expect(lido.compendio.creditos).toContain("Guia do Mestre");
      expect(lido.compendio.creditos).toContain("Biblioteca Élfica");
    }
  });

  it("o relatório traz lidas, passaram, falhas, vazios e amostra; livro ausente aparece como tal", () => {
    const texto = montarRelatorio(
      [
        {
          titulo: "Livro de Teste",
          arquivo: "teste.pdf",
          saida: "teste.json",
          resultado: {
            lidas: 4,
            validas: [{ nome: "A" }, { nome: "B" }, { nome: "C" }],
            falhas: [{ nome: "D", pagina: 9, motivo: "tempo: grande demais" }],
            vazios: { classes: 2, duracao: 1 },
            avisos: ["Um aviso."],
            completas: 2,
            criterio: "tudo",
            paginas: [1, 2, 3],
          },
        },
        { titulo: "Outro", arquivo: "(não encontrado)", saida: null, resultado: null },
      ],
      "2026-01-01",
    );
    expect(texto).toContain("Entradas lidas: 4");
    expect(texto).toContain("Passaram na validação: 3 (75,0%)");
    expect(texto).toContain("D (p. 9): tempo: grande demais");
    expect(texto).toContain("classes: 2 de 4 (50,0%)");
    expect(texto).toContain("Não extraído.");
    expect(texto).toMatch(/Sorteados: .*/);
  });

  it("a amostra de nomes é repetível e sem repetição", () => {
    const nomes = Array.from({ length: 30 }, (_, i) => `n${i}`);
    expect(amostraDeNomes(nomes, 10)).toEqual(amostraDeNomes(nomes, 10));
    expect(new Set(amostraDeNomes(nomes, 10)).size).toBe(10);
    expect(amostraDeNomes(["a"], 5)).toEqual(["a"]);
  });

  it("lê os argumentos e recusa a pasta de saída dentro do repositório", () => {
    expect(lerArgumentos(["--", "--livros", "L", "--saida", "S"])).toEqual({
      livros: "L",
      saida: "S",
    });
    expect(lerArgumentos(["--livros"])).toEqual({});
    expect(estaDentro("/repo/saida", "/repo")).toBe(true);
    expect(estaDentro("/repo", "/repo")).toBe(true);
    expect(estaDentro("/outro/pasta", "/repo")).toBe(false);
    expect(estaDentro("/repo-irmao", "/repo")).toBe(false);
  });
});

describe("nomes em inglês (Q2)", () => {
  it("lê a tabela, com seção ausente vazia, e recusa formato errado", () => {
    const ok = lerTabelaDeNomes('{"magias":{"Bola Inventada":"Invented Ball"}}');
    expect(ok).toEqual({
      ok: true,
      tabela: { magias: { "Bola Inventada": "Invented Ball" }, monstros: {}, itens: {} },
    });
    expect(lerTabelaDeNomes("nao json").ok).toBe(false);
    expect(lerTabelaDeNomes('{"magias":[]}').ok).toBe(false);
    expect(lerTabelaDeNomes('{"monstros":{"A":3}}').ok).toBe(false);
  });

  it("preenche o nomeOriginal sem acento nem caixa e respeita o que já existe", () => {
    const r = aplicarNomesOriginais(
      [
        { nome: "Mísseis Inventados" },
        { nome: "Sem Nome" },
        { nome: "Pronto", nomeOriginal: "Ready" },
      ],
      { "misseis inventados": "Invented Missiles", Pronto: "Outro" },
    );
    expect(r.preenchidos).toBe(1);
    expect(r.entradas.map((e) => e.nomeOriginal)).toEqual([
      "Invented Missiles",
      undefined,
      "Ready",
    ]);
  });

  it("lê o argumento --nomes", () => {
    expect(lerArgumentos(["--livros", "L", "--saida", "S", "--nomes", "N.json"])).toEqual({
      livros: "L",
      saida: "S",
      nomes: "N.json",
    });
  });
});
