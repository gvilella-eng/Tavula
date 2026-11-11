import { z } from "zod";
import { AssetMetaSchema, HashSchema, LIMITES_DE_ASSET, MetaNovaSchema } from "./assets.ts";
import {
  CAPACIDADES_DELEGAVEIS,
  type Capacidade,
  PERMISSOES_PADRAO,
  TODAS_AS_CAPACIDADES,
} from "./capacidades.ts";
import { LIMITES_DO_CHAT, MensagemSchema, TEXTO_DO_CHAT_MAX } from "./chat.ts";
import { CombateSchema, IniciativaSchema, LIMITES_DO_COMBATE } from "./combate.ts";
import { CompendioDaMesaSchema, MagiaDoCompendioSchema } from "./compendio.ts";
import { CondicaoSchema } from "./condicoes.ts";
import { LIMITES_DE_DADOS } from "./dados.ts";
import {
  DesenhoBaseSchema,
  DesenhoEmAndamentoSchema,
  DesenhoNovoSchema,
  DesenhoSchema,
  LIMITES_DO_DESENHO,
} from "./desenho.ts";
import {
  CenaSchema,
  CONFIG_PADRAO,
  ConfigDaMesaSchema,
  ConfigEstagiosSchema,
  ConfigIluminacaoSchema,
  configComPadrao,
  EditoresSchema,
  EstadoDePortaSchema,
  EstadoSchema,
  FonteDeLuzAntigaSchema,
  GridSchema,
  LuzSchema,
  MapaDaCenaSchema,
  ModeloDeObjetoSchema,
  migrarFonteAntiga,
  ObjetoDeLuzSchema,
  PapelSchema,
  ParedeSchema,
  PastaSchema,
  PermissoesSchema,
  PersonagemSchema,
  PontoDeLuzSchema,
  PontoSchema,
  PortadorFixoSchema,
  PresencaSchema,
  RelogioSalaSchema,
  TAMANHO_MAXIMO_NOTA,
  TipoDeParedeSchema,
  TokenSchema,
  VisibilidadeSchema,
} from "./estado.ts";
import {
  absorverMochila,
  FichaSchema,
  MAXIMO_DE_OPERACOES,
  OperacaoDeFichaSchema,
} from "./ficha.ts";
import { CENA_PADRAO } from "./mapa.ts";
import { modelosPadrao } from "./objetos.ts";
import { migrarPersonagem, PersonagemAntigoSchema, pastasPadrao } from "./pastas.ts";
import { PedidoDeModeloSchema } from "./rolagens.ts";

export const VERSAO_PROTOCOLO = 1;
/** Versão do arquivo de exportação (de v1 a v11 ainda são aceitas na importação). */
export const VERSAO_EXPORTACAO = 12 as const;

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
  paredes: true,
  luzes: true,
  config: true,
  memoriaEsquecida: true,
  modelos: true,
  pontos: true,
  relogio: true,
  acendimentos: true,
  chat: true,
  retratosDoChat: true,
  desenhos: true,
  compendio: true,
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

/**
 * v6 (Lote 5): acrescenta as paredes e portas (com o estado das portas). A iluminação dinâmica de
 * cada cena e o alcance de visão do token são campos opcionais da cena e do token: arquivos antigos
 * os trazem ausentes (cena com iluminação ligada, token sem limite).
 */
const DadosV6Schema = DadosV5Schema.extend({
  paredes: z.array(ParedeSchema).max(5000),
});

/**
 * v7 (Lote 6): acrescenta as fontes de luz e a configuração da mesa. A luz ambiente e o fator geral
 * de cada cena, a visão no escuro do token e o modificador de Inteligência do personagem são campos
 * opcionais dentro de cenas, tokens e personagens (ausentes nos arquivos antigos: cena em luz de
 * dia, sem visão no escuro, modificador 0). `memoriaEsquecida` nunca entra (é dado da sessão).
 */
const DadosV7Schema = DadosV6Schema.extend({
  luzes: z.array(FonteDeLuzAntigaSchema).max(2000),
  config: z.object({ iluminacao: ConfigIluminacaoSchema }),
});

/**
 * v8 (Lote 7): as fontes de luz viram objetos de luz (estado, saldo de tempo, modificadores,
 * histórico, portadores mão, mochila e ponto), a configuração da mesa fica completa e entram os
 * modelos de objeto, os pontos de luz e o relógio da sala. As mochilas dos personagens são um campo
 * opcional do personagem (ausente nos arquivos antigos: mochila vazia).
 */
const DadosV8Schema = DadosV6Schema.extend({
  luzes: z.array(ObjetoDeLuzSchema).max(2000),
  config: ConfigDaMesaSchema,
  modelos: z.array(ModeloDeObjetoSchema).max(200),
  pontos: z.array(PontoDeLuzSchema).max(2000),
  relogio: RelogioSalaSchema,
});
/**
 * v10 (Lote 11): acrescenta a ordem de turno (`combate`, opcional: sem ela não há combate). As condições
 * e a concentração são campos opcionais do token: arquivos antigos os trazem ausentes.
 */
