# 04 — Contas e segurança

O Távola roda inteiro no computador do Vilella, mas foi feito **como se um dia os jogadores entrassem pela internet**: nada de
atalho inseguro "porque é local" (decisão do Vilella, `PROJETO.md` 4.14). Este arquivo explica quem é cada pessoa na mesa, como
ela prova isso, o que o servidor guarda (e o que nunca guarda), como se recupera o acesso, como o Claude entra, e o que já está
pronto e o que ainda faltaria no dia em que o servidor for para a internet.

## Onde fica

Servidor (`apps/server/src`):
- `contas.ts`: `ContasDaMesa`, as contas, sessões, limites por IP, recuperação e os tokens do Claude de **uma mesa**, no SQLite
  da própria sala.
- `autenticacao.ts`: os cookies (`cookieDeSessao`, `cookiesDeSaida`, `lerCookie`).
- `origem.ts`: `origemPermitida`, a conferência do cabeçalho `Origin`.
- `index.ts`: o Worker (lista fechada de rotas, cabeçalhos internos, limite de criação de mesas).
- `diretorio.ts` e `registroDeMesas.ts`: o diretório de mesas.
- `transferencias.ts`: a coordenação do envio de arquivos entre navegadores.
- `sala.ts`: `identificar`, `rotaDeConta`, `acaoDoMestre`, `rotaDoToken`, `rotaMcp`, `abrirSocket`, `fecharSockets`.

Núcleo puro (`packages/shared/src`):
- `contas.ts`: derivação da senha (`derivarSenha`), validação de login e senha, constantes de limites, schemas dos corpos,
  `registrarFalhaDaConta`, `bloqueioDoIp`.
- `recuperacao.ts`: o código de recuperação, a chave da pasta (ECDSA P-256) e a assinatura.
- `claude.ts`: o token do Claude, a lista do que ele nunca faz e o balde de frequência.
- `mesas.ts`: o id da mesa e as constantes da mesa legada.
- `seguranca.ts`: a segurança dos arquivos que vêm de outra pessoa (resumo no fim; detalhe no `07`).

## Como funciona

### A conta pertence à mesa, não à pessoa

Cada mesa é um Durable Object com o **seu próprio** SQLite, e as contas moram lá (`ContasDaMesa`). Uma pessoa que joga em duas
mesas tem duas contas, uma em cada, com login e senha independentes. Não existe conta global. A **conta** é a credencial
(login, senha, status); a **vaga** é o usuário dentro da mesa (`Usuario` do estado, com nome, cor e papel). A conta fica ligada
a uma vaga (`usuario_id`); fichas, tokens e permissões pertencem à vaga, por isso trocar de conta não perde nada.

O status da conta é `pendente` (pediu para entrar), `ativa` ou `recusada`. O papel de conta é `mestre` ou `jogador`.

### A senha nunca chega ao servidor

O navegador calcula uma **derivada** (`derivarSenha`): PBKDF2-SHA256, 600.000 iterações, 32 bytes em base64url, com o sal
`tavola:<id da mesa>:<login normalizado>`. É só a derivada que vai no corpo da requisição (43 caracteres). O servidor guarda
`SHA-256(sal || derivada)`, com um sal aleatório de 16 bytes por conta, e compara em tempo constante. Consequências:

- **Quem lê o banco não tem a senha** e não consegue testar palpites baratos: teria de refazer o PBKDF2 por palpite.
- **O motivo de o estiramento rodar no navegador** é o limite de CPU do plano grátis de Workers (10 ms por requisição): o
  servidor da internet não aguentaria 600.000 iterações a cada login. Veio do Vilella ao decidir o marco C2 (`PROJETO.md`).
- O sal leva o **id da mesa**, e por isso o navegador é quem sorteia o id ao criar a mesa (ele precisa conhecê-lo antes de
  derivar a senha do mestre).
- O sal leva o **login**, então a mesma senha em mesas ou logins diferentes dá derivadas diferentes.

### Criar uma mesa

