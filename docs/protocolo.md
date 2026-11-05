# Protocolo cliente ↔ sala

## Versão atual: v1 (Lotes 1, 2 e 3)

Os schemas zod ficam em `packages/shared/src/protocolo.ts` e `estado.ts`; a lógica pura (conferir
capacidade, aplicar, filtrar por papel) em `nucleo.ts` e `capacidades.ts`. O cliente e a sala validam
as mensagens com os mesmos schemas e aplicam eventos com a mesma função (`reduzir`). O Lote 2 acrescentou
cenas, tokens e o movimento ao vivo, e o Lote 3 os assets locais (mapa, imagem de token, frames binários)
**sem mudar o número do protocolo**: só entraram mensagens novas.

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
- JSON em texto, mais **frames binários só para pedaços de arquivo** (ver "Frame binário de pedaço"). Mensagem
  de texto inválida (JSON quebrado, `v` diferente de 1, tipo desconhecido, dados fora do schema) nunca
  derruba a conexão: a sala responde `erro` com `mensagem_invalida`. Frame binário que não é um pedaço
  pedido àquele socket é **descartado em silêncio** (sem erro, sem repasse).

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
| `token.criar` | `{ token: { id, nome, cor, tamanhoQuadrados 1..4, x, y, camada, oculto, controladoPor, assetHash? } }` (o `id` vem do cliente; a sala põe o `cenaId` da cena ativa e limita a posição à cena) | `cena.editar` (só do mestre) | cria o token; `dados_invalidos` se o id já existe; `asset_inexistente` se `assetHash` não é uma imagem (`token`/`retrato`) registrada |
| `token.editar` | `{ id, mudancas: { nome?, cor?, tamanhoQuadrados?, camada?, oculto?, controladoPor?, assetHash?: hash \| null } }` | `cena.editar` | muda o token (`assetHash: null` tira a imagem); sem mudança real não gera evento |
| `asset.registrar` | `{ metas: MetaNova[] }` (1 a 65; tiles antes do manifesto, ou no mesmo lote) | `asset.subir` (mestre sempre) | registra os metadados (nunca bytes); o `donoId` é quem mandou. Hash que já existe: nada muda (nem o dono). Jogador só registra `token`/`retrato` (`sem_permissao` para `mapa`/`tile`). `dados_invalidos` se a meta fere os limites (30 MB por arquivo, 64 tiles, 200 MB por mapa, pedaços que não batem com o tamanho, tile fora do mapa, manifesto citando tile não registrado) |
| `asset.pedir` | `{ hash, faltam?: number[] }` | nenhuma (mestre ou jogador) | a sala responde `asset.meta` e, se há bytes, organiza o envio dos pedaços `faltam` (sem `faltam`: todos). Asset que não existe **ou que a pessoa não vê**: `erro` `asset_inexistente`, igual nos dois casos. Ninguém online com cópia: `asset.indisponivel` |
| `asset.inventario` | `{ hashes: string[] }` (até 5000) | nenhuma | o que este navegador tem no cache, mandado ao conectar; **substitui** o que a sala sabia desta conexão. Só vale para assets que a sala conhece **e que a pessoa vê** (senão um jogador poderia ser chamado a servir a imagem de um token oculto) |
| `asset.tenho` | `{ hash }` | nenhuma | esta conexão passou a ter o arquivo completo (conferido). Mesma regra: só vale para asset que a pessoa vê |
| `asset.naoTenho` | `{ hash }` | nenhuma | esta conexão não tem (mais) o arquivo; se ela estava servindo, a sala pede o que falta a outro |
| `cena.definirMapa` | `{ assetHash: hash \| null, pxPorQuadrado? }` (10 a 1000; padrão 70, ou o atual) | `cena.editar` | põe (ou, com `null`, tira) o mapa da cena ativa. A cena passa a ter o tamanho dele: metros = px ÷ `pxPorQuadrado` × `quadradoM` (máx. 1000 m, senão `dados_invalidos`). `asset_inexistente` se o hash não é um `mapa` registrado |
| `token.definirImagem` | `{ id, assetHash: hash \| null }` | `asset.subir` (mestre sempre) | jogador: só no token que **controla e vê**, com qualquer imagem de token (`token`/`retrato`) registrada — inclusive a mesma arte que outro registrou antes (mesmo hash); mestre: qualquer token. Token invisível: `token_inexistente`; hash que não é imagem de token registrada: `asset_inexistente` |
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
| `asset.meta` | `{ meta }` | **só quem pediu** (`asset.pedir`) e **só se vê o asset**; nunca em broadcast |
| `asset.enviar` | `{ hash, indices: number[] }` | **só o provedor escolhido**: mande estes pedaços como frames binários |
| `asset.indisponivel` | `{ hash }` | quem pediu e ficou sem provedor; a sala retoma sozinha quando alguém com cópia conectar |
| *(frame binário)* | pedaço, ver abaixo | só quem espera aquele pedaço (repassado pela sala, sem gravar) |
| `token.movendo` | `{ id, x, y }` | **transitório** (sem `seq`, não gravado): só quem pode ver o token, **menos o remetente**. Nunca vai a um jogador para token oculto ou da camada do mestre. Se quem arrastava cai antes do `token.soltar`, a sala manda um `token.movendo` com a **posição gravada**, para ninguém ficar com o token num lugar que não existe |

