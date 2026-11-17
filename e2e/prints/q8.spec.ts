import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirPreferencia,
  test as base,
  enviarCru,
  expect,
  intencaoCrua,
  Mesa,
  tornarMembros,
} from "../tests/ajudas";
import { entrarNoMapa, soSelecionarToken, tokensDe } from "../tests/ajudasMapa";
import { enviarEEsperarSnapshot } from "../tests/ajudasSom";

// Prints do lote Q8 (aba Mesa em cartões, botão Automações, token do jogador na bandeira): Grimório 1600×900 e 1280×720
// e Pergaminho 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints q8

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const SECOES = ["esta-mesa", "regras", "luz", "pessoas", "campanha", "diagnostico"] as const;
const TODAS = [...SECOES, "automacoes"] as const;

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

/** Deixa aberto só o cartão pedido na aba Mesa. */
async function soEsta(p: Page, aberta: (typeof TODAS)[number]) {
  for (const id of TODAS) {
    const titulo = p.getByTestId(`mesa-secao-${id}-titulo`);
    const quer = id === aberta ? "true" : "false";
    if ((await titulo.getAttribute("aria-expanded")) !== quer) await titulo.click();
    await expect(titulo).toHaveAttribute("aria-expanded", quer);
  }
}

for (const c of COMBINACOES) {
  base(`q8 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      await tornarMembros(request, "jogador-1");
      const rotulo = `${c.tema}-${c.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);

      // a aba Mesa, um cartão aberto de cada vez, e as Preferências ao lado para comparar
      await m.getByTestId("aba-mesa").click();
      await expect(m.getByTestId("aba-painel-mesa")).toBeVisible();
      await foto(m, `q8-${rotulo}-1-mesa-fechada`);
      let n = 2;
      for (const id of SECOES) {
        await soEsta(m, id);
        await foto(m, `q8-${rotulo}-${n++}-mesa-${id}`);
      }
      await soEsta(m, "automacoes");
      await foto(m, `q8-${rotulo}-${n++}-mesa-automacoes`);
      await abrirAba(m, "preferencias");
      await foto(m, `q8-${rotulo}-${n++}-preferencias`);
      await m.getByTestId("aba-chat").click();

      // a barra de cima com o botão novo e a janela das automações aberta
      await m.getByTestId("menu-automacoes").click();
      await expect(m.getByTestId("automacoes-janela")).toBeVisible();
      await foto(m, `q8-${rotulo}-${n++}-barra-e-automacoes`);
      await m.getByTestId("menu-automacoes").click();

      // o token do jogador na bandeira da cena B (o token da A fica em outra cena)
      const j1 = await entrarNoMapa(mesa, "jogador-1");
      const j = j1.pagina;
      await escolherTema(j, c.tema);
      await enviarCru(m, intencaoCrua("cena.criar", { id: "cena-q8", nome: "Câmara de baixo" }));
      await enviarEEsperarSnapshot(m, intencaoCrua("grupo.moverPara", { cenaId: "cena-q8" }));
      await enviarCru(
        m,
        intencaoCrua("personagem.colocar", {
          personagemId: "pers-aldric",
          cenaId: "cena-1",
          tokenId: "tok-q8-a",
          x: 5,
          y: 5,
        }),
      );
      await expect.poll(async () => (await tokensDe(j)).length).toBeGreaterThan(0);
      await j.getByTestId("aba-fichas").click();
      await soSelecionarToken(j, "tok-jogador-1");
      await j.keyboard.press("Delete");
      await expect
        .poll(async () => (await tokensDe(j)).some((t) => t.id === "tok-jogador-1"))
        .toBe(false);
      await j.getByTestId("ficha-colocar-pers-aldric").click();
      await expect
        .poll(async () => (await tokensDe(j)).some((t) => t.nome === "Aldric"))
        .toBe(true);
      await foto(j, `q8-${rotulo}-${n++}-jogador-na-bandeira`);
    } finally {
      await mesa.fechar();
    }
  });
}
