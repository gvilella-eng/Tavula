import { useCallback, useState } from "react";
import { trazerParaFrente } from "../janelas/pilha";

export const ABAS_DA_FICHA = [
  // As quatro abas do desenho aprovado (V4a). O id `principal` é o da aba Personagem.
  ["principal", "Personagem"],
  ["magias", "Magias"],
  ["historia", "História"],
  ["configurar", "Configurar"],
] as const;
export type AbaDaFicha = (typeof ABAS_DA_FICHA)[number][0];

/** Uma ficha aberta. A posição, o tamanho e a pilha são da `Janela` (por pessoa, no navegador). */
export type JanelaDeFicha = {
  personagemId: string;
  aba: AbaDaFicha;
  /** Q10: o token do mapa de onde a ficha foi aberta (o botão direito "Abrir ficha" ou a CA): a faixa "Este token" mostra a vida dele. */
  tokenId?: string | undefined;
};

/** Abaixo disso a ficha vira o layout estreito (cabeçalho grudado e acordeão), pela medida da janela. */
export const LARGURA_DA_FICHA_ESTREITA = 620;
export const LARGURA_PADRAO = 880;
export const LARGURA_MINIMA = 420;
/** O bloco de NPC (V4b): ~520 px de largura (a medida do desenho N) e uma coluna só abaixo de ~460. */
export const LARGURA_DO_NPC = 520;
export const LARGURA_MINIMA_DO_NPC = 380;
export const LARGURA_DO_NPC_ESTREITO = 460;
export const ALTURA_MINIMA = 360;

/** O id da `Janela` de uma ficha: uma por personagem (guarda posição e tamanho de cada uma). */
export const idDaJanelaDaFicha = (personagemId: string) => `ficha:${personagemId}`;

/**
 * As janelas de ficha abertas (várias ao mesmo tempo). Abrir uma que já está aberta só a traz para a
 * frente (e muda a aba, se pedida).
 */
export function useJanelasDeFicha() {
  const [janelas, setJanelas] = useState<JanelaDeFicha[]>([]);

  const abrir = useCallback((personagemId: string, aba?: AbaDaFicha, tokenId?: string) => {
    trazerParaFrente(idDaJanelaDaFicha(personagemId));
    setJanelas((atuais) => {
      if (atuais.some((j) => j.personagemId === personagemId)) {
        // Q10: abrir pelo token liga a faixa dele; abrir pela lista (sem token) a tira.
        return atuais.map((j) =>
          j.personagemId === personagemId ? { ...j, ...(aba ? { aba } : {}), tokenId } : j,
        );
      }
      return [...atuais, { personagemId, aba: aba ?? "principal", tokenId }];
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
