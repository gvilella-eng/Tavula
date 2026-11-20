# Usar o Claude na mesa (o servidor MCP)

O Távola tem um servidor MCP **dentro da própria sala**: o Claude (Claude Code ou Claude Desktop) liga na sua mesa por
HTTP. Com ele, o mestre pede "monte a cena da Eclusa" e o jogador pede "monte o meu personagem".

O Claude entra na mesa **como você**. Ele tem as suas permissões e vê só o que você vê. A sala é quem decide o
que vale: o servidor MCP não tem permissão própria nem modo "administrador".

## Conectar o Claude Code (3 passos)

1. Na mesa, abra **Preferências → Conectar o Claude**, clique em **Gerar token** e **copie o comando** que aparece
   (é uma linha só, com o seu token já dentro).
2. **Cole em qualquer terminal** (PowerShell, cmd ou o terminal do Mac), em qualquer pasta, e aperte Enter.
3. Abra o Claude Code e peça: **"mostre o panorama da mesa"**.

O comando é assim (o endereço é o da página que você está usando; o nome leva o id da mesa, para duas mesas não
brigarem):

```
claude mcp add --transport http --scope user tavola-<id da mesa> <endereço da página>/api/m/<id da mesa>/mcp --header "Authorization: Bearer <seu token>"
```

- Não precisa do Távola baixado, de Node, de arquivo nem de `build`: um jogador de outro computador conecta igual.
- Só aspas duplas, nada de `$`, crase nem `;`: vale igual no PowerShell, no cmd e no bash.
- **Já tinha conectado esta mesa?** Rode antes `claude mcp remove --scope user tavola-<id da mesa>`.
- No `pnpm dev`, o endereço é `http://127.0.0.1:5173` (o proxy do Vite repassa `/api` para a sala). Se a mesa estiver na
  internet, é o endereço dela (`https://...`).
- Dentro do Claude Code, `/mcp` mostra o servidor `tavola-<id>` conectado.
- Em **Preferências**, o cartão mostra "conectado agora" enquanto o Claude está usando (e "usado há X min" depois).

### Gerar o seu token

1. Em **Preferências → Conectar o Claude**, clique em **Gerar token** (o nome é opcional).
2. O token (`tvc_...`) aparece **uma vez**. A sala guarda só uma "impressão digital" dele.
3. Guarde-o como uma senha: quem o tiver entra na mesa como você (e o comando o traz). Para cortar o acesso, clique em
   **Revogar**: a próxima chamada já recebe 401.

Cada pessoa gera o próprio token. Você pode ter até 5 por mesa.

### Conectar o Claude Desktop

O Claude Desktop **não** liga a um servidor da internet com cabeçalho pelo arquivo de configuração (os conectores
remotos dele exigem conta e um endereço público). Por isso o Desktop usa o servidor **local**, em stdio, que continua
existindo em `apps/mcp`. Isso **exige** o Távola baixado e o Node:

1. Na pasta do Távola: `pnpm install` e `pnpm --filter @tabletop/mcp build` (cria `apps/mcp/dist/tavola-mcp.mjs`;
   refaça depois de atualizar o Távola).
2. Em **Preferências → Conectar o Claude → Claude Desktop**, copie o trecho e cole no `claude_desktop_config.json`
   (Configurações → Desenvolvedor → Editar configuração). Troque `<pasta do Távola>/apps/mcp/dist/tavola-mcp.mjs` pelo
   caminho completo do arquivo e reinicie o Claude Desktop.

```json
{
  "mcpServers": {
    "tavola": {
      "command": "node",
      "args": ["C:/Users/voce/Tabletop/apps/mcp/dist/tavola-mcp.mjs"],
      "env": {
        "TAVOLA_URL": "http://127.0.0.1:5173",
        "TAVOLA_MESA": "<id da mesa>",
        "TAVOLA_TOKEN": "<seu token>"
      }
    }
  }
}
```

(Uma ponte que ligue o Desktop à rota HTTP sem esse arquivo existe como pacote da internet, mas o Távola não baixa
nada da internet por conta própria; por isso ela não é o caminho indicado.)

### O compêndio (magias, armas e itens)