const DadosV10Schema = DadosV8Schema.extend({ combate: CombateSchema.optional() });
/**
 * v11 (Lote 13): acrescenta os desenhos do pincel (por cena). Arquivos antigos os trazem ausentes:
 * entram sem nenhum desenho.
 */
const DadosV11Schema = DadosV10Schema.extend({
  desenhos: z.array(DesenhoSchema).max(LIMITES_DO_DESENHO.porCena * 200),
});
/**
 * v12 (Lote 14): acrescenta o compêndio da mesa (`compendio`, opcional: só a referência ao asset; o
 * arquivo de magias fica na pasta do mestre). Arquivos antigos o trazem ausente: entram sem compêndio.
 */
const DadosV12Schema = DadosV11Schema.extend({ compendio: CompendioDaMesaSchema.optional() });
export type DadosExportados = z.infer<typeof DadosV12Schema>;

/** v1 (Lote 1): sem cenas nem tokens. Vira a cena padrão e nenhum token. */
const DadosV1Schema = DadosV2Schema.omit({
  cenas: true,
  cenaAtivaId: true,
  tokens: true,
}).transform((d) => ({ ...d, cenas: [CENA_PADRAO], cenaAtivaId: CENA_PADRAO.id, tokens: [] }));

const cabecalho = { formato: z.literal("tabletop-campanha"), exportadoEm: z.string() };

/**
 * Aceita de v1 a v12; o resultado é sempre no formato v12. Nas antigas faltam assets, personagens,
 * pastas, paredes, luzes, configuração, modelos e pontos: entram vazios ou com o padrão (v4: o dono
 * vira "quem edita" numa pasta só do mestre; paredes só existem a partir da v6, luzes e configuração
 * da v7; modelos, pontos e relógio da v8). As luzes da v7 (`acesa`) viram objetos (`estado`).
 */
export const ExportacaoSchema = z
  .discriminatedUnion("versao", [
    z.object({ ...cabecalho, versao: z.literal(1), dados: DadosV1Schema }),
    z.object({ ...cabecalho, versao: z.literal(2), dados: DadosV2Schema }),
    z.object({ ...cabecalho, versao: z.literal(3), dados: DadosV3Schema }),
    z.object({ ...cabecalho, versao: z.literal(4), dados: DadosV4Schema }),
    z.object({ ...cabecalho, versao: z.literal(5), dados: DadosV5Schema }),
    z.object({ ...cabecalho, versao: z.literal(6), dados: DadosV6Schema }),
    z.object({ ...cabecalho, versao: z.literal(7), dados: DadosV7Schema }),
    z.object({ ...cabecalho, versao: z.literal(8), dados: DadosV8Schema }),
    z.object({ ...cabecalho, versao: z.literal(9), dados: DadosV8Schema }),
    z.object({ ...cabecalho, versao: z.literal(10), dados: DadosV10Schema }),
    z.object({ ...cabecalho, versao: z.literal(11), dados: DadosV11Schema }),
    z.object({ ...cabecalho, versao: z.literal(12), dados: DadosV12Schema }),
  ])
  .transform((e) => {
    const d = e.dados;
    const novo =
      e.versao === 8 || e.versao === 9 || e.versao === 10 || e.versao === 11 || e.versao === 12;
    const luzes = novo ? e.dados.luzes : e.versao === 7 ? e.dados.luzes.map(migrarFonteAntiga) : [];
    const config = novo
      ? e.dados.config
      : e.versao === 7
        ? configComPadrao(e.dados.config)
        : CONFIG_PADRAO;
    const base = {
      ...d,
      assets: "assets" in d ? d.assets : [],
      pastas: "pastas" in d ? d.pastas : pastasPadrao(),
      ordemDeTurnoVisivel: "ordemDeTurnoVisivel" in d ? d.ordemDeTurnoVisivel : false,
      paredes: "paredes" in d ? d.paredes : [],
      luzes,
      config,
      modelos: novo ? e.dados.modelos : modelosPadrao(),
      pontos: novo ? e.dados.pontos : [],
      // Sem relógio (arquivo antigo) a mesa começa rodando; a sala preenche `desdeReal` ao importar.
      relogio: novo ? e.dados.relogio : { pausada: false, acumuladoMs: 0 },
      // Lote 13: só a v11 e a v12 trazem desenhos.
      desenhos: e.versao === 11 || e.versao === 12 ? e.dados.desenhos : [],
      // Lote 14: só a v12 traz o compêndio (ausente = sem compêndio).
      ...(e.versao === 12 && e.dados.compendio ? { compendio: e.dados.compendio } : {}),
    };
    const personagens =
      e.versao === 5 || e.versao === 6 || e.versao === 7 || novo
        ? e.dados.personagens
        : e.versao === 4
          ? e.dados.personagens.map(migrarPersonagem)
          : [];
    // Lote 9: a mochila do Lote 7 vira itens da ficha (v8 e anteriores; a v9 já não a traz).
    return {
      ...e,
      versao: VERSAO_EXPORTACAO,
      dados: { ...base, personagens: personagens.map((p) => absorverMochila(p, base.modelos)) },
    };
  });
