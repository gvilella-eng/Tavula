# Redesign e branding

Começou em 2026-11-10, depois dos Lotes 10, 11, 13 e 14. Pedido do Vilella: deixar tudo "bonito, usável e
mega intuitivo". Processo escolhido: **protótipo antes do código**: levantamento de usabilidade tela a tela,
protótipo visual aprovado, depois implementação em lotes com testes.

Protótipos (página privada no claude.ai): https://claude.ai/artifact/VuLaqV3CFUN2H4fMc97QCz

## Decidido (2026-11-10)

- **Nome: Távola** (escolhido pelo Vilella entre Lume e Távola). Símbolo: uma mesa redonda vista de cima,
  com os lugares em volta e uma chama no centro (o "lume" fica no símbolo). Em código, pastas e endereços
  sem acento: `tavola`. Entra no logo, no título da aba e na tela de entrada.
- **Identidade: Grimório** (direção A): tons escuros quentes e latão/amarelo. É a identidade principal do
  projeto e o tema padrão.
- **Carvão (2026-11-10):** as barras e janelas do Grimório trocaram o couro marrom pelo **carvão** (preto e cinza
  puros: barra `#1B1B1B`, corpo das janelas `#252525`, fundo `#0C0C0C`); o latão continua como destaque. O nome
  segue "Grimório"; Escuro neutro e Claro não mudaram. O protótipo com as 9 opções está no mesmo artifact
  (opção 9).
- **Mais contraste** entre as barras fixas e o mapa: as barras (couro) bem mais claras e quentes que o fundo
  da mesa (carvão); carvão e couro não podem parecer a mesma cor.
- **Fontes:** Space Grotesk (títulos, logo, números grandes) + Inter (interface). Empacotadas no app
  (pacotes `@fontsource` pelo pnpm), **nunca** carregadas da internet em execução. Alternativas na mesma
  pegada, se precisar: Sora, Bricolage Grotesque, Manrope.
- **Barras fixas** (topo, ferramentas à esquerda, painel à direita); o mapa ocupa o meio. Topo com **48 px**
  de altura e barra de ferramentas com **52 px** de largura.
- **Painel lateral direito** é uma coluna à parte, **de cima a baixo** (o topo termina onde ele começa), com
  fundo próprio (leve degradê no alto), filete na cor de destaque do tema na borda esquerda e sombra sobre o
  mapa. **Largura ajustável por cada usuário** arrastando a borda esquerda: mínimo de 300 px (o suficiente
  para nada quebrar) e máximo de 1/4 da largura da tela; guardada no navegador de cada um.
- **Janelas flutuantes** (ordem de turno, ficha, painéis de luz etc.): arrastáveis para qualquer lugar pelo
  cabeçalho, com a posição **de cada usuário** (x e y por pessoa, guardados no navegador dele, nunca na
  sala); **dois cliques no cabeçalho minimizam** (vira só a barra do título) e dois cliques restauram.
- **Temas de cor**, escolhidos por cada usuário (preferência local): **Grimório** (padrão), **Escuro
  neutro** (cinzas frios e azul discreto, um escuro "comum") e **Claro**. Os temas mudam **só as cores**:
  disposição e fontes são as mesmas. O mapa da cena não muda com o tema.
- **Os 3 temas viraram 11 (2026-11-10, pedido do Vilella):** todas as paletas do protótipo, com nomes de RPG e
  um seletor de bolinhas como o de temas do Chrome. Grimório (padrão, carvão), Taverna (o marrom antigo),
  Forja (grafite), Licantropo (ardósia), Paladino (azul-noite), Druida (floresta), Leviatã (petróleo),
  Vampiro (vinho), Arcana (ameixa), Edgerunner (o escuro neutro) e Pergaminho (o claro). Os ids `grimorio`,
  `escuro` e `claro` continuam (quem já escolheu um deles fica nele). Detalhes em "R2b — como ficou".
- **A mesa pausa sozinha quando o último mestre sai** (2026-11-10): ver `PROJETO.md` e "R2b — como ficou".

## Levantamento de usabilidade (2026-11-10)

