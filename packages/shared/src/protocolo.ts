import { z } from "zod";
import { AssetMetaSchema, HashSchema, LIMITES_DE_ASSET, MetaNovaSchema } from "./assets.ts";
import {
  CAPACIDADES_DELEGAVEIS,
  type Capacidade,
  PERMISSOES_PADRAO,
  TODAS_AS_CAPACIDADES,
} from "./capacidades.ts";
import {
  CenaSchema,
  EditoresSchema,
  EstadoSchema,
  GridSchema,
  MapaDaCenaSchema,
  PapelSchema,
  PastaSchema,
  PermissoesSchema,
  PersonagemSchema,
  PresencaSchema,
  TAMANHO_MAXIMO_NOTA,
  TokenSchema,
  VisibilidadeSchema,
} from "./estado.ts";
import { CENA_PADRAO } from "./mapa.ts";
import { migrarPersonagem, PersonagemAntigoSchema, pastasPadrao } from "./pastas.ts";

export const VERSAO_PROTOCOLO = 1;
/** Versão do arquivo de exportação (de v1 a v4 ainda são aceitas na importação). */
export const VERSAO_EXPORTACAO = 5 as const;

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

/** v2 (Lote 2): sem metas de assets. Nunca há bytes de imagem numa exportação, só metadados. */
const DadosV2Schema = EstadoSchema.omit({
  assets: true,
  personagens: true,
  pastas: true,
  ordemDeTurnoVisivel: true,
}).extend({
  notaMestre: Texto,
  permissoes: PermissoesExportadasSchema,
});

/** v3 (Lote 3): acrescenta as metas dos assets usados (mapas e imagens de tokens). */
const DadosV3Schema = DadosV2Schema.extend({
  assets: z.array(AssetMetaSchema).max(LIMITES_DE_ASSET.assetsNaSala),
});

/**
 * v4 (Lote 4): acrescenta os personagens (com `donoId`); as cenas (várias) ganham a chegada. Os
 * preparos (chaves do pré-envio) nunca entram: são dado da sessão, não da campanha.
 */
const DadosV4Schema = DadosV3Schema.extend({
  personagens: z.array(PersonagemAntigoSchema).max(500),
});

/**
 * v5 (Lote 4b): os personagens trocam o dono por "quem edita" e ganham pasta e retrato; entram as
 * pastas das Fichas e o estado da ordem de turno.
 */
const DadosV5Schema = DadosV3Schema.extend({
  personagens: z.array(PersonagemSchema).max(500),
  pastas: z.array(PastaSchema).max(200),
  ordemDeTurnoVisivel: z.boolean(),
});
export type DadosExportados = z.infer<typeof DadosV5Schema>;

/** v1 (Lote 1): sem cenas nem tokens. Vira a cena padrão e nenhum token. */
const DadosV1Schema = DadosV2Schema.omit({
  cenas: true,
  cenaAtivaId: true,
  tokens: true,
}).transform((d) => ({ ...d, cenas: [CENA_PADRAO], cenaAtivaId: CENA_PADRAO.id, tokens: [] }));

const cabecalho = { formato: z.literal("tabletop-campanha"), exportadoEm: z.string() };

/**
 * Aceita de v1 a v5; o resultado é sempre no formato v5. Nas antigas faltam assets, personagens e
 * pastas: entram vazios (v1 a v3) ou migrados (v4: o dono vira "quem edita" numa pasta só do mestre).
 */
export const ExportacaoSchema = z
  .discriminatedUnion("versao", [
    z.object({ ...cabecalho, versao: z.literal(1), dados: DadosV1Schema }),
    z.object({ ...cabecalho, versao: z.literal(2), dados: DadosV2Schema }),
    z.object({ ...cabecalho, versao: z.literal(3), dados: DadosV3Schema }),
    z.object({ ...cabecalho, versao: z.literal(4), dados: DadosV4Schema }),
    z.object({ ...cabecalho, versao: z.literal(5), dados: DadosV5Schema }),
  ])
  .transform((e) => {
    const d = e.dados;
    const base = {
      ...d,
      assets: "assets" in d ? d.assets : [],
      pastas: "pastas" in d ? d.pastas : pastasPadrao(),
      ordemDeTurnoVisivel: "ordemDeTurnoVisivel" in d ? d.ordemDeTurnoVisivel : false,
    };
    const personagens =
      e.versao === 5
        ? e.dados.personagens
        : e.versao === 4
          ? e.dados.personagens.map(migrarPersonagem)
          : [];
    return { ...e, versao: VERSAO_EXPORTACAO, dados: { ...base, personagens } };
  });
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
})
  .extend({ assetHash: HashSchema.nullable() })
  .partial();
