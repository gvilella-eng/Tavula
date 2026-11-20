# Passagem para o Vilella

Mapa de partida para os ajustes finos de UX/UI, a revisão das "atenções" e a reorganização da interface.
Tudo o que está em aberto, num lugar só, com ponteiro para a fonte. Nada aqui é novo: se o item não tem
ponteiro, não entrou. Onde a fonte é ambígua ou os docs se contradizem, o item diz isso.

Ponteiros: `REDESIGN` = `docs/REDESIGN.md`, `PERGUNTAS` = `docs/PERGUNTAS.md`, `ESTADO` = `docs/ESTADO.md`,
`PROJETO` = `PROJETO.md` (na raiz), `IDEIAS` = `docs/IDEIAS.md`. Número depois dos dois-pontos é a linha.

Estado dos docs em 2026-11-11: **o redesign R1 a R6 terminou.** Estão entregues o R1 (fundação visual e marca), R2 (estrutura
fixa), R2b (pausa automática e 11 temas; 14 desde o V1), R3 (janelas flutuantes), R4 (organização do mestre), R5a (interações no mapa e nos
tokens), R5b (combate, fichas, compêndio e PDF), R6a (teclado, dicas com atalho, foco e contraste) e R6b (tela pequena, frágeis
restantes, transições e revisão final). O **V1** (temas com personalidade, aba Mesa no fim e zerar o relógio, 2026-11-11), o **V2** (ordem de turno simples, 2026-11-11) o **V3** (fichas em árvore e handouts, a aba Notas sai, topo e abas iguais, 2026-11-11) e o **V3b** (dicas enxutas, 2026-11-11) estão entregues (`REDESIGN`, "V1", "V2", "V3" e "V3b"). O que vem agora são os **seus ajustes finos de UX/UI** a partir deste arquivo (fim do
`ESTADO`, "Próximo"), depois o 7b e o 12.

**O que sobrou de interface (resumo; os detalhes estão nas seções 4, 5 e 7):**
- Toque (celular) nunca foi testado: arrastar janelas, alça da tocha, dicas e menus só valem com mouse e teclado.
- Dicas (V3b): só em botão sem nome à vista, uma linha, 700 ms no mouse (na hora no teclado), opção `tabletop:pref:dicas` em Preferências. `Dica.tsx` (`useDica`: atraso e troca), `BotaoComDica.tsx` (`nomeVisivel`, `dicaSe`, `motivo`), `dicasLigadas.ts`. As explicações que saíram das dicas estão em `textosDoTour.ts`, que o tour (`tour/Tour.tsx`, `tour/passos.ts`, lote T) lê.
- Só o Chrome foi testado (Firefox e Safari não: arrasto de item, WebP, OPFS, pasta local).
- Seleção múltipla no mapa não existe.
- "Entregar" a tocha só por arrastar a alça até outro token (o menu do token não tem "Entregar").
- Selecionar um token só pelo teclado não existe (o Shift+F10 parte de um token já selecionado).
- Em 1280×720, ordem de turno, ficha e painel do token só cabem juntos porque o painel do token vai para a coluna da direita e a
  ordem fica mais baixa (com rolagem); telas menores que isso não foram vistas.
- Fora do plano: automações do 7b e o MCP do 12 (seção 7).

## 1. Como subir a mesa para olhar

- `pnpm dev` na raiz sobe a sala (wrangler, `127.0.0.1:8787`) e a web (Vite, `127.0.0.1:5173`). Abra
  `http://127.0.0.1:5173`. Fica rodando no terminal enquanto se joga (`PROJETO:787-790`, `ESTADO:23-40`).
- **C1 (2026-11-12):** a mesa agora é `/m/<id>`; a tela inicial `/` lista as mesas. O id da campanha de sempre aparece lá (cartão "Campanha"). Reinicie o `pnpm dev` depois do C1.
- O banco da campanha fica em `apps/server/.wrangler/state` (fora do git). **Apagar essa pasta zera a
  campanha** (`ESTADO:34`, `PROJETO:799`). O PROJETO escreve só `.wrangler/state`; o ESTADO dá o caminho
  completo.
- `pnpm verify` (typecheck, lint, unidade e E2E) usa portas próprias: sala `8788`, web `5174`, estado em
  `e2e/.estado-sala`, nunca a campanha real (`PROJETO:793-795`, `ESTADO:129-136`). `pnpm dev:e2e` sobe esses
  servidores à mão.
- Se uma porta estiver ocupada, o `pnpm dev` falha em vez de trocar de porta (`ESTADO:41-42`).
- Vários jogadores na mesma máquina: perfis diferentes do Chrome. Janela anônima da mesma sessão não vale
  (`PROJETO:796-798`).
- Não existe `README` na raiz; o que vale é o `PROJETO.md` (seção 6) e o "Como rodar" de cada lote no
  `ESTADO.md`.

## 2. Onde mexer na aparência

Tudo em `apps/web/src/`.

- `tema/temas.ts`: as cores dos **14 temas** (V1, 2026-11-11), na ordem do seletor: Grimório, Masmorra (id `escuro`, era o
  "Edgerunner"), Pergaminho (id `claro`), Edgerunner (id `edgerunner`, cyberpunk novo), Vampiro, Licantropo, Taverna, Forja,
  Paladino, Druida, Leviatã, Arcana, Élfico e Celestial (os dois claros novos); `REDESIGN`, "R2b" e "V1". É a **única fonte** dos
  tokens. `tema/temas.test.ts` confere que os 14 têm as mesmas chaves, o degradê do painel nos coeficientes e
  reprova par de texto e fundo abaixo de 4,5:1 (AA) (`REDESIGN:125-140`). O `index.html` repete as 14 cores de
  fundo de propósito (anti-piscada); o mesmo teste confere que são iguais às do `temas.ts`.
- `styles.css`: todo o resto do visual, usando as variáveis CSS dos tokens. Sobraram cores fixas só de
  conteúdo (texto preto ou branco no avatar e nas iniciais do token, escolhido pela cor em `contrasteDeCor.ts` desde o R6a; contorno do ponto da ordem de turno, fundo escuro das marcas do token e do olho cortado, roda de cores
  do pincel) (`REDESIGN:132-139`).
- `SeletorDeTema.tsx`: o seletor de bolinhas (aba Preferências, desde o R4; grupo de rádio, setas).
- `Logo.tsx`: símbolo SVG da mesa redonda com a chama, mais o nome em Space Grotesk. `../public/favicon.svg`:
  o favicon. Título da aba em `index.html`/`App.tsx`.
- `main.tsx`: importa as fontes (`@fontsource-variable/space-grotesk` e `inter`) e aplica o tema antes da
  primeira renderização.
- Componentes principais da tela:
  - `Mesa.tsx`: a mesa inteira, em quatro regiões fixas (topo, ferramentas, painel direito e a área do mapa no meio); tudo o que abre sobre o mapa vive dentro de `.area-mapa`. O CSS grid está em `.mesa` no `styles.css`.
  - `Topo.tsx`, `PresencaNoTopo.tsx`, `EstadoDaMesa.tsx`: o topo de 48 px (marca e cena, menus do mestre, avatares de presença com "+N", selo de pausa para o jogador (só o ícone e o amarelo; a dica diz se o mestre pausou ou saiu), botão e relógio do mestre; desde o V1 há ao lado do relógio o botão de seta "Opções do relógio", com "Zerar o relógio": o marco `relogio.marcoMs`, só do mestre).
  - `area.ts`: onde fica a área do mapa na página (`caixaDaArea`), para prender menus, dicas e janelas a ela. `larguraDoPainel.ts` e `preferencias.ts`: a largura do painel direito (300 px a 1/4 da janela, `tabletop:pref:larguraDoPainel`).
  - `mapa/Mapa.tsx`, `mapa/mapaPixi.ts`, `mapa/camadaDeLuz.ts`, `mapa/camadaDeDesenho.ts`: o mapa em PixiJS.
    **Não muda com o tema** (`REDESIGN:138-139`).
  - `MenuSuperior.tsx`: os menus do mestre em grupos (Cena, Mapa, Luz, Combate, Ver como; **desde o V3 sem rótulo desenhado**: o grupo vai na dica, "Luz · Visão do mestre", antiga Visão noturna), todos os botões com o mesmo tamanho e espaço, cada um com dica de uma linha no mouse (700 ms) e no foco, dentro do topo (a pausa e o relógio estão em `EstadoDaMesa.tsx`).
  - `BarraDeFerramentas.tsx`: barra fixa de 52 px à esquerda (selecionar, mão, régua, dados rápidos, pincel e, só do mestre, Paredes e portas, que liga o modo; o selo do modo está em `Mesa.tsx`); a sub-barra do pincel abre ao lado dela.
  - `BarraLateral.tsx`: painel direito de cima a baixo, recolhível, com abas de ícone e nome (todas da mesma largura; nome cortado com reticências e dica com o nome inteiro só quando cortado, V3 e V3b) e a alça de largura.
  - `abas.tsx`: `AbaPreferencias`, sete cartões recolhíveis com resumo (P1: Conta, Aparência, No mapa, Ajuda e arquivos, Conectar o Claude, Segurança, Atalhos), feitos com `SecaoDePreferencias.tsx` (`<details>`; o aberto/fechado fica em `tabletop:pref:secoes`). Controle novo de Preferências entra num cartão e o E2E o alcança com `abrirPreferencia(pagina, secao)` (`e2e/tests/ajudas.ts`): seção fechada esconde o controle. A `AbaNotas` saiu no V3.
  - `AbaChat.tsx`, `AbaFichas.tsx`, `AbaCompendio.tsx`: as abas de chat (com os modelos de rolagem), fichas
    (**árvore** de pastas, personagens, NPCs e handouts, V3; "+ Novo" único; menu de botão direito em `MenuDeContexto.tsx`) e compêndio de magias.
  - Handouts (V3): `JanelaDoHandout.tsx` (a janela, o campo de texto com rascunho e a miniatura da lista), `handouts.ts` (as 5 fontes e o `useJanelasDeHandout`), "Mostrar agora" em `Mesa.tsx` (escuta `handout.mostrado`). Estado: `Estado.handouts`, regras em `packages/shared/src/nucleo.ts`, migração das notas em `pastas.ts` (`migrarNotasParaHandouts`) e na migração SQL 9 de `armazenamento.ts`.
  - `ficha/BotaoImportarPdf.tsx`: o botão "Importar PDF" (seletor de arquivo + revisão), na aba Configurar da ficha; o V4 o reaproveita.
  - `AbaMesa.tsx` (a aba Mesa, só do mestre e, desde o V1, a última aba, depois de Preferências; desde o Q8 em cartões como as Preferências: Esta mesa, Regras, Luz, Automações, Pessoas, Campanha, Diagnóstico), `PainelDaMesa.tsx` (as seções de regras da mesa e de modelos de luz que ela usa) e `PainelDeIluminacao.tsx` (a janela de iluminação).
  - `PainelDoToken.tsx`: painel compacto do mestre para o token selecionado (canto inferior esquerdo da área do mapa). Desde o R5a só abre por "Editar token…" ou por dois cliques no token; selecionar só seleciona.
  - `NovoToken.tsx`: a janela "Novo token" (nome, cor, tamanho) e, depois dela, o modo de pôr o token com a prévia (a prévia e o clique estão em `mapa/mapaPixi.ts`; o selo e a ligação em `Mesa.tsx`).
  - `AvisoPerto.tsx`: o aviso de erro dentro da área do mapa, perto de onde a pessoa agiu (a origem é guardada em `useSala.ts`).
  - `janelas/Janela.tsx`, `janelas/pilha.ts`, `janelas/geometria.ts`: a janela flutuante comum (arrastar, minimizar, redimensionar, dentro da área, pilha). Posição e tamanho por janela em `tabletop:pref:janela:<id>` (`preferencias.ts`).
  - `OrdemDeTurno.tsx`: a ordem de turno (uma `Janela`), simples desde o V2 (270 px, layout de referência): cabeçalho só com título e ×, linha "Rodada: N", lista e rodapé do mestre (Turno anterior, Limpar, Ordenar, Próximo turno), menu de botão direito na linha, Alt+↑/↓. O jogador entra pela Iniciativa da ficha (`ficha/JanelaDaFicha.tsx`, `entrarNaOrdem`; `combate.entrar` na sala).
  - `FaixaDeCenas.tsx`: faixa de cenas, com prévia do mapa e menu de contexto.
  - `ConfigurarCena.tsx`: nome, mapa, pixels por quadrado e o grid da cena (visível e quadrado em metros).
  - `PainelDasParedes.tsx`, `PainelDeFontesDeLuz.tsx`: paredes e portas; fontes de luz. V14: o tipo de parede é a lista `ListaDeTiposDeParede.tsx` (rádios nativos; cores do traço em `ESTILO_DA_PAREDE`, exportado de `mapaPixi.ts`).
  - `condicoesIcones.ts` (V11): a tabela condição → ícone do lucide e o SVG do ícone (o mapa o rasteriza numa textura; o menu do token o mostra). A tocha na mão é uma marca no canto do token (`desenharAlcas`, `ancoraDaAlca`, `anelDaTocha` em `mapaPixi.ts`); as condições são `desenharMarcas` e `ajustarMarcasAoZoom`.
  - `MenuDoToken.tsx`, `MenuDaTocha.tsx`: menus de botão direito no token (Editar token…, "Entrar na iniciativa" (sem valor; o mestre escreve o número), grupo Tocha e as condições direto como itens de marcar) e na alça da
    tocha.
  - `SubBarraPincel.tsx`, `DadosRapidos.tsx`, `ZoomFlutuante.tsx`: sub-barra do pincel, grade de dados
    rápidos e controle de zoom no canto inferior direito da área do mapa.
  - `ficha/JanelaDaFicha.tsx` e as demais em `ficha/`: a janela da ficha 5e e a revisão da importação de PDF. Desde o V4a (refeito) a ficha é o desenho aprovado em `docs/desenho/`: `JanelaDaFicha.tsx` (cabeçalho, fitas, estreita por `ResizeObserver`), `AbaPrincipal.tsx` (Personagem, 3 colunas e acordeão; as peças são exportadas), `AbaMagias.tsx`, `AbaHistoria.tsx`, a Configurar (`EditorDoItem` mais a Aparência), `EditorDeAtaque.tsx` (a engrenagem), `conjurar.ts` (gasta o espaço, monta o pedido com `espaco` e o cartão do ícone) e `menuDeEspaco.tsx` (V6: `useConjurar`, o menu "Conjurar com espaço de:" e o `BotaoPingarMagia`), `modificadorExtra.tsx` (V4a3: botão direito / Shift+F10 nas linhas de perícia e salvaguarda), `rolador.ts`, `aparencia.ts` (Livro/Clássica, `localStorage`), `livro.tsx` (título, caixa, bolinha, acordeão), `ListaDeTitulos.tsx` (características), `PainelExtra.tsx` (condições, luz, recursos) e `ficha.css` (tudo sob `.fl-raiz`; a pele vem de `data-pele`). A janela usa `camadaAlta` e `cabecalhoMinimizado` da `Janela`.
  - `Avatar.tsx`, `MensagemDoChat.tsx`, `CartaoDeRolagem.tsx`, `CartaoDaMagia.tsx`: avatar com iniciais e
    cartões do chat.

## 3. Levantamento de usabilidade (22 itens)

Fonte: `REDESIGN:38-87`. Prioridade: A = atrapalha o jogo ou esconde função; B = confunde ou dá trabalho; C =
acabamento. Lote = o do plano (`REDESIGN:89-117`) que resolve o item. R1, R2, R3, R4, R5a, R5b, R6a e R6b foram entregues.

| # | Resumo | Classe | Lote |
|---|---|---|---|
| 1 | Sem estrutura fixa: menu, ferramentas e painéis flutuam sobre o mapa; em 1280×720 ordem de turno e ficha tomam quase a tela | A | R2 (entregue) |
| 2 | Ícones do menu superior sem nome e alguns enganam (copo = Iluminação, lua com clique direito escondido, raio "em breve") | A | R4 (entregue) |
| 3 | Abas do painel direito só com ícone; o nome só aparece depois de abrir | B | R2 (entregue) |
| 4 | Coisas no lugar errado: Notas em Fichas; Configurações mistura pessoal, regras e tocha; aba Mestre mistura papéis, grid, capacidades e "uso de hoje" | A | R4 (entregue) |
| 5 | Paredes escondidas (copo, Paredes e portas, tipo, cliques); nada mostra o modo ligado | A | R4 (entregue) |
| 6 | Modelos de tocha só aparecem rolando Configurações | B | R4 (entregue) |
| 7 | "+" cria "Novo token" no meio da vista sem perguntar nome nem lugar | B | R5a (entregue) |
| 8 | Esc não solta a seleção; painel do token cobre o mapa | B | R3 (painel, entregue: arrasta, minimiza e fecha) e R5a (Esc, e não abrir sozinho; entregue) |
| 9 | Tocha só por gestos sem explicação; alça e tempo pequenos | A | R5a (entregue) |
| 10 | Condições: muitos cliques; marcadores pequenos; regra só no mouse | B | R5a (entregue) |
| 11 | Régua some ao soltar | C | R5a (entregue) |
| 12 | Aviso (toast) no rodapé, longe do clique, some rápido | B | R5a (entregue) |
| 13 | Jogador sem token na cena vê tela preta sem explicação | A | R5a (entregue) |
| 14 | Ordem de turno do mestre: cinco linhas de controles; número reordena enquanto digita; "Rolar para todos" cinza sem motivo | B | R3 (janela, entregue) e R5b (controles; entregue) |
| 15 | Abrir a ficha exige dois cliques, sem dica | B | R5b (entregue) |
| 16 | Janela da ficha grande e fixa; em tela pequena cobre quase tudo | B | R3 (entregue) |
| 17 | Lista de presença ocupa 1/4 do painel do chat | B | R2 (entregue) |
| 18 | Compêndio: o mestre lê ajuda de JSON; falta "usar o exemplo" | B | R5b (entregue) |
| 19 | Importar PDF com dois caminhos de nomes diferentes; revisão longa (19 campos amarelos) | C | R5b (entregue) |
| 20 | Tela de entrada sem marca nem personalidade | B | R1 (entregue) |
| 21 | Pausa pouco visível: botão e relógio iguais pausado e rodando | B | R2 (entregue) |
| 22 | Nenhum atalho de teclado nas dicas | C | R6a (entregue) |

Classes: A = 6 (1, 2, 4, 5, 9, 13), B = 13, C = 3 (11, 19, 22). Desde o R5a, 7, 8, 9, 10, 11, 12 e 13 estão resolvidos; desde o R5b, 14, 15, 18 e 19. O 22 foi resolvido no R6a: os 22 itens estão entregues.

## 4. Perguntas e suposições esperando o "ok" dele

**Total: 47 abertos em `PERGUNTAS`** (43 até o R6b, mais 4 do V1) (47 numerados; o 9, o 21, o 24 e o 34 já estão resolvidos) (a seção "Respondidas em 2026-11-10" não entra, nem o item riscado do
nome). Mais **103 suposições "(assumido)"** (as 63 da parte B, mais as 12 do R5a, as 11 do R5b, as 8 do R6a e as 9 do R6b) que só aparecem no `ESTADO`/`REDESIGN` (parte B). Os que o texto
marca "(assumido)" valem até ele dizer o contrário.

### A. Em `PERGUNTAS.md` (47 numerados, 44 abertos)

Já vinham de antes
1. Camada mapa = imagem do mapa + objetos de cenário? (assumido) (`PERGUNTAS:13`)
2. Pincel: jogador apaga e seleciona só os próprios desenhos? Desenhar é delegável e ligado por padrão? (assumido) (`PERGUNTAS:14`)
3. Dados rápidos: coluna = quantidade? (assumido) (`PERGUNTAS:15`)
4. Visibilidade do item = pela pasta + editores? (assumido) (`PERGUNTAS:16`)
5. Compêndio: JSON local (direitos do Livro do Jogador; SRD é a alternativa livre)? (`PERGUNTAS:17`)
6. Tocha: apagada ocupa mão? Qualquer jogador no alcance tira do suporte? Entregar exige 1,5 m? (assumido) (`PERGUNTAS:18`). O mestre já entrega de longe (`PERGUNTAS:7`); a pergunta vale para o jogador.
7. Ícone de eventos (7b), desenho das automações e MCP (12) (`PERGUNTAS:21`). Adiados, ver seção 7.
8. "Lista de ajustes de interface que ele quer fazer" (`PERGUNTAS:23`). É o trabalho que ele está assumindo agora.

Lote 7
9. ~~Onde fica o botão de pausar e o relógio da sala~~: respondida pelo R2. Pausa e relógio estão no topo, à direita (selo "Pausada" para todos; botão e relógio do mestre) (`PERGUNTAS:30`, `REDESIGN:170`, `ESTADO:1683`). Não conta mais como aberta.
10. Estágios: forte > 50%, fraca ≤ 50%, morrendo ≤ 10% da duração (assumido; configurável) (`PERGUNTAS:31`)
11. Consumida some da mão e da coleção (assumido) (`PERGUNTAS:32`)
12. Semente: Tocha 5e 60 min 6+6 m; Lanterna 6 h 9+9 m; Fogueira infinita (`PERGUNTAS:33`)
13. `luz.apagar` (padrão desligado) = apagar luz de ponto; a própria tocha usa `tocha.acender` (`PERGUNTAS:34`)
14. Editar um modelo (ex.: Tocha) muda as tochas já acesas? (assumido: não) (`PERGUNTAS:36`)
15. Apagar com penalidade maior que o saldo consome a tocha (assumido) (`PERGUNTAS:37`)

Lote 8
16. O mestre vê todos os sussurros? (assumido: sim) (`PERGUNTAS:41`)
17. Chat fora da exportação da campanha? (assumido) (`PERGUNTAS:42`)
18. Seta para cima reenvia ou só traz a mensagem de volta? (assumido: só traz) (`PERGUNTAS:81`)
19. Retrato de quem fala pode ser visto por quem não vê a ficha? (assumido: sim, em mensagem pública) (`PERGUNTAS:82`)

Lote 9
20. Ficha completa de outro personagem só com `ficha.verOutras` (padrão desligado)? (assumido) (`PERGUNTAS:45`). **Inconsistência real**: a capacidade sumiu da tela do mestre (`AbaMesa.tsx`, `CAPACIDADES_NA_TELA`, "quem vê a ficha agora é a pasta"), mas ainda libera a ficha completa no código (`packages/shared/src/mapa.ts:81`). Decidir se sai de vez ou volta à tela.
21. ~~Ficha numa janela flutuante~~: já existe (`ficha/JanelaDaFicha.tsx`); arrastar e lembrar a posição por usuário entregue no R3 (`janelas/Janela.tsx`; `PERGUNTAS:46`). Não conta no total.
22. O jogador pode repor tochas na própria ficha? (assumido: só o mestre aumenta) (`PERGUNTAS:86`)
23. A importação da ficha deve ler também de dentro de `fichas/`? (assumido: arquivo escolhido) (`PERGUNTAS:87`)
24. ~~A janela da ficha deve lembrar a posição?~~ Respondida no R3: sim, por usuário, no navegador (`tabletop:pref:janela:ficha:<id>`; `PERGUNTAS:88`). Não conta no total.
25. Darion: conferir na ficha original Labareda Protetora 2/longo e Radiação do Amanhecer 1/curto (`PERGUNTAS:89`). Tochas e flechas já seguem o PDF.

Lote 10
26. Caixas de recurso do PDF sempre para revisão (assumido). Precisa de um 2º PDF de outro jogador (`PERGUNTAS:49`)
27. Guardar na ficha os espaços de magia e os dados de vida lidos do PDF, em vez de só conferir com a tabela das classes? (`PERGUNTAS:50`)
28. Todas as magias entram como preparadas (o PDF não diz quais estão): ok? (`PERGUNTAS:51`)

Lote 11
29. Empate de iniciativa: Destreza, depois PJ antes de NPC, depois nome (assumido) (`PERGUNTAS:55`)
30. O jogador da vez passa o próprio turno (assumido) (`PERGUNTAS:56`)
31. Condições no token, não no personagem (assumido) (`PERGUNTAS:57`)
32. "Adicionar selecionados" deveria aceitar vários tokens? (a seleção múltipla no mapa não existe) (`PERGUNTAS:58`)
33. O jogador pode refazer a própria iniciativa, ou só o mestre? (assumido: só o mestre) (`PERGUNTAS:59`)
34. ~~A dica das condições deveria abrir também por clique (tela de toque)?~~ Respondida no R5a: a regra abre por clique no marcador (`PERGUNTAS:60`). Não conta no total.
35. O nome da entrada na ordem de turno deve seguir a renomeação do token? (assumido: não) (`PERGUNTAS:61`)

