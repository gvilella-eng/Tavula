import type { CorDoSom, IconeDoSom } from "@tabletop/shared";
import {
  Bell,
  Bug,
  DoorOpen,
  Droplet,
  Flame,
  Footprints,
  type LucideIcon,
  Music,
  Skull,
  Swords,
  Users,
  Wind,
  Zap,
} from "lucide-react";

/** Q4: os 12 ícones que o mestre escolhe para um lugar da mesa de som, com o nome que aparece na configuração. */
export const ICONES: Record<IconeDoSom, { Icone: LucideIcon; nome: string }> = {
  chama: { Icone: Flame, nome: "Chama" },
  vento: { Icone: Wind, nome: "Vento" },
  espadas: { Icone: Swords, nome: "Espadas" },
  porta: { Icone: DoorOpen, nome: "Porta" },
  sino: { Icone: Bell, nome: "Sino" },
  gota: { Icone: Droplet, nome: "Gota" },
  caveira: { Icone: Skull, nome: "Caveira" },
  trovao: { Icone: Zap, nome: "Trovão" },
  passos: { Icone: Footprints, nome: "Passos" },
  multidao: { Icone: Users, nome: "Multidão" },
  musica: { Icone: Music, nome: "Música" },
  criatura: { Icone: Bug, nome: "Criatura" },
};

/** As cores da etiqueta: o nome e o token do tema que a pinta (nenhuma cor fixa no CSS). */
export const CORES: Record<CorDoSom, { nome: string; variavel: string }> = {
  ambar: { nome: "Âmbar", variavel: "var(--acento-forte)" },
  laranja: { nome: "Laranja", variavel: "var(--perigo)" },
  verde: { nome: "Verde", variavel: "var(--sucesso)" },
  azul: { nome: "Azul", variavel: "var(--etiqueta-azul)" },
  vermelho: { nome: "Vermelho", variavel: "var(--etiqueta-vermelho)" },
  pedra: { nome: "Pedra", variavel: "var(--texto-suave)" },
};

/** O ícone de um lugar, já na cor da etiqueta (o CSS lê `--cor-do-som`). */
export function IconeDoLugar({ icone, tamanho = 18 }: { icone: IconeDoSom; tamanho?: number }) {
  const { Icone } = ICONES[icone];
  return <Icone size={tamanho} aria-hidden="true" />;
}
