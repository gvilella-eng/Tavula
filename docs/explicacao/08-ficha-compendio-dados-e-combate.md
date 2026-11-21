# Ficha, compêndio, dados e combate

Este capítulo é a parte de regras de D&D 5e do Távola: a **ficha** (de personagem e de monstro), o **compêndio** (as magias, monstros e itens que o mestre carrega dos próprios livros), a **conjuração**, a **importação da ficha em PDF**, os **dados e as rolagens**, o **chat**, e a **ordem de turno** com as condições. Quase tudo é código **puro** em `packages/shared`: funções que recebem dados e devolvem dados, sem DOM e sem rede. Isso é de propósito: a mesma regra roda na sala (que é a autoridade), no navegador (para mostrar) e no MCP (para o Claude), e os testes a exercitam sem subir nada.

Uma regra atravessa o capítulo inteiro e explica muita coisa: **quem rola dados é sempre a sala**. O navegador manda só a notação ou os números do pedido; o resultado não existe no schema que um cliente pode mandar.

## Onde fica

Ficha, em `packages/shared/src/`:

- `ficha.ts`: `FichaSchema`, a base e os derivados (`derivar`, `modificador`, `bonusDeProficiencia`, `bonusDePericia`...), conjuração (`nivelDeConjurador`, `espacosDaFicha`, `pactoDaFicha`), descansos, `aplicarOperacoes` (a gravação por caminho), exportar e importar a ficha em JSON.
- `srd/index.ts`: os dados mínimos do SRD 5.1 (atributos, 18 perícias, 12 classes, as tabelas de espaços). Atribuição CC-BY-4.0 em `srd/ATRIBUICAO-SRD.md`.
- `conjuracao.ts`: espaço maior, dado a mais por nível, truque por nível do personagem, ritual, magia inata.
- `ataques.ts`: monta a expressão do dano e a CD a partir do que a engrenagem do ataque guarda.
- `importarTraducoes.ts` e `importarFichaPdf.ts`: a importação do PDF.

Compêndio:

- `compendio.ts`: formato do arquivo (`CompendioSchema`), `lerCompendio`, `juntarCompendios`, buscas por seção.
- `buscaDoCompendio.ts`: a busca sem acento e com erro de digitação.
- `compendioParaFicha.ts`: `aplicarEntradaNaFicha`, `monstroParaFicha`, `personagemDoMonstro`.
- `compendioSecoes.ts`: as seções (armas, itens) da aba.
- `extrator/`: o extrator de PDFs de livro para o JSON (roda no Node, fora do app; ver `docs/COMPENDIO.md`).
- Web: `useCompendio.ts` (lê, junta, registra), `leituraDoCompendio.ts` (`lerUmaVez`, cache por hash), `AbaCompendio.tsx`, `CompendioMonstros.tsx`, `CompendioBlocos.tsx`.

Dados, chat, combate:

- `dados.ts`: a notação (`lerExpressao`), a aleatoriedade (`fonteCrypto`), `rolar`, `dobrarDados`.
- `rolagens.ts`: os modelos de rolagem (`rolarAtaque`, `rolarTeste`, `rolarEspaco`), a vantagem.
- `chat.ts` e `chatnucleo.ts`: a mensagem, os comandos, quem vê o quê, `criarMensagem`.
- `combate.ts` e `combatenucleo.ts`: a ordem de turno (pura) e as intenções.
- `condicoes.ts`: as 14 condições, exaustão e concentração, e os ícones.
- Web: `ficha/` (a janela da ficha, `BlocoDoNpc.tsx`, `conjurar.ts`, `rolador.ts`, `useFicha.ts`, `extrairPdf.ts`, `useImportadorDePdf.tsx`, `RevisaoDoPdf.tsx`), `rolagem/` (cartões), `MensagemDoChat.tsx`, `AbaChat.tsx`, `OrdemDeTurno.tsx`.

## Como funciona

**Uma jogada, de ponta a ponta** (o jogador clica em "Conjurar" numa bola de fogo, com um espaço de nível maior):

```
clique ─► conjurar() (ficha/conjurar.ts)
            │ gasta o espaço: alterar({espacosGastos...})  ──► fila de operações (400 ms) ──► ficha.alterar ──► sala
            │ calcula o extra: extraDeEspaco / quantidadeDaConjuracao (shared/conjuracao.ts)
            ▼
         rolador.ataque(...) ─► intenção chat.modelo { bonus, dano, espaco:{nivel, extra} }   (SÓ números e texto)
                                       │
                                       ▼ sala: criarMensagem → rolarAtaque → rolarEspaco   (rola com crypto)
                                       │
                          evento chat.mensagem (o RESULTADO) ──► todos os navegadores ──► MensagemDoChat (cartão)
```

Duas rotas em paralelo, e a diferença importa: **gastar o espaço** é uma mudança de ficha (vai por `ficha.alterar`, o navegador junta mudanças por 400 ms em `useFicha.ts` e a sala valida a ficha inteira); **rolar** é uma intenção de chat (a sala rola e publica o cartão). A sala não amarra uma à outra: a mesa confia no jogador (o gasto do espaço é do navegador).

**Um monstro, de ponta a ponta** (o mestre arrasta o "Goblin" do compêndio para o mapa): o compêndio é lido do cache (`useCompendio`), a entrada vira `monstroParaFicha` (os números do bloco viram campos da ficha), `personagemDoMonstro` monta o personagem NPC (token do tamanho certo) e a intenção cria personagem e token. O monstro vira uma ficha de verdade; nada fica "ligado" ao compêndio depois.

## Decisões e por quê

**A ficha guarda a base, nunca o derivado.** `FichaSchema` tem os atributos (o valor 1 a 30), o nível de proficiência de cada salvaguarda e perícia (`nenhuma`, `proficiente`, `especialista`), as classes com nível, PV, CA escrita, etc. Modificadores, bônus de proficiência, totais de perícia, percepção passiva, iniciativa, nível de conjurador, espaços e dados de vida são **calculados** por `derivar(f)`. Motivo: ao mudar o nível ou um atributo, tudo se atualiza sozinho e não há como a ficha ficar incoerente. O contraste é o PDF da ficha, que guarda o total pronto (e é por isso que a importação precisa converter totais em nível + bônus; ver o trecho 5). Não achei nos docs uma discussão registrada desta escolha: é o desenho do Lote 9 em diante.

