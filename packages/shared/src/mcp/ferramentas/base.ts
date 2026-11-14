import type { z } from "zod";
import type { Estado, Usuario } from "../../index.ts";
import type { CompendioLocal } from "../compendio.ts";
import { ErroDoMcp } from "../erros.ts";
import type { Lote, RespostaDaSala, SalaLike } from "../tipos.ts";

/** O que cada ferramenta recebe: a conexão com a mesa, o compêndio local e o gerador de lotes. */
export type Contexto = {
  sala: SalaLike;
  compendio: CompendioLocal;
  /** Um lote novo (um por chamada de ferramenta): o mesmo `loteId` vai em todas as intenções dela. */
  novoLote(descricao: string): Lote;
};

export type Saida = { texto: string; erro?: boolean };

/**
 * Uma ferramenta do MCP. `visivel` decide, pelo papel e pelas capacidades que a sala mostrou a este usuário, se ela
 * aparece na lista: é só conforto (a sala recusa o que a pessoa não pode, de qualquer jeito).
 */
export type Ferramenta<E = unknown> = {
  nome: string;
  descricao: string;
  entrada: z.ZodType<E>;
  visivel(estado: Estado, eu: Usuario): boolean;
  executar(entrada: E, ctx: Contexto): Promise<Saida | string>;
};

/** Um `Ferramenta<E>` guardado numa lista sem perder o tipo da própria entrada. */
// biome-ignore lint/suspicious/noExplicitAny: cada ferramenta tem o seu tipo de entrada; a lista só chama `executar` depois de validar
export type QualquerFerramenta = Ferramenta<any>;

export function definir<E>(f: Ferramenta<E>): Ferramenta<E> {
  return f;
}

/** O erro da sala, em texto que diz o que fazer. */
export function textoDoErro(codigo: string, mensagem: string): string {
  if (codigo === "sem_permissao") return `A mesa recusou: ${mensagem}`;
  if (codigo === "sem_conexao") return mensagem;
  return `A mesa recusou (${codigo}): ${mensagem}`;
}

/** Manda uma intenção; se a sala recusar, vira um `ErroDoMcp` com o que corrigir. */
export async function passo(
  ctx: Contexto,
  lote: Lote | undefined,
  tipo: string,
  dados: unknown,
): Promise<Extract<RespostaDaSala, { ok: true }>> {
  const r = await ctx.sala.enviar(tipo, dados, lote);
  if (!r.ok) throw new ErroDoMcp(textoDoErro(r.codigo, r.mensagem));
  return r;
}

/**
 * Como `passo`, mas se a sala pedir calma (limite de 20 pedidos por segundo do Claude) espera e tenta de novo: para quem manda
 * dezenas de pedidos de uma vez (o texto no mapa, a névoa).
 */
export async function passoComEspera(
  ctx: Contexto,
  lote: Lote | undefined,
  tipo: string,
  dados: unknown,
): Promise<Extract<RespostaDaSala, { ok: true }>> {
  for (let tentativa = 0; ; tentativa++) {
    const r = await ctx.sala.enviar(tipo, dados, lote);
    if (r.ok) return r;
    if (r.codigo === "muitas_mensagens" && tentativa < 8) {
      await new Promise((ok) => setTimeout(ok, 250));
      continue;
    }
    throw new ErroDoMcp(textoDoErro(r.codigo, r.mensagem));
  }
}

/** O resultado de um lote de itens: o que deu certo, o que falhou e por quê. */
export class Relatorio {
  private readonly linhas: string[] = [];
  feitos = 0;
  falhas = 0;

  ok(texto: string): void {
    this.feitos++;
    this.linhas.push(`- ${texto}`);
  }

  falha(texto: string): void {
    this.falhas++;
    this.linhas.push(`- NÃO FEITO: ${texto}`);
  }

  aviso(texto: string): void {
    this.linhas.push(`  Aviso: ${texto}`);
  }

  saida(vazio = "Nada a fazer."): Saida {
    if (this.linhas.length === 0) return { texto: vazio };
    const total = this.feitos + this.falhas;
    const cabecalho =
      this.falhas === 0
        ? `Feito (${this.feitos}).`
        : this.feitos === 0
          ? `Nada foi feito (${this.falhas} erro${this.falhas === 1 ? "" : "s"}).`
          : `${this.feitos} de ${total} feitos; ${this.falhas} com erro.`;
    return { texto: [cabecalho, ...this.linhas].join("\n"), erro: this.feitos === 0 };
  }
}

/** Roda cada item, guardando o erro dele sem parar os outros. Erro que não é `ErroDoMcp` é bug e sobe. */
export async function cadaItem<T>(
  itens: readonly T[],
  nome: (item: T, i: number) => string,
  fazer: (item: T, i: number) => Promise<string>,
  r: Relatorio,
): Promise<void> {
  for (const [i, item] of itens.entries()) {
    try {
      r.ok(await fazer(item, i));
    } catch (e) {
      if (!(e instanceof ErroDoMcp)) throw e;
      r.falha(`${nome(item, i)}: ${e.message}`);
    }
  }
}

/** "a, b e c" (com limite): para listas curtas em frases. */
export function listar(nomes: readonly string[], max = 12): string {
  if (nomes.length === 0) return "nenhum";
  const mostrados = nomes.slice(0, max);
  const resto = nomes.length - mostrados.length;
  return mostrados.join(", ") + (resto > 0 ? ` e mais ${resto}` : "");
}

export function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function ehMestre(eu: Usuario): boolean {
  return eu.papel === "mestre";
}
