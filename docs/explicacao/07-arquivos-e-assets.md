# Arquivos e assets

As imagens, os sons e o compêndio da mesa **não ficam no servidor**. Ficam no computador de quem os tem: no navegador (cache) e, no caso do mestre, numa pasta que ele escolhe. O servidor guarda só a **lista** (nome, tamanho, o hash de cada arquivo e os hashes dos pedaços) e **repassa** bytes de um navegador para outro. Este capítulo explica como um arquivo nasce, viaja, é conferido, é guardado, é listado e some.

Quem usa a mesa vê isso como "subi o mapa e os jogadores o viram", "o Claude mandou um token", "abri a mesa em outro navegador e tudo carregou da pasta". Por baixo, é um sistema de endereçamento por conteúdo (o nome do arquivo é o SHA-256 dele) com uma camada de segurança pesada, porque o arquivo vem de outra pessoa.

## Onde fica

Puro, em `packages/shared/src/`:

- `assets.ts`: limites (`LIMITES_DE_ASSET`), `AssetMetaSchema`, `validarMeta`, hash e pedaços (`sha256Hex`, `dividirEmPedacos`, `pedacoConfere`, `arquivoConfere`), frame binário (`montarFrameDePedaco`, `lerFrameDePedaco`), tiles (`retangulosDeTiles`, `hashDoManifesto`, `montarManifestoDeMapa`), visibilidade (`assetVisivelPara`), `hashesUsados`, `hashesPreparaveis`, `escolherProvedor`.
- `cifra.ts`: AES-GCM do pré-envio de uma cena (`cifrar`, `decifrar`, `decifrarEConferir`, `metaDoCifrado`).
- `seguranca.ts`: o AS1 (`conferirArquivoRecebido`, `nomeDeArquivoNoDisco`, `caminhoNaPastaOrganizada`, lista fechada de formatos, extensões proibidas).
- `envios.ts` e `enviosUso.ts`: `detectarFormato` (formato pelos bytes), os usos do envio do Claude, `usoDoArquivo`, `negarEnvio`.
- `assetsDaMesa.ts`: a lista "Assets da mesa" (`listarAssetsDaMesa`, `usosDoAsset`, `filtrarAssets`, `verificarApagar`).

No servidor, `apps/server/src/`:

- `transferencias.ts`: a classe `Transferencias`, o coordenador de quem manda qual pedaço a quem.
- `caixaDeEntrada.ts`: a caixa de entrada dos arquivos do Claude (SQLite do Durable Object).
- `sala.ts`: `asset.pedir`, `asset.inventario`, `asset.tenho`, `asset.naoTenho`, as rotas HTTP da caixa e `concluirEnvio`.

No navegador, `apps/web/src/assets/`:

- `gerente.ts`: a classe `GerenteDeAssets`, o cérebro (1100 linhas): pedir, receber, conferir, servir, registrar, cifrar, copiar para a pasta.
- `cache.ts`: `CacheOpfs`, o cache em disco do navegador (OPFS).
- `fonte.ts` e `fontes.ts`: de onde vêm e para onde vão os arquivos do usuário (`PastaLocal` com a File System Access API, `ArquivosSoltos`, `Memoria` para teste; `Fontes` junta tudo).
- `armazem.ts`: um chave-valor sobre o IndexedDB (a pasta escolhida e o índice "arquivo original → hash").
- `processador.ts` e `processador.worker.ts`: o Web Worker que decodifica, reduz, converte para WebP, fatia em tiles e calcula hashes.
- `ganchoE2E.ts`: ganchos que só existem no modo de teste.

Na tela: `SecaoDosAssets.tsx` (a lista), `caixaDoClaude.tsx` (processa o que o Claude mandou), `AvisoDaPasta.tsx`.

## Como funciona

### Subir um arquivo (o mestre põe um mapa)

```
escolher arquivo ──► worker: hash do original ──► índice local conhece? ── sim ──► reaproveita
                                                      │ não
                                                      ▼
                          worker: decodifica, reduz, WebP, (fatia em tiles), hash de cada peça
                                                      │
              cache OPFS ◄── grava ◄─────────────────┤──► guarda na pasta do mestre (se há)
                                                      ▼
                          intenção asset.registrar (só as METAS) ──► sala valida e emite asset.registrado
                                                      ▼
                          asset.tenho (hash) ──► sala anota "esta conexão tem este arquivo"
```

O ponto central: o arquivo **nunca vai para a sala**. A sala só recebe a `AssetMeta`: hash, tipo, mime, tamanho, largura, altura, `donoId` (quem enviou, que a sala preenche), nome, e a lista de hashes dos pedaços de 256 KB.

### Baixar um arquivo (o jogador vê o mapa)

1. A tela pede `garantir(hash)` ao `GerenteDeAssets`. Se já está pronto no cache, acabou.
2. Senão, `perguntar(hash)` manda `asset.pedir` à sala. Se o navegador já conhece a meta (do cache), pede só os pedaços que faltam.
3. A sala confere se aquela pessoa **pode ver** o asset (`assetVisivelPara`). Se não pode, responde `asset_inexistente`, igualzinho a um asset que não existe. Se pode, manda `asset.meta` e entrega o pedido à classe `Transferencias`.
4. `Transferencias` escolhe **um provedor** entre as conexões que anunciaram ter o arquivo (`escolherProvedor`: o dono se está online, depois o mestre, depois qualquer um) e manda `asset.enviar` a ele.
5. O provedor lê o arquivo do cache e manda cada pedaço como **frame binário** (`[tipo][hash 32 B][índice][total][dados]`). A sala repassa o frame, tal como veio, a todos que esperavam aquele pedaço.
6. Quem recebe confere o **hash do pedaço** contra a meta, grava o pedaço em `parciais/<hash>/<i>`, e, quando junta todos, monta o arquivo, confere o **hash inteiro**, confere de novo a **assinatura dos bytes** (AS1), grava em `assets/<hash>` e manda `asset.tenho`. Agora ele também pode servir esse arquivo.

