# O mapa, a luz e a visão

O mapa é a tela principal da mesa: um canvas WebGL (PixiJS v8) onde o mestre e os jogadores veem a cena, movem tokens, medem distâncias, desenham, apontam um lugar com o ping e, sobretudo, **só enxergam o que a luz e as paredes deixam**. Este arquivo explica o mapa de ponta a ponta: as camadas do Pixi, os tokens e o arrasto, as paredes e a linha de visão, a luz e a visão no escuro, a memória do mapa, a névoa, a `CamadaDeLuz`, as chamas animadas, os objetos de luz (tochas), os desenhos, a régua, o ping, as zonas, os tiles e o que custa caro no desempenho.

Uma regra atravessa tudo: **a visão e a luz são só de tela**. A sala (o Durable Object) guarda paredes, luzes, tokens e a névoa pintada à mão; quem calcula "o que este jogador vê" é o navegador dele, a cada mudança. A sala só intervém em dois pontos de sigilo: não manda ao jogador o que ele não pode saber (parede secreta, token oculto, luz de goblin escondido) e recusa um movimento que atravessa parede.

## Onde fica

Navegador (`apps/web/src`):

- `mapa/mapaPixi.ts`: a classe `MapaPixi`, o controlador imperativo do Pixi (cerca de 6.500 linhas). Cria a `Application`, as camadas, trata ponteiro e teclado, desenha tokens, paredes, zonas, régua, pincel, ping, alças de tocha, e orquestra a visão e a memória.
- `mapa/Mapa.tsx`: a ponte React ↔ Pixi. Cria o `MapaPixi` uma vez e empurra dados (`definirCena`, `definirTokens`, `definirParedes`, `definirLuzes`...) e opções (`definirOpcoes`).
- `mapa/camadaDeLuz.ts`: `CamadaDeLuz`, as texturas de luz e escuridão (modos `jogador` e `noturna`).
- `mapa/camadaDeNevoa.ts`: `CamadaDaNevoa`, a névoa pintada à mão (N4).
- `mapa/memoriaLocal.ts`: `ArmazemDeMemoria`, a memória do mapa no IndexedDB.
- `mapa/chamas.ts`: o fogo animado (`montarQuadro`, `gerarPadrao`, `decodificarAnimacao`, `ChamasDoMapa`).
- `mapa/camadaDeDesenho.ts`: `CamadaDeDesenho`, os traços do pincel.
- `camadas.ts`: a "camada de trabalho" do menu do mestre (`CamadaDeTrabalho`).
- `arrasto.ts`: o estado de módulo do item das Fichas que está sendo arrastado (V10b).
- `Mesa.tsx`: calcula a `ConfigDeVisao` (`visaoCalculada`) e as opções do mapa; é quem decide se o modo é `jogador`, `noturna` ou `claro`.

Núcleo puro, testado (`packages/shared/src`):

- `visao.ts`: `poligonoDeVisibilidade`, `pontoNoPoligono`, `pontoNaUniao`.
- `paredes.ts`: `bloqueiaVisao`, `bloqueiaPassagem`, `trajetoBloqueado`, `paredeParaJogador`, `alternarPortaDoJogador`, e a geometria de arcos (`segmentosDaParede`, `arcoPorTresPontos`, `meioDoArcoTangente`).
- `luz.ts`: `raiosEfetivos`, `resolverLuzes`, `luzVisivelPara`, `visaoNoEscuroDe`.
- `iluminacao.ts`: `calcularModelo`, `CacheDeLuz`, `nivelDeLuz`, `visaoNoPonto`, `veNoPonto`.
- `memoria.ts`: a grade de memória (`marcarVisto`, `esquecerAlemDoAlcance`, `imagemDaMemoria`).
- `nevoa.ts`: os traços da névoa (`pontoNaNevoa`, `acrescentarTraco`, `compactarNevoa`, `simplificarCaminho`).
- `relogio.ts` e `objetos.ts`: o tempo da sala, `estagioDe`, os modelos e `objetoParaVisao`; `tochas.ts`: as intenções de acender, entregar, pôr no suporte.
- `desenho.ts` e `desenhonucleo.ts`: o modelo e as regras dos desenhos; `ping.ts`; `zonas.ts`; `mapa.ts` (régua, encaixe no grid, `suavizar`, `tokenVisivelPara`, `podeMoverToken`).

## Como funciona

### A pilha de camadas do Pixi

O mapa é um `Container` chamado `mundo`, que sofre pan (posição) e zoom (escala). O tamanho de mundo é fixo: **40 pixels por metro** (`PX_POR_M`), e o zoom vai de 0,1 a 4 (`ZOOM_MIN`, `ZOOM_MAX`). Tudo o que está dentro de `mundo` é desenhado em pixels de mundo; coordenadas de cena são sempre em metros e só viram pixel na hora de desenhar. A ordem de baixo para cima, como está em `MapaPixi.iniciar`:

```
fundo                     retângulo da cena (cor sólida) com borda
camadaMapa                os sprites do mapa (um por tile)
grade                     linhas do grid (opcional)
camadaCenario             tokens da camada "mapa" (cenário, imagens soltas do cenário)
camadaTokens              tokens da camada "tokens"
camadaMestre              tokens da camada "mestre"
camada.multiplicar        luz/escuridão (blend multiply)   --\
camada.brilho             brilho de 10% (blend add)          |  CamadaDeLuz
camada.cinza              visão no escuro (blend saturation)-/
paredesAbaixo             portas que o jogador vê (só aparecem onde ele enxerga)
paredesAcima              paredes e portas do mestre + ferramenta de paredes
zonasGraf / zonasRotulos  zonas (só o mestre)
desenhoLayer              desenhos do pincel
camadaNevoa               névoa pintada à mão
nevoaPrevia               prévia do traço de névoa
marcasDeLuz               marcas das luzes (mestre, com o painel de fontes aberto)
desenhoDosPontos          ícones de ponto de luz, anel de acender
alcasDaImagem             alças da imagem solta selecionada
camadaDeAlcas             pinos de tocha e objetos de luz (acima do véu)
areaDaBandeira, bandeira  ponto de chegada do grupo
desenhoDasFixas, desenhoDaRegua, previaDoToken, lacoGraf, camadaDePings
```

A lógica por trás da ordem: tudo o que é **conteúdo do mundo** (mapa, tokens) fica sob o véu de luz; tudo o que é **ferramenta ou informação que precisa ser vista mesmo no escuro** (desenhos, régua, ping, pinos de tocha, bandeira, névoa) fica acima dele. Os desenhos do pincel, por exemplo, aparecem também onde o jogador não enxerga: é intencional (Lote 13; ver o comentário em `CamadaDeDesenho`).

A `Application` é criada com `preference: "webgl"`, `antialias`, `autoDensity`, `resolution = devicePixelRatio`, `useBackBuffer: true` (necessário para o blend `saturation`, que lê o que já foi desenhado) e `autoStart: false`. O desenho é **sob demanda**: o laço `requestAnimationFrame` (`laco` → `passo`) roda sempre, mas só chama `app.render()` quando algo marcou `this.sujo = true`. Várias abas abertas não fritam a CPU.

### O laço: `laco` → `passo`

A cada quadro, `passo` faz, nesta ordem: anima tokens (`animar`), expira passos pendentes, anima pings, a câmera de centralização, o "seguir" token, os anéis de contagem, ajusta as marcas ao zoom, anima imagens e chamas, **recalcula a visão se estiver suja**, processa a memória do mapa, faz a luz tremular (só o brilho) e, por fim, renderiza se `sujo`. Um erro de desenho não derruba o laço: `laco` faz `try/catch` e loga, senão o mapa congelaria em silêncio.

### Dados entram pelo React, intenções saem por `retornos`

`MapaPixi` nunca fala com a sala. Ele recebe dados e opções do React e chama `retornos()` (`mover`, `soltar`, `alternarPorta`, `criarParedes`, `pingar`, `criarDesenho`...). Quem traduz isso em intenção para a sala é a `Mesa.tsx`. Isso mantém o mapa testável e o protocolo num lugar só. As opções são muitas; `QUEM_LE_A_OPCAO` (um `Record` exaustivo) classifica quais refazem as paredes, as marcas de luz ou nada (ver "Desempenho").

## Tokens, seleção e arrasto

### O visual de um token

`criarVisual` monta um `Container` por token: o corpo (círculo com a cor, ou imagem recortada por uma máscara circular), as iniciais, a pílula do nome, a barra de vida (Q11), a borda colorida, o X de "morto" (N1), o olho cortado do oculto, os marcadores de condição e o anel de seleção. Tokens que são **imagem solta** (`token.imagem`, AS1) usam `criarVisualDeImagem`: retângulo girado, sem encaixe nem parede.

O visual só é refeito quando muda a `chaveDe(token)` (nome, cor, tamanho, camada, imagem pronta, marcas, borda, se há barra de vida...). A vida em si **não** entra na chave: a barra é redesenhada à parte (`atualizarBarras`). Se um campo novo do token muda o desenho, tem de entrar em `chaveDe`, senão o token fica velho na tela.

