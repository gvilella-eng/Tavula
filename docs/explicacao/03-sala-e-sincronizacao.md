# 03 — Sala e sincronização

A mesa do Távola é um servidor pequeno que guarda o estado do jogo, recebe os pedidos de cada pessoa, decide o que vale e
conta o resultado a todos, mostrando a cada um só o que ele pode ver. Este arquivo explica esse servidor: como um clique
no navegador vira uma mudança na mesa, o que cada pessoa recebe, como o servidor guarda tudo no disco e como o tempo da
sala corre (e pára).

## Onde fica

Servidor (`apps/server/src`):
- `index.ts`: o Worker. Recebe todo pedido HTTP e WebSocket, acha a mesa no diretório e repassa para a sala certa.
- `sala.ts`: o Durable Object `Sala`, uma instância por mesa. É o coração: WebSocket, snapshot, intenções, presença,
  alarme, diário do Desfazer, rotas de conta e de MCP.
- `armazenamento.ts`: `Armazenamento`, a camada sobre o SQLite do Durable Object, com as migrações (`MIGRACOES`).
- `agendador.ts`: `Agendador`, a agenda de vencimentos que alimenta o único `alarm()` do Durable Object.
- `inicializacao.ts`: `carregarOuSemear` e `criarMesaNova`, o que a sala faz ao acordar e ao nascer.
- `diretorio.ts` e `registroDeMesas.ts`: a lista de mesas (ver `04-contas-e-seguranca.md`).

Núcleo puro (`packages/shared/src`), que o servidor e o navegador usam igual:
- `protocolo.ts`: os schemas zod das mensagens (`IntencaoSchema`, `MensagemDaSalaSchema`, `ExportacaoSchema`),
  `lerIntencao`, `mensagem`, `capacidadeDaIntencao`.
- `nucleo.ts`: `processar` (intenção vira eventos), `reduzir` (evento vira estado), `visaoPara` e `eventoPara` (o filtro de
  quem vê o quê), `processarSistema`, `pausarSeSemMestre`, `criarExportacao`, `lerExportacao`.
- `capacidades.ts`: `pode`, as listas de capacidades delegáveis e exclusivas do mestre.
- `relogio.ts`: `tempoDaSala` e as funções do relógio.
- `desfazer.ts`: `diffDoEstado` e `desfazerPassos`.
- `claude.ts`: o que a conexão do Claude nunca faz e o limite de frequência dela.
- `membros.ts`: `derivarMembros` e o plano de aceite de uma conta.

No navegador: `apps/web/src/useSala.ts` abre o WebSocket, aplica snapshots e eventos e reconecta.

## Como funciona, ponta a ponta

```
navegador ──(1) intenção JSON──► Worker ──(2)──► Sala (Durable Object)
                                                   │ lerIntencao (zod)
                                                   │ tratarIntencao
                                                   │   processar(estado, usuario, intencao)  ← puro
                                                   │   salvarEventos  (SQLite)
                                                   │   estado = novo estado (memória)
                                                   │   distribuir:  para cada socket
                                                   │       snapshot (visaoPara)  ou  eventoPara
navegador ◄──(3) evento / snapshot filtrados───────┘
   reduzir(estado, evento)
```

Uma intenção é um pedido: "quero mover o token X para (3, 4)". O navegador nunca altera a mesa. Ele manda a intenção, a
sala confere se a pessoa pode, valida as regras, calcula os eventos (o que realmente aconteceu: "o token X foi movido") e
só então esses eventos mudam o estado. Quem manda o evento é a sala; o navegador aplica com a mesma função `reduzir` que a
sala usou, então os dois nunca divergem.

### 1. O Worker e as rotas (`index.ts`)

O Worker é um roteador fino. O que ele faz, em ordem:

1. `GET /saude` responde `ok`.
2. **Origem.** Em todo `POST` sob `/api/` e em todo upgrade de WebSocket, confere o cabeçalho `Origin` com
   `origemPermitida` (ver o arquivo 04). Falhou: 403 `origem_invalida`.
3. **Diretório de mesas** (`/api/mesas`): `POST` cria uma mesa; `GET /api/mesas` lista, mas só com a variável
   `LISTAR_MESAS=1` (dev e E2E); `GET /api/mesas/<id>` devolve nome e id ou 404 `mesa_inexistente`.
4. **Rotas de uma mesa** (`/api/m/<id>/<rota>`):
   - normaliza o id (`normalizarIdDeMesa`), pergunta ao diretório qual é o `doNome` dela e pega a sala com
     `env.SALA.idFromName(mesa.doNome)`;
   - **refaz os cabeçalhos internos** (`x-tavola-ip`, `x-tavola-local`, `x-tavola-seguro`, `x-tavola-mesa`): apaga o que o
     navegador mandou com esses nomes (e o antigo `x-tabletop-usuario`) e põe os verdadeiros. A sala confia neles justamente
     porque só o Worker os escreve;
   - `renomear` é tratado no próprio Worker: pergunta à sala o papel de quem pede (rota interna `/papel`), só aceita mestre,
     grava o nome no diretório e avisa a sala (`/api/renomeada`) para todos receberem o nome novo sem recarregar;
   - o resto passa por `caminhoInterno`, uma **lista fechada** de rotas (`ws`, `mcp`, `situacao`, `eu`, `conta/...`,
     `contas/<id>/aceitar`...). Rota que não está na lista dá 404 e nunca chega à sala. O WebSocket sem `Upgrade` responde 426;
     o MCP só aceita `POST` (405 nos demais).
5. `/teste/*` só existe com `MODO=teste` (e a sala confere de novo).

Não há login no Worker: ele não sabe quem é a pessoa. Quem descobre isso é a sala, pelo cookie (arquivo 04).

### 2. A sala acorda (`Sala`, construtor)

O Durable Object é uma "sala" com memória própria e um SQLite próprio, um por mesa. No construtor:

1. cria `Armazenamento`, `ContasDaMesa`, `Agendador`, `CaixaDeEntrada` e `Transferencias`;
2. dentro de `blockConcurrencyWhile` (ninguém entra até acabar) chama `carregarOuSemear`: aplica as migrações
   (`banco.migrar()`), carrega o estado do SQLite e, se não existe estado, só a mesa legada (o DO chamado `campanha`) é
   semeada com o exemplo `fixtures/campanha.seed.json`. Qualquer outra mesa devolve `null`: o DO "ainda não foi criado" e
   responde 404 até o diretório mandar `POST /criar`;
