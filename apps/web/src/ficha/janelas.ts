import { useCallback, useState } from "react";
import { trazerParaFrente } from "../janelas/pilha";

export const ABAS_DA_FICHA = [
  ["principal", "Principal"],
  ["magias", "Magias"],
  ["caracteristicas", "Características"],
  ["equipamento", "Equipamento"],
  ["notas", "Notas"],
  ["configurar", "Configurar"],
] as const;
export type AbaDaFicha = (typeof ABAS_DA_FICHA)[number][0];

/** Uma ficha aberta. A posição, o tamanho e a pilha são da `Janela` (por pessoa, no navegador). */
export type JanelaDeFicha = {
  personagemId: string;
  aba: AbaDaFicha;
};

export const LARGURA_MINIMA = 520;
export const ALTURA_MINIMA = 360;

/** O id da `Janela` de uma ficha: uma por personagem (guarda posição e tamanho de cada uma). */
export const idDaJanelaDaFicha = (personagemId: string) => `ficha:${personagemId}`;

/**
 * As janelas de ficha abertas (várias ao mesmo tempo). Abrir uma que já está aberta só a traz para a
 * frente (e muda a aba, se pedida).
 */
export function useJanelasDeFicha() {
  const [janelas, setJanelas] = useState<JanelaDeFicha[]>([]);

  const abrir = useCallback((personagemId: string, aba?: AbaDaFicha) => {
    trazerParaFrente(idDaJanelaDaFicha(personagemId));
    setJanelas((atuais) => {
      if (atuais.some((j) => j.personagemId === personagemId)) {
        return aba
          ? atuais.map((j) => (j.personagemId === personagemId ? { ...j, aba } : j))
          : atuais;
      }
      return [...atuais, { personagemId, aba: aba ?? "principal" }];
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

  return { janelas, abrir, fechar, atualizar };
}