Nada disso mexe no `Estado`: `asset.pedir`, `asset.inventario`, `asset.tenho` e `asset.naoTenho` são intenções "de vaivém" que `nucleo.ts` aceita e ignora (`return aplicado()`). A sala cuida delas fora do reducer.

## Decisões e por quê

**Os arquivos ficam no computador de quem os tem.** Origem: a restrição "tudo local" do projeto e a decisão do Vilella de usar imagens locais (`PROJETO.md`, decisões de produto). O servidor é um Cloudflare Worker com um Durable Object; guardar mapas de dezenas de MB lá custaria dinheiro e criaria um problema de privacidade (e de direitos autorais dos mapas) que não precisa existir. Descartado: subir tudo para R2/S3.

**Endereçamento por conteúdo (hash SHA-256).** O mesmo arquivo sempre tem o mesmo nome. Isso dá de graça: não duplicar (dois tokens com a mesma imagem são um arquivo), saber que o arquivo que chegou é o certo (se o hash não confere, jogue fora), e deixar qualquer navegador servir qualquer outro sem confiar nele.

**Pedaços de 256 KB (`TAMANHO_PEDACO`).** Cada pedaço tem hash na meta, então um pedaço corrompido é descartado e pedido de novo (até 5 vezes por pedaço, 3 por arquivo) sem refazer o arquivo todo. Os pedaços ficam em disco, então um refresh no meio de uma transferência de 30 MB retoma de onde parou. O limite de 256 KB mantém cada mensagem do WebSocket pequena (a sala é um Durable Object com memória limitada, e o `Transferencias` nunca grava um pedaço, só repassa).

**Um provedor por arquivo de cada vez.** Em vez de cada jogador pedir ao mestre e o mestre mandar N cópias, a sala escolhe um provedor, ele envia **uma vez**, e a sala repassa o mesmo frame a todos que esperam aquele índice. O mestre sobe um mapa de 20 MB e cinco jogadores baixam sem o mestre gastar 100 MB de banda.

**O local sempre vence a rede.** Ler do próprio disco não gasta a conexão de ninguém. Por isso a ordem de busca é: cache do navegador, depois a pasta do mestre, depois a rede (dono, mestre, qualquer um). Origem: o Q1 e o AS1, depois que o Vilella abriu a mesa num segundo navegador e nada carregou porque o primeiro estava fechado.

**A pasta do mestre, não a do jogador.** A File System Access API só existe no Chrome e no Edge e exige permissão a cada visita. O mestre é quem precisa guardar tudo; os jogadores recebem e deixam no cache. Firefox e Safari funcionam sem pasta (cache + outros navegadores online).

**Redução de imagem na entrada.** Token, retrato e imagem de handout são reduzidos a 512 px de lado; imagem solta na cena a 2048 px; mapa grande é fatiado. O limite não é capricho: o tile tem teto de 4096 px (e o teto real da GPU, `MAX_TEXTURE_SIZE`) e 512 px bastam para um token na tela.

**Segurança dos arquivos (AS1).** O arquivo vem de outra pessoa (um jogador, o Claude) e vai parar no disco do mestre. A regra de ouro: **o tipo vem dos bytes, nunca do nome nem do que o cliente declara**, e **quem recebe confere de novo**. Detalhes adiante.

## Os trechos complexos

### 1. O arquivo é o hash dele (e o índice local que evita reprocessar)

**Problema.** O mesmo mapa subido duas vezes, ou renomeado, não deveria ser processado de novo (decodificar um PNG de 16 MB e reconverter é caro).

**Como resolve.** `GerenteDeAssets.usarArquivo` calcula o SHA-256 do **original** no worker (`hashDoArquivo`), monta a chave `hashOriginal|tipo|limite` e consulta `indiceLocal` (IndexedDB, em `armazem.ts`). O valor guardado é `{ assetHash, nome }`, o hash do arquivo **processado**. Se o índice conhece a chave **e** o arquivo processado ainda está no cache (`estaPronto`), reaproveita as metas (a do manifesto e as dos tiles) sem decodificar nada. Senão, `Processador.processar` faz o serviço pesado, grava cada item no cache, e só então grava a entrada no índice.

A chave inclui o `tipo` e o `limite` de tile porque o mesmo original vira coisas diferentes: como `token` sai a 512 px, como `mapa` sai inteiro ou em tiles que dependem do `MAX_TEXTURE_SIZE` desta GPU.

**O que é frágil.** O índice vive no IndexedDB e o arquivo no OPFS; são independentes. O código confere `estaPronto` justamente porque o índice pode sobreviver ao cache (limpar dados do site apaga os dois, mas o navegador pode apagar o OPFS sozinho sob pressão de disco; por isso `persistir()` pede `navigator.storage.persist()` ao adicionar o primeiro asset). Mexer na ordem "grava no cache, depois no índice" pode deixar um índice apontando para nada.

**Quem vigia.** `packages/shared/src/assets.test.ts` (hash, pedaços, manifesto) e `e2e/tests/assets.spec.ts`.

### 2. O frame binário e a conferência por pedaço

**Problema.** O WebSocket já carrega JSON; misturar bytes em JSON (base64) incharia 33% e custaria CPU nos dois lados.

**Como resolve.** `montarFrameDePedaco` escreve `1 byte de tipo` (`TIPO_FRAME_PEDACO = 1`), `32 bytes do hash`, `uint32 big-endian do índice`, `uint32 do total` e os dados (`TAMANHO_CABECALHO_FRAME = 41`). `lerFrameDePedaco` devolve `null` para qualquer coisa estranha (tipo desconhecido, curto, `indice >= total`). Quem recebe (`GerenteDeAssets.aoPedaco`) segue estes passos, **numa fila por hash** (`enfileirar`, para dois pedaços do mesmo arquivo não correrem entre si):

