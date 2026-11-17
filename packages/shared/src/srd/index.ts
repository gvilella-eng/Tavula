// Dados mínimos do SRD 5.1 (regras de 2014) que as contas da ficha precisam. Sem texto de magia nem de
// característica: isso é do compêndio (Lote 14). Atribuição CC-BY-4.0 em `ATRIBUICAO-SRD.md`.

export const ATRIBUTOS = ["for", "des", "con", "int", "sab", "car"] as const;
export type Atributo = (typeof ATRIBUTOS)[number];

export const ROTULO_DO_ATRIBUTO: Record<Atributo, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
};

/** Sigla de três letras em maiúsculas (a ficha impressa usa FOR, DES...). */
export const SIGLA_DO_ATRIBUTO: Record<Atributo, string> = {
  for: "FOR",
  des: "DES",
  con: "CON",
  int: "INT",
  sab: "SAB",
  car: "CAR",
};

export type PericiaSrd = { id: string; nome: string; atributo: Atributo };

/** As 18 perícias, em ordem alfabética pt-BR (a ordem da ficha). */
export const PERICIAS = [
  { id: "acrobacia", nome: "Acrobacia", atributo: "des" },
  { id: "adestrarAnimais", nome: "Adestrar Animais", atributo: "sab" },
  { id: "arcanismo", nome: "Arcanismo", atributo: "int" },
  { id: "atletismo", nome: "Atletismo", atributo: "for" },
  { id: "atuacao", nome: "Atuação", atributo: "car" },
  { id: "enganacao", nome: "Enganação", atributo: "car" },
  { id: "furtividade", nome: "Furtividade", atributo: "des" },
  { id: "historia", nome: "História", atributo: "int" },
  { id: "intimidacao", nome: "Intimidação", atributo: "car" },
  { id: "intuicao", nome: "Intuição", atributo: "sab" },
  { id: "investigacao", nome: "Investigação", atributo: "int" },
  { id: "medicina", nome: "Medicina", atributo: "sab" },
  { id: "natureza", nome: "Natureza", atributo: "int" },
  { id: "percepcao", nome: "Percepção", atributo: "sab" },
  { id: "persuasao", nome: "Persuasão", atributo: "car" },
  { id: "prestidigitacao", nome: "Prestidigitação", atributo: "des" },
  { id: "religiao", nome: "Religião", atributo: "int" },
  { id: "sobrevivencia", nome: "Sobrevivência", atributo: "sab" },
] as const satisfies readonly PericiaSrd[];

export type IdDePericia = (typeof PERICIAS)[number]["id"];
export const IDS_DE_PERICIA = PERICIAS.map((p) => p.id) as [IdDePericia, ...IdDePericia[]];

/**
 * Como a classe conjura: `completo` (Bardo, Clérigo, Druida, Feiticeiro, Mago), `meio` (Paladino,
 * Patrulheiro), `pacto` (Bruxo: espaços à parte), `nenhum`. As subclasses de terço (Cavaleiro Místico e
 * Trapaceiro Arcano) são reconhecidas pela subclasse (ver `SUBCLASSES_DE_TERCO`).
 */
export type TipoDeConjurador = "completo" | "meio" | "terco" | "pacto" | "nenhum";

export type ClasseSrd = {
  id: string;
  nome: string;
  /** Nome em inglês e outras grafias aceitas (comparadas sem acento nem maiúsculas). */
  apelidos: readonly string[];
  /** Faces do dado de vida. */
  dadoDeVida: 6 | 8 | 10 | 12;
  salvaguardas: readonly [Atributo, Atributo];
  conjurador: TipoDeConjurador;
  /** Habilidade de conjuração padrão. */
  habilidade?: Atributo;
};

