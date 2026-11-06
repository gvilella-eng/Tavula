import { z } from "zod";
import { AssetMetaSchema, HashSchema } from "./assets.ts";
import { CAPACIDADES_DELEGAVEIS } from "./capacidades.ts";

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

export const TAMANHO_MAXIMO_NOTA = 20_000;

/**
 * Camadas de objetos do mapa, de baixo para cima: `mapa` (cenário: o jogador vê, não seleciona nem
 * move), `tokens` e `mestre` (só o mestre vê). A camada de desenho do pincel ainda só existe na
 * interface.
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
});
export type Token = z.infer<typeof TokenSchema>;

export const PontoSchema = z.object({ x: z.number(), y: z.number() });
export type Ponto = z.infer<typeof PontoSchema>;

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

/** Quem vê uma pasta (e tudo o que está nela). */
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
  /** Ficha mínima até o Lote 9. */
  ficha: z.object({
    pvAtual: z.number().int().min(0).max(9999),
    pvMax: z.number().int().min(0).max(9999),
  }),
});
export type Personagem = z.infer<typeof PersonagemSchema>;

/**
 * Estado da campanha. Na visão de um jogador `notaMestre` não existe, `porUsuario` só tem a
 * entrada dele mesmo, `cenas` só tem a cena ativa e `pastas`/`personagens` só têm o que ele vê.
 */
export const EstadoSchema = z.object({
  seq: z.number().int().nonnegative(),
  usuarios: z.array(UsuarioSchema),
  permissoes: PermissoesSchema,
  notaMesa: z.string().max(TAMANHO_MAXIMO_NOTA),
  notaMestre: z.string().max(TAMANHO_MAXIMO_NOTA).optional(),
  cenas: z.array(CenaSchema).min(1),
  cenaAtivaId: z.string().min(1).max(64),
  /** Na visão de um jogador: sem os tokens ocultos nem os da camada do mestre. */
  tokens: z.array(TokenSchema),
  /**
   * Paredes e portas. Na visão de um jogador: só as da cena ativa, com a porta secreta já disfarçada
   * (fechada vira `parede`, aberta vira `porta` aberta).
   */
  paredes: z.array(ParedeSchema),
  /** Na visão de um jogador: só as pastas que ele vê. */
  pastas: z.array(PastaSchema),
  /** Na visão de um jogador: os que ele edita e os das pastas que ele vê. */
  personagens: z.array(PersonagemSchema),
  /** O painel flutuante de ordem de turno aparece para todos? (o conteúdo vem no Lote 11) */
  ordemDeTurnoVisivel: z.boolean(),
  /** Metadados dos assets registrados. Só existe na sala e na visão do mestre (nunca do jogador). */
  assets: z.array(AssetMetaSchema).optional(),
});
export type Estado = z.infer<typeof EstadoSchema>;

export const PresencaSchema = z.enum(["online", "reconectando", "offline"]);
export type Presenca = z.infer<typeof PresencaSchema>;
