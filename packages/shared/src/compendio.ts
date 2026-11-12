import { z } from "zod";
import { HashSchema, LIMITES_DE_ASSET } from "./assets.ts";
import type { Magia } from "./ficha.ts";

// ---------------------------------------------------------------------------------------------
// Compêndio de magias (Lote 14, PROJETO.md 4.13.1)
//
// O compêndio é um arquivo JSON que o mestre mantém na pasta local dele (`compendio/magias.json`).
// O servidor nunca o guarda: o navegador do mestre valida, registra como asset `compendio` (só a meta
// vai para a sala) e os jogadores baixam pelos pedaços, como as imagens. Aqui moram o formato, a
// leitura com os limites, a busca e os filtros (tudo puro e testado).
// ---------------------------------------------------------------------------------------------

export const FORMATO_DO_COMPENDIO = "tabletop-compendio";
export const VERSAO_DO_COMPENDIO = 1 as const;
/** Nome do arquivo e da pasta onde o mestre o coloca. */
export const CAMINHO_DO_COMPENDIO = ["compendio", "magias.json"] as const;

export const LIMITES_DO_COMPENDIO = {
  /** Tamanho do arquivo, em bytes (UTF-8). Cabe num punhado de pedaços de 256 KB. */
  bytes: LIMITES_DE_ASSET.bytesDoCompendio,
  magias: 2000,
  armas: 500,
  itens: 2000,
  nome: 80,
  escola: 32,
  tempo: 100,
  alcance: 100,
  componentes: 300,
  duracao: 100,
  classes: 20,
  classe: 40,
  descricao: 12_000,
  emNiveisSuperiores: 4_000,
  creditos: 2_000,
} as const;

export const ESCOLAS_DO_5E = [
  "Abjuração",
  "Adivinhação",
  "Conjuração",
  "Encantamento",
  "Evocação",
  "Ilusão",
  "Necromancia",
  "Transmutação",
] as const;

const Linha = (max: number) => z.string().trim().min(1).max(max);

export const MagiaDoCompendioSchema = z.object({
  nome: Linha(LIMITES_DO_COMPENDIO.nome),
  /** O nome em inglês (ou como aparece no livro de origem), para a busca. */
  nomeOriginal: Linha(LIMITES_DO_COMPENDIO.nome).optional(),
  /** 0 = truque. */
  nivel: z.number().int().min(0).max(9),
  escola: Linha(LIMITES_DO_COMPENDIO.escola),
  tempo: Linha(LIMITES_DO_COMPENDIO.tempo),
  alcance: Linha(LIMITES_DO_COMPENDIO.alcance),
  componentes: Linha(LIMITES_DO_COMPENDIO.componentes),
  duracao: Linha(LIMITES_DO_COMPENDIO.duracao),
  concentracao: z.boolean(),
  ritual: z.boolean(),
  classes: z.array(Linha(LIMITES_DO_COMPENDIO.classe)).max(LIMITES_DO_COMPENDIO.classes),
  descricao: z.string().trim().min(1).max(LIMITES_DO_COMPENDIO.descricao),
  emNiveisSuperiores: z
    .string()
    .trim()
    .min(1)
    .max(LIMITES_DO_COMPENDIO.emNiveisSuperiores)
    .optional(),
});
export type MagiaDoCompendio = z.infer<typeof MagiaDoCompendioSchema>;

/** Uma arma do compêndio (V4b): vira um ataque já calculado na ficha. Campo novo e opcional no arquivo. */
export const ArmaDoCompendioSchema = z.object({
  nome: Linha(LIMITES_DO_COMPENDIO.nome),
  nomeOriginal: Linha(LIMITES_DO_COMPENDIO.nome).optional(),
  categoria: z.enum(["simples", "marcial"]),
  /** Arma de ataque à distância (arco, besta). Arma de corpo a corpo com "arremesso" também vale à distância. */
  distancia: z.boolean(),
  /** Os dados do dano, sem o modificador: "1d8". */
  dano: z.string().trim().min(1).max(40),
  tipoDeDano: Linha(32),
  /** "leve", "acuidade", "arremesso (6/18 m)", "versátil (1d10)"... */
  propriedades: z.array(Linha(60)).max(12),
  alcance: Linha(60).optional(),
  /** Em quilos. */
  peso: z.number().min(0).max(99_999).optional(),
  custo: Linha(40).optional(),
});
export type ArmaDoCompendio = z.infer<typeof ArmaDoCompendioSchema>;

/** Um item do compêndio (V4b): vai para o Equipamento da ficha (ou vira um traço no bloco de NPC). */
export const ItemDoCompendioSchema = z.object({
  nome: Linha(LIMITES_DO_COMPENDIO.nome),
  nomeOriginal: Linha(LIMITES_DO_COMPENDIO.nome).optional(),
  descricao: z.string().trim().min(1).max(4000).optional(),
  peso: z.number().min(0).max(99_999).optional(),
  custo: Linha(40).optional(),
});
export type ItemDoCompendio = z.infer<typeof ItemDoCompendioSchema>;

