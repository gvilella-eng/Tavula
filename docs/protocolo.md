# Protocolo cliente ↔ sala

## Versão atual: v1 (Lotes 1, 2, 3, 4, 4b, 5, 6, 7, 8, 9, 10, 11, 13 e 14)

Os schemas zod ficam em `packages/shared/src/protocolo.ts` e `estado.ts`; a lógica pura (conferir
capacidade, aplicar, filtrar por papel) em `nucleo.ts` e `capacidades.ts`. O cliente e a sala validam
as mensagens com os mesmos schemas e aplicam eventos com a mesma função (`reduzir`). O Lote 2 acrescentou
cenas, tokens e o movimento ao vivo, e o Lote 3 os assets locais (mapa, imagem de token, frames binários)
e o Lote 4 personagens, várias cenas e o pré-envio cifrado, e o Lote 4b as pastas das Fichas, quem edita o
personagem, a camada `mapa` e a ordem de turno, tudo **sem mudar o número do protocolo**: só entraram mensagens novas
(e, no 4b, o personagem trocou `donoId` por `editores`/`pastaId`: ver "Pastas e quem edita" abaixo).

### Conexão e autenticação (dev)

- O front usa a mesma origem para tudo; o Vite faz proxy de `/api` (com `ws: true`) e `/teste` para o Worker.
- A identidade vem do cookie `tavola_sessao` (C2, 2026-11-12): 32 bytes aleatórios em base64url, `HttpOnly`, `SameSite=Lax`,
  `Path=/api/m/<id>` (vale só para a mesa), `Secure` quando a requisição vem por https, 30 dias renovados com o uso. A **sala**
  resolve cookie, sessão, conta e vaga (no HTTP e no WebSocket); o Worker só repassa e refaz os cabeçalhos internos
  `x-tavola-ip`, `x-tavola-local`, `x-tavola-seguro` e `x-tavola-mesa`. O login solto `tabletop_sessao` (id do usuário no cookie) e as
  rotas `entrar` e `usuarios` **só existem com `MODO=teste`**. O `tabletop_usuario` de antes do C1 nunca mais é lido.
- A senha nunca sai do navegador: o corpo leva só a "derivada" (PBKDF2-SHA256, 600.000 iterações, sal `tavola:<id da mesa>:<login>`, 32 bytes em
  base64url, 43 caracteres). Corpos JSON de até 4 KB, `Content-Type: application/json`, validados com zod (`packages/shared/src/contas.ts`).
  Erro: `{ erro: <código>, mensagem: <texto em português>, minutos? }` (429 leva `Retry-After`).
- Rotas HTTP do Worker:

| Rota | O que faz |
|---|---|
| `GET /saude` | `ok` |
| `POST /api/mesas` `{ id, nome, mestre: { login, nome, derivada } }` | cria a mesa com a conta do mestre e abre a sessão dele (`Set-Cookie`); devolve `{ id, nome }` (201); o `id` é sorteado pelo navegador (409 `id_em_uso` se já existe); 400 (`mestre_obrigatorio`, `corpo_invalido`, `nome_invalido`), 415, 429 (5 mesas por hora por IP). Só com `MODO=teste` o `mestre` e o `id` podem faltar |
| `GET /api/mesas/<id>` | `{ id, nome, legada }` ou 404 `{ erro: "mesa_inexistente" }` |
| `GET /api/mesas` | lista as mesas; **só com `LISTAR_MESAS=1`** (`dev` e `dev:e2e`), senão 404 |
| `GET /api/m/<id>/situacao` | público: `{ modoTeste, semMestre, podeCriarMestre }` (a tela de entrada decide o que mostrar) |
| `POST /api/m/<id>/conta/entrar` `{ login, derivada }` | abre a sessão (`Set-Cookie tavola_sessao`); 401 `credenciais` (login inexistente e senha errada respondem igual), 429 `bloqueada` / `ip_bloqueado` (com `minutos`), 403 `pedido_pendente`, `pedido_recusado`, `sem_vaga` |
| `POST /api/m/<id>/conta/pedir` `{ login, nome, derivada }` | pedido de entrada (conta `pendente`); 409 `login_em_uso`, `mesa_sem_mestre`; 429 `muitos_pedidos` (3 por IP por hora, 10 pendentes por mesa), `pedido_recusado_recente` |
| `POST /api/m/<id>/conta/esqueci` `{ login }` | marca o pedido de redefinição e avisa o mestre; a resposta é sempre a mesma (200) |
| `POST /api/m/<id>/conta/redefinir` `{ login, derivada }` | define a senha nova depois de o mestre liberar (30 min); derruba as sessões antigas e abre uma nova; 403 `redefinicao_indisponivel` |
| `GET /api/m/<id>/eu` | com sessão: `{ id, nome, cor, login?, tourVisto?, modoTeste }` (`login` e `tourVisto` só com conta; `tourVisto` é o 0/1 do tour de introdução). Lote T |
| `POST /api/m/<id>/conta/tour-visto` | com sessão de conta: marca que o tour de introdução foi visto (idempotente); 401 sem sessão. Lote T |
| `POST /api/m/<id>/conta/trocar-senha` `{ atual, nova }` | com sessão; derruba as outras sessões; 403 `senha_atual_incorreta` |
| `POST /api/m/<id>/conta/sair` e `POST /api/m/<id>/sair` | apaga a sessão no banco, fecha os sockets dela e apaga os cookies (204) |
| `POST /api/m/<id>/conta/mestre-inicial` `{ login, nome, derivada }` | a mesa legada sem conta de mestre ganha a dele (ligada à vaga `mestre`); só de requisição local (403 `so_local`) e só sem mestre (409 `ja_tem_mestre`). C3: responde `{ ok, codigo }` (o código de recuperação, só nesta resposta) |
| `POST /api/m/<id>/conta/chave` `{ senha, chavePublica }` | C3, só o mestre logado: registra ou troca a chave pública da pasta (JWK EC P-256 só com `kty`, `crv`, `x`, `y`; um `d` é recusado). `senha` é a derivada atual (errar conta para o bloqueio). A troca invalida a chave antiga |
| `POST /api/m/<id>/conta/codigo` `{ senha }` | C3, só o mestre logado: gera um código de recuperação novo (o anterior morre) e o devolve, `{ ok, codigo }`, uma única vez. O servidor guarda só o SHA-256 |
| `POST /api/m/<id>/conta/recuperar/desafio` `{}` | C3, público: devolve `{ nonce, expira }` (32 bytes aleatórios em base64url, 5 minutos, uso único). Sempre emite, tenha a mesa chave ou não; 20 por IP por hora |
| `POST /api/m/<id>/conta/recuperar/pasta` `{ login, nonce, assinatura, derivada }` | C3, público: `assinatura` é ECDSA P-256 / SHA-256 (64 bytes, base64url) de `"tavola-recuperar:" + id da mesa + ":" + nonce`. Certa: troca a senha do mestre (`derivada` é a nova), derruba as sessões dele e abre uma nova (cookie). O nonce é gasto antes de conferir |
| `POST /api/m/<id>/conta/recuperar/codigo` `{ login, codigo, derivada }` | C3, público: código certo troca a senha, derruba as sessões, mata o código e devolve `{ ok, codigo }` com o novo (e abre sessão). Erro de pasta, chave, nonce ou código: sempre 401 `recuperacao_invalida`; `login_nao_confere` (403) só depois de provar ser o dono. Limites: 5 erros por mesa (espera 1, 5, 15 e 60 min) e os 30 por IP do C2 |
| Origin (C3) | no upgrade do WebSocket e em todo `POST /api/...`, o `Origin` (se vier) tem de ser o host do pedido; senão 403 `origem_invalida`. Sem `Origin`, aceita. Em pedido local (loopback) vale também outra origem de loopback (o Vite) |
| `GET /api/m/<id>/contas` | só o mestre: `{ contas: [{ id, login, nome, papel, status, vagaId, vagaNome, criadaEm, ultimoAcesso, redefinicaoPedida, redefinicaoAte }], vagasLivres }`; nunca sal, hash nem token; 401 sem sessão, 403 a quem não é mestre |
| `POST /api/m/<id>/contas/<conta>/aceitar` `{ personagemId? }` | só o mestre; a conta fica ativa. V7: sem `personagemId` nasce um jogador com o nome dela; com a ficha de uma vaga escondida a conta fica ligada àquela vaga (renomeada); com uma ficha sem dono nasce o jogador e ele vira dono. 409 `vaga_invalida` (ficha com dono, "todos", inexistente, ou mesa cheia sem vaga a reaproveitar) |
| `POST /api/m/<id>/contas/<conta>/recusar`, `remover`, `liberar-redefinicao` | só o mestre; recusar e remover fecham os sockets da conta (4001); a conta do mestre não se recusa nem se remove |
| `GET /api/m/<id>/usuarios` e `POST /api/m/<id>/entrar` `{ usuarioId }` | **só com `MODO=teste`**: a escolha de usuário de desenvolvimento (cookie `tabletop_sessao`); fora dele 404 |
| `GET /api/m/<id>/eu` | usuário da sessão nesta mesa (`{ id, nome, cor, login? }`) ou 401; renova o cookie se a sessão foi renovada |
| `POST /api/m/<id>/renomear` `{ nome }` | muda o nome da mesa; só o mestre (403 aos outros, 401 sem sessão) |
| `GET /api/m/<id>/ws` (Upgrade) | WebSocket da sala; sem usuário válido: 401 |
| qualquer `/api/m/<id>/...` com id que não existe | 404 `{ erro: "mesa_inexistente" }` |
| `POST /teste/zerar`, `POST /teste/reiniciar-sala` | **só com `MODO=teste`** (script `dev:e2e`); fora disso 404 |

- Cada mesa é um Durable Object `Sala`: a legada é `idFromName("campanha")` e as outras `idFromName("mesa:<id>")`; o
  diretório (`Diretorio`) liga o id amigável ao nome do DO (PROJETO 4.14). A sala usa a WebSocket Hibernation API. Quem é
  cada socket fica no `serializeAttachment` (`usuarioId`, `conexaoId`).
- V7: o `snapshot` leva `estado.membros` (ids do mestre e de quem tem conta ativa; com `MODO=teste`, também quem entrou pelo login solto). Aditivo e derivado: nunca é gravado nem exportado, e sem ele todos contam como membros. A tela só oferece membros nas listas de pessoas.
- Ao conectar, a sala manda `snapshot`, `presenca` e (se mestre) `uso` e `contas.aviso`.
- Sockets fechados pela sala com o código **4001** (conta removida ou recusada, senha redefinida ou trocada, sessão encerrada, usuário
  que sumiu): o cliente pergunta `eu`, recebe 401 e volta à tela de entrada.
- Mensagens da sala novas no C2: `contas.aviso` `{ pendentes, redefinicoes, novo: { tipo: "entrada" ou "redefinicao", nome, login } ou null }`
  (**só para o mestre**; nunca leva sal, hash, token nem derivada) e `mesa.renomeada` `{ nome }` (para todos; o título da aba e a lista local acompanham).

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

**Quem apaga um token** (`token.apagar`, V10): o mestre, qualquer um; o jogador, só o que controla (mesma regra de controle de abaixo), vê e está na camada `tokens`. É conferido na sala, nunca só no cliente: um jogador que mande `token.apagar` à mão num token alheio recebe `sem_permissao`. O `token.restaurar` só vale para quem apagou (10 s) ou o mestre; a guarda do token apagado fica só na memória da sala.

**Quem põe o próprio token** (`token.colocarMeu`, V10b): capacidade `token.colocarProprio` (delegável, **ligada por padrão**). A intenção é `{ personagemId, tokenId, x?, y? }`. A **sala** decide tudo: a cena é a do grupo (`cenaAtivaId`), nunca uma que o cliente diga; o jogador precisa **controlar o personagem** (`editores`; "todos" conta), o personagem **não pode ter token nessa cena** (um por personagem por cena; `dados_invalidos`) e o ponto `x,y` tem de cair na **área da bandeira**: um círculo de 3 quadrados de raio em volta do ponto de chegada da cena (centro da cena se não há chegada), senão `dados_invalidos`. Sem `x,y` a sala usa o arranjo da chegada (`arrumarNoGrid`, contando os tokens que já estão na cena); com ele, encaixa no grid. **Todos os campos do token vêm da ficha, na sala** (nome, cor, tamanho, imagem; camada `tokens`, visível, `controladoPor` vazio, `personagemId`): um campo a mais que o cliente mande é descartado pelo esquema e nunca é lido. Quem não controla o personagem recebe `sem_permissao`. O mestre (que tem a capacidade sempre) põe onde quiser e quantos quiser; o caminho de sempre dele continua sendo `personagem.colocar`. Nota de segurança: a intenção não abre nada que o jogador não tivesse; o token nasce com os mesmos dados que o mestre poria, e a visibilidade, a visão e a luz seguem as regras de sempre.

