import { z } from "zod";
import type { Estado, Token } from "./estado.ts";

// ---------------------------------------------------------------------------------------------
// Automações da mesa (Lote 7b-1, seção 4.11). Este arquivo só tem os DADOS: schemas zod, constantes e
// funções puras de leitura. O motor que os executa fica em `automacoesnucleo.ts`.
//
// Sigilo (regra 7): as definições (ciclos, reações, a execução dos ciclos, os eventos pendentes e o
// registro) moram na fatia `Estado.automacoes`, que SÓ o mestre recebe. O jogador recebe apenas os
// efeitos: a luz que mudou (`fonte.editada`), o anúncio no chat, o token mostrado e o limite de visão
// (`Estado.efeitos`, sem a origem).
// ---------------------------------------------------------------------------------------------

const Id = z.string().min(1).max(64);

/** Quantos níveis de reação-que-dispara-evento valem antes de o motor cortar (regra 5; assumido). */
export const PROFUNDIDADE_MAXIMA = 5;
/** Teto de ações aplicadas (ação × alvo) por disparo, contando o encadeamento inteiro (assumido). */
export const TETO_DE_ACOES = 500;
/** Prazo de um efeito temporário quando nem a ação nem a fase dizem quanto (assumido). */
export const DURACAO_PADRAO_S = 30;
/** Quantas fases perdidas o motor recupera de uma vez (o resto é pulado e anotado). */
export const MAXIMO_DE_FASES_ATRASADAS = 50;
export const MAXIMO_DO_REGISTRO = 30;

/** Os eventos que a própria sala produz (4.11). `token.entrouNaZona` chega no 7b-2. */
export const EVENTOS_DO_SISTEMA = [
  "objeto.acendeu",
  "objeto.apagou",
  "turno.inicio",
  "cena.ativada",
] as const;

/** Nome de evento: letras, números, ponto, hífen e sublinhado ("inspiracao", "objeto.apagou"). */
export const NomeDeEventoSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[\p{L}\p{N}._-]+$/u, "Use só letras, números, ponto, hífen e sublinhado.");

const Segundos = z
  .number()
  .positive()
  .max(7 * 86400);

// --- Ciclos ----------------------------------------------------------------------------------

/** Uma fase: no segundo `emS` do período dispara o evento (`duracaoS` é o prazo padrão dos efeitos dele). */
export const FaseSchema = z.object({
  emS: z
    .number()
    .min(0)
    .max(7 * 86400),
  evento: NomeDeEventoSchema,
  duracaoS: Segundos.optional(),
});
export type Fase = z.infer<typeof FaseSchema>;

/** Os campos de um ciclo, sem a conferência cruzada (as mudanças parciais do `ciclo.editar` partem daqui). */
export const CicloCamposSchema = z.object({
  id: Id,
  nome: z.string().min(1).max(64),
  periodoS: Segundos,
  /** As cenas onde o ciclo vale (regra 4). Vazia = todas (assumido). */
  cenas: z.array(Id).max(100).default([]),
  fases: z.array(FaseSchema).min(1).max(20),
  /** Para o editor do 7b-3: o mestre pode liberar os botões do ciclo aos jogadores. */
  liberadoParaJogadores: z.boolean().optional(),
});
export const CicloSchema = CicloCamposSchema.superRefine((c, ctx) => {
  const vistos = new Set<number>();
  for (const [i, f] of c.fases.entries()) {
    if (f.emS >= c.periodoS) {
      ctx.addIssue({
        code: "custom",
        path: ["fases", i, "emS"],
        message: "A fase precisa cair antes do fim do período.",
      });
    }
    if (vistos.has(f.emS)) {
      ctx.addIssue({
        code: "custom",
        path: ["fases", i, "emS"],
        message: "Duas fases no mesmo segundo: use uma só e encadeie com evento.disparar.",
      });
    }
    vistos.add(f.emS);
  }
});
export type Ciclo = z.infer<typeof CicloSchema>;

/**
 * O estado de execução de um ciclo, medido no TEMPO DA SALA (então pausar a mesa o congela sem conta
 * extra). O tempo do ciclo, τ, é `salaMs − baseSala` enquanto roda e `pausadoEmTau` quando pausado.
 * `disparadoAteTau`: as fases até este τ (inclusive) já dispararam; −1 = nenhuma ainda.
 */
export const ExecucaoDoCicloSchema = z.object({
  baseSala: z.number(),
  pausadoEmTau: z.number().nonnegative().optional(),
  disparadoAteTau: z.number().min(-1),
});
export type ExecucaoDoCiclo = z.infer<typeof ExecucaoDoCicloSchema>;