**Pelo caminho HTTP (o principal)** o Claude consulta o exemplo do SRD que vai dentro da sala (poucas entradas: 3
magias, 9 armas e 5 itens); o compêndio completo da mesa ainda não é lido por ele. **Pelo servidor local (stdio, o do
Claude Desktop)** ele lê o compêndio do seu computador, nesta ordem:

1. o arquivo da variável `TAVOLA_COMPENDIO` (o caminho do seu `magias.json`);
2. `compendio/magias.json` na pasta onde o servidor roda;
3. o exemplo do SRD que vai dentro do programa (poucas entradas).

Para ter o compêndio completo no servidor local, ponha `"TAVOLA_COMPENDIO": "C:/caminho/magias.json"` no `env`. O compêndio
**não tem monstros**: para um NPC, o Claude monta a ficha por partes a partir da sua descrição.

## Exemplos de pedidos

**Jogador**

- "Monte o meu personagem: anão clérigo nível 3, rolando 4d6 (descartando o menor) para os atributos. Ponha as
  magias de clérigo de nível 1 do compêndio e uma maça."
- "Adicione à ficha da Thara a Espada Longa e duas poções de cura."
- "Escreva no meu diário (uma nota só minha) o que aconteceu hoje."
- "Role Percepção para a Thara, CD 15."

**Mestre**

- "Crie a cena da Eclusa com 4 goblins ocultos: uma sala de 10 por 6 células, com uma porta trancada a leste e uma
  parede curva ao sul."
- "Crie um NPC Goblin (PV 7, CA 15, ataque Cimitarra) e depois uma automação de vento que limita a visão a cada 10 minutos."
- "Escreva um handout 'A Eclusa antiga' visível para todos."
- "Liste os rascunhos e publique só a cena."
- "Desfaça o que você fez há pouco."

O Claude começa pelo `panorama` (o que existe na mesa), usa **nomes** em vez de ids e manda vários itens numa
chamada só. Se um nome for repetido ou não existir, a resposta diz o que corrigir.

## As ferramentas

