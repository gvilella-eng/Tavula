import { z } from "zod";
import {
  CAPACIDADES_DELEGAVEIS,
  type Capacidade,
  PERMISSOES_PADRAO,
  TODAS_AS_CAPACIDADES,
} from "./capacidades.ts";
import {
  EstadoSchema,
  GridSchema,
  PapelSchema,
  PermissoesSchema,
  PresencaSchema,
  TAMANHO_MAXIMO_NOTA,
  TokenSchema,
} from "./estado.ts";
import { CENA_PADRAO } from "./mapa.ts";

export const VERSAO_PROTOCOLO = 1;
/** Versão do arquivo de exportação (a v1, do Lote 1, ainda é aceita na importação). */
export const VERSAO_EXPORTACAO = 2 as const;

const CapacidadeSchema = z.enum(TODAS_AS_CAPACIDADES as [Capacidade, ...Capacidade[]]);
const Texto = z.string().max(TAMANHO_MAXIMO_NOTA);
const SemDados = z.object({});

// ---------------------------------------------------------------------------------------------
// Exportação da campanha
// ---------------------------------------------------------------------------------------------

/**
 * Arquivo exportado antes de existir uma capacidade nova não traz essa capacidade: ela entra com
 * o padrão da mesa (o mesmo que o carregamento do SQLite faz).
 */
const PermissoesExportadasSchema = PermissoesSchema.extend({
  jogadores: z.partialRecord(z.enum(CAPACIDADES_DELEGAVEIS), z.boolean()),
}).transform((p) => ({ ...p, jogadores: { ...PERMISSOES_PADRAO, ...p.jogadores } }));

const DadosV2Schema = EstadoSchema.extend({
  notaMestre: Texto,
  permissoes: PermissoesExportadasSchema,
});
export type DadosExportados = z.infer<typeof DadosV2Schema>;

/** v1 (Lote 1): sem cenas nem tokens. Vira a cena padrão e nenhum token. */
const DadosV1Schema = DadosV2Schema.omit({
  cenas: true,
  cenaAtivaId: true,
  tokens: true,
}).transform((d) => ({ ...d, cenas: [CENA_PADRAO], cenaAtivaId: CENA_PADRAO.id, tokens: [] }));

const cabecalho = { formato: z.literal("tabletop-campanha"), exportadoEm: z.string() };

/** Aceita a v1 e a v2; o resultado é sempre no formato v2. */
export const ExportacaoSchema = z
  .discriminatedUnion("versao", [
    z.object({ ...cabecalho, versao: z.literal(1), dados: DadosV1Schema }),
    z.object({ ...cabecalho, versao: z.literal(2), dados: DadosV2Schema }),
  ])
  .transform((e) => ({ ...e, versao: VERSAO_EXPORTACAO }));
export type Exportacao = z.infer<typeof ExportacaoSchema>;

// ---------------------------------------------------------------------------------------------
// Cliente -> sala: intenções
// ---------------------------------------------------------------------------------------------

const IdSchema = z.string().min(1).max(64);
const TokenNovoSchema = TokenSchema.omit({ cenaId: true });
const MudancasDoTokenSchema = TokenSchema.pick({
  nome: true,
  cor: true,
  tamanhoQuadrados: true,
  camada: true,
  oculto: true,
  controladoPor: true,
}).partial();
const PosicaoDoTokenSchema = z.object({ id: IdSchema, x: z.number(), y: z.number() });

function intencao<T extends string, D extends z.ZodType>(tipo: T, dados: D) {
  return z.object({
    v: z.literal(VERSAO_PROTOCOLO),
    id: z.string().min(1).max(64),
    tipo: z.literal(tipo),
    dados,
  });
}

export const IntencaoSchema = z.discriminatedUnion("tipo", [
  intencao("nota.editar", z.object({ texto: Texto })),
  intencao("notaMestre.editar", z.object({ texto: Texto })),
  intencao(
    "papel.alterar",
    z.object({ usuarioId: z.string().min(1), papel: z.enum(["mestre", "jogador"]) }),
  ),
  intencao(
    "permissao.alterar",
    z
      .object({
        capacidade: CapacidadeSchema,
        valor: z.boolean().nullable(),
        usuarioId: z.string().min(1).optional(),
      })
      // `null` (remover a exceção) só faz sentido para um usuário.
      .refine((d) => d.valor !== null || d.usuarioId !== undefined, {
        message: "valor null exige usuarioId",
      }),
  ),
  intencao("token.criar", z.object({ token: TokenNovoSchema })),
  intencao("token.editar", z.object({ id: IdSchema, mudancas: MudancasDoTokenSchema })),
  intencao("token.apagar", z.object({ id: IdSchema })),
  intencao(
    "cena.configurarGrid",
    z.object({ quadradoM: GridSchema.shape.quadradoM.optional(), visivel: z.boolean().optional() }),
  ),
  intencao("token.mover", PosicaoDoTokenSchema),
  intencao("token.soltar", PosicaoDoTokenSchema),
  intencao("campanha.exportar", SemDados),
  intencao("campanha.importar", z.object({ dados: z.unknown() })),
]);
export type Intencao = z.infer<typeof IntencaoSchema>;
export type TipoIntencao = Intencao["tipo"];

/** Capacidade exigida por cada tipo de intenção. Conferida em toda mensagem. */
export const capacidadeDaIntencao: Record<TipoIntencao, Capacidade> = {
  "nota.editar": "nota.editar",
  "notaMestre.editar": "camadaMestre.ver",
  "papel.alterar": "papel.alterar",
  "permissao.alterar": "permissao.alterar",
  "token.criar": "cena.editar",
  "token.editar": "cena.editar",
  "token.apagar": "cena.editar",
  "cena.configurarGrid": "cena.editar",
  "token.mover": "token.moverProprio",
  "token.soltar": "token.moverProprio",
  "campanha.exportar": "campanha.exportar",
  "campanha.importar": "campanha.importar",
};

