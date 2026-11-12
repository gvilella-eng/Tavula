# Távola — visão e plano de implementação

> Nome decidido em 2026-11-10 (antes "Tabletop"; os identificadores técnicos `@tabletop/*`, `tabletop-*` e as
> chaves do navegador ficam como estão, para não quebrar campanhas exportadas). Documento-base do projeto: explica a ideia, as decisões de arquitetura e divide a
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
   Com o F12 aberto, ninguém descobre o goblin escondido. Isso vale para o que o mestre esconde de
   propósito: token oculto, camada do mestre, outras cenas, pastas fechadas. **Visão e escuridão são só
   de tela** (decisão do Vilella, 4.7): um token que só está no escuro chega ao navegador; para esconder
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

type CapacidadeDelegavel =          // lista completa em docs/protocolo.md
  | 'nota.editar' /* sem uso desde o V3 (a aba Notas saiu); fica só para o banco e as exportações antigas */
  | 'token.moverProprio' | 'porta.abrir'
  | 'tocha.acender' | 'tocha.entregar' | 'ponto.usar' | 'luz.apagar' | 'ficha.verOutras'
  | 'dado.rolarOculto' | 'asset.subir' | 'desenho.criar' /* lote 13, ligada por padrão */;
type CapacidadeDoMestre =           // só do mestre, nunca delegáveis
  | 'papel.alterar' | 'permissao.alterar' | 'mesa.configurar' | 'automacao.editar'
  | 'camadaMestre.ver' | 'objeto.ajustar' | 'campanha.exportar' | 'campanha.importar'
  | 'cena.editar' | 'combate.gerir' /* lote 11 */;
type Capacidade = CapacidadeDelegavel | CapacidadeDoMestre;

interface Permissoes {
  jogadores: Record<CapacidadeDelegavel, boolean>;                           // padrão da mesa
  porUsuario: Record<string, Partial<Record<CapacidadeDelegavel, boolean>>>; // exceções por usuário
}
// capacidade criada num lote futuro entra com o padrão, ao carregar do SQLite e ao importar

interface ConfigDaMesa {            // por campanha; só o mestre altera
  regras: '5e-2014';
  maosPorPersonagem: number;        // padrão 2: no máximo 2 objetos na mão
  penalidadeAoApagarS: number;      // padrão 0 (a campanha de referência usa 60)
  alcanceInteracaoM: number;        // entregar tocha, usar ponto (padrão 1,5)
  tempoParaJogadores: 'exato' | 'estagio' | 'oculto';   // o mestre sempre vê o exato
  estagios: { fraca: number /* 0.5 */; morrendo: number /* 0.1 */ };  // lote 7: fração da duração
  iluminacao: {                     // lote 6: "Configurações de iluminação"
    memoriaLigada: boolean; memoriaModo: 'inteligencia' | 'fixo';
    memoriaBaseM: number /* 15 */; memoriaPorModM: number /* 3 */; memoriaFixaM: number;
    tomDaMemoria: string;
  };
}
// lote 6 criou `iluminacao`; o lote 7 completou o resto. Modelos e pontos são coleções do estado
// (`Estado.modelos`, `Estado.pontos`), e o relógio é `Estado.relogio` ({ pausada, acumuladoMs, desdeReal?, marcoMs? }; o `marcoMs` é do "zerar o relógio" da pílula do mestre, ausente = 0; V1, 2026-11-11)

interface Pasta {                   // lote 4b: pastas da aba Fichas, sem subpastas
  id: string; nome: string; ordem: number;
  visivel: { tipo: 'todos' } | { tipo: 'mestre' } | { tipo: 'jogadores'; ids: string[] };
}

interface Handout {                // V3 (2026-11-11): item das Fichas; até o V2 eram as notas (`Estado.notaMesa`/`notaMestre`)
  id: string;
  pastaId: string;
  titulo: string;                   // 1 a 80 caracteres
  texto: string;                    // texto puro com quebras de linha, até 20 000 caracteres
  fonte: 'simples' | 'livro' | 'manuscrito' | 'medieval' | 'datilografado';  // 5 fontes, todas empacotadas
  imagemHash?: string;              // imagem pequena de preview (asset local, tipo retrato ou token)
  visivel: { tipo: 'todos' } | { tipo: 'mestre' } | { tipo: 'jogadores'; ids: string[] };  // padrão: só o mestre
}
// O jogador só recebe o handout que `visivel` cita (nem o título chega a quem não vê). A pasta chega ao jogador se
// ele a vê OU se ele vê algum handout dentro dela, e só com esses itens. `Estado.handouts` (V3, 2026-11-11);
// `Estado.notaMesa` e `Estado.notaMestre` saíram: a migração (banco e exportação até a v12) cria "Nota da mesa"
// (todos) e "Nota do mestre" (só o mestre) numa pasta nova "Handouts" (só do mestre), quando não vazias.

interface Personagem {              // um item das Fichas (por ora só personagem e NPC)
  id: string;
  pastaId: string;                  // quem VÊ: a pasta, mais quem edita
  editores: { tipo: 'todos' } | { tipo: 'jogadores'; ids: string[] };  // "pode ser controlado e
                                    // editado por"; NPC = ninguém; o mestre edita tudo
  retratoHash?: string;             // retrato (avatar), escolhido no editor do item
  nome: string;
  ficha?: Ficha;                    // lote 9: esparsa (só pvAtual e pvMax obrigatórios); ausente para
                                    // quem não vê a ficha (ficha.verOutras); a antiga `mochila` vira itens
  tokenPadrao: { cor: string; tamanhoQuadrados: number; assetHash?: string };
  // o token colocado guarda a própria cópia de nome, cor, tamanho e imagem do token padrão;
  // personagem de jogador tem um token só
  visao: { alcanceM: number | null; visaoNoEscuroM: number };
  // a luz vem dos objetos que ele carrega (ObjetoDeLuz), não do personagem
  modInteligencia?: number;         // lote 6: alcance da memória do mapa; padrão 0; a ficha (lote 9) assume
}

interface Cena {
  id: string; nome: string;
  larguraM: number; alturaM: number;
  grid: { quadradoM: number /* 1.5 */; visivel: boolean };
  mapa?: { assetHash: string; pxPorQuadrado: number };   // lote 3
  chegada?: { x: number; y: number };                    // lote 4: onde o grupo chega (padrão: centro)
  iluminacaoDinamica?: boolean;                          // lote 5: padrão ligada; desligada, o jogador vê tudo
  luzAmbiente?: number;             // lote 6: 0 = escuridão total, 1 = dia (sem o campo = 1)
  fatorDeLuz?: number;              // lote 6: slider geral do painel de fontes (multiplica os raios)
}

interface Token {
  id: string; cenaId: string;
  nome: string; cor: string;        // aparência gerada (círculo + iniciais) até existir imagem
  tamanhoQuadrados: number;         // 1..4
  x: number; y: number;             // centro, em metros
  camada: 'mapa' | 'tokens' | 'mestre';  // mapa (4b): cenário abaixo dos tokens; o jogador vê e não mexe
  oculto: boolean;
  controladoPor: string[];          // ids de usuário, além de quem edita o personagem; o mestre move qualquer um
  assetHash?: string;               // lote 3
  alcanceVisaoM?: number;           // lote 5: só para token sem personagem (com personagem vale a visão dele)
  visaoNoEscuroM?: number;          // lote 6: idem, para a visão no escuro
  personagemId?: string;            // lote 4; controla: o dono do personagem ou quem estiver em controladoPor
  condicoes?: Condicao[];           // lote 11: as 14 do 5e 2014; quem vê o token vê as condições
  exaustao?: number;                // lote 11: 1..6
  concentracao?: string;            // lote 11: nome da magia
}

interface Combate {                 // lote 11: Estado.combate (sem o campo = sem combate)
  entradas: { id: string; tokenId?: string; nome: string; iniciativa?: number; destreza?: number;
              jogador?: boolean; valorOculto?: boolean; oculta?: boolean }[];
  atualId?: string;                 // a vez pelo id, nunca pelo índice
  rodada: number;                   // 0 = não começou
}
// o jogador só recebe as entradas que vê, sem Destreza e sem o número das de valor oculto
// (V2, 2026-11-11) a ordem "na tela" é Estado.ordemDeTurnoVisivel (do mestre, vale para todos); fechar não apaga o combate

interface Desenho {                // lote 13: Estado.desenhos; chega a quem recebe a cena
  id: string; cenaId: string; autorId: string;
  forma: 'livre' | 'linha' | 'retangulo' | 'circulo';
  pontos: { x: number; y: number }[];   // metros; retângulo e círculo: dois pontos
  cor: string; espessura: number /* px do mundo, 1..24 */; preenchido?: boolean;
}

// lote 14: Estado.compendio?: { hash, nomeOriginal, magias } aponta para o asset 'compendio' da mesa
// (o arquivo nunca fica na sala); o chat ganhou a mensagem 'magia' (pública, com a magia dentro)

interface Parede {
  id: string; cenaId: string;
  a: { x: number; y: number }; b: { x: number; y: number };
  meio?: { x: number; y: number };   // V5 (2026-11-12): ponto do arco entre a e b; sem ele a parede é reta
  tipo: 'parede' | 'porta' | 'janela' | 'secreta' | 'invisivel';
  estado?: 'aberta' | 'fechada' | 'trancada';   // só para portas
}

interface Luz {
  claraM: number; penumbraM: number;            // tocha 5e: 6 m + 6 m
  cor: string; tremula: boolean;
}

interface FonteDeLuz {              // lote 6: prévia do ObjetoDeLuz (sem tempo nem mochila)
  id: string; cenaId: string; nome: string;
  portador: { tipo: 'cena'; x: number; y: number } | { tipo: 'token'; tokenId: string };
  luz: Luz; intensidade: number /* 0..1, multiplica os raios */; acesa: boolean;
}
// o jogador só recebe as da cena ativa; a presa a token oculto ou da camada do mestre não chega a ele

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
  // lote 7: é a FonteDeLuz do lote 6 crescida, na mesma coleção `luzes`; estado só 'acesa' | 'apagada'
  // (consumida sai da coleção). saldoMs e acesaDesde ficam só na sala: o navegador recebe restanteMs,
  // contando e estagio, filtrados pelo papel e por tempoParaJogadores
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

