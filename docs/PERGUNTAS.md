# Perguntas em aberto e rascunhos dos próximos lotes

Juntadas durante os Lotes 6 a 10 (2026-11-06/07) para fazer ao Vilella no fim. Os rascunhos dos Lotes 11, 13 e 14 viram o "Decidido antes de começar" de cada lote no PROJETO.md quando o lote começar.


## Já vinham de antes
- Camada mapa = imagem do mapa + objetos de cenário? (assumido)
- Pincel: jogador apaga/seleciona só os próprios desenhos? desenhar é delegável e ligado por padrão? (assumido)
- Dados rápidos: coluna = quantidade? (assumido)
- Visibilidade do item = pela pasta + editores? (assumido)
- Compêndio: JSON local (direitos do Livro do Jogador; SRD é a alternativa livre)?
- Tocha: apagada ocupa mão? qualquer jogador no alcance tira do suporte? entregar exige 1,5 m? (assumido)
- Nome do projeto.
- Névoa manual (o mestre revela áreas) × só automática?
- Ícone de eventos (7b) e o desenho das automações; MCP (12).
- Lista de ajustes de interface que ele quer fazer.
- Roteiros manuais pendentes: Lotes 3, 4, 4b, 5, 6 (+ os novos).

## Lote 6
- Visão noturna do mestre: a área que um jogador só vê com visão no escuro aparece em cor normal (como está) ou em cinza?

## Lote 7
- Onde fica o botão de pausar a mesa e o relógio da sala (assumido: fim do menu superior do mestre).
- Estágios: forte > 50%, fraca ≤ 50%, morrendo ≤ 10% da duração (assumido; configurável).
- Consumida some da mão e da coleção (assumido).
- Semente: Tocha 5e 60 min 6+6 m; Lanterna 6 h 9+9 m; Fogueira infinita.
- luz.apagar (padrão desligado) = apagar luz de ponto; a própria tocha usa tocha.acender.
- O mestre também precisa estar ao alcance para entregar a tocha? (o agente assumiu que sim; eu acho que o mestre deveria poder sempre)
- Editar um modelo (ex.: Tocha) muda as tochas já acesas? (assumido: não)
- Apagar com penalidade maior que o saldo consome a tocha (assumido).
- Sobreposição de alças e ícones de ponto quando o ponto fica colado ao token (ajuste de interface).

## Lote 8
- O mestre vê todos os sussurros? (assumido: sim)
- Chat fora da exportação da campanha? (assumido)

## Lote 9
- Ficha completa de outro personagem só com ficha.verOutras (padrão desligado)? (assumido)
- Ficha numa janela flutuante sobre o mapa (como nas mesas virtuais).

## Lote 10
- Caixas de recurso do PDF sempre para revisão (assumido). Precisa de um 2º PDF de outro jogador para o "pronto quando".

## Lote 11
- Empate de iniciativa: Destreza, depois PJ antes de NPC, depois nome (assumido).
- O jogador da vez passa o próprio turno (assumido).
- Condições no token, não no personagem (assumido).

## Lote 13
- Borracha apaga o desenho inteiro (assumido).

## Lote 14
- Compêndio distribuído como asset (o mestre tem o JSON, os jogadores recebem pelo caminho das imagens).

## Lote 8 (do agente)
- Seta para cima deve reenviar ou só trazer a mensagem de volta? (assumido: só trazer)
- Retrato de quem fala pode ser visto por quem não vê a ficha? (assumido: sim, numa mensagem pública)
- A lista de presença no topo do chat ocupa muito espaço com 8 pessoas (ajuste de interface).

## Lote 9 (do agente)
- O jogador pode repor tochas na própria ficha? (assumido: só o mestre aumenta)
- A importação da ficha deve ler também de dentro de `fichas/`? (assumido: arquivo escolhido)
- A janela da ficha deve lembrar a posição?
- Darion: conferir na ficha impressa os recursos (Flechas 9, Labareda Protetora 2/longo, Radiação do Amanhecer 1/curto) e as 3 tochas.

---

# Rascunho: Lote 11 (combate)

