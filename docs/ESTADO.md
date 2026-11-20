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
  `/ws`; desde o C1 tudo sob `/api/m/<id>`, ver "Mesas C1") e `Autenticacao`/`AutenticacaoDev` (cookie `tabletop_sessao`, por mesa); Durable Object `Sala`
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
  `e2e/.estado-sala`, `MODO=teste`), útil para depurar um teste. Outras portas (Q5): variáveis
  `E2E_PORTA_SALA` e `E2E_PORTA_WEB` (ver "Ajustes Q5").
- A campanha real é zerada apagando `apps/server/.wrangler/state`.

### Isolamento do E2E

O Playwright **não** usa mais o `pnpm dev`. Ele sobe dois `webServer` próprios:
`wrangler dev --port 8788 --persist-to ../../e2e/.estado-sala --var MODO:teste` (hoje por `apps/server/scripts/dev-e2e.mjs`, que lê `E2E_PORTA_SALA`) e `vite --mode e2e`
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

(Lista da época do Lote 4b; os Lotes 6 a 14 deram função a quase tudo. Seguem só interface: "Eventos", do 7b, e os itens Artefato, Tesouro e Handout, marcados "em breve" em `AbaFichas.tsx`.)

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
- (assumido; **mudou em 2026-11-10**: o mestre entrega, põe e tira de longe, só o jogador precisa do alcance) entregar exige o alcance também para o mestre; apagar ou reacender objeto de ponto exige alcance para o jogador (`luz.apagar` apaga, `ponto.usar` reacende); tirar do suporte: qualquer jogador com token ao alcance e mão livre.
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
- (assumido) Fixture: Patrulheiro (Caçador) 5 e Clérigo 5; nomes cortados do PDF ficam com reticências ("Machadinho …"); recursos (Flechas 9, Labareda Protetora 2/longo, Radiação do Amanhecer 1/curto) e 3 tochas (item com `modeloId`) são suposições a conferir na ficha impressa. **2026-11-10**: tochas e flechas passaram aos números do PDF (9 tochas; 7 flechas de máximo 20).
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

## Lote 10 — Importação da ficha em PDF (entregue, aguardando o roteiro manual)

### O que foi entregue

- **`shared`** (puro, testado): `importarFichaPdf.ts` — `importarFichaDoPdf(pedacos)` recebe os pedaços de texto com posição (`{ pagina, str, x, y, largura, altura }`) e devolve `{ reconhecido, nome?, ficha, incertos: { caminho, motivo, trecho }[], trechos }`
  (`trechos` é o texto cru do PDF por seção, para a tela de revisão). `pedacosDoTextoDoPdf` converte os itens do `getTextContent()` do pdf.js. Nada de coordenada absoluta: cada valor é procurado em relação a um rótulo (acima, abaixo, na mesma linha), medido na **escala** do documento
  (altura mais comum do texto da 1ª página contra a do PDF de referência), por isso A4 e Carta dão a mesma ficha. Âncoras em PT e EN.
  - **Colunas** das páginas de magia e de características: picos de `x` do começo das linhas, bem separados; o fluxo lê página, coluna, de cima para baixo. Cada magia é um bloco (título, escola e nível, campos, descrição) achado pela linha "Tempo de Conjuração:"/"Casting Time:", e a descrição entra **inteira** (campos + texto, com as anotações da mesa, como o "UPDATE" de Convocar Familiar).
  - **Proficiência pela conta**: valor − modificador = bônus de proficiência (o do próprio PDF) → proficiente; 2× → especialista (só perícia); 0 → nenhuma; outro valor → `incertos`, e o valor lido se mantém como bônus extra (nada de chute).
  - **Nomes cortados**: o que termina em "…" só é completado quando **uma** magia da lista do próprio PDF começa com o trecho ("Cure Wound…" → "Cure Wounds - Curar Ferimentos", "Chill Touch (…" → "Chill Touch (Mago)"), marcado com o motivo "recuperado". Os demais ficam como vieram, em `incertos`, com as sugestões do equipamento no motivo ("Armadura de c…" → "Armadura de couro").
  - **Ataques** como valor fixo ("DC14" vira `cd`, "-" fica sem acerto); **recursos** (caixas "Total") sempre em `incertos`; CA, iniciativa e deslocamento vêm da linha de três números acima do PV máximo (o PDF não imprime esses rótulos).
- **Navegador**: `pdfjs-dist` 6.5.438 do npm; o worker é empacotado pelo Vite (`pdf.worker.min.mjs?url`, arquivo local, nada de CDN). `ficha/extrairPdf.ts` lê o texto com posição; `ficha/useImportadorDePdf.tsx` cuida do fluxo; `ficha/RevisaoDoPdf.tsx` é a tela de revisão.
- **Interface**: na aba Fichas, "⋯" no item (para quem edita) → "Importar ficha (PDF)", e o botão "Novo a partir de PDF" (mestre); na aba Configurar da ficha, "Importar ficha (PDF)".
  A **tela de revisão** é uma janela grande (modal) com cada seção (cabeçalho, atributos e salvaguardas, perícias, números gerais, ataques, magias, características, equipamento, recursos, notas), o valor lido à esquerda e o trecho do PDF à direita. Os incertos ficam em amarelo, com o motivo; os que têm campo
  (nome e tipo do ataque, PV atuais e temporários, recursos, proficiência de perícia ou salvaguarda, subclasse, idiomas) são editáveis. "Confirmar importação" manda a ficha; importar por cima pede mais uma confirmação ("Substituir a ficha"; retrato, token e pasta ficam); "Cancelar" (ou Esc) descarta tudo.
- **Protocolo**: nada mudou. Importar por cima é um `ficha.alterar` com caminho vazio (a ficha inteira); "Novo a partir de PDF" é um `personagem.criar` com a ficha. O PDF nunca é enviado, só o JSON. Sem migração: o banco da campanha do Vilella não foi tocado.

### Como rodar

- `pnpm verify`. Prints: `PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints lote-10`. PDF de referência: `fixtures/fichas/darion.pdf`.

### Verificação

- Unidade nova `importarFichaPdf.test.ts` (22 testes): o pdf.js (build `legacy`, em Node) lê o PDF do Darion e confere a seção 8 — cabeçalho, atributos, salvaguardas, gerais (proficiência +4, CA 20, iniciativa +4, 30 ft = 9 m, PV 97, passiva 12), as 18 perícias com a proficiência deduzida, conjuração (Sabedoria, CD 14, +6, espaços 4/3/3/1), as listas de magias por nível (6/10/6/2), os 20 ataques na ordem, as 13 características, o equipamento;
  os nomes cortados (3 machadinhos, "Armadura de c…", "Sun Blade - un…") e o dano cortado em `incertos` sem chute; "Cure Wound…" e "Chill Touch (…" recuperados e marcados; recursos todos incertos; PV atuais e temporários, idiomas e o "10" sem rótulo em `incertos`; descrição de Convocar Familiar inteira, com o "UPDATE".
  Sintéticos: rótulos em inglês, A4 × Carta (escala 0,92 e deslocamento) com a mesma ficha, perícia que não fecha a conta (vai para revisão), PDF que não é uma ficha 5e.
- E2E novo (`e2e/tests/importarPdf.spec.ts`, 5 testes): importar o PDF pelo menu do item (revisão com incertos em amarelo, corrige um machadinho, confirma, o mestre vê a ficha atualizada); Cancelar (e "Voltar") não manda nenhum frame `ficha.*`/`personagem.*`; nenhum frame do WebSocket leva o PDF (sem `%PDF`, sem binário) e o jogador editor também importa; "Novo a partir de PDF"; arquivo que não é PDF.
- Prints (1600×900) em `PRINTS_DIR`: 01 menu do item, 02/02b–d revisão (topo, atributos, perícias, gerais), 03/03b ataques com os incertos, 04/04b magia com a descrição e características, 05 recursos, 06 confirmação de importar por cima, 07/07b ficha importada (Principal e ataques), 08/08b Magias, 09 Configurar, 10 aba Fichas.
- Expectativas antigas alteradas: nenhuma.

### Decisões

- (assumido) O pdf.js já lê num Web Worker dele; não criei outro worker para a extração (a parte nossa é leve e roda depois, no parser puro).
- (assumido) `preparada` não existe no PDF (as bolinhas são desenho): todas as magias entram preparadas, com um aviso amarelo na seção de magias.
- (assumido) Os espaços de magia do PDF só **conferem** com a tabela das classes (divergência vira incerto); a ficha não os guarda. Os dados de vida (o "10" solto) idem: a ficha calcula pelas classes.
- (assumido) A subclasse vem do texto da classe ("Hunter Ranger 5" → Patrulheiro, subclasse "Hunter", marcada para conferir); termos em inglês do PDF (Necrotic, Healing...) ficam como estão.
- (assumido) Moedas e os quatro campos de personalidade (traços, ideais, vínculos, defeitos) entram em `notas`; nome de característica em CAIXA ALTA vira "Título com Iniciais Maiúsculas".
- (assumido) Caixa de recurso: `atual` = o número grande, `max` = o "(MAX n)" do rótulo, ou o "Total", ou o atual; recarga "nunca"; caixas repetidas com o mesmo nome são descartadas (o aviso diz quantas vezes apareceu).
- (assumido) `@types/node` entrou como dependência de desenvolvimento do `shared` (já estava no repositório, nos E2E) só para o teste ler o PDF com `node:fs`; na revisão, os tipos do Node ficaram só nesse arquivo de teste (`/// <reference types="node" />`), para o código do `shared` (que roda no navegador e no Worker) não enxergar APIs do Node.

### Desvios do plano

- Nenhum no que o "Decidido antes de começar" pede. Dependência nova: `pdfjs-dist` 6.5.438 (`apps/web`; no `packages/shared` só de desenvolvimento).

### Frágil / não verificado

- Só um PDF de verdade foi testado (o do Darion); o roteiro pede o de outro jogador. Os rótulos em PT da página de conjuração (o PDF os imprime em inglês) e os rótulos em EN foram **supostos**, não vistos num PDF real.
- A leitura depende de os rótulos da ficha impressa não mudarem e de o texto ser real (PDF escaneado não funciona).
- CA, iniciativa e deslocamento vêm de "três números numa linha acima do PV máximo"; uma ficha com a linha diferente cai em `incertos`.
- Parágrafos das descrições: a linha curta que termina em ponto fecha o parágrafo; o resto vira um bloco só.
- A tela de revisão edita só os campos listados acima; o resto se corrige depois, na própria ficha.

### Roteiro manual (pendente)

1. Importar o PDF do Darion pela interface, corrigir os três machadinhos na revisão, confirmar e rolar um ataque da ficha importada.
2. Repetir com o PDF de outro jogador do grupo (anotar o que não saiu certo).
3. Importar por cima de uma ficha existente e conferir que retrato, token e pasta ficam; cancelar e conferir que nada mudou.

### Revisão (antes do commit de fechamento)

- O agente parou no meio do `verify` quando a sessão de 2026-11-07 foi encerrada; o código estava completo. Retomado em 2026-11-09: prints conferidos (revisão, ataques, recursos, ficha importada), código revisado.
- Ajuste na revisão: os tipos do Node saíram do `tsconfig` do `shared` e ficaram só no teste do PDF.
- `pnpm verify` verde duas vezes na revisão (446 + 18 + 6 de unidade, 103 E2E, ~9 min cada); portas 8788/5174 livres no fim.
- Sugestões aplicadas no PROJETO.md (4.10 e "Como ficou" do Lote 10); a pergunta do agente e duas novas (magias todas preparadas; tochas e flechas do Darion no PDF × na ficha do Lote 9) entraram em `docs/PERGUNTAS.md`.

### Sugestões para o PROJETO.md (aplicadas)

- 4.10: acrescentar que o PDF imprime CA, iniciativa e deslocamento sem rótulo (três números acima do PV máximo) e que "preparada" e os espaços gastos não saem do PDF.
- "Como ficou" do Lote 10 com o que está acima (o texto do "Decidido" já bate).
- Pergunta ao Vilella: guardar os espaços e os dados de vida do PDF na ficha, em vez de só conferir?

---

## Lote 11 — Combate: iniciativa e condições (entregue, aguardando o roteiro manual)

### O que foi entregue

- **`shared`** (puro, testado):
  - `combate.ts`: `Combate` (`entradas`, `atualId`, `rodada`) e `EntradaDeCombate` com schemas zod; `ordenarEntradas` (maior para menor; empate por Destreza, depois PJ antes de NPC, depois o nome; sem valor no fim), `proximoTurno`, `turnoAnterior`, `tirarEntrada`, `moverEntrada` e o filtro de sigilo `combateParaUsuario` / `entradaVisivelPara`.
  - `combatenucleo.ts`: as intenções (`combate.adicionar`, `tirar`, `editar`, `mover`, `ordenar`, `rolar`, `proximo`, `anterior`, `passar`, `encerrar` e `token.condicoes`), no mesmo molde do `tochas.ts`, chamadas pelo `processar`.
  - `condicoes.ts`: as 14 condições do 5e 2014 (id, nome, resumo da regra em pt-BR), os níveis de exaustão (1 a 6), o resumo da concentração e `iconesDoToken` (os marcadores que o mapa e a ficha mostram).
  - `Estado.combate?` e, no token, `condicoes?`, `exaustao?` e `concentracao?`; capacidade nova `combate.gerir` (só do mestre); evento `combate.alterado`; exportação **v10** (com a ordem de turno; de v1 a v9 continuam importando).
  - Sigilo em `visaoPara` e `eventoPara`; apagar token, personagem ou cena tira as entradas dele; esconder ou mostrar um token que está na ordem manda snapshot novo a todos.
- **Servidor**: migração 7 do SQLite (tabela `combate`, uma linha; banco antigo abre sem combate); `salvarEventos`/`salvarTudo`/`apagarTudo` cuidam dela.
- **Navegador**:
  - `OrdemDeTurno.tsx` (o painel do Lote 4b, agora completo): rodada à vista; lista com a vez em destaque (verde); mestre: Adicionar selecionados, "O grupo", entrada solta (nome, valor, escondida), editar valor, arrastar, os botões "?" (valor oculto) e olho cortado (entrada escondida), Ordenar, Anterior, Próximo turno, Rolar para todos, Tirar, Encerrar com confirmação; jogador: "Rolar" na própria entrada e "Passar o meu turno" na vez dele.
  - `MenuDoToken.tsx`: botão direito no token (menu novo; antes só existia o da tocha): mestre vê "Entrar na iniciativa"/"Sair da iniciativa" e "Condições…"; quem controla o token cai direto nas condições. Lista das 14, Exaustão 0 a 6 e Concentração (nome da magia).
  - Mapa (PixiJS): **anel verde da vez** no token (para todos que o veem), **marcadores pequenos na borda de baixo** do token (duas letras e cor por condição; até 6, o resto vira "+N") e **dica** ao passar o mouse (nome e resumo da regra); o rótulo do token desce um pouco quando há marcadores.
  - Aba Principal da ficha: seção **Condições** com as do token do personagem na cena ativa (só leitura; a regra aparece ao passar o mouse).
  - Chat: a rolagem de iniciativa aparece como "Iniciativa" (com o nome da entrada quando não há personagem).

### Como rodar

- `pnpm verify`. Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints lote-11` (PowerShell). Para ver: menu superior do mestre → ícone da lista (Ordem de turno); clicar num token com o botão direito.

### Verificação

- Unidade nova `packages/shared/src/combate.test.ts` (26 testes): ordenação com empates (Destreza, PJ antes de NPC, nome, sem Destreza, sem valor); turnos puros (rodada 1, virar, voltar, tirar a vez); **um combate inteiro no `processar` com 3 PJs e 4 NPCs** (adicionar, rolar para todos, ordenar, editar valor, avançar as 7 entradas, virar a rodada, voltar, tirar a entrada da vez, apagar o token da vez, encerrar); entrada solta, mover à mão, rolar de novo; permissões (jogador não gerencia nem com exceção; rola só a própria e só uma vez; passa só o próprio turno; condições só do mestre ou de quem edita o personagem do token, token oculto responde como inexistente); sigilo (token oculto, camada do mestre e solta oculta fora da visão e dos eventos; `valorOculto` sem número; Destreza nunca viaja; vez invisível; mudança invisível não gera evento; a rolagem de NPC é oculta e a de PJ pública; esconder token manda snapshot; apagar personagem tira a entrada) e a exportação v10 (ida e volta, v9 sem combate, combate incoerente recusado).
- Servidor, `armazenamento.test.ts` (+5): banco do Lote 10 (versão 6, sem a tabela) abre sem quebrar e a campanha continua inteira; o combate é gravado pelos eventos, regravado e apagado; importar troca o combate e `apagarTudo` o apaga; linha ilegível não derruba a sala; condições e concentração voltam do banco dentro do token.
- E2E novo `e2e/tests/combate.spec.ts` (5 testes): o mestre avança o turno e o jogador vê a vez mudar (lista e anel; rodada 2, voltar, tirar a vez, encerrar com confirmação); **frames**: a iniciativa oculta não chega ao jogador (nenhum frame do WebSocket dele leva o nome nem o valor das entradas ocultas, nem depois de recarregar a página; o Ogro chega com `valorOculto` e sem número; as rolagens dos NPCs não chegam); o jogador rola a própria iniciativa (pública no chat) e passa o próprio turno e não consegue rolar nem passar o de outro nem avançar o turno; condição e concentração aplicadas pelo jogador no próprio token aparecem para o mestre e para os outros jogadores, e na ficha; a dica do marcador e "Entrar na iniciativa" pelo menu do token.
- Prints (1600×900) em `PRINTS_DIR`: 01/02 rolagens de iniciativa no chat (mestre e jogador), 03/04 ordem de turno na rodada 2 (mestre e jogador), 05 a 07 anel da vez (jogador, mestre, Ogro), 08/09 menu do token e de condições, 10 token com 3 condições, Exaustão 2 e concentração, 11/12 dicas, 13 aba Principal da ficha.
- Expectativas antigas alteradas (só por causa do que o lote mudou): os testes que conferiam `versao` da exportação como 9 agora esperam **10** (`assets`, `ficha`, `fichas`, `luz`, `paredes`, `personagens`, `tochas` e `tokens`); em `nucleo.test.ts` a "versão inválida" passou de 10 para **11**; em `armazenamento.test.ts` a versão do esquema passou de 6 para **7**.

### Decisões

- (assumido) A entrada de token copia o **nome** do token ao entrar (não acompanha uma renomeação depois) e a **Destreza** é o valor do atributo da ficha, só se o atributo foi preenchido (copiada ao entrar e refeita ao rolar); sem Destreza conta como a menor no desempate.
- (assumido) A entrada guarda também `jogador` (o token é de personagem de jogador), para o desempate "PJ antes de NPC"; é um campo a mais em relação ao desenho do PROJETO.md.
- (assumido) Adicionar entradas reordena a lista pelos valores (quem não tem valor vai para o fim); o arrasto à mão dura até o próximo valor rolado ou editado, ou até "Ordenar".
- (assumido) O jogador rola a própria iniciativa **uma vez** (entrada sem valor); para refazer, o mestre tira o valor ou o edita. O mestre pode rolar de novo qualquer entrada (`combate.rolar` com `ids`).
- (assumido) A rolagem de entrada com valor oculto ou escondida vai oculta mesmo sendo de PJ; entrada solta rola com bônus 0 e oculta.
- (assumido) Tirar a entrada da vez passa o turno para a seguinte (e, se era a última, vira a rodada).
- (assumido) A rodada do combate que ainda não começou é 0 ("Não começou"); o primeiro Próximo abre a 1; Anterior não volta antes da rodada 1.
- (assumido) A mesa só tem **uma** seleção de token: "Adicionar selecionados" adiciona o token selecionado; acrescentei "O grupo" (os tokens dos personagens de jogador da cena do grupo) por ser o caso mais comum.
- (assumido) Token de outra cena pode entrar na ordem (o mestre decide); o jogador só recebe as entradas de tokens da cena ativa.
- (assumido) Marcadores no mapa: duas letras e uma cor por condição (Ag, Am, At, Ca, Ce, Ct, En, Ev, Ic, In, Iv, Pa, Pe, Su; E1 a E6 para a exaustão; Cn para a concentração); a regra aparece em dica ao passar o mouse (sem toque na tela).
- (assumido) O "mestre vendo como o jogador X" vê o painel da ordem como o jogador vê (só leitura) e o menu do token fica desligado.
- (assumido) A concentração carrega o resumo da regra (CD 10 ou metade do dano) só como texto; nenhum teste é feito sozinho. Nenhuma condição aplica vantagem ou desvantagem.
- Sob a visão no escuro do jogador (tons de cinza) o anel da vez também aparece cinza; em luz normal é verde.

### Desvios do plano

- Nenhum no que o "Decidido antes de começar" pede. Sem dependência nova.
- O botão do menu do token é um menu novo (o PROJETO.md fala em "o menu de botão direito do token", mas até aqui só existia o da alça da tocha).

### Frágil / não verificado

- O arrasto da lista usa o drag and drop do HTML5; a regra (`combate.mover`) tem teste de unidade, mas o arrasto com o mouse não tem E2E.
- A dica das condições só aparece com o mouse; em tela de toque não há como lê-la (a lista na ficha mostra a regra no `title`).
- O painel da ordem tem 364 px e, em janela de 1280 px, cobre o centro do mapa (o mestre pode escondê-lo no menu superior).
- O `combate.alterado` leva o combate inteiro a cada mudança (até 200 entradas); para a mesa de 8 pessoas é pequeno, mas cresce com a lista.
- A ordenação por nome usa `Intl.Collator("pt-BR")`; foi testada no Node e roda no V8 do Worker, mas não olhei o `wrangler dev` do Vilella com uma lista grande.
- Não há automação de regra (desvantagem, falha automática, teste de concentração): o 7b.

### Roteiro manual (pendente)

1. Montar um combate com 3 jogadores e 4 NPCs na mesa real: "O grupo" e "Adicionar selecionados" para os monstros, "Rolar para todos" e conferir que as rolagens dos NPCs só aparecem para o mestre.
2. Esconder o valor de um monstro ("?") e esconder outro token do mapa; olhar a tela de um jogador (ou "ver como") e conferir que o oculto não aparece.
3. Avançar vários turnos, virar a rodada, voltar, arrastar uma entrada, "Ordenar", tirar a entrada da vez e encerrar (com a confirmação).
4. Como jogador: rolar a própria iniciativa e passar o próprio turno; tentar passar o de outro (não deve aparecer botão).
5. Botão direito num token: marcar 3 condições, Exaustão e concentração; olhar as dicas, a aba Principal da ficha e a tela do mestre.
6. Exportar a campanha com o combate em andamento e importar de volta.

### Revisão (antes do commit de fechamento)

- Revisão (2026-11-09): sigilo conferido (`combateParaUsuario`, `eventoPara` que não manda mudança invisível, rolagem de NPC oculta); prints conferidos.
- **Ajuste na revisão:** quem age pela entrada (rolar a própria, passar o próprio turno, marcar condições e concentração) passou de "quem edita o personagem do token" para **quem controla o token** (`controlaToken`: edita o personagem ou está em `controladoPor`), para o familiar ou o companheiro entregue a um jogador; o mesmo vale para abrir o menu do token e os botões do painel. Teste de unidade novo em `combate.test.ts`; `docs/protocolo.md` atualizado.
- `pnpm verify` verde duas vezes depois do ajuste (473 + 23 + 6 de unidade, 108 E2E, ~9,5 min cada); portas 8788/5174 livres no fim. Sugestões aplicadas no PROJETO.md (4.1 e "Como ficou" do Lote 11); as perguntas do agente entraram em `docs/PERGUNTAS.md`.
- O texto abaixo é do agente: `pnpm verify` verde **duas vezes seguidas**: 472 (shared) + 23 (servidor) + 6 (web) testes de unidade e **108 E2E**, ~9,3 min cada; portas 8788/5174 livres no fim. Nenhum processo meu ficou de pé.
- Na primeira rodada falharam dois E2E antigos (`assets.spec.ts` e `interface.spec.ts`) só porque conferiam `versao` da exportação como 9: agora esperam 10.

### Sugestões para o PROJETO.md (aplicadas)

- 4.1: `Estado.combate?: Combate`; `EntradaDeCombate` ganha `jogador?`; `Token` ganha `condicoes?`, `exaustao?` e `concentracao?`; capacidade `combate.gerir` (só do mestre) na lista.
- 4.2/exportação: versão 10 (ordem de turno e condições).
- "Como ficou" do Lote 11 com o que está acima (o texto do "Decidido" já bate).
- Perguntas ao Vilella: (a) "Adicionar selecionados" deveria aceitar vários tokens de uma vez (seleção múltipla no mapa ainda não existe)? (b) o jogador pode refazer a própria iniciativa, ou só o mestre? (c) a dica das condições deveria também abrir por clique, para tela de toque? (d) o nome da entrada deve seguir a renomeação do token?
- Ideias para o 7b: teste de concentração com a CD sugerida; condições que aplicam vantagem ou desvantagem nas rolagens da ficha.

---

## Lote 13 — Pincel e camada de desenho (entregue, aguardando o roteiro manual)

### O que foi entregue

- **`shared`** (puro, testado):
  - `desenho.ts`: `Desenho` (`id`, `cenaId`, `autorId`, `forma`, `pontos` em metros, `cor`, `espessura`, `preenchido?`), os limites (2000 pontos, 1000 desenhos por cena, espessura 1 a 24, cor `#rrggbb`), a **simplificação do traço livre** (`simplificarTraco`, Douglas–Peucker iterativo, e `prepararTraco`, que arredonda, tira repetidos e aumenta a tolerância até caber em 2000 pontos), a geometria (`caixaDoDesenho`, `desenhoTocadoEm`, `deslocamentoNaCena`, `pontosDeslocados`, `pontosNaCena`), as regras (`desenhoVisivelPara`, `podeMexerNoDesenho`) e o limite de frequência do rascunho (`rascunhoDentroDoLimite`).
  - `desenhonucleo.ts`: as intenções `desenho.criar`, `mover`, `apagar` (um ou vários), `voltar` (apaga o meu mais recente da cena), `limpar` (mestre) e `rascunho`, no molde do `combatenucleo.ts`, chamadas pelo `processar`. O rascunho sai em `Resultado.rascunho` (nunca vira evento).
  - `Estado.desenhos`; capacidade delegável nova `desenho.criar` (ligada por padrão; campanhas antigas ganham o padrão ao carregar); eventos `desenho.criado`, `movido`, `apagado` e `limpo`; mensagens da sala `desenho.rascunhando` e `desenho.rascunhoFim`; exportação **v11** (de v1 a v10 continuam importando).
  - Sigilo em `visaoPara` e `eventoPara`; apagar a cena apaga os desenhos; duplicar a cena os duplica.
- **Servidor**: migração 8 do SQLite (tabela `desenhos (id, cena_id, dados)` com índice por cena; banco antigo abre sem desenhos); `salvarEventos`/`salvarTudo`/`apagarTudo` cuidam dela. `sala.ts` repassa o rascunho (limite de 30 ms por conexão, só a quem recebe a cena, nunca ao autor) e manda o fim de cada traço aberto quando a conexão cai.
- **Navegador**:
  - Camada de desenho no PixiJS (`mapa/camadaDeDesenho.ts`): acima do mapa, dos tokens e do **véu da luz e da memória** (por isso visível no escuro); desenhos gravados, traços em andamento (o meu e os dos outros, com um pouco de transparência) e o destaque da seleção (caixa dourada com quatro alças).
  - `SubBarraPincel.tsx` funcionando: fechar, **voltar** (desfazer o meu mais recente), selecionar, borracha, formas (livre, linha, retângulo, círculo), **preenchido** (só retângulo e círculo), paleta de **8 cores** + cor livre (seletor do navegador) e **4 espessuras**. A configuração é só da tela de quem desenha (`pincel.ts`).
  - Selecionar: o jogador seleciona e move só os próprios; o mestre, todos; **Delete** apaga o selecionado. Borracha: apaga o desenho **inteiro** que tocar (some na hora e o pedido sai ao soltar). **Esc** cancela o traço em andamento. Desenhar não muda a camada de trabalho.
  - Sem `desenho.criar`: o botão do pincel fica apagado (`aria-disabled`) com a explicação ao clicar, e a sub-barra aberta fecha sozinha.
  - Menu de camadas do mestre: "Limpar desenhos" (desabilitado sem desenhos na cena que ele vê) com **confirmação** ("Apagar os N desenhos desta cena para todos?").
  - Ao vivo: enquanto desenha, o navegador manda o traço a cada ~80 ms; os outros o veem na hora e ele some quando o desenho gravado chega, quando o autor cancela ou quando a conexão cai.

### Como rodar

- `pnpm verify`. Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints lote-13` (PowerShell). Para ver: barra da esquerda → pincel (último ícone); menu superior do mestre → Camadas → Desenho → Limpar desenhos.

### Verificação

- Unidade nova `packages/shared/src/desenho.test.ts` (37 testes): Douglas–Peucker (reta com ruído, canto, tolerância 0, 50 mil pontos sem estourar a pilha, `prepararTraco` no limite de 2000 pontos); geometria (toque em linha, traço, pingo, retângulo vazado e preenchido, círculo; deslocamento limitado à cena); limite de frequência; **permissões** (sem `desenho.criar` o jogador não desenha, não move, não apaga, não volta nem faz rascunho; a exceção por usuário devolve o pincel; o assistente não desenha; campanha antiga ganha o padrão); criar (autor posto pela sala, preenchido só em retângulo e círculo, jogador só na cena ativa, mestre em qualquer uma, id repetido, cor/espessura/pontos inválidos, **2000 pontos** e **1000 desenhos por cena**, pontos fora da cena trazidos para dentro); mover e apagar (**o jogador só os próprios, o mestre todos**, um id de fora recusa o pedido, id que sumiu é ignorado); **voltar** (só o meu mais recente da cena; nunca o dos outros); **limpar** só do mestre e só da cena; rascunho que só repassa; **sigilo** (snapshot, eventos de criar/mover/apagar/limpar e rascunho de outra cena não chegam ao jogador; o mestre recebe todos); apagar e duplicar a cena; exportação v11 (ida e volta, importar leva os desenhos, v10 sem desenhos importa, cena/autor desconhecidos, id repetido e desenhos demais recusados).
- Servidor, `armazenamento.test.ts` (+4): **banco do Lote 11 (versão 7, sem a tabela) abre sem quebrar**, sem desenhos, com a campanha inteira; criar, mover, apagar, limpar e apagar a cena voltam certos do SQLite (e a ordem de criação sobrevive ao mover); importar troca os desenhos e `apagarTudo` os apaga; linha ilegível é ignorada.
- E2E novo `e2e/tests/desenho.spec.ts` (9 testes): o jogador desenha um traço livre e o mestre vê o **rascunho ao vivo** (com o mouse ainda apertado, sem nada gravado) e depois o desenho (mesmo id); recarregar mantém; linha, retângulo preenchido e círculo de cores diferentes; **borracha** apaga o desenho inteiro e não o do mestre; **voltar** apaga só o meu (e a camada do mestre continua escolhida); o jogador não seleciona nem move o desenho do mestre e a sala recusa (`desenho.mover` e `desenho.apagar` crus: `sem_permissao`), mas move o próprio, e o mestre move e apaga (Delete) o do jogador; Esc cancela (nada gravado, rascunho some; clique sem arrastar não faz retângulo, mas faz pingo no traço livre); quem sai no meio do traço faz o rascunho sumir; **desenho no escuro** (luz ambiente 0, Brisa sem visão no escuro: a camada está acima do véu e o **pixel** do traço é a cor dele, enquanto o do lado é preto); o mestre desliga `desenho.criar` e o jogador perde o pincel na hora; "Limpar desenhos" com cancelar e confirmar apaga para todos e recarregar mantém; **frames**: o desenho de outra cena nunca chega ao jogador, o rascunho de outra cena também, e 60 rascunhos de uma vez chegam bem menos que 60.
- Prints (1600×900) em `PRINTS_DIR`: 01 sub-barra do pincel (paleta, cor livre e espessura), 02 mapa com os quatro desenhos (jogador e mestre), 03 rascunho ao vivo visto pelo mestre, 04 desenho selecionado, 05 desenhos numa cena escura vistos pelo jogador, 06 confirmação de "Limpar desenhos", 07 jogador sem a capacidade (com a explicação) e o painel do mestre.
- Expectativas antigas alteradas (só por causa do que o lote mudou): os testes que conferiam `versao` da exportação como 10 agora esperam **11** (`assets`, `ficha`, `fichas`, `luz`, `paredes`, `personagens`, `tochas`, `tokens` e `combate` em `shared`; `assets.spec.ts` e `interface.spec.ts` no E2E); em `nucleo.test.ts` a "versão inválida" passou de 11 para **12** e a lista de chaves da exportação ganhou `desenhos`; em `armazenamento.test.ts` a versão do esquema passou de 7 para **8**; em `interface.spec.ts` o pincel: `pincel-voltar` virou `pincel-fechar` (o voltar agora desfaz), as cores são 8 (eram 6) e o aviso "em breve" saiu.

### Decisões

- (assumido) Todas as intenções do pincel (criar, mover, apagar, voltar e o rascunho) exigem `desenho.criar`; sem ela o jogador perde também o direito de mexer nos próprios desenhos. Só `desenho.limpar` é do mestre (`cena.editar`).
- (assumido) `desenho.mover` leva um **deslocamento** (`dx`, `dy`), não os pontos novos; a sala o limita para o desenho continuar dentro da cena. Não há movimento ao vivo do arrasto (os outros veem ao soltar).
- (assumido) `espessura` é em **pixels do mundo** (cresce com o zoom, com piso de 1,5 px na tela), de 1 a 24; a interface oferece 2, 4, 8 e 14. O preenchimento é a própria cor com 40% de opacidade.
- (assumido) Retângulo e círculo guardam **dois pontos** (cantos opostos; centro e ponto da borda); linha, dois pontos; livre, de 1 a 2000. Um clique sem arrastar faz um pingo no traço livre, e nada nas outras formas.
- (assumido) Sem encaixe no grid: as formas seguem o mouse livremente.
- (assumido) `desenho.apagar` é idempotente (id que já sumiu é ignorado) e recusa o pedido inteiro se algum id não for do jogador; `desenho.voltar` sem nada meu não faz nada nem dá erro.
- (assumido) O mestre desenha na cena que está **vendo** (a faixa de cenas), não só na ativa; o jogador só na ativa. O "voltar" e o "Limpar" do mestre agem nessa mesma cena.
- (assumido) O jogador não vê o botão de limpar; o mestre "vendo como" um jogador só olha (o pincel fica desligado).
- (assumido) A camada "Desenho" do menu de camadas continua como no Lote 4b (escolher a camada de trabalho); ela não liga o pincel. Os desenhos aparecem sempre.
- (assumido) A exportação recusa desenho de autor que não está nos usuários do arquivo (como já faz com token e personagem).
- (assumido) O rascunho do autor aparece na tela dele como o traço de verdade; para os outros chega com 85% de opacidade. A sala guarda no máximo 16 traços abertos por conexão.

### Desvios do plano

- Nenhum no que o "Decidido antes de começar" pede. Sem dependência nova.
- O botão "voltar" da sub-barra (a seta do Lote 4b que fechava o pincel) passou a se chamar **fechar**; o **voltar** do PROJETO.md é o novo (desfazer o meu mais recente).

### Frágil / não verificado

- O rascunho é só de tela: nada o protege se a conexão engasgar no meio do traço (o autor termina e o desenho chega inteiro; o outro lado só perde o "ao vivo"). Quem **reconecta** descarta os rascunhos que tinha.
- Redesenhar é "tudo de uma vez" (um `Graphics` com todos os desenhos): com 1000 desenhos de 2000 pontos numa cena o zoom e o arrasto podem pesar; não medi.
- Selecionar e mover usam alvo de 8 px; desenhos muito finos e muito próximos podem exigir zoom para escolher o certo (vale o de cima).
- A borracha apaga ao encostar, mesmo de passagem, e só o que é do usuário; uma recusa da sala (raríssima) faz o desenho reaparecer depois de ~1,5 s.
- O teste do escuro lê o pixel pela extração do Pixi (`renderer.extract`) no navegador do Playwright; em outra GPU o valor exato pode variar (o teste só confere "claramente vermelho" e "quase preto").
- A cor livre usa o `<input type="color">` do navegador (sem conta-gotas próprio).
- Não há desfazer de apagar nem refazer.

### Roteiro manual (pendente)

1. Como jogador, abrir o pincel e desenhar um traço livre, uma linha, um retângulo preenchido e um círculo, em cores e espessuras diferentes; conferir que o mestre vê o traço **enquanto** o jogador arrasta.
2. Apertar Esc no meio de um traço (nada deve ser gravado) e usar "voltar" várias vezes (só os meus somem).
3. Selecionar um desenho meu, arrastar, apagar com Delete; tentar fazer o mesmo num desenho do mestre (não deve selecionar).
4. Apagar com a borracha atravessando vários desenhos de uma vez.
5. Numa cena escura (luz ambiente 0), desenhar longe das luzes e conferir que o desenho aparece para todos.
6. Como mestre: desligar "Desenhar no mapa" no painel do Mestre e ver o jogador perder o pincel; religar. "Limpar desenhos" (cancelar e confirmar).
7. Recarregar a página e conferir que os desenhos continuam; levar o grupo para outra cena (os desenhos da cena nova aparecem, os da antiga não); duplicar uma cena com desenhos; exportar e importar a campanha.
8. Abrir o `pnpm dev` do Vilella sobre o banco existente e conferir que a migração 8 não quebrou nada.

### Revisão (antes do commit de fechamento)

- O agente entregou com as duas rodadas finais ainda rodando. A rodada 2 dele falhou em 3 E2E: dois de `cenas.spec.ts` (a rodada levou 14 min; ele rodava os prints ao mesmo tempo, nas mesmas portas) e o novo `desenho.spec.ts:428`, que conferia o `desenho.rascunhoFim` na hora, logo depois de fechar o socket. **Ajuste na revisão:** o teste agora espera o aviso (`expect.poll`); o código estava certo.
- Sigilo e limites do rascunho revisados (só memória, 30 ms por conexão, 16 traços abertos, só a quem recebe a cena, fim quando a conexão cai); prints conferidos.
- `pnpm verify` verde duas vezes seguidas na revisão (510 + 27 + 6 de unidade, 117 E2E, ~12 min cada); portas 8788/5174 livres no fim.
- Sugestões aplicadas no PROJETO.md (4.1 e "Como ficou" do Lote 13); as perguntas entraram em `docs/PERGUNTAS.md`.

### Sugestões para o PROJETO.md (aplicadas)

- 4.1: `Desenho` (`id`, `cenaId`, `autorId`, `forma`, `pontos`, `cor`, `espessura`, `preenchido?`) e a coleção `desenhos` no estado; capacidade `desenho.criar` (delegável, ligada por padrão) na lista.
- 4.2/exportação: versão 11 (desenhos).
- "Como ficou" do Lote 13 com o que está acima.
- Perguntas ao Vilella: (a) o jogador sem `desenho.criar` ainda deveria poder apagar os próprios desenhos? (b) as formas deveriam encaixar no grid (com Alt invertendo, como os tokens)? (c) o arrasto de um desenho deveria aparecer ao vivo para os outros? (d) quer refazer o "voltar" ou apagar vários com seleção múltipla? (e) a espessura deveria ser em metros (consistente entre zooms) em vez de pixels do mundo?

---

## Lote 14 — Compêndio de magias (entregue, aguardando o roteiro manual)

### O que foi entregue

- **`shared`** (puro, testado):
  - `compendio.ts`: o **formato** `tabletop-compendio` v1 (zod, com limite por campo e no total: 8 MB, 2000 magias, descrição 12 000 caracteres etc.), `lerCompendio(texto)` (JSON, formato, limites, nome repetido; o motivo vem **em português e com o campo**: "magia 2, campo nivel: precisa ser no máximo 9"), `buscarMagias` (sem acento e sem caixa, por nome e nome original, todas as palavras; mais os filtros de nível, escola, classe, concentração e ritual, em ordem alfabética), `opcoesDeFiltro`, e a magia para a ficha (`magiaParaFicha`, `descricaoParaFicha`, `fichaTemMagia`).
  - Tipo de asset novo `compendio` (`assets.ts`): só o mestre registra; `assetVisivelPara` deixa **todo jogador** baixar o asset cujo hash é `Estado.compendio.hash` e **só ele** (um `compendio` antigo segue a regra comum); `hashesUsados` inclui o compêndio (a meta vai na exportação, o arquivo não).
  - `Estado.compendio?: { hash, nomeOriginal, magias }`, intenção `compendio.definir` (só do mestre, `mesa.configurar`) e evento `compendio.alterado` (todos).
  - Mensagem de chat `tipo: "magia"` (com `magia` dentro) e intenção `chat.magia` (`como` só de personagem que eu edito), sempre pública e passando pelo limite de 10 mensagens por segundo do Lote 8.
  - Exportação **v12** (`compendio?`), de v1 a v11 continuam importando.
- **Servidor**: o compêndio da mesa mora na tabela `meta` (chave `compendio`; **sem migração nova**: o banco do Lote 13 abre sem a chave = sem compêndio); `salvarTudo`, `salvarEventos` e `apagarTudo` cuidam dele. `chat.magia` entra no limite de mensagens por segundo. Nada do texto das magias é gravado nem repassado fora dos pedaços do asset.
- **Navegador**:
  - `useCompendio.ts`: todos pedem o asset do compêndio da mesa e leem as magias do cache; o **mestre** lê `compendio/magias.json` da pasta local (File System Access; nos testes, a `Memoria`) ou de um arquivo escolhido à mão, valida e, se é válido e diferente do que a mesa tem, guarda no cache, registra o asset (só a meta vai à sala) e define o compêndio. Arquivo inválido: erro só para o mestre, **nada é distribuído**.
  - `AbaCompendio.tsx` (o ícone que já existia): busca, filtros (nível, escola, classe, concentração, ritual), contagem, lista e o **cartão** com todos os campos, classes, descrição inteira e "Em níveis superiores"; "Recarregar" (mestre); créditos recolhidos no fim; estados: sem compêndio (mestre: como montar o JSON, com um exemplo curto e "Escolher o arquivo…"; jogador: aviso), recebendo, indisponível (mestre offline), erro do arquivo.
  - Ações no cartão: **Mandar para o chat** ("Como:" é o mesmo seletor do chat) e **Adicionar à ficha** (escolhe entre os personagens que eu edito; entra por `ficha.alterar` com nível, escola, `preparada` e a descrição montada: tempo, alcance, componentes, duração, "Concentração · Ritual", texto e "Em níveis superiores"; nome repetido avisa e não duplica).
  - `CartaoDaMagia.tsx` e `MensagemDoChat.tsx`: o cartão da magia no chat (nome, nível, escola, marcas, tempo/alcance/duração e a descrição **recolhida** até abrir).
- **Exemplo do SRD**: `fixtures/compendio/exemplo-srd.json` (Bola de Fogo, Mísseis Mágicos e Detectar Magia, que é ritual e concentração) com os créditos no próprio JSON e em `fixtures/compendio/ATRIBUICAO.md`. Nenhum outro texto de magia no repositório.

### Como rodar

- `pnpm verify` (verde duas vezes seguidas: 31 + 6 + 548 de unidade, 127 E2E, ~12 min cada). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints lote-14` (PowerShell).
- Para usar de verdade: pasta local (Configurações) → crie `compendio/magias.json` nela → aba Compêndio. Para ver rápido: copie `fixtures/compendio/exemplo-srd.json` para `<sua pasta>/compendio/magias.json` (ou use "Escolher o arquivo…").

### Verificação

- Unidade nova `packages/shared/src/compendio.test.ts` (38 testes): o schema aceita o exemplo e recusa campo fora do limite (nível, descrição, nome, classes, créditos, formato, versão, campo ausente, tipo errado), com o motivo em português; magias demais e arquivo grande demais; JSON quebrado e nome repetido; busca sem acento e sem caixa, por nome original e com várias palavras; **cada filtro** e a combinação; a magia na ficha (descrição montada, a ficha a aceita, o pior caso cabe em 20 mil caracteres, nome repetido); `assetVisivelPara` (compêndio da mesa: jogador baixa; `compendio` que não é o da mesa: não; assistente nunca); só o mestre registra o asset e define o compêndio (jogador recusado); `compendio.definir` recusa hash que não é asset `compendio` e não gera evento ao repetir; snapshot e evento para todos, sem texto de magia; mensagem `magia` (pública, "Como:" só de personagem que eu edito, o mestre qualquer um, limites, campo a mais descartado, filtro igual ao das outras); exportação v12 (ida e volta, importar leva o compêndio, sem compêndio não leva o campo, meta ausente recusa, **a v11 importa** e o campo só vale na v12).
- Servidor, `armazenamento.test.ts` (+4): **banco do Lote 13 abre sem quebrar**, sem compêndio, com a campanha inteira; o compêndio volta do SQLite (e só a referência é gravada); importar troca e `apagarTudo` apaga; valor ilegível vira "sem compêndio".
- E2E novo `e2e/tests/compendio.spec.ts` (10 testes): estado vazio (mestre e jogador); o mestre põe o `magias.json` na pasta, o jogador busca "bola" e "misseis" (sem acento) e acha, o hash do cache dele bate, e **nenhum frame de texto** (do mestre nem da sala) leva o texto do compêndio: só os pedaços binários (conferido que eles o levam) e a meta não tem conteúdo; filtros de nível, escola, classe, concentração e ritual; o cartão completo; o jogador manda a magia ao chat **como Aldric** e o mestre e outro jogador veem o cartão recolhido e abrem; `chat.magia` com `como` de personagem que ele não edita é recusado, só o mestre define o compêndio e registra o asset, magia fora do limite é `mensagem_invalida` e a rajada de 15 recebe 5 `muitas_mensagens`; o jogador adiciona à ficha (aba Magias, com a descrição) e adicionar de novo avisa e não duplica; **JSON inválido** mostra o erro com o campo ao mestre e nada é registrado, definido nem enviado (e corrigido + Recarregar distribui); trocar o arquivo atualiza a mesa e o antigo deixa de ser baixável pelo jogador (`asset_inexistente`); quem entra depois recebe o compêndio e, ao recarregar a página, não baixa de novo.
- Prints (1600×900, recortes da barra lateral) em `PRINTS_DIR`: 01 sem compêndio (mestre e jogador), 02 lista (jogador e mestre), 03 busca e filtros (e o de concentração), 04 cartão aberto, 05 depois de mandar ao chat, 06 chat recolhido e aberto, 07 escolha do personagem em "Adicionar à ficha" (e o aviso de adicionada e de repetida), 08 a magia na aba Magias da ficha, 09 erro do JSON inválido (sem compêndio e com um já na mesa).
- Expectativas antigas alteradas (só por causa do que o lote mudou): os testes que conferiam `versao` da exportação como 11 agora esperam **12** (`assets`, `ficha`, `fichas`, `luz`, `paredes`, `personagens`, `tochas`, `tokens`, `combate` e `desenho` em `shared`; `assets.spec.ts` e `interface.spec.ts` no E2E); em `nucleo.test.ts` a "versão inválida" (futura) passou de 12 para **13**; em `interface.spec.ts` o Compêndio sem arquivo agora mostra "como montar o JSON" (antes era o aviso "em breve" e a busca "Nenhuma magia carregada"). A versão do esquema do SQLite **não mudou** (continua 8).

### Decisões

- (assumido) O mestre **lê o arquivo sozinho**: ao conectar, ao a pasta ficar autorizada ou ganhar um arquivo, e no botão "Recarregar". Só registra e redefine se o conteúdo (o hash) mudou.
- (assumido) Quem consulta é **todo mundo**, inclusive sem `asset.subir` (o compêndio não é "enviar arquivo"); só o mestre define e recarrega.
- (assumido) A referência do compêndio mora na tabela `meta` (JSON), sem tabela nova nem migração: é um valor só.
- (assumido) O asset `compendio` tem `largura`/`altura` 1, `mime` `application/json` e `nomeOriginal` o nome do arquivo escolhido (normalmente `magias.json`). A sala não confere se `magias` bate com o arquivo (ela nunca o lê).
- (assumido) `compendio.definir` usa a capacidade `mesa.configurar`; não criei capacidade nova.
- (assumido) O arquivo com **nome de magia repetido** (sem acento nem caixa) é recusado, porque a lista e o "já tem na ficha" se apoiam no nome.
- (assumido) Campos desconhecidos no JSON são ignorados (zod); os textos são aparados e não podem ficar vazios, com exceção dos opcionais (`nomeOriginal`, `emNiveisSuperiores`, `creditos`, que, se vierem, também não podem ser vazios).
- (assumido) `chat.magia` é uma **intenção própria** (não um anexo de `chat.enviar`) e leva a magia inteira: a sala valida os limites, mas não confere se ela existe no compêndio (o texto do chat já é livre). A mensagem é sempre pública.
- (assumido) "Mandar para o chat" usa o **mesmo "Como:" do chat** (um seletor, dois lugares). Quem não edita nenhum personagem fala como ele mesmo e não vê "Adicionar à ficha".
- (assumido) "Adicionar à ficha" entra com `preparada: true`, a escola da magia e a descrição montada; **não** confere classe nem se há espaço de magia daquele nível. A checagem de nome repetido é do navegador (usa a ficha que ele já recebeu); a sala não a repete.
- (assumido) Escola e classe do filtro vêm do próprio arquivo (sem lista fixa de escolas); a comparação é sem acento e sem caixa. O truque aparece como "Truque" (a ficha continua agrupando em "Truques").
- (assumido) Os créditos do arquivo aparecem recolhidos no fim da lista (a licença do SRD pede a atribuição).
- (assumido) Para quem não tem o seletor de pasta (Firefox, Safari) existe "Escolher o arquivo…" na aba vazia: vale até recarregar a página.
- (assumido) O texto das 3 magias do exemplo foi **traduzido por mim, de memória do SRD 5.1** (nada foi baixado); distâncias também em metros (45 m, 36 m, 9 m, 6 m) além dos pés.

### Desvios do plano

- Nenhum no que o "Decidido antes de começar" pede. Sem dependência nova.

### Frágil / não verificado

- **Dois mestres com arquivos diferentes**: cada navegador de mestre lê a própria pasta ao conectar; o último a conectar com um arquivo diferente redefine o compêndio da mesa. Com um mestre só (o caso de uso) não aparece.
- Sem o mestre online (e sem cópia no cache de ninguém), um jogador que **nunca** baixou o compêndio vê "ninguém com o arquivo está online" até o mestre conectar (é o mesmo comportamento das imagens).
- A lista não é virtualizada: com as 2000 magias do limite são 2000 botões na tela (não medi; um compêndio real de ~500 magias deve ser tranquilo).
- A leitura da pasta usa o File System Access (Chrome e Edge); em outros navegadores só o arquivo escolhido à mão. O teste usa a `Memoria` do modo `e2e`, não a pasta de verdade: **a leitura por `getDirectoryHandle`/`getFileHandle` só foi exercitada pelo roteiro manual** (abaixo).
- Quem está com a janela da ficha aberta e adiciona uma magia pelo compêndio concorre com a edição dela (a ficha junta as mudanças por ~400 ms e a sala aplica por posição); na prática o usuário não faz as duas coisas ao mesmo tempo.
- O cartão no chat confia no que o cliente mandou (a sala só valida limites): quem quiser pode "publicar" uma magia inventada. É texto de chat; não há regra automática sobre ela.
- A tradução do exemplo do SRD merece uma conferência contra o texto oficial em português/inglês antes de qualquer uso fora do teste.

### Roteiro manual (pendente)

1. Escolher a pasta local, criar `compendio/magias.json` com o exemplo do SRD e abrir a aba Compêndio (como mestre): a lista aparece sozinha, com "Recarregar" e os créditos.
2. Em outro navegador/aba como jogador: a lista chega sozinha; buscar "bola", "misseis", "magic"; usar os filtros (nível 1, concentração, ritual, escola, classe).
3. Abrir "Bola de Fogo": campos, descrição, "Em níveis superiores". Escolher "Como: Aldric" e "Mandar para o chat": o mestre vê o cartão recolhido e abre.
4. "Adicionar à ficha" como jogador (só os personagens dele) e como mestre (todos); abrir a aba Magias da ficha e ver a descrição; repetir (deve avisar e não duplicar).
5. Estragar o JSON (nível 12, vírgula faltando) e "Recarregar": o erro aparece com o campo; os jogadores continuam com o compêndio anterior. Corrigir e recarregar de novo.
6. Trocar a pasta/arquivo por um compêndio maior (de verdade, seu) e ver se a lista e a busca ficam rápidas.
7. Abrir o `pnpm dev` do Vilella sobre o banco existente: nada deve quebrar (não há migração nova; sem compêndio a aba mostra como montar).
8. Exportar e importar a campanha com o compêndio definido (volta a referência; o arquivo continua na pasta do mestre).

### Revisão (antes do commit de fechamento)

- Sigilo e limites revisados: só o mestre registra asset `compendio`; o jogador baixa só o compêndio da mesa; `compendio.definir` só aponta para asset `compendio` registrado; campos com limite; nenhum texto vira HTML. Atribuição do SRD conferida. Prints conferidos.
- A sessão caiu no meio da primeira bateria da revisão. Na seguinte, uma rodada falhou em `combate.spec.ts:184` (Lote 11): o teste dependia do d20 do Aldric passar de 3. **Ajuste na revisão:** o mestre fixa o valor do Aldric depois de conferir a rolagem; o código estava certo. Na rodada seguinte, `desenho.spec.ts:156` (Lote 13) leu a lista do jogador logo depois de o mestre ver os 2 desenhos, antes de a confirmação chegar ao autor: **o teste agora espera também do lado do jogador**. Na seguinte, `assets.spec.ts:492` pôs a imagem no token da Brisa: o clique de `selecionarToken` caiu no vizinho enquanto a vista ainda se ajustava ao mapa novo. **O painel do token ganhou `data-token-id` e `selecionarToken` confere que selecionou o token pedido (tenta de novo)**, o que protege os 20 usos do ajudante.
- `pnpm verify` verde duas vezes seguidas depois do ajuste (548 + 31 + 6 de unidade, 127 E2E); portas 8788/5174 livres no fim.
- Sugestões aplicadas no PROJETO.md (4.1 e "Como ficou" do Lote 14); as perguntas entraram em `docs/PERGUNTAS.md`.

### Sugestões para o PROJETO.md (aplicadas)

- 4.13.1 e Lote 14 "Como ficou": o que está acima (formato, asset `compendio`, `Estado.compendio`, mensagem `magia`, "Adicionar à ficha").
- 4.1: `Estado.compendio` e o asset `compendio` na lista de tipos de asset; mensagem de chat `magia`.
- 4.2/exportação: versão 12 (compêndio).
- Perguntas ao Vilella: (a) dois mestres: quem manda no compêndio (hoje, o último que conecta com arquivo diferente)? (b) o jogador deveria poder trazer o próprio arquivo (compêndio pessoal) além do da mesa? (c) "Adicionar à ficha" deveria ler a classe do personagem para avisar "essa classe não conjura esta magia"? (d) quer a linha de classes e o nome original também na lista, não só no cartão? (e) vale um conversor de outros formatos (planilha ou JSON de ferramentas conhecidas) ou o mestre monta o JSON à mão? (f) monstros e armas no mesmo arquivo (`versao: 2`) ou em outro?

---

## Redesign R1 — Fundação visual e marca (entregue, aguardando o roteiro manual)

### O que foi entregue

- **Temas de cor** (`apps/web/src/tema/temas.ts`, fonte única): Grimório (padrão), Escuro neutro e Claro; `aplicarTema` põe os tokens como variáveis CSS no `documentElement`, no boot (`main.tsx`), e o `index.html` já pinta o fundo e marca `data-tema` antes do JS (sem piscar). Preferência **do navegador** (`tabletop:pref:tema`), nunca da sala. Seletor com amostras em Configurações → "Preferências deste navegador" (`SeletorDeTema.tsx`).
- **`styles.css` sem cores fixas** (exceto as de conteúdo): tokens novos `--fundo-mesa`, `--barra`, `--borda-barra`, `--cabecalho` (era `--painel-2`), `--campo`, `--acento-suave`, `--acento-forte`, `--perigo-texto`, `--perigo-fundo`, `--sucesso*`, `--aviso*`, `--oculta`, `--sobreposicao`, `--veu`, `--ponto-off`, `--texto-desabilitado`, `--sombra`.
- **Fontes empacotadas**: `@fontsource-variable/space-grotesk` e `@fontsource-variable/inter`.
- **Marca Távola**: `Logo.tsx`, `public/favicon.svg`, título "Távola" (com a cena: "Távola · nome da cena"), tela de entrada nova (cartões com avatar e selo "Mestre").

### Como rodar

- `pnpm verify` (uma vez). Os E2E novos: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/tema.spec.ts tests/importarPdf.spec.ts`. Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints r1`.

### Verificação

- Unidade nova `apps/web/src/tema/temas.test.ts`: os 3 temas têm exatamente as mesmas chaves; contraste AA (4,5:1) de cada par de texto e fundo relevante nos 3 temas (texto e texto suave sobre barra, painel, cabeçalho, campo e fundo; destaque, perigo, sucesso, aviso e roxo sobre os fundos em que aparecem; texto sobre cada preenchimento); o fundo pintado pelo `index.html` é igual ao do tema.
- E2E novo `e2e/tests/tema.spec.ts` (4 testes): entrada com logo, frase, 8 usuários, selo só no mestre, iniciais e título "Távola"; título "Távola · cena" na mesa; trocar o tema muda as cores, sobrevive ao recarregar e **nenhum frame** (enviado nem recebido) acompanha a troca; o tema é por navegador (outro usuário continua no dele); nenhuma requisição fora de 127.0.0.1 e as duas fontes empacotadas carregam.
- E2E antigo alterado: `importarPdf.spec.ts` conferia a cor do campo amarelo "incerto" como `rgba(255, 208, 70, 0.1…)`; agora `rgba(245, 197, 66, 0.1…)` (o token novo). Nenhum E2E dependia do texto "Tabletop"; `interface.spec.ts` confere o avatar na cor do usuário, que não muda.
- `pnpm verify` verde numa rodada: 13 (web) + 31 (servidor) + 549 (shared) de unidade e 132 E2E, sem instável. Repetição 3x: `tema`, `importarPdf` e `combate` (45 execuções) e `assets`, `interface`, `tema`, `importarPdf` (81) verdes.
- Efeitos da fonte Inter (mais larga que a `system-ui`): o painel do token passou de 420 px (limite de `interface.spec.ts`), então o `gap` e o padding dele diminuíram (`gap: 4px`, `padding: 6px 10px`; 410 px). A interface só é desenhada depois de as duas fontes carregarem (teto de 1,5 s, em `main.tsx`), para o texto não trocar de fonte no meio de um clique.
- Instável achado no caminho e corrigido (já existia: 2 falhas em 12 no código sem o lote): `combate.spec.ts` "condição e concentração que o jogador aplica..." clicava nas condições do mestre sem esperar o menu refletir o estado da sala; agora espera `aria-checked` antes e depois de cada clique.
- Prints (1600×900, 3 temas) em `PRINTS_DIR`: `<tema>-00-entrada`, `01-mesa-mestre`, `02-mesa-jogador`, `03-ficha-aberta`, `04-ordem-de-turno-recorte`, `05-compendio-cartao`, `06-chat-recorte` (rolagem e magia), `07-preferencias-mestre` e `-jogador`.

### Decisões

- (assumido) O selo "Mestre" vale para o usuário de id `mestre` (a entrada não sabe os papéis).
- (assumido) `--painel-2` foi renomeado para `--cabecalho`; `--fundo` é só o fundo da página; áreas rebaixadas e campos usam `--campo`.
- (assumido) O perigo do Claro ficou #A83A15 (o do protótipo não passava AA sobre o fundo da página).
- (assumido) O mapa (PixiJS) não muda com o tema; o véu sobre o mapa (`--veu`) muda porque carrega texto do tema.
- (assumido) Os valores de fundo duplicados no `index.html` são conferidos por teste.
- (assumido) A montagem dos prints foi copiada de `auditoria.spec.ts` para `r1.spec.ts` (os specs de print não exportam nada).

### Desvios do plano

- Nenhum. Dependências novas: as duas de fonte. Nada mudou na sala, no protocolo nem na exportação.

### Frágil / não verificado

- Selo "Mestre" preso ao id `mestre`.
- Texto branco sobre cores de usuário claras (amarelo do mestre) no avatar: contraste baixo, é conteúdo; fica para o R6.
- Os rótulos desenhados dentro do mapa não seguem o tema (são do mapa).
- Só o Chrome foi testado.

### Roteiro manual (pendente)

1. Abrir a mesa: tela de entrada nova (logo, frase, cartões, selo Mestre) e a aba "Távola".
2. Configurações → Tema de cor: trocar nos 3 temas e olhar chat, fichas, compêndio, ordem de turno, janela da ficha e menus.
3. Recarregar e conferir que o tema continua; abrir em outro navegador e ver que o tema é independente.
4. Com a rede cortada, as fontes continuam as mesmas (Space Grotesk nos títulos).

### Revisão (antes do commit de fechamento)

- Prints dos 3 temas conferidos um a um.

---

## Redesign R2 — Estrutura fixa (entregue, aguardando o roteiro manual)

### O que foi entregue

- **Quatro regiões fixas** em `.mesa` (CSS grid): topo de 48 px (`Topo.tsx`, até onde começa o painel), barra de ferramentas de 52 px (`BarraDeFerramentas.tsx`), painel direito de cima a baixo (`BarraLateral.tsx`) e a área do mapa (`.area-mapa`) no meio. O canvas do PixiJS tem o tamanho da área (`ResizeObserver` no `MapaPixi`: janela, painel ajustado, painel recolhido).
- **Topo**: símbolo e nome Távola, nome da cena do grupo, os menus do mestre **como estavam**, presença em avatares (`PresencaNoTopo.tsx`, com "+N" acima de 6 pessoas) e o estado da mesa (`EstadoDaMesa.tsx`), num controle só: mestre rodando = botão ⏸ com o relógio da sala dentro; mestre pausado = pílula de aviso "▶ relógio" que retoma; jogador = só o ícone ⏸ na pílula amarela (sem clique, com dica). Sem a palavra "Pausada" na tela (fica no `aria-label`). A faixa "Mesa pausada" do meio do mapa saiu. O relógio é o tempo da sala e só o mestre o vê.
- **Painel direito**: fundo `--barra` com degradê e sombra (sem filete); **largura ajustável** pela alça da borda esquerda (mouse e teclado; 300 px a 1/4 da janela; `tabletop:pref:larguraDoPainel`; reajusta com a janela); **abas com ícone e nome**; recolhido vira uma trilha de 52 px.
- **Zoom** no canto inferior direito da área (horizontal). **Centralizar** (mapa e token) usa a área visível. Tudo o que abre sobre o mapa (ordem de turno, painel do token, faixa de cenas, paredes, iluminação, fontes de luz, dados, sub-barra do pincel, janela da ficha, menus e dicas) abre dentro da área (`area.ts`).
- A lista de presença saiu da aba Chat. Resolve os itens 1, 3, 17 e 21 do levantamento.

### Como rodar

- `pnpm verify` (uma vez). O E2E novo: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/estrutura.spec.ts`. Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints r2`.

### Verificação

- Unidade nova `apps/web/src/preferencias.test.ts`: os limites da largura do painel (300 px; 1/4 da janela; 300 quando 1/4 é menos).
- E2E novo `e2e/tests/estrutura.spec.ts` (11 testes): as quatro regiões (topo de 48 px que termina no painel, barra de 52 px, painel de cima a baixo, canvas igual à área); o canvas acompanha janela, painel ajustado e recolhido; arrastar a alça até o mínimo e o máximo (largura respeitada, guardada, mantida ao recarregar, independente em outro navegador, **nenhum frame enviado**); ajuste à janela; teclado na alça; abas com nome em 300 px (mestre e jogador, texto sem corte); presença no topo (entra, fica online; sai, fica offline; "+N"); pausa visível no topo para o jogador (e o botão e o relógio do mestre); zoom no canto da área nas quatro larguras (largo, estreito, recolhido); "centralizar" no token e no mapa com o painel estreito e largo; em 1280×720 tudo o que abre sobre o mapa fica dentro da área.
- E2E antigos alterados (a disposição mudou de propósito; nenhuma asserção de comportamento foi afrouxada): `interface.spec.ts` (o menu do mestre deixou de ser "centralizado na janela": agora fica dentro do topo; com o pincel ativo a barra de 52 px continua à vista e a sub-barra abre ao lado dela, não no lugar dela), `desenho.spec.ts` (idem: o botão do pincel fica apertado, em vez de sumir), `fichas.spec.ts` (o alvo do `dragTo` é relativo à caixa do mapa, que já não começa no canto da janela: ajudante novo `noElementoDoMapa` em `ajudasMapa.ts`). O `ficha.spec.ts` não mudou: a janela da ficha agora abre com 120 px de folga na largura e 72 na altura dentro da área (antes 120 e 100 na janela), para o teste de arrastar e redimensionar continuar valendo.
- `pnpm verify` verde numa rodada: 15 (web) + 31 (servidor) + 549 (shared) de unidade e 144 E2E, sem instável. Repetição 3x (`--repeat-each=3`) de `estrutura` (12 testes), `tema`, `compendio`, `interface`, `desenho`, `ficha` e `fichas`: 162 execuções verdes. Na primeira rodada do verify apareceu um instável em `tema.spec.ts` (um frame de presença/uso, vindo de um teste anterior, contado como se fosse do tema) e, na terceira, um em `compendio.spec.ts` (um uuid aleatório continha "8d6"); os dois já existiam e foram corrigidos na causa (`tema.spec.ts` só conta os frames que não são de presença nem de uso; `compendio.spec.ts` tira ids e hashes hexadecimais antes de procurar o texto das magias).
- Ajustes pedidos pelo Vilella depois de ver a tela, já aplicados: a pausa num controle só (sem a palavra "Pausada", sem a faixa no mapa), painel sem o filete amarelo, cabeçalhos das janelas em `--barra` e corpo em `--painel`, painel recolhido só com os ícones (o conteúdo da aba ficava desenhado espremido: o `display:flex` do chat vencia o `hidden`; sem botão de abrir na trilha, clicar numa aba abre) e a paleta Carvão no Grimório. O E2E `recolhido, o painel mostra só os ícones das abas...` cobre o painel recolhido.
- Prints (3 temas, 1600×900 e 1280×720) em `PRINTS_DIR`: `<tema>-<largura>-01-mesa-mestre`, `02-mesa-jogador`, `03-painel-minimo`, `04-painel-maximo` (e `04b`, Configurações), `05-painel-recolhido`, `06-pausada-jogador` (e `06b`, mestre), `07-ordem-de-turno` (e `07b`, com o painel do token), `08-ficha-aberta`, `09-faixa-de-cenas`, `10-sub-barra-do-pincel`, `11-dados-rapidos`, `12-presenca-lista`.

### Decisões

- (assumido) Paleta Carvão no Grimório (escolha do Vilella): ver `REDESIGN.md`, "Decidido". Tokens novos do degradê do painel (`painelTopo`, `painelMeio`, `painelFim`).
- (assumido) Cabeçalho das janelas e popups em `--barra` e corpo em `--painel` (pedido do Vilella).
- (assumido) Painel recolhido = trilha de 52 px só com os ícones das abas (mantém o selo de não lidas).
- (assumido) Largura padrão 360 px (ajustada ao 1/4 da janela). A escolha da pessoa fica intacta: o painel se ajusta quando a janela encolhe e volta ao escolhido quando ela cresce.
- (assumido) Presença: com mais de 6 pessoas, aparecem 5 (os online primeiro) e o "+N" abre a lista dos outros.
- (assumido) O jogador vê no topo só o ícone de pausa na pílula amarela; o relógio da sala continua só do mestre. A faixa "Mesa pausada" do meio do mapa saiu (a pílula basta).
- (assumido) Zoom na horizontal; "Vendo como" embaixo, no centro da área; sub-barra do pincel ao lado da barra; aviso e selo de conexão centrados na área.
- (assumido) O botão de recolher o painel mora no canto do título da aba aberta (ou no alto da trilha, recolhido).
- (assumido) A janela da ficha agora é `position: absolute` dentro da área (coordenadas dela), então a área a corta; em R3 vira a janela comum.

### Desvios do plano

- Nenhum. Nada mudou na sala, no protocolo nem na exportação; nenhuma dependência nova.

### Frágil / não verificado

- Ao mudar o tamanho da área (painel, janela) a vista do mapa fica ancorada no canto superior esquerdo: o que estava no centro pode sair do centro. "Centralizar" resolve.
- A lista do "+N" abre por clique e fecha com Esc ou clicando fora; não há teste de foco por teclado nela.
- A pílula do mestre muda de largura entre rodando e pausada (e o relógio cresce com as horas), então os avatares ao lado dela se deslocam alguns pixels.
- Com 5 abas na largura mínima, o texto de "Configurações" ocupa quase toda a linha; uma aba a mais quebraria para uma segunda linha (a fila das abas quebra, não corta).
- Só o Chrome foi testado.

### Roteiro manual (pendente)

1. Abrir a mesa como mestre: topo com a marca, a cena, os menus e os avatares; barra de 52 px à esquerda; painel à direita de cima a baixo; o mapa no meio. Nada fica por cima das barras.
2. Arrastar a borda esquerda do painel: não passa de 300 px nem de 1/4 da tela; recarregar mantém; em outro navegador, a largura é independente. Tocar na alça com Tab e usar as setas.
3. Ver as abas com nome (Chat, Fichas, Compêndio, Configurações, Mestre) na largura mínima. Recolher e abrir o painel.
4. Pausar a mesa: no topo, o mestre vê a pílula "▶ relógio" (clique retoma) e o jogador o ícone ⏸ na pílula amarela; nada de faixa no mapa. Retomar.
5. Entrar e sair com outro usuário: o avatar acende e apaga; com mais de 6 pessoas, o "+N" abre a lista.
6. Abrir ordem de turno, painel do token, cenas, luz, paredes, dados, pincel e a ficha: tudo dentro da área do mapa; em 1280×720 também. Arrastar a janela da ficha para perto das barras.
7. Zoom no canto inferior direito; "Centralizar o mapa" e o centro do token com o painel estreito e largo.
8. Os 3 temas nas duas larguras de janela.

### Revisão (antes do commit de fechamento)

- Prints dos 3 temas e dos 2 tamanhos (90 imagens) conferidos: topo, barras, painel largo e estreito, recolhido, pausa, ordem de turno, ficha, faixa de cenas, pincel, dados e presença; nada cortado nem sobreposto às barras. (Falta a revisão dele.)

---

## Redesign R2b — pausa automática e 11 temas de cor (entregue, aguardando o roteiro manual)

### O que foi entregue

- **A mesa pausa sozinha quando não sobra mestre conectado.** `pausarSeSemMestre` (shared, `nucleo.ts`, junto de `processarSistema`): sem mestre conectado e mesa rodando, emite `mesa.pausada` com o tempo da sala da hora da saída (origem `sistema`) e pede snapshot a todos; com mestre conectado ou mesa já pausada, não faz nada. A sala (`sala.ts`): quando a última conexão de um mestre cai, agenda o vencimento `mestre.ausente` (5 s, `ESPERA_DA_PAUSA_MS`) com o instante da saída; um mestre que conecta antes cancela; ao vencer, conta de novo os mestres pelos sockets abertos (`getWebSockets()` e o attachment, nada em memória) e pausa no tempo da saída. Ao acordar sem mestre e com a mesa rodando, pausa na hora. Retomar é só do mestre. Protocolo atualizado (`docs/protocolo.md`, "Pausa automática (R2b)"); nenhum campo novo.
- **11 temas de cor** (`apps/web/src/tema/temas.ts`): Grimório, Taverna, Forja, Licantropo, Paladino, Druida, Leviatã, Vampiro, Arcana, Edgerunner (`escuro`) e Pergaminho (`claro`). Ids antigos mantidos; o padrão continua o Grimório em carvão. `index.html` com o fundo anterior ao JS dos 11.
- **Seletor de bolinhas** (`SeletorDeTema.tsx`, estilos em `styles.css`): `role="radiogroup"` de botões de rádio nativos (setas), bolinha com barra em cima, destaque e corpo das janelas embaixo, selo de check no escolhido, nome embaixo e na dica; cabe no painel de 300 px.

### Como rodar

- `pnpm verify` (uma vez). E2E novos: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/pausaAutomatica.spec.ts tests/tema.spec.ts`. Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints r2b`.

### Verificação

- Unidade (shared, `tochas.test.ts`): pausa quando o último mestre sai (tempo da sala congelado no instante da saída, depois nada o move); não pausa com outro mestre; não mexe se já pausada; o jogador vê a pausa com `salaMs: 0` e só o mestre retoma. Unidade (web, `temas.test.ts`): os 11 temas com as mesmas chaves, AA em todos os pares, nomes, degradê do painel nos coeficientes aprovados, fundo do `index.html` dos 11.
- E2E novo `pausaAutomatica.spec.ts` (4 testes): o jogador vê a mesa pausar quando o mestre fecha a página e o mestre, ao voltar, encontra pausada e retoma; duas abas do mestre (uma saindo não pausa, a última pausa); jogador saindo não pausa; mesa já pausada pelo mestre continua no mesmo tempo. E2E novos em `tema.spec.ts` (6 testes): seletor com 11 bolinhas, nomes, selo e dica; setas do teclado; escolher temas novos e recarregar; `escuro` e `claro` guardados continuam; valor guardado inválido cai no Grimório; cabe no painel de 300 px.
- `pnpm verify` verde numa rodada: 31 (servidor) + 25 (web) + 553 (shared) de unidade e 154 E2E (144 + 4 de `pausaAutomatica` + 6 novos de `tema`), sem instável. Repetição 3x de `pausaAutomatica` e `tema`: 12 + 33 execuções verdes, sem nenhuma repetição. Nenhum E2E antigo foi alterado. Durante o desenvolvimento a pausa sem espera pausava a mesa a cada entrada do mestre (o React em desenvolvimento abre a conexão duas vezes): daí a espera de 5 s.
- Prints (1600×900) em `scratchpadprints-r2b`: o seletor aberto (`01` a `04`, com recortes) e, em cada um dos 11 temas, a aba Configurações, a mesa do mestre com a ordem de turno e a ficha aberta (`tema-NN-<id>-a/b/c`).

### Decisões

- (assumido) Espera de 5 s antes de pausar (recarregar a página, ou o React em desenvolvimento, fecha uma conexão um instante antes de abrir a outra); o tempo congelado é o da saída. Ver `REDESIGN.md`, "R2b — como ficou".
- (assumido) Só saída de conexão de mestre dispara a pausa; jogador saindo nunca.
- (assumido) Ao acordar sem mestre conectado e com a mesa rodando, pausa na hora.
- (assumido) Tokens derivados dos 8 temas escuros novos e degradê do painel por coeficiente: ver `REDESIGN.md`.
- (assumido) `/teste/zerar` marca os sockets que já existiam (`anterioresAoZerar`): o fechamento atrasado de um deles, de um teste anterior, não pausa a mesa zerada.

### Desvios do plano

- Nenhum além do que o brief já autorizava (a pausa muda a sala). Nenhuma dependência nova.

### Frágil / não verificado

- O tempo em que a sala ficou fora do ar (processo reiniciado) conta como mesa rodando até ela acordar e pausar: não há como saber quando o último mestre saiu.
- O mestre que perde a rede por mais de 5 s pausa a mesa para todos (e precisa retomar ao voltar). Era o pretendido ("saiu"), mas vale ver na prática.
- Os jogadores veem só o selo de pausa de sempre: não sabem se foi o mestre ou a sala.
- O teste de "não pausa" espera 6,5 s reais (a espera da sala mais folga): os E2E de pausa automática são lentos.
- A espera usa o relógio real e o agendador da sala; um teste de unidade do Durable Object não existe (o servidor não tem esse padrão): a cobertura é a unidade do shared e o E2E.
- Só o Chrome foi testado.

### Roteiro manual (pendente)

1. Como mestre, com um jogador conectado e uma tocha acesa: fechar a aba do mestre. Em até uns 5 s a mesa do jogador mostra o selo de pausa e a tocha para de queimar.
2. Voltar como mestre: a mesa está pausada (pílula "▶ relógio"); retomar com o clique; a tocha volta a queimar de onde parou.
3. Recarregar a página do mestre (F5): a mesa **não** pausa.
4. Abrir o mestre em duas abas e fechar uma: não pausa. Fechar a outra: pausa.
5. Configurações, "Tema de cor": passar por todas as bolinhas (mouse e setas); o selo acompanha; recarregar mantém; trocar de usuário no mesmo navegador mantém o tema do navegador.
6. Quem estava no Escuro ou no Claro continua neles, agora chamados Edgerunner e Pergaminho.
7. Painel na largura mínima (300 px): as bolinhas cabem sem rolar de lado.

### Revisão (antes do commit de fechamento)

- Os 37 prints (seletor e 11 temas × configurações, ordem de turno e ficha) conferidos: bolinhas legíveis e sem rolagem lateral no painel de 300 px, texto legível e janelas distinguíveis do mapa em todos os temas, nada cortado nem sobreposto. (Falta a revisão do Vilella.)

---

## Redesign R3 — Janelas flutuantes (entregue, aguardando o roteiro manual)

### O que foi entregue

- **`Janela`** (`apps/web/src/janelas/Janela.tsx`, com `pilha.ts` e `geometria.ts`): o componente único de janela flutuante. Arrasta pelo cabeçalho (pointer events com captura; arrasto que começa em botão ou campo não move; com o cabeçalho focado, as setas movem 8 px, com Shift 40); **dois cliques no cabeçalho minimizam** (só a barra do título) e restauram, e há o botão "Minimizar"/"Restaurar"; "Fechar" onde a janela já fechava; redimensiona pela quina (ficha) ou pela borda de baixo (ordem de turno e fontes de luz); fica **sempre dentro da área do mapa** (ao abrir, ao soltar e quando a área muda); a **última clicada fica por cima** (pilha única); `role="dialog"` não modal com nome, Esc não fecha.
- **Preferência por janela e por navegador**: `tabletop:pref:janela:<id>` (`{x, y, largura, altura, minimizada}`, em `preferencias.ts`, com try/catch). Nenhum frame vai para a sala.
- **Passam a usar a `Janela`**: ordem de turno (`ordem`), ficha (`ficha:<personagemId>`, uma por personagem), painel do token (`token`), paredes e portas (`paredes`), fontes de luz (`fontes`), iluminação (`iluminacao`) e dados rápidos (`dados`). Menus de contexto e dicas continuam como eram. `ficha/janelas.ts` guarda só a lista e a aba das fichas abertas; posição, tamanho e pilha são da `Janela`.
- Contêiner `data-testid="janela-<id>"` com `data-minimizada`; os `data-testid` antigos continuam no miolo (mesma caixa, 1 px de borda para dentro).
- **Seletor de tema**: a metade de cima da bolinha usa o token novo `amostra` (a cor viva do tema; `temas.ts`, nos 11 temas e no teste); Druida, Leviatã, Licantropo e Paladino se distinguem. A interface não mudou de cor.
- Dois ajustes pequenos na ficha para caber em ~60% da área: as caixas do resumo (CA, iniciativa, deslocamento, proficiência, percepção) quebram em duas linhas quando falta largura, e as abas têm menos espaço lateral e rolam de lado se faltar. Resolve o item 16 e as partes do 8 e do 14 que eram do R3.

### Como rodar

- `pnpm verify` (uma vez). E2E novo: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/janelas.spec.ts tests/tema.spec.ts tests/luz.spec.ts tests/ficha.spec.ts`. Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints r3`.

### Verificação

- Unidade nova: `janelas/geometria.test.ts` (empurrar para dentro da área, limitar tamanho, posições padrão), `preferencias.test.ts` (chave `tabletop:pref:janela:<id>`, valores estragados, sem localStorage) e, em `temas.test.ts`, a `amostra` se distingue da barra e das outras amostras.
- E2E novo `e2e/tests/janelas.spec.ts` (9 testes): arrastar a ordem de turno e a ficha, recarregar e continuar no lugar, outro navegador com a posição padrão, nenhum frame para a sala; dois cliques minimizam (só o cabeçalho, conteúdo escondido) e restauram, o estado sobrevive ao recarregar, botão com nome; redimensionar (ficha pela quina, ordem pela altura) e guardar; empurrar para dentro da área quando o painel direito alarga ou o navegador estreita (e a janela volta ao canto quando a área cresce); a última clicada fica por cima (`z-index` e `elementFromPoint`); arrasto iniciado num botão do cabeçalho não move; teclado (setas, Shift), Esc não fecha, `role` e nome; em 1280×720 a ficha abre inteira na área, a segunda em cascata e o token embaixo à esquerda; paredes, fontes, iluminação e dados abrem dentro da área, em lugares diferentes, e fecham pelo X. E um teste novo em `tema.spec.ts` (as 11 amostras distintas).
- E2E antigos alterados (a disposição mudou de propósito; nenhuma asserção de comportamento foi afrouxada): `luz.spec.ts` ("clicar duas vezes no cabeçalho minimiza o painel": o corpo agora fica montado mas escondido, então o teste confere `data-minimizada` e `toBeHidden`, em vez de contagem 0 e opacidade 0,7); `ficha.spec.ts` ("várias janelas...": o `z-index` mora no contêiner `.janela` e a ficha agora abre no tamanho mínimo em 1280×720, então o teste **aumenta** a janela em 100×60 em vez de diminuir); `tema.spec.ts` ("o seletor é um grupo de rádio...": a metade de cima da bolinha do Grimório é a amostra `rgb(74, 74, 74)`, não a barra `rgb(27, 27, 27)`).
- `pnpm verify` verde numa rodada: 31 (servidor) + 35 (web) + 553 (shared) de unidade e 164 E2E, sem instável. (Numa rodada anterior do verify, `estrutura.spec.ts` "a alça também funciona pelo teclado" falhou uma vez na entrada, antes da mesa abrir: o `status-conexao` não apareceu em 10 s; não repetiu em 3x nem na rodada seguinte e não toca nas janelas: não achei a causa.) Repetição 3x de `janelas`, `tema`, `luz` e `ficha`: 120 execuções verdes (40 testes × 3, sem nenhuma repetição). Antes, na primeira passada do `janelas.spec.ts`, dois testes novos reprovaram por erro do próprio teste (o testid antigo da ficha é o miolo, 2 px menor que a janela; e clicar no cabeçalho da ordem quando a ficha o cobria): corrigidos nos testes.
- Prints (3 temas, 1600×900 e 1280×720) em `PRINTS_DIR`: `<tema>-<largura>-01-padrao` (ordem de turno, ficha e painel do token abertos), `02-ordem-minimizada`, `03-ficha-redimensionada`, `04-arrastadas`, `05-fontes-de-luz`, `06-iluminacao`, `07-paredes`, `08-dados-rapidos`, `09-duas-fichas-em-cascata` (Grimório), `10-seletor-de-tema` (e `10-seletor-recorte`).

### Decisões

- (assumido) Ficha: posição e tamanho por personagem (`ficha:<personagemId>`); a segunda ficha sem posição guardada abre deslocada em cascata (32 px).
- (assumido) Esc não fecha janela; setas movem a janela com o cabeçalho focado.
- (assumido) Só a ficha redimensiona nos dois eixos; ordem de turno e fontes de luz só na altura; as outras não.
- (assumido) Os dados rápidos deixaram de fechar ao clicar fora; fecham pelo X, pelo botão da barra ou sozinhos depois de rolar. O "recolher" das fontes de luz virou o minimizar comum (sem os 70% de opacidade).
- (assumido) Minimizar esconde o corpo sem desmontar; a posição só é guardada depois que a pessoa mexe; a escolha fica intacta e só o que se vê é empurrado para dentro da área.
- (assumido) Posições padrão: ordem no alto à direita, token embaixo à esquerda, ficha no alto à esquerda (até 60% da largura da área, no mínimo 520 px, sem passar da ordem de turno quando cabe; 75% da altura), paredes e fontes lado a lado no alto à esquerda, iluminação ao centro, dados ao lado do botão. A ordem de turno tem no máximo "altura da área menos 80 px".
- (assumido) O contêiner leva `janela-<id>` e o testid antigo fica no miolo.

### Desvios do plano

- Nenhum. Nada mudou na sala, no protocolo nem na exportação; nenhuma dependência nova (`createPortal` é do `react-dom` já instalado).

### Frágil / não verificado

- Toque (celular): arrastar e redimensionar só foram testados com mouse.
- Em 1280×720, com ordem de turno, ficha e painel do token abertos nas posições padrão, as três se sobrepõem em parte (o painel do token fica embaixo à esquerda, atrás da ficha se ela foi aberta depois); a última clicada fica por cima.
- A ficha de 520 px (o mínimo, e o tamanho padrão em 1280×720) fica apertada: o resumo quebra em duas linhas, mas outros trechos da ficha ainda foram pensados para mais largura. Polimento é do R6.
- Janela sem posição guardada acompanha a área (a ficha em 60%, a ordem de turno colada no canto); só depois de mexer ela passa a ficar onde foi deixada.
- Fontes de luz e paredes abrem lado a lado e a iluminação ao centro: em telas estreitas as três podem se cobrir em parte.
- Só o Chrome foi testado.

### Roteiro manual (pendente)

1. Abrir a ordem de turno, uma ficha e o painel do token (selecionar um token): cada uma abre num lugar diferente, sem cobrir as barras.
2. Arrastar cada janela pelo cabeçalho para outros cantos; tentar arrastar para fora da área: ela para na borda. Recarregar a página: tudo volta onde ficou. Outro navegador (outro perfil) abre nos lugares padrão.
3. Dois cliques no título minimizam (só a barra); dois cliques restauram; recarregar mantém minimizada. O botão "−" também.
4. Redimensionar a ficha pela quina e a ordem de turno pela borda de baixo.
5. Estreitar a janela do navegador e alargar o painel direito: as janelas são empurradas para dentro; ao voltar, voltam ao lugar.
6. Clicar numa janela a põe por cima das outras. Arrastar começando por um botão do cabeçalho não move.
7. Com o cabeçalho focado (Tab), as setas movem a janela; Esc não a fecha.
8. Abrir duas fichas: a segunda desloca em cascata. Abrir fontes de luz, paredes, iluminação e dados rápidos: dentro da área; os dados abrem ao lado do botão da barra.
9. Configurações, "Tema de cor": as bolinhas de Druida, Leviatã, Licantropo e Paladino se distinguem.
10. Os 3 temas nas duas larguras de janela.

### Revisão (antes do commit de fechamento)

- Os 56 prints (3 temas × 1600×900 e 1280×720: posições padrão, ordem de turno minimizada, ficha redimensionada, as três arrastadas, fontes de luz, iluminação, paredes, dados rápidos, duas fichas em cascata e o seletor de tema) conferidos: janelas dentro da área, sem cobrir as barras, cabeçalho legível nos três temas; o seletor distingue Druida, Leviatã, Licantropo e Paladino. Dois defeitos achados e corrigidos antes de entregar: o resumo da ficha (CA, iniciativa, deslocamento, proficiência, percepção) tinha os rótulos sobrepostos na largura de 60% (agora quebra em duas linhas) e as abas da ficha cortavam "Configurar". Ficou visível, e é o que a lista de frágeis diz, que com três janelas abertas em 1280×720 elas se sobrepõem em parte. (Falta a revisão do Vilella.)

---

## Redesign R4 — Organização do mestre (entregue, aguardando o roteiro manual)

### O que foi entregue

- **Menu superior em grupos com nome** (`MenuSuperior.tsx`): Cena (Cenas, Camadas), Mapa (Novo token), Luz (Visão noturna, Iluminação), Combate (Ordem de turno) e Ver como. Separador fino entre os grupos e o nome do grupo embaixo dos ícones; cabe nos 48 px do topo em 1280×720, sem cobrir presença nem pausa.
- **Dica em todo botão** (nome e o que faz) no mouse e no foco do teclado, `aria-label` com o nome e `aria-describedby` na dica (`data-testid="dica-<testid do botão>"`).
- **Ícones que dizem o que são**: a Iluminação virou a lâmpada; a lua só liga a visão noturna; **"Ver como"** tem botão próprio (olho, `menu-ver-como`) com a lista "Eu mesmo (mestre)" e os jogadores. O clique direito na lua não abre mais nada.
- **"Eventos" saiu** (botão e painel). O menu de Iluminação perdeu "Paredes e portas" e ganhou **"Modelos de tocha…"** (`lanterna-modelos`), que abre a aba Mesa na seção de luz (rola até ela, mesmo com o painel recolhido).
- **Paredes e portas é ferramenta da barra esquerda** (`ferramenta-paredes`, só do mestre fora do "ver como"): liga o modo e abre a janela `paredes`; botão apertado, cursor de mira e selo "Modo Paredes e portas" com "Sair do modo" (`modo-paredes-selo`, `modo-paredes-sair`) na área do mapa. Sai ao trocar de ferramenta, apertar de novo, fechar a janela ou "Sair do modo".
- **Abas do painel direito**: mestre, Chat, Fichas, Notas, Compêndio, Mesa, Preferências; jogador, Chat, Fichas, Notas, Compêndio, Preferências (`aba-notas`, `aba-mesa`, `aba-preferencias`). As abas Configurações e Mestre deixaram de existir. **Notas** (`AbaNotas`, todos): a da mesa e, para o mestre, a do mestre; Fichas ficou só com pastas e fichas. **Preferências** (`AbaPreferencias`, todos): usuário, tema, encaixe, pasta local e transferências. **Mesa** (`AbaMesa.tsx`, só mestre): índice no alto (grudado) e seções Regras, Luz (modelos de tocha e objetos de luz), Papéis, Permissões, Campanha e Diagnóstico (recolhido, com o "uso de hoje").
- **Grid na configuração da cena** (`ConfigurarCena.tsx`): "Grid visível" e "Quadrado (metros)", gravados no Salvar com o mesmo frame de sempre (`cena.configurarGrid`).
- `BarraLateral` aceita um pedido de fora para abrir uma aba e rolar até uma seção (`PedidoDeAba`).

### Como rodar

- `pnpm verify` (uma vez). E2E novo: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/organizacao.spec.ts` (e os alterados, abaixo). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints r4`.
- **Não use `--workers` maior que 1** nos E2E: as sessões dividem uma sala só e os testes se atrapalham (achei isso ao repetir com 3 a 5 workers: falhas falsas de grid, nota e parede).

### Verificação

- `e2e/tests/organizacao.spec.ts` (10 testes): grupos com nome e dica no mouse e no foco, `aria-label`, cabe no topo de 48 px sem cobrir presença e pausa; "Ver como" pelo botão (e o clique direito na lua sem efeito); "Eventos" não existe e o menu de luz não tem Paredes; ferramenta Paredes (botão apertado, selo, janela, cursor de mira, desenha uma parede, sai ao trocar de ferramenta, ao apertar de novo, ao fechar a janela e pelo "Sair do modo"); o jogador não vê Paredes nem a aba Mesa e as abas de cada papel; Notas como aba própria (mestre vê as duas, jogador só a da mesa; Fichas sem notas; a nota continua chegando a todos); Preferências × Mesa (o que cada uma tem e não tem, índice, diagnóstico recolhido); grid pela configuração da cena (valor inválido, mesmo frame, todos veem); "Modelos de tocha…" abre a Mesa na seção de luz (também com o painel recolhido); as seis abas em 300 px (nome inteiro, dentro do painel, sem rolar de lado).
- E2E antigos alterados (a disposição mudou de propósito; nenhuma asserção de comportamento foi afrouxada):
  - `interface.spec.ts`: menu do mestre (agora confere `aria-label` em vez de `title`, inclui "Ver como", e "Eventos" passou a **não existir**; `lanterna-paredes` passou a não existir e `lanterna-modelos` existe); abas da direita (as 6 e as 5, sem as antigas); notas na aba Notas e Fichas sem notas; o conteúdo antes de "Configurações" agora é "Preferências" e o de "Mestre" é "Mesa", com o `uso-hoje` aberto pelo diagnóstico recolhido; o teste da largura fixa percorre as 6 abas; exportação abre a aba Mesa.
  - `estrutura.spec.ts`: os nomes e ids das abas em 300 px e recolhidas; "aba Mestre" virou "aba Mesa"; paredes pela ferramenta.
  - `paredes.spec.ts`: o corredor com porta liga o modo pela ferramenta; "ver como" pelo botão em vez do clique direito.
  - `janelas.spec.ts`: a janela de paredes abre pela ferramenta.
  - `mapa.spec.ts`: encaixe (Preferências), permissão (Mesa) e o grid (configuração da cena; agora a visibilidade também confere o frame enviado, não só a caixa marcada).
  - `cenas.spec.ts`: o grid da cena 2 pela configuração da cena.
  - `sala.spec.ts`: notas na aba Notas; papéis, permissões e exportação na aba Mesa; "trocar usuário" em Preferências.
  - `assets.spec.ts`, `desenho.spec.ts`: exportar e capacidade na aba Mesa.
  - `tema.spec.ts`: o seletor de tema em Preferências.
  - `tochas.spec.ts`: regras e modelos na aba Mesa; o jogador abre as Preferências e confere que lá não há `config-mesa`.
- `pnpm verify` verde numa rodada: 31 (servidor) + 35 (web) + 553 (shared) de unidade e 174 E2E (164 + 10 novos), sem instável (o `estrutura.spec.ts` "a alça também funciona pelo teclado" não reapareceu). Repetição 3x dos 12 specs tocados: 345 execuções (115 testes × 3) dos `organizacao`, `interface`, `sala`, `mapa`, `cenas`, `paredes`, `janelas`, `estrutura`, `tochas`, `assets`, `desenho` e `tema`: 344 verdes e 1 instável (`mapa.spec.ts` "o mestre cria, edita e apaga tokens; camada e grid": o jogador 1 arrastava o token antes de a sala lhe mandar a permissão de controlá-lo, que chega num evento próprio depois do nome e do tamanho; corrigido na causa, esperando o frame da permissão, e `mapa.spec.ts` repetido 3x de novo: 27 verdes; `organizacao.spec.ts` repetido de novo depois dos últimos ajustes de CSS: 30 verdes).
- Prints (3 temas, 1600×900 e 1280×720) em `prints-r4`: `<tema>-<largura>-01-topo-com-dica` (e `01-topo-recorte`), `02-ver-como`, `03-menu-de-luz`, `04-modo-paredes`, `05-aba-notas`, `06-aba-mesa-alto`, `07-aba-mesa-luz`, `07b-aba-mesa-papeis`, `08-aba-preferencias`, `09-configurar-cena-grid`, `10-painel-300-mestre`, `10b-painel-300-mesa`, `11-jogador-notas`, `12-jogador-painel-300` (84 prints).

### Decisões

- (assumido) "Ver como" é o quinto grupo do menu; o nome dos grupos fica em letra pequena embaixo (não cabe rótulo ao lado de cada ícone nos 48 px).
- (assumido) O botão Paredes fica embaixo do pincel, separado por um filete, e some no "ver como".
- (assumido) O grid da cena tem só "visível" e "quadrado em metros" (o modelo não tem cor do grid) e vale ao Salvar da configuração; quadrado fora de 0,3 a 10 m dá erro no formulário.
- (assumido) Esc no modo Paredes só encerra a sequência em andamento (como antes); sair do modo é pela barra, pelas teclas V/H/R, pela janela ou pelo selo. Esc soltar a seleção é do R5.
- (assumido) As seis abas cabem numa linha a partir de 300 px, com os nomes inteiros (na revisão a folga lateral de cada aba caiu de 4 para 2 px; antes quebravam em 4 + 2, e em 5 + 1 em 1280×720).
- (assumido) Não existe aba guardada entre visitas (o painel sempre abre no Chat), então não houve migração de "Configurações" nem de "Mestre".
- (assumido) Sem controle numérico de largura do painel nas Preferências (fica a alça do R2).
- (assumido) A aba Mesa aparece e some na hora quando o papel muda.

### Desvios do plano

- Nenhum. Nada mudou na sala, no protocolo nem na exportação; nenhuma dependência nova.

### Frágil / não verificado

- Os E2E não aceitam mais de um worker (sala compartilhada); o config já fixa 1, mas vale lembrar ao repetir com `--workers`.
- A dica do menu do topo é um componente só do `MenuSuperior`; a barra esquerda segue com `title` nativo (sem dica no foco do teclado). Unificar é do R6.
- Os prints antigos (`e2e/prints/r1`, `r2`, `r2b`, `r3` e os dos lotes) usam o `aba-configuracoes` e o `lanterna-paredes` que não existem mais: não rodam como estão. Só o `r4` está em dia.
- O selo de modo existe só para Paredes (luz e ponto não têm selo).
- Só o Chrome foi testado.

### Roteiro manual (pendente)

1. Como mestre, olhar o topo: cinco grupos (Cena, Mapa, Luz, Combate, Ver como). Passar o mouse e tabular por todos os botões: cada um mostra a dica com nome e o que faz.
2. "Ver como": abrir pelo botão do olho, escolher um jogador (selo "Vendo como", a barra perde o botão Paredes), voltar a "Eu mesmo (mestre)". A lua só liga e desliga a visão noturna; o clique direito nela não faz nada.
3. Iluminação (lâmpada): "Iluminação dinâmica", "Fontes de luz", "Configurações de iluminação" e "Modelos de tocha…". O último abre a aba Mesa já na seção de luz; testar com o painel recolhido.
4. Barra esquerda, botão Paredes e portas: liga o modo (botão apertado, selo, janela com o tipo, mira); desenhar uma parede e uma porta; sair por outra ferramenta, pelo botão, pelo X da janela e por "Sair do modo".
5. Abas: Notas (as duas, e a do jogador só com a da mesa); Fichas só com pastas; Preferências (tema, encaixe, pasta, transferências, trocar usuário); Mesa (índice no alto, regras, modelos, papéis, permissões, campanha, diagnóstico recolhido com o "uso de hoje").
6. Cenas, configurar uma cena: "Grid visível" e "Quadrado (metros)" gravam ao Salvar e os jogadores veem o novo grid.
7. Painel direito em 300 px: as seis abas legíveis numa linha.
8. Os 3 temas nas duas larguras de janela.

### Revisão (antes do commit de fechamento)

- Os 84 prints (3 temas × 1600×900 e 1280×720) conferidos: o topo cabe em uma linha com grupos, dicas legíveis e a presença e a pausa livres; a lista do "Ver como" abre sob o botão; o modo Paredes mostra o botão apertado, a janela e o selo; Notas, Mesa (índice e seções), Preferências, a configuração da cena com o grid e a mesa do jogador (5 abas) estão nos 3 temas; com o painel em 300 px as abas cabem numa linha sem cortar (depois do ajuste da revisão). Dois defeitos achados e corrigidos antes de entregar: o selo do modo Paredes encostava no zoom em 1280×720 (foi para o canto inferior esquerdo da área) e o atalho "Modelos de tocha…" rolava a seção para baixo do índice grudado (ganhou margem de rolagem). Visto e **não** tocado: no seletor de tema, com o painel em 360 px, o nome "Pergaminho" quebra em duas linhas na última bolinha sozinha (vem do R2b). (Falta a revisão do Vilella.)

---

## Redesign R5a — Interações no mapa e nos tokens (entregue, aguardando o roteiro manual)

### O que foi entregue

- **Esc solta a seleção** (`Mesa.tsx`): limpa a seleção, fecha os menus do botão direito, a regra aberta e a dica, e cancela o modo "pôr token"; o mapa (`mapaPixi.ts`) desfaz o arrasto de token e de alça em andamento e apaga a régua. Não age com o foco num campo de texto nem dentro de uma janela, e não fecha janelas.
- **O painel do token não abre ao selecionar**: abre por "Editar token…" (`menu-token-editar`, menu do botão direito) e por dois cliques no token (só mestre). Segue o token selecionado; fecha quando não há seleção.
- **Novo token** (`NovoToken.tsx`): janela `novo-token-janela` com nome (`novo-token-nome`, Enter cria), cor (`novo-token-cor-<n>`) e tamanho (`novo-token-tamanho`); depois o **modo de pôr** (selo `modo-pondo-token-selo`, cancelar em `modo-pondo-token-cancelar`) com prévia sob o cursor; o clique envia `token.criar`. Esc, Cancelar, trocar de ferramenta ou de cena cancelam sem frame.
- **Tocha**: dica na alça (`dica-tocha`), alça e tempo maiores, afastamento do ícone de ponto de luz, e o grupo "Tocha" no menu do token (`menu-token-grupo-tocha`, `menu-token-tocha-alternar-<id>`, `menu-token-tocha-guardar-<id>`) com os mesmos frames de antes.
- **Condições**: o menu do token mostra as 14 direto como itens de marcar (menu aberto entre as marcações), sem "Condições…" nem "Fechar"; marcadores maiores; a regra abre por clique (`regra-condicao`).
- **Régua**: botão "Fixar" (`regua-fixar`), Shift ao soltar, medidas fixas (`regua-fixa-rotulo`) que saem com Esc, clique nelas, troca de ferramenta ou de cena. Só da tela.
- **Aviso perto do clique** (`AvisoPerto.tsx`, `useSala.ts`): dentro da área do mapa, ao lado do ponto da ação (6 a 12 s; um clique dispensa); sem origem, no alto da área.
- **Jogador sem token**: cartão `sem-token` no meio da área, com texto para "sem personagem" e para "personagem fora da cena".
- Nada na sala, no protocolo nem na exportação mudou; nenhuma dependência nova.

### Como rodar

- `pnpm verify` (uma vez). E2E novo: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/interacoes.spec.ts`. Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints r5a`.
- Só 1 worker nos E2E (sala compartilhada).

### Verificação

- `e2e/tests/interacoes.spec.ts` (11 testes): Esc solta a seleção e fecha o menu, sem fechar janela nem agir com o foco em campo; Esc no arrasto devolve o token; selecionar não abre o painel, "Editar token…" e dois cliques abrem, e nenhum frame sai; Novo token (nome, cor, tamanho, prévia, Esc/Cancelar sem `token.criar`, criação com os valores pedidos); dica da tocha e ações pelo menu do token com o mesmo frame dos dois cliques (e para o jogador dono); duas condições marcadas sem reabrir e a regra por clique (fecha com Esc e clique fora); régua fixa (Fixar, Shift, Esc, clique, trocar de ferramenta, local); aviso perto do clique (dentro da área, dispensável); jogador sem token (some quando o token aparece) e jogador com personagem fora da cena.
- Unidade: `duracaoDoAviso` em `useSala.test.ts`.
- E2E antigos alterados (a disposição mudou de propósito; nenhuma asserção de comportamento afrouxada):
  - `ajudasMapa.ts`: `selecionarToken` agora seleciona e abre o painel por dois cliques (o que "selecionar" fazia antes); novos `soSelecionarToken`, `abrirPainelDoToken` e `criarToken` (formulário, Enter e clique no mapa); `TokenVisto.selecionado` e `previaDoToken` no gancho.
  - `mapa.spec.ts`, `fichas.spec.ts`, `cenas.spec.ts`, `assets.spec.ts`: "Novo token" agora passa pelo formulário e pelo clique no mapa (`criarToken`); onde o painel abria ao selecionar, abre por dois cliques; `mapa.spec.ts` confere que selecionar não abre o painel.
  - `interface.spec.ts`: o clique no token na camada certa seleciona e não abre o painel; dois cliques abrem.
  - `combate.spec.ts`: o menu do token mostra as condições direto (sem "Condições…" nem "Fechar"; Esc fecha) e o jogador não tem "Editar token…" nem iniciativa.
  - `cenas.spec.ts` ("preparar"): espera a sala aplicar a imagem ao token antes de preparar de novo (era uma corrida: falhou uma vez na primeira rodada).
- `pnpm verify` verde numa rodada: 31 (servidor) + 37 (web) + 553 (shared) de unidade e 185 E2E (174 + 11 novos), sem instável. Repetição 3x dos 7 specs novos ou alterados (`interacoes`, `mapa`, `interface`, `combate`, `cenas`, `assets`, `fichas`): 162 execuções (54 testes × 3) verdes, sem instável. Os specs `tochas`, `estrutura`, `janelas`, `paredes` e `luz` (afetados pela alça maior e pelo painel) passaram na rodada única e no verify.
- Prints (3 temas, 1600×900 e 1280×720) em `prints-r5a`: `<tema>-<largura>-01-novo-token-formulario`, `02-pondo-token`, `03-menu-do-token`, `04-marcadores-e-regra`, `05-dica-da-tocha`, `06-regua-fixa`, `07-aviso-perto-do-clique`, `08-jogador-sem-token` (48 prints).

### Decisões

- (assumido) Dois cliques no token abrem o painel (só mestre); o painel fecha sem seleção.
- (assumido) "Novo token" cria um por vez; o encaixe segue a preferência (Alt inverte); sem campo de camada.
- (assumido) Régua: botão "Fixar" e Shift ao soltar; as fixas se acumulam e saem juntas.
- (assumido) O menu do token não tem "Entregar" a tocha.
- (assumido) Clicar num marcador abre a regra e não arrasta o token.
- (assumido) Aviso de 6 a 12 s conforme o tamanho do texto, um clique dispensa; sem origem fica no alto.
- (assumido) Dica da tocha e menu do token só por mouse.
- (assumido) Esc no meio do arrasto devolve o token à origem.
- (assumido) O estado vazio do jogador só aparece com a iluminação dinâmica ligada.
- (assumido) Em token pequeno cabem menos marcadores (o resto vira "+N").

### Desvios do plano

- Nenhum. A régua já ficava na tela depois de soltar até o próximo gesto (o teste antigo já dizia isso); o que o item pedia, e foi feito, é poder **fixá-la** para medir outra e ter um caminho visível (botão).

### Frágil / não verificado

- Toque (celular) e teclado: dica da alça, menu do token e arrasto só com mouse.
- Aviso sem origem (a sala avisando) não tem E2E.
- A origem do aviso é o ponteiro de até 1,5 s antes do envio (ou o campo focado): erro que volta tarde pode aparecer perto do ponto errado.
- Os prints antigos que usam `menu-token-condicoes` e `menu-token-fechar` (r1, r2, lote-11, auditoria) não rodam mais.
- Só o Chrome foi testado.

### Roteiro manual (pendente)

1. Selecionar um token: nada abre. Esc solta. Botão direito, "Editar token…" e dois cliques abrem o painel; Esc com o cursor num campo de texto não solta.
2. "Novo token": nome, cor, tamanho, Enter; a prévia segue o cursor; clique põe; Esc e Cancelar não criam nada.
3. Acender uma tocha: passar o mouse na alça (dica), dois cliques, botão direito no token (grupo Tocha: apagar, acender, guardar). Pôr um ponto de luz perto do token: a alça não cobre o ícone.
4. Botão direito num token: marcar várias condições sem reabrir; clicar num marcador abre a regra (Esc ou clique fora fecha).
5. Régua: medir, "Fixar", medir outra, Shift ao soltar; Esc, clique na medida e trocar de ferramenta a tiram.
6. Provocar um erro (jogador longe de uma porta): o aviso aparece perto do clique; um clique o dispensa.
7. Entrar como jogador sem token: cartão explicando; o mestre põe o token e o cartão some.
8. Os 3 temas nas duas larguras de janela.

### Revisão (antes do commit de fechamento)

- Os 48 prints conferidos (vistos em detalhe: menu do token e modo de pôr no Grimório 1280×720, marcadores e regra no Pergaminho 1600×900, régua fixa e aviso no Edgerunner 1280×720, estado vazio no Pergaminho 1280×720, dica da tocha no Grimório 1600×900 e o formulário no Edgerunner 1280×720): o menu cabe em 1280×720, o aviso aparece ao lado do clique, o cartão vazio fica no centro e legível, a régua mostra a fixa e a solta com "Fixar". Um defeito achado e corrigido: a dica da tocha cobria o tempo da alça (agora abre mais abaixo). (Falta a revisão do Vilella.)

---

## Redesign R5b — Combate, fichas, compêndio e PDF (entregue, aguardando o roteiro manual)

### O que foi entregue

- **Ordem de turno compacta** (`OrdemDeTurno.tsx`): uma linha com Anterior, Próximo turno e o botão Montar (`ordem-montar-alternar`); o resto (rolar para todos, ordenar, adicionar selecionados, o grupo, entrada solta, encerrar) fica na seção "Montar" (`ordem-montar`). Aberta ou fechada é preferência do navegador (`tabletop:pref:ordem:montar`, sem frame); sem escolha, aberta antes do combate e recolhida depois. O valor da iniciativa só vale no Enter ou ao sair do campo (digitar, setas e roda só mudam o texto); Esc devolve o valor de antes.
- **Botão desabilitado diz por quê** (`BotaoComDica.tsx`, novo): `aria-disabled` com o clique ignorado, motivo na dica (hover e foco, `role="tooltip"`, `data-testid="dica-<testid do botão>"`) e na descrição acessível.
- **Ficha com um clique** (`AbaFichas.tsx`): um clique ou Enter no item (`ficha-abrir-<id>`) abre ou traz para a frente; dois cliques abrem uma só; a dica é "Abrir a ficha" (mestre: com "arraste para o mapa"); o mestre arrasta o item inteiro e isso não abre a ficha.
- **Compêndio** (`AbaCompendio.tsx`, `useCompendio.ts`, `exemploSrd.ts`): "Usar o exemplo do SRD (3 magias)" (`compendio-usar-exemplo`), "Escolher o arquivo…" e a ajuda do JSON recolhida (`compendio-ajuda-formato`); com pasta grava `compendio/magias.json` (confirma antes de substituir: `compendio-exemplo-confirmar`); sem pasta vale até recarregar; atribuição do SRD aberta nos créditos (`compendio-creditos-texto`) e `compendio-exemplo-em-uso`; vazio do jogador explicado.
- **PDF** (`useImportadorDePdf.tsx`, `RevisaoDoPdf.tsx`): "Importar PDF…" nos três lugares (`ficha-novo-pdf`, `ficha-menu-importar-pdf-<id>`, `editor-importar-pdf`); revisão com destino (`revisao-destino`, `revisao-sugestao`), botão final "Criar a ficha" / "Substituir a ficha de X" (`revisao-confirmar`), contagem "N campos para conferir" (`revisao-total-incertos`), "Próximo a conferir" (`revisao-proximo-incerto`), "Mostrar tudo" (`revisao-mostrar-tudo`) e seções sem incerto recolhidas com resumo (`revisao-secao-<id>` com `data-aberta`, `revisao-resumo-<id>`, `revisao-secao-alternar-<id>`).
- Nada na sala, no protocolo nem na exportação mudou; nenhuma dependência nova. Só para os testes: gancho `usarMemoriaComoPasta` (modo `e2e`) e `Memoria.gravar` que devolve o `.json` gravado.

### Como rodar

- `pnpm verify` (uma vez). E2E novos: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/fluxos.spec.ts tests/combate.spec.ts tests/importarPdf.spec.ts`. Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints r5b`.
- Só 1 worker nos E2E (sala compartilhada).

### Verificação

- `e2e/tests/fluxos.spec.ts` (11 testes): ordem de turno (digitar, setas e Esc sem frame nem reordenar até o Enter; Montar recolhe, vem aberta/recolhida conforme a rodada, fica só no navegador e o jogador não a tem; cada botão desabilitado com motivo no hover, no foco e na descrição acessível, e clique forçado não manda nada); fichas (um clique, dois cliques, Enter, menu do item e arrastar não abrem); compêndio (exemplo sem pasta com as 3 magias e a atribuição, o jogador vendo como vê hoje, vazio do jogador; com a "pasta" dos testes, grava `compendio/magias.json` e confirma antes de substituir); PDF (mesmo nome nos dois caminhos, destino preenchido pelo menu, sugestão por nome, só os personagens editáveis como destino, seções recolhidas, "Próximo a conferir", "Mostrar tudo", confirmar gera o mesmo `ficha.alterar` e o personagem novo).
- Unidade: `preferencias.test.ts` (preferência da seção Montar).
- E2E antigos alterados (a disposição mudou de propósito; nenhuma asserção de comportamento afrouxada):
  - `compendio.spec.ts`: abre "Como montar o seu arquivo" antes de conferir o exemplo do JSON.
  - `combate.spec.ts`: antes de "Encerrar combate" (que agora mora em "Montar", recolhida depois que o combate começa) chama o novo `abrirMontar` (`ajudasCombate.ts`).
  - `importarPdf.spec.ts`: o texto do selo passou de "campos para revisar" para "campos para conferir".
- `pnpm verify` verde na segunda rodada: 31 (servidor) + 39 (web) + 553 (shared) de unidade e 196 E2E (185 + 11 novos), sem instável. A primeira rodada reprovou 1 E2E antigo (`compendio.spec.ts`, "JSON inválido…", falhou também na repetição): esperava ver o exemplo do JSON no estado vazio, que agora fica recolhido; o teste passou a abrir o título "Como montar o seu arquivo" antes (listado acima).
- Repetição 3x: `fluxos` (11 testes, 33 execuções), `combate` + `importarPdf` (30 execuções) e `compendio` (30 execuções) verdes, sem instável.
- Prints (3 temas, 1600×900 e 1280×720) em `prints-r5b`: `<tema>-<largura>-01-ordem-mestre-montar-aberto`, `02-ordem-mestre-montar-fechado`, `03-ordem-jogador`, `04-dica-botao-desabilitado`, `05-aba-fichas`, `06-compendio-vazio-mestre`, `07-compendio-vazio-jogador`, `08-compendio-com-exemplo`, `09-pdf-revisao-alto`, `10-pdf-revisao-secoes-recolhidas` (60 prints).

### Decisões

- (assumido) Controles de montar numa seção recolhível "Montar" (não num menu "Mais"), aberta antes do combate e recolhida depois, até a pessoa escolher.
- (assumido) Esc no campo da iniciativa devolve o valor de antes; a roda do mouse num campo com foco tira o foco.
- (assumido) Anterior e Próximo turno também dizem "A lista está vazia" quando desabilitados.
- (assumido) A dica do botão desabilitado aparece também ao mexer o mouse sobre ele (o botão pode ficar desabilitado com o mouse já em cima).
- (assumido) O mestre arrasta o item das Fichas por inteiro, não só pela alça.
- (assumido) "Usar o exemplo" com pasta grava e confirma antes de substituir; sem pasta vale até recarregar; falha ao gravar na pasta mostra erro (não cai para "sem pasta").
- (assumido) A atribuição do SRD fica nos créditos (aberta) e numa linha "Exemplo do SRD 5.1 em uso", só enquanto o compêndio da mesa é o exemplo (hash).
- (assumido) O nome do PDF que bate com um personagem só sugere o destino.
- (assumido) O nome do personagem novo mora no bloco do destino; "N campos para conferir" no lugar de "para revisar".
- (assumido) "Próximo a conferir" dá a volta; "Mostrar tudo" vira "Recolher o que está certo".

### Desvios do plano

- Nenhum. O levantamento dizia que a lista reordenava enquanto se digita; no código atual isso já não acontecia (o campo só confirma no Enter/saída). Foi fechado o único caminho que sobrava (a roda do mouse) e o comportamento passou a ter teste.

### Frágil / não verificado

- A dica do item das Fichas é o `title` nativo do navegador (não aparece em print).
- O "grava na pasta" do exemplo só foi testado com a `Memoria` dos testes, não com a pasta real do Chrome.
- O arrasto do item pelo nome (botão `draggable`) foi testado no Chrome; Firefox e Safari tratam botão arrastável de outro jeito.
- Os prints antigos com `ordem-*` depois do combate começar (Montar recolhida) e os que clicam em "Confirmar importação" podem precisar de ajuste (R6).
- Só o Chrome foi testado.

### Roteiro manual (pendente)

1. Como mestre, abrir a Ordem de turno: adicionar o grupo, digitar valores (a lista só muda no Enter ou ao sair do campo; Esc volta ao valor de antes), "Próximo turno": "Montar" recolhe sozinha; abrir e fechar e recarregar a página (a escolha fica).
2. Passar o mouse e tabular nos botões cinza ("Rolar para todos" depois que todos têm valor, "Adicionar selecionados" sem token ou com token já na lista, "Encerrar combate" sem combate): cada um diz o motivo.
3. Aba Fichas: um clique abre a ficha; dois cliques não abrem duas; arrastar o item (pelo nome e pela alça) para o mapa põe o token e não abre a ficha; o menu "…" não abre.
4. Aba Compêndio vazia como mestre: "Usar o exemplo do SRD (3 magias)" sem pasta e, com a pasta local escolhida, de novo (grava `compendio/magias.json`; recarregar a página mantém); com o arquivo já existente, o aviso antes de substituir; a atribuição do SRD nos créditos. Como jogador: o aviso do compêndio vazio e depois as magias.
5. "Importar PDF…" pelo botão da aba e pelo menu de um item: destino, sugestão pelo nome, "Próximo a conferir", seções recolhidas, "Mostrar tudo", "Criar a ficha" e "Substituir a ficha de X".
6. Os 3 temas nas duas larguras de janela.

### Revisão (antes do commit de fechamento)

- Os 60 prints foram gerados e uma amostra conferida (ordem do mestre aberta e recolhida e dica de botão desabilitado nos 3 temas em 1280×720, ordem do jogador, compêndio vazio do mestre e do jogador, compêndio com exemplo e atribuição, revisão do PDF em 1280×720 e 1600×900): Montar cabe na janela, a dica do botão desabilitado legível (cobre o botão vizinho por um instante, aceitável), seções recolhidas com resumo, destino e contagem no alto. Nada cortado ou sobreposto de forma feia. (Falta a revisão do Vilella.)

## Redesign R6a — Teclado, dicas com atalho, foco e contraste (entregue, aguardando o roteiro manual)

Detalhes e decisões em `docs/REDESIGN.md` ("R6a — como ficou").

### O que foi entregue

- Uma dica só (`Dica.tsx`, `BotaoComDica.tsx`), no mouse e no foco, com o atalho em `<kbd>`, motivo de desabilitado e `aria-describedby`; barra esquerda, sub-barra do pincel, zoom, janelas, Fichas, "+N", recolher e abas deixaram o `title` nativo.
- Tabela única de atalhos (`atalhos.ts`) que gera as dicas e a lista "Atalhos do teclado" nas Preferências.
- Menu do token por Shift+F10 ou tecla de menu (setas, Enter, Espaço, Esc, foco devolvido ao mapa); o mapa recebe foco.
- Anel de foco único (`--foco`, token novo nos 11 temas, 3:1 no `temas.test.ts`).
- Texto das iniciais branco ou preto pela cor (`contrasteDeCor.ts`), no avatar, na presença, na entrada, na condição da ficha e no token do mapa.
- Espaço ativa o botão focado pelo teclado (antes o mapa o roubava).
- Nada na sala, no protocolo nem na exportação mudou; nenhuma dependência nova.

### Como rodar

- `pnpm verify` (uma vez). E2E novos: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/teclado.spec.ts tests/fluxos.spec.ts`. Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints r6a`.
- Só 1 worker nos E2E (sala compartilhada).

### Verificação

- `e2e/tests/teclado.spec.ts` (11 testes): dica no mouse e no foco por Tab com o atalho (topo, barra esquerda, zoom, cabeçalho e botões da janela); lista de atalhos igual à tabela; Shift+F10 abre o menu do token, setas, Home/End, Enter e Espaço marcam condições (mesmo frame do clique) e Esc devolve o foco; sem token selecionado e com o foco no chat a tecla não abre; o jogador abre o do próprio token; tocha apagada e acesa e guardada só pelo teclado (frames de sempre); "+N" da presença por Enter, Espaço e Esc; anel de foco nos 3 temas em 11 controles; contraste AA dos avatares.
- Unidade: `atalhos.test.ts`, `contrasteDeCor.test.ts` (grade de cores AA) e, em `temas.test.ts`, o 3:1 do anel de foco nos 11 temas.
- E2E antigo alterado (disposição mudou de propósito; nada afrouxado): `fluxos.spec.ts`, no teste do item das Fichas: a dica "Abrir a ficha (arraste para o mapa…)" deixou de ser o atributo `title` e virou a dica comum (`dica-ficha-abrir-<id>`, no hover); confere o mesmo texto para mestre e jogador. Os E2E da dica do topo (`organizacao.spec.ts`) e dos motivos (`fluxos.spec.ts`) passaram sem mudança.
- `pnpm verify` verde na primeira rodada: 31 (servidor) + 59 (web) + 553 (shared) de unidade e 207 E2E (196 + 11 novos), sem instável. Repetição 3x de `teclado` e `fluxos`: 66 execuções verdes.
- Prints (3 temas, 1600×900 e 1280×720) na pasta prints-r6a do scratchpad da sessão.

### Decisões

- (assumido) Lista de atalhos nas Preferências; mapa com `tabIndex=0`; `--foco` igual ao `acentoForte`; texto de iniciais branco ou preto puro; rótulos do mapa independentes do tema; jogador abre o menu do primeiro token que controla; Espaço ativa o botão só quando o foco veio do teclado; Esc com o menu aberto segue soltando a seleção.

### Desvios do plano

- A dica da alça da tocha por foco ficou de fora (a alça é do canvas); a tocha pelo teclado vale pelo menu do token.
- A tabela só tem atalhos que já existiam, mais o do menu do token; nenhum botão do topo ganhou atalho.

### Frágil / não verificado

- Só o Chrome foi testado; o menu nativo do navegador na tecla de menu foi suprimido por tempo (700 ms) e só conferido com teclas do Playwright.
- Ainda com `title` nativo: campos e botões menores das fichas, fontes de luz, editor do item, ordem de turno, chat, faixa de cenas, cores do pincel e a alça do item das Fichas.
- Rótulos do mapa fixos (claro com contorno preto): vistos sobre mapa claro e escuro, não sobre cores intermediárias.
- Os prints antigos continuam quebrados (R6b).

### Roteiro manual (pendente)

1. Tab pelo topo, pela barra esquerda e pelo zoom: cada botão mostra a dica com o atalho; Esc a esconde.
2. Preferências: a lista "Atalhos do teclado" bate com o que funciona (V, H, R, Espaço, Esc, Delete, Alt, Shift).
3. Selecionar um token com o mouse, focar o mapa (clique ou Tab) e apertar Shift+F10 (e a tecla de menu, se houver): o menu abre junto do token; setas, Enter, Espaço, Esc.
4. Tocha acesa: apagar, acender e guardar pelo menu do teclado.
5. Como jogador, Shift+F10 abre o menu do próprio token.
6. O anel de foco aparece nos 3 temas em abas, janelas, "+N" e mapa; Espaço num botão focado por Tab o aciona, e com o mouse no mapa ainda arrasta a vista.
7. Avatares do mestre (amarelo) e de tokens claros com texto escuro legível.

---

## Redesign R6b — Tela pequena, frágeis restantes, transições e revisão final (entregue, aguardando o roteiro manual)

Último lote do redesign. Detalhes e decisões em `docs/REDESIGN.md` ("R6b — como ficou").

### O que foi entregue

- Ficha a 520 px: Raça, Antecedente e Alinhamento empilham e o texto cabe (`.fh-grade-3`, `auto-fit`).
- Posições padrão em 1280×720 (área "apertada", altura < 900 px): o painel do token vai embaixo à direita, abaixo da ordem de turno, e os dois dividem a altura da coluna; ordem, ficha e painel do token não se cobrem, em qualquer ordem de abertura.
- A vista do mapa mantém o centro quando a área muda de tamanho (alça do painel, recolher o painel, janela do navegador).
- Pílula da pausa com a mesma largura rodando e pausada; espaço da pílula reservado para o jogador.
- "Pergaminho" numa linha no seletor de tema com o painel em 360 px.
- Aviso da pausa sem mestre para o jogador (dica da pílula pela dica comum e aviso no alto da área do mapa), sem frame novo (`useSala.avisar`).
- Transições de 140 ms (janelas, menus, popovers, dicas, avisos e troca de aba), desligadas por `prefers-reduced-motion`; nada no canvas.
- Quatro setas como um grupo só nas dicas e na lista de atalhos; dica sem quebrar o "·" sozinho.
- Rótulos dos tokens em pílula escura translúcida (legíveis sobre mapa claro e escuro).
- Dica comum (`BotaoComDica`) no lugar do `title`: ordem de turno, pincel, chat, fontes de luz e dados rápidos.
- O modal "Configurar cena" passou a abrir num portal no `body` (com o painel do token embaixo à direita, ele ficava atrás da janela).
- Prints: apagados os dos lotes 6 a 14 e `r1`, `r2`, `r2b`, `r3`; `auditoria` refeito como tour da interface de hoje; novo `r6b`.
- `PROJETO.md` aponta Preferências e Mesa; `docs/PASSAGEM.md` pronto como ponto de partida do Vilella.
- Nada na sala, no protocolo nem na exportação mudou; nenhuma dependência nova.

### Como rodar

- `pnpm verify` (uma vez). E2E novos: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/polimento.spec.ts` (e os alterados: `tests/janelas.spec.ts tests/estrutura.spec.ts`). Os E2E rodam com `reducedMotion: "reduce"` (`playwright.config.ts`).
- Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints r6b` e `... prints auditoria` (o tour: 4 combinações, uma só com `$env:TOUR="grimorio-1280x720"`).
- Só 1 worker nos E2E (sala compartilhada).

### Verificação

- `e2e/tests/polimento.spec.ts` (6 testes): ficha a 520 px sem texto cortado (`scrollWidth` = `clientWidth` com valores longos); ordem, ficha e painel do token (e o zoom) sem sobreposição em 1280×720, também com a ordem aberta depois; o centro da vista se mantém ao mexer na alça do painel, recolher e mudar a janela; mesma largura da pílula rodando e pausada (mestre e jogador, e os avatares não se mexem); aviso e dica da pausa sem mestre (pausa manual não avisa); transições existem sem a preferência (140 ms) e somem com ela.
- E2E antigos alterados (disposição mudou de propósito; nada afrouxado): `janelas.spec.ts` (o painel do token em 1280×720 está embaixo à direita, acima do zoom, e não embaixo à esquerda); `estrutura.spec.ts` (a dica da pílula do jogador deixou de ser o `title` e virou a dica comum: confere o mesmo texto no hover).
- Config: `reducedMotion: "reduce"` em `playwright.config.ts` e `playwright.prints.config.ts` (e `actionTimeout` de 15 s nos prints).
- `pnpm verify` verde numa rodada (duas vezes: a segunda depois do ajuste final do teto da ordem e da dica de uma linha): 31 (servidor) + 59 (web) + 553 (shared) de unidade e 213 E2E (207 + 6 novos), sem instável. Repetição 3x de `polimento`, `janelas`, `estrutura` e `teclado`: 114 execuções verdes.
- Prints: tour (4 combinações, ~430 prints) em `prints-final` e `r6b` (72 prints) em `prints-r6b`, no scratchpad da sessão. `r4`, `r5a`, `r5b` e `r6a` rodam.

### Decisões

- (assumido) Ver a lista em `docs/REDESIGN.md` ("R6b — como ficou", Decisões).

### Desvios do plano

- Os prints antigos foram apagados (não refeitos): lotes 6 a 14 e `r1`, `r2`, `r2b`, `r3`.
- Ficam com `title` nativo: campos pequenos da ficha e do editor do item, os itens do menu de contexto da faixa de cenas (o E2E exige `disabled` de verdade), textos informativos da faixa de cenas, o botão `menu-pausa` do mestre (os E2E conferem o `title`) e o rótulo "Cor livre" do pincel.

### Frágil / não verificado

- Toque (celular) e navegadores além do Chrome seguem sem teste.
- Em área apertada o painel do token (418 px naturais) rola por dentro (teto ~245 px em 1280×720: vê nome, cor, tamanho e camada; "Apagar" e "Quem controla" ficam abaixo) e a ordem de turno também (teto ~340 px), enquanto os dois estão abertos; com "Montar" aberta a lista da ordem mostra poucas linhas. Telas menores que 1280×720 não foram vistas.
- Sem animação de saída; a entrada usa a propriedade CSS `translate` (Chrome atual).
- Presença vazia = "há mestre": quem entra antes da primeira presença não vê o aviso até ela chegar.
- Rótulos dos tokens: vistos sobre mapa claro e escuro, não sobre cores intermediárias.

### Roteiro manual (pendente)

1. Em 1280×720 (ou uma janela pequena): abra a ordem de turno com 4 ou mais entradas, o painel do token (dois cliques num token) e a ficha: nenhuma cobre a outra nem o zoom. Em tela grande, o painel do token volta para embaixo à esquerda.
2. Ficha no tamanho mínimo: Raça, Antecedente e Alinhamento inteiros.
3. Recolha e abra o painel direito, mexa na alça e redimensione a janela do navegador: o ponto no centro do mapa continua no centro.
4. Pause e retome a mesa como mestre: a pílula não muda de largura nem desloca os avatares.
5. Como jogador, com o mestre fechando a aba: a dica da pílula diz que o mestre saiu e aparece o aviso no alto do mapa.
6. Abra janelas, menus, dicas e troque de aba: entram suavemente; com "reduzir movimento" ligado no sistema nada anima.
7. Preferências com o painel em 360 px: "Pergaminho" numa linha; a dica do cabeçalho da janela mostra as quatro setas juntas.
8. Rótulos dos tokens legíveis sobre um mapa claro e um escuro.
9. Passe pelo tour de prints (`auditoria`) e anote o que quiser ajustar.

---

## Ajustes V1 — Temas com personalidade, aba Mesa no fim e zerar o relógio (entregue, aguardando o roteiro manual)

Primeiro lote dos ajustes que o Vilella pediu depois de usar a mesa (2026-11-11). Detalhes e decisões em `docs/REDESIGN.md` ("V1 — como ficou").

### O que foi entregue

- 14 temas de cor (eram 11): Grimório, Masmorra (id `escuro`, o antigo "Edgerunner"), Pergaminho; Edgerunner novo (id `edgerunner`: verde neon, roxo e amarelo), Vampiro (vermelho-sangue e preto), Licantropo (vermelho, cinza-chumbo e prata), Taverna, Forja, Paladino, Druida, Leviatã e Arcana, cada um com o acento da sua identidade; Élfico e Celestial, os dois claros novos. O seletor mostra nessa ordem e cabe em 300 px.
- A aba Mesa é a última (depois de Preferências), só do mestre.
- "Zerar o relógio" da pílula do mestre: botão de seta ao lado da pílula, menu "Opções do relógio", item "Zerar o relógio" e confirmação. É um marco (`relogio.marcoMs`); a pílula mostra `tempoDaSala − marcoMs` e as tochas não mudam.
- Estado/protocolo: campo opcional `marcoMs` no `RelogioSala`; intenção `mesa.zerarRelogio` (`mesa.configurar`); evento `mesa.relogioZerado` só para o mestre. Sem migração SQL (o relógio mora em JSON na tabela `meta`; sem o campo vale 0). Exportação continua v12 (campo opcional); exportar leva o marco e importar arquivo antigo vale marco 0. Nenhuma dependência nova.

### Como rodar

- `pnpm verify` (uma vez). E2E novos e alterados: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/ajustes-v1.spec.ts tests/tema.spec.ts tests/interface.spec.ts`.
- Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v1` (48 prints: 14 temas a 1600×900, 4 a 1280×720, o seletor, a aba Mesa e o menu do relógio em Grimório, Edgerunner e Celestial).

### Verificação

- Unidade: `zerarRelogio.test.ts` (shared; a conta da pílula, migração do relógio sem marco, zerar rodando e pausada, pausar e retomar guardam o marco, só o mestre zera, tochas com o mesmo restante antes e depois, o jogador sem o marco no evento e no snapshot, exportar e importar com e sem o marco); `armazenamento.test.ts` (servidor; banco antigo sem marco e marco que sobrevive ao reinício); `temas.test.ts` (14 temas, ordem, nomes, AA, foco 3:1, bolinhas distintas, acento diferente do Grimório, Vampiro e Licantropo sem amarelo).
- E2E novos: `ajustes-v1.spec.ts` (5 testes: Edgerunner, Élfico e Celestial aplicam e sobrevivem ao recarregar; aba Mesa última e só do mestre, também recolhida; zerar o relógio com tocha acesa e o jogador sem o marco nos frames; zerar pausada; menu do relógio só pelo teclado).
- `pnpm verify` verde: typecheck, lint limpo (325 arquivos), unidade (web 98, servidor 103, shared 752) e 324 E2E, nenhum instável; sem mudança de código depois dele.
- E2E antigos alterados (comportamento mudou de propósito; nada afrouxado): `tema.spec.ts` (11 viram 14 bolinhas, nova ordem e nomes, setas andam Grimório → Masmorra → Pergaminho, cores de fundo dos temas que mudaram, `escuro` agora se chama Masmorra); `interface.spec.ts` (a aba Mesa passou para depois de Preferências).
- `organizacao.spec.ts` também mudou (a lista de abas do mestre agora termina em Preferências, Mesa); o primeiro `pnpm verify` apontou só esse E2E.
- `pnpm verify` verde numa rodada (a segunda, depois de corrigir esse E2E): 32 (servidor) + 68 (web) + 561 (shared) de unidade e 218 E2E, sem instável. Repetição 3x de `ajustes-v1`, `tema`, `interface` e `organizacao`: 96 execuções verdes.
- Prints (48) em `prints-v1`, no scratchpad da sessão. Vistos: Edgerunner, Vampiro, Licantropo, Taverna, Forja, Paladino, Druida, Leviatã, Arcana, Élfico, Celestial, o seletor, a aba Mesa e o menu do relógio; Licantropo, Edgerunner, Élfico e Celestial foram ajustados depois do primeiro olhar (prata mais presente, roxo mais cinza, claros mais coloridos) e os prints refeitos.

### Decisões

- (assumido) Ver a lista em `docs/REDESIGN.md` ("V1 — como ficou", Decisões).

### Desvios do plano

- O brief falava em "o menu da pausa já existe (`menu-pausa`)", mas o `menu-pausa` é o botão que pausa e retoma, sem menu. O item "Zerar o relógio" ganhou um botão de seta ao lado da pílula (`menu-relogio`) com o menu dele.

### Frágil / não verificado

- Os temas foram medidos (contraste) e vistos nos prints, só no Chrome; não foram vistos por quem tem daltonismo.
- O marco só vai ao mestre; se o jogador um dia vir o relógio, o filtro (`relogioParaVisao` e `eventoPara`) muda.
- O menu do relógio não foi visto em tela de toque.

### Roteiro manual (pendente)

1. Preferências: o seletor mostra 14 bolinhas na ordem Grimório, Masmorra, Pergaminho, Edgerunner, Vampiro, Licantropo, Taverna, Forja, Paladino, Druida, Leviatã, Arcana, Élfico, Celestial, sem rolar de lado. Quem tinha o antigo Edgerunner guardado cai na Masmorra, igual.
2. Passe por cada tema com a mesa em jogo (mapa, tokens, uma janela, um menu): nenhum texto ilegível, nenhum tema parecido demais com outro. O Edgerunner é usável (neon só nos destaques).
3. A aba Mesa é a última à direita de Preferências; entre como jogador: ela não aparece.
4. Acenda uma tocha, deixe uns minutos passarem, abra a seta ao lado do relógio, "Zerar o relógio" e confirme: o relógio vai a 00:00 e volta a contar; o tempo da tocha não muda. Repita com a mesa pausada (continua pausada em 00:00).
5. Recarregue a página do mestre depois de zerar: o relógio continua pequeno (o marco foi guardado). Exporte e importe a mesa: o relógio continua zerado.
6. Como jogador: nada aparece do relógio nem do zerar.

---

## Ajustes V2 — Ordem de turno simples (entregue, aguardando o roteiro manual)

Segundo lote dos ajustes que o Vilella pediu depois de usar a mesa (2026-11-11). Detalhes e decisões em `docs/REDESIGN.md` ("V2 — como ficou").

### O que foi entregue

- A ordem de turno virou uma lista estreita (270 px, layout de referência a pedido do dono): cabeçalho só com o título e o ×; abaixo, "Rodada: N"; nome e número à direita, o da vez em destaque; rodapé do mestre numa linha com [← Turno anterior] [lixeira] [Ordenar] [→ Próximo turno]; lista vazia centralizada. O mestre edita os números e a rodada
  clicando (Enter confirma, Esc desfaz), ordena, volta e passa o turno e limpa (com confirmação). Arrasta a linha inteira ou usa Alt+↑/↓ na linha em foco;
  botão direito: "Dar a vez" e "Tirar da lista". Saíram "Montar" e tudo dentro, o olho, o "?", a alça, o × e o "Passar" do jogador.
- O mestre fecha a janela pelo × (fecha para todos, sem apagar a lista nem a rodada); o jogador fecha só na tela dele (volta quando o mestre reabre) e minimiza com dois cliques no cabeçalho (sem botão de minimizar).
- O jogador seleciona os tokens que controla (só na tela dele) e, com a ordem aberta, clica em Iniciativa na ficha: a sala rola 1d20 + a ficha, manda
  a rolagem ao chat e põe o token na lista. Com a ordem fechada, a Iniciativa só rola no chat.
- Protocolo: `combate.entrar { tokenId }` (sem capacidade, conferida), `combate.rodada { rodada }` e `combate.darVez { id }` (`combate.gerir`). Sem
  campo novo no estado e sem migração SQL: a ordem "na tela" é o `ordemDeTurnoVisivel` que já existia (estado antigo = fechada). Exportação continua
  v12. Nenhuma dependência nova.

### Como rodar

- `pnpm verify` (uma vez). E2E novos e alterados: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/ordem-simples.spec.ts tests/combate.spec.ts tests/fluxos.spec.ts tests/janelas.spec.ts`.
- Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v2` (mestre vazia, com 6 entradas na rodada 2, editando um número e a
  rodada, botão direito, confirmação do Limpar; jogador; jogador com o token selecionado clicando em Iniciativa; Grimório, Masmorra, Pergaminho e
  Edgerunner a 1600×900 e os três primeiros a 1280×720).

### Verificação

- Unidade (`packages/shared/src/combate.test.ts`, blocos "V2"): `combate.entrar` (rola na sala e o número é o do chat, ordem fechada, token alheio,
  invisível, de outra cena e repetido recusados; mestre com qualquer token; o do jogador vai público e o de NPC, oculto; `controladoPor`), o token que
  vai para a camada do mestre some da lista do jogador, `combate.rodada` e `combate.darVez` (permissões, limites, 0 tira a vez), Limpar não fecha a
  janela, fechar não apaga, exportar e importar. Migração: não há campo novo (o estado antigo sem `ordemDeTurnoVisivel` já vale `false`; testes antigos
  de v1 a v11 em `fichas.test.ts`, `luz.test.ts` e `paredes.test.ts`). Saiu o teste de preferência do "Montar" (`preferencias.test.ts`).
- E2E novos: `ordem-simples.spec.ts` (6 testes: abrir e fechar para todos sem apagar e reabrir; o jogador seleciona o próprio token, não o alheio, Esc,
  nada vai para a sala; Iniciativa da ficha com a ordem fechada, aberta, sem seleção e repetida, e o valor da lista igual ao do chat; o mestre pelo mesmo
  caminho; valor, rodada, Ordenar, Próximo turno (rodada 1 e virada), Limpar com confirmação; arrastar, Alt+setas, botão direito; sigilo pelos frames).
- E2E antigos alterados (comportamento mudou de propósito): `combate.spec.ts` (os passos de "Montar", Rolar para todos, ×, olho e o "Passar/Rolar" do jogador viraram intenções diretas ou saíram; Anterior e o × de cada linha pelo menu de botão direito; "Rodada: N"); `fluxos.spec.ts` (o teste da seção Montar saiu; o dos botões desabilitados agora cobre Anterior, Próximo, Ordenar e Limpar); `janelas.spec.ts` (sem botão de minimizar na ordem; a rodada fica no corpo e some minimizada); `teclado.spec.ts` (dica e foco no ×, o meio do cabeçalho é o título); `ficha.spec.ts` (arrasto do cabeçalho mais à esquerda: a ficha ficou um pouco mais larga); `polimento.spec.ts` (a ficha abre com 545 px e o teste a leva ao mínimo de 520 antes de conferir os campos); prints `auditoria`, `r5b` e `r6a` acompanham os testids.
- `pnpm verify` verde numa rodada (a terceira, depois do layout de referência e de ajustar os E2E acima): 32 (servidor) + 66 (web) + 573 (shared) de unidade e 223 E2E, sem instável. Repetição 3x de `ordem-simples`, `combate`, `fluxos`, `janelas`, `teclado`, `ficha` e `polimento`: 165 execuções verdes.
- Prints (91) em `prints-v2`, no scratchpad da sessão. Vistos: a ordem do mestre vazia, com 6 entradas, editando, botão direito e confirmação do Limpar, a do jogador e o jogador entrando pela ficha (Grimório, Masmorra, Pergaminho, Edgerunner; 1600×900 e 1280×720): sem corte nem sobreposição.

### Decisões

- (assumido) Ver a lista em `docs/REDESIGN.md` ("V2 — como ficou", Decisões).

### Desvios do plano

- O brief pedia um estado novo `combate.aberta`; o `ordemDeTurnoVisivel` (que já fazia exatamente isso, para todos, guardado e exportado) foi reaproveitado.
- O brief dizia "Opções do menu Combate → Ordem de turno abre para todos": já era assim; o que mudou é o × do mestre.

### Frágil / não verificado

- O arrasto da linha usa o arrastar-e-soltar do navegador (HTML5) com o campo do número dentro da linha: no Chrome selecionar o texto do campo com o
  mouse arrasta a linha. Não testado no Firefox nem no Safari, nem em toque.
- A seleção do jogador não tem teste de "vendo como" nem de vários tokens do mesmo personagem além do caso de dois tokens do Aldric.
- Em 270 px o rodapé tem só ícones (dica comum em cada um); o botão de acento é o "Próximo turno". Não visto em toque.
- Aviso "Selecione o seu token no mapa." some em 5 s por um temporizador; a ficha não anuncia por leitor de tela além do `role="status"`.
- Ficou uma chave solta `tabletop:pref:ordem:montar` nos navegadores que a gravaram (inofensiva).

### Roteiro manual (pendente)

1. Como mestre: menu Combate → Ordem de turno. A janela abre para todos. Selecione o token do Aldric e use "Entrar na iniciativa" do botão direito; clique no número e escreva 15 (Enter); escreva a rodada 3 no cabeçalho.
2. Feche pelo ×: a janela some para o jogador também; reabra pelo menu e a lista e a rodada estão iguais.
3. Como jogador: clique no seu token (anel de seleção, sem painel), abra a ficha e clique em Iniciativa: entra na lista com o número que apareceu no chat. Clique de novo: "Já está na ordem de turno.". Esc solta a seleção.
4. Como mestre: Ordenar, Próximo turno (abre a rodada 1), arraste uma linha, Alt+↑/↓ numa linha em foco, botão direito → "Dar a vez" e "Tirar da lista", Limpar (cancele uma vez e confirme).
5. Mande um token do jogador para a camada do mestre: ele some da lista do jogador. O Ogro e o goblin oculto nunca aparecem na lista do jogador.

## Ajustes V3 — Fichas em árvore e handouts, a aba Notas sai, topo e abas iguais (entregue, aguardando o roteiro manual)

Terceiro lote dos ajustes que o Vilella pediu depois de usar a mesa (2026-11-11). Detalhes e decisões em `docs/REDESIGN.md` ("V3 — como ficou").

### O que foi entregue

- Topo do mestre: todos os botões com o mesmo tamanho e o mesmo espaço, rótulos de grupo fora (o grupo vai na dica). Abas do painel com a mesma largura, nome cortado com reticências e dica com o nome inteiro.
- Aba Fichas em árvore (pasta = linha; itens recuados com linha-guia), "+ Novo" único (Personagem, NPC, Handout, Pasta), renomear a pasta clicando no nome (F2), menu de botão direito / Shift+F10 no item, na pasta e no handout (sem "⋯", lápis, cadeado nem lixeira).
- "Importar PDF" dentro da ficha (aba Configurar), sem citar outro programa em texto visível; `BotaoImportarPdf` para o V4.
- Handouts: título, texto, 5 fontes, imagem, quem vê, janela flutuante, "Mostrar agora". A aba Notas saiu; as notas viraram handouts (migração no banco e na importação).
- Protocolo: `handout.criar`, `handout.editar`, `handout.apagar`, `handout.mostrar` (`mesa.configurar`); eventos `handout.alterado`, `handout.apagado`, `handout.mostrado`; saíram `nota.editar`, `notaMestre.editar` e os dois eventos. Estado: `handouts` no lugar de `notaMesa`/`notaMestre`. Exportação **v13**. Migração SQL 9 (esquema final 9).
- Dependências novas (só empacotamento de fonte, nada em execução): `@fontsource-variable/lora`, `@fontsource-variable/caveat`, `@fontsource/medievalsharp`, `@fontsource/special-elite`.

### Como rodar

- `pnpm verify` (uma vez). E2E novos e alterados: `pnpm --filter @tabletop/e2e test --repeat-each=3 tests/topo-e-abas.spec.ts tests/fichas-arvore.spec.ts tests/handouts.spec.ts tests/sala.spec.ts tests/fluxos.spec.ts tests/importarPdf.spec.ts tests/fichas.spec.ts tests/organizacao.spec.ts tests/estrutura.spec.ts tests/interface.spec.ts tests/assets.spec.ts tests/ajustes-v1.spec.ts`.
- Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v3`.

### Verificação

- Unidade: `packages/shared/src/handouts.test.ts` (23 testes: migração das notas, importação de exportação v12 e anteriores, v13 ida e volta, validações, permissões, snapshot e eventos do jogador, "Mostrar agora", imagem); `apps/server/src/armazenamento.test.ts` (bloco "handouts (V3)": banco do V2 com as notas, notas vazias, só a do mestre, gravar/editar/apagar pelos eventos, salvarTudo); `protocolo.test.ts`; os testes de exportação v1 a v12 passaram a esperar v13.
- E2E novos: `topo-e-abas.spec.ts` (3), `fichas-arvore.spec.ts` (8), `handouts.spec.ts` (7).
- E2E antigos alterados (comportamento mudou de propósito): `sala.spec.ts` (as notas viraram handouts: 8 contextos, refresh e rascunho, reinício, promover mestre, frames do jogador, exportar/importar e arquivo inválido; o teste de `nota.editar` virou o mesmo fluxo de permissão com `porta.abrir`); `organizacao.spec.ts` e `estrutura.spec.ts` e `interface.spec.ts` (aba Notas fora, abas iguais em vez de "nome inteiro", "+ Novo" com 4 opções, grupos sem rótulo e dica "Grupo · Nome"); `ajustes-v1.spec.ts` (lista de abas); `fichas.spec.ts` (pasta nova pelo "+ Novo", renomear clicando, visibilidade e apagar pelo menu, arrastar pelo item); `fluxos.spec.ts` e `importarPdf.spec.ts` (o importador abre pela ficha; o teste "pelo botão da aba" saiu; "Ficha nova" pela troca do destino); `assets.spec.ts` e `interface.spec.ts` (versão 13). Saiu o teste "Notas é aba própria". Prints antigos (`auditoria`, `r4`, `r5b`) acertados só no que quebrava.
- `pnpm verify` verde numa rodada: 36 (servidor) + 66 (web) + 598 (shared) de unidade e 239 E2E, sem instável. Não houve mudança de código depois dela.

### Decisões

- (assumido) Ver a lista em `docs/REDESIGN.md` ("V3 — como ficou", Decisões).

### Desvios do plano

- O brief dizia que `nota.editar` "sai do protocolo (ou fica só para ler exportação antiga)": saiu a intenção e o evento; a capacidade ficou no enum (sem uso, fora da tela) porque a lista de permissões guardada nos bancos antigos a traz.
- Criar uma ficha nova pela revisão do PDF (trocando o destino para "Ficha nova") já não abre a ficha na hora (o botão agora é da ficha, que não conhece a lista).

### Frágil / não verificado

- O menu de botão direito abre por Shift+F10 / tecla de menu só testado com as teclas do Playwright; toque não testado.
- Firefox e Safari: as fontes novas, o arrasto de handout (HTML5) e o menu.
- O rascunho do texto do handout vive no localStorage até a sala ter o texto.

### Roteiro manual (pendente)

1. Como mestre: aba Fichas → "+ Novo" → Handout. Escreva um título e um texto, troque entre as 5 fontes, escolha uma imagem. Deixe "Só o mestre" e veja o "Mostrar agora" explicar que ninguém mais o vê.
2. Escolha "Jogador 1" em "Quem vê" e clique em "Mostrar agora": a janela abre na tela do jogador 1 e não na do jogador 2.
3. Botão direito num personagem, numa pasta e num handout; Shift+F10 com o item em foco; clique no nome de uma pasta para renomear (Enter, Esc, F2).
4. "+ Novo" → Personagem: a ficha abre em Configurar; "Importar PDF" abre o seletor e a revisão sem citar outro programa.
5. Confira o topo (botões iguais, dica "Luz · Visão noturna") e as abas em 300 px, no máximo e recolhido.
6. Abra a campanha antiga: as notas aparecem como "Nota da mesa" e "Nota do mestre" na pasta Handouts.

---

## Ajustes V3b — Dicas enxutas (entregue, aguardando o roteiro manual)

Pedido do Vilella ("TUDO está com o tooltip ao passar o mouse, tá um saco"; referência: outras mesas virtuais). Detalhes e decisões em `docs/REDESIGN.md` ("V3b — como ficou"). O tour de introdução **não** entrou (fica para depois do V5).

### O que foi entregue

- Dica só em controle sem nome à vista, de uma linha ("Régua · R" ou "Nome — motivo"), com 700 ms de atraso no mouse, na hora com outra dica aberta e no foco do teclado.
- Opção "Dicas ao passar o mouse" em Preferências (`tabletop:pref:dicas`, só no navegador, nenhum frame); desligada, o clique num botão desabilitado mostra o motivo num balão curto (`aria-live`).
- `title` nativo limpo (some onde o nome está à vista; nos só-ícone virou a dica comum).
- Os textos explicativos que saíram das dicas estão em `apps/web/src/textosDoTour.ts` (para o tour).
- Sem mudança de estado, protocolo, migração nem exportação.

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v3b`.

### Verificação

- Unidade nova: `apps/web/src/dicasLigadas.test.ts` (opção ligada por padrão, sem localStorage; cada id de `textosDoTour.ts` ainda existe no código).
- E2E novo: `e2e/tests/dicas.spec.ts` (7 testes; relógio da página congelado por `ajudasDicas.ts`).
- E2E antigos alterados (comportamento mudou de propósito): `teclado.spec.ts` (dica da janela só no foco; dica do "+N" de uma linha), `organizacao.spec.ts` (dica "Cena · Camadas" sem a segunda linha), `fluxos.spec.ts` (motivo agora é "Nome — motivo"; o item das Fichas não tem mais dica), `topo-e-abas.spec.ts` (dica só na aba cortada, relógio congelado), `ajustes-v1.spec.ts` (dica do relógio é só o nome), `estrutura.spec.ts` e `pausaAutomatica.spec.ts` (o botão de pausa usa `aria-label` em vez de `title`), `tema.spec.ts` (o tema não tem mais `title`), `interacoes.spec.ts` (cor do novo token por rótulo em vez de `title`).
- `--repeat-each=3` não foi rodado (decisão do dono: o `pnpm verify` já reprova teste instável).
- `pnpm verify` verde numa rodada: 36 (servidor) + 70 (web) + 598 (shared) de unidade e 246 E2E, sem instável. Rodadas anteriores acharam duas instabilidades, corrigidas na causa: o foco logo após o clique (agora só conta o clique no mesmo elemento) e, em `combate.spec.ts`, o teste de condições clicava em sequência sem esperar a sala confirmar (agora espera `aria-checked`). Não houve mudança de código depois do último verify.

### Decisões

- (assumido) Ver `REDESIGN`, "V3b — como ficou", Decisões.

### Desvios do plano

- A dica de condições e da alça da tocha no mapa não obedece à opção de desligar (é conteúdo do mapa).

### Frágil / não verificado

- Toque (celular): sem hover não há dica; o balão do motivo depende do clique. Só Chrome.
- O foco "de clique" é detectado por `pointerdown` no mesmo elemento em até 100 ms; foco programático logo depois de um clique no mesmo elemento não mostra a dica.
- Ficam com `title` nativo (não são botões): avatares da presença, siglas dos atributos, ícones "quem vê" e de cena, progresso do preparo.

### Roteiro manual (pendente)

1. Passe o mouse num ícone da barra esquerda e no do topo: a dica vem depois de um instante, numa linha, com o atalho. Passe ao botão vizinho: a próxima vem na hora.
2. Passe o mouse numa aba com o nome inteiro, num botão com texto e num item das Fichas: nenhuma dica.
3. Painel no mínimo (300 px): a aba com nome cortado mostra a dica com o nome.
4. Ordem de turno vazia: "Ordenar pela iniciativa" mostra "— A lista está vazia".
5. Preferências → desligue "Dicas ao passar o mouse": nenhuma dica no mouse nem no Tab; clique no "Ordenar" desabilitado mostra o motivo por uns 3 s. Recarregue: continua desligado.

---

## Ajustes V4a — A ficha no desenho aprovado (entregue, aguardando o roteiro manual)

Refeito depois de o Vilella recusar o papel branco do primeiro V4a. Detalhes e decisões em `docs/REDESIGN.md` ("V4a — como ficou"); os protótipos aprovados estão em `docs/desenho/`. NPC, arrastar do compêndio, reordenar e acender tocha no equipamento ficam para o V4b.

### O que foi entregue

- Janela da ficha de ~880 px, na camada mais alta, que minimiza para só o nome; cabeçalho com capitular, campos de identidade, fitas e faixa Vantagem / Normal / Desvantagem.
- Abas Personagem (3 colunas), Magias, História e Configurar; editor da engrenagem com prévia ao vivo; layout estreito em acordeão (pela largura da janela); peles Livro e Clássica.
- Rolagem no chat em bloco baixo, com os dois d20 na vantagem, crítico verde e 1 natural vermelho fixos.
- Dados: campos de rolagem opcionais em ataque e magia, peso do item, origem da característica; `chat.caracteristica` com `origem`.

- V4a2: identidade rola com o corpo na janela larga; rolagem livre no bloco novo do chat; **dado de vida pela sala** (`ficha.dadoDeVida`, soma a cura ao PV com teto, bloco no chat; `dadoDeVida.test.ts`); **luz na linha do equipamento** (Acender/Apagar, sublinhas "em uso", "apagada", "guardada"; sem Condições nem "Objetos de luz" no painel de baixo, ficam só os Recursos). Testes: `ficha-livro.spec.ts`, `tochas.spec.ts`, `ficha.spec.ts`, `combate.spec.ts` ajustados.

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v4a`.

### Verificação

- Unidade nova: `packages/shared/src/ataques.test.ts` (dano, CD, prévia, margem de crítico e dano extra na rolagem, moedas, carga, dano no temporário); `fichaCampos.test.ts` (o do primeiro V4a, renomeado); `temas.test.ts` (tokens do crítico iguais nos 14 temas, contraste AA).
- E2E novo: `e2e/tests/ficha-livro.spec.ts` (editor e prévia, conjurar, moedas e equipamento, característica no chat, minimizar, aparência Clássica persistida, janela estreita, crítico verde, importar PDF, só leitura). O `ficha-pdf.spec.ts` do primeiro V4a nunca tinha rodado e foi apagado.
- E2E antigos alterados (comportamento mudou de propósito): `ficha.spec.ts` (o nome do ataque rola acerto e dano, o botão Acerto só o d20; a vantagem fica até trocar; dois d20 visíveis; bolinhas de dado de vida e de espaço cheias = disponíveis; remover ataque pela engrenagem; classe no cabeçalho), `janelas.spec.ts` (a ficha fica acima da ordem de turno; abre com ~880 px; arrasto e cascata curtos pela largura), `chat.spec.ts` ("Ataque · Nome" e chips dos d20), `compendio.spec.ts` (o nome da magia é botão que expande), `polimento.spec.ts` (a 520 px a ficha é a estreita e os campos de identidade ficam na seção Identidade; a ficha larga pode cobrir a ordem e o painel do token, então saíram "ordem × ficha" e "ficha × token" e a ficha fecha antes do botão do token), `importarPdf.spec.ts` e `fluxos.spec.ts` (o nome do ataque é botão; o resumo da classe é o texto de leitor de tela `janela-ficha-resumo`), `prints/auditoria.spec.ts` (abas). `fichas-arvore.spec.ts` e `ordem-simples.spec.ts` passam sem mudança de código nelas (a Aparência ficou por último na Configurar; o aviso da ordem manteve o testid).
- `--repeat-each=3` não foi rodado (decisão do dono).

### Decisões

- (assumido) Ver `REDESIGN`, "V4a — como ficou", Decisões.

### Desvios do plano

- Reordenar por arrasto e Alt+↑/↓ não entraram (V4b, como o brief mandou); a dica do protótipo sobre isso foi omitida.

### Frágil / não verificado

- `ficha.css` repete o prefixo `.fl-raiz` em tudo para ganhar do `button` global do `styles.css`; mexer na ordem dos blocos de "ajustes por contexto" (fim do arquivo) dá aviso de especificidade no Biome e erro de aparência.
- O botão e o input dentro da ficha só perdem o estilo global se a classe começa com `fl-` (`button[class*="fl-"]`).
- Firefox e Safari não conferidos (`color-mix`, `clip-path`).

### Roteiro manual (pendente)

1. Abra uma ficha: ~880 px, nome com capitular, fitas à direita. Arraste pelo cabeçalho: ela passa por cima do chat, do painel e da ordem de turno. Duplo clique no cabeçalho: sobra só o nome.
2. Troque Vantagem / Normal / Desvantagem e clique numa perícia: o chat mostra os dois d20, o descartado esmaecido.
3. Clique no nome de um ataque (acerto e dano juntos), em Acerto e em Dano; abra a engrenagem, mude o bônus mágico e veja a prévia; "Novo ataque".
4. Magias: conjure uma magia de 1º nível (o espaço some), "Recuperar espaços", marque "Mostrar em Ataques e magias".
5. Configurar → Aparência: Clássica; recarregue e confira que ficou.
6. Estreite a janela pela quina até ~500 px: cabeçalho grudado e acordeão.
7. Moedas, quantidade e peso do equipamento; característica "Mandar ao chat".
8. Force um 20 natural (o mestre pode usar um dado de teste) e confira o verde do crítico; confira em 2 ou 3 temas.

---

## Ajustes V4a3 — Magias com espaços por círculo e os bugs da ficha (entregue, aguardando o roteiro manual)

Detalhes e decisões em `docs/REDESIGN.md` ("V4a3 — como ficou"). Corrige os dois bugs de `docs/BUGS.md` (Dados de Vida que estouram a caixa e o modificador extra no hover) e deixa a aba Magias útil para um personagem sem classe, como o Rendan.

### O que foi entregue

- Cada círculo de 1 a 9 tem "Espaços totais [n]" editável à vista e "Restantes n"; o total manual vale também sem classe; "auto" ou campo vazio volta à conta das classes; "+ Círculo" abre um círculo vazio.
- Rótulo "Prep." sobre os checkboxes de preparada.
- Sem classe: seletor de atributo de conjuração (campo novo `habilidadeDeConjuracao`), com CD e ataque; aviso "Sem classe: escolha o atributo de conjuração".
- **Bug corrigido: Dados de Vida estouram a caixa** (quebram de linha até 12 por tipo; acima disso, contador "7/20" com − e +).
- **Bug corrigido: modificador extra no hover** (agora botão direito ou Shift+F10 / tecla Menu, popover "Modificador:", ponto discreto na linha com bônus).
- `docs/BUGS.md`: os dois itens saíram; entrou o do importador do PDF do Rendan.

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v4a3`.

### Verificação

- Unidade (`packages/shared/src/ficha.test.ts`): total manual sem classe; automático sobrescrito e de volta; atributo sem classe dá CD e ataque (e não vale com classe). O schema ganhou só um campo opcional: não há migração.
- E2E novo: `e2e/tests/ficha-magias-v4a3.spec.ts` (sem classe: total 4, conjurar, Recuperar, Prep., atributo e "+ Círculo"; auto; dados de vida sem estouro do nível 6 ao 20 e multiclasse; modificador por botão direito, Shift+F10 e tecla Menu, sem caixa no hover).
- E2E antigos alterados: `ficha-livro.spec.ts`, `ficha.spec.ts` e `importarPdf.spec.ts` (`espacos-resumo-N` "3/4" virou `espacos-restantes-N` "3": o resumo foi trocado por "Restantes n"). Nenhum teste dependia do `fl-bonus-extra` por hover.

### Decisões

- (assumido) Ver `REDESIGN`, "V4a3 — como ficou", Decisões.

### Desvios do plano

- As bolinhas dos espaços ficam numa linha abaixo do cabeçalho do círculo, não no mesmo, por falta de largura (~326 px).

### Frágil / não verificado

- O popover do modificador sai por portal no body; em janela do navegador muito pequena ele é preso às margens.
- O botão direito só abre o popover para quem edita a ficha.
- Só Chrome.

### Roteiro manual (pendente)

1. Abra o Rendan (ou um personagem sem classe) → Magias: escreva 4 em "Espaços totais" do 1º círculo, conjure uma magia (Restantes 3) e use "Recuperar espaços".
2. Escolha o atributo na primeira caixa: CD e ataque aparecem; clique no ataque e veja a rolagem.
3. "+ Círculo": o 2º círculo aparece; escreva o total. Em quem tem classe, mude o total e volte com "auto".
4. Confira o rótulo "Prep." sobre os checkboxes.
5. Um Bárbaro de nível 10 e um multiclasse: as bolinhas dos Dados de Vida ficam dentro da caixa; no nível 15 vira "15/15" com − e +.
6. Perícias e salvaguardas: passe o mouse (nada aparece); botão direito abre "Modificador:"; Esc fecha; na linha focada, Shift+F10 abre; o total muda e a linha ganha um ponto.

---

## Ajustes V4b — Ficha de NPC, arrastar do compêndio e segurar para reordenar (entregue, aguardando o roteiro manual)

Detalhes e decisões em `docs/REDESIGN.md` ("V4b — como ficou"). O brief antigo `brief-v4b.md` ficou velho; valeu o `brief-v4b-novo.md`. O Vilella deixou o lote sem ninguém para perguntar: tudo que o brief não dizia foi assumido (marcado).

### O que foi entregue

- **Bloco de monstro** no desenho N para todo NPC (pasta NPCs, nenhum jogador editor, ou "Ficha de: NPC" em Configurar): estandarte, CA, PV com fórmula, deslocamento, atributos em escudo, linhas de resistências, sentidos, idiomas e Desafio com XP, Traços, Ações, Reações e Lendárias. Ações em linha fechadinha (título expande e "Mandar ao chat"; Acerto e Dano em colunas; chips; usos por dia e Recarga em bolinhas; engrenagem com o `EditorDeAtaque` na própria linha). O Ogro da semente está completo (SRD 5.1).
- **Compêndio com armas e itens** (campos opcionais do mesmo arquivo; o exemplo do SRD ganhou 9 armas e 5 itens) e **arrastar** magia, arma e item para a ficha aberta, no personagem e no NPC; as áreas que aceitam acendem; soltar no lugar exato de uma lista põe o item ali. "Adicionar à ficha" usa a mesma conversão (`aplicarEntradaNaFicha`).
- **Segurar ~300 ms e arrastar para reordenar**, com linha indicadora e Esc, mais **Alt+↑/↓** (registrado em `atalhos.ts`, aparece nas Preferências), em Ataques e magias, Características, Equipamento (as sublinhas de luz acompanham), magias de cada círculo e, no NPC, Traços, Ações, Reações e Lendárias.

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v4b`.

### Verificação

- Unidade (`packages/shared/src/v4b.test.ts`, 17 testes): ND, proficiência e XP; a regra de NPC; ficha antiga de NPC carregando, exportar e importar; reordenar e inserir em grupo (ações, reações, círculos); arma com acuidade, à distância e pelo ND no NPC; magia de ataque e de salvaguarda; item de luz pelo nome; Conjuração do NPC por nível; arrasto inválido; compêndio antigo e novo.
- E2E novos: `e2e/tests/ficha-npc.spec.ts` (3 testes: o NPC abre no bloco e o PJ não; "Ficha de" troca; atacar, só o dano, expandir e mandar ao chat; recarga, usos, editor na linha, Reações e Lendárias só quando existem, minimizar) e `e2e/tests/ficha-arrastar.spec.ts` (4 testes: arrastar arma, item e magia para o personagem com as áreas acesas; arma, magia e item para o NPC; o jogador não solta numa ficha que não edita; reordenar segurando, com Esc e com Alt+↑/↓, no NPC e no personagem).
- O arrasto dos E2E é o de verdade (`mouse.down`, `move`, `up`): o HTML5 drag and drop funciona no Chrome do Playwright, sem `dispatchEvent`.
- E2E antigos alterados: `fichas.spec.ts` (o ajudante que abre a Configurar de um item: o NPC não tem abas, então ele usa a engrenagem do cabeçalho; o comportamento mudou de propósito), `interface.spec.ts` (idem: o Ogro abre a Configurar pela engrenagem) e nenhum outro. `compendio.spec.ts` e os demais passaram sem mudança (o importar do PDF e do arquivo de ficha agora mantêm a apresentação do item, por isso `fluxos.spec.ts` e `importarPdf.spec.ts` seguem como estavam).
- {VERIFY}

### Decisões

- (assumido) Ver `REDESIGN`, "V4b — como ficou", Decisões.

### Desvios do plano

- O brief citava "o NPC do exemplo SRD (`exemploSrd.ts`)": esse arquivo é um compêndio, não tem NPC. O bloco preenchido é o Ogro da semente.
- Monstros no compêndio não existem e ficaram de fora ("se existir").

### Frágil / não verificado

- Toque (celular): o segurar não foi testado com o dedo; o navegador pode tomar o gesto para rolar.
- Só Chrome.
- Ver `docs/PASSAGEM.md` ("V4b") para o `dragleave` do Chrome e a pré-visualização do vão.

### Roteiro manual (pendente)

1. Abra o Ogro (Fichas, NPCs): bloco de monstro. Clique em Acerto (+6) e Dano; abra a engrenagem da Clava Grande, ponha "Recarga 5–6" e 3 usos; use a caixa e o dado da recarga.
2. "+ Reação" e "+ Lendária" criam as seções; minimize a janela e arraste-a por cima do chat.
3. Compêndio → Armas: arraste a Espada longa para as Ações do Ogro (+6, 1d8+4) e para Ataques e magias de um personagem (acerto e dano pelo atributo); arraste uma magia para o círculo dela e uma poção para o Equipamento; veja as áreas acenderem.
4. Segure uma ação por meio segundo, arraste para outra posição e solte; repita com Esc; use Alt+↑/↓ em uma ação, em um item e em um ataque.
5. Configurar → "Ficha de": Personagem no Ogro e NPC num personagem do grupo.

---

## Ajustes V4b2 — Seção Conjuração no NPC e o nome com a capitular (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V4b2 — como ficou"). O Vilella deixou o lote sem ninguém para perguntar: o que o brief não dizia foi assumido (marcado).

### O que foi entregue

- **Seção Conjuração** no bloco de NPC, entre Traços e Ações: atributo, CD e ataque de magia pelo ND, uma linha por círculo com bolinhas de espaço, total do círculo (quem edita) e as magias em chips que expandem o texto com Conjurar, chat e engrenagem. Mesmos dados da ficha de personagem (sem campo novo).
- **Arrastar do compêndio** para o NPC agora põe a magia em `magias` (círculo dela, calculada); o traço "Conjuração" e `colocarMagiaNaConjuracao` saíram. **Reordenar** as magias de um círculo (segurar ou Alt+↑/↓).
- **Nome com a capitular** igual no personagem (Livro) e no monstro: a letra é só desenho, o campo mostra o nome inteiro ao editar e a letra pula ao gravar.

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v4b2`.

### Verificação

- Unidade (`packages/shared/src/v4b.test.ts`): a magia solta no NPC vai para `magias` com o atributo escolhido e a CD e o ataque saem do ND; trocar a apresentação mantém magias e espaços; item vira traço.
- E2E novos (`e2e/tests/ficha-v4b2.spec.ts`, 5 testes): a seção com CD, ataque, bolinhas, conjurar de salvaguarda e de ataque (espaço gasto, chat); sem magias a seção não existe e o "+ Conjuração" a cria (círculo, total, magia, trocar a apresentação e voltar); Alt+↓ reordena; o nome do personagem (capitular, nome inteiro em edição, Enter, Esc, vazio, clique na capitular, pele Clássica) e o nome do monstro.
- E2E antigos alterados: `ficha-arrastar.spec.ts` (a magia solta no NPC cai na seção Conjuração, que surge durante o arrasto; o índice do traço da poção passou de 1 para 0; o ajudante `arrastar` ganhou o parâmetro `surge`) e `ficha-npc.spec.ts` (o campo do nome mostra "gro", o resto do nome, fora de edição). Nenhum outro usava a inicial à parte.
- `pnpm verify` verde: typecheck e lint sem avisos; unidade (shared 657, servidor 36, web 71); E2E 275 passaram, sem retentativas. Nenhuma mudança de código depois do verify.

### Decisões

- (assumido) Ver `REDESIGN`, "V4b2 — como ficou", Decisões.

### Desvios do plano

- O exemplo de 4 magias do SRD ficou só nos prints (o dragão); o compêndio de exemplo continua com 3 magias, para não mexer nos E2E do compêndio.

### Frágil / não verificado

- Reordenar os chips segurando e arrastando (com o ponteiro) não tem E2E; só o Alt+↑/↓ tem. O vão do ponteiro nos chips usa a ordem de leitura (`fluxo` em `ordem.tsx`).
- O foco do nome troca o valor do campo na hora (no manipulador de foco, direto no DOM) para o preenchimento por código não anexar ao fim; ver `NomeComCapitular.tsx`.

### Roteiro manual (pendente)

1. Abra um NPC sem magias (o Ogro): "+ Conjuração" cria a seção; ponha o total de espaços de um círculo, escreva uma magia e conjure (o espaço gasta; sem espaço avisa).
2. Compêndio → Magias: arraste a Bola de Fogo para o NPC (cai no 3º nível, com CD); Alt+↑/↓ num chip muda a ordem.
3. Configurar → "Ficha de: Personagem" e de volta: as magias e os espaços continuam.
4. Digite o nome completo ("Vashta Carteiro") no personagem e no NPC, Enter: a primeira letra pula para a capitular; clique na capitular, Esc desfaz.

---

## Ajustes V5 — Paredes e portas: quem vê, Visão do mestre, meia célula e arcos (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V5 — como ficou"). O Vilella deixou o lote sem ninguém para perguntar: o que o brief não dizia foi assumido (marcado).

### O que foi entregue

- **Contornos só para o mestre por padrão**: o jogador não vê linhas de parede, janela e porta nem os ícones das portas; opção por cena "Mostrar paredes e portas aos jogadores" no Configurar cena (campo novo `Cena.mostrarParedesAosJogadores`). A porta continua abrindo pelo clique e se destaca ao passar o mouse.
- **"Visão do mestre"** (antes "Visão noturna"): ligada = visão noturna e contornos; desligada = mapa claro, sem contornos. Com a ferramenta Paredes os contornos aparecem sempre.
- **Encaixe em meia célula** (9 pontos por quadrado, diagonal, menor passo meia célula; Alt solta) e o ponto de fixação à vista.
- **Arcos**: tecla A alterna linha e arco tangente; sem trecho anterior faz o arco de 3 pontos. `Parede.meio?`, `segmentosDaParede` na visão, na luz e na passagem. Clique direito também encerra a sequência.

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v5`.

### Verificação

- Unidade (`packages/shared/src/paredesV5.test.ts`, 25 testes): rede de meia célula (os 9 pontos, diagonal, menor passo), arco para segmentos (3 pontos, pequeno, grande, tangente, fim sobre a tangente), visão, luz e passagem bloqueadas pelo arco (e porta em arco aberta/fechada), migração da parede (sem `meio`) e da cena (sem o campo), criar, editar e endireitar o arco, o jogador sem a secreta nos frames (também em arco), exportar e importar (com e sem os campos novos).
- E2E novos (`e2e/tests/paredes-v5.spec.ts`, 7 testes): o jogador sem contornos por padrão e com a opção da cena (e sem a secreta nos frames); o jogador abre a porta escondida pelo clique e vê o destaque e a mão no hover; a Visão do mestre liga e desliga os contornos (e a ferramenta Paredes mostra); meia célula e diagonal, menor passo e Alt; linha, A, arco tangente, A, linha; arco de 3 pontos, selecionar, mudar o tipo e apagar com Delete; o token não atravessa o arco.
- E2E antigos alterados: `organizacao.spec.ts` e `topo-e-abas.spec.ts` (nome "Visão do mestre" e a dica "Luz · Visão do mestre") e o título de um teste de `paredes.spec.ts`. Nenhuma asserção foi afrouxada.
- Ver o fim desta seção para os números do `pnpm verify`.

### Decisões

- (assumido) Ver `REDESIGN`, "V5 — como ficou", Decisões.

### Estado, protocolo e migração

- Campos opcionais novos: `Parede.meio` e `Cena.mostrarParedesAosJogadores`. Parede e cena antigas carregam sem mudança (sem `meio` = reta; sem o campo = desligado). **Não há migração de banco nem de arquivo**: as paredes e as cenas são gravadas como JSON, o arquivo de exportação continua v13 e abre com e sem os campos (teste de unidade).
- `parede.criar` e `parede.editar` ganharam `meio`; `cena.editar` ganhou `mostrarParedesAosJogadores` (todas com a capacidade `cena.editar` de antes). `docs/protocolo.md` e `PROJETO.md` (4.1, 4.2, 4.7, 4.12) atualizados.

### Desvios do plano

- Nenhum desvio. A seção de atalhos ganhou a tecla A; a dica da ferramenta fica no texto do tour e no painel (o botão da barra não mostra o "A", porque a tecla só vale dentro da ferramenta).

### Frágil / não verificado

- O ponteiro sobre o ícone da porta destaca a porta em todo movimento do mouse (`portaEm` roda a cada `pointermove`); com milhares de portas pode pesar (não medido).
- O ponto do arco acompanha o meio da corda ao mover uma ponta: arcos com pontas movidas para longe podem ficar achatados; endireitar (`meio: null`) ou refazer resolve.
- O clique direito na ferramenta Paredes só encerra com uma sequência em andamento; sem ela, o clique direito na porta ainda tranca (como antes).
- A ferramenta de paredes usa a tecla A mesmo com o foco num botão (só não age em campos de texto).

### Roteiro manual (pendente)

1. Entre como jogador e como mestre. Ao jogador, as paredes e portas não aparecem; passe o mouse na porta ao lado do seu token (ela se destaca, o cursor vira mão) e clique: abre.
2. No mestre, Configurar cena: ligue "Mostrar paredes e portas aos jogadores"; o jogador passa a ver as linhas. Desligue a Visão do mestre (lua): os contornos somem na sua tela.
3. Paredes e portas: desenhe uma linha, aperte A, desenhe um arco (sai tangente), aperte A, uma linha; Esc. Depois A no começo: início, fim e o ponto da curva. Veja os pontos de meia célula e use Alt para soltar.
4. Selecione um arco, mude para Porta e apague com Delete. Mande o token de um jogador por cima: ele não atravessa.

---

## Ajustes B1 — Importador do Rendan e detalhes das revisões (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("B1 — como ficou"). O Vilella deixou o lote sem ninguém para perguntar: o que o brief não dizia foi assumido (marcado). Corrige o bug "Importador do PDF: o Rendan" do `docs/BUGS.md` (apagado de lá).

### O que foi entregue

- **Importador do PDF (Rendan):** o PDF da ficha corta o campo "Classe & nível" com "…" ("Domínio da Sepultura Cl…"), então o nível se perde. Agora a classe sai do começo da palavra (Clérigo), o que vem antes é a subclasse ("Domínio da Sepultura") e o nível vem do total de dados de vida do PDF (10), ou do bônus de proficiência se faltar; o campo entra marcado "para conferir". O antecedente é lido só da coluna dele ("Acolyte", que vira "Acólito"); o domínio não vaza mais para lá. Raça e tendência passam por tabelas em português: "Standard Human" vira "Humano", "LB" vira "Leal e Bom".
- **Também corrigido no mesmo PDF:** idiomas separados das proficiências ("IDIOMA: Common ARMADURA: ..." virava lista de idiomas) e os rótulos "ALINHAMENTO"/"PONTOS DE EXPERIÊNCIA" que vazavam no texto de Traços de personalidade. Com o nível certo, a CD, o ataque de magia e os espaços de magia do PDF passaram a fechar com a ficha.
- **Compêndio, "Ficha de":** segue a ficha aberta em foco que a pessoa edita; a escolha à mão vale até focar outra ficha.
- **Aviso "entrou como ataque":** agora é o toast padrão da mesa (`AvisoPerto`, `role="status"`, some sozinho); o parágrafo `ficha-aviso` dentro da ficha deixou de existir ("Descanso feito" e "Sem espaços de Nº nível" também vão ao toast).
- **Conjuração do NPC:** o cabeçalho do círculo (nome, bolinhas, total) fica numa linha e os chips das magias vêm abaixo, na largura toda, com "Nova magia" no fim; truques iguais.

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints b1`.

### Verificação

- Unidade (`packages/shared/src/importarFichaPdf.test.ts`): o Rendan pela fixture (classe, nível, subclasse, antecedente, raça, tendência, o nível fechando com proficiência, CD, ataque e espaços; `fixtures/fichas/brendan.json` com o esperado), idiomas, personalidade e as tabelas de raça, tendência, antecedente e idioma; o Darion e o resto seguem iguais.
- E2E novos: Rendan importado pela ficha (`importarPdf.spec.ts`); "Ficha de" seguindo a ficha em foco e o aviso como toast (`ficha-arrastar.spec.ts`).
- E2E antigos alterados: `ficha-v4b2.spec.ts` (o aviso "Sem espaços de 3º nível" agora é o toast `aviso`, não `ficha-aviso`). O teste sintético de `importarFichaPdf.test.ts` ("lê os rótulos em inglês") passou a esperar "Humano" e "Leal e Bom" em vez de "Human" e "Lawful Good" (a tradução é o comportamento novo).
- Ver o fim desta seção para os números do `pnpm verify`.

### Decisões

- (assumido) Ver `REDESIGN`, "B1 — como ficou", Decisões.

### Desvios do plano

- Nenhum.

### Frágil / não verificado

- O nível do Rendan não está escrito no PDF (o campo vem cortado): vem do número solto sob os PV temporários (total de dados de vida) e só vale para uma classe só. Num PDF multiclasse com o campo cortado, só a primeira classe é achada.
- As moedas do Rendan entram como 50 PE (o número cai entre SP e EP no PDF; a regra é "número à esquerda do rótulo"): confira.
- Do Rendan ainda sai errado ou incompleto: nomes de itens, magias e ataques em inglês; tipos de dano cortados ("Bludge…", "Radiant/N…", "Fire + 4d6…") entram como vieram, marcados; "preparada" não existe no PDF (as 81 magias entram preparadas); 2 magias (Spirit Guardians, Stone Shape) ficam sem descrição e 4 descrições soltas não são importadas; a caixa Channel Divinity entra como recurso a conferir; PV atuais e temporários vazios no PDF.

### Roteiro manual (pendente)

1. Fichas → abra uma ficha → Configurar → Importar PDF → escolha o PDF do Rendan → confirme. O topo mostra Clérigo 10, Domínio da Sepultura, Acólito, Humano, Leal e Bom; confira o nível no aviso amarelo.
2. Abra duas fichas; no Compêndio (Armas ou Itens) o "Ficha de" é a que está por cima. Escolha outra à mão: ela vale até focar outra ficha.
3. Solte uma arma na ficha: o aviso aparece como toast no alto do mapa e some sozinho.
4. Abra o Dragão (NPC) e veja a Conjuração: o círculo, as bolinhas e o total numa linha, os chips embaixo.

---

## Mesas C1 — várias mesas, ids amigáveis e a tela inicial (entregue, aguardando o roteiro manual)

### O que foi entregue

- Várias mesas no mesmo servidor, cada uma com id amigável (`k7m2-qx9p-4tdn`), e a tela inicial em `/` (entrar por id ou link, criar mesa, "Mesas neste computador"). A mesa é `/m/<id>`.
- A campanha de hoje é a **mesa legada**: continua no Durable Object `"campanha"`, sem copiar, mover ou reescrever nada.
- Uma mesa nova nasce vazia (cena em branco, o mestre e as vagas "Jogador 1" a "Jogador 4").
- Dentro da mesa: nome e id (com copiar) no alto da aba Mesa, o mestre renomeia; "Trocar de mesa" em Preferências; título da aba com o nome; pasta de imagens por mesa (a legada herda a de antes).
- Cookie de sessão por mesa; WebSocket em `/api/m/<id>/ws`. Detalhes: PROJETO 4.14, `protocolo.md`, REDESIGN "C1".

### Como rodar

- **Reinicie o `pnpm dev`** (a migração `v2` do DO, o binding novo e a variável `LISTAR_MESAS` só entram num `wrangler dev` novo). A campanha continua no mesmo lugar. O id da campanha aparece na tela inicial, em "Mesas neste computador" (cartão "Campanha").
- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints c1`.

### Verificação

- Unidade: `packages/shared/src/mesas.test.ts` (ids, nome, mesa nova vazia), `apps/server/src/mesas.test.ts` (diretório idempotente, legada uma vez só, limite por IP, DO não criado não se auto-semeia, mesa nova vazia, estado antigo da campanha carrega sem mudar nada), `autenticacao.test.ts` (cookie por mesa), `apps/web/src/rotas.test.ts` e `mesasLocais.test.ts`.
- E2E novos: `e2e/tests/mesas.spec.ts` (tela inicial, criar e copiar, id digitado e link colado, id inexistente, duas mesas isoladas, lista local, renomear, validação da API).
- E2E antigos alterados: o `goto("/")` e o `entrar-<id>` do helper central (`ajudas.ts`) passam a abrir `/m/t3st-m3sa-e2e7` (`CAMINHO_DA_MESA`); os WebSockets crus (`/ws`) de `ajudasFicha.ts`, `assets`, `chat`, `compendio`, `desenho` e `tochas` e o `/ws` de `sala.spec.ts` passam a `/api/m/<id>/ws`; `sala.spec.ts`, `tema.spec.ts` abrem a mesa pelo caminho novo; `tema.spec.ts` espera o título "Távola · Campanha" na escolha de usuário (o título agora leva o nome da mesa).

### Decisões

- (assumido) Ver REDESIGN, "C1 — como ficou", Decisões.

### Desvios do plano

- Nenhum.

### Frágil / não verificado

- O `ctx.id.name` do Durable Object decide quem é a legada: se um dia uma versão do workerd não o preenchesse, a mesa legada **ainda carregaria** (o estado existe), só uma legada nova e vazia não seria semeada.
- A lista de mesas do servidor só existe com `LISTAR_MESAS=1`; fora dele (internet) a tela usa a lista deste navegador.
- O limite de mesas por IP (5 por hora) só tem teste de unidade; os E2E não o exercitam.
- O nome novo da mesa só chega a quem já está dentro quando recarrega.

### Roteiro manual (pendente)

1. Reinicie o `pnpm dev`, abra `http://127.0.0.1:5173`: a tela inicial mostra o cartão "Campanha" com o id dela; abra-o, escolha o Mestre e confira que a campanha está como estava (cenas, tokens, fichas, chat).
2. Aba Mesa → "Esta mesa": copie o id e o link; o link, colado em outra aba, abre a mesa.
3. Crie uma mesa ("Criar mesa"): o id grande aparece; "Abrir a mesa", escolha o Mestre: a mesa vem vazia. Volte por "Trocar de mesa".
4. Entre como Mestre numa mesa e abra outra: ela pede o usuário de novo (o cookie é por mesa).
5. Cole o id em maiúsculas, com espaços, e o link inteiro em "Entrar numa mesa".
6. Pasta de imagens: na campanha ela continua escolhida; numa mesa nova pede a pasta.

---

## Contas C2 — contas por mesa, pedidos de entrada, sessões e redefinição (entregue, aguardando o roteiro manual)

### O que foi entregue

- Contas por mesa com login e senha. A senha é esticada no navegador (PBKDF2-SHA256, 600.000 iterações) e **nunca sai dele**; a sala guarda só `SHA-256(sal || derivada)` com sal aleatório, comparado em tempo constante.
- Sessões por cookie `tavola_sessao` (token aleatório, só o hash no banco), limite de tentativas por conta e por IP, pedidos de entrada aprovados pelo mestre, redefinição de senha aprovada pelo mestre, trocar a senha em Preferências.
- Criar mesa pede a conta do mestre. A mesa legada (a campanha de hoje) oferece "Criar a conta do mestre desta mesa" (só de requisição local).
- A escolha de usuário de desenvolvimento só existe com `MODO=teste`.
- Pendências do C1: memória do mapa por mesa (a legada herda a chave antiga), renomear a mesa ao vivo, lista de mesas em ordem de último uso.
- Detalhes: PROJETO 4.14 ("C2: como ficou"), `docs/protocolo.md`, REDESIGN "C2 — como ficou".

### Como rodar

- **O `pnpm dev` do Vilella recarrega sozinho com o código novo** e não precisa de reinício: as variáveis e o proxy dele não mudaram. As tabelas novas (migração 10) entram sozinhas, vazias, na campanha real; nada existente é tocado.
- Primeiro acesso à campanha de hoje: ver o roteiro manual abaixo (a mesa fica sem conta até ele criar a do mestre).
- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints c2`.

### Verificação

- Unidade: `packages/shared/src/contas.test.ts` (vetor fixo da derivação, validações, degraus do bloqueio, IP, sessão), `apps/server/src/contas.test.ts` (hash e comparação, estados da conta, limites, sessão que expira e renova, redefinição, migração sobre estado antigo, varredura de frames), `autenticacao.test.ts`, `mesas.test.ts` (id escolhido pelo navegador), `apps/web/src/mapa/memoriaLocal.test.ts` e `mesasLocais.test.ts`.
- E2E novos: `e2e/tests/contas.spec.ts` (10 cenários: criar mesa com conta, legada pede a conta do mestre, pedido e aceite numa vaga com ficha, recusar, bloqueio por senha errada, esqueci e redefinir, remover derruba o socket, cookie de uma mesa em outra, nenhum segredo em frame, trocar a senha e renomear ao vivo).
- E2E antigo alterado: `mesas.spec.ts` ("criar uma mesa mostra o id grande..."): a criação agora pede login, nome e senha, entra direto na mesa pela sessão da conta e só então confere a escolha de usuário de teste num navegador sem sessão. Os outros continuam pelo caminho de teste (`MODO=teste`, `entrar-<id>`) sem mudança.

### Decisões

- (assumido) Ver REDESIGN, "C2 — como ficou", Decisões.

### Desvios do plano

- O id da mesa nova é sorteado pelo **navegador** (e não pelo servidor, como no C1): o id entra no sal da senha e o navegador precisa conhecê-lo antes de derivar. O diretório recusa id repetido.

### Frágil / não verificado

- Nada disto rodou num servidor de verdade (Cloudflare): `CF-Connecting-IP`, `Secure` por https e o limite por IP só foram exercitados no `wrangler dev`, com cabeçalhos forjados nos E2E.
- Na internet só vale o que o Worker vê: `request.url` com host de produção e `CF-Connecting-IP`. A regra de "requisição local" depende disso.
- O mestre que esquece a senha ainda não tem saída (C3): hoje só apagando a conta pelo banco.
- Não há CSRF extra além de `SameSite=Lax` e do corpo JSON obrigatório (uma requisição entre sites com JSON precisa de preflight, que o servidor não responde).
- O servidor não consegue conferir o tamanho da senha (só vê a derivada): quem chamar a API à mão pode cadastrar a derivada de qualquer senha.
- O bloqueio de conta diz "Tente de novo em N minutos" a partir da 5ª falha, o que revela que o login existe. (assumido: o Vilella pediu que a espera seja dita.)

### Roteiro manual (pendente)

1. Abra a campanha de hoje (`http://127.0.0.1:5173`, cartão "Campanha"): a tela de entrada mostra "Criar a conta do mestre desta mesa". Crie (login, nome, senha); você entra como mestre com tudo como estava.
2. Passe o link da mesa (aba Mesa, "Copiar link") a cada jogador. Cada um abre, escolhe "Pedir para entrar" (nome, login, senha).
3. No topo aparece "N pedidos de entrada": clique, e na seção Contas escolha a vaga que já tem a ficha dele (Jogador 1 a 7) e Aceitar. A vaga passa a se chamar como ele.
4. O jogador volta, "Entrar" com login e senha e vê a ficha dele.
5. Teste "Esqueci a senha" com um jogador, "Aprovar redefinição" e "Definir nova senha".

---

## Mesas C3 — pasta do mestre com chave e código de recuperação (entregue, aguardando o roteiro manual)

### O que foi entregue

- Chave ECDSA na pasta da mesa (`tavola-mestre.json`), só a pública no servidor; código de recuperação (SHA-256 no servidor), mostrado uma vez; recuperação do mestre pela pasta e pelo código; "Proteger com a pasta da mesa", "Trocar a chave da pasta" e "Gerar novo código" na aba Mesa, Contas. Reforços: Origin no WebSocket e nos POSTs; bloqueio de login inexistente igual ao de conta real.

### Como rodar

- O `pnpm dev` do Vilella recarrega sozinho: a migração 11 só acrescenta duas colunas em `contas` e a tabela `desafios`. As variáveis e o proxy não mudaram.
- Para proteger a campanha de hoje (legada): entrar (ou criar a conta do mestre: aparece o código, anotar e marcar "Anotei o código"), aba Mesa, Contas, "Proteger com a pasta da mesa" (senha atual, escolher a pasta das imagens), e "Gerar novo código" se quiser um código novo.
- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints c3`.

### Verificação

- Unidade: `packages/shared/src/recuperacao.test.ts`, `apps/server/src/recuperacao.test.ts` (assinatura certa, nonce de uso único e vencido, pasta de outra mesa, código certo, errado e usado, limites, login inexistente, migração 11, varredura de frames), `origem.test.ts`.
- E2E novo: `e2e/tests/recuperacao.spec.ts` (6 cenários).
- E2E antigos alterados: `contas.spec.ts` e `mesas.spec.ts` (o código de recuperação aparece ao criar a mesa e ao criar a conta do mestre da legada: marcar "Anotei o código" antes de abrir a mesa ou continuar).

### Decisões

- (assumido) Ver REDESIGN, "C3 — como ficou", Decisões.

### Frágil / não verificado

- A pasta real (File System Access) não foi exercitada pelo E2E: os testes usam uma pasta de teste (`window.__tabletopPastas`, só no modo e2e). Falta o roteiro manual no Chrome.
- O `Origin` atrás do proxy do Vite depende de o `Host` ou do loopback; na internet vale só o mesmo host.
- Se a gravação do arquivo falhar depois de o servidor aceitar a chave nova (Proteger e Trocar), a mesa fica com uma chave cuja privada não existe: repetir "Trocar a chave da pasta".

### Roteiro manual (pendente)

1. Criar uma mesa nova escolhendo uma pasta no Chrome: conferir o `tavola-mestre.json`, o código e o "Anotei o código".
2. Sair, "Sou o mestre e esqueci a senha", pela pasta; depois pelo código (conferir o código novo).
3. Tentar a pasta de outra mesa.
4. Na campanha de hoje: criar a conta do mestre, anotar o código e "Proteger com a pasta da mesa".

---

## Tour — tour de introdução e pendências do C3 (entregue, aguardando o roteiro manual)

### O que foi entregue

- Tour do mestre (10 passos) e do jogador (6), no primeiro acesso de cada conta a cada mesa, com Pular e "Fazer o tour de novo" em Preferências; "já viu" guardado no servidor (migração 12). Código de recuperação numa linha só; oferta "Proteger com a pasta da mesa" / "Agora não" para a mesa legada.

### Como rodar

- O `pnpm dev` do Vilella recarrega sozinho: a migração 12 só acrescenta a coluna `tour_visto` em `contas` (as contas que já existem ficam com "não viu": o tour abre uma vez no próximo acesso). Nada do banco da campanha é reescrito.
- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints tour`.

### Verificação

- Unidade: `apps/web/src/tour/posicao.test.ts`, `passos.test.ts`, `abreSozinho.test.ts`; `apps/server/src/contas.test.ts` (migração 12); a versão de esquema "12" nos testes do `Armazenamento`.
- E2E novo: `e2e/tests/tour.spec.ts` (primeiro acesso, não abre no segundo nem em outro navegador, Pular, teclado e foco preso, "de novo", cada passo acha o alvo nos dois papéis em 1600×900 e 1280×720, passo sem alvo é pulado, código numa linha e oferta de pasta).
- E2E antigo alterado: `contas.spec.ts` (depois do código da mesa legada, clicar "Agora não" na oferta de pasta, nos dois cenários da legada).

### Decisões

- (assumido) Ver REDESIGN, "T — como ficou", Decisões.

### Frágil / não verificado

- O tour acha o alvo por `data-testid`: renomear um testid de `passos.ts` quebra o `tour.spec.ts`, de propósito.
- A oferta de pasta com a pasta real do Chrome não foi exercitada (o E2E usa a pasta de teste).
- O contorno e o buraco foram vistos em Grimório e Pergaminho; os outros temas usam os mesmos tokens (`--acento`, `--sobreposicao`, `--painel`).

### Roteiro manual (pendente)

1. Entre com uma conta nova (ou crie uma mesa nova): o tour abre sozinho. Ande com as setas, volte com a seta para a esquerda, pule com Esc.
2. Recarregue e entre em outro navegador com a mesma conta: não abre de novo.
3. Preferências, "Fazer o tour de novo". Confira os passos do mestre e os de um jogador (entrando como jogador de verdade).
4. Na campanha de hoje: criar a conta do mestre, anotar o código (uma linha só) e ver a oferta de proteger com a pasta.

---

## Ajustes V6 — Conjurar com espaço maior, dano por nível acima e "mandar ao chat" (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V6 — como ficou"). O Vilella deixou o lote sem ninguém para perguntar: o que o brief não dizia foi assumido (marcado).

### O que foi entregue

- **Menu de espaço ao conjurar** (Magias, Ataques e magias e Conjuração do NPC): um item por nível com restante, do nível da magia ao 9º, mais o pacto; pergunta sempre; teclado completo (setas, Enter, números, Esc, foco de volta). Truque não pergunta; sem opção, avisa.
- **`Magia.porNivelAcima`** (campo no editor da engrenagem), preenchido do "Em níveis superiores" do compêndio e valendo também para as fichas antigas (lê o compêndio ou a descrição na hora de conjurar).
- **Bloco colado no chat** na mesma mensagem: "Espaço de 5º · +2d6", dado, "Total N" e "metade N"; o crítico dobra os dados extras. Sem `porNivelAcima`, o cartão diz "com espaço de 5º".
- **Ícone "Mandar ao chat"** ao lado do Conjurar nas três listas: cartão da magia sem gastar nem rolar.

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v6`.

### Verificação

- Unidade: `packages/shared/src/conjuracao.test.ts` (`opcoesDeEspaco` com nível exato, só acima, pacto e nenhuma opção; `porNivelAcimaDoTexto` com o texto real do fixture, cura e variações e os que não casam; multiplicar; o campo na ficha vinda do compêndio; o extra no crítico; ficha e mensagem antigas), mais 2 em `chat.test.ts` (a sala rola o extra na mesma mensagem e dobra no crítico, `/r` com espaço e extra inválido).
- E2E novo: `e2e/tests/ficha-v6.spec.ts` (5): menu só com o 4º e o bloco colado (mesma largura, sem fresta, uma mensagem só); Esc, clique fora, setas, Enter e número, com o foco de volta; sem `porNivelAcima` não há bloco, sem espaço avisa e truque não pergunta; o ícone manda o cartão sem gastar; o campo do editor.
- E2E antigos alterados: `ficha-livro.spec.ts`, `ficha-magias-v4a3.spec.ts` e `ficha-v4b2.spec.ts` (conjurar passa a abrir o menu: escolhem o espaço com `escolherEspaco`, de `ajudasFicha.ts`; no do NPC a mensagem do aviso é a nova, "...ou maior para Bola de Fogo."). Nenhuma asserção foi afrouxada.

### Decisões

- (assumido) Ver `REDESIGN`, "V6 — como ficou", Decisões.

### Estado, protocolo e migração

- Campo opcional novo `Magia.porNivelAcima` e `Mensagem.espaco`; `chat.modelo`, `chat.enviar` e `chat.magia` ganharam `espaco?`. Tudo aditivo: ficha e mensagem antigas carregam igual (teste), o arquivo de exportação continua v13. **Não há migração de banco** (a ficha e as mensagens são JSON). Sem capacidade nova; o segredo do mestre não é tocado (a mensagem é pública).

### Desvios do plano

- Nenhum.

### Frágil / não verificado

- O preenchimento automático só reconhece os padrões "aumenta em XdY para cada nível" e "XdY adicional para cada nível"; outros textos ficam vazios (se escreve à mão).
- O crítico do bloco só foi conferido em unidade (o E2E não força um 20); nos prints ele sai repetindo o ataque pelo chat até aparecer.

### Roteiro manual (pendente)

1. Com um mago de 5º nível, conjure Bola de Fogo: o menu mostra 3º, 4º e 5º; escolha o 5º e veja o bloco colado com +2d6, o total e a metade.
2. Esc cancela sem gastar; o teclado escolhe (setas, Enter, número).
3. Clique no ícone ao lado do Conjurar: o cartão vai ao chat sem gastar espaço.
4. No NPC com a seção Conjuração, repita o menu e o ícone.
5. Uma magia sua que sobe sem "por nível acima": o cartão diz "com espaço de Nº".

---

## Ajustes V7 — Fim das vagas "Jogador N": na mesa só existe quem entrou (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V7 — como ficou"). O Vilella deixou o lote sem ninguém para perguntar: o que o brief não dizia foi assumido (marcado).

### O que foi entregue

- **Membros:** o mestre e quem tem conta ativa. A sala deriva a lista (`estado.membros`, em cada snapshot) e todas as listas de pessoas passam a mostrar só eles: Papéis, exceções de permissão, "Quem vê" e "Mostrar agora" do handout, "Quem controla" da ficha e do token, "Ver como", `/w`, bolinhas do topo, contagem do preparo.
- **Mesa nova só com o mestre.** A Campanha real não perde vaga: Jogador 2 a 7 só ficam escondidos.
- **Aceitar com "Ficha dele"** (opcional) no lugar de "Entra na vaga": Nenhuma cria o jogador com o nome da pessoa; a ficha de uma vaga escondida liga a conta àquela vaga (a Campanha); a ficha sem dono cria o jogador e o torna dono dela. Limite cheio reaproveita uma vaga escondida sem dono.
- **Mesa → Contas** sem o seletor "Vaga". Remover a conta esconde o jogador (fichas e tokens ficam).
- **Textos** sem "vaga" nem "Jogador N".

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v7`.

### Verificação

- Unidade: `packages/shared/src/membros.test.ts` (membros com e sem o campo, `derivarMembros` com e sem MODO=teste, fichas sem membro, aceitar com Nenhuma, com ficha de vaga escondida, com ficha sem dono, ficha de membro recusada, limite cheio com reaproveitamento e sem vaga livre, mesa nova só com o mestre); `apps/server/src/contas.test.ts` (conta ativa vira membro, remover esconde).
- E2E: `contas.spec.ts`: novo "V7: mesa com só o mestre" (Papéis, exceções, "Quem vê" do handout e topo mostram só o mestre, sem "Jogador N"); o do pedido aceito virou "aceita com a ficha de uma vaga escondida" (a pessoa vê a ficha e arrasta o token) e o segundo pedido entra com "Nenhuma"; o de remover confere que a pessoa aparece com o nome nas listas e some delas.
- E2E antigos alterados (comportamento mudou de propósito: a vaga em que ninguém entrou fica escondida; nenhuma asserção foi afrouxada): `ajudas.ts` ganhou `tornarMembros(request, ...ids)` (login solto de teste sem abrir página). `cenas.spec.ts` (preparar: o contador é "3/3" e "3 de 3 jogadores", não mais 7: conta só os membros); `estrutura.spec.ts` (presença: o jogador 1 nem aparece antes de entrar; o "+N" vem de 6 jogadores tornados membros); `interface.spec.ts` (o jogador 5 que não entrou não está no topo); `mesas.spec.ts` (mesa nova só tem `entrar-mestre`; o teste do renomear cria a mesa com um jogador aceito pela API); `sala.spec.ts` (handout do mestre e exportar/zerar/importar tornam membros os jogadores de que os seletores precisam; depois do `/teste/zerar` o jogador 1 entra de novo); `teclado.spec.ts` (o "+N" e o anel de foco ×3 tornam os 7 jogadores membros); `tour.spec.ts` ("Ver como" precisa do jogador 1 como membro); `contas.spec.ts` (aceitar com "Ficha dele", como descrito acima).

### Decisões

- (assumido) Ver `REDESIGN`, "V7 — como ficou", Decisões.

### Estado, protocolo e migração

- Campo novo `Estado.membros?: string[]` (derivado, só no snapshot; nunca gravado nem exportado). `CorpoAceitar` passou de `{ vaga }` para `{ personagemId? }` (o `vaga` antigo é ignorado); a rota `contas/<id>/vaga` saiu. **Não há migração de banco** e nenhuma vaga é apagada: o único dado novo é a chave `presentes_teste` da tabela `meta` (só com MODO=teste). Exportar e importar seguem iguais (o arquivo antigo carrega: o campo não existe nele). A campanha real carrega sem mudança.

### Desvios do plano

- Nenhum.

### Frágil / não verificado

- Quem decide a lista é `estado.membros` (vem da sala): todo seletor novo de pessoas precisa usar `jogadoresDaMesa`/`membrosDaMesa`, não `estado.usuarios`.
- A vaga escondida não tem tela: ficam para sempre (só invisíveis) até um novo aceite herdar.
- Não verificado com a campanha real (o banco dela não foi tocado).

### Roteiro manual (pendente)

1. Na Campanha: Mesa → Papéis lista só "Gabriel Vilella" e "Uker"; o topo mostra só as duas bolinhas.
2. Uma conta nova pede para entrar: em Mesa → Contas o pedido tem "Ficha dele" com Nenhuma e as fichas sem dono; aceite com uma ficha antiga (de Jogador 2 a 7) → a pessoa entra, vê a ficha e controla o token.
3. Aceite outra com Nenhuma → ela aparece com o nome dela em Papéis, no topo e no "Quem vê" do handout.
4. Remova uma conta → o nome some de todas as listas.
5. Crie uma mesa nova: só o mestre aparece em qualquer lista.

---

## Ajustes V8 — Ficha de NPC: fita de Conjuração, sem moldura, duas colunas (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V8 — como ficou"). O Vilella deixou o lote sem ninguém para perguntar: o que o brief não dizia foi assumido (marcado).

### O que foi entregue

- **Duas fitas** no alto do bloco de NPC, Bestiário e Conjuração, como abas (setas, Home, End, `aria-selected`). A Conjuração sai da lista e ganha a página dela.
- **Sem moldura:** fundo liso, conteúdo a ~14 px da borda da janela. A faixa das rolagens (vantagem) foi para a esquerda das fitas.
- **Duas colunas** com a janela larga (corpo ≥ 760 px): cabeçalho, números e linhas à esquerda; Traços, Ações, Reações e Lendárias à direita. A Conjuração larga põe os círculos em 2 colunas.
- A magia arrastada do compêndio com o Bestiário aberto cai na fita Conjuração (ela acende) e a janela passa para ela.
- O ícone de chat antigo da Conjuração saiu; ficou o do V6.

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v8`.

### Verificação

- E2E novo: `ficha-v8.spec.ts` (as fitas e o que cada uma mostra; o teclado; o jogador sem a fita num NPC sem magias e com ela num NPC com magias, o mestre sempre; duas colunas larga × uma estreita por `boundingBox().x`; sem moldura, a ≤ 16 px; círculos em 2 colunas).
- E2E antigos alterados (comportamento mudou de propósito; nenhuma asserção foi afrouxada): `ficha-v4b2.spec.ts` (os três testes que olham a Conjuração clicam na fita antes; a ordem "entre Traços e Ações" virou "a página da Conjuração não tem Traços nem Ações"; confere que só há o ícone de chat do V6); `ficha-arrastar.spec.ts` (a magia solta no NPC agora vai para a fita Conjuração, que acende, e a janela passa para ela; o item como traço volta ao Bestiário antes).

### Decisões

- (assumido) Ver `REDESIGN`, "V8 — como ficou", Decisões.

### Desvios do plano

- Nenhum.

### Frágil / não verificado

- Os arranjos do NPC dependem de três containers (`npc`, `npcesq`, `npcdir`, em `ficha.css`); regra nova de largura vai no container certo e com o prefixo `.fl-raiz`.
- Em janela larga a Conjuração tem grade por linhas (um vazio quando uma magia está aberta).
- Não verificado com a campanha real.

### Roteiro manual (pendente)

1. Abra um NPC: as fitas Bestiário e Conjuração no alto; clique na Conjuração (só ela aparece) e volte; use as setas do teclado nas fitas.
2. A página não tem borda nem degradê; o conteúdo vai até perto das bordas da janela.
3. Alargue a janela pela quina (~800 px ou mais): traços e ações vão para a direita dos atributos; estreite e volte a uma coluna.
4. Na Conjuração larga os círculos ficam em duas colunas.
5. Com o Bestiário aberto, arraste uma magia do compêndio: a fita Conjuração acende; solte nela.
6. Entre como jogador num NPC sem magias: sem a fita Conjuração.

## Ajustes V9 — A ficha numa janela própria do navegador (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V9 — como ficou"). O Vilella aprovou o plano e deixou o lote sem ninguém para perguntar: o que o brief não dizia foi assumido (marcado).

### O que foi entregue

- **Ícone "Abrir em janela própria"** no cabeçalho de toda ficha (PJ e NPC), antes do minimizar; some minimizada.
- O clique abre uma **janela do navegador** (`popup`) do tamanho da ficha; clicar de novo traz a mesma janela. Tamanho e posição ficam em `tabletop:pref:janela-ficha:<mesa>:<ficha>`.
- A rota **`/m/<id>/ficha/<fichaId>`** mostra só a ficha, com a própria conexão (mesma sessão); sem sessão aparece a entrada e depois a ficha. Título da aba "<nome> — Távola". Ficha apagada: mensagem e "Fechar esta janela".
- **Sem presença a mais** (a sala junta por usuário), sem tour e sem efeito de entrada.
- Na principal, a ficha fora **sai da pilha**, a lista de Fichas mostra **"em outra janela"** (clique traz a janela) e fechar a janela ou "Voltar para a mesa" devolve a ficha. Coordenação por Web Locks e `BroadcastChannel` por mesa.
- O "Ficha de" do compêndio inclui as fichas em outra janela.
- Pop-up bloqueado: toast "O navegador bloqueou a janela. Libere as janelas pop-up para este endereço."

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v9`.

### Verificação

- Unidade: `rotas.test.ts` (a rota da ficha e `caminhoDaFicha`).
- E2E novo: `ficha-v9.spec.ts` (o ícone abre a janela; só a ficha na página; o PV mudado nela chega ao mestre e à lista; a rolagem vai ao chat da principal; a ficha sai da pilha e a marca aparece; clicar no item não abre outra janela; fechar a janela e "Voltar para a mesa" devolvem a ficha; recarregar a principal mantém a ficha fora; a presença não duplica (uma bolinha por pessoa); o mestre abre a dele e o descanso avisa no toast da janela; pop-up bloqueado; rota direta sem sessão mostra a entrada; ficha inexistente).
- Nenhum E2E antigo foi alterado.
- Nenhuma mudança na sala, no protocolo, no estado nem migração.

### Decisões

- (assumido) Ver `REDESIGN`, "V9 — como ficou", Decisões.

### Desvios do plano

- Nenhum.

### Frágil / não verificado

- O navegador pode não respeitar `left`/`top` (outro monitor, monitor desligado): a janela abre onde ele quiser. Não verificado em dois monitores de verdade.
- Arrastar entre janelas não funciona (compêndio para a ficha de fora; ficha de fora para o mapa).
- A coordenação depende de Web Locks (precisa de endereço seguro: `localhost`, `127.0.0.1` ou HTTPS); sem eles vale só o aviso do `BroadcastChannel`, e uma janela que morre sem avisar fica marcada "fora" até o próximo clique no item (que descobre e limpa a marca).
- A janela da ficha tem o próprio gerente de arquivos sobre o mesmo cache do navegador (OPFS); dois downloads do mesmo arquivo ao mesmo tempo não foram exercitados.
- Só o Chrome foi testado (Firefox e Safari tratam `popup` e Web Locks de outro jeito).
- Não verificado com a campanha real.

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "V9".

---

## Ajustes C4 — Tela inicial no modelo B, o cartão central com abas (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("C4 — como ficou"). O Vilella escolheu o modelo B; o que o brief não dizia foi assumido (marcado).

### O que foi entregue

- A tela inicial virou **um cartão de altura fixa com três abas** ("Minhas mesas (N)", "Entrar com código", "Criar mesa"), com o logo e a frase no alto. A página não rola em 1600×900 nem em 1280×720; o que passar rola dentro do cartão.
- Abas com `role="tablist"`: ← →, Home e End; `aria-selected`.
- "Minhas mesas": linhas com pastilha, nome, id, "aberta hoje"/"ontem"/"há N dias" e seta; esqueleto enquanto procura; vazio com dois botões.
- "Entrar com código": campo de 48 px e botão na largura toda.
- "Criar mesa" em **2 passos** (Mesa e conta; Pasta da mesa) com "Passo N de 2" e bolinhas; depois de criar, o id, o código e "Abrir a mesa" ocupam o cartão.
- Rotas, sala, protocolo e estado não mudaram.

### Como rodar

- `pnpm verify` (uma vez). Prints: `$env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints c4`.

### Verificação

- E2E novo: `inicio.spec.ts` (a página não rola em 1600×900 e 1280×720 nas abas e nos dois passos de Criar; setas, Home e End; a aba inicial com e sem mesas e o vazio levando às outras abas; o passo 1 não avança com senha curta ou diferente; trocar de aba volta ao passo 1 sem perder o digitado).
- E2E alterados (só o caminho até a tela, o comportamento é o mesmo): `mesas.spec.ts`, `contas.spec.ts` e `recuperacao.spec.ts` clicam na aba certa e passam pelo "Continuar" (helpers `abrirAbaInicial`, `preencherMesaEConta` e `continuarParaAPasta` em `ajudas.ts`). Em `mesas.spec.ts` o botão "Criar" desabilitado virou "Continuar" desabilitado, o erro da confirmação aparece no passo 1 e o texto "Mesas neste computador" virou a aba "Minhas mesas".
- Não verificado com a campanha real.

### Decisões

- (assumido) Ver `REDESIGN`, "C4 — como ficou", Decisões.

### Desvios do plano

- Nenhum.

### Frágil / não verificado

- As três abas ficam montadas e as inativas usam `hidden`; quem mexer no CSS dos painéis precisa manter `.inicio-aba-painel[hidden] { display: none }`.
- O cartão tem altura fixa: um passo novo com mais conteúdo passa a rolar por dentro (o rodapé de botões fica fixo).
- Em telas com menos de ~560 px de altura o cartão (440 px) não cabe e a página rola.

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "C1".

---

## Ajustes V10 — Bugs do mapa e teclado do token (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V10 — como ficou").

### O que foi entregue

- O seletor de imagem abre por cima do "Configurar cena" (pilha de diálogos: foco, Tab preso, Esc só no de cima).
- O clique direito na área do mapa não abre mais o menu do Chrome (campos de texto e janelas ficam com ele).
- Delete/Backspace tira o token selecionado do mapa, com "Desfazer" (~6 s). Mestre apaga qualquer um; jogador, os que controla.
- Setas movem o token selecionado um quadrado, pelas intenções de sempre; a sala barra parede e permissão.
- A bandeira do ponto de chegada só aparece com a faixa de Cenas aberta, com dica ao passar o mouse.
- O anel de foco do mapa só aparece quando o foco chegou pelo teclado.

### Como rodar

`pnpm dev` como sempre.

### Verificação

- Unidade (`tokens.test.ts`): quem controla apaga, quem não controla não, o mestre qualquer um, restaurar no prazo, fora do prazo e por outra pessoa.
- E2E novo: `v10.spec.ts`.
- E2E alterado: `tokens.test.ts` (unidade) — o jogador que controla o token agora o apaga; o teste passou a usar o jogador que não controla.

### Decisões

- (assumido) Ver `REDESIGN`, "V10 — como ficou", Decisões.

### Desvios do plano

- `token.apagar` deixou de exigir `cena.editar` e ganhou `token.restaurar` (pedido do Vilella durante o lote).

### Frágil / não verificado

- A guarda do token apagado é só memória da sala: reiniciar a sala some com o Desfazer.
- `useDialogo` usa uma pilha global do módulo; diálogo novo deve usá-lo.

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "V10".

---

## Ajustes V10b — O jogador põe o próprio token na bandeira (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V10b — como ficou").

### O que foi entregue

- Intenção `token.colocarMeu` e capacidade `token.colocarProprio` (ligada por padrão, visível em Permissões).
- Botão "Colocar no mapa" na lista de Fichas e no cabeçalho da ficha; arrastar a ficha para o mapa com a área da bandeira acesa.
- O jogador vê a bandeira quando não tem token dele na cena, com a dica de como pôr.

### Como rodar

`pnpm dev` como sempre.

### Verificação

- Unidade (`colocarMeu.test.ts`, 18 testes): controla, não controla, segundo token, fora e dentro da área, campos da ficha com campo extra ignorado, capacidade desligada, mestre sem limite, campanha antiga (capacidade nova ganha o padrão ao importar), regras do cliente.
- E2E novo: `v10b.spec.ts` (3 testes).

### Decisões

- (assumido) Ver `REDESIGN`, "V10b — como ficou", Decisões.

### Desvios do plano

- Nenhum. A capacidade nova entra pelo mesmo caminho das outras (`PERMISSOES_PADRAO` completa campanha e exportação antigas): não há migração própria.

### Frágil / não verificado

- A bandeira do jogador e a área acesa dependem de `opcoes.mostrarBandeira` e `acenderAreaDaBandeira` (`Mesa.tsx` → `mapaPixi.ts`).
- O arrasto da ficha usa o estado do módulo `arrasto.ts` (o navegador não deixa ler o conteúdo do arrasto antes de soltar).

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "V10b".

---

---

## Ajustes V11 — Token: tochas nos cantos e condições com ícones (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V11 — como ficou").

### O que foi entregue

- A tocha na mão é uma marca no canto superior direito (1ª mão) ou esquerdo (2ª) do token, com a chama e um anel fino de tempo (alerta no fim). O tempo exato está na dica e no menu da tocha.
- As condições, a exaustão e a concentração são ícones do lucide (4 e um "+N") num arco embaixo do token; o menu de condições mostra o ícone ao lado de cada uma.
- A tabela condição → ícone está em `apps/web/src/condicoesIcones.ts`.

### Como rodar

`pnpm dev` como sempre.

### Verificação

- Unidade (`condicoesIcones.test.ts`, 4 testes): toda condição, a exaustão e a concentração têm ícone; sem repetição; o SVG sai com a cor; a chave de `iconesDoToken` sempre tem ícone.
- E2E novo: `token-v11.spec.ts` (3 testes): duas tochas nos cantos certos com raio entre 9 e 15 px e a luz centrada no token; arrastar a marca entrega a tocha; seis condições dão 4 ícones e "Mais 2", e o menu mostra os 16 ícones, todos diferentes.
- E2E alterado: `combate.spec.ts` (condição e concentração que o jogador aplica): 5 marcas viraram 4 e "Mais 1" (de propósito, o máximo agora é 4 mais "+N").

### Decisões

- (assumido) Ver `REDESIGN`, "V11 — como ficou", Decisões.

### Desvios do plano

- O olho cortado do token oculto foi para o alto do token (o canto era da tocha).

### Frágil / não verificado

- As marcas do token são desenhadas em `criarVisual` e reescaladas por zoom em `ajustarMarcasAoZoom`; a tocha em `desenharAlcas`/`ancoraDaAlca`. Mexer num lado sem o outro desalinha tamanho e clique.
- Os ícones chegam de forma assíncrona (SVG → imagem → textura): no primeiro desenho a bolinha pode aparecer vazia por um instante, e os tokens são refeitos quando a textura chega.
- Token de 1 quadrado com 4 ou mais marcas e as tochas: as bolinhas ficam encostadas (mínimo de 9 px de raio). Não foi visto em token minúsculo (menos de 1 quadrado).
- Toque (celular): nada novo, a dica só com mouse.

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "V11".

---

---

## Ajustes V10c — Cena como cartão (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V10c — como ficou").

### O que foi entregue

- Campo `Cena.cartao?` e item "Transformar em cartão" / "Voltar a ser mapa" no menu da cena (faixa de Cenas), e a caixa "Cena como cartão" no "Configurar cena". Marca pequena no cartão da faixa.
- Numa cena-cartão: sem névoa, escuridão nem limite de visão para todos; sem o aviso "Seu personagem não está nesta cena"; a câmera enquadra a imagem inteira ao entrar; paredes, portas e luz ficam guardadas sem efeito e voltam ao voltar a mapa.
- Na sala: o jogador não recebe as paredes de uma cena-cartão (snapshot e eventos); o mestre e os segredos seguem como eram.

### Como rodar

`pnpm dev` como sempre.

### Verificação

- Unidade (`packages/shared/src/cartao.test.ts`, 12 testes): cena antiga carrega sem o campo; liga e desliga (o campo some ao desligar); só o mestre muda (o jogador recebe `sem_permissao`, e `cena.editar` não é delegável); duplicar leva o cartão; exportar e importar levam o campo e o arquivo antigo carrega; a sala manda os mesmos tokens em mapa e em cartão e esconde o oculto e a secreta; paredes só para o mestre; snapshot a todos ao virar e voltar; eventos de parede não chegam ao jogador; a parede não barra o `token.soltar` do jogador no cartão e barra no mapa.
- E2E novo: `v10c.spec.ts` (5 testes): menu, marca na faixa e "Voltar a ser mapa"; jogador sem token vê tudo, sem aviso nem paredes, e a névoa, o aviso e as paredes voltam; a câmera enquadra a imagem ao entrar; o checkbox do "Configurar cena"; o jogador não muda o cartão.
- E2E antigo alterado: `interface.spec.ts` (faixa de cenas): a lista de itens do menu da cena ganhou "Transformar em cartão" entre "Preparar" e "Configurar…" (o menu mudou de propósito).

### Decisões

- (assumido) Ver `REDESIGN`, "V10c — como ficou", Decisões.

### Desvios do plano

- O brief dizia "se a sala filtra algo por visão": ela não filtra nada por visão (a escuridão é do cliente). O que a sala manda e depende da cena são as paredes, e é isso que o cartão esconde do jogador.

### Frágil / não verificado

- A câmera do cartão enquadra `larguraM` × `alturaM` da cena; se um dia a cena puder ter tamanho diferente da imagem, enquadrará o tamanho da cena, não o da imagem.
- `Mesa.tsx` usa `visaoLimitadaNaCena` para a névoa; qualquer visão nova do cliente precisa passar por ela, senão volta a escurecer o cartão.

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "V10c".

---

---

## Ajustes V12 — Ping no mapa (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V12 — como ficou") e `docs/protocolo.md` ("Ping no mapa").

### O que foi entregue

- Segurar o botão esquerdo parado (~0,4 s) com Selecionar ou Mão, no fundo ou num token, faz um círculo (dois anéis e o centro) na cor do usuário, para todos que veem a cena. Shift (ou Shift+P) também leva a câmera de todos ao ponto. P pinga no ponto sob o ponteiro.
- Na sala: intenção `mapa.ping`, mensagem `mapa.pingado`, capacidade `mapa.pingar` (ligada por padrão, em Permissões). Efêmero: nada é gravado.

### Como rodar

`pnpm dev` como sempre.

### Verificação

- Unidade (`packages/shared/src/ping.test.ts`): validação da cena e do ponto, quem não vê a cena, capacidade desligada (padrão e exceção por usuário), nada gravado (mesmo estado, nenhum evento), quem recebe, mensagem da sala e limite de frequência.
- E2E novo: `v12.spec.ts` (10 testes, duas páginas): segurar parado, nada gravado, arrastar não pinga, Mão e token, Shift centraliza, teclas P e Shift+P, outra cena, capacidade desligada, cena-cartão e o movimento ligado.
- E2E antigo alterado: nenhum.

### Decisões

- (assumido) Ver `REDESIGN`, "V12 — como ficou", Decisões.

### Desvios do plano

- Nenhum.

### Frágil / não verificado

- O ping usa um `setTimeout` de 400 ms desde o `pointerdown`; o toque (celular) não foi verificado.
- O limite de frequência vive na memória da sala (`ultimoPing`): reinicia com ela, o que é inofensivo. Os E2E o zeram em `/teste/zerar`.
- Os E2E rodam com `reducedMotion: "reduce"` (anel fixo e câmera instantânea); um E2E com movimento ligado cobre a animação.
- O mestre recebe todo ping e o cliente filtra pela cena que ele olha.

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "V12".

---

---

## Ajustes V13 — Régua livre, pontos de virada e metros ou pés (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V13 — como ficou").

### O que foi entregue

- Painel da ferramenta Régua com "Grudar no grid" (lembrado por pessoa); Alt inverte. Régua livre: linha reta, sem quadrados.
- Clique direito com o botão esquerdo segurado marca ponto de virada; rótulos por trecho e "trecho · total"; Backspace tira o último ponto; a fixa guarda os pontos.
- Unidade (Metros / Pés) em Preferências: régua, resumo do raio de luz dos modelos e o campo do quadrado no Configurar cena. O estado continua em metros.

### Como rodar

`pnpm dev` como sempre. Sem migração e sem mudança de protocolo ou de sala.

### Verificação

- Unidade (`packages/shared/src/mapa.test.ts`): conversão (1,5 m = 5 pés, 9 m = 30 pés), formatação, régua livre e em pés, soma dos trechos (grudada e livre). `apps/web/src/preferencias.test.ts`: os padrões e as chaves.
- E2E novo: `v13.spec.ts` (5 testes): régua livre e lembrada, Alt inverte, três trechos com dois cliques direitos (e nenhum menu), pontos grudados, preferência em pés e Configurar cena.
- E2E antigo alterado: nenhum.

### Decisões

- (assumido) Ver `REDESIGN`, "V13 — como ficou", Decisões.

### Desvios do plano

- A dica e o menu da tocha não mostram raio (só o tempo): não havia o que converter. Os campos de edição de raio seguem em metros.

### Frágil / não verificado

- O clique direito durante o arrasto chega ao mapa pelo `pointerdown` ou, se o navegador só avisar a mudança dos botões, pelo `buttons` do `pointermove`; os dois caminhos estão tratados, com um flag para contar um clique só. Em trackpad e toque não foi verificado.
- O painel da Régua fica sobre o mapa, no canto de cima à esquerda; em telas pequenas pode cobrir o ponto onde se começa a medir (a janela se arrasta).

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "V13".

---

## Ajustes V14 — Menus: tipos de parede, importar e exportar, atalhos (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("V14 — como ficou").

### O que foi entregue

- Tipo de parede como lista (ícone, nome e amostra do traço; a dica aparece ao lado) no painel Paredes e portas.
- Mesa → Campanha: Exportar e Importar em dois blocos iguais; escolher o arquivo mostra o nome e o resumo, com "Importar e substituir" e "Cancelar".
- Atalhos: "Os mais usados" aberta e o resto recolhido; saiu `menuAtivar`, entrou `chatHistorico`.
- Régua: os rótulos ficam dentro da área do mapa e longe do zoom.
- Campos de raio (luz, visão, alcance) na unidade escolhida (metros ou pés); a sala continua em metros.

### Como rodar

`pnpm dev` como sempre. Sem migração e sem mudança de protocolo ou de sala.

### Verificação

- Unidade: `posicaoDaRegua.test.ts` (onde o rótulo cabe) e `resumoDaCampanha.test.ts`.
- E2E novo: `v14.spec.ts` (5 testes): lista de tipos (setas e porta desenhada), Exportar e Importar (escolher, cancelar, confirmar), atalhos recolhidos, rótulo da régua na borda direita e junto do zoom, campos de raio em pés.
- E2E antigo alterado: os que importam uma campanha (`sala.spec.ts` 2, `handouts.spec.ts` 1, `assets.spec.ts` 1) agora passam por `importarCampanha` (`ajudas.ts`), que escolhe o arquivo e clica "Importar e substituir": o arquivo escolhido espera a confirmação.
  Os de desenhar paredes (`paredes.spec.ts`, `paredes-v5.spec.ts` ×3, `organizacao.spec.ts`) centram o mapa um pouco mais acima (`centrarEm`) para a lista de tipos, que é mais alta que os chips, não cobrir o primeiro clique; as coordenadas do mapa e as asserções são as mesmas (só o último trecho do teste do Alt foi de y 15,3 para 13,3, para continuar na tela).

### Decisões

- (assumido) Ver `REDESIGN`, "V14 — como ficou", Decisões.

### Desvios do plano

- A dica de cada tipo de parede vai na dica do mouse (`Dica`), não na linha, para o painel não ficar alto e cobrir o centro do mapa.

### Frágil / não verificado

- `PertoDoPonto` mede o rótulo a cada renderização (`useLayoutEffect`) e lê o retângulo do zoom pelo testid `zoom-flutuante`; se o zoom mudar de testid, o rótulo deixa de fugir dele.
- A amostra do traço usa as cores fixas do mapa (`ESTILO_DA_PAREDE`), não os tokens do tema: é conteúdo do mapa.

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "V14".

---

## Lote 7b-1 — Automações da mesa: o motor (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("7b-1 — como ficou") e `PROJETO.md` (4.11, "Desenho final do motor").

### O que foi entregue

- Ciclos (período, fases, cenas), reações (presas a modelo, cena ou mesa), ações da lista fechada, condições, eventos (de fase, manual e do sistema), modificadores com prazo, limite de encadeamento, escopo por cena e sorteio no RNG da sala.
- Dez intenções (`ciclo.criar|editar|apagar|disparar|pausar|retomar`, `reacao.criar|editar|apagar`, `evento.disparar`), todas `automacao.editar`; dois eventos do protocolo.
- Sigilo: `visaoPara` e `eventoPara` tiram a definição do jogador; ele recebe só os efeitos.
- Guardar, exportar e importar; o banco antigo carrega igual.

### Como rodar

`pnpm dev` como sempre. Sem migração de banco: as automações moram em duas chaves novas da tabela `meta`. Ainda não há tela de edição: o roteiro manual usa as intenções (ver `docs/ROTEIRO-DE-TESTES.md`, "7b-1").

### Verificação

- Unidade: `packages/shared/src/automacoes.test.ts` (42 testes: schemas, respiração nos segundos certos, a reação da tocha por 20 s, a chance reproduzível, pausar ciclo e mesa, encadeamento cortado, sobreposição e refresh, escopo por cena, eventos do sistema, intenções e capacidades, sigilo, exportar e importar, campanha antiga) e, em `apps/server`, o bloco "Armazenamento: automações (7b-1)" (banco antigo, gravar pelos eventos, importar, valor ilegível).
- E2E novo: `automacoes.spec.ts` (4 testes): ciclo curto reduz o raio e ele volta, com o jogador vendo o efeito e nenhum frame dele trazendo a automação; pausar a mesa congela o ciclo; pausar só o ciclo não para as tochas; o jogador não manda intenções de automação.
- Nenhum E2E antigo foi alterado.

### Decisões

- (assumido) Ver `REDESIGN`, "7b-1 — como ficou", Decisões.

### Desvios do plano

- O `ModificadorSchema` do objeto de luz (que já existia) ganhou `raioSomaM` e o `raioX` passou a ter padrão 1, em vez de uma lista nova de modificadores.
- A versão do arquivo de exportação continua 13 (os campos novos são opcionais).

### Frágil / não verificado

- O motor depende de duas coisas em `processar`: rodar depois de toda intenção com eventos e fora da importação e da exportação. Intenção nova que mude o estado sem emitir evento não dispara reação.
- `reagendarLuzes` (`sala.ts`) também agenda o `automacao.marco`; quem mudar o agendador precisa manter os dois.
- O limite de visão chega ao navegador do mestre por `Estado.efeitos` e muda o polígono de visão no `Mesa.tsx` (`limitarAlcance`); só há teste de unidade, não de tela.
- O registro do mestre (encadeamento cortado, fases puladas) está só no estado: ainda não aparece na tela (resolvido no 7b-3: "Avisos do motor" no editor).
- O `packages/shared` é lido pelo Vite sem compilar (modo "strip types" do Node): nada de propriedade de parâmetro no construtor (`constructor(readonly x)`) nem enum.

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "7b-1".

---

## Lote 7b-2 — Automações da mesa: as zonas (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("7b-2 — como ficou"), `PROJETO.md` (4.11, "Zonas (7b-2)") e `docs/protocolo.md` ("Zonas (Lote 7b-2)").

### O que foi entregue

- A zona (polígono de uma cena, só do mestre) com efeitos enquanto dentro (luz × fator, luz ± metros, visão máxima), reconciliados pela sala: entram ao entrar, saem ao sair, desligar, apagar, mudar o desenho, trocar de cena.
- Eventos `token.entrouNaZona` e `token.saiuDaZona`; ação `zona.ativar`; condição `dentroDaZona`; reações presas a zona (`fica: { tipo: "zona" }`).
- Intenções `zona.criar|editar|apagar` (`automacao.editar`), eventos `zona.alterada` e `zona.apagada`; erro `zona_inexistente`.
- A ferramenta "Zonas" (tecla Z) e o painel da zona; o atalho entrou em `atalhos.ts` (aparece na lista de Preferências e na dica do botão).
- Guardar, exportar, importar, duplicar a cena e apagar a cena levam as zonas.

### Como rodar

`pnpm dev` como sempre. Sem migração SQL: as zonas moram na coleção `zonas` da tabela `entidades`; o banco da campanha real carrega igual, sem zona.

### Verificação

- Unidade: `packages/shared/src/zonas.test.ts` (ponto no polígono, borda e côncavo; entrar e sair uma vez só; efeito que entra e sai e nunca fica preso ao desligar, apagar, editar o desenho, trocar de cena ou apagar a cena; cena-cartão; `zona.ativar` e `dentroDaZona`; intenções e capacidade; duplicar a cena; sigilo; exportar e importar) e, em `apps/server`, o bloco "Armazenamento: zonas (7b-2)".
- E2E novo: `zonas.spec.ts` (2 testes): o mestre desenha a zona com a ferramenta, edita o painel e Delete e Desfazer a apagam e trazem de volta; o token do jogador entra na zona, a luz da tocha diminui, sai e a luz volta, e o jogador nunca recebe a zona em nenhum frame.
- Um teste de unidade antigo alterado: `automacoes.test.ts` (esperava que `zona.ativar` fosse recusada; agora a ação existe e só é recusada sem `ativa`).
- Bug do 7b-1 corrigido: `reacao.editar` e `ciclo.editar` só com um campo zeravam `se`, `ativa` e `cenas` (padrões do zod no `.partial()`); `protocolo.ts` e teste em `zonas.test.ts`.

### Decisões

- (assumido) Ver `REDESIGN`, "7b-2 — como ficou", Decisões.

### Desvios do plano

- O efeito "enquanto dentro" é reconciliado em vez de ser aplicado e retirado por evento: é o que garante que nada fique preso. O formato do efeito de token não mudou (o `ateSala` já era opcional); o id `zona:...` o identifica.

### Frágil / não verificado

- A reconciliação (`sincronizarZonas`) roda dentro de `rodarAutomacoes` e `reagirAoSistema`, que o `processar` chama só quando a intenção emitiu evento. Mudança de posição que não emita evento de protocolo não atualiza os efeitos.
- A zona e o efeito dela dependem de a luz e o token estarem no `Estado`: a mochila e o token fora da cena não contam como "dentro".
- O sigilo: quem criar campo ou evento novo da zona precisa derrubá-lo em `visaoPara` e `eventoPara` e acrescentar o frame aos testes de sigilo (`zonas.test.ts`, `zonas.spec.ts`).
- O painel da zona é largo e cobre o meio do mapa em 1280×720; a janela se move, mas o atalho Z abre sempre na posição padrão (resolvido no 7b-3: o painel abre à direita).
- Os schemas de mudanças (`zona.editar`, e agora `ciclo.editar` e `reacao.editar`) não podem herdar os padrões do campo: o `.partial()` do zod os aplica e editar só o nome zeraria o resto.

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "7b-2".

---

## Lote 7b-3 — Automações da mesa: o editor, os botões e as campanhas (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("7b-3 — como ficou"), `PROJETO.md` (4.11, "O editor e os botões (7b-3)") e `docs/protocolo.md` ("Botões das automações (Lote 7b-3)"). Com este lote o **Lote 7b está entregue** (7b-1, 7b-2 e 7b-3).

### O que foi entregue

- A janela "Automações" (aba Mesa → "Abrir as automações"): lista de ciclos com a fase ao vivo, reações agrupadas por onde ficam, botões de evento, eventos em uso e os "Avisos do motor"; um formulário para cada peça, com o "Ver como JSON" editável ao lado e os erros do zod em português; apagar com confirmação na própria janela.
- Os botões na barra de cima: "Fixar na barra" (chip de ciclo e de evento) e "Liberar aos jogadores" (o jogador vê só o chip; a sala confere a liberação a cada clique e limita a 1 disparo a cada 2 s por jogador).
- Intenções `botao.criar|editar|apagar` (`automacao.editar`) e `botao.usar` (sem capacidade; a liberação é a conferência); evento `botoes.alterados` (só para o jogador); `Estado.botoes` (visão do jogador); `Automacoes.botoes`; `fixado` no ciclo.
- `fixtures/campanhas/chama-primordial.json` e `5e-padrao.json`, e a lista "Campanhas de exemplo" na aba Mesa → Campanha.
- Os três acertos do 7b-2: painéis das Zonas e das Paredes à direita; distâncias das Zonas em metros ou pés; o fator com vírgula.
- Meia frase sobre as Automações no passo da aba Mesa do tour.

### Como rodar

`pnpm dev` como sempre. **Sem migração SQL**: `botoes` e `fixado` são campos opcionais com padrão na leitura; a fatia guardada pelo 7b-1 e pelo 7b-2 carrega igual (a campanha real não muda sozinha) e só ganha os campos novos quando o mestre os usar. Para ver: aba Mesa → Automações → "Abrir as automações". As campanhas prontas: aba Mesa → Campanha → "Campanhas de exemplo" (numa mesa de teste, não na sua: importar troca a mesa).

### Verificação

- Unidade: `packages/shared/src/botoes.test.ts` (fixar e liberar; `botao.usar` do jogador liberado, desfeito e inexistente; o evento do jogador nasce de `automacoes.alterado` e não traz a fatia; sigilo da visão do jogador; `situacaoDoCiclo`), `campanhasProntas.test.ts` (os dois arquivos passam pelo schema de importação; a Chama Primordial roda: a inspiração reduz e apaga tochas, a expiração limita a visão, o aviso ao mestre; nada da história chega ao jogador; a 5e padrão roda sem automação), `apps/web`: `automacoes/erros.test.ts`, `decimal.test.ts`, `campanhasDeExemplo.test.ts`, e em `apps/server` a fatia antiga sem `botoes` (migração aditiva e idempotente).
- E2E novo: `automacoes-editor.spec.ts` (8 testes): o mestre monta pelo formulário uma reação da tocha e um ciclo de 10 s e o raio cai à metade no mapa; JSON com erro mostra a mensagem em português e não envia, corrigido salva; fixar o ciclo na barra, pausar, retomar e disparar pelo chip, apagar com confirmação; o jogador vê o botão liberado e o dispara, a sala recusa sem a liberação e limita a frequência, nenhum frame dele traz a definição; ciclo liberado com chip de pausar; a 5e padrão carrega e roda sem automação; a Chama Primordial pela lista e, com o ciclo encurtado para 30 s, a inspiração reduz e apaga tochas e o chip pausa e retoma. `zonas.spec.ts` ganhou 1 teste (painéis à direita, distâncias em pés, o fator com vírgula).
- Um E2E antigo alterado: `zonas.spec.ts` esperava `toHaveValue("0.5")` no fator; agora é `"0,5"` (a vírgula em pt-BR é pedido do lote).

### Decisões

- (assumido) Ver `REDESIGN`, "7b-3 — como ficou", Decisões.

### Desvios do plano

- O brief dizia "botão de ciclo e de evento"; o botão do ciclo é o próprio ciclo (`fixado` e `liberadoParaJogadores` nele), e o de evento é uma peça nova (`Automacoes.botoes`), já que o 7b-1 só tinha `evento.disparar` solto.
- Os chips ficam à direita dos menus do topo, mas em 1280×720 o nome da cena e o texto do chip viram reticências: o topo não comporta tudo.

### Frágil / não verificado

- O sigilo do botão: o jogador recebe `Estado.botoes` e `botoes.alterados`, e só isso. Quem criar campo novo no botão precisa decidir se vai ao jogador (por padrão não vai) e acrescentar o frame ao teste de sigilo (`botoes.test.ts`, `automacoes-editor.spec.ts`).
- O limite de 2 s por jogador está na memória da sala (`ultimoBotao`): reiniciar a sala o zera.
- O rascunho do formulário e o JSON compartilham um objeto; o id novo acompanha o nome até alguém mexer no `id` pelo JSON.
- A lista de exemplos substitui `usuarios` e `permissoes` do arquivo; o arquivo importado à mão só carrega em mesa cujos usuários incluam os do arquivo (`mestre`, `jogador-1` ... `jogador-7`).
- Não testado em toque nem com leitor de tela; o editor ainda não foi visto pelo Vilella.
- O `packages/shared` é lido pelo Vite sem compilar: nada de propriedade de parâmetro no construtor nem enum.

### Roteiro manual (pendente)

Ver `docs/ROTEIRO-DE-TESTES.md`, "7b-3" (inclui o roteiro manual do Lote 7b).

---

## Próximo: o MCP (12) e os bugs que sobrarem (o 7b está entregue: 7b-1, 7b-2 e 7b-3; o C4, a tela inicial e o V10 ao V14 também)

---

## Ajustes 12-1 — O acesso do Claude, sala e web (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("12-1 — como ficou"), `PROJETO.md` (4.12 e 4.14) e `docs/protocolo.md` ("O acesso do Claude").

### O que foi entregue
- Token por conta e mesa (Preferências, "Conectar o Claude"; só o SHA-256 no banco), conexão do Claude por `Authorization: Bearer`, lista de proibidos, limite de 20 pedidos por segundo, marca "pelo Claude", presença com marca, capacidade `personagem.criarProprio` (fichas e handouts próprios, teto de 20), rascunhos do mestre (selo, chip, Publicar e Descartar) e "Desfazer o que o Claude fez" (diário por `loteId`).

### Como rodar
`pnpm dev` como sempre. Migrações **13** (`tokens_claude`), **14** (`claude_lotes`) e **15** (conserto: confere as colunas das duas tabelas e acrescenta as que faltam; existe porque uma versão anterior da 14 rodou no banco real sem a coluna `itens`). Todas aditivas e idempotentes.

### Verificação
- Unidade: `claude.test.ts` (shared, 27), `tokensClaude.test.ts` (server, inclui as migrações 13 a 15 e o banco com a tabela na forma antiga). Total no verify: shared 934, server 123, web 131.
- E2E novo: `claude-12-1.spec.ts` (8 testes). E2E antigo alterado: `handouts.spec.ts` (o jogador agora cria o próprio handout; editar e apagar o que ele não vê dá `handout_inexistente`).
- Prints: `scratchpad/prints-12-1` (3 combinações).

### Decisões e frágil
Ver `REDESIGN.md` e `PASSAGEM.md` ("12-1").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "12-1".

## Ajustes 12-2 — O servidor MCP (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("12-2 — como ficou"), `PROJETO.md` (4.12), `docs/protocolo.md` e `docs/MCP.md`.

### O que foi entregue
- `apps/mcp` (`@tabletop/mcp`): servidor MCP em stdio com 11 ferramentas (panorama, ler, fichas, compendio, notas, objetos, cenas, automacoes, rolar, rascunhos, desfazer), visíveis por papel e capacidade; `docs/MCP.md`; o texto final de "Conectar o Claude".

### Como rodar
`pnpm --filter @tabletop/mcp build`, depois o comando de "Preferências → Conectar o Claude". Sem mudança em `apps/server` nem no banco (sem migração).

### Verificação
- Unidade: `apps/mcp` 55 testes (nomes, ficha por partes, ferramentas sobre a sala com as regras de verdade, conexão com socket de mentira); shared 934, server 123, web 131.
- E2E novo: `claude-12-2.spec.ts` (4 testes, MCP de verdade em stdio): jogador monta personagem e rola 4d6, mestre monta cena em rascunho e desfaz tudo, token revogado, configuração ruim. E2E antigo alterado: `claude-12-1.spec.ts` (o trecho agora traz `TAVOLA_MESA=<id>` em vez do endereço do WebSocket).
- Typecheck e lint verdes. A bateria E2E completa foi interrompida na 169ª (o sistema encerrou o processo por falta de memória); os specs de `fichas-arvore` ao fim e os do MCP rodaram depois: 249 passaram e 1 foi instável (`pausaAutomatica.spec.ts:10`, que passa sozinho; não toca no que o lote mudou). Os specs antes de `fichas-arvore` passaram na primeira parte (169 ok).
- Prints: `scratchpad/prints-12-2` (3 combinações).

### Decisões e frágil
Ver `REDESIGN.md` e `PASSAGEM.md` ("12-2").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "12-2".

## Ajustes P1 — A aba Preferências em sanfona com resumo (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("P1 — como ficou") e `PROJETO.md` (4.13).

### O que foi entregue
- Preferências reorganizada em sete cartões recolhíveis com resumo (Modelo B): Conta, Aparência, No mapa, Ajuda e arquivos, Conectar o Claude, Segurança e Atalhos do teclado. Só a Conta abre por padrão; o que a pessoa abre fica lembrado no navegador.

### Como rodar
`pnpm dev` como sempre. Sem migração, sem mudança de sala nem de protocolo.

### Verificação
- E2E novo: `p1.spec.ts` (4 testes). E2E antigos ajustados só no caminho até o controle: `abrirPreferencia(pagina, secao)` em `ajudas.ts` abre a aba e a seção; `claude-12-1.spec.ts` ganhou a conferência do resumo do Claude. `teclado.spec.ts` agora confere o título no cartão (o `<h3>` saiu).
- Prints: `scratchpad/prints-p1` (3 combinações).

### Decisões e frágil
Ver `REDESIGN.md` e `PASSAGEM.md` ("P1").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "P1".

## Ajustes 12-3 — O MCP na própria sala, por HTTP (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("12-3 — como ficou"), `PROJETO.md` (4.12), `docs/protocolo.md` e `docs/MCP.md`.

### O que foi entregue
- `POST /api/m/<id>/mcp` na sala (Streamable HTTP sem estado), com as mesmas 11 ferramentas; o comando de "Conectar o Claude" agora é uma linha só (`claude mcp add --transport http --scope user tavola-<id> <origem>/api/m/<id>/mcp --header "Authorization: Bearer <token>"`), sem arquivo, sem build e sem Node.
- A sala trata intenção numa função só (WebSocket e HTTP); o código das ferramentas mora em `packages/shared/src/mcp`.

### Como rodar
`pnpm dev` como sempre; abra Preferências → Conectar o Claude, gere o token e cole o comando num terminal. Sem migração e sem mudança de esquema.

### Verificação
- Unidade: `packages/shared/src/mcp/jsonrpc.test.ts` (7), `apps/web/src/claude/textosDoClaude.test.ts` (4) e os testes que vieram de `apps/mcp` (agora em `packages/shared/src/mcp`).
- E2E novo: `claude-12-3.spec.ts` (7 testes, cliente do SDK pelo Vite): jogador, mestre (rascunho, publicar, desfazer), a tela e o comando, token revogado e de outra mesa, a lista de segurança (Origin, cookie, métodos, tipo, tamanho, preflight, ferramentas), frequência e bloqueio por IP. E2E antigos alterados: `claude-12-1.spec.ts` e `claude-12-2.spec.ts` (o texto do comando e "conectado agora").
- Conferência do comando no PowerShell 5.1 e no cmd com um `claude.exe` de mentira que imprime os argumentos: 9 argumentos certos, o cabeçalho inteiro num só.
- Prints: `scratchpad/prints-12-3` (3 combinações).

### Decisões e frágil
Ver `REDESIGN.md` e `PASSAGEM.md` ("12-3").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "12-3".

## Ajustes N1 — Vida e CA no token, "morto" com X e a camada pelo clique direito (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("N1 — como ficou"), `PROJETO.md` (4.1, `morto?`) e `docs/protocolo.md` (`token.condicoes`).

### O que foi entregue
- Com um token selecionado, vida (editável) e CA aparecem acima dele para o mestre e para quem controla o token; botão de "morto" ao lado; X vermelho no token morto, visível a todos; "Camada" no menu do clique direito, só para o mestre.

### Como rodar
`pnpm dev` como sempre. Sem migração: o campo novo do token é opcional e a mesa antiga carrega.

### Verificação
- Unidade: `vidaDoToken.test.ts` (4) e um caso novo em `combate.test.ts` (o `morto`, as permissões e o campo antigo).
- E2E novo: `n1.spec.ts` (5 testes: marcas do jogador e dos outros, marcas do mestre e token sem ficha, editar a vida com -5/Esc/E/+30 e a ficha aberta do mestre, o X de morto por menu e por botão, a camada e o item que o jogador não tem). Nenhum E2E antigo foi alterado.
- Prints: `scratchpad/prints-n1` (3 combinações).

### Decisões, frágil e desvios
Ver `REDESIGN.md` e `PASSAGEM.md` ("N1").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "N1".

## Ajustes N2 — A conjuração completa: inata, truques por nível, ritual e dardos por nível (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("N2 — como ficou"), `PROJETO.md` (4.9), `docs/protocolo.md` e `docs/PASSAGEM.md` ("N2").

### O que foi entregue
- Parte "Conjuração inata" na fita Conjuração do NPC e na página Magias (atributo e CD próprios; À vontade, N/dia cada e N/dia do grupo; conjurar não gasta espaço e gasta a bolinha; "Recuperar usos" e o descanso longo devolvem).
- Truques que sobem pelo nível (Raio de Fogo, Rajada Mística), ritual sem espaço no menu do Conjurar, e "+1 dardo/raio/alvo/criatura" por nível acima (cartão com a quantidade e cada dardo rolado à parte).
- MCP (`fichas`, `compendio`, `rolar`) entende os campos novos.

### Como rodar
`pnpm dev` como sempre. Sem migração: os campos novos são opcionais e a ficha antiga carrega igual.

### Verificação
- Unidade: `conjuracaoN2.test.ts` (17) e um caso novo em `mcp/fichaPorPartes.test.ts`; `conjuracao.test.ts` teve um caso ajustado (o texto "um dardo adicional" agora vira "1 dardo", antes voltava vazio). `pnpm verify`: 424 E2E passando, sem flaky, e nenhuma mudança de código depois dele (só os prints).
- E2E novo: `ficha-n2.spec.ts` (3 testes). Nenhum E2E antigo alterado.
- Prints: `scratchpad/prints-n2` (3 combinações).

### Decisões, frágil e desvios
Ver `REDESIGN.md` e `PASSAGEM.md` ("N2"). Desvio: o NPC não tem botão de descanso, então a parte inata ganhou "Recuperar usos".

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "N2".

## Ajustes N3a — Compêndio com monstros e itens mágicos (entregue, aguardando o roteiro manual)

Detalhes em `docs/REDESIGN.md` ("N3a — como ficou"), `PROJETO.md` e `docs/PASSAGEM.md` ("N3a").

### O que foi entregue
- O compêndio recebe **monstros** e **itens mágicos** (schemas, busca, filtros de tipo, tamanho, ND e raridade, cartão do monstro).
- **Vários arquivos** em `compendio/` (`magias.json`, `monstros.json`, `itens.json`, `compendio.json`), juntos pela mesa, com aviso de nome repetido, e a ação **Carregar arquivos do compêndio…** (o caminho do N3b).
- **Criar NPC** a partir do monstro (botão e arrastar para o mapa) e **item mágico** no equipamento (arma com bônus também nos ataques).
- MCP: `compendio` busca monstros e itens mágicos; `fichas` cria NPCs de um monstro pelo nome (`monstro`, `quantidade`).
- Exemplo do SRD com 3 monstros e 4 itens mágicos. Limites maiores (asset de 16 MB). Corrigida a ordem do seletor de ND.

### Como rodar
`pnpm dev` como sempre. Sem migração: a ficha é JSON com campos opcionais e o compêndio da mesa continua a mesma referência de asset.

### Verificação
Ver o relatório do lote (números do `pnpm verify` e dos prints em `scratchpad/prints-n3a`). Unidade: `compendioN3a.test.ts` (schemas, limites, junção, busca, `monstroParaFicha`, item mágico), casos novos em `mcp/ferramentas.test.ts` e `apps/mcp/src/compendioLocal.test.ts`. E2E novo: `compendio-n3a.spec.ts` (4). E2E antigo alterado: `fluxos.spec.ts` (o texto do botão "Usar o exemplo" e do botão de arquivos mudou de propósito).

### Decisões, frágil e desvios
Ver `REDESIGN.md` e `PASSAGEM.md` ("N3a"). Desvio: a seção Monstros só aparece para o mestre, mas o dado chega a todos.

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "N3a".

## Ajustes N3b — O extrator do compêndio a partir dos livros (entregue, aguardando o roteiro manual)

Guia: `docs/COMPENDIO.md`. Código em `packages/shared/src/extrator/`.

### O que foi entregue
- `pnpm compendio:extrair -- --livros "<pasta>" --saida "<pasta>"` lê o Livro do Jogador, o Manual dos Monstros e o Guia do Mestre (PDF com texto, pdf.js no Node, sem rede e sem OCR) e grava `magias.json`, `monstros.json`, `itens.json` e `relatorio.md` na saída.
- A saída tem de ficar fora do repositório (o comando recusa). O conteúdo dos livros nunca entra no git.
- Cada entrada passa pelo zod do compêndio; a que falha vai para o relatório com o motivo. Cada arquivo é relido pela `lerCompendio` antes de gravar, e traz os `creditos`.
- Rodada real nos PDFs do Vilella: 361 magias, 428 monstros e 274 itens mágicos, todos válidos (números no relatório do lote).

### Como rodar
Ver `docs/COMPENDIO.md`. Sem migração e sem mudança no app (só `packages/shared/src/extrator/`, o script `compendio:extrair` e o `extrair` do pacote `shared`). Nenhuma dependência nova: usa o `pdfjs-dist` que o pacote já tinha.

### Verificação
Unidade: `extrator/extrator.test.ts` (29, só trechos inventados: colunas, versalete, magia com material que quebra, bloco de monstro com ações, recarga, conjuração inata e por espaços, bloco que passa para a coluna seguinte, item com tipo em duas linhas e nome em duas linhas, relatório, argumentos). Ponta a ponta feita à mão (spec temporário, não commitado): os 3 arquivos gerados carregam na mesa de teste pela ação do N3a; a busca acha Bola de Fogo, Goblin e Espada Vorpal; "Criar NPC" do Goblin dá a ficha completa (ND 1/4, DES 14, Cimitarra e Arco Curto, traço Escapada Ágil).

### Decisões, frágil e desvios
- (assumido) O extrator mora em `packages/shared/src/extrator/` (e não numa pasta `ferramentas/` solta) para resolver `zod` e `pdfjs-dist` do pnpm e reaproveitar os schemas; não é exportado pelo `index.ts` (o app não o carrega).
- (assumido) Campo do cabeçalho de magia que passa do limite do formato (material de Clone, tempo de Repreensão Infernal) fica abreviado no campo e inteiro no começo da descrição.
- (assumido) O livro não traz nome em inglês: `nomeOriginal` fica vazio. As classes vêm das listas por classe; três nomes das listas têm erro de digitação e são ligados por semelhança (anotado no relatório).
- Frágil: depende do layout dos PDFs (duas colunas, versalete, tamanho 9 da caixa de monstro, fontes). Outro livro ou outra edição pede ajuste em `linhas.ts`/`monstros.ts`.
- Frágil: tabelas dentro de descrições entram como texto corrido; a caixa de monstro que passa da coluna só continua se acabar no pé da coluna.

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "N3b".

## Ajustes N4 — Névoa pintada à mão (entregue, aguardando o roteiro manual)

### O que foi entregue
- Ferramenta **Névoa** (mestre, atalho **N**, ícone de nuvem): Cobrir ou Revelar, pincel (com raio), retângulo e polígono, Cobrir tudo e Revelar tudo (com confirmação na página), Desfazer (botão e Ctrl+Z).
- `Cena.nevoa` (lista de traços), intenções `nevoa.tracar` e `nevoa.desfazer` (`cena.editar`), eventos `nevoa.tracada` e `nevoa.desfeita`. O jogador vê a área coberta escura e opaca, sem os tokens dentro (menos os dele); o mestre vê um véu hachurado. Vale por cima da luz e também na cena-cartão. Duplicar, exportar e importar levam a névoa.

### Como rodar
`pnpm dev` como sempre. **Sem migração de banco** (a cena é JSON; o campo é opcional).

### Verificação
Unidade: `packages/shared/src/nevoa.test.ts` (composição, token dentro e fora, schema, intenções e permissão, evento só para a cena ativa, duplicar, exportar e importar com arquivo antigo, limites de traços e de pontos, simplificação do pincel, medida de peso e de tempo) e o fim de `apps/server/src/armazenamento.test.ts` (a névoa grava pelos eventos e volta do banco). E2E: `e2e/tests/nevoa.spec.ts` (cobrir tudo e revelar um retângulo; pincel e desfazer; polígono na cena-cartão com a tecla N e Revelar tudo; "Ver como" igual ao jogador e permissão). Números do `pnpm verify` no relatório do lote.

### Decisões, frágil e desvios
Ver `REDESIGN.md` ("N4") e `PASSAGEM.md` ("N4"). A névoa não é segredo: o que está sob ela chega ao navegador do jogador (decisão do Vilella).

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "N4".

## Ajustes N5 — Som ambiente: trilha, efeitos, som por zona e `som.tocar` (entregue, aguardando o roteiro manual)

### O que foi entregue
- Asset `som` (mp3, ogg e wav, até 20 MB) que sai da pasta local do mestre e chega aos jogadores por pedaços, como as imagens.
- Painel **Som** do mestre: trilha (um som por vez, em laço, volume, parar, troca suave de 2 s), trilha padrão da cena (começa ao levar o grupo) e efeitos (um clique, uma vez). Listas com busca.
- **Som enquanto dentro** na zona: quem tem token dentro ouve, com fade; o jogador nunca recebe a zona (só `som.zona` com hash, volume e laço).
- Ação **`som.tocar`** nas automações (todos, quem vê a cena ou quem controla o token do evento) e o formulário dela no editor.
- **Preferências → Som** (volume geral, trilha, efeitos, silenciar tudo, tudo só neste navegador) e o aviso "Clique para ativar o som da mesa".

### Como rodar
`pnpm dev` como sempre. **Sem migração de banco**: a trilha mora na chave `trilha` da tabela `meta` (como o compêndio). Nenhuma dependência nova. Para ouvir de verdade: ponha mp3, ogg ou wav na pasta de imagens da mesa (qualquer subpasta, de preferência `sons/`) e abra Som na barra à esquerda; ou use "Escolher arquivo…".

### Verificação
Unidade: `packages/shared/src/som.test.ts` (22: formato e tamanho, quem registra, trilha e relógio, trilha da cena e `grupo.moverPara`, efeitos e quem ouve, volume, som por zona e quem ouve, sigilo da zona, `som.tocar` no motor, exportar e importar) e o fim de `apps/server/src/armazenamento.test.ts` (trilha no SQLite, banco antigo). E2E: `e2e/tests/som-n5.spec.ts` (4 testes, com wavs de silêncio gerados no teste e o gancho `window.__tabletopSom`). Alterado: `p1.spec.ts` (a seção Som entra na ordem e na marca "só neste navegador").

### Decisões, frágil e desvios
Ver `REDESIGN.md` ("N5") e `PASSAGEM.md` ("N5"). Desvio: os jogadores só baixam antes a trilha que toca e a trilha das cenas; efeitos e sons de zona baixam na primeira vez.

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "N5".

## Ajustes M1 — O Claude sobe arquivos para a mesa (entregue, aguardando o roteiro manual)

### O que foi entregue
- Ferramenta MCP **`arquivos`** (a 12ª): `enviar` dá um link de envio de uso único (15 min) e o comando `curl -sS -T "<caminho do arquivo>" "<link>"`; `estado`, `listar` e `usar` completam. Usos: mapa da cena, token, retrato da ficha, imagem do handout, som e compêndio. No mapa, `quadrados` (45 = 45 x 45) ou `pxPorQuadrado` ajustam o tamanho da cena. Sem shell, `base64` (até 2 MB).
- Caixa de entrada na sala (SQLite, migração 16), `PUT claude/envio/<segredo>`, `GET caixa/<id>`, mensagem `caixa.pendentes` e intenções `caixa.concluir` e `caixa.falhar` (só o navegador do mestre).
- O navegador do mestre processa pelo mesmo caminho do botão de subir; a sala aplica o uso como o Claude que pediu, no lote dele (o Desfazer tira o mapa ou a imagem). Aviso "O Claude enviou 1 arquivo".

### Como rodar
`pnpm dev` como sempre. Migração nova (16, aditiva e idempotente): a primeira abertura cria as duas tabelas. Para o Claude: "gere o mapa X, ponha na cena Y com 45 x 45 quadrados".

### Verificação
- `pnpm verify` uma vez: typecheck e lint limpos; unidade 1129 (shared), 138 (server), 139 (web), 19 (mcp); E2E 443 testes, 442 passaram e 1 falhou: `claude-12-3.spec.ts` "segurança do HTTP" (contava 11 ferramentas e agora são 12). Corrigi o número e rodei só esse spec: passou. Nenhum teste instável.
- Novos: `envios.test.ts`, `mcp/arquivos.test.ts`, `apps/server/src/caixaDeEntrada.test.ts` (link de uso único, vencido, caixa, prazo, migração) e `e2e/tests/envio-m1.spec.ts` (7 testes: mapa para mestre e jogador com o tamanho da cena e o Desfazer; token e retrato; mesa fechada; link reusado, inventado, com Origin, não imagem, grande e token revogado; o jogador não põe mapa; base64, som e compêndio; mapa de 3150 x 3150 em tiles).
- Alterados por mudança de propósito: `claude-12-2`, `claude-12-3` e `ferramentas.test`/`jsonrpc.test` (a lista de ferramentas ganhou `arquivos`); `claude.test` (a lista de proibidos ganhou `caixa.*`); os testes de migração (`versao_esquema` "15" virou "16").

### Decisões
Ver `REDESIGN.md` ("M1 — como ficou"): ferramenta única em vez de `hash` nas existentes, limites, `quadrados` pelo lado maior, som com `cena` vira trilha, cópia na subpasta só com a pasta liberada, corpo do MCP de 4 MB só para `arquivos`.

### Desvios
- O brief dizia que sem a pasta liberada o arquivo esperaria; a mesa processa do mesmo jeito (o cache do navegador é o que ela usa).
- As ferramentas de cenas, fichas e notas não ganharam `hash`; só `arquivos.usar`.

### Frágil
Ver `PASSAGEM.md` ("M1"): o aplicar do uso é da sala; espera de até 2 s pelo `asset.registrar`; versão do esquema nos testes; o corpo de 4 MB só com a palavra `"arquivos"`.

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "M1".

## Ajustes M2 — O Claude faz tudo na preparação e na configuração (entregue, aguardando o roteiro manual)

### O que foi entregue
- Tabela de paridade `packages/shared/src/mcp/paridade.ts`: as 125 intenções, 107 com ferramenta e campo, 18 de fora (4 proibidas, 9 de transporte, 5 gestos ao vivo). Teste `paridade.test.ts`: intenção nova sem entrada, ou entrada apontando para ferramenta ou campo inexistente, reprova.
- Ferramentas novas (agora 18): `mapa`, `tokens`, `mesa`, `som`, `combate`, `chat`. Ampliadas: `cenas`, `automacoes`, `objetos`, `fichas`.
- O Desfazer cobre os desenhos. O texto de conexão do MCP traz o roteiro de preparar uma sessão. `docs/MCP.md` lista as ferramentas e a tabela.

### Como rodar
`pnpm dev` como sempre. Sem migração e sem mudança de protocolo ou de tela.

### Verificação
- `pnpm verify` uma vez: typecheck e lint limpos; unidade 1155 (shared), 138 (server), 139 (web), 19 (mcp); E2E 446 testes, 441 passaram e 5 falharam, todos nas listas de ferramentas dos specs 12-2 e 12-3 (a lista cresceu de propósito). Corrigidos (só listas e contagem 12 -> 18) e os dois specs rodados de novo: 11 passaram. Nenhum código mudou depois do verify, só esses dois specs.
- Novos: `mcp/paridade.test.ts`, `mcp/m2.test.ts`, `e2e/tests/claude-m2.spec.ts` (névoa, texto, parede, chat, trilha, Desfazer; combate com 2 goblins; jogador barrado).

### Decisões
Ver `REDESIGN.md` ("M2 — como ficou").

### Desvios
- O brief pedia "escrever um texto no mapa", mas a mesa não tem forma texto: o texto é feito de traços (fonte própria, sem acento).
- Mover token usa `token.soltar`; `token.mover` não grava.

### Frágil
Ver `PASSAGEM.md` ("M2").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "M2".

## Ajustes Q1 — Ajustes do Vilella e os arquivos entre navegadores (entregue, aguardando o roteiro manual)

### O que foi entregue
- "Abrir ficha" no topo do clique direito do token (mestre, e jogador no próprio token).
- Preferências → Claude sem a lista "O que o Claude fez" (o `claude.desfazer` segue para o MCP). Importar sem "Campanhas de exemplo". A mesa nova já nascia no 5e padrão; um teste de unidade garante.
- Transferências: nome numa linha com reticências, status abaixo.
- Cópia dos arquivos da mesa em `arquivos-da-mesa/<hash>` na pasta (só o mestre, pasta liberada), trazida de volta ao abrir, escolher ou reautorizar a pasta. Aviso na mesa e na aba Compêndio: reautorizar, escolher ou trocar a pasta. `docs/ARQUIVOS.md` explica tudo.
- Entrar como mestre pela chave da pasta lembra a pasta como a da mesa.

### Como rodar
`pnpm dev` como sempre. Sem migração e sem mudança de protocolo.

### Verificação
- `pnpm verify` uma vez: typecheck e lint limpos; unidade 1156 (shared), 138 (server), 135 (web), 19 (mcp); E2E 452 testes, 450 passaram e 2 falharam: `teclado.spec.ts` (Shift+F10 no token, do mestre e do jogador), porque o foco agora cai em "Abrir ficha". Mudei a expectativa (mudança de propósito) e rodei só `teclado.spec.ts` e `q1.spec.ts`: passaram. Nenhum teste instável.
- Novos: `e2e/tests/q1.spec.ts` (abrir ficha; Preferências e Importar; Transferências a 1280 e 1600; recarregar sem a pasta e reautorizar; segundo navegador de mestre e pasta errada) e o teste da mesa nova em `campanhasProntas.test.ts`.
- Alterados por mudança de propósito: `claude-12-1.spec.ts` (o Desfazer agora é pela intenção, não por botão), `automacoes-editor.spec.ts` e `prints/7b3.spec.ts` (as campanhas entram pelo arquivo, não pela lista), `teclado.spec.ts` (primeiro item do menu). Saiu `campanhasDeExemplo.test.ts` (a lista saiu).

### Decisões
Ver `REDESIGN.md` ("Q1 — como ficou").

### Desvios
- A hipótese do brief (arquivos do Claude e compêndio não iam para o cache) não se confirmou: já iam. O que faltava era a cópia na pasta para o segundo navegador.
- A escolha de pasta e a permissão de verdade só se testam à mão: no E2E a pasta é simulada.

### Frágil
Ver `PASSAGEM.md` ("Q1").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q1".

## Ajustes Q2 — O compêndio por seções, com blocos recolhíveis e busca em português e inglês (entregue, aguardando o roteiro manual)

### O que foi entregue
- A aba Compêndio por seções (Magias, Monstros só para o mestre, Itens mágicos, Armas, Itens e "Todas"), cada uma com blocos recolhíveis: magias por nível, monstros por ND, itens mágicos por raridade, armas por categoria e alcance. Alfabético dentro. A contagem no título do bloco.
- Filtros de classe e escola (magias), tipo e tamanho (monstros), raridade e sintonização (itens mágicos); os que não valem somem.
- Busca em todas as seções, em português e inglês, sem acento e sem caixa; o nome em inglês pequeno ao lado.
- Extrator com `--nomes` (tabela local `nomes-originais.json`), e a tabela do Vilella gerada fora do repositório.
- Os três JSON do Vilella regravados com o nome em inglês.

### Como rodar
`pnpm dev` como sempre. Sem migração e sem mudança de protocolo. Para regravar os arquivos com a tabela: `pnpm compendio:extrair -- --livros "<pasta dos PDFs>" --saida "<pasta do compêndio>"` (a tabela `nomes-originais.json` na pasta de saída é lida sozinha). Ver `docs/COMPENDIO.md`.

### Verificação
Ver o relatório do lote (números do `pnpm verify` e dos prints).

### Decisões
Ver `REDESIGN.md` ("Q2 — como ficou").

### Desvios
Nenhum.

### Frágil
Ver `PASSAGEM.md` ("Q2").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q2".

## Ajustes Q4 — A mesa de som: 8 efeitos de um toque e 8 ambientes em laço (entregue, aguardando o roteiro manual)

### O que foi entregue
- A mesa de som do mestre (janela flutuante ou faixa no pé da tela): 8 efeitos (um toque, uma vez, para todos; barra de progresso e "parar"), 8 ambientes (interruptor e volume próprio, vários ao mesmo tempo, em laço, entrada e saída de 1,5 s), volume geral e "Parar tudo".
- A configuração dos 16 lugares: arquivo, nome (12 letras), 12 ícones, 6 cores de etiqueta, volume padrão, "Ouvir", "Tirar deste lugar" e "Apagar este som da mesa" (com confirmação e o aviso de onde o som estava).
- Ambientes da cena (no lugar da trilha da cena): ligam ao levar o grupo, os outros desligam.
- A trilha única e a trilha da cena do N5 são convertidas ao ler (no banco e nos arquivos exportados).
- Intenções novas (`som.controlar`, só do mestre): `som.lugar`, `som.efeitoParar`, `som.ambiente`, `som.volumeGeral`, `som.pararTudo`, `som.apagar`; `som.efeito` ganhou o `lugar`. Saíram `som.trilha` e `som.parar`. Eventos novos: `som.ligadoAlterado`, `som.lugarAlterado` (só o mestre), `som.efeitoParado`, `asset.removido` (só o mestre). A ferramenta `som` do MCP faz tudo isso (tabela de paridade em dia).
- O teste instável do `envio-m1.spec.ts` ("envio com a mesa do mestre fechada") foi corrigido na causa.

### Como rodar
`pnpm dev` como sempre. **Sem migração de banco** (o som mora em chaves novas da tabela `meta`: `mesa_de_som` e `som_ligado`). A campanha que já existe carrega: a trilha antiga vira um ambiente na primeira leitura.

### Verificação
Ver o relatório do lote (números do `pnpm verify` e dos prints).

### Decisões
Ver `REDESIGN.md` ("Q4 — como ficou").

### Desvios
Nenhum.

### Frágil
Ver `PASSAGEM.md` ("Q4").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q4".

## Ajustes Q5 — As rolagens no chat no visual novo (entregue, aguardando o roteiro manual)

### O que foi entregue
- Cada rolagem do chat é um cartão, em dois estilos: **Fita** (padrão) e **Moldura de grimório**, o desenho que o Vilella aprovou. O número é o que mais aparece; no ataque, acerto e dano lado a lado, do mesmo tamanho; na magia de salvaguarda, CD e dano.
- O dano é o número mais só o ícone do tipo (13 tipos da 5e, mais cura); o nome do tipo fica no `aria-label` e no `title`.
- Os dados saem da frente: aparecem num balão com o mouse parado ~350 ms em cima do cartão (ou com o foco do teclado; no toque, tocar abre e fecha; Esc fecha). O balão só é montado enquanto aberto.
- Vantagem e desvantagem mostram os dois totais, o que vale grande e o descartado pequeno e esmaecido, com o rótulo.
- Rolagem oculta: uma linha pequena em itálico com o ícone, sem caixa.
- Cartões seguidos do mesmo remetente dividem o cabeçalho.
- Preferências → Aparência: "Estilo das rolagens no chat" (Fita ou Moldura), com prévia, por pessoa, em `tabletop:pref:estiloDasRolagens`.
- **Portas do E2E configuráveis** (para duas cópias rodarem testes ao mesmo tempo): `E2E_PORTA_SALA` (padrão 8788) e `E2E_PORTA_WEB` (padrão 5174). Veja "Como rodar".

### Como rodar
`pnpm dev` como sempre. Sem migração e sem mudança de protocolo. Para testar com outras portas (por exemplo numa segunda cópia do repositório):
`$env:E2E_PORTA_SALA=8790; $env:E2E_PORTA_WEB=5176; pnpm verify` (PowerShell) ou `E2E_PORTA_SALA=8790 E2E_PORTA_WEB=5176 pnpm verify` (bash). Valem para o `pnpm verify`, os specs, os prints e o `pnpm dev:e2e`. Sem elas, nada muda (8788/5174). As portas vêm de `e2e/portas.ts` (configs do Playwright e ajudas dos testes); a sala sobe por `apps/server/scripts/dev-e2e.mjs` (lê `E2E_PORTA_SALA`) e o Vite lê `TABLETOP_PORTA_*`, que o Playwright preenche a partir delas. Como cada cópia usa portas diferentes, o `reuseExistingServer` nunca reaproveita o servidor da outra. Nunca use 8787/5173 (o `pnpm dev`).

### Verificação
Ver o relatório do lote.

### Decisões
Ver `REDESIGN.md` ("Q5 — como ficou").

### Desvios
Nenhum.

### Frágil
Ver `PASSAGEM.md` ("Q5").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q5".

## Ajustes Q3 — Importar mapas do Dungeondraft (entregue, aguardando o roteiro manual)

### O que foi entregue
- O card "Importar mapa — Dungeondraft / Universal VTT…" no painel de cenas (só o mestre) e o arrastar do arquivo para a mesa criam uma cena nova a partir de um `.dd2vtt`, `.uvtt` ou `.df2vtt`: o mapa na grade certa, as paredes, as portas e as luzes, com o resumo no aviso.
- A intenção `cena.importarMapa` cria tudo num pedido só (um passo do Desfazer).
- `arquivos.enviar` do Claude ganhou o uso `dungeondraft` (caixa da M1; a sala cria a cena como o Claude, no lote dele).

### Como rodar
`pnpm dev` como sempre. Sem migração e sem campo novo no estado. Para testar à mão, ver o "Q3" em `docs/ROTEIRO-DE-TESTES.md`.

### Verificação
Ver o relatório do lote.

### Decisões
Ver `REDESIGN.md` ("Q3 — como ficou").

### Desvios
Nenhum.

### Frágil
Ver `PASSAGEM.md` ("Q3").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q3".

## Ajustes Q6 — A busca do compêndio e a mesa de som (Q2b + Q4b) (entregue, aguardando o roteiro manual)

### O que foi entregue
- **Busca do compêndio**: por palavra, sem acento, começo de palavra e erro de digitação, em português e inglês, com ordem por relevância; placeholder "Buscar…"; espaço entre a lista, os botões e os "Créditos".
- **Mesa de som**: transporte **Tocar / Parar** (os interruptores só marcam os ambientes); janela própria do navegador (`/m/<id>/som`); altura ajustável da faixa (tudo encolhe junto e, no mínimo, rola); a configuração por cima de tudo; mesa vazia com "Configurar"; lista dos sons que a mesa já tem na configuração.

### Como rodar
`pnpm dev` como sempre. Sem migração de banco (`SomLigado.tocando` é opcional e a sala já guardava o JSON). Mudança de protocolo: a intenção nova `som.transporte` e o campo `tocando` em `somLigado`. Testes em outras portas: `E2E_PORTA_SALA=8790 E2E_PORTA_WEB=5176`.

### Verificação
Ver o relatório do lote.

### Decisões
Ver `REDESIGN.md` ("Q6 — como ficou").

### Desvios
- O "Parar tudo" da tela virou o "Parar" do transporte (o brief pedia os dois; o transporte o substitui).

### Frágil
Ver `PASSAGEM.md` ("Q6").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q2b" e "Q4b".

## Ajustes Q9 — A Conjuração do NPC com a interface da aba Magias (entregue, aguardando o roteiro manual)

### O que foi entregue
- A seção Conjuração do NPC usa o mesmo componente de círculos da aba Magias do personagem (`ficha/CirculoDeMagias.tsx`): espaços totais e restantes, uma linha por magia com Conjurar, chat e engrenagem, "+ Círculo", Recuperar espaços, reordenar e soltar do compêndio por círculo. Fica só do NPC: CD e ataque pelo ND e a conjuração inata. Sem "Prep.".

### Como rodar
`pnpm dev` como sempre. Sem migração, sem protocolo. Testes em outras portas: `E2E_PORTA_SALA=8794 E2E_PORTA_WEB=5180`.

### Verificação
Ver o relatório do lote.

### Decisões
Ver `REDESIGN.md` ("Q9 — como ficou").

### Desvios
- Nenhum.

### Frágil
Ver `PASSAGEM.md` (seção Conjuração do NPC).

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q9".

## Ajustes Q7 — O painel de cenas em grade, a faixa que sobra, barras do tema e a descrição aberta (entregue, aguardando o roteiro manual)

### O que foi entregue
- Painel de cenas em grade: cards do mesmo tamanho, até 3 linhas e rolagem vertical, busca "Buscar cena…", botão direito (ou Shift+F10) no vazio com "Nova cena" e "Importar mapa", clique fora fecha.
- Barras de rolagem do app inteiro com as cores do tema (tokens `rolagemPolegar` e `rolagemTrilho`).
- Os cartões de magia e de característica chegam ao chat com a descrição aberta.
- Correção defensiva na troca de cena: um sprite do mapa por lugar, e o palco limpo ao mudar de cena (a tira da cena anterior não foi reproduzida; ver "Desvios").

### Como rodar
`pnpm dev` como sempre. Só tela (`apps/web`): sem migração, sem mudança de protocolo ou de sala. Testes em outras portas: `E2E_PORTA_SALA=8790 E2E_PORTA_WEB=5176`.

### Verificação
Ver o relatório do lote.

### Decisões
Ver `REDESIGN.md` ("Q7 — como ficou").

### Desvios
- A faixa do mapa anterior não deu para reproduzir no E2E; a correção cobre as duas causas encontradas no código e o teste novo confere o palco depois de cada troca (card e "Levar grupo"). Se o dono vir a tira de novo, mandar o mapa.
- `compendio.spec.ts`: o cartão da magia no chat agora chega aberto (mudança de propósito do Q7).

### Frágil
Ver `PASSAGEM.md` ("Q7").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q7".

## Ajustes Q8 — O token do jogador em cada cena, as Automações na barra e a aba Mesa organizada (entregue, aguardando o roteiro manual)

### O que foi entregue
- O jogador põe o token do personagem dele em qualquer cena (um por cena), mesmo com token em outra; ele vai **sempre para a bandeira** (o mestre põe onde quiser).
- Levar o grupo não duplica: quem já tem token no destino fica com o de lá.
- Botão **Automações** na barra de cima (janela flutuante); a aba Mesa só tem a frase e o botão.
- A aba Mesa usa os cartões da aba Preferências (Esta mesa, Regras, Luz, Automações, Pessoas, Campanha, Diagnóstico), com rótulo curto e ajuda embaixo.

### Como rodar
`pnpm dev` como sempre. Sem migração e sem campo novo no estado. Testes em outras portas: `E2E_PORTA_SALA=8792 E2E_PORTA_WEB=5178`. Roteiro: "Q8" em `docs/ROTEIRO-DE-TESTES.md`.

### Verificação
Ver o relatório do lote.

### Decisões
Ver `REDESIGN.md` ("Q8 — como ficou").

### Desvios
Nenhum.

### Frágil
Ver `PASSAGEM.md` ("Q8").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q8".

## Ajustes Q10 — Hordas: vida própria por token de NPC, numeração, pôr vários, duplicar e Ctrl+C / Ctrl+V (entregue, aguardando o roteiro manual)

### O que foi entregue
- Token de NPC com a **própria vida** (`Token.pv`, copiada da ficha ao pôr); a ficha é o modelo. Escolha "Cada token com a sua vida (horda)" na Configurar do NPC, **ligada por padrão**; desligada, os tokens leem a ficha.
- **Numeração** automática na sala (Goblin, Goblin 2, Goblin 3...) e um **selo** com o número no canto do token.
- **Colocar vários…** (1 a 20) no menu do NPC e no cabeçalho da ficha; um pedido só.
- **Ctrl+D**, **Alt+arrastar**, **Ctrl+C** e **Ctrl+V** nos tokens (mestre), inclusive de uma cena para outra; **Shift ou Ctrl+clique** soma tokens à seleção.
- A ficha aberta por um token mostra a faixa **"Este token"** (vida dele, editável); os PV da ficha viram "do modelo".
- A vida do token de NPC só chega ao jogador que receberia a vida da ficha (filtro na sala, com teste dos frames).
- MCP: `tokens` com `colocar[].quantidade`, `copiar` e `pvTemp`; `fichas` com `vidaPorToken`.

### Como rodar
`pnpm dev` como sempre. **Sem migração**: os campos novos são opcionais no JSON do token e do personagem (campanha antiga e exportações antigas carregam). Testes em outras portas: `E2E_PORTA_SALA=8790 E2E_PORTA_WEB=5176`. Roteiro: "Q10" em `docs/ROTEIRO-DE-TESTES.md`.

### Verificação
Ver o relatório do lote.

### Decisões
Ver `REDESIGN.md` ("Q10 — como ficou").

### Desvios
- O brief falava em "tokens selecionados", mas só havia seleção de um token: entrou Shift ou Ctrl+clique para somar à seleção (sem laço).
- "Aplicar dano/cura do chat" não existe no código: nada a auditar ali.

### Frágil
Ver `PASSAGEM.md` ("Q10").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q10".

## Ajustes Q11 — Barra de vida, borda colorida, laço, mover vários e dano em lote (entregue, aguardando o roteiro manual)

### O que foi entregue
- **Barra de vida** embaixo de cada token (verde, âmbar, vermelha; temporários em trecho claro), **opcional** (caixa em "Editar token…" e no token padrão do personagem), **ligada por padrão** (inclusive no compêndio e na campanha antiga) e **só visível a quem controla o token** (o mestre vê todas; "Ver como" segue o jogador).
- Sem o selo com o número no token (o nome numerado basta; `Token.numero` segue nos dados).
- **Borda colorida** de 8 cores fixas (menu do botão direito e "Editar token…"), vale para a seleção toda; todos veem; a cópia leva.
- **Laço de seleção** (arrastar no fundo; Shift/Ctrl soma; Esc cancela; o ping de segurar parado segue igual).
- **Mover vários juntos** (arrastar um da seleção e as setas), num pedido só.
- **Dano e cura em lote** (E com vários selecionados mostra "3 selecionados"; "Vida dos N selecionados…" no menu), num pedido só.
- MCP: `tokens` com `borda`, `barraDeVida` e `grupo`; `fichas` com `barraDeVida`. Intenções novas: `tokens.mover`, `tokens.vidaDelta`, `tokens.editar`.

### Como rodar
`pnpm dev` como sempre. **Sem migração**: todos os campos são opcionais (campanha antiga e exportação antiga carregam). Testes em outras portas: `E2E_PORTA_SALA=8790 E2E_PORTA_WEB=5176`. Roteiro: "Q11" em `docs/ROTEIRO-DE-TESTES.md`.

### Verificação
`pnpm verify`: typecheck e lint limpos; unidade 1294 (shared) + 140 (server) + 223 (web) + 19 (mcp); E2E 500 testes, 499 passaram e 1 instável (`estrutura.spec` "quatro regiões": `connect ETIMEDOUT` no `/teste/zerar`, o servidor ainda subindo; passou sozinho depois). Novos: `q11.test.ts` (shared, 25), `mcp/q11.test.ts` (4), `vidaDoToken.test.ts` (+1), `e2e/tests/q11.spec.ts` (4).

### Decisões
Ver `REDESIGN.md` ("Q11 — como ficou").

### Desvios
- O E2E do Q10 deixou de conferir o selo (`hordas-q10.spec.ts`, 2 linhas) porque o selo saiu de propósito.

### Frágil
Ver `PASSAGEM.md` ("Q11").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q11".

## Ajustes Q12 — Sem aviso de parede, setas rápidas e a câmera que segue o meu token (entregue, aguardando o roteiro manual)

### O que foi entregue
- **Sem o aviso "Uma parede bloqueia o caminho."** (e os parecidos: token que a pessoa não controla, token que sumiu): a sala recusa como antes, a tela não avisa. O cliente nem tenta o passo da seta que bate na parede (`trajetoBloqueado` do `shared`).
- **Setas rápidas:** o passo aparece na hora (otimista, a partir da posição pendente); segurar repete a 10 quadrados por segundo por um temporizador da tela; a sala confirma e, se recusar, o token volta sem aviso. Um toque: primeiro movimento em 5 a 7 ms (antes 26 a 71) e chegada em ~155 ms (antes ~260).
- **Seguir meu token:** botão ao lado de "Centralizar o mapa" (e a tecla F); o token escolhido fica no centro da tela; arrastar a vista ou centralizar desliga; lista de escolha com mais de um token; preferência por mesa neste navegador.

### Como rodar
`pnpm dev` como sempre. **Sem migração, sem mudança de sala, protocolo ou estado.** Testes em outras portas: `E2E_PORTA_SALA=8790 E2E_PORTA_WEB=5176`. Roteiro: "Q12" em `docs/ROTEIRO-DE-TESTES.md`.

### Verificação
Só tela (`apps/web`), então sem a bateria inteira (decisão de 2026-11-13). Typecheck e lint limpos; unidade 1294 (shared) + 140 (server) + 19 (mcp) + 245 (web, 22 novos: `passoDasSetas.test.ts`, `seguirToken.test.ts`, `useSala.test.ts`); E2E dos specs que tocam mapa, token, setas, avisos e câmera, 140 testes, todos passaram, nenhum instável: `q12` (4 novos), `v10`, `q11`, `paredes`, `paredes-v5`, `mapa`, `token-v11`, `v12`, `v13`, `v10c`, `teclado`, `interacoes`, `sala`, `luz`, `nevoa`, `q8`, `hordas-q10`, `tour`, `interface`, `v14`. Prints: `e2e/prints/q12.spec.ts`.

### Decisões
Ver `REDESIGN.md` ("Q12 — como ficou").

### Desvios
- `v10.spec.ts` ("as setas movem o token selecionado…"): esperava o aviso "parede" ao andar contra a parede; agora confere que nenhum aviso aparece.

### Frágil
Ver `PASSAGEM.md` ("Q12").

### Roteiro manual
`docs/ROTEIRO-DE-TESTES.md`, "Q12".

## Otimizações O1–O4 — A mesa mais rápida, sem mudar o que ela faz (branch `otimizacoes`, aguardando teste manual)

Feito em 2026-11-17 num worktree separado (`.claude/worktrees/otimizacoes`, branch `otimizacoes`, a partir de `redesign` em `1b7a751`). **Nenhuma função nova, nenhuma mudança de protocolo, nenhuma migração.** Só o mesmo resultado com menos trabalho. A única diferença de comportamento é a do slider da luz ambiente (abaixo).

### O que foi entregue
- **O1, sala (`28cb80a`)**: cada evento é serializado uma vez (não uma por conexão) e o snapshot uma vez por usuário; a rodada de snapshots lê a primeira página do chat e os membros uma vez; `reagendarLuzes` reprograma o alarme uma vez no fim (`Agendador.anotar`); a identidade do socket fica em cache; `contarMensagem` não faz mais um SELECT por mensagem; o estado em memória não é recriado em `token.mover`/ping/rascunho; `diffDoEstado` pula o item que é o mesmo objeto.
- **O2, pacote compartilhado (`d59d0c4`)**: ordenação do compêndio com `Intl.Collator` de módulo e nome normalizado em cache; busca com as formas do nome guardadas por entrada; `segmentosDaParede` em `WeakMap` por parede; caixa envolvente por traço da névoa; `bytesDoJson` com `TextEncoder`; `classeSrd` com índice; `arrumarNoGrid` reaproveita os candidatos.
- **O3, mapa (`f73c96c`)**: o pan não redesenha paredes, zonas, marcas de luz nem bandeira (só dependem do zoom); o pincel e o rascunho alheio redesenham só o traço em andamento; `definirOpcoes` só refaz paredes/zonas e marcas de luz quando muda uma opção que elas leem; a camada de luz pula os dois passes de cinza sem visão no escuro; "token sob névoa" em cache por token; segmentos de visão e paredes da cena em cache por referência; hover de porta e de token mais barato; a grade só é refeita quando muda.
- **O4, interface (`a8cc298`)**: a Mesa não re-renderiza a cada pedaço de arquivo recebido; `MensagemDoChat` em `memo`; índice de magias na ficha (`magiaDoCompendio`); a busca do compêndio nas 5 seções deixa de rodar em todo render; visão, tokens da cena e não lidas em `useMemo`; soltar um token não recria as opções do mapa; `MarcasDoToken` só escreve o estilo quando muda; cada rota num pedaço próprio (o JS inicial caiu de 1.860 kB para 238 kB; a Mesa virou um pedaço de 1.009 kB).
- **O4b, correção**: o carregamento por rota saiu primeiro com `lazy` + `Suspense`, e a mesa abria ~0,8 s mais tarde (o React segura a troca do conteúdo suspenso, e são dois pedaços por entrada). O `sala.spec` dos 8 contextos foi de ~17,5 s para ~25 s e estourava os 30 s com a máquina carregada (achado pela sessão do Q12 ao juntar). Agora `App.tsx` baixa o pedaço da rota já na avaliação do módulo e o mostra sem `Suspense` (`pedaco`, `useModulo`, `ComPedaco`): o teste voltou a ~19,5 s.

### `pnpm jogar`: a mesa com o build de produção
- **O que é:** sobe a sala igual ao `pnpm dev` (`wrangler dev`, 8787, mesmo banco em `apps/server/.wrangler/state`) e, no lugar do Vite de desenvolvimento, constrói o front e o serve com `vite preview` em `127.0.0.1:5173`. É a **mesma origem** do `pnpm dev`: o navegador mantém preferências, pasta da mesa e cache de arquivos. Os dois não rodam ao mesmo tempo (mesmas portas).
- **Por quê:** o `pnpm dev` usa o React de desenvolvimento, que valida cada elemento criado. Medido com `e2e/prints/desempenho.spec.ts` na cena pesada (45×45, 172 paredes, 5 tokens, 200 mensagens no chat, compêndio de 1.800 entradas), o tempo de script cai para entre 1/5 e 1/11: 40 mensagens de chat com o painel recolhido, 1.659 ms → 158 ms; digitar 40 teclas na ficha, 1.541 ms → 181 ms; abrir 3 fichas, 1.021 ms → 91 ms. O `sala.spec` dos 8 contextos leva 8,4 s contra ~19,5 s.
- **O que muda no uso:** o front **não recarrega** quando um arquivo muda; para ver código novo, parar e rodar `pnpm jogar` de novo (o build leva ~2 s). A sala continua recarregando sozinha a cada salvamento em `apps/server` ou `packages/shared` (o `wrangler dev` não tem como desligar isso): a regra das migrações segue valendo.
- **Como foi feito:** scripts `jogar` na raiz e em `apps/web` (`vite build && vite preview`) e o bloco `preview` no `vite.config.ts` (mesmo host, porta e proxy do `server`). Conferido com a sala de teste nas portas 8788/5174: 4 testes do `sala.spec` passam contra o front servido pelo script.

### Diferença de comportamento (uma só)
- O slider da **luz ambiente** (Configurar iluminação) envia no máximo um valor a cada 90 ms, e o último sempre sai (também ao fechar o painel). Antes era uma mensagem por passo. É o mesmo `useEnvioSuave` que os sliders das fontes de luz já usavam (agora em `apps/web/src/useEnvioSuave.ts`).

### Verificação
`pnpm verify` (uma vez, com os quatro lotes): typecheck e lint limpos; unidade 1297 (shared, +3 de equivalência) + 140 (server) + 223 (web) + 19 (mcp); **E2E 500 de 500, nenhum instável** (52,8 min). **Não houve medição de tempo antes e depois**: os ganhos vêm da leitura do código (frequência × custo); o único número medido é o tamanho do build.

### Frágil
- Os caches por referência (`WeakMap` de segmentos de parede, caixa da névoa, polígono em pixels, índice de magias, "token sob névoa", segmentos de visão) valem porque o estado é imutável: o `reduzir` sempre cria objeto novo. Código novo que **mute no lugar** uma parede, um traço da névoa, um polígono ou o compêndio deixa o cache velho.
- `QUEM_LE_A_OPCAO` (`mapaPixi.ts`): toda opção nova do mapa precisa ser classificada (o `Record` dá erro de compilação se faltar). Se `desenharParedes`, `desenharZonas` ou `desenharMarcasDeLuz` passarem a ler outra opção, a classificação tem de acompanhar, senão o desenho fica velho ao trocar a opção.
- `aplicarVista(true)` (pan) pula o que só depende do zoom. Algo novo dentro de `mundo` que dependa da posição da vista precisa ser redesenhado à parte.
- `redesenharAndamento` não refaz os desenhos gravados: o que mudar a lista dos gravados tem de chamar `redesenharDesenhos`.
- A rodada de snapshots (`RodadaDeSnapshots`, `sala.ts`) só pode viver dentro de um laço síncrono: nada pode gravar no banco no meio.
- Pedaço novo carregado sob demanda: não usar `lazy` + `Suspense` no caminho de abrir a mesa (atrasa a entrada, ver O4b). Usar `pedaco`/`ComPedaco` do `App.tsx`, com uma `key` por uso.

### O que ficou de fora
Ver `IDEIAS.md`, "Desempenho: auditado e não feito".

### Roteiro manual
Não há função nova. Vale passar pelo uso normal com atenção a: arrastar a vista e dar zoom com paredes e zonas na tela; pincel com vários desenhos; selecionar tokens; visão de jogador com névoa e com visão no escuro; chat longo; busca do compêndio; ficha de conjurador; slider da luz ambiente; baixar um mapa grande com a mesa aberta.

## Ajustes Q13 — Segurar a seta anda contínuo e em linha, mesmo numa cena pesada (entregue, aguardando o roteiro manual)

### O que foi entregue
- **Ritmo contínuo.** O token que anda por passo desliza em linha reta e em velocidade constante (um quadrado a cada 100 ms), sem parar nem frear entre os quadrados; soltar a tecla termina o quadrado e para. O relógio das setas é um `requestAnimationFrame` (não mais `setInterval`) e recupera um quadro atrasado sem saltos.
- **Menos trabalho por passo.** O estado do React recebe os `token.movido` a cada 300 ms (o mapa os recebe na hora); a visão e a luz da tocha acompanham o token no ritmo que a máquina aguenta; `Teclas`, `Dica`, `ListaDeAtalhos` em `memo`.
- **Sem o "passa e volta".** Um erro da sala só volta os tokens do pedido recusado (ou todos, no caso de arrasto), para a posição que a sala avisou por último.

### Como rodar
`pnpm dev` como sempre. **Sem migração, sem mudança de sala, protocolo ou estado.** Testes em outras portas: `E2E_PORTA_SALA=8790 E2E_PORTA_WEB=5176`. Roteiro: "Q13" em `docs/ROTEIRO-DE-TESTES.md`.

### Verificação
Só tela (`apps/web`) e um spec novo, então sem a bateria inteira. Typecheck e lint (menos os arquivos temporários `.q13-*` da cópia, que foram apagados); unidade web 249 (+4 em `passoDasSetas.test.ts`); E2E 121 + 43 testes nos specs que tocam mapa, token, setas, luz, névoa, memória, paredes, zonas, tochas, seguir, régua, ping, cenas, fluxos e interações, todos passaram; `q13.spec.ts` (4 testes novos) passou em modo de desenvolvimento e no build de produção. Números antes e depois: `REDESIGN.md`, "Q13".

### Decisões
Ver `REDESIGN.md` ("Q13 — como ficou").

### Desvios
Nenhum E2E antigo foi alterado.

### Frágil
Ver `PASSAGEM.md` ("Q13").

### Roteiro manual
Segurar a seta numa cena pesada (muitas paredes, tocha, névoa) e conferir: anda liso, sem parar entre os quadrados; soltar termina o quadrado; contra a parede o token para sem passar e voltar; o mestre vendo o jogador andar também o vê liso.

## Otimizações O5 — Abas em `memo` com fatias do estado, compêndio lido uma vez, uma validação por tecla (branch `otimizacoes-2`, aguardando teste manual)

Feito em 2026-11-17 no worktree `.claude/worktrees/otimizacoes-2` (branch `otimizacoes-2`, a partir da `main` em `a60708a`; o Q13 `55c988e` foi juntado depois, sem conflito). **Nenhuma função nova, nenhuma mudança de protocolo, nenhuma migração.** Fora do lote, de propósito: mapa, movimento de token, visão, luz, névoa, régua, zoom e dica do mapa.

### O que foi entregue
- **Abas com fatias (`f048939`)**: cada aba do painel declara as chaves do estado que lê (`FATIA_DO_CHAT`, `FATIA_DAS_FICHAS`, `FATIA_DO_COMPENDIO`, `FATIA_DA_MESA`), recebe só essa fatia com identidade estável (`useFatia`) e é exportada em `memo`. Evento que não toca na fatia não a re-renderiza, aberta ou fechada. A prop continua se chamando `estado`, mas o tipo é um `Pick`: o compilador acusa leitura fora da fatia. Na `Mesa.tsx` só mudou a fronteira com o painel (as fatias e as funções de identidade fixa entregues às abas).
- **Lista do compêndio**: `BlocosDoCompendio` e as linhas (magia, arma, item, monstro, item mágico) em `memo`, grupos em `useMemo`, `renderEntrada` estável. Editar uma ficha refaz o cabeçalho ("Ficha de"), não as centenas de linhas; o alvo do "Adicionar" e do "Criar NPC" é lido na hora do clique (`useFuncaoEstavel`).
- **Chat (`98c7ff8`)**: os elementos das mensagens ficam em `useMemo`; digitar na caixa ou editar uma ficha não recria as ~200 linhas.
- **Rótulos de tempo**: "usado há 5 min" (Conectar o Claude) e "redefinição liberada até" (Contas) dependiam de a aba re-renderizar a cada evento; agora envelhecem sozinhos (`useMinuto`, a cada 30 s).
- **Compêndio lido uma vez por arquivo**: `leituraDoCompendio.lerUmaVez` guarda por hash o resultado de `lerCompendio`; a aba e cada ficha aberta recebem o mesmo objeto, sem ler nem validar de novo (ficam os 3 hashes mais recentes).
- **Ficha**: `alterar` valida a fila nova uma vez e o render reaproveita o resultado; antes eram duas validações completas por tecla.

### Medição (antes × depois)
`e2e/prints/desempenho.spec.ts` (`pnpm --filter @tabletop/e2e medidas`), mestre na cena pesada: 45×45, 172 paredes, 5 tokens, 200 mensagens no chat, compêndio de 1.800 entradas. Métricas do Performance do Chrome pelo DevTools; tempo de script, mediana de 3 repetições. "Antes" é `de415ef`, "depois" é `98c7ff8`.

| Cenário | `pnpm dev` (ms) | Build de produção (ms) |
|---|---|---|
| 40 mensagens de chat, aba Chat à vista | 1.686 → 998 (−41%) | 282 → 117 (−58%) |
| 40 mensagens de chat, painel recolhido | 1.866 → 804 (−57%) | 228 → 90 (−60%) |
| 40 edições de ficha, painel recolhido | 1.945 → 1.064 (−45%) | 321 → 137 (−57%) |
| 40 edições de ficha, aba Compêndio à vista | 1.881 → 1.386 (−26%) | 288 → 129 (−55%) |
| Abrir 3 fichas com o compêndio | 1.192 → 804 (−33%) | 75 → 58 (−23%) |
| Digitar 40 teclas na ficha | 2.069 → 1.736 (−16%) | 204 → 205 (+1%) |

- As rajadas de eventos melhoraram nas quatro medições feitas (duas em cada modo), entre −26% e −63% conforme o estado do painel; no `pnpm dev` as tarefas longas (~200 ms por rajada) foram a zero em quase todos os estados. No perfil, a lista do compêndio (~500 ms por rajada, escondida) sumiu.
- **Digitar na ficha: ganho não demonstrado.** As cinco comparações deram 0%, −16%, +3%, +1% e −21%; o −16% da tabela saiu de uma rodada em que o Q13 subiu servidores durante o "antes". A validação cortada pesava ~55 ms em 40 teclas; o custo da tecla está no redesenho da ficha (`AbaPrincipal`: equipamento, ataques, perícias) e nos botões com dica (`BotaoComDica`/`Dica`), fora deste lote. Com o compêndio carregado há um ganho modesto (−8% a −37%), porque a lista do compêndio deixou de ser refeita a cada eco da ficha.
- Os dois "antes" finais rodaram com o Q13 subindo servidores no meio; os "depois" e a segunda passada de produção ficaram limpos. Os JSON e os perfis de CPU não estão no repositório.

### Verificação
Typecheck e lint limpos; unidade 273 (web, +50: `useFatia`, `leituraDoCompendio`, `useFicha` e os do Q13) + 1297 (shared) + 140 (server) + 19 (mcp). **E2E: os 508 testes passaram, em duas partes, sem falha nem instável** (já com o Q13 junto). A bateria única (`pnpm verify`) passou os 397 primeiros e foi encerrada pelo Claude Code por falta de memória no notebook; os 18 specs que faltavam (`sala` inteiro de novo, `q13`, `som-n5`, `som-q4`, `som-q4b`, `teclado`, `tema`, `tochas`, `token-v11`, `topo-e-abas`, `tour`, `v10`, `v10b`, `v10c`, `v12`, `v13`, `v14` e `zonas`) rodaram depois, à parte: 115 de 115.

### Frágil
- **Fatias:** uma aba só re-renderiza quando muda uma chave da `FATIA_*` dela. Quem passar a ler outra chave do estado numa aba precisa acrescentá-la à constante (o compilador acusa). O que depende de relógio (`Date.now()` no render) ou de store sem assinatura não se atualiza mais "de carona" a cada evento: precisa de `useMinuto`, `useTic` ou assinatura própria.
- **Props das abas:** toda prop nova entregue a uma aba pela `Mesa.tsx` precisa de identidade estável (`useCallback`, `useMemo`, `useFuncaoEstavel`), senão o `memo` da aba deixa de valer sem nenhum erro.
- A aba Fichas ainda re-renderiza a cada mudança de `tokens` (o botão "colocar no mapa" do jogador depende deles) e todas as abas, a cada ficha editada (leem `personagens`); as listas grandes estão em `memo`.
- `lerUmaVez` guarda também a leitura inválida de um hash (é determinística) e devolve o mesmo objeto `Compendio` a todos: ninguém pode mutá-lo.

### O que ficou de fora
Ver `IDEIAS.md`, "Desempenho: auditado e não feito": o redesenho da ficha a cada tecla e os botões com dica passaram a ser o maior custo medido da digitação.

## Ajustes Q14 — A ficha por seções: escrever numa caixa redesenha só ela (entregue, aguardando o roteiro manual)

### O que foi entregue
- **A ficha compartilha estrutura.** `compartilharEstrutura(antes, depois)` (`packages/shared/src/estruturaCompartilhada.ts`) devolve o que não mudou com a mesma referência. `aplicarOperacoes` a usa contra a ficha de entrada; `useFichaEditavel` e `derivar` (na `JanelaDaFicha`) a usam contra o resultado da tecla anterior, inclusive quando o eco da sala chega (objeto novo, mesmo conteúdo). Mudar o texto de um talento não troca `atributos`, `pericias`, `itens`...; mudar um atributo troca só `atributos` (e as derivadas que dependem dele).
- **Seções em `memo`** (`apps/web/src/ficha/secoes.tsx`, função `secao`): cada seção declara as chaves da ficha e de `d` que lê. Aba Personagem: classe e nível, identidade, atributos, passiva, inspiração e proficiência, salvaguardas, perícias, CA/iniciativa/deslocamento, PV (e os controles dele), dados de vida, contra a morte, moedas, ataques, equipamento, personalidade, características e o painel de recursos. Aba História: cada caixa de texto, a aparência, aliados e símbolo, outras características, idiomas e notas. As props que descem às seções ganharam identidade estável (`rolador`, `ordem`, `abrirEditor`, `fecharEditor`, `luz`, `pedirImagem` da `Mesa`).
- **Balão da dica só quando aparece.** `BotaoComDica` monta o `Dica` (portal no `body`) só enquanto está visível. O nome fica no `aria-label` (quando o botão não traz o seu), o `aria-describedby` existe enquanto o balão existe e o botão desabilitado leva `aria-description` "Nome — motivo".
- **Contadores só no modo de teste:** `window.__rendersDaFicha` (renders por seção) e `window.__motivosDaFicha` (qual prop ou fatia fez a seção redesenhar), em `contarRender` e `anotarMotivo`.

### Como o texto livre vai à sala
Não mudou: cada tecla grava na hora na ficha da tela (`alterar`) e a `ficha.alterar` sai depois de 400 ms sem teclas (`ATRASO_DA_GRAVACAO_MS`), num lote só, com a operação do mesmo caminho substituindo a anterior. O eco da sala agora não redesenha as outras seções nem tira o cursor do lugar (teste no `q14.spec.ts`).

### Medição (antes × depois)
`pnpm --filter @tabletop/e2e medidas` (`MEDIDA_SO=B`), mesma cena pesada, 40 teclas (B1 a B4) ou 10 mudanças (B5 e B6); tempo de script em ms, mediana de 3 repetições; "seções" = quantas seções diferentes redesenharam. Antes: 22 seções redesenhavam a cada gesto (84 renders da janela em 40 teclas, 1.848 renders de seção).

| Cenário | `pnpm dev` | Produção | Seções que renderizam (antes → depois) |
|---|---|---|---|
| B1 40 teclas em Antecedente | 1.181 → 292 (−75%) | 129 → 53 (−59%) | 22 → 1 (Identidade) |
| B3 40 teclas num talento | 1.146 → 404 (−65%) | 127 → 62 (−51%) | 22 → 1 (Características) |
| B4 40 teclas no campo XP (número) | 1.073 → 266 (−75%) | 122 → 54 (−56%) | 22 → 1 (Identidade) |
| B5 10 mudanças de Força | 395 → 166 (−58%) | 37 → 24 (−35%) | 22 → 4 (Atributos, Salvaguardas, Perícias, Ataques) |
| B6 10 cliques de proficiência | 288 → 134 (−53%) | 38 → 25 (−34%) | 22 → 3 (Perícias, Salvaguardas, Ataques) |
| B2 40 teclas, com o compêndio | 973 → 282 (−71%) | 115 → 48 (−58%) | 22 → 1 |

Antes e depois rodaram na mesma máquina, em sequência, sem outro servidor de teste ao lado; a variação entre as 3 repetições foi de 1 a 19% (`var%` no JSON), então diferenças pequenas (B5 e B6 em produção) valem como ordem de grandeza. O que sobra no script de 40 teclas é a própria `JanelaDaFicha` (cabeçalho, abas, janela) e o React de desenvolvimento.

### Verificação
Ver `REDESIGN.md`, "Q14 — como ficou".

### Decisões
Ver `REDESIGN.md`, "Q14 — como ficou".

### Desvios
Nenhum E2E antigo foi alterado.

### Frágil
Ver `PASSAGEM.md`, "Q14".

### Roteiro manual
Ver `docs/ROTEIRO-DE-TESTES.md`, "Q14".

## Ajustes Q15 — Magias e NPC por seções; arrastar o token seguido desliga o seguir (entregue, aguardando o roteiro manual)

### O que foi entregue
- **Aba Magias por seções** (`secao()` do Q14): caixas de conjuração (atributo, CD, ataque), outras conjuradoras, barra "Classe de conjurador / Recuperar espaços", espaços de pacto, cada círculo, cada linha de magia e a Conjuração inata. Escrever na descrição de uma magia redesenha só a linha dela; o círculo só redesenha quando muda quem está nele (posição e nome), os espaços do nível dele para cima ou o que a conjuração calcula.
- **Ficha do NPC por seções**: cabeçalho, atributos, salvaguardas/perícias, resistências, sentidos, idiomas, desafio, traços, cada categoria de ações, "+ Reação/Lendária", cabeçalho da conjuração e "Recuperar espaços". Escrever num traço ou em Sentidos redesenha só aquela seção; Força redesenha Atributos, Salvaguardas/Perícias e as Ações (acerto e dano).
- **Arrastar o token seguido desliga o seguir** no primeiro passo do arrasto (token seguido ou seleção que o inclua, mestre ou jogador); clicar sem arrastar mantém; setas seguem; arrastar a cópia (Alt) ou um token que não é o seguido não desliga.
- Mecanismo novo em `secoes.tsx`: caminho `npc.<campo>` nas chaves, `props` aninhado comparado por dentro e a fatia livre `mudou(a, b)`. `PropsDaAba.fichaAtual()` (estável) e o contexto `PropsAoVivo`.

### Medição (antes × depois)
Mesma cena e script do Q14 (`MEDIDA_SO=D`, mediana de 3); "seções" = quantas seções diferentes redesenharam. Ficha do conjurador (30 magias) e Ogro da semente (com um traço, 12 magias e espaços).

| Cenário | `pnpm dev` (script ms) | Produção (script ms) | Seções (antes → depois) |
|---|---|---|---|
| D1 40 teclas na descrição de uma magia | 1.282 → 689 | 178 → 110 | todas as da aba → 1 (LinhaDeMagia) |
| D2 40 teclas em Classe de conjurador | 1.250 → 529 | 172 → 94 | todas → 1 (BarraDoConjurador) |
| D3 10 mudanças do atributo de conjuração | 657 → 645 | 51 → 61 | todas → 6 (as que dependem) |
| D4 10 gestos (preparada + espaço) | 624 → 251 | 58 → 40 | todas → 2 (Círculo, Linhas) |
| D5 40 teclas num traço do NPC | 771 → 451 | 91 → 75 | todo o bloco → 1 (NpcTracos) |
| D6 40 teclas em Sentidos do NPC | 685 → 408 | 87 → 73 | todo o bloco → 1 (NpcSentidos) |
| D7 10 mudanças de Força do NPC | 245 → 175 | 31 → 29 | todo o bloco → 3 |
| D8 conjuração do NPC (atributo + espaço) | 510 → 499 | 50 → 55 | todo → 4 |

(Antes, os contadores das seções novas não existiam: toda a aba/bloco redesenhava a cada gesto; as colunas "seções" do antes valem como "tudo".) D3, D7 e D8 não melhoram em tempo porque mudar um atributo legitimamente atualiza CD, chips e ataques de todas as linhas; a variação entre repetições foi de 5 a 50% (`var%`), então diferenças pequenas valem como ordem de grandeza.

### Verificação
`pnpm typecheck`, `pnpm lint`, `pnpm --filter @tabletop/web test` (279 testes, incluindo `secoes.test.ts`) e 114 testes E2E (ficha, NPC, magias, conjurar, compêndio, dicas, q12, q13, q14, janela própria, sala e o novo `q15.spec.ts`), tudo verde, sem repetição. Não mexe em `packages/shared` nem em `apps/server`: sem `pnpm verify` completo.

### Decisões
Ver `REDESIGN.md`, "Q15 — como ficou". Desvios: nenhum E2E antigo alterado.

### Frágil
Ver `PASSAGEM.md`, "Q15".

### Roteiro manual
Ver `docs/ROTEIRO-DE-TESTES.md` (não alterado neste lote): digitar numa magia e num traço do NPC; mudar um atributo; arrastar o token seguido.

## Ajustes Q16 — O MCP faz tudo o que a tela faz, campo por campo (entregue, aguardando o roteiro manual)

### O que foi entregue
Auditoria campo a campo das intenções com ferramenta, a trava de teste e as lacunas fechadas: `rolar.conjurar`, `fichas.campos`, usos `aparencia` e `simbolo` do `arquivos`, `tokens.controladoPor`, som por nome nas zonas e reações. Detalhes em `REDESIGN.md`, "Q16 — como ficou", e em `docs/MCP.md`, "A paridade campo a campo".

### Como rodar
`pnpm --filter @tabletop/shared test` (a trava campo a campo está em `mcp/paridadeCampos.test.ts`; a preparação completa em `mcp/q16.test.ts`).

### Verificação
Ver `REDESIGN.md`, "Q16 — como ficou". Os resultados do lote estão no relatório de entrega.

### Decisões
Ver `REDESIGN.md`, "Q16 — como ficou".

### Desvios
Nenhum E2E antigo foi alterado.

### Frágil
Ver `PASSAGEM.md`, "Q16".

### Roteiro manual
Ver `docs/ROTEIRO-DE-TESTES.md`, "Q16".

## Ajustes CH1 — a chamada da mesa, voz e vídeo com fundo desfocado (entregue, aguardando o roteiro manual)

### O que foi entregue
A janela própria `/m/<id>/chamada` (botão "Chamada" no topo da mesa): antes de entrar, a janela larga (só a Grade, sem Palco por pedido do Vilella) e a estreita (linhas com miniatura). Segue o tema da mesa, ao vivo. Sinalização transitória pela sala (`chamada.*`), malha WebRTC ponto a ponto (limite de 8), áudio com volume por pessoa e quem fala, fundo desfocado com MediaPipe (modelo empacotado), "Trilha da mesa", "Chamar", contagem e ícone na mesa. Nada é gravado.

### Como rodar
`pnpm dev` e, na mesa, o botão de vídeo no topo. Para duas pessoas na mesma máquina, uma janela anônima como jogador. Internet: `VITE_CHAMADA_ICE_SERVERS` (JSON STUN/TURN) e HTTPS. E2E: `pnpm --filter @tabletop/e2e test tests/chamada.spec.ts` (Chromium com câmera e microfone falsos só neste arquivo).

### Verificação
`pnpm typecheck`, `pnpm lint`, `pnpm test` (shared 1347, server 140, web 295, mcp 19) e 520 testes E2E em duas metades (272 + 248), sem instáveis. Prints em Grimório 1600×900 e 1280×720 e Pergaminho 1600×900.

### Decisões
Ver `REDESIGN.md`, "CH1 — como ficou".

### Desvios
Nenhum E2E antigo alterado. Sem Palco e sem seletor de tema, por pedido do Vilella.

### Frágil
Ver `PASSAGEM.md`, "CH1".

### Roteiro manual
Ver `docs/ROTEIRO-DE-TESTES.md`, "CH1".

## Ajustes MU1 — a música da mesa (entregue, aguardando o roteiro manual)

### O que foi entregue
Biblioteca de música com etiquetas e energia (1 a 5), botões que guardam um filtro (etiquetas, faixa de energia, ordem aleatória sem repetir ou crescente), música que toca por cima dos ambientes, igual para todos (fila e semente na sala; cada navegador acha a música e o ponto pela soma das durações), pausar, próxima, anterior, "Voltar a <botão>" e volume. A mesa de som ganhou a seção Música com o divisor arrastável e o minimizar de cada lado (lembrados por navegador; horizontal nos modos verticais) e a aba Música na configuração ("Adicionar mp3", "Adicionar pasta" com subpastas viram etiquetas). O quadro "Trilha da mesa" da chamada mostra a música, com Pausar e Próxima para o mestre. Ferramenta `musica` no MCP. Limpeza do CH1 (preferência `disposicao`, props `noPalco` e `aoEscolher`). Ver `PROJETO.md` 4.16.

### Como rodar
`pnpm dev`; mesa de som, engrenagem, aba Música. E2E: `pnpm --filter @tabletop/e2e test tests/musica.spec.ts`.

### Verificação
`pnpm typecheck`, `pnpm lint`, `pnpm test` (shared 1371, server 140, web 298, mcp 19), E2E em duas metades uma depois da outra (260 + 261 passando; na metade 1 só os 3 testes que contavam 18 ferramentas falharam e foram corrigidos e rodados de novo), e prints em Grimório 1600×900 e 1280×720 e Pergaminho 1600×900.

### Decisões
Ver `REDESIGN.md`, "MU1 — como ficou". Mudança no protocolo (intenções `musica.*`, eventos `musica.bibliotecaAlterada` e `musica.tocandoAlterado`) sem migração de banco (duas chaves novas em `meta`).

### Desvios
E2E antigos alterados: `claude-12-2.spec.ts` e `claude-12-3.spec.ts` (a lista de ferramentas do mestre ganhou `musica`; 19 em vez de 18).

### Frágil
Ver `PASSAGEM.md`, "MU1".

### Roteiro manual
Ver `docs/ROTEIRO-DE-TESTES.md`, "MU1".

## Ajustes A1 — campos lado a lado sempre alinhados (entregue, aguardando o roteiro manual)

### O que foi entregue
Em `.linha-par` (painéis Mesa, Luz, Iluminação, Token, item, reação), `.linha-da-fase` e na grade da tela inicial, rótulo, caixa e ajuda de campos vizinhos ficam em linhas comuns (subgrid). "Morrendo abaixo de (%)" quebrando em duas linhas não derruba mais a caixa da direita.

### Como rodar
`pnpm dev`; aba Mesa, seção Regras, e estreite o painel. E2E: `pnpm --filter @tabletop/e2e test tests/a1.spec.ts`.

### Verificação
Typecheck, lint, e os specs a1, organizacao, q5, teclado, tema, sala, inicio, luz, tochas e automacoes-editor. Prints em `scratchpad\prints-a1` (antes e depois).

### Decisões
Ver `REDESIGN.md`, "A1 — como ficou".

### Desvios
Nenhum E2E antigo alterado.

### Frágil
Ver `PASSAGEM.md`, "A1".

### Roteiro manual
Abrir Mesa → Regras e Luz, e as janelas de luz, token e reação, em larguras estreitas: as caixas do par têm o mesmo topo.

## Ajustes AU1 — automações por blocos (entregue, aguardando o roteiro manual)

### O que foi entregue
O pedido do Vilella: "programação por blocos (algo tipo um n8n)". Uma automação = gatilho + trilhas de blocos (esperar, se, sortear, para cada, ação, sinal); o fluxo é uma árvore arrumada sozinha. Motor de fluxos na sala (relógio, esperas no estado, sinais, limites), conversão automática do que existia (ciclos, reações, botões), lista nova ("Automações") e editor por blocos (peças em três cores, "+" nos encaixes, arrastar, campos do bloco, "Em português", erros no bloco, Testar agora, Desfazer, JSON, janela própria, teclado), ligações com o painel da zona e o editor de modelo, e o MCP que usa e explica (`fluxos`, `explicar`, `guia`, `listar`, `acionar`). Antes de trocar o motor foi gravado o "ouro" (`fixtures/ouro/chama-primordial-10min.json`): a Chama Primordial por 10 minutos simulados; o motor novo chega ao mesmo resultado (`ouro.test.ts`).

### Como rodar
`pnpm dev`; botão Automações da barra de cima. Importar `fixtures/campanhas/chama-primordial.json` mostra as 5 automações convertidas. E2E: `pnpm --filter @tabletop/e2e test tests/au1.spec.ts tests/automacoes.spec.ts`.

### Verificação
Ver o relatório do lote (typecheck, lint, unidade, E2E em duas metades). Prints em `scratchpad\prints-au1`.

### Decisões
Ver `REDESIGN.md`, "AU1 — como ficou", e `PROJETO.md` 4.11 e 4.12.

### Desvios
E2E: `automacoes.spec.ts` reescrito para fluxos; `automacoes-editor.spec.ts` removido (testava os formulários antigos; o `au1.spec.ts` cobre a tela nova); `q8`, `som-n5`, `zonas`, `claude-12-1`, `12-2` e `12-3` trocaram as intenções e os testids antigos pelos novos. Print `7b3.spec.ts` removido (tela antiga).

### Frágil
Ver `PASSAGEM.md`, "AU1".

### Roteiro manual
Ver `docs/ROTEIRO-DE-TESTES.md`, "AU1".

## Ajustes MU2 — a mesa de som em duas abas (entregue, aguardando o roteiro manual)

### O que foi entregue
O divisor e o minimizar do MU1 saíram; no lugar, duas abas ("Efeitos e ambientes" e "Música") logo abaixo do cabeçalho da mesa de som, na faixa, na janela flutuante e na janela própria. Cada aba mostra o que toca nela e um ponto marca a aba escondida que toca; a aba escolhida é lembrada (`tabletop:pref:som-aba`). Nomes de efeitos e ambientes em até duas linhas, volume do ambiente dentro do cartão, lugar vazio de efeito só com "+", espaço entre ícone e texto nos botões.

### Como rodar
`pnpm dev`; abrir a mesa de som (faixa, janela ou janela própria) e trocar de aba. E2E: `pnpm --filter @tabletop/e2e test tests/musica.spec.ts`.

### Verificação
Typecheck, lint, unidade da web (298), e os specs musica, som-q4, som-q4b, chamada, a1, organizacao e sala, um por vez (portas 8792 e 5178). Prints em `scratchpad\prints-mu2` (Grimório e Pergaminho, 1366×768 e 1280×720). Sem `pnpm verify` completo (lote só de tela).

### Decisões
Ver `REDESIGN.md`, "MU2 — como ficou". A faixa ficou 40 px mais alta (a barra de abas).

### Desvios
- E2E antigos alterados em `musica.spec.ts`: os dois testes do divisor e do minimizar saíram (não existem mais) e viraram testes das abas, das três formas e do transbordo de texto; os dois primeiros testes passaram a abrir a aba Música antes de usar os botões.
- Saiu o print `e2e/prints/mu1.spec.ts` (mostrava o divisor); entrou `mu2.spec.ts`.

### Frágil
Ver `PASSAGEM.md`, "MU1" (a nota do MU2 sobre a barra de abas de 40 px).

### Roteiro manual
Ver `docs/ROTEIRO-DE-TESTES.md`, "MU1" (itens 10 e 11, agora das abas e dos textos).

## Ajustes MU3 — abas no seletor da ficha e o zoom acima da faixa (entregue, aguardando o roteiro manual)

### O que foi entregue
O seletor segmentado da ficha ("Personagem | NPC") virou componente (`SeletorSegmentado`) e passou a valer nas abas da mesa de som e da configuração dela, sem subtítulo. O zoom (e o selo de modo, o aviso do som e o aviso da importação) sobe para ficar acima da faixa da mesa de som.

### Como rodar
`pnpm dev`; abrir a mesa de som em faixa, arrastar a alça e recolher. E2E: `pnpm --filter @tabletop/e2e test tests/zoom-faixa-mu3.spec.ts`.

### Verificação
Typecheck, lint, unidade da web e os specs musica, zoom-faixa-mu3, som-q4, som-q4b, ficha (npc, v4b2, v8, n2, q11), a1, organizacao e sala, um por vez (portas 8792 e 5178). Prints em `scratchpad\prints-mu3`.

### Decisões
Ver `REDESIGN.md`, "MU3 — como ficou".

### Desvios
- `musica.spec.ts`: as asserções do subtítulo das abas viraram "não existe" e a checagem do estado passou para o `aria-label`.

### Frágil
Ver `PASSAGEM.md`, "MU3" (`--faixa-do-som` e os 46 px).

### Roteiro manual
Abrir a mesa de som em faixa, arrastar a alça e recolher: o zoom acompanha. Soltar em janela: o zoom volta ao pé.

## Próximo: o roteiro manual dos Lotes 12 (12-3 incluído), P1, N1, N2, N3a, N3b, N4, N5, M1, M2, Q1 a Q16, CH1, MU1, MU2, MU3, A1, AU1 e das otimizações O1–O4
