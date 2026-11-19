# Ideias e notas

Ideias levantadas no planejamento que **ainda não viraram plano**, ideias **descartadas** (para não
voltarem) e notas sobre a campanha de referência. Quando algo for decidido, sai daqui e vai para o
`PROJETO.md`.

## Em avaliação

### Ordem e escopo dos lotes

- **Deploy mínimo cedo.** Sem servidor acessível de fora, o Marco B só dá para jogar com todos na mesma
  casa. Ideia: um deploy mínimo, com acesso protegido, logo depois do Lote 7b, e jogar antes das
  fichas.
- **Lote 11 antes do 9.** A iniciativa não depende da ficha (o bônus pode ser digitado).
- **Lote 10 como script avulso.** São umas 7 fichas, uma vez só: um script que converte cada PDF em
  JSON, com revisão à mão, pode custar bem menos que um importador com tela de revisão dentro do app.
- **Handouts e som ambiente mais cedo**, perto do Lote 7. A campanha de referência depende muito de
  documentos (caderneta, diários, cartas, plaquetas de lote) e de som (foles, sino). Os dois
  reaproveitam o esquema de assets locais.

### Mapas e paredes

- **Névoa manual:** virou o lote N4 (2026-11-14), entregue; ver `docs/REDESIGN.md`, "N4".

Desenhar paredes à mão em mapas de caverna (formas orgânicas) é o custo escondido de cada sessão.

- **Exportar da Masmorra** (projeto 3D da campanha, `../Dungeon`): um `--export-tabletop` que corta o
  mundo SDF na altura dos pés, gera a imagem vista de cima e extrai o contorno das paredes (marching
  squares + simplificação), com os POIs virando notas do mestre. As convenções já batem (metros,
  1 quadrado = 1,5 m, −Z = norte). A integração seria só por arquivo (de preferência `.uvtt`, que a Távola já importa desde o Q3), sem
  ligar os projetos. Exceção: o Poço do Eco (espiral de ~160 m de queda) precisa de mapas por altura.

### Tour de introdução (combinado com o Vilella, 2026-11-11; depois do V5)

O Vilella achou as dicas no mouse demais ("tudo tem tooltip, tá um saco"). Ficou combinado:
- **Feito (lote V3b, 2026-11-11):**
  - dica só em botão só de ícone, numa linha (nome e atalho), com 700 ms de atraso;
  - opção em Preferências para desligar as dicas;
  - os textos explicativos saíram das dicas e estão guardados em `apps/web/src/textosDoTour.ts` (`TEXTOS_DO_TOUR`,
    por `data-testid` do controle; ainda nada o lê). O tour deve usá-lo e acrescentar ali os passos que não são de botão.
- **Feito (lote T, 2026-11-12; ver `docs/REDESIGN.md`):** um tour de introdução:
  - no primeiro acesso, com "Pular", e "Fazer o tour de novo" nas Preferências;
  - a tela escurece e só a opção do passo fica iluminada, com um cartão curto: Voltar, Próximo n/N e Pular;
  - funciona pelo teclado;
  - um tour do mestre (~10 passos) e um do jogador (~6);
  - feito no próprio app, sem biblioteca;
  - um teste confere que cada passo ainda acha a sua opção.

### Tela inicial, criar mesa e contas por mesa (proposta do Vilella, 2026-11-11; em avaliação)

Substitui a "Autenticação em desenvolvimento" (PROJETO 4.6, escolher entre os usuários fixos) quando a mesa for
para a internet. Ele pediu opinião, não implementação.

- **Tela inicial** simples, na identidade visual, com duas áreas: "Entrar numa mesa" (id ou link → `/<id>`) e
  "Criar mesa".
- **Jogador**:
  - entra pelo link, escolhe um nome e uma senha (mais de 4 caracteres), confirma e aceita os termos;
  - o mestre recebe um pedido de entrada, aceita ou recusa e vincula a pessoa a um jogador (o "Jogador N" ganha
    o nome dela);
  - a conta vale só naquela mesa;
  - se esquecer a senha, pede a redefinição e o mestre aprova.
- **Mestre**:
  - cria a mesa com usuário, senha e confirmação, e escolhe ou cria uma **pasta local da mesa** no Windows;
  - a pasta guarda a prova de que ele é o mestre, que permite recuperar o acesso se esquecer a senha, e os
    assets de todos (para carregar o token de quem faltar).
- **Termos de uso**: checkbox no login, com link para um PDF sobre o que fica no servidor e o que fica local.

Avaliação (Claude):
- **Viável** no desenho de hoje: uma sala (Durable Object) por id, e o servidor nunca manda credencial ao
  cliente.
- **Senhas**: o servidor guarda só o hash. Por causa do limite de CPU do plano grátis (10 ms), o
  estiramento caro da senha roda no navegador (PBKDF2/Argon2) e a sala guarda um hash rápido com sal do
  resultado. Limite de tentativas por mesa e por IP, porque 5 caracteres é pouco.
