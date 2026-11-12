import { z } from "zod";
import type { Personagem } from "./estado.ts";
import {
  ATRIBUTOS,
  type Atributo,
  CLASSES,
  classeSrd,
  ESPACOS_POR_NIVEL_DE_CONJURADOR,
  IDS_DE_PERICIA,
  PACTO_DO_BRUXO,
  PERICIAS,
  SUBCLASSES_DE_TERCO,
  semAcento,
  type TipoDeConjurador,
} from "./srd/index.ts";

// ---------------------------------------------------------------------------------------------
// Ficha 5e (Lote 9, seção 4.9). A ficha guarda só os VALORES BASE; tudo o que se calcula (modificadores,
// proficiência, salvaguardas, perícias, CD...) sai das funções puras deste arquivo e nunca é gravado.
// Todo campo, menos os PV, é opcional: ficha antiga (só `pvAtual`/`pvMax`) continua valendo e o que
// falta é lido com o padrão (atributo 10, nenhuma proficiência...).
// ---------------------------------------------------------------------------------------------

/** Limite do JSON da ficha inteira (a sala recusa acima disso). */
export const TAMANHO_MAXIMO_DA_FICHA = 256 * 1024;

export const NIVEIS_DE_PROFICIENCIA = ["nenhuma", "proficiente", "especialista"] as const;
export const NivelDeProficienciaSchema = z.enum(NIVEIS_DE_PROFICIENCIA);
export type NivelDeProficiencia = z.infer<typeof NivelDeProficienciaSchema>;

export const AtributoSchema = z.enum(ATRIBUTOS);

const Bonus = z.number().int().min(-50).max(50);
const Nome = z.string().min(1).max(80);

/** Proficiência de uma salvaguarda ou perícia, mais um bônus extra manual. */
export const ProficienciaSchema = z.object({
  nivel: NivelDeProficienciaSchema,
  bonus: Bonus.optional(),
});
export type Proficiencia = z.infer<typeof ProficienciaSchema>;

export const ClasseDaFichaSchema = z.object({
  classe: z.string().min(1).max(48),
  subclasse: z.string().max(48).optional(),
  nivel: z.number().int().min(1).max(20),
});
export type ClasseDaFicha = z.infer<typeof ClasseDaFichaSchema>;

/** Acerto de um ataque: valor fixo (o que o import de PDF traz) ou fórmula (atributo + proficiência). */
export const AcertoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("fixo"), valor: Bonus }),
  z.object({
    tipo: z.literal("formula"),
    atributo: AtributoSchema,
    proficiente: z.boolean(),
    bonus: Bonus.optional(),
  }),
]);
export type Acerto = z.infer<typeof AcertoSchema>;

/** Um segundo dano do ataque (V4a: "Usar um segundo dano"): dados, atributo, bônus e tipo. */
export const SegundoDanoSchema = z.object({
  dados: z.string().max(100),
  atributo: AtributoSchema.optional(),
  bonus: Bonus.optional(),
  tipo: z.string().max(32).optional(),
});
export type SegundoDano = z.infer<typeof SegundoDanoSchema>;

export const EFEITOS_NO_SUCESSO = ["metade", "nenhum"] as const;
/** A salvaguarda que o alvo faz (V4a): o teste dele, o atributo da CD, o bônus na CD e o que o sucesso faz. */
export const SalvaguardaDaRolagemSchema = z.object({
  alvo: AtributoSchema,
  cdAtributo: AtributoSchema,
  cdBonus: Bonus.optional(),
  sucesso: z.enum(EFEITOS_NO_SUCESSO),
});
export type SalvaguardaDaRolagem = z.infer<typeof SalvaguardaDaRolagemSchema>;

/**
 * Os campos de rolagem que um ataque e uma magia têm em comum (V4a: o mesmo editor serve aos dois). Tudo opcional:
 * `acerto`, `cd`, `dano` e `tipo` já existiam; o resto é do editor da engrenagem.
 */
const CamposDeRolagem = {
  /** Sem acerto: o ataque só tem dano (ou CD). */
  acerto: AcertoSchema.optional(),
  /** CD da salvaguarda do alvo escrita à mão (sem `salvaguarda`). Só é mostrada. */
  cd: z.number().int().min(0).max(40).optional(),
  /** Os dados do dano (`1d8`) ou a expressão inteira que o import trouxe (`1d8+7`); vazio = sem dano. */
  dano: z.string().max(100).optional(),
  /** Tipo do dano ("Cortante", "Radiante"...). */
  tipo: z.string().max(32).optional(),
  alcance: z.string().max(100).optional(),
  /** Soma ao acerto e ao dano. */
  bonusMagico: Bonus.optional(),
  /** O modificador desse atributo soma ao dano. */
  atributoDano: AtributoSchema.optional(),
  bonusDano: Bonus.optional(),
  /** A partir de qual número natural o acerto é crítico (20 por padrão; 19 ou 18 para quem amplia). */
  margemCritico: z.number().int().min(18).max(20).optional(),
  /** Dados a mais no crítico (`1d6`), somados depois de dobrar os do dano. */
  danoCritico: z.string().max(60).optional(),
  dano2: SegundoDanoSchema.optional(),
  salvaguarda: SalvaguardaDaRolagemSchema.optional(),
};

