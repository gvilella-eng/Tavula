import { z } from "zod";
import ptBR from "zod/v4/locales/pt-BR.js";
import type { Estado, Usuario } from "../index.ts";
import type { CompendioLocal } from "./compendio.ts";
import { ErroDoMcp } from "./erros.ts";
import type { Contexto, QualquerFerramenta } from "./ferramentas/base.ts";
import {
  FERRAMENTAS_SEM_CONEXAO,
  ferramentasVisiveis,
  TODAS_AS_FERRAMENTAS,
} from "./ferramentas/index.ts";
import type { Lote, SalaLike } from "./tipos.ts";

// O coração do servidor MCP, sem transporte: a lista de ferramentas, a validação e a chamada. O `apps/mcp` (stdio, com o
// SDK) e a rota HTTP da sala usam este mesmo código.

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
  "Perguntaram sobre automações (como funcionam, o que uma faz, como montar uma)? Chame `automacoes` com `guia` e `explicar` antes de responder: o guia diz como as peças funcionam e `explicar` conta, em português, o que cada automação da mesa faz.",
  "O mestre não precisa fazer nada além de pedir: o que ele faz ao preparar ou configurar a mesa você faz por ferramenta (cenas, mapa, tokens, objetos, automacoes, mesa, som, combate, chat, fichas, notas), e também a condução ao vivo (narrar, mostrar handout, levar o grupo, conduzir o combate). Só o que é gesto da tela fica de fora.",
  "Roteiro para preparar uma sessão: 1) `cenas` cria a cena (ou duplica outra); 2) `arquivos` envia o mapa; 3) `cenas` põe paredes, portas e luz, e `objetos` suportes e tochas; 4) `mapa` cobre a névoa e revela o que o grupo já vê; 5) `fichas` cria NPCs do compêndio e `cenas` põe os tokens; 6) `som` define a trilha da cena; 7) `notas` escreve os handouts; 8) `combate` monta o encontro e rola a iniciativa; 9) `cenas` com `levarGrupo` quando o mestre mandar.",
  "Arquivos (mapa da cena, token, retrato, handout, som, compêndio): gere ou ache o arquivo no computador, chame `arquivos` (enviar), rode no shell o comando que ela devolve e pronto; sem shell, mande em base64.",
].join(" ");

/** Esconde qualquer coisa com cara de token, por garantia: o token nunca sai numa resposta. */
export function redigir(texto: string): string {
  return texto.replace(/tvc_[A-Za-z0-9_-]{20,}/g, "tvc_…");
}

/** As mensagens de validação do zod, em português, só para as entradas das ferramentas (não mexe no zod do resto). */
// (só o `pt-BR`, não `z.locales`: este traria as 40 línguas para dentro do Worker, uns 260 KB.)
const MENSAGENS_PT = ptBR().localeError;

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
    loteId: `mcp-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
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
    const lida = ferramenta.entrada.safeParse(argumentos ?? {}, { error: MENSAGENS_PT });
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
