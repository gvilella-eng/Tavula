import { normalizarBusca } from "@tabletop/shared";
import { ErroDoMcp } from "./erros.ts";

type Opcoes<T> = {
  /** "ficha", "cena"...: entra na mensagem de erro. */
  rotulo: string;
  nomeDe: (item: T) => string;
  idDe: (item: T) => string;
  /** Aceita um trecho único do nome quando não há nome igual (padrão: sim). */
  parcial?: boolean;
};

const LIMITE_DA_LISTA = 12;

function lista(nomes: string[]): string {
  const mostrados = nomes.slice(0, LIMITE_DA_LISTA).map((n) => `"${n}"`);
  const resto = nomes.length - mostrados.length;
  return mostrados.join(", ") + (resto > 0 ? ` e mais ${resto}` : "");
}

/**
 * Acha um item pelo nome (sem acento nem caixa). Ordem: o id exato; o nome igual; um trecho do nome que só um item
 * tem. Nome repetido ou que não existe vira um erro que diz o que fazer (a IA corrige e tenta de novo).
 */
export function achar<T>(itens: readonly T[], nome: string, o: Opcoes<T>): T {
  const pedido = nome.trim();
  if (pedido === "") throw new ErroDoMcp(`Diga o nome da ${o.rotulo}.`);
  const porId = itens.find((i) => o.idDe(i) === pedido);
  if (porId) return porId;
  const alvo = normalizarBusca(pedido);
  const iguais = itens.filter((i) => normalizarBusca(o.nomeDe(i)) === alvo);
  if (iguais.length === 1) return iguais[0] as T;
  if (iguais.length > 1) {
    throw new ErroDoMcp(
      `Há ${iguais.length} ${o.rotulo}s chamadas "${pedido}". Use o id: ${iguais.map((i) => `${o.idDe(i)}`).join(", ")}.`,
    );
  }
  if (o.parcial !== false) {
    const parecidos = itens.filter((i) => normalizarBusca(o.nomeDe(i)).includes(alvo));
    if (parecidos.length === 1) return parecidos[0] as T;
    if (parecidos.length > 1) {
      throw new ErroDoMcp(
        `"${pedido}" serve para várias ${o.rotulo}s: ${lista(parecidos.map(o.nomeDe))}. Escreva o nome inteiro.`,
      );
    }
  }
  throw new ErroDoMcp(
    itens.length === 0
      ? `Não existe nenhuma ${o.rotulo} para escolher.`
      : `Não achei a ${o.rotulo} "${pedido}". Existem: ${lista(itens.map(o.nomeDe))}.`,
  );
}

/** O item com este nome exato (sem acento nem caixa), ou `undefined`: serve para decidir entre criar e editar. */
export function acharExato<T>(
  itens: readonly T[],
  nome: string,
  nomeDe: (item: T) => string,
): T | undefined {
  const alvo = normalizarBusca(nome);
  return itens.find((i) => normalizarBusca(nomeDe(i)) === alvo);
}

/** Um id novo, curto e sem colisão prática, com um prefixo que diz o que é. */
export function novoId(prefixo: string): string {
  const aleatorio = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `${prefixo}-${aleatorio}`;
}

/** Um nome que ainda não existe na lista: "Goblin" -> "Goblin 2" (para criar vários iguais). */
export function nomeNumerado(base: string, existentes: readonly string[]): string {
  const usados = new Set(existentes.map(normalizarBusca));
  if (!usados.has(normalizarBusca(base))) return base;
  for (let n = 2; n < 1000; n++) {
    const candidato = `${base} ${n}`;
    if (!usados.has(normalizarBusca(candidato))) return candidato;
  }
  return `${base} ${Date.now()}`;
}
