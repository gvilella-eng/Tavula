# 11 — Interface, temas e janelas

Esta parte explica como a tela do Távola é montada e por que ela é assim: o arranjo fixo (topo, barra de ferramentas,
mapa e painel da direita), os 14 temas de cor, as janelas que flutuam sobre o mapa, as janelas que viram janelas de
verdade do navegador (ficha, automação, mesa de som, eventos e chamada), a tela inicial, o tour, as preferências de cada
navegador, os atalhos, as dicas e os menus, a regra de alinhar campos e a acessibilidade que existe.

Quase tudo aqui mora em `apps/web/src`. Nada disso é regra da campanha: é a pele e o comportamento do cliente. A sala
(`apps/server`) só entra em dois pontos: a lista de quem está online e o "tour já visto" de cada conta.

## Onde fica

- **Arranjo da mesa:** `apps/web/src/Mesa.tsx` (monta tudo), `Topo.tsx`, `MenuSuperior.tsx` (só o mestre),
  `BarraDeFerramentas.tsx`, `FaixaDeCenas.tsx`, `BarraLateral.tsx` e `abas.tsx` (as abas do painel direito e o conteúdo
  da aba Preferências), `AbaMesa.tsx` e `PainelDaMesa.tsx` (aba Mesa, só do mestre).
- **Rotas e pedaços do app:** `rotas.ts`, `App.tsx`, `main.tsx`.
- **Temas:** `tema/temas.ts` (a única fonte dos tokens), `SeletorDeTema.tsx`, `index.html` (fundo antes do JavaScript),
  `styles.css` (consome as variáveis), `tema/temas.test.ts`.
- **Janelas flutuantes:** `janelas/Janela.tsx`, `janelas/geometria.ts`, `janelas/pilha.ts`, `preferencias.ts`
  (`lerJanela`/`gravarJanela`).
- **Janelas próprias do navegador:** `ficha/foraDaMesa.ts` (abrir, coordenar, lembrar a medida), as telas
  `ficha/FichaEmJanelaPropria.tsx`, `som/SomEmJanelaPropria.tsx`, `automacoes/AutomacaoEmJanelaPropria.tsx`,
  `automacoes/EventosEmJanelaPropria.tsx`, `chamada/ChamadaEmJanelaPropria.tsx`.
- **Tela inicial e mesas locais:** `TelaInicial.tsx`, `mesasLocais.ts`, `contas/EntradaDaMesa.tsx`, `IdDaMesa.tsx`.
- **Tour:** `tour/Tour.tsx`, `tour/passos.ts`, `tour/posicao.ts`, `tour/abreSozinho.ts`, `textosDoTour.ts`; o tour das
  automações em `automacoes/TourDasAutomacoes.tsx` e `automacoes/passosDoTour.ts`.
- **Preferências:** `preferencias.ts`, `dicasLigadas.ts`, `unidade.ts`, `ficha/aparencia.ts`, `rolagem/estilo.ts`,
  `som/prefsDeSom.ts`, `SecaoDePreferencias.tsx`.
- **Atalhos, dicas, menus e diálogos:** `atalhos.ts`, `ListaDeAtalhos.tsx`, `Dica.tsx`, `BotaoComDica.tsx`, `Popover.tsx`,
  `MenuDeContexto.tsx`, `useMenuPorTeclado.ts`, `useDialogo.ts`, `menuNativo.ts`.

## Como funciona

### O arranjo da tela

A tela da mesa é um CSS grid de quatro áreas (`.mesa` em `styles.css`):

```
+------+-----------------------+----------------+
| topo | topo                  | painel         |   48 px de altura
+------+-----------------------+                |
| ferr | mapa                  | painel         |   o painel vai de cima a baixo
+------+-----------------------+----------------+
 52 px      resto (minmax(0,1fr))   largura do usuário
```

O detalhe que importa: o **painel da direita começa no alto da tela** e o topo termina onde ele começa
(`grid-template-areas: "topo topo painel" / "ferr mapa painel"`). Foi decisão do Vilella no R2 ("uma coluna à parte, de cima
a baixo"). As medidas fixas são variáveis em `:root` (`--altura-topo: 48px`, `--largura-barra: 52px`,
`--largura-abas: 52px` para o painel recolhido); a largura do painel aberto chega por `--largura-painel`, posta no
elemento `.mesa` pela `Mesa`.

- **Topo** (`Topo.tsx`): marca e nome da cena do grupo à esquerda; no meio, os menus do mestre (`MenuSuperior`) e os
  botões das automações (`BotoesDaBarra`: o mestre vê os fixados, o jogador vê os que o mestre liberou); à direita o
  botão da chamada, a presença (avatares e "+N"), o selo de Rascunhos do Claude (só mestre) e a pílula do relógio/pausa
  (`EstadoDaMesa`).
- **Menu superior do mestre** (`MenuSuperior.tsx`): grupos de botões todos com o mesmo tamanho (34 px) e o mesmo espaço
  (4 px): **Cena** (cenas, camadas), **Mapa** (novo token), **Luz** (visão do mestre, iluminação), **Combate** (ordem de
  turno), **Automações** e **Ver como**. Os grupos não têm rótulo escrito. O nome do grupo vai para a dica de cada botão
  ("Luz · Visão do mestre") e para o `aria-label` do grupo (`role="group"`). O jogador não tem esse menu.
- **Barra de ferramentas à esquerda** (`BarraDeFerramentas.tsx`): selecionar, mão, régua, dados, pincel, paredes,
  zonas, névoa, conforme o papel. A sub-barra do pincel abre ao lado.
- **Área do mapa** (`.area-mapa`, `data-area-do-mapa`, `data-testid="area-do-mapa"`): o canvas PixiJS e, por portal, as
  janelas flutuantes, a faixa de cenas, a faixa da mesa de som e o zoom. Esse atributo `data-area-do-mapa` é a âncora
  de três coisas: onde as `Janela`s se penduram, onde o menu nativo do navegador é bloqueado (`menuNativo.ts`) e o limite
  em que as janelas são empurradas para dentro.