export const AtaqueSchema = z.object({
  nome: Nome,
  ...CamposDeRolagem,
  descricao: z.string().max(20_000).optional(),
});
export type Ataque = z.infer<typeof AtaqueSchema>;

export const MagiaSchema = z.object({
  nome: Nome,
  nivel: z.number().int().min(0).max(9),
  preparada: z.boolean(),
  escola: z.string().max(32).optional(),
  descricao: z.string().max(20_000),
  ...CamposDeRolagem,
  /** Tempo de conjuração, componentes e duração (o que o compêndio traz, para a magia escrita à mão). */
  tempo: z.string().max(60).optional(),
  componentes: z.string().max(200).optional(),
  duracao: z.string().max(80).optional(),
  /** "Mostrar em Ataques e magias" (V4a): a magia aparece na lista de ataques, editada pela mesma magia. */
  emAtaques: z.boolean().optional(),
});
export type Magia = z.infer<typeof MagiaSchema>;

/** O que o editor de ataque e as rolagens leem: um ataque ou uma magia (têm a mesma forma). */
export type Rolavel = Pick<
  Ataque,
  | "nome"
  | "acerto"
  | "cd"
  | "dano"
  | "tipo"
  | "alcance"
  | "bonusMagico"
  | "atributoDano"
  | "bonusDano"
  | "margemCritico"
  | "danoCritico"
  | "dano2"
  | "salvaguarda"
>;

export const CaracteristicaSchema = z.object({
  nome: Nome,
  descricao: z.string().max(20_000),
  /** De onde vem ("Classe: Patrulheiro", "Raça: Elfo"): a linha em itálico embaixo do título (V4a). */
  origem: z.string().max(80).optional(),
});
export type Caracteristica = z.infer<typeof CaracteristicaSchema>;

export const ItemDaFichaSchema = z.object({
  nome: Nome,
  quantidade: z.number().int().min(0).max(9999),
  /** Modelo de objeto (tocha, lanterna): o item acende direto da ficha (4.8). */
  modeloId: z.string().min(1).max(64).optional(),
  nota: z.string().max(500).optional(),
  /** Peso de uma unidade, em quilos (V4a): a carga da ficha soma quantidade vezes peso. */
  peso: z.number().min(0).max(99_999).optional(),
});
export type ItemDaFicha = z.infer<typeof ItemDaFichaSchema>;

export const RECARGAS = ["curto", "longo", "nenhuma"] as const;
export const RecursoSchema = z.object({
  nome: Nome,
  atual: z.number().int().min(0).max(9999),
  max: z.number().int().min(0).max(9999),
  recarga: z.enum(RECARGAS),
});
export type Recurso = z.infer<typeof RecursoSchema>;

export const DADOS_DE_VIDA = ["d6", "d8", "d10", "d12"] as const;
export type DadoDeVida = (typeof DADOS_DE_VIDA)[number];

const NIVEIS_DE_ESPACO = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** SHA-256 em hexadecimal minúsculo (o mesmo de `HashSchema`, sem importar `assets.ts`: ele importa o estado). */
const HashDaImagem = z.string().regex(/^[0-9a-f]{64}$/, "hash inválido");
const Moeda = z.number().int().min(0).max(9_999_999);
const Curto = z.string().max(40);
/** Texto livre de uma caixa da ficha de papel (V4a). */
const Caixa = (max: number) => z.string().max(max);

/** As moedas da ficha de papel: PC (cobre), PP (prata), PE (electro), PO (ouro) e PL (platina). */
export const MoedasSchema = z.object({
  pc: Moeda.optional(),
  pp: Moeda.optional(),
  pe: Moeda.optional(),
  po: Moeda.optional(),
  pl: Moeda.optional(),
});
export type Moedas = z.infer<typeof MoedasSchema>;
export const MOEDAS = ["pc", "pp", "pe", "po", "pl"] as const;
export type TipoDeMoeda = (typeof MOEDAS)[number];

