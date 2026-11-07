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

## Lote 4b — Interface v2 (entregue, para o Vilella ver)

Monta a interface v2 (`PROJETO.md` 4.13.1) para o Vilella visualizar e seguir descrevendo. Recurso novo sem lote
(pincel, dados, chat, compêndio, eventos, iluminação, visão noturna, ordem de turno) é **só interface**. Protocolo em
`docs/protocolo.md` (pastas, quem edita, ordem de turno, camada `mapa`).

### O que foi entregue

- **Layout:** a etiqueta sobre o mapa saiu (as mesmas informações ficam só para leitores de tela, `so-leitor`); o selo
  de conexão só aparece sem conexão. **Menu superior do mestre** (`MenuSuperior.tsx`): Cenas, Camadas (popover com
  mapa/tokens/mestre/desenho e "Limpar desenhos" desabilitado), Visão noturna (liga/desliga sem efeito), Novo token,
  Eventos e Iluminação (painéis "em breve") e Ordem de turno. **Barra da esquerda** (todos): selecionar, mão, régua,
  **dados rápidos** (grade D4 a D100 × 2 a 6; só mostra o aviso "3d20 — os dados chegam com o chat") e **pincel**
  (sub-barra: voltar, selecionar, 4 formas, 6 cores, borracha; "em breve"). **Barra da direita** de largura fixa:
  Chat, Fichas, Compêndio, Configurações e Mestre. Somem como abas: Jogadores, Notas, Personagens, Cenas, Biblioteca.
- **Faixa de cenas** (`FaixaDeCenas.tsx`): ~164 px de altura, rolagem horizontal; cards numerados com nome e **prévia
  do mapa** gerada no navegador do mestre a partir do cache (junta os tiles; `previaDaCena.ts`), grid quando não há mapa;
  destaque da cena vista, marca do grupo, "+ Nova cena", duplo clique renomeia. **Botão direito** abre o menu de contexto:
  Ir para, Levar grupo, Duplicar, Preparar (barra de progresso no card), **Configurar…** (nome, mapa, px por quadrado,
  grid visível; `ConfigurarCena.tsx`) e Apagar (com confirmação). O ponto de chegada agora é uma **bandeira arrastável no
  mapa** (só o mestre, na cena que ele vê; `mapaPixi.ts`).
- **Camada `mapa`** funcionando (shared + mapa): abaixo dos tokens; o jogador vê e não seleciona nem move; o mestre
  seleciona com a camada de trabalho `mapa`. `tokenVisivelPara`, `podeMoverToken`, `hashesPreparaveis` atualizados.
- **Pastas das Fichas** (shared, sala, web): `Pasta`, `Personagem.pastaId/editores/retratoHash` (sem `donoId`), intenções
  `pasta.criar/editar/apagar`, eventos `pasta.alterada/apagada`, `ordemDeTurno.definir`/`ordemDeTurno.alterada`,
  `Estado.pastas` e `Estado.ordemDeTurnoVisivel`. Quem vê o item = pasta + quem edita (substitui `ficha.verOutras`, que
  continua no tipo e some da interface). Controle do token = quem edita + `controladoPor`. **Exportação v5**
  (importa v1 a v4). Migração SQLite (nº 4 em `armazenamento.ts`) leva o banco antigo para as pastas "Personagens" e
  "NPCs" (só mestre).
- **Aba Fichas** (`AbaFichas.tsx`, `EditorDoItem.tsx`): Notas fixas no topo; pastas recolhíveis (criar, renomear, apagar
  só vazia, visibilidade todos/escolhidos/só mestre); alça à esquerda do item arrasta para outra pasta ou **para o mapa**
  (cria o token na cena vista, onde soltou); "+ Novo" (Personagem e NPC; Artefato, Tesouro, Handout desabilitados);
  editor com retrato e token padrão (`SeletorDeImagem.tsx`: pasta local ou arquivo), quem edita (chips), PV, Duplicar,
  Apagar, "Importar ficha" desabilitado. O jogador que edita troca retrato e token (`asset.subir`).
- **Ajustes já vistos:** zoom inicial 100% centrado no grupo (mestre) ou no token do jogador, ou no centro da cena;
  painel do token compacto no canto inferior esquerdo; barra lateral de largura fixa sem texto cortado; o contador de
  "arquivos prontos" conta o cache (`gerente.inventario()`); pasta local (escolher, reautorizar, ver) e transferências
  foram para Configurações; papéis dos usuários foram para a aba Mestre.
- Dependências novas: nenhuma (`lucide-react` já existia).

### Como rodar

`pnpm dev` e `pnpm verify` como antes. Campanha já existente no `pnpm dev` é migrada ao abrir (pastas "Personagens" e
"NPCs"); nada precisa ser apagado.

### Verificação

- Unidade: `fichas.test.ts` (novo: visibilidade por pasta, transições, controle por quem edita, camada mapa, ordem de
  turno, migração, exportação v5 e importação de v1 a v4) e os testes antigos ajustados.
- E2E: os 42 antigos continuam, com as interações adaptadas (abas e botões mudaram de lugar; nada foi afrouxado). Novos:
  `fichas.spec.ts` (frames de pasta, quem edita, arrastar para o mapa, retrato/token padrão, camada mapa) e
  `interface.spec.ts` (ordem de turno, menus, dados, pincel, barra da direita, zoom inicial, faixa e menu de contexto).
  Ajudas novas: `abrirFaixa`, `menuDaCena`, `escolherCamada`, `definirMapa`, `imagemDoTokenSelecionado`, `ajudasMapa.ts`.

### Decisões

- Pasta e ordem de turno exigem `mesa.configurar` (só do mestre). `personagem.editar` não exige capacidade: o mestre
  muda tudo e quem edita muda só as imagens (com `asset.subir`).
- Mudar a visibilidade de uma pasta manda snapshot novo a todos; mover item de pasta usa a transição de personagem.
- O jogador que edita um item cuja pasta ele não vê o recebe, mas não a pasta: a interface o põe em "Seus itens".
- Quando quem edita troca o token padrão, a interface também põe a imagem nos tokens dele daquele personagem (via
  `token.definirImagem`); o mestre muda só o padrão, como antes.
- O jogador só conhece os personagens que vê: o zoom inicial dele centra nos tokens que ele controla.

### Desvios do plano

- Painel do token no canto inferior esquerdo (não colado no token): colado no token cobria os vizinhos.
- Progresso do preparo no card é curto ("3/7 · 7 arquivos"); o texto longo antigo ficou no `title`.

### Só interface (sem função ainda)

Pincel e camada de desenho (e "Limpar desenhos"), dados rápidos (só avisa), chat (lista vazia, caixa e "Como:"
desabilitados), compêndio (busca sem dados), eventos, iluminação, visão noturna, painel de ordem de turno (vazio; só o
liga/desliga é real), "Importar ficha", e os itens Artefato, Tesouro e Handout.

### Frágil / não verificado

- Arrastar e soltar usa HTML5 DnD: testado no Chrome (Playwright), não em Firefox/Safari.
- A prévia da cena usa o cache; mapas enormes geram a prévia na primeira vez que a faixa abre (pode demorar um instante).
- Cena duplicada copia a referência do mapa; preparar cena duplicada precisa refazer o preparo.
- A bandeira de chegada só é arrastável com a ferramenta Selecionar.

### Revisão (antes do commit de fechamento)

