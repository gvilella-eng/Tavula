// 12-1: os textos de "Conectar o Claude" num lugar só. O servidor MCP (12-2, `apps/mcp`) escreve o comando final: troque
// `COMANDO_DO_SERVIDOR_MCP` e os dois modelos abaixo; nada mais na tela depende deles.

/** O comando que sobe o servidor MCP (provisório até o 12-2). */
export const COMANDO_DO_SERVIDOR_MCP = "node apps/mcp/dist/index.js";

/** O endereço do WebSocket desta mesa, que o servidor MCP abre com `Authorization: Bearer <token>`. */
export function urlDoWebSocketDaMesa(mesaId: string, origem: string = location.origin): string {
  const url = new URL(origem);
  const protocolo = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${url.host}/api/m/${mesaId}/ws`;
}

/** O comando para o Claude Code (provisório até o 12-2). */
export function comandoDoClaudeCode(url: string, token: string): string {
  return `claude mcp add tavola --env TAVOLA_URL=${url} --env TAVOLA_TOKEN=${token} -- ${COMANDO_DO_SERVIDOR_MCP}`;
}

/** O trecho do `claude_desktop_config.json` para o Claude Desktop (provisório até o 12-2). */
export function configDoClaudeDesktop(url: string, token: string): string {
  const [comando = "node", ...argumentos] = COMANDO_DO_SERVIDOR_MCP.split(" ");
  return JSON.stringify(
    {
      mcpServers: {
        tavola: {
          command: comando,
          args: argumentos,
          env: { TAVOLA_URL: url, TAVOLA_TOKEN: token },
        },
      },
    },
    null,
    2,
  );
}

/** "há 5 min", "há 2 h", "agora": quanto faz que aconteceu (`agora` e `emMs` em ms desde 1970). */
export function haQuanto(emMs: number, agora: number = Date.now()): string {
  const s = Math.max(0, Math.round((agora - emMs) / 1000));
  if (s < 45) return "agora";
  const min = Math.round(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

/** Data e hora curtas ("13/11 14:05") do instante `ms`. */
export function dataCurta(ms: number): string {
  const d = new Date(ms);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}
