# Visão geral do Távola

O Távola é uma mesa virtual (VTT, "virtual tabletop") para mestrar D&D 5e com um grupo fixo de até 8 pessoas. O mestre
monta cenas com mapa, paredes e luz; os jogadores entram pelo navegador, movem tokens, rolam dados e usam a ficha; a
mesa conta o tempo das tochas, roda automações e conversa com o Claude. Tudo roda **na máquina de quem hospeda**, mas é
escrito como se um dia os jogadores entrassem pela internet.

Este arquivo é a porta de entrada: o que o projeto é, os princípios, a stack, o mapa do repositório, uma sessão
de jogo de ponta a ponta e um glossário. As decisões, uma a uma, estão em [02 — Decisões](02-decisoes.md); o
funcionamento interno de cada área está nos arquivos 03 a 12 (links ao longo do texto).

## 1. O que é e para quem

- É uma mesa para um grupo, não um produto para desconhecidos. O mestre cria a mesa, os amigos pedem para entrar
  e o mestre aceita.
- Inspirada nas mesas virtuais de assinatura e corrigindo o que incomoda: sem assinatura, sem limite de armazenamento de mapas e tokens
  (porque as imagens ficam no computador de cada um), sem configurar rede para os jogadores (eles abrem um link) e sem
  ficha presa (a ficha impressa em PDF é importada).
- A identidade visual é própria (nome Távola, tema "Grimório"); nada de logotipo, ícone ou nome de terceiros.
- O conteúdo de regras vem do SRD 5.1 (regras de 2014, licença CC-BY-4.0). Textos de livro não entram no
  repositório: o mestre põe os arquivos do compêndio na pasta dele (ver [08](08-ficha-compendio-dados-e-combate.md)).
- O mundo é métrico: **1 quadrado = 1,5 m** (5 ft). Coordenadas de cena são em metros; o MCP e algumas telas falam em
  células.

## 2. Os princípios

Estão em `PROJETO.md`, seção 3.1. Os que mais explicam o código:

1. **Tudo local, mas pronto para a internet.** Nada de atalho inseguro "porque é local": há contas com senha,
   sessões, limite de tentativas, checagem de `Origin`, segredos guardados só como hash. Em tempo de execução o app não
   acessa nada na internet (sem CDN, fonte remota, analytics ou API de terceiros). Ver [04](04-contas-e-seguranca.md).
2. **O servidor manda.** O navegador manda *intenções* ("quero mover o token"); a sala valida pela *capacidade* do
   papel, aplica e avisa os outros. Ninguém altera o estado direto. Ver [03](03-sala-e-sincronizacao.md).
3. **Cada um recebe só o que o mestre deixou ele ver.** A sala monta uma visão filtrada por usuário
   (`visaoPara` e `eventoPara`, em `packages/shared/src/nucleo.ts`). Token oculto, camada do mestre, outras cenas,
   pastas fechadas, notas do mestre, automações e zonas nunca saem da sala para o jogador. Em contrapartida, **visão e
   escuridão são só de tela**: o token que só está no escuro chega ao navegador (decisão do Vilella: o grupo não vai
   caçar no F12).
4. **Mesa genérica.** Nenhuma regra de campanha no código. Duração de tocha, ciclos e efeitos são configuração do
   mestre. A campanha "A Chama Primordial" (`fixtures/campanhas/chama-primordial.json`) existe como teste de
   aceitação: o motor tem que expressá-la só com configuração.
5. **O tempo é da sala.** Tochas, ciclos e esperas são contados pelo relógio da sala (um agendador único e o alarme do
   Durable Object), nunca pelo relógio do PC de um jogador. Pausar a mesa congela tudo.
6. **Imagens e sons ficam no computador de quem os tem.** O servidor não guarda imagem; o arquivo é identificado pelo
   SHA-256, viaja entre os navegadores em pedaços e a sala só faz o repasse. Ver [07](07-arquivos-e-assets.md).
7. **Lógica pura em `packages/shared`.** Regras de D&D, geometria de visão, parser de dados, motor de automações,
   importação de PDF e as ferramentas do MCP ficam sem DOM, com testes de unidade.
8. **Nada de botão "salvar".** Toda ação vai para a sala na hora; recarregar a página não perde nada.
9. **Dados rolam na sala** (`crypto.getRandomValues`); um resultado vindo do cliente é ignorado.

## 3. A stack e o porquê de cada peça

