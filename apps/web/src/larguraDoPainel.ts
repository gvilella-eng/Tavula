import { useCallback, useEffect, useState } from "react";
import {
  ajustarLarguraDoPainel,
  gravarLarguraDoPainel,
  lerLarguraDoPainel,
  limitesDoPainel,
} from "./preferencias";

/**
 * A largura do painel direito. A escolha é por navegador (`tabletop:pref:larguraDoPainel`) e nunca vai
 * para a sala. A largura em uso acompanha a janela: se ela encolhe, o painel nunca passa de 1/4.
 */
export function useLarguraDoPainel() {
  const [escolhida, setEscolhida] = useState(lerLarguraDoPainel);
  const [janela, setJanela] = useState(() => window.innerWidth);

  useEffect(() => {
    const aoRedimensionar = () => setJanela(window.innerWidth);
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  const largura = ajustarLarguraDoPainel(escolhida, janela);
  const limites = limitesDoPainel(janela);

  /** `gravar`: só no fim do arrasto (ou a cada toque de tecla), não a cada pixel. */
  const definir = useCallback((v: number, gravar: boolean) => {
    const nova = ajustarLarguraDoPainel(v, window.innerWidth);
    setEscolhida(nova);
    if (gravar) gravarLarguraDoPainel(nova);
  }, []);

  return { largura, limites, definir };
}
