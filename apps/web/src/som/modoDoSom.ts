import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Q4: preferências pessoais da mesa de som (só deste navegador; nunca vão para a sala): se ela aparece como janela
 * flutuante ou como faixa no pé da tela, e se a faixa está recolhida. O localStorage pode estar bloqueado.
 */
export type ModoDoSom = "janela" | "faixa";

export const CHAVE_MODO_DO_SOM = "tabletop:pref:som-modo";
export const CHAVE_FAIXA_RECOLHIDA = "tabletop:pref:som-faixa-recolhida";

export function lerModoDoSom(): ModoDoSom {
  try {
    return localStorage.getItem(CHAVE_MODO_DO_SOM) === "faixa" ? "faixa" : "janela";
  } catch {
    return "janela";
  }
}

export function gravarModoDoSom(modo: ModoDoSom): void {
  try {
    localStorage.setItem(CHAVE_MODO_DO_SOM, modo);
  } catch {
    // sem localStorage: vale só até fechar a página
  }
}

export function lerFaixaRecolhida(): boolean {
  try {
    return localStorage.getItem(CHAVE_FAIXA_RECOLHIDA) === "1";
  } catch {
    return false;
  }
}

export function gravarFaixaRecolhida(recolhida: boolean): void {
  try {
    localStorage.setItem(CHAVE_FAIXA_RECOLHIDA, recolhida ? "1" : "0");
  } catch {
    // idem
  }
}

/**
 * Manda uma mudança de volume com um respiro (um frame por pixel arrastado seria demais): `adiar(chave, fn)` guarda só a
 * última de cada chave e a envia depois de `ms`. Ao desmontar, o que ficou pendente ainda sai.
 */
export function useEnvioAdiado(ms = 120) {
  const pendentes = useRef(new Map<string, { t: ReturnType<typeof setTimeout>; fn: () => void }>());
  useEffect(() => {
    const mapa = pendentes.current;
    return () => {
      for (const { t, fn } of mapa.values()) {
        clearTimeout(t);
        fn();
      }
      mapa.clear();
    };
  }, []);
  return useCallback(
    (chave: string, fn: () => void) => {
      const mapa = pendentes.current;
      const antigo = mapa.get(chave);
      if (antigo) clearTimeout(antigo.t);
      const t = setTimeout(() => {
        mapa.delete(chave);
        fn();
      }, ms);
      mapa.set(chave, { t, fn });
    },
    [ms],
  );
}

/** O modo e o recolhimento, lembrados por pessoa. */
export function useModoDoSom() {
  const [modo, setModo] = useState<ModoDoSom>(lerModoDoSom);
  const [recolhida, setRecolhida] = useState<boolean>(lerFaixaRecolhida);
  const mudarModo = useCallback((m: ModoDoSom) => {
    setModo(m);
    gravarModoDoSom(m);
  }, []);
  const mudarRecolhida = useCallback((r: boolean) => {
    setRecolhida(r);
    gravarFaixaRecolhida(r);
  }, []);
  return { modo, mudarModo, recolhida, mudarRecolhida };
}