**Cada campo tem um "bônus manual" ao lado do cálculo.** Salvaguarda e perícia têm `{ nivel, bonus }`; ataque tem `bonusMagico`, `bonusDano`; a iniciativa tem `iniciativaBonus`; os espaços de magia têm `espacosTotal` (para escrever por cima da conta). Motivo (inferido do desenho): permitir itens mágicos e regras da casa sem desligar o cálculo automático.

**Zod em tudo, limites em tudo.** `FichaSchema` limita cada texto, cada lista (100 ataques, 300 magias, 300 itens...) e a ficha inteira em 256 KB (`TAMANHO_MAXIMO_DA_FICHA`, conferido por `bytesDoJson`). A ficha vem de um cliente; sem limite, um jogador poderia encher o banco da sala.

**SRD só como dado mecânico.** O diretório `srd/` tem classes (dado de vida, salvaguardas, tipo de conjurador, habilidade padrão), perícias (com o atributo) e as tabelas de espaço de magia. **Sem texto de magia, característica ou item.** O texto vem do compêndio do mestre, de livros que ele possui. A licença CC-BY-4.0 pede a atribuição, que está no `ATRIBUICAO-SRD.md`. Os nomes foram traduzidos para o português.

**O compêndio é um arquivo do mestre, não código nem banco.** O Távola não traz texto de livro: nenhum fixture, teste ou doc leva magia ou monstro de livro, só 3 magias do SRD como exemplo (`fixtures/compendio/exemplo-srd.json`, "Usar o exemplo"). O arquivo mora na pasta do mestre, é um asset (capítulo 07) e a sala guarda só a referência (`Estado.compendio`).

**Um compêndio, vários arquivos.** `compendio/` pode ter `compendio.json`, `magias.json`, `monstros.json` e `itens.json`. A mesa lê os que existem e os **junta**; nome repetido: o último arquivo da lista vence, com aviso. Origem: o N3a (o formato com monstros e itens mágicos e a junção) e o N3b (o extrator, que gera um arquivo por livro).

**A sala rola, sempre.** O resultado de uma rolagem não existe no schema de entrada (`PedidoDeModelo` só tem bônus, expressão e texto). Isso impede um cliente de dizer "tirei 20". Origem: restrição "feito como se um dia os jogadores entrassem pela internet".

**O mestre sempre rola oculto, o jogador só com permissão.** Rolagem oculta (`/gr`) é visível ao autor e ao mestre; o jogador precisa da permissão `dado.rolarOculto`. A iniciativa de NPC é oculta por padrão (só o mestre vê).

**Condições são marcas, não regras.** `condicoes.ts` diz isso no topo: nenhuma regra é aplicada sozinha. Estar "envenenado" não dá desvantagem automática em nenhuma rolagem. Os resumos que aparecem na dica são texto próprio em português, não os dos livros. Motivo (inferido): a regra fica por conta do mestre, que conhece a situação.

## Os trechos complexos

### 1. A ficha: base e derivados (`ficha.ts`)

**Problema.** Uma ficha de D&D tem dezenas de números que dependem uns dos outros, e a edição precisa ser tolerante (campos opcionais, importação parcial).

**Como resolve.** As funções são pequenas e compõem:

- `modificador(valor)` = `floor((valor - 10) / 2)`; `valorDoAtributo` vale 10 se o atributo não foi preenchido.
- `nivelTotal(f)` soma os níveis das classes, entre 1 e 20 (sem classe, 1).
- `bonusDeProficiencia(f)` olha **primeiro o ND do NPC** (`npc.nd`, via `bonusPorND`) e só depois o nível: `2 + floor((nível - 1) / 4)`. Por isso a mesma função serve ao personagem e ao monstro.
- `bonusPorNivel` multiplica a proficiência por 0, 1 ou 2 (especialista dobra). `bonusDeSalvaguarda` e `bonusDePericia` somam o modificador do atributo, esse bônus e o `bonus` manual.
- `bonusDeAcerto(f, ataque)` aceita dois tipos de acerto (`AcertoSchema`): `fixo` (o número do livro de monstro) ou `formula` (atributo + proficiência opcional + bônus), e soma o bônus mágico.
- `derivar(f)` junta tudo num objeto só (a tela lê dele). A CA é `ca.valor` se escrita, senão `10 + mod de Destreza`.

**Os descansos** são funções puras ficha → ficha. `descansoCurto` devolve os recursos de recarga curta e zera `pactoGasto`. `descansoLongo` restaura PV ao máximo e zera o temporário e as mortes, devolve **metade dos dados de vida** (no mínimo 1, **dos maiores tipos primeiro**), todos os espaços, os recursos de recarga curta ou longa e os usos da conjuração inata (`recarregarInata`). Cada um termina em `limpa`, que remove as chaves `undefined` por um ciclo JSON (o zod com `exactOptionalPropertyTypes` não as aceita).

**`receberDano`**: o PV temporário absorve primeiro, o resto sai do atual, nunca abaixo de 0.

**A gravação por caminho (`aplicarOperacoes`).** O navegador não manda a ficha inteira a cada tecla; manda **operações** `{ caminho, valor }`, onde o caminho tem pontos (`atributos.for`, `itens.2.quantidade`; número é posição na lista; `valor: null` remove o campo ou o elemento). `aplicarOperacoes` trabalha numa **cópia profunda**, aplica cada uma (`aplicarUma`), valida a ficha **inteira** com o zod, confere os 256 KB, e limita `pvAtual` a `pvMax`. Se qualquer uma falha, **nada vale**. Detalhes que existem por causa de um problema real:

- Chaves proibidas (`__proto__`, `constructor`, `prototype`) são recusadas: poluição de protótipo.
- No fim, `compartilharEstrutura(antes, depois)` devolve a ficha nova **reaproveitando a referência** de tudo que não mudou (Q14). Sem isso, toda edição de um campo criava objetos novos para a ficha toda e o React refazia a ficha inteira.
- No navegador, `useFicha.ts` junta as mudanças por 400 ms (`ATRASO_DA_GRAVACAO_MS`); digitando num campo, a operação nova com o **mesmo caminho** da última da fila a **substitui** (`filaCom`). As já enviadas continuam valendo por cima da ficha da sala por 2,5 s (`VALIDADE_DO_ENVIADO_MS`) enquanto o eco não chega, senão a tela "pisca" de volta ao valor antigo.

