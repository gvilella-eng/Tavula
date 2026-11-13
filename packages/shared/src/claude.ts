import { z } from "zod";
import { bytesParaBase64Url } from "./contas.ts";

// 12-1: o acesso do Claude (MCP) à mesa. O Claude entra como o próprio usuário e nunca alcança mais do que ele: a
// conexão dele é uma conexão comum com uma marca. Este arquivo guarda o que é puro e compartilhado: o formato do token,
// a lista do que o Claude não pode fazer, o limite de frequência e os tetos. A sala é quem decide tudo (4.12 e 4.14).

// --- O token de acesso ------------------------------------------------------------------------

/** O token tem este prefixo (para o cliente e o humano o reconhecerem) e 32 bytes aleatórios em base64url (43 caracteres). */
export const PREFIXO_DO_TOKEN_DO_CLAUDE = "tvc_";
export const BYTES_DO_TOKEN_DO_CLAUDE = 32;
export const FORMATO_DO_TOKEN_DO_CLAUDE = /^tvc_[A-Za-z0-9_-]{43}$/;
/** Quantos tokens ativos uma conta pode ter numa mesa (assumido). */
export const MAXIMO_DE_TOKENS_DO_CLAUDE = 5;
export const TAMANHO_MAXIMO_DO_NOME_DO_TOKEN = 40;
/** Cada lote do Desfazer: quantos a sala guarda por usuário (assumido). */
export const MAXIMO_DE_LOTES_POR_USUARIO = 50;

/** Um token novo (só existe na resposta que o mostra; a sala guarda só o hash). */
export function novoTokenDoClaude(
  sortear: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  return PREFIXO_DO_TOKEN_DO_CLAUDE + bytesParaBase64Url(sortear(BYTES_DO_TOKEN_DO_CLAUDE));
}

/** O token do cabeçalho `Authorization: Bearer <token>`, ou `null` se não há ou não é desse formato. */
export function tokenDoCabecalho(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const m = /^Bearer[ ]+(\S+)$/i.exec(authorization.trim());
  return m?.[1] ?? null;
}

/** Os corpos das rotas dos tokens (`POST conta/claude/gerar` e `conta/claude/revogar`). */
export const CorpoGerarTokenSchema = z.object({
  nome: z.string().max(TAMANHO_MAXIMO_DO_NOME_DO_TOKEN).optional(),
});
export const CorpoRevogarTokenSchema = z.object({ id: z.string().min(1).max(64) });

/** O que a sala mostra de cada token (nunca o token nem o hash). */
export type TokenDoClaudePublico = {
  id: string;
  nome: string;
  criadoEm: number;
  ultimoUso: number | null;
};

// --- O que o Claude nunca faz -----------------------------------------------------------------

/**
 * As intenções que a conexão do Claude recusa, mesmo para um mestre: mudar papéis e permissões, importar e exportar a
 * campanha e o vaivém de arquivos (o Claude não tem arquivos e não envia imagens). Além delas, o token nunca vale em
 * rota HTTP (contas, pedidos de entrada, redefinição de senha, chave da pasta, código de recuperação, tokens, renomear
 * ou apagar a mesa): só abre o WebSocket. Esta é a lista num lugar só (a sala e os testes leem daqui).
 */
export const PROIBIDAS_AO_CLAUDE = {
  "papel.alterar": "mudar papéis",
  "permissao.alterar": "mudar permissões",
  "campanha.exportar": "exportar a campanha",
  "campanha.importar": "importar a campanha",
  "asset.pedir": "trocar arquivos",
  "asset.inventario": "trocar arquivos",
  "asset.tenho": "trocar arquivos",
  "asset.naoTenho": "trocar arquivos",
} as const satisfies Record<string, string>;

/** Os tipos de intenção proibidos ao Claude. */
export const INTENCOES_PROIBIDAS_AO_CLAUDE: readonly string[] = Object.keys(PROIBIDAS_AO_CLAUDE);

/** A mensagem de recusa, ou `null` se a intenção é permitida à conexão do Claude. */
export function recusaDoClaude(tipo: string): string | null {
  const o = (PROIBIDAS_AO_CLAUDE as Record<string, string>)[tipo];
  return o === undefined ? null : `O Claude não pode ${o}: só a pessoa, pela mesa.`;
}

/**
 * As ações da mesa que o Claude nunca alcança porque não são intenções do WebSocket (são rotas HTTP, que o token não
 * abre) ou não existem no protocolo. Só para a documentação e para o texto da tela.
 */
export const PROIBIDAS_FORA_DO_PROTOCOLO: readonly string[] = [
  "aceitar, recusar ou mexer em contas, pedidos de entrada e redefinições de senha",
  "trocar a chave da pasta ou o código de recuperação",
  "apagar a mesa",
  "gerar ou revogar tokens de acesso",
];

// --- Limite de frequência por token -----------------------------------------------------------

/** 20 intenções por segundo, com rajada de 40 (assumido). */
export const LIMITE_DO_CLAUDE = { porSegundo: 20, rajada: 40 } as const;

export type BaldeDoClaude = { fichas: number; em: number };

/** Balde de fichas: cada intenção gasta uma; ele enche `porSegundo` por segundo até `rajada`. Pura. */
export function gastarFicha(
  balde: BaldeDoClaude | undefined,
  agoraMs: number,
): { ok: boolean; balde: BaldeDoClaude; esperaMs: number } {
  const antes = balde ?? { fichas: LIMITE_DO_CLAUDE.rajada, em: agoraMs };
  const passou = Math.max(0, agoraMs - antes.em) / 1000;
  const fichas = Math.min(
    LIMITE_DO_CLAUDE.rajada,
    antes.fichas + passou * LIMITE_DO_CLAUDE.porSegundo,
  );
  if (fichas < 1) {
    return {
      ok: false,
      balde: { fichas, em: agoraMs },
      esperaMs: Math.ceil(((1 - fichas) / LIMITE_DO_CLAUDE.porSegundo) * 1000),
    };
  }
  return { ok: true, balde: { fichas: fichas - 1, em: agoraMs }, esperaMs: 0 };
}

// --- O jogador cria as próprias fichas e handouts ---------------------------------------------

/** O teto de fichas e de handouts que cada jogador cria (só para não ser infinito; assumido 20 de cada). */
export const TETO_DE_CRIACAO_DO_JOGADOR = 20;

/** O id da pasta própria de um jogador (a sala a cria no primeiro item dele). */
export function idDaPastaDoJogador(usuarioId: string): string {
  return `pasta-de-${usuarioId}`.slice(0, 64);
}
