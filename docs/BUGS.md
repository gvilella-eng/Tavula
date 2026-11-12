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
