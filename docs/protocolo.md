# Protocolo cliente ↔ sala

## Versão atual: v1 (Lotes 1, 2, 3 e 4)

Os schemas zod ficam em `packages/shared/src/protocolo.ts` e `estado.ts`; a lógica pura (conferir
capacidade, aplicar, filtrar por papel) em `nucleo.ts` e `capacidades.ts`. O cliente e a sala validam
as mensagens com os mesmos schemas e aplicam eventos com a mesma função (`reduzir`). O Lote 2 acrescentou
cenas, tokens e o movimento ao vivo, e o Lote 3 os assets locais (mapa, imagem de token, frames binários)
e o Lote 4 personagens, várias cenas e o pré-envio cifrado, tudo **sem mudar o número do protocolo**: só entraram
mensagens novas.

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
`pode(eu, "token.moverProprio")` **e** controla o token (é o **dono do personagem** do token **ou** o id dele
está em `controladoPor`, que o mestre usa para emprestar) **e** o token é visível para ele (da cena ativa).
Token invisível para quem pergunta (oculto, da camada do mestre ou de outra cena) responde `token_inexistente`, igual a um
id que não existe: a resposta não revela nada. **Posição fora da cena é limitada à borda** (o centro do token
fica dentro de `0..larguraM` × `0..alturaM`), não recusada.

