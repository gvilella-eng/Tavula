import { z } from "zod";
import {
  type Estado,
  FONTES_DE_HANDOUT,
  type Handout,
  PASTA_HANDOUTS_ID,
  pode,
  TAMANHO_MAXIMO_NOTA,
  TETO_DE_CRIACAO_DO_JOGADOR,
  type Usuario,
  type Visibilidade,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { acharExato, novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { type Contexto, cadaItem, definir, ehMestre, passo, Relatorio } from "./base.ts";

const PedidoDeNotaSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .describe("Título. Se já existe uma nota com esse título, ela é editada; senão, criada."),
    novoTitulo: z.string().trim().min(1).max(80).optional(),
    texto: z.string().max(TAMANHO_MAXIMO_NOTA).optional().describe("Troca o texto inteiro."),
    acrescentar: z.string().max(TAMANHO_MAXIMO_NOTA).optional().describe("Soma ao fim do texto."),
    fonte: z.enum(FONTES_DE_HANDOUT).optional().describe("Padrão simples."),
    visivel: z
      .union([z.enum(["todos", "mestre"]), z.array(z.string())])
      .optional()
      .describe(
        '"todos", "mestre" ou uma lista de nomes de jogadores. Padrão: só o mestre (e, para o jogador, só ele e o mestre).',
      ),
    apagar: z.boolean().optional(),
  })
  .strict();
type PedidoDeNota = z.infer<typeof PedidoDeNotaSchema>;

function visibilidade(estado: Estado, eu: Usuario, v: PedidoDeNota["visivel"]): Visibilidade {
  if (v === undefined) {
    return ehMestre(eu) ? { tipo: "mestre" } : { tipo: "jogadores", ids: [eu.id] };
  }
  if (v === "todos") return { tipo: "todos" };
  if (v === "mestre") return { tipo: "mestre" };
  const ids = v.map((nome) => {
    const alvo = nome.trim().toLowerCase();
    const u = estado.usuarios.find(
      (x) => x.papel === "jogador" && (x.nome.toLowerCase() === alvo || x.id === nome),
    );
    if (!u) {
      const jogadores = estado.usuarios.filter((x) => x.papel === "jogador").map((x) => x.nome);
      throw new ErroDoMcp(
        `Não achei o jogador "${nome}". Jogadores: ${jogadores.join(", ") || "nenhum"}.`,
      );
    }
    return u.id;
  });
  return { tipo: "jogadores", ids };
}

async function criar(p: PedidoDeNota, ctx: Contexto, lote: Lote, estado: Estado, eu: Usuario) {
  if (p.apagar) throw new ErroDoMcp(`Não existe a nota "${p.titulo}" para apagar.`);
  if (!ehMestre(eu)) {
    if (!pode(eu, "personagem.criarProprio", estado.permissoes)) {
      throw new ErroDoMcp(
        'O mestre desligou "Criar fichas e notas próprias": peça a ele para ligar.',
      );
    }
    const criadas = estado.handouts.filter((h) => h.criadoPor === eu.id).length;
    if (criadas >= TETO_DE_CRIACAO_DO_JOGADOR) {
      throw new ErroDoMcp(
        `Você já criou ${TETO_DE_CRIACAO_DO_JOGADOR} notas (o teto): apague uma para criar outra.`,
      );
    }
  }
  if (ehMestre(eu) && !estado.pastas.some((x) => x.id === PASTA_HANDOUTS_ID)) {
    const ordem = estado.pastas.reduce((m, x) => Math.max(m, x.ordem), -1) + 1;
    await passo(ctx, lote, "pasta.criar", {
      pasta: {
        id: PASTA_HANDOUTS_ID,
        nome: "Handouts",
        ordem: Math.min(ordem, 10_000),
        visivel: { tipo: "mestre" },
      },
    });
  }
  const texto = `${p.texto ?? ""}${p.acrescentar ? `${p.texto ? "\n\n" : ""}${p.acrescentar}` : ""}`;
  const handout: Handout = {
    id: novoId("nota"),
    pastaId: PASTA_HANDOUTS_ID,
    titulo: p.titulo,
    texto: texto.slice(0, TAMANHO_MAXIMO_NOTA),
    fonte: p.fonte ?? "simples",
    visivel: visibilidade(estado, eu, p.visivel),
  };
  await passo(ctx, lote, "handout.criar", { handout });
  const rascunho = ehMestre(eu) ? " (rascunho: o mestre revisa e publica)" : "";
  return `Criou a nota "${p.titulo}" (${texto.length} caracteres)${rascunho}.`;
}