export const FichaSchema = z.object({
  // --- identidade ---
  raca: z.string().max(64).optional(),
  antecedente: z.string().max(64).optional(),
  alinhamento: z.string().max(64).optional(),
  classes: z.array(ClasseDaFichaSchema).max(12).optional(),
  // --- números base ---
  atributos: z
    .object({
      for: z.number().int().min(1).max(30).optional(),
      des: z.number().int().min(1).max(30).optional(),
      con: z.number().int().min(1).max(30).optional(),
      int: z.number().int().min(1).max(30).optional(),
      sab: z.number().int().min(1).max(30).optional(),
      car: z.number().int().min(1).max(30).optional(),
    })
    .optional(),
  salvaguardas: z.partialRecord(AtributoSchema, ProficienciaSchema).optional(),
  pericias: z.partialRecord(z.enum(IDS_DE_PERICIA), ProficienciaSchema).optional(),
  ca: z
    .object({ valor: z.number().int().min(0).max(50), nota: z.string().max(100).optional() })
    .optional(),
  deslocamentoFt: z.number().int().min(0).max(500).optional(),
  /** Bônus manual somado ao modificador de Destreza na iniciativa. */
  iniciativaBonus: Bonus.optional(),
  // --- pontos de vida ---
  pvAtual: z.number().int().min(0).max(9999),
  pvMax: z.number().int().min(0).max(9999),
  pvTemp: z.number().int().min(0).max(9999).optional(),
  dadosDeVidaUsados: z
    .partialRecord(z.enum(DADOS_DE_VIDA), z.number().int().min(0).max(20))
    .optional(),
  mortes: z
    .object({ sucessos: z.number().int().min(0).max(3), falhas: z.number().int().min(0).max(3) })
    .optional(),
  // --- combate e magia ---
  ataques: z.array(AtaqueSchema).max(100).optional(),
  /** Habilidade de conjuração por classe, quando difere da padrão da classe. */
  conjuracao: z
    .array(z.object({ classe: z.string().min(1).max(48), habilidade: AtributoSchema }))
    .max(12)
    .optional(),
  /** Espaços de magia gastos por nível ("1" a "9"). */
  espacosGastos: z
    .partialRecord(z.enum(NIVEIS_DE_ESPACO), z.number().int().min(0).max(30))
    .optional(),
  /** Espaços de pacto do Bruxo gastos (à parte dos demais). */
  pactoGasto: z.number().int().min(0).max(10).optional(),
  magias: z.array(MagiaSchema).max(300).optional(),
  // --- o resto ---
  caracteristicas: z.array(CaracteristicaSchema).max(200).optional(),
  itens: z.array(ItemDaFichaSchema).max(300).optional(),
  recursos: z.array(RecursoSchema).max(60).optional(),
  idiomas: z.array(z.string().min(1).max(40)).max(30).optional(),
  notas: z.string().max(50_000).optional(),
  // --- ficha de papel (V4a): o que o PDF da Biblioteca Élfica tem e a ficha não tinha. Tudo opcional. ---
  /** Pontos de experiência. */
  xp: z.number().int().min(0).max(99_999_999).optional(),
  /** Inspiração: tem ou não. */
  inspiracao: z.boolean().optional(),
  /** "Idiomas e outras proficiências": o texto da caixa (o `idiomas` antigo é a lista que o import preenche). */
  outrasProficiencias: Caixa(4000).optional(),
  moedas: MoedasSchema.optional(),
  personalidade: Caixa(2000).optional(),
  ideais: Caixa(2000).optional(),
  ligacoes: Caixa(2000).optional(),
  defeitos: Caixa(2000).optional(),
  /** Texto livre da caixa "Ataques e magias" (abaixo das linhas de ataque). */
  ataquesTexto: Caixa(8000).optional(),
  // --- página 2 ---
  idade: Curto.optional(),
  altura: Curto.optional(),
  peso: Curto.optional(),
  olhos: Curto.optional(),
  pele: Curto.optional(),
  cabelos: Curto.optional(),
  /** A imagem local da "Aparência do personagem" (um asset `retrato`, como o retrato). */
  aparenciaHash: HashDaImagem.optional(),
  /** A descrição escrita da aparência. */
  aparencia: Caixa(4000).optional(),
  aliados: Caixa(8000).optional(),
  simboloNome: z.string().max(80).optional(),
  simboloHash: HashDaImagem.optional(),
  /** "Outras características e habilidades" (a página 2; as da página 1 são `caracteristicas`). */
  outrasCaracteristicas: z.array(CaracteristicaSchema).max(200).optional(),
  historia: Caixa(20_000).optional(),
  tesouro: Caixa(8000).optional(),
  // --- página 3 ---
  /** "Classe de conjurador" escrita à mão (sem ela, vale a primeira classe que conjura). */
  classeConjurador: z.string().max(48).optional(),
  /** Espaços de magia por nível, quando a pessoa quer escrever por cima da conta das classes. */
  espacosTotal: z
    .partialRecord(z.enum(NIVEIS_DE_ESPACO), z.number().int().min(0).max(30))
    .optional(),
});
export type Ficha = z.infer<typeof FichaSchema>;

/** A ficha de um personagem novo. */
export function fichaNova(pvMax = 10): Ficha {
  return { pvAtual: pvMax, pvMax };
}

// ---------------------------------------------------------------------------------------------
// Derivação
// ---------------------------------------------------------------------------------------------

/** Modificador de atributo: `floor((valor − 10) / 2)`. */
export function modificador(valor: number): number {
  return Math.floor((valor - 10) / 2);
}

export function valorDoAtributo(f: Ficha, a: Atributo): number {
  return f.atributos?.[a] ?? 10;
}

export function modDoAtributo(f: Ficha, a: Atributo): number {
  return modificador(valorDoAtributo(f, a));
}

/** Nível total (soma dos níveis das classes; sem classe vale 1). */
export function nivelTotal(f: Ficha): number {
  const soma = (f.classes ?? []).reduce((t, c) => t + c.nivel, 0);
  return Math.min(20, Math.max(1, soma));
}

/** Bônus de proficiência pelo nível total: +2 no 1º, +3 no 5º, +4 no 9º, +5 no 13º, +6 no 17º. */
export function bonusDeProficiencia(f: Ficha): number {
  return 2 + Math.floor((nivelTotal(f) - 1) / 4);
}

const MULTIPLICADOR: Record<NivelDeProficiencia, number> = {
  nenhuma: 0,
  proficiente: 1,
  especialista: 2,
};

