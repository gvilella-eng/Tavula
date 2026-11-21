# O MCP: como o Claude conversa com a mesa

O Claude (Claude Code ou Claude Desktop) entra na mesa **como a pessoa que gerou o token**, com as permissões dela, e vê só
o que ela vê. Para o mestre isso quer dizer "monte a cena da Eclusa com 4 goblins ocultos" ou "resuma a sessão de ontem";
para o jogador, "monte o meu personagem". O protocolo que o Claude usa é o **MCP** (Model Context Protocol): o Claude pede
ferramentas (`panorama`, `cenas`, `fichas`...) e o Távola as executa como intenções comuns da sala. O servidor MCP **não
tem permissão própria nem modo administrador**: quem decide o que vale é sempre a sala.

Nenhuma IA roda no Távola. O Claude fica no computador de quem conversa com ele; o Távola só expõe uma porta de
entrada autenticada.

---

## Onde fica

Duas formas de ligar, **um só código de ferramentas**:

- **HTTP na sala (o caminho principal, lote 12-3).** `POST /api/m/<id>/mcp`. O Claude Code liga direto, de qualquer
  computador, sem o Távola baixado nem Node. Código: `apps/server/src/sala.ts` (`rotaMcp`, `conexaoDoMcp`,
  `tratarIntencao`) e o JSON-RPC puro em `packages/shared/src/mcp/jsonrpc.ts` (`tratarCorpoMcp`).
- **stdio (lote 12-2).** `apps/mcp/`: um servidor Node que o Claude Desktop sobe como processo. Existe porque o Desktop não
  liga a um servidor remoto com cabeçalho pelo arquivo de configuração. Código: `apps/mcp/src/index.ts` (entrada),
  `servidor.ts` (o SDK oficial `@modelcontextprotocol/sdk`), `sala.ts` (a conexão WebSocket), `config.ts` (variáveis de
  ambiente), `compendioLocal.ts` (o compêndio do disco). O `build.mjs` gera `apps/mcp/dist/tavola-mcp.mjs`, um arquivo só.

O núcleo comum, em `packages/shared/src/mcp/` (entrada `@tabletop/shared/mcp`):

- `servidor.ts`: `chamarFerramenta`, `definicaoDaFerramenta`, `ferramentasDaLista`, `INSTRUCOES`, `novoLote`, `redigir`.
- `ferramentas/`: uma ferramenta por arquivo. `index.ts` é a lista (`TODAS_AS_FERRAMENTAS`) e `base.ts` o que todas usam
  (`definir`, `passo`, `passoComEspera`, `Relatorio`, `cadaItem`).
- `nomes.ts` e `ferramentas/achados.ts`: achar coisas **pelo nome** (nunca por id).
- `paridade.ts` e `paridadeCampos.ts`: as duas tabelas de paridade com a tela (o assunto de uma seção abaixo).
- `fichaPorPartes.ts`: a ficha montada por partes; `compendio.ts`: `CompendioLocal`; `formato.ts`: os resumos em texto;
  `fonteDeTracos.ts`: o texto escrito no mapa com traços; `camposDoEsquema.ts`: lista os campos de um esquema zod.
- `tipos.ts`: `SalaLike` (o que as ferramentas precisam da conexão) e `ArquivosDaSala` (a caixa de entrada).
- `testes/salaSimulada.ts`: uma sala de mentira que roda as regras reais, para testar as ferramentas.

Tokens e segurança:

- `packages/shared/src/claude.ts`: formato do token, **a lista do que o Claude nunca faz** (`PROIBIDAS_AO_CLAUDE`), o
  balde de frequência, o teto de lotes.
- `apps/server/src/contas.ts`: `gerarTokenDoClaude`, `revogarTokenDoClaude`, `resolverTokenDoClaude`, `tokenDoClaudeValido`.
- `packages/shared/src/rascunhos.ts` e `desfazer.ts`: os rascunhos do mestre e o Desfazer.
- `apps/web/src/claude/`: a tela "Conectar o Claude" (`ConectarOClaude.tsx`, `textosDoClaude.ts`).

Arquivos (M1): `packages/shared/src/envios.ts` (usos, limites, formato), `apps/server/src/caixaDeEntrada.ts`,
`mcp/ferramentas/arquivos.ts` e, no navegador do mestre, `apps/web/src/caixaDoClaude.tsx`.

---

## Como funciona

### O pedido, de ponta a ponta (HTTP)

```
Claude Code                                         Sala (Durable Object)
   |  POST /api/m/<id>/mcp   Authorization: Bearer tvc_...
   |  { "method": "tools/call", "params": { "name": "cenas", "arguments": {...} } }
   v
rotaMcp:  recusa Origin  ->  resolverTokenDoClaude (hash, conta ativa, mesma vaga, bloqueio por IP)
          ->  lê o corpo (limite de tamanho)  ->  marca "Claude conectado" por 2 min
          v
tratarCorpoMcp (JSON-RPC puro)  ->  chamarFerramenta("cenas", args)
          |   confere `visivel` (papel e capacidades), valida a entrada (zod .strict())
          |   a ferramenta resolve NOMES -> ids e manda 1 ou mais intenções
          v
conexaoDoMcp.enviar(tipo, dados, lote)  ->  tratarIntencao({ ws: null, usuario, claude: true, tokenId })
          |   ESTE É O MESMO CAMINHO do WebSocket do Claude:
          |   balde de 20/s, proibidas, "pelo Claude", rascunho, diário do Desfazer, gravação, distribuição
          v
resposta em texto  ("Feito (3). - cena criada...")  <-  o evento do pedido, como o usuário o vê
```