| `tipo` | `dados` | Capacidade exigida | Efeito |
|---|---|---|---|
| `nota.editar` | `{ texto }` (até 20 000 caracteres) | `nota.editar` (delegável) | muda a nota da mesa, que todos veem |
| `notaMestre.editar` | `{ texto }` | `camadaMestre.ver` (só do mestre) | muda a nota que só mestres recebem |
| `papel.alterar` | `{ usuarioId, papel: "mestre" \| "jogador" }` | `papel.alterar` (só do mestre) | muda o papel; recusa deixar a mesa sem mestre (`ultimo_mestre`) |
| `permissao.alterar` | `{ capacidade, valor: boolean \| null, usuarioId? }` | `permissao.alterar` (só do mestre) | sem `usuarioId`: muda o padrão da mesa; com `usuarioId`: exceção do usuário; `valor: null` (só com `usuarioId`) remove a exceção. Capacidade exclusiva do mestre: `capacidade_nao_delegavel` |
| `token.criar` | `{ cenaId?, token: { id, nome, cor, tamanhoQuadrados 1..4, x, y, camada, oculto, controladoPor, assetHash?, personagemId? } }` (o `id` vem do cliente; a sala põe o `cenaId` pedido, ou o da cena ativa, e limita a posição à cena) | `cena.editar` (só do mestre) | cria o token; `cena_inexistente` se a cena não existe; `personagem_inexistente` se `personagemId` não existe; `dados_invalidos` se o id já existe; `asset_inexistente` se `assetHash` não é uma imagem (`token`/`retrato`) registrada |
| `token.editar` | `{ id, mudancas: { nome?, cor?, tamanhoQuadrados?, camada?, oculto?, controladoPor?, assetHash?: hash \| null } }` | `cena.editar` | muda o token (`assetHash: null` tira a imagem); sem mudança real não gera evento |
| `asset.registrar` | `{ metas: MetaNova[] }` (1 a 65; tiles antes do manifesto, ou no mesmo lote) | `asset.subir` (mestre sempre) | registra os metadados (nunca bytes); o `donoId` é quem mandou. Hash que já existe: nada muda (nem o dono). Jogador só registra `token`/`retrato` (`sem_permissao` para `mapa`/`tile`). `dados_invalidos` se a meta fere os limites (30 MB por arquivo, 64 tiles, 200 MB por mapa, pedaços que não batem com o tamanho, tile fora do mapa, manifesto citando tile não registrado) |
| `asset.pedir` | `{ hash, faltam?: number[] }` | nenhuma (mestre ou jogador) | a sala responde `asset.meta` e, se há bytes, organiza o envio dos pedaços `faltam` (sem `faltam`: todos). Asset que não existe **ou que a pessoa não vê**: `erro` `asset_inexistente`, igual nos dois casos. Ninguém online com cópia: `asset.indisponivel` |
| `asset.inventario` | `{ hashes: string[] }` (até 5000) | nenhuma | o que este navegador tem no cache, mandado ao conectar; **substitui** o que a sala sabia desta conexão. Só vale para assets que a sala conhece **e que a pessoa vê** (senão um jogador poderia ser chamado a servir a imagem de um token oculto) |
| `asset.tenho` | `{ hash }` | nenhuma | esta conexão passou a ter o arquivo completo (conferido). Mesma regra: só vale para asset que a pessoa vê |
| `asset.naoTenho` | `{ hash }` | nenhuma | esta conexão não tem (mais) o arquivo; se ela estava servindo, a sala pede o que falta a outro |
| `cena.definirMapa` | `{ cenaId?, assetHash: hash \| null, pxPorQuadrado? }` (10 a 1000; padrão 70, ou o atual) | `cena.editar` | põe (ou, com `null`, tira) o mapa da cena (`cenaId`; padrão: a ativa). A cena passa a ter o tamanho dele: metros = px ÷ `pxPorQuadrado` × `quadradoM` (máx. 1000 m, senão `dados_invalidos`). `asset_inexistente` se o hash não é um `mapa` registrado |
| `token.definirImagem` | `{ id, assetHash: hash \| null }` | `asset.subir` (mestre sempre) | jogador: só no token que **controla** (dono do personagem ou `controladoPor`) **e vê**, com qualquer imagem de token (`token`/`retrato`) registrada — inclusive a mesma arte que outro registrou antes (mesmo hash); mestre: qualquer token. Token invisível: `token_inexistente`; hash que não é imagem de token registrada: `asset_inexistente` |
| `token.apagar` | `{ id }` | `cena.editar` | apaga o token |
| `cena.configurarGrid` | `{ cenaId?, quadradoM?, visivel? }` (quadrado de 0,3 a 10 m) | `cena.editar` | muda o grid da cena (`cenaId`; padrão: a ativa) |
| `token.mover` | `{ id, x, y }` (metros, centro do token) | `token.moverProprio` | **transitório**: não grava, não gera `seq`, não muda o estado; a sala repassa `token.movendo` (abaixo). Limite do cliente: 20 por segundo por arraste |
| `token.soltar` | `{ id, x, y }` | `token.moverProprio` | grava e gera o evento `token.movido` (sempre, mesmo sem mudança de posição: quem viu o movimento ao vivo precisa da posição final) |
| `personagem.criar` | `{ personagem }` (`id` do cliente; `donoId` `null` = NPC, ou um jogador; `tokenPadrao { cor, tamanhoQuadrados, assetHash? }`; `visao { alcanceM \| null, visaoNoEscuroM }`; `ficha { pvAtual, pvMax }`) | `cena.editar` (só do mestre) | cria o personagem. `dados_invalidos` (id repetido), `usuario_inexistente` (dono que não é jogador), `asset_inexistente` (imagem) |
| `personagem.editar` | `{ id, mudancas: { nome?, donoId?, cor?, tamanhoQuadrados?, assetHash?: hash \| null, alcanceM?, visaoNoEscuroM?, pvAtual?, pvMax? } }` | `cena.editar` | muda o personagem; não muda os tokens já postos (cada token tem a própria cópia de nome, cor e imagem). `personagem_inexistente` |
| `personagem.apagar` | `{ id }` | `cena.editar` | apaga o personagem **e os tokens dele** (eventos `token.apagado` e depois `personagem.apagado`) |
| `personagem.colocar` | `{ personagemId, cenaId, tokenId, x?, y? }` | `cena.editar` | cria o token a partir do token padrão (camada `tokens`, visível, `personagemId`), na posição dada ou na **chegada** da cena (encaixada no grid). Personagem de jogador só tem **um** token (`dados_invalidos` se já tem) |
| `ficha.alterar` | `{ personagemId, pvAtual?, pvMax? }` (inteiros de 0 a 9999) | nenhuma (a regra é do dono; `null` em `capacidadeDaIntencao`) | o **dono** do personagem ou o mestre. `pvAtual` nunca passa de `pvMax` (a sala corta). Personagem que a pessoa não vê (NPC, ou de outro jogador sem `ficha.verOutras`): `personagem_inexistente`; visível mas de outro: `sem_permissao` |
| `cena.criar` | `{ id, nome }` | `cena.editar` | nova cena com o tamanho e o grid padrão (60 x 45 m, quadrado 1,5 m). `dados_invalidos` se o id existe |
| `cena.editar` | `{ cenaId, nome?, chegada?: { x, y } \| null }` | `cena.editar` | renomeia e/ou define a chegada do grupo (limitada à cena; `null` volta ao centro). `cena_inexistente` |
| `cena.duplicar` | `{ cenaId, novoId }` | `cena.editar` | copia a cena (nome "… (cópia)", mesmo mapa e grid) e os tokens dela, **menos os de personagem de jogador**, com ids novos |
| `cena.apagar` | `{ cenaId }` | `cena.editar` | apaga a cena e os tokens dela; **nunca a ativa** (`dados_invalidos`) |
| `grupo.moverPara` | `{ cenaId }` | `cena.editar` | **uma única mensagem**: os tokens dos personagens de jogador que estão na cena ativa vão para a chegada da cena de destino, lado a lado e sem sobreposição (`arrumarNoGrid`); NPC fica; a cena de destino vira a ativa; **todos recebem snapshot novo**; antes dele cada jogador recebe `preparo.chaves`. Mesma cena: nada muda |
| `cena.preparar` | `{ cenaId, pacotes: [{ hashCifrado, hashOriginal, chave }] }` (1 a 200; hashes e chave em 64 hex) | `cena.editar` | guarda os pacotes e as chaves (SQLite, tabela `preparos`) e avisa os jogadores com `preparo.disponivel`. A sala só aceita pacote cujo `hashCifrado` é um asset `cifrado` registrado (`asset_inexistente`) e cujo `hashOriginal` é um arquivo que os jogadores veriam naquela cena (mapa e imagem de token visível; `dados_invalidos`). Não gera evento |
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
| `preparo.disponivel` | `{ hashes }` (arquivos **cifrados**) | **só jogadores**: baixem estes arquivos. Sem `cenaId`, sem nome, sem nada sobre o conteúdo. Mandada ao preparar e a quem conecta com preparo pendente |
| `preparo.chaves` | `{ pacotes: [{ hashCifrado, hashOriginal, chave }] }` | **só jogadores, só ao levar o grupo**, e só os pacotes cujo `hashOriginal` o jogador **passa a ver** no estado novo. Chega **antes** do snapshot |
| `preparo.progresso` | `{ preparos: [{ cenaId, hashesOriginais, completos, jogadores }] }` | **só mestres**: quantos jogadores já têm todos os pacotes de cada preparo (lista vazia quando um preparo é descartado) |
| *(frame binário)* | pedaço, ver abaixo | só quem espera aquele pedaço (repassado pela sala, sem gravar) |
| `token.movendo` | `{ id, x, y }` | **transitório** (sem `seq`, não gravado): só quem pode ver o token, **menos o remetente**. Nunca vai a um jogador para token oculto ou da camada do mestre. Se quem arrastava cai antes do `token.soltar`, a sala manda um `token.movendo` com a **posição gravada**, para ninguém ficar com o token num lugar que não existe |

