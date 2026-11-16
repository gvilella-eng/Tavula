# Ideias e notas

Ideias levantadas no planejamento que **ainda não viraram plano**, ideias **descartadas** (para não
voltarem) e notas sobre a campanha de referência. Quando algo for decidido, sai daqui e vai para o
`PROJETO.md`.

## Em avaliação

### Ordem e escopo dos lotes

- **Deploy mínimo cedo.** Sem servidor acessível de fora, o Marco B só dá para jogar com todos na mesma
  casa. Ideia: um deploy mínimo, com acesso protegido, logo depois do Lote 7b, e jogar antes das
  fichas.
- **Lote 11 antes do 9.** A iniciativa não depende da ficha (o bônus pode ser digitado).
- **Lote 10 como script avulso.** São umas 7 fichas, uma vez só: um script que converte cada PDF em
  JSON, com revisão à mão, pode custar bem menos que um importador com tela de revisão dentro do app.
- **Handouts e som ambiente mais cedo**, perto do Lote 7. A campanha de referência depende muito de
  documentos (caderneta, diários, cartas, plaquetas de lote) e de som (foles, sino). Os dois
  reaproveitam o esquema de assets locais.

### Mapas e paredes

- **Névoa manual:** virou o lote N4 (2026-11-14), entregue; ver `docs/REDESIGN.md`, "N4".

Desenhar paredes à mão em mapas de caverna (formas orgânicas) é o custo escondido de cada sessão.

- **Exportar da Masmorra** (projeto 3D da campanha, `../Dungeon`): um `--export-tabletop` que corta o
  mundo SDF na altura dos pés, gera a imagem vista de cima e extrai o contorno das paredes (marching
  squares + simplificação), com os POIs virando notas do mestre. As convenções já batem (metros,
  1 quadrado = 1,5 m, −Z = norte). A integração seria só por arquivo (de preferência `.uvtt`, que a Távola já importa desde o Q3), sem
  ligar os projetos. Exceção: o Poço do Eco (espiral de ~160 m de queda) precisa de mapas por altura.

### Tour de introdução (combinado com o Vilella, 2026-11-11; depois do V5)

O Vilella achou as dicas no mouse demais ("tudo tem tooltip, tá um saco"). Ficou combinado:
- **Feito (lote V3b, 2026-11-11):**
  - dica só em botão só de ícone, numa linha (nome e atalho), com 700 ms de atraso;
  - opção em Preferências para desligar as dicas;
  - os textos explicativos saíram das dicas e estão guardados em `apps/web/src/textosDoTour.ts` (`TEXTOS_DO_TOUR`,
    por `data-testid` do controle; ainda nada o lê). O tour deve usá-lo e acrescentar ali os passos que não são de botão.
- **Feito (lote T, 2026-11-12; ver `docs/REDESIGN.md`):** um tour de introdução:
  - no primeiro acesso, com "Pular", e "Fazer o tour de novo" nas Preferências;
  - a tela escurece e só a opção do passo fica iluminada, com um cartão curto: Voltar, Próximo n/N e Pular;
  - funciona pelo teclado;
  - um tour do mestre (~10 passos) e um do jogador (~6);
  - feito no próprio app, sem biblioteca;
  - um teste confere que cada passo ainda acha a sua opção.

### Tela inicial, criar mesa e contas por mesa (proposta do Vilella, 2026-11-11; em avaliação)

Substitui a "Autenticação em desenvolvimento" (PROJETO 4.6, escolher entre os usuários fixos) quando a mesa for
para a internet. Ele pediu opinião, não implementação.

- **Tela inicial** simples, na identidade visual, com duas áreas: "Entrar numa mesa" (id ou link → `/<id>`) e
  "Criar mesa".
- **Jogador**:
  - entra pelo link, escolhe um nome e uma senha (mais de 4 caracteres), confirma e aceita os termos;
  - o mestre recebe um pedido de entrada, aceita ou recusa e vincula a pessoa a um jogador (o "Jogador N" ganha
    o nome dela);
  - a conta vale só naquela mesa;
  - se esquecer a senha, pede a redefinição e o mestre aprova.
- **Mestre**:
  - cria a mesa com usuário, senha e confirmação, e escolhe ou cria uma **pasta local da mesa** no Windows;
  - a pasta guarda a prova de que ele é o mestre, que permite recuperar o acesso se esquecer a senha, e os
    assets de todos (para carregar o token de quem faltar).
- **Termos de uso**: checkbox no login, com link para um PDF sobre o que fica no servidor e o que fica local.

