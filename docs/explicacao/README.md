# A explicação do Távola

Esta pasta explica o Távola: o que ele é, por que cada coisa foi decidida como foi e como funcionam os trechos mais
difíceis do código. Ela é o ponto de partida para entender o projeto; os outros documentos (`PROJETO.md`,
`docs/ESTADO.md`, `docs/PASSAGEM.md`...) guardam o histórico lote a lote e o detalhe de cada entrega.

Quando o texto e o código discordarem, vale o código, e o texto deve ser corrigido.

## Por onde começar

1. [01 — Visão geral](01-visao-geral.md): o que é, os princípios, a stack, o mapa do repositório, uma sessão de jogo de
   ponta a ponta e o glossário.
2. [02 — As decisões](02-decisoes.md): todas as decisões de produto e técnicas, com o porquê, onde aparecem no código e se
   ainda valem.

Depois, cada área tem o seu arquivo, com "onde fica", "como funciona", "decisões e por quê" e "os trechos complexos":

| Arquivo | O que explica |
|---|---|
| [03 — Sala e sincronização](03-sala-e-sincronizacao.md) | O servidor (Worker e Durable Object `Sala`), as intenções, o estado, o que cada pessoa recebe, desfazer, migrações, o relógio da sala |
| [04 — Contas e segurança](04-contas-e-seguranca.md) | Contas locais, login, recuperação, tokens do Claude, origem, o que já está pronto para a internet |
| [05 — Mapa, luz e visão](05-mapa-luz-e-visao.md) | PixiJS, grid e tokens, paredes e linha de visão, luz e névoa, a luz do mestre, o fogo das tochas, desempenho |
| [06 — Automações](06-automacoes.md) | O grafo, as caixas lógicas, o motor, as conversões e o "ouro", o editor e o tour |
| [07 — Arquivos e assets](07-arquivos-e-assets.md) | Imagens e sons no computador de quem tem, hash e pedaços, cifra, a pasta organizada, a caixa de entrada do Claude |
| [08 — Ficha, compêndio, dados e combate](08-ficha-compendio-dados-e-combate.md) | A ficha 5e e o NPC, a conjuração, o compêndio e a busca, a importação do PDF, rolagens, chat, ordem de turno |
| [09 — Chamada e som](09-chamada-e-som.md) | A chamada de vídeo, o desfoque, a gravação e a transcrição com o whisper.cpp, a mesa de som |
| [10 — MCP](10-mcp.md) | Como o Claude conversa com a mesa: as ferramentas, a paridade com a tela, lotes e desfazer, envio de arquivos |
| [11 — Interface, temas e janelas](11-interface-temas-e-janelas.md) | O arranjo da tela, os temas, as janelas próprias, a tela inicial, os tours, as preferências |
| [12 — Testes e fluxo de trabalho](12-testes-e-fluxo-de-trabalho.md) | Unidade e E2E, os prints, os testes "ouro" e como o projeto é desenvolvido em lotes |

E [os achados ao escrever](achados-ao-escrever.md): o que a conferência do código contra os docs encontrou (possíveis defeitos e
docs que ficaram velhos), para um lote de limpeza.

## Os outros documentos do projeto

- `PROJETO.md`: a especificação do produto e a tabela de decisões, seção por seção.
- `docs/ESTADO.md`: o diário dos lotes (o que foi entregue, como foi verificado, o próximo passo).
- `docs/PASSAGEM.md`: por lote, onde mexer e o que é frágil.
- `docs/REDESIGN.md`: como cada lote ficou, com o que foi assumido.
- `docs/protocolo.md`: as mensagens entre o navegador e a sala.
- `docs/MCP.md`, `docs/ARQUIVOS.md`, `docs/COMPENDIO.md`, `docs/WHISPER.md`: guias de uso.
- `docs/ROTEIRO-DE-TESTES.md`: o roteiro de teste manual.
- `docs/IDEIAS.md` e `docs/PERGUNTAS.md`: o que ficou para depois e o que ainda está em aberto.

## Mantendo esta pasta em dia

Todo lote que muda como algo funciona atualiza o arquivo da área aqui, além dos documentos de sempre.