Os métodos que o servidor HTTP entende (`jsonrpc.ts`): `initialize` (devolve a versão do protocolo pedida, se conhece; as
instruções do servidor vão aqui), `ping`, `tools/list`, `tools/call` e lotes de mensagens. Notificações respondem 202 sem
corpo. GET, DELETE e OPTIONS são 405. **Não há sessão, SSE nem notificações do servidor**: cada POST é independente
("Streamable HTTP sem estado").

### Conectar

Em **Preferências → Conectar o Claude** o usuário clica em "Gerar token" e copia **um comando só**, com o token dentro:

```
claude mcp add --transport http --scope user tavola-<id da mesa> <endereço da página>/api/m/<id>/mcp --header "Authorization: Bearer <token>"
```

O nome do servidor leva o id da mesa (duas mesas não brigam). Só aspas duplas e nada de `$`, crase ou `;`: o mesmo
comando vale no PowerShell, no cmd e no bash. O Claude Desktop usa o servidor local e **exige** o Távola baixado e o
Node, com `TAVOLA_URL`, `TAVOLA_MESA` e `TAVOLA_TOKEN` no `env` do `claude_desktop_config.json`.

### O servidor stdio

`apps/mcp` faz o mesmo trabalho por outro transporte. A diferença está em **como fala com a sala**: abre um WebSocket
(`Authorization: Bearer`), guarda o estado como o navegador faz (`reduzir`) e **reconecta sozinho** (1 s, 2 s... até 30 s).
`Sala.enviar` entrega cada pedido e espera a resposta: o evento do pedido, o `erro`, um **snapshot novo** (publicar,
descartar e criar item visível a outros respondem assim) ou, só no Desfazer, o `claude.desfeito`. Um pedido que não gera
evento para quem o fez (uma edição sem mudança real) só termina pelo prazo de 2,5 s (`TAVOLA_ESPERA_MS`); por isso as
ferramentas não mandam edição que não muda nada. Fechamento 4001 (token revogado) não reconecta. Sem configuração válida
o processo **sobe do mesmo jeito** e a ferramenta `panorama` diz o que falta ajustar: assim o Claude conta o problema à
pessoa em vez de só "falhou ao conectar".

---

## As ferramentas

São 19, sem nenhuma genérica ("mande qualquer intenção" não existe), na ordem de `TODAS_AS_FERRAMENTAS`:

| Ferramenta | Quem vê | O que faz |
|---|---|---|
| `panorama` | todos | O que existe na mesa e que **você** vê: cenas, fichas, notas, modelos e, para o mestre, automações e rascunhos. É por onde o Claude começa. |
| `ler` | todos | O detalhe de uma ficha, nota, cena, modelo ou automação, pelo nome. `completo: true` traz o texto inteiro. |
| `fichas` | quem tem ficha para editar | Cria e edita fichas em lote, **por partes** (a mesa faz as contas). `campos` grava qualquer campo da ficha. |
| `compendio` | todos | Procura magias, armas, itens, monstros e itens mágicos. |
| `notas` | quem pode criar notas | Cria, edita e apaga handouts. |
| `objetos` | `cena.editar` | Modelos de objeto de luz, pontos (suportes e inflamáveis), luzes fixas, a chama animada (FG1). |
| `cenas` | `cena.editar` | Cenas, grid, paredes, portas, arcos, luz, tokens de NPC, duplicar, **levar o grupo**. |
| `mapa` | `cena.editar` | Névoa, desenhos, textos no mapa, portas, memória do mapa. |
| `tokens` | todos (cada um nos seus) | Mover, renomear, tamanho, camada, visão, condições, vida e CA. |
| `automacoes` | `automacao.editar` | Fluxos (grafo), zonas, acionar, botões, `explicar` e `guia`. |
| `combate` | mestre; o jogador no próprio turno | Ordem de turno, iniciativa, próximo, rodada. |
| `mesa` | `mesa.configurar` | Configuração, iluminação, pastas, relógio, tirar o compêndio. |
| `som` | `som.controlar` | A mesa de som: lugares, efeito, ambientes, transporte, volume geral, zonas. |
| `musica` | `som.controlar` | A música da mesa (MU1). |
| `chat` | todos | Narrar, falar como uma ficha, sussurrar, mostrar handout, cartão de magia. Sai "pelo Claude". |
| `rolar` | todos | Rola expressão, teste ou ataque da ficha e **conjura**. |
| `rascunhos` | `mesa.configurar` | Lista, publica e descarta o que o Claude criou. |
| `arquivos` | todos (o jogador só no que é dele) | Sobe e usa arquivos (ver "A ferramenta `arquivos`"). |
| `desfazer` | todos | Lista e desfaz os lotes do Claude. |

**A lista é calculada a cada `tools/list`, pelo papel e pelas capacidades do snapshot** (`visivel(estado, eu)` de cada
ferramenta, que chama `pode`). O jogador não vê `cenas` nem `automacoes`; sem a capacidade "Criar fichas e notas próprias"
e sem ficha para editar, perde `fichas` e `notas`. Isso é só **conforto**: se o Claude chamar uma ferramenta que não é
dele, `chamarFerramenta` responde "não está liberada" sem mandar nada à sala, e a sala recusaria do mesmo jeito. No stdio, se o
papel ou uma permissão mudar no meio da conversa, o servidor avisa `tools/list_changed`; no HTTP a lista só muda na
próxima `tools/list`.

