# Perguntas em aberto e rascunhos dos próximos lotes

Juntadas durante os Lotes 6 a 14 (2026-11-06 a 10) para fazer ao Vilella no fim. Os rascunhos dos Lotes 11, 13 e 14 viram o "Decidido antes de começar" de cada lote no PROJETO.md quando o lote começar.


## Respondidas em 2026-11-10
- O mestre entrega, põe e tira tochas de suportes **de longe**; o alcance vale para os jogadores (feito).
- Névoa: **só automática** por ora; a manual foi para `docs/IDEIAS.md`.
- Darion: valem os números do **PDF** (9 tochas; 7 flechas de máximo 20) (feito no `darion.json`).
- Visão do mestre: a área de visão no escuro do jogador aparece em **cor normal** para o mestre (como já estava).

## Novas do R4 (2026-11-10)
- O brief do R4 falava em "tamanho, cor, visível" para o grid da cena, mas a cena só tem "visível" e "quadrado em metros" (não há cor de grid no modelo). (assumido) ficou sem cor; se quiser cor, é mudança na sala (novo campo no grid e no protocolo).
- Os botões do menu do topo mostram nome e o que fazem, mas ainda sem atalho de teclado (não há atalhos para eles). (assumido) atalhos e dicas unificadas na barra esquerda ficam para o R6. **Respondido no R6a:** a dica é uma só, com os atalhos que já existiam (não há atalho para os botões do topo).
- Nenhuma pergunta antiga foi respondida pelo R4; a de `ficha.verOutras` segue aberta (só mudou de aba, de Mestre para Mesa).

## Novas do R6a (2026-11-11)
- Atalho para o menu do topo e para outros botões: não inventei nenhum além de Shift+F10 / tecla de menu (menu do token). Se quiser atalhos para Cenas, Ordem de turno etc., é decisão de produto. (assumido) sem atalho.
- O jogador não seleciona tokens; (assumido) Shift+F10 abre o menu do token que ele controla.
- Selecionar um token só pelo teclado não existe (o mestre seleciona com o mouse). Vale um atalho (por exemplo Tab entre tokens)? (assumido) não neste lote.

## Novas do R6b (2026-11-11)
- O aviso da pausa automática para os jogadores (ficou do R2b) **foi feito no R6b**: dica da pílula e aviso no alto do mapa quando a mesa está pausada e não há mestre online.
- Numa tela baixa (altura da área < 900 px) o painel do token vai embaixo à direita e divide a coluna com a ordem de turno. (assumido) Vale ficar assim? A alternativa é o painel do token embaixo à esquerda, com a ficha menor.
- Os prints dos lotes 6 a 14 e r1, r2, r2b, r3 foram apagados (só mostravam a interface de cada lote). (assumido) O tour `auditoria` e os `r4` a `r6b` bastam.

## Novas do V1 (2026-11-11)
- "Masmorra" serve como nome do antigo Edgerunner (id `escuro`)? (assumido: sim)
- O relógio zerado vale para a mesa inteira, mas só o mestre o vê. Quer que o jogador veja o relógio zerado (um tempo de sessão)? (assumido: não)
- O "Zerar o relógio" fica num botão de seta ao lado da pílula do topo; prefere clique direito na pílula? (assumido: seta, que também vale no teclado)
- Quer um "marcar tempo" (vários marcos, como cronômetro de voltas) em vez de só zerar? (assumido: não)

## Novas do V2 (2026-11-11)
- A ordem "na tela" reaproveita o `ordemDeTurnoVisivel` que já existia (em vez de um campo novo `combate.aberta`). (assumido: sim)
- Entrar, rolar e mudar um valor reordenam a lista sozinhos; o arrasto à mão vale até o próximo valor mudar ou o Ordenar. Prefere que nada reordene sozinho (como nas mesas virtuais)? (assumido: reordena)
- A Iniciativa da ficha usa o token selecionado só se for do personagem daquela ficha; senão o único token dele na cena; com vários ou nenhum, avisa "Selecione o seu token no mapa.". (assumido)
- Clicar num token que o jogador não controla solta a seleção dele. (assumido)
- Rolar para todos, esconder entrada ou valor dos jogadores e o "Passar o meu turno" saíram da tela. Sente falta de algum? (assumido: não; voltariam no botão direito da linha)
- O "Entrar na iniciativa" do botão direito no token entra sem valor (o mestre escreve). Prefere que ele já role? (assumido: sem valor)
- O × do jogador fecha a ordem só na tela dele até o mestre reabrir. (assumido)
- Resolve o item 34 do Lote 11 ("o jogador pode refazer a própria iniciativa?"): sem botão de rolar, só o mestre muda o valor (e a Iniciativa da ficha não rola de novo).