```
navegador: sorteia id (ex.: k7m2-qx9p-4tdn), deriva a senha, gera o par ECDSA da pasta
   POST /api/mesas { id, nome, mestre: { login, nome, derivada }, chavePublica? }
Worker:   valida (4 KB, JSON, zod) ─► Diretorio.criar  (limite de 5 mesas por hora por IP)
Diretorio: registra {id, doNome "mesa:<id>"} ─► Sala "mesa:<id>" POST /criar
Sala:      estado vazio ─► criarMestre ─► registrarChave ─► gerarCodigo ─► abrirSessaoDe
           responde { cookie, codigo }
Worker:   põe o cookie no Set-Cookie; o código vai só neste corpo
```

Se a sala falha ao criar, o diretório **esquece** o registro (`esquecer`), para não sobrar uma mesa fantasma. Id repetido dá 409
`id_em_uso` e o navegador sorteia outro. Só com `MODO=teste` dá para criar mesa sem conta.

### Entrar, pedir e ser aceito

- **Entrar** (`conta/entrar`): login e derivada. Abre uma sessão e responde com o cookie.
- **Pedir para entrar** (`conta/pedir`): cria uma conta `pendente`. **Toda entrada passa pelo mestre**: não existe convite que
  dispense a aprovação, nem link ligado a uma vaga (decisão do Vilella). O mestre recebe um aviso (`contas.aviso`, só números,
  nome e login do pedido) e, em `contas/<id>/aceitar`, aceita ou recusa.
- **Aceitar** (`planejarAceite`, em `membros.ts`): sem ficha indicada nasce um jogador novo com o nome da pessoa; com a ficha
  de uma vaga escondida a conta herda aquela vaga (renomeada); com uma ficha sem dono nasce o jogador e passa a ser dono dela.
  Mesa cheia sem vaga a reaproveitar: `vaga_invalida`.
- **Recusar** só permite pedir de novo depois de 10 minutos. **Remover** fecha os sockets da conta e esconde a vaga (fichas e
  tokens ficam para a próxima conta herdar).
- **Esqueci a senha / redefinir:** o jogador pede (`conta/esqueci`, resposta sempre igual, exista o login ou não) e o mestre,
  depois de **confirmar por voz ou mensagem que é a própria pessoa**, libera por 30 minutos; só então vale `conta/redefinir`.

### Sessão e cookies

A identidade de uma requisição **não vem de cabeçalho**: a sala descobre sozinha (`identificar`), pelo cookie
`tavola_sessao` (sessão → conta → vaga). Detalhes (`autenticacao.ts`, `contas.ts`):

- o token de sessão são 32 bytes aleatórios em base64url; **no banco fica só o SHA-256 dele** (`hashDoToken`). Quem rouba o
  arquivo do banco não consegue se passar por ninguém;
- o cookie é `HttpOnly` (JavaScript da página não o lê), `SameSite=Lax`, **`Path=/api/m/<id>`** (só vale naquela mesa; o cookie
  de uma mesa nunca é mandado à outra) e `Secure` quando a requisição veio por https (o Worker olha o protocolo e passa ao
  sala no cabeçalho `x-tavola-seguro`);
- vale 30 dias (`SESSAO_VALE_MS`) e é **renovado pelo uso**, no máximo uma vez por hora (`sessaoPrecisaRenovar`); nesse caso a
  rota `eu` reenvia o cookie;
- no máximo 10 sessões por conta (as mais antigas caem), e uma sessão só vale enquanto a conta está `ativa`;
- `sair` apaga a sessão no banco, fecha os sockets dela e apaga os cookies (inclusive o de teste e o antigo `tabletop_usuario`).

O cookie `tabletop_sessao` (o id do usuário em texto) é o **login solto de desenvolvimento** e só existe com `MODO=teste`, para
os E2E antigos escolherem o usuário. Fora desse modo a sala nem lê esse cookie.

### Os limites (o que protege contra adivinhar senha)

Todos moram na tabela `limites_ip` (tipo, ip ou chave, instante) e nas colunas da conta, e são calculados com o `agora` que
vem de fora (testável). Valores atuais (`packages/shared/src/contas.ts`):

