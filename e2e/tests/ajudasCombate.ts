import type { Locator, Page } from "@playwright/test";
import { expect } from "./ajudas";
import { centrarNoToken, tokenDe } from "./ajudasMapa";

// Ajudas do Lote 11 (combate), atualizadas no V2: a ordem de turno simples, o menu do token e a leitura do que a tela mostra.

/** Liga o painel da ordem de turno (menu superior do mestre) se ainda não está ligado. */
export async function ligarOrdem(mestre: Page) {
  const botao = mestre.getByTestId("menu-ordem-turno");
  if ((await botao.getAttribute("aria-pressed")) !== "true") await botao.click();
  await expect(mestre.getByTestId("ordem-de-turno")).toBeVisible();
}

/** A linha da ordem de turno com este nome. */
export const linha = (p: Page, nome: string): Locator =>
  p.locator(`[data-testid="ordem-entrada"][data-nome="${nome}"]`);

/** Os nomes na ordem em que a lista os mostra. */
export const nomesNaOrdem = (p: Page) =>
  p
    .locator('[data-testid="ordem-entrada"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-nome") ?? ""));

/** O nome da entrada que está na vez (ou `null`). */
export async function vezNaOrdem(p: Page): Promise<string | null> {
  const vez = p.locator('[data-testid="ordem-entrada"][data-vez]');
  return (await vez.count()) === 0 ? null : await vez.first().getAttribute("data-nome");
}

/** O mestre digita o valor da iniciativa de uma entrada (Enter confirma). */
export async function definirValor(mestre: Page, nome: string, valor: number | string) {
  const campo = linha(mestre, nome).locator('input[type="number"]');
  await campo.fill(String(valor));
  await campo.press("Enter");
}

/** Botão direito no token (o mapa centra nele antes). */
export async function menuDoToken(p: Page, tokenId: string, desvioPx = 0) {
  const alvo = await centrarNoToken(p, tokenId);
  await p.mouse.click(alvo.x + desvioPx, alvo.y, { button: "right" });
}

/** O anel da vez está aceso neste token, como o mapa desenha? */
export async function emVez(p: Page, tokenId: string): Promise<boolean | null> {
  const t = await tokenDe(p, tokenId).catch(() => null);
  return t ? t.emVez : null;
}

/** A rodada que a janela mostra (lida do atributo, igual para o mestre, que a edita, e para o jogador). */
export async function rodadaDe(p: Page): Promise<number> {
  return Number(await p.getByTestId("ordem-rodada").getAttribute("data-rodada"));
}

/** Botão direito na linha da entrada e um item do menu ("ordem-menu-dar-vez" ou "ordem-menu-tirar"). */
export async function menuDaLinha(mestre: Page, nome: string, item: string) {
  await linha(mestre, nome).click({ button: "right" });
  await mestre.getByTestId(item).click();
}
