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
- Mudar o tema na mesa depois de a janela da ficha abrir só vale na janela da ficha na próxima carga (a aparência da ficha já ouve o `storage`).

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
- **Arrastar a ficha para o mapa**: o jogador arrasta o item que pode pôr; durante o arrasto a área se acende num círculo suave na cor do acento. Soltar dentro cria o token ali, encaixado no grid; fora mostra "Ponha o token perto da bandeira (o ponto de chegada)." e não cria nada. O mestre segue soltando em qualquer lugar.
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

## Em aberto

- **O plano R1 a R6 terminou** (R1, R2, R2b, R3, R4 em 2026-11-10; R5a, R5b, R6a e R6b em 2026-11-11). Agora o Vilella faz os ajustes
  finos de UX/UI e a reorganização dos itens, a partir de `docs/PASSAGEM.md`.
- Itens de interface que sobram: seleção múltipla no mapa (ainda não existe), toque (celular) e navegadores além do Chrome, "Entregar" a
  tocha só por arrastar. A dica das condições por clique e as alças de tocha sobre o ícone de ponto foram resolvidas no R5a.
