import { z } from "zod";
import {
  type ItemDeRascunho,
  listarRascunhos,
  normalizarBusca,
  pode,
  type RascunhoListado,
  ROTULO_DO_TIPO_DE_RASCUNHO,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { definir, passo } from "./base.ts";

function rotulo(r: RascunhoListado): string {
  return `${ROTULO_DO_TIPO_DE_RASCUNHO[r.tipo].toLowerCase()}: ${r.nome}`;
}

/** Acha o rascunho pelo nome, com o tipo na frente ("ficha:Goblin") para desfazer um empate. */
function acharRascunho(lista: readonly RascunhoListado[], pedido: string): RascunhoListado {
  const prefixo = /^([^:]+):\s*(.+)$/.exec(pedido.trim());
  let candidatos = [...lista];
  let nome = pedido;
  if (prefixo) {
    const tipo = normalizarBusca(prefixo[1] as string);
    const doTipo = candidatos.filter(
      (r) => r.tipo === tipo || normalizarBusca(ROTULO_DO_TIPO_DE_RASCUNHO[r.tipo]) === tipo,
    );
    if (doTipo.length > 0) {
      candidatos = doTipo;
      nome = prefixo[2] as string;
    }
  }
  const alvo = normalizarBusca(nome);
  const iguais = candidatos.filter((r) => normalizarBusca(r.nome) === alvo || r.id === nome);
  if (iguais.length === 1) return iguais[0] as RascunhoListado;
  if (iguais.length > 1) {
    throw new ErroDoMcp(
      `"${nome}" é o nome de mais de um rascunho: ${iguais.map((r) => `"${r.tipo}:${r.nome}"`).join(", ")}. Escreva o tipo na frente.`,
    );
  }
  throw new ErroDoMcp(
    `Não achei o rascunho "${pedido}". Rascunhos: ${lista.map(rotulo).slice(0, 15).join("; ") || "nenhum"}.`,
  );
}

export const rascunhos = definir({
  nome: "rascunhos",
  descricao:
    'Só do mestre. O que o Claude cria para o mestre entra como rascunho: os jogadores não veem até publicar. Lista, publica (tudo ou itens pelo nome) e descarta (apaga). Para uma coisa em particular escreva o tipo na frente ("ficha:Goblin"). Exemplos: {"acao":"listar"}, {"acao":"publicar"}, {"acao":"descartar","itens":["Eclusa"]}.',
  entrada: z
    .object({
      acao: z.enum(["listar", "publicar", "descartar"]),
      itens: z
        .array(z.string())
        .optional()
        .describe(
          "Nomes dos rascunhos. Sem `itens`, publicar publica todos; descartar exige `itens` ou `todos`.",
        ),
      todos: z.boolean().optional().describe("Só ao descartar: descarta todos os rascunhos."),
    })
    .strict(),
  visivel: (estado, eu) => pode(eu, "mesa.configurar", estado.permissoes),
  async executar(e, ctx) {
    const lista = listarRascunhos(ctx.sala.estado());
    if (e.acao === "listar") {
      if (lista.length === 0) return "Não há rascunhos.";
      return [`${lista.length} rascunho(s):`, ...lista.map((r) => `- ${rotulo(r)}`)].join("\n");
    }
    if (lista.length === 0) return "Não há rascunhos.";
    const itens: ItemDeRascunho[] | undefined = e.itens?.map((n) => {
      const r = acharRascunho(lista, n);
      return { tipo: r.tipo, id: r.id };
    });
    if (e.acao === "descartar" && !itens && e.todos !== true) {
      throw new ErroDoMcp(
        "Diga quais descartar em `itens`, ou `todos: true` para descartar todos.",
      );
    }
    const alvo = itens ?? lista.map((r) => ({ tipo: r.tipo, id: r.id }));
    const lote = ctx.novoLote(
      `${e.acao === "publicar" ? "publicou" : "descartou"} ${alvo.length} rascunho(s)`,
    );
    // Publicar e descartar respondem com um snapshot novo (não com o evento do pedido): o cliente da sala já trata assim.
    await passo(
      ctx,
      lote,
      e.acao === "publicar" ? "rascunho.publicar" : "rascunho.descartar",
      e.acao === "publicar" && !itens ? {} : { itens: alvo },
    );
    const restantes = listarRascunhos(ctx.sala.estado()).length;
    return `${e.acao === "publicar" ? "Publicou" : "Descartou"} ${alvo.length} rascunho(s). Restam ${restantes}.`;
  },
});
