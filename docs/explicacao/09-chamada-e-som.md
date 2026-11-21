# A chamada e o som

Esta parte cobre as duas coisas do Távola que **tocam áudio**: a chamada (voz e vídeo entre as pessoas da mesa, mais a
gravação da sessão para transcrever) e o som (a mesa de som do mestre: efeitos, ambientes e zonas). As duas são
"locais": a chamada vai direto de um navegador a outro e o som sai do navegador de cada pessoa. A sala (o Durable Object
`Sala`) só **sinaliza** a chamada e **coordena o relógio** do som. Nenhum byte de áudio ou vídeo passa por ela, exceto os
arquivos de som, que viajam como qualquer outro asset (ver `07-arquivos-e-assets.md`).

Leitura rápida do que existe:

- A chamada é uma **malha** WebRTC (uma conexão por par de pessoas), limitada a 8, numa janela própria `/m/<id>/chamada`.
- O desfoque de fundo roda no computador de quem desfoca (MediaPipe, modelo empacotado, nada da internet).
- O mestre pode **gravar só a fala** da chamada em WAV de 16 kHz, na pasta da mesa. Depois do jogo, `pnpm transcrever`
  roda o whisper.cpp local e o resultado vira uma nota só do mestre, que o Claude resume pelo MCP.
- A mesa de som tem 8 efeitos e 8 ambientes, um botão **Tocar/Parar** (o transporte) e um volume geral. Todo navegador
  toca **do mesmo ponto** porque todos medem o tempo pelo **relógio real da sala**.

---

## Parte 1 — A chamada

### Onde fica

Regras puras e protocolo (testáveis sem navegador):

- `packages/shared/src/chamada.ts`: quem pode entrar, o limite de 8, quem recebe cada sinal, o balde de frequência, a
  marca `gravando` e `naoGravar` (`entrarNaChamada`, `mudarEstadoNaChamada`, `destinoDoSinal`, `podeChamar`,
  `ligarGravacao`, `tirarMinhaVoz`, `gastarSinal`). Teste: `chamada.test.ts`.
- `packages/shared/src/protocolo.ts`: as intenções `chamada.entrar|estado|sair|sinal|chamar|gravar|naoGravar` e as
  mensagens `chamada.quem`, `chamada.sinal`, `chamada.chamando`, `chamada.substituida`.
- `apps/server/src/sala.ts`: `tratarChamada` (o único lugar que mexe na participação), `entradasDaChamada`,
  `difundirChamada`, `guardarChamada`.

A janela (tudo em `apps/web/src/chamada/`):

- `controlador.ts` (`ControleDaChamada`): dono de tudo o que não é desenho (mídia local, fundo, áudio, malha, conversa
  com a sala).
- `malha.ts` (`MalhaDaChamada`): as `RTCPeerConnection`, uma por par.
- `audio.ts` (`AudioDaChamada`): WebAudio (volume por pessoa, quem fala, sons de entrar e sair).
- `fundo.ts` (`FundoDesfocado`): o desfoque com MediaPipe. O modelo está em `modelos/selfie_segmenter.tflite`.
- `puras.ts`: negociação, volume, histerese de fala, desfoque, medidas. `grade.ts`: o cálculo da grade.
- `TelaDaChamada.tsx`, `GradeDeQuadros.tsx`, `Quadros.tsx`: desenho. `ChamadaEmJanelaPropria.tsx`: a página da rota.
- `canalDaChamada.ts`: o anel verde de "quem fala" que a janela da chamada manda à janela da mesa.
- `gravacao/`: `detectorDeFala.ts`, `captura.ts`, `gravador.ts`, `eventos.ts`, `useGravacao.ts`, `PecasDaGravacao.tsx`,
  `SecaoDasGravacoes.tsx`.

Gravação e transcrição:

- `packages/shared/src/gravacao.ts`: nomes de pasta e arquivo, cabeçalho do WAV, `gravacao.json`, `eventos.jsonl`, mapa
  de deslocamentos, leitura do JSON do whisper, linha do tempo. Teste: `ch3.test.ts`.
- `packages/shared/src/transcricao/transcrever.ts` (a regra e a segurança) e `cli.ts` (o terminal). `pnpm transcrever`
  roda `node packages/shared/src/transcricao/cli.ts`. O passo a passo de instalação está em `docs/WHISPER.md`.

### Como funciona

```
Mesa (botão "Chamada")                  abrirChamadaEmJanela()  ->  window.open(/m/<id>/chamada)
        |
        v
ChamadaEmJanelaPropria: useSala() PRÓPRIO (outro WebSocket, mesma sessão) + ControleDaChamada
        |  antes de entrar: pede microfone e câmera, mostra a prévia, mede o nível
        v
"Entrar"  ->  chamada.entrar  ->  Sala.tratarChamada  ->  grava a participação no socket
                                                          ->  difunde chamada.quem (todos da mesa)
        |
        v
controlador.definirParticipantes(lista)  ->  malha.definirPares(ids)
        |   para cada par novo, abre uma RTCPeerConnection
        v
oferta / resposta / candidatos ICE  ->  chamada.sinal  ->  Sala  ->  só o destinatário  (a sala repassa e esquece)
        |
        v
voz e vídeo: DIRETO entre os navegadores  ->  ontrack  ->  AudioDaChamada + <video> do quadro
```

Passo a passo:

1. A mesa tem um botão "Chamada" (`BotaoDaChamada.tsx`) que chama `abrirChamadaEmJanela` (`ficha/foraDaMesa.ts`). A janela
   é **uma só por mesa**: o nome da janela é fixo (`nomeDaJanela(mesaId, "chamada")`) e abrir de novo só traz a janela
   para a frente, sem recarregá-la (só navega se ela ainda é `about:blank`).
2. A página `ChamadaEmJanelaPropria` abre a **própria conexão** com a sala. Isso é essencial: só o socket **desta** janela
   participa da chamada. Fechar a janela é sair da chamada, e o navegador da mesa não é tocado.
3. O controlador nasce quando se sabe quem a pessoa é (`euId`). `iniciar()` pede o microfone e a câmera
   (`adquirirPrevia`) e mede o nível do microfone a cada 100 ms para a barra da tela de "antes de entrar".
4. "Entrar" (`entrar(soOuvindo)`) cria a malha e manda `chamada.entrar` com o estado inicial. A sala responde a todos com
   a lista `chamada.quem`.
5. Cada vez que a lista muda, `definirParticipantes` chama `malha.definirPares`: abre a conexão de quem chegou e fecha
   a de quem saiu. Toca o bipe de entrar ou de sair (se a preferência está ligada).
6. As descrições SDP e os candidatos ICE vão por `chamada.sinal`. A sala confere que quem manda e quem recebe estão na
   chamada, carimba o `de` e entrega só ao destinatário.
7. Quando a conexão sobe, `ontrack` entrega a faixa recebida. A de áudio vira uma fonte do `AudioDaChamada`; a de vídeo
   aparece no quadro da pessoa.

### Decisões e por quê

