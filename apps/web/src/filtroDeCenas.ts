import { pontuarBusca, prepararConsulta } from "@tabletop/shared";

/** Q7: as cenas que casam com o texto da busca (pelo nome, sem acento, por palavra e começo, com erro pequeno). Mantém a ordem. */
export function filtrarCenas<T extends { nome: string }>(cenas: readonly T[], texto: string): T[] {
  const consulta = prepararConsulta(texto);
  if (consulta === null) return [...cenas];
  return cenas.filter((c) => pontuarBusca(c, consulta) !== null);
}
