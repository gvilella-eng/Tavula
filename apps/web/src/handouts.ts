import type { FonteDeHandout } from "@tabletop/shared";
import { useCallback, useState } from "react";
import { trazerParaFrente } from "./janelas/pilha";

/**
 * As 5 fontes dos handouts (V3), todas empacotadas pelo pnpm (nada vem da internet): Inter (a da interface), Lora
 * (serifada de livro), Caveat (cursiva legível), MedievalSharp (medieval legível) e Special Elite (máquina de
 * escrever). O nome em português é o que aparece no seletor, escrito na própria fonte.
 */
export const FONTES_DO_HANDOUT: readonly {
  id: FonteDeHandout;
  nome: string;
  familia: string;
}[] = [
  { id: "simples", nome: "Simples", familia: '"Inter Variable", system-ui, sans-serif' },
  { id: "livro", nome: "Livro", familia: '"Lora Variable", Georgia, serif' },
  { id: "manuscrito", nome: "Manuscrito", familia: '"Caveat Variable", "Segoe Script", cursive' },
  { id: "medieval", nome: "Medieval", familia: '"MedievalSharp", Georgia, serif' },
  {
    id: "datilografado",
    nome: "Datilografado",
    familia: '"Special Elite", "Courier New", monospace',
  },
];

export function familiaDoHandout(fonte: FonteDeHandout): string {
  return (
    FONTES_DO_HANDOUT.find((f) => f.id === fonte)?.familia ?? FONTES_DO_HANDOUT[0]?.familia ?? ""
  );
}

export function nomeDaFonte(fonte: FonteDeHandout): string {
  return FONTES_DO_HANDOUT.find((f) => f.id === fonte)?.nome ?? "Simples";
}

/** O id da `Janela` de um handout: uma por handout (guarda posição e tamanho de cada uma). */
export const idDaJanelaDoHandout = (handoutId: string) => `handout:${handoutId}`;

/**
 * Os handouts abertos em janelas flutuantes (vários ao mesmo tempo; V3). Abrir um que já está aberto só o traz
 * para a frente. A janela de um handout que sumiu (apagado, ou que o mestre escondeu) não aparece.
 */
export function useJanelasDeHandout() {
  const [abertos, setAbertos] = useState<string[]>([]);
  const abrir = useCallback((handoutId: string) => {
    trazerParaFrente(idDaJanelaDoHandout(handoutId));
    setAbertos((atuais) => (atuais.includes(handoutId) ? atuais : [...atuais, handoutId]));
  }, []);
  const fechar = useCallback((handoutId: string) => {
    setAbertos((atuais) => atuais.filter((x) => x !== handoutId));
  }, []);
  return { abertos, abrir, fechar };
}
