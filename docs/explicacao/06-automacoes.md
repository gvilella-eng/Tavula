# 06 — Automações

As automações são o que a mesa faz sozinha: "a cada 3 minutos, cada tocha acesa tem 30% de chance de apagar", "quando um
token entra na zona do Ar Morto, a luz dele cai pela metade", "ao apertar o botão Rajada de vento, avisa o chat". O mestre
monta isso numa grade de blocos ligados por fios (como o n8n), em português, sem escrever código. O motor roda tudo na sala,
com o tempo da sala (que pausa quando a mesa pausa), e o jogador nunca recebe a definição, só o chip do botão que o mestre
liberou.

Esta parte tem três camadas que valem ser entendidas separadas: o **modelo** (o que é uma automação como dado), o **motor**
(como ela roda) e o **editor** (como a pessoa a desenha). Mais uma quarta, pequena: a ferramenta `automacoes` do MCP.

## Onde fica

Modelo, regras puras e conversões, em `packages/shared/src/`:

- `fluxos.ts`: os esquemas zod do fluxo, dos nós e dos fios; `portasDoNo`; as funções das caixas (`conteudoDaCaixa`,
  `numeroDeEspacos`, `pecaDoEspaco`, `pecasDaCaixa`, `noDosFios`, `condicoesDoGatilho`, `ehNoDeValor`); `FluxoSchema`.
- `fluxosCaixas.ts`: o que cabe em cada espaço (`motivoDaRecusa`, `conflitoDaCaixa`), as operações do editor (`moverPeca`,
  `reordenarPeca`, `adicionarEspaco`, `removerEspaco`, `alternarCaixa`, `agruparGatilhos`) e a conversão `portasParaCaixas`.
- `fluxosGrafo.ts`: achar gatilhos, `podeLigar`, `semOsNos`, as medidas da grade (`alturaDoNo`, `larguraDaCaixa`),
  `organizarGrafo` e `arvoreParaGrafo`.
- `fluxosConversao.ts`: do formato do AU1 anterior (ciclos, reações e botões de evento) para fluxos (`migrarAutomacoes`).
- `fluxosValidar.ts`: a conferência em português (`problemasDoFluxo`). `fluxosFrase.ts`: a frase "Em português"
  (`fraseDoFluxo`).
- `automacoes.ts`: a fatia `Estado.automacoes` (`AutomacoesSchema`, `execucao`, `esperando`, `ultimaVez`, `registro`),
  o relógio dos fluxos (`tauDoFluxo`) e o próximo vencimento (`proximoMarcoDasAutomacoes`).
- `automacoesnucleo.ts`: o motor (`rodarAutomacoes`, `executarEvento`, `eventosDoSistema`, `tratarAutomacao`,
  `intencaoDoBotao`). `automacoesLegado.ts` guarda o formato antigo (só leitura) e as constantes `PROFUNDIDADE_MAXIMA`,
  `TETO_DE_ACOES` e `MAXIMO_DO_REGISTRO`.
- `packages/shared/src/mcp/ferramentas/automacoes.ts`: a ferramenta do Claude.

Editor, em `apps/web/src/automacoes/`:

- `CanvasDoGrafo.tsx`: a grade (zoom, fios, arrasto, caixas). `EditorDeFluxo.tsx`: o estado do rascunho, desfazer, salvar.
  `PainelDoBloco.tsx`: os campos de cada bloco. `blocos.ts`: a paleta (`PECAS`), a geometria e os erros por nó.
- `MesaDeEventos.tsx` e `eventosDaMesa.ts`: a mesa de botões. `AutomacaoEmJanelaPropria.tsx` e `EventosEmJanelaPropria.tsx`: as
  janelas próprias.
- `erros.ts`: erros do zod em português. `TourDasAutomacoes.tsx` e `passosDoTour.ts`: o tour.

## Como funciona, de ponta a ponta

```
mestre desenha no editor ──► fluxo.criar / fluxo.editar ──► sala confere (FluxoSchema + problemasDoFluxo)
                                                              │ grava em Estado.automacoes (só o mestre vê)
                                                              ▼
 algo acontece no jogo ──► nucleo.processar ──► rodarAutomacoes(antes) ──► eventosDoSistema(antes, depois)
 (mover token, acender tocha,                                      │            │
  trocar de cena, passar turno)                                    │            ▼
                                                                   │      executarEvento: quais fluxos casam?
 o tempo passa ──► alarme da sala (automacao.marco) ──► avancar ───┤            │
 (relógios, esperas, efeitos que vencem)                           ▼            ▼
                                                              executarNo segue os fios, aplicarAcao muda o estado
                                                                   │
                                                                   ▼
                                       Motor.fechar emite `automacoes.alterado` e `efeitos.alterados`
```

1. O editor guarda um rascunho do fluxo na memória do React. "Salvar" manda `fluxo.criar` (automação nova) ou `fluxo.editar` (as
   mudanças). Os dois exigem a capacidade `automacao.editar`, que só o mestre tem.
2. A sala recompõe o fluxo pelo `FluxoSchema` e roda `problemasDoFluxo`. Havendo problema, recusa com a mesma mensagem que o
   editor mostrou no bloco (a de `dados_invalidos`).
3. Toda intenção que mudou algo passa, em `processar` (`nucleo.ts`), por `rodarAutomacoes(motor, antes)`. O motor compara o
   estado de antes com o de depois (`eventosDoSistema`), descobre "uma tocha acendeu", "um token entrou numa zona", e roda os
   fluxos que esperam esse evento.
4. O tempo avança pelo alarme da sala: um vencimento só, `automacao.marco`, reagendado por `reagendarLuzes` em
   `apps/server/src/sala.ts` com o resultado de `proximoMarcoDasAutomacoes`. Ele acorda a sala na próxima volta de relógio, na
   próxima espera ou no fim do próximo efeito. Mesa pausada: não há alarme, nada anda.
5. Cada rodada do motor trabalha numa cópia da fatia (`structuredClone`) e só emite eventos no `fechar()`, e só se algo mudou.

## Decisões e por quê

**O fluxo é um grafo, não uma árvore (AU2).** O AU1 tinha "um gatilho e trilhas de blocos". O Vilella testou e pediu o
que o n8n faz: "tem que clicar nos botões pra adicionar, isso tá ruim... arrastar livremente os blocos e conectar os fios,
fazer lógicas paralelas também". A árvore não cabe nisso (um bloco só tem um pai). O grafo guarda `nos[]` e `fios[]`, e a
árvore antiga continua existindo só como forma de leitura (`FluxoArvoreSchema`).

**As portas lógicas viraram caixas (AU3).** No AU2, E, OU e NÃO eram nós com entradas ligadas por fio. O Vilella achou "um
pouco diferente do que eu imaginei" e pediu, com a referência do Scratch, "uma caixa com dois espaços, um em cima do outro
e um 'ou' ou 'e' entre elas", aceitando gatilho, condição, ação e outra caixa dentro, com "pode ser dois como default, mas
ter uma opção de ir aumentando". Descartada na conversa a primeira ideia (caixa solta sem espaços fixos). O motor não
mudou de lógica: a caixa é a porta lógica, só que guarda as peças dentro em vez de recebê-las por fio.

**O que roda é o gatilho, não a automação.** Uma automação tem um ou mais gatilhos ("quando"). `executarEvento` percorre os
fluxos ligados e, em cada um, os gatilhos que casam com o evento; cada gatilho que casa dispara a cadeia. Há no máximo um
gatilho de relógio e um de botão por automação (a conferência recusa mais), porque o relógio (`execucao[f.id]`) e o chip do
botão dependem disso.

