import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { ClaudeWs } from "../tests/ajudasClaude";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote 12-1 (o acesso do Claude): "Conectar o Claude" com o token novo e com a lista, o chip e a lista de
// rascunhos, os lotes com Desfazer, o "Nova ficha" do jogador, uma rolagem "pelo Claude" e a capacidade em Permissões.
// Grimório em 1600×900 e 1280×720 e Pergaminho (claro) em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints 12-1

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

async function foto(p: Page, nome: string, espera = 400) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
}

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const npc = (id: string, nome: string) => ({
  id,
  pastaId: "pasta-npcs",
  editores: { tipo: "jogadores", ids: [] },
  nome,
  tokenPadrao: { cor: "#c0392b", tamanhoQuadrados: 1 },
  visao: { alcanceM: null, visaoNoEscuroM: 0 },
});

for (const c of COMBINACOES) {
  base(`acesso do Claude ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const r = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const j1 = await entrarNoMapa(mesa, "jogador-1");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      await escolherTema(j1.pagina, c.tema);

      // Conectar o Claude: token recém-gerado e depois a lista
      await abrirAba(m, "preferencias");
      await m.getByTestId("claude-token-nome").fill("Claude no meu PC");
      await m.getByTestId("claude-gerar").click();
      await expect(m.getByTestId("claude-token-novo")).toBeVisible();
      await m.getByTestId("conectar-claude").scrollIntoViewIfNeeded();
      await foto(m, `${r}-1-conectar-token-novo`);
      const token = ((await m.getByTestId("claude-token-valor").textContent()) ?? "").trim();
      await m.getByTestId("claude-token-guardei").click();
      await foto(m, `${r}-2-conectar-lista`);

      // O Claude do mestre conecta e cria rascunhos (e uma rolagem)
      const claude = await ClaudeWs.conectar(token);
      await expect(m.getByTestId("presenca-claude-mestre")).toBeVisible();
      await claude.mandar(
        "personagem.criar",
        { personagem: npc("g1", "Goblin arqueiro") },
        { loteId: "L1", lote: "criou 3 NPCs" },
      );
      await claude.mandar(
        "personagem.criar",
        { personagem: npc("g2", "Goblin líder") },
        { loteId: "L1", lote: "criou 3 NPCs" },
      );
      await claude.mandar(
        "personagem.criar",
        { personagem: npc("g3", "Lobo das cavernas") },
        { loteId: "L1", lote: "criou 3 NPCs" },
      );
      await claude.mandar(
        "cena.criar",
        { id: "cena-rascunho", nome: "Caverna do Lobo" },
        { loteId: "L2", lote: "criou a cena da caverna" },
      );
      await claude.mandar("dado.rolar", { expressao: "2d6+3" });
      await abrirAba(m, "chat");
      await expect(m.getByTestId("chat-pelo-claude")).toBeVisible();
      await foto(m, `${r}-3-rolagem-pelo-claude`);

      await abrirAba(m, "fichas");
      await expect(m.getByTestId("chip-rascunhos")).toBeVisible();
      await m.getByTestId("chip-rascunhos").click();
      await expect(m.getByTestId("rascunhos-lista")).toBeVisible();
      await foto(m, `${r}-4-rascunhos-chip-e-lista`);
      await m.keyboard.press("Escape");

      await abrirAba(m, "preferencias");
      await m.getByTestId("conectar-claude").scrollIntoViewIfNeeded();
      await m.getByTestId("claude-lotes").scrollIntoViewIfNeeded();
      await foto(m, `${r}-5-lotes-com-desfazer`);

      // O jogador: Nova ficha e Novo handout
      await abrirAba(j1.pagina, "fichas");
      await expect(j1.pagina.getByTestId("ficha-jogador-nova")).toBeVisible();
      await foto(j1.pagina, `${r}-6-jogador-nova-ficha`);

      // Permissões: a capacidade nova
      await abrirAba(m, "mesa");
      await m.getByTestId("perm-padrao-personagem.criarProprio").scrollIntoViewIfNeeded();
      await foto(m, `${r}-7-permissoes`);
      await claude.fechar();
    } finally {
      await mesa.fechar();
    }
  });
}
