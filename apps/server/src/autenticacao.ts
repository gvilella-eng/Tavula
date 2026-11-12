/**
 * Quem é o usuário desta requisição? Em desenvolvimento, o cookie `tabletop_sessao` basta (seção 4.6 do
 * plano); desde o C1 ele vale por mesa (`Path=/api/m/<id>`). Um login real troca só a implementação
 * desta interface.
 */
export interface Autenticacao {
  /** Id do usuário indicado pela requisição, ou `null`. Não confere se o usuário existe. */
  identificar(request: Request): string | null;
  /** Valor do cabeçalho `Set-Cookie` que registra a entrada do usuário na mesa `mesaId`. */
  cabecalhoDeEntrada(usuarioId: string, mesaId: string): string;
  /** Valores do cabeçalho `Set-Cookie` que apagam a sessão na mesa `mesaId`. */
  cabecalhosDeSaida(mesaId: string): string[];
}

/** O cookie de antes do C1 (`Path=/`, valia em toda parte): nunca mais é lido, só apagado na saída. */
export const COOKIE_ANTIGO = "tabletop_usuario";
export const NOME_DO_COOKIE = "tabletop_sessao";

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
  /** O navegador só manda o cookie de uma mesa para as rotas dela (o `Path`); aqui basta lê-lo. */
  identificar(request: Request): string | null {
    return lerCookie(request.headers.get("Cookie"), NOME_DO_COOKIE);
  }

  cabecalhoDeEntrada(usuarioId: string, mesaId: string): string {
    return `${NOME_DO_COOKIE}=${encodeURIComponent(usuarioId)}; Path=/api/m/${mesaId}; HttpOnly; SameSite=Lax; Max-Age=31536000`;
  }

  cabecalhosDeSaida(mesaId: string): string[] {
    return [
      `${NOME_DO_COOKIE}=; Path=/api/m/${mesaId}; HttpOnly; SameSite=Lax; Max-Age=0`,
      `${COOKIE_ANTIGO}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    ];
  }
}
