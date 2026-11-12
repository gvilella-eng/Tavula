# Bugs conhecidos

Lista de bugs vistos durante o uso, para corrigir num lote próprio mais tarde. Cada item diz onde aparece, o que
acontece e uma ideia de correção. Ao corrigir, apague o item daqui e cite a correção no `ESTADO.md`.

## Abertos

### Importador do PDF: o Rendan veio sem classe e nível, com o domínio no Antecedente (visto em 2026-11-12, V4a3)
- **Onde:** Fichas → importar o PDF da ficha do Rendan (Clérigo, Domínio da Sepultura), da campanha real.
- **O que acontece:** o personagem veio sem classe e sem nível, com o domínio escrito no campo Antecedente; a raça
  veio como "Standard Human" e a tendência como "LB".
- **Ideia de correção:** colocar o PDF do Rendan em `fixtures/fichas/` e ajustar o leitor (`importarFichaPdf.ts`) até a
  classe, o nível, a subclasse, a raça e a tendência saírem certos. Fica aberto até termos o PDF nas fixtures.