| Ferramenta | Para quem | O que faz |
|---|---|---|
| `panorama` | todos | Mostra o que existe e que você vê: cenas, fichas, notas, modelos e, para o mestre, automações e rascunhos. |
| `ler` | todos | Detalhe de uma ficha, nota, cena, modelo ou (mestre) automação, pelo nome. |
| `fichas` | jogador (as dele) e mestre (todas e NPCs) | Cria e edita fichas em lote, por partes; a mesa calcula modificadores, proficiência, CA e PV. |
| `compendio` | todos | Procura magias, armas e itens por nome, classe, nível ou escola. |
| `notas` | jogador (as dele) e mestre (todas) | Cria, edita e apaga handouts em lote. |
| `objetos` | mestre | Modelos de objeto de luz, pontos (suportes e inflamáveis) e luzes fixas. |
| `cenas` | mestre | Cenas: nome, grid, chegada, cartão, luz, paredes, portas, arcos e tokens de NPC. |
| `mapa` | mestre | M2. Névoa (cobrir e revelar por retângulo, polígono, pincel ou tudo; desfazer), desenhos e textos no mapa, editar e apagar paredes, abrir, fechar e trancar portas, esquecer a memória do mapa. |
| `tokens` | todos (cada um nos seus) | M2. Mover, renomear, tamanho, camada, visão, condições, morto, vida e CA do token; pôr a ficha no mapa; restaurar um token apagado. |
| `automacoes` | mestre | Automações como grafo (AU2: `nos` e `fios` por nome; ou a forma curta gatilho + trilhas) e zonas; `acionar` (disparar, ligar, desligar), `usarBotoes`, `listar`, **`explicar`** (a frase em português de uma automação ou de todas) e **`guia`** (como as peças funcionam: nós, fios, portas lógicas E/OU/NÃO, gatilhos em OU, esperar, se e sortear, para cada, ações, prazos, sinais, limites, "nada fica preso"). Perguntaram sobre automações? Chame `guia` e `explicar` antes de responder (a linha está nas instruções do servidor). |
| `combate` | mestre (o jogador, o próprio turno) | M2. Montar a ordem de turno (tokens, fichas, avulsos), rolar iniciativa (todos, NPCs, faltam), editar, mover, próximo, anterior, passar, dar a vez, rodada, encerrar; mostrar ou esconder o painel. |
| `mesa` | mestre | M2. Configuração da mesa, iluminação e memória do mapa, pastas (criar, renomear, visibilidade, apagar, mover itens), relógio (pausar, retomar, zerar), tirar o compêndio. |
| `som` | mestre | M2, refeita no Q4. A mesa de som: configura os 16 lugares (arquivo, nome, ícone, cor, volume), toca efeito pelo nome ou pelo lugar, marca ambientes com volume e toca ou para o transporte (`transporte`: tocar ou parar; Q4b), volume geral, parar tudo, apagar um som da mesa, ambientes da cena e som de zona, pelo nome do arquivo. |
| `musica` | mestre | MU1. A música da mesa, por nome: `faixas` (etiquetar com `etiquetas`, `maisEtiquetas` e `menosEtiquetas`, dar `energia` de 1 a 5, `descricao`, `nome`, `tirar` da lista), `botoes` (criar, mudar e apagar um botão: etiquetas, `energiaMin`, `energiaMax`, `ordem` aleatória ou crescente, ícone, cor), `tocar` (um botão ou um filtro solto), `controle` (pausar, retomar, proxima, anterior, voltar ao botão que tocava antes) e `volume`; `listar` mostra a biblioteca e o que toca. As músicas entram pela mesa (o mestre importa o mp3 ou a pasta, porque a duração só o navegador sabe ler); o Claude sobe o arquivo com `arquivos` e o mestre o importa. |
| `chat` | todos | M2. Narrar, falar como uma ficha, sussurrar, emote, mostrar handout, cartão de característica ou magia, limpar o histórico. Sai "pelo Claude". |
| `rolar` | todos | Rola dados (expressão, teste ou ataque da ficha) e conjura (`conjurar`: gasta o espaço, o pacto ou o uso da inata e rola a magia); o chat marca "pelo Claude". |
| `rascunhos` | mestre | Lista, publica e descarta o que o Claude criou. |
| `arquivos` | todos (jogador: só o que é dele) | Sobe um arquivo do computador para a mesa (mapa da cena, mapa do Dungeondraft / Universal VTT, token, retrato, aparência e símbolo da ficha, imagem de handout, som, animação de chama, imagem solta na cena, compêndio), usa um arquivo que já está na mesa, lista, renomeia e apaga os assets e ajusta as imagens soltas (M1, AS1). |
| `desfazer` | todos | Lista o que o Claude fez e desfaz um lote inteiro. |

`cenas` (M2) também duplica uma cena (`duplicarDe`) e leva o grupo (`levarGrupo`); `fichas` apaga, gasta dado de vida e ajusta a mochila; `objetos` acende, passa e guarda tochas e ajusta tempo e raio dos objetos de luz.

**FG1 (luz e fogo).** `objetos` também define a chama: em `modelos[]`, `chama: { larguraM, alturaM }` (tamanho padrão no mapa, em metros) e `animacoes: { forte?, fraca?, morrendo? }` (o **nome** de um arquivo de animação já enviado, ou `"padrao"` para a animação da mesa; o estágio que você não cita fica como está); em `pontos[]`, `chama: { larguraM, alturaM }` ou `null` (o tamanho da chama de um inflamável, aceso ou não). Antes, suba a animação com `arquivos` (`uso: "animacao"`, gif, webp animado ou apng, até 4 MB). Editar um modelo muda **na hora todos os objetos dele** (mãos, mochilas, suportes e pontos), mantendo o que é de cada objeto (aceso, tempo, onde está). O jogador dá e tira equipamento de modelo nas fichas dele com `fichas.mochila` (capacidade `equipamento.dar`, ligada por padrão; o mestre pode desligá-la).

### A tabela de paridade (M2)

