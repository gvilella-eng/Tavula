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
   Solte longe ou dentro da área: desde o Q8 o token vai sempre para a bandeira, arrumado no grid.
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
3. **Desfazer.** Peça ao Claude: "desfaça o último envio". O mapa sai da cena (Preferências não tem mais a lista de desfazer, desde o Q1). O arquivo continua na sua pasta de imagens.
4. **Token e retrato.** Peça: "Use o arquivo <caminho> como imagem do token do <nome>" e "como retrato da ficha do <nome>". A imagem entra (reduzida a 512 px).
5. **Mesa fechada.** Feche a janela do mestre e peça outro arquivo ao Claude. O Claude diz que o arquivo espera na caixa. Abra a mesa como mestre: aparece "O Claude enviou 1 arquivo" e a mesa aplica sozinha.
6. **Som e compêndio.** Peça um som como trilha da cena e um arquivo de compêndio (json). O som toca nos jogadores; o compêndio da mesa muda.
7. **Jogador.** Como jogador, peça ao Claude dele um mapa: ele recusa ("Só o mestre põe o mapa da cena"). Peça o retrato da sua própria ficha: passa. A ficha de outro jogador ele nem enxerga.
8. **Sem shell.** Num cliente sem shell, peça uma imagem pequena (até 2 MB): o Claude manda em base64 e a imagem entra.
9. **Link.** Rode o mesmo comando curl duas vezes: a segunda é recusada ("já foi usado"). Troque o arquivo por um texto qualquer com nome .png: recusado ("Não reconheci o formato").
10. **Revogar.** Peça um envio e revogue o token em Preferências antes de rodar o comando: o curl responde que o token foi revogado.
11. **Usar o que já existe.** Peça "Liste os arquivos da mesa" e depois "Use o mapa X na cena Y": entra sem reenviar.

## M2 — O Claude faz tudo na preparação

Antes: o Claude conectado como mestre, a mesa aberta como mestre e outra janela como jogador, com uma cena de mapa.

1. **Sessão inteira de uma vez.** Peça: "Prepare a Segunda cena com névoa cobrindo tudo menos a ponte, 4 goblins na margem leste, trilha de floresta e a iniciativa rolada". O Claude cria a cena, cobre a névoa, revela a ponte, põe os goblins, define a trilha (suba um som antes, se não houver) e monta o combate. Confira cada parte na mesa.
2. **Névoa.** Peça "cubra tudo e revele o retângulo da coluna 10 à 14, linha 4 à 20". O jogador vê só a área revelada. Peça "desfaça a última névoa": volta.
3. **Texto no mapa.** Peça "escreva PONTE no mapa, na coluna 8, linha 8". Aparece em traços, para todos. Peça "apague o texto PONTE".
4. **Paredes e portas.** Peça "apague a parede perto da coluna 6, linha 3" e "tranque a porta perto da coluna 12, linha 5".
5. **Combate.** Peça "ponha os 2 goblins na ordem de turno, role a iniciativa só dos NPCs e passe para o próximo". Peça "esconda o painel de ordem de turno".
6. **Chat.** Peça "narre: um vento frio sobe do poço" e "sussurre para a Ana: você ouve passos". Sai com a marca "pelo Claude".
7. **Levar o grupo.** Publique a Segunda cena e peça "leve o grupo para a Segunda".
8. **Som.** Peça "toque a trilha floresta a 40%" e "pare a trilha".
9. **Tokens e fichas.** Peça "mova o Goblin 1 para a coluna 12, linha 8, marque como amedrontado e com 3 de vida" e "gaste um dado de vida d8 da Brisa".
10. **Configurar a mesa.** Peça "crie a pasta Vilarejo visível para todos" e "pause a mesa".
11. **Desfazer.** Peça ao Claude: "desfaça o texto e a névoa" (Preferências não tem mais a lista, desde o Q1). Chat, rolagens, combate e som não voltam (de propósito).
12. **Jogador.** No Claude do jogador, peça "cubra a névoa" e "monte o combate": ele diz que não pode.

## Q1 — Ajustes do Vilella e os arquivos entre navegadores

Antes: uma mesa com um token que tem ficha, o compêndio na pasta `compendio/` e o Chrome (ou Edge) com a pasta da mesa escolhida. Leia `docs/ARQUIVOS.md`.

1. **Abrir ficha.** Clique com o botão direito num token com ficha: "Abrir ficha" é o primeiro item do menu e abre a ficha. Como jogador, faça o mesmo no seu token.
2. **Preferências → Claude.** Não há mais a lista "O que o Claude fez". O selo "Rascunhos do Claude (N)" segue no topo.
3. **Importar.** Aba Mesa → Importar: só "Escolher arquivo…", sem campanhas de exemplo. Crie uma mesa nova: ela já vem como o 5e padrão (sem automação; a tocha, a lanterna e a fogueira).
4. **Transferências.** Preferências → Ajuda e arquivos → Transferências, com um arquivo indisponível de nome longo: o nome fica numa linha, cortado com reticências (passe o mouse para ver inteiro); o status vai abaixo. Confira em 1280×720 e 1600×900.
5. **Pasta sem permissão.** Feche o navegador e abra a mesa de novo como mestre. Aparece, na mesa, "A pasta da mesa precisa de permissão de novo" com "Reautorizar a pasta da mesa". Clique: o aviso some. O compêndio estava lá o tempo todo (o cache do navegador guarda); se o cache foi limpo, ele volta da pasta sem subir de novo.
6. **Segundo navegador.** Com a mesa aberta como mestre no Chrome, e já com mapa, token e compêndio, feche. Abra a mesa como mestre no Edge (mesmo computador). Antes do Q1 não tinha nada. Agora aparece "Os arquivos desta mesa ficam numa pasta do seu computador. Escolha a pasta da mesa neste navegador." e a aba Compêndio diz o mesmo. Clique em "Escolher a pasta da mesa" e escolha a mesma pasta do Chrome: o mapa, os tokens e o compêndio carregam, sem o Chrome aberto.
7. **Pasta com chave.** Numa mesa com a chave da pasta, entre como mestre no segundo navegador escolhendo a pasta da chave: a pasta vira a pasta da mesa ali (o aviso de escolher não aparece) e os arquivos carregam dela.
8. **Pasta errada.** Escolha outra pasta qualquer no segundo navegador: o aviso passa para "Faltam arquivos desta mesa e a pasta escolhida neste navegador não os tem" com "Trocar a pasta da mesa".

## Q2 — O compêndio por seções, com blocos e busca em português e inglês

Antes: a mesa com os seus arquivos reais (361 magias, 428 monstros, 274 itens mágicos) na pasta `compendio/`. Os arquivos com o nome em inglês são os regravados pelo Q2 (leia `docs/COMPENDIO.md`).

1. **Seções.** Aba Compêndio: no alto, Todas, Magias, Monstros, Itens mágicos, Armas e Itens (só as que têm entradas). Como jogador, Monstros não aparece.
2. **Magias por nível.** Em Magias, os blocos Truques, 1º nível ... 9º nível, fechados, com a contagem no título. Abra o 3º nível: as magias vêm em ordem alfabética. Feche. Recarregue a página: o que você deixou aberto continua aberto.
3. **Monstros por ND.** Em Monstros, os blocos ND 0, 1/8, 1/4, 1/2, 1, 2 ... 30, nessa ordem. Abra o ND 1/4.
4. **Itens mágicos por raridade.** Em Itens mágicos, Comum, Incomum, Raro, Muito raro, Lendário, Artefato, Varia. Filtre por Raridade e por Sintonização.
5. **Filtros.** Em Magias, escolha a classe Bruxo e a escola Evocação: os blocos que têm resultado se abrem sozinhos. Troque para Monstros: os filtros de magia somem e aparecem os de tipo e tamanho. "Limpar filtros" volta tudo.
6. **Busca em todas as seções.** Em Todas, digite "fogo": aparecem Magias, Itens mágicos e Monstros com resultado, cada um num bloco, com os blocos de nível, ND e raridade dentro. Digite "fireball": a Bola de Fogo aparece (o nome em inglês fica pequeno ao lado). Digite "bola de fogo" e "BOLA DE FOGO": o mesmo.
7. **Aviso de outra seção.** Em Magias, digite "goblin": a lista fica vazia e aparece "Buscar em todas as seções". Clique: o goblin aparece.
8. **Adicionar e arrastar.** Ache uma arma em Todas e use Adicionar; arraste uma magia para a ficha aberta. As duas funcionam como antes.
9. **Conferir nomes.** Abra 10 magias, 10 monstros e 10 itens mágicos ao acaso e veja se o nome em inglês confere. O que ficou sem nome em inglês (6 magias, 6 monstros, 15 itens) aparece só com o nome em português.