export type Exportacao = z.infer<typeof ExportacaoSchema>;

// ---------------------------------------------------------------------------------------------
// Cliente -> sala: intenções
// ---------------------------------------------------------------------------------------------

const IdSchema = z.string().min(1).max(64);
const MAXIMO_DE_PAREDES_POR_MENSAGEM = 200;
const ParedeNovaSchema = ParedeSchema.omit({ cenaId: true });
const TokenNovoSchema = TokenSchema.omit({ cenaId: true });
const MudancasDoTokenSchema = TokenSchema.pick({
  nome: true,
  cor: true,
  tamanhoQuadrados: true,
  camada: true,
  oculto: true,
  controladoPor: true,
})
  .extend({
    assetHash: HashSchema.nullable(),
    /** `null`: sem limite de visão. */
    alcanceVisaoM: TokenSchema.shape.alcanceVisaoM.unwrap().nullable(),
    /** `null`: volta a 0 (token sem personagem). */
    visaoNoEscuroM: TokenSchema.shape.visaoNoEscuroM.unwrap().nullable(),
  })
  .partial();
const PosicaoDoTokenSchema = z.object({ id: IdSchema, x: z.number(), y: z.number() });
/** Fonte fixa do mapa (ou criatura que brilha): sem tempo, modelo nem mochila. */
const FonteNovaSchema = z.object({
  id: ObjetoDeLuzSchema.shape.id,
  nome: ObjetoDeLuzSchema.shape.nome,
  portador: PortadorFixoSchema,
  luz: LuzSchema,
  intensidade: ObjetoDeLuzSchema.shape.intensidade,
  estado: ObjetoDeLuzSchema.shape.estado,
});
const MudancasDaFonteSchema = z
  .object({
    nome: ObjetoDeLuzSchema.shape.nome,
    portador: PortadorFixoSchema,
    luz: LuzSchema.partial(),
    intensidade: ObjetoDeLuzSchema.shape.intensidade,
    estado: ObjetoDeLuzSchema.shape.estado,
  })
  .partial();
const MudancasDaMesaSchema = ConfigDaMesaSchema.omit({ iluminacao: true, estagios: true })
  .extend({ estagios: ConfigEstagiosSchema.partial() })
  .partial();
const PontoNovoSchema = PontoDeLuzSchema.omit({ cenaId: true });
const MudancasDoPontoSchema = z
  .object({
    nome: PontoDeLuzSchema.shape.nome,
    x: z.number(),
    y: z.number(),
    /** `null`: volta ao padrão. */
    capacidade: PontoDeLuzSchema.shape.capacidade.unwrap().nullable(),
    modeloId: PontoDeLuzSchema.shape.modeloId.unwrap().nullable(),
    segurarS: PontoDeLuzSchema.shape.segurarS.unwrap().nullable(),
    visivelParaJogadores: z.boolean(),
  })
  .partial();
const MudancasDoModeloSchema = ModeloDeObjetoSchema.omit({ id: true })
  .extend({ luz: LuzSchema.partial() })
  .partial();
/** Ajuste individual de um objeto de luz pelo mestre (tudo entra no histórico do objeto). */
const AjusteDoObjetoSchema = z.discriminatedUnion("acao", [
  /** Soma (ou tira) tempo do saldo; o objeto precisa ter tempo. */
  z.object({
    acao: z.literal("tempo"),
    deltaMs: z
      .number()
      .min(-100 * 3600_000)
      .max(100 * 3600_000),
    nota: z.string().max(120).optional(),
  }),
  /** Modificador de raio (multiplica luz plena e penumbra), com ou sem prazo no relógio da sala. */
  z.object({
    acao: z.literal("modificar"),
    modificador: z.object({
      id: z.string().min(1).max(64),
      raioX: z.number().min(0.1).max(5),
      /** Duração a partir de agora, no relógio da sala; sem ela vale até o mestre tirar. */
      duracaoMs: z
        .number()
        .positive()
        .max(100 * 3600_000)
        .optional(),
      nota: z.string().max(120).optional(),
    }),
  }),
  z.object({ acao: z.literal("tirarModificador"), id: z.string().min(1).max(64) }),
  /** Extingue de vez (a lixeira): o objeto sai da coleção, como quando o tempo acaba. */
  z.object({ acao: z.literal("consumir") }),
]);

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
    modInteligencia: PersonagemSchema.shape.modInteligencia.unwrap(),
    pvAtual: FichaSchema.shape.pvAtual,
    pvMax: FichaSchema.shape.pvMax,
  })
  .partial();

