# Protocolo cliente ↔ sala

## Versão atual: v1 (Lotes 1 e 2)

Os schemas zod ficam em `packages/shared/src/protocolo.ts` e `estado.ts`; a lógica pura (conferir
capacidade, aplicar, filtrar por papel) em `nucleo.ts` e `capacidades.ts`. O cliente e a sala validam
as mensagens com os mesmos schemas e aplicam eventos com a mesma função (`reduzir`). O Lote 2 acrescentou
cenas, tokens e o movimento ao vivo **sem mudar o número do protocolo**: só entraram mensagens novas.

### Conexão e autenticação (dev)

- O front usa a mesma origem para tudo; o Vite faz proxy de `/ws`, `/api` e `/teste` para o Worker.
- A identidade vem do cookie `tabletop_usuario` (interface `Autenticacao`, implementação
  `AutenticacaoDev`). Em dev, quem escolhe o mestre na tela de entrada é mestre.
- Rotas HTTP do Worker:

| Rota | O que faz |
|---|---|
| `GET /saude` | `ok` |
| `GET /api/usuarios` | lista `{ id, nome, cor }` para a tela de entrada |
| `POST /api/entrar` `{ usuarioId }` | valida o usuário e grava o cookie (404 se não existe) |
| `POST /api/sair` | apaga o cookie (204) |
| `GET /api/eu` | usuário da sessão (`{ id, nome, cor }`) ou 401 |
| `GET /ws` (Upgrade) | WebSocket da sala; sem usuário válido: 401 |
| `POST /teste/zerar`, `POST /teste/reiniciar-sala` | **só com `MODO=teste`** (script `dev:e2e`); fora disso 404 |

- A sala (Durable Object `Sala`, `idFromName("campanha")`) usa a WebSocket Hibernation API. Quem é
  cada socket fica no `serializeAttachment` (`usuarioId`, `conexaoId`).
- Ao conectar, a sala manda `snapshot`, `presenca` e (se mestre) `uso`.

### Envelope

- Cliente → sala: `{ "v": 1, "id": "<id do pedido, gerado no cliente>", "tipo": "<intenção>", "dados": { ... } }`.
- Sala → cliente: `{ "v": 1, "tipo": "<mensagem>", "dados": { ... } }`.
- Só texto JSON. Frames binários chegam num lote futuro (assets). Mensagem inválida (JSON quebrado,
  `v` diferente de 1, tipo desconhecido, dados fora do schema, binário) nunca derruba a conexão: a
  sala responde `erro` com `mensagem_invalida`.

### Intenções (cliente → sala)

Toda intenção declara a capacidade exigida (`capacidadeDaIntencao`); a sala confere em toda mensagem.
Sem a capacidade: `erro` com `sem_permissao`.

**Quem move um token** (`token.mover` e `token.soltar`): o mestre, qualquer token; o jogador, só se
`pode(eu, "token.moverProprio")` **e** o id dele está em `controladoPor` **e** o token é visível para ele.
Token invisível para quem pergunta (oculto ou da camada do mestre) responde `token_inexistente`, igual a um
id que não existe: a resposta não revela nada. **Posição fora da cena é limitada à borda** (o centro do token
fica dentro de `0..larguraM` × `0..alturaM`), não recusada.

| `tipo` | `dados` | Capacidade exigida | Efeito |
|---|---|---|---|
| `nota.editar` | `{ texto }` (até 20 000 caracteres) | `nota.editar` (delegável) | muda a nota da mesa, que todos veem |
| `notaMestre.editar` | `{ texto }` | `camadaMestre.ver` (só do mestre) | muda a nota que só mestres recebem |
| `papel.alterar` | `{ usuarioId, papel: "mestre" \| "jogador" }` | `papel.alterar` (só do mestre) | muda o papel; recusa deixar a mesa sem mestre (`ultimo_mestre`) |
| `permissao.alterar` | `{ capacidade, valor: boolean \| null, usuarioId? }` | `permissao.alterar` (só do mestre) | sem `usuarioId`: muda o padrão da mesa; com `usuarioId`: exceção do usuário; `valor: null` (só com `usuarioId`) remove a exceção. Capacidade exclusiva do mestre: `capacidade_nao_delegavel` |
| `token.criar` | `{ token: { id, nome, cor, tamanhoQuadrados 1..4, x, y, camada, oculto, controladoPor } }` (o `id` vem do cliente; a sala põe o `cenaId` da cena ativa e limita a posição à cena) | `cena.editar` (só do mestre) | cria o token; `dados_invalidos` se o id já existe |
| `token.editar` | `{ id, mudancas: { nome?, cor?, tamanhoQuadrados?, camada?, oculto?, controladoPor? } }` | `cena.editar` | muda o token; sem mudança real não gera evento |
| `token.apagar` | `{ id }` | `cena.editar` | apaga o token |
| `cena.configurarGrid` | `{ quadradoM?, visivel? }` (quadrado de 0,3 a 10 m) | `cena.editar` | muda o grid da cena ativa |
| `token.mover` | `{ id, x, y }` (metros, centro do token) | `token.moverProprio` | **transitório**: não grava, não gera `seq`, não muda o estado; a sala repassa `token.movendo` (abaixo). Limite do cliente: 20 por segundo por arraste |
| `token.soltar` | `{ id, x, y }` | `token.moverProprio` | grava e gera o evento `token.movido` (sempre, mesmo sem mudança de posição: quem viu o movimento ao vivo precisa da posição final) |
| `campanha.exportar` | `{}` | `campanha.exportar` (só do mestre) | a sala responde `exportacao` a quem pediu |
| `campanha.importar` | `{ dados }`: o arquivo de exportação inteiro | `campanha.importar` (só do mestre) | substitui o estado inteiro e manda snapshot novo a todos |

