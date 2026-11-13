import { automacoesDe, type Estado } from "@tabletop/shared";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** A frase da seção Automações da aba Mesa: quantos ciclos, reações e botões a mesa tem. */
export function resumoDasAutomacoes(estado: Pick<Estado, "automacoes">): string {
  const a = automacoesDe(estado);
  if (a.ciclos.length + a.reacoes.length + a.botoes.length === 0) {
    return "Nenhuma automação nesta mesa.";
  }
  return [
    plural(a.ciclos.length, "ciclo", "ciclos"),
    plural(a.reacoes.length, "reação", "reações"),
    plural(a.botoes.length, "botão de evento", "botões de evento"),
  ].join(" · ");
}
