# Protocolo cliente ↔ sala

## Versão atual: v0 (Lote 0) — eco de texto

Provisório, só para provar o caminho navegador → Vite (proxy) → Worker → Durable Object `Sala`.
**O protocolo versionado com zod (campo `v`, `seq`, snapshot, intenções e eventos) começa no Lote 1**
e substitui este.

### Conexão

- Endpoint: `GET /ws` com `Upgrade: websocket`, na mesma origem do front (`http://127.0.0.1:5173`).
  O Vite faz proxy (`ws: true`) para o Worker em `127.0.0.1:8787`.
- O Worker repassa a conexão ao único Durable Object `Sala` (`idFromName("campanha")`).
- A sala usa a WebSocket Hibernation API (`ctx.acceptWebSocket`).
- Qualquer outra rota do Worker responde 404; `GET /saude` responde `ok`.

### Mensagens

| Direção | Formato | Comportamento |
|---|---|---|
| cliente → sala | texto (string) | a sala devolve **o mesmo texto** ao remetente (eco) |
| cliente → sala | binário | ignorado |
| sala → cliente | texto | só o eco; não há mensagem de boas-vindas nem difusão para outros clientes |

Sem validação, sem papéis, sem capacidades: nada disso existe ainda.
