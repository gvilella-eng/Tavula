# Roteiro de testes manuais (lotes de 2026-11-12)

Este roteiro cobre o que entrou no plano autônomo de 2026-11-12 (V4a3, V4b, V4b2, V5, B1, C1, C2, C3 e o tour) e
nos ajustes da noite (V6, V7, V8, V9 e a tela inicial C4). Os
testes automáticos (o `pnpm verify`) passaram em todos os lotes; aqui fica o que só dá para conferir com os olhos e
as mãos. Cada item diz **o que fazer** e, depois de "→", **o que deve acontecer**.

## Antes de começar
- **Uma vez só:** pare o `pnpm dev` (Ctrl+C) e rode `pnpm dev` de novo. O C1 trouxe um Durable Object novo (o
  diretório de mesas), e o servidor precisa subir do zero uma vez.
- Use o Chrome ou o Edge, porque a pasta local só funciona neles.
- Para ver como jogador, use outro perfil do navegador ou uma janela anônima.

## C1 — Tela inicial e várias mesas
1. Abra `http://127.0.0.1:5173/` → aparece um **cartão com três abas** ("Minhas mesas (N)", "Entrar com código" e "Criar mesa"),
   sem barra de rolagem na página. Abre em "Minhas mesas", com a campanha como **"Campanha"** (id embaixo do nome).
   Teste as setas ← → e Home/End nas abas.
2. Na aba **Entrar com código**, copie o id da Campanha, cole em MAIÚSCULAS e com espaços e clique em Entrar → abre a
   Campanha.
3. Volte ao início, vá em "Entrar com código" e cole o link inteiro (`http://127.0.0.1:5173/m/...`) → abre igual.
   Na aba **Criar mesa**, confira o passo a passo: o passo 1 não avança com senha curta ou confirmação diferente; o passo 2
   mostra a pasta, com "Voltar" e "Criar". Trocar de aba volta ao passo 1 sem perder o que foi digitado.
4. Digite um id inventado → aparece "mesa inexistente" com "Voltar ao início".
5. Dentro da Campanha, abra a aba **Mesa** → no alto, "Esta mesa" mostra o nome e o id, com os botões de copiar.
   Troque o nome → o nome novo aparece no título da aba do navegador e para quem estiver na mesa, sem recarregar.
6. Confira que **nada da campanha mudou**: fichas, cenas, tokens, chat e tochas estão como antes.
7. A pasta de imagens da campanha continua a mesma → as imagens carregam sem pedir a pasta de novo.

## C2 — Contas por mesa
1. Na Campanha, sem estar logado → aparece **"Criar a conta do mestre desta mesa"**. Crie com login, nome e senha
   (5 ou mais caracteres) → você entra como mestre, com tudo como estava.
2. **Anote o código de recuperação** que aparece (C3), marque "Anotei o código" e continue.
3. Em outro perfil do navegador, abra o link da mesa e escolha "Pedir para entrar" com nome, login e senha → aparece
   "Pedido enviado. O mestre precisa aceitar...".
4. No perfil do mestre → o topo mostra **"1 pedido de entrada"**. Vá em Mesa → Contas, em **"Ficha dele"** escolha a
   ficha antiga da pessoa (ou deixe **Nenhuma** para um jogador novo) e clique em **Aceitar** → a pessoa passa a
   aparecer com o nome dela nos Papéis, no topo e nas listas; nenhum "Jogador N" aparece em lugar nenhum.
5. No perfil do jogador, entre com o login e a senha → ele vê a ficha dele e controla o token dele.
6. Erre a senha 5 vezes → aparece "Tente de novo em N minutos". Teste também um login inexistente: a mensagem é a
   mesma.
7. **Esqueci a senha:** o jogador clica em "Esqueci a senha" e informa o login → o mestre vê o "pedido de
   redefinição" → **Aprovar redefinição** → o jogador usa "Definir nova senha" → ele entra, e a sessão antiga dele
   cai.
8. **Remover** a conta de um jogador em Contas → o jogador cai da mesa na hora e some de todas as listas; as fichas e os tokens dele ficam.
9. Em Preferências, troque a sua senha → as suas outras sessões caem e esta continua.
10. Crie uma **mesa nova** na tela inicial (nome, login, senha) → ela nasce vazia, você é o mestre, e o id aparece
    grande para ditar. A conta da Campanha não vale nessa mesa.

## C3 — Pasta do mestre e recuperação
1. Na Campanha, vá em Mesa → Contas → **"Proteger com a pasta da mesa"**, digite a senha atual e escolha a pasta das
   imagens → aparece o arquivo `tavola-mestre.json` na pasta. **Não compartilhe esse arquivo.**
2. **"Gerar novo código"**, com a senha → aparece um código novo uma vez, e o anterior deixa de valer.
3. Saia da mesa, vá em "Sou o mestre e esqueci a senha" → **"Pela pasta da mesa"**. Informe o login, escolha a pasta e
   defina uma senha nova → você entra. A sessão antiga, em outro perfil, cai.
4. Repita pelo **código de recuperação** → você entra, o código usado morre e um novo aparece para anotar.
5. Escolha a pasta de **outra mesa** → aparece "Esta pasta é de outra mesa".
6. Ao **criar uma mesa nova** escolhendo a pasta → o arquivo da chave é gravado e o código aparece.

## Tour
1. Entre numa mesa com uma conta nova (por exemplo, a do jogador do C2) → o tour abre sozinho, a tela escurece e só
   a opção do passo fica iluminada.
2. Teste o teclado: → ou Enter avançam, ← volta e Esc pula. O cartão nunca sai da tela, nem em 1280×720.
3. Entre de novo → o tour **não** abre outra vez.
4. Preferências → **"Fazer o tour de novo"** → ele abre.
5. Faça o tour do mestre (~10 passos) e o do jogador (~6) → cada passo aponta para a opção certa e os textos falam do
   que existe hoje.

## V6 — Conjurar com espaço maior
1. Numa ficha de mago com espaços de 3º, 4º e 5º, clique em **Conjurar** na Bola de Fogo → abre o menu "Conjurar
   Bola de Fogo com espaço de:", só com os níveis que ainda têm espaço (com quantos restam). Use 1 a 9, as setas,
   Enter e Esc.
2. Gaste todos os espaços de 3º e conjure de novo → o menu oferece só 4º e 5º (antes, o app recusava).
3. Escolha o 5º → no chat, o cartão da Bola de Fogo e, **colado embaixo**, "Espaço de 5º · +2d6" com o extra, o
   total e a metade. Um espaço de 5º é gasto.
4. Repita com uma magia de ataque até sair um crítico → o bloco colado mostra o extra dobrado ("Dobrado").
5. Clique no ícone ao lado do Conjurar ("Mandar ao chat") → vai o cartão completo da magia, sem gastar espaço.
6. Faça o mesmo em Ataques e magias (Personagem) e na Conjuração de um NPC → o menu e o ícone funcionam igual.
7. Uma magia sem dado por nível (por exemplo, uma que ganha mais alvos) → o cartão diz só "com espaço de 5º". Na
   engrenagem da magia, o campo **"Por nível acima"** pode ser preenchido à mão.

## V7 — Só quem entrou aparece na mesa
1. Abra a Campanha como mestre → no topo, em Mesa → Papéis e em Permissões aparecem só você e o Uker. Nenhum
   "Jogador 2…7".
2. Abra um handout → o "Quem vê" lista só quem entrou. O mesmo vale para "Quem controla" da ficha e do token, e
   para o "Ver como".
3. Aceite um pedido de entrada com **"Ficha dele: Nenhuma"** → a pessoa aparece com o nome dela em todas as listas.
4. Aceite outro pedido escolhendo a ficha de um antigo "Jogador N" → a pessoa controla aquela ficha e o token dela.
   NPCs (como o Ogro) não aparecem nessa lista.
5. Remova a conta → a pessoa some das listas; a ficha e o token continuam na mesa.
6. Crie uma mesa nova → ela nasce só com você.

