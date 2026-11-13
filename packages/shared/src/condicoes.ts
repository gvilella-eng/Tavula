import { z } from "zod";

// ---------------------------------------------------------------------------------------------
// Condições do 5e 2014 (Lote 11). Ficam no token e só são marcas: nenhuma regra é aplicada sozinha.
// Os resumos abaixo são texto nosso, em pt-BR, só para a dica; a regra completa está nos livros.
// ---------------------------------------------------------------------------------------------

export const CONDICOES = [
  "agarrado",
  "amedrontado",
  "atordoado",
  "caido",
  "cego",
  "contido",
  "enfeiticado",
  "envenenado",
  "incapacitado",
  "inconsciente",
  "invisivel",
  "paralisado",
  "petrificado",
  "surdo",
] as const;
export const CondicaoSchema = z.enum(CONDICOES);
export type Condicao = z.infer<typeof CondicaoSchema>;

export const NIVEIS_DE_EXAUSTAO = [1, 2, 3, 4, 5, 6] as const;

export const NOME_DA_CONDICAO: Record<Condicao, string> = {
  agarrado: "Agarrado",
  amedrontado: "Amedrontado",
  atordoado: "Atordoado",
  caido: "Caído",
  cego: "Cego",
  contido: "Contido",
  enfeiticado: "Enfeitiçado",
  envenenado: "Envenenado",
  incapacitado: "Incapacitado",
  inconsciente: "Inconsciente",
  invisivel: "Invisível",
  paralisado: "Paralisado",
  petrificado: "Petrificado",
  surdo: "Surdo",
};

/** Resumo da regra de cada condição (dica no token e na ficha). */
export const RESUMO_DA_CONDICAO: Record<Condicao, string> = {
  agarrado:
    "Deslocamento 0 e sem bônus de deslocamento. Termina se quem agarra ficar incapacitado ou se um efeito afastar as duas criaturas.",
  amedrontado:
    "Desvantagem em testes de atributo e ataques enquanto a fonte do medo estiver à vista. Não pode se aproximar dela por vontade própria.",
  atordoado:
    "Incapacitado, não se move e só consegue falar de forma entrecortada. Falha automática em salvaguardas de Força e Destreza. Ataques contra a criatura têm vantagem.",
  caido:
    "Só se move rastejando, a menos que se levante (gasta metade do deslocamento). Desvantagem nos próprios ataques. Ataques corpo a corpo contra ela (a até 1,5 m) têm vantagem; à distância, desvantagem.",
  cego: "Não enxerga: falha em testes que dependem da visão. Ataques contra a criatura têm vantagem e os dela têm desvantagem.",
  contido:
    "Deslocamento 0. Ataques contra a criatura têm vantagem e os dela têm desvantagem. Desvantagem em salvaguardas de Destreza.",
  enfeiticado:
    "Não pode atacar quem a enfeitiçou nem o escolher como alvo de efeitos nocivos. Quem a enfeitiçou tem vantagem em testes sociais contra ela.",
  envenenado: "Desvantagem em jogadas de ataque e em testes de atributo.",
  incapacitado: "Não pode realizar ações nem reações.",
  inconsciente:
    "Incapacitado, não se move nem fala e não percebe o que ocorre. Larga o que segura e fica caído. Falha automática em salvaguardas de Força e Destreza. Ataques contra ela têm vantagem e, a até 1,5 m, são críticos.",
  invisivel:
    "Impossível de ver sem magia ou sentido especial (conta como muito obscurecida). Ataques contra a criatura têm desvantagem e os dela têm vantagem.",
  paralisado:
    "Incapacitado, não se move nem fala. Falha automática em salvaguardas de Força e Destreza. Ataques contra a criatura têm vantagem e, a até 1,5 m, são críticos.",
  petrificado:
    "Transformado em substância sólida: incapacitado, não se move nem fala e não percebe o que ocorre. Resistência a todo dano, imune a veneno e doença. Falha automática em salvaguardas de Força e Destreza. Ataques contra ela têm vantagem.",
  surdo: "Não ouve: falha automaticamente em testes que dependem da audição.",
};