## Q4 — A mesa de som: 8 efeitos de um toque e 8 ambientes em laço

(Desde o Q4b, "ligar" um ambiente só o marca e "Parar tudo" virou o "Parar" do transporte: leia os passos abaixo junto com "Q4b".)

Antes de tudo: tenha na pasta `sons/` (ou à mão) uns 6 arquivos de áudio: 2 ou 3 efeitos curtos (trovão, porta, espada) e 3 ambientes longos (taverna, vento, chuva).

1. **Configurar um efeito.** Abra Som na barra de ferramentas. Num lugar vazio de Efeitos, clique em "adicionar". Na configuração, escolha o arquivo do trovão, dê o nome "Trovão", escolha o ícone Trovão e a cor Azul. O nome para em 12 letras. "Ouvir" toca só para você. Clique em Pronto: o botão aparece na grade, com o ícone na cor escolhida.
2. **Tocar um efeito.** Com um jogador conectado, toque o efeito: o jogador ouve uma vez, até o fim, e o botão mostra a barra de progresso e um quadradinho de parar. Toque de novo no meio: recomeça. Pare pelo quadradinho: corta para todos.
3. **Configurar ambientes.** Em Ambientes, configure três (Taverna, Vento, Chuva) com ícone e cor diferentes. Ligue a Taverna e o Vento ao mesmo tempo: os dois tocam juntos. Mexa no volume de cada um; um jogador entrando agora ouve os dois, cada um do ponto em que está. Desligue a Taverna: só ela some, com a saída suave.
4. **Volume geral e Parar tudo.** Baixe o volume geral: efeitos e ambientes ficam mais baixos para todos, sem recomeçar. "Parar tudo" corta o efeito e desliga os ambientes; o volume geral continua onde estava.
5. **Ambientes da cena.** Com a Taverna ligada, em "Ambientes desta cena" clique em "Usar os que tocam". Desligue tudo, leve o grupo a outra cena sem lista (nada muda) e volte: a Taverna liga sozinha. "Tirar" faz a cena não mexer nos ambientes.
6. **Janela e faixa.** No botão de encaixar da janela, passe para a faixa no pé da tela: efeitos à esquerda, ambientes em duas colunas, volume geral e Parar tudo no alto. Recolha e abra a faixa. Recarregue a página: continua em faixa. Solte em janela e confira que nada que tocava parou.
7. **Apagar um som.** Ponha o mesmo arquivo em um efeito e em um ambiente e ligue o ambiente. Na configuração, "Apagar este som da mesa": a confirmação diz onde o som estava (o efeito e o ambiente). Cancele: nada muda. Apague: os dois lugares ficam vazios, o ambiente para e o arquivo continua na pasta `sons/`. Escolha o mesmo arquivo de novo num lugar: funciona.
8. **O que o jogador não vê.** O jogador não tem o botão Som nem a faixa; só ouve. O volume dele (Preferências, cartão Som, agora com "Ambientes") é só dele.
9. **A campanha antiga.** Abra a campanha que tinha trilha: a trilha que tocava vira um ambiente ligado, e a trilha de cada cena vira um ambiente da cena. Confira os nomes (cortados em 12 letras) e ajuste ícone e cor.
10. **Claude.** Peça ao Claude para configurar um lugar, ligar um ambiente e apagar um som pela ferramenta `som`.

## Q5 — As rolagens no chat (Fita e Moldura)

1. **Fita é o padrão.** Abra o chat e mande uma rolagem pela ficha (um ataque com dano). Deve vir num cartão de cantos chanfrados, o nome numa fita no topo, acerto e dano lado a lado do mesmo tamanho, o dano só com o ícone do tipo (passe o mouse no ícone: o nome do tipo aparece).
2. **Balão.** Deixe o mouse parado ~meio segundo em cima de um cartão: aparecem os dados (o d20 descartado riscado, o que vale com borda âmbar) e a fórmula. Tire o mouse: some, e o chat não pula. Com Tab no cartão, o mesmo; Esc fecha.
3. **Vantagem e desvantagem.** Rode com vantagem e com desvantagem: os dois totais aparecem, o que vale grande, o outro pequeno e apagado, com a palavra pequena embaixo.
4. **Crítico e falha.** Um 20 natural deixa cartão, fita e número num verde; um 1 natural, num cinza apagado. Nada vermelho nem laranja no dano.
5. **Magia de salvaguarda e dardos.** Uma magia com CD mostra CD e dano lado a lado. Mísseis Mágicos no 2º espaço: o total no cartão, cada dardo no balão.
6. **Rolagem oculta** (como mestre): uma linha pequena em itálico, sem caixa.
7. **Moldura.** Preferências → Aparência → "Estilo das rolagens no chat": escolha Moldura. Os cartões do chat mudam na hora (linha dupla com cantoneiras, divisória com losango). Recarregue: continua Moldura. Volte para Fita.
8. **Temas.** Repita 1 e 7 no Pergaminho (claro): números e fitas legíveis.
9. **Várias rolagens seguidas** do mesmo jogador dividem o cabeçalho.
10. **Balão por metade (Q5b).** Num ataque, deixe o mouse parado em cima do acerto: aparecem só os d20 (o descartado riscado, o bônus). Passe para o dano: o balão troca na hora, sem esperar, e mostra só os dados do dano, a fórmula e o tipo. Numa magia com CD, o balão do dano traz o espaço usado e os dardos. Com Tab, cada metade ganha foco e o seu balão; Esc fecha. O balão fica dentro da coluna do chat. Teste e `/r` simples continuam com um balão só.

## Q3 — Importar mapas do Dungeondraft

**Onde achar arquivos para testar:** no Dungeondraft, *File → Export → Universal VTT* gera um `.dd2vtt` do seu mapa. Muitos autores de mapas (Patreon, itch.io, o próprio Dungeondraft com os mapas de exemplo) distribuem o `.dd2vtt` junto com o PNG. O Dungeon Alchemist (*Export → Universal VTT*) e o DungeonFog (`.df2vtt`) exportam o mesmo formato. Se o mapa vem só como PNG, não serve: precisa do arquivo do Universal VTT.

1. **A opção.** Como mestre, abra a faixa de cenas (Cena → Cenas). Depois de "Nova cena" há o card "Importar mapa — Dungeondraft / Universal VTT…". Como jogador, a faixa nem existe.
2. **Importar.** Clique no card e escolha o `.dd2vtt`. Um aviso no alto diz "Importando…" e depois "Cena criada: 1 mapa, N paredes, N portas, N luzes." Dispense no X.
3. **A cena.** Um card novo, com o nome do arquivo. Abra-a: o mapa deve ter o tamanho certo (a grade da imagem bate com a da mesa), com as paredes (use a ferramenta Paredes ou a Visão do mestre para ver os contornos), as portas e as luzes. O grupo continua na cena de antes.
4. **Portas.** As que o arquivo diz fechadas começam fechadas (clique para abrir e fechar). Não deve haver parede por baixo de porta.
5. **Visão.** Leve o grupo para a cena e ponha o token de um jogador numa sala: ele não enxerga através das paredes nem da porta fechada, e passa a enxergar quando a porta abre.
6. **Luz.** Mapa com luz "cozida" fica claro (dia). Confira as luzes no painel de fontes de luz (cor e alcance aproximados).
7. **Arrastar.** Arraste um `.dd2vtt` do computador para a janela da mesa: importa do mesmo jeito.
8. **Arquivo ruim.** Arraste um `.dd2vtt` sem imagem (ou um JSON qualquer renomeado): o aviso fica vermelho e diz por que não importou; nenhuma cena nasce.
9. **Mapa grande.** Importe um mapa de muitas paredes (mais de 3000): o aviso diz quantas entraram. A aba não deve travar; o JSON de dezenas de MB é lido em segundo plano.
10. **Cópias.** Com a pasta da mesa liberada, a imagem fica em `mapas/` e em `arquivos-da-mesa/`.
11. **Claude.** Peça: "importe este .dd2vtt" (com o arquivo no computador). O Claude usa `arquivos` com o uso `dungeondraft`, roda o curl e a resposta traz o resumo. Depois peça "desfaça": a cena some.
12. **Exportar e importar a mesa.** Exporte a campanha e importe de novo: a cena importada vem com as paredes e as luzes.