A camada de cada token é um `Container` diferente (`camadaDe`): `mapa` (cenário), `tokens` ou `mestre`. Ao mestre, `selecionavel(t)` só deixa pegar tokens da **camada de trabalho** escolhida no menu (`CAMADAS_DE_TRABALHO` em `camadas.ts`: Mapa, Tokens, Mestre, Desenho). "Desenho" não é camada de token: só escolhe a entrada do menu; os desenhos do pincel aparecem sempre. O jogador só seleciona e move o que `controla`.

### Acertar o clique: `tokenEm`

`tokenEm(p)` converte o ponto da tela para metros e percorre os visuais num laço só. Vence o de maior "peso" de camada (mestre 2, tokens 1, mapa 0) e, no empate, o último desenhado. O alvo tem no mínimo 12 px de tela, para um token pequeno com o mapa afastado continuar clicável. A imagem solta usa o referencial girado dela (rotaciona o ponto antes de comparar).

### O arrasto de um token

O gesto `token` (em `aoApertar`) guarda o deslocamento entre o clique e o centro, a origem, e um **limitador de envio** (`criarLimitador` em `packages/shared/src/limitador.ts`): no máximo uma posição a cada 50 ms (20/s, o orçamento do plano grátis), com o último valor sempre saindo (trailing). Ao mover (`aoMover`):

1. calcula o alvo = ponteiro + deslocamento;
2. encaixa no grid (`encaixarNoGrid`; Alt inverte o encaixe) e limita à cena (`limitarNaCena`);
3. se **não** é o mestre e não é imagem, testa `trajetoBloqueado(origem, alvo, paredes)`; se bloqueia, o token simplesmente não avança (fica onde ainda podia estar);
4. se há seleção múltipla (Q11), todos andam com o mesmo deslocamento, e o grupo encosta na borda sem se desmanchar;
5. enfileira o envio `token.mover` (só `movendo`, efêmero).

Ao soltar, o `token.soltar` sai na hora, fora do limitador. Alt ao pegar (mestre, Q10) arrasta uma **cópia**: o original volta, a cópia nasce onde se soltou.

A sala confere de novo o `token.soltar` com a mesma função `trajetoBloqueado` (em `nucleo.ts`, `token.soltar` e `tokens.mover`, este último o pedido da seleção inteira) e devolve `trajeto_bloqueado` se atravessa parede. A regra da tela e a da sala são a mesma função pura, então não divergem; a tela só adianta o "não anda" para o jogador não ver o token ir e voltar.

### O movimento dos outros: interpolação e passo linear

Posições de outros chegam como `token.movendo` (a cada 50 ms) e `token.movido`. O visual guarda `x, y` (o que se desenha) e `alvoX, alvoY` (para onde vai). Em `animar`, três modos:

- sendo arrastado por mim: `x = alvoX` direto, sem suavizar;
- passo curto (seta, eco da sala, volta de recusa; até 2,5 quadrados, `MAX_QUADRADOS_DE_PASSO`): desliza em **linha reta e velocidade constante** (`vel`, `avancarEmLinha` em `passoDasSetas.ts`; um quadrado a cada 100 ms), chegando para seco. Veio do Q13: segurar a seta andava aos soquinhos porque a suavização exponencial freia em cada quadrado;
- deslocamento grande (arrasto de outro, "Levar o grupo"): `suavizar(atual, alvo, dt, 45 ms)`, a interpolação exponencial de `mapa.ts`.

`posicoesAvisadas` e `passosPendentes` existem porque o estado do React só recebe os `token.movido` a cada 300 ms (para a `Mesa` não se redesenhar a cada passo): o mapa recebe cada aviso **na hora**, direto pela `Mesa`, e guarda a posição enquanto o estado está atrás. `sincronizarTokens` não reposiciona token com estado atrasado. Isto é frágil: se mexer em `sincronizarTokens`, o token "volta" um quadrado e avança de novo (o defeito do "passa e volta" do Q13).

### Os pinos: tocha na mão, objetos nos pontos

Ver "Objetos de luz e tochas" mais adiante: a alça da tocha é uma peça de interface do canvas (`camadaDeAlcas`), com seu próprio acerto de clique (`alcaEm`) e prioridade sobre o token.

### Seleção, laço e cliques

A ordem de tratamento em `aoApertar` **é** a prioridade do que o clique acerta, e importa: pan (botão do meio, Espaço ou ferramenta Mão) → botão direito (régua, parede, tocha, porta, token) → modo "pôr token" → pincel → névoa → zonas → paredes → régua → luz → ponto → marca de condição → alças da imagem → alças de tamanho da chama → alça da tocha → marca de ponto → marca de luz → **porta** → bandeira → **token** → fundo (laço de seleção do mestre). Mexer na ordem muda quem "come" o clique; por exemplo, a porta vem antes do token, então um token sobre o ícone da porta não é pego.

## Paredes e portas

Uma `Parede` tem `a`, `b`, um `meio` opcional (arco), `tipo` e `estado`. Os tipos e o que bloqueia, em `paredes.ts`:

| tipo | bloqueia visão | bloqueia passagem |
|---|---|---|
| parede | sim | sim |
| porta (fechada ou trancada) | sim | sim |
| porta aberta | não | não |
| janela | não | sim |
| invisível | não | sim |
| secreta (fechada) | sim | sim |
| secreta aberta | não | não |

`bloqueiaVisao` e `bloqueiaPassagem` são as duas funções que o resto lê. Ficam em um lugar só justamente para a visão, a luz e a passagem nunca discordarem sobre o que é uma parede.

### Sigilo da parede secreta

O jogador **nunca recebe** o tipo `secreta`. `paredeParaJogador` converte: secreta fechada ou trancada vira uma `parede` comum (sem estado); secreta aberta vira uma `porta` aberta ("ele a descobriu"). A sala só manda ao jogador as paredes da **cena ativa** (`visaoPara`, `nucleo.ts`) e, para eventos, `eventoPara` compara a versão convertida antes e depois: trancar ou destrancar uma secreta nem chega ao jogador porque a versão convertida não mudou. Em cena-cartão (V10c) o jogador não recebe parede nenhuma.

### Portas

O jogador só opera `tipo: "porta"` (a secreta responde como "não há porta aí"), destrancada, com algum token dele a no máximo **2 quadrados** do meio da porta (`alternarPortaDoJogador`, constante `ALCANCE_DA_PORTA_EM_QUADRADOS`; as coordenadas da cena são em metros, então a conta é 2 x o lado do quadrado da cena; fixo, sem configuração: decisão do Vilella no LP1). O mestre alterna qualquer porta ou secreta sem conferir alcance, e o clique direito dele no ícone tranca ou destranca (`trancarPorta`). O ícone da porta só é clicável e visível **onde o jogador enxerga** (`portaVisivel` consulta `veNoPonto` um pouco para cada lado do meio da porta: o meio fica exatamente na borda do polígono de visão, e testar só o ponto central dava falso "não vejo").

### Paredes em arco (V5)

Um arco é guardado com um ponto `meio` (um ponto da curva). `arcoPorTresPontos` acha o círculo que passa por `a`, `meio` e `b` (circuncentro; devolve `null` se os três são colineares, e então a parede é reta). A visão, a luz e a passagem **não leem o arco**: leem `segmentosDaParede`, que quebra o arco em segmentos curtos (um a cada 10°, `PASSO_DO_ARCO_GRAUS`; erro de corda de uns 0,4% do raio). Uma parede reta devolve um segmento só, igual às paredes antigas. O resultado fica num `WeakMap` por objeto-parede: o estado é imutável, então uma parede editada é um objeto novo e o cache se invalida sozinho (por isso ninguém pode mutar uma parede no lugar).

Na tela, o mestre desenha parede a parede (clique, clique, duplo clique ou botão direito encerra), com a tecla A alternando para "arco tangente" (como no SolidWorks: `meioDoArcoTangente` continua o arco tangente ao trecho anterior) ou arco de 3 pontos (início, fim, curvatura). Os pontos encaixam na rede de **meia célula** (`encaixarMeiaCelula`: 9 pontos por quadrado; Alt solta).

## O algoritmo de linha de visão

`poligonoDeVisibilidade(origem, segmentos, limites, alcanceM)` em `visao.ts` devolve o polígono do que se enxerga a partir de um ponto. É a varredura angular da Red Blob Games ("2D visibility"). O problema: com N paredes, achar o contorno da região visível sem testar um raio por grau.

Passo a passo, no código:

1. Monta uma lista plana de segmentos: os quatro lados da **cena** (limitam o resultado), mais, se há alcance, um **polígono de 32 lados** em volta da origem (`LADOS_DO_ALCANCE`; a borda do alcance é só um corte, não precisa ser fina), mais as paredes. Paredes cuja caixa está toda fora do quadrado do alcance são descartadas na hora.
2. Calcula a distância mínima da origem a cada segmento e **ordena os segmentos do mais próximo ao mais distante**. É o truque que mantém o custo baixo com centenas de paredes: ao lançar um raio, o laço **para** quando o próximo segmento está mais longe que o melhor acerto já achado.
3. Junta as **pontas** (extremos de cada segmento) com o ângulo e a distância até a origem, e as ordena por ângulo.
4. Para cada ponta (agrupando as colineares do mesmo ângulo), lança um raio exato com `lancar(a)`, que resolve interseção raio × segmento e guarda o menor `t`.
5. Só se a ponta está **visível** (o raio chegou até ela, `t >= maisPerto - 1e-6`, isto é, nada na frente), lança também dois raios vizinhos, a ±`1e-5` rad (`DESVIO`). São eles que fazem a luz "passar de raspão" pela quina e revelar o que está atrás dela. Ponta escondida atrás de outra parede não gasta os dois raios extras.
6. Ordena os acertos por ângulo e converte em pontos. O polígono sai em ordem de ângulo.

O que é frágil: (a) uma origem fora da cena devolve `[]`; (b) uma origem **exatamente sobre** uma parede (centro de token na parede) pode vazar visão por ela (aceito: tokens ficam no centro das células, é raro); (c) as tolerâncias `1e-12`, `1e-9` e `1e-6` do raio e das pontas foram escolhidas para segmentos colineares (uma parede em dois pedaços bloqueia como uma só) e quinas; mexer nelas quebra os testes de "colinear" e "quina"; (d) é preciso nunca criar `lista` com paredes de outra cena (quem chama filtra).

Testes: `packages/shared/src/visao.test.ts` (sala vazia, alcance, pilar, parede dividindo a sala, porta aberta × fechada, janela, quina, colinear, união de polígonos, e um teste de desempenho: 500 segmentos e 8 fontes em menos de 16 ms). O ESTADO registrou 5 a 7 ms para esse caso.

### `pontoNoPoligono` e a união

`pontoNoPoligono` é o teste clássico de traçado de raio (par/ímpar). `pontoNaUniao(p, poligonos)` testa se o ponto está em algum polígono: a "visão" de um jogador com dois tokens é a **união** dos polígonos dos dois. A união nunca é calculada como um polígono só; ela é feita testando o ponto em cada um, e desenhada como vários buracos no véu.

### Luz também usa a visibilidade

Uma luz é só "uma origem com alcance": `poligonosDaLuz` chama `poligonoDeVisibilidade` duas vezes (raio total e raio da luz plena). As paredes bloqueiam a luz exatamente como bloqueiam a visão: é a mesma função.

## Luz, penumbra e visão no escuro

### As regras (puras, em `iluminacao.ts`)

- Cada cena tem uma **luz ambiente** (`Cena.luzAmbiente`, 0 a 1; sem o campo vale 1, para não escurecer campanha antiga) e um **fator geral** das fontes (`Cena.fatorDeLuz`).
- `nivelDeLuz(modelo, p)` = ambiente + 0,5 por luz cujo polígono "total" contém o ponto + mais 0,5 se o polígono "claro" também o contém, limitado a 1. (`PASSO_DE_LUZ = 0.5`.)
- O nível vira classe em `classeDeNivel`: `>= 0,95` é **luz plena** (`NIVEL_PLENA`), `>= 0,45` é **penumbra** (`NIVEL_PENUMBRA`), abaixo é **escuro**. Ou seja, ambiente 0,5 já deixa a cena toda em penumbra.
- `visaoNoPonto(modelo, p)`: nada se o ponto está fora da união da visão; luz plena aparece normal; penumbra aparece mais escura **a menos que** o ponto esteja no alcance da visão no escuro (aí vira luz plena, regra do 5e); escuro aparece **cinza** dentro do alcance da visão no escuro, e some fora dele.
- `veNoPonto` é "visão ≠ nenhuma".

O resultado: o que o jogador **vê** num ponto é a interseção entre a **visão** dos tokens dele (paredes, alcance) e a **luz** (ou a visão no escuro).

### Raios efetivos

`raiosEfetivos(fonte, fatorGeral)` multiplica os dois raios da luz (`claraM` e `penumbraM`, o total é a soma) pela intensidade da fonte, pelo fator geral da cena e pelo `fatorDeRaio` dos modificadores (calculado pela sala; o jogador recebe só o fator, nunca a lista). Depois soma `somaDeRaioM` (modificadores em metros; 7b-1). Os efeitos de **zonas** (`luzRaioX`, `luzSomaM`) entram como esses modificadores com id `zona:`.

### Quem vê a luz de quem

`resolverLuzes` transforma `ObjetoDeLuz` em `LuzResolvida` (posição + raios): fixa na cena, presa a um token, na mão de um personagem (sai do token do dono), ou num ponto. A mochila não aparece. A posição do token vem de um callback (`posicaoDoToken`) para a luz seguir a posição **animada** na tela, não a do estado. `luzVisivelPara` é a regra de sigilo que a sala aplica antes de enviar: luz presa a token oculto ou da camada do mestre não chega ao jogador (a luz de um goblin escondido o entregaria).

### A visão do jogador e a configuração (`ConfigDeVisao`)

`Mesa.tsx` monta `visaoCalculada`: o `modo` (`jogador`, `noturna` ou `claro`), as `fontes` (tokens que enxergam, com `alcanceM`, `visaoNoEscuroM` e `memoriaM`) e a configuração da memória. Para o jogador, as fontes são os tokens que ele controla; para o mestre, todos os tokens de jogadores da cena. Efeitos de zonas e de automações limitam o alcance (`limiteDeVisaoDoToken`). O modo é `claro` se a cena é cartão (V10c: `visaoLimitadaNaCena`), a iluminação dinâmica está desligada, ou o mestre desligou a "Visão do mestre". O resultado é serializado em JSON e reparseado (`chaveDaVisao`) para só mudar de identidade quando o conteúdo muda; isso evita refazer a visão a cada render da `Mesa`.

## O recálculo: `recalcularVisao`

É o coração do desempenho do mapa. Roda só quando `visaoSuja`. Em ordem:

1. Se não há cena ou o modo é `claro`, esconde a `CamadaDeLuz` e só atualiza a visibilidade dos tokens.
2. Obtém os **segmentos de visão** (paredes da cena que `bloqueiaVisao`, achatadas por `segmentosDaParede`), com cache por **referência** da lista `this.paredes` e do id da cena.
3. Monta os **olhos**: um por fonte de visão, na posição **animada** do visual (`v.x, v.y`).
4. `resolverLuzes(...)` com as luzes (incluindo uma luz que o mestre está arrastando) e os pontos.
5. `calcularModelo` calcula os polígonos de visão, de visão no escuro e de cada luz, com o `CacheDeLuz`.
6. Chama `camada.atualizar(...)` para redesenhar as texturas, com ou sem memória.
7. Atualiza quais tokens aparecem.

### `CacheDeLuz`

Mover um token que enxerga não deve refazer o polígono de cada luz. `CacheDeLuz.calcular` guarda os polígonos por chave `x,y,claraM,totalM` e uma **assinatura barata** das paredes e da cena (um hash de todas as pontas arredondadas ao milímetro, mais a contagem e o tamanho). Se a assinatura muda, descarta tudo. Se não, reaproveita cada luz cuja chave não mudou. O cache só retém o que foi usado na última passada (`usadas`), então não cresce.

O polígono dos olhos (a visão) **não** é cacheado: ele muda sempre que o token anda.

### O ritmo da visão em movimento (Q13)

Enquanto um token que enxerga (ou carrega uma luz) anda, `animar` liga `visaoPorMovimento`. Em `passo`, a visão só é refeita quando passou a espera `esperaDaVisao`: o **dobro do que a última refeita gastou**, com teto de 120 ms (`MAX_ESPERA_DA_VISAO_MS`). Com a máquina folgada, é a cada quadro; com a máquina apertada, a visão não come o tempo dos quadros. Outras causas (parede mexida, opção, luz nova) refazem na hora. Ao parar, a última refeita sai no quadro seguinte.

### Visibilidade dos tokens

`atualizarVisibilidadeDosTokens`: no modo `jogador`, um token só é desenhado se ele é da camada `mapa` (cenário), é uma das fontes de visão, ou `veNoPonto(modelo, centro)`. Tokens sob névoa pintada à mão não aparecem para quem não é o mestre (`tokenSobNevoa`, com cache por token). O token oculto nem chega ao navegador do jogador (sigilo da sala), então aqui é só o filtro de "fora da visão".

## A memória do mapa

O jogador "se lembra" do que já viu, com alcance que depende da Inteligência: o que ficou longe demais desbota e some. Só de tela, nunca vai para a sala.

### A grade (`memoria.ts`)

`GradeDeMemoria` é uma grade de **células de 0,5 m** (`CELULA_DA_MEMORIA_M`), um byte por célula (1 = lembrada). As funções puras:

- `marcarVisto(grade, caixa, visto)`: marca as células cujo **centro** `visto` aceita, **só dentro da caixa** da visão atual (não percorre a grade toda).
- `esquecerAlemDoAlcance(grade, fontes)`: a célula lembrada que está além do alcance de **todas** as fontes é apagada na hora. Sem nenhuma fonte (jogador sem token na cena), nada é esquecido.
- `alcanceDaMemoria(config, mod)`: no modo padrão, a base mais `porModM` por ponto de Inteligência (15 m + 3 m × mod; −2 dá 9 m, +2 dá 21 m), nunca abaixo de 0; no modo fixo, o valor fixo; desligada, 0.
- `imagemDaMemoria(grade, fontes, tom)`: gera o RGBA (uma célula por pixel). Cada célula lembrada vale `tom × opacidade`, e a opacidade cai em linha reta com a distância até a fonte **que mais alcança** (`opacidadeDaMemoria`: 1 colado no token, 0 no alcance). A célula não lembrada é preto.

