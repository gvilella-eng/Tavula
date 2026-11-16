import { normalizarBusca } from "@tabletop/shared";

/**
 * Q5: os tipos de dano da 5e e o ícone de cada um (lucide-react; o mapeamento fica em `IconeDoDano.tsx`).
 * A ficha escreve o tipo como texto livre ("Cortante", "Fogo + Frio"); aqui ele vira uma chave.
 */
export const TIPOS_DE_DANO = [
  "acido",
  "contundente",
  "cortante",
  "eletrico",
  "energia",
  "fogo",
  "frio",
  "necrotico",
  "perfurante",
  "psiquico",
  "radiante",
  "trovejante",
  "veneno",
  "cura",
] as const;
export type TipoDeDano = (typeof TIPOS_DE_DANO)[number];

/** O nome do tipo, com acento (vai no aria-label e no title do ícone). */
export const NOME_DO_TIPO_DE_DANO: Record<TipoDeDano, string> = {
  acido: "ácido",
  contundente: "contundente",
  cortante: "cortante",
  eletrico: "elétrico",
  energia: "energia",
  fogo: "fogo",
  frio: "frio",
  necrotico: "necrótico",
  perfurante: "perfurante",
  psiquico: "psíquico",
  radiante: "radiante",
  trovejante: "trovejante",
  veneno: "veneno",
  cura: "cura",
};

/** As grafias que a ficha e o compêndio usam para o mesmo tipo (sem acento, minúsculas). */
const SINONIMOS: Record<string, TipoDeDano> = {
  forca: "energia", // a ficha escreve "Força": é o dano de energia (force) da 5e
  gelido: "frio",
  venenoso: "veneno",
  relampago: "eletrico",
  eletrica: "eletrico",
  eletricidade: "eletrico",
  corrosivo: "acido",
  necrotica: "necrotico",
  psiquica: "psiquico",
};

/** Os tipos de dano citados no texto, na ordem em que aparecem e sem repetir ("Cortante + Fogo"). */
export function tiposDeDanoDoTexto(texto: string | undefined): TipoDeDano[] {
  if (!texto) return [];
  const achados: TipoDeDano[] = [];
  for (const palavra of normalizarBusca(texto).split(/[^a-z]+/)) {
    if (palavra === "") continue;
    const tipo = (TIPOS_DE_DANO as readonly string[]).includes(palavra)
      ? (palavra as TipoDeDano)
      : SINONIMOS[palavra];
    if (tipo && !achados.includes(tipo)) achados.push(tipo);
  }
  return achados;
}
