import { z } from "zod";
import {
  ATRIBUTOS,
  type Ataque,
  AtaqueSchema,
  type Atributo,
  AtributoSchema,
  aplicarEntradaNaFicha,
  aplicarOperacoes,
  CaracteristicaSchema,
  classeSrd,
  type Ficha,
  FichaSchema,
  type IDS_DE_PERICIA,
  type ItemDaFicha,
  type Magia,
  MagiaSchema,
  type ModeloDeObjeto,
  MoedasSchema,
  modDoAtributo,
  NpcSchema,
  normalizarBusca,
  PERICIAS,
  RecursoSchema,
  semAcento,
} from "../index.ts";
import type { CompendioLocal } from "./compendio.ts";
import { ErroDoMcp } from "./erros.ts";
import { achar } from "./nomes.ts";

// A ficha montada por partes: a IA diz o que quer ("anão clérigo nível 3, estes atributos, estas perícias, estas magias")
// e este arquivo faz a conta que a mesa faz (modificadores, proficiência, CA, PV por classe e nível) e as operações do
// compêndio. Tudo puro; quem fala com a sala é a ferramenta `fichas`.

const Texto = (max: number) => z.string().max(max);

export const ItemPedidoSchema = z
  .object({
    nome: z.string().min(1).max(80),
    quantidade: z.number().int().min(0).max(9999).optional().describe("Padrão 1."),
    peso: z.number().min(0).max(99_999).optional().describe("Peso de uma unidade, em quilos."),
    nota: Texto(500).optional(),
    modelo: z
      .string()
      .optional()
      .describe('Nome de um modelo de objeto da mesa (ex.: "Tocha 5e"): o item acende da ficha.'),
  })
  .strict();
export type ItemPedido = z.infer<typeof ItemPedidoSchema>;

const MagiaPedidaSchema = MagiaSchema.partial({ preparada: true, descricao: true }).strict();

const AtributosSchema = z
  .object(Object.fromEntries(ATRIBUTOS.map((a) => [a, z.number().int().min(1).max(30).optional()])))
  .strict();

const PericiaPedidaSchema = z.union([
  z.string(),
  z
    .object({ nome: z.string(), nivel: z.enum(["proficiente", "especialista"]).optional() })
    .strict(),
]);