Base: 108 prints de todas as telas (mestre e jogador, 1600×900 e 1280×720), gerados por
`e2e/prints/auditoria.spec.ts`, mais as anotações de quem montou o roteiro pela interface. Prioridade:
**A** = atrapalha o jogo ou esconde função; **B** = confunde ou dá trabalho; **C** = acabamento.

### Estrutura e navegação
1. **(A)** Não há estrutura fixa: o menu superior, as ferramentas e o painel flutuam sobre o mapa, e cada
   painel (ordem de turno, token, paredes, iluminação, dados) abre num lugar diferente, cobrindo o mapa e o
   zoom. Em 1280×720 a ordem de turno e a ficha tomam quase a tela toda.
2. **(A)** Ícones sem nome no menu superior, e alguns enganam: o "copo" abre Iluminação (com Paredes dentro),
   a lua liga a visão noturna e o **clique direito** nela (sem nenhuma pista) abre o "ver como"; o raio é
   "Eventos (em breve)", que ainda não existe.
3. **(B)** As abas do painel direito são só ícones numa trilha vertical; o nome da aba só aparece depois de
   abrir.
4. **(A)** Coisas no lugar errado: as Notas ficam dentro de Fichas; Configurações mistura preferência pessoal
   (encaixe no grid) com regras da mesa (mãos, penalidade, alcance, estágios) e com os modelos de tocha; a aba
   Mestre mistura papéis, grid da cena, capacidades e "uso de hoje: 0,027%" (ruído técnico).
5. **(A)** Paredes ficam escondidas: copo → "Paredes e portas" → tipo → cliques; nada mostra que o modo
   paredes está ligado.
6. **(B)** Os modelos de tocha só aparecem rolando Configurações.

### Mapa e tokens
7. **(B)** "+" cria na hora um "Novo token" verde no meio da vista, sem perguntar nome nem lugar.
8. **(B)** Esc não solta a seleção; o painel do token fica no canto, cobrindo o mapa.
9. **(A)** A tocha só se controla por gestos que nada explica (dois cliques apagam, botão direito abre o
   menu); a alça e o tempo (59:52) são pequenos.
10. **(B)** Condições: botão direito → "Condições…" → marcar → "Fechar"; os marcadores no token são
    pequenos e a regra só aparece passando o mouse.
11. **(C)** A régua some ao soltar; não dá para deixar uma medida na tela.
12. **(B)** O aviso (toast) aparece no rodapé, longe do que foi clicado, e some rápido.
13. **(A)** Jogador sem token na cena vê a tela toda preta, sem nenhuma explicação.

### Combate
14. **(B)** A ordem de turno do mestre tem cinco linhas de controles e campos de número que reordenam a lista
    enquanto se digita (fácil errar o valor); "Rolar para todos" fica cinza sem dizer por quê.

### Fichas, chat e compêndio
15. **(B)** Abrir a ficha exige dois cliques no item, sem dica.
16. **(B)** A janela da ficha é grande e fixa; em tela pequena cobre o painel e quase todo o mapa.
17. **(B)** A lista de presença ocupa 1/4 do painel do chat (8 pessoas em 4 linhas).
18. **(B)** Compêndio: para montar, o mestre lê uma ajuda de JSON; não há "usar o exemplo".
19. **(C)** Importar PDF tem dois caminhos com nomes diferentes; a revisão é longa (19 campos amarelos).

### Primeira impressão e estado da mesa
20. **(B)** A tela de entrada não tem marca nem personalidade ("Tabletop", lista simples com bordas
    coloridas).
21. **(B)** Pausa pouco visível: o botão e o relógio parecem iguais pausado e rodando; só um selo no meio do
    mapa diferencia.
22. **(C)** Nenhum atalho de teclado aparece nas dicas.

## Plano de lotes do redesign (proposta)

Cada lote termina como os anteriores: `pnpm verify` verde numa rodada (com `--repeat-each=3` nos E2E novos;
esquema de 2026-11-10), prints nos **3 temas**, revisão e commit. Nada muda nas regras do jogo nem no protocolo, salvo onde dito.

- **R1. Fundação visual e marca.** Tokens de cor em variáveis CSS com os 3 temas (Grimório, Escuro neutro,
  Claro) e troca por usuário; fontes empacotadas (Space Grotesk + Inter via `@fontsource`); todas as cores
  fixas do `styles.css` passam a usar os tokens; marca Távola (logo SVG, favicon, título da aba) e a tela de
  entrada nova. Resolve 20.
