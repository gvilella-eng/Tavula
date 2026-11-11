/** Tipo do arrasto de um item das Fichas (para outra pasta ou, o personagem, para o mapa). */
export const TIPO_DE_ARRASTO_DA_FICHA = "application/x-tabletop-item";

export type ItemArrastado = { tipo: "personagem" | "handout"; id: string };

export function lerItemArrastado(texto: string): ItemArrastado | null {
  try {
    const v = JSON.parse(texto) as Partial<ItemArrastado> | null;
    if ((v?.tipo === "personagem" || v?.tipo === "handout") && typeof v.id === "string") {
      return { tipo: v.tipo, id: v.id };
    }
  } catch {
    // arrasto de outra coisa
  }
  return null;
}
