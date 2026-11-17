import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirPreferencia,
  test as base,
  enviarCru,
  expect,
  intencaoCrua,
  Mesa,
  tornarMembros,
} from "../tests/ajudas";
import {
  entrarNoMapa,
  esperarPosicao,
  type GanchoDoMapa,
  soSelecionarToken,
  tokenDe,
} from "../tests/ajudasMapa";

// Prints do lote Q12 (seguir meu token): o controle de zoom com o botão novo desligado e ligado, a lista de escolha
// com dois tokens e o token centrado depois de andar. Grimório 1600×900 e 1280×720 e Pergaminho 1600×900. Fora do
// `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints q12

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

async function foto(p: Page, nome: string) {
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

for (const c of COMBINACOES) {
  base(`q12 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(180_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      await tornarMembros(request, "jogador-1");
      const rotulo = `${c.tema}-${c.nome}`;
      const m = await entrarNoMapa(mesa, "mestre");
      const j = await entrarNoMapa(mesa, "jogador-1");
      const p = j.pagina;
      await escolherTema(p, c.tema);

      // 1. o controle de zoom com o botão novo desligado e ligado
      await foto(p, `${rotulo}-1-zoom-desligado`);
      await p.getByTestId("zoom-seguir").click();
      await expect(p.getByTestId("zoom-seguir")).toHaveAttribute("aria-pressed", "true");
      await foto(p, `${rotulo}-2-zoom-ligado`);

      // 3. o token centrado depois de andar
      await soSelecionarToken(p, "tok-jogador-1");
      for (const tecla of ["ArrowLeft", "ArrowLeft", "ArrowDown", "ArrowDown", "ArrowDown"]) {
        await p.keyboard.press(tecla);
      }
      const t = await tokenDe(p, "tok-jogador-1");
      await esperarPosicao(p, "tok-jogador-1", t.x, t.y);
      await foto(p, `${rotulo}-3-centrado`);

      // 2. a lista de escolha com dois tokens
      await enviarCru(
        m.pagina,
        intencaoCrua("token.criar", {
          cenaId: "cena-1",
          token: {
            id: "tok-corvo-q12",
            nome: "Corvo",
            cor: "#e6194b",
            tamanhoQuadrados: 1,
            x: t.x + 3,
            y: t.y,
            camada: "tokens",
            oculto: false,
            controladoPor: ["jogador-1"],
          },
        }),
      );
      await expect(p.getByTestId("zoom-seguir-lista")).toBeVisible();
      await p.getByTestId("zoom-seguir-lista").click();
      await expect(p.getByTestId("zoom-seguir-menu")).toBeVisible();
      await foto(p, `${rotulo}-4-lista`);
      await p.evaluate(() =>
        (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.definirZoom(1),
      );
    } finally {
      await mesa.fechar();
    }
  });
}