const PosicaoDoTokenSchema = z.object({ id: IdSchema, x: z.number(), y: z.number() });

const MudancasDoPersonagemSchema = z
  .object({
    nome: PersonagemSchema.shape.nome,
    editores: EditoresSchema,
    pastaId: PersonagemSchema.shape.pastaId,
    /** `null`: tira o retrato. */
    retratoHash: HashSchema.nullable(),
    cor: PersonagemSchema.shape.tokenPadrao.shape.cor,
    tamanhoQuadrados: PersonagemSchema.shape.tokenPadrao.shape.tamanhoQuadrados,
    assetHash: HashSchema.nullable(),
    alcanceM: PersonagemSchema.shape.visao.shape.alcanceM,
    visaoNoEscuroM: PersonagemSchema.shape.visao.shape.visaoNoEscuroM,
    pvAtual: PersonagemSchema.shape.ficha.shape.pvAtual,
    pvMax: PersonagemSchema.shape.ficha.shape.pvMax,
  })
  .partial();

/** Um arquivo pré-enviado: o cifrado (que todos baixam), o original e a chave (só do mestre e da sala). */
export const PacoteSchema = z.object({
  hashCifrado: HashSchema,
  hashOriginal: HashSchema,
  chave: HashSchema, // 32 bytes em hexadecimal: mesmo formato (64 caracteres)
});
export type Pacote = z.infer<typeof PacoteSchema>;
export const MAXIMO_DE_PACOTES = 200;

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
  intencao("token.criar", z.object({ token: TokenNovoSchema, cenaId: IdSchema.optional() })),
  intencao("token.editar", z.object({ id: IdSchema, mudancas: MudancasDoTokenSchema })),
  intencao("token.apagar", z.object({ id: IdSchema })),
  intencao(
    "cena.configurarGrid",
    z.object({
      cenaId: IdSchema.optional(),
      quadradoM: GridSchema.shape.quadradoM.optional(),
      visivel: z.boolean().optional(),
    }),
  ),
  intencao("token.mover", PosicaoDoTokenSchema),
  intencao("token.soltar", PosicaoDoTokenSchema),
  intencao(
    "asset.registrar",
    z.object({ metas: z.array(MetaNovaSchema).min(1).max(LIMITES_DE_ASSET.metasPorRegistro) }),
  ),
  /** `faltam`: índices que o cliente ainda não tem (retomada); sem ele vale o arquivo inteiro. */
  intencao(
    "asset.pedir",
    z.object({
      hash: HashSchema,
      faltam: z.array(z.number().int().nonnegative()).max(200).optional(),
    }),
  ),
  intencao(
    "asset.inventario",
    z.object({ hashes: z.array(HashSchema).max(LIMITES_DE_ASSET.inventario) }),
  ),
  intencao("asset.tenho", z.object({ hash: HashSchema })),
  intencao("asset.naoTenho", z.object({ hash: HashSchema })),
  intencao(
    "cena.definirMapa",
    z.object({
      cenaId: IdSchema.optional(),
      assetHash: HashSchema.nullable(),
      pxPorQuadrado: MapaDaCenaSchema.shape.pxPorQuadrado.optional(),
    }),
  ),
  intencao("token.definirImagem", z.object({ id: IdSchema, assetHash: HashSchema.nullable() })),
  intencao("personagem.criar", z.object({ personagem: PersonagemSchema })),
  intencao("pasta.criar", z.object({ pasta: PastaSchema })),
  intencao(
    "pasta.editar",
    z.object({
      id: IdSchema,
      nome: PastaSchema.shape.nome.optional(),
      visivel: VisibilidadeSchema.optional(),
    }),
  ),
  /** Só pasta vazia. */
  intencao("pasta.apagar", z.object({ id: IdSchema })),
  /** Mostra ou esconde o painel de ordem de turno para todos (inclusive o mestre). */
  intencao("ordemDeTurno.definir", z.object({ visivel: z.boolean() })),
  /**
   * Mestre: qualquer mudança. Quem edita o personagem (jogador): só as imagens (`assetHash`,
   * `retratoHash`), e com `asset.subir`.
   */
  intencao("personagem.editar", z.object({ id: IdSchema, mudancas: MudancasDoPersonagemSchema })),
  intencao("personagem.apagar", z.object({ id: IdSchema })),
  intencao(
    "personagem.colocar",
    z.object({
      personagemId: IdSchema,
      cenaId: IdSchema,
      tokenId: IdSchema,
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  ),
  /** Dono do personagem ou mestre; `pvAtual` nunca passa de `pvMax`. */
  intencao(
    "ficha.alterar",
    z.object({
      personagemId: IdSchema,
      pvAtual: PersonagemSchema.shape.ficha.shape.pvAtual.optional(),
      pvMax: PersonagemSchema.shape.ficha.shape.pvMax.optional(),
    }),
  ),
  intencao("cena.criar", z.object({ id: IdSchema, nome: CenaSchema.shape.nome })),
  intencao(
    "cena.editar",
    z.object({
      cenaId: IdSchema,
      nome: CenaSchema.shape.nome.optional(),
      /** `null`: volta ao padrão (o centro). */
      chegada: z
        .object({ x: z.number().min(0), y: z.number().min(0) })
        .nullable()
        .optional(),
    }),
  ),
  intencao("cena.duplicar", z.object({ cenaId: IdSchema, novoId: IdSchema })),
  intencao("cena.apagar", z.object({ cenaId: IdSchema })),
  /** Uma única mensagem leva o grupo e torna a cena de destino a ativa. */
  intencao("grupo.moverPara", z.object({ cenaId: IdSchema })),
  /** Pré-envio cifrado: os arquivos cifrados já foram registrados; aqui vão as chaves, só para a sala. */
  intencao(
    "cena.preparar",
    z.object({ cenaId: IdSchema, pacotes: z.array(PacoteSchema).min(1).max(MAXIMO_DE_PACOTES) }),
  ),
  intencao("campanha.exportar", SemDados),
  intencao("campanha.importar", z.object({ dados: z.unknown() })),
]);
export type Intencao = z.infer<typeof IntencaoSchema>;
export type TipoIntencao = Intencao["tipo"];