1. descarta se o `total` do frame não bate com a meta, ou se o pedaço já está presente;
2. `pedacoConfere`: o tamanho do pedaço (o último é menor) e o SHA-256 batem com `meta.pedacos[i]`? Não: `pedirDeNovo`;
3. grava em `parciais/<hash>/<i>` e atualiza o status (`recebidos`/`total`);
4. se juntou todos, `finalizar`.

`finalizar` lê os pedaços do disco, monta, confere o hash do arquivo inteiro com `arquivoConfere`; se falhar, **apaga todos os pedaços** e pergunta de novo (3 tentativas); se passar, roda a conferência do AS1 (adiante), grava em `assets/<hash>`, apaga os parciais e diz à sala `asset.tenho`.

**O que é frágil.** A sala só repassa o frame se ela mesma pediu aquele hash e índice àquele socket (`Transferencias.frame` devolve `false` e descarta em silêncio caso contrário): um jogador não consegue empurrar bytes a outro. Se alguém mexer no `Transferencias.frame` e relaxar essa checagem, qualquer cliente passa a poder injetar pedaços. A conferência por hash no destino é a segunda barreira, e é ela que protege de verdade.

**Quem vigia.** `packages/shared/src/assets.test.ts` ("frame binário de pedaço", "pedaços e hash") e `apps/server/src/transferencias.test.ts`.

### 3. `Transferencias`: o coordenador na sala

**Problema.** Vários navegadores pedem, ao mesmo tempo, partes diferentes dos mesmos arquivos, de provedores que entram e saem a qualquer momento, com a sala podendo hibernar.

**Como resolve.** `Transferencias` guarda, por hash, uma `Transferencia`: o `total` de pedaços, quem **espera** o quê (`Map<conexão, Set<índice>>`), quem é o `provedor`, quais índices já foram **pendentes** (pedidos ao provedor e ainda não chegados), e quando chegou o último pedaço. Só memória; nunca grava pedaço.

- `pedir(conexão, hash, total, donoId, índices)` registra o que a conexão quer e chama `despachar`.
- `despachar` calcula os índices que alguém quer e ainda não foram pedidos (`semPedido`). Se não há provedor, pede ao `ambiente.candidatos(hash)` (conexões online com cópia, **excluindo quem está esperando o mesmo arquivo**: ele que se sirva de outro) e `escolherProvedor`. Sem candidato, manda `asset.indisponivel` a quem espera (uma vez só por conexão: `avisados`).
- `frame` repassa um frame válido e tira o índice de quem o esperava; quando ninguém espera mais, `encerrarSeAcabou` apaga a transferência.
- `naoTem` (o provedor respondeu "não tenho") larga o provedor e `despachar` tenta outro; `posseMudou` (alguém anunciou ter o arquivo) retoma o que estava indisponível; `conexaoSaiu` limpa e, se a conexão que saiu era o provedor, outro assume.
- Um pedido do provedor parado há mais de `TEMPO_PARADO_MS` (15 s) é refeito no próximo `pedir` de quem espera. O provedor reenvia; frames repetidos são inofensivos porque quem recebe descarta pedaço que já tem.

**O que é frágil.** Como é só memória, uma hibernação do Durable Object perde tudo. Por isso o cliente tem um **vigia** (`GerenteDeAssets.vigiar`, a cada 4 s): quem está em `pedindo`/`baixando` sem progresso por 20 s pergunta de novo, e quem está `indisponivel`/`erro` pergunta a cada 30 s. Se tirar o vigia, a recuperação depende de o usuário recarregar.

**Quem vigia.** `apps/server/src/transferencias.test.ts` (provedor que sai, que não tem, indisponível, retomada) e `e2e/tests/assets.spec.ts`.

### 4. A pasta do mestre (File System Access API)

**Problema.** Um arquivo que só existe no cache do navegador some se o usuário limpar os dados do site, e não existe em outro navegador do mesmo computador. E o navegador não deixa reabrir um arquivo qualquer do disco do usuário sem pedir permissão toda vez.

**Como resolve.** `PastaLocal` (em `fonte.ts`) embrulha um `FileSystemDirectoryHandle`. O mestre escolhe a pasta uma vez (`showDirectoryPicker`, exige um clique); o **handle** é guardado no IndexedDB (`armazem.ts`, repositório `pasta`, chave `handle:<mesaId>`: a pasta é **por mesa**, desde o C1). Na visita seguinte, `PastaLocal.lembrada` recupera o handle, mas a permissão pode ter expirado: `permissao()` devolve `granted`/`prompt`/`denied`, e `Fontes` traduz em `autorizada`/`reautorizar`/`negada`. Reautorizar exige um clique do usuário (o navegador exige gesto), por isso aparece o aviso "Reautorizar a pasta da mesa" (`AvisoDaPasta.tsx`).

O que o gerente grava na pasta:

- **`arquivos-da-mesa/<hash>`** (`guardarNaPasta`): uma cópia do cache, o nome é o hash. É de onde outro navegador do mesmo computador carrega, sem o primeiro estar aberto.
- **`assets/<quem enviou>/<tipo>/<nome>-<hash>.<ext>`** (`copiarSePreciso`): a pasta **organizada**, para o humano achar as coisas.
- **`compendio/*.json`**, escritos por "Carregar arquivos do compêndio" e lidos por `Fontes.abrirArquivosDoCompendio`.
- `tavola-mestre.json`: a chave do mestre (ver o trecho 7).

`sincronizarComAPasta(metas)` roda ao abrir a mesa, ao escolher/reautorizar a pasta e quando chegam metas novas: traz da pasta o que a mesa usa e o cache não tem (conferindo hash **e** assinatura de cada arquivo) e leva para a pasta o que o cache tem e ela não. As chamadas são **encadeadas** numa promessa (`sincronizando`) para não correrem em paralelo.

