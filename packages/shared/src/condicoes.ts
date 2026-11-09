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

const SIGLA_DA_CONDICAO: Record<Condicao, string> = {
  agarrado: "Ag",
  amedrontado: "Am",
  atordoado: "At",
  caido: "Ca",
  cego: "Ce",
  contido: "Ct",
  enfeiticado: "En",
  envenenado: "Ev",
  incapacitado: "Ic",
  inconsciente: "In",
  invisivel: "Iv",
  paralisado: "Pa",
  petrificado: "Pe",
  surdo: "Su",
};

const COR_DA_CONDICAO: Record<Condicao, string> = {
  agarrado: "#b8860b",
  amedrontado: "#8e5bd6",
  atordoado: "#d1495b",
  caido: "#8a6d3b",
  cego: "#5b6678",
  contido: "#c76f2b",
  enfeiticado: "#d6559b",
  envenenado: "#3f9d4a",
  incapacitado: "#a33c3c",
  inconsciente: "#3a6fb0",
  invisivel: "#4aa3b8",
  paralisado: "#c4a000",
  petrificado: "#7b7f86",
  surdo: "#6b7f9e",
};

/** Um marcador pequeno de condição, exaustão ou concentração (borda do token e lista da ficha). */
export type IconeDeCondicao = {
  chave: string;
  /** Duas letras para o ícone do mapa. */
  sigla: string;
  titulo: string;
  resumo: string;
  /** `#rrggbb` */
  cor: string;
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
    sigla: SIGLA_DA_CONDICAO[c],
    titulo: NOME_DA_CONDICAO[c],
    resumo: RESUMO_DA_CONDICAO[c],
    cor: COR_DA_CONDICAO[c],
  }));
  if (t.exaustao !== undefined && t.exaustao > 0) {
    icones.push({
      chave: "exaustao",
      sigla: `E${t.exaustao}`,
      titulo: `Exaustão ${t.exaustao}`,
      resumo: resumoDaExaustao(t.exaustao),
      cor: "#d9822b",
    });
  }
  if (t.concentracao !== undefined) {
    icones.push({
      chave: "concentracao",
      sigla: "Cn",
      titulo: `Concentração: ${t.concentracao}`,
      resumo: RESUMO_DA_CONCENTRACAO,
      cor: "#7a5cd1",
    });
  }
  return icones;
}