/**
 * Capacidade exigida por cada tipo de intenção. Conferida em toda mensagem. `null`: não é uma
 * ação da mesa e sim o vaivém de arquivos (pedir, inventário, "tenho") ou uma ação que depende de
 * quem edita o personagem (`ficha.alterar`, `personagem.editar`); qualquer mestre ou jogador pode
 * enviar, e a regra é conferida sobre o asset (`assetVisivelPara`) ou sobre o personagem.
 */
export const capacidadeDaIntencao: Record<TipoIntencao, Capacidade | null> = {
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
  "asset.registrar": "asset.subir",
  "asset.pedir": null,
  "asset.inventario": null,
  "asset.tenho": null,
  "asset.naoTenho": null,
  "cena.definirMapa": "cena.editar",
  "token.definirImagem": "asset.subir",
  "personagem.criar": "cena.editar",
  // Quem edita o personagem (só as imagens) ou o mestre: `processar` confere.
  "personagem.editar": null,
  "personagem.apagar": "cena.editar",
  "pasta.criar": "mesa.configurar",
  "pasta.editar": "mesa.configurar",
  "pasta.apagar": "mesa.configurar",
  "ordemDeTurno.definir": "mesa.configurar",
  "personagem.colocar": "cena.editar",
  // Quem edita ou o mestre: a capacidade não diz quem edita; `processar` confere.
  "ficha.alterar": null,
  "cena.criar": "cena.editar",
  "cena.editar": "cena.editar",
  "cena.duplicar": "cena.editar",
  "cena.apagar": "cena.editar",
  "grupo.moverPara": "cena.editar",
  "cena.preparar": "cena.editar",
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

const DimensaoSchema = z.number().positive().max(1000);

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
  /** Com mapa, mudar o quadrado muda o tamanho da cena em metros: vem junto no evento. */
  eventoDe(
    "cena.gridAlterado",
    z.object({
      cenaId: IdSchema,
      grid: GridSchema,
      larguraM: DimensaoSchema.optional(),
      alturaM: DimensaoSchema.optional(),
    }),
  ),
  eventoDe(
    "cena.mapaAlterado",
    z.object({
      cenaId: IdSchema,
      mapa: MapaDaCenaSchema.nullable(),
      larguraM: DimensaoSchema,
      alturaM: DimensaoSchema,
    }),
  ),
  /** Personagem inteiro depois da mudança (criação, edição ou ficha): o cliente faz upsert. */
  eventoDe("personagem.alterado", z.object({ personagem: PersonagemSchema })),
  /** Pasta inteira depois da mudança (criação, nome, visibilidade): o cliente faz upsert. */
  eventoDe("pasta.alterada", z.object({ pasta: PastaSchema })),
  /** Só o filtro cria o "some" de pasta que o jogador deixou de ver; o mestre também a recebe ao apagar. */
  eventoDe("pasta.apagada", z.object({ id: IdSchema })),
  eventoDe("ordemDeTurno.alterada", z.object({ visivel: z.boolean() })),
  /** Os tokens dele já saíram em `token.apagado`; este tira o personagem (também de quem deixou de vê-lo). */
  eventoDe("personagem.apagado", z.object({ id: IdSchema })),
  /** Só mestres recebem os eventos de cena, exceto `cena.editada` da cena ativa. */
  eventoDe("cena.criada", z.object({ cena: CenaSchema })),
  eventoDe("cena.editada", z.object({ cena: CenaSchema })),
  eventoDe("cena.apagada", z.object({ cenaId: IdSchema })),
  /** O grupo foi para outra cena: nova cena ativa e nova posição (e cena) dos tokens. Só mestres. */
  eventoDe(
    "grupo.movido",
    z.object({
      cenaId: IdSchema,
      tokens: z.array(z.object({ id: IdSchema, x: z.number(), y: z.number() })),
    }),
  ),
  /** Só mestres recebem (as metas dos jogadores chegam por `asset.meta`, sob demanda). */
  eventoDe("asset.registrado", z.object({ meta: AssetMetaSchema })),
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
  "asset_inexistente",
  "personagem_inexistente",
  "cena_inexistente",
  "pasta_inexistente",
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
  /** Meta de um asset que o cliente pediu e pode ver (sob demanda; nunca em broadcast). */
  mensagemDaSala("asset.meta", z.object({ meta: AssetMetaSchema })),
  /** Pedido da sala ao provedor: mande estes pedaços (frames binários) de `hash`. */
  mensagemDaSala(
    "asset.enviar",
    z.object({ hash: HashSchema, indices: z.array(z.number().int().nonnegative()).max(200) }),
  ),
  /** Ninguém online tem o arquivo; a sala retoma sozinha quando alguém com cópia conectar. */
  mensagemDaSala("asset.indisponivel", z.object({ hash: HashSchema })),
  mensagemDaSala("exportacao", z.object({ idPedido: z.string(), exportacao: ExportacaoSchema })),
  /**
   * Pré-envio (Lote 4): baixe estes arquivos cifrados. Sem `cenaId`, sem nome, sem nada sobre o
   * conteúdo. A sala manda a todo jogador conectado e a quem conecta depois.
   */
  mensagemDaSala("preparo.disponivel", z.object({ hashes: z.array(HashSchema).max(2000) })),
  /**
   * Ao levar o grupo: as chaves dos pacotes cujo original o jogador passa a ver. Chega antes do
   * snapshot da cena nova.
   */
  mensagemDaSala(
    "preparo.chaves",
    z.object({ pacotes: z.array(PacoteSchema).max(MAXIMO_DE_PACOTES) }),
  ),
  /** Só mestres: como anda cada preparo (e o que já está nele, para preparar só o que falta). */
  mensagemDaSala(
    "preparo.progresso",
    z.object({
      preparos: z.array(
        z.object({
          cenaId: IdSchema,
          hashesOriginais: z.array(HashSchema),
          /** Jogadores com todos os pacotes. */
          completos: z.number().int().nonnegative(),
          jogadores: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
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
