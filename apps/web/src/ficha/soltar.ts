import {
  aplicarEntradaNaFicha,
  type DestinoDaEntrada,
  type EntradaDoCompendio,
} from "@tabletop/shared";
import type { PropsDaAba } from "./AbaPrincipal";

/**
 * Põe na ficha o que veio do compêndio (o arrasto e o botão "Adicionar à ficha" usam a mesma conta, em
 * `aplicarEntradaNaFicha`) e avisa o resultado no alto da janela.
 */
export function soltarNaFicha(
  p: Pick<PropsDaAba, "ficha" | "alterar" | "avisar">,
  modo: "personagem" | "npc",
  entrada: EntradaDoCompendio,
  destino: DestinoDaEntrada,
) {
  const r = aplicarEntradaNaFicha(p.ficha, entrada, modo, destino);
  if (!r.ok) return p.avisar(r.motivo);
  if (!p.alterar(r.operacoes)) return p.avisar("Não coube na ficha.");
  p.avisar(r.texto);
}
