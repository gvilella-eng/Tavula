import { z } from "zod";
import { HashSchema } from "./assets.ts";
import { NomeDeEventoSchema } from "./automacoesLegado.ts";
import { CorDoSomSchema, IconeDoSomSchema } from "./mesadesom.ts";
import { ParaQuemOSomSchema, VolumeSchema } from "./som.ts";

// ---------------------------------------------------------------------------------------------
// AU1: as automações por blocos (seção 4.11). AU2: o fluxo é um GRAFO (nós com posição na grade e fios entre as portas). Os
// blocos do AU1 (a árvore: um gatilho e trilhas de blocos) continuam aqui como a FORMA ANTIGA: o que ainda chega nela (mesa
// salva, arquivo, intenção) é convertido em grafo por `arvoreParaGrafo` (fluxosGrafo.ts).
//
// Sigilo (regra 7): os fluxos moram em `Estado.automacoes`, que SÓ o mestre recebe.
// ---------------------------------------------------------------------------------------------

const Id = z.string().min(1).max(64);

/** Limites (assumido). O corte vai ao registro do motor. */
export const MAXIMO_DE_FLUXOS = 60;
export const MAXIMO_DE_TRILHAS = 8;
export const MAXIMO_DE_BLOCOS_POR_FLUXO = 80;
export const PROFUNDIDADE_DA_ARVORE = 6;
export const MAXIMO_DE_EXECUCOES_ESPERANDO = 200;
export const MAXIMO_DE_PRAZO_S = 7 * 86400;
/** Prazo de um efeito temporário quando a ação não diz quanto. */
export const PRAZO_PADRAO_S = 30;

const Segundos = z.number().positive().max(MAXIMO_DE_PRAZO_S);
const Etiqueta = z.string().trim().min(1).max(32);

// --- O gatilho: "Quando" ---------------------------------------------------------------------

export const GatilhoSchema = z.discriminatedUnion("tipo", [
  /** A cada `cadaS` segundos (tempo da sala). Dispara ao começar, ou depois de `primeiroS` (assumido: já). */
  z.object({
    tipo: z.literal("relogio"),
    cadaS: Segundos,
    primeiroS: z.number().min(0).max(MAXIMO_DE_PRAZO_S).optional(),
  }),
  /** Um botão do mestre (o `nome` é o rótulo), em todas as cenas ou só em `cena`. */
  z.object({
    tipo: z.literal("botao"),
    nome: z.string().trim().min(1).max(40),
    cena: Id.optional(),
    /** AU2: como o botão aparece na mesa de eventos (cor e ícone da mesa de som; assumido: âmbar e chama). */
    cor: CorDoSomSchema.optional(),
    icone: IconeDoSomSchema.optional(),
  }),
  /** Ao receber um sinal mandado por outro fluxo. */
  z.object({ tipo: z.literal("sinal"), nome: NomeDeEventoSchema }),
  /** Uma tocha (objeto de luz) acendeu ou apagou; `modelo` e `etiqueta` filtram. */
  z.object({
    tipo: z.literal("tocha"),
    muda: z.enum(["acende", "apaga"]),
    modelo: Id.optional(),
    etiqueta: Etiqueta.optional(),
  }),
  /** Um token entrou numa zona ou saiu dela. */
  z.object({ tipo: z.literal("zona"), quando: z.enum(["entra", "sai"]), zona: Id.optional() }),
  /** Começou o turno de alguém no combate. */
  z.object({ tipo: z.literal("turno") }),
  /** O grupo foi para outra cena (qualquer uma, ou só `cena`). */
  z.object({ tipo: z.literal("cena"), cena: Id.optional() }),
]);
export type Gatilho = z.infer<typeof GatilhoSchema>;
export type TipoDeGatilho = Gatilho["tipo"];

// --- As condições do "se" --------------------------------------------------------------------