| Peça | Escolha | Por quê |
|---|---|---|
| Linguagem | TypeScript em tudo | Os tipos do protocolo, as regras e a geometria são escritos uma vez e usados no navegador, na sala e no MCP. Os jogadores não instalam nada. |
| Interface | React 19 + Vite | Fichas, chat e painéis são formulários e listas; é o ecossistema maior. O Vite serve o dev e faz um proxy de `/api` (inclusive WebSocket) para a sala, então tudo fica na mesma origem. |
| Mapa | PixiJS v8 | WebGL/WebGPU; aguenta dezenas de luzes e a composição de escuridão com `RenderTexture` e blends sem shader próprio. Ver [05](05-mapa-luz-e-visao.md). |
| Servidor | Cloudflare Worker + Durable Object `Sala`, rodando local pelo `wrangler dev` (`workerd`) | Um Durable Object é uma "sala" com estado em memória e SQLite próprio: é exatamente o formato de uma mesa. Local não precisa de conta nem de internet; no futuro o mesmo código vai para a nuvem. |
| Persistência | SQLite do Durable Object | Estado, fichas, cenas, chat. O estado em memória é só cache: a sala pode hibernar e reiniciar. |
| Validação | zod 4 em `packages/shared` | Cada mensagem tem schema, validado nos dois lados. O zod também aplica os valores padrão, por isso o navegador não pula a validação. |
| Arquivos | File System Access API + OPFS + SHA-256 | A pasta local de cada pessoa e um cache em disco no navegador. |
| PDF | pdf.js (`pdfjs-dist`) | Ler texto e posição da ficha impressa e extrair o compêndio dos livros. |
| Chamada | WebRTC + MediaPipe (`@mediapipe/tasks-vision`) | Voz e vídeo direto entre os computadores; segmentação para o fundo desfocado, com o modelo empacotado no projeto. Ver [09](09-chamada-e-som.md). |
| Testes | Vitest + Playwright | Unidade para a lógica pura; o Playwright abre vários jogadores com armazenamento isolado, como se fossem PCs diferentes. Ver [12](12-testes-e-fluxo-de-trabalho.md). |
| Monorepo | pnpm workspaces | Um `pnpm verify` roda tipos, lint (Biome) e todos os testes. |
| IA | MCP (Model Context Protocol) | O Claude opera a mesa pelas mesmas intenções, schemas e permissões dos clientes. Ver [10](10-mcp.md). |

Versões de hoje (de `package.json`): React 19.3, Vite 8, pixi.js 8.22, zod 4.6, wrangler 4.157, Vitest 5, TypeScript 7,
Biome 2.6. Ícones (`lucide-react`) e fontes (`@fontsource-*`) são pacotes empacotados no app, nunca carregados da rede.

## 4. O mapa do monorepo

```
Tabletop/
├─ apps/
│  ├─ web/        o navegador: React + PixiJS
│  ├─ server/     o Worker e os Durable Objects (Sala e Diretorio)
│  └─ mcp/        o MCP local em stdio (para o Claude Desktop)
├─ packages/
│  └─ shared/     o núcleo puro: tipos, zod, regras, motor, ferramentas do MCP
├─ e2e/           Playwright: testes com vários jogadores e os "prints"
├─ fixtures/      campanhas, fichas, compêndio de exemplo, "ouro" do motor
├─ docs/          documentação (esta pasta é a explicação)
└─ PROJETO.md     a especificação do produto e a tabela de decisões
```

### `packages/shared` (o núcleo, sem DOM)

É o pacote mais importante: o navegador, a sala e o MCP importam dele, e por isso os três concordam sobre o que cada
mensagem significa. A entrada principal é `@tabletop/shared` (`src/index.ts`); a segunda, `@tabletop/shared/mcp`, é
carregada só pela sala e pelo `apps/mcp`, nunca pelo navegador.

- `estado.ts`: o `Estado` da mesa (zod): cenas, tokens, personagens, luzes, config, relógio, combate...
- `protocolo.ts`: o envelope (`v`, `tipo`, `dados`), todas as intenções do cliente e os eventos da sala, com a
  `VERSAO_PROTOCOLO` e a `VERSAO_EXPORTACAO` (13 hoje).
- `nucleo.ts`: o coração. `processar` recebe estado, intenção e usuário e devolve o evento ou o erro; `reduzir`
  aplica um evento a um estado (o navegador e o MCP usam o mesmo); `visaoPara` e `eventoPara` filtram por usuário;
  `processarSistema` cuida do que acontece com o tempo.
- `capacidades.ts`: as capacidades delegáveis e as exclusivas do mestre, com o padrão de cada uma.
- Geometria e luz: `paredes.ts`, `visao.ts`, `iluminacao.ts`, `memoria.ts`, `nevoa.ts`, `zonas.ts`, `luz.ts`,
  `tochas.ts`, `objetos.ts`.