### Quando marca (`processarMemoria`)

Roda no máximo a cada 120 ms (`INTERVALO_DA_MEMORIA_MS`), porque a conta é por célula. Calcula a caixa envolvente dos polígonos de visão, chama `marcarVisto` com `veNoPonto(modelo, centro)`, esquece o que passou do alcance, e, se algo mudou, `sujarMemoria()` agenda a gravação **500 ms depois da última mudança** (`ATRASO_DA_GRAVACAO_MS`; também no `pagehide` e no `destruir`). Isso evita gravar a cada passo. `camada.definirMemoria` refaz só a composição (barato), não os polígonos.

### Onde fica (`memoriaLocal.ts`)

`ArmazemDeMemoria` guarda um registro por **mesa, usuário e cena** no IndexedDB (`tabletop-memoria`, loja `cenas`; chave `mesaId|usuarioId|cenaId`, `chaveDaMemoria`). A mesa entrou na chave no C2: os ids `mestre`, `jogador-1` e de cena se repetem entre mesas, e sem o id da mesa a área explorada de uma vazaria para outra. A mesa legada (de antes do C2) herda a chave antiga uma vez, **copiando** (a antiga fica, só se acrescenta). Qualquer falha do IndexedDB (janela anônima, banco bloqueado) cai numa **cópia em memória**: a memória funciona até o refresh e o app não quebra.

Uma cena que mudou de tamanho invalida a memória gravada (`gradeServe` compara colunas, linhas e célula) e começa vazia.

### O "esquecer" do mestre

Como a memória é local, o mestre não pode "zerar um dado da sala". O botão "Esquecer a memória desta cena" vira `memoria.esquecer` → evento `memoria.esquecida` → um **número de versão** por cena em `Estado.memoriaEsquecida`. Cada navegador guarda o último `esquecimento` que **aplicou** (no registro gravado). Se a versão da sala é maior, `aplicarEsquecimento` zera a grade. Assim funciona mesmo para quem estava offline na hora.

### Limitações aceitas

- A memória marca por centro de célula: quinas finas de parede podem deixar uma célula marcada por engano.
- A memória vale para o token **deste navegador**: o mestre "vendo como" um jogador usa a memória que **o navegador do mestre** tem desse jogador, não a do jogador.

Testes: `memoria.test.ts` (shared), `memoriaLocal.test.ts` (web) e `luz.spec.ts` (E2E, com os ganchos `memoria()`, `lembraNoPonto`).

## A névoa pintada à mão (N4)

Além da névoa "automática" (a luz e a visão), o mestre cobre e revela áreas por cena com ferramentas de pincel, retângulo, polígono e "tudo". A cena guarda a **lista de traços** (`Cena.nevoa`), cada um com `forma`, `modo` (`cobrir` ou `revelar`), `pontos` e, no pincel, `raio`.

### A regra: o último traço que contém o ponto decide

`pontoNaNevoa(tracos, p)` percorre do fim para o começo; o primeiro traço que contém o ponto decide (`cobrir` → sob névoa, `revelar` → fora). Sem traço, revelado. A névoa **não é segredo**: o jogador recebe a lista; o que está sob ela só não aparece na tela dele (diferente das paredes secretas, que a sala esconde).

### Crescimento limitado

Uma lista que cresce sem limite pesaria na sala e em cada snapshot. Os limites: 300 traços, 128 pontos por traço, 6.000 pontos no total. `acrescentarTraco` tenta acrescentar; se passa do limite, `compactarNevoa` junta o que dá (um "tudo" vale como o começo da lista e os "revelar" que vêm antes de qualquer "cobrir" não mudam nada e saem). Se nem assim cabe, a sala recusa o traço. O pincel chega **simplificado** (Ramer–Douglas–Peucker em `simplificarCaminho`, tolerância de 5 cm, com a tolerância dobrando até caber em 128 pontos). Enquanto cabe, a lista guarda tudo, e o desfazer volta traço a traço.

`tracoContem` usa uma **caixa envolvente** por traço (em `WeakMap`, mais uma folga de `1e-6`) para descartar de cara o que não pode conter o ponto; `tracoContemSemAtalho` é o teste completo, exportado só para o teste de equivalência.

### O desenho (`camadaDeNevoa.ts`)

`CamadaDaNevoa` compõe os traços, na ordem, numa **textura de baixa resolução** (lado maior de 2048 px, escala máxima 0,5): `cobrir` pinta, `revelar` apaga (blend `erase`). Traços seguidos do mesmo modo dividem um `Graphics` (o apagar é por objeto, então a ordem entre grupos é preservada). Só refaz quando a chave (cena, quem olha, JSON dos traços) muda. Para o jogador a área coberta é escura e opaca (`0x07090d`); para o mestre é um véu 50% translúcido com uma **hachura** por cima, usando um segundo sprite como máscara (o objeto usado como máscara deixa de ser desenhado, por isso são dois sprites).

## A `CamadaDeLuz`

Esta é a parte mais densa do mapa. Em vez de shaders próprios, a luz é feita só com **modos de mistura** do Pixi sobre `RenderTexture`s do tamanho da cena. Isso foi decidido no Lote 6: nenhum shader a manter, e o modo `saturation` dá o "cinza da visão no escuro" de graça (exige `import "pixi.js/advanced-blend-modes"` e `useBackBuffer: true`).

### O que ela entrega

Três sprites sobre o mapa e abaixo das paredes do mestre:

- `multiplicar` (blend **multiply**): quanto da cena aparece em cada ponto. Onde o jogador vê, a luz; onde não vê, a memória do mapa ou o preto.
- `brilho` (blend **add**, alfa 0,1): a **mesma** textura, somada a 10%. Num mapa sem imagem (chão escuro), a luz deixa de parecer só "ausência de preto".
- `cinza` (blend **saturation**): o que aparece em tons de cinza (o escuro dentro da visão no escuro).

### As texturas e o pipeline

Cinco `RenderTexture`s do tamanho da cena em pixels de mundo (`largura × 40`), com `resolution = min(1, 1800 / ladoMaior)`: nenhuma passa de 1.800 px no lado maior (a luz tem bordas suaves; não precisa de mais, e cenas grandes não podem estourar a memória da GPU). Em `atualizar`:

```
1. naoVisto   branco com alfa onde o jogador NÃO vê agora
                = tudo branco, menos (erase) a união dos polígonos de visão
              se a cena é escura (ambiente < 0,45): naoVisto também inclui
                o que não tem luz nem visão no escuro   (passoNaoLuz + passoUniao)
2. dv         a união dos polígonos de visão no escuro
3. cinza      dv menos (erase) o que alguma luz alcança
                (cena clara: apaga tudo, sem cinza nenhum)
4. luz        ambiente (cinza) + cada luz somada (add) + meia luz da visão no escuro
              depois apagado (erase) onde naoVisto
5. saida      jogador: memoria (se há) + luz por cima, fundo preto
              noturna: ver abaixo
```

Cada luz soma duas vezes o mesmo passo (`corDoPasso`): o polígono "total" e o polígono "claro". Dentro do raio claro a soma é 2 × 0,5 = 1; na penumbra, 0,5. A **cor** da luz tinge a cena só pela metade (`TINTA = 0,5`: `255 - (255 - c) × 0,5`), para uma luz âmbar não virar laranja saturado. A visão no escuro soma `0x808080` (meia luz) só onde enxerga (`spriteCinzaNaLuz`, `blendMode = "add"`), o que, em penumbra, a eleva a luz plena.

Com visão no escuro e nenhuma luz perto, o que se vê é o escuro (soma 0,5 da meia luz) **dessaturado** pelo sprite `cinza`. Por isso a visão no escuro tem dois sprites: `multiplicar` escurece e `cinza` tira a cor.

### Os dois modos

**`jogador`**: o caminho acima, com a **memória do mapa** (`spriteMemoria`, uma textura pequena de uma célula por pixel, ampliada com filtro linear a partir de um canvas) desenhada **antes** da luz em `saida`. Onde o jogador vê, `luz` é opaca e cobre a memória; onde não vê, `luz` foi apagada (erase) e a memória aparece. A tremulação (`atualizarBrilho`) refaz só a textura `luz` e a composição, sem recalcular polígono.

**`noturna`** (a "Visão do mestre"): o mestre vê tudo, mas com contraste. Desde o FG2 roda **o mesmo caminho do jogador** (luz, cor, penumbra) e só a composição (`compor`) muda: em `saida`, onde algum jogador vê, desenha-se a luz dele; onde nenhum jogador vê, um **cinza apagado** (`FATOR_APAGADO = 0,45`), e por cima, a **luz do mestre** (a próxima seção). Sem memória.

