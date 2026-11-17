import { filtrarEOrdenar, pontuarBusca, prepararConsulta } from "./buscaDoCompendio.ts";
import {
  type ArmaDoCompendio,
  type Compendio,
  compararPorNome,
  type ItemDoCompendio,
  type ItemMagicoDoCompendio,
  type MagiaDoCompendio,
  type MonstroDoCompendio,
  RARIDADES_DE_ITEM_MAGICO,
  ROTULO_DA_RARIDADE,
  ROTULO_DO_NIVEL_DE_MAGIA,
} from "./compendio.ts";
import { NIVEIS_DE_DESAFIO } from "./ficha.ts";

// ---------------------------------------------------------------------------------------------
// Q2: o compêndio por seções, com blocos (nível, ND, raridade) e busca em todas as seções, em português e inglês.
// Tudo aqui é função pura: a tela só desenha.
// ---------------------------------------------------------------------------------------------

export type SecaoDoCompendio = "magias" | "monstros" | "itensMagicos" | "armas" | "itens";

/** A ordem das seções na tela e o nome de cada uma. */
export const SECOES_DO_COMPENDIO: readonly { id: SecaoDoCompendio; rotulo: string }[] = [
  { id: "magias", rotulo: "Magias" },
  { id: "monstros", rotulo: "Monstros" },
  { id: "itensMagicos", rotulo: "Itens mágicos" },
  { id: "armas", rotulo: "Armas" },
  { id: "itens", rotulo: "Itens" },
];

/** Um bloco recolhível: a chave é estável (vai para o localStorage), o rótulo é o que aparece. */
export type GrupoDoCompendio<T> = { chave: string; rotulo: string; entradas: T[] };

/** Ordem alfabética sem acento nem caixa (a mesma de `buscarMagias`). */
export function compararNomes(a: { nome: string }, b: { nome: string }): number {
  // Mesma regra de `compararPorNome` (Collator de módulo e nome normalizado em cache).
  return compararPorNome(a, b);
}

function agrupar<T extends { nome: string }, C extends string | number>(
  entradas: readonly T[],
  chaveDe: (e: T) => C,
  ordem: (a: C, b: C) => number,
  rotuloDe: (c: C) => string,
  alfabetico: boolean,
): GrupoDoCompendio<T>[] {
  const mapa = new Map<C, T[]>();
  for (const e of entradas) {
    const c = chaveDe(e);
    const lista = mapa.get(c);
    if (lista) lista.push(e);
    else mapa.set(c, [e]);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => ordem(a, b))
    .map(([c, lista]) => ({
      chave: String(c),
      rotulo: rotuloDe(c),
      entradas: alfabetico ? lista.sort(compararNomes) : lista,
    }));
}

/** O título do bloco de magias: "Truques", "1º nível"... */
export const ROTULO_DO_BLOCO_DE_NIVEL = (nivel: number): string =>
  nivel === 0 ? "Truques" : ROTULO_DO_NIVEL_DE_MAGIA(nivel);

/** Magias por nível (truques primeiro), em ordem alfabética dentro de cada nível. Só os níveis que têm magia. */
export function agruparMagiasPorNivel(
  magias: readonly MagiaDoCompendio[],
  alfabetico = true,
): GrupoDoCompendio<MagiaDoCompendio>[] {
  return agrupar(
    magias,
    (m) => m.nivel,
    (a, b) => a - b,
    ROTULO_DO_BLOCO_DE_NIVEL,
    alfabetico,
  );
}

/** Monstros por nível de desafio (0, 1/8, 1/4, 1/2, 1 ... 30), alfabético dentro. */
export function agruparMonstrosPorND(
  monstros: readonly MonstroDoCompendio[],
  alfabetico = true,
): GrupoDoCompendio<MonstroDoCompendio>[] {
  const pos = (nd: string) => {
    const p = NIVEIS_DE_DESAFIO.indexOf(nd);
    return p < 0 ? Number.MAX_SAFE_INTEGER : p;
  };
  return agrupar(
    monstros,
    (m) => m.nd,
    (a, b) => pos(a) - pos(b),
    (nd) => `ND ${nd}`,
    alfabetico,
  );
}