O texto que o Claude lê ao conectar (`INSTRUCOES`, em `servidor.ts`) tem o roteiro de preparar uma sessão: criar a cena,
enviar o mapa, paredes e luz, névoa, NPCs, som, handouts, combate, levar o grupo.

### Como uma ferramenta é escrita

Todas seguem o mesmo molde (`definir`, em `base.ts`): `nome`, `descricao` (o que a IA lê; **o limite de tamanho das descrições
é real**: foi por isso que a `musica` virou uma ferramenta separada da `som`), `entrada` (um esquema zod `.strict()`),
`visivel` e `executar`. Os esquemas são derivados dos do `shared` onde dá (`AtaqueSchema`, `MagiaSchema`, `FaseSchema`,
`AcaoSchema`...), e o **`.strict()` é de propósito**: um campo que não existe é erro, para a IA não achar que `"forca"` foi
aplicado. As mensagens de erro do zod saem em português (`zod/v4/locales/pt-BR.js`, só o idioma necessário: o
`z.locales` inteiro traria 260 KB de línguas para dentro do Worker).

---

## Decisões e por quê

- **O MCP mora na sala, por HTTP.** O primeiro desenho (12-2) era um processo local em stdio, que exigia o repositório
  baixado, Node e um `build`. Isso não serve a um jogador em outro computador. O 12-3 moveu o servidor para dentro da sala:
  um `POST` e um comando colado. O stdio ficou só para o Claude Desktop.
- **Uma função só trata a intenção do Claude (`tratarIntencao`).** O corpo do `webSocketMessage` virou
  `tratarIntencao(remetente, intencao)`, chamada pelo WebSocket (`ws` = o socket) e pelo HTTP (`ws: null`). **Nunca se cria
  um segundo caminho** para uma intenção do Claude: se uma ferramenta precisa de algo, chama `ctx.sala.enviar`. Assim
  as permissões, o limite de frequência, a marca "pelo Claude", o rascunho e o Desfazer são **idênticos** nos dois transportes.
- **Sem SDK no Worker.** O SDK oficial não roda no Cloudflare Worker, então o JSON-RPC mínimo é escrito à mão e conferido
  nos E2E com o cliente do SDK (`StreamableHTTPClientTransport`). As ferramentas e o JSON-RPC somam cerca de 73 KB
  minificados ao Worker.
- **O Claude não ganha poder além do usuário.** Entra como o usuário, com as capacidades dele (`pode(usuario, …)`).
  Mesmo o Claude de um mestre **não** pode mexer em papéis, permissões, nem exportar ou importar a campanha.
- **Nomes no lugar de ids, lote numa chamada só, resumo por padrão.** Os três princípios do 4.12 do `PROJETO.md`, que moldam
  todas as ferramentas (seções abaixo).
- **Criar ou editar pelo nome exato.** Se já existe item com o nome exato (sem acento nem caixa) na lista que a pessoa vê,
  edita; senão, cria. **Nunca por trecho do nome** (o trecho só vale para achar algo que já existe).
- **O mestre cria NPC por padrão**; `dono` (nomes de jogadores) cria personagem de jogador. O jogador sempre cria na pasta
  própria (a sala decide).
- **O MCP leva o grupo e conduz ao vivo (M2).** No 12-2 ele não levava o grupo, não disparava eventos nem mexia no combate
  ("só a pessoa, pela mesa"). O M2 mudou: o mestre "não precisa fazer nada além de pedir". Só o que é **gesto da tela** fica
  fora (ver "O que fica fora").
- **Texto no mapa é feito de traços.** A mesa não tem uma forma "texto", então o Claude escreve com uma fonte de traços
  (`fonteDeTracos.ts`, sem acento), sem mudar protocolo nem tela.
- **Mover token pelo Claude é `token.soltar`** (grava a posição final). `token.mover` é o arrasto em andamento, transitório.
- **O tamanho da cena não se muda pelo MCP.** Nenhuma intenção o faz sem imagem de mapa (60 × 45 m por padrão); o `quadrados`
  do `arquivos` ajusta o tamanho **ao subir a imagem**.
- **Corpo do POST de 512 KB** (413), que sobe a 4 MB só quando o texto cita `"arquivos"` (o base64 de um arquivo pequeno);
  `Content-Type` JSON obrigatório (415).

---

## Os trechos complexos

### 1. A paridade: o que é e por que existe

**O problema.** O Vilella quer que o Claude consiga fazer, preparando a sessão, **tudo o que o mestre faz na tela**
(exceto os gestos da tela). Mas o Távola cresce por lotes: a cada lote surgem intenções novas e campos novos nas intenções
que existem. Sem uma trava, uma funcionalidade nova **fica sem caminho para o Claude** sem ninguém perceber, e a promessa
"o Claude faz tudo" vai apodrecendo em silêncio.

**Como o código resolve.** Duas tabelas, vigiadas por testes:

**a) Paridade por intenção (`paridade.ts`, M2).** `PARIDADE_COM_O_MCP` é um `Record<TipoIntencao, EntradaDeParidade>`. Como o
tipo é um `Record` sobre **todos** os tipos de intenção, **uma intenção nova sem entrada nem compila**. Cada entrada diz uma
de duas coisas:

