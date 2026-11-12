/**
 * Confere o cabeçalho `Origin` (C3): fecha o sequestro de WebSocket entre sites (além do `SameSite=Lax`) e o
 * POST de outro site. Vale no upgrade do WebSocket e em todo `POST` de `/api/`.
 *
 * - Sem `Origin` (clientes que não mandam), aceita (assumido).
 * - Com `Origin`, o host dele tem de ser o do próprio pedido (o do servidor; no dev, o do Vite, que repassa o
 *   `Host`). Esquema e porta entram na comparação do host.
 * - Pedido local (host de loopback): aceita também qualquer origem de loopback, porque no dev o proxy pode
 *   reescrever o `Host`. Na internet o host nunca é de loopback, então vale só o mesmo host.
 */
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function origemPermitida(origin: string | null, url: URL): boolean {
  if (origin === null) return true;
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    return false; // "null" (iframe isolado, arquivo local) e lixo
  }
  if (o.protocol !== "http:" && o.protocol !== "https:") return false;
  if (o.host === url.host) return true;
  return LOOPBACK.has(url.hostname) && LOOPBACK.has(o.hostname);
}
