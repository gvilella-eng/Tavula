// AU1: o formato ANTIGO das automações (ciclos, reações e botões de evento). Não roda mais: na carga e na importação
// vira fluxo (`converterParaFluxos`) e o original fica em `Automacoes.legado`, só para leitura.
import { z } from "zod";
import { HashSchema } from "./assets.ts";
import { ParaQuemOSomSchema, VolumeSchema } from "./som.ts";

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

/** Os eventos que a própria sala produz (4.11). Os da zona (7b-2) levam a zona e o token. */
export const EVENTOS_DO_SISTEMA = [
  "objeto.acendeu",
  "objeto.apagou",
  "turno.inicio",
  "cena.ativada",
  "token.entrouNaZona",
  "token.saiuDaZona",
] as const;

export function ehEventoDoSistemaLegado(nome: string): boolean {
  return (EVENTOS_DO_SISTEMA as readonly string[]).includes(nome);
}

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
  /** 7b-3: o mestre pode liberar os botões do ciclo (disparar, pausar, retomar) a todos os jogadores. */
  liberadoParaJogadores: z.boolean().optional(),
  /** 7b-3: o chip do ciclo fica na barra de cima do mestre (preferência dele, guardada com a campanha; assumido). */
  fixado: z.boolean().optional(),
  /** 12-1: rascunho do Claude do mestre: não roda e o jogador não o recebe. */
  rascunho: z.boolean().optional(),
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
  /** 7b-2: a zona de que o evento trata (`token.entrouNaZona` e `token.saiuDaZona`). */
  zonaId: Id.optional(),
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
  /**
   * 7b-2: o alvo (o objeto, ou o token do evento) está dentro da zona. Sem `zona` vale a zona da própria
   * reação (assumido). Zona desligada ou inexistente: não passa.
   */
  z.object({ condicao: z.literal("dentroDaZona"), zona: Id.optional() }),
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

/** A lista FECHADA de ações (regra 1). `som.tocar` entrou no N5 (efeito de som, uma vez). */
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
  /**
   * N5: toca um som uma vez (o asset `som` já registrado), para todos, para quem vê a cena do evento ou para quem
   * controla o token do evento. O mestre ouve sempre.
   */
  z.object({
    acao: z.literal("som.tocar"),
    hash: HashSchema,
    nome: z.string().trim().min(1).max(200),
    volume: VolumeSchema.default(0.8),
    para: ParaQuemOSomSchema.default("todos"),
  }),
  z.object({ acao: z.literal("token.mostrar"), alvo: AlvoDeTokenSchema.optional() }),
  z.object({ acao: z.literal("token.ocultar"), alvo: AlvoDeTokenSchema.optional() }),
  /** 7b-2: liga ou desliga uma zona (sem `zona`, a da própria reação). Desligada, nada fica preso nela. */
  z.object({ acao: z.literal("zona.ativar"), zona: Id.optional(), ativa: z.boolean() }),
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
 * A quem a reação está presa: a um modelo de objeto (toda instância herda), a uma cena, a uma zona (7b-2) ou
 * à mesa toda.
 */
export const FicaSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("modelo"), id: Id }),
  z.object({ tipo: z.literal("cena"), id: Id }),
  z.object({ tipo: z.literal("zona"), id: Id }),
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
  /** 12-1: rascunho do Claude do mestre: não roda e o jogador não o recebe. */
  rascunho: z.boolean().optional(),
});
export type Reacao = z.infer<typeof ReacaoSchema>;

// --- A fatia do estado -----------------------------------------------------------------------

// --- Botões de evento (7b-3) -----------------------------------------------------------------

/**
 * Um botão do mestre que dispara um evento ("Soprar o vento"): o nome é o rótulo do botão, `evento` o que ele dispara
 * (em todas as cenas ou só em `cenaId`). `fixado`: o chip fica na barra de cima do mestre; `liberadoParaJogadores`: os
 * jogadores veem o chip (só o rótulo) e podem dispará-lo.
 */
export const BotaoDeEventoSchema = z.object({
  id: Id,
  nome: z.string().trim().min(1).max(40),
  evento: NomeDeEventoSchema,
  cenaId: Id.optional(),
  fixado: z.boolean().optional(),
  liberadoParaJogadores: z.boolean().optional(),
  /** 12-1: rascunho do Claude do mestre: não roda e o jogador não o recebe. */
  rascunho: z.boolean().optional(),
});
export type BotaoDeEvento = z.infer<typeof BotaoDeEventoSchema>;
export const MAXIMO_DE_BOTOES = 30;
