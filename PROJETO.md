# Tabletop — visão e plano de implementação

> Nome provisório. Documento-base do projeto: explica a ideia, as decisões de arquitetura e divide a
> implementação em **lotes entregáveis e verificáveis**, todos rodando **só na máquina local**
> (`localhost`). Deploy na internet está fora deste plano.

---

## 1. A ideia

Um tabletop virtual (VTT) próprio para mestrar D&D 5e com um grupo fixo de **até 8 pessoas**
(o mestre e os amigos). Não é um produto para outros usuários: é uma mesa para um grupo.

Inspirado nas mesas virtuais conhecidas, corrigindo o que incomoda nelas:

| Incômodo | Como o Tabletop resolve |
|---|---|
| Mesas virtuais de assinatura cobram para liberar as funções boas | Projeto próprio, sem assinatura |
| Mesas virtuais de assinatura têm limite de armazenamento para mapas e tokens | Os arquivos ficam na pasta de cada pessoa no próprio PC; o servidor não guarda imagens |
| Foundry exige configurar rede para os jogadores entrarem | Os jogadores só abrem um link no navegador (nesta fase: `localhost`) |
| Fichas presas em outra mesa virtual | Importação da ficha impressa em PDF |

Funções principais:
- mapa com grid, tokens, régua e camadas (inclusive a camada só do mestre);
- assets (mapas, tokens, retratos) lidos de uma pasta local de cada usuário, sem limite de servidor;
- paredes, portas, iluminação dinâmica, visão no escuro e névoa de guerra;
- permissões por papel: o mestre define quem é jogador e liga ou desliga cada recurso para eles;
- o mestre define o alcance de visão de cada personagem e enxerga o mapa inteiro, com um modo de visão
  noturna que destaca o que os jogadores estão vendo;
- objetos de luz (tochas, lanternas, fogueiras) com tempo contado pela sala: saem da mochila para a mão
  do token, passam de um jogador para outro, vão para suportes e acendem pontos inflamáveis;
- automações da mesa: ciclos, eventos e reações configurados pelo mestre, com botões para disparar,
  pausar e retomar;
- dados rolados no servidor, chat, rolagens escondidas do mestre;
- ficha de D&D 5e com cálculos automáticos e rolagens clicáveis;
- iniciativa e condições;
- servidor MCP para configurar a mesa com IA e acelerar a construção do mundo.

**A mesa é genérica; a campanha é conteúdo.** Nenhuma regra de uma campanha específica fica no código:
durações, limites, efeitos e ciclos são configuração da campanha, feita pelo mestre (ou pela IA via
MCP). A **premissa que diferencia** o Tabletop é a das imagens locais: nada de imagem no servidor.

Campanha de referência ("A Chama Primordial", D&D 5e, níveis 6→9): horror de sobrevivência, escuridão
absoluta, **tochas de 30 minutos reais** (estilo Shadowdark) e uma montanha que "respira" (ciclos que
ameaçam as tochas e enchem as cavernas de névoa). Ela é a primeira campanha inserida na mesa e serve de
**teste de aceitação**: o motor tem que expressá-la só com configuração
(`fixtures/campanhas/chama-primordial.json`), ao lado de uma campanha "5e padrão" (tocha de 1 h, sem
ciclos). A história está no projeto 3D da campanha (`../Dungeon/docs/MASMORRA.md`), que não é ligado
ao tabletop. O mundo é todo métrico: **1 quadrado = 1,5 m** (5 ft).

---

## 2. Escopo

**Dentro:**
- uma campanha ativa por instalação, até 8 usuários simultâneos;
- tudo funcionando em `localhost`: o servidor local da sala e o front em servidor de desenvolvimento;
- testes que simulam vários jogadores na mesma máquina.

**Fora (por enquanto):**
- deploy na internet, domínio, login real (o projeto já nasce preparado, mas isso é outro plano);
- vários grupos ou usuários desconhecidos, marketplace, módulos de terceiros;
- outros sistemas além de D&D 5e;
- app mobile (o navegador do celular pode funcionar, mas não é alvo).

**Regra de rede:** em tempo de execução o app **não acessa nada na internet**. Nada de CDN, fonte
remota, analytics ou API de terceiros. Instalar dependências com o gerenciador de pacotes é permitido;
o que o app usa em execução fica no repositório.

---

## 3. Decisões de arquitetura

| Peça | Escolha | Por quê |
|---|---|---|
| Linguagem | **TypeScript** em tudo (front, servidor, pacote compartilhado) | Tipos do protocolo, regras de D&D e geometria escritos uma vez e usados nos dois lados. Os jogadores não instalam nada, então o app roda no navegador |
| Mapa | **PixiJS v8** (WebGL/WebGPU) | O mesmo motor do Foundry; aguenta dezenas de luzes com shader; filtros em GLSL |
| Interface | **React + Vite** | Fichas, chat e painéis; maior ecossistema |
| Servidor | **Cloudflare Workers + Durable Objects** rodando localmente com `wrangler dev` | Um Durable Object é uma "sala" com estado em memória e SQLite próprio. É exatamente o formato de uma mesa. Localmente roda no `workerd`, sem conta e sem internet |
| Persistência | SQLite do Durable Object | Estado da campanha, fichas, cenas, chat, névoa |
| Validação do protocolo | **zod** no pacote compartilhado | Mensagens validadas nos dois lados |
| Assets | File System Access API + OPFS + hash SHA-256 | Arquivos ficam no PC de cada um; cache em disco no navegador |
| PDF | **pdf.js** (`pdfjs-dist`) | Ler o texto e a posição da ficha impressa |
| Testes | **Vitest** (unidade) + **Playwright** (ponta a ponta com vários jogadores) | Cada contexto do Playwright tem armazenamento isolado, como se fosse outro PC |
| Monorepo | **pnpm workspaces** | `apps/web`, `apps/server`, `packages/shared` |
| Conteúdo D&D | SRD 5.1 (regras 2014), licença CC-BY-4.0, em JSON dentro do repo | Decidido: regras de 2014. A ficha de referência (Darion) é a ficha 5e de 2014 impressa |
| IA | Servidor **MCP** local (stdio) em `apps/mcp` | Configurar a mesa com IA usando as mesmas intenções, schemas e permissões dos clientes (seção 4.12) |

### 3.1 Princípios

1. **O servidor manda.** A sala é autoritativa: recebe intenções ("quero mover o token"), valida
   pelo papel do usuário, aplica e avisa os outros. Ninguém altera o estado direto.
2. **Cada um recebe só o que pode ver.** A sala monta uma visão filtrada por usuário: tokens da camada
   do mestre, tokens ocultos, notas do mestre e portas secretas nunca chegam ao navegador do jogador.
   Com o F12 aberto, ninguém descobre o goblin escondido. Atenção: até existir o filtro por linha de
   visão (ver "Depois"), um token visível que só está no escuro ainda chega ao navegador; para esconder
   de verdade, marque como oculto.
3. **Dados rolam no servidor** (`crypto.getRandomValues`). Um resultado enviado pelo cliente é ignorado.
4. **Imagem é local, dado é da sala.** Arquivos pesados ficam nas pastas dos usuários. Estado e fichas
   (poucos KB) ficam na sala.