**Por que dois lugares (`arquivos-da-mesa` e `assets/`).** O Q1 criou o `arquivos-da-mesa/<hash>` (máquina: um arquivo por hash, nada de nome). O AS1 pediu uma pasta que o humano entendesse. Descartado: usar só a organizada, porque o nome mistura quem enviou e o nome de exibição (que muda quando o mestre renomeia), enquanto o hash é estável. A pasta antiga `recebidos/<jogador>/` não é mais escrita, mas continua na lista `PASTAS_IGNORADAS` (a varredura de imagens a pula, junto com `arquivos-da-mesa`, `backup` e `gravacoes`).

**O que é frágil.**
- `PastaLocal.escolher` e `reautorizar` **precisam rodar direto de um clique**; trazer uma `await` antes do `requestPermission` perde o gesto e o navegador recusa.
- Tudo que usa a pasta tem de aceitar falha em silêncio: a permissão pode acabar no meio de uma varredura (`listarPasta` tem `try/catch` por isso). O cache continua valendo.
- Nos testes não há seletor de verdade: `Fontes.memoria` (classe `Memoria`) faz o papel da pasta, e `simularPasta` escolhe o estado. Isso só existe com `import.meta.env.MODE === "e2e"`.

**Quem vigia.** `e2e/tests/q1.spec.ts` (a pasta, o reautorizar, o segundo navegador) e `e2e/tests/as1.spec.ts` (a pasta organizada).

### 5. Tiles e a redução a 512 px

**Problema.** Um mapa de 12000 x 9000 px não cabe numa textura de GPU (o teto típico é 8192 ou 16384, e o PixiJS exige textura inteira). Além disso o token de 4000 px de lado gasta memória à toa.

**Como resolve.** Tudo em `processador.worker.ts`, função `processar`:

- Decodifica com `createImageBitmap` e desenha num `OffscreenCanvas`, convertendo para **WebP** com qualidade 0.92 (`QUALIDADE_WEBP`). Se o navegador não converte para WebP (o `blob.type` volta diferente), lança.
- `token`, `retrato` e `imagem` (tudo que não é `mapa`): redimensiona para caber em `LIMITES_DE_ASSET.ladoMaximoDoToken` (512 px) ou, para `imagem`, `ladoMaximoDaImagem` (2048 px), **nunca ampliando** (`escala = min(1, lado / maior)`).
- `mapa` que cabe no limite de textura (`precisaFatiar` é falso): vira um arquivo só, sem redução.
- `mapa` grande: `retangulosDeTiles(largura, altura, ladoDoTile(limite))` calcula os retângulos. `cortes` divide cada eixo em `ceil(total / lado)` partes **iguais** (±1 px) em vez de deixar um pedacinho no fim, e os retângulos cobrem a imagem inteira sem sobreposição. Cada tile vira um asset de tipo `tile`, e um **manifesto** (`montarManifestoDeMapa`) vira o asset `mapa`: `bytes: 0`, `pedacos: []`, `tiles: [...]`. O **hash do manifesto** é o SHA-256 do texto `hash:x:y:largura:altura` de cada tile, uma linha por tile (`hashDoManifesto`). Como o mapa não tem arquivo único, esse hash é a identidade dele.
- O limite de textura vem de `limiteDeTextura(maxTextureSize())`: `min(MAX_TEXTURE_SIZE da GPU, 8192)`. O lado de cada tile nunca passa de 4096 (`ladoDoTile`).
- Tetos: 64 tiles por mapa (`tilesPorMapa`), 200 MB a soma dos tiles (`bytesPorMapa`), 30 MB por arquivo processado (`bytesPorArquivo`). Passou, lança com a mensagem em português.

`validarMeta` (na sala, na intenção `asset.registrar`) confere de novo, no servidor, tudo isso: um manifesto não pode ter bytes nem pedaços, os tiles têm de **cobrir exatamente** a área do mapa (`soma de largura*altura === largura*altura do mapa`), nenhum pode sair do mapa, e cada tile citado tem de ter sido registrado como `tile` no mesmo lote ou antes.

**O que é frágil.** O limite de tile depende da GPU do **mestre que subiu**. Um jogador com GPU menor recebe tiles que a máquina dele teoricamente não aguenta; o teto de 4096 e o `min(…, 8192)` existem para evitar isso, mas "tile maior que 8192 px nunca foi exercitado em GPU real" (`docs/PASSAGEM.md`, pontos frágeis) e "pode aparecer uma linha fina entre tiles" é um risco anotado. `precisaFatiar` usa `max(largura, altura) > limite`: mudar para "área" muda quais mapas são fatiados.

**Quem vigia.** `packages/shared/src/assets.test.ts` ("tiles", "manifesto de mapa fatiado", "limites") e `e2e/tests/assets.spec.ts` (usa o gancho `limiteTile` de `ganchoE2E.ts` para forçar fatiar com imagem pequena).

### 6. A cifra do pré-envio (e o que é, de fato, "a chave da pasta")

Há duas coisas com "chave" no projeto, e vale separar.

