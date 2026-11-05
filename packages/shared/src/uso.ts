import type { Uso } from "./protocolo.ts";

/** Limite diário do plano grátis dos Durable Objects, em requisições. */
export const LIMITE_DIARIO_REQUISICOES = 100_000;
/** Cada 20 mensagens recebidas contam 1 requisição. */
export const MENSAGENS_POR_REQUISICAO = 20;

/** Dia UTC no formato AAAA-MM-DD. */
export function diaUtc(agora: Date): string {
  return agora.toISOString().slice(0, 10);
}

export function calcularUso(dia: string, mensagens: number, conexoes: number): Uso {
  const requisicoes = mensagens / MENSAGENS_POR_REQUISICAO + conexoes;
  return {
    dia,
    mensagens,
    conexoes,
    requisicoes,
    percentual: (requisicoes / LIMITE_DIARIO_REQUISICOES) * 100,
  };
}