**Quem move um token** (`token.mover` e `token.soltar`): o mestre, qualquer token; o jogador, só se
`pode(eu, "token.moverProprio")` **e** controla o token (**edita o personagem** do token, ou o id dele
está em `controladoPor`, que o mestre usa para emprestar) **e** o token é visível para ele (da cena ativa)
**e** está na camada `tokens` (o cenário da camada `mapa` é fixo para os jogadores, mesmo com `controladoPor`).
Token invisível para quem pergunta (oculto, da camada do mestre ou de outra cena) responde `token_inexistente`, igual a um
id que não existe: a resposta não revela nada. **Posição fora da cena é limitada à borda** (o centro do token
fica dentro de `0..larguraM` × `0..alturaM`), não recusada.

| `tipo` | `dados` | Capacidade exigida | Efeito |
|---|---|---|---|
| ~~`nota.editar`~~, ~~`notaMestre.editar`~~ | — | — | **saíram no V3** (a aba Notas virou handouts). A capacidade `nota.editar` continua no enum só por compatibilidade (banco e exportação antigos) e nenhuma intenção a exige |
| `handout.criar` | `{ handout: { id, pastaId, titulo (1 a 80), texto (até 20 000), fonte: "simples" \| "livro" \| "manuscrito" \| "medieval" \| "datilografado", imagemHash?, visivel } }` | `mesa.configurar` (só do mestre) | cria o handout (V3). `dados_invalidos` (id repetido), `pasta_inexistente`, `usuario_inexistente`, `asset_inexistente` (imagem tipo retrato ou token). Se `visivel` não é `mestre`, manda **snapshot novo a todos** (a pasta chega junto) |
| `handout.editar` | `{ id, mudancas: { pastaId?, titulo?, texto?, fonte?, imagemHash?: hash \| null, visivel? } }` | `mesa.configurar` | muda o que vier. `handout_inexistente`. Mudar `visivel` ou `pastaId` manda **snapshot novo a todos**; texto, título, fonte e imagem, não |
| `handout.apagar` | `{ id }` | `mesa.configurar` | apaga; `handout_inexistente`. (`pasta.apagar` só vale com a pasta sem personagens **e** sem handouts) |
| `handout.mostrar` | `{ id }` | `mesa.configurar` | "Mostrar agora": emite `handout.mostrado` (só para quem vê o handout); não grava nada. `handout_inexistente` |
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
| `token.apagar` | `{ id }` | nenhuma fixa (a sala confere) | apaga o token. O mestre apaga qualquer um; o jogador, só o que controla, visível e na camada `tokens` (senão `sem_permissao`; invisível: `token_inexistente`). A sala guarda o token por 10 s, na memória, para o `token.restaurar` (V10) |
| `token.colocarMeu` | `{ personagemId, tokenId, x?, y? }` | `token.colocarProprio` | cria o token do personagem na cena do grupo (regras em "Quem põe o próprio token"); evento `token.criado` |
| `token.restaurar` | `{ id }` | nenhuma fixa (a sala confere) | desfaz o `token.apagar`: recria o token igual. Só quem o apagou, dentro de 10 s, ou o mestre (enquanto a sala o guarda); fora disso `sem_permissao`. Não restaura as luzes presas ao token |
| `cena.configurarGrid` | `{ cenaId?, quadradoM?, visivel? }` (quadrado de 0,3 a 10 m) | `cena.editar` | muda o grid da cena (`cenaId`; padrão: a ativa) |
| `token.mover` | `{ id, x, y }` (metros, centro do token) | `token.moverProprio` | **transitório**: não grava, não gera `seq`, não muda o estado; a sala repassa `token.movendo` (abaixo). Limite do cliente: 20 por segundo por arraste |
| `token.soltar` | `{ id, x, y }` | `token.moverProprio` | grava e gera o evento `token.movido` (sempre, mesmo sem mudança de posição: quem viu o movimento ao vivo precisa da posição final) |
| `personagem.criar` | `{ personagem }` (`id` do cliente; `pastaId`; `editores`: `{ tipo: "todos" }` ou `{ tipo: "jogadores", ids }` (NPC: `ids: []`); `retratoHash?`; `tokenPadrao { cor, tamanhoQuadrados, assetHash? }`; `visao { alcanceM \| null, visaoNoEscuroM }`; `ficha?` (Lote 9: ver "Ficha 5e"; PV mínimos `{ pvAtual, pvMax }`); a `mochila` do Lote 7, se vier, vira `ficha.itens`) | `cena.editar` (só do mestre) | cria o personagem. `dados_invalidos` (id repetido), `pasta_inexistente`, `usuario_inexistente` (editor que não é jogador), `asset_inexistente` (imagem) |
| `personagem.editar` | `{ id, mudancas: { nome?, editores?, pastaId?, cor?, tamanhoQuadrados?, assetHash?: hash \| null, retratoHash?: hash \| null, alcanceM?, visaoNoEscuroM?, pvAtual?, pvMax? } }` | nenhuma (`null`; a regra é de quem edita) | **mestre**: qualquer mudança. **Quem edita** o personagem (jogador): só `assetHash` (token padrão) e `retratoHash`, e com `asset.subir` (`sem_permissao` no resto). Personagem que a pessoa não vê: `personagem_inexistente`. `pasta_inexistente`, `usuario_inexistente`. Não muda os tokens já postos (cada token tem a própria cópia de nome, cor e imagem). Mudar `pastaId` ou `editores` faz o item aparecer ou sumir para os jogadores afetados (ver sigilo) |
| `pasta.criar` | `{ pasta: { id, nome, ordem, visivel } }` (`visivel`: `{ tipo: "todos" }`, `{ tipo: "mestre" }` ou `{ tipo: "jogadores", ids }`) | `mesa.configurar` (só do mestre) | cria a pasta (sem subpastas). `dados_invalidos` (id repetido), `usuario_inexistente` |
| `pasta.editar` | `{ id, nome?, visivel? }` | `mesa.configurar` | renomeia e/ou muda quem vê a pasta (e tudo o que está nela). Mudar `visivel` manda **snapshot novo a todos**. `pasta_inexistente` |
| `pasta.apagar` | `{ id }` | `mesa.configurar` | só pasta **vazia** (`dados_invalidos` se tem itens). `pasta_inexistente` |
| `ordemDeTurno.definir` | `{ visivel: boolean }` | `mesa.configurar` | mostra ou esconde o painel flutuante de ordem de turno **para todos, inclusive o mestre**; o campo `ordemDeTurnoVisivel` do estado entra na exportação. O conteúdo da ordem (iniciativa, turnos, condições) é do Lote 11: ver "Combate e condições" abaixo |
| `personagem.apagar` | `{ id }` | `cena.editar` | apaga o personagem **e os tokens dele** (eventos `token.apagado` e depois `personagem.apagado`) |
| `personagem.colocar` | `{ personagemId, cenaId, tokenId, x?, y? }` | `cena.editar` | cria o token a partir do token padrão (camada `tokens`, visível, `personagemId`), na posição dada (a interface manda o ponto onde o item das Fichas foi **solto no mapa**) ou na **chegada** da cena (encaixada no grid). Personagem de jogador (com quem edite) só tem **um** token (`dados_invalidos` se já tem) |
| `ficha.alterar` | `{ personagemId, operacoes: { caminho, valor }[] }` (1 a 200 operações; `caminho` com pontos, número = posição na lista, vazio = a ficha inteira; `valor: null` remove o campo ou o elemento) | nenhuma (a regra é de quem edita; `null` em `capacidadeDaIntencao`) | **quem edita** o personagem ou o mestre. A sala aplica as operações numa cópia, valida a **ficha inteira** (zod) e recusa com `dados_invalidos` se passar de **256 KB** ou ficar inválida (nada é gravado pela metade). `pvAtual` nunca passa de `pvMax`. Quem não é o mestre **não aumenta** a quantidade de item com `modeloId` (`sem_permissao`: só o mestre repõe tochas). Personagem que a pessoa não vê: `personagem_inexistente`; visível mas que ela não edita: `sem_permissao` (mesmo com `ficha.verOutras`). Substitui a forma antiga `{ personagemId, pvAtual?, pvMax? }` |
| `cena.criar` | `{ id, nome }` | `cena.editar` | nova cena com o tamanho e o grid padrão (60 x 45 m, quadrado 1,5 m). `dados_invalidos` se o id existe |
| `cena.editar` | `{ cenaId, nome?, chegada?: { x, y } \| null }` | `cena.editar` | renomeia e/ou define a chegada do grupo (limitada à cena; `null` volta ao centro). `cena_inexistente` |
| `cena.duplicar` | `{ cenaId, novoId }` | `cena.editar` | copia a cena (nome "… (cópia)", mesmo mapa e grid) e os tokens dela, **menos os de personagem de jogador**, com ids novos |
| `cena.apagar` | `{ cenaId }` | `cena.editar` | apaga a cena e os tokens dela; **nunca a ativa** (`dados_invalidos`) |
| `grupo.moverPara` | `{ cenaId }` | `cena.editar` | **uma única mensagem**: os tokens dos personagens de jogador que estão na cena ativa vão para a chegada da cena de destino, lado a lado e sem sobreposição (`arrumarNoGrid`); NPC fica; a cena de destino vira a ativa; **todos recebem snapshot novo**; antes dele cada jogador recebe `preparo.chaves`. Mesma cena: nada muda |
| `cena.preparar` | `{ cenaId, pacotes: [{ hashCifrado, hashOriginal, chave }] }` (1 a 200; hashes e chave em 64 hex) | `cena.editar` | guarda os pacotes e as chaves (SQLite, tabela `preparos`) e avisa os jogadores com `preparo.disponivel`. A sala só aceita pacote cujo `hashCifrado` é um asset `cifrado` registrado (`asset_inexistente`) e cujo `hashOriginal` é um arquivo que os jogadores veriam naquela cena (mapa e imagem de token visível; `dados_invalidos`). Não gera evento |
| `desenho.criar`, `desenho.mover`, `desenho.apagar`, `desenho.voltar`, `desenho.limpar`, `desenho.rascunho` | ver "Pincel e desenhos (Lote 13)" | `desenho.criar` (`desenho.limpar`: `cena.editar`) | o pincel |
| `compendio.definir`, `chat.magia` | ver "Compêndio de magias (Lote 14)" | `mesa.configurar` (só do mestre) e nenhuma | o compêndio da mesa e a magia no chat |
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
| `desenho.rascunhando` | `{ desenho }` | **transitório** (sem `seq`, não gravado): o traço em andamento de outra pessoa, só a quem recebe a cena do desenho (o mestre; o jogador com a cena ativa), **menos o remetente** |
| `desenho.rascunhoFim` | `{ id }` | idem: o traço acabou (soltou, cancelou ou a conexão caiu) |
| *(frame binário)* | pedaço, ver abaixo | só quem espera aquele pedaço (repassado pela sala, sem gravar) |
| `token.movendo` | `{ id, x, y }` | **transitório** (sem `seq`, não gravado): só quem pode ver o token, **menos o remetente**. Nunca vai a um jogador para token oculto ou da camada do mestre. Se quem arrastava cai antes do `token.soltar`, a sala manda um `token.movendo` com a **posição gravada**, para ninguém ficar com o token num lugar que não existe |

Códigos de erro: `mensagem_invalida`, `sem_permissao`, `ultimo_mestre`, `usuario_inexistente`,
`capacidade_nao_delegavel`, `importacao_invalida`, `token_inexistente`, `dados_invalidos`,
`desenho_inexistente`, `limite_de_desenhos` (Lote 13), `asset_inexistente` (asset que não existe **ou** que a pessoa não pode ver: a resposta é idêntica), `personagem_inexistente` (idem, para personagem que não existe ou que a pessoa não vê), `cena_inexistente`, `pasta_inexistente` (pasta que não existe ou que o jogador não vê; só o mestre mexe em pastas).

### Eventos (`evento.dados.tipo`)

