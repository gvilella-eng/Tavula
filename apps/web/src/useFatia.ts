import type { Estado } from "@tabletop/shared";
import { useRef } from "react";

/**
 * Monta a fatia do estado com só as `chaves` pedidas, devolvendo o MESMO objeto de `anterior` enquanto todas elas
 * seguirem `Object.is` iguais (o objeto de topo do estado muda a cada evento; as fatias, não). Pura: o hook só a chama.
 */
export function fatiaEstavel<K extends keyof Estado>(
  anterior: Pick<Estado, K> | null,
  estado: Estado | null,
  chaves: readonly K[],
): Pick<Estado, K> | null {
  if (estado === null) return null;
  if (anterior !== null) {
    let igual = true;
    for (const k of chaves) {
      // Chave opcional ausente nos dois lados também é igual (`undefined` com `undefined`).
      if (!Object.is(anterior[k], estado[k])) {
        igual = false;
        break;
      }
    }
    if (igual) return anterior;
  }
  const nova = {} as Pick<Estado, K>;
  for (const k of chaves) {
    // Chave opcional ausente continua ausente (não vira `undefined` explícito: `exactOptionalPropertyTypes`).
    if (k in estado) nova[k] = estado[k];
  }
  return nova;
}

/**
 * A fatia do estado para uma aba: só muda de identidade quando muda alguma das `chaves`, então um componente em
 * `memo` não re-renderiza com eventos que não tocam nelas. `chaves` deve ser uma constante (a mesma a cada render).
 */
export function useFatia<K extends keyof Estado>(
  estado: Estado | null,
  chaves: readonly K[],
): Pick<Estado, K> | null {
  const guardada = useRef<{ chaves: readonly K[]; fatia: Pick<Estado, K> | null } | null>(null);
  const anterior = guardada.current?.chaves === chaves ? guardada.current.fatia : null;
  const fatia = fatiaEstavel(anterior, estado, chaves);
  // Escrever a ref no render é aceitável aqui: é só o cache de uma derivação pura (a mesma entrada dá a mesma saída).
  guardada.current = { chaves, fatia };
  return fatia;
}
