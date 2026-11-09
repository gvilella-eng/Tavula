import { z } from "zod";
import type { Estado, Usuario } from "./estado.ts";
import { tokenVisivelPara } from "./mapa.ts";

// ---------------------------------------------------------------------------------------------
// Combate (Lote 11): a ordem de turno. Puro e testado; `combatenucleo.ts` cuida das intenções.
// A vez é guardada pelo ID da entrada, nunca pelo índice (o índice revelaria quantas entradas
// ocultas existem).
// ---------------------------------------------------------------------------------------------

const Id = z.string().min(1).max(64);

export const LIMITES_DO_COMBATE = {
  /** Entradas na ordem de turno. */
  entradas: 200,
  iniciativaMin: -99,
  iniciativaMax: 999,
} as const;

export const IniciativaSchema = z
  .number()
  .int()
  .min(LIMITES_DO_COMBATE.iniciativaMin)
  .max(LIMITES_DO_COMBATE.iniciativaMax);

export const EntradaDeCombateSchema = z.object({
  id: Id,
  /** Entrada de um token (o nome acompanha o do token quando entrou); sem ele é uma entrada solta ("Covil"). */
  tokenId: Id.optional(),
  nome: z.string().trim().min(1).max(64),
  /** Sem valor ainda: a entrada fica no fim da lista, esperando a rolagem. */
  iniciativa: IniciativaSchema.optional(),
  /** Valor do atributo Destreza (1 a 30) no desempate. Só mestre e sala: o jogador nunca recebe. */
  destreza: z.number().int().min(1).max(30).optional(),
  /** O token é de um personagem de jogador (desempate: PJ antes de NPC). */
  jogador: z.boolean().optional(),
  /** O jogador vê o nome com "?" no lugar do número. */
  valorOculto: z.boolean().optional(),
  /** O jogador não recebe a entrada de jeito nenhum. */
  oculta: z.boolean().optional(),
});
export type EntradaDeCombate = z.infer<typeof EntradaDeCombateSchema>;

export const CombateSchema = z.object({
  entradas: z.array(EntradaDeCombateSchema).max(LIMITES_DO_COMBATE.entradas),
  /** Id da entrada da vez; sem ele o combate ainda não começou. */
  atualId: Id.optional(),
  /** 0 = ainda não começou; o primeiro "Próximo" abre a rodada 1. */
  rodada: z.number().int().min(0).max(9999),
});
export type Combate = z.infer<typeof CombateSchema>;

export const COMBATE_VAZIO: Combate = { entradas: [], rodada: 0 };

export function combateDe(estado: Pick<Estado, "combate">): Combate {
  return estado.combate ?? COMBATE_VAZIO;
}

// ---------------------------------------------------------------------------------------------
// Ordenação
// ---------------------------------------------------------------------------------------------

const comparaNomes = new Intl.Collator("pt-BR", { sensitivity: "base" });

/**
 * Ordem da lista: iniciativa maior primeiro; empate: maior Destreza; empate de novo: personagem de
 * jogador antes de NPC; depois o nome (A a Z); por fim a posição de antes (estável). Quem ainda não
 * tem valor fica no fim, na ordem em que já estava.
 */
export function ordenarEntradas(entradas: readonly EntradaDeCombate[]): EntradaDeCombate[] {
  return entradas
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ia = a.e.iniciativa;
      const ib = b.e.iniciativa;
      if (ia === undefined || ib === undefined) {
        if (ia === undefined && ib === undefined) return a.i - b.i;
        return ia === undefined ? 1 : -1;
      }
      if (ia !== ib) return ib - ia;
      const da = a.e.destreza ?? 0;
      const db = b.e.destreza ?? 0;
      if (da !== db) return db - da;
      const ja = a.e.jogador === true;
      const jb = b.e.jogador === true;
      if (ja !== jb) return ja ? -1 : 1;
      return comparaNomes.compare(a.e.nome, b.e.nome) || a.i - b.i;
    })
    .map((x) => x.e);
}

/** O combate com as entradas reordenadas pelos valores (a vez continua na mesma entrada). */
export function ordenarCombate(combate: Combate): Combate {
  return { ...combate, entradas: ordenarEntradas(combate.entradas) };
}

// ---------------------------------------------------------------------------------------------
// Turnos
// ---------------------------------------------------------------------------------------------

function comAtual(combate: Combate, atualId: string | undefined, rodada: number): Combate {
  const { atualId: _antigo, ...resto } = combate;
  return { ...resto, ...(atualId === undefined ? {} : { atualId }), rodada };
}

/**
 * Próximo turno. O primeiro começa na rodada 1, na primeira entrada; passar da última volta à
 * primeira e soma a rodada. Sem entradas, nada muda.
 */