export const FichaPartesSchema = z
  .object({
    raca: Texto(64).optional(),
    antecedente: Texto(64).optional(),
    alinhamento: Texto(64).optional(),
    classes: z
      .array(
        z
          .object({
            classe: z.string().min(1).max(48),
            nivel: z.number().int().min(1).max(20),
            subclasse: Texto(48).optional(),
          })
          .strict(),
      )
      .max(12)
      .optional()
      .describe('Troca as classes. Ex.: [{"classe":"Clérigo","nivel":3}].'),
    atributos: AtributosSchema.optional().describe(
      "Valores finais (com bônus de raça): for, des, con, int, sab, car. Só os que vierem mudam.",
    ),
    salvaguardas: z
      .array(z.string())
      .optional()
      .describe(
        "Atributos com proficiência em salvaguarda (for, des...). Sem isto, a criação usa as da primeira classe.",
      ),
    pericias: z
      .array(PericiaPedidaSchema)
      .optional()
      .describe(
        'Perícias proficientes: "Percepção" ou {"nome":"Furtividade","nivel":"especialista"}.',
      ),
    pv: z
      .object({
        max: z.number().int().min(0).max(9999),
        atual: z.number().int().min(0).max(9999).optional(),
      })
      .strict()
      .optional()
      .describe("Sem isto, a criação calcula pela classe, nível e Constituição (valor médio)."),
    ca: z
      .number()
      .int()
      .min(0)
      .max(50)
      .optional()
      .describe("Classe de armadura (sem isto vale 10 + Des)."),
    deslocamentoFt: z.number().int().min(0).max(500).optional().describe("Em pés (30 = 9 m)."),
    ataques: z.array(AtaqueSchema).max(100).optional().describe("Adiciona ou atualiza pelo nome."),
    magias: z
      .array(MagiaPedidaSchema)
      .max(100)
      .optional()
      .describe(
        'Magias escritas à mão (nome e nível; o resto é opcional). Para as do compêndio use `compendio`. Campos de conjuração: `ritual` (true = o Conjurar ganha "Ritual · sem espaço"), `porNivelAcima` ("1d6" de dano ou "1 dardo"/"1 raio"/"1 alvo"/"1 criatura" por nível de espaço acima), `quantidadeBase` (3 dardos), `dadosPorNivel` (truque: [{"nivel":5,"expressao":"1d10"}], o dado a mais no nível do personagem) e `inata` (magia inata do NPC: {"frequencia":"vontade"} ou {"frequencia":"cada","max":1} para "1/dia cada" ou {"frequencia":"grupo"} para o contador "N/dia"; não gasta espaço).',
      ),
    conjuracaoInata: z
      .object({
        habilidade: AtributoSchema.optional().describe(
          'O atributo da conjuração inata ("car" para o monstro com Carisma).',
        ),
        cd: z.number().int().min(0).max(40).optional().describe("CD da conjuração inata (13)."),
        grupo: z
          .object({ max: z.number().int().min(1).max(20) })
          .strict()
          .optional()
          .describe('Usos por dia do grupo "N/dia" (as magias com inata.frequencia "grupo").'),
      })
      .strict()
      .optional()
      .describe(
        "Só para conjuração inata (monstro): atributo, CD e o contador do grupo. As magias inatas vão em `magias` com o campo `inata`.",
      ),
    compendio: z
      .array(z.string())
      .max(100)
      .optional()
      .describe(
        'Nomes do compêndio: magias, armas e itens ("Bola de Fogo", "Espada Longa"). Arma vira ataque calculado, magia vai para a lista de magias, item para o equipamento.',
      ),
    itens: z
      .array(ItemPedidoSchema)
      .max(100)
      .optional()
      .describe("Itens e equipamento. Se o item já existe, a quantidade passa ao valor dado."),
    caracteristicas: z
      .array(CaracteristicaSchema)
      .max(100)
      .optional()
      .describe("Traços, adiciona ou atualiza pelo nome."),
    recursos: z.array(RecursoSchema).max(30).optional(),
    moedas: MoedasSchema.optional(),
    idiomas: z.array(z.string().min(1).max(40)).max(30).optional(),
    historia: Texto(20_000).optional(),
    personalidade: Texto(2000).optional(),
    ideais: Texto(2000).optional(),
    ligacoes: Texto(2000).optional(),
    defeitos: Texto(2000).optional(),
    aparencia: Texto(4000).optional(),
    notas: Texto(50_000).optional(),
    npc: NpcSchema.optional().describe(
      "Só NPC: tamanho, tipo, nd (nível de desafio), sentidos, resistências...",
    ),
    remover: z
      .object({
        ataques: z.array(z.string()).optional(),
        magias: z.array(z.string()).optional(),
        itens: z.array(z.string()).optional(),
        caracteristicas: z.array(z.string()).optional(),
      })
      .strict()
      .optional()
      .describe("Nomes a tirar da ficha."),
  })
  .strict();
export type FichaPartes = z.infer<typeof FichaPartesSchema>;

/** "força", "FOR", "Forca" -> "for". */
export function lerAtributo(texto: string): Atributo {
  const t = semAcento(texto);
  const achado = ATRIBUTOS.find(
    (a) =>
      a === t || semAcento(nomeDoAtributo(a)) === t || semAcento(nomeDoAtributo(a)).startsWith(t),
  );
  if (!achado || t.length < 3) {
    throw new ErroDoMcp(
      `"${texto}" não é um atributo. Use for, des, con, int, sab ou car (ou Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma).`,
    );
  }
  return achado;
}

export function nomeDoAtributo(a: Atributo): string {
  return {
    for: "Força",
    des: "Destreza",
    con: "Constituição",
    int: "Inteligência",
    sab: "Sabedoria",
    car: "Carisma",
  }[a];
}

/** "percepção", "Adestrar Animais", "adestrarAnimais" -> id da perícia. */
export function lerPericia(texto: string): (typeof IDS_DE_PERICIA)[number] {
  const t = normalizarBusca(texto).replace(/\s+/g, "");
  const exata = PERICIAS.find(
    (p) => normalizarBusca(p.nome).replace(/\s+/g, "") === t || normalizarBusca(p.id) === t,
  );
  if (exata) return exata.id;
  const parecidas = PERICIAS.filter((p) =>
    normalizarBusca(p.nome).replace(/\s+/g, "").startsWith(t),
  );
  if (parecidas.length === 1 && t.length >= 4)
    return (parecidas[0] as (typeof PERICIAS)[number]).id;
  throw new ErroDoMcp(
    `"${texto}" não é uma perícia do 5e. As perícias são: ${PERICIAS.map((p) => p.nome).join(", ")}.`,
  );
}

/**
 * Os PV médios por classe e nível: o primeiro nível da primeira classe vale o dado cheio; os outros, o valor médio do
 * dado (dado/2 + 1); cada nível soma o modificador de Constituição (no mínimo 1 por nível).
 */