**Decidido antes de começar (2026-11-06; prevalece sobre os itens acima onde conflitar; "(assumido)"
entra nas perguntas do fim):**
- **Conteúdo da ordem de turno** (o painel e o mostrar/esconder já existem desde o Lote 4b):
  `{ entradas: { id, tokenId?, nome, iniciativa, valorOculto? }[], atual, rodada }`.
  - o mestre adiciona tokens (botão direito no token → "Entrar na iniciativa", ou "Adicionar
    selecionados") e entradas soltas ("Covil, 20");
  - "Rolar para todos" rola a iniciativa de cada entrada com o bônus da ficha (ou 0) pelo modelo do
    Lote 8, e o resultado vai para o chat; o jogador rola a do próprio personagem;
  - ordena da maior para a menor; **empate:** maior Destreza; empate de novo, o personagem de jogador
    antes do NPC e depois pelo nome (assumido);
  - o mestre arrasta para reordenar e edita o valor; "Próximo turno" e "Anterior"; virar a lista soma a
    rodada. **O jogador da vez pode passar o próprio turno** (assumido);
  - "Encerrar combate" limpa a lista e a rodada (com confirmação).
- **Sigilo:** entrada de token oculto ou da camada do mestre não chega aos jogadores; `valorOculto`
  mostra o nome com "?" no lugar do número. Filtro na sala, como os demais.
- **Token da vez:** um anel destacado no mapa para todos que veem o token; a lista mostra a vez em
  destaque e acompanha a rolagem.
- **Condições do 5e** (as 14 e Exaustão de 1 a 6) ficam **no token** (assumido; cada goblin tem as
  suas), com ícones pequenos na borda do token e na ficha (a ficha mostra as do token do personagem na
  cena ativa). Botão direito no token → Condições. Quem pode: o mestre e quem controla o token.
- **Concentração:** marca no token (com o nome da magia), mostrada no token e na ficha. Sem automação de
  teste de Constituição por enquanto (vira ideia para o 7b).

---

# Rascunho: Lote 13 (pincel)
**Decidido antes de começar (2026-11-06; "(assumido)" entra nas perguntas do fim):**
- **Desenho** (`Desenho`, coleção `desenhos`): `{ id, cenaId, autorId, forma: 'livre' | 'linha' |
  'retangulo' | 'circulo', pontos (em metros), cor, espessura, preenchido? }`. Traço livre simplificado
  no navegador (Douglas–Peucker) antes de enviar; até 2000 pontos por desenho.
- **Ao vivo:** enquanto desenha, o navegador manda o traço em andamento a cada ~80 ms
  (`desenho.rascunho`, só repassado, não gravado); ao soltar, `desenho.criar` grava.
- **Camada de desenho** sempre por cima do mapa e dos tokens, **visível também no escuro** (fora do
  véu). Para o mestre, aparece no menu de camadas; os jogadores só veem os desenhos.
- **Pincel** (sub-barra que já existe): voltar (desfaz o último desenho meu), selecionar (mover e apagar
  os meus; o mestre, todos), formas, cores (paleta de 8 + cor livre), espessura e borracha (apaga o
  desenho inteiro que tocar, não pedaços) (assumido).
- **Capacidade delegável nova** `desenho.criar`, ligada por padrão; apagar e mover só os próprios
  (assumido); o mestre mexe em todos e tem "Limpar todos os desenhos" (da cena) no menu de camadas, com
  confirmação.
- Exportação: os desenhos entram (versão nova).

# Rascunho: Lote 14 (compêndio)
**Decidido antes de começar (2026-11-06; "(assumido)" entra nas perguntas do fim):**
- **Formato** (`packages/shared/src/compendio.ts`, zod): `{ formato: 'tabletop-compendio', versao: 1,
  magias: { nome, nomeOriginal?, nivel, escola, tempo, alcance, componentes, duracao, concentracao,
  ritual, classes[], descricao, emNiveisSuperiores? }[] }`. Um conversor simples de outros formatos
  fica para depois.
- **Premissa das imagens:** o mestre põe `compendio/magias.json` na pasta local dele. O arquivo nunca
  fica no servidor: o navegador do mestre registra o arquivo como asset (tipo `compendio`, por hash) e
  os jogadores o recebem pelo mesmo caminho das imagens (pedaços, cache local). Sem pasta ou sem
  arquivo, a aba mostra como montar o JSON.
- **Repositório:** nenhum texto de magia com direitos autorais no repo. Um exemplo com 3 magias do SRD
  5.1 (CC-BY-4.0) em `fixtures/compendio/exemplo-srd.json` para testes.
- **Aba Compêndio:** busca por nome (sem acento e sem caixa), filtros de nível, escola, classe,
  concentração e ritual; a magia abre um cartão com a descrição completa.
- **Ações:** "Mandar para o chat" (cartão da magia no chat, "Como:" o personagem) e "Adicionar à ficha"
  (escolhe o personagem que eu edito; entra na lista de magias com a descrição).
- Monstros e armas ficam para depois.
