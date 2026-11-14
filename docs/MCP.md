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
- "Crie um NPC Goblin (PV 7, CA 15, ataque Cimitarra) e depois um ciclo de vento que sopra a cada 10 minutos."
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
| `automacoes` | mestre | Ciclos, reações, zonas e botões de evento. |
| `rolar` | todos | Rola dados (expressão, teste ou ataque da ficha); o chat marca "pelo Claude". |
| `rascunhos` | mestre | Lista, publica e descarta o que o Claude criou. |
| `desfazer` | todos | Lista o que o Claude fez e desfaz um lote inteiro. |

Coordenadas de cena são em **células**, a partir do canto de cima à esquerda `[0, 0]`, com meias células
(`[1.5, 2]`). Um arco "de a até b passando por c" é `{"de": a, "ate": b, "por": c}`.

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
