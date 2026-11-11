// O exemplo de compêndio (3 magias do SRD 5.1, CC-BY-4.0): o mesmo arquivo de `fixtures/compendio/`, empacotado
// no build para o botão "Usar o exemplo". Nada vem da internet. A atribuição está em
// `fixtures/compendio/ATRIBUICAO.md` e no campo `creditos` do próprio arquivo.
import texto from "../../../fixtures/compendio/exemplo-srd.json?raw";

export const TEXTO_DO_EXEMPLO_SRD: string = texto;
export const NOME_DO_EXEMPLO_SRD = "exemplo-srd.json";
