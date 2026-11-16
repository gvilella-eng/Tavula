import {
  type ArmaDoCompendio,
  type Compendio,
  type ItemDoCompendio,
  type ItemMagicoDoCompendio,
  type MagiaDoCompendio,
  type MonstroDoCompendio,
  normalizarBusca,
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
  return (
    normalizarBusca(a.nome).localeCompare(normalizarBusca(b.nome), "pt-BR") ||
    a.nome.localeCompare(b.nome, "pt-BR")
  );
}

function agrupar<T extends { nome: string }, C extends string | number>(
  entradas: readonly T[],
  chaveDe: (e: T) => C,
  ordem: (a: C, b: C) => number,
  rotuloDe: (c: C) => string,
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
      entradas: lista.sort(compararNomes),
    }));
}

/** O título do bloco de magias: "Truques", "1º nível"... */
export const ROTULO_DO_BLOCO_DE_NIVEL = (nivel: number): string =>
  nivel === 0 ? "Truques" : ROTULO_DO_NIVEL_DE_MAGIA(nivel);

/** Magias por nível (truques primeiro), em ordem alfabética dentro de cada nível. Só os níveis que têm magia. */
export function agruparMagiasPorNivel(
  magias: readonly MagiaDoCompendio[],
): GrupoDoCompendio<MagiaDoCompendio>[] {
  return agrupar(
    magias,
    (m) => m.nivel,
    (a, b) => a - b,
    ROTULO_DO_BLOCO_DE_NIVEL,
  );
}

/** Monstros por nível de desafio (0, 1/8, 1/4, 1/2, 1 ... 30), alfabético dentro. */
export function agruparMonstrosPorND(
  monstros: readonly MonstroDoCompendio[],
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
  );
}

/** Itens mágicos por raridade (comum ... artefato, varia), alfabético dentro. */
export function agruparItensMagicosPorRaridade(
  itens: readonly ItemMagicoDoCompendio[],
): GrupoDoCompendio<ItemMagicoDoCompendio>[] {
  return agrupar(
    itens,
    (i) => i.raridade,
    (a, b) => RARIDADES_DE_ITEM_MAGICO.indexOf(a) - RARIDADES_DE_ITEM_MAGICO.indexOf(b),
    (r) => ROTULO_DA_RARIDADE[r],
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
): GrupoDoCompendio<ArmaDoCompendio>[] {
  return agrupar(
    armas,
    (a) =>
      `${a.categoria}-${a.distancia ? "distancia" : "corpo"}` as (typeof ORDEM_DAS_ARMAS)[number],
    (a, b) => ORDEM_DAS_ARMAS.indexOf(a) - ORDEM_DAS_ARMAS.indexOf(b),
    (c) => ROTULO_DAS_ARMAS[c],
  );
}

/** Quem o texto da busca encontra: o nome em português ou o nome original (inglês), sem acento nem caixa. */
export function casaComABusca(
  entrada: { nome: string; nomeOriginal?: string | undefined },
  texto: string,
): boolean {
  const palavras = normalizarBusca(texto).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const alvo = `${normalizarBusca(entrada.nome)} ${normalizarBusca(entrada.nomeOriginal ?? "")}`;
  return palavras.every((p) => alvo.includes(p));
}

export function buscarArmas(armas: readonly ArmaDoCompendio[], texto = ""): ArmaDoCompendio[] {
  return armas.filter((a) => casaComABusca(a, texto)).sort(compararNomes);
}

export function buscarItens(itens: readonly ItemDoCompendio[], texto = ""): ItemDoCompendio[] {
  return itens.filter((i) => casaComABusca(i, texto)).sort(compararNomes);
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
  ): T[] => (l ?? []).filter((e) => casaComABusca(e, texto)).sort(compararNomes);
  return {
    magias: por(c.magias),
    monstros: incluirMonstros ? por(c.monstros) : [],
    itensMagicos: por(c.itensMagicos),
    armas: por(c.armas),
    itens: por(c.itens),
  };
}