Códigos de erro: `mensagem_invalida`, `sem_permissao`, `ultimo_mestre`, `usuario_inexistente`,
`capacidade_nao_delegavel`, `importacao_invalida`, `token_inexistente`, `dados_invalidos`,
`asset_inexistente` (asset que não existe **ou** que a pessoa não pode ver: a resposta é idêntica), `personagem_inexistente` (idem, para personagem que não existe ou que a pessoa não vê), `cena_inexistente`.

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
| `cena.gridAlterado` | `{ cenaId, grid, larguraM?, alturaM? }` (com mapa, mudar o quadrado muda o tamanho da cena: vem junto) | mestres; jogador **só se for a cena ativa** |
| `cena.mapaAlterado` | `{ cenaId, mapa: { assetHash, pxPorQuadrado } \| null, larguraM, alturaM }` | mestres; jogador **só se for a cena ativa** |
| `cena.criada` / `cena.apagada` | `{ cena }` / `{ cenaId }` | **só mestres** |
| `cena.editada` | `{ cena }` (a cena inteira: nome, chegada; o cliente faz upsert) | mestres; jogador só se for a cena ativa |
| `grupo.movido` | `{ cenaId, tokens: [{ id, x, y }] }` (nova cena ativa; os tokens passam a ser dessa cena) | **só mestres** (e eles também recebem snapshot novo; os jogadores só o snapshot) |
| `personagem.alterado` | `{ personagem }` (inteiro; criação, edição ou ficha) | mestres; jogador só se vê o personagem (o dele; de outro jogador com `ficha.verOutras`; NPC nunca). Quem **deixou de ver** recebe `personagem.apagado` |
| `personagem.apagado` | `{ id }` | mestres; jogador que o via |
| `asset.registrado` | `{ meta }` | **só mestres** (as metas dos jogadores chegam por `asset.meta`, sob demanda) |

