# Achados ao escrever esta pasta (2026-11-21)

Escrever a explicação obrigou a conferir o código contra os docs. Isto é o que apareceu. Nada aqui foi corrigido ainda: é a lista
para um lote de limpeza. Quando um item for resolvido, risque-o ou apague-o daqui.

## No código: possíveis defeitos ou armadilhas

1. **Uma caixa OU com dois gatilhos que casam com o mesmo acontecimento roda a automação duas vezes.** `executarEvento`
   (`packages/shared/src/automacoesnucleo.ts`) dispara a cadeia uma vez por gatilho que casa (`gatilhosQueCasam`). Exemplo: "tocha
   do modelo X acende" OU "tocha com a etiqueta Y acende", e acende uma tocha que é as duas coisas. O "qualquer um dispara" da
   caixa OU sugere uma vez só. Não há teste para isso.
2. **As janelas próprias não acompanham a troca de tema ao vivo.** Só a janela da chamada ouve a mudança; a ficha, a mesa de som e
   o editor de automação pegam o tema novo só ao recarregar. O `REDESIGN.md` (V9) diz que a ficha "já ouve o `storage`", mas não há
   esse ouvinte em `apps/web/src/ficha/aparencia.ts`.
3. **A instrução do MCP está velha num passo.** O roteiro em `INSTRUCOES` (`packages/shared/src/mcp/servidor.ts`), passo 6, diz
   "`som` define a trilha da cena"; desde o Q4 são os ambientes da cena (`ambientesDaCena`). O Claude lê esse texto.
4. **O alcance das portas não usa a configuração da mesa.** `alternarPortaDoJogador` usa a constante
   `ALCANCE_INTERACAO_PADRAO_M` (1,5 m); o `alcanceInteracaoM` da mesa só vale para tochas e pontos. O doc do Lote 5 diz que as
   portas usam a configuração. Falta decidir qual dos dois é o certo.
5. **`chamada.gravar` tem capacidade na tabela que ninguém consulta.** `capacidadeDaIntencao` diz `mesa.configurar`, mas
   `tratarChamada` roda antes de `processar` e confere só se é o mestre. Inofensivo, mas engana quem lê.
6. **Duas constantes `LARGURA_DO_NO`.** 210 em `packages/shared/src/fluxosGrafo.ts` (não usada) e 208 em
   `apps/web/src/automacoes/blocos.ts`. Uma armadilha para quem mexer na grade.
7. **Comentários de um desenho antigo.** O topo de `apps/web/src/caixaDoClaude.tsx` fala em "cifra se a pasta tem chave"; não
   existe pasta cifrada (a cifra que existe é a do pré-envio de cena, `cifra.ts`). O comentário de `Fontes.destinoDeCopia` ainda
   fala de `recebidos/<jogador>/`, que não é mais escrito. `PASTA_DO_TIPO` tem `cifrado: "cifrados"`, mas
   `caminhoNaPastaOrganizada` nunca devolve esse caminho. `ordemDeOrigem` (`assetsDaMesa.ts`) só é usada pelos testes.

## Nos docs: o que ficou velho

- `docs/MCP.md` e `PROJETO.md`: falam em 11 ou 12 ferramentas (hoje são 19, `TODAS_AS_FERRAMENTAS`), em 130 intenções na
  paridade (hoje 149: 122 com ferramenta e 27 de fora) e dizem que o compêndio do MCP não tem monstros (tem desde o N3a).
- `docs/REDESIGN.md`, seção N5: diz que o Claude não ganhou ferramenta de som; o M2 acrescentou `som` e o Q4 a refez.
- `docs/WHISPER.md`: descreve o `transcricao.json` como "uma linha por fala"; o arquivo é um objeto com `titulo`, `falhas` e
  `linhas`.
- `PROJETO.md` §9 e o comentário de `e2e/playwright.config.ts`: mandam rodar `--repeat-each=3`; a regra dos lotes hoje é não rodar.
- `docs/ESTADO.md`, "Fluxo de trabalho": fala em branch `lote-N`; hoje cada lote é um worktree (`worktree-agent-<id>`), juntado com
  `git merge --ff-only` na `redesign`, e a `main` acompanha.
- `docs/PASSAGEM.md`, 7b-1 e 7b-3: "dez intenções" e `botao.criar|editar|apagar`; hoje o motor trata só
  `fluxo.criar|editar|apagar|ligar|disparar`, e `botao.usar` vira `fluxo.disparar` ou `fluxo.ligar`. A seção 12-2 diz que o
  compêndio do MCP lê só `magias.json`; hoje lê a pasta `compendio/` inteira.
- `docs/PASSAGEM.md`, Lotes 5 e 6: o véu de 3.000 px (hoje é o `naoVisto` da `CamadaDeLuz`, com teto de 1.800 px) e a chave da
  memória "por usuário e cena" (hoje mesa, usuário e cena, desde o C2).
- `docs/PASSAGEM.md`, AS1: diz que a lista "Assets da mesa" é feita no navegador do mestre; para o jogador quem monta é a sala
  (`assets.listar` e `assets.lista`).
- O `fluxo.editar` só cancela as esperas e zera o relógio quando muda a estrutura (nós e fios); mudar nome, posição ou `fixado`
  não cancela. Os docs dizem só "editar o desenho cancela as esperas".
