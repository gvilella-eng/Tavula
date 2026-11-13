import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Estado, Usuario } from "@tabletop/shared";
import { z } from "zod";
import type { CompendioLocal } from "./compendioLocal.ts";
import { ErroDoMcp } from "./erros.ts";
import type { Contexto, QualquerFerramenta } from "./ferramentas/base.ts";
import {
  FERRAMENTAS_SEM_CONEXAO,
  ferramentasVisiveis,
  TODAS_AS_FERRAMENTAS,
} from "./ferramentas/index.ts";
import type { Lote, SalaLike } from "./sala.ts";

/** A conexão como o servidor a usa: além do que as ferramentas pedem, espera ficar pronta e diz se há estado. */
export interface Conexao extends SalaLike {
  esperarPronto(ms?: number): Promise<void>;
  estadoOuNulo(): Estado | null;
}

export const INSTRUCOES = [
  "Távola: uma mesa de RPG (D&D 5e). Você age como o usuário que gerou o token, com as permissões dele; a mesa decide o que vale.",
  "Comece por `panorama` (o que existe na mesa). Use nomes, nunca ids. Mande vários itens numa chamada só.",
  "Tudo o que muda a mesa entra num lote que o usuário pode desfazer (`desfazer`). O que você cria para o mestre fica como rascunho até ele publicar.",
  "Coordenadas de cena são em células, a partir do canto de cima à esquerda.",
].join(" ");

/** Esconde qualquer coisa com cara de token, por garantia: o token nunca sai numa resposta. */
export function redigir(texto: string): string {
  return texto.replace(/tvc_[A-Za-z0-9_-]{20,}/g, "tvc_…");
}

function textoDoZod(erro: z.ZodError): string {
  const itens = erro.issues.slice(0, 5).map((i) => {
    const caminho = i.path.join(".");
    return caminho ? `${caminho}: ${i.message}` : i.message;
  });
  return `Entrada inválida (${itens.join("; ")}).`;
}

function jsonSchemaDe(f: QualquerFerramenta): Record<string, unknown> {
  const esquema = z.toJSONSchema(f.entrada, { io: "input", unrepresentable: "any" }) as Record<
    string,
    unknown
  >;
  const { $schema: _s, ...resto } = esquema;
  return resto;
}

const SO_LEITURA = new Set(["panorama", "ler", "compendio"]);

export function definicaoDaFerramenta(f: QualquerFerramenta) {
  return {
    name: f.nome,
    description: f.descricao,
    inputSchema: jsonSchemaDe(f) as { type: "object"; [k: string]: unknown },
    annotations: SO_LEITURA.has(f.nome) ? { readOnlyHint: true } : { destructiveHint: false },
  };
}

/** Um lote novo por chamada de ferramenta: o mesmo `loteId` vai em todas as intenções dela. */
export function novoLote(descricao: string): Lote {
  return {
    loteId: `mcp-${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    lote: descricao.slice(0, 120),
  };
}

export type ResultadoDaChamada = { content: { type: "text"; text: string }[]; isError?: boolean };

/** Valida a entrada, roda a ferramenta e devolve texto. Erro que a pessoa (ou a IA) pode corrigir vira `isError` com o que fazer. */
export async function chamarFerramenta(
  nome: string,
  argumentos: unknown,
  conexao: Conexao,
  compendio: CompendioLocal,
): Promise<ResultadoDaChamada> {
  const resposta = (texto: string, erro = false): ResultadoDaChamada => ({
    content: [{ type: "text", text: redigir(texto) }],
    ...(erro ? { isError: true } : {}),
  });
  const ferramenta = TODAS_AS_FERRAMENTAS.find((f) => f.nome === nome);
  if (!ferramenta) {
    return resposta(
      `A ferramenta "${nome}" não existe. As ferramentas são: ${TODAS_AS_FERRAMENTAS.map((f) => f.nome).join(", ")}.`,
      true,
    );
  }
  try {
    await conexao.esperarPronto(8000);
    const estado = conexao.estado();
    const eu = conexao.eu();
    if (!ferramenta.visivel(estado, eu)) {
      return resposta(
        `A ferramenta "${nome}" não está liberada para ${eu.nome} (${eu.papel}). Só a mesa (e o mestre) decide isso.`,
        true,
      );
    }
    const lida = ferramenta.entrada.safeParse(argumentos ?? {});
    if (!lida.success) return resposta(textoDoZod(lida.error), true);
    const ctx: Contexto = { sala: conexao, compendio, novoLote };
    const saida = await ferramenta.executar(lida.data, ctx);
    return typeof saida === "string" ? resposta(saida) : resposta(saida.texto, saida.erro === true);
  } catch (e) {
    if (e instanceof ErroDoMcp) return resposta(e.message, true);
    const mensagem = e instanceof Error ? e.message : String(e);
    return resposta(`Erro inesperado no MCP do Távola: ${mensagem}`, true);
  }
}

/** As ferramentas que a lista mostra agora (só o panorama se a conexão não está pronta). */
export function ferramentasDaLista(conexao: Conexao): readonly QualquerFerramenta[] {
  const estado = conexao.estadoOuNulo();
  if (!estado) return FERRAMENTAS_SEM_CONEXAO;
  let eu: Usuario;
  try {
    eu = conexao.eu();
  } catch {
    return FERRAMENTAS_SEM_CONEXAO;
  }
  return ferramentasVisiveis(estado, eu);
}

export type ServidorMcp = { servidor: Server; avisarMudanca: () => void };

/** O servidor MCP (stdio): lista só as ferramentas do usuário e chama a que a IA pedir. */
export function criarServidor(conexao: Conexao, compendio: CompendioLocal): ServidorMcp {
  const servidor = new Server(
    { name: "tavola", version: "0.1.0" },
    { capabilities: { tools: { listChanged: true } }, instructions: INSTRUCOES },
  );

  servidor.setRequestHandler(ListToolsRequestSchema, async () => {
    // Dá um tempo para a primeira conexão: assim a lista já sai com as ferramentas certas.
    await conexao.esperarPronto(5000).catch(() => undefined);
    return { tools: ferramentasDaLista(conexao).map(definicaoDaFerramenta) };
  });

  servidor.setRequestHandler(CallToolRequestSchema, async (req) => {
    return chamarFerramenta(req.params.name, req.params.arguments, conexao, compendio);
  });

  // Se o papel ou as permissões mudarem no meio, a lista de ferramentas muda: avisa o cliente.
  let assinatura = "";
  const avisarMudanca = () => {
    const nova = ferramentasDaLista(conexao)
      .map((f) => f.nome)
      .join(",");
    if (assinatura !== "" && nova !== assinatura)
      void servidor.sendToolListChanged().catch(() => undefined);
    assinatura = nova;
  };
  return { servidor, avisarMudanca };
}