- `via("som", "transporte")`: a ferramenta e o campo (ou valor de `acao`) que alcança a intenção; ou
- `fora(categoria, motivo)`, com categoria fechada: `proibida` (segurança: papéis, permissões, exportar e importar),
  `transporte` (coisa da conexão: pedaços de arquivo, caixa de entrada, aperto de mão da chamada, histórico paginado) ou
  `gesto ao vivo` (um ping, o traço do pincel em andamento, a chamada de voz e vídeo, a gravação).

Hoje a tabela tem **149 intenções**: 122 com ferramenta e 27 de fora (4 proibidas, 12 de transporte, 11 gestos ao vivo).
O teste `paridade.test.ts` confere que (1) toda intenção tem entrada, (2) a tabela não guarda intenção que não existe mais,
(3) a ferramenta e o campo apontados **existem de fato** na entrada da ferramenta, (4) quem fica de fora tem categoria
fechada e motivo escrito, (5) o que a sala proíbe ao Claude (`PROIBIDAS_AO_CLAUDE`) está fora como `proibida` ou
`transporte`, e `proibida` é **só** isso, e (6) toda intenção declara a capacidade exigida (ou `null` de propósito).

**b) Paridade campo a campo (`paridadeCampos.ts`, Q16).** A tabela acima é por intenção, mas um campo novo **dentro** de uma
intenção (um efeito de zona, um campo do token, da ficha...) podia ficar sem caminho. Em 2026-11-18 uma auditoria de 107
intenções achou lacunas (conjurar, campos da ficha, `visaoM`, `controladoPor`, o som da zona pelo hash inteiro...) e
`paridadeCampos.ts` as fechou e passou a vigiá-las. Para cada campo de cada intenção **com** ferramenta (e para os objetos
de dentro: `zona.efeitos.som.volume`, `mudancas.borda`, `fluxo.nos[].config.acao.raioX`...), a tabela diz por onde o Claude o
põe (`"ferramenta:caminho na entrada"`, com `[]` para listas, `{}` para mapas e `.` para objetos) ou por que não precisa
(`fora(...)`, categoria `interno`: um id que o Claude troca por nome, um valor que a sala preenche, um campo antigo).

1. `camposDoEsquema.ts` percorre o esquema zod de cada intenção e lista os caminhos folha.
2. `paridadeCampos.test.ts` compara essa lista com a tabela e com a entrada de cada ferramenta.
3. Uma chave que termina em `*` vale para todo campo que começa pelo texto antes dele, e o `*` repete o resto do
   caminho no valor (`"zona.efeitos.*"` → `"automacoes:zonas[].efeitos.*"`).
4. O teste reprova quando há campo novo sem linha, linha que aponta caminho que a ferramenta não tem, ou linha de campo
   que não existe mais. A mensagem diz exatamente o que fazer.

**A regra de ouro de quem faz um lote:** **intenção nova precisa de entrada em `paridade.ts`, e campo novo numa intenção
precisa de caminho em `paridadeCampos.ts`.** Se o teste reprovar: (1) ponha o campo na ferramenta (nomes no lugar de ids,
descrição curta) e (2) registre-o na tabela. Só se for de propósito fora, use `fora(...)` e escreva o motivo. A ficha tem uma
válvula: `fichas[].campos` grava qualquer campo pelo caminho que a tela grava (`{"caminho":"xp","valor":300}`), com a mesma
validação, então um campo novo da ficha pode apontar para `campos` enquanto não ganha campo próprio.

**Frágil.** O guia das automações (`automacoes` com `guia`) também **tem de citar toda peça nova** (um teste confere). A
tabela é só **estrutural**: garante que existe um caminho, não que o caminho funciona bem; quem testa o comportamento são
`ferramentas.test.ts`, `m2.test.ts`, `q16.test.ts` e os testes por lote.

**Testes.** `paridade.test.ts`, `paridadeCampos.test.ts`, `q16.test.ts`.

### 2. Os lotes, o desfazer e os rascunhos

**O problema.** O Claude erra, ou o mestre muda de ideia. Tem de ser possível "desfazer o que o Claude fez há pouco" sem
desfazer o que **outras pessoas** fizeram depois, e o que o Claude cria para o mestre não pode aparecer aos jogadores antes
de o mestre aprovar.

**Lotes.** Cada **chamada de ferramenta** é um lote. `chamarFerramenta` não cria o lote sozinha; cada ferramenta pede
`ctx.novoLote(descricao)` (que gera `mcp-<16 hex>`) e passa o mesmo `{ loteId, lote }` em **todo** `passo(...)` daquela chamada.
O envelope da intenção leva `loteId` e uma descrição curta (até 120 caracteres), que **só a conexão do Claude honra**; em qualquer
outra, a sala os ignora. Uma chamada que faz 30 coisas é **um** lote ("criou 6 NPCs").

**O diário.** A cada intenção do Claude que mudou algo, `anotarNoDiario` (`sala.ts`) compara o estado **antes e depois, por
coleção e id** (`diffDoEstado`, `desfazer.ts`) e grava o resultado na tabela `claude_lotes`: para cada item, o `antes` e o
`depois` (`null` = foi criado ou apagado). Guarda **50 lotes por usuário**, fora da exportação. Só entram lotes que mudaram
alguma coisa (rolar e conversar não entram). Um lote com mais de ~1,5 MB de passos fica **listado, mas não se desfaz**
(`MAXIMO_DE_BYTES_DO_LOTE`): o diário guardaria uma foto enorme.

