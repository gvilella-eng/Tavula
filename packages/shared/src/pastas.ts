import { z } from "zod";
import { HashSchema } from "./assets.ts";
import { type Handout, type Pasta, type Personagem, PersonagemSchema } from "./estado.ts";

export const PASTA_PERSONAGENS_ID = "pasta-personagens";
export const PASTA_NPCS_ID = "pasta-npcs";
/** A pasta que recebe os handouts nascidos das notas antigas (V3). */
export const PASTA_HANDOUTS_ID = "pasta-handouts";
export const HANDOUT_NOTA_DA_MESA_ID = "handout-nota-da-mesa";
export const HANDOUT_NOTA_DO_MESTRE_ID = "handout-nota-do-mestre";

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

/**
 * Migração do V3: a aba Notas saiu. `notaMesa` (se não vazia) vira o handout "Nota da mesa", visível a todos;
 * `notaMestre` (se não vazia) vira "Nota do mestre", só do mestre. Os dois vão para a pasta "Handouts" (só do
 * mestre: o jogador a vê pelo handout que lhe cabe), criada se houver algo a migrar e se ainda não existir.
 * Pura: devolve os handouts e as pastas (com a nova, se foi o caso). Sem notas, nada muda.
 */
export function migrarNotasParaHandouts(
  notas: { notaMesa?: string | undefined; notaMestre?: string | undefined },
  pastas: readonly Pasta[],
): { handouts: Handout[]; pastas: Pasta[] } {
  const handouts: Handout[] = [];
  if ((notas.notaMesa ?? "").trim() !== "") {
    handouts.push({
      id: HANDOUT_NOTA_DA_MESA_ID,
      pastaId: PASTA_HANDOUTS_ID,
      titulo: "Nota da mesa",
      texto: notas.notaMesa as string,
      fonte: "simples",
      visivel: { tipo: "todos" },
    });
  }
  if ((notas.notaMestre ?? "").trim() !== "") {
    handouts.push({
      id: HANDOUT_NOTA_DO_MESTRE_ID,
      pastaId: PASTA_HANDOUTS_ID,
      titulo: "Nota do mestre",
      texto: notas.notaMestre as string,
      fonte: "simples",
      visivel: { tipo: "mestre" },
    });
  }
  if (handouts.length === 0) return { handouts, pastas: [...pastas] };
  if (pastas.some((p) => p.id === PASTA_HANDOUTS_ID)) return { handouts, pastas: [...pastas] };
  const ordem = pastas.reduce((m, p) => Math.max(m, p.ordem), -1) + 1;
  return {
    handouts,
    pastas: [
      ...pastas,
      { id: PASTA_HANDOUTS_ID, nome: "Handouts", ordem, visivel: { tipo: "mestre" } },
    ],
  };
}

/**
 * Como a ficha deste personagem se mostra (V4b): o que a pessoa escolheu em Configurar (`ficha.apresentacao`) ou, sem
 * escolha, a regra do app: NPC é quem está na pasta NPCs ou não tem jogador que o edite.
 */
export function apresentacaoDoPersonagem(
  p: Pick<Personagem, "editores" | "pastaId" | "ficha">,
): "personagem" | "npc" {
  const escolhida = p.ficha?.apresentacao;
  if (escolhida) return escolhida;
  const semJogador = p.editores.tipo === "jogadores" && p.editores.ids.length === 0;
  return p.pastaId === PASTA_NPCS_ID || semJogador ? "npc" : "personagem";
}

export function ehNpc(p: Pick<Personagem, "editores" | "pastaId" | "ficha">): boolean {
  return apresentacaoDoPersonagem(p) === "npc";
}
