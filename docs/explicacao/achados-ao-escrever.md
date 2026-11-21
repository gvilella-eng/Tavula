# Achados ao escrever esta pasta (2026-11-21)

Escrever a explicação obrigou a conferir o código contra os docs. Isto é o que apareceu. Os itens do código foram corrigidos
(lote LP1, 2026-11-21); os dos docs seguem aqui. Quando um item for resolvido, apague-o daqui.

## No código: possíveis defeitos ou armadilhas

Nada pendente. O LP1 resolveu os sete itens: o OU com dois gatilhos, o tema nas janelas próprias, a instrução do MCP, o alcance da
porta, a capacidade de `chamada.gravar`, o `LARGURA_DO_NO` e os comentários e códigos mortos.


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
