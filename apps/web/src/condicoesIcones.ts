import { CONDICOES, type Condicao } from "@tabletop/shared";
import {
  ArrowDownToLine,
  Ban,
  BatteryLow,
  Brain,
  EarOff,
  EyeOff,
  FlaskConical,
  Frown,
  Ghost,
  HandGrab,
  Heart,
  Link,
  type LucideIcon,
  Moon,
  Mountain,
  Snowflake,
  Sparkles,
} from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * V11: o ícone de cada condição, da exaustão e da concentração. Um lugar só: o token no mapa (rasterizado
 * numa textura) e o menu de condições usam esta tabela. Só ícones do lucide, nenhuma arte de terceiros.
 */
export type ChaveDeIcone = Condicao | "exaustao" | "concentracao";

export const ICONE_DA_CONDICAO: Record<ChaveDeIcone, LucideIcon> = {
  agarrado: HandGrab,
  amedrontado: Frown,
  atordoado: Sparkles,
  caido: ArrowDownToLine,
  cego: EyeOff,
  contido: Link,
  enfeiticado: Heart,
  envenenado: FlaskConical,
  incapacitado: Ban,
  inconsciente: Moon,
  invisivel: Ghost,
  paralisado: Snowflake,
  petrificado: Mountain,
  surdo: EarOff,
  exaustao: BatteryLow,
  concentracao: Brain,
};

/** Todas as chaves, na ordem em que o menu as mostra. */
export const CHAVES_DE_ICONE: readonly ChaveDeIcone[] = [...CONDICOES, "exaustao", "concentracao"];

/** O ícone da chave (`undefined` para uma chave que não é de condição). */
export function iconeDaChave(chave: string): LucideIcon | undefined {
  return (ICONE_DA_CONDICAO as Record<string, LucideIcon | undefined>)[chave];
}

/** O SVG do ícone como texto (para virar imagem e depois textura do Pixi). Traço na cor dada. */
export function svgDoIcone(chave: string, cor: string, lado = 64): string | null {
  const Icone = iconeDaChave(chave);
  if (!Icone) return null;
  return renderToStaticMarkup(
    createElement(Icone, {
      size: lado,
      color: cor,
      strokeWidth: 2.2,
      xmlns: "http://www.w3.org/2000/svg",
    }),
  );
}