3. `iniciar`: põe o estado em memória (sem o chat, que mora só no banco), inicia o relógio, roda `rodarTempo` (o que venceu
   enquanto dormia), `pausarSeSemMestre` (processo reiniciado: a mesa não corre sozinha) e limpa as posses de arquivo órfãs.

O estado em memória é a fonte rápida; o SQLite é a verdade que sobrevive. Tudo que muda é gravado antes de ser contado.

### 3. A conexão (`abrirSocket`)

Dois jeitos de abrir o WebSocket:
- **navegador:** o cookie `tavola_sessao` (`identificar`: sessão, conta, vaga);
- **Claude:** o cabeçalho `Authorization: Bearer <token>`. Com ele só o token vale (o cookie é ignorado).

A sala usa a **Hibernation API** (`this.ctx.acceptWebSocket`, nunca `accept()`): o runtime pode tirar a sala da memória
enquanto os sockets ficam abertos e acordá-la quando chega uma mensagem. Por isso quem é o dono de cada socket não pode ficar
só em memória: vai em `serializeAttachment` (tipo `Identidade`: `usuarioId`, `conexaoId`, e, se for o caso, conta, sessão,
`claude`, `tokenId` e o estado da chamada). `identidadeDe` lê isso e guarda num `WeakMap` como cache (a leitura clona).

Ao abrir, a sala manda: o **snapshot** (o estado inteiro, já filtrado para aquela pessoa), o estado da chamada, o aviso do
preparo de cenas, para o mestre o progresso e o aviso de contas, os lotes do Desfazer e a **presença**.

### 4. Uma intenção chega (`webSocketMessage` → `tratarIntencao`)

`webSocketMessage` conta a mensagem no uso do dia, acha o usuário do socket, descarta frames binários que não sejam pedaço de
arquivo e valida o texto com `lerIntencao`. `lerIntencao` é um `JSON.parse` e um `IntencaoSchema.safeParse` (zod, uma união
discriminada por `tipo`): a forma e os limites de cada intenção (tamanho de texto, quantidade de pontos, ids de até 64
caracteres) estão no schema, e uma mensagem fora dele nem entra em `tratarIntencao`; volta um frame `erro`
`mensagem_invalida`.

`tratarIntencao` é o **único lugar** por onde passa uma intenção, venha do WebSocket do navegador, do WebSocket do Claude ou
da rota HTTP do MCP (`ws: null`). Os passos, na ordem:

1. **Limite do Claude.** Conexão do Claude gasta uma ficha do balde (`gastarFicha`: 20 por segundo, rajada de 40). Sem ficha:
   erro `muitas_mensagens`.
2. **Desvios que não passam pelo `processar`:** `chamada.*` (a chamada depende do socket; `tratarChamada`),
   `claude.desfazer` (`desfazerLote`) e `caixa.concluir` / `caixa.falhar` (a caixa de entrada dos arquivos do Claude).
3. **Limites de frequência** para o que enche a mesa: 10 mensagens de chat por segundo por conexão (por token, na rota HTTP);
   um botão liberado a cada 2 s por jogador; o rascunho de desenho que chega depressa demais é **descartado em silêncio**
   (o próximo cobre).
4. **`processar`.** Aqui está o cálculo (próxima seção).
5. Se recusou, devolve o erro (`recusa(codigo, mensagem)`); o remetente recebe um frame `erro` apontando o `id` do pedido.
6. Se aceitou, **grava** (`salvarEventos`, ou `salvarTudo` na importação), troca o estado em memória e, se foi o Claude,
   anota no diário do Desfazer.
7. Cuida do que não é estado: `reagendarLuzes` (o relógio), arquivos (`cuidarDeAsset`), preparo cifrado.
8. **Transitórios** (ping, rascunho de desenho, movimento ao vivo): são repassados e **não gravam**.
9. **`distribuir`:** manda a cada socket o que ele pode ver (seção "O que cada pessoa recebe").
10. Devolve ao chamador o evento do pedido "como esta pessoa o vê" (a rota HTTP do MCP responde com ele).

## Decisões e por quê

- **Intenção, evento e estado separados.** O servidor é a autoridade; o cliente só pede. Isso é o que permite filtrar por
  pessoa (o que o jogador não pode ver nunca viaja) e que o mesmo código rode no servidor e no navegador. Desde o início do
  projeto (`PROJETO.md`, protocolo).
- **O núcleo é puro.** `processar` e `reduzir` não gravam nem enviam nada: recebem o estado e devolvem outro. Por isso quase
  tudo é testado em Vitest sem subir servidor (`nucleo.test.ts` e dezenas de arquivos ao lado dele). A sala é a casca que
  faz o efeito colateral (SQLite, WebSocket, alarme).
- **`processar` recebe `agora` e o sorteio por parâmetro.** A sala passa `Date.now()` e `crypto`; os testes passam um
  relógio falso e uma fonte com semente. Rolagens e tempo são reprodutíveis.
- **Um Durable Object por mesa.** Estado em memória, SQLite próprio e uma thread só: não há corrida entre duas intenções da
  mesma mesa. Era o formato natural de uma mesa e roda local no `wrangler dev` (restrição "tudo local").
- **Só o servidor numera.** Cada evento tem um `seq` crescente dado pela sala. O cliente nunca inventa número.
- **Tudo que muda é gravado por evento**, não por foto: `salvarEventos` atualiza só as linhas que o evento tocou. A foto
  inteira (`salvarTudo`) só acontece na semente e na importação.

## Os trechos complexos

### 1. `processar` e `reduzir`: como uma intenção vira mudança

**O problema.** Uma intenção pode mudar várias coisas ao mesmo tempo (apagar um token tira a entrada dele do combate; acender
uma tocha dispara uma automação). E o navegador precisa chegar ao mesmo estado que o servidor sem receber o estado inteiro.

**Como o código resolve** (`packages/shared/src/nucleo.ts`):

