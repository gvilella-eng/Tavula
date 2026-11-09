import type { FormaDeDesenho } from "@tabletop/shared";

/** O que o pincel está configurado para fazer (só da tela de quem desenha; nunca vai para a sala). */
export type ConfigDoPincel = {
  modo: "formas" | "selecionar" | "borracha";
  forma: FormaDeDesenho;
  /** `#rrggbb`. */
  cor: string;
  /** Pixels do mundo (zoom 100%). */
  espessura: number;
  /** Retângulo e círculo: com preenchimento. */
  preenchido: boolean;
};

/** A paleta de 8 cores (a cor livre fica no seletor ao lado). */
export const CORES_DO_PINCEL = [
  "#e6194b",
  "#f58231",
  "#e0a030",
  "#3cb44b",
  "#42d4f4",
  "#4363d8",
  "#911eb4",
  "#ffffff",
] as const;

export const ESPESSURAS_DO_PINCEL: { valor: number; titulo: string }[] = [
  { valor: 2, titulo: "Fina" },
  { valor: 4, titulo: "Média" },
  { valor: 8, titulo: "Grossa" },
  { valor: 14, titulo: "Extragrossa" },
];

export const PINCEL_PADRAO: ConfigDoPincel = {
  modo: "formas",
  forma: "livre",
  cor: CORES_DO_PINCEL[0],
  espessura: 4,
  preenchido: false,
};