// --- Eventos ---------------------------------------------------------------------------------

/**
 * Um evento em andamento. `cenas`: o escopo (regra 4), `null` = qualquer cena. `objetoId` e `tokenId`
 * dizem de quem o evento trata (o objeto que acendeu, o token da vez).
 */
export const EventoDeAutomacaoSchema = z.object({
  nome: NomeDeEventoSchema,
  cenas: z.array(Id).max(100).nullable(),
  origem: z.enum(["ciclo", "manual", "sistema", "reacao"]),
  objetoId: Id.optional(),
  modeloId: Id.optional(),
  tokenId: Id.optional(),
  /** O prazo padrão dos efeitos (vem da fase do ciclo). */
  duracaoS: Segundos.optional(),
});
export type EventoDeAutomacao = z.infer<typeof EventoDeAutomacaoSchema>;

/** Um evento marcado para daqui a pouco (`evento.disparar` com `atrasoS`), no tempo da sala. */
export const PendenteSchema = z.object({
  id: Id,
  ateSala: z.number().nonnegative(),
  evento: EventoDeAutomacaoSchema,
  /** Em que nível do encadeamento ele vai rodar (o atraso não zera a conta). */
  profundidade: z
    .number()
    .int()
    .min(0)
    .max(PROFUNDIDADE_MAXIMA + 1),
});
export type Pendente = z.infer<typeof PendenteSchema>;

// --- Condições e ações -----------------------------------------------------------------------

/** "Se...": a reação só segue se todas valem para o alvo dela. */
export const CondicaoDeReacaoSchema = z.discriminatedUnion("condicao", [
  /** Sorteio no RNG da sala (0 a 1). */
  z.object({ condicao: z.literal("chance"), valor: z.number().min(0).max(1) }),
  /** O objeto alvo tem esta tag (a do modelo dele). */
  z.object({ condicao: z.literal("tag"), tag: z.string().min(1).max(32) }),
  /** O alvo está numa destas cenas. */
  z.object({ condicao: z.literal("cena"), cenas: z.array(Id).min(1).max(100) }),
]);
export type CondicaoDeReacao = z.infer<typeof CondicaoDeReacaoSchema>;

/**
 * Quais objetos de luz uma ação atinge. Sem `alvo`, a ação vale para o objeto da reação (reação de
 * modelo) ou para o do evento (`objeto.acendeu`); sem nenhum dos dois, para todos os objetos das cenas
 * do evento. Com `alvo`, filtra os objetos das cenas do evento por modelo e/ou tag.
 */
export const AlvoDeObjetoSchema = z.object({
  modeloId: Id.optional(),
  tag: z.string().min(1).max(32).optional(),
});
export type AlvoDeObjeto = z.infer<typeof AlvoDeObjetoSchema>;

/**
 * Quais tokens uma ação atinge. Sem `alvo`: quem carrega o objeto da reação (token da luz ou dono da
 * tocha na mão) ou, sem objeto, todos os tokens das cenas do evento. Com `ids`, só esses.
 */
export const AlvoDeTokenSchema = z.object({ ids: z.array(Id).min(1).max(50).optional() });
export type AlvoDeToken = z.infer<typeof AlvoDeTokenSchema>;

const Prazo = Segundos.optional();