### A luz do mestre: `prepararLuzDoMestre`

Antes do FG2 o modo `noturna` só pintava "visto claro, resto apagado" e nunca desenhava luzes: o mestre não via a cor de uma tocha antes da sessão e não conseguia ajustá-la. O FG2 mudou duas coisas:

- `prepararLuzDoMestre(w, h, t, modelo)` cria duas texturas extras (`extras.visto`, `extras.luzGm`), só no mestre. `visto` é "onde algum jogador vê" (branco menos `naoVisto`). `luzGm` começa preta e soma (add) a cor e o alcance de **todas** as fontes, com as paredes (os mesmos polígonos), e depois **apaga** (erase) onde algum jogador já vê. O resultado é "a luz de todas as fontes, somente onde nenhum jogador vê". Soma-se por cima do cinza apagado com um tint de `1 - FATOR_APAGADO`.
- Para não lavar a cor, a visão no escuro no modo `noturna` usa a textura `cinza` (visão no escuro menos o que a luz alcança) no `spriteCinzaNaLuz`; no jogador usa `dv` (a visão no escuro toda). Sem essa troca, a visão no escuro de um jogador somava meia luz branca sobre a tocha e a cor do mestre ficava esbranquiçada.
- **A luz do mestre não tremula**: `atualizarBrilho` retorna se o modo não é `jogador`. O custo de refazer dezenas de luzes a cada 90 ms só para o mestre dobrava o tempo com 48 chamas.

O mestre sem jogador na cena também vê as cores (a "Visão do mestre" vale sem jogador: serve para preparar a cena antes da sessão). O mestre **"vendo como"** um jogador usa o modo `jogador`, a visão e a memória **daquele navegador**.

### O que é frágil na `CamadaDeLuz`

- As `RenderTexture`s são refeitas só quando o tamanho da cena muda (`garantirTexturas`); mexer nos passos exige cuidado com quem lê quem: `saida` serve de **rascunho** no passo "não luz" e é refeita depois; `spriteNaoVisto`, `spriteNaoLuz` e `spriteDvNoCinza` apontam para texturas que mudam de conteúdo.
- O passo de cinza é pulado sem visão no escuro (`temEscuro`): ao voltar a existir, a mesma função refaz antes de qualquer uso, então nunca se vê textura velha. Código novo que leia `dv` ou `cinza` fora dessa função quebra isso.
- `plano(pontos)` guarda o array de pixels por identidade do polígono (`WeakMap`) e o `Graphics` do Pixi guarda a referência: **nunca mute** o array devolvido.
- Blend `saturation` e `RenderTexture` só foram vistos no Chrome (WebGL). Com devicePixelRatio alto, as texturas continuam limitadas a 1.800 px.
- O E2E lê a cor final com `corNoPonto` (gancho `corDaLuzNoPonto`, só no modo `e2e`), que extrai a textura inteira (`extract.pixels`): é lento, **nunca** para o caminho normal.
- Não há teste de unidade da `CamadaDeLuz` (precisa de WebGL): a regra pura é testada em `iluminacao.test.ts`, e o desenho, por E2E (`luz.spec.ts`, `fg2.spec.ts`) e por prints.

## As chamas: `montarQuadro`

As tochas e fogueiras do mapa são **fogo animado**, gerado por código. Nenhum arquivo de terceiros entra: o pacote de animações padrão é desenhado no canvas 2D e vira uma folha de quadros.

### O problema

O primeiro desenho do FG1 tinha cada língua de fogo com o próprio balanço, em sinais opostos. Em alguns quadros a ponta de fora se afastava do meio e a silhueta virava **dois bicos**: a tocha "se dividia em dois". A fogueira ficava como uma fileira de pontas, com "gravetos" que pareciam um item do mapa. O Vilella pediu: a fogueira como **um fogo só**, sem lenha, e a tocha nunca partida.

### A solução

`montarQuadro(forma, t, estilo, receita)` separa a **geometria** (sem canvas, testável) do **desenho** (`desenharQuadro`, só pinta). Devolve as gotas do quadro: `Gota { x, base, largura, altura, balanco }`, o núcleo mais claro, as brasas e o leito de brasas no chão. A forma de cada gota é uma gota de Bézier (`contornoDaGota`).

Os princípios que mantêm o fogo inteiro:

1. **Uma massa só.** Todas as gotas nascem na **mesma base** (`base = alt × 0,7`) e uma delas é o **corpo**, maior. A tocha tem corpo + duas ou três línguas coladas nele; a fogueira, um corpo largo + línguas que **se sobrepõem** (cada uma cobre mais que o espaço até a vizinha, `largura >= passo × 2,4`), então, mesmo esticada, continua uma massa.
2. **O vento é um só.** A variável `vento` é um seno do tempo, calculada **uma vez** por quadro, e todas as gotas a usam (`balanco = vento × 0,9 + proprio`). Cada língua só ganha um pouco de balanço próprio (`proprio`, pequeno), e nunca o sinal oposto ao vento. Antes, o balanço independente e de sinal contrário é o que partia a silhueta.
3. **Brasas por dentro.** As brasas sobem dentro do corpo e se apagam antes da ponta (`y` limitado por `alturaDoCorpo × 0,6`, alfa caindo com `1 - u`): a chama não solta pontinhos separados.
4. **Laço sem emenda.** `t` vai de 0 a 1 e só entram senos de **frequência inteira** (`sin(TAU × (t + fase))`, `sin(TAU × (2t + ...))`), então o último quadro volta ao primeiro como um quadro vai ao seguinte. A semente das fases é `fixo(n)`, uma função determinística (nunca `Math.random`): a chama é sempre a mesma.
5. **Três estágios** (`forte`, `fraca`, `morrendo`) por estilo (`tocha`, `fogueira`) em `RECEITAS`: escala, número de línguas e brasas, `tremor` (o "morrendo" tremula mais) e `brasa` (quanto o laranja puxa ao vermelho escuro).

### Do quadro à textura

`gerarPadrao(estilo, estagio)` pinta 16 quadros (`QUADROS_DO_PADRAO`, 80 ms cada: laço de 1,28 s) numa folha de 8 colunas e recorta uma `Texture` por quadro (todas dividem a mesma `source`). `ChamasDoMapa` guarda as folhas **por mapa**: as texturas pertencem ao renderer dele, e destruir o mapa as destrói. O mestre também pode usar uma animação própria (gif, webp animado ou apng) por estágio: `decodificarAnimacao` usa o `ImageDecoder` do navegador, quadro a quadro (até 48 quadros, lado até 160 px), e vira outra folha igual. Sem `ImageDecoder` (só Chrome e Edge), cai num quadro parado. Enquanto a decodificação não chega, vale a padrão (`escolher`).

A cada quadro do Pixi, `animarChamas` escolhe o quadro certo (`indiceDoQuadro`, com uma fase por id, `faseDoId`, para as chamas não baterem juntas) e só marca o mapa como sujo se algum quadro mudou. Com "reduzir movimento" do sistema, a chama fica no primeiro quadro (lido no máximo uma vez por segundo, `movimentoReduzido`).

### O teste que vigia a silhueta

`chamas.test.ts` confere, em **cada um dos 16 quadros** de cada estilo e estágio, que a silhueta (a união dos contornos das gotas) é **uma região conexa** (`regioesConexas`, flood fill com vizinhança de 4) e que toda brasa está dentro dela; também que a fogueira não tem nada abaixo da base além do leito, e que o último quadro leva ao primeiro. O E2E (`fg2.spec.ts`) repete a conferência nos **pixels reais** das folhas (alfa acima de 90), pelo gancho `regioesDaChama`. Mexer em `montarQuadro` sem rodar esses dois reabre o defeito da "tocha dividida".

## Objetos de luz e tochas

### O modelo (Lote 7)

Uma "luz" é um `ObjetoDeLuz` (a `FonteDeLuz` evoluída). Tem um **portador**: `cena` (fixa), `token`, `mao` (de um personagem), `ponto` ou `mochila`. Os modelos (`ModeloDeObjeto`) trazem raios, cor, se tremula, duração (`duracaoS`, `null` = infinita), se ocupa a mão e, no FG1, o tamanho da chama (`chamaM`) e as animações. `modelosPadrao()` semeia três: Tocha 5e (6 + 6 m, 60 min), Lanterna (9 + 9 m, 6 h) e Fogueira (infinita, não ocupa mão). **Pontos** de luz (`PontoDeLuz`) são suportes e inflamáveis: um suporte recebe uma tocha; um inflamável é acendido segurando a tocha por cima (`segurarS`).

### O tempo é da sala

O princípio 6: o tempo de uma tocha é do relógio **da sala**, não do navegador. O objeto guarda `saldoMs` e `acesaDesdeSala` (só na sala, nunca saem). `restanteDoObjeto(objeto, salaMs)` = saldo menos o que passou desde que acendeu. Pausar a mesa congela o relógio. O agendador da sala guarda um vencimento por objeto (próximo estágio, fim ou fim de modificador) e, quando vence, `processarSistema` troca o estágio ou apaga.

### `estagioDe`: a tocha vai mudando