Códigos de erro: `mensagem_invalida`, `sem_permissao`, `ultimo_mestre`, `usuario_inexistente`,
`capacidade_nao_delegavel`, `importacao_invalida`, `token_inexistente`, `dados_invalidos`,
`asset_inexistente` (asset que não existe **ou** que a pessoa não pode ver: a resposta é idêntica).

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
| `cena.gridAlterado` | `{ cenaId, grid, larguraM?, alturaM? }` (com mapa, mudar o quadrado muda o tamanho da cena: vem junto) | todos |
| `cena.mapaAlterado` | `{ cenaId, mapa: { assetHash, pxPorQuadrado } \| null, larguraM, alturaM }` | todos (o mapa da cena ativa é visível a todos) |
| `asset.registrado` | `{ meta }` | **só mestres** (as metas dos jogadores chegam por `asset.meta`, sob demanda) |

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
         cenas: Cena[], cenaAtivaId, tokens: Token[], assets?: AssetMeta[] /* só na visão do mestre */ }
Cena  { id, nome, larguraM, alturaM, grid: { quadradoM, visivel },          // padrão: cena-1, 60 x 45 m, quadrado 1,5 m
        mapa?: { assetHash, pxPorQuadrado } }
Token { id, cenaId, nome, cor, tamanhoQuadrados (1..4), x, y /* centro, em metros */,
        camada: "tokens" | "mestre", oculto, controladoPor: string[] /* ids de usuário */,
        assetHash?: string /* imagem do token; sem ela vale o círculo gerado */ }
AssetMeta { hash /* SHA-256 hex do arquivo processado */, tipo: "mapa" | "token" | "retrato" | "tile",
            mime, bytes, largura, altura, donoId, nomeOriginal,
            pedacos: string[] /* SHA-256 de cada pedaço de 256 KB */,
            tiles?: { hash, x, y, largura, altura }[] /* só no manifesto de mapa fatiado */ }