Lote 13
36. Borracha apaga o desenho inteiro (assumido) (`PERGUNTAS:65`)
37. O jogador sem `desenho.criar` ainda pode apagar os próprios desenhos? (assumido: não) (`PERGUNTAS:66`)
38. As formas devem encaixar no grid? (assumido: não) (`PERGUNTAS:67`)
39. O arrasto de um desenho deve aparecer ao vivo para os outros? (assumido: não, só ao soltar) (`PERGUNTAS:68`)
40. Quer refazer, desfazer o apagar ou seleção múltipla de desenhos? (`PERGUNTAS:69`)
41. Espessura em metros (acompanha o mapa) em vez de pixels do mundo? (`PERGUNTAS:70`)

Lote 14
42. Compêndio distribuído como asset (o mestre tem o JSON, os jogadores recebem pelo caminho das imagens) (`PERGUNTAS:73`)
43. Quem manda no compêndio quando há dois mestres? Compêndio pessoal do jogador? (`PERGUNTAS:74`)
44. Avisar quando a classe do personagem não conjura a magia adicionada? (`PERGUNTAS:75`)
45. Mostrar as classes e o nome original na lista do compêndio? (`PERGUNTAS:76`)
46. Conversor de outros formatos; monstros e armas no mesmo arquivo ou em outro? (`PERGUNTAS:77`)
47. Conferir a tradução das 3 magias do exemplo do SRD (`PERGUNTAS:78`)

Fora da contagem, no mesmo arquivo: "A lista de presença ocupa muito espaço com 8 pessoas" (`PERGUNTAS:83`) era
o item 17 do levantamento (resolvido no R2: avatares no topo); "Sobreposição de alças e ícones de ponto" (`PERGUNTAS:38`) foi resolvida no R5a; "Ideias para o 7b" (`PERGUNTAS:62`) está na seção 7.

### B. Suposições "(assumido)" só no ESTADO/REDESIGN (85)

Não aparecem em `PERGUNTAS`. Resumidas; o texto completo está no ponteiro.

Lote 7 (`ESTADO:1094-1105`)
48. Modelo em uso não se apaga (`ESTADO:1104`)

Lote 8 (`ESTADO:1174-1183`)
49. O selo de não lidas não conta minhas mensagens nem o histórico presente ao abrir; `/?` só da tela (`ESTADO:1182`)
50. `/w` para si mesmo é permitido; teste com CD acerta com total ≥ CD (`ESTADO:1182`)

Lote 9 (`ESTADO:1243-1252`)
51. Meio-conjurador usa `ceil(nível/2)`, terço `ceil(nível/3)`; multiclasse soma o piso por classe; Guerreiro e Ladino só pelas subclasses (`ESTADO:1249`)
52. Acerto do ataque: valor fixo ou fórmula; sem acerto só rola o dano; descanso longo devolve metade dos dados de vida (`ESTADO:1250`)
53. Fixture do Darion: Patrulheiro (Caçador) 5 e Clérigo 5 (`ESTADO:1251`)

Lote 10 (`ESTADO:1322-1330`)
54. A subclasse vem do texto da classe ("Hunter Ranger 5" vira Patrulheiro, subclasse "Hunter"); termos em inglês ficam como estão (`ESTADO:1327`)
55. Moedas e os quatro campos de personalidade entram em `notas`; nome de característica em CAIXA ALTA vira título (`ESTADO:1328`)
56. Caixa de recurso: `atual` = número grande, `max` = "(MAX n)" ou "Total"; recarga "nunca"; repetidas descartadas (`ESTADO:1329`)

Lote 11 (`ESTADO:1395-1408`)
57. A entrada copia a Destreza da ficha (se preenchida); sem Destreza conta como a menor no desempate (`ESTADO:1397`)
58. A entrada guarda `jogador` (campo a mais em relação ao PROJETO) (`ESTADO:1398`)
59. Adicionar entradas reordena a lista; o arrasto à mão dura até o próximo valor rolado ou "Ordenar" (`ESTADO:1399`)
60. Rolagem de entrada com valor oculto ou escondida vai oculta, mesmo de PJ; entrada solta rola com bônus 0 e oculta (`ESTADO:1401`)
61. Tirar a entrada da vez passa o turno para a seguinte (`ESTADO:1402`)
62. Rodada 0 = "Não começou"; Anterior não volta antes da rodada 1 (`ESTADO:1403`)
63. Só uma seleção de token na mesa; acrescentado "O grupo" (`ESTADO:1404`)
64. Token de outra cena pode entrar na ordem; o jogador recebe só entradas da cena ativa (`ESTADO:1405`)
65. ~~Marcadores no mapa: duas letras e uma cor por condição~~: no V11 viraram ícones (4 e um "+N"); a regra segue só em dica com o mouse (`ESTADO:1406`; `REDESIGN`, "V11")
66. O mestre "vendo como" um jogador vê a ordem em só leitura e o menu do token fica desligado (`ESTADO:1407`)
67. Concentração mostra só o texto da regra; nenhum teste automático (`ESTADO:1408`)

Lote 13 (`ESTADO:1482-1494`)
68. O mestre desenha na cena que está vendo, não só na ativa (`ESTADO:1490`)
69. A camada "Desenho" do menu de camadas só escolhe a camada de trabalho; os desenhos aparecem sempre (`ESTADO:1492`)
70. O rascunho do autor aparece normal para ele e a 85% para os outros; a sala guarda até 16 traços abertos por conexão (`ESTADO:1494`)

Lote 14 (`ESTADO:1569-1584`)
71. O mestre lê o arquivo sozinho (ao conectar, pasta autorizada, "Recarregar") (`ESTADO:1571`)
72. Todos consultam o compêndio, mesmo sem `asset.subir`; só o mestre define (`ESTADO:1572`)
73. `compendio.definir` usa a capacidade `mesa.configurar` (`ESTADO:1575`)
74. Arquivo com nome de magia repetido (sem acento nem caixa) é recusado (`ESTADO:1576`)
75. `chat.magia` é intenção própria, sempre pública, e a sala não confere se a magia existe no compêndio (`ESTADO:1578`)
76. "Mandar para o chat" usa o mesmo "Como:" do chat; quem não edita personagem fala como ele mesmo (`ESTADO:1579`)
77. Os créditos do arquivo aparecem recolhidos no fim da lista (`ESTADO:1582`)
78. Sem o seletor de pasta (Firefox, Safari) há "Escolher o arquivo…", que vale até recarregar (`ESTADO:1583`)

