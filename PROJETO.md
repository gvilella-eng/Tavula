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
| IA | Servidor **MCP** por HTTP na própria sala (e local, em stdio, em `apps/mcp`) | Configurar a mesa com IA usando as mesmas intenções, schemas e permissões dos clientes (seção 4.12) |

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
  | 'dado.rolarOculto' | 'asset.subir' | 'desenho.criar' /* lote 13, ligada por padrão */
  | 'token.colocarProprio' /* V10b */ | 'mapa.pingar' /* V12, 2026-11-13: pingar o mapa; ligada por padrão */
  | 'personagem.criarProprio' /* 12-1, 2026-11-13: criar as próprias fichas e handouts (teto de 20 de cada); ligada por padrão */
  | 'equipamento.dar' /* FG1, 2026-11-20: dar e tirar equipamento de modelo (tochas) dos próprios personagens; ligada por padrão */;
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
  tokenPadrao: { cor: string; tamanhoQuadrados: number; assetHash?: string; barraDeVida?: boolean /* Q11: tokens novos com a barra de vida; sem o campo, sim */ };
  // o token colocado guarda a própria cópia de nome, cor, tamanho e imagem do token padrão;
  // Q8: personagem de jogador tem no máximo um token por cena (pode ter um em cada cena)
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
  cartao?: boolean;                 // V10c, 2026-11-13: cena como cartão (imagem inteira, sem luz nem visão); sem o campo é mapa
  nevoa?: TracoDaNevoa[];           // N4, 2026-11-14: névoa pintada à mão; traços { forma, modo, pontos, raio? } em metros, na ordem; sem o campo não há névoa manual
  trilha?: { hash, nome, volume };  // N5 (LEGADO; Q4, 2026-11-16: só para ler, vira ambientes)
  ambientes?: number[];             // Q4, 2026-11-16: lugares de ambiente (0 a 7) que ligam ao levar o grupo; os outros desligam
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
  morto?: boolean;                  // N1, 2026-11-13: marca "morto" (X no token, todos veem); sem regra automática
  exaustao?: number;                // lote 11: 1..6
  concentracao?: string;            // lote 11: nome da magia
  pv?: { atual: number; max: number; temp?: number }; // Q10, 2026-11-17: vida PRÓPRIA do token de NPC (horda); ver abaixo
  numero?: number;                  // Q10: o número da numeração ("Goblin 3" tem 3); o nome é o que vale (sem selo no mapa desde o Q11)
  barraDeVida?: boolean;            // Q11, 2026-11-17: a barra de vida embaixo do token (só quem controla o token a vê); sem o campo = ligada
  borda?: "vermelho" | "laranja" | "amarelo" | "verde" | "ciano" | "azul" | "rosa" | "branco"; // Q11: anel colorido (8 cores fixas, `bordas.ts`); todos que veem o token o veem
}
// Q10, 2026-11-17: HORDAS. Token de NPC/monstro (personagem sem editores) com `Personagem.vidaPorToken` ligado (o padrão;
// `false` desliga, para o vilão único) nasce com `pv` = cópia dos PV da ficha naquele momento (a ficha vira o "modelo").
// A vida de um token é `token.pv` (campo, `hordas.ts`: `vidaDoToken`); sem `pv` (campanha antiga, personagem de jogador,
// vidaPorToken falso) vale a da ficha, sem migração. Token antigo de NPC sem `pv`: a primeira edição o grava no token.
// **Segredo:** `pv` só chega ao jogador que receberia a vida da ficha (vê o personagem e a ficha: `tokenParaUsuario`, no
// snapshot e nos eventos `token.criado`/`token.editado`); mudar quem vê a ficha manda snapshot novo. Numeração: ao pôr um NPC
// onde já há outro do mesmo personagem na cena, a SALA dá "Nome N" com o menor N livre a partir de 2 (o primeiro fica sem
// número; ninguém é renomeado; por cena). Cópia (`token.copiar`) é igual à origem (vida de agora, camada, oculto, condições...).

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
// N5: EfeitosDaZona.som?: { hash, nome, volume, laco }
// Q4 (2026-11-16): Estado.mesaDeSom?: { efeitos: (Lugar|null)[8], ambientes: (Lugar|null)[8] }, Lugar = { hash, nome (12), icone, cor, volume } (só o mestre recebe; vai na exportação);
//   Estado.somLigado?: { volumeGeral, tocando? (Q4b), ambientes: [{ indice, hash, volume, inicioMs, servidorMs? }] } é o que toca (todos recebem; fora da exportação); Estado.trilha (N5) é legado, só lido
// MU1 (2026-11-19): Estado.musica?: { faixas: [{ hash, nome, duracaoMs, energia? (1-5), etiquetas[], descricao? }], botoes: [{ id, nome (16), icone, cor, etiquetas[], energiaMin, energiaMax, ordem: aleatoria|crescente }] } (só o mestre; vai na exportação);
//   Estado.musicaTocando?: { botaoId?, botaoNome, ordem, inicial: Peca[], ciclo: Peca[], semente, volume, tocando, inicioMs, pausadoEm?, servidorMs?, anterior? (só do mestre) } é o que toca (todos recebem, sem o anterior; fora da exportação); ver 4.16
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
  chamaM?: { larguraM: number; alturaM: number };       // FG1, 2026-11-20: tamanho padrão da chama no mapa (m)
  animacoes?: { forte?: Hash; fraca?: Hash; morrendo?: Hash }; // FG1: animação da chama por estágio (asset 'animacao')
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
  chamaM?: { larguraM: number; alturaM: number }; // FG1: tamanho da chama deste inflamável (sem ele, o do modelo)
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

As **automações** (ciclos, reações, execução) moram em `Estado.automacoes` e os efeitos em `Estado.efeitos` (lote 7b-1, 2026-11-13):
ver a seção 4.11. Ficam fora de `modelos`, para nada disso chegar ao navegador do jogador.

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
- **Ping no mapa** (V12, 2026-11-13): `mapa.ping { cenaId, x, y, centralizar? }`, capacidade `mapa.pingar` (ligada por padrão). É efêmero como o movimento ao vivo: a sala valida (cena, quem vê, ponto dentro, no máximo 1 ping a cada 0,5 s e 1 centralização a cada 3 s por usuário) e repassa `mapa.pingado` com o autor e a cor dela a quem vê a cena, inclusive a quem pingou. Não é gravado, nem entra no histórico, no chat ou na exportação.
- **O acesso do Claude** (12-1, 2026-11-13): o cliente do MCP abre o mesmo WebSocket com `Authorization: Bearer <token>` e a sala o trata como o próprio usuário, com a marca `claude` no socket (lista de proibidos, limite de frequência, marca "pelo Claude", rascunho para o mestre, diário do Desfazer). O envelope ganha `loteId` e `lote` (só a conexão do Claude os usa). Ver 4.12, 4.14 e `docs/protocolo.md`, "O acesso do Claude".
- **Hordas** (Q10, 2026-11-17): `personagem.colocarVarios { personagemId, cenaId, tokenIds (1 a 20), x?, y? }` põe vários tokens de um NPC de uma vez (arrumados no grid, numerados e com a vida de cada um; um pedido só = um passo do Desfazer do Claude); `token.copiar { cenaId, itens: [{ origemId, id, x, y }] }` copia tokens para a mesma cena ou outra (duplicar, Alt+arrastar, Ctrl+C e Ctrl+V; a sala copia os campos da origem e numera); `token.vida { id, atual?, max?, temp? }` muda a vida própria do token (o mestre ou quem edita o personagem). As duas primeiras exigem `cena.editar` (só o mestre); `token.vida` não tem capacidade (a sala confere quem edita o personagem). `personagem.editar` aceita `vidaPorToken`. No MCP: `tokens` ganhou `colocar[].quantidade`, `copiar` e `pvTemp`; `pv` e `pvMax` de um token de NPC com vida própria vão para `token.vida`.
- **Gestos em lote, barra de vida e borda** (Q11, 2026-11-17): `tokens.mover { itens: [{ id, x, y }] (1 a 100) }` (capacidade `token.moverProprio`; a regra de cada token vale e um recusado recusa todos), `tokens.vidaDelta { ids (1 a 100), delta }` (dano negativo, cura positiva; vida própria no `pv` de cada token, vida da ficha uma vez por personagem; os temporários absorvem o dano primeiro; sem capacidade, a sala confere quem edita cada personagem) e `tokens.editar { ids, mudancas }` (`cena.editar`; as mudanças do `token.editar` em vários tokens). `token.editar` aceita `borda` (uma de 8 cores, `null` tira) e `barraDeVida`; `personagem.editar` aceita `barraDeVida` (token padrão). No MCP: `tokens` ganhou `borda`, `barraDeVida` e `grupo` (`deslocar`, `vida`, `borda`, `barraDeVida` em vários tokens num passo só); `fichas` ganhou `barraDeVida`.
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
- mestre: `mapas/`, `tokens/`, `sons/`, `handouts/`, `recebidos/<jogador>/` (só o que veio antes do AS1; os novos vão para `assets/`, ver 4.17), `assets/<pessoa>/<tipo>/` (AS1), `backup/`
- jogador: `tokens/`, `retratos/`, `fichas/`

**Cópia dos arquivos da mesa na pasta (Q1, 2026-11-16).** O mestre, com a pasta liberada para escrita, guarda
em `arquivos-da-mesa/<hash>` uma cópia de cada arquivo que entra no cache dele (mapa e tiles, token, retrato,
handout, som, compêndio, o que o Claude mandou, o que um jogador subiu). Ao abrir a mesa, ao escolher ou
reautorizar a pasta e quando chegam metas novas, o navegador traz da pasta o que a mesa usa e ele não tem
(conferindo o hash) e leva para a pasta o que só o cache tem. Assim um segundo navegador do mestre, com a mesma
pasta, carrega tudo sem o primeiro estar online. Sem protocolo novo, sem migração. O mestre vê o aviso da pasta
(reautorizar, escolher ou trocar) na mesa e na aba Compêndio. Ver `docs/ARQUIVOS.md`.

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
- o navegador do mestre guarda cópia de tudo que os jogadores sobem (backup completo da campanha); desde o
  AS1 em `assets/<pessoa>/<tipo>/` e com a imagem regravada (4.17);
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
  destaca. (V10c, 2026-11-13: numa cena-cartão a sala nem manda as paredes ao jogador.) A secreta nunca chega a ele. O **mestre** vê os contornos com a Visão do mestre ligada (4.7,
  "Visão do mestre") e sempre com a ferramenta Paredes ativa.
- **Cena como cartão** (V10c, 2026-11-13; `Cena.cartao`, opcional: sem o campo é mapa). O mestre a liga pelo menu da cena ("Transformar em cartão" / "Voltar a ser mapa") ou pela caixa do "Configurar cena" (`cena.editar { cartao }`). Serve para uma imagem de fundo ou o mapa de uma cidade: **todos veem a imagem inteira, sem névoa, escuridão nem limite de visão**, os tokens aparecem e se movem sem mexer na visão, e a câmera enquadra a imagem ao entrar (depois, zoom e arrasto como sempre). Paredes, portas e luz **ficam guardadas** e valem de novo ao voltar a mapa; enquanto isso a sala não manda as paredes ao jogador, não as usa para barrar o token dele nem lhe deixa abrir portas. O grid segue a configuração da cena. O token oculto, a parede secreta e as notas continuam do mestre. A faixa de Cenas mostra uma marca pequena no cartão da cena.
- **Névoa pintada à mão** (N4, 2026-11-14; `Cena.nevoa`, opcional). O mestre cobre e revela áreas do mapa por cena com a ferramenta **Névoa** (atalho N; Cobrir ou Revelar, pincel, retângulo e polígono, Cobrir tudo e Revelar tudo com confirmação, Desfazer com Ctrl+Z ou o botão). A cena guarda a lista de traços na ordem e o resultado é a composição em sequência (o último traço que contém o ponto decide; sem traço, revelado), limitada a 300 traços e 6.000 pontos, com compactação ao estourar. **Vale por cima da luz e da visão** (coberto é escuro mesmo iluminado; revelado segue a luz de sempre) **e na cena-cartão** (revelar aos poucos o mapa de uma cidade). O jogador vê a área coberta **escura e opaca**, por cima do mapa, dos desenhos e dos tokens, e **não vê os tokens com o centro sob a névoa**, menos os que ele controla; o mestre vê um véu translúcido e hachurado, e "Ver como" mostra como o jogador vê. Intenções `nevoa.tracar` e `nevoa.desfazer` (`cena.editar`, só do mestre); eventos `nevoa.tracada` e `nevoa.desfeita` (o jogador recebe os da cena ativa). **Não é segredo:** o que está sob a névoa chega ao navegador do jogador (o "mapa revelado aos poucos" foi descartado: os jogadores não vão fuçar o F12). Duplicar a cena, exportar e importar levam a névoa. Sem migração de banco.
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
- **Ficha de NPC com fitas, sem moldura e em duas colunas (V8, 2026-11-12).** O bloco de NPC tem duas fitas no alto, Bestiário e Conjuração (abas: setas, Home e End); a Conjuração deixou de ser seção do meio do bloco e é a página da segunda fita (sempre para quem edita; para os outros, só com magias). A página não tem borda nem degradê, e com o corpo da janela ≥ 760 px o Bestiário se divide: cabeçalho, números e linhas à esquerda, Traços, Ações, Reações e Lendárias à direita. Não há campo novo nem migração.
- **Ficha em janela própria do navegador (V9, 2026-11-12).** Um ícone no cabeçalho de toda ficha abre uma janela do navegador (`popup`, nome fixo por mesa e ficha) na rota `/m/<id>/ficha/<fichaId>`, que mostra só a ficha, com a própria conexão com a sala e a mesma sessão. A sala junta as conexões por usuário (a presença não duplica) e nada do protocolo muda. A janela principal e a da ficha se coordenam no navegador (Web Locks e `BroadcastChannel` por mesa, nunca pela sala): a ficha fora sai da pilha, a lista de Fichas a marca "em outra janela" e fechar a janela ou "Voltar para a mesa" a devolve. Tamanho e posição da janela ficam em `tabletop:pref:janela-ficha:<mesa>:<ficha>`. Arrastar entre janelas não funciona.
- **Conjuração do NPC e o nome com a capitular (V4b2, 2026-11-12).** O bloco de NPC ganhou a seção Conjuração entre Traços e Ações, sobre os mesmos dados da ficha de personagem (`magias`, `espacosTotal`, `espacosGastos`, `habilidadeDeConjuracao`): atributo, CD e ataque de magia (bônus de proficiência do ND), uma linha por círculo com bolinhas de espaço e as magias em chips que expandem e conjuram como no personagem. Não há campo novo nem migração. A magia solta do compêndio no NPC entra em `magias` (no círculo dela), não mais no traço "Conjuração". O nome na pele Livro, no personagem e no NPC, é um campo só: a capitular é só desenho (a primeira letra, maiúscula) e o campo mostra o nome inteiro enquanto se edita.
- **A Conjuração do NPC com os círculos do personagem (Q9, 2026-11-16).** Os círculos da seção Conjuração do NPC são o mesmo componente da aba Magias do personagem (`CirculoDeMagias`): espaços totais e restantes, uma linha por magia (nome, escola e o que rola, Conjurar, ícone de chat, engrenagem; o texto abre na linha, com "mandar ao chat" e tirar), "+ Círculo", "Recuperar espaços", reordenar e soltar do compêndio no círculo dela. O NPC não mostra o "Prep." e mantém o atributo, a CD e o ataque pelo ND e a conjuração inata. Sem campo novo, sem migração, sem protocolo.
- **Conjuração completa (N2, 2026-11-14).** Campos novos e opcionais: em `Magia`, `inata { frequencia: vontade | cada | grupo, max?, gastos? }`, `ritual`, `dadosPorNivel [{ nivel, expressao }]` e `quantidadeBase`; na ficha, `inata { habilidade?, cd?, grupo? { max, gastos } }`. **Inata** (monstro): a fita Conjuração e a página Magias têm a parte "Conjuração inata" com atributo e CD próprios e as magias por frequência (À vontade; N/dia cada, com bolinhas na magia; N/dia, um contador do grupo). Conjurar uma inata não gasta espaço, gasta um uso, sai no nível dela e o cartão diz "conjuração inata"; o descanso longo devolve os usos. **Truque por nível:** `dadosPorNivel` é o dado a mais do maior nível alcançado (Raio de Fogo: 5 → 1d10, 11 → 2d10, 17 → 3d10), somado ao dano (nível do personagem; no NPC, o ND). **Ritual:** magia com a marca ganha "Ritual · sem espaço" no menu e o cartão diz "como ritual". **Quantidade por nível:** "Por nível acima" também lê "1 dardo/raio/alvo/criatura"; acima do nível da magia o cartão mostra a quantidade e, com dano, a sala rola cada dardo ou raio à parte. `EspacoDoPedido`/`EspacoNoChat` ganharam `ritual`, `inata` e `quantidade`; o pedido de ataque ganhou `nivelDoTruque`. Sem migração; ficha e mensagem antigas carregam iguais. O MCP (`fichas`, `compendio`, `rolar`) entende os campos.
- **Compêndio com monstros e itens mágicos (N3a, 2026-11-14).** O arquivo do compêndio (`tabletop-compendio`, versão 1) ganhou as listas opcionais `monstros` e `itensMagicos`, e `magias` passou a opcional (o arquivo precisa de ao menos uma lista com entradas). **Monstro:** nome, nome original, tamanho, tipo, tendência, `ca { valor, fonte }`, `pv { media, formula }`, deslocamento, atributos, `salvaguardas` e `pericias` (bônus total do livro), defesas, sentidos, idiomas, `nd`, `xp`, `tracos`, `acoes`, `reacoes`, `acoesLendarias` e as conjurações `conjuracaoInata` e `conjuracaoPorEspacos`; cada ação leva, quando der, acerto, alcance, dano, tipo de dano, salvaguarda, recarga e usos. **Item mágico:** nome, tipo, `raridade` (comum a artefato, ou varia), `sintonizacao { necessaria, por }`, descrição, `bonus` (+1 a +3) e `arma`. A pasta `compendio/` pode ter `magias.json`, `monstros.json`, `itens.json` e `compendio.json`; a mesa junta os que existirem (nome repetido fica com o último, com aviso) e registra um asset `compendio` só (até 16 MB); a ação "Carregar arquivos do compêndio…" do mestre grava os arquivos escolhidos nessa pasta. A aba tem as seções Monstros (só do mestre; filtros de tipo, tamanho e ND de/até) e Itens mágicos (tipo e raridade). "Criar NPC" e arrastar o monstro para o mapa montam a ficha de NPC por `monstroParaFicha` e criam o token; o item mágico vai ao equipamento (a arma com bônus, também aos ataques). O MCP busca monstros e itens mágicos e `fichas` cria NPCs de um monstro pelo nome. Sem migração nem protocolo novo.
- **As rolagens no chat (Q5, 2026-11-16).** Cada rolagem (teste, ataque, dado de vida, `/r`) é um cartão, em dois estilos por preferência pessoal (`tabletop:pref:estiloDasRolagens`, em Preferências → Aparência, nunca enviada à sala): **Fita** (padrão) e **Moldura de grimório**. O número é o destaque; no ataque, acerto e dano lado a lado do mesmo tamanho; na magia de salvaguarda, CD e dano; o dano é o número e só o ícone do tipo (o nome no `aria-label`). Os dados, a fórmula e os blocos de espaço e dardos ficam num balão que só existe com o mouse parado ~350 ms (ou o foco; toque abre e fecha). Vantagem e desvantagem mostram os dois totais (calculados da própria rolagem). Crítico em verde fixo, 1 natural em cinza apagado, dano sem vermelho nem laranja. Rolagem oculta é uma linha pequena em itálico. Cartões seguidos do mesmo remetente dividem o cabeçalho. Só visual: sem mudança de protocolo, banco ou paridade do MCP.
- **O compêndio por seções, com blocos e busca em português e inglês (Q2, 2026-11-16).** A aba Compêndio tem as seções Magias, Monstros (só o mestre), Itens mágicos, Armas e Itens, mais "Todas" para a busca por nome em tudo. Cada seção é uma lista de blocos recolhíveis com a contagem no título: magias por nível (Truques, 1º ao 9º), monstros por ND (0, 1/8, 1/4, 1/2, 1 ... 30), itens mágicos por raridade, armas por categoria e alcance; alfabético dentro. Só os blocos abertos desenham as linhas. Começam fechados (abertos, se a seção tem 24 entradas ou menos); busca ou filtro abre os que têm resultado; o que a pessoa abriu fica em `tabletop:pref:compendio-blocos` (só neste navegador). Filtros: classe e escola (magias), tipo e tamanho (monstros), raridade e sintonização (itens mágicos). A busca vale no `nome` e no `nomeOriginal`, sem acento e sem caixa. O extrator lê a tabela local opcional `nomes-originais.json` e preenche o `nomeOriginal` (a tabela fica fora do repositório). Sem migração nem protocolo novo.
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

