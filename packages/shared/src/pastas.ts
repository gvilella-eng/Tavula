import { z } from "zod";
import { HashSchema } from "./assets.ts";
import { type Pasta, type Personagem, PersonagemSchema } from "./estado.ts";

export const PASTA_PERSONAGENS_ID = "pasta-personagens";
export const PASTA_NPCS_ID = "pasta-npcs";

/** As duas pastas que toda campanha antiga ganha (e a campanha nova): só o mestre as vê. */
export function pastasPadrao(): Pasta[] {
  return [
    { id: PASTA_PERSONAGENS_ID, nome: "Personagens", ordem: 0, visivel: { tipo: "mestre" } },
    { id: PASTA_NPCS_ID, nome: "NPCs", ordem: 1, visivel: { tipo: "mestre" } },
  ];
}

/** Personagem como era até o Lote 4 (exportação v4 e banco antigo): tem `donoId`, sem pasta. */
export const PersonagemAntigoSchema = PersonagemSchema.omit({
  pastaId: true,
  editores: true,
}).extend({ donoId: z.string().min(1).max(64).nullable(), retratoHash: HashSchema.optional() });
export type PersonagemAntigo = z.infer<typeof PersonagemAntigoSchema>;

/**
 * Migração do Lote 4b: o dono vira "quem edita" e o personagem vai para uma pasta só do mestre
 * ("Personagens" para jogador, "NPCs" para NPC). Assim só o antigo dono e o mestre o veem, como antes.
 */
export function migrarPersonagem(antigo: PersonagemAntigo): Personagem {
  const { donoId, ...resto } = antigo;
  return {
    ...resto,
    pastaId: donoId === null ? PASTA_NPCS_ID : PASTA_PERSONAGENS_ID,
    editores: { tipo: "jogadores", ids: donoId === null ? [] : [donoId] },
  };
}

/** Linha vinda do banco: já no formato novo, ou ainda com `donoId`. */
export function personagemDoBanco(bruto: unknown): Personagem {
  if (typeof bruto === "object" && bruto !== null && "donoId" in bruto) {
    return migrarPersonagem(PersonagemAntigoSchema.parse(bruto));
  }
  return PersonagemSchema.parse(bruto);
}
