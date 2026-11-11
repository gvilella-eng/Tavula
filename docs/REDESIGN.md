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
- **R5. Interações e fluxos** (dividido em dois na execução, 2026-11-11: **R5a**, mapa e tokens: 7, 8, 9–13; **R5b**, combate, fichas, compêndio e PDF: 14, 15, 18, 19). Esc solta a seleção; criar token pede nome e lugar (ou arrasta da ficha);
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

## R4 — como ficou (2026-11-10)

Organização do mestre. Nada mudou nas regras, na sala, no protocolo nem na exportação: são os mesmos frames de
antes (o grid da cena, por exemplo, continua sendo `cena.configurarGrid`, só editado em outro lugar).

**O que foi feito**
- **Menu superior em grupos com nome** (item 2; `MenuSuperior.tsx`): **Cena** (Cenas, Camadas), **Mapa** (Novo
  token), **Luz** (Visão noturna, Iluminação), **Combate** (Ordem de turno) e **Ver como**. Separador fino entre os
  grupos e o nome do grupo em letra pequena embaixo dos ícones. Cabe nos 48 px do topo, em 1280×720 com o painel
  no padrão, sem cobrir a presença nem a pausa (E2E mede).
- **Dica em todo botão** (nome em negrito e uma frase do que faz), no mouse e no foco do teclado
  (`role="tooltip"`, ligada por `aria-describedby`); o `aria-label` é o nome. Sai ao clicar, ao perder o foco ou
  com Esc, e não aparece enquanto a lista do próprio botão está aberta.
- **Ícones que dizem o que são**: Iluminação virou a lâmpada (era o "copo"/lanterna); a lua só liga a visão
  noturna (sem o clique direito escondido); **"Ver como" ganhou botão próprio** (olho) que abre a lista "Eu mesmo
  (mestre)" e os jogadores, e fica apertado enquanto se vê como alguém.
- **"Eventos (em breve)" saiu** (botão, painel e o que só existia para ele). Volta com o 7b.
- **Menu de Iluminação**: perdeu "Paredes e portas" e ganhou **"Modelos de tocha…"**, que abre a aba Mesa e
  rola até a seção de luz, mesmo com o painel recolhido.
- **Paredes e portas viraram ferramenta da barra esquerda** (item 5; só do mestre, fora do "ver como"): o botão
  liga o modo e abre a janela `paredes` (R3) com o tipo. **O modo fica visível**: botão apertado, cursor de mira
  (já existia) e um selo "Modo Paredes e portas" com o botão "Sair do modo" na área do mapa, no estilo do selo
  "Vendo como". Trocar de ferramenta (barra ou V, H, R), apertar o botão de novo, fechar a janela ou "Sair do
  modo" saem do modo.
- **Abas do painel direito** (itens 4 e 6): mestre vê **Chat, Fichas, Notas, Compêndio, Mesa, Preferências**;
  jogador, **Chat, Fichas, Notas, Compêndio, Preferências**. A aba Mestre e a aba Configurações deixaram de
  existir.
  - **Preferências** (todos): trocar de usuário, tema de cor, encaixe no grid, pasta local de imagens e
    transferências. A largura do painel continua pela alça da borda (não há campo).
  - **Mesa** (só mestre, `AbaMesa.tsx`): índice curto no alto (Regras, Luz, Papéis, Permissões, Campanha,
    Diagnóstico; fica grudado ao rolar) e seções com título: regras da mesa (mãos, penalidade, alcance, tempo
    para jogadores, estágios), modelos de tocha e objetos de luz, papéis dos usuários, capacidades dos
    jogadores (padrão e exceções), campanha (exportar e importar) e, **recolhido** no fim, o diagnóstico com o
    "uso de hoje".
  - **Notas** (todos): "Nota da mesa (todos veem)" e, só para o mestre, "Nota do mestre (só mestres veem)".
    A aba Fichas ficou só com as pastas e as fichas.