`processar(estado, usuarioId, intencao, agora, aleatorio, apagadosRecentes, opcoes)` chama `processarIntencao` e, se algo
mudou, deixa as automações reagirem (`rodarAutomacoes`, que também emite eventos, com a mesma `origem`). Dentro de
`processarIntencao`:

1. acha o usuário (`usuario_inexistente` se não achar);
2. se a conexão é do Claude, consulta `recusaDoClaude(tipo)`: papéis, permissões, importar/exportar e o vaivém de arquivos
   são recusados **mesmo para um mestre** (a lista está em `claude.ts`, `PROIBIDAS_AO_CLAUDE`);
3. **capacidade:** `capacidadeDaIntencao[tipo]` diz o que a intenção exige. `null` significa "qualquer mestre ou jogador"
   (o vaivém de arquivos; o sigilo é do asset). Senão `pode(usuario, capacidade, estado.permissoes)`. Recusou:
   `sem_permissao`;
4. monta o `emitir`. Cada chamada:
   - carimba rascunho (`carimbarRascunho`: o que o Claude do mestre cria nasce como rascunho),
   - marca "pelo Claude" nas mensagens de chat dele,
   - dá o `seq` (`proximo.seq + 1`) e a `origem` (`{ usuarioId, idPedido }`),
   - guarda o evento e **já aplica** `reduzir` ao estado de trabalho (`proximo`). Assim as linhas seguintes da mesma intenção
     já enxergam o efeito das anteriores;
5. um `switch` grande por `tipo` valida as regras específicas (token existe? o trajeto está bloqueado por parede? o último
   mestre pode virar jogador?) e emite os eventos. Regra violada: `recusa(...)` com um `CodigoDeErro` e uma mensagem em
   português; nenhum evento sai, nada muda;
6. devolve `aplicado(snapshotPara)`: o estado novo, os eventos e **quem precisa de um snapshot completo** (`"todos"`, uma
   lista de ids, ou `[]` quando basta o evento).

`reduzir(estado, evento)` é um `switch` por tipo de evento que devolve o estado novo, preservando a referência do que não
mexeu (isso importa para o diff do Desfazer e para não redesenhar à toa). A primeira linha é a defesa de ordem:

```ts
if (evento.seq <= estado.seq) return estado;
```

Evento já refletido no estado é ignorado. Reaplicar o mesmo evento não faz mal.

**Validação em duas camadas.** O zod valida a **forma** (no `lerIntencao`, antes de tudo). As **regras do jogo** vivem no
`switch` do `processarIntencao`. Quem criar uma intenção nova precisa fazer as duas: o schema em `protocolo.ts`, a entrada em
`capacidadeDaIntencao` (o TypeScript exige, o tipo é `Record<TipoIntencao, ...>`) e o caso no `switch`.

**Capacidades e papéis** (`capacidades.ts`):
- Há dois papéis de usuário, `mestre` e `jogador`.
- O mestre pode tudo (`pode` devolve `true`).
- O jogador só tem o que a capacidade permite. Há as **delegáveis** (`CAPACIDADES_DELEGAVEIS`: mover o próprio token, abrir
  portas, acender tochas, enviar arquivos, pingar o mapa, criar as próprias fichas...) e as **exclusivas do mestre**
  (`CAPACIDADES_DO_MESTRE`: papéis, permissões, configurar a mesa, editar automações, ver a camada do mestre, editar cenas,
  combate, som, exportar e importar). Capacidade do mestre nunca é delegável: `pode` devolve `false` para o jogador.
- **Delegação** é o mestre ligar ou desligar uma capacidade para os jogadores (`permissao.alterar`): vale o padrão da mesa
  (`permissoes.jogadores`, com `PERMISSOES_PADRAO` quando falta) e a **exceção por usuário** (`permissoes.porUsuario`) tem
  prioridade. Tentar delegar uma capacidade do mestre dá `capacidade_nao_delegavel`.
- Algumas regras não cabem numa capacidade: o jogador "só vê a ficha dos outros" se a capacidade `ficha.verOutras` estiver
  ligada, e mudar isso manda snapshot novo a todos (`aplicado("todos")`), porque muda o que cada um recebe.

**O que é frágil.**
- O `emitir` aplica `reduzir` na hora. Se um caso do `switch` ler `estado` (o de antes) onde deveria ler `proximo` (o de
  trabalho), ele ignora o que a própria intenção acabou de emitir. Os casos que encadeiam (apagar token e limpar combate)
  usam `atual()`/`proximo`.
- Evento novo exige: schema, caso no `reduzir`, **caso no `eventoPara`** (senão o jogador não recebe; o `switch` é
  exaustivo e o TypeScript reclama), e caso em `salvarEventos` (senão o evento não é gravado e some ao reiniciar).
- `processar` deve continuar pura. Qualquer `Date.now()` ou sorteio dentro dela quebra os testes e o que é reprodutível.

**Teste que vigia.** `packages/shared/src/nucleo.test.ts`, `protocolo.test.ts` (os schemas e `capacidadeDaIntencao`),
`claude.test.ts` (a lista de proibidos).

### 2. Filtrar por pessoa: `visaoPara`, `eventoPara` e `distribuir`

**O problema.** Num RPG, parte da mesa é segredo: tokens ocultos, paredes secretas, notas do mestre, a ordem real do combate,
automações, zonas. Se o servidor mandasse o estado inteiro e o navegador "escondesse", qualquer jogador abriria as
ferramentas do navegador e leria o segredo. O segredo **não pode sair do servidor**.

**Como o código resolve.** Cada pessoa recebe duas coisas, e as duas são filtradas por pessoa.

**O snapshot** (`visaoPara(estado, usuario, agoraMs)`, em `nucleo.ts`). É o estado inteiro "como esta pessoa o vê". Para o
mestre devolve quase tudo (só tira o que é interno da sala: acendimentos pendentes, retratos do chat, a trilha antiga) e
refaz os objetos de luz e o relógio para a tela. Para o jogador, **desestrutura o estado jogando fora** o que ele não pode
ter e refaz o resto:

- **Nunca chega ao jogador:** os assets (metas de arquivo), as automações, os botões completos (ele recebe só o rótulo dos
  liberados), os efeitos de outros tokens, **as zonas**, a mesa de som, a biblioteca de música, a memória esquecida de outras
  cenas.
