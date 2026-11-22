# 12 — Testes e fluxo de trabalho

Esta parte explica como o Távola é verificado e como o trabalho entra no repositório. De um lado, as três camadas de
teste: **unidade** (vitest, em cada pacote), **E2E** (Playwright, com vários navegadores como se fossem vários
jogadores) e os **prints** (imagens para o Vilella olhar). Do outro, o **fluxo em lotes**: um brief, um agente num
worktree, a revisão, o commit e a junção local. Esta parte explica também por que a
pasta de trabalho do `pnpm dev` pede cuidado.

## Onde fica

- **Scripts:** `package.json` da raiz (`verify`, `test`, `test:e2e`, `typecheck`, `lint`, `dev`, `dev:e2e`).
- **Unidade:** `packages/shared/src/**/*.test.ts`, `apps/web/src/**/*.test.ts`, `apps/server/src/*.test.ts`,
  `apps/mcp/src/*.test.ts`.
- **E2E:** `e2e/playwright.config.ts`, `e2e/portas.ts`, `e2e/midiaFalsa.ts`, `e2e/tests/*.spec.ts` (e as ajudas
  `e2e/tests/ajudas*.ts`), `e2e/.estado-sala/` (o estado da sala de teste, fora do git).
- **Prints e medidas:** `e2e/playwright.prints.config.ts`, `e2e/playwright.medidas.config.ts`, `e2e/prints/*.spec.ts`.
- **Os "ouro":** `packages/shared/src/ouro.test.ts` com `privado/fixtures/ouro/chama-primordial-10min.json`; as fixtures
  de ficha em `privado/fixtures/fichas/` (PDFs e JSONs de referência). Ver "A pasta `privado/`".
- **Servidor de teste:** `apps/server/scripts/dev-e2e.mjs`, as rotas `/teste/*` em `apps/server/src/sala.ts`
  (`rotaDeTeste`) e os ganchos `import.meta.env.MODE === "e2e"` em `apps/web/src`.
- **Regras do fluxo:** `PROJETO.md` seção 9, `docs/ESTADO.md` (seção "Fluxo de trabalho" e o diário dos lotes) e as regras
  que o Vilella e o orquestrador repetem em todo brief (as de V1 a V14 e depois: cópia separada, banco, testes enxutos,
  créditos).

## Como funciona

### O `pnpm verify`

`pnpm verify` é a porta de saída de todo lote. Ele roda, nesta ordem e parando no primeiro erro (`&&`):

1. `pnpm typecheck`: `tsc --noEmit` em todos os pacotes (`pnpm -r --parallel`), incluindo o `e2e`.
2. `pnpm lint`: `biome check .` (Biome é a **única** ferramenta de lint e formato; sem avisos; nada de `biome-ignore` no
   CSS; os `.md`, `fixtures/` e `docs/desenho/` ficam fora).
3. `pnpm test`: o `vitest run` de todos os pacotes **menos** o `e2e`, em paralelo.
4. `pnpm test:e2e`: o Playwright (`pnpm --filter @tabletop/e2e test`).

Regra desde o começo (PROJETO seção 9): nenhum lote está pronto sem `pnpm verify` verde. Mas a regra foi **afinada pelo
Vilella**, porque a bateria completa chegou a ser o maior custo de cada lote (ver "Decisões"): hoje o `verify`
completo só roda quando o lote mexe em `apps/server`, em `packages/shared` (regras, schemas, protocolo) ou no banco. Um
lote só de tela (`apps/web`), de textos ou de docs roda: typecheck, lint, a unidade do pacote mexido, os specs E2E que
tocam o que mudou e um teste rápido de que a mesa abre (`sala.spec`).

### Os testes de unidade (vitest)

Cada pacote tem o seu `vitest run`. Ordem de grandeza (CH4/AU3, ver `docs/ESTADO.md`): shared ~1,5 mil testes, web ~370,
server ~140, mcp ~20. O princípio é o do PROJETO seção 9, item 5: **lógica de regras, geometria, dados e import de PDF
fica em `packages/shared`, pura e testada**; o que está nas pontas (tela, sala) é fino, e o que dá para testar sem
navegador é testado sem navegador.

**`packages/shared` (a maior parte).** Roda em Node, sem DOM. É o núcleo: `processar` (o redutor que transforma uma
intenção em eventos e em estado novo) e `processarSistema` (o tempo), com a fonte de dados com semente fixa
(`fonteComSemente`) para os testes serem reprodutíveis. Exemplos do que mora aqui: `nucleo.test.ts` (intenções e
filtros de visão por papel), `protocolo.test.ts` (os esquemas zod das mensagens), `visao.test.ts`, `iluminacao.test.ts`,
`luz.test.ts`, `tochas.test.ts`, `paredes*.test.ts`, `combate.test.ts`, `conjuracao*.test.ts`, `automacoes.test.ts`,
`caixas.test.ts`, `fluxosConversao.test.ts`, `ping.test.ts`, `mesas.test.ts`, `contas.test.ts`, `recuperacao.test.ts`
(WebCrypto), `importarFichaPdf.test.ts` (o PDF de verdade, lido pelo pdf.js em Node), `buscaDoCompendio.test.ts`,
`campanhasProntas.test.ts`. Dentro dele, `mcp/` testa o servidor MCP **sem rede** (`mcp/testes/salaSimulada.ts`):
`ferramentas.test.ts`, `paridade.test.ts` (confere que cada intenção tem entrada na tabela de paridade com o Claude, e
que a ferramenta e o campo citados existem), `paridadeCampos.test.ts`, e os testes por lote (`m2`, `q11`, `q16`, `au1`,
`fg1`, `as1`).