- **Grid na configuração da cena** (`ConfigurarCena.tsx`): bloco "Grid da cena" com "Grid visível" e
  "Quadrado (metros)"; vale ao Salvar, junto com o resto da configuração. Saiu da aba Mestre.
- `BarraLateral` aceita um pedido de fora para abrir uma aba e rolar até uma seção (`PedidoDeAba`).

**Decisões (assumido)**
- (assumido) "Ver como" é o quinto grupo do menu, com o nome do grupo igual ao do botão.
- (assumido) Os grupos têm o nome em letra pequena embaixo (não cabe rótulo ao lado de cada ícone nos 48 px
  com o painel em 320 px); o que cada botão faz fica na dica.
- (assumido) A visão noturna e as demais preferências de tela do mestre continuam só da tela dele.
- (assumido) O botão de Paredes fica numa seção própria da barra, embaixo do pincel, separada por um filete, e
  some quando o mestre está vendo como um jogador.
- (assumido) Esc dentro do modo Paredes continua encerrando a sequência de paredes em andamento (como antes) e
  não sai do modo; Esc soltar a seleção é do R5.
- (assumido) O grid da cena tem só "visível" e "quadrado em metros": o modelo da cena não tem cor de grid, então
  não há campo de cor.
- (assumido) O grid da cena passou a valer ao Salvar da configuração (antes aplicava a cada campo). Valor do
  quadrado fora de 0,3 a 10 m mostra erro no próprio formulário.
- (assumido) Nas Preferências não há controle numérico de largura do painel (só a alça do R2).
- (assumido) As seis abas do mestre cabem numa linha a partir de 300 px, com os nomes inteiros (2 px de folga
  lateral em cada aba, em vez de 4). O agente tinha deixado quebrar em 4 + 2 (e 5 + 1 em 1280×720); a revisão apertou.
- (assumido) Não existe preferência de "aba aberta" guardada; o painel sempre abre no Chat. Por isso não houve
  migração de aba guardada ("Configurações" ou "Mestre").
- (assumido) O jogador que vira mestre ganha a aba Mesa na hora (e perde ao ser rebaixado).
- (assumido) "Modelos de tocha…" também abre o painel se estava recolhido.

**O que ficou para depois**
- Atalhos de teclado nas dicas do topo (R6).
- Dica do menu do topo só existe nos botões do menu do mestre; a barra esquerda segue com `title` nativo (R6
  pode unificar).
- O selo de modo ("Paredes e portas") é só para paredes; outros modos (luz, ponto) seguem sem selo.
- As posições de janelas e o resto do R5 (Esc, criar token com nome, tocha com dica etc.).

## R5a — como ficou (2026-11-11)

Interações no mapa e nos tokens (o R5 do plano foi dividido: este é o **R5a**; o **R5b** é combate, fichas, compêndio e
PDF). Nada mudou na sala, no protocolo nem na exportação: nenhum frame novo e nenhum frame de menos (cada ação
nova usa o mesmo frame de antes). Resolve 7, 8 (o resto), 9, 10, 11, 12 e 13, mais a dica das condições por
clique e as alças de tocha sobre o ícone de ponto (do "Em aberto").

**O que foi feito**
- **Esc solta a seleção** (item 8; `Mesa.tsx`): limpa a seleção de tokens e de desenhos, fecha os menus do botão
  direito (token e tocha), a regra aberta e a dica, e cancela o modo "pôr token". O mapa cancela os gestos dele:
  régua e medidas fixas, o arrasto de um token (ele volta de onde saiu; só se já andou vai um `token.soltar`
  com a posição de origem) e o de uma alça de tocha; a sequência de paredes e o traço do pincel já eram
  assim. Esc **não** age com o foco num campo de texto nem com o foco dentro de uma janela (no painel do token,
  soltar a seleção fecharia o painel), e **não** fecha janelas (decisão do R3). Com o foco no mapa e o painel
  aberto, Esc solta a seleção e o painel fecha junto (ele segue a seleção) (assumido).