#### Sigilo de cena e de personagem (Lote 4)

- O jogador só recebe a **cena ativa** (onde está o grupo): o snapshot dele tem `cenas: [a ativa]`. Nome, grid,
  mapa, chegada e tokens das outras cenas nunca chegam a ele; os eventos de cena (criar, editar, apagar, grid,
  mapa) das outras cenas não são enviados. O mestre olha e edita qualquer cena sem mover o grupo (a cena que ele
  vê é estado local da tela dele; as intenções de token, grid e mapa dizem de qual cena são).
- Ao levar o grupo, **todos recebem snapshot novo**; os eventos `grupo.movido` e `cena.*` só vão a mestres.
- Personagens no snapshot do jogador: os dele inteiros; os de outros jogadores só com `ficha.verOutras`; NPC nunca.
  Mudar `ficha.verOutras` (padrão ou exceção) manda snapshot novo a quem foi afetado. O `token` visível de um
  NPC carrega o `personagemId` (um id opaco), mas o personagem em si não chega.
- `assetVisivelPara` olha a cena: só a imagem de token **da cena ativa**, o mapa e os tiles da cena ativa, a
  imagem do token padrão de um personagem que ele vê, e os arquivos `cifrado` (opacos).

#### Sigilo dos tokens

Visível para um usuário = mestre (vê tudo) **ou** (`cenaId` é a cena ativa **e** `camada === "tokens"` **e** `oculto === false`). O filtro
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
         cenas: Cena[] /* jogador: só a ativa */, cenaAtivaId, tokens: Token[],
         personagens: Personagem[] /* jogador: os que pode ver */, assets?: AssetMeta[] /* só na visão do mestre */ }
Cena  { id, nome, larguraM, alturaM, grid: { quadradoM, visivel },          // padrão: cena-1, 60 x 45 m, quadrado 1,5 m
        mapa?: { assetHash, pxPorQuadrado },
        chegada?: { x, y } /* onde o grupo chega; padrão: o centro */ }
Token { id, cenaId, nome, cor, tamanhoQuadrados (1..4), x, y /* centro, em metros */,
        camada: "tokens" | "mestre", oculto, controladoPor: string[] /* ids de usuário */,
        assetHash?: string /* imagem do token; sem ela vale o círculo gerado */,
        personagemId?: string /* o token guarda a PRÓPRIA cópia de nome, cor e imagem do token padrão */ }