## Se algo der errado
- Anote a tela, o que fez e o que esperava, e mande para mim. Bug confirmado vai para `docs/BUGS.md`.
- Para voltar à campanha de antes de mesas e contas, use a cópia de segurança indicada no topo.

## Q2b — A busca do compêndio

1. Na aba Compêndio, procure `fireball`: acha a Bola de Fogo (se a mesa ainda tem os arquivos antigos, sem o nome em inglês, recarregue os arquivos do compêndio). Procure `fire`, `bola fogo`, `fogo bola`, `foggo` e `firebal`: todas acham.
2. Procure `misse` ou `MISSEIS`: acha Mísseis Mágicos. Procure `de zzzz`: não acha nada.
3. A barra diz só "Buscar…". Nas seções Monstros, Itens mágicos, Armas, Itens e em "Todas" a busca é a mesma, e o melhor resultado vem primeiro dentro de cada bloco.
4. Com a aba aberta como mestre, há espaço claro entre a lista e "Carregar arquivos do compêndio…", e entre os botões e "Créditos", nos temas escuros e no Pergaminho.

## Q4b — A mesa de som: transporte, janela própria, altura da faixa

1. **Tocar e Parar.** Marque dois ambientes (interruptores): nada toca, para você nem para o jogador. "Tocar" sem nenhum marcado mostra "Ligue um ou mais ambientes". Com dois marcados, "Tocar" toca os dois e o botão vira "Parar". Desmarque um: sai só ele. "Parar" cala tudo e corta os efeitos; os ambientes seguem marcados e o botão volta a "Tocar". Os efeitos tocam com o transporte parado ou tocando.
2. **Cena.** Leve o grupo a uma cena com ambientes: o transporte passa a tocar.
3. **Outra janela.** No botão de abrir em outra janela (janela ou faixa), a mesa de som abre numa janela do navegador. Toque um efeito e um ambiente por ela: o jogador ouve. A mesa mostra a janela do som sumida; fechar a janela devolve o painel. O botão do Som, com a janela aberta, a traz para a frente.
4. **Altura da faixa.** Encaixe a faixa. Arraste a borda de cima (ou use as setas, Shift, Home e End com a alça focada): tudo encolhe junto, sem mudar de lugar; no mínimo aparece a barra de rolagem. Recarregue: a altura fica.
5. **Configuração por cima.** Abra a configuração com a faixa e com a janela: ela abre por cima de tudo, inteira na tela.
6. **Mesa vazia.** Numa mesa sem sons, a janela e a faixa dizem "Nenhum som na mesa de som ainda" e o botão "Configurar" abre a configuração; "Tocar" fica desabilitado.
7. **Sons que a mesa já tem.** Na configuração, um lugar mostra "Sons que a mesa já tem" (os que você subiu antes, mesmo fora de um lugar) para pôr com um clique.
8. **Claude.** Peça ao Claude para marcar ambientes e tocar (`transporte: "tocar"`).

## Q9 — A Conjuração do NPC com a interface da aba Magias

1. Abra um NPC com magias (por exemplo o Mago do compêndio) e vá à fita Conjuração. Cada círculo tem o mesmo desenho da aba Magias de um personagem: o título, "Espaços totais", "Restantes n", as bolinhas e uma linha por magia com nome, escola, Conjurar, ícone de chat e engrenagem. Não há "Prep.".
2. Conjure uma magia de 1º círculo: o menu pede o espaço, "Restantes" cai um e a bolinha esvazia; o cartão sai no chat. "Recuperar espaços" devolve.
3. Clique no nome da magia: o texto abre na própria linha, com "mandar ao chat" (e tirar, para quem edita). A engrenagem abre o editor embaixo da linha.
4. "+ Círculo" mostra o próximo círculo vazio; preencha "Espaços totais" e escreva uma magia nova.
5. Arraste uma magia do compêndio para o NPC: ela cai no círculo dela (só esse círculo acende). Alt+↑/↓ numa linha em foco reordena.
6. Abaixo dos círculos ficam a conjuração inata (À vontade, 1/dia cada, N/dia) como antes.
7. Compare com a aba Magias de um personagem: as duas devem parecer a mesma interface.
8. Como jogador, com o NPC mostrado: vê as magias e os espaços, sem controles de edição.

## Q7 — O painel de cenas em grade, barras do tema, descrição aberta no chat

1. **Grade.** Menu Cena → Cenas. Todos os cards têm o mesmo tamanho (inclusive o do mapa largo e o do mapa alto); o nome longo termina em reticências e a dica mostra o nome inteiro. Crie cenas até passar de 3 linhas: aparecem 3 linhas e uma barra de rolagem vertical (nunca horizontal). "Nova cena" e "Importar mapa" ficam no fim.
2. **Buscar.** Digite parte do nome, sem acento, e com uma letra errada: os cards filtram; o número de cada card não muda. "Nenhuma cena com esse nome" quando nada casa. Esc limpa; Esc de novo fecha o painel.
3. **Botão direito no vazio.** Botão direito no espaço entre dois cards (ou depois do último): menu com "Nova cena" e "Importar mapa — Dungeondraft / Universal VTT…", e cada um faz o que o card faz. Com o foco num card ou num botão da grade, Shift+F10 (ou a tecla de menu) abre o menu.
4. **Fechar.** Clique no mapa, em outra aba ou em outro botão da barra: o painel fecha. Clique no botão Cenas: alterna. Clique em itens do menu, nos diálogos de apagar e configurar, no seletor de arquivo: não fecha. Trocar de cena pelo card não fecha.
5. **A faixa.** Com um mapa de verdade (taverna importada), troque de cena várias vezes pelo card e por "Levar grupo" com o painel aberto: nada do mapa anterior deve ficar na tela. Se aparecer, tire um print e diga qual mapa.
6. **Barras de rolagem.** Em Vampiro (vinho), Grimório e Pergaminho: a barra do chat, da aba Fichas, do compêndio e do painel de cenas tem a cor do tema (polegar mais claro que o trilho), e dá para achá-la.
7. **Descrição aberta.** Mande uma magia (compêndio, ou conjurar na ficha) e uma característica da ficha ao chat: o cartão chega com a descrição aberta, para você e para os outros. Esconda num navegador: no outro continua aberta.

## Q8 — O token em cada cena, as Automações na barra e a aba Mesa

1. **Token em cada cena.** Como mestre, crie uma cena B e leve o grupo para ela. Ponha outro token do Aldric na cena A (arraste a ficha). Como o jogador do Aldric, na B tire o token dele (Delete) e use "Colocar no mapa": ele nasce na bandeira da B, mesmo tendo token na A.
2. **Sempre na bandeira.** Tire o token e arraste a ficha para um canto longe da bandeira: o token vai para a bandeira (arrumado ao lado dos que já estão lá), sem aviso de erro. O mestre arrasta a ficha para onde quiser e ela fica onde ele soltou.
3. **Levar o grupo.** Com o Aldric tendo token na A e na B, leve o grupo de uma cena para a outra e de volta: o token de cada cena fica na sua cena, sem duplicar.
4. **Automações.** Como mestre, o botão "Automações" fica na barra de cima, antes de "Ver como". Ele abre e fecha a janela; crie uma reação por ela. O jogador não vê o botão. Na aba Mesa, o cartão Automações tem a frase e o botão que abre a mesma janela.
5. **Aba Mesa.** Parece da mesma família das Preferências: cartões com ícone e resumo; só "Esta mesa" abre por padrão; cada cartão abre e fecha no título (e lembra depois de recarregar). Confira Regras (rótulos curtos, ajuda embaixo), Luz, Pessoas (papéis, contas, capacidades), Campanha (exportar e importar) e Diagnóstico. "Modelos de tocha…" (Luz) abre o cartão da Luz.

