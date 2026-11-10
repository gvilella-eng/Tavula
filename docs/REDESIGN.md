# Redesign e branding

Começou em 2026-11-10, depois dos Lotes 10, 11, 13 e 14. Pedido do Vilella: deixar tudo "bonito, usável e
mega intuitivo". Processo escolhido: **protótipo antes do código**: levantamento de usabilidade tela a tela,
protótipo visual aprovado, depois implementação em lotes com testes.

Protótipos (página privada no claude.ai): https://claude.ai/artifact/VuLaqV3CFUN2H4fMc97QCz

## Decidido (2026-11-10)

- **Nome: Távola** (escolhido pelo Vilella entre Lume e Távola). Símbolo: uma mesa redonda vista de cima,
  com os lugares em volta e uma chama no centro (o "lume" fica no símbolo). Em código, pastas e endereços
  sem acento: `tavola`. Entra no logo, no título da aba e na tela de entrada.
- **Identidade: Grimório** (direção A): tons escuros quentes e latão/amarelo. É a identidade principal do
  projeto e o tema padrão.
- **Mais contraste** entre as barras fixas e o mapa: as barras (couro) bem mais claras e quentes que o fundo
  da mesa (carvão); carvão e couro não podem parecer a mesma cor.
- **Fontes:** Space Grotesk (títulos, logo, números grandes) + Inter (interface). Empacotadas no app
  (pacotes `@fontsource` pelo pnpm), **nunca** carregadas da internet em execução. Alternativas na mesma
  pegada, se precisar: Sora, Bricolage Grotesque, Manrope.
- **Barras fixas** (topo, ferramentas à esquerda, painel à direita); o mapa ocupa o meio. Topo com **48 px**
  de altura e barra de ferramentas com **52 px** de largura.
- **Painel lateral direito** é uma coluna à parte, **de cima a baixo** (o topo termina onde ele começa), com
  fundo próprio (leve degradê no alto), filete na cor de destaque do tema na borda esquerda e sombra sobre o
  mapa. **Largura ajustável por cada usuário** arrastando a borda esquerda: mínimo de 300 px (o suficiente
  para nada quebrar) e máximo de 1/4 da largura da tela; guardada no navegador de cada um.
- **Janelas flutuantes** (ordem de turno, ficha, painéis de luz etc.): arrastáveis para qualquer lugar pelo
  cabeçalho, com a posição **de cada usuário** (x e y por pessoa, guardados no navegador dele, nunca na
  sala); **dois cliques no cabeçalho minimizam** (vira só a barra do título) e dois cliques restauram.
- **Temas de cor**, escolhidos por cada usuário (preferência local): **Grimório** (padrão), **Escuro
  neutro** (cinzas frios e azul discreto, um escuro "comum") e **Claro**. Os temas mudam **só as cores**:
  disposição e fontes são as mesmas. O mapa da cena não muda com o tema.

## Em aberto

- Levantamento de usabilidade (prints de todas as telas em `scratchpad/prints-auditoria`, gerados por
  `e2e/prints/auditoria.spec.ts`) e o plano de lotes do redesign.
- Itens de interface que vieram dos lotes: a janela da ficha lembrar a posição (resolvido pelas janelas
  flutuantes por usuário), a lista de presença ocupando espaço no chat, a dica das condições abrir por
  clique, alças de tocha sobrepostas ao ícone de ponto, seleção múltipla no mapa.