export const CondicaoDoSeSchema = z.discriminatedUnion("condicao", [
  /** O objeto da vez tem esta etiqueta (a do modelo dele). */
  z.object({ condicao: z.literal("etiqueta"), etiqueta: Etiqueta }),
  /** O objeto ou token da vez está dentro da zona. */
  z.object({ condicao: z.literal("dentroDaZona"), zona: Id }),
  /** O objeto da vez (ou a cena do fluxo) está numa destas cenas. Dentro do "sim", só elas valem. */
  z.object({ condicao: z.literal("cena"), cenas: z.array(Id).min(1).max(100) }),
  /** A zona está ligada. */
  z.object({ condicao: z.literal("zonaLigada"), zona: Id }),
  /** AU2: acontece com esta chance, sorteada a cada vez que a condição é conferida (no RNG da sala). */
  z.object({ condicao: z.literal("chance"), chance: z.number().min(0).max(1) }),
  /** AU2: o token da vez é de um jogador (tem alguém controlando); sem isso, é do mestre (um NPC, um monstro). */
  z.object({ condicao: z.literal("tokenDeJogador") }),
]);
export type CondicaoDoSe = z.infer<typeof CondicaoDoSeSchema>;

// --- O "Faça": as ações ----------------------------------------------------------------------

const Prazo = Segundos.optional();

/** A lista FECHADA de ações (regra 1). O alvo vem do contexto: o objeto ou token da vez ("para cada", ou o do gatilho). */
export const AcaoDeFluxoSchema = z.discriminatedUnion("acao", [
  /** Multiplica (`raioX`) e/ou soma (`raioSomaM`) o raio da luz por um prazo: um modificador, nunca o valor base. */
  z
    .object({
      acao: z.literal("luz.modificar"),
      raioX: z.number().min(0.1).max(5).optional(),
      raioSomaM: z.number().min(-100).max(100).optional(),
      porS: Prazo,
    })
    .refine((a) => a.raioX !== undefined || a.raioSomaM !== undefined, {
      message: "Diga quanto a luz muda (multiplicar ou somar).",
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
  }),
  /** Soma ou tira tempo do que sobra do objeto. */
  z.object({
    acao: z.literal("objeto.ajustarTempo"),
    deltaS: z
      .number()
      .min(-100 * 3600)
      .max(100 * 3600)
      .refine((n) => n !== 0, "O ajuste não pode ser zero."),
  }),
  /** Limita o alcance de visão do token por um prazo (um efeito, nunca o valor base). */
  z.object({
    acao: z.literal("visao.limitar"),
    alcanceM: z.number().min(0.5).max(1000),
    porS: Prazo,
  }),
  /** Uma linha no chat da mesa, para todos ou só para o mestre. */
  z.object({
    acao: z.literal("chat.anunciar"),
    texto: z.string().trim().min(1).max(300),
    para: z.enum(["todos", "mestre"]).default("todos"),
  }),
  /** Toca um som uma vez (o asset `som` já registrado). O mestre ouve sempre. */
  z.object({
    acao: z.literal("som.tocar"),
    hash: HashSchema,
    nome: z.string().trim().min(1).max(200),
    volume: VolumeSchema.default(0.8),
    para: ParaQuemOSomSchema.default("todos"),
  }),
  z.object({ acao: z.literal("token.mostrar") }),
  z.object({ acao: z.literal("token.ocultar") }),
  /** Liga ou desliga uma zona. Desligada, nada fica preso nela. */
  z.object({ acao: z.literal("zona.ativar"), zona: Id, ativa: z.boolean() }),
]);
export type AcaoDeFluxo = z.infer<typeof AcaoDeFluxoSchema>;
export type TipoDeAcaoDeFluxo = AcaoDeFluxo["acao"];

/** As ações que mexem num objeto de luz e as que mexem num token (o resto não precisa de alvo). */
export const ACOES_DE_OBJETO: readonly TipoDeAcaoDeFluxo[] = [
  "luz.modificar",
  "objeto.apagar",
  "objeto.ajustarTempo",
];
export const ACOES_DE_TOKEN: readonly TipoDeAcaoDeFluxo[] = [
  "visao.limitar",
  "token.mostrar",
  "token.ocultar",
];

// --- O "para cada" ---------------------------------------------------------------------------

export const AlvoDoParaCadaSchema = z.discriminatedUnion("tipo", [
  /** Cada objeto de luz (nas cenas do fluxo) que passe nos filtros. */
  z.object({
    tipo: z.literal("objetos"),
    modelo: Id.optional(),
    etiqueta: Etiqueta.optional(),
    /** Só os acesos. */
    acesos: z.boolean().optional(),
    naZona: Id.optional(),
  }),
  /** Cada token (nas cenas do fluxo) que passe nos filtros. */
  z.object({
    tipo: z.literal("tokens"),
    naZona: Id.optional(),
    naCena: Id.optional(),
    ids: z.array(Id).min(1).max(50).optional(),
  }),
]);
export type AlvoDoParaCada = z.infer<typeof AlvoDoParaCadaSchema>;