/** Quanto da proficiência entra na conta: 0, 1 ou 2 (especialista dobra). */
export function bonusPorNivel(f: Ficha, nivel: NivelDeProficiencia | undefined): number {
  return MULTIPLICADOR[nivel ?? "nenhuma"] * bonusDeProficiencia(f);
}

export function bonusDeSalvaguarda(f: Ficha, a: Atributo): number {
  const p = f.salvaguardas?.[a];
  return modDoAtributo(f, a) + bonusPorNivel(f, p?.nivel) + (p?.bonus ?? 0);
}

export function bonusDePericia(f: Ficha, id: (typeof PERICIAS)[number]["id"]): number {
  const def = PERICIAS.find((p) => p.id === id);
  const p = f.pericias?.[id];
  return (def ? modDoAtributo(f, def.atributo) : 0) + bonusPorNivel(f, p?.nivel) + (p?.bonus ?? 0);
}

/** Percepção passiva: 10 + o bônus de Percepção. */
export function percepcaoPassiva(f: Ficha): number {
  return 10 + bonusDePericia(f, "percepcao");
}

/** Iniciativa: modificador de Destreza mais o bônus manual. */
export function iniciativa(f: Ficha): number {
  return modDoAtributo(f, "des") + (f.iniciativaBonus ?? 0);
}

/** 1 ft = 0,3 m (5 ft = 1,5 m, o quadrado do 5e), com uma casa decimal. */
export function pesParaMetros(ft: number): number {
  return Math.round(ft * 3) / 10;
}

/** Bônus de acerto do ataque: valor fixo ou atributo + proficiência + bônus, mais o bônus mágico; `undefined` sem acerto. */
export function bonusDeAcerto(f: Ficha, a: Rolavel): number | undefined {
  const acerto = a.acerto;
  if (!acerto) return undefined;
  const magico = a.bonusMagico ?? 0;
  if (acerto.tipo === "fixo") return acerto.valor + magico;
  return (
    modDoAtributo(f, acerto.atributo) +
    (acerto.proficiente ? bonusDeProficiencia(f) : 0) +
    (acerto.bonus ?? 0) +
    magico
  );
}

// ---------------------------------------------------------------------------------------------
// Classes, conjuração, espaços e dados de vida
// ---------------------------------------------------------------------------------------------

/** Como esta entrada de classe conjura (a subclasse de terço vale para Guerreiro e Ladino). */
export function tipoDeConjurador(c: ClasseDaFicha): TipoDeConjurador {
  const srd = classeSrd(c.classe);
  if (!srd) return "nenhum";
  if (srd.conjurador !== "nenhum") return srd.conjurador;
  const sub = semAcento(c.subclasse ?? "");
  const terco = SUBCLASSES_DE_TERCO.find((s) => s.classe === srd.id && s.apelidos.includes(sub));
  return terco ? "terco" : "nenhum";
}

/**
 * Nível de conjurador pela tabela de multiclasse do PHB 2014. Com uma classe de conjuração só (fora o
 * pacto do Bruxo) vale a tabela da própria classe: meio-conjurador de nível 2 ou mais conta
 * `ceil(nível / 2)` e o de terço, de nível 3 ou mais, `ceil(nível / 3)` (as duas tabelas da classe
 * coincidem com a de multiclasse nesses níveis). Com mais de uma, somam-se os níveis de conjuração
 * inteiros, a metade (para baixo) de cada meio-conjurador e o terço (para baixo) de cada um de terço.
 */
export function nivelDeConjurador(classes: readonly ClasseDaFicha[]): number {
  const conjuradoras = classes
    .map((c) => ({ c, tipo: tipoDeConjurador(c) }))
    .filter((x) => x.tipo === "completo" || x.tipo === "meio" || x.tipo === "terco");
  if (conjuradoras.length === 0) return 0;
  const unica = conjuradoras[0];
  if (conjuradoras.length === 1 && unica) {
    const { c, tipo } = unica;
    if (tipo === "completo") return c.nivel;
    if (tipo === "meio") return c.nivel >= 2 ? Math.ceil(c.nivel / 2) : 0;
    return c.nivel >= 3 ? Math.ceil(c.nivel / 3) : 0;
  }
  let total = 0;
  for (const { c, tipo } of conjuradoras) {
    if (tipo === "completo") total += c.nivel;
    else if (tipo === "meio") total += Math.floor(c.nivel / 2);
    else total += Math.floor(c.nivel / 3);
  }
  return total;
}

/** Espaços de magia por nível ([1º ... 9º]) de um conjurador de nível N; sem nível, vazio. */
export function espacosDeMagia(nivelDeConjuradorTotal: number): number[] {
  if (nivelDeConjuradorTotal <= 0) return [];
  const linha = ESPACOS_POR_NIVEL_DE_CONJURADOR[Math.min(20, nivelDeConjuradorTotal) - 1];
  return linha ? [...linha] : [];
}

/** Espaços de pacto do Bruxo: soma os níveis de Bruxo; `null` sem Bruxo. */
export function pactoDoBruxo(
  classes: readonly ClasseDaFicha[],
): { quantidade: number; nivel: number } | null {
  const bruxo = CLASSES.find((c) => c.id === "bruxo");
  const nivel = classes
    .filter((c) => classeSrd(c.classe)?.id === bruxo?.id)
    .reduce((t, c) => t + c.nivel, 0);
  if (nivel <= 0) return null;
  return PACTO_DO_BRUXO[Math.min(20, nivel) - 1] ?? null;
}