```ts
export function estagioDe(restanteMs, duracaoMs, estagios): Estagio {
  const fracao = restanteMs / duracaoMs;
  if (fracao <= estagios.morrendo) return "morrendo";
  if (fracao <= estagios.fraca) return "fraca";
  return "forte";
}
```

Os limiares são frações da duração e vêm da configuração da mesa (`ConfigDaMesa.estagios`, padrão `fraca: 0,5` e `morrendo: 0,1`). O estágio muda a **chama** (receita menor, mais vermelha, mais tremida) e, em `resolverLuzes`, a luz "morrendo" tremula mais (`tremula: l.luz.tremula || l.estagio === "morrendo"`; na `CamadaDeLuz`, amplitude 0,4 e ritmo 2,6 em vez de 0,12 e 1).

### O que o jogador sabe do tempo (`objetoParaVisao`)

É o **único** caminho do objeto para a tela, no snapshot e em todo evento `fonte.*`. Remove `saldoMs` e `acesaDesdeSala` e calcula `restanteMs`, `contando` e `estagio` no instante da sala. O mestre recebe tudo (modificadores, histórico). O jogador recebe conforme `tempoParaJogadores`: `exato` (restante e estágio), `estagio` (só o estágio) ou `oculto` (nada). Nunca recebe o histórico, a lista de modificadores nem a duração. Isso criou um problema no FG2: no modo `exato` o jogador recebia `restanteMs` mas **não** o `estagio`, então a tocha dele ficava sempre "forte". A solução foi a opção `estagioDe` que a `Mesa.tsx` passa ao mapa: a tela calcula o estágio com o `estagioDe` do shared, a duração do modelo e a configuração, e `estagioDaLuz` usa o da sala **ou**, na falta, o calculado. Assim o estágio vale também para objetos em pontos (que antes ficavam sempre "forte").

### A tocha na mão: o pino e `MIOLO_DO_TOKEN`

A tocha de um personagem é um **pino** no canto do token (V11): um círculo pequeno com um anel fino que mostra o tempo que falta (`anelDaTocha`; em alerta quando passa de 10% ou 5 min finais), com a chama animada dentro (`estagioDaChamaDaMao`: só fonte acesa e com fogo, isto é, que tremula; a lanterna mantém o ícone). Os ângulos dos pinos por mão estão em `ANGULOS_DA_TOCHA` (a 1ª mão no canto superior direito). Os gestos: arrastar o pino entrega a tocha a outro token, põe num suporte ou, sobre um inflamável, começa a contagem para acender (`anel`); dois cliques apagam ou acendem; clique direito abre o menu.

**O problema do `MIOLO_DO_TOKEN` (FG2).** O pino tem um tamanho mínimo na **tela** (9 px de raio) e fica a 90% do raio do token. Com o mapa afastado, o token fica menor que o pino, que passa a **cobrir o meio do token**. O clique no token virava o gesto da alça da tocha (que não leva a lugar nenhum) e o token não andava. O mestre dizia que "não conseguia mexer o token"; recarregar a página resolvia porque a vista voltava a um zoom maior, o que enganou a primeira investigação (suspeitava-se do modelo ao vivo do FG1). Reproduzido em E2E (`fg2.spec.ts`, zoom 0,3) antes de corrigir.

A solução, em `ancoraDaAlca`: a distância do pino ao centro vale `max(raioPx × 0,9, (rTela + MIOLO_DO_TOKEN × raioPx × zoom + 2) / zoom)`. Em português: o pino fica sempre **fora do miolo do token**, que é a metade do raio **na tela** (`MIOLO_DO_TOKEN = 0,5`), e o miolo continua sendo do token. Se um ponto de luz já ocupa o lugar, o pino desliza pela borda em passos de 22° (até 3 tentativas, `livre`). Mexer na distância sem pensar no miolo traz o defeito de volta.

### Objetos nos pontos (FG1)

Antes o objeto num ponto era uma alça em tamanho de tela. No FG1 virou **o objeto no lugar do ícone**, em tamanho de **mundo** (a chama é um sprite esticado a `larguraM × alturaM`; apagado, um toco ou achas escuras desenhados em `Graphics`). O relógio fica sob ele em tamanho de tela e some abaixo de `ZOOM_MIN_DO_ROTULO` (0,7), onde viraria ruído. O inflamável selecionado mostra oito alças (`alcasDeTamanho`) para o mestre esticar a chama; o tamanho vale ao vivo enquanto arrasta (`chamaArrastada`). `AlcaVisual` tem dois modos (pino da mão, objeto no ponto): trocar de modo reseta a `chave`, senão o desenho fica velho.

A área de soltar uma tocha num suporte ou inflamável é de no mínimo uma célula e 40 px de tela (`areaDeSoltarM`); o alvo mais próximo é destacado (`atualizarAlvoDaAlca`). O alcance para acender ou pôr é a distância em **quadrados** do 5e entre ocupantes (`dentroDoAlcance`, Chebyshev); a porta tem o seu próprio alcance fixo (2 quadrados, em linha reta).

### O que a sala garante

A sala é a única autoridade: nenhum cliente manda o vencimento; o contexto de tocha (`tochas.ts`) valida mão livre, mochila, alcance e se a tocha é do jogador; `pontoAcenderFim` só acende se a contagem durou pelo menos `segurarS` (com tolerância) a partir de `acendimentos`, registrado por `pontoAcenderInicio`. Testes: `tochas.test.ts` e `tochas.spec.ts`.

## Os desenhos e o pincel

O pincel (Lote 13) desenha traço livre, linha, retângulo e círculo, por cena. Qualquer um com `podeDesenhar` desenha; o mestre mexe em todos, o jogador só nos próprios (`podeMexerNoDesenho`).

### Modelo (`desenho.ts`)

`Desenho { id, cenaId, autorId, forma, pontos, cor, espessura, preenchido? }`. Livre: o traço (um ponto = um pingo). Linha, retângulo e círculo: exatamente **dois pontos** (`geometriaValida`); no círculo, o centro e um ponto da borda. Limites: 2.000 pontos por desenho, 1.000 desenhos por cena, espessura 1 a 24 px de mundo. A espessura **nunca fica mais fina que 1,5 px na tela** (`MINIMO_NA_TELA_PX`, dividido pelo zoom).

### O fluxo de um traço

1. **`aoApertar` → `apertarComPincel`**: no modo `formas`, cria um id (`des-xxxx`), um limitador de ~80 ms, e o gesto `traco` com o ponto inicial. Já envia um rascunho.
2. **`moverComPincel`**: no `livre`, acrescenta o ponto se andou pelo menos 3 cm; passando de 4.000 pontos, simplifica no ato. Nas outras formas, só guarda o início e o ponto atual. Redesenha **só o traço em andamento** (`redesenharAndamento`) e pede o rascunho ao limitador.
3. **Rascunho** (`desenho.rascunho`): a sala valida como se fosse criar, mas só repassa aos outros (`desenhoRascunho`, `{ rascunho }`); nunca grava. Os outros desenham o traço em andamento com alfa 0,85 (`rascunhosAlheios`). A sala descarta rascunhos que chegam a menos de 30 ms um do outro (`rascunhoDentroDoLimite`).
4. **`soltarComPincel`**: prepara o traço final (`prepararTraco`: arredonda ao centímetro, tira pontos repetidos e simplifica com **Douglas–Peucker**, tolerância de 5 cm, aumentando até caber no limite), descarta o clique sem arrasto nas formas, e manda `desenho.criar` com **o mesmo id do rascunho**. O traço fica numa lista de `pendentes` (some quando o evento da sala chega, ou em 2 s) para não piscar entre soltar e confirmar.
5. A sala emite `desenho.criado`; `definirDesenhos` apaga o pendente e o rascunho daquele id.

A **borracha** apaga o desenho **inteiro** que tocar: ele some na hora (`apagadosLocais`) e o pedido sai ao soltar (até 50 por vez); se a sala recusar, volta a aparecer em 1,5 s. O modo **selecionar** acha o desenho de cima sob o ponto (`desenhoTocadoEm`, com margem = metade da espessura + alvo de 8 px) e o arrasta, com o deslocamento limitado para o desenho inteiro caber na cena (`deslocamentoNaCena`); ao soltar, `desenho.mover`. "Voltar" apaga o desenho mais recente **de quem pede** na cena; "Limpar desenhos" é do mestre.

### Por que dois níveis de redesenho

`CamadaDeDesenho` tem três `Graphics`: gravados, em andamento e seleção. `redesenharDesenhos` refaz tudo; `redesenharAndamento` só o andamento e a seleção. Sem essa divisão (O3), cada `pointermove` do pincel redesenhava todos os desenhos gravados. Regra: quem muda a lista dos gravados chama `redesenharDesenhos`; quem só mexe no traço atual chama `redesenharAndamento`. Mudar o zoom refaz tudo (a espessura mínima depende dele).

Testes: `desenho.test.ts` (shared) e `desenho.spec.ts` (E2E).

## A régua

A régua é toda local: não vai à sala. `reguaAtual = { pontos, b }`: o começo e os pontos de virada já marcados, e `b`, a ponta que segue o ponteiro.