**(a) AES-GCM no pré-envio de uma cena** (`cifra.ts`). *Problema*: o mestre quer que os jogadores já tenham baixado o mapa de uma cena futura **sem poderem abri-lo** antes da hora (spoiler). *Como resolve*: no mestre, `cifrarParaPreparo(hashes)` lê cada arquivo, chama `cifrar` (chave AES-256 **nova por arquivo** e IV de 12 bytes aleatório, que vai no começo do cifrado: `iv + cifrado + etiqueta de 16 bytes`), grava o cifrado no cache, registra como asset de tipo `cifrado` (sem nome real: `nomeOriginal: "cifrado"`, 1 x 1 px, ver `metaDoCifrado`) e devolve os pacotes `{hashCifrado, hashOriginal, chave}`. A intenção `cena.preparar` leva **as chaves só para a sala** (nunca ao estado, nem à exportação: `hashesUsados` e `criarExportacao` as ignoram). Todo jogador pode baixar o `cifrado` (`assetVisivelPara` devolve `true` para o tipo `cifrado`: sem a chave são bytes sem sentido), então o download acontece antes. Quando o mestre leva o grupo para a cena, a sala manda `preparo.chaves` **antes do snapshot**; `aoChaves` marca os originais como "em decifração" para o snapshot não pedi-los pela rede, e `decifrarPacotes` abre cada um com `decifrarEConferir` (que também **confere o SHA-256 do resultado** contra `hashOriginal`) e descarta o cifrado. O que não abrir segue o caminho normal (pede o original à rede). *Frágil*: cifrar e decifrar leem o arquivo **inteiro** em memória (não medido com um tile de 30 MB nem com um mapa de 200 MB); cifrado que chega depois de a ida ter acabado fica sem uso, e não há limpeza dos antigos, que contam para o teto de 2000 assets (`PASSAGEM.md`, pontos frágeis, Lote 4).

**(b) A chave da pasta do mestre** (`tavola-mestre.json`, C3). Não é cifra da pasta: nenhum arquivo da pasta é cifrado. É um **par de chaves ECDSA P-256** (`recuperacao.ts`): a pública vai ao servidor, a privada fica **só** no arquivo da pasta e prova que quem a tem é o dono da mesa (recuperação de acesso do mestre, assinando um desafio do servidor). O arquivo é descrito em `contas/pastaDoMestre.ts` e fica no capítulo de contas; aqui só importa que ele mora na mesma pasta, e que `conferirPastaLivreParaMesa` recusa uma pasta que já guarda a chave de outra mesa. Se quem pediu esta explicação esperava "a pasta cifrada com uma chave", **isso não existe no código**: ver as divergências no fim.

**Quem vigia.** `packages/shared/src/personagens.test.ts` (os blocos "cifra do pré-envio" e "cena.preparar") e, para a chave ECDSA da pasta, `packages/shared/src/recuperacao.test.ts`.

### 7. AS1: a pasta organizada, a conferência de formato e os nomes perigosos

**Problema.** Um jogador pode mandar um `.exe` renomeado para `.png`, um SVG com script, uma imagem com bytes escondidos depois do fim, ou um nome como `..\..\Startup\x.bat`. E o mestre grava isso no disco dele.

**Como resolve, em camadas** (`seguranca.ts` e `detectarFormato` em `envios.ts`):

1. **O tipo vem dos bytes.** `detectarFormato(bytes)` olha as assinaturas: PNG (`89 50 4E 47 ...`; é **apng** se há um chunk `acTL` antes do primeiro `IDAT`, o que `ehApng` descobre lendo só os cabeçalhos dos chunks), JPEG (`FF D8 FF`), GIF (`GIF87a`/`GIF89a`, sempre "animado"), WebP (`RIFF....WEBP`; animado se o bit `0x02` do byte de opções do chunk `VP8X` está ligado), WAV, OGG, MP3 (`ID3` ou o sincronismo `FF E0+`) e JSON (primeiro caractere útil `{` ou `[`, depois de um BOM e espaços). Qualquer outra coisa devolve `null`.
2. **Lista fechada.** `FORMATOS_PERMITIDOS`: `png jpg gif webp mp3 ogg wav json`. Nunca SVG, página, programa ou script.
3. **O formato tem de servir ao tipo.** `FORMATOS_DO_TIPO`: `mapa/token/retrato/tile/imagem` aceitam as 4 imagens; `animacao`, `png/gif/webp`; `som`, `mp3/ogg/wav`; `compendio`, `json`; `cifrado` não tem assinatura (é opaco).
4. **E tem de bater com o que o remetente declarou.** `conferirArquivoRecebido(bytes, meta)` compara o MIME detectado com `meta.mime`, depois de normalizar (`image/jpg` → `image/jpeg`, `audio/mp3` → `audio/mpeg`, `audio/x-wav` → `audio/wav`, `image/apng` → `image/png`).
5. **E cabe no limite do tipo** (`limiteDeBytesDoTipo`: som 20 MB, animação 4 MB, compêndio 16 MB, resto 30 MB; `cifrado` ganha +28 bytes da cifra).
6. **`descreverIntruso`** só serve para a mensagem: se o formato não é reconhecido, diz o que parece ser ("um programa do Windows", "um arquivo compactado", "uma imagem SVG (que pode levar script)"). Nunca decide a aceitação.

**Quem confere, e onde:** `finalizar` (quem baixou), `guardarNaPasta` (antes de gravar em `arquivos-da-mesa`), `copiarSePreciso` (antes de gravar na organizada), `sincronizar` e `tentarDaPasta` (o que a pasta traz, porque alguém pode ter posto lá). Um arquivo recusado entra em `recusados` (hash → motivo), a tela mostra "Arquivo recusado: ..." e ele **nunca** vai para a pasta.

**A imagem de outra pessoa é regravada.** Em `copiarSePreciso`, se o `donoId` não é o do mestre e a imagem não é animada, o gerente chama `Processador.regravar`: decodifica e grava de novo como WebP gerado **aqui** (no máximo 512 px ou 2048 px). Nada escondido no arquivo original (metadados, bytes depois do fim, script) sobrevive. GIF e APNG animados ficam como vieram (regravar mataria a animação), mas já passaram pelas conferências acima.

**Os nomes.** `nomeDeArquivoNoDisco(nomeOriginal, formato, hash)` monta `<nome limpo>-<8 letras do hash>.<extensão do formato detectado>`:

- tira qualquer caminho (`replace(/^.*[\\/]/, "")`) e a extensão original (`foto.exe.png` vira `foto-exe-1a2b3c4d.png`; um `.exe` que é PNG vira `.png`);
- `limparTrecho` remove caracteres de controle (inclusive NUL), troca `\ / : * ? " < > |` por `_`, troca **todo ponto interno por hífen** (assim nunca sobra `..` nem uma segunda extensão), colapsa espaços, tira hífens, sublinhados e espaços das pontas, corta em 80 caracteres e devolve `"arquivo"` se sobrou nada;
- nomes que o Windows reserva (`con`, `prn`, `aux`, `nul`, `com1`...`lpt9`, `clock$`) ganham um `_` na frente;
- `EXTENSOES_PERIGOSAS` (`exe bat cmd ps1 lnk js svg html sh py apk dmg ...`) nunca pode ser a extensão: se a extensão do formato detectado cair aí, lança. `temExtensaoPerigosa` serve para conferir qualquer nome de qualquer origem.
- o hash no nome faz o mesmo arquivo cair sempre no mesmo lugar e distingue dois arquivos de mesmo nome.

`caminhoNaPastaOrganizada` monta a pasta: `assets/<pessoa limpa>/<pasta do tipo>/`, onde o tipo vira `mapas` (também para `tile`), `tokens`, `retratos`, `imagens`, `animacoes`, `sons`, `json`. Tile, `cifrado` e manifesto devolvem `null` (não vão para a organizada). O compêndio também fica de fora (já mora em `compendio/`).

**O que é frágil.** Um tipo de arquivo novo precisa entrar em **três** lugares: `FORMATOS_DO_TIPO` e `FORMATOS_PERMITIDOS` (`seguranca.ts`), `MIMES_DE_IMAGEM` ou a regra do `validarMeta` (`assets.ts`), e `detectarFormato` (`envios.ts`). Esquecer um deixa o arquivo ser aceito no envio e recusado ao receber (ou o contrário). A assinatura do MP3 (`FF E0+`) é frouxa de propósito e pode confundir bytes aleatórios com MP3; o que protege é a lista fechada e o tipo exigido.

**Quem vigia.** `packages/shared/src/as1.test.ts` ("segurança dos arquivos") e `e2e/tests/as1.spec.ts`.

### 8. A lista "Assets da mesa", filtrada por quem vê

**Problema.** Uma lista única com tudo que a mesa guarda (mapas, tokens, retratos, sons, músicas, handouts, json), mostrando quem enviou e **onde cada arquivo é usado**, sem vazar nada que o jogador não pode ver (o mapa escondido, o som do mestre).

**Como resolve.** `listarAssetsDaMesa(estado, usuario)`:

- O mestre vê todo asset que tem categoria (`categoriaDoAsset`). Ficam de fora `tile` e `cifrado`, que são pedaços internos.
- O jogador trabalha sobre uma **visão reduzida do estado** (`visaoDoJogador`): só a cena ativa, os tokens que ele vê, as fichas e handouts que ele vê. Sons, zonas, automações, música e luz são do mestre e nem entram na conta de "onde é usado".
- Para cada asset, `usosDoAsset(base, hash)` varre o estado e monta a lista de lugares onde ele aparece (mapa da cena X, imagem solta Y, token padrão de Z, retrato de W, aparência e símbolo da ficha, handout, compêndio, efeito/ambiente da mesa de som, zona, automação, música, chama de modelo de luz, trilha). Cada uso marca se é **removível** (apagar o arquivo faz a mesa se arrumar sozinha) ou não.
- O jogador só vê o que enviou **ou** o que está em uso numa coisa que ele vê, **e**, de novo, `assetVisivelPara` precisa concordar: a regra de visão é uma só, usada também no `asset.pedir`.
- `filtrarAssets` aplica categoria, dono, busca (sem acento nem caixa, no nome, no dono e nos usos) e ordem (`nome`, `data` = ordem de registro, mais novo primeiro; `tamanho`). É puro; a tela só o chama.

`assetVisivelPara` é a regra central de sigilo dos arquivos, e merece ser lida inteira: o mestre vê tudo; o jogador vê `cifrado`, o compêndio **que a mesa definiu**, todo `som` e toda `animacao` (a sala só diz qual tocar; o hash não revela de qual zona veio), o que ele mesmo enviou, a imagem de um token visível, o token padrão e o retrato de um personagem que ele vê, a aparência e o símbolo de uma ficha cuja ficha ele vê, a imagem de um handout visível, o retrato de quem falou numa mensagem pública do chat, e o mapa da cena ativa com os tiles dele. **Quem pergunta por um asset que não vê recebe a mesma resposta de quem pergunta por um que não existe.**

**O que é frágil.**
- **Quem calcula a lista depende de quem é.** A do mestre é calculada no navegador dele (`AssetsDaMesa.tsx`, `listarAssetsDaMesa` com 250 ms de espera depois de cada mudança do estado). A do jogador é calculada **na sala**: ele manda `assets.listar` e a sala responde `assets.lista` (`sala.ts`), assim nenhum asset que ele não vê chega ao navegador dele. Com milhares de assets e tokens, vigiar o custo (`PASSAGEM.md`, AS1, frágil 3).
- O jogador mantém a **posse**: `asset.inventario` e `asset.tenho` só valem para assets que a pessoa vê (`conhecido`), para ninguém usar o inventário como oráculo de "este hash existe".
- O nome de um `som` é trocado por `"som"` ao ir para um jogador (`asset.pedir` em `sala.ts`): o nome do arquivo pode contar o que a zona secreta faz.

**Quem vigia.** `packages/shared/src/as1.test.ts` ("lista de assets da mesa") e `packages/shared/src/assets.test.ts` ("assetVisivelPara").

### 9. A caixa de entrada do Claude

**Problema.** O Claude (via MCP) quer mandar um mapa, um token ou um som. Só que o MCP é texto, o arquivo está no computador do mestre, e o **processamento** (WebP, tiles, cifra) acontece no **navegador** do mestre, não no servidor.