export const CompendioSchema = z.object({
  formato: z.literal(FORMATO_DO_COMPENDIO),
  versao: z.literal(VERSAO_DO_COMPENDIO),
  /** Atribuição exigida pela licença do conteúdo (ex.: CC-BY-4.0 do SRD 5.1). Só é mostrada. */
  creditos: z.string().trim().min(1).max(LIMITES_DO_COMPENDIO.creditos).optional(),
  magias: z.array(MagiaDoCompendioSchema).max(LIMITES_DO_COMPENDIO.magias),
  /** V4b: armas e itens, opcionais (o arquivo antigo, só de magias, continua valendo). */
  armas: z.array(ArmaDoCompendioSchema).max(LIMITES_DO_COMPENDIO.armas).optional(),
  itens: z.array(ItemDoCompendioSchema).max(LIMITES_DO_COMPENDIO.itens).optional(),
});
export type Compendio = z.infer<typeof CompendioSchema>;

/**
 * O compêndio da mesa, como a sala o conhece (`Estado.compendio`): só a referência ao asset. O texto
 * das magias nunca está aqui.
 */
export const CompendioDaMesaSchema = z.object({
  hash: HashSchema,
  nomeOriginal: z.string().min(1).max(200),
  magias: z.number().int().min(0).max(LIMITES_DO_COMPENDIO.magias),
});
export type CompendioDaMesa = z.infer<typeof CompendioDaMesaSchema>;

// ---------------------------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------------------------

/** Texto de um campo do zod: `magias.3.nivel`, com o número como a pessoa conta (a partir de 1). */
function caminhoLegivel(caminho: readonly PropertyKey[]): string {
  const partes = caminho.map(String);
  const rotulo = ({ magias: "magia", armas: "arma", itens: "item" } as Record<string, string>)[
    partes[0] ?? ""
  ];
  if (rotulo && partes[1] !== undefined && /^\d+$/.test(partes[1])) {
    return `${rotulo} ${Number(partes[1]) + 1}${partes.length > 2 ? `, campo ${partes.slice(2).join(".")}` : ""}`;
  }
  return partes.join(".") || "arquivo";
}

const TIPO_EM_PORTUGUES: Record<string, string> = {
  string: "um texto",
  number: "um número",
  int: "um número inteiro",
  boolean: "verdadeiro ou falso",
  array: "uma lista",
  object: "um objeto",
};

type Problema = {
  code: string;
  message: string;
  origin?: string;
  maximum?: number | bigint;
  minimum?: number | bigint;
  expected?: string;
  values?: readonly unknown[];
};

/** O problema do zod em português, para o mestre achar o erro no arquivo. */
function problemaEmPortugues(p: Problema): string {
  const max = Number(p.maximum);
  const min = Number(p.minimum);
  if (p.code === "too_big") {
    if (p.origin === "string") return `passa de ${max} caracteres`;
    if (p.origin === "array") return `tem itens demais (no máximo ${max})`;
    return `precisa ser no máximo ${max}`;
  }
  if (p.code === "too_small") {
    if (p.origin === "string")
      return min <= 1 ? "não pode ficar vazio" : `precisa ter ao menos ${min} caracteres`;
    if (p.origin === "array") return `precisa ter ao menos ${min} itens`;
    return `precisa ser no mínimo ${min}`;
  }
  if (p.code === "invalid_type") {
    if (/received undefined/.test(p.message)) return "campo obrigatório";
    return `precisa ser ${TIPO_EM_PORTUGUES[p.expected ?? ""] ?? p.expected ?? "de outro tipo"}`;
  }
  if (p.code === "invalid_value" && p.values) {
    return `valor inesperado (o esperado é ${p.values.map((v) => JSON.stringify(v)).join(" ou ")})`;
  }
  return p.message;
}

