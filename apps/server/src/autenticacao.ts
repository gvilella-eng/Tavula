import { SESSAO_VALE_MS } from "@tabletop/shared";

/**
 * Cookies da mesa (C2). A sessão de verdade é o `tavola_sessao`: 32 bytes aleatórios em base64url; no
 * banco da sala fica só o hash dele. `HttpOnly`, `SameSite=Lax`, `Path=/api/m/<id>` (vale só para a
 * mesa) e `Secure` quando a requisição veio por https. Vale 30 dias, renovada com o uso.
 *
 * O `tabletop_sessao` (o id do usuário, em texto) é o login solto de desenvolvimento e **só existe com
 * `MODO=teste`**, para os E2E antigos continuarem escolhendo o usuário. O `tabletop_usuario` de antes do
 * C1 (`Path=/`) nunca mais é lido, só apagado na saída.
 */
export const NOME_DO_COOKIE = "tavola_sessao";
export const COOKIE_DE_TESTE = "tabletop_sessao";
export const COOKIE_ANTIGO = "tabletop_usuario";

export function lerCookie(cabecalho: string | null, nome: string): string | null {
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0 || parte.slice(0, i).trim() !== nome) continue;
    try {
      return decodeURIComponent(parte.slice(i + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}

const SEGUNDOS_DA_SESSAO = Math.floor(SESSAO_VALE_MS / 1000);

/** O `Set-Cookie` que entrega o token de sessão da mesa `mesaId`. */
export function cookieDeSessao(token: string, mesaId: string, seguro: boolean): string {
  return `${NOME_DO_COOKIE}=${token}; Path=/api/m/${mesaId}; HttpOnly; SameSite=Lax; Max-Age=${SEGUNDOS_DA_SESSAO}${seguro ? "; Secure" : ""}`;
}

/** Os `Set-Cookie` que apagam a sessão (e o login de teste e o cookie antigo) da mesa `mesaId`. */
export function cookiesDeSaida(mesaId: string, seguro: boolean): string[] {
  const fim = `HttpOnly; SameSite=Lax; Max-Age=0${seguro ? "; Secure" : ""}`;
  return [
    `${NOME_DO_COOKIE}=; Path=/api/m/${mesaId}; ${fim}`,
    `${COOKIE_DE_TESTE}=; Path=/api/m/${mesaId}; ${fim}`,
    `${COOKIE_ANTIGO}=; Path=/; ${fim}`,
  ];
}

/** O login solto de desenvolvimento (só `MODO=teste`): o id do usuário no cookie, por mesa. */
export function cookieDeTeste(usuarioId: string, mesaId: string): string {
  return `${COOKIE_DE_TESTE}=${encodeURIComponent(usuarioId)}; Path=/api/m/${mesaId}; HttpOnly; SameSite=Lax; Max-Age=31536000`;
}