**O que é frágil.** `derivar` roda a cada render da ficha; `classeSrd` (que acha a classe pelo nome sem acento) monta um `Map` uma vez porque antes recomputava tudo a cada chamada. Lista de chaves declaradas por seção: no Q14 a ficha foi dividida em seções com `memo`, cada uma declarando quais chaves lê (`ficha`, `fichaExceto`, `d`); quem passa a ler outra chave sem declará-la deixa a seção velha (`docs/PASSAGEM.md`, Q14).

**Quem vigia.** `packages/shared/src/ficha.test.ts` ("derivados do Darion", "regras", "descansos", "aplicarOperacoes", "ficha.alterar") e `apps/web/src/ficha/useFicha.test.ts`.

### 2. A conjuração: espaços, pacto, multiclasse (`ficha.ts`, `srd/index.ts`)

**Problema.** Os espaços de magia dependem do nível de conjurador, que depende da combinação de classes (multiclasse), e o Bruxo funciona à parte.

**Como resolve.**

- `tipoDeConjurador(c)` olha a classe no SRD (`completo`, `meio`, `pacto`, `nenhum`); Guerreiro e Ladino viram `terco` se a subclasse é Cavaleiro Místico ou Trapaceiro Arcano (`SUBCLASSES_DE_TERCO`, comparadas sem acento).
- `nivelDeConjurador(classes)` segue a tabela de multiclasse do PHB 2014, com um atalho que importa: **com uma só classe conjuradora**, vale a tabela da própria classe (meio-conjurador de nível 2 ou mais conta `ceil(nível / 2)`, terço de nível 3 ou mais `ceil(nível / 3)`); **com mais de uma**, somam-se os níveis inteiros dos completos, a metade (para baixo) dos meios e o terço (para baixo) dos de terço. O Bruxo não entra nessa conta.
- `espacosDeMagia(nível)` consulta a tabela `ESPACOS_POR_NIVEL_DE_CONJURADOR` (índice nível - 1, linha com os espaços do 1º ao 9º).
- `pactoDoBruxo(classes)` **soma os níveis de Bruxo** e consulta `PACTO_DO_BRUXO`: quantidade e nível dos espaços de pacto, que se recuperam no descanso **curto**.
- `espacosDaFicha(f)` junta: se `espacosTotal` está vazio, vale a conta; se não, o escrito à mão **vence nos níveis que cobre**, o resto vem da conta. Os gastos (`espacosGastos`) são limitados ao total.
- `conjuradoras(f)` devolve uma entrada por classe que conjura: habilidade (a escolhida em `conjuracao`, a padrão da classe, ou Inteligência para subclasse de terço), **CD = 8 + proficiência + modificador** e ataque = proficiência + modificador. `conjuracaoSemClasse` faz o mesmo para quem não tem classe conjuradora mas escolheu uma habilidade (V4a3; vale só sem classe conjuradora).

**Conjurar com espaço maior (`conjuracao.ts`).** `opcoesDeEspaco(nívelDaMagia, espaços, pacto)` monta o menu "Conjurar com espaço de:": um item por nível **do da magia até o 9º, só com espaço restante**, crescente; depois o de **pacto** (que sempre sobe até o nível do pacto) se serve e se há espaço. Truque não gasta espaço (lista vazia). `extraDeEspaco(porNivelAcima, nívelDaMagia, nívelDoEspaço)` multiplica o "por nível acima" (`"1d6"`, `"1d4+1"`) pelos níveis acima (`multiplicarExpressao`, com os tetos de `LIMITES_DE_DADOS`).

**De onde vem o "por nível acima".** `porNivelAcimaDaMagia` tenta, em ordem: o campo escrito na magia da ficha, o texto "Em níveis superiores" da magia **com o mesmo nome no compêndio**, e por último o "Em níveis superiores" que a própria descrição carrega. Assim fichas antigas funcionam sem edição. A leitura do texto (`porNivelAcimaDoTexto`) usa três expressões regulares sobre o texto **sem acento** (`semAcento`) para achar frases como "aumenta em NdM para cada nível" em formas diferentes, e valida o resultado com `lerExpressao`: se a frase não vira uma expressão de dados válida, devolve vazio e o campo fica para a mão.

**Quantidade em vez de dado (N2).** Algumas magias sobem **dardos, raios, alvos ou criaturas** por nível, não dados. `lerPorNivelAcima` entende os dois formatos (`"1d6"` ou `"1 dardo"`); `quantidadeDaConjuracao` soma `base + por × níveis acima`, com a base vinda de `quantidadeBase` (campo da magia), do texto do compêndio ("três dardos"), da descrição, ou 1, e o teto é 30. Se `cada` (o dano de um dardo) existe, `rolarEspaco` na sala **rola um por um** (até 30 rolagens), e o cartão soma.

**Truque por nível do personagem.** `dadosPorNivel` é uma lista `{ nivel, expressao }` onde **vale o item de maior nível alcançado** (`extraDoTruque`; eles não se somam). `dadosPorNivelDoTexto` lê o texto do truque ("aumenta em 1d10 quando você alcança o 5º nível, 11º e 17º": cada passo multiplica o dado base por `k + 1`; e a variante dos raios: "dois raios no 5º nível" soma `(quantos - 1)` vezes o dado do dano). O nível para o truque é `nivelParaTruque`: a soma dos níveis das classes; sem classe (um NPC), o **ND como aproximação** (frações valem 1).

**Ritual.** `Magia.ritual` vem do compêndio; o menu ganha "Ritual · sem espaço", e o pedido leva `espaco: { nivel, ritual: true }`. **A mesa não confere a classe**: confia no jogador. O cartão mostra "como ritual".