**`apps/web`.** O vitest roda no ambiente Node padrão (sem jsdom nem happy-dom): **só se testa lógica pura**, nunca
componentes. Por isso a lógica de tela é puxada para arquivos sem React: `tema/temas.test.ts` (contraste dos 14 temas),
`atalhos.test.ts`, `janelas/geometria.test.ts`, `passoDasSetas.test.ts`, `posicaoDaRegua.test.ts`, `rotas.test.ts`,
`mesasLocais.test.ts`, `preferencias.test.ts`, `tour/*.test.ts`, `automacoes/passosDoTour.test.ts` e
`grafoDoEditor.test.ts`, `chamada/grade.test.ts`, `chamada/gravacao/*.test.ts`, `rolagem/*.test.ts`,
`useSala.test.ts` (só as funções puras do hook: backoff, duração do aviso, quais recusas calam). O que depende de
DOM e de componente é coberto pelo E2E.

**`apps/server`.** Os testes de unidade da sala **não rodam no workerd**: o SQLite do Durable Object só existe lá, então
`armazenamento.test.ts` põe um adaptador mínimo sobre o `node:sqlite` em memória (o módulo é importado com o nome
montado, `` `node:${"sqlite"}` ``, para o TypeScript do servidor, que usa os tipos do workerd, não procurá-lo).
Cobrem `Armazenamento` e suas migrações, `contas.ts`, `autenticacao.ts`, `origem.ts`, `caixaDeEntrada.ts`,
`transferencias.ts` e os tokens do Claude (`tokensClaude.test.ts`). O `@cloudflare/vitest-pool-workers` ficou como "avaliar no Lote 1" no `ESTADO.md` e os testes seguem sem ele.

**`apps/mcp`.** `sala.test.ts` (o cliente WebSocket da sala, com soquete simulado) e `compendioLocal.test.ts`.

**Os testes "ouro" (fixtures golden).** Dois tipos:
- `ouro.test.ts` (AU1): a campanha **Chama Primordial** roda 10 minutos simulados (semente `20261113`; tokens entrando e
  saindo de zonas, tochas acesas, um botão, uma tocha reacesa) e o que acontece a cada instante (estado das luzes,
  modificadores, limite de visão, mensagens do chat) fica gravado em `privado/fixtures/ouro/chama-primordial-10min.json`. O
  teste roda de novo e exige `toEqual` com o arquivo. Foi gravado **antes** de trocar o motor de automações por
  fluxos; o motor novo, com a conversão dos ciclos e reações antigos, tem de chegar ao mesmo resultado, inclusive na
  **ordem** em que o gerador aleatório é sorteado (a ordem dos fios é a ordem de execução). Para regravar, só de
  propósito: `OURO_GRAVAR=1`. Se o ouro quebra, ou a regra mudou de propósito (regrave e diga no relatório) ou algo
  quebrou.
- As fixtures de ficha (`privado/fixtures/fichas/brendan.json`, `darion.json` e os PDFs das fichas): o
  `importarFichaPdf.test.ts` lê o PDF real e confere campo a campo contra o JSON de referência (e contra os valores do PDF
  do Darion, em `privado/notas/darion.md`). O `extrator` do compêndio (SRD) tem o mesmo desenho em `extrator/extrator.test.ts`.

### O E2E com Playwright

`e2e/playwright.config.ts` é curto e cada linha tem motivo:

- `workers: 1` e `fullyParallel: false`. Os testes compartilham **uma sala de teste só**; rodar em paralelo faria um
  zerar a sala do outro.
- `retries: 1` e `failOnFlakyTests: true`. Um teste que falha é repetido **uma** vez; se só passa na repetição, o
  Playwright o chama de instável e o `verify` **reprova do mesmo jeito**. Decisão de 2026-11-10: instável se corrige, nunca
  se aceita (e se corrige na causa: esperar o estado da sala com `expect.poll`, `toPass` ou `toHaveAttribute`, nunca
  com `waitForTimeout` maior nem com mais retries).
- `expect.timeout` 10 s e `reducedMotion: "reduce"`: as transições de 140 ms ficam desligadas para uma janela não ser
  medida no meio da entrada. O `polimento.spec.ts` confere que elas existem sem a preferência e somem com ela.
- `channel: "chrome"`: usa o Chrome instalado; nenhum browser é baixado. Só o Chrome é testado.
- `trace: "retain-on-failure"`.

**O servidor de teste e o estado separado.** O `webServer` do config sobe **dois processos próprios**, com portas e
diretório de estado diferentes dos do `pnpm dev`:

| Processo | `pnpm dev` (a mesa real) | E2E |
|---|---|---|
| sala (wrangler) | `127.0.0.1:8787`, estado em `apps/server/.wrangler/state` | `8788`, estado em `e2e/.estado-sala` |
| web (Vite) | `127.0.0.1:5173` | `5174`, `vite --mode e2e` |

As portas vêm de `e2e/portas.ts` (`PORTA_SALA_E2E`, `PORTA_WEB_E2E`, que leem `E2E_PORTA_SALA` e `E2E_PORTA_WEB`;
padrão 8788/5174) e valem para o config, a sala (`dev-e2e.mjs` usa `wrangler dev --port ... --persist-to
../../e2e/.estado-sala --var MODO:teste --var LISTAR_MESAS:1`) e o Vite (que lê `TABLETOP_PORTA_*`, preenchidas pelo
Playwright a partir delas, ou o `apps/web/.env.e2e`). **Nunca 8787/5173**: elas são da campanha real do Vilella.
Variáveis diferentes permitem rodar duas cópias do repositório ao mesmo tempo (cada uma com as suas portas, então o
`reuseExistingServer` nunca reaproveita o servidor da outra): `E2E_PORTA_SALA=8790 E2E_PORTA_WEB=5176 pnpm verify`.
`e2e/.estado-sala/` está no `.gitignore`.

**`MODO=teste`.** A sala de teste sobe com `MODO=teste`. É o **único** modo em que existem:
- as rotas `POST /teste/*` (o Worker as recusa fora do modo, e a sala confere de novo): `zerar` (apaga banco, contas,
  agenda, caixa de entrada e reaplica a semente), `avancar-relogio?ms=` (as tochas envelhecem sem esperar minutos
  reais), `dados?semente=` (dados reprodutíveis), `claude-http?ms=` (encurta a presença do Claude por HTTP) e
  `reiniciar-sala` (derruba a memória como um reinício do processo, para testar que o estado volta do SQLite);
- o **login solto** (`entrar-<usuario>` na tela de entrada, sem conta) numa vaga da semente (`mestre` e `jogador-1` a
  `jogador-7`, de `fixtures/campanha.seed.json`), e a mesa legada com **id fixo** (`t3st-m3sa-e2e7`, em `ajudas.ts`);
- mesas criadas sem conta de mestre e o freio de criar mesa (5 por hora por IP) desligado;
- o tour de introdução **não abre sozinho** (os testes do tour o ligam com `tabletop:pref:tourNoTeste`).

Fora desse modo nada disso existe: o `pnpm dev` nunca tem `/teste/*`.

**As fixtures.** `e2e/tests/ajudas.ts` estende o `test` do Playwright com duas fixtures:

- `zerado` (`auto: true`): antes de **todo** teste faz `POST /teste/zerar`. Todo teste começa com a sala vazia e com a
  semente. É por isso que os testes não dependem da ordem em que rodam.
- `mesa`: uma instância da classe `Mesa`, que abre **um contexto de navegador por usuário** (armazenamento isolado,
  como se cada um fosse um PC). `mesa.entrar("mestre")` abre o contexto, vai a `/m/t3st-m3sa-e2e7`, clica em
  `entrar-<usuario>` e espera `status-conexao` ficar `conectado` e `eu-nome` aparecer. Cada `Sessao` devolvida
  traz também `frames` (os frames de **texto** recebidos da sala), `enviados`, `binarios` e `enviadosBinarios`
  (capturados pelo evento `websocket` do Playwright) e `contexto` e `pagina`. No fim `mesa.fechar()` fecha tudo.
  Um `mesa.entrar(usuario, gancho)` aceita um objeto que vira `window.__tabletopE2E` antes de a página carregar.

E `ajudasMapa.ts` traz `entrarNoMapa(mesa, usuario)`: entra, **espera o mapa subir** (`esperarMapa`: o gancho
`window.__tabletop` só existe depois que o canvas sobe) e deixa a vista em zoom 1. É o ponto de partida da maioria dos
testes de mapa, token, luz e régua. As outras ajudas seguem o assunto: `ajudasFicha`, `ajudasCombate`, `ajudasSom`,
`ajudasAssets`, `ajudasEnvio`, `ajudasDesenho`, `ajudasDicas`, `ajudasClaude` e `ajudasMcp` (esta usa o SDK oficial do
MCP, que só o `e2e` tem como dependência).

**Os ganchos de teste dentro do app.** O canvas PixiJS não tem DOM para o Playwright olhar, então o app expõe janelas de
inspeção, **só no modo `e2e`** (`import.meta.env.MODE === "e2e"`; no `pnpm dev` e no build de produção elas não existem):