| O que | Limite |
|---|---|
| Senha errada numa conta | 5 falhas bloqueiam a conta; esperas de 1, 5, 15 e depois 60 minutos |
| Login que não existe | conta por login normalizado, com a **mesma** espera crescente (para a resposta não dizer se a conta existe) |
| Falhas por IP | 30 falhas em 15 minutos bloqueiam o IP por 15 minutos |
| Pedir para entrar | 3 por IP por hora; no máximo 10 pedidos pendentes na mesa |
| Esqueci a senha | 5 por IP por hora |
| Desafio de recuperação | 20 por IP por hora; no máximo 50 desafios abertos |
| Recuperação do mestre | 5 erros por mesa, esperas de 1, 5, 15 e 60 minutos |
| Criar mesa | 5 por IP por hora (no diretório; em `MODO=teste` o freio não vale) |

Dois cuidados deliberados contra vazar informação:
- **Resposta igual.** Login inexistente e senha errada respondem o mesmo "Login ou senha incorretos.". Quando a conta não existe,
  a sala faz a mesma conta contra um sal e um hash de mentira (`SAL_DE_MENTIRA`, `HASH_DE_MENTIRA`), então o **tempo** também
  não diz se o login existe. Só depois de a senha estar certa a sala diz em que pé está o pedido (pendente, recusado).
- **Tempo constante.** `iguaisEmTempoConstante` compara sem parar no primeiro byte diferente.

### Recuperar o acesso do mestre

O mestre é o único que ninguém pode redefinir (a redefinição de jogador passa por ele). Para o mestre que esqueceu a senha há
**duas saídas**, as duas pedem também o login do mestre:

**Pelo código de recuperação.** O servidor gera 20 caracteres do alfabeto dos ids (31 símbolos, sem ambíguos; uns 99 bits de
entropia), em grupos de 4: `xxxx-xxxx-xxxx-xxxx-xxxx`. Guarda **só o SHA-256 do código** (sem PBKDF2: a entropia já é alta) em
`contas.codigo_hash`. O código aparece **uma única vez** (ao criar a mesa, ao dar a conta de mestre a uma mesa legada, ou em
"Gerar novo código", que pede a senha e mata o anterior). Usado para recuperar, ele morre e um novo é devolvido na hora.

**Pela pasta da mesa.** Ao criar a mesa o navegador gera um par de chaves **ECDSA P-256** (WebCrypto). A chave **privada** vai
para o arquivo `tavola-mestre.json` na pasta local que o mestre escolheu e **nunca viaja**. O servidor guarda só a **pública**
(`contas.chave_publica`; o schema `ChavePublicaSchema` é `.strict()`, então uma chave com o campo `d`, o da privada, é
recusada). Recuperar é um desafio e uma assinatura:

1. `conta/recuperar/desafio` devolve um `nonce` (32 bytes aleatórios, 5 minutos de validade, **uso único**);
2. o navegador assina `"tavola-recuperar:" + id da mesa + ":" + nonce` com a chave privada;
3. `conta/recuperar/pasta` recebe a assinatura e a derivada da senha nova. O servidor gasta o nonce **antes de conferir**
   (certa ou errada, a mesma assinatura não vale duas vezes), verifica a assinatura com a chave pública e, se certa, troca a
   senha, derruba todas as sessões do mestre, zera o bloqueio e abre uma sessão nova.

O erro é **sempre** 401 `recuperacao_invalida`, sem dizer se a mesa tem chave, se o código existe ou qual deles falhou. Se a mesa
não tem chave, a conferência roda contra uma **chave de mentira** (`obterChaveDeMentira`, gerada e jogada fora), para o tempo
também não revelar isso. `login_nao_confere` (403) só aparece depois de provar ser o dono, para quem não prova não vazar o login
do mestre.

### Os tokens do Claude

O Claude entra na mesa **como o próprio usuário** e nunca alcança mais do que ele. Para isso a pessoa gera um token em
Preferências → Conectar o Claude:

- formato `tvc_` + 32 bytes aleatórios em base64url (`novoTokenDoClaude`); no máximo 5 por conta;
- **o token aparece uma vez** (na resposta de `conta/claude/gerar`); o banco guarda o SHA-256 (`tokens_claude.hash_token`);
- ele vale **enquanto a conta está ativa e ligada à mesma vaga** (`resolverTokenDoClaude`). Remover a conta, recusá-la, trocar a
  vaga ou revogar o token (`conta/claude/revogar`) faz o token deixar de valer na hora, e as conexões abertas com ele caem
  (`fecharSockets` por `tokenId`);
- abre **só duas coisas**: o WebSocket (`Authorization: Bearer`) e a rota `POST /api/m/<id>/mcp`. Nenhuma rota de conta o
  aceita, e `donoDosTokens` recusa até gerar token com o cabeçalho `Authorization` presente (403). Ele **não cria sessão nem
  cookie**;
- token errado, malformado ou revogado dão **o mesmo** 401, e cada falha entra no **mesmo bloqueio por IP do login**;
- a lista `PROIBIDAS_AO_CLAUDE` (`claude.ts`) recusa mesmo para um mestre: mudar papéis e permissões, exportar e importar a
  campanha, trocar arquivos pelo protocolo e mexer na caixa de entrada. Outras coisas que o Claude nunca alcança são rotas HTTP
  que o token não abre (contas, chave da pasta, código de recuperação, gerar tokens);
- limite de frequência por token (20 intenções por segundo, rajada de 40);
- o que ele cria para o mestre nasce **rascunho** (invisível ao jogador até o mestre publicar) e tudo que ele diz leva a marca
  "pelo Claude"; o que ele muda entra no diário do Desfazer (arquivo 03).

### Conferência de origem (`origem.ts`)

`origemPermitida(origin, url)` fecha o sequestro de WebSocket entre sites (além do `SameSite=Lax`) e o `POST` vindo de outro
site. Vale no upgrade do WebSocket e em todo `POST` de `/api/`:

- **sem `Origin`** (clientes que não o mandam, como o MCP em Node): aceita;
- **com `Origin`**: o host dele tem de ser o do próprio pedido;
- `"null"` (iframe isolado, arquivo local) e esquemas que não sejam http/https: recusa;
- pedido **local** (host de loopback): aceita também qualquer origem de loopback, porque no dev o proxy do Vite pode reescrever
  o `Host`. Na internet o host nunca é loopback, então vale só o mesmo host.

A rota do MCP é mais dura: **qualquer** `Origin` é recusado (um navegador sempre manda; o Claude Code não manda). E ela não
responde preflight de CORS, então o navegador de outro site não consegue mandar `Authorization`.

### O registro de mesas e o diretório

O `Diretorio` é um Durable Object único (`idFromName("diretorio")`) com a tabela `mesas (id, do_nome, nome, criada_em, legada)`
e `criacoes (ip, em)` para o limite. Só o Worker fala com ele. Pontos de segurança:

- **O id é longo e aleatório:** 12 caracteres de um alfabeto de 31 símbolos (cerca de 59 bits), agrupados em 3 de 4
  (`k7m2-qx9p-4tdn`), sorteados com `crypto.getRandomValues` sem viés. Quem não tem o id não acha a mesa.
- **Ninguém lista as mesas dos outros:** `GET /api/mesas` responde 404, a não ser que `LISTAR_MESAS=1` (só dev e E2E).
- **A mesa legada** é o Durable Object `campanha` (a campanha de antes das contas), registrada no diretório sem tocar nela. Ela
  nasce **sem conta de mestre**; `conta/mestre-inicial` cria a dele, e só vale em **requisição local** (o Worker marca
  `x-tavola-local`) e **enquanto a mesa não tem mestre**: na internet uma mesa nunca fica sem dono.
- **Mesa sem mestre não aceita pedidos de entrada** (`mesa_sem_mestre`).

### As transferências de arquivo

`Transferencias` (`transferencias.ts`) coordena o envio de imagens e sons **entre navegadores**: o servidor nunca grava o
arquivo, só **repassa os pedaços** (quem tem o arquivo manda, a sala repassa a quem espera). O ponto de segurança é que a sala
**não confia no que chega**:

