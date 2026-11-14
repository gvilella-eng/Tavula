import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  aplicarEntradaNaFicha,
  aplicarOperacoes,
  bonusDeAcerto,
  bonusDePericia,
  bonusDeSalvaguarda,
  buscarItensMagicos,
  buscarMonstros,
  type Compendio,
  CompendioSchema,
  cdDaRolagem,
  EntradaDoCompendioSchema,
  espacosDaFicha,
  FichaSchema,
  fichaNova,
  type ItemMagicoDoCompendio,
  juntarCompendios,
  LIMITES_DO_COMPENDIO,
  lerCompendio,
  lerVariosCompendios,
  type MonstroDoCompendio,
  magiasDoMonstro,
  monstroParaFicha,
  NIVEIS_DE_DESAFIO,
  nomeCanonicoDoArquivo,
  opcoesDeItensMagicos,
  opcoesDeMonstros,
  PersonagemSchema,
  personagemDoMonstro,
  resumoDoItemMagico,
  tamanhoDoTokenDoMonstro,
  XP_POR_ND,
} from "./index.ts";

const TEXTO = readFileSync(
  new URL("../../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);
const exemplo = (): Compendio => {
  const r = lerCompendio(TEXTO);
  if (!r.ok) throw new Error(r.motivo);
  return r.compendio;
};
const monstroDoExemplo = (nome: string): MonstroDoCompendio => {
  const m = exemplo().monstros?.find((x) => x.nome === nome);
  if (!m) throw new Error(`sem ${nome}`);
  return m;
};

/** Um monstro inventado para os testes (nada de livro): conjuração inata, ações lendárias, sopro com salvaguarda. */
const SERPENTE: MonstroDoCompendio = {
  nome: "Serpente de Teste",
  nomeOriginal: "Test Serpent",
  tamanho: "Grande",
  tipo: "Celestial",
  tendencia: "Leal e bom",
  ca: { valor: 19, fonte: "armadura natural" },
  pv: { media: 97, formula: "13d8 + 39" },
  deslocamento: "9 m, voo 27 m",
  atributos: { for: 16, des: 20, con: 17, int: 18, sab: 20, car: 18 },
  salvaguardas: { con: 5, sab: 7, car: 6 },
  pericias: { Percepção: 7, Furtividade: 5, Pilhagem: 3 },
  resistencias: "radiante",
  imunidades: "psíquico",
  imunidadesCondicoes: "enfeitiçado",
  sentidos: "visão cega 18 m, Percepção passiva 17",
  idiomas: "todos, telepatia 36 m",
  nd: "4",
  xp: 1100,
  tracos: [{ nome: "Arma Mágica", texto: "Os ataques da serpente são mágicos." }],
  acoes: [
    {
      nome: "Mordida",
      texto: "Ataque corpo a corpo: +6 para atingir. Acerto: 8 (1d6 + 5) perfurante.",
      tipo: "cac",
      acerto: 6,
      alcance: "1,5 m",
      dano: "1d6+5",
      tipoDeDano: "Perfurante",
      dano2: { dano: "2d6", tipoDeDano: "Veneno" },
    },
    {
      nome: "Sopro de Luz",
      texto: "Cone de 9 m. Salvaguarda de Destreza CD 14; 22 (5d8) radiante; metade no sucesso.",
      tipo: "esp",
      dano: "5d8",
      tipoDeDano: "Radiante",
      salvaguarda: { atributo: "des", cd: 14, sucesso: "metade" },
      recarga: 5,
    },
  ],
  reacoes: [{ nome: "Desviar", texto: "A serpente reduz o dano em 5." }],
  acoesLendarias: [
    { nome: "Rabanada", texto: "A serpente faz um ataque de cauda.", tipo: "cac", acerto: 6 },
  ],
  textoDasAcoesLendarias: "A serpente pode fazer 3 ações lendárias por rodada.",
  conjuracaoInata: {
    habilidade: "sab",
    cd: 15,
    grupoMax: 3,
    magias: [
      { nome: "Detectar Magia", frequencia: "vontade" },
      { nome: "Bola de Fogo", frequencia: "cada", max: 1 },
      { nome: "Magia Inventada", frequencia: "grupo" },
    ],
  },
};

const itemMagico = (extra: Partial<ItemMagicoDoCompendio> = {}): ItemMagicoDoCompendio => ({
  nome: "Anel de Teste",
  tipo: "anel",
  raridade: "raro",
  descricao: "Um anel de teste.",
  ...extra,
});

describe("N3a: o formato com monstros e itens mágicos", () => {
  it("o exemplo do SRD traz 3 monstros e itens mágicos válidos, com os créditos", () => {
    const c = exemplo();
    expect(c.monstros?.map((m) => m.nome)).toEqual(["Goblin", "Lobo", "Mago"]);
    expect(c.itensMagicos?.length).toBeGreaterThanOrEqual(3);
    expect(c.creditos).toContain("CC-BY-4.0");
    expect(c.magias).toHaveLength(3);
  });

  it("um arquivo só de monstros vale (sem magias)", () => {
    const r = lerCompendio(
      JSON.stringify({
        formato: "tabletop-compendio",
        versao: 1,
        monstros: [monstroDoExemplo("Goblin")],
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.compendio.magias).toEqual([]);
  });

  it("um arquivo sem nenhuma lista é recusado", () => {
    const r = lerCompendio(JSON.stringify({ formato: "tabletop-compendio", versao: 1 }));
    expect(r.ok).toBe(false);
  });

  it("recusa monstro com ND ou atributo errado, dizendo o monstro e o campo", () => {
    const base = JSON.parse(TEXTO);
    base.monstros[1].nd = "31";
    const r = lerCompendio(JSON.stringify(base));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/^monstro 2, campo nd:/);
    const outro = JSON.parse(TEXTO);
    outro.monstros[0].atributos.for = 31;
    const r2 = lerCompendio(JSON.stringify(outro));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.motivo).toBe("monstro 1, campo atributos.for: precisa ser no máximo 30");
  });

  it("recusa item mágico com raridade desconhecida", () => {
    const base = JSON.parse(TEXTO);
    base.itensMagicos[0].raridade = "épico";
    const r = lerCompendio(JSON.stringify(base));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/^item mágico 1, campo raridade:/);
  });

  it("aceita a entrada arrastada de monstro e de item mágico", () => {
    const m = EntradaDoCompendioSchema.safeParse({
      tipo: "monstro",
      monstro: monstroDoExemplo("Mago"),
    });
    expect(m.success).toBe(true);
    expect(
      EntradaDoCompendioSchema.safeParse({ tipo: "itemMagico", itemMagico: itemMagico() }).success,
    ).toBe(true);
  });
});

describe("N3a: os limites", () => {
  it("sobem para caber os livros: ao menos mil de cada tipo e arquivo de 16 MB", () => {
    expect(LIMITES_DO_COMPENDIO.magias).toBeGreaterThanOrEqual(1000);
    expect(LIMITES_DO_COMPENDIO.monstros).toBeGreaterThanOrEqual(1000);
    expect(LIMITES_DO_COMPENDIO.itens).toBeGreaterThanOrEqual(1000);
    expect(LIMITES_DO_COMPENDIO.itensMagicos).toBeGreaterThanOrEqual(1000);
    expect(LIMITES_DO_COMPENDIO.bytes).toBe(16 * 1024 * 1024);
  });

  it("mil monstros com texto cheio cabem no arquivo e a busca é rápida", () => {
    const base = monstroDoExemplo("Mago");
    const texto = "t".repeat(2500);
    const monstros = Array.from({ length: 1000 }, (_, i) => ({
      ...base,
      nome: `Monstro ${i}`,
      tracos: [{ nome: "Longo", texto }],
    }));
    const json = JSON.stringify({ formato: "tabletop-compendio", versao: 1, monstros });
    expect(new TextEncoder().encode(json).length).toBeLessThan(LIMITES_DO_COMPENDIO.bytes);
    const lido = lerCompendio(json);
    expect(lido.ok).toBe(true);
    if (!lido.ok) return;
    const t0 = performance.now();
    for (let i = 0; i < 20; i++)
      buscarMonstros(lido.compendio.monstros ?? [], { texto: "monstro 99" });
    expect((performance.now() - t0) / 20).toBeLessThan(50);
  });

  it("monstros demais são recusados", () => {
    const monstros = Array.from({ length: LIMITES_DO_COMPENDIO.monstros + 1 }, (_, i) => ({
      ...monstroDoExemplo("Lobo"),
      nome: `M${i}`,
    }));
    expect(
      CompendioSchema.safeParse({ formato: "tabletop-compendio", versao: 1, monstros }).success,
    ).toBe(false);
  });
});

describe("N3a: juntar vários arquivos", () => {
  const soMonstros = (nomes: string[], creditos?: string): Compendio => ({
    formato: "tabletop-compendio",
    versao: 1,
    ...(creditos ? { creditos } : {}),
    magias: [],
    monstros: nomes.map((n) => ({ ...monstroDoExemplo("Lobo"), nome: n })),
  });

  it("soma as listas e junta os créditos sem repetir", () => {
    const r = juntarCompendios([
      {
        nome: "magias.json",
        compendio: { ...exemplo(), monstros: undefined, itensMagicos: undefined },
      },
      { nome: "monstros.json", compendio: soMonstros(["Aranha"], "Créditos do livro A") },
      { nome: "mais.json", compendio: soMonstros(["Urso"], exemplo().creditos) },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.avisos).toEqual([]);
    expect(r.compendio.magias).toHaveLength(3);
    expect(r.compendio.monstros?.map((m) => m.nome)).toEqual(["Aranha", "Urso"]);
    const creditos = r.compendio.creditos ?? "";
    expect(creditos).toContain("Créditos do livro A");
    expect(creditos.match(/CC-BY-4\.0/g)).toHaveLength(1);
  });

  it("nome repetido: fica o último e um aviso conta", () => {
    const a = soMonstros(["Aranha", "Urso"]);
    const b = soMonstros(["ARANHA"]);
    const gigante = { ...(b.monstros?.[0] as MonstroDoCompendio), ca: { valor: 20 } };
    b.monstros = [gigante];
    const r = juntarCompendios([
      { nome: "a.json", compendio: a },
      { nome: "b.json", compendio: b },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compendio.monstros).toHaveLength(2);
    expect(r.compendio.monstros?.find((m) => m.nome === "ARANHA")?.ca.valor).toBe(20);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toContain("a.json");
    expect(r.avisos[0]).toContain("b.json");
  });

  it("um arquivo só volta como está; o antigo, só de magias, continua valendo", () => {
    const antigo = { formato: "tabletop-compendio", versao: 1, magias: [exemplo().magias[0]] };
    const r = lerVariosCompendios([{ nome: "magias.json", texto: JSON.stringify(antigo) }]);
    expect(r).toMatchObject({ ok: true, avisos: [] });
    if (r.ok) expect(r.compendio.magias).toHaveLength(1);
  });

  it("um arquivo inválido derruba a leitura e o motivo diz qual", () => {
    const r = lerVariosCompendios([
      { nome: "magias.json", texto: TEXTO },
      { nome: "monstros.json", texto: "{ quebrado" },
    ]);
    expect(r).toEqual({ ok: false, motivo: "monstros.json: O arquivo não é um JSON válido." });
  });

  it("o total passa do limite: recusa", () => {
    const muitos = (de: number, n: number): Compendio => ({
      formato: "tabletop-compendio",
      versao: 1,
      magias: [],
      monstros: Array.from({ length: n }, (_, i) => ({
        ...monstroDoExemplo("Lobo"),
        nome: `M${de + i}`,
      })),
    });
    const r = juntarCompendios([
      { nome: "a.json", compendio: muitos(0, LIMITES_DO_COMPENDIO.monstros) },
      { nome: "b.json", compendio: muitos(LIMITES_DO_COMPENDIO.monstros, 5) },
    ]);
    expect(r.ok).toBe(false);
  });

  it("escolhe o nome canônico do arquivo pelo conteúdo", () => {
    const c = exemplo();
    expect(nomeCanonicoDoArquivo(c)).toBe("compendio.json");
    expect(nomeCanonicoDoArquivo(soMonstros(["A"]))).toBe("monstros.json");
    expect(
      nomeCanonicoDoArquivo({
        formato: "tabletop-compendio",
        versao: 1,
        magias: [],
        itensMagicos: [itemMagico()],
      }),
    ).toBe("itens.json");
    expect(
      nomeCanonicoDoArquivo({
        ...c,
        monstros: undefined,
        itensMagicos: undefined,
        armas: undefined,
        itens: undefined,
      }),
    ).toBe("magias.json");
  });
});

describe("N3a: busca e filtros", () => {
  const monstros = (): MonstroDoCompendio[] => [
    ...(exemplo().monstros ?? []),
    SERPENTE,
    {
      ...monstroDoExemplo("Lobo"),
      nome: "Urso Antigo",
      nomeOriginal: "Old Bear",
      tamanho: "Grande",
      nd: "2",
      tipo: "Fera",
    },
  ];

  it("busca por nome e nome original, sem acento nem caixa", () => {
    expect(buscarMonstros(monstros(), { texto: "GOBLIN" }).map((m) => m.nome)).toEqual(["Goblin"]);
    expect(buscarMonstros(monstros(), { texto: "old bear" }).map((m) => m.nome)).toEqual([
      "Urso Antigo",
    ]);
    expect(buscarMonstros(monstros(), { texto: "mago" })).toHaveLength(1);
  });

  it("filtra por tipo (o parêntese não conta) e por tamanho", () => {
    expect(buscarMonstros(monstros(), { tipo: "humanoide" }).map((m) => m.nome)).toEqual([
      "Goblin",
      "Mago",
    ]);
    expect(buscarMonstros(monstros(), { tipo: "Fera" }).map((m) => m.nome)).toEqual([
      "Lobo",
      "Urso Antigo",
    ]);
    expect(buscarMonstros(monstros(), { tamanho: "Grande" }).map((m) => m.nome)).toEqual([
      "Serpente de Teste",
      "Urso Antigo",
    ]);
  });

  it("filtra por faixa de ND, com as frações na ordem certa", () => {
    const nomes = (f: Parameters<typeof buscarMonstros>[1]) =>
      buscarMonstros(monstros(), f).map((m) => m.nome);
    expect(nomes({ ndDe: "1/4", ndAte: "1/4" })).toEqual(["Goblin", "Lobo"]);
    expect(nomes({ ndAte: "1/2" })).toEqual(["Goblin", "Lobo"]);
    expect(nomes({ ndDe: "1" })).toEqual(["Mago", "Serpente de Teste", "Urso Antigo"]);
    expect(nomes({ ndDe: "3", ndAte: "6" })).toEqual(["Mago", "Serpente de Teste"]);
    expect(nomes({ ndDe: "7" })).toEqual([]);
  });

  it("lista os tipos que existem", () => {
    expect(opcoesDeMonstros(monstros()).tipos).toEqual(["Celestial", "Fera", "Humanoide"]);
  });

  it("itens mágicos: nome, tipo e raridade, com as opções na ordem das raridades", () => {
    const itens = exemplo().itensMagicos ?? [];
    expect(buscarItensMagicos(itens, { texto: "anel" }).map((i) => i.nome)).toEqual([
      "Anel de Proteção",
    ]);
    expect(buscarItensMagicos(itens, { tipo: "arma" }).map((i) => i.nome)).toEqual([
      "Espada Longa +1",
    ]);
    expect(buscarItensMagicos(itens, { raridade: "raro" }).map((i) => i.nome)).toEqual([
      "Anel de Proteção",
      "Poção de Cura Superior",
    ]);
    expect(opcoesDeItensMagicos(itens).raridades).toEqual(["incomum", "raro"]);
    expect(opcoesDeItensMagicos(itens).tipos).toContain("arma");
  });

  it("resume a raridade e a sintonização", () => {
    expect(resumoDoItemMagico(itemMagico())).toBe("Raro");
    expect(
      resumoDoItemMagico(itemMagico({ sintonizacao: { necessaria: true, por: "um clérigo" } })),
    ).toBe("Raro, exige sintonização por um clérigo");
  });
});

describe("N3a: monstroParaFicha", () => {
  it("o Goblin vira uma ficha de NPC válida, com os números do livro", () => {
    const { ficha, avisos } = monstroParaFicha(monstroDoExemplo("Goblin"));
    expect(FichaSchema.safeParse(ficha).success).toBe(true);
    expect(avisos).toEqual([]);
    expect(ficha).toMatchObject({
      apresentacao: "npc",
      pvMax: 7,
      pvAtual: 7,
      ca: { valor: 15, nota: "armadura de couro, escudo" },
      alinhamento: "Neutro e mau",
      npc: { nd: "1/4", tamanho: "Pequeno", tipo: "Humanoide (goblinoide)", pvFormula: "2d6" },
      deslocamentoFt: 30,
      idiomas: ["Comum", "Goblin"],
    });
    expect(bonusDePericia(ficha, "furtividade")).toBe(6);
    expect(ficha.caracteristicas?.map((c) => c.nome)).toEqual(["Fuga Ágil"]);
    const cimitarra = ficha.ataques?.find((a) => a.nome === "Cimitarra");
    expect(cimitarra).toMatchObject({
      categoria: "acao",
      tipoDeAcao: "cac",
      dano: "1d6+2",
      tipo: "Cortante",
      alcance: "1,5 m",
    });
    expect(bonusDeAcerto(ficha, cimitarra ?? { nome: "" })).toBe(4);
  });

  it("os testes de resistência e perícias do livro viram proficiência mais bônus", () => {
    const { ficha } = monstroParaFicha(monstroDoExemplo("Mago"));
    expect(bonusDeSalvaguarda(ficha, "int")).toBe(6);
    expect(bonusDeSalvaguarda(ficha, "sab")).toBe(4);
    expect(bonusDeSalvaguarda(ficha, "for")).toBe(-1);
    expect(bonusDePericia(ficha, "arcanismo")).toBe(6);
    expect(ficha.salvaguardas?.int).toEqual({ nivel: "proficiente" });
  });

  it("ações, reações e ações lendárias ficam nas categorias e a salvaguarda leva a CD do livro", () => {
    const { ficha, avisos } = monstroParaFicha(SERPENTE);
    expect(FichaSchema.safeParse(ficha).success).toBe(true);
    const por = (c: string) => ficha.ataques?.filter((a) => a.categoria === c).map((a) => a.nome);
    expect(por("acao")).toEqual(["Mordida", "Sopro de Luz"]);
    expect(por("reacao")).toEqual(["Desviar"]);
    expect(por("lendaria")).toEqual(["Rabanada"]);
    const sopro = ficha.ataques?.find((a) => a.nome === "Sopro de Luz");
    expect(sopro).toMatchObject({ dano: "5d8", tipo: "Radiante", recarga: 5 });
    expect(cdDaRolagem(ficha, sopro ?? { nome: "" })).toBe(14);
    expect(ficha.ataques?.find((a) => a.nome === "Mordida")?.dano2).toEqual({
      dados: "2d6",
      tipo: "Veneno",
    });
    expect(ficha.notas).toContain("Ações lendárias: A serpente pode fazer 3 ações lendárias");
    expect(ficha.notas).toContain("Deslocamento: 9 m, voo 27 m");
    expect(ficha.deslocamentoFt).toBe(30);
    expect(ficha.notas).toContain("Pilhagem +3");
    expect(avisos.some((a) => a.includes("Pilhagem"))).toBe(true);
    expect(ficha.npc).toMatchObject({
      resistencias: "radiante",
      imunidades: "psíquico",
      imunidadesCondicoes: "enfeitiçado",
      sentidos: "visão cega 18 m, Percepção passiva 17",
    });
    expect(ficha.salvaguardas?.sab).toEqual({ nivel: "proficiente" });
  });

  it("a conjuração inata vira magias inatas com o contador do grupo", () => {
    const comp = exemplo();
    const { ficha, avisos } = monstroParaFicha(SERPENTE, comp.magias);
    expect(FichaSchema.safeParse(ficha).success).toBe(true);
    expect(ficha.inata).toEqual({ habilidade: "sab", cd: 15, grupo: { max: 3, gastos: 0 } });
    expect(ficha.habilidadeDeConjuracao).toBe("sab");
    const por = (n: string) => ficha.magias?.find((m) => m.nome === n);
    expect(por("Detectar Magia")).toMatchObject({ nivel: 1, inata: { frequencia: "vontade" } });
    expect(por("Bola de Fogo")).toMatchObject({
      nivel: 3,
      inata: { frequencia: "cada", max: 1 },
      salvaguarda: { alvo: "des" },
    });
    expect(por("Magia Inventada")).toMatchObject({ inata: { frequencia: "grupo", max: 1 } });
    expect(avisos.some((a) => a.includes("Magia Inventada"))).toBe(true);
    // O cálculo da CD usa a habilidade do monstro (Sabedoria).
    expect(ficha.espacosTotal).toBeUndefined();
  });

  it("a conjuração por espaços vira os espaços da ficha e as magias nos círculos", () => {
    const comp = exemplo();
    const mago = monstroDoExemplo("Mago");
    const { ficha, avisos } = monstroParaFicha(mago, comp.magias);
    expect(espacosDaFicha(ficha).map((e) => e.total)).toEqual([4, 3, 3, 3, 1]);
    const bola = ficha.magias?.find((m) => m.nome === "Bola de Fogo");
    expect(bola).toMatchObject({ nivel: 3, salvaguarda: { alvo: "des", cdAtributo: "int" } });
    expect(ficha.magias).toHaveLength(16);
    expect(avisos.some((a) => a.includes("Cone de Frio"))).toBe(true);
    expect(ficha.habilidadeDeConjuracao).toBe("int");
  });

  it("acha no compêndio as magias que o monstro cita", () => {
    const comp = exemplo();
    expect(
      magiasDoMonstro(monstroDoExemplo("Mago"), comp.magias)
        .map((m) => m.nome)
        .sort(),
    ).toEqual(["Bola de Fogo", "Detectar Magia", "Mísseis Mágicos"]);
    expect(magiasDoMonstro(monstroDoExemplo("Goblin"), comp.magias)).toEqual([]);
  });

  it("o personagem do monstro é válido e o token acompanha o tamanho", () => {
    const { personagem } = personagemDoMonstro(SERPENTE, { id: "pers-1", pastaId: "p" });
    expect(PersonagemSchema.safeParse(personagem).success).toBe(true);
    expect(personagem.tokenPadrao.tamanhoQuadrados).toBe(2);
    expect(personagem.editores).toEqual({ tipo: "jogadores", ids: [] });
    expect(tamanhoDoTokenDoMonstro({ tamanho: "Enorme" })).toBe(3);
    expect(tamanhoDoTokenDoMonstro({ tamanho: "Imenso" })).toBe(4);
    expect(tamanhoDoTokenDoMonstro({ tamanho: "Miúdo" })).toBe(1);
    expect(tamanhoDoTokenDoMonstro({ tamanho: "Médio ou Pequeno" })).toBe(1);
  });

  it("soltar um monstro numa ficha existente é recusado com a dica de Criar NPC", () => {
    const r = aplicarEntradaNaFicha(
      fichaNova(10),
      { tipo: "monstro", monstro: monstroDoExemplo("Lobo") },
      "npc",
    );
    expect(r.ok).toBe(false);
  });
});

describe("N3a: o item mágico na ficha", () => {
  const aplicar = (
    item: ItemMagicoDoCompendio,
    modo: "personagem" | "npc",
    ficha = fichaNova(10),
  ) => {
    const r = aplicarEntradaNaFicha(ficha, { tipo: "itemMagico", itemMagico: item }, modo);
    if (!r.ok) throw new Error(r.motivo);
    const aplicada = aplicarOperacoes(ficha, r.operacoes);
    if (!aplicada.ok) throw new Error(aplicada.motivo);
    return { ficha: aplicada.ficha, texto: r.texto };
  };

  it("vai para o equipamento com a descrição, a raridade e a sintonização na nota", () => {
    const { ficha } = aplicar(
      itemMagico({ sintonizacao: { necessaria: true, por: "um mago" }, peso: 0.1 }),
      "personagem",
    );
    expect(ficha.itens).toHaveLength(1);
    expect(ficha.itens?.[0]).toMatchObject({ nome: "Anel de Teste", quantidade: 1, peso: 0.1 });
    expect(ficha.itens?.[0]?.nota).toContain("Raro, exige sintonização por um mago");
    expect(ficha.itens?.[0]?.nota).toContain("Um anel de teste.");
    expect(FichaSchema.safeParse(ficha).success).toBe(true);
  });

  it("uma descrição longa cabe na nota (até 4000 caracteres)", () => {
    const { ficha } = aplicar(itemMagico({ descricao: "d".repeat(12_000) }), "personagem");
    expect((ficha.itens?.[0]?.nota ?? "").length).toBe(4000);
    expect(FichaSchema.safeParse(ficha).success).toBe(true);
  });

  it("repetir soma uma unidade", () => {
    const um = aplicar(itemMagico(), "personagem").ficha;
    const dois = aplicar(itemMagico(), "personagem", um).ficha;
    expect(dois.itens).toHaveLength(1);
    expect(dois.itens?.[0]?.quantidade).toBe(2);
  });

  it("a arma mágica com bônus vira ataque com o bônus mágico", () => {
    const espada = exemplo().itensMagicos?.find((i) => i.nome === "Espada Longa +1");
    if (!espada) throw new Error("sem espada");
    const base = { ...fichaNova(10), atributos: { for: 16, des: 10 } };
    const { ficha } = aplicar(espada, "personagem", base);
    expect(ficha.itens?.[0]?.nome).toBe("Espada Longa +1");
    const ataque = ficha.ataques?.[0];
    expect(ataque).toMatchObject({ nome: "Espada Longa +1", bonusMagico: 1, dano: "1d8" });
    // For 16 (+3), proficiência +2, bônus mágico +1.
    expect(bonusDeAcerto(ficha, ataque ?? { nome: "" })).toBe(6);
  });

  it("no NPC vira um traço (e uma ação, se é arma)", () => {
    const espada = exemplo().itensMagicos?.find((i) => i.nome === "Espada Longa +1");
    if (!espada) throw new Error("sem espada");
    const { ficha } = aplicar(espada, "npc", { ...fichaNova(10), apresentacao: "npc" });
    expect(ficha.caracteristicas?.[0]?.nome).toBe("Espada Longa +1");
    expect(ficha.ataques?.[0]).toMatchObject({ categoria: "acao", bonusMagico: 1 });
  });
});

describe("N3a: a lista de níveis de desafio", () => {
  it("vai de 0 e das frações até 30, na ordem, e cobre a tabela de XP", () => {
    expect(NIVEIS_DE_DESAFIO.slice(0, 6)).toEqual(["0", "1/8", "1/4", "1/2", "1", "2"]);
    expect(NIVEIS_DE_DESAFIO.at(-1)).toBe("30");
    expect([...NIVEIS_DE_DESAFIO].sort()).toEqual(Object.keys(XP_POR_ND).sort());
  });
});