### Mensagens da sala (sala → cliente)

| `tipo` | `dados` | Quem recebe |
|---|---|---|
| `snapshot` | `{ usuarioId, estado }` (estado filtrado, com `seq`) | cada usuário recebe o dele, ao conectar, ao mudar de papel e após importação |
| `evento` | `{ seq, origem: { usuarioId, idPedido }, tipo, dados }` | todos, filtrado por papel (abaixo) |
| `presenca` | `{ usuarios: { [id]: "online" \| "reconectando" \| "offline" } }` | todos, a cada mudança |
| `uso` | `{ dia, mensagens, conexoes, requisicoes, percentual }` | **só mestres** |
| `erro` | `{ idPedido: string \| null, codigo, mensagem }` | só quem enviou |
| `exportacao` | `{ idPedido, exportacao }` | **só o mestre que pediu** |
| `token.movendo` | `{ id, x, y }` | **transitório** (sem `seq`, não gravado): só quem pode ver o token, **menos o remetente**. Nunca vai a um jogador para token oculto ou da camada do mestre. Se quem arrastava cai antes do `token.soltar`, a sala manda um `token.movendo` com a **posição gravada**, para ninguém ficar com o token num lugar que não existe |

Códigos de erro: `mensagem_invalida`, `sem_permissao`, `ultimo_mestre`, `usuario_inexistente`,
`capacidade_nao_delegavel`, `importacao_invalida`, `token_inexistente`, `dados_invalidos`.

### Eventos (`evento.dados.tipo`)

| Evento | `dados` | Quem recebe |
|---|---|---|
| `nota.alterada` | `{ texto }` | todos |
| `notaMestre.alterada` | `{ texto }` | **só mestres** |
| `papel.alterado` | `{ usuarioId, papel }` | todos, **exceto** o usuário que mudou (ele recebe snapshot novo) |
| `permissao.alterada` | `{ capacidade, valor, usuarioId? }` | padrão da mesa: todos; exceção por usuário: mestres e o próprio usuário |
| `token.criado` | `{ token }` | mestres; jogador só se o token é visível |
| `token.editado` | `{ token }` (o token inteiro depois da mudança; o cliente faz upsert) | mestres; jogador conforme a tabela de sigilo abaixo |
| `token.apagado` | `{ id }` | mestres; jogador só se o token era visível para ele |
| `token.movido` | `{ id, x, y }` (posição final gravada) | mestres; jogador só se o token é visível |
| `token.sumiu` | `{ id }` | **só jogadores**, e só gerado pelo filtro: o token deixou de ser visível para ele. Sem motivo |
| `cena.gridAlterado` | `{ cenaId, grid }` | todos |

#### Sigilo dos tokens

Visível para um usuário = mestre (vê tudo) **ou** `camada === "tokens"` e `oculto === false`. O filtro
(`eventoPara(evento, usuario, antes, depois)`) conhece o estado de antes e de depois de cada intenção:

| O que aconteceu com o token | Mestre | Jogador |
|---|---|---|
| criado | `token.criado` | `token.criado` se visível; senão nada |
| editado, visível antes e depois | `token.editado` | `token.editado` |
| editado, **passou a ser visível** (revelado ou voltou da camada do mestre) | `token.editado` | `token.editado` com o token inteiro (upsert) |
| editado, **deixou de ser visível** (escondido ou foi para a camada do mestre) | `token.editado` | **só `token.sumiu { id }`**: nem nome, nem cor, nem motivo |
| editado, invisível antes e depois | `token.editado` | nada |
| apagado | `token.apagado` | `token.apagado` se era visível; senão nada |
| movido (`token.movido`) | `token.movido` | só se visível |
| `token.movendo` | repassado | só se visível (e nunca ao remetente) |

