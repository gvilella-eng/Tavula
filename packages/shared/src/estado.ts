import { z } from "zod";
import { AssetMetaSchema, HashSchema } from "./assets.ts";
import { AutomacoesSchema, EfeitoSchema, MAXIMO_DE_EFEITOS } from "./automacoes.ts";
import { CAPACIDADES_DELEGAVEIS } from "./capacidades.ts";
import { MensagemSchema } from "./chat.ts";
import { CombateSchema } from "./combate.ts";
import { CompendioDaMesaSchema } from "./compendio.ts";
import { CondicaoSchema } from "./condicoes.ts";
import { DesenhoSchema } from "./desenho.ts";
import { FichaSchema } from "./ficha.ts";
import { MAXIMO_DE_ZONAS, ZonaSchema } from "./zonas.ts";

export const PAPEIS = ["mestre", "jogador", "assistente"] as const;
export const PapelSchema = z.enum(PAPEIS);
export type Papel = z.infer<typeof PapelSchema>;

export const UsuarioSchema = z.object({
  id: z.string().min(1).max(64),
  nome: z.string().min(1).max(64),
  papel: PapelSchema,
  cor: z.string().min(1).max(32),
});
export type Usuario = z.infer<typeof UsuarioSchema>;

const CapacidadeDelegavelSchema = z.enum(CAPACIDADES_DELEGAVEIS);

export const PermissoesSchema = z.object({
  /** Padrão da mesa para os jogadores. */
  jogadores: z.record(CapacidadeDelegavelSchema, z.boolean()),
  /** Exceções por usuário (só capacidades delegáveis). */
  porUsuario: z.record(z.string(), z.partialRecord(CapacidadeDelegavelSchema, z.boolean())),
});
export type Permissoes = z.infer<typeof PermissoesSchema>;

/** Tamanho máximo de um texto longo (o texto de um handout; antes, as notas da mesa e do mestre). */
export const TAMANHO_MAXIMO_NOTA = 20_000;

/**
 * Camadas de objetos do mapa, de baixo para cima: `mapa` (cenário: o jogador vê, não seleciona nem
 * move), `tokens` e `mestre` (só o mestre vê). Os desenhos do pincel (Lote 13) não são uma camada de
 * token: moram na coleção `desenhos`, por cima de tudo.
 */
export const CAMADAS = ["mapa", "tokens", "mestre"] as const;
export const CamadaSchema = z.enum(CAMADAS);
export type Camada = z.infer<typeof CamadaSchema>;

export const GridSchema = z.object({
  /** Lado de um quadrado, em metros (padrão do 5e: 1,5). */
  quadradoM: z.number().min(0.3).max(10),
  visivel: z.boolean(),
});
export type Grid = z.infer<typeof GridSchema>;

export const MapaDaCenaSchema = z.object({
  /** Asset do mapa (o arquivo ou, se fatiado, o manifesto). */
  assetHash: HashSchema,
  /** Pixels da imagem por quadrado do grid: metros = px ÷ pxPorQuadrado × quadradoM. */
  pxPorQuadrado: z.number().min(10).max(1000),
});
export type MapaDaCena = z.infer<typeof MapaDaCenaSchema>;