**Magia inata (monstro).** Mora em `ficha.magias` com um campo `inata` (para reaproveitar o editor, o arrasto e o cartão). `frequencia` é `vontade` (sem limite), `cada` (N usos **por magia**, bolinhas na própria magia) ou `grupo` (gasta de um contador compartilhado, `ficha.inata.grupo`). `magiaInataParaRolar` troca a CD e o ataque para os da conjuração inata (atributo e CD próprios: "atributo de conjuração inata é Carisma, CD 13"): a magia inata não usa os da classe. `recarregarInata` (descanso longo) devolve os usos.

**O que é frágil.**
- **Todo filtro de magias por círculo precisa de `&& !m.inata`.** A magia inata mora na mesma lista; uma lista nova de magias por círculo que esqueça isso mostra a inata duas vezes (`ConjuracaoDoNpc`, `AbaMagias`, `aplicarEntradaNaFicha`) (`PASSAGEM.md`, N2).
- As bolinhas de uso são "cheia = disponível": gastar esvazia a **última**; os testes olham a última.
- `rolarEspaco` serve a três caminhos (ataque, `/r` e `chat.magia`); ritual e inata nunca têm `extra` nem `quantidade`, e `quantidade` nunca vem com `extra`. Se vierem juntos, o bloco do chat só mostra um.
- O NPC não tem botão de descanso: o "Recuperar usos" da parte inata é o único jeito de zerar os usos nele.
- As expressões regulares que leem o texto do compêndio são heurísticas sobre o português do livro; outro livro ou outra tradução pode escrever a frase de outro jeito, e o campo cai para vazio (a mão).

**Quem vigia.** `packages/shared/src/conjuracao.test.ts` (espaço, "por nível acima", crítico no extra), `packages/shared/src/conjuracaoN2.test.ts` (inata, truque por nível, dardos, ritual), `ficha.test.ts` e `e2e/tests/ficha-v6.spec.ts`, `ficha-n2.spec.ts`, `npc-conjuracao-q9.spec.ts`.

### 3. O NPC e o bloco de monstro

**Problema.** Um monstro de livro tem um formato próprio (tipo, tamanho, ND, PV com fórmula, traços, ações, reações, ações lendárias, resistências em texto). Fazer um segundo tipo de ficha duplicaria tudo.

**Como resolve.** O monstro **é uma ficha**, a mesma `FichaSchema`, com três acréscimos: `apresentacao: "npc"`, o bloco `npc` (`tamanho`, `tipo`, `pvFormula`, `sentidos`, `vulnerabilidades`, `resistencias`, `imunidades`, `imunidadesCondicoes`, `nd`) e, em cada ataque, `categoria` (`acao`, `reacao`, `lendaria`), `tipoDeAcao` (`cac`, `dist`, `cacdist`, `magia`, `esp`), `recarga` ("Recarga 5–6" = recarrega no d6 de 5 ou mais), `recarregado` e `usos` (bolinhas por dia). Os **traços** são as `caracteristicas`; as ações, reações e lendárias moram **no mesmo array `ataques`**, separadas pela `categoria`.

Quem decide como a janela da ficha se mostra é `apresentacaoDoPersonagem` (em `pastas.ts`): o que a pessoa escolheu em Configurar (`ficha.apresentacao`) ou, sem escolha, a regra do app (NPC é quem está na pasta NPCs ou não tem jogador que o edite). `BlocoDoNpc.tsx` desenha o bloco; os testids do personagem (`ca-<id>`, `pv-atual-<id>`...) são reaproveitados.

**`bonusDeProficiencia` olha `npc.nd` antes do nível.** O bônus de um monstro sai do ND (`bonusPorND`, `xpDoND`, a tabela `XP_POR_ND`), então os testes e ataques calculados do NPC estão certos sem uma classe.

**O que é frágil.**
- A reordenação e o arrasto das ações usam o **grupo** da categoria (`posicoesDoGrupo`), porque as três listas moram num array só. Mudar a categoria na engrenagem muda a linha de seção.
- `NIVEIS_DE_DESAFIO` tem ordem explícita porque `Object.keys` põe chaves inteiras antes das fracionárias; não troque por `Object.keys(XP_POR_ND)`.

**Quem vigia.** `compendioN3a.test.ts` ("a lista de níveis de desafio", "monstroParaFicha"), `e2e/tests/ficha-npc.spec.ts`.

### 4. O compêndio: o arquivo, a junção, a busca e a aplicação na ficha

**O arquivo.** `CompendioSchema` tem `formato: "tabletop-compendio"`, `versao: 1`, `creditos` (a atribuição exigida pela licença, só mostrada) e listas opcionais: `magias`, `armas`, `itens`, `monstros`, `itensMagicos`. Tem de haver **ao menos uma lista com entradas** (um `refine`). Cada tipo tem um teto (`LIMITES_DO_COMPENDIO`: 2000 de cada, 1000 para armas) e o arquivo tem 16 MB no máximo.

`lerCompendio(texto)`: confere o tamanho em bytes (UTF-8), remove o BOM, faz `JSON.parse`, valida com o zod e, se falhar, devolve o **primeiro** problema em português, com o caminho "como a pessoa conta" (`magia 3, campo nivel: ...`, começando em 1) para o mestre achar o erro no arquivo. Depois confere nomes repetidos entre as magias (sem acento nem caixa): repetido é recusado, com os dois números.

**A junção das listas.** `juntarCompendios(partes)` soma cada lista; para cada entrada, a chave é o nome **normalizado** (`normalizarBusca`: sem acento nem caixa), e `Map.set` faz o **último arquivo vencer**, com um aviso ("A magia X aparece em A e em B: ficou a de B"). Os créditos são juntados **sem repetir parágrafo** e dentro do limite do campo. Depois confere os limites do total (a soma pode estourar o que cada arquivo respeitava). Com um arquivo só, devolve-o como está (e o hash dele é o do arquivo). Com vários, `useCompendio.carregarDaPasta` serializa o compêndio **junto** (`JSON.stringify`), calcula o SHA-256 disso e registra como o asset da mesa.

**"Carregar arquivos do compêndio…"** (`carregarArquivos`) escolhe o nome canônico pelo conteúdo (`nomeCanonicoDoArquivo`: só monstros vai para `monstros.json`, só itens para `itens.json`, só magias para `magias.json`; misturado, `compendio.json`) e **soma ao que a pasta já tem**: lê o existente, junta com `juntarCompendios`, grava. Se o existente é inválido, recusa e manda corrigir antes. Sem pasta, os arquivos valem **só até recarregar a página** (`compendiosSoltos`).

