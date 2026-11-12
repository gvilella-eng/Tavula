# Bugs conhecidos

Lista de bugs vistos durante o uso, para corrigir num lote próprio mais tarde. Cada item diz onde aparece, o que
acontece e uma ideia de correção. Ao corrigir, apague o item daqui e cite a correção no `ESTADO.md`.

## Abertos

### Ficha: Dados de Vida estouram a caixa em nível alto (visto em 2026-11-12, V4a2)
- **Onde:** aba Personagem, bloco Dados de Vida, coluna do meio da janela larga (~326 px).
- **O que acontece:** a regra está certa, porque o personagem tem um dado de vida por nível. Um Bárbaro de nível 10
  tem 10 bolinhas de d12, e elas passam da borda direita do bloco. O mesmo vale para um multiclasse com muitos
  níveis num tipo só, e possivelmente para a janela estreita.
- **Ideia de correção:**
  - As bolinhas quebram em mais de uma linha dentro do bloco.
  - Ou encolhem a partir de ~6.
  - Ou, acima de um limite, vira um contador compacto ("7/10") com −/+.
  - Conferir também a pele Clássica e a janela estreita.

### Ficha: o modificador extra de perícia e salvaguarda aparece só de passar o mouse (visto em 2026-11-12, V4a2)
- **Onde:** aba Personagem, listas de Salvaguardas e Perícias (larga, estreita e as duas peles).
- **O que acontece:** passar o mouse ou focar uma linha mostra, à direita, a caixa do bônus extra. Ela cobre o fim
  do nome ("Acrobaci", "Atletism") e aparece sem a pessoa pedir.
- **Como deve ser (pedido do Vilella):** a caixa não aparece no hover. Com o **botão direito** na linha abre um
  pequeno popover **"Modificador: [caixa]"**, onde se digita um valor positivo ou negativo (+2, −1). Pelo teclado,
  o atalho de menu de contexto (Shift+F10 ou a tecla Menu) abre o mesmo popover, com Esc para fechar.
- Com o modificador diferente de zero, o total da linha já o inclui. Um sinal discreto pode indicar que há bônus
  extra (assumido).