| Gancho (`window.`) | Onde nasce | Para quê |
|---|---|---|
| `__tabletop` | `mapa/mapaPixi.ts` (`instalarGanchoDeTeste`) | tokens desenhados (posição, vida, borda, selecionado), zoom, câmera, pings, marcadores, chamas |
| `__tabletopE2E` | **entrada** (o teste o põe) | ganchos de comportamento: envio lento, pedaço corrompido, limite do tile, `semVigiaDoDesfoque`, parâmetros da gravação |
| `__tabletopAssets` | `assets/ganchoE2E.ts` | inventário e verificação do cache de arquivos, status de transferência, motivos de recusa |
| `__tabletopPasta`, `__tabletopPastas` | `assets/ganchoE2E.ts`, `contas/pastaDoMestre.ts` | uma "pasta local" simulada (a pasta real exige um clique do navegador) |
| `__tabletopSom` | `som/useSomDaMesa.ts` | o que está tocando, sem áudio real |
| `__tabletopChamada`, `__tabletopChamadaFalsas` | `chamada/ChamadaEmJanelaPropria.tsx` | diagnóstico da chamada e pessoas falsas na grade |
| `__rendersDaFicha` | `ficha/secoes.tsx` | quantas vezes cada seção da ficha redesenhou (vigia o `memo`) |

Nos dois sentidos o teste fala com a página: `pagina.evaluate(() => window.__tabletop.tokens())` lê, e o `addInitScript`
planta `__tabletopE2E`.

**A câmera falsa por arquivo Y4M (`e2e/midiaFalsa.ts`).** Os E2E da chamada precisam de câmera e microfone. A
câmera falsa embutida do Chromium (`--use-fake-device-for-media-stream` sozinho) **sumia do navegador em cerca de
metade das aberturas** neste computador: a faixa de vídeo terminava uns 250 ms depois de nascer e a câmera deixava de
existir na lista ("Requested device not found"), com o app fora da jogada (provado com uma página em branco e só
`getUserMedia`). Era a causa da "prévia preta" nos E2E da chamada (CH4). A solução é usar **um arquivo de vídeo
como fonte da câmera falsa**: `argsDeMidiaFalsa()` gera (uma vez, em `os.tmpdir()`) um Y4M de 320×180 com 20 quadros
que mudam (uma rampa de cinza que anda), grava num nome provisório com o `pid` e **renomeia** (dois processos nunca leem
um arquivo pela metade), e devolve os argumentos do Chromium (`--use-fake-ui-for-media-stream`,
`--use-fake-device-for-media-stream`, `--use-file-for-fake-video-capture=<arquivo>`). Os specs que precisam da
câmera fazem `test.use({ launchOptions: { args: argsDeMidiaFalsa() } })` (`ch3.spec.ts`, e os prints `ch1`, `ch2`, `ch3`).
O arquivo **não entra no repositório**. O áudio falso do Chromium continua sendo um tom contínuo (os testes de gravação
cortam trechos por tamanho máximo).

**Testes de sigilo.** Um tipo de E2E é obrigatório sempre que um lote cria dado secreto (PROJETO seção 9, item 7): o
teste inspeciona os **frames que o jogador recebeu** e prova que o segredo do mestre não está neles, com um controle
(o mesmo segredo **está** nos frames do mestre, para provar que a captura funciona). Modelos: os testes `frames ...` em
`sala.spec.ts`, `mapa.spec.ts`, `assets.spec.ts` e `cenas.spec.ts`. Ao mesmo tempo, `tema.spec.ts` vigia que nenhuma
requisição do navegador sai para um host diferente de `127.0.0.1` (nada de CDN, fonte remota ou analytics).

### A pasta `privado/`

As fichas dos jogadores (os PDFs impressos das fichas e os JSONs de referência), a campanha Chama Primordial, o ouro
dela e as notas da campanha ficam **só no computador do mestre**, em `privado/` na raiz do repositório. A pasta está no
`.gitignore` e nunca entra no git. A forma dela:

```
privado/
├─ fixtures/
│  ├─ fichas/      darion.pdf, darion.json, brendan.pdf, brendan.json
│  ├─ campanhas/   chama-primordial.json
│  └─ ouro/        chama-primordial-10min.json
└─ notas/          darion.md (os valores do PDF), campanha.md (as notas da campanha)
```

Os testes acham esses arquivos pelos ajudantes `packages/shared/src/testes/privado.ts` (unidade: `arquivoPrivado`,
`temPrivado`, `lerJsonPrivado`) e `e2e/privado.ts` (E2E: os mesmos, mais `exigirPrivado`, que pula o teste). Sem a
pasta, o que depende dela pula e o resto roda: na unidade, `darion` vira uma ficha vazia e só pulam os testes que
conferem os números dele; no E2E, todo teste que cria o Darion (`criarDarion`) ou lê um PDF pula. No computador do
mestre tudo roda. Arquivo pessoal novo para teste vai para `privado/`, nunca para `fixtures/`.

### Os prints

Prints são imagens para o Vilella olhar, **fora do `pnpm verify`**. Config à parte, `playwright.prints.config.ts`:
`testDir: ./prints`, 1 worker, `reuseExistingServer: false` (com a porta ocupada o Playwright reclama em vez de
reaproveitar o servidor de outro) e as mesmas portas 8788/5174. A pasta de saída vem de `PRINTS_DIR`, **obrigatória**
(cada spec de print lança erro sem ela). Para um lote:

```
$env:PRINTS_DIR="C:\...\prints-do-lote"; pnpm --filter @tabletop/e2e prints <lote>
```

O argumento `<lote>` é o nome do spec em `e2e/prints/<lote>.spec.ts`. Cada spec de print copia a montagem do
`r6b.spec.ts` (um `Mesa` com viewport fixo, `/teste/zerar`, cria a cena com os arquivos de teste, tira
`screenshot`). A regra de enxugamento do Vilella (2026-11-11): **só Grimório a 1600×900 e 1280×720 e Pergaminho (claro) a
1600×900**; outros temas só quando o lote mexe em cor. O orquestrador (ou o agente) olha os prints e corrige o que
estiver feio, cortado ou sobreposto antes de entregar. Nunca roda prints junto com testes (mesmas portas). O
`playwright.medidas.config.ts` é um primo: roda só `prints/desempenho.spec.ts` (medições de tarefa de script em
cargas conhecidas, com `MEDIDA_PROD=1` sobre o build minificado).

### O fluxo de trabalho em lotes

Quem trabalha: o Vilella decide o gosto e o plano; um orquestrador (um agente em modelo mais forte) escreve o brief,
revisa e junta; um agente por lote implementa. Em seguida, o passo a passo.

```
brief  ->  worktree  ->  agente implementa  ->  testes só do que tocou
                                                      |
   junção <- commit -F <- revisão (código e prints) <-+ pnpm verify (quando precisa)
   (ff-only em redesign; main acompanha)
```

1. **O brief.** O orquestrador escreve o pedido do lote. Ele traz o objetivo, o que ler antes (`PASSAGEM.md`,
   `REDESIGN.md`, o fim do `ESTADO.md`, as seções do `PROJETO.md`), o que não fazer, e o bloco de regras comuns a todo lote
   (o `regras-dos-lotes-V.md`, que cresce a cada vez que um problema aparece). Dois itens do brief existem por incidente:
   proibir encerrar processos que o agente não iniciou (o `pnpm dev` do Vilella) e exigir migrações novas em vez de
   edições (ver adiante).
2. **Um worktree por lote.** Desde o N1 (2026-11-13) cada lote roda numa cópia separada do repositório (um `git worktree`
   em `.claude/worktrees/agent-<id>`, num branch `worktree-agent-<id>`), para o `pnpm dev` do Vilella só ver código
   commitado. Na cópia: `pnpm install --prefer-offline --frozen-lockfile` antes de tudo, as portas de teste de sempre
   (8788/5174) e **nunca** rodar nada na pasta principal. Dois lotes em paralelo usam `E2E_PORTA_SALA` e `E2E_PORTA_WEB` diferentes.
3. **O que o agente faz.** Implementa **sem commitar**; enquanto trabalha, roda só os specs que tocou
   (`pnpm --filter @tabletop/e2e test tests/<spec>.ts`) e a unidade do pacote mexido; depois de uma falha, roda só o
   spec que falhou. No fim roda a verificação que o lote pede (veja "O `pnpm verify`"), os prints e atualiza os docs. Não
   entrega com nenhum servidor rodando e não edita código durante uma rodada de testes (o Vite roda em modo dev).
4. **O relatório.** Em português, curto: o que entrou; arquivos novos e alterados; mudanças de estado, protocolo e migração;
   E2E antigos alterados ou removidos e o motivo (não se afrouxa asserção); decisões assumidas; o que ficou frágil;
   números do verify (e se houve mudança de código depois dele); a pasta dos prints e o que foi conferido; ações negadas
   por permissão (o agente não contorna uma negação: relata).
5. **A revisão.** O orquestrador lê o relatório, o diff e os prints. Se o verify do agente falhou no fim, **não** se repete
   a bateria inteira (pedido do Vilella, 2026-11-13, depois de um lote refazer 394 testes por causa de 1 falha): corrige,
   roda só os specs que falharam e os que testam a correção, mais typecheck, lint e a unidade do pacote mexido, e diz isso
   no relatório. O orquestrador não repete o verify se o agente não mexeu em código depois do dele.
6. **O commit com `git commit -F`.** Quem commita é o orquestrador. A mensagem vai para um arquivo e o git lê com
   `-F <arquivo>`. Motivo: no Windows PowerShell 5.1, uma mensagem com aspas duplas (por exemplo `"Atalhos do teclado"`)
   passada em `git commit -m` é partida em vários argumentos e o git falha com "pathspec ... did not match" (aconteceu no
   commit do R6a). A mensagem tem um título curto com o código do lote ("AU3c: ..."), um corpo e termina com a linha
   `Co-Authored-By` do modelo.
7. **A junção fast-forward.** O branch do worktree entra no `redesign` com `git merge --ff-only <branch>` (na pasta
   principal) e o `main` acompanha sem trocar de branch, com `git fetch -q . redesign:main` (um fetch local, da própria
   pasta). Se dois lotes correram em paralelo e o `redesign` andou, o orquestrador junta os dois com
   um commit de junção ("Junta o CH3 e o FG2 ao AU3"), que costuma ter conflito **só nos docs** (`ESTADO`, `PASSAGEM`,
   `REDESIGN`, `ROTEIRO-DE-TESTES`): as seções dos lotes ficam todas e sobra uma só linha "Próximo".