## V8 — Ficha de NPC: fitas, sem moldura e duas colunas
1. Abra o Ogro → no alto, as fitas **Bestiário** e **Conjuração**. Sem a moldura com degradê: o conteúdo vai quase
   até a borda da janela.
2. Clique em Conjuração → só a conjuração (atributo, CD, ataque, círculos). O Bestiário não tem mais essa seção.
   Teste as setas ← → e Home/End nas fitas.
3. Alargue a janela → Traços, Ações, Reações e Lendárias vão para a direita. Estreite → volta a uma coluna.
4. Com o Bestiário aberto, arraste uma magia do compêndio para o NPC → a fita Conjuração acende e a magia cai lá.
5. Como jogador, abra um NPC sem magias → a fita Conjuração não aparece.

## V9 — A ficha numa janela própria
1. Abra uma ficha (PJ e depois NPC) → no cabeçalho, antes do minimizar, o ícone de janela ("Abrir em janela própria").
   Minimize a ficha: o ícone some.
2. Clique nele → abre uma janela do navegador só com a ficha, do mesmo tamanho. O título da aba é
   "<nome> — Távola". Não há mapa, painéis, topo nem tour.
3. **Arraste a janela para o segundo monitor**, redimensione, feche e abra de novo → ela volta no mesmo lugar e com
   o mesmo tamanho. (O navegador pode ignorar a posição se o monitor mudou: anote.)
4. Na janela da ficha: mude o PV, role uma perícia, conjure uma magia (o menu de espaço), faça um descanso → tudo
   funciona; a rolagem aparece no chat da mesa e o PV muda para os outros.
5. Na mesa: a ficha sumiu da tela; em Fichas o item mostra "em outra janela". Clique nele → a janela da ficha vem
   para a frente.
6. O topo continua com uma bolinha por pessoa (a janela da ficha não é uma pessoa a mais).
7. Feche a janela, ou clique no ícone "Voltar para a mesa" dela → a ficha volta para a tela da mesa e a marca some.
8. Abra a janela da ficha e **recarregue a mesa** → a lista continua marcando "em outra janela".
9. Bloqueie os pop-ups para o endereço e clique no ícone → o aviso "O navegador bloqueou a janela. Libere as
   janelas pop-up para este endereço." e a ficha fica na mesa.
10. Limite conhecido: arrastar uma magia do compêndio para a ficha que está na janela própria (e arrastar dela para o
    mapa) não funciona. Use o botão "Adicionar" do compêndio (o "Ficha de" inclui a ficha de fora).

## V5 — Paredes e portas
1. Ferramenta Paredes: desenhe e veja os pontos de meia célula, 9 por quadrado (cantos, meios das arestas e
   centro) → o traço encaixa neles, inclusive na diagonal. O Alt solta o encaixe.
2. Desenhe uma linha, aperte **A**, clique → sai um arco tangente à linha. Aperte A de novo → volta a ser linha.
3. No primeiro trecho, aperte A → arco de 3 pontos: início, fim e um ponto por onde ele passa.
4. Esc, duplo clique ou clique direito encerram a sequência.
5. Selecione um arco, mova uma ponta, mude o tipo e apague com Delete → funciona como na reta.
6. Como jogador: **não** vê as linhas de parede e porta. Passe o mouse sobre uma porta → ela se destaca e o cursor
   vira mão. Clique → ela abre.
7. Configurar cena → **"Mostrar paredes e portas aos jogadores"** ligado → o jogador passa a ver os contornos.
8. Mestre: o botão da lua agora se chama **"Visão do mestre"**. Ligado: visão noturna e contornos. Desligado: mapa
   claro sem contornos. Com a ferramenta Paredes ativa, os contornos aparecem sempre.
9. Uma sala redonda feita com arcos bloqueia a visão, a luz e a passagem do token como uma parede reta.

## V4b e V4b2 — Ficha de NPC, arrastar e reordenar
1. Abra o Ogro → aparece o **bloco de monstro**: estandarte, CA, PV com fórmula, atributos, Desafio com XP, Ações
   com Acerto e Dano em colunas.
2. Clique em **+6** numa ação → acerto e dano no chat (crítico verde, 1 natural vermelho). O título expande a
   descrição, com "Mandar ao chat". A engrenagem abre o editor na própria linha.
3. Uma ação com Recarga ou usos por dia → as bolinhas marcam. O botão rola a recarga.
4. Reações e Lendárias só aparecem se existirem. Para o mestre há "+ Reação" e "+ Lendária".
5. **Seção Conjuração:**
   - "+ Conjuração" cria a seção, com o atributo, a CD e o ataque pelo ND.
   - Cada círculo tem bolinhas de espaço e magias em chips. Clique numa magia → ela expande, e Conjurar gasta o
     espaço e rola no chat.
6. **Nome com a capitular:** fora de edição, "V" grande e "ashta Carteiro". Clique no nome → aparece o nome
   inteiro. Enter → a primeira letra volta para a capitular. Esc desfaz. A letra grande não é editável. O mesmo vale
   no NPC.
7. Configurar → "Ficha de: Personagem / NPC" troca a apresentação sem perder nada, nem as magias.
8. **Arrastar do compêndio:**
   - Ao arrastar uma arma, uma magia ou um item, as áreas da ficha aberta que aceitam acendem.
   - Arma no PJ vira ataque calculado. Magia vai para a aba Magias, no círculo dela. Item vai para o Equipamento, e
     uma "Tocha" ganha o Acender.
   - No NPC: arma vira ação e magia vai para a Conjuração.
9. O botão **"Adicionar"** do compêndio faz o mesmo. "Ficha de" segue a ficha aberta. O aviso aparece no toast do
   app.
10. **Reordenar:** segure uma linha ~300 ms → ela levanta, e uma linha indicadora mostra onde vai cair. Esc cancela.
    Alt+↑/↓ move pelo teclado.

## V4a3 — Espaços de magia e detalhes da ficha (Rendan)
1. Na aba Magias do Rendan, em cada círculo: "Espaços totais [n]" editável, "Restantes" e as bolinhas. Sem classe
   também funciona. "+ Círculo" abre um círculo vazio.
2. "Prep." aparece sobre os checkboxes de preparada.
3. Dados de Vida no nível 10 → as bolinhas quebram dentro da caixa. Acima de 12, vira um contador.
4. O modificador extra de perícia e salvaguarda **não** aparece no hover: abre com o botão direito ("Modificador:").

## B1 — Importador do PDF (Rendan)
1. Fichas → importe `fixtures/fichas/brendan.pdf` → **Clérigo 10, Domínio da Sepultura, Acólito, Humano,
   Leal e Bom**; CD 16, ataque +8, espaços 4/3/3/3/2.
2. **Confira à mão** (o PDF não traz direito):
   - o nível, que vem marcado para conferir;
   - os nomes de itens e magias, que vêm em inglês;
   - as 81 magias, que entram todas como preparadas;
   - as moedas, porque o importador leu 50 PE;
   - os PV atuais.

## V10 — Bugs do mapa e teclado do token
1. Cenas → botão direito numa cena → Configurar → "Escolher a imagem…": o seletor abre **por cima**, dá para escolher.
   Esc fecha só o seletor e o Configurar continua.
2. Botão direito no token, no menu dele, no fundo do mapa e no nome: o menu do Chrome **nunca** aparece. Com o menu do
   token aberto, botão direito em outro token abre o menu do outro.
3. Selecione um token e aperte **Delete**: ele sai do mapa e o aviso mostra **Desfazer**. Um jogador faz o mesmo com o
   token dele, mas não com o de outro.
4. Com um token selecionado, as **setas** movem um quadrado por toque. Segurar repete. Parede e porta fechada barram o
   jogador. Com o cursor no chat, as setas não movem nada.
5. A **bandeirinha** é o ponto de chegada da cena: o grupo aparece em volta dela quando você usa "Levar grupo". Só o
   mestre a vê, e só com a faixa de Cenas aberta. Passe o mouse para ver a dica.
6. Clicar no mapa e apertar Delete, Espaço ou seta não pinta o contorno em volta do mapa; com Tab, ele aparece.