- **O painel do token deixou de abrir sozinho** (item 8): selecionar só seleciona. O painel abre por **"Editar
  token…"** no menu do botão direito (primeiro item, só do mestre) e por **dois cliques no token** (só do
  mestre; com a ferramenta de seleção). Aberto, ele segue o token selecionado; sem token selecionado
  (Esc, clique no vazio, apagar) ele fecha, e a seleção seguinte não o abre.
- **Novo token pede nome e lugar** (item 7; `NovoToken.tsx`): "Novo token" (grupo Mapa) abre uma janela pequena com
  nome (já focado), cor (seis amostras) e tamanho (1 a 4 quadrados); Enter ou "Pôr no mapa" fecha e liga o **modo de
  pôr**: uma prévia do token (cor, iniciais e tamanho certos, encaixada no grid) segue o cursor e um selo diz
  "Clique no mapa para pôr X · Esc cancela · Alt inverte o encaixe". O clique cria o token (`token.criar`, o mesmo
  frame de antes, na camada de trabalho) e o seleciona. Esc, "Cancelar", trocar de ferramenta ou de cena
  cancelam sem enviar nada. A janela lembra que dá para **arrastar um personagem da aba Fichas para o mapa**
  (isso já existia).
- **Tocha** (item 9; `mapaPixi.ts`, `MenuDoToken.tsx`): passar o mouse na alça mostra uma dica no estilo das do R4
  ("Dois cliques: apagar ou acender · Botão direito: mais ações"; para a tocha de outro personagem, diz que só
  o dono e o mestre mexem nela). As ações também estão no menu do botão direito do **token** que a carrega,
  num grupo **"Tocha"**: "Apagar a tocha"/"Acender a tocha" (o menu fica aberto) e "Guardar na mochila" (fecha),
  com os mesmos frames (`tocha.alternar`, `tocha.guardar`) dos dois cliques e do menu da alça. **A alça é
  maior** (círculo de 20 px, chama maior, tempo em 15 px) e, se cair em cima do ícone de um ponto de luz, afasta
  para o lado (até três passos) para os dois ficarem à vista e clicáveis.
- **Condições com menos cliques** (item 10): o menu do token mostra as 14 condições direto como itens de marcar
  (um clique liga ou desliga; o menu fica aberto), com exaustão e concentração logo abaixo; saíram "Condições…" e
  "Fechar" (Esc ou clique fora fecha). Os **marcadores no token ficaram maiores** (raio de 9 para 13 px, letra de
  10 para 12) e, em token pequeno, cabem menos antes do "+N". **A regra abre por clique** no marcador (popover
  "Regra" com o resumo, que fecha com Esc, "Fechar" ou clique fora), além da dica no mouse.
- **Régua que fica na tela** (item 11): soltar a medida a deixa na tela com um botão **"Fixar"** ao lado do rótulo;
  Shift ao soltar já fixa. Fixada, ela deixa medir outra; some com **Esc**, com **um clique nela** (na linha ou no
  rótulo) ou ao **trocar de ferramenta ou de cena**. Só da tela de quem mediu (a régua nunca foi compartilhada).
- **Aviso perto do clique** (item 12; `AvisoPerto.tsx`, `useSala.ts`): o aviso de erro aparece dentro da área do
  mapa, logo abaixo (ou acima, se não couber) do ponto onde a pessoa agiu. A origem vem do ponteiro no momento
  do envio, guardada por id de pedido e ligada ao erro pelo `idPedido` da resposta; sem ponteiro recente, usa o
  campo com o foco; sem nenhum dos dois (a sala avisando por conta própria) fica no alto, ao centro da área. Fica
  de 6 s (mínimo) a 12 s, mais tempo quanto maior o texto, e **um clique** (ou o X) o dispensa.
  `data-testid="aviso"` e `data-codigo` continuam.