8. **Os docs que todo lote atualiza.** No fim do lote, em português, frases curtas, suposições marcadas "(assumido)":
   - `docs/REDESIGN.md`: a seção "<lote> — como ficou (data)" (O que foi feito, Decisões, O que ficou para depois);
   - `docs/ESTADO.md`: a seção "Ajustes <lote> — ... (entregue, aguardando o roteiro manual)" (O que foi entregue,
     Como rodar, Verificação, Decisões, Desvios, Frágil, Roteiro manual) e o "Próximo:" do fim;
   - `docs/PASSAGEM.md`: o que o lote tornou velho; frágeis e suposições novas, com ponteiro;
   - `PROJETO.md`: onde a especificação mudou, com "(<lote>, data)";
   - `docs/ROTEIRO-DE-TESTES.md`: o roteiro manual do Vilella (o que fazer, "→", o que deve acontecer);
   - `docs/PERGUNTAS.md` e `docs/protocolo.md` quando o lote criou ou respondeu pergunta ou mudou o protocolo;
   - `docs/explicacao/` (esta pasta), desde 2026-11-21: o arquivo da área e o `02-decisoes.md`;
   - `docs/IDEIAS.md` para o que foi discutido e não decidido.
   O motivo é do Vilella: o projeto é tocado por agentes que leem esses arquivos antes de cada lote; o que fica só no chat se perde.
9. **O roteiro manual.** O Vilella faz, com os olhos e as mãos, o que o verify não alcança. O lote só está "fechado" depois
   dele (por isso o diário diz "entregue, aguardando o roteiro manual").

### Nada vem da internet em execução

Nenhuma requisição externa em execução (sem CDN, fonte remota ou analytics; fonte nova só empacotada com
`@fontsource`; um E2E vigia). Os commits são pequenos, com um de fechamento por lote.

### Migrações sempre aditivas e o "hot reload no banco real"

`apps/server/src/armazenamento.ts` tem uma lista `MIGRACOES` de funções, e a versão aplicada fica em
`meta.versao_esquema`: `migrar()` roda, em ordem, as que faltam. Regras:

- **Toda mudança de esquema é uma migração NOVA no fim da lista.** Nunca se edita uma migração anterior, nem durante o
  trabalho.
- **Aditiva e idempotente:** o SQLite não tem "ADD COLUMN IF NOT EXISTS", então a migração confere antes com
  `PRAGMA table_info(<tabela>)` e só adiciona o que falta. Com tudo no lugar, não faz nada. Dados novos no estado
  (campo opcional dentro do JSON) não pedem migração.
- Quando o estado antigo precisa virar o novo, a conversão mora em `packages/shared` e roda **ao ler** (`migrarNotasParaHandouts`,
  `migrarSomDoN5`, `migrarFonteAntiga`, `pastas.ts`): vale no banco e em arquivos exportados antigos, com teste de unidade
  da migração. Exportar e importar a mesa tem de continuar funcionando com a versão nova e a antiga.
- **A função nova no caminho de abrir a mesa** (`abrirSocket`, snapshot) tem `try/catch`: se ela falhar, a mesa abre
  de todo jeito.

O motivo é um acidente (2026-11-13, lote 12-1) e se chama **"hot reload no banco real"**. O `pnpm dev` do Vilella
(wrangler em 8787, a mesa **real**) recarrega a pasta de trabalho a cada salvamento. Se um agente salvava um arquivo no
meio do lote, o código **pela metade** passava a rodar sobre a campanha real. No 12-1:

1. uma versão intermediária da migração 14 (a tabela `claude_lotes` sem a coluna `itens`) rodou no banco real;
2. o agente depois editou a mesma migração, e ela **não rodou de novo** (a versão já estava gravada);
3. `abrirSocket` passou a lançar "no such column: itens" e a mesa dele não abria.

O conserto foi uma migração nova (15) que confere as colunas por `PRAGMA table_info` e adiciona as que faltam, mais o
`try/catch` no caminho de abrir a mesa. As três proteções que ficaram: migração só nova; função nova com `try/catch`; e o
**worktree por lote**, para que o `pnpm dev` do Vilella só veja código commitado.

Outro acidente do mesmo tipo (Lote 4, 2026-11-05): um agente encerrou um `pnpm dev` do Vilella porque o brief dizia "no
fim, portas livres", e o hot reload ainda aplicou a migração nova no banco real antes de cair. Daí a regra: **o agente
não encerra processos que não iniciou**; se as portas 8787/5173 estão ocupadas por um `pnpm dev` que não é dele, não
mexe e avisa; no fim, garante só que os processos que **ele** subiu foram encerrados. Os testes e os prints usam 8788/5174,
então não precisam das portas do Vilella. Se um servidor de teste do próprio agente ficar órfão ali, só ele pode ser encerrado.

## Decisões e por quê

