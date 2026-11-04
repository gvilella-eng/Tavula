import { DurableObject } from "cloudflare:workers";
import { ecoDe } from "@tabletop/shared";

/** O valor do cabeçalho Upgrade não diferencia maiúsculas ("websocket", "WebSocket"). */
export function pedeWebSocket(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

/** A sala da campanha. No Lote 0 só devolve (eco) o que recebe. */
export class Sala extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    if (!pedeWebSocket(request)) {
      return new Response("Esperava WebSocket", { status: 426 });
    }
    const par = new WebSocketPair();
    const [cliente, servidor] = [par[0], par[1]];
    // Hibernation API: o runtime cuida do socket; nunca usar servidor.accept().
    this.ctx.acceptWebSocket(servidor);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  override webSocketMessage(ws: WebSocket, mensagem: string | ArrayBuffer): void {
    if (typeof mensagem === "string") ws.send(ecoDe(mensagem));
  }

  override webSocketClose(ws: WebSocket, codigo: number, motivo: string): void {
    // Códigos reservados (ex.: 1005/1006) não podem ser enviados no close.
    ws.close(codigo >= 1000 && codigo <= 1003 ? codigo : 1000, motivo);
  }

  override webSocketError(ws: WebSocket, _erro: unknown): void {
    ws.close(1011, "erro");
  }
}
