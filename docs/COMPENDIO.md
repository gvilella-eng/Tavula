# Compêndio: como encher a mesa com os seus livros (N3b)

O Távola não traz texto de livro. O compêndio da mesa lê arquivos JSON que o mestre mantém na pasta dele. Este guia mostra como gerar esses arquivos a partir dos seus PDFs em português e carregá-los na mesa.

> **Aviso.** O conteúdo dos livros (texto de magia, de monstro, de item) fica **só na sua pasta local**. Ele nunca entra no repositório, em teste, em fixture, em doc ou em print que vá para o git. O extrator se recusa a gravar a saída dentro do repositório.

## O que o extrator lê

Pasta de livros (os nomes dos PDFs só precisam conter estes pedaços):

| Livro | Parte do nome do arquivo | Gera |
|---|---|---|
| Livro do Jogador | `livro-do-jogador` | `magias.json` |
| Manual dos Monstros | `manual-dos-monstros` | `monstros.json` |
| Guia do Mestre | `guia-do-mestre` | `itens.json` (itens mágicos) |

O PDF precisa ter texto. PDF escaneado (imagem) é avisado no relatório e pulado: o extrator não faz OCR e não usa a internet.

## Como rodar

Na raiz do repositório:

```
pnpm compendio:extrair -- --livros "C:\caminho\dos\livros" --saida "C:\caminho\do\compendio"
```

- `--saida` tem de ficar **fora** do repositório (por exemplo `Documentos\Pessoal\RPG\Compendio-Tavola`).
- Leva uns 10 segundos. Escreve `magias.json`, `monstros.json`, `itens.json` e `relatorio.md` na saída.
- Cada entrada passa pelo zod do compêndio (`packages/shared/src/compendio.ts`). A que não passar fica de fora do arquivo e vai para o relatório, com o motivo.
- Cada arquivo gerado é relido pela mesma função que a mesa usa (`lerCompendio`) antes de ser gravado.
- Cada arquivo traz o campo `creditos` ("Livro do Jogador, tradução Biblioteca Élfica, uso pessoal..."); a aba Compêndio mostra em "Créditos".

## O relatório

`relatorio.md` traz, por livro: quantas entradas leu, quantas passaram, as que falharam (com o motivo), os campos que mais ficaram vazios, observações (nomes ligados por semelhança, descrições cortadas) e uma amostra de nomes. É só contagem e nome: abra sem medo, mas não compartilhe a pasta.

## Como carregar na mesa

1. Entre como mestre e abra a aba Compêndio.
2. Clique em **Carregar arquivos do compêndio…** (no topo da aba) e escolha os três arquivos de uma vez (ou só os que quiser).
3. O aviso diz o que foi gravado em `compendio/`. As seções Magias, Monstros e Mágicos aparecem. Jogadores recebem o compêndio junto (a seção Monstros é só do mestre).

Se preferir, copie os arquivos para a pasta `compendio/` da pasta local da mesa e use **Recarregar**.

## O que cada arquivo tem

- **Magias.** Nome, nível, escola, tempo, alcance, componentes (com o material), duração, concentração, ritual, classes (das listas por classe do capítulo 11), descrição e "Em níveis superiores". O livro não traz o nome em inglês, então `nomeOriginal` fica vazio.
- **Monstros.** O bloco inteiro: tipo, tamanho, tendência, CA, PV com a fórmula, deslocamento, atributos, testes de resistência, perícias, resistências, imunidades, sentidos, idiomas, ND e XP, traços, ações, reações e ações lendárias. As ações trazem acerto, alcance, dano e tipo (dano duplo, salvaguarda, recarga e usos por dia) quando o texto permite. A Conjuração Inata e a Conjuração por espaços viram os campos estruturados (os nomes das magias seguem os do Livro do Jogador).
- **Itens mágicos.** Nome, tipo, raridade, sintonização (e por quem), descrição e, em arma com "+N de bônus", o `bonus`.

## O que o extrator não faz

- Tabelas dentro da descrição (por exemplo "d100 Efeito") entram como texto corrido, na ordem em que o PDF as entrega.
- Itens do Guia do Mestre fora do capítulo de itens mágicos (venenos, armadilhas, explosivos) não entram.
- Erros de digitação do livro ficam como estão (por exemplo "(+)" em modificador, PV com média diferente da fórmula). Os atributos usam só o valor, não o modificador.

## Onde está o código

`packages/shared/src/extrator/`: `linhas.ts` (do PDF às linhas, duas colunas e versalete), `magias.ts`, `monstros.ts`, `itens.ts` (os leitores), `livros.ts` (por livro, com o zod), `relatorio.ts`, `pdf.ts` (pdf.js no Node) e `cli.ts`. Os testes (`extrator.test.ts`) usam só trechos **inventados** que imitam o formato.