**Desfazer.** `desfazerPassos` aplica o **inverso** dos passos, do último para o primeiro. Em cada passo, primeiro apaga o
que foi criado (dos filhos para os pais), depois devolve o que foi editado ou apagado (dos pais para os filhos); a ordem das
coleções está em `COLECOES_DESFAZIVEIS` (cenas, pastas, modelos, fichas, handouts, tokens, desenhos, pontos, luzes, paredes,
zonas, fluxos). Cada item **só é revertido se ainda está como o Claude o deixou**; se outra pessoa mexeu depois, o item é
**pulado** e a resposta diz qual (`pulados`). A cena só sai se está vazia de tokens e não é a do grupo (apagá-la levaria o que
outra pessoa pôs nela); uma pasta com coisa dentro de outra pessoa fica.

**Publicar não conta como "mudou depois"** (`semRascunho` na comparação): o que o Claude criou e o mestre publicou ainda se
desfaz. A própria publicação também é um passo desfazível.

**O que o Desfazer não cobre** (assumido): chat e rolagens, combate, **som**, relógio, configuração da mesa, permissões e
arquivos. O arquivo enviado fica na pasta mesmo se o uso for desfeito.

**Rascunhos.** O que o Claude do **mestre** cria entra com `rascunho: true` (cenas, fichas e NPCs, handouts, pastas,
modelos, pontos, luzes, tokens, zonas, fluxos de automação). O jogador não recebe o item (nem em snapshot, nem em evento);
fluxo e zona em rascunho não rodam; a cena em rascunho não vira a do grupo. O mestre vê o selo "Rascunho" e o chip
"Rascunhos do Claude (N)" no topo, e **publica ou descarta** (intenções `rascunho.publicar` e `rascunho.descartar`; a
ferramenta `rascunhos` faz o mesmo). O carimbo é posto **só pela sala**, no `emitir` do `processarIntencao`
(`carimbarRascunho`): um campo `rascunho` que o cliente mande é ignorado. O que nasce **dentro** de uma cena em rascunho
(tokens, pontos, luzes, zonas) não leva a marca: publicar a cena o publica. O jogador e o mestre pela tela **nunca** criam
rascunho.

**Frágil.**

- O carimbo vive no `emitir`: **qualquer evento de criação novo** que o Claude do mestre dispare precisa estar em
  `carimbarRascunho` (e o tipo em `TIPOS_DE_RASCUNHO`, `eventosDePublicacao`, `intencaoDeDescarte` e `listarRascunhos`),
  senão o item nasce já publicado.
- Quem cria um **tipo novo de entidade** precisa decidir o rascunho (filtro em `visaoPara` e `eventoPara`) e o Desfazer
  (`COLECOES_DESFAZIVEIS` e os dois `switch` de `desfazerPassos`).
- Uma mudança de `luzes` que o **tempo** faz sozinho (o consumo da tocha) pode fazer o item contar como "mudou depois" e
  ser pulado.
- O pedido de desfazer **não leva `loteId`**: ele não é uma mudança do Claude a ser desfeita depois.

**Testes.** `packages/shared/src/claude.test.ts`, `apps/server/src/tokensClaude.test.ts`, `e2e/tests/claude-12-1.spec.ts`.

### 3. Os nomes no lugar de ids

**O problema.** A IA não deve decorar nem inventar ids; e a pessoa fala "o Goblin da cripta", não `token-a3f9`. Mas nomes se
repetem, mudam de acento e de caixa.

**Como o código resolve** (`nomes.ts`, `achar`):

1. **Ordem de busca:** o id exato (se a IA copiou um id de uma resposta anterior); o **nome igual**, sem acento nem caixa
   (`normalizarBusca`); e, se não achou, **um trecho do nome que só um item tem**.
2. **Erro que ensina.** Nome repetido: `Há 2 fichas chamadas "Goblin". Use o id: …`. Trecho que serve a vários: `"gob" serve
   para várias fichas: …. Escreva o nome inteiro.`. Nome que não existe: lista o que existe (até 12 e "e mais N"). A IA
   corrige e tenta de novo.
3. `acharExato` é a variante para **decidir entre criar e editar**: só vale o nome exato (nunca o trecho).
4. `achados.ts` tem os atalhos por tipo: `cenaPorNome` (sem nome, a cena do grupo), `fichaPorNome`, `tokenPorNome` (na cena
   pedida ou na do grupo), `somPorNome` (pelo nome do arquivo **ou** pelo começo do hash, 6+ letras), `animacaoPorNome`.
5. **Onde o nome é de outro jeito:** os lugares da mesa de som (número de 1 a 8 **ou** o nome do botão), arquivos pelo
   `hash` (`acharAsset`, 6+ letras do `listar`), rascunhos por `tipo:nome` ("ficha:Goblin") para desfazer empate.
6. Quando precisa de um id novo (criar), `novoId(prefixo)` gera `prefixo-<10 hex>`, e `nomeNumerado` faz "Goblin 2", "Goblin 3"
   para criar vários iguais.

**Frágil.** A busca por trecho é útil, mas perigosa em **criar**: por isso criar nunca a usa. Coordenadas das cenas são em
**células** a partir do canto de cima à esquerda (com meias células), e as ferramentas convertem para metros.