- **Painel da direita** (`BarraLateral.tsx`): uma coluna com abas de ícone e nome (`role="tablist"`/`role="tab"`).
  Abas do jogador: Chat, Fichas, Compêndio, Preferências. O mestre ganha **Mesa** por último (V1). Todas as abas ficam
  montadas e só a ativa aparece (`hidden`), para um campo com rascunho não perder o estado ao trocar de aba. O painel
  recolhe até virar uma trilha de ícones (52 px) e a borda esquerda é uma alça de arrastar (veja "Largura do painel").
  O Chat tem `cheia: true`: ocupa a altura toda, com a caixa de digitar presa no rodapé.
- **Aba Preferências e aba Mesa**: ambas são pilhas de cartões recolhíveis (`SecaoDePreferencias`, um `<details>` com um
  resumo de uma linha). Preferências (P1): Conta, Aparência, Som, No mapa, Arquivos da mesa (só jogador), Ajuda e
  arquivos, Conectar o Claude, Segurança (só com login) e Atalhos do teclado. Mesa (Q8): Esta mesa, Regras, Luz, Assets,
  Automações, Pessoas, Campanha, Diagnóstico. Só a primeira de cada aba abre por padrão.

Um pedido de fora para abrir uma aba (por exemplo "Modelos de tocha…" no menu de Luz) chega como `PedidoDeAba { n, abaId,
secaoTestid }` na `BarraLateral`: ela abre a aba, abre os `<details>` em volta do alvo e rola até a seção. O contador `n`
muda a cada pedido para o mesmo pedido poder se repetir.

### Os temas

Um tema é só um conjunto de **cores**. Disposição, fontes e medidas são iguais nos 14. A escolha é preferência do
navegador (`localStorage`, chave `tabletop:pref:tema`) e nunca vai para a sala.

1. `tema/temas.ts` tem `TEMAS_SEM_ROLAGEM`: um objeto por tema com as 44 chaves de `CHAVES_DE_TOKEN` (`fundoMesa`,
   `fundo`, `barra`, `painel`, `texto`, `acento`, `acentoForte`, `foco`, `perigo`, `sucesso`, `aviso`, `oculta`…).
2. `comRolagem` acrescenta, derivados, `rolagemPolegar` (texto suave misturado ao painel a 55%) e `rolagemTrilho` (a cor
   do campo). Foi decisão do Q7: derivar em um lugar só, em vez de escrever nos 14.
3. `aplicarTema(id)` grava cada token como variável CSS no `documentElement` (`textoSuave` vira `--texto-suave`, por
   `nomeDaVariavel`), põe `data-tema` e ajusta `color-scheme` (claro para `claro`, `elfico` e `celestial`).
4. `main.tsx` chama `aplicarTema(lerTema())` **antes** de renderizar. `styles.css` só lê `var(--...)`: não tem cor de
   tema escrita.
5. `SeletorDeTema.tsx` mostra bolinhas como as do Chrome: a metade de cima na cor viva do tema (`amostra`), embaixo o
   acento e o corpo das janelas. São rádios nativos com o mesmo `name`, então as setas andam entre elas.

Os 14 temas, na ordem do seletor: Grimório (padrão, carvão e latão), Masmorra (id `escuro`), Pergaminho (id `claro`),
Edgerunner, Vampiro, Licantropo, Taverna, Forja, Paladino, Druida, Leviatã, Arcana, Élfico, Celestial. Os três primeiros
são os discretos (`TEMAS_PADRAO`). Detalhes: o antigo "Edgerunner" cinza-azulado (id `escuro`) virou "Masmorra" no V1 e o
nome Edgerunner passou ao tema cyberpunk novo (id `edgerunner`); os ids antigos não mudaram para quem já tinha escolhido.

**O que o mapa NÃO faz:** o mapa (PixiJS) não muda com o tema. Ele é conteúdo da cena (mapa e tokens), então o
`fundoMesa` só aparece antes do canvas subir.

### Janelas flutuantes (dentro da página)

Tudo o que abre sobre o mapa usa um componente só, `janelas/Janela.tsx`: ordem de turno, ficha, painel do token, paredes,
fontes de luz, iluminação, dados rápidos, handouts, mesa de som (quando não está em janela própria) e a das automações. O
**handout é uma `Janela` flutuante**, não uma janela do navegador: `JanelaDoHandout.tsx` usa `Janela` com o id
`handout:<id>`, e `handouts.ts` guarda quais estão abertas. (O brief deste documento agrupava o handout com as janelas
próprias do navegador; no código não é.)

Comportamento (decidido no R3 e mantido):
- arrasta pelo cabeçalho (pointer events com captura) ou pelas setas com o cabeçalho em foco (8 px, Shift 40 px);
- dois cliques no cabeçalho minimizam (só a barra do título; o corpo continua montado e escondido, nada se perde);
- a última clicada fica por cima (`janelas/pilha.ts`: uma lista só, `trazerParaFrente`, `usePosicaoNaPilha`);
- vive sempre dentro da área do mapa;
- posição, tamanho e "minimizada" são de cada pessoa, em `tabletop:pref:janela:<id>`, e nunca vão para a sala;
- Esc **não** fecha janela (Esc é da seleção do mapa);
- a ficha usa a "camada alta" (`CAMADA_ALTA_DO_Z = 45`), acima dos painéis e abaixo de avisos e menus.

### Janelas próprias do navegador

O Vilella queria arrastar a ficha para outro monitor (V9). Daí vieram as janelas "fora da mesa": uma `window.open` com
`popup=yes` por ficha e, depois, pelo mesmo caminho, a **mesa de som** (Q4b), o **editor de automação** (AU1), a **mesa de
eventos** (AU2) e a **chamada** (CH1).

Cada uma tem uma rota própria em `rotas.ts`:

| Janela | Rota | Tela |
|---|---|---|
| Ficha | `/m/<id>/ficha/<fichaId>` | `FichaEmJanelaPropria` |
| Mesa de som | `/m/<id>/som` | `SomEmJanelaPropria` |
| Automação | `/m/<id>/automacao/<fluxoId>` (ou `nova`, com `?g=` e `?tour=1`) | `AutomacaoEmJanelaPropria` |
| Mesa de eventos | `/m/<id>/eventos` | `EventosEmJanelaPropria` |
| Chamada | `/m/<id>/chamada` | `ChamadaEmJanelaPropria` |

O caminho de uma abertura, com a ficha de exemplo:

1. O ícone `AppWindow` no cabeçalho da ficha chama `abrirFichaEmOutraJanela` na `Mesa`, que mede a ficha e chama
   `abrirFichaEmJanela(mesaId, fichaId, medida)` (`ficha/foraDaMesa.ts`).
2. Essa função lê a medida que a janela lembrou (`lerMedidaGuardada`, chave `tabletop:pref:janela-ficha:<mesa>:<ficha>`)
   ou usa a da ficha, e chama `window.open(caminho, nomeDaJanela(...), "popup=yes,width=…,height=…,left=…,top=…")`.
   O **nome da janela é fixo por mesa e ficha** (`tabletop-ficha-<mesa>-<ficha>`): abrir de novo reaproveita a mesma
   janela em vez de abrir outra. Se o navegador bloqueia, devolve `false` e a `Mesa` mostra
   `TEXTO_DO_POPUP_BLOQUEADO`.
3. A nova janela carrega o app inteiro, mas `App.tsx` escolhe a tela pela rota: depois da mesma entrada de usuário (o
   cookie de sessão vale), mostra só a ficha. Não há mapa, painéis, topo nem tour.
4. A tela da janela abre **a própria conexão com a sala** (`useSala`). A sala junta as conexões por usuário
   (`estaOnline` olha o `usuarioId`, não o socket), então a segunda conexão não cria presença nem estado novo. É como
   um segundo navegador do mesmo jogador que a sala já sabe tratar.
5. Editar, rolar dados (vai ao chat da mesa), conjurar: tudo isso manda as mesmas intenções da ficha na mesa. O estado
   chega pelo mesmo caminho de sempre: a sala difunde o evento a **todas** as conexões, inclusive às janelas próprias.
   Por isso as janelas "sincronizam com a mesa" sem código de sincronização: elas são só mais um cliente.

O que fica de fora da sala, e é coordenado só entre as janelas do mesmo navegador (`ficha/foraDaMesa.ts`):

- a mesa precisa saber **quais** janelas estão abertas, para tirar a ficha da pilha de janelas flutuantes, mostrar a marca
  "em outra janela" na lista de Fichas e trazer a janela para a frente ao clicar no item;
- isso vai por **Web Locks** (a janela segura um lock com o nome dela enquanto existe) e **BroadcastChannel**
  (`aberta`, `fechada`, `quais`). Veja "Os trechos complexos".

A mesa de som, a de eventos e a automação reaproveitam o mesmo mecanismo com um id no lugar do id de ficha:
`mesa-de-som`, `mesa-de-eventos`, `automacao-<id>` (ou `automacao-nova`) e `chamada`. O som continua **saindo da aba da
mesa**: a janela do som é só o controle (assumido no Q4b). O "Ouvir" da configuração toca só na janela.

O tema na janela própria: o `main.tsx` aplica o tema ao abrir e liga um ouvinte só do evento `storage` (`acompanharTemaDeOutrasJanelas`, em `tema/temas.ts`) que vale para toda página: ficha, mesa de som, editor de automação, mesa de eventos e chamada seguem uma troca de tema feita depois na mesa, sem recarregar (LP1). O evento só chega às outras janelas da mesma origem, nunca a quem gravou.

### A tela inicial e "Minhas mesas"

A rota `/` é a tela inicial; qualquer caminho que não seja `/m/...` cai nela (`lerRota`). Ela é um **cartão central de
560 px com abas** (C4, modelo B escolhido pelo Vilella): "Minhas mesas (N)", "Entrar com código" e "Criar mesa" (`role="tablist"`,
setas e Home/End andam; só a aba ativa entra na ordem do Tab; as três ficam montadas para o que foi digitado não se perder).

- **Minhas mesas** (`useMesasDoComputador`): pergunta ao servidor a lista de mesas (`listarMesasDoServidor`); o
  servidor só responde no desenvolvimento (`LISTAR_MESAS=1`) e na internet responderia 404, caso em que vale a lista que
  **este navegador** lembra (`mesasLocais.ts`, `localStorage` `tabletop:mesas`, até 30 mesas). Cruza as duas: ordena pelo
  último uso neste navegador (`ordenarMesasPorUso`), com as nunca abertas depois e a mesa legada na frente delas. A mesa
  é lembrada (`lembrarMesa`) toda vez que `RotaDaMesa` a abre.
- **Entrar com código:** aceita o id (12 letras e números, `k7m2-qx9p-4tdn`) ou o link inteiro; `normalizarIdDeMesa`
  tolera maiúsculas, espaços e o link.
- **Criar mesa em 2 passos:** (1) nome da mesa e conta do mestre (login, nome, senha); a senha nunca sai do
  navegador (o servidor recebe a derivada); (2) pasta da mesa (opcional, só Chrome e Edge). Ao criar, aparecem o id
  grande, o código de recuperação e "Abrir a mesa".
- A página não rola em 1600×900 nem em 1280×720 (um E2E mede). O cartão tem altura fixa (520 px; 440 px em telas baixas)
  e rola por dentro só se precisar.

A entrada da mesa (`contas/EntradaDaMesa.tsx`) é o próximo degrau: com a mesa encontrada e sem sessão, mostra entrar,
pedir para entrar, "esqueci a senha" e (na mesa legada) criar a conta do mestre. Com `MODO=teste` aparece abaixo uma
lista de "usuários de teste" soltos (é o que os E2E clicam: `entrar-<usuario>`).

### O tour do mestre e o do jogador

O tour é um **diálogo modal feito à mão** (`tour/Tour.tsx`, sem biblioteca): a tela escurece com um buraco no alvo do passo,
contornado no acento, e um cartão curto fica perto dele com título, texto, Voltar, Próximo n/N e Pular.

- **Passos** (`tour/passos.ts`): cada passo aponta para o `data-testid` de um elemento da tela e, se ele mora numa aba
  do painel direito, diz qual aba abrir antes. Mestre: 10 passos (bem-vindo e o id da mesa, cenas, novo token, ferramentas,
  paredes, luz e visão do mestre, fichas, compêndio, chat e dados, pedidos de entrada e contas). Jogador: 6 passos
  (bem-vindo sem alvo, o mapa e o seu token, a sua ficha, chat e dados, régua, preferências).
- **Textos** (`textosDoTour.ts`): moram à parte, por `data-testid` do controle. Foi onde foram parar as explicações
  que o V3b tirou das dicas (que viraram uma linha só). O tour passa a ser o lugar de explicar o que cada botão faz.