## Já vinham de antes
- Camada mapa = imagem do mapa + objetos de cenário? (assumido)
- Pincel: jogador apaga/seleciona só os próprios desenhos? desenhar é delegável e ligado por padrão? (assumido)
- Dados rápidos: coluna = quantidade? (assumido)
- Visibilidade do item = pela pasta + editores? (assumido)
- Compêndio: JSON local (direitos do Livro do Jogador; SRD é a alternativa livre)?
- Tocha: apagada ocupa mão? qualquer jogador no alcance tira do suporte? entregar exige 1,5 m? (assumido)
- ~~Nome do projeto~~: **Távola** (2026-11-10).
- ~~Névoa manual × só automática~~: só automática por ora (2026-11-10). Mudou em 2026-11-14: a névoa manual virou o lote N4 (o "mapa revelado aos poucos" segue descartado).
- Ícone de eventos (7b) e o desenho das automações; MCP (12).
- Lista de ajustes de interface que ele quer fazer.
- Roteiros manuais pendentes: Lote 3 (parcial), Lotes 4 a 11, 13, 14, R1 e R2 (o 4b não tem roteiro escrito; foi interface para ver). Lista em `docs/PASSAGEM.md`.

## Novas do V3 (2026-11-11)
- As 5 fontes dos handouts são Inter, Lora, Caveat, MedievalSharp e Special Elite (todas livres e empacotadas). (assumido) servem; se alguma não agradar, troca-se só o pacote e o nome do CSS.
- O jogador não cria handout (só o mestre). Quer que o jogador possa criar handouts próprios (anotações dele)? (assumido: não)
- A "Nota da mesa" e a "Nota do mestre" viraram handouts numa pasta "Handouts" só do mestre. Quer que a pasta apareça para todos? (assumido: não; o jogador a vê pelo handout que lhe cabe)
- A capacidade `nota.editar` ficou sem uso (some da tela da Mesa). (assumido) sai de vez num lote futuro; mantida agora por causa de bancos e arquivos antigos.
- "Importar PDF" não cria mais uma ficha nova direto da aba: cria-se o personagem e importa-se dentro da ficha. (assumido) basta.

## Novas do V4b (2026-11-12)
- O NPC abre com 520 px (a medida do protótipo N), não os ~620 do brief. (assumido) serve; o mínimo é 380 px e abaixo de ~460 vira uma coluna.
- Na ação do NPC o botão Acerto rola acerto e dano juntos (como no protótipo) e o título só expande a descrição. O brief dizia "o nome rola os dois" e "o título expande". Qual dos dois prefere no nome? (assumido: título expande)
- A recarga ("Recarga 5–6") rola um d6 no chat e a caixa se marca à mão; não há marcação automática. (assumido) basta.
- A arma do compêndio entra com proficiência (não há como saber se o personagem é proficiente). (assumido) serve; se não for, desliga-se "proficiente" no editor.
- O compêndio ganhou `armas` e `itens` opcionais no mesmo arquivo. Monstros ficam para um lote futuro. (assumido) sem versão nova do formato.
- (V4b2 respondeu) A magia solta no NPC agora entra na seção Conjuração (em `magias`, no círculo dela, com ataque ou CD calculados), não mais como traço.
- Item de luz (Lanterna, Tocha 5e) solto por um jogador segue a regra de hoje: só o mestre repõe objetos de luz, então a sala recusa. (assumido) mantido.

## Lote 6
- ~~Visão noturna do mestre~~: cor normal, como está (2026-11-10).

## Lote 7
- ~~Onde fica o botão de pausar a mesa e o relógio da sala~~ Respondida pelo redesign R2 (2026-11-10): no topo da mesa, à direita. Um controle só: o mestre vê o botão ⏸ com o relógio da sala dentro e, pausada, a pílula de aviso "▶ relógio" que retoma; o jogador vê só o ícone ⏸ na pílula amarela (sem a palavra "Pausada"). A faixa do meio do mapa saiu. O relógio é o tempo da sala e só o mestre o vê.
- Estágios: forte > 50%, fraca ≤ 50%, morrendo ≤ 10% da duração (assumido; configurável).
- Consumida some da mão e da coleção (assumido).
- Semente: Tocha 5e 60 min 6+6 m; Lanterna 6 h 9+9 m; Fogueira infinita.
- luz.apagar (padrão desligado) = apagar luz de ponto; a própria tocha usa tocha.acender.
- ~~O mestre também precisa estar ao alcance para entregar a tocha?~~ Não: o mestre entrega de longe (2026-11-10, feito).
- Editar um modelo (ex.: Tocha) muda as tochas já acesas? (assumido: não)
- Apagar com penalidade maior que o saldo consome a tocha (assumido).
- ~~Sobreposição de alças e ícones de ponto quando o ponto fica colado ao token (ajuste de interface).~~ Resolvida no R5a (2026-11-11): a alça da tocha, agora maior, se afasta para o lado quando cairia em cima do ícone de um ponto.

