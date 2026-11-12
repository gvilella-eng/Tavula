/**
 * Os textos que explicam os controles e as áreas da tela, lidos pelo tour de introdução (`tour/passos.ts`). Desde o
 * V3b a dica no mouse tem uma linha só (nome e atalho); a explicação que ficava na segunda linha mora aqui, por id
 * do controle (o `data-testid` do botão), num lugar só. Os passos que não são de botão (o mapa, o painel da
 * direita, a ficha) têm a chave do `data-testid` da área, ou do id do passo quando o mesmo alvo tem dois textos.
 * Cada passo do tour mostra 1 a 2 frases.
 */
export const TEXTOS_DO_TOUR: Readonly<Record<string, string>> = {
  // Barra de ferramentas (à esquerda do mapa)
  "ferramenta-selecionar": "Seleciona tokens e os move; dois cliques abrem o painel do token.",
  "ferramenta-mao": "Arrasta o mapa. Com qualquer ferramenta, segure Espaço.",
  "ferramenta-regua": "Mede a distância no mapa. Shift ao soltar deixa a medida na tela.",
  "ferramenta-dados": "Rola dados no chat. Shift ao clicar rola oculto (mestre).",
  "ferramenta-pincel": "Desenha formas e traços para todos; borracha e seleção.",
  "ferramenta-paredes":
    "Desenha as paredes que bloqueiam a luz, em meia célula e em qualquer direção. Aperte A para trocar linha e arco; clique de novo na ferramenta para sair.",
  // Sub-barra do pincel
  "pincel-desfazer": "Apaga o meu desenho mais recente desta cena.",
  "pincel-selecionar": "Seleciona desenhos para mover ou apagar.",
  "pincel-borracha": "Apaga o desenho inteiro que tocar.",
  "pincel-preenchido": "Preenche o retângulo e o círculo.",
  // Menu do mestre (topo)
  "menu-cenas":
    "Abre a faixa de cenas: trocar de cena, levar o grupo, criar e configurar (nome, mapa e grid).",
  "menu-camadas":
    "Escolhe em que camada você trabalha (mapa, tokens, mestre ou desenho) e limpa os desenhos.",
  "novo-token": "Pede o nome, a cor e o tamanho; depois você clica no mapa para pôr o token.",
  "menu-visao-noturna":
    "Liga: você vê a cena iluminada só pelas fontes de luz, com os contornos de paredes e portas. Desliga: cena toda clara, sem os contornos. Só na sua tela.",
  "menu-iluminacao":
    "Liga e desliga a iluminação dinâmica, abre as fontes de luz e os ajustes. Desligada, os jogadores veem tudo.",
  "menu-ordem-turno": "Mostra ou esconde a ordem de turno para todos.",
  "menu-ver-como":
    "Vê a mesa pelos olhos de um jogador (o que ele enxerga e controla). Só na sua tela.",
  "lanterna-modelos": "Abre a aba Mesa na seção dos modelos de tocha e objetos de luz.",
  // Relógio e pausa
  "menu-pausa": "Pausa a mesa e congela o tempo das tochas; de novo, retoma.",
  "menu-relogio": "Zerar o relógio da mesa.",
  // Ordem de turno
  "ordem-anterior": "Volta ao turno anterior (da primeira entrada, à última da rodada anterior).",
  "ordem-encerrar":
    "Esvazia a lista e zera a rodada (pede confirmação); fechar a janela não apaga nada.",
  "ordem-ordenar":
    "Ordena pela iniciativa (maior primeiro; empate: Destreza, jogador antes de NPC, nome).",
  "ordem-proximo":
    "Passa para o próximo turno (o primeiro abre a rodada 1; a rodada muda quando a lista dá a volta).",
  // Janelas, painel, fichas e handouts
  "janela-cabecalho": "Arraste pelo cabeçalho. Dois cliques minimizam ou restauram.",
  "janela-minimizar": "Mostra a janela inteira de novo, ou deixa só a barra do título.",
  "alca-do-painel": "Arraste a borda do painel.",
  "ficha-abrir": "Arraste para o mapa para pôr o token. Botão direito: mais ações.",
  "handout-abrir": "Botão direito: mais ações.",
  "handout-mostrar": "Abre este handout na tela de quem pode vê-lo, agora.",
  "presenca-mais": "Abre a lista de quem está na mesa.",
  "regua-fixar": "Deixa esta medida na tela (Shift ao soltar faz o mesmo). Esc tira.",
  "regua-fixa-rotulo": "Clique para tirar esta medida.",
  // Editor, compêndio e mesa
  "ficha-exportar":
    "Salva a ficha em JSON (na pasta fichas/ se houver pasta; senão baixa o arquivo).",
  "editor-importar": "Troca a ficha por uma exportada em JSON.",
  "editor-importar-pdf":
    "Lê o PDF impresso da ficha (no seu navegador) e mostra uma tela de revisão antes de trocar a ficha.",
  "personagem-colocar": "Põe o token na cena que você está vendo.",
  "compendio-usar-exemplo":
    "Põe 3 magias do SRD 5.1 (Bola de Fogo, Mísseis Mágicos e Detectar Magia) como compêndio da mesa.",
  "compendio-recarregar": "Ler de novo o magias.json da sua pasta.",
  "modelo-apagar": "Só se nenhum objeto, mochila ou ponto usa este modelo.",
  "ordem-rodada": "A rodada atual.",
  "cena-nome": "Duplo clique para renomear.",
  "ficha-pasta-nome": "Clique para renomear (F2).",
  // Passos do tour que não são de botão (o alvo é uma área da tela)
  "tour-mestre-boas-vindas":
    "Esta é a sua mesa. Aqui está o id: quem tem o id ou o link pede para entrar, e você aceita.",
  "barra-ferramentas":
    "Selecionar, mão, régua, dados rápidos e pincel. As letras V, H e R trocam de ferramenta.",
  "menu-grupo-luz":
    "Ligue a iluminação para os jogadores verem só o que a luz alcança. A Visão do mestre mostra, só na sua tela, a cena iluminada como eles a veem.",
  "tour-mestre-fichas":
    "Crie personagens, NPCs e handouts aqui. Arraste uma ficha para o mapa para pôr o token dela.",
  "tour-mestre-compendio":
    "Traga as magias da sua pasta ou use o exemplo do SRD. Arraste uma magia para a ficha de um personagem para ele aprendê-la.",
  "tour-mestre-chat":
    "O chat guarda as conversas e as rolagens, inclusive os sussurros. Os dados rápidos ficam na barra da esquerda; Shift ao clicar rola oculto.",
  "mesa-secao-contas":
    "Quem pede para entrar aparece aqui para você aceitar e, se quiser, ligar à ficha dele. Também dá para aprovar senhas esquecidas e proteger a conta do mestre.",
  "tour-jogador-boas-vindas":
    "Vamos ver o essencial em poucos passos. Use as setas do teclado para andar e Esc para pular.",
  "area-do-mapa":
    "Este é o mapa. Arraste o seu token para andar; a roda do mouse dá zoom e, com Espaço apertado, você arrasta o mapa.",
  "tour-jogador-ficha":
    "Aqui ficam as suas fichas. Abra a sua para ver atributos e magias e rolar os dados dela.",
  "tour-jogador-chat":
    "Converse com a mesa e veja as rolagens de todos. Os dados rápidos ficam na barra da esquerda.",
  "tour-jogador-preferencias":
    "Escolha o tema de cores e ligue ou desligue as dicas ao passar o mouse. Aqui também dá para refazer este tour.",
};