/** Itens mágicos por raridade (comum ... artefato, varia), alfabético dentro. */
export function agruparItensMagicosPorRaridade(
  itens: readonly ItemMagicoDoCompendio[],
  alfabetico = true,
): GrupoDoCompendio<ItemMagicoDoCompendio>[] {
  return agrupar(
    itens,
    (i) => i.raridade,
    (a, b) => RARIDADES_DE_ITEM_MAGICO.indexOf(a) - RARIDADES_DE_ITEM_MAGICO.indexOf(b),
    (r) => ROTULO_DA_RARIDADE[r],
    alfabetico,
  );
}

const ORDEM_DAS_ARMAS = [
  "simples-corpo",
  "simples-distancia",
  "marcial-corpo",
  "marcial-distancia",
] as const;
const ROTULO_DAS_ARMAS: Record<(typeof ORDEM_DAS_ARMAS)[number], string> = {
  "simples-corpo": "Simples, corpo a corpo",
  "simples-distancia": "Simples, à distância",
  "marcial-corpo": "Marciais, corpo a corpo",
  "marcial-distancia": "Marciais, à distância",
};

/** Armas em simples e marciais, cada uma em corpo a corpo e à distância, alfabético dentro. */
export function agruparArmas(
  armas: readonly ArmaDoCompendio[],
  alfabetico = true,
): GrupoDoCompendio<ArmaDoCompendio>[] {
  return agrupar(
    armas,
    (a) =>
      `${a.categoria}-${a.distancia ? "distancia" : "corpo"}` as (typeof ORDEM_DAS_ARMAS)[number],
    (a, b) => ORDEM_DAS_ARMAS.indexOf(a) - ORDEM_DAS_ARMAS.indexOf(b),
    (c) => ROTULO_DAS_ARMAS[c],
    alfabetico,
  );
}

/**
 * Quem o texto da busca encontra (Q2b): por palavra, no nome em português ou no nome original (inglês), sem acento nem
 * caixa, começo de palavra e erro de grafia (veja `buscaDoCompendio.ts`).
 */
export function casaComABusca(
  entrada: { nome: string; nomeOriginal?: string | undefined },
  texto: string,
): boolean {
  return pontuarBusca(entrada, prepararConsulta(texto)) !== null;
}

export function buscarArmas(armas: readonly ArmaDoCompendio[], texto = ""): ArmaDoCompendio[] {
  return filtrarEOrdenar(armas, texto, compararNomes);
}

export function buscarItens(itens: readonly ItemDoCompendio[], texto = ""): ItemDoCompendio[] {
  return filtrarEOrdenar(itens, texto, compararNomes);
}

export type AchadosEmTodas = {
  magias: MagiaDoCompendio[];
  monstros: MonstroDoCompendio[];
  itensMagicos: ItemMagicoDoCompendio[];
  armas: ArmaDoCompendio[];
  itens: ItemDoCompendio[];
};

/**
 * A busca por nome em todas as seções (português e inglês). `incluirMonstros` é falso para o jogador: o bloco do
 * monstro é segredo do mestre (mesmo critério da aba).
 */
export function buscarEmTodas(
  c: Pick<Compendio, "magias" | "monstros" | "itensMagicos" | "armas" | "itens">,
  texto: string,
  incluirMonstros: boolean,
): AchadosEmTodas {
  const por = <T extends { nome: string; nomeOriginal?: string | undefined }>(
    l: readonly T[] | undefined,
  ): T[] => filtrarEOrdenar(l ?? [], texto, compararNomes);
  return {
    magias: por(c.magias),
    monstros: incluirMonstros ? por(c.monstros) : [],
    itensMagicos: por(c.itensMagicos),
    armas: por(c.armas),
    itens: por(c.itens),
  };
}
