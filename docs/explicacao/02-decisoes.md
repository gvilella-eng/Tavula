# As decisões do Távola

Este arquivo reúne as decisões de produto e técnicas do projeto, agrupadas por tema. Cada uma diz **o quê**, **por quê**,
**onde aparece no código**, **quando** foi tomada e **se ainda vale** (ou o que a trocou). Não explica o funcionamento
interno de cada área: para isso há os arquivos 03 a 12, apontados em cada tema.

**Como ler a coluna "quando".** Datas são de 2026 (formato AAAA-MM-DD). Os códigos são os lotes do projeto:
`R1`–`R6` (o redesign), `V1`–`V14` (ajustes que o Vilella pediu depois de usar a mesa), `C1`–`C4` (mesas e contas),
`N1`–`N5`, `Q1`–`Q16`, `M1`/`M2`, `AU1`–`AU3` (automações), `CH1`–`CH3` (chamada), `MU1`–`MU3` (música), `FG1`/`FG2`
(fogo), `AS1` (assets), e os lotes numerados `0`–`14`, `7b` e `12` do plano original (ver [12](12-testes-e-fluxo-de-trabalho.md)).

**Situação.** *Vale* = está no código como dito (conferido). *Trocada* = outra decisão a substituiu (diz qual).
*Descartada* = foi proposta e recusada. *Em aberto* = ainda sem resposta. Onde o documento e o código discordam, vale o
código e a divergência está anotada na decisão.