// --- Os blocos -------------------------------------------------------------------------------

export type Bloco =
  | { bloco: "esperar"; s: number }
  | { bloco: "se"; condicao: CondicaoDoSe; sim: Bloco[]; nao: Bloco[] }
  | { bloco: "sortear"; chance: number; sim: Bloco[]; nao: Bloco[] }
  | { bloco: "paraCada"; alvo: AlvoDoParaCada; corpo: Bloco[] }
  | { bloco: "acao"; acao: AcaoDeFluxo }
  | { bloco: "sinal"; nome: string; atrasoS?: number | undefined };

export const TIPOS_DE_BLOCO = ["esperar", "se", "sortear", "paraCada", "acao", "sinal"] as const;
export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

/**
 * O esquema dos blocos, com o esquema da ação como parâmetro (o MCP troca o hash do som pelo nome do arquivo). Recursivo:
 * "se" e "sortear" têm as saídas `sim` e `nao`, "para cada" tem um `corpo`.
 */
export function criarBlocoSchema(acao: z.ZodType): z.ZodType<Bloco, unknown> {
  const bloco: z.ZodType<Bloco, unknown> = z.lazy(() =>
    z.discriminatedUnion("bloco", [
      z.object({ bloco: z.literal("esperar"), s: Segundos }),
      z.object({
        bloco: z.literal("se"),
        condicao: CondicaoDoSeSchema,
        sim: z.array(bloco).max(MAXIMO_DE_BLOCOS_POR_FLUXO),
        nao: z.array(bloco).max(MAXIMO_DE_BLOCOS_POR_FLUXO).default([]),
      }),
      z.object({
        bloco: z.literal("sortear"),
        chance: z.number().min(0).max(1),
        sim: z.array(bloco).max(MAXIMO_DE_BLOCOS_POR_FLUXO),
        nao: z.array(bloco).max(MAXIMO_DE_BLOCOS_POR_FLUXO).default([]),
      }),
      z.object({
        bloco: z.literal("paraCada"),
        alvo: AlvoDoParaCadaSchema,
        corpo: z.array(bloco).max(MAXIMO_DE_BLOCOS_POR_FLUXO),
      }),
      z.object({ bloco: z.literal("acao"), acao }),
      z.object({
        bloco: z.literal("sinal"),
        nome: NomeDeEventoSchema,
        atrasoS: z.number().min(0).max(MAXIMO_DE_PRAZO_S).optional(),
      }),
    ]),
  ) as z.ZodType<Bloco, unknown>;
  return bloco;
}

export const BlocoSchema: z.ZodType<Bloco, unknown> = criarBlocoSchema(AcaoDeFluxoSchema);

// --- A forma antiga (AU1): a árvore ----------------------------------------------------------

/** Uma automação do AU1: um gatilho e trilhas de blocos. Só existe para ler o que veio nessa forma. */
export const FluxoArvoreSchema = z.object({
  id: Id,
  nome: z.string().trim().min(1, "Dê um nome à automação.").max(64),
  ligado: z.boolean().default(true),
  cenas: z.array(Id).max(100).nullable().default(null),
  fixado: z.boolean().optional(),
  liberadoParaJogadores: z.boolean().optional(),
  rascunho: z.boolean().optional(),
  gatilho: GatilhoSchema,
  trilhas: z.array(z.array(BlocoSchema)).min(1).max(MAXIMO_DE_TRILHAS),
});
export type FluxoArvore = z.infer<typeof FluxoArvoreSchema>;

// --- O grafo (AU2) ---------------------------------------------------------------------------

/** Limites do grafo (assumido). */
export const MAXIMO_DE_NOS = 120;
export const MAXIMO_DE_FIOS = 300;
/** Um ciclo só é permitido passando por um "esperar" de pelo menos tanto. */
export const ESPERA_MINIMA_DO_CICLO_S = 1;

const Coordenada = z.number().min(-50000).max(50000);
const NomeDoNo = z.string().trim().min(1).max(40);
const NomeDaPorta = z.string().min(1).max(16);

