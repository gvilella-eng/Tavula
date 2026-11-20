import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, abrirPreferencia, test as base, expect, Mesa } from "../tests/ajudas";
import { abrirFicha, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, type GanchoDoMapa } from "../tests/ajudasMapa";

// Prints do lote FG1 (luz e fogo): a chama animada, o suporte com a tocha no lugar do ícone, o zoom do mapa, a área de
// soltar, as alças de esticar a chama, o editor do modelo (chama, animações e a cor alinhada) e a setinha do item de
// modelo na ficha. Só Grimório (1600x900 e 1280x720) e Pergaminho (claro, 1600x900). Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints fg1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const VARIANTES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const falhas: string[] = [];
async function tentar(nome: string, passo: () => Promise<void>) {
  try {
    await passo();
  } catch (e) {
    const msg = (e as Error).message.split("\n").slice(0, 3).join(" | ");
    falhas.push(`${nome}: ${msg}`);
    console.log(`[FALHOU] ${nome}: ${msg}`);
  }
}
base.afterAll(() => {
  if (falhas.length) console.log(`[FG1] FALHAS:\n - ${falhas.join("\n - ")}`);
});

const foto = async (p: Page, nome: string, espera = 500) => {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
};

const gancho = <T>(p: Page, f: (h: GanchoDoMapa) => T) =>
  p.evaluate(
    ([corpo]) =>
      (new Function("h", `return (${corpo})(h)`) as (h: unknown) => unknown)(
        (window as unknown as { __tabletop: unknown }).__tabletop,
      ),
    [f.toString()],
  ) as Promise<T>;

/** Manda uma intenção que a sala não responde com evento (acender o inflamável). */
async function mandarCru(p: Page, tipo: string, dados: object) {
  await p.evaluate(
    ([t, d]) =>
      new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
        ws.onopen = () => {
          ws.send(JSON.stringify({ v: 1, id: `teste-${Math.random()}`, tipo: t, dados: d }));
          setTimeout(() => {
            ws.close();
            resolve();
          }, 400);
        };
      }),
    [tipo, dados] as [string, object],
  );
}

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const ponto = (id: string, nome: string, x: number, y: number, extra: object = {}) => ({
  id,
  nome,
  x,
  y,
  visivelParaJogadores: true,
  ...extra,
});