/** A lista FECHADA de ações (regra 1). `som.tocar` fica fora (decisão de 2026-11-13); `zona.ativar` é do 7b-2. */
export const AcaoSchema = z.discriminatedUnion("acao", [
  /** Multiplica (`raioX`) e/ou soma (`raioSomaM`) o raio da luz por um prazo: um modificador, nunca o valor base. */
  z
    .object({
      acao: z.literal("luz.modificar"),
      raioX: z.number().min(0.1).max(5).optional(),
      raioSomaM: z.number().min(-100).max(100).optional(),
      porS: Prazo,
      alvo: AlvoDeObjetoSchema.optional(),
    })
    .refine((a) => a.raioX !== undefined || a.raioSomaM !== undefined, {
      message: "Diga o raioX, o raioSomaM ou os dois.",
    }),
  /** Apaga o objeto aceso (com `chance`) e desconta `penalidadeS` do que sobra. */
  z.object({
    acao: z.literal("objeto.apagar"),
    chance: z.number().min(0).max(1).optional(),
    penalidadeS: z
      .number()
      .min(0)
      .max(100 * 3600)
      .optional(),
    alvo: AlvoDeObjetoSchema.optional(),
  }),
  /** Soma ou tira tempo do que sobra do objeto. */
  z.object({
    acao: z.literal("objeto.ajustarTempo"),
    deltaS: z
      .number()
      .min(-100 * 3600)
      .max(100 * 3600)
      .refine((n) => n !== 0, "O ajuste não pode ser zero."),
    alvo: AlvoDeObjetoSchema.optional(),
  }),
  /** Limita o alcance de visão do token por um prazo (um efeito, nunca o valor base). */
  z.object({
    acao: z.literal("visao.limitar"),
    alcanceM: z.number().min(0.5).max(1000),
    porS: Prazo,
    alvo: AlvoDeTokenSchema.optional(),
  }),
  /** Uma linha no chat da mesa, para todos ou só para o mestre. */
  z.object({
    acao: z.literal("chat.anunciar"),
    texto: z.string().trim().min(1).max(300),
    para: z.enum(["todos", "mestre"]).default("todos"),
  }),
  z.object({ acao: z.literal("token.mostrar"), alvo: AlvoDeTokenSchema.optional() }),
  z.object({ acao: z.literal("token.ocultar"), alvo: AlvoDeTokenSchema.optional() }),
  /** Dispara outro evento, já ou depois de `atrasoS` (no tempo da sala). Conta no limite de encadeamento. */
  z.object({
    acao: z.literal("evento.disparar"),
    evento: NomeDeEventoSchema,
    atrasoS: z
      .number()
      .min(0)
      .max(7 * 86400)
      .optional(),
  }),
]);
export type Acao = z.infer<typeof AcaoSchema>;
export type TipoDeAcaoDeAutomacao = Acao["acao"];

// --- Reações ---------------------------------------------------------------------------------

/**
 * A quem a reação está presa: a um modelo de objeto (toda instância herda), a uma cena ou à mesa toda.
 * As zonas vêm no 7b-2.
 */
export const FicaSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("modelo"), id: Id }),
  z.object({ tipo: z.literal("cena"), id: Id }),
  z.object({ tipo: z.literal("mesa") }),
]);
export type Fica = z.infer<typeof FicaSchema>;

export const ReacaoSchema = z.object({
  id: Id,
  nome: z.string().min(1).max(64).optional(),
  /** Desligada, não roda (o editor do 7b-3 liga e desliga sem apagar). */
  ativa: z.boolean().default(true),
  fica: FicaSchema,
  /** "Ao receber o evento X". */
  ao: NomeDeEventoSchema,
  se: z.array(CondicaoDeReacaoSchema).max(8).default([]),
  fazer: z.array(AcaoSchema).min(1).max(20),
});
export type Reacao = z.infer<typeof ReacaoSchema>;

// --- A fatia do estado -----------------------------------------------------------------------

export const ItemDoRegistroSchema = z.object({
  emSala: z.number().nonnegative(),
  texto: z.string().max(200),
});

/**
 * Tudo o que é definição ou controle de automação: SÓ o mestre recebe (nunca o jogador, nem num
 * snapshot nem num evento). Não vai a um navegador de jogador por nenhum caminho.
 */
export const AutomacoesSchema = z.object({
  ciclos: z.array(CicloSchema).max(50).default([]),
  reacoes: z.array(ReacaoSchema).max(300).default([]),
  /** Por id de ciclo. Ciclo sem execução ainda não começou: o motor a cria no primeiro instante com a mesa rodando. */
  execucao: z.record(Id, ExecucaoDoCicloSchema).default({}),
  pendentes: z.array(PendenteSchema).max(200).default([]),
  /** O que o motor quis dizer ao mestre (encadeamento cortado, fases puladas). Só as últimas. */
  registro: z.array(ItemDoRegistroSchema).max(MAXIMO_DO_REGISTRO).default([]),
});
export type Automacoes = z.infer<typeof AutomacoesSchema>;

export const AUTOMACOES_VAZIAS: Automacoes = {
  ciclos: [],
  reacoes: [],
  execucao: {},
  pendentes: [],
  registro: [],
};

export function automacoesDe(estado: Pick<Estado, "automacoes">): Automacoes {
  return estado.automacoes ?? AUTOMACOES_VAZIAS;
}

// --- Efeitos temporários em tokens ----------------------------------------------------------

