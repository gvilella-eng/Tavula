import type { ConfigEstagios, Estagio, ObjetoDeLuz, RelogioSala } from "./estado.ts";

/**
 * Relógio da sala (princípio 6: o tempo é da sala). Funções puras: quem chama passa o "agora" real
 * (milissegundos) e recebe o tempo da sala. Os testes passam um `agora` falso.
 */

export function relogioInicial(agoraMs: number): RelogioSala {
  return { pausada: false, acumuladoMs: 0, desdeReal: agoraMs };
}

/** Tempo da sala em milissegundos: congelado se pausada, senão acumulado + o que passou desde `desdeReal`. */
export function tempoDaSala(relogio: RelogioSala, agoraMs: number): number {
  if (relogio.pausada || relogio.desdeReal === undefined) return relogio.acumuladoMs;
  return relogio.acumuladoMs + Math.max(0, agoraMs - relogio.desdeReal);
}

/** O marco do "zerar o relógio" (V1) para copiar a um relógio novo: nada quando não há marco. */
export function marcoDoRelogio(relogio: Pick<RelogioSala, "marcoMs">): { marcoMs?: number } {
  return relogio.marcoMs === undefined ? {} : { marcoMs: relogio.marcoMs };
}

/**
 * O número da pílula do mestre (V1): o tempo da sala menos o marco do último "zerar". Nunca negativo.
 * Só mostra: as tochas e o resto leem `tempoDaSala`, que o marco não toca.
 */
export function tempoDaPilula(relogio: RelogioSala, agoraMs: number): number {
  return Math.max(0, tempoDaSala(relogio, agoraMs) - (relogio.marcoMs ?? 0));
}

export function pausarRelogio(relogio: RelogioSala, agoraMs: number): RelogioSala {
  return { pausada: true, acumuladoMs: tempoDaSala(relogio, agoraMs), ...marcoDoRelogio(relogio) };
}

export function retomarRelogio(relogio: RelogioSala, agoraMs: number): RelogioSala {
  return {
    pausada: false,
    acumuladoMs: relogio.acumuladoMs,
    desdeReal: agoraMs,
    ...marcoDoRelogio(relogio),
  };
}

type ComTempo = Pick<ObjetoDeLuz, "estado" | "saldoMs" | "acesaDesdeSala">;

/**
 * Quanto falta para o objeto acabar, em ms, no tempo da sala `salaMs`: o saldo menos o que passou
 * desde que foi acesa. `null` quando o objeto não se consome (ou é uma cópia de navegador, sem saldo).
 */
export function restanteDoObjeto(objeto: ComTempo, salaMs: number): number | null {
  const saldo = objeto.saldoMs;
  if (saldo === null || saldo === undefined) return null;
  if (objeto.estado !== "acesa" || objeto.acesaDesdeSala === undefined) return saldo;
  return Math.max(0, saldo - Math.max(0, salaMs - objeto.acesaDesdeSala));
}

/**
 * Estágio da luz pelo que resta da duração do modelo: `morrendo` abaixo de `estagios.morrendo`,
 * `fraca` abaixo de `estagios.fraca`, senão `forte`. Os limites são frações da duração.
 */
export function estagioDe(
  restanteMs: number,
  duracaoMs: number,
  estagios: ConfigEstagios,
): Estagio {
  const fracao = restanteMs / duracaoMs;
  if (fracao <= estagios.morrendo) return "morrendo";
  if (fracao <= estagios.fraca) return "fraca";
  return "forte";
}

/**
 * Em quantos ms (do tempo da sala) acontece o próximo marco do objeto: virar `fraca`, virar
 * `morrendo`, acabar ou vencer um modificador com prazo. `null` quando nada vai acontecer sozinho.
 * Só olha para a frente: marco que já passou não conta.
 */
export function proximoMarcoDoObjeto(
  objeto: ObjetoDeLuz,
  salaMs: number,
  estagios: ConfigEstagios,
): number | null {
  const candidatos: number[] = [];
  const restante = restanteDoObjeto(objeto, salaMs);
  if (objeto.estado === "acesa" && restante !== null) {
    candidatos.push(restante);
    const duracao = objeto.duracaoMs;
    if (duracao) {
      for (const fracao of [estagios.fraca, estagios.morrendo]) {
        const limite = duracao * fracao;
        if (restante > limite) candidatos.push(restante - limite);
      }
    }
  }
  for (const m of objeto.modificadores) {
    if (m.ateSala !== undefined && m.ateSala > salaMs) candidatos.push(m.ateSala - salaMs);
  }
  const positivos = candidatos.filter((c) => c > 0);
  return positivos.length === 0 ? null : Math.min(...positivos);
}

/** "12:34" (minutos e segundos) ou "1:02:03" a partir de uma hora. Para a tela e o histórico. */
export function formatarRestante(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

/** "1 min", "30 s", "1 min 30 s": duração curta em texto, para o histórico. */
export function formatarDuracaoCurta(ms: number): string {
  const total = Math.round(Math.abs(ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}