- **Quando abre sozinho** (`tour/abreSozinho.ts`): no primeiro acesso de uma **conta** a uma mesa. O "já viu" é do
  **servidor**: coluna `contas.tour_visto` (migração aditiva), devolvida em `GET eu` como `tourVisto`, gravada por
  `POST conta/tour-visto` ao fechar o tour (concluir, Pular ou Esc). Por isso vale em qualquer navegador da mesma conta.
  Com `MODO=teste` ele não abre sozinho, para não atrapalhar os E2E antigos; os testes do tour ligam
  `tabletop:pref:tourNoTeste`. "Fazer o tour de novo" (Preferências, Ajuda) abre para qualquer um.
- **O tour das automações** é outro, só local: `tabletop:pref:tourDasAutomacoes` no navegador (nunca vai à sala). Abre
  sozinho na primeira vez que alguém com conta abre o centro de automações, e por "Conhecer as automações". Tem passos
  de "informar" e de "fazer" (a pessoa monta "as tochas têm 30% de chance de apagar a cada 3 minutos", com seta e botão
  "Fazer este passo por mim"). Ver `12-testes-e-fluxo-de-trabalho.md` para como ele é vigiado.

### Preferências: no navegador ou no servidor

Regra do Vilella desde o R1: **preferência pessoal fica em `localStorage`, com a chave `tabletop:pref:...`, sempre em
`try/catch`, e nunca manda frame para a sala.** O `localStorage` pode estar bloqueado (aba privada, política do
navegador); o app tem de funcionar sem ele, só sem lembrar.

No navegador (cada uma tem o ler/gravar ao lado de quem a usa):

| Chave | O que guarda | Onde |
|---|---|---|
| `tema` | o id do tema | `tema/temas.ts` |
| `larguraDoPainel` | largura do painel direito (300 px até 1/4 da janela) | `preferencias.ts` |
| `janela:<id>` | x, y, largura, altura e minimizada de cada janela flutuante | `preferencias.ts`, `Janela.tsx` |
| `janela-ficha:<mesa>:<id>` | medida e posição de cada janela própria | `ficha/foraDaMesa.ts` |
| `encaixe`, `reguaGrudar` | encaixe no grid e régua grudada | `preferencias.ts` |
| `unidade` | metros ou pés | `unidade.ts` |
| `dicas` | "Dicas ao passar o mouse" | `dicasLigadas.ts` |
| `secoes` | cartões abertos/fechados das abas Preferências e Mesa | `preferencias.ts` |
| `compendio-blocos`, `itensRecolhidos` | blocos abertos do compêndio, itens recolhidos da ficha | `preferencias.ts` |
| `aparenciaFicha`, `estiloDasRolagens` | pele da ficha (Livro/Clássica) e estilo do cartão de rolagem | `ficha/aparencia.ts`, `rolagem/estilo.ts` |
| `som`, `som-modo`, `som-aba`, `som-faixa-*` | volumes locais e posição da mesa de som | `som/*` |
| `eventos-modo`, `eventos-recolhida` | a mesa de eventos como janela ou faixa | `automacoes/eventosDaMesa.ts` |
| `seguir:<...>`, `chamada:<...>` | seguir meu token; ajustes da chamada | `seguirToken.ts`, `chamada/puras.ts` |
| `tourDasAutomacoes` (e `...NoTeste`, `tourNoTeste`) | tours já vistos / ligar o tour nos testes | `automacoes/passosDoTour.ts`, `tour/abreSozinho.ts` |

Fora desse padrão, também no navegador: `tabletop:mesas` (a lista de mesas) e a **memória do mapa** (o que cada pessoa já
explorou, no IndexedDB, por usuário e cena; `mapa/memoriaLocal.ts`).

No servidor, "preferência pessoal" não existe. O que a sala guarda **por conta** é pouco: o login, a senha derivada, a
vaga, e o `tour_visto`. As coisas que afetam todos (regras da mesa, "tempo para os jogadores", permissões) são
configuração da **mesa**, não preferência de ninguém, e moram no estado.

Os hooks de preferência que mudam ao vivo (`dicas`, `unidade`, `aparenciaFicha`, `estiloDasRolagens`) são um padrão
pequeno: um valor em módulo, um conjunto de ouvintes e `useSyncExternalStore`. Mudar na aba Preferências redesenha
na hora tudo que usa o hook, sem frame e sem prop descendo por árvore.

### Atalhos, menus de contexto, dicas e popovers

- **Atalhos** (`atalhos.ts`): uma tabela única `ATALHOS` (descrição, grupo, teclas). As dicas dos botões (`<kbd>`) e a
  lista "Atalhos do teclado" da aba Preferências nascem dela; atalho novo entra na tabela e aparece nos dois lugares.
  A tabela só tem o que **existe no código**. `atalhos.test.ts` confere que os grupos cobrem a tabela sem repetir.
  Preferências mostra "Os mais usados" (Ferramentas e Mapa) abertos e os outros grupos recolhidos (V14).
- **Dicas** (`Dica.tsx`, `BotaoComDica.tsx`): veja o trecho complexo. Resumo: só em botão sem nome à vista, uma linha
  ("Nome · atalho" ou "Nome — motivo"), 700 ms parado no mouse, na hora no foco do teclado.
- **Menu de contexto** (`MenuDeContexto.tsx`): abre no ponto do clique ou junto do item em foco (Shift+F10 ou a tecla de
  menu), se prende dentro da janela, anda com setas/Home/End (`useMenuPorTeclado`), fecha com Esc ou clique fora e o foco
  volta a quem o tinha. Serve à aba Fichas (item, pasta, handout) e aos menus da ficha (`ficha/menuDeEspaco.tsx`, o
  modificador extra). A faixa de cenas tem um menu parecido, próprio (`FaixaDeCenas.tsx`, com os mesmos testids
  `menu-cena-*`). O menu do token (`MenuDoToken.tsx`) segue a mesma ideia com layout próprio e reusa
  `useMenuPorTeclado` (as ações da tocha estão nele).
- **Menu nativo do navegador** (`menuNativo.ts`): `menuNativoDeveSumir` impede o menu do navegador no clique direito da
  área do mapa; campos de texto e janelas flutuantes mantêm (precisam de copiar/colar).