Cada intenção do protocolo tem entrada em `packages/shared/src/mcp/paridade.ts`: a ferramenta e o campo que a alcançam, ou o motivo de ficar de fora (`proibida`, `transporte` ou `gesto ao vivo`). O teste `paridade.test.ts` falha se aparecer uma intenção nova sem entrada, ou se a tabela apontar uma ferramenta ou campo que não existe. **Regra: intenção nova precisa de entrada na tabela.** Hoje são 130 intenções: 107 com ferramenta e 23 de fora (4 proibidas, 10 de transporte, 9 gestos ao vivo).

### A paridade campo a campo (Q16)

A tabela acima é por intenção; um campo novo **dentro** de uma intenção (um efeito de zona, um campo do token, da cena, da ficha...) podia ficar de fora sem ninguém ver. Desde o Q16, `packages/shared/src/mcp/paridadeCampos.ts` diz, para cada campo de cada intenção com ferramenta (e para os objetos de dentro: `zona.efeitos.som.volume`, `mudancas.borda`, `reacao.fazer[].raioX`...), por onde o Claude o põe (`"ferramenta:caminho na entrada"`) ou por que não precisa (`fora(...)`: id que o Claude troca por nome, valor que a sala preenche, campo antigo). O teste `paridadeCampos.test.ts` compara a tabela com o `shape` do zod de cada intenção e com a entrada de cada ferramenta.

**Regra: campo novo numa intenção precisa de caminho no MCP.** Se o teste reprovar: (1) ponha o campo na ferramenta que alcança a intenção (nomes no lugar de ids, descrição curta) e (2) registre-o em `paridadeCampos.ts`. A ficha tem uma saída geral: `fichas[].campos` grava qualquer campo pelo caminho que a tela grava (`{"caminho":"xp","valor":300}`), com a mesma validação; um campo novo da ficha pode apontar para `campos` enquanto não ganha campo próprio.

O que o Q16 fechou (auditoria de 2026-11-18, 107 intenções com ferramenta):
- **Conjurar.** `rolar` ganhou `conjurar` ({ficha, magia, nivel, pacto, ritual, vantagem}): gasta o espaço do círculo (ou o de pacto do Bruxo), ou o uso da magia inata (de cada magia ou do grupo "N/dia"), rola acerto, dano e salvaguarda, soma o dado a mais por nível acima e manda o cartão. Truque, ritual e inata não gastam espaço. Sem espaço sobrando, recusa e diz as opções. O `ataque` também passou a levar a CD, o tipo e a salvaguarda ao chat, como a tela.
- **Ficha.** `fichas[].campos` (qualquer campo: xp, inspiração, PV temporários, testes de morte, bônus de iniciativa, espaços gastos, físico, aliados, tesouro, CA com nota, símbolo...), `visaoM` (alcance de visão do token) e `vidaPorToken` e `barraDeVida` já na criação.
- **Imagens da ficha.** `arquivos` ganhou os usos `aparencia` (a imagem da aba História) e `simbolo`.
- **Token.** `tokens[].controladoPor` (quem move o token; só o mestre).
- **Som por nome.** Na zona (`efeitos.som.hash`) e na reação (`som.tocar.hash`) o arquivo agora vai pelo nome (`"vento.mp3"`) ou pelo começo do hash, como no `som`; antes pedia o hash inteiro.

O que o MU1 acrescentou (2026-11-19): a ferramenta `musica`, com todos os campos das intenções `musica.*` mapeados em `paridadeCampos.ts`. Fica de fora só `musica.adicionar` (`transporte`: a duração de cada música é lida no navegador do mestre ao importar) e o play de conferência de cada linha da biblioteca, que toca só para o mestre (é local e não vai à sala).

O que continua de fora, de propósito: papéis, permissões, exportar e importar a campanha (`proibida`); o envio de arquivo em pedaços, a caixa de entrada e o histórico paginado (`transporte`); o ping, o traço do pincel em andamento, o arrasto do token, segurar a tocha e a chamada de voz e vídeo (CH1: `chamada.entrar`, `chamada.estado`, `chamada.sair` e `chamada.chamar`, que precisam da câmera e do microfone de uma pessoa, na janela dela; CH3: `chamada.gravar` e `chamada.naoGravar`, a gravação da voz da chamada, que é gesto do mestre na janela da chamada (o áudio está no navegador dele); `chamada.sinal`, o aperto de mão entre dois navegadores, é `transporte`). A sala recusa `chamada.*` ao Claude. O que o Claude não faz por não ser um campo de intenção: `ordem` das pastas (a sala numera) e o campo antigo `modInteligencia` (a ficha o substituiu).