for (const v of VARIANTES) {
  base(`fg1 ${v.tema} ${v.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: v.width, height: v.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const rotulo = `${v.tema}-${v.nome}`;
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, v.tema);

      // A cena: Aldric (11,25; 9,75) com duas tochas; um suporte com a tocha, um suporte vazio, uma fogueira
      // pequena, uma palha grande, uma lenha ainda apagada.
      await mandar(m, "mochila.ajustar", {
        personagemId: "pers-aldric",
        modeloId: "modelo-tocha",
        delta: 3,
      });
      await mandar(m, "ponto.criar", {
        ponto: ponto("gancho", "Gancho", 12.75, 9.75, { tipo: "suporte" }),
      });
      await mandar(m, "ponto.criar", {
        ponto: ponto("gancho-vazio", "Gancho vazio", 9.75, 9.75, { tipo: "suporte" }),
      });
      for (const [id, x, y, extra] of [
        ["lenha", 12.75, 8.25, { segurarS: 0 }],
        ["palha", 9.75, 8.25, { segurarS: 0, chamaM: { larguraM: 3, alturaM: 3 } }],
        ["lenha-fria", 12.75, 11.25, { segurarS: 0 }],
      ] as const) {
        await mandar(m, "ponto.criar", {
          ponto: ponto(id, id, x, y, { tipo: "inflamavel", modeloId: "modelo-fogueira", ...extra }),
        });
      }
      await mandar(m, "tocha.acender", {
        personagemId: "pers-aldric",
        modeloId: "modelo-tocha",
        novoId: "tocha-1",
      });
      await mandar(m, "tocha.acender", {
        personagemId: "pers-aldric",
        modeloId: "modelo-tocha",
        novoId: "tocha-2",
      });
      for (const alvo of ["lenha", "palha"]) {
        await mandarCru(m, "ponto.acenderInicio", { pontoId: alvo, objetoId: "tocha-1" });
        await mandarCru(m, "ponto.acenderFim", { pontoId: alvo, objetoId: "tocha-1" });
      }
      await mandar(m, "tocha.posar", { id: "tocha-2", pontoId: "gancho" });
      await expect.poll(() => gancho(m, (h) => h.chamas().length)).toBe(3);
      const centrar = (z: number) =>
        m.evaluate(
          ([zz]) => {
            const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
            h.definirZoom(zz as number);
            h.centrarEm(11.25, 9.5);
          },
          [z],
        );

      await tentar(`${rotulo} mapa com as chamas`, async () => {
        await centrar(2.4);
        await foto(m, `fg1-${rotulo}-1-mapa-chamas`);
      });
      await tentar(`${rotulo} mapa em zoom baixo`, async () => {
        await centrar(0.6);
        await foto(m, `fg1-${rotulo}-2-mapa-zoom-baixo`);
      });
      await tentar(`${rotulo} area de soltar`, async () => {
        await centrar(2.4);
        // a tocha da mão do Aldric é arrastada para perto do suporte vazio (fora do ícone, dentro da área)
        const alca = (await gancho(m, (h) => h.alcas())).find((a) => a.portador === "mao");
        const vazio = (await gancho(m, (h) => h.pontos())).find((x) => x.id === "gancho-vazio");
        if (!alca || !vazio) throw new Error("sem alça ou sem suporte");
        await m.mouse.move(alca.x, alca.y);
        await m.mouse.down();
        await m.mouse.move(vazio.x - vazio.raioPx - 40, vazio.y + 8, { steps: 10 });
        await foto(m, `fg1-${rotulo}-3-area-de-soltar`, 300);
        await m.mouse.move(alca.x - 260, alca.y + 130, { steps: 6 });
        await m.mouse.up();
      });
      await tentar(`${rotulo} alças de esticar`, async () => {
        await centrar(2);
        await m.getByTestId("menu-iluminacao").click();
        await m.getByTestId("lanterna-fontes").click();
        const palha = (await gancho(m, (h) => h.pontos())).find((x) => x.id === "palha");
        if (!palha) throw new Error("sem a palha");
        await m.mouse.click(palha.x, palha.y);
        await expect(m.getByTestId("ponto-editor")).toBeVisible();
        await foto(m, `fg1-${rotulo}-4-alcas-de-tamanho`);
      });
      await tentar(`${rotulo} editor do modelo`, async () => {
        await abrirAba(m, "mesa");
        const corpo = m.getByTestId("modelo-nome-modelo-tocha");
        if (!(await corpo.isVisible())) await m.getByTestId("modelo-resumo-modelo-tocha").click();
        await corpo.scrollIntoViewIfNeeded();
        await m.getByTestId("modelo-chama-modelo-tocha").scrollIntoViewIfNeeded();
        await m.getByTestId("modelo-cor-modelo-tocha").scrollIntoViewIfNeeded();
        await foto(m, `fg1-${rotulo}-5-editor-do-modelo`);
      });
      await tentar(`${rotulo} ficha com a setinha`, async () => {
        const janela = await abrirFicha(m, "pers-aldric", "principal");
        await janela.getByTestId("fh-itens").scrollIntoViewIfNeeded();
        await foto(m, `fg1-${rotulo}-6-ficha-seta-aberta`);
        const seta = janela.locator('[data-testid^="item-seta-"]').first();
        await seta.click();
        await expect(seta).toHaveAttribute("aria-expanded", "false");
        await foto(m, `fg1-${rotulo}-7-ficha-seta-recolhida`);
        await seta.click();
      });
    } finally {
      await mesa.fechar();
    }
  });
}