Índice: [1 Produto](#1-produto-e-escopo) · [2 Stack](#2-arquitetura-e-stack) · [3 Sala e protocolo](#3-sala-protocolo-e-sincronização)
· [4 Sigilo](#4-sigilo-e-anti-trapaça) · [5 Arquivos](#5-arquivos-e-assets) · [6 Mapa, luz e visão](#6-mapa-paredes-luz-e-visão)
· [7 Tempo e luz](#7-tempo-da-sala-e-objetos-de-luz) · [8 Automações](#8-automações) · [9 Mesas e contas](#9-mesas-contas-e-segurança)
· [10 MCP](#10-mcp-e-o-claude) · [11 Regras](#11-ficha-compêndio-dados-e-combate) · [12 Chamada e som](#12-chamada-som-e-música)
· [13 Interface](#13-interface-e-temas) · [14 Trabalho](#14-fluxo-de-trabalho-e-testes) · [15 Descartadas](#15-o-que-foi-descartado) · [16 Em aberto](#16-em-aberto)

---

## 1. Produto e escopo

### 1.1 Uma mesa para um grupo, não um produto
- **O quê.** O Távola serve a um grupo fixo de até 8 pessoas (o mestre e amigos). Sem marketplace, sem módulos de terceiros,
  sem outros sistemas além de D&D 5e, sem app mobile como alvo.
- **Por quê.** Foi o pedido inicial: uma mesa própria que corrige o que incomoda nas mesas virtuais de assinatura (assinatura, limite de
  armazenamento, ficha presa) e no Foundry (rede). O escopo pequeno deixa cada decisão simples.
- **Onde.** `PROJETO.md` seções 1 e 2. No código aparece em limites: 12 vagas de jogador, 8 pessoas na chamada
  (`MAXIMO_NA_CHAMADA` em `packages/shared/src/chamada.ts`).
- **Quando.** Plano inicial (2026-11-04).
- **Situação.** Vale.

### 1.2 Tudo local, feito como se fosse para a internet
- **O quê.** Nada vai para servidor remoto e o app não acessa a internet em execução. Mas o código é escrito *como se um
  dia os jogadores entrassem pela internet*: contas com senha, sessões, limites de tentativa, `Origin`, segredos em hash.
- **Por quê.** Decisão do Vilella em 2026-11-11 e 2026-11-12 ao planejar as contas: "tudo fica local, nada vai para
  servidor"; mas um atalho inseguro "porque é local" teria de ser reescrito depois. Ver [04](04-contas-e-seguranca.md).
- **Onde.** `PROJETO.md` 2, 4.14; `apps/server/src/autenticacao.ts`, `origem.ts`, `contas.ts`; o modo de teste (`MODO=teste`)
  é o único que liga atalhos de desenvolvimento.
- **Quando.** 2026-11-04 (regra de rede); 2026-11-12 (C2/C3, a aplicação mais forte da regra).
- **Situação.** Vale. O limite do plano grátis do Cloudflare também é respeitado de antemão (arrastar token manda no
  máximo 20 atualizações por segundo; `PROJETO.md` 4.5), para o deploy futuro não exigir reescrita.

### 1.3 A mesa é genérica; a campanha é conteúdo
- **O quê.** Nenhuma regra de uma campanha específica no código. Duração de tocha, limites, efeitos e ciclos são
  configuração do mestre (ou da IA via MCP). "A Chama Primordial" (tochas de 30 min reais, uma montanha que "respira") é
  só um arquivo de configuração e o teste de aceitação do motor.
- **Por quê.** O Vilella rejeitou explicitamente mecânicas de campanha no código; se uma campanha precisa de um `if`,
  falta configuração. Isso também tornou o motor de automações algo geral (ver tema 8).
- **Onde.** `fixtures/campanhas/5e-padrao.json`; a Chama Primordial e o ouro dela em `privado/` (fora do git) e
  `packages/shared/src/ouro.test.ts` (o motor tem de reproduzir a campanha); princípio 9 em `PROJETO.md` 3.1.
- **Quando.** 2026-11-04 (decisão); 2026-11-19 (o teste "ouro" passa a vigiar a conversão do AU1).
- **Situação.** Vale. O "padrão" é o **5e**: a mesa nova nasce com modelos de luz e regras iguais ao `5e-padrao.json`
  (um teste de unidade garante, Q1, 2026-11-16).

### 1.4 Regras de 2014 (SRD 5.1)
- **O quê.** O conteúdo de D&D é o SRD 5.1 (regras de 2014, CC-BY-4.0). A ficha de referência (Darion) é a ficha 5e de
  2014 impressa.
- **Por quê.** É a licença livre e bate com as fichas dos jogadores.
- **Onde.** `packages/shared/src/srd/` (com `ATRIBUICAO-SRD.md`), `fixtures/compendio/exemplo-srd.json`.
- **Quando.** 2026-11-04.
- **Situação.** Vale. O compêndio de livros é arquivo do mestre, nunca vai para o repositório (ver 11.5).

### 1.5 Nome Távola e identidade Grimório
- **O quê.** O projeto se chama Távola (antes "Tabletop"); a identidade principal é o tema Grimório (carvão e latão),
  com as fontes Space Grotesk e Inter. Os identificadores técnicos (`@tabletop/*`, chaves `tabletop:*` do navegador)
  **continuam "tabletop"**.
- **Por quê.** O Vilella escolheu entre Lume e Távola em 2026-11-10 (um símbolo de mesa redonda com uma chama no
  centro, que guarda o "lume"). Os identificadores ficaram para não quebrar campanhas exportadas nem preferências salvas.
- **Onde.** `apps/web/src/Logo.tsx`, `public/favicon.svg`, `apps/web/src/tema/temas.ts`; `docs/REDESIGN.md` "Decidido (2026-11-10)".
- **Quando.** 2026-11-10 (R1).
- **Situação.** Vale. Há uma mistura intencional: o nome visível é Távola e o técnico é `tabletop`.

---

## 2. Arquitetura e stack

### 2.1 TypeScript em tudo, com o núcleo em `packages/shared`
- **O quê.** Front, servidor e MCP escritos em TypeScript; regras, geometria, motor e parsers vivem num pacote sem DOM.
- **Por quê.** Os tipos do protocolo e as regras são escritos uma vez e usados nos dois lados; a lógica pura é testável
  sem navegador.
- **Onde.** `packages/shared/src/index.ts` e `@tabletop/shared/mcp` (`src/mcp/index.ts`).
- **Quando.** Lote 0 (2026-11-04).
- **Situação.** Vale. Regra de trabalho: toda lógica de regra entra em `shared`, pura e testada.

### 2.2 React + Vite, PixiJS v8
- **O quê.** Interface em React 19 com Vite; o mapa em PixiJS v8.
- **Por quê.** React pelo ecossistema para fichas, chat e painéis; PixiJS é o motor do Foundry e aguenta dezenas de luzes
  com filtros, sem shader próprio (os blends `erase`, `add`, `multiply` e `saturation` bastam).
- **Onde.** `apps/web/package.json`; `apps/web/src/mapa/`.
- **Quando.** Lote 0; Lote 6 (como a luz foi desenhada).
- **Situação.** Vale.

### 2.3 Servidor: Cloudflare Worker + Durable Object, rodando local com `wrangler dev`
- **O quê.** Uma mesa é um Durable Object `Sala` com SQLite próprio. Local, roda no `workerd` pela porta 8787, sem conta e
  sem internet.
- **Por quê.** Um Durable Object é "uma sala com estado e banco": o formato exato de uma mesa; com a Hibernation API a sala
  sai da memória com os sockets abertos. Usar o mesmo runtime local e na nuvem evita reescrita.
- **Onde.** `apps/server/wrangler.jsonc` (classes `Sala`, migração `v1`, e `Diretorio`, migração `v2`), `src/sala.ts`.
- **Quando.** Lote 0; o `Diretorio` entrou no C1 (2026-11-12).
- **Situação.** Vale. Consequência técnica: o estado em memória é só cache do SQLite, e quem é cada socket fica no
  `serializeAttachment` (ver [03](03-sala-e-sincronizacao.md)).

### 2.4 zod no pacote compartilhado
- **O quê.** Toda mensagem tem schema zod validado nos dois lados.
- **Por quê.** Segurança e tipos num só lugar. **Decidido não fazer**: tirar a validação no navegador (ela aplica os
  valores padrão; sem ela os dados mudariam de forma). Fonte: `docs/IDEIAS.md`, auditoria de desempenho de 2026-11-17.
- **Onde.** `packages/shared/src/protocolo.ts`, `estado.ts`.
- **Situação.** Vale.

### 2.5 Persistência sem migração de banco sempre que der
- **O quê.** Dado novo vai para a tabela `meta` ou `entidades` (JSON) ou como campo opcional do JSON do estado; migrações
  SQL só acrescentam e são idempotentes. "Código pela metade roda no banco real do Vilella", então migração nova sempre,
  nunca editar uma que já rodou.
- **Por quê.** O Vilella roda `pnpm dev` com hot reload sobre o banco real; um erro numa migração quebraria a campanha dele.
- **Onde.** `apps/server/src/armazenamento.ts` (`MIGRACOES`); `wrangler.jsonc` ("a v1 nunca muda").
- **Situação.** Vale. A exportação tem versão (hoje 13, `VERSAO_EXPORTACAO` em `protocolo.ts`) e as antigas continuam importáveis.

### 2.6 pnpm workspaces, Vitest e Playwright
- **O quê.** Monorepo com `apps/web`, `apps/server`, `apps/mcp`, `packages/shared` e `e2e`; um `pnpm verify` roda tudo.
- **Por quê.** Cada contexto do Playwright tem armazenamento isolado, como se fosse outro PC: simula vários jogadores.
- **Onde.** `pnpm-workspace.yaml`, `package.json` (script `verify`).
- **Situação.** Vale. Ver tema 14.

---

## 3. Sala, protocolo e sincronização

*(Funcionamento em [03 — Sala e sincronização](03-sala-e-sincronizacao.md).)*

### 3.1 O servidor manda: intenções e eventos
- **O quê.** O cliente só envia intenções; a sala valida pelo papel e a capacidade, aplica e difunde eventos. Ninguém altera o estado.
- **Por quê.** É a base da segurança e da sincronização: uma verdade só.
- **Onde.** `processar` e `reduzir` em `packages/shared/src/nucleo.ts`; `tratarIntencao` em `apps/server/src/sala.ts`.
- **Quando.** Lote 1.
- **Situação.** Vale. O MCP usa a mesma função (`tratarIntencao`), não há caminho paralelo (12-3).

### 3.2 Permissão por capacidade
- **O quê.** Toda intenção declara uma capacidade nomeada. Algumas o mestre liga ou desliga para jogadores (por mesa e por
  pessoa); outras são só do mestre.
- **Por quê.** Dá ao mestre o controle sem criar papéis novos; "ficha visível para os outros" virou `ficha.verOutras` por mesa.
- **Onde.** `packages/shared/src/capacidades.ts` (`CAPACIDADES_DELEGAVEIS`, `CAPACIDADES_DO_MESTRE`, `PERMISSOES_PADRAO`).
- **Quando.** Lote 1; capacidades novas ao longo do tempo (`mapa.pingar` no V12, `personagem.criarProprio` no 12-1,
  `equipamento.dar` no FG1, `imagem.colocar` no AS1).
- **Situação.** Vale, com uma ressalva: a capacidade `nota.editar` ainda existe e vale por padrão, embora o V3 tenha
  tirado a "Nota da mesa" da tela; `docs/PERGUNTAS.md` registra que "sai de vez num lote futuro". Padrões que o Vilella
  decidiu: `personagem.criarProprio` e `equipamento.dar` ligadas; `imagem.colocar` **desligada**.

### 3.3 Snapshot filtrado e depois só eventos; `seq` global
- **O quê.** Ao conectar, o cliente recebe um snapshot já filtrado; depois só eventos numerados. O jogador vê saltos no
  `seq` (a sala filtra), o que é aceito.
- **Por quê.** Simplicidade e reconexão barata.
- **Onde.** `visaoPara` e `eventoPara` em `nucleo.ts`.
- **Situação.** Vale.

### 3.4 Movimento ao vivo é transitório
- **O quê.** `token.mover` não é gravado, só `token.soltar`; sai no máximo a 20 por segundo e a sala repassa
  `token.movendo` só a quem vê o token. O ping (V12), o desenho em andamento e a chamada também são efêmeros.
- **Por quê.** Orçamento do plano grátis: cada 20 mensagens recebidas contam 1 requisição.
- **Onde.** `PROJETO.md` 4.2 e 4.5; `apps/web/src/mapa/mapaPixi.ts`.
- **Situação.** Vale (o limite de 20/s vem do `PROJETO.md`; não o localizei como constante).

### 3.5 Gravações agrupadas
- **O quê.** Token só grava ao soltar; ficha agrupada (no máximo 1 gravação por segundo por ficha); névoa a cada poucos
  segundos por jogador. Chat e rolagens não entram na exportação da campanha.
- **Por quê.** Menos linhas gravadas; chat fora da exportação foi uma suposição do lote 8.
- **Onde.** `apps/server/src/armazenamento.ts`; `PROJETO.md` 4.4.
- **Situação.** Vale.

### 3.6 Exportar e importar a campanha em JSON, sem imagens
- **O quê.** O mestre exporta o estado inteiro (menos arquivos, contas, sessões, tokens do Claude e o que toca agora) e
  importa em outra instalação; a importação mantém as contas da mesa.
- **Por quê.** Backup e levar a campanha. Imagens são locais (tema 5), então só vão as metas.
- **Onde.** `VERSAO_EXPORTACAO` (13); `resumoDaCampanha.ts` na web.
- **Situação.** Vale.

### 3.7 Desfazer do Claude, não do usuário
- **O quê.** A sala anota o inverso de cada mudança do Claude num diário (50 lotes por usuário). O usuário comum não tem
  "Desfazer" geral.
- **Por quê.** Quem muda muito por prompt precisa de rede de segurança. Em 2026-11-16 o Vilella decidiu tirar a lista
  "O que o Claude fez" de Preferências: os rascunhos já bastam; o MCP ainda desfaz quando pedirem (`claude.desfazer`).
- **Onde.** `packages/shared/src/desfazer.ts`; `apps/web/src/claude/RascunhosDoClaude.tsx`.
- **Situação.** Vale (a lista de Preferências foi trocada pelos rascunhos).

---

## 4. Sigilo e anti-trapaça

*(Detalhes em [03](03-sala-e-sincronizacao.md) e [05](05-mapa-luz-e-visao.md).)*

### 4.1 A sala filtra o que o mestre esconde de propósito
- **O quê.** Token oculto, camada do mestre, outra cena, pasta fechada, nota do mestre, automações, zonas, biblioteca de
  música e rascunhos do Claude **nunca chegam** ao navegador do jogador. Quando um token deixa de ser visível chega só
  `token.sumiu { id }`; pedido sobre token invisível responde como "não existe".
- **Por quê.** Com o F12 aberto ninguém descobre o goblin que o mestre escondeu.
- **Onde.** `tokenVisivelPara` em `packages/shared/src/mapa.ts` (cena ativa, camada `tokens` ou `mapa`, não oculto, não
  rascunho); `visaoPara` em `nucleo.ts` remove `automacoes`, `zonas`, `efeitos`, `mesaDeSom`, `musica`, `assets`...
- **Quando.** Lotes 1–4; estendido a cada dado secreto novo. Todo lote com dado secreto inclui um teste E2E que inspeciona
  os frames do jogador (regra de trabalho).
- **Situação.** Vale.

### 4.2 Visão e escuridão são só de tela (sem proteção cara)
- **O quê.** Um token que só está no escuro, ou sob a névoa pintada, chega ao navegador do jogador e simplesmente não é
  desenhado. A sala não calcula a visão de cada jogador.
- **Por quê.** Vilella, 2026-11-06: "o pessoal quer jogar; quem fuçar o F12 estraga a própria diversão". Não vale o custo
  de servidor nem de desenvolvimento. Para esconder de verdade o mestre marca o token como oculto.
- **Onde.** `visaoPara` não consulta visão; ver `tokenVisivelPara`. A névoa (N4): "não é segredo".
- **Situação.** Vale. Está na lista do que **não propor de novo** (tema 15).

### 4.3 O mapa da cena ativa fica no cache do jogador
- **O quê.** A imagem do mapa da cena ativa vai para o cache do jogador, como em qualquer VTT.
- **Por quê.** A proteção cobre "quem está onde", não o desenho das salas. Mandar o mapa só conforme a exploração
  ("mapa revelado aos poucos") foi **descartado** em 2026-11-14.
- **Onde.** `docs/IDEIAS.md` "Descartadas".
- **Situação.** Vale.

### 4.4 Pré-envio cifrado de cena
- **O quê.** O mestre pode preparar uma cena enquanto o grupo está em outra: o pré-envio vai cifrado (AES-GCM, uma chave por
  asset); a sala entrega a chave só do que o jogador passa a ver ao levar o grupo.
- **Por quê.** Trocar de cena instantaneamente sem vazar o que o jogador ainda não pode ver.
- **Onde.** `packages/shared/src/cifra.ts`; tipo de asset `cifrado`.
- **Quando.** Lote 4 (2026-11-05/06).
- **Situação.** Vale no código (`cifra.ts` existe). O `PROJETO.md` 4.17 ainda chama os cifrados de "pedaços internos".

---

## 5. Arquivos e assets

*(Funcionamento em [07](07-arquivos-e-assets.md).)*

### 5.1 Imagens locais: o servidor não guarda imagem
- **O quê.** Mapas, tokens, retratos, sons e o compêndio ficam no computador de quem os tem; viajam em pedaços entre os
  navegadores, repassados pela sala, que não grava.
- **Por quê.** É a premissa que diferencia o projeto (Vilella): sem limite de armazenamento de servidor, sem custo.
- **Onde.** `packages/shared/src/assets.ts`, `envios.ts`; `apps/server/src/transferencias.ts`; `apps/web/src/assets/`.
- **Quando.** 2026-11-04; Lote 3.
- **Situação.** Vale. Proposta de guardar no servidor (R2): **descartada** (tema 15).

### 5.2 Identidade por conteúdo (SHA-256) e manifesto por pedaço
- **O quê.** O asset é o hash do arquivo (depois do processamento). O manifesto leva o hash de cada pedaço de 256 KB:
  pedaço corrompido é detectado na hora; o hash do arquivo confere no fim.
- **Por quê.** Reconhecer arquivo movido ou renomeado e retomar transferências.
- **Onde.** `assets.ts`; frame binário `[tipo][32 bytes hash][índice][total][dados]`.
- **Quando.** Lote 3.
- **Situação.** Vale.

### 5.3 Só entra na sala o que alguém usa
- **O quê.** A pasta nunca é enviada nem listada; só o arquivo usado (mapa de cena, imagem de token, retrato) é registrado.
  Limites: 30 MB por arquivo, 64 tiles e 200 MB por mapa, 2000 assets na sala.
- **Por quê.** Evita travar a sala e preserva a privacidade da pasta.
- **Onde.** `assets.ts` (limites), `validarMeta` em `seguranca.ts`.
- **Situação.** Vale.

### 5.4 Cópia dos arquivos da mesa na pasta do mestre
- **O quê.** O mestre, com a pasta liberada para escrita, guarda `arquivos-da-mesa/<hash>` de tudo que entra no cache.
- **Por quê.** Cenário do Vilella (Q1, 2026-11-16): um segundo navegador dele, com a mesma pasta, carregava nada com o
  primeiro offline.
- **Onde.** `apps/web/src/assets/gerente.ts`; `docs/ARQUIVOS.md`.
- **Situação.** Vale.

### 5.5 Assets da mesa e segurança dos arquivos (AS1)
- **O quê.** Arrastar imagem ou gif para o mapa vira uma imagem solta na cena; "Assets da mesa" lista tudo; os arquivos
  de jogador são decodificados e regravados pelo mestre; o tipo vem dos **bytes**, nunca do nome; lista fechada de
  formatos; nome em disco montado pelo Távola.
- **Por quê.** Vilella perguntou se um jogador consegue pôr vírus no PC do mestre por um png (2026-11-20). A regra não confia em nome
  nem em tipo declarado.
- **Onde.** `packages/shared/src/seguranca.ts` (`detectarFormato`, `conferirArquivoRecebido`, `nomeDeArquivoNoDisco`),
  `Token.imagem` em `estado.ts`, intenções `imagem.colocar` e `imagem.ajustar`.
- **Quando.** 2026-11-20.
- **Situação.** Vale. A imagem solta é um **token sem ficha** (herda camadas, ocultar, desfazer e exportação, sem coleção
  nova). **Decidido não fazer**: reabrir o arquivo original do disco do jogador; o cache cobre o "subi e ainda está aqui".

### 5.6 Compêndio como asset do mestre
- **O quê.** O compêndio é arquivo do mestre (`compendio/*.json`), registrado como asset único (até 16 MB) e distribuído
  como os outros. Nenhum texto de livro no repositório.
- **Por quê.** Direitos autorais; premissa das imagens locais.
- **Onde.** `packages/shared/src/compendio.ts`, `compendioSecoes.ts`; `fixtures/compendio/exemplo-srd.json` (3 magias do SRD).
- **Quando.** Lote 14 (2026-11-06); N3a (monstros e itens, 2026-11-14).
- **Situação.** Vale.

---

## 6. Mapa, paredes, luz e visão

*(Funcionamento em [05](05-mapa-luz-e-visao.md).)*

### 6.1 Escuro como véu apagado, sem máscaras do Pixi
- **O quê.** A escuridão é um véu numa `RenderTexture` com os polígonos de visão "apagados" (blend `erase`); a memória do
  mapa reaproveita o mesmo véu.
- **Por quê.** Máscaras do Pixi somam sobreposições; o pipeline de blends é mais previsível.
- **Onde.** `apps/web/src/mapa/camadaDeLuz.ts`, `mapaPixi.ts`.
- **Quando.** Lotes 5 e 6.
- **Situação.** Vale.

### 6.2 Memória do mapa no navegador, não na sala
- **O quê.** O que o token já viu fica numa grade de 0,5 m no IndexedDB por mesa, usuário e cena (a mesa entrou na chave no C2). A sala guarda só uma versão de
  "esquecer" por cena.
- **Por quê.** Zero custo de servidor. **Trocada**: o plano original gravava a névoa explorada na sala; o Lote 6 a trocou
  pela memória local.
- **Onde.** `apps/web/src/mapa/memoriaLocal.ts`, `packages/shared/src/memoria.ts`.
- **Situação.** Vale. A lembrança desbota e some além de 50 ft + 10 ft × mod. de Inteligência (15 m + 3 m × mod), configurável.

### 6.3 Paredes com tipos, encaixe em meia célula e arcos
- **O quê.** Tipos: parede, porta (aberta, fechada, trancada), janela, secreta (para o jogador é parede) e invisível. Encaixe na
  rede de meia célula (Alt solta); `Parede.meio` guarda o ponto do arco, que `segmentosDaParede` quebra em segmentos de ~10°.
- **Por quê.** O desenho à mão de mapas orgânicos é o custo escondido de cada sessão. Os arcos vieram do V5 (pedido do
  Vilella, referência do SolidWorks).
- **Onde.** `packages/shared/src/paredes.ts` (`segmentosDaParede`, `encaixarMeiaCelula`, `meioDoArcoTangente`).
- **Quando.** Lote 5; V5 (2026-11-12).
- **Situação.** Vale.

### 6.4 O jogador não vê os contornos das paredes
- **O quê.** A linha de parede, janela e porta não aparece ao jogador, salvo se a cena marcar `mostrarParedesAosJogadores`.
  Ele continua abrindo a porta pelo clique no lugar dela. O mestre vê os contornos com a Visão do mestre ligada.
- **Por quê.** Só desenho: a visão, a luz e o bloqueio usam as paredes como sempre (V5).
- **Onde.** `Cena.mostrarParedesAosJogadores` em `estado.ts`.
- **Situação.** Vale.

### 6.5 Visão do mestre só da tela dele
- **O quê.** O mestre vê o mapa inteiro, com ou sem visão noturna, e pode "ver como o jogador X". Nada disso vai à sala.
- **Por quê.** Vilella, 2026-11-06. Em 2026-11-10: a área que o jogador vê só com visão no escuro aparece em cor normal
  para o mestre (o cinza é só da tela do jogador). V5 (2026-11-12): "visão noturna" virou "Visão do mestre", que liga junto os contornos.
  FG2 (2026-11-20): a Visão do mestre passou a desenhar as luzes com a **mesma cor** que o jogador vê.
- **Onde.** `mapaPixi.ts` (modo `noturna`).
- **Situação.** Vale.

### 6.6 Cena como cartão
- **O quê.** `Cena.cartao`: uma imagem de fundo ou mapa de cidade, todos veem inteira, sem névoa nem limite de visão. Paredes e
  luz ficam guardadas.
- **Por quê.** Pedido do Vilella (V10c, 2026-11-13).
- **Onde.** `estado.ts` (`cartao`), a sala não manda paredes ao jogador numa cena-cartão.
- **Situação.** Vale.

### 6.7 Névoa: automática e também pintada à mão
- **O quê.** A névoa manual (N4) coexiste com a automática: uma lista de traços por cena (300 traços, 6.000 pontos),
  que vale por cima da luz.
- **Por quê.** **Trocada**: em 2026-11-10 a névoa era "só automática", a manual foi para as ideias; em 2026-11-14 o Vilella a
  pediu e virou o lote N4. O "mapa revelado aos poucos" segue descartado.
- **Onde.** `packages/shared/src/nevoa.ts` (`MAXIMO_DE_TRACOS_DA_NEVOA`), intenções `nevoa.tracar` e `nevoa.desfazer`.
- **Situação.** Vale.

### 6.8 Camadas e camada de desenho
- **O quê.** Camadas por cena: mapa, tokens, mestre e desenho. Todo desenho do pincel vai para a camada de desenho; a
  borracha e a seleção só atuam nela.
- **Por quê.** Nenhum jogador mexe nos tokens "limpando" desenho. Interface v2, Vilella, 2026-11-05.
- **Onde.** `apps/web/src/mapa/camadaDeDesenho.ts`, `packages/shared/src/desenho.ts`; capacidade `desenho.criar`.
- **Quando.** Lote 13; assumido: borracha apaga o desenho inteiro, formas não encaixam no grid.
- **Situação.** Vale.

### 6.9 Ping no mapa
- **O quê.** `mapa.ping`, com 1 ping a cada 0,5 s e 1 centralização a cada 3 s por usuário; efêmero.
- **Onde.** `packages/shared/src/ping.ts`.
- **Quando.** V12 (2026-11-13).
- **Situação.** Vale.

### 6.10 Importar mapa do Dungeondraft
- **O quê.** `.dd2vtt`, `.uvtt` e `.df2vtt` viram uma cena nova num pedido só (`cena.importarMapa`): imagem, paredes, portas e luzes.
- **Por quê.** Decisão do Vilella em 2026-11-16 ("fazer a importação").
- **Onde.** `packages/shared/src/importarUvtt.ts`.
- **Situação.** Vale. Limites: 3000 paredes, 200 luzes, 64 MB.

### 6.11 A porta abre a 2 quadrados, fixo
- **O quê.** O jogador abre ou fecha a porta com um token dele a até 2 quadrados do meio dela. Sem configuração; o `alcanceInteracaoM`
  da mesa vale só para tochas e pontos.
- **Por quê.** Decisão do Vilella no LP1 (2026-11-21): "a porta deixa 2 quadrados como padrão e é isso". Antes era uma constante em
  metros (1,5 m) que o doc do Lote 5 descrevia como se fosse a configuração da mesa.
- **Onde.** `ALCANCE_DA_PORTA_EM_QUADRADOS` e `alternarPortaDoJogador` (`packages/shared/src/paredes.ts`); as coordenadas da cena são
  em metros, então a conta usa o lado do quadrado da cena.
- **Situação.** Vale.

---

## 7. Tempo da sala e objetos de luz

### 7.1 O tempo é da sala
- **O quê.** Tochas, ciclos e esperas são contados pelo relógio da sala. O navegador só anima entre atualizações; um
  agendador único mantém o alarme do Durable Object no próximo vencimento.
- **Por quê.** Rejeitada pelo Vilella toda regra baseada no relógio do PC de um jogador. Um Durable Object só tem **um
  alarme por vez**, daí o agendador único.
- **Onde.** `apps/server/src/agendador.ts` (`Agendador`), `packages/shared/src/relogio.ts`.
- **Quando.** Lote 7 (2026-11-06).
- **Situação.** Vale.

### 7.2 O mestre decide o que o jogador vê do tempo
- **O quê.** `tempoParaJogadores`: exato, só o estágio (forte, fraca, morrendo) ou nada. Fora do modo exato, o número não sai
  da sala.
- **Por quê.** Pode ser um recurso de roleplay.
- **Onde.** `ConfigDaMesa.tempoParaJogadores` em `estado.ts` (padrão "exato"); `visaoPara` (`objetoParaVisao`).
- **Situação.** Vale. Estágios (assumido): forte acima de 50%, fraca até 50%, morrendo até 10%.

### 7.3 A mesa pausa sozinha quando o último mestre sai
- **O quê.** Sem mestre conectado, a mesa pausa depois de 5 s para as tochas não queimarem entre sessões. Retomar é do mestre.
- **Por quê.** Decisão do Vilella em 2026-11-10 (R2b); a espera de 5 s evita pausar num refresh.
- **Onde.** `ESPERA_DA_PAUSA_MS` e `pausarSeSemMestre` em `apps/server/src/sala.ts`.
- **Situação.** Vale (a espera de 5 s não está no `PROJETO.md`).

### 7.4 Zerar o relógio é um marco
- **O quê.** `relogio.marcoMs`: a pílula do topo mostra `tempoDaSala − marcoMs`; as tochas não mudam. Só o mestre vê.
- **Onde.** Intenção `mesa.zerarRelogio`.
- **Quando.** V1 (2026-11-11). Assumido: sem "marcar vários tempos".
- **Situação.** Vale.

### 7.5 Regras das tochas
- **O quê.** O mestre entrega e põe tochas de longe; o alcance vale para os jogadores (padrão 1,5 m). Cada personagem segura
  no máximo 2 objetos (`maosPorPersonagem`). A tocha apagada continua ocupando a mão. Apagar tira `penalidadeAoApagarS`.
- **Por quê.** Respostas do Vilella em 2026-11-10; as outras foram assumidas.
- **Onde.** `estado.ts` (`maosPorPersonagem: 2`, `alcanceInteracaoM: 1.5`), `tochas.ts`, `objetos.ts`.
- **Situação.** Vale. O `PROJETO.md` ainda lista "tocha apagada ocupa a mão" como em aberto, assumido.

### 7.6 Modelo ao vivo e fogo desenhado por código (FG1/FG2)
- **O quê.** Editar um modelo muda na hora todos os objetos dele. O fogo animado é gerado por código (canvas 2D) em
  `chamas.ts`; o jogador pode dar equipamento a si (`equipamento.dar`).
- **Por quê.** Pedidos do Vilella depois de usar a mesa (2026-11-20). Sem arquivo de terceiros nem internet.
- **Onde.** `apps/web/src/mapa/chamas.ts`; `modelo.editar`; asset `animacao` (até 4 MB).
- **Situação.** Vale. A luz **não** acompanha o tamanho da chama esticada (ideia pendente).

---

## 8. Automações

*(Funcionamento em [06](06-automacoes.md).)*

### 8.1 Ações de uma lista fechada, em JSON validado
- **O quê.** As automações usam ações de uma lista fechada (luz, objeto, visão, chat, som, token, zona), nunca código livre.
- **Por quê.** Seguro, testável com semente fixa e fácil para a IA gerar.
- **Onde.** `packages/shared/src/automacoesnucleo.ts` (motor), `fluxos.ts`.
- **Quando.** 7b-1 (2026-11-13).
- **Situação.** Vale.

### 8.2 Efeito temporário é modificador com prazo
- **O quê.** Valor final = base + modificadores ativos. O mesmo efeito de novo renova o prazo.
- **Por quê.** Efeitos sobrepostos, refresh e reconexão não deixam nada preso. A zona usa um modelo parecido: o efeito "enquanto dentro" é
  **reconciliado** (comparar o que deve valer com o que está lá) em vez de entrar e sair por evento.
- **Onde.** `ObjetoDeLuz.modificadores`, `Estado.efeitos`, `zonas.ts`.
- **Situação.** Vale.

### 8.3 Automações são dado do mestre
- **O quê.** A fatia `automacoes`, as zonas e os efeitos nunca chegam ao jogador; ele recebe só o resultado e os botões liberados.
- **Onde.** `visaoPara` / `eventoPara`.
- **Situação.** Vale.

### 8.4 Ciclos e reações viraram fluxos (AU1) e depois grafo (AU2)
- **O quê.** O formato antigo (ciclos com fases, reações, botões de evento) foi substituído em 2026-11-19 por fluxos de blocos
  (gatilho, trilhas) e, em 2026-11-20, por um **grafo** (nós e fios). A conversão automática preserva o que existia
  (`converterParaFluxos`, `arvoreParaGrafo`); o formato antigo fica em `Automacoes.legado`, só leitura.
- **Por quê.** Pedido do Vilella: um editor "como o n8n". O teste "ouro" garante que a Chama Primordial continua dando o mesmo resultado.
- **Onde.** `fluxosConversao.ts`, `fluxosGrafo.ts`, `ouro.test.ts`, `privado/fixtures/ouro/chama-primordial-10min.json`.
- **Situação.** **Trocada** duas vezes (ciclos/reações → blocos → grafo); vale o grafo. As intenções `ciclo.*`, `reacao.*` e `evento.disparar` deram lugar a `fluxo.*`.

### 8.5 O editor mora numa janela própria
- **O quê.** O editor abre numa janela do navegador (`/m/<id>/automacao/<fluxoId>`); a janela principal nunca o mostra.
- **Por quê.** O mestre precisa do mapa aberto enquanto desenha o fluxo; mesmo padrão da ficha e da mesa de som.
- **Onde.** `apps/web/src/automacoes/AutomacaoEmJanelaPropria.tsx`.
- **Situação.** Vale.

### 8.6 Portas lógicas viraram caixas E/OU/NÃO (AU3)
- **O quê.** As portas com fio foram trocadas por **caixas soltas na grade**, como os blocos do Scratch na vertical. A caixa E/OU nasce
  com 2 espaços e cresce (até 12), com o rótulo E/OU entre cada par; a NÃO tem um espaço; caixa dentro de caixa (até 4 níveis); vários
  gatilhos juntos são um OU.
- **Por quê.** Duas correções do Vilella em 2026-11-20: primeiro "caixa binária, não lista de portas", depois "ela cresce, mínimo 2".
  Ele quer lógica visual, não fios para tudo.
- **Onde.** `packages/shared/src/fluxosCaixas.ts`, `fluxos.ts` (tipo `caixa`, campos `em` e `espaco`); o tipo `porta` deixou de existir
  (o `preprocess` converte ao ler).
- **Situação.** **Trocada**: portas com fio (AU2) → caixas (AU3).

### 8.7 Cada automação tem no máximo um gatilho de relógio e um de botão
- **O quê.** Sem isso o chip da barra e o "Disparar agora" ficariam ambíguos.
- **Onde.** `fluxosValidar.ts` (`problemasDoFluxo`). Quando: AU2. Situação: vale.

### 8.8 Limites do motor
- **O quê.** Sinal encadeado até profundidade 5; 120 nós, 300 fios, 2000 nós por disparo; ciclo de fios só passando por um "esperar" de 1 s ou mais.
- **Por quê.** O corte vai ao registro do motor; é defesa contra laço infinito.
- **Situação.** Vale (valores do `PROJETO.md`).

### 8.9 O tour do centro de automações
- **O quê.** Tour na primeira vez, que monta "tochas com 30% de chance de apagar a cada 3 minutos" com a pessoa; só com conta;
  o passo das caixas é curto e sem nome de outro programa.
- **Por quê.** Vilella, 2026-11-20 tarde; o ajuste AU3c (2026-11-20) juntou os três passos das caixas num só e tirou o nome do
  Scratch ("não pode ter o nome scratch aqui, não precisa dessa quantidade de detalhes em lógica"). Regra geral desde então: texto
  que a pessoa lê na tela (e o do MCP) não cita outro programa.
- **Onde.** `apps/web/src/automacoes/passosDoTour.ts`. Situação: vale.

### 8.10 Zonas só do mestre
- **O quê.** Polígonos de 3 a 64 pontos; "dentro" é o centro do token; efeitos de luz, visão e som; gatilhos de entrada e saída.
- **Onde.** `packages/shared/src/zonas.ts`. Quando: 7b-2 (2026-11-13). Situação: vale.

### 8.11 "Cena ativa" em "Cenas onde vale" (AU4)
- **O quê.** A automação pode valer na cena onde o grupo está no instante do disparo (campo `naCenaAtiva`), somada às cenas
  marcadas (assumido: a união). O escopo é calculado no disparo e continua o mesmo depois de um "esperar" (assumido).
- **Por quê.** Vilella, 2026-11-20: "coloca a opção de cena ativa também". Sem ela, um relógio que apaga tochas sem cena marcada
  mexia nas tochas de todas as cenas, inclusive as de fundo.
- **Onde.** `escopoDoFluxo` em `packages/shared/src/automacoesnucleo.ts`; a caixa em `PainelDoBloco.tsx`. Quando: 2026-11-21.
  Situação: vale. Detalhes em [06 — Automações](06-automacoes.md).

---

## 9. Mesas, contas e segurança

*(Detalhes em [04](04-contas-e-seguranca.md).)*

### 9.1 Várias mesas no mesmo servidor, com diretório
- **O quê.** Um Durable Object `Diretorio` (único) lista as mesas; cada uma é uma `Sala` com `doNome = "mesa:" + id`. A mesa
  "legada" (a campanha anterior ao diretório) continua com o nome antigo `"campanha"`, sem copiar nada.
- **Por quê.** Pedido do Vilella (2026-11-11): tela inicial, criar mesa, id amigável.
- **Onde.** `apps/server/src/diretorio.ts`, `registroDeMesas.ts`; `wrangler.jsonc`.
- **Quando.** C1 (2026-11-12).
- **Situação.** Vale. Uma mesa nova nasce vazia (cena em branco e o mestre), com os modelos e regras do 5e padrão. A listagem pública
  (`GET /api/mesas`) só existe com `LISTAR_MESAS=1`, para na internet ninguém descobrir as mesas dos outros.

### 9.2 Id da mesa: 12 caracteres, alfabeto sem ambíguos
- **O quê.** `k7m2-qx9p-4tdn`: 12 de 31 símbolos (minúsculas e dígitos, sem `0 o 1 l i`), cerca de 59 bits, sorteados no navegador.
- **Por quê.** Decisão do Vilella (2026-11-11): fácil de ditar, difícil de adivinhar.
- **Onde.** `ALFABETO_DO_ID_DE_MESA` em `packages/shared/src/mesas.ts`. Situação: vale.

### 9.3 Toda entrada passa pelo mestre
- **O quê.** Não existe convite que dispense a aprovação nem link ligado a uma vaga.
- **Por quê.** Decisão do Vilella. O pedido nasce pendente e o mestre aceita ou recusa.
- **Onde.** `apps/server/src/contas.ts`; `membros.ts`. Quando: C2 (2026-11-12). Situação: vale.

### 9.4 A senha nunca sai do navegador
- **O quê.** O navegador estica a senha com PBKDF2-SHA256, 600.000 iterações; a sala guarda um sal aleatório e `SHA-256(sal || derivada)`.
  O login e o id da mesa entram no sal.
- **Por quê.** O servidor da internet teria CPU curta por requisição (10 ms no plano grátis): o estiramento caro fica no navegador.
- **Onde.** `ITERACOES_PBKDF2` e `derivarSenha` em `packages/shared/src/contas.ts`. Situação: vale.

### 9.5 Limite de tentativas e respostas iguais
- **O quê.** Por conta, 5 falhas bloqueiam por 1, 5, 15 e 60 minutos; por IP, 30 falhas em 15 minutos bloqueiam por 15. Login errado e
  login inexistente respondem igual.
- **Por quê.** Cinco caracteres de senha é pouco; ninguém descobre se um login existe.
- **Onde.** `apps/server/src/contas.ts`, `limitador.ts` em shared. Quando: C2. Situação: vale.

### 9.6 Sessão em cookie, `Origin` conferido
- **O quê.** Token de 32 bytes no cookie `tavola_sessao` (`HttpOnly`, `SameSite=Lax`, `Path=/api/m/<id>`), só o hash no banco; no
  WebSocket e em todo POST de `/api/` o `Origin` tem de ser o host do pedido.
- **Onde.** `apps/server/src/autenticacao.ts` (`NOME_DO_COOKIE`), `origem.ts`. Quando: C2/C3.
- **Situação.** Vale. O cookie `tabletop_sessao` (id do usuário em texto) só existe com `MODO=teste`.

### 9.7 Pasta do mestre com chave e código de recuperação
- **O quê.** A pasta guarda `tavola-mestre.json` com uma chave privada (ECDSA P-256); a sala só tem a pública. Recuperar a senha do
  mestre é por assinatura de desafio ou por um código de 20 caracteres mostrado uma vez.
- **Por quê.** Decisão do Vilella: o código além da pasta, para a pasta não ser o único caminho.
- **Onde.** `packages/shared/src/recuperacao.ts`, `apps/web/src/contas/pastaDoMestre.ts`. Quando: C3 (2026-11-12). Situação: vale.

### 9.8 Login no "portal Távola", não por mesa
- **O quê.** Decisão do Vilella em 2026-11-20: o login passa a ser em um portal só, não por mesa.
- **Por quê.** Uma conta só para várias mesas.
- **Situação.** **Em aberto**: ainda a pensar; **não implementar sem conversar**. Hoje as contas continuam por mesa.

### 9.9 Tour de introdução no primeiro acesso
- **O quê.** Mestre (10 passos) e jogador (6), com Pular; "já viu" é um 0/1 por conta no servidor (`contas.tour_visto`).
- **Por quê.** O Vilella achou as dicas no mouse demais ("tudo tem tooltip, tá um saco"); as dicas ficaram só nos botões só de ícone.
- **Onde.** `apps/web/src/tour/`, `textosDoTour.ts`. Quando: V3b e T (2026-11-11/12). Situação: vale.

---

## 10. MCP e o Claude

*(Funcionamento em [10](10-mcp.md).)*

### 10.1 O MCP é de todos, não só do mestre
- **O quê.** Cada usuário gera o próprio token em Preferências; o Claude entra **como esse usuário**, com as mesmas
  capacidades e a mesma visão. Um jogador cria a própria ficha por prompt.
- **Por quê.** Revisão do Vilella (2026-11-13). O token é `tvc_` + 43 caracteres, mostrado uma vez; a sala guarda só o SHA-256.
- **Onde.** `packages/shared/src/claude.ts` (lista de proibidos), tabela `tokens_claude`.
- **Situação.** Vale. O Claude nunca altera papéis, permissões, contas, importação ou exportação de campanha, nem vira provedor de arquivos.

### 10.2 É mais um cliente, não uma porta dos fundos
- **O quê.** O MCP usa as mesmas intenções, schemas e capacidades; a sala trata tudo em `tratarIntencao`.
- **Onde.** `apps/server/src/sala.ts` (`tratarIntencao`), `packages/shared/src/mcp/`. Quando: 12-1 a 12-3. Situação: vale.

### 10.3 O que o Claude cria entra como rascunho
- **O quê.** O que o Claude do mestre cria (cenas, fichas, tokens, zonas, automações...) fica invisível ao jogador até o mestre publicar.
- **Por quê.** O mestre revisa antes de o grupo ver. O Claude do mestre também pode publicar (assumido).
- **Onde.** `packages/shared/src/rascunhos.ts`, campo `rascunho`. Situação: vale.

### 10.4 Um comando só, por HTTP, na própria sala
- **O quê.** `claude mcp add --transport http ...` funciona em qualquer pasta, sem repositório, build nem Node. A rota é `POST /api/m/<id>/mcp`.
- **Por quê.** **Trocada**: o 12-2 (servidor local em stdio, `apps/mcp`) dependia do repositório e do build; o Vilella quer "colar e funcionar".
  O stdio continua só para o Claude Desktop.
- **Onde.** `apps/server/src/sala.ts` (rota MCP), `apps/web/src/claude/textosDoClaude.ts`. Quando: 12-3 (2026-11-13). Situação: vale o HTTP.

### 10.5 O MCP faz tudo o que a tela faz
- **O quê.** "O mestre não deve ter trabalho algum além de prompts." Toda intenção tem entrada na tabela de paridade
  (`paridade.ts`) e todo campo tem caminho em `paridadeCampos.ts`; um teste falha se faltar.
- **Por quê.** Pedido do Vilella (M2, 2026-11-14; Q16, 2026-11-18).
- **Onde.** `packages/shared/src/mcp/paridade.ts`. Fora do MCP, por serem gestos de tela: arrastar, pincel, chamada.
- **Situação.** Vale. O `PROJETO.md` e o `docs/MCP.md` já dizem o número de hoje: **19** ferramentas (`TODAS_AS_FERRAMENTAS`) e 150 intenções na paridade (123 com ferramenta e 27 de fora).

### 10.6 O Claude sobe arquivos por um caminho próprio
- **O quê.** A ferramenta `arquivos` devolve um link de envio de uso único (15 min) e a sala coloca os bytes numa caixa de entrada;
  o navegador do mestre processa pelo mesmo caminho do botão "subir".
- **Por quê.** Caso real (M1, 2026-11-14): um mapa de 16 MB gerado pelo Claude que o mestre teve de subir à mão.
- **Onde.** `apps/server/src/caixaDeEntrada.ts`. Situação: vale.

---

## 11. Ficha, compêndio, dados e combate

*(Funcionamento em [08](08-ficha-compendio-dados-e-combate.md).)*

### 11.1 Dados rolam na sala
- **O quê.** Quem sorteia é a sala; resultado enviado pelo cliente é ignorado. Rolagem oculta segue `dado.rolarOculto`.
- **Onde.** `packages/shared/src/dados.ts`, `rolagens.ts`. Situação: vale.

### 11.2 Ficha com valores base e derivados por fórmula
- **O quê.** A ficha guarda valores base; os modificadores, proficiências e a CD saem de fórmulas. Todo número rolável é clicável.
- **Onde.** `packages/shared/src/ficha.ts`. Quando: Lote 9. Situação: vale.

### 11.3 Ficha no desenho aprovado, com o tema
- **O quê.** A ficha segue protótipos aprovados (`docs/desenho/`), duas peles (Livro e Clássica) e **segue o tema**.
- **Por quê.** O primeiro V4a copiava a ficha impressa, em papel branco e foi recusado ("melhor, mas não tá top").
- **Onde.** `apps/web/src/ficha/`. Quando: V4a (2026-11-11). Situação: **trocada** (papel branco → desenho aprovado).

### 11.4 NPC é a mesma ficha, em bloco de monstro
- **O quê.** O NPC usa a ficha de personagem com `apresentacao: npc`, mostrada como bloco de monstro; as ações são `ataques`
  e os traços são `caracteristicas`. A Conjuração é a página da segunda fita (V8) e reaproveita os círculos do personagem (Q9).
- **Por quê.** Pedido do Vilella (V4b, 2026-11-12; Q9, 2026-11-16: "o menu de conjuração organizado como o do personagem").
- **Onde.** `apps/web/src/ficha/BlocoDoNpc.tsx`. Situação: vale. Sem migração: a ficha antiga carrega igual.

### 11.5 Compêndio por seções, com busca em português e inglês
- **O quê.** Seções Magias, Monstros (só o mestre), Itens mágicos, Armas e Itens; blocos recolhíveis (magias por nível, monstros por ND,
  itens por raridade); busca por nome sem acento em `nome` e `nomeOriginal`, com tolerância a erro de digitação.
- **Por quê.** Decisão do Vilella (2026-11-16). A tabela de `nomes-originais.json` fica fora do repositório.
- **Onde.** `compendioSecoes.ts`, `buscaDoCompendio.ts`. Quando: Q2 e Q6. Situação: vale.

### 11.6 Importar a ficha em PDF
- **O quê.** O jogador importa o PDF no navegador dele (o PDF não sai do PC); o pipeline usa âncoras por rótulo, deduz proficiência
  pela conta e abre uma tela de revisão. "Importar PDF" mora dentro da ficha, na aba Configurar; nenhum texto cita outro programa.
- **Onde.** `packages/shared/src/importarFichaPdf.ts`. Quando: Lote 10; V3. Situação: vale.

### 11.7 Rolagens no chat: Fita (padrão) e Moldura
- **O quê.** Cada rolagem é um cartão, em dois estilos por preferência local: **Fita** e **Moldura de grimório**. Número grande; dano com ícone, sem
  vermelho nem laranja; crítico verde; rolagem secreta em linha pequena.
- **Por quê.** O Vilella escolheu entre modelos desenhados no canvas (2026-11-16): "mais simples, lembrando as mesas virtuais conhecidas sem copiar a identidade; sem cara de IA".
- **Onde.** `apps/web/src/rolagem/estilo.ts`. Quando: Q5. Situação: **trocada**: o bloco baixo do V4a deu lugar aos cartões do Q5.

### 11.8 Combate: iniciativa e condições
- **O quê.** Empate: maior Destreza, depois PJ antes de NPC, depois o nome. Condições ficam **no token**. O jogador da vez pode passar o
  turno. Só o mestre muda o valor da iniciativa (V2 resolveu a dúvida do Lote 11).
- **Onde.** `packages/shared/src/combate.ts`, `condicoes.ts`. Situação: vale (várias são suposições "(assumido)" do lote 11).

### 11.9 Hordas, vida por token e borda colorida
- **O quê.** `personagem.colocarVarios` põe até 20 tokens; cada um com vida própria; `tokens.vidaDelta` aplica dano e cura em lote; a borda é uma de
  8 cores, sem seletor livre; barra de vida opcional (padrão ligada).
- **Por quê.** Pedidos do Vilella (Q10 e Q11, 2026-11-17).
- **Onde.** `hordas.ts`, `bordas.ts`. Situação: vale. Um personagem de jogador tem um token por cena (Q8).

---

## 12. Chamada, som e música

*(Funcionamento em [09](09-chamada-e-som.md).)*

### 12.1 Chamada na própria mesa, só a Grade
- **O quê.** Uma janela própria com vídeo em grupo, máximo 8 pessoas (malha ponto a ponto, a sala só sinaliza). **Sem modo Palco**; segue o tema da mesa.
- **Por quê.** Pedido do Vilella ("um discord vinculado à mesa"); em 2026-11-19: "só Grade".
- **Onde.** `packages/shared/src/chamada.ts` (`MAXIMO_NA_CHAMADA`), `apps/web/src/chamada/`. Quando: CH1 (2026-11-19). Situação: vale.
  **Fora, por ora**: compartilhar tela, servidor de mídia (SFU), TURN próprio.

### 12.2 Fundo desfocado em três níveis, modelo empacotado
- **O quê.** Desligado, Leve e Forte, com MediaPipe e o modelo `selfie_segmenter` dentro do projeto.
- **Por quê.** Nada buscado da internet; o Vilella pediu "o pouco" depois de ver só o desfoque forte (CH3).
- **Onde.** `apps/web/src/chamada/fundo.ts`. Situação: **trocada** (um nível → três).

### 12.3 Gravar e transcrever: sem custo e nada pesado ao vivo
- **O quê.** O mestre grava só a fala de cada voz (WAV 16 kHz) na pasta da mesa; todos veem o aviso; cada um pode "Não gravar a minha voz";
  depois se transcreve com `pnpm transcrever` (whisper.cpp que **ele** instala). Nada de API paga nem de Whisper simultâneo ao jogo.
- **Por quê.** Decisão do Vilella (2026-11-19 e 2026-11-20): "nada que custe e nada pesado ao vivo".
- **Onde.** `packages/shared/src/gravacao.ts`, `transcricao/`, `apps/web/src/chamada/gravacao/`. Quando: CH3.
- **Situação.** Vale. **Trocada**: a ideia de rodar no navegador de cada pessoa deu lugar a um comando no terminal do mestre.

### 12.4 Mesa de som: 8 efeitos e 8 ambientes
- **O quê.** Até 8 efeitos de um toque e 8 ambientes em laço, cada um com volume; sem playlist, com jeito claro de apagar.
- **Por quê.** Decisão do Vilella (2026-11-16): "mesa digital". **Trocada**: a trilha única e o painel do N5 saíram (Q4).
- **Onde.** `packages/shared/src/mesadesom.ts`. Situação: vale.

### 12.5 Música: biblioteca com etiquetas, sem IA
- **O quê.** Biblioteca local de mp3 com etiquetas e filtro; ordem aleatória sem repetir ou crescente por energia. Cada navegador acha
  a música pela soma das durações, sem evento no fim de cada faixa. Sem automação por IA.
- **Por quê.** Decisão do Vilella (2026-11-19): nada que custe.
- **Onde.** `packages/shared/src/musica.ts` (`musicaAgora`). Quando: MU1. Situação: vale. O jogador recebe só o que toca.

---

## 13. Interface e temas

*(Funcionamento em [11](11-interface-temas-e-janelas.md).)*

### 13.1 O mapa ocupa a tela; as ferramentas flutuam em volta
- **O quê.** Mapa em tela cheia; barras fixas (topo 48 px, esquerda 52 px); painel direito em coluna à parte, largura ajustável por cada usuário
  (mínimo 300 px). Janelas flutuantes com posição por usuário no navegador.
- **Por quê.** Referência: a tela de outra mesa virtual que o Vilella usa (painéis estreitos e enxutos, menos botões). Redesign de 2026-11-10 (R1–R6): "bonito, usável e mega intuitivo".
- **Onde.** `apps/web/src/Mesa.tsx`, `janelas/`. Situação: vale; o tema "Grimório" é o padrão, a identidade do Távola.

### 13.2 Tema é preferência local, 14 temas
- **O quê.** Escolha por usuário, só cores; 14 temas hoje. O mapa não muda com o tema.
- **Por quê.** **Trocada**: eram 3 temas (Grimório, Escuro, Claro); o Vilella pediu todas as paletas do protótipo em 2026-11-10 (11) e V1 trouxe mais (14).
- **Onde.** `apps/web/src/tema/temas.ts`, a única fonte dos tokens. Situação: vale.

### 13.3 Sem menu de "subir arquivo"
- **O quê.** A imagem entra onde faz sentido: retrato e token no editor do item, mapa na cena. Nenhum texto cita outro programa.
- **Onde.** Interface v2 (2026-11-05). Situação: vale; a aba Biblioteca saiu.

### 13.4 Fichas como diário: pastas e handouts
- **O quê.** Itens em pastas sem subpastas; a pasta define quem vê, cada item quem edita. As notas viraram handouts (V3), com 5 fontes e "Mostrar agora".
- **Onde.** `packages/shared/src/pastas.ts`, `apps/web/src/AbaFichas.tsx`. Situação: vale.

### 13.5 Campos alinhados lado a lado
- **O quê.** Rótulo, caixa e ajuda alinham em linhas comuns (grade com subgrid), mesmo com rótulo de 2 linhas.
- **Por quê.** Pedido do Vilella (A1, 2026-11-19): conferir nos prints de todo lote.
- **Situação.** Vale.

---

## 14. Fluxo de trabalho e testes

*(Detalhes em [12](12-testes-e-fluxo-de-trabalho.md).)*

- **Lotes pequenos e verificáveis.** Um lote por vez; só avança com `pnpm verify`. O `verify` roda **uma vez** (desde 2026-11-10). O Playwright
  repete uma vez o teste que falhar e reprova o que só passar na repetição.
- **Testes enxutos.** Um verify por lote, sem `--repeat-each`; se falhar, reteste só o que falhou; prints só do Grimório e do Pergaminho.
- **Protótipo antes do código.** O Vilella escolhe entre desenhos no canvas "Távola — direções visuais" antes de se codar; exemplos visuais vão como página
  nova nesse canvas, nunca como artefato novo.
- **Documentos sempre atualizados.** Toda decisão do chat vai para `PROJETO.md`, `docs/ESTADO.md` ou `docs/IDEIAS.md`.
- **Toda intenção declara a capacidade e tem schema zod; todo dado secreto tem teste de frames.**
- **Commits pelo PowerShell** com `git commit -F` (aspas duplas quebram o `-m` no PS 5.1).
- **Agentes não matam processos do usuário**: o `pnpm dev` dele nunca é encerrado.

---

## 15. O que foi descartado

Estas propostas foram recusadas explicitamente e **não devem voltar** (`docs/IDEIAS.md`, "Descartadas"):

| Proposta | Por que foi descartada | Quando |
|---|---|---|
| Guardar imagens no servidor (R2 ou similar) | As imagens locais são a premissa e o diferencial do projeto | 2026-11-04 |
| Regra baseada no relógio do PC do jogador | O tempo é da sala | 2026-11-04 |
| Mecânicas da campanha no código | A mesa é genérica; falta configuração, não código | 2026-11-04 |
| Esconder da rede o que está fora da visão (anti-F12 por linha de visão) | "Quem fuçar o F12 estraga a própria diversão"; não vale o custo | 2026-11-06 |
| Mapa revelado aos poucos (tiles só conforme a exploração) | Os jogadores não vão fuçar o F12 | 2026-11-14 |
| Reabrir o arquivo original do disco do jogador | O navegador não guarda o caminho; o cache cobre o caso | 2026-11-20 |
| Proteção anti-trapaça cara em geral | Mesma razão do F12 | 2026-11-06 |
| API paga do Claude, Whisper ao vivo, IA para tocar música | "Nada que custe e nada pesado ao vivo" | 2026-11-19 |
| Modo Palco na chamada | Pedido do Vilella: só Grade | 2026-11-19 |
| Campanhas de exemplo no Importar | Mesa nova nasce no 5e padrão; o Importar fica só com "Escolher arquivo" | 2026-11-16 |
| Lista "O que o Claude fez" em Preferências | Os rascunhos bastam | 2026-11-16 |
| Portas lógicas com fio | Trocadas pelas caixas do AU3 | 2026-11-20 |
| Primeira ficha em papel branco, cópia da impressa | Recusada ("não tá top"); trocada pelo desenho aprovado | 2026-11-11 |
| Rodar a transcrição no navegador de cada pessoa | Trocada por um comando no terminal do mestre | 2026-11-20 |
| Tirar a validação zod no navegador | Ela aplica os valores padrão | 2026-11-17 |

---

## 16. Em aberto

- **Login no portal Távola.** Decisão do Vilella (2026-11-20): o login sai da mesa e vai para um portal único. A pensar; **não implementar sem conversar**.
- **Imagens e tokens para cada monstro e item do compêndio.** O Vilella reconhece o problema e deixou "para um futuro" (2026-11-16). Nunca arte da WotC.
- **A luz acompanhar o tamanho da chama esticada** (FG1).
- **O Claude de um jogador listar os assets dele** (AS1).
- **Um acerto por raio** nas magias (Raio Ardente) e vários grupos "N/dia" no mesmo bloco (N2).
- **Minimapa do editor de automações, soltar um fio no vazio, colar caixas entre automações** (AU2/AU3).
- **Desempenho**: a auditoria de 2026-11-17 deixou de fora o que arrisca mudar comportamento ou pede protocolo novo; medir antes de mexer.
- **Perguntas ao Vilella** acumuladas em `docs/PERGUNTAS.md` (tocha apagada ocupa mão, ordem do painel do token, desenhos do jogador, etc.): quase todas
  seguem como "(assumido)".

---

## Para ir além

- `PROJETO.md` seção 3 (tabela de decisões) e seção 10 (decisões tomadas e em aberto).
- `docs/REDESIGN.md`: cada lote tem "O que foi feito" e "Decisões (assumido)".
- `docs/IDEIAS.md` e `docs/PERGUNTAS.md`.
- [01 — Visão geral](01-visao-geral.md) e o [índice da pasta](README.md).
