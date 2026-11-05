import { z } from "zod";
import { PERMISSOES_PADRAO } from "./capacidades.ts";
import {
  CenaSchema,
  type Estado,
  PermissoesSchema,
  PersonagemSchema,
  TokenSchema,
  UsuarioSchema,
} from "./estado.ts";
import { CENA_PADRAO } from "./mapa.ts";

/** Formato de `fixtures/campanha.seed.json`: usuários e (opcional) permissões iniciais. */
export const SementeSchema = z.object({
  usuarios: z.array(UsuarioSchema).min(1),
  permissoes: PermissoesSchema.partial().optional(),
  cenas: z.array(CenaSchema).min(1).optional(),
  cenaAtivaId: z.string().optional(),
  tokens: z.array(TokenSchema).optional(),
  personagens: z.array(PersonagemSchema).optional(),
});
export type Semente = z.infer<typeof SementeSchema>;

/** Estado inicial de uma campanha vazia a partir da semente. */
export function estadoInicial(bruta: unknown): Estado {
  const semente = SementeSchema.parse(bruta);
  const cenas = semente.cenas ?? [CENA_PADRAO];
  return {
    seq: 0,
    usuarios: semente.usuarios,
    permissoes: {
      jogadores: { ...PERMISSOES_PADRAO, ...semente.permissoes?.jogadores },
      porUsuario: semente.permissoes?.porUsuario ?? {},
    },
    notaMesa: "",
    notaMestre: "",
    cenas,
    cenaAtivaId: semente.cenaAtivaId ?? cenas[0]?.id ?? CENA_PADRAO.id,
    tokens: semente.tokens ?? [],
    personagens: semente.personagens ?? [],
    assets: [],
  };
}