export const PORTAS_LOGICAS = ["e", "ou", "nao"] as const;
export type PortaLogica = (typeof PORTAS_LOGICAS)[number];

export const TIPOS_DE_NO = [
  "gatilho",
  "esperar",
  "sortear",
  "paraCada",
  "se",
  "acao",
  "sinal",
  "condicao",
  "porta",
] as const;
export type TipoDeNo = (typeof TIPOS_DE_NO)[number];

/**
 * O esquema dos nós, com o esquema da ação como parâmetro (o MCP troca o hash do som pelo nome do arquivo). Cada nó tem `id`,
 * a posição na grade (`x`, `y`), um `nome` opcional (o MCP e a mensagem de erro o usam) e a `config` do tipo.
 */
export function criarNoSchema(acao: z.ZodType, paraMcp = false): z.ZodType<No, unknown> {
  // O MCP fala em NOMES: o nó tem `nome` (obrigatório) e a posição é opcional (a sala arruma na grade).
  const base = paraMcp
    ? { id: Id.optional(), x: Coordenada.optional(), y: Coordenada.optional(), nome: NomeDoNo }
    : { id: Id, x: Coordenada, y: Coordenada, nome: NomeDoNo.optional() };
  return z.discriminatedUnion("tipo", [
    z.object({ ...base, tipo: z.literal("gatilho"), config: GatilhoSchema }),
    z.object({ ...base, tipo: z.literal("esperar"), config: z.object({ s: Segundos }) }),
    z.object({
      ...base,
      tipo: z.literal("sortear"),
      config: z.object({ chance: z.number().min(0).max(1) }),
    }),
    z.object({
      ...base,
      tipo: z.literal("paraCada"),
      config: z.object({ alvo: AlvoDoParaCadaSchema }),
    }),
    z.object({ ...base, tipo: z.literal("se"), config: z.object({}).default({}) }),
    z.object({ ...base, tipo: z.literal("acao"), config: z.object({ acao }) }),
    z.object({
      ...base,
      tipo: z.literal("sinal"),
      config: z.object({
        nome: NomeDeEventoSchema,
        atrasoS: z.number().min(0).max(MAXIMO_DE_PRAZO_S).optional(),
      }),
    }),
    z.object({ ...base, tipo: z.literal("condicao"), config: CondicaoDoSeSchema }),
    z.object({
      ...base,
      tipo: z.literal("porta"),
      config: z.object({ porta: z.enum(PORTAS_LOGICAS) }),
    }),
  ]) as unknown as z.ZodType<No, unknown>;
}

type Base = { id: string; x: number; y: number; nome?: string | undefined };
export type No =
  | (Base & { tipo: "gatilho"; config: Gatilho })
  | (Base & { tipo: "esperar"; config: { s: number } })
  | (Base & { tipo: "sortear"; config: { chance: number } })
  | (Base & { tipo: "paraCada"; config: { alvo: AlvoDoParaCada } })
  | (Base & { tipo: "se"; config: Record<string, never> })
  | (Base & { tipo: "acao"; config: { acao: AcaoDeFluxo } })
  | (Base & { tipo: "sinal"; config: { nome: string; atrasoS?: number | undefined } })
  | (Base & { tipo: "condicao"; config: CondicaoDoSe })
  | (Base & { tipo: "porta"; config: { porta: PortaLogica } });
export type NoDe<T extends TipoDeNo> = Extract<No, { tipo: T }>;

export const NoSchema: z.ZodType<No, unknown> = criarNoSchema(AcaoDeFluxoSchema);

export const FioSchema = z.object({
  de: z.object({ no: Id, saida: NomeDaPorta }),
  para: z.object({ no: Id, entrada: NomeDaPorta }),
});
export type Fio = z.infer<typeof FioSchema>;

// --- As portas dos nós ---

/** `exec` é o fio da ordem (o que roda depois do quê); `valor` é o fio de condição (verdadeiro ou falso). */
export type TipoDeFio = "exec" | "valor";
export type PortaDeEntrada = {
  id: string;
  tipo: TipoDeFio;
  rotulo: string;
  /** Aceita vários fios (as portas E e OU). */
  varias: boolean;
};
export type PortaDeSaida = { id: string; tipo: TipoDeFio; rotulo: string };

const ENTRADA_EXEC: PortaDeEntrada = { id: "entrada", tipo: "exec", rotulo: "Entra", varias: true };
const saidaExec = (id: string, rotulo: string): PortaDeSaida => ({ id, tipo: "exec", rotulo });

