import { z } from "zod";
import { HashSchema, LIMITES_DE_ASSET } from "./assets.ts";
import {
  dadosPorNivelDoTexto,
  lerPorNivelAcima,
  porNivelAcimaDoTexto,
  quantidadeBaseDoTexto,
} from "./conjuracao.ts";
import { type Magia, NIVEIS_DE_DESAFIO, TIPOS_DE_ACAO } from "./ficha.ts";
import { ATRIBUTOS } from "./srd/index.ts";

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
/**
 * N3a: a pasta `compendio/` pode ter vários arquivos; a mesa lê os que existirem e os junta (`juntarCompendios`). O
 * último da lista vence um nome repetido. `compendio.json` é o "arquivo único com tudo".
 */
export const PASTA_DO_COMPENDIO = "compendio";
export const ARQUIVOS_DO_COMPENDIO = [
  "compendio.json",
  "magias.json",
  "monstros.json",
  "itens.json",
] as const;

export const LIMITES_DO_COMPENDIO = {
  /** Tamanho do arquivo, em bytes (UTF-8). Cabe num punhado de pedaços de 256 KB. */
  bytes: LIMITES_DE_ASSET.bytesDoCompendio,
  // N3a: cabem os livros (cada tipo, uns mil; o limite é folgado) e o arquivo da mesa tem até 16 MB.
  magias: 2000,
  armas: 1000,
  itens: 2000,
  monstros: 2000,
  itensMagicos: 2000,
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
  creditos: 4_000,
  tipoDeMonstro: 60,
  texto: 20_000,
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

// ---------------------------------------------------------------------------------------------
// Monstros e itens mágicos (N3a)
// ---------------------------------------------------------------------------------------------

export const TAMANHOS_DE_MONSTRO = [
  "Miúdo",
  "Pequeno",
  "Médio",
  "Grande",
  "Enorme",
  "Imenso",
] as const;

const Inteiro = (min: number, max: number) => z.number().int().min(min).max(max);
const AtributoDoMonstro = z.enum(ATRIBUTOS);

/** Um traço (habilidade passiva) do monstro: nome e texto. */
export const TracoDoMonstroSchema = z.object({
  nome: Linha(LIMITES_DO_COMPENDIO.nome),
  texto: z.string().trim().min(1).max(LIMITES_DO_COMPENDIO.texto),
});
export type TracoDoMonstro = z.infer<typeof TracoDoMonstroSchema>;

/**
 * Uma ação, reação ou ação lendária: nome e texto, mais (quando der) os números que a ficha usa para rolar: bônus de
 * acerto, alcance, dano e tipo, ou a salvaguarda do alvo. Sem eles a linha vira só texto na ficha.
 */
export const AcaoDoMonstroSchema = TracoDoMonstroSchema.extend({
  /** O chip da ação: corpo a corpo, à distância, os dois, magia ou especial. */
  tipo: z.enum(TIPOS_DE_ACAO).optional(),
  /** Bônus de acerto total ("+5" no livro: 5). */
  acerto: Inteiro(-10, 40).optional(),
  alcance: Linha(100).optional(),
  /** O dano como o livro o escreve, sem a média: "1d8+4". */
  dano: Linha(100).optional(),
  tipoDeDano: Linha(32).optional(),
  dano2: z.object({ dano: Linha(100), tipoDeDano: Linha(32).optional() }).optional(),
  /** A salvaguarda que o alvo faz (sopro, gaze, veneno): o atributo, a CD e o que o sucesso faz. */
  salvaguarda: z
    .object({
      atributo: AtributoDoMonstro,
      cd: Inteiro(1, 40),
      sucesso: z.enum(["metade", "nenhum"]).optional(),
    })
    .optional(),
  /** "Recarga 5–6": recarrega com este resultado do d6 ou mais. */
  recarga: Inteiro(2, 6).optional(),
  /** Usos por dia. */
  usos: Inteiro(1, 20).optional(),
});
export type AcaoDoMonstro = z.infer<typeof AcaoDoMonstroSchema>;

const MagiaDoMonstro = z.object({ nome: Linha(LIMITES_DO_COMPENDIO.nome) });

/** A Conjuração inata do bloco: "à vontade", "N/dia cada" ou "N/dia" (um contador para o grupo). */
export const ConjuracaoInataDoMonstroSchema = z.object({
  habilidade: AtributoDoMonstro.optional(),
  cd: Inteiro(0, 40).optional(),
  /** O contador do grupo "N/dia" (as magias com `frequencia: "grupo"` gastam dele). */
  grupoMax: Inteiro(1, 20).optional(),
  magias: z
    .array(
      MagiaDoMonstro.extend({
        frequencia: z.enum(["vontade", "cada", "grupo"]),
        /** `cada`: quantos usos por dia de cada uma. */
        max: Inteiro(1, 20).optional(),
      }),
    )
    .max(40),
});

/** A Conjuração por espaços do bloco: o total de espaços por círculo e as magias que ele conhece. */
export const ConjuracaoPorEspacosDoMonstroSchema = z.object({
  habilidade: AtributoDoMonstro.optional(),
  /** Espaços por círculo ("1" a "9"). */
  espacos: z.partialRecord(z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9"]), Inteiro(0, 30)),
  /** As magias, com o círculo (0 = truque). */
  magias: z.array(MagiaDoMonstro.extend({ nivel: Inteiro(0, 9) })).max(80),
});

export const MonstroDoCompendioSchema = z.object({
  nome: Linha(LIMITES_DO_COMPENDIO.nome),
  nomeOriginal: Linha(LIMITES_DO_COMPENDIO.nome).optional(),
  /** Miúdo, Pequeno, Médio, Grande, Enorme ou Imenso (texto livre: "Médio ou Pequeno" também vale). */
  tamanho: Linha(40),
  /** "Humanoide (goblinoide)", "Fera", "Morto-vivo"... */
  tipo: Linha(LIMITES_DO_COMPENDIO.tipoDeMonstro),
  tendencia: Linha(80).optional(),
  ca: z.object({ valor: Inteiro(0, 50), fonte: Linha(100).optional() }),
  pv: z.object({ media: Inteiro(0, 9999), formula: Linha(40).optional() }),
  /** O texto do livro ("9 m, voo 18 m"). */
  deslocamento: Linha(100).optional(),
  /** O deslocamento base, em metros (sem ele, vale o primeiro número em metros do texto). */
  deslocamentoM: z.number().min(0).max(150).optional(),
  atributos: z.object({
    for: Inteiro(1, 30),
    des: Inteiro(1, 30),
    con: Inteiro(1, 30),
    int: Inteiro(1, 30),
    sab: Inteiro(1, 30),
    car: Inteiro(1, 30),
  }),
  /** Bônus total de cada teste de resistência que o livro lista (+6 em Inteligência: `{ "int": 6 }`). */
  salvaguardas: z.partialRecord(AtributoDoMonstro, Inteiro(-10, 40)).optional(),
  /** Bônus total de cada perícia que o livro lista: `{ "Furtividade": 6 }`. */
  pericias: z.record(Linha(40), Inteiro(-10, 40)).optional(),
  vulnerabilidades: Linha(200).optional(),
  resistencias: Linha(200).optional(),
  imunidades: Linha(200).optional(),
  imunidadesCondicoes: Linha(200).optional(),
  sentidos: Linha(200).optional(),
  idiomas: Linha(200).optional(),
  /** "0", "1/8", "1/4", "1/2", "1" a "30". */
  nd: z.enum(NIVEIS_DE_DESAFIO as [string, ...string[]]),
  xp: Inteiro(0, 999_999).optional(),
  tracos: z.array(TracoDoMonstroSchema).max(40).optional(),
  acoes: z.array(AcaoDoMonstroSchema).max(40).optional(),
  reacoes: z.array(AcaoDoMonstroSchema).max(20).optional(),
  acoesLendarias: z.array(AcaoDoMonstroSchema).max(20).optional(),
  /** O parágrafo que abre as ações lendárias ("pode fazer 3 ações lendárias..."). */
  textoDasAcoesLendarias: z.string().trim().min(1).max(LIMITES_DO_COMPENDIO.texto).optional(),
  conjuracaoInata: ConjuracaoInataDoMonstroSchema.optional(),
  conjuracaoPorEspacos: ConjuracaoPorEspacosDoMonstroSchema.optional(),
});
export type MonstroDoCompendio = z.infer<typeof MonstroDoCompendioSchema>;

export const RARIDADES_DE_ITEM_MAGICO = [
  "comum",
  "incomum",
  "raro",
  "muito raro",
  "lendário",
  "artefato",
  "varia",
] as const;
export type RaridadeDeItemMagico = (typeof RARIDADES_DE_ITEM_MAGICO)[number];
export const ROTULO_DA_RARIDADE: Record<RaridadeDeItemMagico, string> = {
  comum: "Comum",
  incomum: "Incomum",
  raro: "Raro",
  "muito raro": "Muito raro",
  lendário: "Lendário",
  artefato: "Artefato",
  varia: "Varia",
};

/** Um item mágico: tipo, raridade, sintonização e a descrição. Arma ou armadura com bônus levam `bonus` (+1 a +3). */
export const ItemMagicoDoCompendioSchema = z.object({
  nome: Linha(LIMITES_DO_COMPENDIO.nome),
  nomeOriginal: Linha(LIMITES_DO_COMPENDIO.nome).optional(),
  /** "arma (espada longa)", "armadura", "anel", "poção", "maravilhoso"... */
  tipo: Linha(100),
  raridade: z.enum(RARIDADES_DE_ITEM_MAGICO),
  /** Sem o campo, não precisa de sintonização. `por` diz quem ("um clérigo ou paladino"). */
  sintonizacao: z.object({ necessaria: z.boolean(), por: Linha(160).optional() }).optional(),
  descricao: z.string().trim().min(1).max(LIMITES_DO_COMPENDIO.descricao),
  /** O bônus mágico de uma arma (acerto e dano), +1 a +3. */
  bonus: Inteiro(1, 3).optional(),
  /** A arma base (espada longa), para o item virar um ataque na ficha. */
  arma: ArmaDoCompendioSchema.optional(),
  peso: z.number().min(0).max(99_999).optional(),
  custo: Linha(40).optional(),
});
export type ItemMagicoDoCompendio = z.infer<typeof ItemMagicoDoCompendioSchema>;

export const CompendioSchema = z
  .object({
    formato: z.literal(FORMATO_DO_COMPENDIO),
    versao: z.literal(VERSAO_DO_COMPENDIO),
    /** Atribuição exigida pela licença do conteúdo (ex.: CC-BY-4.0 do SRD 5.1). Só é mostrada. */
    creditos: z.string().trim().min(1).max(LIMITES_DO_COMPENDIO.creditos).optional(),
    /** N3a: opcional (um `monstros.json` não tem magias). */
    magias: z.array(MagiaDoCompendioSchema).max(LIMITES_DO_COMPENDIO.magias).default([]),
    /** V4b: armas e itens, opcionais (o arquivo antigo, só de magias, continua valendo). */
    armas: z.array(ArmaDoCompendioSchema).max(LIMITES_DO_COMPENDIO.armas).optional(),
    itens: z.array(ItemDoCompendioSchema).max(LIMITES_DO_COMPENDIO.itens).optional(),
    /** N3a: monstros e itens mágicos, opcionais. */
    monstros: z.array(MonstroDoCompendioSchema).max(LIMITES_DO_COMPENDIO.monstros).optional(),
    itensMagicos: z
      .array(ItemMagicoDoCompendioSchema)
      .max(LIMITES_DO_COMPENDIO.itensMagicos)
      .optional(),
  })
  .refine(
    (c) =>
      c.magias.length > 0 ||
      (c.armas?.length ?? 0) > 0 ||
      (c.itens?.length ?? 0) > 0 ||
      (c.monstros?.length ?? 0) > 0 ||
      (c.itensMagicos?.length ?? 0) > 0,
    {
      message:
        "o arquivo precisa ter ao menos uma lista com entradas (magias, armas, itens, monstros ou itensMagicos)",
    },
  );
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
  const rotulo = (
    {
      magias: "magia",
      armas: "arma",
      itens: "item",
      monstros: "monstro",
      itensMagicos: "item mágico",
    } as Record<string, string>
  )[partes[0] ?? ""];
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
  const porNivel = porNivelAcimaDoTexto(m.emNiveisSuperiores);
  const lido = lerPorNivelAcima(porNivel);
  const base =
    lido?.tipo === "quantidade"
      ? (quantidadeBaseDoTexto(m.descricao, lido.unidade) ?? undefined)
      : undefined;
  // N2: truque que sobe pelo nível do personagem (o texto vem na descrição ou no "Em níveis superiores").
  const porNivelDoPersonagem =
    m.nivel === 0 ? dadosPorNivelDoTexto(`${m.descricao} ${m.emNiveisSuperiores ?? ""}`) : [];
  return {
    nome: m.nome,
    nivel: m.nivel,
    preparada: true,
    escola: m.escola,
    descricao: descricaoParaFicha(m),
    ...(porNivel ? { porNivelAcima: porNivel } : {}),
    ...(base ? { quantidadeBase: base } : {}),
    ...(m.ritual ? { ritual: true } : {}),
    ...(porNivelDoPersonagem.length > 0 ? { dadosPorNivel: porNivelDoPersonagem } : {}),
  };
}

/** A lista de magias da ficha já tem uma com este nome (sem acento nem caixa)? */
export function fichaTemMagia(magias: readonly Pick<Magia, "nome">[], nome: string): boolean {
  const alvo = normalizarBusca(nome);
  return magias.some((m) => normalizarBusca(m.nome) === alvo);
}

// ---------------------------------------------------------------------------------------------
// Vários arquivos (N3a)
// ---------------------------------------------------------------------------------------------

export type ParteDoCompendio = { nome: string; compendio: Compendio };
export type LeituraDeVarios =
  | { ok: true; compendio: Compendio; avisos: string[] }
  | { ok: false; motivo: string };

type ComNome = { nome: string };

/** Junta uma lista por nome (sem acento nem caixa): a última vence e o aviso diz de onde veio cada uma. */
function juntarListas<T extends ComNome>(
  rotulo: string,
  partes: readonly { nome: string; lista: readonly T[] | undefined }[],
  avisos: string[],
): T[] {
  const mapa = new Map<string, { entrada: T; origem: string }>();
  for (const parte of partes) {
    for (const entrada of parte.lista ?? []) {
      const chave = normalizarBusca(entrada.nome);
      const antes = mapa.get(chave);
      if (antes) {
        avisos.push(
          `${rotulo} "${entrada.nome}" aparece em ${antes.origem} e em ${parte.nome}: ficou a de ${parte.nome}.`,
        );
      }
      mapa.set(chave, { entrada, origem: parte.nome });
    }
  }
  return [...mapa.values()].map((v) => v.entrada);
}

/** Os créditos de todos os arquivos, sem repetir parágrafo e dentro do limite do campo. */
function juntarCreditos(creditos: readonly (string | undefined)[]): string | undefined {
  const vistos = new Set<string>();
  const paragrafos: string[] = [];
  for (const c of creditos) {
    for (const p of (c ?? "").split(/\n{2,}/)) {
      const limpo = p.trim();
      if (limpo !== "" && !vistos.has(limpo)) {
        vistos.add(limpo);
        paragrafos.push(limpo);
      }
    }
  }
  let saida = "";
  for (const p of paragrafos) {
    const proximo = saida === "" ? p : `${saida}\n\n${p}`;
    if (proximo.length > LIMITES_DO_COMPENDIO.creditos) break;
    saida = proximo;
  }
  return saida === "" ? undefined : saida;
}

/**
 * Junta os arquivos do compêndio num só: cada lista é somada e uma entrada repetida pelo nome (sem acento nem caixa)
 * fica com a do último arquivo, com um aviso. Confere os limites do total. Com um arquivo só, devolve-o como está.
 */
export function juntarCompendios(partes: readonly ParteDoCompendio[]): LeituraDeVarios {
  const [primeira] = partes;
  if (!primeira) return { ok: false, motivo: "Nenhum arquivo do compêndio." };
  if (partes.length === 1) return { ok: true, compendio: primeira.compendio, avisos: [] };
  const avisos: string[] = [];
  const por = <K extends keyof Compendio>(campo: K) =>
    partes.map((p) => ({
      nome: p.nome,
      lista: p.compendio[campo] as readonly ComNome[] | undefined,
    }));
  const magias = juntarListas("A magia", por("magias"), avisos) as MagiaDoCompendio[];
  const armas = juntarListas("A arma", por("armas"), avisos) as ArmaDoCompendio[];
  const itens = juntarListas("O item", por("itens"), avisos) as ItemDoCompendio[];
  const monstros = juntarListas("O monstro", por("monstros"), avisos) as MonstroDoCompendio[];
  const itensMagicos = juntarListas(
    "O item mágico",
    por("itensMagicos"),
    avisos,
  ) as ItemMagicoDoCompendio[];
  const creditos = juntarCreditos(partes.map((p) => p.compendio.creditos));
  const compendio: Compendio = {
    formato: FORMATO_DO_COMPENDIO,
    versao: VERSAO_DO_COMPENDIO,
    ...(creditos ? { creditos } : {}),
    magias,
    ...(armas.length > 0 ? { armas } : {}),
    ...(itens.length > 0 ? { itens } : {}),
    ...(monstros.length > 0 ? { monstros } : {}),
    ...(itensMagicos.length > 0 ? { itensMagicos } : {}),
  };
  const limites: [string, number, number][] = [
    ["magias", magias.length, LIMITES_DO_COMPENDIO.magias],
    ["armas", armas.length, LIMITES_DO_COMPENDIO.armas],
    ["itens", itens.length, LIMITES_DO_COMPENDIO.itens],
    ["monstros", monstros.length, LIMITES_DO_COMPENDIO.monstros],
    ["itens mágicos", itensMagicos.length, LIMITES_DO_COMPENDIO.itensMagicos],
  ];
  for (const [rotulo, n, max] of limites) {
    if (n > max) {
      return { ok: false, motivo: `Os arquivos juntos têm ${n} ${rotulo} (o limite é ${max}).` };
    }
  }
  if (bytesUtf8(JSON.stringify(compendio)) > LIMITES_DO_COMPENDIO.bytes) {
    return {
      ok: false,
      motivo: `Os arquivos juntos passam de ${LIMITES_DO_COMPENDIO.bytes / (1024 * 1024)} MB.`,
    };
  }
  return { ok: true, compendio, avisos };
}

/** Lê o texto de cada arquivo e junta; o motivo de erro diz qual arquivo falhou. */
export function lerVariosCompendios(
  arquivos: readonly { nome: string; texto: string }[],
): LeituraDeVarios {
  const partes: ParteDoCompendio[] = [];
  for (const a of arquivos) {
    const r = lerCompendio(a.texto);
    if (!r.ok) return { ok: false, motivo: `${a.nome}: ${r.motivo}` };
    partes.push({ nome: a.nome, compendio: r.compendio });
  }
  return juntarCompendios(partes);
}

/** O que o arquivo traz: serve para escolher o nome com que "Carregar arquivos" o grava em `compendio/`. */
export function categoriasDoCompendio(c: Compendio): {
  magias: boolean;
  monstros: boolean;
  itens: boolean;
} {
  return {
    magias: c.magias.length > 0 || (c.armas?.length ?? 0) > 0,
    monstros: (c.monstros?.length ?? 0) > 0,
    itens: (c.itens?.length ?? 0) > 0 || (c.itensMagicos?.length ?? 0) > 0,
  };
}

/** O nome canônico do arquivo na pasta `compendio/`: só monstros, só itens, só magias; misturado, `compendio.json`. */
export function nomeCanonicoDoArquivo(c: Compendio): (typeof ARQUIVOS_DO_COMPENDIO)[number] {
  const cat = categoriasDoCompendio(c);
  const quantas = [cat.magias, cat.monstros, cat.itens].filter(Boolean).length;
  if (quantas !== 1) return "compendio.json";
  return cat.monstros ? "monstros.json" : cat.itens ? "itens.json" : "magias.json";
}

// ---------------------------------------------------------------------------------------------
// Busca de monstros e de itens mágicos (N3a)
// ---------------------------------------------------------------------------------------------

/** A posição do ND na ordem (0, 1/8, 1/4, 1/2, 1 ... 30). */
export function posicaoDoND(nd: string): number {
  return NIVEIS_DE_DESAFIO.indexOf(nd);
}

/** O tipo sem o parêntese: "Humanoide (goblinoide)" é "Humanoide". */
export function tipoBaseDoMonstro(tipo: string): string {
  return tipo.replace(/\s*[(,].*$/, "").trim() || tipo;
}

export type FiltroDeMonstros = {
  /** Cada palavra precisa aparecer no nome ou no nome original. */
  texto?: string | undefined;
  /** O tipo base ("Fera"). */
  tipo?: string | undefined;
  /** Faixa de ND, inclusive (use as frações como "1/4"). */
  ndDe?: string | undefined;
  ndAte?: string | undefined;
  tamanho?: string | undefined;
};

/** Os monstros que passam pelos filtros, em ordem alfabética. */
export function buscarMonstros(
  monstros: readonly MonstroDoCompendio[],
  filtro: FiltroDeMonstros = {},
): MonstroDoCompendio[] {
  const palavras = normalizarBusca(filtro.texto ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const tipo = filtro.tipo === undefined ? undefined : normalizarBusca(filtro.tipo);
  const tamanho = filtro.tamanho === undefined ? undefined : normalizarBusca(filtro.tamanho);
  const de = filtro.ndDe === undefined ? -1 : posicaoDoND(filtro.ndDe);
  const ate = filtro.ndAte === undefined ? -1 : posicaoDoND(filtro.ndAte);
  const passa = (m: MonstroDoCompendio): boolean => {
    if (tipo !== undefined && normalizarBusca(tipoBaseDoMonstro(m.tipo)) !== tipo) return false;
    if (tamanho !== undefined && !normalizarBusca(m.tamanho).includes(tamanho)) return false;
    const nd = posicaoDoND(m.nd);
    if (de >= 0 && nd < de) return false;
    if (ate >= 0 && nd > ate) return false;
    if (palavras.length > 0) {
      const alvo = `${normalizarBusca(m.nome)} ${normalizarBusca(m.nomeOriginal ?? "")}`;
      if (!palavras.every((p) => alvo.includes(p))) return false;
    }
    return true;
  };
  return monstros
    .filter(passa)
    .sort(
      (a, b) =>
        normalizarBusca(a.nome).localeCompare(normalizarBusca(b.nome), "pt-BR") ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

/** Os tipos base que existem nos monstros, para montar o filtro. */
export function opcoesDeMonstros(monstros: readonly MonstroDoCompendio[]): { tipos: string[] } {
  const tipos = new Map<string, string>();
  for (const m of monstros) {
    const base = tipoBaseDoMonstro(m.tipo);
    tipos.set(normalizarBusca(base), base);
  }
  return { tipos: [...tipos.values()].sort((a, b) => a.localeCompare(b, "pt-BR")) };
}

/** O tipo do item sem o parêntese: "arma (espada longa)" é "arma". */
export function tipoBaseDoItemMagico(tipo: string): string {
  return tipo.replace(/\s*[(,].*$/, "").trim() || tipo;
}

export type FiltroDeItensMagicos = {
  texto?: string | undefined;
  tipo?: string | undefined;
  raridade?: RaridadeDeItemMagico | undefined;
  /** Q2: true = só os que exigem sintonização; false = só os que não exigem. */
  sintonizacao?: boolean | undefined;
};

/** Os itens mágicos que passam pelos filtros, em ordem alfabética. */
export function buscarItensMagicos(
  itens: readonly ItemMagicoDoCompendio[],
  filtro: FiltroDeItensMagicos = {},
): ItemMagicoDoCompendio[] {
  const palavras = normalizarBusca(filtro.texto ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const tipo = filtro.tipo === undefined ? undefined : normalizarBusca(filtro.tipo);
  const passa = (i: ItemMagicoDoCompendio): boolean => {
    if (tipo !== undefined && normalizarBusca(tipoBaseDoItemMagico(i.tipo)) !== tipo) return false;
    if (filtro.raridade !== undefined && i.raridade !== filtro.raridade) return false;
    if (
      filtro.sintonizacao !== undefined &&
      (i.sintonizacao?.necessaria === true) !== filtro.sintonizacao
    )
      return false;
    if (palavras.length > 0) {
      const alvo = `${normalizarBusca(i.nome)} ${normalizarBusca(i.nomeOriginal ?? "")}`;
      if (!palavras.every((p) => alvo.includes(p))) return false;
    }
    return true;
  };
  return itens
    .filter(passa)
    .sort(
      (a, b) =>
        normalizarBusca(a.nome).localeCompare(normalizarBusca(b.nome), "pt-BR") ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

/** Os tipos base e as raridades que existem nos itens mágicos (na ordem das raridades). */
export function opcoesDeItensMagicos(itens: readonly ItemMagicoDoCompendio[]): {
  tipos: string[];
  raridades: RaridadeDeItemMagico[];
} {
  const tipos = new Map<string, string>();
  const raridades = new Set<RaridadeDeItemMagico>();
  for (const i of itens) {
    const base = tipoBaseDoItemMagico(i.tipo);
    tipos.set(normalizarBusca(base), base);
    raridades.add(i.raridade);
  }
  return {
    tipos: [...tipos.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
    raridades: RARIDADES_DE_ITEM_MAGICO.filter((r) => raridades.has(r)),
  };
}

/** A linha "Raro, exige sintonização por um mago" do item mágico. */
export function resumoDoItemMagico(i: ItemMagicoDoCompendio): string {
  const sint = i.sintonizacao?.necessaria
    ? `exige sintonização${i.sintonizacao.por ? ` por ${i.sintonizacao.por}` : ""}`
    : "";
  return [ROTULO_DA_RARIDADE[i.raridade], sint].filter(Boolean).join(", ");
}
