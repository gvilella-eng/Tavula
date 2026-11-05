/**
 * Quem é o usuário desta requisição? Em desenvolvimento, o cookie `tabletop_usuario` basta
 * (seção 4.6 do plano). Um login real troca só a implementação desta interface.
 */
export interface Autenticacao {
  /** Id do usuário indicado pela requisição, ou `null`. Não confere se o usuário existe. */
  identificar(request: Request): string | null;
  /** Valor do cabeçalho `Set-Cookie` que registra a entrada do usuário. */
  cabecalhoDeEntrada(usuarioId: string): string;
  /** Valor do cabeçalho `Set-Cookie` que apaga a sessão. */
  cabecalhoDeSaida(): string;
}

export const NOME_DO_COOKIE = "tabletop_usuario";

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

export class AutenticacaoDev implements Autenticacao {
  identificar(request: Request): string | null {
    return lerCookie(request.headers.get("Cookie"), NOME_DO_COOKIE);
  }

  cabecalhoDeEntrada(usuarioId: string): string {
    return `${NOME_DO_COOKIE}=${encodeURIComponent(usuarioId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
  }

  cabecalhoDeSaida(): string {
    return `${NOME_DO_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }
}