- Tempo: `relogio.ts`; automações: `automacoes.ts`, `automacoesnucleo.ts`, `fluxos*.ts`, `ouro.test.ts`.
- Ficha e regras: `ficha.ts`, `conjuracao.ts`, `ataques.ts`, `condicoes.ts`, `combate.ts`, `dados.ts`, `rolagens.ts`,
  `compendio*.ts`, `importarFichaPdf.ts`, `importarUvtt.ts`, `srd/`, `extrator/`.
- Arquivos: `assets.ts`, `envios.ts`, `cifra.ts`, `seguranca.ts`.
- Contas e mesas: `contas.ts`, `recuperacao.ts`, `mesas.ts`, `membros.ts`, `claude.ts`.
- Chamada e som: `chamada.ts`, `gravacao.ts`, `som.ts`, `mesadesom.ts`, `musica.ts`, `transcricao/`.
- `mcp/`: as ferramentas do MCP (`ferramentas/`), a tabela de paridade (`paridade.ts`, `paridadeCampos.ts`) e o
  servidor JSON-RPC (`servidor.ts`).

### `apps/server` (a sala)

- `src/index.ts`: o Worker. Roteia `/api/mesas`, `/api/m/<id>/...` e o WebSocket para o Durable Object certo.
  Refaz os cabeçalhos internos (`x-tavola-ip`, `x-tavola-local`...) para o navegador não conseguir forjá-los.
- `src/sala.ts`: o Durable Object `Sala`: uma mesa. WebSocket com hibernação, `tratarIntencao`, filtro por
  usuário, alarmes, rotas de conta, rota do MCP, caixa de entrada do Claude. É o maior arquivo do servidor.
- `src/diretorio.ts` e `registroDeMesas.ts`: o Durable Object `Diretorio` (único), que lista as mesas e o id de cada uma.
- `src/armazenamento.ts`: o SQLite da sala e a lista de migrações (`MIGRACOES`, só acrescentam).
- `src/agendador.ts`: o agendador único que mantém o alarme do Durable Object no próximo vencimento.
- `src/contas.ts`, `autenticacao.ts`, `origem.ts`: contas, sessões, cookies e a checagem de `Origin`.
- `src/transferencias.ts`, `caixaDeEntrada.ts`: repasse de arquivos entre navegadores e a caixa do Claude.
- `wrangler.jsonc`: as classes `Sala` (migração `v1`) e `Diretorio` (`v2`), na porta 8787.

### `apps/web` (a interface)

`src/App.tsx` é o roteador (rotas em `rotas.ts`, sem biblioteca) e baixa cada tela como um pedaço separado. `Mesa.tsx` é
a tela da mesa; `useSala.ts` abre o WebSocket e mantém o estado com o mesmo `reduzir` do `shared`. Pastas:

| Pasta | O que tem |
|---|---|
| `mapa/` | PixiJS: `mapaPixi.ts` (o mapa), `camadaDeLuz.ts`, `camadaDeNevoa.ts`, `camadaDeDesenho.ts`, `chamas.ts` (o fogo desenhado por código), `memoriaLocal.ts` |
| `ficha/` | A ficha de personagem e de NPC, a conjuração, a importação do PDF, as janelas próprias |
| `automacoes/` | Lista, editor em grade (`CanvasDoGrafo.tsx`), mesa de eventos, tour |
| `chamada/` | Chamada de vídeo, malha WebRTC, fundo desfocado, gravação |
| `som/` | Mesa de som, biblioteca de música, motor de áudio |
| `rolagem/` | Os cartões de rolagem do chat (Fita e Moldura) |
| `contas/` | Entrada na mesa, recuperação, pasta do mestre com chave |
| `claude/` | "Conectar o Claude" e os rascunhos do Claude |
| `assets/` | O gerente de arquivos: processamento, cache, pasta local, transferência |
| `tema/` | Os 14 temas de cor (`temas.ts` é a única fonte) |
| `tour/` | O tour de introdução |
| `janelas/` | Janela flutuante, pilha, geometria |

Fora das pastas: as abas do painel direito (`AbaChat`, `AbaFichas`, `AbaCompendio`, `AbaMesa`), os painéis do mapa
(`PainelDasParedes`, `PainelDeFontesDeLuz`...), `TelaInicial.tsx`, `SecaoDePreferencias.tsx` e os hooks (`useSala`, `useFatia`...).

### `apps/mcp`, `e2e`, `fixtures`

- `apps/mcp`: o MCP em stdio, em Node. Usa o mesmo código de `packages/shared/src/mcp`; existe para o Claude Desktop.
  O caminho principal hoje é o MCP por HTTP dentro da própria sala.
