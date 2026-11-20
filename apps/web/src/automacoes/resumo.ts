import { automacoesDe, type Estado } from "@tabletop/shared";

/** A frase da seção Automações da aba Mesa: quantas automações a mesa tem e quantas estão ligadas. */
export function resumoDasAutomacoes(estado: Pick<Estado, "automacoes">): string {
  const a = automacoesDe(estado);
  if (a.fluxos.length === 0) return "Nenhuma automação nesta mesa.";
  const ligadas = a.fluxos.filter((f) => f.ligado).length;
  const total = a.fluxos.length === 1 ? "1 automação" : `${a.fluxos.length} automações`;
  return `${total} · ${ligadas === 1 ? "1 ligada" : `${ligadas} ligadas`}`;
}
