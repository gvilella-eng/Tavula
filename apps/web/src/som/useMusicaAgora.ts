import { desvioDoRelogio, type MusicaTocando, musicaAgora } from "@tabletop/shared";
import { useEffect, useRef, useState } from "react";

/**
 * MU1: a música que toca agora e o ponto dela, para a tela (o nome, a barra de progresso). Usa o relógio da sala como o
 * motor de som: o desvio é refeito quando chega uma copia nova. Enquanto toca, a tela se atualiza duas vezes por segundo.
 */
export function useMusicaAgora(
  m: MusicaTocando | null | undefined,
): ReturnType<typeof musicaAgora> {
  const desvio = useRef(0);
  const copia = useRef<MusicaTocando | null>(null);
  if (m && copia.current !== m) {
    copia.current = m;
    desvio.current = desvioDoRelogio(m, Date.now());
  }
  const [, atualizar] = useState(0);
  const tocando = m?.tocando === true;
  useEffect(() => {
    if (!tocando) return;
    const t = setInterval(() => atualizar((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [tocando]);
  return m ? musicaAgora(m, Date.now() + desvio.current) : null;
}
