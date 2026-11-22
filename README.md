# Távola

Mesa virtual (VTT) para mestrar **D&D 5e** com um grupo fixo de amigos, no navegador. O mestre monta cenas com mapa,
paredes e luz; os jogadores movem tokens, rolam dados e usam a ficha; a mesa conta o tempo das tochas, roda automações
e conversa com o Claude.

É uma mesa para um grupo (até 8 pessoas), não um produto para desconhecidos. Ela corrige o que incomoda nas mesas
virtuais de assinatura: sem assinatura, sem limite de armazenamento de mapas e tokens e sem ficha presa (a ficha impressa em PDF
é importada).

## O que tem

- **Mapa** em PixiJS: grid, tokens, paredes e portas (inclusive em arco), linha de visão, luz e penumbra, visão no
  escuro, memória do que o personagem já viu, névoa pintada à mão, desenho, régua e ping.
- **Tochas e objetos de luz** com tempo contado pelo relógio da sala, que para quando a mesa pausa.
- **Automações** num editor de blocos ligados por fios (gatilhos, esperas, condições, caixas E/OU/NÃO e ações), que
  rodam na sala: "a cada 3 minutos, cada tocha acesa tem 30% de chance de apagar".
- **Ficha 5e** de personagem e de NPC, com os derivados calculados, conjuração e importação do PDF da ficha.
- **Compêndio** de magias, monstros e itens, com busca em português e inglês.
- **Chat e rolagens** (os dados rolam na sala), ordem de turno e condições.
- **Chamada de vídeo** dentro da mesa, com fundo desfocado, gravação e transcrição local com o whisper.cpp.
- **Mesa de som** e biblioteca de música.
- **MCP**: o Claude entra na mesa como você, com as suas permissões, e monta cenas, NPCs e automações por prompt.
- 14 temas de cor, janelas soltas, atalhos de teclado e tour de introdução.

## Como funciona, em uma página

- **Tudo em TypeScript.** React 19 + Vite no navegador, PixiJS v8 no mapa, um Cloudflare Worker com um Durable Object
  por mesa (a "sala") rodando local pelo `wrangler dev`, zod para validar cada mensagem.
- **O servidor manda.** O navegador só envia intenções ("quero mover o token"); a sala confere a permissão, aplica e
  avisa os outros.
- **Cada um recebe só o que pode ver.** Token oculto, camada do mestre, outras cenas e notas do mestre nunca saem da sala
  para o jogador.
- **Imagens e sons ficam no computador de quem os tem.** O servidor não guarda arquivo: cada um é identificado pelo
  SHA-256 e viaja entre os navegadores em pedaços.
- **A lógica fica num pacote puro** (`packages/shared`), usado igual pelo navegador, pela sala e pelo MCP, e coberto por
  testes de unidade.

A explicação completa, área por área e com o porquê de cada decisão, está em
[`docs/explicacao/`](docs/explicacao/README.md).

## Requisitos

- **Node 22** ou mais novo.
- **pnpm 10.34.9**, a versão fixada no projeto. O jeito mais simples é pelo corepack, que vem com o Node:
  `corepack enable pnpm`.
- **Chrome ou Edge.** A pasta local da mesa usa a File System Access API, que só existe neles. Os testes ponta a ponta
  usam o Chrome instalado.

## Rodar

```bash
git clone https://github.com/gvilella-eng/Tavula.git
cd Tavula
pnpm install
pnpm dev
```

O `pnpm dev` sobe a sala (`127.0.0.1:8787`) e o site (`127.0.0.1:5173`). Abra **http://127.0.0.1:5173**.

1. Na tela inicial, **crie uma mesa**: nome da mesa, o seu login, nome e senha. Pode escolher uma pasta do computador
   para guardar os arquivos da mesa (mapas, tokens, sons, o compêndio).
2. Anote o **código de recuperação**, mostrado uma vez só.
3. Para entrar como jogador na mesma máquina, use **outro perfil do Chrome** (janelas anônimas dividem o armazenamento e
   não se comportam como outro computador). Abra o link da mesa, peça para entrar e aceite o pedido na janela do mestre.