/** Entrada nova da ordem de turno: de um token (o nome e a Destreza vêm dele) ou solta (precisa de nome). */
const EntradaNovaSchema = z
  .object({
    id: IdSchema,
    tokenId: IdSchema.optional(),
    nome: z.string().trim().min(1).max(64).optional(),
    iniciativa: IniciativaSchema.optional(),
    valorOculto: z.boolean().optional(),
    oculta: z.boolean().optional(),
  })
  .refine((e) => e.tokenId !== undefined || e.nome !== undefined, {
    message: "entrada solta precisa de nome",
  });
const MudancasDaEntradaSchema = z
  .object({
    nome: z.string().trim().min(1).max(64),
    /** `null`: tira o valor (a entrada volta a esperar a rolagem). */
    iniciativa: IniciativaSchema.nullable(),
    valorOculto: z.boolean(),
    oculta: z.boolean(),
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
  /**
   * Lote 9: quem edita o personagem ou o mestre. O navegador junta as mudanças por ~400 ms e manda uma
   * lista de operações `{ caminho, valor }`; a sala aplica, valida a ficha inteira (zod) e recusa acima de
   * 256 KB. `pvAtual` nunca passa de `pvMax`. Caminho vazio troca a ficha inteira (importar).
   */
  intencao(
    "ficha.alterar",
    z.object({
      personagemId: IdSchema,
      operacoes: z.array(OperacaoDeFichaSchema).min(1).max(MAXIMO_DE_OPERACOES),
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
  /** Uma sequência de paredes numa mensagem só (o mestre desenhando). Cena omitida: a ativa. */
  intencao(
    "parede.criar",
    z.object({
      cenaId: IdSchema.optional(),
      paredes: z.array(ParedeNovaSchema).min(1).max(MAXIMO_DE_PAREDES_POR_MENSAGEM),
    }),
  ),
  /** Mudar as pontas, o tipo ou o estado. Porta sem estado nasce fechada; outro tipo perde o estado. */
  intencao(
    "parede.editar",
    z.object({
      id: IdSchema,
      a: PontoSchema.optional(),
      b: PontoSchema.optional(),
      tipo: TipoDeParedeSchema.optional(),
      estado: EstadoDePortaSchema.optional(),
    }),
  ),
  intencao("parede.apagar", z.object({ id: IdSchema })),
  /**
   * Iluminação de uma cena: liga ou desliga a iluminação dinâmica (a visão por paredes dos jogadores),
   * muda a luz ambiente (0 a 1) e o fator geral das fontes (0 a 1). Só muda o que vier no pedido.
   */
  intencao(
    "cena.configurarIluminacao",
    z.object({
      cenaId: IdSchema.optional(),
      dinamica: z.boolean().optional(),
      luzAmbiente: CenaSchema.shape.luzAmbiente.unwrap().optional(),
      fatorDeLuz: CenaSchema.shape.fatorDeLuz.unwrap().optional(),
    }),
  ),
  /** Cria uma fonte de luz fixa (na cena ou presa a um token da cena). Cena omitida: a ativa. */
  intencao("fonte.criar", z.object({ cenaId: IdSchema.optional(), fonte: FonteNovaSchema })),
  /** Muda nome, luz (raios, cor, tremular), intensidade, estado ou portador (mover a luz fixa). */
  intencao("fonte.editar", z.object({ id: IdSchema, mudancas: MudancasDaFonteSchema })),
  intencao("fonte.apagar", z.object({ id: IdSchema })),
  /** Parâmetros da iluminação e da memória do mapa (só o que vier muda). */
  intencao("config.iluminacao", z.object({ mudancas: ConfigIluminacaoSchema.partial() })),
  /** Configuração da mesa (mãos, penalidade, alcance, tempo para jogadores, estágios). */
  intencao("config.mesa", z.object({ mudancas: MudancasDaMesaSchema })),
  /** Pausa ou retoma a mesa: o relógio da sala (tochas, estágios) congela ou volta a correr. */
  intencao("mesa.pausar", SemDados),
  intencao("mesa.retomar", SemDados),
  /** V1: zera o número da pílula do topo (um marco no tempo da sala). Não mexe nas tochas. */
  intencao("mesa.zerarRelogio", SemDados),
  /** Modelos de objeto de luz (Tocha 5e, Lanterna, Fogueira...). */
  intencao("modelo.criar", z.object({ modelo: ModeloDeObjetoSchema })),
  intencao("modelo.editar", z.object({ id: IdSchema, mudancas: MudancasDoModeloSchema })),
  /** Só modelo sem objeto nem mochila que o use. */
  intencao("modelo.apagar", z.object({ id: IdSchema })),
  /** Pontos de luz (suporte e inflamável). Cena omitida: a ativa. */
  intencao("ponto.criar", z.object({ cenaId: IdSchema.optional(), ponto: PontoNovoSchema })),
  intencao("ponto.editar", z.object({ id: IdSchema, mudancas: MudancasDoPontoSchema })),
  /** Apagar o ponto apaga os objetos que estão nele. */
  intencao("ponto.apagar", z.object({ id: IdSchema })),
  /**
   * Acende um objeto da mochila na mão do personagem: um usado (`objetoId`) ou um novo (`novoId` é o
   * id do objeto que nasce; sai da quantidade da mochila). Dono do personagem ou mestre.
   */
  intencao(
    "tocha.acender",
    z.object({
      personagemId: IdSchema,
      modeloId: IdSchema,
      objetoId: IdSchema.optional(),
      novoId: IdSchema.optional(),
    }),
  ),
  /** Apaga (desconta a penalidade) ou reacende (com o mesmo saldo) o objeto: na mão ou num ponto. */
  intencao("tocha.alternar", z.object({ id: IdSchema })),
  /** Guarda a tocha da mão na mochila (apagando-a antes, se estiver acesa). */
  intencao("tocha.guardar", z.object({ id: IdSchema })),
  /** Entrega a tocha da mão para a mão livre de outro token, dentro do alcance. O saldo vai junto. */
  intencao("tocha.entregar", z.object({ id: IdSchema, tokenId: IdSchema })),
  /** Põe a tocha da mão num suporte com espaço, dentro do alcance. */
  intencao("tocha.posar", z.object({ id: IdSchema, pontoId: IdSchema })),
  /** Tira a tocha de um suporte para a mão livre do personagem (dentro do alcance). */
  intencao("ponto.pegar", z.object({ id: IdSchema, personagemId: IdSchema })),
  /**
   * Segurar a tocha acesa sobre um ponto inflamável: `Inicio` marca o instante (pelo relógio da sala);
   * `Fim` só vale se passaram `segurarS`, com a tocha ainda acesa e ao alcance.
   */
  intencao("ponto.acenderInicio", z.object({ pontoId: IdSchema, objetoId: IdSchema })),
  intencao("ponto.acenderFim", z.object({ pontoId: IdSchema, objetoId: IdSchema })),
  /** Ajustes individuais do mestre num objeto de luz (tempo, modificador de raio, consumir). */
  intencao("objeto.ajustar", z.object({ id: IdSchema, ajuste: AjusteDoObjetoSchema })),
  /** Mestre: muda a quantidade de objetos novos de um modelo na mochila. */
  intencao(
    "mochila.ajustar",
    z.object({
      personagemId: IdSchema,
      modeloId: IdSchema,
      delta: z.number().int().min(-99).max(99),
    }),
  ),
  /** Manda todos os navegadores esquecerem a memória do mapa de uma cena (omitida: a ativa). */
  intencao("memoria.esquecer", z.object({ cenaId: IdSchema.optional() })),
  /**
   * Abre ou fecha uma porta. Jogador: só `porta` destrancada, com um token dele ao alcance. Mestre:
   * qualquer porta (inclusive a secreta e a trancada, que abre).
   */
  intencao("porta.alternar", z.object({ id: IdSchema })),
  /**
   * Chat (Lote 8). Só a NOTAÇÃO viaja: qualquer resultado que o cliente mande é descartado pelo schema
   * (zod ignora o que não está declarado) e a sala rola de novo. `como` é um personagem que quem fala
   * edita (o mestre: qualquer um).
   */
  /**
   * Magia do compêndio no chat (Lote 14): a magia vai inteira (com os limites do formato) e a sala a
   * publica como mensagem `magia`. `como` é um personagem que quem fala edita.
   */
  intencao("chat.magia", z.object({ magia: MagiaDoCompendioSchema, como: IdSchema.optional() })),
  intencao(
    "chat.enviar",
    z.object({
      texto: z.string().min(1).max(LIMITES_DO_CHAT.caracteres, TEXTO_DO_CHAT_MAX),
      como: IdSchema.optional(),
    }),
  ),
  /** Rola uma expressão (dados rápidos). `oculta` só vale para o mestre ou com `dado.rolarOculto`. */
  intencao(
    "dado.rolar",
    z.object({
      expressao: z.string().min(1).max(LIMITES_DE_DADOS.caracteres),
      oculta: z.boolean().optional(),
      como: IdSchema.optional(),
    }),
  ),
  /** Modelo de rolagem: ataque (acerto + dano) ou teste (com CD opcional). */
  intencao("chat.modelo", PedidoDeModeloSchema),
  /** Pede mensagens mais antigas que `antesDoSeq`; a resposta (`chat.anteriores`) vem só para quem pediu. */
  intencao("chat.anteriores", z.object({ antesDoSeq: z.number().int().positive() })),
  /** Só o mestre: apaga o histórico do chat. */
  intencao("chat.limpar", SemDados),
  /**
   * Combate (Lote 11). Tudo do mestre (`combate.gerir`), menos `combate.rolar` (o mestre rola para
   * todos ou para algumas entradas; o jogador, só a do personagem que ele edita) e `combate.passar`
   * (quem edita o personagem da vez). A vez é sempre o id da entrada.
   */
  intencao(
    "combate.adicionar",
    z.object({ entradas: z.array(EntradaNovaSchema).min(1).max(LIMITES_DO_COMBATE.entradas) }),
  ),
  intencao("combate.tirar", z.object({ id: IdSchema })),
  intencao("combate.editar", z.object({ id: IdSchema, mudancas: MudancasDaEntradaSchema })),
  /** Arrasto à mão: a entrada vai para a posição `indice` da lista. */
  intencao("combate.mover", z.object({ id: IdSchema, indice: z.number().int().min(0).max(1000) })),
  /** Volta a lista à ordem pelos valores. */
  intencao("combate.ordenar", SemDados),
  /**
   * Rola a iniciativa. Mestre sem `ids`: de todos que ainda não têm valor; com `ids`: dessas entradas
   * (de novo, se já tinham). Jogador: `ids` obrigatório, só entradas dos tokens que ele controla e
   * que ainda não têm valor. As de NPC vão ocultas para o chat.
   */
  intencao("combate.rolar", z.object({ ids: z.array(IdSchema).min(1).max(200).optional() })),
  intencao("combate.proximo", SemDados),
  intencao("combate.anterior", SemDados),
  /** Passa o turno da entrada da vez (quem edita o personagem dela; o mestre também pode). */
  intencao("combate.passar", SemDados),
  /** Limpa a lista e a rodada. */
  intencao("combate.encerrar", SemDados),
  /**
   * V2: entra na ordem de turno. A sala rola 1d20 + a iniciativa da ficha do token (o cliente não manda o
   * número), manda a rolagem ao chat e põe o token na lista. Vale só com a ordem aberta, para o mestre
   * (qualquer token) ou para quem controla o token; o token tem de estar na cena ativa e fora da lista.
   */
  intencao("combate.entrar", z.object({ tokenId: IdSchema })),
  /** V2: o mestre escreve a rodada (0 = ainda não começou). */
  intencao("combate.rodada", z.object({ rodada: z.number().int().min(0).max(9999) })),
  /** V2: o mestre dá a vez a uma entrada (a rodada não muda; começa na rodada 1 se ainda não tinha começado). */
  intencao("combate.darVez", z.object({ id: IdSchema })),
  /**
   * Condições, exaustão e concentração de um token (Lote 11): o mestre ou quem edita o personagem do
   * token. Só muda o que vier: `condicoes` troca a lista inteira, `exaustao` 0 tira, `concentracao`
   * `null` tira.
   */
  intencao(
    "token.condicoes",
    z.object({
      id: IdSchema,
      condicoes: z.array(CondicaoSchema).max(14).optional(),
      exaustao: z.number().int().min(0).max(6).optional(),
      concentracao: z.string().trim().min(1).max(64).nullable().optional(),
    }),
  ),
  /**
   * Pincel (Lote 13). Todas (menos `limpar`) pedem `desenho.criar`; o jogador desenha na cena ativa e só
   * mexe nos próprios desenhos; o mestre, em qualquer cena e em todos. `criar` leva o id que o rascunho
   * já usava. `mover` desloca o desenho inteiro (a sala o mantém dentro da cena). `voltar` apaga o
   * desenho mais recente de quem pede, na cena. `limpar` (mestre) apaga todos os desenhos da cena.
   */
  intencao("desenho.criar", z.object({ desenho: DesenhoNovoSchema })),
  intencao(
    "desenho.mover",
    z.object({ id: IdSchema, dx: z.number().finite(), dy: z.number().finite() }),
  ),
  intencao(
    "desenho.apagar",
    z.object({ ids: z.array(IdSchema).min(1).max(LIMITES_DO_DESENHO.apagarPorVez) }),
  ),
  intencao("desenho.voltar", z.object({ cenaId: IdSchema.optional() })),
  intencao("desenho.limpar", z.object({ cenaId: IdSchema.optional() })),
  /**
   * Traço em andamento: só repassado a quem recebe a cena (não é gravado; a sala descarta os que vêm
   * rápido demais). `desenho: null` cancela (o rascunho some para os outros).
   */
  intencao(
    "desenho.rascunho",
    z.object({ id: IdSchema, desenho: DesenhoEmAndamentoSchema.nullable() }),
  ),
  /**
   * Só o mestre: define o compêndio da mesa (o asset `compendio` já registrado por ele) ou, com `null`,
   * tira. O arquivo nunca vai ao servidor; só a referência.
   */
  intencao("compendio.definir", z.object({ compendio: CompendioDaMesaSchema.nullable() })),
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
  "parede.criar": "cena.editar",
  "parede.editar": "cena.editar",
  "parede.apagar": "cena.editar",
  "cena.configurarIluminacao": "cena.editar",
  "fonte.criar": "cena.editar",
  "fonte.editar": "cena.editar",
  "fonte.apagar": "cena.editar",
  "config.iluminacao": "mesa.configurar",
  "config.mesa": "mesa.configurar",
  "mesa.pausar": "mesa.configurar",
  "mesa.retomar": "mesa.configurar",
  "mesa.zerarRelogio": "mesa.configurar",
  "modelo.criar": "mesa.configurar",
  "modelo.editar": "mesa.configurar",
  "modelo.apagar": "mesa.configurar",
  "ponto.criar": "cena.editar",
  "ponto.editar": "cena.editar",
  "ponto.apagar": "cena.editar",
  "tocha.acender": "tocha.acender",
  // Mão: `tocha.acender`; ponto: `luz.apagar` (apagar) ou `ponto.usar` (reacender). `processar` confere.
  "tocha.alternar": null,
  "tocha.guardar": "tocha.acender",
  "tocha.entregar": "tocha.entregar",
  "tocha.posar": "tocha.entregar",
  "ponto.pegar": "ponto.usar",
  "ponto.acenderInicio": "ponto.usar",
  "ponto.acenderFim": "ponto.usar",
  "objeto.ajustar": "objeto.ajustar",
  "mochila.ajustar": "objeto.ajustar",
  "memoria.esquecer": "mesa.configurar",
  "porta.alternar": "porta.abrir",
  // Todos falam, rolam e leem o próprio histórico; o oculto (`dado.rolarOculto`) é conferido dentro.
  "chat.enviar": null,
  "dado.rolar": null,
  "chat.modelo": null,
  "chat.magia": null,
  "chat.anteriores": null,
  "chat.limpar": "mesa.configurar",
  // Mestre: rola para todos ou para algumas entradas; jogador: a própria. `processar` confere.
  "combate.rolar": null,
  "combate.passar": null,
  "combate.adicionar": "combate.gerir",
  "combate.tirar": "combate.gerir",
  "combate.editar": "combate.gerir",
  "combate.mover": "combate.gerir",
  "combate.ordenar": "combate.gerir",
  "combate.proximo": "combate.gerir",
  "combate.anterior": "combate.gerir",
  "combate.encerrar": "combate.gerir",
  // V2: o jogador entra com o token que controla (a sala confere); o mestre escreve a rodada e dá a vez.
  "combate.entrar": null,
  "combate.rodada": "combate.gerir",
  "combate.darVez": "combate.gerir",
  // Mestre ou quem edita o personagem do token: `processar` confere.
  "token.condicoes": null,
  "desenho.criar": "desenho.criar",
  "desenho.mover": "desenho.criar",
  "desenho.apagar": "desenho.criar",
  "desenho.voltar": "desenho.criar",
  "desenho.limpar": "cena.editar",
  "desenho.rascunho": "desenho.criar",
  "compendio.definir": "mesa.configurar",
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
  /**
   * O combate inteiro depois da mudança (o cliente troca o dele; `null`: o combate acabou). Para o
   * jogador já vem filtrado: só as entradas que ele vê, sem Destreza e com "?" no lugar do valor oculto.
   */
  eventoDe("combate.alterado", z.object({ combate: CombateSchema.nullable() })),
  /**
   * Desenhos do pincel (Lote 13). O jogador só recebe os da cena ativa. `desenho.movido` traz os pontos
   * novos; `desenho.limpo` apaga todos os da cena.
   */
  eventoDe("desenho.criado", z.object({ desenho: DesenhoSchema })),
  eventoDe("desenho.movido", z.object({ id: IdSchema, pontos: DesenhoBaseSchema.shape.pontos })),
  eventoDe("desenho.apagado", z.object({ id: IdSchema })),
  eventoDe("desenho.limpo", z.object({ cenaId: IdSchema })),
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
  /**
   * Parede inteira depois da mudança (o cliente faz upsert). Para o jogador a porta secreta já vem
   * disfarçada; mudança que ele não percebe (trancar a secreta) nem chega.
   */
  eventoDe("parede.criada", z.object({ parede: ParedeSchema })),
  eventoDe("parede.editada", z.object({ parede: ParedeSchema })),
  eventoDe("parede.apagada", z.object({ id: IdSchema })),
  /**
   * Fonte de luz inteira depois da mudança (o cliente faz upsert). O jogador só recebe as da cena
   * ativa e sem a de token que ele não vê; a que deixa de ser visível chega como `fonte.apagada`.
   */
  eventoDe("fonte.criada", z.object({ fonte: ObjetoDeLuzSchema })),
  eventoDe("fonte.editada", z.object({ fonte: ObjetoDeLuzSchema })),
  eventoDe("fonte.apagada", z.object({ id: IdSchema })),
  /** A mesa foi pausada: o tempo da sala fica em `salaMs` (o jogador recebe 0). */
  eventoDe("mesa.pausada", z.object({ salaMs: z.number().nonnegative() })),
  /** A mesa voltou a correr a partir de `salaMs` (o jogador recebe 0). */
  eventoDe(
    "mesa.retomada",
    z.object({ salaMs: z.number().nonnegative(), desdeReal: z.number().nonnegative().optional() }),
  ),
  /**
   * V1: o relógio da pílula foi zerado. `salaMs` é o tempo da sala na hora (vira o marco e o novo
   * acumulado); `desdeReal` só com a mesa rodando. Só o mestre recebe este evento.
   */
  eventoDe(
    "mesa.relogioZerado",
    z.object({ salaMs: z.number().nonnegative(), desdeReal: z.number().nonnegative().optional() }),
  ),
  /** Modelo inteiro depois da mudança (o cliente faz upsert). */
  eventoDe("modelo.alterado", z.object({ modelo: ModeloDeObjetoSchema })),
  eventoDe("modelo.apagado", z.object({ id: IdSchema })),
  /**
   * Ponto de luz inteiro depois da mudança. O jogador só recebe os visíveis da cena ativa; o que
   * deixa de ser visível chega como `ponto.apagado`.
   */
  eventoDe("ponto.alterado", z.object({ ponto: PontoDeLuzSchema })),
  eventoDe("ponto.apagado", z.object({ id: IdSchema })),
  /** Configuração da mesa inteira depois da mudança. Todos recebem. */
  eventoDe("config.alterada", z.object({ config: ConfigDaMesaSchema })),
  /** O mestre mandou esquecer a memória da cena; `versao` é o `seq` do evento. Jogador: só a cena ativa. */
  eventoDe(
    "memoria.esquecida",
    z.object({ cenaId: IdSchema, versao: z.number().int().positive() }),
  ),
  /** O compêndio da mesa mudou (`null`: sem compêndio). Todos recebem; é só a referência ao asset. */
  eventoDe("compendio.alterado", z.object({ compendio: CompendioDaMesaSchema.nullable() })),
  /** Uma mensagem do chat, filtrada: quem não pode vê-la nunca a recebe. */
  eventoDe("chat.mensagem", z.object({ mensagem: MensagemSchema })),
  /** O mestre limpou o chat: todos esvaziam a conversa. */
  eventoDe("chat.limpo", SemDados),
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
  "parede_inexistente",
  "porta_inexistente",
  "porta_trancada",
  "fora_de_alcance",
  "trajeto_bloqueado",
  "fonte_inexistente",
  "ponto_inexistente",
  "modelo_inexistente",
  "maos_cheias",
  "suporte_cheio",
  "segurar_incompleto",
  "muitas_mensagens",
  "desenho_inexistente",
  "limite_de_desenhos",
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
  /** Traço em andamento de outra pessoa (transitório: sem `seq`, não é gravado; nunca vai ao autor). */
  mensagemDaSala("desenho.rascunhando", z.object({ desenho: DesenhoSchema })),
  /** O autor soltou, cancelou ou saiu: o rascunho some. */
  mensagemDaSala("desenho.rascunhoFim", z.object({ id: IdSchema })),
  /** Meta de um asset que o cliente pediu e pode ver (sob demanda; nunca em broadcast). */
  mensagemDaSala("asset.meta", z.object({ meta: AssetMetaSchema })),
  /** Pedido da sala ao provedor: mande estes pedaços (frames binários) de `hash`. */
  mensagemDaSala(
    "asset.enviar",
    z.object({ hash: HashSchema, indices: z.array(z.number().int().nonnegative()).max(200) }),
  ),
  /** Ninguém online tem o arquivo; a sala retoma sozinha quando alguém com cópia conectar. */
  mensagemDaSala("asset.indisponivel", z.object({ hash: HashSchema })),
  /** Resposta de `chat.anteriores`: só para quem pediu, já filtrada para ele. */
  mensagemDaSala(
    "chat.anteriores",
    z.object({
      mensagens: z.array(MensagemSchema).max(LIMITES_DO_CHAT.porPagina),
      temMais: z.boolean(),
    }),
  ),
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