- **Popover** (`Popover.tsx`): painel flutuante simples com `role="dialog"`; `useFecharFora` fecha com clique fora e Esc,
  mas ignora cliques em `[data-popover-gatilho]` para o botão que abriu poder alternar.
- **Diálogos modais** (`useDialogo.ts`): veja o trecho complexo.

### A regra de alinhar campos lado a lado (A1)

O Vilella pediu: dois campos lado a lado têm as caixas na mesma altura mesmo se um rótulo quebra em duas linhas. A solução
é só CSS (A1, 2026-11-19), em `styles.css`:

`.linha-par`, `.linha-da-fase` e `.inicio-grade-de-campos` são grades de **duas colunas**; cada campo filho vira um
**subgrid de três trilhas** (`grid-row: span 3; grid-template-rows: subgrid`): rótulo, caixa, ajuda. Como as duas
colunas compartilham as mesmas três linhas, o rótulo mais alto define a altura da linha dos rótulos, as caixas começam
juntas e as ajudas começam juntas. Dentro do par a caixa ocupa a largura da coluna (`min-width: 0`), então nada
transborda em painel estreito. A ficha (`fl-*`) ficou de fora de propósito: suas linhas são faixas de controles
diferentes, não pares rótulo/caixa/ajuda. Teste: `e2e/tests/a1.spec.ts` aperta o pai do par até um rótulo quebrar e
confere que o topo e a altura das caixas diferem no máximo 1 px. A regra vale para todo lote novo: conferir nos prints.

### A acessibilidade que existe

O que o código faz de fato (não há teste com leitor de tela real; o que existe é marcação e comportamento de teclado):

- **Contraste AA (4,5:1)** em todo par de texto e fundo de cada um dos 14 temas, e **3:1** do anel de foco contra toda
  superfície (`temas.test.ts`); o texto das iniciais sobre a cor de um usuário é preto ou branco, o que contrastar mais
  (`contrasteDeCor.ts`).
- **Anel de foco único** (`--foco`, `:focus-visible`, 2 px) em todo controle; o mapa só o mostra se o foco chegou pelo
  teclado (`data-foco-teclado`).
- **Tudo com mouse tem caminho no teclado**: menu do token (Shift+F10), andar o token com setas, alça de largura do painel
  (`role="separator"` com `aria-valuenow` e setas), cabeçalho de janela (setas), tour (→/Enter/←/Esc), tela inicial
  (abas com setas).
- **Papéis ARIA**: `tablist`/`tab` nas abas do painel e da tela inicial, `dialog` nas janelas e popovers, `menu`/`menuitem`
  nos menus, `tooltip` + `aria-describedby` + `aria-keyshortcuts` nas dicas, `aria-expanded` nos cartões, `aria-live` no
  tour, `role="application"` no mapa e um `<span class="so-leitor">` com o estado da conexão.
- **`prefers-reduced-motion`**: as transições de 140 ms (janelas, menus, popovers, dicas, troca de aba) e o pulso do
  indicador de aba não rodam com a preferência ligada. Os E2E rodam com `reducedMotion: "reduce"`.
- **Foco preso e devolvido** em modais (`useDialogo`) e no tour; menus devolvem o foco.

O que **não** existe: toque (celular) nunca foi testado; só o Chrome foi usado; telas menores que 1280×720 não foram
vistas; daltonismo não foi avaliado (só o contraste foi medido).

## Decisões e por quê

- **Barras fixas em volta do mapa, painel de cima a baixo** (R2): pedido do Vilella; o mapa ocupa o meio e nada flutua
  sobre as barras. Outras mesas virtuais são a referência de "painéis estreitos e enxutos".
- **Largura do painel por usuário**, mínimo 300 px e máximo 1/4 da tela (`limitesDoPainel`): 300 px é o suficiente para
  nada quebrar; o máximo evita o painel comer o mapa. Ao estreitar a janela do navegador o painel nunca passa de 1/4 (o
  valor escolhido é guardado intacto; o usado é ajustado: `ajustarLarguraDoPainel`).
- **Temas só de cor, tokens numa fonte única**: antes do R1 havia ~45 cores escritas à mão no CSS. Foram descartados
  temas que mexessem em disposição ou fonte, para o Vilella nunca precisar reaprender a tela ao trocar de tema.
- **De 3 para 11 e depois 14 temas** (R2b e V1): pedido do Vilella, com nomes de RPG e seletor de bolinhas como o do
  Chrome. Cada tema novo tem de passar AA e o teste de "acento distinto": os de personalidade nunca usam o dourado do
  Grimório.
- **Janela flutuante por pessoa, não por mesa** (R3): posição e tamanho são preferência do navegador, nunca estado da
  sala, para dois mestres ou dois monitores não brigarem pelo layout.
- **Janela própria do navegador em vez de "destacar" um painel** (V9): o navegador não tem API para arrastar um painel
  para outro monitor; `window.open` com `popup=yes` é o único jeito. O custo é que cada janela tem a **sua conexão com a
  sala**, e o arrasto entre janelas (compêndio para a ficha fora, ficha fora para o mapa) não existe.
- **Dica enxuta** (V3b): o Vilella disse "TUDO está com o tooltip ao passar o mouse, tá um saco". Foi descartado o R6a
  (dica em todo botão, com atalho e explicação em duas linhas). Hoje só botão sem nome à vista tem dica, de uma linha,
  com atraso. A explicação mudou para o tour.
- **Tour feito à mão** (T): sem biblioteca, para o véu, o buraco e o cartão se comportarem como diálogo modal acessível
  (foco preso, teclas que não vazam para o app) e para o alvo ser achado por `data-testid`.
- **"Já viu o tour" no servidor** (T): o Vilella jogaria em mais de um navegador; guardar no `localStorage` repetiria o tour.
  Descartado também gravar no estado da mesa: é dado da conta, não da campanha.
- **Pedaços do app baixados à parte** (`App.tsx`): a tela inicial não carrega o PixiJS nem a Mesa (~1 MB). Veja abaixo.
- **Handouts como janela flutuante, não do navegador** (V3): um handout é para ler junto do mapa; a janela do navegador
  só entrou onde a pessoa pede mais espaço (ficha, som, automação, eventos, chamada).

## Os trechos complexos

### 1. Rotas sem biblioteca e o "pedaço" que não usa `lazy`