export const CenaSchema = z.object({
  id: z.string().min(1).max(64),
  nome: z.string().min(1).max(64),
  larguraM: z.number().positive().max(1000),
  alturaM: z.number().positive().max(1000),
  grid: GridSchema,
  mapa: MapaDaCenaSchema.optional(),
  /** Onde o grupo chega ao ser levado para esta cena, em metros (padrão: o centro). */
  chegada: z.object({ x: z.number().min(0), y: z.number().min(0) }).optional(),
  /**
   * Iluminação dinâmica (Lote 5): os jogadores só veem o que os tokens deles enxergam, respeitando as
   * paredes. Sem o campo vale ligada; desligada, veem a cena inteira (menos a camada do mestre).
   */
  iluminacaoDinamica: z.boolean().optional(),
  /**
   * Luz ambiente (Lote 6): 0 = escuridão total, 1 = dia. Soma uma luz uniforme na cena. Sem o campo
   * vale 1, para não escurecer campanhas antigas sem aviso.
   */
  luzAmbiente: z.number().min(0).max(1).optional(),
  /** Fator geral das fontes de luz da cena (o slider do topo do painel): 0 a 1; sem o campo vale 1. */
  fatorDeLuz: z.number().min(0).max(1).optional(),
  /**
   * V5: os jogadores veem as linhas de parede, janela e porta desta cena. Sem o campo (toda cena
   * antiga) vale desligado: só o mestre vê os contornos. Não muda visão, luz nem bloqueio.
   */
  mostrarParedesAosJogadores: z.boolean().optional(),
  /**
   * V10c: a cena é um cartão (imagem de fundo, mapa de cidade): todos veem a imagem inteira, sem névoa,
   * escuridão nem limite de visão, e paredes, portas e luz ficam guardadas sem efeito. Sem o campo é
   * mapa, como sempre foi; voltar a ser mapa devolve tudo.
   */
  cartao: z.boolean().optional(),
});
export type Cena = z.infer<typeof CenaSchema>;

export const TokenSchema = z.object({
  id: z.string().min(1).max(64),
  cenaId: z.string().min(1).max(64),
  nome: z.string().min(1).max(64),
  cor: z.string().min(1).max(32),
  tamanhoQuadrados: z.number().int().min(1).max(4),
  /** Centro do token, em metros. */
  x: z.number(),
  y: z.number(),
  camada: CamadaSchema,
  oculto: z.boolean(),
  controladoPor: z.array(z.string().min(1).max(64)).max(32),
  /** Imagem do token (asset do tipo token ou retrato); sem ela vale o círculo gerado. */
  assetHash: HashSchema.optional(),
  /**
   * Personagem que este token representa. O token guarda a PRÓPRIA cópia de nome, cor e imagem
   * (tirada do token padrão ao ser colocado): mudar o personagem não muda os tokens já postos.
   */
  personagemId: z.string().min(1).max(64).optional(),
  /**
   * Alcance de visão, em metros, de um token SEM personagem (o mestre define no painel do token).
   * Token de personagem usa `visao.alcanceM` do personagem. Sem o campo, sem limite.
   */
  alcanceVisaoM: z.number().positive().max(1000).optional(),
  /** Visão no escuro, em metros, de um token SEM personagem (Lote 6). Sem o campo vale 0. */
  visaoNoEscuroM: z.number().min(0).max(1000).optional(),
  /** Condições do 5e (Lote 11): marcas no token, sem regra automática. Sem o campo, nenhuma. */
  condicoes: z.array(CondicaoSchema).max(14).optional(),
  /** Nível de exaustão, de 1 a 6 (sem o campo, nenhum). */
  exaustao: z.number().int().min(1).max(6).optional(),
  /** Concentração: o nome da magia mantida (sem o campo, não concentra). */
  concentracao: z.string().trim().min(1).max(64).optional(),
});
export type Token = z.infer<typeof TokenSchema>;

export const PontoSchema = z.object({ x: z.number(), y: z.number() });
export type Ponto = z.infer<typeof PontoSchema>;

/** Luz de uma fonte: raio da luz plena e da penumbra (a penumbra começa onde a plena acaba). */
export const LuzSchema = z.object({
  claraM: z.number().min(0).max(500),
  penumbraM: z.number().min(0).max(500),
  /** Cor da luz, `#rrggbb`. */
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  tremula: z.boolean(),
});
export type Luz = z.infer<typeof LuzSchema>;

/** Estágios de um objeto de luz com tempo (a tocha "morrendo" tremula mais). */
export const ESTAGIOS = ["forte", "fraca", "morrendo"] as const;
export const EstagioSchema = z.enum(ESTAGIOS);
export type Estagio = z.infer<typeof EstagioSchema>;

const IdCurto = z.string().min(1).max(64);

/**
 * De onde a luz sai. `cena`: fixa no mapa. `token`: a criatura que brilha (o "próprio" da 4.1).
 * `mao`: a mão de um personagem (a luz sai do token dele na cena ativa). `mochila`: guardada (não
 * ilumina). `ponto`: num suporte ou inflamável do mapa.
 */