export function proximoTurno(combate: Combate): Combate {
  const { entradas } = combate;
  const primeira = entradas[0];
  if (!primeira) return combate;
  const i = entradas.findIndex((e) => e.id === combate.atualId);
  if (combate.atualId === undefined || i === -1) {
    return comAtual(combate, primeira.id, Math.max(combate.rodada, 1));
  }
  const proxima = entradas[i + 1];
  if (proxima) return comAtual(combate, proxima.id, combate.rodada);
  return comAtual(combate, primeira.id, combate.rodada + 1);
}

/**
 * Turno anterior. Da primeira entrada volta à última da rodada anterior; na rodada 1 não há para
 * onde voltar. Combate que ainda não começou fica como está.
 */
export function turnoAnterior(combate: Combate): Combate {
  const { entradas } = combate;
  const i = entradas.findIndex((e) => e.id === combate.atualId);
  if (combate.atualId === undefined || i === -1) return combate;
  const anterior = entradas[i - 1];
  if (anterior) return comAtual(combate, anterior.id, combate.rodada);
  const ultima = entradas[entradas.length - 1];
  if (combate.rodada > 1 && ultima) return comAtual(combate, ultima.id, combate.rodada - 1);
  return combate;
}

/**
 * Tira uma entrada. Se era a vez, o turno passa para a seguinte (e, se era a última, volta à primeira
 * e a rodada vira); se a lista esvazia, ninguém fica na vez.
 */
export function tirarEntrada(combate: Combate, id: string): Combate {
  const i = combate.entradas.findIndex((e) => e.id === id);
  if (i === -1) return combate;
  const entradas = combate.entradas.filter((e) => e.id !== id);
  if (combate.atualId !== id) return { ...combate, entradas };
  const sem = { ...combate, entradas };
  const seguinte = entradas[i];
  if (seguinte) return comAtual(sem, seguinte.id, combate.rodada);
  const primeira = entradas[0];
  return primeira
    ? comAtual(sem, primeira.id, combate.rodada + 1)
    : comAtual(sem, undefined, combate.rodada);
}

/** Move a entrada para a posição `indice` da lista (mão do mestre; a vez continua na mesma entrada). */
export function moverEntrada(combate: Combate, id: string, indice: number): Combate {
  const de = combate.entradas.findIndex((e) => e.id === id);
  if (de === -1) return combate;
  const entradas = [...combate.entradas];
  const [entrada] = entradas.splice(de, 1);
  if (!entrada) return combate;
  const para = Math.min(Math.max(Math.trunc(indice), 0), entradas.length);
  entradas.splice(para, 0, entrada);
  return { ...combate, entradas };
}

// ---------------------------------------------------------------------------------------------
// Sigilo
// ---------------------------------------------------------------------------------------------

type Quem = Pick<Usuario, "id" | "papel">;
type ComTokens = Pick<Estado, "tokens" | "cenaAtivaId">;

/**
 * O usuário recebe esta entrada? O mestre sempre. O jogador não: se ela é `oculta`, se o token dela
 * não chega a ele (oculto, na camada do mestre, de outra cena, apagado).
 */
export function entradaVisivelPara(
  entrada: EntradaDeCombate,
  usuario: Quem,
  estado: ComTokens,
): boolean {
  if (usuario.papel === "mestre") return true;
  if (entrada.oculta === true) return false;
  if (entrada.tokenId === undefined) return true;
  const token = estado.tokens.find((t) => t.id === entrada.tokenId);
  return token !== undefined && tokenVisivelPara(token, usuario, estado.cenaAtivaId);
}

/**
 * O combate como o usuário o recebe. O mestre recebe tudo. O jogador só recebe as entradas que vê,
 * sem a Destreza e sem a marca `oculta`; `valorOculto` troca o número por "?" (o número nunca viaja);
 * se a vez é de uma entrada que ele não vê, ninguém fica em destaque. A rodada chega a todos.
 */
export function combateParaUsuario(combate: Combate, usuario: Quem, estado: ComTokens): Combate {
  if (usuario.papel === "mestre") return combate;
  const entradas: EntradaDeCombate[] = [];
  for (const e of combate.entradas) {
    if (!entradaVisivelPara(e, usuario, estado)) continue;
    entradas.push({
      id: e.id,
      ...(e.tokenId === undefined ? {} : { tokenId: e.tokenId }),
      nome: e.nome,
      ...(e.jogador === true ? { jogador: true } : {}),
      ...(e.valorOculto === true
        ? { valorOculto: true }
        : e.iniciativa === undefined
          ? {}
          : { iniciativa: e.iniciativa }),
    });
  }
  const atualVisivel = entradas.some((e) => e.id === combate.atualId);
  return {
    entradas,
    ...(atualVisivel && combate.atualId !== undefined ? { atualId: combate.atualId } : {}),
    rodada: combate.rodada,
  };
}

/** A entrada da vez, se a visão a tem. */
export function entradaDaVez(combate: Combate | undefined): EntradaDeCombate | undefined {
  return combate?.entradas.find((e) => e.id === combate.atualId);
}
