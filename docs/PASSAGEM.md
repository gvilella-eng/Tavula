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
- Dicas (V3b): só em botão sem nome à vista, uma linha, 700 ms no mouse (na hora no teclado), opção `tabletop:pref:dicas` em Preferências. `Dica.tsx` (`useDica`: atraso e troca), `BotaoComDica.tsx` (`nomeVisivel`, `dicaSe`, `motivo`), `dicasLigadas.ts`. As explicações que saíram das dicas estão em `textosDoTour.ts` (o tour vem depois do V5).
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
  conteúdo (texto preto ou branco no avatar e nas iniciais do token, escolhido pela cor em `contrasteDeCor.ts` desde o R6a; contorno do ponto da ordem de turno, sigla das condições, roda de cores
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
  - `abas.tsx`: `AbaPreferencias` (usuário, tema, encaixe, pasta local de imagens, status dos arquivos). A `AbaNotas` saiu no V3.
  - `AbaChat.tsx`, `AbaFichas.tsx`, `AbaCompendio.tsx`: as abas de chat (com os modelos de rolagem), fichas
    (**árvore** de pastas, personagens, NPCs e handouts, V3; "+ Novo" único; menu de botão direito em `MenuDeContexto.tsx`) e compêndio de magias.
  - Handouts (V3): `JanelaDoHandout.tsx` (a janela, o campo de texto com rascunho e a miniatura da lista), `handouts.ts` (as 5 fontes e o `useJanelasDeHandout`), "Mostrar agora" em `Mesa.tsx` (escuta `handout.mostrado`). Estado: `Estado.handouts`, regras em `packages/shared/src/nucleo.ts`, migração das notas em `pastas.ts` (`migrarNotasParaHandouts`) e na migração SQL 9 de `armazenamento.ts`.
  - `ficha/BotaoImportarPdf.tsx`: o botão "Importar PDF" (seletor de arquivo + revisão), na aba Configurar da ficha; o V4 o reaproveita.
  - `AbaMesa.tsx` (a aba Mesa, só do mestre e, desde o V1, a última aba, depois de Preferências: índice, papéis, capacidades, campanha, diagnóstico), `PainelDaMesa.tsx` (as seções de regras da mesa e de modelos de luz que ela usa) e `PainelDeIluminacao.tsx` (a janela de iluminação).
  - `PainelDoToken.tsx`: painel compacto do mestre para o token selecionado (canto inferior esquerdo da área do mapa). Desde o R5a só abre por "Editar token…" ou por dois cliques no token; selecionar só seleciona.
  - `NovoToken.tsx`: a janela "Novo token" (nome, cor, tamanho) e, depois dela, o modo de pôr o token com a prévia (a prévia e o clique estão em `mapa/mapaPixi.ts`; o selo e a ligação em `Mesa.tsx`).
  - `AvisoPerto.tsx`: o aviso de erro dentro da área do mapa, perto de onde a pessoa agiu (a origem é guardada em `useSala.ts`).
  - `janelas/Janela.tsx`, `janelas/pilha.ts`, `janelas/geometria.ts`: a janela flutuante comum (arrastar, minimizar, redimensionar, dentro da área, pilha). Posição e tamanho por janela em `tabletop:pref:janela:<id>` (`preferencias.ts`).
  - `OrdemDeTurno.tsx`: a ordem de turno (uma `Janela`), simples desde o V2 (270 px, layout de referência): cabeçalho só com título e ×, linha "Rodada: N", lista e rodapé do mestre (Turno anterior, Limpar, Ordenar, Próximo turno), menu de botão direito na linha, Alt+↑/↓. O jogador entra pela Iniciativa da ficha (`ficha/JanelaDaFicha.tsx`, `entrarNaOrdem`; `combate.entrar` na sala).
  - `FaixaDeCenas.tsx`: faixa de cenas, com prévia do mapa e menu de contexto.
  - `ConfigurarCena.tsx`: nome, mapa, pixels por quadrado e o grid da cena (visível e quadrado em metros).
  - `PainelDasParedes.tsx`, `PainelDeFontesDeLuz.tsx`: paredes e portas; fontes de luz.
  - `MenuDoToken.tsx`, `MenuDaTocha.tsx`: menus de botão direito no token (Editar token…, "Entrar na iniciativa" (sem valor; o mestre escreve o número), grupo Tocha e as condições direto como itens de marcar) e na alça da
    tocha.
  - `SubBarraPincel.tsx`, `DadosRapidos.tsx`, `ZoomFlutuante.tsx`: sub-barra do pincel, grade de dados
    rápidos e controle de zoom no canto inferior direito da área do mapa.
  - `ficha/JanelaDaFicha.tsx` e as demais em `ficha/`: a janela da ficha 5e e a revisão da importação de PDF. Desde o V4a (refeito) a ficha é o desenho aprovado em `docs/desenho/`: `JanelaDaFicha.tsx` (cabeçalho, fitas, estreita por `ResizeObserver`), `AbaPrincipal.tsx` (Personagem, 3 colunas e acordeão; as peças são exportadas), `AbaMagias.tsx`, `AbaHistoria.tsx`, a Configurar (`EditorDoItem` mais a Aparência), `EditorDeAtaque.tsx` (a engrenagem), `conjurar.ts`, `modificadorExtra.tsx` (V4a3: botão direito / Shift+F10 nas linhas de perícia e salvaguarda), `rolador.ts`, `aparencia.ts` (Livro/Clássica, `localStorage`), `livro.tsx` (título, caixa, bolinha, acordeão), `ListaDeTitulos.tsx` (características), `PainelExtra.tsx` (condições, luz, recursos) e `ficha.css` (tudo sob `.fl-raiz`; a pele vem de `data-pele`). A janela usa `camadaAlta` e `cabecalhoMinimizado` da `Janela`.
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
65. Marcadores no mapa: duas letras e uma cor por condição; regra só em dica com o mouse (`ESTADO:1406`)
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
- A bandeira de chegada só é arrastável com a ferramenta Selecionar. (`ESTADO:855`)

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

- Espaços por círculo: `AbaMagias.tsx` (`TotalDeEspacos`, `Nivel`, "+ Círculo" com estado local). O total vem de `espacosDaFicha`; `espacosAutomaticos` dá só a conta das classes (para o "auto"). `CampoNumero` ganhou `aoApagar` (apagar o texto chama o callback em vez de não enviar nada).
- Sem classe: `habilidadeDeConjuracao` + `conjuracaoSemClasse(f)` (testids `conjuracao-habilidade-livre`, `conjuracao-cd-livre`, `conjuracao-ataque-livre`). Com classe conjuradora o campo é ignorado.
- `espacos-resumo-N` ("3/4") virou `espacos-restantes-N` (só o número). O testid `espaco-total-N` continua, agora à vista.
- Dados de Vida: bolinhas em `.fl-bolinhas-dv` (quebram de linha); acima de `LIMITE_DE_BOLINHAS_DE_DV` (12) vira contador com `dv-menos-*` e `dv-mais-*`.
- Frágil: o popover do modificador sai por portal no body (fora do `.fl-raiz`; estilo `.popover.fl-pop-mod`); o foco volta ao botão da linha por `data-testid`. A tecla Menu também dispara `contextmenu`; uma janela de 700 ms evita abrir duas vezes (como no menu das Fichas).

## V4b (2026-11-12): NPC, arrastar do compêndio e reordenar

- NPC: `ficha/BlocoDoNpc.tsx` (o bloco inteiro; os estilos são os `npc-*` do fim de `ficha.css`, em container query `npc`, não pela largura medida como o PJ). Quem decide é `apresentacaoDoPersonagem` (`shared/pastas.ts`); a `JanelaDaFicha` troca só o corpo e as props da `Janela` (`LARGURA_DO_NPC` 520 em `janelas.ts`). Sem abas: a engrenagem do cabeçalho (`npc-configurar`) alterna o bloco e a Configurar (`janela.aba`).
- Os testids do PJ que o NPC reaproveita: `ficha-nome`, `ca-<id>`, `pv-atual-<id>`, `pv-max-<id>`, `pv-menos`, `pv-mais`, `atributo-mod-<a>`, `atributo-valor-<a>`, `salvaguarda-botao-<a>`, `percepcao-passiva`, `editor-ataque` (o editor da engrenagem abre dentro da linha). Novos: `npc-*` (ver `BlocoDoNpc.tsx`), `traco-*` (a `ListaDeCaracteristicas` com `testidBase="traco"`).
- A ação do NPC é um `ataques[i]` com `categoria`; reordenar e arrastar usam o **grupo** da categoria (`posicoesDoGrupo`), então as três listas moram no mesmo array. Mudar a categoria na engrenagem muda a linha de seção.
- Reordenar e soltar: `ficha/ordem.tsx` (`useOrdemDaLista`, `useSoltarDoCompendio`, o arrasto do compêndio guardado num store do módulo, com `useEntradaEmArrasto`). As linhas precisam de `data-linha-lista` e `data-linha-i` (o hook devolve os atributos); cada lista tem um nome único **dentro da janela da ficha** (`ataque`, `magia-ataque`, `itens`, `caracteristicas`, `circulo-N`, `acao`, `reacao`, `lendaria`). O CSS do indicador, da linha levantada e da área acesa está no começo do bloco V4b de `ficha.css` (`data-indicador`, `data-levantada`, `data-aceita-soltar`).
- Frágil: o `dragleave` do Chrome vem com `relatedTarget` nulo ao passar entre filhos; por isso a saída da área é decidida pela posição do ponteiro. A pré-visualização do vão calcula com a posição do último `dragover`: depois que as áreas acendem a tela se ajusta, então um E2E precisa de um passo a mais do mouse antes de olhar a linha indicadora.
- Frágil: reordenar recria as linhas (as expandidas voltam fechadas) porque elas se identificam pela posição; no PJ o editor da engrenagem aberto é fechado ao mover.
- Frágil: o segurar com toque pode virar rolagem da página (o navegador toma o gesto); só foi exercitado com mouse e teclado.
- Compêndio: `armas` e `itens` opcionais em `compendio.ts`; a aba lista os três tipos quando o arquivo traz armas ou itens. `compendio-entrada-arma` e `compendio-entrada-item` são as linhas arrastáveis; `compendio-item` segue sendo só a linha de magia. O botão "Adicionar à ficha" da magia e o "Adicionar" de arma e item passam por `aplicarEntradaNaFicha`.
- Dados novos da ficha e regra de proficiência por ND: `bonusDeProficiencia` olha `npc.nd` antes do nível das classes.

## V4b2 (2026-11-12): Conjuração do NPC e o nome com a capitular

- Seção Conjuração do NPC: `ficha/ConjuracaoDoNpc.tsx` (`SecaoDeConjuracao` entra no `BlocoDoNpc` entre Traços e Ações). Os dados são os do personagem (`magias`, `espacosTotal`, `espacosGastos`, `habilidadeDeConjuracao`): não crie campo paralelo. Reaproveita `Espacos` e `subDaMagia` (agora exportados de `AbaMagias.tsx`), `conjurar.ts` e `EditorDeAtaque`. O título de seção do bloco (`TituloDoBloco`) mora em `livro.tsx`. Testids: `npc-secao-conjuracao`, `npc-conj-cd`, `npc-conj-ataque`, `npc-conj-habilidade`, `npc-conj-nivel-<n>`, `npc-conj-magia-<i>`, `npc-conj-conjurar-<i>`, `npc-espaco-<n>-<k>`, `npc-espaco-total-<n>`, `npc-nova-conjuracao`.
- A magia solta no NPC: `aplicarEntradaNaFicha(..., "npc")` em `compendioParaFicha.ts` (sem classe nem atributo escolhido, grava também `habilidadeDeConjuracao`). `useSoltarDoCompendio.listaDoTipo` aceita uma função da entrada e há a opção `fluxo` (chips lado a lado) em `ordem.tsx`; listas `npc-circulo-<n>`.
- Frágil: o manipulador de foco de `NomeComCapitular` troca o valor do input direto no DOM (antes do render) para o preenchimento por código (Playwright `fill`) substituir o texto em vez de anexar ao fim. Não passe isso para um `useEffect`.
- Suposição: a seção existe com magias, atributo ou total de espaços escolhido; sem isso só o "+ Conjuração" de quem edita. Ver `REDESIGN`, "V4b2".

## B1 (2026-11-12): importador do Rendan, "Ficha de", aviso e chips

- Importador: o PDF do Rendan (`fixtures/fichas/brendan.pdf`, esperado em `brendan.json`) tem o campo "Classe & nível" cortado com "…". `classeDeTextoCortado` e o nível pelos dados de vida estão em `importarFichaPdf.ts` (no cabeçalho); as tabelas de raça, tendência, antecedente e idioma, em `importarTraducoes.ts` (puro; nome desconhecido fica como veio). Frágil: o nível só é lido assim para uma classe; antecedente, raça e tendência só leem itens que começam na coluna do rótulo (`valorDe(..., daColuna)`).
- `AbaCompendio.tsx`: `useAlvoDaFicha` segue a ficha em foco (`useFichasNaPilha` em `janelas/pilha.ts`); a escolha à mão vale até o foco mudar (reset durante o render).
- Aviso das fichas: `JanelaDaFicha` recebe `avisar` (o toast `AvisoPerto`, testid `aviso`); o `ficha-aviso` não existe mais. `AvisoPerto` tem `role="status"` sem código de erro e `alert` com código (o `biome-ignore` de `noStaticElementInteractions` é por isso).
- Conjuração do NPC: `.npc-conj-chips` ocupa a linha toda (`ficha.css`). Ver `REDESIGN`, "B1".

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