export const PortadorDeLuzSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("cena"), x: z.number(), y: z.number() }),
  z.object({ tipo: z.literal("token"), tokenId: IdCurto }),
  z.object({ tipo: z.literal("mao"), personagemId: IdCurto, mao: z.number().int().min(0).max(9) }),
  z.object({ tipo: z.literal("mochila"), personagemId: IdCurto }),
  z.object({ tipo: z.literal("ponto"), pontoId: IdCurto }),
]);
export type PortadorDeLuz = z.infer<typeof PortadorDeLuzSchema>;

/** Só os portadores que o mestre escolhe direto numa fonte fixa (o resto nasce do jogo). */
export const PortadorFixoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("cena"), x: z.number(), y: z.number() }),
  z.object({ tipo: z.literal("token"), tokenId: IdCurto }),
]);
export type PortadorFixo = z.infer<typeof PortadorFixoSchema>;

/** Efeito do mestre sobre a luz: multiplica luz plena e penumbra, com ou sem prazo no relógio da sala. */
export const ModificadorSchema = z.object({
  id: IdCurto,
  /** Multiplica os dois raios (1 = não muda). */
  raioX: z.number().min(0.1).max(5).default(1),
  /** 7b-1: soma metros aos dois raios, depois do `raioX` (valor final = base × Πraiox + Σsoma). */
  raioSomaM: z.number().min(-100).max(100).optional(),
  /** Fim, em milissegundos do relógio da sala; sem fim vale até o mestre tirar. */
  ateSala: z.number().nonnegative().optional(),
  origem: z.enum(["mestre", "automacao"]),
  nota: z.string().max(200).optional(),
});
export type Modificador = z.infer<typeof ModificadorSchema>;

export const ItemDeHistoricoSchema = z.object({
  /** Instante no relógio da sala (ms). */
  emSala: z.number().nonnegative(),
  deltaMs: z.number().optional(),
  texto: z.string().max(200),
});
export type ItemDeHistorico = z.infer<typeof ItemDeHistoricoSchema>;

export const MAXIMO_DE_HISTORICO = 40;

/**
 * Objeto de luz (4.8): a tocha, a fogueira, a luz fixa do mapa, a criatura que brilha. É a evolução
 * da fonte de luz do Lote 6 (mesma coleção `luzes`). `intensidade` multiplica os dois raios (0 a 1).
 *
 * Dois formatos de uma coisa só. **Na sala** o objeto traz `saldoMs` (tempo que sobra; `null` = não
 * se consome) e `acesaDesdeSala` (instante no relógio da sala em que a contagem começou). **No
 * navegador** esses dois campos NUNCA aparecem (nem para o mestre): a sala manda `restanteMs`
 * (calculado na hora do envio), `contando` (acesa, com tempo e a mesa rodando) e `estagio`, filtrados
 * por `ConfigDaMesa.tempoParaJogadores` para quem não é mestre.
 */
export const ObjetoDeLuzSchema = z.object({
  id: IdCurto,
  /** Cena de uma luz `cena` ou `token`; nos demais portadores a cena vem de quem carrega. */
  cenaId: IdCurto.optional(),
  nome: z.string().min(1).max(64),
  modeloId: IdCurto.optional(),
  portador: PortadorDeLuzSchema,
  luz: LuzSchema,
  intensidade: z.number().min(0).max(1),
  estado: z.enum(["acesa", "apagada"]),
  // --- só na sala ---
  saldoMs: z.number().nonnegative().nullable().optional(),
  acesaDesdeSala: z.number().nonnegative().optional(),
  /** Duração total do modelo, para o cálculo dos estágios. Na sala e para o mestre. */
  duracaoMs: z.number().positive().nullable().optional(),
  modificadores: z.array(ModificadorSchema).max(20).default([]),
  historico: z.array(ItemDeHistoricoSchema).max(MAXIMO_DE_HISTORICO).default([]),
  // --- só no navegador (calculados no envio) ---
  restanteMs: z.number().nonnegative().optional(),
  contando: z.boolean().optional(),
  estagio: EstagioSchema.optional(),
  /** Produto dos modificadores de raio que valem agora (o jogador não recebe a lista). */
  fatorDeRaio: z.number().positive().optional(),
  /** 7b-1: soma dos `raioSomaM` que valem agora, em metros (o jogador só recebe este total). */
  somaDeRaioM: z.number().min(-1000).max(1000).optional(),
});
export type ObjetoDeLuz = z.infer<typeof ObjetoDeLuzSchema>;
/** Nome do Lote 6, mantido porque muita coisa (mapa, painel) o usa. */
export const FonteDeLuzSchema = ObjetoDeLuzSchema;
export type FonteDeLuz = ObjetoDeLuz;