- um frame binário de pedaço só vale se a sala **pediu aquele hash e aquele índice àquele socket** e o `total` bate
  (`frame`); o resto é descartado em silêncio;
- só entra como "quem tem" um arquivo que a pessoa **pode ver** (`assetVisivelPara`); um arquivo que ela não vê responde igual
  a um que não existe (`asset_inexistente`);
- o provedor de um hash nunca é quem espera o mesmo hash;
- o conteúdo é conferido por **quem recebe**, não por quem envia (resumo abaixo).

## Decisões e por quê

- **Tudo local, mas "como se fosse a internet"** (Vilella, 2026-11-11/12). Daí contas por mesa, derivada no navegador, cookies
  com `Path` por mesa, `Origin`, limites por IP, ids aleatórios e rota de listagem fechada, mesmo rodando em `127.0.0.1`.
- **A sala identifica, o Worker não.** O Worker só repassa e refaz os cabeçalhos internos; quem resolve cookie, sessão e vaga é
  a sala. Assim há **um** lugar para decidir quem é quem, e nada que o navegador mande em `x-tavola-*` vale.
- **Conta por mesa** (e não global): o servidor não precisa de um cadastro central, o mestre controla quem entra, e uma mesa
  perdida não vaza as credenciais de outras. A ideia de um login global é discussão aberta (ver abaixo).
- **Toda entrada passa pelo mestre.** Não há convite que dispense a aprovação.
- **Código de recuperação além da pasta** (Vilella): a pasta só funciona em Chrome e Edge (File System Access) e não pode ser o
  único caminho.
- **Segredos só como hash:** senha (SHA-256 de sal e derivada), sessão, token do Claude e código de recuperação. O que o mestre vê
  de cada conta é só id, login, nome, vaga, status e último acesso (`listarParaMestre`); nunca sal, hash nem token.
- **Respostas iguais e tempo igual** para login, recuperação e token, para não dar pista de que algo existe.
- **O que é secreto fica fora de `entidades`** (a tabela que a exportação lê), então nenhum arquivo de campanha leva conta,
  sessão, token ou chave.
- **Sem termos de uso** (assumido; `PROJETO.md` 4.14). Descartada a ideia de um checkbox com PDF, que estava em `IDEIAS.md`.

## Os trechos complexos

### 1. Quem é quem: `identificar` e os cabeçalhos internos

**O problema.** A sala atende pedidos que passam por um Worker. Se a sala acreditasse num cabeçalho como "o usuário é o
mestre", qualquer um o forjaria. E o cookie de uma mesa não pode servir em outra.

**Como o código resolve.**
1. No Worker (`index.ts`), para toda rota `/api/m/<id>/...`, copia os cabeçalhos do pedido, **apaga** `x-tavola-ip`,
   `x-tavola-local`, `x-tavola-seguro`, `x-tavola-mesa` e o legado `x-tabletop-usuario`, e **escreve** os verdadeiros: o IP de
   `CF-Connecting-IP` (ou `"local"` se não há), se o protocolo é https, se o pedido é local (`HOSTS_LOCAIS` e IP de loopback ou
   ausente) e o id da mesa.
2. Na sala, `identificar` lê o cookie `tavola_sessao` e chama `contas.resolverSessao`: valida o formato (43 caracteres de
   base64url), calcula o hash, procura a sessão, confere validade e que a conta está `ativa`, renova se passou 1 hora e devolve
   a conta. Depois confere que a vaga da conta **existe no estado**. Sem cookie válido, só com `MODO=teste` olha o cookie de
   teste.
3. O cookie tem `Path=/api/m/<id>`: o navegador só o manda para aquela mesa.

**O que é frágil.**
- A "requisição local" (conta do mestre da mesa legada) depende do **host** e do `CF-Connecting-IP`. Num servidor de verdade o
  host nunca é loopback; mesmo assim `PASSAGEM.md` manda **conferir de novo ao ir para a internet**.
- `MODO=teste` liga o login solto, as rotas `entrar` e `usuarios` e a criação de mesa sem mestre: **nunca** suba o servidor de
  verdade com essa variável.
