# Estado do projeto

## Lote 0 — Fundação do repositório (entregue)

> Nota: o Playwright deixou de reaproveitar o `pnpm dev` no Lote 1 (ver "Isolamento do E2E" abaixo).

Esqueleto que compila, testa e sobe localmente. Nada de domínio ainda (sem zod, usuários, mapa).

### O que foi entregue

- Monorepo pnpm: `apps/web`, `apps/server`, `packages/shared`, `e2e` (`@tabletop/web`,
  `@tabletop/server`, `@tabletop/shared`, `@tabletop/e2e`), tudo ESM.
- TypeScript estrito (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`) em `tsconfig.base.json`, `moduleResolution: "bundler"`.
- `@tabletop/shared` exporta o código-fonte TS direto (`exports: "./src/index.ts"`), sem build.
- Biome (lint + format) na raiz.
- Vitest nos três pacotes; Playwright em `e2e/`.
- Servidor: Worker + Durable Object `Sala` (SQLite) de eco com a WebSocket Hibernation API.
- Web: React + Vite; página única com `data-testid="status-conexao"` (`conectando`, `conectado`,
  `desconectado`) e campo de texto com o eco em `data-testid="eco"`.
- `docs/protocolo.md` (protocolo v0).

### Como rodar

Requisitos: Node 22+ (testado na 24), pnpm, Chrome.

- `pnpm install`
- `pnpm dev`: sobe o wrangler (`127.0.0.1:8787`) e o Vite (`127.0.0.1:5173`) juntos (via `concurrently`).
  Abra `http://127.0.0.1:5173`.
- `pnpm verify`: typecheck + lint + testes de unidade + E2E.
- Também: `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm test:e2e`.
- Estado local da sala: `apps/server/.wrangler/state` (fora do git; apagar zera a campanha).

### Portas fixas

| Serviço | Endereço |
|---|---|
| wrangler dev (sala) | `127.0.0.1:8787` |
| Vite (front) | `127.0.0.1:5173` (`strictPort: true`) |

Definidas em `packages/shared/src/constantes.ts` (Vite) e `apps/server/wrangler.jsonc` (wrangler).
Se uma porta estiver ocupada, o `pnpm dev` falha em vez de trocar de porta.

### Decisões

- **Biome** como única ferramenta de lint e format.
- **Playwright** usa o Chrome instalado (`channel: "chrome"`): nenhum browser é baixado.
  `webServer` sobe `pnpm dev` na raiz e espera o Vite; `reuseExistingServer: !process.env.CI`.
  Workers = 1 (as portas são fixas e há uma sala só).
- **Tipos do Worker:** `wrangler types` gera `apps/server/worker-configuration.d.ts`, commitado.
  Regenerar com `pnpm --filter @tabletop/server types` ao mudar o `wrangler.jsonc`.
- **Wrangler:** `compatibility_date` `2026-11-03` (a do workerd 1.20261103.1 instalado),
  `send_metrics: false`, migração `new_sqlite_classes: ["Sala"]`.
- **Importações no `shared` com extensão `.ts`** (`allowImportingTsExtensions`): o Vite carrega o
  `vite.config.ts` pelo Node, que não resolve imports sem extensão no código-fonte do pacote.
- **pnpm `onlyBuiltDependencies`** (`esbuild`, `workerd`) em `pnpm-workspace.yaml`, para o pnpm 10
  rodar os scripts de instalação desses dois.
- **`.gitattributes`:** `* text=auto eol=lf` e `*.pdf binary`.

### Versões principais

pnpm 10.34.9 · Node 24.11.1 · TypeScript 7.0.2 · Biome 2.6.5 · wrangler 4.157.0 (workerd 1.20261103.1)
· Vite 8.3.5 · React 19.3.1 · Vitest 5.1.0 · Playwright 1.64.1 · concurrently 10.0.6.

### Desvios do plano e pontos a avaliar

- **Testes do servidor sem o pool de workers da Cloudflare** (`@cloudflare/vitest-pool-workers`): o
  teste atual é só de lógica pura, em Node. **Avaliar no Lote 1**, quando houver lógica dentro do
  Durable Object (SQLite, alarmes) para testar.
- O `tsconfig` do `apps/server` não usa `@types/node`; só os tipos gerados pelo wrangler.
- Ruído conhecido: o proxy do Vite loga `ws proxy error: write ECONNABORTED` no Windows quando o
  navegador fecha um WebSocket que ele ainda está repassando. Em dev isso acontece já no carregamento,
  porque o StrictMode do React monta o efeito duas vezes e descarta o primeiro socket (o `useSala`
  ignora os eventos do socket descartado). É inofensivo e não afeta os testes.
- O roteiro manual "offline" (desligar a internet e repetir) deve ser feito pelo Vilella; o app não
  referencia nada externo (sem CDN, fonte remota ou analytics).

### Revisão (antes do commit de fechamento)

- `useSala` ignora eventos de socket descartado: o StrictMode do React monta o efeito duas vezes, e o
  `close` do primeiro socket podia chegar depois do `open` do segundo e mostrar "desconectado".
- O cabeçalho `Upgrade` é comparado sem diferenciar maiúsculas (`pedeWebSocket`).
- `@types/node` alinhado com o Node 24.
- `pnpm verify` refeito: verde. `pnpm dev` também conferido fora do Playwright (Vite responde e a sala
  responde `ok` em `/saude`).

### Pendências

- **Roteiro manual** (Vilella): o Vilella liberou seguir para o Lote 1 em 2026-11-05; a página foi
  vista funcionando, mas o teste com a internet desligada não foi confirmado.

### Fluxo de trabalho

- Cada lote num branch `lote-N`; quando o próximo lote é
  liberado, o anterior entra no `main` por fast-forward.
- Implementação feita por agente; revisão do código e `pnpm verify` refeitos antes de cada commit de
  fechamento.
- Ideias não decididas e notas da campanha de referência ficam em `docs/IDEIAS.md`.

## Lote 1 — Sala, papéis e sincronização (entregue)

A sala virou autoritativa: usuários, papéis, capacidades, presença, SQLite, reconexão, contador de
uso e exportar/importar. A entidade de teste são duas notas: **nota da mesa** (todos veem) e **nota do
mestre** (só mestres). Protocolo completo em `docs/protocolo.md`.

### O que foi entregue

- **`packages/shared`** (lógica pura, com testes; zod 4): `capacidades.ts` (`pode`, listas, padrões),
  `estado.ts` (tipos e schemas), `protocolo.ts` (`VERSAO_PROTOCOLO = 1`, intenções, eventos,
  mensagens da sala, exportação, `capacidadeDaIntencao`), `nucleo.ts` (`processar`, `reduzir`,
  `visaoPara`, `eventoPara`, `criarExportacao`, `lerExportacao`), `semente.ts`, `uso.ts`.
- **`apps/server`**: Worker com rotas (`/saude`, `/api/usuarios`, `/api/entrar`, `/api/sair`, `/api/eu`,
  `/ws`) e `Autenticacao`/`AutenticacaoDev` (cookie `tabletop_usuario`); Durable Object `Sala`
  (`sala.ts`), `Armazenamento` (SQLite com migrações versionadas) e `Agendador` (fila no SQLite + um
  único `setAlarm`).
- **`apps/web`**: tela de entrada, mesa (papel, presença, nota da mesa, nota do mestre), painel do
  mestre (papéis, capacidades com padrão e exceção por usuário, uso de hoje, exportar/importar),
  reconexão com backoff (0,5 s dobrando até 10 s, com jitter), avisos de erro, rascunho no
  `localStorage`.
- **`fixtures/campanha.seed.json`**: `mestre` e `jogador-1`..`jogador-7`. Só é aplicado com o banco vazio.
- **E2E isolado**: ver abaixo.

### Como rodar

- `pnpm dev`: igual ao Lote 0 (sala em `127.0.0.1:8787`, front em `127.0.0.1:5173`, estado em
  `apps/server/.wrangler/state`). Abra `http://127.0.0.1:5173` e escolha um usuário. Várias pessoas na
  mesma máquina: use perfis ou janelas anônimas do Chrome (o cookie é por navegador).
- `pnpm verify`: typecheck + Biome + unidade + E2E.
- `pnpm dev:e2e`: sobe só os servidores do E2E (sala `8788`, front `5174`, estado em
  `e2e/.estado-sala`, `MODO=teste`), útil para depurar um teste.
- A campanha real é zerada apagando `apps/server/.wrangler/state`.

### Isolamento do E2E

O Playwright **não** usa mais o `pnpm dev`. Ele sobe dois `webServer` próprios:
`wrangler dev --port 8788 --persist-to ../../e2e/.estado-sala --var MODO:teste` e `vite --mode e2e`
(portas de `apps/web/.env.e2e`: `TABLETOP_PORTA_WEB=5174`, `TABLETOP_PORTA_SALA=8788`). O `vite.config.ts`
lê essas variáveis (ambiente ou `.env.<modo>`) e, sem elas, usa 5173/8787. As rotas `POST /teste/zerar`
(apaga o estado do DO e reaplica o seed) e `POST /teste/reiniciar-sala` (`ctx.abort()`) só existem com
`MODO=teste`: o `wrangler.jsonc` não define `MODO` e o `pnpm dev` não passa `--var`; conferido que
`POST /teste/zerar` no `pnpm dev` devolve 404. Cada teste chama `/teste/zerar` antes de rodar.
Os números das portas do E2E estão repetidos em `e2e/playwright.config.ts`, `apps/web/.env.e2e`,
`apps/server/package.json` (`dev:e2e`) e `packages/shared/src/constantes.ts`.

### Decisões

- **`assistente`** existe no tipo `Papel`, mas não pode nada e não aparece na interface; o schema de
  `papel.alterar` só aceita `mestre` e `jogador`.
- **`Permissoes.jogadores` só tem capacidades delegáveis** (no PROJETO.md 4.1 é `Record<Capacidade, boolean>`):
  as exclusivas do mestre não são configuráveis. Capacidades novas de lotes futuros entram com o
  padrão (`PERMISSOES_PADRAO`) ao carregar do SQLite **e ao importar** um arquivo exportado antes delas.
- **`campanha.importar { dados }`**: `dados` é o arquivo de exportação inteiro (com `formato`, `versao`,
  `exportadoEm`). A importação recusa se quem importa não for mestre na campanha importada.
- **`processar` devolve** `{ estado, eventos, snapshotPara, exportacao? }`. Mudança de papel: a pessoa
  recebe snapshot novo em vez do evento; importação: snapshot para todos, sem eventos.
- **`seq` com saltos para jogadores** (documentado no protocolo): o cliente ignora eventos com `seq` já
  refletido e confia no snapshot ao reconectar.
- **Presença derivada**: `online` = tem socket aberto (lido de `ctx.getWebSockets()`); `reconectando` =
  existe vencimento `presenca.expirar` no agendador; senão `offline`. Nada de presença em variável.
- **Agendador**: tabela `agenda(tipo, chave, quando, dados)`; agendar o mesmo `tipo`+`chave` substitui.
  O alarme sempre aponta para o próximo vencimento; um disparo sem nada vencido é inofensivo.
  Serve a presença (10 s) e ao envio atrasado do `uso` aos mestres.
- **Uso**: contadores em memória, gravados no SQLite a cada 50 mensagens, a cada conexão e na virada do
  dia UTC (um reinício perde no máximo ~50 mensagens do contador). Mostrado como "uso de hoje: X%".
- **Migrações**: sem `PRAGMA user_version`; a versão do esquema fica em `meta.versao_esquema`
  (`meta` é criada fora das migrações). Para acrescentar uma, adicione uma função ao fim de `MIGRACOES`
  em `armazenamento.ts`.
- **Rascunho**: chave `tabletop:rascunho:<usuarioId>:<campo>`. Digitar grava na hora; envia 300 ms depois;
  o rascunho some quando a sala confirma (evento com o `idPedido` do envio) ou recusa. Ao conectar, um
  rascunho que sobrou é reenviado (ou descartado se já é igual ao da sala ou se perdi a permissão).
  Duas pessoas editando a mesma nota ao mesmo tempo: vale a última a chegar na sala (sem fusão de texto).
- O front só decide pela tela de entrada perguntando a `/api/eu` (o cookie é `HttpOnly`). Se o socket
  cai e `/api/eu` responde 401, volta para a entrada em vez de insistir.

### Testes

- **`@cloudflare/vitest-pool-workers` não foi adotado**: a versão atual (0.23.0) exige Vitest `^4.1`
  e o projeto usa o Vitest 5.1, então não é compatível. Em vez de forçar ou rebaixar o Vitest, a lógica
  fica pura em `shared` (testada em Node) e o Durable Object (SQLite, hibernação, alarme, reinício) é
  coberto pelo E2E contra o workerd real. Reavaliar quando o pool suportar Vitest 5.
- Unidade: `shared` (schemas, matriz de `pode`, exceções, último mestre, filtros por papel,
  `reduzir`, exportar → importar, importação inválida, uso), `server` (cookie de autenticação), `web`
  (backoff).
- E2E (`e2e/tests/sala.spec.ts`): tela de entrada e 401 sem cookie; 8 contextos com propagação para os
  outros 7; refresh (inclusive rascunho no `localStorage`); reinício da sala (espera um socket novo em
  cada página); capacidade desligada (campo desabilitado + `sem_permissao` forçando o envio) e exceção
  por usuário; mensagem inválida sem derrubar a conexão; promoção a mestre e último mestre; frames
  recebidos por um jogador sem a nota do mestre nem exceções alheias (com controle positivo no mestre);
  uso só para mestres; presença `reconectando` → `offline` pelo alarme (~10 s); exportar → zerar →
  importar (compara o JSON exportado antes e depois); importação inválida.

### Pontos frágeis / não verificados

- **Reinício real do processo**: `/teste/reiniciar-sala` usa `ctx.abort()` (esquece a memória e derruba
  os sockets). Não foi testado derrubar o processo do wrangler inteiro (é o item do roteiro manual).
- **Roteiro manual** (Vilella): 3 perfis do Chrome (mestre + 2 jogadores); fechar e reabrir abas; parar e
  subir o `pnpm dev`; conferir que nada se perde e que o "uso de hoje" aparece para o mestre.
- Depois de reiniciar o processo, quem estava `online` passa a `offline` até reconectar (a sala não
  guarda a presença; só o `reconectando` de 10 s depende de um fechamento observado).
- Ruído conhecido do Lote 0 (`ws proxy error: write ECONNABORTED` no log do Vite) continua e é inofensivo.
- Sem limite de tamanho além de 20 000 caracteres por nota; a importação inteira vai numa mensagem
  WebSocket (limite de 1 MiB do workerd): campanhas grandes precisarão de outro caminho (por exemplo
  `POST` HTTP) em lote futuro.
- Autenticação de dev: quem escolhe o mestre na tela de entrada é mestre (seção 4.6 do plano).

### Revisão (antes do commit de fechamento)

- **`seq` não volta na importação**: importar um arquivo mais antigo fazia o `seq` recuar e reaproveitar
  números já enviados. Agora fica no maior entre o atual e o do arquivo (teste novo).
- **Importação tolerante a capacidades novas**: o schema exigia todas as capacidades delegáveis no
  arquivo, então uma exportação de hoje seria recusada depois que um lote criasse outra. Agora a que
  falta entra com o padrão, como no carregamento do SQLite (teste novo).
- `pnpm verify` rodado **duas vezes seguidas**, verde nas duas (49 testes de unidade, 13 E2E em ~52 s),
  para descartar sorte de timing nos testes com 8 navegadores e reconexão.
- **Página aberta antes de a sala subir** (achado no roteiro manual): no `pnpm dev` o Vite fica pronto
  em ~0,3 s e o wrangler em ~5 s. A página que carregava nesse intervalo (inclusive a aba já aberta,
  que o Vite recarrega sozinho quando volta) recebia 5xx do proxy em `/api/eu` e mostrava um erro sem
  tentar de novo. Agora `/api/eu` e `/api/usuarios` repetem com o mesmo backoff da reconexão enquanto
  a sala estiver indisponível (rede ou 5xx), mostrando "Conectando à sala…"; 4xx continua sendo
  resposta definitiva (`comRetentativa` em `apps/web/src/api.ts`, com testes).
- Lembrete do roteiro: a mesa só existe enquanto um terminal mantém o `pnpm dev` rodando.

### Roteiro manual

Feito pelo Vilella em 2026-11-05 com 3 perfis do Chrome (Mestre, Jogador 1, Jogador 2): papéis,
presença (online / reconectando / offline), nota da mesa sincronizada e nota do mestre visível só
para o mestre. Na mesma conversa ele definiu o estilo da interface (PROJETO.md 4.13), que entra no
Lote 2.

### Sugestões para o PROJETO.md

Aplicadas na revisão: tipos de capacidade e `Permissoes` (4.1), saltos e monotonia do `seq` (4.2),
isolamento do E2E e `pnpm dev:e2e` (6), redação do teste de reinício no Lote 1 e modelo do teste de
frames (9).

## Lote 2 — Mapa, grid e tokens (entregue)

Mesa visual: o mapa (PixiJS v8) ocupa a tela, com tokens sincronizados e a casca da interface do
PROJETO.md 4.13. Não há imagem de mapa nem de token ainda (Lote 3): fundo escuro liso com o grid e tokens
que são um círculo colorido com as iniciais do nome, gerados em código. Protocolo em `docs/protocolo.md`.

### O que foi entregue

- **`packages/shared`** (puro, testado): `Cena` e `Token` em `estado.ts`; `mapa.ts` (`CENA_PADRAO`,
  `tokenVisivelPara`, `podeMoverToken`, `encaixarNoGrid`, `limitarNaCena`, `medirRegua`, `suavizar`);
  `limitador.ts` (`criarLimitador`, 20/s com trailing); novas intenções, eventos e a mensagem
  `token.movendo` em `protocolo.ts`; `nucleo.ts` com as regras, o filtro de sigilo
  `eventoPara(evento, usuario, antes, depois)` e `visaoPara` filtrando tokens; capacidade `cena.editar`
  (só do mestre); exportação v2 que ainda aceita a v1.
- **`apps/server`**: `Armazenamento` grava cenas e tokens (coleções `cenas` e `tokens` em `entidades`,
  `meta.cena_ativa`); banco do Lote 1 sem cena ganha a cena padrão ao carregar (sem migração e sem perder
  nada); `Sala` repassa `token.movendo` só a quem pode ver o token (menos o remetente) e passa o estado de
  antes e de depois ao filtro de eventos.
- **`apps/web`**: `Mesa.tsx` (layout), `mapa/mapaPixi.ts` (controlador imperativo do Pixi) e
  `mapa/Mapa.tsx` (ponte React), `BarraDeFerramentas`, `ZoomFlutuante`, `BarraLateral` (abas Jogadores,
  Notas, Mestre, Configurações), `PainelDoToken`, `abas.tsx`, `preferencias.ts`. Tema escuro com
  variáveis CSS (neutro + âmbar); ícones `lucide-react`; nada de CDN ou fonte remota.
- **`fixtures/campanha.seed.json`**: cena `cena-1` (60 × 45 m, quadrado de 1,5 m) e 6 tokens:
  `tok-jogador-1..3` (Aldric, Brisa, Cael; cada um controlado pelo jogador de mesmo número), `tok-ogro`
  (visível, tamanho 2), `tok-goblin-oculto` ("Goblin Emboscado", oculto) e `tok-marcador-mestre`
  ("Marcador Secreto", camada do mestre).
- **Testes**: unidade (limitador, encaixe, régua, posição na cena, suavização, quem move, sigilo de
  snapshot e de eventos, transições visível ↔ invisível, exportação v2 e importação v1) e
  `e2e/tests/mapa.spec.ts`.

### Como rodar

- `pnpm dev` e `pnpm verify`: como antes. Atalhos no mapa: **V** selecionar, **H** mão, **R** régua; roda do
  mouse = zoom no cursor; botão do meio ou **espaço** + arrastar = pan; **Alt** ao arrastar um token solta
  sem encaixe; **Esc** limpa a régua.
- O mestre cria tokens pelo botão "Novo token" (na camada de trabalho escolhida), clica num token para
  editar (painel flutuante) e arrasta para mover. O grid da cena fica na aba Mestre.
- **Banco existente** (quem já rodou o Lote 1): nada a fazer. Mas a **semente só vale com o banco vazio**:
  para ver os tokens de teste numa campanha já criada, apague `apps/server/.wrangler/state` (zera a
  campanha) ou crie tokens à mão.

### Verificação

`pnpm verify` verde (rodado duas vezes seguidas): 87 testes de unidade em `shared` (eram 49 somando os três
pacotes no Lote 1; `shared` agora tem sozinho 87), 3 em `server`, 6 em `web` e 21 E2E (13 do Lote 1 + 8 de
`mapa.spec.ts`) em ~2 min.

### Gancho de teste (só no modo `e2e`)

O canvas não é DOM. Com `import.meta.env.MODE === "e2e"` (`vite --mode e2e`, usado pelo Playwright) o
controlador instala `window.__tabletop` com `tokens()` (posições na tela do mapa, só os tokens visíveis para
quem está logado), `paraTela(x, y)` (metros → pixels da página, para o `page.mouse`), `zoom()`,
`definirZoom`, `centrarEm`, `quadradoM()` e `ferramenta()`. No `pnpm dev` e no build normal ele não existe
(o `MODE` é `development`/`production`). A régua tem rótulo em DOM (`data-testid="regua-rotulo"`).

### Decisões

- **Posição fora da cena é limitada à borda** (não recusada): arrastar até a borda não gera erro a cada
  mensagem. Vale para `token.criar`, `token.mover` e `token.soltar`.
- **Token invisível para quem pergunta responde `token_inexistente`** (igual a um id que não existe), em vez
  de `sem_permissao`: a resposta não confirma que o goblin existe.
- **`token.soltar` sempre grava e emite `token.movido`**, mesmo se a posição não mudou: quem viu o movimento
  ao vivo (`token.movendo`) precisa da posição final exata. O cliente só envia `soltar` se o token saiu do lugar.
- **`token.editado` carrega o token inteiro** e o cliente faz upsert; é o mesmo evento para "continua
  visível" e "passou a ser visível". `token.sumiu { id }` só nasce no filtro (nunca é emitido por intenção).
- **`eventoPara(evento, usuario, antes?, depois?)`** falha fechada: sem o estado, o jogador não recebe
  evento de token.
- **Limitador**: envia na hora se já passou 50 ms do último envio; senão guarda só o mais recente e o envia
  quando vencer o intervalo (trailing). O cliente também não reenvia a mesma posição (com encaixe, o token só
  "anda" de célula em célula). Em 5 s saem no máximo 101 `token.mover` (o E2E aceita até 110).
- **Interpolação**: suavização exponencial com constante de 70 ms (`suavizar`), no ticker do Pixi; no
  `token.movido` o token encosta exatamente na posição final. Quem arrasta não interpola. A posição do
  estado só reposiciona o token quando **mudou** (não atropela o movimento ao vivo de outro token).
- **Régua**: pontos inicial e final encaixam no centro da célula (Alt solta); os quadrados são os do maior
  eixo (5e 2014); a medida continua na tela até Esc, nova medição ou troca de ferramenta.
- **Selecionar**: o mestre só seleciona tokens da camada de trabalho; o jogador não "seleciona" nada, só
  arrasta o que controla. Alvo de clique mínimo de 12 px na tela (tokens pequenos em zoom baixo).
- **`status-conexao`** continua no DOM sempre (visualmente oculto, classe `so-leitor`) com os mesmos
  textos, porque os testes dependem dele; o selo visível só aparece quando não está `conectado`.
- **Abas**: todos os painéis ficam montados e só o ativo aparece (o campo de nota mantém rascunho e
  confirmação ao trocar de aba). O papel dos usuários (`papel-<id>`) foi para a aba Jogadores (só o mestre);
  as capacidades, o uso, o grid e exportar/importar ficam na aba Mestre. O `data-testid` das seções das abas
  é `aba-painel-<id>` (para não colidir com `painel-mestre`). Os 13 E2E do Lote 1 só ganharam `abrirAba(...)`.
- **Barra lateral flutuante** (não ancorada): o mapa ocupa a tela inteira por baixo; o zoom flutuante fica à
  esquerda dela e muda de lugar quando ela recolhe.
- **O mestre move qualquer token** que consiga selecionar na camada de trabalho (o filtro de camada é só de
  seleção na interface; a sala deixa o mestre mover tudo).
- **Desenho sob demanda**: o Pixi não usa o ticker automático; um laço de `requestAnimationFrame` anima os tokens
  e só chama `render()` quando algo mudou (`sujo`). Com o ticker contínuo, os 8 navegadores do E2E de 8 contextos
  estouraram o tempo (WebGL por software); agora esse teste leva ~13 s.
- **Preferência de encaixe** em `localStorage` (`tabletop:pref:encaixe`, padrão ligado), na aba Configurações.

### Desvios do plano e pontos a avaliar

- Nenhum desvio do desenho pedido. O `Token` não tem `personagemId` nem `assetHash` (Lotes 3 e 4) e a `Cena`
  não tem `mapa` nem `luzAmbiente` ainda.
- A cena não guarda `pxPorQuadrado` (PROJETO.md 4.1): o mapa usa 40 px por metro fixos no cliente; isso só
  passa a importar com imagem de mapa (Lote 3).

### Pontos frágeis / não verificados

- ~~Quem arrasta e cai no meio do movimento~~: resolvido na revisão (ver abaixo).
- **WebGL**: o Pixi roda em WebGL (`preference: "webgl"`). No Chrome do E2E (headless) funciona; em máquina
  sem WebGL o mapa não sobe (erro no console). Sem fallback de Canvas 2D.
- **Aparência não coberta por teste automático**: olho cortado do token oculto, transparência (oculto 50 %;
  camada do mestre 45 % quando se trabalha na camada de tokens), anel de seleção, rótulo de nome. Conferir
  no roteiro manual.
- **Alt ao arrastar** foi testado com o Alt do Playwright (headless). No Chrome do Windows com janela, soltar
  o Alt pode ativar a barra de menus do navegador; não verificado.
- **Dois mestres arrastando o mesmo token**: vale o último `soltar`.
- O pacote do front cresceu com o PixiJS (o aviso de chunk grande do Vite no build é esperado).
- Cada `token.mover` conta como mensagem recebida (1/20 de requisição). Uma sessão com arraste constante de
  vários jogadores deve ser acompanhada no "uso de hoje".
- **Roteiro manual** do Lote 2 (PROJETO.md 7): mover tokens em 2 perfis ao mesmo tempo, esconder um token e
  conferir no F12 do jogador (aba Network → WS) que ele não chega, medir 3 quadrados (= 4,5 m) com a régua.

### Revisão (antes do commit de fechamento)

- **Arraste abandonado**: se quem arrasta fechava a aba (ou caía) antes do `token.soltar`, os outros ficavam
  vendo o token numa posição que não existe na sala. Agora a sala guarda em memória os tokens que cada socket
  está arrastando e, quando o socket fecha, manda aos outros um `token.movendo` com a posição gravada. E2E
  novo ("quem fecha a aba no meio do arraste…"); conferido que ele **falha** com a correção desligada.
- **Token que some durante o meu arraste** (o mestre esconde ou apaga): o cliente continuava mandando
  `token.mover` de um token que a sala diz não existir, e cada um voltava como aviso de erro. Agora o arraste
  acaba quando o token some do mapa.
- `pnpm verify` duas vezes seguidas, verde nas duas: 96 testes de unidade (87 shared, 3 server, 6 web) e
  22 E2E (~1,8 min).
- **Aparência conferida por print** (mestre e jogador, servidores de teste): ferramentas à esquerda, zoom
  flutuante, barra lateral com abas, tema escuro com acento âmbar; o mestre vê o goblin oculto (semitransparente,
  olho cortado) e o marcador da camada do mestre; o jogador não vê nenhum dos dois. Ajuste fino pendente: no
  zoom inicial (~43 %) os nomes embaixo dos tokens ficam pequenos demais para ler.
- **Campanha local de quem já rodou o Lote 1**: a semente só vale com o banco vazio, então a campanha do
  `pnpm dev` ganha a cena padrão mas nenhum token de teste. Para vê-los, apagar `apps/server/.wrangler/state`
  (zera a campanha) ou criar tokens pelo botão "Novo token".

### Roteiro manual

Parcial, feito pelo Vilella em 2026-11-05: o mestre criou e editou tokens pelo painel (nome, cor, tamanho,
camada, oculto, quem controla) no `pnpm dev`. Ele liberou o Lote 3 dizendo que **vai corrigir a interface
depois**. Ajustes vistos no print dele, para essa revisão:

- no zoom de ~24 % os tokens viram pontinhos e o nome some (o zoom inicial enquadra a cena inteira);
- o painel do token flutua por cima do mapa, cobrindo parte dele;
- numa janela de ~1000 px a barra lateral ocupa quase um terço da largura;
- (já anotado) nomes embaixo dos tokens ilegíveis em zoom baixo.

### Sugestões para o PROJETO.md

Aplicadas na revisão (4.1, 4.2, 4.4, 4.5, seção 9 e "Depois"). Texto original do agente:

- 4.1: atualizar `Token` para `{ id, cenaId, nome, cor, tamanhoQuadrados, x, y, camada, oculto, controladoPor }`
  (acrescentar `personagemId`/`assetHash` nos Lotes 3 e 4) e `Cena.grid` para `{ quadradoM, visivel }`
  (`pxPorQuadrado` só quando houver imagem). Acrescentar `cena.editar` a `CapacidadeDoMestre`.
- 4.2: registrar `token.movendo` (sala → cliente, transitório) e que `token.mover`/`token.soltar` exigem
  `token.moverProprio` mais a regra "controla e vê"; incluir `token.sumiu` e os códigos `token_inexistente` e
  `dados_invalidos`; e que a exportação passou à versão 2 (a v1 continua aceita).
- 4.5: acrescentar que o cliente não reenvia a mesma posição e que o `token.soltar` fica fora do limitador.
- Seção 9, regra 8: citar o modelo novo de E2E de sigilo ("frames do jogador nunca têm o token oculto nem o
  da camada do mestre", em `e2e/tests/mapa.spec.ts`) e o gancho `window.__tabletop` (só no modo `e2e`) como
  padrão para testar o canvas.
- Lotes 5 e 6: a visibilidade de token por linha de visão deve entrar em `tokenVisivelPara`/`eventoPara`
  (que já recebem o estado de antes e de depois), reaproveitando `token.sumiu`.


## Lote 3 — Assets locais (entregue)

A premissa que diferencia o produto: **mapas e tokens vêm da pasta de cada usuário e o servidor nunca guarda
imagem.** A sala guarda só metadados (SQLite) e quem tem cada arquivo; os bytes passam pela sala em frames
binários e ficam no OPFS (cache) de cada navegador. Protocolo, frame binário e regras de sigilo de asset em
`docs/protocolo.md` (seção "Assets locais").

### O que foi entregue

- **`packages/shared`** (puro, testado): `assets.ts` (`AssetMeta`, limites, `validarMeta`, SHA-256 e pedaços de
  256 KB, `pedacoConfere`/`arquivoConfere`, frame binário `montarFrameDePedaco`/`lerFrameDePedaco`, tiles
  `retangulosDeTiles`/`ladoDoTile`/`precisaFatiar`, manifesto `montarManifestoDeMapa`/`hashDoManifesto`,
  `tamanhoDaCenaComMapa`, `assetVisivelPara`, `hashesUsados`, `escolherProvedor`); `Cena.mapa`,
  `Token.assetHash` e `Estado.assets` em `estado.ts`; intenções `asset.registrar`, `asset.pedir`,
  `asset.inventario`, `asset.tenho`, `asset.naoTenho`, `cena.definirMapa`, `token.definirImagem` (e
  `assetHash` em `token.criar`/`token.editar`); eventos `cena.mapaAlterado`, `asset.registrado` e dimensões
  em `cena.gridAlterado`; mensagens `asset.meta`, `asset.enviar`, `asset.indisponivel`; código
  `asset_inexistente`; **exportação v3** (metas dos assets usados; importa v1 e v2).
- **`apps/server`**: `transferencias.ts` (coordenação em memória, separada do Durable Object e testada em
  Node: provedor único por hash, repasse a todos, troca de provedor, "indisponível" e retomada);
  `armazenamento.ts` (coleção `assets` em `entidades` e **migração 2**: tabela `posse` por conexão);
  `sala.ts` (aceita frames binários só de pedaço e só do socket a quem pediu aquele hash e índice; `asset.pedir`
  com a regra de sigilo; inventário; limpa a posse ao fechar o socket e, ao acordar, de conexões que não
  existem mais).
- **`apps/web`**: pasta `src/assets/` — `fonte.ts` (`FonteDeAssets` com `PastaLocal`, `ArquivosSoltos`,
  `Memoria`), `fontes.ts` (as fontes deste navegador), `armazem.ts` (IndexedDB: handle da pasta e índice
  arquivo original → hash), `cache.ts` (OPFS: `assets/<hash>`, `meta/<hash>.json`, `parciais/<hash>/<i>`),
  `processador.worker.ts` + `processador.ts` (Web Worker: OffscreenCanvas → WebP, tiles, hashes, miniaturas),
  `gerente.ts` (pedir, conferir, retomar, servir, copiar para o mestre), `ganchoE2E.ts`. `Biblioteca.tsx`
  (aba nova), indicador de transferência no ícone da aba, `useSala` com frames binários, mapa com fundo por
  tile e token com imagem recortada em círculo (`mapaPixi.ts`).
- **Testes**: ver "Verificação".

### Como rodar

- `pnpm dev` e `pnpm verify`: como antes (nenhuma dependência nova).
- Na mesa: aba **Biblioteca** (ícone de imagens). Escolha uma **pasta** (Chrome/Edge; o handle fica no
  IndexedDB e, na visita seguinte, aparece "Reautorizar", porque o navegador exige um clique) ou
  **Adicionar arquivos** / arraste imagens (serve em qualquer navegador; vale só até fechar a página).
  Mestre: clique numa miniatura e use "Usar como mapa da cena" (informe os pixels por quadrado; padrão 70),
  "Criar token com esta imagem" ou "Aplicar ao token selecionado". Jogador: "Usar no meu token". A lista de
  transferências fica na mesma aba.
- O mestre que escolheu uma pasta ganha `recebidos/<nome do jogador>/<arquivo>-<hash8>.webp` com tudo o que
  os jogadores sobem.

### Verificação

`pnpm verify` verde **duas vezes seguidas**: 138 testes de unidade (120 em `shared`, 12 em `server`, 6 em
`web`) e 33 E2E (22 anteriores + 11 novos em `e2e/tests/assets.spec.ts`), E2E em ~3,1 min.

- Unidade (`assets.test.ts`, `transferencias.test.ts`): retângulos dos tiles (cobertura exata, sem sobreposição,
  limite de lado), frame binário (montar, ler, recusar malformado), conferência de pedaço e de arquivo,
  manifesto, limites, `assetVisivelPara` (token oculto, camada do mestre, dono, mapa e tiles da cena ativa),
  intenções de asset (registrar, mapa, imagem do token, capacidades), exportação v3 e importação de v1/v2,
  e a coordenação das transferências.
- E2E (imagens geradas no teste; limite do tile reduzido por gancho para fatiar um mapa pequeno): mapa
  fatiado → 7 jogadores recebem, o SHA-256 de cada arquivo no OPFS bate e o dono envia menos que sete vezes;
  segunda carga → **zero** frames binários e zero `asset.pedir`; mestre sai → jogador novo recebe de outro
  jogador; pedaço corrompido → pedido de novo só ele; refresh no meio de uma transferência → retoma só o que
  faltava; jogador põe imagem no próprio token → aparece para todos e chega a `recebidos/Jogador 1/` (SHA-256
  igual); **frames**: nenhum frame recebido pelo jogador (texto ou binário) contém o hash, o início do arquivo
  ou o nome da imagem posta no goblin oculto (com controle positivo no ogro visível); pedir o hash do
  goblin responde igual a pedir um hash que não existe; frame binário forjado não é repassado; reinício da
  sala (SQLite + posse refeita pelo inventário); exportar → zerar → importar com mapa e imagem.

### Gancho de teste (só no modo `e2e`)

- `window.__tabletop.imagens()`: tiles do fundo (posição e tamanho em px do mundo) e tokens com imagem.
- `window.__tabletopAssets`: `inventario()`, `metas()`, `pronto(hash)`, `status()`, `verificarCache()` (relê o OPFS e
  recalcula o SHA-256), `inicioDe(hash, n)` e `gravados()` (o que a `Memoria`, que no modo e2e faz o papel da
  pasta com escrita, recebeu em `recebidos/…`).
- `window.__tabletopE2E` (definido pelo teste antes de a página carregar, via `Mesa.entrar(usuario, gancho)`):
  `atrasoPorPedacoMs` (envio lento), `corromperIndice` + `corromperVezes` (o provedor estraga o pedaço) e
  `limiteTile` (limite de lado do tile; em produção é `min(MAX_TEXTURE_SIZE, 8192)`).
- Os helpers de E2E agora separam frames de **texto** (`frames`, `enviados`) dos **binários** (`binarios`,
  `enviadosBinarios`, como `Buffer`).

### Decisões

- **`Estado.assets` só existe na sala e na visão do mestre.** O jogador nunca recebe as metas no snapshot nem
  em evento; recebe `asset.meta` sob demanda, depois de a sala conferir `assetVisivelPara`. O evento
  `asset.registrado` só vai a mestres (é por ele que o mestre recolhe a cópia de tudo que os jogadores
  sobem, mesmo o que ainda não está em nenhum token).
- **Pedir asset invisível = pedir asset inexistente** (`erro` `asset_inexistente`, mesma mensagem). O que
  difere é só o `idPedido`.
- **Intenções sem capacidade** (`asset.pedir`, `asset.inventario`, `asset.tenho`, `asset.naoTenho`):
  `capacidadeDaIntencao` passou a aceitar `null` ("qualquer mestre ou jogador"), porque quem não pode subir
  arquivo ainda precisa receber o mapa. Todas as demais declaram uma capacidade.
- **Jogador registra só `token` e `retrato`**; `mapa` e `tile` são do mestre (`sem_permissao`). O dono de um hash é
  quem o registrou primeiro; quem registra o mesmo hash depois não vira dono, mas **pode usá-lo** no próprio
  token (ver "Revisão").
- **Manifesto do mapa fatiado**: `bytes: 0`, sem pedaços; o hash é o SHA-256 do texto canônico dos tiles. Pedir
  o manifesto devolve só a meta; o cliente pede cada tile. O manifesto não entra no inventário (não tem
  bytes) e só conta como "pronto" quando todos os tiles estão no cache.
- **Tiles de tamanho parecido**: `retangulosDeTiles` divide em ⌈lado ÷ máximo⌉ pedaços iguais (±1 px), em vez
  de sobrar um tile minúsculo na borda. Limites: 30 MB por arquivo, 64 tiles e 200 MB por mapa, 2000 assets
  na sala, 5000 hashes por inventário.
- **Um provedor por hash de cada vez**; quem espera o arquivo não serve a si mesmo; provedor parado há mais de
  15 s (visto no próximo pedido) tem o envio refeito. O cliente tem um **vigia**: sem progresso por 20 s
  (ou "indisponível"/erro por 30 s) pergunta de novo — cobre a sala que hibernou e esqueceu a transferência.
- **Tamanho da cena com mapa**: `cena.definirMapa` ajusta `larguraM`/`alturaM` (px ÷ `pxPorQuadrado` ×
  `quadradoM`); mudar o quadrado do grid com mapa recalcula (por isso `cena.gridAlterado` ganhou as dimensões
  opcionais). Mapa que passa de 1000 m é recusado (`dados_invalidos`).
- **Frames contam no orçamento**: cada pedaço recebido pela sala é uma mensagem (20 = 1 requisição). Um arquivo
  de 30 MB custa ~6 requisições; um token típico (≤ 512 px) cabe em 1 frame.
- **Posse no SQLite**: uma linha por (conexão, hash). O inventário ao conectar grava uma linha por arquivo no
  cache; com muitos arquivos e muitas reconexões isso pesa no limite de 100 mil linhas/dia do plano grátis
  (ver "Frágil").
- **Processamento**: token e retrato até 512 px (sem ampliar), mapa em WebP na resolução original (qualidade
  0,92). O índice local usa o **SHA-256 do arquivo original** (+ tipo + limite) para reconhecer arquivo
  renomeado ou movido e não reprocessar.

### Desvios do plano

- Nenhum desvio de arquitetura. Pequenas escolhas além do texto do plano estão em "Decisões" (`null` em
  `capacidadeDaIntencao`, `Estado.assets` só do mestre, restrição de tipos para jogador, manifesto sem bytes).
- A ação "Usar como retrato" não existe ainda (o tipo `retrato` está no modelo e no worker; a interface entra
  com a ficha, Lote 9). O asset `handout`/`audio` do esboço do PROJETO.md 4.1 também ficou de fora.

### Frágil / não verificado

- **`PastaLocal` (File System Access) não tem teste automático**: o Chrome do Playwright não abre o seletor de
  pasta. Coberto só por `Memoria` (escrita) e `ArquivosSoltos` (leitura, via `<input type=file>`). O
  roteiro manual abaixo cobre a pasta real, a **reautorização** depois de reabrir o navegador e a gravação em
  `recebidos/`.
- **Firefox e Safari**: não testados. O worker precisa de `OffscreenCanvas.convertToBlob({type:"image/webp"})`
  (se o navegador não codificar WebP, aparece o erro "Este navegador não converte para WebP") e o OPFS usa
  `createWritable()` na thread principal (que o Safari não tem). O Chrome/Edge são o alvo.
- **GPU real**: o limite de tile real (`min(MAX_TEXTURE_SIZE, 8192)`) nunca foi exercitado com um mapa > 8192
  px; os testes usam o gancho (512 px). Possível linha fina entre tiles por filtragem bilinear (não vista em
  tela; conferir no roteiro).
- **Hibernação real da sala**: a limpeza da posse ao acordar e o vigia do cliente existem, mas o E2E só cobre o
  reinício com `ctx.abort()`, não a hibernação por ociosidade.
- **Importar a campanha em outra instalação**: a importação traz as metas, mas os arquivos só existem nos
  navegadores. Sem ninguém online com cópia o mapa aparece como "indisponível" até o mestre escolher de novo
  o arquivo da pasta (se o WebP processado sair idêntico, o hash coincide e as transferências retomam).
  Também depois de `/teste/zerar` a posse some (a sala "esquece" todos), igual a um banco novo.
- **Custo de linhas no SQLite** do inventário (acima) e **custo de frames** no orçamento (acima) não foram
  medidos num uso real de 3 h.
- **Cache do navegador**: `navigator.storage.persist()` é só um pedido; o navegador pode negar. Sem cota
  suficiente o OPFS falha e o asset aparece como erro.
- Visual da aba Biblioteca conferido só por teste (sem polimento; o Vilella vai revisar a interface).

### Roteiro manual (parcial)

Feito pelo Vilella em 2026-11-05: mapa (`dl.jpg`) e imagem de token (`token_2.png`) da pasta local aparecem na
mesa ("funcionou"). Ajustes vistos no print dele, para a revisão de interface:

- o rótulo "N arquivos prontos neste navegador" mostra **0** mesmo com o mapa e o token carregados: ele conta
  só o que veio por transferência (`gerente.listarStatus()`), não o que o próprio usuário processou e já está
  no cache. Contar o cache (`completos`) em vez do status;
- a barra lateral corta texto à direita ("A mesa só…", "Adicionar arquivo…").

Ainda não confirmados (itens abaixo): reautorizar a pasta depois de reabrir o Chrome, Firefox, refresh no meio
de um mapa grande, `recebidos/<jogador>/`, mapa > 8192 px e rede desligada.

1. Escolher uma pasta real no Chrome com um **mapa grande (> 8192 px)** e usá-lo como mapa: conferir que
   carrega em tiles (aba Biblioteca mostra o progresso) e que a cena ganha o tamanho certo; em outro perfil,
   o mesmo mapa aparece e **nada** foi gravado no servidor (`apps/server/.wrangler/state` sem imagens).
2. Fechar e reabrir o Chrome: a aba Biblioteca mostra a pasta com **Reautorizar**; clicar e ver as miniaturas.
3. Jogador no **Firefox** arrastando o próprio token para a aba Biblioteca e usando no token dele (se falhar por
   WebP/OPFS, ver "Frágil").
4. **Refresh no meio de uma transferência** de um mapa grande (outro perfil): retoma sem baixar tudo de novo.
5. Conferir que o mestre ganhou `recebidos/<jogador>/…` na pasta dele.
6. Com a rede desligada (só `localhost`), repetir: nada tenta sair para a internet.

### Revisão (antes do commit de fechamento)

- **Brecha de sigilo na posse (corrigida):** a sala aceitava `asset.tenho`/`asset.inventario` de qualquer hash
  conhecido e escolhia o provedor só pela posse. Um jogador que anunciasse o hash da imagem de um token oculto
  seria chamado (`asset.enviar`) para enviá-la e descobriria que ela está em uso. Agora a posse só é aceita
  para asset que a pessoa **vê** (`assetVisivelPara`) e o provedor é filtrado pela mesma regra na hora da
  escolha (o asset pode ter ficado oculto depois do anúncio). E2E novo ("anunciar que tem um asset que não vê…",
  com uma conexão espiã que fica aberta); conferido que ele **falha** sem a correção.
- **Imagem igual de dois jogadores (corrigido):** a mesma arte baixada do mesmo lugar gera o mesmo hash; o
  segundo jogador recebia "imagem não encontrada" ao usá-la no próprio token, porque só o primeiro era dono.
  A restrição não protegia nada (só conhece um hash quem tem o arquivo ou já viu a imagem). Agora qualquer
  imagem de token registrada pode ir para um token que o jogador controla e vê. O teste de unidade e o E2E que
  fixavam a regra antiga foram ajustados; a propriedade de sigilo que importa (pedir asset invisível responde
  igual a inexistente) continua testada.
- `pnpm verify` duas vezes seguidas, verde nas duas: 138 testes de unidade (120 shared, 12 server, 6 web) e 34 E2E
  (~3,3 min).
- Limitação conhecida: se o provedor tiver o arquivo corrompido no próprio cache, quem recebe pede o pedaço de
  novo ao mesmo provedor e pode ficar em laço (o provedor conferiu o arquivo ao recebê-lo, então só com
  corrupção em disco). Melhorar quando aparecer: trocar de provedor depois de N pedaços ruins.

### Sugestões para o PROJETO.md

Aplicadas na revisão (4.1, 4.2, 4.3, 4.4, 4.5). Texto original do agente:

- 4.1: acrescentar `Estado.assets` (só sala e mestre), `Cena.mapa` já está; trocar `Asset.tiles?: string[]` por
  `tiles?: { hash, x, y, largura, altura }[]` e `pedacos: string[]`; `tipo` do Lote 3 é `mapa | token | retrato | tile`
  (`handout` e `audio` ficam para os lotes que os usarem).
- 4.2: listar `asset.registrar`, `asset.pedir` (com `faltam`), `asset.inventario`, `asset.tenho`, `asset.naoTenho`,
  `cena.definirMapa`, `token.definirImagem` e as mensagens `asset.meta`, `asset.enviar`, `asset.indisponivel`
  (no lugar de `asset.anunciar` e do evento `asset.pedaco`); dizer que `capacidadeDaIntencao` aceita `null`
  para o vaivém de arquivos.
- 4.3: registrar o manifesto sem bytes e o hash do manifesto; os limites (30 MB, 64 tiles, 200 MB por mapa); que o
  jogador só registra `token`/`retrato`; o vigia do cliente; e a decisão sobre importar campanha em outra
  instalação (os arquivos precisam estar em algum navegador ou na pasta do mestre).
- 4.4: exportação agora é v3 (v1 e v2 continuam aceitas).
- 4.5: frames de pedaço contam como mensagens recebidas; um arquivo de 30 MB ≈ 6 requisições.
- Lote 3 (seção 7): "pronto quando" pode citar `recebidos/<jogador>` e o teste dos frames do goblin oculto.

## Lote 4 — Personagens e cenas (entregue)

Separa **personagem** (existe uma vez: dono, visão, ficha mínima, token padrão) de **token** (a posição dele numa
cena) e traz **várias cenas**: o jogador só recebe a cena onde está o grupo, "levar o grupo" é **uma mensagem**, e a
cena seguinte pode ser **preparada** (pré-envio cifrado) sem quebrar o sigilo. Protocolo, regras de sigilo e o fluxo
do preparo em `docs/protocolo.md`.

### O que foi entregue

- **`packages/shared`** (puro, testado): `Personagem` (`PersonagemSchema`), `Token.personagemId?`, `Cena.chegada?`,
  `Estado.personagens`; `tokenVisivelPara(token, usuario, cenaAtivaId)` (token de outra cena é invisível),
  `personagemVisivelPara`, `controlaToken`, `podeMoverToken(token, usuario, estado)` (dono do personagem **ou**
  `controladoPor`), `arrumarNoGrid` (grupo lado a lado, sem sobreposição) e `chegadaDaCena` (`mapa.ts`);
  `cifra.ts` (AES-GCM 256: `cifrar`, `decifrar`, `decifrarEConferir`, `metaDoCifrado`); `hashesPreparaveis` e o tipo
  de asset `cifrado` (`assets.ts`); intenções `personagem.criar/editar/apagar/colocar`, `ficha.alterar`, `cena.criar/
  editar/duplicar/apagar`, `grupo.moverPara`, `cena.preparar` (e `cenaId` em `token.criar`, `cena.configurarGrid`,
  `cena.definirMapa`); eventos `personagem.alterado/apagado`, `cena.criada/editada/apagada`, `grupo.movido`;
  mensagens `preparo.disponivel/chaves/progresso`; códigos `personagem_inexistente` e `cena_inexistente`;
  `visaoPara`/`eventoPara`/`assetVisivelPara` olhando a cena e os personagens; **exportação v4** (importa v1 a v3).
- **`apps/server`**: `armazenamento.ts` (coleção `personagens`, eventos novos gravados incrementalmente, **migração 3**:
  tabela `preparos` com as chaves, só da sala); `sala.ts` (`cena.preparar`: guarda e avisa os jogadores;
  `grupo.moverPara`: entrega as chaves **antes** do snapshot e descarta o preparo; progresso aos mestres; limpeza ao
  apagar cena e ao importar). Banco anterior ao Lote 4 (sem personagens) continua funcionando.
- **`apps/web`**: abas **Cenas** (`AbaCenas.tsx`, só mestre) e **Personagens** (`AbaPersonagens.tsx`); "Vendo: X ·
  Grupo em: Y" sobre o mapa; `Mesa.tsx` guarda a cena vista (estado local do mestre) e manda `cenaId` nas
  intenções; `Biblioteca.tsx` (mapa e token novo vão para a cena vista; "Usar como imagem do token padrão");
  `gerente.ts` (`cifrarParaPreparo`, abrir pacotes, apagar o cifrado, pedir só a meta); `mapaPixi.ts` (trocar de
  cena recria os tokens e reenquadra).
- **`fixtures/campanha.seed.json`**: Aldric, Brisa e Cael (jogadores 1 a 3) ligados aos tokens, um personagem NPC
  (Ogro) e a segunda cena **Covil** (40 x 30 m, chegada em 6 m, 15 m) com a "Sentinela do Covil" e o "Vigia Oculto do
  Covil" (oculto). Os tokens dos jogadores agora têm `controladoPor: []`: quem controla é o dono do personagem.

### Como rodar

- `pnpm dev` e `pnpm verify`: como antes (nenhuma dependência nova). Uma campanha já existente no `pnpm dev` **não**
  ganha os personagens nem o Covil (a semente só vale para banco vazio); crie pela aba Personagens e Cenas, ou limpe
  `apps/server/.wrangler/state`.
- Mestre: aba **Cenas** (Ver, Levar o grupo aqui, Preparar, Duplicar, nome editável, Apagar, "Usar o centro da vista
  como chegada") e **Personagens** (criar, editar tudo, "Colocar na cena que estou vendo"; a imagem do token padrão se
  escolhe na Biblioteca). Jogador: aba **Personagens** (PV dele editável; os dos outros só com `ficha.verOutras`).

### Verificação

`pnpm verify` verde **duas vezes seguidas**: 179 testes de unidade (161 em `shared`, 12 em `server`, 6 em `web`; 41 novos) e 42 E2E (34 anteriores + 8 novos em `e2e/tests/cenas.spec.ts`), E2E em ~4,4 min.

- Unidade (`personagens.test.ts`, `semente.test.ts` e ajustes nos antigos): visibilidade por cena (token, asset,
  snapshot, evento, mapa e grid); personagens no snapshot (próprio, `ficha.verOutras`, NPC nunca, troca de dono);
  controle (dono, `controladoPor`, outro jogador, outra cena); `grupo.moverPara` (chegada, NPC fica, cena ativa muda,
  o reducer do cliente chega ao mesmo estado); `arrumarNoGrid` (sem sobreposição, tamanhos mistos, cena pequena);
  criar, editar, duplicar e apagar cena (nunca a ativa); personagens (criar, editar, colocar, apagar); `ficha.alterar`
  (dono e mestre sim, outro não, NPC inexistente, PV limitado, mantém ao trocar de cena); cifrar → decifrar → conferir
  o SHA-256 (e chave errada, arquivo adulterado, hash errado); `cena.preparar` (só o que os jogadores veriam);
  exportação v4 e importação de v1, v2 e v3.
- E2E (`e2e/tests/cenas.spec.ts`, 8 testes): levar o grupo gera **1** mensagem do mestre e 7 jogadores mudam de cena
  (1 snapshot novo cada); PV mantido ao trocar de cena e depois de refresh (e o clamp pelo PV máximo); `ficha.verOutras`
  e NPC; jogador não move o token de outro (nem forçando) e move se o mestre o pôr em `controladoPor`; o mestre
  vê e edita a cena 2 (token, grid, nome, chegada, duplicar, apagar) e nenhum evento chega aos jogadores; **frames**
  antes da ida (texto e binário: nome da cena, ids e nomes dos tokens, hashes do mapa, dos tiles e das imagens, bytes
  claros; controle positivo no mestre; pedir esses hashes responde `asset_inexistente`); **preparar** (6 tiles + imagem
  da sentinela, 3 de 7 jogadores com tudo, vigia oculto sem pacote nem chave, preparar de novo acrescenta só o novo,
  a troca **não baixa nenhum pedaço** e o SHA-256 de cada arquivo no cache bate); reinício da sala com o grupo
  na cena nova. Conferido que os testes **falham** sem a correção (decifração desligada e `tokenVisivelPara` sem a cena).

### Decisões

- **Controle do token = dono do personagem ou `controladoPor`** (`controlaToken`). A semente dos jogadores 1 a 3 não
  usa mais `controladoPor`: o dono controla pelo personagem. `token.definirImagem` usa a mesma regra.
- **O token guarda a própria cópia** de nome, cor, tamanho e imagem (tirada do token padrão em `personagem.colocar`).
  Editar o personagem depois **não** muda os tokens já postos (documentado em `estado.ts`).
- **Capacidades**: todas as intenções de mestre do lote usam `cena.editar` (nenhuma capacidade nova);
  `ficha.alterar` é `null` em `capacidadeDaIntencao` e a regra (dono ou mestre) está em `processar`.
- **Personagem de jogador tem um token só** (`personagem.colocar` recusa o segundo): o grupo leva o token junto. NPC
  pode ter quantos tokens quiser.
- **Ids**: o cliente gera o id da cena (`cena.criar`, `cena.duplicar` com `novoId`) e do token (`personagem.colocar`
  com `tokenId`); os tokens da cena duplicada ganham `<novoId>-<n>`.
- **PV**: inteiros de 0 a 9999; `pvAtual` nunca passa de `pvMax` (a sala corta, em `ficha.alterar` e em
  `personagem.editar`).
- **`ficha.verOutras` muda → snapshot novo** a quem foi afetado (em vez de remendar a lista de personagens por
  evento). Perder a visão de um personagem vira `personagem.apagado` para quem o via.
- **Snapshot para todos sem regravar tudo**: só a importação faz `salvarTudo`; levar o grupo e `ficha.verOutras`
  mandam snapshot a todos mas gravam só os eventos (importa para o limite de linhas do plano grátis).
- **Preparo**: validado na sala (`cena.preparar` só aceita `hashCifrado` de um asset `cifrado` registrado e
  `hashOriginal` de arquivo que os jogadores veriam na cena: mapa/tiles e imagem de token visível). Chaves só no
  SQLite (`preparos`) e na memória do navegador do mestre durante o preparo; nunca na exportação. Chaves por jogador
  só do que ele passa a ver depois da ida (`assetVisivelPara` sobre o estado novo). Os originais ficam "em
  decifração" assim que as chaves chegam (antes do snapshot), então a troca não pede nada pela rede.
- **Cifrado como asset**: tipo `cifrado`, `nomeOriginal: "cifrado"`, 1 x 1 px, mime genérico; visível a todo jogador;
  mesmo caminho de pedaços do Lote 3 (o dono, o mestre, serve). Só o mestre registra. Cabe um pouco mais que o limite
  de arquivo (+28 bytes de IV e etiqueta).
- **A cena vista pelo mestre** é estado local (`Mesa.tsx`): `null` acompanha o grupo; "Levar o grupo aqui" volta a
  acompanhar. Se a cena vista é apagada, volta à do grupo.

### Desvios do plano

- Nenhum desvio de arquitetura. Pequenas escolhas em "Decisões". `Personagem.tokenPadrao` ficou `{ cor,
  tamanhoQuadrados, assetHash? }` (o esboço do `PROJETO.md` tinha só `assetHash` e tamanho; a cor é a aparência
  gerada até haver imagem) e `Token.personagemId` é opcional (não `string | null`).
- Testes antigos ajustados por causa da regra nova: a **versão da exportação** passou de 3 para 4 (`assets.test.ts`,
  `tokens.test.ts`, `nucleo.test.ts` (chaves de `dados`, e a "versão inválida" passou de 4 para 5) e
  `assets.spec.ts`), `tokenVisivelPara`/`podeMoverToken` ganharam a cena ativa e o estado (`mapa.test.ts`). Nenhum
  teste foi pulado, desligado ou afrouxado.
- Um bug do Lote 2/3 apareceu só agora: o mapa (PixiJS) não recriava os tokens quando a cena mudava e os tokens
  continuavam os mesmos; corrigido em `mapaPixi.definirCena`.

### Frágil / não verificado

- **Arquivos grandes**: cifrar e decifrar leem o arquivo inteiro em memória (de 3 a 4 cópias de até 30 MB); não medido
  com um tile de 30 MB nem com um mapa de 200 MB.
- **Cifrado que chega depois da ida** (jogador lento ou offline na hora): fica no cache sem uso; o original vem pelo
  caminho normal. Não há limpeza dos cifrados antigos (nem no cache nem em `Estado.assets`: contam para o teto de
  2000 assets da sala; preparar de novo gera cifrados novos).
- **Mesmo mapa em duas cenas** (cena duplicada): cada preparo gera pacotes próprios, então o mapa é baixado duas vezes
  se as duas forem preparadas.
- **O que o preparo revela antes da hora**: quantos arquivos cifrados há e o tamanho aproximado de cada um. O token
  visível de um NPC leva o `personagemId` (um id opaco); o personagem em si não chega ao jogador.
- **Hibernação real** da sala com preparos pendentes: os preparos estão no SQLite e o reinício com `ctx.abort()` foi
  testado só com o grupo já levado, não com o preparo pendente; a mensagem `preparo.disponivel` é refeita ao
  conectar, o que cobre refresh do jogador, mas esse caminho não tem teste próprio.
- **Armazenamento (SQLite)**: não há teste de unidade de `armazenamento.ts` (precisa do Durable Object); coberto
  pelo E2E de reinício. O progresso do preparo faz uma consulta de posse por arquivo a cada `asset.tenho` durante o
  preparo (poucas linhas lidas, mas não medido no orçamento).
- **`PastaLocal`** continua sem teste automático (como no Lote 3); o roteiro abaixo usa a pasta real.
- Visual das abas novas conferido só por teste (sem olhar a tela); **nada foi polido** (é o Lote 4b).

### Roteiro manual (pendente)

1. Mestre com uma **pasta real** (Chrome): criar a cena **Covil**, escolher um mapa e uma imagem para a Sentinela;
   com 2 ou 3 jogadores em outros perfis, clicar **Preparar** na aba Cenas e ver "N de M jogadores já têm tudo".
2. Com o F12 aberto num jogador (aba Network, WS): antes de levar o grupo não pode aparecer o nome da cena, o nome
   dos tokens nem o hash do mapa (só `preparo.disponivel` e os pedaços opacos).
3. **Levar o grupo aqui**: a troca é instantânea (mapa e token da Sentinela aparecem sem barra de progresso), o
   Vigia oculto não aparece e o PV dos personagens continua o mesmo.
4. Editar a cena 2 (token novo, grid, chegada) com o grupo na cena 1: os jogadores não percebem nada.
5. Refresh do jogador entre **Preparar** e **Levar**: ao voltar ele continua baixando/tem os cifrados e a troca ainda
   é instantânea.
6. Personagens: criar um NPC, dar imagem pela Biblioteca, colocar na cena vista; mudar PV como dono e como mestre.
7. Abrir a campanha antiga do `pnpm dev` (sem personagens): tudo continua funcionando.

### Revisão (antes do commit de fechamento)

- Conferidos no código: filtros de cena e personagem (`visaoPara`, `eventoPara`), entrega das chaves com o estado já
  mudado e só do que cada jogador passa a ver, e a validação do preparo (só pacote de arquivo visível naquela cena).
  Nada a corrigir.
- `pnpm verify` duas vezes seguidas, verde nas duas: 179 testes de unidade (161 shared, 12 server, 6 web) e 42 E2E
  (~4,5 min).
- **Incidente:** o agente encerrou um `pnpm dev` do Vilella que estava aberto desde as 15:30 (para cumprir "portas
  livres no fim"). Antes de cair, o hot-reload rodou o código do Lote 4 sobre a campanha real e aplicou a migração 3
  (tabela `preparos`, aditiva). O banco continua lá. Daqui em diante, os briefs dos agentes proíbem encerrar
  processos que eles não iniciaram.

### Sugestões para o PROJETO.md

Aplicadas na revisão (4.1, 4.4, Lote 4 e seção 9). Texto original do agente:

- 4.1: `Personagem.tokenPadrao: { cor, tamanhoQuadrados, assetHash? }` (e `ficha: { pvAtual, pvMax }` até o Lote 9);
  `Token.personagemId?: string`; `Cena.chegada?: { x, y }`; `Estado.personagens`; `Asset.tipo` ganha `cifrado` (sem
  nome nem dimensões reais); explicar que o token guarda a própria cópia de nome, cor e imagem.
- 4.2: listar as intenções novas (`personagem.criar/editar/apagar/colocar`, `ficha.alterar`, `cena.criar/editar/
  duplicar/apagar`, `grupo.moverPara`, `cena.preparar`), os eventos (`personagem.*`, `cena.criada/editada/apagada`,
  `grupo.movido`), as mensagens `preparo.disponivel/chaves/progresso` e os códigos `personagem_inexistente` e
  `cena_inexistente`; `ficha.alterar` com `null` em `capacidadeDaIntencao`.
- 4.3: o fluxo do preparo cifrado, o asset `cifrado` e o que ele revela (quantidade e tamanho aproximado).
- 4.4: exportação v4 (personagens; sem preparos nem cifrados).
- Lotes 5 e 6: o filtro de visão por linha de visão entra em `tokenVisivelPara` (que agora recebe a cena ativa) e em
  `eventoPara`; a luz ambiente é por cena e a cena do jogador é só a ativa.
- Seção 9, regra 8: citar `e2e/tests/cenas.spec.ts` (frames antes e depois do preparo) como modelo de teste de
  sigilo de cena.
- Lote 4 "Pronto quando": acrescentar o roteiro manual acima.

## Próximo: Lote 4b — Revisão da interface

Ver `PROJETO.md`, seção 7. O escopo exato se combina com o Vilella. Ajustes já vistos (Lote 3 e Lote 4), para a
revisão:

- **Do Lote 3** (ainda valem): zoom inicial pequeno demais (tokens viram pontos, nomes ilegíveis); painel do token
  cobrindo o mapa; barra lateral larga demais e cortando texto em janela estreita; "arquivos prontos" conta errado
  (só o que veio por transferência).
- **Aba Cenas**: cada linha tem 5 ou 6 botões que quebram em várias linhas na barra estreita; o rótulo "Usar o centro
  da vista como chegada" é longo; "Apagar" pede confirmação com um segundo botão ao lado (sem diálogo); o nome da cena
  é um campo editável sem aviso de que confirma ao sair; não há miniatura nem tamanho da cena; "Preparar" mostra só
  texto ("3 de 7 jogadores já têm tudo"), sem barra de progresso nem como cancelar.
- **Cena vista × cena do grupo**: só o rótulo "Vendo: X · Grupo em: Y" avisa que o mestre está olhando outra cena; nada
  no mapa (borda, faixa) impede de editar a cena errada sem perceber.
- **Aba Personagens (mestre)**: cada cartão tem uns dez campos e não recolhe, a lista fica comprida; a imagem do token
  padrão aparece só como os 8 primeiros caracteres do hash (sem miniatura) e se escolhe em **outra aba** (Biblioteca);
  "Colocar na cena que estou vendo (X)" repete o nome da cena; PV são dois campos numéricos sem +/−; a visão é
  texto solto até o Lote 6.
- **Aba Personagens (jogador)**: sem retrato; PV como número; os de outros jogadores (com `ficha.verOutras`) aparecem
  só como texto.
- **Barra lateral**: com as duas abas novas a faixa de ícones tem 7 (mestre) ou 6 (jogador); conferir com janela
  estreita.
- **Painel do token** não mostra a qual personagem o token pertence nem quem o controla por ser o dono.
