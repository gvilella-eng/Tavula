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

/**
 * Q4b: a altura que a pessoa deu à faixa no pé da tela (px). Sem o valor, a faixa tem a altura natural. Só deste
 * navegador (`tabletop:pref:som-faixa-altura`); nunca vai para a sala.
 */
export const CHAVE_ALTURA_DA_FAIXA = "tabletop:pref:som-faixa-altura";

export function lerAlturaDaFaixa(): number | null {
  try {
    const v = Number(localStorage.getItem(CHAVE_ALTURA_DA_FAIXA));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  } catch {
    return null;
  }
}

export function gravarAlturaDaFaixa(altura: number | null): void {
  try {
    if (altura === null) localStorage.removeItem(CHAVE_ALTURA_DA_FAIXA);
    else localStorage.setItem(CHAVE_ALTURA_DA_FAIXA, String(Math.round(altura)));
  } catch {
    // sem localStorage: vale só até fechar a página
  }
}

/** A altura do cabeçalho da faixa (a linha do topo mais as duas bordas) e o espaço de dentro do corpo, em px (o CSS usa os mesmos). */
export const ALTURA_DO_TOPO_DA_FAIXA = 42;
export const ESPACO_DO_CORPO_DA_FAIXA = 20;
/** A altura do conteúdo do corpo da faixa na escala 1 (medida; o E2E confere). */
export const ALTURA_NATURAL_DO_CORPO = 190;
/** O quanto tudo pode encolher antes de aparecer a barra de rolagem. */
export const ESCALA_MINIMA_DA_FAIXA = 0.7;

/** A altura da faixa inteira (topo + corpo) com tudo no tamanho natural, e a menor antes da rolagem. */
export const ALTURA_CHEIA_DA_FAIXA =
  ALTURA_DO_TOPO_DA_FAIXA + ESPACO_DO_CORPO_DA_FAIXA + ALTURA_NATURAL_DO_CORPO;
export const ALTURA_MINIMA_SEM_ROLAGEM = Math.ceil(
  ALTURA_DO_TOPO_DA_FAIXA +
    ESPACO_DO_CORPO_DA_FAIXA +
    ALTURA_NATURAL_DO_CORPO * ESCALA_MINIMA_DA_FAIXA,
);
/** Um piso para a alça (abaixo do mínimo sem rolagem, o conteúdo rola). */
export const ALTURA_MINIMA_DA_FAIXA = 120;

/** A escala (0,7 a 1) que a altura escolhida pede para o conteúdo caber sem rolar; `null` = tamanho natural. */
export function escalaDaFaixa(altura: number | null): number {
  if (altura === null || altura >= ALTURA_CHEIA_DA_FAIXA) return 1;
  const disponivel = altura - ALTURA_DO_TOPO_DA_FAIXA - ESPACO_DO_CORPO_DA_FAIXA;
  const s = Math.floor((disponivel / ALTURA_NATURAL_DO_CORPO) * 100) / 100;
  return Math.min(1, Math.max(ESCALA_MINIMA_DA_FAIXA, s));
}