Não se desfazem: mensagens de chat e rolagens, combate, som (ambientes e efeitos), relógio, configuração da mesa e arquivos. O resto (cenas, tokens, paredes, desenhos e textos, névoa, fichas, notas, pastas, luz, automações) volta com o `desfazer`. O texto no mapa é feito de traços (a mesa não tem uma forma "texto"), sem acento.

Coordenadas de cena são em **células**, a partir do canto de cima à esquerda `[0, 0]`, com meias células
(`[1.5, 2]`). Um arco "de a até b passando por c" é `{"de": a, "ate": b, "por": c}`.

O que o CH3 acrescentou (2026-11-20): nenhuma ferramenta nova. **Resumir uma sessão gravada**: o mestre grava a chamada, transcreve com `pnpm transcrever` (`docs/WHISPER.md`) e traz a transcrição para uma nota só dele ("Sessão de 20/11 — transcrição", aba Mesa, "Gravações da sessão"). Peça ao Claude: "resuma a sessão de ontem". Ele lê a nota com `ler` (tipo `handout`, `completo: true`) e escreve o resumo com `notas` como rascunho de nota: o que aconteceu, NPCs, pistas e pendências. As instruções do servidor e a descrição de `notas` dizem isso. **Ligar a gravação é gesto da chamada e fica fora do MCP** (`chamada.gravar` e `chamada.naoGravar` são `gesto ao vivo`, o áudio está no navegador do mestre). Nada novo entrou no estado, então a paridade campo a campo não mudou.

## Subir arquivos (M1)

"Gere ou ache o arquivo no computador, chame `arquivos`, rode o comando que ela devolve, pronto." Exemplo de pedido: *"Gere o mapa da cripta, ponha na cena Cripta e ajuste para 45 x 45 quadrados"*.

1. O Claude gera o arquivo no computador (png, jpg, webp ou gif; som mp3, ogg ou wav; compêndio json).
2. `arquivos` com `acao: enviar`, `uso` (mapa da cena, token, retrato da ficha, imagem do handout, som, compêndio), `nome` e o alvo pelo nome (`cena`, `token`, `ficha`, `handout`). No mapa, `quadrados: 45` (ou `pxPorQuadrado`) ajusta o tamanho da cena à imagem.
3. A ferramenta devolve um **link de envio de uso único** (vale 15 minutos) e o comando pronto: `curl -sS -T "<caminho do arquivo>" "<link>"`. O Claude roda no shell e a resposta do curl já diz o que foi feito. **O token nunca passa pelo modelo**: o link é que autoriza.
4. O navegador do mestre baixa o arquivo da caixa de entrada da sala, processa pelo mesmo caminho do botão de subir (tiles, redução, cifra) e a sala aplica o uso como o Claude, no lote dele (o Desfazer tira o mapa ou a imagem; o arquivo fica na pasta). Com a mesa do mestre fechada, o arquivo espera (até 24 h) e a mesa mostra "O Claude enviou 1 arquivo" e processa sozinha ao abrir.
5. Sem shell (Claude Desktop, claude.ai): `base64` na mesma chamada, até 2 MB (gasta contexto).

**Mapa do Dungeondraft (Q3):** `uso: "dungeondraft"` (ou `uvtt`, `mapa universal vtt`) com um `.dd2vtt`, `.uvtt` ou `.df2vtt`. O navegador do mestre lê o arquivo (no worker) e cria uma **cena nova** com o nome do arquivo: o mapa na grade do arquivo, as paredes, as portas (fechadas como no arquivo) e as luzes; não leva o grupo para a cena. A resposta do curl traz o resumo ("Cena criada: 1 mapa, 142 paredes, 6 portas, 9 luzes."). Só o mestre; sem alvo nem `quadrados`; `usar` não vale para ele. O `desfazer` apaga a cena criada. Exemplo: *"Importe este .dd2vtt"*.