export function pvPorClasses(
  classes: readonly { classe: string; nivel: number }[],
  modCon: number,
): number | null {
  let total = 0;
  let primeiro = true;
  for (const c of classes) {
    const srd = classeSrd(c.classe);
    if (!srd) return null;
    for (let n = 1; n <= c.nivel; n++) {
      const base = primeiro ? srd.dadoDeVida : Math.floor(srd.dadoDeVida / 2) + 1;
      total += Math.max(1, base + modCon);
      primeiro = false;
    }
  }
  return total > 0 ? Math.min(9999, total) : null;
}

export type OpcoesDeMontagem = {
  /** Bloco de NPC (ações e traços) em vez de ficha de personagem. */
  npc: boolean;
  /** `true` ao criar: calcula PV e salvaguardas que a pessoa não deu. */
  criando: boolean;
  compendio: CompendioLocal;
  modelos: readonly ModeloDeObjeto[];
};

export type FichaMontada = { ficha: Ficha; avisos: string[] };

function clonar<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function upsertPorNome<T extends { nome: string }>(lista: T[], novo: T): void {
  const alvo = normalizarBusca(novo.nome);
  const i = lista.findIndex((x) => normalizarBusca(x.nome) === alvo);
  if (i >= 0) lista[i] = novo;
  else lista.push(novo);
}

function tirarPorNome<T extends { nome: string }>(
  lista: T[] | undefined,
  nomes: readonly string[],
  rotulo: string,
  avisos: string[],
): T[] | undefined {
  if (!lista) return lista;
  let atual = lista;
  for (const n of nomes) {
    const alvo = normalizarBusca(n);
    const restante = atual.filter((x) => normalizarBusca(x.nome) !== alvo);
    if (restante.length === atual.length) avisos.push(`${rotulo} "${n}" não estava na ficha.`);
    atual = restante;
  }
  return atual;
}

