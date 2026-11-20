import { z } from "zod";
import { HashSchema } from "./assets.ts";
import { NomeDeEventoSchema } from "./automacoesLegado.ts";
import { portasParaCaixas } from "./fluxosCaixas.ts";
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

/** AU3: as três caixas lógicas. `ou` = QUALQUER UM, `e` = TODAS, `nao` = NÃO. */
export const PORTAS_LOGICAS = ["e", "ou", "nao"] as const;
export type PortaLogica = (typeof PORTAS_LOGICAS)[number];
/** AU3: até quantos níveis de caixa dentro de caixa (assumido). */
export const NIVEIS_DE_CAIXA = 4;
/** AU3: quantos espaços uma caixa E ou OU pode ter (assumido). Ela nasce com 2. */
export const MAXIMO_DE_ESPACOS = 12;
export const MINIMO_DE_ESPACOS = 2;

export const TIPOS_DE_NO = [
  "gatilho",
  "esperar",
  "sortear",
  "paraCada",
  "se",
  "acao",
  "sinal",
  "condicao",
  "caixa",
] as const;
export type TipoDeNo = (typeof TIPOS_DE_NO)[number];

/**
 * O esquema dos nós, com o esquema da ação como parâmetro (o MCP troca o hash do som pelo nome do arquivo). Cada nó tem `id`,
 * a posição na grade (`x`, `y`), um `nome` opcional (o MCP e a mensagem de erro o usam) e a `config` do tipo.
 */
export function criarNoSchema(acao: z.ZodType, paraMcp = false): z.ZodType<No, unknown> {
  // O MCP fala em NOMES: o nó tem `nome` (obrigatório) e a posição é opcional (a sala arruma na grade).
  // AU3: `em` é a caixa onde a peça está (a ordem das peças dentro da caixa é a ordem dos nós na lista).
  const base = paraMcp
    ? {
        id: Id.optional(),
        x: Coordenada.optional(),
        y: Coordenada.optional(),
        nome: NomeDoNo,
        em: z.string().min(1).max(40).optional(),
        espaco: z
          .number()
          .int()
          .min(0)
          .max(MAXIMO_DE_ESPACOS - 1)
          .optional(),
      }
    : {
        id: Id,
        x: Coordenada,
        y: Coordenada,
        nome: NomeDoNo.optional(),
        em: Id.optional(),
        espaco: z
          .number()
          .int()
          .min(0)
          .max(MAXIMO_DE_ESPACOS - 1)
          .optional(),
      };
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
      tipo: z.literal("caixa"),
      config: z.object({
        porta: z.enum(PORTAS_LOGICAS),
        /** AU3: quantos espaços a caixa E ou OU tem (padrão e mínimo 2; o NÃO tem um). */
        espacos: z.number().int().min(1).max(MAXIMO_DE_ESPACOS).optional(),
      }),
    }),
  ]) as unknown as z.ZodType<No, unknown>;
}

type Base = {
  id: string;
  x: number;
  y: number;
  nome?: string | undefined;
  /** AU3: a caixa onde a peça está. */
  em?: string | undefined;
  /** AU3: o espaço da caixa onde a peça está (cada espaço guarda uma peça só). */
  espaco?: number | undefined;
};
export type No =
  | (Base & { tipo: "gatilho"; config: Gatilho })
  | (Base & { tipo: "esperar"; config: { s: number } })
  | (Base & { tipo: "sortear"; config: { chance: number } })
  | (Base & { tipo: "paraCada"; config: { alvo: AlvoDoParaCada } })
  | (Base & { tipo: "se"; config: Record<string, never> })
  | (Base & { tipo: "acao"; config: { acao: AcaoDeFluxo } })
  | (Base & { tipo: "sinal"; config: { nome: string; atrasoS?: number | undefined } })
  | (Base & { tipo: "condicao"; config: CondicaoDoSe })
  | (Base & { tipo: "caixa"; config: { porta: PortaLogica; espacos?: number | undefined } });
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

/**
 * O que a caixa produz (AU3): `gatilho` (um "quando", com ou sem condição junto; a saída é de ordem), `valor`
 * (uma condição; a saída é de valor), `acao` (um bloco de ação com entrada e saída de ordem) ou `vazia` (nada ainda).
 */
export type ConteudoDaCaixa = "gatilho" | "valor" | "acao" | "vazia";

