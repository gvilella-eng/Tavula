import { useCallback, useRef } from "react";

/**
 * Uma função de identidade fixa que chama sempre a versão MAIS RECENTE de `fn` (ref atualizada no render). Serve para
 * entregar a um componente em `memo` um manipulador que lê props e estado de agora sem trocar de identidade a cada render.
 * Só chame o resultado em manipuladores de evento e efeitos, nunca durante o render.
 */
export function useFuncaoEstavel<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ultima = useRef(fn);
  ultima.current = fn;
  return useCallback((...args: A) => ultima.current(...args), []);
}