/** Monta a ficha: parte da ficha atual (ou de uma em branco) e aplica as partes, na ordem que a mesa faria as contas. */
export function montarFicha(
  base: Ficha | undefined,
  partes: FichaPartes,
  o: OpcoesDeMontagem,
): FichaMontada {
  const avisos: string[] = [];
  let f: Ficha = clonar(base ?? { pvAtual: 0, pvMax: 0 });
  if (o.npc) f.apresentacao = "npc";

  if (partes.raca !== undefined) f.raca = partes.raca;
  if (partes.antecedente !== undefined) f.antecedente = partes.antecedente;
  if (partes.alinhamento !== undefined) f.alinhamento = partes.alinhamento;
  if (partes.atributos) {
    f.atributos = { ...(f.atributos ?? {}) };
    for (const [a, v] of Object.entries(partes.atributos)) {
      if (v !== undefined) (f.atributos as Record<string, number>)[a] = v;
    }
  }
  if (partes.classes) {
    f.classes = partes.classes.map((c) => ({
      ...c,
      classe: classeSrd(c.classe)?.nome ?? c.classe,
    }));
    for (const c of partes.classes) {
      if (!classeSrd(c.classe)) {
        avisos.push(
          `"${c.classe}" não é uma classe do SRD: a conjuração e os PV não saem sozinhos.`,
        );
      }
    }
  }
  // Salvaguardas: as pedidas, ou as da primeira classe ao criar.
  if (partes.salvaguardas) {
    const proficientes = new Set(partes.salvaguardas.map(lerAtributo));
    f.salvaguardas = Object.fromEntries(
      [...proficientes].map((a) => [a, { nivel: "proficiente" as const }]),
    );
  } else if (o.criando && f.classes?.[0]) {
    const srd = classeSrd(f.classes[0].classe);
    if (srd) {
      f.salvaguardas = Object.fromEntries(
        srd.salvaguardas.map((a) => [a, { nivel: "proficiente" as const }]),
      );
    }
  }
  if (partes.pericias) {
    const pericias = { ...(f.pericias ?? {}) };
    for (const p of partes.pericias) {
      const nome = typeof p === "string" ? p : p.nome;
      const nivel = typeof p === "string" ? "proficiente" : (p.nivel ?? "proficiente");
      pericias[lerPericia(nome)] = { nivel };
    }
    f.pericias = pericias;
  }
  if (partes.ca !== undefined) f.ca = { valor: partes.ca };
  if (partes.deslocamentoFt !== undefined) f.deslocamentoFt = partes.deslocamentoFt;

  // Pontos de vida: o que a pessoa deu, ou o cálculo da mesa (classe, nível e Constituição) ao criar.
  if (partes.pv) {
    f.pvMax = partes.pv.max;
    f.pvAtual = Math.min(partes.pv.atual ?? partes.pv.max, partes.pv.max);
  } else if (o.criando && f.pvMax === 0) {
    const calculado = f.classes ? pvPorClasses(f.classes, modDoAtributo(f, "con")) : null;
    const pv = calculado ?? 10;
    f.pvMax = pv;
    f.pvAtual = pv;
    if (calculado === null) {
      avisos.push("Sem PV e sem classe do SRD: pus 10 PV. Diga `pv` se for outro valor.");
    }
  }

  if (partes.npc) f.npc = { ...(f.npc ?? {}), ...partes.npc };

  if (partes.ataques) {
    const lista: Ataque[] = [...(f.ataques ?? [])];
    for (const a of partes.ataques) upsertPorNome(lista, a);
    f.ataques = lista;
  }
  if (partes.magias) {
    const lista: Magia[] = [...(f.magias ?? [])];
    for (const m of partes.magias) {
      upsertPorNome(lista, { preparada: true, descricao: "", ...m });
    }
    f.magias = lista;
  }
  if (partes.conjuracaoInata) {
    const { habilidade, cd, grupo } = partes.conjuracaoInata;
    const antes = f.inata;
    f.inata = {
      ...antes,
      ...(habilidade ? { habilidade } : {}),
      ...(cd !== undefined ? { cd } : {}),
      ...(grupo
        ? { grupo: { max: grupo.max, gastos: Math.min(antes?.grupo?.gastos ?? 0, grupo.max) } }
        : {}),
    };
  }
  if (partes.itens) {
    const lista: ItemDaFicha[] = [...(f.itens ?? [])];
    for (const i of partes.itens) {
      const novo: ItemDaFicha = {
        nome: i.nome,
        quantidade: i.quantidade ?? 1,
        ...(i.peso !== undefined ? { peso: i.peso } : {}),
        ...(i.nota !== undefined ? { nota: i.nota } : {}),
      };
      if (i.modelo !== undefined) {
        novo.modeloId = achar(o.modelos, i.modelo, {
          rotulo: "modelo de objeto",
          nomeDe: (m) => m.nome,
          idDe: (m) => m.id,
        }).id;
      }
      const existente = lista.find((x) => normalizarBusca(x.nome) === normalizarBusca(i.nome));
      upsertPorNome(lista, { ...existente, ...novo });
    }
    f.itens = lista;
  }
  if (partes.caracteristicas) {
    const lista = [...(f.caracteristicas ?? [])];
    for (const c of partes.caracteristicas) upsertPorNome(lista, c);
    f.caracteristicas = lista;
  }
  if (partes.recursos) {
    const lista = [...(f.recursos ?? [])];
    for (const r of partes.recursos) upsertPorNome(lista, r);
    f.recursos = lista;
  }
  if (partes.moedas) f.moedas = { ...(f.moedas ?? {}), ...partes.moedas };
  if (partes.idiomas) f.idiomas = partes.idiomas;
  for (const campo of [
    "historia",
    "personalidade",
    "ideais",
    "ligacoes",
    "defeitos",
    "aparencia",
    "notas",
  ] as const) {
    if (partes[campo] !== undefined) f[campo] = partes[campo];
  }

  // Do compêndio: cada nome vira as operações que a mesa aplica ao soltar a entrada na ficha.
  for (const nome of partes.compendio ?? []) {
    const entrada = o.compendio.achar(nome);
    // As operações do compêndio calculam sobre a ficha que já tem os atributos e as classes.
    const r = aplicarEntradaNaFicha(f, entrada, o.npc ? "npc" : "personagem");
    if (!r.ok) {
      avisos.push(r.motivo);
      continue;
    }
    const aplicada = aplicarOperacoes(f, r.operacoes);
    if (!aplicada.ok) throw new ErroDoMcp(`"${nome}": ${aplicada.motivo}`);
    f = aplicada.ficha;
  }

  if (partes.remover) {
    const r = partes.remover;
    if (r.ataques) f.ataques = tirarPorNome(f.ataques, r.ataques, "Ataque", avisos);
    if (r.magias) f.magias = tirarPorNome(f.magias, r.magias, "Magia", avisos);
    if (r.itens) f.itens = tirarPorNome(f.itens, r.itens, "Item", avisos);
    if (r.caracteristicas) {
      f.caracteristicas = tirarPorNome(f.caracteristicas, r.caracteristicas, "Traço", avisos);
    }
  }

  const lida = FichaSchema.safeParse(f);
  if (!lida.success) {
    const p = lida.error.issues[0];
    throw new ErroDoMcp(
      `A ficha ficou inválida em "${p?.path.join(".") ?? ""}": ${p?.message ?? ""}. Corrija esse campo.`,
    );
  }
  const pronta = lida.data;
  return {
    ficha: pronta.pvAtual > pronta.pvMax ? { ...pronta, pvAtual: pronta.pvMax } : pronta,
    avisos,
  };
}