/** As portas de um nó: o que encaixa onde. */
export function portasDoNo(no: Pick<No, "tipo"> & { config?: unknown }): {
  entradas: PortaDeEntrada[];
  saidas: PortaDeSaida[];
} {
  switch (no.tipo) {
    case "gatilho":
      return { entradas: [], saidas: [saidaExec("saida", "Dispara")] };
    case "esperar":
    case "acao":
    case "sinal":
      return { entradas: [ENTRADA_EXEC], saidas: [saidaExec("saida", "Depois")] };
    case "sortear":
      return {
        entradas: [ENTRADA_EXEC],
        saidas: [saidaExec("sim", "Sim"), saidaExec("nao", "Não")],
      };
    case "se":
      return {
        entradas: [
          ENTRADA_EXEC,
          { id: "condicao", tipo: "valor", rotulo: "Condição", varias: false },
        ],
        saidas: [saidaExec("sim", "Sim"), saidaExec("nao", "Não")],
      };
    case "paraCada":
      return {
        entradas: [ENTRADA_EXEC],
        saidas: [saidaExec("corpo", "Cada um"), saidaExec("depois", "Depois")],
      };
    case "condicao":
      return { entradas: [], saidas: [{ id: "valor", tipo: "valor", rotulo: "Vale" }] };
    case "porta": {
      const nao = (no.config as { porta?: string } | undefined)?.porta === "nao";
      return {
        entradas: [
          nao
            ? { id: "entrada", tipo: "valor", rotulo: "Entra", varias: false }
            : { id: "entradas", tipo: "valor", rotulo: "Entradas", varias: true },
        ],
        saidas: [{ id: "valor", tipo: "valor", rotulo: "Vale" }],
      };
    }
  }
}

/** Os nós que só dão um valor (condições e portas lógicas): não entram na ordem de execução. */
export const ehNoDeValor = (no: Pick<No, "tipo">): boolean =>
  no.tipo === "condicao" || no.tipo === "porta";

export const chaveDoFio = (f: Fio): string =>
  `${f.de.no}.${f.de.saida}>${f.para.no}.${f.para.entrada}`;

// --- O fluxo ---

/**
 * Uma automação (AU2): um grafo. Tem de ter pelo menos um nó de gatilho ("Quando"); a conferência em português (o que falta,
 * o fio solto, o ciclo sem espera) é de `problemasDoFluxo`. Aqui só se garante a forma: ids de nó únicos, fios entre nós que
 * existem, portas que existem e fio de ordem só com fio de ordem.
 */
export const FluxoSchema = z
  .object({
    id: Id,
    nome: z.string().trim().min(1, "Dê um nome à automação.").max(64),
    /** Desligado, não roda (nem o relógio anda). */
    ligado: z.boolean().default(true),
    /** As cenas onde o fluxo vale. `null` (ou vazio) = todas. */
    cenas: z.array(Id).max(100).nullable().default(null),
    /** O chip do fluxo fica na barra de cima do mestre (preferência dele; só relógio e botão). */
    fixado: z.boolean().optional(),
    /** O mestre libera o botão (gatilho "botão") ou os controles (gatilho "relógio") a todos os jogadores. */
    liberadoParaJogadores: z.boolean().optional(),
    /** 12-1: rascunho do Claude do mestre: não roda e o jogador não o recebe. */
    rascunho: z.boolean().optional(),
    nos: z.array(NoSchema).max(MAXIMO_DE_NOS),
    fios: z.array(FioSchema).max(MAXIMO_DE_FIOS).default([]),
  })
  .superRefine((f, ctx) => {
    const porId = new Map<string, No>();
    for (const n of f.nos) {
      if (porId.has(n.id)) {
        ctx.addIssue({ code: "custom", message: `Dois blocos com o mesmo id (${n.id}).` });
        return;
      }
      porId.set(n.id, n);
    }
    const vistos = new Set<string>();
    for (const fio of f.fios) {
      const de = porId.get(fio.de.no);
      const para = porId.get(fio.para.no);
      if (de === undefined || para === undefined) {
        ctx.addIssue({ code: "custom", message: "Há um fio ligado a um bloco que não existe." });
        return;
      }
      const saida = portasDoNo(de).saidas.find((p) => p.id === fio.de.saida);
      const entrada = portasDoNo(para).entradas.find((p) => p.id === fio.para.entrada);
      if (saida === undefined || entrada === undefined) {
        ctx.addIssue({ code: "custom", message: "Há um fio ligado a uma porta que não existe." });
        return;
      }
      if (saida.tipo !== entrada.tipo) {
        ctx.addIssue({
          code: "custom",
          message: "Um fio de ordem só liga com fio de ordem, e um de condição com um de condição.",
        });
        return;
      }
      const chave = chaveDoFio(fio);
      if (vistos.has(chave)) {
        ctx.addIssue({ code: "custom", message: "Há dois fios iguais entre as mesmas portas." });
        return;
      }
      vistos.add(chave);
    }
    for (const n of f.nos) {
      for (const p of portasDoNo(n).entradas) {
        if (p.varias) continue;
        if (f.fios.filter((x) => x.para.no === n.id && x.para.entrada === p.id).length > 1) {
          ctx.addIssue({
            code: "custom",
            message: `A porta "${p.rotulo}" de um bloco aceita só um fio.`,
          });
          return;
        }
      }
    }
  });