- **Só a cena ativa:** `cenas` vira uma lista de uma cena, sem a trilha nem os ambientes (`cenaParaJogador`); tokens,
  paredes, desenhos e luzes só dessa cena.
- **Tokens:** só os de camada `tokens` ou `mapa`, não ocultos, da cena ativa (`tokenVisivelPara`). Token de rascunho do
  Claude nunca. A vida própria do token de NPC (`pv`) só vai a quem veria a vida da ficha (`tokenParaUsuario`).
- **Paredes:** a parede secreta é **disfarçada** (`paredeParaJogador`): vira uma parede comum, ou uma porta aberta se já foi
  aberta, e perde o `estado`. O jogador não distingue uma parede secreta de uma parede de verdade. Numa cena-cartão
  (`cenaEhCartao`) as paredes guardadas nem chegam.
- **Personagens, pastas e handouts:** só os que ele edita ou que estão em pasta que ele vê; a ficha completa só a quem edita
  ou tem `ficha.verOutras` (`personagemParaUsuario`).
- **Combate:** a ordem de turno só com as entradas que ele vê; a Destreza e o valor oculto nunca viajam
  (`combateParaUsuario`).
- **Chat:** só o que ele pode ler (sussurro e rolagem oculta de outros nunca entram).
- **Relógio:** `relogioParaVisao` entrega ao jogador só se a mesa está pausada, com o tempo zerado; o tempo da sala e o marco
  são do mestre. O tempo restante de cada objeto de luz segue a opção `tempoParaJogadores` (`objetoParaVisao`).
- **Permissões:** `jogadores` (o padrão) e só as exceções **dele**.

**A névoa** merece uma frase à parte: a névoa pintada à mão (`cena.nevoa`, em `nevoa.ts`) **não é segredo** por decisão. O
jogador recebe a lista de traços da cena em que o grupo está; o que está sob a névoa só não aparece na tela dele. O que é
segredo é o que **a luz e as paredes revelam**: isso é calculado no navegador com as paredes que ele recebe (já disfarçadas)
e a visão dos tokens dele. A névoa automática (o que a luz alcança) não viaja pela rede; só o traço do mestre viaja.

**Os eventos** (`eventoPara(evento, usuario, antes, depois, agoraMs)`). Depois do snapshot inicial, a sala manda eventos.
Cada evento passa pelo filtro **de cada socket**, e o resultado é `null` (essa pessoa não recebe), o próprio evento, ou um
evento **reescrito**. Os casos delicados:

- **Passou a ser visível:** o token que estava oculto e foi revelado chega inteiro (`token.editado`) e o cliente faz upsert.
- **Deixou de ser visível:** o token que sumiu da visão dele (foi ocultado, ou mudou de cena) vira `token.sumiu { id }`,
  **sem dizer o motivo**. O jogador sabe que sumiu, não sabe se foi ocultado ou apagado. O mesmo vale para luz
  (`fonte.apagada`), ponto, pasta, handout e personagem.
- **Continua invisível:** nada. Quem nunca viu o item não recebe nem o aviso de que ele mudou.
- **Mudança que ele não percebe:** a sala compara a visão **antes** e **depois** (`JSON.stringify` do que ele veria). Se são
  iguais, não manda nada. Exemplo: o mestre tranca uma porta secreta; para o jogador ela era e continua sendo uma parede.
- **Falha fechada:** vários casos pedem `antes` e `depois`. Se faltarem, o jogador não recebe nada em vez de receber demais.
- **O mestre** recebe quase tudo; os eventos de cena (`cena.criada`, `cena.apagada`, `grupo.movido`) são só dele.
- **Automações e zonas:** `automacoes.alterado` vira, para o jogador, só `botoes.alterados` (a lista de rótulos) e só quando
  essa lista mudou; `zona.alterada` e `zona.apagada` são `null` para o jogador.

**`distribuir(eventos, snapshotPara, antes)`** junta as duas coisas. Percorre os sockets: se o `usuarioId` do socket está em
`snapshotPara` (ou é `"todos"`), manda um snapshot novo; senão, manda os eventos, cada um passando por `eventoPara`.
`snapshotPara` existe porque algumas mudanças alteram tanta coisa que reenviar o estado é mais seguro e barato do que reescrever
evento por evento: trocar de cena, mudar o papel, mudar quem vê uma pasta, importar uma campanha. Detalhes de desempenho:

- **`RodadaDeSnapshots`:** um laço que manda snapshot a todos serializa **uma vez por usuário** (duas abas do mesmo usuário
  veem o mesmo), lê a primeira página do chat uma vez e a lista de membros uma vez. O cache só vale durante a rodada
  (nada é gravado no meio, por isso é seguro) e nunca sobrevive a ela.
- **`textoDoEvento`:** `eventoPara` devolve a mesma referência para vários sockets; o evento visto é serializado uma vez.
- **Sons de zona** (`atualizarSonsDasZonas`): o jogador não recebe a zona, mas precisa ouvir o som dela quando o token dele
  entra. A sala calcula isso do lado dela (`sonsDasZonasParaJogador`) e manda só a lista de sons (`som.zona`), apenas quando
  a lista dele muda. Nunca a zona, o nome nem a regra.

**O que é frágil.** É o ponto mais perigoso do projeto, porque o erro é silencioso: a mesa continua funcionando e um segredo
vaza.
- Campo novo no estado **chega ao jogador por padrão**, porque `visaoPara` parte do estado e tira o que lista. Quem cria uma
  fatia nova (as automações, as zonas e o som já passaram por isso) tem de decidir, na hora, se ela cai no filtro e
  acrescentar o caso no teste de sigilo. O `PASSAGEM.md` repete isso em cada lote ("a zona **nunca** sai em `visaoPara`").
- O `eventoPara` é exaustivo no tipo do evento: evento novo sem caso não compila. Isso é de propósito.
- A regra "vale a visão antes e depois" depende de `antes` e `depois` serem os estados certos. O `distribuir` recebe `antes`
  (guardado antes da troca em `tratarIntencao`).
- O nome de um arquivo de som pode contar o que ele faz (uma zona secreta chamada "armadilha"); por isso a sala entrega o
  `asset.meta` com `nomeOriginal: "som"` ao jogador.

