import {
  Biohazard,
  Brain,
  Flame,
  FlaskConical,
  Hammer,
  Heart,
  type LucideIcon,
  Pickaxe,
  Skull,
  Snowflake,
  Sparkles,
  Sun,
  Sword,
  Volume2,
  Zap,
} from "lucide-react";
import { NOME_DO_TIPO_DE_DANO, type TipoDeDano } from "./danos";

/**
 * Q5: o ícone de cada tipo de dano (lucide-react). O cartão da rolagem mostra o número e SÓ o ícone, sem a palavra; o
 * nome vai no `aria-label` e no `title`.
 *   ácido FlaskConical · contundente Hammer · cortante Sword · elétrico Zap · energia Sparkles · fogo Flame
 *   frio Snowflake · necrótico Skull · perfurante Pickaxe · psíquico Brain · radiante Sun · trovejante Volume2
 *   veneno Biohazard · cura Heart
 */
export const ICONE_DO_TIPO_DE_DANO: Record<TipoDeDano, LucideIcon> = {
  acido: FlaskConical,
  contundente: Hammer,
  cortante: Sword,
  eletrico: Zap,
  energia: Sparkles,
  fogo: Flame,
  frio: Snowflake,
  necrotico: Skull,
  perfurante: Pickaxe,
  psiquico: Brain,
  radiante: Sun,
  trovejante: Volume2,
  veneno: Biohazard,
  cura: Heart,
};

export function IconeDoDano({ tipo, tamanho = 20 }: { tipo: TipoDeDano; tamanho?: number }) {
  const Icone = ICONE_DO_TIPO_DE_DANO[tipo];
  const nome = NOME_DO_TIPO_DE_DANO[tipo];
  return (
    <span
      className="rc-tipo"
      role="img"
      aria-label={nome}
      title={nome}
      data-tipo={tipo}
      data-testid="icone-de-dano"
    >
      <Icone size={tamanho} aria-hidden="true" />
    </span>
  );
}
