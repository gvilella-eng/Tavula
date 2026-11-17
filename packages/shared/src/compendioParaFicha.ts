import { z } from "zod";
import {
  type AcaoDoMonstro,
  type ArmaDoCompendio,
  ArmaDoCompendioSchema,
  fichaTemMagia,
  ItemDoCompendioSchema,
  type ItemMagicoDoCompendio,
  ItemMagicoDoCompendioSchema,
  type MagiaDoCompendio,
  MagiaDoCompendioSchema,
  type MonstroDoCompendio,
  MonstroDoCompendioSchema,
  magiaParaFicha,
  normalizarBusca,
  resumoDoItemMagico,
} from "./compendio.ts";
import type { Personagem } from "./estado.ts";
import {
  type Ataque,
  bonusPorND,
  type Caracteristica,
  type CategoriaDeAcao,
  conjuradoras,
  type Ficha,
  type ItemDaFicha,
  type Magia,
  modDoAtributo,
  type NivelDeProficiencia,
  type OperacaoDeFicha,
  type Proficiencia,
  type TipoDeAcao,
} from "./ficha.ts";
import { inserirNoGrupo, posicoesDoGrupo } from "./reordenar.ts";
import { ATRIBUTOS, type Atributo, PERICIAS, ROTULO_DO_ATRIBUTO } from "./srd/index.ts";

// ---------------------------------------------------------------------------------------------
// Do compêndio para a ficha (V4b). O que o arrasto e o botão "Adicionar à ficha" fazem é a mesma conta, e ela mora
// aqui, pura: uma entrada (magia, arma ou item) e a ficha viram as operações de gravação.
// ---------------------------------------------------------------------------------------------

/** O tipo de dado que o arrasto carrega no `dataTransfer`. */
export const TIPO_DO_ARRASTO_DO_COMPENDIO = "application/x-tabletop-compendio";

export const EntradaDoCompendioSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("magia"), magia: MagiaDoCompendioSchema }),
  z.object({ tipo: z.literal("arma"), arma: ArmaDoCompendioSchema }),
  z.object({ tipo: z.literal("item"), item: ItemDoCompendioSchema }),
  /** N3a: o monstro leva junto as magias dele que o compêndio tem (a ficha nova as monta sem perguntar ao compêndio). */
  z.object({
    tipo: z.literal("monstro"),
    monstro: MonstroDoCompendioSchema,
    magias: z.array(MagiaDoCompendioSchema).max(150).optional(),
  }),
  z.object({ tipo: z.literal("itemMagico"), itemMagico: ItemMagicoDoCompendioSchema }),
]);
export type EntradaDoCompendio = z.infer<typeof EntradaDoCompendioSchema>;
export type TipoDeEntrada = EntradaDoCompendio["tipo"];

