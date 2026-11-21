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

## R6a — como ficou (2026-11-11)

Teclado, dicas com atalho, foco e contraste (o R6 do plano foi dividido: este é o **R6a**; o **R6b** é tela pequena, frágeis
restantes, transições e a revisão final dos prints). Nada mudou na sala, no protocolo nem na exportação: nenhum frame novo
(o menu do token pelo teclado manda os mesmos frames do clique). Resolve o item 22 e os frágeis de teclado, foco e contraste
dos R anteriores.

**O que foi feito**
- **Uma dica só, com atalho** (item 22; `Dica.tsx`, `BotaoComDica.tsx`; **mudou no V3b**: agora só onde falta nome, de uma linha e com atraso, ver "V3b — como ficou"): o `BotaoComDica` virou a única dica da interface. Vale no
  mouse e no foco do teclado, tem nome em negrito, o que faz e o atalho em `<kbd>` ("Régua · R"), mostra o motivo de um
  botão desabilitado, liga-se por `aria-describedby` (e `aria-keyshortcuts`) e sai com Esc, ao clicar e ao perder o foco. É um
  portal no `body`, com posição fixa e lado (baixo, direita ou esquerda). O `Botao` do `MenuSuperior` (R4) passou a usá-la.
  Passaram do `title` nativo para ela: a barra esquerda e a sub-barra do pincel, o zoom, o cabeçalho e os botões das
  janelas (Minimizar, Fechar), o item e o "Mais ações" das Fichas, o "+N" da presença, o recolher do painel, as abas
  (só com o painel recolhido) e a alça de largura do painel. Os `data-testid` dos botões continuam; a dica é `dica-<testid>`.
- **Tabela única de atalhos** (`atalhos.ts`): só o que existe no código (V, H, R; Espaço; Esc; Delete/Backspace; Alt; Shift
  na régua e no dado; setas na janela e na alça do painel; Enter e Shift+Enter no chat; Enter e Esc na iniciativa) mais o do
  item 2. Gera as dicas e a lista **"Atalhos do teclado"** da aba Preferências (`ListaDeAtalhos.tsx`, por grupo).
- **Menu do token pelo teclado** (item 2; `Mesa.tsx`, `MenuDoToken.tsx`, `useMenuPorTeclado.ts`): com um token selecionado e
  o foco no mapa (ou em nada), **Shift+F10 ou a tecla de menu** abre o menu do token junto dele e o foco vai ao primeiro item.
  As setas andam pelos itens (Home e End também, menos dentro do campo de texto), Enter e Espaço ativam, Esc fecha e devolve
  o foco ao mapa. As ações da tocha estão nesse menu, então a tocha também vale pelo teclado. O mapa passou a receber foco
  (`tabIndex=0`, `role="application"`, rótulo que cita o atalho) e tem anel de foco.
- **Foco visível** (`styles.css`, `temas.ts`): um anel só para todo controle (`button`, campos, `summary`, links, `[tabindex]`),
  2 px na cor do token novo `--foco` (igual ao `acentoForte` de cada tema, nos 11), com `:focus-visible`. O cabeçalho da janela, a
  alça do painel, o seletor de tema, as cores do novo token e o mapa têm o recuo próprio. O `temas.test.ts` confere 3:1 do
  `foco` contra todas as superfícies, nos 11 temas.
- **Contraste** (`contrasteDeCor.ts`): o texto das iniciais sobre a cor de um usuário ou de um token é branco ou preto, o que
  der mais contraste (sempre AA; teste de unidade sobre uma grade de cores). Vale no avatar, na presença, na tela de entrada,
  na condição da ficha e nas iniciais do token no mapa (com o halo contrário). Os rótulos desenhados no mapa já tinham
  contorno; continuam independentes do tema (o mapa é conteúdo) e foram conferidos sobre mapa claro e escuro.
- **Espaço no botão**: Espaço arrasta a vista, mas num botão focado pelo teclado ele ativa o botão (antes o mapa o roubava
  de qualquer botão em foco).
- **Jogador**: como só o mestre seleciona tokens, para o jogador a tecla abre o menu do token que ele controla na cena.

**Decisões (assumido)**
- (assumido) A lista de atalhos fica na aba Preferências, sempre visível, no fim.
- (assumido) O mapa (canvas) recebe foco com `tabIndex=0` e rótulo; é o "foco no mapa" do atalho e para onde o foco volta.
- (assumido) O token do anel de foco é `--foco`, com o mesmo valor do `acentoForte`.
- (assumido) Texto de iniciais: branco ou preto puro (o preto suave não garante 4,5:1 sobre qualquer cor).
- (assumido) Rótulos do mapa independentes do tema, legíveis por contorno.
- (assumido) Jogador: Shift+F10 abre o menu do primeiro token que controla na cena (ele não seleciona tokens).
- (assumido) Espaço ativa o botão só quando o foco chegou nele pelo teclado; botão focado com o mouse continua deixando o Espaço arrastar.
- (assumido) Esc com o menu aberto continua soltando a seleção (regra do R5a); o foco volta ao mapa.

**O que ficou para depois**
- A dica da alça da tocha por foco: a alça é só do canvas (não recebe foco). A tocha pelo teclado vale pelo menu do token.
- Ainda com `title` nativo: campos e botões menores das fichas, do painel de fontes de luz, do editor do item, da ordem de turno,
  do chat, da faixa de cenas, as cores do pincel e a alça do item das Fichas.
- Selecionar um token só pelo teclado (não há; o atalho parte de um token já selecionado).

## R6b — como ficou (2026-11-11)

Tela pequena, frágeis restantes, transições e revisão final. É o **último lote do redesign**: depois dele o Vilella faz os ajustes
finos a partir de `docs/PASSAGEM.md`. Nada mudou na sala, no protocolo nem na exportação: nenhum frame novo (o aviso da pausa sem
mestre vem do estado e da presença que o cliente já tem).

**O que foi feito**
- **Ficha a 520 px** (frágil do R3): Raça, Antecedente e Alinhamento (`.fh-grade-3`) passaram de 3 colunas fixas para colunas que
  quebram (`auto-fit`, mínimo de 140 px). Na ficha estreita a coluna da identidade tem ~210 px, então os três campos empilham e o
  texto cabe inteiro (o campo tinha 47 px: "Elfo da f").
- **Janelas em 1280×720** (frágil do R3): numa área "apertada" (altura < 900 px; `janelas/geometria.ts`) o painel do token abre
  embaixo à direita, na coluna da ordem de turno, com 64 px de folga para o zoom, e a ordem e o painel dividem a altura da coluna
  (a ordem fica com 58% e o painel do token com o resto, ~340 px e ~245 px em 1280×720, os dois com rolagem por dentro; a ordem só tem esse
  teto com o painel do token aberto: `dividirColuna`). A ficha continua
  no alto à esquerda. As três não se cobrem, em qualquer ordem de abertura (é posição estática, não depende de quem abriu antes).
  Janela com posição guardada pela pessoa não muda. Em área alta (≥ 900 px) tudo fica como era (painel do token embaixo à esquerda).
  `Janela` aceita `alturaMaxima` como função da área.
- **A vista mantém o centro** (frágil do R2; `mapa/mapaPixi.ts`): ao mudar o tamanho da área do mapa (alça do painel, recolher o painel,
  janela do navegador) o ponto que estava no centro continua no centro, em vez de a vista ficar ancorada no canto superior esquerdo.
- **Pílula da pausa** (frágil do R2): mesma largura rodando e pausada (mesmo peso de letra, ícone e relógio com largura mínima fixa; só a
  cor muda). Para o jogador o espaço da pílula fica reservado: ela não empurra os avatares ao aparecer.
- **Seletor de tema** (R2): colunas de no mínimo 76 px e nome sem quebra; "Pergaminho" cabe numa linha com o painel em 360 px.
- **Aviso da pausa sem mestre** (ficou do R2b): com a mesa pausada e nenhum mestre online (presença), a dica da pílula do jogador diz
  "Pausada: o mestre saiu da mesa; ela volta quando o mestre retomar" e, na hora em que isso acontece, o aviso sem origem do R5a aparece
  no alto da área do mapa ("Mesa pausada: o mestre saiu. Ela volta quando o mestre retomar."). `useSala` ganhou `avisar(texto)` (aviso
  local, sem frame). A pílula continua sem a palavra "Pausada" (só o ícone e o amarelo).
- **Transições discretas**: janelas, menus de contexto, popovers, dicas, avisos e a troca de aba entram em 140 ms (opacidade e 4 px de
  deslocamento, pela propriedade `translate`, que não mexe no `transform` de quem já o usa). Nada no canvas do mapa; sem animação de
  saída. Com `prefers-reduced-motion: reduce` nenhuma animação roda (inclusive o pulso do indicador de aba).
- **Setas nas dicas**: as quatro setas (mover a janela) são um grupo só, "← ↑ ↓ →", sem "ou", em teclas mais largas e maiores; o nome, o
  ponto e as teclas não se separam mais na quebra de linha. Vale para a lista de atalhos das Preferências (mesma tabela).
- **Rótulos dos tokens**: o nome vai numa pílula escura translúcida, sem contorno, legível sobre mapa claro e escuro, sem depender do tema.
- **`title` nativo → dica comum** (`BotaoComDica`): ordem de turno, cores e espessuras do pincel (agora com dica à direita), chat
  (modelos, limpar, enviar com "Enter"), fontes de luz (acender, apagar, editar, tirar e somar minuto, modificadores, pontos) e dados rápidos.
- **Prints**: apagados os que só registravam a interface antiga (lotes 6 a 14, `r1`, `r2`, `r2b`, `r3`); o `auditoria` virou o tour da
  interface de hoje (4 combinações: Grimório 1600×900 e 1280×720, Edgerunner e Pergaminho 1280×720); novo `r6b`.
- **Docs**: `PROJETO.md` aponta Preferências e Mesa onde descrevia as abas antigas; `PASSAGEM.md` pronto como ponto de partida.

**Decisões (assumido)**
- (assumido) "Área apertada" = altura da área do mapa abaixo de 900 px; nela o painel do token vai para a coluna da direita (em vez de
  embaixo à esquerda).
- (assumido) Ordem de turno (58%) e painel do token (o resto) dividem a altura da coluna, com rolagem por dentro, só enquanto os dois estão abertos; o painel do token, de ~418 px naturais, mostra só a metade de cima (nome, cor, tamanho, camada) e rola para o resto.
- (assumido) A ficha estreita empilha os três campos de identidade (em vez de reduzir a fonte ou abreviar o rótulo).
- (assumido) Sem a presença chegar, supõe-se mestre online (nada de aviso falso na entrada); "reconectando" conta como mestre fora.
- (assumido) O aviso da pausa sem mestre aparece também a quem entra numa mesa já nesse estado (a presença chega logo depois).
- (assumido) Entrada de 140 ms com opacidade e 4 px; sem animação de saída; E2E rodam com `reducedMotion: "reduce"`.
- (assumido) Rótulo do token em pílula escura translúcida, igual nos 11 temas.
- (assumido) Ficam com `title` nativo: campos pequenos da ficha e do editor do item, os itens do menu de contexto da faixa de cenas (o
  teste exige `disabled` de verdade), textos informativos (nome da cena, "o grupo está aqui", progresso do preparo), o selo da pílula do
  mestre e o rótulo "Cor livre".
- (assumido) Prints antigos apagados em vez de refeitos: só mostravam a interface de cada lote, e o tour cobre as telas de hoje.

**O que ficou para depois**
- Toque (celular) e navegadores além do Chrome.
- Seleção múltipla no mapa; "Entregar" a tocha pelo menu do token; selecionar um token só pelo teclado.
- Telas menores que 1280×720.

## Ajustes do Vilella (V1–V5)

Depois do redesign (R1 a R6), o Vilella usou a mesa e pediu ajustes (2026-11-11). Cada lote V muda o que o brief pedir, inclusive
estado, protocolo e sala; a campanha que já existe continua carregando.

## V1 — como ficou (2026-11-11)

Temas com personalidade, aba Mesa no fim e "Zerar o relógio". Detalhes de execução em `docs/ESTADO.md` ("Ajustes V1").

**O que foi feito**
- **14 temas** (eram 11). Os três discretos ficam no começo do seletor e como estavam: **Grimório**, **Masmorra** e **Pergaminho**. O
  antigo "Edgerunner" (id `escuro`) passou a se chamar **Masmorra**; o id não mudou, então quem o tinha guardado continua nele. Depois vêm
  os nove escuros com personalidade e, por último, os dois claros novos.
- **Edgerunner** (id novo `edgerunner`, cyberpunk): fundo quase preto levemente roxo, superfícies roxo-acinzentadas, acento **verde neon**
  nos estados ativos, **amarelo** como segundo acento (aviso, pausa, destaque) e roxo nas barras e cabeçalhos. Texto AA; o neon só em
  preenchimentos e ícones pequenos, nunca em blocos de texto.
- **Vampiro**: preto quase puro, vinho escuro nas barras, vermelho-sangue vivo no acento. **Sem amarelo** (o aviso é pêssego).
- **Licantropo**: cinza-chumbo nas superfícies, prata da lua no texto de destaque, no anel de foco e nas bordas, vermelho-escarlate no
  acento. **Sem amarelo** (o aviso é laranja-cobre).
- **Taverna** (madeira e cobre, acento cobre), **Forja** (carvão e brasa, acento laranja-brasa), **Paladino** (azul-marinho, acento
  branco-azulado, dourado no foco e no aviso), **Druida** (verde-musgo, âmbar de folha no aviso), **Leviatã** (azul-abissal, acento
  turquesa) e **Arcana** (violeta, acento violeta vivo, ciano-místico no foco e nos itens ocultos): cada um com o acento da sua identidade.
  Nenhum usa o dourado do Grimório.
- **Élfico** (`elfico`, verde-sálvia claro, acento verde-folha) e **Celestial** (`celestial`, branco-azulado, acento dourado-suave): os dois
  claros novos, com o mesmo cuidado de contraste do Pergaminho.
- Ordem no seletor: Grimório, Masmorra, Pergaminho, Edgerunner, Vampiro, Licantropo, Taverna, Forja, Paladino, Druida, Leviatã, Arcana,
  Élfico, Celestial. O seletor cabe no painel de 300 px sem rolar de lado.
- Testes dos temas: todas as chaves em todos, AA de todo par de texto e fundo, anel de foco 3:1, bolinhas distintas, degradê do painel
  nos coeficientes (só os escuros), os temas com personalidade não repetem o acento do Grimório (nem o de outro tema) e Vampiro e
  Licantropo sem amarelo (matiz). O `index.html` repete as 14 cores de fundo (um teste confere).
- **Aba Mesa** é a última (depois de Preferências), só do mestre; atalhos e testids iguais.
- **Zerar o relógio** da pílula do topo (só o mestre): um botão de seta ao lado da pílula abre o menu "Opções do relógio" com o item
  "Zerar o relógio" e a confirmação "Zerar o relógio da mesa? As tochas não mudam.". É um **marco**: o estado guarda o tempo da sala na
  hora de zerar (`relogio.marcoMs`) e a pílula mostra `tempoDaSala − marcoMs`. O tempo da sala, as tochas e tudo o que queima ficam como
  estavam. Pausada continua pausada em 00:00. Intenção `mesa.zerarRelogio` (`mesa.configurar`), evento `mesa.relogioZerado` só para o mestre.
  Estado e arquivos antigos (sem o marco) valem marco 0; exportar e importar levam o marco.

**Decisões (assumido)**
- (assumido) "Masmorra" é o novo nome do antigo Edgerunner (o brief deixou o nome em aberto).
- (assumido) A ordem dos nove escuros com personalidade: Edgerunner, Vampiro, Licantropo, Taverna, Forja, Paladino, Druida, Leviatã, Arcana.
- (assumido) Vampiro e Licantropo trocam o amarelo do aviso por pêssego e laranja-cobre: o aviso continua legível como aviso e sem amarelo.
- (assumido) Em Arcana os itens "ocultos do jogador" ficam ciano (o lavanda se confundiria com o acento violeta); em Edgerunner, Vampiro e
  Paladino o lavanda continua só nos casos em que não bate com o acento.
- (assumido) Onde o acento é claro (Edgerunner, Paladino, Druida, Leviatã, Licantropo) ou vermelho escuro (Vampiro), `acentoTexto` é escolhido
  pelo contraste (escuro sobre claro, claro sobre o vermelho do Vampiro).
- (assumido) O marco é só do mestre e não gera frame para o jogador; o menu do relógio é um botão de seta ao lado da pílula (a pílula
  continua pausando e retomando com um clique).
- (assumido) Zerar não muda a versão da exportação (o campo é opcional dentro do `relogio`).

**O que ficou para depois**
- Os temas não foram vistos por quem tem daltonismo (só o contraste foi medido).
- Ajustes de gosto nas cores: o Vilella olha e diz.

## V2 — como ficou (2026-11-11)

Ordem de turno simples. Detalhes de execução em `docs/ESTADO.md` ("Ajustes V2").

**O que foi feito**
- **Layout de referência, a pedido do dono** (vale por cima do brief): a janela é **estreita (270 px)**. O cabeçalho tem só o título "Ordem de
  turno" e o **×** (sem botão de minimizar; minimizar é com dois cliques no cabeçalho, como em toda janela). Logo abaixo, a linha
  **"Rodada: N"** à esquerda (0: "não começou"); o mestre clica no número e escreve (Enter confirma, Esc desfaz), o jogador só lê. A lista tem o
  ponto da cor do token, o **nome** à esquerda e o **número** à direita; a da vez em destaque (fundo e borda de sucesso, nome em negrito, "▶"). O
  mestre clica no número e escreve (Enter confirma, Esc desfaz, vazio tira o valor). Lista vazia: texto centralizado, "Ninguém na ordem de
  turno." e "Selecione o seu token e clique em Iniciativa na ficha." (o mestre também lê "Ou clique direito no token e escolha Entrar na
  iniciativa.").
- **Rodapé do mestre, numa linha**: [← Turno anterior] [lixeira: Limpar] [Ordenar pela iniciativa] [→ Próximo turno, botão de acento], todos só
  com ícone e a dica comum. Limpar pede confirmação curta (é o `combate.encerrar`: esvazia a lista e zera a rodada, e a janela continua aberta).
  O **Anterior voltou** (o brief o tinha tirado). O jogador não vê o rodapé.
- **Saíram da tela**: "Montar" (Rolar para todos, O grupo, Adicionar selecionados, entrada solta, Encerrar), o olho de esconder,
  o "?" de valor oculto, o × de cada linha, a alça de arrastar, o "Rolar" e o "Passar o meu turno" do jogador. Os campos `valorOculto`,
  `oculta`, `destreza` e `jogador` continuam no schema (compatibilidade; entrada antiga `oculta` continua sem chegar ao jogador), sem
  interface. As intenções `combate.adicionar`, `combate.rolar` e `combate.passar` continuam na sala.
- **Reordenar à mão**: o mestre arrasta a linha inteira; pelo teclado, a linha em foco com **Alt+↑/↓** (entra na tabela de atalhos). **Botão
  direito** numa linha (ou a tecla de menu com a linha em foco): "Dar a vez" e "Tirar da lista".
- **A ordem na tela é do mestre e vale para todos**: já existia (`ordemDeTurnoVisivel`, intenção `ordemDeTurno.definir`, pelo menu
  Combate). O mestre agora também a fecha pelo **×** da janela (fecha para todos); fechar **não apaga** a lista nem a rodada, e reabrir devolve
  tudo igual. O jogador vê a janela enquanto está aberta, pode **minimizar** (dois cliques) e **fechar só na tela dele** até o mestre reabrir (assumido); o × dele não manda nada à sala.
- **O jogador entra pela ficha**: ele passa a **selecionar os tokens que controla** (anel de seleção; só na tela dele; Esc solta; clicar
  num token alheio solta a seleção; nada vai para a sala; o painel do token continua só do mestre; Shift+F10 usa o token selecionado). Com a
  ordem **aberta**, clicar em **Iniciativa** na ficha (dica "Rolar a iniciativa e entrar na ordem de turno") chama `combate.entrar`: a sala
  rola 1d20 + a iniciativa da ficha, manda a rolagem ao chat como as outras e põe o token na lista com o valor. Com a ordem **fechada**, a
  Iniciativa só rola no chat, como antes. O mestre usa o mesmo caminho e continua com "Entrar na iniciativa" do menu do token.
- **Sala**: intenção nova `combate.entrar { tokenId }` (sem capacidade; conferida: ordem aberta, o usuário controla o token ou é o mestre, o token
  é visível para ele, está na cena ativa e ainda não está na lista; o valor é rolado no servidor). `combate.rodada { rodada }` e
  `combate.darVez { id }` (`combate.gerir`). Nenhum campo novo no estado, nenhuma migração, a exportação continua v12.
- **Sigilo**: continua o filtro `combateParaUsuario`; a rolagem de NPC entra no chat oculta; a entrada que um token ganha ao ir para a
  camada do mestre some do jogador (snapshot novo) e volta se o token voltar.

**Decisões (assumido)**
- (assumido) O "estado novo `combate.aberta`" do brief já existia como `ordemDeTurnoVisivel` (V1 e antes: liga e desliga para todos, guardado,
  exportado, migração `false` para estado antigo). Foi reaproveitado em vez de criar um segundo campo; "estado antigo sem o campo = fechada"
  já valia.
- (assumido) Mudar o valor, entrar e rolar continuam **reordenando** a lista pelos valores (regra do Lote 11); o arrasto e o Alt+setas valem
  até o próximo valor mudar ou o mestre apertar Ordenar.
- (assumido) A Iniciativa da ficha só usa o token selecionado se ele for do personagem daquela ficha; senão, vale o único token do personagem
  na cena ativa; com vários ou nenhum, o aviso "Selecione o seu token no mapa." (sob o cabeçalho da ficha, some em 5 s).
- (assumido) Clicar num token alheio solta a seleção do jogador (em vez de mantê-la).
- (assumido) O "Entrar na iniciativa" do menu do token continua entrando sem valor (o mestre escreve o número); só a Iniciativa da ficha rola.
- (assumido) A vantagem escolhida na ficha não vale para a iniciativa que entra na ordem (a sala rola um d20 simples).
- (assumido) O mestre "vendo como" um jogador só olha: não seleciona, não fecha a janela, não edita.
- (assumido) Quem tinha a preferência `tabletop:pref:ordem:montar` fica com uma chave solta no navegador (nada a lê mais).

**O que ficou para depois**
- Rolar para todos de uma vez (a intenção `combate.rolar` continua, sem botão) e esconder entrada ou valor dos jogadores: se o Vilella sentir falta,
  voltam como opção do menu de botão direito da linha.
- Seleção múltipla no mapa (entrar com vários tokens de uma vez).

## V3 — como ficou (2026-11-11)

Fichas em árvore e handouts; a aba Notas saiu; topo e abas do painel com tamanho igual. Detalhes de execução em `docs/ESTADO.md` ("Ajustes V3").

**O que foi feito**
- **Item 0 (pedido do Vilella com print).** No topo do mestre todos os botões têm o **mesmo tamanho (34 px)** e o **mesmo espaço (4 px)**, com o mesmo
  filete entre os grupos; os rótulos dos grupos saíram e o nome do grupo foi para a dica de cada botão ("Luz · Visão noturna"); o `aria-label` dos
  grupos continua. As abas do painel têm **todas a mesma largura** (a do painel dividida pelo número de abas, em grade), ícone igual, nome numa linha
  só cortado com reticências e a dica comum com o nome inteiro (agora sempre, também com o painel aberto). Recolhido, os ícones já eram iguais.
- **"+ Novo" é o botão único** da aba Fichas (só o mestre): Personagem, NPC, Handout e Pasta. "Pasta" e "Importar PDF…" saíram do alto;
  Artefato e Tesouro ("em breve") saíram.
- **Lista em árvore, sem caixas.** A pasta é uma linha (seta de recolher, nome, contador); os itens vêm embaixo com recuo e uma linha-guia fina.
  Um nível só. O mestre **renomeia clicando no nome** (Enter e clicar fora confirmam, Esc desfaz, **F2** com o nome em foco). Não há "⋯", lápis,
  cadeado, lixeira nem alça: as ações estão no **menu de botão direito** do item, da pasta e do handout (também **Shift+F10** ou a tecla de menu, com o
  `useMenuPorTeclado` do R6a). O item arrasta inteiro (R5b) e o handout também, para outra pasta.
  - Item (personagem/NPC): Abrir a ficha, Configurar… (quem edita), Mover para a pasta, Quem controla (marcar), Apagar… (confirma no menu; mestre).
  - Pasta: Renomear, Quem vê a pasta (marcar: só o mestre, todos, jogadores), Apagar… (só vazia; senão o item fica desabilitado e a dica diz por quê).
  - Handout: Abrir, Mostrar agora, Quem vê, Mover, Apagar….
- **"Importar PDF" dentro da ficha**, na aba Configurar, com esse nome e sem citar outro programa em texto visível. O botão (e o seletor de arquivo e a revisão)
  é o componente `ficha/BotaoImportarPdf.tsx` (o V4 o reaproveita). "+ Novo → Personagem" abre a ficha já em Configurar. A revisão continua igual; não
  há mais o caminho "ficha nova sem personagem" na aba (a revisão ainda deixa trocar o destino para "Ficha nova").
- **Handouts** (entidade nova): id, pasta, título (até 80), texto (até 20 000, texto puro), fonte (uma de 5), imagem opcional (asset local tipo retrato)
  e quem vê (mesmo `Visibilidade`; padrão só o mestre). Janela flutuante: título no cabeçalho, imagem no alto, texto na fonte; o mestre edita ali (título,
  fonte, texto com rascunho local como o campo de nota antigo, imagem, quem vê) e o jogador só lê. **Mostrar agora** manda o evento `handout.mostrado` só a
  quem vê o handout; a janela abre na hora. Num handout só do mestre o botão fica desabilitado e explica que ninguém mais o vê.
- **5 fontes, empacotadas pelo pnpm** (nada de Google Fonts): Simples = Inter (já era), Livro = **Lora** (`@fontsource-variable/lora`), Manuscrito = **Caveat**
  (`@fontsource-variable/caveat`), Medieval = **MedievalSharp** (`@fontsource/medievalsharp`), Datilografado = **Special Elite** (`@fontsource/special-elite`).
  O seletor escreve cada nome na própria fonte.
- **A aba Notas saiu.** Migração: `notaMesa` não vazia vira o handout "Nota da mesa" (todos) e `notaMestre` não vazia, "Nota do mestre" (só o mestre), numa
  pasta nova "Handouts" (só do mestre; o jogador a vê pelo handout que lhe cabe). Vale no banco (migração SQL 9) e na importação de exportação até a v12. A
  exportação nova é **v13** (`handouts` no lugar das notas). `nota.editar`, `notaMestre.editar` e os dois eventos saíram do protocolo; a capacidade
  `nota.editar` fica no enum só por compatibilidade e some da tela da aba Mesa.
- **Sigilo.** A sala não manda o handout (nem o título) a quem não o vê: filtro em `visaoPara`/`eventoPara`. A pasta chega ao jogador se ele a vê ou se vê algum
  handout dentro dela, e só com esses itens (os personagens continuam pela regra da pasta). A imagem do handout só é servida a quem vê o handout.

**Decisões (assumido)**
- (assumido) Botões do topo de 34 px e espaço de 4 px; filete de 1 px com 8 px de cada lado entre os grupos.
- (assumido) A dica das abas passa a existir também com o painel aberto (era só recolhido), para o nome cortado ter onde aparecer.
- (assumido) Um handout novo nasce na pasta "Handouts" (criada na hora se não existe), só do mestre, fonte "Livro", título "Novo handout".
- (assumido) A pasta nova nasce só do mestre, "Nova pasta"; apagar pasta e item pede confirmação dentro do próprio menu.
- (assumido) O jogador não vê "+ Novo" (não cria nada); o menu do handout é só do mestre; o jogador com item que edita tem Abrir e Configurar…
- (assumido) Mudar quem vê um handout, ou a pasta dele, manda **snapshot novo a todos** (como a visibilidade das pastas); mudar texto, título, fonte e imagem, não.
- (assumido) O arquivo da imagem do handout é do tipo retrato (a mesma regra e o mesmo seletor de imagem).
- (assumido) A migração das notas usa os ids fixos `handout-nota-da-mesa`, `handout-nota-do-mestre` e `pasta-handouts`.
- (assumido) Texto do handout é texto puro, sem formatação; o mestre vê um campo de texto na própria fonte (sem modo "ler" separado).
- (assumido) Os prints antigos (`auditoria`, `r4`, `r5b`) foram acertados só no que quebrava com a nova aba Fichas.

**O que ficou para depois**
- Handout com texto formatado, vários níveis de pasta e ordenar itens à mão.
- O V4 refaz a ficha e reaproveita o `BotaoImportarPdf`; o caminho "ficha nova a partir do PDF" na aba foi descartado.

## V3b — como ficou (2026-11-11)

Dicas enxutas (pedido do Vilella: "TUDO está com o tooltip ao passar o mouse, tá um saco"; outras mesas virtuais são a referência: menos é mais). Nada mudou na sala,
no protocolo, no estado nem na exportação: a opção nova vive só no navegador e nenhum frame foi criado. O **tour de introdução não entrou**: fica para
depois do V5 (`docs/IDEIAS.md`). Esta seção muda o que o R6a decidiu sobre dicas ("Uma dica só, com atalho": nome, o que faz e atalho, em todo botão).

**O que foi feito**
- **Dica só onde o controle não tem nome à vista** (`BotaoComDica.tsx`, `Dica.tsx`): botões só de ícone (barra de ferramentas, sub-barra do pincel, topo do
  mestre, zoom, Minimizar e Fechar das janelas, rodapé da ordem de turno, "+N" da presença, pausa e opções do relógio, pílula da pausa do jogador, alça de
  largura do painel, lixeiras e descansos da ficha, fontes de luz) e a aba **cortada** com reticências (ou com o painel recolhido). Saiu a dica de tudo
  que já mostra o nome: abas com o nome inteiro, botões com texto (`nomeVisivel`: "Mostrar agora", dados rápidos, itens das Fichas e das fontes de luz),
  linhas da ordem de turno, campos, itens de menu, cores do pincel e do novo token (a cor está à vista).
- **Uma linha só**: "Nome · atalho" (ou "Nome — motivo"). A segunda linha de explicação saiu; o texto que ela tinha foi guardado em
  `apps/web/src/textosDoTour.ts` (`TEXTOS_DO_TOUR`, por `data-testid` do controle) para o lote do tour usar. Nada lê esse módulo ainda.
- **Atraso** (`useDica`): no mouse a dica aparece com **700 ms** parado em cima (sair antes cancela); com outra dica aberta, ou fechada há menos de 300 ms,
  a próxima aparece **na hora** (passar de um botão a outro, como no Windows). No foco do **teclado** aparece na hora; foco que veio de
  clique de mouse (junto do `pointerdown`) não mostra. Esc, clique e perder o foco fecham, como antes.
- **Botão desabilitado**: a dica é "Nome — motivo" ("Ordenar pela iniciativa — A lista está vazia"). O motivo também é a descrição para leitor de tela.
- **Opção "Dicas ao passar o mouse"** em Preferências (`pref-dicas`; ligada por padrão; `dicasLigadas.ts`, `tabletop:pref:dicas`, try/catch, nenhum
  frame). Desligada, nenhuma dica no mouse nem no foco; `aria-label`, `aria-keyshortcuts` e a lista "Atalhos do teclado" continuam. Com ela desligada, o
  **clique** num botão desabilitado mostra o motivo num balão curto junto do botão (o mesmo balão, `aria-live="polite"`), que some em 2,8 s.
- **Conteúdo, não dica de botão**: a dica das condições e a da alça da tocha no mapa ficam como estavam, mas esperam os mesmos 700 ms (`Mesa.tsx`);
  aberta, acompanha o ponteiro. Elas **não** obedecem à opção de desligar (é informação do mapa, não ajuda de botão).
- **`title` nativo**: saiu de tudo que mostra o nome (botões com texto, campos, abas, itens de menu, nome da pasta, cena, handout) e dos números de
  rolagem da ficha (o nome da linha está ao lado). Nos só-ícone virou a dica comum (fechar de modais e do aviso, recolher da pasta, lixeiras da ficha,
  descansos, proficiência, régua fixada, exaustão no menu do token). Num botão ou item desabilitado com motivo, o `title` é "Nome — motivo".

**Decisões (assumido)**
- (assumido) 700 ms no mouse; troca na hora com outra dica aberta ou fechada há menos de 300 ms; teclado na hora.
- (assumido) O cabeçalho das janelas já mostra o nome: a dica "Mover a janela · setas" só aparece no foco do teclado, não no mouse.
- (assumido) A dica dos marcadores do mapa continua ligada com a opção desligada (conteúdo do mapa).
- (assumido) O clique num desabilitado só mostra o balão com as dicas desligadas; com elas ligadas, a dica no mouse já diz o motivo.
- (assumido) Pincel sem permissão: dica "Pincel — Pincel desligado: o mestre tirou de você a permissão de desenhar." e o aviso "Entendi" de antes.
- (assumido) Cores da paleta do pincel e do novo token ficam sem dica (a cor está à vista; o `aria-label` fica); as espessuras do pincel mantêm.
- (assumido) Continuam com `title` nativo, por não serem botões: avatares da presença (iniciais, com nome e estado), siglas dos atributos, ícones
  "quem vê" do handout e da cena (grupo, vista) e o progresso do preparo da cena (explica "3/7").
- (assumido) O balão do motivo reaproveita o elemento da dica (`dica-<testid>`).

**O que ficou para depois**
- O tour de introdução (plano em `docs/IDEIAS.md`; os textos já estão em `textosDoTour.ts`).
- Os ícones "quem vê" e os avatares da presença seguem com `title` nativo (não são botões; dica comum pediria foco e papel próprios).
- Toque: a dica por mouse não existe em tela de toque (como antes); o balão do motivo também depende do clique.

## V4a — como ficou (2026-11-11)

A ficha de personagem no desenho que o Vilella aprovou (protótipos em `docs/desenho/`, `FichaFinal.dc.html` é a fonte da verdade). O primeiro V4a copiava o PDF da Biblioteca Élfica em papel branco e foi recusado ("melhor, mas não tá top"); a parte de dados e protocolo ficou, o visual foi refeito. NPC fica para o V4b. Execução em `docs/ESTADO.md` ("Ajustes V4a").

**O que foi feito**
- **Janela**: abre com ~880 px (a área limita), cabeçalho no tema, minimiza pelo botão ou por duplo clique e então fica só o cabeçalho com o nome, na largura do nome. Fica na **camada mais alta** (`z-index` 45 a 59, acima dos painéis e das outras janelas, abaixo de avisos, menus e modais); entre fichas vale o último clique. Estende a `Janela` do R3 (`camadaAlta`, `cabecalhoMinimizado`), sem outro sistema.
- **Cabeçalho**: nome com capitular (IM Fell English SC), classe e nível, antecedente, raça, tendência e XP editáveis, as quatro abas como **fitas** à direita (Personagem, Magias, História, Configurar) e a faixa **Vantagem / Normal / Desvantagem**, que vale para todas as rolagens da ficha até a pessoa trocá-la (estado da janela, não volta sozinha a Normal).
- **Aba Personagem em 3 colunas**: atributos (modificador grande clicável, valor no oval), Inspiração e Proficiência, Salvaguardas e Perícias com o título ornamentado **em cima** dentro do bloco, Percepção passiva; CA, Iniciativa e Deslocamento; PV com − e + (o dano consome o temporário primeiro) e barra; dados de vida (gastar rola `1dN+Con`); testes contra a morte; **Moedas** (com o total em po); **Ataques e magias** em lista (nome rola acerto e dano juntos, ou conjura se for magia; botão Acerto e botão Dano; engrenagem); **Equipamento** com quantidade à esquerda (− e +), peso e carga; Traços, Ideais, Vínculos e Defeitos; Características e Talentos (seta que gira, título em `acentoForte`, origem em itálico, chat). A direita ficou com ~250 px.
- **Editor da engrenagem** ("vira a página" sobre o meio e a direita; na estreita ocupa o corpo): Ataque (atributo ou valor fixo, bônus extra e mágico, margem de crítico, proficiente), Dano (dados, atributo, bônus, tipo, extra no crítico, **segundo dano**), Salvaguarda (teste do alvo, atributo da CD, bônus, CD calculada, efeito no sucesso), Preparo (só magia, com "Mostrar em Ataques e magias"), Descrição, **prévia ao vivo** ("+13 para acertar · 1d8+9 radiante; crítico 2d8+9"), Rolar, Mandar ao chat e Remover. O "+" (Novo ataque) cria e abre o editor.
- **Aba Magias**: atributo de conjuração, CD e ataque; espaços por nível em bolinhas (cheia = disponível; clicar gasta e recupera); "Recuperar espaços"; magias por nível que expandem (compêndio, se houver vínculo; senão escola, tempo, alcance, componentes, duração e texto editáveis), Preparada, **Conjurar** (gasta o espaço, ou o de pacto se os comuns acabaram, e rola o que a magia tiver; sem rolagem manda o cartão), o mesmo editor da engrenagem.
- **Aba História**: personalidade, aparência (imagem local e descrição), aliados, símbolo, história, tesouro, outras características, idiomas e notas, em caixas com linhas de caderno.
- **Aba Configurar**: "Aparência da ficha: Livro / Clássica" no alto, mais o que já existia (Importar PDF, quem vê e edita, token, retrato, exportar e importar a ficha).
- **Janela estreita** (< 620 px de largura **da janela**, medida por `ResizeObserver`, não da tela): cabeçalho grudado com abas, nome, CA, iniciativa, deslocamento, modo e PV com −/+; seções em acordeão (Identidade, Atributos, Salvaguardas e perícias, Vida e morte, Moedas, Ataques, Equipamento, Personalidade, Características). A escala por zoom do primeiro V4a **saiu** (`papel.tsx` foi apagado).
- **Aparência Livro / Clássica**: preferência local `tabletop:pref:aparenciaFicha` (padrão `livro`, com try/catch, nunca vai à sala); troca por `data-pele` na raiz da ficha. Livro: fitas, capitular, IM Fell English SC + EB Garamond, caixa de marcar quadrada, filetes em `acentoForte`. Clássica: Cinzel, Cormorant SC, Alegreya, abas planas sublinhadas, caixa de marcar nativa. Mesmo arranjo. Todas as fontes por @fontsource (só os pesos usados); nada de Google Fonts.
- **A ficha segue o tema (sem papel branco)**: os seis tokens `ficha*` saíram; o CSS vive em `apps/web/src/ficha/ficha.css` (tudo prefixado `.fl-raiz`) e usa só os tokens do tema.
- **Rolagem no chat** (toda rolagem, não só a da ficha): bloco baixo; o nome do teste em destaque ("Percepção", "Ataque · Lâmina Solar"), o total é o número grande e o d20 fica discreto; com vantagem ou desvantagem aparecem os dois d20 e o descartado esmaecido (opacidade 0,4); ataque mostra acerto e dano lado a lado, com a CD e "metade no sucesso" quando há salvaguarda. **Crítico em verde fixo (`#2FA46A`) e 1 natural em vermelho fixo (`#E5484D`)** nos 14 temas: tokens `critico`, `criticoTexto`, `falhaCritica`, `falhaCriticaTexto`. Rolagem oculta, do mestre, cartões de magia e de característica e a ordem de turno do V2 seguem. Quem rola é sempre a sala.
- **Dados**: `Ataque` e `Magia` ganharam campos opcionais de rolagem (`alcance`, `bonusMagico`, `atributoDano`, `bonusDano`, `margemCritico` 18 a 20, `danoCritico`, `dano2`, `salvaguarda`; `descricao` no ataque; `tempo`, `componentes`, `duracao` e `emAtaques` na magia); `ItemDaFicha.peso` (kg); `Caracteristica.origem`. O pedido e o resultado do modelo de ataque levam `margemCritico`, `danoCritico` e `salvaguarda`. Tudo opcional: a campanha antiga carrega sem migração e a ficha versão 1 e 2 seguem lendo. Funções puras em `packages/shared/src/ataques.ts` (dano, CD, prévia), `moedasEmOuro`, `cargaDaFicha` e `receberDano` em `ficha.ts`. Do primeiro V4a ficam os campos da ficha (xp, moedas, personalidade...), `chat.caracteristica` (agora com `origem`), os hashes `aparenciaHash`/`simboloHash` e o importador da ficha em PDF.

**Decisões (assumido)**
- (assumido) A faixa de vantagem não volta sozinha a Normal depois do d20 (o protótipo mostra "Rolando: Normal" fixo); o primeiro V4a voltava.
- (assumido) Dado de vida: gastar rola `1dN+Con` na sala e marca o dado como usado; a cura **não** é somada sozinha aos PV (o cliente não conhece o resultado; a pessoa ajusta o PV).
- (assumido) O "bônus extra" de perícia e salvaguarda (que o desenho não tem) aparecia só com o mouse em cima ou o foco na linha. **Mudou no V4a3**: abre só pelo botão direito ou Shift+F10 (ver "V4a3 — como ficou").
- (assumido) Onde o desenho não tem lugar, a ficha mantém: Idiomas e outras proficiências e Notas na aba História; Condições, luz (mochila) e Recursos num painel abaixo das três colunas da aba Personagem.
- (assumido) Dano com segundo dano ou extra no crítico entra na mesma rolagem do chat; o tipo vira "Radiante + Fogo".
- (assumido) Botão Acerto sem dano rola um teste "Ataque · Nome"; Dano solto vai pelo `/r` do chat, com o nome, a CD e o tipo.
- (assumido) O nome do personagem na ficha se edita pelo cabeçalho (`personagem.editar`, a mesma permissão da Configurar).
- (assumido) A ficha larga pode cobrir a ordem de turno (camada mais alta); quem quer as duas move uma.
- (assumido) O valor fixo de acerto importado de PDF continua valendo; no editor aparece como "Valor fixo".

- **V4a2 (correções)**: na janela larga a identidade (classes, antecedente, raça, tendência, XP) passou a rolar no alto do corpo; fica fixo só capitular + nome, fitas e faixa de modo (~120 px). Rolagem livre (`/r`, botão Dano, Lançar de truque) usa o bloco baixo do chat, com o texto como nome, total grande, fórmula, d20 e tags de 20/1 natural; a inline `[[...]]` não mudou. O dado de vida agora é da sala (`ficha.dadoDeVida`: rola, marca, soma ao PV com teto, publica) e o objeto de luz mora na linha do equipamento: o item é de luz se tem `modeloId` de um modelo da mesa ou nome igual ao de um modelo; Acender/Apagar e as sublinhas das usadas ficam abaixo da linha; o + de item de luz é só do mestre; sem token na cena ou sem mão livre o botão fica desabilitado com motivo. Sem seletor de modelo na linha: vale só o `modeloId` ou o nome. As ações diretas da ficha (dado de vida, tocha, rolagens) mandam antes a gravação agrupada pendente, para não serem desfeitas por ela.

**O que ficou para depois (V4b)**
- Ficha de NPC no desenho N (a atual segue funcionando); arrastar do compêndio para a ficha; reordenar ataques, equipamento e características por arrasto ou Alt+↑/↓; acender e apagar tocha no equipamento.
- Firefox e Safari não foram conferidos (`color-mix`, `clip-path` das fitas).

## V4a3 — como ficou (2026-11-12)

Lote pequeno, só na ficha de personagem. O Vilella abriu o Rendan (Clérigo da campanha, importado do PDF sem classe) e a aba Magias não tinha onde gastar espaço.

**O que foi feito**
- **Espaços por círculo sempre à vista**: cada círculo de 1 a 9 mostrado tem no cabeçalho o título, "Espaços totais [n]" (campo editável sem hover; o `fl-bonus-extra` saiu daqui) e "Restantes n"; as bolinhas vêm numa linha logo abaixo. O total vem da tabela de multiclasse; o número escrito sobrescreve (`espacosTotal`). Apagar o campo ou o botão "auto" (só aparece com número escrito e círculo na conta das classes) volta ao automático. Sem classe o total manual funciona igual: total 4 no 1º círculo dá 4 bolinhas. Círculos mostrados: com magia, com total maior que 0, o 1º e os abertos por "+ Círculo".
- **Rótulo "Prep."** sobre a coluna dos checkboxes de cada círculo de 1 a 9 que tem magia (nome completo "Preparada" para leitor de tela e na dica).
- **Conjuração sem classe**: a caixa Atributo vira seletor; com a escolha, CD (8 + proficiência + mod.) e Ataque rolam como na ficha com classe. Campo novo e opcional `habilidadeDeConjuracao` (sem migração); funções `conjuracaoSemClasse` e `espacosAutomaticos` em `ficha.ts`; `derivar` devolve `conjuracaoSemClasse`. O aviso agora é "Sem classe: escolha o atributo de conjuração" e some com a escolha. Com classe conjuradora o campo não vale.
- **Dados de Vida**: as bolinhas quebram de linha dentro do bloco (24 px cada) até 12 por tipo; acima disso vira o contador "7/20" com − e + (marca um dado como gasto, sem rolar, e recupera).
- **Modificador extra de perícia e salvaguarda**: não aparece mais no hover nem no foco. Botão direito na linha, ou Shift+F10 / tecla Menu na linha em foco, abre o popover "Modificador: [caixa]" (positivo e negativo; Enter ou Esc fecha e o foco volta ao botão da linha). Com valor diferente de zero um ponto discreto na linha avisa (`fl-bonus-marca`). Peças novas em `ficha/modificadorExtra.tsx`; o popover sai por portal no body e usa a classe `popover` do app.

**Decisões (assumido)**
- (assumido) A escolha do atributo sem classe fica num campo novo, não em `conjuracao` com classe vazia (o schema exige classe com 1 caractere ou mais).
- (assumido) As bolinhas dos espaços ficam numa linha abaixo do cabeçalho do círculo, porque título, total e restantes já enchem a coluna de ~326 px.
- (assumido) "+ Círculo" mostra o menor círculo oculto de cada vez; o círculo aberto só some se ficar sem magia e sem total e a janela for fechada (o estado é local).
- (assumido) Limite do contador compacto dos dados de vida: acima de 12 por tipo.
- (assumido) O modificador só abre para quem edita a ficha; para os outros o botão direito mostra o menu do navegador.

**O que ficou para depois**
- Importador do PDF: o Rendan veio sem classe e nível (item em `docs/BUGS.md`).

## V4b — como ficou (2026-11-12)

Três coisas num lote: a ficha de NPC no desenho N (`docs/desenho/NpcN.dc.html`), arrastar do compêndio para a ficha (personagem e NPC) e segurar uma linha para reordenar. O Vilella deixou o lote sozinho: o que o brief não dizia foi assumido e está marcado.

**O que foi feito**
- **Ficha de NPC (bloco de monstro).** O personagem NPC abre num bloco: estandarte com o nome e a inicial, tamanho, tipo e tendência, CA em escudo (com o tipo de armadura), PV com −/+ e a fórmula ("7d10 + 21"), deslocamento em metros, a faixa Vantagem/Normal/Desvantagem, os seis atributos em escudo (o modificador rola o teste; o valor se edita) com o botão "Salv." de cada um, e as linhas Testes de resistência, Perícias, Vulnerabilidades, Resistências, Imunidades, Imunidades a condições, Sentidos (com Percepção passiva, que rola), Idiomas e Desafio (com XP e proficiência). Depois, Traços, Ações, Reações e Ações lendárias. Reações e Lendárias só existem enquanto há linha; quem edita vê "+ Reação" e "+ Lendária" discretos. Janela de 520 px (a medida do protótipo), mínima 380 px, camada alta, minimiza para só o nome, abaixo de ~460 px vira uma coluna (container query).
- **Importar mantém a apresentação:** importar o PDF (por cima ou criando) e importar o arquivo de ficha deixam o item como estava (ficha de personagem ou de NPC); sem isso um "Novo personagem" (sem jogador editor) viraria NPC ao importar.
- **Quem é NPC:** `apresentacaoDoPersonagem` (`pastas.ts`): a escolha em Configurar → "Ficha de: Personagem / NPC" (campo `ficha.apresentacao`) vale; sem escolha vale a regra do app (pasta NPCs ou nenhum jogador editor). "+ Novo → NPC" e "+ Novo → Personagem" já gravam a escolha. A engrenagem do cabeçalho do bloco alterna entre o bloco e a Configurar (sem abas no NPC).
- **Ações "bem fechadinhas".** Uma linha por ação: título em destaque (expande o texto completo e o "Mandar ao chat"), chips de tipo e alcance, bolinhas de usos por dia, "Recarga 5–6" (caixa que marca disponível ou gasta, mais um botão que rola o d6 no chat), à direita o botão de Acerto ("+6": rola acerto e dano no mesmo bloco do chat) e o de Dano ("2d8+4": só o dano), alinhados em colunas fixas. A engrenagem abre o mesmo `EditorDeAtaque` do personagem dentro da linha, com um bloco a mais do monstro (onde mora, tipo, recarga, usos). Ação sem jogada troca os dois botões por "Mandar ao chat".
- **Dados.** `FichaSchema` ganhou, tudo opcional: `apresentacao`, `npc { tamanho, tipo, pvFormula, sentidos, vulnerabilidades, resistencias, imunidades, imunidadesCondicoes, nd }`; em `Ataque`: `categoria` (ação, reação, lendária), `tipoDeAcao`, `recarga`, `recarregado`, `usos {max, gastos}`. Traços são `caracteristicas`; ações, reações e lendárias são `ataques` com `categoria`; a tendência é `alinhamento`, a CA é `ca` (com `nota` para o tipo de armadura), idiomas e perícias são os de sempre. O bônus de proficiência de uma ficha com `npc.nd` vem do ND (`bonusPorND`, tabela do SRD), então acerto, salvaguardas e perícias saem das mesmas contas; o XP vem de `xpDoND`. Ficha antiga carrega igual (teste de unidade).
- **Exemplos.** O Ogro da semente (`fixtures/campanha.seed.json`) está completo (SRD 5.1: CA 11, 59 PV, Clava Grande e Azagaia). O exemplo de compêndio (`fixtures/compendio/exemplo-srd.json`) ganhou 9 armas e 5 itens do SRD 5.1 (CC-BY-4.0, atribuição em `fixtures/compendio/ATRIBUICAO.md`). Não há "NPC do exemplo SRD" separado: o exemplo é um compêndio, e o Ogro é o NPC.
- **Compêndio com armas e itens.** O arquivo ganhou `armas` e `itens`, opcionais (o arquivo só de magias continua valendo). A aba tem Magias, Armas e Itens quando o arquivo traz os dois últimos. Monstros: não existem no compêndio (fora do lote).
- **Arrastar do compêndio.** Cada entrada (magia, arma, item) é arrastável (`dataTransfer` com o tipo `application/x-tabletop-compendio`). No começo do arrasto as áreas da ficha aberta que aceitam aquele tipo acendem (contorno tracejado no acento e um aviso "Solte aqui..."); as outras não; soltar fora não faz nada; só quem edita a ficha solta. A conversão é função pura na `shared` (`compendioParaFicha.ts`, `aplicarEntradaNaFicha`) e o botão "Adicionar à ficha" usa a mesma.
  - **Personagem:** arma vira ataque calculado em Ataques e magias (atributo certo, acuidade, distância, proficiência, dano com o modificador, propriedades na descrição). Magia entra no círculo dela (só esse círculo acende; um círculo vazio aparece enquanto se arrasta) e, se o texto tem "ataque de magia" ou "salvaguarda de ...", ganha a jogada (acerto ou CD pela habilidade de conjuração, o primeiro "NdM de dano ...") e `emAtaques`. Item vai para o Equipamento (quantidade 1, peso do compêndio; já tem, soma uma unidade); o nome igual ao de um modelo de luz já dá o Acender pela regra do V4a2.
  - **NPC:** arma vira Ação calculada pelos atributos e pelo bônus do ND; magia entra no traço "Conjuração" (uma linha por nível); item vira Traço com o texto.
  - Soltar no lugar exato de uma lista põe o item ali (linha indicadora durante o arrasto).
- **Segurar para reordenar.** ~300 ms numa linha a "levanta" (contorno e fundo no acento); arrastar mostra a linha indicadora; soltar move; Esc cancela (o clique de depois não abre nada); um clique curto faz o de sempre. Listas: Ataques e magias (ataques entre si, magias entre si), Características e talentos (e Outras), Equipamento (a linha do item leva as sublinhas de luz junto) e as magias de cada círculo; no NPC, Traços, Ações, Reações e Lendárias. Teclado: Alt+↑ e Alt+↓ na linha em foco (o foco acompanha o item); registrado em `atalhos.ts` (`fichaMoverLinha`) e na lista das Preferências. A ordem nova vai numa operação só (`ficha.alterar` com a lista inteira), pela gravação agrupada. A lógica pura está em `reordenar.ts` (`posicoesDoGrupo`, `moverNoGrupo`, `inserirNoGrupo`) e o gesto em `ficha/ordem.tsx` (`useOrdemDaLista`, `useSoltarDoCompendio`).

**Decisões (assumido)**
- (assumido) 520 px de largura do NPC (a medida do protótipo, não os ~620 px do brief) e uma coluna abaixo de 460 px.
- (assumido) O botão Acerto da ação rola acerto e dano juntos (como o protótipo N) e o título só expande; no brief "o nome rola os dois" e "o título expande" não cabem juntos no mesmo clique.
- (assumido) Reações e lendárias são `ataques` com `categoria`, e as ações sem jogada têm o botão "Mandar ao chat" no lugar de "Conjurar".
- (assumido) A recarga se rola no chat (a sala rola) e a caixa "Recarga" se marca à mão; não há rolagem local.
- (assumido) A arma do compêndio entra com proficiência; no NPC o bônus vem do ND.
- (assumido) A magia solta em Ataques e magias entra na lista de magias e aparece nos ataques mesmo sem jogada; a solta numa aba Magias só aparece nos ataques se o texto tem ataque de magia ou salvaguarda.
- (assumido) Perícias e testes de resistência do NPC mostram só os com proficiência (chips que rolam), com "+ Perícia" e "+ Resistência" para quem edita; as seis "Salv." sob os atributos rolam todas.
- (assumido) Os botões de descanso curto e longo não aparecem no NPC.
- (assumido) Dados do compêndio: `armas` e `itens` opcionais no mesmo arquivo `magias.json`, sem versão nova do formato.
- (assumido) Item de luz solto por jogador segue a regra de hoje: só o mestre repõe objetos de luz, e a sala recusa o aumento.
- (assumido) Ao reordenar, as linhas expandidas voltam fechadas (elas se identificam pela posição).

**O que ficou para depois**
- Monstros no compêndio (arrastar um monstro para criar o NPC).
- Toque: o segurar funciona com o ponteiro, mas o navegador pode tomar o gesto para rolar a página (não foi testado em celular).
- Arrastar uma magia para um círculo diferente do dela não a muda de círculo (só o círculo dela aceita).

## V4b2 — como ficou (2026-11-12)

Dois pedidos do Vilella, o lote deixado sem ninguém para perguntar: tudo o que o brief não dizia foi assumido e está marcado.

**O que foi feito**
- **Seção Conjuração no bloco de NPC** (`ficha/ConjuracaoDoNpc.tsx`), entre Traços e Ações, com o filete das outras seções. Os dados são os da ficha de personagem (`magias`, `espacosTotal`, `espacosGastos`, `habilidadeDeConjuracao`), então trocar Personagem ↔ NPC mantém tudo (teste de unidade). Não há campo novo.
  - Cabeçalho: atributo de conjuração (seletor para quem edita), CD e ataque de magia pelo bônus de proficiência do ND; clicar no ataque rola no chat.
  - Uma linha por círculo, com o mesmo nome de nível da aba Magias do personagem: "Truques (à vontade):", "1º nível:", ... Bolinhas de espaço (marcam e desmarcam), o total do círculo num campo pequeno (só para quem edita) e as magias em chips.
  - Clicar na magia abre o texto na própria seção (o cartão do compêndio, se a magia vem dele): Conjurar ou Lançar (`conjurar.ts`, o mesmo fluxo do personagem: gasta o espaço, rola ataque, CD e dano no bloco do chat, sem espaço avisa), Mandar ao chat e a engrenagem com o `EditorDeAtaque` na própria seção.
  - A seção existe quando há magias, atributo ou total de espaços escolhido; quem edita vê um "+ Conjuração" discreto que a cria. "+ Círculo" mostra mais um círculo vazio. Cada círculo tem o campo "Nova magia".
- **Arrastar do compêndio:** a magia solta no NPC entra em `magias`, no círculo dela e calculada como no personagem (`magiaParaFichaCalculada`); a seção Conjuração é a área que acende (se ela ainda não existe, aparece enquanto se arrasta). `colocarMagiaNaConjuracao` e o traço "Conjuração" saíram. O botão "Adicionar à ficha" faz o mesmo (`aplicarEntradaNaFicha`). A posição da soltura vale dentro do círculo (os chips correm em fluxo: opção `fluxo` em `ordem.tsx`).
- **Reordenar:** as magias de cada círculo, segurando ~300 ms ou Alt+↑/↓ no chip em foco.
- **Nome com capitular** (`ficha/NomeComCapitular.tsx`, a mesma peça no personagem e no monstro). A capitular é só desenho (`aria-hidden`; clicar nela foca o campo, cursor no fim). Fora de edição mostra a primeira letra maiúscula e o campo o resto ("V" + "ashta Carteiro"; "O" + "gro"). Com foco o campo mostra o nome inteiro; Enter ou sair grava e a letra "pula"; Esc desfaz; nome vazio não grava; limite de 64. Pele Clássica: nome inteiro num campo só, sem capitular. O campo tem `aria-label` "Nome do personagem: <nome>" fora de edição, para o leitor de tela ler o nome todo.

**Decisões (assumido)**
- (assumido) O "+ Conjuração" e a primeira magia solta num NPC sem classe escolhem o maior entre Inteligência, Sabedoria e Carisma (empate: nessa ordem) e gravam em `habilidadeDeConjuracao`.
- (assumido) Conjurar um círculo sem espaços (total 0) avisa "Sem espaços", como no personagem; o mestre define o total na linha do círculo.
- (assumido) O total de espaços é um campo pequeno na própria linha (não um popover); sem classe a tabela automática não vale.
- (assumido) A capitular mostra a letra do texto digitado ao vivo, e o nome é guardado como foi escrito (a capitular só mostra a letra em maiúscula).
- (assumido) Com o ponteiro o cursor vai para o fim do nome; por Tab ou por código o nome inteiro fica selecionado.
- (assumido) O exemplo com 4 magias do SRD está só nos prints (o dragão), não no compêndio de exemplo nem na semente.

**O que ficou para depois**
- Magia inata ("1/dia cada") no bloco de NPC (está em `docs/IDEIAS.md`).
- Espaços de pacto do Bruxo no bloco de NPC.

## V5 — como ficou (2026-11-12)

Um pedido do Vilella: paredes e portas só para o mestre, "Visão do mestre", encaixe em meia célula e arcos. O lote foi feito sem ninguém para perguntar: o que o brief não dizia foi assumido e está marcado.

**O que foi feito**
- **Quem vê os contornos** (só desenho; visão, luz e bloqueio usam as paredes como antes). O mapa recebe a opção `contornos`: o mestre com a Visão do mestre ligada, ou o jogador numa cena com "Mostrar paredes e portas aos jogadores" (campo novo `Cena.mostrarParedesAosJogadores`, desligado por padrão; cena antiga = desligado). A ferramenta Paredes mostra sempre (para editar).
  - Jogador sem a opção: nenhuma linha de parede, janela ou porta e nenhum ícone de porta. Com a opção: parede e janela discretas, porta colorida como antes, ícone da porta. A parede `invisivel` nunca é desenhada para o jogador.
  - Com os contornos escondidos o jogador (e o mestre) continua abrindo a porta pelo clique no lugar dela; passar o mouse destaca a porta (contorno e ícone) e o cursor vira mão (`pointer`). A secreta continua sem chegar ao jogador.
- **"Visão noturna" virou "Visão do mestre"** (mesmo botão da lua, `menu-visao-noturna`). Ligada (padrão): visão noturna e os contornos. Desligada: mapa claro e sem contornos. Preferência só da tela dele, como antes.
- **Encaixe em meia célula:** `encaixarMeiaCelula` (`shared/src/paredes.ts`) leva o ponto à rede de meia célula (9 pontos por quadrado: cantos, meios das arestas e centro). Qualquer direção entre os pontos vale (diagonal) e o menor segmento é meia célula. Alt continua soltando do grid. Enquanto desenha, o ponto de fixação sob o cursor é circulado e os pontos de meia célula em volta aparecem como pontinhos (só com o encaixe ligado).
- **Arco (tecla A):** a sequência é encadeada como sempre (clique, clique...; Esc, duplo clique e agora também o clique direito encerram). A tecla A alterna linha e arco. No modo arco, o próximo trecho é um arco **tangente** ao trecho anterior (reta ou arco), com prévia ao vivo; sem trecho anterior, é o **arco de 3 pontos** (início, fim e o terceiro clique dá a curvatura). Encaixa na meia célula também. O modo volta a "linha" ao encerrar a sequência. O painel mostra "Desenhar como (linha/arco)".
- **Modelo:** `Parede.meio?` (um ponto do arco entre `a` e `b`; a parede passa por `a`, `meio` e `b`). Sem o campo é reta (toda parede antiga). `segmentosDaParede` transforma o arco em segmentos de ~10° e é o que a visão (`mapaPixi`), a luz e a passagem (`trajetoBloqueado`) leem. `meioDaParede` devolve o meio do arco (onde fica o ícone da porta).
- **Selecionar, mover pontas, apagar e mudar o tipo** funcionam no arco como na reta; mover uma ponta leva o ponto do arco junto (ele anda com o meio da corda). O painel mostra "(Arco)" no item selecionado.
- **Intenções:** `parede.criar` aceita `meio` em cada parede; `parede.editar` aceita `meio` (`null` endireita); `cena.editar` aceita `mostrarParedesAosJogadores`. Três pontos alinhados não fazem arco (a parede nasce reta).
- Tecla A na tabela de atalhos (grupo Ferramentas) e no texto da ferramenta (tour).

**Decisões (assumido)**
- (assumido) A opção por cena fica no "Configurar cena", desligada por padrão, e só entra no estado quando está ligada.
- (assumido) Com os contornos escondidos a porta sob o mouse se destaca (contorno e ícone) e o cursor vira `pointer`; vale também para o mestre com a Visão do mestre desligada.
- (assumido) O arco de 3 pontos usa o terceiro clique como um ponto por onde o arco passa (pode estar do lado que quiser; o arco vai de `a` a `b` passando por ele, até mais de 180°).
- (assumido) O arco tangente com o fim sobre a tangente vira reta; com o fim "atrás" vira arco maior que meia volta.
- (assumido) Clicar duas vezes no ponto final de um arco de 3 pontos fecha só uma reta.
- (assumido) O modo arco é zerado ao encerrar a sequência e ao trocar de ferramenta.
- (assumido) O jogador numa cena com contornos ligados vê parede e janela em linha fina; a invisível nunca.
- (assumido) O passo do arco é 10° (erro de corda de cerca de 0,4% do raio); um arco inteiro tem no máximo 36 segmentos.
- (assumido) "Ver como o jogador X" desenha como o jogador (a opção da cena), não como o mestre.

**O que ficou para depois**
- Alça no meio do arco para ajustar a curvatura arrastando (hoje: mover uma ponta, ou apagar e redesenhar; `parede.editar` com `meio` já existe para a futura ferramenta).
- O ícone da porta em arco fica no meio do arco; não gira com a parede.
- A ferramenta do MCP para paredes (PROJETO 4.12 descreve os campos).

## B1 — como ficou (2026-11-12)

Primeiro lote de bugs, depois dos V1 a V5: o importador do PDF do Rendan e três detalhes vistos nas revisões. Sem ninguém para perguntar: o que o brief não dizia foi assumido e está marcado.

**O que foi feito**
- **Importador (`shared/src/importarFichaPdf.ts`):** o campo "Classe & nível" cortado com "…" é lido por `classeDeTextoCortado` (começo da palavra = uma classe do SRD só; o resto é a subclasse). O nível vem do número sem rótulo sob os PV temporários (dados de vida) ou, sem ele, do menor nível que dá o bônus de proficiência impresso; um incerto `classes.0.nivel` avisa. Raça, antecedente e tendência passam por `importarTraducoes.ts` (tabelas pequenas e puras). Antecedente, raça e tendência só leem itens que começam na coluna do rótulo (o texto largo da classe invadia a coluna do antecedente). Idiomas rotulados ("IDIOMA: ... ARMADURA: ...") são separados das outras proficiências. O texto de Traços, Ideais, Vínculos e Defeitos fica abaixo da faixa do cabeçalho.
- **Compêndio:** `useAlvoDaFicha` (`AbaCompendio.tsx`) e `useFichasNaPilha` (`janelas/pilha.ts`): o "Ficha de" é a ficha em foco que a pessoa edita.
- **Aviso:** `JanelaDaFicha` recebe `avisar` da `Mesa` (o toast `AvisoPerto`); `AvisoPerto` usa `role="status"` quando não há código de erro da sala (e `alert` quando há).
- **Conjuração do NPC:** `.npc-conj-chips` com `flex: 1 1 100%` (`ficha.css`).
- Fixtures: `fichas/brendan.pdf` e `fichas/brendan.json` (o esperado, sem as descrições longas).

**Decisões (assumido)**
- (assumido) Raças do SRD em português: Humano, Humano (variante), Anão (da colina, da montanha), Elfo (Alto elfo, Elfo da floresta, Drow), Halfling (pés-leves, robusto), Draconato, Gnomo (da floresta, das rochas), Meio-elfo, Meio-orc, Tiefling. Nome desconhecido fica como veio.
- (assumido) Tendência: "LB" e "LG" viram "Leal e Bom", "N" e "True Neutral" viram "Neutro", "CN" vira "Caótico e Neutro"; nome completo em inglês também; texto já em português fica como veio ("Caótico Mau" do Darion).
- (assumido) "Acolyte" vira "Acólito" e os idiomas do SRD também ("Common" é "Comum").
- (assumido) Nível a partir dos dados de vida (uma classe só) e, sem eles, do bônus de proficiência (menor nível do degrau); sempre com o incerto para o jogador conferir.
- (assumido) A escolha à mão no "Ficha de" vale até a ficha em foco mudar; sem ficha aberta, a primeira da lista.
- (assumido) O aviso de ficha (inclusive "Descanso feito") usa o toast da mesa, no alto da área do mapa (sem origem), em vez de um parágrafo dentro da ficha.
- (assumido) Os chips da Conjuração ficam numa linha própria mesmo quando há pouca coisa na linha de cima.

**O que ficou para depois**
- Tradução dos nomes de itens, magias e ataques da ficha impressa (ficam em inglês), "preparada" (o PDF não traz) e os tipos de dano cortados do PDF.
- Classe e subclasse de quem é multiclasse com o campo cortado.

## C1 — como ficou (2026-11-12)

Primeiro lote do marco "Mesas e contas" (PROJETO 4.14): várias mesas no mesmo servidor, id amigável e a tela inicial.

**O que foi feito**
- `packages/shared/src/mesas.ts`: `gerarIdDeMesa`, `normalizarIdDeMesa`, `ehIdDeMesa`, `nomeDeMesaValido`, `estadoDeMesaNova` e as constantes da mesa legada.
- Servidor: `Diretorio` (`diretorio.ts`, `registroDeMesas.ts`), `inicializacao.ts` (`carregarOuSemear`, `criarMesaNova`), `Sala` com `POST /criar` e 404 enquanto não criada, Worker com as rotas `/api/mesas` e `/api/m/<id>/...`, cookie por mesa (`tabletop_sessao`), migração de DO `v2`.
- Web: `rotas.ts`, `TelaInicial.tsx`, `IdDaMesa.tsx`, `mesasLocais.ts`, `App.tsx` com `/` e `/m/<id>`, bloco "Esta mesa" no alto da aba Mesa, "Trocar de mesa", título da aba, pasta de imagens por mesa.
- Nada na mesa legada (o DO "campanha") é copiado, movido, apagado nem reescrito.

**Decisões (assumido)**
- (assumido) A mesa legada se chama "Campanha" no diretório (o mestre pode renomear).
- (assumido) Limite de 5 mesas por hora por IP; em `MODO=teste` o freio não vale.
- (assumido) `GET /api/mesas` fora do `LISTAR_MESAS=1` responde 404 (some, em vez de 403).
- (assumido) `GET /api/mesas/<id>` devolve também `legada`, para a tela saber que deve herdar a pasta de imagens de antes.
- (assumido) O cookie ganhou outro nome (`tabletop_sessao`): o `tabletop_usuario` de antes (`Path=/`) valeria em toda mesa. Quem já estava logado escolhe o usuário de novo, uma vez.
- (assumido) Renomear é uma rota (`POST /api/m/<id>/renomear`), não uma intenção da sala: o nome é do diretório. Os outros navegadores só veem o nome novo ao recarregar.
- (assumido) O nome e o id ficam na aba Mesa (só do mestre): o jogador recebe o link do mestre.
- (assumido) A memória do mapa (IndexedDB, por usuário e cena) não é separada por mesa: os ids de cena de mesas diferentes quase nunca coincidem.
- (assumido) Título da aba: "Távola · nome da mesa" (e " · cena" com a mesa aberta).
- (assumido) A tela inicial lembra até 30 mesas por navegador.

**O que ficou para depois**
- Contas, pedidos de entrada, sessões e redefinição (C2); pasta do mestre com chave e código de recuperação (C3).
- Apagar ou esconder uma mesa da lista do servidor (a lista local do navegador tem `esquecerMesa`, ainda sem botão).

## C2 — como ficou (2026-11-12)

Segundo lote do marco "Mesas e contas" (PROJETO 4.14): contas por mesa, pedidos de entrada, sessões, limite de tentativas e redefinição aprovada pelo mestre.

**O que foi feito**
- `packages/shared/src/contas.ts` (derivação, validações, regras de limite e de sessão, esquemas dos corpos, textos de erro) e dois frames novos em `protocolo.ts` (`contas.aviso`, `mesa.renomeada`).
- Servidor: `contas.ts` (`ContasDaMesa`), `autenticacao.ts` (cookies), migração 10 do `Armazenamento`, `Sala` com as rotas de conta e a identificação por sessão, `Diretorio` com o id escolhido pelo navegador, Worker com a lista fechada de rotas e os cabeçalhos internos.
- Web: `contas/EntradaDaMesa.tsx` (entrar, pedir, esqueci, redefinir, conta do mestre na legada), `contas/SecaoDeContas.tsx`, `contas/TrocarSenha.tsx`, `contas/CampoDeConta.tsx`, o formulário de criar mesa, o aviso no topo e o selo na aba Mesa, memória do mapa por mesa, nome da mesa ao vivo, lista em ordem de uso.

**Decisões (assumido)**
- (assumido) O sal da derivação normaliza o login (minúsculas, sem espaços nas pontas) e a senha entra em NFKC.
- (assumido) O navegador sorteia o id da mesa nova; sem `MODO=teste`, uma mesa nova sem conta de mestre é recusada.
- (assumido) A sessão vale 30 dias, renovada com o uso no máximo uma vez por hora; até 10 sessões por conta.
- (assumido) Esperas da conta: 1, 5, 15 e 60 minutos (continua em 60); IP: 30 falhas em 15 minutos bloqueiam por 15; pedidos: 10 pendentes por mesa e 3 por IP por hora; "esqueci a senha": 5 por IP por hora; pedir de novo depois de recusado: 10 minutos.
- (assumido) Só se pode aprovar a redefinição de quem a pediu; ela vale 30 minutos e uma vez só; depois de definir a senha nova a pessoa já entra.
- (assumido) A vaga ganha o nome de exibição ao aceitar e ao trocar de vaga (inclusive a do mestre ao criar a conta); a vaga antiga fica com o nome. "Nova vaga" cria `jogador-N` (no máximo 12 vagas de jogador).
- (assumido) A conta do mestre não se recusa nem se remove; a conta de jogador cuja vaga virar mestre continua sendo conta de jogador.
- (assumido) Importar uma campanha mantém as contas; a que ficou sem vaga entra de novo só quando o mestre a liga a outra.
- (assumido) A conta do mestre da legada só se cria de requisição local (host loopback e sem `CF-Connecting-IP`, ou com ele em loopback).
- (assumido) A lista "Mesas neste computador" põe primeiro as usadas mais recentemente neste navegador; as nunca abertas vêm depois, a legada na frente.
- (assumido) A escolha de usuário de teste aparece abaixo dos formulários na tela de entrada quando o servidor roda com `MODO=teste` (os prints a escondem).

**O que ficou para depois**
- Pasta do mestre com chave e código de recuperação (C3), inclusive "Sou o mestre e esqueci a senha" (hoje só "em breve").
- Mais de um mestre por mesa com conta, e promover um jogador a mestre pelo papel da conta (hoje o papel da conta é fixo na criação).

## C3 — como ficou (2026-11-12)

Terceiro lote do marco "Mesas e contas" (PROJETO 4.14): pasta do mestre com chave, código de recuperação, recuperação do mestre e dois reforços do C2.

**O que foi feito**
- `packages/shared/src/recuperacao.ts` (código, chave ECDSA, assinar e verificar com WebCrypto, esquemas dos corpos), `apps/server/src/origem.ts`, migração 11, `ContasDaMesa` com chave, código, desafio e as duas recuperações, rotas novas na `Sala` e no Worker.
- Web: `contas/pastaDoMestre.ts`, `CodigoDeRecuperacao.tsx`, `ProtecaoDoMestre.tsx`, "Sou o mestre e esqueci a senha" com as duas saídas, escolha de pasta ao criar a mesa, código antes de abrir a mesa nova e antes de entrar na legada.

**Decisões (assumido)**
- (assumido) A pasta é a mesma das imagens; ela é opcional ao criar a mesa. Gravar a chave exige pasta sem a chave de outra mesa.
- (assumido) Ao criar a mesa a privada vai para a pasta antes de o servidor receber a pública; em "Proteger" e "Trocar", o servidor aceita primeiro (confere a senha) e só então o arquivo é gravado.
- (assumido) A recuperação pede também o login do mestre (o sal da derivação o leva); login errado só avisa depois de provar o acesso e não gasta o código.
- (assumido) O limite por mesa (5 erros, 1/5/15/60 min) vale para pasta e código juntos e permite que quem erra à toa trave a recuperação por até uma hora.
- (assumido) A mensagem assinada é a do brief (sem a senha nova dentro).
- (assumido) Origin: sem o cabeçalho, aceita; em pedido local (loopback) aceita qualquer origem de loopback (o Vite pode reescrever o Host).
- (assumido) A falha de login inexistente é lembrada por um dia.

**O que ficou para depois**
- Gravar a chave já ao criar a conta do mestre da legada (hoje: Contas, "Proteger com a pasta da mesa").
- A pasta de imagens aberta só enxerga a chave nova depois de recarregar.

## T — como ficou (2026-11-12)

Lote do tour de introdução (combinado em `docs/IDEIAS.md`) e duas pendências do C3.

**O que foi feito**
- `apps/web/src/tour/`: `Tour.tsx` (véu escuro com um buraco no alvo, contorno no acento, cartão com título, texto, Voltar, Próximo n/N e Pular), `posicao.ts` (onde pôr o cartão, sempre inteiro na janela), `passos.ts` (os dois tours) e `abreSozinho.ts` (quando abre sozinho). Sem biblioteca.
- Mestre, 10 passos: Bem-vindo e o id (`mesa-identificacao`, aba Mesa), Cenas (`menu-cenas`), Novo token (`novo-token`), Ferramentas (`barra-ferramentas`), Paredes (`ferramenta-paredes`), Luz e Visão do mestre (`menu-grupo-luz`), Fichas (`aba-painel-fichas`), Compêndio (`aba-painel-compendio`), Chat e dados (`aba-painel-chat`), Pedidos de entrada e contas (`mesa-secao-contas`, aba Mesa). Jogador, 6: Bem-vindo (sem alvo), O mapa (`area-do-mapa`), A sua ficha (`aba-painel-fichas`), Chat e dados (`aba-painel-chat`), A régua (`ferramenta-regua`), Preferências (`aba-painel-preferencias`).
- Os textos moram em `textosDoTour.ts` (o das paredes ganhou "A para arco"; entraram os passos que não são de botão).
- "Já viu" é por conta (e a conta é por mesa), no servidor: migração 12 (`contas.tour_visto`, aditiva e idempotente), `GET eu` devolve `tourVisto` e `modoTeste`, `POST conta/tour-visto` marca. "Fazer o tour de novo" em Preferências.
- C3: o código de recuperação cabe numa linha só (a fonte acompanha a largura da caixa, `container-type`); a mesa legada, depois de criar a conta do mestre e anotar o código, oferece "Proteger com a pasta da mesa" ou "Agora não" (`contas/OfertaDePasta.tsx`).

**Decisões (assumido)**
- (assumido) O "visto" é marcado ao fechar o tour (concluir, Pular ou Esc); fechar a aba no meio faz ele abrir de novo no próximo acesso.
- (assumido) Com `MODO=teste` só abre sozinho com a chave `tabletop:pref:tourNoTeste` = "1" no navegador (os testes do tour a ligam). O usuário solto de teste (sem conta) nunca abre sozinho; "Fazer o tour de novo" abre para qualquer um.
- (assumido) Passo cujo alvo não aparece em 1,5 s é pulado, no sentido em que o tour anda; passo sem alvo (a boas-vindas do jogador) escurece a tela toda e fica no meio.
- (assumido) O tour é modal: o véu segura os cliques e as teclas que não são dele não chegam ao app (a letra R não troca a ferramenta por baixo).
- (assumido) A oferta de pasta da mesa legada reaproveita a senha acabada de digitar. Em navegador sem seletor de pasta ela diz que só o Chrome e o Edge servem, e "Agora não" segue.
- (assumido) Contas que já existem ficam com "não viram": veem o tour uma vez no próximo acesso.

**O que ficou para depois**
- O tour não ilumina itens dentro de menus que abrem (o item "Visão do mestre" do menu de Luz é falado no texto do grupo, não iluminado sozinho).
- Um passo que depende de uma aba só aparece se a aba abre em 1,5 s.

## V6 — como ficou (2026-11-12)

Um pedido do Vilella: conjurar com espaço de nível maior, dano a mais por nível acima e um ícone para "pingar" a magia no chat. O lote foi feito sem ninguém para perguntar: o que o brief não dizia foi assumido e está marcado.

**O que foi feito**
- **Menu "Conjurar <nome> com espaço de:"** preso ao botão, em Magias do PJ, em Ataques e magias (o nome da magia) e na Conjuração do NPC. Um item por nível de espaço com restante, do nível da magia até o 9º, em ordem crescente ("4º · 4 restantes"), e o de pacto no fim ("Pacto 3º · 1 restante") quando o nível do pacto serve. Pergunta sempre, mesmo com uma opção só. Teclado: o foco abre na primeira opção, ↑ e ↓ andam, Enter escolhe, os números 1 a 9 escolhem o nível, Esc ou clique fora cancelam e o foco volta ao botão. Sem opção: o aviso "Sem espaços de 3º nível ou maior para Bola de Fogo.". Truque não pergunta.
- **Dano por nível acima:** campo novo `Magia.porNivelAcima` (expressão de dados, "1d6" ou "1d4+1"), no editor da engrenagem como "Por nível acima" (dica "dados a mais por nível de espaço acima do da magia"; o texto cinza do campo mostra o valor que valerá quando ele está vazio). `porNivelAcimaDoTexto` (`packages/shared/src/conjuracao.ts`) lê o "Em níveis superiores" do compêndio; é usada em `magiaParaFicha` e, ao conjurar com o campo vazio, `porNivelAcimaDaMagia` tenta o campo, o compêndio (mesmo nome) e o trecho "Em níveis superiores:" que a descrição montada já carrega.
- **Bloco colado no chat:** na mesma `Mensagem` (campo novo `espaco`). A sala rola o dado a mais (`rolarEspaco`) depois do dano; no crítico os dados extras dobram. O bloco diz "Espaço de 5º · +2d6", mostra o dado, "Total N" (dano principal mais extra) e, com salvaguarda que dá metade, "metade N". O cartão de cima perde os cantos de baixo e a borda de baixo; o bloco perde os de cima e usa `--cabecalho` (o cartão usa `--campo`). Subiu sem `porNivelAcima`: sem bloco, o cartão diz "com espaço de 5º"; magia sem rolagem diz o espaço no cartão da magia ou na origem da característica.
- **Ícone "Mandar ao chat"** (`MessageSquareShare`) entre o Conjurar e a engrenagem, em Magias, em Ataques e magias (linhas de magia) e na Conjuração do NPC: manda o cartão do compêndio (se a magia casa) ou monta um com os campos da ficha, sem gastar espaço nem rolar. Quem pode conjurar a ficha pode pingar. O "Mandar ao chat" da magia expandida continua.
- **Protocolo:** `chat.modelo` (ataque), `chat.enviar` (só num `/r`) e `chat.magia` aceitam `espaco?: { nivel, extra?, metade? }` (aditivo, sem capacidade nova). Ver `docs/protocolo.md`.

**Decisões (assumido)**
- (assumido) Magia de pacto sobe sempre para o nível do pacto: só há o item de pacto, nunca "pacto em nível menor".
- (assumido) Os números 1 a 9 escolhem só os níveis comuns que estão no menu; o de pacto vai pelas setas.
- (assumido) Com `dano2`, o total soma tudo o que a rolagem principal já continha (dano, bônus e segundo dano) mais o extra, porque a sala rola uma expressão só.
- (assumido) `porNivelAcima` multiplica também a parte fixa ("1d4+1" por 2 níveis dá "2d4+2").
- (assumido) Mísseis Mágicos, mais alvos e mais raios ficam vazios no preenchimento automático e se escrevem à mão; são lidos "o dano aumenta em XdY para cada nível acima" e "XdY de dano adicional para cada nível".
- (assumido) Truque conjurado e magia conjurada no próprio nível não têm bloco nem "com espaço de".
- (assumido) O ícone só fica desabilitado (com o motivo na dica) para quem não pode conjurar a ficha.
- (assumido) O bloco aparece também quando o ataque erra: o dano é rolado sempre, como já era.
- (assumido) Na linha de Ataques e magias a última coluna ganhou largura para o ícone (todas as linhas, para as colunas alinharem).

**O que ficou para depois**
- Truques que sobem pelo nível do personagem e conjurar como ritual (anotados em `docs/IDEIAS.md`).
- Contar dardos, alvos e raios por nível.

## V7 — como ficou (2026-11-12)

Um pedido do Vilella: "qualquer coisa que envolva Jogador 1, Jogador 2… deve desaparecer; quem vai entrando na mesa vai assumindo esse papel". O lote foi feito sem ninguém para perguntar: o que o brief não dizia foi assumido e está marcado.

**O que foi feito**
- **Membro da mesa** é o mestre e quem tem conta ativa. A sala deriva a lista e a manda em cada snapshot (`estado.membros`, campo opcional, nunca gravado nem exportado). Sem o campo, todos contam como membros (estado de teste, cliente velho). Ajudantes em `packages/shared/src/membros.ts`: `membrosDaMesa`, `jogadoresDaMesa`, `fichasSemMembro`, `derivarMembros`, `planejarAceite`, `vagaTemDono`.
- **Listas e seletores só com membros:** Papéis dos usuários, exceções de permissão (sem jogador, a seção diz "Nenhum jogador na mesa ainda"), "Quem vê" e "Mostrar agora" do handout, "Quem controla" da ficha e do token, exceções de visão do token, "Ver como" do mestre, o `/w` do chat, as bolinhas do topo e a contagem do preparo de cena. Quem está fora continua valendo para sussurro (a sala aceita; ele vê quando entrar).
- **Referências a vaga escondida mostram o nome dela** (por exemplo "Visível para: Jogador 3" num handout); só deixam de ser oferecidas nos seletores.
- **Mesa nova nasce só com o mestre** (`USUARIOS_DA_MESA_NOVA`). A Campanha real não perde vaga nenhuma.
- **Aceitar um pedido:** sai o seletor "Entra na vaga"; entra **"Ficha dele"**, opcional ("Nenhuma" e as fichas de personagem que nenhum membro controla).
  - Nenhuma: usuário novo com o nome da pessoa e a próxima cor livre (id `jogador-N` interno).
  - Ficha de uma vaga escondida: a conta fica ligada **àquela vaga**, que ganha o nome da pessoa (tokens, permissões e histórico seguem).
  - Ficha sem dono: usuário novo, que vira dono da ficha (intenção `personagem.editar` feita pelo mestre).
  - Limite de 12 jogadores cheio: reaproveita uma vaga escondida que não é dona de nada (nem ficha, nem token, nem exceção de permissão); sem nenhuma, recusa.
- **Mesa → Contas:** sai o seletor "Vaga" de cada conta (a rota `vaga` deixa de existir). Remover a conta esconde o usuário; fichas e tokens ficam para o próximo aceite herdar.
- **Textos:** "vaga" e "Jogador N" saíram da interface (contas, tour, mensagens de erro).
- **MODO=teste:** o login solto numa vaga a torna membro (`meta.presentes_teste`, marcado em `entrar`, ao abrir o socket e depois do `/teste/zerar`). A vaga em que ninguém entrou fica escondida, como na vida real.

**Decisões (assumido)**
- (assumido) "Membro" não depende de estar logado agora: conta ativa já basta.
- (assumido) Ficha "de todos" (`editores: todos`) não é candidata a "Ficha dele": todos já a controlam.
- NPC também não é candidato (revisão do lote): `fichasSemMembro` e `planejarAceite` usam `ehNpc`. Uma ficha sem
  dono só aparece se a apresentação dela for "personagem"; sem apresentação escolhida, a ficha sem dono conta como NPC.
- (assumido) A ficha sem dono recebe só o novo dono em `editores`; os tokens dela seguem a ficha (quem edita o personagem controla o token).
- (assumido) O aceite com uma ficha que algum membro já controla é recusado (`vaga_invalida`, "Essa ficha já tem dono ou a mesa está cheia.").
- (assumido) A conta pendente ou recusada não é membro.
- (assumido) `ListaDeContas.vagasLivres` continua na resposta (aditivo, sem uso na tela); `CorpoAceitar` ignora o campo `vaga` antigo.
- (assumido) A tela de escolha de usuário de teste (`/api/usuarios`, só com MODO=teste) continua listando todas as vagas.

**O que ficou para depois**
- Um jeito de o mestre ver e apagar as vagas escondidas (hoje elas ficam para sempre, só invisíveis).
- Trocar a ficha de um jogador pelo aceite não existe: se o mestre quiser dar outra ficha, edita "Quem controla" na ficha.

## V8 — como ficou (2026-11-12)

Um pedido do Vilella sobre a ficha de NPC: a Conjuração sair da lista e virar uma bandeirinha ao lado da do Bestiário, tirar a borda e o degradê em volta da página (ocupava muito espaço) e, com a janela larga, dividir em duas colunas (traços e ações à direita). O lote foi feito sem ninguém para perguntar: o que o brief não dizia foi assumido e está marcado.

**O que foi feito**
- **Duas fitas no alto** (Bestiário e Conjuração), no desenho de fita das abas do PJ, agora abas de verdade: `role="tablist"`/`tab`, `aria-selected`, só a ativa no Tab (roving `tabindex`), ArrowLeft/Right, Home e End trocam e levam o foco. A ativa fica mais alta e na cor de destaque.
- **Bestiário** é o bloco de antes sem a seção Conjuração. **Conjuração** mostra só a seção (atributo, CD, ataque, círculos, espaços, magias, menu de espaço e ícone de chat do V6) na área toda.
- **A fita Conjuração** aparece sempre para quem edita a ficha (para poder criar, com o "+ Conjuração" do estado vazio) e, para os demais, só se o NPC tem magias.
- **A aba aberta é lembrada como a do PJ:** a Conjuração é a aba `magias` da janela (`janela.aba`), o Bestiário é a `principal`. Se a fita some para quem olha, a janela volta ao Bestiário.
- **Arrastar uma magia do compêndio** com o Bestiário aberto: a fita Conjuração acende (`data-aceita-soltar`) e recebe a magia, assim como a página do Bestiário; a janela passa para a Conjuração. Com a Conjuração aberta, vale a seção (círculo certo).
- **Sem moldura:** saíram a borda, a margem, o degradê e a lombada pontilhada; a página é um fundo liso (`--painel`) e o conteúdo começa a ~14 px da borda da janela. As fitas ficam numa faixa grudada no alto (`position: sticky`) com a faixa Vantagem/Normal/Desvantagem à esquerda (saiu do meio do bloco, e vale também na Conjuração, que rola ataque de magia).
- **Duas colunas por container query** no corpo (`@container npc (min-width: 760px)`): à esquerda cabeçalho, CA, PV, deslocamento, atributos e as linhas do bloco; à direita Traços, Ações, Reações e Lendárias. Mais estreito, uma coluna, na ordem de antes. A Conjuração larga põe os círculos em 2 colunas. Cada coluna é um container (`npcesq`, `npcdir`) para os arranjos internos (escudos em 3×2, CA e PV em linhas, ações que quebram).
- **O ícone de chat da Conjuração** ficou só o do V6 (`npc-conj-pingar-<i>`): o antigo (`npc-conj-chat-<i>`) saiu.
- A janela do NPC já aceitava ficar larga (sem largura máxima); não precisou de ajuste.

**Decisões (assumido)**
- (assumido) A fita Conjuração dos outros aparece só com `magias.length > 0` (espaços sem magia não bastam).
- (assumido) A divisão é pela largura do corpo, não pela proporção: janela larga e alta divide.
- (assumido) As duas colunas têm a mesma largura (1fr 1fr): na de 5/6, a da esquerda ficava apertada para os seis escudos.
- (assumido) O Vantagem/Normal/Desvantagem foi para a faixa das fitas; abaixo de ~560 px de corpo a faixa quebra e as fitas ficam em cima.
- (assumido) Soltar a magia na fita muda para a Conjuração, para a pessoa ver onde caiu.
- (assumido) O ícone de chat antigo saiu da Conjuração; o desenho novo da fita é o lugar de arrumar isso.
- As regras de container query do bloco (`.npc-atributos`, `.npc-vitais` etc.) passaram a levar o prefixo `.fl-raiz`: sem ele perdiam em especificidade para as regras-base e nunca valiam.

**O que ficou para depois**
- Em janela larga a Conjuração com uma magia aberta deixa um vazio na outra coluna do círculo vizinho (grade por linhas).
- As fitas do NPC não seguem a pele Clássica do PJ (abas planas); continuam fitas.

## V9 — como ficou (2026-11-12)

Um pedido do Vilella: transformar qualquer ficha numa janela do navegador, para arrastá-la a outro monitor. O plano foi aprovado e o lote ficou sem ninguém para perguntar: o que o brief não dizia foi assumido.

**O que foi feito**
- **Ícone "Abrir em janela própria"** (lucide `AppWindow`) no cabeçalho de toda ficha, PJ e NPC, antes do minimizar. Some com a ficha minimizada. Dica comum, sem atalho.
- **O clique abre um `window.open` com `popup`**, do tamanho da ficha, com nome fixo por mesa e ficha (`tabletop-ficha-<mesa>-<ficha>`): clicar de novo só traz a janela. A janela lembra tamanho (de dentro) e posição na tela em `tabletop:pref:janela-ficha:<mesa>:<ficha>` (localStorage, try/catch) e a próxima abertura passa `left`/`top`.
- **Rota própria** `/m/<id>/ficha/<fichaId>` (`rotas.ts`: `caminhoDaFicha`, `Rota.fichaId`). `App.tsx` põe `FichaEmJanelaPropria` no lugar da `Mesa`, depois da mesma entrada (sem sessão aparece a entrada da mesa e depois a ficha). Tem a própria `useSala` (a mesma sessão), o gerente de arquivos (retratos, compêndio de magias), o toast e o seletor de imagem; não tem mapa, painéis, topo nem tour. O título da aba é "<nome> — Távola". A `JanelaDaFicha` ganhou a prop `propria`: em vez da `Janela` flutuante, ocupa a página, com o cabeçalho, as ações da ficha (descansos ou engrenagem do NPC) e o ícone **"Voltar para a mesa"**.
- **Presença:** a sala já junta as conexões por usuário (`presenca()` olha o usuário, não o socket), então a segunda conexão não cria bolinha nem estado novo; não foi preciso mexer na sala. O tour e o "entrou na mesa" só existem na `Mesa`, que a janela da ficha não monta.
- **Coordenação entre as janelas** (`ficha/foraDaMesa.ts`, só no navegador, nunca na sala): a janela da ficha segura um **Web Lock** com o nome dela enquanto existe e avisa por **BroadcastChannel** por mesa ("aberta", "fechada"; a principal pergunta "quais" ao carregar). A principal confere `navigator.locks.query()` a cada segundo, então uma janela que morre sem avisar também some da lista. Sem Web Locks (endereço sem HTTPS), vale só o aviso do canal.
- **Na janela principal:** a ficha fora **sai da pilha** (a `Janela` não é montada); na lista de Fichas o item ganha a marca **"em outra janela"** (`ficha-fora-<id>`); clicar no item (ou abrir a ficha por qualquer caminho da mesa) **traz a janela para a frente** (`window.open("", nome)`). Fechar a janela ou clicar em "Voltar para a mesa" tira a marca e a ficha volta à pilha, no lugar de antes.
- **"Ficha de" do compêndio** inclui as fichas em outra janela (a mudança passa pela sala): as da pilha da mesa têm preferência e, sem elas, vale a última fora.

**Decisões (assumido)**
- (assumido) Ícone `AppWindow`; "Voltar para a mesa" é `Undo2`. A janela própria não tem minimizar nem Fechar (o navegador fecha), só o "Voltar".
- (assumido) A ficha só vai para fora a partir de uma ficha **aberta na mesa**; ao voltar, reaparece na pilha, aberta. Se a principal foi recarregada com a janela fora, a pilha dela começa vazia: a ficha só deixa de estar "fora".
- (assumido) Clique numa ficha que está fora não muda a aba dela (a aba do pedido, como a "Configurar" de uma ficha recém-criada, é ignorada).
- (assumido) "Voltar para a mesa" fecha a janela; se o navegador não deixar (a página não foi aberta pela mesa, por exemplo pelo endereço digitado), vai para `/m/<id>` na mesma aba.
- (assumido) A janela só lembra tamanho e posição quando foi aberta pela mesa (`window.name`); uma aba aberta pelo endereço não grava.
- (assumido) A iniciativa na janela própria não tem "token selecionado": com a ordem de turno aberta e mais de um token do personagem na cena, avisa "Selecione o seu token no mapa." (um token só entra direto).
- (assumido) Se a ficha é apagada ou o acesso se perde, a janela mostra "Esta ficha foi apagada, ou você não tem mais acesso a ela." e o botão "Fechar esta janela".

**O que ficou para depois**
- Arrastar entre janelas não funciona (do compêndio para a ficha de fora, da ficha de fora para o mapa): o arrasto do navegador não atravessa janelas. Não se tentou contornar.
- O navegador decide se respeita `left`/`top` (outro monitor, tela que foi desligada): ele pode abrir a janela em outro lugar.
- Mudar o tema na mesa com a janela da ficha aberta vale na hora (LP1: um ouvinte do `storage` no `main.tsx` serve a todas as janelas próprias; antes só a janela da chamada ouvia).

## C4 — como ficou (2026-11-12)

O Vilella escolheu o modelo B ("o B é perfeito") para a tela inicial. A tela de antes tinha três defeitos: "Entrar numa mesa" baixo ao lado de um "Criar mesa" alto, "Mesas neste computador" abaixo da dobra e uma barra de rolagem sem sentido. Ninguém para perguntar: o que o brief não dizia foi assumido.

**O que foi feito**
- **Um cartão central com abas** (`TelaInicial.tsx`, `.inicio-*` em `styles.css`): no alto o logo, "Távola" e a frase; embaixo um cartão de 560 px de largura e **altura fixa** (520 px; 440 px abaixo de 800 px de altura de tela). O conteúdo da aba rola por dentro do cartão só se precisar; a página não rola em 1600×900 nem em 1280×720 (um E2E mede). Em telas baixas o logo encolhe para 36 px e o nome para 30 px. No celular (< 600 px) o cartão ocupa a largura com 16 px de margem e a página pode rolar.
- **Seletor segmentado** com `role="tablist"`: "Minhas mesas (N)", "Entrar com código" e "Criar mesa". A aba ativa é preenchida com o acento. ← e → movem (dando a volta), Home e End vão às pontas; só a aba ativa entra na ordem do Tab. As três ficam montadas (as outras com `hidden`), então o que foi digitado fica ao trocar de aba.
- **Minhas mesas**: uma linha-botão por mesa (pastilha com a inicial, nome, id em mono, "aberta hoje", "ontem", "há N dias" ou a data, e seta), na ordem de último uso de antes. Enquanto procura, três linhas de esqueleto. Sem mesas: "Nenhuma mesa neste computador ainda." com os botões "Entrar com código" e "Criar mesa".
- **Entrar com código**: o texto, um campo de 48 px e o botão "Entrar" na largura toda; o erro embaixo, como antes.
- **Criar mesa em 2 passos** ("Passo 1 de 2" e duas bolinhas). Passo 1, "Mesa e conta": grade de 2 colunas (nome da mesa nas duas; login ao lado de nome; senha ao lado de confirmação) e "Continuar", que valida com as mesmas regras e mensagens de antes. Passo 2, "Pasta da mesa": o texto, "Escolher a pasta"/"Trocar a pasta" com o nome da pasta, o aviso de navegador sem suporte, "Voltar" e "Criar"; os erros da criação aparecem aqui. Enter no passo 1 também continua.
- **Depois de criar**: o id grande, o código de recuperação e "Abrir a mesa"/"Criar outra" ocupam o cartão no lugar das abas (a lógica é a de antes: os botões esperam o "Anotei o código"). Neste estado o cartão fica mais alto (620 px, sem passar da tela menos 102 px) e a frase "Sua mesa de RPG..." some, para o id, o código inteiro, "Anotei o código" e os botões aparecerem de uma vez, sem rolar por dentro, também em 1280×720 (um E2E confere). Os botões ficam num rodapé fixo.
- **Testids novos**: `inicio-aba-mesas`, `inicio-aba-entrar`, `inicio-aba-criar`, `inicio-criar-continuar`, `inicio-criar-voltar`, `inicio-criar-passo`, `inicio-mesas-ir-entrar`, `inicio-mesas-ir-criar`, `inicio-mesas-carregando`. Os antigos continuam, menos o texto "Mesas neste computador" (agora é a aba "Minhas mesas"). As rotas `/`, `/m/<id>` e `/m/<id>/ficha/<fichaId>` não mudaram.
- Nenhuma cor nova: tudo vem dos tokens do tema. Nenhuma mudança na sala, no protocolo nem no estado.

**Decisões (assumido)**
- (assumido) Aba inicial: "Minhas mesas" se houver mesas neste computador; senão "Entrar com código". Enquanto a lista carrega, "Minhas mesas" com o esqueleto; se a lista vier vazia, a tela passa para "Entrar com código" (só se o usuário ainda não escolheu uma aba).
- (assumido) Trocar de aba volta o passo de Criar para 1 e mantém o que foi digitado; "Criar outra" volta ao passo 1 com os campos limpos.
- (assumido) "Continuar" fica desabilitado enquanto o nome da mesa está vazio (era o "Criar" que ficava).
- (assumido) A pasta da mesa continua opcional. No passo 2 o texto é o de antes, inteiro.
- (assumido) A página rola só no celular (< 600 px); o cartão mantém a altura fixa.
- (assumido) "há N dias" vale até 30 dias; depois, a data.
- (assumido) A pastilha usa a cor `--acento-forte` (a do texto em destaque) sobre `--campo`.

**O que ficou para depois**
- Nada de ordenar ou apagar mesas da lista por aqui.
- Não foi medido em telas menores que 1280×720 (o cartão de 440 px cabe a partir de ~560 px de altura).

## V10 — como ficou (2026-11-13)

Bugs do mapa e o teclado do token, relatados pelo Vilella. Ninguém para perguntar: o que o brief não dizia foi assumido.

**O que foi feito**
- **Diálogo aberto de dentro de outro** (`useDialogo.ts`): uma pilha de diálogos. O mais novo fica por cima (`z-index` 80 + nível), recebe o foco, prende o Tab, é o único a ouvir o Esc e, ao fechar, devolve o foco a quem o abriu. O `SeletorDeImagem` agora vai para o `body` por portal (antes ficava atrás do "Configurar cena", que já era portal). Vale para os três diálogos modais (Configurar cena, Apagar cena e o seletor), e portanto para toda abertura do seletor (token, retrato, handout, cena).
- **Menu do navegador** (`menuNativo.ts`): na captura da `window`, o `contextmenu` em qualquer ponto da área do mapa é impedido. Campos de texto e as janelas flutuantes (fichas, handouts) ficam com o menu nativo. Chat e painéis laterais ficam como estavam.
- **Delete / Backspace** tira o token selecionado do mapa (`token.apagar`); a ficha não é tocada. O aviso "Token removido do mapa." tem o botão **Desfazer** (~6 s), que manda `token.restaurar`.
- **Quem pode apagar** (mudança pedida pelo Vilella no meio do lote): o mestre qualquer token; o jogador os que controla, na camada `tokens`. Conferido na sala. Sem permissão: "Você só pode tirar do mapa os tokens que controla.".
- **`token.restaurar { id }`** (intenção nova, sem capacidade fixa; a sala confere): a sala guarda em memória, por 10 s, o token apagado e quem o apagou. Só quem apagou (dentro do prazo) ou o mestre restaura. Não há migração.
- **Setas** movem o token selecionado um quadrado (o quadrado da cena, encaixado no grid), por `token.soltar`. A sala barra parede, porta fechada e falta de permissão. Segurar repete até ~8 passos por segundo. A câmera acompanha se o token sai da tela (`manterVisivel`).
- **Bandeira do ponto de chegada**: só aparece (para o mestre) com a faixa de Cenas aberta. Ao passar o mouse: "Ponto de chegada: os tokens do grupo aparecem aqui quando você leva o grupo para esta cena. Arraste para mudar."
- **Anel de foco do mapa**: só aparece quando o foco chegou pelo teclado (`data-foco-teclado`, posto em `Mapa.tsx`); clicar e apertar Delete, Espaço ou seta não o pinta.
- Atalhos novos na lista de Preferências: "Tirar do mapa o token selecionado" e "Andar com o token selecionado".

**Decisões (assumido)**
- (assumido) Só há um token selecionado por vez no app: "vários tokens andam juntos" não se aplica ainda.
- (assumido) O Desfazer devolve o token com o mesmo id e os mesmos dados, mas não as luzes presas a ele (a sala as apagou junto) nem a vaga na ordem de turno.
- (assumido) Passado o prazo, só o mestre põe o token de volta, pelo caminho de sempre (`token.criar`).
- (assumido) Delete e setas só agem com a ferramenta Selecionar, o foco no mapa (ou em nada) e sem diálogo, menu ou tour abertos.
- (assumido) "Remover do mapa" no menu do token não existe; o Delete é o caminho.
- (assumido) A recusa da sala por parede aparece no aviso de erro de sempre.

**O que ficou para depois**
- Seleção de vários tokens.
- Restaurar também as luzes do token.

## V10b — como ficou (2026-11-13)

O jogador põe o próprio token no mapa, só na área da bandeira. Ninguém para perguntar: o que o brief não dizia foi assumido.

**O que foi feito**
- **Intenção `token.colocarMeu { personagemId, tokenId, x?, y? }`** e capacidade `token.colocarProprio` (delegável, ligada por padrão, em Permissões: "Pôr o próprio token no mapa (na bandeira)"). A sala decide a cena (a do grupo), confere o controle do personagem, que o personagem não tem token nessa cena e que o ponto cai na área da bandeira. Os campos do token vêm da ficha, na sala.
- **A área da bandeira** é um círculo de 3 quadrados de raio em volta do ponto de chegada (centro da cena sem chegada). Constantes e contas em `mapa.ts` (`RAIO_DA_BANDEIRA_QUADRADOS`, `areaDaBandeira`, `dentroDaAreaDaBandeira`).
- **Botão "Colocar no mapa"** (ícone `MapPin`): no item da lista de Fichas e no cabeçalho da ficha, para quem controla o personagem e ainda não tem token dele na cena. Põe o token no arranjo da chegada, ao lado dos outros e sem sobreposição (`arrumarNoGrid` agora conta os tokens que já estão na cena).
- **Arrastar a ficha para o mapa**: o jogador arrasta o item que pode pôr; durante o arrasto a área se acende num círculo suave na cor do acento. Soltar dentro cria o token ali, encaixado no grid; fora mostrava "Ponha o token perto da bandeira (o ponto de chegada)." e não criava nada (desde o Q8, solte onde soltar, o token vai para a bandeira). O mestre segue soltando em qualquer lugar.
- **A bandeira para o jogador**: aparece quando ele controla algum personagem, tem a capacidade e não tem token dele na cena. A dica é "Ponto de chegada: Arraste a sua ficha para cá ou use "Colocar no mapa"." O jogador não a arrasta. Para o mestre nada mudou.
- O caminho do V10 fecha: o jogador tira o token com Delete e, passado o prazo do Desfazer (ou sem ele), põe de novo na bandeira.

**Decisões (assumido)**
- (assumido) "Quem controla" é `editores` do personagem ("todos" conta). Token com `controladoPor` não dá direito a pôr outro.
- (assumido) Um token por personagem por cena para o jogador. O mestre não tem limite (`token.colocarMeu` dele vale em qualquer ponto e mais de uma vez).
- (assumido) A bandeira some se a capacidade está desligada, ou se o jogador não controla nenhum personagem, ou se ele já tem token (de qualquer personagem que controla) na cena.
- (assumido) O jogador só pode pôr na cena do grupo (a única que ele recebe). O ponto é conferido cru (onde soltou) e só depois encaixado no grid.
- (assumido) O botão não aparece para o mestre (ele põe pelo arrasto, como antes).
- (assumido) O token não entra na ordem de turno nem leva luzes: como no `personagem.colocar`.
- O cartão "Seu personagem não está nesta cena" ficava em cima da bandeira (o centro da mapa) e barrava o mouse. Agora deixa o mouse passar (`pointer-events: none`), sobe para o alto do mapa quando a bandeira está à vista e, para quem pode pôr o token, o texto diz como ("Colocar no mapa" ou arrastar a ficha até a bandeira).

**O que ficou para depois**
- Pôr o token com as setas ou por atalho de teclado (hoje o caminho do teclado é o botão "Colocar no mapa").
- Restaurar as luzes do token junto (continua do V10).

## V11 — como ficou (2026-11-13)

A tocha do token e as condições, a pedido do Vilella: a tocha vira uma marca pequena no canto do token, e as condições viram ícones. Ninguém para perguntar: o que o brief não dizia foi assumido.

**O que foi feito**
- **A tocha na mão é uma marca no token**, no lugar do círculo ao lado com o tempo embaixo. A 1ª mão fica no canto **superior direito**; a 2ª, no **superior esquerdo** (3ª e 4ª: meio da direita e da esquerda). Fica por cima da borda, como uma condição. A alça continua a mesma: arrastar entrega a tocha a outro token ou põe num suporte, dois cliques apagam ou acendem, o clique direito abre o menu da tocha, e `podeMexerNaTocha` manda em quem pode.
- **O desenho**: bolinha escura com a chama em cor quente; apagada, esmaecida e sem brilho. O **anel fino** em volta é o tempo que falta e esvazia conforme a tocha queima. No fim o anel vira a cor de alerta.
- **O tempo exato** ("59:52") saiu do mapa. Aparece na dica ao passar o mouse ("Restam 59:52. ...") e no menu da tocha (linha "Restam ...", atualizada a cada segundo). O gancho de teste `alcas()` continua devolvendo `rotulo` com o tempo.
- **A luz** já saía do centro do token (`resolverLuzes`, portador `mao`); nada mudou. Um E2E confere que as luzes do token estão no centro dele.
- **Tamanho**: a marca (tocha e condição) mede ~30% do raio do token, com limite de 9 a 15 px de raio na tela, qualquer que seja o zoom (`raioNaTelaDaMarca`). As marcas de condição são reescaladas a cada mudança de zoom (`ajustarMarcasAoZoom`).
- **Condições com ícone**: cada uma das 14, mais a exaustão (com o nível escrito ao lado) e a concentração, tem um ícone do lucide, na cor da condição, sobre bolinha escura. Num arco na parte de baixo do token, acima do nome. No máximo **4 ícones e um "+N"** (a dica do "+N" lista os nomes). A dica ao passar o mouse e a regra por clique seguem como eram.
- **Menu de condições do token**: o ícone (na cor do texto do tema) ao lado de cada condição, da exaustão e da concentração.
- Os ícones são rasterizados do SVG do lucide numa textura do Pixi, com cache por ícone e cor (`texturaDoIcone`). Nada da internet.
- O olho cortado do token oculto saiu do canto superior direito (agora é da tocha) e foi para o alto, no meio.

**A tabela condição → ícone** (um lugar só: `apps/web/src/condicoesIcones.ts`, `ICONE_DA_CONDICAO`)

| Chave | Ícone (lucide) |
|---|---|
| agarrado | `HandGrab` |
| amedrontado | `Frown` |
| atordoado | `Sparkles` |
| caido | `ArrowDownToLine` |
| cego | `EyeOff` |
| contido | `Link` |
| enfeiticado | `Heart` |
| envenenado | `FlaskConical` |
| incapacitado | `Ban` |
| inconsciente | `Moon` |
| invisivel | `Ghost` |
| paralisado | `Snowflake` |
| petrificado | `Mountain` |
| surdo | `EarOff` |
| exaustao | `BatteryLow` (com o nível) |
| concentracao | `Brain` |

**Decisões (assumido)**
- (assumido) Os ícones são os da sugestão do brief, sem troca; um teste de unidade garante que todos existem e não se repetem.
- (assumido) Cores: tons claros por condição (`COR_DA_CONDICAO` em `condicoes.ts`, mais claros que os de antes) sobre bolinha escura `0x10141a`, que é fixa como o resto do desenho do mapa (conteúdo). No menu o ícone usa a cor do texto do tema, para o contraste valer nos temas claros e escuros.
- (assumido) Alerta do anel: tempo restante abaixo de 10% da duração ou de 5 min, a cor `0xff5b4a`. Sem a duração (o jogador com tempo por estágio), o anel fica cheio e só o estágio "morrendo" avisa.
- (assumido) A duração do anel vem de `luz.duracaoMs` (mestre) ou do modelo (`duracaoS`); `opcoes.duracaoDe` na `Mesa.tsx`. Nada novo na sala nem no protocolo; o jogador sem tempo exato não recebe mais do que já recebia.
- (assumido) 5 condições mostram 4 ícones e um "+1" (o brief diz "no máximo 4 mais +N"). O E2E de `combate.spec.ts` esperava 5 marcas e passou a esperar 4 mais "Mais 1".
- (assumido) O pontinho de destaque do dono da tocha saiu (a marca é pequena demais); quem não pode mexer vê a dica "só o dono e o mestre mexem nela", como antes.
- (assumido) A ficha não lista condições desde o V4a2, então o ícone novo só entrou no menu do token.
- Os objetos de luz de um ponto (suporte, fogueira) seguem com o desenho grande de antes, com o tempo embaixo.

**O que ficou para depois**
- Condição e tocha por toque (celular): a dica continua só com o mouse.
- Ícones por condição não são configuráveis.

## V10c — como ficou (2026-11-13)

A cena como cartão, a pedido do Vilella: uma imagem de fundo ou o mapa de uma cidade, mostrado inteiro, sem se preocupar com tokens nem com luz. Ninguém para perguntar: o que o brief não dizia foi assumido.

**O que foi feito**
- **Campo novo `Cena.cartao?: boolean`**, aditivo e opcional (sem ele é mapa, como sempre foi). Nenhuma migração: o esquema já aceita a campanha antiga, e exportar e importar levam o campo (a versão do arquivo não mudou). `cena.duplicar` copia a cena inteira e, portanto, o cartão.
- **Intenção**: `cena.editar` ganhou `cartao?: boolean` (a capacidade continua `cena.editar`, que só o mestre tem). Ao virar cartão ou voltar a mapa, a sala manda **snapshot novo a todos**, para o jogador receber (ou perder) as paredes na hora. Editar só o nome não manda snapshot.
- **Menu da cena** (faixa de Cenas): "Transformar em cartão" (ícone `RectangleHorizontal`); numa cena-cartão o item vira "Voltar a ser mapa" (ícone `Map`). O mesmo existe como caixa de seleção no "Configurar cena": "Cena como cartão: mostra a imagem inteira, sem luz nem visão".
- **Faixa**: a cena-cartão mostra uma marca pequena (o mesmo ícone) no canto de cima, à direita, da prévia, com a dica "Cena como cartão".
- **O que muda numa cena-cartão**:
  - sem névoa, escuridão nem limite de visão para todos (`visaoLimitadaNaCena` em `paredes.ts`; `iluminada` em `Mesa.tsx` passa a vir dela). A configuração de iluminação da cena fica guardada e volta a valer ao voltar a mapa;
  - o aviso "Seu personagem não está nesta cena" não aparece (o mapa não fica escuro);
  - ao entrar na cena (e ao virar cartão) a câmera enquadra a imagem inteira, centrada, com folga de 24 px de cada lado (`vistaInicial` → `centralizar(folga)` em `mapaPixi.ts`); depois zoom e arrasto como sempre. O botão "Centralizar" continua enquadrando com a folga de antes;
  - os tokens aparecem e se movem normalmente; a visão deles não faz nada.
- **Na sala** (o ponto de internet): a sala nunca filtrou nada por visão (os tokens só se escondem pelo `oculto`; a escuridão é só do cliente). O que existia de "visão" no que a sala manda eram as **paredes**. Numa cena-cartão a sala **não manda paredes ao jogador**: o snapshot (`visaoPara`) vai com `paredes: []` e `parede.criada/editada/apagada` não chegam a ele. O mestre segue recebendo tudo. A parede secreta, o token oculto, as notas e as outras cenas continuam como eram: nada disso passou a chegar ao jogador.
- **Paredes sem efeito**: na cena-cartão a parede não barra o `token.soltar` do jogador (a sala confere) e o `porta.alternar` dele responde "Não há porta aí.". Elas continuam guardadas e valem de novo ao voltar a mapa.
- **Menu Luz do mestre**: o botão "Iluminação" avisa "(sem efeito: cena como cartão)" e o interruptor mostra a configuração guardada.
- **Tour**: o passo de "Cenas" ganhou meia frase sobre "Transformar em cartão".

**Decisões (assumido)**
- (assumido) A câmera enquadra a cena inteira (`larguraM` × `alturaM`), que o mapa define ao entrar na cena (tamanho da imagem ÷ px por quadrado × quadrado). Sem imagem, enquadra a cena vazia.
- (assumido) Virar cartão também reenquadra a câmera de quem está olhando a cena; voltar a mapa não mexe na câmera.
- (assumido) O mestre também vê a cena inteira, sem a visão noturna (`visao.modo` = "claro"); as paredes aparecem para ele só com a Visão do mestre ou a ferramenta Paredes, como antes. A "Visão do mestre" (a noturna) não faz efeito nesta cena.
- (assumido) A parede guardada não barra o movimento nem a porta do jogador; o mestre sempre ignorou.
- (assumido) O grid segue a configuração da cena: virar cartão não o liga nem o desliga.
- (assumido) A bandeira e o "Colocar no mapa" do V10b continuam valendo; só o aviso some.
- (assumido) `cena.editar` não é delegável (como já era); só o mestre transforma a cena.

**O que ficou para depois**
- Um cartão sem tamanho próprio (a imagem sem o grid de metros): hoje o tamanho vem do px por quadrado.
- A prévia da faixa mostra a imagem cortada (`object-fit: cover`), como nos mapas.

## V12 — como ficou (2026-11-13)

O ping no mapa, a pedido do Vilella: segurar o clique num ponto faz um círculo da cor do usuário se abrir ali, e com Shift a tela de todos vai para o ponto. Ninguém para perguntar: o que o brief não dizia foi assumido.

**O que foi feito**
- **O gesto**: com **Selecionar** ou **Mão**, segurar o botão esquerdo **parado** por ~400 ms (o ponteiro não passa de ~5 px) faz o ping, no fundo ou em cima de um token. Mexer antes é o arrastar de sempre (token, tocha, mapa) e não pinga. Depois do ping, soltar não seleciona nem abre nada. Com **Shift** (apertado ao começar ou na hora), o ping também centraliza a tela de todos. Segurar com o Espaço, com o botão do meio ou nas ferramentas de desenho, régua, paredes, luz e ponto não pinga: o gesto delas continua sendo delas.
- **O efeito**, em `mapaPixi.ts` (`camadaDePings`): dois anéis que se abrem do ponto até 2,5 quadrados de raio em ~1,2 s, com o centro marcado, na cor do usuário (`usuario.cor`, posta pela sala), com um contorno escuro fino para o contraste. É em escala de mundo (acompanha o zoom), com um raio mínimo de 56 px na tela. Com `prefers-reduced-motion`: um anel fixo que esmaece.
- **Centralizar**: pan de ~400 ms (instantâneo com `prefers-reduced-motion`), só da câmera: o zoom e as janelas não mudam. Quem está arrastando algo (token, mapa, alça, traço) recebe a câmera depois de soltar; se a pessoa começar a arrastar o mapa no meio do pan, o pan para.
- **Na sala** (`packages/shared/src/ping.ts`, `nucleo.ts`, `sala.ts`): intenção `mapa.ping { cenaId, x, y, centralizar? }` com a capacidade nova `mapa.pingar`; mensagem `mapa.pingado { cenaId, x, y, centralizar, usuarioId, cor }`. É **efêmera**: sem `seq`, sem evento, sem banco, sem histórico, sem exportação. A sala valida a cena, que quem pinga a vê e que o ponto está dentro dela; o limite de frequência é por usuário (1 ping por 0,5 s; 1 centralização por 3 s). Detalhes em `docs/protocolo.md` ("Ping no mapa").
- **Permissão**: `mapa.pingar` é delegável, **ligada por padrão**, e aparece em Permissões com o rótulo "Pingar o mapa e centralizar a tela de todos". O mestre pode sempre. Desligada, o jogador não pinga (o cliente nem pede) e a sala recusa com `sem_permissao`.
- **Teclado**: **P** pinga no ponto sob o ponteiro (no centro da tela se o ponteiro está fora do mapa) e **Shift+P** também centraliza, com o foco no mapa ou em nada. Os dois entraram na lista de atalhos (Preferências).
- **Tour**: a frase do passo do mapa (`area-do-mapa`) cita o ping; nenhum passo novo.

**Decisões (assumido)**
- (assumido) Vale com Selecionar e Mão; o Espaço (e o botão do meio) continua só arrastando a vista.
- (assumido) Quem recebe: todo mestre (o cliente dele só mostra o ping da cena que ele está olhando, então um ping de outra cena não aparece nem move a câmera) e os jogadores da cena do grupo. O "Ver como" não muda nada; o mestre pinga mesmo "vendo como" um jogador.
- (assumido) Quem pinga só vê o próprio ping quando a sala o devolve (sem desenho local), para ver exatamente o que os outros veem.
- (assumido) O excesso do limite é ignorado em silêncio, sem aviso. A centralização que passa do limite de 3 s não é descartada: vira um ping simples.
- (assumido) O ponto fora da cena, no cliente, é encostado na borda da cena antes de ir; a sala recusa o que ainda assim vier fora.
- (assumido) O ping que chega com o mapa em outra cena, ou antes de o mapa subir, é descartado. Só os 12 últimos pings ficam na tela ao mesmo tempo.
- (assumido) A seleção do token ao apertar sobre ele continua como sempre (acontece ao apertar); o ping não a desfaz.
- (assumido) Perto da borda, a câmera centralizada obedece ao limite de sempre (a cena precisa continuar parcialmente à vista), então o ponto pode não ficar exatamente no centro.
- Shift no mapa: com Selecionar ou Mão o Shift não fazia nada (a régua o usa ao soltar, e só na ferramenta Régua, onde o ping não existe), então não há choque.
- Sem migração: a capacidade nova entra com o padrão ligado ao carregar a campanha e ao importar (já existia o mesclador `PERMISSOES_PADRAO`).

**O que ficou para depois**
- Ping por toque (celular): segurar com o dedo funciona como o mouse, mas não foi verificado.
- Um aviso para quem passou do limite de frequência.
- Vários mestres olhando cenas diferentes, e o ping só "chega" a quem vê a cena: hoje o mestre recebe tudo e filtra no cliente.

## V13 — como ficou (2026-11-13)

A régua livre, os pontos de virada e a unidade (metros ou pés), a pedido do Vilella. Ninguém para perguntar: o que o brief não dizia foi assumido.

**O que foi feito**
- **Painel da Régua** (`PainelDaRegua.tsx`, no desenho do painel das Paredes, para todos): "Grudar no grid" (ligado por padrão) e duas linhas de dica (Alt inverte e Shift fixa; o clique direito marca ponto de virada). A escolha é lembrada por pessoa em `tabletop:pref:reguaGrudar`, com try/catch. **Alt** inverte na hora, nos dois sentidos.
- **Régua livre**: as pontas não encaixam; a medida é a distância em linha reta; o rótulo mostra só a distância ("5,0 m"), sem quadrados. Grudada fica como era ("4,5 m (3 quadrados)").
- **Pontos de virada**: com o botão esquerdo segurado, o **clique direito** marca um ponto onde a ponta está e a medida continua dali. Em cada ponto aparece a distância do trecho; na ponta, "trecho · total X" (por exemplo "5,0 m · total 8,0 m"). **Backspace** tira o último ponto; **Esc** cancela tudo. Soltar termina; com Shift fixa, e a fixa guarda os pontos e os rótulos (clicar na fixa a tira inteira). O clique direito não abre o menu do token nem o do navegador. No modo grudado cada ponto de virada encaixa no grid, cada trecho segue a regra das diagonais e o total é a soma dos trechos. A régua é **só local** (sempre foi): nada vai para a sala.
- **Unidade** em Preferências ("Unidade de distância: Metros / Pés", `tabletop:pref:unidade`, padrão metros). Conversão do D&D em português: 1 pé = 0,3 m (1,5 m = 5 pés, 9 m = 30 pés). Uma função só de formatação, no shared (`formatarDistancia` em `mapa.ts`, com `metrosParaUnidade`, `unidadeParaMetros`, `numeroDaDistancia`, e `medirRegua` e `medirPercurso` aceitando a unidade). Metros mantêm uma casa decimal; pés vão ao inteiro mais próximo ("1 pé", "5 pés"). O cliente lê a unidade por `unidade.ts` (`useUnidade`, `definirUnidade`).
- **Onde a unidade vale**: a régua (trechos e total, também a fixa); o resumo do raio de luz dos modelos (aba Mesa); o campo "Quadrado" do "Configurar cena" (rótulo, valor, limites e a mensagem de erro; o que vai para a sala continua em metros e, sem mexer no campo, o valor da sala não é tocado).
- Atalhos novos na lista de Preferências: clique direito e Backspace da régua.

**Decisões (assumido)**
- (assumido) A escolha de grudar é só da régua (chave própria); não mexe no encaixe dos tokens.
- (assumido) Livre: a distância é em linha reta, sem a regra das diagonais; o total é a soma das retas.
- (assumido) Com viradas, o total no modo grudado traz também a soma dos quadrados ("4,5 m (3 quadrados) · total 7,5 m (5 quadrados)").
- (assumido) O modo (grudado ou livre) vale para a medida inteira e segue o Alt da última vez que o ponteiro mexeu.
- (assumido) Clique direito sem mexer o ponteiro desde o último ponto não marca outro (evita ponto repetido).
- (assumido) O arrasto do token não mostra distância hoje; nada a converter ali.
- (assumido) A dica e o menu da tocha (V11) mostram só o tempo, não o raio; não havia o que converter. Os campos de **edição** de raio ("Luz plena (m)", "Penumbra (m)", "Alcance da visão (m)", "Visão no escuro (m)", "Alcance de interação (m)") continuam em metros, com "(m)" no rótulo, para não haver número editável que muda de significado com a preferência.
- (assumido) Pés no campo do quadrado: aceita decimais (mostra até 2 casas); 1 a 33 pés cobrem os 0,3 a 10 m da sala.
- (assumido) Fichas, compêndio (alcances, deslocamento) e o estado da mesa ficam como estão, em metros.
- O ping do V12 não existe com a ferramenta Régua, então o Alt e o clique direito da régua não conflitam com ele.
- O painel da Régua mede ~250 px de largura, no mesmo canto das Paredes, e é curto para não cobrir a área onde se começa a medir.

**O que ficou para depois**
- Converter os campos de edição de raio (luz, visão, alcance) para a unidade escolhida.
- Mostrar a régua aos outros (continua local).
- Marcar ponto de virada sem o mouse.

## V14 — como ficou (2026-11-13)

Menus (tipos de parede, importar e exportar, atalhos) e dois acertos que sobraram do V13, a pedido do Vilella. Ninguém para perguntar: o que o brief não dizia foi assumido. Sem migração e sem mudança de protocolo ou de sala.

**O que foi feito**
- **Tipo de parede em lista** (`ListaDeTiposDeParede.tsx`, no painel Paredes e portas): radiogroup de verdade (rádios nativos: setas, foco visível, linha ativa destacada como as abas). Cada linha tem ícone (`BrickWall`, `DoorOpen`, `PanelTop`, `EyeOff`, `Ghost`), o nome e, à direita, a amostra do traço com a cor e a espessura do mapa (`ESTILO_DA_PAREDE`, agora exportado). A dica do que o tipo faz (conferida em `paredes.ts`) aparece ao lado, no mouse e no foco (`Dica`). Os testids `parede-novo-<tipo>` ficaram nos rádios. "Desenhar como (linha/arco)", o A e o texto de ajuda continuam.
- **Exportar e Importar** (aba Mesa, Campanha): dois blocos iguais, cada um com título, frase e botão (`Exportar campanha` com ícone de download; `Escolher arquivo…` com ícone de upload). O input de arquivo ficou escondido (testid `importar-arquivo` mantido). Escolhido o arquivo, aparecem o nome, o resumo (cenas, fichas e tokens, `resumoDaCampanha.ts`), o aviso "Isto troca a mesa atual. Exporte antes, se quiser guardar." e os botões "Importar e substituir" (perigo) e "Cancelar". Nada de `confirm()` (nunca houve). O texto do Exportar diz o que vai e o que não vai (conferido em `criarExportacao`).
- **Atalhos**: em Preferências, "Os mais usados" (Ferramentas e Mapa) aberta; Menus, Janelas e painéis e Campos em `<details>` recolhidos; frase no topo sobre os recolhidos. Saiu `menuAtivar` (Enter e Espaço no item do menu: é o comportamento nativo do botão, duplicava o navegador). Entrou `chatHistorico` (↑ e ↓ no campo vazio do chat trazem de volta o que foi enviado: já existia no código e faltava na lista). Os atalhos do V10 ao V13 já estavam na lista.
- **Rótulos da régua dentro do mapa** (`PertoDoPonto.tsx`, `posicaoDaRegua.ts`): o rótulo da ponta, os dos trechos, os das fixas e o botão Fixar ficam sempre dentro da área visível. Tenta à direita e embaixo; se não couber, à esquerda; depois em cima; depois à esquerda e em cima. Foge do retângulo do zoom flutuante (com folga de 6 px).
- **Campos de raio na unidade escolhida** (`CampoDeDistancia` em `Campo.tsx`): "Luz plena" e "Penumbra" (modelos e fontes de luz), "Alcance de interação" (regras da mesa), "Alcance da visão" e "Visão no escuro" (editor do personagem e painel do token). O rótulo vira "(m)" ou "(pés)", o campo mostra e aceita a unidade e a sala recebe metros. Sem mexer no campo nada é enviado.

**Decisões (assumido)**
- (assumido) `EyeOff` para Secreta (some para os jogadores) e `Ghost` para Invisível; `DoorClosedLocked` ficaria parecido com a porta trancada.
- (assumido) A amostra do traço é contínua para todos os tipos: o mapa não usa tracejado em nenhum.
- (assumido) A dica de cada tipo vai na dica do mouse (e do foco), não na linha: com a dica na linha o painel ficava alto e cobria o centro do mapa, onde se desenha. Ficou na mesma posição (x = 316) e na mesma largura.
- (assumido) Um arquivo que não parece campanha também fica à espera da confirmação, com o aviso "Não parece uma campanha exportada: a sala vai recusar."; a sala recusa como antes, com a mesma mensagem.
- (assumido) Em pés o campo aceita decimais (até 2 casas) e mostra o valor da sala convertido ("1,5 m" = 5).
- (assumido) Os campos "Base", "Por modificador" e "Alcance fixo" da memória do mapa (aba Mesa, Iluminação) ficaram em metros: o brief não os cita.
- (assumido) O resumo da importação conta cenas, personagens (fichas) e tokens do arquivo; arquivo antigo sem personagens conta zero fichas.

**O que ficou para depois**
- Converter os campos de memória (Base, Por modificador, Alcance fixo) para a unidade escolhida.
- Home e End na lista de tipos de parede (os rádios nativos só andam com as setas).

## P1 — como ficou (2026-11-13)

**O que foi feito**
- A aba Preferências virou uma **sanfona com resumo** (o Modelo B, escolhido pelo Vilella na maquete). Sete cartões recolhíveis, na ordem que ele pediu: **Conta**, **Aparência**, **No mapa**, **Ajuda e arquivos**, **Conectar o Claude**, **Segurança** (só com login) e **Atalhos do teclado**.
- Cada cartão tem ícone, título, o resumo do estado numa linha (cortado com reticências, com a dica `title` do texto inteiro) e a seta. Aberto, o resumo some. É um `<details>` nativo (`SecaoDePreferencias.tsx`): Enter e Espaço abrem e fecham no título e o `aria-expanded` acompanha.
- Resumos ao vivo: Conta "Nome (papel)"; Aparência, o nome do tema; No mapa "Metros · encaixe ligado · dicas ligadas"; Ajuda e arquivos "Pasta X" ou "Nenhuma pasta escolhida" e "· N transferências"; Conectar o Claude "N tokens · conectado · N lotes para desfazer" (ou "Nenhum token"); Segurança "Trocar a senha"; Atalhos "N atalhos" (de `IDS_DOS_ATALHOS`).
- Só a Conta abre por padrão. O que a pessoa abre ou fecha fica em `tabletop:pref:secoes` (JSON, com try/catch, nunca vai à sala). Abrir um cartão não fecha os outros.
- A marca pequena "só neste navegador" fica **dentro** de Aparência, No mapa e da "Pasta local de imagens" (substitui o aviso solto "Neste navegador"). Sem índice no alto.
- Nenhuma função mudou e nenhum `data-testid` saiu. Novos: `preferencias`, `pref-secao-<id>`, `pref-secao-<id>-titulo`, `pref-resumo-<id>`, `pref-marca-navegador`.
- As seções que traziam título próprio perderam o `<h3>` (o título está no cartão): "Conectar o Claude" e "Atalhos do teclado" viraram `aria-label`; "Pasta local de imagens", "Transferências" e "Trocar a senha" viraram `<h4>`.
- Sem mudança de banco, sala ou protocolo (nenhuma migração).

**Decisões (assumido)**
- (assumido) Transferência em andamento não abre o cartão sozinha: o resumo de "Ajuda e arquivos" ganha o destaque (cor de acento e negrito). Assim a escolha da pessoa de deixar fechado vale.
- (assumido) O resumo do Claude mostra "Carregando…" até a lista de tokens chegar, e "· conectado" vem da presença do Claude da própria pessoa (`claude` do snapshot de presença).
- (assumido) O Segurança some sem login, como a troca de senha sempre foi; nesse caso o cartão nem existe.
- (assumido) Em todos os 14 temas o cartão usa só tokens existentes (`--painel`, `--borda`, `--acento-forte`, `--texto-suave`); nenhum token novo.

**O que ficou para depois**
- Nada pedido. Se os cartões crescerem, vale um "abrir todos / fechar todos".

## N1 — como ficou (2026-11-13)

**O que foi feito**
- **Vida e CA em cima do token selecionado.** Com um token selecionado (um clique), duas marcas compactas ficam logo acima dele: a vida atual (ícone `Heart` e o número; PV temporário em "+N" pequeno) e a CA (`Shield` e o valor calculado da ficha, `derivar(ficha).ca`). Pílulas com `--painel`, `--borda`, `--texto` e sombra, com o coração em `--perigo` e o escudo em `--acento-forte`: nada do visual de outra mesa virtual. Acompanham o token ao mover, ao dar zoom e ao arrastar o mapa (um componente React, `MarcasDoToken.tsx`, lê `MapaPixi.tokenNaTela` a cada quadro e põe a posição direto no estilo) e somem ao tirar a seleção.
- **Quem vê:** o mestre em todos os tokens e quem controla o token (`controlaToken`). Na prática o jogador já nem seleciona o token de outro (regra do V2); o filtro na `Mesa.tsx` é a segunda barreira. Token sem ficha não tem marcas.
- **A vida é editável ali mesmo.** Um clique na marca (ou a tecla `E`) abre um campo com o número, já selecionado. Enter grava, Esc cancela (sair do campo também cancela). Aceita "12" (valor), "-7" (tira; o dano consome o PV temporário primeiro, como na ficha) e "+3" (soma até o máximo). Fica entre 0 e o PV máximo. Grava com a mesma `ficha.alterar` da ficha (`pvAtual` e, se mudar, `pvTemp`); a lógica é `vidaDoToken.ts` (com teste de unidade). Quem tem a ficha aberta vê na hora.
- **A CA só mostra.** Um clique nela abre a ficha do personagem (a CA se edita lá).
- **"Morto" com um X.** Campo novo `morto?: boolean` no token. O X vermelho (dois traços grossos, contorno escuro por baixo) cobre o token inteiro, por baixo do nome e das marcas de condição, e o token fica a 60% de opacidade. Todos que veem o token veem o X. Quem marca: o mestre e quem controla o token, pelo menu do clique direito ("Marcar como morto" / "Tirar a marca de morto") ou pelo botão `Skull` ao lado das marcas de vida. Não marca sozinho quando a vida chega a 0; nesse caso o botão ganha um aro vermelho de destaque.
- **A camada pelo clique direito (só o mestre).** O menu do token ganhou o grupo "Camada" (Mapa, Tokens, Mestre, a atual marcada), que usa o `token.editar` com `camada` de sempre; ao mandar para o Mestre, o token some para os jogadores na hora, como pelo painel. O jogador não vê o grupo.
- **Dado e protocolo:** `Token.morto?` (opcional e aditivo); a intenção `token.condicoes` ganhou `morto?: boolean` (mesma regra: o mestre ou quem controla o token; sem capacidade nova). Sem migração de banco: o token é guardado como JSON, o arquivo antigo carrega e exportar/importar levam o campo. Atalho novo `E` (grupo Mapa) em `atalhos.ts`.

**Decisões (assumido)**
- (assumido) A tecla de editar a vida é `E`: o `V` já é a ferramenta Selecionar.
- (assumido) O texto "-7" usa a regra do dano da ficha (temporário primeiro); o valor absoluto não mexe no temporário.
- (assumido) Sair do campo sem Enter cancela, em vez de gravar.
- (assumido) As marcas somem no modo "ver como outro jogador" (o mestre testando a visão).
- (assumido) A CA clicável abre a ficha em vez de editar ali.
- (assumido) O botão de morto fica ao lado de vida e CA, dentro da mesma barra, e vale para quem controla o token.

**O que ficou para depois**
- Nada pedido. Uma barra de vida no próprio token e a morte automática a 0 PV ficaram de fora de propósito.

## N2 — como ficou (2026-11-14)

**O que foi feito**
- **Magia inata.** A fita Conjuração do NPC (e a página Magias do personagem) ganhou a parte "Conjuração inata" depois dos círculos (`ConjuracaoInata.tsx`). Atributo e CD próprios (`ficha.inata { habilidade?, cd?, grupo? }`; sem CD escrita vale 8 + proficiência + modificador do atributo inato, que cai no atributo da classe ou da seção) e as magias por frequência: "À vontade" (sem contagem), "N/dia cada" (bolinhas em cada magia, uma linha por N) e "N/dia" (um contador para o grupo). As magias moram em `ficha.magias` com o campo novo `inata { frequencia: vontade | cada | grupo, max?, gastos? }`: ficam fora dos círculos e não gastam espaço. Conjurar uma inata (`conjurarInata`): gasta uma bolinha (a da magia ou a do grupo; "à vontade" não gasta), rola ou manda o cartão como as outras e sai no nível dela, com a etiqueta "conjuração inata" no cartão. Sem usos, avisa e não conjura. A CD e o ataque da rolagem saem do atributo e da CD inatos (`magiaInataParaRolar`).
- **Recarregar.** `descansoLongo` zera os usos gastos da inata e do grupo (`recarregarInata`). O NPC não tem botão de descanso na janela, então a parte inata ganhou "Recuperar usos" (só para quem edita, só com algo gasto), que faz o mesmo.
- **Arrastar.** Soltar uma magia do compêndio na parte inata a põe lá como "1/dia cada" (`DestinoDaEntrada.inata`); a frequência se troca na magia aberta (À vontade, N/dia cada, N/dia grupo, ou "Com espaço", que a tira da inata).
- **Truques por nível do personagem.** `Magia.dadosPorNivel [{ nivel, expressao }]`: o dado a mais que vale a partir daquele nível (vale o do maior nível alcançado; não se somam). Vem do compêndio ao trazer a magia (`dadosPorNivelDoTexto` lê "aumenta em 1d10 ... 5º nível (2d10), 11º nível (3d10) e 17º nível (4d10)" e "dois raios no 5º nível, três no 11º e quatro no 17º") e, ao conjurar, do compêndio ou da descrição quando o campo está vazio. O dano rolado soma o dado ao do truque ("1d10" + "1d10" = "2d10"); o cartão do ataque mostra "(nível 5)" depois da fórmula. O nível é a soma dos níveis das classes; no NPC sem classe, o ND como aproximação (fração conta 1).
- **Ritual.** `Magia.ritual` (vem do compêndio). Magia com a marca (na ficha ou no compêndio) ganha no menu de espaço o item "Ritual · sem espaço (+10 min)" (atalho `R`). Não gasta espaço; o cartão diz "como ritual".
- **Mais dardos, raios e alvos por nível.** "Por nível acima" também entende "1 dardo", "1 raio", "1 alvo", "1 criatura" (do texto do compêndio ou escrito no campo). `Magia.quantidadeBase` (3 dardos) ou o texto da magia dá a base (sem nenhum dos dois, 1). Conjurando num espaço maior o cartão diz "com espaço de 2º · 4 dardos"; com dano, a sala rola cada dardo ou raio à parte (`rolarEspaco`) e o chat desenha o bloco colado "4 dardos · 1d4 + 1 cada" com o total; sem dano (alvos), só o número.
- **Protocolo.** `EspacoDoPedido` e `EspacoNoChat` ganharam `ritual?`, `inata?` e `quantidade?` (no pedido `{ total, unidade, cada? }`; na mensagem `{ total, unidade, rolagens?, soma? }`); o pedido de ataque e o resultado ganharam `nivelDoTruque?`. A mensagem `magia` passa a levar o espaço inteiro (antes só o nível). Tudo opcional; sem capacidade nova; mensagem antiga igual.
- **MCP.** `fichas` aceita `conjuracaoInata { habilidade, cd, grupo { max } }` e, em `magias`, os campos `inata`, `ritual`, `dadosPorNivel`, `quantidadeBase` e `porNivelAcima` com quantidade. `compendio` (detalhe) diz o que sobe por nível de espaço, os dados por nível do personagem e o ritual; a leitura da ficha lista a Conjuração inata à parte (com a CD); `rolar` usa a CD inata e os dados do nível.

**Decisões (assumido)**
- (assumido) "N/dia" sem "cada" é um contador para o grupo inteiro (`ficha.inata.grupo`); só existe um grupo por ficha.
- (assumido) A inata sai no nível dela, nunca num espaço maior.
- (assumido) A magia nova criada na parte inata nasce com nível 1 (o nível se acerta na engrenagem); a arrastada do compêndio traz o nível dela.
- (assumido) No personagem a mesma parte aparece na página Magias, com o botão "+ Conjuração inata" para quem edita.
- (assumido) Ritual: a mesa confia no jogador, não confere se a classe pode (a classe que só faz ritual de magia preparada) nem a duração extra; o texto "+10 min" é só lembrete.
- (assumido) A quantidade por nível só é calculada acima do nível da magia; no nível dela o Conjurar segue como antes (um dano só). No crítico os dardos e raios não dobram.
- (assumido) A magia só com salvaguarda e sem dano (Imobilizar Pessoa) agora manda o cartão da magia; antes o Conjurar não mandava nada.
- (assumido) Rajada Mística entra como dado a mais no nível 5, 11 e 17 (um raio a mais soma outro dado do dano), não como ataques separados.
- (assumido) O nível "do bloco" do NPC é o ND; não há campo de nível de conjurador no NPC.
- Sem migração de banco: a ficha é JSON e os campos novos são opcionais e aditivos (`ficha antiga carrega igual`, com teste).

**O que ficou para depois**
- Um acerto por raio (Raio Ardente) e por Rajada Mística; hoje o acerto é um só e o dano sai por raio.
- Mais de um grupo "N/dia" no mesmo bloco e a leitura do texto do monstro ("À vontade: ...") para preencher a inata sozinha.
- Gasto de usos pelo MCP (`rolar` não gasta bolinha).

## N3a — como ficou (2026-11-14)

**O que foi feito**
- **Monstros no compêndio.** `MonstroDoCompendioSchema` (`compendio.ts`): nome e nome original, tamanho, tipo, tendência, `ca { valor, fonte }`, `pv { media, formula }`, deslocamento (texto e `deslocamentoM`), os 6 atributos, `salvaguardas` e `pericias` (o bônus total do livro), vulnerabilidades, resistências, imunidades, imunidades a condições, sentidos, idiomas, `nd` e `xp`, `tracos`, `acoes`, `reacoes`, `acoesLendarias` (+ `textoDasAcoesLendarias`), `conjuracaoInata` e `conjuracaoPorEspacos`. Cada ação tem nome e texto e, quando der, `tipo`, `acerto`, `alcance`, `dano`, `tipoDeDano`, `dano2`, `salvaguarda { atributo, cd, sucesso }`, `recarga` e `usos`.
- **Itens mágicos.** `ItemMagicoDoCompendioSchema`: nome, nome original, `tipo` ("arma (espada longa)", "anel", "poção"...), `raridade` (comum, incomum, raro, muito raro, lendário, artefato, varia), `sintonizacao { necessaria, por? }`, descrição, `bonus` (+1 a +3), `arma` (a arma base) e peso e custo. Listas novas e opcionais no arquivo: `monstros` e `itensMagicos`; `magias` passou a ser opcional (um `monstros.json` não as tem), mas o arquivo precisa ter ao menos uma lista com entradas.
- **Vários arquivos.** A pasta `compendio/` pode ter `magias.json`, `monstros.json`, `itens.json` e `compendio.json` (o arquivo único com tudo). A mesa lê os que existem, nessa ordem, e os junta (`juntarCompendios`): nome repetido (sem acento nem caixa) fica com o do último arquivo e um aviso conta na aba. Um arquivo só vai à mesa como está (o `magias.json` antigo continua valendo e o hash não muda); com vários, a mesa registra o JSON junto como um asset só. Os créditos de todos se juntam, sem repetir parágrafo.
- **Limites.** `LIMITES_DO_COMPENDIO`: magias 2.000, armas 1.000, itens 2.000, monstros 2.000, itens mágicos 2.000, créditos 4.000. O asset do compêndio passou de 8 para 16 MB (`bytesDoCompendio`; o teto geral de arquivo é 30 MB, então cabe). Mil monstros de 2,5 KB de texto ficam em ~3 MB e a busca leva poucos ms (teste de unidade).
- **Carregar arquivos do compêndio…** (mestre, no topo da aba e no estado vazio; `compendio-arquivo` é o mesmo botão no estado vazio). Escolhe vários `.json`, valida cada um (um com erro derruba todos e o aviso diz qual arquivo e qual campo) e grava em `compendio/` com o nome pelo conteúdo (`nomeCanonicoDoArquivo`: só monstros → `monstros.json`; só itens ou itens mágicos → `itens.json`; só magias e armas → `magias.json`; misturado → `compendio.json`), somando ao que a pasta já tem. Sem pasta autorizada, os arquivos valem até recarregar. Depois a mesa relê a pasta e redefine o compêndio. É o caminho do N3b.
- **Aba Compêndio.** Seções Monstros e Itens mágicos (só aparecem se há entradas). Monstros: busca por nome e nome original, filtros de tipo (sem o parêntese), tamanho e ND de/até (0, 1/8, 1/4, 1/2, 1 a 30). A linha abre o cartão com o bloco inteiro (CA, PV, atributos com modificador, testes, perícias, resistências, sentidos, idiomas, ND com XP, traços, ações, reações, ações lendárias e a conjuração), arrasta para o mapa e tem "Criar NPC". Itens mágicos: busca, tipo e raridade (etiqueta com a raridade); a linha abre a descrição, arrasta para a ficha e tem "Adicionar". Os créditos de cada arquivo aparecem em "Créditos".
- **Criar NPC.** `monstroParaFicha` / `personagemDoMonstro` (`compendioParaFicha.ts`, puras, testadas): atributos, CA com a fonte, PV com a fórmula, ND (o XP e a proficiência saem dele), tamanho, tipo, tendência (`alinhamento`), deslocamento (o primeiro número em metros vira `deslocamentoFt`; o texto inteiro vai para as notas quando tem mais), idiomas, sentidos e as listas de defesas; os bônus totais de testes e perícias viram proficiência (`proficiente`, `especialista`) mais o bônus que sobrar; traços viram `caracteristicas`; ações, reações e lendárias viram `ataques` com `categoria` (acerto fixo, dano e tipo do livro; a salvaguarda leva a CD do livro por `cdBonus`); a conjuração inata e por espaços viram `magias` (com o texto e a jogada das que o compêndio tem; as que faltam entram só com o nome e um aviso), `espacosTotal`, `inata` e `habilidadeDeConjuracao`. O token nasce com 1, 2, 3 ou 4 quadrados pelo tamanho. O botão cria a ficha na pasta NPCs e a abre; arrastar para o mapa (só o mestre) manda `personagem.criar` e `personagem.colocar` em seguida, encaixado na grade. Soltar um monstro numa ficha aberta é recusado com a dica de usar Criar NPC.
- **Item mágico na ficha.** No personagem vai para o Equipamento com raridade, tipo, sintonização e descrição na nota (`ItemDaFicha.nota` passou de 500 para 4.000 caracteres; o campo da ficha também), uma unidade a mais se já tem. A arma com `arma` vira também um ataque com `bonusMagico` (+1 a +3). No NPC vira traço (e ação, se é arma). A ficha aceita soltar o item mágico onde aceita o item comum.
- **MCP.** `compendio` busca monstros (`nd` exato ou `ndMin`/`ndMax`, `tamanho`, `tipoDeCriatura`) e itens mágicos (`raridade`, `tipoDeItem`), com `tipo: "monstro" | "itemMagico"`; o `detalhe` mostra traços e ações. `fichas` aceita `monstro` (nome) e `quantidade` (1 a 20): "Goblin 1" a "Goblin 4", NPCs completos, só para o mestre. O MCP em stdio (`apps/mcp`) lê a pasta `compendio/` inteira (ou um arquivo, ou uma pasta, em `TAVOLA_COMPENDIO`). O panorama conta monstros e itens mágicos.
- **Exemplo livre.** `fixtures/compendio/exemplo-srd.json` ganhou Goblin, Lobo e Mago (com 16 magias; as três do exemplo entram completas) e quatro itens mágicos (Poção de Cura Superior, Anel de Proteção, Espada Longa +1 e Bolsa de Carga), do SRD 5.1 (CC-BY-4.0), em português, com a atribuição já nos créditos. Nada dos livros do Vilella no repositório.
- **Bug achado no caminho.** `NIVEIS_DE_DESAFIO` vinha de `Object.keys` e as chaves inteiras saem primeiro: o seletor de ND do bloco de NPC listava 0, 1, 2... 30, 1/8, 1/4, 1/2. Agora a ordem é explícita (0, 1/8, 1/4, 1/2, 1... 30), com teste.

**Decisões (assumido)**
- (assumido) O arquivo certo para um `monstros.json` é o formato do compêndio com a lista `monstros` (nada de formato à parte).
- (assumido) "Carregar arquivos" grava pelo conteúdo, não pelo nome que o arquivo tinha, e **soma** ao arquivo da pasta (o novo vence um nome repetido, com aviso). Um arquivo da pasta com erro barra a gravação e diz qual corrigir.
- (assumido) O bloco do monstro é segredo do mestre: a seção Monstros só aparece para ele. **O dado não é protegido**: o arquivo do compêndio é um asset só e chega a todos os navegadores da mesa (ver "Frágil" no `PASSAGEM.md`). Os itens mágicos aparecem para todos.
- (assumido) O deslocamento do livro ("9 m, voo 18 m"): a ficha só tem um número, então vale o primeiro em metros e o texto inteiro vai para as notas.
- (assumido) As perícias do livro que a ficha não conhece (ex.: "Pilhagem") vão para as notas, com um aviso.
- (assumido) A CD de salvaguarda do livro vira `salvaguarda` com a CD calculada pelo atributo de maior modificador e o `cdBonus` que fecha a conta (a CD mostrada é a do livro, e muda se o atributo ou o ND mudarem).
- (assumido) Item mágico repetido soma uma unidade (poções empilham) e não repete o ataque.
- (assumido) A raridade "varia" existe para os itens do SRD que mudam de raridade.
- (assumido) `ItemDaFicha.nota` sobe para 4.000 caracteres para a descrição do item mágico caber; o campo da ficha continua de uma linha só (ver "O que ficou para depois").
- Sem migração de banco nem mudança de protocolo: o compêndio da mesa continua sendo `{ hash, nomeOriginal, magias }` (o campo `magias` agora vale o total do compêndio junto; ele só confere a contagem de magias) e a ficha é JSON com campos opcionais.

**O que ficou para depois**
- Proteger o bloco do monstro de verdade: um asset de compêndio só do mestre (o dado hoje chega ao navegador do jogador).
- O extrator que lê os PDFs (N3b).
- O campo de nota do item no equipamento mostra uma linha; uma descrição longa pede uma caixa maior ou um item que abre (hoje se lê pelo Compêndio).
- Gastar a conjuração inata do monstro pelo MCP; arrastar o monstro para uma ficha já existente (hoje só cria ficha nova).

## N4 — como ficou (2026-11-14)

**O que foi feito**
- **Ferramenta Névoa** (mestre, fora do "ver como"; ícone de nuvem, atalho **N**). O painel abre à direita, no lugar dos painéis de ferramenta: **Cobrir** ou **Revelar**; formas **Pincel** (raio em metros, 0,25 a 30), **Retângulo** (arrasta de um canto ao outro) e **Polígono** (clique a clique; duplo clique ou Enter fecha, Esc cancela, Backspace tira o último ponto); **Desfazer** (botão e Ctrl+Z dentro da ferramenta); **Cobrir tudo** e **Revelar tudo**, com confirmação na página.
- **Dados.** `Cena.nevoa` (opcional): lista de traços `{ forma: pincel | retangulo | poligono | tudo, modo: cobrir | revelar, pontos, raio? }` em metros, na ordem. O resultado é a composição em sequência: o último traço que contém o ponto decide; sem traço, revelado. Código em `packages/shared/src/nevoa.ts` (`pontoNaNevoa`, `acrescentarTraco`, `compactarNevoa`, `simplificarCaminho`).
- **Protocolo.** Intenções `nevoa.tracar { cenaId, traco }` e `nevoa.desfazer { cenaId }`, as duas com a capacidade `cena.editar` (só do mestre). Eventos `nevoa.tracada` e `nevoa.desfeita`: o mestre recebe todos; o jogador, só os da cena ativa (a névoa não é segredo). Um traço novo não reenvia a cena: chega só o traço.
- **O que o jogador vê.** Uma camada por cima do mapa, dos desenhos e dos tokens, escura e opaca (`camadaDeNevoa.ts`: os traços são compostos numa textura de baixa resolução, no máximo 2048 px e metade da escala do mundo; cobrir pinta e revelar apaga). Os tokens com o **centro** sob a névoa **não são desenhados** para ele, menos os tokens que ele mesmo controla. Vale por cima da luz e da visão (coberto é escuro mesmo iluminado; revelado segue a luz de sempre) e **vale na cena-cartão**.
- **O que o mestre vê.** Um véu translúcido (50%) e hachurado sobre a área coberta, com todos os tokens. "Ver como" um jogador mostra a névoa opaca e os tokens sumidos, como na tela dele (a posse do token é a do jogador visto, `controlaNaVisao`).
- **Duplicar a cena** leva a névoa (`cena.duplicar` copia a cena inteira). Exportar e importar levam a névoa (ela mora na cena). Sem o campo (campanha antiga) não há névoa.
- **Sem migração de banco:** a cena é uma entidade em JSON; o campo novo é opcional. `versao_esquema` continua 15.

**Crescimento (medido)**
- O pincel chega simplificado (Ramer-Douglas-Peucker, 2 casas decimais, no máximo 128 pontos por traço). Limites por cena: **300 traços** e **6.000 pontos**. Enquanto cabe, a lista guarda tudo (o desfazer volta traço a traço). Ao passar do limite ela é compactada: "Cobrir tudo" e "Revelar tudo" valem como o começo da lista e os "revelar" antes de qualquer "cobrir" saem. Se nem assim couber, a sala recusa o traço com a mensagem para usar "Cobrir tudo" ou "Revelar tudo".
- Medida no teste de unidade: 300 traços de pincel de 20 pontos pesam menos de 200 KB em JSON, e 400 consultas de ponto (um mapa cheio de tokens) levam bem menos que um quadro. A textura só é refeita quando a lista muda.

**Decisões (assumido)**
- (assumido) A cena guarda os traços (e não uma grade rasterizada): é exata, pequena nos usos reais e deixa o desfazer simples. A textura de baixa resolução é só de tela.
- (assumido) Os tokens do próprio jogador continuam visíveis para ele mesmo cobertos; os do mestre, os NPCs e os ocultos seguem a regra do centro do token.
- (assumido) A névoa manual não esconde da rede o que está sob ela (decisão do Vilella: os jogadores não vão fuçar o F12; o "mapa revelado aos poucos" foi descartado).
- (assumido) Retângulo e polígono encaixam na meia célula do grid (Alt solta); o pincel é livre.
- (assumido) Desfazer é por cena e não tem "refazer".
- (assumido) A configuração da ferramenta (modo, forma, raio) é só da tela do mestre e não fica guardada ao recarregar.
- (assumido) A cor da névoa e do véu é conteúdo do mapa (como a cor do mapa), fixa no Pixi: não entra nos temas.

**O que ficou para depois**
- Refazer (Ctrl+Shift+Z) da névoa, pincel com borda suave, e guardar a configuração da ferramenta como preferência.
- Gerenciar a névoa pelo MCP (hoje só pela tela).
- Névoa individual por jogador (cada um revela o seu): fora do pedido.

## N5 — como ficou (2026-11-14)

**O que foi feito**
- **Som como asset.** Tipo novo `som` (mp3, ogg e wav, até 20 MB = 80 pedaços de 256 KB; `validarMeta` confere o MIME e o tamanho). O arquivo fica no computador do mestre (pasta local, `sons/` ou qualquer subpasta, ou um arquivo escolhido à mão) e viaja por pedaços pelo mesmo caminho das imagens, com cache OPFS. Só o mestre registra som. Todo jogador pode baixar qualquer som da mesa (`assetVisivelPara`), mas o `asset.meta` que ele recebe leva `nomeOriginal: "som"` (o nome do arquivo poderia contar o que a zona faz).
- **Painel de Som** (botão de alto-falante na barra, só do mestre, fora do "ver como"): **Trilha** (nome, volume, Parar, lista com busca e "Escolher arquivo…"; trocar faz a transição de 2 s no navegador de cada um), a **trilha padrão da cena** ("Usar a que toca" e "Tirar") e **Efeitos** (um clique toca uma vez, com volume próprio). A opção "Ouvir as zonas do token selecionado" liga o som de zona também no mestre.
- **Trilha e relógio.** `Estado.trilha { hash, nome, volume, inicioMs, servidorMs? }` (opcional, guardada na chave `trilha` da tabela `meta`). `inicioMs` é o relógio real da sala. Cada cópia que sai da sala (snapshot e evento) leva `servidorMs` = agora; o navegador calcula o desvio (`desvioDoRelogio`) e o ponto do laço (`pontoDaTrilha`), então quem entra no meio ouve do ponto em que está e quem se afasta mais de 1,5 s volta a ele. O mesmo som de novo só muda o volume.
- **Som por zona.** `EfeitosDaZona.som { hash, nome, volume, laco }`. A sala calcula, depois de cada mudança, os sons das zonas onde há um token que o jogador controla (`sonsDasZonasParaJogador`) e manda a ele a mensagem transitória `som.zona { sons: [{ hash, volume, laco }] }` só quando a lista muda: nunca a zona, o nome nem as regras. Fade de entrada e saída de 1,2 s.
- **`som.tocar` nas automações.** `{ acao: "som.tocar", hash, nome, volume (0,8), para: todos | cena | token }`. Emite o evento `som.efeitoTocado`; `eventoPara` entrega só a quem ouve (`efeitoChegaPara`) e sempre como "para todos". O editor ganhou o formulário (som da mesa ou "Adicionar um som à mesa", volume, quem ouve).
- **Preferências → Som** (depois de Aparência): silenciar tudo, volume geral, da trilha e dos efeitos, resumo "Volume 80% · trilha ligada", marca "só neste navegador", botão "Ativar o som da mesa" quando o navegador bloqueia. Tudo em `tabletop:pref:som`, nunca vai à sala.
- **Autoplay.** Quando o navegador recusa o primeiro som aparece o aviso "Clique para ativar o som da mesa" (com "Agora não", que fica guardado).
- **Protocolo.** Intenções `som.trilha { hash, volume }`, `som.parar`, `som.efeito { hash, volume }` (capacidade nova `som.controlar`, só do mestre); `cena.editar` ganhou `trilha`. Eventos `som.trilhaAlterada` e `som.efeitoTocado`. Mensagem da sala `som.zona`. `grupo.moverPara` começa a trilha padrão da cena.
- **Exportar e importar.** `hashesUsados` inclui o som da trilha, das cenas, das zonas e das ações `som.tocar`: a exportação leva a meta (nunca os bytes). `Estado.trilha` fica fora da exportação (o relógio dela é de outra sessão). Sem migração de banco: a trilha mora na chave `trilha` da tabela `meta`.

**Decisões (assumido)**
- (assumido) 20 MB por som e só mp3, ogg e wav. A lista aceita o arquivo pelo nome quando o navegador não diz o MIME.
- (assumido) A trilha padrão da cena só começa ao levar o grupo; cena sem trilha deixa a que toca seguir. Se a trilha da cena é a que já toca, não recomeça.
- (assumido) O mestre ouve efeitos e trilha sempre; as zonas só se ligar "Ouvir as zonas" e com o token selecionado.
- (assumido) A pré-carga é a trilha que toca e a trilha padrão das cenas que a pessoa recebe. Os efeitos e os sons de zona baixam na primeira vez que tocam (a zona é secreta: não dá para adiantar sem dizer que ela existe).
- (assumido) Som de zona sem laço toca uma vez por entrada.
- (assumido) O volume geral começa em 80%, o da trilha e o dos efeitos em 100%.
- (assumido) Efeito para "cena" vale para quem está na cena do grupo; "token" para quem controla o token do evento (o mestre ouve sempre). Um efeito disparado numa intenção que manda snapshot novo ainda chega, logo depois dele.
- (assumido) O Claude (MCP) não ganhou ferramenta de som.

**O que ficou para depois**
- Pausar a trilha (hoje só tocar e parar), lista de reprodução, som posicional (volume pela distância), "Preparar" os sons de zona e de efeito e ferramenta de som no MCP.
- Uma pasta de sons própria na tela inicial (hoje vale a pasta de imagens da mesa).

## Em aberto

- **O plano R1 a R6 terminou** (R1, R2, R2b, R3, R4 em 2026-11-10; R5a, R5b, R6a e R6b em 2026-11-11). Agora o Vilella faz os ajustes
  finos de UX/UI e a reorganização dos itens, a partir de `docs/PASSAGEM.md`.
- Itens de interface que sobram: seleção múltipla no mapa (ainda não existe), toque (celular) e navegadores além do Chrome, "Entregar" a
  tocha só por arrastar. A dica das condições por clique e as alças de tocha sobre o ícone de ponto foram resolvidas no R5a.

## Automações da mesa (7b)

Os lotes 7b-1 a 7b-3 (motor, zonas, editor e campanhas) vêm depois dos ajustes do Vilella; o plano está no `PROJETO.md` (seção 7, "Lote 7b").

### 7b-1 — como ficou (2026-11-13)

**O que foi feito**
- **O motor**, puro, em `packages/shared`: `automacoes.ts` (schemas zod de ciclo, fase, reação, ação, condição, evento, efeito e a fatia
  `Estado.automacoes`) e `automacoesnucleo.ts` (executar evento, eventos do sistema, avançar os ciclos, as intenções). `nucleo.ts` ganhou
  `processarEvento` e chama o motor depois de toda intenção que mudou algo (`processar`) e no alarme (`processarSistema`).
- **As automações ficam numa fatia só do mestre** (`Estado.automacoes`), fora dos modelos; `Estado.efeitos` guarda o limite de visão dos tokens.
- **Modificadores com prazo:** `raioX` e `raioSomaM` no objeto de luz; `visaoMaxM` no token (`efeitos`). O valor base nunca muda.
- **Dez intenções novas** (`automacao.editar`) e dois eventos (`automacoes.alterado`, `efeitos.alterados`); o erro ganhou `ciclo_inexistente` e `reacao_inexistente`.
- **Agendador:** um vencimento `automacao.marco` (próxima fase, evento pendente ou fim de efeito).
- **Guardar:** chaves `automacoes` e `efeitos` da tabela `meta` (sem migração); exportar e importar levam tudo.
- **Interface mínima:** o raio da luz com o modificador (a luz do mapa e o anel da luz selecionada) e o anúncio no chat ("A mesa", em itálico).
  Sem editor: ele é o 7b-3.

**Decisões (assumido)**
- (assumido) Uma fatia própria no estado em vez de reações dentro do modelo; o arquivo de campanha aceita a forma enxuta e converte na importação.
- (assumido) O efeito de luz mora no objeto (o campo `modificadores` já existia, com `origem: "automacao"`) e o de token em `Estado.efeitos`: um modificador por alvo, sem uma lista única.
- (assumido) O ciclo sem cenas vale para todas; a fase de `emS` 0 dispara na hora em que o ciclo começa; ciclo vindo de arquivo começa quando a mesa corre; `ciclo.criar` roda já, salvo com `pausado`.
- (assumido) `ciclo.disparar` pula o ciclo para o começo da fase seguinte (e a dispara); `ciclo.editar` que muda período ou fases reinicia.
- (assumido) Sem `porS`, o prazo é o `duracaoS` da fase; sem ele, 30 s. O mesmo efeito de novo renova o prazo (não empilha).
- (assumido) Profundidade máxima 5; teto de 500 ações por disparo; 50 fases atrasadas por vez; o registro do mestre guarda as últimas 30 anotações.
- (assumido) `objeto.apagar` sem `penalidadeS` não desconta nada (a penalidade da mesa não se aplica); `chance` sem valor é 1.
- (assumido) A condição `tag` precisa de um objeto no evento ou na instância; sem ele, não passa. A `cena` olha a cena do objeto (ou a única do evento).
- (assumido) `evento.disparar` dentro de uma reação leva o mesmo objeto do evento (a reação do modelo não se multiplica pelas instâncias).
- (assumido) O jogador recebe o limite de visão só dos tokens que controla (a visão dos outros não muda o que ele enxerga).
- (assumido) O anúncio do chat é uma mensagem `aviso` sem autor real; para o mestre vai como sussurro vazio (só ele vê).
- (assumido) A exportação leva os efeitos ativos e a execução dos ciclos (o prazo é em tempo da sala, e a campanha importada começa pausada nesse tempo); a versão do arquivo continua 13.

**O que ficou para depois**
- O editor, os botões fixáveis, a liberação para jogadores e as campanhas de referência (7b-3); as zonas e `token.entrouNaZona` (7b-2); `som.tocar` (lote de som).
- Mostrar o registro do mestre (encadeamento cortado) em algum lugar da tela: hoje só está no estado (resolvido no 7b-3: "Avisos do motor" no editor).

### 7b-2 — como ficou (2026-11-13)

**O que foi feito**
- **A zona** (`packages/shared/src/zonas.ts`): polígono de uma cena (3 a 64 pontos, em metros) com `ativa` e `efeitos` (`luzRaioX`, `luzSomaM`, `visaoMaxM`). Mora em `Estado.zonas`, só do mestre; as reações dela ficam na fatia `automacoes` com `fica: { tipo: "zona", id }`.
- **O motor** (`automacoesnucleo.ts`): `sincronizarZonas` reconcilia, depois de toda intenção que mudou algo, o modificador `zona:<zona>` nas luzes e o efeito `zona:<zona>:<token>` em `Estado.efeitos`; `eventosDoSistema` produz `token.entrouNaZona` e `token.saiuDaZona`; ação `zona.ativar`; condição `dentroDaZona`.
- **Protocolo:** `zona.criar`, `zona.editar`, `zona.apagar` (`automacao.editar`) e os eventos `zona.alterada` e `zona.apagada` (só o mestre); o erro `zona_inexistente`.
- **Guardar:** coleção `zonas` da tabela `entidades` (sem migração SQL); exportar e importar levam as zonas; duplicar a cena as copia; apagar a cena as apaga.
- **A ferramenta "Zonas"** (tecla Z) e o painel da zona, só do mestre; o gancho de teste `zonas()` e `zonaDesenhando()`.

**Decisões (assumido)**
- (assumido) "Dentro" é o centro do token no polígono (borda conta); a luz acompanha quem a carrega ou o ponto onde está; na mochila não está em zona nenhuma.
- (assumido) O efeito "enquanto dentro" não tem prazo e é **reconciliado** (compara o que deve valer com o que está lá), em vez de entrar e sair por evento: assim desligar, apagar, mover e trocar de cena nunca deixam efeito preso. O `ateSala` do efeito de token já era opcional; o id `zona:...` e a origem identificam o efeito da zona.
- (assumido) `token.entrouNaZona` e `token.saiuDaZona` não saem quando a própria zona é criada, apagada, ligada ou desligada (só quando o token muda de lugar, nasce, some ou troca de cena). O token apagado "sai".
- (assumido) A reação de uma zona só roda para o evento daquela zona e só atinge o que está dentro dela; `dentroDaZona` e `zona.ativar` sem `zona` usam a zona da própria reação. Zona desligada não reage nem passa na condição.
- (assumido) Reações de modelo, cena ou mesa que ouvem `token.entrouNaZona` ou `token.saiuDaZona` agem, por padrão, no token do evento.
- (assumido) Duplicar a cena copia as zonas e as reações delas (ids novos); apagar a zona apaga as reações dela (o Desfazer do Delete as recria).
- (assumido) Os efeitos do painel são em metros mesmo com a unidade em pés; o campo vazio tira o efeito. A cena-cartão não aplica o limite de visão (a luz continua).
- (assumido) A zona aparece para o mestre mesmo fora da ferramenta (fraca, só o contorno e o nome); a ferramenta a destaca. Fora do "ver como": o mestre vendo como jogador não a vê.
- (assumido) Tecla Z para a ferramenta; Esc cancela o polígono (ao contrário das paredes, onde Esc encerra); Backspace tira o último ponto; os pontos encaixam na meia célula.
- (assumido) Correção de um bug do 7b-1 que o lote achou: no zod o `.partial()` ainda aplica o padrão do campo ausente, então `reacao.editar` só com o nome zerava as condições (`se`) e religava a reação, e `ciclo.editar` zerava as `cenas`. As mudanças das três intenções (`ciclo.editar`, `reacao.editar`, `zona.editar`) agora não herdam os padrões. Teste de unidade em `zonas.test.ts`.

**O que ficou para depois**
- Editar as reações da zona (o editor do 7b-3; o painel só mostra a contagem); botões e liberação para jogadores; as campanhas de referência (7b-3); `som.tocar`.
- Contagem de reações e nome da zona só no painel: a zona não aparece na lista de nada.

### 7b-3 — como ficou (2026-11-13)

**O que foi feito**
- **O editor das automações** (`apps/web/src/automacoes/`): uma janela flutuante "Automações", aberta pela aba Mesa (seção nova "Automações", botão "Abrir as automações"). Só o mestre a vê. A lista mostra os **ciclos** (fase atual e tempo até a próxima ao vivo, disparar, pausar e retomar, "Fixar na barra", "Liberar aos jogadores", editar e apagar), as **reações** agrupadas por onde ficam (modelo, cena, zona, mesa; ligar e desligar sem apagar), os **botões de evento**, os **eventos em uso** (com quantas reações os ouvem) e, numa linha discreta no fim, os **Avisos do motor** (o `registro` do 7b-1, agora à vista).
- **Um formulário para cada peça.** Ciclo: nome, período, cenas (nenhuma = todas), fases (em quantos segundos, evento, duração dos efeitos). Reação: nome, ligada, onde fica, evento, condições e ações em listas fechadas, cada ação com os campos dela em português. Os campos de distância (soma ao raio, alcance de visão) seguem metros ou pés. Botão de evento: nome, evento, cena.
- **O JSON ao lado.** Um recolhível "Ver como JSON" com o mesmo rascunho, editável. O que se escreve vale na hora no formulário; os erros do zod aparecem **em português**, no campo e na lista do JSON ("Fase 2: Em quantos segundos: precisa ser pelo menos 0."), e **nada é enviado com erro** (Salvar mostra os erros e para). Erro de escrita do JSON também fala português.
- **Nomes de evento.** Os do sistema aparecem amigáveis ("Uma luz acendeu"); os do mestre são texto livre, com sugestão dos que já existem.
- **Os botões na barra de cima.** Cada ciclo e cada botão de evento ganha "Fixar na barra": um chip pequeno (ciclo: nome, fase e tempo até a próxima, disparar, pausar ou retomar; evento: nome e disparar).
- **Liberar aos jogadores.** O jogador vê só o chip (nome, disparar e, no ciclo, pausar ou retomar), sem nada da definição. Nova intenção `botao.usar`; a sala confere a liberação **a cada clique** e limita a 1 disparo a cada 2 s por jogador.
- **Botões de evento** (novo): `Automacoes.botoes`, com as intenções `botao.criar`, `botao.editar` e `botao.apagar` (`automacao.editar`). O ciclo ganhou `fixado` (o `liberadoParaJogadores` já existia).
- **As campanhas prontas** (`fixtures/campanhas/`): `5e-padrao.json` (mesa limpa: tocha, lanterna e fogueira, nenhuma automação) e `chama-primordial.json` (a tabela de `docs/IDEIAS.md`). Carregam pelo caminho da importação, e há uma lista "Campanhas de exemplo" na aba Mesa → Campanha, com a mesma confirmação "Importar e substituir".
- **Os três acertos do 7b-2.** Os painéis de ferramenta (Zonas e Paredes) abrem encostados à direita da área do mapa, abaixo do topo (`dasFerramentas` em `janelas/geometria.ts`), arrastáveis como antes e lembrando a posição. Os campos de distância das Zonas ("Luz ±", "Visão máxima") seguem metros ou pés (`CampoDeDistancia`). O fator ("Luz × fator") mostra vírgula ("0,5") e aceita vírgula ou ponto na digitação (`CampoDecimal`, `decimal.ts`).
- **Tour:** meia frase sobre as Automações no passo da aba Mesa.

**Decisões (assumido)**
- (assumido) O editor é uma janela flutuante aberta da aba Mesa (a aba é estreita demais para o formulário); o padrão é o das outras janelas (`Janela`).
- (assumido) O que se fixa na barra e o que se libera moram **com a campanha**: `fixado` e `liberadoParaJogadores` no ciclo e no botão de evento (guardados com as automações, exportados e importados). O botão de ciclo não tem lista própria: o botão de um ciclo é o próprio ciclo.
- (assumido) O jogador recebe a lista dos botões liberados como `Estado.botoes` e o evento `botoes.alterados` (só o rótulo, o tipo e, no ciclo, se está pausado). O evento nasce da filtragem de `automacoes.alterado` (o jogador nunca recebe a fatia) e só chega se a lista dele mudou. O nome que o mestre dá ao ciclo ou ao botão liberado é o rótulo que o jogador vê: ele escolhe.
- (assumido) `botao.usar` não tem capacidade (`null`): vale para mestre e jogador, e a conferência é a liberação do botão. Botão que não existe ou não está liberado dá o mesmo erro `sem_permissao` (o jogador não descobre o que há por trás). O mestre usa qualquer botão.
- (assumido) Limite de frequência: 1 disparo a cada 2 s por jogador, na sala (memória, zerada em `/teste/zerar`); o que passa disso volta `muitas_mensagens`. Só o disparo aceito conta (o recusado não segura o próximo). O mestre não é limitado.
- (assumido) O jogador pode disparar, pausar e retomar o ciclo que o mestre liberou (não há liberação por ação).
- (assumido) Ciclo que ainda não começou (a mesa pausada, ou veio de um arquivo) mostra "no começo" e nenhum tempo até a próxima fase.
- (assumido) Id novo de ciclo, reação e botão: o nome sem acento e com hífens ("Respiração de teste" vira `respiracao-de-teste`); sem o nome, `ciclo`, `reacao` ou `botao`; repetido, ganha `-2`. Dá para mudar pelo JSON.
- (assumido) Editar um ciclo que mudou só `fixado`, `liberadoParaJogadores`, nome ou cenas não o reinicia (só período e fases reiniciam, como no 7b-1). A reação editada não consegue apagar o nome (o campo vazio some do envio).
- (assumido) A chance aparece em % nos formulários (30 em vez de 0,3); o JSON continua de 0 a 1.
- (assumido) Enter dentro de um campo do formulário só confirma o campo; quem salva é o botão Salvar.
- (assumido) Apagar pede confirmação na própria janela ("Apagar “nome”? Apagar / Cancelar"), nada de `confirm()`.
- (assumido) A Chama Primordial tem 3 cenas sem imagem (Entrada da Montanha, Pulmão da Montanha, Farol da Eclusa), só o modelo Tocha (1800 s, tag "chama", penalidade ao apagar de 60 s na configuração da mesa), o ciclo da respiração (180 s: inspiração aos 0 s, expiração aos 90 s, fixado na barra), 4 reações (a rajada que encolhe e pode apagar com 30% e 300 s, o vapor que limita a visão a 1,5 m na cena do Pulmão, o aviso ao mestre de que uma tocha foi reacesa, o aviso de quem entrou no Ar Morto), um botão "Rajada de vento", 2 zonas no Pulmão (Ar Morto, ×0,7; Câmara do Ar Rarefeito, ×0,5) e 2 suportes no Farol da Eclusa. Sem personagens, tokens, handouts nem notas: nada da história secreta da bíblia está em texto que o jogador veja (os textos das reações e os nomes das zonas são do mestre). A mesa começa pausada, como toda campanha importada.
- (assumido) A lista de exemplos troca os `usuarios` e as `permissoes` do arquivo pelos da mesa de agora (`exemploParaEstaMesa`), senão quem importa não seria mestre na campanha nova e a sala recusaria. Importar o arquivo à mão só vale se os ids de usuário do arquivo forem os da mesa (é o caso da mesa de teste); pela lista de exemplos funciona em qualquer mesa.
- (assumido) Os botões ficam à direita dos menus do topo; em tela estreita (1280×720) cedem o nome da cena e o texto do chip (reticências); os botões de ação do chip nunca somem.
- (assumido) Sem atalho de teclado novo.

**O que ficou para depois**
- Editar o desenho da zona e as reações dela de dentro da janela das Zonas (as reações da zona se editam no editor das automações; o painel da zona ainda só mostra a contagem).
- Liberar só algumas ações de um ciclo (hoje: disparar, pausar e retomar juntos); atalhos de teclado para os chips; ordenar os chips.
- `som.tocar` (lote de som); o MCP (12).


### 12-1 — como ficou (2026-11-13)

**O que foi feito**
- **O token de acesso do Claude**, por conta e por mesa. Em Preferências, a seção "Conectar o Claude": "Gerar token" (nome opcional, até 5 por conta), o token aparece **uma vez** com Copiar e o trecho pronto para o Claude Code e para o Claude Desktop (`apps/web/src/claude/textosDoClaude.ts`, o lugar único que o 12-2 troca), a lista com nome, criação e último uso e "Revogar" com confirmação na página. A sala guarda só o SHA-256 (tabela `tokens_claude`, migração 13).
- **A conexão do Claude**: o WebSocket abre com `Authorization: Bearer <token>` (sem cookie, sem sessão de navegador, nenhuma rota HTTP aceita o token). A sala marca o socket (`claude: true`, `tokenId`) e age como o usuário: `processar` recebe `{ claude: true }` e recusa a lista de proibidos (`PROIBIDAS_AO_CLAUDE`, mesmo para o mestre), marca as mensagens com `peloClaude` e, para o mestre, carimba o que ele cria como rascunho. Limite de 20 pedidos por segundo por token (rajada de 40). Revogar derruba a conexão (4001) na hora. Token errado, malformado ou revogado: o mesmo 401; cada falha entra no bloqueio por IP do login.
- **Presença**: a conexão do Claude não vira outra pessoa (não conta como online nem segura a mesa sem mestre); a bolinha da pessoa ganha uma marca pequena "Claude conectado" (`presenca.claude`).
- **"Pelo Claude"**: mensagem e rolagem criadas pela conexão do Claude levam a marca (um selo no cabeçalho da mensagem), visível para todos. A rolagem oculta segue a capacidade do usuário.
- **A capacidade "Criar fichas e notas próprias"** (`personagem.criarProprio`, delegável, ligada por padrão, em Permissões e na exceção por jogador): o jogador cria a própria ficha e o próprio handout, com teto de 20 de cada. Na aba Fichas, "Nova ficha" e "Novo handout" para o jogador (o mesmo editor de hoje). O dono edita e apaga o que criou; o mestre sempre vê, edita e apaga.
- **Rascunhos do mestre**: o que o Claude do mestre cria entra com `rascunho: true` (cenas, fichas e NPCs, handouts, pastas, modelos, pontos, luzes, tokens, zonas, ciclos, reações e botões). Invisível ao jogador (snapshot e evento), sem efeito (ciclo e reação não rodam; a cena não vira a do grupo). Para o mestre: selo "Rascunho" nas fichas, handouts, pastas, cenas, ciclos, reações e botões e o chip "Rascunhos do Claude (N)" no topo, com a lista, "Publicar" (por item ou tudo) e "Descartar" (com confirmação na página). Intenções `rascunho.publicar` e `rascunho.descartar`.
- **"Desfazer o que o Claude fez"**: a sala anota o inverso de cada mudança do Claude (diário `claude_lotes`, migração 14, 50 lotes por usuário, fora da exportação), agrupado pelo `loteId` do envelope. Em Preferências, "O que o Claude fez" lista os lotes ("Claude: criou 6 NPCs · 6 itens · há 5 min") com Desfazer e há "Desfazer tudo o que o Claude fez". Desfaz na ordem inversa; o item que outra pessoa mudou depois é pulado e o aviso diz qual. Intenção `claude.desfazer`; mensagens `claude.lotes` e `claude.desfeito`.

**Decisões (assumido)**
- (assumido) O token tem o formato `tvc_` + 43 caracteres base64url (32 bytes do `crypto`); no máximo 5 por conta e mesa; `ultimo_uso` é gravado a cada conexão.
- (assumido) O token só vale no WebSocket. As rotas HTTP (`eu`, `contas`, tokens...) ignoram o `Authorization` e respondem como sem sessão; gerar e revogar com o cabeçalho dá 403. Nenhum cookie nasce.
- (assumido) A lista de proibidos fica em `packages/shared/src/claude.ts` e vai além da do brief nos arquivos: `asset.pedir`, `asset.inventario`, `asset.tenho` e `asset.naoTenho` (o Claude não tem arquivos e não envia imagens; assim ele também não vira um provedor de arquivos). Contas, chave da pasta, código de recuperação, apagar a mesa e tokens não são intenções: são rotas HTTP que o token nunca abre.
- (assumido) A conexão do Claude não recebe `contas.aviso` nem `preparo.*`.
- (assumido) Limite de 20 intenções por segundo por token, rajada de 40, em balde de fichas na memória da sala. O frame binário do Claude é descartado.
- (assumido) Onde ficam as fichas e os handouts do jogador: uma **pasta própria** (`pasta-de-<id>`, "Fichas de <nome>", visível só a ele e ao mestre) que a sala cria no primeiro item dele. A ficha: `editores` só ele; o handout: ele escolhe quem vê; pastas de outros nunca. A pasta e os itens levam `criadoPor`.
- (assumido) O dono muda a ficha toda (nome, token, visão, a ficha 5e), menos `editores` e `pastaId`; no handout, tudo menos a pasta. Desligar a capacidade bloqueia só criar.
- (assumido) Item que o jogador vê e não é dele: `sem_permissao`; item que ele não vê: `*_inexistente`.
- (assumido) Rascunho também vale para tokens (o brief dizia "token de rascunho não aparece"). Paredes, desenhos, configuração e chat que o Claude do mestre cria aplicam direto (entram no Desfazer, menos desenhos, configuração e chat).
- (assumido) O que nasce numa cena em rascunho (tokens, pontos, luzes, zonas) não leva a marca: publicar a cena o publica. A marca é sempre posta pela sala; o `rascunho` que o cliente mandar é ignorado.
- (assumido) O Claude do mestre também publica e descarta rascunhos (`mesa.configurar`). Editar um rascunho não o publica; editar o publicado aplica direto.
- (assumido) Ciclo disparado à mão (`ciclo.disparar`) ou evento manual não roda reação em rascunho; o ciclo em rascunho não ganha execução, então ao publicar começa dali.
- (assumido) O Desfazer cobre cenas, pastas, modelos, fichas, handouts, tokens, pontos, luzes, paredes, zonas, ciclos, reações e botões. **Publicar não conta como "mudou depois"**: o que o Claude criou e o mestre publicou ainda se desfaz. A publicação em si também é um passo desfazível.
- (assumido) Lote sem `loteId` é um lote por pedido ("Mexeu na mesa"); só entram lotes que mudaram alguma coisa (rolar e conversar não entram). Passos com mais de ~1,5 MB: o lote fica listado, mas não se desfaz.
- (assumido) O "Desfazer tudo" desfaz do lote mais novo ao mais velho, um pedido por lote.
- (assumido) A presença do Claude é uma marca pequena (um robô) na bolinha, sem lista própria.
- (assumido) O selo "Rascunho" não aparece em modelos, pontos, luzes, tokens e zonas na tela (eles estão na lista do chip); o token em rascunho só é visível ao mestre.
- (assumido) O chip "Rascunhos do Claude" fica no topo à direita, antes da presença; a lista é um painel que fecha com Esc ou clicando fora.

**O que ficou para depois**
- O servidor MCP em si (`apps/mcp`, lote 12-2), com o comando final e as instruções (hoje o texto de "Conectar o Claude" é provisório).
- Selo "Rascunho" nos painéis de modelos, pontos, luzes e zonas e um realce do token em rascunho no mapa.
- Revogar e gerar tokens também pelo mestre para outras contas (hoje cada um gerencia o seu).
- Desfazer para desenhos, configuração, permissões e relógio.

### 12-2 — como ficou (2026-11-13)

**O que foi feito**
- **O pacote `apps/mcp`** (`@tabletop/mcp`): um servidor MCP em stdio, em Node, com o SDK oficial `@modelcontextprotocol/sdk` 1.32.2. `pnpm --filter @tabletop/mcp build` gera `apps/mcp/dist/tavola-mcp.mjs` (um arquivo só, com o esbuild; o compêndio de exemplo vai dentro). Configuração por `TAVOLA_URL` (a origem da página da mesa ou o endereço completo do WebSocket; padrão `http://127.0.0.1:8787`), `TAVOLA_MESA` (o id; também vale se está no caminho da URL), `TAVOLA_TOKEN` e, opcional, `TAVOLA_COMPENDIO` e `TAVOLA_ESPERA_MS`. O token nunca vai para log nem para resposta (as respostas passam por um filtro que troca qualquer `tvc_...` por `tvc_…`).
- **A conexão** (`src/sala.ts`): abre o WebSocket nativo do Node com `Authorization: Bearer`, guarda o estado como o navegador faz (`reduzir`), reconecta sozinha (1 s, 2 s... até 30 s) e entrega cada pedido com a resposta da sala. Um pedido termina com o evento dele, com o `erro` dele, com um **snapshot novo** (publicar, descartar e criar item visível a outros respondem assim) ou, no Desfazer, só com o `claude.desfeito`. Fechamento 4001 (token revogado ou conta fora da mesa) não reconecta: as ferramentas respondem "Token inválido ou revogado: gere outro em Preferências → Conectar o Claude." Depois de uma falha, uma sonda HTTP de abertura separa 401 (token), 429 (IP bloqueado), 404 (mesa) e "fora do ar" (tenta de novo). Um balde de fichas no cliente (15 por segundo, rajada de 30) fica abaixo do limite da sala; o `muitas_mensagens` ainda é tratado (espera e repete).
- **As ferramentas** (11, sem nenhuma genérica): `panorama`, `ler`, `fichas`, `compendio`, `notas`, `objetos`, `cenas`, `automacoes`, `rolar`, `rascunhos` e `desfazer`. A lista é calculada a cada `tools/list` pelo papel e pelas capacidades do snapshot (`pode`): o jogador não vê `objetos`, `cenas`, `automacoes` nem `rascunhos`; sem a capacidade "Criar fichas e notas próprias" e sem ficha para editar, perde `fichas` e `notas`. Se o papel ou a permissão mudar, o servidor avisa `tools/list_changed`. Chamar uma ferramenta que não é sua responde "não está liberada" sem mandar nada à sala; a sala recusa de todo jeito o que não vale.
- **Princípios do 4.12**: nomes no lugar de ids (`src/nomes.ts`: id exato, depois nome igual, depois um trecho que só um item tem; nome repetido pede o id, nome que não existe lista o que existe); lote numa chamada só (cada item falha ou passa sozinho e o relatório diz quais); resumo por padrão e `completo: true` para o texto ou o JSON inteiro; esquemas de entrada em zod (derivados dos do `shared` onde dá: `AtaqueSchema`, `MagiaSchema`, `CaracteristicaSchema`, `RecursoSchema`, `MoedasSchema`, `NpcSchema`, `FaseSchema`, `AcaoSchema`, `CondicaoDeReacaoSchema`, `EfeitosDaZonaSchema`) e entregues como JSON Schema; toda intenção é validada pelo `IntencaoSchema` do `shared` antes de sair. Cada chamada que muda algo manda um `loteId` único (`mcp-` + 16 hex) e uma descrição curta ("fichas: Goblin") em **todas** as intenções dela; o pedido de Desfazer não leva `loteId`.
- **`fichas`**: cria e edita por partes (atributos, classes e nível, salvaguardas, perícias, PV, CA, ataques, magias à mão, nomes do compêndio, itens e equipamento, traços, recursos, moedas, história, NPC). Faz a conta da mesa: PV médios por classe, nível e Constituição quando ninguém os dá; salvaguardas da primeira classe ao criar; os nomes do compêndio entram por `aplicarEntradaNaFicha` (arma vira ataque calculado, magia vai para a lista, item para o equipamento). A edição manda só a diferença (`operacoesDeDiferenca` e `ficha.alterar`).
- **`cenas`**: coordenadas em **células** (`[coluna, linha]`, a partir do canto de cima à esquerda, com meias células); paredes pela rede de meia célula (`encaixarMeiaCelula`), arco "de a até b passando por c" (`por`) ou tangente (`meioDoArcoTangente`); tokens de NPC pela ficha (`quantidade` os numera e põe em fila). **`objetos`**: modelos, pontos e luzes fixas. **`automacoes`**: zonas, ciclos, reações e botões, com nomes no lugar de ids em condições e ações. Tudo do mestre entra como rascunho (a sala carimba).
- **`rolar`**: expressão (com `vezes`, de 1 a 12), teste da ficha (perícia, atributo, salvaguarda ou iniciativa, com o bônus que a mesa calcula) ou ataque da ficha; a sala rola e o chat marca "pelo Claude". **`desfazer`**: lista os lotes do Claude do usuário e desfaz um (pelo número da lista ou pelo id).
- **O texto de "Conectar o Claude"** (`textosDoClaude.ts`) agora é o comando final: `claude mcp add tavola --env TAVOLA_URL=<origem da página> --env TAVOLA_MESA=<id> --env TAVOLA_TOKEN=<token> -- node apps/mcp/dist/tavola-mcp.mjs`, com o token já colado; o trecho do Claude Desktop traz o mesmo e um caminho a completar. Duas linhas explicam o `build` e onde rodar.
- **`docs/MCP.md`**: o passo a passo para o Vilella e para os jogadores, com exemplos de pedidos.

**Decisões (assumido)**
- (assumido) O servidor é **uma conexão por token**, aberta quando o processo sobe; `TAVOLA_URL` é a origem da página (5173 pelo proxy do Vite ou 8787 direto): os dois servem, o proxy repassa o cabeçalho `Authorization` (o E2E usa a porta do Vite).
- (assumido) O compêndio do MCP vem do **arquivo do próprio computador** (o mesmo `magias.json` do mestre), não da mesa: o Claude não pede arquivos à sala (`asset.pedir` é proibido). Ordem: `TAVOLA_COMPENDIO`, `compendio/magias.json` na pasta onde o processo roda, o exemplo do SRD embutido (3 magias, 9 armas, 5 itens). O compêndio **não tem monstros** (o formato não prevê): o NPC se monta por partes. O nome do compêndio aceita o tipo na frente ("magia:Luz") para desfazer empate.
- (assumido) Criar ou editar pelo nome: se já existe item com o **nome exato** (sem acento nem caixa) na lista que a pessoa vê, edita; senão, cria. Nunca por trecho do nome (o trecho vale só para achar um item que já existe, em `ler`, cenas, tokens etc.).
- (assumido) "Objetos" do jogador são os itens da ficha dele (dentro de `fichas`); a ferramenta `objetos` é só do mestre.
- (assumido) O mestre cria **NPC por padrão**; `dono` (nomes de jogadores) cria personagem de jogador. NPC fica na pasta NPCs, personagem na pasta Personagens; o jogador sempre na pasta própria (a sala decide).
- (assumido) Nota nova do mestre nasce visível **só ao mestre**; a do jogador, só a ele e ao mestre; `visivel` escolhe "todos", "mestre" ou nomes. A pasta "Handouts" é criada se faltar (como a tela faz).
- (assumido) O **tamanho da cena** não se muda pelo MCP: nenhuma intenção o faz sem imagem de mapa (60 x 45 m por padrão; o grid muda o número de células). Imagem de mapa, imagem de token e arquivos: nunca pelo MCP.
- (assumido) O MCP **não leva o grupo** para outra cena (`grupo.moverPara`), não dispara eventos, não aperta botões nem usa `handout.mostrar`: são ações ao vivo, "só a pessoa, pela mesa". Também não mexe no combate, nos desenhos, no relógio nem na configuração.
- (assumido) Reação, ciclo, zona e botão aparecem como rascunho (não rodam até publicar), e o texto da resposta lembra isso.
- (assumido) Pedido sem resposta da sala em 2,5 s conta como "feito, sem mudança" (edição sem mudança real não gera evento); por isso o MCP nem manda edição que não muda nada.
- (assumido) Sem configuração válida o processo **sobe do mesmo jeito** e a ferramenta `panorama` diz o que falta ajustar (assim o Claude conta o problema ao usuário em vez de só "falhou ao conectar"). Com token recusado, a lista de ferramentas é só o `panorama`.
- (assumido) Dependências novas: `@modelcontextprotocol/sdk` 1.32.2 (e `zod` 4, que o monorepo já usava) em `apps/mcp`; `esbuild` 0.28.2 como dev do `apps/mcp` (já estava no repositório, vindo do Vite); `@modelcontextprotocol/sdk` como dev do `e2e` (o cliente do teste). Nenhuma outra: o WebSocket é o nativo do Node.
- Nada mudou em `apps/server` nem no esquema do banco (sem migração): o lote só usa a conexão do 12-1.

**O que ficou para depois**
- Mudar o tamanho da cena e o mapa (precisa de uma intenção nova ou de imagem).
- Monstros no compêndio (formato novo) e o compêndio da mesa lido pelo MCP (hoje só o arquivo local).
- Ferramentas de combate, desenhos e do relógio.
- Ler o histórico do chat pelo MCP.
- Um `build` automático junto do `pnpm dev`.

### 12-3 — como ficou (2026-11-13)

**O que foi feito**
- **O MCP mora na sala, por HTTP.** `POST /api/m/<id>/mcp` (Streamable HTTP sem estado): `initialize` (versão de protocolo `2025-11-25`, a do SDK 1.32.2; aceita também as quatro anteriores), `notifications/*` (202), `ping`, `tools/list`, `tools/call` e lotes de JSON-RPC. GET, DELETE e OPTIONS: 405. Sem SDK no Worker: o JSON-RPC é puro (`packages/shared/src/mcp/jsonrpc.ts`).
- **Uma função só para tratar intenção.** O corpo do `webSocketMessage` virou `tratarIntencao(remetente, intencao)` na sala, chamada pelo WebSocket (`ws` = o socket) e pelo HTTP (`ws: null`). Ela tem: o limite de 20 por segundo por token (o mesmo balde), o `claude.desfazer`, o limite do chat (por socket; no HTTP, por token), o limite do botão, `processar` com `{ claude: true }` (proibidos, marca "pelo Claude", rascunho), o diário do Desfazer, a gravação, a difusão (`distribuir`) e a presença. O que depende de um socket (arraste, rascunho de desenho, ping, arquivos, exportação) só roda com `ws`. `desfazerLote` agora devolve o resultado e o WebSocket envia o `claude.desfeito`.
- **A "conexão" do HTTP** (`conexaoDoMcp`): lê o estado da própria sala (`visaoDe(usuario)`, a visão do snapshot, refeita depois de cada pedido), os lotes do diário e manda cada pedido por `tratarIntencao`. A resposta termina na hora com o evento do pedido (como o usuário o vê). `muitas_mensagens`: espera 1,2 s e tenta de novo até 3 vezes (como o MCP em stdio).
- **Código comum.** As ferramentas, os nomes, `fichaPorPartes`, o formato, os erros, o compêndio (a classe `CompendioLocal`, agora sem disco) e o coração do servidor (`chamarFerramenta`, `definicaoDaFerramenta`, `ferramentasDaLista`) saíram de `apps/mcp` para `packages/shared/src/mcp` (entrada `@tabletop/shared/mcp`; os testes foram junto). `apps/mcp` ficou com o transporte stdio (SDK), a conexão WebSocket e a leitura do compêndio do disco.
- **Autenticação do HTTP**: `resolverTokenDoClaude` (hash, conta ativa, mesma vaga, bloqueio por IP, 30 falhas em 15 min); 401 `Não autenticado` com `WWW-Authenticate: Bearer` sem dizer o motivo; 429 com `Retry-After`; sem cabeçalho, 401 sem contar falha. Sem cookie, sem sessão, sem `Set-Cookie`.
- **Proteção do navegador**: a rota não responde preflight e nunca manda `Access-Control-Allow-*`. O Worker já recusava `Origin` de outro site (C3); a rota recusa **qualquer** `Origin` (403), inclusive o da própria mesa.
- **Presença**: cada chamada marca o usuário com "Claude conectado" por 2 minutos (vencimento `claude.http` na agenda: sobrevive à hibernação e um alarme apaga a marca). `ultimo_uso` é gravado a cada chamada (já era, ao resolver o token).
- **A tela** (Preferências → Conectar o Claude): o comando de uma linha com o token já colado e Copiar, o passo a passo de três linhas, "Já tinha conectado esta mesa?" (recolhido, com `claude mcp remove --scope user tavola-<id>`) e "Claude Desktop" (recolhido; o servidor local e o que ele exige). A lista diz "conectado agora" ou "usado há X min" e o resumo do cartão também ("1 token · conectado agora" / "1 token · usado há 3 min"); a lista é relida quando o Claude conecta ou sai.
- **Docs**: `docs/MCP.md` reescrito com o caminho novo primeiro, em 3 passos, e o Desktop depois; `docs/protocolo.md` (a rota e a nota de segurança); `PROJETO.md` 4.12; `docs/ROTEIRO-DE-TESTES.md`, "12-3".

**Decisões (assumido)**
- (assumido) Sem SDK no Worker: o JSON-RPC mínimo é escrito à mão e conferido com o cliente do SDK (`StreamableHTTPClientTransport`) nos E2E. O SDK 1.32.2 fala `2025-11-25`; o servidor devolve a versão pedida se a conhece.
- (assumido) Qualquer `Origin` é recusado na rota MCP (o Claude Code não manda). O que um cliente de navegador (o MCP Inspector no navegador, por exemplo) precisaria não é suportado.
- (assumido) Sem cabeçalho `Authorization` o pedido é 401 e **não** conta como falha do IP (só token errado ou mal formado conta, como no WebSocket).
- (assumido) Corpo de até 512 KB (413); `Content-Type` JSON obrigatório (415).
- (assumido) A presença por HTTP dura 2 minutos; o limite por token (balde de 20 por segundo, rajada de 40) e o limite do chat (10 por segundo, por token no HTTP) valem no HTTP. O balde é o mesmo do WebSocket do mesmo token; fechar o WebSocket do token zera o balde (já era assim).
- (assumido) O compêndio do Claude pelo HTTP é o exemplo do SRD embutido no Worker (3 magias, 9 armas, 5 itens), não o compêndio da mesa: o Claude não pede arquivos à sala.
- (assumido) "Conectado agora" aparece no token usado há menos tempo (a presença é da pessoa, não do token).
- (assumido) O nome do servidor no Claude Code é `tavola-<id da mesa>` (letras, números e hífen); `--scope user` para valer em qualquer pasta.
- (assumido) O Claude Desktop não ganha comando novo: ele não liga a servidor remoto com cabeçalho pelo arquivo de configuração e as pontes (`mcp-remote`) vêm da internet, que o Távola não usa.
- Tamanho: as ferramentas e o JSON-RPC acrescentam cerca de 73 KB minificados ao Worker (5,6 KB deles são o exemplo do SRD); o Worker inteiro fica em cerca de 820 KB minificados. Os 260 KB das línguas do zod já estavam lá.
- Sem migração e sem mudança de esquema: a rota só usa a tabela de tokens e o diário do 12-1 e a agenda da sala.

**O que ficou para depois**
- O compêndio completo da mesa pelo HTTP (hoje só o exemplo do SRD) e monstros no compêndio.
- Streaming (SSE) e notificações do servidor (a lista de ferramentas só muda na próxima `tools/list`).
- Um jeito do Claude Desktop sem o repositório (precisaria de um conector remoto com conta ou de uma ponte empacotada).
- Gerar o token já com o nome do dispositivo.

## M1 — como ficou (2026-11-14)

**O que foi feito**
- **O Claude sobe arquivos.** Ferramenta `arquivos` (a 12ª, para todos): `enviar` dá um link de envio de uso único e o comando `curl -sS -T "<caminho do arquivo>" "<link>"`; `estado`, `listar` e `usar` completam. Usos: mapa da cena, token, retrato da ficha, imagem do handout, som e compêndio; alvo pelo nome (`cena`, `token`, `ficha`, `handout`); no mapa, `quadrados` ou `pxPorQuadrado` ajustam o tamanho da cena. Sem shell, `base64` (até 2 MB).
- **Caixa de entrada na sala.** `PUT /api/m/<id>/claude/envio/<segredo>` grava o arquivo no SQLite da sala (migração 16: `claude_envios` e `claude_envios_pedacos`, linhas de 1 MB, teto de 300 MB, 24 h). Código em `apps/server/src/caixaDeEntrada.ts` e no fim de `sala.ts` ("Os arquivos do Claude (M1)").
- **O navegador do mestre processa.** `apps/web/src/caixaDoClaude.tsx`: ao receber `caixa.pendentes`, baixa de `GET caixa/<id>`, processa pelo mesmo `GerenteDeAssets` do botão de subir (`usarArquivo`, `registrarSom`, `registrarCompendio`), copia para a subpasta da pasta local se ela está liberada e manda `caixa.concluir` (ou `caixa.falhar` com o motivo). O aviso "O Claude enviou N arquivo(s)" (`aviso-caixa-claude`) fica no alto do mapa enquanto processa.
- **A sala aplica como o Claude.** Em `caixa.concluir` a sala monta o uso (`usoDoArquivo`, em `packages/shared/src/envios.ts`) e o passa por `tratarIntencao` com o usuário e o token que pediram e o `loteId` do envio. Resultado: as permissões são as da pessoa, o Desfazer cobre e a difusão é a de sempre.
- **Permissão antes do link.** `negarEnvio` (`enviosUso.ts`) roda `processar` sobre uma cópia do estado com um arquivo de mentira registrado: a resposta é a que a mesa daria ao aplicar.
- Proibidos ao Claude: `caixa.concluir` e `caixa.falhar` (`PROIBIDAS_AO_CLAUDE`). Docs: `docs/protocolo.md` ("O Claude sobe arquivos (M1)"), `PROJETO.md` 4.12, `docs/MCP.md`, `docs/ROTEIRO-DE-TESTES.md` (M1).

**Decisões (assumido)**
- (assumido) Uma ferramenta só (`arquivos`, com as ações `enviar`, `estado`, `listar` e `usar`) em vez de acrescentar `hash` às ferramentas de cenas, fichas e notas: poucas ferramentas e a regra de permissão num lugar só. O brief pedia que as ferramentas existentes aceitassem `hash`; fica para o M2 se o Vilella preferir assim.
- (assumido) Limites: link de 15 min; arquivo na caixa por 24 h; caixa de 300 MB; imagem de token, retrato e handout até 20 MB; mapa até 64 MB; som 20 MB; compêndio 16 MB; base64 até 2 MB; 20 pedidos de envio por minuto e 10 envios abertos por token; a ferramenta e o PUT esperam o navegador até 20 s.
- (assumido) `quadrados` vale para o lado maior da imagem (45 = 45 x 45 numa imagem quadrada); sem `quadrados` nem `pxPorQuadrado` a cena mantém o px que já tem (padrão 70).
- (assumido) Som com `cena` vira a trilha padrão dela (volume 0,6 ou o pedido); sem `cena` só fica registrado. Compêndio: a sala define o compêndio da mesa com o número de magias que o navegador leu.
- (assumido) A cópia na subpasta (`mapas/`, `tokens/`, `retratos/`, `handouts/`, `sons/`) só acontece com a pasta liberada para escrita; o compêndio não é copiado (a pasta vale por cima do que a mesa guarda). **Sem a pasta liberada o arquivo é processado do mesmo jeito** (o cache do navegador é o que a mesa usa): o brief dizia que esperaria; não esperei porque nada depende da pasta.
- (assumido) O corpo do POST do MCP continua em 512 KB, e sobe a 4 MB só quando a chamada cita a ferramenta `arquivos` (base64).
- (assumido) O MCP em stdio (`apps/mcp`) não tem a caixa: a ferramenta responde que precisa do MCP por HTTP.
- (assumido) O arquivo que o Claude manda não cria nada novo, então não há rascunho: o uso é uma edição do que já existe e entra no Desfazer.
- (assumido) Um envio recusado depois de gastar o link queima o envio (o Claude pede outro); a recusa por `Origin` não gasta o link.
- (assumido) Quando a sala recusa o corpo antes de ler (grande demais, sem tamanho), ela o descarta até 128 MB para o proxy do Vite e o curl mostrarem o motivo e não "bad gateway".

**O que ficou para depois**
- M2: as outras ações que faltam ao Claude (levar o grupo, eventos, combate...).
- `hash` nas ferramentas de cenas, fichas, notas e objetos (hoje só em `arquivos.usar`).
- Copiar o compêndio para a pasta e processar vários arquivos de compêndio juntos.
- O link vencido só tem teste de unidade (o E2E não espera 15 minutos).

## M2 — como ficou (2026-11-14)

**O que foi feito**
- Tabela de paridade (`packages/shared/src/mcp/paridade.ts`): cada uma das 125 intenções tem a ferramenta e o campo do MCP que a alcança (107) ou o motivo de ficar de fora (18: 4 proibidas, 9 de transporte, 5 gestos ao vivo). Teste de unidade falha com intenção nova sem entrada ou entrada que aponta para o que não existe.
- Ferramentas novas: `mapa` (névoa, desenhos, textos, paredes, portas, memória), `tokens`, `mesa` (configuração, iluminação, pastas, relógio, compêndio), `som`, `combate` (passos em ordem) e `chat` (narrar, sussurrar, emote, handout, cartões, limpar). Ampliadas: `cenas` (duplicar, levar o grupo, ids dos tokens tirados), `automacoes` (acionar ciclos, eventos, botões), `objetos` (tocha e ajustes), `fichas` (apagar, dado de vida, mochila).
- O Desfazer cobre os desenhos. O texto que o Claude lê ao conectar traz o roteiro de preparar uma sessão.

**Decisões (assumido)**
- Texto no mapa: a mesa não tem forma "texto"; o Claude escreve com uma fonte de traços (sem acento), sem mudar protocolo nem tela.
- Mover token pelo Claude é `token.soltar` (grava); `token.mover` é gesto ao vivo.
- Desenhos e textos do Claude não são rascunho; cenas, fichas, pastas e o resto seguem a regra do 12-1.
- `ponto.acenderInicio/Fim` (segurar a tocha no tempo real) ficou como gesto ao vivo; `compendio.definir` aponta para `mesa` (tirar) e `arquivos` (pôr).
- O jogador só usa `tokens`, `chat`, `combate` (o próprio turno), `rolar` e as de sempre; tocha e ajustes de luz ficam com o mestre.
- Não se desfazem: chat, rolagens, combate, som (trilha e efeito), relógio, configuração e arquivos.

**O que ficou para depois**
- Forma "texto" de verdade nos desenhos (hoje são traços).
- Tocha do jogador pelo Claude do jogador.

## Q1 — como ficou (2026-11-16)

**O que foi feito**
- "Abrir ficha" no clique direito do token, no topo do menu, para quem vê a ficha do personagem do token (mestre, e o jogador no próprio token).
- Preferências → Claude: saiu a lista "O que o Claude fez" com os botões Desfazer. Ficam o selo "Rascunhos do Claude (N)" no topo e o fluxo dos rascunhos. A intenção `claude.desfazer` segue existindo para o MCP; a tabela de paridade não mudou.
- Aba Mesa → Importar: saiu o bloco "Campanhas de exemplo". Fica só "Escolher arquivo…". `campanhasDeExemplo.ts` e seu teste saíram; os arquivos de `fixtures/campanhas/` ficam só como fixture de teste (a Chama Primordial inclusive). A mesa nova já nascia no padrão 5e; agora um teste de unidade garante (modelos de luz, regras, pastas e nenhuma automação iguais ao arquivo "5e padrão").
- Preferências → Transferências: o nome do arquivo numa linha só, com reticências (nome inteiro no `title`), e o status abaixo.
- Cópia dos arquivos da mesa na pasta (o ponto principal). Só o mestre, com a pasta liberada para escrita: cada arquivo que entra no cache do navegador (mapa e tiles, token, retrato, handout, som, compêndio, arquivos do Claude, o que um jogador subiu) ganha uma cópia em `arquivos-da-mesa/<hash>` na pasta da mesa. Ao abrir a mesa, ao escolher ou reautorizar a pasta e quando chegam arquivos novos, o navegador traz da pasta o que a mesa usa e ele não tem (conferindo o hash de cada um) e leva para a pasta o que só o cache tem.
- Aviso da pasta, visível na mesa (e na aba Compêndio, no lugar de "ninguém com o arquivo está online"), só para o mestre: "Reautorizar a pasta da mesa" (a permissão caiu), "Escolher a pasta da mesa" (este navegador não tem a pasta e há arquivos que ninguém online manda) e "Trocar a pasta da mesa" (a pasta escolhida não tem o que falta).
- Entrar como mestre pela chave da pasta agora lembra essa pasta como a pasta da mesa neste navegador.
- `docs/ARQUIVOS.md`: como os arquivos da mesa funcionam, em linguagem simples.

**O que o segundo navegador de mestre via (cenário do Vilella, reproduzido no E2E)**
- Antes: nada. Sem mapa, sem tokens com imagem; a aba Compêndio dizia "O compêndio existe, mas ninguém com o arquivo está online"; em Transferências os arquivos ficavam "indisponível (ninguém com o arquivo está online)". Nenhum aviso na mesa, nenhum botão.
- Agora: o aviso "Os arquivos desta mesa ficam numa pasta do seu computador. Escolha a pasta da mesa neste navegador." com o botão; a aba Compêndio diz o mesmo; escolhida a mesma pasta, o mapa, o token e o compêndio carregam dela, sem o primeiro navegador online.

**Decisões (assumido)**
- O compêndio e os arquivos do Claude já iam para o cache do navegador (`registrarCompendio`, `usarArquivo`); a hipótese de que não iam não se confirmou. O que faltava era o outro navegador (ou um cache limpo): sem a pasta com os arquivos, nada os traz de volta. Por isso a cópia na pasta.
- A cópia fica em `arquivos-da-mesa/` com o hash por nome, sem pasta por tipo: um arquivo, uma cópia, conferida pelo hash. Essa pasta não entra na biblioteca de imagens nem de sons.
- Pasta "cifrada" (chave da pasta, C3): a cópia é independente da chave; o que a chave ganha é que o login pela pasta passa a lembrá-la como a pasta da mesa. No E2E a pasta da chave é simulada, então esse "lembrar" só foi conferido por leitura do código.
- O aviso de "escolher" só aparece se há arquivo que ninguém online manda: o mestre que nunca usou pasta e tem tudo no cache não vê nada.
- Jogadores não copiam nada para a pasta (a pasta é do mestre).
- "Abrir ficha" vale também para o jogador no próprio token. O menu só abre para quem controla o token, e a sala só manda ao jogador as fichas que ele pode ver.

**O que ficou para depois**
- Jogadores com pasta própria para guardar o que recebem (hoje o cache basta).
- Apagar da pasta as cópias de arquivos que a mesa não usa mais.

## Q2 — como ficou (2026-11-16)

**O que foi feito**
- A aba Compêndio por seções: Magias, Monstros (só o mestre, como antes), Itens mágicos, Armas e Itens, mais "Todas" para a busca por nome. O seletor só aparece quando há duas ou mais seções com entradas.
- Blocos recolhíveis em cada seção, no desenho da sanfona das Preferências (título com a contagem, seta, `aria-expanded`): magias por nível (Truques, 1º ao 9º nível), monstros por ND (0, 1/8, 1/4, 1/2, 1 ... 30), itens mágicos por raridade (comum ... artefato, varia) e armas em simples e marciais, corpo a corpo e à distância. Alfabético (sem acento nem caixa) dentro de cada bloco. Itens (equipamento) é uma lista só, alfabética: o dado não tem categoria.
- Só os blocos abertos desenham as linhas; a lista de ~1.100 entradas abre só com os cabeçalhos.
- Filtros: classe e escola (e nível, concentração, ritual) nas magias; tipo, tamanho e ND de/até nos monstros; tipo, raridade e sintonização (novo) nos itens mágicos. Filtro que não vale para a seção escolhida some. "Limpar filtros" onde já havia.
- Busca em "Todas": o resultado vem agrupado por seção (um bloco por seção com resultado) e, dentro, pelos blocos da seção. Acha pelo `nome` e pelo `nomeOriginal`, sem acento e sem caixa ("fireball" acha "Bola de Fogo"). O nome em inglês aparece pequeno e em itálico ao lado do nome. O jogador nunca vê monstro, nem na busca.
- Numa seção sem resultado, mas com resultado em outra, a aba oferece "Buscar em todas as seções".
- `packages/shared/src/compendioSecoes.ts` (funções puras: agrupar por nível, ND, raridade e categoria; `casaComABusca`; `buscarEmTodas`; `buscarArmas`/`buscarItens`) e `buscarItensMagicos` com `sintonizacao`.
- Extrator: `--nomes <arquivo>` (ou `nomes-originais.json` na pasta de saída) preenche o `nomeOriginal`. `extrator/nomes.ts`, com teste de nomes inventados. A tabela nunca entra no repositório.
- MCP: a ferramenta `compendio` já buscava pelo `nomeOriginal`, sem acento (`mcp/compendio.ts`); nada a mudar.

**Decisões (assumido)**
- A seção que abre é Magias (como antes); "Todas" é uma escolha do seletor, não o padrão. O texto da busca vale na seção escolhida; para buscar em tudo, "Todas" (ou o aviso "Buscar em todas as seções").
- Blocos fechados por padrão quando a seção tem mais de 24 entradas; com 24 ou menos (o exemplo do SRD, um arquivo curto) abrem todos. Com busca ou filtro, abrem os que têm resultado, e o que se fecha nessa hora vale só até a busca mudar.
- O que a pessoa abre ou fecha fica em `tabletop:pref:compendio-blocos` (localStorage, só deste navegador, nada vai para a sala). Chave: `<seção>:<bloco>` (por exemplo `magias:3`); em "Todas", `todas:<seção>`.
- Em "Todas" só a busca por nome vale (os filtros por seção ficam na seção). "Adicionar" usa a ficha em foco, a mesma regra do "Ficha de".
- A ordem na lista de magias mudou de propósito: antes era alfabética no geral, agora é por nível e depois alfabética.

**O que ficou para depois**
- Lista virtual (não precisou: só os blocos abertos desenham; um bloco aberto com ~100 linhas é rápido).
- Categoria nos Itens do equipamento (o dado não tem).

## Q4 — como ficou (2026-11-16)

**O que foi feito**
- A mesa de som no lugar do painel de Som do N5: 8 efeitos de um toque e 8 ambientes em laço. O desenho foi aprovado pelo Vilella ("Gostei muito da mesa de som, muito mesmo") e segue os três quadros: `SomUso` (janela), `SomDoca` (faixa) e `SomConfig` (configuração).
- Efeitos: grade 4×2 de botões grandes (ícone num círculo, nome de até 12 letras). Um toque toca uma vez, até o fim, para todos. O que toca mostra a barra de progresso e um "parar" no canto; tocar de novo recomeça.
- Ambientes: 8 linhas com interruptor, ícone, nome e volume próprio. Ligam e desligam sozinhos, vários ao mesmo tempo, em laço, com entrada e saída suaves de 1,5 s. Cada um começa no ponto certo pelo relógio da sala (quem entra no meio ouve do ponto em que o ambiente está).
- No pé: volume geral (vale para efeitos, ambientes e o som das automações, para todos) e "Parar tudo". Lugar vazio mostra "+ adicionar" e abre a configuração.
- Janela ou faixa: a janela flutuante é o padrão; o botão da janela a encaixa como faixa no pé da área do mapa (efeitos à esquerda, ambientes em 2 colunas), e a faixa tem o botão de soltar em janela e o de recolher. A escolha e o recolhimento ficam por pessoa em `tabletop:pref:som-modo` e `tabletop:pref:som-faixa-recolhida` (nada vai para a sala).
- Configuração (engrenagem da janela e da faixa, ou o "adicionar" de um lugar vazio): os 16 lugares à esquerda; à direita o lugar escolhido, com o arquivo (os sons já na mesa e "Escolher arquivo…" da pasta `sons/`), o nome do botão (12 letras), 12 ícones (lucide-react: chama, vento, espadas, porta, sino, gota, caveira, trovão, passos, multidão, música e criatura), 6 cores de etiqueta, o volume padrão, "Ouvir" (só neste navegador), "Tirar deste lugar" e "Apagar este som da mesa" (a confirmação aparece na própria janela e diz onde o som estava).
- "Apagar este som da mesa" é a intenção nova `som.apagar`: tira o asset da mesa e de todos os lugares, zonas e automações que o usam (a reação que só tocava aquele som sai junto) e para o que tocava com ele. O arquivo continua na pasta `sons/` do computador.
- Os ambientes da cena substituem a trilha da cena: no painel, "Usar os que tocam" grava os que tocam agora na cena (`Cena.ambientes`); ao levar o grupo, ligam os marcados e desligam os outros (os que já tocam seguem sem recomeçar). Cena sem a lista não mexe em nada; lista vazia é silêncio.
- A ferramenta `som` do MCP passou a configurar os lugares (arquivo, nome, ícone, cor, volume), tocar efeito pelo nome ou pelo lugar, ligar e desligar ambientes com volume, volume geral, parar tudo, apagar som e ambientes da cena.
- Extra: o `envio-m1.spec.ts` "envio com a mesa do mestre fechada" não falha mais na primeira tentativa: o teste espera a presença do mestre cair (vista por um jogador) antes de enviar.

**Decisões (assumido)**
- Os dados: `Estado.mesaDeSom` (os lugares; só o mestre recebe; vai na exportação) e `Estado.somLigado` (ambientes ligados e volume geral; todos recebem só hash e volume; não vai na exportação, é da sessão). `Estado.trilha` e `Cena.trilha` ficaram só para ler o que já existia.
- A conversão do N5 é feita ao ler (`migrarSomDoN5`), no banco e em arquivos exportados: a trilha que tocava vira um ambiente ligado (no mesmo ponto), e a trilha de cada cena vira um ambiente da cena. Cada arquivo ganha um lugar de ambiente (ícone de música, etiqueta âmbar, nome do arquivo cortado em 12 letras); se os 8 lugares estão cheios, a trilha antiga é descartada. No banco a conversão é gravada na primeira leitura e a chave `trilha` some.
- O volume do efeito sai da sala já multiplicado pelo volume geral da mesa de som; o dos ambientes o navegador multiplica (para o geral valer na hora, sem recomeçar nada).
- Trocar o arquivo de um ambiente que toca, ou esvaziá-lo, desliga o ambiente. Só renomear não.
- Mexer no volume de um ambiente desligado muda o volume padrão do lugar; ligado, muda só o volume dele agora.
- O envio de um som (Claude, M1) agora só põe o som na mesa; ele ganha um lugar pela configuração ou pela ferramenta `som`. Antes virava a trilha da cena.
- A ação `som.tocar` das automações continua tocando por arquivo (não escolhe o lugar da mesa de som); o volume geral vale para ela.
- "Ouvir as zonas do token selecionado" foi para a configuração (antes ficava no painel de Som).
- Tokens de tema novos `etiquetaAzul` e `etiquetaVermelho` (as outras quatro cores da etiqueta usam tokens que já existiam: acento, perigo, sucesso e texto suave), com contraste conferido em `temas.test.ts`.
- No cartão Som das Preferências, "Trilha" virou "Ambientes" (a chave `trilha` das preferências não mudou, para não perder o ajuste de quem já mexeu).

**O que ficou para depois**
- Escolher o lugar da mesa de som na ação `som.tocar` das automações.
- Baixar antes, no jogador, os arquivos dos efeitos (hoje o jogador só os baixa no primeiro toque; o primeiro toque pode não soar se o arquivo ainda não chegou, como no N5).
- Ambientes da cena na faixa (só a janela tem o "Usar os que tocam").
- Ordenar ou arrastar os lugares.

## Q5 — como ficou (2026-11-16)

O Vilella aprovou o desenho (Fita como padrão, Moldura como opção em Preferências). Código em `apps/web/src/rolagem/`; CSS em `rolagem/rolagem.css`. Só visual: sem mudança de protocolo, de banco ou da tabela de paridade.

**O que foi feito**
- `CartaoNoChat` (um componente, dois estilos só no CSS, `data-estilo`): fita (ou título em versalete), régua, corpo com uma ou duas metades, rodapé, balão. Fita: cantos chanfrados e fita com corte em V; Moldura: linha dupla com cantoneiras, régua com losango e divisória com losango.
- Cores só de tokens do tema. Dano: o número no `--texto` e o ícone no `--acento-forte` (nunca vermelho nem laranja). Crítico: `--critico` (verde fixo) na fita e na moldura e, no número, o verde misturado 72% com o `--texto` do tema (para o contraste de texto grande valer também nos temas claros; teste em `rolagem/contraste.test.ts`). Falha crítica (1 natural): fita e número num cinza apagado (`--texto-suave`).
- Balão (`role="tooltip"`): monta só aberto; abre com o mouse parado 350 ms, no mesmo instante com o foco, toque abre e fecha, Esc fecha; abre para cima, ou para baixo se o cartão está colado no topo da lista; não empurra o chat.
- Vantagem e desvantagem: `totaisDaVantagem` calcula os dois totais da própria rolagem (d20 e bônus), sem mudar o protocolo.
- Preferência `tabletop:pref:estiloDasRolagens` (`rolagem/estilo.ts`, `useSyncExternalStore`: muda ao vivo, sem frame para a sala). Seletor com prévia em Preferências → Aparência.
- Cartões seguidos (mesmo autor, personagem, "pelo Claude" e sigilo, até 3 min) dividem o cabeçalho (`rolagem/agrupar.ts`); o cabeçalho continua no DOM, escondido visualmente.

**Inventário: como cada mensagem ficou (Fita e Moldura iguais no conteúdo; só o visual muda)**
- Teste de atributo, perícia, salvaguarda, iniciativa (`modelo: teste`): nome na fita, número grande; com CD, "CD n" embaixo e "Sucesso"/"Falha" na fita; 20/1 natural na fita; d20 no balão.
- Ataque (`modelo: ataque`): fita com o nome (mais "nível 5", "3º espaço", "Crítico", "1 natural"); acerto | dano, do mesmo tamanho; dano com o ícone; acerto, dano, fórmula (com tipo e "(nível n)") e dados no balão. Com dano extra de espaço: o dano grande é o total (principal + extra) e o detalhe vai no balão.
- Magia de salvaguarda: com acerto (`ataque` com `salvaguarda`): CD do atributo | dano, "metade n" embaixo do dano; o acerto vai no balão. Só dano (chega como `/r` com comentário "Nome, CD 14, tipo"): o comentário é lido por `lerRotuloDeDano` e vira o mesmo cartão CD | dano (assumido: não há dado no protocolo, então lê-se o texto que a ficha escreve).
- Cura / dado de vida (`modelo: vida`): total grande e "+n PV (a/b)" embaixo.
- Dardos e raios por nível (N2): o número é a soma; cada dardo e o total ficam no balão. Truque por nível: "nível 5" na fita. Ritual, inata, "com espaço de nº": linha pequena embaixo (`espaco-usado`).
- Característica e magia (cartões próprios): sem mudança.
- `/r` livre: fita com o comentário (ou a expressão), número grande; vantagem escrita (`2d20kh1`) divide em dois totais; vários dados somam num total, cada um no balão; mais de uma rolagem na mensagem (antigas) vira uma metade por rolagem.
- `[[...]]` dentro de frase: continua o total pequeno com os dados no hover (não é cartão).
- Rolagem oculta: linha pequena em itálico com o ícone e "Rolagem oculta · nome: total", sem caixa; os dados no balão. Sussurro: só texto, sem mudança.
- Marca "pelo Claude": no cabeçalho, como antes. Avisos de automação: sem rolagem, sem mudança.

**Ícones por tipo de dano (lucide-react)**: ácido FlaskConical, contundente Hammer, cortante Sword, elétrico Zap, energia (a "Força" da ficha) Sparkles, fogo Flame, frio Snowflake, necrótico Skull, perfurante Pickaxe, psíquico Brain, radiante Sun, trovejante Volume2, veneno Biohazard; cura Heart.

**Decisões (assumido)**
- Fontes do desenho: IM Fell English SC na Fita e Cormorant SC + Cinzel na Moldura (já empacotadas pelo `ficha.css`), em vez de Inter e Space Grotesk, por serem a especificação visual aprovada.
- A fita metade `--borda`, metade `--cabecalho` (o texto sobre `--borda` não dava 4,5:1 no tema Licantropo).
- O texto "Ataque · " saiu da frente do nome; o espaço de magia com dado a mais mostra "3º espaço" na fita.
- Os testes que liam as fórmulas e os dados agora passam o mouse no cartão antes (o balão só existe aberto).

**O que ficou para depois**
- Balão por toque em tela sensível não foi testado em aparelho (só pelo código).


### Q5b — o balão por metade (2026-11-16)
Pedido do Vilella: "se passo o mouse por cima do acerto, mostra os dados do acerto; se passo em cima do dano, mostra o do dano". Só visual (`rolagem/CartaoNoChat.tsx`, `CorpoDaRolagem.tsx`, `rolagem.css`); sem protocolo nem banco.
- Cartões divididos (ataque: acerto | dano; magia de salvaguarda: CD | dano; `/r` com várias rolagens): cada metade tem o seu balão, `data-testid="rolagem-metade"` (com `data-metade` = "acerto", "dano"...). O cartão em si deixa de ser focável; cada metade é (Tab), com `aria-label` e `aria-describedby` quando aberto.
- Acerto: os d20, o descartado riscado, o bônus. Dano: os dados, a fórmula com o tipo (e "(nível 5)", "metade"), o bloco do espaço (dado a mais) e os dardos. Nada saiu do balão: o que não é de nenhuma metade foi para a do dano.
- Passar de uma metade para a outra troca o balão sem esperar os 350 ms de novo (folga de 90 ms na saída); sair do cartão fecha. Esc fecha. Toque: tocar numa metade abre a dela; tocar na mesma fecha.
- O balão fica alinhado à metade (esquerda no acerto, direita no dano), largura mínima de meia coluna e nunca maior que o cartão (`data-metade` do balão: primeira, ultima, todo).
- Cartões de uma metade só (teste, vida, `/r` simples, dardos): como antes, o cartão todo abre o balão.
- A rolagem oculta (linha pequena) mostra os balões todos juntos, como antes.
- Decisões (assumido): com salvaguarda a metade da CD não tem dado; o balão dela mostra o acerto, que saiu da frente. No `/r` de dano com CD, a metade da CD não tem balão nem foco (não há dado nela). Nos `/r` com várias rolagens, o dado a mais do espaço vai no balão da última.
- Testes: `q5.spec` (acerto só d20, dano só dano, troca sem espera, teclado) e os specs que passavam o mouse no cartão agora passam na metade certa (`chat`, `ficha-livro`, `ficha-n2`, `ficha-npc`).

## Q3 — como ficou (2026-11-16)

**O que foi feito**
- Importar mapas do Dungeondraft (Universal VTT: `.dd2vtt`, `.uvtt`, `.df2vtt`). No painel de cenas, o card "Importar mapa — Dungeondraft / Universal VTT…" (só o mestre; o jogador não tem a faixa). Escolher o arquivo, ou arrastá-lo para qualquer lugar da mesa, cria **uma cena nova** com o nome do arquivo (sem a extensão).
- A imagem entra como mapa **pelo mesmo caminho do botão de subir** (`GerenteDeAssets.usarArquivo`: WebP, tiles, cifra, cópia em `arquivos-da-mesa/`), mais a cópia em `mapas/` da pasta da mesa. A grade bate: `pxPorQuadrado` = `pixels_per_grid`, a cena com o tamanho da imagem (quadrado de 1,5 m).
- Paredes (`line_of_sight` e `objects_line_of_sight`: um segmento por par de pontos), portas (`portals`, fechadas ou abertas como no arquivo) e luzes (`lights`) viram paredes, portas e fontes de luz fixas da Távola. A origem do mapa (`map_origin`) é descontada.
- Um aviso no alto da mesa: "Cena criada: 1 mapa, 142 paredes, 6 portas, 9 luzes." e o que foi ignorado ou cortado. Fica até a pessoa dispensar.
- A leitura (JSON de dezenas de MB, base64) e a decodificação da imagem rodam no **worker** do processador (`assets/processador.worker.ts`, pedido `uvtt`), fora da thread da página. Medida: decodificar 24 MB de imagem em base64 leva ~170 ms (teste de unidade, com a montagem do arquivo inclusa).
- Intenção nova `cena.importarMapa` (`cena.editar`): cria a cena inteira (cena com mapa, paredes, portas, fontes de luz e luz ambiente) **num pedido só**, em vez de centenas de mensagens, e é um passo só do Desfazer.
- Claude: `arquivos.enviar` ganhou o uso `dungeondraft` (também `uvtt` e `mapa universal vtt`; no código `mapa-uvtt`). O arquivo passa pela caixa da M1; o navegador do mestre o lê pelo mesmo importador e manda a cena pronta na conclusão (`caixa.concluir.importacao`); a sala a cria **como o Claude**, no lote dele (o `desfazer` apaga a cena criada). O resultado volta no curl: "Pronto: cripta.dd2vtt (mapa Universal VTT (Dungeondraft)). Cena criada: ...".

**Decisões (assumido)**
- Nome da cena = nome do arquivo sem extensão, até 64 letras.
- Quadrado = 1,5 m (como toda cena nova). A cena é criada e o grupo não se mexe (não leva o grupo para ela).
- Luz: alcance em metros = quadrados × 1,5, metade em luz plena e metade em penumbra; cor = ARGB do arquivo sem o alfa; intensidade do arquivo limitada a 0–1; não tremula; nome "Luz n". Luz sem alcance fica na cena sem iluminar (com aviso).
- Luz ambiente: `baked_lighting` (ou falta de `ambient_light`) = dia (1, o padrão da cena, sem o campo); sem luz cozida vale o brilho da cor de `ambient_light`.
- `objects_line_of_sight` vira parede comum (bloqueia visão como as demais). O trecho de parede que fica inteiro sobre uma porta é ignorado (a porta o substitui; evita porta sob parede), com aviso.
- Segmentos repetidos (mesmos pontos, em qualquer sentido) entram uma vez.
- Limites: 3000 paredes e portas juntas por cena (portas primeiro), 200 luzes, arquivo de até 64 MB (o teto do mapa). O que passa não entra e o aviso diz quantos. 3000 paredes ocupam uns 400 KB de um frame (o limite do WebSocket é 1 MiB). A grade do arquivo fora de 10 a 1000 px por quadrado é recusada. Mapa com mais de 1000 m de lado (limite da cena) é recusado com o motivo.
- O que o jogador recebe: nada da cena enquanto o grupo não está nela (a sala só manda ao jogador a cena ativa; teste dos frames no E2E). Paredes e portas importadas valem para visão e passagem como as desenhadas à mão.
- Sem migração de banco e sem campo novo no estado: a cena sai com os campos que já existiam.
- Arquivo sem `image` (ou com imagem que não é png, jpg, webp nem gif): não cria cena e o aviso diz por quê.

**O que ficou para depois**
- Portas "freestanding", a cor do `ambient_light` como tom da cena e as sombras (`shadows`) das luzes.
- Importar vários arquivos de uma vez.

## Q6 — como ficou (2026-11-16): a busca do compêndio e a mesa de som (Q2b + Q4b)

Dois pedidos do Vilella num lote só. Q2b: a busca do compêndio e o espaço da aba. Q4b: a mesa de som em janela própria, a altura da faixa, a configuração por cima e o transporte Tocar/Parar.

**O que foi feito**
- **Busca (Q2b)**: `packages/shared/src/buscaDoCompendio.ts`, uma função pura usada pelas seções, pelo "Todas" e pela ferramenta `compendio` do MCP (`buscarMagias`, `buscarMonstros`, `buscarItensMagicos`, `buscarArmas`, `buscarItens`, `buscarEmTodas`). Normaliza (minúsculas, sem acento, sem pontuação). Cada palavra da consulta precisa casar com uma palavra do `nome` ou do `nomeOriginal`, em qualquer ordem. Casa por palavra inteira, começo de palavra, pedaço dentro da palavra (3 letras ou mais) e erro de digitação (distância de edição). Palavras de ligação (de, da, do, of, the...) da consulta não pesam. Com busca, cada bloco sai por relevância (inteira, começo, dentro, semelhante); sem busca, alfabético. As entradas são normalizadas uma vez (`WeakMap`), então cada tecla responde em poucos ms com ~1.100 entradas.
- Placeholder "Buscar…". Espaço entre a lista, os botões e os "Créditos" (`.barra-do-mestre` e `.creditos-do-compendio`).
- **Transporte (Q4b)**: `SomLigado.tocando?` (aditivo). Os interruptores dos ambientes só **marcam** (e dão o volume de cada um); o botão **Tocar / Parar** do pé da mesa de som (`som.transporte`) toca ou cala os marcados. Parar também corta os efeitos. Os efeitos seguem de um toque, com o transporte parado ou tocando. "Tocar" sem ambiente marcado mostra "Ligue um ou mais ambientes" (a sala recusa a intenção com `dados_invalidos`). Ao tocar, os marcados começam juntos, do mesmo instante. O "Parar tudo" saiu da tela (virou o "Parar"); a intenção `som.pararTudo` e a opção `pararTudo` do MCP continuam (desmarcam tudo e param).
- **Janela própria (Q4b)**: rota `/m/<id>/som` (`SomEmJanelaPropria`), pelo mesmo caminho da ficha (V9): conexão própria sem presença a mais, o mesmo lock e canal de `ficha/foraDaMesa.ts` com o id `mesa-de-som`, medida da janela lembrada. A mesa tira o painel da tela enquanto a janela existe e o devolve ao fechar; o botão do Som, com a janela aberta, a traz para a frente. O som continua saindo da aba da mesa; a janela é só o controle. O "Ouvir" da configuração toca só na janela.
- **Altura da faixa (Q4b)**: alça na borda de cima (`role="separator"`; setas, Shift, Home e End) e arrastar. Acima da altura natural (252 px) a faixa fica natural; abaixo, o corpo encolhe junto com `zoom` (escala 0,7 a 1) e só rola abaixo do mínimo sem rolagem (195 px). Layout igual (efeitos à esquerda, ambientes à direita). `tabletop:pref:som-faixa-altura`.
- **Configuração por cima (Q4b)**: a janela de configuração usa a camada alta (`camadaAlta`, 45+), acima da faixa (30) e da janela do som (25+).
- **Mesa vazia (Q4b)**: "Nenhum som na mesa de som ainda" e o botão "Configurar" na janela e na faixa; o transporte fica desabilitado. A configuração mostra "Sons que a mesa já tem" (os assets de som registrados antes), para pôr num lugar com um clique.

**Decisões (assumido)**
- Tolerância de erro: 1 em palavras de 4 a 7 letras, 2 em 8 ou mais, nenhuma em palavras curtas. Letras vizinhas trocadas contam como um erro.
- O estado antigo (sem `tocando`) carrega como "tocando" se havia ambiente marcado. Estado novo começa parado.
- Levar o grupo a uma cena que tem ambientes põe o transporte para tocar (a cena existe para isso); cena sem ambientes deixa o transporte como está.
- Desmarcar o último ambiente com o transporte tocando não para o transporte (o botão segue "Parar").
- O jogador recebe os ambientes marcados mesmo com o transporte parado (só o hash do som); o navegador decide o que toca (`tocando` falso: nada). Sem filtro extra na sala.
- Pelo MCP, `ambientes` marca e `transporte: "tocar"` toca (o resultado avisa quando o transporte está parado).
- A janela própria não mostra a barra de progresso dos efeitos (o som sai na aba da mesa).
- Escala mínima da faixa 0,7 (texto de 13 px vira uns 9 px); abaixo disso rola.

**O que ficou para depois**
- Imagens e tokens para cada monstro e item do compêndio (`docs/IDEIAS.md`).
- A janela própria do som não mostra os efeitos que tocam na aba da mesa.

## Q9 — como ficou (2026-11-16): a Conjuração do NPC com a interface das magias do personagem

O Vilella pediu que a ficha de NPC tenha o menu de conjuração organizado como o do personagem, aproveitando a mesma interface.

**O que foi feito**
- Novo `apps/web/src/ficha/CirculoDeMagias.tsx`: `CirculoDeMagias` (um círculo com espaços totais e restantes, bolinhas, linhas, campo de nova magia e soltar do compêndio), `LinhaDeMagia`, `TotalDeEspacos`, `Espacos`, `subDaMagia` e `BotaoNovoCirculo`, tirados da `AbaMagias.tsx` sem mudar o que o personagem mostra. A `AbaMagias.tsx` reexporta `Espacos` e `subDaMagia`.
- Parâmetro `variante: "personagem" | "npc"`. Ela escolhe os `data-testid` (cada ficha guarda os seus: `magia-*` e `npc-conj-*`), esconde o "Prep." no NPC, abre o editor da engrenagem embaixo da linha no NPC (no personagem fica na outra coluna) e mostra o texto simples da magia sem cartão (no personagem são os campos editáveis).
- `ConjuracaoDoNpc.tsx` perdeu os chips e o corpo próprio: a seção é o cabeçalho (atributo, CD e ataque pelo ND), "Recuperar espaços", os círculos, a conjuração inata (`ParteInata`, igual à do personagem) e o "+ Círculo".

**Decisões (assumido)**
- "Prep." some no NPC.
- O título do círculo 0 continua "Truques (à vontade)" no NPC e "Truques" no personagem.
- Quem só vê o NPC não vê o campo de espaços totais (vê "Restantes" e as bolinhas); o personagem mostra o campo travado, como antes.
- "+ Círculo" é o botão do personagem (próximo círculo escondido), no lugar do seletor de círculo que existia.
- O soltar do compêndio passou a ser por círculo (só o círculo da magia acende), como no personagem, em vez de a seção inteira.
- Cada linha abre e fecha sozinha (antes, uma só aberta por seção).
- Specs antigos alterados de propósito: `ficha-v4b2` (texto "Truques (à vontade)" sem o dois-pontos; o ícone de chat da linha aberta agora existe; "+ Círculo" é botão, clicado duas vezes para chegar ao 2º; a ordem lê o nome da linha em `npc-conj-nome-`).

**O que ficou para depois**
- A conjuração inata mantém o visual de chips (é o mesmo componente nas duas fichas).

## Q7 — como ficou (2026-11-16): o painel de cenas em grade, a faixa que sobra, barras do tema e a descrição aberta

**O que foi feito**
- **Painel de cenas em grade (Q7)**: os cards têm todos o mesmo tamanho (122 px de altura, colunas iguais que preenchem a largura do painel), a miniatura preenche o card com recorte centralizado (`object-fit: cover`), o nome longo corta com reticências e aparece inteiro na dica (`title`). O painel cresce para baixo: até 3 linhas visíveis e, da quarta em diante, rolagem vertical dentro do painel (`.faixa-lista`, `max-height` de 3 linhas). Sem rolagem horizontal. "Nova cena" e "Importar mapa" seguem no fim da grade.
- **Buscar cena**: campo "Buscar cena…" no alto (`cenas-busca`). Filtra pelo nome com a mesma busca do compêndio (`pontuarBusca`/`prepararConsulta`, sem mexer neles), em `apps/web/src/filtroDeCenas.ts`. O número do card é o da ordem real. Sem resultado: "Nenhuma cena com esse nome". Esc limpa a busca; Esc de novo fecha o painel.
- **Botão direito no vazio**: abre o menu de contexto do painel com "Nova cena" e "Importar mapa — Dungeondraft / Universal VTT…" (mesmo menu dos cards, `menu-cena`). Pelo teclado: tecla de menu ou Shift+F10 com o foco na grade (no card abre o menu da cena, que antes não tinha caminho pelo teclado).
- **Fechar ao clicar fora**: um `pointerdown` fora do painel fecha. Não fecha com o botão da barra de cima (que alterna), com menus (`role="menu"`), com diálogos (`role="dialog"`, `alertdialog`, `.fundo-modal`) nem enquanto o diálogo de apagar ou de configurar a cena está aberto.
- **Barras de rolagem do tema**: dois tokens novos nos 14 temas, `rolagemPolegar` e `rolagemTrilho`, derivados em `temas.ts` (`comRolagem`): polegar = texto suave misturado ao painel (55%), trilho = cor dos campos. `styles.css` aplica `scrollbar-color` e `::-webkit-scrollbar*` em `*`, para todo o app. A regra fixa do `.inicio-painel-corpo` saiu. Teste novo em `temas.test.ts` (polegar contra o trilho 2:1 e contra o painel 1,5:1 em todos os temas).
- **Descrição aberta no chat**: `CartaoDaMagiaNoChat` e `CartaoDaCaracteristicaNoChat` começam abertos (`useState(true)`); esconder é só do navegador (sem frame). Mensagens antigas também abrem.
- **A faixa da cena anterior**: ver "Decisões".

**Decisões (assumido)**
- **A faixa do mapa anterior não foi reproduzida** (duas cenas com mapa de tiles de verdade, Covil sem mapa, trocando pelo card e por "Levar grupo" com o painel aberto, em vários tamanhos e velocidades; nenhum erro no console; o gancho `imagens()` sempre mostrou só os pedaços da cena nova). Corrigi o que o código tinha de errado e podia produzir isso: (1) os sprites do mapa eram guardados por *arquivo* (`hash`), então dois pedaços iguais (chão liso, comum em mapa do Dungeondraft) dividiam um sprite só e um pedaço saía do lugar; agora é um sprite por *lugar* (`hash@x,y`); (2) ao trocar de cena todos os sprites do mapa saem do palco antes de os da nova entrarem (`limparMapa`), sem depender da comparação por `hash`. Se a tira voltar, o próximo passo é pegar um mapa real do dono (o da taverna importada).
- Esc no campo de busca fecha o painel só quando a busca já está vazia.
- Arrastar para reordenar não existe no painel (a ordem é a das cenas); nada a preservar.
- Trocar de cena pelo card não fecha o painel.
- O polegar da barra é derivado em vez de escrito nos 14 temas (um lugar só; o teste vale para todos).

**O que ficou para depois**
- Reordenar cenas por arrastar (ideia, não pedida).

## Q8 — como ficou (2026-11-16): o token do jogador em cada cena, as Automações na barra e a aba Mesa organizada

Três pedidos do Vilella num lote só: o jogador põe o token dele em qualquer cena (sempre na bandeira), as Automações ganham um botão na barra de cima e a aba Mesa fica no desenho da aba Preferências.

**O que foi feito**
- **Um token do personagem por cena.** `personagem.colocar` (mestre) só recusa o personagem de jogador que já tem token **na cena pedida**; ter token em outra cena não importa. `token.colocarMeu` já contava só a cena (V10b). Cada cena pode ter um token do personagem para o jogador; o mestre segue sem limite em `token.colocarMeu`.
- **O jogador vai sempre para a bandeira.** Em `token.colocarMeu` o ponto que o jogador manda (soltar a ficha no mapa) é ignorado: a sala arruma o token no grid ao lado dos que já estão na bandeira (`arrumarNoGrid`). Sumiu o erro "Ponha o token perto da bandeira". Só o mestre escolhe o ponto (x e y).
- **Levar o grupo** (`grupo.moverPara`): o personagem que já tem token na cena de destino fica com o de lá, intocado; o da origem fica na origem e não vai junto. Nunca dois tokens do mesmo personagem de jogador na mesma cena por esse caminho.
- **Auditoria das buscas "o token do personagem"** (lista no relatório do lote): `cenaDoObjeto` (luz na mão) e `posicaoDoObjeto` (zonas) achavam o primeiro token do personagem em qualquer cena; agora preferem o da cena ativa (`tokenDoPersonagemPreferindo`, em `luz.ts`). O resto já olhava a cena (a visão, a névoa, o ping, a ordem de turno e as auras trabalham com os tokens da cena; o mapa só desenha os tokens da cena vista).
- **Automações na barra de cima.** Botão "Automações" (ícone `Workflow`), grupo próprio entre Combate e Ver como, só no menu do mestre. Alterna a janela flutuante que já existia (`JanelaDasAutomacoes`, R3: ordem das janelas e posição lembrada). Na aba Mesa a seção virou um cartão curto: o resumo, a frase "As automações ficam no botão Automações da barra de cima." e o botão "Abrir as automações".
- **Aba Mesa no desenho das Preferências.** Os mesmos cartões recolhíveis com resumo (`SecaoDePreferencias`, agora com `prefixo` e `abertaPorPadrao`), na ordem: Esta mesa (nome, id, link; abre por padrão), Regras, Luz, Automações, Pessoas (papéis, contas e capacidades, cada um com subtítulo), Campanha (exportar e importar) e Diagnóstico. Saíram a fileira de chips e os títulos grandes soltos. Rótulo curto e ajuda embaixo (`Campo` e `CampoDeDistancia` ganharam `ajuda`): "Alcance de interação (m)" com "Até onde dá para entregar uma tocha ou usar um ponto."; "Tempo para os jogadores". O que se abriu ou fechou fica lembrado neste navegador (`tabletop:pref:secoes`, com a chave `mesa-<id>`). "Modelos de tocha…" e o aviso de pedidos de conta abrem o cartão certo antes de rolar (`BarraLateral`).
- Sem migração e sem campo novo no estado nem no protocolo.

**Decisões (assumido)**
- Um token do personagem por cena para o jogador (o mestre pode mais de um). Sem limite por cena para o NPC (como era).
- O personagem que já tem token no destino não leva o da origem junto; o da origem fica onde estava.
- O brilho da área da bandeira durante o arrasto continua (agora é só uma dica de "vai para a bandeira").
- O mestre que usa `token.colocarMeu` com ponto põe onde quiser; sem ponto, cai na bandeira.
- A seção Automações da aba Mesa não sumiu: virou um cartão com a frase e o botão (assim a navegação fica igual à dos outros).
- Sem atalho de teclado para o botão Automações (não há tecla livre que combine em `atalhos.ts`).
- Só "Esta mesa" abre por padrão (como só a Conta abre em Preferências).

**O que ficou para depois**
- Escolher onde fica o token do jogador dentro da área da bandeira (hoje a sala arruma).

## Q10 — como ficou (2026-11-17): hordas, com vida própria por token, numeração, pôr vários, duplicar e Ctrl+C / Ctrl+V

O Vilella perguntou se dá para puxar vários tokens do mesmo monstro. Dava, mas todos apontavam para a mesma ficha: a vida era da ficha (dano em um descia a de todos) e todos tinham o mesmo nome. Ele aprovou a proposta (vida própria por token, numeração, pôr vários, duplicar) e pediu Ctrl+C e Ctrl+V nos tokens.

**O que foi feito**
- **Vida própria por token de NPC.** `Token.pv?: { atual, max, temp? }` (aditivo). O token de NPC (personagem sem editores) nasce com a cópia dos PV da ficha naquele momento; a ficha vira o **modelo**. A ficha ganha `Personagem.vidaPorToken?` (sem o campo = ligado): "Cada token com a sua vida (horda)", na aba Configurar do NPC (só o mestre). Desligado, os tokens leem a vida da ficha, como antes (o vilão único). Personagem de jogador sempre lê a ficha. Regra em `hordas.ts` (`vidaDoToken`, `usaVidaPorToken`). Token de campanha antiga (sem `pv`) lê a ficha; a primeira edição o grava no token. Sem migração.
- **Intenção `token.vida`** `{ id, atual?, max?, temp? }` (valores absolutos): o mestre ou quem edita o personagem. A marca de vida em cima do token (e a tecla E, com `-7` e `+3`) manda `token.vida` quando a vida é do token e `ficha.alterar` quando é da ficha.
- **Ficha aberta por um token.** "Abrir ficha" do botão direito e a CA da marca de vida abrem a ficha com o `tokenId` na janela: no alto, a faixa "Este token: Goblin 3 · PV 4/7" (PV, máximo e temporários editáveis); os PV da ficha embaixo se chamam "do modelo". Abrir pela lista de Fichas tira a faixa. As condições da ficha passam a ser as desse token.
- **Numeração na sala.** Ao pôr um NPC onde já há outro token do mesmo personagem na cena, ele ganha "Nome N" com o menor N livre a partir de 2; o primeiro fica sem número e ninguém é renomeado; é por cena e a sala numera (dois pedidos em seguida não repetem). `Token.numero?` guarda o número do selo, a bolinha escura no canto direito do token (visível a quem vê o token).
- **Pôr vários** (`personagem.colocarVarios`, 1 a 20): "Colocar vários…" no menu do NPC da lista de Fichas e no cabeçalho da ficha (ícone de pessoas). Pergunta a quantidade (padrão 4) e põe tudo arrumado no grid (`arrumarNoGrid`) no centro da vista, na cena que o mestre vê, num pedido só.
- **Duplicar, copiar e colar** (`token.copiar`): Ctrl+D duplica a seleção um quadrado ao lado (o grupo inteiro, ao lado do grupo); Alt+arrastar deixa o original e solta uma cópia onde se solta; Ctrl+C copia (na memória da aba) e Ctrl+V cola com o centro do grupo no ponteiro (sem ele, no centro da tela), encaixado, **na cena que o mestre está vendo** (copiar na A e colar na B funciona; a numeração recomeça na cena nova). A cópia é igual ao original (tamanho, camada, oculto, condições, vida de agora, imagem, quem controla). Só o mestre. Fora de campo de texto, chat e ficha (lá Ctrl+C e Ctrl+V são os de texto).
- **Seleção de vários tokens.** Não existia: Shift ou Ctrl+clique soma (ou tira) um token à seleção (o mestre); o anel dourado vale para todos; Delete tira todos (com Desfazer para todos). O principal segue sendo o do painel, das marcas e das setas.
- **Segredo.** `tokenParaUsuario` (em `hordas.ts`) tira o `pv` do token para quem não receberia a vida da ficha (não vê o personagem ou não vê a ficha: pasta do mestre ou sem `ficha.verOutras`). Vale no snapshot e nos eventos `token.criado` e `token.editado`; sem o estado de antes e de depois a sala falha fechada. Mudar a pasta ou os editores do NPC manda snapshot novo.
- **MCP** (paridade): `tokens.colocar[].quantidade` (horda), `tokens.copiar` (com `quantidade` e `paraCena`), `tokens.tokens[].pvTemp`; `pv`/`pvMax` de um token de NPC com vida própria vão para `token.vida`; `fichas` aceita `vidaPorToken`. `token.criar` de NPC (o que o Claude usa em `cenas`) também nasce com a vida do modelo.

**Auditoria de quem lê ou escreve a vida a partir de um token**
- Marca de vida do token (`MarcasDoToken`): mudou, usa a vida do token. É o único lugar do mapa que mostra PV.
- Ficha aberta pelo token: mudou (faixa e "do modelo").
- Aplicar dano ou cura pelo chat: **não existe** no código (o balão de ataque só mostra o dano); nada a mudar. O dado de vida (`ficha.dadoDeVida`) e o descanso mexem na ficha do personagem (o modelo, no NPC); ficou assim (assumido).
- Ordem de turno: não mostra PV; usa o nome do token (numerado) e a Destreza da ficha. Sem mudança.
- Automações (`automacoesnucleo.ts`, efeitos temporários): não leem nem escrevem PV. Sem mudança.
- Marca de morto: o destaque do botão "morto" quando a vida zera usa a vida do token. Não há morte automática.
- MCP: `tokens` (mudou), `fichas` (`pv` da ficha segue sendo o modelo), `ler` e `panorama` não listam vida de token.

**Decisões (assumido)**
- "Ligada por padrão" para NPC; sem o campo no personagem vale ligado.
- Nome do primeiro token sem número; o menor número livre a partir de 2 (o nome sozinho conta como 1); nome que o mestre mudou não conta como ocupado.
- A cópia de um NPC numera pelo nome-base do original ("Goblin 3" copia como "Goblin N"); token sem personagem e personagem de jogador mantêm o nome. O personagem de jogador segue com um token só por cena (Q8): copiá-lo para uma cena onde ele já está é recusado (revisão do Opus).
- O número do selo fica mesmo se o mestre renomear; o primeiro token não tem selo.
- A cópia leva o `pv` do original; a luz presa ao token **não** é copiada.
- Colar sem nada copiado, ou com os tokens copiados já apagados, não faz nada (avisa no segundo caso). A área de transferência é só da aba.
- Alt+arrastar com vários selecionados copia todos; o original arrastado volta ao lugar quando se solta (sem fantasma durante o arrasto).
- Com Alt na hora de pegar um token o mestre copia; o Alt de inverter o encaixe segue valendo no resto do mapa.
- Duplicar vai um quadrado à direita (grupo: a largura do grupo); sem espaço à direita, vai para a esquerda.
- Colocar vários: padrão 4; o centro da vista é o centro da tela do mestre, na cena que ele vê.
- A ficha na janela própria do navegador não tem a faixa nem o "Colocar vários" (falam com o mapa desta aba).
- `vidaPorToken` só o mestre muda.

**O que ficou para depois**
- Selecionar vários com o laço (arrastar um retângulo no fundo).
- Aplicar dano em lote (selecionar a horda e dar o mesmo dano).
- Mover a seleção inteira de uma vez e as setas com vários.
- Mostrar uma barrinha de vida no token (hoje só a marca em cima do token selecionado).

## Q11 — como ficou (2026-11-17): barra de vida no token, borda colorida, laço de seleção, mover vários e dano em lote

O Vilella pediu o que o Q10 deixou para depois (laço, dano em lote, mover vários juntos, barrinha de vida) e três ajustes: a barra opcional (padrão ligada, também nos tokens do compêndio, só para quem tem o controle), tirar o selo com o número e uma borda colorida de 8 cores para separar grupos.

**O que foi feito**
- **Barra de vida.** `Token.barraDeVida?: boolean` (sem o campo = ligada, então campanha antiga e tokens do compêndio já a têm) e `Personagem.tokenPadrao.barraDeVida?` (o token novo nasce como o padrão do personagem; `true` não grava o campo). Desenho no mapa (`mapaPixi.ts`, `atualizarBarras`): barra fina logo abaixo do token e acima do nome (o nome desce 11 px quando há barra), proporcional ao atual sobre o máximo, verde (mais de 50%), âmbar (mais de 25%) ou vermelha, temporários como trecho azul-claro depois do atual, fundo escuro translúcido. A espessura acompanha o zoom (nunca menos de 4 px na tela; 6 px a 100%). Só quem controla o token a vê: o mestre vendo como mestre vê todas; o jogador e o "Ver como" só nos tokens que a pessoa controla (a mesma regra da seleção, `controlaToken`); sem vida conhecida (sem ficha ou `pv` filtrado) não há barra. A tela decide (`vidaDaBarra` em `Mesa.tsx`, que lê `vidaDoToken`), o mapa só desenha. Liga e desliga: caixa "Barra de vida" no "Editar token…" (vale para a seleção toda) e "Barra de vida nos tokens novos" em "Token padrão e visão" do personagem.
- **Sem o selo do número.** A bolinha saiu (`desenharSelo` foi apagada). `Token.numero` continua nos dados (a numeração e `nomeBaseDoToken` usam); o nome "Goblin 3" basta.
- **Borda colorida.** `Token.borda?`, uma de 8 cores fixas (vermelho, laranja, amarelo, verde, ciano, azul, rosa, branco; `NOMES_DE_BORDA` em `estado.ts`, hexadecimal em `CORES_DA_BORDA`, `bordas.ts`). Sem seletor de cor. Amostras com nome acessível e dica, no menu do token (botão direito) e no "Editar token…" (`SeletorDeBorda.tsx`); com vários selecionados vale para todos num pedido só (`tokens.editar`). Anel de 3 px na beira do token com um contorno escuro por baixo; o anel dourado da seleção fica por fora, com um vão (8 px em vez de 5), então a seleção continua reconhecível numa borda amarela ou laranja. Todos que veem o token veem a borda; quem muda é quem pode `token.editar` (`cena.editar`, o mestre). A cópia leva a borda (`copiaDoToken` já copiava todos os campos).
- **Laço de seleção** (mestre): com a ferramenta Selecionar, arrastar no fundo vazio desenha um retângulo na cor de acento do tema (`--acento`), translúcido; ao soltar seleciona os tokens com o centro dentro dele e que o clique pegaria naquela vista. Shift ou Ctrl+arrastar soma. O laço só começa depois de o ponteiro andar mais de 5 px (a mesma tolerância do ping): segurar parado continua pingando. Esc cancela; Espaço+arrastar e as outras ferramentas não mudam. Cancelado por `pointercancel` não seleciona.
- **Mover vários juntos.** Pegar um token que já está numa seleção de vários a mantém; arrastar leva todos com o mesmo deslocamento (o pegado encaixa no grid, os outros seguem; o grupo encosta na borda da cena sem se desmanchar). Soltar manda **um** `tokens.mover { itens }`; as setas também (um quadrado, todos; se algum saísse da cena ninguém anda). Clicar sem arrastar num token da seleção deixa só ele. Alt+arrastar com vários copia todos (Q10); agora funciona pegando qualquer um da seleção.
- **Dano e cura em lote.** `tokens.vidaDelta { ids, delta }` (negativo é dano, positivo é cura). Por token: vida própria → o `pv` dele; vida da ficha → a ficha, **uma vez por personagem**. Os temporários absorvem o dano primeiro (`aplicarDeltaNaVida`, que usa `receberDano`, a mesma regra de um token só); a cura não passa do máximo nem mexe nos temporários. Na tela: a marca de vida / tecla E com vários selecionados mostra "3 selecionados" e aceita só `-7` ou `+3` (um valor sem sinal seria ambíguo e não vale); no menu do token, "Vida dos N selecionados…" com o mesmo campo.
- **MCP** (paridade): `tokens` ganhou `borda` e `barraDeVida` por token e a seção `grupo` (`deslocar`, `vida`, `borda`, `barraDeVida`, vários tokens por nome num passo só do Desfazer); `fichas` ganhou `barraDeVida` (token padrão).

**Protocolo**: `tokens.mover { itens: {id,x,y}[] (1 a 100) }` (capacidade `token.moverProprio`; a regra de cada token vale; se um só for recusado nenhum se move), `tokens.vidaDelta { ids (1 a 100), delta (inteiro, não zero) }` (sem capacidade: a sala confere quem edita o personagem de cada token; token sem personagem fica de fora; recusa o pedido inteiro se algum não existe ou não pode), `tokens.editar { ids, mudancas }` (`cena.editar`; as mesmas mudanças do `token.editar`, em lote). `token.editar` e `personagem.editar` aceitam `borda`/`barraDeVida`. Eventos: os de sempre (`token.editado`, `token.movido`, `personagem.alterado`); o segredo do Q10 vale (o `pv` passa por `tokenParaUsuario`).

**Decisões (assumido)**
- O laço e o mover vários são do mestre (o jogador não soma tokens à seleção).
- Sem o campo, a barra está ligada; `true` volta ao padrão e apaga o campo.
- A barra aparece para quem controla (`controlaToken`); no "Ver como" segue o jogador escolhido.
- No lote, só `-N` e `+N` valem na marca de vida; sem sinal não vale.
- Só os outros tokens da seleção seguem ao arrastar; eles não aparecem se mexendo ao vivo nas outras telas (só o pegado, quando o arrasto é de um token só); ao soltar, todos vão num pedido só.
- Pedido em lote recusado por um token recusa todos (nenhum muda), para o grupo não se desmanchar.
- Dano em lote que não alcança nenhum token com vida (todos sem personagem) não faz nada, sem erro.
- O principal da seleção feita com o laço é, de preferência, um token com personagem (para as marcas de vida e a tecla E funcionarem).
- O "Desfazer" do dano em lote é o do Claude (um lote por pedido); na tela não há "Desfazer" do dano (como no dano de um token só).
- Não há migração: os campos são opcionais; exportar e importar a mesa levam os campos novos e as mesas antigas carregam.

**O que ficou para depois**
- Mostrar os outros tokens da seleção andando ao vivo nas telas dos jogadores durante o arrasto.
- "Desfazer" do dano em lote na tela.
- Uma legenda da cor da borda (um nome por cor, "grupo A") em vez de só a cor.

## Q12 — como ficou (2026-11-17): sem aviso de parede, setas rápidas e a câmera que segue o meu token

O Vilella pediu três coisas: tirar o aviso "Uma parede bloqueia o caminho." (e os parecidos), deixar as setas rápidas (clicar ou segurar demorava para fazer efeito) e um botão ao lado do zoom que mantenha o token do jogador sempre no centro da tela. É só tela: não há campo, intenção, migração nem mudança de sala ou de protocolo.

**O que foi feito**
- **Sem o aviso da parede.** A sala continua recusando (`trajeto_bloqueado`); a tela deixa de avisar. `useSala.ts` guarda o tipo de cada pedido de mover (`token.mover`, `token.soltar`, `tokens.mover`) e `recusaSilenciosa(tipo, codigo)` cala as recusas cujo resultado já se vê: `trajeto_bloqueado`, `sem_permissao` (token que a pessoa não controla) e `token_inexistente` (token que sumiu). O frame de erro segue para o mapa (`ressincronizar`). Ficaram de propósito, porque a pessoa não vê a razão: `fora_de_alcance` e `porta_trancada` (clique numa porta), `dados_invalidos` e qualquer erro de conexão, importar, salvar, permissão numa janela e Desfazer; "Você só pode tirar do mapa os tokens que controla." (Delete) também fica.
- **O próprio cliente não tenta o passo que bate na parede.** `passoDasSetas.ts` (`proximoPasso`) faz a conta da sala: encaixa no grid e, para o jogador, confere parede, porta fechada e janela com a mesma `trajetoBloqueado` do `shared`. O passo que bate na parede nem sai da tela (nenhum pedido). Passo que sairia da cena também não anda (a sala o limitaria à borda e o token pararia fora do centro do quadrado). O mestre atravessa tudo, como na sala. O arrasto já parava o token antes da parede desde o Lote 5 (`aoMover` do mapa).
- **Setas rápidas.** O passo aparece na hora (`moverOtimista` no mapa): o token anda no keydown, a partir da posição **pendente** (a que a tela já mostra), não da confirmada. A sala confirma depois; quando o eco chega na posição pendente ela some; se a sala recusa (`erro` → `ressincronizar`) o token volta para a posição confirmada, sem aviso; um passo que a sala nunca confirma nem recusa expira em 2,5 s. Segurar: o primeiro passo na hora e um temporizador nosso repete a 10 passos por segundo (`INTERVALO_DA_SETA_MS` = 100 ms, assumido), sem depender da repetição de tecla do sistema nem do eco; soltar a tecla (ou perder o foco, abrir um diálogo, trocar a seleção) para na hora. Vale a última seta segurada. Um pedido por passo (`token.soltar`), cada um conferido pela sala; com vários selecionados (mestre) é um `tokens.mover` por passo, como no Q11. A suavização do token no mapa caiu de 70 ms para 45 ms (`TAU_MS`), o que acelera também o arrasto e o movimento dos outros.
- **Seguir meu token.** Botão novo (mira, `Crosshair`) no controle de zoom, ao lado do de centralizar, com dica "Seguir meu token · F" e `aria-pressed` (acento quando ligado). Ligado, a vista mantém o token escolhido no centro da tela a cada quadro, acompanhando a animação do token (setas, arrasto, a sala, o mestre movendo, "Levar o grupo"); ao ligar ela desliza até o token em ~0,3 s e depois o acompanha sem folga. O zoom continua livre. Arrastar a vista à mão (Espaço+arrastar, Mão, botão do meio) desliga (`parouDeSeguir`); Centralizar o mapa também. Qual token: um só na cena, ele; vários que o jogador controla, a primeira vez abre uma lista (avatar e nome) e liga ao escolher; uma setinha ao lado do botão reabre a lista e troca. O mestre segue o token selecionado na hora de ligar; sem seleção, a lista com os tokens da camada dos tokens da cena. Troca de cena: continua ligado e segue o token do mesmo personagem (`personagemId`) na cena nova; sem ele espera, sem mexer na vista. O token sumiu da cena (apagado, ficou invisível): desliga sem aviso. Ligado e escolha ficam por mesa neste navegador (`tabletop:pref:seguir:<mesa>`, nunca vão à sala). Atalho F (no mapa, sem modificador), em `atalhos.ts` como `seguirToken`.
- A câmera que já mantinha o token à vista ao andar com as setas (V10, `manterVisivel`) agora é chamada no passo pendente, sem esperar o eco.

**Tempos das setas** (tecla até o token aparecer no lugar novo; Playwright, notebook, mapa de teste, 1600×900, com a luz e a névoa da semente; mestre e jogador com o Aldric, que tem visão no escuro)

| | antes | depois |
|---|---|---|
| um toque, primeiro movimento visível | mestre 71 ms, jogador 26 ms | 5 a 7 ms |
| um toque, o token chega ao quadrado (a menos de 5 cm do destino) | 261 e 258 ms | 154 e 156 ms |
| segurando 2 s (repetição do sistema a ~30/s) | 10,4 quadrados (mestre); 8,5 (jogador, na parede) | 21 quadrados (mestre, 4 direções); 21 a 22 (jogador, onde não há parede) |

**Decisões (assumido)**
- Segurar repete a 10 quadrados por segundo.
- Com duas setas seguradas vale a última; não há diagonal (como antes).
- Passo que sairia da cena não anda, em vez de o token parar na borda.
- A suavização do token caiu para 45 ms para todos (setas, arrasto e os outros vendo andar), não só para o passo pendente.
- Arrastar a vista à mão e Centralizar desligam o seguir; o "ping com centralizar" de outro usuário não o desliga (o seguir recentra no quadro seguinte).
- A escolha do token guarda o personagem e o id; a lista do mestre só tem tokens da camada dos tokens (não objetos nem o que fica sob o mapa).
- Ligar com vários tokens e uma escolha guardada liga nela, sem lista; a setinha troca.
- `fora_de_alcance`, `porta_trancada` e o aviso do Delete ficam (a pessoa não vê a razão).
- Sem intenção nova: nada a pôr em `paridade.ts`.

**O que ficou para depois**
- Agrupar passos de segurar num só pedido (hoje um `token.soltar` por passo, 10 por segundo).
- Diagonal com duas setas.
- Seguir um token em outra cena enquanto o mestre olha outra.

## Q13 — como ficou (2026-11-17): segurar a seta anda contínuo e em linha, mesmo numa cena pesada

O Vilella mostrou em vídeo (mesa dele, `pnpm dev`): segurando a seta o token andava ~3,9 quadrados por segundo, em intervalos irregulares (0,17 a 0,43 s), parando entre os quadrados, e no fim passou um quadrado e voltou. É só tela: não há campo, intenção, migração nem mudança de sala ou de protocolo.

**O que o perfil mostrou** (CPU do Chrome via CDP, num teste com a cena pesada: 45×45 células, 172 paredes, escuridão, tocha presa ao token, névoa, memória do mapa, 5 tokens)
- O teste simples, sem peso e sem limitação de CPU, dá ~9,8 quadrados/s: não reproduz a mesa dele. Com a CPU emulada 4× mais lenta (`Emulation.setCPUThrottlingRate`) ele reproduz o vídeo: ~4 quadrados/s, intervalo médio ~240 ms, pior ~390 ms, 18 tarefas longas de até ~350 ms.
- O laço de desenho do mapa **não** é o gargalo (parado, ~2% do tempo; o brief trazia a pista errada, desmentida também pela sessão das otimizações). O custo é **por passo**:
  - ~55% era o React em modo de desenvolvimento: cada `token.movido` de eco atualizava o estado e a `Mesa` inteira se redesenhava (centenas de botões com dica, lista de atalhos, seletor de tema, ícones), e cada passo gerava ~3,3 chamadas da `Mesa` (o `StrictMode` duplica as chamadas em dev).
  - ~12% era a visão e a luz da tocha (`recalcularVisao`: polígonos contra 172 paredes e as texturas da luz) **a cada quadro** enquanto o token se mexia (60 vezes por segundo), embora a posição só mude 10 vezes por segundo.
  - O `setInterval` das setas atrasa quando o navegador está ocupado e o token usava a suavização exponencial (45 ms), que freia em cada quadrado: daí os saltos irregulares e o "anda e para".
  - O rastro do Playwright (`trace: retain-on-failure`) tira um retrato do DOM a cada ação e distorcia a medida; o `q13.spec.ts` o desliga e não faz ação por quadro.

**O que foi feito**
- **O estado do React não é mais tocado a cada passo.** `useSala.ts` empilha os `token.movido` e só os aplica ao estado a cada 300 ms (`INTERVALO_DO_ESTADO_DOS_PASSOS_MS`); qualquer outro evento descarrega a fila antes, na ordem em que chegou, e o snapshot a zera. O mapa recebe cada `token.movido` **na hora**, pela `ouvir` da `Mesa` (`movidoDaSala` em `mapaPixi.ts`), então os outros veem o passo sem esperar o React. O mapa guarda essas posições (`posicoesAvisadas`) enquanto o estado está atrás delas: `sincronizarTokens` não reposiciona token com estado atrasado, e `posicaoPendente` (de onde parte o próximo passo da seta) as usa. Renders da `Mesa` por passo: de 3,3 para ~1 chamada da função (o StrictMode do dev duplica cada render).
- **Deslize linear.** O token que anda em passo (passo de seta, eco da sala, volta de recusa, desde que o deslocamento seja de até 2,5 quadrados) desliza em linha reta e em velocidade constante, um quadrado a cada 100 ms (`vel` no visual, `avancarEmLinha` em `passoDasSetas.ts`); se ficou muito para trás acelera, e chegando para seco. Deslocamento maior (arrasto de outro, "Levar o grupo") segue com a suavização de antes. Soltar a tecla: o token termina o quadrado e para, sem frear.
- **Relógio próprio da tela.** Segurar a seta agora é um `requestAnimationFrame` com o instante do próximo passo (`passosVencidos`): um quadro atrasado recupera até 3 passos de uma vez (o token os anda em linha), atraso maior recomeça o ritmo dali; não há mais `setInterval`. O keyup é tratado antes do quadro seguinte, então os passos que ficavam na fila do temporizador depois de soltar a tecla (o token "passando um quadrado") não existem mais.
- **Visão e luz no ritmo que a máquina aguenta.** Enquanto o token anda, a visão e a luz são refeitas esperando o dobro do que a última refeita gastou (teto de 120 ms, `esperaDaVisao`); com a máquina folgada continua a cada quadro. Qualquer outra causa (parede, opção, luz) refaz na hora como antes. Ao parar, a última refeita sai no quadro seguinte.
- **Peças estáticas em `memo`:** `Teclas`, `Dica`, `ListaDeAtalhos`, `Grupo` (cada botão com dica e a lista de atalhos não se refazem a cada render da mesa).

**O "passa e volta"**
- Não consegui reproduzir uma recusa da sala: com a cena pesada, a parede no fim do corredor e a CPU 4× mais lenta, a sala não mandou nenhum `erro` e o token nunca recuou (a regra da tela e a da sala são a mesma `trajetoBloqueado`, com as mesmas paredes que o jogador recebe).
- Duas causas prováveis, as duas corrigidas: (1) com o navegador ocupado os ticks do `setInterval` já estavam na fila quando o keyup chegou, e saíam passos depois de a pessoa soltar a tecla; (2) **qualquer** `erro` da sala (de qualquer pedido, mesmo sem relação com o token) mandava todos os tokens de volta para a última posição do **estado**, que no `pnpm dev` fica atrasada em relação ao que a sala já confirmou, e o token voltava uns quadrados e depois avançava de novo quando os ecos chegavam. Agora o erro de um passo de seta volta só os tokens daquele pedido, para a posição que a sala avisou por último (em linha, curto); o erro de um pedido que não é de mover não mexe em token nenhum; o erro de um arrasto (ou de pedido sem tipo) volta todos, como antes, mas para a posição avisada.

**Números** (notebook de teste, Chrome estável, mapa de teste da cena pesada, jogador segurando a seta por 3 s)

| | antes | depois |
|---|---|---|
| dev, CPU normal | 9,8 quadrados/s, intervalo médio 102 ms, pior 117–133 ms, 0 tarefas longas | 9,8 quadrados/s, intervalo médio 102 ms, pior 117 ms, 0 tarefas longas |
| dev, CPU 4× mais lenta (o que o vídeo mostra) | 4,2 quadrados/s, médio 239 ms, pior 392 ms, 18 tarefas longas (pior 345 ms) | 8,0 a 9,0 quadrados/s, médio 111 a 125 ms, pior 158 a 333 ms, 4 a 6 tarefas longas (pior 162 a 315 ms) |
| mestre olhando o jogador andar (CPU normal) | não medido | 9,7 quadrados/s, médio 103 ms, pior 117 ms |
| build de produção (`vite build --mode e2e` + `vite preview`), CPU 4× mais lenta | não medido | 9,8 quadrados/s, médio 102 ms, pior 117 a 133 ms, 0 tarefas longas |
| chamadas da `Mesa` por passo (dev, contando o dobro do StrictMode) | 3,3 | ~1 |

**Decisões (assumido)**
- O estado do React recebe os passos a cada 300 ms enquanto há passos chegando.
- O deslize linear vale para deslocamentos de até 2,5 quadrados e usa a mesma velocidade do passo de seta (um quadrado por 100 ms).
- A visão e a luz acompanham o token no ritmo de 2× o próprio custo (até 120 ms entre refeitas), não a cada quadro, quando a máquina está apertada.
- Erro de pedido que não é de mover token não devolve token nenhum (antes devolvia todos).
- O teste usa a CPU 4× mais lenta para reproduzir a mesa do Vilella; a meta de 8 quadrados/s foi atingida nessa condição (8,0 a 9,0), mas o pior intervalo (160 a 330 ms, contra 1,5× a média) e as tarefas longas (de 160 a 315 ms) ainda passam do alvo ali; com a CPU normal e no build de produção a meta é cumprida.

**O que ficou para depois**
- Com a CPU 4× mais lenta ainda há tarefas longas de ~160 a 300 ms: sobram o próprio desenho da luz (triangulação dos polígonos em `camadaDeLuz.ts`) e os renders da `Mesa` a cada 300 ms. Dá para baixar mais reaproveitando as texturas da luz entre quadrados e dividindo a `Mesa` (hoje um componente só, com 49 estados) para que um passo não a refaça inteira.
- Produção: medi só depois (ver a tabela em `docs/ESTADO.md`); o "antes" do build de produção não foi medido.

## Q14 — como ficou (2026-11-18): a ficha por seções

O Vilella perguntou se a ficha podia ser dividida em seções que se atualizam: mexer nos atributos atualiza as seções que têm valores derivados, mas escrever em talentos atualiza só ela. Números antes e depois: `docs/ESTADO.md`, "Ajustes Q14".

**O que foi feito**
- `compartilharEstrutura` (shared) e o uso em `aplicarOperacoes`, `useFichaEditavel` e na derivada da `JanelaDaFicha`: o que não muda mantém a referência.
- `secao` (`apps/web/src/ficha/secoes.tsx`): `memo` com comparador por fatia. As seções da aba Personagem e as caixas da aba História usam.
- Props estáveis na `JanelaDaFicha` e `pedirImagem` da `Mesa` em `useCallback`.
- `BotaoComDica` monta o balão só enquanto aparece.
- Testes: unidade do compartilhamento e das derivadas (`estruturaCompartilhada.test.ts`, `useFicha.test.ts`) e `e2e/tests/q14.spec.ts` (só seções que dependem redesenham; Força atualiza perícia, salvaguarda e ataque; o cursor não pula com o eco; a dica aparece e some).

**Decisões (assumido)**
- (assumido) O compartilhamento é por igualdade profunda de JSON contra a versão anterior, não por caminho da operação: vale também quando o eco da sala traz objetos novos de mesmo conteúdo, e custa uma passada pela ficha (menos que uma validação do zod, que já roda por tecla).
- (assumido) Ataques e Equipamento declaram o que leem: Ataques lê tudo da ficha menos os textos livres e números soltos (PV, XP, moedas...); Equipamento lê só `itens` e `ataques`, mais a luz da mesa comparada por dentro (`mesmaLuz`).
- (assumido) A prop `luz` (a mesa inteira) é ignorada por todas as seções, menos o Equipamento.
- (assumido) Sem balão montado, o nome do botão de ícone vai no `aria-label` e o motivo do desabilitado no `aria-description`; nenhum teste antigo foi afrouxado.
- (assumido) O balão montado só quando visível vale só para `BotaoComDica`; os outros usos de `Dica` (alça do painel, estado da mesa, cabeçalho da janela, tipos de parede) seguem sempre montados.

**O que ficou para depois**
- A aba Magias e o bloco do NPC (`BlocoDoNpc`, `ConjuracaoDoNpc`) ainda redesenham inteiros a cada tecla (só uma delas está à vista por vez). O mesmo `secao` serve.
- O cabeçalho da `JanelaDaFicha` (abas, nome, vantagem) e a própria janela ainda redesenham a cada tecla (80 renders em 40 teclas), são o que sobra do script.
- O restante da `Mesa` a cada eco (ver `IDEIAS.md`).

## Q15 — como ficou (2026-11-18): Magias e NPC por seções; arrastar o token seguido desliga o seguir

**O que foi feito**
- A aba Magias e o bloco do NPC (Bestiário e Conjuração) usam `secao()`. Números: `docs/ESTADO.md`, "Ajustes Q15".
- `secao` ganhou: caminho `npc.<campo>` em `ficha`, comparação por dentro da prop `props` (as seções que recebem o conjunto todo) e `mudou(a, b)` (fatia livre, ex.: "as magias deste círculo").
- `PropsDaAba.fichaAtual()` (identidade estável): os manipuladores que montam uma lista inteira (nova magia, reordenar, soltar do compêndio, nova ação) leem a ficha de agora, porque a seção pode estar com a de um render antigo. `PropsAoVivo` (contexto da janela): a linha de magia, dentro do círculo em `memo`, lê os props de agora por ele.
- `conjurar` lê `espacosGastos` de `fichaAtual()`.
- Arrastar o token seguido (ou a seleção que o inclui) chama `seguir(null)` e `parouDeSeguir` no primeiro passo do arrasto, em `mapaPixi.ts`.

**Decisões (assumido)**
- (assumido) Arrastar um token que não é o seguido, ou a cópia (Alt), não desliga o seguir.
- (assumido) O "passo" que desliga é o primeiro em que o token sai do lugar (já encaixado no grid), não um limiar em pixels.
- (assumido) Gastar um espaço redesenha os círculos e as linhas do nível dele para baixo (o menu Conjurar lista os espaços).
- (assumido) Mudar o atributo de conjuração redesenha todos os círculos e linhas (CD e ataque aparecem nos chips).

**O que ficou para depois**
- O cabeçalho da `JanelaDaFicha` (abas, nome, vantagem, botões) continua redesenhando a cada tecla (JSX solto na janela, depende de muitos estados da janela); sem risco só com uma refatoração maior.
- As seções de conjuração do NPC ainda redesenham todas as linhas ao gastar um espaço.

## Q16 — como ficou (2026-11-18): o MCP faz tudo o que a tela faz, campo por campo

O Vilella perguntou se o MCP sobe áudio, seta zonas e põe características nelas, e pediu que ele faça tudo. A paridade do M2 era por intenção; o Q16 a fez por campo.

**O que foi feito**
- Auditoria de 107 intenções com ferramenta (de 125; 18 ficam de fora: 4 proibidas, 9 de transporte, 5 gestos ao vivo): cada campo do zod, com os objetos de dentro, contra a entrada da ferramenta. Tabela em `packages/shared/src/mcp/paridadeCampos.ts`; leitura dos esquemas em `mcp/camposDoEsquema.ts`.
- Trava: `mcp/paridadeCampos.test.ts` reprova campo novo sem caminho no MCP, caminho que a ferramenta não tem e linha de campo que não existe mais; a mensagem diz o que fazer.
- Lacunas fechadas: `rolar.conjurar` (espaço, pacto, ritual, uso da inata, dado a mais por nível; a salvaguarda e a CD agora vão ao chat também no `ataque`); `fichas.campos` (qualquer campo da ficha), `visaoM`, `vidaPorToken` e `barraDeVida` na criação; usos de arquivo `aparencia` e `simbolo`; `tokens.controladoPor`; som por nome nas zonas (`efeitos.som.hash`) e nas reações (`som.tocar.hash`).
- Teste de ponta a ponta na sala simulada (`mcp/q16.test.ts`): som, cena, zona com todos os efeitos e som, reação "ao entrar na zona", tokens com borda e barra de vida, luz, handout, ambientes da cena e publicação, com o estado final conferido campo a campo.

**Decisões (assumido)**
- (assumido) `fichas.campos` é a saída geral da ficha (caminho e valor, como a tela grava), em vez de um campo do MCP para cada um dos ~30 campos soltos; o teste aceita apontar para `campos`, mas exige a linha.
- (assumido) Id que o Claude troca por nome, valor que a sala preenche (`rascunho`, `criadoPor`, `numero`, `ordem`) e o campo antigo `modInteligencia` entram na tabela como `fora("interno", ...)`, uma categoria só dos campos (as três categorias das intenções ficam como estavam).
- (assumido) Edição de zona continua trocando a lista de efeitos pela mandada (não junta); a descrição diz "mande todos".
- (assumido) `conjurar` sem `nivel` gasta o menor círculo com espaço sobrando a partir do nível da magia; ritual exige a magia marcada como ritual na ficha.

**O que ficou para depois**
- `ordem` das pastas e o reordenar (a sala numera).
- A cena não tem trilha própria além dos ambientes da cena (`som.ambientesDaCena`).
- Gastar o uso da inata pelo MCP, que estava em `IDEIAS.md`, foi feito.

## CH1 — como ficou (2026-11-19): a chamada da mesa (voz e vídeo, com fundo desfocado)

**O que foi feito**
- A janela própria `/m/<id>/chamada` (aberta pelo botão "Chamada" no topo da mesa): antes de entrar, a janela larga (só a Grade, lista lateral, barra de baixo, atalhos M/V/B) e a estreita (linhas com miniatura, abaixo de ~560 px), seguindo as três telas do desenho, com os tokens do tema (vale nos 14 temas). "Flutuar por cima" por Document Picture-in-Picture onde há suporte.
- A sala só sinaliza: `chamada.entrar`, `chamada.estado`, `chamada.sair`, `chamada.sinal` e `chamada.chamar` (transitórias, como o ping do V12), e as mensagens `chamada.quem`, `chamada.sinal`, `chamada.chamando` e `chamada.substituida`. Quem está na chamada mora no `serializeAttachment` do socket da janela. Regras puras em `packages/shared/src/chamada.ts`, testadas na unidade.
- A malha WebRTC (uma conexão por par, "perfect negotiation", `replaceTrack` para câmera, aparelho e desfoque), o áudio no WebAudio (volume 0–200% por pessoa, quem fala com histerese, sons de entrar e sair gerados), o fundo desfocado com MediaPipe (modelo empacotado) e o controlador da janela: `apps/web/src/chamada/`.
- Na mesa: o botão "Chamada" com a contagem, o ícone verde na presença de quem está na chamada (com o anel de quem fala, vindo da janela da chamada pelo `BroadcastChannel`) e o aviso "está chamando".
- Paridade com o Claude: as intenções `chamada.*` entram como `gesto ao vivo` (e `chamada.sinal` como `transporte`).

**Decisões (assumido)**
- Limite de 8 pessoas (malha ponto a ponto); a 9ª vê "A chamada está cheia (8)".
- A mesma pessoa entrando por outra janela substitui a antiga (que mostra o aviso e "Entrar de novo").
- Sons de entrar e sair gerados no WebAudio, com opção de desligar.
- "Chamar" é um aviso transitório na mesa da pessoa, com "Entrar".
- Entrar só ouvindo trava microfone, câmera e fundo até sair e entrar de novo.
- Quem oferece no começo de cada par é a ponta de id maior (a de id menor cede): as duas ofertas simultâneas deixavam um par sem ICE no Chrome; a "perfect negotiation" continua valendo para renegociações.
- Um sinal que chega antes de a lista da sala me mostrar quem chegou é guardado por 10 s e entregue quando a conexão com a pessoa existe (sem isso as duas pontas esperavam uma pela outra).
- O desfoque se desliga sozinho se passar 5 s abaixo de 12 quadros por segundo, ou se o modelo não carregar (o botão fica desabilitado com o motivo).
- A saída de som vem do `setSinkId` do contexto de áudio; sem suporte a opção some, com a dica do porquê.
- `iceServers` vazio por padrão; STUN/TURN pela variável do Vite `VITE_CHAMADA_ICE_SERVERS`, para a internet.

**O que ficou para depois**
- Transcrição com Whisper, playlist da trilha e compartilhar tela (`IDEIAS.md`).
- O anel de quem fala na presença só vale no mesmo navegador (`BroadcastChannel`); em outro computador a mesa não o mostra.
- O desfoque depende de timers da janela: com a janela da chamada totalmente escondida o navegador os desacelera (mesma limitação de qualquer chamada em segundo plano).

## MU1 — como ficou (2026-11-19): a música da mesa

**O que foi feito**
- A biblioteca de música (`Estado.musica`): músicas com duração, energia de 1 a 5, etiquetas e descrição; botões que guardam um filtro (etiquetas, faixa de energia e ordem). A música que toca (`Estado.musicaTocando`) leva a fila, a semente e o instante de início: cada navegador acha a música e o ponto pela soma das durações, sem evento no fim de cada música. Pausar, próxima, anterior, "Voltar a <botão>" e o volume da música.
- A seção **Música** na mesa de som, com o divisor arrastável (mínimo de 18% por lado, duplo clique volta ao meio, teclado) e o minimizar de cada lado; a divisão e o lado minimizado ficam lembrados por navegador. Nos modos verticais (janela flutuante e janela própria) o divisor é horizontal. A configuração ganhou a aba **Música** (filtro por etiquetas e energia, lote, "Adicionar mp3" e "Adicionar pasta" com as subpastas virando etiquetas, "Salvar este filtro como botão", "Tocar para todos").
- Motor de som: uma camada de música por cima dos ambientes, com transição suave de 3 s, alarme na emenda das músicas e download antecipado da seguinte.
- O quadro "Trilha da mesa" da chamada mostra a música e o botão, e dá Pausar e Próxima ao mestre.
- A ferramenta `musica` do MCP (nomes, não ids) e as intenções `musica.*` com a paridade campo a campo; `docs/MCP.md`.
- Limpeza do CH1: saiu a preferência `disposicao` da chamada e as props `noPalco` e `aoEscolher` do `QuadroDaPessoa`, com o CSS que sobrou.

**Decisões (assumido)**
- A identidade de uma música é o hash do arquivo (o mesmo arquivo entra uma vez só e, se entra de novo, só ganha as etiquetas).
- A semente do sorteio vem do relógio da sala no instante de tocar; as passadas depois da primeira saem de um sorteador determinístico (mulberry32), por isso a sala guarda só a primeira passada e o ciclo.
- Crescente: dentro de cada energia o sorteio é por semente; no topo, `ciclo` = as músicas de energia mais alta do filtro. Se só há uma energia, a passada inicial já é o topo.
- Apertar o botão que já toca pausa e retoma (não recomeça); apertar outro troca e guarda o anterior. Tocar o mesmo botão de novo (pela biblioteca) sorteia outra fila sem trocar o "Voltar".
- "Parar tudo" da mesa de som pausa a música junto; o volume da música usa o mesmo botão "trilha" das preferências de cada pessoa e o volume geral da mesa de som.
- Volume padrão da música: 0,7. "Anterior": depois de 3 s recomeça a música, antes volta para a anterior.
- Energia só filtra: as chips da energia esticam e encolhem uma faixa contínua (1 a 5).
- A pasta escolhida em "Adicionar pasta" não vira etiqueta; só as subpastas dentro dela.
- O jogador recebe a fila do filtro que toca (hash, nome e duração de cada música dela), então vê o nome das próximas desse filtro; a biblioteca inteira, os botões, as etiquetas e a energia nunca chegam a ele.
- O MCP não adiciona músicas (a duração só o navegador lê); a ferramenta é separada (`musica`), porque a descrição da `som` passaria do limite de tamanho das descrições.
- O play da linha da biblioteca usa o motor de efeitos do próprio navegador do mestre (nada vai à sala).
- Sem migração de banco: duas chaves novas na tabela `meta`, lidas com tolerância (valor ilegível = sem música).

**O que ficou para depois**
- Ver `docs/IDEIAS.md`, "Depois da música da mesa": barra de progresso arrastável, música por cena ou zona, adicionar música pelo Claude, pasta grande em segundo plano, playlist fixa.

## A1 — como ficou (2026-11-19): campos lado a lado sempre alinhados

**O que foi feito**
- `.linha-par` (e `.linha-da-fase` do ciclo e `.inicio-grade-de-campos` da tela inicial) agora são grades em que cada campo é um subgrid de 3 trilhas (rótulo, caixa, ajuda). O rótulo mais alto define a linha dos rótulos, as caixas ficam na mesma altura e as ajudas começam na mesma linha. Rótulos não foram encurtados.
- A regra vale para `label.campo-coluna` e para `label` sem classe dentro do par (PainelDoToken); `.linha-opcao` dentro do par fica na linha da caixa, centrada.
- Dentro do par a caixa ocupa a largura da coluna (`min-width: 0`): nada transborda em painel estreito.
- Teste novo `e2e/tests/a1.spec.ts`; prints `e2e/prints/a1.spec.ts`.

**Decisões (assumido)**
- Só CSS: nenhum componente mudou.
- A ficha (`fl-*`) fica de fora: suas linhas são faixas de controles diferentes, não pares rótulo/caixa/ajuda.
- Botão de tirar a fase (ciclo) fica na linha das caixas.

**O que ficou para depois**
- Nenhum.

## AU1 — como ficou (2026-11-19)

### O que foi feito
Automações por blocos: dado (`fluxos.ts`), motor (`automacoesnucleo.ts`), conversão (`fluxosConversao.ts`), frase em português (`fluxosFrase.ts`), conferência (`fluxosValidar.ts`), MCP, lista e editor (`apps/web/src/automacoes/`).

### Decisões (assumido)
- Intenções `fluxo.criar|editar|apagar|ligar|disparar` no lugar das de ciclo, reação, botão e `evento.disparar`; `botao.usar` fica (os chips: `ciclo:<id>` relógio, `evento:<id>` botão).
- Relógio dispara ao começar (ou depois de `primeiroS`) e a cada `cadaS`; desligar congela e cancela as esperas; ligar continua.
- Ação sem alvo não faz nada e anota no registro; o editor avisa antes. Ação de token sem token usa quem carrega o objeto da vez.
- Um "esperar" dentro de um "para cada" segura só aquele alvo.
- Conversão: ciclo em fluxo de relógio com uma trilha por fase; reação embutida na trilha só quando o evento tem um único emissor e todas as que o ouvem estão ligadas e fora de rascunho; senão, sinal. Mesa em andamento: o relógio recomeça. Condição `cena` estreita o escopo dentro do "sim". Reação de zona em evento que não é de zona ganha "se a zona está ligada".
- Frase: "na cena Pulmão" (o nome do exemplo do brief, "no Pulmão", dependeria do gênero do nome).
- Janela própria do editor: sons só entre os que já estão na mesa.
- "rodou há …" vem de `Automacoes.ultimaVez` (campo novo, sem migração SQL).

### O que ficou para depois
Arrastar com o teclado; zoom e arrastar o canvas; colar blocos entre automações; histórico de execuções além do "rodou há" e do registro de 30 avisos.

## MU2 — como ficou (2026-11-19): a mesa de som em duas abas e textos sem cortar

O Vilella testou o divisor do MU1 a ~1360 px: "o espaço ficou muito pequeno e os textos começaram a cortar. Faz separado uma seção para efeitos e ambientes e outra para música, daí troco de um para o outro."

**O que foi feito**
- **Duas abas no lugar do divisor:** "Efeitos e ambientes" e "Música", logo abaixo do cabeçalho, nas três formas (faixa, janela flutuante, janela própria), cada uma na largura toda. `role="tablist"`; as setas, Home e End trocam.
- **Cada aba diz o que toca nela:** "2 ambientes ligados" (e "1 efeito tocando", quando há); na Música, o nome do botão com o ícone de tocando ou pausada, ou "parada". Um ponto marca a aba escondida que tem algo tocando. O rótulo acessível leva o mesmo texto.
- A aba escolhida fica lembrada por navegador (`tabletop:pref:som-aba`). Trocar de aba só muda a vista.
- Saíram `DivisorDoSom.tsx`, `divisaoDoSom.ts` (e o teste), as tiras de minimizar, as preferências `som-divisao` e `som-lado-minimizado` e o CSS do divisor. O resto do MU1 (botões, player, Voltar, biblioteca, chamada) ficou igual.
- **Textos que não cortam:** nome de efeito e de ambiente até duas linhas (`line-clamp`), com o nome inteiro na dica (`BotaoComDica`, só quando está cortado) e no rótulo acessível; lugar vazio de efeito é só "+" com "Adicionar efeito" na dica; o volume do ambiente ligado ficou dentro do cartão; espaço entre ícone e texto nos botões da mesa de som (inclusive "Adicionar músicas").
- Na faixa o cartão do efeito é largo e baixo (círculo ao lado do nome, que pode ter duas linhas).

**Decisões (assumido)**
- A aba abre em "Efeitos e ambientes" na primeira vez.
- "Ambiente ligado" no rótulo da aba conta só os que estão tocando; ambiente marcado com a mesa parada vale "nada tocando".
- A barra de abas tem 40 px e entra na altura cheia da faixa (`ALTURA_DAS_ABAS_DA_FAIXA`): a faixa ficou 40 px mais alta (era 252, agora 292) e `ALTURA_NATURAL_DO_CORPO` continua 190.
- O lugar vazio de ambiente continua mostrando "Adicionar ambiente" por extenso (cabe nos cartões largos); o de efeito é só "+".
- A janela própria lê a mesma aba escolhida da janela da mesa (mesma preferência do navegador).

**O que ficou para depois**
- Nenhum.

## MU3 — como ficou (2026-11-19): abas no seletor da ficha e o zoom acima da faixa

**O que foi feito**
- Um seletor segmentado só (`SeletorSegmentado`), no desenho do "Personagem | NPC" da ficha: grupo com borda e cantos arredondados, o escolhido cheio na cor de destaque, os outros em texto suave. Usado na ficha (idêntica), nas abas da mesa de som (faixa, janela flutuante e janela própria) e nas abas da janela "Mesa de som · configuração". As abas mantêm `tablist` e `tab`, setas, Home, End e a aba lembrada.
- Sem subtítulo nas abas da mesa de som: saiu a linha de estado. O estado continua no rótulo acessível.
- A barra de abas da faixa passou de 40 para 46 px (`ALTURA_DAS_ABAS_DA_FAIXA` e o CSS); a faixa ficou 6 px mais alta.
- O zoom sobe para ficar acima da faixa (aberta, recolhida e durante o arrasto da alça) e volta ao pé quando a mesa de som vira janela, janela própria ou fecha. A mesma regra vale para o selo de modo ("ver como"), o aviso do som e o aviso da importação.

**Decisões (assumido)**
- O ponto ao lado do nome da aba escondida que tem algo tocando ficou.
- Fora da ficha o seletor usa Space Grotesk 600 (a fonte da ficha vem do tema da ficha).
- O aviso perto do ponto (`AvisoPerto`) e a dica da barra de ferramentas não mudam: não ficam no pé do mapa sob a faixa.

**O que ficou para depois**
- Nenhum.

## AU2 — como ficou (2026-11-20): as automações como o n8n

O Vilella testou o AU1: "tem que clicar nos botões pra adicionar, isso tá ruim. Não consegui colocar mais condições do when... queria portas lógicas como not, or, and... arrastar livremente os blocos e conectar os fios, fazer lógicas paralelas também... clicar em editar ou adicionar já tem que criar uma nova janela automático... uma mesa de eventos (estilo a de áudio) só com botões."

### O que foi feito
- **O fluxo virou grafo** (`nos[]` e `fios[]`, `fluxos.ts`, `fluxosGrafo.ts`): gatilhos, esperar, sortear, para cada (saídas corpo e depois), se (entrada de condição), condições (as quatro de antes mais `chance` e `tokenDeJogador`), portas lógicas E, OU e NÃO, ações e sinal. Fio de ordem e fio de condição só encaixam no tipo certo.
- **O motor segue os fios** (`automacoesnucleo.ts`): paralelo, chegada múltipla (roda a cada chegada), OU de gatilhos, ciclo só com "esperar" de 1 s ou mais, esperas guardadas por nó (`Esperando.no`) e sobreviventes à hibernação. O ouro bate.
- **Conversão:** a árvore do AU1 vira grafo (`arvoreParaGrafo`, posições por `organizarGrafo`) ao ler a mesa, o arquivo e a intenção; o formato antigo (ciclos, reações) passa por árvore e depois grafo.
- **O editor em grade** (`CanvasDoGrafo.tsx`, `EditorDeFluxo.tsx`, `PainelDoBloco.tsx`, `blocos.ts`): zoom, vista arrastável, peças arrastadas da paleta (ou clique, ou duplo clique com busca), nós livres, fios por arrasto, caixa de seleção, copiar e colar, desfazer, "Organizar", erros no nó e teclado (Tab, setas, Enter, Delete e o menu "Ligar a…"). Só vive numa janela própria do navegador.
- **Mesa de eventos** (`MesaDeEventos.tsx`, `eventosDaMesa.ts`, `EventosEmJanelaPropria.tsx`): só botões grandes; janela flutuante, faixa ou janela própria.
- **MCP:** `nos` e `fios` por nome, `explicar` e `guia` com as portas lógicas; a forma curta do AU1 continua.
- **Correções do AU1:** nó cortado na borda da grade (a primeira vista enquadra tudo), campo "Buscar" com a borda do tema (`input[type="search"]` entrou na regra dos campos) e o nome do sinal como a pessoa o escreveu (acento e espaço).

### Decisões (assumido)
- Vários gatilhos ligados ao mesmo bloco são um OU. No máximo um gatilho de relógio e um de botão por automação (o relógio e o chip dependem disso).
- Um bloco com vários fios chegando roda a cada chegada (como no n8n).
- Os ramos "sim" e "não" de um "se" que terminam no mesmo bloco o chamam uma vez só (só um dos ramos roda).
- Condições e portas são avaliadas sob demanda, uma vez por conferência; "se" sem condição ligada é erro.
- "NÃO for o mestre" é "NÃO `tokenDeJogador`" (o token da vez sem jogador controlando é do mestre).
- Esperas guardadas no formato do AU1 (pelo caminho da árvore) caem ao carregar; o relógio dos fluxos já recomeçava na conversão do AU1.
- Limites: 120 nós, 300 fios, 2000 nós percorridos por disparo.
- Copiar e colar leva os fios entre os nós copiados, e cola 36 px adiante a cada vez.
- A mesa de eventos mostra o nome do gatilho de botão (não o da automação); padrão âmbar e chama. O mestre vê todas as automações de botão (as desligadas apagadas, que ele ainda pode disparar, como no chip); o jogador vê só as liberadas, por um botão na barra de cima, e a definição nunca chega a ele.
- A mesa de eventos em faixa fica logo acima da faixa do som; o zoom e os avisos sobem pela variável `--faixa-dos-eventos`.
- Na janela do editor se escolhe o som entre os que já estão na mesa; adicionar um som novo é pela mesa de som (como no AU1).
- "Ligar a…" é um botão acima do nó escolhido, para o teclado; o painel da direita traz os campos.
- O "+ automação para esta zona" abre a janela do editor com o gatilho na pergunta `?g=` do endereço.

### O que ficou para depois
Minimapa; arrastar um fio solto para o vazio e criar o nó ali; inverter o arrasto (de uma entrada para uma saída); colar nós entre automações; sons novos dentro da janela do editor; histórico de execuções.

## FG1 — como ficou (2026-11-20): luz e fogo

O Vilella usou a mesa e pediu: o modelo de luz ao vivo, uma área de soltar a tocha maior, a tocha no lugar do ícone do suporte, tudo em tamanho de mundo, fogo animado no inflamável (com tamanho controlável), animações por estágio (padrão e as dele) e o jogador dando equipamento a si mesmo.

**O que foi feito**
- **Modelo ao vivo.** Editar um modelo (nome, luz plena e penumbra, cor, tremular, duração, ocupa a mão, etiquetas, tamanho e animações da chama) muda na hora TODOS os objetos dele (mãos, mochilas, suportes, pontos e mapa), para todos (`modelo.editar` emite também `fonte.editada` de cada objeto e manda snapshot a todos). O que é do objeto fica: aceso, tempo que resta, portador, intensidade, modificadores, histórico e o tamanho próprio do inflamável. Duração nova menor que o tempo que resta: o restante vira a duração nova e, se está acesa, a contagem recomeça agora; duração maior não devolve tempo; "não se consome" tira o saldo; voltar a ter duração dá o saldo cheio. O texto "Mudar o modelo não muda os objetos que já existem" saiu. Os modificadores de automação e de zona continuam por cima.
- **Área de soltar.** A tocha arrastada pega o suporte ou inflamável mais próximo dentro de 1 célula de raio (no mínimo 40 px na tela); o alvo é destacado durante o arrasto. O ícone continua pequeno.
- **A tocha no lugar do suporte.** O objeto num ponto é desenhado no centro do ponto, no lugar do ícone (que some enquanto ele está lá e volta quando sai). Com mais de um objeto no mesmo suporte, ficam lado a lado, centrados.
- **Tamanho de mundo.** Os ícones de suporte e de inflamável (0,2 célula de raio), a tocha e a chama (em metros) escalam com o zoom do mapa. O relógio e os rótulos continuam em tamanho de tela e somem abaixo de 70% de zoom. A área de toque nunca fica menor que 20 px (15 px no ícone do ponto).
- **Chama animada.** Inflamável aceso e tocha num ponto mostram um fogo crepitante (visto de cima, achatado, um pouco dimétrico), nunca o símbolo da tocha. Estágios forte, fraca e morrendo; estilo de tocha (quem ocupa a mão) e de fogueira (o resto). As animações padrão são geradas por código no navegador (canvas 2D, `apps/web/src/mapa/chamas.ts`): nada de arquivo de terceiros nem da internet. A tocha na mão continua sendo o pino do token.
- **Animação própria por estágio.** No editor do modelo, cada estágio escolhe "Padrão" ou "Arquivo": um gif, webp animado ou apng já enviado (ou novo). O arquivo é um asset novo, `animacao` (até 4 MB, sem processar), com o caminho das imagens de hoje: hash, cache, pasta da mesa e transferência sob demanda; o navegador decodifica com o `ImageDecoder` (sem dependência) e toca em laço.
- **Tamanho da chama do inflamável.** Por alças no mapa (oito, esticando a partir do centro, Shift no canto mantém a proporção) e por campos no painel do ponto ("Chama: largura" e "altura"); "Usar o tamanho do modelo" volta ao padrão. O modelo tem o tamanho padrão (tocha 0,6 × 0,8 m, fogueira 1,2 × 1,2 m). A luz (raios) continua a do modelo.
- **Jogador dá equipamento.** Capacidade nova `equipamento.dar` ("Dar e tirar equipamentos de luz dos próprios personagens"), delegável e **ligada por padrão**. Vale para `ficha.alterar` (subir a quantidade de item de modelo) e para `mochila.ajustar`, só no personagem que o jogador edita ou controla. O mestre pode desligá-la nas Permissões (ou por jogador).
- **Cor alinhada** no editor do modelo (a cor ficou na mesma linha do "Tremular").
- **Setinha no item de modelo da ficha** (pedido extra do Vilella): recolhe e expande o peso, a nota e as unidades usadas.

**Decisões (assumido)**
- O estilo da chama padrão vem de `ocupaMao`: quem se segura na mão é tocha; o resto é fogueira.
- A tocha na mão ficou como o pino do token (a chama animada vale para o que está num ponto).
- O nome de um objeto só acompanha o do modelo se ainda era igual ao nome antigo do modelo.
- A área de soltar vale para o ponto mais próximo; tocha acesa solta sobre inflamável já aceso continua dando o aviso "Já há fogo aí".
- A setinha da ficha: padrão **aberto**, lembrada por navegador e por item (`tabletop:pref:itensRecolhidos`, chave `personagem:modelo`).
- "Reduzir movimento": a chama fica no primeiro quadro, parada.
- Animação própria: no máximo 48 quadros e 160 px no lado maior; mais que isso é reduzido.
- O login no portal Távola (e não por mesa) é decisão do Vilella, a pensar depois (ver `IDEIAS.md`).

**O que ficou para depois**
- "A luz acompanha o tamanho da chama" (`IDEIAS.md`).
- Chama animada no pino da tocha na mão.
- Prévia da animação no editor do modelo.

## CH2 — como ficou (2026-11-20)

**O que foi feito**
- A grade da chamada passou a caber sempre, sem rolagem: o tamanho de cada quadro 16:9 vem de `calcularGrade` (`chamada/grade.ts`) e é medido em `GradeDeQuadros.tsx`. Mais de 9 quadros viram páginas.
- Barra de baixo, lista lateral e rótulos do volume mais enxutos; o quadro da trilha se adapta à medida.

**Decisões (assumido)**
- A trilha conta como um quadro e fica por último. O aviso de quem fala numa página escondida é um ponto verde na seta.
- Barra de baixo de 56 px com botões de 42 px; lista lateral de 232 px.

**O que ficou para depois**
- A lista lateral de pessoas rola por dentro com mais de uns 10 nomes.

## AS1 — como ficou (2026-11-20): assets da mesa e segurança dos arquivos

O Vilella pediu: soltar imagem ou gif na cena, uma lista "Assets da mesa", o upload do jogador indo para ela, a pasta do mestre organizada e o carregar do próprio computador. E perguntou se um jogador consegue pôr vírus no PC do mestre por um png.

**O que foi feito**
- **Soltar no mapa.** Imagem (png, jpg, webp, gif, apng) solta no mapa vira uma **imagem solta na cena**, no ponto do soltar e na camada ativa (mestre: a de trabalho; jogador: tokens). Até 10 por vez. É um token sem ficha (`Token.imagem`: largura e altura em metros, giro em graus, `por`), então herda camadas, ocultar, o filtro do jogador, copiar, apagar com desfazer e a exportação, sem coleção nova nem migração.
- **Mover, esticar, girar, apagar.** Arrastar move (livre, sem encaixe nem parede). Alças na imagem selecionada: canto de baixo estica (proporcional; Shift solta), círculo de cima gira (Shift: de 15 em 15 graus). O painel do mestre tem largura e altura em quadrados, "manter proporção", giro, camada, ocultar e apagar. O gif, apng e webp animado tocam em laço (parados com "reduzir movimento").
- **Regra de "soltei, o que acontece".** Dungeondraft (`.dd2vtt`...) em qualquer lugar da mesa: importa o mapa, como antes. Imagem ou animação no mapa: imagem solta. Outro arquivo no mapa: recusado com aviso. Fora do mapa: nada. A caixa do Claude não recebe arrasto (o Claude manda pelo `arquivos`).
- **Assets da mesa.** Seção nova na aba Mesa (para o jogador, "Arquivos da mesa" em Preferências): todos os arquivos, miniatura, tipo, tamanho, quem enviou, onde é usado e se está neste computador; filtro por tipo e por quem enviou, busca, ordem por nome, mais novos ou tamanho; arrastar para o mapa; pôr na cena, renomear (nome de exibição), baixar, apagar (em uso avisa o que sai, com desfazer) e, nos sons, "pôr na mesa de som" e "adicionar à biblioteca de música".
- **Visão do jogador.** A sala monta a lista dele (`assets.listar`): só o que ele enviou e o que está em uso numa coisa que ele vê. Nada de mapa escondido, som do mestre, zona, automação ou luz.
- **Pasta organizada.** `assets/<quem enviou>/<tipo>/<nome>-<hash8>.<ext>`; migração leve (copia, não move); `arquivos-da-mesa/<hash>` e `recebidos/` ficam como estão. Os novos de jogador não vão mais para `recebidos/`.
- **De onde carregar.** Cache, depois a pasta (só o mestre), depois a rede. Medido (ver `ESTADO.md`). Não reabre o arquivo original do disco do jogador (motivos em `PROJETO.md` 4.17).
- **Segurança.** Tipo pelos bytes (lista fechada, apng incluído), conferência de novo por quem recebe, nome no disco montado pelo Távola (extensão do tipo detectado, nome limpo, nunca extensão executável), imagem de outra pessoa decodificada e regravada pelo navegador do mestre, limites por tipo. Testes de unidade para cada regra.
- **MCP.** `arquivos`: `listar` (tipo, quem enviou, onde é usado), `uso: "imagem"` em `enviar` e `usar`, `ajustar`, `renomear` e `apagar`. Paridade e paridade por campo passam.

**Decisões (assumido)**
- A imagem solta é um token (e não uma coleção nova): menos código, nenhuma migração, e tudo o que já vale para token vale para ela. Custo: ela entra na contagem de tokens da cena; o botão direito do mestre nela abre o painel da imagem (nada de iniciativa, vida ou condições).
- Capacidade nova `imagem.colocar`, **desligada por padrão**: o jogador não põe imagem na cena sem o mestre liberar. Teto de 20 imagens por jogador por cena.
- Tamanho inicial: o natural do arquivo (px ÷ px por quadrado da cena), entre 1 e 8 quadrados no lado maior.
- Imagem parada entra como asset `imagem` (WebP de até 2048 px); gif, apng e webp animado entram como `animacao` (como vieram, até 4 MB). Animada solta na cena: no máximo 40 quadros e 384 px (o resto é reduzido na tela, não no arquivo).
- Nome de exibição do asset mora em `AssetMeta.nomeExibicao` (só o mestre muda); o nome original e o hash não mudam.
- Apagar em uso tira a imagem dos lugares (imagens soltas somem; mapas, retratos e handouts ficam sem imagem). Os bytes nunca são apagados do disco do mestre. O desfazer traz o arquivo, não os usos.
- Gif e apng animados de outra pessoa ficam como vieram na pasta (só a assinatura é conferida); imagem parada é regravada.
- A cópia crua em `arquivos-da-mesa/<hash>` continua (é o que outro navegador do mesmo computador lê), mas só depois de conferida a assinatura.

**O que ficou para depois**
- Arrastar um som da lista direto para a biblioteca de música (hoje há o botão; arrastar para o mapa põe no primeiro ambiente livre).
- O Claude de um jogador listar os assets dele (hoje só o mestre lista, renomeia e apaga).
- Mover os arquivos antigos de `recebidos/` para `assets/` (hoje só se copia).
- Miniaturas de mapas em pedaços e de sons (ícone do tipo).

## AU3 — como ficou (2026-11-20): portas lógicas viram caixas e o tour do centro de automações

O Vilella testou o AU2: "as portas lógicas estão um pouco diferentes do que eu imaginei. Imaginei elas mais como uma caixa onde eu posso colocar as coisas dentro pra fazer as lógicas. Eu também gostaria de colocar o quando dentro das portas, por exemplo, a cada relógio ou ao apertar o botão, coisa x acontece... também acho que deve haver um tour pelo centro de automações [...] e fazer uma automação simples das tochas terem 30% de chance de apagarem a cada 3 minutos." Ele escolheu a caixa solta na grade e, depois, corrigiu o desenho com a referência do Scratch: "uma caixa com dois espaços, um em cima do outro e um 'ou' ou 'e' entre elas. Dentro de cada espaço eu posso colocar uma segunda porta lógica ou alguma ação, condição, quando"; e ajustou: "pode ser dois como default, mas ter uma opção de ir aumentando (um botão + ou arrastando algo além ali pra dentro). Acho importante conseguir colocar portas dentro de portas também."

### O que foi feito
- **As portas viraram caixas** (`fluxos.ts`, `fluxosCaixas.ts`): E, OU e NÃO são nós `caixa` na grade. E e OU nascem com **dois espaços** empilhados, com o rótulo "E" ou "OU" entre cada par (clicar troca a caixa inteira); o NÃO tem um. Cada espaço guarda **uma peça**: gatilho, condição, ação ou outra caixa (até 4 níveis). O espaço vazio mostra a dica e acende ao arrastar por cima.
- **Cresce e encolhe:** o "+" no pé acrescenta um espaço; soltar entre dois espaços (ou logo abaixo do último) abre um novo ali, marcado no arrasto; tirar a peça de um espaço, numa caixa com mais de 2, remove o espaço; um espaço vazio a mais tem "×"; o mínimo é 2 e o máximo 12.
- **A saída vem do que está dentro:** gatilho OU gatilho (o "quando dentro da porta") e gatilho E condição dão saída de ordem; condições (E, OU, NÃO) dão saída de valor, ligada ao "se" ou a outra caixa; ação E ação faz as duas, ação OU ação sorteia uma (50/50 com duas), e essa caixa fica no fluxo com entrada e saída de ordem, como um bloco de ação.
- **Recusa ao soltar**, com dica curta (`motivoDaRecusa`): gatilho E gatilho, gatilho OU condição, NÃO com gatilho ou ação, ação misturada, espaço ocupado, outro bloco de fluxo, caixa dentro dela mesma. Erros no próprio bloco: caixa vazia, espaço sem peça, NÃO vazio e caixa sem saída ligada.
- **Atalho** de soltar um gatilho em cima de outro (cria uma caixa OU); **teclado:** menu "Caixa…" (tirar, pôr num espaço, subir e descer de espaço), Alt + seta para cima ou para baixo, e o rótulo e o "+" são botões.
- **Conversão** (`portasParaCaixas`): as portas do AU2 viram caixas com as peças nos espaços (A ou B ou C é uma caixa OU com 3 espaços, sem aninhar à força); vários gatilhos ligados aos mesmos blocos viram uma caixa OU; posições arrumadas (`organizarGrafo` conta a altura da caixa). Os formatos antigos continuam convertendo e o ouro bate.
- **A frase** descreve as caixas ("Quando qualquer um destes acontecer (…)", "…, mas só se …", "(NÃO a) e b", "sorteia uma destas: (a) ou (b)").
- **O tour do centro de automações** (`TourDasAutomacoes.tsx`, `passosDoTour.ts`): na primeira vez que se abre o centro e pelo botão "Conhecer as automações" (no centro e no editor); passa por cada tipo de peça (as caixas num passo só e curto, desde o AU3c), mostra a mesa de eventos e o "Liberar aos jogadores" e monta com a pessoa "as tochas têm 30% de chance de apagar a cada 3 minutos", com seta, destaque e "Fazer este passo por mim"; no fim a automação fica salva desligada, com "Ligar agora" e "Apagar o exemplo".
- **MCP:** monta as caixas por nome, com `em` (o nome da caixa) e `espaco` (ou na ordem em que as peças aparecem) e `config.espacos`; `explicar` lê as caixas aninhadas; o `guia` explica os espaços e as combinações; `paridadeCampos` passa.

### Decisões (assumido)
- A caixa nasce com 2 espaços e vai até 12; até 4 níveis de caixa dentro de caixa. Ação OU ação sorteia por igual (50/50 com duas).
- A caixa não tem entrada, exceto a de ação (entrada e saída de ordem). A caixa vazia conta como de valor.
- A ordem é a dos espaços (`espaco`); apagar a caixa apaga o que está dentro; a peça guardada não anda pela grade.
- Dentro de uma caixa só entram gatilho, condição, ação, sinal e outra caixa; "esperar", "se", "sortear" e "para cada" ficam na grade.
- O tipo `porta` deixou de existir no esquema: o `preprocess` converte ao ler. A marca `caixas: true` impede reagrupar gatilhos soltos de propósito.
- O tour: marca `tabletop:pref:tourDasAutomacoes` no navegador (nunca vai à sala); abre sozinho só com conta; o exemplo só se monta numa automação nova e vazia; no centro, o último passo abre o editor com `?tour=1`. O exemplo fica desligado, com o nome "As tochas apagam (exemplo do tour)".

### O que ficou para depois
Minimapa do editor (continua em `IDEIAS.md`); copiar uma caixa com o que tem dentro entre automações; arrastar uma condição direto para o "Se"; reabrir o tour num editor "nova" que já estava aberto.

## AU4 — como ficou (2026-11-21): "Cena ativa" em "Cenas onde vale"

### O que foi feito
`naCenaAtiva?: boolean` no fluxo; `escopoDoFluxo` soma `cenaAtivaId` à lista; caixa "Cena ativa" no painel; frase "na cena ativa"; campo no MCP (`automacoes`, `paridadeCampos.ts`). Testes de unidade (escopo, troca de cena, união, evento de outra cena, frase, schema) e `au4.spec.ts`.

### Decisões (assumido)
- Com cenas marcadas vale a união: a ativa mais as marcadas.
- O escopo é calculado no disparo e fica no contexto: depois de um "esperar" continua o mesmo.
- A interseção com as cenas do evento segue igual: evento numa cena que não é a ativa não dispara um fluxo que só vale na ativa.
- Segunda linha da caixa: "onde o grupo está agora".

### O que ficou para depois
A condição "cena", o gatilho "cena" e o tour (fora do lote).

## CH3 — como ficou (2026-11-20): tela de entrar enxuta, desfoque em três níveis, gravar e transcrever

O Vilella pediu: os botões de entrar largos demais (a coluna inteira esticada), a prévia da câmera maior, o desfoque com "o pouco" (só havia o forte) e "cadê a opção do mestre gravar pro whisper?". Os prints dele mostraram os botões na largura toda e a barra de baixo da chamada.

**O que foi feito**
- **A tela de entrar** virou um bloco só, centrado (máx. 720 px), com a prévia 16:9 como maior elemento; câmera, microfone e fundo na mesma linha, alinhados; "Entrar na chamada" e "Entrar só ouvindo" com a largura do texto.
- **O desfoque**: Desligado, Leve e Forte. `SeletorSegmentado` antes de entrar; na chamada, o botão do fundo abre um menu com os três e mostra a letra do nível no ícone; o B passa ao próximo.
- **A gravação** (parte B): o mestre liga pelo botão da chamada (com confirmação), todos veem o aviso (também antes de entrar), cada um tira a própria voz, o navegador do mestre grava só a fala em WAV de 16 kHz na pasta da mesa, mais `gravacao.json`, `nomes.txt` e `eventos.jsonl`. `pnpm transcrever` junta, roda o whisper.cpp e escreve `transcricao.md` e `transcricao.json`. A aba Mesa lista as gravações, traz a transcrição para uma nota só do mestre e pergunta se apaga o áudio. `docs/WHISPER.md` é o passo a passo de instalação.

**Decisões (assumido)**
- Os níveis do desfoque: **Leve 2,5 px e Forte 7 px**. "Forte é o de hoje" foi lido como o que o botão da barra dava (7 px); o antigo "Desfocar forte" de 16 px saiu. O protocolo e as preferências guardam `desfocar` (Leve) e `forte`, sem mudança de formato.
- A largura máxima do bloco de entrar é de 720 px; a prévia tem a largura que a altura da janela deixa (`100dvh - 388px`), no máximo a do bloco.
- A pessoa que **marca "Não gravar a minha voz" antes de entrar** já entra de fora (o `chamada.entrar` leva `naoGravar`): o brief diz que quem entra depois começa gravado, mas sem isso haveria um instante em que a voz de quem quis ficar de fora seria gravada. Quem não marcou começa gravado.
- A fala mínima de 0,5 s conta a **fala**, sem as folgas (com 300 ms de cada lado o trecho nunca teria menos que 0,6 s).
- O início do trecho no nome do arquivo conta desde que a gravação começou, a partir de quando a voz dessa pessoa foi ligada (o detector de cada voz nasce quando ela entra).
- Um arquivo WAV por pessoa para o whisper, com 1 s de silêncio entre os trechos (e o mapa de deslocamentos), e não vários `-f` numa execução: o whisper gasta o mesmo tempo num trecho de 2 s e num de 30 s, então emendar é bem mais rápido. A volta à hora da sessão fica presa ao trecho de onde o segmento começa.
- A nota da transcrição é só do mestre (`visivel: mestre`); o "rascunho" do pedido é isto: a sala só carimba `rascunho` o que o Claude cria. Uma sessão acima dos 20 mil caracteres da nota vira partes.
- O Claude **lê a nota pelo `ler`** (tipo handout) e escreve o resumo pelo `notas`; o brief dizia "lida pelo `notas`", mas a leitura do texto inteiro é do `ler`. As instruções do servidor e a descrição de `notas` dizem isso.
- A gravação para quando o mestre sai da chamada (fechar a janela, recarregar, sair, ou ser substituído por outra janela): o aviso some para todos.
- O estado da gravação é o `gravando` do mestre mais o `naoGravar` de cada um nos `participantes` de `chamada.quem`; não há campo novo no estado nem migração.
- `gravacoes/` fica fora da biblioteca de sons e de imagens da pasta.

**O que ficou para depois**
- Testar com o whisper.cpp de verdade e com fala de verdade (ver o roteiro do CH3).
- Legendas ao vivo, e gravar a chamada de vídeo (só o áudio é gravado, e só a fala).
- Escolher, antes de gravar, quem entra na gravação (hoje é cada um que sai).
- Gravar quando o mestre usa a chamada em duas janelas ao mesmo tempo (a última que liga vale).

## FG2 — como ficou (2026-11-20): fogo melhor, tocha na mão, cor da luz do mestre e som solto

O Vilella usou o FG1 e pediu: a fogueira sem gravetos e como um fogo só; a tocha no suporte sem "se dividir em dois"; a tocha do jogador com os 3 estágios; o mestre vendo a mesma cor de luz que o jogador; o token do Vashta que o mestre não conseguia mexer; e som arrastado para a mesa indo para a biblioteca de música.

**O que foi feito**
- **Fogueira.** `montarQuadro` (`chamas.ts`) separa a geometria do desenho. A fogueira é uma massa: cama de brasas larga e brilhante, um corpo e línguas que se sobrepõem (cada uma cobre mais que o espaço até a vizinha, então esticada continua uma massa), núcleo claro e brasas que sobem por dentro. Sem achas, gravetos ou pedras (são itens da camada de mapa). O halo do chão não passa mais do quadro (antes deixava uma borda reta fraca embaixo).
- **Tocha "dividida".** A causa: cada língua tinha o próprio balanço (sinal contrário nos dois lados) e a do meio era mais baixa; no quadro certo as pontas de fora se afastavam e a silhueta virava dois bicos. Agora há um corpo e duas ou três línguas coladas nele, com um vento só, e as brasas ficam por dentro do corpo. Teste de unidade: em cada um dos 16 quadros, de cada estilo e estágio, a silhueta (união dos contornos) é uma região conexa e toda brasa está dentro dela; teste E2E: o mesmo conferido nos pixels reais das folhas (alfa acima de 90), pelo gancho `regioesDaChama`.
- **Tocha na mão.** O pino do token mostra a chama animada (sprite da `ChamasDoMapa`, no tamanho do pino, passando um pouco do alto dele) nos três estágios, com o gif próprio do estágio quando há. Só a fonte com fogo (a que tremula: tocha; lanterna não) e acesa; apagada ou sem fogo, o ícone de antes. O estágio do jogador no tempo "exato" não vinha da sala (só `restanteMs`): agora a tela calcula pelo tempo restante e pela configuração dos estágios (opção nova `estagioDe`); o objeto num ponto passou a usar o mesmo estágio (antes ficava sempre "forte" para o jogador no tempo exato).
- **Cor da luz do mestre.** A causa: a Visão do mestre (`noturna`) só pintava "visto claro, resto apagado" e nunca desenhava as luzes. Agora o `noturna` roda o mesmo caminho do jogador (luz, cor, penumbra) e só a composição muda; a tremulação fica só com o jogador (no mestre custava o dobro com 48 chamas): onde algum jogador vê, a luz dele; no resto, o cinza apagado de antes. A visão no escuro soma meia luz só onde nenhuma luz chega (senão a de um jogador lavava a cor do mestre).
- **O token que o mestre não movia.** A causa **era o pino da tocha cobrindo o token com o mapa afastado**, e não o modelo ao vivo: o pino tem tamanho mínimo de tela (9 px) e fica a 90% do raio do token; com o token pequeno (zoom baixo) ele cobria o meio, o clique no token virava o arrasto da tocha (que não leva a lugar nenhum) e o token não andava. Recarregar a página funcionou porque a vista voltava a um zoom maior. Agora o pino fica sempre fora do miolo (metade do raio na tela) do token. Reproduzido antes de corrigir (E2E, `fg2.spec.ts`: falhava no primeiro arrasto com zoom 0,3).
- **Som arrastado.** Mp3, ogg e wav soltos em qualquer lugar da mesa entram na biblioteca de música (nome do arquivo, sem etiquetas; até 50 por vez), com o aviso e o botão "Abrir a biblioteca"; o jogador recebe "Só o mestre põe música na mesa." Da lista "Assets da mesa", arrastar um som para o mapa também põe na biblioteca (o botão "Pôr na mesa de som" ficou). Regra pura em `som/soltarSom.ts`.

**Decisões (assumido)**
- A chama da mão só aparece para fonte que tremula (assumido: a lanterna, que não tremula, não tem fogo e mantém o ícone).
- A chama da mão fica dentro do pino do token (que é o clique do menu e o arrasto da tocha); ela passa um pouco do alto do pino. O tamanho segue o pino (que segue o token entre 9 e 15 px de raio na tela).
- Na Visão do mestre, onde nenhum jogador vê o mapa fica apagado (45%) com a cor de toda luz somada por cima (0,55 da luz tingida); onde um jogador vê, vale a luz dele. A Visão do mestre vale também sem jogador na cena.
- A fogueira esticada muito (por exemplo 4,5 × 2,4 m) fica achatada e larga, como um monte de fogo; é a mesma imagem esticada.
- A decisão do E2E de cor: a Brisa (sem visão no escuro) é a jogadora comparada, porque a visão no escuro da outra "lava" o tom também para ela.
- O som solto vale em qualquer lugar da janela (não só no mapa); o jogador que solta é avisado em vez de ficar sem resposta.

**O que ficou para depois**
- A fogueira desenhada na proporção da chama esticada (hoje é uma imagem esticada).
- Prévia da chama no editor do modelo.
