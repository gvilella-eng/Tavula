import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirPreferencia,
  test as base,
  CAMINHO_DA_MESA,
  esperarMapa,
  expect,
} from "../tests/ajudas";

// Prints do lote AU3 (portas lógicas viram caixas e o tour do centro de automações): o editor com a caixa QUALQUER UM (dois
// gatilhos dentro), TODAS com NÃO dentro ligada ao Se, o contorno e a dica ao arrastar sobre a caixa, e o tour (o centro, a
// explicação das caixas, um passo de "fazer" com a seta e o fim). Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints au3

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const CASOS = [
  { tema: "grimorio", nome: "grimorio-1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "grimorio-1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "pergaminho-1600x900", width: 1600, height: 900 },
] as const;

async function escolherTema(p: Page, tema: string) {
  await abrirPreferencia(p, "aparencia");
  await p.getByTestId(`tema-${tema}`).click();
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
}

const centro = async (p: Page, testid: string) => {
  const b = await p.getByTestId(testid).boundingBox();
  if (!b) throw new Error(`sem caixa em ${testid}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

for (const c of CASOS) {
  base(`au3 ${c.nome}`, async ({ mesa }) => {
    base.setTimeout(240_000);
    const s = await mesa.abrir();
    await s.contexto.addInitScript(() => {
      try {
        localStorage.setItem("tabletop:pref:tourDasAutomacoesNoTeste", "1");
      } catch {
        // sem armazenamento
      }
    });
    const m = s.pagina;
    await m.goto(CAMINHO_DA_MESA);
    await m.getByTestId("entrar-mestre").click();
    await expect(m.getByTestId("status-conexao")).toHaveText("conectado");
    await esperarMapa(m);
    await m.setViewportSize({ width: c.width, height: c.height });
    await escolherTema(m, c.tema);
    const foto = async (pagina: Page, nome: string) => {
      await pagina.waitForTimeout(500);
      await pagina.screenshot({ path: join(PASTA as string, `${c.nome}-${nome}.png`) });
    };

    // o centro, com o tour abrindo sozinho na primeira vez
    await m.getByTestId("menu-automacoes").click();
    await expect(m.getByTestId("tour-auto")).toHaveAttribute("data-passo", "centro");
    await foto(m, "01-tour-centro");
    await m.getByTestId("tour-auto-pular").click();

    // o editor: a caixa OU com dois gatilhos, ligada a "para cada tocha" e "sortear 30%"
    const [e] = await Promise.all([m.waitForEvent("popup"), m.getByTestId("auto-nova").click()]);
    await e.setViewportSize({ width: c.width, height: c.height });
    await expect(e.getByTestId("ed-raiz")).toBeVisible();
    await e.getByTestId("ed-nome").fill("As tochas apagam");
    const soltar = (peca: string, dx: number, dy: number) =>
      e.getByTestId(`ed-peca-${peca}`).dragTo(e.getByTestId("ed-canvas"), {
        targetPosition: { x: dx, y: dy },
      });
    const noEspaco = (peca: string, caixa: string, espaco: number) =>
      e.getByTestId(`ed-peca-${peca}`).dragTo(e.getByTestId(`ed-espaco-${caixa}-${espaco}`));
    await e.getByTestId("ed-no-n1").click();
    await e.getByTestId("ed-campo-cada").fill("180");
    await soltar("ou", 60, 190); // n2: OU, dois espaços
    const b1 = await centro(e, "ed-no-n1");
    const b2 = await centro(e, "ed-espaco-n2-0");
    await e.mouse.move(b1.x, b1.y);
    await e.mouse.down();
    await e.mouse.move(b1.x + 14, b1.y + 14, { steps: 3 });
    await e.mouse.move(b2.x, b2.y, { steps: 10 });
    // segurando o gatilho sobre o espaço: o lugar onde ele cai fica marcado
    await expect(e.getByTestId("ed-espaco-n2-0")).toHaveAttribute("data-solta", "ok");
    await foto(e, "02-arrastando-para-o-espaco");
    await e.mouse.up();
    await noEspaco("botao", "n2", 1); // n3
    await e.getByTestId("ed-campo-botao").fill("Combate");
    await e.getByTestId("ed-peca-paraCada").click(); // n4
    await e.getByTestId("ed-peca-sortear").click(); // n5
    await e.getByTestId("ed-peca-apagar").click(); // n6
    await e.getByTestId("ed-no-n5").click();
    await e.getByTestId("ed-campo-chance").fill("30");
    const ligar = async (de: string, sai: string, para: string, ent: string) => {
      const a = await centro(e, `ed-porta-${de}-${sai}`);
      const b = await centro(e, `ed-porta-${para}-${ent}`);
      await e.mouse.move(a.x, a.y);
      await e.mouse.down();
      await e.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
      await e.mouse.move(b.x, b.y, { steps: 5 });
      await e.mouse.up();
    };
    await ligar("n2", "saida", "n4", "entrada");
    await ligar("n4", "corpo", "n5", "entrada");
    await ligar("n5", "sim", "n6", "entrada");
    await e.getByTestId("ed-zoom-ajustar").click();
    await e.getByTestId("ed-no-n2").click();
    await foto(e, "03-caixa-ou-com-dois-gatilhos");

    await e.close();

    // outras caixas, numa automação nova: E com três espaços (um NÃO com uma condição, uma condição e outra), e ação OU ação
    const [e3] = await Promise.all([m.waitForEvent("popup"), m.getByTestId("auto-nova").click()]);
    await e3.setViewportSize({ width: c.width, height: c.height });
    await expect(e3.getByTestId("ed-raiz")).toBeVisible();
    const soltar3 = (peca: string, dx: number, dy: number) =>
      e3.getByTestId(`ed-peca-${peca}`).dragTo(e3.getByTestId("ed-canvas"), {
        targetPosition: { x: dx, y: dy },
      });
    const noEspaco3 = (peca: string, caixa: string, espaco: number) =>
      e3.getByTestId(`ed-peca-${peca}`).dragTo(e3.getByTestId(`ed-espaco-${caixa}-${espaco}`));
    await soltar3("e", 40, 30); // n2: E
    await noEspaco3("nao", "n2", 0); // n3: NÃO dentro de E
    await noEspaco3("chance", "n3", 0); // n4: dentro do NÃO
    await noEspaco3("chance", "n2", 1); // n5
    await e3.getByTestId("ed-mais-n2").click(); // um terceiro espaço
    await noEspaco3("tokenDeJogador", "n2", 2); // n6
    await soltar3("ou", 360, 30); // n7: OU de ações
    await noEspaco3("chat", "n7", 0); // n8
    await noEspaco3("chat", "n7", 1); // n9
    await e3.getByTestId("ed-zoom-ajustar").click();
    await e3.getByTestId("ed-no-n2").click();
    await foto(e3, "04-caixas-aninhadas-e-de-acao");

    // três níveis: E ( OU ( NÃO ( chance ), chance ), token de jogador )
    await e3.getByTestId("ed-peca-e").click(); // n10 (por clique: nunca cai dentro de um espaço)
    await noEspaco3("ou", "n10", 0); // n11
    await noEspaco3("nao", "n11", 0); // n12
    await noEspaco3("chance", "n12", 0); // n13
    await noEspaco3("chance", "n11", 1); // n14
    await noEspaco3("tokenDeJogador", "n10", 1); // n15
    await e3.getByTestId("ed-zoom-ajustar").click();
    await e3.getByTestId("ed-no-n10").click();
    await foto(e3, "04b-tres-niveis");

    // o que não combina: soltar a caixa de ações num espaço já ocupado fica com contorno vermelho e a dica
    const g = await centro(e3, "ed-no-n7");
    const t = await centro(e3, "ed-espaco-n2-1");
    await e3.mouse.move(g.x, g.y - 20);
    await e3.mouse.down();
    await e3.mouse.move(g.x - 14, g.y - 6, { steps: 3 });
    await e3.mouse.move(t.x, t.y, { steps: 10 });
    await foto(e3, "05-recusa-espaco-ocupado");
    await e3.mouse.up();
    await e3.getByTestId("ed-organizar").click();
    await foto(e3, "06-editor-organizado");

    // o tour no editor: o passo das caixas lógicas
    await e3.getByTestId("ed-conhecer").click();
    for (const passo of ["quando", "fluxo", "condicoes", "caixas"]) {
      await e3.getByTestId("tour-auto-proximo").click();
      await expect(e3.getByTestId("tour-auto")).toHaveAttribute("data-passo", passo);
    }
    await foto(e3, "07-tour-caixas");
    await e3.getByTestId("tour-auto-pular").click();
    await e3.close();

    // um editor novo, só para o tour de fazer e o fim
    const [e2] = await Promise.all([m.waitForEvent("popup"), m.getByTestId("auto-nova").click()]);
    await e2.setViewportSize({ width: c.width, height: c.height });
    await e2.getByTestId("ed-conhecer").click();
    for (let i = 0; i < 8; i++) await e2.getByTestId("tour-auto-proximo").click();
    await expect(e2.getByTestId("tour-auto")).toHaveAttribute("data-passo", "relogio");
    await e2.getByTestId("tour-auto-fazer").click();
    await e2.getByTestId("tour-auto-proximo").click();
    await e2.getByTestId("tour-auto-fazer").click();
    await e2.getByTestId("tour-auto-proximo").click();
    await expect(e2.getByTestId("tour-auto")).toHaveAttribute("data-passo", "ligar-relogio");
    await foto(e2, "08-tour-ligar-com-seta");
    for (let i = 0; i < 9; i++) {
      const f = e2.getByTestId("tour-auto-fazer");
      if (await f.isVisible()) await f.click();
      await e2.getByTestId("tour-auto-proximo").click();
      if ((await e2.getByTestId("tour-auto").getAttribute("data-passo")) === "fim") break;
    }
    await expect(e2.getByTestId("tour-auto")).toHaveAttribute("data-passo", "fim");
    await foto(e2, "09-tour-fim");
    await e2.close();
  });
}
