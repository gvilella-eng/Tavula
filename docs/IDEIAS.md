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

Desenhar paredes à mão em mapas de caverna (formas orgânicas) é o custo escondido de cada sessão.

- **Importar `.uvtt` / `.dd2vtt`** (Universal VTT, exportado pelo Dungeondraft e outros editores):
  imagem, paredes, portas e luzes de uma vez. A imagem continua indo para a pasta local do mestre.
- **Exportar da Masmorra** (projeto 3D da campanha, `../Dungeon`): um `--export-tabletop` que corta o
  mundo SDF na altura dos pés, gera a imagem vista de cima e extrai o contorno das paredes (marching
  squares + simplificação), com os POIs virando notas do mestre. As convenções já batem (metros,
  1 quadrado = 1,5 m, −Z = norte). A integração seria só por arquivo (de preferência `.uvtt`), sem
  ligar os projetos. Exceção: o Poço do Eco (espiral de ~160 m de queda) precisa de mapas por altura.

## Descartadas (não propor de novo)

- **Imagens no servidor** (R2 ou similar): imagens locais são a premissa e o diferencial do projeto.
- **Regra baseada no relógio do PC do jogador**: o tempo é da sala (princípio 6).
- **Mecânicas da campanha no código**: a mesa é genérica (princípio 9).

## Campanha de referência ("A Chama Primordial")

As notas ficam só no computador do mestre, em `privado/notas/campanha.md` (a pasta `privado/` não entra no
git).