5. **Nada de botão "salvar".** Toda ação vai para a sala na hora. Refresh nunca perde nada.
6. **O tempo é da sala.** Tochas, ciclos e efeitos são contados pela sala. O navegador nunca usa o
   relógio do PC para regra: recebe da sala "restam 12:34" (se puder ver) ou só o estágio ("forte",
   "fraca", "morrendo") e apenas anima entre uma atualização e outra. Como a sala hiberna e pode
   reiniciar, por dentro ela guarda o saldo e o instante em que a contagem começou **pelo relógio
   dela**, e um agendador único a acorda no próximo vencimento.
7. **Lógica pura no pacote compartilhado.** Regras de D&D, geometria de visão, parser de dados,
   automações e importação de PDF ficam em `packages/shared`, sem DOM, com testes.
8. **Permissão por capacidade.** Toda intenção exige uma capacidade com nome (`tocha.entregar`,
   `porta.abrir`...), conferida pela sala em toda mensagem. O mestre liga ou desliga cada uma para os
   jogadores; algumas são só do mestre e não podem ser delegadas.
9. **Mesa genérica.** Se uma campanha precisa de um `if` no código, falta configuração, não código.

---

## 4. Arquitetura

```
 PC do mestre                         "Nuvem" (nesta fase: wrangler dev em localhost)        PCs dos jogadores
 ┌──────────────────────┐             ┌────────────────────────────────────┐            ┌──────────────────────┐
 │ Pasta da campanha    │             │ Worker (entrada HTTP/WebSocket)    │            │ Pasta do jogador     │
 │  mapas/ tokens/ ...  │             │   └─ Durable Object "Sala"         │            │  tokens/ retratos/   │
 │  recebidos/<jogador> │             │       ├─ estado em memória         │            │  fichas/             │
 └─────────┬────────────┘             │       ├─ SQLite (persistência)     │            └─────────┬────────────┘
           │ File System Access API   │       ├─ alarmes (tochas)          │  WebSocket           │
 ┌─────────▼────────────┐  WebSocket  │       ├─ filtro de visão por papel │◄────────────►┌───────▼──────────────┐
 │ Navegador do mestre  │◄───────────►│       └─ repasse de arquivos       │              │ Navegador do jogador │
 │  PixiJS + React      │             │          (não guarda imagens)      │              │  cache OPFS          │
 │  cache OPFS          │             └────────────────────────────────────┘              └──────────────────────┘
 └──────────────────────┘
```

### 4.1 Modelo de dados (esboço)

```ts
type Papel = 'mestre' | 'jogador' | 'assistente';   // assistente = MCP (seção 4.12)

interface Usuario   { id: string; nome: string; papel: Papel; cor: string }
// só o mestre muda papéis; a sala recusa deixar a mesa sem nenhum mestre

type Capacidade =                   // lista completa em docs/protocolo.md
  | 'token.moverProprio' | 'porta.abrir' | 'tocha.acender' | 'tocha.entregar' | 'ponto.usar'
  | 'luz.apagar' | 'ficha.verOutras' | 'dado.rolarOculto' | 'asset.subir';
// só do mestre, nunca delegáveis: papel.alterar, permissao.alterar, mesa.configurar,
// automacao.editar, camadaMestre.ver, objeto.ajustar

interface Permissoes {
  jogadores: Record<Capacidade, boolean>;                           // padrão da mesa
  porUsuario: Record<string, Partial<Record<Capacidade, boolean>>>; // exceções por usuário
}

interface ConfigDaMesa {            // por campanha; só o mestre altera
  regras: '5e-2014';
  maosPorPersonagem: number;        // padrão 2: no máximo 2 objetos na mão
  penalidadeAoApagarS: number;      // padrão 0 (a campanha de referência usa 60)
  alcanceInteracaoM: number;        // entregar tocha, usar ponto (padrão 1,5)
  tempoParaJogadores: 'exato' | 'estagio' | 'oculto';   // o mestre sempre vê o exato
}

interface Personagem {
  id: string;
  donoId: string | null;            // null = NPC controlado pelo mestre
  nome: string;
  ficha: Ficha;                     // ver lote 9
  tokenPadrao: { assetHash: string; tamanhoQuadrados: number };
  visao: { alcanceM: number | null; visaoNoEscuroM: number };
  // a luz vem dos objetos que ele carrega (ObjetoDeLuz), não do personagem
}

interface Cena {
  id: string; nome: string;
  mapa: { assetHash: string; larguraM: number; alturaM: number } | null;
  grid: { quadradoM: number /* 1.5 */; pxPorQuadrado: number };
  luzAmbiente: number;              // 0 = escuridão total, 1 = dia
}

interface Token {
  id: string; cenaId: string; personagemId: string | null;
  assetHash: string;
  x: number; y: number;             // em metros
  camada: 'tokens' | 'mestre';
  oculto: boolean;
}

interface Parede {
  id: string; cenaId: string;
  a: { x: number; y: number }; b: { x: number; y: number };
  tipo: 'parede' | 'porta' | 'janela' | 'secreta' | 'invisivel';
  estado?: 'aberta' | 'fechada' | 'trancada';   // só para portas
}

interface Luz {
  claraM: number; penumbraM: number;            // tocha 5e: 6 m + 6 m
  cor: string; tremula: boolean;
}

interface ModeloDeObjeto {          // criado pelo mestre na campanha: "Tocha", "Lanterna", "Fogueira"
  id: string; nome: string;
  luz: Luz;
  duracaoS: number | null;          // null = não se consome
  ocupaMao: boolean;
  tags: string[];                   // ex.: "chama", usadas pelas automações
  reacoes: Reacao[];                // seção 4.11
}

type Portador =
  | { tipo: 'mochila'; personagemId: string }
  | { tipo: 'mao'; personagemId: string; mao: number }   // luz sai do token dele na cena ativa
  | { tipo: 'proprio'; personagemId: string }            // criatura que brilha; não ocupa mão
  | { tipo: 'ponto'; pontoId: string }
  | { tipo: 'cena'; cenaId: string; x: number; y: number };  // luz fixa do mapa

interface ObjetoDeLuz {             // uma tocha específica; as novas são só quantidade na mochila
  id: string; modeloId: string;
  portador: Portador;
  estado: 'acesa' | 'apagada' | 'consumida';
  saldoMs: number | null;           // tempo que sobra; a sala desconta enquanto está acesa
  acesaDesde?: number;              // instante NO RELÓGIO DA SALA; nunca vai para o navegador
  modificadores: Modificador[];     // efeitos na luz
  historico: { emSala: number; deltaMs?: number; texto: string }[];
  // ajustes de tempo entram direto no saldo e ficam no histórico:
  // "−1 min: apagada", "+1 min (mestre): apagou sem querer"
}

interface Ponto {                   // lugar do mapa onde se põe ou se acende uma luz
  id: string; cenaId: string; x: number; y: number;
  tipo: 'suporte' | 'inflamavel';
  capacidade?: number;              // suporte: quantos objetos cabem
  modeloId?: string;                // inflamável: no que ele vira ao queimar (ex.: "Fogueira")
  segurarS?: number;                // inflamável: tempo segurando a tocha acesa em cima (padrão 3)
  visivelParaJogadores: boolean;
}

interface Modificador {
  id: string; raioX: number;        // multiplica luz plena e penumbra
  ateSala?: number;                 // fim no relógio da sala; sem fim = até o mestre tirar
  origem: 'mestre' | 'automacao'; nota?: string;
}

interface Asset {
  hash: string;                                 // SHA-256 do arquivo já processado
  tipo: 'mapa' | 'token' | 'retrato' | 'handout' | 'audio';
  mime: string; bytes: number;
  largura?: number; altura?: number;
  donoId: string; nomeOriginal: string;
  tiles?: string[];                             // mapas grandes: hashes dos pedaços
}
```