Outros comandos:

| Comando | O que faz |
|---|---|
| `pnpm jogar` | Sobe a sala e o build de produção do site, no mesmo endereço. Mais leve para uma sessão longa. |
| `pnpm transcrever "<pasta da gravação>"` | Transcreve uma gravação da chamada com o whisper.cpp ([guia](docs/WHISPER.md)). |
| `pnpm compendio:extrair` | Extrai o compêndio dos PDFs dos livros que você tem ([guia](docs/COMPENDIO.md)). |

**Onde ficam os dados.** O estado da sala fica em `apps/server/.wrangler/state` (fora do git); apagar essa pasta zera
as mesas. Para backup, exporte a campanha em JSON pela aba **Mesa**.

**Rede.** Hoje a sala e o site escutam só em `127.0.0.1`, ou seja, neste computador. Jogar com pessoas em outros
computadores exige publicar a sala na internet, o que ainda não está feito. O código já foi escrito para isso: contas
com senha, sessões, limite de tentativas e conferência de origem.

## Conectar o Claude (MCP)

Na mesa, abra **Preferências → Conectar o Claude**, gere um token e cole o comando que aparece em qualquer terminal.
Depois, no Claude Code, peça "mostre o panorama da mesa". O passo a passo, o que o Claude pode e não pode fazer e o
Claude Desktop estão em [`docs/MCP.md`](docs/MCP.md).

## Testes

```bash
pnpm verify      # typecheck, lint (Biome), testes de unidade e testes ponta a ponta
pnpm test        # só os testes de unidade (Vitest)
pnpm test:e2e    # só os testes ponta a ponta (Playwright)
```

Os testes ponta a ponta sobem servidores próprios (sala em `8788`, site em `5174`, estado em `e2e/.estado-sala`) e
nunca tocam as mesas do `pnpm dev`. Cada jogador do teste é um contexto do Playwright com armazenamento isolado, como
se fosse outro computador.

**A pasta `privado/`.** As fichas reais dos jogadores e a campanha de referência usadas em alguns testes ficam fora do
repositório, em `privado/` (no `.gitignore`). Sem ela, os testes que dependem desses arquivos pulam e o resto roda
normalmente.

## Estrutura

```
apps/
  web/       o navegador: React + PixiJS
  server/    o Worker e os Durable Objects (a sala de cada mesa e o diretório de mesas)
  mcp/       o servidor MCP em stdio, para o Claude Desktop
packages/
  shared/    o núcleo puro: tipos, schemas, regras 5e, geometria, automações, ferramentas do MCP
e2e/         testes Playwright com vários jogadores
fixtures/    dados de teste (a semente da mesa, a campanha 5e padrão, o compêndio de exemplo)
docs/        documentação
```

## Documentação

- [`docs/explicacao/`](docs/explicacao/README.md): o ponto de partida. O que é, as decisões e como cada área funciona.
- [`PROJETO.md`](PROJETO.md): a especificação do produto, lote a lote.
- [`docs/protocolo.md`](docs/protocolo.md): as mensagens entre o navegador e a sala.
- [`docs/MCP.md`](docs/MCP.md), [`docs/ARQUIVOS.md`](docs/ARQUIVOS.md), [`docs/COMPENDIO.md`](docs/COMPENDIO.md) e
  [`docs/WHISPER.md`](docs/WHISPER.md): guias de uso.
- [`docs/ESTADO.md`](docs/ESTADO.md): o diário do que foi entregue.

## Conteúdo de D&D

As regras vêm do **SRD 5.1** (regras de 2014), da Wizards of the Coast, sob a licença
[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode); a atribuição está em
[`packages/shared/src/srd/ATRIBUICAO-SRD.md`](packages/shared/src/srd/ATRIBUICAO-SRD.md). Nenhum texto de livro entra no
repositório: o compêndio completo é um arquivo do mestre, na pasta dele.