## V10b — O jogador põe o próprio token na bandeira
1. Entre como jogador com o token dele no mapa: **não há bandeira** e a lista de Fichas não mostra "Colocar no mapa".
2. Selecione o seu token e aperte **Delete**. A **bandeira** aparece no ponto de chegada; passe o mouse: "Arraste a sua
   ficha para cá ou use "Colocar no mapa"". Você não consegue arrastar a bandeira.
3. Passado o aviso do Desfazer, na aba **Fichas** clique no ícone do **pino** ao lado do seu personagem: o token volta
   ao lado da bandeira. O ícone e a bandeira somem. O mestre vê o token.
4. Tire o token de novo, abra a **ficha** e use o pino do cabeçalho ("Colocar no mapa"). Mesmo resultado.
5. Tire de novo e **arraste a ficha** da lista para o mapa. Durante o arrasto a **área em volta da bandeira se acende**.
   Solte longe: aparece "Ponha o token perto da bandeira (o ponto de chegada)." e nada é criado. Solte dentro da
   área: o token nasce ali, encaixado no grid.
6. O mestre arrasta a ficha de qualquer personagem para qualquer ponto, como antes.
7. Aba **Mesa**, em Permissões: "Pôr o próprio token no mapa (na bandeira)" vem ligada. Desligue: o jogador perde a
   bandeira e o pino. Há também a exceção por jogador.

## V11 — Token: tochas nos cantos e condições com ícones
1. Acenda uma tocha para um personagem com token: ela aparece como uma **bolinha pequena no canto superior direito** do
   token, com a chama e um anel fino em volta. Não há mais círculo ao lado nem tempo escrito.
2. Acenda a segunda: vai para o **canto superior esquerdo**. Passe o mouse numa delas: a dica mostra "Restam 59:52 ..." e
   o nome. Clique direito: o menu da tocha, com a linha "Restam ...".
3. Arraste a marca até outro token ao alcance: a tocha é entregue. Dois cliques apagam e acendem; apagada, a bolinha fica
   esmaecida. Arraste o token: a marca vai junto.
4. Deixe o tempo baixar (ou adiante o relógio): o anel esvazia e, no fim (menos de 10% ou 5 min), fica vermelho.
5. A **luz** da tocha sai do centro do token, não da marca.
6. Marque condições pelo menu do token: cada uma é um **ícone** diferente numa bolinha escura, num arco embaixo do token.
   Com mais de 4, aparece "+N"; passe o mouse nele: a dica lista os nomes. Exaustão mostra o número do nível.
7. Dê zoom para perto e para longe: as bolinhas (tochas e condições) ficam sempre pequenas e legíveis.
8. No menu de condições do token há um ícone ao lado de cada condição, da exaustão e da concentração.
9. Como jogador: você vê as tochas e condições dos tokens que enxerga; token escondido não mostra tocha.

## V10c — Cena como cartão
1. Faixa de Cenas, clique direito numa cena: o menu tem **"Transformar em cartão"**. Clique: aparece uma **marca pequena**
   no canto de cima do cartão da cena; passe o mouse: "Cena como cartão".
2. No mesmo menu o item agora diz **"Voltar a ser mapa"**. O mesmo liga e desliga pela caixa **"Cena como cartão"** do
   "Configurar cena".
3. Ponha uma imagem grande na cena (uma cidade) e transforme em cartão. Entre na cena (ou leve o grupo): a **imagem
   inteira** aparece enquadrada e centrada, com uma folga pequena. Dê zoom e arraste: funciona como sempre.
4. Como jogador, **sem token** na cena: você vê a imagem toda, **sem escuridão** e **sem o aviso** "Seu personagem não
   está nesta cena". Com token, também: a luz e a visão não cortam nada.
5. Paredes e portas da cena continuam guardadas (o mestre as vê com a Visão do mestre ou a ferramenta Paredes), mas o
   jogador não as vê nem esbarra nelas. **Voltar a ser mapa**: a névoa, as paredes e a luz voltam.
6. Os tokens continuam aparecendo e se mexendo; o token oculto continua oculto para o jogador.
7. No menu Luz do mestre, o botão Iluminação diz "(sem efeito: cena como cartão)".

## V12 — Ping no mapa (duas janelas: mestre e jogador, na mesma cena)
1. Na janela do jogador, com a ferramenta **Selecionar**, **segure o botão esquerdo parado** num ponto vazio do mapa por
   meio segundo. Um **círculo se abre** a partir dali (dois anéis e o centro marcado), na **cor do jogador**, e some. Na
   janela do mestre o mesmo círculo aparece no mesmo ponto, na mesma cor.
2. Faça o mesmo **em cima de um token**: o ping sai, o token não se mexe e, ao soltar, nada abre.
3. Com a ferramenta **Mão** (H), segure parado: pinga. **Arraste** o mapa devagar: é só o arrastar, sem ping. **Arraste um
   token** (mesmo devagar): ele anda, sem ping. O arrasto da tocha e o Espaço para arrastar continuam como eram.
4. No mestre, faça o ping: o círculo chega ao jogador na **cor do mestre**.
5. Deixe a tela do jogador olhando outro canto do mapa. No mestre, **segure Shift e segure o clique parado** num ponto: o
   mapa do jogador (e o do mestre) **desliza para o ponto** e ele fica no centro. O zoom não muda e nenhuma janela sai do
   lugar. Faça a mesma coisa do lado do jogador.
6. Com o ponteiro sobre o mapa, aperte **P**: ping no ponto sob o ponteiro. **Shift+P**: ping e centraliza. Os dois estão
   em Preferências, na lista de atalhos.
7. Aperte **P** várias vezes seguidas: só sai um ping a cada meio segundo. Várias centralizações seguidas: só uma a cada
   3 segundos (as outras saem como ping simples).
8. **Permissões** (aba Mesa): "Pingar o mapa e centralizar a tela de todos" vem ligada. Desligue: o jogador segura o clique
   e aperta P e nada acontece; o mestre continua pingando. Ligue de novo.
9. Com o Windows em "reduzir movimento": o ping é um anel fixo que esmaece, e a câmera vai direto ao ponto.
10. Mude o mestre de cena (olhando outra cena): o ping do jogador não aparece para ele. Um ping do mestre em outra cena
    não chega ao jogador. Numa **cena-cartão** o ping funciona igual.
11. Recarregue a página: nenhum ping fica guardado, e o chat não ganha nada.

## V13 — Régua livre, pontos de virada e metros ou pés
1. Aperte **R** (Régua). Abre o painel **Régua** com "Grudar no grid" marcado. Arraste de um ponto a outro: a medida
   encaixa no grid e mostra os quadrados ("4,5 m (3 quadrados)").
2. Desmarque **Grudar no grid** e arraste de novo: as pontas ficam onde você puxou e o rótulo mostra só a distância
   ("5,0 m"). Recarregue a página: a escolha continua.
3. Com o grid ligado, segure **Alt** ao arrastar: mede livre. Com o grid desligado, **Alt** gruda.
4. Arraste com o botão esquerdo e, **sem soltar, clique com o botão direito**: surge um ponto e a medida continua dali. Em
   cada ponto aparece a distância do trecho; na ponta, "trecho · total ...". Faça dois pontos (três trechos) e confira o
   total. Nenhum menu abre (nem o do token, nem o do navegador), mesmo sobre um token.
5. Ainda segurando, aperte **Backspace**: o último ponto sai. **Esc** cancela tudo. Solte com **Shift**: a medida fica
   fixa com os pontos e o total; clique nela para tirar.
6. Em **Preferências**, "Unidade de distância": escolha **Pés**. Meça um quadrado de 1,5 m: **5 pés**. Na aba Mesa, os
   modelos de luz mostram o raio em pés.
7. **Configurar cena** (menu da cena): o campo vira "Quadrado (pés)" com 5 (para 1,5 m). Digite 10 e salve: a cena passa
   a ter 3 m de quadrado (volte para Metros para conferir). Salvar sem mexer no campo não muda o quadrado.
8. Fichas e compêndio continuam como estão escritos. Volte para **Metros**: tudo igual ao que era.