**Nada de aleatoriedade fora da fonte da sala.** Todo sorteio passa por `Motor.sortear`, que usa a `FonteDeAleatoriedade` que
quem chama dá (`crypto` na sala, semente fixa nos testes). É isso que permite o teste "ouro".

**Efeito temporário é modificador com prazo, nunca o valor base.** `luz.modificar` grava um `Modificador` no objeto (com
`ateSala`) e `visao.limitar` um `Efeito` em `Estado.efeitos`. O mesmo efeito de novo renova o prazo (o id é
`auto:<fluxo>:<nó>`), então repetir não empilha e nada fica preso.

**Limites que protegem a sala.** `MAXIMO_DE_FLUXOS` 60, `MAXIMO_DE_NOS` 120, `MAXIMO_DE_FIOS` 300, 2000 nós percorridos por
disparo (`MAXIMO_DE_PASSOS_POR_DISPARO`), `TETO_DE_ACOES` 500 por disparo, `PROFUNDIDADE_MAXIMA` 5 níveis de sinal encadeado,
200 execuções esperando, 50 disparos atrasados de relógio por vez, 30 avisos no registro. Passou do limite, o motor corta e
anota no `registro` (o mestre os lê em "Avisos do motor" no centro).

**Sigilo.** `Estado.automacoes`, as zonas e os efeitos de zona nunca saem em `visaoPara`/`eventoPara` (o filtro por jogador do
`nucleo.ts`). O jogador recebe só `Estado.botoes` (rótulo, tipo e, no relógio, se está pausado) e o evento `botoes.alterados`.
Quem cria campo novo nessa fatia precisa derrubá-lo para o jogador e acrescentar o frame ao teste de sigilo de
`automacoes.test.ts`.

**A conferência é compartilhada.** `problemasDoFluxo` é uma função pura em `shared`: o editor a usa para pôr o erro no bloco, a
sala para recusar e o MCP para devolver o mesmo texto. Uma regra só, três lugares.

## O modelo (`fluxos.ts`)

### Fluxo, nós e fios

Um `Fluxo` tem `id`, `nome`, `ligado`, `cenas` (as cenas onde vale; `null` ou vazio é todas), `fixado` e
`liberadoParaJogadores` (preferências do chip), `rascunho` (do Claude do mestre: não roda e o jogador não vê), `nos`, `fios` e a
marca `caixas: true`.

Um `No` tem `id`, posição na grade (`x`, `y`), `nome` opcional, o `tipo` e a `config` do tipo, mais os campos de caixa `em` e
`espaco` (abaixo). Os tipos (`TIPOS_DE_NO`):

| Tipo | O que é | Portas |
|---|---|---|
| `gatilho` | o "quando" | saída de ordem `saida` |
| `esperar` | segura o caminho `s` segundos | entrada, saída `saida` |
| `sortear` | tira a sorte com `chance` | entrada, saídas `sim` e `nao` |
| `paraCada` | repete para cada objeto de luz ou token | entrada, saídas `corpo` e `depois` |
| `se` | confere uma condição | entrada de ordem e entrada de valor `condicao`; saídas `sim` e `nao` |
| `acao` | uma ação da lista fechada | entrada, saída `saida` |
| `sinal` | avisa outras automações | entrada, saída `saida` |
| `condicao` | uma condição que só dá verdadeiro ou falso | saída de valor |
| `caixa` | E, OU ou NÃO, com peças dentro | depende do que tem dentro |

Um `Fio` liga `de: {no, saida}` a `para: {no, entrada}`. Há **dois tipos de fio**: `exec`, o fio de ordem (o que roda depois do
quê), e `valor`, o fio de condição (verdadeiro ou falso). Só encaixa fio de um tipo na porta do mesmo tipo (`podeLigar` explica
o motivo; o esquema também confere). Uma entrada de ordem aceita vários fios (`varias`), a de condição do `se` só um.

### Gatilhos, condições e ações

Tudo isso é uma **lista fechada** (união discriminada do zod), nada de código livre:

- **Gatilhos** (`GatilhoSchema`): `relogio` (a cada `cadaS`, opcionalmente depois de `primeiroS`), `botao` (nome, cena, cor e ícone
  da mesa de eventos), `sinal` (nome), `tocha` (acende ou apaga, filtrando por modelo e etiqueta), `zona` (entra ou sai),
  `turno` e `cena`.
- **Condições** (`CondicaoDoSeSchema`): `etiqueta`, `dentroDaZona`, `cena`, `zonaLigada`, `chance` e `tokenDeJogador`.
- **Ações** (`AcaoDeFluxoSchema`): `luz.modificar`, `objeto.apagar`, `objeto.ajustarTempo`, `visao.limitar`, `chat.anunciar`,
  `som.tocar`, `token.mostrar`, `token.ocultar`, `zona.ativar`. As de objeto e de token (`ACOES_DE_OBJETO`,
  `ACOES_DE_TOKEN`) precisam de um alvo: o "para cada" dá o alvo, ou o gatilho (`tocha`, `zona`, `turno`) traz um.
- **"Para cada"** (`AlvoDoParaCadaSchema`): objetos (filtrando por modelo, etiqueta, só acesos, na zona) ou tokens (na zona, na
  cena, por ids).

### `FluxoSchema` e a conferência da forma

`FluxoBaseSchema` tem um `superRefine` que garante só a **forma**: ids de nó únicos, fios entre nós que existem, portas que
existem, tipos de fio compatíveis, sem fio duplicado, entrada que aceita um fio só com um fio, e as regras das caixas (peça
numa caixa que existe, caixa que não se contém, espaço que a caixa tem, um espaço guarda uma peça só). O que é preciso para a
automação **funcionar** (gatilho ligado, "se" com condição, ação com alvo, ciclo sem pausa) é de `problemasDoFluxo`, que fala
português e aponta o bloco. A separação é de propósito: o editor precisa aceitar rascunhos incompletos no meio do desenho, mas a
sala não grava o que não roda.

`FluxoSchema` é `z.preprocess(portasParaCaixas, FluxoBaseSchema)`: tudo o que chega (disco, arquivo, intenção) passa pela
conversão antes da conferência.

## As caixas lógicas (AU3, `fluxosCaixas.ts` e `fluxos.ts`)

### O modelo: `em` e `espaco`

Uma caixa é um nó `caixa` com `config.porta` (`e`, `ou` ou `nao`) e `config.espacos` (quantos espaços tem). As peças dentro dela
**não são filhas numa árvore**: continuam na lista plana `nos`, só que cada uma guarda:

- `em`: o id da caixa onde está;
- `espaco`: o índice do espaço (0 é o de cima).

Uma peça guardada **não tem portas** (`portasDoNo` devolve vazio quando há `em`) e **não tem fios próprios**. Quem se liga é a
caixa. A caixa pode estar dentro de outra caixa (até `NIVEIS_DE_CAIXA` = 4). Essa escolha, `em` e `espaco` em vez de
`filhos: No[]`, manteve o esquema plano: o motor, os fios, a seleção e a conversão trabalham todos sobre a mesma lista, e o
formato do AU2 evoluiu sem mudar o resto.

Regras do tamanho: a E e a OU nascem com 2 espaços (`MINIMO_DE_ESPACOS`) e vão até 12 (`MAXIMO_DE_ESPACOS`); a NÃO tem sempre um.
`numeroDeEspacos` é o maior entre o mínimo, o `config.espacos` e o que as peças de dentro já ocupam (assim um espaço nunca some
com peça nele).

### `conteudoDaCaixa`: o que a caixa dá de saída

A caixa não tem tipo de saída fixo: vem **do que está dentro** (`conteudoDaCaixa`):