// ---------------------------------------------------------------------------------------------
// Sala -> cliente
// ---------------------------------------------------------------------------------------------

export const OrigemSchema = z.object({ usuarioId: z.string(), idPedido: z.string() });
export type Origem = z.infer<typeof OrigemSchema>;

function eventoDe<T extends string, D extends z.ZodType>(tipo: T, dados: D) {
  return z.object({
    seq: z.number().int().positive(),
    origem: OrigemSchema,
    tipo: z.literal(tipo),
    dados,
  });
}

export const EventoSalaSchema = z.discriminatedUnion("tipo", [
  eventoDe("nota.alterada", z.object({ texto: Texto })),
  eventoDe("notaMestre.alterada", z.object({ texto: Texto })),
  eventoDe("papel.alterado", z.object({ usuarioId: z.string(), papel: PapelSchema })),
  eventoDe(
    "permissao.alterada",
    z.object({
      capacidade: CapacidadeSchema,
      valor: z.boolean().nullable(),
      usuarioId: z.string().optional(),
    }),
  ),
  eventoDe("token.criado", z.object({ token: TokenSchema })),
  /** Token inteiro depois da mudança (o cliente faz upsert). */
  eventoDe("token.editado", z.object({ token: TokenSchema })),
  eventoDe("token.apagado", z.object({ id: IdSchema })),
  eventoDe("token.movido", PosicaoDoTokenSchema),
  /** Só o filtro cria este: o token deixou de ser visível para quem recebe. Sem motivo. */
  eventoDe("token.sumiu", z.object({ id: IdSchema })),
  eventoDe("cena.gridAlterado", z.object({ cenaId: IdSchema, grid: GridSchema })),
]);
export type EventoSala = z.infer<typeof EventoSalaSchema>;

export const CODIGOS_DE_ERRO = [
  "mensagem_invalida",
  "sem_permissao",
  "ultimo_mestre",
  "usuario_inexistente",
  "capacidade_nao_delegavel",
  "importacao_invalida",
  "token_inexistente",
  "dados_invalidos",
] as const;
export const CodigoDeErroSchema = z.enum(CODIGOS_DE_ERRO);
export type CodigoDeErro = z.infer<typeof CodigoDeErroSchema>;

export const UsoSchema = z.object({
  dia: z.string(),
  mensagens: z.number().int().nonnegative(),
  conexoes: z.number().int().nonnegative(),
  /** Requisições equivalentes: mensagens/20 + conexões. */
  requisicoes: z.number().nonnegative(),
  /** Percentual do limite diário (100 mil requisições). */
  percentual: z.number().nonnegative(),
});
export type Uso = z.infer<typeof UsoSchema>;

function mensagemDaSala<T extends string, D extends z.ZodType>(tipo: T, dados: D) {
  return z.object({ v: z.literal(VERSAO_PROTOCOLO), tipo: z.literal(tipo), dados });
}

export const MensagemDaSalaSchema = z.discriminatedUnion("tipo", [
  mensagemDaSala("snapshot", z.object({ usuarioId: z.string(), estado: EstadoSchema })),
  mensagemDaSala("evento", EventoSalaSchema),
  mensagemDaSala("presenca", z.object({ usuarios: z.record(z.string(), PresencaSchema) })),
  mensagemDaSala("uso", UsoSchema),
  /** Movimento ao vivo de um token (transitório: sem `seq`, não é gravado). */
  mensagemDaSala("token.movendo", PosicaoDoTokenSchema),
  mensagemDaSala(
    "erro",
    z.object({
      idPedido: z.string().nullable(),
      codigo: CodigoDeErroSchema,
      mensagem: z.string(),
    }),
  ),
  mensagemDaSala("exportacao", z.object({ idPedido: z.string(), exportacao: ExportacaoSchema })),
]);
export type MensagemDaSala = z.infer<typeof MensagemDaSalaSchema>;
export type TipoMensagemDaSala = MensagemDaSala["tipo"];

type SemVersao<T> = T extends unknown ? Omit<T, "v"> : never;

/** Serializa uma mensagem da sala, já com a versão do protocolo. */
export function mensagem(m: SemVersao<MensagemDaSala>): string {
  return JSON.stringify({ v: VERSAO_PROTOCOLO, ...m });
}

export type ResultadoDeLeitura<T> = { ok: true; valor: T } | { ok: false; motivo: string };

function ler<T>(schema: z.ZodType<T>, texto: unknown): ResultadoDeLeitura<T> {
  if (typeof texto !== "string") return { ok: false, motivo: "esperava texto JSON" };
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: "JSON inválido" };
  }
  const r = schema.safeParse(json);
  if (r.success) return { ok: true, valor: r.data };
  return { ok: false, motivo: r.error.issues[0]?.message ?? "mensagem inválida" };
}

/** Valida uma mensagem do cliente (texto JSON). */
export function lerIntencao(texto: unknown): ResultadoDeLeitura<Intencao> {
  return ler(IntencaoSchema, texto);
}

/** Valida uma mensagem da sala (texto JSON). */
export function lerMensagemDaSala(texto: unknown): ResultadoDeLeitura<MensagemDaSala> {
  return ler(MensagemDaSalaSchema, texto);
}

/** Tenta descobrir o id do pedido numa mensagem malformada, para o `erro` apontar para ele. */
export function idDoPedido(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  try {
    const id = (JSON.parse(texto) as { id?: unknown } | null)?.id;
    return typeof id === "string" && id.length <= 64 ? id : null;
  } catch {
    return null;
  }
}