**Cache da leitura.** `lerUmaVez(hash, obterTexto)` (`leituraDoCompendio.ts`) faz `JSON.parse` e a validação **uma vez por hash** para todas as instâncias de `useCompendio` (a aba e cada ficha aberta). Como o arquivo é endereçado pelo conteúdo, o resultado é imutável: a segunda chamada recebe a **mesma promessa** (o mesmo objeto, então os índices por referência são compartilhados). Resultado inválido também fica (é determinístico para aquele hash); texto `null` (arquivo ainda indisponível) **não** fica, para tentar de novo. Só os 3 mais recentes ficam guardados.

**A busca sem acento e com erro de digitação** (`buscaDoCompendio.ts`, Q2b). Usada pela aba e pela ferramenta `compendio` do MCP.

1. `normalizarParaBusca`: minúsculas, sem acento (`NFD` e tirar marcas), sem pontuação, espaços colapsados.
2. `prepararConsulta`: a consulta vira palavras; **palavras de ligação** (`de`, `da`, `of`, `the`...) saem, a menos que só sobrem elas.
3. Cada palavra da consulta tem de casar com **alguma palavra** do `nome` ou do `nomeOriginal` (em qualquer ordem). A nota de cada palavra, da melhor para a pior: **inteira** (4), **começo de palavra** (3), **pedaço dentro da palavra** (2, só com 3+ letras), **semelhante** (1). "Semelhante" é erro de digitação por **distância de edição** (inserir, tirar, trocar e **inverter letras vizinhas**), com tolerância por tamanho: 1 erro para palavras de 4 a 7 letras, 2 para 8 ou mais, 0 abaixo de 4; também compara com o **começo** da palavra do compêndio (uma palavra digitada pela metade e com um erro ainda acha a entrada).
4. `pontuarBusca` soma as notas e dá +2 se a consulta é o nome inteiro; **uma palavra que não casa elimina a entrada** (`null`).
5. `filtrarEOrdenar`: com busca, ordena por nota decrescente (empate pela ordem alfabética); sem busca, só alfabética. Aceita um filtro extra (escola, nível, ND...).

Duas otimizações existem porque a lista tem ~1100 entradas e a busca roda **a cada tecla**: as palavras de cada entrada são normalizadas **uma vez** num `WeakMap` (`preparadas`), e `distanciaDeEdicao` reaproveita três linhas de memória entre chamadas (**por isso não é reentrante**: não a chame de dentro dela mesma) e **corta cedo** quando a menor distância da linha passa do limite. O teste "otimizações da busca (equivalência com a versão antiga)" prova que a versão rápida dá o mesmo resultado da lenta.

**`aplicarEntradaNaFicha(f, entrada, modo, destino)`.** Devolve **operações de ficha** (as mesmas do `aplicarOperacoes`), não uma ficha nova: assim passa pelo mesmo caminho de gravação e validação. O que cada entrada faz:

| Entrada | Personagem | NPC |
|---|---|---|
| arma | vira um **ataque calculado** (`ataqueDeArma`: acerto = atributo certo + proficiência, dano com o mesmo modificador) | vira **ação** (`categoria: "acao"`) |
| magia | entra em Magias, no **círculo** dela; e em "Ataques e magias" se rola | entra na Conjuração; se não há classe nem habilidade escolhida, **a primeira magia escolhe a habilidade** (a maior entre Inteligência, Sabedoria e Carisma, nessa ordem de empate) |
| item | vai ao Equipamento (quantidade 1, **+1 se já tem**) | vira um **traço** |
| item mágico | nota do equipamento (`textoDoItemMagico`) | traço |
| monstro | **recusa**: "use Criar NPC, ou arraste-o para o mapa" | idem |

`atributoDaArma` escolhe Destreza à distância, o **maior entre Força e Destreza** se tem acuidade, senão Força. `rolagemDaMagia` **lê o texto** da magia para decidir se rola: "ataque de magia" vira acerto (habilidade de conjuração + proficiência), "salvaguarda de <atributo>" vira CD (com "metade" se o texto diz metade), e o primeiro "NdM de dano <tipo>" vira o dano e o tipo. Sem nenhuma das duas, devolve `{}` e a magia entra só na lista. A magia repetida (por nome sem acento nem caixa) é recusada com mensagem. A posição dentro da lista onde a pessoa soltou (`destino.posicao`) entra via `inserirNoGrupo`.

**`monstroParaFicha(monstro, magiasDoCompendio)`: sem perder nada.** Os números viram campos:

- PV = `pv.media` (a fórmula vai em `npc.pvFormula`, só mostrada); atributos, CA (`ca.valor`, `ca.fonte` vira a nota), ND, tamanho, tipo, sentidos, resistências...
- Salvaguardas e perícias vêm no livro como **total** ("Furtividade +6"); a ficha guarda **nível + bônus**. `proficienciaParaTotal(total, mod, prof)` descobre: se `total - mod` é igual à proficiência, é `proficiente`; igual ao dobro, `especialista`; maior que a proficiência, `proficiente` com o resto como bônus extra; menor, `nenhuma` com o resto como bônus. A proficiência vem do ND (`bonusPorND`). Perícia que a ficha não conhece vai para as **notas** e gera um aviso.
- Ação com CD fixa: a ficha **calcula** CD (8 + proficiência + atributo), então o código escolhe o **maior atributo** para a conta e grava a diferença em `cdBonus` ("o bônus fecha a conta"). Acerto do livro vira `acerto: { tipo: "fixo" }`.
- Deslocamento: o primeiro número em metros vira o da ficha (`ft = round(m / 0.3)`), e o texto original, se tinha mais (voo, escalada), vai para as notas.
- Conjuração por espaços vira `magias` com `espacosTotal`; inata vira magias com `inata`; as magias que o **compêndio tem** entram com texto e jogada (`magiaParaFichaCalculada`), as que **faltam** entram só com o nome e um aviso.
- O token do monstro usa `tamanhoDoTokenDoMonstro`: Miúdo a Médio 1 quadrado, Grande 2, Enorme 3, Imenso (ou Gargantuesco) 4.