- tem gatilho dentro (gatilho OU gatilho, ou gatilho E condição) → `gatilho`: saída de ordem, "Dispara";
- tem ação ou sinal dentro (ação E ação, ação OU ação) → `acao`: entrada e saída de ordem, como um bloco de ação;
- só condições (ou caixas de condição) → `valor`: saída de valor, "Vale", que se liga à entrada `condicao` de um "se" ou a outra
  caixa;
- nada dentro → `vazia`, que conta como de valor.

A mistura que não combina conta pelo gatilho, depois pela ação (o erro é apontado à parte). `portasDoNo` usa isso para dar a
caixa as portas certas, e `ehNoDeValor(no, nos)` para saber em que "mundo" a caixa mora (fios de ordem ou de valor). `organizarGrafo`
e a conferência de ciclos dependem dessa pergunta.

### `motivoDaRecusa`: o que cabe onde

Ao soltar uma peça num espaço, `motivoDaRecusa(nos, pecaId, caixaId, destino)` devolve `null` se pode, ou a dica curta do
porquê. Confere, em ordem:

1. Só gatilho, condição, ação, sinal e outra caixa entram (esperar, se, sortear e para cada ficam na grade).
2. O espaço existe, está livre (ou a ocupante é a própria peça), e o limite de 12 espaços e 4 níveis.
3. Uma caixa não cabe dentro dela mesma nem de uma caixa dela.
4. Simula o resultado (`colocar`) e roda `conflitoDaCaixa` na caixa de destino **e em cada caixa de fora**, subindo.

`conflitoDaCaixa` é a tabela do que combina, pelo que cada peça dá de saída:

| Caixa | Vale | Recusa |
|---|---|---|
| OU | gatilho OU gatilho; condição OU condição; ação OU ação (sorteia) | gatilho OU condição ("um gatilho com uma condição precisa do E") |
| E | gatilho E condição; condição E condição; ação E ação (faz as duas) | gatilho E gatilho ("dois acontecimentos não chegam no mesmo instante") |
| NÃO | uma condição ou uma caixa de condição, num espaço só | gatilho ou ação dentro; mais de um espaço |
| qualquer | | ação misturada com gatilho ou condição |

O passo 4 propaga o conflito às caixas de fora porque pôr um gatilho numa caixa interna muda a natureza da externa. Foi um caso
real: `caixas.test.ts` ("o conflito se propaga às caixas de fora").

### `colocar` e `moverPeca`: crescer e encolher

`colocar` é a operação pura que move a peça: tira da caixa velha, põe na nova (ou na grade, com `x`, `y`). O destino pode ser
`{espaco}` (um espaço que já existe) ou `{inserirEm}` (abrir um espaço novo ali, empurrando os de baixo uma posição: soltar
entre dois espaços ou logo abaixo do último). Tirar a peça de um espaço de uma caixa com mais de 2 **remove o espaço** e sobe
os de baixo; com 2, o espaço fica vazio.

`moverPeca` acrescenta o resto: confere `motivoDaRecusa`, **apaga os fios da peça guardada** (ela só se liga pela caixa) e,
se a peça é um gatilho e a caixa ainda não tinha fio de saída, a caixa **herda os fios do gatilho** (mover um gatilho com fios
para dentro de uma caixa não desliga a automação). Depois `fiosValidos` tira os fios que deixaram de fazer sentido (a saída da
caixa mudou de tipo). `moverPeca`, `adicionarEspaco`, `removerEspaco`, `alternarCaixa` (trocar E por OU pelo rótulo; só vale se as
peças combinam com a nova) e `reordenarPeca` (subir e descer; troca com a vizinha) devolvem `{ok, fluxo}` ou `{ok:false, motivo}`
e não tocam em estado nenhum: o editor chama, mostra o motivo no aviso e só então muda o rascunho.

`agruparGatilhos` é o atalho: soltar um gatilho em cima de outro cria uma caixa OU na posição do de baixo, com os dois nos
espaços 0 e 1, herdando os fios dos dois sem duplicar destinos.

### Como o motor lê uma caixa

Dois caminhos, em `automacoesnucleo.ts`:

- **Valor** (`valorDoNo`): uma caixa de valor avalia as peças de dentro (recursivamente), na ordem dos espaços. E é `every`
  (e precisa de pelo menos uma), OU é `some`, NÃO é "nenhuma vale" (com pelo menos uma). O resultado é memorizado por nó
  (`memo`): cada nó vale **uma vez por conferência**, e uma `chance` dentro de duas caixas sorteia uma só vez por conferência.
  A `pilha` impede ciclo.
- **Ordem**: um gatilho guardado numa caixa, ao disparar, procura em `condicoesDoGatilho` as outras peças de cada caixa **E** acima
  dele que sejam condições. Só segue se todas valem. Depois `seguir(noDosFios(...), "saida")`, ou seja, segue os fios da caixa
  **mais de fora**, não os do gatilho (que não tem). Uma caixa de ação roda `executarPecaDeAcao`: E faz todas as peças de cima
  para baixo; OU **sorteia uma**.

O sorteio da caixa de ação OU com `n` peças usa `m.sortear(1/(n-i))` para cada `i` até acertar (a última é o resto). Com duas é
50/50; com três, 1/3 cada, mas gastando de 1 a 2 sorteios. Isso importa para a ordem do RNG (abaixo).

## As conversões

Há **três gerações** do formato guardadas no disco e em arquivos de campanha, e as três precisam continuar abrindo. A regra do
projeto é "nada se perde": tudo converte na leitura, sem migração SQL, porque as automações moram numa chave da `meta`.

```
 ciclos + reações + botões   ──migrarAutomacoes──►  árvore (AU1)  ──arvoreParaGrafo──►  grafo com portas (AU2)
 (7b, forma antiga)            (fluxosConversao)                    (fluxosGrafo)                │
                                                                                                 │ portasParaCaixas
                                                                                                 ▼
                                                                                   grafo com caixas (AU3, atual)
```

### Da forma antiga para a árvore, e da árvore para o grafo

`migrarAutomacoes` é o `preprocess` do `AutomacoesSchema`. Se a fatia traz `ciclos`, `reacoes` ou `botoes`, converte em fluxos
(`converterParaArvores`) e guarda o original em `legado`. A regra:

- um **ciclo** vira um fluxo de relógio com **uma trilha por fase** (esperar o `emS`, depois o que a fase faz);
- uma **reação** só é embutida na trilha da fase quando o evento tem **um único emissor** e todas as reações que o ouvem estão
  ligadas e fora de rascunho (`podeEmbutir`); senão vira um fluxo "ao receber o sinal" e o ciclo manda o sinal;
- um **botão de evento** vira um fluxo de botão que manda o sinal;
- uma reação de zona num evento que não é de zona ganha "se a zona está ligada" (para não mudar o que ela fazia).

`arvoreParaGrafo` converte a árvore em grafo: cada bloco vira um nó; "se" e "sortear" ligam o fim dos dois ramos no bloco
seguinte; "para cada" liga o `depois` no seguinte; trilhas paralelas saem do gatilho em fios separados. As posições vêm de
`organizarGrafo`. `lerFluxoDeQualquerForma` é o `preprocess` que detecta a árvore (tem `gatilho` e `trilhas` e não tem `nos`).

Dois efeitos colaterais conhecidos: **as esperas guardadas no formato da árvore caem** ao carregar (o caminho era uma posição de
bloco, que não existe mais), e o relógio de um ciclo antigo recomeça no próximo período.

### `portasParaCaixas`: o AU2 vira AU3

`portasParaCaixas` roda no `preprocess` do `FluxoSchema`, **antes** do esquema, sobre o valor cru (trabalha em objetos soltos, não
no tipo, porque o que vem do disco ainda não foi validado). Passo a passo:

1. **Sai cedo** se não há nó `porta`, nenhuma peça guardada sem `espaco` e o fluxo já tem a marca `caixas: true`. Por isso a
   conversão é idempotente (há teste: converter duas vezes não muda nada).