/**
 * Fonte de luz como era até o Lote 6 (exportação v7 e banco antigo): `acesa` em vez de `estado`, sem
 * tempo, modelo, modificadores nem histórico.
 */
export const FonteDeLuzAntigaSchema = z.object({
  id: IdCurto,
  cenaId: IdCurto,
  nome: z.string().min(1).max(64),
  portador: PortadorFixoSchema,
  luz: LuzSchema,
  intensidade: z.number().min(0).max(1),
  acesa: z.boolean(),
});

/** Converte a fonte do Lote 6: acesa vira `estado`, sem consumo, sem modificadores e histórico. */
export function migrarFonteAntiga(f: z.infer<typeof FonteDeLuzAntigaSchema>): ObjetoDeLuz {
  const { acesa, ...resto } = f;
  return {
    ...resto,
    estado: acesa ? "acesa" : "apagada",
    saldoMs: null,
    modificadores: [],
    historico: [],
  };
}

/** Linha vinda do banco (ou de arquivo): já no formato novo, ou ainda com `acesa`. */
export function objetoDoBanco(bruto: unknown): ObjetoDeLuz {
  if (typeof bruto === "object" && bruto !== null && "acesa" in bruto && !("estado" in bruto)) {
    return migrarFonteAntiga(FonteDeLuzAntigaSchema.parse(bruto));
  }
  return ObjetoDeLuzSchema.parse(bruto);
}

/** Modelo de objeto criado pelo mestre na campanha ("Tocha 5e", "Lanterna", "Fogueira"). */
export const ModeloDeObjetoSchema = z.object({
  id: IdCurto,
  nome: z.string().min(1).max(64),
  luz: LuzSchema,
  /** `null` = não se consome. */
  duracaoS: z
    .number()
    .positive()
    .max(100 * 3600)
    .nullable(),
  ocupaMao: z.boolean(),
  /** Ex.: "chama": usadas pelas automações (Lote 7b). */
  tags: z.array(z.string().min(1).max(32)).max(12),
});
export type ModeloDeObjeto = z.infer<typeof ModeloDeObjetoSchema>;

/**
 * Ponto do mapa (a "Ponto" da 4.1; o nome `Ponto` já é a coordenada). `suporte`: onde se solta a
 * tocha. `inflamavel`: segurar a tocha acesa em cima acende o `modeloId` ali.
 */
export const PontoDeLuzSchema = z.object({
  id: IdCurto,
  cenaId: IdCurto,
  nome: z.string().min(1).max(64),
  x: z.number(),
  y: z.number(),
  tipo: z.enum(["suporte", "inflamavel"]),
  /** Suporte: quantos objetos cabem (padrão 1). */
  capacidade: z.number().int().min(1).max(20).optional(),
  /** Inflamável: o que ele vira ao queimar. */
  modeloId: IdCurto.optional(),
  /** Inflamável: segundos segurando a tocha acesa em cima (padrão 3). */
  segurarS: z.number().min(0).max(60).optional(),
  visivelParaJogadores: z.boolean(),
});
export type PontoDeLuz = z.infer<typeof PontoDeLuzSchema>;

export const SEGURAR_PADRAO_S = 3;

/**
 * Relógio da sala (4.8, princípio 6). Pausada: o tempo da sala fica em `acumuladoMs`. Rodando: é
 * `acumuladoMs + (agora − desdeReal)`, pelo relógio da própria sala. No navegador `acumuladoMs` já
 * vem com o tempo da sala na hora do envio e o jogador recebe 0 (só `pausada` importa para ele).
 */