- **Janela própria, não painel na mesa.** A chamada precisa viver independente da mesa: o mestre mexe no mapa, troca de
  aba, recarrega a mesa, e a chamada não pode cair. Além disso a janela pode ser posta ao lado ou "por cima"
  (`documentPictureInPicture`, onde o navegador tem). É a mesma ideia da ficha e da mesa de som em janela própria (V9, Q4b).
- **Malha ponto a ponto, não servidor de mídia (SFU).** O projeto é "tudo local": não há infraestrutura para mixar nem
  retransmitir vídeo. Cada pessoa envia o seu vídeo a todas as outras. O custo cresce com o quadrado do número de
  pessoas, daí o limite de 8 (`MAXIMO_NA_CHAMADA`, assumido no CH1) e o teto de bitrate que cai com mais gente
  (`bitrateDoVideo`: 900 kbps até 3 pessoas, 450 kbps até 5, 250 kbps acima).
- **A sala só sinaliza.** Nada da chamada vai ao estado, ao banco, ao histórico, ao desfazer, à exportação ou ao
  snapshot guardado. O que a sala sabe de cada participante (microfone, câmera, fundo, "surdo", `gravando`,
  `naoGravar`) é só o que a janela mostra aos outros; nunca decide nada.
- **A participação mora no socket.** A sala é um Durable Object que **hiberna**. Guardar "quem está na chamada" num
  `Map` em memória o perderia. Por isso a participação fica no `serializeAttachment` do WebSocket da janela
  (`Identidade.chamada`, que sobrevive à hibernação); `entradasDaChamada` lê isso dos sockets abertos.
- **Sem STUN/TURN por padrão.** `iceServers` vazio: no mesmo computador e na rede local basta, e nada é buscado da
  internet. Para jogar pela internet se define `VITE_CHAMADA_ICE_SERVERS` (JSON com `urls`, `username`, `credential`),
  lido por `iceServersDoTexto`, que descarta lixo em vez de quebrar.