async function editar(
  existente: Handout,
  p: PedidoDeNota,
  ctx: Contexto,
  lote: Lote,
  estado: Estado,
  eu: Usuario,
) {
  if (!ehMestre(eu) && existente.criadoPor !== eu.id) {
    throw new ErroDoMcp(
      `A nota "${existente.titulo}" não é sua: só quem a criou e o mestre mexem nela.`,
    );
  }
  if (p.apagar) {
    await passo(ctx, lote, "handout.apagar", { id: existente.id });
    return `Apagou a nota "${existente.titulo}".`;
  }
  const mudancas: Record<string, unknown> = {};
  if (p.novoTitulo !== undefined) mudancas.titulo = p.novoTitulo;
  if (p.texto !== undefined || p.acrescentar !== undefined) {
    const base = p.texto ?? existente.texto;
    const texto = p.acrescentar ? `${base}${base ? "\n\n" : ""}${p.acrescentar}` : base;
    if (texto.length > TAMANHO_MAXIMO_NOTA) {
      throw new ErroDoMcp(
        `O texto passaria de ${TAMANHO_MAXIMO_NOTA} caracteres: encurte ou divida em duas notas.`,
      );
    }
    mudancas.texto = texto;
  }
  if (p.fonte !== undefined) mudancas.fonte = p.fonte;
  if (p.visivel !== undefined) mudancas.visivel = visibilidade(estado, eu, p.visivel);
  if (Object.keys(mudancas).length === 0) return `A nota "${existente.titulo}" não mudou.`;
  await passo(ctx, lote, "handout.editar", { id: existente.id, mudancas });
  return `Editou a nota "${p.novoTitulo ?? existente.titulo}" (${Object.keys(mudancas).join(", ")}).`;
}

export const notas = definir({
  nome: "notas",
  descricao:
    'Cria, edita e apaga handouts (notas) em lote. Se já existe nota com o título, edita; senão, cria. O mestre mexe em todas (as que cria entram como rascunho); o jogador, nas dele (teto de 20), escolhendo quem vê. `acrescentar` soma ao fim do texto. PARA RESUMIR UMA SESSÃO GRAVADA: leia a nota de transcrição (`ler`, tipo handout, `completo: true`) e escreva o resumo como rascunho de nota: o que aconteceu, NPCs, pistas e pendências. Exemplo: {"notas":[{"titulo":"A Eclusa","texto":"Uma comporta antiga...","visivel":"todos"}]}',
  entrada: z.object({ notas: z.array(PedidoDeNotaSchema).min(1).max(30) }).strict(),
  visivel(estado, eu) {
    if (ehMestre(eu)) return true;
    return (
      pode(eu, "personagem.criarProprio", estado.permissoes) ||
      estado.handouts.some((h) => h.criadoPor === eu.id)
    );
  },
  async executar(e, ctx) {
    const eu = ctx.sala.eu();
    const r = new Relatorio();
    const titulos = e.notas.map((n) => n.titulo);
    const lote = ctx.novoLote(
      `notas: ${titulos.slice(0, 6).join(", ")}${titulos.length > 6 ? ` e mais ${titulos.length - 6}` : ""}`,
    );
    await cadaItem(
      e.notas,
      (n) => `"${n.titulo}"`,
      async (n) => {
        const atual = ctx.sala.estado();
        const existente = acharExato(atual.handouts, n.titulo, (h) => h.titulo);
        return existente
          ? editar(existente, n, ctx, lote, atual, eu)
          : criar(n, ctx, lote, atual, eu);
      },
      r,
    );
    return r.saida();
  },
});