**Problema.** O app tem cinco telas pesadas diferentes (mesa, ficha, som, automação, chamada) e a tela inicial leve. Baixar
tudo junto atrasaria a tela inicial; usar `React.lazy` com `Suspense` atrasava a mesa em ~0,8 s, porque o React segura por
uns décimos de segundo a troca do conteúdo suspenso, e a mesa tinha dois pedaços por entrada.

**Como o código resolve.** `rotas.ts` é um roteador mínimo: `lerRota(pathname)` casa uma expressão regular e devolve um
`Rota` (`inicio` ou `mesa` com `fichaId`, `painel` ou `automacaoId`); `irPara` usa `history.pushState` e dispara um evento
próprio; `useRota` escuta esse evento e o `popstate`. Em `App.tsx`, `pedaco(() => import(...))` guarda a promessa e o
módulo quando chega. `useModulo` devolve o módulo **já no primeiro render** se ele chegou antes, ou `null` até chegar.
`adiantarRota(lerRota(location.pathname))` roda na avaliação do módulo, antes do primeiro render: o pedaço da rota
baixa junto com as fontes que o `main.tsx` espera (com teto de 1,5 s). Ao trocar de rota sem recarregar, o `useEffect`
do `App` adianta o pedaço da nova rota.

**Frágil.** Rota nova precisa entrar na expressão de `lerRota`, em `adiantarRota`, em `MesaEncontrada` e na `key` do
`RotaDaMesa` (que reinicia a tela ao trocar de ficha, painel ou automação). `rotas.test.ts` cobre `lerRota`. O título da aba
(`tituloDaMesa`) é do `RotaDaMesa` e não vale para as janelas próprias (que põem o próprio).

### 2. Os tokens do tema e o fundo antes do JavaScript

**Problema.** Trocar de tema não pode piscar a cor errada ao abrir a página, e 14 temas com 44 chaves não podem
divergir nem esquecer uma chave.

**Como o código resolve.**
- O tipo `Tema = Record<ChaveDeToken, string>` e `TEMAS_SEM_ROLAGEM: Record<IdDoTema, ...>` fazem o TypeScript recusar um
  tema sem alguma chave.
- Em `index.html`, um `<style>` define `html[data-tema="..."] { background: ... }` para os 14 (as cores de `fundo`), e um
  `<script>` curto lê `tabletop:pref:tema` do `localStorage` (com `try/catch`) e põe `data-tema` no `<html>` **antes de
  qualquer módulo**. A página já nasce da cor certa; depois o `aplicarTema` do `main.tsx` põe todos os tokens.
- As 14 cores de `index.html` são **duplicadas de propósito**; o teste `o index.html pinta o fundo certo antes do JS carregar`
  lê o HTML e as compara com `TEMAS`.
- `temas.test.ts` confere, para cada tema: as mesmas chaves, AA em todos os pares de texto e fundo, foco 3:1 contra todas as
  superfícies, polegar da rolagem distinto do trilho e do painel, degradê do painel (nos escuros) seguindo os
  coeficientes aprovados sobre a barra, verde do crítico e vermelho da falha crítica iguais nos 14, e nomes únicos.

**Frágil.** Token novo precisa entrar em `CHAVES_DE_TOKEN`, nos 14 temas e no teste (quando tem par de texto). Tema novo
precisa entrar também na lista do `index.html` (cores e a lista de ids válidos do script). Não se escreve cor de tema no
`styles.css`: só `var(--token)`. As exceções são cores de conteúdo (iniciais sobre a cor do usuário, o desenho do mapa).

### 3. Saber quais janelas próprias estão abertas (Web Locks + BroadcastChannel)

**Problema.** A janela principal precisa saber quais fichas (e som, eventos…) estão em outra janela para não duplicá-las
e para marcá-las na lista. Mas a janela do navegador pode morrer sem avisar (fecha o computador, trava, o usuário
fecha a aba pelo gerenciador). E tudo isso não pode passar pela sala (a sala não deve saber de janelas).

**Como o código resolve** (`ficha/foraDaMesa.ts`), por duas vias que se complementam:
1. **BroadcastChannel por mesa** (`tabletop:fichas-fora:<mesa>`). A janela filha avisa `{t:"aberta", fichaId}` e
   `{t:"fechada", fichaId}`; a principal, ao montar, pergunta `{t:"quais"}` e as filhas respondem de novo.
2. **Web Locks.** A filha segura um lock com o nome `tabletop:ficha-fora:<mesa>:<ficha>` enquanto existe
   (`navigator.locks.request`, que só termina quando a promessa devolvida resolver). O navegador **solta o lock até quando a
   janela morre sem avisar**. A principal confere `navigator.locks.query()` a cada 1 s (`CONFERIR_A_CADA_MS`) e a lista
   "pelos locks" manda sobre a "pelos avisos": uma janela morta some da lista sozinha.
3. **Período de graça** (`GRACA_MS = 6 s`): quando a principal chama `window.open`, a ficha já conta como "fora" por 6 s,
   até a janela filha avisar que abriu (carregar o app leva tempo); sem isso a ficha apareceria na tela da mesa e sumiria.
4. Sem Web Locks (endereço sem HTTPS), vale só o aviso do canal.

A lista é um repositório único em módulo (`fora`, com ouvintes) lido por `useFichasFora` (`useSyncExternalStore`):
`definir` só notifica se o conjunto realmente mudou. A principal usa a lista para: tirar a ficha da pilha de janelas
(`Mesa` não monta a `JanelaDaFicha` de quem está fora), marcar o item "em outra janela" e decidir se um clique no item
**traz a janela para a frente** (`trazerFichaDeFora`, que faz `window.open("", nome)` para referenciar a janela pelo nome
e, se ela estiver em branco, a considera morta e abre a ficha na mesa mesmo).

**Detalhe de abrir sem recarregar.** Para a automação e a chamada, abrir de novo **não** pode recarregar a janela: recarregar
perderia o que não foi salvo (automação) ou derrubaria a chamada. Por isso `abrirAutomacaoEmJanela` e `abrirChamadaEmJanela`
fazem `window.open("", nome, ...)` (sem endereço) e só mandam a janela para o caminho real se ela for **nova**
(`janela.location.href === "about:blank"`). Se a janela já existe, ela só vem para a frente. O acesso a `location.href` de uma
janela de outra origem lança exceção, e o `try/catch` trata isso como "já tem conteúdo".