| Evento | `dados` | Quem recebe |
|---|---|---|
| ~~`nota.alterada`~~, ~~`notaMestre.alterada`~~ | — | saíram no V3 |
| `handout.alterado` | `{ handout }` (inteiro; o cliente faz upsert) | mestres; jogador só se `visivel` o cita. Quem **deixou de ver** recebe `handout.apagado` (sem título) |
| `handout.apagado` | `{ id }` | mestres; jogador que o via |
| `handout.mostrado` | `{ id }` (transitório: avança o `seq`, não muda o estado nem é gravado) | mestres; jogador só se vê o handout. A tela abre a janela dele (quem mandou não a reabre) |
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
| `personagem.alterado` | `{ personagem }` (inteiro; criação, edição, ficha, troca de pasta ou de editores) | mestres; jogador só se vê o personagem (edita, ou a pasta é visível para ele). Quem **deixou de ver** recebe `personagem.apagado` |
| `pasta.alterada` | `{ pasta }` (inteira; o cliente faz upsert) | mestres; jogador só se vê a pasta. Quem **deixou de ver** recebe `pasta.apagada` (sem nome) |
| `pasta.apagada` | `{ id }` | mestres; jogador que a via |
| `ordemDeTurno.alterada` | `{ visivel }` | **todos** |
| `combate.alterado` | `{ combate: Combate \| null }` (o combate inteiro depois da mudança; `null` = acabou) | mestres: inteiro; jogador: **filtrado** (ver "Combate e condições"); não chega se a mudança não altera o que ele vê |
| `desenho.criado` | `{ desenho }` | mestre: sempre; jogador: só se a cena do desenho é a ativa |
| `desenho.movido` | `{ id, pontos }` | idem |
| `desenho.apagado` | `{ id }` | idem (o jogador só recebe se conhecia o desenho, na cena ativa) |
| `desenho.limpo` | `{ cenaId }` | idem: todos os desenhos da cena saem |
| `personagem.apagado` | `{ id }` | mestres; jogador que o via |
| `asset.registrado` | `{ meta }` | **só mestres** (as metas dos jogadores chegam por `asset.meta`, sob demanda) |
| `compendio.alterado` | `{ compendio: { hash, nomeOriginal, magias } \| null }` | todos (é só a referência ao asset; ver "Compêndio de magias (Lote 14)") |

#### Sigilo de cena e de personagem (Lote 4)

- O jogador só recebe a **cena ativa** (onde está o grupo): o snapshot dele tem `cenas: [a ativa]`. Nome, grid,
  mapa, chegada e tokens das outras cenas nunca chegam a ele; os eventos de cena (criar, editar, apagar, grid,
  mapa) das outras cenas não são enviados. O mestre olha e edita qualquer cena sem mover o grupo (a cena que ele
  vê é estado local da tela dele; as intenções de token, grid e mapa dizem de qual cena são).
- Ao levar o grupo, **todos recebem snapshot novo**; os eventos `grupo.movido` e `cena.*` só vão a mestres.
- Personagens no snapshot do jogador (desde o Lote 4b): os que ele **edita** e os que estão numa **pasta que ele vê**
  (ver "Pastas e quem edita"). A pasta decide quem vê o ITEM; `ficha.verOutras` (de novo ativa desde o Lote 9) decide quem vê
  a FICHA completa de um personagem que não edita (ver "Ficha 5e").
  O `token` visível de um NPC carrega o `personagemId` (um id opaco), mas o personagem em si não chega.
- `assetVisivelPara` olha a cena: só a imagem de token **da cena ativa**, o mapa e os tiles da cena ativa, a
  imagem do token padrão de um personagem que ele vê, e os arquivos `cifrado` (opacos).

#### Pastas e quem edita (Lote 4b)