## Lote 8
- O mestre vê todos os sussurros? (assumido: sim)
- Chat fora da exportação da campanha? (assumido)

## Lote 9
- Ficha completa de outro personagem só com ficha.verOutras (padrão desligado)? (assumido) Atenção: a capacidade sumiu da tela do mestre (`AbaMesa.tsx`, `CAPACIDADES_NA_TELA`, "quem vê a ficha agora é a pasta"; o R4 só mudou a aba de lugar, de Mestre para Mesa), mas ainda vale no código (`packages/shared/src/mapa.ts:81`).
- Ficha numa janela flutuante sobre o mapa (como nas mesas virtuais): feita no Lote 9 (`JanelaDaFicha.tsx`); arrastar e lembrar a posição por usuário vem no R3.

## Lote 10
- Caixas de recurso do PDF sempre para revisão (assumido). Precisa de um 2º PDF de outro jogador para o "pronto quando".
- Guardar na ficha os espaços de magia e os dados de vida lidos do PDF, em vez de só conferir com a tabela das classes?
- Todas as magias entram como preparadas (o PDF não diz quais estão): ok?
- ~~O PDF do Darion traz Tochas 9 e Flechas 7; a ficha do Lote 9 tinha 3 e 9. Qual vale?~~ O PDF (2026-11-10, feito no `darion.json`).

## Lote 11
- Empate de iniciativa: Destreza, depois PJ antes de NPC, depois nome (assumido).
- O jogador da vez passa o próprio turno (assumido).
- Condições no token, não no personagem (assumido).
- "Adicionar selecionados" deveria aceitar vários tokens de uma vez? (a seleção múltipla no mapa ainda não existe)
- O jogador pode refazer a própria iniciativa, ou só o mestre? (assumido: só o mestre)
- ~~A dica das condições deveria abrir também por clique (tela de toque)?~~ Respondida no R5a (2026-11-11): sim, a regra abre por clique no marcador (popover que fecha com Esc ou clique fora), além da dica no mouse.
- O nome da entrada na ordem de turno deve seguir a renomeação do token? (assumido: não)
- (R5b) A seção "Montar" da ordem de turno: aberta antes do combate e recolhida depois, com a escolha da pessoa valendo daí em diante (assumido); Esc no campo da iniciativa devolve o valor de antes (assumido). Resolvido no R5b: o número da iniciativa só vale no Enter ou ao sair do campo.
- Ideias para o 7b: teste de concentração com a CD sugerida; condições que aplicam vantagem ou desvantagem nas rolagens.

## Lote 13
- Borracha apaga o desenho inteiro (assumido).
- O jogador sem `desenho.criar` ainda pode apagar os próprios desenhos? (assumido: não)
- As formas devem encaixar no grid? (assumido: não)
- O arrasto de um desenho deve aparecer ao vivo para os outros? (assumido: não, só ao soltar)
- Quer refazer, desfazer o apagar ou seleção múltipla de desenhos?
- Espessura em metros (acompanha o mapa) em vez de pixels do mundo?

## Lote 14
- Compêndio distribuído como asset (o mestre tem o JSON, os jogadores recebem pelo caminho das imagens).
- Quem manda no compêndio quando há dois mestres? Compêndio pessoal do jogador?
- Avisar quando a classe do personagem não conjura a magia adicionada?
- Mostrar as classes e o nome original na lista do compêndio?
- Conversor de outros formatos; monstros e armas no mesmo arquivo ou em outro?
- Conferir a tradução das 3 magias do exemplo do SRD.
- (R5b) "Usar o exemplo" no estado vazio: com pasta local grava `compendio/magias.json` (confirma antes de substituir) e sem pasta vale até recarregar (assumido). A ajuda do JSON ficou recolhida em "Como montar o seu arquivo" (assumido).

## Lote 8 (do agente)
- Seta para cima deve reenviar ou só trazer a mensagem de volta? (assumido: só trazer)
- Retrato de quem fala pode ser visto por quem não vê a ficha? (assumido: sim, numa mensagem pública)
- A lista de presença no topo do chat ocupa muito espaço com 8 pessoas (ajuste de interface).