Sem o estado de antes e de depois a função falha fechada (o jogador não recebe o evento). O snapshot de
um jogador também não traz os tokens invisíveis (`visaoPara`). O cliente aplica tudo com o mesmo `reduzir`.

### Estado (snapshot)

```
Estado { seq, usuarios: Usuario[], permissoes: Permissoes, notaMesa, notaMestre?,
         cenas: Cena[], cenaAtivaId, tokens: Token[] }
Cena  { id, nome, larguraM, alturaM, grid: { quadradoM, visivel } }          // padrão: cena-1, 60 x 45 m, quadrado 1,5 m
Token { id, cenaId, nome, cor, tamanhoQuadrados (1..4), x, y /* centro, em metros */,
        camada: "tokens" | "mestre", oculto, controladoPor: string[] /* ids de usuário */ }
Usuario { id, nome, papel: "mestre" | "jogador" | "assistente", cor }
Permissoes { jogadores: Record<CapacidadeDelegavel, boolean>, porUsuario: Record<id, Partial<Record<CapacidadeDelegavel, boolean>>> }
```

- `permissoes.jogadores` só tem capacidades delegáveis (as exclusivas do mestre nunca são
  configuráveis).
- **Jogador** (e assistente): `notaMestre` não existe no snapshot e `porUsuario` só traz a entrada dele.
- **Jogador**: `tokens` só tem os que ele pode ver (camada `tokens` e não ocultos).
- **Mestre**: recebe tudo.

### `seq` e saltos

`seq` é global da sala, gravado no SQLite e crescente: cada evento aplicado ocupa o próximo número.
Como a sala filtra por papel, **o jogador vê saltos em `seq`** (por exemplo, `notaMestre.alterada` ocupa
um número que ele nunca recebe). Isso é esperado e não indica perda de mensagem; o cliente só ignora
eventos com `seq` menor ou igual ao do seu estado (duplicados ou atrasados). Quem reconecta recebe um
snapshot completo e volta a acompanhar.

### Presença

- `online`: tem pelo menos um socket aberto.
- `reconectando`: fechou o último socket há menos de 10 s; o fim do prazo vem pelo agendador (alarme).
- `offline`: demais casos.

### Capacidades

Delegáveis (o mestre liga ou desliga o padrão da mesa e abre exceção por usuário):
`nota.editar` (entidade de teste do Lote 1), `token.moverProprio` (mover um token que controla), `porta.abrir`, `tocha.acender`,
`tocha.entregar`, `ponto.usar`, `luz.apagar`, `ficha.verOutras`, `dado.rolarOculto`, `asset.subir`.

Só do mestre, nunca delegáveis: `papel.alterar`, `permissao.alterar`, `mesa.configurar`,
`automacao.editar`, `camadaMestre.ver`, `cena.editar` (criar, editar e apagar tokens; grid), `objeto.ajustar`,
`campanha.exportar`, `campanha.importar`.

Regra de `pode(usuario, capacidade, permissoes)`: mestre sempre; assistente nunca (por enquanto);
jogador: nunca as exclusivas do mestre; senão a exceção por usuário, se houver, senão o padrão da mesa.

### Exportação

`{ formato: "tabletop-campanha", versao: 2, exportadoEm, dados: { seq, usuarios, permissoes, notaMesa, notaMestre, cenas, cenaAtivaId, tokens } }`.
Sem contadores de uso nem presença. A **v1** (Lote 1, sem `cenas`, `cenaAtivaId` nem `tokens`) continua sendo aceita na
importação: vira a cena padrão e nenhum token. Na importação a sala valida com zod e ainda exige: ids de usuário
únicos, pelo menos um mestre, exceções só para usuários existentes, ids de cena e de token únicos, cena ativa
existente, tokens em cenas existentes e controlados por usuários existentes, e que **quem importa continue
mestre** na campanha importada. A importação substitui tudo e manda snapshot novo a todos; sockets de
usuários que sumiram são fechados. O `seq` **nunca volta**: fica no maior entre o atual e o do arquivo,
para nenhum número já enviado ser reaproveitado. Capacidade delegável que o arquivo não traz (criada
depois da exportação) entra com o padrão da mesa.

### Contador de uso

A sala conta as mensagens recebidas por dia UTC e as conexões. `requisicoes = mensagens / 20 + conexoes`;
`percentual` é sobre 100 mil por dia. Grava no SQLite a cada 50 mensagens (e a cada conexão) e envia
`uso` aos mestres no snapshot, a cada 50 mensagens ou, no máximo, a cada ~5 s (o resto fica para o
agendador).