/**
 * Um efeito temporário sobre um token (regra 2): um MODIFICADOR com prazo, nunca o valor base. O valor
 * final é a base mais os efeitos ativos. Hoje só o limite de visão (`visaoMaxM`, vale o menor); o efeito
 * de luz mora no próprio objeto (`ObjetoDeLuz.modificadores`, com `raioX` e `raioSomaM`).
 *
 * O jogador recebe só o que mexe no que ele vê: `alvo` e `efeito`, com um id opaco e SEM `ateSala` nem
 * `origem` (o nome do ciclo ou da reação nunca sai da sala).
 */
export const EfeitoSchema = z.object({
  id: z.string().min(1).max(200),
  alvo: z.object({ tipo: z.literal("token"), id: Id }),
  efeito: z.object({ visaoMaxM: z.number().min(0.5).max(1000).optional() }),
  /** No tempo da sala; sem ele, vale até alguém tirar. Só mestre e sala. */
  ateSala: z.number().nonnegative().optional(),
  /** Quem criou (a reação ou o ciclo), só para o mestre. */
  origem: z.string().max(80).optional(),
});
export type Efeito = z.infer<typeof EfeitoSchema>;

export const MAXIMO_DE_EFEITOS = 200;

/** Os efeitos que valem no instante `salaMs` (os sem prazo valem sempre). */
export function efeitosAtivos(efeitos: readonly Efeito[], salaMs: number): Efeito[] {
  return efeitos.filter((e) => e.ateSala === undefined || e.ateSala > salaMs);
}

/**
 * O limite de visão que vale para o token: o MENOR `visaoMaxM` entre os efeitos dele; `null` sem limite.
 * O cliente chama sem `salaMs` (a sala já tira os vencidos e avisa); a sala chama com ele.
 */
export function limiteDeVisaoDoToken(
  efeitos: readonly Efeito[] | undefined,
  tokenId: string,
  salaMs?: number,
): number | null {
  let menor: number | null = null;
  for (const e of efeitos ?? []) {
    if (e.alvo.id !== tokenId || e.efeito.visaoMaxM === undefined) continue;
    if (salaMs !== undefined && e.ateSala !== undefined && e.ateSala <= salaMs) continue;
    menor = menor === null ? e.efeito.visaoMaxM : Math.min(menor, e.efeito.visaoMaxM);
  }
  return menor;
}

/** O alcance final: a base (`null` = sem limite) e o limite de uma automação (`null` = nenhum); vale o menor. */
export function limitarAlcance(base: number | null, limite: number | null): number | null {
  if (limite === null) return base;
  return base === null ? limite : Math.min(base, limite);
}

/**
 * Os efeitos como o JOGADOR os recebe: um por token que ELE CONTROLA (a visão dos outros não muda o que ele
 * enxerga), com o menor limite, id opaco e sem prazo nem origem. Sem `salaMs` conta todos: é a sala quem tira os
 * vencidos e avisa, e comparar o antes e o depois não pode depender do relógio.
 */
export function efeitosParaJogador(
  efeitos: readonly Efeito[] | undefined,
  tokensDele: readonly Pick<Token, "id">[],
  salaMs?: number,
): Efeito[] {
  const saida: Efeito[] = [];
  for (const t of tokensDele) {
    const limite = limiteDeVisaoDoToken(efeitos, t.id, salaMs);
    if (limite !== null) {
      saida.push({
        id: `visao:${t.id}`,
        alvo: { tipo: "token", id: t.id },
        efeito: { visaoMaxM: limite },
      });
    }
  }
  return saida;
}

// --- O tempo dos ciclos ----------------------------------------------------------------------

/**
 * O ciclo está rodando (não pausado)? Ciclo sem execução ainda não começou e conta como rodando: o motor
 * o inicia no primeiro instante com a mesa correndo (é o caso do ciclo que veio de um arquivo de campanha).
 */
export function cicloRodando(exec: ExecucaoDoCiclo | undefined): boolean {
  return exec === undefined || exec.pausadoEmTau === undefined;
}

/** O tempo do ciclo (τ, em ms) no instante `salaMs`. */
export function tauDoCiclo(exec: ExecucaoDoCiclo, salaMs: number): number {
  return exec.pausadoEmTau ?? Math.max(0, salaMs - exec.baseSala);
}

/**
 * A próxima fase depois de `disparadoAteTau`: o instante dela no tempo do ciclo (ms), a fase e o índice.
 * Contando os períodos que se repetem. Fase com o mesmo instante: a de menor índice primeiro.
 */