"Funções customizadas" que o mestre monta por campanha, **programadas por blocos** (AU1, 2026-11-19; o formato antigo de ciclos, fases
e reações foi substituído, e o que existia é convertido sozinho: ver "Como era, e como converte") e, desde o **AU2 (2026-11-20), desenhadas como um
grafo** (nós soltos numa grade, ligados por fios, com portas lógicas: ver "O grafo (AU2)"). Uma **automação** (no código, um `Fluxo`) tem:

- **Gatilhos, o "Quando"** (nós do grafo; vários gatilhos ligados ao mesmo bloco formam um **OU**: qualquer um dispara; no máximo um de relógio e um de botão por automação): `relogio` (a cada tantos segundos), `botao` (um botão do mestre, em todas as cenas ou numa, com cor e ícone para a mesa de eventos), `sinal` (ao
  receber um sinal de outra automação), `tocha` (uma luz acende ou apaga, com filtro de modelo e de etiqueta), `zona` (um token entra
  ou sai de uma zona), `turno` (começa o turno de alguém) e `cena` (o grupo vai para uma cena).
- **Cenas onde vale** (vazio = todas), `ligado`, `fixado` (o chip na barra de cima) e `liberadoParaJogadores` (o botão do gatilho de botão
  e os controles do de relógio, para os jogadores).
- **O desenho: nós e fios** (AU2). Cada nó tem `id`, `tipo`, `x`, `y`, um `nome` opcional e a `config` do tipo; cada fio liga uma saída de um nó a uma entrada de outro.
  Em vez da árvore arrumada sozinha do AU1 (um gatilho e trilhas de blocos), o mestre arrasta os nós para qualquer lugar da grade e liga as portas: caminhos em paralelo (uma saída com vários fios), caminhos que se encontram e condições combinadas por portas lógicas. A forma do AU1 ainda entra (mesa salva, arquivo, intenção) e é convertida em grafo na leitura.

Os nós (AU2; os do AU1 viraram nós, com as mesmas regras): **gatilho**; **esperar** `{ s }` (segura o caminho; no tempo da sala, então pausar a mesa pausa a espera); **se** (entrada de ordem e a entrada de **condição**; saídas **sim** e **não**); **sortear** `{ chance }` (saídas sim e não, a cada vez, no RNG da sala); **para cada**
`{ alvo }` (saídas **corpo**, que roda para cada alvo, e **depois**, que roda uma vez ao fim; alvo: objetos de luz, com modelo, etiqueta, só os acesos e dentro de uma zona; ou tokens, dentro de uma zona, numa cena ou
por id); **ação** (a lista fechada abaixo, com o prazo "por N s" explícito na própria ação); **sinal** `{ nome, atrasoS? }` (mandar um sinal); **condição** (`etiqueta`, `dentroDaZona`, `cena`, `zonaLigada`, e do AU2 `chance` e `tokenDeJogador`; saída de verdadeiro ou falso) e **porta lógica** (`e`, `ou`, `nao`; combina condições e alimenta a entrada de condição do "se"). A condição `chance` sorteia a cada vez que o "se" confere; `tokenDeJogador` vale quando o token da vez tem jogador controlando (senão é do mestre).

Exemplo, a respiração da montanha (a mesma da campanha de referência), na forma do AU1 (um gatilho e trilhas), que a mesa converte em grafo (um nó por bloco, o gatilho com dois fios de saída, um por trilha):

```json
{ "id": "respiracao", "nome": "Respiração da Montanha", "cenas": ["pulmao"],
  "gatilho": { "tipo": "relogio", "cadaS": 180 },
  "trilhas": [
    [{ "bloco": "paraCada", "alvo": { "tipo": "objetos", "modelo": "tocha", "acesos": true }, "corpo": [
       { "bloco": "acao", "acao": { "acao": "luz.modificar", "raioX": 0.5, "porS": 20 } },
       { "bloco": "acao", "acao": { "acao": "objeto.apagar", "chance": 0.3, "penalidadeS": 300 } } ] }],
    [{ "bloco": "esperar", "s": 90 },
     { "bloco": "paraCada", "alvo": { "tipo": "tokens" }, "corpo": [
       { "bloco": "acao", "acao": { "acao": "visao.limitar", "alcanceM": 1.5, "porS": 30 } } ] }] ] }
```

Em português, gerada dos blocos: "A cada 3 min, na cena Pulmão: cada tocha acesa fica com metade da luz por 20 s e tem 30% de chance de
apagar (perde 5 min). 90 s depois, a visão de cada token na cena Pulmão cai para 1,5 m por 30 s."

Regras do motor:
1. **Ações de uma lista fechada, descritas em JSON e validadas com zod**, nunca código livre: `luz.modificar`, `objeto.apagar` (chance,
   penalidade), `objeto.ajustarTempo`, `visao.limitar`, `chat.anunciar`, `som.tocar` (N5), `token.mostrar`/`token.ocultar` e `zona.ativar`. Mandar um
   sinal é um bloco, não uma ação. Seguro, testável com semente fixa e fácil de a IA gerar.
2. **Efeito temporário é modificador com prazo**, nunca alteração do valor base. O valor final é base + modificadores ativos; efeitos
   sobrepostos, refresh e reconexão não deixam nada preso.
3. Tudo roda **na sala**, pelo agendador único (seção 4.8), com sorteios no RNG da sala. Pausar a mesa pausa os relógios e as esperas.
4. **Escopo por cena:** a automação só atinge o que está nas cenas dela, cruzadas com as do evento que a disparou. AU4 (2026-11-21): `naCenaAtiva` soma a cena onde o grupo está no instante do disparo às `cenas` do fluxo.
5. **Limite de encadeamento:** sinal que dispara automação que manda sinal para numa profundidade máxima (5), e há teto de ações por
   disparo, de nós e fios por automação, de nós percorridos por disparo (2000) e de esperas ao mesmo tempo. O corte vai ao registro do motor. **Ciclos** (AU2): um fio pode voltar a um bloco anterior só se o caminho passar por um "esperar" de pelo menos 1 s; a conferência recusa o resto.
6. **Zonas:** polígonos do mapa com efeitos enquanto um token ou objeto está dentro (gás que enfraquece chamas, ar rarefeito). Entregues
   no 7b-2 (ver "Zonas (7b-2)" abaixo); as automações cuidam do que acontece quando algo entra, sai ou o tempo passa.
7. Automações são dados do mestre: nunca chegam ao navegador do jogador, só os efeitos delas.
8. **Quem sofre a ação** (decisão do AU1): o alvo padrão de uma ação é o objeto ou o token **da vez**: o do gatilho (tocha acende: a tocha; token
   entra na zona: o token) ou o que o bloco "para cada" está percorrendo. Ação de luz mexe no objeto da vez; ação de token, no token da vez e, sem
   token, em quem carrega o objeto da vez. Sem alvo, a ação não faz nada e o motor anota no registro; o editor avisa antes, no bloco.

**Desenho do motor de fluxos (AU1, 2026-11-19).**
- **Onde ficam.** `Estado.automacoes` = `{ fluxos, execucao, esperando, ultimaVez, registro, legado? }` (`packages/shared/src/automacoes.ts`, com
  `fluxos.ts`, `fluxosValidar.ts`, `fluxosFrase.ts`, `fluxosConversao.ts` e o motor em `automacoesnucleo.ts`), **só do mestre**: `visaoPara` a tira do jogador e
  `eventoPara` derruba o evento `automacoes.alterado`. Guardada no SQLite na chave `automacoes` da tabela `meta`, **sem migração SQL**: a conversão é feita
  na leitura (ver abaixo). Entra na exportação como campo opcional (a versão do arquivo continua 13).
- **Execução.** `execucao[fluxoId]` é o relógio de um fluxo de relógio, no tempo da sala (`baseSala`, `pausadoEmTau`, `proximoTau`): dispara ao começar
  (ou depois de `primeiroS`) e a cada `cadaS`; desligar congela, ligar continua de onde parou. `esperando` guarda cada **execução parada num "esperar"** (ou num sinal
  com atraso): o fluxo, o **nó** que esperou (`no`; no AU1 era o caminho na árvore, e as esperas guardadas assim caem ao carregar), o contexto (cenas, objeto, token e zona da vez) e o instante (tempo da sala). Vai no estado
  e no SQLite, então **sobrevive à hibernação**. Um "esperar" dentro de um "para cada" segura só aquele alvo.
- **Gatilhos do sistema** saem, como antes, da **diferença entre o estado de antes e o de depois** de qualquer intenção, do tempo e das próprias ações
  (`eventosDoSistema`): luz acendeu ou apagou, cena do grupo, turno, token entrou ou saiu de zona. Os sinais mandados correm depois que os fluxos do evento terminam,
  um nível abaixo (limite 5).
- **Modificadores** como antes: na luz, em `ObjetoDeLuz.modificadores` (`id` `auto:<fluxo>:<caminho do bloco>`, o mesmo efeito de novo **renova** o prazo); no token, em `Estado.efeitos`
  (limite de visão, vale o menor). O jogador recebe só o resultado.
- **Limites:** 60 automações, 8 trilhas e 80 blocos por automação, 6 níveis de árvore, sinais encadeados até 5, 500 ações por disparo, 200 esperas, 50 disparos
  atrasados recuperados de uma vez. Sorteio no RNG da sala (`crypto`; semente fixa nos testes).
- **A frase em português** é uma função pura em `shared` (`fraseDoFluxo`, com os nomes de cena, modelo e zona, nunca ids), usada pela lista, pelo editor e pelo MCP.
  **A conferência** também (`problemasDoFluxo`): erros em português, presos ao bloco (o editor desenha o contorno), recusa na sala e no MCP.
- **Intenções** (todas `automacao.editar`, só do mestre): `fluxo.criar|editar|apagar|ligar|disparar` (assumido; as de ciclo e de reação deram lugar a elas). `botao.usar`
  continua (os chips da barra: `ciclo:<id>` é o fluxo de relógio, `evento:<id>` o de botão). Ver `docs/protocolo.md`, "Automações e fluxos".
- **Chat.** `chat.anunciar` cria uma mensagem `tipo: "aviso"` sem autor real (`autorId: "sistema"`), mostrada como "A mesa".