2. **Cada `porta` vira `caixa`.** As entradas dela (os nós que tinham fio chegando) passam a morar nos espaços, na ordem dos
   fios. Uma porta com três entradas vira uma caixa com **três espaços**, sem aninhar à força (A ou B ou C).
3. **A peça que servia a mais de uma porta é copiada** (`copiar`), com o que ela tinha dentro; a última a usá-la fica com a
   própria peça. Isso evita perder uma condição usada em dois lugares, mas tem custo: o fluxo convertido tem nós duplicados.
4. A caixa que passa de 12 entradas põe o resto numa caixa dentro do último espaço (`guardar`).
5. **Gatilhos que chamam exatamente os mesmos blocos** (os "vários gatilhos ligados ao mesmo bloco" do AU2, que eram um OU
   implícito) viram uma caixa OU, um gatilho por espaço. A caixa herda os fios. Esse agrupamento só vale **uma vez**: a marca
   `caixas: true` impede reagrupar depois (senão uma pessoa que de propósito deixou dois gatilhos soltos no mesmo bloco os veria
   juntar-se sozinhos a cada abertura).
6. Quem ficou guardado sem `espaco` vai no primeiro espaço livre.

### O teste "ouro" e por que ele importa

O risco de mexer no formato é mudar **o que a mesa faz** sem perceber. Os testes de unidade conferem cada pedaço, mas só um
teste de ponta a ponta pega "o motor novo sorteia numa ordem diferente do antigo".

`packages/shared/src/ouro.test.ts` faz isto: carrega `5e-padrao.json`, importa por cima a campanha `chama-primordial.json`
(que está no **formato antigo**, com `ciclos` e reações; passa por todas as conversões acima), põe 9 tochas acesas e 3 tokens em
posições fixas, e roda **600 segundos simulados** com semente fixa (`fonteComSemente(20261113)`), chamando `processarSistema` a
cada segundo e fazendo ações do mestre em instantes combinados (usar o botão da rajada no 50 s, mover tokens para dentro e fora
das zonas, apagar e reacender uma tocha). A cada segundo em que algo muda, anota uma linha: o estado e o saldo de cada luz, os
limites de visão e as mensagens novas do chat. O resultado tem de ser **igual** ao guardado em
`privado/fixtures/ouro/chama-primordial-10min.json`. A campanha e o ouro ficam só no computador do mestre (a pasta
`privado/` não entra no git); sem eles o teste pula.

A fixture nasceu no commit do AU1 (o cabeçalho do teste diz que o motor de fluxos tem de chegar ao mesmo resultado do motor de
ciclos e reações do 7b) e continua batendo depois do AU2 e do AU3. Isso é a prova de
que as conversões preservam o comportamento, **incluindo a ordem em que o RNG é consumido**: se uma conversão trocasse a ordem
em que dois sortear acontecem, as tochas que apagam seriam outras, e o ouro quebraria. Só se regrava de propósito:
`OURO_GRAVAR=1`. Se o ouro falhar depois de uma mudança, trate como bug na mudança até provar o contrário; regravar é decisão
que muda o comportamento da campanha para sempre.

Outros testes: `fluxosConversao.test.ts` (as regras da conversão da forma antiga, caso a caso), `caixas.test.ts` (a conversão
do AU2 para caixas: três espaços, peça copiada, idempotência, "dois gatilhos soltos continuam do jeito que estão") e
`grafo.test.ts` (o motor do grafo, a conferência, a árvore que vira grafo).

## O motor (`automacoesnucleo.ts`)

### Os gatilhos que casam

`executarEvento(m, ev, profundidade)` recebe um `EventoDeAutomacao` com `nome`, `cenas`, `origem` (`sistema`, `reacao`, `ciclo` ou
`manual`) e opcionalmente `objetoId`, `tokenId`, `zonaId`, `modeloId`. Para cada fluxo ligado e fora de rascunho,
`gatilhosQueCasam` filtra os nós `gatilho` pela função `gatilhoCasa`:

- evento do **sistema** (`objeto.acendeu`, `objeto.apagou`, `token.entrouNaZona`, `token.saiuDaZona`, `turno.inicio`,
  `cena.ativada`): casa com o gatilho do tipo certo, respeitando os filtros (modelo, etiqueta, zona, cena);
- evento de **sinal** (`origem: "reacao"`): casa com `gatilho.tipo === "sinal"` de mesmo nome.

Relógio e botão **não passam por aqui**: eles disparam direto (`executarFluxoDireto`), cada um pelo seu caminho.

Os eventos do sistema vêm de uma **diferença entre estados** (`eventosDoSistema(antes, depois)`), não de ganchos nas intenções.
A vantagem é que vale para qualquer intenção, para o tempo que passa e para as ações dos próprios fluxos. O custo (apontado na
`PASSAGEM`): uma mudança de objeto que não passe por evento de protocolo não dispara reação. "Entrou na zona" vem de
`entradasESaidas`, que compara quem estava dentro antes e depois, e só sai uma vez por mudança.

Uma consequência do código que vale saber: se **dois gatilhos de um mesmo fluxo casam com o mesmo evento** (por exemplo, dois
gatilhos "sinal X" dentro da mesma caixa OU), a cadeia roda **uma vez só** (LP1): a `Rodada` guarda em `seguidas` as saídas já seguidas e o gatilho guardado que chega depois, com a mesma caixa de fora, não segue de novo (`noDosFios`). Gatilhos soltos, cada um com os seus fios, continuam rodando cada um a sua cadeia. Teste: `automacoes.test.ts` ("LP1").


### O escopo de cenas: `escopoDoFluxo`

Cada fluxo pode estar preso a cenas (`f.cenas`); cada evento traz as cenas em que aconteceu (`ev.cenas`, onde `null` significa
"vale em todas"). Desde o AU4 o fluxo também pode ter `naCenaAtiva: true` ("Cena ativa" no painel): a cena onde o grupo está
**no instante do disparo** (`estado.cenaAtivaId`) entra na lista do fluxo, somada às marcadas. `escopoDoFluxo(f, evCenas,
cenaAtivaId)` monta essa lista e a cruza com a do evento:

- fluxo sem cenas (ou lista vazia) e sem "Cena ativa" → vale o escopo do evento;
- evento sem cenas (`null`) → vale o escopo do fluxo;
- os dois com cenas → a **interseção**; se for vazia, o resultado é `"nunca"` e o fluxo não roda para esse evento.

O escopo vira o `cenas` do contexto da execução, e é ele que filtra o que o "para cada" enxerga (`naEscopo` para objetos,
`cenas.includes(t.cenaId)` para tokens). A cena de um objeto de luz vem de `cenaDoObjeto` (o portador: cena, token, ponto ou mão).
Dentro do "sim" de um "se na cena X", `estreitar` reduz o escopo a X.

Como o escopo é calculado no disparo e viaja no contexto, uma automação com "Cena ativa" que começou na cena A continua na A
depois de um "esperar", mesmo que o mestre leve o grupo para a B no meio (assumido no AU4). E um evento numa cena que não é a
ativa (um token andando numa cena de fundo) não dispara um fluxo que só vale na ativa: a interseção dá `"nunca"`. Frágil: os dois
pontos que chamam `escopoDoFluxo` (`executarEvento` e `executarFluxoDireto`) têm de passar `m.ctx.atual().cenaAtivaId`; e o
`fluxo.editar` junta as mudanças com o que a sala tinha, por isso o salvar do editor manda `naCenaAtiva: false` explícito ao
desmarcar (`EditorDeFluxo.tsx`; o `au4.spec.ts` confere).

### O contexto da execução