**O que é frágil.** A leitura de "ataque de magia", "salvaguarda de" e do dano é por expressão regular no texto do livro em português; textos diferentes não casam e a magia entra sem rolagem (não é erro: o mestre completa na engrenagem). O arrasto do compêndio carrega a entrada no `dataTransfer` com o tipo `application/x-tabletop-compendio` e `lerEntradaArrastada` **revalida com o zod** (nunca confie no que veio do arrasto).

**Quem vigia.** `compendio.test.ts`, `compendioN3a.test.ts` ("juntar vários arquivos", "monstroParaFicha", "o item mágico na ficha"), `buscaDoCompendio.test.ts`, `apps/web/src/leituraDoCompendio.test.ts` e `e2e/tests/compendio-q2b.spec.ts`, `compendio-n3a.spec.ts`. Para gerar os arquivos a partir dos PDFs de livro: `../COMPENDIO.md`.

### 5. A importação do PDF da ficha (`importarFichaPdf.ts`, com o pdf.js)

**Problema.** O jogador tem a ficha como PDF exportado de outra mesa virtual e não quer redigitar. Um PDF não tem "campos": é uma lista de pedaços de texto com posição na página, e o leiaute muda com o tamanho do papel (A4 e Carta) e com o zoom.

**Como resolve, em duas camadas.**

*No navegador* (`ficha/extrairPdf.ts`): o pdf.js vem do npm e o **worker dele é empacotado pelo Vite** (arquivo local, nada de CDN: o projeto é "tudo local"). `extrairPedacosDoPdf` lê cada página com `getTextContent()` e converte os itens em `Pedaco { pagina, str, x, y, largura, altura }` (`pedacosDoTextoDoPdf`, que descarta os marcadores de conteúdo sem `str`). Limites: 25 MB e 40 páginas. O arquivo **não sai do computador**: nada é enviado até o jogador confirmar na tela de revisão.

*Em `importarFichaPdf.ts` (puro)*: `importarFichaDoPdf(pedacos)` devolve `{ reconhecido, nome, ficha, incertos, trechos }`. A ideia central: **nada de coordenada absoluta**. Tudo é procurado **em relação a um rótulo** ("CLASSE & NÍVEL", "ANTECEDENTE"...), com as distâncias medidas numa **escala do documento**.

- `escalaDoDocumento`: a **mediana** das alturas do texto da primeira página dividida pela altura de referência (7,1, do PDF A4 a 100%). Todas as distâncias no código são multiplicadas por essa escala `u`. É isso que faz o PDF Carta e o A4 darem o mesmo resultado.
- `montarItem` classifica um pedaço como **rótulo** se é pequeno (altura até 7 × escala), tem 2+ letras e está em caixa-alta. `montarPaginas` agrupa em linhas (`agruparEmLinhas`: mesma altura dentro de 3 × escala) e `juntar` põe espaço entre pedaços quando a folga horizontal passa de 0,8 × escala ou uma letra minúscula encontra uma maiúscula.
- As consultas são `acima(pag, rótulo, dyMax, folga)` e `abaixo(...)`: os itens acima do rótulo, até `dyMax`, **parando no próximo rótulo acima** (as caixas se encadeiam) e sobrepostos na horizontal. Os valores do cabeçalho são "a linha mais próxima acima do rótulo".
- As âncoras (`A`) são expressões regulares **sem acento, em português e em inglês** (`classe & nivel|class & level`), porque a ficha impressa sai no idioma da conta.
- Páginas de magia: `fluxoPorColunas` descobre as **colunas** (`colunasDa`: picos de `x` do início das linhas, bem separados) e lê as linhas na ordem de leitura (página, coluna, de cima para baixo); `blocosDeMagia` quebra o fluxo em blocos achando as linhas "Tempo de conjuração" (`CAMPOS_DE_MAGIA`) e recuando para o título e a linha de escola e nível.
- **Textos cortados**: a impressão corta o campo "Classe & nível" com "…" ("Domínio da Sepultura Cl…") e o nível se perde; `classeDeTextoCortado` acha a classe só se o começo bate com **uma** classe do SRD, e o nível é procurado em outro lugar.
- As traduções (`importarTraducoes.ts`) vertem raça, antecedente, tendência e idiomas ingleses para o português do app.

**Nunca "adivinha em silêncio".** Cada coisa duvidosa vai para `incertos` (`caminho`, `motivo`, `trecho` do que o PDF mostrava) e a ficha é validada no fim com `FichaSchema`; se não passa, um incerto sem caminho diz o motivo. A tela `RevisaoDoPdf.tsx` mostra a ficha por seção com os incertos marcados e o texto cru (`trechos`), o jogador corrige, e **só então** `useImportadorDePdf` manda a ficha (JSON) à sala com `ficha.alterar` de **caminho vazio** (troca a ficha inteira). O destino é "Ficha nova" ou "Por cima de: <personagem>" (só os personagens que a pessoa edita). Um PDF que não é uma ficha 5e (`reconhecido: false`) não lê nada.

**O que é frágil.** Depende do leiaute do PDF: por exemplo, se a ficha impressa mudar a altura dos rótulos, `montarItem` deixa de achar os rótulos. A ficha de teste é a do Darion (e a do Rendan, que quebrou o campo de classe cortado) e os testes usam esses PDFs; os de "parser com pedaços sintéticos" cobrem a mecânica sem PDF. Os valores de `dyMax` e `folga` de cada campo foram calibrados à mão contra esses PDFs.

**Quem vigia.** `packages/shared/src/importarFichaPdf.test.ts` ("importar o PDF do Darion", "importar o PDF do Rendan (B1)", "parser com pedaços sintéticos", "tabelas de tradução") e `e2e/tests/importarPdf.spec.ts`.

### 6. Os dados e as rolagens (`dados.ts`, `rolagens.ts`)