function bytesUtf8(texto: string): number {
  let bytes = 0;
  for (const ch of texto) {
    const c = ch.codePointAt(0) ?? 0;
    bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export type LeituraDoCompendio = { ok: true; compendio: Compendio } | { ok: false; motivo: string };

/**
 * Valida o texto de um `magias.json`: tamanho, JSON, formato, limites por campo e nomes repetidos. O
 * motivo diz o campo (ex.: "magia 3, campo nivel: ...") para o mestre achar o erro no arquivo.
 */
export function lerCompendio(texto: string): LeituraDoCompendio {
  if (bytesUtf8(texto) > LIMITES_DO_COMPENDIO.bytes) {
    return {
      ok: false,
      motivo: `O arquivo passa de ${LIMITES_DO_COMPENDIO.bytes / (1024 * 1024)} MB.`,
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(texto.replace(/^﻿/, ""));
  } catch {
    return { ok: false, motivo: "O arquivo não é um JSON válido." };
  }
  const lido = CompendioSchema.safeParse(json);
  if (!lido.success) {
    const problema = lido.error.issues[0];
    return {
      ok: false,
      motivo: `${caminhoLegivel(problema?.path ?? [])}: ${problema ? problemaEmPortugues(problema as Problema) : "inválido"}`,
    };
  }
  const vistos = new Map<string, number>();
  for (const [i, m] of lido.data.magias.entries()) {
    const chave = normalizarBusca(m.nome);
    const antes = vistos.get(chave);
    if (antes !== undefined) {
      return {
        ok: false,
        motivo: `magia ${i + 1}, campo nome: "${m.nome}" já aparece na magia ${antes + 1}.`,
      };
    }
    vistos.set(chave, i);
  }
  return { ok: true, compendio: lido.data };
}

// ---------------------------------------------------------------------------------------------
// Busca e filtros
// ---------------------------------------------------------------------------------------------

/** Sem acento e sem caixa (a mesma normalização do chat). */
export function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export type FiltroDeMagias = {
  /** Cada palavra precisa aparecer no nome ou no nome original. */
  texto?: string | undefined;
  nivel?: number | undefined;
  escola?: string | undefined;
  classe?: string | undefined;
  concentracao?: boolean | undefined;
  ritual?: boolean | undefined;
};

/** As magias que passam pelos filtros, em ordem alfabética (sem acento nem caixa). */
export function buscarMagias(
  magias: readonly MagiaDoCompendio[],
  filtro: FiltroDeMagias = {},
): MagiaDoCompendio[] {
  const palavras = normalizarBusca(filtro.texto ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const escola = filtro.escola === undefined ? undefined : normalizarBusca(filtro.escola);
  const classe = filtro.classe === undefined ? undefined : normalizarBusca(filtro.classe);
  const passa = (m: MagiaDoCompendio): boolean => {
    if (filtro.nivel !== undefined && m.nivel !== filtro.nivel) return false;
    if (escola !== undefined && normalizarBusca(m.escola) !== escola) return false;
    if (classe !== undefined && !m.classes.some((c) => normalizarBusca(c) === classe)) return false;
    if (filtro.concentracao !== undefined && m.concentracao !== filtro.concentracao) return false;
    if (filtro.ritual !== undefined && m.ritual !== filtro.ritual) return false;
    if (palavras.length > 0) {
      const alvo = `${normalizarBusca(m.nome)} ${normalizarBusca(m.nomeOriginal ?? "")}`;
      if (!palavras.every((p) => alvo.includes(p))) return false;
    }
    return true;
  };
  return magias
    .filter(passa)
    .sort(
      (a, b) =>
        normalizarBusca(a.nome).localeCompare(normalizarBusca(b.nome), "pt-BR") ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

/** Os valores de escola e de classe que existem no compêndio, para montar os filtros. */
export function opcoesDeFiltro(magias: readonly MagiaDoCompendio[]): {
  escolas: string[];
  classes: string[];
} {
  const escolas = new Map<string, string>();
  const classes = new Map<string, string>();
  for (const m of magias) {
    escolas.set(normalizarBusca(m.escola), m.escola);
    for (const c of m.classes) classes.set(normalizarBusca(c), c);
  }
  const ordenar = (mapa: Map<string, string>) =>
    [...mapa.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { escolas: ordenar(escolas), classes: ordenar(classes) };
}

// ---------------------------------------------------------------------------------------------
// Para a ficha
// ---------------------------------------------------------------------------------------------

export const ROTULO_DO_NIVEL_DE_MAGIA = (nivel: number): string =>
  nivel === 0 ? "Truque" : `${nivel}º nível`;

/** A descrição que entra na ficha: os campos da magia e depois o texto (a ficha só tem um campo de texto). */
export function descricaoParaFicha(m: MagiaDoCompendio): string {
  const cabecalho = [
    `Tempo de conjuração: ${m.tempo}`,
    `Alcance: ${m.alcance}`,
    `Componentes: ${m.componentes}`,
    `Duração: ${m.duracao}`,
  ];
  const marcas = [m.concentracao ? "Concentração" : "", m.ritual ? "Ritual" : ""].filter(Boolean);
  if (marcas.length > 0) cabecalho.push(marcas.join(" · "));
  const partes = [cabecalho.join("\n"), m.descricao];
  if (m.emNiveisSuperiores) partes.push(`Em níveis superiores: ${m.emNiveisSuperiores}`);
  return partes.join("\n\n");
}

/** A magia como a lista de magias da ficha a guarda (preparada, com nível, escola e a descrição montada). */
export function magiaParaFicha(m: MagiaDoCompendio): Magia {
  return {
    nome: m.nome,
    nivel: m.nivel,
    preparada: true,
    escola: m.escola,
    descricao: descricaoParaFicha(m),
  };
}

/** A lista de magias da ficha já tem uma com este nome (sem acento nem caixa)? */
export function fichaTemMagia(magias: readonly Pick<Magia, "nome">[], nome: string): boolean {
  const alvo = normalizarBusca(nome);
  return magias.some((m) => normalizarBusca(m.nome) === alvo);
}