- **R2. Estrutura fixa.** Topo de 48 px, ferramentas de 52 px, painel direito como coluna de cima a baixo
  com abas nomeadas e largura ajustável (300 px a 1/4 da tela, por usuário); zoom fixo no canto do mapa;
  presença como avatares no topo; pausa e relógio claros no topo; "centralizar" passa a considerar só a área
  visível do mapa. Resolve 1, 3, 17, 21.
- **R3. Janelas flutuantes.** Um componente único de janela: arrastar pelo cabeçalho, posição e tamanho por
  usuário, dois cliques minimizam, fechar, sempre dentro da tela, a última clicada fica por cima. Passam a
  usá-lo: ordem de turno, ficha, token, paredes, fontes de luz, iluminação, dados rápidos. Resolve 8 (parte),
  14 (parte), 16.
- **R4. Organização do mestre.** Menu superior agrupado e com nomes nas dicas (Cenas, Camadas, Luz,
  Combate, "Ver como" explícito); Paredes vira ferramenta da barra esquerda (só do mestre) com o modo
  visível; "Eventos" sai até o 7b; Configurações separadas em **Preferências** (pessoais: tema, encaixe,
  painel) e **Mesa** (regras, modelos de luz, papéis, permissões); Notas viram aba própria; o grid vai para a
  configuração da cena; o "uso de hoje" vai para um canto de diagnóstico. Resolve 2, 4, 5, 6.
- **R5. Interações e fluxos.** Esc solta a seleção; criar token pede nome e lugar (ou arrasta da ficha);
  tocha com dica e ações no menu do token; condições com menos cliques; régua que pode ficar na tela; avisos
  perto do clique; ordem de turno compacta, com o valor confirmado no Enter; ficha abre com um clique;
  estados vazios que orientam (jogador sem token, compêndio com "usar o exemplo do SRD"). Resolve 7, 8 (parte),
  9–15, 18, 19.
- **R6. Polimento.** Tela pequena (1280×720), foco e contraste, atalhos de teclado nas dicas, transições
  discretas, revisão final de todos os prints nos 3 temas. Resolve 22 e o que sobrar.

## R1 — como ficou (2026-11-10)

Fundação visual e marca. Nada mudou na disposição da tela, nas regras nem no protocolo (nenhum frame novo; a
sala não foi tocada).

**O que foi feito**
- **Temas de cor** (só cores): Grimório (padrão), Escuro neutro e Claro, em `apps/web/src/tema/temas.ts`, a
  **única fonte** dos tokens (as mesmas chaves nos 3 temas). `aplicarTema` grava as variáveis CSS e
  `data-tema` no `documentElement`; roda em `main.tsx` antes da primeira renderização. Para não piscar o
  tema errado, o `index.html` define `data-tema` por um script curto e já pinta o fundo da página (3 cores
  duplicadas de propósito; um teste de unidade confere que são iguais às do `temas.ts`).
- **Preferência do navegador**: chave `tabletop:pref:tema` no localStorage (com try/catch), nunca na sala.
  Seletor com amostras na aba Configurações, em "Preferências deste navegador" (`SeletorDeTema.tsx`).
- **Cores fixas trocadas por tokens** no `styles.css` (de ~45 cores escritas à mão sobraram só as de
  conteúdo: texto branco sobre a cor do usuário no avatar, o contorno do ponto da ordem de turno, a sigla das
  condições e a roda de cores do pincel). `--painel-2` virou `--cabecalho`; `--fundo` agora é só o fundo da
  página; campos e áreas rebaixadas usam `--campo`; as três barras fixas (menu superior, ferramentas e painel
  lateral) usam `--barra` e `--borda-barra` (o "couro" mais claro que o fundo da mesa); o verde, o amarelo e o
  roxo de estado ganharam tokens (`--sucesso`, `--aviso`, `--oculta`). Texto em destaque (antes
  `color: var(--acento)`) passou a `--acento-forte`, que garante contraste nos 3 temas. O mapa (PixiJS) e as
  cores de conteúdo (usuário, token, pincel, condições) **não** mudam com o tema.