**Testes.** `nomes.test.ts`.

### 4. A ferramenta `arquivos`: a caixa de entrada e o link de uso único

**O problema.** O Claude gera um mapa (um PNG de 16 MB) ou acha um mp3 no computador e precisa **pô-lo na mesa**. Mas (a) o
conteúdo de um arquivo grande não pode passar pelo contexto do modelo (cada 100 KB custa dezenas de milhares de tokens),
(b) o **token** nunca deve passar pelo modelo, e (c) o arquivo é processado **no navegador do mestre** (tiles do mapa,
redução, cifra), que pode estar fechado.

**Como o código resolve.**

1. **`arquivos` com `acao: enviar`**: o Claude diz o `uso` (mapa, token, retrato, aparência, símbolo, handout, som,
   animação, imagem solta, compêndio ou `dungeondraft`), o `nome` (só para exibição) e o alvo **pelo nome** (`cena`,
   `token`, `ficha`, `handout`).
2. **Permissão antes do link.** `negarEnvio` roda `processar` sobre uma **cópia** do estado com um arquivo de mentira
   registrado: a resposta é exatamente a que a mesa daria ao aplicar. Se o jogador não pode pôr mapa, ele descobre agora, não
   depois de subir 16 MB.
3. **O link de uso único.** `criarEnvio` (na sala) gera um segredo aleatório, guarda **só o hash** dele (SHA-256) e devolve
   `<origem>/api/m/<id>/claude/envio/<segredo>`, que vale **uma vez e por 15 minutos**. A ferramenta devolve também o comando
   pronto: `curl -sS -T "<caminho do arquivo>" "<link>"`. **O token não aparece em lugar nenhum**: o link é que autoriza.
4. **`PUT` do arquivo** (`rotaDoEnvioDoClaude`). Recusa `Origin`; só o link inválido conta contra o IP; o link é gasto
   **antes** de ler o corpo (daí em diante uma recusa queima o envio e o Claude pede outro); o token que pediu precisa
   ainda valer (revogar o token mata o link); exige `Content-Length`; confere o tamanho contra o limite do uso; lê o corpo
   aos poucos, em linhas de 1 MB no SQLite; para se passar do declarado; e confere o **formato pelos primeiros bytes**
   (`detectarFormato`: `svg`, programas e arquivos que não são o que dizem são recusados). Quando recusa antes de ler, **descarta
   o corpo** (até 128 MB), senão o proxy do Vite devolve 502 em vez do motivo.
5. **A caixa de entrada** (`caixaDeEntrada.ts`, duas tabelas no SQLite): o arquivo espera até **24 h**; a caixa inteira tem
   teto de **300 MB**; cada token tem no máximo **10 envios abertos** e **20 pedidos de envio por minuto**.
6. **O navegador do mestre processa.** A sala avisa `caixa.pendentes`; `caixaDoClaude.tsx` baixa de `GET caixa/<id>` (só o
   mestre, pelo cookie dele), processa pelo **mesmo** `GerenteDeAssets` do botão de subir, copia para a pasta organizada se
   ela está liberada e manda `caixa.concluir` (ou `caixa.falhar`). Com a mesa do mestre fechada, o arquivo espera e a mesa
   processa ao abrir ("O Claude enviou 1 arquivo").
7. **A sala aplica o uso como o Claude.** Em `concluirEnvio`, a sala monta o uso (`usoDoArquivo`) e o passa por
   `tratarIntencao` **com o usuário e o token que pediram** e o `loteId` do envio. O resultado: as permissões são as da pessoa,
   o Desfazer cobre, a difusão é a de sempre. O navegador **só processa e avisa**; quem aplica é a sala.
8. **O curl responde com o resultado.** Se há mestre conectado, o `PUT` espera até 20 s o resultado e o devolve na resposta
   ("Cena criada: 1 mapa, 142 paredes..."). Se não, a ferramenta oferece `{"acao":"estado","envio":"<id>"}` para consultar.
9. **Sem shell** (Claude Desktop, claude.ai): `base64` na mesma chamada, até 2 MB. Passa por `motivoDoFormato` antes de
   entrar na caixa.

Outras ações: `listar` (os assets da mesa, só o mestre), `usar` (põe na mesa um arquivo que **já existe**, pelo hash, sem
reenviar), `renomear`, `apagar` (a mesa recusa se em uso e diz onde; `confirmar: true` tira o arquivo desses lugares) e
`ajustar` (move, estica, gira ou esconde uma imagem solta, AS1).

**Frágil.**

- **O aplicar é da sala, nunca do navegador.** Não mova isso: o Desfazer e as permissões deixariam de ser as do Claude.
- Em `concluirEnvio` a sala espera até 2 s o `asset.registrar` aparecer em `estado.assets` (dois quadros do mesmo socket
  podem se intercalar com um `await`). Se o navegador mudar a ordem, cai nessa espera.
- O MCP em stdio **não tem caixa** (o link mora na sala): `arquivos` responde que precisa do HTTP.
- A caixa mora em duas tabelas criadas por uma migração do `armazenamento.ts` (a 16, do lote M1); o esquema do banco é versionado, então mexer nela exige migração nova, nunca editar a que já rodou.
- O mesmo arquivo enviado como token e como retrato dá o mesmo hash (a mesa guarda um asset só).
- O arquivo que o Claude manda **não cria nada novo**, então não há rascunho: é uma edição do que já existe e entra no Desfazer.
  Uma exceção: `dungeondraft` cria uma **cena nova** (o `desfazer` a apaga).