- **Jogador sem token na cena** (item 13): em vez da tela preta, um cartão no meio da área do mapa
  (`sem-token`): "Você ainda não tem um personagem nesta cena. Peça ao mestre para pôr o seu token no mapa."
  ou, se o jogador tem personagem cujo token não está na cena, "Seu personagem não está nesta cena" com o
  nome. A visão não mudou; só explica. Some quando o token aparece. O mestre "vendo como" um jogador sem token
  vê a versão em terceira pessoa.

**Decisões (assumido)**
- (assumido) Dois cliques no token abrem o painel; antes dois cliques num token não faziam nada. Fica só para o
  mestre (o painel é dele).
- (assumido) O painel do token fecha quando não há mais token selecionado; a seleção seguinte não o reabre.
- (assumido) "Novo token" cria um token por vez: depois do clique o modo termina (não é uma ferramenta que
  fica ligada). O encaixe no grid segue a preferência de encaixe (Alt inverte); antes o token novo sempre
  encaixava.
- (assumido) O formulário não tem campo para a camada: nasce na camada de trabalho, como antes.
- (assumido) A fixação da régua é pelo botão "Fixar" (visível) e por Shift ao soltar (atalho); medidas
  fixas se acumulam (quantas quiser) e saem juntas com Esc ou ao trocar de ferramenta.
- (assumido) No grupo "Tocha" do menu do token não há "Entregar": entregar continua por arrastar a alça até outro
  token (a dica da alça fala em "mais ações"; o arrasto segue como era).
- (assumido) Clicar num marcador de condição abre a regra e **não** arrasta o token (o marcador fica na borda
  de baixo; arrastar o token pelo corpo continua igual).
- (assumido) Aviso: duração de 6 s a 12 s (3,5 s mais 55 ms por letra, no mínimo 6 s). Como todo aviso vem de
  um erro da sala, não há duração diferente para "erro" e "informação".
- (assumido) A dica da tocha aparece só com o mouse, não por foco de teclado (a alça é desenhada no canvas e
  não recebe foco); o menu do token também só abre pelo botão direito.
- (assumido) Esc no meio do arrasto de um token o devolve à origem; o resto das ferramentas ficou como era.
- (assumido) Estado vazio do jogador: só aparece com a iluminação dinâmica ligada (sem ela o mapa está claro e
  não há o que explicar).

**O que ficou para depois**
- Seleção múltipla no mapa (continua não existindo).
- Menu do token e atalhos de teclado pelo teclado (só botão direito e mouse) e a dica da alça por foco: R6.
- Aviso sem origem ("sala avisando") só foi conferido por leitura do código e do CSS, não por E2E.
- "Entregar" a tocha pelo menu do token.

## R5b — como ficou (2026-11-11)

Combate, fichas, compêndio e PDF (a segunda metade do R5 do plano). Nada mudou nas regras, na sala, no protocolo
nem na exportação: nenhum frame novo e nenhum frame de menos; a leitura do PDF e a ficha que sai dela são as de
antes. Resolve 14 (o resto), 15, 18 e 19.

**O que foi feito**
- **Ordem de turno compacta** (item 14; `OrdemDeTurno.tsx`): o mestre vê uma linha com o que se usa a cada
  turno (**Anterior**, **Próximo turno** e o botão **Montar**); a rodada continua no cabeçalho da janela. O que é de
  montar o combate (rolar para todos, ordenar, adicionar selecionados, adicionar o grupo, entrada solta e encerrar)
  ficou numa seção recolhível **"Montar"** (`ordem-montar`, botão `ordem-montar-alternar`). Aberta ou fechada é
  preferência do navegador (`tabletop:pref:ordem:montar`, nenhum frame); sem escolha, a seção vem aberta enquanto o
  combate não começou (rodada 0) e recolhida depois. O jogador continua vendo só o que é dele.