- **Contraste AA** (4,5:1) conferido por teste de unidade nos pares de texto e fundo de cada tema.
- **Fontes empacotadas**: `@fontsource-variable/space-grotesk` (títulos, logo, número grande da rolagem) e
  `@fontsource-variable/inter` (interface), importadas em `main.tsx`. Nenhuma requisição a outro host (um
  E2E vigia todas as requisições do navegador).
- **Marca Távola**: `Logo.tsx` (símbolo SVG `viewBox 24`, traço em `--acento`, mais grosso nos tamanhos
  pequenos, e o nome em Space Grotesk 700), favicon em `apps/web/public/favicon.svg`, título da aba "Távola"
  e, com a mesa aberta, "Távola · nome da cena do grupo". O nome visível "Tabletop" saiu da interface (só
  havia a tela de entrada e o `<title>`); identificadores técnicos ficaram como estão.
- **Tela de entrada nova**: logo grande, "Quem senta à mesa hoje?", cartões com avatar (iniciais na cor do
  usuário), nome e selo "Mestre", sem a borda colorida lateral; segue o tema do navegador.

**Decisões (assumido)**
- (assumido) O selo "Mestre" vale para o usuário de id `mestre`: `/api/usuarios` não manda o papel e o lote
  não mexe na sala. Se o mestre passar o papel a outra pessoa, o selo continua no mesmo cartão.
- (assumido) `color-scheme` do `<html>` acompanha o tema (claro ou escuro).
- (assumido) `perigoFundo`, `avisoFundo` e `sobreposicao` são tokens por tema; o véu sobre o mapa (`--veu`)
  também muda com o tema porque carrega texto do tema.
- (assumido) O fundo da mesa (`--fundo-mesa`) só aparece antes do canvas subir; o PixiJS pinta o seu próprio
  fundo, igual em qualquer tema.