**A janela lembra a medida** só se foi aberta pela mesa: compara `window.name` com `nomeDaJanela(mesa, id)`, a cada 1 s e no
`pagehide`, e grava largura, altura, `screenX` e `screenY`. Uma aba comum aberta pelo endereço não grava. O navegador decide
se respeita `left`/`top` (monitor desligado, por exemplo).

**Frágil.** O nome da janela tem que ser estável (mudá-lo abriria duplicatas). `anunciarFichaFora` só responde `quais` depois
de segurar o lock, senão a principal contaria uma janela que ainda não está protegida. Testes: `e2e/tests/ficha-v9.spec.ts`
(abrir, editar, voltar, recarregar a principal com a janela aberta, pop-up bloqueado, rota direta), `som-q4b.spec.ts`,
`au1.spec.ts`, `au2.spec.ts`, `chamada.spec.ts`. Não há teste de unidade: depende do navegador.

### 4. A janela flutuante que nunca some e nunca perde o lugar

**Problema.** O mapa muda de tamanho (janela do navegador, painel direito arrastado, recolhido). A janela não pode ficar fora
da área, mas se a área volta a crescer ela deve voltar ao lugar que a pessoa escolheu.

**Como o código resolve** (`janelas/Janela.tsx`, `janelas/geometria.ts`):
1. A preferência (`x`, `y`, `largura`, `altura`) é guardada **intacta**. `limitarNaArea(escolha, tam, area)` calcula a posição
   mostrada empurrando para dentro, mexendo o mínimo; é função pura, sem estado.
2. Um `ResizeObserver` observa a área do mapa e a própria janela e atualiza `area` e `medida`. Até medir, a janela fica com
   `visibility: hidden` para não pular.
3. Ao arrastar, `seguir` grava a posição já limitada no estado local; só ao soltar `gravarJanela` vai ao `localStorage`.
4. Ao redimensionar, "a posição de hoje passa a ser a escolhida" (`x: g.x0, y: g.y0`): sem isso uma janela presa ao canto
   andaria ao ser redimensionada.
5. O padrão (enquanto a pessoa não mexe) é uma função da área e do tamanho da janela (`Padrao`), por exemplo
   `noCanto("topo-direita")` para a ordem de turno. Numa **área apertada** (altura menor que 900 px,
   `ALTURA_APERTADA`) o painel do token vai para a coluna da direita, embaixo da ordem de turno (R6b), para que ficha, ordem
   e painel do token não se cubram em 1280×720.
6. A pilha de empilhamento (`pilha.ts`) é uma lista de ids; `z-index = BASE_DO_Z (25) + posição` (ou 45 + posição, na
   camada alta). Fica abaixo dos menus e avisos (60+).
7. A janela é renderizada por portal dentro do `[data-area-do-mapa]`, então vale para qualquer janela chamada de qualquer
   componente.

**Frágil.** Mexer em `--altura-topo` ou na área apertada reposiciona os padrões. O `zIndex` da camada alta limita a posição
em 14 (`Math.min(posicao, 14)`) para não passar dos avisos. Testes: `janelas/geometria.test.ts` (unidade) e
`e2e/tests/janelas.spec.ts`.

### 5. A dica que não incomoda

**Problema.** A dica R6a aparecia em tudo e irritava (V3b). Dica no mouse demorada, mas no teclado imediata, sem aparecer
quando o foco veio de um clique, e a próxima dica logo ao passar de um botão para outro.

**Como o código resolve** (`Dica.tsx`, hook `useDica`):
- No mouse, `aoEntrarMouse` espera `ATRASO_DA_DICA = 700 ms`; sair antes cancela o `setTimeout`.
- **Troca na hora:** duas variáveis em módulo, `abertas` (quantas dicas estão visíveis) e `fechouEm`. Se há uma aberta, ou uma
  fechou há menos de `JANELA_DE_TROCA = 300 ms`, a nova aparece sem esperar (passar de um botão a outro, como no Windows).
- **Foco do teclado:** `aoFocar` mostra na hora, **exceto** se o foco veio de um clique: um listener de `pointerdown` em captura
  guarda o instante e o alvo do último toque; foco que chega com menos de 100 ms dele, no mesmo alvo, não mostra.
- Esc, clique e perda de foco escondem.
- **A dica só existe onde falta nome.** `BotaoComDica` recebe `nomeVisivel` (o botão já tem texto) e `dicaSe` (por exemplo
  uma aba cujo nome está cortado com reticências: `nomeCortado` compara `scrollWidth` com `clientWidth`).
- **Botão desabilitado** não usa `disabled` (o nativo não deixa a dica aparecer): vira `aria-disabled`, o clique é ignorado e a
  dica passa a "Nome — motivo". Com as dicas desligadas, **clicar** num desabilitado mostra o motivo num balão curto (2,8 s).
- O balão é um portal no `body` com posição fixa (a rolagem de uma janela não o corta) e só existe no DOM enquanto está à
  vista (Q14), para centenas de botões não custarem nada a cada render. O `aria-describedby` volta a apontar para ele quando
  aparece; o nome do botão fica no `aria-label`.
- A opção "Dicas ao passar o mouse" (`dicasLigadas.ts`) desliga as dicas de botão. As dicas do **mapa** (condições, alça
  da tocha) são informação, não ajuda de botão, e continuam com a opção desligada.

**Frágil.** O estado compartilhado (`abertas`, `fechouEm`, `ultimoToqueDoPonteiro`) é de módulo: não existe por janela do
navegador (cada janela carrega o próprio módulo, o que está certo). Testes: `dicasLigadas.test.ts`, `e2e/tests/dicas.spec.ts`
(com `ajudasDicas.ts`) e `teclado.spec.ts`.

### 6. Diálogos empilhados: quem recebe o Esc e o foco

**Problema.** O seletor de imagem abre por cima do "Configurar cena"; dois diálogos, um Esc: só o de cima pode fechar.
Os atalhos do mapa não podem agir com um diálogo aberto.