- `e2e`: os testes do Playwright (`tests/`), os testes que geram prints (`prints/`) e as medidas de desempenho.
- `fixtures`: `campanha.seed.json` (a semente da mesa legada e dos testes), `campanhas/` (5e padrão e Chama Primordial),
  `fichas/` (PDFs de teste), `compendio/exemplo-srd.json` e `ouro/` (o resultado de referência do motor de automações).

## 5. Uma sessão de jogo, de ponta a ponta

```
Mestre cria a mesa ─► Worker + Diretorio criam a Sala ─► mestre recebe código de recuperação
        │
Jogadores abrem o link ─► "Pedir para entrar" ─► mestre aceita ─► login e senha valem
        │
Entram na sala por WebSocket ─► snapshot filtrado ─► daí em diante só eventos
        │
Mestre prepara cena ─► sobe mapa ─► paredes, luz, tokens ─► "Levar o grupo"
        │
Sessão: mover, rolar, acender tocha, automações disparam, arquivos trafegam
```

1. **Criar a mesa.** Na tela inicial (`TelaInicial.tsx`) o mestre informa nome da mesa, login, nome e senha, e pode
   escolher uma pasta do computador. O **navegador** sorteia o id (12 caracteres, `k7m2-qx9p-4tdn`) e estica a senha
   com PBKDF2 (600.000 iterações); manda só o resultado. O Worker pede ao `Diretorio` que registre a mesa e ao
   Durable Object `Sala` que nasça com a conta do mestre. Se ele escolheu a pasta, o navegador grava lá o arquivo
   `tavola-mestre.json` com uma chave privada e envia só a pública. Ele anota o código de recuperação, mostrado uma vez.
2. **Entrar.** O mestre passa o link ou o id. A pessoa abre `/m/<id>`, usa "Pedir para entrar" (nome, login, senha) e
   fica pendente; o mestre vê o aviso no topo e aceita, ligando a conta a uma vaga de jogador (ou criando uma). Depois
   disso, a pessoa entra com login e senha. Toda entrada passa pelo mestre.
3. **Conectar.** A mesa abre `/api/m/<id>/ws`. A sala resolve cookie, sessão, conta e vaga (nunca confia no cliente) e
   guarda a identidade no `serializeAttachment` do socket. Manda um **snapshot** já filtrado para aquela pessoa. A
   partir daí só fluem eventos; a sala numera os eventos (`seq`), e o navegador aplica cada um com `reduzir`.
4. **Preparar a cena.** O mestre cria a cena e sobe o mapa. O navegador dele processa a imagem (WebP, em tiles se for
   grande) num Web Worker, calcula o SHA-256 e registra o asset na sala (só metadados). Desenha paredes e portas, põe
   luzes e tokens. Como o jogador só recebe a cena ativa, preparar outra cena não vaza nada; o mestre ainda pode pré-enviar
   o mapa dela em formato cifrado para a troca ser instantânea.
5. **Levar o grupo.** `grupo.moverPara` troca a cena ativa; cada jogador recebe um snapshot novo. O mapa só vai
   para quem precisa dele: o navegador pede o hash (`asset.pedir`), a sala escolhe quem tem o arquivo e manda pedir o
   envio; o dono envia em pedaços, a sala repassa a todos que esperam sem gravar nada, e cada um confere o hash antes de
   guardar no cache.
6. **Jogar.** O jogador arrasta o token: `token.mover` sai a no máximo 20 por segundo e é transitório; só o
   `token.soltar` grava. A sala confere capacidade, alcance, paredes e visibilidade, e repassa `token.movendo` só a quem vê
   o token. O mestre acende uma tocha: o objeto de luz nasce na mão do token, a sala anota o vencimento no agendador e a
   luz do mapa muda para todos. Rolagens vão para a sala, que sorteia e escreve no chat. Automações disparam quando o
   relógio, um botão, uma zona ou um sinal as ativam, e mexem em luzes e visão como *modificadores com prazo*.
7. **Cair e voltar.** Se o navegador recarrega, reconecta, recebe o snapshot e lê os assets do cache. Se a sala
   hiberna, recarrega do SQLite. Se o último mestre sai, a mesa pausa sozinha depois de 5 s para as tochas não queimarem
   entre sessões.
8. **Fora do jogo.** O mestre exporta a campanha em JSON (sem imagens) para backup. O Claude, pela rota MCP, monta
   cenas, NPCs e automações como *rascunho* até o mestre publicar.