O `ContextoDoFluxo` que anda pelos fios tem `cenas` (o escopo), `objetoId`, `tokenId` e `zonaId`: **quem está "na vez"**. O gatilho o
preenche com o objeto, token ou zona do evento; o "para cada" o substitui, para cada alvo, por `{objetoId}` ou `{tokenId}`. Toda
condição e toda ação de objeto ou de token lê dali. Uma ação de token sem `tokenId` usa quem carrega o objeto da vez
(`tokensDaAcao`). Ação que precisa de alvo e não o tem **não faz nada e anota no registro** ("ficou sem alvo"); o editor avisa
antes (a conferência `ACOES_DE_OBJETO` e `ACOES_DE_TOKEN`).

A conferência prevê isso sem rodar: em `problemasDoFluxo`, uma busca em largura a partir de cada gatilho carrega "quem está na
vez" (objeto, token, sinal ou nada) e, ao passar pelo `corpo` de um "para cada", troca para objeto ou token. Uma ação de objeto
fora de um "para cada" de objetos recebe "ponha-a depois de um 'para cada' de objetos".

### "Para cada", "esperar" e "sortear", e a ordem do RNG

**"Para cada" (`paraCada`).** Calcula a lista de alvos do escopo atual (`objetosDoParaCada` ou `tokensDoParaCada`, respeitando a
zona: zona desligada devolve lista vazia). Para **cada** alvo, `seguir(..., "corpo", contextoDoAlvo)` roda a cadeia inteira do
corpo antes de passar ao alvo seguinte. Terminados todos, `seguir(..., "depois", ctxOriginal)` segue com o contexto de antes do
laço.

**"Esperar" (`esperar`).** Não bloqueia nada: grava um `Esperando` em `slice.esperando` com `ateSala = referenciaSala + s*1000`, o
id do **nó** (`no`), a profundidade e o **contexto completo**, e **termina o caminho ali**. O que vem depois só roda quando
o relógio chega: `avancar` pega as esperas vencidas (ordenadas por `ateSala`), e `retomar` chama `seguir` a partir da saída do
nó guardado, com o contexto guardado. Por isso um "esperar" dentro de um "para cada" segura só aquele alvo: o contexto dele
foi guardado, e o `depois` do laço não espera por ninguém. A espera mora no estado, então **sobrevive à hibernação** do Durable
Object (há teste). A `referenciaSala` de uma retomada é o `ateSala` da espera (e não "agora"), para uma espera de 90 s depois de
outra de 90 s somar certo mesmo que o alarme atrase.

Frágil: `Esperando.no` guarda o **id do nó**. Mudar a estrutura do fluxo cancela as esperas dele (e zera o relógio): em
`fluxo.editar`, se mudou `[id, tipo, config, em]` de algum nó ou os fios, `esquecer(id)` apaga `execucao` e `esperando`. Mudar só
posição (`x`, `y`), nome, `espaco` ou o `fixado` não cancela.

**"Sortear" (`sortear`).** Segue `sim` com `m.sortear(chance)`, senão `nao`. `Motor.sortear` tem um detalhe que o ouro depende:
com probabilidade 1 ou 0 **não gasta sorteio**; senão chama `aleatorio(1_000_000)`. Portanto trocar uma chance de 100% por
99,99% muda a sequência do RNG de tudo que vem depois.

**A ordem do RNG.** O RNG é único e sequencial. Quem decide a ordem é a **ordem dos fios** (`seguir` varre `fluxo.fios` na ordem
da lista) e a ordem dos espaços da caixa. Por isso:

- `arvoreParaGrafo` cria os fios na ordem das trilhas;
- `portasParaCaixas` põe as peças nos espaços na ordem dos fios;
- a caixa de ação OU sorteia na ordem das peças;
- a condição `chance` sorteia uma vez por conferência (memo), na ordem em que o `se` a avalia.

Qualquer conversão ou operação do editor que reordene fios, nós ou espaços muda quem sorteia primeiro, e portanto o resultado
com a mesma semente. É a razão de o ouro ser o teste mais importante desta parte.

### Sinais, encadeamento, profundidade e corte

Um nó `sinal` não executa nada na hora: junta um `Encadeado` (`nome`, `atrasoS`, contexto) em `rd.encadeados`. Quando a rodada do
evento termina, `fecharDisparo`:

1. Para cada encadeado **sem atraso**, chama `executarEvento` com `origem: "reacao"` e `profundidade + 1`. Com atraso, grava um
   `Esperando` do tipo sinal (`sinal: nome`) com `profundidade + 1`; quando vence, `retomar` o executa.
2. Calcula de novo `eventosDoSistema(antes, depoisDasAcoes)`, porque as ações dos fluxos mudam o jogo (uma tocha que apagou) e
   isso também é evento, um nível abaixo.

A **profundidade** conta os níveis de encadeamento. Passou de `PROFUNDIDADE_MAXIMA` (5), `executarEvento` corta e anota "Encadeamento
cortado". O **corte** em geral é uma bandeira (`m.cortado`) que todo laço consulta: o teto de 500 ações por disparo
(`Motor.contar`) e o de 2000 passos (`executarNo`) a levantam, e a execução inteira para. Quem manda o sinal e quem o recebe se ligam só pelo nome. Um laço de sinais ("A manda um sinal que dispara A") é barrado pela
profundidade; o ciclo de fios dentro do mesmo fluxo só vale com um "esperar" de pelo menos 1 s (`ESPERA_MINIMA_DO_CICLO_S`) no
caminho, e é a conferência que o exige (o motor ainda tem os 2000 passos como rede de segurança).

### O relógio

A "fase" de um relógio é o tempo **do fluxo**, τ (tau), em ms: `tauDoFluxo = salaMs − baseSala`, ou o valor congelado
`pausadoEmTau` se está desligado. `execucao[f.id]` guarda `baseSala`, `pausadoEmTau?` e `proximoTau`. Em `avancar`, para cada fluxo
com gatilho de relógio, ligado e fora de rascunho:

1. Sem execução ainda (veio de arquivo ou foi criado com a mesa pausada), cria uma começando agora, com `proximoTau =
   primeiroS*1000` (padrão 0: dispara já).
2. Enquanto `proximoTau <= tau`, dispara e soma `cadaS*1000`. O instante **planejado** (`baseSala + proximoTau`), e não o de agora,
   é a referência das esperas, então o atraso do alarme não desloca o que vem depois.
3. Mais de 50 disparos de uma vez (a mesa ficou parada muito tempo): pula para o próximo múltiplo e anota "disparos demais
   atrasados".

**Desligar** (`fluxo.ligar`) grava `pausadoEmTau` e apaga as esperas do fluxo (menos sinais); **ligar** recalcula `baseSala = sala −
pausadoEmTau`, ou seja, **continua de onde parou**. Pausar a mesa não precisa de nada disso: `tempoDaSala` já fica congelado
(Lote 7, o relógio da sala; ver `03-sala-e-sincronizacao.md`), e `rodarAutomacoes` nem corre com a mesa pausada (exceto para
reagir a eventos do sistema).

### Zonas e efeitos

As zonas e os efeitos "enquanto dentro" são do mesmo motor, mas de natureza diferente: **são reconciliados, não disparados**.
`sincronizarZonas`, chamada no fim de toda passada, calcula o que **deve** valer (cada luz dentro de uma zona ligada leva um
modificador `zona:<zona>` sem prazo; cada token dentro leva um efeito `zona:<zona>:<token>` com o limite de visão) e compara com
o que **está** (todo modificador ou efeito com o prefixo `zona:`), trocando a diferença. Rodar duas vezes não muda nada. A
vantagem é que desligar a zona, apagá-la, mover o token, trocar de cena e apagar o token nunca deixam efeito preso, sem precisar
de um evento de saída para cada caminho. Quem criar outro tipo de modificador não pode usar o prefixo `PREFIXO_DE_ZONA`.

