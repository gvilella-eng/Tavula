// Tradução dos nomes em inglês (e das siglas) que a ficha impressa traz na ficha para o texto em português da
// Távola. Tabelas pequenas e puras. Nome que não está na tabela fica como veio (assumido).

function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[\s_]+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

const RACAS: Record<string, string> = {
  "standard human": "Humano",
  human: "Humano",
  "variant human": "Humano (variante)",
  dwarf: "Anão",
  "hill dwarf": "Anão da colina",
  "mountain dwarf": "Anão da montanha",
  elf: "Elfo",
  "high elf": "Alto elfo",
  "wood elf": "Elfo da floresta",
  "dark elf": "Drow",
  drow: "Drow",
  halfling: "Halfling",
  "lightfoot halfling": "Halfling pés-leves",
  "stout halfling": "Halfling robusto",
  dragonborn: "Draconato",
  gnome: "Gnomo",
  "forest gnome": "Gnomo da floresta",
  "rock gnome": "Gnomo das rochas",
  "half-elf": "Meio-elfo",
  "half elf": "Meio-elfo",
  "half-orc": "Meio-orc",
  "half orc": "Meio-orc",
  tiefling: "Tiefling",
};

/** "Standard Human" vira "Humano"; nome desconhecido (ou já em português) volta como veio. */
export function racaEmPortugues(nome: string): string {
  return RACAS[chave(nome)] ?? nome;
}

const ANTECEDENTES: Record<string, string> = {
  acolyte: "Acólito",
};

/** O antecedente do SRD em inglês ("Acolyte") em português; o resto volta como veio. */
export function antecedenteEmPortugues(nome: string): string {
  return ANTECEDENTES[chave(nome)] ?? nome;
}

const ESPECIE: Record<string, string> = { l: "Leal", n: "Neutro", c: "Caótico" };
const MORAL: Record<string, string> = { b: "Bom", g: "Bom", n: "Neutro", m: "Mau", e: "Mau" };

const POR_EXTENSO: Record<string, string> = {
  lawful: "Leal",
  neutral: "Neutro",
  chaotic: "Caótico",
  good: "Bom",
  evil: "Mau",
};

/**
 * Tendência da ficha impressa em português por extenso: "LB" e "LG" viram "Leal e Bom", "CN" vira "Caótico e
 * Neutro", "N" e "True Neutral" viram "Neutro"; "Lawful Good" vira "Leal e Bom". Texto que não é sigla nem
 * nome em inglês (por exemplo "Caótico Mau") volta como veio.
 */
export function tendenciaEmPortugues(texto: string): string {
  const t = chave(texto).replace(/\./g, "");
  if (t === "n" || t === "neutral" || t === "true neutral") return "Neutro";
  const sigla = /^([lnc])([bgnme])$/.exec(t);
  if (sigla) return `${ESPECIE[sigla[1] as string]} e ${MORAL[sigla[2] as string]}`;
  const partes = t.split(" ");
  const [a, b] = partes;
  if (partes.length === 2 && a && b && POR_EXTENSO[a] && POR_EXTENSO[b])
    return `${POR_EXTENSO[a]} e ${POR_EXTENSO[b]}`;
  return texto;
}

const IDIOMAS: Record<string, string> = {
  common: "Comum",
  dwarvish: "Anão",
  elvish: "Élfico",
  giant: "Gigante",
  gnomish: "Gnômico",
  goblin: "Goblin",
  halfling: "Halfling",
  orc: "Orc",
  abyssal: "Abissal",
  celestial: "Celestial",
  draconic: "Dracônico",
  "deep speech": "Idioma Profundo",
  infernal: "Infernal",
  primordial: "Primordial",
  sylvan: "Silvestre",
  undercommon: "Subcomum",
};

/** O idioma do SRD em inglês ("Common") em português ("Comum"); o resto volta como veio. */
export function idiomaEmPortugues(nome: string): string {
  return IDIOMAS[chave(nome)] ?? nome;
}