- **A mesma pessoa em outra janela substitui a antiga.** A antiga sai e recebe `chamada.substituida` (mostra "Entrar de
  novo"). Sem isso a pessoa apareceria duas vezes e as duas conexões brigariam pelo mesmo id.
- **Entrar "só ouvindo"** trava microfone, câmera e fundo até sair e entrar de novo (a pessoa não envia nada).
- **O que o Claude não faz.** A sala recusa `chamada.*` a quem vem pelo MCP (`rem.claude`). Fica na tabela de paridade como
  `gesto ao vivo` (precisa da câmera e do microfone de uma pessoa), menos `chamada.sinal`, que é `transporte`.
- **O desfoque se desliga sozinho** se o computador não dá conta (menos de 12 quadros por segundo por 5 s) ou se o
  modelo não carrega. O botão avisa por quê, em vez de a chamada travar.

### Os trechos complexos

#### 1. A sinalização pela sala: o estado no socket e as funções puras

**Problema.** A sala precisa saber quem está na chamada para dizer a todos e para encaminhar sinais, mas não pode guardar
isso em memória (hiberna) nem no banco (a chamada não é estado da campanha).

**Como o código resolve.**

1. Toda a regra está em funções puras de `chamada.ts` que recebem a lista `entradas` e devolvem a lista nova (ou um
   erro): `entrarNaChamada`, `mudarEstadoNaChamada`, `sairDaChamada`, `destinoDoSinal`, `podeChamar`.
2. `Sala.tratarChamada` monta `entradas` com `entradasDaChamada()` (um item por socket que tem `chamada` no attachment,
   ordenado por `desdeMs`), chama a função pura e **grava de volta** o resultado no attachment com `guardarChamada(ws, …)`.
3. `difundirChamada()` manda `chamada.quem` com `visaoDaChamada(entradas)`, que tira o `conexaoId` (só a pessoa e o
   estado dela saem).
4. O sinal é carimbado pela sala: o cliente manda `para`, e a sala escreve o `de` (`r.origem.usuarioId`). Ninguém
   escolhe "ser" outra pessoa.
5. Um balde de fichas por conexão (`gastarSinal`: rajada de 120, 60 por segundo) segura quem inundar a sala. Um aperto de
   mão com 7 pessoas manda dezenas de candidatos ICE de uma vez, por isso a rajada é grande.
6. `chamada.chamar` ("chamar" quem está na mesa e fora da chamada) tem espera de 10 s por par
   (`INTERVALO_MINIMO_DO_CHAMADO_MS`) e chega só aos sockets da pessoa que **não** estão na chamada.

**Frágil.** Se o formato de `Identidade` mudar, a chamada precisa continuar sobrevivendo à hibernação. A conferência do
papel do mestre para `chamada.gravar` é feita aqui (`usuario.papel === "mestre"`), **não** pela tabela de capacidades:
`capacidadeDaIntencao["chamada.gravar"]` diz `mesa.configurar` (a capacidade exclusiva do mestre, nunca delegável), mas `tratarChamada` roda antes de `processar` e nunca chama
`pode`. Os dois dizem a mesma coisa (só o mestre grava, sem delegar; o LP1 deixou a tabela, o comentário e um teste em `ch3.test.ts` de acordo). Quem mexer na regra de quem grava precisa mexer nos dois.

**Testes.** `packages/shared/src/chamada.test.ts` (as regras puras) e `e2e/tests/chamada.spec.ts` (duas e três janelas).

#### 2. O aperto de mão: quem oferece, "perfect negotiation" e sinais adiantados

**Problema.** Duas pontas de um par podem oferecer ao mesmo tempo (colisão de ofertas). No começo, isso deixava um par
sem ICE no Chrome. Além disso, a oferta de alguém pode chegar **antes** de a lista `chamada.quem` me mostrar que essa
pessoa existe.

**Como o código resolve.** Tudo em `malha.ts`:

1. **Quem oferece primeiro é a ponta de id maior.** `ehEducado(meuId, outroId)` é `meuId < outroId`: o de id menor é o
   "educado" (cede). Os dois lados chegam à mesma resposta sem conversar, porque comparam os mesmos dois ids.
2. **Só quem oferece cria os transceptores.** Em `abrirPar`, a ponta de id maior faz `addTransceiver("audio")` e
   `addTransceiver("video")`, ambos `sendrecv`. A educada **não** cria nada: recebe os dois junto com a primeira oferta e
   `pegarTransceptores` os adota depois do `setRemoteDescription`.
3. **"Perfect negotiation" para o resto da vida da conexão.** `onnegotiationneeded` faz `setLocalDescription()` sem
   argumento (o navegador escolhe offer ou answer) e envia. Quando chega uma oferta, `ignoraOferta(educado, tipo, estavel,
   fazendoOferta)` decide: o indelicado ignora a oferta que colide; o educado a aceita (desfazendo a própria).
4. **Fila por par.** `par.fila` é uma `Promise` encadeada: um sinal por vez, na ordem em que chegaram, senão duas
   operações de `setRemoteDescription` se atropelam.
5. **Sinais adiantados.** Se o sinal chega de quem ainda não tem `Par`, vai para `adiantados` e é entregue quando
   `abrirPar` roda. Vale 10 s e guarda no máximo 80 por pessoa (`SEGURA_ADIANTADOS_MS`, `MAXIMO_DE_ADIANTADOS`). Sem isso as
   duas pontas esperavam uma pela outra.
6. **Ligar e desligar câmera, trocar aparelho e o desfoque não renegociam.** `definirLocais(audio, video)` faz
   `sender.replaceTrack(...)` em todas as conexões. A negociação só acontece quando a conexão nasce.
7. **Conexão que falha** (`connectionState === "failed"`) chama `restartIce()`.
8. **Bitrate.** `aplicarBitrate` põe `maxBitrate` com `setParameters`, sem renegociar, a cada mudança do número de
   pessoas e quando uma conexão fica `connected`.

**Frágil.** Mexer em quem oferece, nos transceptores ou na fila exige rodar `chamada.spec.ts` **com três pessoas**: foi
assim que a colisão apareceu. Um ICE candidato que chega depois da oferta ter sido ignorada **não** é erro (`if
(!p.ignorandoOferta) throw e`).

**Testes.** `puras.test.ts` ("negociação sem colisão": um dos dois é educado, nunca os dois nem nenhum) e `chamada.spec.ts`.

#### 3. O áudio: ganho por pessoa, `<audio>` mudo e "quem fala"

**Problema.** Cada pessoa precisa de um volume próprio (0 a 200%), só para quem ouve; a janela precisa saber quem está
falando; e o Chrome tem um defeito conhecido com fluxos remotos no WebAudio.

**Como o código resolve** (`audio.ts`):

1. Cada fluxo remoto vira `MediaStreamAudioSourceNode` → `GainNode` → `destination`, e também → `AnalyserNode` (para o
   nível). O volume é o `gain` do `GainNode`: `ganhoDaPessoa(pref, surdo)` devolve 0 se a pessoa está silenciada para mim
   ou se eu "parei de ouvir", senão `volume/100` (de 0 a 2).
2. **O `<audio>` mudo preso ao mesmo fluxo.** O Chrome só entrega o som de um fluxo **remoto** ao WebAudio se ele toca em
   algum lugar. Por isso `adicionarPessoa` também cria um `<audio muted autoplay>` com o mesmo `srcObject`. Ele não toca
   nada (está mudo); só existe para o Chrome entregar o áudio.
3. **A preferência de cada pessoa** é lembrada por mesa e pessoa em `localStorage`
   (`tabletop:pref:chamada:pessoa:<mesa>:<usuario>`) e **nunca vai à sala**. O volume é limitado e o lixo volta para 100.
4. **Quem fala:** `AvaliadorDeFala` (`puras.ts`) tem **histerese**: liga acima de `LIMIAR_DE_FALA_LIGA` (0,035) e só
   desliga depois de `SEGURAR_FALA_MS` (450 ms) abaixo de `LIMIAR_DE_FALA_DESLIGA` (0,02). O anel verde não pisca no
   meio de uma frase. Cada cliente calcula sozinho; nada disso trafega. Mede-se o nível **antes** do volume da pessoa:
   quem fala é quem fala, não o quanto eu a ouço.
5. **O anel na janela da mesa.** A janela da chamada diz à mesa quem fala por `BroadcastChannel`
   (`canalDaChamada.ts`), e não pela sala. Um sinal a cada 2 s impede a mesa de apagar o anel; sem aviso por 3 s, ela
   apaga. Limitação conhecida: só funciona no mesmo navegador.
6. Os bipes de entrar e sair são gerados com osciladores (`bipe`), sem arquivo.
7. A saída de som é `setSinkId` do contexto; onde o navegador não tem, a opção some, com a dica do porquê.

**Frágil.** Tirar o `<audio>` mudo deixa a pessoa sem som no Chrome. O nível e o ganho são independentes de propósito.

**Testes.** `puras.test.ts` ("volume por pessoa", "quem fala").

#### 4. Câmera e microfone: o que o controlador protege

**Problema.** Pedir mídia é assíncrono e o React em modo estrito monta, desmonta e monta de novo no mesmo instante.

**Como o código resolve** (`controlador.ts`):

1. `iniciar()` espera um microtask e, se já foi encerrado, não pede nada. O controlador morto não pode deixar um
   microfone aberto nem um `AudioContext` sem dono (CH4, higiene).
2. `pedirMicrofone` e `pedirCamera` tentam com o aparelho preferido (`deviceId: { ideal }`) e, se falhar por outro motivo
   que não permissão negada, tentam de novo sem o aparelho. `pedidoDeCamera` é um contador: um pedido antigo que chega
   depois de outro mais novo é descartado e o fluxo dele, parado.
3. O microfone é pedido com `echoCancellation`, `noiseSuppression` e `autoGainControl` ligados pela preferência
   "Reduzir ruído e eco". O detector da gravação usa **os mesmos limiares** do anel verde, pensados para essa voz.
4. A faixa que sai para os outros é `faixaDeVideoParaEnviar()`: o canvas do desfoque, a câmera crua ou nada.
5. `devicechange` relê a lista de aparelhos. Se a faixa da câmera termina (`ended`), `desligarCamera`.
6. `aoConectar()` reenvia `chamada.entrar` se a pessoa estava dentro (a sala me tira quando o socket cai).
7. `aoRecusar` volta para "antes de entrar" se a sala recusa antes da confirmação (chamada cheia).

**O caso da prévia preta (CH4).** Os E2E da chamada às vezes mostravam a prévia preta. A causa provada **não era do
app**: a câmera falsa embutida do Chromium (`--use-fake-device-for-media-stream` sozinho) some do navegador em cerca de
metade das aberturas neste computador. A faixa termina uns 250 ms depois de nascer e a lista de aparelhos perde o
`videoinput`. O app trata o fim da faixa como "câmera desligada" (corretamente), então parecia defeito dele. A correção
está nos testes: `e2e/midiaFalsa.ts` (`argsDeMidiaFalsa()`) gera um arquivo Y4M pequeno e usa `--use-file-for-fake-video-capture`.
**Se a prévia voltar a ficar preta num E2E, olhe primeiro se a câmera falsa sumiu** antes de mexer no app. Uma câmera
USB de verdade que some no meio da chamada continua desligando a câmera sem tentar de novo (ideia, não feita).

#### 5. O desfoque de fundo

**Problema.** Desfocar só o fundo exige separar a pessoa do resto, em tempo real, no computador de quem desfoca, sem baixar
nada da internet.

**Como o código resolve** (`fundo.ts`, `FundoDesfocado`):

1. O modelo `selfie_segmenter` (Apache-2.0, MediaPipe) está empacotado em `modelos/`. O wasm vem do pacote
   `@mediapipe/tasks-vision`, importado com `?url`, e **só é baixado quando alguém liga o desfoque** (import dinâmico em
   `criarSegmentador`). Tenta o delegate `GPU` e cai para `CPU`.
2. Um `<video>` escondido lê a câmera. A cada ~42 ms (`setTimeout` de `1000/24`), `processarUmQuadro` pega o quadro
   novo (confere `currentTime`), chama `segmentForVideo` e entrega a máscara de confiança.
3. `compor` monta o quadro em dois canvases: **a pessoa** (o quadro recortado pela máscara, com contraste suave: abaixo de
   0,35 é fundo, acima de 0,65 é pessoa, e um `blur(1.5px)` na borda) e **o fundo** (o quadro com `blur(raio)`),
   e desenha a pessoa por cima. O resultado sai de `canvas.captureStream(24)`, e essa faixa **substitui** a da câmera.
4. **Os níveis** (`RAIO_DO_DESFOQUE`): Leve 2,5 px e Forte 7 px (num quadro de 640×360). Os nomes na tela (Leve e
   Forte) e os valores guardados (`desfocar` e `forte`) **não coincidem de propósito**: o protocolo e as preferências
   já usavam esses valores e não mudaram quando o CH3 renomeou. O atalho B passa Desligado → Leve → Forte → Desligado.
5. **Sem `filter` no canvas (Safari):** encolhe e estica o quadro, que também borra (Leve até 1/3, Forte até 1/8).
6. **Máscara invertida.** Conforme o modelo, a máscara vem como "chance de ser pessoa" ou "chance de ser fundo".
   `mascaraEstaInvertida` compara a média do centro com a da borda a cada 60 quadros. A câmera falsa do Chrome não tem
   pessoa para conferir.
7. **Vigia de velocidade.** `VigiaDeFps` desiste se passar 5 s abaixo de 12 quadros por segundo; `aoDesistir("lento")` faz
   o controlador voltar para "sem efeito" e mostrar a razão.

**Frágil.** O desfoque usa `setTimeout`: com a janela totalmente escondida o navegador desacelera os timers. O fim da
faixa de entrada (`ended`) também derruba o pipeline. Em testes, `__tabletopE2E.semVigiaDoDesfoque` desliga o vigia
(computador de teste, sem placa de vídeo).

**Testes.** `puras.test.ts` ("desfoque", "o desfoque em três níveis") e `e2e/tests/ch1.spec.ts`, `ch3.spec.ts`.

#### 6. A grade e as páginas

**Problema.** Os quadros 16:9 precisam ocupar o maior espaço possível da janela, sem rolagem, com qualquer número de
pessoas e qualquer tamanho de janela.

**Como o código resolve.**

1. `calcularGrade(n, largura, altura, gap)` (`grade.ts`) testa todas as divisões em colunas (1 a n). Para cada uma
   calcula a largura que o espaço permite por largura e por altura (a altura × 16/9), fica com o menor e escolhe a
   disposição que dá o **maior** quadro. Em empate, vale a de menos colunas.
2. `GradeDeQuadros.tsx` mede a área com `ResizeObserver` (descontando um respiro de 12 px), pede `calcularGrade` e dá a cada
   célula o tamanho **em linha** (`style`). O vão também é 12 px.
3. A **trilha da mesa** (o quadro "Trilha da mesa", que mostra o que toca no som e dá Pausar e Próxima ao mestre) conta
   como um quadro e fica por último. O quadro da trilha decide ficar compacto **pela medida** que a grade passa
   (420 × 236 px), não por CSS.
4. Mais de 9 quadros (`QUADROS_POR_PAGINA`) viram páginas, com setas, "1/2" e as teclas ← → (PageUp/PageDown). Quem fala
   numa página escondida aparece como um ponto verde na seta.

**Observação.** Com o limite atual (8 pessoas + a trilha = 9 quadros) uma página sempre basta. As páginas só aparecem de
fato nos testes, onde `window.__tabletopChamadaFalsas` (modo e2e, `pessoasFalsas.ts`) põe 5, 9 ou 11 quadros sem
conexão nenhuma; ficam prontas para o dia em que o limite subir.

**Frágil.** O respiro e o vão de 12 px estão em `GradeDeQuadros.tsx` **e** no CSS (`.chamada-quadros`,
`.chamada-quadros-miolo`): mudar um sem o outro faz o quadro passar do espaço.

**Testes.** `grade.test.ts`, `e2e/tests/ch2.spec.ts`.

#### 7. A gravação da fala (navegador do mestre)

**Problema.** Transcrever a sessão exige o áudio de cada pessoa, **separado**, e só com fala (silêncio não deve ir ao
whisper: ele inventa frases em áudio mudo). Nada pode rodar no computador dos jogadores, e a gravação não pode ser
escondida de ninguém.

**Como o código resolve.**

1. **Quem liga e quem vê.** Só o mestre liga (`ligarGravacao`, conferido na sala pelo papel). Liga **de dentro da
   chamada**, com uma confirmação. O estado vai a todos no campo `gravando` do mestre em `chamada.quem`, e todos veem o
   aviso (até antes de entrar). Cada pessoa pode marcar **"Não gravar a minha voz"** (`naoGravar`) a qualquer momento.
   Quem marca antes de entrar já entra de fora (`chamada.entrar` leva `naoGravar`), para nunca haver um instante em que a
   voz de quem quis ficar de fora fosse gravada.
2. **Captura** (`captura.ts`, `CapturaDeVoz`). Um `AudioContext({ sampleRate: 16000 })` (o navegador reamostra) e, por
   pessoa, uma fonte → `AudioWorkletNode` que devolve blocos de 100 ms. O código do worklet é um **texto** carregado por
   um `Blob` local (nada vem da internet) e a saída vai a um ganho zero: o gravador só escuta, nunca toca. Se o navegador
   não dá o contexto a 16 kHz, `Reamostrador` tira a média de cada janela.
3. **Detector de fala** (`detectorDeFala.ts`, `DetectorDeFala`), um por voz. Corta em quadros de 20 ms usando os limiares
   do anel verde. Um trecho começa quando um quadro passa do limiar de ligar (levando 300 ms de folga **antes**), segue
   enquanto há fala e fecha depois de 700 ms de silêncio seguido (`fimDeFalaMs = folga × 2 + 100`) ou aos 30 s (corte
   forçado). Fala de menos de 0,5 s é descartada (um estalo, uma tosse); essa conta é da **fala**, sem as folgas. No fim
   do trecho, só ficam 300 ms de silêncio depois da última fala. O resultado não depende do tamanho dos blocos em que o
   áudio chega.
4. **O WAV** (`gravacao.ts`): 16 kHz, mono, 16 bits, que o whisper.cpp lê sem ffmpeg. `pcm16DeFloat` converte com corte
   (sem estourar), `cabecalhoWav` escreve os 44 bytes, `escreverWav` junta.
5. **A pasta** (`gravador.ts`, `GravadorDaSessao`). Cada trecho vira
   `gravacoes/<AAAA-MM-DD_HHhMM>/<pessoa>/<inicio-em-ms>.wav`, dentro da **pasta da mesa** (a mesma `FonteDeAssets` dos
   assets; sem pasta autorizada não dá para gravar). Duas gravações no mesmo minuto ganham um sufixo (`-2`). O nome do
   arquivo é só dígitos (o início em ms desde que a gravação começou), nunca um texto livre.
6. **Escrita em fila e aos poucos.** Cada trecho é escrito assim que fecha; `gravacao.json` e `eventos.jsonl` são
   regravados a cada 3 s quando mudam. Uma queda não perde a sessão. Uma escrita que falha não para a gravação: ela
   segue e o estado mostra o erro.
7. **`gravacao.json`** guarda o início (`inicioEpochMs`, `fusoMin`), as pessoas (id, nome, personagem, pasta), as
   entradas e saídas na chamada e **quando cada um ficou de fora** (`foraDaGravacao`, com instante). **`nomes.txt`** tem os
   nomes de personagens, NPCs e cenas (ajudam o whisper). **`eventos.jsonl`** tem o que a mesa registrou enquanto gravava:
   chat, rolagens, troca de cena, combate (`eventos.ts`, `ObservadorDaMesa`).
8. **Sincronizar** (`sincronizar`). A cada render, `useGravacao` entrega a lista de quem está na chamada e o fluxo de áudio
   de cada um (o meu microfone, ou o recebido). O gravador **liga, troca ou solta** a escuta de cada voz: quem saiu tem o
   trecho em curso salvo; quem marcou `naoGravar` **nem é escutado** (a captura é solta e o que estava em curso, jogado fora).
9. **Parar.** Sair da chamada, fechar a janela, recarregar a página ou ser substituído por outra janela para a gravação
   (`pagehide`); o que já foi escrito fica salvo e o aviso some para todos.

**Frágil.**

- A marca `gravando` mora no socket do mestre. Se o socket cai e volta, a sala o põe de novo na chamada **sem** a marca,
  e `useGravacao` a reenvia (`meuRegistro`). Quem lê `chamada.quem` não deve supor que a marca é permanente.
- Os limiares do anel verde servem aos dois: mudar `LIMIAR_DE_FALA_LIGA` ou `LIMIAR_DE_FALA_DESLIGA` muda o detector.
- Depende de `AudioContext({ sampleRate })` e `AudioWorklet` (Chrome e Edge, os mesmos que têm a pasta). A voz dos outros
  precisa estar tocando em algum `<audio>` (o `AudioDaChamada` já faz) para o Chrome entregá-la ao WebAudio.
- Se o mestre usa a chamada em duas janelas ao mesmo tempo, `ligarGravacao` desliga a marca de outras conexões: a última
  que liga vale.

**Testes.** `detectorDeFala.test.ts`, `gravador.test.ts`, `eventos.test.ts`, `packages/shared/src/ch3.test.ts` e
`e2e/tests/ch3.spec.ts` (ganchos só do modo e2e: `window.__tabletopPasta` e `__tabletopE2E.gravacao`).

#### 8. A transcrição depois da sessão

**Problema.** O whisper gasta quase o mesmo tempo num trecho de 2 s e num de 30 s; rodar um arquivo por trecho seria
lentíssimo. E o texto dele precisa voltar à hora real da sessão para se misturar com o que a mesa registrou.

**Como o código resolve** (`transcrever.ts`, chamado por `pnpm transcrever "<pasta da gravação>"`):

1. **Configuração.** `lerConfiguracao` lê `WHISPER_EXE` e `WHISPER_MODELO` (variáveis de ambiente, que valem mais) ou o
   `transcrever.config.json` da raiz (fora do git). Opcionais: idioma (padrão `pt`) e `WHISPER_SEM_GPU=1` (`-ng`).
   Faltando algo, diz o que falta e onde pôr. **O Távola não baixa o whisper nem o modelo**: o passo a passo está em
   `docs/WHISPER.md` (a RTX 3050 de 6 GB do Vilella roda bem o `large-v3-turbo`).
2. **Segurança.** O script só lê e escreve **dentro da pasta da gravação**: toda leitura passa por `dentro(base, …)`, que
   compara com `estaDentroDe`. O nome da pasta de cada pessoa passa por `trechoDeCaminhoSeguro`. O whisper é chamado
   **sem shell** (`spawn` com `shell: false` e os argumentos numa lista), então nada passa por interpretador.
3. **Defesa a mais.** `trechoEstaForaDaGravacao` ignora um trecho que **começa** quando a pessoa tinha ficado de fora,
   mesmo que o arquivo exista na pasta (cobre um erro do gravador).
4. **Emenda.** Para cada pessoa, `escreverEmenda` junta os trechos num WAV só, com 1 s de silêncio entre eles, lendo um
   trecho por vez (não carrega tudo na memória). `planejarEmenda` guarda o **mapa de deslocamentos**: onde cada trecho
   começa dentro do WAV emendado.
5. **Whisper.** Roda `whisper-cli -m <modelo> -f <emenda> -l pt -oj -of <saída> -pp --prompt "Nomes: …"`. O prompt vem de
   `nomes.txt` (`promptDosNomes`, limitado a 500 caracteres, cortando no último nome inteiro). O `-pp` imprime o
   progresso, que `rodarWhisper` lê por expressão regular para mostrar "pessoa · trecho · % · quanto falta".
6. **De volta à hora da sessão.** `lerJsonDoWhisper` lê `transcription[].offsets` (em ms; cai para `timestamps` se
   faltar) e descarta ruído (`[BLANK_AUDIO]`, `(música)`, só pontuação). `instanteNaSessao` acha o trecho em que cai cada
   fala e soma o quanto andou **dentro** dele ao início do trecho (o nome do arquivo). Um instante no silêncio da emenda
   fica preso ao fim do trecho.
7. **Mistura.** `misturarLinhaDoTempo` junta falas e `eventos.jsonl` por horário (empate: a fala vem antes do evento) e
   escreve `transcricao.md` (`21:14  Ana (Thorin): Eu abro a porta devagar.`) e `transcricao.json`.
8. **Se o whisper falha numa pessoa**, o script segue com as outras e diz no fim; a pasta de trabalho `_trabalho/` some ao
   terminar.
9. **Trazer para a mesa.** Na aba Mesa, "Gravações da sessão" (`SecaoDasGravacoes.tsx`) lista as pastas, mostra o estado
   (`estadoDaGravacao`: gravada, transcrita, trazida) e "Trazer a transcrição" cria uma nota **só do mestre**
   (`visivel: mestre`). Uma sessão acima do limite de uma nota vira "parte 1", "parte 2" (`dividirEmNotas`). Depois
   pergunta se apaga o áudio. O Claude lê a nota com `ler` (tipo handout, `completo: true`) e escreve o resumo com `notas`.

**Frágil.**

- O "rascunho" da nota é só "visível só ao mestre": a sala só carimba `rascunho` o que o Claude cria.
- Whisper em áudio quase mudo inventa texto: por isso o Távola só manda trechos com fala. Se acontecer, apague a linha.
- Não foi testado com whisper.cpp nem com fala de verdade (os testes usam um whisper falso em
  `fixtures/whisper-falso.mjs`); isso está no roteiro manual do CH3.

**Testes.** `packages/shared/src/transcricao/transcrever.test.ts` (configuração, segurança, whisper falso, falha de uma
pessoa, quem ficou de fora, pasta insegura, executável inexistente) e `ch3.test.ts` (WAV, mapa de deslocamentos, JSON do
whisper, linha do tempo).

---

## Parte 2 — O som

### Onde fica

Dados e contas puras (`packages/shared/src/`):

- `mesadesom.ts`: a mesa de som: os 16 lugares (`LugarDeSomSchema`, `MesaDeSomSchema`), os ambientes ligados
  (`AmbienteLigadoSchema`, `SomLigadoSchema`), o transporte (`tocandoAgora`), `ligadosParaACena`, `ligadoSem`, `usosDoSom`,
  e a conversão antiga `migrarSomDoN5`.
- `som.ts`: o que vale para todo som: o relógio (`pontoDaTrilha`, `desvioDoRelogio`), o volume final (`volumeFinal`), o
  som de zona (`SomDaZonaSchema`), o alvo do efeito (`AlvoDoEfeitoSchema`), o MIME.
- `somnucleo.ts`: quem ouve o quê (`sonsDasZonasParaJogador`, `sonsDasZonasParaTokens`, `efeitoChegaPara`).
- `nucleo.ts`: as intenções `som.lugar|efeito|efeitoParar|ambiente|transporte|volumeGeral|pararTudo|apagar` e os eventos;
  `eventoPara` e `visaoPara` decidem o que cada pessoa recebe.
- `automacoesnucleo.ts`: a ação `som.tocar` das automações.

Sala: `apps/server/src/sala.ts` (`atualizarSonsDasZonas`, o reenvio do efeito depois do snapshot em `distribuir`) e
`armazenamento.ts` (`carregarSom`/`gravarSom`, chaves `mesa_de_som` e `som_ligado` da tabela `meta`).

Tela (`apps/web/src/som/` e `PainelDoSom.tsx`):

- `motorDeSom.ts` (`MotorDeSom`): o motor de áudio do navegador. `useSomDaMesa.ts`: liga estado e mensagens ao motor.
- `prefsDeSom.ts`: volumes e "silenciar tudo" de cada navegador. `ConfigDaMesaDeSom.tsx`: a janela de configuração.
- `PainelDoSom.tsx` (janela flutuante, faixa no pé do mapa, janela própria), `modoDoSom.ts` (qual forma, por pessoa).
- `SomEmJanelaPropria.tsx`: a rota `/m/<id>/som`.
- `AvisoDoSom.tsx`: o "Clique para ativar o som da mesa".

A música (MU1) toca na mesma engrenagem (motor, abas, trilha da chamada), mas tem seu próprio lote; aqui só aparece onde
divide código com o som.

### Como funciona

```
Mestre clica num efeito / marca um ambiente / aperta Tocar
        |  intenção som.efeito | som.ambiente | som.transporte  (ou o Claude, pelo MCP: ferramenta `som`)
        v
nucleo.ts: confere a capacidade `som.controlar`, calcula e EMITE um evento
        |   som.efeitoTocado           (transitório: não fica no estado)
        |   som.ligadoAlterado         (guarda Estado.somLigado)
        v
Sala.distribuir: eventoPara(...)  ->  cada navegador (o do jogador recebe só hash e volume)
        |   ligadoComRelogio(): refaz o `servidorMs` com a hora de agora
        v
useSomDaMesa  ->  MotorDeSom.definirAmbientes / tocarEfeito / pararEfeito
        v
<audio> no ponto certo (relógio da sala), com fade e o volume das preferências de cada um
```

Os três tipos de som seguem caminhos diferentes, de propósito:

| O que | Mora onde | Chega como | Alinhamento |
|---|---|---|---|
| **Ambiente** (laço) | `Estado.somLigado.ambientes` (todos recebem) | estado + evento `som.ligadoAlterado` | pelo relógio da sala |
| **Efeito** (uma vez) | não mora (é um evento) | `som.efeitoTocado` / `som.efeitoParado` | toca ao chegar |
| **Som de zona** | `Zona.efeitos.som` (**só o mestre** recebe a zona) | mensagem própria `som.zona`, só ao jogador que está dentro | entra e sai com fade |

### Decisões e por quê

- **O arquivo é um asset `som`** (mp3, ogg ou wav, até 20 MB), no computador do mestre, e viaja em pedaços como as
  imagens. A sala guarda só hash, nome e volume (N5). O jogador baixa qualquer som da mesa, mas o nome do arquivo que
  recebe é anonimizado (`"som"`): o nome poderia entregar o segredo ("Dragão acordando.mp3").
- **A mesa de som tem 16 lugares fixos: 8 efeitos e 8 ambientes** (Q4, desenho aprovado pelo Vilella). Fixos porque a
  interface é uma mesa de botões, como uma mesa de som de verdade: o mestre decora a posição.
- **A sessão não é a configuração.** `Estado.mesaDeSom` (arquivo, nome, ícone, cor e volume de cada lugar) só o mestre
  recebe e vai na exportação. `Estado.somLigado` (o que toca agora) todos recebem e **não** vai na exportação: é da sessão,
  e o relógio dele é de outra sessão.
- **Marcar não é tocar (Q4b).** Os interruptores dos ambientes só **marcam** (e dão o volume de cada um); o botão
  **Tocar/Parar** do pé (`som.transporte`) toca ou cala os marcados, todos juntos, do mesmo instante. O Vilella pediu isso
  ao testar: ligar um a um fazia cada ambiente começar em um momento diferente.
- **Levar o grupo a uma cena com ambientes põe o transporte para tocar** (`ligadosParaACena`): a cena existe para isso.
  Cena sem a lista não mexe em nada; lista vazia é silêncio.
- **Estado antigo (sem o campo `tocando`) vale "tocando" se há ambiente marcado.** Foi a forma de não precisar de
  migração; `tocandoAgora` guarda essa regra.
- **O volume geral é multiplicado em dois lugares, de propósito.** A sala multiplica o dos efeitos (que não ficam no
  estado) e o navegador multiplica o dos ambientes (para valer na hora, sem recomeçar nada).
- **O jogador recebe os ambientes marcados mesmo com o transporte parado** (só o hash do som); o navegador decide o que
  toca. Sem filtro extra na sala.
- **Fim da "trilha única" do N5.** A trilha e a trilha da cena viraram ambientes. `migrarSomDoN5` converte ao ler (no banco
  e em arquivos exportados): a trilha que tocava vira um ambiente ligado, no mesmo ponto.
- **Tudo é por navegador.** Volume geral, de ambientes e de efeitos, e "silenciar tudo" ficam em `tabletop:pref:som` e
  **nunca vão à sala**.
- **O Claude também opera a mesa de som** pela ferramenta `som` (lugares, efeito, ambientes, transporte, volume geral,
  parar tudo, apagar, ambientes da cena, zonas). Detalhes em `10-mcp.md`. Som **não** entra no Desfazer.

### Os trechos complexos

#### 1. O alinhamento pelo relógio real da sala

**Problema.** Um ambiente em laço tem que soar **do mesmo ponto** para todos, inclusive para quem entra no meio, e os
relógios dos computadores diferem. Mandar "toque agora" a cada pessoa não serve: o evento chega em momentos diferentes e
quem reconecta perde.

**Como o código resolve.**

1. Cada ambiente ligado guarda `inicioMs`: o instante em que ele **começou**, no relógio real da sala. Nenhum navegador é
   avisado de "ponto atual": todos calculam.
2. Toda cópia que sai da sala (evento e snapshot) é refeita com `servidorMs = agora` (`ligadoComRelogio`, em `nucleo.ts`,
   chamado em `eventoPara` e `visaoPara`).
3. No navegador, `desvioDoRelogio(ligado, Date.now())` dá `servidorMs - agoraLocal`: o quanto o relógio da sala está à
   frente do local, no instante em que a cópia chegou.
4. O ponto do laço é `pontoDaTrilha`: `((agoraLocal + desvio - inicioMs) / 1000) % duracaoDoArquivo`. Se a duração ainda é
   desconhecida, devolve o tempo corrido, e o motor dobra quando o `loadedmetadata` chega.
5. `MotorDeSom.reconciliarAmbientes` posiciona o `currentTime` ao criar o canal e, a cada reconciliação, **reposiciona**
   um ambiente que passou de 1,5 s do relógio da sala (`DESVIO_ACEITO_S`). O que sobra abaixo disso é latência de rede e
   não vale um salto audível. Perto da emenda do laço os dois lados "estão certos", então a conta ignora a diferença
   quando ela é quase a duração inteira.
6. Ao tocar o transporte, `som.transporte` **reinicia** o `inicioMs` e o `servidorMs` dos marcados para `agoraMs`: começam
   juntos, agora.

**Frágil.** Quem muda `visaoPara` ou `eventoPara` sem refazer o `servidorMs` desalinha o som de quem entra no meio. O
desvio é calculado **no instante da cópia**: se o relógio local derivar muito entre snapshots, a correção vem no próximo.
Uma aba em segundo plano pode atrasar timers e `play()`; o próximo snapshot acerta.

**Testes.** `packages/shared/src/som.test.ts` (ponto, desvio, volume final) e `e2e/tests/som-n5.spec.ts` e
`som-q4.spec.ts` (o gancho `window.__tabletopSom.estado()` diz o que o motor **deve** estar tocando, com o volume final
já aplicado; não prova que saiu som da caixa).

#### 2. O transporte (Q4b) e a cena que liga ambientes

**Problema.** O ambiente precisa de dois estados independentes: "está marcado para esta cena" e "está tocando agora".

**Como o código resolve.**

1. `SomLigado` tem `ambientes` (os marcados), `tocando?` (o transporte) e `volumeGeral`.
2. `som.ambiente` **só marca** ou desmarca (e muda o volume): emite `som.ligadoAlterado` com `tocando` como estava. Se o
   transporte já toca, o ambiente entra na hora, com fade.
3. `som.transporte { tocando: true }` recusa se não há ambiente marcado ("Ligue um ou mais ambientes", `dados_invalidos`)
   e, se aceita, refaz o `inicioMs` de todos para agora. Com `tocando: false`, corta os efeitos que tocam e cala os
   ambientes, **que seguem marcados**.
4. `useSomDaMesa` traduz isso para o motor: com o transporte parado passa uma lista **vazia** de ambientes.
5. `ligadosParaACena(estado, cena, agoraMs)` roda ao levar o grupo: liga os `Cena.ambientes`, desliga os outros. O que já
   toca e continua marcado **segue sem recomeçar**, com o volume em que está.
6. `somLigadoOuNada` não guarda `somLigado` quando não há nada marcado, o transporte está parado e o volume é o padrão.

**Frágil.** O estado sem `tocando` (campanha antiga) vale como "tocando" se há ambiente marcado: não mude essa regra sem
migração. Desmarcar o último ambiente com o transporte tocando **não** para o transporte (o botão segue "Parar").

**Testes.** `e2e/tests/som-q4b.spec.ts`, `som-q4.spec.ts`.

#### 3. O efeito: um evento que o snapshot engoliria

**Problema.** Um efeito não é estado: é um acontecimento. Mas algumas intenções mandam um **snapshot novo** a todos, e o
snapshot não contém o efeito: quem o recebesse no lugar do evento ficaria sem ouvir.

**Como o código resolve.**

1. `som.efeito` emite `som.efeitoTocado` com `{ hash, volume, alvo, lugar? }`. O volume já sai da sala multiplicado pelo
   volume geral da mesa de som.
2. `eventoPara` entrega o efeito **só a quem ouve** (`efeitoChegaPara`) e sempre com `alvo: todos`, para o jogador não
   saber a cena nem o token por trás. O mestre ouve todos; o jogador, os de `todos`, os da cena em que o grupo está e os
   do token que ele controla.
3. Em `Sala.distribuir`, quando o destinatário recebe um snapshot, a sala **reenvia depois dele** os eventos
   `som.efeitoTocado` e `som.efeitoParado` do mesmo lote.
4. No navegador, `tocarEfeito` toca de novo do começo se o mesmo lugar (ou o mesmo arquivo solto) já estava tocando, e
   guarda o efeito ativo (`efeitosAtivos`) para a barra de progresso.

**Frágil.** Não existe replay de eventos na reconexão: quem estava fora não ouve o efeito (certo, é um acontecimento). O
jogador só baixa o arquivo de um efeito **no primeiro toque**, porque ele não sabe quais são os efeitos da mesa; o
primeiro toque de um efeito novo pode não soar se o arquivo ainda não chegou. O mestre baixa antes os ambientes dos lugares.

**Testes.** `e2e/tests/som-n5.spec.ts`, `som-q4.spec.ts`.

#### 4. O som por zona: tocar "enquanto dentro" sem entregar a zona

**Problema.** A zona (forma, nome, regras) é segredo do mestre. Mas o jogador dentro dela tem de **ouvir** o som. Se o
hash do som fosse no snapshot, o jogador descobriria que há uma zona ali.

**Como o código resolve.**

1. O som da zona é `Zona.efeitos.som { hash, nome, volume, laco }`. Zona ligada, publicada (sem rascunho) e com som.
2. A sala calcula, depois de **todo** `distribuir` e de cada snapshot (`atualizarSonsDasZonas`), os sons de cada
   jogador: `sonsDasZonasParaJogador` pega os tokens que ele controla e `sonsDasZonasParaTokens` junta os sons das zonas
   onde algum deles está (sem repetir o mesmo som: vale o de volume maior).
3. Manda só `som.zona { sons: [{ hash, volume, laco }] }`, e **só quando a lista dele muda** (`sonsDasZonasEnviados`, um
   `WeakMap` por socket). Nunca a zona, o nome nem as regras. Uma falha aí é capturada e não derruba a mesa.
4. No navegador, `useSomDaMesa` guarda a lista e `MotorDeSom.reconciliarZonas` entra e sai com fade de 1,2 s. Som sem
   laço toca **uma vez por entrada** (`semLacoTocados`).
5. O mestre **não** recebe `som.zona`: ele tem as zonas no estado. Ele só ouve se ligar "Ouvir as zonas do token
   selecionado" (preferência, desligada por padrão), e calcula localmente com `sonsDasZonasParaTokens`.

**Frágil.** Não ponha o hash do som da zona no snapshot nem em evento; é o que mantém a zona secreta. O nome do arquivo
também não sai. Os sons de zona só baixam na primeira vez que tocam (adiantar diria que a zona existe).

**Testes.** `packages/shared/src/som.test.ts` (quem ouve o quê), `e2e/tests/som-n5.spec.ts`.

#### 5. O motor de áudio do navegador

**Problema.** Misturar ambientes, música, efeitos e zonas, com arquivos que ainda estão baixando, fades, o volume de cada
pessoa, e um navegador que **proíbe tocar sem um gesto**.

**Como o código resolve** (`motorDeSom.ts`):

1. **Receber o que *deve* tocar, não ordens.** O hook entrega ao motor o estado desejado (`definirAmbientes`,
   `definirZonas`, `definirMusica`) e o motor **reconcilia**: cria os canais que faltam, solta os que sobram, ajusta
   volume e ponto. `reconciliar` encadeia numa fila (`fila`) para duas reconciliações não se atropelarem.
2. **Um canal é um `HTMLAudioElement`** (`novoCanal`), com `loop` conforme a categoria (ambiente em laço, efeito não).
   Ele começa com `volume = 0` e sobe por uma rampa (`ajustar`, passos de 40 ms) até o alvo: sem estalo. Ambientes entram
   e saem em 1,5 s (`FADE_DO_AMBIENTE_MS`), zonas em 1,2 s.
3. **O volume final de cada canal** (`volumeDe`) é `volumeFinal(base, geral, categoria, silenciado)`: o volume do som ×
   o volume geral das **preferências** × o da categoria × "silenciar tudo". Para ambiente e música, a base ainda é
   multiplicada pelo volume geral **da mesa de som**. As preferências guardam o volume dos ambientes na chave `trilha`
   (o nome do N5), para não perder o ajuste de quem já mexeu; a tela mostra "Ambientes".
4. **O arquivo ainda não chegou.** `urlDoArquivo` pede ao gerente de assets (`blobDe`) e o canal só nasce quando a URL
   existe; `garantir(hash)` manda baixar. Quando um arquivo termina de chegar, `arquivoChegou()` reconcilia de novo.
5. **Autoplay.** `comecar` faz `el.play()`; se o navegador recusa (`NotAllowedError`), o motor marca `bloqueado` e a tela
   mostra o aviso. `ativar()` (um clique) refaz tudo com `depoisDoGesto`. O gancho de teste `simularBloqueio` finge o
   bloqueio (o Chrome do Playwright costuma deixar tocar).
6. **`iniciar()` é idempotente e `encerrar()` não apaga o que "deve tocar".** O modo estrito do React monta, desmonta e
   monta de novo; um `encerrar()` definitivo deixava a mesa muda.
7. **Efeitos acabam sozinhos** (`ended`) e saem de `efeitosAtivos`; `pararEfeito(lugar?)` corta um ou todos.

**Frágil.** O gancho `estado()` diz o que **deve** tocar (volume já com preferências), não prova som saindo da caixa. Os
E2E precisam esperar a meta do som no navegador antes de usar o hash.

#### 6. `som.tocar` nas automações

**Problema.** Uma automação (um fluxo, ver `06-automacoes.md`) pode tocar um som: para todos, para a cena ou para quem
controla o token da vez.

**Como o código resolve** (`automacoesnucleo.ts`, `aplicarAcao`, caso `som.tocar`):

1. Confere que o som ainda está na mesa (`assets` com tipo `som`); senão **anota** no registro da automação e segue.
2. Escolhe o alvo (`AlvoDoEfeito`): `token` exige token da vez (sem token, anota e para); `cena` usa a cena ativa, ou a
   primeira das cenas do fluxo se a ativa não está entre elas; senão `todos`.
3. Gasta uma "ficha" do limite do disparo (`m.contar()`) e emite o **mesmo** `som.efeitoTocado`, com
   `volume = acao.volume × volumeGeralDe(estado)` (o volume geral da mesa também vale aqui).

`som.tocar` toca **por arquivo**, não escolhe o lugar da mesa de som (ideia anotada para depois). Por isso o formulário no
editor mostra os sons que já estão na mesa.

#### 7. O volume de cada pessoa

Há dois "volume de cada um" no projeto, e vale não confundi-los:

- **Na chamada:** o volume de **cada pessoa que fala** (0 a 200%, só para quem ouve, em `localStorage`, nunca na sala). É o
  `GainNode` descrito na Parte 1, trecho 3.
- **Na mesa de som:** o volume de **cada som** (de cada lugar e de cada ambiente ligado) e as preferências **de cada
  navegador** (geral, ambientes, efeitos, silenciar). É a conta de `volumeFinal`, no trecho 5.

O quadro "Trilha da mesa" na chamada (`rotulos.ts`, `trilhaDaMesa`, desenhado por `QuadroDaTrilha`) lê o estado e mostra o
que toca (o nome da música ou "Nada tocando"), com Pausar e Próxima só para o mestre.

#### 8. A janela própria `/m/<id>/som`

**Problema.** O mestre quer a mesa de som numa janela à parte (outro monitor), sem tirar a mesa do lugar.

**Como o código resolve** (`SomEmJanelaPropria.tsx`):

1. A rota `/m/<id>/som` (`rotas.ts`, `caminhoDoSom`) abre pelo mesmo caminho da ficha (V9): conexão **própria** com a sala
   (a mesma sessão), sem contar como uma presença a mais.
2. O mesmo `lock` e canal de `ficha/foraDaMesa.ts` com o id `mesa-de-som` avisam a mesa de que ela está aberta: a mesa tira
   o painel da tela enquanto a janela existe e o devolve ao fechar; o botão do Som, com a janela aberta, a traz para a
   frente. A medida da janela é lembrada.
3. **O som continua saindo da aba da mesa.** A janela é só o **controle**. Ela cria um `MotorDeSom` próprio, mas que
   **nunca recebe** o estado da sala: serve só para o "Ouvir" da configuração, que toca só ali.
4. Só o mestre vê a mesa de som; um jogador que abra a rota lê "A mesa de som é do mestre".
5. A janela própria não mostra a barra de progresso dos efeitos (o som sai na aba da mesa).

**Frágil.** Se ninguém tem a aba da mesa aberta, nada toca, mesmo com a janela do som aberta.

**Testes.** `e2e/tests/som-q4b.spec.ts`.

---

## Para ir além

- `../PASSAGEM.md`: seções "CH1", "CH2", "CH3", "CH4" (a chamada, a grade, a gravação, a câmera falsa), "N5" (som
  ambiente e som de zona), "Q4" (a mesa de som) e "Q6" (a mesa de som em janela própria e o transporte).
- `../REDESIGN.md`: "CH1/CH2/CH3 — como ficou", "N5 — como ficou", "Q4 — como ficou" e "Q6 — como ficou", com tudo o que
  foi assumido em cada lote.
- `../ESTADO.md`: o diário dos lotes ("Ajustes CH1" a "CH4", "N5", "Q4", "Q6").
- `../WHISPER.md`: instalar o whisper.cpp, escolher o modelo e rodar `pnpm transcrever`.
- `../protocolo.md`: as mensagens da chamada e do som.
- `10-mcp.md`: como o Claude opera a mesa de som e resume a sessão gravada.
- `07-arquivos-e-assets.md`: como o arquivo de som viaja do computador do mestre ao navegador de cada jogador.
- `06-automacoes.md`: a ação `som.tocar` e o som de zona dentro dos fluxos.