A separação **personagem × token** é importante: o personagem (ficha, visão) existe uma vez só; o
token é apenas a posição dele numa cena. Levar o grupo para outro mapa é **uma única mensagem**.

A **luz pertence ao objeto, não ao personagem.** O objeto tem um portador (mochila, mão, o próprio
corpo, um ponto do mapa ou a cena) e a luz sai de onde o portador está. Entregar uma tocha ou pendurá-la
num suporte é só trocar o portador, e o saldo de tempo vai junto. A tocha na mão acompanha o personagem
quando ele muda de cena.

### 4.2 Protocolo

- JSON validado com zod para mensagens de controle; **frames binários** para pedaços de arquivo
  (cabeçalho com hash e índice).
- Cada mensagem tem versão do protocolo (`v`). A sala numera os eventos (`seq`).
- Ao conectar ou reconectar, o cliente recebe um **snapshot filtrado** e depois só eventos.
- Movimento ao vivo (`token.mover`) é transitório e não é gravado. Só `token.soltar` grava.
- O documento `docs/protocolo.md` lista todas as mensagens e é atualizado em todo lote que mexer nelas.

Exemplos de intenções do cliente: `entrar`, `token.mover`, `token.soltar`, `parede.criar`,
`porta.alternar`, `ficha.alterar` (patch), `dado.rolar`, `chat.enviar`, `asset.anunciar`, `asset.pedir`,
`asset.tenho`, `cena.ativar`, `grupo.moverPara`, `objeto.acender`, `objeto.apagar`, `objeto.mover`
(entregar, guardar, pôr no suporte), `ponto.acenderInicio`/`ponto.acenderFim`, `objeto.ajustar`,
`ciclo.disparar`/`ciclo.pausar`/`ciclo.retomar`, `evento.disparar`, `papel.alterar`,
`permissao.alterar`, `nevoa.revelar`.

Cada intenção declara a capacidade exigida (princípio 8) e o schema zod dela. O MCP usa exatamente as
mesmas intenções.

Exemplos de eventos da sala: `snapshot`, `evento`, `presenca`, `asset.pedaco`, `rolagem`, `uso`, `erro`.

### 4.3 Assets locais

**Pastas.** Cada usuário aponta uma pasta no próprio PC (File System Access API, Chrome ou Edge; o
Chrome pode lembrar a permissão entre visitas). Quem usa Firefox ou Safari arrasta arquivos ou escolhe
a pasta a cada vez. Como tudo vai para o cache depois de enviado, a pasta só importa na hora de
adicionar ou trocar arquivo.

Estrutura sugerida:
- mestre: `mapas/`, `tokens/`, `sons/`, `handouts/`, `recebidos/<jogador>/`, `backup/`
- jogador: `tokens/`, `retratos/`, `fichas/`

**Identidade por conteúdo.** O asset é identificado pelo SHA-256 do arquivo (depois do processamento).
Se o arquivo for movido ou renomeado, o app reescaneia a pasta e encontra pelo hash.

**Processamento antes de enviar:**
- token e retrato: redimensionados para no máximo 512 px e convertidos para WebP;
- mapa: WebP; se algum lado passar do `MAX_TEXTURE_SIZE` da GPU (ou de 8192 px), é fatiado em tiles
  e o asset vira um manifesto com os hashes dos pedaços.

**Distribuição:**
1. Quem precisa de um hash procura no próprio cache (OPFS).
2. Se não tiver, pede para a sala (`asset.pedir`).
3. A sala escolhe alguém online que tenha o arquivo (dono, mestre ou qualquer jogador que já o tenha em
   cache) e pede o envio.
4. O arquivo vai em pedaços numerados (256 KB a 1 MB). A sala repassa a **todos** que estão esperando:
   o dono envia uma vez, não sete. A sala **não grava** os pedaços.
5. Quem recebe confere o SHA-256, grava no OPFS e avisa `asset.tenho`.
6. Se a conexão cair no meio, retoma do último pedaço recebido.

**Garantias:**
- o navegador do mestre guarda cópia de tudo que os jogadores sobem em `recebidos/<jogador>/`
  (backup completo da campanha);
- `navigator.storage.persist()` para o navegador não limpar o cache quando faltar espaço;
- o servidor não tem limite de armazenamento porque não armazena imagens.

**Abstração para testes:** `FonteDeAssets` com implementações `PastaLocal` (File System Access),
`ArquivosSoltos` (input/arrastar) e `Memoria` (testes automatizados).

### 4.4 Persistência e refresh

- Refresh ou queda: o cliente reconecta, recebe o snapshot e lê os assets do cache. Os outros continuam
  jogando; para eles aparece "fulano reconectando".
- O que ainda não foi enviado (mensagem do chat pela metade, campo da ficha em edição) fica como
  rascunho no `localStorage` e volta depois do refresh.
- A sala grava tudo no SQLite. Se a sala reiniciar, recarrega do banco.
- Gravações: token só ao soltar; ficha agrupada (no máximo 1 gravação por segundo por ficha); névoa a
  cada poucos segundos por jogador.
- Se o mestre fechar o navegador, a mesa continua. Opção de pausar automaticamente quando o mestre sai.
- **Exportar/importar a campanha** (mestre): um JSON com todo o estado da sala (cenas, paredes, fichas,
  objetos, automações, névoa, chat), sem imagens. Serve de backup na pasta `backup/` do mestre e para
  levar a campanha de uma instalação para outra.

### 4.5 Orçamento do plano grátis (para o futuro deploy)

Nesta fase tudo é local e sem limite, mas o projeto já respeita o plano grátis dos Durable Objects para
não precisar de reescrita depois:
- 100 mil requisições/dia; **cada 20 mensagens recebidas pela sala contam 1 requisição**; mensagens
  enviadas pela sala não contam; cada conexão conta 1;
- 13.000 GB-s/dia de processamento; 100 mil linhas gravadas/dia; 5 GB de SQLite;
- o contador zera à 00:00 UTC (21h em Brasília).

Regras que decorrem disso:
- arrastar token envia no máximo **20 atualizações/s**, só enquanto arrasta; os outros clientes
  interpolam o movimento;
- ações rápidas podem ser agrupadas em uma mensagem por "tick" de 50 ms;
- a sala conta as mensagens recebidas por dia UTC e o painel do mestre mostra "uso de hoje: X%".

Estimativa de uma sessão pesada de 3h com 8 pessoas: ~15 mil requisições (15% do limite).

### 4.6 Autenticação em desenvolvimento

Tela de entrada que lista os usuários da campanha (definidos em `campanha.seed.json`). O usuário
escolhido vai num cookie e a sala confia nele **em modo dev**. Tudo passa por uma interface
`Autenticacao`, para que no futuro seja trocada por login real sem mexer no resto.

Papéis e capacidades valem desde o lote 1, mas só viram segurança de verdade com login real: em dev,
quem escolhe o usuário mestre na tela de entrada é mestre.

### 4.7 Paredes, luz e visão