- **Uma rodada só e `failOnFlakyTests`** (2026-11-10). Antes eram duas rodadas seguidas do `verify`. Foi descartado: o
  Playwright já repete uma vez o teste que falha e reprova o que só passar na repetição. Teste instável se corrige na causa.
- **Testes enxutos** (2026-11-11). O Vilella: "não faz sentido testar a mesma coisa com tantas baterias e tantas vezes".
  Um lote chegou a rodar 279 repetições e a fazer 203 prints. O texto antigo do `PROJETO.md` (E2E novos rodam também com
  `--repeat-each=3`) e o comentário de `playwright.config.ts` ficaram **velhos**: a regra vigente é **nunca rodar
  `--repeat-each`** (ver "Divergências" no fim).
- **Bateria completa só quando precisa** (2026-11-13). Lote só de tela roda os specs que tocou mais `sala.spec`. O motivo
  é prático: o `verify` completo leva muito e, no notebook fora da tomada, fica uns 80% mais lento e dá timeout falso.
  **Timeout em massa ou "worker exited" não é bug de código**: para e diz isso no relatório, em vez de "corrigir" sem motivo.
- **Se o verify final falha, não repete tudo** (2026-11-13), pelo episódio dos 394 testes refeitos por 1 falha.
- **Prints só em três combinações** (2026-11-11), porque os prints antigos custavam mais do que informavam.
- **Cada lote num worktree** (N1, 2026-11-13): resposta ao hot reload no banco real, que o Vilella aprovou.
- **Estado de teste separado** (`e2e/.estado-sala`, 8788/5174): desde o Lote 1; a regra é que um teste nunca toca a mesa
  real, e as portas são configuráveis para duas cópias rodarem ao mesmo tempo (Q5).
- **Vitest da web sem DOM**: componentes são testados pelo E2E, e a lógica de tela é puxada para arquivos puros. É por
  isso que existem arquivos como `passoDasSetas.ts`, `posicaoDaRegua.ts` e `tour/posicao.ts`.
- **Ouro antes de trocar o motor**: quando o AU1 trocou o motor de ciclos e reações por fluxos, o comportamento atual foi
  gravado primeiro. Foi descartado "conferir à mão": uma campanha de 10 minutos com sorteios só se confere por igualdade exata.
- **Câmera falsa por arquivo**: ver "A câmera falsa por arquivo Y4M".

## Os trechos complexos

### 1. O estado limpo de cada teste: `zerado`, semente e `MODO=teste`

**Problema.** Um E2E com vários jogadores e uma sala de verdade só é confiável se todo teste começa do mesmo ponto, sem
que o teste anterior deixe contas, presença, sons tocando, agenda ou memória no processo da sala.

**Como o código resolve.** A fixture automática `zerado` faz `POST /teste/zerar`. Na sala (`rotaDeTeste`): apaga o banco e as
contas, **cancela o alarme** (`deleteAlarm`) e marca o uso para ser agendado de novo, recria `this.estado =
estadoInicial(semente)`, limpa os limitadores e os baldes, a caixa de entrada, os pedidos de envio e a presença do Claude,
fecha os sockets do Claude (os tokens morreram com as contas), grava o estado novo e reinicia o relógio. Quem **já estava
conectado** continua membro (marcado como presente de teste, porque o login solto não se repete depois do reset) e recebe
um snapshot novo; quem já não tem usuário é fechado. Por fim difunde a presença.

**Frágil.** Se uma estrutura nova da sala guarda estado em memória (um `Map`, um temporizador), `zerar` precisa limpá-la,
senão um teste vaza para o seguinte e o sintoma é "instável" muito longe da causa. Foi o motivo de várias linhas de
`rotaDeTeste` existirem. Testes que cobrem: `sala.spec.ts` ("exportar → zerar → importar devolve tudo igual") e, de
fato, toda a suíte, que depende disso.

### 2. Sala de teste e `pnpm dev` ao mesmo tempo: portas e estado

**Problema.** O Vilella joga a campanha real em 8787/5173 enquanto um lote roda testes e prints. Se os testes reaproveitassem
um servidor já aberto, ou gravassem no estado real, estragariam a campanha.

**Como o código resolve.** O estado do teste é outro diretório (`--persist-to ../../e2e/.estado-sala`); as portas são outras;
`e2e/portas.ts` é a única fonte, lida pelo config do Playwright, pela sala e pelo Vite. `reuseExistingServer` no config de
testes é `!process.env.CI` (pode reaproveitar um servidor de teste que **já esteja** na 8788, útil para depurar com
`pnpm dev:e2e`), mas nos configs de prints e de medidas é `false`: um servidor antigo escondendo código novo faria o
print mostrar o app velho. O Vite do E2E (`vite --mode e2e`) é o que liga os ganchos de teste.

**Frágil.** Um servidor de teste órfão na 8788 trava o `verify` seguinte (já aconteceu: um agente subiu `pnpm dev:e2e` à
mão para os prints e o `taskkill` foi negado). Por isso os prints são tirados por um teste que usa o `webServer` (sobe e
derruba sozinho), nunca por um `pnpm dev:e2e` manual; e antes de um `verify` conferir se 8788/5174 estão livres.

