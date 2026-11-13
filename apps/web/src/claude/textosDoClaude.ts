// 12-1/12-2: os textos de "Conectar o Claude" num lugar só: o comando final do servidor MCP (`apps/mcp`) para o Claude Code e o
// trecho do Claude Desktop, com o endereço da mesa tirado da página que a pessoa está usando e o token já colado.

/** O arquivo que o `pnpm --filter @tabletop/mcp build` gera (a partir da pasta do Távola). */
export const ARQUIVO_DO_SERVIDOR_MCP = "apps/mcp/dist/tavola-mcp.mjs";

/** O comando que gera o arquivo acima (uma vez, depois de baixar ou atualizar o Távola). */
export const COMANDO_PARA_GERAR_O_SERVIDOR_MCP = "pnpm --filter @tabletop/mcp build";

/** O que a pessoa troca no trecho do Claude Desktop: lá o caminho precisa ser completo. */
export const CAMINHO_DO_SERVIDOR_NO_DESKTOP = `<pasta do Távola>/${ARQUIVO_DO_SERVIDOR_MCP}`;

/** A origem da página (`http://127.0.0.1:5173`): é o endereço da mesa que o servidor MCP abre (o WebSocket é o mesmo do navegador). */
export function origemDaMesa(origem: string = location.origin): string {
  return new URL(origem).origin;
}

/** O endereço do WebSocket desta mesa, que o servidor MCP abre com `Authorization: Bearer <token>`. */
export function urlDoWebSocketDaMesa(mesaId: string, origem: string = location.origin): string {
  const url = new URL(origem);
  const protocolo = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${url.host}/api/m/${mesaId}/ws`;
}

/** O comando para o Claude Code (rode na pasta do Távola, depois de gerar o servidor). */
export function comandoDoClaudeCode(origem: string, mesaId: string, token: string): string {
  return `claude mcp add tavola --env TAVOLA_URL=${origem} --env TAVOLA_MESA=${mesaId} --env TAVOLA_TOKEN=${token} -- node ${ARQUIVO_DO_SERVIDOR_MCP}`;
}

/** O trecho do `claude_desktop_config.json` para o Claude Desktop. */
export function configDoClaudeDesktop(origem: string, mesaId: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        tavola: {
          command: "node",
          args: [CAMINHO_DO_SERVIDOR_NO_DESKTOP],
          env: { TAVOLA_URL: origem, TAVOLA_MESA: mesaId, TAVOLA_TOKEN: token },
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