Usuario { id, nome, papel: "mestre" | "jogador" | "assistente", cor }
Permissoes { jogadores: Record<CapacidadeDelegavel, boolean>, porUsuario: Record<id, Partial<Record<CapacidadeDelegavel, boolean>>> }
```

- `permissoes.jogadores` só tem capacidades delegáveis (as exclusivas do mestre nunca são
  configuráveis).
- **Jogador** (e assistente): `notaMestre` não existe no snapshot e `porUsuario` só traz a entrada dele.
- **Jogador**: `tokens` só tem os que ele pode ver (camada `tokens` e não ocultos).
- **Mestre**: recebe tudo, inclusive `assets` (as metas). **Jogador**: `assets` nunca existe no snapshot.

### Assets locais (Lote 3)

**A sala nunca guarda imagem.** Os arquivos ficam na pasta e no cache OPFS de cada navegador; a sala guarda
só metadados (SQLite, coleção `assets`) e **quem tem cada arquivo** (tabela `posse`: conexão, usuário, hash;
refeita pelo `asset.inventario` ao conectar, limpa quando o socket fecha e, ao acordar, para conexões que não
existem mais). Só entra na sala o arquivo que alguém **usa** (mapa de uma cena, imagem de um token).

**Frame binário de pedaço** (`[1 byte tipo][32 bytes hash][uint32 índice BE][uint32 total BE][dados]`, tipo `1`,
dados de até 256 KB):

- o provedor manda um frame por pedaço pedido (`asset.enviar`), respeitando o `bufferedAmount` do socket;
- a sala só aceita o frame se pediu **aquele hash e aquele índice àquele socket** (e o `total` bate com a
  meta); senão descarta em silêncio. Aceito, repassa o mesmo frame a **todos** que esperam aquele pedaço
  (o dono envia uma vez, não sete) e não grava nada;
- quem recebe confere o pedaço pelo `meta.pedacos[índice]` (corrompido: pede de novo só ele com
  `asset.pedir { hash, faltam: [i] }`), no fim confere o SHA-256 do arquivo, grava no OPFS e manda `asset.tenho`;
- pedaços conferidos ficam em disco: refresh ou queda retoma pedindo só os `faltam`.

**Quem serve** (`escolherProvedor`): o dono online, depois o mestre, depois qualquer conexão com cópia; quem
espera o arquivo nunca serve a si mesmo. Provedor que responde `asset.naoTenho` ou cai: a sala pede o que
falta a outro. Ninguém tem: `asset.indisponivel` e a espera continua (retoma quando alguém com cópia
conectar, por inventário ou `asset.tenho`). Um provedor só por hash de cada vez. As transferências em curso
ficam só em memória (enquanto há tráfego a sala não hiberna); se ela hibernar, o cliente pergunta de novo
(vigia de 20 s sem progresso). Orçamento: cada frame recebido pela sala conta como mensagem (20 = 1
requisição), então um arquivo de 30 MB custa cerca de 6 requisições.

**Mapa fatiado:** o `asset` do mapa vira um **manifesto** (`tiles`, `bytes: 0`, sem pedaços; o `hash` é o
SHA-256 do texto canônico dos tiles) e cada tile é um asset `tile` (até 4096 px de lado). Pedir o manifesto
devolve só a meta; o cliente pede cada tile.

**Sigilo de asset** (`assetVisivelPara`): o mestre vê tudo o que existe; o jogador só vê (1) o que é dele
(`donoId`), (2) a imagem de um token **visível para ele**, (3) o mapa da **cena ativa** e (4) os tiles desse
mapa. Consequências: a meta, o hash e os pedaços de um asset invisível nunca chegam ao jogador; o hash da
imagem de um token oculto nunca chega (ele vai junto com o token, que o jogador não recebe); pedir esse
hash responde `asset_inexistente`, **igual** a pedir um que não existe; o snapshot do jogador não leva
`assets`. Quando o token é revelado, o `token.editado` leva o `assetHash` e o jogador pede o arquivo.

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

`asset.subir` cobre `asset.registrar` e `token.definirImagem`. As intenções de vaivém de arquivos
(`asset.pedir`, `asset.inventario`, `asset.tenho`, `asset.naoTenho`) não exigem capacidade
(`capacidadeDaIntencao` = `null`): qualquer mestre ou jogador pode, porque o sigilo é conferido sobre o
asset e quem não pode subir ainda precisa ver o mapa.

Regra de `pode(usuario, capacidade, permissoes)`: mestre sempre; assistente nunca (por enquanto);
jogador: nunca as exclusivas do mestre; senão a exceção por usuário, se houver, senão o padrão da mesa.

### Exportação

`{ formato: "tabletop-campanha", versao: 3, exportadoEm, dados: { seq, usuarios, permissoes, notaMesa, notaMestre, cenas, cenaAtivaId, tokens, assets } }`.
Sem contadores de uso nem presença. `assets` são **só as metas dos assets usados** (mapas das cenas, imagens
dos tokens e os tiles deles), **nunca bytes**; `Cena.mapa` e `Token.assetHash` vão nos próprios objetos. A **v2**
(Lote 2, sem `assets`) e a **v1** (Lote 1, sem `cenas`, `cenaAtivaId` nem `tokens`) continuam sendo aceitas na
importação: a v2 vira v3 com `assets: []`; a v1 vira a cena padrão e nenhum token. Quem importa um mapa precisa
de alguém online com os arquivos (o cache dos navegadores serve; se ninguém tiver, o jogo mostra "indisponível").
Na importação a sala valida com zod e ainda exige: ids de usuário
únicos, pelo menos um mestre, exceções só para usuários existentes, ids de cena e de token únicos, cena ativa
existente, tokens em cenas existentes e controlados por usuários existentes, assets válidos (limites, dono
existente, tiles com meta) e referenciados por `Cena.mapa`/`Token.assetHash` com meta no arquivo, e que **quem importa continue
mestre** na campanha importada. A importação substitui tudo e manda snapshot novo a todos; sockets de
usuários que sumiram são fechados. O `seq` **nunca volta**: fica no maior entre o atual e o do arquivo,
para nenhum número já enviado ser reaproveitado. Capacidade delegável que o arquivo não traz (criada
depois da exportação) entra com o padrão da mesa.

### Contador de uso

A sala conta as mensagens recebidas por dia UTC e as conexões. `requisicoes = mensagens / 20 + conexoes`;
`percentual` é sobre 100 mil por dia. Grava no SQLite a cada 50 mensagens (e a cada conexão) e envia
`uso` aos mestres no snapshot, a cada 50 mensagens ou, no máximo, a cada ~5 s (o resto fica para o
agendador).