Detalhes: [03](03-sala-e-sincronizacao.md), [04](04-contas-e-seguranca.md), [07](07-arquivos-e-assets.md).

## 6. Glossário

- **Mesa**: uma campanha hospedada, com id próprio (`k7m2-qx9p-4tdn`), contas próprias e uma sala. Há várias mesas no
  mesmo servidor; a primeira ("legada") é a campanha que existia antes do diretório.
- **Sala**: o Durable Object `Sala`, o processo autoritativo de uma mesa. Guarda o estado, valida intenções, filtra o que
  cada pessoa vê e acorda no próximo vencimento. "Mesa" é o conceito para o usuário; "sala" é o programa.
- **Vaga**: um lugar de jogador no estado (`usuarios`, até 12). A conta de uma pessoa liga-se a uma vaga; fichas e tokens
  apontam para a vaga. Só são *membros* o mestre e quem tem conta ativa.
- **Cena**: um mapa (ou um *cartão*, que é só uma imagem inteira sem névoa) com grid, paredes, luzes, tokens, zonas e
  desenhos. O grupo está numa cena ativa; o mestre pode olhar e editar qualquer uma sem mover o grupo.
- **Token**: a peça no mapa. Pode representar um personagem (e herdar nome, cor e imagem) ou ser uma imagem solta (`Token.imagem`).
  Tem camada (`mapa`, `tokens`, `mestre`), pode estar oculto, ter borda colorida e vida própria (hordas).
- **Ficha**: o JSON de um personagem 5e (valores base; os derivados saem de fórmulas). O NPC é a mesma ficha com
  `apresentacao: npc`, mostrada como bloco de monstro.
- **Intenção**: a mensagem do cliente pedindo algo ("`token.mover`"). A sala decide; ninguém altera o estado direto.
  O contrário é o **evento**, que a sala emite depois de aplicar.
- **Capacidade**: o nome da permissão que cada intenção exige (`tocha.entregar`, `porta.abrir`...). Há as delegáveis, que o
  mestre liga ou desliga para jogadores (por mesa e por pessoa), e as só do mestre (`cena.editar`, `mesa.configurar`...).
- **Asset**: um arquivo da mesa (mapa, tile, token, retrato, imagem, animação, som, compêndio, json), identificado pelo
  SHA-256. A sala guarda só a meta; os bytes ficam nos computadores.
- **Lote**: duas coisas. Na construção do projeto, uma entrega pequena e verificável (R1, V4a, AU3...), ver
  [12](12-testes-e-fluxo-de-trabalho.md). No MCP e no Desfazer, o conjunto de mudanças de uma chamada de ferramenta do
  Claude (`loteId`), desfeito de uma vez.
- **Rascunho**: o que o Claude do mestre cria entra com `rascunho: true`, invisível ao jogador e sem efeito, até o mestre
  publicar ou descartar. Também é o nome do texto não enviado que o navegador guarda (chat, campo da ficha).
- **Zona**: polígono de uma cena, só do mestre, com efeitos enquanto um token ou objeto está dentro (luz menor, visão
  limitada, som) e que serve de gatilho para automações.
- **Objeto de luz**: tocha, lanterna, fogueira... instância de um *modelo* de objeto. Tem saldo de tempo contado pela sala, vai
  da mochila para a mão, para um suporte ou para outro token. Ver [05](05-mapa-luz-e-visao.md).
- **Automação**: um `Fluxo`, um grafo de nós ligados por fios (gatilhos, esperas, condições, caixas lógicas E/OU/NÃO e ações
  de uma lista fechada) que roda na sala. Ver [06](06-automacoes.md).
- **Modificador**: efeito temporário com prazo (luz menor por 20 s). O valor final é base + modificadores ativos; nunca se
  altera o valor base, então nada fica preso.
- **Snapshot**: o estado completo, já filtrado, que a sala manda ao conectar. Depois só eventos.
- **Visão do mestre**: a escolha, só da tela do mestre, de ver o mapa inteiro com os contornos das paredes. Não vai para a sala.
- **Pasta da mesa**: a pasta do computador do mestre onde ficam os arquivos, a chave de recuperação e as gravações.
- **MCP**: o protocolo pelo qual o Claude usa as ferramentas da mesa; o usuário gera um token em Preferências e cola um comando.

## Para ir além

- `PROJETO.md`, seções 1 a 4: a especificação completa (a tabela de decisões e cada área).
- `docs/protocolo.md`: todas as mensagens entre o navegador e a sala.
- `docs/ESTADO.md` e `docs/PASSAGEM.md`: o histórico de cada lote e onde mexer.
- [README da pasta](README.md): o índice dos outros arquivos.