- Fechar um socket com `4001` depende de o cliente perguntar `eu` e voltar à tela de entrada (`useSala.ts`). Se a rota `eu`
  mudar, ele não volta.

**Teste que vigia.** `apps/server/src/autenticacao.test.ts`, `contas.test.ts`, E2E `contas.spec.ts`.

### 2. O login que não conta segredos: `entrar`, `confere` e os limites

**O problema.** Um atacante tenta milhares de senhas, e também tenta descobrir que logins existem. As respostas e o tempo não
podem ajudá-lo.

**Como o código resolve** (`ContasDaMesa.entrar`):
1. `limpar(agora)` joga fora sessões, desafios e registros de limite vencidos (a tabela não cresce sem fim);
2. se o IP está bloqueado (`esperaDoIp`), recusa já com `ip_bloqueado` e **quantos minutos esperar**;
3. se a conta existe e está bloqueada, `bloqueada` com os minutos; se não existe, olha a espera acumulada **daquele login**;
4. `confere(conta, derivada)` calcula `hashDaDerivada` **sempre**, com o sal da conta ou com um sal de mentira, e compara em
   tempo constante com o hash da conta ou com um de mentira. Existir ou não a conta gasta o mesmo trabalho;
5. senha errada: `registrarSenhaErrada` conta contra o IP e contra a conta (`registrarFalhaDaConta`: na 5ª falha bloqueia, com
   o degrau 1, 5, 15, 60 minutos conforme os bloqueios anteriores). Para login inexistente, a mesma regra roda por login
   normalizado em `limites_ip` (`limite("login", ...)`), com o mesmo degrau;
6. senha certa: zera as falhas; **só então** diz se o pedido está pendente, recusado ou sem vaga.

O limite do IP (`bloqueioDoIp`) é "30 falhas nos últimos 15 minutos bloqueiam por 15 minutos a contar da 30ª mais recente". O
token do Claude errado também registra `falha` no IP, então um script que tenta tokens sofre o mesmo bloqueio de quem tenta
senhas.

**O que é frágil.** A mensagem de espera tem de aparecer **igual** para conta existente e inexistente (por isso o limite por
login normalizado). Mudar uma mensagem de erro ou a ordem das checagens pode abrir uma pista. Os E2E de conta usam a derivação
real (600.000 iterações), então cada login leva cerca de 1 s; é de propósito.

**Teste que vigia.** `apps/server/src/contas.test.ts` (limites, bloqueios, esperas), `packages/shared/src/contas.test.ts`
(derivação e constantes).

### 3. A recuperação pela pasta: desafio, assinatura, nonce gasto

**O problema.** Provar "sou o mestre" sem senha e sem mandar nenhum segredo, e sem dar ao atacante uma forma de repetir uma
assinatura ouvida ou de descobrir se a mesa tem chave.

**Como o código resolve** (`recuperarPelaPasta`):
1. aplica os limites (IP e por mesa; `esperaDaRecuperacao`);
2. `consumirDesafio(nonce)` lê a validade e **apaga o nonce na mesma chamada síncrona** (sem `await` entre ler e apagar: dois
   pedidos simultâneos não gastam o mesmo). O resultado "valia ou não" fica guardado, mas o nonce já morreu, certo ou errado;
3. carrega a chave pública do mestre; se não há, usa a chave de mentira;
4. verifica a assinatura sobre `mensagemParaAssinar(mesaId, nonce)` (`"tavola-recuperar:<mesa>:<nonce>"`). O id da mesa na
   mensagem impede usar uma assinatura de uma mesa em outra;
5. se `!mestre || !real || !valia || !conferiu`, é **uma única falha** (`falhaDeRecuperacao`, que conta contra o IP e contra a
   mesa) com a mesma resposta;
6. só então compara o login (`login_nao_confere`) e `retomarMestre` troca a senha, derruba as sessões e abre uma nova.