interface Ponto {                   // lugar do mapa onde se põe ou se acende uma luz (no código: PontoDeLuz)
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

interface Asset {                               // metadados; os bytes nunca passam pela sala parados
  hash: string;                                 // SHA-256 do arquivo processado (manifesto: dos tiles)
  tipo: 'mapa' | 'token' | 'retrato' | 'tile' | 'cifrado' | 'compendio';  // cifrado: pré-envio do lote 4
                                                // (opaco, sem nome real); compendio: o magias.json do mestre
                                                // (lote 14; todos baixam o da mesa, Estado.compendio);
                                                // 'handout' e 'audio' nos lotes que os usarem
  mime: string; bytes: number;                  // manifesto de mapa fatiado: bytes 0, sem pedaços
  largura: number; altura: number;
  donoId: string; nomeOriginal: string;         // dono = quem registrou primeiro
  pedacos: string[];                            // SHA-256 de cada pedaço de 256 KB
  tiles?: { hash: string; x: number; y: number; largura: number; altura: number }[];
}
// Estado.assets (as metas) só existe na sala e na visão do mestre; o jogador recebe a meta sob demanda
// (`asset.meta`), e só do que vê.
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
- Cada mensagem tem versão do protocolo (`v`). A sala numera os eventos (`seq`): global, só cresce
  (inclusive na importação). Como a sala filtra por papel, o jogador vê saltos no `seq`, o que é aceito.
- Ao conectar ou reconectar, o cliente recebe um **snapshot filtrado** e depois só eventos.
- Movimento ao vivo (`token.mover`) é transitório e não é gravado. Só `token.soltar` grava. A sala
  repassa o movimento como `token.movendo` só a quem vê o token; se quem arrasta cai antes de soltar,
  a sala manda aos outros a posição gravada. Mover exige `token.moverProprio` e **controlar e ver** o
  token (o mestre move qualquer um).
- **Sigilo de token:** token da camada do mestre ou oculto não chega ao jogador de jeito nenhum. Quando
  deixa de ser visível para ele, chega só `token.sumiu { id }`, sem motivo; quando passa a ser visível,
  chega inteiro. Pedido sobre token invisível responde igual a token inexistente (`token_inexistente`).
- O documento `docs/protocolo.md` lista todas as mensagens e é atualizado em todo lote que mexer nelas.

Exemplos de intenções do cliente (V5: `parede.criar` e `parede.editar` aceitam `meio`, o ponto do arco; `cena.editar` aceita `mostrarParedesAosJogadores`): `entrar`, `token.mover`, `token.soltar`, `parede.criar`,
`porta.alternar`, `ficha.alterar` (patch), `dado.rolar`, `chat.enviar`, `asset.registrar`, `asset.pedir`
(com os pedaços que faltam), `asset.inventario`, `asset.tenho`, `asset.naoTenho`, `cena.definirMapa`,
`token.definirImagem`, `cena.ativar`, `grupo.moverPara`, `objeto.acender`, `objeto.apagar`, `objeto.mover`
(entregar, guardar, pôr no suporte), `ponto.acenderInicio`/`ponto.acenderFim`, `objeto.ajustar`,
`ciclo.disparar`/`ciclo.pausar`/`ciclo.retomar`, `evento.disparar`, `papel.alterar`,
`permissao.alterar`, `nevoa.revelar`.

Cada intenção declara a capacidade exigida (princípio 8) e o schema zod dela. O MCP usa exatamente as
mesmas intenções.

Exemplos de eventos da sala: `snapshot`, `evento`, `presenca`, `asset.meta`, `asset.enviar` (ao
provedor), `asset.indisponivel`, frame binário de pedaço, `rolagem`, `uso`, `erro`.

As intenções de vaivém de arquivos (`asset.pedir`, `asset.inventario`, `asset.tenho`, `asset.naoTenho`)
não exigem capacidade (`null` em `capacidadeDaIntencao`): quem não pode subir arquivo ainda precisa
receber o mapa. Todas as demais declaram uma.

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

**Detalhes decididos para o Lote 3:**
- **Só entra na sala o arquivo que alguém usa** (mapa de uma cena, imagem de um token, retrato). A pasta
  nunca é enviada nem listada para os outros; o que o jogador tem na pasta e não usou ninguém vê.
- **Manifesto com hash por pedaço:** o asset registrado leva o SHA-256 de cada pedaço (256 KB). Pedaço
  corrompido é detectado na hora e pedido de novo, sem baixar o resto; o hash do arquivo inteiro
  confere no fim.
- **Frame binário de pedaço:** `[1 byte tipo][32 bytes hash][uint32 índice][uint32 total][dados]`. A sala só
  repassa pedaço que ela pediu àquele socket; o resto é descartado.
- **Sigilo:** o jogador só recebe metadados e pedaços de asset referenciado por algo que ele vê (token
  visível, mapa da cena ativa) ou que é dele. Pedido de outro asset responde como inexistente, e o hash
  da imagem de um token oculto nunca chega a ele (o hash vai junto com o token).
- **Quem tem cada asset** fica no SQLite por conexão (sobrevive à hibernação), refeito pelo inventário que
  o cliente manda ao conectar e limpo quando a conexão fecha. Ordem de quem serve: dono, mestre, qualquer
  outro com cópia; se quem serve cai, a sala pede o que falta a outro.
- **Processamento num Web Worker** (OffscreenCanvas → WebP). Um índice local (IndexedDB) liga o arquivo
  original ao hash processado, para reconhecer arquivo movido ou renomeado sem depender de o WebP sair
  byte a byte igual.
- **Mapa na cena:** tamanho em metros = pixels da imagem ÷ `pxPorQuadrado` × `quadradoM`; o mestre
  informa `pxPorQuadrado`. Mapa acima do limite vira tiles de no máximo 4096 px.
- **Limites:** 30 MB por arquivo, 64 tiles e 200 MB por mapa, 2000 assets na sala, 5000 hashes por
  inventário (contra travar a sala com um arquivo gigante).

**Como ficou no Lote 3 (além do acima):**
- Jogador registra só `token` e `retrato`; `mapa` e `tile` são do mestre.
- Mapa fatiado: o asset do mapa é um **manifesto** sem bytes (hash = SHA-256 do texto dos tiles) e cada
  tile é um asset próprio.
- **Posse só de quem vê:** a sala só aceita "tenho este arquivo" de quem pode ver o asset, e só escolhe
  como provedor quem pode vê-lo naquele momento.
- **Imagem de token:** o jogador pode pôr no token que controla qualquer imagem de token registrada,
  inclusive a mesma arte que outro registrou antes (mesmo hash).
- **Vigia do cliente:** sem progresso por 20 s (ou "indisponível" por 30 s) pergunta de novo; cobre a sala
  que hibernou no meio de uma transferência.
- **Campanha importada em outra instalação** traz só as metas: o mapa fica "indisponível" até alguém com
  cópia conectar ou o mestre escolher o arquivo de novo na pasta.

### 4.4 Persistência e refresh

- Refresh ou queda: o cliente reconecta, recebe o snapshot e lê os assets do cache. Os outros continuam
  jogando; para eles aparece "fulano reconectando".
- O que ainda não foi enviado (mensagem do chat pela metade, campo da ficha em edição) fica como
  rascunho no `localStorage` e volta depois do refresh.
- A sala grava tudo no SQLite. Se a sala reiniciar, recarrega do banco.
- Com a Hibernation API a sala pode sair da memória com os sockets ainda abertos: o estado em memória é
  só um cache do SQLite, e quem é cada socket (usuário, papel) fica no `serializeAttachment` dele.
- Gravações: token só ao soltar; ficha agrupada (no máximo 1 gravação por segundo por ficha); névoa a
  cada poucos segundos por jogador.
- Se o mestre fechar o navegador, a mesa continua. A mesa pausa sozinha quando o último mestre sai (feito no R2b, 2026-11-10; sem opção para desligar).
- **Exportar/importar a campanha** (mestre): um JSON com todo o estado da sala (cenas, paredes, fichas,
  objetos, automações, névoa, chat), sem imagens. Serve de backup na pasta `backup/` do mestre e para
  levar a campanha de uma instalação para outra. O formato é versionado (hoje v4: personagens, cenas e as metas dos assets, nunca bytes nem as
  chaves de preparo) e versões antigas
  continuam importáveis.

### 4.5 Orçamento do plano grátis (para o futuro deploy)

Nesta fase tudo é local e sem limite, mas o projeto já respeita o plano grátis dos Durable Objects para
não precisar de reescrita depois:
- 100 mil requisições/dia; **cada 20 mensagens recebidas pela sala contam 1 requisição**; mensagens
  enviadas pela sala não contam; cada conexão conta 1;
- 13.000 GB-s/dia de processamento; 100 mil linhas gravadas/dia; 5 GB de SQLite;
- o contador zera à 00:00 UTC (21h em Brasília).

Regras que decorrem disso:
- arrastar token envia no máximo **20 atualizações/s**, só enquanto arrasta; os outros clientes
  interpolam o movimento; o cliente não reenvia a mesma posição e o `token.soltar` sai na hora, fora
  do limite;
- cada frame de pedaço de arquivo conta como mensagem recebida: um arquivo de 30 MB ≈ 6 requisições, um
  token típico (≤ 512 px) cabe em 1 frame;
- ações rápidas podem ser agrupadas em uma mensagem por "tick" de 50 ms;
- a sala conta as mensagens recebidas por dia UTC e o painel do mestre mostra "uso de hoje: X%".

Estimativa de uma sessão pesada de 3h com 8 pessoas: ~15 mil requisições (15% do limite).

### 4.6 Autenticação em desenvolvimento

Tela de entrada que lista os usuários da campanha (definidos em `campanha.seed.json`). O usuário
escolhido vai num cookie e a sala confia nele **em modo dev**. Tudo passa por uma interface
`Autenticacao`, para que no futuro seja trocada por login real sem mexer no resto.

(C1, 2026-11-12: desde as mesas, o cookie vale por mesa e as rotas ficam sob `/api/m/<id>`; ver 4.14.)
(C2, 2026-11-12: a escolha de usuário só existe com `MODO=teste`; no `pnpm dev` vale só a conta, com login e senha. Ver 4.14, "C2: como ficou".)

Papéis e capacidades valem desde o lote 1, mas só viram segurança de verdade com login real: em dev,
quem escolhe o usuário mestre na tela de entrada é mestre.

### 4.7 Paredes, luz e visão

- **Paredes** são segmentos com tipo: `parede`; `porta` (aberta/fechada/trancada); `janela` (bloqueia
  passagem, não visão); `secreta` (para jogadores é parede comum, para o mestre é porta); `invisivel`
  (bloqueia passagem, não visão).
- **Quem vê os contornos** (V5, 2026-11-12; só desenho, a visão, a luz e o bloqueio usam as paredes como sempre):
  o **jogador** não vê as linhas de parede, janela e porta nem os ícones das portas, salvo se a cena
  tiver "Mostrar paredes e portas aos jogadores" (campo `Cena.mostrarParedesAosJogadores`, desligado por
  padrão). Ele continua abrindo e fechando a porta pelo clique no lugar dela, e a porta sob o mouse se
  destaca. A secreta nunca chega a ele. O **mestre** vê os contornos com a Visão do mestre ligada (4.7,
  "Visão do mestre") e sempre com a ferramenta Paredes ativa.
- **Encaixe em meia célula** (V5): os pontos de fixação são a rede de meia célula (cantos, meios das
  arestas e centro: 9 por quadrado), em qualquer direção (diagonal), e o menor segmento é meia célula; Alt
  solta do grid. Vale para todos os tipos.
- **Arcos** (V5): `Parede.meio?` guarda um ponto do arco entre `a` e `b`. A função pura `segmentosDaParede`
  (`packages/shared/src/paredes.ts`) transforma o arco em segmentos de ~10° e é o que a visão, a luz e a
  passagem leem. Ao desenhar, a tecla A alterna linha e arco tangente (sem trecho anterior, arco de 3
  pontos), como no SolidWorks. Arco de porta abre e fecha como a reta.
- **Polígono de visibilidade** por fonte (luz ou olho do token): raios até as pontas dos segmentos e
  varredura angular (algoritmo "2D visibility" da Red Blob Games). Recalcula só quando algo se move.
- **Render:** camada de escuridão sobre o mapa; cada luz desenha o próprio polígono com raio de luz
  plena e penumbra, em blend aditivo numa RenderTexture. O jogador vê a interseção entre o que está
  iluminado e o que o token dele enxerga, mais a visão no escuro (em tons de cinza). **Como ficou no
  Lote 6:** um pipeline de RenderTextures com os blends do Pixi (erase, add, multiply, saturation), sem
  shader próprio; o cinza usa o blend `saturation` (exige `useBackBuffer`). Os polígonos das luzes ficam
  em cache e só são refeitos quando algo se move.
- **Névoa explorada:** ~~gravada na sala~~ trocada no Lote 6 pela **memória do mapa no navegador**
  (IndexedDB por usuário e cena, grade de 0,5 m), sem custo de servidor. A sala guarda só uma versão de
  "esquecer" por cena: o mestre manda esquecer e cada navegador limpa ao ver a versão nova, mesmo se
  estava offline.
- **Memória do mapa** (definida pelo Vilella em 2026-11-06; detalhes em aberto na 4.13.1):
  - na área iluminada que o token vê, o jogador vê todas as camadas, menos a do mestre;
  - quando ele sai, a área explorada **não some**: fica só a camada do mapa, escurecida. Ele sabe como a
    sala é, mas não sabe se há alguém lá;
  - essa lembrança **vai desbotando aos poucos à medida que ele se afasta**, até um alcance que depende
    do modificador de Inteligência do personagem: 50 ft + 10 ft × mod (−2 = 30 ft, 0 = 50 ft,
    +2 = 70 ft; 15 m + 3 m × mod; nunca abaixo de 0);
  - **a lembrança não é permanente**: o que passa do alcance é esquecido. Voltando lá, a sala só
    reaparece se for iluminada de novo;
  - até a ficha completa (Lote 9), o modificador de Inteligência é um campo no editor do personagem;
  - as regras são configuráveis (ligar/desligar, valor fixo, parâmetros).
- **Iluminação dinâmica desligada** (por cena): a cena ganha iluminação padrão e todos os jogadores veem
  tudo, menos a camada do mestre.
- **A imagem do mapa** da cena ativa fica no cache do jogador, como em qualquer VTT; a proteção contra
  quem fuça o navegador cobre "quem está onde", não o desenho das salas. Mandar o mapa só conforme a
  exploração está em `docs/IDEIAS.md`.
- **Decidido (Vilella, 2026-11-06): visão e escuridão são só de tela.** O token fora da visão ou da luz
  chega ao navegador do jogador e simplesmente não é desenhado. A sala não calcula visão por jogador:
  ninguém da mesa vai usar as ferramentas de desenvolvedor para caçar token, e não vale o custo de
  servidor nem de desenvolvimento.
- **Por token o mestre define:** alcance de visão, visão no escuro, quem controla e quem enxerga
  através dele. A luz vem dos objetos que o personagem carrega (seção 4.8).
- **Visão do mestre:** o mestre é o único que vê o mapa inteiro sem precisar de luz. É uma escolha
  **só da tela dele** (não vai para a sala nem afeta os jogadores). Modos (definidos pelo Vilella em
  2026-11-06):
  - **Visão do mestre** (V5, 2026-11-12; antes "visão noturna"; o mesmo ícone da lua no menu
    superior). Ligada junta a visão noturna abaixo e os contornos das paredes e portas; desligada é o
    mapa claro sem contornos;
  - **visão noturna ligada** (padrão; ícone no menu superior): o que os jogadores estão iluminando
    aparece claro e normal, e o resto do mapa aparece num tom mais apagado, para distinguir o que está
    de fato iluminado. A união sai barata: a máscara de cada jogador é desenhada na mesma
    RenderTexture, sem conta de polígonos;
  - **visão noturna desligada**: tudo claro, como se a cena estivesse toda iluminada (como desligar a
    iluminação dinâmica, mas só para o mestre);
  - *ver como o jogador X*: clique direito no ícone da visão noturna (lua) abre a lista de jogadores; um
    selo "Vendo como X" com "Voltar a mim" fica na tela enquanto durar. O mestre continua com poderes de
    mestre; só a tela muda.
- **Como o escuro é desenhado** (Lote 5): um véu escuro numa RenderTexture com os polígonos de visão
  "apagados" dele (blend `erase`), não máscaras do Pixi, que somam sobreposições. A memória do mapa do
  Lote 6 pode reaproveitar o mesmo véu.

### 4.8 Relógio da sala e objetos de luz

**Relógio.**
- A sala conta todo o tempo (princípio 6). Um **agendador único** guarda a fila de tudo que vence (fim
  de tocha, fase de ciclo, fim de modificador) e mantém o alarme do Durable Object no próximo
  vencimento, porque cada Durable Object tem **um alarme por vez**.
- O mestre pode **pausar a mesa** (intervalo da sessão): tudo congela. Pausar um ciclo (seção 4.11) é
  outra coisa e não para as tochas.
- O mestre pode **zerar o relógio** da pílula do topo (V1, 2026-11-11): é um **marco** (`relogio.marcoMs`,
  o tempo da sala na hora de zerar), e a pílula mostra `tempoDaSala − marcoMs`. O tempo da sala, as tochas
  e tudo o que queima não mudam. Vale pausada ou rodando (pausada continua pausada, em 00:00). Intenção
  `mesa.zerarRelogio` (`mesa.configurar`), evento `mesa.relogioZerado` só para o mestre; o jogador não
  recebe o marco nem o evento. Entra na exportação (campo opcional do `relogio`; sem ele, marco 0).
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
  consegue arrastar a tocha alheia. **O mestre entrega, põe no suporte e tira do suporte de longe**
  (decidido em 2026-11-10); o alcance vale para os jogadores. A mesma cena continua exigida.
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
- **Ficha no desenho aprovado (V4a, 2026-11-11).** A janela da ficha segue os protótipos aprovados em `docs/desenho/` (a ficha **segue o tema**: sem papel branco), com abas Personagem (3 colunas), Magias, História e Configurar, e abre com ~880 px, na camada mais alta, minimizando para só o nome. Abaixo de ~620 px de largura da janela vira cabeçalho grudado mais acordeão. Duas peles por preferência local `tabletop:pref:aparenciaFicha`: **Livro** (padrão) e **Clássica**, com o mesmo arranjo. Campos opcionais da ficha: `xp`, `inspiracao`, `outrasProficiencias`, `moedas {pc,pp,pe,po,pl}`, `personalidade`, `ideais`, `ligacoes`, `defeitos`, `ataquesTexto`, `idade`, `altura`, `peso`, `olhos`, `pele`, `cabelos`, `aparencia`, `aparenciaHash`, `aliados`, `simboloNome`, `simboloHash`, `outrasCaracteristicas`, `historia`, `tesouro`, `classeConjurador`, `espacosTotal`; em `Ataque` e `Magia`: `alcance`, `bonusMagico`, `atributoDano`, `bonusDano`, `margemCritico` (18 a 20), `danoCritico`, `dano2`, `salvaguarda` (e `descricao` no ataque; `tempo`, `componentes`, `duracao`, `emAtaques` na magia); em `ItemDaFicha`: `peso` (kg); em `Caracteristica`: `origem`. Os hashes são imagens locais (asset `retrato`): contam como usados, só quem vê a ficha as baixa, a exportação da mesa leva a meta e a sala recusa hash sem meta. O arquivo de ficha é a versão 2 e lê a 1. Características (e "outras") têm título que expande e "Mandar ao chat" (mensagem `caracteristica`, com `origem`); a magia ligada ao compêndio manda o cartão de magia (V4a, 2026-11-11).
- **Ficha de NPC, arrastar do compêndio e reordenar (V4b, 2026-11-12).** O personagem NPC (pasta NPCs ou sem jogador que o edite, ou a escolha "Ficha de: NPC" em Configurar, campo `ficha.apresentacao`) abre no bloco de monstro do desenho N (`docs/desenho/NpcN.dc.html`): estandarte com o nome, tamanho, tipo e tendência, CA, PV com a fórmula, deslocamento, atributos em escudo, testes de resistência, perícias, resistências e imunidades, sentidos, idiomas, Desafio com XP, Traços, Ações, Reações e Ações lendárias. Campos novos e opcionais da ficha: `apresentacao`, `npc { tamanho, tipo, pvFormula, sentidos, vulnerabilidades, resistencias, imunidades, imunidadesCondicoes, nd }`; em `Ataque`: `categoria` (acao, reacao, lendaria), `tipoDeAcao`, `recarga`, `recarregado`, `usos { max, gastos }`. Os traços são `caracteristicas` e as ações são `ataques`; com `npc.nd` o bônus de proficiência vem do nível de desafio (`bonusPorND`) e o XP de `xpDoND`. Não há migração: a ficha antiga carrega igual. Cada entrada do compêndio (magia, arma, item) se arrasta para a ficha aberta (as áreas que a aceitam acendem; só quem edita a ficha solta), pela conversão pura `aplicarEntradaNaFicha` (`compendioParaFicha.ts`), a mesma do botão "Adicionar à ficha". Segurar uma linha ~300 ms a levanta para reordenar (ou Alt+↑/↓ com a linha em foco); a ordem nova vai numa operação só em `ficha.alterar` (`reordenar.ts`).
- **Conjuração do NPC e o nome com a capitular (V4b2, 2026-11-12).** O bloco de NPC ganhou a seção Conjuração entre Traços e Ações, sobre os mesmos dados da ficha de personagem (`magias`, `espacosTotal`, `espacosGastos`, `habilidadeDeConjuracao`): atributo, CD e ataque de magia (bônus de proficiência do ND), uma linha por círculo com bolinhas de espaço e as magias em chips que expandem e conjuram como no personagem. Não há campo novo nem migração. A magia solta do compêndio no NPC entra em `magias` (no círculo dela), não mais no traço "Conjuração". O nome na pele Livro, no personagem e no NPC, é um campo só: a capitular é só desenho (a primeira letra, maiúscula) e o campo mostra o nome inteiro enquanto se edita.
- **Rolagem no chat (V4a, 2026-11-11).** Toda rolagem de modelo (teste e ataque) é um bloco baixo: o nome do teste em destaque, o total grande, os d20 discretos (os dois, com o descartado esmaecido, em vantagem e desvantagem); ataque mostra acerto e dano lado a lado, com a CD quando há salvaguarda. Crítico em verde fixo e 1 natural em vermelho fixo, iguais nos 14 temas (tokens `critico`, `criticoTexto`, `falhaCritica`, `falhaCriticaTexto`). O pedido de ataque aceita `margemCritico`, `danoCritico` e `salvaguarda`; quem rola é sempre a sala.

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
- texto em português misturado com inglês (magias em inglês);
- CA, iniciativa e deslocamento saem **sem rótulo** (três números numa linha acima do PV máximo);
  "preparada", os espaços gastos e os dados de vida não saem do PDF (as bolinhas e caixas são desenho).

Nota (B1, 2026-11-12): o PDF do Rendan (`fixtures/fichas/brendan.pdf`, esperado em `brendan.json`) traz o campo
"Classe & nível" cortado com "…" ("Domínio da Sepultura Cl…"): a classe é achada pelo começo da palavra, o que vem antes
é a subclasse e o nível vem do total de dados de vida (ou do bônus de proficiência), sempre marcado para conferir.
Raça, tendência, antecedente e idiomas em inglês da ficha impressa passam por tabelas em português (`importarTraducoes.ts`).

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
- **Paredes pelo MCP** (V5, só anotado): a futura ferramenta usa os mesmos campos da intenção
  `parede.criar`: `a`, `b`, `tipo`, `estado?` e, para arco, `meio` (um ponto por onde o arco passa, entre `a` e
  `b`). Os pontos vão na rede de meia célula (múltiplos de `quadradoM / 2`), e a função `encaixarMeiaCelula`
  da `shared` faz a conta. A IA pode pedir "arco de a até b passando por c" e a ferramenta devolve a
  parede já com `meio`; arcos tangentes saem de `meioDoArcoTangente`. Nada disso exige campo novo.
- **Fácil de usar para a IA, com pouco desgaste** (pedido do Vilella, 2026-11-11): poucas ferramentas,
  com nomes e descrições claros. Elas aceitam e devolvem dados compactos: nomes em vez de ids sempre que
  possível, resumo por padrão e detalhe só quando a IA pedir. Ações em lote ("criar estes 6 NPCs") são
  uma chamada só. O erro diz o que corrigir. Uma ferramenta "o que existe na mesa" dá o panorama numa
  chamada, para a IA não precisar explorar.

### 4.13 Interface

Layout no estilo dos VTTs de mesa (referência: a tela de outra mesa virtual que o Vilella usa): **o mapa ocupa a
tela e as ferramentas flutuam em volta.** A identidade visual é própria: nada de logotipo, ícones,
cores ou nomes de terceiros.

- **Mapa em tela cheia** (PixiJS), fundo escuro.
- **Barra de ferramentas vertical à esquerda**, com ícones e dica ao passar o mouse (V3b, 2026-11-11: dica só onde falta nome, de uma linha, 700 ms de atraso, e opção para desligar em Preferências): selecionar/mover,
  mão (arrastar o mapa), régua; depois desenhar paredes (lote 5), luzes e pontos (lotes 6–7). No
  rodapé, o seletor de camada (tokens / mestre). Ferramenta só do mestre só aparece para o mestre.
- **Controle de zoom flutuante** na borda direita do mapa: +/−, trilho, nível atual, centralizar.
- **Barra lateral direita recolhível** com abas por ícone: Chat (lote 8), Jogadores (presença e
  papéis), Fichas (lote 9), Notas, Mestre (permissões, uso de hoje, exportar/importar; depois
  automações) e Configurações (hoje: Chat, Fichas, Compêndio, **Preferências** e, só do
  mestre, **Mesa**, que desde o V1 é a última aba, depois de Preferências; a aba Notas saiu no V3 e as notas viraram handouts das Fichas;
  ver "Redesign R4" no `docs/ESTADO.md`). Desde o V3 as abas têm todas a mesma largura (a do painel dividida pelo número de abas), com o
  nome cortado com reticências e a dica com o nome inteiro, e os botões do menu do mestre no topo têm todos o mesmo tamanho e o mesmo espaço
  (o nome do grupo vai para a dica: "Luz · Visão noturna"). No lote 8 a caixa de chat fica fixa no rodapé da barra, com o seletor
  "Como:" (falar como um personagem).
- **Etiqueta discreta sobre o mapa** com o nome da cena e quem sou eu; o estado da conexão só aparece
  quando não está conectado.
- **Tema escuro** por padrão (Grimório). Desde o V1 são 14 temas de cor: os três discretos (Grimório, Masmorra =
  id `escuro`, Pergaminho), nove com personalidade (Edgerunner cyberpunk, Vampiro, Licantropo, Taverna, Forja,
  Paladino, Druida, Leviatã, Arcana) e dois claros novos (Élfico, Celestial); ver `docs/REDESIGN.md`, "V1"
  (V1, 2026-11-11). Ícones e fontes vêm de pacotes npm empacotados no app (ex.:
  `lucide-react`, `@fontsource/*`), nunca de CDN ou Google Fonts em execução.
- Alvo é o desktop; em tela estreita a barra lateral recolhe.

#### 4.13.1 Interface v2 (definida pelo Vilella em 2026-11-05; substitui o que conflitar acima)

Base do Lote 4b. **Em definição:** o que cada ícone do menu superior abre o Vilella ainda vai detalhar.

- **Sai** a etiqueta sobre o mapa ("Vendo: X · Grupo em: Y · Mestre"); para onde vai essa informação, ele
  decide depois.
- **Menu rápido do mestre**, horizontal, no topo e centralizado, no mesmo estilo da barra da esquerda.
  Só o mestre vê. Ícones:
  - cenas;
  - camadas (4: **mapa**, tokens, mestre, desenho);
  - Visão do mestre (antes visão noturna): liga/desliga o modo do mestre descrito na 4.7 (só a tela dele);
  - novo token;
  - eventos (as automações da seção 4.11);
  - iluminação (lanterna): abre uma lista logo abaixo com:
    - **Iluminação dinâmica** (liga/desliga; padrão ligada; ver 4.7);
    - **Paredes e portas** (Lote 5): a ferramenta de desenhar paredes e escolher o tipo;
    - **Fontes de luz**: abre um painel flutuante, no estilo da ordem de turno, com todas as fontes de
      luz da cena: as fixas (ex.: uma parede flamejante num canto) e as variáveis (tocha, fogueira).
      - **intensidade** é o alcance da luz (raio da luz plena e da penumbra), de 0 a 100%. Toda fonte
        tem o slider; a variável tem também o tempo restante com − e + de 1 minuto de cada lado, e uma
        lixeira que extingue de vez. A lixeira vale até para a tocha de um jogador, que fica consumida,
        como quando o tempo acaba;
      - no topo, um **slider geral**, um fator sobre todas as intensidades de uma vez;
      - clicar duas vezes no cabeçalho recolhe o painel (só o cabeçalho fica) e baixa a opacidade para
        ~0,7;
    - **Configurações de iluminação**: os parâmetros da memória do mapa (ligar/desligar, valor fixo,
      fórmula pelo modificador de Inteligência) e afins;
  - mostrar/esconder a ordem de turno para todos, inclusive para o mestre.
- **Barra da esquerda** (todos): selecionar, mão, régua, **dados rápidos** e **pincel**.
  - Dados rápidos: uma grade com os dados (D4, D6, D8, D10, D12, D20, D100) nas linhas e as
    quantidades nas colunas.
  - Pincel: voltar, selecionar, formas, cores e borracha.
- **Camada de desenho:**
  - Todo desenho feito pelo pincel, de jogador ou mestre, vai para ela, qualquer que seja a camada atual.
  - É sempre visível para todos, mas só o mestre a vê como camada.
  - A borracha e o selecionar do pincel só atuam nela, para nenhum jogador mexer nos tokens limpando
    desenho.
  - No menu de camadas, ao lado da camada de desenho, o mestre tem "limpar todos os desenhos".
  - Camadas valem por cena.
- **Barra da direita:** expandir/recolher, **Chat**, **Fichas**, **Compêndio de magias** e
  **Configurações**. A aba do mestre de hoje fica por enquanto e migra aos poucos. (Hoje, desde o R4: as abas
  são Chat, Fichas, Compêndio, **Preferências** e, só do mestre, **Mesa** (última, desde o V1); a aba "Configurações", a
  "Mestre" e (V3) a "Notas" deixaram de existir.)
  - Chat: conversa, resultado das rolagens e descrição de magia mandada para o chat.
  - Fichas (o "diário"):
    - personagens, NPCs, artefatos, tesouros, handouts etc., organizados em **pastas** sem subpastas;
    - a pasta define **quem vê**: todos, jogadores escolhidos ou só o mestre. Tudo nela obedece, e o
      sigilo vale como sempre: o que o jogador não vê não chega ao navegador dele;
    - cada item define **quem edita**: jogadores escolhidos ou só o mestre. O mestre edita tudo;
    - arrastar o item muda a pasta;
    - **(V3, 2026-11-11) a lista é uma árvore** (pais e filhos, sem caixas): a pasta é uma linha (seta de recolher, nome, contador) e os
      itens vêm embaixo, recuados, com uma linha-guia; o mestre renomeia a pasta clicando no nome (Enter e clicar fora confirmam, Esc
      desfaz, F2 com o nome em foco); não há "⋯", lápis, cadeado nem lixeira: as ações (abrir, configurar, mover para a pasta, quem
      controla, quem vê, mostrar agora, apagar) estão no menu de botão direito do item e da pasta, que abre também por Shift+F10 ou a
      tecla de menu; um botão só no alto, **"+ Novo"**: Personagem, NPC, Handout e Pasta (o jogador não o tem);
    - **handouts (V3)**: título, texto numa de 5 fontes (Simples, Livro, Manuscrito, Medieval e Datilografado), imagem pequena opcional e
      quem vê; abrem numa janela flutuante (o mestre edita ali; o jogador só lê) e o mestre pode **"Mostrar agora"**, que abre a janela na
      tela de quem pode vê-lo;
    - **"Importar PDF"** vive dentro da ficha, na aba Configurar (um personagem novo abre já nela); nenhum texto cita outro programa.
  - Compêndio: magias de D&D (um JSON grande) para puxar para a ficha; talvez monstros e armas
    depois.
- **Sem menu de "subir arquivo":** a imagem entra onde dá sentido a ela. No editor do item ficam o
  retrato (avatar) e o token padrão; na cena, o mapa. A aba Biblioteca some como aba própria.

---

### 4.14 Mesas e contas (marco C1–C3, decidido pelo Vilella em 2026-11-11 e 2026-11-12)

O Vilella decidiu: **tudo fica local, nada vai para servidor**. O código é feito **como se um dia os jogadores
entrassem pela internet**: nada de atalho inseguro "porque é local". Sem termos de uso (assumido). Vale para o
que as seções 4.6 (autenticação em desenvolvimento) e 4.2 (protocolo) dizem de uma sala só: elas ficam como
base, e esta seção manda onde conflitar. Propostas e riscos: `docs/IDEIAS.md`, "Tela inicial, criar mesa e contas
por mesa".

**Ordem do marco**
1. **C1** (entregue em 2026-11-12): tela inicial, várias mesas no mesmo servidor, id amigável, a campanha de hoje
   vira a primeira mesa. Ainda **sem contas**: dentro da mesa a escolha de usuário de hoje continua.
2. **C2**: contas por mesa, com senha, pedido de entrada aprovado pelo mestre, sessões, limite de tentativas e
   redefinição aprovada pelo mestre (completa esta seção).
3. **C3**: pasta do mestre com chave (WebCrypto) e código de recuperação (completa esta seção).

**Decisões do Vilella (valem para o marco inteiro)**
- **Id da mesa**: 12 caracteres aleatórios de um alfabeto sem ambíguos (minúsculas e dígitos, sem `0 o 1 l i`; 31
  símbolos, cerca de 59 bits), agrupados de 4 em 4 com hífen: `k7m2-qx9p-4tdn`. Gerado com
  `crypto.getRandomValues`, sem viés.
- **Toda entrada passa pelo mestre** (C2): não existe convite que dispense a aprovação, nem link ligado a uma vaga.
- **Código de recuperação do mestre** (C3): sim, além da pasta local; mostrado uma vez na criação da mesa.
- **Senha** (C2): o servidor guarda só o hash; o estiramento caro roda no navegador e a sala guarda um hash rápido
  com sal; limite de tentativas por mesa e por IP.

**C1: como ficou**
- **Diretório** (Durable Object `Diretorio`, único, `idFromName("diretorio")`, SQLite): a lista
  `{ id, doNome, nome, criadaEm, legada }`. Entra pela migração de DO `v2` (`new_sqlite_classes: ["Diretorio"]`) no
  `wrangler.jsonc`; a `v1` não muda. Só o Worker fala com ele.
- **Mesa legada**: o DO `"campanha"` (`nomeDaSala()`) **continua com esse nome** e é a primeira mesa do diretório
  (`doNome: "campanha"`, nome "Campanha" (assumido), um id amigável gerado uma vez e gravado). Nada é copiado,
  movido, apagado nem reescrito: o DO só é carregado como antes. Em `MODO=teste` o id é fixo
  (`ID_DA_MESA_LEGADA_DE_TESTE`, `t3st-m3sa-e2e7`).
- **Mesa nova**: `doNome = "mesa:" + id`. O DO só existe de verdade quando o diretório manda `POST /criar`; nasce
  **vazio** (uma cena em branco, o mestre e as vagas "Jogador 1" a "Jogador 4", sem fichas nem tokens). Um DO de
  mesa que nunca foi criado responde 404 e **não se auto-semeia**: só a legada (`ctx.id.name === "campanha"`)
  nasce da semente de exemplo (`fixtures/campanha.seed.json`, que segue sendo o início da legada e dos E2E).
- **Rotas do Worker**:
  - `POST /api/mesas {nome}` cria (nome de 1 a 60 caracteres, corpo `application/json`) e devolve `{ id, nome }`.
    No C1 qualquer um cria (o C2 põe a conta do mestre aqui). Limite por IP (`CF-Connecting-IP`, sem ele "local"):
    5 mesas por hora (assumido); em `MODO=teste` o freio não vale.
  - `GET /api/mesas/<id>` devolve `{ id, nome, legada }` ou 404 `{ erro: "mesa_inexistente" }`.
  - `GET /api/mesas` lista as mesas **só com a variável `LISTAR_MESAS=1`** (o `dev` e o `dev:e2e` do servidor a
    passam por `--var`); sem ela 404: na internet ninguém descobre as mesas dos outros.
  - `/api/m/<id>/usuarios`, `eu`, `entrar`, `sair`, `renomear` e o WebSocket `/api/m/<id>/ws`. O Worker
    normaliza o id, acha o `doNome` no diretório e repassa; id que não existe: 404 `mesa_inexistente`.
  - As rotas antigas sem id (`/api/eu`, `/ws`...) deixaram de existir. `/teste/*` (só `MODO=teste`) vale para a legada.
  - `POST /api/m/<id>/renomear {nome}`: só o mestre (a sala confere o papel); o diretório grava o nome.
- **Sessão de desenvolvimento**: o cookie agora se chama `tabletop_sessao` e vale **por mesa** (`Path=/api/m/<id>`). O
  `tabletop_usuario` de antes (`Path=/`) nunca mais é lido (é apagado no "sair"). O cabeçalho de usuário que o
  Worker põe é sempre sobrescrito (e removido quando não há sessão).
- **Web**: roteador mínimo sem biblioteca (`history.pushState` e `popstate`; `apps/web/src/rotas.ts`). `/` é a tela
  inicial (entrar pelo id ou link, criar mesa, "Mesas neste computador": a lista do servidor se ele lista, senão as
  mesas que este navegador abriu, em `localStorage` `tabletop:mesas`). `/m/<id>` é a mesa (escolha de usuário e depois
  a Mesa); id inválido ou inexistente mostra a mensagem e "Voltar ao início". O nome e o id ficam no alto da aba
  **Mesa** (só o mestre) com "Copiar id", "Copiar link" e o campo do nome; "Trocar de mesa" fica em Preferências ao
  lado de "Trocar usuário" (e na tela de escolha de usuário); o título da aba é "Távola · nome da mesa".
- **Pasta local das imagens por mesa**: o handle fica no IndexedDB `tabletop-assets`, repositório `pasta`, na chave
  `handle:<id da mesa>`. A mesa legada, na primeira vez, **copia** a chave antiga `handle` para a chave dela (a antiga
  fica onde estava): sem pedir a pasta de novo. Os assets (por hash) e as preferências de tela seguem comuns.

**C2: como ficou** (2026-11-12; tudo local, mas feito como se fosse para a internet)

- **A senha nunca sai do navegador.** O navegador estica a senha com PBKDF2-SHA256 (WebCrypto), 600.000 iterações,
  32 bytes, sal `"tavola:" + idDaMesa + ":" + loginNormalizado`, e manda só o resultado (base64url, 43 caracteres: a
  "derivada"). Motivo: o servidor da internet teria CPU curta por requisição (10 ms no plano grátis); o estiramento caro
  fica no navegador. A senha entra normalizada (NFKC). Código: `derivarSenha` em `packages/shared/src/contas.ts`.
- **O servidor guarda só um hash.** Por conta: um sal aleatório de 16 bytes e `SHA-256(sal || derivada)`, comparado em
  tempo constante. A conta que não existe gasta o mesmo trabalho (mesma resposta e mesmo tempo). O tamanho da senha
  (5 a 128 caracteres) só o navegador confere: o servidor nunca a vê.
- **Login**: de 3 a 32 caracteres (letras, dígitos, ponto, hífen e sublinhado), único por mesa sem diferenciar
  maiúsculas. **Nome de exibição**: de 1 a 40 caracteres.
- **Tabelas** (migração 10 do `Armazenamento`, aditiva e idempotente, no SQLite de cada sala): `contas`
  (`id`, `login`, `login_norm`, `nome_exibicao`, `sal`, `hash`, `papel` mestre|jogador, `usuario_id` = a vaga ou
  null, `status` pendente|ativa|recusada, `criada_em`, `ultimo_acesso`, `redefinicao_ate`, `redefinicao_pedida_em`,
  `recusada_em`, `falhas`, `bloqueios`, `bloqueada_ate`), `sessoes` (`hash_token` SHA-256, `conta_id`, `criada_em`,
  `ultimo_uso`, `expira`) e `limites_ip` (`tipo`, `ip`, `em`). **Nada disso entra no estado da mesa, no snapshot, em
  frame algum nem na exportação.** O mestre vê só id, login, nome, vaga, status e último acesso (rota `contas`).
- **Sessão**: token de 32 bytes aleatórios (base64url) no cookie `tavola_sessao` (`HttpOnly`, `SameSite=Lax`,
  `Path=/api/m/<id>`, `Secure` quando a requisição vem por https, 30 dias). No banco fica só o hash do token. Usar a
  sessão a renova (no máximo uma vez por hora); a renovação reenvia o cookie na próxima `GET eu`. No máximo 10 sessões
  por conta (as mais antigas caem). Sair apaga a sessão. Remover ou recusar a conta, redefinir ou trocar a senha apagam
  as sessões dela (trocar a senha mantém a de quem trocou) e **fecham os sockets** com 4001.
- **Quem identifica**: a sala (não o Worker) resolve cookie, sessão, conta e vaga, no HTTP e no WebSocket. O Worker só
  repassa, sempre refazendo os cabeçalhos internos `x-tavola-ip`, `x-tavola-local`, `x-tavola-seguro` e `x-tavola-mesa`
  (o que o navegador mandar com esses nomes é descartado). O `tabletop_sessao` solto (id do usuário no cookie) e as
  rotas `entrar` e `usuarios` **só existem com `MODO=teste`**.
- **Limite de tentativas** (tudo no SQLite da sala): por conta, 5 falhas seguidas bloqueiam por 1, 5, 15 e 60 minutos
  (continua em 60; o acerto zera); por IP (`CF-Connecting-IP`, sem ele "local"), 30 falhas em 15 minutos bloqueiam o IP
  por 15 minutos nessa mesa; pedidos de entrada: no máximo 10 pendentes por mesa e 3 por IP por hora; "esqueci a senha":
  5 por IP por hora. Login errado e login inexistente respondem igual ("Login ou senha incorretos."); a espera é dita
  ("Tente de novo em N minutos"). Quem erra a senha não descobre o estado do pedido: "Seu pedido ainda não foi aceito" e
  "Seu pedido foi recusado" só aparecem com a senha certa. Registros velhos são apagados a cada entrada e pedido.
- **Criar mesa**: nome da mesa, login, nome e senha (com confirmação) do mestre. O **navegador sorteia o id** (ele entra
  no sal da senha) e manda `POST /api/mesas { id, nome, mestre: { login, nome, derivada } }`; o diretório recusa id
  repetido (409, o navegador sorteia outro). A sala nasce já com a conta do mestre ativa, ligada à vaga `mestre`, e a
  sessão abre na mesma resposta. Sem `mestre` o servidor recusa (400), **exceto com `MODO=teste`** (os E2E antigos).
- **Entrar numa mesa** (`/m/<id>` sem sessão): o nome da mesa e duas abas, "Entrar" (login e senha) e "Pedir para entrar"
  (nome, login, senha e confirmação). O pedido nasce `pendente` ("Pedido enviado. O mestre precisa aceitar; depois entre
  com seu login e senha."); recusado, só dá para pedir de novo depois de 10 minutos. "Esqueci a senha" pede o login e
  avisa o mestre; depois de ele aprovar, "Definir nova senha" (login, nova senha e confirmação) vale por 30 minutos, derruba
  as sessões antigas e já entra. "Sou o mestre e esqueci a senha" só mostra "em breve" (é o C3).
- **O mestre**: um aviso no topo ("1 pedido de entrada", "1 pedido de redefinição") e um selo na aba Mesa, ao vivo
  (frame `contas.aviso`, só para mestres, só com números e o nome e o login do pedido); a seção **Contas** da aba Mesa
  mostra os pedidos (Aceitar numa vaga de jogador ainda sem conta ou em "Nova vaga", ou Recusar), os pedidos de redefinição
  ("Confirme por voz ou mensagem que é a própria pessoa" e Aprovar) e a lista de contas (nome, login, vaga, status, último
  acesso, trocar de vaga, Remover com confirmação; a conta do mestre não se remove). Aceitar e trocar de vaga dão à vaga o
  nome de exibição da pessoa; fichas e tokens da vaga continuam dela.
- **Trocar a senha**: em Preferências, com a atual, a nova e a confirmação; as outras sessões caem.
- **A mesa legada sem mestre** (a campanha de hoje): a tela de entrada oferece "Criar a conta do mestre desta mesa" (login,
  nome e senha), ligando a conta à vaga `mestre` que já existe. O servidor só aceita de uma requisição **local** (host
  `127.0.0.1`, `localhost` ou `[::1]` e sem `CF-Connecting-IP`, ou com ele em loopback) e só enquanto a mesa não tem conta de
  mestre: na internet uma mesa nunca fica sem dono. Antes disso a mesa não aceita pedidos de entrada.
- **Exportar e importar** não levam contas nem sessões. Importar mantém as contas da mesa; a conta ligada a uma vaga que a
  campanha importada não tem fica sem vaga (o mestre a liga de novo) e perde as sessões.
- **Rotas novas** sob `/api/m/<id>/`: `GET situacao`, `conta/entrar`, `conta/pedir`, `conta/sair`, `conta/esqueci`,
  `conta/redefinir`, `conta/trocar-senha`, `conta/mestre-inicial`; do mestre: `GET contas`, `contas/<id>/aceitar`,
  `recusar`, `remover`, `vaga` e `liberar-redefinicao`. Ver `docs/protocolo.md`.
- **Pendências do C1 resolvidas**: a memória do mapa leva o id da mesa na chave (a legada herda a chave antiga, copiando-a
  uma vez); renomear a mesa chega ao vivo (frame `mesa.renomeada`); a lista "Mesas neste computador" fica em ordem de último
  uso, a legada primeiro quando não há uso.

**C3: como ficou** (2026-11-12; tudo local, feito como se fosse para a internet)

- **A chave da pasta**: ao criar a mesa o mestre pode escolher a pasta (a mesma pasta local das imagens; só Chrome e Edge). O navegador gera um par ECDSA P-256 (WebCrypto), grava `tavola-mestre.json` (`formato`, `aviso`, `mesaId`, `nomeDaMesa`, `chavePrivada` em JWK, `criadaEm`) e manda ao servidor **só a chave pública**, que fica na conta do mestre. A privada nunca viaja. Uma pasta que já guarda a chave de outra mesa é recusada (gravar por cima apagaria a prova de mestre dela). Mesa sem chave (a legada, ou criada sem pasta): aba Mesa, Contas, "Proteger com a pasta da mesa"; "Trocar a chave da pasta" invalida a antiga. As duas pedem a senha atual (assumido).
- **Código de recuperação**: 20 caracteres do alfabeto dos ids em grupos de 4, gerado no servidor, guardado só como SHA-256 (sem PBKDF2: a entropia é alta). Mostrado uma vez (caixa grande, Copiar, Baixar .txt, "Anotei o código" para seguir): ao criar a mesa, quando a mesa legada ganha a conta do mestre e em "Gerar novo código" (pede a senha; o anterior morre). Depois de usado para recuperar, morre e um novo aparece na hora (assumido).
- **Recuperar o mestre** ("Sou o mestre e esqueci a senha", na entrada da mesa), duas saídas. Pela pasta: o navegador lê o arquivo, recusa a pasta de outra mesa antes de pedir o desafio ("Esta pasta é de outra mesa."), pede o desafio, assina `tavola-recuperar:<mesa>:<nonce>` e manda a assinatura com a senha nova derivada. Pelo código: código e senha nova. Os dois pedem o login do mestre (o sal da senha leva o login; assumido) e, se certos, trocam a senha, derrubam as sessões antigas e abrem uma nova. A mensagem de erro não diz se a mesa tem chave ou código; sem chave a conferência roda contra uma chave de mentira.
- **Servidor**: migração 11 do `Armazenamento` (aditiva e idempotente): colunas `chave_publica` e `codigo_hash` em `contas` e a tabela `desafios` (nonce, criação, validade; no máximo 50 abertos). O nonce é gasto antes de conferir (certa ou errada); 5 minutos de validade. Limites: o do C2 por IP e 5 erros por mesa (1, 5, 15 e 60 min); desafios 20 por IP por hora. Nada disso vai a cliente: a lista do mestre só diz `protecao: { temChave, temCodigo }`. Rotas e corpos em `docs/protocolo.md`; regras puras e WebCrypto em `packages/shared/src/recuperacao.ts`.
- **Reforços do C2**: (1) Origin: no WebSocket e em todo POST de `/api/` o `Origin` tem de ser o host do pedido (sem `Origin`, aceita); (2) o bloqueio de login inexistente: as falhas contam por login normalizado na tabela de limites e, depois da 5ª, a espera é dita igual à de uma conta que existe.

## 5. Estrutura do repositório

```
Tabletop/
├─ PROJETO.md                 este documento
├─ docs/
│  ├─ ESTADO.md               o que está pronto, decisões e desvios (atualizado a cada lote)
│  ├─ IDEIAS.md               ideias não decididas, descartadas e notas da campanha de referência
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

- `pnpm dev`: sobe a sala (`wrangler dev`, `127.0.0.1:8787`) e o front (`vite`, `127.0.0.1:5173`).
  Fica rodando no terminal enquanto se joga; abra `http://127.0.0.1:5173`.
- `pnpm verify`: typecheck + lint + testes de unidade + testes ponta a ponta. **Nenhum lote está
  pronto sem `pnpm verify` verde.**
- Os testes ponta a ponta **nunca tocam a campanha real**: sobem servidores próprios (sala `8788`,
  front `5174`, estado em `e2e/.estado-sala`) com `MODO=teste`, o único modo em que existem as rotas
  `/teste/*` (zerar, reiniciar a sala). `pnpm dev:e2e` sobe esses servidores à mão para depurar.
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
- **Marco A — mesa básica** (lotes 0–4b): mapa, tokens, permissões, assets locais, cenas e a revisão da
  interface.
- **Marco B — exploração** (lotes 5–7): paredes, luz, memória do mapa, objetos de luz. Com isso já dá
  para jogar uma sessão usando fichas fora do app.
- **Marco C — mesa completa** (lotes 8–11, 13 e 14): dados, chat, ficha, import de PDF, combate, pincel
  e compêndio.
- **Marco D — automações e IA, por último** (lotes 7b e 12): eventos/automações e MCP.

**Ordem decidida pelo Vilella (2026-11-06):** primeiro deixar a mesa toda funcionando (5, 6, 7, 8, 9, 10,
11, 13, 14); as automações (7b, o ícone de eventos) e o MCP (12) ficam para o fim. Os números dos lotes
não mudaram, só a ordem.

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
- E2E: derrubar a instância do Durable Object (rota de teste) → todos reconectam e o estado volta do
  SQLite (parar o processo inteiro fica no roteiro manual);
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
- régua de distância em metros;
- **casca da interface** (seção 4.13): mapa em tela cheia, barra de ferramentas à esquerda, zoom
  flutuante e barra lateral com abas. O que o Lote 1 mostra em página (presença, notas, painel do
  mestre) passa para as abas Jogadores, Notas e Mestre.

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

### Lote 4 — Personagens e cenas (G)

**Objetivo:** separar personagem e token; várias cenas por campanha.

**Entregáveis:**
- entidade `Personagem` (com dono, visão e token padrão) separada de `Token`;
- criar, ativar e duplicar cenas; cada cena com mapa, grid e luz ambiente próprios;
- "mover grupo para a cena X" em uma única mensagem;
- "preparar cena": pré-envia os assets da cena para todos antes de ativá-la;
- o jogador só controla os tokens dos próprios personagens.

**Decidido antes de começar:**
- **Sigilo de cena:** o jogador só recebe a cena ativa (onde está o grupo). Nome, grid, mapa e tokens das
  outras cenas nunca chegam a ele; token de outra cena conta como invisível (`tokenVisivelPara` passa a
  olhar a cena). Ao levar o grupo para outra cena, cada um recebe um snapshot novo.
- **O mestre olha e edita qualquer cena** sem mover o grupo (a cena que ele vê é estado local da tela
  dele). Intenções de token, grid e mapa passam a dizer de qual cena são.
- **Preparar cena sem quebrar o sigilo:** o pré-envio vai **cifrado** (AES-GCM, uma chave por asset,
  gerada no navegador do mestre). O cache dos jogadores guarda só bytes opacos, sem nome nem hash
  original; a sala guarda as chaves (dado só do mestre). Ao levar o grupo, a sala entrega a cada jogador
  as chaves **só do que ele passa a ver**; ele decifra, confere o SHA-256 original e grava no cache. Só
  vai para o pré-envio o mapa e a imagem de token visível; o que estiver oculto baixa quando aparecer.
- **Grupo** = os tokens dos personagens de jogador que estão na cena ativa: "levar o grupo para X" os
  move para o ponto de chegada de X (definido pelo mestre; padrão, o centro), lado a lado sem se
  sobrepor. Tokens de NPC ficam onde estão.
- **Controle do token:** o dono do personagem do token, mais quem estiver em `controladoPor` (para o
  mestre emprestar um token, como uma criatura invocada ou o personagem de quem faltou).
- **Ficha mínima** até o Lote 9: só PV atual e máximo (`ficha.alterar`), editáveis pelo dono e pelo
  mestre. A ficha de outro jogador segue a capacidade `ficha.verOutras`; personagem de NPC é só do mestre.

**Verificação automática:**
- E2E: mover o grupo entre cenas gera 1 mensagem do mestre e todos os jogadores mudam de cena;
- E2E: os dados do personagem (ex.: PV de teste) se mantêm ao trocar de cena;
- E2E: jogador não consegue mover token de outro jogador;
- E2E (frames): antes de o grupo ir para a cena preparada, nenhum frame do jogador tem o nome dela, os
  tokens dela nem o hash original do mapa; depois, a troca não baixa nenhum pedaço do que foi preparado.

**Roteiro manual:** preparar a cena 2 enquanto o grupo está na cena 1 e conferir que a troca é instantânea.

**Como ficou:** o pré-envio revela ao jogador só a quantidade e o tamanho aproximado dos arquivos cifrados.
A sala só aceita pacote de arquivo que os jogadores veriam na cena e entrega as chaves com o estado já
mudado (token escondido depois do preparo não tem a chave entregue). Detalhes e limitações em
`docs/ESTADO.md` (Lote 4).

**Pronto quando:** `pnpm verify` verde e o roteiro manual feito.

---

### Lote 4b — Interface v2 (G)

**Objetivo:** montar a interface v2 (seção 4.13.1) para o Vilella visualizar e seguir descrevendo
(decisão dele, 2026-11-05). Recurso novo que ainda não tem lote (pincel, dados, chat, compêndio,
eventos, iluminação, visão noturna, ordem de turno) aparece só como **interface**, sem funcionar.

**Faixa de cenas** (ícone Cenas do menu superior):
- painel logo abaixo do menu superior, com ~3 dedos de altura (~160 px) e toda a largura disponível,
  com rolagem horizontal quando precisar;
- cards na ordem das cenas, cada um com o número (1, 2, 3…), o nome em cima e uma **prévia do mapa** em
  baixa resolução;
- destaque para a cena que o mestre está vendo e marca de onde o grupo está; card "+ Nova cena" no
  fim; nome editável com duplo clique;
- **botão direito no card** abre um menu pequeno ao lado, no estilo de menu de contexto (ícone + rótulo
  por linha): **Ir para** (o mestre passa a ver aquela cena), **Levar grupo**, **Duplicar**, **Preparar**
  (com progresso) e **Apagar** (com confirmação). Acrescentado por necessidade: **Configurar…** (nome,
  mapa da cena, pixels por quadrado, grid).

**Também entra:**
- o menu superior e as barras como descritos;
- a camada **mapa** funcionando: objetos de cenário abaixo dos tokens, que os jogadores veem e não
  selecionam;
- a ordem de turno com o mostrar/esconder sincronizado para todos (o conteúdo vem no Lote 11);
- **pastas da aba Fichas funcionando**, com sigilo (quem vê vem da pasta), "quem edita" por item e
  arrastar entre pastas. Quem edita um personagem controla o token dele, e isso substitui o "dono".
  Por ora os itens são os personagens; os outros tipos aparecem como "em breve";
- o editor do item com **retrato e token padrão** (a imagem entra ali, sem menu de arquivos);
- arrastar um item das Fichas para o mapa coloca o token;
- a escolha da pasta local vai para Configurações (hoje: aba **Preferências**);
- a correção dos ajustes já vistos (zoom inicial, painel do token cobrindo o mapa, texto cortado,
  contador de arquivos).

**Assumido até o Vilella decidir** (perguntas em aberto):
- camada mapa = imagem do mapa + objetos de cenário;
- no pincel, o jogador apaga só os próprios desenhos, e desenhar é uma capacidade delegável, ligada
  por padrão;
- nos dados rápidos, a coluna é a quantidade e o resultado vai para o chat (Lote 8);
- quem vê um item vem só da pasta, mais quem o edita, e isso substitui `ficha.verOutras`;
- o compêndio lê um JSON da pasta local, fora do repositório (o site citado parece ser a tradução do
  Livro do Jogador, com direitos autorais; a alternativa livre é o SRD 5.1).

**Como ficou:** detalhes, decisões, o que é só interface e prints em `docs/ESTADO.md` (Lote 4b). Exportação
v5 (pastas, quem edita, ordem de turno; importa v1 a v4). `ficha.verOutras` continua no tipo, sem efeito.

**Roteiro manual:** abrir a faixa de cenas e usar o botão direito; arrastar um item das Fichas para o mapa;
mover um item entre pastas com um jogador conectado e ver aparecer/sumir para ele; escolher retrato e token
no editor; ligar a ordem de turno.

**Pronto quando:** `pnpm verify` verde e o Vilella aprovar a interface.

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

**Decidido antes de começar (2026-11-06):**
- **Visão só de tela** (decisão do Vilella, 4.7): o polígono de visão é calculado no navegador e o que
  está fora dele não é desenhado; a sala não filtra tokens por visão. A sala continua filtrando o que é
  segredo de propósito: porta **secreta fechada** chega ao jogador como `parede`, e **aberta**, como
  porta aberta (ele a descobriu); paredes de outra cena não chegam.
- **Onde fica a ferramenta:** item "Paredes e portas" na lista do ícone de iluminação (lanterna) do menu
  do mestre. Desenhar em sequência com cliques (Esc encerra), encaixe nos cantos do grid (Alt solta),
  arrastar as pontas, selecionar para mudar tipo e estado, Delete apaga.
- **Portas:** ícone no meio da porta. O jogador abre ou fecha porta destrancada **ao alcance** de um token
  que controla (1,5 m por padrão; o mesmo `alcanceInteracaoM` da tocha), com `porta.abrir`. O mestre
  tranca, destranca e abre qualquer uma. Porta trancada avisa "trancada".
- **Paredes bloqueiam passagem:** parede, porta fechada, janela e invisível bloqueiam o movimento. O
  jogador não consegue soltar o token atravessando uma delas (a sala confere o trajeto; o mestre
  ignora). Janela e invisível não bloqueiam a visão.
- **Visão:** vem do personagem do token (`visao.alcanceM`, `null` = sem limite) ou, para token sem
  personagem, de um alcance no próprio token. O jogador vê a união da visão dos tokens que controla. Fora
  dela, escuro (a memória do mapa é do Lote 6).
- **Iluminação dinâmica por cena** já entra aqui como o liga/desliga da visão por paredes, no item da
  lanterna: desligada, os jogadores veem a cena inteira (menos a camada do mestre).
- **Visão noturna do mestre** já entra com a visão: ligada, o que algum jogador vê aparece normal e o
  resto mais apagado; desligada, tudo claro (no Lote 6 passa a considerar a luz). "Ver como o jogador X"
  fica junto, num menu do mesmo ícone.

**Verificação automática:**
- unidade: polígono em sala quadrada vazia; sala com pilar no meio; porta aberta × fechada; janela;
  token encostado num canto; segmentos colineares;
- unidade: 500 segmentos e 8 fontes calculados em menos de 16 ms;
- unidade: trajeto atravessando parede, porta fechada, janela e invisível é recusado; porta aberta deixa passar;
- E2E: o jogador não recebe o tipo `secreta` em nenhum frame (fechada vira `parede`, aberta vira porta).

**Como ficou:**
- a secreta é operada só pelo mestre, mesmo aberta;
- o alcance para abrir porta é a constante 1,5 m até existir `ConfigDaMesa` (Lote 7);
- a conferência do trajeto usa o segmento reto, sem o raio do token;
- sem migração de banco: as paredes entram como uma coleção nova e os campos são opcionais;
- exportação v6.
- Detalhes em `docs/ESTADO.md` (Lote 5).

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

**Decidido antes de começar (2026-11-06; prevalece sobre os itens acima onde conflitar):**
- **Tudo só de tela** (4.7): luz, escuro, visão no escuro e memória são calculados no navegador. A sala
  só guarda as fontes de luz e a configuração.
- **Fonte de luz** (prévia do `ObjetoDeLuz` da 4.1, que o Lote 7 completa com modelo, tempo e mochila):
  - `{ id, cenaId, nome, portador: { tipo: 'cena', x, y } | { tipo: 'token', tokenId }, luz: { claraM,
    penumbraM, cor, tremula }, intensidade: 0..1, acesa }`;
  - as **fixas** ficam presas na cena, e as **do token** acompanham um token (criatura que brilha);
  - **intensidade** é o alcance (multiplica os dois raios). Há também um **fator geral** por cena, o
    slider do topo do painel.
- **Painel "Fontes de luz"** (item da lanterna; painel flutuante no estilo da ordem de turno, só do
  mestre):
  - lista as fontes da cena, com o slider de intensidade e a lixeira de cada uma;
  - o slider geral fica no topo;
  - "+ Luz fixa" e um clique no mapa colocam uma luz; o mestre arrasta a luz e a edita (raios, cor,
    tremular);
  - clicar duas vezes no cabeçalho recolhe o painel (opacidade ~0,7);
  - as variáveis (tempo ±1 min, consumir) entram no Lote 7.
- **Luz ambiente** por cena, de 0 (escuro) a 1 (dia), em "Configurações de iluminação" (hoje: Luz → Configurações de iluminação, a janela `iluminacao`).
- **O que o jogador vê:** a visão dos tokens que ele controla (Lote 5), cruzada com a luz.
  - luz plena aparece normal e penumbra aparece mais escura;
  - **visão no escuro**: dentro do alcance, o escuro aparece em tons de cinza e a penumbra como luz
    plena (regra do 5e);
  - fora disso, escuro;
  - token só é desenhado onde o jogador o enxerga.
- **Memória do mapa** (4.7): só a camada do mapa, escurecida, onde o jogador já viu.
  - desbota com a distância até o token mais próximo dele;
  - alcance = 15 m + 3 m × modificador de Inteligência (padrão configurável), nunca abaixo de 0;
  - o que passa do alcance é **esquecido**;
  - fica guardada no navegador (IndexedDB, por usuário e cena) e sobrevive ao refresh. O mestre pode
    mandar todos esquecerem a cena;
  - o modificador vem de um campo novo no editor do personagem; token sem personagem usa o padrão.
- **`ConfigDaMesa`** passa a existir no estado (o Lote 7 a completa) com `iluminacao: { memoriaLigada,
  memoriaModo: 'inteligencia' | 'fixo', memoriaBaseM, memoriaPorModM, memoriaFixaM, tomDaMemoria }`,
  editada em "Configurações de iluminação".
- **Visão noturna do mestre:** passa a considerar a luz. O que algum jogador **vê** aparece normal e o
  resto mais apagado.
- O item "Iluminação dinâmica" da lanterna precisa mostrar claramente se está ligado ou desligado (o
  Vilella desligou sem perceber no teste do Lote 5).

**Verificação automática:**
- unidade: interseção luz × visão; acúmulo e compactação da névoa;
- unidade: a máscara da visão noturna do mestre é a união das máscaras dos jogadores;
- E2E: jogador sem visão no escuro em cena com luz ambiente 0 e sem tocha não vê o mapa;
- E2E: névoa explorada sobrevive ao refresh.

**Roteiro manual:** cena escura com 3 tochas e um personagem com visão no escuro de 18 m; conferir
penumbra, cinza e névoa; medir fps com 30 luzes e 500 paredes (meta ≥ 50 fps no seu PC).

**Pronto quando:** `pnpm verify` verde e a meta de fps é atingida.

**Como ficou (2026-11-06):**
- fontes `fonte.criar/editar/apagar` (capacidade `cena.editar`), `config.iluminacao` e
  `memoria.esquecer` (`mesa.configurar`); exportação v7;
- "Iluminação dinâmica" mostra Ligada/Desligada em destaque e a lanterna ganha um ponto vermelho quando
  está desligada; o painel de fontes tem acender/apagar por fonte e o espaço "Com tempo" do Lote 7;
- 60 fps (teto do navegador) no Chrome headless com 30 luzes e 500 paredes;
- a luz tem dois degraus (plena e penumbra), sem gradiente; as texturas da luz vão até 1800 px no lado
  maior (cena muito grande fica com bordas mais suaves);
- o mestre "vendo como" um jogador usa a memória do jogador **neste** navegador, não a do jogador de
  verdade;
- na visão noturna do mestre, a área que um jogador só vê com visão no escuro aparece em cor normal (em
  aberto: talvez em cinza).

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

**Decidido antes de começar (2026-11-06; prevalece sobre os itens acima onde conflitar; o que foi
assumido sem o Vilella está marcado com "(assumido)" e entra nas perguntas do fim):**
- **Uma coleção só:** a `FonteDeLuz` do Lote 6 vira o `ObjetoDeLuz` da 4.1, na mesma coleção `luzes`.
  - ganha `modeloId?`, `estado: 'acesa' | 'apagada'` (no lugar de `acesa`), `saldoMs: number | null`
    (null = não se consome), `acesaDesdeSala?`, `modificadores` e `historico`;
  - o portador ganha `mao` (personagem + mão), `mochila` (tocha usada guardada) e `ponto`, além de
    `cena` (fixa) e `token` (criatura que brilha, o "proprio" da 4.1);
  - **consumida** (tempo acabou ou lixeira do mestre) libera a mão e o objeto sai da coleção; o
    histórico vai junto (assumido);
  - exportação **v8**, importando v1 a v7 (`acesa: true/false` vira `estado`).
- **Relógio da sala** (`packages/shared/src/relogio.ts`, puro): `{ pausada, acumuladoMs, desdeReal?, marcoMs? }` (o marco é do V1, 2026-11-11: `tempoDaPilula = tempoDaSala − marcoMs`).
  O tempo da sala é `acumuladoMs + (agora − desdeReal)` enquanto não está pausada. `processar` continua
  recebendo `agora` (real) e calcula o tempo da sala; os testes usam `agora` falso. Pausar a mesa congela
  tudo (tochas, estágios e, no 7b, ciclos).
- **Saldo:** acesa, o restante é `saldoMs − (sala − acesaDesdeSala)`; ao apagar, o saldo vira o restante
  menos `penalidadeAoApagarS`. O agendador da sala (já existe, `apps/server/src/agendador.ts`) guarda
  o próximo marco de cada objeto aceso (mudança de estágio e fim) em tempo real; pausar cancela tudo e
  retomar reagenda. Ao vencer, a sala processa uma intenção interna do sistema (não aceita de cliente).
- **Estágios** (`ConfigDaMesa.estagios`, padrão `{ fraca: 0.5, morrendo: 0.1 }` da duração do modelo):
  forte, fraca e morrendo. No estágio "morrendo" a luz tremula mais.
- **O que vai para o navegador:** `acesaDesdeSala` e `saldoMs` **nunca** (nem para o mestre). A sala manda
  `restanteMs` calculado na hora do envio e `contando` (acesa e mesa rodando); o navegador só anima a
  contagem entre um envio e outro.
  - jogador com `tempoParaJogadores` = `exato`: recebe `restanteMs`; `estagio`: só `estagio`; `oculto`:
    nenhum dos dois. O filtro é na sala (snapshot e eventos);
  - o mestre recebe sempre `restanteMs`, `estagio` e o histórico.
- **`ConfigDaMesa` completa** (`maosPorPersonagem` 2, `penalidadeAoApagarS` 0, `alcanceInteracaoM` 1,5,
  `tempoParaJogadores` 'exato', `estagios`), editada pelo mestre na aba **Configurações** da barra
  direita, seção "Mesa" (hoje: aba **Mesa**, seções de regras da mesa e de modelos de luz). Intenção `config.mesa` (`mesa.configurar`).
- **Modelos de objeto** (nome, luz, duração ou infinita, ocupa mão, tags) na mesma aba, seção "Objetos de
  luz". Semente: Tocha 5e (6 m + 6 m, 60 min, ocupa mão), Lanterna (9 m + 9 m, 6 h, ocupa mão) e Fogueira
  (6 m + 6 m, infinita, não ocupa mão). A campanha de referência muda a tocha para 30 min e 9 m + 6 m por
  configuração, nunca por código.
- **Mochila mínima:** `Personagem.mochila: Record<modeloId, number>` (só as novas). As usadas são
  objetos com portador `mochila`. No editor do item, seção "Mochila": "Tocha: 4 novas, 1 usada", com
  **Acender** (nova ou usada) e, para o mestre, +/− na quantidade. A ficha do Lote 9 absorve.
- **Mãos:** acender põe o objeto numa mão livre do personagem (até `maosPorPersonagem`; objeto que não
  ocupa mão não conta). **A tocha apagada continua ocupando a mão** até ser guardada (assumido). A luz
  sai do token do personagem na cena ativa; sem token lá, o tempo corre e não há luz. Mudar de cena leva
  a tocha junto.
- **Alça da tocha:** um ícone pequeno junto ao token, um por mão (esquerda e direita). Arrastar a alça:
  - solta sobre outro token **dentro do alcance** com mão livre: entrega (`tocha.entregar`), com o saldo;
  - solta sobre um **suporte** dentro do alcance com espaço: põe a tocha nele;
  - segurada sobre um **inflamável** dentro do alcance, acesa: um anel enche em `segurarS` (3 s) e o
    ponto acende; a tocha volta para a mão;
  - solta em qualquer outro lugar: volta para a mão, sem intenção.
  - **dois cliques** na alça (ou no ponto aceso) apagam; dois cliques na apagada reacendem com o mesmo
    saldo. Menu do botão direito na alça: "Guardar na mochila".
  - quem pode: quem controla o personagem (com a capacidade) e o mestre. Ninguém mais arrasta a tocha
    alheia.
- **Alcance** (`dentroDoAlcance`, puro e testado): distância 5e no grid (Chebyshev, entre os quadrados
  mais próximos ocupados por cada token, ou entre o token e o ponto) ≤ `alcanceInteracaoM`. Com 1,5 m,
  só adjacentes (inclusive na diagonal). **Entregar exige o alcance** (assumido).
- **Pontos** (`Ponto` da 4.1, coleção `pontos`): o mestre cria no painel "Fontes de luz", seção
  "Pontos", com "+ Suporte" e "+ Inflamável" e um clique no mapa (como "+ Luz fixa"); edita nome,
  capacidade, modelo, `segurarS` e "visível para os jogadores". Intenções `ponto.criar/editar/apagar`
  (`cena.editar`).
  - **tirar do suporte:** qualquer jogador com um token dentro do alcance e mão livre, com `ponto.usar`
    (assumido);
  - **inflamável:** `ponto.acenderInicio` e `ponto.acenderFim`; a sala confere pelo relógio dela que
    passaram `segurarS`, o alcance e que a tocha está acesa. Antes disso, recusa. O "início" pendente é
    transitório (não vai para a exportação nem para os jogadores);
  - acender um inflamável cria o objeto do modelo dele no ponto e torna o ponto visível;
  - ponto oculto não chega ao jogador; objeto num ponto oculto só chega aceso.
- **Painel "Fontes de luz"** (substitui o espaço "Com tempo"): lista também as variáveis (tochas nas
  mãos, com o nome do personagem, e as dos pontos), com o tempo restante, **−1 min / +1 min**, a lixeira
  (consumir, inclusive a tocha de um jogador) e o slider de intensidade. Clicar numa fonte abre saldo,
  histórico e modificadores (raio ×, com ou sem prazo no relógio da sala). Tudo entra no histórico:
  "−1 min: apagada", "+1 min (mestre)". Intenção `objeto.ajustar` (capacidade do mestre).
- **Pausar a mesa:** botão de pausa/retomar com o relógio da sala no fim do menu superior do mestre
  (assumido: o Vilella não definiu onde). Para os jogadores, um selo discreto "Mesa pausada" no topo.
  Intenções `mesa.pausar` e `mesa.retomar` (`mesa.configurar`). V1 (2026-11-11): `mesa.zerarRelogio` (ver 4.8).
- **Capacidades** (já existem em `capacidades.ts`): `tocha.acender` (acender, apagar e reacender a
  **própria** tocha, guardar), `tocha.entregar` (entregar, pôr no suporte), `ponto.usar` (tirar do
  suporte, acender inflamável), `luz.apagar` (apagar a luz de um ponto; padrão desligado, como hoje) e
  `objeto.ajustar` (só do mestre).
- **Sigilo de sempre:** a mochila e os objetos dela chegam a quem vê o personagem; a tocha na mão, a
  quem vê o token dele na cena ativa (o filtro do Lote 6).

**Como ficou (2026-11-06):**
- modelos e pontos são coleções do estado (`Estado.modelos`, `Estado.pontos`; o tipo é `PontoDeLuz`,
  porque `Ponto` já é a coordenada), não ficam dentro da `ConfigDaMesa`; `RelogioSala` em
  `packages/shared/src/relogio.ts`;
- o objeto tem dois formatos: o da sala (com `saldoMs` e `acesaDesdeSala`) e o do navegador
  (`objetoParaVisao`, o único caminho de saída, com `restanteMs`, `contando` e `estagio` conforme o papel
  e o `tempoParaJogadores`). O relógio do jogador não leva o tempo da sala; os modelos dele vêm sem a
  duração fora do modo `exato`;
- o vencimento é `processarSistema`, fora do `IntencaoSchema` (nenhum cliente consegue mandá-lo); o
  agendador guarda um marco `luz.marco` por objeto aceso;
- a exportação v8 restaura a campanha com a mesa pausada;
- gancho de teste `POST /teste/avancar-relogio?ms=N`, só com `MODO=teste`;
- assumido pelo agente: o mestre também precisa do alcance para entregar; apagar ou reacender objeto de
  ponto exige alcance para o jogador; apagar com penalidade maior que o saldo consome a tocha; modelo em
  uso não pode ser apagado e editar um modelo não muda os objetos já criados;
- pendência pequena: a tocha na mão só chega ao jogador se o token do personagem estiver na cena ativa;
  quem edita o personagem deveria vê-la na mochila mesmo assim (corrigir no Lote 9, junto da ficha).

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

**Decidido antes de começar (2026-11-06; prevalece sobre os itens acima onde conflitar; "(assumido)"
entra nas perguntas do fim):**
- **Parser** (`packages/shared/src/dados.ts`, puro): termos `NdM`, `dM` (= 1dM), `d%` (= d100),
  constantes, `+` e `−`, `khN`/`klN` (`2d20kh1` = vantagem, `2d20kl1` = desvantagem) e espaços. Limites
  contra abuso: até 100 dados por termo, até 1000 faces, até 20 termos; acima disso, recusa com motivo.
  O parser só lê a expressão; quem rola é a sala.
- **Rolagem na sala** com `crypto.getRandomValues` e rejeição (sem viés de módulo). O resultado guarda
  cada dado (inclusive os descartados pelo kh/kl), o total e a expressão. A função que rola recebe a
  fonte de aleatoriedade, para os testes usarem uma semente fixa.
- **Mensagem do chat** (`Mensagem`): `{ id, seq, emSala (relógio da sala), autorId, como?
  (personagemId), tipo: 'texto' | 'rolagem' | 'modelo', texto?, rolagens?, visivelPara: 'todos' |
  { ids } , oculta? }`.
  - **sussurro** `/w Nome texto`: chega ao autor, aos destinatários e ao mestre (assumido: o mestre vê
    todos os sussurros);
  - **rolagem oculta** `/gr 1d20`: só o autor e o mestre veem. O mestre sempre pode; o jogador precisa de
    `dado.rolarOculto` (padrão desligado, como hoje);
  - `/r 1d20+5` rola; `[[1d20+5]]` dentro do texto rola inline; `/em texto` é ação ("Brisa olha em
    volta"); `/?` lista os comandos;
  - qualquer campo de resultado mandado pelo cliente é descartado pelo schema (teste disso).
- **Modelos de rolagem** (`chat.modelo`): ataque (acerto + dano; 20 natural é crítico e **dobra os
  dados** do dano, os modificadores não), teste com CD (mostra sucesso/falha) e teste simples. Vantagem e
  desvantagem por um seletor no próprio modelo (normal/vantagem/desvantagem). A ficha do Lote 9 usa
  esses modelos.
- **"Como:"** no rodapé do chat: o próprio nome ou um personagem que eu edito (o mestre: qualquer um).
  A mensagem mostra o retrato e o nome do personagem.
- **Dados rápidos** (barra esquerda): a linha é o dado e a coluna a quantidade, como já está; clicar rola
  na hora e o resultado vai para o chat, pública (com Shift, oculta, se puder).
- **Histórico persistido** numa tabela própria no SQLite da sala (não em `entidades`), sem limite de
  gravação. O snapshot traz só as últimas 200 mensagens que o usuário pode ver; "carregar anteriores"
  pede mais (`chat.anteriores`), sempre filtrado. O mestre pode limpar o chat (com confirmação).
  O chat **não entra** na exportação da campanha (assumido: é registro da sessão).
- **Interface:** aba Chat da barra direita (a presença continua no topo); cartões de rolagem com o
  total grande, os dados ao passar o mouse (descartados riscados), 20 natural e 1 natural destacados;
  selo de não lidas no ícone do chat quando a aba está fechada; Enter envia e Shift+Enter quebra a
  linha; seta para cima repete a última mensagem.
- **Limites:** texto até 2000 caracteres; até 10 mensagens por segundo por conexão (o resto é recusado
  com aviso).

**Como ficou (2026-11-07):**
- `Mensagem.como` é um objeto `{ personagemId, nome, retratoHash? }` (copiado na hora, para quem não vê
  a ficha); a mensagem ganhou `emReal`, `acao` e `inline`; `emSala` só vai ao jogador no modo "exato";
- os dados rápidos usam a intenção `dado.rolar`; as funções `pedidoDeAtaque`, `pedidoDeTeste`,
  `rolarAtaque` e `rolarTeste` ficam prontas para a ficha do Lote 9;
- histórico na tabela `chat` (migração 6, aditiva); `Estado.retratosDoChat` (interno da sala) libera o
  retrato de quem fala numa mensagem pública; erro novo `muitas_mensagens`;
- gancho de teste `POST /teste/dados?semente=N`, só com `MODO=teste`;
- na interface, a presença ficou compacta (com "★" para mim) e os modelos de rolagem abrem num botão
  ao lado do "Como:";
- assumido: o mestre vê todos os sussurros e rolagens ocultas; a seta para cima traz a última mensagem
  de volta para a caixa (não reenvia); `/w` para si mesmo é permitido;
- frágil: cada snapshot relê o histórico do SQLite por usuário (custo para o deploy futuro, 4.5), e o
  snapshot de reconexão descarta as mensagens anteriores já carregadas.

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

**Decidido antes de começar (2026-11-06; prevalece sobre os itens acima onde conflitar; "(assumido)"
entra nas perguntas do fim):**
- **Modelo** (`packages/shared/src/ficha.ts`, zod + funções puras de derivação): a ficha guarda só os
  valores base:
  - identidade (raça, antecedente, alinhamento) e `classes: { classe, subclasse?, nivel }[]`;
  - atributos (valores);
  - salvaguardas e perícias com `nenhuma | proficiente | especialista`, mais um bônus extra manual (V4a3, 2026-11-12: edita-se pelo botão direito ou Shift+F10 na linha, num popover "Modificador:", nunca no hover);
  - CA (número, com nota), deslocamento em ft;
  - PV atual/máximo/temporário, dados de vida usados por tipo e testes contra morte;
  - ataques `{ nome, acerto: número fixo | fórmula, dano (expressão), tipo }`;
  - conjuração por classe (habilidade; V4a3, 2026-11-12: sem classe conjuradora vale o campo opcional `habilidadeDeConjuracao`, que dá CD e ataque), espaços gastos por nível (o total por círculo vem da tabela de multiclasse e `espacosTotal` sobrescreve, também sem classe), `magias: { nome, nivel, preparada,
    escola?, descricao }[]`;
  - características (texto), `itens: { nome, quantidade, modeloId?, nota? }[]`;
  - recursos `{ nome, atual, max, recarga: 'curto' | 'longo' | 'nenhuma' }`, idiomas e notas.
- **Derivados por fórmula**, nunca gravados: modificadores, proficiência pelo nível total, salvaguardas,
  perícias, percepção passiva, iniciativa, CD e ataque de magia, espaços pela tabela de multiclasse (o
  pacto do Bruxo à parte) e deslocamento em metros.
- **Dados do SRD 5.1** (`packages/shared/src/srd/`): só o que as contas precisam (classes com dado de
  vida, salvaguardas, tipo de conjurador e habilidade; perícias com o atributo e o nome em pt-BR;
  tabela de espaços). Junto, `ATRIBUICAO-SRD.md` com o aviso CC-BY-4.0. Sem texto de magia: isso é do
  compêndio (Lote 14).
- **O Lote 7 vira ficha:** a `mochila` do personagem vira `itens` com `modeloId`, e a quantidade do item
  é o número de novas. As usadas continuam objetos com portador `mochila`, mostrados embaixo do item,
  com "Acender". O `modInteligencia` do Lote 6 passa a vir do atributo da ficha; personagem sem ficha
  preenchida usa o campo antigo. A visão no escuro continua no personagem.
- **Pendência do Lote 7:** a tocha na mão também chega a quem edita o personagem, mesmo com o token
  fora da cena ativa (hoje só chega se o token estiver lá), para aparecer na ficha.
- **Interface:** a ficha abre numa **janela flutuante** grande sobre o mapa (arrastável, com
  redimensionar, várias abertas ao mesmo tempo), no estilo das mesas virtuais em tema escuro. Abas: Principal
  (atributos, salvaguardas, perícias, CA, iniciativa, deslocamento, PV, dados de vida, morte, ataques),
  Magias, Características, Equipamento e Notas, e Configurar (o editor do item de hoje: retrato, token,
  pasta, quem edita). Duplo clique no item das Fichas abre a janela.
- **Rolar da ficha:** todo número rolável é clicável e usa os modelos do Lote 8 (ataque, teste com ou
  sem CD). No cabeçalho da ficha, um seletor normal/vantagem/desvantagem vale para o próximo clique. A
  rolagem sai "Como:" o personagem.
- **Descansos:** "Descanso curto" (recursos de curto e espaços do pacto) e "Descanso longo" (PV, metade
  dos dados de vida, espaços e recursos de longo), com confirmação.
- **Quem vê a ficha:** a pasta decide quem vê o item (nome e retrato). A **ficha completa** de um
  personagem que o jogador não edita só chega a ele com `ficha.verOutras` (padrão desligado, como hoje);
  sem ela, a sala manda o item sem a ficha (assumido). O mestre vê tudo.
- **Gravação agrupada:** o navegador junta as mudanças por ~400 ms e manda `ficha.alterar` com uma lista
  de operações `{ caminho, valor }`; a sala aplica, valida a ficha inteira com zod e recusa se passar de
  256 KB. Duas pessoas no mesmo campo: vale a última.
- **Exportar e importar a ficha** em JSON: na pasta local escolhida em Configurações (hoje: Preferências; subpasta `fichas/`),
  ou baixar o arquivo se não houver pasta. Importar substitui a ficha depois de confirmação.
- **Fixture:** `fixtures/fichas/darion.json` montado à mão com os valores da seção 8 (ataques como valor
  fixo), usado nos testes e carregável na semente de teste.

**Como ficou (2026-11-07):**
- `Personagem.ficha?: Ficha` é **esparsa** (só `pvAtual` e `pvMax` obrigatórios) e opcional na visão de
  quem não vê a ficha; a `mochila` do Lote 7 só existe como formato antigo, absorvida na leitura do banco
  e na importação (a linha antiga do SQLite não é reescrita); `ficha.alterar` passou a operações
  `{ caminho, valor }`; exportação v9; arquivo da ficha com o formato `tabletop-ficha`;
- um filtro só (`personagemParaUsuario`): sem a ficha, o item leva o `modInteligencia` já calculado;
  ligar ou desligar `ficha.verOutras` manda snapshot a todos; mudar editores ou pasta reenvia os objetos
  de luz do personagem;
- a pendência do Lote 7 foi resolvida: a tocha na mão chega a quem edita o personagem mesmo sem token na
  cena ativa;
- o PV e os objetos de luz saíram do editor do item para as abas Principal e Equipamento; o editor virou
  a aba Configurar;
- assumido: só o mestre aumenta a quantidade de item com `modeloId` (repor tochas); meio-conjurador
  sozinho usa `ceil(nível/2)` a partir do 2 e terço `ceil(nível/3)` a partir do 3 (multiclasse soma o
  piso por classe); ataque sem acerto rola só o dano; descanso longo devolve metade dos dados de vida,
  dos maiores primeiro; importar a ficha é por arquivo escolhido (a pasta `fichas/` só recebe a
  exportação); no Darion, os recursos e as 3 tochas são suposições a conferir na ficha impressa;
- frágil: a janela não lembra a posição; a escrita em `fichas/` não tem E2E; duas pessoas no mesmo campo,
  vale a última; os objetos usados na mochila ainda chegam a quem vê o item sem ver a ficha (detalhe
  pequeno de sigilo, para um ajuste futuro).


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

**Decidido antes de começar (2026-11-06; prevalece sobre os itens acima onde conflitar; "(assumido)"
entra nas perguntas do fim):**
- **pdf.js** vem do npm (`pdfjs-dist`), empacotado pelo Vite, com o worker local. Nada de CDN.
- **Separação:** o navegador extrai os pedaços de texto com posição (`{ pagina, str, x, y, largura,
  altura }`) e o **parser puro** em `packages/shared/src/importarFichaPdf.ts` recebe esses pedaços e
  devolve `{ ficha, incertos: { caminho, motivo, trecho }[] }`. O teste em `shared` roda o pdf.js em Node
  (dependência só de desenvolvimento) sobre `fixtures/fichas/darion.pdf` e confere a seção 8.
- **Campos com "revisão" na seção 8** vêm em `incertos`, nunca com chute. Os recuperáveis ("Cure
  Wound…" → "Cure Wounds - Curar Ferimentos") vêm preenchidos e também marcados, com o motivo
  "recuperado".
- **Ataques importados** ficam como valor fixo, nunca recalculados.
- **Onde fica:** no item das Fichas, menu "Importar ficha (PDF)"; também "+ Novo a partir de
  PDF" na aba Fichas. O PDF é lido no navegador e não sai do PC.
- **Tela de revisão** (janela grande): cada seção da ficha com o valor lido, o trecho do PDF ao lado, os
  incertos em amarelo e editáveis. "Confirmar" manda a ficha para a sala; "Cancelar" não manda nada.
  Importar por cima de uma ficha existente pede confirmação e mantém retrato, token e pasta.
- **Caixas de recurso** (FLECHAS, TOCHAS, LABAREDA PROTETORA, RAD DO AMANHECER) entram como recursos e
  sempre marcadas para revisão, porque o PDF repete as caixas (assumido).
- **Magias** com descrição inteira, inclusive anotações da mesa.

**Como ficou (2026-11-09):**
- `pdfjs-dist` 6.5.438 do npm (no `shared`, só de desenvolvimento, para o teste ler o PDF em Node); o
  worker é empacotado pelo Vite e o pdf.js é carregado só quando alguém importa;
- o parser (`importarFichaDoPdf`) devolve também `reconhecido`, `nome` e os `trechos` crus por seção,
  para a tela de revisão; mede a **escala** do documento pela altura mais comum do texto, por isso A4 e
  Carta dão a mesma ficha;
- o PDF imprime CA, iniciativa e deslocamento **sem rótulo** (três números numa linha acima do PV
  máximo); "preparada", os espaços gastos e os dados de vida não saem do PDF: as magias entram todas
  preparadas (com aviso), e os espaços e o "10" solto só **conferem** com a tabela das classes
  (divergência vira incerto);
- sem mudança no protocolo: importar por cima é um `ficha.alterar` com caminho vazio, "Novo a partir de
  PDF" é um `personagem.criar` com a ficha; sem migração;
- assumido: a subclasse vem do texto da classe ("Hunter Ranger 5"); moedas e personalidade vão para as
  notas; caixas de recurso repetidas com o mesmo nome viram uma só;
- frágil: só o PDF do Darion foi testado (falta o de outro jogador para o "pronto quando"); os rótulos em
  PT da página de conjuração e os em EN foram supostos; PDF escaneado não funciona.

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

**Decidido antes de começar (2026-11-09; prevalece sobre os itens acima onde conflitar; "(assumido)"
entra nas perguntas do fim):**
- **Conteúdo da ordem de turno** (o painel e o mostrar/esconder já existem desde o Lote 4b):
  `Combate = { entradas: { id, tokenId?, nome, iniciativa?, destreza?, valorOculto?, oculta? }[],
  atualId?, rodada }`. A vez é guardada pelo **id** da entrada, nunca pelo índice (o índice vazaria
  quantas entradas ocultas existem).
  - o mestre adiciona tokens (botão direito no token → "Entrar na iniciativa", ou "Adicionar
    selecionados") e entradas soltas ("Covil, 20"); tira entradas; apagar o token tira a entrada dele;
  - "Rolar para todos" rola a iniciativa de quem ainda não tem valor, com o bônus da ficha (ou 0) pelo
    modelo do Lote 8, e o resultado vai para o chat. **A rolagem de NPC vai oculta** (como o `/gr`; só o
    mestre vê) e a de personagem de jogador vai pública (assumido). O jogador rola a do próprio
    personagem (quem edita o personagem do token);
  - ordena da maior para a menor; **empate:** maior Destreza; empate de novo, o personagem de jogador
    antes do NPC e depois pelo nome (assumido). Rolar ou editar um valor reordena; o mestre também
    arrasta à mão, e o botão "Ordenar" volta à ordem pelos valores;
  - "Próximo turno" e "Anterior" (o primeiro "Próximo" começa na rodada 1); virar a lista soma a rodada.
    **O jogador da vez pode passar o próprio turno** (assumido);
  - "Encerrar combate" limpa a lista e a rodada (com confirmação).
- **Capacidades:** `combate.gerir` nova, só do mestre (adicionar, tirar, ordenar, editar, avançar,
  encerrar, rolar para todos). Rolar a própria iniciativa e passar o próprio turno: quem edita o
  personagem do token (conferido no `processar`, como o `ficha.alterar`).
- **Sigilo** (filtro na sala, como os demais): a entrada cujo token o jogador não recebe (oculto, na
  camada do mestre) não chega a ele, nem a solta marcada `oculta`. `valorOculto` mostra o nome com "?"
  no lugar do número. Se a vez é de uma entrada que o jogador não vê, nada fica em destaque para ele
  (assumido). A rodada chega a todos.
- **Token da vez:** um anel destacado no mapa para todos que veem o token; a lista mostra a vez em
  destaque e acompanha a rolagem.
- **Condições do 5e 2014** (as 14: Agarrado, Amedrontado, Atordoado, Caído, Cego, Contido, Enfeitiçado,
  Envenenado, Incapacitado, Inconsciente, Invisível, Paralisado, Petrificado, Surdo; e Exaustão de 1 a 6)
  ficam **no token** (assumido; cada goblin tem as suas), com ícones pequenos na borda do token, uma
  dica com o resumo da regra (texto nosso, em pt-BR) e a lista na ficha (a ficha mostra as do token do
  personagem na cena ativa). Botão direito no token → Condições. Quem pode: o mestre e quem edita o
  personagem do token. Quem vê o token vê as condições. Nenhuma regra é aplicada sozinha (sem
  desvantagem automática; fica para o 7b).
- **Concentração:** marca no token (com o nome da magia), mostrada no token e na ficha. Sem teste de
  Constituição automático por enquanto (vira ideia para o 7b).
- **Exportação:** a ordem de turno e as condições entram (versão nova da exportação) (assumido).

**Ordem de turno simples (V2, 2026-11-11; prevalece sobre o que está acima onde conflitar):** a janela é uma lista estreita (270 px, layout de referência) com o nome, o número da
iniciativa à direita e a linha "Rodada: N" abaixo do cabeçalho (só título e ×); o mestre edita os números e a rodada clicando, ordena, passa o turno, dá a vez e limpa;
arrasta a linha (ou Alt+↑/↓) e usa o botão direito ("Dar a vez", "Tirar da lista"). Saíram da tela "Montar" (rolar para todos, o grupo,
adicionar selecionados, entrada solta), esconder entrada ou valor, a alça e o "Passar" do jogador; os campos `valorOculto` e
`oculta` seguem no schema. O mestre abre e fecha a ordem para todos (fechar não apaga a lista nem a rodada). O jogador seleciona os
tokens que controla (só na tela dele) e, com a ordem aberta, entra clicando em Iniciativa na ficha: intenção `combate.entrar { tokenId }`
(a sala rola 1d20 + a ficha, manda ao chat e põe o token na lista); `combate.rodada` e `combate.darVez` são do mestre.

**Como ficou (2026-11-09):**
- `Estado.combate?` (tabela `combate`, migração 7) e, no token, `condicoes?`, `exaustao?` e
  `concentracao?`; a entrada guarda também `jogador` (para o desempate); evento único
  `combate.alterado` com o combate inteiro, filtrado por usuário (a mudança que o jogador não percebe
  nem chega a ele); exportação v10;
- **quem age pela entrada** (rolar a própria, passar o próprio turno, marcar condições): o mestre ou quem
  **controla o token** — edita o personagem ou está em `controladoPor` (o familiar entregue a um
  jogador). Ajustado na revisão; o desenho dizia só "quem edita o personagem";
- o menu de botão direito do token é novo (antes só existia o da alça da tocha): "Entrar na
  iniciativa" e "Condições…"; marcadores de duas letras na borda do token, com a regra na dica;
- assumido: o nome da entrada é copiado do token; o jogador rola a própria uma vez (o mestre refaz);
  rolagem de entrada com valor oculto ou escondida vai oculta mesmo sendo de PJ; tirar a entrada da vez
  passa o turno; "Adicionar selecionados" usa a seleção única da mesa, e "O grupo" adiciona os PJs da
  cena;
- frágil: o arrasto da lista não tem E2E; a dica das condições só abre com o mouse; o painel (364 px)
  cobre parte do mapa em telas de 1280 px.

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

### Lote 13 — Pincel e camada de desenho (M)

**Objetivo:** desenhar no mapa (seção 4.13.1). A interface já existe desde o Lote 4b.

**Entregáveis:**
- pincel com voltar, selecionar, formas (livre, linha, retângulo, círculo), cores e borracha;
- todo desenho, de jogador ou mestre, vai para a camada de desenho, qualquer que seja a camada atual. A
  camada é sempre visível para todos (também no escuro), por cena;
- borracha e seleção do pincel só atuam nessa camada;
- "limpar todos os desenhos" do mestre no menu de camadas;
- desenho gravado na sala e sincronizado ao vivo.

**Assumido até o Vilella decidir:** o jogador apaga e seleciona só os próprios desenhos; o mestre, todos.
Desenhar é uma capacidade delegável, ligada por padrão.

**Pronto quando:** `pnpm verify` verde.

**Decidido antes de começar (2026-11-09; prevalece sobre os itens acima onde conflitar; "(assumido)"
entra nas perguntas do fim):**
- **Desenho** (`Desenho`, coleção `desenhos`, tabela nova): `{ id, cenaId, autorId, forma: 'livre' |
  'linha' | 'retangulo' | 'circulo', pontos (em metros), cor, espessura, preenchido? }`. Traço livre
  simplificado no navegador (Douglas–Peucker) antes de enviar; até 2000 pontos por desenho e até 1000
  desenhos por cena (assumido).
- **Ao vivo:** enquanto desenha, o navegador manda o traço em andamento a cada ~80 ms
  (`desenho.rascunho`, só repassado a quem recebe a cena, não gravado, com limite de frequência); ao
  soltar, `desenho.criar` grava. O rascunho de quem saiu ou cancelou some.
- **Camada de desenho** sempre por cima do mapa e dos tokens, **visível também no escuro** (fora do
  véu e da memória do mapa). Para o mestre, aparece no menu de camadas; os jogadores só veem os
  desenhos. Os desenhos chegam a quem recebe a cena, pela mesma regra dos tokens visíveis da cena.
- **Pincel** (sub-barra que já existe): voltar (apaga o meu desenho mais recente da cena), selecionar
  (mover e apagar os meus; o mestre, todos), formas, cores (paleta de 8 + cor livre), espessura,
  preenchido (retângulo e círculo) e borracha (apaga o desenho inteiro que tocar, não pedaços)
  (assumido). Desenhar não muda a camada atual de quem desenha.
- **Capacidade delegável nova** `desenho.criar`, ligada por padrão; apagar e mover só os próprios
  (assumido); o mestre mexe em todos e tem "Limpar todos os desenhos" (da cena) no menu de camadas, com
  confirmação. Apagar a cena apaga os desenhos dela; duplicar a cena duplica os desenhos.
- Exportação: os desenhos entram (versão nova).

**Como ficou (2026-11-09):**
- `Estado.desenhos` (tabela `desenhos`, migração 8); exportação v11; capacidade delegável
  `desenho.criar` (ligada por padrão), exigida por todas as intenções do pincel (sem ela, o jogador
  também não mexe nos próprios); `desenho.limpar` é do mestre (`cena.editar`);
- o rascunho (`desenho.rascunho` → `desenho.rascunhando`/`rascunhoFim`) só passa pela memória da sala,
  com intervalo mínimo de 30 ms por conexão, no máximo 16 traços abertos e fim automático quando a
  conexão cai; vai a quem recebe a cena, nunca ao autor;
- retângulo e círculo guardam dois pontos; espessura em pixels do mundo (1 a 24); preenchimento com
  40% de opacidade; `desenho.mover` leva um deslocamento, sem arrasto ao vivo para os outros;
- o mestre desenha na cena que está **vendo**; o jogador, só na ativa. O botão de seta da sub-barra
  virou "fechar", e o "voltar" do plano é o desfazer do meu mais recente;
- assumido: sem encaixe no grid; sem refazer; apagar é idempotente;
- frágil: o redesenho de todos os desenhos de uma vez não foi medido com 1000 desenhos de 2000 pontos.

---

### Lote 14 — Compêndio de magias (M)

**Objetivo:** consultar magias e puxá-las para a ficha e para o chat (seção 4.13.1).

**Entregáveis:**
- a aba Compêndio lê um JSON de magias da **pasta local** do mestre, fora do repositório (a mesma
  premissa das imagens; o conteúdo do Livro do Jogador tem direitos autorais; a alternativa livre é o
  SRD 5.1);
- busca e filtros (nível, escola, classe);
- mandar a descrição para o chat e puxar a magia para a ficha (depende dos Lotes 8 e 9);
- talvez monstros e armas depois.

**Pronto quando:** `pnpm verify` verde.

**Decidido antes de começar (2026-11-09; prevalece sobre os itens acima onde conflitar; "(assumido)"
entra nas perguntas do fim):**
- **Formato** (`packages/shared/src/compendio.ts`, zod): `{ formato: 'tabletop-compendio', versao: 1,
  magias: { nome, nomeOriginal?, nivel, escola, tempo, alcance, componentes, duracao, concentracao,
  ritual, classes[], descricao, emNiveisSuperiores? }[] }`, com limites de tamanho por campo e no total.
  Um conversor de outros formatos fica para depois.
- **Premissa das imagens:** o mestre põe `compendio/magias.json` na pasta local dele. O arquivo nunca
  fica no servidor: o navegador do mestre valida o JSON, registra o arquivo como asset (tipo novo
  `compendio`, por hash) e define o compêndio da mesa (`Estado.compendio?: { hash, nomeOriginal,
  magias: number }`, intenção do mestre); os jogadores o recebem pelo mesmo caminho das imagens
  (pedaços, cache local) e todos podem consultar (assumido). Sem pasta ou sem arquivo, a aba mostra
  como montar o JSON; arquivo inválido mostra o erro (com o campo) e não é distribuído; "Recarregar"
  relê o arquivo da pasta.
- **Repositório:** nenhum texto de magia com direitos autorais no repo. Um exemplo com 3 magias do SRD
  5.1 (CC-BY-4.0, com a atribuição) em `fixtures/compendio/exemplo-srd.json` para testes.
- **Aba Compêndio** (o ícone já existe na barra lateral): busca por nome e nome original (sem acento e
  sem caixa), filtros de nível, escola, classe, concentração e ritual; a magia abre um cartão com a
  descrição completa.
- **Ações:** "Mandar para o chat" (mensagem nova do tipo `magia`, com a magia dentro e limites de
  tamanho; "Como:" o personagem; a descrição recolhível) e "Adicionar à ficha" (escolhe o personagem
  que eu edito; entra na lista de magias com nível, escola e a descrição montada com os campos; se já
  existe uma com o mesmo nome, avisa e não duplica) (assumido).
- Monstros ficam para depois. Armas e itens entraram no V4b (2026-11-12): `armas` e `itens` opcionais no mesmo arquivo (`armas: { nome, nomeOriginal?, categoria, distancia, dano, tipoDeDano, propriedades[], alcance?, peso?, custo? }[]`, `itens: { nome, nomeOriginal?, descricao?, peso?, custo? }[]`), listados na aba Compêndio e arrastáveis para a ficha.

**Como ficou (2026-11-09):**
- asset novo `compendio` (só o mestre registra; até 8 MB e 2000 magias); `Estado.compendio` na tabela
  `meta`, sem migração; `compendio.definir` (`mesa.configurar`) só aponta para um asset `compendio` já
  registrado; exportação v12 (a meta vai, o arquivo não);
- o navegador do mestre lê `compendio/magias.json` sozinho ao conectar e quando a pasta muda, e só
  registra se o hash mudou; "Recarregar" relê; "Escolher o arquivo…" para navegadores sem o seletor de
  pasta; arquivo com nome de magia repetido é recusado;
- `chat.caracteristica { caracteristica: { nome, descricao, origem? }, como }` (V4a, 2026-11-11): publica uma mensagem `caracteristica`, sempre pública, de um personagem que quem fala edita (`como` obrigatório). Sem capacidade nova.
- `chat.magia` é uma intenção própria, sempre pública, com a magia inteira dentro (a sala valida os
  limites, não confere o compêndio); "Adicionar à ficha" entra preparada, sem conferir classe nem
  espaço;
- o exemplo do SRD (Bola de Fogo, Mísseis Mágicos, Detectar Magia) foi traduzido de memória: conferir
  antes de usar fora dos testes;
- frágil: com dois mestres e arquivos diferentes, o último a conectar redefine o compêndio; a lista não
  é virtualizada; a leitura da pasta de verdade só passa pelo roteiro manual.

---

### Depois (fora dos lotes atuais)

- handouts (imagem ou texto entregue a um jogador, que fica no inventário dele);
- som ambiente sincronizado (vento da Inspiração, gotejar, combate), também lido da pasta local;
- dados 3D (só visual; o resultado continua vindo do servidor);
- ~~filtro por linha de visão no servidor~~: **descartado** pelo Vilella em 2026-11-06 (visão e escuridão
  são só de tela; ver 4.7);
- editor de templates para importar PDFs de outras fichas;
- importação de foto de ficha (OCR local), se um dia valer a pena;
- deploy na internet (Cloudflare, conta pessoal) e login real — outro plano;
- ideias ainda não decididas (ordem dos lotes, deploy mínimo, importar mapas com paredes, exportar
  mapas da Masmorra): ver `docs/IDEIAS.md`.

---

## 8. Valores de referência do PDF do Darion

Ficam só no computador do mestre, em `privado/notas/darion.md` (a pasta `privado/` não entra no git).

---

## 9. Como trabalhar neste projeto com IA

Regras para o agente que implementa:

1. **Um lote por vez.** Antes de começar, ler este documento e `docs/ESTADO.md` (e `docs/IDEIAS.md`
   quando o lote tocar no assunto).
2. **Só avança com tudo verde:** `pnpm verify` passando e o roteiro manual feito pelo Vilella.
   O `verify` roda **uma vez** (desde 2026-11-10; antes eram duas rodadas seguidas). O Playwright repete
   uma vez o teste que falhar e reprova o que só passar na repetição (instável: corrigir, nunca aceitar).
   Os E2E novos ou alterados no lote rodam também 3 vezes seguidas:
   `pnpm --filter @tabletop/e2e test --repeat-each=3 <arquivos>`.
3. Ao terminar um lote, atualizar `docs/ESTADO.md` (o que foi feito, decisões tomadas, desvios deste
   plano e o porquê) e `docs/protocolo.md` se o protocolo mudou.
4. **Nada vem da internet em tempo de execução:** não usar CDN, fontes remotas, analytics ou APIs de
   terceiros.
5. Lógica de regras, geometria, dados e import de PDF em `packages/shared`, pura e testada.
6. Toda mensagem nova do protocolo tem schema zod e é filtrada por papel na sala.
7. Nada que o jogador não pode ver sai da sala para ele. Todo lote que cria dado secreto inclui um
   teste E2E que inspeciona os frames do jogador (modelos: os testes "frames ..." em
   `e2e/tests/sala.spec.ts`, `mapa.spec.ts`, `assets.spec.ts` e `cenas.spec.ts`). O canvas se testa pelo gancho
   `window.__tabletop`, que só existe no modo `e2e`.
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
- Assumido até decidir: tocha apagada continua ocupando a mão; qualquer jogador no alcance tira uma
  tocha de um suporte; entregar exige alcance (padrão 1,5 m) para os jogadores.

**Decidido em 2026-11-10:**
- **Nome do projeto: Távola** (`tavola` em código e pastas); detalhes do redesign em `docs/REDESIGN.md`.
- **A mesa pausa sozinha quando não sobra nenhum mestre conectado** (o mestre saiu, ou saíram todos), para
  as tochas não queimarem entre as sessões. Retomar continua sendo do mestre. Lote pequeno logo depois do R2.
- A névoa continua **só automática** (visão dos tokens, luz e memória do mapa); revelar à mão fica em
  `docs/IDEIAS.md`.
- Na visão do mestre, a área que um jogador vê só com visão no escuro aparece em **cor normal** (o cinza
  é só da tela do jogador).
- O mestre entrega e põe tochas em suportes de longe.
- Darion: valem os números do PDF (9 tochas; 7 flechas de máximo 20).