**A expressão.** `lerExpressao(texto)` é um parser com **uma única expressão regular com flag `y` (sticky)**, aplicada termo a termo a partir de `lastIndex`. Aceita `NdM`, `dM` (1dM), `d%` (d100), constantes, `+` e `−` (inclusive o sinal de menos tipográfico), espaços e `khN` / `klN` ("mantém os N maiores ou menores": `2d20kh1` é **vantagem**, `2d20kl1` **desvantagem**). Recusa, com motivo em português, o que passa dos limites (`LIMITES_DE_DADOS`: 100 dados por termo, 1000 faces, 20 termos, constante até 100 mil, 200 caracteres), falta de sinal entre termos, "manter 5 de 3 dados" e expressão sem nenhum dado. **Não rola nada.**

**O sorteio.** `fonteCrypto` usa `crypto.getRandomValues` com **rejeição**, para não haver viés de módulo: calcula o maior múltiplo de `máximo` que cabe em 32 bits e descarta valores acima dele. Com um `% faces` direto, as faces baixas sairiam um pouco mais. `fonteComSemente` (mulberry32) é **só para teste**; os ganchos de teste a usam, a sala de verdade nunca.

**`rolar(expressão, fonte)`** devolve a `Rolagem`: para cada termo, **cada dado rolado** (inclusive os descartados, com `descartado: true`), o subtotal já com sinal, e o total. No `kh`/`kl`, ordena os índices pelo valor e marca como descartados os que não ficam (**empate: o primeiro fica**). A rolagem guarda a forma canônica da expressão (`formatarExpressao`).

**O crítico** dobra os **dados**, não os modificadores: `dobrarDados` multiplica a quantidade de cada termo de dados por 2 (teto 200) e deixa as constantes. `rolarAtaque` rola o acerto (`expressaoDoD20(bônus, vantagem)`), lê o `d20Natural` (o primeiro termo de d20 positivo, o **dado que ficou**, então com vantagem é o maior), compara com a `margemCritico` do ataque (20 por padrão; 19 ou 18 para quem amplia), e, no crítico, dobra os dados do dano e soma o `danoCritico` extra (os dados a mais do crítico, depois de dobrar). **Rola o dano sempre, também no erro** (o cartão mostra os dois; a regra de aplicar é do mestre). `rolarTeste` faz d20 + bônus, com CD opcional: `sucesso = total >= CD`, e marca 20 e 1 naturais.

**Os cartões.** O resultado de um modelo é a união discriminada `ResultadoDeModelo` (`ataque`, `teste`, `vida`) e vai dentro da `Mensagem` do chat (`tipo: "modelo"`). A web renderiza em `rolagem/` (`CartaoNoChat`, `CorpoDaRolagem`): `totais.ts` calcula, só do que a mensagem já traz, os **dois totais da vantagem** ("13 e 19, +3 → 16 | 22", `totaisDaVantagem`) sem mudar o protocolo, e `agrupar.ts` faz **dois cartões seguidos do mesmo remetente dividirem o cabeçalho** (mesmo autor, mesmo personagem, mesma origem do Claude, mesma visibilidade e menos de 3 minutos entre eles). O espaço usado ao conjurar vem **colado** no cartão do ataque (`EspacoNoChat`).

**O pedido nunca traz resultado.** `PedidoDeModeloSchema` tem `bonus`, `dano` (a notação), `margemCritico`, a `salvaguarda` (só para mostrar "CD 15 de Destreza, metade se passar"), o `espaco` e a vantagem. Nada de "total". É o que impede um cliente de forjar uma rolagem.

**O que é frágil.** `UM_TERMO` é uma regex sticky com `lastIndex` mutável: o `lerExpressao` zera `lastIndex` e define a posição a cada volta; mexer na regex sem manter o `y` (sticky) ou na ordem dos grupos quebra silenciosamente a leitura dos termos desestruturados. O teto de 200 dados por termo depois do crítico existe para o resultado caber no schema da rolagem (`RolagemSchema`).

**Quem vigia.** `dados.test.ts` ("parser de notação", "rolagem", "crítico dobra os dados, não os modificadores", "fonte de aleatoriedade" com a prova da rejeição), `apps/web/src/rolagem/{totais,agrupar,estilo}.test.ts`.

### 7. O chat

**A mensagem** (`MensagemSchema`): `id`, `seq` (o do evento que a criou: a ordem da conversa), `emSala` (o relógio da sala) e `emReal` (a hora real, só para HH:MM), `autorId`, `como` (fala **como** um personagem: nome e retrato vão junto, para quem não vê o personagem na ficha), o `tipo` (`texto`, `rolagem`, `modelo`, `magia`, `caracteristica`, `aviso`), `visivelPara` (`"todos"` ou uma lista de ids), `oculta`, `peloClaude`.

**Comandos** (`interpretarChat`, puro, não rola nada): `/r` (rola; **a expressão é o maior começo válido do texto**, o resto vira comentário, então `/r 1d20+5 furtividade` rola e legenda), `/gr` (rolagem oculta), `/w` (sussurro), `/em` (ação em terceira pessoa), `[[1d20+5]]` no meio do texto (rola na hora, até 10 por mensagem) e `/?`. O destinatário do `/w` é achado de três formas, em ordem: entre aspas; o **maior nome de usuário que abre o texto** (para nomes com espaço); um **prefixo único** (ambíguo, pede o nome inteiro).

**Quem monta é a sala** (`criarMensagem` em `chatnucleo.ts`): recebe a intenção e o estado, confere o personagem de `como` (visível e editável por quem fala), e devolve a mensagem **com os dados já rolados** (`rolarTodas` para `[[...]]`). Se algo falha, devolve `recusa` com código. Não toca no estado: o `nucleo.ts` emite o evento `chat.mensagem`.

**Sigilo.** `mensagemVisivelPara`: o mestre vê **tudo**; o jogador vê o que é dele (autor), o que é para `todos` e o que cita o id dele (sussurro). `mensagemParaUsuario` ainda tira `emSala` do jogador se a mesa não está no modo de tempo "exato" (a mesma regra do tempo das tochas), e `chatParaUsuario` entrega as últimas 200 que ele vê. Um sussurro `{ ids: [alvo] }` é visto pelo alvo, pelo autor e pelo mestre; uma rolagem oculta é `{ ids: [] }` com `oculta: true`: só autor e mestre.

