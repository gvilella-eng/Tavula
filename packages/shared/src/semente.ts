import { z } from "zod";
import { PERMISSOES_PADRAO } from "./capacidades.ts";
import { type Estado, PermissoesSchema, UsuarioSchema } from "./estado.ts";

/** Formato de `fixtures/campanha.seed.json`: usuários e (opcional) permissões iniciais. */
export const SementeSchema = z.object({
  usuarios: z.array(UsuarioSchema).min(1),
  permissoes: PermissoesSchema.partial().optional(),
});
export type Semente = z.infer<typeof SementeSchema>;

/** Estado inicial de uma campanha vazia a partir da semente. */
export function estadoInicial(bruta: unknown): Estado {
  const semente = SementeSchema.parse(bruta);
  return {
    seq: 0,
    usuarios: semente.usuarios,
    permissoes: {
      jogadores: { ...PERMISSOES_PADRAO, ...semente.permissoes?.jogadores },
      porUsuario: semente.permissoes?.porUsuario ?? {},
    },
    notaMesa: "",
    notaMestre: "",
  };
}