**O grafo (AU2, 2026-11-20).**
- **O dado.** `Fluxo = { id, nome, ligado, cenas, naCenaAtiva? (AU4), fixado?, liberadoParaJogadores?, rascunho?, nos[], fios[] }`. Um nó é `{ id, tipo, x, y, nome?, config }` com `tipo` em `gatilho`, `esperar`, `sortear`, `paraCada`, `se`, `acao`, `sinal`, `condicao` e `caixa` (AU3: a porta lógica; antes era `porta`) e, quando está dentro de uma caixa, `em` (o id dela) e `espaco`; um fio é `{ de: { no, saida }, para: { no, entrada } }`. As portas de cada nó vêm de `portasDoNo`: **fio de ordem** (o que roda depois do quê: `saida`, `sim`, `nao`, `corpo`, `depois` → `entrada`) e **fio de condição** (verdadeiro ou falso: `valor` → `condicao` do "se"; a caixa sai por `saida`, de ordem se guarda gatilhos e de condição se guarda condições; AU3). Os dois só encaixam no tipo certo (o schema confere, com mensagem em português); a condição do "se" e a entrada do NÃO aceitam um fio só. Limites (assumido): 120 nós e 300 fios por automação. Está em `packages/shared/src/fluxos.ts` (esquemas e portas), `fluxosGrafo.ts` (achar gatilhos, ligar, `organizarGrafo`, `arvoreParaGrafo`, `semOsNos`), `fluxosValidar.ts` (conferência), `fluxosFrase.ts` (frase) e o motor em `automacoesnucleo.ts`.
- **O motor segue os fios, na sala.** Um gatilho dispara e a execução percorre os fios na ordem em que estão. Uma saída com vários fios roda os caminhos **em paralelo** (um depois do outro, no mesmo instante); um bloco com vários fios chegando roda a **cada chegada** (como no n8n; assumido). O "se" confere a condição ligada (portas lógicas e condições são avaliadas sob demanda; cada condição vale uma vez por conferência, e a `chance` sorteia no RNG da sala); dentro do "sim" de um "se" ligado direto a uma condição de cena, só essas cenas valem. O "esperar" guarda o nó em `esperando` e, ao acabar a espera, segue pelos fios dele. **Vários gatilhos juntos são um OU**: no AU3, os gatilhos nos espaços de uma caixa OU (a caixa é a porta; o motor segue os fios dela); "Disparar agora" começa pelo gatilho de botão, senão pelo de relógio, senão pelo primeiro.
- **A conferência** (`problemasDoFluxo`, em português, presa ao nó: `nos.<id>`): sem gatilho; só um gatilho de relógio e um de botão; gatilho sem fio de saída; bloco que nenhum gatilho alcança; "se" sem condição; caixa vazia, espaço sem peça, peças que não combinam na caixa (gatilho E gatilho, NÃO com gatilho ou ação, ação com gatilho ou condição) e caixa sem saída ligada (AU3); condição ou porta que não alimenta nada; ciclo sem "esperar" de 1 s ou mais (e ciclo de portas); referência a cena, zona, modelo ou som que sumiu; ação de luz ou de token sem o "para cada" que a alimenta. Nada salva com erro.
- **Conversão.** Os fluxos de árvore do AU1 viram grafo (`arvoreParaGrafo`): cada bloco vira um nó; os ramos "sim" e "não" de um "se" ou "sortear" ligam o fim deles no bloco seguinte; o "depois" do "para cada" liga no seguinte; as trilhas em paralelo saem do gatilho em fios separados, na mesma ordem (então o RNG é sorteado na mesma ordem, e o **ouro** continua batendo); as condições do "se" viram nós de condição ligados à entrada dele. As posições vêm de `organizarGrafo` (colunas da esquerda para a direita). `AutomacoesSchema` faz isso ao ler (disco, arquivo, intenção `fluxo.criar`); o formato antigo de ciclos e reações continua convertendo (primeiro em árvore, depois em grafo). As execuções esperando que apontavam para o caminho da árvore deixam de valer (o relógio dos fluxos já recomeçava na conversão do AU1).
- **As caixas (AU3, 2026-11-20).** As portas lógicas viraram **caixas** soltas na grade, como os blocos "e", "ou" e "não" do Scratch, só que na vertical. A caixa **E** ou **OU** nasce com **dois espaços**, um em cima do outro, com o rótulo "E" ou "OU" entre cada par de espaços (clicar em qualquer um troca a caixa inteira); a **NÃO** tem **um espaço só**. Cada espaço guarda **uma peça só**: um gatilho (o "quando"), uma condição, uma ação ou **outra caixa** (até **4 níveis**, assumido). A caixa cresce: o botão **+** no pé acrescenta um espaço vazio e soltar uma peça **entre dois espaços** (ou logo abaixo do último) abre um espaço novo ali, marcado durante o arrasto (até 12 espaços, assumido); tirar a peça de um espaço, numa caixa com mais de 2, remove o espaço, e um espaço vazio a mais tem um **×** (o mínimo é 2). Espaço vazio mostra "solte aqui um gatilho, uma condição, uma ação ou outra caixa" e acende quando algo é arrastado por cima. No dado, a caixa é `{ tipo: "caixa", config: { porta, espacos? } }` e a peça guardada tem `em` (o id da caixa) e `espaco` (0 é o de cima); a peça guardada não tem fios. **A saída vem do que está dentro** (`conteudoDaCaixa`): gatilho OU gatilho (qualquer um dispara: o "quando dentro da porta") e gatilho E condição (quando o gatilho acontece, segue se as condições valem) dão uma saída de **ordem** que liga ao próximo bloco; condição com condição (E ou OU) e NÃO condição dão uma saída de **valor**, que liga na entrada de condição do "se" ou fica dentro de outra caixa; ação E ação faz as duas, em paralelo (de cima para baixo), e **ação OU ação sorteia uma, por igual (50/50 com duas; assumido)**: essa caixa fica no fluxo com **entrada e saída de ordem**, como um bloco de ação. Com mais de dois espaços, E exige todos, OU qualquer um. **Recusado ao soltar**, com a dica do porquê (`motivoDaRecusa`, em `fluxosCaixas.ts`): gatilho E gatilho ("Dois acontecimentos não chegam no mesmo instante: para gatilhos, use OU."), gatilho OU condição, NÃO com gatilho ou ação, ação misturada com gatilho ou condição, espaço já ocupado, outro bloco de fluxo (esperar, "se", sortear...) dentro de caixa, caixa dentro dela mesma; as caixas de dentro seguem as mesmas regras pelo que cada uma produz. Erros no próprio bloco: caixa vazia, espaço sem peça, NÃO vazio, caixa sem saída ligada. Soltar um gatilho em cima de outro gatilho solto cria uma caixa OU com os dois (assumido). **Conversão** (`portasParaCaixas`, no `preprocess` do `FluxoSchema`; a marca `caixas: true` do fluxo impede reagrupar): cada porta E/OU/NÃO com fios vira uma caixa com as peças nos espaços (A ou B ou C vira uma caixa OU com 3 espaços, sem aninhar à força; a peça que servia a mais de um lugar é copiada), e os gatilhos que chamam exatamente os mesmos blocos viram uma caixa OU; o motor chega ao mesmo resultado (o ouro bate). As portas de fio saíram da paleta. A frase "Em português:" diz "Quando qualquer um destes acontecer (a cada 3 min, ou ao apertar o botão “Combate”)", "…, mas só se a condição valer", "se (NÃO a) e b" / "a ou b" (a caixa dentro de caixa entre parênteses) e "sorteia uma destas: (a) ou (b)".
- **O tour do centro de automações (AU3).** Aparece na primeira vez que alguém abre o centro (marca `tabletop:pref:tourDasAutomacoes` no navegador; só com conta, e no teste só com a chave `tabletop:pref:tourDasAutomacoesNoTeste`) e pelo botão **Conhecer as automações** (no centro e no editor). Pode ser pulado a qualquer passo (Pular ou Esc). No centro explica a lista e a mesa de eventos e o último passo abre o editor (janela própria, `?tour=1`) já com o tour: um passo por grupo de peças (Quando, Fluxo, Condições, Caixas lógicas, Faça e sinais), com o exemplo de mesa e a paleta iluminada (o das caixas é curto, sem pormenor de lógica: "Juntam peças com E, OU ou NÃO. Por exemplo: a cada 3 min OU ao apertar um botão.", AU3c); "Liberar aos jogadores"; e depois monta com a pessoa "as tochas têm 30% de chance de apagar a cada 3 minutos" (relógio de 3 min → para cada tocha acesa → sortear 30% → sim → apagar a tocha), cada passo com a seta, o destaque e o botão "Fazer este passo por mim", e a frase "Em português" se completando. No fim a automação fica salva **desligada**, com **Ligar agora**, **Apagar o exemplo** e **Concluir**; mostra onde ligar e onde testar. Só monta o exemplo numa automação nova e vazia (assumido): numa com trabalho, só explica as peças.
- **O nome do sinal** (corrigido no AU2) é o que a pessoa escreveu, com acento e espaço; antes só letras, números, ponto, hífen e sublinhado.
- **Mesa de eventos.** Só botões grandes, um para cada automação cujo gatilho é um botão (nome, cor e ícone escolhidos no gatilho, com padrão âmbar e chama; e se está ligada). Clicar manda `botao.usar` (o mesmo do chip da barra: o mestre dispara qualquer um, o jogador só os liberados, com o limite de frequência de sempre) e dá um retorno rápido (brilho e "Disparou"). Aparece como janela flutuante, faixa no pé da tela ou janela própria do navegador (`/m/<id>/eventos`), como a mesa de som (preferência `tabletop:pref:eventos-modo`, só neste navegador). O jogador abre a dele pelo botão da barra e vê só os botões liberados (o que a sala já lhe mandava em `botoes`, agora com rótulo, cor e ícone; nada da definição). Abre-se pelo botão "Abrir mesa de eventos" da lista de automações.
**Como era, e como converte.** Antes do AU1 a mesa tinha **ciclos** (período e fases que disparam eventos com nome), **reações** ("ao receber o evento X, se Y, faça Z", presas a um
modelo, cena, zona ou à mesa) e **botões de evento**. Ao carregar a mesa e ao importar um arquivo antigo, `converterParaFluxos` os transforma em fluxos, sem perder nada: um **ciclo**
vira um fluxo de relógio com **uma trilha por fase** ("esperar" o instante da fase, e o que a fase faz); o "dura" da fase vira o prazo ("por N s") das ações que não tinham prazo; o
**botão de evento** vira um fluxo de botão que manda o sinal; a **reação** vira blocos explícitos (o modelo vira "para cada objeto do modelo"; a zona, o filtro do gatilho e "só quem está
dentro"; a cena, as cenas do fluxo) e fica **dentro da trilha da fase** quando o nome do evento só liga aquele ciclo a ela (sem botão nem outro emissor); com mais de um uso do nome, fica
como "mandar sinal" e "ao receber sinal". As reações que escutam eventos do sistema viram o gatilho correspondente. O formato antigo fica guardado em `Automacoes.legado`, **só para
leitura** (não roda). O arquivo de campanha aceita a forma antiga (convertida) e a nova; a exportação sai na nova. Numa mesa em andamento, o relógio dos fluxos recomeça (o que faltava do
período em curso e os eventos pendentes não são recuperados). A campanha de referência (`chama-primordial.json`) rodou 10 minutos simulados no motor antigo e o resultado ficou guardado
(`fixtures/ouro/`): o motor novo, com a conversão, tem de chegar ao mesmo (teste `ouro.test.ts`).

**Zonas (7b-2, 2026-11-13).** Polígonos de uma cena, só do mestre, com efeitos "enquanto dentro" e reações.
- **O dado.** `Estado.zonas` (opcional) = `[{ id, cenaId, nome, pontos[3..64], ativa, efeitos: { luzRaioX?, luzSomaM?, visaoMaxM? } }]`
  (`packages/shared/src/zonas.ts`). Guardada na coleção `zonas` da tabela `entidades` (sem migração SQL), na exportação (campo opcional, versão 13) e
  copiada por "Duplicar a cena" (com as automações cujo gatilho é a zona). Quem escolhe a zona num bloco usa o id; ao apagar a zona, vão embora as automações cujo gatilho é entrar ou sair dela.
- **Dentro** (assumido). O centro do token dentro do polígono, na cena da zona; a borda e os vértices contam. Para a luz: a posição de quem a carrega
  (o token, ou o dono da tocha na mão) ou a do ponto onde está; na mochila não está em zona. Zona desligada não tem ninguém dentro.
- **Efeito enquanto dentro.** Sem prazo, e **reconciliado**: depois de toda intenção que mudou algo, a sala compara o que deve valer (zonas ligadas × posições) com o
  que está no estado e acerta a diferença. A luz leva o modificador `zona:<zona>` (`raioX` e `raioSomaM`); o token leva o efeito `zona:<zona>:<token>` em
  `Estado.efeitos` (`visaoMaxM`, sem `ateSala`). Sair, desligar, apagar, mudar o desenho, trocar de cena e apagar a cena tiram o efeito: nada fica preso. A
  cena-cartão não leva o limite de visão.
- **Eventos.** `token.entrouNaZona` e `token.saiuDaZona` (com `zonaId` e `tokenId` no evento) saem da diferença entre os estados, como os outros do sistema:
  soltar, setas, "Levar grupo", colocar, apagar e restaurar token, trocar de cena. Uma vez por mudança. Ligar, desligar, criar e apagar a zona não contam.
- **Ação e condição.** `zona.ativar` (`zona`, `ativa`) liga e desliga uma zona; `dentroDaZona` e `zonaLigada` (`zona`) são condições do bloco "se"; o "para cada" aceita `naZona`. O gatilho "token entra ou sai" aceita uma zona só (ou qualquer).
- **Intenções** (`automacao.editar`): `zona.criar`, `zona.editar`, `zona.apagar`; eventos `zona.alterada` e `zona.apagada` (só o mestre). Ver `docs/protocolo.md`, "Zonas (Lote 7b-2)".
- **Sigilo.** A forma, o nome, os efeitos e as automações nunca chegam ao jogador (`visaoPara` tira `zonas`; `eventoPara` derruba os dois eventos). Ele vê só a luz menor e a visão limitada.
- **A ferramenta.** "Zonas" na barra do mestre (ícone de quadrado tracejado, tecla **Z**): clique a clique, meia célula do grid (Alt solta), duplo clique ou Enter fecha, Esc
  cancela, Backspace tira o último ponto. Painel com nome, ligada, os três efeitos e a lista das automações que usam a zona, com "+ automação para esta zona" (que já cria o gatilho de entrar); as bolinhas movem os vértices; Delete apaga, com Desfazer no aviso.
  A zona aparece só para o mestre (polígono violeta translúcido, contorno tracejado, nome no meio; a desligada esmaecida).

**O editor em grade e a lista (AU1, 2026-11-19; o editor foi refeito no AU2, 2026-11-20).** O botão "Automações" da barra de cima (desde o Q8; ou aba Mesa → "Abrir as automações"), só do mestre, abre a **lista**; "+ Nova automação" e "Editar" abrem o **editor numa janela própria do navegador, na hora** (`/m/<id>/automacao/<fluxoId>`, o padrão da ficha e da mesa de som: própria conexão, aviso e lock para a mesa, medida lembrada; se a janela dessa automação já está aberta, só vem para a frente, sem recarregar). **A janela principal nunca mostra o editor.** Pop-up bloqueado: aviso com o texto de sempre e o link "Abrir o editor".
- **A lista.** Filtros Todas, Ligadas, Desligadas e Desta cena, e busca. Cada automação: a chave de ligar e desligar, o nome, o gatilho em destaque, a **frase em português** gerada do grafo, a situação ("próxima em 1:12", "rodou há 4 min", "nunca rodou"), "Disparar agora" e "Editar". O menu de cada uma: Duplicar (nasce desligada), Fixar na barra, Liberar aos jogadores (nos gatilhos de relógio e de botão) e Apagar (o aviso embaixo tem Desfazer). No cabeçalho, "Abrir mesa de eventos" e "+ Nova automação". No rodapé, os avisos do motor.
- **O editor (AU2).** Barra de cima: fechar, nome, Ligada, **Organizar** (arruma o grafo em colunas), **JSON** (num menu, com os mesmos erros em português), **Testar agora (dispara de verdade)** (salva e roda uma vez), Desfazer e Salvar (salva e fecha a janela). À esquerda as peças em cinco cores (**Quando**, **Fluxo**, **Condições**, **Lógica**, **Faça**); no meio a **grade livre**; à direita os campos do que está escolhido (nó, fio, vários nós ou a automação: cenas onde vale, fixar e liberar); embaixo "Em português:" com a frase do grafo inteiro.
  - **Grade:** arrastar o fundo move a vista; a roda (ou a pinça) dá zoom (25% a 200%), os botões de zoom e "Enquadrar tudo" ficam no canto; a primeira vista já enquadra tudo (nenhum nó nasce cortado). **Peças:** arraste da paleta para a grade (o nó nasce onde soltou), clique (entra no meio da tela) ou dê duplo clique na grade para abrir a busca de peças ali (setas, Enter). **Nós:** arraste livremente; Shift ou Ctrl com o clique soma à escolha; Shift ou Ctrl com arrasto no fundo faz a **caixa de seleção**; arrastar um nó escolhido move todos juntos. **Fios:** arraste de uma bolinha de saída até uma entrada (soltar no corpo do nó usa a primeira entrada que serve; fio de ordem é uma linha cheia, o de condição é azul e tracejado, e as portas de condição são losangos); clicar num fio o escolhe; Delete apaga o fio ou os nós escolhidos. **Copiar e colar** nós (Ctrl+C, Ctrl+V, Ctrl+D; assumido: os fios entre os nós copiados vão junto). **Desfazer** (Ctrl+Z) volta cada gesto.
  - **Erros no nó:** contorno e um sinal de alerta no nó; a mensagem aparece embaixo dele depois de tentar salvar, ou no nó escolhido; nada salva com erro.
  - **Teclado:** Tab anda pelos nós (cada um é focável), as setas movem o nó escolhido (Shift, em passos maiores), Enter vai para os campos, Delete apaga, Esc tira a escolha; e o botão **"Ligar a…"** acima do nó escolhido abre um menu com as saídas e os destinos que servem, para ligar sem mouse.
- **Janela própria.** Lá se escolhe o som entre os que já estão na mesa; adicionar um som novo é na janela da mesa (mesa de som), como no AU1 (assumido).- **Ligações.** O painel da zona mostra as automações que usam a zona e "+ automação para esta zona" (cria o gatilho "entra na zona"). O editor de modelo de objeto (aba Mesa → Luz) mostra as automações que mexem nele.
- **Fixar e liberar.** Os chips na barra de cima: o do mestre (relógio: nome, "próxima em …", disparar e pausar ou retomar; botão: nome e disparar) e o do jogador (só o rótulo, e só dos liberados). A conferência da liberação é feita a cada clique, na sala.
- **Campanhas prontas.** `fixtures/campanhas/chama-primordial.json` (a tabela de `docs/IDEIAS.md`: Tocha de 1800 s com penalidade de 60 s ao apagar, a respiração do Pulmão de 180 s, a rajada que encolhe e pode apagar, a expiração com visão de 1,5 m, as zonas "Ar Morto" e "Câmara do Ar Rarefeito" e o farol) e `5e-padrao.json`. Estão em forma antiga e entram convertidas.

- **Som ambiente e `som.tocar`** (N5, 2026-11-14). Os arquivos de áudio (mp3, ogg e wav, até 20 MB) ficam no computador do mestre, como as imagens, e viajam por pedaços como assets do tipo `som`; a sala guarda só a referência (hash, nome, volume). **(Q4, 2026-11-16: a trilha única, a trilha da cena e o painel do N5 foram trocados pela mesa de som, logo abaixo.)** Os ambientes ligados levam o início no relógio real da sala (`Estado.somLigado`), então todos ouvem alinhados e quem entra no meio ouve do ponto em que está. A zona ganha **"Som enquanto dentro"** (`efeitos.som`: som, volume e laço): o jogador cujo token está dentro ouve, com fade; a sala manda a cada jogador só a mensagem `som.zona` com hash, volume e laço, e a zona continua secreta (forma, nome e regras nunca chegam). A ação **`som.tocar`** (`hash`, `nome`, `volume`, `para`: todos, quem vê a cena ou quem controla o token do evento) entra na lista fechada, com o formulário no editor do 7b-3. Tocar é do mestre (capacidade `som.controlar`, não delegável). Cada pessoa tem em Preferências o cartão **Som** (volume geral, da trilha e dos efeitos, silenciar tudo; só neste navegador) e, no primeiro som que o navegador bloqueia, o aviso "Clique para ativar o som da mesa". Exportar e importar levam as referências (metas), nunca os arquivos; sem migração de banco. Detalhes em `docs/protocolo.md` ("Som ambiente (N5)"). **(Q4b, 2026-11-16: os ambientes passam a ser MARCADOS e só tocam com o transporte tocando: `Estado.somLigado.tocando` e a intenção `som.transporte`; a mesa de som abre numa janela própria do navegador (`/m/<id>/som`), a faixa no pé tem altura ajustável e a configuração abre por cima de tudo. A busca do compêndio é por palavra, sem acento, com começo de palavra e erro de digitação (Q2b).)**
- **Importar mapas do Dungeondraft** (Q3, 2026-11-16). O painel de cenas tem o card "Importar mapa (Dungeondraft / Universal VTT)…" (só o mestre; também se arrasta o arquivo para a mesa). Um `.dd2vtt`, `.uvtt` ou `.df2vtt` (JSON com a imagem em base64, paredes, portas e luzes em quadrados) vira **uma cena nova** com o nome do arquivo: a imagem entra como mapa pelo mesmo caminho do botão de subir (tiles, cifra, cópia na pasta da mesa), a grade bate (`pixels_per_grid` = px por quadrado; quadrado de 1,5 m), as paredes (`line_of_sight` e `objects_line_of_sight`) e as portas (fechadas como no arquivo) viram paredes e portas da Távola, e as luzes viram fontes fixas (alcance em metros = quadrados x 1,5; cor e intensidade do arquivo). Luz "cozida" (`baked_lighting`) é dia. Limites: 3000 paredes e portas, 200 luzes, arquivo de até 64 MB; o que passa não entra e o aviso diz. Um resumo no fim ("Cena criada: 1 mapa, 142 paredes, 6 portas, 9 luzes."). A leitura roda num worker. A intenção `cena.importarMapa` cria a cena inteira num pedido só (um passo do Desfazer; `cena.editar`); o Claude importa pelo `arquivos.enviar` (uso `dungeondraft`), na caixa da M1, e o `desfazer` apaga a cena. Sem migração de banco.
- **Mesa de som** (Q4, 2026-11-16). No lugar do painel do N5, o mestre tem uma **mesa de som** com 8 efeitos (um toque toca uma vez, até o fim, para todos; tocar de novo recomeça; há "parar") e 8 ambientes (cada um liga e desliga sozinho, vários ao mesmo tempo, em laço, com volume próprio e entrada e saída suaves de 1,5 s), mais o **volume geral** e "Parar tudo". Cada lugar tem arquivo, nome de até 12 letras, um de 12 ícones, uma de 6 cores de etiqueta e o volume padrão (`Estado.mesaDeSom`, só do mestre; o jogador nunca vê nome, ícone nem cor). Aparece como janela flutuante ou como faixa no pé da tela (escolha por pessoa, no navegador); a configuração abre pela engrenagem ou pelo "+ adicionar" de um lugar vazio. "Apagar este som da mesa" (`som.apagar`) tira o asset da mesa e dos lugares, zonas e automações que o usam; o arquivo fica na pasta `sons/` do computador. A cena guarda os **ambientes** que ligam ao levar o grupo (`Cena.ambientes`). O som do N5 (trilha e trilha da cena) é convertido ao ler. Só o mestre controla (`som.controlar`); a ferramenta `som` do MCP faz tudo isso. Detalhes em `docs/protocolo.md` ("Mesa de som (Q4)").

### 4.12 MCP (configurar a mesa com IA)

Servidor MCP (por HTTP, na própria sala; e local em stdio em `apps/mcp`, para o Claude Desktop), usado pelo Claude (Code ou Desktop) para construir o mundo:
criar cenas, notas do mestre, modelos de objeto, pontos, zonas, automações por blocos e NPCs.

**Revisto pelo Vilella (2026-11-13): o MCP é de todos, não só do mestre.**
- **Usos:**
  - o mestre monta o mundo;
  - **o jogador automatiza a criação do personagem**;
  - todos editam fichas, notas (handouts) e objetos.
- **Cada um só alcança o que está liberado para ele.**
  - Cada usuário gera **o próprio token de acesso** em Preferências ("Conectar o Claude"). O token aparece uma
    vez, a sala guarda só o hash e o usuário pode revogá-lo.
  - O MCP entra na sala **como esse usuário**, com as mesmas capacidades, a mesma visão filtrada e as mesmas
    recusas.
  - A conexão do Claude ainda tem uma lista de coisas proibidas: mudar papéis, permissões e contas, importar
    campanha e trocar a chave da pasta.
- **O jogador cria as próprias fichas e handouts.** É a capacidade nova "Criar fichas e notas próprias", ligada
  por padrão.
  - Vale pela mesa e pelo Claude, sem limite prático, com um teto de 20 fichas e 20 handouts por jogador para não
    ser infinito.
  - O que ele cria é dele: ele edita, ele escolhe quem vê, e o mestre sempre vê e pode apagar.
- **O que o Claude cria para o mestre entra como rascunho**, invisível para os jogadores até o mestre publicar.
  Há um **"Desfazer tudo o que o Claude fez"**, para o mestre e para o jogador.
- **O Claude pode rolar dados.** Quem rola é a sala, e a rolagem aparece no chat com a marca "pelo Claude".
- **O Claude faz tudo na preparação e na configuração (M2, 2026-11-14).** "O mestre não deve ter trabalho algum além
  de prompts." Toda intenção do protocolo tem uma entrada na **tabela de paridade**
  (`packages/shared/src/mcp/paridade.ts`): a ferramenta MCP e o campo que a alcançam, ou o motivo de ficar de fora,
  numa categoria fechada (`proibida`: segurança; `transporte`: coisa da conexão; `gesto ao vivo`: gesto da tela).
  Um teste de unidade falha se surgir intenção sem entrada ou entrada apontando para algo que não existe: **intenção
  nova precisa de entrada na tabela**. **Campo a campo (Q16, 2026-11-18):** a tabela `mcp/paridadeCampos.ts`
  declara, para cada campo (e objeto de dentro) de cada intenção com ferramenta, o caminho dele na entrada da
  ferramenta ou o motivo de ficar de fora (id que vira nome, valor que a sala preenche, campo antigo); um teste
  compara a tabela com o `shape` do zod: **campo novo numa intenção precisa de caminho no MCP**. A ficha tem a saída
  geral `fichas[].campos` (caminho e valor, como a tela grava). O Q16 fechou: `rolar.conjurar` (gasta espaço, pacto ou
  uso da inata e rola), `fichas.campos`/`visaoM`, os usos de arquivo `aparencia` e `simbolo`, `tokens.controladoPor` e o
  som por nome em zona e reação. Ferramentas novas: `mapa`, `tokens`, `mesa`, `som`, `combate` e `chat`;
  ampliadas: `cenas`, `automacoes`, `objetos` e `fichas`. Tudo passa pela `tratarIntencao` com as permissões da
  pessoa e entra no lote do Claude; o Desfazer agora cobre também os desenhos. Texto no mapa é feito de traços
  (a mesa não tem forma "texto"; assumido). Não se desfazem: chat, rolagens, combate, som, relógio, configuração
  e arquivos.

Regras que continuam:
- **É mais um cliente da sala, não uma porta dos fundos:** passa pelas mesmas intenções, schemas zod e
  capacidades. As ferramentas do MCP são geradas a partir dos schemas.
- **Não manda imagem pelo protocolo da mesa** (premissa das imagens locais): refere-se aos arquivos pelo nome ou hash,
  e o navegador do mestre busca na pasta dele. **Desde o M1 o Claude também sobe arquivos**, por um caminho próprio
  (a ferramenta `arquivos`, abaixo): o arquivo vai do computador do mestre para uma caixa de entrada da sala e o
  navegador do mestre o processa.
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

**12-1: como ficou** (2026-11-13; o lado da sala e da web; o servidor MCP é o 12-2)

- **Token** (Preferências, "Conectar o Claude"): cada conta gera o próprio, por mesa. Formato `tvc_` + 43 caracteres base64url (32 bytes do `crypto`), mostrado **uma vez** com Copiar e o trecho do Claude Code e do Desktop (`apps/web/src/claude/textosDoClaude.ts`, provisório até o 12-2). A sala guarda **só o SHA-256**, ligado à conta (tabela `tokens_claude`, migração 13, aditiva e idempotente). Até 5 por conta e mesa (assumido). Revogar vale na hora e **derruba a conexão** (close 4001); remover, recusar ou trocar a vaga da conta revoga os tokens dela; a exportação não leva tokens.
- **A conexão**: `Authorization: Bearer <token>` no upgrade do `/api/m/<id>/ws`. Só o token vale (o cookie é ignorado, nenhum cookie nasce) e **nenhuma rota HTTP o aceita**. Errado, malformado ou revogado: o mesmo 401, e as falhas entram no bloqueio progressivo por IP do login (4.14). Um cliente sem `Origin` (o MCP é um processo Node) passa pela checagem do C3 sem exceção.
- **Regra que manda em tudo**: o Claude entra como o próprio usuário. As mesmas capacidades, a mesma visão e os mesmos eventos; `processar` recebe `{ claude: true }` e só acrescenta a lista de proibidos, a marca "pelo Claude" e, para o mestre, o rascunho. **Proibidos** (mesmo para o mestre, `sem_permissao`: "O Claude não pode ... só a pessoa, pela mesa"): `papel.alterar`, `permissao.alterar`, `campanha.exportar`, `campanha.importar` e, para o Claude não virar provedor de arquivos, `asset.pedir`, `asset.inventario`, `asset.tenho` e `asset.naoTenho` (assumido). Contas, pedidos, redefinições, chave da pasta, código de recuperação, apagar a mesa e tokens são rotas HTTP que o token nunca abre. Lista num lugar só: `packages/shared/src/claude.ts`.
- **Limite** de 20 pedidos por segundo por token, rajada de 40 (assumido); o excesso responde `muitas_mensagens`. **Presença**: o Claude não conta como a pessoa online; a bolinha ganha uma marca "Claude conectado". **Chat**: mensagem e rolagem da conexão do Claude levam `peloClaude`, visível para todos; quem rola é a sala e a rolagem oculta segue `dado.rolarOculto`.
- **O jogador cria as próprias fichas e handouts**: capacidade `personagem.criarProprio` ("Criar fichas e notas próprias"), delegável, ligada por padrão. A ficha nasce com `editores` só ele e o handout com a visibilidade que ele escolher, os dois numa **pasta própria** (`pasta-de-<id>`, que a sala cria; só ele e o mestre a veem; assumido) e com `criadoPor`. Ele edita e apaga o que criou; o mestre sempre vê, edita e apaga. Teto de 20 fichas e 20 handouts por jogador (`limite_de_criacao`).
- **Rascunhos**: o que o Claude **do mestre** cria entra com `rascunho: true` (cenas, fichas e NPCs, handouts, pastas, modelos, pontos, luzes, tokens, zonas e automações). O jogador não o recebe (snapshot e evento); automação em rascunho não roda; a cena em rascunho não vira a do grupo. Para o mestre: selo "Rascunho" e o chip "Rascunhos do Claude (N)", com Publicar (por item ou tudo) e Descartar (`rascunho.publicar` e `rascunho.descartar`, `mesa.configurar`). O Claude do mestre também pode publicar (assumido).
- **Desfazer**: a sala anota o inverso de cada mudança do Claude num diário (`claude_lotes`, migração 14, 50 lotes por usuário, fora da exportação), agrupado pelo `loteId` do envelope (cada chamada de ferramenta do MCP manda o seu e uma descrição curta). Preferências lista os lotes ("Claude: criou 6 NPCs, há 5 min") com Desfazer e há "Desfazer tudo o que o Claude fez". Desfaz na ordem inversa; o item que outra pessoa mudou depois é pulado e o aviso diz qual (publicar não conta como mudança). O jogador só desfaz o que o Claude dele fez.

**12-2: como ficou** (2026-11-13; o servidor MCP em `apps/mcp`; detalhes em `docs/REDESIGN.md` e o passo a passo em `docs/MCP.md`)

- **O programa**: servidor MCP em stdio, em Node (`@modelcontextprotocol/sdk` 1.32.2; WebSocket nativo). `pnpm --filter @tabletop/mcp build` gera `apps/mcp/dist/tavola-mcp.mjs`. Variáveis: `TAVOLA_URL` (a origem da página, ou o endereço do WebSocket; padrão `http://127.0.0.1:8787`), `TAVOLA_MESA`, `TAVOLA_TOKEN` (nunca vai para log nem resposta) e, opcional, `TAVOLA_COMPENDIO`. Abre `ws(s)://<host>/api/m/<id>/ws` com `Authorization: Bearer`, mantém o estado com o `reduzir` do `shared`, reconecta sozinho e, com o token recusado (401 ou close 4001), responde "Token inválido ou revogado: gere outro em Preferências → Conectar o Claude." sem tentar de novo. Nada da internet em execução.
- **As 11 ferramentas** (nenhuma genérica; o MCP não tem permissão própria): `panorama`, `ler`, `fichas`, `compendio`, `notas`, `objetos`, `cenas`, `automacoes`, `rolar`, `rascunhos`, `desfazer`. A lista de cada usuário sai das capacidades do snapshot: o jogador não vê `objetos`, `cenas`, `automacoes` nem `rascunhos`. Nomes no lugar de ids, lote numa chamada só, resumo por padrão, erro que diz o que corrigir, e um `loteId` por chamada (com a descrição) em toda intenção que ela manda.
- **Automações como grafo no MCP** (AU2, 2026-11-20). A ferramenta `automacoes` monta o desenho como o editor: `nos` (cada um com `nome` único, `tipo`, `config` e, se quiser, `x` e `y`; sem posição, a mesa arruma na grade) e `fios` (`de` e `para` pelo **nome** do nó, e `saida` e `entrada` só quando o padrão não serve: "saida" e "entrada" nos nós de ordem, "valor" nas condições e portas, que chegam em "condicao" do "se" ou em "entradas" das portas E e OU). A forma curta do AU1 (`gatilho` + `trilhas`) continua valendo e a mesa a converte em grafo; em edição, `nos` e `fios` trocam o desenho inteiro. Os erros vêm em português com o nome do nó ("o nó \"Se\": este \"se\" está sem condição..."). `explicar` descreve o grafo em português, inclusive OU de gatilhos, E, OU, NÃO e caminhos paralelos; o `guia` cobre nós, portas lógicas e fios (um teste vigia que todo tipo de nó, de porta, de gatilho, de condição e de ação esteja nele). A ferramenta não ganhou campo fora da tabela de paridade (`fluxo.nos[]` e `fluxo.fios[]` apontam para `automacoes:fluxos[].nos[]` e `.fios[]`). **AU3:** as portas viram **caixas** no MCP (`tipo: "caixa"`, `config: { porta: "ou" | "e" | "nao" }`) e as peças entram nos espaços pelo campo `em` do nó, que leva o **nome** da caixa, e `espaco` (0 é o de cima; sem ele, a peça vai no primeiro espaço livre, na ordem em que aparece; `config.espacos` pede mais de 2, até 12) (as peças guardadas não têm fio: o fio sai da caixa; o tipo antigo `porta` deixou de valer no MCP, mas as automações salvas com portas são convertidas ao ler); `explicar` descreve as caixas e o `guia` explica cada uma e para que serve (o teste que reprova peça fora do guia continua); `fluxo.caixas` é da sala (`paridadeCampos`).
- **Automações por blocos e o MCP que explica** (AU1, 2026-11-19). A ferramenta `automacoes` cria e edita automações **pelo nome**, com o JSON da árvore de blocos (gatilho + trilhas) e **nomes** de zona, modelo, cena, token e som, nunca ids; confere o fluxo com a mesma validação do editor e diz, em português, em que trilha e bloco está o erro. Também: `acionar` (disparar, ligar, desligar), `usarBotoes`, `listar`, **`explicar`** (a frase em português de uma automação, ou de todas: a mesma função pura `fraseDoFluxo` da lista e do editor) e **`guia`** (um texto curto e fiel de como as peças funcionam: gatilhos, trilhas, esperar, se e sortear, para cada, ações, prazos, sinais, limites e o que "nada fica preso" quer dizer). As **instruções do servidor** ganharam uma linha: perguntaram sobre automações, chame `guia` e `explicar` antes de responder; o `panorama` repete a dica. Um teste falha se existir tipo de bloco, de gatilho, de condição ou de ação que o guia não cita. Paridade: `fluxo.criar|editar` → `automacoes.fluxos`, `fluxo.apagar` → `fluxos[].apagar`, `fluxo.ligar|disparar` → `acionar`; a trava por campo (`paridadeCampos`) cobre o gatilho e os blocos.
- **Cenas em células** (a partir do canto de cima à esquerda, com meias células): as paredes usam `encaixarMeiaCelula`, o arco "de a até b passando por c" vira `meio` (e há o arco tangente, `meioDoArcoTangente`). Os tokens de NPC saem da ficha.
- **Compêndio local**: os arquivos da pasta `compendio/` do computador (ou o exemplo do SRD embutido), com magias, armas, itens, monstros e itens mágicos (N3a). **Fora do MCP**: levar o grupo, disparar eventos, botões, mapa e imagens, combate, desenhos, relógio e configuração.
- O texto de "Conectar o Claude" na mesa é o comando final (`claude mcp add tavola --env TAVOLA_URL=... --env TAVOLA_MESA=... --env TAVOLA_TOKEN=... -- node apps/mcp/dist/tavola-mcp.mjs`).

**12-3: o MCP mora na própria sala, por HTTP** (2026-11-13; o usuário cola **um comando só**; detalhes em `docs/REDESIGN.md`, `docs/protocolo.md` e `docs/MCP.md`)

- **Motivo**: o comando do 12-2 dependia da pasta do repositório, do `build` e da ordem das opções, e um jogador de outro computador nem tem o repositório. Agora a mesa mostra uma linha que funciona em qualquer pasta, sem arquivo, sem build e sem Node: `claude mcp add --transport http --scope user tavola-<id da mesa> <origem da página>/api/m/<id>/mcp --header "Authorization: Bearer <token>"` (só aspas duplas: vale no PowerShell 5.1, no cmd e no bash).
- **A rota**: `POST /api/m/<id>/mcp`, Streamable HTTP sem estado (JSON-RPC em JSON, `initialize`, `notifications/initialized` com 202, `tools/list`, `tools/call`, `ping` e lotes); GET e DELETE são 405. Autenticação por `Authorization: Bearer tvc_...` com a mesma validação do 12-1 (hash, conta ativa, mesma vaga, bloqueio por IP); 401 sem dizer o motivo, 429 com o IP bloqueado; sem cookie, sem sessão, sem CORS e **qualquer `Origin` é recusado**.
- **Mesmo tratamento do WebSocket do Claude**: a sala tem uma função só para tratar uma intenção (`tratarIntencao`), chamada pelo WebSocket e pelo HTTP: limite por token, proibidos, marca "pelo Claude", rascunho, diário do Desfazer, limite do chat e difusão. Não há caminho paralelo.
- **O código das ferramentas** (as 11, os nomes, os esquemas, `fichaPorPartes`, o formato e os erros) mora em `packages/shared/src/mcp` (entrada `@tabletop/shared/mcp`, que o navegador nunca carrega); a sala (HTTP) e o `apps/mcp` (stdio) usam o mesmo código. A rota HTTP é uma "conexão" que lê o estado da própria sala (a visão do usuário) e responde na hora.
- **Presença**: sem conexão aberta, "Claude conectado" vale por 2 minutos depois de cada chamada (assumido); o "último uso" do token é gravado a cada chamada e a tela mostra "conectado agora" ou "usado há X min".
- **Claude Desktop** continua com o servidor local (`apps/mcp`, stdio); o texto da tela diz com honestidade que isso exige o Távola baixado e o Node. O compêndio pela rota HTTP é o exemplo do SRD embutido no Worker.

**M1: o Claude sobe arquivos para a mesa** (M1, 2026-11-14; pedido do Vilella: "o mestre não deve ter trabalho algum além de prompts"; detalhes em `docs/protocolo.md`, `docs/REDESIGN.md` e `docs/MCP.md`)

- **O caso**: o Claude gerou um mapa PNG de 3150 x 3150 px (16 MB) numa pasta do computador e não conseguia pô-lo na cena; o mestre subiu à mão e calculou sozinho o tamanho da cena (45 x 45 a 70 px por quadrado).
- **Ferramenta `arquivos`** (a 12ª; para todos). `enviar` recebe o `uso` (mapa da cena, token, retrato da ficha, imagem do handout, som, compêndio), o `nome` do arquivo (só para exibição) e o alvo **pelo nome** (`cena`, `token`, `ficha`, `handout`); no mapa, `quadrados` ou `pxPorQuadrado` ajustam o tamanho da cena. Devolve um **link de envio de uso único** (`PUT <origem>/api/m/<id>/claude/envio/<segredo>`, 15 minutos) e o comando `curl -sS -T "<caminho do arquivo>" "<link>"`. Sem shell, o arquivo pode ir em `base64` (até 2 MB). `estado` consulta o envio (espera até 20 s), `listar` mostra os arquivos da mesa e onde são usados, e `usar` põe na mesa um arquivo que já existe, pelo hash.
- **Caminho**: o PUT grava o arquivo numa **caixa de entrada** da sala (SQLite, em linhas de 1 MB; teto de 300 MB; 24 h; migração 16, aditiva e idempotente, fora da exportação). A sala avisa o navegador do mestre (`caixa.pendentes`), que baixa de `GET /api/m/<id>/caixa/<envio>` (cookie do mestre), processa pelo **mesmo caminho do botão de subir** (tiles, redução a 512 px, cifra se a pasta tem chave; som e compêndio como na tela), registra o asset e manda `caixa.concluir`. A **sala aplica o uso como o Claude que pediu**, no lote dele (assim as permissões são as dele, o diário do Desfazer o cobre e a difusão é a de sempre) e apaga os bytes. O PUT e a ferramenta esperam o resultado até 20 s; sem navegador de mestre aberto o arquivo espera e a mesa mostra "O Claude enviou 1 arquivo" ao abrir.
- **Quem pode** é o que a pessoa pode pela tela: a ferramenta confere antes de dar o link, rodando as regras de verdade (`processar`) sobre uma cópia do estado. Mapa, som e compêndio são do mestre; o jogador só põe imagem no que é dele (com `asset.subir`).
- **Segurança**: segredo de 32 bytes (`tve_`), só o hash guardado, uso único, preso ao token (revogar o token mata o link) e à mesa; a rota recusa qualquer `Origin`, exige `Content-Length`, para no limite do uso (imagem 20 MB, mapa 64 MB, som 20 MB, compêndio 16 MB), confere o formato pelos **primeiros bytes** (png, jpg, webp, gif; mp3, ogg, wav; json) e limita os pedidos por token. Nenhum caminho do computador chega à sala (o nome é limpo). A caixa e o aviso `caixa.pendentes` nunca chegam ao jogador, e `caixa.concluir` e `caixa.falhar` estão na lista de proibidos ao Claude.
- **Desfazer** tira o mapa da cena ou a imagem do token; o arquivo fica na pasta.

### 4.13 Interface

Layout no estilo dos VTTs de mesa (referência: a tela de outra mesa virtual que o Vilella usa): **o mapa ocupa a
tela e as ferramentas flutuam em volta.** A identidade visual é própria: nada de logotipo, ícones,
cores ou nomes de terceiros.

- **Mapa em tela cheia** (PixiJS), fundo escuro.
- **Barra de ferramentas vertical à esquerda**, com ícones e dica ao passar o mouse (V3b, 2026-11-11: dica só onde falta nome, de uma linha, 700 ms de atraso, e opção para desligar em Preferências): selecionar/mover,
  mão (arrastar o mapa), régua; depois desenhar paredes (lote 5), luzes e pontos (lotes 6–7). No
  rodapé, o seletor de camada (tokens / mestre). Ferramenta só do mestre só aparece para o mestre.
- **Campos lado a lado** (A1, 2026-11-19): rótulo, caixa e ajuda alinham em linhas comuns (grade com subgrid); o rótulo mais alto define a linha dos rótulos e as caixas ficam na mesma altura, sem encurtar rótulo.
- **Controle de zoom flutuante** na borda direita do mapa: +/−, trilho, nível atual, centralizar.
- **Aba Preferências** (P1, 2026-11-13): sanfona com resumo, sete cartões recolhíveis na ordem **Conta** (você é X, Sair ou Trocar usuário, Trocar de mesa), **Aparência** (tema), **No mapa** (unidade de distância, encaixe no grid, dicas), **Ajuda e arquivos** (tour, pasta local de imagens, transferências), **Conectar o Claude**, **Segurança** (trocar a senha; só com login) e **Atalhos do teclado**. Cada cartão mostra ícone, título e, fechado, o resumo do estado numa linha ("Metros · encaixe ligado · dicas ligadas", "2 tokens · conectado"). Só a Conta abre por padrão; o que a pessoa abre ou fecha fica no navegador (`tabletop:pref:secoes`). Aparência, No mapa e a pasta local levam a marca "só neste navegador".
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
   (C4, 2026-11-12: a tela inicial é um cartão central com abas "Minhas mesas", "Entrar com código" e "Criar mesa"; criar é um
   passo a passo de 2 passos, "Mesa e conta" e "Pasta da mesa". Só a disposição mudou; as rotas e as regras são as mesmas.)
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
  **vazio** (uma cena em branco e só o mestre, sem fichas nem tokens; cada jogador entra com a conta dele; V7, 2026-11-12). Um DO de
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
  a Mesa; `/m/<id>/ficha/<fichaId>`, desde o V9, é só a ficha numa janela própria); id inválido ou inexistente mostra a mensagem e "Voltar ao início". O nome e o id ficam no alto da aba
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
  mostra os pedidos (Aceitar, com a "Ficha dele" opcional, ou Recusar), os pedidos de redefinição
  ("Confirme por voz ou mensagem que é a própria pessoa" e Aprovar) e a lista de contas (nome, login, status, último
  acesso, Remover com confirmação; a conta do mestre não se remove). **(V7, 2026-11-12) Membros e aceite:** o estado continua
  guardando "vagas" (`usuarios`), mas só são **membros** da mesa o mestre e quem tem conta ativa (com `MODO=teste`, também quem
  entrou pelo login solto). A sala manda a lista derivada em `estado.membros` (opcional, nunca gravado nem exportado; sem
  ele todos contam) e toda lista ou seletor de pessoas mostra só membros; a vaga escondida segue existindo (fichas, tokens e
  histórico apontam para ela) e aparece pelo nome onde é referência. Aceitar: "Nenhuma" cria o jogador com o nome da pessoa
  (próxima cor livre; no limite de 12 reaproveita uma vaga escondida sem dono); a ficha de uma vaga escondida liga a conta
  àquela vaga e a renomeia; a ficha sem dono cria o jogador e o torna dono dela. Remover a conta esconde o jogador.