export const RelogioSalaSchema = z.object({
  pausada: z.boolean(),
  acumuladoMs: z.number().nonnegative(),
  desdeReal: z.number().nonnegative().optional(),
  /**
   * V1: o marco do "zerar o relógio" da pílula do topo, em tempo da sala. A pílula mostra
   * `tempoDaSala − marcoMs`; as tochas e tudo o que queima continuam no tempo da sala. Ausente = 0
   * (estado e arquivo antigos). Só o mestre o recebe.
   */
  marcoMs: z.number().nonnegative().optional(),
});
export type RelogioSala = z.infer<typeof RelogioSalaSchema>;

/** Parâmetros da iluminação e da memória do mapa (`ConfigDaMesa.iluminacao`). */
export const ConfigIluminacaoSchema = z.object({
  memoriaLigada: z.boolean(),
  /** `inteligencia`: base + por modificador × mod; `fixo`: sempre `memoriaFixaM`. */
  memoriaModo: z.enum(["inteligencia", "fixo"]),
  memoriaBaseM: z.number().min(0).max(1000),
  memoriaPorModM: z.number().min(0).max(100),
  memoriaFixaM: z.number().min(0).max(1000),
  /** Cor com que a lembrança aparece (a camada do mapa é escurecida por ela), `#rrggbb`. */
  tomDaMemoria: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type ConfigIluminacao = z.infer<typeof ConfigIluminacaoSchema>;

export const TEMPOS_PARA_JOGADORES = ["exato", "estagio", "oculto"] as const;
export const TempoParaJogadoresSchema = z.enum(TEMPOS_PARA_JOGADORES);
export type TempoParaJogadores = z.infer<typeof TempoParaJogadoresSchema>;

/** Limiares dos estágios: fração da duração do modelo abaixo da qual a luz está fraca / morrendo. */
export const ConfigEstagiosSchema = z.object({
  fraca: z.number().min(0).max(1),
  morrendo: z.number().min(0).max(1),
});
export type ConfigEstagios = z.infer<typeof ConfigEstagiosSchema>;

/** Configuração da mesa, por campanha; só o mestre altera (4.1). */
export const ConfigDaMesaSchema = z.object({
  /** No máximo este tanto de objetos na mão de cada personagem. */
  maosPorPersonagem: z.number().int().min(1).max(6),
  /** Segundos descontados do saldo ao apagar uma luz com tempo. */
  penalidadeAoApagarS: z.number().min(0).max(3600),
  /** Entregar tocha, usar ponto: alcance em metros (distância de quadrados do 5e). */
  alcanceInteracaoM: z.number().min(0).max(30),
  /** O que o jogador vê do tempo; o mestre sempre vê o exato. */
  tempoParaJogadores: TempoParaJogadoresSchema,
  estagios: ConfigEstagiosSchema,
  iluminacao: ConfigIluminacaoSchema,
});
export type ConfigDaMesa = z.infer<typeof ConfigDaMesaSchema>;

export const CONFIG_ILUMINACAO_PADRAO: ConfigIluminacao = {
  memoriaLigada: true,
  memoriaModo: "inteligencia",
  memoriaBaseM: 15,
  memoriaPorModM: 3,
  memoriaFixaM: 15,
  tomDaMemoria: "#6a7791",
};

export const CONFIG_PADRAO: ConfigDaMesa = {
  maosPorPersonagem: 2,
  penalidadeAoApagarS: 0,
  alcanceInteracaoM: 1.5,
  tempoParaJogadores: "exato",
  estagios: { fraca: 0.5, morrendo: 0.1 },
  iluminacao: CONFIG_ILUMINACAO_PADRAO,
};

const semIndefinido = (o: object) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** Configuração gravada no banco (ou vinda de arquivo) com o que faltar preenchido pelo padrão. */
export function configComPadrao(bruta: unknown): ConfigDaMesa {
  const obj = typeof bruta === "object" && bruta !== null ? (bruta as Record<string, unknown>) : {};
  const ilum = ConfigIluminacaoSchema.partial().safeParse(obj.iluminacao ?? {});
  const est = ConfigEstagiosSchema.partial().safeParse(obj.estagios ?? {});
  const geral = ConfigDaMesaSchema.omit({ iluminacao: true, estagios: true })
    .partial()
    .safeParse(obj);
  return {
    ...CONFIG_PADRAO,
    ...(geral.success ? semIndefinido(geral.data) : {}),
    estagios: { ...CONFIG_PADRAO.estagios, ...(est.success ? semIndefinido(est.data) : {}) },
    iluminacao: {
      ...CONFIG_ILUMINACAO_PADRAO,
      ...(ilum.success ? semIndefinido(ilum.data) : {}),
    },
  };
}

export const TIPOS_DE_PAREDE = ["parede", "porta", "janela", "secreta", "invisivel"] as const;
export const TipoDeParedeSchema = z.enum(TIPOS_DE_PAREDE);
export type TipoDeParede = z.infer<typeof TipoDeParedeSchema>;

export const ESTADOS_DE_PORTA = ["aberta", "fechada", "trancada"] as const;
export const EstadoDePortaSchema = z.enum(ESTADOS_DE_PORTA);
export type EstadoDePorta = z.infer<typeof EstadoDePortaSchema>;

/**
 * Segmento de parede de uma cena, em metros. `estado` só vale para `porta` e `secreta` (as demais
 * não têm). O jogador nunca recebe `secreta` (ver `paredeParaJogador`).
 */
export const ParedeSchema = z.object({
  id: z.string().min(1).max(64),
  cenaId: z.string().min(1).max(64),
  a: PontoSchema,
  b: PontoSchema,
  /**
   * V5: um ponto qualquer do arco entre `a` e `b` (a parede em arco passa por `a`, `meio` e `b`, nessa
   * ordem). Sem o campo a parede é reta (toda parede antiga). Ver `segmentosDaParede`.
   */
  meio: PontoSchema.optional(),
  tipo: TipoDeParedeSchema,
  estado: EstadoDePortaSchema.optional(),
});
export type Parede = z.infer<typeof ParedeSchema>;

/** Quem pode editar um personagem (e controlar o token dele): todos os jogadores ou os escolhidos. */
export const EditoresSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("todos") }),
  z.object({ tipo: z.literal("jogadores"), ids: z.array(z.string().min(1).max(64)).max(32) }),
]);
export type Editores = z.infer<typeof EditoresSchema>;

