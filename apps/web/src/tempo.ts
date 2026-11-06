import type { Estado, ObjetoDeLuz } from "@tabletop/shared";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * O tempo da sala na tela (princípio 6: o tempo é da sala). A sala manda `restanteMs` e `contando`
 * calculados na hora do envio; aqui só se ANIMA a contagem entre um envio e outro, a partir do
 * instante local em que o objeto chegou. O relógio do PC nunca decide regra: um novo envio da sala
 * sempre corrige o número.
 */
export type TempoDaTela = {
  /** Tempo restante (ms) de um objeto de luz agora, ou `undefined` se este usuário não o vê. */
  restanteDe: (luzId: string) => number | undefined;
  /** Tempo da sala (ms) para o relógio do mestre; `undefined` se a sala não o mandou. */
  salaMs: () => number | undefined;
};

type Marca = { luz: ObjetoDeLuz; em: number };

/**
 * Acompanha os objetos de luz e o relógio da sala. O mapa lê `restanteDe` direto, a cada quadro; os
 * painéis usam `useTic` para se redesenhar a cada segundo.
 */
export function useTempoDaSala(estado: Estado | null): TempoDaTela {
  const marcas = useRef(new Map<string, Marca>());
  const relogio = useRef<{ ref: Estado["relogio"]; em: number } | null>(null);
  const luzes = estado?.luzes;
  const agora = performance.now();
  if (luzes) {
    const vivos = new Set<string>();
    for (const l of luzes) {
      vivos.add(l.id);
      const m = marcas.current.get(l.id);
      // O objeto é novo (ou mudou): o instante de chegada é este.
      if (!m || m.luz !== l) marcas.current.set(l.id, { luz: l, em: agora });
    }
    for (const id of marcas.current.keys()) if (!vivos.has(id)) marcas.current.delete(id);
  }
  if (estado && relogio.current?.ref !== estado.relogio) {
    relogio.current = { ref: estado.relogio, em: agora };
  }

  const restanteDe = useCallback((luzId: string): number | undefined => {
    const m = marcas.current.get(luzId);
    if (!m || m.luz.restanteMs === undefined) return undefined;
    if (!m.luz.contando) return m.luz.restanteMs;
    return Math.max(0, m.luz.restanteMs - (performance.now() - m.em));
  }, []);

  const salaMs = useCallback((): number | undefined => {
    const r = relogio.current;
    if (!r) return undefined;
    if (r.ref.pausada) return r.ref.acumuladoMs;
    return r.ref.acumuladoMs + (performance.now() - r.em);
  }, []);

  return { restanteDe, salaMs };
}

/**
 * Re-renderiza o componente uma vez por segundo enquanto `ativo` (para mostrar uma contagem que
 * corre). Cada painel que mostra tempo usa o seu: a mesa inteira não re-renderiza a cada segundo.
 */
export function useTic(ativo: boolean): void {
  const [, tic] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => tic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [ativo]);
}