**O que é frágil.** O arquivo `tavola-mestre.json` **é** a prova de mestre: quem o tem recupera a mesa. O próprio arquivo diz
isso (`AVISO_DO_ARQUIVO_DA_CHAVE`). Criar a mesa numa pasta que já guarda a chave de **outra** mesa é recusado, porque gravar por
cima apagaria a prova da outra. A troca de chave ("Trocar a chave da pasta") invalida a antiga.

**Teste que vigia.** `apps/server/src/recuperacao.test.ts`, `packages/shared/src/recuperacao.test.ts`, E2E `recuperacao.spec.ts`.

### 4. O token do Claude e as duas portas dele

**O problema.** Dar a uma ferramenta externa o poder de agir como o mestre sem criar uma via de ataque nova: o token não pode
virar uma sessão de navegador, nem mexer em contas, nem ser adivinhável sem ser notado.

**Como o código resolve.**
- `abrirSocket` e `rotaMcp` fazem a mesma validação: `resolverTokenDoClaude(tokenDoCabecalho(Authorization), ip, agora,
  ehTeste)`. Ela confere o **formato** (`FORMATO_DO_TOKEN_DO_CLAUDE`), calcula o hash, procura em `tokens_claude`, e, se o token
  tem conta, exige conta `ativa` e a **mesma vaga** de quando o token foi gerado. Qualquer falha é "não autenticado", e conta
  como falha de IP (com IP bloqueado, nem confere).
- O socket do Claude recebe uma `Identidade` com `claude: true` e `tokenId`. Ele **não conta como presença**, não segura a mesa
  sem mestre, não baixa arquivos e não recebe os avisos de contas.
- Toda intenção dele passa por `tratarIntencao` com `claude: true`: balde de frequência, lista de proibidas, carimbo de
  rascunho, diário do Desfazer.
- `rotaMcp` ainda recusa qualquer `Origin`, só aceita `POST` com JSON, limita o corpo (512 KB; 4 MB quando o corpo traz
  `arquivos`) e responde `Cache-Control: no-store`. As ferramentas chamam o mesmo `tratarIntencao`, então valem as mesmas
  regras; a visão do Claude é a `visaoDe` do usuário dele (o Claude do jogador enxerga o que o jogador enxerga).
- O link de envio de arquivo da ferramenta `arquivos` fica **preso ao token que o pediu**: revogar o token mata o link.

**O que é frágil.** A lista de proibidas está em `claude.ts` e é lida pela sala e pelos testes: uma intenção nova que mexe em
conta ou segredo precisa entrar nela. Rotas HTTP novas **não** devem aceitar `Authorization`.

**Teste que vigia.** `apps/server/src/tokensClaude.test.ts`, `packages/shared/src/claude.test.ts`, E2E `claude-12-1.spec.ts` e
`claude-12-3.spec.ts`.

## A segurança dos arquivos (resumo)

`packages/shared/src/seguranca.ts` guarda as regras de quando um arquivo vindo de outra pessoa (um jogador, o Claude) pode
entrar na mesa. A regra de ouro: **o tipo vem dos bytes, nunca do nome nem do que o cliente diz**, e **quem recebe confere de
novo**. Em resumo:

- só uma **lista fechada de formatos** (`FORMATOS_PERMITIDOS`: png, jpg, gif, webp, mp3, ogg, wav, json); nunca svg, html,
  executável nem script;
- `conferirArquivoRecebido` exige que os bytes sejam um formato permitido, servem ao tipo do asset, batam com o `mime`
  declarado e caibam no limite do tipo;
- o **nome no disco é montado pelo Távola** (`nomeDeArquivoNoDisco`: nome limpo + 8 letras do hash + extensão do formato
  detectado). A extensão original nunca é usada, e há uma lista de extensões que nunca podem existir (`EXTENSOES_PERIGOSAS`);
- nomes são limpos de caracteres de controle, barras, `..` e nomes reservados do Windows (`trechoDeCaminhoSeguro`).

O detalhe completo (hash e pedaços, cifra, pasta organizada, caixa de entrada do Claude) está em
`07-arquivos-e-assets.md`.

## O que já está pronto para a internet, e o que ainda faltaria