/** Quantos espaços a caixa tem: o NÃO tem um; a E e a OU, no mínimo dois (e os que as peças de dentro já ocupam). */
export function numeroDeEspacos(nos: readonly No[], caixa: string): number {
  const c = nos.find((n) => n.id === caixa);
  if (c?.tipo !== "caixa") return 0;
  if (c.config.porta === "nao") return 1;
  const ocupado = Math.max(-1, ...nos.filter((n) => n.em === caixa).map((n) => n.espaco ?? 0)) + 1;
  return Math.min(
    MAXIMO_DE_ESPACOS,
    Math.max(MINIMO_DE_ESPACOS, c.config.espacos ?? MINIMO_DE_ESPACOS, ocupado),
  );
}

/** A peça que está neste espaço da caixa (cada espaço guarda uma só). */
export const pecaDoEspaco = (nos: readonly No[], caixa: string, espaco: number): No | undefined =>
  nos.find((n) => n.em === caixa && (n.espaco ?? 0) === espaco);

/** As peças que estão direto dentro da caixa, na ordem dos espaços (de cima para baixo). */
export const pecasDaCaixa = (nos: readonly No[], id: string): No[] =>
  nos.filter((n) => n.em === id).sort((a, b) => (a.espaco ?? 0) - (b.espaco ?? 0));

/** O que uma peça é, para a caixa: o que ela dá de saída. */
function naturezaDaPeca(nos: readonly No[], n: No, visto: ReadonlySet<string>): ConteudoDaCaixa {
  if (n.tipo === "gatilho") return "gatilho";
  if (n.tipo === "condicao") return "valor";
  if (n.tipo === "acao" || n.tipo === "sinal") return "acao";
  if (n.tipo === "caixa") return conteudoDaCaixa(nos, n.id, visto);
  return "vazia";
}

/**
 * O que a caixa produz, pelas peças de dentro: gatilho OU gatilho e gatilho E condição são um gatilho; condição com condição
 * (e NÃO condição) é um valor; ação com ação é uma ação. Com um espaço só preenchido, é o que aquela peça é. Mistura que não
 * combina conta pelo gatilho, depois pela ação (o erro é apontado à parte).
 */
export function conteudoDaCaixa(
  nos: readonly No[],
  id: string,
  visto: ReadonlySet<string> = new Set(),
): ConteudoDaCaixa {
  if (visto.has(id)) return "vazia";
  const v = new Set([...visto, id]);
  const pecas = pecasDaCaixa(nos, id).map((p) => naturezaDaPeca(nos, p, v));
  const reais = pecas.filter((p) => p !== "vazia");
  if (reais.length === 0) return "vazia";
  if (reais.includes("gatilho")) return "gatilho";
  if (reais.includes("acao")) return "acao";
  return "valor";
}

/**
 * Os nós que só dão um valor: as condições e as caixas de condições (e a vazia, que ainda não é nada). O gatilho, a caixa de
 * gatilho e a caixa de ação são de ordem. Sem `nos`, a caixa conta como de valor.
 */
export function ehNoDeValor(no: Pick<No, "tipo" | "id">, nos?: readonly No[]): boolean {
  if (no.tipo === "condicao") return true;
  if (no.tipo !== "caixa") return false;
  if (nos === undefined) return true;
  const c = conteudoDaCaixa(nos, no.id);
  return c === "valor" || c === "vazia";
}

/** O nó de onde os fios saem: a caixa mais de fora para uma peça guardada; o próprio nó nos outros casos. */
export function noDosFios(nos: readonly No[], id: string): string {
  let atual = id;
  for (let i = 0; i <= NIVEIS_DE_CAIXA + 2; i++) {
    const pai = nos.find((n) => n.id === atual)?.em;
    if (pai === undefined || !nos.some((n) => n.id === pai)) return atual;
    atual = pai;
  }
  return atual;
}

/**
 * As condições que seguram um gatilho guardado: "gatilho E condição" só segue quando a condição é verdade. Sobe pelas caixas
 * de fora e junta as outras peças de cada caixa E, quando são condições.
 */
export function condicoesDoGatilho(nos: readonly No[], id: string): string[] {
  const condicoes: string[] = [];
  let atual = nos.find((n) => n.id === id);
  for (let i = 0; i <= NIVEIS_DE_CAIXA + 2 && atual?.em !== undefined; i++) {
    const caixa: No | undefined = nos.find((n) => n.id === atual?.em);
    if (caixa === undefined || caixa.tipo !== "caixa") break;
    if (caixa.config.porta === "e") {
      for (const outro of pecasDaCaixa(nos, caixa.id)) {
        if (outro.id !== atual.id && naturezaDaPeca(nos, outro, new Set()) === "valor")
          condicoes.push(outro.id);
      }
    }
    atual = caixa;
  }
  return condicoes;
}