## Lote 9 (do agente)
- O jogador pode repor tochas na própria ficha? (assumido: só o mestre aumenta)
- A importação da ficha deve ler também de dentro de `fichas/`? (assumido: arquivo escolhido)
- ~~A janela da ficha deve lembrar a posição?~~ Respondida no R3 (2026-11-10): sim, por usuário, no navegador dele (x, y, tamanho e minimizada, uma por personagem), nunca na sala.
- Darion: conferir na ficha impressa Labareda Protetora 2/longo e Radiação do Amanhecer 1/curto (tochas e flechas já seguem o PDF desde 2026-11-10).

---

# Rascunho: Lote 11 (combate)

**Decidido antes de começar (2026-11-06; prevalece sobre os itens acima onde conflitar; "(assumido)"
entra nas perguntas do fim):**
- **Conteúdo da ordem de turno** (o painel e o mostrar/esconder já existem desde o Lote 4b):
  `{ entradas: { id, tokenId?, nome, iniciativa, valorOculto? }[], atual, rodada }`.
  - o mestre adiciona tokens (botão direito no token → "Entrar na iniciativa", ou "Adicionar
    selecionados") e entradas soltas ("Covil, 20");
  - "Rolar para todos" rola a iniciativa de cada entrada com o bônus da ficha (ou 0) pelo modelo do
    Lote 8, e o resultado vai para o chat; o jogador rola a do próprio personagem;
  - ordena da maior para a menor; **empate:** maior Destreza; empate de novo, o personagem de jogador
    antes do NPC e depois pelo nome (assumido);
  - o mestre arrasta para reordenar e edita o valor; "Próximo turno" e "Anterior"; virar a lista soma a
    rodada. **O jogador da vez pode passar o próprio turno** (assumido);
  - "Encerrar combate" limpa a lista e a rodada (com confirmação).
- **Sigilo:** entrada de token oculto ou da camada do mestre não chega aos jogadores; `valorOculto`
  mostra o nome com "?" no lugar do número. Filtro na sala, como os demais.
- **Token da vez:** um anel destacado no mapa para todos que veem o token; a lista mostra a vez em
  destaque e acompanha a rolagem.
- **Condições do 5e** (as 14 e Exaustão de 1 a 6) ficam **no token** (assumido; cada goblin tem as
  suas), com ícones pequenos na borda do token e na ficha (a ficha mostra as do token do personagem na
  cena ativa). Botão direito no token → Condições. Quem pode: o mestre e quem controla o token.
- **Concentração:** marca no token (com o nome da magia), mostrada no token e na ficha. Sem automação de
  teste de Constituição por enquanto (vira ideia para o 7b).

---

# Rascunho: Lote 13 (pincel)
**Decidido antes de começar (2026-11-06; "(assumido)" entra nas perguntas do fim):**
- **Desenho** (`Desenho`, coleção `desenhos`): `{ id, cenaId, autorId, forma: 'livre' | 'linha' |
  'retangulo' | 'circulo', pontos (em metros), cor, espessura, preenchido? }`. Traço livre simplificado
  no navegador (Douglas–Peucker) antes de enviar; até 2000 pontos por desenho.
- **Ao vivo:** enquanto desenha, o navegador manda o traço em andamento a cada ~80 ms
  (`desenho.rascunho`, só repassado, não gravado); ao soltar, `desenho.criar` grava.
- **Camada de desenho** sempre por cima do mapa e dos tokens, **visível também no escuro** (fora do
  véu). Para o mestre, aparece no menu de camadas; os jogadores só veem os desenhos.
- **Pincel** (sub-barra que já existe): voltar (desfaz o último desenho meu), selecionar (mover e apagar
  os meus; o mestre, todos), formas, cores (paleta de 8 + cor livre), espessura e borracha (apaga o
  desenho inteiro que tocar, não pedaços) (assumido).
- **Capacidade delegável nova** `desenho.criar`, ligada por padrão; apagar e mover só os próprios
  (assumido); o mestre mexe em todos e tem "Limpar todos os desenhos" (da cena) no menu de camadas, com
  confirmação.
- Exportação: os desenhos entram (versão nova).

# Rascunho: Lote 14 (compêndio)
**Decidido antes de começar (2026-11-06; "(assumido)" entra nas perguntas do fim):**
- **Formato** (`packages/shared/src/compendio.ts`, zod): `{ formato: 'tabletop-compendio', versao: 1,
  magias: { nome, nomeOriginal?, nivel, escola, tempo, alcance, componentes, duracao, concentracao,
  ritual, classes[], descricao, emNiveisSuperiores? }[] }`. Um conversor simples de outros formatos
  fica para depois.
- **Premissa das imagens:** o mestre põe `compendio/magias.json` na pasta local dele. O arquivo nunca
  fica no servidor: o navegador do mestre registra o arquivo como asset (tipo `compendio`, por hash) e
  os jogadores o recebem pelo mesmo caminho das imagens (pedaços, cache local). Sem pasta ou sem
  arquivo, a aba mostra como montar o JSON.
- **Repositório:** nenhum texto de magia com direitos autorais no repo. Um exemplo com 3 magias do SRD
  5.1 (CC-BY-4.0) em `fixtures/compendio/exemplo-srd.json` para testes.
- **Aba Compêndio:** busca por nome (sem acento e sem caixa), filtros de nível, escola, classe,
  concentração e ritual; a magia abre um cartão com a descrição completa.
- **Ações:** "Mandar para o chat" (cartão da magia no chat, "Como:" o personagem) e "Adicionar à ficha"
  (escolhe o personagem que eu edito; entra na lista de magias com a descrição).
- Monstros e armas ficam para depois.

## 7b-1: o motor das automações (2026-11-13)

Sem pergunta nova para o Vilella: ele aprovou o plano do 7b. As suposições do lote estão em `docs/REDESIGN.md`, "7b-1 — como ficou" (todas com "(assumido)"). As que mais valem uma olhada quando o editor chegar (7b-3): um ciclo criado roda na hora (e há `pausado` para criar parado); a fase do segundo 0 dispara ao começar; `ciclo.disparar` pula para a fase seguinte; sem `porS` o prazo vem da fase (ou 30 s).

## 7b-3: o editor, os botões e as campanhas (2026-11-13)

Sem pergunta nova para o Vilella: ele aprovou o plano do 7b. As suposições do lote estão em `docs/REDESIGN.md`, "7b-3 — como ficou" (todas com "(assumido)"). As que mais valem uma olhada: o editor é uma janela aberta da aba Mesa; o nome que o mestre dá a um ciclo ou botão liberado é o que o jogador lê; o jogador pode disparar, pausar e retomar um ciclo liberado (não há liberação por ação); 1 disparo a cada 2 s por jogador; a chance aparece em % nos formulários; a Chama Primordial vem pausada, sem personagens e com a respiração fixada na barra.

## 7b-2: as zonas (2026-11-13)

Sem pergunta nova para o Vilella: ele aprovou o plano do 7b. As suposições do lote estão em `docs/REDESIGN.md`, "7b-2 — como ficou" (todas com "(assumido)"). As que mais valem uma olhada: "dentro" é o centro do token no polígono (e a luz acompanha quem a carrega); a zona fica visível, fraca, para o mestre mesmo fora da ferramenta; a tecla é Z; Esc cancela o polígono (nas paredes, Esc encerra); as reações de modelo que ouvem `token.entrouNaZona` agem no token que entrou.

## 12-1: o acesso do Claude (2026-11-13)

Sem pergunta nova para o Vilella: ele aprovou o plano do MCP. As suposições do lote estão em `docs/REDESIGN.md`, "12-1 — como ficou" (todas com "(assumido)"). As que mais valem uma olhada: até 5 tokens por conta e mesa; 20 pedidos por segundo por token (rajada de 40); a ficha e o handout do jogador moram numa pasta própria ("Fichas de <nome>", só ele e o mestre a veem); o Claude do mestre também publica rascunhos; publicar o que o Claude criou não impede o Desfazer; o Desfazer não cobre relógio, permissões, configuração, chat, combate nem desenhos; e a lista de proibidos inclui o vaivém de arquivos (`asset.*`) além do que o brief dizia.

## 12-2: o servidor MCP (2026-11-13)

Sem pergunta nova para o Vilella: ele aprovou o plano do MCP. As suposições do lote estão em `docs/REDESIGN.md`, "12-2 — como ficou" (todas com "(assumido)"). As que mais valem uma olhada: o MCP não leva o grupo para outra cena, não dispara eventos nem aperta botões (são ações ao vivo, só a pessoa pela mesa); o tamanho da cena não se muda (60 x 45 m); o compêndio do MCP é o arquivo do computador e não tem monstros (o NPC se monta por partes); "criar ou editar" é decidido pelo nome exato; a nota nova do mestre nasce só para ele; e o comando do Claude Code usa o caminho relativo `apps/mcp/dist/tavola-mcp.mjs` (rode na pasta do Távola).
