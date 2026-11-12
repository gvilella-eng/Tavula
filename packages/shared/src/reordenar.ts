// ---------------------------------------------------------------------------------------------
// Reordenar e inserir em listas da ficha (V4b). Uma lista da ficha às vezes mistura grupos (as ações, as reações e
// as lendárias do NPC moram no mesmo `ataques`; as magias de todos os círculos moram em `magias`). O GRUPO é a lista
// das posições (na lista inteira) dos itens que a pessoa vê juntos, em ordem. Tudo puro: devolve a lista nova.
// ---------------------------------------------------------------------------------------------

/** As posições, na lista inteira, dos itens que passam no filtro. */
export function posicoesDoGrupo<T>(lista: readonly T[], doGrupo: (item: T) => boolean): number[] {
  const posicoes: number[] = [];
  lista.forEach((item, i) => {
    if (doGrupo(item)) posicoes.push(i);
  });
  return posicoes;
}

/**
 * Move o item `de` (posição dentro do grupo) para `para` (posição final dentro do grupo). Os itens de fora do grupo
 * ficam onde estão. Posição igual, ou fora do grupo, não muda nada (devolve a mesma lista).
 */
export function moverNoGrupo<T>(
  lista: readonly T[],
  grupo: readonly number[],
  de: number,
  para: number,
): T[] {
  const n = grupo.length;
  if (de === para || de < 0 || para < 0 || de >= n || para >= n) return [...lista];
  const itens = grupo.map((i) => lista[i] as T);
  const [movido] = itens.splice(de, 1);
  itens.splice(para, 0, movido as T);
  const nova = [...lista];
  grupo.forEach((posicao, k) => {
    nova[posicao] = itens[k] as T;
  });
  return nova;
}

/** A posição, na lista inteira, onde um item novo entra para ficar na posição `posicao` do grupo (`null` = no fim). */
export function posicaoDeInsercao(
  tamanhoDaLista: number,
  grupo: readonly number[],
  posicao: number | null,
): number {
  if (posicao !== null && posicao >= 0 && posicao < grupo.length) return grupo[posicao] as number;
  const ultima = grupo[grupo.length - 1];
  return ultima === undefined ? tamanhoDaLista : ultima + 1;
}

/** Põe `item` na posição `posicao` do grupo (`null` = no fim do grupo). */
export function inserirNoGrupo<T>(
  lista: readonly T[],
  grupo: readonly number[],
  item: T,
  posicao: number | null,
): T[] {
  const alvo = posicaoDeInsercao(lista.length, grupo, posicao);
  const nova = [...lista];
  nova.splice(alvo, 0, item);
  return nova;
}
