import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { imagensDoMapa, pngDeSalaRedonda } from "../tests/ajudasAssets";
import { gerarToken } from "../tests/ajudasClaude";
import { enviarPor, linkDoTexto } from "../tests/ajudasEnvio";
import { entrarNoMapa } from "../tests/ajudasMapa";
import { ClienteMcpHttp, URL_PELO_VITE } from "../tests/ajudasMcp";

// Prints do lote M1 (o Claude sobe um mapa para a cena): a cena com o mapa e o aviso "O Claude enviou 1 arquivo".
// Grimório em 1600x900 e 1280x720 e Pergaminho (claro) em 1600x900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints m1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click();
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

for (const c of COMBINACOES) {
  base(`M1 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    let mcp: ClienteMcpHttp | null = null;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${c.tema}-${c.nome}`;
      const mestre = await entrarNoMapa(mesa, "mestre");
      const m = mestre.pagina;
      await escolherTema(m, c.tema);
      const { token } = await gerarToken(m);
      mcp = await ClienteMcpHttp.conectar(token, { url: URL_PELO_VITE });

      // O download da caixa demora um pouco, para o aviso ser visto enquanto a mesa processa.
      await m.route("**/api/m/*/caixa/*", async (rota) => {
        await new Promise((resolve) => setTimeout(resolve, 3500));
        await rota.continue();
      });

      const pedido = await mcp.chamar("arquivos", {
        uso: "mapa da cena",
        nome: "cripta.png",
        cena: "Cena inicial",
        quadrados: 10,
      });
      expect(pedido.erro, pedido.texto).toBe(false);
      const mapa = pngDeSalaRedonda(700, 700, { x: 350, y: 350 }, 300);
      const envio = enviarPor(linkDoTexto(pedido.texto), mapa);

      await expect(m.getByTestId("aviso-caixa-claude")).toBeVisible();
      await expect(m.getByTestId("aviso-caixa-claude")).toHaveAttribute(
        "data-estado",
        "processando",
      );
      await foto(m, `${rotulo}-01-aviso-o-claude-enviou-1-arquivo`, 300);

      const resposta = await envio;
      expect(resposta.json?.estado, resposta.corpo).toBe("aplicado");
      await expect.poll(async () => (await imagensDoMapa(m)).tiles.length).toBeGreaterThan(0);
      await expect(m.getByTestId("aviso-caixa-claude")).toHaveAttribute("data-estado", "pronto");
      await foto(m, `${rotulo}-02-cena-com-o-mapa-que-o-claude-enviou`, 800);
    } finally {
      await mcp?.fechar();
      await mesa.fechar();
    }
  });
}
