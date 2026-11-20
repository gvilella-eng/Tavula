import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { gerarToken } from "../tests/ajudasClaude";
import { abrirFicha } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";
import { ClienteMcp, construirOMcp } from "../tests/ajudasMcp";

// Prints do lote 12-2 (o servidor MCP): "Conectar o Claude" com o comando final, a ficha que o Claude do jogador criou e a
// lista de rascunhos que o Claude do mestre criou. Grimório em 1600×900 e 1280×720 e Pergaminho (claro) em 1600×900.
// Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints 12-2

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
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

base.beforeAll(() => construirOMcp());

for (const c of COMBINACOES) {
  base(`servidor MCP ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const r = `${c.tema}-${c.nome}`;
    const abertos: ClienteMcp[] = [];
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const j1 = await entrarNoMapa(mesa, "jogador-1");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      await escolherTema(j1.pagina, c.tema);

      // 1. Conectar o Claude: o comando final, com o endereço da página e o token já colados.
      await abrirAba(m, "preferencias");
      await m.getByTestId("claude-token-nome").fill("Claude no meu PC");
      await m.getByTestId("claude-gerar").click();
      await expect(m.getByTestId("claude-token-novo")).toBeVisible();
      await m.getByTestId("claude-trecho-code").scrollIntoViewIfNeeded();
      await foto(m, `${r}-1-conectar-o-claude-comando`);
      await m.getByTestId("claude-token-guardei").click();

      // 2. A ficha que o Claude do jogador criou: aparece na mesa dele e abre na janela da ficha.
      const doJogador = await ClienteMcp.conectar((await gerarToken(j1.pagina)).token);
      abertos.push(doJogador);
      const criou = await doJogador.chamar("fichas", {
        fichas: [
          {
            nome: "Thara Pedra-Forte",
            raca: "Anã",
            classes: [{ classe: "Clérigo", nivel: 3 }],
            atributos: { for: 10, des: 12, con: 14, int: 10, sab: 16, car: 12 },
            pericias: ["Religião", "Medicina", "Intuição"],
            compendio: ["Detectar Magia", "Bola de Fogo", "Espada longa", "Poção de cura"],
            itens: [{ nome: "Símbolo sagrado" }, { nome: "Corda de seda", quantidade: 1 }],
            caracteristicas: [
              {
                nome: "Visão no escuro",
                descricao: "Enxerga até 18 m na penumbra.",
                origem: "Raça: Anã",
              },
            ],
            historia: "Cresceu cuidando do santuário da família, nas minas do norte.",
          },
        ],
      });
      expect(criou.erro, criou.texto).toBe(false);
      await abrirAba(j1.pagina, "fichas");
      const item = j1.pagina.locator('[data-testid^="ficha-item-"]').filter({ hasText: "Thara" });
      await expect(item).toBeVisible();
      const id = ((await item.getAttribute("data-testid")) ?? "").replace("ficha-item-", "");
      await abrirFicha(j1.pagina, id, "principal");
      await foto(j1.pagina, `${r}-2-ficha-criada-pelo-claude-do-jogador`);

      // 3. Os rascunhos que o Claude do mestre criou: o chip e a lista.
      const doMestre = await ClienteMcp.conectar((await gerarToken(m)).token);
      abertos.push(doMestre);
      const npcs = await doMestre.chamar("fichas", {
        fichas: [
          { nome: "Goblin arqueiro", pv: { max: 7 }, ca: 13, atributos: { des: 14 } },
          { nome: "Goblin líder", pv: { max: 21 }, ca: 15 },
        ],
      });
      expect(npcs.erro, npcs.texto).toBe(false);
      const cena = await doMestre.chamar("cenas", {
        cenas: [
          {
            nome: "Eclusa abandonada",
            paredes: [
              { de: [2, 2], ate: [14, 2] },
              { de: [14, 2], ate: [14, 9], tipo: "porta" },
              { de: [2, 9], ate: [14, 9], por: [8, 11] },
            ],
            tokens: [{ ficha: "Goblin arqueiro", quantidade: 3, em: [6.5, 5.5], oculto: true }],
          },
        ],
      });
      expect(cena.erro, cena.texto).toBe(false);
      const auto = await doMestre.chamar("automacoes", {
        fluxos: [
          {
            nome: "Vento da eclusa",
            gatilho: { tipo: "relogio", cadaS: 600 },
            trilhas: [
              [
                {
                  bloco: "paraCada",
                  alvo: { tipo: "tokens" },
                  corpo: [
                    { bloco: "acao", acao: { acao: "visao.limitar", alcanceM: 3, porS: 60 } },
                  ],
                },
              ],
            ],
          },
        ],
      });
      expect(auto.erro, auto.texto).toBe(false);
      await doMestre.chamar("notas", {
        notas: [{ titulo: "A eclusa antiga", texto: "Uma comporta de pedra.", visivel: "todos" }],
      });
      await abrirAba(m, "fichas");
      await expect(m.getByTestId("chip-rascunhos")).toBeVisible();
      await m.getByTestId("chip-rascunhos").click();
      await expect(m.getByTestId("rascunhos-lista")).toBeVisible();
      await foto(m, `${r}-3-rascunhos-do-claude-do-mestre`);
      await m.keyboard.press("Escape");
    } finally {
      await Promise.all(abertos.map((a) => a.fechar()));
      await mesa.fechar();
    }
  });
}