- (assumido) No Claro, `--acento` (#E2AE4F) é só preenchimento; texto e ícone em destaque usam
  `--acento-forte` (#8A5D10).
- (assumido) O perigo do Claro ficou #A83A15 (o #B9461F do protótipo dava 4,46:1 sobre o fundo da página,
  abaixo de AA). Tokens que o protótipo não trazia (sucesso, aviso, roxo, véus, sombra) foram criados por mim.

**O que ficou para depois**
- A disposição das barras, o painel direito e as janelas (R2 em diante).
- O papel do usuário na tela de entrada (a sala precisaria devolvê-lo em `/api/usuarios`).
- Um passe fino de contraste no avatar (texto branco sobre cores claras de usuário, como o amarelo do
  mestre) e nos rótulos desenhados dentro do mapa: são conteúdo, ficam para o R6.

## R2 — como ficou (2026-11-10)

Estrutura fixa. Nada mudou nas regras, na sala, no protocolo nem na exportação (nenhum frame novo; a
largura do painel é preferência do navegador).

**O que foi feito**
- **Quatro regiões fixas** na Mesa (CSS grid em `.mesa`): **topo de 48 px** (do canto esquerdo até onde o
  painel começa), **barra de ferramentas de 52 px** (abaixo do topo, até o fim da tela), **painel direito de
  cima a baixo** e, no meio, a **área do mapa** (`.area-mapa`, `data-area-do-mapa`), que ocupa só o que
  sobra. O canvas do PixiJS tem o tamanho da área: o `MapaPixi` ganhou um `ResizeObserver` no elemento (o
  Pixi só reage ao resize da janela; ajustar ou recolher o painel também muda a área).
- **Topo** (`Topo.tsx`): símbolo e nome Távola pequenos (`Logo.tsx`) e o nome da cena do grupo à esquerda; os
  menus do mestre (`MenuSuperior`, **como estavam**, sem reagrupar) no meio; presença e estado da mesa à
  direita.
- **Presença no topo** (item 17, `PresencaNoTopo.tsx`): avatares com dica de nome, papel e estado; offline
  esmaecido. A lista saiu do chat, que ficou com todo o espaço. Os `data-testid` `presenca`, `presenca-<id>`
  e `presenca-estado-<id>` foram mantidos.
- **Pausa e relógio claros** (item 21, `EstadoDaMesa.tsx`): um **controle só** no topo, à direita. **Mestre,
  rodando:** um botão com ⏸ e o relógio da sala dentro dele (dica "Pausar a mesa (congela o tempo das tochas)").
  **Mestre, pausada:** uma pílula na cor de aviso "▶ 20:04:12", em que o clique retoma (dica
  "Retomar a mesa (o tempo volta a correr)"). **Jogador:** só o ícone ⏸ na pílula amarela, sem clique, com a dica
  "O mestre pausou a mesa: o tempo das tochas está parado". **Sem a palavra "Pausada" na tela** (o ícone e o
  amarelo bastam; o nome "Mesa pausada" fica no `aria-label`). A faixa "Mesa pausada" do meio do mapa **saiu**.
  **O relógio é o tempo da sala** (o tempo de jogo que as tochas consomem; para na pausa) e **só o mestre o
  vê**: a sala manda 0 ao jogador. Ficam os `data-testid` `menu-pausa`, `relogio-sala`, `estado-mesa` e
  `estado-mesa-selo`.
- **Barra de ferramentas** (52 px): as mesmas ferramentas, o mesmo comportamento. A **sub-barra do pincel**
  e a **grade de dados** abrem ao lado da barra, sobre o mapa. O botão do pincel agora fica na barra
  (apertado enquanto o pincel está ativo; apertar de novo volta a selecionar).
- **Painel direito** (`BarraLateral.tsx`): fundo `--barra` com leve degradê no alto (`--acento-suave`)
  e sombra sobre o mapa. **Sem o filete amarelo na borda esquerda** (o Vilella tirou; o degradê e a sombra ficaram). **Largura ajustável** pela alça da borda esquerda
  (`role="separator"`, `aria-label="Ajustar a largura do painel"`): arrasto com o mouse e teclado (setas
  alargam e estreitam 16 px, com Shift 64, Home vai ao mínimo e End ao máximo). Mínimo 300 px, máximo 1/4 da
  janela (se 1/4 for menos que 300, 300). Guardada por navegador em `tabletop:pref:larguraDoPainel` e
  reajustada quando a janela muda. **Abas com ícone e nome** (item 3), em fila com quebra de linha se faltar
  espaço; legíveis em 300 px. Recolher continua: o painel vira uma trilha de 52 px só de ícones e o mapa ganha
  o resto.
- **Zoom** (`ZoomFlutuante.tsx`) no canto inferior direito da área do mapa, na horizontal (menos, trilho, mais,
  nível e centralizar); nunca embaixo do painel.
- **"Centralizar"** (mapa e token) já usava as medidas do elemento do mapa: com o canvas do tamanho da área,
  considera só a área visível, com o painel em qualquer largura (E2E confere).
- **Tudo o que abre sobre o mapa** ficou dentro da área: ordem de turno, painel do token, faixa de cenas,
  paredes, iluminação, fontes de luz, a janela da ficha (agora `position: absolute` dentro da área; as
  coordenadas dela são da área), os menus do botão direito e as dicas (`area.ts` prende ao retângulo da área).
  Os painéis que abriam em `top: 74px; left: 76px` agora usam `--respiro-topo` (12 px).

**Decisões (assumido)**
- (assumido) Painel **recolhido** = trilha de 52 px com os ícones das abas (sem os nomes) e o botão de abrir;
  assim as abas continuam a um clique e o selo de não lidas do chat continua visível.
- (assumido) Largura padrão do painel: 360 px, ajustada ao máximo da janela (320 px em 1280). A **escolha** da
  pessoa fica guardada intacta: se a janela encolhe, o painel se ajusta, e ao crescer volta ao que ela escolheu.
- (assumido) Presença com mais de 6 pessoas: aparecem os 5 que estão online primeiro (os offline só se sobrar
  vaga), na ordem da sala, mais um botão "+N" que abre a lista dos outros. O estado de cada um continua
  no DOM para leitores de tela.
- (assumido) O jogador vê no topo só o ícone de pausa na pílula amarela; o relógio da sala continua só do mestre (a sala manda 0
  ao jogador).
- (assumido) O degradê do painel direito virou três tokens por tema (`painelTopo`, `painelMeio`, `painelFim`; no Grimório `#202020` → `#181818` aos 160 px → `#151515`, os mesmos coeficientes de antes sobre a barra nova) e entrou no teste de contraste.
- (assumido) `perigoFundo` `#4A2323` e `avisoFundo` `#3A3622` no Grimório (sem o tom marrom, com contraste AA).
- (assumido) Janelas e popups (ordem de turno, painel do token, paredes, luz, dados, menus com cabeçalho e a janela da ficha): cabeçalho na cor da barra fixa (`--barra`) e corpo em `--painel`, um pouco mais claro (pedido do Vilella; tudo por tokens, porque a paleta vai mudar).
- (assumido) A faixa "Mesa pausada" do meio do mapa saiu: a pílula no topo basta (pedido do Vilella depois de ver a tela, que achou os 4 sinais redundantes).
- (assumido) Zoom na horizontal, em vez de vertical, para não brigar com a ordem de turno (também no alto
  à direita da área).
- (assumido) O "ver como" ("Vendo como X") foi para o centro, embaixo da área do mapa, para não cruzar com a
  faixa de cenas.
- (assumido) A sub-barra do pincel abre ao lado da barra (que continua à vista), e não no lugar dela.
- (assumido) O botão de recolher o painel fica no canto direito do título da aba aberta (ou no alto da trilha,
  recolhido).
- (assumido) O `aviso` (toast) e o selo de conexão ficam centrados na área do mapa.

**O que ficou para depois**
- Arrastar as janelas e a posição por usuário (R3). Hoje a ficha abre e arrasta dentro da área e é cortada pelas
  bordas dela; o resto abre em lugar fixo.
- Agrupar e dar nomes aos menus do topo (R4).
- Telas menores que 1280×720, foco, contraste fino e atalhos nas dicas (R6).
- Ao mudar o tamanho da área, a vista do mapa não é recentralizada (continua ancorada no canto superior esquerdo).

## R2b — como ficou (2026-11-10)

Dois pedaços independentes: a pausa automática (muda a sala, autorizado) e os 11 temas de cor.

**O que foi feito**
- **A mesa pausa sozinha quando o último mestre sai.** Lógica pura `pausarSeSemMestre` no shared; o Durable
  Object a chama pelo vencimento `mestre.ausente` do agendador, 5 s depois que o último socket de mestre
  cai, se nenhum mestre voltou. O evento é o mesmo da pausa manual (`mesa.pausada`), com o tempo da sala **da
  hora da saída**. Mestre a mais saindo com outro conectado, jogador saindo e mesa já pausada: nada. Retomar
  é do mestre. Ao acordar sem mestre conectado (processo reiniciado) e com a mesa rodando, pausa na hora.
  Protocolo atualizado (`docs/protocolo.md`, "Pausa automática").
- **11 temas de cor** (antes 3), com ids e nomes: `grimorio` Grimório (padrão, carvão), `taverna` Taverna
  (o marrom antigo do Grimório), `forja` Forja (grafite), `licantropo` Licantropo (ardósia), `paladino`
  Paladino (azul-noite), `druida` Druida (floresta), `leviata` Leviatã (petróleo), `vampiro` Vampiro
  (vinho), `arcana` Arcana (ameixa), `escuro` **Edgerunner** (o escuro neutro de acento azul) e `claro`
  **Pergaminho**. Os ids antigos ficam: quem tinha `escuro` ou `claro` guardado continua nele; só os nomes
  mostrados mudaram. Os temas continuam mudando **só as cores**.
- **Seletor de bolinhas** (Configurações, "Preferências deste navegador", "Tema de cor"): grade de bolinhas
  como os temas do Chrome. Cada uma tem a metade de cima na cor da barra, o destaque embaixo à esquerda e o
  corpo das janelas embaixo à direita; o escolhido leva um selo de check; o nome aparece embaixo e na dica.
  É um `role="radiogroup"` de botões de rádio nativos (as setas andam pelos temas). A grade se reparte em
  colunas e cabe nos 300 px do painel sem rolar de lado. `data-testid` `seletor-de-tema` e `tema-<id>` mantidos.
- `index.html`: o fundo anterior ao JS vale para os 11 (o teste de unidade confere todos).

**Decisões (assumido)**
- (assumido) A pausa automática espera **5 s** depois da saída antes de pausar (constante `ESPERA_DA_PAUSA_MS`).
  Sem a espera, recarregar a página, ou o React em desenvolvimento, que abre a conexão duas vezes, pausava a
  mesa a cada entrada do mestre. O tempo da sala congelado é o da saída, não o da espera.
- (assumido) Só a saída de uma conexão **de mestre** dispara a pausa (jogador saindo nunca pausa).
- (assumido) Ao acordar sem mestre conectado e com a mesa rodando, pausa na hora. O tempo que a sala ficou
  fora do ar conta como tempo de mesa rodando (não há como saber quando o último mestre saiu).
- (assumido) Não há opção para desligar a pausa automática (assumido no brief).
- (assumido) A tela do jogador não distingue pausa manual de automática: a dica do selo diz o mesmo.
- (assumido) Nos 8 temas escuros novos (Taverna a Arcana) o destaque é o latão do Grimório (`#E2AE4F`,
  `acentoForte` `#F0C46E` etc.) e os tokens de estado (sucesso, aviso, perigo, roxo de oculta) são os do
  Grimório. Derivados no tom de cada paleta: `cabecalho` (painel +5 por canal), `textoDesabilitado` e
  `pontoOff` (mistura do texto suave com o fundo), `perigoFundo` e `avisoFundo` (mistura do painel com
  vermelho e com amarelo escuro), véus (cor do fundo e do fundo da mesa). O degradê do painel é a barra de
  cada tema × 1,2 no alto, × 0,88 aos 160 px e × 0,79 embaixo (o teste confere). Taverna usa os valores do
  R1 (`5884c09`) mais o degradê.
- (assumido) A ordem dos temas no seletor é a da tabela do brief (Grimório primeiro; Edgerunner e Pergaminho
  no fim).

**O que ficou para depois**
- Um aviso de "pausou porque o mestre saiu" para os jogadores (hoje o selo de pausa é o mesmo da manual).
- O mapa (PixiJS) continua igual em qualquer tema, como antes.

## R3 — como ficou (2026-11-10)

Janelas flutuantes. Nada mudou na sala, no protocolo nem na exportação: posição, tamanho e "minimizada" são
preferência de cada navegador e nenhum frame vai para a sala (E2E confere).

**O que foi feito**
- **Um componente só**, `apps/web/src/janelas/Janela.tsx`, para tudo o que abre sobre o mapa: ordem de turno
  (`ordem`), ficha (`ficha:<personagemId>`), painel do token (`token`), paredes e portas (`paredes`), fontes de
  luz (`fontes`), iluminação (`iluminacao`) e dados rápidos (`dados`). Menus de contexto e dicas **não** viraram
  janela. A janela entra na área do mapa por um portal (`[data-area-do-mapa]`), de onde for chamada.
- **Arrastar pelo cabeçalho** (pointer events com captura; cursor de mover). Arrasto que começa num botão ou
  campo do cabeçalho não move. Com o cabeçalho focado, as setas movem 8 px (Shift, 40 px). **Dois cliques no
  cabeçalho minimizam** (só a barra do título; o corpo fica montado, mas escondido) e dois cliques restauram;
  há também um botão "Minimizar"/"Restaurar" e o "Fechar" onde a janela já fechava. Cabeçalho em `--barra`,
  corpo em `--painel`.
- **Sempre dentro da área do mapa** (`area.ts`/`janelas/geometria.ts`): ao abrir, ao soltar e quando a área
  muda (janela do navegador, painel direito ajustado ou recolhido) a janela é empurrada para dentro. O que a
  pessoa escolheu fica guardado intacto; o que se vê é empurrado (como a largura do painel no R2): se a área
  volta a crescer, a janela volta ao lugar escolhido.
- **A última clicada fica por cima**: pilha única entre as janelas (`janelas/pilha.ts`); abrir uma janela a põe
  por cima.
- **Preferência por janela e por navegador**: `tabletop:pref:janela:<id>` com `{x, y, largura, altura,
  minimizada}` (coordenadas da área; só o que a pessoa mudou). Sem localStorage nada quebra.
- **Redimensionar**: a ficha pela quina (mínimo 520×360, como antes); a ordem de turno e as fontes de luz só
  pela altura (borda de baixo). As outras não redimensionam.
- **Ficha estreita** (520 px, o tamanho com que abre em 1280×720): as caixas do resumo quebram em duas linhas,
  as abas rolam de lado se faltar espaço e, na linha de cada classe, a subclasse desce para baixo (container
  query `ficha` no corpo da ficha), para o nível e a lixeira continuarem à vista (achado na revisão dos prints).
- **Posições padrão** (enquanto a pessoa não mexe, ficam presas ao canto): ordem de turno no alto à direita;
  painel do token embaixo à esquerda; ficha no alto à esquerda, com no máximo 60% da largura da área (mínimo
  520 px, e sem passar por cima da ordem de turno quando cabe) e 75% da altura; uma segunda ficha sem posição
  guardada desloca 32 px em cascata; fontes de luz e paredes no alto à esquerda, lado a lado; iluminação no
  alto ao centro; dados rápidos ao lado do botão que os abre, na barra de ferramentas.
- **Acessibilidade**: `role="dialog"` não modal com nome; cabeçalho `role="toolbar"` focável; botões com
  `aria-label`; Esc **não** fecha janela (Esc é da seleção, R5).
- **Cada janela** tem `data-testid="janela-<id>"` no contêiner com `data-minimizada`; os `data-testid` antigos
  continuam no miolo (mesma caixa).
- **Seletor de tema**: a metade de cima da bolinha usa o token novo `amostra` (a cor viva do tema), em vez da
  barra, quase preta em nove deles; Druida, Leviatã, Licantropo e Paladino se distinguem (teste de unidade e de
  E2E). A interface não mudou de cor.
- Resolve o 16 do levantamento e as partes do 8 (painel do token) e do 14 (ordem de turno) que eram do R3.

**Decisões (assumido)**
- (assumido) Ficha: uma posição e um tamanho guardados por personagem (`ficha:<personagemId>`).
- (assumido) Esc não fecha as janelas.
- (assumido) Setas movem a janela com o cabeçalho focado (8 px; Shift, 40 px).
- (assumido) Só a ficha redimensiona nos dois eixos; ordem de turno e fontes de luz só na altura; o resto não.
- (assumido) A janela de dados rápidos deixou de fechar ao clicar fora (agora é janela: fecha pelo X, ou
  sozinha depois de rolar, como antes). O botão da barra continua alternando.
- (assumido) Minimizar esconde o corpo sem desmontá-lo (nada se perde: campos, rolagem, ficha em edição).
- (assumido) O "recolher" das fontes de luz (que deixava o painel a 70% de opacidade) virou o minimizar comum,
  sem a opacidade.
- (assumido) Fechar o painel do token ou a ficha não apaga a posição guardada; ela só é guardada depois que a
  pessoa move ou redimensiona.
- (assumido) A ordem de turno tem no máximo "altura da área menos 80 px", para deixar livre o canto do zoom.
- (assumido) Janela de ficha sem posição guardada acompanha o tamanho da área até a pessoa mexer nela.

**O que ficou para depois**
- Os controles da ordem de turno (cinco linhas, valor que reordena ao digitar, "Rolar para todos" sem motivo)
  continuam como eram: R5.
- Esc soltar a seleção (item 8) e o painel do token deixar de abrir sozinho ao selecionar: R5. Hoje o painel
  pelo menos se arrasta, minimiza e fecha.
- Toque (celular): arrastar e redimensionar continuam só testados com mouse.
- Com ficha, ordem de turno e painel do token abertos em 1280×720 os três se sobrepõem em parte nas posições
  padrão (não cabem lado a lado); a última clicada fica por cima.
- Na ficha a 520 px, Raça, Antecedente e Alinhamento cortam o texto dentro do campo ("Elfo da f"): R6.

## Em aberto

- R1, R2, R2b e R3 feitos (2026-11-10). **Plano aprovado (2026-11-10):** R2 a R6 seguem como planejados, um depois do
  outro; depois do R6 o Vilella faz os ajustes finos de UX/UI e a reorganização dos itens, a partir de
  `docs/PASSAGEM.md`.
- Itens de interface que vieram dos lotes e entram no R5/R6: a dica das condições abrir por clique, alças de
  tocha sobrepostas ao ícone de ponto, seleção múltipla no mapa.