Redesign R1 (`REDESIGN:151-162`, `ESTADO:1650-1657`)
79. O selo "Mestre" vale para o usuário de id `mestre` (`REDESIGN:152`)
80. `color-scheme` do `<html>` acompanha o tema (`REDESIGN:154`)
81. `perigoFundo`, `avisoFundo`, `sobreposicao` e `--veu` são tokens por tema (`REDESIGN:155`)
82. `--fundo-mesa` só aparece antes de o canvas subir (`REDESIGN:157`)
83. No Claro, `--acento` (#E2AE4F) é só preenchimento; texto usa `--acento-forte` (#8A5D10) (`REDESIGN:159`)
84. Perigo do Claro em #A83A15 (o do protótipo dava 4,46:1); tokens que o protótipo não trazia (sucesso, aviso, roxo, véus, sombra) foram criados pelo agente (`REDESIGN:161`)

Redesign R2 (`REDESIGN:216-238`, `ESTADO:1705-1716`)
85. Painel recolhido = trilha de 52 px só com os ícones das abas (`REDESIGN:217`)
86. Largura padrão 360 px, ajustada ao 1/4 da janela; a escolha da pessoa fica intacta e volta quando a janela cresce (`REDESIGN:219`)
87. Presença: com mais de 6 pessoas aparecem 5 (online primeiro) e um "+N" abre a lista (`REDESIGN:221`)
88. O jogador vê só o ícone de pausa na pílula amarela; o relógio da sala continua só do mestre; a faixa do meio do mapa saiu (`REDESIGN:224`)
89. Zoom na horizontal; "Vendo como" embaixo no centro da área; sub-barra do pincel ao lado da barra (`REDESIGN:230-234`)
90. O botão de recolher o painel fica no canto do título da aba aberta (`REDESIGN:235`)
91. Aviso (toast) e selo de conexão centrados na área do mapa (`REDESIGN:237`)

Redesign R2b (`REDESIGN`, "R2b — como ficou")
92. A pausa automática espera 5 s depois que o último mestre sai (recarregar a página não pausa); o tempo congelado é o da saída
93. Ao acordar sem mestre conectado e com a mesa rodando, a sala pausa na hora (o tempo fora do ar conta como rodando)
94. Só a saída de conexão de mestre dispara a pausa; o jogador não vê diferença entre pausa manual e automática
95. Nos 8 temas escuros novos o destaque e os tokens de estado são os do Grimório; o resto foi derivado no tom de cada paleta; degradê do painel por coeficiente sobre a barra

Redesign R3 (`REDESIGN`, "R3 — como ficou")
96. Ficha: uma posição e um tamanho guardados por personagem (`ficha:<personagemId>`); a segunda ficha sem posição guardada desloca em cascata
97. Esc não fecha as janelas (Esc é da seleção, desde o R5a); as setas movem a janela com o cabeçalho focado (8 px; Shift, 40 px)
98. Só a ficha redimensiona nos dois eixos; ordem de turno e fontes de luz só na altura; o resto não redimensiona
99. Os dados rápidos deixaram de fechar ao clicar fora (agora fecham pelo X, ou sozinhos depois de rolar); o "recolher" das fontes de luz virou o minimizar comum, sem a opacidade de 70%
100. Minimizar esconde o corpo sem desmontá-lo; a posição só é guardada depois que a pessoa move ou redimensiona
101. Posições padrão: ordem no alto à direita, token embaixo à esquerda, ficha no alto à esquerda (até 60% da largura, 75% da altura), paredes e fontes lado a lado no alto à esquerda, iluminação ao centro, dados ao lado do botão
102. Seletor de tema: token novo `amostra` por tema para a metade de cima da bolinha; a interface não muda de cor
103. "Ver como" é o quinto grupo do menu; o nome dos grupos fica em letra pequena embaixo dos ícones (não cabe rótulo ao lado nos 48 px com o painel em 320 px)
104. O botão Paredes e portas fica embaixo do pincel, separado por um filete, e some quando o mestre está vendo como um jogador
105. O grid da cena tem só "visível" e "quadrado em metros" (o modelo não tem cor de grid) e vale ao Salvar da configuração; quadrado fora de 0,3 a 10 m dá erro no formulário
106. Esc no modo Paredes só encerra a sequência em andamento; sair do modo é pela barra, V/H/R, a janela ou o selo (Esc soltar a seleção ficou no R5a: com o modo Paredes ligado, Esc encerra a sequência e também solta a seleção)
107. As seis abas do mestre cabem numa linha a partir de 300 px, com os nomes inteiros (folga lateral menor)
108. Não existe aba guardada entre visitas (o painel abre sempre no Chat), então não houve migração de "Configurações" nem de "Mestre"
109. Sem controle numérico de largura do painel nas Preferências (fica a alça do R2)
110. A aba Mesa aparece e some na hora quando o papel de alguém muda

Redesign R5a (`REDESIGN`, "R5a — como ficou")
111. Dois cliques num token abrem o painel dele (só o mestre); antes não faziam nada
112. O painel do token fecha quando não há token selecionado; a seleção seguinte não o reabre
113. "Novo token" cria um token por vez (o modo termina no clique); o encaixe segue a preferência (Alt inverte), antes sempre encaixava; o formulário não tem camada
114. A régua fixa por botão "Fixar" e por Shift ao soltar; as fixas se acumulam e saem juntas com Esc, trocando de ferramenta ou de cena, ou com um clique em cada uma
115. O menu do token não tem "Entregar" a tocha (continua por arrastar a alça)
116. Clicar num marcador de condição abre a regra e não arrasta o token
117. Aviso de 6 a 12 s (3,5 s mais 55 ms por letra, mínimo 6 s), perto do clique, com um clique para dispensar; sem origem, no alto da área
118. A dica da tocha e o menu do token só por mouse (a alça é desenhada no canvas e não recebe foco)
119. Esc no meio do arrasto de um token o devolve à origem (envia `token.soltar` com a posição de antes só se ele já andou)
120. O estado vazio do jogador só aparece com a iluminação dinâmica ligada
121. Em token pequeno cabem menos marcadores de condição (o resto vira "+N") por causa do tamanho maior
122. Esc não age com o foco dentro de uma janela (num botão do painel do token, por exemplo); com o foco no mapa e o painel do token aberto, Esc solta a seleção e o painel fecha junto

Redesign R5b (`REDESIGN`, "R5b — como ficou")
123. ~~Os controles de montar a ordem de turno ficam numa seção recolhível "Montar"~~: a seção saiu no V2 (a ordem virou uma lista simples; `tabletop:pref:ordem:montar` não é mais lida)
124. Esc no campo da iniciativa devolve o valor de antes; a roda do mouse num campo com foco tira o foco (e confirma o que estava digitado)
125. Anterior e Próximo turno também dizem "A lista está vazia" quando desabilitados (desde o V2 não há Anterior; Próximo, Ordenar e Limpar dizem o motivo)
126. A dica do botão desabilitado aparece também ao mexer o mouse sobre ele (o botão pode ficar desabilitado com o mouse já em cima); desde o V3b é "Nome — motivo" e, com as dicas desligadas, o clique mostra o motivo num balão
127. O mestre arrasta o item das Fichas por inteiro (nome e alça), não só pela alça
128. "Usar o exemplo" com pasta grava `compendio/magias.json` e confirma antes de substituir; sem pasta vale até recarregar; falha ao gravar na pasta mostra erro, sem cair para "sem pasta"
129. A atribuição do SRD fica nos créditos (aberta) e numa linha "Exemplo do SRD 5.1 em uso", só enquanto o compêndio da mesa é o exemplo (comparado pelo hash)
130. O nome do PDF que bate com um personagem só sugere o destino "Por cima de"; a pessoa aceita com um clique
131. O nome do personagem novo mora no bloco do destino da revisão do PDF; "N campos para conferir" no lugar de "para revisar"
132. "Próximo a conferir" dá a volta no fim; "Mostrar tudo" vira "Recolher o que está certo"
133. O resumo da seção recolhida conta: atributos 12, perícias 18, números gerais 8 e, nas demais, o tamanho da lista ou o que veio preenchido

R6a (8 suposições) e R6b (9 suposições): a lista está nas seções "Decisões (assumido)" de "R6a — como ficou" e "R6b — como ficou" no `REDESIGN`; as perguntas novas estão em `PERGUNTAS` ("Novas do R6a" e "Novas do R6b").

Ajustes V1 (7 suposições): a lista está em "V1 — como ficou" (Decisões) no `REDESIGN`; as 4 perguntas novas estão em "Novas do V1" no `PERGUNTAS`.

Os itens 49 a 85 são 37; o R2 acrescenta os itens 86 a 92, o R2b os 93 a 96, o R3 os 97 a 103, o R4 os 104 a 111, o R5a os 112 a 123 e o R5b os 124 a 134. Deixei de fora as suposições puramente técnicas (por exemplo, onde mora o compêndio
na tabela `meta`, o worker do pdf.js, tipos do Node no teste, idempotência de `desenho.apagar`).

## 5. Pontos frágeis por lote

V3b (dicas enxutas, 2026-11-11)
- A dica no mouse espera 700 ms e o foco mostra na hora, salvo se veio de um clique (compara o `timeStamp` do foco com o do último `pointerdown` no mesmo elemento, 100 ms; não usa `:focus-visible`, que escondia o foco programático depois de um mouse). `useDica` guarda a contagem de dicas abertas e o instante do último fechamento em variáveis do módulo (troca na hora); os E2E congelam o relógio da página (`ajudasDicas.ts`) para provar o atraso. (`REDESIGN`, "V3b")
- Botão desabilitado por `motivo` usa `aria-disabled` (não o `disabled` nativo); o `toBeDisabled` do Playwright aceita os dois. Com as dicas desligadas o clique nele mostra um balão de 2,8 s (`aria-live`). Dica de marcador de condição e de alça de tocha no mapa não obedece à opção de desligar. (`REDESIGN`, "V3b")
- Ficaram com `title` nativo (não são botões): avatares da presença, siglas dos atributos, ícones "quem vê" e de cena, progresso do preparo. (`REDESIGN`, "V3b")

V3 (fichas em árvore e handouts, 2026-11-11)
- O menu de botão direito das Fichas (`MenuDeContexto.tsx`) abre pelo teclado com Shift+F10 ou a tecla de menu; o "contextmenu" nativo que o navegador dispara junto é ignorado por 700 ms (zerado quando o mouse age). Só testado com as teclas enviadas pelo Playwright, não com um teclado real, e não em toque. (`REDESIGN`, "V3")
- Mudar quem vê um handout (ou a pasta dele) manda snapshot novo a todos; quem pediu recebe o snapshot em vez do evento (as ajudas de teste esperam isso). (`ESTADO`, "Ajustes V3")
- A capacidade `nota.editar` ficou no enum sem uso (só para bancos e arquivos antigos). (`PERGUNTAS`, "Novas do V3")
- As fontes novas (Lora, Caveat, MedievalSharp, Special Elite) só foram vistas no Chrome. O caminho "ficha nova a partir do PDF" saiu da aba (a revisão ainda deixa trocar o destino para "Ficha nova"). (`REDESIGN`, "V3")
- O texto do handout usa o rascunho local `tabletop:rascunho:<usuário>:handout:<id>` até a sala confirmar, como a nota antiga. (`ficha`: `JanelaDoHandout.tsx`)

Ajustes V1 (2026-11-11)
- Os 11 temas novos e o Masmorra foram medidos (contraste, bolinhas distintas) e vistos nos prints, mas só no Chrome e sem teste com daltonismo. (`REDESIGN`, "V1 — como ficou")
- O marco do "zerar o relógio" só existe para o mestre: se um dia o jogador passar a ver o relógio, o marco terá de ir junto no filtro. O sinal de que dá certo é o teste "o jogador não recebe o marco". (`packages/shared/src/zerarRelogio.test.ts`, `objetos.ts:relogioParaVisao`)
- Quem monta um relógio novo na mão (`pausarRelogio`, `retomarRelogio`, os casos `mesa.pausada`/`mesa.retomada` do `reduzir`) tem de copiar o `marcoMs` (`marcoDoRelogio`), senão pausar zera sem querer. Há teste de pausar e retomar depois de zerar. (`packages/shared/src/relogio.ts`)
- O menu do relógio (`MenuDoRelogio` em `EstadoDaMesa.tsx`) é um botão de seta ao lado da pílula; o foco vai ao primeiro botão ao abrir e volta ao botão com Esc. Não foi visto em tela de toque. (`ESTADO`, "Ajustes V1")

Fonte: subseções "Frágil / não verificado" ou "Pontos frágeis" do `ESTADO` (Lote 3 em diante). Onde o mesmo
ponto aparece em mais de um lote, vai numa linha só, com os dois lugares.

Vários lotes
- Só Chrome/Edge foi testado: Firefox e Safari (WebP, OPFS, DnD), WebGL, pasta local. (`ESTADO:525-527`, `ESTADO:852`, `ESTADO:932`, `ESTADO:1030`, `ESTADO:1595`, `ESTADO:1668`)
- `PastaLocal` (File System Access) sem teste automático; coberta só pelo roteiro manual. (`ESTADO:521`, `ESTADO:725`, `ESTADO:1263`, `ESTADO:1595`)
- Hibernação real da sala não testada (L3: posse ao acordar; L4: preparos pendentes). (`ESTADO:531`, `ESTADO:719`)
- Visual das abas conferido só por teste, sem polimento (L3 Biblioteca; L4 abas novas). (`ESTADO:541`, `ESTADO:726`)
- Mesma cena duplicada obriga a refazer o preparo e baixa o mapa duas vezes. (`ESTADO:715`, `ESTADO:854`)
- Toque (celular) não testado: arrastar alça da tocha (L7) e arrastar e redimensionar as janelas (L9, R3). (`ESTADO:1117`, `ESTADO:1261`)
- Banco real do Vilella nunca aberto com as migrações novas (leitura coberta só por teste com banco simulado) (L7, L8, L9). (`ESTADO:1122`, `ESTADO:1196`, `ESTADO:1266`)
- Arrasto HTML5 (drag and drop): L4b só no Chrome; L11 sem E2E do arrasto da lista. (`ESTADO:852`, `ESTADO:1418`)
- Custo real de uso (inventário no SQLite, frames) nunca medido numa mesa de 3 h (L3; custo de linhas também em L8). (`ESTADO:537-538`)

Lote 3
- GPU real: tile > 8192 px nunca exercitado; possível linha fina entre tiles. (`ESTADO:528-530`)
- Importar a campanha em outra instalação: os arquivos só existem nos navegadores; sem ninguém online o mapa fica "indisponível". (`ESTADO:533-536`)
- `navigator.storage.persist()` é só um pedido; sem cota o OPFS falha e o asset dá erro. (`ESTADO:539-540`)

Lote 4
- Arquivos grandes: cifrar e decifrar leem o arquivo inteiro em memória; não medido com tile de 30 MB nem mapa de 200 MB. (`ESTADO:710-711`)
- Cifrado que chega depois da ida fica sem uso; não há limpeza dos antigos e eles contam para o teto de 2000 assets. (`ESTADO:712-714`)
- O preparo revela quantos arquivos cifrados há e o tamanho aproximado; o token de NPC visível leva um `personagemId` opaco. (`ESTADO:717-718`)
- `armazenamento.ts` sem teste de unidade; progresso do preparo faz uma consulta por `asset.tenho`, não medida. (`ESTADO:722-724`)

Lote 4b
- A prévia da cena usa o cache; mapas enormes geram a prévia na primeira abertura da faixa. (`ESTADO:853`)
- A bandeira de chegada só é arrastável com a ferramenta Selecionar e só existe (para o mestre) com a faixa de Cenas aberta (`opcoes.mostrarBandeira`, V10). (`ESTADO:855`)
- V10: diálogos modais usam `useDialogo.ts` (pilha: z-index, foco, Tab, Esc, devolve o foco); `haDialogoAberto()` segura os atalhos do mapa. `token.apagar` é conferido na sala (jogador só o que controla) e `token.restaurar` usa uma guarda de 10 s só em memória (`Sala.apagadosRecentes`). Delete e setas do token vivem em `Mesa.tsx` (`aoTeclarNoMapa`); o clique direito é tratado em `menuNativo.ts`; o anel de foco do mapa depende de `data-foco-teclado` (`Mapa.tsx`).
- V10b: o jogador põe o próprio token com `token.colocarMeu` (capacidade `token.colocarProprio`; `nucleo.ts`, `tokenDoPersonagem`). A área da bandeira e as regras do cliente estão em `mapa.ts` (`areaDaBandeira`, `podeColocarProprioToken`, `jogadorVeABandeira`). O botão "Colocar no mapa" vive em `AbaFichas.tsx` e `JanelaDaFicha.tsx`; o pedido sai por `colocarNoMapa.ts`. A área acesa durante o arrasto vem do estado do módulo `arrasto.ts` (`Mesa.tsx` → `acenderAreaDaBandeira` → `mapaPixi.ts`).
- V10c: `Cena.cartao` (`estado.ts`) é a cena como cartão. A regra é `cenaEhCartao` e `visaoLimitadaNaCena` (`paredes.ts`); a sala esconde as paredes do jogador em `visaoPara` e `eventoPara` (`nucleo.ts`) e não barra o `token.soltar` nem o `porta.alternar` dele. No cliente a névoa vem de `iluminada` em `Mesa.tsx`, o enquadramento de `vistaInicial` → `centralizar(folga)` em `mapaPixi.ts`, e o menu e a marca estão em `FaixaDeCenas.tsx` (caixa em `ConfigurarCena.tsx`). Quem criar visão nova no cliente precisa passar por `visaoLimitadaNaCena`.

- V12: o ping. Regras puras em `packages/shared/src/ping.ts` (`pingar`, `limitarPing`, `pingVisivelPara`); a intenção `mapa.ping` é tratada em `nucleo.ts` (devolve `ping` no resultado, sem evento) e a sala o limita por usuário e repassa `mapa.pingado` em `sala.ts` (`repassarPing`, `ultimoPing`, zerado em `/teste/zerar`). No cliente: `useSala.ts` (ocorrência `ping`), `Mesa.tsx` (`podePingar`, retorno `pingar`) e `mapaPixi.ts` (`esperarPing`, `pingRecebido`, `animarPings`, `animarCentralizacao`, `camadaDePings`). O gesto espera 400 ms parado a partir do `pointerdown` (Selecionar e Mão); a tecla P fica no `aoTeclaBaixo` do mapa. Ganchos de teste: `pingsRecebidos`, `pingsNaTela`, `centroDaVista`.
- V13: a régua e a unidade. Contas puras em `packages/shared/src/mapa.ts` (`medirRegua`, `medirPercurso`, `formatarDistancia`, `metrosParaUnidade`, `unidadeParaMetros`): todo texto de distância do app passa por `formatarDistancia` com a unidade. A unidade é preferência local em `apps/web/src/unidade.ts` (`useUnidade`; chave `tabletop:pref:unidade`); o grudar da régua fica em `preferencias.ts` (`tabletop:pref:reguaGrudar`) e chega ao mapa por `opcoes.reguaGrudar` e `opcoes.unidade`. Na régua (`mapaPixi.ts`): `reguaAtual = { pontos, b }`; `marcarPontoDeVirada` (o clique direito entra por `pointerdown` ou pela mudança de `buttons` no `pointermove`, com `direitoDaReguaAbaixo` contando um só); Backspace em `aoTeclaBaixo`; os rótulos dos trechos são desenhados em `Mesa.tsx` (`regua-trecho`). Painel: `PainelDaRegua.tsx`. No V14 os campos de raio (luz, visão, alcance de interação) passaram a seguir a unidade: `CampoDeDistancia` em `Campo.tsx` (a sala recebe sempre metros; sem mexer no campo nada é enviado). Os rótulos da régua em `Mesa.tsx` ficam dentro de `PertoDoPonto.tsx` (posição em `posicaoDaRegua.ts`, pura): cabem na área do mapa e fogem do zoom flutuante. Frágil: os campos de memória do mapa (Base, Por modificador, Alcance fixo, em `PainelDeIluminacao.tsx`) seguem em metros.
- P1: a aba Preferências em sanfona. Frágil: o `aria-expanded` é posto à mão no `<summary>` (o `<details>` nativo não o expõe) e o estado `aberta` vem do evento `toggle`; o cartão "Conectar o Claude" fica montado fechado (o `<details>` não desmonta) e é ele que conta os tokens para o resumo (`aoContarTokens`); o resumo de Aparência segue o `SeletorDeTema` por `aoEscolher` (se o tema mudar por outro caminho, o resumo só atualiza ao reabrir a aba). Suposição: transferência em andamento só realça o resumo, não abre o cartão. (`REDESIGN`, "P1")

Lote 5
- Blend `erase` e RenderTexture só vistos no Chrome; bordas do véu serrilhadas em zoom alto. (`ESTADO:932`) (junto de L6, ver "Vários lotes")
- Token com o centro sobre a parede pode vazar visão. (`ESTADO:933`)
- Quem encosta o token na parede com Alt pode parar a poucos milímetros; trajeto conferido só por segmento reto, sem raio do token. (`ESTADO:934`)
- Latência no duplo clique de desenhar parede: o ponto repetido é ignorado por distância (< 5 cm). (`ESTADO:935`)
- Visão recalculada a cada quadro enquanto um token de visão anda (medido 5–7 ms para 500 paredes e 8 fontes). (`ESTADO:936`)

Lote 6
- Blend `saturation` e RenderTextures só no Chrome com devicePixelRatio 1; com DPR alto as texturas ficam em 1800 px. (`ESTADO:1030`)
- Luz com bordas duras (degraus), sem gradiente. (`ESTADO:1031`)
- A memória marca por centro de célula de 0,5 m: quinas finas de parede podem marcar célula por engano. (`ESTADO:1032`)
- A memória só vale para o token do navegador; o mestre "vendo como" usa a memória dele, não a do jogador. (`ESTADO:1033`)
- Cena que muda de tamanho descarta a memória gravada. (`ESTADO:1034`)
- Redimensionar a janela com muito zoom refaz as marcas das luzes (barato), não as texturas. (`ESTADO:1035`)

Lote 7
- Contagem do inflamável usa o relógio do navegador (3 s + 60 ms), a sala confere com 300 ms de tolerância; rede lenta pode recusar. (`ESTADO:1118`)
- ~~O anel e as alças se sobrepõem quando um ponto com objeto fica a menos de 1 quadrado da mão do token~~: a alça da tocha agora se afasta do ícone do ponto (R5a). O anel de acender, desenhado no ponto, não mudou. (`ESTADO:1119`, `PERGUNTAS:38`)
- Com a sala fora do ar por muito tempo o relógio dela continua: ao voltar, tochas podem ter acabado. (`ESTADO:1120`)
- O mestre "vendo como" um jogador recebe o tempo que o mestre recebe; a visão filtrada é só de tela. (`ESTADO:1121`)
- `ponto.acenderInicio` não devolve evento no E2E (transitória); quem testa só envia. (`ESTADO:1123`)

Lote 8
- Cada snapshot relê o histórico do SQLite por usuário: barato numa mesa, conta linhas lidas no deploy futuro. (`ESTADO:1192`)
- O chat carregado no navegador é trocado pelo snapshot ao reconectar; as "anteriores" já carregadas somem. (`ESTADO:1193`)
- Nenhum teste com imagem de retrato real; a regra de `retratosDoChat` é coberta só por unidade. (`ESTADO:1194`)
- O limite de 10/s fica em memória: a sala hibernada zera a janela (inofensivo). (`ESTADO:1195`)
- ~~A lista de presença no topo do chat ocupa muito espaço com 8 pessoas~~: resolvido no R2 (avatares no topo da mesa). (`PERGUNTAS:83`, levantamento 17)

Lote 9
- ~~A janela da ficha não guarda posição entre sessões~~: resolvido no R3 (posição e tamanho por usuário). (`PERGUNTAS:88`, `ESTADO:1261`)
- Duas pessoas no mesmo campo: vale a última; o já enviado fica por cima por 2,5 s ou até o eco. (`ESTADO:1262`)
- Escrita em `fichas/` (File System Access) não testada no E2E; sem pasta, o teste cobre o download. (`ESTADO:1263`)
- Chave numérica em operação (`espacosGastos.1`) cria lista em vez de objeto quando o pai não existe. (`ESTADO:1264`)
- Texto de magia e características vem vazio no Darion (o Lote 10 importa do PDF). (`ESTADO:1265`)

Lote 10
- Só um PDF de verdade testado (o do Darion); falta o de outro jogador. (`ESTADO:1338`)
- Os rótulos em PT da página de conjuração e os rótulos em EN foram supostos, não vistos num PDF real. (`ESTADO:1338`)
- A leitura depende de os rótulos da ficha impressa não mudarem e de o texto ser real (PDF escaneado não funciona). (`ESTADO:1339`)
- CA, iniciativa e deslocamento vêm de "três números numa linha"; linha diferente cai em `incertos`. (`ESTADO:1340`)
- Parágrafos das descrições: a linha curta que termina em ponto fecha o parágrafo. (`ESTADO:1341`)
- A tela de revisão edita só alguns campos; o resto se corrige depois, na ficha. (`ESTADO:1342`)

Lote 11
- ~~A dica das condições só aparece com o mouse~~: desde o R5a a regra também abre por clique no marcador (serve ao toque, ainda não testado nele). (`ESTADO:1419`, `PERGUNTAS:60`)
- O painel da ordem tem 364 px e, em 1280 px, cobre parte do mapa (levantamento 14). Desde o R2 abre dentro da área do mapa, no canto superior direito, sem cobrir barras nem zoom; no R3 virou janela (arrasta, minimiza, altura ajustável). (`ESTADO:1420`)
- `combate.alterado` leva o combate inteiro a cada mudança (até 200 entradas). (`ESTADO:1421`)
- Ordenação por nome com `Intl.Collator("pt-BR")` testada no Node, não no `wrangler dev` do Vilella com lista grande. (`ESTADO:1422`)
- Sem automação de regra (desvantagem, falha automática, teste de concentração): fica para o 7b. (`ESTADO:1423`)

Lote 13
- O rascunho é só de tela; quem reconecta descarta os rascunhos que tinha. (`ESTADO:1503`)
- Redesenhar é "tudo de uma vez": 1000 desenhos de 2000 pontos podem pesar no zoom e no arrasto; não medido. (`ESTADO:1504`)
- Selecionar e mover usam alvo de 8 px; desenhos finos e próximos podem exigir zoom. (`ESTADO:1505`)
- A borracha apaga ao encostar, só o que é do usuário; recusa rara da sala faz o desenho reaparecer após ~1,5 s. (`ESTADO:1506`)
- O teste do escuro lê pixel pelo `renderer.extract`; em outra GPU o valor pode variar. (`ESTADO:1507`)
- A cor livre usa o `<input type="color">` do navegador, sem conta-gotas próprio. (`ESTADO:1508`)
- Não há desfazer de apagar nem refazer (também em `PERGUNTAS:69`). (`ESTADO:1509`)

Lote 14
- Dois mestres com arquivos diferentes: o último a conectar redefine o compêndio (também em `PERGUNTAS:74`). (`ESTADO:1592`)
- Sem o mestre online e sem cópia no cache, quem nunca baixou vê "ninguém com o arquivo está online". (`ESTADO:1593`)
- A lista não é virtualizada: com 2000 magias são 2000 botões; não medido. (`ESTADO:1594`)
- Quem está com a ficha aberta e adiciona magia pelo compêndio concorre com a edição dela. (`ESTADO:1596`)
- O cartão no chat confia no que o cliente mandou: dá para "publicar" uma magia inventada. (`ESTADO:1597`)
- A tradução das 3 magias do exemplo do SRD precisa ser conferida (também em `PERGUNTAS:78`). (`ESTADO:1598`)

Redesign R1
- Selo "Mestre" preso ao id `mestre` (também em `REDESIGN:167`). (`ESTADO:1665`)
- ~~Texto branco sobre cores de usuário claras (amarelo do mestre) no avatar~~: resolvido no R6a (texto branco ou preto pela luminância da cor, AA; `contrasteDeCor.ts`). (`ESTADO:1666`, `REDESIGN:167-168`)
- ~~Os rótulos desenhados dentro do mapa não seguem o tema~~: decidido no R6a (assumido): continuam independentes do tema (o mapa é conteúdo) e têm contorno; conferidos sobre mapa claro e escuro. (`ESTADO:1667`, `REDESIGN:168`)

V2 (ordem de turno simples)
- O jogador seleciona os tokens que controla (`opcoes.controla` em `mapa/mapaPixi.ts`, `Mesa.tsx`): só da tela dele; clicar em token alheio solta a seleção (assumido). (`REDESIGN`, "V2 — como ficou")
- A ordem "na tela" é o `ordemDeTurnoVisivel` (não há campo `combate.aberta`); o × do mestre fecha para todos sem apagar a lista nem a rodada. (`REDESIGN`, "V2")
- Mudar o valor, entrar e rolar reordenam a lista; o arrasto e o Alt+setas valem até o próximo valor mudar ou o Ordenar. (`REDESIGN`, "V2")
- A Iniciativa da ficha só rola na sala com a ordem aberta; só usa o token selecionado se for do personagem da ficha (senão o único token na cena; com vários ou nenhum, avisa). Vantagem da ficha não vale. (`REDESIGN`, "V2")
- O arrasto da linha é o do navegador (HTML5), com o campo do número dentro dela; só o Chrome foi testado. (`ESTADO`, "V2", Frágil)
- As intenções `combate.adicionar`, `combate.rolar` e `combate.passar` seguem na sala sem botão (Rolar para todos e Passar saíram da tela; o Turno anterior voltou no V2). (`REDESIGN`, "V2")

Redesign R6b
- Toque (celular) continua sem teste: o painel do token na coluna da direita, as janelas e as dicas só foram vistos com mouse e teclado. (`ESTADO`, "R6b", Frágil)
- Em área apertada (altura da área < 900 px) o painel do token vai embaixo à direita e a ordem de turno, com o painel aberto, tem teto de ~340 px e o painel do token de ~245 px (rolam por dentro; desde o V2 a ordem é só a lista e o rodapé); quem redimensionou a ordem continua preso a esse teto enquanto o painel do token está aberto. Telas menores que 1280×720 não foram vistas. (`REDESIGN`, "R6b — como ficou")
- A aba do painel, as janelas, os menus, as dicas e os avisos entram com 140 ms (`@keyframes entrada`, só opacidade e 4 px de deslocamento; nada no canvas). Sem animação de saída. Com `prefers-reduced-motion: reduce` nada anima; os E2E rodam assim (`reducedMotion: "reduce"` no Playwright) e um teste confere a diferença. (`ESTADO`, "R6b")
- O aviso da pausa sem mestre só vem da presença que o cliente já tem: quem entra com a presença ainda vazia não é avisado (supõe mestre online até a presença chegar); "reconectando" conta como mestre fora. (`REDESIGN`, "R6b — como ficou")
- Ainda com `title` nativo (decisão: não são botões muito usados): campos pequenos da ficha e do editor do item, os itens do menu de contexto da faixa de cenas (precisam de `disabled` de verdade), os textos informativos da faixa de cenas, o selo da pílula do mestre (`menu-pausa`) e o rótulo "Cor livre" do pincel. (`ESTADO`, "R6b")
- Os rótulos dos tokens agora levam uma pílula escura translúcida (independente do tema); mapa de cor intermediária não foi visto. (`ESTADO`, "R6b")
- Os prints: restam `auditoria` (o tour tela a tela), `r4`, `r5a`, `r5b`, `r6a` e `r6b`; os dos lotes 6 a 14 e `r1`, `r2`, `r2b` e `r3` foram apagados (só registravam a interface antiga). (`ESTADO`, "R6b")

Redesign R6a
- Espaço só deixa de arrastar a vista num botão em foco pelo teclado (`:focus-visible`); botão focado com o mouse continua com o Espaço do mapa. Conferido só no Chrome. (`ESTADO`, "R6a", Frágil)
- O jogador não seleciona tokens: o Shift+F10 dele abre o menu do primeiro token que controla na cena (assumido). (`REDESIGN`, "R6a — como ficou")
- A tecla de menu e o menu nativo do navegador: o menu nativo é suprimido por 700 ms depois que abrimos o nosso; só testado com Shift+F10 e ContextMenu enviados pelo Playwright, não com um teclado real. (`ESTADO`, "R6a", Frágil)
- O mapa (canvas) agora recebe foco (`tabIndex=0`): Tab passa por ele; o anel aparece só no foco por teclado. (`REDESIGN`, "R6a — como ficou")
- Os rótulos do mapa continuam fixos (claro com contorno preto), independentes do tema; mapa de cor intermediária não foi visto. (`ESTADO`, "R6a", Frágil)
- ~~Os prints antigos continuam quebrados~~: resolvido no R6b (os antigos foram apagados; o tour `auditoria` foi refeito).
- ~~Rótulos do mapa fixos com contorno preto, borrados sobre mapa claro~~: resolvido no R6b (pílula escura translúcida).

Redesign R5b
- ~~A dica do item das Fichas é o `title` nativo~~: resolvido no R6a (dica comum). (`ESTADO`, "R5b", Frágil)
- O "Usar o exemplo" que grava `compendio/magias.json` só foi testado com a "pasta" dos testes (a `Memoria`), não com a pasta real do Chrome (File System Access). (`ESTADO`, "R5b", Frágil)
- O item das Fichas agora é arrastável pelo nome (botão `draggable`): testado no Chrome; Firefox e Safari tratam botão arrastável de outro jeito. (`ESTADO`, "R5b", Frágil)
- ~~Os prints antigos que usam `ordem-*` e "Confirmar importação" podem não rodar mais~~: resolvido no R6b (apagados ou refeitos). (`ESTADO`, "R5b", Frágil)

Redesign R5a
- ~~O menu do token só existe para o mouse~~: desde o R6a abre com Shift+F10 ou a tecla de menu (a tocha vale por ele). A dica da alça da tocha continua só no mouse (a alça é do canvas e não recebe foco), e toque (celular) não foi testado. (`ESTADO`, "R5a", Frágil)
- O aviso de erro sem origem (a sala avisando por conta própria) ficou no alto da área e só foi conferido por leitura; os E2E cobrem o aviso com origem. (`ESTADO`, "R5a", Frágil)
- A origem do aviso é o último ponto do ponteiro até 1,5 s antes do envio, ou o campo com o foco: um erro que volta depois de outra ação do mouse pode aparecer perto do ponto errado. (`ESTADO`, "R5a", Frágil)
- Clicar num marcador de condição abre a regra e não arrasta o token por ali; quem pega o token pela borda de baixo, onde os marcadores ficam, abre a regra em vez de arrastar. (`REDESIGN`, "R5a — como ficou")
- ~~Os prints antigos que clicam em `menu-token-condicoes` ou `menu-token-fechar` não rodam mais~~: resolvido no R6b (apagados ou refeitos). (`ESTADO`, "R5a", Frágil)
- Entregar a tocha continua só por arrastar a alça até outro token (o menu do token não tem "Entregar"). (`REDESIGN`, "R5a — como ficou")

Redesign R4
- Os E2E só rodam com 1 worker (sala compartilhada): `--workers` maior dá falhas falsas. (`ESTADO`, "R4", Como rodar)
- ~~A dica do menu do topo é própria do `MenuSuperior`~~: resolvido no R6a (uma dica só, `BotaoComDica`, com atalho). Os `title` nativos que sobravam foram limpos no V3b (saíram onde o nome está à vista; viraram a dica comum nos só-ícone; sobram só os de elementos que não são botões, ver `REDESIGN`, "V3b"). (`ESTADO`, "R4", Frágil)
- ~~Os prints antigos (`r1` a `r3` e os dos lotes) usam testids que não existem mais~~: resolvido no R6b (apagados; o tour `auditoria` foi refeito). (`ESTADO`, "R4", Frágil)
- O selo de modo existe só para Paredes e portas; luz e ponto não têm. (`ESTADO`, "R4", Frágil)
- ~~`PROJETO.md` ainda cita a aba "Configurações" e a aba do mestre~~: resolvido no R6b (os trechos ganharam "(hoje: Preferências / Mesa)").

Redesign R3
- Toque (celular) não testado: arrastar e redimensionar as janelas só foram testados com mouse. (`ESTADO`, "R3", Frágil)
- ~~Com ordem de turno, ficha e painel do token abertos em 1280×720 as três se sobrepõem~~: resolvido no R6b (painel do token na coluna da direita em área apertada). (`ESTADO`, "R3", Frágil)
- A ficha sem tamanho guardado acompanha a área (60% da largura) e a ordem de turno tem altura máxima "área menos 80 px"; janelas de outros tamanhos de tela só foram vistas em 1600×900 e 1280×720. (`ESTADO`, "R3", Frágil)
- ~~Raça, Antecedente e Alinhamento cortam o texto na ficha de 520 px~~: resolvido no R6b (os três campos empilham na ficha estreita). (`REDESIGN`, "R3 — como ficou")

Redesign R2b
- O mestre que perde a rede por mais de 5 s pausa a mesa para todos. (`ESTADO`, "R2b", Frágil)
- Os E2E de pausa automática esperam 6,5 s reais (lentos); não há teste de unidade do Durable Object, só do shared e o E2E. (`ESTADO`, "R2b", Frágil)
- `/teste/zerar` ignora o fechamento atrasado de sockets anteriores (`anterioresAoZerar` em `sala.ts`), para a pausa automática não pausar a mesa zerada do teste seguinte.

Redesign R2
- ~~Ao mudar o tamanho da área a vista do mapa fica ancorada no canto superior esquerdo~~: resolvido no R6b (a vista mantém o centro). (`ESTADO:1723`, `REDESIGN:244`)
- ~~A pílula do mestre muda de largura entre rodando e pausada~~: resolvido no R6b (mesma largura; o espaço do jogador fica reservado). (`ESTADO:1725`)
- Com 5 abas na largura mínima "Configurações" ocupava quase a linha. Ficou velho: desde o R4 são 6 abas (5 para o jogador) e elas cabem numa linha em 300 px, apertadas. (`ESTADO`, "R4")
- ~~A lista do "+N" da presença não tem teste de foco por teclado~~: coberta no R6a (`teclado.spec.ts`). (`ESTADO:1724`)

Itens de interface que o "Em aberto" do `REDESIGN` mandava para o R5/R6: a dica das condições abrir por clique
e as alças de tocha sobrepostas ao ícone de ponto foram resolvidos no R5a. O que sobra, **seleção múltipla no
mapa**, não existe ainda; aparece em `PERGUNTAS:58` e `PERGUNTAS:69`.

### V4a (ficha no desenho aprovado)

- `ficha.css` repete `.fl-raiz` em todo seletor e só reseta botões com classe `fl-*` (`:where(.fl-raiz) button[class*="fl-"]`), para ganhar do `button` global. Os blocos do fim ("ajustes por contexto") precisam ficar depois dos base: o Biome acusa especificidade descendente e a janela estreita some do lugar.
- A ficha é estreita pela **largura da janela** (`LARGURA_DA_FICHA_ESTREITA`, 620 em `janelas.ts`), não por container query: o arranjo muda a estrutura (acordeão), então o React precisa saber. O acordeão desmonta o que está fechado.
- As bolinhas de espaço e de dado de vida são `checkbox` estilizados: **cheia = disponível** (o primeiro V4a marcava o gasto).
- O editor da engrenagem edita `ficha.ataques[i]` ou `ficha.magias[i]` pelos mesmos campos (`CamposDeRolagem` em `ficha.ts`); a lista de Ataques mostra as magias com `emAtaques`. O dano final sai de `expressaoDeDano` (dados + atributo + bônus + mágico + segundo dano); um dano antigo "1d8+7" sem campos novos sai como estava.
- Rolagem: `criarRolador` não zera mais a vantagem; o d20 de teste e o de ataque usam `vantagem` da janela. O crítico por margem e o dano extra são feitos em `rolarAtaque` (sala).
- O nome do personagem na ficha é edição de `personagem.editar` ao sair do campo (V4b2: peça única `ficha/NomeComCapitular.tsx`; a capitular é só desenho e o campo mostra o nome inteiro enquanto se edita).
- Não verificado em Firefox e Safari (`color-mix`, `clip-path`).

V5 (paredes e portas, 2026-11-12)
- Os contornos são só desenho: `opcoes.contornos` (Mesa) decide e `desenharParedes` (`mapaPixi.ts`) desenha; a visão, a luz e a passagem leem as paredes por `segmentosDaParede` (`shared/src/paredes.ts`) e **não** dependem dos contornos. Parede nova que bloqueia algo precisa passar por essa função (arco vira segmentos de ~10°). (`REDESIGN`, "V5")
- Porta escondida: o clique e o destaque no hover usam `portaEm` (o ícone invisível continua clicável); `portaSob` é só estado de tela. O mesmo `portaEm` roda a cada `pointermove`. (`REDESIGN`, "V5")
- Desenho encadeado: `desenhando` (pontos), `meiosDoDesenho` (o ponto do arco de cada trecho), `modoArco` (tecla A) e `fimDoArco3` (arco de 3 pontos em andamento). `encerrarDesenho` manda tudo numa `parede.criar` só. `parede.editar` leva o `meio` junto quando uma ponta muda (`nucleo.ts`). (`REDESIGN`, "V5")
- Encaixe: `encaixarMeiaCelula` (não `encaixarNoGrid`) vale para parede, janela, porta, secreta e invisível; Alt inverte. A tecla A só age com a ferramenta Paredes e fora de campos de texto. (`REDESIGN`, "V5")
- Painel das paredes: o texto é curto de propósito (um painel mais alto cobre o ponto onde os E2E desenham). Guarde a altura. (`REDESIGN`, "V5")

## 6. Roteiros manuais pendentes

Só onde está cada um; os passos estão no `ESTADO`. Nenhum foi dado como feito, exceto o parcial do Lote 3 e o
dos Lotes 1 e 2 (fora do escopo deste mapa).

- Lote 3, **parcial** ("Roteiro manual (parcial)"): `ESTADO:543`. Feito em 2026-11-05: mapa e token da pasta local
  apareceram. Faltam 6 passos e dois ajustes de interface vistos no print dele (o contador "0 arquivos prontos"
  e a barra lateral cortando texto, `ESTADO:546-551`).
- Lote 4, pendente: `ESTADO:728`.
- Lote 4b: sem roteiro escrito (foi interface para ver); o `ESTADO` só tem "Frágil" (`ESTADO:850`).
- Lote 5, pendente: `ESTADO:938`.
- Lote 6, pendente: `ESTADO:1037`.
- Lote 7, pendente: `ESTADO:1125`.
- Lote 8, pendente: `ESTADO:1198`.
- Lote 9, pendente: `ESTADO:1268`.
- Lote 10, pendente: `ESTADO:1344`.
- Lote 11, pendente: `ESTADO:1425`.
- Lote 13, pendente: `ESTADO:1511`.
- Lote 14, pendente: `ESTADO:1600`.
- Redesign R1, pendente: `ESTADO:1670`.
- Redesign R2, pendente: `ESTADO:1729`.
- Redesign R2b, pendente: o "Roteiro manual" da seção "Redesign R2b" no `ESTADO`.
- Redesign R3, pendente: o "Roteiro manual" da seção "Redesign R3" no `ESTADO`.
- Redesign R4, R5a e R5b, pendentes: o "Roteiro manual" de cada seção no `ESTADO`.
- Ajustes V1 (R6a e R6b também): o "Roteiro manual" da seção "Ajustes V1" no `ESTADO`.

Total: 18 roteiros com seção própria (1 parcial e 17 pendentes).

## 7. Adiados

A pedido dele (`PROJETO:816-819`: "Ordem decidida pelo Vilella (2026-11-06)"; `PERGUNTAS:21`):

- **Lote 7b, automações da mesa** (`PROJETO:1308`): ciclos, eventos e reações do mestre, zonas, editor de
  automações e campanhas-exemplo carregáveis. O ícone "Eventos" do menu sai até lá (`REDESIGN:109`). Ideias
  já guardadas para ele: teste de concentração com a CD sugerida e condições que aplicam vantagem ou
  desvantagem nas rolagens (`PERGUNTAS:62`, `ESTADO:1448`).
- **Lote 12, MCP** (`PROJETO:1647`): `apps/mcp` ligando na sala local, rascunho invisível aos jogadores, publicação
  pelo mestre e desfazer em lote.

O que o plano R2 a R6 ainda prevê (`REDESIGN:89-117`, "proposta"; `REDESIGN:248`: falta combinar se seguem como
planejados, mudam de escopo ou ficam com ele):

- **R2, estrutura fixa (entregue)**: topo de 48 px, ferramentas de 52 px, painel direito em coluna com abas nomeadas e
  largura ajustável (300 px a 1/4 da tela), zoom fixo no canto, presença em avatares no topo, pausa e relógio
  claros, "centralizar" só na área visível. Resolve 1, 3, 17, 21.
- **R3, janelas flutuantes (entregue)**: componente único (arrastar, posição e tamanho por usuário, dois cliques
  minimizam, sempre na tela, a última clicada por cima) para ordem de turno, ficha, token, paredes, fontes de
  luz, iluminação e dados rápidos. Resolve 8 (parte), 14 (parte), 16.
- **R4, organização do mestre (entregue)**: menu superior agrupado e com nomes; Paredes vira ferramenta da barra
  esquerda; "Eventos" sai até o 7b; Configurações separadas em Preferências e Mesa; Notas viram aba; grid vai
  para a cena; "uso de hoje" vai para diagnóstico. Resolve 2, 4, 5, 6.
- **R5, interações e fluxos** (dividido em **R5a**, mapa e tokens, e **R5b**, combate, fichas, compêndio e PDF; os dois entregues): Esc solta a seleção; criar token pede nome e lugar; tocha com dica e menu;
  condições com menos cliques; régua que fica; avisos perto do clique; ordem de turno compacta com Enter; ficha
  com um clique; estados vazios que orientam. Resolve 7, 8 (parte), 9–15, 18, 19.
- **R6, polimento (entregue: R6a e R6b)**: tela pequena (1280×720), foco e contraste (inclui o avatar e os rótulos do mapa),
  atalhos nas dicas, transições discretas, revisão final dos prints nos 3 temas. Resolve 22 e o que sobrar.

Cada lote termina com `pnpm verify` verde numa rodada (mais `--repeat-each=3` nos E2E novos), prints nos 3 temas,
revisão e commit (`REDESIGN:91-92`).

## 8. Ideias (não são pendências)

`docs/IDEIAS.md` guarda o que ainda não virou plano ("Em avaliação": ordem e escopo dos lotes, deploy mínimo
cedo, névoa manual, mapa revelado aos poucos em tiles, handouts e som), o que foi **descartado** ("não propor
de novo") e notas da campanha de referência "A Chama Primordial". Quando algo é decidido, sai de lá e vai para
o `PROJETO.md`.

## Contradições entre os docs (corrigidas em 2026-11-10)

Achadas ao montar esta passagem e já acertadas nos docs de origem:

- Perguntas respondidas em 2026-11-10 que ainda apareciam abertas em outros blocos do `PERGUNTAS` (névoa
  manual, visão noturna do mestre, alcance do mestre para a tocha, números do Darion): riscadas.
- Darion no `ESTADO` do Lote 9 e no `PERGUNTAS:89`: anotado que tochas e flechas seguem o PDF; sobram
  Labareda Protetora e Radiação do Amanhecer para conferir.
- Alcance do mestre no `ESTADO` do Lote 7: anotado que mudou (o mestre entrega de longe).
- Lista "Só interface" do Lote 4b no `ESTADO`: marcada como histórica; sem função hoje só "Eventos" (7b) e os
  itens Artefato, Tesouro e Handout ("em breve").
- Roteiro do 4b: o `PERGUNTAS` não o lista mais (não há roteiro escrito).
- Plano do redesign: o item 8 entra no R5 (Esc, feito no R5a) além do R3 (painel); o verify passou a uma rodada.
- Título do `PROJETO.md`: Távola (identificadores técnicos seguem `tabletop`).
- "Em aberto" do `REDESIGN`: R1 e R2 feitos; R3–R6 a combinar.

Continua em aberto, por ser decisão e não erro de doc: `ficha.verOutras` (seção 4, item 21).

## V4a3 (2026-11-12): magias sem classe e bugs da ficha

- Espaços por círculo: `ficha/CirculoDeMagias.tsx` (`TotalDeEspacos`, `CirculoDeMagias`, `BotaoNovoCirculo`; o "+ Círculo" guarda o estado local em `AbaMagias.tsx` e em `ConjuracaoDoNpc.tsx`). O total vem de `espacosDaFicha`; `espacosAutomaticos` dá só a conta das classes (para o "auto"). `CampoNumero` ganhou `aoApagar` (apagar o texto chama o callback em vez de não enviar nada).
- Sem classe: `habilidadeDeConjuracao` + `conjuracaoSemClasse(f)` (testids `conjuracao-habilidade-livre`, `conjuracao-cd-livre`, `conjuracao-ataque-livre`). Com classe conjuradora o campo é ignorado.
- `espacos-resumo-N` ("3/4") virou `espacos-restantes-N` (só o número). O testid `espaco-total-N` continua, agora à vista.
- Dados de Vida: bolinhas em `.fl-bolinhas-dv` (quebram de linha); acima de `LIMITE_DE_BOLINHAS_DE_DV` (12) vira contador com `dv-menos-*` e `dv-mais-*`.
- Frágil: o popover do modificador sai por portal no body (fora do `.fl-raiz`; estilo `.popover.fl-pop-mod`); o foco volta ao botão da linha por `data-testid`. A tecla Menu também dispara `contextmenu`; uma janela de 700 ms evita abrir duas vezes (como no menu das Fichas).

## V4b (2026-11-12): NPC, arrastar do compêndio e reordenar

- NPC: `ficha/BlocoDoNpc.tsx` (o bloco inteiro; os estilos são os `npc-*` do fim de `ficha.css`, em container query `npc`, não pela largura medida como o PJ). Quem decide é `apresentacaoDoPersonagem` (`shared/pastas.ts`); a `JanelaDaFicha` troca só o corpo e as props da `Janela` (`LARGURA_DO_NPC` 520 em `janelas.ts`). Desde o V8 há duas fitas (Bestiário e Conjuração), ver a seção V8 deste arquivo; a engrenagem do cabeçalho (`npc-configurar`) alterna o bloco e a Configurar (`janela.aba`).
- Os testids do PJ que o NPC reaproveita: `ficha-nome`, `ca-<id>`, `pv-atual-<id>`, `pv-max-<id>`, `pv-menos`, `pv-mais`, `atributo-mod-<a>`, `atributo-valor-<a>`, `salvaguarda-botao-<a>`, `percepcao-passiva`, `editor-ataque` (o editor da engrenagem abre dentro da linha). Novos: `npc-*` (ver `BlocoDoNpc.tsx`), `traco-*` (a `ListaDeCaracteristicas` com `testidBase="traco"`).
- A ação do NPC é um `ataques[i]` com `categoria`; reordenar e arrastar usam o **grupo** da categoria (`posicoesDoGrupo`), então as três listas moram no mesmo array. Mudar a categoria na engrenagem muda a linha de seção.
- Reordenar e soltar: `ficha/ordem.tsx` (`useOrdemDaLista`, `useSoltarDoCompendio`, o arrasto do compêndio guardado num store do módulo, com `useEntradaEmArrasto`). As linhas precisam de `data-linha-lista` e `data-linha-i` (o hook devolve os atributos); cada lista tem um nome único **dentro da janela da ficha** (`ataque`, `magia-ataque`, `itens`, `caracteristicas`, `circulo-N`, `acao`, `reacao`, `lendaria`). O CSS do indicador, da linha levantada e da área acesa está no começo do bloco V4b de `ficha.css` (`data-indicador`, `data-levantada`, `data-aceita-soltar`).
- Frágil: o `dragleave` do Chrome vem com `relatedTarget` nulo ao passar entre filhos; por isso a saída da área é decidida pela posição do ponteiro. A pré-visualização do vão calcula com a posição do último `dragover`: depois que as áreas acendem a tela se ajusta, então um E2E precisa de um passo a mais do mouse antes de olhar a linha indicadora.
- Frágil: reordenar recria as linhas (as expandidas voltam fechadas) porque elas se identificam pela posição; no PJ o editor da engrenagem aberto é fechado ao mover.
- Frágil: o segurar com toque pode virar rolagem da página (o navegador toma o gesto); só foi exercitado com mouse e teclado.
- Compêndio: `armas` e `itens` opcionais em `compendio.ts`; a aba lista os três tipos quando o arquivo traz armas ou itens. `compendio-entrada-arma` e `compendio-entrada-item` são as linhas arrastáveis; `compendio-item` segue sendo só a linha de magia. O botão "Adicionar à ficha" da magia e o "Adicionar" de arma e item passam por `aplicarEntradaNaFicha`.
- Dados novos da ficha e regra de proficiência por ND: `bonusDeProficiencia` olha `npc.nd` antes do nível das classes.

## V4b2 (2026-11-12): Conjuração do NPC e o nome com a capitular

- Seção Conjuração do NPC: `ficha/ConjuracaoDoNpc.tsx` (`SecaoDeConjuracao` é a página da fita Conjuração do `BlocoDoNpc`, V8). Os dados são os do personagem (`magias`, `espacosTotal`, `espacosGastos`, `habilidadeDeConjuracao`): não crie campo paralelo. Desde o Q9 os círculos são o `CirculoDeMagias` de `ficha/CirculoDeMagias.tsx` (variante `"npc"`), o mesmo da aba Magias; a variante só troca os testids, esconde o "Prep." e abre o editor da engrenagem embaixo da linha. Mexeu na linha de magia ou no círculo, mexeu nas duas fichas. Reaproveita `Espacos` e `subDaMagia` (reexportados por `AbaMagias.tsx`), `conjurar.ts` e `EditorDeAtaque`. O título de seção do bloco (`TituloDoBloco`) mora em `livro.tsx`. Testids: `npc-secao-conjuracao`, `npc-conj-cd`, `npc-conj-ataque`, `npc-conj-habilidade`, `npc-conj-nivel-<n>`, `npc-conj-item-<i>` (linha), `npc-conj-magia-<i>` (abre/recolhe), `npc-conj-nome-<i>`, `npc-conj-conjurar-<i>`, `npc-conj-chat-<i>`, `npc-conj-mais-circulo`, `npc-recuperar-espacos`, `npc-espaco-<n>-<k>`, `npc-espaco-total-<n>`, `npc-nova-conjuracao`.
- A magia solta no NPC: `aplicarEntradaNaFicha(..., "npc")` em `compendioParaFicha.ts` (sem classe nem atributo escolhido, grava também `habilidadeDeConjuracao`). `useSoltarDoCompendio.listaDoTipo` aceita uma função da entrada e há a opção `fluxo` (chips lado a lado) em `ordem.tsx`; listas `npc-circulo-<n>`.
- Frágil: o manipulador de foco de `NomeComCapitular` troca o valor do input direto no DOM (antes do render) para o preenchimento por código (Playwright `fill`) substituir o texto em vez de anexar ao fim. Não passe isso para um `useEffect`.
- Suposição: a seção existe com magias, atributo ou total de espaços escolhido; sem isso só o "+ Conjuração" de quem edita. Ver `REDESIGN`, "V4b2".

## B1 (2026-11-12): importador do Rendan, "Ficha de", aviso e chips

- Importador: o PDF do Rendan (`fixtures/fichas/brendan.pdf`, esperado em `brendan.json`) tem o campo "Classe & nível" cortado com "…". `classeDeTextoCortado` e o nível pelos dados de vida estão em `importarFichaPdf.ts` (no cabeçalho); as tabelas de raça, tendência, antecedente e idioma, em `importarTraducoes.ts` (puro; nome desconhecido fica como veio). Frágil: o nível só é lido assim para uma classe; antecedente, raça e tendência só leem itens que começam na coluna do rótulo (`valorDe(..., daColuna)`).
- `AbaCompendio.tsx`: `useAlvoDaFicha` segue a ficha em foco (`useFichasNaPilha` em `janelas/pilha.ts`); a escolha à mão vale até o foco mudar (reset durante o render).
- Aviso das fichas: `JanelaDaFicha` recebe `avisar` (o toast `AvisoPerto`, testid `aviso`); o `ficha-aviso` não existe mais. `AvisoPerto` tem `role="status"` sem código de erro e `alert` com código (o `biome-ignore` de `noStaticElementInteractions` é por isso).
- Conjuração do NPC: `.npc-conj-chips` ocupa a linha toda (`ficha.css`). Ver `REDESIGN`, "B1".

## V6 (2026-11-12): conjurar com espaço maior, dano por nível e "mandar ao chat"

- Onde mexer: regras puras em `packages/shared/src/conjuracao.ts` (`opcoesDeEspaco`, `porNivelAcimaDoTexto`, `porNivelAcimaDaMagia`, `extraDeEspaco`, `multiplicarExpressao`); o dado a mais é rolado na sala por `rolarEspaco` (`rolagens.ts`), chamado de `chatnucleo.ts`; o bloco é desenhado por `BlocoDoEspaco` em `MensagemDoChat.tsx` (CSS `.cartao-colado` e `.bloco-espaco` no `styles.css`); o menu reaproveita `MenuDeContexto` (prop nova `aoTeclar`) num portal.
- Testids: `menu-espaco` (e `menu-espaco-<nível>` ou `menu-espaco-pacto`), `magia-pingar-<i>`, `npc-conj-pingar-<i>`, `ataque-pingar-magia-<i>`, `editor-por-nivel-acima`, `bloco-espaco`, `bloco-espaco-titulo`, `bloco-espaco-total`, `bloco-espaco-metade`, `espaco-usado`, `magia-chat-espaco`.
- Frágil: o Conjurar sem escolher o espaço não faz nada (`conjurar(props, m, opcao)` exige a opção para magia de nível 1 ou mais): todo botão novo de conjurar precisa passar pelo `useConjurar`. O "por nível acima" automático lê só o português do SRD de exemplo; texto fora dos padrões fica vazio.
- Frágil: o bloco colado depende de `.cartao-colado > .modelo-bloco` (o cartão de cima perde a borda de baixo); mexer no CSS do `.modelo-bloco` pode abrir uma fresta entre os dois.
- Suposições: ver `REDESIGN`, "V6 — como ficou".

## C4 (2026-11-12): a tela inicial em abas

- Onde mexer: `apps/web/src/TelaInicial.tsx` (`TelaInicial`, `MinhasMesas`, `EntrarNumaMesa`, `CriarMesa`, `CartaoMesaCriada`) e o bloco `.inicio-*` no **fim** de `styles.css` (fica no fim de propósito: vence os `.nota` e `.campo-de-conta` mais antigos sem subir a especificidade, e o biome reclama de `noDescendingSpecificity` se mudar de lugar).
- Frágil: as três abas ficam montadas (`hidden`), por isso o digitado sobrevive à troca de aba; o passo de Criar volta a 1 por um efeito em `ativa`. A altura do cartão é fixa (520/440 px): conteúdo novo rola por dentro.
- Os E2E que passam pela tela inicial usam `abrirAbaInicial`, `preencherMesaEConta` e `continuarParaAPasta` (`e2e/tests/ajudas.ts`).
- Suposições: ver `REDESIGN`, "C4 — como ficou".

## V9 (2026-11-12): a ficha numa janela própria do navegador

- Onde mexer: `ficha/foraDaMesa.ts` (abrir a janela, medida guardada, Web Locks e `BroadcastChannel`; `useAcompanharFichasFora` na `Mesa`, `useFichasFora` na lista de Fichas e no compêndio), `ficha/FichaEmJanelaPropria.tsx` (a página da rota: `useSala` própria, gerente de arquivos, toast), `ficha/JanelaDaFicha.tsx` (props `aoAbrirEmJanela` e `propria`), `rotas.ts` (`caminhoDaFicha`, `Rota.fichaId`), `App.tsx` e o fim do `styles.css` (`.ficha-propria*`, `.selo-fora`).
- Testids: `ficha-abrir-em-janela`, `ficha-voltar-para-mesa`, `ficha-propria`, `ficha-propria-pagina`, `ficha-propria-sumiu`, `ficha-propria-fechar`, `ficha-fora-<id>`.
- A sala não mudou: a presença já é por usuário. Se algum dia ela passar a contar conexões, a janela da ficha vira presença a mais.
- Frágil: a janela da ficha repete a montagem do gerente de arquivos da `Mesa` (`FichaEmJanelaPropria`); mudança em um dos dois precisa ir no outro.
- Frágil: o `abrirFicha` da `Mesa` passa por `abrirOuTrazerFicha`; todo caminho novo de abrir ficha precisa usá-lo (senão abre uma segunda cópia na mesa).
- Frágil: o navegador pode ignorar `left`/`top`; arrastar entre janelas não funciona; Web Locks só em endereço seguro.
- Suposições: ver `REDESIGN`, "V9 — como ficou".

## V8 (2026-11-12): ficha de NPC com fitas, sem moldura e em duas colunas

- Onde mexer: `ficha/BlocoDoNpc.tsx` (`pagina`: "bestiario" ou "conjuracao"; as fitas, o teclado e o alvo da magia solta), `ficha/JanelaDaFicha.tsx` (a aba `magias` da janela guarda a Conjuração do NPC; `npcMostraConjuracao` decide se a fita existe), `ficha/ConjuracaoDoNpc.tsx` e o fim de `ficha.css` (`npc-barra`, `npc-fitas`, `npc-col-esq`/`npc-col-dir`, `npc-conj-circulos`).
- Testids novos: `npc-fita-bestiario`, `npc-fita-conjuracao`, `npc-painel-<pagina>`. Saiu `npc-conj-chat-<i>` (ficou `npc-conj-pingar-<i>`).
- Frágil: três containers (`npc` na página, `npcesq` e `npcdir` nas colunas); regra de largura dentro de `@container` precisa do prefixo `.fl-raiz` para vencer a regra-base.
- Frágil: o corpo da ficha do NPC pinta o fundo pelo `:has(> .npc-pagina)`.
- Suposições: ver `REDESIGN`, "V8 — como ficou".

## V7 (2026-11-12): fim das vagas "Jogador N"

- Onde mexer: `packages/shared/src/membros.ts` (`membrosDaMesa`, `jogadoresDaMesa`, `fichasSemMembro`, `derivarMembros`, `planejarAceite`); a sala monta `estado.membros` em `enviarSnapshot` (`membrosIds`, `difundirSnapshots`) e aceita em `ligarVaga`/`darFichaA` (`acaoDoMestre`); web em `contas/SecaoDeContas.tsx` ("Ficha dele"), `AbaMesa.tsx`, `PresencaNoTopo`, `JanelaDoHandout`, `EditorDoItem`, `AbaFichas`, `Mesa.tsx`.
- Testids: `conta-ficha-<login>` (no lugar de `conta-vaga-<login>`), `excecao-sem-jogadores`.
- Frágil: lista de pessoas nova = `jogadoresDaMesa(estado)`; `estado.usuarios` só para achar o nome de uma referência (vaga escondida). `estado.membros` ausente significa "todos" (testes de unidade).
- Frágil: com MODO=teste a vaga vira membro ao `entrar`, ao abrir o socket ou ao sobreviver ao `/teste/zerar` (`meta.presentes_teste`); spec novo que espera ver uma vaga sem ninguém ter entrado nela vai falhar de propósito.
- Frágil: vagas escondidas nunca são apagadas; o limite (`MAXIMO_DE_VAGAS`, 12) reaproveita uma sem dono.
- Suposições: ver `REDESIGN`, "V7 — como ficou".

## C1 (2026-11-12): várias mesas, ids amigáveis e a tela inicial

- Mapa: ids em `packages/shared/src/mesas.ts`; diretório em `apps/server/src/diretorio.ts` e `registroDeMesas.ts`; inicialização do DO em `inicializacao.ts`; rotas no `index.ts` do Worker; web em `rotas.ts`, `TelaInicial.tsx`, `IdDaMesa.tsx`, `App.tsx`.
- Frágil: a mesa legada é o DO `"campanha"` (`ctx.id.name`); a migração de DO `v2` do `wrangler.jsonc` só acrescenta (nunca edite a `v1`). A lista de mesas depende de `LISTAR_MESAS=1` (`--var` nos scripts `dev` e `dev:e2e` do servidor).
- Suposições novas (assumido): ver `REDESIGN`, "C1 — como ficou". O cookie era `tabletop_sessao` por mesa (agora só em `MODO=teste`; ver C2); o renomear é uma rota; a memória do mapa passou a ser por mesa no C2.
- Os E2E abrem `/m/t3st-m3sa-e2e7` (`CAMINHO_DA_MESA` em `e2e/tests/ajudas.ts`); WebSocket cru: `/api/m/t3st-m3sa-e2e7/ws`.

## C2 (2026-11-12): contas por mesa, pedidos de entrada, sessões e redefinição

- Mapa: regras puras e derivação em `packages/shared/src/contas.ts`; contas, hash, sessões e limites em `apps/server/src/contas.ts` (`ContasDaMesa`); cookies em `autenticacao.ts`; rotas na `Sala` (`rotaDeConta`, `acaoDoMestre`, `identificar`) e lista fechada de rotas no Worker (`caminhoInterno` em `index.ts`); web em `contas/` (`EntradaDaMesa`, `SecaoDeContas`, `TrocarSenha`, `CampoDeConta`), `api.ts` (funções de conta) e `TelaInicial.tsx` (criar mesa com conta).
- Frágil: a migração 10 do `Armazenamento` nunca se edita (só se acrescenta); as tabelas `contas`, `sessoes` e `limites_ip` ficam fora de `entidades` de propósito (a importação apaga e a exportação lê `entidades`). O `/teste/zerar` apaga as contas da legada de teste.
- Frágil: quem identifica é a sala, pelo cookie. O Worker não confia em nada que o navegador mande em `x-tavola-*`. `MODO=teste` liga o login solto (`tabletop_sessao`), `entrar`, `usuarios` e a criação de mesa sem mestre: **nunca** suba o servidor de verdade com essa variável.
- Frágil: a "requisição local" (conta do mestre da legada) depende do host e de `CF-Connecting-IP`; confira de novo ao ir para a internet.
- Frágil: fechar socket com 4001 faz o cliente perguntar `eu`; se a rota mudar, ele não volta à entrada (`useSala.ts`).
- Os E2E de conta usam derivação real (600.000 iterações): cada login leva cerca de 1 s.
- Suposições novas (assumido): ver `REDESIGN`, "C2 — como ficou".

## C3: chave da pasta e código de recuperação (2026-11-12)

- Onde mexer: `packages/shared/src/recuperacao.ts` (código, ECDSA, esquemas), `apps/server/src/contas.ts` (`registrarChave`, `gerarCodigo`, `emitirDesafio`, `recuperarPelaPasta`, `recuperarPeloCodigo`, `limite`), `apps/server/src/origem.ts` (Origin), migração 11 em `armazenamento.ts`, rotas `conta/chave|codigo|recuperar/*` na `Sala` e em `index.ts`; web em `contas/pastaDoMestre.ts`, `CodigoDeRecuperacao.tsx`, `ProtecaoDoMestre.tsx`, `EntradaDaMesa.tsx`, `TelaInicial.tsx`.
- Frágil: a pasta de teste (`window.__tabletopPastas`) só existe no modo e2e; o arquivo `tavola-mestre.json` é a prova de mestre (quem o tem recupera a mesa); o código de recuperação só aparece uma vez; o Origin aceita loopback em pedido local.
- Suposições: ver REDESIGN, "C3 — como ficou".

## 7b-1 (2026-11-13): o motor das automações

- Onde mexer: `packages/shared/src/automacoes.ts` (schemas e leituras puras: ciclo, fase, reação, ação, condição, evento, efeito, `Estado.automacoes`, `converterAutomacoesDoArquivo`), `automacoesnucleo.ts` (o motor: `executar`, `eventosDoSistema`, `rodarAutomacoes`, `tratarAutomacao` com as dez intenções), `nucleo.ts` (`processar` chama o motor depois de toda intenção com eventos; `processarSistema` o chama no alarme; `processarEvento`; `visaoPara` e `eventoPara` tiram a definição do jogador), `luz.ts` e `objetos.ts` (`raioSomaM` e `somaDeRaioM`), `apps/server/src/armazenamento.ts` (chaves `automacoes` e `efeitos` da `meta`) e `sala.ts` (`automacao.marco` em `reagendarLuzes` e no `alarm`). Na tela: `Mesa.tsx` (`limitarAlcance`, limite de visão), `mapaPixi.ts` (anel da luz com `raiosEfetivos`) e `MensagemDoChat.tsx` (aviso "A mesa").
- Frágil: a definição de automação **nunca** pode sair em `visaoPara`/`eventoPara`; quem criar campo ou evento novo nesta fatia precisa derrubá-lo para o jogador (e acrescentar o frame ao teste de sigilo em `automacoes.test.ts` e `automacoes.spec.ts`).
- Frágil: os eventos do sistema vêm da diferença entre estados; uma mudança de objeto que não passe por um evento de protocolo não dispara reação.
- Frágil: o `packages/shared` roda no Vite sem compilar: sem propriedade de parâmetro no construtor, sem enum.
- Sem migração SQL: as automações estão em duas chaves da `meta`. A importação as troca (`salvarTudo`), o `apagarTudo` as apaga.
- Suposições novas (assumido): ver `REDESIGN`, "7b-1 — como ficou".

## 7b-3 (2026-11-13): o editor, os botões e as campanhas prontas

- Onde mexer: `apps/web/src/automacoes/` (`JanelaDasAutomacoes.tsx` a lista, `FormularioDoCiclo|DaReacao|DoBotao.tsx`, `Editor.tsx` a moldura e o "Ver como JSON", `campos.tsx`, `erros.ts` os erros do zod em português, `rascunho.ts` o rascunho por caminho e os rótulos das ações e condições, `ChipsDaBarra.tsx` os chips, `resumo.ts`); `AbaMesa.tsx` (seção Automações e a lista de exemplos), `Mesa.tsx` (janela e chips), `Topo.tsx` (`botoes`), `campanhasDeExemplo.ts`, `Campo.tsx` (`CampoDecimal`), `decimal.ts`, `janelas/geometria.ts` (`dasFerramentas`). Na `shared`: `automacoes.ts` (`botoes`, `fixado`, `botoesParaJogador`, `situacaoDoCiclo`, nomes amigáveis dos eventos, limite de frequência), `automacoesnucleo.ts` (`botao.criar|editar|apagar`, `intencaoDoBotao`), `nucleo.ts` (`botao.usar`, `visaoPara` e `eventoPara` dão ao jogador só `botoes`), `protocolo.ts`; na sala: `sala.ts` (`ultimoBotao`). As campanhas: `fixtures/campanhas/`.
- Frágil: o jogador recebe `Estado.botoes` e `botoes.alterados`, só o rótulo. Campo novo no botão não vai ao jogador sem decisão e sem teste de sigilo.
- Frágil: `botao.usar` não tem capacidade; a conferência é a liberação, dentro de `intencaoDoBotao`. Quem criar um botão novo precisa passar por lá.
- Frágil: o rascunho do formulário é um objeto no formato do schema, editado por caminho (`definir`/`ler`); o id novo acompanha o nome até o `id` ser mexido no JSON. Campo novo de ação ou condição precisa de rótulo em `rascunho.ts`, campos em `FormularioDaReacao.tsx` e rótulo de erro em `erros.ts`.
- Frágil: a lista de exemplos troca `usuarios` e `permissoes` do arquivo pelos da mesa; sem isso a sala recusa a importação.
- Frágil: no topo, os menus não encolhem (`min-width: min-content`); quem cede é o nome da cena e o chip. Item novo no topo precisa caber ou ceder do mesmo jeito.
- Sem migração SQL: `botoes` e `fixado` são opcionais com padrão na leitura.
- Suposições novas (assumido): ver `REDESIGN`, "7b-3 — como ficou".

## 7b-2 (2026-11-13): as zonas das automações

- Onde mexer: `packages/shared/src/zonas.ts` (schemas, `pontoNaZona`, `posicaoDoObjeto`, `entradasESaidas`), `automacoes.ts` (`zona.ativar`, `dentroDaZona`, `fica` de zona, `zonaId` do evento), `automacoesnucleo.ts` (`sincronizarZonas`, os alvos da reação de zona, `eventosDoSistema`), `nucleo.ts` (redutor, as três intenções, duplicar e apagar cena, `visaoPara`, `eventoPara`, `lerExportacao`), `protocolo.ts`, `apps/server/src/armazenamento.ts` (coleção `zonas`). Na tela: `mapa/mapaPixi.ts` (`desenharZonas`, `apertarComZonas`, `fecharZona`, gesto `vertice`), `PainelDasZonas.tsx`, `BarraDeFerramentas.tsx`, `Mesa.tsx` (`criarZona`, `apagarZonaAtual`, tecla Z) e `atalhos.ts`.
- Frágil: a zona e as reações dela **nunca** saem em `visaoPara`/`eventoPara` (acrescentar o frame aos testes de sigilo se criar campo novo).
- Frágil: o efeito da zona é **reconciliado** (ids `zona:...`): quem criar outro tipo de modificador ou efeito não pode usar esse prefixo.
- Frágil: os schemas de mudanças (`MudancasDaZonaSchema` e os de ciclo e reação em `protocolo.ts`) não podem herdar os padrões do campo: o `.partial()` do zod os aplica e editar só o nome zeraria o resto.
- Sem migração SQL: coleção `zonas` da tabela `entidades`. A importação a troca (`salvarTudo`).
- Suposições novas (assumido): ver `REDESIGN`, "7b-2 — como ficou".

## 12-1 (2026-11-13): o acesso do Claude (sala e web)

**Onde mexer**
- Token e conexão: `apps/server/src/contas.ts` (`gerarTokenDoClaude`, `revogarTokenDoClaude`, `resolverTokenDoClaude`, `revogarTokensDaConta`), `sala.ts` (`abrirSocket` com `Authorization`, `rotaDoToken`, a marca `claude` no `Identidade`, o balde de fichas, `usuariosComClaude`, `anotarNoDiario`, `desfazerLote`, `enviarLotes`), `armazenamento.ts` (migrações 13 e 14; `anotarLote`, `lotesDe`, `passosDoLote`), `index.ts` (`caminhoInterno`: `conta/claude`, `claude/gerar`, `claude/revogar`).
- Regras puras em `packages/shared`: `claude.ts` (formato do token, **a lista de proibidos**, o balde, o teto de 20 e `idDaPastaDoJogador`), `rascunhos.ts` (`carimbarRascunho`, `listarRascunhos`, `eventosDePublicacao`, `intencaoDeDescarte`), `desfazer.ts` (`diffDoEstado`, `desfazerPassos`), `nucleo.ts` (`OpcoesDeProcessar`, `podeCriarDoJogador`, `garantirPastaDoJogador`, `negarHandout`, os casos `rascunho.*` e `claude.desfazer`; os filtros de rascunho estão em `tokenVisivelPara`, `pastaVisivelPara`, `handoutVisivelPara`, `personagemVisivelPara`, `pontoVisivelPara`, `luzVisivelPara`, `modelosParaJogador`, `botoesParaJogador` e no motor das automações).
- Web: `apps/web/src/claude/` (`ConectarOClaude.tsx`, `RascunhosDoClaude.tsx`, `textosDoClaude.ts`), `useSala.ts` (`claudeConectado`, `lotesDoClaude`, o aviso do `claude.desfeito`), `AbaFichas.tsx` ("Nova ficha" e "Novo handout"), `JanelaDoHandout.tsx` e `EditorDoItem.tsx` (o dono edita), `PresencaNoTopo.tsx` (a marca) e `MensagemDoChat.tsx` ("pelo Claude").

**Frágil**
- O **carimbo de rascunho** vive no `emitir` do `processarIntencao`: qualquer evento de criação novo que o Claude do mestre dispare precisa estar em `carimbarRascunho` (e o tipo em `TIPOS_DE_RASCUNHO`, `eventosDePublicacao`, `intencaoDeDescarte` e `listarRascunhos`), senão o item nasce já publicado.
- Quem criar um **tipo novo de entidade** precisa decidir o rascunho (filtro em `visaoPara` e `eventoPara`) e o Desfazer (`COLECOES_DESFAZIVEIS` e os dois `switch` de `desfazerPassos`).
- O **diário** compara o estado antes e depois **por coleção e id**: o que não está em `COLECOES_DESFAZIVEIS` nunca é desfeito. Mudança de `luzes` que o tempo faz sozinho (consumo da tocha) pode fazer o item contar como "mudou depois" e ser pulado.
- A conexão do Claude é identificada **só** pelo token (anexo do socket). Nunca ler `claude` de um cabeçalho ou de um campo do cliente; o `loteId` e o `lote` do envelope são ignorados em qualquer outra conexão.
- O balde de fichas (20 por segundo, rajada de 40) fica na memória da sala: reiniciá-la o enche de novo.
- O texto de "Conectar o Claude" (`textosDoClaude.ts`) é o comando final desde o 12-2 (ver a seção "12-2" abaixo).
- O `packages/shared` é lido pelo Vite sem compilar: nada de propriedade de parâmetro no construtor nem enum.

**Suposições**: ver `docs/REDESIGN.md`, "12-1 — como ficou".

## 12-2 (2026-11-13): o servidor MCP (`apps/mcp`)

**Onde mexer**
- `apps/mcp/src/sala.ts`: a conexão (WebSocket nativo com `Authorization`, `reduzir`, reconexão, a sonda HTTP que separa 401, 429 e 404, o balde de fichas do cliente e a regra de "o que encerra um pedido": evento, `erro`, snapshot ou, só no Desfazer, `claude.desfeito`). `config.ts` (as variáveis de ambiente), `nomes.ts` (nome para id, com os erros claros), `fichaPorPartes.ts` (a ficha montada por partes, PV por classe, compêndio), `compendioLocal.ts` (o arquivo local de magias, armas e itens), `formato.ts` (os resumos e o texto das rolagens), `servidor.ts` (o `tools/list` por papel, a chamada, o filtro que esconde o token) e `ferramentas/*.ts` (uma por arquivo; `ferramentas/index.ts` é a lista e `base.ts` o que todas usam: `passo`, `Relatorio`, `cadaItem`).
- Teste: `apps/mcp/src/testes/salaSimulada.ts` roda as regras de verdade (`processar` com a marca do Claude) no lugar da sala; `ferramentas.test.ts`, `fichaPorPartes.test.ts`, `nomes.test.ts`, `sala.test.ts`. E2E: `e2e/tests/claude-12-2.spec.ts` e `ajudasMcp.ts` (sobe o arquivo gerado, em stdio, com o cliente do SDK).
- Texto da tela: `apps/web/src/claude/textosDoClaude.ts` e `ConectarOClaude.tsx`. Instruções: `docs/MCP.md`.

**Frágil**
- **Ferramenta nova ou intenção nova**: a ferramenta precisa de `visivel` (papel e capacidade), de lote (`ctx.novoLote` e o mesmo `lote` em todo `passo`) e de um teste na `salaSimulada`. Intenção que o Claude não pode usar já está em `PROIBIDAS_AO_CLAUDE`; o MCP nem a oferece.
- **O que encerra um pedido** (`sala.ts`): um snapshot novo conta como resposta de qualquer pedido, menos do `claude.desfazer`. Um pedido que não gera evento para quem o fez (edição sem mudança real) só termina pelo prazo de 2,5 s (`TAVOLA_ESPERA_MS`); por isso as ferramentas não mandam edição que não muda nada. Quem criar uma intenção nova que responde de outro jeito precisa ensinar a `Sala`.
- **O servidor roda do arquivo gerado**: depois de mudar `apps/mcp` ou o `shared`, rode `pnpm --filter @tabletop/mcp build` (o E2E e os prints o fazem sozinhos). O `build` embute o `shared` e o compêndio de exemplo; o Claude Code só vê a mudança ao reiniciar o servidor (`/mcp`).
- **Os esquemas de entrada vêm do zod** e a lista de campos é `.strict()`: campo que não existe é erro (para a IA não achar que "forca" foi aplicado). Mudar um schema do `shared` muda a ferramenta; confira `ferramentas.test.ts` ("as definições que a IA recebe").
- Mensagens de erro do zod saem em português porque o `index.ts` faz `z.config(z.locales.ptBR())`; isso vale só no processo do MCP.
- O compêndio do MCP é um arquivo do computador (`TAVOLA_COMPENDIO`), não o da mesa: os dois podem diferir.
- O token passa por um filtro (`redigir`) nas respostas, por garantia; a regra é nunca o ter em nenhum texto. Cuidado ao acrescentar `console.error`: o stdout é do protocolo, e o stderr não pode levar o token.
- O `packages/shared` é lido pelo Vite sem compilar: nada de propriedade de parâmetro no construtor nem enum (o `apps/mcp` não tem essa restrição, mas o que ele importa do `shared` sim).

**Suposições**: ver `docs/REDESIGN.md`, "12-2 — como ficou". As que mais valem uma olhada: o MCP não leva o grupo para outra cena nem dispara eventos (são ações ao vivo); o tamanho da cena não se muda (60 x 45 m); o compêndio não tem monstros; criar ou editar pelo nome exato.

## N1 (2026-11-13): vida e CA no token, "morto" e a camada pelo clique direito
**Onde mexer**
- `apps/web/src/MarcasDoToken.tsx` (as marcas, o campo da vida e a tecla `E`), `vidaDoToken.ts` (o texto "12", "-7", "+3" vira operações de ficha), `MapaPixi.tokenNaTela(id)` (posição e raio na tela, para pendurar as marcas), `desenharXDeMorto` e o `morto` em `chaveDe`/`atualizarEstilos` (`mapaPixi.ts`), `MenuDoToken.tsx` (morto e Camada), `Mesa.tsx` (`marcasDoTokenVisiveis`). Dado: `Token.morto?` e `token.condicoes` com `morto` (`combatenucleo.ts`).
- Teste: `e2e/tests/n1.spec.ts`; o gancho `tokens()` ganhou `morto`.

**Frágil**
- As marcas são DOM por cima do canvas, posicionadas a cada quadro por `requestAnimationFrame`; o contêiner tem `pointer-events: none` e só os botões pegam o ponteiro (senão o mapa deixaria de receber cliques). Não mexa em `.area-mapa` sem olhar `.mvc-marcas`.
- Quem vê as marcas é decidido em `Mesa.tsx` (mestre ou `controlaToken`), não no mapa; o jogador só seleciona o próprio token (V2) por regra do `mapaPixi.ts`. A sala não filtra nada novo: a vida vem da ficha, que o jogador já só recebe se vê.
- A tecla `E` é global (ouvida no `MarcasDoToken`, com foco no mapa ou em nada e sem diálogo aberto).
- O X mora dentro do `container` do token (muda o `chaveDe`, então o token é refeito ao marcar).

## N2 (2026-11-14): conjuração completa (inata, truques por nível, ritual, dardos por nível)
**Onde mexer**
- Regras puras em `packages/shared/src/conjuracao.ts` (`lerPorNivelAcima`, `quantidadeDaConjuracao`, `dadosPorNivelDoTexto`, `extraDoTruque`, `somarExpressoes`, `nivelParaTruque`, `magiaInataParaRolar`, `usosRestantesDaInata`) e `ficha.ts` (`Magia.inata/ritual/dadosPorNivel/quantidadeBase`, `ficha.inata`, `recarregarInata` dentro do `descansoLongo`). Protocolo: `EspacoDoPedido`/`EspacoNoChat` (`ritual`, `inata`, `quantidade`) e `nivelDoTruque` no ataque em `rolagens.ts`; `rolarEspaco` rola cada dardo; `chatnucleo.ts` (`chat.magia` passa o espaço inteiro).
- Web: `ficha/conjurar.ts` (`conjurar` aceita `"ritual"`, `executar` é o fim comum, `conjurarInata`), `ficha/menuDeEspaco.tsx` (item Ritual e tecla `R`), `ficha/ConjuracaoInata.tsx` (a parte inata, usada em `ConjuracaoDoNpc.tsx` e `AbaMagias.tsx`), `MensagemDoChat.tsx` (`BlocoDaQuantidade`, etiquetas) e `CartaoDaMagia.tsx` (`textoDoEspacoNoCartao`). MCP: `mcp/fichaPorPartes.ts` (`conjuracaoInata`), `mcp/formato.ts`, `mcp/ferramentas/{compendio,rolar}.ts`.
- Teste: `e2e/tests/ficha-n2.spec.ts`, `packages/shared/src/conjuracaoN2.test.ts`.

**Frágil**
- A magia inata mora em `ficha.magias` (com `inata`) para reaproveitar o editor, o arrasto e o cartão. **Todo filtro por círculo precisa de `&& !m.inata`** (`ConjuracaoDoNpc`, `AbaMagias`, `aplicarEntradaNaFicha`); uma lista nova de magias por círculo que esquecer isso mostra a inata duas vezes.
- As bolinhas de uso são "cheia = disponível": gastar esvazia a **última**. Os testes olham a última.
- `rolarEspaco` serve a três caminhos (ataque, `/r` e `chat.magia`); ritual e inata nunca têm `extra` nem `quantidade`, e `quantidade` nunca vem com `extra`. Se algum dia vierem juntos, `BlocoDoEspaco` só mostra um.
- O Conjurar sem dano nem acerto (só salvaguarda) agora manda o cartão da magia; antes não mandava nada.
- O NPC não tem botão de descanso na janela: o "Recuperar usos" da parte inata é o único jeito de zerar os usos nele (o personagem usa o descanso longo).

**Suposições**: ver `docs/REDESIGN.md`, "N2 — como ficou".

## N3a (2026-11-14): compêndio com monstros e itens mágicos
**Onde mexer**
- Schemas, junção de arquivos, busca e limites em `packages/shared/src/compendio.ts` (`MonstroDoCompendioSchema`, `ItemMagicoDoCompendioSchema`, `juntarCompendios`, `lerVariosCompendios`, `nomeCanonicoDoArquivo`, `buscarMonstros`, `buscarItensMagicos`, `ARQUIVOS_DO_COMPENDIO`). Conversão para a ficha em `compendioParaFicha.ts` (`monstroParaFicha`, `personagemDoMonstro`, `aplicarItemMagico` dentro de `aplicarEntradaNaFicha`, `magiasDoMonstro`). `EntradaDoCompendio` ganhou `monstro` (com as magias dele) e `itemMagico`.
- Web: `useCompendio.ts` (lê todos os arquivos, junta, registra um asset só; `carregarArquivos`), `assets/fontes.ts` (`abrirArquivosDoCompendio`, `adicionarCompendiosSoltos`), `AbaCompendio.tsx` (seções, barra do mestre), `CompendioMonstros.tsx` (lista e cartão do monstro, itens mágicos), `useAlvoDaFicha.ts` (saiu da aba), `mapa/Mapa.tsx` + `Mesa.tsx` (`soltarDoCompendioNoMapa`). MCP: `mcp/compendio.ts` (`CompendioLocal` com monstros e itens mágicos, `acharMonstro`), `mcp/ferramentas/{compendio,fichas}.ts`, `apps/mcp/src/compendioLocal.ts` (lê a pasta).
- Teste: `e2e/tests/compendio-n3a.spec.ts`, `packages/shared/src/compendioN3a.test.ts`, `apps/mcp/src/compendioLocal.test.ts`.

**Frágil**
- **O bloco do monstro é segredo do mestre só na tela.** A seção Monstros some para o jogador, mas o arquivo do compêndio é um asset só (`Estado.compendio`) que todos baixam: quem abrir a rede do navegador lê os monstros. Proteger de verdade pede um segundo asset só do mestre (estado, filtro da sala e migração): fica para um lote próprio.
- Com mais de um arquivo na pasta, a mesa registra o JSON **junto** (`JSON.stringify`), então o hash muda se a ordem ou o conteúdo mudarem; com um arquivo só, o hash é o dos bytes do arquivo (como antes). O `compendio.definir` guarda `magias` como a contagem do compêndio todo.
- `NIVEIS_DE_DESAFIO` tem ordem explícita porque `Object.keys` põe as chaves inteiras primeiro; não volte para `Object.keys(XP_POR_ND)`.
- "Carregar arquivos" grava pelo conteúdo e soma ao arquivo da pasta; só foi testado com a "pasta" dos testes (a `Memoria`), não com a pasta real do Chrome.
- `monstroParaFicha` não conhece magias fora do compêndio: entram só com o nome. A CD das ações com salvaguarda fecha pelo `cdBonus` e muda se o ND ou o atributo da ficha mudarem.
- O campo "nota" do item no equipamento é de uma linha; a nota do item mágico pode ter até 4.000 caracteres.

**Suposições**: ver `docs/REDESIGN.md`, "N3a — como ficou".

## N3b (2026-11-14): o extrator do compêndio (os PDFs do Vilella)
**Onde mexer**
- `packages/shared/src/extrator/` (fora do `index.ts`: o app não o carrega). `linhas.ts` (itens do pdf.js -> linhas na ordem de leitura, duas colunas, versalete, marcador de lista), `magias.ts` (magias, listas por classe, `juntarLinha` com a hifenização), `monstros.ts` (blocos, cabeçalho, traços e ações, números da ação, conjuração), `itens.ts` (itens mágicos), `livros.ts` (por livro, com o zod e as estatísticas), `relatorio.ts`, `pdf.ts` (pdf.js legado no Node), `cli.ts` (`pnpm compendio:extrair`).
- Teste: `extrator/extrator.test.ts` (só trechos inventados). Guia: `docs/COMPENDIO.md`.

**Frágil**
- Depende do layout dos PDFs: coluna em `w/2` (as listas por classe, 3 colunas, em 205 e 385), caixa de monstro com corpo 9 (prosa 9,5), título de item com corpo 11, trecho "Descrições das Magias" e "Apêndice A:" para achar o começo e o fim das magias. Outro livro ou edição pede ajuste.
- Traços e ações são achados pela fonte do nome (negrito itálico, diferente da fonte do corpo e do rótulo); as fontes mudam de número entre blocos, então a calibração é por bloco (`fonteDoCorpo`, `fonteDoRotulo`).
- A saída do extrator nunca pode ficar no repositório (`cli.ts` recusa); não commite os JSON gerados.

**Suposições**: ver `docs/ESTADO.md`, "Ajustes N3b".
## N4 (2026-11-14): névoa pintada à mão
**Onde mexer**
- Dados e regras puras: `packages/shared/src/nevoa.ts` (`TracoDaNevoaSchema`, `pontoNaNevoa`, `acrescentarTraco`, `compactarNevoa`, `nevoaCobreAlgo`, `simplificarCaminho`, os limites). O campo é `Cena.nevoa` (`estado.ts`); as intenções `nevoa.tracar` e `nevoa.desfazer` estão em `protocolo.ts` (capacidade `cena.editar`) e `nucleo.ts` (`processar`, o redutor `nevoa.tracada`/`nevoa.desfeita` e o filtro `eventoPara`). Persistência: os dois eventos regravam a cena em `armazenamento.ts` (junto de `cena.gridAlterado`).
- Tela: `apps/web/src/mapa/camadaDeNevoa.ts` (textura da névoa e hachura do mestre), `mapaPixi.ts` (seção "névoa pintada à mão": ferramenta, gesto `nevoa`, prévia, `tokenSobNevoa`, `atualizarNevoa`, ganchos de teste `nevoa*`), `PainelDaNevoa.tsx`, o botão em `BarraDeFerramentas.tsx`, o atalho N em `atalhos.ts` e `Mesa.tsx` (`nevoa`, `alternarNevoa`, `controlaNaVisao`).
- Teste: `packages/shared/src/nevoa.test.ts`, o fim de `apps/server/src/armazenamento.test.ts`, `e2e/tests/nevoa.spec.ts`.

**Frágil**
- **A névoa não é segredo.** O jogador recebe a lista de traços da cena ativa e o navegador dele tem todos os tokens e o mapa inteiro; ele só não os desenha. Decisão do Vilella.
- `tokenSobNevoa` usa o centro do token e `controlaNaVisao` (o jogador visto, não o mestre). Quem muda a regra de posse tem de mexer nos dois lugares (`controla` e `controlaNaVisao` em `Mesa.tsx`).
- A lista guarda tudo enquanto cabe (300 traços, 6.000 pontos); só ao estourar é que compacta. O redutor do cliente e o da sala usam a mesma `acrescentarTraco`: mudar a regra de compactação muda o que o desfazer devolve.
- A textura é refeita inteira quando a lista muda (referência nova, quem olha ou o tamanho da cena). Cena de 1000 m de lado usa uma textura de escala bem menor que 0,5 (borda grossa).
- Os E2E precisam esperar a cena virar cartão (`virarCartao`) antes de centrar a câmera: o enquadramento do cartão move a vista.
- A hachura do mestre é um `TilingSprite` mascarado por um segundo sprite com a mesma textura (`mascara`): o objeto usado como máscara no Pixi deixa de ser desenhado, então nunca use o sprite visível como máscara. A hachura é discreta; confira o print do mestre.

**Suposições**: ver `docs/REDESIGN.md`, "N4 — como ficou".

## N5 (2026-11-14): som ambiente

(Q4, 2026-11-16: a trilha única, a trilha da cena e o painel de Som deste lote foram trocados pela mesa de som; veja "Q4" abaixo. O resto do N5 vale: som de zona, `som.tocar`, motor, preferências e o aviso do primeiro som.)
**Onde mexer**
- Dados e contas puras: `packages/shared/src/som.ts` (`TrilhaSchema`, `SomDaZonaSchema`, `AlvoDoEfeitoSchema`, `pontoDaTrilha`, `desvioDoRelogio`, `volumeFinal`, o MIME) e `somnucleo.ts` (`sonsDasZonasParaJogador`, `sonsDasZonasParaTokens`, `efeitoChegaPara`). O tipo de asset `som`, o limite de 20 MB, o MIME e a visibilidade estão em `assets.ts`; `hashesUsados` conta os sons da trilha, das cenas, das zonas e de `som.tocar`.
- Estado e protocolo: `Estado.trilha`, `Cena.trilha` (`estado.ts`), `EfeitosDaZona.som` (`zonas.ts`), as intenções `som.trilha`, `som.parar`, `som.efeito` (capacidade `som.controlar`), `cena.editar { trilha }`, os eventos `som.trilhaAlterada` e `som.efeitoTocado` e a mensagem `som.zona` (`protocolo.ts`); as regras na `nucleo.ts` (intenções, `grupo.moverPara`, `eventoPara`, `visaoPara`, exportação) e a ação `som.tocar` em `automacoes.ts` e `automacoesnucleo.ts`.
- Sala: `apps/server/src/sala.ts` (`atualizarSonsDasZonas`, o nome do som anonimizado em `asset.pedir`, o efeito depois do snapshot em `distribuir`) e `armazenamento.ts` (`carregarTrilha`/`gravarTrilha`, chave `trilha` da tabela `meta`).
- Tela: `apps/web/src/som/` (`motorDeSom.ts` é o motor de áudio; `useSomDaMesa.ts` liga estado e mensagens ao motor; `prefsDeSom.ts`, `EscolherSom.tsx`, `CartaoDeSom.tsx`, `AvisoDoSom.tsx`, `Deslizante.tsx`), `PainelDoSom.tsx`, o "Som enquanto dentro" em `PainelDasZonas.tsx`, o formulário de `som.tocar` em `automacoes/FormularioDaReacao.tsx`, `registrarSom` em `assets/gerente.ts`, `listarSons` em `assets/fontes.ts` e `fonte.ts`.
- Teste: `packages/shared/src/som.test.ts`, o fim de `apps/server/src/armazenamento.test.ts`, `e2e/tests/som-n5.spec.ts` e `ajudasSom.ts` (o wav de silêncio, o gancho `window.__tabletopSom`).

**Frágil**
- **O motor só liga em `iniciar()`**: o modo estrito do React monta, desmonta e monta o hook, e um `encerrar()` definitivo deixava a mesa muda. Mantenha `iniciar` idempotente e `encerrar` sem apagar o que "deve tocar".
- A trilha depende de dois relógios: `inicioMs` (da sala) e `servidorMs` (refeito a cada cópia). Quem muda `visaoPara` ou `eventoPara` sem refazer o `servidorMs` desalinha a trilha de quem entra no meio.
- O som da zona chega ao jogador por mensagem própria (`som.zona`), calculada depois de **todo** `distribuir` e de cada snapshot. Não ponha o hash do som da zona no snapshot nem em evento: é o que mantém a zona secreta. O nome do arquivo também não sai (`asset.pedir` troca por "som" para o jogador).
- O efeito de som é um evento que não muda o estado: o `snapshotPara: "todos"` o engoliria, por isso `distribuir` o reenvia depois do snapshot. Não existe replay de eventos na reconexão: quem estava fora não ouve o efeito (certo).
- Autoplay: o navegador recusa `play()` até um gesto; o motor guarda `bloqueado` e `ativar()` refaz tudo. O gancho de teste `simularBloqueio` finge o bloqueio (o Chrome do Playwright costuma deixar tocar).
- O gancho `__tabletopSom.estado()` informa o que o motor DEVE estar tocando (volume final já com as preferências): não prova que saiu som da caixa.
- Os E2E precisam esperar a meta do som no navegador (`esperarHashDoSom`) antes de usar o hash.
- Problema antigo notado, fora do N5: `armazenamento.ts` apaga `colecao = 'handouts'` no `zona.apagada` (parece que deveria ser `'zonas'`). Confira antes de mexer.

**Suposições**: ver `docs/REDESIGN.md`, "N5 — como ficou".

## 12-3 (2026-11-13): o MCP na própria sala, por HTTP
**Onde mexer**
- `apps/server/src/sala.ts`: `tratarIntencao(remetente, intencao)` é **o único** tratamento de intenção (WebSocket: `webSocketMessage` só lê, chama e responde; HTTP: `conexaoDoMcp` chama com `ws: null`). `rotaMcp` é a rota; `visaoDe(usuario)` é o snapshot do usuário (o WebSocket e as ferramentas leem o mesmo). `apps/server/src/index.ts`: `caminhoInterno` (`mcp` só POST) e o 405.
- `packages/shared/src/mcp` (entrada `@tabletop/shared/mcp`): `jsonrpc.ts` (JSON-RPC puro), `servidor.ts` (`chamarFerramenta`, lista, instruções), `tipos.ts` (`SalaLike`, `Lote`), `compendio.ts`, `ferramentas/*`, `fichaPorPartes.ts`, `nomes.ts`, `formato.ts`, `testes/salaSimulada.ts`. `apps/mcp` ficou com o stdio, a conexão WebSocket (`sala.ts`), `config.ts` e a leitura do compêndio do disco.
- Tela: `apps/web/src/claude/ConectarOClaude.tsx` e `textosDoClaude.ts` (o comando e o remover); o resumo vem de `abas.tsx`.
- Teste: `e2e/tests/claude-12-3.spec.ts`, `ajudasMcp.ts` (`ClienteMcpHttp`, `pedirAoMcp`), `jsonrpc.test.ts`, `textosDoClaude.test.ts`.

**Frágil**
- **Nunca crie um segundo caminho para uma intenção do Claude.** Se uma ferramenta nova precisa de algo, ela chama `ctx.sala.enviar`; quem decide é `tratarIntencao`. Mexer em `tratarIntencao` mexe no WebSocket e no HTTP: rode `claude-12-1` e `claude-12-3`.
- A rota recusa **qualquer** `Origin` e não tem CORS: não "conserte" isso para um cliente de navegador.
- Presença do HTTP: vencimento `claude.http` na agenda (2 minutos; `/teste/claude-http?ms=` encurta no `MODO=teste`). `usuariosComClaude` lê as chaves dele.
- `@tabletop/shared/mcp` entra no Worker: não importe nada de Node nem `z.locales` (traria as línguas do zod); o `servidor.ts` usa `zod/v4/locales/pt-BR.js` só nas ferramentas.
- O `packages/shared` é lido pelo Vite sem compilar (nada de propriedade de parâmetro no construtor nem enum); o `mcp` não é lido pelo Vite, mas o Worker o empacota do mesmo jeito.
- O compêndio pelo HTTP é o exemplo do SRD embutido (`CompendioLocal.doExemplo()`); o do disco só existe no stdio.

**Suposições**: ver `docs/REDESIGN.md`, "12-3 — como ficou".

## M2 (2026-11-14): o Claude faz tudo na preparação e na configuração

**Regra de ouro: intenção nova precisa de entrada na tabela de paridade** (`packages/shared/src/mcp/paridade.ts`). Ela é um `Record<TipoIntencao, ...>`: sem a entrada nem compila; `mcp/paridade.test.ts` confere que a ferramenta e o campo apontados existem. Se a intenção é de preparar, configurar ou conduzir a mesa, ponha uma ação numa ferramenta (`mcp/ferramentas/`); se é segurança, conexão ou gesto da tela, escreva o motivo.

**Onde mexer**
- Ferramentas novas em `packages/shared/src/mcp/ferramentas/`: `mapa.ts`, `tokens.ts`, `mesa.ts`, `som.ts`, `combate.ts`, `chat.ts`; `achados.ts` (cena, ficha, token e som pelo nome); `objetosM2.ts` (tocha e ajustes); `base.ts` ganhou `passoComEspera` (espera o limite de 20 pedidos por segundo). Ampliadas: `cenas` (`duplicarDe`, `levarGrupo`), `automacoes` (`acionar`, `eventos`, `usarBotoes`), `objetos`, `fichas` (`apagar`, `dadoDeVida`, `mochila`).
- `mcp/fonteDeTracos.ts`: o texto no mapa é uma fonte de traços (cada letra são desenhos "livre"; ids `txt-<trecho>-<x>-<n>`).
- `desfazer.ts`: a coleção `desenhos` entrou no Desfazer.
- O texto que o Claude lê ao conectar (`INSTRUCOES` em `mcp/servidor.ts`) tem o roteiro de preparar uma sessão.

**Frágil**
- Mover token pelo Claude usa `token.soltar` (grava); `token.mover` é só o arrasto em andamento e não grava.
- Os ids dos textos carregam o trecho do texto (16 caracteres): `apagar.textos` e `moverDesenhos.texto` procuram por ele. Texto com o mesmo trecho em dois lugares apaga os dois.
- Texto longo gera dezenas de pedidos; o limite do Claude (20 por segundo) é esperado por `passoComEspera`.
- Desenhos do Claude não são rascunho (assumido); cena em rascunho não recebe o grupo (a mesa explica).
- `combate`: o primeiro passo com erro para os seguintes.

## M1 (2026-11-14): o Claude sobe arquivos
**Onde mexer**
- `packages/shared/src/envios.ts` (usos, limites, formato pelos primeiros bytes, segredo do link, `usoDoArquivo`, esquemas das intenções) e `enviosUso.ts` (`negarEnvio`, que usa `processar`; fica à parte para não fechar um ciclo de importação com o protocolo).
- `packages/shared/src/mcp/ferramentas/arquivos.ts` (a ferramenta; `textoDoEnvio`) e `mcp/tipos.ts` (`ArquivosDaSala`, `PedidoDeEnvio`: só a sala HTTP tem a caixa).
- `apps/server/src/caixaDeEntrada.ts` (a caixa sobre o SQLite; migração 16 em `armazenamento.ts`), `contas.ts` (`tokenDoClaudeValido`), `index.ts` (as rotas `claude/envio/<segredo>` e `caixa/<id>`) e, no fim de `sala.ts`, "Os arquivos do Claude (M1)": `rotaDoEnvioDoClaude` (PUT), `baixarDaCaixa` (GET), `concluirEnvio` e `avisarPendentes`.
- `apps/web/src/caixaDoClaude.tsx` (o gancho `useCaixaDoClaude` e o aviso), `useSala.ts` (`pendentesDaCaixa`) e `Mesa.tsx` (liga os dois).
- Teste: `e2e/tests/envio-m1.spec.ts` e `ajudasEnvio.ts` (PNG grande, WAV, o PUT cru), `envios.test.ts`, `mcp/arquivos.test.ts`, `caixaDeEntrada.test.ts`.

**Frágil**
- **O aplicar do uso é da sala, não do navegador.** O navegador só processa, registra (`asset.registrar`) e avisa (`caixa.concluir`); quem faz `cena.definirMapa` e as outras é `tratarIntencao` com o usuário do Claude e o `loteId` do envio. Não mova isso para o navegador: o Desfazer e as permissões deixariam de ser as do Claude.
- Em `concluirEnvio` a sala espera até 2 s o `asset.registrar` aparecer em `estado.assets` (dois frames seguidos do mesmo socket podem se intercalar com um `await` da sala). Se o navegador mudar a ordem (concluir antes de registrar), cai nessa espera.
- A migração 16 é a última da lista: o `versao_esquema` dos testes de migração (`armazenamento`, `contas`, `recuperacao`, `tokensClaude`) agora é "16"; migração nova muda esse número.
- Bytes no SQLite: os bytes da caixa são `BLOB` de até 1 MB por linha (o limite do SQLite do Durable Object é 2 MB por linha). O adaptador dos testes de unidade converte `ArrayBuffer` em visão; o workerd aceita `ArrayBuffer`.
- O corpo do POST do MCP é 512 KB, salvo se o texto cita `"arquivos"` (4 MB): o `claude-12-3.spec` confere o 413 com um corpo de 600 KB sem essa palavra.
- O PUT descarta o corpo (até 128 MB) quando recusa antes de ler; sem isso o proxy do Vite devolve 502 em vez do motivo.
- O mesmo arquivo enviado como token e como retrato dá o mesmo hash (a mesa guarda um asset só); o `listar` mostra o nome do primeiro.
- O MCP em stdio (`apps/mcp`) não tem a caixa: `arquivos` responde que precisa do HTTP.

**Suposições**: ver `docs/REDESIGN.md`, "M1 — como ficou".

## Q1 (2026-11-16): ajustes do Vilella e os arquivos entre navegadores
**Onde mexer**
- Cópia na pasta: `apps/web/src/assets/gerente.ts` (`guardarNaPasta`, `sincronizarComAPasta`, `PASTA_DOS_ARQUIVOS_DA_MESA`) e `assets/fontes.ts` (`pastaDosArquivos()`). `Mesa.tsx` chama `sincronizarComAPasta(estado.assets)` num efeito que reage à pasta (`fontes.versaoAtual`), ao estado dos assets e à conexão.
- Aviso da pasta: `apps/web/src/AvisoDaPasta.tsx` (`casoDaPasta`, `AvisoDaPasta`, `BotaoDaPasta`, `useCasoDaPasta`); a aba Compêndio usa o mesmo caso. Estilo `.aviso-pasta` no alto da área do mapa.
- "Abrir ficha": `MenuDoToken.tsx` (`aoAbrirFicha`), ligado ao `abrirOuTrazerFicha` da `Mesa.tsx`.
- Transferências: `.transferencias` no `styles.css`.
- Doc para o Vilella: `docs/ARQUIVOS.md`.
- Testes: `e2e/tests/q1.spec.ts`; ganchos novos do modo e2e em `assets/ganchoE2E.ts` (`simularPasta`, `exportarPasta`, `importarPasta`).

**Frágil**
- A "pasta" dos testes é a `Memoria`; `Fontes.simularPasta` a faz valer como pasta com o estado que o teste quiser. Com a simulação ligada, `escolherPasta` e `reautorizar` só mudam o estado simulado (não há seletor no Playwright). O seletor e a permissão de verdade só se conferem à mão (roteiro Q1).
- `sincronizarComAPasta` roda em fila (uma de cada vez) e varre as metas da mesa a cada mudança de `estado.assets`: com centenas de arquivos é uma `getFileHandle` por arquivo que falta. Hoje é barato; se pesar, guardar em memória o que já foi conferido.
- A cópia só vale com a pasta autorizada; sem isso o cache segue sendo a única fonte. O aviso "escolher" só aparece se algum asset está `indisponivel` (nenhum online manda).
- A pasta `arquivos-da-mesa` está em `PASTAS_IGNORADAS` (`assets/fonte.ts`): não aparece como biblioteca de imagens nem de sons.
- Entrar como mestre pela chave da pasta (`EntradaDaMesa.tsx`) agora chama `lembrarPara`; nas pastas de teste (`pastaDoMestre.ts`) isso não faz nada.
- Preferências não lista mais os lotes do Claude: `lotesDoClaude` ainda vem de `useSala.ts`, mas nada o mostra. O Desfazer é só do MCP.
- `campanhasDeExemplo.ts` saiu; `fixtures/campanhas/*.json` seguem usadas pelos testes (`campanhasProntas.test.ts` e `automacoes-editor.spec.ts`).

**Suposições**: ver `docs/REDESIGN.md`, "Q1 — como ficou".

## Q2 (2026-11-16): o compêndio por seções, com blocos e busca em português e inglês
**Onde mexer**
- Lógica pura: `packages/shared/src/compendioSecoes.ts` (`agruparMagiasPorNivel`, `agruparMonstrosPorND`, `agruparItensMagicosPorRaridade`, `agruparArmas`, `casaComABusca`, `buscarEmTodas`, `SECOES_DO_COMPENDIO`) e `sintonizacao` em `buscarItensMagicos` (`compendio.ts`). Testes em `compendioSecoes.test.ts`.
- Blocos: `apps/web/src/CompendioBlocos.tsx` (`BlocoRecolhivel`, `BlocosDoCompendio`, `useBlocosAbertos`, `NomeOriginal`). O que a pessoa abriu fica em `tabletop:pref:compendio-blocos` (`preferencias.ts`, `lerBlocosDoCompendio`). Estilo `.bloco-do-compendio*` e `.nome-original` no fim do `styles.css`.
- Telas: `AbaCompendio.tsx` (seletor de seção, `ListaDeMagias`, `SecaoTodas`, `ListaDeEntradas` para armas e itens) e `CompendioMonstros.tsx` (`ListaDeMonstros`, `ListaDeItensMagicos`, ambos com `modoTodas`).
- Extrator: `packages/shared/src/extrator/nomes.ts` (`lerTabelaDeNomes`, `aplicarNomesOriginais`) e a opção `--nomes` do `cli.ts`.
- Testes: `e2e/tests/compendio-q2.spec.ts` (arquivo de teste gerado no próprio spec, com 30 magias de enchimento para passar do limite que abre tudo).

**Frágil**
- Os `data-testid` dos blocos vêm do rótulo do grupo: `compendio-bloco-<seção>-<chave>` (a chave do ND "1/4" vira `1_4`; em "Todas", `compendio-bloco-todas-<seção>`). Os testes dependem disso.
- Seção com 24 entradas ou menos abre todos os blocos por padrão (`LIMITE_PARA_ABRIR_TUDO`). Os E2E antigos contam com isso (o exemplo do SRD é curto); um compêndio de teste maior precisa abrir o bloco antes.
- Em "Todas" cada lista de seção roda com `modoTodas` (sem filtros, contagem nem "Ficha de"); o "Adicionar" usa a ficha em foco (`useAlvoDaFicha`). A lista de monstros guarda o cartão aberto no próprio estado: ao fechar o bloco ele some junto.
- A ordem das magias na lista é por nível; quem espera a lista alfabética geral (como o E2E antigo `compendio.spec.ts`, "filtros") precisa ler os blocos.
- Os nomes em inglês dos arquivos do Vilella vêm de uma tabela local (`nomes-originais.json`, na pasta do compêndio, fora do git), escrita de memória sobre o D&D 5e oficial; o que não se soube ficou sem nome. Conferir por amostra.

**Suposições**: ver `docs/REDESIGN.md`, "Q2 — como ficou".

## Q4 (2026-11-16): a mesa de som

- Dados e contas puras: `packages/shared/src/mesadesom.ts` (os 16 lugares `LugarDeSomSchema`, `MesaDeSomSchema`, `SomLigadoSchema`, `lugaresDe`/`comLugar`/`lugarDe`, `ligadosParaACena`, `ligadoSem`, `usosDoSom`, e a conversão do N5, `migrarSomDoN5`). `som.ts` continua com o que é de todo som (volume, alinhamento pelo relógio, `pontoDaTrilha`, `desvioDoRelogio`, `volumeFinal`, som de zona); `TrilhaSchema` e `TrilhaDaCenaSchema` ficam só para ler o que já existia.
- Estado e protocolo: `Estado.mesaDeSom` (só o mestre recebe; vai na exportação), `Estado.somLigado` (todos recebem; fora da exportação), `Cena.ambientes` (só o mestre), as intenções `som.lugar`, `som.efeito` (`lugar` ou `hash`), `som.efeitoParar`, `som.ambiente`, `som.volumeGeral`, `som.pararTudo`, `som.apagar`, `cena.editar { ambientes }`, e os eventos `som.ligadoAlterado`, `som.lugarAlterado`, `som.efeitoTocado` (com `lugar`), `som.efeitoParado` e `asset.removido` (`protocolo.ts`). As regras: `nucleo.ts` (intenções, `grupo.moverPara`, `reduzir`, `visaoPara`, `eventoPara`, `lerExportacao`, `cenaParaJogador`), `automacoesnucleo.ts` (o volume geral vale para `som.tocar`) e `assets.ts` (`hashesUsados` conta os lugares).
- Sala: `armazenamento.ts` (`carregarSom`/`gravarSom`, chaves `mesa_de_som` e `som_ligado` da `meta`, `converterSomDoN5` na leitura, `asset.removido` apaga a meta) e `sala.ts` (`som.efeitoParado` também vai depois do snapshot).
- Tela: `PainelDoSom.tsx` (a janela e a faixa), `som/ConfigDaMesaDeSom.tsx`, `som/iconesDoSom.tsx` (os 12 ícones e as 6 cores), `som/modoDoSom.ts` (janela ou faixa por pessoa, `useEnvioAdiado`), `som/motorDeSom.ts` (agora com vários ambientes e efeitos por lugar), `som/useSomDaMesa.ts`. Tokens de tema `etiquetaAzul` e `etiquetaVermelho`.
- MCP: `mcp/ferramentas/som.ts` (lugares, efeito, pararEfeito, ambientes, volumeGeral, pararTudo, apagar, ambientesDaCena, zonas) e as entradas novas de `mcp/paridade.ts`.
- **Frágil: a conversão do N5 grava ao ler.** `Armazenamento.converterSomDoN5` roda em todo `carregar()`, grava as chaves novas, apaga a chave `trilha` e regrava as cenas que tinham `trilha`. É idempotente (sem som antigo não faz nada) e tem try/catch: se falhar, a mesa abre sem o som antigo.
- **Frágil: o jogador só baixa o arquivo de um efeito no primeiro toque.** O mestre sabe os arquivos dos lugares e os baixa antes; o jogador não sabe quais são (não recebe a mesa de som). O primeiro toque de um efeito novo pode não soar para quem ainda não tem o arquivo.
- **Frágil: a janela de configuração edita por lugar, com cópia local.** `ConfigDaMesaDeSom` guarda o que a pessoa mudou em cada lugar (`locais`) até a sala devolver; sem isso, ícone e cor mudados em seguida se atropelavam, e a mudança adiada (nome, volume) caía no lugar errado. Um lugar esvaziado volta a valer o da sala; uma mudança que o Claude fizer ao mesmo tempo no mesmo lugar só aparece ao trocar de lugar.
- **Frágil: o gerente de assets não esquece o som apagado.** `som.apagar` tira a meta da sala e do estado do mestre, mas o cache do navegador guarda a meta e os bytes; registrar o mesmo arquivo de novo funciona (`asset.registrar` sempre é mandado).
- O volume geral é multiplicado em dois lugares de propósito: a sala multiplica o dos efeitos (que não ficam no estado) e o navegador o dos ambientes (para valer na hora, sem recomeçar).

## Q5 (2026-11-16): as rolagens no chat (Fita e Moldura)
**Onde mexer**
- Cartão: `apps/web/src/rolagem/CartaoNoChat.tsx` (peças, balão, gesto do mouse parado/foco/toque), conteúdo por tipo em `rolagem/CorpoDaRolagem.tsx` (`CorpoDoModelo`: teste, ataque, vida; `CorpoDaRolagemLivre`: `/r`), chamados por `MensagemDoChat.tsx`. O `CartaoDeRolagem.tsx` ficou só para o `[[...]]` dentro de frase.
- Lógica pura: `rolagem/totais.ts` (`totaisDaVantagem`, `naturalDoD20`, `lerRotuloDeDano`), `rolagem/danos.ts` (tipos de dano) e `IconeDoDano.tsx` (ícones), `rolagem/agrupar.ts` (cabeçalho dividido). Testes ao lado (`*.test.ts`), inclusive o contraste em todos os temas.
- Estilo: `rolagem/estilo.ts` (preferência, `useEstiloDasRolagens`), `rolagem/SeletorDoEstilo.tsx` (Preferências → Aparência), CSS em `rolagem/rolagem.css` (importado no `main.tsx`).
- Portas do E2E: `e2e/portas.ts` e `apps/server/scripts/dev-e2e.mjs` (`E2E_PORTA_SALA`, `E2E_PORTA_WEB`).

**Frágil**
- O cartão de dano de magia de salvaguarda sem acerto depende do texto que a ficha manda (`rolador.dano`: "Nome (nível n), CD x, tipo"). Mudar esse texto desfaz o cartão CD | dano (cai no cartão livre, sem perder dado). `lerRotuloDeDano` tem teste.
- Os dados, fórmulas e blocos de espaço e dardos só existem no balão: todo teste que os lê precisa passar o mouse no cartão antes (`hover()`).
- A cor do número crítico é uma `color-mix` com o `--texto`; se `--critico` ou o `--painel` de um tema mudar, rode `rolagem/contraste.test.ts`.
- `.mensagem-chat.seguida` esconde o cabeçalho com `clip-path` (continua no DOM para os testes e leitores de tela).

**Suposições**: ver `docs/REDESIGN.md`, "Q5 — como ficou".

## Q3 (2026-11-16): importar mapas do Dungeondraft (Universal VTT)
**Onde mexer**
- Puro e compartilhado: `packages/shared/src/importarUvtt.ts` (`lerUniversalVtt` lê o JSON com tolerância e desconta a origem; `base64ParaBytes` decodifica a imagem aos pedaços; `converterUvtt` faz quadrados virarem metros, paredes, portas e fontes de luz dentro de `LIMITES_DA_IMPORTACAO`; `ImportacaoDeMapaSchema`; `resumoDaImportacao`). Testes: `importarUvtt.test.ts` (leitura, conversão, limites, a intenção na sala e o Desfazer).
- Protocolo e sala: a intenção `cena.importarMapa` (`protocolo.ts`; o caso em `nucleo.ts`, depois de `cena.duplicar`; capacidade `cena.editar`). O uso de envio `mapa-uvtt` (`envios.ts`, `enviosUso.ts`, `arquivos.ts` do MCP; `sala.ts` `concluirEnvio` passa a `importacao` ao `usoDoArquivo`). Paridade: `mcp/paridade.ts` (`cena.importarMapa` via `arquivos`/`enviar`).
- Tela: `FaixaDeCenas.tsx` (card e `<input type="file">`), `Mesa.tsx` (`importarMapaUvtt`, o arrastar na janela, `AvisoDaImportacao.tsx`), `assets/gerente.ts` (`lerMapaUniversalVtt`), `assets/processador.ts` e `processador.worker.ts` (o pedido `uvtt`, fora da thread da página), `caixaDoClaude.tsx` (o uso `mapa-uvtt`).
- E2E: `e2e/tests/q3.spec.ts` (o `.dd2vtt` é gerado no teste).

**Frágil**
- A cena inteira vai num único frame (`cena.importarMapa`, e `caixa.concluir.importacao` no caminho do Claude): o teto de 3000 paredes e 200 luzes mantém o frame abaixo de 1 MiB (o limite do WebSocket da sala). Subir os tetos exige quebrar em vários pedidos.
- O processamento do arquivo está duplicado de propósito entre o botão (`Mesa.importarMapaUvtt`) e a caixa do Claude (`caixaDoClaude.processar`), mas os dois passam por `gerente.lerMapaUniversalVtt`; a conversão (`converterUvtt`) é uma só.
- O trecho de parede sobre uma porta é descartado por geometria (extremos a até 0,05 quadrado do segmento da porta). Um mapa que desenha a parede por cima da porta com outro desenho pode ficar com a porta sob uma parede.
- O E2E depende de `veNoPonto` do gancho do mapa e de a semente deixar o `jogador-1` ver 6 m além do token.
- Desfazer a importação do Claude só apaga a cena se ninguém mexeu nela depois (regra do 12-1: a cena sai se está vazia de tokens; as paredes e luzes importadas saem antes).

**Suposições**: ver `docs/REDESIGN.md`, "Q3 — como ficou".

## Q6 (2026-11-16): a busca do compêndio e a mesa de som (Q2b + Q4b)

- Busca: `packages/shared/src/buscaDoCompendio.ts` (`prepararConsulta`, `pontuarBusca`, `filtrarEOrdenar`). As buscas de `compendio.ts` e `compendioSecoes.ts` passam por `filtrarEOrdenar`. As funções de agrupar (`agruparMagiasPorNivel` etc.) têm um segundo argumento `alfabetico`: com busca a tela passa `false` para manter a relevância.
- **Frágil: o cache da busca é um `WeakMap` por objeto da entrada.** Se a tela copiar as entradas a cada tecla, o cache não vale e a busca fica mais lenta. Hoje as listas vêm estáveis do `useCompendio`.
- Transporte: `SomLigado.tocando` e `tocandoAgora(estado)` em `mesadesom.ts`; `somLigadoOuNada` guarda o objeto se há ambiente marcado ou se o transporte toca. A intenção `som.transporte` (`nucleo.ts`) reinicia o relógio dos marcados ao tocar. `useSomDaMesa` passa ao motor uma lista vazia de ambientes quando o transporte está parado.
- **Frágil: o estado sem `tocando`** (campanha antiga) vale como "tocando" se há ambiente marcado. Não mude essa regra sem uma migração.
- Janela própria do som: `som/SomEmJanelaPropria.tsx`, rota `/m/<id>/som` (`rotas.ts`, `App.tsx`), id `mesa-de-som` em `ficha/foraDaMesa.ts` (o mesmo lock e canal das fichas). `PainelDoSom` tem a variante `propria`. Os testes da ficha que contam janelas abertas não são afetados (o id é outro).
- Faixa: `AlcaDaFaixa` em `PainelDoSom.tsx` e as constantes e `escalaDaFaixa` de `som/modoDoSom.ts`. **Frágil: `ALTURA_NATURAL_DO_CORPO` (190) e `ALTURA_DO_TOPO_DA_FAIXA` (42) são medidas do CSS** (grid dos efeitos 2 × 64 px, ambientes 4 × 38 px). Se o CSS da faixa mudar, meça de novo (o E2E `som-q4b.spec.ts` falha se o corpo rolar acima do mínimo). A escala usa `zoom`.
- A configuração do som usa `camadaAlta` (45+): fica acima da faixa (30) e das janelas comuns (25+).

**Suposições**: ver `docs/REDESIGN.md`, "Q6 — como ficou".

## Q7 (2026-11-16): o painel de cenas em grade, barras do tema, descrição aberta

- `FaixaDeCenas.tsx`: a lista virou grade (`.faixa-lista`, `grid-auto-rows: 122px`, `max-height` de 3 linhas). **Frágil: o `122px` e o `calc(122px * 3 + 10px * 2)` do CSS andam juntos** (altura do card e 3 linhas). A busca é `filtroDeCenas.ts` (usa `pontuarBusca` do compêndio). O menu do vazio e o teclado (Shift+F10) estão em `FaixaDeCenas`; o clique fora é um `pointerdown` no documento com a lista `FORA_QUE_NAO_FECHA` (botão `menu-cenas`, menus e diálogos). **Quem criar um diálogo novo aberto a partir do painel precisa de `role="dialog"`/`alertdialog` ou da classe `fundo-modal`, senão clicar nele fecha o painel.**
- `mapaPixi.ts`: `spritesDoMapa` é chaveado por `hash@x,y` (um sprite por lugar); `limparMapa()` roda em `definirCena` quando a cena muda. O gancho `imagens()` devolve o `hash` de cada sprite como antes.
- Barras de rolagem: tokens `rolagemPolegar` e `rolagemTrilho` (derivados em `comRolagem`, `temas.ts`); regras globais no começo de `styles.css`. Não ponha `scrollbar-color` fixo em componente novo.
- `CartaoDaMagia.tsx`: os cartões do chat começam abertos.

## Q8 (2026-11-16): o token em cada cena, as Automações na barra, a aba Mesa em cartões

- Regra do token: `personagem.colocar` e `token.colocarMeu` (`nucleo.ts`) olham só a cena. `token.colocarMeu` do jogador **ignora o x e o y**: sempre `arrumarNoGrid` na bandeira. `grupo.moverPara` deixa de fora quem já tem token no destino.
- **Frágil: ainda há personagem com mais de um token no estado** (um por cena). Qualquer busca nova do "token do personagem" tem de dizer a cena (`tokenDoPersonagem(tokens, id, cenaId)` ou `tokenDoPersonagemPreferindo`, em `luz.ts`). `controlaPersonagem` e `podeColocarProprioToken` já valem para qualquer token do personagem.
- Botão Automações: `MenuSuperior.tsx` (`menu-automacoes`, `automacoesAbertas` vem de `Mesa.tsx`). A janela é a mesma de antes.
- Aba Mesa: `AbaMesa.tsx` usa `SecaoDePreferencias` com `prefixo="mesa"` (testids `mesa-secao-<id>`, `mesa-secao-<id>-titulo`, `mesa-resumo-<id>`). Os ids dos cartões: esta-mesa, regras, luz, automacoes, pessoas, campanha, diagnostico. Dentro de Pessoas ficam `mesa-secao-papeis`, `mesa-secao-contas` e `mesa-secao-permissoes`. **Frágil: os E2E que usam um campo da aba Mesa abrem a aba por `abrirAba(p, "mesa")`, que (só nesse caso) abre todos os cartões** (`abrirTodasAsSecoesDaMesa`, em `e2e/tests/ajudas.ts`); `abrirSecaoDaMesa` abre um só.
- `BarraLateral` abre os `<details>` em volta da seção pedida antes de rolar (`secaoTestid`).

**Suposições**: ver `docs/REDESIGN.md`, "Q8 — como ficou".

## Q10 (2026-11-17): hordas (vida por token, numeração, pôr vários, copiar e colar)

- Regra pura em `packages/shared/src/hordas.ts`: `vidaDoToken` (a vida que vale: a do `token.pv` ou a da ficha), `usaVidaPorToken`, `pvInicialDoToken`, `nomeNumerado`, `copiaDoToken`, `tokenParaUsuario` (o filtro do segredo). A sala (`nucleo.ts`) cria tokens em `tokenDoPersonagem` (já com `pv`, nome e número); casos novos: `personagem.colocarVarios`, `token.copiar`, `token.vida`. **Frágil: todo caminho novo que cria token de NPC precisa passar por `tokenDoPersonagem`/`pvInicialDoToken` e por `nomeNumerado`; todo caminho que leva token ao jogador (snapshot, `token.criado`, `token.editado`) passa por `tokenParaUsuario`.**
- **Frágil: qualquer lugar novo que mostre ou grave PV a partir de um token tem de usar `vidaDoToken(token, personagem)`** e, se `propria`, mandar `token.vida` (não `ficha.alterar`). Hoje só `MarcasDoToken`, a faixa da ficha e o MCP (`tokens.ts`) fazem isso.
- Web: seleção de vários tokens em `Mesa.tsx` (`extrasIds`, `tambemSelecionadosIds`; o principal continua `selecionadoId`); `MapaPixi` recebe `tambemSelecionadosIds` e chama `alternarNaSelecao` (Shift ou Ctrl+clique) e `copiarArrastado` (Alt na hora de pegar o token: gesto `token` com `copia: true`). A área de transferência (`areaDeTokens`) e Ctrl+C, Ctrl+V e Ctrl+D (`aoTeclarCopia`) ficam em `Mesa.tsx`; só valem com o foco no mapa ou em nada. `ponteiroEmMetros()` e `centroDaTelaEmMetros()` dão onde colar.
- (Q11) O selo do número saiu: `Token.numero` segue nos dados (numeração e `nomeBaseDoToken`), mas nada o desenha; o gancho de teste não devolve mais `selo` (devolve `barra` e `borda`).
- A faixa "Este token" (`ficha/FaixaDoToken.tsx`) depende de `JanelaDeFicha.tokenId`, que só `abrirOuTrazerFicha(id, aba, tokenId)` põe (menu do token e CA da marca); a lista de Fichas abre sem ele. A ficha em janela própria do navegador não tem a faixa.
- "Colocar vários…": `ColocarVarios.tsx`, aberto por `Mesa.tsx` (`colocarVariosDe`); botão no cabeçalho da ficha (`aoColocarVarios`) e item no menu do NPC da lista (`AbaFichas`).

**Suposições**: ver `docs/REDESIGN.md`, "Q10 — como ficou".

## Q11 (2026-11-17): barra de vida, borda colorida, laço, mover vários e dano em lote

- Dados: `Token.barraDeVida?` (sem o campo = ligada; `barraDeVidaLigada` em `bordas.ts`), `Token.borda?` (8 nomes, `NOMES_DE_BORDA` em `estado.ts`; hexadecimal em `CORES_DA_BORDA`, `bordas.ts`) e `Personagem.tokenPadrao.barraDeVida?` (`barraDeVidaPadrao`). A sala (`nucleo.ts`) copia a escolha do padrão para o token em `tokenDoPersonagem` e no `token.criar` de NPC; `personagem.editar` só grava `barraDeVida` no padrão quando é `false`. **Frágil: o `tokenPadrao` do `personagem.editar` é montado do zero (não é `{...atual.tokenPadrao}`): campo novo do padrão tem de entrar nessa montagem, senão some na primeira edição.**
- Lote na sala: `tokens.mover`, `tokens.vidaDelta`, `tokens.editar` em `nucleo.ts`. `tokens.editar` e `token.editar` dividem `tokenComMudancas` e `precisaDeSnapshot`; o dano em lote usa `aplicarDeltaNaVida` (`hordas.ts`, em cima de `receberDano`). Todo pedido em lote recusa tudo se um item for recusado. **Frágil: dano que muda vida passa por `token.editado` (horda) ou `personagem.alterado` (ficha); o `pv` do token segue pelo filtro `tokenParaUsuario`. Caminho novo de dano repete essa escolha com `vidaDoToken`/`usaVidaPorToken`.**
- Mapa (`mapaPixi.ts`): `criarVisual` (borda por cima do corpo, anel de seleção a +8 com borda, nome empurrado por `ESPACO_DA_BARRA` quando há barra), `atualizarBarras` (barra por visual, redesenhada só quando a chave muda; chamada de `atualizarEstilos` e `ajustarMarcasAoZoom`), `chaveDe` (inclui `borda` e se há barra). O que mostrar vem de `opcoes.vidaDaBarra` (montada em `Mesa.tsx`: `barraDeVidaLigada`, `controlaToken`, `vidaDoToken`); `definirOpcoes` refaz os visuais cuja chave mudou (Ver como). **Frágil: a chave do visual chama `vidaDaBarra` (um `find` por token) a cada atualização de opções.**
- Gestos: `Gesto` ganhou `laco` e o `token` ganhou `junto` (os outros da seleção). `aoApertar` cria o laço no fundo (mestre; `esperarPing` continua: o laço só fica `ativo` depois de 5 px, a mesma tolerância do ping); `aoMover`/`aoSoltar` tratam `laco` antes do caso de token; `idsNoLaco` usa o mesmo filtro do `tokenEm`. Pegar um token que está numa seleção de vários não chama `selecionar` (senão os somados se perdem); soltar sem arrastar chama. O arrasto de vários não manda `token.mover` ao vivo (só o `tokens.mover` ao soltar). **Frágil: `animar` e `sincronizarTokens` tratam `junto` como "arrastando"; gesto novo de token tem de fazer o mesmo.**
- Web: `SeletorDeBorda.tsx` (menu do token e `PainelDoToken`), "Vida dos N selecionados…" em `MenuDoToken.tsx` (`idsDoMenu`), `MarcasDoToken` com `idsEmLote` (`deltaDaVidaEmLote`, `vidaDoToken.ts`), setas com vários em `aoTeclarNoMapa` (`Mesa.tsx`), `selecionarComLaco` e `soltarVarios` em `retornos`.

**Suposições**: ver `docs/REDESIGN.md`, "Q11 — como ficou".

## Q12 (2026-11-17): sem aviso de parede, setas rápidas e seguir meu token

- Avisos: `useSala.ts` (`recusaSilenciosa`, `PEDIDOS_DE_MOVER`, `tiposDosPedidos`): só pedidos de mover calam `trajeto_bloqueado`, `sem_permissao` e `token_inexistente`; o frame de erro ainda é emitido ao mapa. **Frágil: pedido novo que mexe no token (e uma recusa que a pessoa não vê) tem de entrar em `PEDIDOS_DE_MOVER`; recusa nova de mover que merece aviso não pode entrar em `RECUSAS_QUE_SE_VEEM`.**
- Setas: `passoDasSetas.ts` (`proximoPasso`, `direcaoDaSeta`, `teclasDeSetaDepois`, `INTERVALO_DA_SETA_MS`) e, em `Mesa.tsx`, `aoTeclarNoMapa` (só o keydown), `darPassoDeSeta` (refeito a cada render; o relógio `repeticaoDasSetas` o chama; desde o Q13 é um `requestAnimationFrame`), `pararAsSetas`, keyup e blur no `useEffect` das setas. O mapa guarda os passos pendentes (`passosPendentes`, `moverOtimista`, `posicaoPendente`; `sincronizarTokens` não reposiciona o token com passo pendente; `ressincronizar` e `expirarPendentes` o devolvem). **Frágil: a conta do passo tem de continuar igual à da sala (`token.soltar` em `nucleo.ts`: encaixa, limita à cena, parede); se a sala ganhar regra nova de mover, repetir em `proximoPasso`, senão o token aparece andando e volta. A posição de partida do próximo passo é a pendente (`mapa.posicaoPendente`); código novo que mexa na posição do token na tela tem de limpar o pendente.** O arrasto não usa o pendente (a posição já fica no destino até a sala responder).
- Seguir: `seguirToken.ts` (`candidatosParaSeguir`, `escolherSeguido`, `aoLigarOSeguir`, `prefParaSeguir`, `lerSeguir`/`gravarSeguir`, chave `tabletop:pref:seguir:<mesa>`), o estado e o efeito em `Mesa.tsx` (`seguir`, `seguidoId`, `viuOSeguido`), `ZoomFlutuante.tsx` (botão, setinha e lista), e no mapa `seguir(id)`/`seguirOToken` (um quadro: centro da tela = posição animada do token) chamado de `passo` depois de `animar`. O pan à mão chama `retornos.parouDeSeguir`; a tecla F (`aoTeclaBaixo`) chama `retornos.alternarSeguir`. **Frágil: o seguir roda a cada quadro e chama `aplicarVista` (desenha régua, paredes, marcas de luz) enquanto o token anda; se pesar, limitar. Outro código que mexe na vista (`centralizar`, `manterVisivel`, centralização do ping) brigaria com ele: hoje só o ping com "centralizar" briga (o seguir recentra no quadro seguinte).**
- A suavização do token (`TAU_MS`) caiu de 70 para 45 ms.

**Suposições**: ver `docs/REDESIGN.md`, "Q12 — como ficou".

## Q13 (2026-11-17): segurar a seta, contínuo e em linha

- Relógio das setas: `Mesa.tsx` (`aoTeclarNoMapa`) usa um `requestAnimationFrame` com `passosVencidos` (`passoDasSetas.ts`), não mais `setInterval`; `pedidosDeSeta` guarda o pedido de cada passo para o erro só devolver os tokens dele. O token anda por `avancarEmLinha` (`vel` no visual do mapa, `velocidadeDoPasso`): linear para deslocamentos de até 2,5 quadrados, suavização de antes acima disso.
- O estado do React e o mapa recebem o `token.movido` por caminhos diferentes: `useSala.ts` empilha os `token.movido` e só os aplica ao estado a cada `INTERVALO_DO_ESTADO_DOS_PASSOS_MS` (300 ms), descarregando a fila antes de qualquer outro evento; o mapa recebe cada um na hora (`movidoDaSala`, guardado em `posicoesAvisadas`; `limparPosicoesAvisadas` em qualquer outro evento e no `conectado`). **Frágil: qualquer código novo que leia a posição de um token do `estado` do React durante um movimento recebe a posição de até 300 ms atrás; para o "onde ele está agora" use `mapa.posicaoPendente(id)` (passo pendente ou posição avisada por último). Hoje só o `token.movido` muda a posição de um token pelo caminho do mapa; evento novo que mude a posição (e não seja `token.movido`) descarrega a fila e o estado fica em dia, mas o mapa só o vê pelo estado.**
- A visão e a luz refeitas por movimento esperam 2× o custo da última (`esperaDaVisao`, teto 120 ms; `visaoPorMovimento` em `passo`); qualquer outra causa (`visaoSuja`) refaz na hora. **Frágil: o que mexer na visão ou na luz por movimento tem de marcar `visaoPorMovimento`, não `visaoSuja`, ou perde o espaçamento.**
- Erro da sala (`ouvir` da `Mesa`): passo de seta devolve só os tokens do pedido; arrasto ou pedido sem tipo devolve todos (para a posição avisada); outro tipo de pedido não mexe em token. `Ocorrencia` "erro" ganhou `tipoDoPedido`.
- Para medir: `e2e/tests/q13.spec.ts` (cena pesada gerada na hora; `Q13_PERFIL=<arquivo>` grava o perfil de CPU do teste com a CPU 4× mais lenta; `trace: "off"` porque o rastro do Playwright tira retrato do DOM a cada ação e distorce a medida).

**Suposições**: ver `docs/REDESIGN.md`, "Q13 — como ficou".

## Q14 (2026-11-18): a ficha por seções

- Onde: `packages/shared/src/estruturaCompartilhada.ts` (`compartilharEstrutura`), `aplicarOperacoes` (`ficha.ts`), `useFicha.ts` (a ficha mostrada compartilha com a anterior), `JanelaDaFicha.tsx` (a derivada `d` também; props estáveis) e `apps/web/src/ficha/secoes.tsx` (`secao`: `memo` com fatias). As seções estão em `AbaPrincipal.tsx` (`const X = secao("X", XBruta, {...})` no fim do arquivo), `AbaHistoria.tsx` e `PainelExtra.tsx`.
- **Frágil: o `memo` de cada seção vale pelas chaves declaradas.** Quem passar a ler outra chave da ficha ou de `d` numa seção tem de acrescentá-la à declaração dela (`ficha`, `fichaExceto`, `d`), senão a seção fica velha ao mudar só essa chave. Chave nova na ficha (`FichaSchema`) cai sozinha em `Ataques` (que declara o que NÃO lê: `TEXTOS_LIVRES`), mas não nas seções com lista fechada.
- **Frágil: toda prop nova de `PropsDaAba` precisa de identidade estável** na `JanelaDaFicha` (`useCallback`, `useMemo`, `useFuncaoEstavel`); uma função criada a cada render desliga o `memo` de todas as seções sem erro algum. Para achar a culpada: `window.__motivosDaFicha` (modo de teste) diz qual prop ou fatia fez cada seção redesenhar; `e2e/tests/q14.spec.ts` falha mostrando esse mapa.
- A `luz` da ficha (a mesa inteira) é ignorada pelas seções, menos o Equipamento (`mesmaLuz`, em `AbaPrincipal.tsx`): se outra seção passar a ler `luz`, declare `comparar: { luz: ... }`.
- `compartilharEstrutura` só vale para dados de JSON (a ficha e `d`); o resultado e a entrada nunca podem ser mutados no lugar (as seções e os caches por referência contam com isso).
- O balão da dica (`Dica`) só existe no DOM enquanto está visível, no `BotaoComDica`: teste novo que procura `dica-<testid>` tem de esperar a dica aparecer (mouse ou foco); sem o balão, o nome vem do `aria-label` e o motivo do desabilitado do `aria-description`.

**Suposições**: ver `docs/REDESIGN.md`, "Q14 — como ficou".

## Q15 (2026-11-18): Magias e NPC por seções; seguir × arrastar

- Onde: seções em `AbaMagias.tsx`, `CirculoDeMagias.tsx` (`CirculoDeMagias`, `LinhaDeMagia`, `LinhaLigada`), `ConjuracaoInata.tsx` (`ParteInata`), `ConjuracaoDoNpc.tsx` e `BlocoDoNpc.tsx` (`Npc*`); regra em `secoes.tsx` (+ `secoes.test.ts`). O arrasto: `mapaPixi.ts`, no movimento do gesto `token` (`seguir(null)` + `parouDeSeguir`).
- **Frágil: manipulador que monta uma lista inteira numa seção em `memo` tem de ler `props.fichaAtual()`**, nunca a `ficha` do render (a seção pode não ter redesenhado quando só outra parte da lista mudou; escrever com a lista velha apagaria o texto). Os existentes: nova magia, reordenar, soltar, "Recuperar" da inata, nova ação/categoria.
- **Frágil: a `LinhaDeMagia` lê a magia de `props.ficha.magias[i]`** (não de uma prop) e recebe os props de `PropsAoVivo` (contexto provido por `JanelaDaFicha`) porque o círculo em `memo` não redesenha a cada tecla. Quem criar outra seção em `memo` dentro de uma seção em `memo` precisa do mesmo cuidado.
- **Frágil: `FORA_DA_CONJURACAO`** (`AbaPrincipal.tsx`) lista as chaves da ficha que círculos, linhas, ações e inata NÃO leem; chave nova da ficha cai fora da lista (redesenha, seguro). Se alguma dessas seções passar a ler uma chave da lista, tire-a de lá.
- `BlocoDoNpc` passa às seções um objeto `base` sem `modos`, `pagina`, `aoMudarPagina` e `aoMudarNome` (JSX/funções novas a cada render derrubariam o `memo`); `aoMudarNome` da janela é `useFuncaoEstavel`.
- O cabeçalho da `JanelaDaFicha` ainda redesenha a cada tecla.

**Suposições**: ver `docs/REDESIGN.md`, "Q15 — como ficou".

## Q16 (2026-11-18): o MCP faz tudo o que a tela faz, campo por campo

**Regra: campo novo numa intenção precisa de caminho no MCP.** `mcp/paridadeCampos.ts` lista, por intenção com ferramenta, o caminho de cada campo na entrada da ferramenta (`"ferramenta:caminho"`) ou o motivo de ficar de fora; `mcp/paridadeCampos.test.ts` compara com o `shape` do zod (`mcp/camposDoEsquema.ts` lê os objetos de dentro). Se reprovar depois de mexer num esquema de intenção: ponha o campo na ferramenta e registre a linha. Na ficha, apontar para `fichas[].campos` basta enquanto não há campo próprio.

**Onde mexer**
- Conjurar: `mcp/ferramentas/conjurar.ts` (a mesma conta da `apps/web/src/ficha/conjurar.ts`: se a tela mudar a regra de espaço, pacto ou inata, mude aqui também) e `rolar.ts`.
- `fichas.campos`, `visaoM`: `mcp/ferramentas/fichas.ts` (`comCampos`). `tokens.controladoPor`: `tokens.ts`.
- Usos de arquivo `aparencia` e `simbolo`: `envios.ts` (`usoDoArquivo`, vira `ficha.alterar`), `mcp/ferramentas/arquivos.ts` e `apps/web/src/caixaDoClaude.tsx`.
- Som por nome em zona e reação: `mcp/ferramentas/automacoes.ts` (`SomPorNomeSchema`, `AcaoDoMcpSchema`, `efeitosDaZona`).

**Frágil**
- `conjurar.ts` do MCP e `conjurar.ts` da ficha duplicam a regra; nenhum teste compara os dois.
- `AcaoDoMcpSchema` troca só a opção `som.tocar` da união `AcaoSchema`; uma ação nova com id ou hash no esquema precisa ganhar o mesmo tratamento por nome.

**Suposições**: ver `docs/REDESIGN.md`, "Q16 — como ficou".

## CH3 (2026-11-20): tela de entrar enxuta, desfoque em três níveis, gravar e transcrever

**Onde mexer**
- **Tela de entrar e desfoque**: `TelaDaChamada.tsx` (`AntesDeEntrar`, `Aparelhos` com o `fundo` na mesma grade, `BotaoDoFundo` com o menu), `puras.ts` (`RAIO_DO_DESFOQUE`, `NIVEIS_DO_FUNDO`, `proximoNivelDoFundo`), `fundo.ts` (o raio vem de `RAIO_DO_DESFOQUE`; o `medio` é a reserva do Leve sem `filter`). CSS em `.chamada-antes-bloco`, `.chamada-previa` (a largura sai de `100dvh - 388px`), `.chamada-aparelhos-campos`, `.chamada-fundo-menu`.
- **Protocolo e sala**: `packages/shared/src/chamada.ts` (`gravando` e `naoGravar` nos participantes, `ligarGravacao`, `tirarMinhaVoz`, `gravacaoLigada`, `quemFicouDeFora`), `protocolo.ts` (`chamada.gravar`, `chamada.naoGravar`), `apps/server/src/sala.ts` (`tratarChamada`, caso `chamada.gravar`).
- **Regras da gravação (puras)**: `packages/shared/src/gravacao.ts` (nomes de pasta e de arquivo, WAV, `gravacao.json`, `eventos.jsonl`, mapa de deslocamentos, leitura do JSON do whisper, linha do tempo). Teste: `ch3.test.ts`.
- **Gravar (navegador do mestre)**: `apps/web/src/chamada/gravacao/` — `detectorDeFala.ts` (corte em trechos), `captura.ts` (AudioContext a 16 kHz + AudioWorklet por um Blob local), `gravador.ts` (pasta, escrita em fila, `gravacao.json`), `eventos.ts` (chat, rolagem, cena, combate; `nomes.txt`), `useGravacao.ts` (liga tudo à chamada), `PecasDaGravacao.tsx` (aviso, botão, confirmação), `SecaoDasGravacoes.tsx` (aba Mesa: lista, trazer, apagar o áudio). `assets/fonte.ts` ganhou `listarPasta` e `apagar` nas três fontes.
- **Transcrever**: `packages/shared/src/transcricao/` (`transcrever.ts` com a configuração e a segurança, `cli.ts` com o terminal); `pnpm transcrever`. O whisper falso dos testes é `fixtures/whisper-falso.mjs`.
- **Ganchos de teste** (só no modo e2e): `window.__tabletopPasta` (`ganchoE2E.ts`: simular a pasta, levar e trazer o que foi gravado), `__tabletopE2E.gravacao` (ajustes do detector) e `__tabletopE2E.semVigiaDoDesfoque`.

**Frágil**
- O Leve e o Forte do desfoque guardam os valores `desfocar` e `forte` no protocolo, nas preferências e nos `data-fundo`: os nomes na tela (Leve e Forte) e os valores não coincidem de propósito (o protocolo não mudou).
- O detector usa os limiares do anel verde (`LIMIAR_DE_FALA_LIGA` e `LIMIAR_DE_FALA_DESLIGA`): mudar um muda o outro. Eles foram feitos para a voz de microfone com "Reduzir ruído e eco" ligado.
- A gravação depende de `AudioContext({ sampleRate: 16000 })` e de `AudioWorklet` (Chrome e Edge, os mesmos que têm a pasta); sem eles a confirmação diz que o navegador não deixou gravar. A voz dos outros precisa estar tocando em algum `<audio>` (o `AudioDaChamada` já faz) para o Chrome entregá-la ao WebAudio.
- A marca `gravando` mora no socket do mestre: se o socket cair e voltar, a sala o põe de novo na chamada sem a marca, e `useGravacao` a reenvia (`meuRegistro`). Quem lê `chamada.quem` não deve supor que a marca é permanente.
- "Rascunho" da nota da transcrição é só "visível só ao mestre": a sala tira o carimbo `rascunho` de quem não é o Claude, então a nota não ganha o selo.
- `chamada.spec.ts` e os testes de câmera deste lote às vezes mostram a prévia a 0 quando o computador está ocupado (outros lotes rodando E2E ao mesmo tempo); com o computador livre passam.

**Suposições**: ver `REDESIGN.md`, "CH3 — como ficou".

## CH2 (2026-11-20): a grade da chamada

**Onde mexer**
- `apps/web/src/chamada/grade.ts` (`calcularGrade`, páginas; teste em `grade.test.ts`) e `GradeDeQuadros.tsx` (mede com `ResizeObserver`, tamanho de cada célula inline, setas e ponto de quem fala). O CSS está em `.chamada-grade`, `.chamada-quadros`, `.chamada-paginas` e, no fim do `styles.css`, `.chamada-trilha[data-compacto]`.
- `pessoasFalsas.ts`: gancho de teste (`window.__tabletopChamadaFalsas`) só no modo e2e.

**Frágil**
- O respiro de 12 px e o vão de 12 px estão em `GradeDeQuadros.tsx` e em `.chamada-quadros`/`.chamada-quadros-miolo`: mudar um sem o outro faz o quadro passar do espaço.
- O quadro da trilha decide ficar compacto pela medida (420 x 236 px) passada pela grade, não por CSS.
- `chamada.spec.ts` falha na primeira tentativa dos testes com vídeo recebido (já falhava antes do CH2).

## CH1 (2026-11-19): a chamada da mesa

**Onde mexer**
- Regra da sinalização (quem entra, limite de 8, quem manda sinal a quem, tamanhos, frequência): `packages/shared/src/chamada.ts` (teste em `chamada.test.ts`). A sala só a chama: `apps/server/src/sala.ts`, `tratarChamada` (a participação mora no `Identidade.chamada` do socket; `difundirChamada` manda `chamada.quem`).
- A janela: `apps/web/src/chamada/`. `controlador.ts` é o dono de tudo o que não é desenho (mídia local, fundo, áudio, malha, conversa com a sala); `malha.ts` são as `RTCPeerConnection`; `audio.ts` o WebAudio; `fundo.ts` o desfoque; `puras.ts` as regras testáveis; `TelaDaChamada.tsx` e `Quadros.tsx` o desenho.
- A rota e a janela: `rotas.ts` (`/m/<id>/chamada`), `App.tsx`, `ficha/foraDaMesa.ts` (`abrirChamadaEmJanela`: abrir de novo NÃO recarrega a janela).
- Na mesa: `chamada/BotaoDaChamada.tsx`, `PresencaNoTopo.tsx` (ícone e anel), `useSala.ts` (`participantesDaChamada` e as ocorrências `chamadaSinal`, `chamadaChamando`, `chamadaSubstituida`), `Mesa.tsx` (o aviso "está chamando").
- O modelo do desfoque: `apps/web/src/chamada/modelos/selfie_segmenter.tflite` (Apache-2.0, do MediaPipe; baixado uma vez de `storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/`). O wasm vem do pacote `@mediapipe/tasks-vision` (importado com `?url`).

**Frágil**
- A negociação: quem oferece é a ponta de id maior; a de id menor recebe os transceptores com a oferta (`pegarTransceptores`). Duas ofertas simultâneas no começo deixavam um par sem ICE no Chrome. Mexer nisso exige rodar `chamada.spec.ts` com três pessoas.
- Sinais que chegam antes de a conexão existir ficam guardados 10 s (`adiantados` em `malha.ts`).
- A máscara do segmentador pode vir "ao contrário" conforme o modelo: `mascaraEstaInvertida` confere pelo meio e pela borda do quadro a cada 60 quadros (a câmera falsa do Chrome não tem pessoa para conferir).
- O desfoque usa `setTimeout`: janela totalmente escondida desacelera.
- O volume 0–200% passa pelo WebAudio: um `<audio>` mudo preso ao mesmo fluxo é preciso para o Chrome entregar o som remoto (`audio.ts`).
- A sala guarda a participação no attachment do socket; se um dia o `Identidade` mudar de forma, a chamada precisa continuar sobrevivendo à hibernação.

**Suposições**: ver `docs/REDESIGN.md`, "CH1 — como ficou".

## MU1 (2026-11-19): a música da mesa

**Onde mexer**
- As regras (biblioteca, filtro, sorteio, fila, posição, pausa, próxima, anterior, voltar): `packages/shared/src/musica.ts` (teste em `musica.test.ts`). As intenções `musica.*` estão em `nucleo.ts` (procure `case "musica.`), o sigilo do jogador em `visaoPara` e `eventoPara`; o protocolo em `protocolo.ts`.
- Banco: `apps/server/src/armazenamento.ts` (`carregarSom` e `gravarSom`; as chaves `musica` e `musica_tocando` da tabela `meta`, sem migração).
- O motor: `apps/web/src/som/motorDeSom.ts` (`definirMusica`, `reconciliarMusica`) e `useSomDaMesa.ts`; a tela: `MusicaDoSom.tsx` (tocar), `BibliotecaDeMusica.tsx` (organizar, dentro da aba Música de `ConfigDaMesaDeSom.tsx`), `AbasDoSom.tsx` e `abaDoSom.ts` (as duas abas e a aba lembrada, MU2), `useMusicaAgora.ts` (o ponto da música na tela), `duracao.ts` (lê a duração do arquivo). O layout (a barra de abas e a aba à vista, nas três formas) está em `PainelDoSom.tsx` (`barraDeAbas`, `painelMusica`, `painelEfeitosVertical`).
- O MCP: `packages/shared/src/mcp/ferramentas/musica.ts`, `paridade.ts` e `paridadeCampos.ts`. A chamada: `chamada/rotulos.ts` (`trilhaDaMesa`) e `Quadros.tsx` (`QuadroDaTrilha`).

**Frágil**
- A sincronia depende de a ordem das passadas depois da primeira ser a mesma em todo navegador: `embaralhar` e `passosDaFila` têm de ficar determinísticos (a semente e a lista do `ciclo`). Mexer no sorteio muda a música de quem já está tocando.
- O motor troca de música por um alarme (`setTimeout`) na emenda; uma aba em segundo plano pode atrasá-lo (o próximo snapshot ou evento acerta). O ponto é reposicionado se passar de 1,5 s do relógio da sala.
- A música com o arquivo ainda baixando fica calada até chegar (`arquivoChegou`); a seguinte é pedida com antecedência.
- A duração vem do `Audio.loadedmetadata` do navegador; um mp3 sem cabeçalho de duração (VBR sem Xing) pode vir um pouco errado e a emenda ficar com um silêncio curto ou um corte.
- MU3: o seletor segmentado único é `apps/web/src/SeletorSegmentado.tsx` (classes `seg-grupo` e `seg-item` em styles.css, com escopo `:not(.fl-modos)`; a ficha passa `fl-modos` e `fl-seg` e fica idêntica). Serve de escolha (`aria-pressed`) e de abas (`tablist`). A barra de abas da faixa tem **46 px** (`ALTURA_DAS_ABAS_DA_FAIXA` e `.som-abas` no CSS, juntos; o 40 px dito abaixo é do MU2). Sem subtítulo: o estado de cada aba só vai no `aria-label`; o ponto na aba escondida ficou. O `PainelDoSom` mede a faixa com um ResizeObserver e põe `--faixa-do-som` (altura + 8 px) no contêiner do mapa; o `bottom` do zoom, do selo de modo, do aviso do som e do aviso da importação soma essa variável. Coisa nova que flutua no pé do mapa e pode ficar sob a faixa deve somar a mesma variável.
- MU2: as duas abas substituíram o divisor e o minimizar. A barra de abas tem 40 px (`ALTURA_DAS_ABAS_DA_FAIXA` em modoDoSom.ts, a mesma do `.som-abas` no CSS) e entra na conta da altura cheia e da escala da faixa; se mudar uma, mude a outra. O nome do efeito e do ambiente usa `line-clamp: 2` (`.som-nome`, `.som-nome-linha`): a dica com o nome inteiro só aparece quando o texto está cortado (`nomeCortado` em PainelDoSom.tsx). A aba escolhida fica em `tabletop:pref:som-aba`.
- `ALTURA_NATURAL_DO_CORPO` (modoDoSom.ts) ainda vale 190 px, só do corpo: a barra de abas é à parte (40 px). Cada aba cabe sem rolar na altura padrão (conferido em `musica.spec.ts`).

**Suposições**: ver `docs/REDESIGN.md`, "MU1 — como ficou".

## A1 (2026-11-19): campos lado a lado alinhados
- Regra de interface: campos lado a lado alinham rótulo, caixa e ajuda. Está em `styles.css`, junto de `.linha-par` (subgrid de 3 trilhas). Campo novo em par: use `Campo`/`CampoDeDistancia`/`CampoDecimal` (`label.campo-coluna`) dentro de `.linha-par`.
- Frágil: quem puser `display: flex` num `.campo-coluna` dentro de `.linha-par` desfaz o subgrid (o `.secao-mesa label.campo-coluna` foi rebaixado com `:where` por isso). O subgrid precisa de Chrome/Edge atuais.
- Teste: `e2e/tests/a1.spec.ts`.

## AU1 — automações por blocos (o desenho virou grafo no AU2: ver "AU2")

- **Onde mexer:** `packages/shared/src/fluxos*.ts` (dado, conversão, frase, conferência, leitura), `automacoes.ts` (fatia, botões, relógio), `automacoesnucleo.ts` (motor e intenções), `mcp/ferramentas/automacoes.ts` (MCP, guia), `apps/web/src/automacoes/` (`EditorDeFluxo`, `PainelDoBloco`, `blocos.ts`, `ListaDeAutomacoes`, `AutomacaoEmJanelaPropria`). `automacoesLegado.ts` é o formato antigo, só leitura.
- **Frágil:** (1) a conversão roda na leitura (`z.preprocess` do `AutomacoesSchema`): qualquer mudança nela muda os ids dos fluxos (`rx-<id>`, `botao-<id>`); o `ouro.test.ts` vigia. (2) O caminho de uma execução esperando (`[trilha, i, "sim", j…]`) depende da posição dos blocos: editar trilhas cancela as esperas do fluxo. (3) O guia do MCP tem de citar toda peça nova (teste). (4) Tabela de paridade por campo recursiva (`fluxo.trilhas[][].*`). (5) `enviar()` do cliente devolve o id do pedido, não erro. (6) O editor guarda a árvore num estado do React por cópia (`structuredClone`); fluxos de ~80 blocos ainda são rápidos.
- **Suposições:** ver `REDESIGN.md`, "AU1 — como ficou".

## AU2 — automações como o n8n (grafo, janela própria, mesa de eventos)

- **Onde mexer:** `packages/shared/src/fluxos.ts` (esquemas dos nós e fios, `portasDoNo`, a forma antiga em `FluxoArvoreSchema`), `fluxosGrafo.ts` (gatilhos, `podeLigar`, `organizarGrafo`, `arvoreParaGrafo`, `semOsNos`), `fluxosValidar.ts`, `fluxosFrase.ts`, `automacoesnucleo.ts` (`executarNo`, `seguir`, `valorDoNo`), `mcp/ferramentas/automacoes.ts` (`grafoDoPedido`) e, na web, `apps/web/src/automacoes/` (`CanvasDoGrafo.tsx`, `EditorDeFluxo.tsx`, `PainelDoBloco.tsx`, `blocos.ts`, `MesaDeEventos.tsx`, `eventosDaMesa.ts`, `EventosEmJanelaPropria.tsx`), `ficha/foraDaMesa.ts` (`abrirAutomacaoEmJanela`, `abrirEventosEmJanela`) e `rotas.ts` (`/m/<id>/eventos`).
- **Frágil:** (1) `Fluxo` não tem mais `gatilho` nem `trilhas`: use `gatilhoPrincipal`, `nosDeGatilho` e `temGatilho`; quem lê uma automação de fora passa por `FluxoDeQualquerFormaSchema` ou `AutomacoesSchema` (convertem a árvore do AU1). (2) A ordem dos fios é a ordem de execução, e a conversão da árvore depende dela para sortear o RNG na mesma ordem: o `ouro.test.ts` vigia. (3) O tamanho do nó na grade é fixo (`LARGURA_DO_NO`, `alturaDoNo`): os fios acham as portas por conta, não medindo o DOM; mudar o CSS do nó sem mudar `blocos.ts` desalinha os fios. (4) `pointerup` de um fio acha a porta com `document.elementFromPoint`: classes de CSS com nomes comuns (`.entrada`, `.saida`) já pegaram regras de outras telas; as portas usam `ed-porta-ent` e `ed-porta-sai`. (5) A faixa da mesa de eventos usa `--faixa-dos-eventos` além de `--faixa-do-som` (quatro regras de `bottom` leem as duas). (6) `esperando[].no` guarda o id do nó: renomear id de nó numa edição cancela a espera daquela automação (editar o desenho já cancela as esperas). (7) O editor só abre em janela própria; testes de E2E pegam a janela com `waitForEvent("popup")`.
- **Suposições:** ver `REDESIGN.md`, "AU2 — como ficou".

## FG1 — luz e fogo

- **Onde mexer:** o modelo ao vivo é `objetoComModeloNovo` (`packages/shared/src/objetos.ts`) chamado de `modelo.editar` (`nucleo.ts`); o tamanho e o estilo da chama são `chamaDoModelo`, `chamaDoPonto`, `estiloDaChama` e `CHAMA_PADRAO` (mesmo arquivo). A capacidade nova é `equipamento.dar` (`capacidades.ts`; confere em `ficha.alterar` no `nucleo.ts` e em `mochilaAjustar` no `tochas.ts`). O asset `animacao` está em `assets.ts` (tipo, MIME, 4 MB, visível a todos), `envios.ts` (uso `animacao`), `gerente.ts` (`registrarAnimacao`). No navegador: `apps/web/src/mapa/chamas.ts` (as animações padrão por código e a decodificação do gif) e, em `mapaPixi.ts`, `desenharObjetoNoPonto`, `animarChamas`, `desenharPontos`, `alcasDeTamanho`, `alvoDaAlca` e `areaDeSoltarM`. Editor: `PainelDaMesa.tsx` (`LinhaDaAnimacao`), `PainelDeFontesDeLuz.tsx` (`EditorDoPonto`). A setinha: `AbaPrincipal.tsx` (`EquipamentoBruta`) e `preferencias.ts`.
- **Frágil:** (1) `modelo.editar` agora também emite `fonte.editada` de cada objeto do modelo: toda mudança de campo do objeto que vem do modelo precisa entrar em `objetoComModeloNovo`. (2) O objeto num ponto não se desenha mais como alça de tela: `AlcaVisual` tem dois modos (pino da mão em tamanho de tela; objeto no ponto em tamanho de mundo, com o relógio em tamanho de tela e escondido abaixo de `ZOOM_MIN_DO_ROTULO`); mexer num pode quebrar o outro (a troca de modo reseta a `chave`). (3) O ícone do ponto some enquanto há objeto à vista (`pontosOcupados`); o clique no objeto de um ponto cai no ponto para o mestre com o painel de luzes aberto. (4) A chama depende de `ImageDecoder` (Chrome/Edge); sem ele, o gif vira um quadro parado. (5) As texturas de chama pertencem ao renderer de cada mapa (`ChamasDoMapa`); destruir o mapa as destrói. (6) O filtro por `tipo === "animacao"` em `modelo.editar` é o que impede um hash qualquer no modelo. (7) `AbaPrincipal` compara `estado.permissoes` na memo do equipamento: sem isso o "+" do jogador não reage ao mestre desligar a capacidade.
- **Suposições:** ver `REDESIGN.md`, "FG1 — como ficou".

## AS1 — assets da mesa e segurança dos arquivos

- **Onde mexer:** regras puras em `packages/shared/src/assetsDaMesa.ts` (`usosDoAsset`, `listarAssetsDaMesa`, `filtrarAssets`, `verificarApagar`, `ordemDeOrigem`) e `seguranca.ts` (`conferirArquivoRecebido`, `nomeDeArquivoNoDisco`, `caminhoNaPastaOrganizada`, lista fechada e extensões proibidas); `detectarFormato` (`envios.ts`) reconhece apng e webp animado. A imagem solta é `Token.imagem` (`estado.ts`), criada por `imagem.colocar` e ajustada por `imagem.ajustar` (`nucleo.ts`); `asset.renomear`, `asset.apagar`, `asset.restaurar` e `assets.listar` estão no mesmo arquivo (a sala responde `assets.lista` em `sala.ts`). No navegador: `assets/gerente.ts` (`registrarImagemSolta`, `copiarSePreciso` = pasta organizada, `tentarDaPasta`, medidas, conferência em `finalizar`), `processador.worker.ts` (tipo `imagem`, `regravar`, `medir`), `mapa/mapaPixi.ts` (`criarVisualDeImagem`, alças `desenharAlcasDaImagem`, gesto `imagemAlca`, animação `animarImagens`), `mapa/Mapa.tsx` e `Mesa.tsx` (soltar arquivo e asset no mapa), `SecaoDosAssets.tsx` e `AssetsDaMesa.tsx` (a lista), `PainelDoToken.tsx` (corpo da imagem). MCP: `mcp/ferramentas/arquivos.ts`.
- **Frágil:** (1) a imagem solta é um token: toda regra nova de token precisa lembrar de `token.imagem` (quem não tem ficha, vida nem controle). `podeMoverToken`, `token.apagar` e a trava de parede em `token.soltar` já tratam; a lista de tokens do combate e o menu do token ignoram a imagem (o botão direito do mestre abre o painel). (2) `chaveDe` refaz o visual quando muda tamanho, giro, camada, tipo do arquivo ou se a textura chegou: se um campo novo mexer no desenho, entre na chave. (3) `listarAssetsDaMesa` é recalculada no navegador do mestre a cada mudança de estado (com 250 ms de espera); com milhares de assets e tokens, ver o custo. (4) A conferência dos bytes roda em `finalizar`, em `guardarNaPasta`, em `copiarSePreciso` e em `sincronizar`; um tipo de arquivo novo precisa entrar em `FORMATOS_DO_TIPO` (`seguranca.ts`) e em `MIMES_DE_IMAGEM` ou na regra do `validarMeta`. (5) `recebidos/<jogador>/` não é mais gravado (só existe nas pastas antigas). (6) Os testes E2E rodam com "reduzir movimento": a animação fica no primeiro quadro (o teste liga o movimento com `emulateMedia`).
- **Suposições:** ver `REDESIGN.md`, "AS1 — como ficou".