- **Trocar a senha**: em Preferências, com a atual, a nova e a confirmação; as outras sessões caem.
- **A mesa legada sem mestre** (a campanha de hoje): a tela de entrada oferece "Criar a conta do mestre desta mesa" (login,
  nome e senha), ligando a conta à vaga `mestre` que já existe. O servidor só aceita de uma requisição **local** (host
  `127.0.0.1`, `localhost` ou `[::1]` e sem `CF-Connecting-IP`, ou com ele em loopback) e só enquanto a mesa não tem conta de
  mestre: na internet uma mesa nunca fica sem dono. Antes disso a mesa não aceita pedidos de entrada.
- **Exportar e importar** não levam contas nem sessões. Importar mantém as contas da mesa; a conta ligada a uma vaga que a
  campanha importada não tem fica sem vaga (o mestre a liga de novo) e perde as sessões.
- **Rotas novas** sob `/api/m/<id>/`: `GET situacao`, `conta/entrar`, `conta/pedir`, `conta/sair`, `conta/esqueci`,
  `conta/redefinir`, `conta/trocar-senha`, `conta/mestre-inicial`; do mestre: `GET contas`, `contas/<id>/aceitar`,
  `recusar`, `remover` e `liberar-redefinicao` (a rota `vaga` saiu no V7). Ver `docs/protocolo.md`.
