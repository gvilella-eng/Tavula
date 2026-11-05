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

export const CAMADAS = ["tokens", "mestre"] as const;
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
});
export type Token = z.infer<typeof TokenSchema>;

export const PersonagemSchema = z.object({
  id: z.string().min(1).max(64),
  /** `null` = NPC do mestre. */
  donoId: z.string().min(1).max(64).nullable(),
  nome: z.string().min(1).max(64),
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
 * entrada dele mesmo e `cenas` só tem a cena ativa.
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
  /** Na visão de um jogador: os dele e, com `ficha.verOutras`, os de outros jogadores (nunca NPC). */
  personagens: z.array(PersonagemSchema),
  /** Metadados dos assets registrados. Só existe na sala e na visão do mestre (nunca do jogador). */
  assets: z.array(AssetMetaSchema).optional(),
});
export type Estado = z.infer<typeof EstadoSchema>;

export const PresencaSchema = z.enum(["online", "reconectando", "offline"]);
export type Presenca = z.infer<typeof PresencaSchema>;