export const CLASSES: readonly ClasseSrd[] = [
  {
    id: "barbaro",
    nome: "Bárbaro",
    apelidos: ["barbarian"],
    dadoDeVida: 12,
    salvaguardas: ["for", "con"],
    conjurador: "nenhum",
  },
  {
    id: "bardo",
    nome: "Bardo",
    apelidos: ["bard"],
    dadoDeVida: 8,
    salvaguardas: ["des", "car"],
    conjurador: "completo",
    habilidade: "car",
  },
  {
    id: "clerigo",
    nome: "Clérigo",
    apelidos: ["cleric"],
    dadoDeVida: 8,
    salvaguardas: ["sab", "car"],
    conjurador: "completo",
    habilidade: "sab",
  },
  {
    id: "druida",
    nome: "Druida",
    apelidos: ["druid"],
    dadoDeVida: 8,
    salvaguardas: ["int", "sab"],
    conjurador: "completo",
    habilidade: "sab",
  },
  {
    id: "guerreiro",
    nome: "Guerreiro",
    apelidos: ["fighter"],
    dadoDeVida: 10,
    salvaguardas: ["for", "con"],
    conjurador: "nenhum",
  },
  {
    id: "monge",
    nome: "Monge",
    apelidos: ["monk"],
    dadoDeVida: 8,
    salvaguardas: ["for", "des"],
    conjurador: "nenhum",
  },
  {
    id: "paladino",
    nome: "Paladino",
    apelidos: ["paladin"],
    dadoDeVida: 10,
    salvaguardas: ["sab", "car"],
    conjurador: "meio",
    habilidade: "car",
  },
  {
    id: "patrulheiro",
    nome: "Patrulheiro",
    apelidos: ["ranger", "hunter ranger", "guardiao"],
    dadoDeVida: 10,
    salvaguardas: ["for", "des"],
    conjurador: "meio",
    habilidade: "sab",
  },
  {
    id: "ladino",
    nome: "Ladino",
    apelidos: ["rogue"],
    dadoDeVida: 8,
    salvaguardas: ["des", "int"],
    conjurador: "nenhum",
  },
  {
    id: "feiticeiro",
    nome: "Feiticeiro",
    apelidos: ["sorcerer"],
    dadoDeVida: 6,
    salvaguardas: ["con", "car"],
    conjurador: "completo",
    habilidade: "car",
  },
  {
    id: "bruxo",
    nome: "Bruxo",
    apelidos: ["warlock"],
    dadoDeVida: 8,
    salvaguardas: ["sab", "car"],
    conjurador: "pacto",
    habilidade: "car",
  },
  {
    id: "mago",
    nome: "Mago",
    apelidos: ["wizard"],
    dadoDeVida: 6,
    salvaguardas: ["int", "sab"],
    conjurador: "completo",
    habilidade: "int",
  },
];

/** Subclasses de terço de conjurador (fora do SRD, mas a tabela de multiclasse do PHB as cobre). */
export const SUBCLASSES_DE_TERCO: readonly { classe: string; apelidos: readonly string[] }[] = [
  { classe: "guerreiro", apelidos: ["cavaleiro mistico", "eldritch knight"] },
  { classe: "ladino", apelidos: ["trapaceiro arcano", "arcane trickster"] },
];

export function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

let CLASSES_POR_CHAVE: Map<string, ClasseSrd> | null = null;

/** A classe do SRD pelo nome (pt-BR ou inglês, sem acento nem maiúsculas); `undefined` se não houver. */
export function classeSrd(nome: string): ClasseSrd | undefined {
  // Um Map das chaves (nome sem acento, id, apelidos sem acento) montado uma vez: a `derivar` da ficha chama isto várias
  // vezes e antes normalizava todas as classes a cada chamada. Primeira classe que tem a chave vence, como no `find`.
  if (CLASSES_POR_CHAVE === null) {
    const mapa = new Map<string, ClasseSrd>();
    for (const c of CLASSES) {
      for (const chave of [semAcento(c.nome), c.id, ...c.apelidos.map(semAcento)]) {
        if (!mapa.has(chave)) mapa.set(chave, c);
      }
    }
    CLASSES_POR_CHAVE = mapa;
  }
  return CLASSES_POR_CHAVE.get(semAcento(nome));
}

/** Espaços de magia de um conjurador de nível 1 a 20 (tabela de multiclasse do PHB 2014): [1º ... 9º]. */
export const ESPACOS_POR_NIVEL_DE_CONJURADOR: readonly (readonly number[])[] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Espaços de pacto do Bruxo por nível de Bruxo (1 a 20): quantidade e nível do espaço. */
export const PACTO_DO_BRUXO: readonly { quantidade: number; nivel: number }[] = [
  { quantidade: 1, nivel: 1 },
  { quantidade: 2, nivel: 1 },
  { quantidade: 2, nivel: 2 },
  { quantidade: 2, nivel: 2 },
  { quantidade: 2, nivel: 3 },
  { quantidade: 2, nivel: 3 },
  { quantidade: 2, nivel: 4 },
  { quantidade: 2, nivel: 4 },
  { quantidade: 2, nivel: 5 },
  { quantidade: 2, nivel: 5 },
  { quantidade: 3, nivel: 5 },
  { quantidade: 3, nivel: 5 },
  { quantidade: 3, nivel: 5 },
  { quantidade: 3, nivel: 5 },
  { quantidade: 3, nivel: 5 },
  { quantidade: 3, nivel: 5 },
  { quantidade: 4, nivel: 5 },
  { quantidade: 4, nivel: 5 },
  { quantidade: 4, nivel: 5 },
  { quantidade: 4, nivel: 5 },
];