- **Pendências do C1 resolvidas**: a memória do mapa leva o id da mesa na chave (a legada herda a chave antiga, copiando-a
  uma vez); renomear a mesa chega ao vivo (frame `mesa.renomeada`); a lista "Mesas neste computador" fica em ordem de último
  uso, a legada primeiro quando não há uso.

**C3: como ficou** (2026-11-12; tudo local, feito como se fosse para a internet)

- **A chave da pasta**: ao criar a mesa o mestre pode escolher a pasta (a mesma pasta local das imagens; só Chrome e Edge). O navegador gera um par ECDSA P-256 (WebCrypto), grava `tavola-mestre.json` (`formato`, `aviso`, `mesaId`, `nomeDaMesa`, `chavePrivada` em JWK, `criadaEm`) e manda ao servidor **só a chave pública**, que fica na conta do mestre. A privada nunca viaja. Uma pasta que já guarda a chave de outra mesa é recusada (gravar por cima apagaria a prova de mestre dela). Mesa sem chave (a legada, ou criada sem pasta): aba Mesa, Contas, "Proteger com a pasta da mesa"; "Trocar a chave da pasta" invalida a antiga. As duas pedem a senha atual (assumido).
- **Código de recuperação**: 20 caracteres do alfabeto dos ids em grupos de 4, gerado no servidor, guardado só como SHA-256 (sem PBKDF2: a entropia é alta). Mostrado uma vez (caixa grande, Copiar, Baixar .txt, "Anotei o código" para seguir): ao criar a mesa, quando a mesa legada ganha a conta do mestre e em "Gerar novo código" (pede a senha; o anterior morre). Depois de usado para recuperar, morre e um novo aparece na hora (assumido).
- **Recuperar o mestre** ("Sou o mestre e esqueci a senha", na entrada da mesa), duas saídas. Pela pasta: o navegador lê o arquivo, recusa a pasta de outra mesa antes de pedir o desafio ("Esta pasta é de outra mesa."), pede o desafio, assina `tavola-recuperar:<mesa>:<nonce>` e manda a assinatura com a senha nova derivada. Pelo código: código e senha nova. Os dois pedem o login do mestre (o sal da senha leva o login; assumido) e, se certos, trocam a senha, derrubam as sessões antigas e abrem uma nova. A mensagem de erro não diz se a mesa tem chave ou código; sem chave a conferência roda contra uma chave de mentira.
- **Servidor**: migração 11 do `Armazenamento` (aditiva e idempotente): colunas `chave_publica` e `codigo_hash` em `contas` e a tabela `desafios` (nonce, criação, validade; no máximo 50 abertos). O nonce é gasto antes de conferir (certa ou errada); 5 minutos de validade. Limites: o do C2 por IP e 5 erros por mesa (1, 5, 15 e 60 min); desafios 20 por IP por hora. Nada disso vai a cliente: a lista do mestre só diz `protecao: { temChave, temCodigo }`. Rotas e corpos em `docs/protocolo.md`; regras puras e WebCrypto em `packages/shared/src/recuperacao.ts`.
- **Tour de introdução** (lote T, 2026-11-12): no primeiro acesso de cada conta a cada mesa abre um tour (mestre, 10 passos; jogador, 6), com Pular e "Fazer o tour de novo" em Preferências. "Já viu" é um 0/1 por conta no servidor (migração 12, coluna `contas.tour_visto`; `GET eu` devolve `tourVisto` e `modoTeste`; `POST conta/tour-visto` marca). Com `MODO=teste` não abre sozinho (só com a chave `tabletop:pref:tourNoTeste` no navegador). Ver `docs/REDESIGN.md`, "T — como ficou". Também: o código de recuperação cabe numa linha e a mesa legada oferece "Proteger com a pasta da mesa" depois de anotar o código.
- **Tokens do Claude** (12-1, 2026-11-13): ver 4.12. O token é um segredo por conta e mesa (só o SHA-256 no banco), abre só o WebSocket, não abre sessão de navegador nem gera cookie; as falhas contam no mesmo bloqueio por IP do login (30 em 15 minutos bloqueiam o IP por 15 minutos) e o 401 é igual para token errado e revogado. Revogar, remover a conta, recusá-la ou trocar a vaga dela fecham as conexões com 4001.
- **Reforços do C2**: (1) Origin: no WebSocket e em todo POST de `/api/` o `Origin` tem de ser o host do pedido (sem `Origin`, aceita); (2) o bloqueio de login inexistente: as falhas contam por login normalizado na tabela de limites e, depois da 5ª, a espera é dita igual à de uma conta que existe.