/** O que cada nível de exaustão faz (os efeitos se acumulam com os dos níveis anteriores). */
export const RESUMO_DA_EXAUSTAO: Record<number, string> = {
  1: "Desvantagem em testes de atributo.",
  2: "Deslocamento reduzido à metade.",
  3: "Desvantagem em jogadas de ataque e salvaguardas.",
  4: "Máximo de pontos de vida reduzido à metade.",
  5: "Deslocamento reduzido a 0.",
  6: "Morte.",
};

/** Texto da dica da exaustão: o efeito do nível e lembrete de que os anteriores também valem. */
export function resumoDaExaustao(nivel: number): string {
  const efeito = RESUMO_DA_EXAUSTAO[nivel] ?? "";
  return nivel > 1 ? `${efeito} Os efeitos dos níveis anteriores também valem.` : efeito;
}

/** As condições de um token na ordem canônica (alfabética), sem repetição. */
export function condicoesOrdenadas(condicoes: readonly Condicao[] | undefined): Condicao[] {
  const conjunto = new Set(condicoes ?? []);
  return CONDICOES.filter((c) => conjunto.has(c));
}

export const RESUMO_DA_CONCENTRACAO =
  "Mantém uma magia de concentração. Ao sofrer dano, faz uma salvaguarda de Constituição (CD 10 ou metade do dano, a maior). Perde a concentração se ficar incapacitado, morrer ou conjurar outra magia de concentração.";

/** Cor do ícone de cada condição no mapa: tons claros, para ler sobre o fundo escuro da bolinha (V11). */
const COR_DA_CONDICAO: Record<Condicao, string> = {
  agarrado: "#e0b13a",
  amedrontado: "#b48cf0",
  atordoado: "#f0728a",
  caido: "#c9a36a",
  cego: "#9aa7bd",
  contido: "#e8924a",
  enfeiticado: "#f07ac0",
  envenenado: "#5fcf6c",
  incapacitado: "#e06a6a",
  inconsciente: "#6fa2e6",
  invisivel: "#5cc5dc",
  paralisado: "#e6cc3a",
  petrificado: "#a9aeb6",
  surdo: "#8fa4c8",
};

/** Um marcador pequeno de condição, exaustão ou concentração (borda do token). O ícone vem de `chave` (no web). */
export type IconeDeCondicao = {
  chave: string;
  titulo: string;
  resumo: string;
  /** `#rrggbb` */
  cor: string;
  /** Só a exaustão: o nível, escrito junto do ícone. */
  nivel?: number;
};

type ComMarcas = {
  condicoes?: readonly Condicao[] | undefined;
  exaustao?: number | undefined;
  concentracao?: string | undefined;
};

/** Os marcadores de um token: as condições (ordem fixa), a exaustão e a concentração. */
export function iconesDoToken(t: ComMarcas): IconeDeCondicao[] {
  const icones: IconeDeCondicao[] = condicoesOrdenadas(t.condicoes).map((c) => ({
    chave: c,
    titulo: NOME_DA_CONDICAO[c],
    resumo: RESUMO_DA_CONDICAO[c],
    cor: COR_DA_CONDICAO[c],
  }));
  if (t.exaustao !== undefined && t.exaustao > 0) {
    icones.push({
      chave: "exaustao",
      nivel: t.exaustao,
      titulo: `Exaustão ${t.exaustao}`,
      resumo: resumoDaExaustao(t.exaustao),
      cor: "#f0a04b",
    });
  }
  if (t.concentracao !== undefined) {
    icones.push({
      chave: "concentracao",
      titulo: `Concentração: ${t.concentracao}`,
      resumo: RESUMO_DA_CONCENTRACAO,
      cor: "#a88af0",
    });
  }
  return icones;
}
