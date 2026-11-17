import { useEffect, useState } from "react";

/**
 * Re-renderiza o componente a cada 30 s enquanto `ativo`, para um rótulo relativo ("usado há 5 min") envelhecer sozinho.
 * Antes ele envelhecia por tabela, a cada evento da sala; com as abas em `memo` isso deixou de acontecer.
 */
export function useMinuto(ativo: boolean): void {
  const [, tic] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => tic((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [ativo]);
}