- **Prova do mestre na pasta**: um par de chaves (WebCrypto). A chave privada fica num arquivo da pasta, a
  pública na sala, e a recuperação é por desafio e assinatura, sem a chave viajar. Mais um **código de
  recuperação** para anotar, para a pasta não virar o único caminho.
- **Riscos**:
  - a pasta só funciona em Chrome e Edge (File System Access, que já é exigência das imagens locais);
  - a redefinição aprovada pelo mestre pode ser enganada por alguém se passando por jogador, então o mestre
    confirma por voz ou mensagem;
  - o id da mesa deve ser longo e aleatório (ou código amigável de ~12 caracteres), mesmo com a aprovação na
    entrada.
- **Migração**: os usuários fixos de hoje viram as vagas de "Jogador N". A campanha atual continua; o mestre
  vincula cada conta à vaga que já tem as fichas.
- **Encaixe no plano**: um marco novo depois do V5, "Mesa na internet":
  1. tela inicial, criar mesa, ids e várias mesas no mesmo servidor;
  2. contas por mesa, pedidos, sessões e recuperação, mais os termos;
  3. pasta do mestre, com chave e assets por jogador;
  4. deploy.

Decidido pelo Vilella (2026-11-11), para levar ao PROJETO quando o marco for planejado:
- **Id da mesa**: código amigável de ~12 caracteres aleatórios, agrupado para ditar (por exemplo
  `k7m2-qx9p-4tdn`), em vez de hex.
- **Código de recuperação do mestre**: sim, além da pasta local. É mostrado uma vez na criação da mesa.
- **Toda entrada passa pelo mestre**: não existe convite que dispense a aprovação, nem um link ligado a uma
  vaga.

Planejado em 2026-11-12 como marco C1–C3 (PROJETO 4.14). O C1 (várias mesas, ids, tela inicial) está entregue.

### Conjuração (depois do N2, 2026-11-14)

A conjuração inata, os truques por nível, o ritual e os dardos, raios e alvos por nível entraram no N2. Sobram, de propósito:

- **Um acerto por raio** (Raio Ardente, Rajada Mística): hoje o acerto é um só e o dano sai por raio.
- **Vários grupos "N/dia"** no mesmo bloco e **ler o texto do monstro** ("À vontade: luz, mãos mágicas") para preencher a inata sozinha.

### Compêndio e mesa de som (Vilella, 2026-11-16)

- **Imagens e tokens para cada monstro e item do compêndio.** Nas palavras dele: "Uma coisa que eu acho que seja um
  problema, mas podemos resolver mais pra frente, é a criação de imagens e tokens para cada um dos monstros e itens da
  lista. Mas deixamos para um futuro." Gerar ou associar arte própria a cada entrada (nunca arte da WotC), para o
  monstro virar token sem o mestre procurar imagem.

### Desempenho: auditado e não feito (2026-11-17, branch `otimizacoes`)

A auditoria dos lotes O1–O4 (ver `ESTADO.md`) achou mais do que entrou. Ficou de fora o que tinha risco de mudar
comportamento, pedia mudança de protocolo ou migração, ou só compensa depois de medir. Fora o que está marcado como
medido, são estimativas por leitura do código. Antes de fazer qualquer item, medir com `pnpm --filter @tabletop/e2e
medidas` (antes e depois, com `MEDIDA_PERFIL=1` para o perfil por componente).

- **Interface** (o lote O5 fez as abas em `memo` com fatias, o compêndio lido uma vez por hash e a validação única
  por tecla; ver `ESTADO.md`. O que segue foi medido com `e2e/prints/desempenho.spec.ts`)
  - **Escrever na ficha:** feito no Q14 (ver `ESTADO.md`): a ficha compartilha estrutura, as seções das abas
    Personagem e História estão em `memo` com fatias e o balão da dica só monta quando aparece. Sobra: a aba Magias e
    o bloco do NPC ainda redesenham inteiros a cada tecla (o `secao` de `ficha/secoes.tsx` serve) e o cabeçalho da
    `JanelaDaFicha` (abas, nome, vantagem).
  - **O resto da Mesa a cada evento:** fora as abas, a `Mesa` (um componente com dezenas de estados) ainda
    re-renderiza topo, barras e janelas a cada evento da sala. O mesmo desenho das fatias serve para a janela da
    ficha, a ordem de turno, a faixa de cenas e os painéis de luz e som.
  - A aba Fichas ainda re-renderiza a cada mudança de `tokens` (botão "colocar no mapa" do jogador); todas as abas, a
    cada ficha editada (leem `personagens`).
  - Compêndio lido num Worker (a leitura única por hash ainda roda na thread principal).
  - Régua, zoom e dica do mapa fazem `setState` na Mesa a cada movimento do mouse; levar para um componente folha.
    `PertoDoPonto` mede o layout a cada render.
  - `lazy` dentro da Mesa (Tour, editor de automações, revisão do PDF) e `manualChunks`.
