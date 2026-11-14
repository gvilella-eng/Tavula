import type { Personagem } from "@tabletop/shared";
import { useState } from "react";
import { useFichasFora } from "./ficha/foraDaMesa";
import { useFichasNaPilha } from "./janelas/pilha";

/**
 * Quem recebe o que o Compêndio adiciona ("Ficha de"): a ficha aberta em foco que eu edito; sem ficha
 * aberta, a primeira dos meus personagens. Uma escolha à mão vale até eu focar outra ficha (assumido).
 */
export function useAlvoDaFicha(
  meus: readonly Personagem[],
): [Personagem | undefined, (id: string) => void] {
  const abertas = useFichasNaPilha();
  // V9: as fichas em janela própria saem da pilha mas continuam alvo (a mudança passa pela sala): vêm depois das da mesa.
  const fora = useFichasFora();
  const emFoco =
    [...fora, ...abertas].reverse().find((id) => meus.some((p) => p.id === id)) ?? null;
  const [escolha, setEscolha] = useState<string | null>(null);
  // Focou outra ficha: a escolha à mão acaba (ajuste durante o render, sem efeito).
  const [focoVisto, setFocoVisto] = useState(emFoco);
  if (focoVisto !== emFoco) {
    setFocoVisto(emFoco);
    setEscolha(null);
  }
  const alvo = meus.find((p) => p.id === escolha) ?? meus.find((p) => p.id === emFoco) ?? meus[0];
  return [alvo, setEscolha];
}