## V14 — Menus: tipos de parede, importar e exportar, atalhos
1. Aperte **Paredes e portas** (barra de ferramentas, só mestre). O painel abre com uma lista:
   Parede, Porta, Janela, Secreta e Invisível, cada uma com ícone e a amostra do traço; passe o mouse (ou use as setas)
   para ver a dica do que o tipo faz. Clique em uma linha, ou use as setas: a linha ativa fica destacada. Desenhe com **Porta**: sai uma porta.
2. **Mesa → Campanha**: dois blocos iguais, Exportar e Importar. Clique **Exportar campanha** (baixa o arquivo). Clique
   **Escolher arquivo…** e escolha o arquivo: aparecem o nome, "N cenas · N fichas · N tokens" e "Isto troca a mesa
   atual. Exporte antes, se quiser guardar." **Cancelar** não muda nada. Só **Importar e substituir** troca a mesa. Teste
   isto numa mesa de teste, não na sua.
3. **Preferências → Atalhos do teclado**: "Os mais usados" abre sozinha; Menus, Janelas e painéis e Campos estão
   recolhidos e abrem ao clicar.
4. Régua (**R**): meça arrastando até colar na borda direita do mapa, e também perto do zoom no canto de baixo. Os
   rótulos (ponta, trechos, fixas) ficam inteiros dentro do mapa e não ficam atrás do zoom.
5. Em **Preferências**, escolha **Pés**. Na aba Mesa, "Alcance de interação" e "Luz plena" e "Penumbra" dos modelos viram
   "(pés)": 1,5 m aparece como 5. Digite 10 em "Alcance de interação": a sala passa a ter 3 m (volte para Metros para
   conferir). Abrir o campo e sair sem mexer não muda nada. No painel do token e no editor da ficha, "Alcance da visão" e
   "Visão no escuro" também seguem a unidade.

## 7b-1 — Automações: o motor (sem editor ainda)
O editor chega no 7b-3. Por enquanto as automações se criam mandando as intenções pelo console do navegador (aba da mesa, como mestre) e
só dá para conferir o efeito. Use uma mesa de teste.
1. Acenda uma tocha no Aldric (mochila → Acender). No console da página do mestre, abra um WebSocket e mande, em ordem:
   `reacao.criar` com `{ id: "r1", fica: { tipo: "modelo", id: "modelo-tocha" }, ao: "inspiracao", fazer: [{ acao: "luz.modificar", raioX: 0.5, porS: 20 }, { acao: "objeto.apagar", chance: 0.3, penalidadeS: 300 }] }`
   e `ciclo.criar` com `{ id: "c1", nome: "Respiração", periodoS: 60, cenas: [], fases: [{ emS: 0, evento: "inspiracao", duracaoS: 20 }, { emS: 30, evento: "expiracao" }] }`.
2. O raio da tocha cai à metade na hora e volta sozinho depois de 20 s; a cada minuto isso se repete e a tocha pode apagar (30%).
   Na tela do jogador o efeito aparece igual, e nada mais.
3. Mande `ciclo.pausar` `{ id: "c1" }`: o ciclo para e a tocha continua queimando. `ciclo.retomar` volta de onde parou.
   Pause a mesa (botão do topo): as duas coisas congelam.
4. Mande `evento.disparar` `{ evento: "inspiracao" }`: a reação roda sem esperar o ciclo.
5. Exporte a campanha e importe de novo: o ciclo e a reação voltam (o ciclo segue de onde estava).
6. Confira, como jogador, que o chat e o mapa só mostram os efeitos (luz, anúncio) e nunca o nome do ciclo ou da reação.

## 7b-2 — Zonas (só o mestre desenha; o jogador só vê o efeito)
Use uma mesa de teste, com o mestre numa janela e um jogador (com a tocha acesa na mão do Aldric) em outra.
1. Como mestre, aperte **Z** (ou o botão "Zonas" da barra, o quadrado tracejado). Clique os cantos de um polígono no mapa (um canto por clique, no encaixe da meia célula; Alt solta
   do grid) e feche com duplo clique ou Enter. Esc, antes de fechar, cancela; Backspace tira o último canto. A zona aparece violeta, com contorno tracejado e o nome no meio.
2. No painel: mude o nome; ponha "Luz × fator" 0,5 e "Visão máxima" 3. Arraste uma bolinha de canto. Desligue "Ligada": a zona esmaece.
3. Ligue de novo. Arraste o token do jogador para dentro (ou use as setas): a luz da tocha dele cai pela metade e o alcance de visão vai a 3 m, na tela dos dois. Tire o token de lá: tudo volta.
4. Com o token dentro, desligue a zona: o efeito sai na hora. Ligue: volta. Apague a zona (Delete com a zona selecionada): o efeito sai; o aviso tem **Desfazer** e a zona volta igual.
5. Na tela do jogador: nenhum polígono, nome ou painel. Só a luz menor e a visão curta. Recarregue a página do jogador: nada de zona.
6. Duplique a cena (faixa de Cenas): a cópia tem a zona. Exporte e importe a campanha: a zona volta com os efeitos.
7. Abra a lista de atalhos (Preferências): **Z** está em "Ferramentas".

## 7b-3 — O editor das automações, os botões na barra e as campanhas prontas
Use uma mesa de teste, com o mestre numa janela e um jogador em outra. Importar uma campanha **troca a mesa**: não faça isto na sua.

**Roteiro manual do Lote 7b (a Chama Primordial)**
1. Aba **Mesa → Campanha → Campanhas de exemplo → A Chama Primordial** → **Importar e substituir**. A mesa vem pausada. Na barra de cima aparece o chip **Respiração do Pulmão** ("no começo") e, na aba Mesa, a seção **Automações** diz "1 ciclo · 4 reações · 1 botão de evento".
2. Abra **Automações → Abrir as automações**. Clique em **Editar** no ciclo "Respiração do Pulmão" e troque o **período** para 30 e a segunda fase (expiração) para 15 s: **Salvar**. (O JSON, em "Ver como JSON", mostra o mesmo.)
3. Leve o grupo para a cena **Pulmão da Montanha** (faixa de Cenas) e ponha uma ou mais tochas acesas (aba Mesa → modelo Tocha, ou a mochila de um personagem com um token no Pulmão). Retome a mesa (botão do topo).
4. A inspiração cai logo: o raio de cada tocha **cai pela metade** por 20 s e, com 30% de chance cada, ela **apaga** (perdendo 5 minutos do que sobra). Quinze segundos depois, a expiração **fecha a visão** dos tokens do Pulmão em 1,5 m por 30 s. O ciclo repete a cada 30 s.
5. No chip da barra: o nome da fase e o tempo até a próxima andam sozinhos. **Pausar** (ícone de pausa) congela o ciclo e as tochas seguem queimando; **retomar** continua de onde parou; **disparar** (ícone de avançar) pula para a fase seguinte.
6. Reacenda uma tocha apagada: o mestre (e só ele) lê no chat "Uma tocha foi reacesa. Gricks caçam no escuro...". O jogador não vê isso.

**O editor**
7. **Novo ciclo**: nome "Teste", período 10, fase 0 com o evento "rajada": **Salvar**. Em **Nova reação**: "pertence a" **Um modelo de objeto → Tocha**, evento **Um evento seu… → rajada**, ação **Mudar o raio da luz** com fator 0,5 (vírgula ou ponto) por 20 s: **Salvar**. O raio da tocha cai à metade na hora.
8. Abra o formulário de uma peça e em **Ver como JSON** troque o período por -5: o erro aparece em português, embaixo ("Período (segundos): precisa ser maior que 0."), e **Salvar** mostra os erros e não envia nada. Escreva um JSON quebrado: "O JSON tem um erro de escrita..." Corrija: **Salvar** funciona.
9. **Apagar** num ciclo, reação ou botão pede confirmação na própria janela ("Apagar “nome”?").
10. No fim da janela, **Avisos do motor** fica discreto; abra se houver algo (encadeamento cortado, fases puladas).