Avaliação (Claude):
- **Viável** no desenho de hoje: uma sala (Durable Object) por id, e o servidor nunca manda credencial ao
  cliente.
- **Senhas**: o servidor guarda só o hash. Por causa do limite de CPU do plano grátis (10 ms), o
  estiramento caro da senha roda no navegador (PBKDF2/Argon2) e a sala guarda um hash rápido com sal do
  resultado. Limite de tentativas por mesa e por IP, porque 5 caracteres é pouco.
- **Prova do mestre na pasta**: um par de chaves (WebCrypto). A chave privada fica num arquivo da pasta, a
  pública na sala, e a recuperação é por desafio e assinatura, sem a chave viajar. Mais um **código de
  recuperação** para anotar, para a pasta não virar o único caminho.
- **Riscos**:
  - a pasta só funciona em Chrome e Edge (File System Access, que já é exigência das imagens locais);
  - a redefinição aprovada pelo mestre pode ser enganada por alguém se passando por jogador, então o mestre
    confirma por voz ou mensagem;
  - o id da mesa deve ser longo e aleatório (ou código amigável de ~12 caracteres), mesmo com a aprovação na
    entrada.
- **Migração**: os usuários fixos de hoje viram as vagas de "Jogador N". A campanha atual continua; o mestre
  vincula cada conta à vaga que já tem as fichas.
- **Encaixe no plano**: um marco novo depois do V5, "Mesa na internet":
  1. tela inicial, criar mesa, ids e várias mesas no mesmo servidor;
  2. contas por mesa, pedidos, sessões e recuperação, mais os termos;
  3. pasta do mestre, com chave e assets por jogador;
  4. deploy.

Decidido pelo Vilella (2026-11-11), para levar ao PROJETO quando o marco for planejado:
- **Id da mesa**: código amigável de ~12 caracteres aleatórios, agrupado para ditar (por exemplo
  `k7m2-qx9p-4tdn`), em vez de hex.
- **Código de recuperação do mestre**: sim, além da pasta local. É mostrado uma vez na criação da mesa.
- **Toda entrada passa pelo mestre**: não existe convite que dispense a aprovação, nem um link ligado a uma
  vaga.

Planejado em 2026-11-12 como marco C1–C3 (PROJETO 4.14). O C1 (várias mesas, ids, tela inicial) está entregue.

### Conjuração (depois do N2, 2026-11-14)

A conjuração inata, os truques por nível, o ritual e os dardos, raios e alvos por nível entraram no N2. Sobram, de propósito:

- **Um acerto por raio** (Raio Ardente, Rajada Mística): hoje o acerto é um só e o dano sai por raio.
- **Vários grupos "N/dia"** no mesmo bloco e **ler o texto do monstro** ("À vontade: luz, mãos mágicas") para preencher a inata sozinha.
- **Gastar o uso da inata pelo MCP** (`rolar` só rola).

### Compêndio e mesa de som (Vilella, 2026-11-16)

- **Imagens e tokens para cada monstro e item do compêndio.** Nas palavras dele: "Uma coisa que eu acho que seja um
  problema, mas podemos resolver mais pra frente, é a criação de imagens e tokens para cada um dos monstros e itens da
  lista. Mas deixamos para um futuro." Gerar ou associar arte própria a cada entrada (nunca arte da WotC), para o
  monstro virar token sem o mestre procurar imagem.

## Descartadas (não propor de novo)

- **Imagens no servidor** (R2 ou similar): imagens locais são a premissa e o diferencial do projeto.
- **Regra baseada no relógio do PC do jogador**: o tempo é da sala (princípio 6).
- **Mecânicas da campanha no código**: a mesa é genérica (princípio 9).
- **Esconder da rede o que está fora da visão** (proteção contra o F12 por linha de visão): o Vilella
  decidiu em 2026-11-06 que não vale o custo. Visão e escuridão são só de tela; o filtro na sala fica
  para o que o mestre esconde de propósito.

- **Mapa revelado aos poucos** (mandar o mapa em tiles só conforme a exploração, para quem fuça o
  navegador não ver salas ainda não exploradas): o Vilella disse que os jogadores não vão fuçar o F12
  (2026-11-14, no N4). A névoa manual só esconde na tela; o que está sob ela chega ao navegador.

## Campanha de referência ("A Chama Primordial")

As notas ficam só no computador do mestre, em `privado/notas/campanha.md` (a pasta `privado/` não entra no
git).