/** Quem vê uma pasta (e tudo o que está nela) ou um handout. */
export const VisibilidadeSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("todos") }),
  z.object({ tipo: z.literal("mestre") }),
  z.object({ tipo: z.literal("jogadores"), ids: z.array(z.string().min(1).max(64)).max(32) }),
]);
export type Visibilidade = z.infer<typeof VisibilidadeSchema>;

/** Pasta das Fichas: sem subpastas. Quem vê a pasta vê tudo o que há nela. */
export const PastaSchema = z.object({
  id: z.string().min(1).max(64),
  nome: z.string().min(1).max(64),
  ordem: z.number().int().min(0).max(10_000),
  visivel: VisibilidadeSchema,
});
export type Pasta = z.infer<typeof PastaSchema>;

/**
 * As 5 fontes de um handout (V3), todas empacotadas (@fontsource): `simples` é a da interface (Inter), `livro`
 * uma serifada, `manuscrito` uma cursiva legível, `medieval` e `datilografado` as de efeito.
 */
export const FONTES_DE_HANDOUT = [
  "simples",
  "livro",
  "manuscrito",
  "medieval",
  "datilografado",
] as const;
export const FonteDeHandoutSchema = z.enum(FONTES_DE_HANDOUT);
export type FonteDeHandout = z.infer<typeof FonteDeHandoutSchema>;

/**
 * Handout (V3): um título e um texto (puro, com quebras de linha) numa fonte à escolha, com uma imagem
 * pequena opcional (asset local, como o retrato) e quem o vê. O mestre sempre vê; o jogador só recebe o
 * que `visivel` cita (nem o título chega a quem não vê).
 */
