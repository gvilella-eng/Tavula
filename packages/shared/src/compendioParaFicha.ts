import { z } from "zod";
import {
  type ArmaDoCompendio,
  ArmaDoCompendioSchema,
  fichaTemMagia,
  ItemDoCompendioSchema,
  type MagiaDoCompendio,
  MagiaDoCompendioSchema,
  magiaParaFicha,
  normalizarBusca,
} from "./compendio.ts";
import {
  type Ataque,
  type Caracteristica,
  conjuradoras,
  type Ficha,
  type ItemDaFicha,
  type Magia,
  modDoAtributo,
  type OperacaoDeFicha,
  type TipoDeAcao,
} from "./ficha.ts";
import { inserirNoGrupo, posicoesDoGrupo } from "./reordenar.ts";
import { ATRIBUTOS, type Atributo, ROTULO_DO_ATRIBUTO } from "./srd/index.ts";

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
  const item = entrada.item;
  if (npc) {
    const lista = f.caracteristicas ?? [];
    if (lista.some((c) => normalizarBusca(c.nome) === normalizarBusca(item.nome))) {
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
  const existente = itens.findIndex((i) => normalizarBusca(i.nome) === normalizarBusca(item.nome));
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