export function proximaFaseDoCiclo(
  ciclo: Pick<Ciclo, "periodoS" | "fases">,
  disparadoAteTau: number,
): { tauMs: number; fase: Fase; indice: number } | null {
  const periodo = ciclo.periodoS * 1000;
  let melhor: { tauMs: number; fase: Fase; indice: number } | null = null;
  for (const [indice, fase] of ciclo.fases.entries()) {
    const base = fase.emS * 1000;
    const k = disparadoAteTau < base ? 0 : Math.floor((disparadoAteTau - base) / periodo) + 1;
    const tauMs = base + k * periodo;
    if (melhor === null || tauMs < melhor.tauMs) melhor = { tauMs, fase, indice };
  }
  return melhor;
}

/**
 * Em quantos ms (do tempo da sala) acontece o próximo marco das automações: uma fase de ciclo que roda,
 * um evento pendente ou o fim de um efeito. `null` quando nada vai acontecer sozinho. Mesa pausada: nada
 * (o chamador já não agenda). O que já venceu conta como 0.
 */
export function proximoMarcoDasAutomacoes(
  estado: Pick<Estado, "automacoes" | "efeitos">,
  salaMs: number,
): number | null {
  const a = automacoesDe(estado);
  const candidatos: number[] = [];
  for (const c of a.ciclos) {
    const exec = a.execucao[c.id];
    if (!cicloRodando(exec)) continue;
    if (exec === undefined) {
      candidatos.push(0);
      continue;
    }
    const proxima = proximaFaseDoCiclo(c, exec.disparadoAteTau);
    if (proxima) candidatos.push(proxima.tauMs - tauDoCiclo(exec, salaMs));
  }
  for (const p of a.pendentes) candidatos.push(p.ateSala - salaMs);
  for (const e of estado.efeitos ?? []) {
    if (e.ateSala !== undefined) candidatos.push(e.ateSala - salaMs);
  }
  if (candidatos.length === 0) return null;
  return Math.max(0, Math.min(...candidatos));
}

// ---------------------------------------------------------------------------------------------
// O arquivo de campanha
// ---------------------------------------------------------------------------------------------

type Solto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Solto =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Lê a forma enxuta do arquivo de campanha (a do exemplo da 4.11) e a converte na fatia `automacoes`:
 * `dados.ciclos` no topo e `reacoes` dentro de cada modelo (a reação do modelo ganha `id` e
 * `fica: { tipo: "modelo", id }`). Reações de topo (`dados.reacoes`) valem como estão e podem
 * ter `fica` de cena ou da mesa. Se `dados.automacoes` já existe (a exportação da mesa), ele vence.
 * Devolve uma cópia do objeto sem `ciclos` no topo nem `reacoes` nos modelos; o que não for objeto passa
 * intacto (o schema reclama depois).
 */
export function converterAutomacoesDoArquivo(bruto: unknown): unknown {
  if (!ehObjeto(bruto) || !ehObjeto(bruto.dados)) return bruto;
  const dados = bruto.dados;
  const { ciclos, reacoes: reacoesDeTopo, modelos, ...resto } = dados;
  const modelosLimpos = Array.isArray(modelos)
    ? modelos.map((m) => {
        if (!ehObjeto(m)) return m;
        const { reacoes: _reacoes, ...semReacoes } = m;
        return semReacoes;
      })
    : modelos;
  const base: Solto = { ...resto, ...(modelos === undefined ? {} : { modelos: modelosLimpos }) };
  if (ehObjeto(dados.automacoes)) return { ...bruto, dados: base };
  const doModelo: unknown[] = [];
  if (Array.isArray(modelos)) {
    for (const m of modelos) {
      if (!ehObjeto(m) || !Array.isArray(m.reacoes)) continue;
      for (const [i, r] of m.reacoes.entries()) {
        if (!ehObjeto(r)) continue;
        doModelo.push({
          id: `reacao-${String(m.id)}-${i + 1}`,
          ...r,
          fica: { tipo: "modelo", id: m.id },
        });
      }
    }
  }
  const temCiclos = Array.isArray(ciclos) && ciclos.length > 0;
  const temReacoes =
    doModelo.length > 0 || (Array.isArray(reacoesDeTopo) && reacoesDeTopo.length > 0);
  if (!temCiclos && !temReacoes) return { ...bruto, dados: base };
  return {
    ...bruto,
    dados: {
      ...base,
      automacoes: {
        ciclos: Array.isArray(ciclos) ? ciclos : [],
        reacoes: [...(Array.isArray(reacoesDeTopo) ? reacoesDeTopo : []), ...doModelo],
      },
    },
  };
}