export const HandoutSchema = z.object({
  id: z.string().min(1).max(64),
  pastaId: z.string().min(1).max(64),
  titulo: z.string().trim().min(1).max(80),
  texto: z.string().max(TAMANHO_MAXIMO_NOTA),
  fonte: FonteDeHandoutSchema,
  /** Imagem de preview (asset do tipo retrato ou token). */
  imagemHash: HashSchema.optional(),
  visivel: VisibilidadeSchema,
});
export type Handout = z.infer<typeof HandoutSchema>;

export const PersonagemSchema = z.object({
  id: z.string().min(1).max(64),
  pastaId: z.string().min(1).max(64),
  /** "Pode ser controlado e editado por". NPC: nenhum jogador (o mestre edita tudo). */
  editores: EditoresSchema,
  nome: z.string().min(1).max(64),
  /** Retrato (avatar) do item; asset do tipo retrato ou token. */
  retratoHash: HashSchema.optional(),
  tokenPadrao: z.object({
    cor: z.string().min(1).max(32),
    tamanhoQuadrados: z.number().int().min(1).max(4),
    assetHash: HashSchema.optional(),
  }),
  visao: z.object({
    /** `null` = sem limite (visão normal, só a luz decide). */
    alcanceM: z.number().positive().max(1000).nullable(),
    visaoNoEscuroM: z.number().min(0).max(1000),
  }),
  /**
   * Modificador de Inteligência (Lote 6): decide o alcance da memória do mapa. Sem o campo vale 0. Desde o
   * Lote 9 o valor vem do atributo da ficha (`modInteligenciaDoPersonagem`); este campo é a reserva de
   * quem não tem ficha preenchida (e o que um jogador sem `ficha.verOutras` recebe, já calculado).
   */
  modInteligencia: z.number().int().min(-5).max(10).optional(),
  /**
   * Mochila do Lote 7 (modelo → quantidade de novas). SÓ LEITURA do formato antigo: ao carregar o banco ou
   * importar um arquivo ela vira `ficha.itens` com `modeloId` (`absorverMochila`) e some.
   */
  mochila: z.record(IdCurto, z.number().int().min(0).max(99)).optional(),
  /**
   * Ficha 5e (Lote 9). Ausente na visão de um jogador que não edita o personagem e não tem
   * `ficha.verOutras`: o item chega só com o que o mapa e as listas precisam.
   */
  ficha: FichaSchema.optional(),
});
export type Personagem = z.infer<typeof PersonagemSchema>;

/**
 * Estado da campanha. Na visão de um jogador `porUsuario` só tem a entrada dele mesmo, `cenas` só tem a
 * cena ativa e `pastas`/`personagens`/`handouts` só têm o que ele vê. (Até o V2 havia `notaMesa` e
 * `notaMestre`; viraram handouts na migração.)
 */
