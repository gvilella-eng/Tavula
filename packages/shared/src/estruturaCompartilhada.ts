/**
 * Q14: devolve `depois` reaproveitando, de `antes`, tudo o que tem o mesmo valor: um objeto ou lista igual por dentro
 * volta com a MESMA referência de `antes`, e só o caminho que mudou é novo. É o que deixa a tela comparar `ficha.itens`
 * por `===` e redesenhar só a seção que mudou. Vale para dados de JSON (objetos simples, listas, números, textos,
 * booleanos e `null`); o resultado nunca é alterado no lugar, nem o de `antes`.
 */
export function compartilharEstrutura<T>(antes: unknown, depois: T): T {
  if (Object.is(antes, depois)) return depois;
  if (typeof antes !== "object" || antes === null) return depois;
  if (typeof depois !== "object" || depois === null) return depois;
  const novaLista = Array.isArray(depois);
  if (Array.isArray(antes) !== novaLista) return depois;
  if (novaLista) {
    const velha = antes as unknown[];
    const nova = depois as unknown[];
    let igual = velha.length === nova.length;
    const itens = nova.map((x, i) => {
      const r = compartilharEstrutura(velha[i], x);
      if (!Object.is(r, velha[i])) igual = false;
      return r;
    });
    return (igual ? antes : itens) as T;
  }
  if (!ehObjetoSimples(antes) || !ehObjetoSimples(depois)) return depois;
  const velho = antes as Record<string, unknown>;
  const novo = depois as Record<string, unknown>;
  const chaves = Object.keys(novo);
  let igual = chaves.length === Object.keys(velho).length;
  const campos: Record<string, unknown> = {};
  for (const k of chaves) {
    const r = compartilharEstrutura(velho[k], novo[k]);
    campos[k] = r;
    if (!Object.is(r, velho[k]) || !Object.hasOwn(velho, k)) igual = false;
  }
  return (igual ? antes : campos) as T;
}

function ehObjetoSimples(v: object): boolean {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
