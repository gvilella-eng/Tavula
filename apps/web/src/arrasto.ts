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

// V10b: o item das Fichas que está sendo arrastado agora. O navegador não deixa ler o conteúdo do arrasto antes de
// soltar; por isso a lista o guarda aqui, para o mapa acender a área da bandeira durante o arrasto.
let itemEmArrasto: ItemArrastado | null = null;
const ouvintesDoArrasto = new Set<() => void>();

function avisarArrasto() {
  for (const f of ouvintesDoArrasto) f();
}

export function definirItemEmArrasto(item: ItemArrastado | null) {
  if (itemEmArrasto?.id === item?.id && itemEmArrasto?.tipo === item?.tipo) return;
  itemEmArrasto = item;
  avisarArrasto();
}

export function itemEmArrastoAgora(): ItemArrastado | null {
  return itemEmArrasto;
}

export function ouvirArrasto(f: () => void): () => void {
  ouvintesDoArrasto.add(f);
  return () => ouvintesDoArrasto.delete(f);
}

// O arrasto acaba (solto em qualquer lugar ou cancelado com Esc): a área apaga.
if (typeof window !== "undefined") {
  const fim = () => definirItemEmArrasto(null);
  window.addEventListener("dragend", fim, true);
  window.addEventListener("drop", fim, true);
}