Outras ações: `estado` (consulta um envio, espera até 20 s), `listar` (os Assets da mesa: cada arquivo com tipo, quem enviou e onde é usado; só o mestre) e `usar` (põe na mesa um arquivo que já existe, pelo hash, sem reenviar).

**Assets da mesa e imagens soltas (AS1).** `uso: "imagem"` (png, jpg, webp ou gif, parado ou animado) põe o arquivo **solto na cena**, no ponto `x`, `y` (em quadrados; sem eles, o centro), na `camada` (`mapa`, `tokens` ou `mestre`; padrão `mapa` para o mestre) e com `larguraQuadrados` de largura (a altura segue a proporção). Vale em `enviar` e em `usar`. `ajustar` mexe numa imagem que já está na cena, pelo nome (`token`): `x`, `y`, `larguraQuadrados`, `alturaQuadrados`, `rotacao` (graus), `camada`, `oculto` e `novoNome`. `renomear` (`hash`, `novoNome`) muda o nome que a mesa mostra do arquivo. `apagar` (`hash`) tira o arquivo da mesa: se estiver em uso a mesa recusa e diz onde; com `confirmar: true` ela tira a imagem desses lugares (o arquivo continua no computador do mestre). Só o mestre lista, renomeia e apaga; o jogador com a capacidade "Pôr imagens soltas na cena" usa `enviar` e `usar` com `uso: "imagem"` nas imagens que ele vê. A mesa confere os bytes: svg, programas e arquivos que não são o que dizem são recusados. O jogador só põe imagem no que é dele (o próprio token, o retrato da própria ficha, o próprio handout); mapa, som e compêndio são do mestre.

## Desfazer e segurança

- Cada pedido do Claude é um **lote**. Em **Preferências → O que o Claude fez** (ou pela ferramenta `desfazer`)
  você desfaz um lote. O que outra pessoa mudou depois fica como está, e o aviso diz qual.
- O Claude manda no máximo 20 pedidos por segundo (o mesmo limite do token vale no HTTP); o que passar disso é recusado
  com o aviso de esperar, e a ferramenta tenta de novo sozinha algumas vezes.
- O endereço do MCP é a mesma porta da mesa e passa pelo **mesmo tratamento** da conexão do Claude: a lista de
  proibidos, a marca "pelo Claude", o rascunho do mestre, o diário do Desfazer e a difusão aos outros jogadores.
- O token nunca é escrito em log nem em resposta. Se ele for revogado (ou a sua conta sair da mesa), a próxima chamada
  recebe **401** (sem dizer o motivo) e o Claude Code pede para você gerar outro. Muitas tentativas com token errado
  bloqueiam o computador por 15 minutos (429).
- Um navegador não consegue usar este endereço: ele não aceita cookie, não responde CORS e recusa qualquer pedido com
  `Origin`.
- No servidor local (stdio), se a mesa cair, ele reconecta sozinho.

## Se algo der errado

- **"Failed to connect" no `/mcp`**: confira se o `pnpm dev` está rodando e se o endereço do comando é o da sua página.
  Se a conexão foi feita com outro token, rode `claude mcp remove --scope user tavola-<id>` e cole o comando novo.
- **"already exists" ao colar o comando**: a conexão desta mesa já existe. Rode antes a linha de "Já tinha conectado
  esta mesa?".
- **401**: o token foi revogado, está errado ou é de outra mesa. Gere outro em Preferências.
- **429 / "A sala bloqueou este computador"**: houve muitas tentativas com token errado. Espere 15 minutos.
- **Só no servidor local (Desktop)**: "Falta o TAVOLA_TOKEN" / "formato de um token" é o token mal colado; "Sem conexão com a mesa" é o `TAVOLA_URL` ou o `TAVOLA_MESA` errado.
- **A ferramenta que eu esperava não aparece**: o seu papel ou uma permissão não a libera (por exemplo, `cenas` é só do
  mestre). Se o mestre mudar uma permissão no meio da conversa, a lista de ferramentas se atualiza.
- **Os jogadores não veem o que o Claude criou para o mestre**: é o rascunho. Publique.