Os eventos `token.entrouNaZona` e `token.saiuDaZona` existem à parte, para os gatilhos de zona. Detalhes das zonas em `05-mapa-luz-e-visao.md`.

### Intenções, botões e a conferência

`tratarAutomacao` trata `fluxo.criar|editar|apagar|ligar|disparar`. `fluxo.editar` junta `{...atual, ...mudancas}` e reconfere o
fluxo inteiro (assim o editor pode mandar só o que mudou). O botão é separado: `botao.usar` não tem capacidade própria; é
`intencaoDoBotao` que o transforma em `fluxo.disparar` ou `fluxo.ligar`, e **a conferência é a liberação**: o mestre usa qualquer
botão, o jogador só os com `liberadoParaJogadores`, e botão inexistente ou não liberado dá o mesmo erro `sem_permissao` (o jogador
não descobre o que há por trás). A sala ainda limita a 1 disparo a cada 2 s por jogador.

### Testes que vigiam o motor

`packages/shared/src/automacoes.test.ts` (o motor, o sigilo, os limites), `grafo.test.ts` (paralelo, chegada múltipla, esperar
que sobrevive à hibernação, ciclo com e sem pausa), `caixas.test.ts` (o motor com caixas: gatilhos, condições, ações, OU
sorteando, E com condição), `zonas.test.ts` (reconciliação) e o `ouro.test.ts`. No navegador, `e2e/tests/automacoes.spec.ts`,
`au1.spec.ts`, `au2.spec.ts` e `au3.spec.ts`.

## A mesa de eventos

É uma mesa de botões grandes (no estilo da de som, que o Vilella já conhecia), **só com os gatilhos de botão**: um por automação
cujo gatilho é `botao`. Foi pedida no AU2: "uma mesa de eventos (estilo a de áudio) só com botões".

- `botoesDaMesaDeEventos(estado, euMestre)` (`eventosDaMesa.ts`) monta a lista. O mestre vê todos os fluxos com gatilho de botão (os
  desligados aparecem apagados e ainda disparam, como no chip; os rascunhos do Claude não aparecem). O jogador vê **só o que
  `estado.botoes` traz**: os liberados, e só rótulo, cor e ícone.
- Clicar chama `botao.usar` com `evento:<fluxo>`. O botão brilha e diz "Disparou" por 900 ms (a mesa não espera a resposta: o
  retorno é do clique).
- O nome mostrado é o do **gatilho**, não o da automação, e a cor e o ícone vêm dele (padrão âmbar e chama).
- Aparece de três formas: janela flutuante, faixa no pé da tela (acima da faixa do som; os avisos e o zoom sobem por
  `--faixa-dos-eventos`) ou janela própria do navegador (`/m/<id>/eventos`). A escolha de janela ou faixa e o recolhimento ficam
  em `localStorage` (`tabletop:pref:eventos-modo`), por navegador, e nunca vão à sala.

## O editor (`apps/web/src/automacoes/`)