/** Lê o texto do arrasto; `null` se não for uma entrada válida. */
export function lerEntradaArrastada(texto: string): EntradaDoCompendio | null {
  try {
    const r = EntradaDoCompendioSchema.safeParse(JSON.parse(texto));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Os tipos de dano do 5e, como a ficha os escreve. */
export const TIPOS_DE_DANO_5E = [
  "Contundente",
  "Cortante",
  "Perfurante",
  "Ácido",
  "Elétrico",
  "Fogo",
  "Frio",
  "Força",
  "Necrótico",
  "Psíquico",
  "Radiante",
  "Trovejante",
  "Veneno",
  "Cura",
] as const;

const SINONIMOS_DE_DANO: Record<string, string> = { gelido: "Frio", venenoso: "Veneno" };

function tipoDeDanoDoTexto(palavra: string): string {
  const achado = TIPOS_DE_DANO_5E.find((t) => normalizarBusca(t) === palavra);
  if (achado) return achado;
  return SINONIMOS_DE_DANO[palavra] ?? palavra.charAt(0).toUpperCase() + palavra.slice(1);
}

// ---------- arma ----------

const tem = (propriedades: readonly string[], prefixo: string) =>
  propriedades.some((p) => normalizarBusca(p).startsWith(prefixo));

/** O atributo do ataque da arma: Destreza à distância, o maior de Força e Destreza com acuidade, senão Força. */
export function atributoDaArma(f: Ficha, arma: ArmaDoCompendio): Atributo {
  if (arma.distancia) return "des";
  if (tem(arma.propriedades, "acuidade")) {
    return modDoAtributo(f, "des") > modDoAtributo(f, "for") ? "des" : "for";
  }
  return "for";
}

/** O chip de tipo da ação do NPC: à distância, corpo a corpo ou os dois (arremesso). */
export function tipoDeAcaoDaArma(arma: ArmaDoCompendio): TipoDeAcao {
  if (arma.distancia) return "dist";
  return tem(arma.propriedades, "arremesso") ? "cacdist" : "cac";
}

/**
 * A arma como um ataque calculado: o acerto é o atributo certo mais a proficiência (assumida), o dano leva o mesmo
 * modificador e as propriedades vão na descrição. A ficha faz as contas (no NPC, a proficiência vem do ND).
 */
export function ataqueDeArma(f: Ficha, arma: ArmaDoCompendio): Ataque {
  const atributo = atributoDaArma(f, arma);
  const propriedades =
    arma.propriedades.length > 0 ? ` Propriedades: ${arma.propriedades.join(", ")}.` : "";
  const alcance = arma.alcance ?? (arma.distancia ? undefined : "1,5 m");
  return {
    nome: arma.nome.slice(0, 80),
    acerto: { tipo: "formula", atributo, proficiente: true },
    dano: arma.dano,
    atributoDano: atributo,
    tipo: arma.tipoDeDano,
    ...(alcance ? { alcance: alcance.slice(0, 100) } : {}),
    tipoDeAcao: tipoDeAcaoDaArma(arma),
    descricao: `Arma ${arma.categoria}.${propriedades}`.slice(0, 20_000),
  };
}

// ---------- magia ----------

/** A habilidade de conjuração da ficha: a da primeira classe que conjura, a escolhida à mão ou Inteligência. */
export function habilidadeDeConjuracaoDaFicha(f: Ficha): Atributo {
  return conjuradoras(f)[0]?.habilidade ?? f.habilidadeDeConjuracao ?? "int";
}

type RolagemDaMagia = Pick<Magia, "acerto" | "dano" | "tipo" | "salvaguarda">;

/**
 * Lê o texto da magia atrás de uma jogada: "ataque de magia" vira acerto (habilidade de conjuração mais
 * proficiência) e "salvaguarda de <atributo>" vira CD, as duas com o primeiro "NdM de dano <tipo>" do texto. Sem
 * nenhuma das duas, devolve `{}` (a magia entra só na lista de magias).
 */
export function rolagemDaMagia(f: Ficha, m: MagiaDoCompendio): RolagemDaMagia {
  const texto = normalizarBusca(m.descricao);
  const habilidade = habilidadeDeConjuracaoDaFicha(f);
  const dano =
    /(\d+d\d+(?:\s*\+\s*\d+)?)\s*(?:pontos?\s+)?de dano\s+(?:de\s+|do tipo\s+)?([a-z]+)/.exec(
      texto,
    );
  const base: RolagemDaMagia = dano
    ? { dano: (dano[1] ?? "").replace(/\s+/g, ""), tipo: tipoDeDanoDoTexto(dano[2] ?? "") }
    : {};
  const salva = /salvaguarda de (forca|destreza|constituicao|inteligencia|sabedoria|carisma)/.exec(
    texto,
  );
  if (salva) {
    const alvo = ATRIBUTOS.find((a) => normalizarBusca(ROTULO_DO_ATRIBUTO[a]) === salva[1]);
    if (alvo) {
      return {
        ...base,
        salvaguarda: {
          alvo,
          cdAtributo: habilidade,
          sucesso: /metade/.test(texto) ? "metade" : "nenhum",
        },
      };
    }
  }
  if (/ataque de magia/.test(texto)) {
    return { ...base, acerto: { tipo: "formula", atributo: habilidade, proficiente: true } };
  }
  return {};
}

/** A magia como a ficha a guarda, com a jogada (ataque ou CD) quando o texto a tem. */
export function magiaParaFichaCalculada(
  f: Ficha,
  m: MagiaDoCompendio,
  opcoes: { emAtaques?: boolean } = {},
): Magia {
  const rolagem = rolagemDaMagia(f, m);
  const rola = rolagem.acerto !== undefined || rolagem.salvaguarda !== undefined;
  return {
    ...magiaParaFicha(m),
    ...(rola ? rolagem : {}),
    ...(rola || opcoes.emAtaques ? { emAtaques: true } : {}),
  };
}

/**
 * A habilidade de conjuração que um NPC sem classe ganha ao receber a primeira magia: a maior entre Inteligência,
 * Sabedoria e Carisma (empate: nessa ordem).
 */
export function habilidadeDeConjuracaoDoNpc(f: Ficha): Atributo {
  const mentais = ["int", "sab", "car"] as const;
  return mentais.reduce((melhor, a) =>
    modDoAtributo(f, a) > modDoAtributo(f, melhor) ? a : melhor,
  );
}

// ---------- aplicar ----------

export type DestinoDaEntrada = {
  /** A posição dentro da lista onde a pessoa soltou (`null` = no fim). */
  posicao: number | null;
  /** Soltar na lista "Ataques e magias": a magia aparece nela mesmo sem ser de ataque ou de salvaguarda. */
  emAtaques?: boolean;
  /** N2: soltar na parte "Conjuração inata" do NPC: a magia entra como inata (sem espaço), com esta frequência. */
  inata?: { frequencia: "vontade" | "cada" | "grupo"; max?: number };
};

export type ResultadoDaEntrada =
  | { ok: true; operacoes: OperacaoDeFicha[]; texto: string }
  | { ok: false; motivo: string };

const um = (caminho: string, valor: unknown): OperacaoDeFicha => ({ caminho, valor });
const ehAcao = (a: Ataque) => (a.categoria ?? "acao") === "acao";

/**
 * As operações que põem a entrada do compêndio na ficha. No personagem: arma vira ataque calculado, magia entra em
 * Magias (e em Ataques e magias se rola), item vai para o Equipamento (quantidade 1, mais uma se já tem). No NPC: arma
 * vira ação calculada, magia entra na seção Conjuração (em `magias`, no círculo dela) e item vira traço. `destino.posicao` é a posição dentro da
 * lista onde a pessoa soltou (`null` ou ausente = no fim).
 */
export function aplicarEntradaNaFicha(
  f: Ficha,
  entrada: EntradaDoCompendio,
  modo: "personagem" | "npc",
  destino: DestinoDaEntrada = { posicao: null },
): ResultadoDaEntrada {
  const npc = modo === "npc";
  if (entrada.tipo === "arma") {
    const base = ataqueDeArma(f, entrada.arma);
    const ataque: Ataque = npc ? { ...base, categoria: "acao" } : base;
    const lista = f.ataques ?? [];
    const grupo = posicoesDoGrupo(lista, npc ? ehAcao : () => true);
    return {
      ok: true,
      operacoes: [um("ataques", inserirNoGrupo(lista, grupo, ataque, destino.posicao))],
      texto: `${entrada.arma.nome} entrou como ${npc ? "ação" : "ataque"}.`,
    };
  }
  if (entrada.tipo === "magia") {
    const m = entrada.magia;
    const lista = f.magias ?? [];
    if (fichaTemMagia(lista, m.nome)) {
      return {
        ok: false,
        motivo: npc ? `${m.nome} já está na Conjuração.` : `${m.nome} já está na lista de magias.`,
      };
    }
    const grupo = posicoesDoGrupo(lista, (x) => x.nivel === m.nivel && !x.inata);
    // No NPC sem classe nem atributo escolhido, a primeira magia escolhe o atributo (e a conta sai dele).
    const habilidade =
      npc && conjuradoras(f).length === 0 && !f.habilidadeDeConjuracao
        ? habilidadeDeConjuracaoDoNpc(f)
        : undefined;
    const base = habilidade ? { ...f, habilidadeDeConjuracao: habilidade } : f;
    const calculada = magiaParaFichaCalculada(
      base,
      m,
      destino.emAtaques ? { emAtaques: true } : {},
    );
    // N2: na parte inata a magia não gasta espaço: vai para o fim da lista, marcada com a frequência.
    const nova: Magia = destino.inata
      ? {
          ...calculada,
          inata: {
            frequencia: destino.inata.frequencia,
            ...(destino.inata.frequencia === "vontade"
              ? {}
              : { max: Math.min(20, Math.max(1, destino.inata.max ?? 1)) }),
          },
        }
      : calculada;
    return {
      ok: true,
      operacoes: [
        um(
          "magias",
          destino.inata ? [...lista, nova] : inserirNoGrupo(lista, grupo, nova, destino.posicao),
        ),
        ...(habilidade ? [um("habilidadeDeConjuracao", habilidade)] : []),
      ],
      texto: destino.inata
        ? `${m.nome} entrou na Conjuração inata.`
        : npc
          ? `${m.nome} entrou na Conjuração.`
          : `${m.nome} entrou na lista de magias.`,
    };
  }
  if (entrada.tipo === "monstro") {
    return {
      ok: false,
      motivo: "Um monstro vira uma ficha nova: use Criar NPC, ou arraste-o para o mapa.",
    };
  }
  if (entrada.tipo === "itemMagico") return aplicarItemMagico(f, entrada.itemMagico, npc, destino);
  const item = entrada.item;
  if (npc) {
    const lista = f.caracteristicas ?? [];
    // O nome do item não muda no laço: normaliza uma vez só.
    const nomeDoTraco = normalizarBusca(item.nome);
    if (lista.some((c) => normalizarBusca(c.nome) === nomeDoTraco)) {
      return { ok: false, motivo: `${item.nome} já é um traço.` };
    }
    const traco: Caracteristica = {
      nome: item.nome.slice(0, 80),
      descricao: (item.descricao ?? "Item.").slice(0, 20_000),
    };
    const grupo = posicoesDoGrupo(lista, () => true);
    return {
      ok: true,
      operacoes: [um("caracteristicas", inserirNoGrupo(lista, grupo, traco, destino.posicao))],
      texto: `${item.nome} entrou como traço.`,
    };
  }
  const itens = f.itens ?? [];
  // O nome do item não muda no laço: normaliza uma vez só.
  const nomeDoItem = normalizarBusca(item.nome);
  const existente = itens.findIndex((i) => normalizarBusca(i.nome) === nomeDoItem);
  const atual = itens[existente];
  if (atual) {
    return {
      ok: true,
      operacoes: [um(`itens.${existente}.quantidade`, Math.min(9999, atual.quantidade + 1))],
      texto: `Mais uma unidade de ${item.nome} no equipamento.`,
    };
  }
  const novo: ItemDaFicha = {
    nome: item.nome.slice(0, 80),
    quantidade: 1,
    ...(item.peso !== undefined ? { peso: item.peso } : {}),
  };
  const grupo = posicoesDoGrupo(itens, () => true);
  return {
    ok: true,
    operacoes: [um("itens", inserirNoGrupo(itens, grupo, novo, destino.posicao))],
    texto: `${item.nome} entrou no equipamento.`,
  };
}

// ---------- item mágico (N3a) ----------

/** O texto do item mágico que vai para a nota do equipamento (ou para o traço do NPC). */
export function textoDoItemMagico(i: ItemMagicoDoCompendio): string {
  return `${resumoDoItemMagico(i)} · ${i.tipo}.\n${i.descricao}`;
}

/**
 * O item mágico na ficha. No personagem vai para o Equipamento com a descrição na nota (quantidade 1, mais uma se já
 * tem); se é uma arma com bônus, vira também um ataque com o bônus mágico (+1 a +3) (assumido). No NPC vira um traço
 * (e a ação, quando é arma).
 */
function aplicarItemMagico(
  f: Ficha,
  i: ItemMagicoDoCompendio,
  npc: boolean,
  destino: DestinoDaEntrada,
): ResultadoDaEntrada {
  const ataque: Ataque | null = i.arma
    ? {
        ...ataqueDeArma(f, i.arma),
        nome: i.nome.slice(0, 80),
        ...(i.bonus ? { bonusMagico: i.bonus } : {}),
        descricao: `${resumoDoItemMagico(i)}. ${i.descricao}`.slice(0, 20_000),
        ...(npc ? { categoria: "acao" as const } : {}),
      }
    : null;
  const operacoes: OperacaoDeFicha[] = [];
  if (npc) {
    const lista = f.caracteristicas ?? [];
    // O nome do item não muda no laço: normaliza uma vez só.
    const nomeDoTraco = normalizarBusca(i.nome);
    if (lista.some((c) => normalizarBusca(c.nome) === nomeDoTraco)) {
      return { ok: false, motivo: `${i.nome} já é um traço.` };
    }
    const traco: Caracteristica = {
      nome: i.nome.slice(0, 80),
      descricao: textoDoItemMagico(i).slice(0, 20_000),
    };
    operacoes.push(
      um(
        "caracteristicas",
        inserirNoGrupo(
          lista,
          posicoesDoGrupo(lista, () => true),
          traco,
          destino.posicao,
        ),
      ),
    );
    if (ataque) {
      const acoes = f.ataques ?? [];
      operacoes.push(
        um("ataques", inserirNoGrupo(acoes, posicoesDoGrupo(acoes, ehAcao), ataque, null)),
      );
    }
    return { ok: true, operacoes, texto: `${i.nome} entrou como traço.` };
  }
  const itens = f.itens ?? [];
  // O nome do item não muda no laço: normaliza uma vez só.
  const nomeDoItem = normalizarBusca(i.nome);
  const existente = itens.findIndex((x) => normalizarBusca(x.nome) === nomeDoItem);
  const atual = itens[existente];
  if (atual) {
    return {
      ok: true,
      operacoes: [um(`itens.${existente}.quantidade`, Math.min(9999, atual.quantidade + 1))],
      texto: `Mais uma unidade de ${i.nome} no equipamento.`,
    };
  }
  const novo: ItemDaFicha = {
    nome: i.nome.slice(0, 80),
    quantidade: 1,
    nota: textoDoItemMagico(i).slice(0, LIMITE_DA_NOTA_DO_ITEM),
    ...(i.peso !== undefined ? { peso: i.peso } : {}),
  };
  operacoes.push(
    um(
      "itens",
      inserirNoGrupo(
        itens,
        posicoesDoGrupo(itens, () => true),
        novo,
        destino.posicao,
      ),
    ),
  );
  if (ataque) {
    const ataques = f.ataques ?? [];
    operacoes.push(
      um(
        "ataques",
        inserirNoGrupo(
          ataques,
          posicoesDoGrupo(ataques, () => true),
          ataque,
          null,
        ),
      ),
    );
  }
  return {
    ok: true,
    operacoes,
    texto: ataque
      ? `${i.nome} entrou no equipamento e nos ataques.`
      : `${i.nome} entrou no equipamento.`,
  };
}

/** O tamanho máximo da nota de um item do equipamento (a ficha a aceita até aqui). */
export const LIMITE_DA_NOTA_DO_ITEM = 4000;

// ---------- monstro (N3a) ----------

/** Quantos quadrados o token do monstro ocupa: Miúdo a Médio 1, Grande 2, Enorme 3, Imenso 4. */
export function tamanhoDoTokenDoMonstro(m: Pick<MonstroDoCompendio, "tamanho">): 1 | 2 | 3 | 4 {
  const t = normalizarBusca(m.tamanho);
  if (t.startsWith("imens") || t.startsWith("gargantu")) return 4;
  if (t.startsWith("enorm")) return 3;
  if (t.startsWith("grand")) return 2;
  return 1;
}

/** As magias do compêndio que o monstro cita (inata e por espaços), sem repetir; as que faltam ficam de fora. */
export function magiasDoMonstro(
  m: MonstroDoCompendio,
  magias: readonly MagiaDoCompendio[],
): MagiaDoCompendio[] {
  const nomes = [
    ...(m.conjuracaoInata?.magias ?? []).map((x) => x.nome),
    ...(m.conjuracaoPorEspacos?.magias ?? []).map((x) => x.nome),
  ];
  const achadas = new Map<string, MagiaDoCompendio>();
  for (const nome of nomes) {
    const chave = normalizarBusca(nome);
    const m2 = magias.find(
      (x) => normalizarBusca(x.nome) === chave || normalizarBusca(x.nomeOriginal ?? "") === chave,
    );
    if (m2) achadas.set(chave, m2);
  }
  return [...achadas.values()];
}

/** O bônus total que o livro lista, escrito como proficiência mais bônus extra (o que a ficha entende). */
function proficienciaParaTotal(total: number, mod: number, prof: number): Proficiencia {
  const extra = total - mod;
  const nivel: NivelDeProficiencia =
    extra === prof
      ? "proficiente"
      : extra === prof * 2
        ? "especialista"
        : extra > prof
          ? "proficiente"
          : "nenhuma";
  const coberto = nivel === "proficiente" ? prof : nivel === "especialista" ? prof * 2 : 0;
  const resto = extra - coberto;
  return { nivel, ...(resto !== 0 ? { bonus: Math.max(-50, Math.min(50, resto)) } : {}) };
}

const SEM_TEXTO = /^[—–-]?$/;

function acaoParaAtaque(
  a: AcaoDoMonstro,
  categoria: CategoriaDeAcao,
  prof: number,
  fichaBase: Ficha,
): Ataque {
  let salvaguarda: Ataque["salvaguarda"];
  if (a.salvaguarda) {
    // A CD do livro é fixa; a ficha a calcula (8 + proficiência + atributo + bônus): o bônus fecha a conta.
    const cdAtributo = ATRIBUTOS.reduce((melhor, x) =>
      modDoAtributo(fichaBase, x) > modDoAtributo(fichaBase, melhor) ? x : melhor,
    );
    const cdBonus = a.salvaguarda.cd - (8 + prof + modDoAtributo(fichaBase, cdAtributo));
    salvaguarda = {
      alvo: a.salvaguarda.atributo,
      cdAtributo,
      sucesso: a.salvaguarda.sucesso ?? "nenhum",
      ...(cdBonus !== 0 ? { cdBonus: Math.max(-50, Math.min(50, cdBonus)) } : {}),
    };
  }
  return {
    nome: a.nome.slice(0, 80),
    descricao: a.texto.slice(0, 20_000),
    categoria,
    ...(a.tipo ? { tipoDeAcao: a.tipo } : {}),
    ...(a.acerto !== undefined ? { acerto: { tipo: "fixo" as const, valor: a.acerto } } : {}),
    ...(a.alcance ? { alcance: a.alcance } : {}),
    ...(a.dano ? { dano: a.dano } : {}),
    ...(a.tipoDeDano ? { tipo: a.tipoDeDano } : {}),
    ...(a.dano2
      ? {
          dano2: {
            dados: a.dano2.dano,
            ...(a.dano2.tipoDeDano ? { tipo: a.dano2.tipoDeDano } : {}),
          },
        }
      : {}),
    ...(salvaguarda ? { salvaguarda } : {}),
    ...(a.recarga ? { recarga: a.recarga } : {}),
    ...(a.usos ? { usos: { max: a.usos, gastos: 0 } } : {}),
  };
}

export type FichaDoMonstro = { ficha: Ficha; avisos: string[] };

/**
 * O monstro como uma ficha de NPC, sem perder nada: os números viram os campos da ficha (atributos, CA, PV, ND,
 * testes e perícias como proficiência mais bônus), os traços viram `caracteristicas`, ações, reações e ações
 * lendárias viram `ataques` com a categoria (os números do ataque viram acerto fixo, dano e tipo) e a Conjuração
 * inata e por espaços viram `magias` com os espaços e o contador do grupo. As magias que o compêndio tem entram com o
 * texto e a jogada; as que faltam entram só com o nome (e um aviso).
 */
export function monstroParaFicha(
  m: MonstroDoCompendio,
  magiasDoCompendio: readonly MagiaDoCompendio[] = [],
): FichaDoMonstro {
  const avisos: string[] = [];
  const notas: string[] = [];
  const prof = bonusPorND(m.nd) ?? 2;
  const base: Ficha = {
    pvAtual: m.pv.media,
    pvMax: m.pv.media,
    apresentacao: "npc",
    atributos: { ...m.atributos },
    npc: { nd: m.nd },
  };
  const mod = (a: Atributo) => modDoAtributo(base, a);

  const salvaguardas: NonNullable<Ficha["salvaguardas"]> = {};
  for (const a of ATRIBUTOS) {
    const total = m.salvaguardas?.[a];
    if (total !== undefined) salvaguardas[a] = proficienciaParaTotal(total, mod(a), prof);
  }
  const pericias: NonNullable<Ficha["pericias"]> = {};
  for (const [nome, total] of Object.entries(m.pericias ?? {})) {
    const alvo = normalizarBusca(nome);
    const def = PERICIAS.find(
      (p) => normalizarBusca(p.nome) === alvo || p.id.toLowerCase() === alvo,
    );
    if (def) pericias[def.id] = proficienciaParaTotal(total, mod(def.atributo), prof);
    else {
      avisos.push(`Perícia "${nome}" não existe na ficha: foi para as notas.`);
      notas.push(`${nome} ${total >= 0 ? "+" : ""}${total}`);
    }
  }

  // Deslocamento: o primeiro número em metros vira o da ficha; o resto do texto vai para as notas.
  const textoDoDeslocamento = m.deslocamento?.trim();
  const metros =
    m.deslocamentoM ??
    (textoDoDeslocamento
      ? Number(/(\d+(?:[.,]\d+)?)\s*m\b/.exec(textoDoDeslocamento)?.[1]?.replace(",", "."))
      : Number.NaN);
  const deslocamentoFt = Number.isFinite(metros) ? Math.round(metros / 0.3) : undefined;
  if (textoDoDeslocamento && !/^\d+(?:[.,]\d+)?\s*m$/.test(textoDoDeslocamento)) {
    notas.unshift(`Deslocamento: ${textoDoDeslocamento}`);
  }
  if (m.textoDasAcoesLendarias) notas.push(`Ações lendárias: ${m.textoDasAcoesLendarias}`);

  const idiomas = (m.idiomas ?? "")
    .split(/[,;]/)
    .map((x) => x.trim().slice(0, 40))
    .filter((x) => !SEM_TEXTO.test(x))
    .slice(0, 30);

  const caracteristicas: Caracteristica[] = (m.tracos ?? []).map((t) => ({
    nome: t.nome.slice(0, 80),
    descricao: t.texto.slice(0, 20_000),
  }));
  const ataques: Ataque[] = [
    ...(m.acoes ?? []).map((a) => acaoParaAtaque(a, "acao", prof, base)),
    ...(m.reacoes ?? []).map((a) => acaoParaAtaque(a, "reacao", prof, base)),
    ...(m.acoesLendarias ?? []).map((a) => acaoParaAtaque(a, "lendaria", prof, base)),
  ];

  // ---- conjuração ----
  const noCompendio = (nome: string): MagiaDoCompendio | undefined => {
    const chave = normalizarBusca(nome);
    return magiasDoCompendio.find(
      (x) => normalizarBusca(x.nome) === chave || normalizarBusca(x.nomeOriginal ?? "") === chave,
    );
  };
  const inata = m.conjuracaoInata;
  const porEspacos = m.conjuracaoPorEspacos;
  const habilidade: Atributo | undefined =
    porEspacos?.habilidade ??
    inata?.habilidade ??
    (inata || porEspacos ? habilidadeDeConjuracaoDoNpc(base) : undefined);
  const comConjuracao: Ficha = habilidade ? { ...base, habilidadeDeConjuracao: habilidade } : base;
  const magias: Magia[] = [];
  const montar = (nome: string, nivel: number): Magia => {
    const achada = noCompendio(nome);
    if (achada) return magiaParaFichaCalculada(comConjuracao, achada);
    avisos.push(`A magia "${nome}" não está no compêndio: entrou só com o nome.`);
    return {
      nome: nome.slice(0, 80),
      nivel,
      preparada: true,
      descricao: "Magia fora do compêndio: veja o texto do traço de Conjuração.",
    };
  };
  for (const x of porEspacos?.magias ?? []) magias.push(montar(x.nome, x.nivel));
  for (const x of inata?.magias ?? []) {
    magias.push({
      ...montar(x.nome, 0),
      inata: {
        frequencia: x.frequencia,
        ...(x.frequencia === "vontade" ? {} : { max: x.max ?? 1 }),
      },
    });
  }
  const espacosTotal: NonNullable<Ficha["espacosTotal"]> = {};
  for (const [nivel, total] of Object.entries(porEspacos?.espacos ?? {})) {
    if (total > 0) espacosTotal[nivel as "1"] = total;
  }
  const temGrupo = inata?.magias.some((x) => x.frequencia === "grupo") === true;
  const fichaInata: Ficha["inata"] | undefined = inata
    ? {
        ...(inata.habilidade ? { habilidade: inata.habilidade } : {}),
        ...(inata.cd !== undefined ? { cd: inata.cd } : {}),
        ...(temGrupo || inata.grupoMax ? { grupo: { max: inata.grupoMax ?? 1, gastos: 0 } } : {}),
      }
    : undefined;

  const ficha: Ficha = {
    ...base,
    ...(m.tendencia ? { alinhamento: m.tendencia.slice(0, 64) } : {}),
    ca: { valor: m.ca.valor, ...(m.ca.fonte ? { nota: m.ca.fonte } : {}) },
    ...(deslocamentoFt !== undefined ? { deslocamentoFt } : {}),
    npc: {
      nd: m.nd,
      tamanho: m.tamanho.slice(0, 24),
      tipo: m.tipo,
      ...(m.pv.formula ? { pvFormula: m.pv.formula } : {}),
      ...(m.sentidos ? { sentidos: m.sentidos } : {}),
      ...(m.vulnerabilidades ? { vulnerabilidades: m.vulnerabilidades } : {}),
      ...(m.resistencias ? { resistencias: m.resistencias } : {}),
      ...(m.imunidades ? { imunidades: m.imunidades } : {}),
      ...(m.imunidadesCondicoes ? { imunidadesCondicoes: m.imunidadesCondicoes } : {}),
    },
    ...(Object.keys(salvaguardas).length > 0 ? { salvaguardas } : {}),
    ...(Object.keys(pericias).length > 0 ? { pericias } : {}),
    ...(idiomas.length > 0 ? { idiomas } : {}),
    ...(caracteristicas.length > 0 ? { caracteristicas } : {}),
    ...(ataques.length > 0 ? { ataques } : {}),
    ...(habilidade ? { habilidadeDeConjuracao: habilidade } : {}),
    ...(magias.length > 0 ? { magias } : {}),
    ...(Object.keys(espacosTotal).length > 0 ? { espacosTotal } : {}),
    ...(fichaInata ? { inata: fichaInata } : {}),
    ...(notas.length > 0 ? { notas: notas.join("\n") } : {}),
  };
  return { ficha, avisos };
}

/** O personagem (NPC) novo que o botão "Criar NPC" e o arrasto para o mapa mandam à sala. */
export function personagemDoMonstro(
  m: MonstroDoCompendio,
  opcoes: { id: string; pastaId: string; magias?: readonly MagiaDoCompendio[] },
): { personagem: Personagem; avisos: string[] } {
  const { ficha, avisos } = monstroParaFicha(m, opcoes.magias ?? []);
  return {
    avisos,
    personagem: {
      id: opcoes.id,
      pastaId: opcoes.pastaId,
      editores: { tipo: "jogadores", ids: [] },
      nome: m.nome.slice(0, 64),
      tokenPadrao: { cor: "#c0392b", tamanhoQuadrados: tamanhoDoTokenDoMonstro(m) },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      ficha,
    },
  };
}