- **Paredes** são segmentos com tipo: `parede`; `porta` (aberta/fechada/trancada); `janela` (bloqueia
  passagem, não visão); `secreta` (para jogadores é parede comum, para o mestre é porta); `invisivel`
  (bloqueia passagem, não visão).
- **Polígono de visibilidade** por fonte (luz ou olho do token): raios até as pontas dos segmentos e
  varredura angular (algoritmo "2D visibility" da Red Blob Games). Recalcula só quando algo se move.
- **Render:** camada de escuridão sobre o mapa; cada luz desenha o próprio polígono com raio de luz
  plena e penumbra, em blend aditivo numa RenderTexture. O jogador vê a interseção entre o que está
  iluminado e o que o token dele enxerga, mais a visão no escuro (em tons de cinza, via filtro GLSL).
- **Névoa explorada:** acumulada por jogador e por cena numa grade de 0,5 m, compactada e gravada na
  sala (~20 KB para 200×200 m). O mestre pode resetar.
- **Por token o mestre define:** alcance de visão, visão no escuro, quem controla e quem enxerga
  através dele. A luz vem dos objetos que o personagem carrega (seção 4.8).
- **Visão do mestre:** o mestre é o único que vê o mapa inteiro sem precisar de luz. Modos:
  - *normal*: tudo visível;
  - *visão noturna* (checkbox, como no jogo 3D): o que está escuro aparece com o filtro de visão
    noturna (tons de cinza) e a **união do que todos os jogadores estão vendo** aparece normal. A união
    sai barata: a máscara de visão de cada jogador é desenhada na mesma RenderTexture, sem conta de
    polígonos;
  - *ver como o jogador X*.

### 4.8 Relógio da sala e objetos de luz

**Relógio.**
- A sala conta todo o tempo (princípio 6). Um **agendador único** guarda a fila de tudo que vence (fim
  de tocha, fase de ciclo, fim de modificador) e mantém o alarme do Durable Object no próximo
  vencimento, porque cada Durable Object tem **um alarme por vez**.
- O mestre pode **pausar a mesa** (intervalo da sessão): tudo congela. Pausar um ciclo (seção 4.11) é
  outra coisa e não para as tochas.
- O que o jogador vê do tempo é configuração (`tempoParaJogadores`): exato, só o estágio ("forte",
  "fraca", "morrendo") ou nada. Fora do modo exato, o número **não sai da sala** para o jogador (pode ser
  um recurso de roleplay). O mestre sempre vê o tempo de todas as luzes.

**Da mochila para a mão.**
- Na ficha, a mochila mostra "Tochas: x". Clicar em acender cria o objeto **na mão do token** (se houver
  mão livre), já iluminando o raio dele; a ficha passa a mostrar x−1 novas e 1 usada.
- Cada personagem segura no máximo `maosPorPersonagem` objetos (padrão 2).
- A tocha apagada continua na mão até ser guardada; reacender usa o mesmo saldo. Esgotada, vira
  `consumida`.
- A tocha aparece como uma alça junto ao token: arrastar o token move o token, arrastar a alça move a
  tocha.

**Entregar e pôr em pontos.**
- O portador (dono do personagem) ou o mestre arrasta a alça até outro token **dentro do alcance**
  (`alcanceInteracaoM`) que tenha mão livre: a tocha muda de mão com o saldo que tinha. Ninguém mais
  consegue arrastar a tocha alheia.
- **Suporte**: ponto do mapa onde se solta a tocha, que passa a iluminar dali. Tirar de volta exige
  `ponto.usar` e alcance.
- **Inflamável**: segurar a tocha acesa sobre o ponto por `segurarS` (padrão 3 s) acende o ponto, que
  vira o objeto do modelo dele (ex.: fogueira, com duração própria ou infinita). A tocha continua na
  mão. O cliente manda `ponto.acenderInicio` e `ponto.acenderFim`; a sala confere o tempo **pelo relógio
  dela**, o alcance e se a tocha está acesa.
- **Apagar**: dois cliques na alça da tocha ou no ponto aceso. Desconta `penalidadeAoApagarS`.

**Ajustes do mestre.** Clicando numa luz, o mestre vê saldo e histórico e aplica ajustes individuais:
somar ou tirar tempo ("apagou sem querer, devolvendo 1 min"), modificar o raio, trocar o portador. Tudo
entra no histórico do objeto.

### 4.9 Ficha 5e

- A ficha é JSON com **valores base** (atributos, níveis por classe, proficiências marcadas, itens,
  ataques, magias, recursos, PV, dados de vida, testes contra morte, notas).
- **Derivados por fórmula:** modificadores, bônus de proficiência pelo nível total, salvaguardas,
  perícias, percepção passiva, iniciativa, CD e ataque de magia.
- Todo número rolável é clicável e manda a rolagem formatada para o chat (ataque + dano + crítico).
- Ataque pode ser fórmula ou valor fixo (o import de PDF traz valores fixos).
- Recursos de classe e consumíveis são contadores (flechas, tochas, Canalizar Divindade...). Item ligado
  a um modelo de objeto (tocha) acende direto da ficha e vai para a mão do token (seção 4.8).
- Permissões: o jogador edita a própria ficha; o mestre edita todas.
- Exportação da ficha em JSON para a pasta do jogador (`fichas/`).

### 4.10 Importação da ficha em PDF

O jogador imprime a ficha em PDF pelo navegador e importa no Tabletop. Tudo roda no navegador
dele; o PDF não sai do PC, só o JSON resultante vai para a sala.

O PDF de referência (`fixtures/fichas/darion.pdf`) é a ficha "D&D 5E" em português,
impressa pelo Chrome: **tem texto real** (sem imagem, sem campos de formulário), 8 páginas — ficha
principal, continuação de ataques e equipamento, conjuração, características, e as magias com
descrição completa.