- **O valor da iniciativa só vale no Enter ou ao sair do campo.** Conferido no código: digitar, as setas e a roda
  do mouse no campo numérico só mudam o texto (não havia caminho que mandasse frame durante a digitação; o que
  reordena a lista é a própria confirmação, porque `combate.editar` com iniciativa reordena, como sempre). Fechado
  o caminho que sobrava: a roda do mouse num campo com foco mudava o número sem querer, e agora tira o foco e deixa
  a lista rolar. **Esc devolve o valor de antes** e sai do campo sem mandar nada.
- **Todo botão desabilitado diz por quê** (`BotaoComDica.tsx`, novo): o botão usa `aria-disabled` (o clique é
  ignorado; o `disabled` nativo não deixa a dica aparecer) e o motivo vira a dica (hover e foco; `role="tooltip"`
  ligada por `aria-describedby`) e a descrição acessível. Motivos: "A lista está vazia", "Todos já têm iniciativa",
  "Precisa de pelo menos duas entradas", "Selecione um token no mapa", "Já está na lista", "Não há personagens de
  jogadores nesta cena", "O grupo já está na lista", "Escreva o nome da entrada" e "Não há combate em andamento". A
  dica é desenhada por um portal no `body`, com posição fixa (não é cortada pela rolagem da janela), e some ao
  clicar, ao perder o foco e com Esc.
- **Ficha abre com um clique** (item 15; `AbaFichas.tsx`): um clique (ou Enter) no item abre a ficha ou traz para a
  frente a que já está aberta; dois cliques não abrem duas. A dica do item é "Abrir a ficha" e, para o mestre,
  "(arraste para o mapa para pôr o token)". O mestre agora arrasta o item **inteiro** (a alça ou o nome): arrastar
  cria o token e não abre a ficha (o navegador não dispara o clique depois de um arrasto). O menu do item é
  irmão do botão, então clicar nele não abre a ficha.
- **Compêndio com "Usar o exemplo"** (item 18; `AbaCompendio.tsx`, `useCompendio.ts`, `exemploSrd.ts`): o estado
  vazio do mestre abre com **"Usar o exemplo do SRD (3 magias)"** (ação principal) ao lado de **"Escolher o
  arquivo…"** e "Recarregar"; a ajuda do formato JSON ficou recolhida em **"Como montar o seu arquivo"**. O
  exemplo é o próprio `fixtures/compendio/exemplo-srd.json`, importado como texto pelo Vite (`?raw`), sem cópia
  do conteúdo e empacotado no build. Com a pasta local escolhida (e com escrita), grava `compendio/magias.json` e
  ele fica entre visitas; se o arquivo já existe, pede confirmação antes de substituir (também no caso do
  arquivo com erro); sem pasta, vale até recarregar a página, como "Escolher o arquivo…". A atribuição do SRD
  (o campo `creditos` do arquivo) aparece **aberta** nos créditos do compêndio quando o exemplo está em uso (a
  tela compara o hash do compêndio da mesa com o do exemplo empacotado), com uma linha "Exemplo do SRD 5.1 em
  uso" que diz onde ele ficou. O estado vazio do jogador explica: "O mestre ainda não montou o compêndio desta
  mesa" e que ele não precisa fazer nada.
- **PDF com um caminho e um nome** (item 19): os três lugares (botão da aba, menu do item e o botão da aba
  Configurar da ficha) agora dizem **"Importar PDF…"**. A **revisão** mostra no alto o **destino**
  (`revisao-destino`: "Ficha nova" ou "Por cima de: <personagem>", só os que a pessoa edita), já preenchido
  quando se começou pelo menu do item. Se o nome lido do PDF bate com um personagem existente, a tela **sugere**
  o destino ("Já existe Darion na mesa. Importar por cima dele") sem escolher sozinha. O nome do personagem novo
  passou para o mesmo bloco do destino (só aparece em "Ficha nova"). O botão final diz o que vai acontecer
  ("Criar a ficha" / "Substituir a ficha de X") e a confirmação extra de substituir continua. **Revisão mais curta**:
  no alto, "N campos para conferir", **"Próximo a conferir"** (leva o foco ao próximo campo incerto, abrindo a
  seção se estava recolhida) e **"Mostrar tudo"** (vira "Recolher o que está certo"); as seções sem campo
  incerto vêm **recolhidas** com um resumo ("12 campos lidos, nada a conferir") e as com campo incerto, abertas.
