import { z } from "zod";
import {
  combateDe,
  type EntradaDeCombate,
  type Estado,
  LIMITES_DO_COMBATE,
  pode,
  podeEditarPersonagem,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar, novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { fichaPorNome, tokenPorNome } from "./achados.ts";
import { type Contexto, definir, passo } from "./base.ts";

const IniciativaSchema = z
  .number()
  .int()
  .min(LIMITES_DO_COMBATE.iniciativaMin)
  .max(LIMITES_DO_COMBATE.iniciativaMax);

const PassoSchema = z.discriminatedUnion("acao", [
  z
    .object({
      acao: z.literal("adicionar"),
      tokens: z.array(z.string()).max(60).optional().describe("Nomes de tokens da cena do grupo."),
      fichas: z
        .array(z.string())
        .max(30)
        .optional()
        .describe("Nomes de fichas: entram todos os tokens dessas fichas na cena do grupo."),
      todosOsTokens: z.boolean().optional().describe("Todos os tokens visíveis da cena do grupo."),
      soltas: z
        .array(z.string())
        .max(10)
        .optional()
        .describe('Entradas sem token, como "Covil" (age na iniciativa 20).'),
      iniciativa: IniciativaSchema.optional().describe(
        "Valor fixo (sem rolar) para todos desta chamada.",
      ),
      oculta: z.boolean().optional().describe("Os jogadores não veem estas entradas."),
      valorOculto: z.boolean().optional().describe("Os jogadores veem o nome, não o número."),
    })
    .strict(),
  z
    .object({
      acao: z.literal("rolar"),
      quem: z
        .union([z.enum(["todos", "npcs", "faltam"]), z.array(z.string())])
        .optional()
        .describe(
          '"faltam" (padrão): quem ainda não tem valor; "todos": rola de novo para todos; "npcs": só as entradas de NPC; ou uma lista de nomes.',
        ),
    })
    .strict(),
  z
    .object({
      acao: z.literal("editar"),
      entrada: z.string().describe("Nome da entrada."),
      nome: z.string().min(1).max(64).optional(),
      iniciativa: IniciativaSchema.nullable().optional().describe("null: tira o valor."),
      oculta: z.boolean().optional(),
      valorOculto: z.boolean().optional(),
    })
    .strict(),
  z.object({ acao: z.literal("tirar"), entrada: z.string() }).strict(),
  z
    .object({
      acao: z.literal("mover"),
      entrada: z.string(),
      posicao: z.number().int().min(1).max(1000).describe("Posição na lista (1 = a primeira)."),
    })
    .strict(),
  z
    .object({ acao: z.literal("ordenar") })
    .strict()
    .describe("Volta a lista à ordem pelos valores."),
  z.object({ acao: z.literal("proximo") }).strict(),
  z.object({ acao: z.literal("anterior") }).strict(),
  z
    .object({ acao: z.literal("passar") })
    .strict()
    .describe("Passa o turno da entrada da vez."),
  z.object({ acao: z.literal("darVez"), entrada: z.string() }).strict(),
  z.object({ acao: z.literal("rodada"), numero: z.number().int().min(0).max(9999) }).strict(),
  z
    .object({ acao: z.literal("entrar"), token: z.string() })
    .strict()
    .describe("Entra na ordem rolando a iniciativa da ficha."),
  z
    .object({ acao: z.literal("encerrar") })
    .strict()
    .describe("Limpa a lista e a rodada."),
]);
type Passo = z.infer<typeof PassoSchema>;

function entradaPorNome(estado: Estado, nome: string): EntradaDeCombate {
  const c = combateDe(estado);
  return achar(c.entradas, nome, { rotulo: "entrada", nomeDe: (x) => x.nome, idDe: (x) => x.id });
}

/** O combate como a mesa mostra: a rodada, a vez e a lista. */
function resumo(estado: Estado): string {
  const c = combateDe(estado);
  if (c.entradas.length === 0) return "Combate vazio.";
  const lista = c.entradas
    .map(
      (x) =>
        `${x.id === c.atualId ? "> " : ""}${x.nome}${x.iniciativa !== undefined ? ` (${x.iniciativa})` : " (?)"}`,
    )
    .join(", ");
  return `Rodada ${c.rodada}${c.atualId ? ` — vez de ${c.entradas.find((x) => x.id === c.atualId)?.nome ?? "?"}` : ""}. Ordem: ${lista}.`;
}

async function fazer(p: Passo, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  switch (p.acao) {
    case "adicionar": {
      const jaTem = new Set(combateDe(estado).entradas.map((x) => x.tokenId));
      const daCena = estado.tokens.filter((t) => t.cenaId === estado.cenaAtivaId);
      const alvos = new Map<string, (typeof daCena)[number]>();
      for (const n of p.tokens ?? []) {
        const t = tokenPorNome(estado, n);
        alvos.set(t.id, t);
      }
      for (const n of p.fichas ?? []) {
        const f = fichaPorNome(estado, n);
        const seus = daCena.filter((t) => t.personagemId === f.id);
        if (seus.length === 0) {
          throw new ErroDoMcp(
            `A ficha "${f.nome}" não tem token na cena do grupo (ponha com \`cenas\` ou \`tokens\`).`,
          );
        }
        for (const t of seus) alvos.set(t.id, t);
      }
      if (p.todosOsTokens) for (const t of daCena) alvos.set(t.id, t);
      const novos = [...alvos.values()].filter((t) => !jaTem.has(t.id));
      const entradas: Record<string, unknown>[] = novos.map((t) => ({
        id: novoId("turno"),
        tokenId: t.id,
        ...(p.iniciativa !== undefined ? { iniciativa: p.iniciativa } : {}),
        ...(p.oculta ? { oculta: true } : {}),
        ...(p.valorOculto ? { valorOculto: true } : {}),
      }));
      for (const nome of p.soltas ?? []) {
        entradas.push({
          id: novoId("turno"),
          nome,
          iniciativa: p.iniciativa ?? 20,
          ...(p.oculta ? { oculta: true } : {}),
        });
      }
      if (entradas.length === 0) {
        return alvos.size > 0
          ? "Esses tokens já estão na ordem de turno."
          : "Nada para adicionar: diga `tokens`, `fichas`, `todosOsTokens` ou `soltas`.";
      }
      await passo(ctx, lote, "combate.adicionar", { entradas });
      return `Pôs ${entradas.length} na ordem de turno: ${novos
        .map((t) => t.nome)
        .concat(p.soltas ?? [])
        .join(", ")}.`;
    }
    case "rolar": {
      const c = combateDe(estado);
      const quem = p.quem ?? "faltam";
      let ids: string[] | undefined;
      if (quem === "todos") ids = c.entradas.map((x) => x.id);
      else if (quem === "npcs") ids = c.entradas.filter((x) => x.jogador !== true).map((x) => x.id);
      else if (Array.isArray(quem)) ids = quem.map((n) => entradaPorNome(estado, n).id);
      if (ids && ids.length === 0) return "Não há entradas para rolar.";
      if (!ids && c.entradas.length === 0)
        throw new ErroDoMcp("A ordem de turno está vazia: use `adicionar` antes.");
      await passo(ctx, lote, "combate.rolar", ids ? { ids } : {});
      return `Rolou a iniciativa. ${resumo(ctx.sala.estado())}`;
    }
    case "editar": {
      const e = entradaPorNome(estado, p.entrada);
      const mud: Record<string, unknown> = {};
      if (p.nome !== undefined) mud.nome = p.nome;
      if (p.iniciativa !== undefined) mud.iniciativa = p.iniciativa;
      if (p.oculta !== undefined) mud.oculta = p.oculta;
      if (p.valorOculto !== undefined) mud.valorOculto = p.valorOculto;
      if (Object.keys(mud).length === 0) return `A entrada "${e.nome}" não mudou.`;
      await passo(ctx, lote, "combate.editar", { id: e.id, mudancas: mud });
      return `Editou a entrada "${e.nome}" (${Object.keys(mud).join(", ")}).`;
    }
    case "tirar": {
      const e = entradaPorNome(estado, p.entrada);
      await passo(ctx, lote, "combate.tirar", { id: e.id });
      return `Tirou "${e.nome}" da ordem de turno.`;
    }
    case "mover": {
      const e = entradaPorNome(estado, p.entrada);
      await passo(ctx, lote, "combate.mover", { id: e.id, indice: p.posicao - 1 });
      return `"${e.nome}" foi para a posição ${p.posicao}.`;
    }
    case "ordenar":
      await passo(ctx, lote, "combate.ordenar", {});
      return `Reordenou pelos valores. ${resumo(ctx.sala.estado())}`;
    case "proximo":
      await passo(ctx, lote, "combate.proximo", {});
      return `Próximo turno. ${resumo(ctx.sala.estado())}`;
    case "anterior":
      await passo(ctx, lote, "combate.anterior", {});
      return `Turno anterior. ${resumo(ctx.sala.estado())}`;
    case "passar":
      await passo(ctx, lote, "combate.passar", {});
      return `Passou o turno. ${resumo(ctx.sala.estado())}`;
    case "darVez": {
      const e = entradaPorNome(estado, p.entrada);
      await passo(ctx, lote, "combate.darVez", { id: e.id });
      return `A vez é de "${e.nome}".`;
    }
    case "rodada":
      await passo(ctx, lote, "combate.rodada", { rodada: p.numero });
      return `Rodada ${p.numero}.`;
    case "entrar": {
      const t = tokenPorNome(estado, p.token);
      await passo(ctx, lote, "combate.entrar", { tokenId: t.id });
      return `"${t.nome}" entrou na ordem de turno.`;
    }
    case "encerrar":
      await passo(ctx, lote, "combate.encerrar", {});
      return "Encerrou o combate (a lista e a rodada foram limpas).";
  }
}

export const combate = definir({
  nome: "combate",
  descricao: [
    "Monta e conduz o COMBATE (a ordem de turno). `passos` roda em ordem; cada passo tem `acao`: adicionar (`tokens`, `fichas`, `todosOsTokens` ou `soltas`), rolar (`quem`: faltam, todos, npcs ou nomes; as de NPC vão ocultas no chat), editar, tirar, mover, ordenar, proximo, anterior, passar, darVez, rodada, entrar (um token entra rolando a própria iniciativa) e encerrar.",
    "`ordemVisivel`: mostra ou esconde o painel de ordem de turno para todos. Sem `passos` nem `ordemVisivel`, só mostra o combate atual. O jogador só rola e passa a vez do próprio personagem e entra com o próprio token; montar, editar e conduzir é do mestre.",
    'Exemplo (montar com 2 goblins já no mapa e rolar tudo): {"passos":[{"acao":"adicionar","fichas":["Goblin"]},{"acao":"rolar","quem":"todos"},{"acao":"proximo"}],"ordemVisivel":true}',
  ].join(" "),
  entrada: z
    .object({
      passos: z.array(PassoSchema).max(30).optional(),
      ordemVisivel: z.boolean().optional(),
    })
    .strict(),
  visivel: (estado, eu) =>
    pode(eu, "combate.gerir", estado.permissoes) ||
    estado.personagens.some((p) => podeEditarPersonagem(p, eu)),
  async executar(e, ctx) {
    ctx.sala.estado();
    if (!e.passos?.length && e.ordemVisivel === undefined) return resumo(ctx.sala.estado());
    const lote = ctx.novoLote("combate");
    const linhas: string[] = [];
    let falhou = false;
    if (e.ordemVisivel !== undefined) {
      try {
        await passo(ctx, lote, "ordemDeTurno.definir", { visivel: e.ordemVisivel });
        linhas.push(`- Painel de ordem de turno ${e.ordemVisivel ? "visível" : "escondido"}.`);
      } catch (erro) {
        if (!(erro instanceof ErroDoMcp)) throw erro;
        falhou = true;
        linhas.push(`- NÃO FEITO: ordem visível: ${erro.message}`);
      }
    }
    // Os passos dependem uns dos outros (rolar depois de adicionar): o primeiro erro para a fila.
    for (const [i, p] of (e.passos ?? []).entries()) {
      try {
        linhas.push(`- ${await fazer(p, ctx, lote)}`);
      } catch (erro) {
        if (!(erro instanceof ErroDoMcp)) throw erro;
        falhou = true;
        linhas.push(`- NÃO FEITO: passo ${i + 1} (${p.acao}): ${erro.message}`);
        if (i < (e.passos?.length ?? 0) - 1) linhas.push("  Os passos seguintes não rodaram.");
        break;
      }
    }
    return {
      texto: linhas.join("\n"),
      erro: falhou && linhas.every((l) => l.includes("NÃO FEITO")),
    };
  },
});