**Testes.** `mcp/arquivos.test.ts`, `caixaDeEntrada.test.ts`, `e2e/tests/envio-m1.spec.ts`, `claude-12-3.spec.ts`.

### 5. O compêndio local

**O problema.** O Claude precisa conferir uma magia, uma arma ou um monstro **sem** o conteúdo dos livros estar no Távola
(não está: texto de livro nunca entra no repositório).

**Como o código resolve.**

- A classe `CompendioLocal` (`mcp/compendio.ts`) tem a busca (`buscar`, com filtros por tipo, nível, classe, escola, ND,
  raridade) e a origem. Ela é usada **nos dois transportes**, mas com dados diferentes:
  - **HTTP (a sala):** `CompendioLocal.doExemplo()`, um **exemplo do SRD embutido no Worker** (3 magias, 9 armas e 5 itens).
    O Worker não lê o disco de ninguém. A sala nem lê o compêndio da própria mesa para o MCP.
  - **stdio (o Claude Desktop):** `apps/mcp/src/compendioLocal.ts` lê os arquivos do **computador** da pessoa, juntos
    (`magias.json`, `monstros.json`, `itens.json` e `compendio.json`, os mesmos que o mestre põe na mesa). A pasta é a
    de `TAVOLA_COMPENDIO` (arquivo ou pasta), ou `compendio/` na pasta onde o servidor roda, ou, na falta, o exemplo do SRD.
    Cada arquivo passa pelo zod do compêndio; um inválido cai no exemplo e avisa em stderr.
- **O Claude não pede o arquivo à sala:** `asset.pedir` é proibido ao Claude. Por isso o compêndio do MCP e o da mesa
  podem diferir.
- Para pôr algo numa ficha, o Claude escreve o **nome** em `fichas[].compendio` (aceita o tipo na frente: "magia:Luz", para
  desfazer empate); para criar NPCs de um monstro, `fichas[].monstro`. Quem aplica é `aplicarEntradaNaFicha`, a **mesma
  função** que a tela usa ao soltar do compêndio na ficha.

**Frágil.** O compêndio completo ainda **não** é lido pelo MCP por HTTP; é a limitação mais notada de quem joga só pela rota
HTTP (ideia anotada em `docs/IDEIAS.md`). Veja `COMPENDIO.md` para gerar os arquivos com o extrator (`pnpm compendio:extrair`).

**Testes.** `apps/mcp/src/compendioLocal.test.ts`, `ferramentas.test.ts`.

### 6. A ficha por partes

**O problema.** A IA diz "anão clérigo nível 3, estes atributos, estas perícias, estas magias", mas a ficha 5e tem
dezenas de campos calculados (modificadores, proficiência, CA, PV por classe e nível, salvaguardas da primeira classe).

**Como o código resolve** (`fichaPorPartes.ts`): faz **a conta que a mesa faz**. PV médios por classe, nível e Constituição
quando ninguém dá o PV; salvaguardas da primeira classe ao criar; nomes do compêndio entram por `aplicarEntradaNaFicha`
(arma vira ataque já calculado, magia vai para a lista, item para o equipamento). A **edição manda só a diferença**
(`operacoesDeDiferenca` → `ficha.alterar`): editar uma ficha não regrava a ficha inteira. Esse é o comportamento que o
Desfazer e a paridade esperam.

**Testes.** `fichaPorPartes.test.ts`, `ferramentas.test.ts`.

### 7. O limite de frequência

O Claude manda no máximo **20 pedidos por segundo** (rajada de 40; `LIMITE_DO_CLAUDE`), um balde de fichas (`gastarFicha`) **por
token**, em memória da sala (reiniciar a sala o enche). O que passa disso recebe `muitas_mensagens`. No HTTP, a conexão
espera 1,2 s e tenta de novo até 3 vezes; no stdio, o cliente tem um balde próprio abaixo do da sala (15 por segundo) e
espera antes de mandar. `passoComEspera` (`base.ts`) é para quem manda dezenas de pedidos de uma vez (o texto no mapa, a névoa):
espera 250 ms e tenta de novo, até 8 vezes. O chat tem **o seu** limite (10 mensagens por segundo; no HTTP, por token).

---

## Os tokens, a segurança e o que fica fora do MCP

**O token.** `tvc_` + 43 caracteres base64url (32 bytes de `crypto`). Cada **conta** tem no máximo 5 por mesa. A sala guarda só o
**SHA-256** (tabela `tokens_claude`) e o token aparece **uma única vez**, na hora de gerar. Revogar (Preferências, "Revogar")
vale na hora: a próxima chamada recebe 401, e o link de envio ligado a ele morre junto.

**Quando o token vale.** `resolverTokenDoClaude`: o hash existe, a conta está **ativa** e continua ligada à **mesma vaga**
(`usuario_id`). Se a conta sai da mesa ou muda de vaga, o token para de valer. Token errado, malformado, revogado ou de conta
inativa dão **a mesma resposta** (401 `Não autenticado`, sem dizer o motivo) e cada falha entra no **mesmo bloqueio progressivo
por IP** do login (espera crescente de 1, 5, 15 e 60 minutos; `429` com `Retry-After`). Sem o cabeçalho `Authorization`, o
pedido é 401 e **não** conta como falha do IP.

