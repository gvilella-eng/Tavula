import { z } from "zod";
import { ErroDoMcp } from "../erros.ts";
import type { LoteDoClaude } from "../tipos.ts";
import { definir, passo } from "./base.ts";

/** "há 5 min", "há 2 h": quanto faz que o lote foi feito. */
export function haQuanto(emMs: number, agora: number = Date.now()): string {
  const s = Math.max(0, Math.round((agora - emMs) / 1000));
  if (s < 45) return "agora";
  const min = Math.round(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

function linha(l: LoteDoClaude, i: number): string {
  const marcas = [
    l.desfeito ? "já desfeito" : "",
    l.desfazivel ? "" : "grande demais para desfazer",
  ]
    .filter(Boolean)
    .join(", ");
  return `${i + 1}. ${l.descricao} — ${haQuanto(l.emMs)}, ${l.itens} ${l.itens === 1 ? "item" : "itens"}${marcas ? ` (${marcas})` : ""} [id ${l.loteId}]`;
}

export const desfazer = definir({
  nome: "desfazer",
  descricao:
    'Lista o que o Claude deste usuário fez na mesa (do mais novo ao mais velho) e desfaz um lote inteiro. O que outra pessoa mudou depois fica como está e é avisado. `lote` é o número da lista (1 = o mais novo) ou o id. Exemplos: {} para listar; {"acao":"desfazer","lote":"1"} para desfazer o último.',
  entrada: z
    .object({
      acao: z.enum(["listar", "desfazer"]).optional().describe("Padrão: listar."),
      lote: z.string().optional().describe("Só ao desfazer: número da lista ou id do lote."),
    })
    .strict(),
  visivel: () => true,
  async executar(e, ctx) {
    ctx.sala.estado();
    const lotes = ctx.sala.lotes();
    if ((e.acao ?? "listar") === "listar") {
      if (lotes.length === 0)
        return "O Claude ainda não mudou nada na mesa (ou o diário está vazio).";
      return ["O que o Claude fez (do mais novo ao mais velho):", ...lotes.map(linha)].join("\n");
    }
    if (e.lote === undefined) {
      throw new ErroDoMcp("Diga qual lote desfazer: o número da lista (1 = o mais novo) ou o id.");
    }
    const posicao = /^\d+$/.test(e.lote.trim()) ? Number(e.lote.trim()) : null;
    const alvo =
      posicao !== null && posicao >= 1 && posicao <= lotes.length
        ? lotes[posicao - 1]
        : lotes.find((l) => l.loteId === e.lote);
    if (!alvo) {
      throw new ErroDoMcp(
        `Não achei esse lote. Use a ferramenta com {} para ver a lista e escolha o número ou o id.`,
      );
    }
    if (alvo.desfeito) throw new ErroDoMcp("Esse lote já foi desfeito.");
    if (!alvo.desfazivel) {
      throw new ErroDoMcp("Esse lote mexeu em coisa grande demais para a mesa desfazer sozinha.");
    }
    // O pedido de desfazer não leva `loteId`: ele não é uma mudança do Claude a ser desfeita depois.
    const r = await passo(ctx, undefined, "claude.desfazer", { loteId: alvo.loteId });
    const d = r.desfeito;
    if (!d) return `Pedi para desfazer "${alvo.descricao}", mas a mesa não confirmou.`;
    return d.pulados.length === 0
      ? `Desfeito "${alvo.descricao}": ${d.aplicados} ${d.aplicados === 1 ? "item voltou" : "itens voltaram"}.`
      : `Desfeito "${alvo.descricao}": ${d.aplicados} voltaram; ficaram como estão porque mudaram depois: ${d.pulados.join(", ")}.`;
  },
});