export type Conjuradora = {
  classe: string;
  habilidade: Atributo;
  cd: number;
  ataque: number;
};

/** Uma entrada por classe que conjura (inclusive o Bruxo): habilidade, CD e ataque de magia. */
export function conjuradoras(f: Ficha): Conjuradora[] {
  const prof = bonusDeProficiencia(f);
  const lista: Conjuradora[] = [];
  for (const c of f.classes ?? []) {
    const srd = classeSrd(c.classe);
    const tipo = tipoDeConjurador(c);
    if (!srd || tipo === "nenhum") continue;
    const sobrescrita = f.conjuracao?.find((x) => semAcento(x.classe) === semAcento(c.classe));
    // Subclasse de terço (Cavaleiro Místico, Trapaceiro Arcano) conjura com Inteligência.
    const habilidade = sobrescrita?.habilidade ?? srd.habilidade ?? "int";
    const mod = modDoAtributo(f, habilidade);
    lista.push({ classe: c.classe, habilidade, cd: 8 + prof + mod, ataque: prof + mod });
  }
  return lista;
}

export type EspacoDeMagia = { nivel: number; total: number; gastos: number; restantes: number };

export function espacosDaFicha(f: Ficha): EspacoDeMagia[] {
  const calculado = espacosDeMagia(nivelDeConjurador(f.classes ?? []));
  const sobrescrito = f.espacosTotal ?? {};
  // Sem total escrito à mão vale a conta das classes; com ele, o escrito vence nos níveis que ele cobre.
  const total =
    Object.keys(sobrescrito).length === 0
      ? calculado
      : NIVEIS_DE_ESPACO.map((n, i) => sobrescrito[n] ?? calculado[i] ?? 0).filter((_t, i, todos) =>
          todos.slice(i).some((x) => x > 0),
        );
  return total.map((t, i) => {
    const gastos = Math.min(t, f.espacosGastos?.[String(i + 1) as "1"] ?? 0);
    return { nivel: i + 1, total: t, gastos, restantes: t - gastos };
  });
}

export type PactoDaFicha = { quantidade: number; nivel: number; gastos: number; restantes: number };

export function pactoDaFicha(f: Ficha): PactoDaFicha | null {
  const p = pactoDoBruxo(f.classes ?? []);
  if (!p) return null;
  const gastos = Math.min(p.quantidade, f.pactoGasto ?? 0);
  return { ...p, gastos, restantes: p.quantidade - gastos };
}

export type DadosDeVidaDoTipo = {
  dado: DadoDeVida;
  total: number;
  usados: number;
  restantes: number;
};

/** Dados de vida por tipo (pelas classes do SRD): total, usados e restantes. */
export function dadosDeVidaDaFicha(f: Ficha): DadosDeVidaDoTipo[] {
  const totais = new Map<DadoDeVida, number>();
  for (const c of f.classes ?? []) {
    const srd = classeSrd(c.classe);
    if (!srd) continue;
    const dado = `d${srd.dadoDeVida}` as DadoDeVida;
    totais.set(dado, (totais.get(dado) ?? 0) + c.nivel);
  }
  return DADOS_DE_VIDA.filter((d) => totais.has(d)).map((dado) => {
    const total = totais.get(dado) ?? 0;
    const usados = Math.min(total, f.dadosDeVidaUsados?.[dado] ?? 0);
    return { dado, total, usados, restantes: total - usados };
  });
}

export type FichaDerivada = {
  nivelTotal: number;
  proficiencia: number;
  atributos: Record<Atributo, { valor: number; mod: number }>;
  salvaguardas: Record<Atributo, { nivel: NivelDeProficiencia; total: number }>;
  pericias: {
    id: (typeof PERICIAS)[number]["id"];
    nome: string;
    atributo: Atributo;
    nivel: NivelDeProficiencia;
    total: number;
  }[];
  percepcaoPassiva: number;
  iniciativa: number;
  ca: number;
  deslocamentoFt: number;
  deslocamentoM: number;
  conjuradoras: Conjuradora[];
  nivelDeConjurador: number;
  espacos: EspacoDeMagia[];
  pacto: PactoDaFicha | null;
  dadosDeVida: DadosDeVidaDoTipo[];
};

/** Tudo o que a ficha mostra e que sai de fórmula. */
export function derivar(f: Ficha): FichaDerivada {
  const atributos = Object.fromEntries(
    ATRIBUTOS.map((a) => [a, { valor: valorDoAtributo(f, a), mod: modDoAtributo(f, a) }]),
  ) as FichaDerivada["atributos"];
  const salvaguardas = Object.fromEntries(
    ATRIBUTOS.map((a) => [
      a,
      { nivel: f.salvaguardas?.[a]?.nivel ?? "nenhuma", total: bonusDeSalvaguarda(f, a) },
    ]),
  ) as FichaDerivada["salvaguardas"];
  const deslocamentoFt = f.deslocamentoFt ?? 30;
  return {
    nivelTotal: nivelTotal(f),
    proficiencia: bonusDeProficiencia(f),
    atributos,
    salvaguardas,
    pericias: PERICIAS.map((p) => ({
      id: p.id,
      nome: p.nome,
      atributo: p.atributo,
      nivel: f.pericias?.[p.id]?.nivel ?? "nenhuma",
      total: bonusDePericia(f, p.id),
    })),
    percepcaoPassiva: percepcaoPassiva(f),
    iniciativa: iniciativa(f),
    ca: f.ca?.valor ?? 10 + modDoAtributo(f, "des"),
    deslocamentoFt,
    deslocamentoM: pesParaMetros(deslocamentoFt),
    conjuradoras: conjuradoras(f),
    nivelDeConjurador: nivelDeConjurador(f.classes ?? []),
    espacos: espacosDaFicha(f),
    pacto: pactoDaFicha(f),
    dadosDeVida: dadosDeVidaDaFicha(f),
  };
}