- **Mapa**
  - Prévias de ponteiro (névoa, paredes, laço) uma vez por quadro, não por evento.
  - `definirCena` refaz tudo quando só a névoa mudou.
  - Tremulação da luz refaz a geometria a ~11 Hz; token com imagem usa uma máscara por token; texturas de cenas
    anteriores nunca são liberadas; a névoa re-renderiza todos os traços a cada traço novo.
  - A imagem da memória do mapa é refeita por quadro enquanto a fonte anda (pesa em mapas muito grandes).
- **Sala**
  - Chat em memória entre rodadas (hoje a primeira página só é reaproveitada dentro de uma rodada de snapshots).
  - Diário do Claude regrava o lote inteiro a cada passo; o motor de automações clona a fatia a cada intenção.
  - Acordar da hibernação relê e valida até 2000 mensagens do chat.
  - Ficha e névoa viajam e são gravadas inteiras a cada edição: mandar só a diferença pede evento novo no
    protocolo (ficha) ou migração (névoa).
- **Geometria**
  - Polígono de visão sem corte por alcance quando a visão é ilimitada: custo cresce com o número de paredes. Risco
    alto (os testes fixam os valores).
  - `marcarVisto` testa ponto-em-polígono por célula; daria para rasterizar por varredura.

**Decidido não fazer:** tirar a validação zod das mensagens no navegador (ela aplica os valores padrão; sem ela os
dados mudam de forma).

## Descartadas (não propor de novo)

- **Imagens no servidor** (R2 ou similar): imagens locais são a premissa e o diferencial do projeto.
- **Regra baseada no relógio do PC do jogador**: o tempo é da sala (princípio 6).
- **Mecânicas da campanha no código**: a mesa é genérica (princípio 9).
- **Esconder da rede o que está fora da visão** (proteção contra o F12 por linha de visão): o Vilella
  decidiu em 2026-11-06 que não vale o custo. Visão e escuridão são só de tela; o filtro na sala fica
  para o que o mestre esconde de propósito.

- **Mapa revelado aos poucos** (mandar o mapa em tiles só conforme a exploração, para quem fuça o
  navegador não ver salas ainda não exploradas): o Vilella disse que os jogadores não vão fuçar o F12
  (2026-11-14, no N4). A névoa manual só esconde na tela; o que está sob ela chega ao navegador.

## Campanha de referência ("A Chama Primordial")

As notas ficam só no computador do mestre, em `privado/notas/campanha.md` (a pasta `privado/` não entra no
git).

## Depois da música da mesa (MU1, 2026-11-19)

- **Arrastar a barra de progresso** para mudar o ponto da música: hoje só mostra; "próxima" e "anterior" movem de música em música.
- **Música por cena ou por zona**: ligar um botão de música ao levar o grupo para uma cena (como os ambientes da cena) ou ao entrar numa zona.
- **Adicionar música pelo Claude**: o MCP etiqueta e toca, mas não adiciona, porque a duração só o navegador do mestre lê ao importar. Dá para resolver lendo o cabeçalho do mp3 na sala (sem decodificar), se o Vilella quiser.
- **Importar uma pasta grande em segundo plano**: hoje a pasta entra arquivo por arquivo com um aviso de andamento; uma pasta de centenas de músicas pede paciência (cada arquivo é lido e registrado).
- **Descrição, energia e etiquetas na própria linha** (editar sem a barra de lote), e etiquetas sugeridas pelo nome da pasta de cima da pasta.
- **Playlist fixa** (uma ordem escolhida à mão, sem sorteio) e **repetir uma música**: o desenho só pediu aleatória sem repetir e crescente.
- **Prévia só para o mestre sem cortar os efeitos**: o play de conferência de cada linha usa o motor de efeitos; ligar outra conferência corta a anterior.
- **Energia como curva da sessão**: um botão que sobe e desce a energia em ondas, em vez de só subir.

## Depois da chamada da mesa (CH1, 2026-11-19)

- **Transcrição da chamada com Whisper** (lote seguinte, já pedido): rodar no computador de cada pessoa (nada sai dele), com consentimento claro na entrada; o texto vira notas da sessão. **Neste lote nada é gravado**, nem áudio nem texto.
- ~~**Trilha da mesa com playlist**~~: feito no MU1 (4.16 do `PROJETO.md`): a música da mesa tem biblioteca, botões, ordem aleatória ou crescente, e o quadro "Trilha da mesa" mostra a música e dá Pausar e Próxima ao mestre.
- **Compartilhar tela** na chamada fica de fora por ora (o mapa já é compartilhado pela própria mesa).
- **Mais de 8 pessoas** pediria um servidor de mídia (SFU) em vez da malha ponto a ponto; só vale a pena se a mesa crescer.
- **Servidor TURN próprio** para jogar pela internet atrás de roteadores difíceis (STUN/TURN já são configuráveis por `VITE_CHAMADA_ICE_SERVERS`).
- **Desfoque com imagem de fundo** (trocar o fundo por uma imagem da cena) usa a mesma segmentação.