### 4.15 Chamada da mesa (CH1, 2026-11-19)

O Vilella pediu "um discord vinculado à mesa": uma janela com chamada de vídeo em grupo, com câmera e microfone, que ele possa pôr numa segunda janela, bonita e prática, com fundo da câmera desfocável. A transcrição por Whisper veio depois (CH3, 4.18): **a chamada não grava nada, a menos que o mestre ligue a gravação**, e todos veem o aviso.

- **O que é**: a janela própria `/m/<id>/chamada`, aberta pelo botão "Chamada" no topo da mesa (para todo membro; o número é quantos estão na chamada). Ela tem a própria conexão com a sala, como a ficha e a mesa de som em janela própria; só o socket dessa janela participa, então **fechar a janela é sair**. O mesmo usuário entrando por outra janela ou aparelho **substitui** a antiga, que mostra "Você entrou na chamada por outra janela" (assumido).
- **Quem entra**: só membro da mesa (o Claude nunca). Limite de **8** pessoas (malha ponto a ponto: cada pessoa a mais cria uma conexão com cada uma das outras); a 9ª vê "A chamada está cheia (8)" (assumido).
- **A sala só sinaliza** (`chamada.entrar`, `chamada.estado`, `chamada.sair`, `chamada.sinal`, `chamada.chamar`; ver `docs/protocolo.md`). Quem está na chamada é estado de memória, guardado no `serializeAttachment` do socket da janela da chamada (sobrevive à hibernação do Durable Object); socket fechado = saiu, e todos ficam sabendo (`chamada.quem`). **Nada vai ao estado, ao banco, ao histórico, ao desfazer, à exportação nem ao snapshot guardado**, como o ping (V12). A sala carimba o `de` de cada sinal (nunca confia no cliente), só repassa entre membros que estão na chamada, limita o tamanho (SDP até 16 mil caracteres, candidato até 1 mil) e a frequência (balde de 120 sinais com reposição de 60 por segundo, por socket; "chamar" a mesma pessoa só a cada 10 s) e responde erro curto (`fora_da_chamada`, `chamada_cheia`, `sem_permissao`, `muitas_mensagens`).
- **Voz e vídeo vão direto entre os computadores** (WebRTC, criptografado; nunca passam pela sala), uma `RTCPeerConnection` por par, com "perfect negotiation": a ponta de id maior oferece e a de id menor (educada) cede nas colisões. Ligar e desligar a câmera, trocar de aparelho e o desfoque usam `replaceTrack`, sem renegociar. Com mais de 3 pessoas o teto do bitrate do vídeo cai (900 kbps até 3; 450 até 5; 250 acima). Vídeo 640×360 a ~24 fps. Áudio com `echoCancellation`, `noiseSuppression` e `autoGainControl` ("Reduzir ruído e eco", ligado por padrão).
- **Quem fala**: um `AnalyserNode` por fluxo (o meu e os recebidos), com histerese; cada cliente calcula sozinho (não trafega). O anel verde (`sucesso`) aparece no quadro e na lista; a janela da mesa o mostra também na presença do topo, pelo `BroadcastChannel` (mesmo navegador).
- **Volume por pessoa** (0 a 200%, `GainNode`) e "Silenciar só para mim", lembrados **por mesa e pessoa nas preferências locais** (`tabletop:pref:chamada:...`; nunca vão à sala). "Parar de ouvir" silencia tudo o que chega e o próprio microfone, e o estado vai aos outros. Saída de som pelo `setSinkId` do contexto de áudio onde o navegador tem (senão a opção some, com a dica do porquê). Sons curtos de entrar e sair gerados no WebAudio (sem arquivo), com opção de desligar (assumido).
- **Fundo desfocado**: MediaPipe Tasks Vision (`@mediapipe/tasks-vision`, Apache-2.0) com o modelo `selfie_segmenter` **empacotado no projeto** (`apps/web/src/chamada/modelos/`, 250 KB; o wasm vem do pacote). Câmera → segmentação (GPU, cai para CPU) → canvas (fundo com `blur` de 2,5 px no **Leve** e 7 px no **Forte**, a pessoa nítida por cima; CH3, 2026-11-20: eram "Desfocar" 7 px e "Desfocar forte" 16 px, e o botão da barra só ligava o de 7) → `captureStream` → `replaceTrack`; os outros recebem a imagem já desfocada. O módulo só é baixado quando alguém liga o desfoque. Se o modelo não carregar, ou ficar abaixo de 12 quadros por segundo por 5 s, o desfoque se desliga e o botão fica desabilitado com o motivo.
- **Sem servidor externo**: `iceServers` vazio por padrão (no mesmo computador e na rede local basta). Para a **internet**: defina a variável de ambiente do Vite `VITE_CHAMADA_ICE_SERVERS` com um JSON, por exemplo `[{"urls":"stun:stun.exemplo.org:3478"},{"urls":"turn:turn.exemplo.org","username":"u","credential":"c"}]` (STUN ajuda a achar o caminho; TURN é o recurso quando o roteador não deixa passar). A câmera e o microfone **exigem HTTPS** fora de `localhost`. Nada é buscado da internet em tempo de execução por padrão.
- **Tema**: a janela segue o tema da mesa (lê a mesma preferência `tabletop:pref:tema` ao abrir e acompanha a troca ao vivo pelo evento `storage`); não tem seletor de tema.
- **A tela de entrar (CH3, 2026-11-20)**: um bloco só, centrado, de no máximo 720 px; a **prévia da câmera** é o maior elemento (16:9, a mais larga que a altura da janela deixa, sem rolagem em 1280×720 e 1920×1000); câmera, microfone e fundo ficam na mesma linha, com as caixas alinhadas embaixo; "Entrar na chamada" e "Entrar só ouvindo" têm a **largura do texto** (lado a lado; um embaixo do outro na janela estreita, abaixo de 560 px).
- **O fundo em três níveis (CH3)**: **Desligado, Leve e Forte**. Antes de entrar é um `SeletorSegmentado` "Fundo da câmera". Na chamada, o botão do fundo (ícone de pessoa) abre um **menu pequeno** com os três níveis e mostra o nível numa letra no canto do ícone (L ou F); o atalho **B** passa ao próximo (Desligado, Leve, Forte, Desligado). A escolha fica em `tabletop:pref:chamada:geral` (a preferência antiga "desfocar" passa a valer como Leve e "forte" como o novo Forte). O protocolo não mudou: `fundo: nenhum | desfocar | forte`.
- **A janela**: "antes de entrar" (a própria câmera grande, mic e câmera, nível do microfone, fundo Desligado / Leve / Forte, aparelhos, "Reduzir ruído e eco", "Entrar com o microfone desligado", quem já está, "Entrar na chamada" e "Entrar só ouvindo"); a **janela larga** (só a Grade, sem modo Palco por pedido do Vilella; lista lateral "Na chamada" e "Na mesa, fora da chamada" com "Chamar", barra de baixo com Microfone, Câmera, Desfocar o fundo, Parar de ouvir, aparelhos e Sair; atalhos **M**, **V** e **B**, só dentro dela); e a **janela estreita** (abaixo de ~560 px de largura, sozinha: linhas com miniatura, nome, personagem, "falando", a trilha numa linha). "Flutuar por cima" usa o Document Picture-in-Picture (Chrome e Edge; sem suporte o botão some). Entrar só ouvindo trava microfone, câmera e fundo até sair e entrar de novo (assumido).
- **Trilha da mesa**: um quadro que mostra o que a mesa de som toca agora (nomes dos ambientes, equalizador); para o mestre, "Abrir a mesa de som". **(MU1, 2026-11-19: com música tocando mostra o nome da música e o do botão, e o mestre ganha Pausar e Próxima ali; ver 4.16.)**
- **A grade (CH2, 2026-11-20)**: nunca rola. Colunas e linhas saem de `calcularGrade` (quadros 16:9 o maiores possível, centralizados, recalculados ao mudar o tamanho, a lista lateral ou quem está na chamada). No máximo **9 quadros por página**; com mais, setas, "1/2" e as setas do teclado (grade com o foco) trocam de página, e um ponto verde na seta avisa que alguém fala numa página escondida. A trilha conta como um quadro e fica por último (assumido). Barra de baixo de 56 px, lista lateral de 232 px; quadro da trilha pequeno usa botões só com ícone.
- **"Chamar"**: de dentro da chamada, a quem está na mesa e fora dela; vira um aviso transitório na mesa da pessoa ("Vilella está chamando para a chamada", com "Entrar") (assumido).
- **Paridade com o Claude**: a chamada precisa da câmera e do microfone de uma pessoa; as intenções `chamada.*` entram na tabela como `gesto ao vivo` (e `chamada.sinal`, `transporte`), com o motivo. Ver `docs/MCP.md`.
- **Gravar e transcrever** (CH3): o mestre grava a fala da sessão e transcreve depois com o whisper.cpp. Ver 4.18.
- **Fora, por ora**: compartilhar tela. (A playlist da trilha virou a música da mesa, 4.16.)

### 4.16 Música da mesa (MU1, 2026-11-19)

O Vilella pediu uma **biblioteca de música com etiquetas e botões de filtro**, que toca por cima dos ambientes, e um divisor na mesa de som. O desenho aprovado está nos canvas `SomMusicaFaixa` (tocar) e `MusicaBiblioteca` (organizar).