**Como resolve.** O Claude pede o envio por uma ferramenta; a sala devolve um **link de uso único** e o comando de shell (`comandoDeEnvio`, um `curl -T`); o Claude o roda **na máquina onde o arquivo está**, o arquivo vai direto para a sala por `PUT /api/m/<id>/claude/envio/<segredo>`, e o modelo nunca vê o token. Sem shell, manda em base64 (`guardarBytesDoClaude`).

Na sala:

1. `criarEnvioDoClaude` confere o ritmo (`conferirRitmoDeEnvio`: pedidos por minuto e envios abertos por token) e abre o envio em `CaixaDeEntrada.criar`. O segredo (`tve_` + 32 bytes aleatórios em base64url, `novoSegredoDeEnvio`) nunca é guardado: só o **hash** dele. O link vale 15 minutos e **uma vez** (`gastarLink`).
2. O `PUT` lê o corpo em streaming, **exige `Content-Length`**, para se passar do que foi declarado ou do limite do uso, lê os 64 primeiros bytes e roda `detectarFormato` + `motivoDoFormato` (o formato real tem de servir ao uso pedido), e grava o arquivo em **linhas de 1 MB** no SQLite do Durable Object (`gravarPedaco`). Teto da caixa inteira: 300 MB.
3. `receber` marca o envio como `recebido` (o prazo de 24 h conta daí) e `avisarPendentes` manda `caixa.pendentes` ao navegador do mestre. Se o mestre está online, o `PUT` espera até 20 s o resultado e o devolve na resposta, para o Claude saber na hora se deu certo.

No navegador do mestre (`useCaixaDoClaude`, em `caixaDoClaude.tsx`): para cada pendente, uma fila **de um por vez**: baixa de `GET caixa/<id>` (só o mestre; um segundo navegador do mestre que chega enquanto o primeiro processa recebe `409` e pula), passa pelo **mesmo caminho do botão de subir**: `usarArquivo` para mapa e token, `usarArquivo(..., "retrato")` para retrato, aparência, símbolo e handout (todos a 512 px), `registrarSom`, `registrarAnimacao`, `registrarImagemSolta`, e para o compêndio `lerCompendio` antes de `registrarCompendio`. Registra o asset e manda `caixa.concluir` (ou `caixa.falhar` com o motivo).

Na sala, `concluirEnvio`: espera o `asset.registrar` aparecer (até 2 s), confere o **tipo** do asset processado contra o uso, calcula a intenção com `usoDoArquivo` e a executa **como o Claude que pediu** (`tratarIntencao` com `claude: true` e o token dele, no lote dele), então o Desfazer a desfaz e as permissões são as dele. Apaga os bytes da caixa e acorda quem esperava.

**Decisão: aplicar "como o Claude", não "como o mestre".** Assim o mestre não precisa ficar clicando, o desfazer funciona por lote, e o que o Claude pode fazer continua limitado pelas permissões que o usuário dele tem. `negarEnvio` (em `enviosUso.ts`) roda a checagem **antes de dar o link**, usando as regras de verdade (`processar`) sobre uma cópia do estado com um asset de mentira já registrado: a resposta é a que a mesa daria ao aplicar de fato.

**O que é frágil.**
- Sem o navegador do mestre aberto, o arquivo **espera na caixa** (até 24 h) e é processado quando ele abre a mesa. Passou das 24 h, `limpar` apaga.
- `processando` tem prazo (`PRAZO_DO_PROCESSAMENTO_MS`, 90 s): se o navegador sumir no meio, a sala oferece o arquivo de novo.
- `SUBPASTA_DO_USO` (`caixaDoClaude.tsx`) decide em que subpasta da pasta local vai a cópia do arquivo original (`mapas`, `tokens`, `retratos`, `handouts`, `sons`). `imagem` e `animacao` ficam `null` porque têm a pasta organizada do gerente, e o compêndio também, porque não se sobrescreve o arquivo do mestre. Detalhe: `copiarParaAPasta` grava com `fontes.pastaDoCompendio()`, que só devolve a pasta se ela está autorizada para escrita.

**Quem vigia.** `apps/server/src/caixaDeEntrada.test.ts` (link único, linhas, tetos, migração), `packages/shared/src/envios.test.ts` (formato pelos bytes, segredo, usos) e `e2e/tests/envio-m1.spec.ts`.

### 10. O compêndio e o som como assets

Os dois seguem **o mesmo caminho** da imagem: `registrar*` no gerente grava no cache, copia para a pasta (`guardarNaPasta`), registra a meta (`asset.registrar`) e anuncia a posse (`asset.tenho`). Os bytes só saem por pedaços, quando alguém pede. A diferença está nas regras de `validarMeta` e de visibilidade.

- **Compêndio** (`registrarCompendio`): asset de tipo `compendio`, `mime: application/json`, 1 x 1 px, até 16 MB (`bytesDoCompendio`). Só o mestre registra. A mesa o conhece por `Estado.compendio` (`{ hash, nomeOriginal, magias }`, só a **referência**; o texto nunca está no estado). `assetVisivelPara` só libera para todos o compêndio que é `Estado.compendio.hash`; um compêndio antigo do mestre cai na regra comum (só o dono). O jogador baixa pelo mesmo `garantir` das imagens; a leitura e a junção das listas são do capítulo seguinte.
- **Som** (`registrarSom`): asset de tipo `som`, mp3, ogg ou wav, até 20 MB. O mime vem do navegador **ou** do nome (`mimeDoSomPeloNome`) no registro, mas a conferência dos bytes (`conferirArquivoRecebido`) vale na recepção. **Todo jogador pode baixar qualquer som** (`assetVisivelPara`): a sala só diz *qual* tocar, e a zona que o usa continua secreta porque o hash não diz de onde veio. O nome é anonimizado para o jogador.
- **Animação** (`registrarAnimacao`): gif, webp animado ou apng, até 4 MB, **sem processar** (reduzir quebraria a animação); as dimensões reais vêm do primeiro quadro (`Processador.medir`).
- **Imagem solta** (`registrarImagemSolta`): olha os primeiros 64 KB, se `detectarFormato` diz que é animada, vai como animação; senão passa por `usarArquivo(..., "imagem")` (WebP de até 2048 px).