O editor **só abre numa janela própria do navegador** (`AutomacaoEmJanelaPropria`, rota `/m/<id>/automacao/<fluxoId>` ou
`/automacao/nova`), como a ficha e a mesa de som: pedido do Vilella ("clicar em editar ou adicionar já tem que criar uma nova
janela automático"). A janela tem a própria conexão com a sala (`useSala`), a mesma sessão, e a janela principal sabe que ela
existe. `?g=<gatilho em JSON>` nasce com um gatilho pronto (o "+ automação para esta zona"), e `?tour=1` abre com o tour.

`EditorDeFluxo` guarda o `rascunho` do `Fluxo` num estado do React, com um histórico de até 50 cópias para o Desfazer. Toda
operação do editor (`moverPeca`, `alternarCaixa`...) vem de `shared` e é pura: devolve `{ok, fluxo}` ou `{ok:false, motivo}`; o
editor mostra o motivo numa faixa de aviso. O fluxo só vai à sala em "Salvar" (`salvar`), que **recusa localmente** enquanto
`errosDoFluxo` não estiver vazio ("Corrija estes N pontos para salvar") e depois manda `fluxo.criar` ou `fluxo.editar`. O que
`enviar` devolve é o id do pedido, não um erro: a recusa da sala chega pelo aviso da mesa.

### `CanvasDoGrafo`: a grade

A grade é um `div` com uma camada interna que recebe `transform: translate(x, y) scale(k)`; os nós são elementos HTML
posicionados em coordenadas da grade, e os fios são **um SVG** na mesma camada. `naGrade(clientX, clientY)` converte a posição
da tela em coordenadas da grade, descontando a vista.

- **Zoom** com a roda (`ZOOM_MINIMO` 0,25 a `ZOOM_MAXIMO` 2), registrado direto no elemento com `passive: false` (o React registra a
  roda como passiva e não deixaria `preventDefault`); o zoom é em torno do ponteiro.
- **Fundo**: arrastar move a vista; Shift ou Ctrl com arrasto faz a caixa de seleção; dois dedos fazem pinça.
- **Enquadrar**: a primeira vista usa um `ResizeObserver` para só enquadrar quando o tamanho da tela já é conhecido (antes, o
  primeiro nó nascia cortado na borda).
- **Teclado**: Tab, setas, Enter, Delete e o menu "Ligar a…" (o caminho do teclado para ligar) e "Caixa…" (tirar, pôr num
  espaço, subir e descer).

### Os fios

Cada fio é um `path` de curva de Bézier (`caminhoDoFio`) do ponto da porta de saída ao da entrada, mais um segundo `path` grosso e
transparente (`ed-fio-alvo`) para o clique ser fácil. **Os pontos das portas não são medidos no DOM**: `pontoDaPorta` (`blocos.ts`)
calcula, a partir da posição do nó, da largura (`larguraDoNo`), da altura (`alturaDoNo`) e do índice da porta entre as portas do
lado. Medir o DOM seria mais exato mas obrigaria a medir de novo a cada render e a cada zoom, e o resultado depende de uma
renderização que o fio precisa ter **antes** de existir. Em troca, o desenho tem de seguir exatamente as medidas do código: o
próximo trecho trata disso.

Para ligar, `aoApertarSaida` põe um fio provisório que acompanha o ponteiro; ao soltar, `document.elementFromPoint` acha a porta
de entrada sob o ponteiro (`data-lado='entrada'`) ou, soltando no corpo de um nó, a primeira entrada do tipo certo que aceita o fio.
`podeLigar` decide e, se recusar, o motivo vai ao aviso. Detalhe de CSS: as portas usam `ed-porta-ent` e `ed-porta-sai`, porque
os nomes simples `.entrada` e `.saida` já pegaram regras de outras telas.

### O arrasto com `elementsFromPoint`

**O problema.** Arrastar uma peça por cima de uma caixa precisa saber qual espaço está debaixo do ponteiro. Mas a própria peça
arrastada, sendo um elemento, é o que está debaixo do ponteiro, e esconderia o alvo.

**A solução.** No primeiro movimento (4 px de limiar, para o clique simples não virar arrasto), o editor põe `data-arrastando` no
elemento da peça, e o CSS faz `opacity: .55; pointer-events: none` nele (`.ed-no[data-arrastando], .ed-no-dentro[data-arrastando]`).
Com `pointer-events: none`, o elemento deixa de receber o ponteiro e `document.elementsFromPoint(x, y)` devolve a pilha do que está
**atrás**. `alvoSob(x, y, ignorar)` percorre essa pilha e, em cada elemento, sobe com `closest` procurando, nesta ordem:

1. `[data-espaco-de]`: um espaço existente → `{espaco: n}`;
2. `[data-separador-de]`: o rótulo entre dois espaços → `{inserirEm: n}` (abre um novo ali);
3. `[data-fim-de]`: o pé da caixa → `{inserirEm: n}` (um novo no fim);
4. `[data-caixa-id]`: a borda da caixa → o espaço mais perto na vertical (compara `getBoundingClientRect`).

`ignorar` é a própria caixa da peça (uma caixa não pode cair dentro de si). Enquanto arrasta, `motivoDaRecusa` roda a cada movimento
e o espaço alvo acende em verde (cabe) ou vermelho (recusa, com a dica em `ed-solta-dica`). Soltar chama `aoEncaixar` e o editor
usa `moverPeca`. Se não há caixa embaixo e a peça é um gatilho solto, `gatilhoSob` procura outro gatilho solto (atalho que cria uma caixa OU).

Duas variações do mesmo mecanismo:

- A **peça guardada** não anda pela grade durante o arrasto (ela vive dentro da caixa); mostra-se um "fantasma" que segue o
  ponteiro (`ed-fantasma`), e soltar fora de qualquer caixa a leva de volta à grade na posição do ponteiro.
- A **peça nova da paleta** usa o arrasto nativo do HTML (`dragstart`/`dragover`/`drop`), e o navegador **não deixa ler o que se
  arrasta antes de soltar**. Por isso `arrastandoPeca` é uma variável de módulo (`blocos.ts`) que o `dragstart` preenche; o
  `dragover` lê dela. `motivoDaNovaPeca` simula a peça com um nó temporário `__nova` para reaproveitar `motivoDaRecusa`.

**Frágil.** Os atributos `data-espaco-de`, `data-separador-de`, `data-fim-de`, `data-caixa-id` e `data-no-id` são o contrato entre o
desenho e o arrasto; classes ou `data-*` novos com nome parecido numa tela vizinha podem ser pegos pelo `closest`. `ed-caixa` já é a
seleção por retângulo; as caixas lógicas usam `ed-caixa-logica`. Teste: `au3.spec.ts` (arrastar, soltar entre espaços, recusa,
teclado).

### A altura das caixas tem de bater com o CSS

**O problema.** Como os fios não medem o DOM, a altura de uma caixa é **calculada** em duas partes que precisam concordar
centímetro por centímetro: o número que o JavaScript usa para posicionar as portas e organizar a grade, e o que o CSS de fato
desenha.

**Como é calculada** (`alturaDoNo` em `fluxosGrafo.ts`, com as constantes exportadas):

```
altura de uma caixa E/OU com n espaços =
    MARGEM_DA_CAIXA (6)
  + soma das alturas de cada espaço          (peça guardada: ALTURA_DA_PECA 40; vazio: ALTURA_DO_ESPACO_VAZIO 44;
                                              caixa aninhada: a altura dela, recursivamente)
  + (n - 1) * (ALTURA_DO_ROTULO 22 + 2 * VAO_DA_CAIXA 4)     o rótulo E/OU entre cada par, com um vão em cada lado
  + VAO_DA_CAIXA (4) + ALTURA_DO_MAIS (24)                     o pé com o "+"
  + MARGEM_DA_CAIXA (6)
```

A NÃO tem o rótulo "NÃO" no topo e um espaço, sem separador nem pé. O CSS (`.ed-no.ed-caixa-logica` em `styles.css`) é um `flex`
em coluna com `gap: 4px`, rótulo de 22 px, pé de 24 px, peça de 40 px, espaço vazio de 44 px, e `padding: 5px` mais a borda de
1 px, que dão os 6 px de margem. Conferindo a conta: os `2n - 1` vãos de 4 px do `gap` somados aos separadores de 22 px dão
`30n - 26`, que é o mesmo que a fórmula acima (`30(n-1) + 4`). A largura também cresce com o aninhamento (`larguraDaCaixa`:
`LARGURA_DA_CAIXA` 250 mais `RECUO_DA_CAIXA` 26 por nível).

**O defeito do AU3b.** O espaço com peça era desenhado com a altura de **bloco solto** (60 px, ou 84 com duas portas), vinda de
`alturaDoNo` da **web** (`blocos.ts`), e não os 40 px que a caixa contava para a peça (`ALTURA_DA_PECA`). Cada peça empurrava a
de baixo uns 20 px, e com 3 ou 4 peças o último espaço e o "+" vazavam pelo pé da caixa. O erro era invisível com 1 ou 2 peças.
A correção está no `alturaDoNo` da web: `if (no.em !== undefined) return ALTURA_DA_PECA`. Existem **duas** `alturaDoNo` (a de
`shared` e a da web) porque a da web também decide a de nós soltos (60 ou 84, conforme as portas) e delega a da caixa à de `shared`.

**O que quebra se mexer sem cuidado.** Mudar uma constante de `shared` sem mudar o CSS (ou o contrário) desalinha os fios das portas
da caixa, e o desvio cresce com o número de peças. Testes: `grafoDoEditor.test.ts` ("a peça guardada numa caixa tem a altura que
a caixa conta para ela (o pé da caixa não vaza)", que falha sem a correção: dava 60 em vez de 40) e, no navegador,
`esperarTudoDentroDaCaixa` em `au3.spec.ts`, que mede com `getBoundingClientRect` se os espaços e o pé cabem na borda da caixa,
de fora e de dentro.

### A frase "Em português" (`fluxosFrase.ts`)

`fraseDoFluxo(fluxo, nomes)` conta a automação em linguagem humana, sem nunca mostrar um id: "A cada 3 min, na cena Pulmão: cada
tocha acesa fica com metade da luz por 20 s e tem 30% de chance de apagar (perde 5 min)". Aparece embaixo do editor, na lista, e
é o que o `explicar` do MCP devolve. É pura: recebe `NomesParaAFrase` (um jeito de achar o nome de cada cena, modelo e zona, com
"(apagado)" para o que sumiu).

O trabalho difícil é transformar um **grafo** em **uma frase linear**:

- A cabeça junta os gatilhos soltos e as caixas de gatilho: "Quando qualquer um destes acontecer (a, ou b)" (caixa OU), "a, mas só
  se c" (gatilho E condição).
- `textoDaCadeia` segue a cadeia de ordem de um nó ao seguinte, juntando as ações em pedaços ("faz isso; 90 s depois, faz aquilo");
  um `esperar` abre um novo segmento com o tempo.
- Dois fios saindo da mesma porta são caminhos paralelos: "ao mesmo tempo, (a) e (b)".
- "Se" e "sortear" têm dois ramos: `pontoDeEncontro` acha o primeiro bloco que os dois alcançam (o ponto onde voltam a se juntar) e
  **para os ramos ali**, para a frase não repetir o que vem depois.
- `textoDoValor` escreve a condição, e a caixa de valor vira "a e b e c" ou "a ou b", com **parênteses só em caixa dentro de caixa**,
  e a NÃO como "NÃO x". A caixa de ação vira "sorteia uma destas: (a) ou (b)" ou, no E, as ações em sequência.
- Um ciclo é dito "volta a repetir" (a `pilha` detecta).

A frase é a **segunda conferência** do desenho: se ela diz algo diferente do que a pessoa pensou, o fluxo está errado. O tour usa o
destaque suave da frase por isso. Testes: `grafo.test.ts` e `caixas.test.ts` (as frases), `fluxosConversao.test.ts` ("a frase em
português").

### Os erros (`fluxosValidar.ts` e `erros.ts`)

São dois níveis de erro:

1. **`fluxosValidar.ts` (`problemasDoFluxo`)**: o erro de **automação**, em português e no bloco. Por nó, confere as referências
   (cena, zona, modelo, som que não existem mais), "ligue este gatilho a algum bloco", "este 'se' está sem condição", e as caixas (vazia,
   espaço sem peça, conflito, nível demais, saída sem ligar). Depois confere as **ligações**: uma busca em largura a partir dos
   gatilhos mostra o que nunca recebe a execução ("não está ligado a nenhum gatilho") e as ações sem alvo. Por fim os **ciclos**: dois
   DFS (cor 1 e 2), um nos fios de ordem **desconsiderando** os nós "esperar" de pelo menos 1 s (um ciclo que passa por um deles
   é permitido), e outro nos fios de valor (ciclo de condições é sempre erro).
2. **`erros.ts` (`errosEmPortugues`)**: o erro de **forma**, vindo do zod. O zod fala inglês e fala em caminhos (`nos.3.config.chance`);
   esta camada traduz o `code` do erro (`too_small`, `invalid_type`, `invalid_value`...) em frases ("precisa ser pelo menos 0.",
   "preencha este campo.") e o caminho em um nome (`ROTULO`: `cadaS` vira "A cada (segundos)"; `nos.3` vira "Bloco 4"). As mensagens que o
   próprio esquema já escreveu em português (`custom`) passam como estão. `erroDeSintaxeDoJson` faz o mesmo para o "Ver como JSON".

`errosDoFluxo` (`blocos.ts`) junta os dois, prende cada um ao **id do nó** (o erro de zod usa o índice no array para achar o nó; o
de `problemasDoFluxo` já traz `nos.<id>`) e remove duplicados. O nó mostra o contorno de erro e a mensagem, depois de tentar salvar ou
quando está escolhido. Testes: `erros.test.ts` (as frases), `grafoDoEditor.test.ts` ("os erros por nó") e `caixas.test.ts`
("a conferência aponta caixa vazia, espaço sem peça...").

### O tour (`TourDasAutomacoes.tsx` e `passosDoTour.ts`)

Pedido no AU3: "acho que deve haver um tour pelo centro de automações [...] e fazer uma automação simples das tochas terem 30% de
chance de apagarem a cada 3 minutos". Dois conjuntos de passos: `PASSOS_DO_CENTRO` (a lista, a mesa de eventos, "abrir o editor") e
`passosDoEditor(comExemplo)` (cada tipo de peça e, se a automação é nova e vazia, a montagem das tochas).

Dois tipos de passo (`PassoDoTourDasAutomacoes.tipo`):

- **`info`**: escurece a tela (o "véu" com um buraco no alvo) e explica; "Próximo" ou as setas andam.
- **`fazer`**: a tela fica livre (não escurece) para a pessoa arrastar e ligar de verdade. O passo declara `feito(fluxo)` (já está
  pronto?) e `fazer(fluxo)` (o que "Fazer este passo por mim" muda). O tour olha o rascunho a cada render e **se completa
  sozinho** quando `feito` dá verdadeiro. Os passos de ligar têm `seta: true` (do primeiro ao segundo alvo).

Como o tour acha o que iluminar: os alvos são **`data-testid`** (`ed-grupo-quando`, `ed-peca-paraCada`, `ed-porta-<id>-saida`,
`ed-campo-cada`, `ed-campo-chance`, `ed-liberar`, `ed-ligada`, `ed-testar`...), procurados com `querySelector`. Um alvo de explicação
que não aparece em 1,5 s **é pulado** (o tour nunca trava); um de "fazer" que não apareceu (um campo que só abre ao escolher o
bloco) fica esperando, com o cartão no meio. Enquanto o passo vive, um `setInterval` de 200 ms remede o alvo (a grade se move, a
janela muda). O cartão se posiciona com `posicionarCartao` (`../tour/posicao`, o mesmo do tour da mesa), que tenta os quatro lados
para **não cobrir uma porta**. Para o passo escolher o bloco do exemplo (para o painel dele abrir), existe `escolher`.

Decisões:

- A marca de visto é `tabletop:pref:tourDasAutomacoes` no `localStorage`: preferência de navegador, **nunca vai à sala**. O tour abre
  sozinho só com conta (e fora do `MODO=teste`, a não ser que o teste ligue `tabletop:pref:tourDasAutomacoesNoTeste`).
- O exemplo só se monta numa automação **nova e vazia** (`podeMontarOExemplo`: um gatilho de relógio, nenhum fio, sem nome). Numa que já
  tem trabalho o tour só explica e diz como abrir uma nova: o tour nunca mexe no que a pessoa já fez.
- No passo final o exemplo ganha o nome "As tochas apagam (exemplo do tour)" e **fica desligado**; o fim oferece "Ligar agora" ou
  "Apagar o exemplo".
- No AU3c o Vilella pediu menos pormenor e "sem o nome de outro programa": os três passos das caixas viraram um ("Juntam peças com E,
  OU ou NÃO. Por exemplo: a cada 3 min OU ao apertar um botão.").
- O arquivo se chama `passosDoTour.ts` e não `tourDasAutomacoes.ts` porque o Windows confunde esse nome com `TourDasAutomacoes.tsx`
  (o sistema de arquivos não distingue maiúsculas).

**Frágil.** Renomear `ed-grupo-*`, `ed-peca-*`, `ed-porta-*`, `ed-campo-cada`, `ed-campo-chance`, `ed-liberar`, `ed-ligada` ou `ed-testar`
quebra o tour sem erro de compilação (é uma string). Testes: `passosDoTour.test.ts` ("Fazer este passo por mim", passo a passo, monta a
automação das tochas e cada passo fica feito) e `au3.spec.ts` (o tour de verdade, no navegador, até apagar tochas com o relógio
adiantado).

## A ferramenta `automacoes` do MCP

`packages/shared/src/mcp/ferramentas/automacoes.ts`. Só o mestre a vê (`visivel` confere `automacao.editar`). Tudo por **nome**, nunca por
id (cena, zona, modelo, token, som), e tudo o que o Claude cria entra como **rascunho** até o mestre publicar. Aceita o grafo (`nos` e
`fios` por nome, com `em` e `espaco` para as caixas, que `grafoDoPedido` traduz) ou uma forma curta (`gatilho` e `trilhas`, que
usa a árvore do AU1 e passa por `arvoreParaGrafo`); a tradução usa o mesmo `FluxoSchema` e o mesmo `problemasDoFluxo`, então o Claude recebe os
mesmos erros que o editor mostra. Além de criar e editar (`fluxos`, `zonas`), tem `acionar` (disparar, ligar, desligar), `usarBotoes`,
`listar`, `explicar` (a frase) e `guia`, o texto de ajuda de como as peças funcionam (`GUIA_DAS_AUTOMACOES`), que **tem de citar toda
peça nova** (um teste reprova se faltar). Os detalhes (lotes, desfazer, paridade com a tela) estão em [10 — MCP](10-mcp.md).

## Para ir além

- `../PASSAGEM.md`, seções "AU1", "AU2", "AU3", "7b-1", "7b-2", "7b-3": onde mexer e o que é frágil em cada lote.
- `../REDESIGN.md`, seções "AU1 — como ficou", "AU2 — como ficou" e "AU3 — como ficou", e "7b-1 a 7b-3 — como ficou": as decisões
  assumidas, uma por uma, e o que ficou para depois.
- `../ESTADO.md`, "Ajustes AU3", "Ajuste AU3b", "Ajuste AU3c" e "Lote 7" (o relógio da sala e os objetos de luz, dos quais o motor
  depende).
- `../ROTEIRO-DE-TESTES.md`, seção "AU3": o roteiro manual.
- [03 — Sala e sincronização](03-sala-e-sincronizacao.md) (o relógio da sala, o alarme), [05 — Mapa, luz e visão](05-mapa-luz-e-visao.md)
  (as zonas e as tochas) e [10 — MCP](10-mcp.md).