**Os botões**
11. **Novo botão** ("Soprar o vento", evento "rajada"), **Fixar na barra** e **Liberar aos jogadores**. O chip aparece na barra do mestre e, **só com o nome**, na do jogador. O jogador clica: a reação roda. Dois cliques seguidos do jogador: o segundo é recusado ("Devagar: um botão a cada 2 segundos").
12. Desmarque **Liberar aos jogadores**: o chip some da tela do jogador na hora e a sala passa a recusar.
13. Nos ciclos, **Liberar aos jogadores** dá ao jogador o chip com disparar e pausar ou retomar. A tela dele nunca mostra fases, cenas, reações ou o nome dos eventos.

**A 5e padrão**
14. Aba Mesa → Campanha → **5e padrão** → **Importar e substituir**: uma mesa limpa, sem ciclos, reações nem botões ("Nenhuma automação nesta mesa."), com a Tocha 5e, a Lanterna e a Fogueira. Deixe a mesa correr: nada acontece sozinho.

**Os acertos do 7b-2**
15. Ferramenta **Zonas** (Z) e ferramenta **Paredes**: o painel abre encostado à **direita** da área do mapa, abaixo do topo, sem cobrir o meio. Arraste-o e feche: na próxima vez abre onde você o deixou.
16. Em **Preferências**, escolha **Pés**: "Luz ±" e "Visão máxima" do painel da zona mostram pés (3 m = 10 pés). O fator mostra **0,5** (vírgula) e aceita **0,5** ou **0.5**.

## 12-1 — O acesso do Claude (sala e web)
O servidor MCP ainda não existe (é o 12-2): aqui o teste é a tela e, para a conexão, um cliente de WebSocket simples (veja o passo 5). Use uma mesa de teste, com o mestre numa janela e um jogador em outra.

**O token**
1. Em **Preferências**, a seção **Conectar o Claude**. Escreva "Claude no meu PC" e clique em **Gerar token**. O token (`tvc_...`) aparece numa caixa, **uma vez**, com **Copiar o token** e os trechos do **Claude Code** e do **Claude Desktop**. Clique em **Já guardei**: o token some e não volta (nem recarregando a página).
2. A lista mostra o nome, quando foi criado e "nunca usado". Gere até 5; o sexto botão fica desligado ("revogue um para gerar outro").
3. **Revogar** pede confirmação na própria página. Confirme: o token some da lista.
4. Troque de conta (ou use o jogador): cada pessoa só vê os próprios tokens.

**A conexão**
5. Com um cliente de WebSocket que aceite cabeçalho (o `ws` do Node, o `wscat`), abra `ws://127.0.0.1:8787/api/m/<id da mesa>/ws` com `Authorization: Bearer <o token>`. O cliente recebe o `snapshot`. Sem o cabeçalho (ou com o token revogado): 401, sem dizer qual dos dois.
6. Com o Claude conectado, a bolinha da pessoa, no topo, ganha uma marca pequena (um robozinho). Revogue o token em Preferências: a conexão cai na hora e a marca some.
7. Mande pelo cliente `{"v":1,"id":"a","tipo":"dado.rolar","dados":{"expressao":"1d20"}}`: no chat de todos a rolagem aparece com o selo **pelo Claude**. Mande `{"v":1,"id":"b","tipo":"papel.alterar","dados":{"usuarioId":"<jogador>","papel":"mestre"}}` (mesmo com o token do mestre): a resposta é um erro "O Claude não pode mudar papéis: só a pessoa, pela mesa."

**Rascunhos (token do mestre)**
8. Pelo cliente, crie um NPC: `{"v":1,"id":"c","tipo":"personagem.criar","loteId":"L1","lote":"criou 1 NPC","dados":{"personagem":{"id":"npc-1","pastaId":"pasta-npcs","editores":{"tipo":"jogadores","ids":[]},"nome":"Goblin","tokenPadrao":{"cor":"#c0392b","tamanhoQuadrados":1},"visao":{"alcanceM":null,"visaoNoEscuroM":0}}}}`. Na tela do mestre: o NPC aparece nas Fichas com o selo **Rascunho** e, no topo, o chip **Rascunhos do Claude (1)**.
9. Crie também um handout para todos (`handout.criar`, `"visivel":{"tipo":"todos"}`) e um ciclo com `liberadoParaJogadores`: o jogador **não vê nada** (nem o handout, nem o botão do ciclo). O ciclo não roda.
10. No chip: **Publicar** o handout: o jogador passa a vê-lo. **Descartar** outro item pede "Apagar mesmo". **Publicar tudo** esvazia o chip.