Quem registra um hash que **já existe** não muda o dono nem o nome (`asset.registrar` filtra `novas`); o nome de exibição (`nomeExibicao`) é só do mestre, por `asset.renomear`, e `asset.registrar` o descarta.

### 11. A limpeza do que não é usado

**Não existe coleta automática de lixo**, e isso é deliberado: apagar arquivo é decisão do mestre.

- **Apagar à mão** (`asset.apagar`): `verificarApagar` decide. Sem uso: apaga. Em uso, e todos os usos são **removíveis** (mapa, token, imagem solta, retrato, aparência, símbolo, handout): a intenção recusa com a lista de usos até o mestre confirmar (`removerUsos: true`); então a sala emite, na ordem, `cena.mapaAlterado` (tira o mapa), `token.editado`/`token.apagado` (a imagem solta é um token e some; apagar o arquivo de um token comum só tira a imagem), `personagem.alterado` e `handout.alterado`, e por fim `asset.removido` (do manifesto **e** dos tiles dele). Em uso num lugar que **não** se arruma sozinho (som, zona, automação, luz, música, compêndio): **recusa**, mandando tirar o arquivo de lá primeiro.
- **O cliente limpa por conta própria o que é do protocolo**, não do usuário: o cifrado é apagado do cache e do inventário depois de decifrado (`descartarCifrado`); os pedaços parciais são apagados ao concluir ou falhar a conferência.
- **O que sobra**: cifrados que nunca foram abertos, arquivos que já ninguém usa e que o mestre não apagou. Contam para o teto de 2000 assets da sala (`LIMITES_DE_ASSET.assetsNaSala`).

**Frágil.** A emissão de `asset.apagar` em `nucleo.ts` tem uma lista **fixa** de lugares que usam um asset (mapas, tokens, personagens, handouts). Um lugar novo que referencie um hash precisa entrar em quatro funções: `hashesUsados` (`assets.ts`), `usosDoAsset` (`assetsDaMesa.ts`), a emissão do `asset.apagar` (se for removível) e `assetVisivelPara` (se o jogador tem de ver). Esquecer `hashesUsados` faz o asset sumir da exportação; esquecer `usosDoAsset` deixa apagar um arquivo em uso.

### 12. Exportar e importar: as referências, nunca os bytes

**Problema.** Levar uma campanha para outro computador, ou guardar um backup, sem carregar centenas de MB de imagens, e sem criar um arquivo que um jogador possa abrir e ver o mapa escondido.

**Como resolve.** A exportação (`criarExportacao` em `nucleo.ts`, versão 13) é **só metadados**. Ela copia o `Estado` tirando o que é da **sessão**, não da campanha: `memoriaEsquecida`, `trilha`, `somLigado`, `musicaTocando`, `acendimentos`, `chat` e `retratosDoChat`, além dos **preparos cifrados** (as chaves nunca entram). O relógio é congelado pausado, no tempo em que foi exportada. Na lista `assets`, entram **só** os que `hashesUsados` diz que a campanha usa: mapas das cenas (e os tiles), imagens de token, token padrão, retrato, aparência e símbolo, imagem de handout, o compêndio da mesa, e os sons que a mesa referencia (trilha, trilha de cada cena, mesa de som, música, zona, ação `som.tocar` das automações, chamas dos modelos de luz). O asset `outroMapa` que nada usa fica de fora. O teste confere que o JSON inteiro tem menos de 20 KB: nenhum campo carrega bytes.

A importação (`campanha.importar`) passa por `lerExportacao`, que aceita de **v1 a v13** e devolve sempre v13 (migrando as versões antigas, por exemplo `converterAutomacoesDoArquivo`). Valida formato, ids únicos, pelo menos um mestre, cena ativa, pastas, personagens e tokens coerentes, e a referência a asset sem meta e a hashes repetidos é recusada. Regras que vale conhecer:

- **O `seq` nunca volta**: `Math.max(seq atual, seq importado)`, porque números já enviados não podem ser reaproveitados.
- **Quem importa tem de ser mestre também na campanha importada** (senão o importador se trancaria para fora).
- O resultado é um snapshot para **todos** (`snapshotPara: "todos"`), porque o estado inteiro mudou; `cuidarDePreparo` descarta todos os preparos cifrados (os arquivos cifrados deixaram de existir).
- **Depois da importação, os arquivos não vêm com ela**: a campanha importada referencia hashes que o navegador pode ter no cache ou na pasta do mestre (se é o mesmo computador) ou **não ter em lugar nenhum** (outro computador). Nesse caso a mesa mostra "indisponível" até alguém que tenha o arquivo estar online, ou o mestre escolher a pasta onde ele está. É o preço de nunca carregar bytes; a vantagem é que o arquivo de exportação é pequeno e seguro de compartilhar.

**Quem vigia.** `packages/shared/src/assets.test.ts` ("exportação v3", "recusa referência a asset sem meta...") e `packages/shared/src/nucleo.test.ts`.

## Para ir além

- `../ARQUIVOS.md`: o mesmo assunto em linguagem simples, escrito para o Vilella (Q1).
- `../PASSAGEM.md` seções "Q1", "AS1", "M1" e "C3", e a seção 5 (pontos frágeis por lote, Lote 4 e Lote 5 em particular).
- `../REDESIGN.md` "AS1 — como ficou" para as suposições (limites de 20 MB, 64 MB, 2048 px, 300 MB, 24 h).
- `../protocolo.md` para as mensagens `asset.*`, `caixa.*` e `assets.lista`.
- `../MCP.md` para a ferramenta `arquivos` e o comando que o Claude roda.