## Q10 — Hordas: vida por token, numeração, pôr vários, duplicar e Ctrl+C / Ctrl+V

1. **Pôr vários.** Como mestre, crie um NPC (ou arraste um monstro do Compêndio). Na aba Fichas, clique com o botão direito no NPC: "Colocar vários…". Digite 5 e Enter: cinco tokens arrumados no centro da tela, "Goblin", "Goblin 2"... "Goblin 5". Pelo cabeçalho da ficha o botão de pessoas faz o mesmo.
2. **Vida própria.** Selecione o Goblin 3, aperte E, digite -3 e Enter: só a vida dele desce (veja no Goblin 2). Na lista de Fichas a ficha continua com os PV de antes.
3. **Ficha pelo token.** Botão direito no Goblin 3, "Abrir ficha": no alto da ficha, "Este token: Goblin 3 · PV 4/7", editável; os PV de baixo dizem "do modelo". Abrir a mesma ficha pela lista tira a faixa.
4. **Vilão único.** Na Configurar do NPC, desligue "Cada token com a sua vida (horda)": os tokens passam a usar a vida da ficha (dano em um desce em todos). Ligue de novo.
5. **Duplicar.** Selecione um token ferido e aperte Ctrl+D: nasce ao lado, igual (mesma vida, tamanho, condições) com o próximo número. Alt e arraste um token: ele fica e uma cópia nasce onde você soltou.
6. **Copiar e colar.** Shift ou Ctrl+clique soma um segundo token à seleção. Ctrl+C, mexa o mouse para outro lugar do mapa e Ctrl+V: os dois aparecem com o mesmo arranjo, o centro do grupo no mouse. Vá olhar outra cena (botão direito no card, "Ir") e Ctrl+V de novo: colam lá, e a numeração recomeça (Goblin, Goblin 2).
7. **Texto continua texto.** Digite no chat, selecione, Ctrl+C e Ctrl+V: é o texto de sempre; nenhum token é copiado nem colado.
8. **Jogador.** Como jogador, Ctrl+D, Ctrl+C e Ctrl+V não fazem nada. Ele vê o nome numerado dos Goblins, mas não vê a vida deles (nem com a ficha aberta), a não ser que veja a ficha do NPC (pasta visível e "Ver fichas dos outros").
9. **Claude.** Peça "põe 6 goblins na Eclusa" (`tokens` com `quantidade`) e "duplica o Goblin 2 duas vezes": tudo num passo do Desfazer.

## Q11 — Barra de vida, borda colorida, laço, mover vários e dano em lote

1. **Barra de vida.** Como mestre, ponha uns goblins (Colocar vários) e fira um deles (E, -4): uma barra fina aparece embaixo de cada token, acima do nome; verde cheia, âmbar abaixo da metade, vermelha abaixo de um quarto. Dê 5 de temporários a um: um trecho azul-claro aparece depois da vida. Afaste e aproxime o zoom (50% a 200%): a barra continua legível e não cobre o nome. O token do compêndio também já tem barra.
2. **Só quem controla vê.** Como jogador, só o seu token tem barra (a vida dele cai ao vivo quando o mestre o fere); nos goblins e nos outros jogadores não há. No "Ver como" o mestre vê o que aquele jogador vê.
3. **Ligar e desligar.** "Editar token…" (dois cliques): desmarque "Barra de vida": a barra daquele token some (nos outros não). Na ficha, em "Token padrão e visão", "Barra de vida nos tokens novos" desligada: o próximo token do personagem nasce sem barra.
4. **Sem selo.** Os goblins numerados não têm mais a bolinha no canto: o nome ("Goblin 3") basta.
5. **Borda.** Botão direito num token: "Borda" com 8 cores e "sem borda"; ponha vermelho num grupo e azul no outro. O anel aparece na beira do token, também para o jogador. Selecione um token com borda amarela ou laranja: o anel dourado da seleção continua distinto (fica por fora, com um vão). Passe o mouse numa cor: a dica diz o nome; ela também se alcança pela tecla Tab.
6. **Laço.** Com a ferramenta Selecionar, arraste no fundo vazio: um retângulo na cor de acento; ao soltar, os tokens com o centro dentro ficam selecionados. Shift ou Ctrl soma. Esc no meio cancela. Segurar o clique parado no fundo continua fazendo o ping. Espaço+arrastar move a vista como sempre.
7. **Mover juntos.** Com vários selecionados, arraste um deles: todos vão, mantendo o arranjo. As setas também andam todos. Um clique (sem arrastar) num deles deixa só ele selecionado.
8. **Dano em lote.** Com vários selecionados, aperte E: a marca diz "3 selecionados"; digite -5: todos levam 5 (os temporários absorvem primeiro); +3 cura (nunca passa do máximo). Um valor sem sinal ("12") não vale. No botão direito, "Vida dos N selecionados…" faz o mesmo. Dois tokens da mesma ficha (vilão único) levam o dano uma vez só.
9. **Claude.** Peça "dá 5 de dano nos três goblins e põe borda vermelha neles" e "anda o grupo dois quadrados para a direita" (`tokens` com `grupo`): cada gesto é um passo do Desfazer.

## Q12 — Sem aviso de parede, setas rápidas e seguir meu token

1. **Sem aviso.** Como jogador, ponha uma parede no caminho do seu token (o mestre desenha) e ande contra ela com as setas e arrastando: o token não passa e nenhum aviso aparece embaixo. O aviso de porta trancada e o de "fora de alcance" (clique numa porta) continuam.
2. **Setas na hora.** Selecione o token e aperte uma seta: ele anda no mesmo instante, sem esperar. Segure: ele anda uns 10 quadrados por segundo, direto, e para assim que você solta. Tente com a luz e a névoa ligadas, como mestre e como jogador. Arrastar e soltar também fica ligeiro.
3. **A sala ainda manda.** O jogador não atravessa parede, porta fechada nem janela com as setas. Se o mestre fechar uma porta no meio do caminho, o token do jogador pode aparecer andando um quadrado e voltar, sem aviso.
4. **Seguir meu token.** No canto do zoom, o botão da mira ("Seguir meu token", atalho F). Ligue: a vista desliza até o seu token e ele fica no centro enquanto você anda (setas, arrasto, o mestre movendo, "Levar o grupo"). Use a roda ou o + e −: o zoom muda e o token continua no centro. Arraste a vista (Espaço+arrastar ou a Mão): o botão desliga. "Centralizar o mapa" também desliga.
5. **Mais de um token.** Se você controla dois tokens na cena, ligar abre uma lista (nome e cor): escolha um. A setinha ao lado do botão reabre a lista. Recarregue a página: continua ligado no que você escolheu. O mestre liga com um token selecionado e segue esse; sem seleção, a lista mostra os tokens da cena.
6. **Troca de cena.** Com o seguir ligado, o mestre leva o grupo a outra cena: a vista vai para o token do mesmo personagem, se ele estiver lá; senão fica parada até ele aparecer. Apague o token que você segue: o botão desliga sozinho.

## Q13 — Segurar a seta, contínuo e em linha, numa cena pesada

1. **Cena pesada.** Numa cena com muitas paredes, escuridão, a tocha presa ao token, névoa e memória do mapa, selecione o token e segure uma seta por uns 3 s: ele anda liso, em ritmo parelho, sem parar entre os quadrados nem frear em cada um. Solte: ele termina o quadrado em que está e para.
2. **Um toque.** Um toque continua sendo um quadrado rápido.
3. **Parede.** Segure a seta contra a parede (no fim de um corredor): o token para no último quadrado, sem passar um quadrado a mais e voltar.
4. **Quem olha.** Com a tela do mestre aberta, o token do jogador andando também parece liso, sem saltos.
5. **A luz e a memória.** Depois de andar, a luz da tocha está no token e o caminho por onde passou fica lembrado; a visão não treme.

## Q14 — A ficha por seções