**Desfazer**
11. Em **Preferências → O que o Claude fez**: "Claude: criou 1 NPC · 1 item · agora" com **Desfazer**. Clique: o NPC some das Fichas e aparece o aviso "Desfeito: 1 item voltou."
12. Faça o Claude criar dois NPCs no mesmo `loteId`, renomeie um deles pela mesa e clique em **Desfazer**: um sai, o que você renomeou fica e o aviso diz qual ("Desfeito, menos um item que mudou depois: ficha "...").
13. **Desfazer tudo o que o Claude fez** pede confirmação e desfaz do mais novo ao mais velho.

**O jogador cria as próprias fichas e handouts**
14. Como jogador, na aba **Fichas**: **Nova ficha** e **Novo handout**. A ficha abre em Configurar (o nome se edita); ela é sua, numa pasta "Fichas de <você>" que só você e o mestre veem. O handout abre editável: escolha quem vê (o outro jogador o recebe na hora); não há "Mostrar agora".
15. Crie 20 fichas: a 21ª responde "Você já criou 20 fichas: apague uma para criar outra." (o menu de botão direito da ficha tem **Apagar…**).
16. Em **Mesa → Permissões**, a linha **Criar fichas e notas próprias** vem ligada. Desligue (ou desligue só para um jogador, na exceção): os botões somem para ele; o que ele já criou continua dele.
17. O Claude do jogador (token dele) tenta editar a ficha de outro jogador, mexer num ciclo ou numa cena: sempre recusado, como o próprio jogador seria.

## 12-2 — O servidor MCP (o Claude montando a mesa) e o roteiro manual do Lote 12
Agora o Claude de verdade entra na mesa. Detalhes em `docs/MCP.md`. Use uma mesa de teste (ou a campanha de referência `chama-primordial`, em outra mesa, para não sujar a sua), o mestre numa janela e um jogador em outra.

**Ligar**
1. Na pasta do Távola: `pnpm --filter @tabletop/mcp build`. Sai o arquivo `apps/mcp/dist/tavola-mcp.mjs`.
2. Em **Preferências → Conectar o Claude**, **Gerar token**. O texto agora é o comando final: `claude mcp add tavola --env TAVOLA_URL=http://127.0.0.1:5173 --env TAVOLA_MESA=<id> --env TAVOLA_TOKEN=tvc_... -- node apps/mcp/dist/tavola-mcp.mjs`, com o token já colado. Rode-o na pasta do Távola (se já houver um `tavola`, `claude mcp remove tavola` antes) e abra o Claude Code: `/mcp` mostra `tavola` conectado. A bolinha do mestre ganha o robozinho.
3. O trecho do **Claude Desktop** traz as mesmas variáveis e `<pasta do Távola>/apps/mcp/dist/tavola-mcp.mjs` para completar com o caminho inteiro.

**O mestre monta uma cena da campanha de referência**
4. Peça: "Leia a bíblia da campanha (o arquivo da campanha de referência) e monte a primeira cena: nome, paredes e portas, os NPCs com ficha, as tochas e um ciclo de vento." O Claude começa pelo `panorama`.
5. No chat do Claude Code, confira que ele usou **nomes** (não ids), mandou os NPCs numa chamada só e que as respostas dizem "(rascunho...)".
6. Na mesa do mestre: o chip **Rascunhos do Claude (N)** no topo. Abra a lista: cena, NPCs, ciclo, notas. Cada item tem o selo "Rascunho".
7. Na janela do jogador: **nada** apareceu (nem a cena, nem as fichas, nem o ciclo, nem a nota).
8. Revise: abra a cena (as paredes, a porta trancada e o arco "de a até b passando por c" estão certos; os NPCs ocultos estão no mapa), a ficha de um NPC (PV, CA, ataque) e o ciclo. Peça ao Claude para corrigir ("a porta leste não é trancada"): ele edita o rascunho e o rascunho **continua rascunho**.
9. **Publique** o que está bom (pelo chip, ou "publique só a cena"). O jogador passa a ver a nota; descarte um item (pede confirmação).
10. Peça "desfaça tudo o que você fez nesta conversa". Em **Preferências → O que o Claude fez**, os lotes aparecem como "fichas: ...", "cenas: ..." etc.; o que sumiu confere. Edite um NPC pela mesa antes de desfazer: o aviso diz que ele ficou ("mudou depois").

**O jogador cria o personagem**
11. No Claude Code do jogador (token dele), peça: "Monte o meu personagem: anão clérigo nível 3, rolando 4d6 (descartando o menor) para os atributos; magias de clérigo de nível 1 do compêndio."
12. O Claude rola 6 vezes (`rolar`): no chat de todos aparecem 6 rolagens com **pelo Claude**. A ficha nova aparece na aba **Fichas** do jogador (pasta "Fichas de ..."), com PV, CA, perícias e magias calculados; abra a janela da ficha e confira. O mestre a vê; os outros jogadores não.
13. Peça "adicione à ficha a Espada Longa e duas poções de cura" e "escreva uma nota só minha sobre a viagem": ficha e nota mudam; a nota é só dele e do mestre.
14. Peça "edite a ficha do <outro jogador>": o Claude responde que não pode (ou nem vê a ficha). Peça "crie um ciclo de vento": ele diz que não tem essa ferramenta.
15. O mestre desliga **Criar fichas e notas próprias** em Mesa → Permissões: o Claude do jogador perde `fichas` e `notas` na hora (o Claude Code mostra a lista nova ou ela aparece na próxima conversa).

**Se der errado**
16. **Revogue** o token em Preferências: o Claude responde "Token inválido ou revogado: gere outro em Preferências → Conectar o Claude." e a bolinha perde o robozinho. Pare o `pnpm dev` e suba de novo: o MCP reconecta sozinho.

## 12-3 — O Claude conecta colando um comando só (MCP por HTTP)
O comando de **Preferências → Conectar o Claude** agora é uma linha só e funciona em qualquer pasta, sem `build`. Faça este roteiro com o `pnpm dev` rodando (a sala nova já está nele).

1. Abra o **PowerShell** (recém-aberto, na pasta que quiser; pode ser a das suas anotações de RPG).
2. Na mesa: **Preferências → Conectar o Claude → Gerar token**. O cartão mostra, sem recolher nada, o passo a passo de três linhas e **uma linha só** que começa com `claude mcp add --transport http --scope user tavola-<id>`, com o endereço (`http://127.0.0.1:5173/api/m/<id>/mcp`) e o seu token já dentro.
3. Clique em **Copiar o comando**, **cole no PowerShell e aperte Enter**. Deve responder que adicionou o servidor `tavola-<id>` (escopo de usuário).
4. Abra o Claude Code (`claude`) nessa mesma pasta e digite `/mcp`: `tavola-<id>` aparece conectado.
5. Peça: **"mostre o panorama da mesa"**. O Claude responde com as cenas, fichas, notas e (para o mestre) automações e rascunhos.
6. Volte à mesa: a bolinha do seu nome ganha o robozinho ("Claude conectado") e, em Preferências, o cartão diz **"1 token · conectado agora"** e o token na lista, "conectado agora". Uns 2 minutos depois da última chamada, vira **"usado há X min"** e o robozinho some.
7. Peça uma coisa de verdade ("crie um NPC Goblin com PV 7 e CA 15", se você é o mestre): a resposta diz "(rascunho...)", o chip **Rascunhos do Claude** aparece e o jogador não vê nada até você publicar. Em **Preferências → O que o Claude fez**, o lote aparece com **Desfazer**.
8. **Se você já tinha conectado esta mesa** (ou o Claude Code disser que o servidor já existe): em "Já tinha conectado esta mesa?" copie `claude mcp remove --scope user tavola-<id>`, rode, e cole o comando de novo.
9. Outro computador (ou outro terminal: cmd, terminal do Mac): o mesmo comando funciona, sem o Távola baixado. Para um jogador, o endereço tem de ser o da mesa que ele alcança (`https://...` na internet).
10. **Revogue** o token em Preferências: na próxima chamada o Claude Code não consegue mais usar o `tavola-<id>` (o `/mcp` mostra falha de autenticação, 401). Gere outro token e cole o comando novo (passo 8 antes).
11. **Claude Desktop** (recolhido no cartão): o texto diz que ele precisa do Távola baixado e do Node (servidor local); confira que o trecho do arquivo continua como no 12-2.

## P1 — A aba Preferências em sanfona

1. Abra a aba **Preferências**. Só a **Conta** está aberta ("Você é ..." com Sair/Trocar usuário e Trocar de mesa); os outros seis cartões mostram o resumo (sem login, Segurança não existe).
2. A ordem é: Conta, Aparência, No mapa, Ajuda e arquivos, Conectar o Claude, Segurança, Atalhos do teclado.
3. Abra **Aparência**: o resumo some, aparecem as bolinhas e a marca "só neste navegador". Troque o tema, feche o cartão: o resumo é o nome do tema novo.
4. Abra **No mapa**: troque Metros/Pés e desmarque o encaixe e as dicas. Feche: o resumo acompanha ("Pés · encaixe desligado · dicas desligadas").
5. Abra **Ajuda e arquivos**: o tour, a pasta local (com a marca) e as transferências. Escolha uma pasta: o resumo vira "Pasta <nome>". Arraste uma imagem de outro computador e, durante a transferência, o resumo fica em destaque ("· 1 transferência").
6. **Conectar o Claude**: gere um token; o resumo conta "1 token". Com o Claude conectado vira "1 token · conectado"; com um lote do Claude, "· 1 lote para desfazer".
7. Teclado: Tab até um título, Enter e Espaço abrem e fecham. Abra três cartões: nenhum fecha o outro.
8. Recarregue a página: os cartões ficam como você deixou.
9. Confira nos temas Pergaminho e Vampiro que os cartões ficam legíveis. Painel estreito (arraste a alça): os resumos cortam com reticências e a dica mostra o texto inteiro.

## N1 — Vida e CA no token, "morto" com X e a camada pelo clique direito

1. Entre como jogador e clique no seu token: logo acima dele aparecem a **vida** (coração) e a **CA** (escudo), mais um botão de caveira. Arraste o token, dê zoom e arraste o mapa: as marcas acompanham. Clique no fundo: somem.
2. Clique no token de outro jogador e no Ogro: nada é selecionado e nenhuma marca aparece.
3. Clique na vida (ou aperte **E**): abre um campo com o número. Digite **-5** e Enter: a vida cai 5; abra a sua ficha e confira. Digite **+3**: sobe 3 (nunca passa do máximo). Digite **7**: vira 7. **Esc** cancela. Com PV temporário, o dano ("-N") gasta o temporário primeiro.
4. Clique na CA: abre a ficha do personagem.
5. Entre como mestre e selecione qualquer token com ficha (inclusive o Ogro): as marcas aparecem. Token sem ficha (o Goblin da emboscada): sem marcas.
6. Clique na caveira: o token ganha um **X vermelho** grande e fica esmaecido; o jogador vê o X também. Clique de novo: some. Ponha a vida em 0 sem marcar morto: o botão da caveira ganha um aro vermelho.
7. Botão direito num token: **Marcar como morto** / **Tirar a marca de morto** (o mestre e o dono do token).
8. Botão direito num token como mestre: grupo **Camada** (Mapa, Tokens, Mestre) com a atual marcada. Escolha Mestre: o token some para o jogador na hora. Como jogador, o menu do seu token não tem o grupo Camada.
9. Confira nos temas Grimório e Pergaminho que as marcas leem bem sobre o mapa; `E` aparece em Preferências → Atalhos do teclado.

## N2 — A conjuração completa (inata, truques, ritual, dardos por nível)

1. **Magia inata.** Abra a ficha de um NPC (o Ogro serve) → fita Conjuração. Como mestre, clique em "+ Conjuração inata". Escolha o atributo (Carisma) e escreva a CD (13). Nos campos de baixo escreva uma magia em cada: "+ À vontade" (Luz), "+ 1/dia cada" (Voo) e "+ N/dia (grupo)" (Invisibilidade). Cada uma aparece na linha dela: "À vontade:", "1/dia cada:" (com uma bolinha ao lado da magia) e "1/dia:" (bolinhas no começo da linha).
2. Abra Voo (clique no nome) e confira "Frequência" e "Usos por dia". Troque para 3: a linha vira "3/dia cada" com três bolinhas. Troque a frequência da Invisibilidade e o "por dia" do grupo para 2.
3. **Conjurar a inata.** Abra Voo e clique em Conjurar: uma bolinha esvazia (a última), o espaço de magia **não** gasta e o chat mostra o cartão com "conjuração inata". Com a bolinha acabada, o Conjurar avisa que não tem mais usos. Luz (à vontade) nunca gasta. Invisibilidade gasta do contador do grupo.
4. Uma magia com salvaguarda (Relâmpago, `8d6`, CD): o cartão mostra a CD da **inata** (13), não a da classe.
5. **Recuperar.** "Recuperar usos" (aparece quando algo foi gasto) enche tudo de novo. Num personagem, o descanso longo faz o mesmo.
6. **Arrastar.** Arraste uma magia do compêndio para a parte inata: ela entra como "1/dia cada"; a engrenagem ou a frequência troca.
7. **Truque por nível.** Num NPC de ND 5 ou personagem de nível 5 com Raio de Fogo (`1d10`; "dados por nível" 5 → `1d10`): conjure. O cartão rola **2d10** e diz "(nível 5)". No nível 4 rola 1d10. Magia do compêndio (a que traz "aumenta em 1d10...") vem já com isso ao arrastar.
8. **Ritual.** Numa magia do compêndio com a marca Ritual (Detectar Magia), clique em Conjurar: o menu ganha "Ritual · sem espaço (+10 min)" (tecla R). Escolha-o: nenhum espaço gasta e o cartão diz "como ritual". Magia sem a marca não tem o item.
9. **Mais dardos.** Mísseis Mágicos (3 dardos, `1d4+1`, "Por nível acima" `1 dardo`): conjure com espaço de 2º: o cartão diz "com espaço de 2º · 4 dardos" e embaixo um bloco "4 dardos · 1d4 + 1 cada" com cada dardo rolado e o total. Raio Ardente (`1 raio`) e Imobilizar Pessoa (`1 criatura`, só o número) funcionam igual.
10. Veja o MCP: peça ao Claude para pôr "Diabrete" com `conjuracaoInata` e magias inatas; a leitura da ficha lista "Conjuração inata (CD 13): ...".

## N3a — Compêndio com monstros e itens mágicos

1. **Exemplo.** Mesa sem compêndio, como mestre: Compêndio → "Usar o exemplo do SRD (3 magias, 3 monstros, 4 itens mágicos)". Aparecem as seções Magias, Armas, Itens, **Monstros** (3) e **Itens mágicos** (4).
2. **Monstros.** Em Monstros, digite "goblin": só o Goblin. Limpe e use "ND até" 1/4: Goblin e Lobo. "ND de" 1: só o Mago. Filtre por tipo (Fera) e tamanho. Clique no Mago: o cartão mostra CA, PV, atributos com o modificador, testes, perícias, ND com XP, traços, ações e a Conjuração.
3. **Criar NPC.** No cartão do Mago ou na linha da lista, "Criar NPC": a ficha entra na pasta NPCs e abre no bloco de monstro, com atributos, ações (Adaga) e, na fita Conjuração, as magias nos círculos (Bola de Fogo, Detectar Magia e Mísseis Mágicos com o texto do compêndio) e os espaços 4, 3, 3, 3, 1.
4. **Arrastar.** Arraste o Goblin da lista para o mapa: nasce o NPC (na pasta NPCs) e o token, encaixado na grade. Um Lobo (ou qualquer monstro Grande) nasce com token de 2 quadrados. Como jogador não há seção de monstros nem arrasto.
5. **Itens mágicos.** Em Itens mágicos veja a raridade em cada linha; filtre por "Raro". Clique no Anel de Proteção: aparece a descrição. Abra a ficha de um personagem e use "Adicionar": o item entra no equipamento e a nota traz "Raro, exige sintonização" e a descrição. Adicione a Espada Longa +1: entra no equipamento e também nos Ataques, com o bônus +1 no acerto e no dano.
6. **Vários arquivos.** Com a pasta local escolhida, crie `compendio/monstros.json` (formato do compêndio, só com `"monstros": [...]`) e use "Carregar arquivos do compêndio…" (no topo da aba) escolhendo ele e um `itens.json`: o aviso diz o que foi gravado em `compendio/` e as seções aparecem. Carregue um arquivo com um monstro de ND "31": nada é gravado e o aviso diz o arquivo e o campo. Carregue um segundo `monstros.json` com o mesmo Goblin: o aviso diz que ficou o novo.
7. **Recarregar.** Edite o `monstros.json` na pasta, volte à mesa e clique em Recarregar: o jogador recebe o compêndio novo. Os créditos de cada arquivo aparecem em "Créditos".
8. **MCP.** Peça ao Claude: "crie 4 goblins do compêndio". Saem Goblin 1 a Goblin 4 em NPCs (rascunho), completos. Peça "monstros de ND até 1 do tipo Fera" e "itens mágicos raros".

## N3b — O extrator do compêndio (os livros do Vilella)

1. **Gerar.** Na raiz do repositório: `pnpm compendio:extrair -- --livros "<pasta dos PDFs>" --saida "<pasta fora do repositório>"`. Em uns 10 segundos saem `magias.json`, `monstros.json`, `itens.json` e `relatorio.md`. Aponte `--saida` para uma pasta dentro do repositório: o comando recusa.
2. **Relatório.** Abra o `relatorio.md`: por livro, quantas entradas leu e quantas passaram, as que falharam (nenhuma, na rodada do lote), os campos mais vazios e a amostra de nomes. Confira os números com o que você espera dos livros (361 magias, 428 monstros, 274 itens mágicos).
3. **Carregar.** Na mesa, como mestre: Compêndio → "Carregar arquivos do compêndio…" e escolha os três arquivos. O aviso diz que gravou `compendio/magias.json`, `monstros.json` e `itens.json`. O jogador recebe o compêndio, sem a seção Monstros.
4. **Magias.** Busque "Bola de Fogo": nível 3, Evocação, 1 ação, 45 metros, componentes com o material, duração Instantânea, classes Feiticeiro e Mago, "Em níveis superiores". Filtre por classe (Mago) e por escola. Uma magia de concentração (Banimento) e um ritual (Alarme) mostram as marcas.
5. **Monstros.** Busque "Goblin": CA 15, 7 PV (2d6), atributos, Escapada Ágil e as ações Cimitarra e Arco Curto. "Criar NPC" põe a ficha completa na pasta NPCs (ND 1/4, DES 14, Cimitarra com o acerto +4 e o dano 1d6+2). Filtre por ND de 5 a 8: a lista vem em ordem. Um dragão (Dragão Vermelho Ancião) traz o sopro com recarga e as ações lendárias; um monstro com conjuração (Deva, Cambion) traz as magias na fita Conjuração.
6. **Itens mágicos.** Busque "Vorpal": Espada Vorpal, lendária, exige sintonização, com o bônus +3. Filtre por raridade. Poção de Cura e Pedra Iônica aparecem como "Varia".
7. **Conferir com o livro.** Escolha cinco entradas de cada tipo e compare com o PDF: nome, números e o começo e o fim da descrição. Anote o que estiver trocado ou cortado em `docs/BUGS.md`.

## N4 — Névoa pintada à mão

1. **Abrir.** Como mestre, na barra à esquerda, clique em **Névoa** (ou tecle N com o foco no mapa). O painel abre à direita com Cobrir/Revelar, as formas e o raio do pincel.
2. **Cobrir tudo.** "Cobrir tudo" pede confirmação na própria página. Confirme: o mapa fica coberto por um véu hachurado para você. Numa outra janela, como jogador, o mapa inteiro fica preto e os tokens que não são dele somem (o dele continua aparecendo). Cancele uma vez para ver que nada muda.
3. **Revelar.** Mude para Revelar, forma Retângulo, e arraste sobre uma sala: o jogador passa a ver só aquele retângulo (e os tokens que estão dentro). Em menos de um segundo, sem recarregar.
4. **Pincel.** Revelar com o Pincel (raio 2 m): arraste um corredor. O círculo mostra o tamanho. Troque para Cobrir e pinte de volta parte dele.
5. **Polígono.** Revelar com o Polígono: clique nos cantos de uma sala torta; duplo clique (ou Enter) fecha, Esc cancela, Backspace tira o último ponto.
6. **Desfazer.** Ctrl+Z (com o foco no mapa) e o botão Desfazer voltam um traço de cada vez. Com um polígono em andamento, Ctrl+Z tira o último ponto.
7. **Luz e visão.** Numa cena com luz, ponha uma tocha numa área coberta: para o jogador continua escuro. Revele a área: volta a valer a luz e a visão de sempre.
8. **Cena-cartão.** Transforme a cena de uma cidade em cartão, cubra tudo e revele a praça: o jogador só vê a praça. Revelar tudo devolve a cidade.
9. **Ver como.** Em "Ver como" um jogador: a névoa fica opaca e os tokens somem como na tela dele; a ferramenta Névoa some da barra. Volte para "Eu mesmo".
10. **Duplicar e exportar.** Duplique a cena: a cópia tem a mesma névoa. Exporte a mesa e importe de novo: a névoa volta. Uma cena antiga, sem névoa, abre normal.
11. **Pesado.** Pinte uns 100 traços de pincel seguidos: o mapa continua fluido. Passando de 300 traços, a sala avisa para usar Cobrir tudo ou Revelar tudo.

## N5 — Som ambiente

Antes: ponha dois ou três arquivos mp3, ogg ou wav na pasta de imagens da mesa (de preferência na subpasta `sons/`) ou tenha-os à mão. Abra a mesa em duas janelas: uma como mestre, outra como jogador. Na janela do jogador clique uma vez em qualquer lugar da página.

1. **Abrir o painel.** Como mestre, clique em **Som** (alto-falante) na barra à esquerda. O painel tem Trilha, Efeitos e "Ouvir as zonas do token selecionado". O jogador não vê o botão.
2. **Trilha.** Em Trilha, escolha um som da lista (ou "Escolher arquivo…"). Os dois ouvem a trilha em laço. Mexa no volume: muda para os dois. Escolha outro som: o primeiro some em cerca de 2 s enquanto o novo entra. **Parar** cala os dois.
3. **Alinhamento.** Com a trilha tocando, entre numa terceira janela como outro jogador: ele ouve do ponto em que a trilha está (não do começo).
4. **Efeitos.** Em Efeitos, clique num som: toca uma vez, nos dois. Clique de novo: toca outra vez. O volume dos efeitos é o do controle da seção.
5. **Trilha da cena.** Com uma trilha tocando, em "Trilha desta cena" clique **Usar a que toca**, e depois Parar. Leve o grupo para outra cena e volte (Levar o grupo): a trilha da cena começa sozinha. **Tirar** desfaz.
6. **Som na zona.** Ferramenta Zonas, selecione uma zona e, em "Som enquanto dentro", escolha um som (volume e "Repetir em laço"). Como jogador, mova o token para dentro da zona: o som entra com um fade; saia: ele some. O outro jogador, fora da zona, não ouve. O mestre ouve se ligar "Ouvir as zonas do token selecionado" e selecionar o token dentro da zona.
7. **Sigilo.** Como jogador, confira que nada na tela diz que a zona existe (nome, forma, regras): só o som.
8. **Automação.** Editor das automações, Nova reação, ação "Tocar um som": escolha o som, o volume e quem ouve (todos, quem está na cena ou quem controla o token do evento). Dispare o evento (botão ou ciclo): o som toca uma vez. Exemplo: a fase "inspiração" do Pulmão toca um sopro; entrar na zona do Ar Morto toca sussurros.
9. **Preferências do jogador.** Aba Preferências → **Som**: o resumo mostra "Volume 80% · trilha ligada". Baixe o volume geral, o da trilha e o dos efeitos: só o som desta pessoa muda. **Silenciar tudo** cala tudo (o resumo vira "Tudo silenciado"); desmarcar volta.
10. **Aviso de som.** Se o navegador bloquear o som (recarregue a página do jogador e não clique em nada antes da trilha tocar), aparece "Clique para ativar o som da mesa". Clique: o som começa. "Agora não" some com o aviso e não volta (o botão "Ativar o som da mesa" fica nas Preferências).
11. **Exportar e importar.** Exporte a mesa e importe de novo: a trilha da cena, o som das zonas e as ações de som voltam (os arquivos continuam na sua pasta). Uma mesa antiga, sem som, abre normal.
12. **Limites.** Tente um arquivo que não é mp3, ogg nem wav, ou maior que 20 MB: a lista recusa com uma mensagem clara.

## M1 — O Claude sobe arquivos

Antes: o Claude conectado (Preferências → Conectar o Claude) num computador com shell (Claude Code), a mesa aberta como mestre e outra janela como jogador. Tenha uma imagem de mapa, outra de token e um som mp3, ogg ou wav em alguma pasta do computador.

1. **Mapa.** Peça: "Ponha o arquivo <caminho> como mapa da cena <nome> e ajuste para 45 x 45 quadrados". O Claude chama `arquivos`, roda o comando curl e o mapa aparece na cena do mestre e do jogador; a cena fica com o tamanho da imagem. Se a imagem é grande (3000 px ou mais), ela é cortada em tiles como pelo botão.
2. **Aviso.** Enquanto a mesa processa, aparece "O Claude enviou 1 arquivo" no alto do mapa e depois "Pronto".
3. **Desfazer.** Em Preferências → O que o Claude fez, desfaça o último lote: o mapa sai da cena. O arquivo continua na sua pasta de imagens.
4. **Token e retrato.** Peça: "Use o arquivo <caminho> como imagem do token do <nome>" e "como retrato da ficha do <nome>". A imagem entra (reduzida a 512 px).
5. **Mesa fechada.** Feche a janela do mestre e peça outro arquivo ao Claude. O Claude diz que o arquivo espera na caixa. Abra a mesa como mestre: aparece "O Claude enviou 1 arquivo" e a mesa aplica sozinha.
6. **Som e compêndio.** Peça um som como trilha da cena e um arquivo de compêndio (json). O som toca nos jogadores; o compêndio da mesa muda.
7. **Jogador.** Como jogador, peça ao Claude dele um mapa: ele recusa ("Só o mestre põe o mapa da cena"). Peça o retrato da sua própria ficha: passa. A ficha de outro jogador ele nem enxerga.
8. **Sem shell.** Num cliente sem shell, peça uma imagem pequena (até 2 MB): o Claude manda em base64 e a imagem entra.
9. **Link.** Rode o mesmo comando curl duas vezes: a segunda é recusada ("já foi usado"). Troque o arquivo por um texto qualquer com nome .png: recusado ("Não reconheci o formato").
10. **Revogar.** Peça um envio e revogue o token em Preferências antes de rodar o comando: o curl responde que o token foi revogado.
11. **Usar o que já existe.** Peça "Liste os arquivos da mesa" e depois "Use o mapa X na cena Y": entra sem reenviar.

## Se algo der errado
- Anote a tela, o que fez e o que esperava, e mande para mim. Bug confirmado vai para `docs/BUGS.md`.
- Para voltar à campanha de antes de mesas e contas, use a cópia de segurança indicada no topo.
