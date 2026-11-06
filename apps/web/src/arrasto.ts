/** Tipo do arrasto de um item das Fichas (para outra pasta ou para o mapa). */
export const TIPO_DE_ARRASTO_DA_FICHA = "application/x-tabletop-item";

export type ItemArrastado = { tipo: "personagem"; id: string };

export function lerItemArrastado(texto: string): ItemArrastado | null {
  try {
    const v = JSON.parse(texto) as Partial<ItemArrastado> | null;
    if (v?.tipo === "personagem" && typeof v.id === "string")
      return { tipo: "personagem", id: v.id };
  } catch {
    // arrasto de outra coisa
  }
  return null;
}