1. **Escrever num talento.** Abra a ficha de um personagem com talentos, abra um deles e escreva um texto longo. Digitar é fluido, o cursor não pula do lugar (nem quando a sala devolve a ficha, uns 0,4 s depois de parar) e o resto da ficha não pisca.
2. **Atributo.** Mude a Força: o modificador, as salvaguardas, as perícias e os ataques que dependem dela mudam na hora; PV, moedas e talentos ficam como estavam.
3. **Nível e proficiência.** Mude o nível de uma classe e marque uma proficiência numa perícia: os totais acompanham.
4. **Números e caixas.** Digite no XP, nas moedas e nas caixas da aba História (aparência, aliados, história, tesouro, notas): cada uma guarda o que foi escrito.
5. **Dicas.** Passe o mouse (parado ~0,7 s) em um botão só de ícone da ficha: a dica aparece e some ao sair; com Tab ela aparece no foco e Esc a fecha. O leitor de tela continua lendo o nome do botão e o motivo do que está desabilitado.
6. **Duas pessoas.** Com a mesma ficha aberta no mestre e no jogador, escrever em caixas diferentes não apaga o que o outro escreveu.

## Q16 — o MCP faz tudo o que a tela faz

Com o Claude conectado a uma mesa de teste (não a da campanha):
1. **Som e zona.** Peça: "suba este mp3, crie na cena uma zona com luz menor, visão de 3 m e este som em laço, e uma reação que avise no chat quando alguém entrar". Confira no painel de automações: a zona com os efeitos e o som, a reação ao evento "entrou na zona".
2. **Conjurar.** Com uma ficha de mago, peça "a Brisa conjura Bola de Fogo com espaço de 4º". O chat mostra o cartão com o dado a mais e a ficha marca um espaço de 4º gasto. Peça de novo até acabar: o Claude deve avisar que não há espaço.
3. **Inata.** Num NPC com uma magia "1/dia cada", peça para conjurar duas vezes: a segunda é recusada.
4. **Ficha.** Peça "ponha 300 de XP, inspiração e PV temporários 5 na Thara"; confira na ficha.
5. **Token.** Peça "o token da Brisa é controlado pela Ana, com borda azul e barra de vida"; a Ana move o token.

## MU1 — a música da mesa