Pipeline:
1. **Extrair o texto com posição** (`getTextContent` do pdf.js: cada pedaço com x/y).
2. **Âncoras por rótulo** em PT e EN ("FORÇA"/"STRENGTH", "CLASSE & NÍVEL", "Pontos de Vida
   Máximo"...). O valor é procurado na posição relativa esperada em relação ao rótulo, nunca em
   coordenada absoluta, porque A4/Carta e escala de impressão deslocam tudo.
3. **Colunas:** nas páginas de magias, separar as três colunas pelo x e quebrar em blocos (nome,
   escola + nível, campos, descrição).
4. **Proficiência deduzida pela conta**, já que as bolinhas são desenho:
   valor da perícia − modificador = bônus de proficiência → proficiente; = 2× → especialização;
   outro valor → vai para revisão.
5. **Recuperar textos cortados com "…"** cruzando com o resto do PDF (ex.: "Chill Touch (…" com a lista
   de magias da página de conjuração).
6. **Tela de revisão:** valor lido ao lado do trecho do PDF; campos incertos em amarelo; nada entra na
   sala sem o jogador confirmar.

Problemas conhecidos no PDF de referência:
- nomes cortados: "Machadinho …" (3 ataques diferentes: +11, +11, +13), "Cure Wound…",
  "Chill Touch (…", "Prestidigitação (D…", "Armadura de c…", "Sun Blade - un…", "Adestrar Animais …";
- ataques trazem só o total ("Sun Blade +13, 1d8+9"), sem a origem do bônus;
- caixas de recurso repetidas ("FLECHAS (MAX 20)" aparece várias vezes);
- campos vazios (PV atuais, PV temporários, outras proficiências e idiomas);
- texto em português misturado com inglês (magias em inglês).

### 4.11 Automações da mesa

"Funções customizadas" que o mestre monta por campanha. Três peças:

- **Ciclos:** timer com período e fases; cada fase dispara um evento com nome num ponto do ciclo. Cada
  ciclo vale para as cenas escolhidas e tem botões **disparar agora**, **pausar** e **retomar**, que o
  mestre pode fixar na barra dele (e, se quiser, liberar algum para os jogadores por capacidade).
- **Eventos:** vêm das fases dos ciclos, de botões do mestre (`evento.disparar`) ou do próprio sistema
  (`objeto.acendeu`, `objeto.apagou`, `token.entrouNaZona`, `turno.inicio`, `cena.ativada`).
- **Reações:** "ao receber o evento X, [se condição], faça Y". Ficam no **modelo do objeto** (toda tocha
  nova já herda), em zonas do mapa ou na cena.

Exemplo (respiração da montanha, da campanha de referência):

```json
"ciclos": [{ "id": "respiracao", "nome": "Respiração da Montanha", "periodoS": 180, "cenas": ["pulmao"],
  "fases": [{ "emS": 0,  "evento": "inspiracao", "duracaoS": 20 },
            { "emS": 90, "evento": "expiracao",  "duracaoS": 30 }] }],
"modelos": [{ "id": "tocha", "nome": "Tocha", "duracaoS": 1800, "tags": ["chama"],
  "reacoes": [{ "ao": "inspiracao", "fazer": [
    { "acao": "luz.modificar", "raioX": 0.5, "porS": 20 },
    { "acao": "objeto.apagar", "chance": 0.3, "penalidadeS": 300 } ] }] }]
```

Regras do motor:
1. **Ações de uma lista fechada, descritas em JSON e validadas com zod**, nunca código livre:
   `luz.modificar`, `objeto.apagar` (chance, penalidade), `objeto.ajustarTempo`, `visao.limitar`,
   `chat.anunciar`, `som.tocar`, `token.mostrar`/`token.ocultar`, `zona.ativar`, `evento.disparar`.
   Condições: `chance`, `tag`, `dentroDaZona`, `cena`. Seguro, testável com semente fixa e fácil de a IA
   gerar.
2. **Efeito temporário é modificador com prazo**, nunca alteração do valor base. O valor final é base +
   modificadores ativos; efeitos sobrepostos, refresh e reconexão não deixam nada preso.
3. Tudo roda **na sala**, pelo agendador único (seção 4.8), com sorteios no RNG do servidor. Pausar a
   mesa pausa os ciclos.
4. **Escopo por cena:** o evento de um ciclo só atinge o que está nas cenas dele.
5. **Limite de encadeamento:** reação que dispara evento que dispara reação para numa profundidade
   máxima.
6. **Zonas:** polígonos do mapa com reações e efeitos enquanto um token ou objeto está dentro (gás que
   enfraquece chamas, ar rarefeito).
7. Automações são dados do mestre: nunca chegam ao navegador do jogador, só os efeitos delas.

### 4.12 MCP (configurar a mesa com IA)

Servidor MCP local (stdio) em `apps/mcp`, usado pelo Claude (Code ou Desktop) para construir o mundo:
criar cenas, notas do mestre, modelos de objeto, pontos, zonas, ciclos, reações e NPCs.

- **É mais um cliente da sala, não uma porta dos fundos:** passa pelas mesmas intenções, schemas zod e
  capacidades. As ferramentas do MCP são geradas a partir dos schemas.
- Conecta no `localhost` da sala com um **token gerado pelo mestre** e entra com o papel `assistente`:
  cria e edita conteúdo, mas não mexe em fichas de jogador, não rola dados e não muda papéis.
- **Tudo o que a IA cria entra como rascunho**, invisível para os jogadores até o mestre publicar, com
  **desfazer em lote**.
- **Não envia imagens** (premissa das imagens locais): refere-se aos arquivos pelo nome ou hash, e o
  navegador do mestre busca na pasta dele.
- Bom para regras, objetos, NPCs, notas e automações (pode ler a bíblia de uma campanha e popular a
  mesa). Ruim para desenhar paredes em cima de imagem: para isso, o editor de paredes.

---

## 5. Estrutura do repositório

```
Tabletop/
├─ PROJETO.md                 este documento
├─ docs/
│  ├─ ESTADO.md               o que está pronto, decisões e desvios (atualizado a cada lote)
│  └─ protocolo.md            todas as mensagens cliente ↔ sala
├─ apps/
│  ├─ web/                    React + Vite + PixiJS
│  ├─ server/                 Worker + Durable Object "Sala" (wrangler)
│  └─ mcp/                    servidor MCP local (stdio) que fala com a sala
├─ packages/
│  └─ shared/                 tipos, schemas zod, regras 5e, geometria, dados, automações, import de PDF
├─ e2e/                       testes Playwright com vários jogadores
├─ fixtures/
│  ├─ fichas/darion.pdf
│  ├─ mapas/                  imagens de teste (pequena, grande para tiles)
│  ├─ campanhas/              chama-primordial.json e 5e-padrao.json (testes de aceitação)
│  └─ campanha.seed.json      usuários de teste (1 mestre + 7 jogadores)
└─ package.json               scripts do monorepo
```

## 6. Como rodar e verificar localmente

Requisitos: Node LTS, pnpm, Chrome ou Edge.

- `pnpm dev`: sobe a sala (`wrangler dev`, local) e o front (`vite`), tudo em `localhost`.
- `pnpm verify`: typecheck + lint + testes de unidade + testes ponta a ponta. **Nenhum lote está
  pronto sem `pnpm verify` verde.**
- Vários jogadores na mesma máquina: nos testes, um contexto do Playwright por jogador (armazenamento
  isolado). À mão, use **perfis diferentes do Chrome** ou navegadores diferentes; janelas anônimas da
  mesma sessão compartilham armazenamento e não simulam PCs diferentes.
- O estado local da sala fica em `.wrangler/state` (fora do git). Apagar essa pasta zera a campanha.
- `localhost` conta como contexto seguro, então File System Access, OPFS e `crypto.subtle` funcionam.

---

## 7. Lotes

Cada lote tem objetivo, entregáveis, verificação automática, roteiro manual e critério de pronto.
Tamanho relativo: **P** (pequeno), **M** (médio), **G** (grande).

Marcos:
- **Marco A — mesa básica** (lotes 0–4): mapa, tokens, permissões, assets locais, cenas.
- **Marco B — exploração** (lotes 5–7b): paredes, luz, névoa, objetos de luz, automações. Com isso já
  dá para jogar uma sessão usando fichas fora do app.
- **Marco C — mesa completa** (lotes 8–11): dados, chat, ficha, import de PDF, combate.
- **Marco D — mesa assistida** (lote 12): MCP. Pode vir logo depois do 7b se a ideia for construir a
  campanha com IA antes dos lotes 8–11.

---

### Lote 0 — Fundação do repositório (P)

**Objetivo:** esqueleto que compila, testa e sobe localmente.

**Entregáveis:**
- monorepo pnpm com `apps/web`, `apps/server`, `packages/shared`, TypeScript estrito, lint e format;
- Vitest configurado nos três pacotes; Playwright em `e2e/` subindo `pnpm dev` sozinho;
- Durable Object "Sala" de eco: aceita WebSocket (Hibernation API) e devolve o que recebe;
- página web que conecta e mostra "conectado";
- `docs/ESTADO.md` e `docs/protocolo.md` criados.

**Verificação automática:**
- teste de unidade de exemplo em `shared`;
- E2E: dois contextos abrem a página e ambos mostram "conectado".

**Roteiro manual:** `pnpm dev`, abrir `localhost` no Chrome, ver "conectado"; desligar a internet e
repetir (tem que funcionar igual).

**Pronto quando:** `pnpm verify` verde e o roteiro funciona offline.

---

### Lote 1 — Sala, papéis e sincronização (M)

**Objetivo:** a sala vira autoritativa, com usuários, presença e persistência.

**Entregáveis:**
- `campanha.seed.json` com 1 mestre e 7 jogadores; tela de entrada (autenticação de dev, seção 4.6);
- protocolo versionado com zod; snapshot ao conectar e eventos numerados (`seq`);
- presença (quem está online, "reconectando");
- persistência em SQLite; recarga do estado ao reiniciar a sala;
- reconexão automática do cliente com backoff;
- contador de mensagens recebidas por dia UTC e evento `uso` para o mestre;
- uma entidade de teste simples (ex.: "nota da mesa" editável) para provar o ciclo completo;
- capacidades e permissões (princípio 8): checagem em toda intenção; painel do mestre para ligar e
  desligar capacidades dos jogadores e mudar papéis; a sala recusa deixar a mesa sem mestre e manda
  snapshot novo para quem mudou de papel;
- exportar e importar a campanha em JSON (seção 4.4).

**Verificação automática:**
- unidade: schemas zod rejeitam mensagens malformadas; jogador não consegue executar ação de mestre;
- unidade: capacidade desligada → intenção recusada; o último mestre não consegue se rebaixar;
- E2E: 8 contextos entram; uma alteração em um aparece nos outros 7;
- E2E: refresh de um contexto → estado volta igual;
- E2E: reiniciar o processo da sala → estado volta do SQLite;
- E2E: o mestre desliga uma capacidade e o jogador perde a ação na hora; o mestre promove um jogador
  e ele passa a receber o que é do mestre;
- E2E: exportar → apagar o estado → importar devolve tudo igual.

**Roteiro manual:** 3 perfis do Chrome (mestre + 2 jogadores); fechar e reabrir abas; parar e subir o
`pnpm dev`; conferir que nada se perde e que o contador de uso aparece para o mestre.

**Pronto quando:** `pnpm verify` verde e nenhuma ação se perde no refresh.

---

### Lote 2 — Mapa, grid e tokens (M)

**Objetivo:** mesa visual com tokens sincronizados.

**Entregáveis:**
- canvas PixiJS com pan e zoom; grid configurável (padrão 1 quadrado = 1,5 m);
- tokens com imagem de teste (ainda sem pasta local), arrastar e soltar, encaixe no grid opcional;
- envio de movimento com limite de 20/s, interpolação nos outros clientes, gravação só ao soltar;
- camadas `tokens` e `mestre`; token oculto;
- **filtro por papel na sala:** jogador nunca recebe token da camada do mestre nem token oculto;
- régua de distância em metros.

**Verificação automática:**
- unidade: limitador de envio emite no máximo 20 mensagens/s;
- E2E: arrastar no mestre move no jogador;
- E2E: arrastar por 5 s gera no máximo ~110 mensagens (contadas pelos frames do WebSocket);
- E2E: inspecionando os frames recebidos pelo jogador, nenhum contém o id de um token da camada do
  mestre ou oculto.

**Roteiro manual:** mover tokens em 2 perfis ao mesmo tempo; esconder um token e conferir no F12 do
jogador que ele não chega; medir 3 quadrados com a régua (= 4,5 m).

**Pronto quando:** `pnpm verify` verde e movimento fluido entre dois perfis.

---

### Lote 3 — Assets locais (G)

**Objetivo:** mapas e tokens vêm da pasta de cada usuário, sem armazenamento no servidor (seção 4.3).

**Entregáveis:**
- `FonteDeAssets` com `PastaLocal`, `ArquivosSoltos` e `Memoria`;
- escolha da pasta (mestre e jogador), lembrada entre visitas quando o navegador permitir;
- hash SHA-256, registro de assets na sala (dono e quem tem cópia);
- processamento: token/retrato até 512 px WebP; mapa em WebP com tiles acima do limite da GPU;
- distribuição em pedaços por frames binários, repasse para todos os interessados, verificação do
  hash, cache em OPFS, retomada após queda;
- qualquer usuário online com cópia pode servir o arquivo;
- cópia automática do que os jogadores sobem para `recebidos/<jogador>/` na pasta do mestre;
- `navigator.storage.persist()`; tela de status de transferências.

**Verificação automática:**
- unidade: fatiamento em tiles, montagem do manifesto, verificação de hash;
- E2E (com `Memoria`/`ArquivosSoltos`): mestre coloca um mapa → 7 jogadores recebem e o hash bate;
- E2E: segunda carga da página → **zero** pedaços trafegados (veio do cache);
- E2E: o mestre sai → um jogador novo recebe o mapa de outro jogador que já tinha cópia;
- E2E: pedaço corrompido é detectado e pedido de novo;
- E2E: jogador sobe o próprio token → aparece para todos e chega em `recebidos/` do mestre.

**Roteiro manual:** escolher uma pasta real no Chrome com um mapa grande (> 8192 px) e conferir que
carrega em tiles; jogador com Firefox arrastando o próprio token; refresh no meio de uma transferência.

**Pronto quando:** `pnpm verify` verde e um mapa real da sua pasta aparece em outro perfil sem nada
ser gravado no servidor.

---

### Lote 4 — Personagens e cenas (M)

**Objetivo:** separar personagem e token; várias cenas por campanha.

**Entregáveis:**
- entidade `Personagem` (com dono, visão e token padrão) separada de `Token`;
- criar, ativar e duplicar cenas; cada cena com mapa, grid e luz ambiente próprios;
- "mover grupo para a cena X" em uma única mensagem;
- "preparar cena": pré-envia os assets da cena para todos antes de ativá-la;
- o jogador só controla os tokens dos próprios personagens.

**Verificação automática:**
- E2E: mover o grupo entre cenas gera 1 mensagem do mestre e todos os jogadores mudam de cena;
- E2E: os dados do personagem (ex.: PV de teste) se mantêm ao trocar de cena;
- E2E: jogador não consegue mover token de outro jogador.

**Roteiro manual:** preparar a cena 2 enquanto o grupo está na cena 1 e conferir que a troca é instantânea.

**Pronto quando:** `pnpm verify` verde.

---

### Lote 5 — Paredes, portas e linha de visão (G)

**Objetivo:** o que cada token enxerga respeita paredes.

**Entregáveis:**
- editor de paredes do mestre (desenhar, mover pontas, apagar, mudar tipo);
- tipos `parede`, `porta`, `janela`, `secreta`, `invisivel`; abrir/fechar porta (jogador abre porta
  destrancada ao alcance; mestre faz tudo);
- polígono de visibilidade em `shared`, com testes;
- visão por token: alcance definido pelo mestre; o jogador só vê o mapa dentro da visão dos próprios
  tokens (ainda sem luz: tudo "iluminado");
- porta secreta chega ao jogador como parede comum;
- o mestre vê tudo e pode alternar "ver como o jogador X".

**Verificação automática:**
- unidade: polígono em sala quadrada vazia; sala com pilar no meio; porta aberta × fechada; janela;
  token encostado num canto; segmentos colineares;
- unidade: 500 segmentos e 8 fontes calculados em menos de 16 ms;
- E2E: o jogador não recebe o tipo `secreta` em nenhum frame.

**Roteiro manual:** desenhar um corredor com porta, abrir e fechar e ver a visão do jogador mudar.

**Pronto quando:** `pnpm verify` verde e a visão bate com as paredes visualmente.

---

### Lote 6 — Luz, visão no escuro e névoa de guerra (G)

**Objetivo:** iluminação dinâmica de verdade.

**Entregáveis:**
- luzes fixas no mapa e luz própria de personagem (objetos sem duração, seção 4.1), com luz plena e
  penumbra (tocha: 6 m + 6 m), cor e tremulação;
- luz ambiente da cena (0 = escuridão absoluta);
- render: escuridão + lightmap aditivo + interseção com a visão do token;
- visão no escuro em tons de cinza (filtro GLSL), com alcance por personagem;
- névoa explorada por jogador e por cena, gravada na sala, com botão do mestre para resetar;
- painel do mestre para configurar a visão de cada personagem;
- visão do mestre: normal, **visão noturna** (escuro com filtro, união da visão dos jogadores em cor
  normal) e "ver como o jogador X" (seção 4.7).

**Verificação automática:**
- unidade: interseção luz × visão; acúmulo e compactação da névoa;
- unidade: a máscara da visão noturna do mestre é a união das máscaras dos jogadores;
- E2E: jogador sem visão no escuro em cena com luz ambiente 0 e sem tocha não vê o mapa;
- E2E: névoa explorada sobrevive ao refresh.

**Roteiro manual:** cena escura com 3 tochas e um personagem com visão no escuro de 18 m; conferir
penumbra, cinza e névoa; medir fps com 30 luzes e 500 paredes (meta ≥ 50 fps no seu PC).

**Pronto quando:** `pnpm verify` verde e a meta de fps é atingida.

---

### Lote 7 — Relógio da sala e objetos de luz (G)

**Objetivo:** luz com duração contada pela sala, carregada, entregue e posta no mapa (seção 4.8).

**Entregáveis:**
- agendador único da sala (fila de vencimentos + um alarme do Durable Object); pausar e retomar a mesa;
- `ConfigDaMesa` editável pelo mestre (mãos, penalidade ao apagar, alcance, tempo para jogadores);
- modelos de objeto criados pelo mestre (nome, luz, duração ou infinita, ocupa mão);
- mochila mínima por personagem (quantidade de cada modelo), absorvida pela ficha no lote 9;
- acender da mochila → objeto na mão do token; limite de mãos; tremulação no estágio "morrendo"; apaga
  sozinha e vira `consumida`;
- alça da tocha no token; arrastar para entregar (portador ou mestre, dentro do alcance, mão livre);
- pontos `suporte` e `inflamavel`; acender ponto segurando a tocha por `segurarS`; dois cliques apagam;
- tempo para jogadores exato, por estágio ou oculto, filtrado na sala;
- painel do mestre: todas as luzes com saldo, histórico e ajustes individuais (tempo, raio).

**Verificação automática:**
- unidade com relógio falso da sala: tocha de 30 min apaga aos 30 min; pausa de 5 min empurra o fim em
  5 min; apagar desconta a penalidade; ajuste do mestre soma no saldo e entra no histórico;
- unidade: terceira tocha na mão é recusada com 2 mãos; acender ponto antes de `segurarS` é recusado;
- E2E: com tempo "oculto" ou "estágio", nenhum frame do jogador traz o saldo;
- E2E: outro jogador não consegue arrastar a tocha alheia; o portador entrega e o saldo vai junto;
- E2E: refresh no meio não altera o tempo restante; a ficha mostra x−1 novas e 1 usada.

**Roteiro manual:** tocha de 2 minutos acesa, refresh, pausa, retomada; entregar a tocha para outro
perfil; pôr num suporte; acender uma fogueira segurando 3 s; apagar com dois cliques e devolver 1 min
pelo painel do mestre.

**Pronto quando:** `pnpm verify` verde.

---

### Lote 7b — Automações da mesa (G)

**Objetivo:** ciclos, eventos e reações configurados pelo mestre (seção 4.11).

**Entregáveis:**
- ciclos com fases, escopo por cena e botões disparar, pausar e retomar (fixáveis na barra do mestre);
- eventos do sistema, de fase e manuais; reações em modelos, zonas e cenas;
- lista fechada de ações e condições com schema zod; modificadores com prazo;
- zonas (polígonos) com efeitos enquanto algo está dentro;
- editor de automações do mestre (formulário, com o JSON visível para quem quiser);
- `fixtures/campanhas/chama-primordial.json` e `5e-padrao.json` carregáveis.

**Verificação automática:**
- unidade com relógio falso e semente fixa: a respiração da campanha de referência dispara as fases nos
  segundos certos; a reação da tocha reduz o raio por 20 s e volta; a chance de apagar é reproduzível;
- unidade: pausar o ciclo não para as tochas; pausar a mesa para os dois;
- unidade: encadeamento além do limite é cortado; ação fora da lista é recusada pelo schema;
- E2E: nenhum frame do jogador traz a definição de uma automação;
- E2E: a campanha "5e padrão" carrega e roda sem nenhuma automação.

**Roteiro manual:** carregar a campanha de referência, entrar na cena do Pulmão com ciclo encurtado
para 30 s, ver a inspiração reduzir e apagar tochas, pausar e retomar pelo botão.

**Pronto quando:** `pnpm verify` verde.

---

### Lote 8 — Dados e chat (M)

**Objetivo:** rolagens confiáveis e chat da mesa.

**Entregáveis:**
- parser de notação em `shared`: `NdM`, somas e subtrações, `kh`/`kl` (vantagem e desvantagem),
  vários termos (`1d20+5+1d4`);
- rolagem no servidor com `crypto.getRandomValues`;
- chat com mensagens, sussurro (`/w nome`), rolagem inline (`[[1d20+5]]`), rolagem só para o mestre;
- modelos de rolagem: ataque (acerto + dano, crítico dobra os dados), teste com CD, teste simples;
- histórico do chat persistido.

**Verificação automática:**
- unidade: casos do parser (válidos e inválidos), crítico, vantagem;
- unidade: distribuição do d20 em 100 mil rolagens dentro de tolerância;
- E2E: um cliente que envia um "resultado" junto da rolagem tem esse valor ignorado;
- E2E: rolagem do mestre só para ele não aparece em nenhum frame dos jogadores.

**Roteiro manual:** rolar ataque com vantagem pelo chat; sussurrar para um jogador.

**Pronto quando:** `pnpm verify` verde.

---

### Lote 9 — Ficha 5e (G)

**Objetivo:** ficha completa com cálculos automáticos (seção 4.9).

**Entregáveis:**
- modelo da ficha em `shared` (base + derivados) e dados do SRD 5.1 em JSON no repositório, com o
  arquivo de atribuição CC-BY-4.0;
- interface: atributos, salvaguardas, perícias, CA, iniciativa, deslocamento (ft e m), PV
  atual/máximo/temporário, dados de vida, testes contra morte, ataques, conjuração (habilidade, CD,
  ataque, espaços por nível), lista de magias, características, equipamento, recursos, notas;
- multiclasse: bônus de proficiência pelo nível total; espaços de magia de multiclasse;
- equipamento com itens estruturados (nome, quantidade, modelo de objeto quando houver), absorvendo a
  mochila do lote 7;
- números roláveis clicáveis usando os modelos do lote 8;
- permissões (jogador edita a própria, mestre edita todas); gravação agrupada;
- exportar e importar a ficha em JSON (pasta `fichas/` do jogador).

**Verificação automática:**
- unidade com os números do Darion (seção 8): modificadores, salvaguardas, perícias, percepção
  passiva 12, espaços de magia 4/3/3/1 para conjurador de nível 7 (Clérigo 5 + Patrulheiro 5);
- E2E: jogador altera PV e o mestre vê; jogador não consegue editar ficha de outro;
- E2E: exportar → importar devolve a mesma ficha.

**Roteiro manual:** montar à mão a ficha de um personagem do grupo e rolar ataques pela ficha.

**Pronto quando:** `pnpm verify` verde.

---

### Lote 10 — Importação da ficha em PDF (G)

**Objetivo:** transformar o PDF impresso da ficha em ficha do Tabletop (seção 4.10).

**Entregáveis:**
- extração com pdf.js no navegador; âncoras PT/EN; leitura por posição relativa;
- parser das páginas de magias (três colunas, blocos);
- dedução de proficiência e especialização pela conta;
- recuperação de nomes cortados cruzando com o próprio PDF;
- ataques importados como valor fixo;
- tela de revisão com campos incertos destacados; nada vai para a sala sem confirmação.

**Verificação automática:** `fixtures/fichas/darion.pdf` produz os valores da seção 8
(teste de unidade em `shared` rodando pdf.js em Node). Campos marcados como "revisão" na seção 8 têm
que vir **destacados**, não preenchidos com chute.

**Roteiro manual:** importar o PDF do Darion pela interface, corrigir os três machadinhos na revisão,
confirmar e rolar um ataque da ficha importada. Repetir com o PDF de outro jogador do grupo.

**Pronto quando:** `pnpm verify` verde e o PDF de pelo menos mais um jogador importa só com ajustes
na tela de revisão.

---

### Lote 11 — Combate: iniciativa e condições (M)

**Objetivo:** fechar o ciclo de combate.

**Entregáveis:**
- rastreador de iniciativa (rolar para todos ou individual, ordenar, turno atual, rodada);
- destaque do token da vez para todos;
- condições do 5e com ícone no token e na ficha (caído, cego, envenenado...);
- concentração marcada na ficha e no token;
- NPCs do mestre com iniciativa oculta dos jogadores quando desejado.

**Verificação automática:**
- unidade: ordenação com empates (desempate por Destreza);
- E2E: avançar turno no mestre atualiza para todos; iniciativa oculta não chega aos jogadores.

**Pronto quando:** `pnpm verify` verde e um combate de teste com 3 jogadores e 4 NPCs roda do início
ao fim.

---

### Lote 12 — MCP (M)

**Objetivo:** configurar a mesa com IA (seção 4.12).

**Entregáveis:**
- `apps/mcp` (stdio) conectando na sala local com token gerado pelo mestre e papel `assistente`;
- ferramentas geradas a partir dos schemas das intenções; leitura do estado da campanha;
- rascunho invisível para jogadores, publicação pelo mestre e desfazer em lote;
- instruções de uso com o Claude Code ou Desktop.

**Verificação automática:**
- unidade: o papel `assistente` é recusado em fichas de jogador, dados e papéis;
- E2E: o MCP cria uma cena com pontos e um ciclo; o jogador não recebe nada até o mestre publicar;
  desfazer em lote apaga tudo o que foi criado.

**Roteiro manual:** pedir ao Claude para montar uma cena da campanha de referência a partir da bíblia
dela e revisar o rascunho antes de publicar.

**Pronto quando:** `pnpm verify` verde.

---

### Depois (fora dos lotes atuais)

- handouts (imagem ou texto entregue a um jogador, que fica no inventário dele);
- som ambiente sincronizado (vento da Inspiração, gotejar, combate), também lido da pasta local;
- dados 3D (só visual; o resultado continua vindo do servidor);
- filtro por linha de visão no servidor (jogador não recebe nem a posição de tokens fora da visão);
- editor de templates para importar PDFs de outras fichas;
- importação de foto de ficha (OCR local), se um dia valer a pena;
- deploy na internet (Cloudflare, conta pessoal) e login real — outro plano.

---

## 8. Valores de referência do PDF do Darion

Ficam só no computador do mestre, em `privado/notas/darion.md` (a pasta `privado/` não entra no git).

---

## 9. Como trabalhar neste projeto com IA

Regras para o agente que implementa:

1. **Um lote por vez.** Antes de começar, ler este documento e `docs/ESTADO.md`.
2. **Só avança com tudo verde:** `pnpm verify` passando e o roteiro manual feito pelo Vilella.
3. Ao terminar um lote, atualizar `docs/ESTADO.md` (o que foi feito, decisões tomadas, desvios deste
   plano e o porquê) e `docs/protocolo.md` se o protocolo mudou.
4. **Nada vem da internet em tempo de execução:** não usar CDN, fontes remotas, analytics ou APIs de
   terceiros.
5. Lógica de regras, geometria, dados e import de PDF em `packages/shared`, pura e testada.
6. Toda mensagem nova do protocolo tem schema zod e é filtrada por papel na sala.
7. Nada que o jogador não pode ver sai da sala para ele. Todo lote que cria dado secreto inclui um
   teste E2E que inspeciona os frames do jogador.
8. Mudanças de arquitetura em relação a este documento: propor primeiro, implementar depois.
9. Commits pequenos e um commit de fechamento por lote.
10. Toda intenção nova declara a capacidade exigida.
11. Nada de regra de campanha no código: o que for específico de uma campanha vira configuração e vai
    para `fixtures/campanhas/`.

---

## 10. Decisões

**Tomadas:**
- Regras de **2014** (SRD 5.1).
- **Imagens locais** são a premissa do projeto: o servidor não guarda imagens.
- **Mesa genérica**: a campanha é conteúdo e configuração, nunca código.
- **O tempo é da sala**; o mestre decide se o jogador vê o tempo exato, o estágio ou nada.
- **Permissões por capacidade**; só o mestre muda papéis e permissões.
- Ficha visível para os outros jogadores vira a capacidade `ficha.verOutras`, decidida por mesa.
- A duração da tocha é do modelo de objeto de cada campanha (a "5e padrão" usa 1 h).

**Em aberto:**
- **Nome do projeto.**
- **Quanto da névoa o mestre revela à mão** versus só pela visão dos tokens.
- Assumido até decidir: tocha apagada continua ocupando a mão; qualquer jogador no alcance tira uma
  tocha de um suporte; entregar exige alcance (padrão 1,5 m).
- Na visão noturna do mestre, como mostrar a área que um jogador vê só com visão no escuro (cor normal
  ou cinza).