Contas puras em `packages/shared/src/mapa.ts`:

- `medirRegua(a, b, quadradoM, opcoes)`: os **metros** são em linha reta (`hypot`); os **quadrados** seguem o 5e 2014: cada diagonal conta 1, ou seja, `round(max(|dx|, |dy|) / quadradoM)`. O rótulo é "7,5 m (5 quadrados)", ou só a distância na régua **livre** (V13, sem grid).
- `medirPercurso(pontos, ...)`: a medida de cada trecho e o total (a soma dos trechos).
- `formatarDistancia(metros, unidade)`: todo texto de distância do app passa por aqui. Metros com uma casa decimal; pés com o inteiro mais próximo (1,5 m = 5 pés, `METROS_POR_PE = 0,3`). A **unidade** é uma preferência local (`unidade.ts`); a sala só recebe metros.

No mapa (V13): clicar e arrastar mede; **clique direito com o esquerdo segurado** marca um ponto de virada (`marcarPontoDeVirada`; o botão direito entra por `pointerdown` ou pela mudança de `buttons` no `pointermove`, e `direitoDaReguaAbaixo` garante que conte um só por aperto); Backspace tira o último ponto. A régua **gruda no grid** conforme a preferência (`reguaGrudar`); Alt inverte. Shift ao soltar, ou o botão "Fixar", deixa a medida **fixada na tela** (`reguasFixadas`; some com Esc, com um clique nela ou ao trocar de ferramenta). Os rótulos dos trechos são em DOM (`Mesa.tsx`, `PertoDoPonto`), posicionados com `posicaoDaRegua.ts` para caber na área do mapa.

## O ping

O ping é uma mensagem **efêmera**: a sala valida, repassa a quem vê a cena e esquece. Não vai ao estado, ao banco, ao histórico nem à exportação.

- **O gesto**: no Selecionar ou na Mão, o `pointerdown` inicia uma espera de **400 ms** (`ESPERA_DO_PING_MS`); se o ponteiro andar mais de 5 px (`TOLERANCIA_DO_PING_PX`) ou soltar antes, cancela (`cancelarEsperaDoPing`). Passou o tempo: `pingouSegurando` **cancela o gesto em andamento** (o arrasto do token ou o pan acaba ali) e pinga. A tecla P pinga no ponteiro. **Shift** (ou segurar Shift no momento) também **centraliza** a vista dos outros no ponto.
- **A regra** (`ping.ts`, `pingar` + `limitarPing`): exige a capacidade `mapa.pingar`, que a cena exista e que quem pinga a veja (o mestre vê qualquer cena; o jogador só a do grupo, `pingVisivelPara`), e o ponto dentro da cena. A intenção `mapa.ping` é tratada em `nucleo.ts` e devolve `ping` no resultado, **sem evento**; a sala (`sala.ts`) a limita **por usuário**: no máximo 1 ping a cada 0,5 s (o excesso é ignorado em silêncio) e 1 centralização a cada 3 s (o ping que passou do limite sai sem centralizar). A **cor e o autor** são resolvidos na sala, nunca pelo cliente.
- **O efeito** (`pingRecebido`, `animarPings`, `desenharPing`): dois anéis que se abrem do centro (o segundo 22% depois), com contorno escuro e o centro marcado, por 1,2 s, até 2,5 quadrados (mínimo de 56 px de tela, para ser visto de longe). Com "reduzir movimento", um anel fixo. No máximo 12 pings simultâneos na tela.
- **A centralização** (`animarCentralizacao`): um pan de ~400 ms com ease cúbico, sem mudar o zoom. **Nunca tira nada do lugar de quem está arrastando**: o pedido espera o fim do gesto (`centralizarPendente`; só vale com `!this.gesto`).

Testes: `ping.test.ts` (shared), `v12.spec.ts` (E2E, ganchos `pingsRecebidos`, `pingsNaTela`, `centroDaVista`).

## A forma das zonas

Uma **zona** (7b-2) é um polígono de uma cena, só do mestre, com efeitos "enquanto dentro" (multiplicar ou somar o raio das luzes, limitar o alcance da visão, tocar um som) e reações por automação (entrar, sair). A zona **inteira** (forma, nome, efeitos) nunca chega ao jogador, nem no snapshot nem em evento: ele só vê o resultado (a luz menor, a visão limitada). Por isso `desenharZonas` só desenha se `modoMestre`.

- **Forma**: 3 a 64 pontos (`MINIMO_DE_PONTOS_DA_ZONA`, `MAXIMO_DE_PONTOS_DA_ZONA`), até 200 zonas. Pode ser **côncava**.
- **`pontoNaZona`**: par/ímpar (traçado de raio), **com a borda e os vértices contando como dentro** (`naBorda`, com tolerância `1e-9`). É a mesma função que a névoa usa para o polígono.
- **Quem está dentro**: pelo **centro** do token (`tokenNaZona`; a zona desligada não tem ninguém; só na cena da zona). Para um objeto de luz, `posicaoDoObjeto` acha onde ele está (o centro do token de quem o segura, o ponto ou o lugar fixo). `entradasESaidas(antes, depois)` compara os pares `zona|token` entre dois estados: a zona só conta se existe e está ligada **nos dois**; criar, apagar, ligar ou desligar uma zona muda os efeitos mas **não é "entrar" nem "sair"**; o token que nasce dentro **entra**, e o apagado ou que muda de cena **sai**.
- **Desenho**: polígono translúcido (mais forte com a ferramenta ativa, esmaecido se desligada), contorno **tracejado** (`tracejar`) e o nome no centro (média dos vértices), do mesmo tamanho na tela (a escala do texto é `1 / zoom`). A zona selecionada mostra as alças dos vértices; clique desenha, duplo clique fecha (`fecharZona`, com 3 pontos no mínimo), e dá para arrastar um vértice.

O que cada efeito faz na mesa está em `automacoesnucleo.ts` (ver o arquivo de automações desta pasta). Testes: `zonas.test.ts` e `zonas.spec.ts`.

## Os tiles e a redução de mapas grandes

Uma imagem de mapa pode ter 10.000 px. A GPU tem um limite de textura (`maxTextureSize`), e subir a imagem inteira de uma vez estoura memória. Por isso o mapa é **fatiado em tiles** na hora de subir (isso é do pipeline de assets, `processador.worker.ts`, mas o mapa é quem os desenha).

- **Decisão de fatiar**: `precisaFatiar(largura, altura, limite)` quando o lado maior passa do `limite`, que vem do `maxTextureSize` da GPU **limitado a 8.192** (`limiteDeTextura`; o teste E2E o reduz pelo gancho `limiteTile`). Um mapa que cabe vira **um arquivo WebP só**.
- **Fatiar**: `retangulosDeTiles(largura, altura, lado)` com `lado = min(limite, 4096)`. Os tiles saem **do mesmo tamanho (±1 px)** em vez de sobrar um pedacinho no fim (`cortes`), sem sobreposição e cobrindo a imagem. Limites: 64 tiles por mapa, 200 MB no total, 30 MB por arquivo.
- **O manifesto**: o "mapa" fatiado é um **asset manifesto** (`meta.tiles`) cujo hash é o SHA-256 do texto canônico dos tiles (não há arquivo único). Cada tile é um asset `tile`.
- **No Pixi** (`atualizarMapa`): um sprite **por lugar**, não por arquivo (chave `hash@x,y`: tiles iguais, como o chão liso de um mapa, ocupam cada um o seu canto), com a escala `quadradoM / pxPorQuadrado × 40`. O tile cuja textura ainda não chegou é pulado e pedido em segundo plano (`carregarEDepois`); quando chega, `atualizarMapa` roda de novo, então o mapa **vai aparecendo** à medida que os tiles são baixados. Ao trocar de cena, `limparMapa` tira todos os sprites do palco.
- A redução das **imagens de token e retrato** (512 px no lado maior) e das imagens soltas (2.048 px) é outra decisão do mesmo processador.

## Desempenho: o que custa caro e como foi medido

O mapa foi otimizado em quatro ondas, cada uma guiada por uma medida ou por um defeito que o Vilella viu.

### O que custa caro (em ordem)

1. **Os polígonos de visibilidade.** Cada fonte de luz e cada olho faz uma varredura contra todas as paredes. O custo é N luzes × M paredes × raios. Contido por: ordenar os segmentos por distância e parar o raio cedo; descartar paredes fora do quadrado do alcance; o `CacheDeLuz` (a luz só é refeita quando ela, as paredes ou a cena mudam); o **ritmo adaptativo** da visão em movimento (Q13).
2. **O redesenho das texturas da luz.** Cada `RenderTexture` é do tamanho da cena. Contido por: limite de 1.800 px; pular os passes de cinza sem visão no escuro; "só o brilho" para a tremulação (a cada 90 ms, não a cada quadro); a luz do mestre sem tremular.
3. **A chama animada.** Cada chama é um sprite que troca de textura; o custo é o **desenho a cada quadro**, não os polígonos. Está medido (abaixo).
4. **Paredes, zonas e marcas** em `Graphics`, que se redesenham no zoom. Contido pelo O3: o **pan não os redesenha** (só dependem do zoom: `aplicarVista(soMoveu)` pula o que só muda com o zoom); `definirOpcoes` só refaz o que uma opção que **muda** realmente lê (`QUEM_LE_A_OPCAO`).
5. **A névoa.** Compor os traços numa textura: só refaz quando a chave muda; "token sob névoa" fica em cache por token.
6. **O React.** Cada `token.movido` de eco redesenhava a `Mesa` inteira. O Q13 empilha os avisos e atualiza o estado a cada 300 ms.