### 3. A prova de sigilo: o que o jogador recebeu

**Problema.** O Távola é "como se um dia os jogadores entrassem pela internet": tudo que é segredo do mestre (handout
oculto, token escondido, notas) nunca pode chegar ao navegador do jogador. Olhar a tela não prova isso, porque o dado pode
chegar e só não ser desenhado.

**Como o código resolve.** A classe `Mesa` registra, por contexto, todo frame de WebSocket enviado e recebido
(`pagina.on("websocket", ...)` com `framereceived`/`framesent`). O teste cria o segredo como mestre com uma marca única
(`SEGREDO-ULTRA-1`), espera o **mestre** receber (`expect.poll(() => mestre.frames.some(...))`, que é o controle de que
a captura funciona) e então percorre todos os frames do jogador e exige que nenhum contenha a marca. A mesma ideia vale
para binários (`binarios`), usada pelos testes de assets para procurar o início de um arquivo no tráfego alheio.

**Frágil.** Se o teste não tem o controle, ele passa mesmo se a captura estiver quebrada. O filtro mora na sala
(`visaoPara`/`eventoPara`); testes de unidade em `packages/shared` (`nucleo.test.ts`) cobrem o filtro puro, e o E2E cobre a
sala real. Toda intenção nova declara a capacidade exigida e, se cria dado secreto, ganha um teste assim.

### 4. A tabela de paridade com o Claude

**Problema.** O Claude (via MCP) deve conseguir fazer tudo o que a tela faz (M2, Q16), mas uma intenção nova pode ser
esquecida no MCP.

**Como o código resolve.** `packages/shared/src/mcp/paridade.ts` é um `Record<TipoIntencao, ...>`: **sem a entrada, nem
compila**. Cada intenção aponta a ferramenta e o campo do MCP que a alcança, ou o motivo de ficar de fora (proibida ao
Claude, transporte, gesto ao vivo). `paridade.test.ts` confere que a ferramenta e o campo apontados **existem** de
fato nos esquemas de `TODAS_AS_FERRAMENTAS`; `paridadeCampos.test.ts` faz o mesmo campo por campo, recursivamente. Regra
de ouro: preparar, configurar e conduzir a mesa ganham ferramenta; segurança, conexão e gesto de tela ficam de fora com
motivo escrito.

**Frágil.** Mudar o nome de um campo do esquema sem mexer na tabela quebra o teste (de propósito).

### 5. Teste de contraste dos temas como teste de unidade

Um caso bonito de transformar uma regra visual em teste: `tema/temas.test.ts` calcula a luminância relativa (WCAG) de cada
token e exige 4,5:1 em **toda lista de pares de texto e fundo que a interface usa de fato** (`PARES`) para cada um dos 14
temas, 3:1 do anel de foco contra todas as superfícies, e que o polegar da barra de rolagem se distingue do trilho. Um
token novo que viola o contraste falha o teste, em vez de ser descoberto por olho no print. É por isso que o lote de
tema deixa de ser "gosto" e passa a ter um piso objetivo.

### 6. Um teste de interface que não cola no tamanho de pixel (A1)

`a1.spec.ts` não confere "a caixa tem 36 px". Ele **provoca** o problema: estreita o pai do par (`style.width`) até o
rótulo mais comprido quebrar em duas linhas e confere que o topo e a altura das duas caixas diferem no máximo 1 px.
Assim o teste vale para o próximo campo que alguém acrescentar ao par, e quebra se alguém trocar o `subgrid` por
altura fixa. Esse é o padrão: o teste descreve a regra ("alinhados"), não a medida.

## Divergências que o próprio repositório ainda carrega

- `PROJETO.md` seção 9, item 2, e o comentário de `e2e/playwright.config.ts` ainda dizem que os E2E novos rodam também com
  `--repeat-each=3`. A regra do Vilella de 2026-11-11 (e as regras dos lotes) é **não rodar `--repeat-each`**.
- A seção "Fluxo de trabalho" do `docs/ESTADO.md` (Lote 0) fala em "um branch `lote-N` por lote", entrando no `main` por
  fast-forward quando o próximo é liberado. Hoje o branch é o de um worktree (`worktree-agent-<id>`), a junção é no
  `redesign` e o `main` acompanha por `git fetch -q . redesign:main`. Os branches `lote-N` ainda existem no repositório.

## Para ir além

- `../../PROJETO.md`: seção 6 (como rodar e verificar), seção 9 (como trabalhar com IA) e seção 10 (decisões).
- `../ESTADO.md`: "Fluxo de trabalho", "Isolamento do E2E" e o "Ajustes Q5" (portas configuráveis); o fim do arquivo
  mostra o formato de cada lote.
- `../PASSAGEM.md`: seção 1 (como subir a mesa para olhar) e os frágeis de cada lote.
- `../REDESIGN.md`: R6b e V3/V5 trazem as decisões de testes e prints de cada época.
- `../ROTEIRO-DE-TESTES.md`: o roteiro manual.
- `11-interface-temas-e-janelas.md`: o que os testes de tema, tour e janelas vigiam.