/**
 * As portas de um nó: o que encaixa onde. `nos` (os nós do fluxo) só importa para a caixa: de gatilho, tem a saída de ordem;
 * de ação, tem a entrada e a saída de ordem; de condição (ou vazia), tem a saída de valor. Uma peça guardada numa caixa não
 * tem porta: ela só se liga pela caixa.
 */
export function portasDoNo(
  no: Pick<No, "tipo"> & { id?: string; em?: string | undefined; config?: unknown },
  nos?: readonly No[],
): {
  entradas: PortaDeEntrada[];
  saidas: PortaDeSaida[];
} {
  if (no.em !== undefined) return { entradas: [], saidas: [] };
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
    case "caixa": {
      const c =
        nos !== undefined && no.id !== undefined ? conteudoDaCaixa(nos, no.id) : ("vazia" as const);
      if (c === "gatilho") return { entradas: [], saidas: [saidaExec("saida", "Dispara")] };
      if (c === "acao") return { entradas: [ENTRADA_EXEC], saidas: [saidaExec("saida", "Depois")] };
      return { entradas: [], saidas: [{ id: "saida", tipo: "valor", rotulo: "Vale" }] };
    }
  }
}

export const chaveDoFio = (f: Fio): string =>
  `${f.de.no}.${f.de.saida}>${f.para.no}.${f.para.entrada}`;

// --- O fluxo ---

/**
 * Uma automação (AU2): um grafo. Tem de ter pelo menos um nó de gatilho ("Quando"); a conferência em português (o que falta,
 * o fio solto, o ciclo sem espera) é de `problemasDoFluxo`. Aqui só se garante a forma: ids de nó únicos, fios entre nós que
 * existem, portas que existem e fio de ordem só com fio de ordem.
 */
const FluxoBaseSchema = z
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
    /** AU3: o fluxo já está no formato das caixas (marca da conversão do AU2). */
    caixas: z.literal(true).optional(),
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
    // AU3: a peça guardada aponta para uma caixa que existe, e as caixas não se contêm em círculo.
    for (const n of f.nos) {
      if (n.em === undefined) continue;
      if (porId.get(n.em)?.tipo !== "caixa") {
        ctx.addIssue({
          code: "custom",
          message: "Uma peça está dentro de uma caixa que não existe.",
        });
        return;
      }
      let acima: string | undefined = n.em;
      for (let i = 0; i < f.nos.length + 1 && acima !== undefined; i++) {
        if (acima === n.id) {
          ctx.addIssue({ code: "custom", message: "Uma caixa não cabe dentro dela mesma." });
          return;
        }
        acima = porId.get(acima)?.em;
      }
    }
    // AU3: cada espaço da caixa guarda uma peça só, e a peça cabe nos espaços que a caixa tem.
    const ocupados = new Set<string>();
    for (const n of f.nos) {
      if (n.em === undefined) continue;
      const caixa = porId.get(n.em);
      const tem =
        caixa?.tipo === "caixa"
          ? caixa.config.porta === "nao"
            ? 1
            : (caixa.config.espacos ?? MINIMO_DE_ESPACOS)
          : 0;
      if ((n.espaco ?? 0) >= tem) {
        ctx.addIssue({
          code: "custom",
          message: "Uma peça está num espaço que a caixa não tem.",
        });
        return;
      }
      const chave = `${n.em}/${n.espaco ?? 0}`;
      if (ocupados.has(chave)) {
        ctx.addIssue({
          code: "custom",
          message:
            "Cada espaço da caixa guarda uma peça só: nesta, dois blocos estão no mesmo espaço.",
        });
        return;
      }
      ocupados.add(chave);
    }
    const vistos = new Set<string>();
    for (const fio of f.fios) {
      const de = porId.get(fio.de.no);
      const para = porId.get(fio.para.no);
      if (de === undefined || para === undefined) {
        ctx.addIssue({ code: "custom", message: "Há um fio ligado a um bloco que não existe." });
        return;
      }
      const saida = portasDoNo(de, f.nos).saidas.find((p) => p.id === fio.de.saida);
      const entrada = portasDoNo(para, f.nos).entradas.find((p) => p.id === fio.para.entrada);
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
/** AU3: lê também o AU2 (portas com fios), convertido em caixas na hora. */
export const FluxoSchema = z.preprocess(portasParaCaixas, FluxoBaseSchema);
export type Fluxo = z.infer<typeof FluxoBaseSchema>;

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