**A defesa contra o navegador.** A rota **recusa qualquer `Origin`** (403), inclusive o da própria mesa: o Claude Code não manda
`Origin`, um navegador sempre manda. Não responde preflight e nunca manda `Access-Control-Allow-*`. Não há cookie, sessão nem
`Set-Cookie`. Isso impede que uma página qualquer, aberta pelo mestre, use o token de dentro do navegador. **Não "conserte"
isso para um cliente de navegador** (o MCP Inspector no navegador, por exemplo, não é suportado).

**O token nunca sai.** Não é escrito em log nem em resposta. `redigir` (em `servidor.ts`) esconde qualquer coisa com cara de
token (`tvc_…`) em todo texto devolvido, por garantia. No stdio, o stdout é do protocolo e o stderr **não pode** levar o token
(cuidado ao acrescentar `console.error`). O envio de arquivo usa um **link**, não o token, para o modelo nunca o ver.

**A presença.** O Claude não vira outra pessoa (não conta como online nem segura a mesa sem mestre); a bolinha do usuário ganha
uma marca "Claude conectado". Por HTTP não há socket aberto, então a marca vale **2 minutos depois de cada chamada**
(vencimento `claude.http` na agenda, que sobrevive à hibernação).

**"Pelo Claude".** Mensagens e rolagens criadas pela conexão do Claude levam a marca, visível a todos. A marca é decidida pela
**conexão** (o token), nunca por um campo que o cliente mande.

**O que o Claude nunca faz** (`PROIBIDAS_AO_CLAUDE`, e a sala recusa mesmo a um mestre): mudar papéis (`papel.alterar`) e
permissões (`permissao.alterar`), exportar e importar a campanha, e o vaivém de arquivos entre navegador e sala
(`asset.pedir|inventario|tenho|naoTenho`, `caixa.concluir|falhar`). Além disso, **o token nunca vale em rota HTTP** que não seja
a do MCP e a do WebSocket: contas, pedidos de entrada, redefinição de senha, chave da pasta, código de recuperação, gerar e
revogar tokens, renomear ou apagar a mesa são rotas que ele não abre.

**O que fica fora do MCP**, por natureza (categoria `gesto ao vivo` na paridade):

- **A chamada de voz e vídeo** (`chamada.*`): precisa da câmera e do microfone de uma pessoa, na janela dela. A sala recusa
  `chamada.*` ao Claude. O que o Claude faz é **ler a transcrição** de uma sessão gravada: o mestre grava, roda
  `pnpm transcrever`, traz a nota, e o Claude a lê com `ler` (tipo handout, `completo: true`) e escreve o resumo com `notas`.
  **Ligar a gravação é gesto do mestre** e fica de fora.
- O **ping** do mapa, o **arrasto** do token e o traço do pincel **em andamento** (transitórios).
- `musica.adicionar` (`transporte`): a duração de cada música só o navegador do mestre sabe ler ao importar o mp3. O Claude
  sobe o arquivo com `arquivos` e o mestre o importa; depois o Claude etiqueta e toca.
- `ponto.acenderInicio` e `ponto.acenderFim`: segurar a tocha em tempo real.
- Não há ferramenta para a **ordem das pastas** (a sala numera).

---

## Divergências encontradas ao escrever isto

Para quem for atualizar os docs: o código manda.

- `docs/MCP.md` diz "130 intenções: 107 com ferramenta e 23 de fora"; a tabela `paridade.ts` tem hoje **149** (122 + 27).
- `docs/MCP.md` e a seção "12-2" da `PASSAGEM.md` dizem que "o compêndio não tem monstros". Desde o N3a o compêndio tem monstros
  e itens mágicos (`MonstroDoCompendio`, `buscarMonstros`), a ferramenta `compendio` os procura e `fichas[].monstro` cria NPCs.
- `INSTRUCOES` (em `servidor.ts`) ainda diz, no passo 6 do roteiro, "`som` define a trilha da cena". Desde o Q4 a trilha da cena
  virou os **ambientes da cena** (`som` com `ambientesDaCena`).
- A seção "N5" do `REDESIGN.md` diz que o Claude não ganhou ferramenta de som; o M2 acrescentou `som` e o Q4 a refez.

---

## Para ir além

- `../MCP.md`: o guia de uso (conectar, exemplos de pedidos, a tabela completa de ferramentas, "Se algo der errado").
- `../PASSAGEM.md`: seções "12-1" (token, conexão, rascunhos, Desfazer), "12-2" (o servidor stdio), "12-3" (o MCP por HTTP),
  "M1" (os arquivos), "M2" (a paridade), "Q16" (a paridade campo a campo) e "AU1"/"AU2"/"AU3" (o guia das automações).
- `../REDESIGN.md`: "12-1 — como ficou", "12-2 — como ficou", "12-3 — como ficou", "M1 — como ficou", "M2 — como ficou",
  com todas as decisões e o que foi adiado.
- `../ARQUIVOS.md` e `../COMPENDIO.md`: os guias de arquivos e do compêndio.
- `../protocolo.md`: a rota HTTP do MCP, a caixa de entrada e a nota de segurança.
- `04-contas-e-seguranca.md`: contas, login e o bloqueio por IP, de onde os tokens do Claude herdam as regras.
- `09-chamada-e-som.md`: a gravação, a transcrição e a mesa de som que o Claude opera.
- `06-automacoes.md`: o grafo e o guia que o Claude lê antes de montar uma automação.