- `Pasta { id, nome, ordem, visivel }`, sem subpastas. **Quem vê a pasta** vê tudo o que há nela: `todos`, `jogadores`
  (ids escolhidos) ou `mestre`. O item (`Personagem`) tem `pastaId` e `editores` ("pode ser controlado e editado
  por": `todos` os jogadores ou ids escolhidos; NPC sem ninguém). O mestre vê e edita tudo.
- **Quem vê o item** = a pasta dele **mais** quem o edita (substitui `ficha.verOutras`). **Controle do token** = quem
  edita o personagem do token, mais `controladoPor`; `ficha.alterar` vale para quem edita e para o mestre.
- **Sigilo:** o jogador nunca recebe pasta nem item que não vê, nem o nome deles (o snapshot e os eventos são
  filtrados por `pastaVisivelPara`/`personagemVisivelPara`). Mover o item de pasta (`personagem.editar`) usa o mecanismo
  de transição do personagem (`personagem.alterado` ou, para quem deixou de ver, `personagem.apagado`). Mudar a visibilidade
  de uma pasta manda **snapshot novo a todos** (os itens dela aparecem ou somem de uma vez); renomear não.
- O jogador que edita um item cuja pasta ele não vê recebe o item, mas não a pasta (a interface o mostra em "Seus itens").
- **Migração:** o personagem de jogador vai para a pasta "Personagens" (`mestre`) com `editores = [antigo dono]`; o NPC vai
  para "NPCs" (`mestre`). Assim só o antigo dono e o mestre continuam vendo, como antes. Vale para o banco antigo (migração
  SQLite do Lote 4b) e para a exportação v4 (e anteriores).
- `assetVisivelPara`: o retrato (`retratoHash`) e o token padrão valem para quem vê o personagem.

#### Camada `mapa` (Lote 4b)

`Token.camada` ganha `"mapa"`: objetos de cenário abaixo dos tokens (imagem do mapa e objetos). O jogador **vê** (cena ativa,
não oculto) mas não seleciona nem move; só a camada `tokens` é dele. O mestre seleciona na camada de trabalho `mapa`.
`tokenVisivelPara` aceita `mapa` e `tokens`; `podeMoverToken` exige `tokens` para o jogador. A camada de **desenho** do pincel só
existe na interface por enquanto.

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
Estado { seq, usuarios: Usuario[], permissoes: Permissoes, handouts: Handout[] /* V3; jogador: só os que `visivel` cita */,
         cenas: Cena[] /* jogador: só a ativa */, cenaAtivaId, tokens: Token[],
         pastas: Pasta[] /* jogador: as que vê */, personagens: Personagem[] /* jogador: os que edita ou de pasta que vê */,
         paredes: Parede[] /* Lote 5 */, luzes: ObjetoDeLuz[] /* Lotes 6 e 7; jogador: as que ele pode ver, na forma do navegador */,
         modelos: ModeloDeObjeto[] /* Lote 7; jogador: sem a duração, salvo no modo "exato" */,
         pontos: PontoDeLuz[] /* Lote 7; jogador: os visíveis da cena ativa */, relogio: RelogioSala /* Lote 7; jogador: só "pausada"; V1: o mestre recebe também `marcoMs?` (zerar o relógio) */,
         config: ConfigDaMesa /* Lotes 6 e 7; todos */, memoriaEsquecida?: Record<cenaId, seq> /* Lote 6; jogador: só a ativa */,
         ordemDeTurnoVisivel: boolean, combate?: Combate /* Lote 11; jogador: só as entradas que ele vê */,
         compendio?: { hash, nomeOriginal, magias: number } /* Lote 14; todos: só a referência ao asset */,
         assets?: AssetMeta[] /* só na visão do mestre */ }
Cena  { id, nome, larguraM, alturaM, grid: { quadradoM, visivel }, iluminacaoDinamica?, luzAmbiente?, fatorDeLuz?, // Lotes 5 e 6          // padrão: cena-1, 60 x 45 m, quadrado 1,5 m
        mapa?: { assetHash, pxPorQuadrado },
        chegada?: { x, y } /* onde o grupo chega; padrão: o centro */,
        cartao?: boolean /* V10c: cena como cartão; sem o campo é mapa */ }
Token { id, cenaId, nome, cor, tamanhoQuadrados (1..4), x, y /* centro, em metros */,
        camada: "mapa" | "tokens" | "mestre", oculto, controladoPor: string[] /* ids de usuário */,
        assetHash?: string /* imagem do token; sem ela vale o círculo gerado */,
        personagemId?: string /* o token guarda a PRÓPRIA cópia de nome, cor e imagem do token padrão */,
        condicoes?: Condicao[], exaustao?: 1..6, concentracao?: string /* Lote 11: marcas do token, sem regra automática */ }
Pasta { id, nome, ordem, visivel: { tipo: "todos" } | { tipo: "mestre" } | { tipo: "jogadores", ids } }
Personagem { id, pastaId, editores: { tipo: "todos" } | { tipo: "jogadores", ids } /* NPC: ids [] */, nome,
             retratoHash?, tokenPadrao: { cor, tamanhoQuadrados, assetHash? },
             visao: { alcanceM: number | null, visaoNoEscuroM },
             ficha?: Ficha /* Lote 9; ausente na visão de quem não edita e não tem `ficha.verOutras` */,
             modInteligencia?: number /* reserva (ficha sem atributos); vem calculado para quem não vê a ficha */ }
AssetMeta { hash /* SHA-256 hex do arquivo processado */, tipo: "mapa" | "token" | "retrato" | "tile" | "cifrado" | "compendio",
            mime, bytes, largura, altura, donoId, nomeOriginal,
            pedacos: string[] /* SHA-256 de cada pedaço de 256 KB */,
            tiles?: { hash, x, y, largura, altura }[] /* só no manifesto de mapa fatiado */ }
Usuario { id, nome, papel: "mestre" | "jogador" | "assistente", cor }
Permissoes { jogadores: Record<CapacidadeDelegavel, boolean>, porUsuario: Record<id, Partial<Record<CapacidadeDelegavel, boolean>>> }
```

- `permissoes.jogadores` só tem capacidades delegáveis (as exclusivas do mestre nunca são
  configuráveis).
- **Jogador** (e assistente): `porUsuario` só traz a entrada dele. (Até o V2, `notaMestre` também não existia no snapshot; as notas viraram handouts.)
- **Jogador, handouts (V3)**: `handouts` só tem os que `visivel` cita (`todos`, ou `jogadores` com o id dele); a pasta chega se ele a vê **ou** se vê algum handout dentro dela (`pastaChegaPara`). A imagem de um handout visível é visível para ele (`assetVisivelPara`).
- **Jogador**: `tokens` só tem os que ele pode ver (da cena ativa, camadas `mapa` e `tokens`, não ocultos); `cenas` só tem a ativa; `pastas` e `personagens` só os que ele vê.
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
`tocha.entregar`, `ponto.usar`, `luz.apagar`, `ficha.verOutras` (Lote 9: ver a ficha completa dos personagens que ela só vê, sem editar; padrão desligado), `dado.rolarOculto`, `asset.subir`, `desenho.criar` (Lote 13: usar o pincel; **ligada por padrão**; cobre criar, mover, apagar e voltar os próprios desenhos e o rascunho), `token.colocarProprio` (V10b: pôr o token do personagem que controla na área da bandeira; **ligada por padrão**).

Só do mestre, nunca delegáveis: `papel.alterar`, `permissao.alterar`, `mesa.configurar`,
`automacao.editar`, `camadaMestre.ver`, `cena.editar` (tokens, grid, mapa e, desde o Lote 4, criar e apagar personagens, cenas, levar o grupo e preparar cena), `objeto.ajustar`,
`campanha.exportar`, `campanha.importar`, `combate.gerir` (Lote 11: montar e conduzir a ordem de turno).

`mesa.configurar` cobre `pasta.*` e `ordemDeTurno.definir` (Lote 4b). `asset.subir` cobre `asset.registrar`, `token.definirImagem` e
as imagens que quem edita troca em `personagem.editar`. As intenções de vaivém de arquivos
(`asset.pedir`, `asset.inventario`, `asset.tenho`, `asset.naoTenho`), `ficha.alterar`, `personagem.editar` e `tocha.alternar` (Lote 7), `combate.rolar`, `combate.passar` e `token.condicoes` (Lote 11) não exigem capacidade
(`capacidadeDaIntencao` = `null`): qualquer mestre ou jogador pode enviar; nos arquivos o sigilo é conferido sobre o
asset (quem não pode subir ainda precisa ver o mapa) e na ficha, sobre quem edita o personagem.

Regra de `pode(usuario, capacidade, permissoes)`: mestre sempre; assistente nunca (por enquanto);
jogador: nunca as exclusivas do mestre; senão a exceção por usuário, se houver, senão o padrão da mesa.

### Exportação

`{ formato: "tabletop-campanha", versao: 13, exportadoEm, dados: { seq, usuarios, permissoes, handouts, cenas, cenaAtivaId, tokens, paredes, luzes, modelos, pontos, relogio, config, pastas, personagens, ordemDeTurnoVisivel, combate?, desenhos, compendio?, assets } }`. A **v13** (V3) troca `notaMesa` e `notaMestre` por `handouts`; de v1 a v12 continuam aceitas e as notas não vazias viram os handouts "Nota da mesa" (`todos`) e "Nota do mestre" (`mestre`) na pasta "Handouts" (só do mestre), criada se faltar (o resultado é sempre v13). Na importação a sala confere ids de handout únicos, pasta e jogadores existentes e meta da imagem. A **v12** (Lote 14) acrescenta `compendio` (opcional: só a referência `{ hash, nomeOriginal, magias }` ao asset do compêndio; a meta desse asset vai em `assets`, o arquivo de magias **nunca**); de v1 a v11 continuam aceitas (o resultado é sempre v12, sem compêndio) e o campo só vale na v12. Na importação a sala confere que o asset do compêndio tem meta do tipo `compendio` no arquivo (`compêndio sem meta`). A **v11** (Lote 13) acrescenta `desenhos` (os desenhos do pincel, ver "Pincel e desenhos"); de v1 a v10 continuam aceitas (o resultado era v11 e hoje é v12, com `desenhos: []`). Na importação a sala confere que ids de desenho não se repetem, que a cena e o autor existem no arquivo e que nenhuma cena passa de 1000 desenhos. A **v10** (Lote 11) acrescenta `combate` (a ordem de turno: entradas, a vez e a rodada; opcional, sem ele não há combate) e, dentro dos tokens, `condicoes`, `exaustao` e `concentracao` (opcionais). Na importação a sala confere que ids de entrada não se repetem, que a vez é de uma entrada que existe e que as entradas de token apontam para tokens do arquivo. De v1 a v9 continuam aceitas (o resultado é sempre v10, sem combate). A **v9** (Lote 9) traz as fichas 5e dentro de `personagens[].ficha` (a mesma forma da v8, só mais campos opcionais) e **não traz mais** `Personagem.mochila`: na importação (de v8 e anteriores) a mochila vira `ficha.itens` com `modeloId` (a quantidade é o número de objetos novos; os usados continuam objetos de luz com portador `mochila`). A **v8** (Lote 7) troca as fontes de luz por **objetos de luz** (`estado`, `saldoMs`, `acesaDesdeSala`, modificadores e histórico: são dado da campanha e vão no arquivo), completa a `config` e acrescenta `modelos`, `pontos` e o `relogio` (V1: com o `marcoMs` opcional do "zerar o relógio"; ausente = 0, sem subir a versão do arquivo; a campanha restaurada volta com a **mesa pausada**, no tempo em que foi exportada; a v7 e as anteriores importam com o relógio rodando a partir da importação); `Personagem.mochila` é opcional; os `acendimentos` pendentes **nunca** entram. De v1 a v8 continuam aceitas (o resultado era v9 e hoje é v10; `acesa: boolean` vira `estado`, os modelos da semente entram onde faltam). A **v7** (Lote 6) acrescenta `luzes` (as fontes de luz) e `config` (`ConfigDaMesa`); `Cena.luzAmbiente`/`fatorDeLuz`, `Token.visaoNoEscuroM` e `Personagem.modInteligencia` são campos opcionais (ausentes nos arquivos antigos: cena em luz de dia, sem visão no escuro, modificador 0) e `memoriaEsquecida` **nunca** entra (é dado da sessão); ids de fonte únicos, em cena existente e, se presas a token, a token da mesma cena são conferidos. De v1 a v6 continuam aceitas (o resultado é sempre v7, com `luzes: []` e a configuração padrão). A **v6** (Lote 5) acrescenta `paredes`; `Cena.iluminacaoDinamica` e `Token.alcanceVisaoM` são campos opcionais dentro de cenas e tokens (ausentes nos arquivos antigos: iluminação ligada, visão sem limite). ids de parede únicos e cena existente são conferidos.
Sem contadores de uso nem presença. `assets` são **só as metas dos assets usados** (mapas das cenas, imagens
dos tokens e os tiles deles), **nunca bytes**; `Cena.mapa` e `Token.assetHash` vão nos próprios objetos. A **v5**
(Lote 4b) acrescenta `pastas` e `ordemDeTurnoVisivel` e troca, nos personagens, `donoId` por `editores` e `pastaId` (mais `retratoHash`). A **v4**
(Lote 4, personagens com `donoId`) é migrada na importação: o dono vira "quem edita" e o personagem vai para a pasta "Personagens" (ou "NPCs"), só do mestre. Os
**preparos** (chaves do pré-envio) e os assets `cifrado` **nunca** entram. A **v3** (Lote 3, sem `personagens`), a **v2**
(Lote 2, sem `assets`) e a **v1** (Lote 1, sem `cenas`, `cenaAtivaId` nem `tokens`) continuam sendo aceitas na
importação: o resultado é sempre v8 (a v5 só ganha `paredes: []`, e a v6 só `luzes: []` e a configuração padrão), com `personagens: []`, `assets: []` e as duas pastas padrão onde faltavam; a v1 vira a cena padrão e nenhum token. Quem importa um mapa precisa
de alguém online com os arquivos (o cache dos navegadores serve; se ninguém tiver, o jogo mostra "indisponível").
Na importação a sala valida com zod e ainda exige: ids de usuário
únicos, pelo menos um mestre, exceções só para usuários existentes, ids de cena, de token e de personagem únicos, cena ativa
existente, tokens em cenas existentes, de personagens existentes e controlados por usuários existentes, ids de pasta únicos, pastas visíveis
para usuários existentes, personagens em pasta existente, editados por usuários existentes e com imagem de token padrão e retrato com meta, assets válidos (limites, dono
existente, tiles com meta) e referenciados por `Cena.mapa`/`Token.assetHash` com meta no arquivo, e que **quem importa continue
mestre** na campanha importada. A importação substitui tudo e manda snapshot novo a todos; sockets de
usuários que sumiram são fechados. O `seq` **nunca volta**: fica no maior entre o atual e o do arquivo,
para nenhum número já enviado ser reaproveitado. Capacidade delegável que o arquivo não traz (criada
depois da exportação) entra com o padrão da mesa.

### Paredes, portas e linha de visão (Lote 5)

`Parede { id, cenaId, a: {x,y}, b: {x,y} (metros), meio?: {x,y} (V5: um ponto do arco entre a e b; sem ele a parede é reta), tipo: "parede" | "porta" | "janela" | "secreta" | "invisivel", estado?: "aberta" | "fechada" | "trancada" }`.
`estado` só existe em `porta` e `secreta` (sem ele nascem fechadas; outro tipo perde o estado). `Estado.paredes` guarda todas.

**O que bloqueia** (`bloqueiaVisao` / `bloqueiaPassagem` em `shared/src/paredes.ts`): visão: parede, porta fechada ou trancada, secreta
fechada. Passagem: o mesmo, mais janela e invisível. Porta e secreta **abertas** não bloqueiam nada.

**Intenções** (todas do mestre, capacidade `cena.editar`, salvo `porta.alternar`):

| `tipo` | `dados` | Efeito |
|---|---|---|
| `parede.criar` | `{ cenaId?, paredes: [{ id, a, b, meio?, tipo, estado? }] }` (1 a 200) | cria a sequência numa mensagem; um `parede.criada` por parede; pontas limitadas à cena; recusa id repetido e parede sem comprimento |
| `parede.editar` | `{ id, a?, b?, meio?, tipo?, estado? }` | `parede.editada`; `parede_inexistente` se não existe. `meio`: `null` endireita; sem o campo o arco acompanha as pontas (o ponto anda com o meio da corda); três pontos alinhados não fazem arco |
| `cena.editar` | `{ cenaId, nome?, chegada?, mostrarParedesAosJogadores?, cartao? }` | V5: `mostrarParedesAosJogadores` liga os contornos de parede e porta para os jogadores (campo opcional da cena, sem ele desligado). Só desenho: não muda visão, luz nem bloqueio. V10c: `cartao` transforma a cena em cartão (`true`) ou a devolve a mapa (`false`): sem névoa nem limite de visão para ninguém, e a sala não manda as paredes da cena ao jogador (snapshot e eventos `parede.*`), não as usa no `token.soltar` dele e responde `porta_inexistente` ao `porta.alternar` dele; ao mudar o campo a sala manda snapshot novo a todos |
| `parede.apagar` | `{ id }` | `parede.apagada` |
| `cena.configurarIluminacao` | `{ cenaId?, dinamica }` | muda `Cena.iluminacaoDinamica` (sem o campo vale ligada); emite `cena.editada`, que o jogador recebe se for a cena ativa |
| `porta.alternar` | `{ id }` | capacidade `porta.abrir`. Ver abaixo |

`token.editar` aceita `alcanceVisaoM` (`null` tira o limite): alcance de visão de token **sem personagem**. Com personagem vale `visao.alcanceM`.
`cena.duplicar` copia as paredes da cena e `cena.apagar` apaga as dela (`parede.apagada` por parede).

**`porta.alternar`.** Mestre: qualquer porta ou secreta (a trancada abre; aberta fecha). Jogador: só `tipo: "porta"`, destrancada, com algum
token que ele controla a no máximo `ALCANCE_INTERACAO_PADRAO_M` (1,5 m; o `alcanceInteracaoM` da mesa ainda não é configurável) do **meio** da porta.
Respostas de `erro`: `porta_trancada`; `fora_de_alcance`; `porta_inexistente` (id inexistente, de outra cena, parede comum
ou **secreta**: para o jogador não há porta ali; a secreta só o mestre opera).

**Trajeto bloqueado.** `token.soltar` de jogador: se o segmento da posição gravada até a nova cruza algo que bloqueia passagem
(paredes da cena do token, inclusive a secreta), a sala responde `erro` com `trajeto_bloqueado` e nada muda; os outros clientes que viram o arraste ao
vivo recebem `token.movendo` com a posição gravada. O mestre ignora. `token.mover` (ao vivo) não é conferido: o cliente do jogador já não deixa
o token passar, e a sala confere ao soltar. Parede sobre a qual o token já está não conta (não fica preso).

**Eventos** `parede.criada`, `parede.editada` (parede inteira; o cliente faz upsert) e `parede.apagada { id }`. Quem recebe:

- **mestres**: tudo, como é;
- **jogador**: só paredes da cena ativa e **com a secreta disfarçada** (`paredeParaJogador`): secreta fechada ou trancada chega como `tipo: "parede"` sem
  estado; secreta aberta chega como `porta` `aberta`. A sala usa o estado de antes e de depois da intenção (como nos tokens):
  se o que o jogador veria não mudou (trancar ou destrancar a secreta), o evento nem chega; senão vai o evento já convertido
  (abrir: `porta` aberta; fechar: volta a `parede`). O jogador **nunca** recebe `secreta`, nem no snapshot (`visaoPara` converte e só traz a cena ativa) nem em evento.
  `invisivel` chega como é (o cliente precisa dela para o trajeto) e não é desenhada.

**Visão só de tela.** A sala **não** filtra tokens por visão: o que está fora da visão ou no escuro chega ao navegador, que não o desenha (para
esconder de verdade, marque como oculto). O navegador calcula o polígono de visibilidade de cada token que o jogador controla
(`poligonoDeVisibilidade`, varredura angular) e escurece o resto. Com `iluminacaoDinamica` desligada a cena fica toda visível. A visão noturna do
mestre e o "ver como o jogador X" são estado só da tela dele (o "ver como" aplica `visaoPara` localmente).

Novos códigos de erro: `parede_inexistente`, `porta_inexistente`, `porta_trancada`, `fora_de_alcance`, `trajeto_bloqueado`.

### Luz, visão no escuro e memória do mapa (Lote 6)

**Tudo só de tela** (PROJETO.md 3.1, princípio 2): luz, escuro, visão no escuro e memória são calculados no
navegador. A sala só guarda as **fontes de luz**, a **configuração** e a luz ambiente e o fator geral de cada cena;
um token que só está no escuro chega ao navegador e simplesmente não é desenhado. Para esconder de verdade,
marque o token como oculto.

```
FonteDeLuz { id, cenaId, nome, portador: { tipo: "cena", x, y } | { tipo: "token", tokenId },
             luz: { claraM, penumbraM, cor: "#rrggbb", tremula }, intensidade: 0..1, acesa }
ConfigDaMesa { iluminacao: { memoriaLigada, memoriaModo: "inteligencia" | "fixo", memoriaBaseM (15),
                             memoriaPorModM (3), memoriaFixaM (15), tomDaMemoria: "#rrggbb" } }
```

- **Raio efetivo** (`raiosEfetivos`): os dois raios (luz plena e luz plena + penumbra) × `intensidade` × `Cena.fatorDeLuz`
  (sem o campo: 1). A luz ambiente da cena (`Cena.luzAmbiente`, 0 a 1; **sem o campo vale 1**, para não escurecer campanha
  antiga sem aviso) soma uma luz uniforme.
- **Nível de luz num ponto** (`nivelDeLuz`): ambiente + 0,5 por luz cuja penumbra chega ali + 0,5 por luz cuja luz plena chega (as
  paredes que bloqueiam a visão bloqueiam a luz), limitado a 1. Classes: `plena` (≥ 0,95), `penumbra` (≥ 0,45), `escuro`.
- **O que o jogador vê** (`visaoNoPonto`): a interseção da luz com a visão dos tokens que ele controla. Plena aparece normal;
  penumbra, mais escura; escuro, nada. Dentro da visão no escuro (`Personagem.visao.visaoNoEscuroM`, ou `Token.visaoNoEscuroM` sem
  personagem; também parada pelas paredes e pelo alcance de visão), o escuro aparece em **cinza** e a penumbra vale como luz plena.
  Token só é desenhado onde o jogador o vê.
- **Memória do mapa** (`memoria.ts`): só de tela, em IndexedDB por usuário e cena, grade de 0,5 m. Onde o jogador já viu, fora do que vê agora, aparece
  só a camada do mapa, escurecida pelo `tomDaMemoria`, com opacidade que cai em linha reta com a distância até o token mais próximo (pelo alcance
  de cada um). Alcance (`alcanceDaMemoria`): modo `inteligencia` = `memoriaBaseM` + `memoriaPorModM` × `Personagem.modInteligencia` (15 m + 3 m × mod),
  nunca abaixo de 0; `fixo` = `memoriaFixaM`; `memoriaLigada: false` = sem memória. O que passa do alcance de todos os tokens do jogador é **apagado**.

| `tipo` | `dados` | Capacidade | Efeito |
|---|---|---|---|
| `fonte.criar` | `{ cenaId?, fonte: { id, nome, portador, luz, intensidade, acesa } }` | `cena.editar` | cria a fonte (cena omitida: a ativa). O ponto da luz fixa é limitado à cena; fonte presa a token exige o token na mesma cena (`token_inexistente`); `dados_invalidos` se o id existe; `cena_inexistente` |
| `fonte.editar` | `{ id, mudancas: { nome?, portador?, luz?: { claraM?, penumbraM?, cor?, tremula? }, intensidade?, acesa? } }` | `cena.editar` | muda a fonte (mover a luz fixa = trocar o `portador`); sem mudança real não gera evento; `fonte_inexistente` |
| `fonte.apagar` | `{ id }` | `cena.editar` | apaga a fonte; `fonte_inexistente` |
| `cena.configurarIluminacao` | `{ cenaId?, dinamica?, luzAmbiente?, fatorDeLuz? }` | `cena.editar` | só muda o que vier (dinâmica liga/desliga a visão por paredes; `luzAmbiente` e `fatorDeLuz` de 0 a 1); emite `cena.editada` |
| `config.iluminacao` | `{ mudancas: Partial<ConfigIluminacao> }` | `mesa.configurar` | muda os parâmetros da iluminação e da memória; emite `config.alterada` |
| `memoria.esquecer` | `{ cenaId? }` | `mesa.configurar` | manda todos os navegadores esquecerem a memória da cena (omitida: a ativa); emite `memoria.esquecida` |

`token.editar` aceita `visaoNoEscuroM` (`null` = 0) e `personagem.editar` aceita `modInteligencia` (inteiro de −5 a 10; sem o campo vale 0).
`token.apagar` e `personagem.apagar` apagam também as fontes presas ao token; `cena.apagar` apaga as da cena; `cena.duplicar` copia as fixas
(as presas a token seguem o token copiado); `grupo.moverPara` leva junto a luz presa ao token que muda de cena (`cenaId` da fonte acompanha).

**Eventos** `fonte.criada`, `fonte.editada` (fonte inteira; upsert), `fonte.apagada { id }`, `config.alterada { config }` (todos) e
`memoria.esquecida { cenaId, versao }`, em que `versao` é o `seq` do evento e fica em `Estado.memoriaEsquecida[cenaId]` (o navegador guarda a última
versão que aplicou junto da memória e esquece também se estava offline). Quem recebe:

- **mestres**: tudo;
- **jogador**: só fontes da cena ativa e **sem a de token que ele não vê** (oculto ou da camada do mestre): a luz de um goblin escondido o
  entregaria (`luzVisivelPara`). A fonte que deixa de ser visível chega como `fonte.apagada`, sem motivo. Esconder (ou mostrar) um token que carrega
  luz manda **snapshot novo a todos** (o filtro de evento cuida de um evento por vez). `memoria.esquecida` só da cena ativa; o snapshot do jogador só
  traz `memoriaEsquecida` dela. `config.alterada`: todos.

Novo código de erro: `fonte_inexistente`.

### Relógio da sala, objetos de luz, mochila e pontos (Lote 7)

**O tempo é da sala** (PROJETO.md 3.1, princípio 6). A sala guarda o relógio, o saldo de cada objeto e o instante em que ele
começou a contar, tudo no **relógio dela**, e um agendador acorda a sala no próximo marco. O navegador só recebe o que **pode ver** e anima a contagem entre
um envio e outro; `saldoMs` e `acesaDesdeSala` **nunca** saem da sala (nem para o mestre).

```
RelogioSala  { pausada, acumuladoMs, desdeReal? }       // tempo da sala = acumuladoMs + (agora − desdeReal), se não pausada
ObjetoDeLuz  { id, cenaId?, nome, modeloId?, portador, luz, intensidade, estado: "acesa" | "apagada",
               // só na sala: saldoMs (null = não se consome), acesaDesdeSala, duracaoMs (para os estágios), modificadores, historico
               // só no navegador: restanteMs, contando, estagio, fatorDeRaio (produto dos modificadores que valem)
               }
portador     = { tipo: "cena", x, y } | { tipo: "token", tokenId } | { tipo: "mao", personagemId, mao } |
               { tipo: "mochila", personagemId } | { tipo: "ponto", pontoId }
Modificador  { id, raioX, ateSala?, origem: "mestre" | "automacao", nota? }          // fim no relógio da sala; sem fim = até o mestre tirar
ModeloDeObjeto { id, nome, luz, duracaoS: number | null, ocupaMao, tags }              // Estado.modelos; semente: Tocha 5e (6+6 m, 60 min), Lanterna (9+9 m, 6 h), Fogueira (6+6 m, infinita, sem mão)
PontoDeLuz   { id, cenaId, nome, x, y, tipo: "suporte" | "inflamavel", capacidade?, modeloId?, segurarS? (3), visivelParaJogadores }   // Estado.pontos
Personagem.mochila?: Record<modeloId, number>                                         // só as unidades NOVAS; as usadas são objetos com portador mao ou mochila
ConfigDaMesa { maosPorPersonagem (2), penalidadeAoApagarS (0), alcanceInteracaoM (1,5), tempoParaJogadores: "exato" | "estagio" | "oculto",
               estagios: { fraca: 0.5, morrendo: 0.1 } /* frações da duração do modelo */, iluminacao }
```

`FonteDeLuz` do Lote 6 é o `ObjetoDeLuz` (mesma coleção `luzes`): `acesa: boolean` virou `estado`. As fixas do mapa (`cena`) e a criatura que brilha (`token`) continuam
sem tempo (`saldoMs: null`). Um objeto **consumido** (tempo acabou, ou a lixeira do mestre) **sai da coleção** (o histórico vai junto) e libera a mão. Banco do Lote 6: `objetoDoBanco`
lê `acesa` como `estado` ao carregar (as linhas só são regravadas quando mudam); os modelos da semente entram por uma migração de esquema.

**Saldo e estágios.** Acesa, o restante é `saldoMs − (sala − acesaDesdeSala)`. Ao apagar, o saldo vira o restante menos `penalidadeAoApagarS` (se não sobra nada, o objeto é consumido).
O estágio vem do restante sobre `duracaoMs`: `morrendo` (≤ `estagios.morrendo`), `fraca` (≤ `estagios.fraca`), senão `forte`. No estágio `morrendo` a luz tremula mais (só de tela).
**Mesa pausada**: o relógio congela, o agendador cancela tudo e retomar reagenda a partir do que sobrou (pausa de 5 min empurra o fim em 5 min).
**Pausa automática (R2b)**: quando a **última conexão de um mestre** cai, a sala espera 5 s (para absorver o recarregar da página, que fecha uma conexão um instante antes de abrir a outra) e, se nenhum mestre voltou, pausa a mesa sozinha **no tempo da sala da hora da saída** (não da espera). É o mesmo evento da pausa manual, `mesa.pausada { salaMs }`, com origem `{ usuarioId: "sistema", idPedido: "tempo" }` e **snapshot novo a todos** (o jogador recebe `salaMs: 0`); **não há campo novo** no protocolo, e a tela do jogador não distingue pausa manual de automática. Um mestre saindo enquanto outro continua conectado, um jogador saindo e uma mesa já pausada **não** pausam nada. Retomar continua sendo só do mestre (`mesa.retomar`). Ao **acordar** sem nenhum mestre conectado (processo reiniciado) com a mesa rodando, a sala pausa na hora. Os mestres são contados pelos sockets abertos (`getWebSockets()` e o papel do attachment), nunca por um contador em memória. A lógica pura é `pausarSeSemMestre` em `packages/shared/src/nucleo.ts`; a espera é o vencimento `mestre.ausente` do agendador.

**O que o navegador recebe** (`objetoParaVisao`, no snapshot e em todo evento `fonte.*`; feito na hora do envio):

| quem | `restanteMs` e `contando` | `estagio` | `historico`, `modificadores`, `duracaoMs` | `fatorDeRaio` |
|---|---|---|---|---|
| mestre | sempre (se o objeto se consome) | sempre | sim | se ≠ 1 |
| jogador, `tempoParaJogadores: "exato"` | sim | não | não (lista vazia) | se ≠ 1 |
| jogador, `"estagio"` | não | sim | não | se ≠ 1 |
| jogador, `"oculto"` | não | não | não | se ≠ 1 |

`contando` = acesa, com tempo e mesa rodando. O **relógio** do jogador traz só `pausada` (`acumuladoMs: 0`); o do mestre traz o tempo da sala na hora do envio. Os **modelos** do jogador vêm sem a duração
real fora do modo `exato`. Mudar `tempoParaJogadores` ou os estágios manda **snapshot novo a todos**.

**Quem vê o objeto** (`luzVisivelPara`): fixa, só a da cena ativa; presa a token, só se ele vê o token; **na mão**, a quem vê o token do dono na cena ativa; **na mochila**, a quem vê o personagem;
**num ponto**, se o ponto é visível a ele **ou se o objeto está aceso** (o objeto num ponto escondido chega como luz fixa na posição, sem o `pontoId`; o ponto nunca chega). `pontos`: o jogador só recebe
os visíveis da cena ativa; `ponto.alterado` que o esconde chega como `ponto.apagado`. Mudar a visibilidade (ou a posição, com objeto nele) de um ponto manda snapshot novo.

**Alcance** (`dentroDoAlcance`, puro): distância 5e no grid (Chebyshev) entre os quadrados mais próximos ocupados por cada um (token: `tamanhoQuadrados`; ponto: o quadrado que o contém) vezes o lado
do quadrado ≤ `alcanceInteracaoM`. Com 1,5 m, só adjacentes (inclusive na diagonal).

**Intenções novas**

| `tipo` | `dados` | Capacidade | Efeito |
|---|---|---|---|
| `mesa.pausar` / `mesa.retomar` | `{}` | `mesa.configurar` | pausa ou retoma o relógio da sala; eventos `mesa.pausada { salaMs }` / `mesa.retomada { salaMs, desdeReal? }` (o jogador recebe `salaMs: 0`) e **snapshot novo a todos**. Já no estado pedido: nada |
| `mesa.zerarRelogio` | `{}` | `mesa.configurar` | **V1.** Zera o número da pílula do topo: guarda um marco (`relogio.marcoMs`) no tempo da sala da hora. Não muda o tempo da sala nem as tochas; vale pausada (continua pausada) ou rodando. Evento `mesa.relogioZerado { salaMs, desdeReal? }` **só para o mestre** (o jogador não recebe o evento, nem snapshot novo, nem o marco). Sem snapshot novo |
| `config.mesa` | `{ mudancas: { maosPorPersonagem?, penalidadeAoApagarS?, alcanceInteracaoM?, tempoParaJogadores?, estagios?: { fraca?, morrendo? } } }` | `mesa.configurar` | muda a configuração; emite `config.alterada`; `dados_invalidos` se `morrendo` > `fraca` |
| `modelo.criar` / `modelo.editar` / `modelo.apagar` | `{ modelo }` / `{ id, mudancas: { nome?, luz?: parcial, duracaoS?: number \| null, ocupaMao?, tags? } }` / `{ id }` | `mesa.configurar` | eventos `modelo.alterado { modelo }` e `modelo.apagado { id }` (todos; o jogador sem a duração). Apagar recusa modelo em uso (objeto, mochila ou ponto): `dados_invalidos`. `modelo_inexistente` |
| `ponto.criar` / `ponto.editar` / `ponto.apagar` | `{ cenaId?, ponto }` / `{ id, mudancas: { nome?, x?, y?, capacidade?, modeloId?, segurarS?, visivelParaJogadores? } }` (`null` limpa capacidade, modelo e segurarS) / `{ id }` | `cena.editar` | eventos `ponto.alterado { ponto }` e `ponto.apagado { id }`; apagar o ponto apaga os objetos nele. `ponto_inexistente` |
| `tocha.acender` | `{ personagemId, modeloId, objetoId?, novoId? }` | `tocha.acender` | dono do personagem (ou mestre): acende um objeto **usado** da mochila (`objetoId`) ou um **novo** (`novoId` é o id que nasce; sai da quantidade) numa mão livre. `maos_cheias` (a apagada continua ocupando a mão), `modelo_inexistente`, `dados_invalidos` (sem unidade nova; modelo que não ocupa mão). A luz sai do token dele na cena ativa; sem token lá, o tempo corre e não há luz |
| `tocha.alternar` | `{ id }` | nenhuma (`null`; conferida: mão → `tocha.acender` e dono; ponto → `luz.apagar` para apagar, `ponto.usar` para reacender, e alcance; fixa e de token: só o mestre) | apaga (desconta `penalidadeAoApagarS`) ou reacende (mesmo saldo). Acender de novo objeto sem o que queimar: `dados_invalidos`. `sem_permissao`, `fora_de_alcance`, `ponto_inexistente`, `fonte_inexistente` (também para o que o usuário não vê) |
| `tocha.guardar` | `{ id }` | `tocha.acender` | a tocha da mão vai para a mochila (apagada antes, com a penalidade) |
| `tocha.entregar` | `{ id, tokenId }` | `tocha.entregar` | do dono (ou mestre) para a mão livre de outro token **dentro do alcance** e na mesma cena; o saldo vai junto. `fora_de_alcance`, `maos_cheias`, `token_inexistente`, `dados_invalidos` (token sem personagem) |
| `tocha.posar` | `{ id, pontoId }` | `tocha.entregar` | põe a tocha da mão num **suporte** dentro do alcance e com espaço (`capacidade`, padrão 1): `suporte_cheio`, `ponto_inexistente` |
| `ponto.pegar` | `{ id, personagemId }` | `ponto.usar` | tira a tocha do suporte para a mão livre do personagem (que o usuário controla), dentro do alcance |
| `ponto.acenderInicio` / `ponto.acenderFim` | `{ pontoId, objetoId }` | `ponto.usar` | segurar a tocha **acesa** sobre um **inflamável**: `Inicio` marca o instante pelo **relógio da sala** (pendência transitória em `Estado.acendimentos`, que não vai ao banco, à exportação nem aos navegadores); `Fim` só vale se passaram `segurarS` (padrão 3; tolerância de 300 ms), com a tocha ainda acesa, ao alcance e sem fogo no ponto: cria o objeto do `modeloId` do ponto e torna o ponto visível. A tocha continua na mão. Antes do tempo: `segurar_incompleto` |
| `objeto.ajustar` | `{ id, ajuste }`, `ajuste` = `{ acao: "tempo", deltaMs, nota? }` \| `{ acao: "modificar", modificador: { id, raioX, duracaoMs?, nota? } }` \| `{ acao: "tirarModificador", id }` \| `{ acao: "consumir" }` | `objeto.ajustar` (só do mestre) | soma ou tira tempo do saldo (entra no histórico: "+1 min (mestre)"; se não sobra nada, consome); modificador de raio com ou sem prazo (no relógio da sala); `consumir` é a lixeira (a tocha de um jogador também) |
| `mochila.ajustar` | `{ personagemId, modeloId, delta }` | `objeto.ajustar` | o mestre muda a quantidade de unidades novas (de 0 a 99); emite `personagem.alterado` |

Mudam também: `fonte.criar` / `fonte.editar` (só `cena` e `token`; `acesa` virou `estado: "acesa" | "apagada"`); `fonte.editar` não troca o portador de um objeto de jogo; `personagem.apagar` leva junto o que ele carrega
(mão e mochila); `cena.duplicar` copia os pontos (vazios) e só as luzes fixas; `cena.apagar` apaga os pontos e o que há neles.

**Intenção interna do sistema.** O vencimento (consumir o que acabou, tirar modificador vencido, reenviar o objeto cujo estágio mudou) é `processarSistema`, chamada só pelo alarme do agendador da sala.
**Não existe em `IntencaoSchema`**: nenhuma mensagem de cliente a alcança (`mensagem_invalida`), e `processar` não reconhece um usuário "sistema". Os eventos dela têm `origem.usuarioId: "sistema"`.
O agendador guarda um vencimento `luz.marco` por objeto (o próximo marco: virar `fraca`, `morrendo`, acabar, vencer um modificador), em tempo real.

**Eventos novos**: `mesa.pausada`, `mesa.retomada`, `mesa.relogioZerado` (V1), `modelo.alterado`, `modelo.apagado`, `ponto.alterado`, `ponto.apagado`; `fonte.*` agora carregam o objeto **na forma do navegador**.
**Códigos de erro novos**: `ponto_inexistente`, `modelo_inexistente`, `maos_cheias`, `suporte_cheio`, `segurar_incompleto`.

**Gancho de teste da sala** (só com `MODO=teste`, como `/teste/zerar`): `POST /teste/avancar-relogio?ms=N` adianta o relógio da sala em `N` ms. Fora do modo de teste responde 404.

### Dados e chat (Lote 8)

**Princípio:** os dados rolam na sala (`crypto.getRandomValues`, com rejeição: sem viés de módulo). O cliente manda só a **notação**; qualquer campo de resultado que ele junte (`total`, `resultado`, `rolagens`, `critico`...) é descartado pelo schema (zod ignora o que não declara) e a sala rola de novo.

#### Intenções

| `tipo` | `dados` | Capacidade | Efeito |
|---|---|---|---|
| `chat.enviar` | `{ texto (1 a 2000), como? }` | `null` (todos) | a sala lê o texto (comandos abaixo) e cria a mensagem. `como`: id de um personagem que a pessoa edita (mestre: qualquer um); senão `personagem_inexistente` (não existe **ou** não vê) ou `sem_permissao` (vê, não edita) |
| `dado.rolar` | `{ expressao, oculta?, como? }` | `null` | rola e manda a mensagem de rolagem (os dados rápidos). `oculta`: só o mestre ou quem tem `dado.rolarOculto` (padrão desligado), senão `sem_permissao` |
| `chat.modelo` | `{ modelo: "ataque", nome, bonus, dano, danoTipo?, vantagem?, oculta?, como? }` ou `{ modelo: "teste", nome, bonus, cd?, vantagem?, oculta?, como? }` | `null` | ataque (d20 + bônus e o dano; 20 natural **dobra os dados** do dano, não os modificadores) ou teste (com `cd`: sucesso se total ≥ CD; sem `cd`: teste simples). `vantagem`: `normal` (padrão), `vantagem` (`2d20kh1`) ou `desvantagem` (`2d20kl1`). A ficha do Lote 9 manda este pedido (`pedidoDeAtaque`/`pedidoDeTeste` em `rolagens.ts`) |
| `chat.anteriores` | `{ antesDoSeq }` | `null` | responde `chat.anteriores` (abaixo), só a quem pediu, até 100 mensagens **que ele pode ver**, mais antigas que `antesDoSeq` |
| `chat.limpar` | `{}` | `mesa.configurar` (só do mestre) | apaga o histórico e manda `chat.limpo` a todos (a confirmação é da interface) |

Erros: `dados_invalidos` (notação recusada, com o motivo em português), `mensagem_invalida` (mais de 2000 caracteres), `muitas_mensagens` (novo código: mais de **10 mensagens de chat por segundo por conexão**; vale para `chat.enviar`, `dado.rolar`, `chat.modelo` e `chat.magia`; a recusada não conta na janela).

#### Notação (`packages/shared/src/dados.ts`)

`NdM`, `dM` (= 1dM), `d%` (= d100), constantes, `+` e `−`, espaços, `khN`/`klN` (`2d20kh1` = vantagem, `2d20kl1` = desvantagem). Limites: 100 dados por termo, 1000 faces (mínimo 2), 20 termos, constante até 100 000, 200 caracteres; a expressão precisa de pelo menos um dado. Acima disso: recusa com motivo. O resultado (`Rolagem`) guarda cada dado (os descartados marcados), o subtotal de cada termo, o total e a expressão canônica (com o crítico, os dados já dobrados).

#### Comandos do chat (dentro de `chat.enviar`)

| Comando | O que faz | Quem vê |
|---|---|---|
| texto | mensagem comum; `[[1d20+5]]` no meio rola na hora (até 10 por mensagem; uma rolagem para cada, na ordem; `inline: true`) | todos |
| `/r 1d20+5 comentário` | rola; a expressão é o maior começo válido e o resto vira o texto da mensagem | todos |
| `/gr 1d20` | rolagem oculta (`oculta: true`) | autor e mestre |
| `/w Nome texto` | sussurro. O nome é o do usuário (com espaço: "Jogador 2"), entre aspas, o id, ou um prefixo único | autor, destinatário e mestre |
| `/em texto` | ação em terceira pessoa (`acao: true`): "Brisa olha em volta" | todos |
| `/?` | lista os comandos; **é só da tela** (a interface não envia; se chegar à sala, nada acontece) | — |

#### `Mensagem` (`chat.ts`)

```
Mensagem { id ("m<seq>"), seq (o do evento), emSala? (relógio da sala, ms), emReal (ms desde 1970, só para HH:MM), autorId,
           como?: { personagemId, nome, retratoHash? }, tipo: "texto" | "rolagem" | "modelo" | "magia",
           texto?, acao?, inline?, rolagens?: Rolagem[], modelo?: ResultadoDeModelo, magia?: MagiaDoCompendio /* Lote 14 */,
           visivelPara: "todos" | { ids }, oculta? }
```

`como` carrega o nome e o retrato **dentro da mensagem** (quem lê não vê o personagem na ficha). `emSala` só vai ao jogador no modo `tempoParaJogadores = exato` (a mesma regra do tempo das tochas).

#### Eventos e mensagens da sala

| Mensagem | `dados` | Quem recebe |
|---|---|---|
| evento `chat.mensagem` | `{ mensagem }` | **filtrado**: mestre sempre; jogador só se é o autor, destinatário ou a mensagem é `todos` |
| evento `chat.limpo` | `{}` | todos |
| `chat.anteriores` | `{ mensagens, temMais }` | só quem pediu, já filtrado |

#### Sigilo e histórico

- O filtro é um só (`mensagemVisivelPara`/`mensagemParaUsuario`) e vale no **snapshot**, no **evento** e no **`chat.anteriores`**. Sussurro e rolagem oculta nunca chegam a quem não pode ver; o jogador não distingue "não existe" de "não é meu".
- Histórico: tabela própria `chat` do SQLite da sala (migração 6, aditiva: o banco antigo ganha a tabela vazia), **fora de `entidades`** e portanto fora da exportação e intocada pela importação. Sem limite de gravação. O snapshot traz as últimas **200** mensagens visíveis ao usuário (a sala lê o histórico em páginas e filtra até juntar 200); "carregar anteriores" pede mais.
- O estado em memória da sala nunca acumula o chat. `Estado.chat` só existe na visão enviada e no navegador; `Estado.retratosDoChat` é interno da sala (libera a imagem do retrato de quem fala em público a quem lê) e nunca sai.
- O chat **não entra** na exportação (v8 continua v8).

**Gancho de teste da sala** (só com `MODO=teste`): `POST /teste/dados?semente=N` faz os dados saírem de uma sequência com semente fixa (sem `semente`, volta ao `crypto`); `/teste/zerar` também a desliga. Fora do modo de teste responde 404.

### Ficha 5e (Lote 9)

`Ficha` (`packages/shared/src/ficha.ts`, zod) guarda só valores base; tudo o mais sai de funções puras (`derivar`). Só `pvAtual` e `pvMax`
são obrigatórios (a ficha do Lote 4 continua valendo); o resto é opcional e lido com o padrão (atributo 10, sem proficiência, 30 ft):

```ts
Ficha { raca?, antecedente?, alinhamento?, classes?: { classe, subclasse?, nivel 1..20 }[],
        atributos?: { for, des, con, int, sab, car: 1..30 },            // cada um opcional
        salvaguardas?: { [atributo]: { nivel: "nenhuma" | "proficiente" | "especialista", bonus? } },
        pericias?: { [id de perícia]: { nivel, bonus? } },              // 18 perícias do SRD (acrobacia, adestrarAnimais...)
        ca?: { valor, nota? }, deslocamentoFt?, iniciativaBonus?,
        pvAtual, pvMax, pvTemp?, dadosDeVidaUsados?: { d6|d8|d10|d12: n }, mortes?: { sucessos 0..3, falhas 0..3 },
        ataques?: { nome, acerto?: { tipo: "fixo", valor } | { tipo: "formula", atributo, proficiente, bonus? },
                    cd?, dano?: "1d8+3", tipo? }[],
        conjuracao?: { classe, habilidade }[],  espacosGastos?: { "1".."9": n },  pactoGasto?, magias?: { nome, nivel 0..9, preparada, escola?, descricao }[],
        caracteristicas?: { nome, descricao }[],  itens?: { nome, quantidade, modeloId?, nota? }[],
        recursos?: { nome, atual, max, recarga: "curto" | "longo" | "nenhuma" }[],  idiomas?: string[],  notas? }
```

- **Gravação agrupada**: o navegador junta as mudanças por ~400 ms e manda uma `ficha.alterar` com a lista de operações;
  ele só enfileira o que deixa a ficha válida (campo meio digitado nunca derruba o lote). Duas pessoas no mesmo campo: vale a última a chegar.
- **Evento**: `personagem.alterado` com o personagem inteiro (como antes), agora **filtrado por usuário**.
- **Sigilo** (`personagemParaUsuario`, o mesmo filtro no snapshot e nos eventos): a ficha completa só vai ao **mestre**, a quem **edita**
  o personagem e, com `ficha.verOutras`, aos demais jogadores que veem o item. Sem isso o item chega **sem `ficha`** (nome, retrato, token e visão
  continuam; `modInteligencia` vem já calculado, porque a memória do mapa depende dele). No evento o filtro compara o que o usuário tinha com o
  que passaria a ter: mudança que ele não enxerga (ex.: PV de outro personagem) **nem chega**; mudança do item (nome) chega sem a ficha; quem
  ganha ou perde a edição recebe o personagem com ou sem a ficha. **Ligar ou desligar `ficha.verOutras`** (padrão da mesa ou exceção por
  usuário) manda **snapshot novo a todos**.
- **Modificador de Inteligência**: vem do atributo `int` da ficha quando há atributos; sem eles vale o campo antigo `Personagem.modInteligencia`.
- **A mochila do Lote 7** é `ficha.itens` com `modeloId`: `tocha.acender` (objeto novo), `mochila.ajustar` e as contagens usam a quantidade do item.
  Os objetos usados continuam na coleção `luzes` (portador `mochila` ou `mao`).
- **Tocha na mão e quem edita**: o objeto com portador `mao` agora chega também a **quem edita o personagem**, mesmo com o token fora da cena ativa
  (`luzVisivelPara`). Quando muda quem edita ou a pasta do personagem, a sala reenvia os objetos que ele carrega (`fonte.editada`) e o filtro de
  cada jogador decide: aparece, some (`fonte.apagada`) ou nada muda.
- **Arquivo da ficha** (exportar/importar, sem protocolo): `{ formato: "tabletop-ficha", versao: 2, nome?, exportadoEm?, ficha }` (a versão 1, sem os campos da ficha de papel do V4a, continua lendo). Importar manda
  `ficha.alterar` com `{ caminho: "", valor: ficha }` (troca tudo).
- **Rolar da ficha** usa o que já existe: `chat.modelo` (ataque e teste, com `como` o personagem) e, para dano solto, `chat.enviar` com `/r <dano> <nome>`.

### Combate e condições (Lote 11)

Sem mudar o número do protocolo. O combate é **um objeto só** (`Estado.combate`), enviado inteiro a cada mudança (`combate.alterado`):

```
Combate { entradas: EntradaDeCombate[], atualId?: string /* id da entrada da vez; sem ele o combate não começou */, rodada: number /* 0 = não começou */ }
EntradaDeCombate { id, tokenId?, nome, iniciativa? /* -99..999; sem valor = espera a rolagem */,
                   destreza? /* só mestre e sala: desempate */, jogador? /* o token é de PJ */,
                   valorOculto? /* o jogador vê "?" */, oculta? /* o jogador não recebe a entrada */ }
```

A vez é sempre o **id da entrada**, nunca um índice (o índice revelaria quantas entradas ocultas existem).

| `tipo` | `dados` | Capacidade | Efeito |
|---|---|---|---|
| `combate.adicionar` | `{ entradas: [{ id, tokenId?, nome?, iniciativa?, valorOculto?, oculta? }] }` (1 a 200; sem `tokenId` o `nome` é obrigatório) | `combate.gerir` (só do mestre) | entrada de token: o nome vem do token e a Destreza da ficha (se tiver o atributo); o mesmo token não entra duas vezes (quem já está fica como está). A lista volta ordenada pelos valores. `token_inexistente`, `dados_invalidos` (id repetido, mais de 200) |
| `combate.tirar` | `{ id }` | `combate.gerir` | tira a entrada. Se era a vez, o turno **passa para a seguinte** (e, se era a última, volta à primeira e a rodada soma); se a lista esvazia, ninguém fica na vez. `dados_invalidos` se a entrada não existe |
| `combate.editar` | `{ id, mudancas: { nome?, iniciativa?: number \| null, valorOculto?, oculta? } }` | `combate.gerir` | muda a entrada; mudar o valor (`null` tira) **reordena** a lista |
| `combate.mover` | `{ id, indice }` | `combate.gerir` | o arrasto à mão: a entrada vai para a posição `indice`; a vez continua na mesma entrada |
| `combate.ordenar` | `{}` | `combate.gerir` | volta à ordem pelos valores (maior primeiro; empate: maior Destreza, depois PJ antes de NPC, depois o nome; sem valor no fim) |
| `combate.rolar` | `{ ids?: string[] }` (1 a 200) | nenhuma (`null`; conferida) | **mestre** sem `ids`: rola de todos que ainda não têm valor ("Rolar para todos"); com `ids`: dessas (de novo, se já tinham). **Jogador**: `ids` obrigatório, só entradas dos tokens que ele **controla** (edita o personagem ou está em `controladoPor`, como um familiar) e que ainda não têm valor; entrada que ele não vê responde `dados_invalidos` (igual à inexistente), a de outro, `sem_permissao`. Rola pelo modelo de teste do Lote 8: d20 + o bônus de iniciativa da ficha (ou 0); cada rolagem vira uma mensagem do chat (`tipo: "modelo"`, `nome: "Iniciativa"`). **As de NPC** (e de entrada com valor oculto ou escondida) vão **ocultas** (`visivelPara: { ids: [] }`, `oculta`: só o mestre e quem rolou); as de PJ, públicas |
| `combate.proximo` / `combate.anterior` | `{}` | `combate.gerir` | o primeiro `proximo` abre a rodada 1 na primeira entrada; passar da última volta à primeira e soma a rodada; `anterior` volta (atravessa a rodada; na rodada 1 não há para onde voltar) |
| `combate.passar` | `{}` | nenhuma (`null`; conferida) | passa o turno da entrada da vez: o **mestre**, ou quem **controla** o token dela (edita o personagem ou está em `controladoPor`) e a vê. Senão `sem_permissao` ("Não é o seu turno") |
| `combate.encerrar` | `{}` | `combate.gerir` | limpa a lista e a rodada (`combate.alterado { combate: null }`); a interface pede confirmação |
| `combate.entrar` | `{ tokenId }` | nenhuma (`null`; conferida) | **V2.** Entra na ordem de turno com o token. A sala confere: a ordem está aberta (`ordemDeTurnoVisivel`, senão `dados_invalidos`); o token existe e o usuário o vê (`token_inexistente`); o usuário é o mestre ou **controla** o token (`sem_permissao`); o token está na cena ativa e ainda não está na lista (`dados_invalidos`, "Já está na ordem de turno."). **Rola 1d20 + a iniciativa da ficha na sala** (o cliente não manda o número), manda a rolagem ao chat (a de NPC, oculta; a de PJ, pública) e põe a entrada, com o valor, na lista (reordenada pelos valores). Máximo de 200 entradas |
| `combate.rodada` | `{ rodada: 0..9999 }` | `combate.gerir` | **V2.** O mestre escreve a rodada. 0 = ainda não começou (e ninguém fica na vez) |
| `combate.darVez` | `{ id }` | `combate.gerir` | **V2.** Dá a vez a uma entrada; a rodada continua (abre a 1 se ainda era 0). `dados_invalidos` se a entrada não existe |
| `token.condicoes` | `{ id, condicoes?: Condicao[], exaustao?: 0..6, concentracao?: string \| null }` | nenhuma (`null`; conferida) | o **mestre** ou quem **controla** o token (edita o personagem ou está em `controladoPor`): `condicoes` troca a lista inteira (as 14: `agarrado`, `amedrontado`, `atordoado`, `caido`, `cego`, `contido`, `enfeiticado`, `envenenado`, `incapacitado`, `inconsciente`, `invisivel`, `paralisado`, `petrificado`, `surdo`; repetidas viram uma), `exaustao` 0 tira, `concentracao` `null` tira. Emite `token.editado` (o filtro de tokens decide quem recebe). Token invisível para o jogador: `token_inexistente`; token que ele não controla: `sem_permissao`. Nenhuma regra é aplicada sozinha |

**Sigilo** (`combateParaUsuario`, o mesmo filtro no snapshot e nos eventos). O mestre recebe tudo. O jogador só recebe a entrada cujo token ele recebe (visível: cena ativa, camada `mapa`/`tokens`, não oculto) e que não é `oculta`; a entrada solta `oculta` e a de token oculto ou da camada do mestre **não chegam**, nem no snapshot nem em evento nenhum. As que chegam vêm **sem `destreza`** e sem a marca `oculta`; com `valorOculto` o número **nunca viaja** (a entrada chega com o nome e `valorOculto: true`). Se a vez é de uma entrada que ele não vê, `atualId` não vai (nada fica em destaque para ele); a `rodada` chega a todos. O evento `combate.alterado` **só chega ao jogador se o que ele vê mudou** (mudar o valor de uma entrada oculta não gera nada). Esconder ou mostrar um token que está na ordem manda **snapshot novo a todos**. Apagar o token (ou o personagem, ou a cena) tira as entradas dele, no mesmo pedido. As rolagens de NPC são mensagens ocultas do chat (ver "Dados e chat"). Condições e concentração moram no token: quem vê o token as vê.

**Persistência**: o combate fica no SQLite, tabela `combate` (uma linha, migração 7; o banco antigo ganha a tabela vazia = sem combate); linha ilegível vira "sem combate". As condições vão dentro da linha do token. A importação troca o combate junto com o resto.

**V2 (2026-11-11):** a interface deixou de usar `combate.adicionar` (só o "Entrar na iniciativa" do menu do token), `combate.rolar` e `combate.passar`; as intenções continuam na sala. `combate.encerrar` continua limpando a lista e a rodada, e a ordem aberta (`ordemDeTurno.definir`) não muda. Intenções novas: `combate.entrar`, `combate.rodada`, `combate.darVez`. Sem evento novo e sem campo novo no estado.

**Capacidade nova**: `combate.gerir` (só do mestre). **Evento novo**: `combate.alterado`. **Intenções novas** (o pedido `chat.modelo` de ataque ganhou `margemCritico`, `danoCritico` e `salvaguarda { cd, atributo, sucesso }`, todos opcionais, V4a refeito): `combate.adicionar`, `combate.tirar`, `combate.editar`, `combate.mover`, `combate.ordenar`, `combate.rolar`, `combate.proximo`, `combate.anterior`, `combate.passar`, `combate.encerrar`, `token.condicoes`.

### Pincel e desenhos (Lote 13)

Sem mudar o número do protocolo. Um **desenho** é `{ id, cenaId, autorId, forma, pontos, cor, espessura, preenchido? }`, coleção `desenhos` do estado (e tabela própria no SQLite):

- `forma`: `livre` (o traço, 1 a 2000 pontos; 1 ponto é um pingo), `linha` (2 pontos: início e fim), `retangulo` (2 cantos opostos) ou `circulo` (o centro e um ponto da borda). Linha, retângulo e círculo com outra quantidade de pontos são recusados pelo schema.
- `pontos`: metros da cena (arredondados ao centímetro; a sala traz para dentro da cena o que passar da borda). `cor`: `#rrggbb` (a sala grava em minúsculas). `espessura`: 1 a 24, em **pixels do mundo** (zoom 100%; o desenho cresce com o zoom, nunca fica mais fino que 1,5 px na tela). `preenchido`: só vale para retângulo e círculo (nas outras formas a sala descarta).
- Limites: 2000 pontos por desenho e **1000 desenhos por cena** (`limite_de_desenhos`).
- O traço livre é **simplificado no navegador** (Douglas–Peucker, tolerância de 5 cm; `simplificarTraco` e `prepararTraco` em `desenho.ts`) antes de enviar.

| `tipo` | `dados` | Capacidade | Efeito |
|---|---|---|---|
| `desenho.criar` | `{ desenho: { id, cenaId?, forma, pontos, cor, espessura, preenchido? } }` | `desenho.criar` | cria o desenho; o autor é quem pede (um `autorId` enviado é ignorado). Jogador: só na cena **ativa** (outra cena: `sem_permissao`); mestre: em qualquer cena (`cenaId`, ou a ativa). O `id` é o mesmo do rascunho. `dados_invalidos` (id repetido), `cena_inexistente`, `limite_de_desenhos` |
| `desenho.mover` | `{ id, dx, dy }` | `desenho.criar` | desloca o desenho inteiro (metros); a sala limita o deslocamento para ele ficar dentro da cena (sem efeito, e sem evento, se não há para onde ir). Jogador: só os próprios; mestre: todos. `desenho_inexistente` (também para o desenho de uma cena que o jogador não recebe), `sem_permissao` |
| `desenho.apagar` | `{ ids: string[] }` (1 a 50) | `desenho.criar` | apaga um ou vários. Basta **um** que não seja dele para o jogador ter o pedido inteiro recusado (`sem_permissao`); id que não existe mais é ignorado (apagar é idempotente, para duas pessoas apagando o mesmo desenho) |
| `desenho.voltar` | `{ cenaId? }` | `desenho.criar` | apaga o desenho **mais recente de quem pede** na cena (ativa; o mestre pode dizer a cena). Nunca o dos outros; sem nenhum, não faz nada |
| `desenho.limpar` | `{ cenaId? }` | `cena.editar` (**só do mestre**) | apaga todos os desenhos da cena (a interface pede confirmação) |
| `desenho.rascunho` | `{ id, desenho: { cenaId?, forma, pontos, cor, espessura, preenchido? } | null }` | `desenho.criar` | o traço em andamento, **só repassado** (nunca gravado, sem `seq`); `desenho: null` cancela. O navegador manda a cada ~80 ms; a sala descarta em silêncio o que chegar menos de **30 ms** depois do anterior da mesma conexão (`INTERVALO_MINIMO_RASCUNHO_MS`) e guarda no máximo 16 traços abertos por conexão |

**Eventos** (sempre o que mudou): `desenho.criado { desenho }`, `desenho.movido { id, pontos }`, `desenho.apagado { id }` e `desenho.limpo { cenaId }` (todos os da cena). **Mensagens da sala sem `seq`** (como `token.movendo`): `desenho.rascunhando { desenho }` (o `Desenho` completo, com o `autorId` posto pela sala) e `desenho.rascunhoFim { id }`. O rascunho **nunca volta ao autor**. Ele some para os outros quando o `desenho.criado` com o mesmo `id` chega, quando o autor cancela e **quando a conexão dele cai** (a sala manda o fim de cada traço aberto).

**Sigilo** (a mesma regra dos tokens visíveis da cena, `desenhoVisivelPara`): o **mestre recebe todos** os desenhos e rascunhos; o **jogador só os da cena ativa**. Isso vale no snapshot (`visaoPara`), nos eventos (`eventoPara`: o de outra cena nunca chega ao jogador) e no rascunho (a sala só o repassa a quem `desenhoVisivelPara` aceita). Levar o grupo para outra cena manda snapshot a todos, e o jogador passa a receber os desenhos da cena nova. Não há desenho "escondido": desenhar é público para quem recebe a cena.

**Cenas**: apagar a cena apaga os desenhos dela (o `reduzir` de `cena.apagada` os tira; o banco também); duplicar a cena duplica os desenhos (`desenho.criado` com id novo, o mesmo autor), na ordem de criação.

**Persistência**: tabela `desenhos (id, cena_id, dados)` do SQLite (migração 8; o banco antigo ganha a tabela vazia). A ordem de criação (a do `rowid`) vale para o "voltar" e sobrevive a mover (UPDATE). Linha ilegível é ignorada ao carregar. A importação troca os desenhos junto com o resto.

**Capacidade nova**: `desenho.criar` (delegável, ligada por padrão; campanhas antigas ganham o padrão ao carregar, como as anteriores). **Eventos novos**: `desenho.criado`, `desenho.movido`, `desenho.apagado`, `desenho.limpo`. **Mensagens novas**: `desenho.rascunhando`, `desenho.rascunhoFim`. **Intenções novas**: `desenho.criar`, `desenho.mover`, `desenho.apagar`, `desenho.voltar`, `desenho.limpar`, `desenho.rascunho`. **Códigos de erro novos**: `desenho_inexistente`, `limite_de_desenhos`.

### Compêndio de magias (Lote 14)

O compêndio é um arquivo JSON da **pasta local do mestre** (`compendio/magias.json`), fora do repositório e **nunca gravado no servidor**: a sala só guarda a meta do asset e a referência `Estado.compendio`. O texto das magias só trafega nos **pedaços binários** do asset (o mesmo caminho das imagens: `asset.pedir`, `asset.enviar`, frames de 256 KB, cache OPFS), e nenhum frame de texto o leva (nem a meta: nome do arquivo, `bytes`, hashes dos pedaços, `largura` e `altura` 1).

**Formato** (`packages/shared/src/compendio.ts`, zod):

```
{ formato: "tabletop-compendio", versao: 1, creditos?: string /* atribuição da licença, só mostrada */,
  magias: { nome, nomeOriginal?, nivel: 0..9 /* 0 = truque */, escola, tempo, alcance, componentes, duracao,
            concentracao: boolean, ritual: boolean, classes: string[], descricao, emNiveisSuperiores? }[] }
```

Limites: arquivo **8 MB** (`LIMITES_DE_ASSET.bytesDoCompendio`), **2000 magias**, nome 80, escola 32, tempo/alcance/duração 100, componentes 300, 20 classes de até 40, descrição 12 000, "em níveis superiores" 4 000, créditos 2 000 caracteres; todo texto é aparado e não pode ficar vazio; **nome repetido** (sem acento nem caixa) é recusado. `lerCompendio(texto)` devolve o motivo **em português, com o campo** ("magia 2, campo nivel: precisa ser no máximo 9"). Campos desconhecidos são ignorados. Exemplo com 3 magias do SRD 5.1 (CC-BY-4.0) em `fixtures/compendio/exemplo-srd.json` (atribuição em `fixtures/compendio/ATRIBUICAO.md` e no campo `creditos`).

**Asset `compendio`**: `asset.registrar` com `tipo: "compendio"` (`mime: application/json`, `largura` e `altura` 1, até 8 MB) é **só do mestre** (`sem_permissao`). Visibilidade (`assetVisivelPara`): o mestre vê tudo; **todo jogador vê (e baixa) o asset cujo hash é `Estado.compendio.hash`** e só ele: um asset `compendio` que não é o da mesa (o arquivo antigo, depois de trocar o compêndio) segue a regra comum (só o dono) e o jogador que o pede recebe `asset_inexistente`. A exportação leva a meta do compêndio da mesa (`hashesUsados`).

| Intenção | `dados` | Capacidade | Efeito |
|---|---|---|---|
| `compendio.definir` | `{ compendio: { hash, nomeOriginal, magias } \| null }` | `mesa.configurar` (**só do mestre**) | define o compêndio da mesa (o `hash` precisa ser de um asset `compendio` já registrado: `asset_inexistente`) ou, com `null`, tira. Repetir o mesmo valor não gera evento. Emite `compendio.alterado` |
| `chat.magia` | `{ magia: MagiaDoCompendio, como? }` | nenhuma | publica uma mensagem `tipo: "magia"` **pública** (`visivelPara: "todos"`) com a magia dentro. `como`: personagem que quem fala edita (o mestre: qualquer um; `personagem_inexistente`/`sem_permissao` como em `chat.enviar`). Magia fora dos limites: `mensagem_invalida`. Passa pelo **mesmo limite de 10 mensagens por segundo por conexão** (`muitas_mensagens`) |

**Evento novo**: `compendio.alterado { compendio | null }`, para **todos** (`Estado.compendio` também vai no snapshot de todos). **Persistência**: chave `compendio` da tabela `meta` do SQLite (a referência em JSON; **sem migração nova**: o banco do Lote 13 simplesmente não tem a chave = sem compêndio; valor ilegível também vira "sem compêndio"); `salvarTudo` (importar) a regrava e `apagarTudo` a apaga. **Mensagem `magia`**: filtrada como as outras (`mensagemVisivelPara`; hoje sempre `todos`); o histórico do chat guarda a magia inteira e o chat segue **fora da exportação**.

**Fluxo no navegador**: o mestre lê `compendio/magias.json` da pasta (ou do arquivo escolhido à mão), valida com `lerCompendio` e, se válido e diferente do que a mesa tem, guarda os bytes no cache, manda `asset.registrar` (só a meta) + `asset.tenho` + `compendio.definir`. Arquivo inválido: o erro aparece só ao mestre e **nada é enviado**. Os jogadores veem `Estado.compendio`, pedem o asset (`asset.pedir`) e leem o JSON do cache. "Recarregar" repete a leitura.

(V6, 2026-11-12: `chat.modelo` (ataque), `chat.enviar` (só vale num `/r`) e `chat.magia` aceitam `espaco?: { nivel (1 a 9), extra? (notação de dados, já multiplicada pelos níveis acima), metade? }`. A sala rola o `extra` (no crítico do ataque, os dados dobram) e a mensagem traz `espaco?: { nivel, extra?: { expressao, rolagem, total (dano principal + extra), metade? } }`. Sem capacidade nova; `extra` inválido: `dados_invalidos`; mensagem antiga sem o campo continua valendo.)

**Intenções novas**: `compendio.definir`, `chat.magia`. (V4a, 2026-11-11: `chat.caracteristica { caracteristica: { nome (1 a 80), descricao (até 12000), origem? (até 80) }, como }`: publica uma mensagem `tipo: "caracteristica"` pública com a característica da ficha; `como` é obrigatório e é um personagem que quem fala edita (o mestre: qualquer um); sem capacidade; passa pelo mesmo limite de 10 mensagens por segundo. A `ficha.alterar` passou a recusar `aparenciaHash` e `simboloHash` sem meta registrada, com `dados_invalidos`.) **Evento novo**: `compendio.alterado`. **Tipo de asset novo**: `compendio`. **Tipo de mensagem novo**: `magia`. Sem capacidade nem código de erro novos.

### Contador de uso

A sala conta as mensagens recebidas por dia UTC e as conexões. `requisicoes = mensagens / 20 + conexoes`;
`percentual` é sobre 100 mil por dia. Grava no SQLite a cada 50 mensagens (e a cada conexão) e envia
`uso` aos mestres no snapshot, a cada 50 mensagens ou, no máximo, a cada ~5 s (o resto fica para o
agendador).

## V4a2: dado de vida na sala

- `ficha.dadoDeVida { personagemId, dado: "d6" | "d8" | "d10" | "d12" }` (sem capacidade; quem edita a ficha ou o mestre): a sala confere que há dado daquele tipo disponível (senão `dados_invalidos`), rola `1dN + mod. de Con` (cura mínima 0), marca o dado como usado (`dadosDeVidaUsados`), soma a cura a `pvAtual` com teto em `pvMax` (o temporário não muda) e emite `chat.mensagem` (tipo `modelo`, resultado `modelo: "vida"` com `nome`, `rolagem`, `curou`, `pvAtual`, `pvMax`, como o personagem) e `personagem.alterado`. Sem migração.
- `ModeloDeObjeto` não mudou; o item da ficha é de luz se tem `modeloId` de um modelo existente ou se o nome é igual ao de um modelo (sem maiúsculas, acentos nem espaços nas pontas): `modeloDoItem`. `novasDoModelo`, `ajustarNovas` e `modelosAumentados` recebem a lista de modelos e valem para os dois casos (o jogador não repõe nenhum).
