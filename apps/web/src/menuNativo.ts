const CAMPO_DE_TEXTO =
  "input:not([type='checkbox']):not([type='radio']):not([type='button']), textarea, [contenteditable]:not([contenteditable='false'])";

/**
 * V10: o menu do navegador (Voltar, Recarregar…) nunca abre no clique direito da área do mapa: no mapa, nos menus
 * do token e da tocha, nos nomes e nos popups. Campos de texto mantêm o menu (copiar e colar) e as janelas
 * flutuantes (fichas, handouts) também, por causa do texto selecionável. O chat e os painéis laterais ficam fora
 * da área e seguem como estão (assumido).
 */
export function menuNativoDeveSumir(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof Element)) return false;
  if (alvo.closest(CAMPO_DE_TEXTO)) return false;
  if (alvo.closest(".janela")) return false;
  return alvo.closest("[data-area-do-mapa]") !== null;
}