/** O valor das moedas da ficha em peças de ouro (1 po = 10 pp = 100 pc; 1 pe = 0,5 po; 1 pl = 10 po). */
export function moedasEmOuro(f: Ficha): number {
  const m = f.moedas ?? {};
  const total =
    (m.pc ?? 0) / 100 + (m.pp ?? 0) / 10 + (m.pe ?? 0) / 2 + (m.po ?? 0) + (m.pl ?? 0) * 10;
  return Math.round(total * 100) / 100;
}

/** A carga do equipamento, em quilos: a soma de quantidade vezes peso de cada item (sem peso conta zero). */
export function cargaDaFicha(f: Ficha): number {
  const total = (f.itens ?? []).reduce((t, i) => t + i.quantidade * (i.peso ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Tira `dano` PV: os temporários absorvem primeiro, o resto sai dos atuais (nunca abaixo de 0). Devolve os dois
 * valores novos.
 */
export function receberDano(
  f: Pick<Ficha, "pvAtual" | "pvTemp">,
  dano: number,
): { pvAtual: number; pvTemp: number } {
  const temp = f.pvTemp ?? 0;
  const absorvido = Math.min(temp, Math.max(0, dano));
  return {
    pvTemp: temp - absorvido,
    pvAtual: Math.max(0, f.pvAtual - (Math.max(0, dano) - absorvido)),
  };
}

/** Modificador de bônus assinado para mostrar: `+4`, `-1`, `+0`. */
export function formatarBonus(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

// ---------------------------------------------------------------------------------------------
// Descansos
// ---------------------------------------------------------------------------------------------

/** Tira as chaves com valor `undefined` (a ficha vai para JSON e para o zod com `exactOptionalPropertyTypes`). */
function limpa(f: Ficha): Ficha {
  return JSON.parse(JSON.stringify(f)) as Ficha;
}

/** Descanso curto: recursos de recarga curta voltam ao máximo e os espaços de pacto são recuperados. */
export function descansoCurto(f: Ficha): Ficha {
  const { pactoGasto: _pacto, ...resto } = f;
  return limpa({
    ...resto,
    ...(f.recursos
      ? {
          recursos: f.recursos.map((r) => (r.recarga === "curto" ? { ...r, atual: r.max } : r)),
        }
      : {}),
  });
}

/**
 * Descanso longo: PV ao máximo (e sem PV temporário), recupera metade dos dados de vida (no mínimo 1,
 * dos maiores tipos primeiro), todos os espaços e os recursos de recarga curta ou longa, e zera os
 * testes contra a morte.
 */
export function descansoLongo(f: Ficha): Ficha {
  const dados = dadosDeVidaDaFicha(f);
  const total = dados.reduce((t, d) => t + d.total, 0);
  let devolver = Math.max(1, Math.floor(total / 2));
  const usados: Record<string, number> = { ...f.dadosDeVidaUsados };
  for (const d of [...dados].sort((a, b) => Number(b.dado.slice(1)) - Number(a.dado.slice(1)))) {
    const volta = Math.min(devolver, d.usados);
    if (volta > 0) usados[d.dado] = d.usados - volta;
    devolver -= volta;
  }
  const {
    pactoGasto: _pacto,
    espacosGastos: _espacos,
    mortes: _mortes,
    pvTemp: _temp,
    dadosDeVidaUsados: _dv,
    ...resto
  } = f;
  const dadosRestantes = Object.fromEntries(Object.entries(usados).filter(([, v]) => v > 0));
  return limpa({
    ...resto,
    pvAtual: f.pvMax,
    ...(Object.keys(dadosRestantes).length > 0
      ? { dadosDeVidaUsados: dadosRestantes as Ficha["dadosDeVidaUsados"] }
      : {}),
    ...(f.recursos
      ? {
          recursos: f.recursos.map((r) =>
            r.recarga === "curto" || r.recarga === "longo" ? { ...r, atual: r.max } : r,
          ),
        }
      : {}),
  } as Ficha);
}

// ---------------------------------------------------------------------------------------------
// Operações de gravação ({ caminho, valor }) — o navegador junta as mudanças e a sala aplica
// ---------------------------------------------------------------------------------------------

export const MAXIMO_DE_OPERACOES = 200;

/** Tamanho em bytes (UTF-8) do JSON de um valor. */
export function bytesDoJson(valor: unknown): number {
  const texto = JSON.stringify(valor);
  let bytes = 0;
  for (const ch of texto) {
    const c = ch.codePointAt(0) ?? 0;
    bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Uma mudança: `caminho` com pontos (`atributos.for`, `itens.2.quantidade`; número = posição na lista;
 * vazio = a ficha inteira) e `valor` (`null` remove o campo, ou o elemento da lista).
 */
export const OperacaoDeFichaSchema = z.object({
  caminho: z.string().max(200),
  valor: z.unknown(),
});
export type OperacaoDeFicha = z.infer<typeof OperacaoDeFichaSchema>;

const CHAVES_PROIBIDAS = new Set(["__proto__", "constructor", "prototype"]);

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function aplicarUma(
  raiz: unknown,
  op: OperacaoDeFicha,
): { ok: true; raiz: unknown } | { ok: false; motivo: string } {
  if (op.caminho === "") {
    return ehObjeto(op.valor)
      ? { ok: true, raiz: op.valor }
      : { ok: false, motivo: "A ficha inteira precisa ser um objeto." };
  }
  const partes = op.caminho.split(".");
  if (partes.some((p) => p === "" || CHAVES_PROIBIDAS.has(p))) {
    return { ok: false, motivo: `Caminho inválido: ${op.caminho}` };
  }
  let atual: unknown = raiz;
  for (let i = 0; i < partes.length; i++) {
    const chave = partes[i] as string;
    const ultima = i === partes.length - 1;
    const indice = /^\d+$/.test(chave) ? Number(chave) : null;
    if (Array.isArray(atual)) {
      if (indice === null || indice > atual.length)
        return { ok: false, motivo: `Posição inválida: ${op.caminho}` };
      if (ultima) {
        if (op.valor === null) atual.splice(indice, 1);
        else atual[indice] = op.valor;
        return { ok: true, raiz };
      }
      if (atual[indice] === undefined || atual[indice] === null) {
        atual[indice] = /^\d+$/.test(partes[i + 1] as string) ? [] : {};
      }
      atual = atual[indice];
      continue;
    }
    if (!ehObjeto(atual)) return { ok: false, motivo: `Caminho inválido: ${op.caminho}` };
    if (ultima) {
      if (op.valor === null || op.valor === undefined) delete atual[chave];
      else atual[chave] = op.valor;
      return { ok: true, raiz };
    }
    if (atual[chave] === undefined || atual[chave] === null) {
      atual[chave] = /^\d+$/.test(partes[i + 1] as string) ? [] : {};
    }
    atual = atual[chave];
  }
  return { ok: true, raiz };
}

export type ResultadoDeOperacoes = { ok: true; ficha: Ficha } | { ok: false; motivo: string };

/**
 * Aplica as operações numa cópia da ficha e valida o resultado inteiro (zod e 256 KB). Falhou uma,
 * nada vale. Os PV atuais nunca passam do máximo.
 */
export function aplicarOperacoes(
  ficha: Ficha | undefined,
  operacoes: readonly OperacaoDeFicha[],
): ResultadoDeOperacoes {
  let raiz: unknown = JSON.parse(JSON.stringify(ficha ?? fichaNova(0)));
  for (const op of operacoes) {
    const r = aplicarUma(raiz, op);
    if (!r.ok) return r;
    raiz = r.raiz;
  }
  const lida = FichaSchema.safeParse(raiz);
  if (!lida.success) {
    const problema = lida.error.issues[0];
    return {
      ok: false,
      motivo: `Ficha inválida em ${problema?.path.join(".") ?? ""}: ${problema?.message ?? ""}`,
    };
  }
  const nova = lida.data;
  if (bytesDoJson(nova) > TAMANHO_MAXIMO_DA_FICHA) {
    return { ok: false, motivo: "A ficha passa de 256 KB." };
  }
  return { ok: true, ficha: nova.pvAtual > nova.pvMax ? { ...nova, pvAtual: nova.pvMax } : nova };
}

/** As operações que levam `antes` a `depois`, uma por campo de primeiro nível que mudou. */
export function operacoesDeDiferenca(antes: Ficha, depois: Ficha): OperacaoDeFicha[] {
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  const ops: OperacaoDeFicha[] = [];
  for (const k of chaves) {
    const a = (antes as Record<string, unknown>)[k];
    const d = (depois as Record<string, unknown>)[k];
    if (JSON.stringify(a) === JSON.stringify(d)) continue;
    ops.push({ caminho: k, valor: d === undefined ? null : d });
  }
  return ops;
}

// ---------------------------------------------------------------------------------------------
// Exportar e importar a ficha (JSON)
// ---------------------------------------------------------------------------------------------

export const FORMATO_DA_FICHA = "tabletop-ficha";
/**
 * Versão 2 (V4a): a ficha ganhou os campos da ficha de papel. É só acréscimo (tudo opcional), então o arquivo da
 * versão 1 continua lendo igual.
 */
export const VERSAO_DA_FICHA = 2 as const;

export const ArquivoDeFichaSchema = z.object({
  formato: z.literal(FORMATO_DA_FICHA),
  versao: z.union([z.literal(1), z.literal(2)]),
  nome: z.string().max(64).optional(),
  exportadoEm: z.string().optional(),
  ficha: FichaSchema,
});
export type ArquivoDeFicha = z.infer<typeof ArquivoDeFichaSchema>;

export function criarArquivoDeFicha(nome: string, ficha: Ficha, agora: string): ArquivoDeFicha {
  return { formato: FORMATO_DA_FICHA, versao: VERSAO_DA_FICHA, nome, exportadoEm: agora, ficha };
}

/** Lê um arquivo de ficha (o de `criarArquivoDeFicha`) e confere o tamanho. */
export function lerArquivoDeFicha(
  bruto: unknown,
): { ok: true; arquivo: ArquivoDeFicha } | { ok: false; motivo: string } {
  const r = ArquivoDeFichaSchema.safeParse(bruto);
  if (!r.success) {
    const p = r.error.issues[0];
    return { ok: false, motivo: `${p?.path.join(".") ?? ""}: ${p?.message ?? ""}` };
  }
  if (bytesDoJson(r.data.ficha) > TAMANHO_MAXIMO_DA_FICHA) {
    return { ok: false, motivo: "A ficha passa de 256 KB." };
  }
  return { ok: true, arquivo: r.data };
}

// ---------------------------------------------------------------------------------------------
// Personagem: Inteligência, mochila antiga e sigilo
// ---------------------------------------------------------------------------------------------

type ComFicha = Pick<Personagem, "ficha" | "modInteligencia">;

/** A ficha tem atributos preenchidos? (Sem isso vale o campo antigo `modInteligencia`.) */
export function fichaPreenchida(f: Ficha | undefined): boolean {
  return f?.atributos?.int !== undefined;
}

/**
 * Modificador de Inteligência do personagem (alcance da memória do mapa): vem do atributo da ficha;
 * sem ficha preenchida usa o campo antigo `modInteligencia` (reserva), e sem ele, 0.
 */
export function modInteligenciaDoPersonagem(p: ComFicha): number {
  if (p.ficha && fichaPreenchida(p.ficha)) return modDoAtributo(p.ficha, "int");
  return p.modInteligencia ?? 0;
}

/**
 * A `mochila` do Lote 7 (modelo → quantidade de novas) vira itens da ficha com `modeloId`; a
 * quantidade é o número de objetos novos. Idempotente: sem `mochila` devolve o mesmo personagem, e um
 * modelo que já tem item na ficha não é duplicado. Só leitura do formato antigo: nada é regravado.
 */
export function absorverMochila(
  p: Personagem,
  modelos: readonly { id: string; nome: string }[],
): Personagem {
  if (p.mochila === undefined) return p;
  const { mochila, ...resto } = p;
  const ficha: Ficha = p.ficha ?? fichaNova(0);
  const itens = [...(ficha.itens ?? [])];
  for (const [modeloId, quantidade] of Object.entries(mochila)) {
    if (quantidade <= 0 || itens.some((i) => i.modeloId === modeloId)) continue;
    const nome = modelos.find((m) => m.id === modeloId)?.nome ?? modeloId;
    itens.push({ nome, quantidade, modeloId });
  }
  return { ...resto, ficha: itens.length > 0 ? { ...ficha, itens } : ficha };
}

/** Quantas unidades NOVAS do modelo o personagem tem (soma os itens com esse `modeloId`). */
export function novasDoModelo(f: Ficha | undefined, modeloId: string): number {
  return (f?.itens ?? [])
    .filter((i) => i.modeloId === modeloId)
    .reduce((t, i) => t + i.quantidade, 0);
}

/**
 * Os modelos de objeto cuja quantidade de itens NOVOS aumentou de `antes` para `depois` (item novo com
 * `modeloId` conta). Só o mestre repõe tochas (`mochila.ajustar`, Lote 7): quem edita a própria ficha
 * pode gastar, mas não criar luz do nada.
 */
export function modelosAumentados(antes: Ficha | undefined, depois: Ficha): string[] {
  const ids = new Set(
    (depois.itens ?? []).flatMap((i) => (i.modeloId === undefined ? [] : [i.modeloId])),
  );
  return [...ids].filter((id) => novasDoModelo(depois, id) > novasDoModelo(antes, id));
}

/**
 * Soma `delta` (positivo ou negativo) às unidades NOVAS do modelo: o ganho vai para o primeiro item com
 * esse `modeloId` (criado, com o nome do modelo, se não houver) e a perda sai dos itens na ordem; nunca
 * abaixo de 0 nem acima de 9999 no total.
 */
export function ajustarNovas(
  ficha: Ficha | undefined,
  modelo: { id: string; nome: string },
  delta: number,
): Ficha {
  const base = ficha ?? fichaNova(0);
  const itens = (base.itens ?? []).map((i) => ({ ...i }));
  const atual = itens.filter((i) => i.modeloId === modelo.id).reduce((t, i) => t + i.quantidade, 0);
  const nova = Math.min(9999, Math.max(0, atual + delta));
  if (nova > atual) {
    const primeiro = itens.find((i) => i.modeloId === modelo.id);
    if (primeiro) primeiro.quantidade += nova - atual;
    else itens.push({ nome: modelo.nome, quantidade: nova - atual, modeloId: modelo.id });
  } else if (nova < atual) {
    let tirar = atual - nova;
    for (const i of itens) {
      if (i.modeloId !== modelo.id || tirar <= 0) continue;
      const t = Math.min(tirar, i.quantidade);
      i.quantidade -= t;
      tirar -= t;
    }
  }
  return { ...base, itens };
}
