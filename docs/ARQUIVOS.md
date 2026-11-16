# Como os arquivos da mesa funcionam (Q1)

Em linguagem simples, para o Vilella. As imagens, os sons e o compêndio da mesa **não ficam no servidor**. O servidor só guarda a lista (o nome e a "impressão digital" de cada arquivo, o hash) e repassa o que um navegador manda para outro.

## Onde cada arquivo mora
1. **A pasta da mesa**, no seu computador (a que você escolhe em Preferências → Ajuda e arquivos). Lá estão as suas imagens e sons originais, o `compendio/` e, desde o Q1, uma cópia de tudo o que a mesa usa em `arquivos-da-mesa/` (um arquivo por hash).
2. **O cache do navegador**. Cada navegador guarda o que já recebeu ou processou. É por navegador: o Chrome e o Edge não dividem cache, nem duas janelas anônimas.
3. **Os outros navegadores online**. Quem precisa de um arquivo pede à sala, e a sala escolhe alguém que está online e tem o arquivo.

## O que acontece quando você sobe um arquivo
O navegador do mestre reduz a imagem, guarda no cache, copia na pasta (`arquivos-da-mesa/`, se a pasta está liberada) e avisa a sala. Os jogadores baixam dele, pedaço por pedaço. O mesmo vale para o que o Claude manda e para o compêndio.

## Por que o outro navegador não tinha nada
O segundo navegador não tinha o cache do primeiro nem a pasta escolhida. Como o primeiro estava fechado, ninguém online tinha os arquivos. Antes do Q1 a mesa só dizia "ninguém com o arquivo está online".

## O que mudou
- Com a pasta da mesa liberada, o navegador do mestre **traz da pasta** o que a mesa usa e ele não tem, e **leva para a pasta** o que só ele tem. Escolher a mesma pasta num segundo navegador basta: tudo carrega, sem o primeiro estar aberto.
- O Chrome pede a permissão da pasta de novo depois de fechar. Aparece o aviso "Reautorizar a pasta da mesa", com um clique. Depois disso o compêndio e o resto voltam sozinhos, sem subir de novo.
- Mestre num navegador sem a pasta e sem os arquivos vê "Os arquivos desta mesa ficam numa pasta do seu computador. Escolha a pasta da mesa neste navegador."
- Se a pasta escolhida não tem o que falta, o aviso pede para trocar de pasta.

## Dicas
- Escolha sempre **a mesma pasta** nos dois navegadores.
- Só Chrome e Edge escolhem pasta. No Firefox e no Safari valem o cache e os outros navegadores online.
- A pasta `arquivos-da-mesa/` pode ser apagada: a mesa a refaz do cache na próxima vez que abrir (se o cache ainda tiver os arquivos).
- Sem pasta liberada, o cache continua valendo. Recarregar a página não apaga nada; limpar os dados do site, sim.
- Os jogadores não copiam nada para a pasta. Eles recebem do mestre (ou de outro jogador online) e guardam no cache.