export const EstadoSchema = z.object({
  seq: z.number().int().nonnegative(),
  usuarios: z.array(UsuarioSchema),
  /**
   * V7, derivado pela sala a cada snapshot (nunca gravado nem exportado): os ids dos usuários que são membros
   * da mesa (o mestre e quem tem conta ativa). Sem o campo todos contam como membros.
   */
  membros: z.array(z.string().min(1).max(64)).optional(),
  permissoes: PermissoesSchema,
  cenas: z.array(CenaSchema).min(1),
  cenaAtivaId: z.string().min(1).max(64),
  /** Na visão de um jogador: sem os tokens ocultos nem os da camada do mestre. */
  tokens: z.array(TokenSchema),
  /**
   * Paredes e portas. Na visão de um jogador: só as da cena ativa, com a porta secreta já disfarçada
   * (fechada vira `parede`, aberta vira `porta` aberta).
   */
  paredes: z.array(ParedeSchema),
  /**
   * Fontes de luz (Lote 6). Na visão de um jogador: só as da cena ativa, sem a de token que ele não vê
   * (oculto ou da camada do mestre).
   */
  luzes: z.array(ObjetoDeLuzSchema),
  /** Modelos de objeto de luz. Na visão de um jogador sem a duração, salvo no modo `exato`. */
  modelos: z.array(ModeloDeObjetoSchema),
  /**
   * Pontos de luz (suportes e inflamáveis). Na visão de um jogador: só os da cena ativa marcados como
   * visíveis.
   */
  pontos: z.array(PontoDeLuzSchema),
  /**
   * Desenhos do pincel (Lote 13). Na visão de um jogador: só os da cena ativa (o mestre recebe todos).
   */
  desenhos: z.array(DesenhoSchema),
  /** Relógio da sala (ver `RelogioSalaSchema`). */
  relogio: RelogioSalaSchema,
  /**
   * Quem começou a segurar a tocha sobre um inflamável: chave `pontoId|usuarioId` → tempo da sala
   * (ms). Transitório: nunca vai para o banco, a exportação nem os navegadores.
   */
  acendimentos: z.record(z.string(), z.number()).optional(),
  /** Configuração da mesa. Todos recebem. */
  config: ConfigDaMesaSchema,
  /**
   * Quando o mestre mandou esquecer a memória de cada cena (o `seq` do evento). O navegador compara
   * com o que ele já aplicou. Na visão de um jogador: só a cena ativa. Não entra na exportação.
   */
  memoriaEsquecida: z.record(z.string(), z.number().int().nonnegative()).optional(),
  /** Na visão de um jogador: só as pastas que ele vê. */
  pastas: z.array(PastaSchema),
  /** Na visão de um jogador: os que ele edita e os das pastas que ele vê. */
  personagens: z.array(PersonagemSchema),
  /** Handouts (V3). Na visão de um jogador: só os que `visivel` cita (e a pasta aparece por causa deles). */
  handouts: z.array(HandoutSchema),
  /** O painel flutuante de ordem de turno aparece para todos? */
  ordemDeTurnoVisivel: z.boolean(),
  /**
   * Combate (Lote 11): a ordem de turno. Sem o campo não há combate. Na visão de um jogador só vêm as
   * entradas que ele vê (ver `combateParaUsuario`).
   */
  combate: CombateSchema.optional(),
  /**
   * Chat (Lote 8). O histórico mora numa tabela própria da sala e nunca fica aqui: a sala monta a
   * visão de cada usuário com as últimas 200 mensagens que ele pode ver. No navegador este campo é a
   * conversa carregada. Não entra na exportação.
   */
  chat: z.array(MensagemSchema).optional(),
  /**
   * Retratos usados em mensagens públicas do chat (só a sala usa, para liberar a imagem a quem lê a
   * mensagem sem ver o personagem). Nunca vai a um jogador nem entra na exportação.
   */
  retratosDoChat: z.array(HashSchema).max(200).optional(),
  /**
   * Compêndio de magias da mesa (Lote 14): só a referência ao asset `compendio` (hash, nome do arquivo e
   * quantas magias). Todos recebem; o texto das magias nunca passa pelo estado nem fica no servidor.
   */
  compendio: CompendioDaMesaSchema.optional(),
  /** Metadados dos assets registrados. Só existe na sala e na visão do mestre (nunca do jogador). */
  assets: z.array(AssetMetaSchema).optional(),
  /**
   * Automações (7b-1, seção 4.11): ciclos, reações e o controle deles. SÓ o mestre recebe (a visão do
   * jogador não traz o campo); entra na exportação. Sem o campo não há automação (campanha antiga).
   */
  automacoes: AutomacoesSchema.optional(),
  /**
   * Efeitos temporários em tokens (7b-1): limite de visão com prazo. O mestre recebe tudo; o jogador, só os
   * dos tokens que vê, sem prazo nem origem. Entra na exportação (o prazo é no tempo da sala).
   */
  efeitos: z.array(EfeitoSchema).max(MAXIMO_DE_EFEITOS).optional(),
  /**
   * Zonas das cenas (7b-2): polígonos com efeitos "enquanto dentro" e reações. SÓ o mestre recebe (a visão do
   * jogador não traz o campo, nem em evento); entra na exportação. Sem o campo não há zona (campanha antiga).
   */
  zonas: z.array(ZonaSchema).max(MAXIMO_DE_ZONAS).optional(),
});
export type Estado = z.infer<typeof EstadoSchema>;

export const PresencaSchema = z.enum(["online", "reconectando", "offline"]);
export type Presenca = z.infer<typeof PresencaSchema>;