### As medidas

- **Lote 5**: o teste de unidade com 500 segmentos × 8 fontes roda em menos de 16 ms (limite do teste); medido em 5 a 7 ms.
- **Lote 6**: 30 luzes e 500 paredes arrastando um token no Chrome headless: 60 fps (o teto do `requestAnimationFrame`; só referência, em `e2e/prints/lote-6.spec.ts`).
- **Q13** (cena pesada: 45 × 45 células, 172 paredes, escuridão, tocha presa ao token, névoa, memória, 5 tokens): o perfil mostrou que o laço do mapa **não** era o gargalo (parado, ~2%). Com a CPU emulada 4× mais lenta, segurar a seta ia a ~4,2 quadrados/s, com 18 tarefas longas; depois, 8,0 a 9,0 quadrados/s e 4 a 6 tarefas longas. A visão e a luz da tocha consumiam ~12% a cada quadro.
- **FG1** (`e2e/prints/desempenho.spec.ts`, grupo F; tempo de tarefa da thread principal em 3 s **parados**): sem chamas **70** ms, 12 chamas **180** ms, **48 chamas 285 ms**, sem tarefas longas; com pan e zoom, 317 / 407 / 490 ms.
- **FG2** (mesma medida; FG1 entre parênteses): sem chamas **52** (70), 12 chamas **173** (180), **48 chamas 351** (285) ms. Ruído de 15 a 20% entre rodadas; sem tarefas longas. Os docs não explicam por que o caso de 48 chamas foi de 285 para 351 ms entre o FG1 e o FG2 (o ruído entre rodadas já é de 15 a 20%); o que o FG2 registra é que a luz do mestre deixou de tremular porque, com tremulação, custava o dobro com 48 chamas.

A conclusão de leitura: o custo das chamas é **linear no número de chamas visíveis** (da ordem de 4 a 6 ms de tarefa por chama em 3 s, conta feita a partir dos números acima, no notebook de teste), e o `pan` e o `zoom` custam mais ~70%. Uma cena com 48 chamas continua fluida, mas é o teto de conforto sem otimizar mais.

### O que é frágil (os caches valem porque o estado é imutável)

Os caches por **referência** (`WeakMap` de segmentos de parede, caixa envolvente da névoa, polígono em pixels da luz, "token sob névoa", segmentos de visão, `paredesDaCena`) só valem porque o `reduzir` do estado cria **sempre** um objeto novo. Código novo que **mute no lugar** uma parede, um traço da névoa, um polígono ou o compêndio deixa o cache velho sem nenhum erro. É a regra mais importante deste arquivo.

Outras:

- `QUEM_LE_A_OPCAO` é um `Record` exaustivo: toda opção nova do mapa **precisa** ser classificada (o compilador acusa). Se `desenharParedes`, `desenharZonas` ou `desenharMarcasDeLuz` passarem a ler outra opção, a classificação tem de acompanhar, senão o desenho fica velho ao trocar a opção.
- `aplicarVista(true)` (pan) pula o que só depende do zoom: algo novo no `mundo` que dependa da posição da vista precisa ser redesenhado à parte.
- `destruir` usa `app.destroy({ removeView: true }, { children: true })` e **não** `releaseGlobalResources`: `destroy(true)` esvazia os **pools globais** do Pixi, e no StrictMode (o primeiro mapa é descartado com o segundo já de pé) destruía lotes em uso ("reading 'clear'"). O laço também não para mais por um erro.
- **Não foi feita uma medida de antes e depois para o O1 a O4 (otimizações de 2026-11-17)**: os ganhos vieram da leitura do código (frequência × custo); só o tamanho do build foi medido.

## Decisões e por quê

- **Visão e luz só no navegador.** O mestre e os jogadores calculam a própria visão. A sala nunca sabe "o que o jogador vê". Isso mantém a sala simples e barata (plano grátis), e permite o mestre ver "como" qualquer jogador. O preço: a sala não pode impedir um jogador de ver o que o navegador dele já recebeu; por isso o sigilo é no **envio** (parede secreta, token oculto, luz escondida), nunca na renderização.
- **Pipeline só com modos de mistura, nenhum shader** (Lote 6). Descartado: um shader de composição próprio. O `saturation` do Pixi já resolve o cinza.
- **Véu em `RenderTexture` com `erase`, não máscara** (Lote 5). A máscara de stencil do Pixi **soma** sobreposições: a visão de dois jogadores que se cruza furaria o cruzamento. Com `erase` por polígono, a união é automática. (O desenho do véu do Lote 5 foi absorvido pela `CamadaDeLuz` no Lote 6: o "naoVisto" é o mesmo véu.)
- **A memória é local, não da sala** (Lote 6). Descartado: "névoa explorada" gravada na sala. A memória é uma conveniência de tela; mover o que o jogador viu para a sala a transformaria em estado a sincronizar, validar e exportar.
- **Luz com bordas duras** (degraus de penumbra e luz plena). Aceito: sem gradiente, o cálculo fica barato e determinístico (o teste confere o nível numérico num ponto). Um gradiente exigiria shader.
- **A luz ambiente sem valor vale 1** (não escurece campanha antiga) e fica na cena, não na `ConfigDaMesa`.
- **O estado da zona nunca chega ao jogador** (7b-2, regra 7): ele só vê o resultado.
- **A régua é local** e a unidade (m ou pés) é preferência de cada um; a sala só conhece metros (V13).
- **O ping é efêmero** e não deixa rastro em estado nem histórico (V12); o limite é por usuário na sala, para um jogador não inundar a mesa.
- **O mestre ignora paredes ao mover** (`trajetoBloqueado` só vale para o jogador): ele precisa poder reorganizar a cena.
- **Cena-cartão** (V10c): uma cena de "imagem" (handout, ilustração) tem `cartao: true`; `visaoLimitadaNaCena` nunca limita a visão nela, as paredes guardadas não chegam ao jogador nem barram o movimento, e a névoa e a luz saem do jogo. O enquadramento é pela imagem inteira (`vistaInicial` → `centralizar(folga)`).

## Para ir além

- `../PASSAGEM.md`: seções "V10", "V10b", "V10c", "V11", "V12", "V13", "V14" (pontos frágeis por lote), "Lote 5", "Lote 6", "Lote 7", "FG1" e "FG2".
- `../ESTADO.md`: "Lote 2", "Lote 5", "Lote 6", "Lote 7", "Ajustes V10 a V14", "Ajustes N4", "Ajustes Q13", "Ajustes FG1" e "Ajustes FG2" (o que foi entregue, como foi verificado, as medidas de desempenho), e "Otimizações O1 a O4".
- `../REDESIGN.md`: "Q13 — como ficou" (o perfil e os números), "FG2 — como ficou" (a causa da luz do mestre, da tocha dividida e do token que o mestre não movia).
- `../protocolo.md`: as intenções e os eventos do mapa (`token.*`, `parede.*`, `porta.alternar`, `fonte.*`, `mapa.ping`, `desenho.*`).
- `../IDEIAS.md`: "Desempenho: auditado e não feito".
- Testes principais: `packages/shared/src/visao.test.ts`, `iluminacao.test.ts`, `luz.test.ts`, `memoria.test.ts`, `nevoa.test.ts`, `paredes.test.ts`, `paredesV5.test.ts`, `zonas.test.ts`, `ping.test.ts`, `desenho.test.ts`, `tochas.test.ts`; `apps/web/src/mapa/chamas.test.ts`, `memoriaLocal.test.ts`; E2E em `e2e/tests/mapa.spec.ts`, `paredes.spec.ts`, `luz.spec.ts`, `tochas.spec.ts`, `nevoa.spec.ts`, `zonas.spec.ts`, `desenho.spec.ts`, `fg1.spec.ts`, `fg2.spec.ts`, `q13.spec.ts`, `v12.spec.ts`, `v13.spec.ts`; a medida de desempenho em `e2e/prints/desempenho.spec.ts`.

## Divergências conhecidas entre os docs e o código

- A descrição do Lote 5 diz que o alcance de interação da porta é o mesmo `alcanceInteracaoM` da tocha. Não é: desde o LP1 a porta abre a 2 quadrados fixos (`ALCANCE_DA_PORTA_EM_QUADRADOS`); o `alcanceInteracaoM` da mesa vale só para tochas e pontos.
- O Lote 5 fala em véu com resolução limitada a 3.000 px; hoje o véu é o `naoVisto` da `CamadaDeLuz` e o limite é **1.800 px** (`LADO_MAXIMO`).
- O Lote 6 fala em memória "por usuário e cena"; a chave real é **mesa, usuário e cena** (C2).
