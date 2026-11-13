# Usar o Claude na mesa (o servidor MCP)

O Távola tem um servidor MCP: um programa pequeno que liga o Claude (Claude Code ou Claude Desktop) à sua mesa.
Com ele, o mestre pede "monte a cena da Eclusa" e o jogador pede "monte o meu personagem".

O Claude entra na mesa **como você**. Ele tem as suas permissões e vê só o que você vê. A sala é quem decide o
que vale: o servidor MCP não tem permissão própria nem modo "administrador".

## O que cada um pode pedir

- **Mestre:** cenas (paredes, portas, arcos, NPCs), fichas e NPCs, notas, objetos de luz (modelos, pontos e luzes),
  automações (ciclos, reações, zonas e botões), rolagens e rascunhos.
  - **Tudo o que o Claude cria para o mestre entra como rascunho.** Os jogadores não veem nada até você publicar
    (chip "Rascunhos do Claude" no topo, ou pedindo ao Claude).
- **Jogador:** montar e editar as próprias fichas (até 20), as próprias notas (até 20, escolhendo quem vê) e rolar dados.
  - Os itens do personagem vão dentro da ficha ("itens e equipamento").
  - Se o mestre desligar "Criar fichas e notas próprias" em Permissões, o Claude do jogador deixa de criar (e, sem
    ficha nem nota para editar, as ferramentas `fichas` e `notas` somem da lista dele).
- **Os dois:** olhar o que existe, ler uma coisa em detalhe, procurar no compêndio e **desfazer** o que o Claude fez.

O Claude **não** muda papéis nem permissões, não mexe em contas, não importa nem exporta a campanha, não envia
imagens e não gera tokens. Isso só a pessoa faz, pela mesa.

## Passo a passo

### 1. Gerar o servidor (uma vez)

Na pasta do Távola:

```
pnpm install
pnpm --filter @tabletop/mcp build
```

Isso cria o arquivo `apps/mcp/dist/tavola-mcp.mjs`. Refaça o `build` depois de atualizar o Távola.

### 2. Gerar o seu token

1. Abra a mesa, vá em **Preferências → Conectar o Claude** e clique em **Gerar token** (o nome é opcional).
2. O token (`tvc_...`) aparece **uma vez**. Copie agora: a sala guarda só uma "impressão digital" dele.
3. Guarde-o como uma senha. Quem o tiver entra na mesa como você. Para cortar o acesso, clique em **Revogar**:
   a conexão cai na hora.

Cada pessoa gera o próprio token. Você pode ter até 5 por mesa.

### 3. Ligar no Claude Code

Logo abaixo do token, a mesa mostra o comando pronto, com o endereço da página, o id da mesa e o seu token já
colados. Ele é assim (rode na pasta do Távola, a que tem `apps/mcp`):

```
claude mcp add tavola --env TAVOLA_URL=http://127.0.0.1:5173 --env TAVOLA_MESA=<id da mesa> --env TAVOLA_TOKEN=<seu token> -- node apps/mcp/dist/tavola-mcp.mjs
```

- `TAVOLA_URL` é o endereço da página que você usa (no `pnpm dev`, `http://127.0.0.1:5173`; a sala em si fica em
  `http://127.0.0.1:8787`, e os dois servem).
- `TAVOLA_MESA` é o pedaço do endereço depois de `/m/`.
- Para usar de qualquer pasta, troque `apps/mcp/dist/tavola-mcp.mjs` pelo caminho completo do arquivo e acrescente
  `--scope user`.
- Se o comando disser que o servidor `tavola` já existe, rode antes `claude mcp remove tavola`.

Abra o Claude Code e digite `/mcp`: o servidor `tavola` deve aparecer como conectado.

### 3b. Ligar no Claude Desktop

Em **Preferências → Conectar o Claude**, abra "Claude Desktop" e copie o trecho. Cole no arquivo
`claude_desktop_config.json` (Configurações → Desenvolvedor → Editar configuração) e troque
`<pasta do Távola>/apps/mcp/dist/tavola-mcp.mjs` pelo caminho completo do arquivo. Depois reinicie o Claude Desktop.

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

### 4. O compêndio (magias, armas e itens)

O Claude procura nomes como "Bola de Fogo" e "Espada Longa" no seu compêndio, lido do seu computador (nada vem da
internet). Ele usa, nesta ordem:

1. o arquivo da variável `TAVOLA_COMPENDIO` (o caminho do seu `magias.json`);
2. `compendio/magias.json` na pasta onde o servidor roda;
3. o exemplo do SRD que vai dentro do programa (poucas entradas).

Para ter o compêndio completo, ponha `--env TAVOLA_COMPENDIO=C:/caminho/magias.json` no comando. O compêndio
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
- O Claude manda no máximo 20 pedidos por segundo; o servidor MCP fica abaixo disso sozinho.
- O token nunca é escrito em log nem em resposta. Se ele for revogado (ou a sua conta sair da mesa), o Claude
  responde "Token inválido ou revogado: gere outro em Preferências → Conectar o Claude." e não tenta de novo.
- Se a mesa cair, o servidor MCP reconecta sozinho.

## Se algo der errado

- **"Falta o TAVOLA_TOKEN" / "formato de um token"**: o token não foi colado direito. Gere outro.
- **"Sem conexão com a mesa"**: confira se o `pnpm dev` está rodando e se `TAVOLA_URL` e `TAVOLA_MESA` estão certos.
- **"A sala bloqueou este computador"**: houve muitas tentativas com token errado. Espere 15 minutos.
- **A ferramenta que eu esperava não aparece**: o seu papel ou uma permissão não a libera (por exemplo, `cenas` é só do
  mestre). Se o mestre mudar uma permissão no meio da conversa, a lista de ferramentas se atualiza.
- **Os jogadores não veem o que o Claude criou para o mestre**: é o rascunho. Publique.