- Só para os testes (modo `e2e`): o gancho `usarMemoriaComoPasta` faz a `Memoria` valer como a pasta com escrita,
  e a `Memoria` passou a guardar de volta o `.json` gravado; sem isso não haveria como cobrir "grava na pasta".

**Decisões (assumido)**
- (assumido) Controles de montar numa seção recolhível "Montar" (e não num menu "Mais"); fica aberta antes do
  combate começar e recolhida depois, até a pessoa escolher (a escolha vale daí em diante).
- (assumido) Esc no campo da iniciativa devolve o valor de antes; a roda do mouse num campo com foco tira o foco.
- (assumido) Anterior e Próximo turno também dizem "A lista está vazia" quando desabilitados.
- (assumido) A dica do botão desabilitado aparece também ao mexer o mouse sobre ele (o botão pode ficar
  desabilitado com o mouse já em cima, logo depois do clique).
- (assumido) O mestre arrasta o item das Fichas por inteiro (nome e alça), não só pela alça, para a dica "arraste
  para o mapa" valer onde a pessoa está olhando. O jogador não arrasta.
- (assumido) "Usar o exemplo" com pasta grava `compendio/magias.json` e pede confirmação se já existe; sem
  pasta (ou sem o seletor de pasta do navegador) vale até recarregar. Se a gravação na pasta falhar, mostra o
  erro e não cai para "sem pasta" (o arquivo da pasta continuaria mandando).
- (assumido) A atribuição do SRD fica nos créditos (aberta quando o exemplo está em uso) e numa linha "Exemplo do SRD
  5.1 em uso", só enquanto o compêndio da mesa é o exemplo (comparado pelo hash).
- (assumido) O nome do PDF que bate com um personagem só **sugere** o destino (comparação sem caixa e sem espaços nas
  pontas); a pessoa aceita com um clique.
- (assumido) O nome do personagem novo mora no bloco do destino, não mais no cabeçalho da ficha da revisão.
- (assumido) "N campos para conferir" no lugar de "para revisar" (texto da revisão e do selo das seções).
- (assumido) "Próximo a conferir" dá a volta ao chegar no último; "Mostrar tudo" vira "Recolher o que está certo"
  (recolhe só as seções sem incerto).
- (assumido) Quantos "campos lidos" cada seção tem (resumo da seção recolhida): atributos 12 (6 valores e 6
  salvaguardas), perícias 18, números gerais 8, e nas demais o tamanho da lista ou o que veio preenchido.

**O que ficou para depois**
- A dica do item das Fichas ("Abrir a ficha") é a dica nativa do navegador (`title`); não foi para o estilo do R4.
- Atalhos de teclado nas dicas (R6).
- O caminho "grava na pasta" do exemplo foi coberto no E2E só com a `Memoria` dos testes; com a pasta real do
  navegador (File System Access) só por leitura do código.
- Os prints antigos que usam `ordem-*` com o combate em andamento (Montar vem recolhida) ou o texto "Confirmar
  importação" ficam para o R6.

## Em aberto

- R1, R2, R2b, R3, R4 (2026-11-10), R5a e R5b (2026-11-11) feitos. **Plano aprovado (2026-11-10):** R2 a R6 seguem
  como planejados, um depois do outro (o R5 foi dividido em R5a e R5b); depois do R6 o Vilella faz os ajustes
  finos de UX/UI e a reorganização dos itens, a partir de `docs/PASSAGEM.md`.
- Itens de interface que vieram dos lotes: seleção múltipla no mapa (ainda não existe). A dica das condições por
  clique e as alças de tocha sobre o ícone de ponto foram resolvidas no R5a.
