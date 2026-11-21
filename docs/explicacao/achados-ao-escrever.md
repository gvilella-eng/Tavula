# Achados ao escrever esta pasta (2026-11-21)

Escrever a explicação obrigou a conferir o código contra os docs. Isto é o que apareceu. Os itens "Nos docs" foram corrigidos no LP2; os "No código" seguem como lista
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

Nada pendente. O lote LP2 (2026-11-21) corrigiu todos os itens desta seção.