- **Biblioteca** (`Estado.musica`, só do mestre; entra na exportação): músicas e botões. Cada música é um arquivo `som` já registrado (o hash é a identidade: o mesmo arquivo entra uma vez só e, se entra de novo, só ganha as etiquetas), com nome, **duração** (lida no navegador do mestre ao importar), **energia de 1 a 5** (sem nota vale 3), até 12 etiquetas e uma descrição de uma linha (opcional). Até 500 músicas e 24 botões.
- **Etiquetas**: filtro por etiquetas, e **várias etiquetas = só as músicas que têm todas** (sem diferenciar maiúscula). "Adicionar mp3" e **"Adicionar pasta"**: as **subpastas viram etiquetas** (a pasta escolhida não vira; arquivo solto nela fica sem etiqueta), então tudo em `Combate\` entra com "Combate". Marcar várias músicas abre a barra de lote: "+ Etiqueta", "− Etiqueta", "Energia" e "Tirar da lista" (os arquivos continuam no computador).
- **Botões** (`musica.botoes`): um filtro salvo, com **etiquetas**, **faixa de energia** e **ordem ao tocar**. Aparecem na seção **Música** da mesa de som, com o ícone, a cor, o nome (até 16 letras) e quantas músicas têm. "Salvar este filtro como botão" cria; o lápis edita; a lixeira apaga. **"Tocar para todos"** na biblioteca toca o filtro atual sem salvar.
- **Energia só filtra**: não é peso de sorte.
- **Ordem ao tocar**:
  - **Aleatória, sem repetir** (padrão): como embaralhar um baralho. Só repete depois que todas tocaram, e a última nunca volta em seguida (a primeira da passada nova nunca é a última da anterior).
  - **Crescente**: da energia mais baixa para a mais alta, sorteando dentro de cada energia; ao chegar no topo, fica só nas músicas de energia mais alta do filtro, em aleatória sem repetir, **sem fim**.
- **Sincronia sem evento no fim de cada música**: a sala guarda a fila da **primeira passada** (`inicial`), o que se **repete** depois (`ciclo`), a **semente** do sorteio e o instante de início no relógio da sala (`inicioMs`, com o `servidorMs` refeito em cada snapshot e evento, como os ambientes). Cada navegador acha a música e o ponto pela **soma das durações** (`musicaAgora`); as passadas depois da primeira saem de um sorteador determinístico (mulberry32) alimentado pela semente, então todo navegador faz a mesma conta. Quem entra no meio ouve do ponto em que está. **Pausar** guarda a posição (`pausadoEm`); retomar continua dela. **Próxima** e **anterior** só movem o ponto da linha do tempo (anterior: depois de 3 s recomeça a música; antes, vai para a anterior).
- **Por cima dos ambientes**: é uma camada própria, com o **volume da música** (`musicaTocando.volume`, padrão 0,7) e o volume geral da mesa de som e as preferências de cada pessoa (a mesma categoria "trilha" dos ambientes). **Transição suave de ~3 s** entre músicas e ao trocar de botão (no cliente). "Parar tudo" pausa a música junto.
- **"Voltar a <botão anterior>"**: ao trocar de botão, o que tocava (tocando ou pausado) fica em `musicaTocando.anterior`, com o ponto onde parou; "Voltar" o retoma dali e o que tocava agora vira o "anterior". Tocar o mesmo botão de novo sorteia outra fila sem trocar o "anterior". O "anterior" é só do mestre.
- **Quem faz o quê**: só o mestre edita a biblioteca e os botões e manda tocar (capacidade `som.controlar`). **O jogador recebe só o que toca** (`Estado.musicaTocando`, sem o "anterior"): a fila com hash, nome e duração, o nome do botão, o início e o volume. **A biblioteca, os botões, as etiquetas e a energia nunca chegam a ele** (a fila só traz as músicas do filtro que toca; por isso o nome das próximas aparece no frame dele, e só o delas). O arquivo vem pelo mesmo caminho dos sons de hoje (hash, pasta da mesa, transferência sob demanda; o navegador baixa a próxima música com antecedência).
- **Persistência**: `Estado.musica` e `Estado.musicaTocando` ficam na tabela `meta` (chaves `musica` e `musica_tocando`), como a `mesaDeSom` e o `somLigado`: **sem migração de banco** (o banco antigo não tem as chaves = sem música; valor ilegível vira "sem música"). Exportar leva a biblioteca e os botões e **não leva o que toca**; arquivos exportados antes abrem sem música (o campo é opcional; `VERSAO_EXPORTACAO` continua 13). Apagar um som da mesa (`som.apagar`) também o tira da biblioteca e para a música que o usa.
- **A mesa de som**: ganha a **Música** em **duas abas**, "Efeitos e ambientes" e "Música" (MU2, 2026-11-19: o divisor arrastável e o minimizar do MU1 saíram, porque a 1360 px o espaço ficou pequeno e os textos cortavam). A barra de abas (`role="tablist"`) fica logo abaixo do cabeçalho, nas três formas (faixa, janela flutuante e janela própria), e cada aba ocupa a largura toda. As setas, Home e End trocam de aba. **Cada aba diz o que toca nela** ("2 ambientes ligados"; o nome do botão da música com ícone de tocando ou pausada, ou "parada") e um ponto marca a aba escondida que tem algo tocando. Trocar de aba só muda a vista: nada para de tocar. A aba escolhida é **lembrada por navegador** (`tabletop:pref:som-aba`, padrão "Efeitos e ambientes" (assumido)). Nomes de efeitos e ambientes mostram até duas linhas (o inteiro vai na dica e no rótulo acessível) e o volume do ambiente ligado fica dentro do cartão. A configuração ganha a aba **Música**.
- **Abas e zoom da mesa de som (MU3, 2026-11-19)**: as abas da mesa de som e as da janela "Mesa de som · configuração" usam o seletor segmentado da ficha ("Personagem | NPC"), sem subtítulo (o estado vai só no rótulo acessível; o ponto na aba escondida que toca ficou). Com a faixa embaixo, o zoom, o selo de modo, o aviso do som e o aviso da importação sobem para ficar acima dela (aberta, recolhida e no arrasto da alça) e voltam ao pé quando a mesa de som vira janela ou fecha.
- **Quadro "Trilha da mesa" da chamada**: com música tocando mostra o nome da música e o do botão; o mestre ganha **Pausar** e **Próxima** ali. Sem música tocando (ou pausada), mostra os ambientes como antes.
- **Paridade com o Claude** (regra do Q16): a ferramenta **`musica`** do MCP etiqueta e dá energia às músicas (por nome), cria, edita e apaga botões, toca um botão ou um filtro, pausa, retoma, vai para a próxima, volta para a anterior, "voltar" ao botão anterior e muda o volume. **Fica fora**: adicionar músicas à biblioteca (`musica.adicionar`), porque a duração só o navegador do mestre sabe ler ao importar; o Claude sobe o mp3 com `arquivos` e o mestre o importa. A trava `paridadeCampos` cobre cada campo. Ver `docs/MCP.md`.
- **Nada custa**: sem API paga, sem IA, sem transcrição, nada buscado da internet.
- **Fora, por ora**: ver `docs/IDEIAS.md` (arrastar para mudar o ponto da música, tocar música por zona ou cena, importar a pasta toda em segundo plano, playlist fixa).


### 4.17 Assets da mesa e segurança dos arquivos (AS1, 2026-11-20)

O Vilella pediu: arrastar uma imagem ou gif para a cena e ele ficar na camada ativa (o mestre e o Claude), um espaço "Assets da mesa" no
menu Mesa com TODOS os arquivos, o upload do jogador indo para esses assets, a pasta do mestre organizada por pessoa e tipo, e carregar do
próprio computador quando der. E perguntou se um jogador consegue pôr vírus no PC do mestre por um png.

**Soltar na cena (a regra de "soltei, o que acontece").**
- **Arquivo do Dungeondraft** (`.dd2vtt`, `.uvtt`, `.df2vtt`) solto em qualquer lugar da mesa (só o mestre): importa o mapa e cria uma cena nova, como antes.
- **Imagem ou animação** (png, jpg, webp, gif, apng) solta **no mapa**: vira uma **imagem solta na cena**, no ponto onde soltou e na camada ativa
  (o mestre usa a camada de trabalho; o jogador, a dos tokens). Até 10 por vez; a segunda e as seguintes ficam escalonadas.
- **Outro arquivo** solto no mapa (campanha, json, texto, exe, svg): recusado com um aviso que diz o que é. O navegador nunca o abre no lugar da mesa.
- **Som** (mp3, ogg ou wav) solto **em qualquer lugar da mesa** (FG2, 2026-11-20): se quem soltou é o **mestre**, entra nos assets e na **biblioteca de música**,
  com o nome do arquivo (sem a extensão) e sem etiquetas; o aviso diz "Adicionada à biblioteca de música." (ou "N músicas adicionadas…") e tem o botão
  "Abrir a biblioteca" (abre a configuração da mesa de som na aba Música). Vários de uma vez entram todos (até 50 por vez); o mesmo arquivo de novo não duplica
  a faixa (a biblioteca já une pelo hash). Se quem soltou é um **jogador**, nada entra e o aviso diz "Só o mestre põe música na mesa."
- **Imagem solta fora do mapa**: nada acontece.
- **Caixa do Claude**: não aceita arrastar; o Claude manda pelo `arquivos` e a caixa processa (`uso: "imagem"`).
- **Um asset arrastado da lista** para o mapa: o mesmo que soltar o arquivo (imagem, animação, token, retrato ou mapa inteiro sem pedaços); **som** arrastado para
  o mapa entra na **biblioteca de música** (FG2: antes ia para o primeiro ambiente livre da mesa de som; o botão "Pôr na mesa de som" da lista continua a pôr o
  som como ambiente).

**A imagem solta é um token sem ficha** (`Token.imagem`: `larguraM`, `alturaM`, `rotacao` em graus e `por`, quem a pôs). Assim herda camadas
(`mapa`, `tokens`, `mestre`), ocultar, visão por camada e o filtro dos frames do jogador, arrastar, copiar, duplicar, apagar e o desfazer do apagar
(`token.restaurar`), a exportação da mesa e o MCP, sem coleção nova no banco nem migração (a entidade é o JSON do token). Mover é o arrasto de sempre (livre,
sem encaixe no grid e sem esbarrar em parede); **esticar** e **girar** têm alças no canto de baixo (proporcional; Shift solta) e acima (Shift gira de 15 em 15
graus) da imagem selecionada, e campos no painel (largura e altura em quadrados, proporção, giro, camada, ocultar, apagar). O gif, apng e webp animado tocam em
laço, cada um defasado dos outros, e ficam parados com "reduzir movimento". O arquivo é um asset novo `imagem` (parada, WebP de até 2048 px) ou `animacao` (como veio,
até 4 MB, com as dimensões reais do primeiro quadro). Intenções: `imagem.colocar`, `imagem.ajustar` (e `token.apagar`/`token.soltar`). Capacidade nova
`imagem.colocar` (delegável, **desligada por padrão**): o jogador com ela põe na cena ativa, nas camadas `mapa` e `tokens`, até 20 por cena; mexe e apaga só nas dele,
nunca esconde nem põe na camada do mestre.

**Lista "Assets da mesa"** (aba Mesa, seção nova; para o jogador, "Arquivos da mesa" em Preferências). Lista tudo: mapas, imagens, animações, tokens, retratos, sons e
músicas, json (os tiles e os arquivos cifrados do pré-envio são pedaços internos e ficam fora). Cada linha: miniatura (ou o ícone do tipo), nome, tipo, tamanho, quem enviou,
onde é usado ("mapa da cena Cripta", "imagem solta Estátua (cena X)", "efeito 2 da mesa de som", "automação Combate") e se está neste computador. Filtros por tipo e por quem
enviou, busca (sem acento nem caixa; acha também pelo uso), ordem por nome, mais novos ou tamanho. Ações: pôr na cena, renomear (só o nome de exibição, `AssetMeta.nomeExibicao`;
o arquivo e o hash não mudam), baixar, apagar, e nos sons "pôr na mesa de som" e "adicionar à biblioteca de música". **Apagar** (só o mestre): sem uso, uma confirmação; em uso
num lugar que se arruma sozinho (imagens, mapas, retratos, handouts), o aviso lista onde e, confirmado, a mesa tira a imagem desses lugares (`asset.apagar` com `removerUsos`);
em uso onde não se arruma (zona, automação, luz, compêndio), recusa e diz onde (o som usa o `som.apagar`, que já limpa tudo). Os bytes continuam na pasta do mestre. O aviso
tem "Desfazer" (`asset.restaurar`: volta a meta, com o mesmo dono e nome).
- **Visão**: o mestre vê tudo; o jogador só o que enviou e o que está em uso numa coisa que ele vê (o mapa da cena ativa, tokens e imagens visíveis, fichas e handouts liberados).
  A sala monta a lista dele (`assets.listar` → `assets.lista`; ver `docs/protocolo.md`), então nada que ele não vê chega ao navegador: nem o mapa escondido, nem os sons do mestre,
  nem onde algo é usado fora da vista dele.
- **Upload do jogador** (retrato, token, handout, imagem solta) já era registrado com `donoId`; agora aparece na lista, "enviado por <nome dele>".

**Pasta do mestre organizada.** Com a pasta liberada, cada asset (menos tile, cifrado e manifesto) ganha uma cópia em
`assets/<quem enviou>/<tipo>/<nome>-<8 letras do hash>.<extensão do tipo detectado>` (tipos: `mapas`, `tokens`, `retratos`, `imagens`, `animacoes`, `sons`, `json`). O hash no
nome evita repetir (o mesmo arquivo cai sempre no mesmo lugar; dois de mesmo nome não se sobrescrevem). **Migração leve, sem mover nada:** a cópia
organizada de tudo o que a mesa já tem é feita na próxima vez que a pasta é aberta; `recebidos/<jogador>/` e `arquivos-da-mesa/<hash>` ficam como estão (o segundo
continua sendo o que outro navegador do mesmo computador lê). Os arquivos novos de jogador **não vão mais** para `recebidos/`.

**De onde carregar** (a ideia dele: "eu subi esse arquivo? ele ainda está aqui?"). Ordem (`ordemDeOrigem`): (1) o cache do navegador, que já guarda tudo o que a pessoa
subiu e baixou, conferido pelo hash; (2) só o mestre: a pasta da mesa (`arquivos-da-mesa/<hash>`, hash e assinatura conferidos); (3) a rede, como sempre (o dono online, depois o
mestre, depois qualquer um). Decidido: **não** reabrir o arquivo original do disco do jogador. O navegador não guarda o caminho nem deixa reabrir sem pedir permissão de novo
a cada visita, e o arquivo que a mesa usa é o *processado* (WebP reduzido), então seria preciso reprocessar o original (mais lento e não garante o mesmo hash). O cache cobre o
"subi e ainda está aqui" sem nada disso. Medida: ver `docs/ESTADO.md`, AS1.

**Segurança dos arquivos vindos de outra pessoa.** Um png de jogador não executa nada no PC do mestre (o navegador só o decodifica), mas o Távola não confia em nome nem em
tipo declarado. Regras (`packages/shared/src/seguranca.ts`, testadas):
- **O tipo vem dos bytes**, nunca do nome nem do que o cliente diz (`detectarFormato`, que agora reconhece apng e webp animado). Lista **fechada**: png, jpg, gif, webp, mp3, ogg, wav, json.
  Nunca SVG, HTML, executável nem script. O formato tem de servir ao tipo do asset e **bater com o tipo que o remetente declarou** (`conferirArquivoRecebido`).
- **Quem recebe confere de novo**: o navegador que baixa (`finalizar`), o mestre ao guardar na pasta e ao trazer da pasta, a sala ao registrar (o `mime` da meta tem de estar na lista; `validarMeta`).
  Arquivo que não passa é recusado, não vai para o cache nem para o disco, e a lista mostra o motivo.
- **No disco o nome é montado pelo Távola** (`nomeDeArquivoNoDisco`): extensão do tipo detectado (nunca a do original), nome limpo (sem `..`, barras, controle, `:*?"<>|`, nomes
  reservados do Windows como `CON` e `NUL`, pontos ou espaços no fim; ponto dentro do nome vira hífen) e nenhuma extensão executável (`.exe`, `.bat`, `.cmd`, `.ps1`, `.lnk`, `.scr`, `.hta`, `.js`, `.vbs`, `.svg`, `.html`...).
  O nome da pessoa e o do tipo na pasta passam pela mesma limpeza.
- **Imagem de outra pessoa é decodificada e regravada** pelo navegador do mestre antes de ir para a pasta organizada (WebP gerado pelo próprio Távola): nada escondido no arquivo original
  (metadados, bytes depois do fim, script) sobrevive. Gif e apng animados ficam como estão, depois de conferida a assinatura (assumido).
- **Limites por tipo**, conferidos de novo por quem recebe (30 MB por arquivo, 4 MB por animação, 20 MB por som, 20 MB a imagem original, 2048 px a imagem solta).
- O arquivo cru continua em `arquivos-da-mesa/<hash>` (endereçado por hash, sem nome do remetente) só para outro navegador do mesmo computador; ele nunca é aberto nem executado pelo Távola.

**Paridade com o Claude** (regra do Q16): `arquivos` ganhou `listar` (todos os assets, com tipo, quem enviou e onde é usado), `usar`/`enviar` com `uso: "imagem"` (põe o arquivo na cena, por nome e em
quadrados: `x`, `y`, `camada`, `larguraQuadrados`), `ajustar` (move, estica, gira, esconde uma imagem solta, pelo nome), `renomear` e `apagar` (com `confirmar`). Só o mestre lista, renomeia e apaga.
`paridade.ts` e `paridadeCampos.ts` cobrem as intenções novas (`asset.restaurar` fica de fora como o desfazer da tela).

### 4.18 Gravação e transcrição (CH3, 2026-11-20)

O Vilella pediu "a opção do mestre gravar pro whisper". O plano: o mestre liga a gravação na chamada; todos veem o aviso e quem não quiser fica de fora; cada voz é gravada separada, no computador do mestre; depois da sessão o whisper.cpp (que ele instala) transcreve na placa de vídeo; sai um texto com horário, nome e fala, misturado com o que a mesa registra; o Claude, pelo MCP, lê esse texto e escreve o resumo como nota; o áudio é apagado depois, e só fica se ele quiser. Escolhido: o **whisper.cpp com um comando no terminal** (em vez de rodar no navegador). Instalação: `docs/WHISPER.md`.

**O que é gravado e onde**
- **Só a fala**, nunca a chamada inteira: para cada voz (a do próprio microfone do mestre e a de cada pessoa que chega pela chamada) um detector de fala por energia (os mesmos limiares do anel verde de "quem fala", em quadros de 20 ms) corta só os trechos com fala: 300 ms de folga antes e depois, no mínimo 0,5 s de fala, no máximo 30 s por trecho (o corte é forçado e a fala segue no trecho seguinte).
- Cada trecho é um **WAV de 16 kHz, mono, 16 bits** (o formato que o whisper.cpp lê sem ffmpeg), salvo na **pasta da mesa** do mestre (File System Access, a mesma do AS1): `gravacoes/<AAAA-MM-DD_HHhMM>/<pessoa>/<inicio-em-ms>.wav` (o início conta desde que a gravação começou). Os nomes de pasta passam por `trechoDeCaminhoSeguro` (dois nomes iguais ganham sufixo: `Ana`, `ana-2`); o nome do arquivo é só dígitos e `.wav`. A pasta `gravacoes/` não entra na biblioteca de sons nem na de imagens.
- Na pasta da gravação ficam também `gravacao.json` (o início em ms e em hora local, o fuso, as pessoas com id, nome, personagem e pasta, quem ficou de fora e quando, as entradas e saídas, e o fim se a gravação parou direito), `nomes.txt` (personagens, NPCs, cenas e nomes de token da mesa, para o `--prompt` do whisper) e `eventos.jsonl` (chat, rolagens, troca de cena do grupo e início e fim de combate, com o horário).
- **Escrita aos poucos**: cada trecho é gravado assim que fecha; `gravacao.json` e `eventos.jsonl` a cada 3 s. Uma queda perde no máximo o trecho em curso. **Nada roda no computador dos jogadores**: o navegador do mestre já recebe a voz de cada um pela chamada.

**Consentimento**
- **Ligar e desligar: só o mestre**, pelo botão "Gravar para transcrição" da barra de baixo da chamada. Antes de começar, uma confirmação curta diz o que é gravado, onde, quem fica sabendo e o que fazer depois; sem a pasta da mesa escolhida, ela pede para escolher (ou autorizar de novo). Parar é o mesmo botão. Sair da chamada, fechar a janela ou recarregar a página também para a gravação (o que já foi escrito fica salvo).
- **O aviso**: enquanto o mestre grava, **todo mundo na chamada** vê "● Gravando para transcrição" no topo da janela, e quem está na **tela de antes de entrar** também.
- **Ficar de fora**: cada pessoa tem "Não gravar a minha voz" (no aviso, antes ou depois de entrar). A escolha vai para a sala, o mestre vê quem ficou de fora, e a voz dela **não é escutada**: a captura dessa voz nem é ligada, e o trecho em curso é jogado fora. **Quem entra depois começa gravado, com o aviso, e pode sair da gravação**; quem marca "Não gravar" antes de entrar já entra de fora (o `chamada.entrar` leva `naoGravar`), então a voz nunca começa gravada contra a vontade. Sair e entrar de novo recomeça gravado.
- **No protocolo** (ver `docs/protocolo.md`): `chamada.gravar { ligada }` (capacidade `mesa.configurar`: só o mestre; a sala confere o papel pela conta, nunca pelo cliente) e `chamada.naoGravar { fora }` (cada um só muda a marca da própria conexão: não existe campo para apontar outra pessoa). O estado vai a todos em `chamada.quem`, nos `participantes` (`gravando`, `naoGravar`); a gravação existe enquanto o mestre está na chamada com `gravando`, então fechar o socket dele a encerra para todos. Efêmero como o resto da chamada: nada vai ao estado, ao banco, ao desfazer ou à exportação. Ligar a gravação é gesto da chamada e fica **fora do MCP** (`gesto ao vivo`).

**Transcrever**: `pnpm transcrever "<pasta da gravação>"` (script Node, sem dependência nativa, em `packages/shared/src/transcricao/`).
- A configuração vem de `WHISPER_EXE` e `WHISPER_MODELO` (ou `transcrever.config.json` na raiz, fora do git); sem ela, uma mensagem diz o que instalar e onde pôr.
- Para cada pessoa junta os trechos num WAV só, com 1 s de silêncio entre eles (um arquivo por pessoa é muito mais rápido que um por trecho: o whisper gasta o mesmo tempo num trecho curto e num de 30 s), guarda o **mapa de deslocamentos** e roda o `whisper-cli` com `-l pt`, saída JSON (`-oj`), `-pp` (progresso) e `--prompt` com os nomes. Leva os horários do JSON de volta à hora da sessão (início do trecho, o nome do arquivo, mais o quanto se andou dentro dele).
- Saída: `transcricao.json` (as falas: `hora`, `pessoa`, `personagem`, `texto`) e `transcricao.md`: a linha do tempo, **misturada com `eventos.jsonl`**, por exemplo `21:14  Ana (Thorin): Eu abro a porta devagar.`, `21:14  [rolagem] Thorin, Percepção: 17`, `21:15  Mestre: Do outro lado, um corredor úmido...`.
- No terminal: a pessoa, o trecho em andamento e o tempo que falta. Se o whisper falha numa pessoa, o script segue com as outras e diz no fim (código de saída 1).
- **Segurança**: o script só lê e escreve dentro da pasta da gravação (`estaDentroDe`), usa só pastas de pessoa que o próprio Távola nomeia, ignora trecho de quem estava de fora mesmo que o arquivo exista, e chama o executável **sem shell**, com os argumentos numa lista.

