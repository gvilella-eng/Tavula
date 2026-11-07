import { useCallback, useRef, useState } from "react";

export const ABAS_DA_FICHA = [
  ["principal", "Principal"],
  ["magias", "Magias"],
  ["caracteristicas", "Características"],
  ["equipamento", "Equipamento"],
  ["notas", "Notas"],
  ["configurar", "Configurar"],
] as const;
export type AbaDaFicha = (typeof ABAS_DA_FICHA)[number][0];

export type JanelaDeFicha = {
  personagemId: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  /** Ordem de empilhamento: maior = mais à frente. */
  z: number;
  aba: AbaDaFicha;
};

export const LARGURA_MINIMA = 520;
export const ALTURA_MINIMA = 360;

/** Tamanho inicial: grande, mas sempre cabendo na tela. */
function tamanhoInicial() {
  return {
    largura: Math.max(LARGURA_MINIMA, Math.min(860, window.innerWidth - 120)),
    altura: Math.max(ALTURA_MINIMA, Math.min(640, window.innerHeight - 100)),
  };
}

/**
 * As janelas de ficha abertas (várias ao mesmo tempo, arrastáveis e redimensionáveis). Abrir uma que já
 * está aberta só a traz para a frente (e muda a aba, se pedida).
 */
export function useJanelasDeFicha() {
  const [janelas, setJanelas] = useState<JanelaDeFicha[]>([]);
  const topo = useRef(1);

  const abrir = useCallback((personagemId: string, aba?: AbaDaFicha) => {
    setJanelas((atuais) => {
      const z = ++topo.current;
      const existe = atuais.find((j) => j.personagemId === personagemId);
      if (existe) {
        return atuais.map((j) =>
          j.personagemId === personagemId ? { ...j, z, ...(aba ? { aba } : {}) } : j,
        );
      }
      const n = atuais.length;
      const t = tamanhoInicial();
      return [
        ...atuais,
        {
          personagemId,
          x: Math.max(8, Math.min(90 + n * 36, window.innerWidth - t.largura - 8)),
          y: Math.max(8, Math.min(60 + n * 36, window.innerHeight - t.altura - 8)),
          ...t,
          z,
          aba: aba ?? "principal",
        },
      ];
    });
  }, []);

  const fechar = useCallback((personagemId: string) => {
    setJanelas((atuais) => atuais.filter((j) => j.personagemId !== personagemId));
  }, []);

  const atualizar = useCallback((personagemId: string, mudancas: Partial<JanelaDeFicha>) => {
    setJanelas((atuais) =>
      atuais.map((j) => (j.personagemId === personagemId ? { ...j, ...mudancas } : j)),
    );
  }, []);

  const focar = useCallback((personagemId: string) => {
    // Já é a da frente: não redesenha à toa.
    setJanelas((atuais) => {
      const maior = Math.max(...atuais.map((j) => j.z));
      const alvo = atuais.find((j) => j.personagemId === personagemId);
      if (!alvo || alvo.z === maior) return atuais;
      const z = ++topo.current;
      return atuais.map((j) => (j.personagemId === personagemId ? { ...j, z } : j));
    });
  }, []);

  return { janelas, abrir, fechar, atualizar, focar };
}