**Teste que vigia.** `nucleo.test.ts` (`visaoPara` e `eventoPara`), `automacoes.test.ts` ("o sigilo: nada de automação chega
ao jogador"), `zonas.test.ts` ("o sigilo: nada da zona chega ao jogador"), `paredes.test.ts`, `nevoa.test.ts`,
`handouts.test.ts`, `personagens.test.ts` e os E2E de cada área.

### 3. A ordem das mensagens

**O problema.** Vários navegadores, cada um com sua conexão, mandam intenções ao mesmo tempo; a sala responde com eventos,
snapshots e coisas efêmeras (movimento, ping). O cliente precisa terminar com o mesmo estado do servidor sem perder nem aplicar
duas vezes.

**Como o código resolve.**

1. **A sala é sequencial.** Um Durable Object processa uma mensagem de cada vez (uma thread, sem concorrência entre intenções
   da mesma mesa). `processar` é síncrona e `distribuir` também: do cálculo ao envio não há ponto em que outra intenção
   possa entrar no meio do mesmo cálculo. (Há um `await` de armazenamento, `reagendarLuzes`, entre trocar o estado e
   distribuir; o runtime do Cloudflare não entrega outra mensagem enquanto uma operação de armazenamento está pendente. Esta
   leitura é do comportamento do Durable Object, não de algo escrito no código do projeto.)
2. **Gravar antes de contar.** `salvarEventos` roda antes de `distribuir`. Se a sala cair no meio, o que alguém viu já está
   no disco.
3. **`seq` é o relógio lógico.** `estado.seq` sobe a cada evento (`reduzir` o atualiza). O snapshot leva o `seq` do estado.
   Ao receber um evento, o cliente passa por `reduzir`, que **ignora** `seq <= estado.seq`. Dois casos de ordem se resolvem
   assim:
   - um evento atrasado que o snapshot (mais novo) já contém é descartado;
   - um snapshot sempre substitui o estado: o cliente zera a fila de movimentos pendentes e troca tudo (`setEstado`).
4. **O `seq` do jogador tem buracos, e está certo.** A sala numera **todos** os eventos, mas o jogador só recebe uma parte
   (o resto é `null` em `eventoPara`). Logo o `seq` que ele vê pula números. O cliente **nunca** confere continuidade ("faltou
   o 12?"): só descarta o que não é mais novo. Se conferisse, um segredo apareceria como "buraco" na numeração.
5. **O que é efêmero não tem `seq` nem é gravado:** movimento ao vivo (`token.movendo`), rascunho de desenho, ping, chamada,
   sons de zona. São repassados a quem pode ver e esquecidos. Quando a conexão cai, a sala manda o "fim" de cada rascunho
   (`encerrarRascunhos`) e de cada arraste (`desfazerArrastes`) para ninguém ficar com um traço fantasma.
6. **O cliente agrupa `token.movido`.** Quem segura a seta do teclado gera dezenas de eventos por segundo. Eles vão para uma
   fila que só vira estado do React a cada intervalo (`INTERVALO_DO_ESTADO_DOS_PASSOS_MS`), enquanto o mapa (PixiJS) anima na
   hora. Qualquer outro evento **descarrega a fila antes**, preservando a ordem. É uma otimização de renderização que não
   altera a semântica.
7. **Reconectar é pedir tudo de novo.** O cliente (`useSala.ts`) reconecta com backoff exponencial e jitter
   (`atrasoDaTentativa`: 0,5 s, 1 s, 2 s... até 10 s). Ao reabrir, a sala manda o snapshot completo: o cliente não tenta
   "recuperar o que perdeu". Se a conexão caiu porque a sessão acabou, o cliente pergunta `eu`, recebe 401 e volta à tela de
   entrada (`aoPerderSessao`).

**O que é frágil.**
- Quem acrescentar um evento que o jogador não pode ver **não deve** "compensar" a falta de seq mandando outra coisa: o
  buraco é a forma correta.
- `reduzir` precisa continuar tolerante a repetição. Se um caso novo não for idempotente (acumula em vez de substituir), o
  evento duplicado vira dano duplo.
- O limite de 20 por segundo no movimento (`criarLimitador`, 50 ms) é o orçamento do plano grátis de Workers; ver
  `limitador.ts`.

**Teste que vigia.** `nucleo.test.ts` ("ignora eventos com seq antigo") e o E2E `sala.spec.ts` (WebSocket real, reconexão e
`/teste/reiniciar-sala`).

### 4. O diário do Desfazer

**O problema.** O Claude pode fazer dezenas de mudanças numa só chamada ("monte esta masmorra"). O mestre precisa de um botão
"desfazer o que o Claude fez", e esse botão **não pode** desfazer o que outra pessoa fez depois por cima.

**O que existe, e o que não existe.** O Desfazer do servidor cobre **só o que a conexão do Claude fez**; não há um Ctrl+Z geral
da mesa. Pequenos desfazeres existem por conta própria em partes isoladas (`token.restaurar` guarda os tokens apagados há
pouco na memória da sala e vale por um prazo; a névoa tem `nevoa.desfeita` traço a traço; o desenho tem `desenho.voltar`).

**Como o código resolve** (`desfazer.ts` e `sala.ts`):

1. **Anotar.** Depois de cada intenção aceita da conexão do Claude, `anotarNoDiario` chama `diffDoEstado(antes, depois)`. O
   diff compara coleção por coleção (`COLECOES_DESFAZIVEIS`: cenas, pastas, modelos, personagens, handouts, tokens, desenhos,
   pontos, luzes, paredes, zonas, fluxos de automação) e gera uma lista de `Delta { c, id, antes, depois }`: `antes` nulo
   é "foi criado"; `depois` nulo é "foi apagado". Como `reduzir` preserva a referência do que não tocou, o diff só serializa
   o que mudou de fato (`velho !== item`).
2. **Agrupar em lote.** A intenção traz `loteId` e `lote` (a descrição) opcionais, que **só a conexão do Claude usa**. O MCP
   manda um `loteId` por chamada de ferramenta. Vários passos com o mesmo `loteId` se acumulam no mesmo lote (tabela
   `claude_lotes`, coluna `passos` em JSON). Sem `loteId`, cada pedido é um lote.
3. **Limites.** Os últimos 50 lotes por usuário (`MAXIMO_DE_LOTES_POR_USUARIO`); um lote que passa de 1,5 milhão de caracteres
   de passos continua listado, mas marcado como não desfazível e com os passos descartados.
4. **Listar.** A sala manda `claude.lotes` só às conexões do **dono** (`enviarLotes`).
5. **Desfazer.** `claude.desfazer { loteId }` chama `desfazerLote`, que lê os passos (`passosDoLote`; nulo se não existe, já foi
   desfeito ou é grande demais) e chama `desfazerPassos(estado, passos, origem)`:
   - percorre os passos **do último para o primeiro**;
   - em cada passo, **primeiro apaga o que foi criado** (dos filhos para os pais: um token antes da cena dele) e **depois
     devolve o que foi editado ou apagado** (dos pais para os filhos);
   - cada item só é revertido **se ainda está como o Claude o deixou** (`igual(agora, d.depois)`, comparando JSON com chaves
     ordenadas e ignorando a marca de rascunho). Se outra pessoa mexeu depois, o item é **pulado** e o aviso diz qual
     (`pulados`);
   - regras para não destruir trabalho alheio: a cena só é apagada se está vazia e não é a do grupo; a pasta só se não tem
     coisa de outra pessoa dentro;
   - emite os eventos pelos mesmos `reduzir`/`seq`, então o resultado é um conjunto de eventos comuns, gravados e
     distribuídos como qualquer mudança (com snapshot para todos, porque o que voltou ou saiu muda a visão de cada um).
6. Marca o lote como desfeito (`marcarLoteDesfeito`), então desfazer duas vezes dá "este lote não existe mais".

**O que é frágil.**
- Quem cria uma coleção nova que o Claude possa alterar precisa entrar em **três** lugares de `desfazer.ts`:
  `COLECOES_DESFAZIVEIS`, `itensDe` e os dois `switch` (`apagar` e `guardar`). Esquecer um deles faz o Desfazer ignorar a coleção
  sem erro nenhum.
- Relógio, permissões, configuração, chat, combate, som e arquivos **não** são desfeitos (documentado em `desfazer.ts`).
- O diário nunca derruba a mesa: a leitura e a gravação têm `try/catch` e, se falham, a sala registra e segue sem os lotes.

**Teste que vigia.** `packages/shared/src/claude.test.ts` (desfazer um lote na ordem inversa, pular o que mudou depois,
publicar rascunho não conta como mudança), `claude-12-1.spec.ts` (E2E).

### 5. O relógio que pára: `RelogioSala`, `tempoDaSala` e o `Agendador`

**O problema.** A mesa tem um "tempo da sala": o tempo que as tochas queimam, que os efeitos duram, que as automações usam.
Ele **não** é o relógio de parede: se o mestre pausa a mesa, ou se ninguém está jogando, a tocha não pode continuar queimando.
Ao mesmo tempo, coisas precisam acontecer sozinhas (a tocha acaba, a luz fica "fraca") sem ninguém clicar.

**O relógio** (`relogio.ts`). O estado guarda `relogio: { pausada, acumuladoMs, desdeReal?, marcoMs? }`.
`tempoDaSala(relogio, agoraMs)` é:
- pausada (ou sem `desdeReal`): `acumuladoMs`, congelado;
- rodando: `acumuladoMs + (agoraMs - desdeReal)`.

Pausar (`pausarRelogio`) grava o tempo atual em `acumuladoMs`. Retomar (`retomarRelogio`) mantém o acumulado e anota
`desdeReal = agora`. Ninguém "incrementa" o relógio: ele é **calculado** a partir de dois números, então não há contador que
possa atrasar, e nada precisa rodar enquanto a mesa está pausada. O `marcoMs` é só o "zerar" da pílula do mestre
(`tempoDaPilula`); o tempo das tochas continua o mesmo.

**A agenda** (`agendador.ts`). Um Durable Object só pode ter **um** alarme. O `Agendador` guarda os vencimentos numa tabela
`agenda (tipo, chave, quando, dados)`, com `UNIQUE (tipo, chave)`: agendar de novo o mesmo par o **substitui**. O alarme do
runtime aponta sempre para o menor `quando` (`reprogramar`). Há duas formas de inserir: `agendar` (insere e reprograma) e
`anotar` (só insere; quem anota vários chama `reprogramar()` uma vez no fim). `tomarVencidos(agora)` remove e devolve o que
venceu. Os tipos em uso, vistos em `alarm()`: `presenca.expirar`, `claude.http`, `uso.enviar`, `mestre.ausente`, `luz.marco` e
`automacao.marco`.

**Como as duas coisas se juntam** (`sala.ts`):

- `reagendarLuzes()` cancela todos os `luz.marco`; **se a mesa está pausada, para aí** (nada é agendado). Se está rodando,
  pergunta a cada objeto de luz `proximoMarcoDoObjeto(l, salaMs, estagios)`: em quantos ms do tempo da sala ele vira "fraca",
  "morrendo", acaba ou vence um modificador. Agenda um vencimento por objeto em tempo real (`agora + ms + 5`; os 5 ms evitam
  disparar um instante antes do marco). Faz o mesmo com um único `automacao.marco` para a próxima fase de ciclo ou efeito.
- `alarm()` pega os vencidos, trata presença e uso e, se algum era marco de luz ou de automação, chama `rodarTempo`.
- `rodarTempo` roda `processarSistema` (em `nucleo.ts`): uma "intenção" **interna**, com `origem` `sistema`, que nenhum cliente
  alcança porque não existe no `IntencaoSchema`. Ela roda as automações, tira modificadores vencidos, apaga a tocha que acabou
  e reenvia os objetos cujo marco venceu (para o navegador atualizar o estágio). **Mesa pausada: não faz nada.**
- Quando alguém pausa ou retoma (intenções `mesa.pausar` e `mesa.retomar`), o evento tem `snapshotPara: "todos"`, e como todo
  evento que muda coisa, cai em `reagendarLuzes`: pausar cancela os vencimentos, retomar reagenda a partir do que sobrou.
  Nenhuma conta de "quanto faltava" precisa ser guardada, porque `restanteDoObjeto` já vive no tempo da sala.

**A pausa automática sem mestre.** Se o último mestre sai, a mesa não deve queimar tocha sozinha. `aoSair` (o fechamento do
socket) agenda `mestre.ausente` para **5 segundos depois** (`ESPERA_DA_PAUSA_MS`), com o instante da saída (`saiuEm`). O atraso
é porque recarregar a página fecha uma conexão um instante antes de abrir a outra (o React em desenvolvimento abre duas). Se o
mestre reconecta, `abrirSocket` cancela o vencimento. Se não, o alarme chama `pausarSeSemMestre(saiuEm)`: a pausa vale **no
tempo da sala da hora da saída**, não da hora em que o alarme disparou, então os 5 s de espera não são cobrados da tocha.
Quem conta "há algum mestre?" são os **sockets que sobraram** (`mestresConectados`), não um contador em memória: a sala pode
ter hibernado e o contador teria sumido. Conexão do Claude não conta como mestre. Ao acordar (`iniciar`), a sala também chama
`pausarSeSemMestre` agora. **Retomar continua sendo só do mestre.**

**Exportar e importar o relógio.** A exportação sempre grava o relógio **pausado** no tempo em que foi exportada. A importação
(`campanha.importar`) inicia o relógio de uma campanha que não estava pausada com `desdeReal = agora`: o tempo passado entre a
exportação e a importação não conta.

**O que é frágil.**
- Qualquer coisa nova que dependa de tempo precisa ser calculada com `tempoDaSala`, nunca com `Date.now()`. Se usar o relógio
  de parede, vai correr com a mesa pausada.
- O alarme é um só: um vencimento novo precisa de um `tipo` próprio e de um ramo em `alarm()`. Esquecer o ramo faz o
  vencimento sumir sem efeito (o `tomarVencidos` o removeu).
- `reagendarLuzes` é chamada depois de **todo** evento que muda algo (`r.eventos.length > 0`). Mexer em objeto de luz por fora
  desse caminho deixa o vencimento velho agendado.
- O alarme "pode disparar à toa uma vez" depois de um `cancelar`; o código aceita isso de propósito (`alarm()` ignora o que
  não está mais na agenda).
- No `alarm()`, `tomarVencidos` apaga os vencimentos **antes** de tratá-los. Se o tratamento falhar, aquele vencimento se
  perde (a próxima intenção que reagendar recompõe luzes e automações; os outros tipos não se recompõem sozinhos).

**Teste que vigia.** `tochas.test.ts` e `zerarRelogio.test.ts` (o relógio e o marco), `pausaAutomatica.spec.ts` e
`tochas.spec.ts` (E2E; usam o gancho `/teste/avancar-relogio` para envelhecer tochas sem esperar minutos).

## O armazenamento

### O formato

O SQLite do Durable Object (`ctx.storage.sql`) guarda, em `Armazenamento`:

- **`entidades (colecao, id, dados)`**: quase tudo que é coleção: usuários, cenas, tokens, paredes, luzes, modelos, pontos,
  zonas, pastas, personagens, handouts e assets. `dados` é o JSON do item. `gravarEntidade` faz `UPDATE` primeiro e só insere
  se não achou, para **manter o `rowid`**, que é a ordem dos usuários.
- **`meta (chave, valor)`**: o resto, uma chave por assunto (`permissoes`, `config`, `relogio`, `seq`, `cena_ativa`,
  `automacoes`, `efeitos`, `uso`, `versao_esquema`...).
- **Tabelas próprias**, fora de `entidades` de propósito: `chat`, `combate`, `desenhos`, `posse`, `preparos`, `agenda`, e as de
  contas e do Claude (`contas`, `sessoes`, `limites_ip`, `desafios`, `tokens_claude`, `claude_lotes`, `claude_envios`,
  `claude_envios_pedacos`). O motivo: a **importação** apaga `entidades` e a **exportação** lê `entidades`. Tudo que é
  sessão (chat), segredo (contas, tokens, chaves) ou efêmero (posse) fica fora e portanto **nunca vaza para um arquivo de
  campanha** nem é apagado por importar.
- O **chat não vive no estado em memória**: só no banco, em páginas (`chatAntes`). `visaoDe` lê a primeira página uma vez por
  rodada de snapshots.

`salvarEventos(estado, eventos)` é um `switch` por tipo de evento que grava só o que ele tocou (e o `seq`). `salvarTudo(estado)`
apaga `entidades` e regrava tudo, só na semente e na importação. `carregar()` remonta o `Estado`; `carregarMapa`,
`carregarCombate` e os demais leem de cada fonte, e uma linha corrompida de desenho ou de zona é descartada em vez de derrubar a mesa.

### As migrações

`MIGRACOES` é um array de funções. `migrar()` lê `meta.versao_esquema`, executa as que faltam **a partir da posição igual à
versão** e grava a nova versão depois de cada uma:

```ts
for (let v = atual; v < MIGRACOES.length; v++) {
  MIGRACOES[v]?.(this.sql);
  this.gravarMeta("versao_esquema", String(v + 1));
}
```

**Por que nunca se edita uma migração que já rodou.** A versão é a **posição** no array. Um banco que já passou pela migração
7 nunca mais a executa; se você mudar o corpo da 7, esse banco não recebe a mudança (ele "já está na 7") e um banco novo recebe
a versão alterada: os dois ficam com esquemas diferentes sob o mesmo número. Pior, **inserir uma migração no meio** desloca as
seguintes: o banco que estava na versão 9 passaria a achar que a antiga 9 é a nova 8. Por isso a regra é só **acrescentar no
fim**, sempre. O `Armazenamento` diz isso no topo do array, e o `wrangler.jsonc` aplica o mesmo princípio às migrações de
classe de Durable Object (`v1` Sala, `v2` Diretório: nunca editar a `v1`).

O projeto já pagou esse preço uma vez: a migração 14 (o diário do Claude) rodou em bancos reais **sem a coluna `itens`**
numa versão anterior do código. A correção não foi editar a 14, foi a **15**, que confere as colunas das duas tabelas
(`garantir`, com `PRAGMA table_info`) e acrescenta as que faltam. O comentário avisa: "Nunca edite as migrações 13 e 14:
acrescente outra".

**Aditivas e idempotentes.** As migrações recentes usam `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` e só criam
coluna quando `PRAGMA table_info` mostra que falta (o SQLite não tem `ADD COLUMN IF NOT EXISTS`). Assim, rodar de novo por
engano, ou rodar sobre um banco já parcialmente migrado, não quebra. As migrações antigas que **transformam dados** (a 4:
personagens ganham pastas e "quem edita"; a 9: as notas viram handouts) são o caso raro e delicado: fazem a transformação
**uma vez** e dependem de nunca serem reexecutadas.

**Por que isso importa no dia a dia.** No `pnpm dev` o código recarrega quente sobre o **banco real** do Vilella. Um código
pela metade, ou uma migração editada, roda em cima da campanha dele. A regra do projeto é migração **nova sempre**.

**Teste que vigia.** `apps/server/src/armazenamento.test.ts` (carrega bancos de cada época, importar troca o que deve, apagar
tudo) e `mesas.test.ts` ("a campanha de hoje (estado antigo, DO 'campanha') carrega sem mudar um byte").

## Exportar e importar a mesa

A exportação (`campanha.exportar`, só do mestre) e a importação (`campanha.importar`) são intenções como as outras, mas com
regras próprias.

**Exportar** (`criarExportacao`): tira do estado o que é **da sessão, não da campanha** (`memoriaEsquecida`, `acendimentos`
pendentes, `somLigado`, `musicaTocando`, o chat e os retratos do chat), grava o relógio **pausado** no tempo atual e inclui só
os assets que alguém ainda usa (`hashesUsados`). **As contas nunca saem**: elas não estão em `entidades`. O arquivo volta só
ao mestre que pediu, num frame `exportacao` (`snapshotPara` vazio, nada é difundido). O navegador baixa o JSON
(`baixarExportacao`).

**O formato é versionado** (`VERSAO_EXPORTACAO = 13`). `ExportacaoSchema` aceita de v1 a v13 e, em um `.transform`, **converte
tudo para v13**: arquivo antigo ganha os campos que não tinha (pastas padrão, configuração, modelos, relógio...), as luzes da
v7 viram objetos, as notas viram handouts, a mochila vira itens da ficha. A importação sempre trabalha com o formato mais novo,
e mudar o formato é acrescentar uma versão, nunca mexer nas antigas (o mesmo princípio das migrações).

**Importar** (`lerExportacao` e o caso `campanha.importar`):
1. `lerExportacao` valida o arquivo além do schema: ids únicos, pelo menos um mestre, cena ativa que existe, e **toda referência
   cruzada** (token em cena que existe, handout em pasta que existe, entrada de combate de token que existe, asset com meta,
   zona em cena que existe...). Falha: `importacao_invalida` com o motivo.
2. Quem importa precisa **continuar mestre** na campanha importada.
3. O `seq` **nunca volta**: `Math.max(estado.seq, importado.seq)`. Números já enviados a clientes não podem ser reaproveitados.
4. O relógio, se não estava pausado, recomeça agora.
5. A sala grava tudo com `salvarTudo`, manda snapshot a todos, descarta os preparos cifrados e **não** roda as automações
   depois (`processar` exclui `campanha.importar`).
6. **As contas ficam.** `desligarVagasQueSumiram` solta a conta ligada a uma vaga que a campanha importada não tem: ela fica sem
   vaga (o mestre a liga de novo) e perde as sessões.

**Frágil.** Campo novo no estado precisa entrar no `ExportacaoSchema` (e uma versão nova) ou some na exportação; se for da sessão,
precisa ser retirado em `criarExportacao`. Testes: `nucleo.test.ts`, `campanhasProntas.test.ts` (as campanhas de exemplo são
importadas de verdade) e `armazenamento.test.ts` ("importar troca...").

## Presença e reconexão

- **Presença** (`presenca`): cada usuário está `online` (tem socket aberto, sem contar o do Claude), `reconectando` (fechou o
  último socket há menos de 10 s: há um vencimento `presenca.expirar` na agenda) ou `offline`. `difundirPresenca` manda o mapa
  a todos sempre que alguém entra ou sai. O estado "reconectando" existe para a mesa não piscar "fulano saiu" a cada recarga.
- **"Claude conectado"** é uma marca à parte (`claude` no frame de presença): vale para quem tem um WebSocket do Claude aberto
  ou chamou o MCP por HTTP nos últimos 2 minutos (vencimento `claude.http`: como não há conexão aberta para mostrar, a agenda
  apaga a marca).
- **Quem é membro:** o mestre, quem tem conta ativa e, só com `MODO=teste`, quem entrou pelo login solto (`derivarMembros`).
  A vaga em que ninguém entrou fica escondida das listas. `visaoDe` põe a lista em `estado.membros` (campo derivado, nunca gravado
  nem exportado).
- **Reconexão do cliente:** descrita acima (backoff com jitter, snapshot completo ao reabrir).
- **Fechar à força:** quando uma conta cai (sair, recusada, removida, senha trocada ou redefinida, token revogado), a sala
  fecha os sockets dela com código `4001` (`fecharSockets`). O cliente reage perguntando `eu`.
- **Hibernação e reinício:** nada que precise sobreviver pode ficar só em memória. A identidade vai no attachment; a chamada
  também; arraste, ping, rascunho, baldes de frequência e transferências de arquivo são só memória **de propósito** (se a sala
  hibernar, quem esperava pede de novo, e a sala não hiberna enquanto há tráfego). O `/teste/reiniciar-sala` (`ctx.abort`)
  simula um reinício de processo: o estado volta do SQLite.

## Para ir além

- `../PASSAGEM.md`: "C1", "C2", "C3", "12-1", "12-3", "7b-1", "7b-2" (o que é frágil em cada lote).
- `../protocolo.md`: a tabela das rotas HTTP e as mensagens do WebSocket.
- `../../PROJETO.md`: seção 4.2 (protocolo), 4.5 (limites do plano grátis), 4.14 (mesas e contas).
- `04-contas-e-seguranca.md`: quem é cada pessoa, cookies, limites e tokens.
- `07-arquivos-e-assets.md`: `Transferencias`, posse e pedaços.
- `10-mcp.md`: a rota HTTP do MCP e o diário do Claude do ponto de vista da ferramenta.