**Trazer para a mesa**: na aba **Mesa**, seção **Gravações da sessão** (só o mestre), a lista das gravações da pasta com o estado de cada uma (**gravada**, **transcrita**, **trazida**; vem dos arquivos que há na pasta). **Trazer a transcrição** cria uma **nota só do mestre** ("Sessão de 20/11 — transcrição"; uma sessão que passa dos 20 mil caracteres da nota vira "parte 1", "parte 2"...) na pasta Handouts (criada se faltar) e escreve `trazida.json`. Em seguida a mesa pergunta **"Apagar o áudio da gravação?"** (apagar é o padrão): só as pastas das pessoas saem; a transcrição, o `gravacao.json`, o `nomes.txt` e o `eventos.jsonl` sempre ficam. "Apagar o áudio" também existe a qualquer hora, por gravação.
- **MCP**: a nota é lida pelo `ler` (tipo handout, `completo`) e as instruções do servidor e a ferramenta `notas` dizem: para resumir uma sessão, leia a nota de transcrição e escreva o resumo como rascunho de nota (o que aconteceu, NPCs, pistas e pendências).

**Medidas** (ver `docs/ESTADO.md`): custo do desfoque, processador durante a gravação e MB por hora.

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
- **(Q7, 2026-11-16)** os cards têm todos o mesmo tamanho e ficam numa **grade que cresce para baixo**
  (até 3 linhas; depois, rolagem vertical no painel, sem rolagem horizontal). Campo **"Buscar cena…"** no
  alto (por nome, sem acento, por palavra e começo, com erro pequeno; o número do card é o da ordem real).
  **Botão direito no vazio** (ou Shift+F10 na grade) abre "Nova cena" e "Importar mapa". **Clicar fora do
  painel o fecha** (o botão da barra alterna; menus e diálogos dele não fecham). As barras de rolagem do app
  usam os tokens de tema `rolagemPolegar` e `rolagemTrilho`. Os cartões de magia e de característica no chat
  chegam com a descrição aberta (esconder é local).

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
  (V10, 2026-11-13: com um token selecionado, Delete o tira do mapa — mestre qualquer um, jogador o que controla, com "Desfazer" por ~6 s via `token.restaurar` — e as setas o andam um quadrado por `token.soltar`. A bandeira do ponto de chegada só aparece com a faixa de Cenas aberta.)
  (Q12, 2026-11-17: **sem aviso de parede e setas rápidas.** A recusa de um gesto de mover token cujo resultado já se vê (`trajeto_bloqueado`, `sem_permissao`, `token_inexistente` em `token.mover`, `token.soltar`, `tokens.mover`) não ganha aviso na tela; a sala recusa como antes. As setas andam o token na hora, a partir da posição pendente, com a mesma conta da sala (encaixe, limite da cena, parede), e segurar repete a 10 quadrados por segundo por um temporizador da tela; a sala confirma e, se recusar, o token volta. **Seguir meu token:** botão ao lado de "Centralizar o mapa" (e a tecla F) mantém o token escolhido no centro da tela; arrastar a vista ou centralizar desliga; o jogador com mais de um token escolhe numa lista; ligado e escolha ficam por mesa neste navegador. Só tela: sem campo, intenção nem migração.)
  (Q13, 2026-11-17: **segurar a seta, contínuo e em linha.** O token que anda por passo desliza em velocidade constante (um quadrado a cada 100 ms) e o relógio da tela é um `requestAnimationFrame`; o estado do React recebe os avisos de movimento a cada 300 ms enquanto o mapa os recebe na hora; erro de um passo só devolve os tokens daquele pedido. Só tela: sem campo, intenção nem migração.)
  (V12, 2026-11-13: **ping.** Segurar o botão esquerdo parado (~0,4 s) com Selecionar ou Mão, no fundo ou num token, ou apertar P, faz um círculo na cor do usuário que se abre até 2,5 quadrados em ~1,2 s, para todos que veem a cena. Shift (ou Shift+P) também leva a câmera de todos ao ponto, em ~0,4 s e sem mexer no zoom.)
  (V13, 2026-11-13: **régua.** Painel da ferramenta com "Grudar no grid" (por pessoa; Alt inverte). Livre mede em linha reta e mostra só a distância. Com o botão esquerdo segurado, o clique direito marca um ponto de virada; cada trecho tem seu rótulo e a ponta mostra o total; Backspace tira o último ponto; a fixa guarda os pontos. Continua só local. **Unidade:** Preferências escolhe Metros ou Pés (1 pé = 0,3 m, 1,5 m = 5 pés) para a régua, o resumo do raio de luz e o campo do quadrado da cena; o estado e as fichas continuam em metros.)
  (V14, 2026-11-13: **menus.** O tipo de parede é uma lista com ícone, nome, dica e amostra do traço. Mesa → Campanha tem os blocos Exportar e Importar; o arquivo escolhido mostra o nome e o resumo (cenas, fichas, tokens) e só "Importar e substituir" troca a mesa. A lista de atalhos abre "Os mais usados" e recolhe o resto. Os rótulos da régua ficam dentro da área do mapa. Os campos de raio (luz, visão, alcance) seguem a unidade escolhida; o estado continua em metros.)
  (V10b, 2026-11-13: **quem põe token no mapa.** O mestre, onde quiser (`personagem.colocar`, `token.criar`). O jogador põe o token do personagem que controla, na cena do grupo, **só na área da bandeira** (círculo de 3 quadrados de raio em volta do ponto de chegada) e só se esse personagem ainda não tem token nessa cena: pelo botão "Colocar no mapa" (lista de Fichas e cabeçalho da ficha) ou arrastando a ficha para o mapa (a área se acende). Intenção `token.colocarMeu`, capacidade `token.colocarProprio` (ligada por padrão, em Permissões). O jogador vê a bandeira quando não tem token dele na cena; só o mestre a arrasta. A sala confere tudo e tira os campos do token da ficha.)
  (Q8, 2026-11-16: **um token do personagem por cena.** Ter token em outra cena não impede: `personagem.colocar` e `token.colocarMeu` só recusam o segundo token do mesmo personagem de jogador **na mesma cena**. O jogador vai **sempre para a bandeira**: o ponto que ele manda é ignorado e a sala arruma o token no grid ao lado dos que já estão lá (sem o erro "perto da bandeira"). O mestre põe onde quiser. `grupo.moverPara` leva os tokens de personagens de jogador da cena ativa, **menos** os de quem já tem token na cena de destino (fica o do destino; o da origem fica na origem). As buscas do token do personagem usam a cena em questão. Sem migração.)
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
- **Luz e fogo (FG1, 2026-11-20).**
  - **Modelo ao vivo:** editar o modelo (nome, luz, cor, tremular, duração, ocupa a mão, etiquetas, tamanho e animações da chama) muda na hora todos os objetos dele, nas mãos, mochilas, suportes, pontos e mapa, para todos. Fica com o objeto: aceso, tempo que resta (limitado à duração nova), portador, intensidade, modificadores, histórico e o tamanho próprio do inflamável. Modificadores de automação e de zona continuam por cima.
  - **Soltar a tocha:** o suporte ou inflamável mais próximo dentro de 1 célula de raio (mínimo ~40 px na tela) pega a tocha arrastada, com destaque do alvo; o ícone continua pequeno.
  - **No lugar do ícone:** o objeto num ponto é desenhado no centro do ponto, no lugar do ícone (que some e volta); ícones, tochas e chamas têm tamanho de mundo (em metros e células) e escalam com o zoom; relógio e rótulos têm tamanho de tela e somem abaixo de 70% de zoom.
  - **Chama animada:** inflamável aceso e tocha num ponto mostram fogo animado (visto de cima), por estágio (forte, fraca, morrendo), nunca o símbolo da tocha; as animações padrão (tocha e fogueira) são geradas por código; o mestre escolhe, por estágio, um gif, webp animado ou apng próprio (asset `animacao`). "Reduzir movimento": a chama fica parada.
  - **Tamanho da chama:** o mestre estica a chama do inflamável por alças no mapa e por campos (largura e altura, em metros), antes e depois de acender; o modelo tem o tamanho padrão. A luz (raios) continua a do modelo ("luz acompanha o tamanho" fica em `docs/IDEIAS.md`).
  - **Equipamento do jogador:** capacidade `equipamento.dar` (padrão ligada): o jogador dá e tira equipamento de modelo (e acende) nos personagens que controla; o mestre pode desligá-la. Nunca no personagem de outro.
- **Fogo melhor, tocha na mão e cor para o mestre (FG2, 2026-11-20).** Só de tela: nenhum campo, intenção, protocolo ou migração novo (o MCP e a trava `paridadeCampos` não mudam).
  - **A fogueira é um fogo só.** Gerada por código (`chamas.ts`, `montarQuadro`): base larga e brilhante (cama de brasas), línguas que se sobrepõem no corpo, brasas que sobem por dentro e um núcleo mais claro. Sem lenha, gravetos nem pedras: isso é item da camada de mapa. Esticada, continua uma massa (cada língua cobre mais que o espaço até a vizinha); vale para palha, barril e qualquer inflamável aceso.
  - **A tocha não se divide.** Um corpo e duas ou três línguas coladas nele balançam juntas (o vento é um só). Em todo quadro e estágio a silhueta (alfa acima do limiar) é **uma região conexa**; os testes conferem na geometria e nos pixels reais.
  - **A tocha na mão tem os 3 estágios.** No pino do token, a fonte com fogo (a que tremula: tocha; a lanterna não) é uma chama animada pequena, forte, fraca ou morrendo como a do mapa, com a animação própria do estágio se o modelo tiver uma. Apagada ou sem fogo, o pino mantém o ícone. O estágio vem do objeto (mestre) ou do tempo restante e da configuração dos estágios (jogador no tempo exato). "Reduzir movimento" a deixa no primeiro quadro.
  - **O mestre vê a luz como o jogador.** Na Visão do mestre a luz tem a mesma cor e o mesmo alcance que o jogador vê, onde algum jogador enxerga; onde nenhum jogador vê, o mapa continua apagado como antes, mas com a cor e o alcance de **toda** luz por cima (com as paredes), haja jogador vendo ou não; sem luz nem jogador, o mapa apagado (nunca preto). Sem a tremulação (refazer a luz de dezenas de chamas a cada instante só para o mestre custava o dobro). A Visão do mestre vale também com a cena sem jogador. A visão no escuro de um jogador não lava a cor para o mestre (soma meia luz só onde nenhuma luz chega).
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
- **Alça da tocha:** uma marca pequena no canto superior do token, uma por mão (1ª: canto superior direito; 2ª: superior
  esquerdo; com o anel fino do tempo que falta, e o tempo exato na dica e no menu da tocha) (V11, 2026-11-13). Arrastar a alça:
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
  uso não pode ser apagado e ~~editar um modelo não muda os objetos já criados~~ (FG1, 2026-11-20: editar o modelo muda, na hora, todos os objetos dele; o que é de cada objeto fica);
- pendência pequena: a tocha na mão só chega ao jogador se o token do personagem estiver na cena ativa;
  quem edita o personagem deveria vê-la na mochila mesmo assim (corrigir no Lote 9, junto da ficha).

---

### Lote 7b — Automações da mesa (G) — entregue (7b-1, 7b-2 e 7b-3, 2026-11-13)

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

**Divisão em três lotes (2026-11-13), cada um com o seu `pnpm verify`:**
- **7b-1, o motor** (entregue em 2026-11-13; o desenho final está na 4.11):
  - os schemas de ciclo, evento, reação, ação, condição e modificador com prazo;
  - as automações guardadas na campanha;
  - as fases dos ciclos no agendador e os eventos do sistema;
  - as ações da lista fechada (menos `som.tocar`, que entrou no N5, e a zona);
  - o sorteio pela semente da sala, o limite de encadeamento e o escopo por cena;
  - pausar a mesa pausa os ciclos;
  - nada de automação chega ao jogador;
  - exportar e importar levam tudo.
- **7b-2, as zonas** (entregue em 2026-11-13; o desenho final está na 4.11):
  - polígonos por cena, desenhados pelo mestre;
  - efeitos enquanto algo está dentro;
  - os eventos `token.entrouNaZona` e `token.saiuDaZona`, e a ação `zona.ativar`;
  - nada da zona chega ao jogador, só o efeito.
- **7b-3, o editor e as campanhas** (entregue em 2026-11-13; o desenho final está na 4.11):
  - o painel de automações do mestre (formulário e o JSON ao lado);
  - botões de ciclo e de evento fixáveis na barra, que podem ser liberados aos jogadores;
  - as campanhas `chama-primordial.json` e `5e-padrao.json`.

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
  iniciativa" e "Condições…"; marcadores na borda do token, com a regra na dica (V11, 2026-11-13: ícones do lucide, no máximo 4 e um "+N", no lugar das duas letras);
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

**Revisto em 2026-11-13** (seção 4.12): o MCP é de todos, com o token de cada usuário e as capacidades dele.
O papel `assistente` deixa de existir. Divisão em dois lotes:
- **12-1, o acesso do Claude** (sala e web):
  - token por usuário em Preferências: gerar, ver uma vez, listar e revogar;
  - a conexão do Claude, com a lista de proibidos e um limite de frequência;
  - a capacidade "Criar fichas e notas próprias", com teto de 20 de cada;
  - os rascunhos do mestre, com Publicar e Descartar;
  - o "Desfazer tudo o que o Claude fez";
  - a marca "pelo Claude" no chat.
- **12-2, o servidor MCP** (`apps/mcp`):
  - poucas ferramentas, com nomes em vez de ids: panorama, ler, fichas, compêndio, notas, objetos, cenas,
    automações, rolar, rascunhos e desfazer;
  - cada usuário só vê as ferramentas que pode usar;
  - as instruções para o Claude Code e o Desktop;
  - um E2E com o mestre e o jogador, cada um com o próprio token.

**Pronto quando:** `pnpm verify` verde.

**12-1 entregue (2026-11-13)**, aguardando o roteiro manual: o lado da sala e da web, como descrito em 4.12 ("12-1: como ficou"). O **12-2** (o servidor MCP em `apps/mcp`) constrói em cima disto (ver `docs/protocolo.md`, "O acesso do Claude").

**12-2 entregue (2026-11-13)**, aguardando o roteiro manual: o servidor MCP, como descrito em 4.12 ("12-2: como ficou"), as instruções em `docs/MCP.md` e o texto final de "Conectar o Claude". **O Lote 12 está entregue** (12-1 e 12-2); o roteiro manual (o Claude monta uma cena da campanha de referência e o mestre revisa o rascunho; o jogador cria o personagem) está em `docs/ROTEIRO-DE-TESTES.md`, "12-2".

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
- **Conjurar com espaço maior (V6, 2026-11-12).** O Conjurar de magia de nível 1 ou mais pergunta o espaço (menu preso ao botão: um item por nível de espaço com restante, do nível da magia ao 9º, mais o de pacto, que sobe sempre para o nível do pacto; truque não pergunta; sem opção, avisa "Sem espaços de Nº nível ou maior para X."). `Magia.porNivelAcima?` (expressão de dados somada por nível de espaço acima do da magia; "1d6", "1d4+1") vem de `porNivelAcimaDoTexto(emNiveisSuperiores)` ao trazer a magia do compêndio e, ao conjurar, do compêndio ou da própria descrição quando o campo está vazio. Intenções: `chat.modelo` (ataque), `chat.enviar` (só num `/r`) e `chat.magia` ganharam `espaco?: { nivel, extra?, metade? }` (`extra` já multiplicado pelos níveis acima: "2d6"); sem capacidade nova. A sala rola o extra e a `Mensagem` ganha `espaco?: { nivel, extra?: { expressao, rolagem, total, metade? } }`: o chat desenha um segundo bloco **colado** embaixo do cartão da rolagem, na **mesma mensagem** (num crítico os dados extras dobram, como os do dano). Sem `extra`, o cartão diz "com espaço de Nº". Mensagem antiga (sem o campo) aparece igual. O ícone "Mandar ao chat" ao lado do Conjurar manda o cartão da magia sem gastar espaço nem rolar.
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
