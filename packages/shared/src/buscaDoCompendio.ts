// ---------------------------------------------------------------------------------------------
// Q2b: a busca por nome do compêndio. Uma função pura, usada pela aba e pela ferramenta `compendio` do MCP.
//
// - normaliza: minúsculas, sem acento, sem pontuação e com os espaços colapsados;
// - por palavra: cada palavra da consulta precisa casar com alguma palavra do `nome` ou do `nomeOriginal`, em qualquer
//   ordem; palavras de ligação (de, da, do, of, the...) da consulta não atrapalham;
// - casa de 4 jeitos, do melhor ao pior: palavra inteira, começo de palavra, pedaço dentro da palavra (3 letras ou
//   mais) e semelhante (erro de digitação por distância de edição: 1 erro em palavras de 4 a 7 letras, 2 em 8 ou
//   mais; assumido), também no começo da palavra;
// - a nota serve para ordenar por relevância (quanto maior, melhor).
// ---------------------------------------------------------------------------------------------

/** Sem acento, sem caixa, sem pontuação e com os espaços colapsados. */
export function normalizarParaBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** As palavras de ligação (português e inglês): na consulta, não pesam. */
const LIGACAO = new Set([
  "a",
  "o",
  "e",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "of",
  "the",
  "and",
  "in",
  "on",
  "to",
  "for",
]);

export type ConsultaPreparada = { palavras: string[] };

/** A consulta em palavras (`null` se não há nada a buscar). Se só sobrar ligação, ela mesma vale. */
export function prepararConsulta(texto: string | undefined): ConsultaPreparada | null {
  const todas = normalizarParaBusca(texto ?? "")
    .split(" ")
    .filter(Boolean);
  if (todas.length === 0) return null;
  const uteis = todas.filter((p) => !LIGACAO.has(p));
  return { palavras: uteis.length > 0 ? uteis : todas };
}

/** Quantos erros de digitação uma palavra da consulta tolera. */
export function toleranciaDeErros(tamanho: number): number {
  if (tamanho >= 8) return 2;
  if (tamanho >= 4) return 1;
  return 0;
}

/** Distância de edição (inserir, tirar, trocar e inverter letras vizinhas), cortando cedo acima de `limite`. */
export function distanciaDeEdicao(a: string, b: string, limite: number): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  // Três linhas reaproveitadas entre chamadas (a função não é reentrante): evita alocar arrays a cada palavra comparada.
  let anterior2 = LINHAS_DE_EDICAO[0] as number[];
  let anterior = LINHAS_DE_EDICAO[1] as number[];
  let atual = LINHAS_DE_EDICAO[2] as number[];
  for (let j = 0; j <= b.length; j++) anterior[j] = j;
  for (let i = 1; i <= a.length; i++) {
    atual[0] = i;
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        (anterior[j] ?? 0) + 1,
        (atual[j - 1] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + custo,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, (anterior2[j - 2] ?? 0) + 1);
      }
      atual[j] = v;
      if (v < menor) menor = v;
    }
    if (menor > limite) return limite + 1;
    const velha = anterior2;
    anterior2 = anterior;
    anterior = atual;
    atual = velha;
  }
  return anterior[b.length] ?? limite + 1;
}

const LINHAS_DE_EDICAO: number[][] = [[], [], []];

const NOTA_INTEIRA = 4;
const NOTA_COMECO = 3;
const NOTA_DENTRO = 2;
const NOTA_SEMELHANTE = 1;

/** A nota de uma palavra da consulta contra as palavras de uma entrada (0: não casa). */
function notaDaPalavra(p: string, palavras: readonly string[]): number {
  let melhor = 0;
  const tol = toleranciaDeErros(p.length);
  for (const w of palavras) {
    if (w === p) return NOTA_INTEIRA;
    if (w.startsWith(p)) {
      melhor = Math.max(melhor, NOTA_COMECO);
    } else if (melhor < NOTA_DENTRO && p.length >= 3 && w.includes(p)) {
      melhor = NOTA_DENTRO;
    } else if (melhor < NOTA_SEMELHANTE && tol > 0) {
      if (
        distanciaDeEdicao(p, w, tol) <= tol ||
        (w.length > p.length && distanciaDeEdicao(p, w.slice(0, p.length), tol) <= tol)
      ) {
        melhor = NOTA_SEMELHANTE;
      }
    }
  }
  return melhor;
}

// As palavras e as formas inteiras do nome de cada entrada, normalizadas uma vez só (a lista do compêndio tem ~1.100 entradas e a busca roda a cada tecla).
type EntradaPreparada = { palavras: string[]; nome: string; nomeOriginal: string };
const preparadas = new WeakMap<object, EntradaPreparada>();

function prepararEntrada(entrada: {
  nome: string;
  nomeOriginal?: string | undefined;
}): EntradaPreparada {
  const guardado = preparadas.get(entrada);
  if (guardado) return guardado;
  const palavras = normalizarParaBusca(`${entrada.nome} ${entrada.nomeOriginal ?? ""}`)
    .split(" ")
    .filter(Boolean);
  const feito = {
    palavras,
    nome: normalizarParaBusca(entrada.nome),
    nomeOriginal: normalizarParaBusca(entrada.nomeOriginal ?? ""),
  };
  preparadas.set(entrada, feito);
  return feito;
}

/**
 * A nota da entrada para a consulta: `null` se alguma palavra da consulta não casa; senão a soma das notas das
 * palavras (inteira > começo > dentro > semelhante), mais um extra quando a consulta é o nome todo.
 */
export function pontuarBusca(
  entrada: { nome: string; nomeOriginal?: string | undefined },
  consulta: ConsultaPreparada | null,
): number | null {
  if (consulta === null) return 0;
  const { palavras, nome, nomeOriginal } = prepararEntrada(entrada);
  let total = 0;
  for (const p of consulta.palavras) {
    const n = notaDaPalavra(p, palavras);
    if (n === 0) return null;
    total += n;
  }
  const inteira = consulta.palavras.join(" ");
  if (nome === inteira || nomeOriginal === inteira) {
    total += 2;
  }
  return total;
}

/**
 * Filtra pela consulta e ordena: com busca, da nota maior para a menor (empate: `desempate`); sem busca, só `desempate`
 * (a ordem alfabética de sempre). `extra` é qualquer outro filtro da seção.
 */
export function filtrarEOrdenar<T extends { nome: string; nomeOriginal?: string | undefined }>(
  lista: readonly T[],
  texto: string | undefined,
  desempate: (a: T, b: T) => number,
  extra: (e: T) => boolean = () => true,
): T[] {
  const consulta = prepararConsulta(texto);
  if (consulta === null) return lista.filter(extra).sort(desempate);
  const notas = new Map<T, number>();
  const achados: T[] = [];
  for (const e of lista) {
    if (!extra(e)) continue;
    const n = pontuarBusca(e, consulta);
    if (n === null) continue;
    notas.set(e, n);
    achados.push(e);
  }
  return achados.sort((a, b) => (notas.get(b) ?? 0) - (notas.get(a) ?? 0) || desempate(a, b));
}
