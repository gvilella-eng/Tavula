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

## Se algo der errado
- Anote a tela, o que fez e o que esperava, e mande para mim. Bug confirmado vai para `docs/BUGS.md`.
- Para voltar à campanha de antes de mesas e contas, use a cópia de segurança indicada no topo.