export type Fluxo = z.infer<typeof FluxoSchema>;

/** Os campos que se mudam num `fluxo.editar` (todos opcionais; a sala junta e confere o fluxo inteiro de novo). */
export const MudancasDoFluxoSchema = z
  .object({
    nome: z.string().trim().min(1, "Dê um nome à automação.").max(64),
    ligado: z.boolean(),
    cenas: z.array(Id).max(100).nullable(),
    fixado: z.boolean(),
    liberadoParaJogadores: z.boolean(),
    nos: z.array(NoSchema).max(MAXIMO_DE_NOS),
    fios: z.array(FioSchema).max(MAXIMO_DE_FIOS),
  })
  .partial();
export type MudancasDoFluxo = z.infer<typeof MudancasDoFluxoSchema>;

// --- A execução ------------------------------------------------------------------------------

/**
 * O relógio de um fluxo de relógio, no TEMPO DA SALA (pausar a mesa o congela). O tempo do fluxo, τ, é `salaMs − baseSala`
 * (ou `pausadoEmTau`, se está desligado). `proximoTau`: quando dispara de novo.
 */
export const ExecucaoDoFluxoSchema = z.object({
  baseSala: z.number(),
  pausadoEmTau: z.number().nonnegative().optional(),
  proximoTau: z.number().nonnegative(),
});
export type ExecucaoDoFluxo = z.infer<typeof ExecucaoDoFluxoSchema>;

/**
 * O contexto de uma execução: o escopo de cenas e de quem o fluxo trata (o objeto, o token e a zona do evento, ou o alvo
 * do "para cada" atual).
 */
export const ContextoDoFluxoSchema = z.object({
  cenas: z.array(Id).max(100).nullable(),
  objetoId: Id.optional(),
  tokenId: Id.optional(),
  zonaId: Id.optional(),
  /** Quanto o gatilho disparou do que se espera: só serve para o registro. */
  duracaoS: Segundos.optional(),
});
export type ContextoDoFluxo = z.infer<typeof ContextoDoFluxoSchema>;

const CaminhoSchema = z.array(z.union([z.number().int().min(0), z.string().max(8)])).max(40);

/**
 * Uma execução esperando (um "esperar", ou um sinal com atraso), guardada no estado para sobreviver à hibernação. `caminho`:
 * onde continuar na árvore: `[trilha, i, "sim", j, ..., k]`, em que `k` é o índice do próximo bloco da lista mais funda.
 */
export const EsperandoSchema = z.object({
  id: Id,
  ateSala: z.number().nonnegative(),
  /** Quantos sinais encadeados já vieram antes (o atraso não zera a conta). */
  profundidade: z.number().int().min(0).max(10),
  fluxoId: Id.optional(),
  caminho: CaminhoSchema.optional(),
  /** AU2: o nó "esperar" que segurou a execução; ao acabar a espera, segue pelos fios dele. */
  no: Id.optional(),
  /** Um sinal com atraso: o nome dele (o `fluxoId` é o de quem mandou). */
  sinal: NomeDeEventoSchema.optional(),
  contexto: ContextoDoFluxoSchema,
});
export type Esperando = z.infer<typeof EsperandoSchema>;
