import { z } from "zod";
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
 * Estado da campanha. Na visão de um jogador `notaMestre` não existe e `porUsuario` só tem a
 * entrada dele mesmo.
 */
export const EstadoSchema = z.object({
  seq: z.number().int().nonnegative(),
  usuarios: z.array(UsuarioSchema),
  permissoes: PermissoesSchema,
  notaMesa: z.string().max(TAMANHO_MAXIMO_NOTA),
  notaMestre: z.string().max(TAMANHO_MAXIMO_NOTA).optional(),
});
export type Estado = z.infer<typeof EstadoSchema>;

export const PresencaSchema = z.enum(["online", "reconectando", "offline"]);
export type Presenca = z.infer<typeof PresencaSchema>;
