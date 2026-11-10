# Redesign e branding

Começou em 2026-11-10, depois dos Lotes 10, 11, 13 e 14. Pedido do Vilella: deixar tudo "bonito, usável e
mega intuitivo". Processo escolhido: **protótipo antes do código**: levantamento de usabilidade tela a tela,
protótipo visual aprovado, depois implementação em lotes com testes.

Protótipos (página privada no claude.ai): https://claude.ai/artifact/VuLaqV3CFUN2H4fMc97QCz

## Decidido (2026-11-10)

- **Identidade: Grimório** (direção A): tons escuros quentes e latão/amarelo. É a identidade principal do
  projeto e o tema padrão.
- **Mais contraste** entre as barras fixas e o mapa: as barras (couro) bem mais claras e quentes que o fundo
  da mesa (carvão); carvão e couro não podem parecer a mesma cor.
- **Fontes:** Space Grotesk (títulos, logo, números grandes) + Inter (interface). Empacotadas no app
  (pacotes `@fontsource` pelo pnpm), **nunca** carregadas da internet em execução. Alternativas na mesma
  pegada, se precisar: Sora, Bricolage Grotesque, Manrope.
- **Barras fixas** (topo, ferramentas à esquerda, painel à direita); o mapa ocupa o meio.
- **Janelas flutuantes** (ordem de turno, ficha, painéis de luz etc.): arrastáveis para qualquer lugar pelo
  cabeçalho, com a posição **de cada usuário** (x e y por pessoa, guardados no navegador dele, nunca na
  sala); **dois cliques no cabeçalho minimizam** (vira só a barra do título) e dois cliques restauram.
- **Temas de cor**, escolhidos por cada usuário (preferência local): **Grimório** (padrão), **Escuro
  neutro** (cinzas frios e azul discreto, um escuro "comum") e **Claro**. Os temas mudam **só as cores**:
  disposição e fontes são as mesmas. O mapa da cena não muda com o tema.

## Em aberto

- **Nome do projeto.** Sugestões: Lume (favorito do Vilella até agora), Penumbra, Archote, Távola, Brasa,
  Candeia, Limiar, Fanal, Lucerna, Candela, Fagulha. O nome entra no logo, no título da aba e na tela de
  entrada.
- Levantamento de usabilidade (prints de todas as telas em `scratchpad/prints-auditoria`, gerados por
  `e2e/prints/auditoria.spec.ts`) e o plano de lotes do redesign.
- Itens de interface que vieram dos lotes: a janela da ficha lembrar a posição (resolvido pelas janelas
  flutuantes por usuário), a lista de presença ocupando espaço no chat, a dica das condições abrir por
  clique, alças de tocha sobrepostas ao ícone de ponto, seleção múltipla no mapa.