**Já está no código** (e funcionando em `127.0.0.1`):
- senha derivada no navegador, só hash no servidor, comparação em tempo constante, respostas e tempos iguais;
- sessões em cookie `HttpOnly`, `SameSite=Lax`, com `Path` por mesa, `Secure` automático sob https, renovação e teto de sessões;
- limites de tentativa por conta, por login, por IP, por mesa; limites de pedidos, de desafios e de criação de mesas;
- conferência de `Origin` no WebSocket e nos `POST`; MCP sem CORS e sem `Origin`;
- ids de mesa aleatórios, listagem fechada, mesa sem dono impossível, toda entrada aprovada pelo mestre;
- recuperação do mestre por pasta (ECDSA) e por código, com o mesmo erro para todas as falhas;
- tokens do Claude com hash, revogação imediata, limites e lista de proibições;
- filtro do que é secreto por pessoa (arquivo 03), validação zod de toda entrada, corpos pequenos (4 KB nas rotas de conta);
- arquivos conferidos pelos bytes por quem recebe.

**O que ainda faltaria, ou precisa ser conferido** (do que o projeto diz e do que o código mostra; o que é inferência minha
está marcado como tal):
- **O deploy em si.** O projeto nunca rodou fora da máquina local: não há `wrangler deploy` feito, nem domínio, nem https real.
- **Conferir a "requisição local" e o `CF-Connecting-IP`** atrás do Cloudflare real (`PASSAGEM.md`, C2).
- **`MODO=teste` fechado.** Garantir que a variável nunca exista no servidor de verdade (ela liga o login solto e a criação de
  mesa sem conta).
- **A chamada de vídeo** pede https fora do `localhost` para câmera e microfone, e para atravessar roteadores difíceis precisa de
  um servidor TURN (`VITE_CHAMADA_ICE_SERVERS`; `PROJETO.md` 4.15).
- **Não há apagar a mesa nem desligar uma mesa abandonada.** Nenhuma rota faz isso. (Inferência minha: numa instalação
  pública isso viraria acúmulo de dados.)
- **Não há e-mail nem outro canal de recuperação** para o mestre além da pasta e do código; para o jogador, só o mestre. É uma
  decisão, mas é também um limite.
- **Limites de CPU e de tamanho do plano de Workers** (10 ms no grátis; o movimento já é limitado a 20 por segundo por esse
  motivo) precisam ser medidos com tráfego real. Os limites do chat, do botão e do Claude são **por conexão ou por token**, não
  há um freio global de conexões por IP além do bloqueio por falha (inferência minha).
- **CSRF** hoje é coberto por `SameSite=Lax` e pela conferência de `Origin`; não há token de CSRF. Para o desenho atual é
  suficiente, mas vale reavaliar se um dia houver rota que aceite cookie em `GET` com efeito (inferência minha).
- **Termos de uso e política de dados**: o Vilella decidiu **não** ter por enquanto; se a mesa for pública, é decisão que volta.

**O portal de login** está em discussão. Em `docs/IDEIAS.md` há a decisão do Vilella (2026-11-20) de que o login passaria a ser
no portal Távola e não por mesa, "a pensar depois". Ainda não há desenho nem código; este arquivo descreve o que existe hoje
(conta por mesa), e o portal mudaria principalmente onde a conta mora e como a pessoa chega a uma mesa.

## Para ir além

- `../../PROJETO.md`: seção 4.14 (mesas e contas; C1, C2 e C3), 4.12 (o acesso do Claude).
- `../PASSAGEM.md`: "C1", "C2", "C3", "12-1", "12-3", "AS1" (o que é frágil em cada lote).
- `../REDESIGN.md`: "C2 — como ficou" e "C3 — como ficou" (as suposições de cada lote).
- `../protocolo.md`: a tabela das rotas HTTP, com os códigos de erro e os limites.
- `../IDEIAS.md`: "Tela inicial, criar mesa e contas por mesa" (o raciocínio original) e o portal de login.
- `03-sala-e-sincronizacao.md`: o filtro do que é secreto e o diário do Desfazer.
- `07-arquivos-e-assets.md`: a segurança dos arquivos em detalhe.
- `10-mcp.md`: as ferramentas do Claude.