Use uma pasta de teste com subpastas e uns mp3 (de 2 a 5 minutos, para dar tempo de ouvir a troca): por exemplo `Musicas\Combate\` (3 ou 4 músicas), `Musicas\Combate\Chefe\` (1), `Musicas\Taverna\` (2) e `Musicas\Exploracao\` (2). Mesa de teste, não a da campanha.
1. **Adicionar uma pasta.** Mesa de som, engrenagem, aba **Música**, "Adicionar pasta", escolha `Musicas`. Cada música entra com o nome do arquivo e a **duração certa** (confira com o player do computador); as **subpastas viram etiquetas**: tudo de `Combate\` com "Combate", a do `Chefe\` com "Combate" e "Chefe". Arquivo solto na raiz entra sem etiqueta. "Adicionar mp3" põe arquivos soltos. Adicionar a mesma pasta de novo não duplica nada.
2. **Etiquetas em lote.** Marque várias músicas: aparece a barra "N selecionadas". "+ Etiqueta" (escreva "Noite") põe nas marcadas; "− Etiqueta" tira uma que elas têm; "Energia" dá de 1 a 5 (ou "Sem nota", que vale 3). Marque uma só: "Nome e descrição" deixa escrever uma linha de descrição. "Tirar da lista" pede confirmação e não apaga o arquivo do computador.
3. **Filtro.** Aperte "Combate" e depois "Chefe": só as músicas que têm **as duas**. Aperte os números da Energia (1 a 5): a lista só mostra a faixa. A busca acha pelo nome ou pela descrição. O play de cada linha toca **só para você** (confira no jogador: ele não ouve nada).
4. **Botão aleatório.** Filtre "Taverna", deixe "Aleatória, sem repetir", "Salvar este filtro como botão", nome "Taverna", ícone e cor. O botão aparece na seção Música da mesa de som com quantas músicas tem. O lápis recarrega o filtro para editar; a lixeira apaga.
5. **Botão crescente.** Filtre "Combate", escolha "Crescente", salve como "Combate". Dê energias diferentes às músicas (1, 2, 3, 5...). Aperte o botão: começa na de **menor energia** e sobe; no fim da subida fica tocando **só as de energia mais alta**, uma depois da outra, sem repetir em seguida e sem parar. (Para conferir sem esperar, use "Próxima".)
6. **Aleatória sem repetir.** Aperte "Taverna" e use "Próxima" várias vezes: nenhuma música repete até todas tocarem, e a última nunca volta logo em seguida.
7. **Todos ouvem a mesma coisa.** Com um jogador na mesa (outra janela ou computador), aperte um botão: o jogador ouve a **mesma música, no mesmo ponto** (a música baixa no jogador no primeiro toque). Entre na mesa depois de a música começar: ela entra no ponto certo. A música toca **por cima dos ambientes** (ligue um ambiente junto). A troca entre músicas e entre botões tem uma transição suave de uns 3 segundos.
8. **Pausar, próxima, anterior.** Pausar cala para todos; tocar continua do mesmo ponto. "Anterior" depois de 3 s recomeça a música; antes disso volta para a anterior. O volume da música (na linha do player) vale para todos junto com o volume geral; "Parar tudo" pausa a música também.
9. **Voltar.** Toque "Combate", espere uns 40 s, aperte "Taverna": aparece **"Voltar a Combate"**. Aperte: o "Combate" volta **do ponto onde parou** e agora o botão diz "Voltar a Taverna".
10. **Abas.** Na faixa do pé da tela há duas abas logo abaixo do cabeçalho, "Efeitos e ambientes" (abre primeiro) e "Música", cada uma com o que toca nela ("2 ambientes ligados"; o nome do botão da música com o ícone de tocando ou pausada; ou "parada"). Clique para trocar; com a aba focada (Tab), as setas, Home e End trocam. Toque uma música e vá para "Efeitos e ambientes": um **ponto** marca a aba Música e a música não para. Recarregue a página: a aba escolhida continua. Na **janela flutuante** e na **janela própria** as abas são as mesmas, cada uma na largura toda.
11. **Textos sem cortar.** Na faixa a 1280, 1366 e 1600 px: os nomes dos efeitos e dos ambientes mostram até **duas linhas** (as reticências só vêm se passar disso; parado em cima aparece o nome inteiro); o lugar vazio de efeito é só um "+" (a dica diz "Adicionar efeito"); o volume e a porcentagem do ambiente ligado ficam **dentro do cartão**; "Adicionar músicas" tem espaço entre o ícone e o texto.
12. **Chamada.** Com a chamada aberta, o quadro "Trilha da mesa" mostra o **nome da música** e o do botão para todos; o mestre tem **Pausar** e **Próxima** ali. Pausada, o quadro volta a mostrar os ambientes.
13. **O jogador não vê a biblioteca.** O jogador não tem a mesa de som nem a lista de músicas; só vê o nome do que toca.
14. **Claude.** Com o Claude conectado: "etiquete as músicas de combate com 'Luta' e dê energia 4 à 'Lâminas no Vau'", "crie um botão 'Chefe' crescente com as de energia 4 e 5 e toque", "pause e volte ao que tocava antes".
15. **Abas e zoom (MU3).** As abas da mesa de som (faixa e janelas) e as da configuração têm o desenho do "Personagem | NPC" da ficha, sem a linha de estado; a aba escondida com algo tocando mostra um ponto. Com a mesa de som em faixa, o zoom fica logo acima dela; arraste a alça, recolha e abra: ele acompanha. Solte em janela: o zoom volta ao pé.

## CH1 — a chamada da mesa (voz e vídeo, com fundo desfocado)

Precisa de câmera e microfone (ou os falsos do Chrome) e de duas pessoas de verdade, ou de uma janela anônima como jogador. Tudo em `localhost` (a câmera só funciona fora dele com HTTPS).
1. **Abrir.** Na mesa, o botão de vídeo no topo ("Chamada") abre uma janela só da chamada, do tamanho de 1100×720 (a próxima vez ela lembra o seu tamanho e posição). O pop-up bloqueado mostra o aviso para liberar as janelas.
2. **Antes de entrar.** A câmera aparece grande; ligue e desligue o microfone e a câmera (sem a câmera aparece a sua inicial); o nível do microfone se mexe quando você fala; escolha "Desfocar" e "Desfocar forte" e veja o fundo borrar com você nítido; troque câmera, microfone e saída de som; marque "Entrar com o microfone desligado". Quem já está na chamada aparece embaixo.
3. **Dois lados.** Numa janela anônima do mesmo navegador (ou em outro computador na mesma rede), entre como jogador na mesma mesa e abra a chamada. Entre nas duas. Cada uma vê os dois quadros e **ouve a outra** (fale e confira o anel verde em quem fala). Um som curto avisa quando alguém entra e quando sai (dá para desligar em "Câmera, microfone e som").
4. **Microfone, câmera e fundo.** Desligue o microfone numa janela: a outra mostra o ícone riscado no quadro e na lista. Desligue a câmera: vira a inicial na cor da pessoa. Ligue o desfoque: a outra vê o selo "Fundo desfocado" e o fundo borrado de verdade. As teclas **M**, **V** e **B** fazem o mesmo (só dentro da janela da chamada; nada acontece se estiver digitando).
5. **Tema.** Troque o tema na mesa (Preferências, Aparência): a janela da chamada o acompanha ao vivo. Ela não tem seletor de tema. Clicar num quadro não faz nada; a lista de pessoas esconde e mostra pelo botão do topo.
6. **Volume por pessoa.** Na lista, clique numa pessoa: o volume vai de 0 a 200% e "Silenciar só para mim" a cala só para você. Feche e abra a janela: o volume e o silêncio continuam (lembrados por mesa e pessoa neste navegador).
7. **Parar de ouvir.** O botão do fone silencia todos para você e o seu microfone para os outros; o ícone aparece no seu quadro.
8. **Janela estreita.** Encolha a janela para menos de ~560 px de largura: vira linhas com miniatura, nome, personagem, "falando" e a trilha numa linha, com os mesmos botões em ícones. "Abrir em tamanho grande" a alarga. No Chrome ou no Edge, "Flutuar por cima" leva a chamada para uma janela que fica sobre todas as outras (o botão some onde não há suporte).
9. **Trilha da mesa.** O mestre liga um ambiente na mesa de som: o quadro "Trilha da mesa" mostra o nome e o equalizador para todos; o mestre tem "Abrir a mesa de som".
10. **Chamar.** Com você na chamada e outra pessoa na mesa, fora dela, a lista mostra "Chamar"; a pessoa recebe na mesa o aviso "… está chamando para a chamada" com "Entrar".
11. **Substituir.** Entre pela mesma conta numa segunda janela: a primeira mostra "Você entrou na chamada por outra janela" e "Entrar de novo".
12. **Sair.** "Sair" volta para "antes de entrar" ("Entrar de novo"). Fechar a janela também sai: o quadro some nos outros e a contagem do botão do topo cai. Na mesa, o botão do topo mostra quantos estão na chamada e a presença ganha um ícone verde em quem está.
13. **Cheia.** Com 8 pessoas na chamada, a 9ª vê "A chamada está cheia (8)" (só dá para testar com 8 janelas; está coberto por teste de unidade).

## AU1 — automações por blocos

Montar a Respiração da Montanha do zero (cena "Pulmão" com algumas tochas acesas e um token):
1. Botão **Automações** → **+ Nova automação**. Nome "Respiração". O gatilho já é "A cada 60 s": mude para 180 s e marque a cena Pulmão em "Cenas onde vale".
2. No "+" depois do gatilho, **Para cada (tochas, tokens)**: objetos, modelo Tocha, só os acesos. No "+" dentro dele: **Luz** (×0,5 por 20 s) e **Apagar a tocha** (chance 30%, perde 300 s). Confira a frase embaixo.
3. **Trilha em paralelo**: **Esperar** 90 s, **Para cada** tokens, **Limitar a visão** 1,5 m por 30 s. **Salvar**. A lista mostra a frase e "próxima em …".
4. Conferir no mapa: as tochas encolhem por 20 s e algumas apagam; 90 s depois a visão dos tokens cai e volta. Pausar a mesa congela tudo.
5. Erro: numa automação nova, ponha **Luz** solta e **Salvar**: o bloco ganha contorno e a mensagem pede o "para cada".

Armadilha de zona: desenhe a zona "Armadilha", abra o painel (ferramenta Zonas), **+ automação para esta zona**, ponha **Avisar no chat**, salve, e leve um token para dentro. Teste também **Testar agora**, **Desfazer** no editor, setas e Delete, **JSON**, **Janela própria**, liberar o botão aos jogadores (menu ⋯ da lista) e **Apagar** com **Desfazer**.
Importe a Chama Primordial: 5 automações convertidas; a Respiração igual à de cima. Peça ao Claude: "como funciona a Respiração?" (ele chama `guia` e `explicar`).

## AU2 — automações como o n8n

Montar a Respiração da Montanha do zero, só arrastando (cena "Pulmão" com algumas tochas acesas e um token):
1. Botão **Automações** → **+ Nova automação**: o editor abre **numa janela nova**, na hora (a janela da mesa não mostra editor nenhum). Nome "Respiração". Clique no bloco do gatilho (a cada 60 s) e mude para 180 s; em "Esta automação" (clique no fundo da grade) marque a cena Pulmão.
2. Arraste **Para cada (tochas, tokens)** da esquerda para a grade (objetos, modelo Tocha, só os acesos); arraste **Luz** e **Apagar a tocha** para perto. Ligue as bolinhas: gatilho → "para cada"; **Cada um** do "para cada" → Luz; Luz → Apagar a tocha. (Luz ×0,5 por 20 s; apagar com 30% e perde 300 s.)
3. Arraste **Esperar** (90 s), **Para cada** (tokens) e **Limitar a visão** (1,5 m por 30 s) e ligue o gatilho → Esperar → Para cada → Limitar (um segundo caminho saindo do mesmo gatilho: roda em paralelo). Confira "Em português:" embaixo. **Salvar** fecha a janela.
4. Conferir no mapa como no AU1. Teste **Organizar** (arruma em colunas), a roda do mouse (zoom), arrastar o fundo, **Shift + arrastar** (caixa de seleção), **Ctrl+C / Ctrl+V** e o duplo clique na grade (busca de peças).
5. Teclado: Tab entre os nós, setas movem o nó, Enter vai aos campos, Delete apaga, e o botão **Ligar a…** (acima do nó escolhido) liga sem mouse.

Uma armadilha com OU de zonas: crie as zonas A e B. Numa automação nova ponha dois gatilhos **Token entra ou sai de zona** (A e B), um **Se**, uma condição **Token de jogador** ligada a uma porta **NÃO**, uma condição **Chance** (50%), uma porta **E** (liga NÃO e Chance nela), ligue a porta E na entrada de baixo do **Se**, os dois gatilhos na entrada de cima, e o "sim" a **Para cada** (objetos acesos) → **Apagar a tocha**. Entre com um NPC pela zona A e pela B: a tocha apaga em metade das vezes; com um token de jogador, nunca.

Mesa de eventos: crie duas automações com gatilho de botão (escolha cor e ícone no gatilho). Na lista, **Abrir mesa de eventos**: os botões aparecem grandes, com nome, cor, ícone e "Ligada"; clicar dispara e brilha "Disparou". Teste a faixa (encaixar), a janela própria, e libere um botão aos jogadores: o jogador abre a mesa pelo botão da barra e vê só o liberado.

## FG1 — luz e fogo

1. **Modelo ao vivo.** Ponha uma tocha na mão de um jogador e outra num suporte. Em Mesa, Luz, abra o modelo da tocha e mude a luz plena: as duas mudam na hora, para todos. Mude a duração para menos que o tempo que resta: o relógio das tochas acesas cai para o novo máximo. Renomeie o modelo: o nome das tochas muda. O jogador não vê a duração do modelo fora do modo exato.
2. **Área de soltar.** Arraste a tocha da mão para perto do suporte, fora do ícone (uns 40 px de distância): o suporte ganha um círculo de destaque e, ao soltar, a tocha pendura. Longe demais (mais de uma célula), ela volta para a mão.
3. **No lugar do ícone.** A tocha no suporte fica exatamente onde estava o ícone do suporte, que some; "Pegar do suporte" devolve o ícone.
4. **Zoom.** Dê zoom para fora e para dentro: ícones, tochas e chamas crescem e encolhem com o mapa; o relógio fica legível e some em zoom bem baixo. O clique e o arrasto continuam fáceis de acertar.
5. **Chama.** Segure uma tocha acesa sobre um inflamável: nasce um fogo animado (sem o símbolo da tocha). Com o painel de luzes aberto, selecione o inflamável e arraste as alças brancas para esticar o fogo (e veja os campos "Chama: largura" e "altura"); um jogador vê o mesmo tamanho. "Usar o tamanho do modelo" volta ao padrão. Um morro pequeno e um grande têm chamas de tamanhos diferentes.
6. **Estágios e arquivos.** No editor do modelo, em "Chama no mapa", escolha "Arquivo" num estágio e envie um gif, webp animado ou apng: o fogo daquele estágio passa a ser o seu (o jogador baixa o arquivo sozinho). "Padrão" volta ao fogo gerado pela mesa. Com "reduzir movimento" ligado no sistema, o fogo fica parado.
7. **Jogador dá equipamento.** O jogador abre a ficha do próprio personagem e usa o "+" do item "Tocha": a quantidade sobe. No personagem de outro, nada. O mestre desliga "Dar e tirar equipamentos de luz dos próprios personagens" nas Permissões: o "+" do jogador fica desabilitado.
8. **Setinha.** Na ficha, a setinha ao lado do item de modelo (tocha) recolhe e expande o peso, a nota e as tochas usadas. O estado fica lembrado neste navegador, por item. Funciona com Enter e Espaço.
9. **Claude.** Peça ao Claude: "mude o tamanho da chama da Fogueira para 2 por 2 metros", "use o arquivo fogo.gif no estágio forte da Tocha" (depois de enviar) e "dê 3 tochas à minha ficha" (como jogador).

### CH2 — a grade da chamada
1. Abra a chamada sozinho e com mais uma pessoa: os quadros e a trilha cabem, sem barra de rolagem, centralizados. O botão "Abrir a mesa de som" aparece inteiro.
2. Arraste a janela até ficar bem pequena e bem grande: a grade se refaz e nunca rola. Abra e feche a lista de pessoas (botão do topo): o mesmo.
3. Com 9 quadros ou mais (peça a mais gente ou use o teste): a segunda página aparece com setas e "1/2"; as setas do teclado trocam quando a grade tem o foco. Quem fala numa página escondida acende um ponto verde na seta.
4. A barra de baixo está mais baixa, a lista de pessoas mais estreita e "Volume para você" cabe numa linha acima do controle.

## CH3 — tela de entrar, desfoque em três níveis, gravar e transcrever

**A tela de entrar e o desfoque**
1. Abra a chamada (botão "Chamada" do topo): a câmera aparece grande no meio, numa coluna estreita (uns 720 px), com Câmera, Microfone e Fundo na mesma linha, as caixas alinhadas. "Entrar na chamada" e "Entrar só ouvindo" têm a largura do texto, lado a lado. Não há barra de rolagem na janela grande. Estreite a janela (menos de 560 px): vira uma coluna, com os botões um embaixo do outro.
2. Em "Fundo da câmera" escolha **Leve** e depois **Forte**: o Leve deixa o rosto e o ambiente ainda reconhecíveis; o Forte borra bem mais. "Desligado" volta à câmera crua.
3. Entre na chamada. O botão do fundo (ícone de pessoa) mostra um **L** ou **F** no canto; clique nele: abre um menu pequeno com Desligado, Leve e Forte. Escolha um. A tecla **B** passa ao próximo nível (Desligado, Leve, Forte, Desligado). Feche o menu com Esc.

**Instalar o whisper.cpp (uma vez)**
4. Siga `docs/WHISPER.md`: baixe o pacote com CUDA e o modelo `large-v3-turbo`, ponha `WHISPER_EXE` e `WHISPER_MODELO` (ou o `transcrever.config.json`). Rode `whisper-cli.exe -h` para conferir.

**Gravar 5 minutos com alguém**
5. Escolha a pasta da mesa (aba Preferências, "Ajuda e arquivos"). Como mestre, entre na chamada com um jogador. Clique em **Gravar para transcrição** (o círculo na barra de baixo): a confirmação diz o que é gravado e onde; "Começar a gravar".
6. Nos dois lados aparece "● Gravando para transcrição" no topo. O jogador, que ainda não entrou, também vê isso na tela de antes de entrar. Fale uns 5 minutos, role um dado, mande uma mensagem no chat e leve o grupo para outra cena.
7. Peça ao jogador para marcar **"Não gravar a minha voz"**: você, como mestre, vê "Fora da gravação: <nome>". Fale um pouco mais: a pasta dele para de crescer. Desmarque e marque de novo, se quiser.
8. Pare pelo mesmo botão (ou saia da chamada, ou feche a janela): o aviso some. Abra `gravacoes/<data_hora>/`: uma pasta por pessoa com os `.wav` curtos (só a fala), mais `gravacao.json`, `nomes.txt` e `eventos.jsonl`. Ouça um trecho: deve ter só a fala, com um pouco de folga antes e depois.

**Transcrever, trazer e pedir o resumo**
9. No terminal, na raiz do repositório: `pnpm transcrever "C:\caminho\da\pasta-da-mesa\gravacoes\<data_hora>"`. O terminal mostra a pessoa, o trecho e o tempo que falta. Abra `transcricao.md`: a linha do tempo com horário, nome e fala, misturada com as rolagens, o chat e a troca de cena.
10. Na aba **Mesa**, seção **Gravações da sessão**: a gravação aparece como "transcrita". **Trazer a transcrição**: vira a nota "Sessão de DD/MM — transcrição", só sua (veja em Fichas; o jogador não a vê). A mesa pergunta **"Apagar o áudio da gravação?"**: apagar é o padrão; a transcrição fica. O estado vira "trazida".
11. Peça ao Claude: "resuma a sessão de hoje". Ele deve ler a nota da transcrição e escrever o resumo como rascunho de nota (o que aconteceu, NPCs, pistas e pendências).

**O que conferir com o whisper de verdade**: se a placa foi usada (a saída do whisper diz); quantos minutos levou para 5 minutos de fala; se os nomes (Thorin, a Torre Negra...) saíram certos; se a hora das falas bate com o relógio da sessão (compare uma fala com o chat do mesmo instante).

## AS1 — assets da mesa e segurança dos arquivos

1. **Soltar na cena.** Como mestre, arraste um png (ou jpg, webp) do computador para o mapa: a imagem aparece onde você soltou, na camada de trabalho (veja a camada no menu do topo). Faça o mesmo com um gif: ele anima em laço. Entre como jogador: vê as duas, e a mesma animação.
2. **Mover, esticar, girar.** Clique na imagem: aparecem as alças. O quadrado cheio do canto de baixo estica (mantém a proporção; Shift solta); o círculo de cima gira (Shift gira de 15 em 15 graus). Dois cliques (ou botão direito) abrem o painel: largura e altura em quadrados, "Manter a proporção", giro, camada, ocultar, apagar. Delete apaga e o aviso tem "Desfazer".
3. **Camadas.** Ponha uma imagem na camada "mestre": o jogador deixa de ver. Em "mapa" fica de cenário (o jogador vê, não seleciona).
4. **Assets da mesa.** Aba Mesa, "Assets da mesa": todos os arquivos (mapas, imagens, gifs, sons, retratos, tokens, json) com miniatura, tipo, tamanho, quem enviou, onde é usado e "neste computador". Filtre por tipo e por quem enviou, busque (por nome, pessoa ou uso) e mude a ordem. Arraste uma linha para o mapa: a imagem entra onde soltou. O botão "Pôr na cena" faz o mesmo no centro.
5. **Renomear, baixar, apagar.** Lápis renomeia (só o nome mostrado). Seta para baixo baixa o arquivo. Lixeira: sem uso, uma confirmação; em uso, o aviso lista onde (por exemplo "imagem solta Estátua") e "Apagar mesmo assim" tira a imagem desses lugares; o aviso tem "Desfazer". Som em uso numa zona ou automação: o aviso diz onde e, confirmado, tira o som de lá.
6. **Jogador.** Libere "Pôr imagens soltas na cena" para um jogador (aba Mesa, Pessoas). Ele solta uma imagem no mapa (camada dos tokens), move, estica e apaga a dele, e nunca a dos outros. Sem a permissão, o aviso diz que não pode. Em Preferências, "Arquivos da mesa" mostra só o que ele enviou e o que ele já vê: nunca o mapa escondido nem os sons do mestre. O mestre vê o upload dele na lista, "enviado por <nome>".
7. **Pasta do mestre.** Escolha a pasta da mesa (aba Preferências, Ajuda e arquivos). Abra a pasta: `assets/<quem enviou>/<tipo>/<nome>-<hash>.<ext>`. A imagem que um jogador mandou está ali como WebP gravado de novo; os arquivos antigos (`arquivos-da-mesa/`, `recebidos/`) continuam onde estavam.
8. **Segurança.** Arraste para o mapa um `.exe` renomeado para `.png` e um `.svg`: o aviso diz "programa do Windows" e "SVG", e nada entra. Nenhum arquivo com extensão executável aparece na pasta.
9. **Claude.** Peça: "ponha esta imagem na cena Cripta, em 10, 8, com 3 quadrados de largura" (depois de enviar), "mostre os assets da mesa", "gire a estátua 45 graus", "renomeie o arquivo estatua para Estátua da praça" e "apague o arquivo da estátua" (em uso: o Claude recebe o aviso e só apaga com a confirmação).

## AU3 — caixas lógicas e o tour das automações

1. **Caixa OU.** Botão **Automações** → **+ Nova automação**. Arraste **OU (qualquer um)** da paleta (grupo Lógica) para a grade: nasce com **dois espaços**, um em cima do outro, com o rótulo "OU" no meio e um "+" no pé. Arraste um **Relógio** para o espaço de cima e um **Ao apertar um botão** ("Combate") para o de baixo. A **saída** da caixa (bolinha da direita) liga ao próximo bloco. Confira "Em português:": "Quando qualquer um destes acontecer (a cada 3 min, ou ao apertar o botão “Combate”)…". Salve e aperte o botão (mesa de eventos): roda.
2. **Crescer e encolher.** Clique no **+**: a caixa ganha um espaço vazio (com um **×**, que o tira de volta; o mínimo é 2). Arraste uma peça para **entre dois espaços** ou para logo abaixo do último: abre um espaço novo ali (a faixa verde mostra onde). Tire uma peça de uma caixa de 3 ou mais espaços: o espaço some. O **NÃO** tem um espaço só e nenhum "+".
3. **E, NÃO e caixa dentro de caixa.** Arraste **E (todos)** e, num espaço, uma caixa **NÃO** com a condição **Token de jogador**; no outro, **Chance**. Ligue a saída da E à entrada de condição de um **Se**. Clique no rótulo "E" entre os espaços: vira "OU" (e de volta); com um gatilho e uma condição na caixa, trocar para OU é recusado. Confira a frase ("(NÃO o token for de um jogador) e o sorteio de 50% der certo").
4. **Combinações.** **Gatilho E condição** (o botão e uma Chance de 0%): ao apertar, não acontece nada; com 100%, acontece. **Ação E ação** (dois "Avisar no chat" nos espaços, ligada de um gatilho): as duas acontecem. **Ação OU ação**: aperte várias vezes, sai só uma das duas, e as duas aparecem ao longo do tempo (sorteio 50/50).
5. **A armadilha das caixas (recusas).** Arraste um gatilho para um espaço de uma caixa E que já tem gatilho: o espaço fica com contorno vermelho e a dica "Dois acontecimentos não chegam no mesmo instante: para gatilhos, use OU."; ao soltar, o aviso fica e a peça volta. Tente também: NÃO com gatilho ou ação, ação junto de gatilho ou condição, gatilho OU condição, soltar num espaço ocupado e soltar "Esperar" ou "Se" numa caixa: cada um é recusado com a dica. Uma caixa vazia, um espaço sem peça ou um NÃO vazio aparecem com o erro no próprio bloco ao tentar salvar.
6. **Teclado.** Escolha uma peça e use o botão **Caixa…** acima dela: "Tirar da caixa", "Pôr em … espaço N" (os que não aceitam aparecem esmaecidos com o motivo), "Subir um espaço" e "Descer um espaço"; Alt + seta para cima ou para baixo faz o mesmo; o rótulo E/OU, o "+" e o "×" também se alcançam pelo teclado.
7. **Automações antigas.** Abra uma automação feita no AU2 com portas E, OU e NÃO ligadas por fios (ou com dois gatilhos no mesmo bloco, ou uma porta com três entradas): o editor mostra caixas com as peças nos espaços (a de três entradas vira uma caixa com 3 espaços), e ela faz o mesmo que antes.
8. **O tour.** Num navegador novo (ou apagando a marca `tabletop:pref:tourDasAutomacoes`), entre com uma conta e abra **Automações**: o tour abre sozinho (centro, mesa de eventos, e o último passo abre o editor). Pule em qualquer passo (Pular ou Esc): na segunda vez não abre. O botão **Conhecer as automações** (no centro e no editor) abre de novo. No editor, passe pelas peças (Quando, Fluxo, Condições, Caixas lógicas, um passo que mostra uma caixa, Faça, mesa de eventos e "Liberar aos jogadores") e monte "as tochas têm 30% de chance de apagar a cada 3 minutos", arrastando e ligando (ou com "Fazer este passo por mim"): a frase vai se completando. No fim a automação fica desligada: **Ligar agora**, **Apagar o exemplo** ou **Concluir**. Com tochas acesas e a automação ligada, ao fim de uns minutos (use "Testar agora") algumas tochas apagam.

### FG2 — fogo melhor, tocha na mão, cor da luz do mestre e som solto
1. **Fogueira.** Acenda um inflamável (fogueira): é um fogo só, com a base brilhante, as línguas juntas e as brasas subindo, sem lenha nem gravetos embaixo. Estique a chama (palha, barril, uma fogueira bem larga): continua uma massa, nunca uma fileira de chamas de tocha.
2. **Tocha no suporte.** Olhe a tocha no suporte por alguns segundos, em zoom alto: a chama treme, mas é uma só em todos os momentos (nunca se divide em duas). Veja nos três estágios (adiante o relógio da mesa).
3. **Tocha na mão.** No token com uma tocha acesa, o pino do canto é uma chama animada pequena (e não mais o selo laranja). Com o tempo ela vira a chama fraca e depois a que está morrendo, igual à do mapa. Uma lanterna acesa continua com o ícone; apagada, o pino volta ao contorno cinza. Se o modelo tiver um gif para o estágio, é ele que aparece.
4. **Cor da luz para o mestre.** Em Mesa, Luz, mude a cor e a luz plena da tocha: o mestre vê, na hora, o mesmo tom e o mesmo alcance que o jogador vê (e continua enxergando o que está no escuro, mais apagado). Pendure uma tocha numa sala que nenhum jogador vê: o mestre vê a cor e o alcance dela sobre o mapa apagado. Mude de novo e confira nos dois.
5. **Token que o mestre não movia.** Com o mapa bem afastado (zoom baixo) e um token com tocha na mão, arraste o token pelo meio: ele anda. O pino da tocha só pega no canto, fora do miolo do token; o arrasto da tocha para o suporte ou para outro token continua igual.
6. **Som arrastado.** Arraste um mp3 (ou vários) do computador para qualquer lugar da mesa: o aviso diz "Adicionada à biblioteca de música" e o botão "Abrir a biblioteca" abre a lista com a faixa (nome do arquivo, sem etiquetas). Como jogador, o mesmo gesto só mostra "Só o mestre põe música na mesa." Na lista "Assets da mesa", arraste um som para o mapa: ele entra na biblioteca; o botão "Pôr na mesa de som" continua pondo como ambiente.