- A sessão caiu com o agente na reta final (código, testes, prints e esta seção já prontos). Na retomada, em
  2026-11-06: `pnpm verify` duas vezes seguidas, verde nas duas: 198 testes de unidade (180 shared, 12 server,
  6 web) e 51 E2E (~4,1 min). Prints conferidos um a um.
- Conferidos no código: visibilidade por pasta + quem edita (`personagemVisivelPara`), controle do token por quem
  edita, camada `mapa` visível e não movível pelo jogador, e a migração (`donoId` → quem edita, pastas "só
  mestre"), que mantém quem via o quê.
- O `pnpm dev` do Vilella (8787/5173), que estava aberto quando o lote começou, não estava mais rodando na
  retomada; não dá para saber se caiu com a sessão.

### Sugestões para o PROJETO.md

Aplicadas na revisão (4.1 e o Lote 4b). Texto original do agente:

- 4.1: `Pasta`, `Personagem { pastaId, editores, retratoHash? }` (sem `donoId`), `Token.camada` com `mapa`, `Estado.pastas` e
  `ordemDeTurnoVisivel`; 4.13: a barra superior, a faixa de cenas, o painel do token e a bandeira de chegada.
- Marcar como decididas as "Assumidas": quem vê = pasta + quem edita; `ficha.verOutras` sem efeito (remover do tipo
  depois de uma versão de exportação).
- Lote 4b "Pronto quando": acrescentar o roteiro manual (abrir a faixa, botão direito, arrastar item para o mapa, mover
  item entre pastas com um jogador conectado).
- Seção 9, regra 8: citar `e2e/tests/fichas.spec.ts` como modelo de teste de sigilo de pastas.

## Lote 5 — Paredes, portas e linha de visão (entregue, aguardando o roteiro manual)

### O que foi entregue

- **`shared`** (puro, testado): `paredes.ts` (o que bloqueia visão e passagem, `paredeParaJogador`, `trajetoBloqueado`, `alternarPortaDoJogador`, `alcanceDeVisao`,
  `iluminacaoDinamicaLigada`) e `visao.ts` (`poligonoDeVisibilidade`, `pontoNoPoligono`, `pontoNaUniao`). Schemas: `Parede`, `Cena.iluminacaoDinamica?`, `Token.alcanceVisaoM?`,
  `Estado.paredes`; intenções `parede.criar/editar/apagar`, `cena.configurarIluminacao`, `porta.alternar`; eventos `parede.criada/editada/apagada`;
  erros novos; exportação **v6** (importa v1 a v5).
- **Sala**: sigilo da secreta (snapshot e eventos, com a transição antes/depois), paredes só da cena ativa para o jogador, `token.soltar` recusado
  atravessando parede (`trajeto_bloqueado`; os outros voltam o token com `token.movendo`), `porta.alternar` com alcance e trancada. `armazenamento.ts` grava a coleção
  `paredes` em `entidades`.
- **Interface**: lista da lanterna (Iluminação dinâmica, Paredes e portas, Fontes de luz e Configurações desabilitadas); ferramenta de paredes
  (`PainelDasParedes.tsx` + `mapaPixi.ts`); ícones das portas; visão do jogador por véu em RenderTexture; visão noturna do mestre (ligada por padrão);
  "ver como" (clique direito na lua); campo de alcance de visão no painel do token (sem personagem).
- **Semente**: sala na Cena inicial (4,5–18 m em x, 24–36 m em y) com porta, janela, porta trancada e porta secreta; alcance de visão de Aldric (24 m), Brisa e Cael (18 m).

### Como rodar

Nada novo. Para ver: entrar como mestre, abrir a lanterna → Paredes e portas, e como jogador 1 mover o Aldric para dentro da sala (o mestre pode soltá-lo onde quiser).

### Verificação

- `pnpm verify` verde duas vezes seguidas (ver o relatório do agente para os números). Unidade novos: `visao.test.ts` (sala vazia, pilar, porta aberta × fechada,
  janela, canto, colineares, 500 segmentos × 8 fontes em < 16 ms, com alcance de 18 m e sem limite) e `paredes.test.ts` (trajeto, secreta e transições,
  porta ao alcance e trancada, edição, iluminação por cena, exportação v6 e importação v1–v5). E2E novos: `e2e/tests/paredes.spec.ts` (7 testes).
- Expectativa antiga alterada: `interface.spec.ts` esperava a visão noturna desligada ao abrir e o painel "Iluminação — em breve"; agora ela abre ligada e a lanterna é uma lista.
  Nos testes de exportação a versão passou de 5 para 6 e `paredes` entrou na lista de chaves.

### Gancho de teste (só no modo `e2e`)

`window.__tabletop` ganhou: `tokens()[].desenhado`, `portas()`, `paredes()`, `visao()`, `veNoPonto(x, y)`, `veuVisivel()`, `desenhando()`.

### Decisões

- **Véu em RenderTexture, não máscara**: a máscara de stencil do Pixi soma sobreposições (a visão de dois jogadores se cruza e o cruzamento furaria). O véu é desenhado na
  RenderTexture com buracos em blend `erase` por polígono; jogador: cor do fundo, opaca; mestre (noturna): preto a 55%. Resolução limitada a 3000 px no lado maior.
- **Token fora da visão**: não aparece (`container.visible = false`) e não é clicável; a camada `mapa` (cenário) só é coberta pelo véu. As fontes (os próprios tokens) sempre aparecem.
- **Algoritmo**: um raio por ponta, e os dois vizinhos só quando a ponta é alcançada; segmentos ordenados por distância e o raio para cedo. Alcance = polígono de 32 lados.
- **Visão noturna** sem nenhum jogador na cena fica toda clara (nada a contrastar).
- **Porta**: o jogador só opera `tipo: "porta"`; a secreta é só do mestre (mesmo aberta). Alcance fixo em 1,5 m (constante) porque `ConfigDaMesa` ainda não existe no estado.
- **Ferramenta de paredes**: clicar no corpo de uma parede seleciona; clicar perto das pontas começa um desenho (assim dá para continuar a partir de um canto); as pontas só se arrastam na parede selecionada.
  O painel também escolhe o tipo das novas paredes.
- **Sem migração SQLite nova**: `entidades` é genérica; banco antigo simplesmente não tem a coleção `paredes` (lida como vazia), e campos novos são opcionais. Nada muda na campanha existente.
- O mestre "vendo como" um jogador continua com poderes de mestre (só a tela muda).

### Desvios do plano

- `alcanceInteracaoM` é constante (1,5), não configuração da mesa.
- Os itens "Fontes de luz" e "Configurações de iluminação" estão desabilitados (Lotes 6 e 7), como pedido.

### Frágil / não verificado

- O blend `erase` e a RenderTexture foram vistos só no Chrome (WebGL). Bordas do véu ficam levemente serrilhadas em zoom alto (a textura é limitada).
- Origem exatamente sobre uma parede (token com o centro na parede) pode vazar visão por ela; tokens ficam no centro das células, então é raro.
- Quem encosta o token numa parede com Alt (solto) pode parar a poucos milímetros dela; a conferência do trajeto é só por segmento reto, sem raio do token.
- O mestre desenha tudo no mesmo clique do duplo clique: em tela com muita latência de pointer, o ponto repetido é ignorado por distância (< 5 cm).
- Visão recalculada a cada quadro enquanto um token de visão anda (poucos polígonos; medido em 5–7 ms para 500 paredes e 8 fontes).

### Roteiro manual (pendente)

1. Lanterna → Paredes e portas; desenhar um corredor (clique, clique, duplo clique); mudar um segmento para porta no painel; Delete apaga.
2. Como jogador, levar um token até a porta: clicar no ícone abre e fecha; longe avisa; a trancada avisa; o mestre tranca com o clique direito no ícone.
3. Ver a visão do jogador mudar com a porta; tentar passar pela parede (o token não atravessa); o mestre passa.
4. Lanterna → Iluminação dinâmica desliga: o jogador vê tudo. Lua (clique): visão noturna; clique direito: ver como um jogador.

### Revisão (antes do commit de fechamento)

- Prints conferidos: paredes por tipo, visão do jogador cortada pelas paredes (com o vazamento da janela), cone
  pela porta aberta e visão noturna do mestre. No código: a conversão da secreta (`paredeParaJogador`, fechada →
  parede, aberta → porta, trancar/destrancar nem chega ao jogador) e o filtro de paredes por cena.
- O agente deixou o servidor do `pnpm dev:e2e` que subiu para os prints rodando (o `taskkill` dele foi negado
  pelo classificador de permissões); com ele na 8788, o meu `pnpm verify` travou reaproveitando o servidor velho.
  Interrompi a minha rodada e encerrei os processos só depois de o Vilella autorizar.
- `pnpm verify` duas vezes seguidas, com as portas livres: verde nas duas, 237 testes de unidade (219 shared, 12
  server, 6 web) e 58 E2E (~5,5 min).
- O `pnpm dev` do Vilella não foi tocado (ele mesmo o fechou durante o lote).

### Sugestões para o PROJETO.md

Aplicadas na revisão (4.1, 4.7, 4.13.1 e o Lote 5). Texto original do agente:

- 4.1: `Parede` já bate; acrescentar `Cena.iluminacaoDinamica?` e `Token.alcanceVisaoM?`; `Estado.paredes`.
- 4.7: o render é um véu em RenderTexture (e não máscaras) pela razão acima; a secreta aberta chega como porta aberta e só o mestre a opera.
- 4.13.1: a lista da lanterna e o menu do ícone de visão noturna (clique direito: ver como).
- Lote 6: a névoa/memória pode reaproveitar a RenderTexture do véu (acumular os polígonos).

## Lote 6 — Luz, visão no escuro e memória do mapa (entregue, aguardando o roteiro manual)

### O que foi entregue

- **`shared`** (puro, testado): `luz.ts` (`raiosEfetivos`, `resolverLuzes`, `luzVisivelPara`, `modInteligenciaDe`, `visaoNoEscuroDe`), `iluminacao.ts` (`calcularModelo`, `CacheDeLuz`,
  `nivelDeLuz`, `visaoNoPonto`, `veNoPonto`) e `memoria.ts` (`alcanceDaMemoria`, `opacidadeDaMemoria`, `marcarVisto`, `esquecerAlemDoAlcance`, `imagemDaMemoria`).
  Schemas: `FonteDeLuz`, `ConfigDaMesa` (`iluminacao`), `Estado.luzes/config/memoriaEsquecida`, `Cena.luzAmbiente/fatorDeLuz`, `Token.visaoNoEscuroM`,
  `Personagem.modInteligencia`; intenções `fonte.criar/editar/apagar`, `config.iluminacao`, `memoria.esquecer` (e `cena.configurarIluminacao` ganhou `luzAmbiente`
  e `fatorDeLuz`); eventos `fonte.*`, `config.alterada`, `memoria.esquecida`; exportação **v7** (importa v1 a v6).
- **Sala**: sigilo das fontes (snapshot e eventos; a de token oculto ou da camada do mestre não chega ao jogador; esconder o token que carrega luz manda snapshot novo),
  coleção `luzes` em `entidades` e `config`/`memoria_esquecida` em `meta` (sem migração: banco antigo lê vazio e com o padrão).
- **Render** (`apps/web/src/mapa/camadaDeLuz.ts`, só de tela): texturas do tamanho da cena (RenderTexture): "não visto" (véu do Lote 5), luz (ambiente + penumbra + luz plena, em blend aditivo,
  cada luz com o próprio polígono, as paredes bloqueiam a luz), visão no escuro (meia luz + máscara do cinza) e saída (memória onde não vê, luz onde vê). Entrega três sprites sobre o mapa:
  `multiplicar` (blend multiply), `brilho` (blend add, 10%) e `cinza` (blend `saturation`, dos modos avançados do Pixi).
- **Memória do mapa** (`memoriaLocal.ts` + `mapaPixi.ts`): grade de 0,5 m por usuário e cena no IndexedDB (com cópia em memória se o IndexedDB falhar), marcada a cada ≥ 120 ms, esquecida além do alcance,
  gravada 500 ms depois da última mudança (e no `pagehide`). "Esquecer a memória desta cena" do mestre vira `memoria.esquecida`, e o navegador compara a versão com a que já aplicou.
- **Interface**: lanterna com "Iluminação dinâmica" mostrando **Ligada/Desligada** em destaque (e um ponto vermelho no ícone da lanterna quando está desligada); **painel flutuante de fontes de luz**
  (`PainelDeFontesDeLuz.tsx`: slider geral, lista com acender/apagar, intensidade e lixeira, "+ Luz fixa" e clique no mapa, edição de nome, raios, cor e tremular, duplo clique no cabeçalho recolhe
  e baixa a opacidade a 0,7, espaço reservado "Com tempo" para o Lote 7); as marcas das luzes aparecem no mapa com o painel aberto (arrastar muda o lugar; clicar seleciona);
  **configurações de iluminação** (`PainelDeIluminacao.tsx`: luz ambiente da cena, memória ligada/modo/valores/tom, "Esquecer a memória desta cena"); campo "Modificador de Inteligência" no editor do item;
  "Visão no escuro" no painel do token sem personagem.
- **Semente**: Cena inicial com luz ambiente 0,1, a tocha da sala (11,25; 30; 6 m + 6 m) e o braseiro (27; 9,75; 4,5 m + 4,5 m); Aldric já tinha visão no escuro de 18 m; Brisa ganhou Inteligência +2.
- **Infra de prints** (reusável nos próximos lotes): `e2e/playwright.prints.config.ts`, script `prints` do `e2e`, pasta `e2e/prints/`.

### Como rodar

- Testes: `pnpm verify`.
- Prints (sobem e derrubam os próprios servidores 8788/5174; a porta ocupada faz o Playwright reclamar, não reaproveitar):
  `PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints` (PowerShell: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints`). Os prints de cada lote ficam em `e2e/prints/lote-N.spec.ts`, 1600×900.
  O `Mesa` de `e2e/tests/ajudas.ts` aceita as opções do contexto (o viewport).

### Verificação

- `pnpm verify` verde **duas vezes seguidas**: 271 testes de unidade em `shared` (eram 219; novos: `luz.test.ts`, `iluminacao.test.ts`, `memoria.test.ts`), 12 no `server`, 6 no `web`, e **69 E2E** (58 antigos + 11 novos de `e2e/tests/luz.spec.ts`), ~5,1 min cada.
- Expectativas antigas alteradas: a versão da exportação passou de 6 para 7 (testes de unidade e `assets.spec.ts`/`interface.spec.ts`), a lista de chaves da exportação ganhou `luzes` e `config`, a versão inválida do teste de importação passou de 7 para 8, o item "Fontes de luz" e "Configurações de iluminação" da lanterna agora estão habilitados, e o teste de exportação de `assets.spec.ts` passou a esperar o `token.editado` com a imagem antes de exportar (corrida rara).
- Desempenho: o teste de unidade com 30 luzes e 500 paredes calcula os polígonos em poucas dezenas de ms (limite do teste: 500 ms). No Chrome headless, arrastando um token com 30 luzes e 500 paredes: **60 fps** (teto do rAF; só referência, `e2e/prints/lote-6.spec.ts`, último teste).
- Prints (1600×900) em `PRINTS_DIR`: 01 jogador em cena escura com luz fixa, 02 visão no escuro (cinza), 03 memória do mapa, 04 painel de fontes aberto, 05 recolhido, 06 configurações de iluminação, 07 visão noturna do mestre, 08 e 08b lanterna (ligada e desligada), 09 cena de desempenho.

### Gancho de teste (só no modo `e2e`)

`window.__tabletop` ganhou: `visaoNoPonto(x, y)` (`nenhuma`/`cinza`/`penumbra`/`plena`), `nivelNoPonto`, `luzes()` (com os raios já multiplicados), `memoria()` (`carregada`, `lembradas`,
`pendente`, `esquecimento`, `alcancesM`), `lembraNoPonto`, `opacidadeDaMemoria`, `marcasDeLuz()`. `veNoPonto` e `veuVisivel` agora consideram a luz. Erro de JavaScript na página aparece no
relatório do Playwright (`[erro na página]`).

### Decisões

- **Pipeline só com modos de mistura**: nenhum shader próprio. Visão = véu "não visto" (erase). Luz = soma aditiva. A memória e a luz se juntam numa textura com alfa (erase) e vão para a tela em *multiply*.
  O cinza usa o modo `saturation` (exige `import "pixi.js/advanced-blend-modes"` e `useBackBuffer: true`).
- **Visível** = luz ∩ visão, ou visão no escuro. Ambiente ≥ 0,45 já vale como penumbra em toda a cena; abaixo disso só a luz e a visão no escuro revelam. Visão no escuro soma meia luz (escuro vira "meia luz" em cinza e a penumbra chega a 1).
- **Brilho de 10%** (blend add) para um chão escuro de mapa sem imagem não parecer apenas "ausência de preto"; em mapa claro quase não se nota.
- **Tremulação** só refaz o brilho (a cada 90 ms), sem recalcular polígonos. Os polígonos das luzes ficam em cache (`CacheDeLuz`) e só se refazem quando a luz, as paredes ou a cena mudam.
- **Memória**: o alcance de cada token decide até onde ele se lembra; a opacidade usa o token que mais "alcança" a célula. O que passa do alcance de todos é apagado na hora.
- **Visão noturna do mestre**: o que algum jogador vê aparece normal (sem cinza nem penumbra) e o resto a 45%. Em aberto no PROJETO.md: a área que um jogador só vê com visão no escuro aparece normal, não cinza.
- **Luz ambiente sem valor = 1** (não escurece campanha antiga). Fator geral por cena em `Cena.fatorDeLuz`.
- Corrigido um erro latente do Pixi: `app.destroy(true)` esvazia os pools **globais** (o StrictMode destruía o primeiro mapa com o segundo de pé e quebrava o desenho com "reading 'clear'" de vez em quando). Agora `destroy({ removeView: true })`; e o laço de desenho não para mais por um erro (loga).

### Desvios do plano

- **Névoa explorada gravada na sala** virou **memória do mapa só no navegador** (IndexedDB), como decidido antes do lote; o mestre "esquece" por evento, não "reseta" um dado da sala.
- Fontes de luz são uma prévia do `ObjetoDeLuz` (sem modelo, tempo nem mochila: Lote 7).
- A luz ambiente e o fator geral são campos da cena (não da `ConfigDaMesa`).

### Frágil / não verificado

- Blend `saturation` e RenderTextures só foram vistos no Chrome (WebGL) e com devicePixelRatio 1. Com DPR alto as texturas continuam limitadas a 1800 px no lado maior (bordas mais suaves em cenas grandes).
- Luz tem bordas duras (luz plena e penumbra em degraus); sem gradiente.
- A memória marca por centro de célula de 0,5 m: quinas finas de parede podem deixar uma célula marcada por engano.
- A memória só vale para o token do navegador; o mestre "vendo como" um jogador usa a memória do jogador **neste** navegador (do mestre), não a do jogador.
- Cena que muda de tamanho descarta a memória gravada.
- Redimensionar a janela com muito zoom refaz as marcas das luzes (barato), mas não as texturas (não dependem da tela).

### Roteiro manual (pendente)

1. Lanterna → Configurações: luz ambiente em 0; só a tocha da sala e o braseiro iluminam. Como jogador 2 (sem visão no escuro), conferir escuro, penumbra e luz plena.
2. Como jogador 1 (Aldric, visão no escuro de 18 m): o escuro vira cinza, a penumbra vira luz plena.
3. Entrar na sala, abrir a porta e sair: a sala fica escurecida só com o mapa, desbota e some além de 15 m; refresh mantém; "Esquecer a memória desta cena" limpa.
4. Lanterna → Fontes de luz: + Luz fixa, arrastar, editar raios e cor, intensidade e fator geral; duplo clique no cabeçalho recolhe.
5. Lanterna → Iluminação dinâmica: o estado aparece por extenso (Ligada/Desligada).
6. Medir o fps com 30 luzes e 500 paredes (ver `docs/ESTADO.md` acima: número de referência).

### Revisão (antes do commit de fechamento)

- Código de sigilo das fontes revisado: `visaoPara` filtra pela cena ativa e pela visibilidade do token portador; `eventoPara` converte em `fonte.apagada` a fonte que deixa de
  ser visível; apagar token, personagem ou cena apaga as luzes presas; duplicar cena copia as fixas e as dos tokens copiados.
- Prints conferidos (01 a 09). `pnpm verify` verde duas vezes na revisão (271 + 12 + 6 de unidade, 69 E2E, 5,0 min cada); portas 8788/5174 livres no fim; o `pnpm dev`
  do Vilella não foi tocado.
- Sugestões aplicadas no PROJETO.md (4.1, 4.7 e "Como ficou" do Lote 6). A cor da visão no escuro na visão noturna do mestre entrou nas perguntas do fim.

### Sugestões para o PROJETO.md (aplicadas)

- 4.1: acrescentar `FonteDeLuz` (prévia do `ObjetoDeLuz`), `ConfigDaMesa.iluminacao`, `Cena.luzAmbiente/fatorDeLuz`, `Token.visaoNoEscuroM`, `Personagem.modInteligencia`.
- 4.7: o render é um pipeline de texturas com modos de mistura (erase, add, multiply e saturation); a névoa gravada na sala foi trocada pela memória no navegador.
- 4.13.1 e Lote 6: o item "Iluminação dinâmica" mostra "Ligada/Desligada"; o painel de fontes tem acender/apagar por fonte e o espaço "Com tempo" do Lote 7.
- 10 (em aberto): na visão noturna do mestre, a área vista só com visão no escuro aparece em cor normal.

## Lote 7 — Relógio da sala e objetos de luz (entregue, aguardando o roteiro manual)

### O que foi entregue

- **`shared`** (puro, testado): `relogio.ts` (`tempoDaSala`, `pausarRelogio`, `retomarRelogio`, `restanteDoObjeto`, `estagioDe`, `proximoMarcoDoObjeto`, `formatarRestante`), `objetos.ts` (`dentroDoAlcance`, `maoLivre`,
  `objetoParaVisao`, `relogioParaVisao`, `modelosParaJogador`, `modelosPadrao`) e `tochas.ts` (as intenções de tocha, ponto e mochila). `luz.ts` agora trata os cinco portadores (`luzVisivelPara` recebe um contexto, `resolverLuzes` aceita pontos).
  `nucleo.ts`: `processarSistema` (a intenção interna do tempo), `visaoPara`/`eventoPara` com o instante real e o filtro por `tempoParaJogadores`, exportação **v8** (importa v1 a v7).
- **Modelo**: `ObjetoDeLuz` (a `FonteDeLuz` evoluída, mesma coleção `luzes`), `ModeloDeObjeto`, `PontoDeLuz`, `RelogioSala`, `ConfigDaMesa` completa, `Personagem.mochila`; `Estado.modelos/pontos/relogio/acendimentos`.
- **Sala**: o agendador guarda um vencimento `luz.marco` por objeto (próximo estágio, fim ou fim de modificador); pausar cancela, retomar reagenda; o alarm chama `processarSistema`. Ao acordar, o que acabou sai. Banco: modelos por migração, luzes do Lote 6
  lidas por `objetoDoBanco` (sem reescrever linhas), relógio em `meta`. Gancho `POST /teste/avancar-relogio?ms=N` (só `MODO=teste`).
- **Interface**: relógio e botão de pausa no fim do menu do mestre, selo "Mesa pausada" para todos; alça da tocha junto ao token (uma por mão, tempo embaixo; arrastar para entregar, pôr no suporte ou segurar sobre o inflamável com o anel; dois cliques apagam/reacendem;
  botão direito: guardar, pegar do suporte, apagar); ícones dos pontos e dos objetos neles; painel "Fontes de luz" com Fixas, Variáveis (tempo, −1 min/+1 min, lixeira, intensidade), Pontos (+ Suporte, + Inflamável) e detalhe (saldo, histórico, modificadores de raio);
  mochila no editor do item; seções "Mesa" e "Objetos de luz" na aba Configurações (só mestre); luz que tremula mais no estágio "morrendo".

### Como rodar

- `pnpm verify`. Prints: `PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-7` (o filtro evita o teste de fps do Lote 6).

### Verificação

- `pnpm verify` verde duas vezes seguidas (contagens no relatório final). Unidade nova: `tochas.test.ts` (relógio falso: tocha de 30 min apaga aos 30; pausa de 5 min empurra o fim; penalidade; ajuste do mestre e histórico; terceira tocha com 2 mãos; inflamável antes de `segurarS`;
  entregar fora do alcance; tocha alheia; importar v7 como v8; sigilo oculto/estágio/exato em snapshot e eventos; o mestre nunca recebe `saldoMs`/`acesaDesdeSala`; nenhum cliente manda o vencimento; alcance Chebyshev).
- E2E novo (`e2e/tests/tochas.spec.ts`, 10 testes): mochila x−1 novas e 1 usada e refresh sem mudar o tempo; dois cliques e botão direito; entregar com o saldo e a tocha alheia; fim do tempo, pausa e retomada; inflamável (anel); suporte e ponto oculto; frames sem saldo
  (oculto, estágio, exato); vencimento não aceito do cliente; painel do mestre, configurações e modelos; criar ponto no mapa.
- Expectativas antigas alteradas: versão da exportação 7 → 8 (unidade, `assets.spec.ts`, `interface.spec.ts`); `acesa: boolean` → `estado` nos testes e nos prints do Lote 6 e na semente; `visaoPara` do mestre já não é o mesmo objeto (o relógio e as luzes vão na forma do navegador);
  lista de chaves da exportação ganhou `modelos`, `pontos`, `relogio`; "exportar → importar" agora volta com a mesa pausada; `{ versao: 8 }` deixou de ser um caso inválido (virou 9); `luzVisivelPara` mudou de assinatura.
- Prints (1600×900) em `PRINTS_DIR`: 01 tocha na mão com tempo, 02 duas tochas, 03 anel ao segurar sobre o inflamável, 04 fogueira acesa, 05 tocha no suporte, 06 painel de fontes com variáveis, 07 detalhe com histórico e modificadores, 08 e 08b mochila (jogador e mestre),
  09 e 09b configurações da mesa e modelos, 10 e 10b mesa pausada (mestre e jogador).

### Gancho de teste

`window.__tabletop` ganhou `alcas()` (id, estado, portador, rótulo de tempo, posição na página), `pontos()` e `anelDeAcender()` (0 a 1). Na sala, `POST /teste/avancar-relogio?ms=N` (404 fora do `MODO=teste`).

### Decisões

- **Dois formatos num schema só**: `ObjetoDeLuz` tem `saldoMs`/`acesaDesdeSala` (só na sala) e `restanteMs`/`contando`/`estagio`/`fatorDeRaio` (só no navegador); `objetoParaVisao` é o único caminho para a tela, no snapshot e em todo evento `fonte.*`.
- **Marcos**: um vencimento por objeto no agendador, +5 ms de folga; `processarSistema` tem tolerância de 50 ms no fim; o estágio muda com um `fonte.editada` reenviado (o navegador recalcula nada).
- **Mochila no relógio**: um objeto guardado fica `apagada` e conserva o saldo; objeto `consumida` sai da coleção com o histórico (assumido).
- **Pausa e config que muda o que o jogador vê mandam snapshot a todos** (`mesa.pausar/retomar`, `tempoParaJogadores`, estágios, visibilidade de ponto).
- **O relógio do jogador não leva o tempo da sala** (`acumuladoMs: 0`), e os modelos dele vêm sem a duração fora do modo `exato`.
- **Exportar** guarda saldo e histórico (dado da campanha) e restaura a mesa **pausada**; `acendimentos` nunca entram.
- (assumido) entregar exige o alcance também para o mestre; apagar ou reacender objeto de ponto exige alcance para o jogador (`luz.apagar` apaga, `ponto.usar` reacende); tirar do suporte: qualquer jogador com token ao alcance e mão livre.
- (assumido) a tocha apagada continua ocupando a mão; apagar com a penalidade maior que o que sobra consome a tocha.
- (assumido) ponto com objeto e posição mudada manda snapshot novo; modelo em uso não se apaga; `modelo.editar` não altera objetos já criados (cada objeto copia a luz e a duração).
- Decimais do histórico em pt-BR ("Raio ×0,5").

### Desvios do plano

- `FonteDeLuz.acesa` virou `estado` também nas intenções `fonte.criar/editar` (mudança de protocolo, documentada).
- O modelo de objeto fica em `Estado.modelos` (coleção própria, intenções `modelo.*`), não dentro de `ConfigDaMesa`.
- `tocha.alternar` tem capacidade `null` (conferida dentro: depende do portador); `ponto.pegar` é intenção própria.
- Clique direito do suporte usa o menu "Pegar do suporte" (não há arrastar a tocha do suporte).
- Nenhuma dependência nova.

### Frágil / não verificado

- Arrastar a alça no canvas foi testado com mouse sintético no Chrome; toque (celular) não.
- A contagem do inflamável usa o relógio do navegador (3 s + 60 ms) e a sala confere com 300 ms de tolerância; rede muito lenta pode recusar (`segurar_incompleto`) e o jogador tenta de novo.
- O anel e as alças sobrepõem-se quando um objeto no ponto fica perto da mão do token (cuidado ao posicionar pontos a menos de 1 quadrado da alça).
- Com a sala fora do ar por muito tempo, o relógio dela continua (é o tempo real): ao voltar, tochas podem ter acabado.
- O mestre "vendo como" um jogador recebe o tempo que o mestre recebe (a visão filtrada é só de tela).
- Não testado com um banco real do Lote 6 (a leitura por `objetoDoBanco` é coberta por teste de unidade; o banco do Vilella não foi aberto).
- A ordem das intenções `ponto.acenderInicio` no E2E não devolve evento (é transitória): quem testa precisa só enviar.

### Roteiro manual (pendente)

1. Tocha de 2 minutos (editar o modelo na aba Configurações): acender pela mochila, refresh, pausar, retomar; conferir o tempo na alça.
2. Entregar a tocha a outro perfil arrastando a alça; tentar com um terceiro perfil (não deve conseguir).
3. Pôr a tocha num suporte e pegar de volta pelo botão direito.
4. Acender uma fogueira segurando 3 s sobre o inflamável (anel); soltar antes não acende.
5. Apagar com dois cliques (com penalidade configurada) e devolver 1 min pelo painel do mestre; conferir o histórico.
6. Trocar "O que os jogadores veem do tempo" para estágio e oculto e olhar o F12 do jogador.

### Revisão (antes do commit de fechamento)

- Sigilo do tempo revisado: `objetoParaVisao` é o único caminho para o navegador (snapshot e eventos `fonte.*`); `saldoMs`/`acesaDesdeSala` nunca saem; o jogador recebe
  `restanteMs` só no modo exato e `estagio` só no modo estágio; ponto oculto vira luz fixa para o jogador; o vencimento (`processarSistema`) não está no `IntencaoSchema`.
- Pendência pequena (corrigir no Lote 9): a tocha na mão só chega ao jogador se o token do personagem estiver na cena ativa; quem edita o personagem deveria vê-la na mochila mesmo assim.
- Prints conferidos (01 a 10b). `pnpm verify`: rodada 1 verde; rodada 2 com uma falha de demora no primeiro teste da rodada (`assets.spec.ts:67`, a página de um jogador não abriu
  em 150 s, rodada inteira em 9,1 min); repetidas as duas rodadas: verdes (319 + 12 + 6 de unidade, 79 E2E, ~6 min cada). Portas 8788/5174 livres no fim.
- Sugestões aplicadas no PROJETO.md (4.1 e "Como ficou" do Lote 7). As perguntas do agente entraram nas perguntas do fim.

### Sugestões para o PROJETO.md (aplicadas)

- 4.1: `Estado.modelos` e `Estado.pontos` como coleções, `PontoDeLuz` (o nome `Ponto` é a coordenada), `RelogioSala`, o objeto em dois formatos (sala × navegador) e `ConfigDaMesa.estagios`.
- 4.8: a exportação restaura com a mesa pausada; apagar/reacender objeto de ponto exige alcance para jogador; o relógio do jogador não leva o tempo da sala.
- Lote 7: a intenção do vencimento é `processarSistema` (fora de `IntencaoSchema`); gancho `/teste/avancar-relogio`.
- Perguntas ao Vilella: alcance para o mestre entregar; tocha apagada na mão; modelo editado atualiza objetos existentes?

## Lote 8 — Dados e chat (entregue, aguardando o roteiro manual)

### O que foi entregue

- **`shared`** (puro, testado): `dados.ts` (parser `lerExpressao`, `rolar`, `dobrarDados`, `d20Natural`, `fonteCrypto` com rejeição, `fonteComSemente` só para testes e ganchos), `rolagens.ts` (modelos: `rolarAtaque`, `rolarTeste`, `expressaoDoD20`, `pedidoDeAtaque`, `pedidoDeTeste`: a ficha do Lote 9 usa), `chat.ts` (`Mensagem`, `interpretarChat`, filtro `mensagemVisivelPara`/`mensagemParaUsuario`/`chatParaUsuario`, `registrarMensagem` = limite por segundo, `AJUDA_DO_CHAT`) e `chatnucleo.ts` (monta a mensagem e rola). `processar` ganhou um 5º parâmetro opcional (a fonte de aleatoriedade; padrão `crypto`).
- **Protocolo**: intenções `chat.enviar`, `dado.rolar`, `chat.modelo`, `chat.anteriores`, `chat.limpar`; eventos `chat.mensagem` (filtrado) e `chat.limpo`; mensagem da sala `chat.anteriores`; erro `muitas_mensagens`. Detalhe em `docs/protocolo.md`.
- **Sala**: tabela própria `chat` (migração 6, aditiva), snapshot com as últimas 200 mensagens visíveis (leitura paginada + filtro por usuário), `chat.anteriores` filtrado, limpar, limite de 10 mensagens/s por conexão, gancho `POST /teste/dados?semente=N`. O estado em memória nunca acumula o chat.
- **Interface**: aba Chat com presença compacta no topo, conversa, cartões de rolagem (total grande, dados ao passar o mouse com os descartados riscados, 20 e 1 naturais em dourado e vermelho), sussurro e oculta com etiqueta, caixa fixa no rodapé com "Como:", Enter envia, Shift+Enter quebra a linha, seta para cima/baixo percorre as últimas enviadas, `/?` só na tela, formulário de **Modelos** (ataque e teste, com seletor normal/vantagem/desvantagem), "Limpar o chat" com confirmação (mestre), "Carregar anteriores", selo de não lidas no ícone do Chat. Dados rápidos rolam de verdade (Shift+clique oculto, se puder); o "Em breve" saiu.

### Como rodar

- `pnpm verify`. Prints: `PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-8`.

### Verificação

- Unidade nova: `dados.test.ts` (parser válido/inválido/limites, `kh`/`kl`, crítico dobra os dados, teste com CD, distribuição do d20 em 100 mil rolagens com faixa por face e qui-quadrado, rejeição sem viés, rolagem reproduzível por semente), `chat.test.ts` (comandos, `/w` por nome com espaço, sigilo de sussurro e `/gr` em snapshot, evento e `chat.anteriores`, `/gr` recusado sem `dado.rolarOculto`, schema descarta resultado do cliente, limite de 2000 e de 10/s, chat fora da exportação), `apps/server/src/armazenamento.test.ts` (histórico, reinício, **banco antigo sem a tabela abre sem quebrar**, importar não apaga o chat; usa `node:sqlite` como adaptador).
- E2E novo (`e2e/tests/chat.spec.ts`, 11 testes): resultado mandado pelo cliente ignorado (inspeção do frame e do resultado); rolagem oculta do mestre e sussurro entre dois jogadores ausentes em **todo** frame de um terceiro (inclusive após refresh e no `chat.anteriores`); `/gr` recusado sem permissão; dados rápidos → chat de todos e Shift oculto; histórico sobrevive ao refresh e ao reinício da sala, limpar com confirmação; "Como:"; caixa (Enter/Shift+Enter/seta/`/?`/erros/2000); limite de 10/s; modelos; selo de não lidas; 230 mensagens (200 + anteriores).
- Expectativas antigas alteradas (`e2e/tests/interface.spec.ts`): os dados rápidos já não mostram `aviso-dados` nem "nada vai para a sala": agora enviam `dado.rolar` e aparecem no chat; a caixa do chat deixou de vir desabilitada com o aviso do Lote 8.
- Prints (1600×900) em `PRINTS_DIR`: 01 conversa e rolagens, 02 vantagem com o dado riscado, 03 20 e 1 naturais, 03b chat da Brisa, 04 ataque com crítico, 05 testes com CD (falha e sucesso) e simples com desvantagem, 06/06b sussurro (quem recebe × terceiro), 07/07b rolagem oculta (mestre × jogador), 08/08b dados rápidos, 09 selo de não lidas.

### Gancho de teste

`POST /teste/dados?semente=N` na sala (só `MODO=teste`; sem `semente` volta ao `crypto`; `/teste/zerar` também). Sementes dos prints: 36 = 20 natural no primeiro d20, 7 = 1 natural, 602 = vantagem com 4 e 17, 1 = d20 médio.

### Decisões

- Só a notação viaja; o schema (zod) descarta qualquer resultado do cliente. A mensagem usa o `seq` do evento e o id `m<seq>`.
- `como` guarda `{ personagemId, nome, retratoHash? }` dentro da mensagem (quem lê não vê o personagem na ficha). O retrato de mensagem **pública** vira visível a quem lê (`Estado.retratosDoChat`, só da sala); o de sussurro não.
- O crítico vale pelo d20 que **ficou** (com vantagem, o maior); dobra a quantidade de dados de cada termo do dano (limite de 200), não os modificadores; o dano rola também no erro e na falha crítica.
- `/r` aceita comentário depois da expressão (o maior começo válido); `[[...]]` também em `/em` e `/w` (até 10).
- `emSala` na mensagem só vai ao jogador no modo `tempoParaJogadores = exato`.
- Capacidade `null` em `chat.enviar`, `dado.rolar`, `chat.modelo` e `chat.anteriores` (oculta conferida dentro); `chat.limpar` = `mesa.configurar`.
- (assumido) o mestre vê todos os sussurros e todas as rolagens ocultas; o chat não entra na exportação nem é apagado pela importação; o selo de não lidas não conta as minhas mensagens nem o histórico presente ao abrir; seta para cima **traz de volta** a última mensagem para editar (não reenvia); `/?` é só da tela; `/w` para si mesmo é permitido; teste com CD acerta com total ≥ CD.
- (assumido) a presença ficou compacta (uma linha por pessoa, "★" marca quem sou eu).

### Desvios do plano

- `Mensagem.como` é um objeto (`personagemId`, `nome`, `retratoHash?`), não só o id; `Mensagem` ganhou `emReal`, `acao`, `inline`.
- Nenhuma dependência nova (o teste do servidor usa o `node:sqlite` do Node 24, importado dinamicamente).

### Frágil / não verificado

- Cada snapshot (inclusive os enviados a todos, ao pausar ou levar o grupo) relê o histórico do SQLite por usuário: barato numa mesa, mas conta linhas lidas no deploy futuro (4.5).
- O chat carregado no navegador é trocado pelo snapshot ao reconectar (as "anteriores" já carregadas somem).
- Nenhum teste com imagem de retrato real (a regra de `retratosDoChat` é coberta só por unidade).
- O limite de 10/s fica em memória: a sala hibernada zera a janela (inofensivo).
- Não testado com o banco real do Vilella (a migração é coberta por teste com o banco "antigo" simulado).

### Roteiro manual (pendente)

1. Rolar um ataque com vantagem pelo formulário de Modelos e ler o cartão (passar o mouse nos dados).
2. Sussurrar para um jogador (`/w Nome texto`) e conferir no F12 de um terceiro que nada chega.
3. `/gr 1d20` como mestre e como jogador (sem e com `dado.rolarOculto`).
4. Falar "Como:" um personagem (com retrato) e conferir nos outros perfis.
5. Dados rápidos (clique e Shift+clique), refresh e reinício da sala; limpar o chat.

### Revisão (antes do commit de fechamento)

- O agente foi interrompido no meio (a sessão anterior terminou) e retomado; o que já estava no disco foi aproveitado.
- Sigilo do chat revisado: um filtro só (`mensagemParaUsuario`) para snapshot, evento e `chat.anteriores`; `/gr` vira `visivelPara: { ids: [] }` (autor e mestre);
  o gancho `/teste/dados` só existe com `MODO=teste` (conferido no `index.ts` e de novo na sala).
- Prints conferidos (01 a 09). `pnpm verify` verde duas vezes na revisão (377 + 17 + 6 de unidade, 90 E2E, ~6,2 min cada); portas 8788/5174 livres no fim.
- Sugestões aplicadas no PROJETO.md ("Como ficou" do Lote 8); as perguntas do agente entraram nas perguntas do fim.

### Sugestões para o PROJETO.md (aplicadas)

- Lote 8: `Mensagem.como` é objeto; `dado.rolar` é a intenção dos dados rápidos; erro `muitas_mensagens`; `/teste/dados`; `Estado.retratosDoChat` (interno).
- 4.13.1: a presença do chat ficou compacta; os Modelos de rolagem moram num botão ao lado do "Como:".
- Perguntas ao Vilella: o mestre vê todos os sussurros? a seta para cima deve reenviar em vez de trazer de volta? o retrato de quem fala pode ser visto por quem não vê a ficha?

## Lote 9 — Ficha 5e (entregue, aguardando o roteiro manual)

### O que foi entregue

- **`shared`** (puro, testado): `ficha.ts` (zod `FichaSchema` com só PV obrigatório; derivação `derivar`: modificadores, proficiência pelo nível total, salvaguardas, perícias, percepção passiva, iniciativa, CD e ataque de magia por classe, nível de conjurador e espaços pela tabela de multiclasse do PHB 2014, pacto do Bruxo à parte, dados de vida, deslocamento em metros;
  `descansoCurto`/`descansoLongo`; `aplicarOperacoes` ({ caminho, valor }, valida a ficha inteira e 256 KB); `operacoesDeDiferenca`; arquivo `tabletop-ficha`; `absorverMochila`, `ajustarNovas`, `novasDoModelo`). `srd/` (classes, perícias, tabelas de espaços e pacto) com `ATRIBUICAO-SRD.md` (CC-BY-4.0); nenhum texto de magia.
  `mapa.ts`: `fichaVisivelPara` e `personagemParaUsuario` (o filtro de sigilo). `luz.ts`: tocha na mão visível a quem edita; `modInteligenciaDe` lê a ficha com o campo antigo de reserva.
- **Protocolo**: `ficha.alterar` agora é `{ personagemId, operacoes }`; exportação **v9** (importa v1 a v8; a `mochila` vira `ficha.itens`); `ficha.verOutras` voltou a valer (ver abaixo). Detalhe em `docs/protocolo.md`.
- **Sala/banco**: o banco do Lote 8 abre como estava; a mochila é absorvida **só na leitura** (a linha antiga continua intacta até o personagem mudar). Nenhuma migração SQL nova.
- **Interface**: janela flutuante da ficha (`apps/web/src/ficha/`), arrastável pelo cabeçalho e redimensionável pela quina, várias ao mesmo tempo, com abas Principal, Magias, Características, Equipamento, Notas e Configurar (o editor do item). Duplo clique (ou Enter) no item das Fichas abre; item novo abre em Configurar.
  Todo número rolável é um botão (atributos, salvaguardas, perícias, iniciativa, ataques e dano, ataque de magia, dado de vida, teste contra a morte); seletor Normal/Vantagem/Desvantagem no cabeçalho vale para o próximo d20; a rolagem sai "Como:" o personagem. Descanso curto e longo com confirmação. Exportar (pasta `fichas/` ou download) e importar (arquivo, com confirmação) na aba Configurar.

### Como rodar

- `pnpm verify`. Prints: `PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-9`. Fixture: `fixtures/fichas/darion.json` (formato do arquivo de ficha).

### Verificação

- Unidade nova: `ficha.test.ts` (Darion: modificadores, salvaguardas +11/+8/+2/+2/+2/+0, as 18 perícias, passiva 12, proficiência +4, iniciativa +4, CD 14, ataque +6, espaços 4/3/3/1 para Clérigo 5 + Patrulheiro 5, 30 ft = 9 m; multiclasse com Bruxo; meio e terço conjurador; especialista; descansos; operações; `ficha.alterar` de quem não edita; 256 KB; sigilo com e sem `ficha.verOutras` no snapshot e nos eventos; tocha na mão e quem edita, com as transições no `eventoPara`; migração da mochila; v8 → v9) e um teste do banco antigo em `apps/server/src/armazenamento.test.ts`.
- E2E novo (`e2e/tests/ficha.spec.ts`, 8 testes): números do Darion na tela e PV do jogador que o mestre vê (uma única `ficha.alterar` para três campos); jogador não edita ficha de outro (nem forçando); ataque e perícia com vantagem no chat de todos; exportar → importar devolve a mesma ficha; frames do jogador sem a ficha (ligando e desligando `ficha.verOutras`); descansos; janelas (várias, arrastar, redimensionar); tocha na mão sem token em cena.
- Expectativas antigas alteradas: versão da exportação 8 → 9 (unidade, `assets.spec.ts`, `interface.spec.ts`); `{ ...boa, versao: 9 }` virou 10 como caso inválido; `ficha.alterar` com `pvAtual` virou `operacoes` (unidade e E2E); a capacidade `ficha.verOutras` agora manda snapshot a todos (`personagens.test.ts`); nos E2E antigos o editor do item abre por duplo clique na janela (aba Configurar), o PV está na aba Principal, a mochila na aba Equipamento e "Importar ficha" já não está desabilitado (`interface.spec.ts`); o item de uma pasta visível sem `ficha.verOutras` mostra "ficha oculta" em vez dos PV (`fichas.spec.ts`).
- Prints (1600×900) em `PRINTS_DIR`: 01/01b principal, 02/02b magias com espaços e lista, 03 características, 04 equipamento com a tocha e "Acender", 05 notas, 06 configurar, 07 duas fichas, 08/08a cartões do ataque e da perícia com vantagem, 09 chat do outro jogador, 10/10b descanso longo, 11/11b jogador sem e com `ficha.verOutras`.

### Decisões

- Ficha **esparsa**: só `pvAtual`/`pvMax` obrigatórios; o resto tem padrão na leitura. `Personagem.ficha` é opcional (ausente para quem não a vê).
- Sigilo num filtro só (`personagemParaUsuario`) para snapshot e eventos; sem a ficha o item leva `modInteligencia` já calculado (a memória do mapa precisa). Mudança que o jogador não enxerga nem chega.
- Quem edita ou a pasta mudou: a sala reenvia os objetos de luz do personagem (`fonte.editada`) para o filtro decidir se aparecem ou somem.
- (assumido) Quem não é mestre **não aumenta** a quantidade de item com `modeloId` (só o mestre repõe tochas, como o `mochila.ajustar` do Lote 7); gastar vale.
- (assumido) Meio-conjurador sozinho usa `ceil(nível/2)` (nível 2+) e terço `ceil(nível/3)` (nível 3+), que reproduz a tabela da classe; multiclasse soma o piso por classe. Guerreiro e Ladino só conjuram pelas subclasses Cavaleiro Místico e Trapaceiro Arcano.
- (assumido) Acerto do ataque: valor fixo ou fórmula (atributo + proficiência + bônus); sem acerto o ataque só rola o dano (`/r` no chat, com o nome). Descanso longo devolve metade dos dados de vida (mínimo 1), dos maiores primeiro, zera PV temporário e testes contra a morte.
- (assumido) Fixture: Patrulheiro (Caçador) 5 e Clérigo 5; nomes cortados do PDF ficam com reticências ("Machadinho …"); recursos (Flechas 9, Labareda Protetora 2/longo, Radiação do Amanhecer 1/curto) e 3 tochas (item com `modeloId`) são suposições a conferir na ficha impressa.
- (assumido) Importar a ficha é por arquivo (seletor do navegador); a pasta `fichas/` só recebe a exportação.

### Desvios do plano

- Os PV e a mochila saíram do editor do item para as abas Principal e Equipamento; o campo `modInteligencia` continua em "Token padrão e visão" só como reserva.
- Nenhuma dependência nova.

### Frágil / não verificado

- Arrastar e redimensionar testados com mouse sintético; toque (celular) não. A janela não guarda posição entre sessões.
- Duas pessoas no mesmo campo: vale a última, e o que o navegador já enviou fica por cima por 2,5 s ou até o eco da sala.
- Escrita em `fichas/` (File System Access) não testada no E2E (sem pasta, o teste cobre o download).
- Chave numérica em operação (`espacosGastos.1`) cria lista em vez de objeto quando o pai não existe: a interface manda o objeto inteiro nesses casos.
- Texto de magia e características vem vazio no Darion (o Lote 10 importa do PDF).
- Não testado com o banco real do Vilella (a leitura é coberta pelo teste com banco antigo simulado).

### Roteiro manual (pendente)

1. Montar à mão a ficha de um personagem do grupo (classes, atributos, proficiências) e conferir os derivados.
2. Rolar ataques, perícias e salvaguardas pela ficha (com vantagem) e ler os cartões no chat dos outros.
3. Descanso curto e longo; exportar a ficha, mudar algo e importar de volta.
4. Ligar e desligar "Ver fichas dos outros" e olhar o F12 de outro jogador.
5. Acender a tocha pelo Equipamento com o token fora da cena ativa.

### Revisão (antes do commit de fechamento)

- Sigilo revisado: `personagemParaUsuario` tira `ficha` e `mochila` de quem não vê a ficha; a tocha na mão chega a quem edita o personagem (pendência do Lote 7 resolvida).
  Detalhe pequeno que ficou: os objetos usados na mochila (portador `mochila`) ainda chegam a quem vê o item sem ver a ficha.
- Prints conferidos, inclusive os que o agente não abriu (01, 02, 04, 06, 07, 11). `pnpm verify` verde duas vezes na revisão (424 + 18 + 6 de unidade, 98 E2E, ~6,9 min cada);
  portas 8788/5174 livres no fim. A mesa do Vilella rodava ao mesmo tempo em 8787/5173 (cópia do main num worktree), sem interferir.
- Sugestões aplicadas no PROJETO.md (4.1 e "Como ficou" do Lote 9); as perguntas do agente entraram nas perguntas do fim.

### Sugestões para o PROJETO.md (aplicadas)

- 4.1: `Personagem.ficha?: Ficha` (esparsa) no lugar de `{ pvAtual, pvMax }`; `mochila` só como formato antigo; `ficha.alterar` por operações.
- 4.9 e 10: `ficha.verOutras` volta a decidir quem vê a FICHA (a pasta decide o item); exportação v9; formato `tabletop-ficha`.
- Perguntas ao Vilella: jogador pode repor tochas na própria ficha? importar também de dentro de `fichas/`? a janela deve lembrar a posição?

---

## Próximo: Lote 10 — Importação da ficha em PDF

Ver `PROJETO.md`, seção 7.