**Limite de taxa.** `registrarMensagem` é uma **janela deslizante** por conexão: aceita se nos últimos 1000 ms houve menos de 10; a recusada **não entra no histórico** (senão quem insiste nunca voltaria).

**O chat não entra na exportação** da campanha: é registro da sessão, mora numa tabela própria da sala. Cartões de rolagem e de magia vão para o chat como **mensagens**, então "mandar ao chat" uma característica da ficha é `chat.caracteristica`.

**Quem vigia.** `chat.test.ts` ("interpretarChat", "chat.enviar na sala", "sigilo: sussurro e rolagem oculta", "limite de 10 mensagens por segundo") e `e2e/tests/chat.spec.ts`.

### 8. A ordem de turno, o combate e as condições

**A vez é guardada pelo id da entrada, nunca pelo índice.** O índice revelaria ao jogador quantas entradas ocultas existem (quem vê 4 entradas e a vez "no 6º" descobre que há 2 escondidas). `Combate` tem `entradas`, `atualId` e `rodada` (0 = ainda não começou; o primeiro "Próximo" abre a rodada 1).

**Ordenação** (`ordenarEntradas`): iniciativa maior primeiro; empate, **maior Destreza**; empate, **personagem de jogador antes de NPC**; depois o nome (A a Z, `Intl.Collator` pt-BR); por fim a posição de antes (**estável**). Quem ainda não tem valor fica **no fim, na ordem em que estava**. `destreza` e `jogador` existem para esse desempate e **só o mestre e a sala os recebem**.

**Turnos** (funções puras): `proximoTurno` (o primeiro começa na rodada 1, na primeira entrada; passar da última volta à primeira e soma a rodada), `turnoAnterior` (da primeira volta à última da rodada anterior; na rodada 1 não há para onde voltar), `tirarEntrada` (se era a vez, passa para a seguinte; se era a última, volta à primeira e a rodada vira; se a lista esvazia, ninguém fica na vez), `moverEntrada` (mão do mestre; a vez continua na mesma entrada). Todas devolvem o **mesmo objeto** quando nada muda, e as intenções comparam por referência (`novo !== combate`) para não emitir evento à toa.

**As intenções** (`combatenucleo.ts`) recebem um `ContextoDeCombate` com `emitir`; **quem pode agir** é decidido por `agePelaEntrada`: o mestre, ou quem **controla o token** da entrada (quem edita o personagem, ou o `controladoPor`, como um familiar entregue a um jogador) e a vê. `combateEntrar` é o do jogador: confere que a ordem está aberta, que ele vê e controla o token, que o token está na cena ativa e ainda não está na lista; **rola 1d20 + a iniciativa da ficha** na sala (o jogador não manda o número) e manda a rolagem ao chat. `combateRolar` rola o que falta (o mestre, todos sem valor ou os que escolher; o jogador, só os seus e só se ainda não tinham valor). `rolarDaEntrada` usa o **mesmo `rolarTeste`** do Lote 8 e decide a visibilidade: a de personagem de jogador vai pública; a de NPC, ou com valor oculto, ou com a entrada escondida, vai **oculta** (só o mestre a vê).

**Sigilo do combate** (`combateParaUsuario`): o mestre recebe tudo. O jogador só as entradas que `entradaVisivelPara` diz que ele vê (não oculta; o token dela é visível para ele na cena ativa), **sem Destreza e sem a marca `oculta`**; com `valorOculto`, o número vira "?" e **nunca viaja** no snapshot. Se a vez é de uma entrada que ele não vê, **ninguém fica em destaque** para ele. A rodada chega a todos.

**Os tokens apagados** saem da ordem (`semEntradasDosTokens`, que usa `tirarEntrada` para cada um e mantém a vez coerente).

**As condições** (`condicoes.ts`): 14 condições (`CONDICOES`), mais a **exaustão** (níveis 1 a 6) e a **concentração** (guarda o nome da magia). Moram no **token** (`condicoes`, `exaustao`, `concentracao`, `morto`) e `tokenCondicoes` as edita (mestre ou quem controla o token; um token invisível para quem pergunta responde como inexistente). `iconesDoToken` monta os marcadores na ordem canônica (alfabética) + exaustão + concentração, com título, resumo e cor, e `condicoesOrdenadas` deduplica. O ícone de cada uma é desenhado no web a partir da `chave`. De novo: são **marcas**; nada aplica efeito sozinho.

**O que é frágil.** A regra "a vez por id" quebra se alguém passar a expor índices em qualquer parte (UI, MCP, log). Toda função de turno precisa lidar com `atualId` inválido (uma entrada apagada), como `proximoTurno` faz recomeçando da primeira. `entradaVisivelPara` depende de `tokenVisivelPara`: uma nova regra de visibilidade do token precisa continuar valendo aqui. O desempate por Destreza usa a Destreza **lida da ficha ao entrar na ordem ou ao rolar** (`combateAdicionar`, `combateEntrar`, `rolarDaEntrada`); mudar a Destreza depois, sem rolar de novo, não reordena.

**Quem vigia.** `combate.test.ts` ("ordenação da iniciativa", "turnos (puro)", "um combate inteiro (3 PJs e 4 NPCs)", "permissões", "sigilo", "V2: combate.entrar", "rodada, dar a vez, limpar e fechar") e `e2e/tests/combate.spec.ts`, `ordem-simples.spec.ts`.

## Para ir além

- `../COMPENDIO.md`: como gerar os arquivos do compêndio a partir dos PDFs (o extrator e os nomes em inglês).
- `../PASSAGEM.md` seções "V4a3", "V4b", "V4b2", "V6", "N2", "N3a", "N3b", "Q2", "Q5", "Q10", "Q14", "Q15", e a seção 5 (pontos frágeis).
- `../REDESIGN.md` "V4a", "V6", "N2" para o que foi assumido.
- `../protocolo.md` para `ficha.alterar`, `chat.*`, `combate.*`, `token.condicoes`, `compendio.definir`.
- `07-arquivos-e-assets.md` (neste diretório) para como o arquivo do compêndio viaja entre navegadores.
- `../MCP.md` para as ferramentas `fichas`, `compendio`, `rolar`, `chat` e `combate` (o Claude faz pelo MCP o que a tela faz).