Personagem { id, donoId: string | null /* null = NPC */, nome,
             tokenPadrao: { cor, tamanhoQuadrados, assetHash? }, visao: { alcanceM: number | null, visaoNoEscuroM },
             ficha: { pvAtual, pvMax } /* ficha mínima até o Lote 9 */ }
AssetMeta { hash /* SHA-256 hex do arquivo processado */, tipo: "mapa" | "token" | "retrato" | "tile" | "cifrado",
            mime, bytes, largura, altura, donoId, nomeOriginal,
            pedacos: string[] /* SHA-256 de cada pedaço de 256 KB */,
            tiles?: { hash, x, y, largura, altura }[] /* só no manifesto de mapa fatiado */ }
Usuario { id, nome, papel: "mestre" | "jogador" | "assistente", cor }
Permissoes { jogadores: Record<CapacidadeDelegavel, boolean>, porUsuario: Record<id, Partial<Record<CapacidadeDelegavel, boolean>>> }
```

- `permissoes.jogadores` só tem capacidades delegáveis (as exclusivas do mestre nunca são
  configuráveis).
- **Jogador** (e assistente): `notaMestre` não existe no snapshot e `porUsuario` só traz a entrada dele.
- **Jogador**: `tokens` só tem os que ele pode ver (da cena ativa, camada `tokens` e não ocultos); `cenas` só tem a ativa; `personagens` só os que ele vê.
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
mapa; mais, desde o Lote 4, (5) a imagem do token padrão de um personagem que ele vê e (6) os arquivos `cifrado`. Consequências: a meta, o hash e os pedaços de um asset invisível nunca chegam ao jogador; o hash da
imagem de um token oculto nunca chega (ele vai junto com o token, que o jogador não recebe); pedir esse
hash responde `asset_inexistente`, **igual** a pedir um que não existe; o snapshot do jogador não leva
`assets`. Quando o token é revelado, o `token.editado` leva o `assetHash` e o jogador pede o arquivo.

### Preparar cena: pré-envio cifrado (Lote 4)

Objetivo: o grupo ainda está na cena 1 e a cena 2 já pode estar no cache de todos, **sem o jogador saber nada
dela antes da hora**. Fluxo:

1. **Mestre (navegador)**: para a cena X, junta o mapa (todos os tiles, ou o próprio arquivo) e a imagem dos
   tokens **visíveis para jogadores** em X (`hashesPreparaveis`; token oculto ou da camada do mestre não entra).
   Para cada arquivo gera uma chave AES-GCM de 256 bits e um IV de 12 bytes aleatório (WebCrypto), cifra e
   registra o resultado como asset do tipo **`cifrado`** (`asset.registrar`, só o mestre): o arquivo é
   `IV (12 B) + texto cifrado + etiqueta (16 B)`, `nomeOriginal: "cifrado"`, `mime: application/octet-stream`,
   `largura` e `altura` 1. O hash dele é o SHA-256 dos bytes cifrados. Depois manda `cena.preparar`.
2. **Sala**: guarda no SQLite (tabela `preparos`: `cena_id, hash_cifrado, hash_original, chave`; dado só do mestre
   e da sala, fora da exportação) e manda `preparo.disponivel { hashes }` a cada jogador conectado (e a quem
   conectar depois). Asset `cifrado` é visível a todo jogador e trafega pelo **mesmo caminho de pedaços** do
   Lote 3 (`asset.pedir`, frames binários), em geral servido pelo mestre, o dono. O mestre recebe
   `preparo.progresso` (jogadores que já têm todos os pacotes de cada preparo; é pela posse que a sala conta).
3. **Preparar de novo** depois de mudar a cena acrescenta só o que falta (o cliente do mestre usa
   `hashesOriginais` do progresso para não repetir).
4. **`grupo.moverPara`**: a sala manda a cada jogador `preparo.chaves` **só com os pacotes cujo `hashOriginal` ele
   passa a ver no estado novo** (`assetVisivelPara` sobre o estado depois da ida) e **só depois** o snapshot. O
   jogador decifra o que já baixou, **confere o SHA-256 contra `hashOriginal`**, grava no cache com o hash
   original, anuncia `asset.tenho`, apaga o cifrado (`asset.naoTenho`) e pede só a meta (`asset.pedir` com
   `faltam: []`: sem pedaços). Os originais ficam "em decifração" desde a chegada das chaves, para o snapshot
   não disparar um download. O que não chegou a baixar, ou não confere, vem pelo caminho normal. Os preparos
   daquela cena são descartados depois da ida (também ao apagar a cena e ao importar uma campanha).

Sigilo: o que o jogador recebe antes da ida são bytes opacos, sem nome nem hash original; a chave só chega
quando ele já tem direito ao arquivo. O que revela: **quantos** arquivos cifrados há e o tamanho aproximado de
cada um (original + 28 bytes). Token oculto da cena não tem pacote (o cliente do mestre não o inclui e a sala
recusa pacote de arquivo que os jogadores não veriam) e, portanto, nem chave.

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
`automacao.editar`, `camadaMestre.ver`, `cena.editar` (tokens, grid, mapa e, desde o Lote 4, personagens, cenas, levar o grupo e preparar cena), `objeto.ajustar`,
`campanha.exportar`, `campanha.importar`.

`asset.subir` cobre `asset.registrar` e `token.definirImagem`. As intenções de vaivém de arquivos
(`asset.pedir`, `asset.inventario`, `asset.tenho`, `asset.naoTenho`) e `ficha.alterar` não exigem capacidade
(`capacidadeDaIntencao` = `null`): qualquer mestre ou jogador pode enviar; nos arquivos o sigilo é conferido sobre o
asset (quem não pode subir ainda precisa ver o mapa) e na ficha, sobre o dono do personagem.

Regra de `pode(usuario, capacidade, permissoes)`: mestre sempre; assistente nunca (por enquanto);
jogador: nunca as exclusivas do mestre; senão a exceção por usuário, se houver, senão o padrão da mesa.

### Exportação

`{ formato: "tabletop-campanha", versao: 4, exportadoEm, dados: { seq, usuarios, permissoes, notaMesa, notaMestre, cenas, cenaAtivaId, tokens, personagens, assets } }`.
Sem contadores de uso nem presença. `assets` são **só as metas dos assets usados** (mapas das cenas, imagens
dos tokens e os tiles deles), **nunca bytes**; `Cena.mapa` e `Token.assetHash` vão nos próprios objetos. A **v4**
(Lote 4) acrescenta `personagens` (as várias cenas já cabiam desde a v2; a `chegada` vai dentro de cada cena). Os
**preparos** (chaves do pré-envio) e os assets `cifrado` **nunca** entram. A **v3** (Lote 3, sem `personagens`), a **v2**
(Lote 2, sem `assets`) e a **v1** (Lote 1, sem `cenas`, `cenaAtivaId` nem `tokens`) continuam sendo aceitas na
importação: o resultado é sempre v4, com `personagens: []` e `assets: []` onde faltavam; a v1 vira a cena padrão e nenhum token. Quem importa um mapa precisa
de alguém online com os arquivos (o cache dos navegadores serve; se ninguém tiver, o jogo mostra "indisponível").
Na importação a sala valida com zod e ainda exige: ids de usuário
únicos, pelo menos um mestre, exceções só para usuários existentes, ids de cena, de token e de personagem únicos, cena ativa
existente, tokens em cenas existentes, de personagens existentes e controlados por usuários existentes, personagens de usuários
existentes (ou `null`) e com imagem de token padrão com meta, assets válidos (limites, dono
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
