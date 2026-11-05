/** Orçamento do plano grátis (PROJETO.md 4.5): no máximo 20 atualizações de movimento por segundo. */
export const INTERVALO_MINIMO_MOVIMENTO_MS = 50;

export type RelogioDoLimitador = {
  agora: () => number;
  agendar: (fn: () => void, ms: number) => unknown;
  cancelar: (id: unknown) => void;
};

export type Limitador<T> = {
  /** Pede o envio de um valor: sai já (se passou o intervalo) ou fica como o último pendente. */
  enviar: (valor: T) => void;
  /** Descarta o pendente (use ao soltar: o envio final sai por fora do limitador). */
  cancelar: () => void;
};

/**
 * Limita o envio a um por `intervaloMs`. Envia na hora quando já passou o intervalo; senão guarda o
 * valor mais recente e o envia (trailing) quando o intervalo vencer. Nunca perde a última posição.
 * Pura: o relógio e o agendador entram por parâmetro.
 */
export function criarLimitador<T>(
  enviar: (valor: T) => void,
  relogio: RelogioDoLimitador,
  intervaloMs = INTERVALO_MINIMO_MOVIMENTO_MS,
): Limitador<T> {
  let ultimoEnvio = Number.NEGATIVE_INFINITY;
  let pendente: { valor: T } | null = null;
  let temporizador: unknown = null;

  function enviarAgora(valor: T) {
    ultimoEnvio = relogio.agora();
    enviar(valor);
  }

  function aoVencer() {
    temporizador = null;
    if (!pendente) return;
    const falta = ultimoEnvio + intervaloMs - relogio.agora();
    if (falta > 0) {
      temporizador = relogio.agendar(aoVencer, falta); // disparou cedo: espera o resto
      return;
    }
    const { valor } = pendente;
    pendente = null;
    enviarAgora(valor);
  }

  return {
    enviar(valor) {
      const falta = ultimoEnvio + intervaloMs - relogio.agora();
      if (falta <= 0 && temporizador === null) {
        pendente = null;
        enviarAgora(valor);
        return;
      }
      pendente = { valor };
      if (temporizador === null) temporizador = relogio.agendar(aoVencer, Math.max(falta, 0));
    },
    cancelar() {
      pendente = null;
      if (temporizador !== null) relogio.cancelar(temporizador);
      temporizador = null;
    },
  };
}
