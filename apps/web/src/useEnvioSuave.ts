import { useEffect, useRef } from "react";

/**
 * Envia no máximo um valor a cada `ms` por chave (o último vale): um slider arrastado não vira uma
 * mensagem por pixel. Com `enviarAoDesmontar`, o que ainda esperava a vez sai ao desmontar (o último valor
 * nunca se perde); sem ele, o pendente é descartado.
 */
export function useEnvioSuave(ms = 90, enviarAoDesmontar = false) {
  const pendentes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const ultimos = useRef(new Map<string, () => void>());
  useEffect(() => {
    const temporizadores = pendentes.current;
    const envios = ultimos.current;
    return () => {
      for (const [chave, t] of temporizadores) {
        clearTimeout(t);
        if (enviarAoDesmontar) envios.get(chave)?.();
      }
      temporizadores.clear();
    };
  }, [enviarAoDesmontar]);
  return (chave: string, enviar: () => void) => {
    ultimos.current.set(chave, enviar);
    if (pendentes.current.has(chave)) return;
    pendentes.current.set(
      chave,
      setTimeout(() => {
        pendentes.current.delete(chave);
        ultimos.current.get(chave)?.();
      }, ms),
    );
  };
}