**Como o código resolve** (`useDialogo.ts`): uma **pilha de símbolos** em módulo. Cada diálogo, ao montar, empilha um
`Symbol`, guarda quem tinha o foco, move o foco para dentro (o primeiro focável ou a própria caixa) e instala um
`keydown` em **captura** no `document`. O handler ignora tudo se o diálogo não é o do topo. No Esc: `preventDefault`,
`stopPropagation` e `aoEsc()`; ninguém abaixo (nem os atalhos da `Mesa`) ouve. No Tab: prende o foco entre o primeiro
e o último focável. Ao desmontar, tira da pilha e devolve o foco a quem abriu. O hook devolve o **nível** (0 é o primeiro),
que vira `z-index` 80 + nível. `haDialogoAberto()` é o que os atalhos do mapa consultam.

O `Popover` e os menus não usam essa pilha: usam `useFecharFora` (clique fora e Esc, sem prender foco). O **Tour** tem
seu próprio listener em captura que engole as teclas (`stopImmediatePropagation`) para as letras de ferramenta não mudarem a
ferramenta por baixo do véu.

**Frágil.** Todo modal novo tem de usar `useDialogo`; um modal que escuta Esc por conta própria rouba o Esc do de cima.
Testes: `e2e/tests/v10.spec.ts`.

### 7. O tour: achar o alvo, esperar a aba e nunca travar

**Problema.** O alvo de um passo mora numa aba que precisa abrir, às vezes dentro de um `<details>` fechado, e o painel
anima. O alvo pode nem existir (o jogador "vendo como" não tem paredes). O tour não pode travar nem apontar para o lugar
errado.

**Como o código resolve** (`tour/Tour.tsx`):
1. Ao chegar num passo, `abrirAba(passo.aba)` abre a aba. Depois `procurar` faz polling a cada 60 ms até
   `ESPERA_DO_ALVO_MS = 1500`: acha por `[data-testid="..."]`, **abre os `<details>` em volta** (`closest("details")` em laço)
   e só então mede com `getBoundingClientRect`. Se o alvo está cortado pela janela, `scrollIntoView`.
2. Achando, `setAlvo(medida)` e instala um `ResizeObserver` mais um `setInterval` de 250 ms: o buraco acompanha o alvo
   quando a janela, o painel ou a rolagem mudam.
3. **Não achando em 1,5 s**, o passo é **pulado no sentido em que o tour anda** (`direcao`: +1 ao avançar, −1 ao voltar). Se
   voltar além do primeiro, inverte. Passo sem alvo (`alvo: null`) escurece a tela toda e fica no meio.
4. `posicionarCartao` (`tour/posicao.ts`, função pura) escolhe o lado: tenta baixo e cima primeiro se o alvo é mais largo que
   alto (direita e esquerda no outro caso), fica com o primeiro em que o cartão cabe sem cobrir o alvo e desliza ao longo
   do lado. Se nenhum lado cabe (o alvo é o mapa inteiro), o cartão fica dentro do alvo, perto da borda de baixo.
5. É modal: o véu segura os cliques, o foco fica preso no cartão (`focusin` devolve o foco), →/Enter avançam, ← volta, Esc
   pula, e qualquer outra tecla é engolida.

**Frágil.** O tour é amarrado a `data-testid`: renomear o `data-testid` de um alvo quebra o tour (o passo seria pulado
em silêncio). Por isso `tour.spec.ts` confere que cada alvo existe na tela do papel certo. O tour das automações procura
alvos `ed-grupo-*`, `ed-peca-*`, `ed-porta-*`, `ed-campo-cada` e `ed-campo-chance`; renomear qualquer um quebra o tour (o
`au3.spec.ts` vigia). Testes de unidade: `tour/passos.test.ts`, `tour/posicao.test.ts`, `tour/abreSozinho.test.ts` e
`automacoes/passosDoTour.test.ts` (que também confere o roteiro "as tochas têm 30%…" sobre fluxos de verdade).

### 8. A alça de largura do painel

**Problema.** Arrastar a borda esquerda do painel muda a largura, mas essa largura é guardada por navegador e respeita o
tamanho da janela, e a alça tem de ser operável por teclado.

**Como o código resolve** (`BarraLateral.tsx`, `larguraDoPainel.ts`, `preferencias.ts`): `useLarguraDoPainel` guarda a largura
**escolhida** e a largura da janela (via `resize`) e deriva a **usada**: `ajustarLarguraDoPainel(escolhida, janela)` prende
entre `limitesDoPainel(janela)` (min 300, max 1/4 da janela, mas nunca menos que 300). A alça é `role="separator"` com
`aria-valuenow/min/max`, `tabIndex=0` e pointer capture; a largura do painel é a distância do ponteiro à borda direita da
janela (`innerWidth - clientX`). Durante o arrasto não grava; ao soltar (e a cada toque de tecla) grava. Setas para a esquerda
alargam, para a direita estreitam; Home e End vão aos limites. Quando a área do mapa muda, o mapa mantém o ponto que estava
no centro (R6b, em `mapaPixi.ts`), em vez de ancorar no canto.

**Teste.** `preferencias.test.ts` e `e2e/tests/estrutura.spec.ts`/`topo-e-abas.spec.ts`.

## Para ir além

- `../REDESIGN.md`: R1 (temas e marca), R2 (estrutura), R2b (14 temas depois de 11), R3 (janelas flutuantes), R4 (organização
  do mestre), R6a (teclado e foco), R6b (tela pequena), V1 (temas), V3b (dicas enxutas), V9 (ficha em janela própria),
  V10 (diálogos e Esc), V14 (menus e atalhos), P1 (preferências em sanfona), Q4/Q6 (mesa de som e janela própria), Q7
  (painel de cenas e barras de rolagem do tema), Q8 (aba Mesa), A1 (campos alinhados), AU1/AU2/AU3 (janela da automação e
  tour), CH1 (chamada em janela própria), C1 a C4 (tela inicial, mesas e contas) e T (tour).
- `../PASSAGEM.md`: o mapa de "onde mexer" de cada lote e os frágeis.
- `../ESTADO.md`: "Ajustes V9", "Ajustes P1", "Ajustes A1".
- `../ROTEIRO-DE-TESTES.md`: o roteiro manual de cada lote.
- `../desenho/LEIAME.md`: os protótipos aprovados da ficha (V4a, V4b), fonte da verdade do desenho da ficha.
- `12-testes-e-fluxo-de-trabalho.md`: como estes pontos são vigiados por teste.
